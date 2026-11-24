"""
aurora.py — auroras de ahora y actividad geomagnética, con datos reales de NOAA SWPC.

Sin IA y sin modelo propio: el servidor solo descarga, valida, recorta y resume. El dibujo de las
cortinas (alturas de emisión, colores, perspectiva) lo hace el navegador (src/sky/aurora.js).

Fuentes (formatos verificados el 23-nov-2026):

  1. Pronóstico inmediato de auroras — modelo OVATION Prime de NOAA SWPC (se renueva cada pocos
     minutos y vale para los próximos ~30–90 min):
       GET https://services.swpc.noaa.gov/json/ovation_aurora_latest.json
     {"Observation Time": "2026-11-24T03:42:00Z", "Forecast Time": "2026-11-24T05:03:00Z",
      "Data Format": "[Longitude, Latitude, Aurora]", "coordinates": [[0, -90, 1], ...]}
     Malla de 1° (longitud 0–359 este, latitud −90…90): 65 160 celdas. «Aurora» es la
     probabilidad (%) de ver aurora en esa celda, de 0 a 100.
  2. Índice Kp planetario observado, estimado y pronosticado (cada 3 h, unos 3 días hacia delante):
       GET https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json
     [{"time_tag": "2026-11-24T03:00:00", "kp": 1.33, "observed": "estimated", "noaa_scale": null}, ...]
     `observed` vale "observed", "estimated" o "predicted"; time_tag en UTC sin zona.

GET /api/aurora?lat=&lon= devuelve la franja de la malla que se puede ver desde el lugar (±35° de latitud,
todas las longitudes) como bytes en base64, la probabilidad en el lugar, la celda con aurora más cercana
(distancia y rumbo) y la serie de Kp. Cada bloque viaja con su fuente y su hora.
"""

import base64
import math
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Response

from app.cache import ProviderError, Resource, iso_utc, provider_headers

OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json"
KP_FORECAST_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json"
SOURCE = "NOAA SWPC"
PAGE = "https://www.swpc.noaa.gov/products/aurora-30-minute-forecast"
KP_PAGE = "https://www.swpc.noaa.gov/products/planetary-k-index"

NLAT, NLON = 181, 360            # malla de 1°: latitudes −90…90, longitudes 0…359
BAND = 35                         # grados de latitud a cada lado del lugar que se envían
OVAL_MIN = 10                     # % desde el que una celda cuenta como «óvalo» para la distancia
EARTH_KM = 6371.0
_TIMEOUT = 25.0

router = APIRouter(prefix="/api/aurora", tags=["aurora"])


def _iso_z(s) -> Optional[str]:
    if not isinstance(s, str) or not s.strip():
        return None
    try:
        d = datetime.fromisoformat(s.strip().rstrip("Z"))
    except ValueError:
        return None
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


async def _get_json(url: str):
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(url, headers={"Accept": "application/json", **provider_headers()})
    status = getattr(resp, "status_code", 200)
    if status >= 400:
        raise RuntimeError(f"{url.split('/')[2]} respondió HTTP {status}")
    return resp.json()


# ─── OVATION ──────────────────────────────────────────────────────────────
def normalize_ovation(raw) -> dict:
    """JSON de OVATION → {observed, forecast, grid: bytearray(181·360)} con fila = latitud + 90."""
    if not isinstance(raw, dict) or not isinstance(raw.get("coordinates"), list):
        raise ValueError("NOAA SWPC devolvió el pronóstico de auroras en un formato inesperado")
    grid = bytearray(NLAT * NLON)
    n = 0
    for c in raw["coordinates"]:
        if not isinstance(c, (list, tuple)) or len(c) < 3:
            continue
        try:
            lon, lat, p = int(round(float(c[0]))), int(round(float(c[1]))), float(c[2])
        except (TypeError, ValueError):
            continue
        if not (-90 <= lat <= 90) or p != p:
            continue
        lon %= 360
        grid[(lat + 90) * NLON + lon] = max(0, min(100, int(round(p))))
        n += 1
    if n < NLAT * NLON * 0.9:
        raise ValueError(f"el pronóstico de auroras trae solo {n} celdas")
    return {"observed": _iso_z(raw.get("Observation Time")), "forecast": _iso_z(raw.get("Forecast Time")),
            "grid": grid}


async def _fetch_ovation() -> dict:
    return normalize_ovation(await _get_json(OVATION_URL))


# ─── Kp ───────────────────────────────────────────────────────────────────
def normalize_kp_forecast(raw) -> list:
    """Serie de Kp → [{t, kp, kind}] en orden cronológico (kind: observed | estimated | predicted)."""
    if not isinstance(raw, list):
        raise ValueError("NOAA SWPC devolvió el pronóstico de Kp en un formato inesperado")
    out = []
    for r in raw:
        if isinstance(r, dict):
            t, kp, kind = r.get("time_tag"), r.get("kp"), r.get("observed")
        elif isinstance(r, list) and len(r) >= 3 and r[0] != "time_tag":   # formato antiguo (filas)
            t, kp, kind = r[0], r[1], r[2]
        else:
            continue
        t = _iso_z(t)
        try:
            kp = float(kp)
        except (TypeError, ValueError):
            continue
        if not t or not (0 <= kp <= 9) or kind not in ("observed", "estimated", "predicted"):
            continue
        out.append({"t": t, "kp": round(kp, 2), "kind": kind})
    out.sort(key=lambda x: x["t"])
    if not out:
        raise ValueError("el pronóstico de Kp no trae valores")
    return out


