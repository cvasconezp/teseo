"""
img_proxy.py — proxy de imágenes para las imágenes para compartir de la app.

Para qué: un <canvas> del navegador queda «manchado» (no se puede exportar a PNG) si se le dibuja una imagen de
otro origen que no responde con Access-Control-Allow-Origin. Algunas fuentes que la app ya muestra NO lo hacen
(comprobado con curl y cabecera Origin el 16-nov-2026):

  * sdo.gsfc.nasa.gov       — imagen del día de SDO/HMI («El Sol hoy»): sin cabecera CORS.
  * images-assets.nasa.gov  — NASA Image and Video Library (naves rumbo a Marte): cabecera irregular.

Este endpoint las sirve desde el origen de la API con «Access-Control-Allow-Origin: *». Las fuentes que ya
traen CORS (fotos de Launch Library 2 en thespacedevs-prod.nyc3.digitaloceanspaces.com, CDN de ESA/ESO) se
cargan directo desde el navegador y NO pasan por aquí.

  GET /api/img?u=<url>

Seguridad (no es un proxy abierto):
  * lista blanca ESTRICTA de hosts EXACTOS (ALLOWED_HOSTS), solo https, sin usuario/contraseña, puerto 443;
  * las redirecciones NO se siguen solas: cada salto se vuelve a comprobar contra la lista (como mucho 3);
  * solo imágenes rasterizadas (Content-Type image/jpeg, png, gif, webp o avif; nunca SVG, que puede llevar
    código): otra cosa → 415;
  * tamaño máximo 8 MB (por Content-Length y contando lo que llega) → 413;
  * tiempo límite total → 504; respuesta no 200 o error de red → 502;
  * caché en memoria (LRU con tope de bytes y caducidad por host), como el resto del backend (app/cache.py);
  * la respuesta lleva nosniff, CSP «sandbox» y Cross-Origin-Resource-Policy: cross-origin.
"""

import asyncio
import time
from collections import OrderedDict
from typing import Optional, Tuple
from urllib.parse import urljoin, urlsplit

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, Response

from app.cache import provider_headers

ALLOWED_HOSTS = frozenset({"sdo.gsfc.nasa.gov", "images-assets.nasa.gov"})
ALLOWED_TYPES = frozenset({"image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"})
MAX_BYTES = 8 * 1024 * 1024
MAX_URL = 2048
MAX_REDIRECTS = 3
TIMEOUT_S = 15.0
# caducidad por host: la imagen «latest» de SDO cambia cada ~15 min; las de la biblioteca de la NASA no cambian
TTL_BY_HOST = {"sdo.gsfc.nasa.gov": 15 * 60, "images-assets.nasa.gov": 24 * 3600}
CACHE_MAX_BYTES = 48 * 1024 * 1024

# Para las pruebas: un httpx.MockTransport (sin red real). En producción, None.
_transport: Optional[httpx.AsyncBaseTransport] = None

router = APIRouter(prefix="/api", tags=["img"])


