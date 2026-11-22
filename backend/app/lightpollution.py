"""Contaminación lumínica estimada para un lugar (app/lightpollution.py).

  GET /api/lightpollution?lat&lon  → clase de Bortle ESTIMADA (1–9) a partir de las luces nocturnas que ve el
                                     satélite alrededor del lugar.

No es una medición del cielo: es una estimación. Se leen las teselas «Black Marble» 2016 de la NASA (luces
nocturnas del VIIRS, composición anual; NASA Earth Observatory / GIBS, de dominio público) en 80 km a la redonda,
se suman las luces con un peso que cae con la distancia (ley de Walker, d^-2,5, suavizada cerca) y el resultado
se pasa a la escala de Bortle con umbrales ajustados a lugares conocidos (Quito, con mediciones SQM publicadas, en
la clase 8; la Amazonia y el desierto de Atacama en la 1). La imagen satura en el centro de las ciudades y no
distingue bien la clase 8 de la 9; el error típico es de ±1 clase. El atlas de Falchi et al. (2016), que sería
la fuente natural, no es de uso libre (CC BY-NC y descarga bajo petición), así que no se usa.
"""
import asyncio
import io
import math
import time
from collections import OrderedDict
from typing import Optional

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.concurrency import run_in_threadpool

from app.cache import provider_headers

TILE_URL = ("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/"
            "GoogleMapsCompatible_Level8/{z}/{y}/{x}.png")
CREDIT = "NASA Earth Observatory / GIBS — Black Marble 2016 (VIIRS, Suomi NPP)"
Z, TS = 8, 256
R_KM = 80.0                  # hasta dónde se suman las luces
D0_KM = 6.0                  # suavizado cerca del lugar (la imagen satura en el centro de las ciudades)
CELL_DEG = 0.05              # ≈ 5,5 km: la estimación no da para más
# umbrales de log10(índice) → clase de Bortle (de mayor a menor)
STEPS = ((0.40, 9), (0.20, 8), (0.0, 7), (-0.22, 6), (-0.38, 5), (-0.75, 4), (-1.3, 3), (-2.5, 2))
TIMEOUT_S = 20.0
TILE_CACHE_MAX = 48
RESULT_CACHE_MAX = 400
CACHE_SECONDS = 30 * 86400

router = APIRouter(prefix="/api", tags=["sky"])
_transport: Optional[httpx.AsyncBaseTransport] = None
_tiles: "OrderedDict[tuple, np.ndarray]" = OrderedDict()
_results: "OrderedDict[tuple, dict]" = OrderedDict()
stats = {"computed": 0, "last_ms": None, "last_error": None}


def reset_cache() -> None:
    _tiles.clear(); _results.clear()


def cell_of(lat: float, lon: float) -> tuple:
    la = round(round(lat / CELL_DEG) * CELL_DEG, 2)
    lo = round(round(lon / CELL_DEG) * CELL_DEG, 2)
    return (max(-84.0, min(84.0, la)), ((lo + 180.0) % 360.0) - 180.0)


def world_px(lat: float, lon: float):
    s = TS * 2 ** Z
    la = math.radians(lat)
    return (lon + 180.0) / 360.0 * s, (1.0 - math.log(math.tan(la) + 1.0 / math.cos(la)) / math.pi) / 2.0 * s


def window(lat: float, lon: float):
    """Recuadro de píxeles (x0, x1, y0, y1), centro (px, py) y km por píxel para el lugar."""
    px, py = world_px(lat, lon)
    kmpp = 40075.017 * math.cos(math.radians(lat)) / (TS * 2 ** Z)
    r = int(R_KM / kmpp) + 1
    return int(px) - r, int(px) + r, int(py) - r, int(py) + r, px, py, kmpp


