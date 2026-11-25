"""
cloudsat.py — las nubes de AHORA alrededor de un lugar, vistas por los satélites geoestacionarios.

  GET /api/clouds-sat?lat=<grados>&lon=<grados>[&ground=<m>]

Para dibujar en el cielo las nubes reales de este momento (no las del pronóstico): dónde hay nubes en 150 km a la
redonda y a qué altura está su tope, repartidas en las tres capas del cielo de Teseo (bajas < 3 km sobre el suelo,
medias 3–8 km, altas > 8 km, como Open-Meteo). El satélite ve desde arriba: una nube baja bajo una alta no se ve.

Fuentes (la más cercana al lugar; todas sin clave):
  * GOES-19 (GOES Este, 75,2° O) y GOES-18 (GOES Oeste, 137,2° O): productos de nivel 2 de la NOAA en su bucket abierto
    de AWS (NODD): fase del tope de nube (ACTPF, 2 km; 0 = despejado) y altura del tope (ACHAF, 10 km). Dominio público.
  * Himawari-9 (140,7° E): productos de nubes de la NOAA a partir del AHI de la JMA (AHI-L2-FLDK-Clouds, 2 km).
  * Meteosat (0° y 45,5° E, océano Índico): máscara de nubes (CLM) y altura del tope (CTH) de EUMETSAT, por su servicio
    de mapas EUMETView (imágenes: la máscara se lee por su blanco; la altura, por la escala de colores de su leyenda).
Los archivos de la NOAA son grandes (Himawari: cientos de MB): se leen por partes (HTTP Range) solo los bloques de la
zona pedida. Cada consulta se guarda 10 minutos (los satélites dan una imagen cada 10–15 minutos).

Respuesta: { source, sat, by, time (ISO, inicio del barrido), radius_km, res_km, n, ground_m, cover (0–1),
  layers: { low|mid|high: { cover (0–1), top_km (mediana) o null, grid: base64 de n×n bytes } } }
La malla: fila r, columna c → este = −R + c·res, norte = −R + r·res (km; fila 0 al sur). Cada byte es el % de la celda
cubierto por nubes de esa capa (0–100) o 255 sin dato (fuera del disco o sin barrido).
"""

import atexit
import base64
import io
import math
import re
import threading
import time
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.concurrency import run_in_threadpool

from app.cache import provider_headers

R_KM, RES_KM, SUB = 150.0, 3.0, 3             # radio, celda y muestras por lado de celda (cada 1 km)
N = int(round(2 * R_KM / RES_KM)) + 1          # 101
LOW_M, HIGH_M = 3000.0, 8000.0                 # límites de las capas sobre el suelo (Open-Meteo)
MAX_VIEW_DEG = 75.0                            # más allá, el satélite ve muy de lado
TTL_S, LIST_TTL_S = 600, 240
TIMEOUT_S = 25.0

SOURCES = (
    {"id": "goes-east", "sat": "GOES-19", "lon": -75.2, "kind": "goes", "bucket": "noaa-goes19", "by": "NOAA (GOES-19, nivel 2)"},
    {"id": "goes-west", "sat": "GOES-18", "lon": -137.2, "kind": "goes", "bucket": "noaa-goes18", "by": "NOAA (GOES-18, nivel 2)"},
    {"id": "msg", "sat": "Meteosat (0°)", "lon": 0.0, "kind": "eum", "ws": "msg_fes", "by": "EUMETSAT (EUMETView)"},
    {"id": "iodc", "sat": "Meteosat (océano Índico)", "lon": 45.5, "kind": "eum", "ws": "msg_iodc", "by": "EUMETSAT (EUMETView)"},
    {"id": "himawari", "sat": "Himawari-9", "lon": 140.7, "kind": "ahi", "bucket": "noaa-himawari9", "by": "JMA · NOAA (Himawari-9, nivel 2)"},
)
EUMETVIEW = "https://view.eumetsat.int/geoserver"

router = APIRouter(prefix="/api", tags=["clouds"])
_client_lock = threading.Lock()
_client: Optional[httpx.Client] = None