async def _fetch_kp() -> list:
    return normalize_kp_forecast(await _get_json(KP_FORECAST_URL))


ovation = Resource("aurora_ovation", _fetch_ovation, ttl=8 * 60, wait=20.0, retry_after=3 * 60)
kp_forecast = Resource("aurora_kp", _fetch_kp, ttl=30 * 60, wait=15.0, retry_after=5 * 60)


def status() -> dict:
    return {"ovation": ovation.status(), "kp": kp_forecast.status()}


# ─── Resúmenes ────────────────────────────────────────────────────────────
def prob_at(grid, lat: float, lon: float) -> float:
    """Probabilidad (%) en un punto, interpolada entre las cuatro celdas vecinas."""
    y = max(-90.0, min(90.0, lat)) + 90.0
    x = lon % 360.0
    y0, x0 = int(math.floor(y)), int(math.floor(x))
    y1, x1 = min(NLAT - 1, y0 + 1), (x0 + 1) % NLON
    fy, fx = y - y0, x - x0
    g = lambda r, c: grid[r * NLON + c]
    a = g(y0, x0) * (1 - fx) + g(y0, x1) * fx
    b = g(y1, x0) * (1 - fx) + g(y1, x1) * fx
    return a * (1 - fy) + b * fy


def _dist_bearing(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    c = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    d = 2 * EARTH_KM * math.asin(min(1.0, math.sqrt(c)))
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return d, (math.degrees(math.atan2(y, x)) + 360) % 360


_OVAL_CELLS: dict = {}


def _oval_cells(grid, min_p: int):
    """Celdas con probabilidad ≥ min_p, calculadas una vez por malla."""
    key = (id(grid), min_p)
    if key not in _OVAL_CELLS:
        _OVAL_CELLS.clear()
        cells = []
        for r in range(NLAT):
            base = r * NLON
            for c in range(NLON):
                p = grid[base + c]
                if p >= min_p:
                    cells.append((r - 90, c, p))
        _OVAL_CELLS[key] = cells
    return _OVAL_CELLS[key]


def nearest_oval(grid, lat: float, lon: float, min_p: int = OVAL_MIN) -> Optional[dict]:
    """Celda del mismo hemisferio con probabilidad ≥ min_p más cercana: {km, bearing, lat, lon, p}."""
    best = None
    for la, c, p in _oval_cells(grid, min_p):
        if (la >= 0) != (lat >= 0):
            continue
        if True:
            d, b = _dist_bearing(lat, lon, la, c)
            if best is None or d < best["km"]:
                best = {"km": round(d), "bearing": round(b), "lat": la, "lon": c if c <= 180 else c - 360, "p": p}
    return best


def band(grid, lat: float):
    """Filas de la malla visibles desde el lugar: (lat_min, lat_max, bytes)."""
    lo = max(-90, int(math.floor(lat)) - BAND)
    hi = min(90, int(math.ceil(lat)) + BAND)
    return lo, hi, bytes(grid[(lo + 90) * NLON:(hi + 91) * NLON])


def kp_now(series: list, now: datetime) -> Optional[dict]:
    """Último Kp observado o estimado hasta ahora."""
    t = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    last = None
    for r in series:
        if r["t"] <= t and r["kind"] in ("observed", "estimated"):
            last = r
    return last


async def _safe(res: Resource):
    try:
        data, stale = await res.get()
        return data, stale, None
    except ProviderError as e:
        return None, False, str(e) or "proveedor no disponible"
    except Exception as e:  # una fuente nunca tumba la respuesta
        return None, False, f"{type(e).__name__}: {e}"


async def build(lat: float, lon: float, now: Optional[datetime] = None) -> dict:
    now = now or datetime.now(timezone.utc)
    ov, ov_stale, ov_err = await _safe(ovation)
    kps, kp_stale, kp_err = await _safe(kp_forecast)
    out = {"lat": round(lat, 3), "lon": round(lon, 3), "ovation": None, "kp": None, "errors": {},
           "sources": [
               {"id": "ovation", "name": f"{SOURCE} · OVATION", "url": PAGE, "data_url": OVATION_URL,
                "ok": ov is not None, "stale": ov_stale, "updated": iso_utc(ovation.ts) if ov else None},
               {"id": "kp", "name": f"{SOURCE} · Kp", "url": KP_PAGE, "data_url": KP_FORECAST_URL,
                "ok": kps is not None, "stale": kp_stale, "updated": iso_utc(kp_forecast.ts) if kps else None},
           ]}
    if ov is not None:
        g = ov["grid"]
        lo, hi, rows = band(g, lat)
        out["ovation"] = {
            "observed": ov["observed"], "forecast": ov["forecast"],
            "lat_min": lo, "lat_max": hi, "lon_count": NLON,
            "grid_b64": base64.b64encode(rows).decode("ascii"),
            "here": round(prob_at(g, lat, lon), 1),
            "nearest": nearest_oval(g, lat, lon),
            "max": max(rows) if rows else 0,
        }
    else:
        out["errors"]["ovation"] = ov_err
    if kps is not None:
        out["kp"] = {"now": kp_now(kps, now), "series": kps}
    else:
        out["errors"]["kp"] = kp_err
    return out


@router.get("")
async def aurora(response: Response, lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=360)):
    data = await build(lat, lon)
    if data["ovation"] is None and data["kp"] is None:
        raise HTTPException(status_code=503, detail={"errors": data["errors"]})
    response.headers["Cache-Control"] = "public, max-age=300"
    return data
