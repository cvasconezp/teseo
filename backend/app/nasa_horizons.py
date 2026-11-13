"""
nasa_horizons.py — Cliente para la API pública de NASA JPL Horizons

Consulta posiciones reales de cuerpos del sistema solar en cualquier fecha.
API gratuita, sin autenticación, mantenida por NASA/JPL.
Documentación: https://ssd-api.jpl.nasa.gov/doc/horizons.html
Política de uso: https://ssd-api.jpl.nasa.gov/doc/ (una petición a la vez,
cachear resultados, retroceder ante errores).
"""

import math
import re
from datetime import datetime, timedelta
from typing import Optional

import asyncio
import time

import httpx

from app.cache import iso_utc, provider_headers

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

# Cometas notables. Usamos la designación con "CAP" (aparición más cercana) para
# que Horizons resuelva un único registro en vez de pedir desambiguación.
NOTABLE_COMETS = [
    ("DES=1P;CAP", "1P/Halley"),
    ("DES=2P;CAP", "2P/Encke"),
    ("DES=12P;CAP", "12P/Pons-Brooks"),
    ("DES=55P;CAP", "55P/Tempel-Tuttle"),
    ("DES=109P;CAP", "109P/Swift-Tuttle"),
    ("DES=67P;CAP", "67P/Churyumov-Gerasimenko"),
    ("C/2023 A3;", "C/2023 A3 (Tsuchinshan-ATLAS)"),
]

AU_KM = 149_597_870.7
LIGHT_MINUTE_KM = 17_987_547.48  # c × 60 s


def _sc(command, name, note_es, note_en, target, agency, launched,
        status_es=None, status_en=None, phase=None) -> dict:
    return {
        "command": command, "name": name, "note_es": note_es, "note_en": note_en,
        "target": target, "agency": agency, "launched": launched,
        "status_note": status_es, "status_note_en": status_en, "phase": phase,
    }


