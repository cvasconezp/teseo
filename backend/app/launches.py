"""
launches.py — Próximos lanzamientos orbitales de todas las agencias y empresas.

Fuente: Launch Library 2 (The Space Devs) — https://thespacedevs.com/llapi
  GET https://ll.thespacedevs.com/2.3.0/launches/upcoming/

Condiciones del proveedor (verificadas en su web y su FAQ oficial):
  * sin clave: hasta 15 peticiones por hora y por IP;
  * recomiendan expresamente que el servidor cachee y sirva a sus clientes
    en vez de que cada cliente llame a la API;
  * con clave (Patreon): cabecera `Authorization: Token <clave>`.

Por eso aquí sale UNA sola petición por refresco (siempre los 20 próximos;
`limit` solo recorta lo ya cacheado), con caché de 30 minutos, pausa de
5 minutos tras un fallo y `stale` si el proveedor cae.

El endpoint `upcoming` incluye también los lanzamientos de las últimas 24 h
(ya con estado "Success"/"Failure"): es deliberado, permite mostrar
"lanzado hoy".
"""

import os
from typing import Optional

import httpx

from app.cache import Resource, iso_utc, provider_headers

LL2_URL = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/"
SOURCE = "The Space Devs — Launch Library 2"
MAX_LIMIT = 20
_TTL = 30 * 60          # 30 min  -> 2 peticiones/hora en régimen normal
_RETRY_AFTER = 5 * 60   # tras un fallo: como mucho 12 peticiones/hora
_TIMEOUT = 20.0         # el modo detallado pesa ~0,7 MB y tarda 5–8 s


def _get(obj, *path):
    """Lectura tolerante de claves anidadas: devuelve None si algo falta."""
    for key in path:
        if not isinstance(obj, dict):
            return None
        obj = obj.get(key)
    return obj


def _str(v) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _best_url(*lists) -> Optional[str]:
    """Primera URL disponible, por prioridad del proveedor (número menor =
    más prioritaria). Acepta listas de objetos {url, priority} o de cadenas."""
    for items in lists:
        if not isinstance(items, list) or not items:
            continue
        cands = []
        for i, it in enumerate(items):
            if isinstance(it, str):
                url, prio = it, 0
            elif isinstance(it, dict):
                url, prio = it.get("url"), it.get("priority")
            else:
                continue
            if _str(url):
                cands.append((prio if isinstance(prio, (int, float)) else 999, i, url.strip()))
        if cands:
            return sorted(cands)[0][2]
    return None


def _normalize(raw: dict) -> Optional[dict]:
    """Un lanzamiento de LL2 (v2.3.0) -> forma del contrato de Teseo.
    Devuelve None si le falta lo imprescindible (id, nombre o fecha)."""
    lid, name, net = _str(raw.get("id")), _str(raw.get("name")), _str(raw.get("net"))
    if not (lid and name and net):
        return None
    mission = raw.get("mission") if isinstance(raw.get("mission"), dict) else {}
    image = raw.get("image") if isinstance(raw.get("image"), dict) else {}
    rocket = (
        _str(_get(raw, "rocket", "configuration", "full_name"))
        or _str(_get(raw, "rocket", "configuration", "name"))
        or name.split("|")[0].strip()
    )
    return {
        "id": lid,
        "name": name,
        "net": net,  # LL2 ya lo da en ISO 8601 UTC ("...Z")
        "net_precision": _str(_get(raw, "net_precision", "name")),
        "status": _str(_get(raw, "status", "abbrev")) or "TBD",
        "status_name": _str(_get(raw, "status", "name")) or "To Be Determined",
        "provider": _str(_get(raw, "launch_service_provider", "name")) or "—",
        "provider_type": _str(_get(raw, "launch_service_provider", "type", "name")),
        "rocket": rocket,
        "pad": _str(_get(raw, "pad", "name")),
        "location": _str(_get(raw, "pad", "location", "name")),
        "country_code": (
            _str(_get(raw, "pad", "country", "alpha_2_code"))
            or _str(_get(raw, "pad", "location", "country", "alpha_2_code"))
        ),
        "mission": _str(mission.get("name")),
        "mission_type": _str(mission.get("type")),
        "orbit": _str(_get(mission, "orbit", "name")),
        "description": _str(mission.get("description")),
        "webcast_url": _best_url(raw.get("vid_urls"), mission.get("vid_urls")),
        "info_url": _best_url(raw.get("info_urls"), mission.get("info_urls")),
        "image": _str(image.get("image_url")),
        "image_credit": _str(image.get("credit")),
        # Extra opcional (no está en el contrato mínimo): miniatura ligera.
        "image_thumbnail": _str(image.get("thumbnail_url")),
    }


async def _fetch() -> list:
    headers = {"Accept": "application/json", **provider_headers()}
    key = os.environ.get("LL2_API_KEY", "").strip()
    if key:
        headers["Authorization"] = f"Token {key}"
    params = {
        "limit": MAX_LIMIT,
        "mode": "detailed",            # único modo que trae las URL de retransmisión
        "format": "json",
        "include_suborbital": "false",  # solo lanzamientos orbitales
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(LL2_URL, params=params, headers=headers)
    status = getattr(resp, "status_code", 200)
    if status == 429:
        raise RuntimeError("Launch Library 2: límite de peticiones alcanzado (HTTP 429)")
    if status >= 400:
        raise RuntimeError(f"Launch Library 2 respondió HTTP {status}")
    results = resp.json().get("results")
    if not isinstance(results, list):
        raise RuntimeError("Launch Library 2 devolvió una respuesta inesperada")
    launches = []
    for raw in results:
        try:
            item = _normalize(raw) if isinstance(raw, dict) else None
        except Exception:
            item = None  # un lanzamiento raro no tumba la lista entera
        if item:
            launches.append(item)
    launches.sort(key=lambda x: x["net"])
    return launches


resource = Resource("launches", _fetch, ttl=_TTL, wait=22.0, retry_after=_RETRY_AFTER)


async def get_launches(limit: int = 8) -> dict:
    launches, stale = await resource.get()
    return {
        "source": SOURCE,
        "updated": iso_utc(resource.ts),
        "stale": stale,
        "launches": launches[: max(1, min(int(limit), MAX_LIMIT))],
    }
