"""
horizon.py — el horizonte real de un lugar: la silueta de las montañas que tapan el cielo.

  GET /api/horizon?lat=<grados>&lon=<grados>

Fuente: AWS Terrain Tiles (registro de datos abiertos de AWS, «Terrain Tiles»), teselas de elevación en
formato «terrarium» (PNG: altura = R·256 + G + B/256 − 32768 m), hechas por Mapzen a partir de SRTM (NASA),
GMTED2010 (USGS), ETOPO1 (NOAA) y otros modelos (ver CREDITS.md). Con CORS abierto y sin claves.

Cálculo (en el servidor: son decenas de teselas; al navegador solo le llega la lista de ángulos):
  * el lugar se redondea a una celda de 0,002° (≈ 220 m) y su altura es la del propio modelo (en el punto o, si es
    mayor, la media de un anillo de 150 m) más 1,7 m de los ojos: así el observador nunca queda «dentro» del terreno;
  * cada 0,2° de acimut se recorre el terreno desde 300 m hasta 300 km, con pasos que crecen con la distancia
    (zoom 12 de las teselas, ≈ 38 m por píxel en el ecuador, hasta 20 km; zoom 11, ≈ 76 m, hasta 50 km; zoom 9,
    ≈ 300 m, más lejos). El detalle lo limita el modelo: SRTM mide cada ~30 m, así que agujas de roca más
    finas que eso no aparecen;
  * el ángulo de cada punto descuenta la curvatura de la Tierra con la refracción estándar (k = 0,13):
        ángulo = atan((h − h₀ − d²·(1 − k) / 2R) / d)
    y el horizonte en ese acimut es el ángulo más alto;
  * se guarda además el más alto por bandas de distancia (hasta 1,5, 4, 10, 25, 60 y 150 km) con la altura del
    terreno en ese punto y su distancia, para dibujar las sierras en capas (lejos más claras) y la nieve de las
    cumbres (desde la línea de nieves hacia arriba).
No incluye árboles ni edificios, solo el relieve.

Caché en memoria: teselas (LRU) y resultados por celda (LRU). Si una tesela no llega, error 502.
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
from PIL import Image

from app.cache import iso_utc, provider_headers

SOURCE = "AWS Terrain Tiles (Mapzen terrarium: SRTM, GMTED2010, ETOPO1…)"
TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
STEP_DEG = 0.2
N_AZ = int(round(360 / STEP_DEG))
BANDS_KM = (1.5, 4.0, 10.0, 25.0, 60.0, 150.0, 300.0)
NEAR = (12, 20e3)            # zoom de teselas y alcance (m) del tramo cercano (≈ 38 m por píxel en el ecuador)
MID = (11, 50e3)             # tramo medio (≈ 76 m)
FAR = (9, 300e3)             # tramo lejano (≈ 300 m): desde una cumbre andina asoman nevados a más de 200 km
D_MIN = 300.0                # más cerca, el modelo mezcla edificios y árboles con el suelo (ruido)
N_SAMPLES = 720              # muestras por acimut (espaciado geométrico ≈ 1,0 %)
R_E = 6371008.8
K_REFR = 0.13
EYE_M = 1.7
CELL_DEG = 0.002             # ≈ 220 m: el punto exacto importa (una cumbre, un mirador)
CELL_FINE = 0.0002           # ≈ 22 m: para cumbres y para la posición del GPS (fine=1)
SUMMIT_Z = 13                # teselas para buscar la cumbre (≈ 19 m por píxel en el ecuador)
SUMMIT_STEP_M = 12.0         # rejilla de búsqueda (más fina que el píxel: el máximo no se escapa)
SUMMIT_MAX_R = 2000.0
TIMEOUT_S = 20.0
CONCURRENCY = 12
TILE_CACHE_MAX = 140
RESULT_CACHE_MAX = 600
CACHE_SECONDS = 7 * 86400    # el relieve no cambia: el navegador puede guardarlo una semana

# Para las pruebas: un httpx.MockTransport (sin red real). En producción, None.
_transport: Optional[httpx.AsyncBaseTransport] = None

router = APIRouter(prefix="/api", tags=["horizon"])

_tiles: "OrderedDict[tuple, np.ndarray]" = OrderedDict()
_results: "OrderedDict[tuple, dict]" = OrderedDict()
_inflight: dict = {}
stats = {"computed": 0, "tiles_fetched": 0, "last_error": None, "last_ms": None}


def reset_cache() -> None:
    _tiles.clear(); _results.clear(); _inflight.clear()
    stats.update(computed=0, tiles_fetched=0, last_error=None, last_ms=None)


def cell_of(lat: float, lon: float, fine: bool = False) -> tuple:
    """Celda del lugar (0,002° o, con fine, 0,0002°): (lat, lon) con lon en [−180, 180)."""
    step, nd = (CELL_FINE, 4) if fine else (CELL_DEG, 3)
    la = round(round(lat / step) * step, nd)
    lo = round(round(lon / step) * step, nd)
    lo = ((lo + 180.0) % 360.0) - 180.0
    return (max(-85.0, min(85.0, la)), round(lo, nd))


def decode_terrarium(png: bytes) -> np.ndarray:
    """PNG terrarium → alturas (m), float32 256×256."""
    a = np.asarray(Image.open(io.BytesIO(png)).convert("RGB"), dtype=np.float32)
    return a[..., 0] * 256.0 + a[..., 1] + a[..., 2] / 256.0 - 32768.0


def merc_px(lat, lon, z):
    """Coordenadas de píxel globales (Web Mercator, 256 px por tesela) en el zoom z."""
    n = 256.0 * (2 ** z)
    lat = np.clip(lat, -85.05, 85.05)
    x = (np.asarray(lon) + 180.0) / 360.0 * n
    y = (1.0 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def destination(lat0: float, lon0: float, az_deg: np.ndarray, d_m: np.ndarray):
    """Punto a distancia d (m) y acimut az (grados) por el círculo máximo (arrays con difusión)."""
    p1, l1 = math.radians(lat0), math.radians(lon0)
    b = np.radians(az_deg)[:, None]
    dr = (np.asarray(d_m) / R_E)[None, :]
    p2 = np.arcsin(np.sin(p1) * np.cos(dr) + np.cos(p1) * np.sin(dr) * np.cos(b))
    l2 = l1 + np.arctan2(np.sin(b) * np.sin(dr) * np.cos(p1), np.cos(dr) - np.sin(p1) * np.sin(p2))
    lon = (np.degrees(l2) + 540.0) % 360.0 - 180.0
    return np.degrees(p2), lon


def tiles_for(lat0: float, lon0: float, z: int, radius_m: float) -> list:
    """Teselas (x, y) del zoom z que cubren un círculo de radio `radius_m` alrededor del lugar."""
    dlat = math.degrees(radius_m / R_E) * 1.02
    dlon = dlat / max(0.05, math.cos(math.radians(lat0)))
    x0, y1 = merc_px(lat0 - dlat, lon0 - dlon, z)
    x1, y0 = merc_px(lat0 + dlat, lon0 + dlon, z)
    n = 2 ** z
    xs = range(int(math.floor(x0 / 256)), int(math.floor(x1 / 256)) + 1)
    ys = range(max(0, int(math.floor(y0 / 256))), min(n - 1, int(math.floor(y1 / 256))) + 1)
    return [(x % n, y) for y in ys for x in xs]


async def _fetch_tile(client: httpx.AsyncClient, z: int, x: int, y: int, sem: asyncio.Semaphore) -> np.ndarray:
    key = (z, x, y)
    if key in _tiles:
        _tiles.move_to_end(key)
        return _tiles[key]
    async with sem:
        last = None
        for intento in (1, 2):
            try:
                r = await client.get(TILE_URL.format(z=z, x=x, y=y))
                if r.status_code == 200:
                    arr = await run_in_threadpool(decode_terrarium, r.content)
                    _tiles[key] = arr
                    stats["tiles_fetched"] += 1
                    while len(_tiles) > TILE_CACHE_MAX:
                        _tiles.popitem(last=False)
                    return arr
                last = f"HTTP {r.status_code}"
            except (httpx.HTTPError, OSError, ValueError) as e:
                last = type(e).__name__
        raise RuntimeError(f"tesela {z}/{x}/{y}: {last}")


class Mosaic:
    """Teselas contiguas de un zoom pegadas en una sola matriz, con muestreo bilineal en grados."""

    def __init__(self, z: int, tiles: dict):
        self.z = z
        xs = sorted({x for (x, _) in tiles}); ys = sorted({y for (_, y) in tiles})
        n = 2 ** z
        # columnas en orden, también si el recuadro cruza el antimeridiano
        if xs and xs[-1] - xs[0] > len(xs) - 1:
            split = max(i for i in range(1, len(xs)) if xs[i] - xs[i - 1] > 1)
            xs = xs[split:] + xs[:split]
        self.xs, self.y0 = xs, ys[0]
        self.n = n
        self.a = np.zeros((len(ys) * 256, len(xs) * 256), dtype=np.float32)
        for i, x in enumerate(xs):
            for j, y in enumerate(ys):
                self.a[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = tiles[(x, y)]

    def sample(self, lat, lon):
        gx, gy = merc_px(lat, lon, self.z)
        x0 = self.xs[0] * 256.0
        lx = (gx - x0) % (self.n * 256.0)
        ly = gy - self.y0 * 256.0
        h, w = self.a.shape
        lx = np.clip(lx - 0.5, 0, w - 1.001); ly = np.clip(ly - 0.5, 0, h - 1.001)
        i = lx.astype(np.int64); j = ly.astype(np.int64); u = lx - i; v = ly - j
        a = self.a
        return (a[j, i] * (1 - u) * (1 - v) + a[j, i + 1] * u * (1 - v)
                + a[j + 1, i] * (1 - u) * v + a[j + 1, i + 1] * u * v)


def compute_profile(lat0: float, lon0: float, near: Mosaic, mid: Mosaic, far: Mosaic) -> dict:
    """El horizonte del lugar (puro: recibe los mosaicos ya descargados)."""
    # el suelo del lugar: el modelo en el punto o, si es mayor, la media de un anillo de 150 m (un solo píxel puede
    # caer en un bache del modelo; en una cumbre manda el punto, que es lo más alto)
    ring_lat, ring_lon = destination(lat0, lon0, np.arange(0, 360, 22.5), np.array([150.0]))
    here = float(near.sample(np.array([lat0]), np.array([lon0]))[0])
    ring = float(np.mean(np.maximum(near.sample(ring_lat, ring_lon).ravel(), 0.0)))
    ground = max(0.0, here, ring)
    h0 = ground + EYE_M
    az = np.arange(N_AZ) * STEP_DEG
    d = D_MIN * (FAR[1] / D_MIN) ** (np.arange(N_SAMPLES) / (N_SAMPLES - 1))
    lat, lon = destination(lat0, lon0, az, d)
    # cada tramo con su mosaico (solo se muestrea lo que le toca: menos memoria y tiempo)
    h = np.empty((N_AZ, N_SAMPLES), dtype=np.float32)
    for mos, lo_m, hi_m in ((near, 0.0, NEAR[1]), (mid, NEAR[1], MID[1]), (far, MID[1], FAR[1] + 1.0)):
        m = (d > lo_m) & (d <= hi_m)
        if m.any():
            h[:, m] = mos.sample(lat[:, m], lon[:, m])
    h = np.maximum(h, 0.0)                                       # el mar, a nivel del mar
    drop = (d * d * (1.0 - K_REFR) / (2.0 * R_E)).astype(np.float32)
    ang = np.degrees(np.arctan2(h - np.float32(h0) - drop[None, :], d[None, :].astype(np.float32)))
    bands, lo = [], 0.0
    for km in BANDS_KM:
        m = (d > lo * 1000.0) & (d <= km * 1000.0)
        sub = ang[:, m]; idx = np.argmax(sub, axis=1)
        bands.append({
            "max_km": km,
            "alt": [round(float(v), 2) for v in sub[np.arange(N_AZ), idx]],
            "top_m": [int(round(float(v))) for v in h[:, m][np.arange(N_AZ), idx]],
            # distancia del filo (km): con ella el navegador sabe a qué altura angular queda la línea de nieves y
            # si el filo es de verdad una cresta o solo el corte de una ladera en el límite de la banda
            "dist_km": [round(float(v) / 1000.0, 1) for v in d[m][idx]],
        })
        lo = km
    total = np.max(np.array([b["alt"] for b in bands]), axis=0)
    return {
        "lat": lat0, "lon": lon0, "ground_m": int(round(ground)), "eye_m": EYE_M,
        "step_deg": STEP_DEG, "alt": [round(float(v), 2) for v in total], "bands": bands,
        "source": SOURCE, "max_km": FAR[1] / 1000.0,
    }


async def get_horizon(lat: float, lon: float, fine: bool = False) -> dict:
    key = cell_of(lat, lon, fine)
    if key in _results:
        _results.move_to_end(key)
        return _results[key]
    fut = _inflight.get(key)
    if fut is not None:
        return await asyncio.shield(fut)
    loop = asyncio.get_running_loop()
    fut = loop.create_future(); _inflight[key] = fut
    try:
        t0 = time.time()
        sem = asyncio.Semaphore(CONCURRENCY)
        async with httpx.AsyncClient(timeout=TIMEOUT_S, transport=_transport, headers=provider_headers()) as client:
            mos = []
            for z, rad in (NEAR, MID, FAR):
                keys = tiles_for(key[0], key[1], z, rad)
                arrs = await asyncio.gather(*[_fetch_tile(client, z, x, y, sem) for (x, y) in keys])
                mos.append((z, dict(zip(keys, arrs))))
        near, mid, far = Mosaic(*mos[0]), Mosaic(*mos[1]), Mosaic(*mos[2])
        res = await run_in_threadpool(compute_profile, key[0], key[1], near, mid, far)
        res["computed"] = iso_utc(time.time())
        _results[key] = res
        while len(_results) > RESULT_CACHE_MAX:
            _results.popitem(last=False)
        stats["computed"] += 1; stats["last_ms"] = int((time.time() - t0) * 1000)
        fut.set_result(res)
        return res
    except Exception as e:
        stats["last_error"] = str(e)
        fut.set_exception(e)
        fut.exception()   # marcada como vista: quien espera la recibe igual
        raise
    finally:
        _inflight.pop(key, None)


@router.get("/horizon")
async def horizon(response: Response,
                  lat: float = Query(..., ge=-85.0, le=85.0),
                  lon: float = Query(..., ge=-180.0, le=180.0),
                  fine: bool = Query(False, description="celda de 0,0002° (≈ 22 m) en vez de 0,002°: cumbres y GPS")):
    """Horizonte real del lugar (silueta del relieve): ángulo sobre el horizonte astronómico cada 0,2° de
    acimut (desde el norte hacia el este), total y por bandas de distancia. El lugar se redondea a 0,002°
    (con fine, a 0,0002°); no se guarda ni se registra más que en la caché del servidor."""
    try:
        data = await get_horizon(lat, lon, fine)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo leer el relieve ({SOURCE.split(' (')[0]}): {e}")
    response.headers["Cache-Control"] = f"public, max-age={CACHE_SECONDS}"
    return data


# ── la cumbre más cercana (para situarse de pie en lo alto de una montaña o un volcán) ───────────────────
def find_summit(mos: "Mosaic", lat0: float, lon0: float, radius_m: float, strict: bool = False) -> dict:
    """El punto más alto del modelo a menos de `radius_m` del lugar (puro: recibe el mosaico).

    Con strict (la posición del GPS), solo vale si de verdad es una cima y tú estás en ella: el punto más alto
    también debe serlo en un círculo tres veces mayor (no la ladera de una montaña más grande), destacar al
    menos 15 m sobre ese círculo (no una llanura) y estar como mucho 40 m por encima de ti (no un refugio más
    abajo). Devuelve found=False si no; entonces el lugar se queda como está."""
    big = max(600.0, 3.0 * radius_m) if strict else radius_m
    n = int(math.ceil(big / SUMMIT_STEP_M))
    g = np.arange(-n, n + 1) * SUMMIT_STEP_M
    dx, dy = np.meshgrid(g, g)
    rr = np.hypot(dx, dy)
    inside = rr <= big
    dx, dy, rr = dx[inside], dy[inside], rr[inside]
    k = 1.0 / R_E
    lat = lat0 + np.degrees(dy * k)
    lon = lon0 + np.degrees(dx * k / max(0.05, math.cos(math.radians(lat0))))
    h = np.asarray(mos.sample(lat, lon), dtype=np.float64)
    here = float(mos.sample(np.array([lat0]), np.array([lon0]))[0])
    near = rr <= radius_m
    i = int(np.flatnonzero(near)[np.argmax(h[near])])
    top = float(h[i])
    out = {"found": True, "lat": round(float(lat[i]), 5), "lon": round(((float(lon[i]) + 540.0) % 360.0) - 180.0, 5),
           "ground_m": int(round(max(0.0, top))), "here_m": int(round(max(0.0, here))),
           "dist_m": int(round(float(rr[i]))), "rise_m": int(round(top - here)), "radius_m": int(radius_m)}
    if strict:
        rim = h[rr >= big - 2 * SUMMIT_STEP_M]
        ok = top >= float(h.max()) - 0.5 and top - float(np.mean(rim)) >= 15.0 and top - here <= 40.0
        if not ok:
            out.update(found=False, lat=round(lat0, 5), lon=round(lon0, 5), ground_m=int(round(max(0.0, here))), dist_m=0, rise_m=0)
    return out


@router.get("/summit")
async def summit(response: Response,
                 lat: float = Query(..., ge=-85.0, le=85.0),
                 lon: float = Query(..., ge=-180.0, le=180.0),
                 r: float = Query(600.0, ge=20.0, le=SUMMIT_MAX_R, description="radio de búsqueda (m)"),
                 strict: bool = Query(False, description="solo si es una cima y estás en ella (posición del GPS)")):
    """La cumbre más cercana: el punto más alto del modelo de terreno (AWS Terrain Tiles) a menos de r metros.
    Sirve para ponerse de pie en lo alto de una montaña o un volcán buscado por su nombre (cuyas coordenadas
    suelen ser aproximadas) o para corregir la posición del GPS en una cima. No se guarda ni se registra."""
    try:
        sem = asyncio.Semaphore(CONCURRENCY)
        rr = r
        async with httpx.AsyncClient(timeout=TIMEOUT_S, transport=_transport, headers=provider_headers()) as client:
            for _ in range(3):
                big = max(600.0, 3.0 * rr) if strict else rr
                keys = tiles_for(lat, lon, SUMMIT_Z, big + 60.0)
                arrs = await asyncio.gather(*[_fetch_tile(client, SUMMIT_Z, x, y, sem) for (x, y) in keys])
                mos = Mosaic(SUMMIT_Z, dict(zip(keys, arrs)))
                data = await run_in_threadpool(find_summit, mos, lat, lon, rr, strict)
                # lo más alto cayó en el borde del círculo: es una ladera, no la cima (el punto del mapa estaba en el
                # centro de un cráter, como en el Fuji o el Popocatépetl): se busca en un círculo mayor
                if strict or data["dist_m"] < rr - 2 * SUMMIT_STEP_M or rr >= SUMMIT_MAX_R:
                    break
                rr = min(SUMMIT_MAX_R, rr * 2.5)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo leer el relieve ({SOURCE.split(' (')[0]}): {e}")
    data["source"] = SOURCE
    response.headers["Cache-Control"] = f"public, max-age={CACHE_SECONDS}"
    return data


# ── alturas del terreno en puntos sueltos (para asentar los monumentos sobre el suelo del modelo) ──────────
ELEV_Z = 14                  # ≈ 10 m por píxel (el modelo de fondo es SRTM, ~30 m: interpolado)
ELEV_MAX_PTS = 80


def parse_points(pts: str) -> list:
    """«lat,lon;lat,lon;…» → [(lat, lon), …] (como mucho ELEV_MAX_PTS, todos válidos)."""
    out = []
    for part in (pts or "").split(";"):
        if not part.strip():
            continue
        la, lo = (float(v) for v in part.split(","))
        if not (-85.0 <= la <= 85.0 and -180.0 <= lo <= 180.0):
            raise ValueError("punto fuera de rango")
        out.append((la, lo))
    if not out or len(out) > ELEV_MAX_PTS:
        raise ValueError(f"entre 1 y {ELEV_MAX_PTS} puntos")
    return out


@router.get("/elevation")
async def elevation(response: Response, pts: str = Query(..., max_length=4000)):
    """Altura del terreno (m, modelo de AWS Terrain Tiles) en cada punto «lat,lon» separado por «;». Sirve para
    asentar los monumentos del cielo sobre el mismo suelo que el horizonte."""
    try:
        points = parse_points(pts)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Puntos no válidos: {e}")
    try:
        sem = asyncio.Semaphore(CONCURRENCY)
        keys = sorted({(int(math.floor(merc_px(la, lo, ELEV_Z)[0] / 256)) % (2 ** ELEV_Z), int(math.floor(merc_px(la, lo, ELEV_Z)[1] / 256))) for la, lo in points})
        async with httpx.AsyncClient(timeout=TIMEOUT_S, transport=_transport, headers=provider_headers()) as client:
            arrs = await asyncio.gather(*[_fetch_tile(client, ELEV_Z, x, y, sem) for (x, y) in keys])
        tiles = dict(zip(keys, arrs))
        heights = []
        for la, lo in points:
            gx, gy = merc_px(la, lo, ELEV_Z)
            x, y = int(math.floor(gx / 256)) % (2 ** ELEV_Z), int(math.floor(gy / 256))
            # una sola tesela por punto basta: bilineal dentro de ella (en el borde, el píxel más cercano)
            m = Mosaic(ELEV_Z, {(x, y): tiles[(x, y)]})
            heights.append(round(float(m.sample(np.array([la]), np.array([lo]))[0]), 1))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo leer el relieve ({SOURCE.split(' (')[0]}): {e}")
    response.headers["Cache-Control"] = f"public, max-age={CACHE_SECONDS}"
    return {"heights": heights, "source": SOURCE}
