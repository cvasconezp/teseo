"""El relieve cercano en 3D (app/terrain3d.py): alturas e imagen de satélite de los primeros 150 km alrededor
del lugar, en una rejilla polar (acimut × distancia, con la distancia en progresión geométrica: mucho detalle
cerca, menos lejos), que el navegador levanta como una malla con la imagen encima (src/sky/terrain3d.js).

  GET /api/terrain/near?lat&lon[&fine]      → alturas (uint16 en base64) y la dirección de la imagen
  GET /api/terrain/near.jpg?lat&lon[&fine]  → la imagen (JPEG): columnas = acimut desde el norte hacia el este,
                                              filas = distancia (de D_MIN a D_MAX, geométrica)

Fuentes: AWS Terrain Tiles (las mismas teselas del horizonte, app/horizon.py) y Sentinel-2 cloudless 2016 de EOX
(CC BY 4.0; las mismas de app/landcolor.py: solo esa edición, las posteriores no son de uso libre). Nada se guarda
en disco: caché en memoria por celda.
"""
import asyncio
import base64
import io
import math
import time
from collections import OrderedDict

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.concurrency import run_in_threadpool

from app import horizon as hz
from app import landcolor as lc
from app.cache import provider_headers

D_MIN = 60.0                 # m: más cerca, el píxel del satélite (10 m) ya no da
D_MAX = 300000.0             # m: todo lo que abarca el horizonte (app/horizon.py llega igual de lejos)
N_AZ = 720                   # alturas: cada 0,5° de acimut
N_R = 284                    # … y 284 anillos (≈ 3,1 % entre uno y otro)
TEX_W, TEX_H = 2048, 1024    # imagen: 0,18° de acimut × 0,59 % de distancia por píxel
# zoom de las teselas del satélite según la distancia (m): el píxel de la imagen pisa ≈ lo que mide el de la tesela
TEX_ZOOMS = ((2500.0, 14), (6000.0, 13), (13000.0, 12), (26000.0, 11), (55000.0, 10), (150000.0, 9), (D_MAX + 1.0, 8))
SUB_AZ, SUB_R = 0.17, 0.2   # submuestreo de cada celda: ±0,17° de acimut y ±0,2 y ±0,4 de paso de anillo
H_OFF, H_SCALE = 500.0, 4.0  # uint16 = (altura + 500 m) × 4  → pasos de 25 cm, hasta 15,8 km
NEUTRAL = (96, 102, 84)      # donde falte una tesela
JPEG_Q = 80
RESULT_CACHE_MAX = 16
CACHE_SECONDS = 7 * 86400

router = APIRouter(prefix="/api", tags=["horizon"])
_results: "OrderedDict[tuple, dict]" = OrderedDict()
_inflight: dict = {}
stats = {"computed": 0, "last_ms": None, "last_error": None}


def reset_cache() -> None:
    _results.clear(); _inflight.clear()


def ring_dist(n: int) -> np.ndarray:
    """Distancia (m) de cada anillo: geométrica de D_MIN a D_MAX."""
    return D_MIN * (D_MAX / D_MIN) ** (np.arange(n) / (n - 1))


def heights_grid(lat0: float, lon0: float, near: "hz.Mosaic", mid: "hz.Mosaic", far: "hz.Mosaic" = None) -> np.ndarray:
    """Alturas (m, el mar a 0) en la rejilla polar N_AZ × N_R."""
    az = np.arange(N_AZ) * (360.0 / N_AZ)
    d = ring_dist(N_R)
    # en cada celda, lo más alto de 15 puntos (3 acimutes × 5 distancias): con un solo punto por celda las crestas
    # quedarían recortadas y la silueta de la malla, por debajo de la del horizonte (que muestrea mucho más fino)
    ratio = (D_MAX / D_MIN) ** (1.0 / (N_R - 1))
    h = np.full((N_AZ, N_R), -1e9, dtype=np.float32)
    m = d <= hz.NEAR[1]
    mf = (d > hz.MID[1] * 0.9) if far is not None else np.zeros(len(d), dtype=bool)
    mm = ~m & ~mf
    for da in (-SUB_AZ, 0.0, SUB_AZ):
        for fr in (ratio ** (-2 * SUB_R), ratio ** -SUB_R, 1.0, ratio ** SUB_R, ratio ** (2 * SUB_R)):
            lat, lon = hz.destination(lat0, lon0, az + da, d * fr)
            s = np.empty((N_AZ, N_R), dtype=np.float32)
            if m.any():
                s[:, m] = near.sample(lat[:, m], lon[:, m])
            if mm.any():
                s[:, mm] = mid.sample(lat[:, mm], lon[:, mm])
            if mf.any():
                s[:, mf] = far.sample(lat[:, mf], lon[:, mf])
            np.maximum(h, s, out=h)
    return np.maximum(h, 0.0)


