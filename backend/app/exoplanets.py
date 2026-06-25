"""
exoplanets.py — Exoplanetas reales del NASA Exoplanet Archive (en vivo).

Consulta la tabla pscomppars (parámetros compuestos por planeta) vía el
servicio TAP de la NASA y devuelve una lista compacta con dirección en el
cielo, distancia real y una marca de 'potencialmente habitable' calculada
con una heurística de zona habitable (radio rocoso + insolación tipo Tierra).
La IA no inventa nada: los números vienen del archivo oficial de la NASA.
"""

import math
import time
from typing import Optional

import httpx

TAP_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
QUERY = (
    "select pl_name,hostname,ra,dec,sy_dist,pl_rade,pl_insol,pl_eqt,disc_year "
    "from pscomppars where ra is not null and dec is not null and sy_dist is not null"
)

PC_TO_LY = 3.2615638
_cache = {"data": None, "ts": 0.0}
_TTL = 86400  # 24 h


def _is_habitable(rade: Optional[float], insol: Optional[float]) -> bool:
    # Heurística conservadora de zona habitable para planetas rocosos.
    if rade is None or insol is None:
        return False
    return 0.5 <= rade <= 1.8 and 0.32 <= insol <= 1.55


async def get_exoplanets() -> dict:
    now = time.time()
    if _cache["data"] and now - _cache["ts"] < _TTL:
        return _cache["data"]

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.get(TAP_URL, params={"query": QUERY, "format": "json"})
        resp.raise_for_status()
        rows = resp.json()

    out = []
    for row in rows:
        try:
            ra = math.radians(float(row["ra"]))
            dec = math.radians(float(row["dec"]))
        except (TypeError, ValueError):
            continue
        try:
            dist_ly = round(float(row["sy_dist"]) * PC_TO_LY, 1)
        except (TypeError, ValueError):
            dist_ly = 0

        def _f(key):
            v = row.get(key)
            try:
                return float(v)
            except (TypeError, ValueError):
                return None

        rade = _f("pl_rade")
        insol = _f("pl_insol")
        out.append({
            "name": row.get("pl_name"),
            "host": row.get("hostname"),
            "nx": round(math.cos(dec) * math.cos(ra), 5),
            "ny": round(math.cos(dec) * math.sin(ra), 5),
            "nz": round(math.sin(dec), 5),
            "dist_ly": dist_ly,
            "rade": rade,
            "hab": _is_habitable(rade, insol),
        })

    result = {
        "count": len(out),
        "habitable": sum(1 for o in out if o["hab"]),
        "source": "NASA Exoplanet Archive (pscomppars). Habitabilidad: heurística de zona habitable.",
        "objects": out,
    }
    _cache["data"] = result
    _cache["ts"] = now
    return result