# Sondas y telescopios espaciales con efemérides VIGENTES en Horizons.
#
# Cada identificador se comprobó contra el propio Horizons el 13-nov-2026
# (misma consulta que hace este módulo: efeméride geocéntrica de ese día).
# El estado de cada misión se contrastó con fuentes oficiales (NASA, ESA,
# JAXA); ver CREDITS.md. Si Horizons deja de resolver un objeto, ese objeto
# simplemente no aparece en la respuesta: nunca la rompe.
#
# `target`: destino u objeto de estudio ("mars", "jupiter", "sun", "mercury",
# "earth", "l2", "interstellar", "kuiper_belt", "trojans", "psyche",
# "didymos" o None). `phase`: "cruise" (en ruta), "orbit" (ya en destino) o
# None. `launched`: año de lanzamiento.
SPACECRAFT = [
    _sc("-31", "Voyager 1", "el objeto humano más lejano", "the most distant human-made object",
        "interstellar", "NASA", 1977),
    _sc("-32", "Voyager 2", "único que visitó Urano y Neptuno", "only craft to visit Uranus and Neptune",
        "interstellar", "NASA", 1977),
    _sc("-98", "New Horizons", "sobrevoló Plutón (2015)", "flew by Pluto (2015)",
        "kuiper_belt", "NASA", 2006),
    _sc("-96", "Parker Solar Probe", "roza el Sol", "grazes the Sun",
        "sun", "NASA", 2018, phase="orbit"),
    _sc("-170", "James Webb (JWST)", "telescopio infrarrojo en el punto L2", "infrared telescope at L2",
        "l2", "NASA/ESA/CSA", 2021, phase="orbit"),
    _sc("-48", "Hubble (HST)", "telescopio en órbita terrestre", "telescope in Earth orbit",
        "earth", "NASA/ESA", 1990, phase="orbit"),
    _sc("-139479", "Gaia", "cartografió la Vía Láctea en 3D (2014–2025)", "mapped the Milky Way in 3D (2014–2025)",
        None, "ESA", 2013,
        "Retirado en marzo de 2025: dejó el punto L2 y quedó apagado en una órbita de retiro alrededor del Sol.",
        "Retired in March 2025: it left L2 and was switched off in a disposal orbit around the Sun."),
    _sc("-61", "Juno", "estudia Júpiter desde su órbita polar", "studies Jupiter from a polar orbit",
        "jupiter", "NASA", 2011,
        "En órbita de Júpiter desde 2016.", "In orbit around Jupiter since 2016.", "orbit"),
    _sc("-49", "Lucy", "primera misión a los asteroides troyanos de Júpiter", "first mission to Jupiter's Trojan asteroids",
        "trojans", "NASA", 2021,
        "En ruta: primer encuentro con los troyanos previsto para 2027.",
        "En route: first Trojan encounter planned for 2027.", "cruise"),
    _sc("-255", "Psyche", "viaja a un asteroide metálico", "travelling to a metal-rich asteroid",
        "psyche", "NASA", 2023,
        "En ruta: sobrevoló Marte en mayo de 2026; llegada al asteroide Psyche prevista para 2029.",
        "En route: flew by Mars in May 2026; arrival at asteroid Psyche planned for 2029.", "cruise"),
    _sc("-159", "Europa Clipper", "buscará condiciones para la vida en la luna Europa", "will look for habitable conditions at the moon Europa",
        "jupiter", "NASA", 2024,
        "En ruta a Júpiter: llegada prevista para 2030.",
        "En route to Jupiter: arrival planned for 2030.", "cruise"),
    _sc("-28", "JUICE", "explorará las lunas heladas de Júpiter", "will explore Jupiter's icy moons",
        "jupiter", "ESA", 2023,
        "En ruta a Júpiter: llegada prevista para 2031.",
        "En route to Jupiter: arrival planned for 2031.", "cruise"),
    _sc("-121", "BepiColombo", "misión europea y japonesa a Mercurio", "European-Japanese mission to Mercury",
        "mercury", "ESA/JAXA", 2018,
        "Entrada en órbita de Mercurio prevista para el 21 de noviembre de 2026.",
        "Mercury orbit insertion planned for 21 November 2026.", "cruise"),
    _sc("-91", "Hera", "estudia el asteroide que desvió la sonda DART", "studies the asteroid deflected by the DART probe",
        "didymos", "ESA", 2024,
        "Llegada al sistema Didymos–Dimorphos prevista para noviembre de 2026.",
        "Arrival at the Didymos–Dimorphos system planned for November 2026.", "cruise"),
    _sc("-144", "Solar Orbiter", "fotografía los polos del Sol", "images the Sun's poles",
        "sun", "ESA/NASA", 2020, phase="orbit"),
    # ── Rumbo a Marte en la ventana de 2026 ──
    _sc("-239", "MMX", "traerá muestras de Fobos, luna de Marte", "will return samples from Phobos, a moon of Mars",
        "mars", "JAXA", 2026,
        "En ruta a Marte: despegó el 19 de octubre de 2026 (UTC); llegada prevista para agosto de 2027.",
        "En route to Mars: launched on 19 October 2026 (UTC); arrival planned for August 2027.", "cruise"),
    _sc("-9", "ESCAPADE Blue", "una de dos sondas gemelas que estudiarán cómo Marte pierde su atmósfera",
        "one of twin probes that will study how Mars loses its atmosphere",
        "mars", "NASA", 2025,
        "En ruta a Marte tras sobrevolar la Tierra con encendido de motor (7 y 9 de noviembre de 2026, una nave cada día); llegada prevista para septiembre de 2027.",
        "En route to Mars after a powered Earth flyby (7 and 9 November 2026, one spacecraft each day); arrival planned for September 2027.", "cruise"),
    _sc("-10", "ESCAPADE Gold", "una de dos sondas gemelas que estudiarán cómo Marte pierde su atmósfera",
        "one of twin probes that will study how Mars loses its atmosphere",
        "mars", "NASA", 2025,
        "En ruta a Marte tras sobrevolar la Tierra con encendido de motor (7 y 9 de noviembre de 2026, una nave cada día); llegada prevista para septiembre de 2027.",
        "En route to Mars after a powered Earth flyby (7 and 9 November 2026, one spacecraft each day); arrival planned for September 2027.", "cruise"),
    # ── Ya en órbita de Marte ──
    _sc("-74", "Mars Reconnaissance Orbiter", "cartografía Marte en alta resolución", "maps Mars in high resolution",
        "mars", "NASA", 2005, "En órbita de Marte desde 2006.", "In orbit around Mars since 2006.", "orbit"),
    _sc("-41", "Mars Express", "primera misión europea a Marte", "Europe's first mission to Mars",
        "mars", "ESA", 2003, "En órbita de Marte desde 2003.", "In orbit around Mars since 2003.", "orbit"),
    _sc("-143", "ExoMars Trace Gas Orbiter", "rastrea gases como el metano en Marte", "tracks gases such as methane at Mars",
        "mars", "ESA/Roscosmos", 2016, "En órbita de Marte desde 2016.", "In orbit around Mars since 2016.", "orbit"),
]