class ProxyError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def check_url(u: str) -> str:
    """Valida la URL pedida: https, host EXACTO de la lista, sin credenciales ni puertos raros. Devuelve la URL sin fragmento."""
    if not isinstance(u, str) or not u or len(u) > MAX_URL:
        raise ProxyError(400, "URL vacía o demasiado larga")
    try:
        parts = urlsplit(u.strip())
        port = parts.port
    except ValueError:
        raise ProxyError(400, "URL no válida")
    if parts.scheme != "https":
        raise ProxyError(400, "solo se aceptan URL https")
    host = (parts.hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        raise ProxyError(400, "host fuera de la lista permitida")
    if parts.username or parts.password or (port not in (None, 443)):
        raise ProxyError(400, "URL con credenciales o puerto no permitidos")
    return parts._replace(fragment="").geturl()


# ─── caché LRU en memoria ──────────────────────────────────────────────────
_cache: "OrderedDict[str, Tuple[float, float, bytes, str]]" = OrderedDict()   # url → (guardado, ttl, datos, tipo)
_cache_bytes = 0


def _cache_get(url: str):
    hit = _cache.get(url)
    if not hit:
        return None
    ts, ttl, data, ctype = hit
    if time.time() - ts > ttl:
        _cache_drop(url)
        return None
    _cache.move_to_end(url)
    return data, ctype, ttl


def _cache_drop(url: str) -> None:
    global _cache_bytes
    old = _cache.pop(url, None)
    if old:
        _cache_bytes -= len(old[2])


def _cache_put(url: str, data: bytes, ctype: str, ttl: float) -> None:
    global _cache_bytes
    _cache_drop(url)
    _cache[url] = (time.time(), ttl, data, ctype)
    _cache_bytes += len(data)
    while _cache_bytes > CACHE_MAX_BYTES and _cache:
        k, _ = next(iter(_cache.items()))
        _cache_drop(k)


def reset_cache() -> None:
    """Olvida todo (para pruebas)."""
    global _cache_bytes
    _cache.clear()
    _cache_bytes = 0


def cache_status() -> dict:
    return {"items": len(_cache), "bytes": _cache_bytes, "max_bytes": CACHE_MAX_BYTES}


# ─── descarga ──────────────────────────────────────────────────────────────
async def fetch_image(url: str) -> Tuple[bytes, str]:
    """Descarga una imagen permitida. Lanza ProxyError con el código HTTP que corresponda."""
    async with httpx.AsyncClient(timeout=TIMEOUT_S, follow_redirects=False, transport=_transport,
                                 headers={**provider_headers(), "Accept": "image/*"}) as client:
        for _ in range(MAX_REDIRECTS + 1):
            async with client.stream("GET", url) as r:
                if r.status_code in (301, 302, 303, 307, 308):
                    loc = r.headers.get("location")
                    if not loc:
                        raise ProxyError(502, "redirección sin destino")
                    try:
                        url = check_url(urljoin(url, loc))
                    except ProxyError:
                        raise ProxyError(502, "la fuente redirige fuera de la lista permitida")
                    continue
                if r.status_code != 200:
                    raise ProxyError(502, f"la fuente respondió HTTP {r.status_code}")
                ctype = r.headers.get("content-type", "").split(";")[0].strip().lower()
                if ctype not in ALLOWED_TYPES:
                    raise ProxyError(415, "la fuente no devolvió una imagen permitida")
                cl = r.headers.get("content-length")
                if cl and cl.isdigit() and int(cl) > MAX_BYTES:
                    raise ProxyError(413, "imagen demasiado grande")
                buf = bytearray()
                async for chunk in r.aiter_bytes():
                    buf += chunk
                    if len(buf) > MAX_BYTES:
                        raise ProxyError(413, "imagen demasiado grande")
                return bytes(buf), ctype
        raise ProxyError(502, "demasiadas redirecciones")


_ERR_HEADERS = {"Cache-Control": "no-store", "Access-Control-Allow-Origin": "*"}
_OK_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
}


@router.get("/img", include_in_schema=False)
async def img(u: str = Query(..., max_length=MAX_URL)):
    try:
        url = check_url(u)
    except ProxyError as e:
        return JSONResponse(status_code=e.status, content={"detail": e.detail}, headers=_ERR_HEADERS)
    host = (urlsplit(url).hostname or "").lower()
    ttl = TTL_BY_HOST.get(host, 3600)
    hit = _cache_get(url)
    if hit:
        data, ctype, _ = hit
        return Response(content=data, media_type=ctype, headers={**_OK_HEADERS, "Cache-Control": f"public, max-age={int(ttl)}", "X-Teseo-Cache": "hit"})
    try:
        data, ctype = await asyncio.wait_for(fetch_image(url), timeout=TIMEOUT_S + 5)
    except ProxyError as e:
        return JSONResponse(status_code=e.status, content={"detail": e.detail}, headers=_ERR_HEADERS)
    except (asyncio.TimeoutError, httpx.TimeoutException):
        return JSONResponse(status_code=504, content={"detail": "la fuente tardó demasiado"}, headers=_ERR_HEADERS)
    except httpx.HTTPError as e:
        return JSONResponse(status_code=502, content={"detail": f"error de red: {type(e).__name__}"}, headers=_ERR_HEADERS)
    _cache_put(url, data, ctype, ttl)
    return Response(content=data, media_type=ctype, headers={**_OK_HEADERS, "Cache-Control": f"public, max-age={int(ttl)}", "X-Teseo-Cache": "miss"})
