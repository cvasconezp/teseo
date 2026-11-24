"""
sun.py — «El Sol hoy»: manchas solares y actividad solar con datos reales.

Sin IA y sin cálculo propio más allá de ordenar, filtrar y comparar clases:
cada dato sale de su fuente y viaja con su fuente y su hora.

Fuentes (formatos verificados el 16-nov-2026):

  1. Número de manchas de hoy — SILSO, Real Observatorio de Bélgica (WDC-SILSO).
       GET https://www.sidc.be/SILSO/DATA/EISN/EISN_current.csv
     CSV sin cabecera: año, mes, día, fecha decimal, número de manchas estimado
     (EISN, provisional), desviación, estaciones usadas, estaciones disponibles.
     Ej.: «2026, 11, 16, 2026.875,  98,   5.7,   7,   9,». -1 = sin dato.
  2. Regiones activas — NOAA SWPC.
       GET https://services.swpc.noaa.gov/json/solar_regions.json
     Lista con varios días (orden descendente por fecha): se usa el día más
     reciente. `area` en millonésimas del hemisferio solar visible; las
     regiones recién salidas o ya en el limbo traen area/spot_class nulos.
  3. Ciclo solar mensual — NOAA SWPC (manchas mensuales de SILSO v2 y media
     suavizada de 13 meses; -1 = aún sin dato) y su predicción oficial:
       GET https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json
       GET https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json
  4. Fulguraciones de rayos X (GOES primario, últimos 7 días, orden
     cronológico ascendente):
       GET https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json
     Esta fuente NO dice de qué región vino cada fulguración: `region` es null.
  5. Índice Kp planetario (cada 3 h, el último valor):
       GET https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json
     Lista de objetos {time_tag (UTC), Kp, a_running, station_count}.
  6. Imagen: intensitigrama de HMI a bordo de SDO (NASA), siempre «latest».
       https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIF.jpg
     La hora de la imagen es la cabecera Last-Modified de una petición HEAD;
     si no llega, la hora va a null (no se inventa).

  7. Imagen H-alfa (656,28 nm): red GONG del NSO (NSF), seis observatorios
     (Big Bear, Cerro Tololo, Learmonth, Mauna Loa, El Teide, Udaipur), una imagen
     por minuto en cada uno. La última imagen de cada sitio se pide al servicio
     liviano de su página de vista rápida (≈ 500 bytes por sitio):
       GET https://gong2.nso.edu/products/tableView/getImageDetails.php?…&latestFile=hAlpha_<L>.dat…
     y se elige la más reciente. Si ese servicio no responde, se lee el listado
     del día (UTC) en https://gong2.nso.edu/HA/hag/AAAAMM/AAAAMMDD/ y, si aún no
     hay imágenes, el del día anterior. Solo se aceptan nombres AAAAMMDDhhmmss<L>h.jpg
     con L = B, C, L, M, T o U: según el NSO, el resto de letras son pruebas, no
     datos científicos (https://nso.edu/data/nisp-data/h-alpha/). Comprobado el
     24-nov-2026. La hora sale del nombre del archivo (hora de observación, UTC).
     Crédito según la política de uso de imágenes del NSO: GONG/NSO/AURA/NSF.

Cada fuente es un `Resource` independiente (caché de 1 h, pausa tras fallo,
`stale` si cae tras un éxito): si una falla, el resto se sirve igual y esa
sección va a null con su motivo en `errors`.
"""

import asyncio
import csv
import io
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Response

from app.cache import ProviderError, Resource, iso_utc, provider_headers

SILSO_URL = "https://www.sidc.be/SILSO/DATA/EISN/EISN_current.csv"
REGIONS_URL = "https://services.swpc.noaa.gov/json/solar_regions.json"
OBSERVED_URL = "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json"
PREDICTED_URL = "https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json"
FLARES_URL = "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json"
KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
IMAGE_URL = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIF.jpg"