# Códigos NASA Horizons para cada cuerpo (IDs del sistema SPICE)
HORIZONS_CODES = {
    "sun": "10",
    "mercury": "199",
    "venus": "299",
    "earth": "399",
    "moon": "301",
    "mars": "499",
    "jupiter": "599",
    "saturn": "699",
    "uranus": "799",
    "neptune": "899",
    "pluto": "999",
}


# ─── Acceso serializado a Horizons ────────────────────────────────────────
# JPL Horizons rechaza peticiones simultáneas desde una misma IP. Antes, el
# frontend pedía los 8 planetas a la vez y la mayoría volvía con error 502.
# Todas las consultas pasan ahora por una única cola (una a la vez) y se
# reintentan si la NASA responde "ocupado".
_horizons_lock: Optional[asyncio.Lock] = None


def _get_lock() -> asyncio.Lock:
    global _horizons_lock
    if _horizons_lock is None:
        _horizons_lock = asyncio.Lock()
    return _horizons_lock


async def _retry_pause(seconds: float) -> None:
    """Pausa entre reintentos (retroceso ante errores, como pide JPL)."""
    await asyncio.sleep(seconds)


async def _horizons_request(client: httpx.AsyncClient, params: dict):
    """GET a Horizons, de a una petición a la vez, con reintentos."""
    last_exc: Optional[Exception] = None
    for attempt in range(3):
        try:
            async with _get_lock():
                resp = await client.get(HORIZONS_URL, params=params)
            if getattr(resp, "status_code", 200) in (429, 500, 502, 503, 504):
                raise RuntimeError(f"NASA Horizons ocupado (HTTP {resp.status_code})")
            resp.raise_for_status()
            return resp
        except Exception as e:  # red, timeout o servidor ocupado
            last_exc = e
            if attempt < 2:
                await _retry_pause(0.6 * (attempt + 1))
    raise last_exc


# Caché de posiciones planetarias: (cuerpo, día) -> vector real de Horizons
_position_cache: dict = {}
_last_good_position: dict = {}
_POSITION_TTL = 6 * 3600  # 6 h
_position_status = {"ts": None, "last_error": None, "last_error_ts": None}


async def get_body_position(body: str, date: Optional[datetime] = None, timeout: float = 20.0) -> dict:
    """
    Obtiene la posición heliocéntrica real de un cuerpo en una fecha dada,
    consultando directamente a NASA Horizons.

    Devuelve coordenadas cartesianas (x, y, z) en UA, relativas al centro
    del Sol, en el plano eclíptico J2000 — el sistema de referencia
    estándar para visualización del sistema solar.

    `timeout` acota TODA la consulta (cola + reintentos): pasado ese tiempo
    se sirve el último vector real conocido (`stale`) o se lanza un error.
    """
    body = body.lower()
    if body not in HORIZONS_CODES:
        raise ValueError(f"Cuerpo desconocido: {body}")

    if date is None:
        date = datetime.utcnow()

    start = date.strftime("%Y-%m-%d")
    stop = (date + timedelta(days=1)).strftime("%Y-%m-%d")

    # Caché: Horizons se consulta con resolución de 1 día, así que la misma
    # (cuerpo, día) siempre da el mismo vector. Evita límites de tasa de la
    # NASA y hace que la app responda al instante en usos repetidos.
    key = (body, start)
    now = time.monotonic()
    hit = _position_cache.get(key)
    if hit and now - hit["ts"] < _POSITION_TTL:
        return {**hit["data"], "date": date.isoformat()}

    params = {
        "format": "json",
        "COMMAND": f"'{HORIZONS_CODES[body]}'",
        "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "VECTORS",
        "CENTER": "'500@10'",  # Centro: Sol (heliocéntrico)
        "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": "'1 d'",
        "VEC_TABLE": "'1'",  # Posición XYZ solamente
        "OUT_UNITS": "'AU-D'",
        "REF_PLANE": "'ECLIPTIC'",
    }

    async def _query() -> dict:
        async with httpx.AsyncClient(timeout=12.0, headers=provider_headers()) as client:
            resp = await _horizons_request(client, params)
            data = resp.json()
        return _parse_vector_block(data.get("result", ""))

    try:
        if timeout <= 0:
            raise asyncio.TimeoutError()
        position = await asyncio.wait_for(_query(), timeout=timeout)
    except Exception as e:
        if isinstance(e, asyncio.TimeoutError):
            e = RuntimeError("NASA Horizons no respondió a tiempo")
        _position_status["last_error"] = str(e) or type(e).__name__
        _position_status["last_error_ts"] = time.time()
        # Si la NASA no responde, devolvemos el último vector real conocido
        # de ese cuerpo, marcado claramente como dato no actualizado.
        last = _last_good_position.get(body)
        if last is not None:
            return {**last, "date": date.isoformat(), "stale": True}
        raise e

    position["body"] = body
    position["source"] = "NASA JPL Horizons"
    position["data_date"] = start
    if len(_position_cache) > 2000:
        _position_cache.clear()
    _position_cache[key] = {"ts": now, "data": position}
    _last_good_position[body] = position
    _position_status["ts"] = time.time()
    return {**position, "date": date.isoformat()}


