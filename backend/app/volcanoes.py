"""
volcanoes.py — los volcanes del Holoceno del Smithsonian, para la ficha de un volcán del horizonte.

  GET /api/volcanoes?lat=<grados>&lon=<grados>[&r_km=<km>]

Fuente: Global Volcanism Program, Smithsonian Institution, base «Volcanoes of the World» (VOTW), por su servicio
web WFS (GeoServer, GeoJSON, sin clave): https://volcano.si.edu/database/webservices.cfm. Unos 1200 volcanes con
erupciones en los últimos ~12 000 años: tipo, última erupción, entorno tectónico, roca principal, país y región.

Condiciones: el Smithsonian invita a usar su contenido con fines personales, educativos y no comerciales
(https://volcano.si.edu/gvp_termsofuse.cfm). Por eso la base NO se guarda en el repositorio (que es AGPL y otros
podrían reutilizar con otros fines): se lee en vivo y se guarda en memoria un día. Tampoco se copia el resumen
geológico ni las fotos (tienen sus propios autores): la ficha enlaza a la página del volcán en el Smithsonian.
Cita: Global Volcanism Program, Smithsonian Institution, https://volcano.si.edu/.

Devuelve solo los volcanes a menos de r_km (por defecto 220 km: lo que alcanza el horizonte, app/horizon.py).
"""

import asyncio
import math
import time
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Response

from app.cache import provider_headers

WFS = ("https://webservices.volcano.si.edu/geoserver/GVP-VOTW/wfs?service=WFS&version=2.0.0&request=GetFeature"
       "&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json")
WFS_ERUPTIONS = ("https://webservices.volcano.si.edu/geoserver/GVP-VOTW/wfs?service=WFS&version=2.0.0&request=GetFeature"
                 "&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Eruptions&outputFormat=application/json"
                 "&propertyName=Volcano_Number,ExplosivityIndexMax,StartDateYear,EndDateYear,EndDateYearModifier,Activity_Type")
SOURCE = "Global Volcanism Program, Smithsonian Institution (Volcanoes of the World), https://volcano.si.edu/"
TTL_S = 24 * 3600
RETRY_S = 15 * 60          # si falló la descarga, no se reintenta antes
TIMEOUT_S = 40.0
R_EARTH = 6371.0

router = APIRouter(prefix="/api", tags=["volcanoes"])
_transport: Optional[httpx.AsyncBaseTransport] = None
_cache = {"at": 0.0, "list": None, "failed_at": 0.0, "error": None}
_lock = asyncio.Lock()


def _num(v):
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def slim(props: dict) -> Optional[dict]:
    """Un volcán de la WFS → lo que usa la ficha (sin resumen ni foto: ver la cabecera)."""
    la, lo = _num(props.get("Latitude")), _num(props.get("Longitude"))
    num = props.get("Volcano_Number")
    if la is None or lo is None or num is None:
        return None
    year = _num(props.get("Last_Eruption_Year"))
    elev = _num(props.get("Elevation"))
    return {
        "id": int(num), "name": (props.get("Volcano_Name") or "").strip(),
        "lat": round(la, 4), "lon": round(lo, 4),
        "elev_m": int(round(elev)) if elev is not None else None,
        "type": props.get("Primary_Volcano_Type") or None,
        "landform": props.get("Volcanic_Landform") or None,
        "last_year": int(year) if year is not None else None,
        "evidence": props.get("Evidence_Category") or None,
        "tectonic": props.get("Tectonic_Setting") or None,
        "rock": props.get("Major_Rock_Type") or None,
        "country": props.get("Country") or None,
        "region": props.get("Subregion") or props.get("Region") or None,
        "url": f"https://volcano.si.edu/volcano.cfm?vn={int(num)}",
    }


def parse(geojson: dict) -> list:
    out = []
    for f in (geojson or {}).get("features") or []:
        v = slim((f or {}).get("properties") or {})
        if v:
            out.append(v)
    return out