GONG_BASE = "https://gong2.nso.edu"
GONG_DETAILS_URL = (GONG_BASE + "/products/tableView/getImageDetails.php?index=0&latestFile=hAlpha_{site}.dat"
                    "&hr=12&mn=10&sc=8&dataSub=hav%7Chaf,jpg%7Cfits.fz&zoomSub=hav%7Chag")
GONG_DAY_URL = GONG_BASE + "/HA/hag/{ym}/{ymd}/"
GONG_SITES = ("B", "C", "L", "M", "T", "U")     # sitios científicos; el resto de letras son pruebas
GONG_CREDIT = "GONG/NSO/AURA/NSF"
_GONG_RE = re.compile(r"(\d{14})([BCLMTU])h\.jpg")
_GONG_PATH_RE = re.compile(r"^/HA/hag/(\d{6})/(\d{8})/(\d{14})([BCLMTU])h\.jpg$")
_HALPHA_TTL = 10 * 60   # la red da una imagen cada 20 s; con 10 min basta y no se carga al NSO

SILSO_SOURCE = "SILSO, Real Observatorio de Bélgica"
SWPC_SOURCE = "NOAA SWPC"
SDO_CREDIT = "NASA/SDO y equipo científico HMI"

# Enlaces a la página de cada fuente (para citarla en la app).
PAGES = {
    "silso": "https://www.sidc.be/SILSO/",
    "swpc": "https://www.swpc.noaa.gov/",
    "sdo": "https://sdo.gsfc.nasa.gov/",
    "gong": "https://nso.edu/data/nisp-data/h-alpha/",
}

_TTL = 60 * 60          # 1 h
_RETRY_AFTER = 5 * 60   # tras un fallo, 5 min sin insistir
_TIMEOUT = 20.0
CYCLE_START = "2008-12"  # inicio del ciclo 24: la gráfica abarca los ciclos 24 y 25

router = APIRouter(prefix="/api/sun", tags=["sun"])


# ─── Utilidades ───────────────────────────────────────────────────────────
def _num(v) -> Optional[float]:
    """Número finito o None. El -1 que usan las fuentes como «sin dato» NO se filtra
    aquí (cada fuente decide si -1 significa vacío)."""
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x and abs(x) != float("inf") else None


def _valid(v) -> Optional[float]:
    """Como _num, pero trata los negativos (-1 = sin dato) como ausentes."""
    x = _num(v)
    return None if x is None or x < 0 else x


def _str(v) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _iso_z(s: Optional[str]) -> Optional[str]:
    """'2026-11-16T09:00:00' (UTC sin zona) o con 'Z' -> '2026-11-16T09:00:00Z'."""
    s = _str(s)
    if not s:
        return None
    s = s.rstrip("Z")
    try:
        d = datetime.fromisoformat(s)
    except ValueError:
        return None
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


_CLASS_ORDER = {"A": 0, "B": 1, "C": 2, "M": 3, "X": 4}


def flare_rank(cls: Optional[str]):
    """Orden de una clase de fulguración ('C1.8', 'M1.1', 'X2.0'): letra y luego número.
    None si no es una clase válida."""
    s = (cls or "").strip().upper()
    if len(s) < 2 or s[0] not in _CLASS_ORDER:
        return None
    try:
        return (_CLASS_ORDER[s[0]], float(s[1:]))
    except ValueError:
        return None


async def _get_json(url: str):
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(url, headers={"Accept": "application/json", **provider_headers()})
    status = getattr(resp, "status_code", 200)
    if status >= 400:
        raise RuntimeError(f"{url.split('/')[2]} respondió HTTP {status}")
    return resp.json()


