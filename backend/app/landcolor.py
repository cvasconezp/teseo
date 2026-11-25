"""
landcolor.py — el color real de las laderas del horizonte, de un mosaico de satélite sin nubes.

  GET /api/horizon/colors?lat=<grados>&lon=<grados>[&fine=1]

Para cada banda de distancia del horizonte (app/horizon.py) y cada 0,4° de acimut, dos colores: el del filo (lo
más alto que se ve en esa dirección) y el de la ladera que baja hacia el observador (a medio camino entre el
comienzo de la banda y el filo). El navegador los usa como color de fondo del relieve (pajonal, bosque, desierto,
roca) y encima pone la luz del Sol, la perspectiva aérea, la noche y una textura generada (src/sky/terrainLayer.js).

Fuente: Sentinel-2 cloudless 2016 de EOX IT Services GmbH (https://s2maps.eu), CC BY 4.0, por su servicio WMTS
(teselas JPEG en la proyección de Mercator). Las versiones de 2018 en adelante son CC BY-NC-SA: no se usan.
Atribución exigida: «Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified
Copernicus Sentinel data 2016 & 2017)».

Cada color es la media de un cuadrado de píxeles alrededor del punto (más grande cuanto más lejos: una columna
de 0,4° a 100 km abarca 700 m). Resultado en memoria por celda del horizonte.
"""

import asyncio
import base64
import io
import math
import time
from collections import OrderedDict
from typing import Optional

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.concurrency import run_in_threadpool

from app import horizon as hz
from app.cache import provider_headers

TILE_URL = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"
CREDIT = ("Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH "
          "(Contains modified Copernicus Sentinel data 2016 & 2017)")
STEP = 2                     # una columna de cada dos del horizonte (0,4°)
ZOOMS = (14, 13, 12, 11, 10, 9)   # por banda: ≈ 9, 19, 38, 76, 150, 300 m por píxel en el ecuador
TS = 256
CONCURRENCY = 8
TIMEOUT_S = 20.0
TILE_CACHE_MAX = 96
RESULT_CACHE_MAX = 48
R_E = 6371008.8

router = APIRouter(prefix="/api", tags=["horizon"])
_transport: Optional[httpx.AsyncBaseTransport] = None
_tiles: "OrderedDict[tuple, np.ndarray]" = OrderedDict()
_results: "OrderedDict[tuple, dict]" = OrderedDict()
stats = {"computed": 0, "tiles_fetched": 0, "last_ms": None, "last_error": None}


def decode_jpeg(content: bytes) -> np.ndarray:
    from PIL import Image
    im = Image.open(io.BytesIO(content), formats=["JPEG"]).convert("RGB")
    if im.size != (TS, TS):
        im = im.resize((TS, TS))
    return np.asarray(im, dtype=np.uint8)


def dest(lat0: float, lon0: float, az_deg: np.ndarray, d_m: np.ndarray):
    """Puntos a d_m metros en los rumbos az_deg desde (lat0, lon0) (esfera)."""
    p1, l1 = math.radians(lat0), math.radians(lon0)
    th, de = np.radians(az_deg), d_m / R_E
    p2 = np.arcsin(np.sin(p1) * np.cos(de) + np.cos(p1) * np.sin(de) * np.cos(th))
    l2 = l1 + np.arctan2(np.sin(th) * np.sin(de) * np.cos(p1), np.cos(de) - np.sin(p1) * np.sin(p2))
    return np.degrees(p2), (np.degrees(l2) + 540.0) % 360.0 - 180.0


def world_px(lat: np.ndarray, lon: np.ndarray, z: int):
    s = TS * 2 ** z
    la = np.radians(np.clip(lat, -85.05, 85.05))
    return (lon + 180.0) / 360.0 * s, (1.0 - np.log(np.tan(la) + 1.0 / np.cos(la)) / math.pi) / 2.0 * s


def plan(prof: dict):
    """Puntos que hay que mirar: por banda, (lat, lon, radio en píxeles) del filo y de la ladera."""
    n = len(prof["alt"]); step = prof["step_deg"]
    cols = np.arange(0, n, STEP)
    az = cols * step
    out, lo = [], 0.3
    for k, band in enumerate(prof["bands"]):
        z = hz.zoom_for_lat(ZOOMS[min(k, len(ZOOMS) - 1)], prof["lat"])   # sin cambios hasta 45° (ver horizon)
        d = np.asarray(band["dist_km"], dtype=np.float64)[cols] * 1000.0
        d = np.where(d > 0, d, (lo + band["max_km"]) * 500.0)
        dmid = (lo * 1000.0 + d) / 2.0
        mpp = 156543.03 * math.cos(math.radians(prof["lat"])) / 2 ** z      # metros por píxel
        pts = []
        for dd in (d, dmid):
            la, lo_ = dest(prof["lat"], prof["lon"], az, dd)
            # medio ancho de la columna (0,4° → d·0,007) en píxeles, entre 1 y 6
            r = np.clip(np.round(dd * math.radians(step * STEP) / 2.0 / mpp), 1, 6).astype(int)
            pts.append((la, lo_, r))
        out.append((z, pts))
        lo = band["max_km"]
    return out


def tiles_needed(pl) -> set:
    need = set()
    for z, pts in pl:
        for la, lo, r in pts:
            x, y = world_px(la, lo, z)
            for dx in (-6, 0, 6):
                for dy in (-6, 0, 6):
                    tx = np.floor((x + dx) / TS).astype(int) % (2 ** z)
                    ty = np.clip(np.floor((y + dy) / TS).astype(int), 0, 2 ** z - 1)
                    need.update((z, int(a), int(b)) for a, b in zip(tx, ty))
    return need


