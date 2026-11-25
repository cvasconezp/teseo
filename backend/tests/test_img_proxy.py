"""Tests del proxy de imágenes (app/img_proxy.py). Sin red real: el cliente httpx usa un MockTransport
que simula a las fuentes (respuestas inventadas con la forma de las reales: JPEG con su Content-Type)."""
import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient

from app.main import app
from app import img_proxy

client = TestClient(app)

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 2048 + b"\xff\xd9"
SDO = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIF.jpg"
NASA = "https://images-assets.nasa.gov/image/PIA04241/PIA04241~medium.jpg"


@pytest.fixture
def upstream(monkeypatch):
    """Instala un transporte simulado; `routes[url] = callable(request) -> httpx.Response`. Registra las URLs pedidas."""
    routes, calls = {}, []

    def handler(request: httpx.Request):
        url = str(request.url)
        calls.append(url)
        fn = routes.get(url)
        if fn is None:
            return httpx.Response(404, headers={"content-type": "text/html"}, content=b"not found")
        return fn(request)

    monkeypatch.setattr(img_proxy, "_transport", httpx.MockTransport(handler))
    img_proxy.reset_cache()
    yield routes, calls
    img_proxy.reset_cache()


def jpeg(_req=None, body=JPEG, ctype="image/jpeg", extra=None):
    return httpx.Response(200, headers={"content-type": ctype, **(extra or {})}, content=body)


def get(u):
    return client.get("/api/img", params={"u": u}, headers={"Origin": "https://teseo.yachaydeep.com"})


def test_imagen_permitida_con_cors_y_cache(upstream):
    routes, calls = upstream
    routes[SDO] = jpeg
    r = get(SDO)
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert r.headers["access-control-allow-origin"] == "*"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in r.headers["content-security-policy"]
    assert r.headers["cache-control"].startswith("public, max-age=")
    assert r.content == JPEG and r.headers["x-teseo-cache"] == "miss"
    # segunda vez: de la caché, sin volver a la fuente
    r2 = get(SDO)
    assert r2.status_code == 200 and r2.content == JPEG and r2.headers["x-teseo-cache"] == "hit"
    assert calls.count(SDO) == 1


def test_host_fuera_de_lista_400(upstream):
    routes, calls = upstream
    for u in ("https://example.com/a.jpg", "https://evil.sdo.gsfc.nasa.gov/a.jpg", "https://sdo.gsfc.nasa.gov.evil.com/a.jpg",
              "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/x.jpeg", "https://169.254.169.254/latest/meta-data",
              "https://localhost/a.jpg", "not a url", ""):
        r = get(u)
        assert r.status_code in (400, 422), u
    assert calls == []          # nunca se llega a pedir nada


def test_solo_https_400(upstream):
    routes, calls = upstream
    for u in ("http://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIF.jpg", "ftp://sdo.gsfc.nasa.gov/a.jpg",
              "file:///etc/passwd", "//sdo.gsfc.nasa.gov/a.jpg"):
        assert get(u).status_code == 400, u
    # credenciales o puertos raros tampoco
    assert get("https://user:pw@sdo.gsfc.nasa.gov/a.jpg").status_code == 400
    assert get("https://sdo.gsfc.nasa.gov:8443/a.jpg").status_code == 400
    assert calls == []


def test_no_imagen_415(upstream):
    routes, _ = upstream
    routes[SDO] = lambda req: httpx.Response(200, headers={"content-type": "text/html; charset=utf-8"}, content=b"<html>hola</html>")
    r = get(SDO)
    assert r.status_code == 415 and r.headers["cache-control"] == "no-store"
    # SVG: es image/*, pero puede llevar código → no se sirve
    routes[NASA] = lambda req: jpeg(req, body=b"<svg xmlns='http://www.w3.org/2000/svg'/>", ctype="image/svg+xml")
    assert get(NASA).status_code == 415


def test_fuente_con_error_502(upstream):
    routes, _ = upstream
    routes[SDO] = lambda req: httpx.Response(503, headers={"content-type": "text/plain"}, content=b"down")
    assert get(SDO).status_code == 502
    routes[NASA] = lambda req: (_ for _ in ()).throw(httpx.ConnectError("sin red", request=req))
    assert get(NASA).status_code == 502