def last_eruptions(geojson: dict, year_now: int) -> dict:
    """Erupciones → por volcán, la última confirmada: { vei, start, end, erupting }. erupting: el Smithsonian la da por
    continuada (fin con el modificador «>», como el Reventador desde 2008 o el Sangay desde 2019) o acabó este año."""
    best = {}
    for f in (geojson or {}).get("features") or []:
        p = (f or {}).get("properties") or {}
        num, y = p.get("Volcano_Number"), _num(p.get("StartDateYear"))
        if num is None or y is None or (p.get("Activity_Type") or "").lower().startswith("discredited"):
            continue
        cur = best.get(num)
        if cur is None or y > cur["start"]:
            vei, end = _num(p.get("ExplosivityIndexMax")), _num(p.get("EndDateYear"))
            best[num] = {"vei": int(vei) if vei is not None else None, "start": int(y),
                         "end": int(end) if end is not None else None,
                         "erupting": (p.get("EndDateYearModifier") or "").strip() == ">" or (end is not None and end >= year_now)}
    return best


def dist_km(la1, lo1, la2, lo2) -> float:
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = p2 - p1, math.radians(lo2 - lo1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R_EARTH * math.asin(min(1.0, math.sqrt(a)))


def near(volcs: list, lat: float, lon: float, r_km: float) -> list:
    out = []
    for v in volcs:
        if abs(v["lat"] - lat) > r_km / 100.0 + 0.5:            # descarte rápido (1° ≈ 111 km)
            continue
        d = dist_km(lat, lon, v["lat"], v["lon"])
        if d <= r_km:
            out.append({**v, "dist_km": round(d, 1)})
    out.sort(key=lambda v: v["dist_km"])
    return out


async def load() -> list:
    now = time.time()
    if _cache["list"] is not None and now - _cache["at"] < TTL_S:
        return _cache["list"]
    async with _lock:
        if _cache["list"] is not None and time.time() - _cache["at"] < TTL_S:
            return _cache["list"]
        if _cache["list"] is None and time.time() - _cache["failed_at"] < RETRY_S:
            raise RuntimeError(_cache["error"] or "sin respuesta")
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_S, transport=_transport, headers=provider_headers()) as client:
                r, re_ = await asyncio.gather(client.get(WFS), client.get(WFS_ERUPTIONS), return_exceptions=True)
                if isinstance(r, Exception) or r.status_code != 200:
                    raise RuntimeError(str(r) if isinstance(r, Exception) else f"HTTP {r.status_code}")
                volcs = parse(r.json())
                # la última erupción de cada uno (VEI y si sigue): si esta capa falla, los volcanes van sin ella
                try:
                    if not isinstance(re_, Exception) and re_.status_code == 200:
                        last = last_eruptions(re_.json(), time.gmtime().tm_year)
                        for v in volcs:
                            e = last.get(v["id"])
                            if e:
                                v.update(last_vei=e["vei"], last_start=e["start"], last_end=e["end"], erupting=e["erupting"])
                except Exception:                                # noqa: BLE001
                    pass
            if not volcs:
                raise RuntimeError("respuesta sin volcanes")
            _cache.update(at=time.time(), list=volcs, error=None)
        except Exception as e:                                   # noqa: BLE001
            _cache.update(failed_at=time.time(), error=str(e) or type(e).__name__)
            if _cache["list"] is not None:                       # la copia vieja sirve mientras tanto
                return _cache["list"]
            raise
    return _cache["list"]


@router.get("/volcanoes")
async def volcanoes(response: Response,
                    lat: float = Query(..., ge=-90.0, le=90.0),
                    lon: float = Query(..., ge=-180.0, le=180.0),
                    r_km: float = Query(220.0, ge=1.0, le=1000.0)):
    """Volcanes del Holoceno a menos de r_km del lugar, del más cercano al más lejano (Smithsonian, GVP)."""
    try:
        volcs = await load()
    except Exception as e:                                       # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se pudo leer la base de volcanes del Smithsonian: {e}")
    response.headers["Cache-Control"] = "public, max-age=86400"
    return {"source": SOURCE, "volcanoes": near(volcs, lat, lon, r_km)}