def _http() -> httpx.Client:
    global _client
    with _client_lock:
        if _client is None:
            _client = httpx.Client(timeout=TIMEOUT_S, follow_redirects=True, headers=provider_headers())
        return _client


# ── geometría ─────────────────────────────────────────────────────────────────────────────────────────────
def view_angle(lat: float, lon: float, sub_lon: float) -> float:
    """Ángulo (grados, desde el centro de la Tierra) entre el lugar y el punto bajo el satélite."""
    dl = math.radians(((lon - sub_lon + 540) % 360) - 180)
    return math.degrees(math.acos(max(-1.0, min(1.0, math.cos(math.radians(lat)) * math.cos(dl)))))


def pick_source(lat: float, lon: float) -> Optional[dict]:
    """El satélite geoestacionario que mejor ve el lugar (el de punto bajo más cercano), o None (polos)."""
    best = min(SOURCES, key=lambda s: view_angle(lat, lon, s["lon"]))
    return best if view_angle(lat, lon, best["lon"]) <= MAX_VIEW_DEG else None


def sample_points(lat0: float, lon0: float):
    """Puntos de muestreo (cada 1 km) de la malla alrededor del lugar: (lat, lon) de forma (N·SUB, N·SUB)."""
    m = N * SUB
    k = (np.arange(m) - (m - 1) / 2) * (RES_KM / SUB)
    E, Nn = np.meshgrid(k, k)                                       # fila 0 al sur
    lat = lat0 + Nn / 111.32
    lon = lon0 + E / (111.32 * max(0.05, math.cos(math.radians(lat0))))
    return lat, ((lon + 540) % 360) - 180


def goes_xy(lat, lon, lon0, a=6378137.0, b=6356752.31414, hp=35786023.0):
    """Lat/lon (grados) → ángulos de barrido x, y (rad) de la malla fija del GOES-R (barrido en x) y si se ve."""
    H = hp + a
    la = np.radians(lat); dl = np.radians(lon - lon0)
    e2 = (a * a - b * b) / (a * a)
    pc = np.arctan((b * b) / (a * a) * np.tan(la))
    rc = b / np.sqrt(1 - e2 * np.cos(pc) ** 2)
    sx = H - rc * np.cos(pc) * np.cos(dl); sy = -rc * np.cos(pc) * np.sin(dl); sz = rc * np.sin(pc)
    vis = H * (H - sx) > sy * sy + (a * a) / (b * b) * sz * sz
    x = np.arcsin(-sy / np.sqrt(sx * sx + sy * sy + sz * sz)); y = np.arctan(sz / sx)
    return x, y, vis


def ahi_colrow(lat, lon, lon0=140.7, cfac=20466275.0, coff=2750.5):
    """Lat/lon (grados) → columna y fila (base 1, norma CGMS) del disco de 2 km del Himawari (5500 × 5500)."""
    la = np.radians(lat); dl = np.radians(lon - lon0)
    pc = np.arctan(0.993305616 * np.tan(la))
    rl = 6356.7523 / np.sqrt(1 - 0.00669438444 * np.cos(pc) ** 2)
    r1 = 42164 - rl * np.cos(pc) * np.cos(dl); r2 = -rl * np.cos(pc) * np.sin(dl); r3 = rl * np.sin(pc)
    rn = np.sqrt(r1 * r1 + r2 * r2 + r3 * r3)
    x = np.degrees(np.arctan(-r2 / r1)); y = np.degrees(np.arcsin(-r3 / rn))
    vis = r1 > 0
    return coff + x * cfac / 65536.0, coff + y * cfac / 65536.0, vis