def encode_heights(h: np.ndarray) -> str:
    q = np.clip(np.round((h + H_OFF) * H_SCALE), 0, 65535).astype("<u2")
    return base64.b64encode(q.tobytes()).decode()


def tex_tiles(lat0: float, lon0: float) -> set:
    """Teselas (z, x, y) del satélite que hacen falta: por tramo de distancia, las que cubren su círculo."""
    need = set()
    for rad, z in TEX_ZOOMS:
        need.update((z, x, y) for (x, y) in hz.tiles_for(lat0, lon0, z, min(rad, D_MAX)))
    return need


def polar_texture(lat0: float, lon0: float, tiles: dict) -> np.ndarray:
    """La imagen polar (TEX_H × TEX_W × 3, uint8): fila 0 = D_MIN, última = D_MAX; columna 0 = norte."""
    az = (np.arange(TEX_W) + 0.5) * (360.0 / TEX_W)
    d = D_MIN * (D_MAX / D_MIN) ** (np.arange(TEX_H) / (TEX_H - 1))
    lat, lon = hz.destination(lat0, lon0, az, d)                 # (TEX_W, TEX_H)
    out = np.empty((TEX_H, TEX_W, 3), dtype=np.uint8)
    out[:] = NEUTRAL
    lo = 0.0
    for rad, z in TEX_ZOOMS:
        rows = np.flatnonzero((d > lo) & (d <= rad)) if lo else np.flatnonzero(d <= rad)
        lo = rad
        if not len(rows):
            continue
        x, y = lc.world_px(lat[:, rows], lon[:, rows], z)
        n = 2 ** z
        # mosaico del tramo (las teselas que tocan sus puntos) y muestreo bilineal: cerca, el píxel del satélite se
        # ve grande y sin interpolar quedaría a cuadros
        tx0 = int(np.floor((x.min() - 1) / lc.TS)); tx1 = int(np.floor((x.max() + 1) / lc.TS))
        ty0 = max(0, int(np.floor((y.min() - 1) / lc.TS))); ty1 = min(n - 1, int(np.floor((y.max() + 1) / lc.TS)))
        if tx1 - tx0 > 12 or ty1 - ty0 > 12:                     # (cruce del antimeridiano o cerca de un polo: sin imagen)
            continue
        mos = np.empty(((ty1 - ty0 + 1) * lc.TS, (tx1 - tx0 + 1) * lc.TS, 3), dtype=np.float32)
        mos[:] = NEUTRAL
        for ty in range(ty0, ty1 + 1):
            for tx in range(tx0, tx1 + 1):
                t = tiles.get((z, tx % n, ty))
                if t is not None:
                    mos[(ty - ty0) * lc.TS:(ty - ty0 + 1) * lc.TS, (tx - tx0) * lc.TS:(tx - tx0 + 1) * lc.TS] = t
        hh, ww = mos.shape[:2]
        fx = np.clip(x - tx0 * lc.TS - 0.5, 0, ww - 1.001); fy = np.clip(y - ty0 * lc.TS - 0.5, 0, hh - 1.001)
        i = fx.astype(np.int64); j = fy.astype(np.int64)
        u = (fx - i)[..., None].astype(np.float32); v = (fy - j)[..., None].astype(np.float32)
        c = (mos[j, i] * (1 - u) * (1 - v) + mos[j, i + 1] * u * (1 - v) + mos[j + 1, i] * (1 - u) * v + mos[j + 1, i + 1] * u * v)
        out[rows, :] = np.clip(np.round(c), 0, 255).astype(np.uint8).transpose(1, 0, 2)
    return out


def to_jpeg(img: np.ndarray) -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.fromarray(img, "RGB").save(buf, "JPEG", quality=JPEG_Q)
    return buf.getvalue()


