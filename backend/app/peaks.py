"""
peaks.py — los nombres de las montañas que se ven en el horizonte real de un lugar.

  GET /api/peaks?lat=<grados>&lon=<grados>

Fuente de los nombres: OpenStreetMap (cumbres y volcanes con nombre: natural=peak|volcano), por la API Overpass.
© colaboradores de OpenStreetMap, licencia ODbL (ver CREDITS.md).

Solo se nombra una cumbre si FORMA la silueta que dibuja el cielo. Con el horizonte del lugar ya calculado
(app/horizon.py: para cada 0,2° de acimut y cada banda de distancia, el punto más alto, su ángulo y su distancia):
  * se calcula el acimut y la distancia de la cumbre desde el lugar;
  * se busca, cerca de ese acimut, el filo de su banda de distancia cuyo punto más alto está a la distancia de la
    cumbre (con margen): si el filo de esa banda lo pone otro cerro, más cerca o más lejos, esta cumbre no se ve;
  * el filo no puede quedar tapado por una banda más cercana;
  * el nombre se ancla en el punto exacto de la silueta dibujada (mismo ángulo que la línea de la cresta), no en
    un ángulo calculado aparte: así el rótulo cae siempre sobre la cumbre que se ve.
Se ordenan por lo que destacan sobre el horizonte de alrededor y, de dos cumbres casi en el mismo rumbo, queda la
que más destaca. El navegador decide cuántos caben según el zoom.

Caché en memoria por celda del horizonte. Si Overpass falla, 502 (el cielo sigue con montañas, sin nombres).
"""

import asyncio
import math
import time
from collections import OrderedDict
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Response

from app import horizon as hz
from app.cache import iso_utc, provider_headers

SOURCE = "OpenStreetMap (Overpass API) — © colaboradores de OpenStreetMap, ODbL"
OVERPASS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
NEAR_KM = 40.0          # hasta aquí, todas las cumbres con nombre
MAX_KM = 150.0          # más lejos, solo las que tienen altura y superan la del lugar en ≥ 300 m
MIN_KM = 0.5
MAX_PEAKS = 40
TIMEOUT_S = 75.0            # los servidores públicos van cargados: a veces tardan
RESULT_CACHE_MAX = 400
CACHE_SECONDS = 3 * 86400

_transport: Optional[httpx.AsyncBaseTransport] = None
router = APIRouter(prefix="/api", tags=["peaks"])
_results: "OrderedDict[tuple, dict]" = OrderedDict()
stats = {"computed": 0, "last_error": None, "last_ms": None, "last_endpoint": None}


def reset_cache() -> None:
    _results.clear()
    stats.update(computed=0, last_error=None, last_ms=None, last_endpoint=None)


def bearing_dist(lat0: float, lon0: float, lat: float, lon: float):
    """Acimut (grados desde el norte hacia el este) y distancia (km) por el círculo máximo."""
    p0, p1 = math.radians(lat0), math.radians(lat)
    dl = math.radians(lon - lon0)
    y = math.sin(dl) * math.cos(p1)
    x = math.cos(p0) * math.sin(p1) - math.sin(p0) * math.cos(p1) * math.cos(dl)
    az = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0
    a = math.sin((p1 - p0) / 2) ** 2 + math.cos(p0) * math.cos(p1) * math.sin(dl / 2) ** 2
    d = 2 * hz.R_E * math.asin(min(1.0, math.sqrt(a))) / 1000.0
    return az, d


def parse_ele(v) -> Optional[float]:
    """«5790», «5790 m», «5.790», «18999 ft» → metros (o None)."""
    if v is None:
        return None
    s = str(v).strip().lower().replace(",", ".")
    ft = "ft" in s or "'" in s
    num = ""
    for ch in s:
        if ch.isdigit() or (ch == "." and "." not in num):
            num += ch
        elif num:
            break
    if not num:
        return None
    # «5.790» con punto de miles (más de 3 cifras tras el punto no existe en una altura con decimales razonables)
    if num.count(".") == 1 and len(num.split(".")[1]) == 3 and float(num) < 10:
        num = num.replace(".", "")
    try:
        e = float(num)
    except ValueError:
        return None
    if ft:
        e *= 0.3048
    return e if -500 < e < 9000 else None