# ── reparto en capas ──────────────────────────────────────────────────────────────────────────────────────
def classify(cloud, top_m, ground_m, phase=None):
    """
    Muestras → índice de capa: −2 sin dato, −1 despejado, 0 bajas, 1 medias, 2 altas.
    cloud: fracción de nube (0–1, o NaN sin dato); top_m: altura del tope sobre el mar (NaN si no hay);
    phase (GOES/Himawari): 1–2 agua, 3 mixta, 4 hielo, 5 desconocida (para las nubes sin altura).
    """
    out = np.full(cloud.shape, -2, dtype=np.int8)
    ok = np.isfinite(cloud)
    out[ok & (cloud < 0.5)] = -1
    cl = ok & (cloud >= 0.5)
    agl = top_m - ground_m
    has = cl & np.isfinite(agl)
    out[has & (agl < LOW_M)] = 0
    out[has & (agl >= LOW_M) & (agl < HIGH_M)] = 1
    out[has & (agl >= HIGH_M)] = 2
    rest = cl & ~np.isfinite(agl)
    if phase is not None:
        out[rest & ((phase == 1) | (phase == 2))] = 0
        out[rest & (phase == 4)] = 2
        out[rest & ~((phase == 1) | (phase == 2) | (phase == 4))] = 1
    else:
        out[rest] = 1
    return out


def to_grid(cls, top_m):
    """Muestras clasificadas (N·SUB)² → por capa: malla N×N de % (255 sin dato), cobertura media y tope mediano."""
    m = N * SUB
    c = cls.reshape(N, SUB, N, SUB)
    valid = (c != -2).sum(axis=(1, 3))
    layers, total = {}, 0.0
    vmask = cls != -2
    nval = max(1, int(vmask.sum()))
    for k, name in enumerate(("low", "mid", "high")):
        hit = (c == k).sum(axis=(1, 3))
        pct = np.where(valid > 0, np.rint(100.0 * hit / np.maximum(1, valid)), 255).astype(np.uint8)
        sel = (cls == k) & np.isfinite(top_m)
        layers[name] = {
            "cover": round(float((cls == k).sum()) / nval, 3),
            "top_km": round(float(np.median(top_m[sel])) / 1000.0, 1) if sel.any() else None,
            "grid": base64.b64encode(pct.tobytes()).decode("ascii"),
        }
    total = float(((cls >= 0) & vmask).sum()) / nval
    return layers, round(total, 3), int(vmask.sum()) / float(m * m)


# ── lectura por partes de archivos remotos (h5py) ─────────────────────────────────────────────────────────
class RangeFile:
    """Archivo remoto de solo lectura: pide por HTTP Range solo los bloques que h5py lee (y los recuerda)."""

    # 40 bloques × 256 KiB = 10 MiB por archivo, y se guardan 6 archivos (_h5): ≈ 60 MiB como mucho (antes, 400
    # bloques: hasta 100 MiB por archivo, 600 MiB en total). Una ventana de 300 km lee muchos menos bloques.
    def __init__(self, url: str, block: int = 256 << 10, max_blocks: int = 40):
        self.url, self.block, self.pos, self.max_blocks = url, block, 0, max_blocks
        self.cache: "OrderedDict[int, bytes]" = OrderedDict()
        self.lock = threading.Lock()
        r = _http().head(url); r.raise_for_status()
        self.size = int(r.headers["content-length"])

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else (self.pos + off if whence == 1 else self.size + off)
        return self.pos

    def _blk(self, k):
        with self.lock:
            if k in self.cache:
                self.cache.move_to_end(k); return self.cache[k]
        a = k * self.block; b = min(self.size, a + self.block) - 1
        r = _http().get(self.url, headers={"Range": f"bytes={a}-{b}"}); r.raise_for_status()
        # solo vale la parte pedida (206): un servidor que ignore Range devuelve el archivo entero (200, cientos de
        # MB en el caso de Himawari) y su comienzo se tomaría por el bloque k
        if r.status_code != 206 or len(r.content) > b - a + 1:
            raise OSError(f"el servidor no respetó la lectura por partes (HTTP {r.status_code}, {len(r.content)} bytes)")
        with self.lock:
            self.cache[k] = r.content
            while len(self.cache) > self.max_blocks:
                self.cache.popitem(last=False)
        return r.content

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        n = max(0, min(n, self.size - self.pos)); out = bytearray()
        while n > 0:
            k, o = divmod(self.pos, self.block); chunk = self._blk(k)[o:o + n]
            if not chunk:
                break
            out += chunk; self.pos += len(chunk); n -= len(chunk)
        return bytes(out)

    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)