def _parse_vector_block(text: str) -> dict:
    """
    Extrae el primer vector de posición (X, Y, Z) del bloque de texto que
    devuelve Horizons entre las marcas $$SOE y $$EOE.
    """
    if "$$SOE" not in text or "$$EOE" not in text:
        raise RuntimeError("NASA Horizons no devolvió datos de vector esperados")

    block = text.split("$$SOE")[1].split("$$EOE")[0].strip()
    lines = [l for l in block.splitlines() if l.strip()]

    x = y = z = None
    for line in lines:
        line = line.strip()
        if line.startswith("X ="):
            parts = line.replace("X =", "").replace("Y =", "|").replace("Z =", "|").split("|")
            x = float(parts[0].strip())
            y = float(parts[1].strip())
            z = float(parts[2].strip())
            break

    if x is None:
        raise RuntimeError("No se pudo parsear el vector de posición de Horizons")

    distance_au = (x**2 + y**2 + z**2) ** 0.5

    return {
        "x_au": round(x, 6),
        "y_au": round(y, 6),
        "z_au": round(z, 6),
        "distance_from_sun_au": round(distance_au, 6),
    }


def _radec_to_vec(ra_deg: float, dec_deg: float):
    """RA/Dec (grados J2000) -> vector unitario ecuatorial (misma convención
    que el resto de capas del frontend)."""
    ra, dec = math.radians(ra_deg), math.radians(dec_deg)
    cd = math.cos(dec)
    return round(cd * math.cos(ra), 5), round(cd * math.sin(ra), 5), round(math.sin(dec), 5)


def _parse_observer_row(text: str) -> Optional[dict]:
    """Primera fila de una efeméride de observador de Horizons pedida con
    QUANTITIES='1,19,20' (RA, Dec, r, rdot, delta, deldot). También acepta
    la forma antigua '1,20' (RA, Dec, delta, deldot), sin distancia al Sol."""
    if "$$SOE" not in text:
        return None
    row = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()[0]
    after = row.split(None, 2)[2]  # quita "YYYY-Mon-DD HH:MN"
    nums = [float(n) for n in re.findall(r"[-+]?\d+\.\d+", after)]
    if len(nums) < 3:
        return None
    ra, dec = nums[0], nums[1]
    if len(nums) >= 5:        # RA, Dec, r, rdot, delta[, deldot]
        sun_au, delta = nums[2], nums[4]
        deldot = nums[5] if len(nums) > 5 else None
    else:                     # RA, Dec, delta[, deldot]
        sun_au, delta = None, nums[2]
        deldot = nums[3] if len(nums) > 3 else None
    nx, ny, nz = _radec_to_vec(ra, dec)
    out = {
        "ra_deg": round(ra, 4), "dec_deg": round(dec, 4),
        "nx": nx, "ny": ny, "nz": nz,
        "dist_au": round(delta, 4),
        "dist_km": round(delta * AU_KM),
        "light_min": round(delta * AU_KM / LIGHT_MINUTE_KM, 1),  # min-luz
        "approaching": (deldot is not None and deldot < 0),
    }
    if sun_au is not None:  # distancia real al Sol (opcional)
        out["sun_dist_au"] = round(sun_au, 4)
        out["sun_dist_km"] = round(sun_au * AU_KM)
    return out