# ─── Descargas y normalización (una por fuente) ───────────────────────────
def parse_silso(text: str) -> dict:
    """Último día con dato del CSV EISN. Lanza ValueError si no hay ninguno."""
    best = None
    for row in csv.reader(io.StringIO(text or "")):
        cells = [c.strip() for c in row]
        if len(cells) < 6:
            continue
        try:
            y, m, d = int(cells[0]), int(cells[1]), int(cells[2])
            date = datetime(y, m, d)
        except ValueError:
            continue
        value = _valid(cells[4])
        if value is None:           # -1: sin dato ese día
            continue
        best = (date, value, _valid(cells[5]), cells)
    if best is None:
        raise ValueError("el CSV de SILSO no trae ningún día con dato")
    date, value, stdev, cells = best
    used = int(cells[6]) if len(cells) > 6 and cells[6].lstrip("-").isdigit() else None
    avail = int(cells[7]) if len(cells) > 7 and cells[7].lstrip("-").isdigit() else None
    return {
        "value": int(round(value)),
        "date": date.strftime("%Y-%m-%d"),
        "stdev": stdev,
        "stations_used": used,
        "stations_available": avail,
    }


async def _fetch_silso() -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(SILSO_URL, headers=provider_headers())
    status = getattr(resp, "status_code", 200)
    if status >= 400:
        raise RuntimeError(f"SILSO respondió HTTP {status}")
    return parse_silso(resp.text)


def normalize_regions(raw) -> dict:
    """Regiones del día más reciente de solar_regions.json."""
    if not isinstance(raw, list) or not raw:
        raise ValueError("NOAA SWPC devolvió una lista de regiones vacía o inesperada")
    rows = [r for r in raw if isinstance(r, dict) and _str(r.get("observed_date"))]
    if not rows:
        raise ValueError("NOAA SWPC devolvió regiones sin fecha")
    day = max(_str(r["observed_date"]) for r in rows)
    out = []
    for r in rows:
        if _str(r["observed_date"]) != day:
            continue
        num = r.get("region")
        if not isinstance(num, int) or isinstance(num, bool):
            continue
        area = _valid(r.get("area"))
        spots = _valid(r.get("number_spots"))
        out.append({
            "region": num,
            "location": _str(r.get("location")),
            "area": None if area is None else int(round(area)),
            "spots": None if spots is None else int(round(spots)),
            "mag_class": _str(r.get("mag_class")),
            "spot_class": _str(r.get("spot_class")),
            "flare_prob": {
                "c": _valid(r.get("c_flare_probability")),
                "m": _valid(r.get("m_flare_probability")),
                "x": _valid(r.get("x_flare_probability")),
            },
        })
    # Mayores primero; las que no tienen área medida, al final.
    out.sort(key=lambda x: (x["area"] is None, -(x["area"] or 0), x["region"]))
    return {"date": day[:10], "regions": out}


async def _fetch_regions() -> dict:
    return normalize_regions(await _get_json(REGIONS_URL))


def normalize_flares(raw) -> list:
    """Fulguraciones de 7 días -> [{class, peak_time, region}], la más reciente primero."""
    if not isinstance(raw, list):
        raise ValueError("NOAA SWPC devolvió fulguraciones en un formato inesperado")
    out = []
    for f in raw:
        if not isinstance(f, dict):
            continue
        cls, peak = _str(f.get("max_class")), _iso_z(f.get("max_time"))
        if flare_rank(cls) is None or not peak:
            continue
        # Esta fuente no informa la región de origen: se deja en null, no se adivina.
        out.append({"class": cls.upper(), "peak_time": peak, "region": None})
    out.sort(key=lambda x: x["peak_time"], reverse=True)
    return out


async def _fetch_flares() -> list:
    return normalize_flares(await _get_json(FLARES_URL))


