"""
asteroids.py — Asteroides y cometas que pasan cerca de la Tierra.

Fuente: NASA/JPL CNEOS — SBDB Close-Approach Data API (v1.5)
  GET https://ssd-api.jpl.nasa.gov/cad.api
  Documentación: https://ssd-api.jpl.nasa.gov/doc/cad.html

Política de uso de las API de JPL SSD (https://ssd-api.jpl.nasa.gov/doc/):
una sola petición a la vez, cachear y no repetir consultas, y retroceder
ante errores. Por eso la consulta pasa por la misma cola que Horizons y se
hace UNA sola consulta por refresco con la ventana máxima que admite Teseo
(60 días, 20 distancias lunares, ~40–50 objetos) y los parámetros `days` y
`dist_ld` de cada visitante se filtran localmente sobre esa caché (6 h).

Notas de honestidad científica:
  * JPL da el instante del máximo acercamiento en tiempo TDB; aquí se
    convierte a UTC restando 69,184 s (TDB−UTC vigente desde 2017: 32,184 s
    de TT−TAI más 37 segundos intercalares).
  * `diameter_m` solo aparece si JPL tiene un diámetro MEDIDO. Para casi
    todos los objetos pequeños no lo hay, así que `diameter_est_m` es una
    ESTIMACIÓN a partir de la magnitud absoluta H:

        D [km] = 1329 / sqrt(p) × 10^(−H/5)

    con albedos p = 0,25 (objeto brillante → tamaño mínimo) y p = 0,05
    (objeto oscuro → tamaño máximo). Es la misma relación que usa CNEOS; el
    tamaño real puede quedar fuera del intervalo si el albedo es atípico.
"""

import math
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

from app import nasa_horizons
from app.cache import Resource, iso_utc, provider_headers

CAD_URL = "https://ssd-api.jpl.nasa.gov/cad.api"
SOURCE = "NASA/JPL CNEOS — SBDB Close-Approach Data"

AU_KM = 149_597_870.7      # 1 au (definición IAU 2012), en km
LD_KM = 384_400.0          # 1 distancia lunar (semieje mayor medio de la Luna), en km
TDB_MINUS_UTC_S = 69.184   # 32,184 s (TT−TAI) + 37 s intercalares (desde 2017)

MAX_DAYS = 60
MAX_DIST_LD = 20.0
ALBEDO_BRIGHT = 0.25       # -> diámetro mínimo
ALBEDO_DARK = 0.05         # -> diámetro máximo
DIAMETER_EST_METHOD = (
    "Estimación: D = 1329 km / sqrt(p) × 10^(−H/5), con albedo p = 0,25 "
    "(mínimo) y p = 0,05 (máximo). No es una medida."
)

_TTL = 6 * 3600
_TIMEOUT = 20.0


def diameter_from_h_km(h: float, albedo: float) -> float:
    """Diámetro (km) de un asteroide a partir de su magnitud absoluta H y un
    albedo geométrico supuesto: D = 1329 / sqrt(p) × 10^(−H/5)."""
    return 1329.0 / math.sqrt(albedo) * 10 ** (-h / 5.0)


def estimate_diameter_m(h: Optional[float]) -> Optional[list]:
    """[mínimo, máximo] en metros para albedos 0,25 y 0,05; None sin H."""
    if h is None:
        return None
    return [
        round(diameter_from_h_km(h, ALBEDO_BRIGHT) * 1000.0, 1),
        round(diameter_from_h_km(h, ALBEDO_DARK) * 1000.0, 1),
    ]


def jd_tdb_to_utc(jd_tdb: float) -> datetime:
    """Fecha juliana TDB -> datetime UTC (al segundo)."""
    unix = (jd_tdb - 2440587.5) * 86400.0 - TDB_MINUS_UTC_S
    return datetime.fromtimestamp(round(unix), tz=timezone.utc)


def _float(v) -> Optional[float]:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _clean_name(fullname, des) -> str:
    """'       (2026 VP8)' -> '2026 VP8';  ' 99942 Apophis (2004 MN4)' igual."""
    name = (fullname or "").strip()
    if name.startswith("(") and name.endswith(")"):
        name = name[1:-1].strip()
    return name or str(des or "").strip()


def _parse(payload: dict) -> list:
    """Respuesta de cad.api -> lista de objetos con la forma del contrato.
    Cada objeto lleva además `_ts` (instante Unix) para filtrar; no se sirve."""
    if not isinstance(payload, dict) or "count" not in payload:
        raise RuntimeError("JPL CAD devolvió una respuesta inesperada")
    if int(payload.get("count") or 0) == 0:
        return []  # con count 0, JPL no envía ni `fields` ni `data`
    fields = payload.get("fields") or []
    idx = {name: i for i, name in enumerate(fields)}
    for needed in ("des", "jd", "dist", "v_rel"):
        if needed not in idx:
            raise RuntimeError(f"JPL CAD: falta el campo '{needed}'")

    def col(row, name):
        i = idx.get(name)
        return row[i] if i is not None and i < len(row) else None

    out = []
    for row in payload.get("data") or []:
        try:
            jd, dist_au, v_rel = _float(col(row, "jd")), _float(col(row, "dist")), _float(col(row, "v_rel"))
            if jd is None or dist_au is None or v_rel is None:
                continue
            when = jd_tdb_to_utc(jd)
            dist_km = dist_au * AU_KM
            h = _float(col(row, "h"))
            diameter_km = _float(col(row, "diameter"))
            out.append({
                "name": _clean_name(col(row, "fullname"), col(row, "des")),
                "date": when.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "dist_ld": round(dist_km / LD_KM, 3),
                "dist_km": round(dist_km),
                "dist_au": round(dist_au, 7),
                "v_rel_km_s": round(v_rel, 2),
                "h": h,
                "diameter_m": round(diameter_km * 1000.0, 1) if diameter_km is not None else None,
                "diameter_est_m": estimate_diameter_m(h),
                "_ts": when.timestamp(),
            })
        except Exception:
            continue  # una fila rara no tumba la lista entera
    out.sort(key=lambda o: o["_ts"])
    return out


async def _fetch() -> list:
    params = {
        "date-min": "now",
        "date-max": f"+{MAX_DAYS}",
        "dist-max": f"{MAX_DIST_LD:g}LD",
        "sort": "date",
        "fullname": "true",
        "diameter": "true",
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=provider_headers()) as client:
        # Misma cola que Horizons: JPL exige una sola petición a la vez.
        async with nasa_horizons._get_lock():
            resp = await client.get(CAD_URL, params=params)
    status = getattr(resp, "status_code", 200)
    if status >= 400:
        raise RuntimeError(f"JPL CAD respondió HTTP {status}")
    return _parse(resp.json())


resource = Resource("asteroids", _fetch, ttl=_TTL, wait=22.0, retry_after=120.0)


async def get_asteroids(days: int = 30, dist_ld: float = 10.0) -> dict:
    objects, stale = await resource.get()
    now = time.time()
    until = now + days * 86400.0
    selected = [
        {k: v for k, v in o.items() if k != "_ts"}
        for o in objects
        if now <= o["_ts"] <= until and o["dist_ld"] <= dist_ld
    ]
    return {
        "source": SOURCE,
        "updated": iso_utc(resource.ts),
        "stale": stale,
        "count": len(selected),
        "objects": selected,
        # Extras opcionales: parámetros aplicados y cómo se estima el tamaño.
        "days": days,
        "dist_ld": dist_ld,
        "diameter_est_method": DIAMETER_EST_METHOD,
    }
