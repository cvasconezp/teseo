"""
nasa_horizons.py — Cliente para la API pública de NASA JPL Horizons

Consulta posiciones reales de cuerpos del sistema solar en cualquier fecha.
API gratuita, sin autenticación, mantenida por NASA/JPL.
Documentación: https://ssd-api.jpl.nasa.gov/doc/horizons.html
"""

import math
import re
from datetime import datetime, timedelta
from typing import Optional

import asyncio
import time

import httpx

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
_comet_cache = {"date": None, "data": None}

# Sondas y telescopios espaciales activos con efemérides en Horizons.
# (command, nombre, nota_es, nota_en)
SPACECRAFT = [
    ("-31",  "Voyager 1", "el objeto humano más lejano", "the most distant human-made object"),
    ("-32",  "Voyager 2", "único que visitó Urano y Neptuno", "only craft to visit Uranus and Neptune"),
    ("-98",  "New Horizons", "sobrevoló Plutón (2015)", "flew by Pluto (2015)"),
    ("-96",  "Parker Solar Probe", "roza el Sol", "grazes the Sun"),
    ("-170", "James Webb (JWST)", "telescopio infrarrojo en el punto L2", "infrared telescope at L2"),
    ("-48",  "Hubble (HST)", "telescopio en órbita terrestre", "telescope in Earth orbit"),
    ("Gaia", "Gaia", "cartografía 3D de la Vía Láctea (L2)", "3D map of the Milky Way (L2)"),
]
_probe_cache = {"date": None, "data": None}

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
                await asyncio.sleep(0.6 * (attempt + 1))
    raise last_exc


# Caché de posiciones planetarias: (cuerpo, día) -> vector real de Horizons
_position_cache: dict = {}
_last_good_position: dict = {}
_POSITION_TTL = 6 * 3600  # 6 h


async def get_body_position(body: str, date: Optional[datetime] = None) -> dict:
    """
    Obtiene la posición heliocéntrica real de un cuerpo en una fecha dada,
    consultando directamente a NASA Horizons.

    Devuelve coordenadas cartesianas (x, y, z) en UA, relativas al centro
    del Sol, en el plano eclíptico J2000 — el sistema de referencia
    estándar para visualización del sistema solar.
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

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await _horizons_request(client, params)
            data = resp.json()
        position = _parse_vector_block(data.get("result", ""))
    except Exception:
        # Si la NASA no responde, devolvemos el último vector real conocido
        # de ese cuerpo, marcado claramente como dato no actualizado.
        last = _last_good_position.get(body)
        if last is not None:
            return {**last, "date": date.isoformat(), "stale": True}
        raise

    position["body"] = body
    position["source"] = "NASA JPL Horizons"
    position["data_date"] = start
    if len(_position_cache) > 2000:
        _position_cache.clear()
    _position_cache[key] = {"ts": now, "data": position}
    _last_good_position[body] = position
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


async def _comet_ephem(client: httpx.AsyncClient, command: str, date: datetime) -> Optional[dict]:
    """Posición aparente geocéntrica (RA/Dec) y distancia a la Tierra de un
    cometa en `date`, desde NASA Horizons. Devuelve None si no se puede leer."""
    start = date.strftime("%Y-%m-%d")
    stop = (date + timedelta(days=1)).strftime("%Y-%m-%d")
    params = {
        "format": "json", "COMMAND": f"'{command}'", "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES", "EPHEM_TYPE": "OBSERVER", "CENTER": "'500@399'",
        "START_TIME": f"'{start}'", "STOP_TIME": f"'{stop}'", "STEP_SIZE": "'1 d'",
        "QUANTITIES": "'1,20'", "ANG_FORMAT": "'DEG'",
    }
    try:
        resp = await _horizons_request(client, params)
        text = resp.json().get("result", "")
        if "$$SOE" not in text:
            return None
        row = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()[0]
        # tras la fecha/hora, los primeros números son RA, Dec, delta(UA), deldot
        after = row.split(None, 2)[2]  # quita "YYYY-Mon-DD HH:MN"
        nums = re.findall(r"[-+]?\d+\.\d+", after)
        if len(nums) < 3:
            return None
        ra, dec, delta = float(nums[0]), float(nums[1]), float(nums[2])
        deldot = float(nums[3]) if len(nums) > 3 else None
        nx, ny, nz = _radec_to_vec(ra, dec)
        return {
            "ra_deg": round(ra, 4), "dec_deg": round(dec, 4),
            "nx": nx, "ny": ny, "nz": nz,
            "dist_au": round(delta, 4),
            "dist_km": round(delta * AU_KM),
            "light_min": round(delta * AU_KM / 17_987_547.48, 1),  # min-luz
            "approaching": (deldot is not None and deldot < 0),
        }
    except Exception:
        return None


async def get_comet_positions(date: Optional[datetime] = None) -> dict:
    """Posiciones reales actuales de cometas notables (NASA Horizons),
    con caché diaria en memoria para no repetir consultas."""
    if date is None:
        date = datetime.utcnow()
    day = date.strftime("%Y-%m-%d")
    if _comet_cache["date"] == day and _comet_cache["data"] is not None:
        return _comet_cache["data"]

    objects = []
    async with httpx.AsyncClient(timeout=25.0) as client:
        for command, name in NOTABLE_COMETS:
            e = await _comet_ephem(client, command, date)
            if e:
                e["name"] = name
                objects.append(e)

    result = {
        "objects": objects,
        "count": len(objects),
        "date": day,
        "source": "NASA JPL Horizons (posición geocéntrica aparente, en vivo)",
    }
    if objects:  # solo cacheamos si algo salió bien
        _comet_cache["date"] = day
        _comet_cache["data"] = result
    return result


async def get_spacecraft_positions(date: Optional[datetime] = None) -> dict:
    """Posiciones reales actuales de sondas y telescopios (NASA Horizons),
    con caché diaria en memoria."""
    if date is None:
        date = datetime.utcnow()
    day = date.strftime("%Y-%m-%d")
    if _probe_cache["date"] == day and _probe_cache["data"] is not None:
        return _probe_cache["data"]

    objects = []
    async with httpx.AsyncClient(timeout=25.0) as client:
        for command, name, note_es, note_en in SPACECRAFT:
            e = await _comet_ephem(client, command, date)
            if e:
                e["name"] = name
                e["note_es"] = note_es
                e["note_en"] = note_en
                objects.append(e)

    result = {
        "objects": objects,
        "count": len(objects),
        "date": day,
        "source": "NASA JPL Horizons (posición geocéntrica aparente, en vivo)",
    }
    if objects:
        _probe_cache["date"] = day
        _probe_cache["data"] = result
    return result


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

    AU_KM = 149_597_870.7

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