def test_demasiado_grande_413(upstream):
    routes, _ = upstream
    # por la cabecera Content-Length
    routes[SDO] = lambda req: jpeg(req, extra={"content-length": str(img_proxy.MAX_BYTES + 1)}, body=b"\xff\xd8")
    assert get(SDO).status_code == 413
    # y contando lo que llega aunque la fuente no diga el tamaño
    big = b"\xff" * (img_proxy.MAX_BYTES + 10)
    routes[NASA] = lambda req: httpx.Response(200, headers={"content-type": "image/jpeg"}, content=big)
    r = get(NASA)
    assert r.status_code == 413
    assert img_proxy.cache_status()["bytes"] == 0


def test_redireccion_a_otro_host_rechazada(upstream):
    routes, calls = upstream
    routes[SDO] = lambda req: httpx.Response(302, headers={"location": "https://evil.example.com/x.jpg"})
    r = get(SDO)
    assert r.status_code == 502
    assert "evil.example.com" not in " ".join(calls)        # no se sigue
    # redirección a http (aunque sea el mismo host): rechazada
    routes[NASA] = lambda req: httpx.Response(301, headers={"location": "http://images-assets.nasa.gov/image/x.jpg"})
    assert get(NASA).status_code == 502


def test_redireccion_dentro_de_la_lista_se_sigue(upstream):
    routes, calls = upstream
    dest = "https://images-assets.nasa.gov/image/PIA04241/PIA04241~small.jpg"
    routes[NASA] = lambda req: httpx.Response(302, headers={"location": "/image/PIA04241/PIA04241~small.jpg"})
    routes[dest] = jpeg
    r = get(NASA)
    assert r.status_code == 200 and r.content == JPEG
    assert calls == [NASA, dest]


def test_bucle_de_redirecciones_502(upstream):
    routes, calls = upstream
    routes[SDO] = lambda req: httpx.Response(302, headers={"location": SDO})
    assert get(SDO).status_code == 502
    assert len(calls) == img_proxy.MAX_REDIRECTS + 1


def test_cache_con_tope_de_bytes(upstream, monkeypatch):
    routes, _ = upstream
    monkeypatch.setattr(img_proxy, "CACHE_MAX_BYTES", len(JPEG) * 2)
    urls = [f"https://images-assets.nasa.gov/image/A{i}/A{i}~small.jpg" for i in range(4)]
    for u in urls:
        routes[u] = jpeg
        assert get(u).status_code == 200
    st = img_proxy.cache_status()
    assert st["items"] == 2 and st["bytes"] <= len(JPEG) * 2


# ── B11/S10: sin query, vuelo único por URL y tope de descargas simultáneas ───────────────────────────────
def test_url_con_query_rechazada(upstream):
    routes, calls = upstream
    r = client.get("/api/img", params={"u": SDO + "?v=123"})
    assert r.status_code == 400 and "parámetros" in r.json()["detail"] and not calls
    assert img_proxy.check_url(SDO + "?x=1", allow_query=True).endswith("?x=1")   # solo en redirecciones


def test_vuelo_unico_y_semaforo(upstream):
    import asyncio
    routes, calls = upstream
    state = {"now": 0, "max": 0}

    class Lento(httpx.AsyncBaseTransport):
        async def handle_async_request(self, request):
            calls.append(str(request.url))
            state["now"] += 1; state["max"] = max(state["max"], state["now"])
            await asyncio.sleep(0.05)
            state["now"] -= 1
            return httpx.Response(200, headers={"content-type": "image/jpeg"}, content=JPEG)

    img_proxy._transport = Lento()

    async def main():
        same = [img_proxy.img(SDO) for _ in range(5)]
        others = [img_proxy.img(f"https://images-assets.nasa.gov/image/x{i}/x{i}~small.jpg") for i in range(8)]
        out = await asyncio.gather(*same, *others)
        assert all(r.status_code == 200 for r in out)

    asyncio.run(main())
    assert calls.count(SDO) == 1                                   # cinco peticiones iguales, una descarga
    assert state["max"] <= img_proxy.MAX_CONCURRENT                # nunca más de 4 a la vez