def is_cloudy(px) -> bool:
    """Píxel blanco o gris claro (nubes que quedaron en el mosaico, sobre todo en la vertiente amazónica, casi
    siempre nublada; sus bordes; invernaderos; nieve) o casi negro (sombra de una nube). No sirve como color del
    suelo (la nieve la pone el modelo)."""
    mx, mn = int(max(px)), int(min(px))
    L = (mx + mn) / 2
    # blancos y grises claros (nubes, sus bordes, invernaderos) y casi negros (sombras de nubes)
    return (L > 150 and mx - mn < 45) or (L > 122 and mx - mn < 30) or L < 22


def fill_gaps(cols: np.ndarray, ok: np.ndarray) -> np.ndarray:
    """Las columnas sin color válido toman el de la válida más cercana en acimut (circular); sin ninguna, neutro."""
    if ok.all():
        return cols
    out = cols.copy()
    idx = np.flatnonzero(ok)
    if not len(idx):
        out[:] = (95, 100, 80)
        return out
    n = len(cols)
    for i in np.flatnonzero(~ok):
        d = np.minimum(np.abs(idx - i), n - np.abs(idx - i))
        out[i] = cols[idx[int(np.argmin(d))]]
    return out


def sample(pl, tiles: dict) -> list:
    """Color medio (RGB 0–255) de cada punto, sin los píxeles de nubes (is_cloudy); los huecos, del vecino."""
    bands = []
    for z, pts in pl:
        pair = []
        for la, lo, r in pts:
            x, y = world_px(la, lo, z)
            cols = np.zeros((len(la), 3), dtype=np.uint8)
            ok = np.zeros(len(la), dtype=bool)
            for i in range(len(la)):
                ri = int(r[i]); acc = np.zeros(3); cnt = 0
                for yy in range(int(y[i]) - ri, int(y[i]) + ri + 1, max(1, ri // 2)):
                    for xx in range(int(x[i]) - ri, int(x[i]) + ri + 1, max(1, ri // 2)):
                        t = tiles.get((z, (xx // TS) % (2 ** z), min(2 ** z - 1, max(0, yy // TS))))
                        if t is None:
                            continue
                        px = t[yy % TS, xx % TS]
                        if is_cloudy(px):
                            continue
                        acc += px; cnt += 1
                if cnt:
                    cols[i] = np.clip(acc / cnt, 0, 255); ok[i] = True
            pair.append(fill_gaps(cols, ok))
        bands.append(pair)
    return bands


async def _tile(client, z, x, y, sem):
    key = (z, x, y)
    if key in _tiles:
        _tiles.move_to_end(key); return key, _tiles[key]
    async with sem:
        for _ in (1, 2):
            try:
                r = await client.get(TILE_URL.format(z=z, x=x, y=y))
                if r.status_code == 200:
                    arr = await run_in_threadpool(decode_jpeg, r.content)
                    _tiles[key] = arr; stats["tiles_fetched"] += 1
                    while len(_tiles) > TILE_CACHE_MAX:
                        _tiles.popitem(last=False)
                    return key, arr
            except (httpx.HTTPError, OSError, ValueError):
                pass
    return key, None


async def land_colors(lat: float, lon: float, fine: bool = False) -> dict:
    prof = await hz.get_horizon(lat, lon, fine)
    key = (prof["lat"], prof["lon"])
    if key in _results:
        _results.move_to_end(key); return _results[key]
    t0 = time.time()
    pl = plan(prof)
    need = tiles_needed(pl)
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(timeout=TIMEOUT_S, transport=_transport, headers=provider_headers()) as client:
        got = await asyncio.gather(*[_tile(client, z, x, y, sem) for (z, x, y) in need])
    tiles = {k: v for k, v in got if v is not None}
    if not tiles:
        raise RuntimeError("no respondió el servidor de teselas de satélite")
    cols = await run_in_threadpool(sample, pl, tiles)
    res = {"lat": prof["lat"], "lon": prof["lon"], "step_deg": prof["step_deg"] * STEP,
           "bands": [{"top": base64.b64encode(t.tobytes()).decode(), "bottom": base64.b64encode(b.tobytes()).decode()} for t, b in cols],
           "coverage": round(len(tiles) / max(1, len(need)), 3), "credit": CREDIT}
    _results[key] = res
    while len(_results) > RESULT_CACHE_MAX:
        _results.popitem(last=False)
    stats["computed"] += 1; stats["last_ms"] = int((time.time() - t0) * 1000)
    return res


@router.get("/horizon/colors")
async def horizon_colors(response: Response,
                         lat: float = Query(..., ge=-85.0, le=85.0),
                         lon: float = Query(..., ge=-180.0, le=180.0),
                         fine: bool = Query(False)):
    """Color real (satélite, Sentinel-2 cloudless 2016) del filo y de la ladera de cada banda del horizonte, cada
    0,4° de acimut: por banda, `top` y `bottom` en base64 (RGB, 3 bytes por columna)."""
    try:
        data = await land_colors(lat, lon, fine)
    except hz.TooManyTiles as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:                                       # noqa: BLE001
        stats["last_error"] = str(e)
        raise HTTPException(status_code=502, detail=f"No se pudieron leer los colores del satélite: {e}")
    response.headers["Cache-Control"] = "public, max-age=2592000"
    return data