_files: "OrderedDict[str, object]" = OrderedDict()
_files_lock = threading.Lock()


def _h5(url: str):
    """El archivo remoto abierto con h5py (se guardan los últimos 6, con sus bloques ya leídos)."""
    import h5py   # perezoso: solo este servicio lo usa
    with _files_lock:
        if url in _files:
            _files.move_to_end(url); return _files[url]
    h = h5py.File(RangeFile(url), "r")
    with _files_lock:
        _files[url] = h
        while len(_files) > 6:
            _, old = _files.popitem(last=False)
            try:
                old.close()
            except Exception:                                    # noqa: BLE001
                pass
    return h


@atexit.register
def _close_all():
    """Cierra los archivos remotos antes de que Python desarme sus módulos (h5py con objetos de archivo)."""
    with _files_lock:
        while _files:
            _, h = _files.popitem()
            try:
                h.close()
            except Exception:                                    # noqa: BLE001
                pass


def _read_window(ds, rows, cols, fill):
    """Lee del dataset 2D solo el rectángulo que cubre rows/cols (índices base 0) y devuelve los valores (fill fuera)."""
    H, W = ds.shape[:2]
    inside = (rows >= 0) & (rows < H) & (cols >= 0) & (cols < W)
    out = np.full(rows.shape, fill, dtype=np.float64)
    if not inside.any():
        return out
    r0, r1 = int(rows[inside].min()), int(rows[inside].max()) + 1
    c0, c1 = int(cols[inside].min()), int(cols[inside].max()) + 1
    win = ds[r0:r1, c0:c1]
    out[inside] = win[rows[inside] - r0, cols[inside] - c0]
    return out


# ── listados de los buckets de la NOAA ────────────────────────────────────────────────────────────────────
_lists: dict = {}


def _s3_keys(bucket: str, prefix: str, delimiter: bool = False):
    key = (bucket, prefix, delimiter)
    now = time.time()
    hit = _lists.get(key)
    if hit and now - hit[0] < LIST_TTL_S:
        return hit[1]
    # fuera los listados caducados (cada hora y cada día traen prefijos nuevos: sin esto, el dict solo crece)
    for k in [k for k, (t, _) in _lists.items() if now - t >= LIST_TTL_S]:
        _lists.pop(k, None)
    params = {"list-type": "2", "prefix": prefix}
    if delimiter:
        params["delimiter"] = "/"
    r = _http().get(f"https://{bucket}.s3.amazonaws.com/", params=params); r.raise_for_status()
    tag = "Prefix" if delimiter else "Key"
    vals = re.findall(rf"<{tag}>([^<]+)</{tag}>", r.text)
    if delimiter:
        vals = [v for v in vals if v != prefix]
    _lists[key] = (time.time(), vals)
    return vals


def _scan_start(key: str) -> Optional[datetime]:
    m = re.search(r"_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})\d_", key)          # GOES: _sAAAADDDHHMMSSd_
    if m:
        y, doy, hh, mm, ss = map(int, m.groups())
        return datetime(y, 1, 1, tzinfo=timezone.utc) + timedelta(days=doy - 1, hours=hh, minutes=mm, seconds=ss)
    m = re.search(r"_s(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\d_", key)    # Himawari: _sAAAAMMDDHHMMSSd_
    if m:
        return datetime(*map(int, m.groups()), tzinfo=timezone.utc)
    return None