def strongest_since(flares: list, now: datetime, hours: float = 24.0) -> Optional[dict]:
    """La fulguración de mayor clase con pico en las últimas `hours` horas (o None)."""
    limit = (now - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    top = None
    for f in flares:
        if f["peak_time"] < limit:
            continue
        if top is None or flare_rank(f["class"]) > flare_rank(top["class"]):
            top = f
    return dict(top) if top else None


def normalize_kp(raw) -> dict:
    """Último valor del índice Kp planetario: {value, time}."""
    if not isinstance(raw, list):
        raise ValueError("NOAA SWPC devolvió el índice Kp en un formato inesperado")
    last = None
    for r in raw:
        if not isinstance(r, dict):
            continue
        kp, t = _valid(r.get("Kp")), _iso_z(r.get("time_tag"))
        if kp is None or not t or kp > 9:
            continue
        if last is None or t > last["time"]:
            last = {"value": kp, "time": t}
    if last is None:
        raise ValueError("el índice Kp no trae ningún valor")
    return last


async def _fetch_kp() -> dict:
    return normalize_kp(await _get_json(KP_URL))


def normalize_observed(raw, start: str = CYCLE_START) -> list:
    """Manchas mensuales (SILSO v2 vía NOAA) desde `start` -> [{t, ssn, smoothed}]."""
    if not isinstance(raw, list):
        raise ValueError("NOAA SWPC devolvió el ciclo solar en un formato inesperado")
    out = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        t = _str(r.get("time-tag"))
        if not t or t < start:
            continue
        ssn = _valid(r.get("ssn"))
        if ssn is None:
            continue
        out.append({"t": t, "ssn": ssn, "smoothed": _valid(r.get("smoothed_ssn"))})
    out.sort(key=lambda x: x["t"])
    if not out:
        raise ValueError("el ciclo solar observado no trae meses")
    return out


async def _fetch_observed() -> list:
    return normalize_observed(await _get_json(OBSERVED_URL))


def normalize_predicted(raw) -> list:
    """Predicción oficial del ciclo -> [{t, ssn, low, high}] (mediana y banda baja/alta)."""
    if not isinstance(raw, list):
        raise ValueError("NOAA SWPC devolvió la predicción en un formato inesperado")
    out = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        t, ssn = _str(r.get("time-tag")), _valid(r.get("predicted_ssn"))
        if not t or ssn is None:
            continue
        out.append({"t": t, "ssn": ssn, "low": _valid(r.get("low_ssn")), "high": _valid(r.get("high_ssn"))})
    out.sort(key=lambda x: x["t"])
    if not out:
        raise ValueError("la predicción del ciclo no trae meses")
    return out


async def _fetch_predicted() -> list:
    return normalize_predicted(await _get_json(PREDICTED_URL))


async def _fetch_image() -> dict:
    """Hora real de la imagen: Last-Modified de SDO. Si no llega, time=None."""
    async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
        resp = await client.head(IMAGE_URL, headers=provider_headers())
    status = getattr(resp, "status_code", 200)
    if status >= 400:
        raise RuntimeError(f"SDO respondió HTTP {status}")
    lm = (getattr(resp, "headers", None) or {}).get("last-modified")
    t = None
    if lm:
        try:
            t = parsedate_to_datetime(lm).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except (TypeError, ValueError):
            t = None
    return {"time": t}


# ─── H-alfa (GONG) ────────────────────────────────────────────────────────
def gong_image(stamp: str, site: str) -> dict:
    """De '20261124163742' y 'C' a la imagen grande (2048 px), la mediana (512 px) y su hora UTC."""
    ym, ymd = stamp[:6], stamp[:8]
    name = f"{stamp}{site}h.jpg"
    t = datetime.strptime(stamp, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    return {
        "url": f"{GONG_BASE}/HA/hag/{ym}/{ymd}/{name}",
        "url_small": f"{GONG_BASE}/HA/hav/{ym}/{ymd}/{name}",
        "time": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "site": site,
    }


def parse_gong_details(xml: str) -> Optional[dict]:
    """Respuesta XML de getImageDetails.php -> imagen, o None si no trae una ruta válida.
    La ruta se valida con una expresión estricta: nunca se reenvía una URL arbitraria."""
    if not isinstance(xml, str) or "<ok>1</ok>" not in xml:
        return None
    m = re.search(r"<zoomFile>\s*([^<\s]+)\s*</zoomFile>", xml)
    if not m:
        return None
    pm = _GONG_PATH_RE.match(m.group(1))
    if not pm or pm.group(3)[:6] != pm.group(1) or pm.group(3)[:8] != pm.group(2):
        return None
    return gong_image(pm.group(3), pm.group(4))


def parse_gong_listing(html: str) -> Optional[dict]:
    """Listado de un día -> la imagen científica más reciente (o None)."""
    found = _GONG_RE.findall(html or "")
    if not found:
        return None
    stamp, site = max(found)
    return gong_image(stamp, site)


async def _fetch_halpha(now: Optional[datetime] = None) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        async def one(site):
            try:
                r = await client.get(GONG_DETAILS_URL.format(site=site), headers=provider_headers())
                if getattr(r, "status_code", 200) >= 400:
                    return None
                return parse_gong_details(r.text)
            except Exception:   # un sitio caído no tumba a los demás
                return None
        imgs = [i for i in await asyncio.gather(*(one(s) for s in GONG_SITES)) if i]
        if imgs:
            return max(imgs, key=lambda i: i["time"])
        # plan B: el listado del día (y del anterior, a primera hora UTC)
        now = now or datetime.now(timezone.utc)
        for d in (now, now - timedelta(days=1)):
            url = GONG_DAY_URL.format(ym=d.strftime("%Y%m"), ymd=d.strftime("%Y%m%d"))
            r = await client.get(url, headers=provider_headers())
            if getattr(r, "status_code", 200) >= 400:
                continue
            img = parse_gong_listing(r.text)
            if img:
                return img
    raise RuntimeError("GONG no tiene imágenes H-alfa recientes")


_KW = dict(ttl=_TTL, wait=20.0, retry_after=_RETRY_AFTER)
silso = Resource("sun_silso", _fetch_silso, **_KW)
regions = Resource("sun_regions", _fetch_regions, **_KW)
flares = Resource("sun_flares", _fetch_flares, **_KW)
kp = Resource("sun_kp", _fetch_kp, **_KW)
observed = Resource("sun_cycle_observed", _fetch_observed, **_KW)
predicted = Resource("sun_cycle_predicted", _fetch_predicted, **_KW)
image = Resource("sun_image", _fetch_image, **_KW)
halpha = Resource("sun_halpha", _fetch_halpha, ttl=_HALPHA_TTL, wait=20.0, retry_after=_RETRY_AFTER)
RESOURCES = {"silso": silso, "regions": regions, "flares": flares, "kp": kp,
             "observed": observed, "predicted": predicted, "image": image, "halpha": halpha}


def status() -> dict:
    return {k: r.status() for k, r in RESOURCES.items()}


async def _safe(resource: Resource):
    """(dato, stale, error): nunca lanza."""
    try:
        data, stale = await resource.get()
        return data, stale, None
    except ProviderError as e:
        return None, False, str(e) or "proveedor no disponible"
    except Exception as e:  # defensivo: una fuente nunca tumba la respuesta
        return None, False, f"{type(e).__name__}: {e}"


async def build_today(now: Optional[datetime] = None) -> dict:
    now = now or datetime.now(timezone.utc)
    keys = list(RESOURCES)
    results = dict(zip(keys, await asyncio.gather(*(_safe(RESOURCES[k]) for k in keys))))
    errors, stale = {}, []

    def take(key):
        data, st, err = results[key]
        if st:
            stale.append(key)
        return data, err

    silso_d, e = take("silso")
    if e: errors["sunspot_number"] = e
    reg_d, e = take("regions")
    if e: errors["regions"] = e
    fl_d, e = take("flares")
    if e: errors["flares"] = e
    kp_d, e = take("kp")
    if e: errors["kp"] = e
    obs_d, e_obs = take("observed")
    pred_d, e_pred = take("predicted")
    img_d, e = take("image")   # sin la hora, la imagen se sirve igual (time=None)
    ha_d, e = take("halpha")
    if e: errors["halpha"] = e

    cycle = None
    if obs_d is not None or pred_d is not None:
        cycle = {"months": obs_d, "predicted": pred_d}
    if e_obs and e_pred:
        errors["cycle"] = f"{e_obs}; {e_pred}"
    elif e_obs:
        errors["cycle"] = f"manchas mensuales: {e_obs}"
    elif e_pred:
        errors["cycle"] = f"predicción: {e_pred}"

    ts = [r.ts for k, r in RESOURCES.items() if r.ts is not None and results[k][0] is not None]
    swpc_ts = max([r.ts for r in (regions, flares, kp, observed, predicted) if r.ts] or [None]) if any(
        r.ts for r in (regions, flares, kp, observed, predicted)) else None
    sources = [
        {"id": "silso", "name": SILSO_SOURCE, "url": PAGES["silso"], "data_url": SILSO_URL,
         "provides": "sunspot_number", "ok": silso_d is not None, "stale": "silso" in stale,
         "updated": iso_utc(silso.ts) if silso_d is not None else None},
        {"id": "swpc", "name": SWPC_SOURCE, "url": PAGES["swpc"],
         "data_url": [REGIONS_URL, FLARES_URL, KP_URL, OBSERVED_URL, PREDICTED_URL],
         "provides": ["regions", "flares", "kp", "cycle"],
         "ok": any(x is not None for x in (reg_d, fl_d, kp_d, obs_d, pred_d)),
         "stale": any(k in stale for k in ("regions", "flares", "kp", "observed", "predicted")),
         "updated": iso_utc(swpc_ts)},
        {"id": "sdo", "name": SDO_CREDIT, "url": PAGES["sdo"], "data_url": IMAGE_URL,
         "provides": "image", "ok": img_d is not None, "stale": "image" in stale,
         "updated": (img_d or {}).get("time")},
        {"id": "gong", "name": GONG_CREDIT, "url": PAGES["gong"], "data_url": GONG_BASE + "/HA/hag/",
         "provides": "halpha", "ok": ha_d is not None, "stale": "halpha" in stale,
         "updated": (ha_d or {}).get("time")},
    ]

    return {
        "updated": iso_utc(max(ts)) if ts else iso_utc(now.timestamp()),
        "sunspot_number": (
            None if silso_d is None else {
                "value": silso_d["value"], "date": silso_d["date"], "stdev": silso_d["stdev"],
                "stations": {"used": silso_d["stations_used"], "available": silso_d["stations_available"]},
                "provisional": True,
                "source": SILSO_SOURCE,
            }),
        "regions": None if reg_d is None else reg_d["regions"],
        "regions_date": None if reg_d is None else reg_d["date"],
        "flares_7d": fl_d,
        "strongest_flare_24h": None if fl_d is None else strongest_since(fl_d, now),
        "kp": kp_d,
        "cycle": cycle,
        "image": {"url": IMAGE_URL, "credit": SDO_CREDIT, "time": (img_d or {}).get("time"),
                  "page": PAGES["sdo"]},
        "halpha": None if ha_d is None else {**ha_d, "credit": GONG_CREDIT, "page": PAGES["gong"]},
        "stale": bool(stale),               # true si alguna fuente sirve su última copia guardada
        "stale_sources": sorted(stale),
        "errors": errors,
        "sources": sources,
    }


@router.get("/today")
async def sun_today(response: Response):
    """«El Sol hoy»: número de manchas (SILSO), regiones activas, fulguraciones, Kp y ciclo
    solar (NOAA SWPC) e imagen de SDO. Cada fuente falla por separado."""
    data = await build_today()
    if data["errors"] or data["stale"]:
        response.headers["Cache-Control"] = "public, max-age=30"
    return data