def bbox(lat: float, lon: float, km: float) -> str:
    """Recuadro (s,w,n,e) que contiene el círculo de `km` alrededor del lugar (más rápido que «around»)."""
    dlat = km / 111.32
    dlon = km / (111.32 * max(0.05, math.cos(math.radians(lat))))
    return f"{max(-90.0, lat - dlat):.4f},{lon - dlon:.4f},{min(90.0, lat + dlat):.4f},{lon + dlon:.4f}"


def overpass_query(lat: float, lon: float, min_far_ele: float) -> str:
    """Consulta ligera para servidores cargados: etiquetas exactas (usan el índice, sin expresiones regulares ni
    «if») y el filtro de altura de las lejanas se hace aquí (`far_ok`)."""
    near, far = bbox(lat, lon, NEAR_KM), bbox(lat, lon, MAX_KM)
    return (
        "[out:json][timeout:60];("
        f'node["natural"="peak"]["name"]({near});'
        f'node["natural"="volcano"]["name"]({near});'
        f'node["natural"="peak"]["name"]["ele"]({far});'
        f'node["natural"="volcano"]["name"]({far});'
        ");out body qt;"
    )


def far_ok(el: dict, lat: float, lon: float, min_far_ele: float) -> bool:
    """Cerca, toda cumbre con nombre; lejos, solo las que superan en altura al lugar (las demás no asoman)."""
    if "lat" not in el or "lon" not in el:
        return False
    _, d = bearing_dist(lat, lon, float(el["lat"]), float(el["lon"]))
    if d <= NEAR_KM:
        return True
    e = parse_ele((el.get("tags") or {}).get("ele"))
    return e is None or e >= min_far_ele


def visible_peaks(prof: dict, nodes: list, lang_keys=("es", "en")) -> list:
    """Las cumbres de `nodes` (elementos de Overpass) que forman la silueta de `prof` (resultado de horizon)."""
    step = prof["step_deg"]; n = len(prof["alt"]); bands = prof["bands"]
    lat0, lon0, total = prof["lat"], prof["lon"], prof["alt"]
    out = []
    for el in nodes:
        tags = el.get("tags") or {}
        name = (tags.get("name") or "").strip()
        if not name or "lat" not in el or "lon" not in el:
            continue
        az, d = bearing_dist(lat0, lon0, float(el["lat"]), float(el["lon"]))
        if d < MIN_KM or d > MAX_KM:
            continue
        tol = max(0.5, 0.08 * d)                                          # km: margen entre el modelo y el mapa
        w = max(2, int(math.ceil(max(0.4, math.degrees(math.atan2(0.35, d))) / step)))
        c = int(round(az / step))
        # la banda de su distancia (y la vecina si la cumbre cae junto al límite entre dos bandas)
        best = None
        lo = 0.0
        for k, band in enumerate(bands):
            hi = band["max_km"]
            if d + tol > lo and d - tol <= hi:
                for j in range(c - w, c + w + 1):
                    i = j % n
                    if abs(band["dist_km"][i] - d) > tol:
                        continue
                    if best is None or band["alt"][i] > bands[best[0]]["alt"][best[1]]:
                        best = (k, i)
            lo = hi
        if best is None:
            continue
        b, best = best
        band = bands[b]
        a = band["alt"][best]
        # tapada por una banda más cercana: no se ve
        if any(bands[k]["alt"][best] > a - 0.02 for k in range(b)):
            continue
        # cuánto destaca: sobre el horizonte más bajo de ±8° alrededor (un volcán ancho también destaca)
        r = int(round(8.0 / step))
        around = min(total[(best + j) % n] for j in range(-r, r + 1))
        ele = parse_ele(tags.get("ele"))
        out.append({
            "name": name,
            **{f"name_{lg}": tags.get(f"name:{lg}") for lg in lang_keys if tags.get(f"name:{lg}")},
            "ele_m": int(round(ele)) if ele is not None else int(band["top_m"][best]),
            "az": round(best * step, 2), "alt": a, "dist_km": round(d, 1), "band": b,
            "volcano": tags.get("natural") == "volcano",
            "lift": round(a - around, 2),
        })
    # de dos cumbres casi en el mismo rumbo (< 1°: dos nombres para la misma mole), la que más destaca
    out.sort(key=lambda p: (-p["lift"], -p["ele_m"]))
    kept = []
    for p in out:
        if any(abs(((p["az"] - q["az"] + 180) % 360) - 180) < 1.0 for q in kept):
            continue
        kept.append(p)
        if len(kept) >= MAX_PEAKS:
            break
    return kept