def latest_goes(bucket: str, now: datetime):
    """(url de ACTPF, url de ACHAF, inicio del barrido) del último disco completo con los dos productos."""
    for back in range(0, 3):
        t = now - timedelta(hours=back)
        pre = f"{t:%Y}/{t.timetuple().tm_yday:03d}/{t:%H}/"
        ph = sorted(_s3_keys(bucket, "ABI-L2-ACTPF/" + pre))
        ht = sorted(_s3_keys(bucket, "ABI-L2-ACHAF/" + pre))
        for k in reversed(ph):
            s = re.search(r"_s(\d{13})", k).group(1)
            match = [h for h in ht if f"_s{s}" in h]
            if match:
                base = f"https://{bucket}.s3.amazonaws.com/"
                return base + k, base + match[-1], _scan_start(k)
    raise RuntimeError("no hay barridos recientes del GOES")


def latest_ahi(bucket: str, now: datetime):
    """(url de la fase, url de la altura, inicio del barrido) del último disco de Himawari con los dos productos."""
    for back in range(0, 2):
        t = now - timedelta(days=back)
        folders = sorted(_s3_keys(bucket, f"AHI-L2-FLDK-Clouds/{t:%Y/%m/%d}/", delimiter=True))
        for f in reversed(folders[-8:]):
            keys = _s3_keys(bucket, f)
            ph = [k for k in keys if "/AHI-CPHS_" in k]; ht = [k for k in keys if "/AHI-CHGT_" in k]
            if ph and ht:
                base = f"https://{bucket}.s3.amazonaws.com/"
                return base + ph[-1], base + ht[-1], _scan_start(ph[-1])
    raise RuntimeError("no hay barridos recientes del Himawari")


# ── lectores por satélite ─────────────────────────────────────────────────────────────────────────────────
def read_goes(src: dict, lat, lon, now: datetime):
    url_ph, url_ht, t0 = latest_goes(src["bucket"], now)
    hp, hh = _h5(url_ph), _h5(url_ht)

    def idx(h):
        p = h["goes_imager_projection"].attrs
        lon0 = float(np.ravel(p["longitude_of_projection_origin"])[0])
        x, y, vis = goes_xy(lat, lon, lon0, float(np.ravel(p["semi_major_axis"])[0]), float(np.ravel(p["semi_minor_axis"])[0]),
                            float(np.ravel(p["perspective_point_height"])[0]))
        xs, xo = float(np.ravel(h["x"].attrs["scale_factor"])[0]), float(np.ravel(h["x"].attrs["add_offset"])[0])
        ys, yo = float(np.ravel(h["y"].attrs["scale_factor"])[0]), float(np.ravel(h["y"].attrs["add_offset"])[0])
        c = np.rint((x - xo) / xs).astype(int); r = np.rint((y - yo) / ys).astype(int)
        c[~vis] = -1; r[~vis] = -1
        return r, c

    r, c = idx(hp)
    phase = _read_window(hp["Phase"], r, c, 255)
    r2, c2 = idx(hh)
    raw = _read_window(hh["HT"], r2, c2, 65535)
    sf = float(np.ravel(hh["HT"].attrs.get("scale_factor", [1.0]))[0]); ao = float(np.ravel(hh["HT"].attrs.get("add_offset", [0.0]))[0])
    top = np.where(raw >= 65535, np.nan, raw * sf + ao)
    cloud = np.where(phase >= 255, np.nan, np.where(phase >= 1, 1.0, 0.0))
    return cloud, top, np.where(phase >= 255, 0, phase), t0


def read_ahi(src: dict, lat, lon, now: datetime):
    url_ph, url_ht, t0 = latest_ahi(src["bucket"], now)
    hp, hh = _h5(url_ph), _h5(url_ht)
    col, row, vis = ahi_colrow(lat, lon, src["lon"])
    c = np.rint(col).astype(int) - 1; r = np.rint(row).astype(int) - 1
    c[~vis] = -1; r[~vis] = -1
    phase = _read_window(hp["CloudPhase"], r, c, -128)
    top = _read_window(hh["CldTopHght"], r, c, -999.0)
    top = np.where(top <= -998, np.nan, top)
    bad = (phase < 0) | (phase > 5)
    cloud = np.where(bad, np.nan, np.where(phase >= 1, 1.0, 0.0))
    return cloud, top, np.where(bad, 0, phase), t0