async def _comet_ephem(client: httpx.AsyncClient, command: str, date: datetime) -> Optional[dict]:
    """Posición aparente geocéntrica (RA/Dec), distancia a la Tierra y al Sol
    de un cometa o nave en `date`, desde NASA Horizons. Devuelve None si no
    se puede leer (objeto que Horizons no resuelve, sin efeméride, red...)."""
    # Instante exacto (al minuto): una nave recién lanzada se aleja de la
    # Tierra cientos de miles de km al día, así que no vale "a medianoche".
    start = date.strftime("%Y-%m-%d %H:%M")
    stop = (date + timedelta(days=1)).strftime("%Y-%m-%d %H:%M")
    params = {
        "format": "json", "COMMAND": f"'{command}'", "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES", "EPHEM_TYPE": "OBSERVER", "CENTER": "'500@399'",
        "START_TIME": f"'{start}'", "STOP_TIME": f"'{stop}'", "STEP_SIZE": "'1 d'",
        "QUANTITIES": "'1,19,20'", "ANG_FORMAT": "'DEG'",
    }
    try:
        resp = await _horizons_request(client, params)
        return _parse_observer_row(resp.json().get("result", ""))
    except Exception:
        return None


class _ObjectSet:
    """Conjunto de objetos de Horizons (cometas o naves) consultados uno a
    uno, con caché POR OBJETO y por tramo de 6 horas (cada dato corresponde
    al instante real de la consulta, que se devuelve en `epoch`).

      * La consulta completa corre en segundo plano (vuelo único); quien
        llama espera como mucho `budget` segundos y recibe lo que haya.
        Lo que falte se lista como `pending` y estará en la siguiente
        petición: el endpoint nunca se queda colgado.
      * Un objeto que falla hoy se sirve con su último dato válido, marcado
        `stale: true` y con `data_date`; si nunca se pudo leer, se omite.
        Un objeto que Horizons no resuelve jamás rompe la respuesta.
      * Un objeto fallido no se reintenta hasta pasados `retry_after` s.
    """

    def __init__(self, name: str, items: list, extra_keys: tuple = (),
                 budget: float = 18.0, retry_after: float = 1800.0):
        self.name = name
        self.items = items
        self.extra_keys = extra_keys
        self.budget = budget
        self.retry_after = retry_after
        self.store: dict = {}    # nombre -> {"day" (tramo), "date", "ts", "data"}
        self.failed: dict = {}   # nombre -> (tramo, time.monotonic())
        self._task: Optional[asyncio.Task] = None
        self._task_day: Optional[str] = None

    def reset(self) -> None:
        self.store.clear()
        self.failed.clear()
        self._task = None
        self._task_day = None

    def _todo(self, day: str) -> list:
        now = time.monotonic()
        todo = []
        for it in self.items:
            hit = self.store.get(it["name"])
            if hit and hit["day"] == day:
                continue
            f = self.failed.get(it["name"])
            if f and f[0] == day and now - f[1] < self.retry_after:
                continue
            todo.append(it)
        return todo

    async def _fill(self, day: str, date: datetime, todo: list) -> None:
        async with httpx.AsyncClient(timeout=12.0, headers=provider_headers()) as client:
            for it in todo:
                e = await _comet_ephem(client, it["command"], date)
                if e:
                    e["epoch"] = date.strftime("%Y-%m-%dT%H:%MZ")
                    self.store[it["name"]] = {
                        "day": day, "date": date.strftime("%Y-%m-%d"),
                        "ts": time.time(), "data": e,
                    }
                    self.failed.pop(it["name"], None)
                else:
                    self.failed[it["name"]] = (day, time.monotonic())

    def _live_task(self, day: str) -> Optional[asyncio.Task]:
        t = self._task
        if t is None or t.done() or self._task_day != day:
            return None
        try:
            if t.get_loop() is not asyncio.get_running_loop():
                return None
        except RuntimeError:
            return None
        return t

    async def snapshot(self, date: Optional[datetime] = None) -> dict:
        if date is None:
            date = datetime.utcnow()
        date_str = date.strftime("%Y-%m-%d")
        # Tramo de caché: 4 por día (00, 06, 12 y 18 h UTC).
        day = f"{date_str}T{(date.hour // 6) * 6:02d}"

        todo = self._todo(day)
        if todo:
            task = self._live_task(day)
            if task is None:
                task = asyncio.get_running_loop().create_task(self._fill(day, date, todo))
                task.add_done_callback(lambda t: t.cancelled() or t.exception())
                self._task, self._task_day = task, day
            # Si ya hay un dato (del tramo anterior) para todos, se espera
            # menos: lo que no llegue a tiempo se sirve marcado `stale` y se
            # termina de refrescar en segundo plano.
            have_all = all(it["name"] in self.store for it in self.items)
            await asyncio.wait({task}, timeout=8.0 if have_all else self.budget)

        objects, stale, pending = [], False, 0
        still_todo = {it["name"] for it in self._todo(day)}
        for it in self.items:
            hit = self.store.get(it["name"])
            if hit is None:
                if it["name"] in still_todo:
                    pending += 1
                continue
            obj = dict(hit["data"])
            obj["name"] = it["name"]
            for k in self.extra_keys:
                if it.get(k) is not None or k in ("target",):
                    obj[k] = it.get(k)
            if hit["day"] != day:
                obj["stale"] = True
                obj["data_date"] = hit["date"]
                stale = True
                if it["name"] in still_todo:
                    pending += 1
            objects.append(obj)

        result = {
            "objects": objects,
            "count": len(objects),
            "date": date_str,
            "source": "NASA JPL Horizons (posición geocéntrica aparente, en vivo)",
            "stale": stale,
        }
        if pending:
            result["pending"] = pending  # aún cargando en segundo plano
        return result

    def status(self) -> dict:
        ts = [h["ts"] for h in self.store.values()]
        newest = max(ts) if ts else None
        return {
            "has_data": bool(ts),
            "age_s": None if newest is None else round(max(0.0, time.time() - newest)),
            "updated": iso_utc(newest),
            "objects_total": len(self.items),
            "objects_cached": len(self.store),
            "objects_failed": sorted(self.failed.keys()),
        }