async def near_terrain(lat: float, lon: float, fine: bool = False) -> dict:
    prof = await hz.get_horizon(lat, lon, fine)                  # el mismo lugar y el mismo suelo que el horizonte
    key = (prof["lat"], prof["lon"])
    if key in _results:
        _results.move_to_end(key)
        return _results[key]
    fut = _inflight.get(key)
    if fut is not None:
        return await asyncio.shield(fut)
    fut = asyncio.get_running_loop().create_future(); _inflight[key] = fut
    try:
        t0 = time.time()
        la, lo = key
        async with httpx.AsyncClient(timeout=hz.TIMEOUT_S, transport=hz._transport, headers=provider_headers()) as client:
            sem = asyncio.Semaphore(hz.CONCURRENCY)
            mos = []
            for z, rad in (hz.NEAR, hz.MID, hz.FAR):
                keys = hz.tiles_for(la, lo, z, min(rad * 1.02, D_MAX * 1.05))
                arrs = await asyncio.gather(*[hz._fetch_tile(client, z, x, y, sem) for (x, y) in keys])
                mos.append(hz.Mosaic(z, dict(zip(keys, arrs))))
        h = await run_in_threadpool(heights_grid, la, lo, mos[0], mos[1], mos[2])
        need = tex_tiles(la, lo)
        async with httpx.AsyncClient(timeout=lc.TIMEOUT_S, transport=lc._transport, headers=provider_headers()) as client:
            sem = asyncio.Semaphore(lc.CONCURRENCY)
            got = await asyncio.gather(*[lc._tile(client, z, x, y, sem) for (z, x, y) in need])
        tiles = {k: v for k, v in got if v is not None}
        if not tiles:
            raise RuntimeError("no respondió el servidor de teselas de satélite")
        img = await run_in_threadpool(polar_texture, la, lo, tiles)
        jpg = await run_in_threadpool(to_jpeg, img)
        res = {
            "meta": {
                "lat": la, "lon": lo, "ground_m": prof["ground_m"], "eye_m": prof["eye_m"],
                "n_az": N_AZ, "n_r": N_R, "d_min_m": D_MIN, "d_max_m": D_MAX,
                "h_off": H_OFF, "h_scale": H_SCALE, "heights": encode_heights(h),
                "coverage": round(len(tiles) / max(1, len(need)), 3), "credit": lc.CREDIT,
            },
            "jpg": jpg,
        }
        _results[key] = res
        while len(_results) > RESULT_CACHE_MAX:
            _results.popitem(last=False)
        stats["computed"] += 1; stats["last_ms"] = int((time.time() - t0) * 1000)
        fut.set_result(res)
        return res
    except Exception as e:
        stats["last_error"] = str(e)
        fut.set_exception(e)
        fut.exception()
        raise
    finally:
        _inflight.pop(key, None)


_Q_LAT = Query(..., ge=-85.0, le=85.0)
_Q_LON = Query(..., ge=-180.0, le=180.0)


@router.get("/terrain/near")
async def terrain_near(response: Response, lat: float = _Q_LAT, lon: float = _Q_LON, fine: bool = Query(False)):
    """Relieve cercano (hasta 150 km) en rejilla polar: `heights` es base64 de uint16 (little-endian), n_az × n_r,
    acimut a acimut; altura (m) = valor / h_scale − h_off. Los anillos van de d_min_m a d_max_m en progresión
    geométrica. La imagen de satélite que va encima, en /api/terrain/near.jpg con los mismos parámetros."""
    try:
        data = await near_terrain(lat, lon, fine)
    except Exception as e:                                       # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se pudo preparar el relieve cercano: {e}")
    response.headers["Cache-Control"] = f"public, max-age={CACHE_SECONDS}"
    return data["meta"]


@router.get("/terrain/near.jpg")
async def terrain_near_jpg(lat: float = _Q_LAT, lon: float = _Q_LON, fine: bool = Query(False)):
    """Imagen de satélite (Sentinel-2 cloudless 2016, EOX, CC BY 4.0) del relieve cercano, en la misma rejilla polar."""
    try:
        data = await near_terrain(lat, lon, fine)
    except Exception as e:                                       # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se pudo preparar el relieve cercano: {e}")
    return Response(content=data["jpg"], media_type="image/jpeg",
                    headers={"Cache-Control": f"public, max-age={CACHE_SECONDS}"})