CTH_LUT = ((0,0,0,320), (0,0,0,368), (0,0,0,433), (0,0,0,497), (26,11,0,562), (26,11,0,627), (26,11,0,691), (41,18,0,756), (53,23,0,820), (53,23,0,885), (53,23,0,949), (67,30,0,1014), (79,35,0,1078), (79,35,0,1143), (83,37,0,1207), (99,43,3,1272), (105,45,5,1336), (105,45,5,1401), (105,45,5,1465), (119,38,37,1530), (122,36,42,1594), (122,36,42,1659), (124,35,50,1723), (137,29,74,1788), (140,27,79,1853), (140,27,79,1917), (146,24,94,1982), (157,18,117,2046), (157,18,117,2111), (157,18,117,2175), (164,15,133,2240), (174,9,154,2304), (174,9,154,2369), (175,9,156,2433), (186,4,180,2498), (192,0,192,2562), (192,0,192,2627), (192,0,192,2691), (167,0,201,2756), (154,0,204,2820), (154,0,204,2885), (148,0,206,2949), (122,0,215,3014), (117,0,216,3079), (117,0,216,3143), (109,0,219,3208), (84,0,227,3272), (79,0,229,3337), (79,0,229,3401), (71,0,232,3466), (47,0,239,3530), (41,0,241,3595), (41,0,241,3659), (27,0,248,3724), (4,1,253,3788), (4,1,253,3853), (4,1,253,3917), (0,19,255,3982), (0,19,255,4046), (0,19,255,4111), (0,25,255,4175), (0,45,255,4240), (0,45,255,4305), (0,45,255,4369), (0,52,255,4434), (0,69,255,4498), (0,69,255,4563), (0,69,255,4627), (0,76,255,4692), (0,92,255,4756), (0,95,255,4821), (0,95,255,4885), (0,107,255,4950), (0,121,255,5014), (0,121,255,5079), (0,121,255,5143), (0,133,255,5208), (0,146,255,5272), (0,146,255,5337), (0,146,255,5401), (0,163,255,5466), (0,169,255,5531), (0,169,255,5595), (0,169,255,5660), (0,190,255,5724), (0,194,255,5789), (0,194,255,5853), (0,198,255,5918), (0,215,255,5982), (0,220,255,6047), (0,220,255,6111), (0,228,255,6176), (0,244,255,6240), (0,244,255,6305), (0,244,255,6369), (0,246,244,6434), (0,248,226,6498), (0,248,226,6563), (0,248,226,6627), (0,240,194,6692), (0,235,177,6757), (0,235,177,6821), (0,235,177,6886), (0,227,143,6950), (0,224,128,7015), (0,224,128,7079), (0,222,123,7144), (0,214,92,7208), (0,211,77,7273), (0,211,77,7337), (0,207,67,7402), (0,199,36,7466), (0,198,27,7531), (0,198,27,7595), (5,197,17,7660), (10,194,0,7724), (10,194,0,7789), (10,194,0,7853), (27,197,0,7918), (34,200,0,7983), (34,200,0,8047), (34,200,0,8112), (52,204,0,8176), (60,206,0,8241), (60,206,0,8305), (60,206,0,8370), (77,210,0,8434), (83,212,0,8499), (83,212,0,8563), (90,214,0,8628), (109,219,0,8692), (109,219,0,8757), (109,219,0,8821), (115,220,0,8886), (134,225,0,8950), (134,225,0,9015), (134,225,0,9080), (147,228,0,9144), (159,231,0,9209), (159,231,0,9273), (159,231,0,9338), (174,234,0,9402), (184,237,0,9467), (184,237,0,9531), (184,237,0,9596), (198,241,0,9660), (208,243,0,9725), (208,243,0,9789), (212,244,0,9854), (230,248,0,9918), (233,249,0,9983), (233,249,0,10047), (237,250,0,10112), (254,251,0,10176), (254,251,0,10241), (254,251,0,10306), (254,241,0,10370), (254,226,0,10435), (254,226,0,10499), (254,226,0,10564), (254,214,0,10628), (254,201,0,10693), (254,201,0,10757), (254,201,0,10822), (254,184,0,10886), (254,177,0,10951), (254,177,0,11015), (254,176,0,11080), (254,158,0,11144), (254,152,0,11209), (254,152,0,11273), (254,148,0,11338), (254,128,0,11402), (254,128,0,11467), (254,128,0,11532), (254,122,0,11596), (254,102,0,11661), (254,102,0,11725), (254,102,0,11790), (254,94,0,11854), (254,77,0,11919), (254,77,0,11983), (254,77,0,12048), (254,63,0,12112), (254,53,0,12177), (254,53,0,12241), (254,53,0,12306), (254,38,0,12370), (254,28,0,12435), (254,28,0,12499), (254,28,0,12564), (254,12,0,12628), (254,3,0,12693), (254,3,0,12758), (250,11,8,12822), (238,26,26,12887), (238,26,26,12951), (238,26,26,13016), (233,37,37,13080), (219,56,56,13145), (219,57,57,13209), (218,58,58,13274), (210,75,75,13338), (201,88,88,13403), (201,88,88,13467), (201,88,88,13532), (191,108,108,13596), (183,120,120,13661), (183,120,120,13725), (183,120,120,13790), (172,140,140,13854), (166,150,150,13919), (166,150,150,13984), (166,155,155,14048), (167,166,166,14113), (169,169,169,14177), (169,169,169,14242), (169,169,169,14306), (181,181,181,14371), (181,181,181,14435), (181,181,181,14500), (186,186,186,14564), (193,193,193,14629), (193,193,193,14693), (193,193,193,14758), (199,199,199,14822), (205,205,205,14887), (205,205,205,14951), (205,205,205,15016), (212,212,212,15080), (218,218,218,15145), (218,218,218,15210), (218,218,218,15274), (230,230,230,15339), (230,230,230,15403), (230,230,230,15468), (230,230,230,15532), (239,239,239,15597), (243,243,243,15661), (243,243,243,15726), (247,247,247,15790), (255,255,255,15855), (255,255,255,15919), (255,255,255,15984))
_LUT = np.array(CTH_LUT, dtype=np.float64)