async def fetch_nodes(lat: float, lon: float, ground_m: float) -> list:
    """Pregunta a los servidores Overpass a la vez y se queda con la primera respuesta buena (suelen ir
    cargados: uno solo puede tardar un minuto o fallar)."""
    min_far = ground_m + 300.0
    q = overpass_query(lat, lon, min_far)
    errors = []
    async with httpx.AsyncClient(timeout=TIMEOUT_S, transport=_transport, headers=provider_headers()) as client:
        async def one(url):
            r = await client.post(url, data={"data": q})
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}")
            els = r.json().get("elements")
            if els is None:
                raise RuntimeError("respuesta sin elementos")
            return url, els
        tasks = {asyncio.ensure_future(one(u)): u for u in OVERPASS}
        try:
            for fut in asyncio.as_completed(list(tasks)):
                try:
                    url, els = await fut
                    stats["last_endpoint"] = url
                    seen, out = set(), []
                    for el in els:
                        if el.get("id") in seen or not far_ok(el, lat, lon, min_far):
                            continue
                        seen.add(el.get("id")); out.append(el)
                    return out
                except Exception as e:                     # noqa: BLE001 — se prueba el siguiente
                    errors.append(str(e) or type(e).__name__)
        finally:
            for t in tasks:
                t.cancel()
    raise RuntimeError("; ".join(errors) or "sin respuesta")


async def get_peaks(lat: float, lon: float) -> dict:
    key = hz.cell_of(lat, lon)
    if key in _results:
        _results.move_to_end(key)
        return _results[key]
    t0 = time.time()
    prof = await hz.get_horizon(lat, lon)
    nodes = await fetch_nodes(prof["lat"], prof["lon"], prof["ground_m"])
    res = {"lat": prof["lat"], "lon": prof["lon"], "peaks": visible_peaks(prof, nodes), "candidates": len(nodes),
           "source": SOURCE, "computed": iso_utc(time.time())}
    _results[key] = res
    while len(_results) > RESULT_CACHE_MAX:
        _results.popitem(last=False)
    stats["computed"] += 1; stats["last_ms"] = int((time.time() - t0) * 1000)
    return res


@router.get("/peaks")
async def peaks(response: Response,
                lat: float = Query(..., ge=-85.0, le=85.0),
                lon: float = Query(..., ge=-180.0, le=180.0)):
    """Nombres (OpenStreetMap) de las cumbres que forman la silueta del horizonte real del lugar, con el punto
    exacto de la silueta donde va cada uno (acimut y ángulo, como /api/horizon)."""
    try:
        data = await get_peaks(lat, lon)
    except Exception as e:
        stats["last_error"] = str(e)
        raise HTTPException(status_code=502, detail=f"No se pudieron leer los nombres de las montañas (OpenStreetMap): {e}")
    response.headers["Cache-Control"] = f"public, max-age={CACHE_SECONDS}"
    return data