_comet_set = _ObjectSet(
    "comets", [{"command": c, "name": n} for c, n in NOTABLE_COMETS]
)
_probe_set = _ObjectSet(
    "probes", SPACECRAFT,
    extra_keys=("note_es", "note_en", "target", "agency", "launched",
                "status_note", "status_note_en", "phase"),
)


async def get_comet_positions(date: Optional[datetime] = None) -> dict:
    """Posiciones reales actuales de cometas notables (NASA Horizons),
    con caché por objeto (tramos de 6 h)."""
    return await _comet_set.snapshot(date)


async def get_spacecraft_positions(date: Optional[datetime] = None) -> dict:
    """Posiciones reales actuales de sondas y telescopios (NASA Horizons),
    con caché por objeto (tramos de 6 h). Cada objeto añade, cuando procede, los
    campos opcionales target, agency, launched, status_note(_en) y phase."""
    return await _probe_set.snapshot(date)


def positions_status() -> dict:
    """Estado de la caché de posiciones planetarias (para /api/health)."""
    ts = _position_status["ts"]
    return {
        "has_data": bool(_last_good_position),
        "age_s": None if ts is None else round(max(0.0, time.time() - ts)),
        "updated": iso_utc(ts),
        "bodies_cached": sorted(_last_good_position.keys()),
        "last_error": _position_status["last_error"],
        "last_error_at": iso_utc(_position_status["last_error_ts"]),
    }


async def get_distance_between_bodies(body_a: str, body_b: str, date: Optional[datetime] = None) -> dict:
    """
    Calcula la distancia real entre dos cuerpos en una fecha dada,
    usando sus posiciones heliocéntricas reales de NASA Horizons.
    """
    pos_a, pos_b = await asyncio.gather(
        get_body_position(body_a, date), get_body_position(body_b, date)
    )

    dx = pos_a["x_au"] - pos_b["x_au"]
    dy = pos_a["y_au"] - pos_b["y_au"]
    dz = pos_a["z_au"] - pos_b["z_au"]
    distance_au = (dx**2 + dy**2 + dz**2) ** 0.5

    return {
        "body_a": body_a,
        "body_b": body_b,
        "date": (date or datetime.utcnow()).isoformat(),
        "distance_au": round(distance_au, 6),
        "distance_km": round(distance_au * AU_KM, 0),
        "position_a": pos_a,
        "position_b": pos_b,
        "source": "NASA JPL Horizons (real-time vectors)",
    }