def decode_clm(rgba: np.ndarray) -> np.ndarray:
    """Máscara de nubes de EUMETView (blanco = nube, verde = tierra despejada, azul = agua despejada) → 0–1 (NaN sin dato)."""
    a = rgba[..., 3]
    w = rgba[..., :3].min(axis=-1) / 255.0                 # los bordes suavizados quedan a medias
    return np.where(a < 128, np.nan, w)


def decode_cth(rgba: np.ndarray) -> np.ndarray:
    """Altura del tope de EUMETView (escala de colores de su leyenda, 320–16 000 m) → metros (NaN sin nube)."""
    rgb = rgba[..., :3].reshape(-1, 3).astype(np.float64)
    d = ((rgb[:, None, :] - _LUT[None, :, :3]) ** 2).sum(axis=-1)
    h = _LUT[d.argmin(axis=1), 3].reshape(rgba.shape[:2])
    return np.where(rgba[..., 3] < 128, np.nan, h)


_eum_times: dict = {}


def eum_latest_time(ws: str) -> Optional[str]:
    hit = _eum_times.get(ws)
    if hit and time.time() - hit[0] < LIST_TTL_S:
        return hit[1]
    r = _http().get(f"{EUMETVIEW}/{ws}/clm/ows", params={"service": "WMS", "request": "GetCapabilities", "version": "1.3.0"})
    r.raise_for_status()
    m = re.search(r'<Dimension[^>]*name="time"[^>]*>([^<]+)<', r.text)
    t = m.group(1).strip().split(",")[-1].split("/")[1] if m and "/" in m.group(1) else (m.group(1).strip().split(",")[-1] if m else None)
    _eum_times[ws] = (time.time(), t)
    return t