def tiles_needed(lat: float, lon: float) -> list:
    x0, x1, y0, y1, *_ = window(lat, lon)
    n = 2 ** Z
    return [(tx % n, ty) for ty in range(max(0, y0 // TS), min(n - 1, y1 // TS) + 1) for tx in range(x0 // TS, x1 // TS + 1)]


def light_index(lat: float, lon: float, tiles: dict) -> float:
    """Suma de las luces alrededor, con el peso de la distancia (puro: recibe las teselas ya descargadas)."""
    x0, x1, y0, y1, px, py, kmpp = window(lat, lon)
    n = 2 ** Z
    img = np.zeros((y1 - y0 + 1, x1 - x0 + 1, 3), dtype=np.float32)
    for ty in range(max(0, y0 // TS), min(n - 1, y1 // TS) + 1):
        for tx in range(x0 // TS, x1 // TS + 1):
            t = tiles.get((tx % n, ty))
            if t is None:
                continue
            ax0, ax1 = max(x0, tx * TS), min(x1, tx * TS + TS - 1)
            ay0, ay1 = max(y0, ty * TS), min(y1, ty * TS + TS - 1)
            img[ay0 - y0:ay1 - y0 + 1, ax0 - x0:ax1 - x0 + 1] = t[ay0 - ty * TS:ay1 - ty * TS + 1, ax0 - tx * TS:ax1 - tx * TS + 1]
    yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
    d = np.hypot(xx + 0.5 - px, yy + 0.5 - py) * kmpp
    red, blue = img[..., 0], img[..., 2]
    # las luces son amarillas o blancas (rojo alto); el fondo de la imagen (tierra y mar de noche) es azulado
    sig = np.where(red > blue * 0.85, np.clip((red - 40.0) / 215.0, 0.0, 1.0) ** 2.0, 0.0)
    w = np.where(d <= R_KM, (d * d + D0_KM * D0_KM) ** -1.25, 0.0)
    return float((sig * w).sum() * kmpp * kmpp)


def bortle_of(index: float) -> int:
    lg = math.log10(index + 1e-5)
    for thr, cls in STEPS:
        if lg >= thr:
            return cls
    return 1


def decode_png(content: bytes) -> np.ndarray:
    from PIL import Image
    return np.asarray(Image.open(io.BytesIO(content)).convert("RGB"), dtype=np.float32)


async def _tile(client, x, y, sem):
    key = (x, y)
    if key in _tiles:
        _tiles.move_to_end(key); return key, _tiles[key]
    async with sem:
        for _ in (1, 2):
            try:
                r = await client.get(TILE_URL.format(z=Z, x=x, y=y))
                if r.status_code == 200:
                    arr = await run_in_threadpool(decode_png, r.content)
                    if arr.shape[:2] != (TS, TS):
                        return key, None
                    _tiles[key] = arr
                    while len(_tiles) > TILE_CACHE_MAX:
                        _tiles.popitem(last=False)
                    return key, arr
            except (httpx.HTTPError, OSError, ValueError):
                pass
    return key, None


async def estimate(lat: float, lon: float) -> dict:
    key = cell_of(lat, lon)
    if key in _results:
        _results.move_to_end(key); return _results[key]
    t0 = time.time()
    need = tiles_needed(*key)
    sem = asyncio.Semaphore(6)
    async with httpx.AsyncClient(timeout=TIMEOUT_S, transport=_transport, headers=provider_headers()) as client:
        got = await asyncio.gather(*[_tile(client, x, y, sem) for (x, y) in need])
    tiles = {k: v for k, v in got if v is not None}
    if len(tiles) < len(need):
        raise RuntimeError("no respondió el servidor de luces nocturnas de la NASA")
    idx = await run_in_threadpool(light_index, key[0], key[1], tiles)
    res = {"lat": key[0], "lon": key[1], "bortle": bortle_of(idx), "log_index": round(math.log10(idx + 1e-5), 2),
           "radius_km": R_KM, "estimate": True, "uncertainty": 1, "credit": CREDIT}
    _results[key] = res
    while len(_results) > RESULT_CACHE_MAX:
        _results.popitem(last=False)
    stats["computed"] += 1; stats["last_ms"] = int((time.time() - t0) * 1000)
    return res


@router.get("/lightpollution")
async def lightpollution(response: Response,
                         lat: float = Query(..., ge=-84.0, le=84.0),
                         lon: float = Query(..., ge=-180.0, le=180.0)):
    """Clase de Bortle ESTIMADA (±1) para el lugar, a partir de las luces nocturnas vistas por satélite (NASA Black
    Marble 2016) en 80 km a la redonda. El lugar se redondea a 0,05°. No es una medición."""
    try:
        data = await estimate(lat, lon)
    except Exception as e:                                       # noqa: BLE001
        stats["last_error"] = str(e)
        raise HTTPException(status_code=502, detail=f"No se pudo estimar la contaminación lumínica: {e}")
    response.headers["Cache-Control"] = f"public, max-age={CACHE_SECONDS}"
    return data