def read_eum(src: dict, lat, lon, lat0: float, lon0: float):
    from PIL import Image
    t = eum_latest_time(src["ws"])
    dlat = (R_KM + 6) / 111.32; dlon = (R_KM + 6) / (111.32 * max(0.05, math.cos(math.radians(lat0))))
    bbox = (lat0 - dlat, lon0 - dlon, lat0 + dlat, lon0 + dlon)
    W = H = 320

    def get(layer):
        q = {"service": "WMS", "version": "1.3.0", "request": "GetMap", "layers": f"{src['ws']}:{layer}", "styles": "",
             "crs": "EPSG:4326", "bbox": ",".join(f"{v:.5f}" for v in bbox), "width": W, "height": H,
             "format": "image/png", "transparent": "true"}
        if t:
            q["time"] = t
        r = _http().get(f"{EUMETVIEW}/wms", params=q); r.raise_for_status()
        if not r.headers.get("content-type", "").startswith("image/"):
            raise RuntimeError(f"EUMETView no devolvió imagen para {layer}")
        return np.asarray(Image.open(io.BytesIO(r.content), formats=["PNG"]).convert("RGBA"))

    clm, cth = get("clm"), get("cth")
    # píxel de cada muestra (la imagen va de norte a sur y de oeste a este)
    cols = np.clip(((lon - bbox[1]) / (bbox[3] - bbox[1]) * W).astype(int), 0, W - 1)
    rows = np.clip(((bbox[2] - lat) / (bbox[2] - bbox[0]) * H).astype(int), 0, H - 1)
    cloud = decode_clm(clm)[rows, cols]
    top = decode_cth(cth)[rows, cols]
    t0 = datetime.fromisoformat(t.replace("Z", "+00:00")) if t else None
    return cloud, top, None, t0


# ── servicio ──────────────────────────────────────────────────────────────────────────────────────────────
_results: "OrderedDict[tuple, tuple]" = OrderedDict()
_res_lock = threading.Lock()


def clouds_now(lat: float, lon: float, ground_m: float = 0.0, now: Optional[datetime] = None) -> dict:
    """Las nubes de ahora alrededor del lugar (ver la cabecera). Lanza si no hay satélite o el proveedor falla."""
    src = pick_source(lat, lon)
    if not src:
        raise LookupError("ningún satélite geoestacionario ve bien este lugar (cerca de los polos)")
    now = now or datetime.now(timezone.utc)
    key = (src["id"], round(lat, 2), round(lon, 2), int(round(ground_m / 100.0)))
    with _res_lock:
        hit = _results.get(key)
        if hit and time.time() - hit[0] < TTL_S:
            return hit[1]
    la, lo = sample_points(lat, lon)
    if src["kind"] == "goes":
        cloud, top, phase, t0 = read_goes(src, la, lo, now)
    elif src["kind"] == "ahi":
        cloud, top, phase, t0 = read_ahi(src, la, lo, now)
    else:
        cloud, top, phase, t0 = read_eum(src, la, lo, lat, lon)
    cls = classify(cloud, top, ground_m, phase)
    layers, total, valid = to_grid(cls, top)
    out = {
        "source": src["id"], "sat": src["sat"], "by": src["by"],
        "time": t0.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if t0 else None,
        "radius_km": R_KM, "res_km": RES_KM, "n": N, "ground_m": round(ground_m), "cover": total,
        "valid": round(valid, 3), "layers": layers,
    }
    with _res_lock:
        _results[key] = (time.time(), out)
        while len(_results) > 300:
            _results.popitem(last=False)
    return out


@router.get("/clouds-sat")
async def clouds_sat(response: Response,
                     lat: float = Query(..., ge=-90.0, le=90.0),
                     lon: float = Query(..., ge=-180.0, le=180.0),
                     ground: float = Query(0.0, ge=-500.0, le=9000.0)):
    """Nubes de ahora en 150 km a la redonda, por capas (satélites geoestacionarios; ver app/cloudsat.py)."""
    try:
        data = await run_in_threadpool(clouds_now, lat, lon, ground)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:                                       # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se pudieron leer las nubes del satélite: {e}")
    response.headers["Cache-Control"] = "public, max-age=300"
    return data
