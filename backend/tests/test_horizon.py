"""Tests del horizonte real (app/horizon.py). Sin red: un MockTransport sirve teselas «terrarium» inventadas
con la misma codificación que AWS Terrain Tiles: una llanura a 2.800 m con un volcán cónico de 5.800 m a 18 km
al este del observador, para comparar con el ángulo que se calcula a mano."""
import io
import math
import os
import re
import sys

import httpx
import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient

from app.main import app
from app import horizon as hz

client = TestClient(app)
LAT0, LON0 = 0.04, -78.15          # una celda exacta de 0,01°
R = 6371008.8
PEAK_D = 18000.0
PEAK_LON = LON0 + math.degrees(PEAK_D / R)   # en el ecuador, 18 km al este
PLAIN, PEAK_H, BASE_R = 2800.0, 5800.0, 6000.0


def terrain(lat, lon):
    dx = np.radians(lon - PEAK_LON) * R * np.cos(np.radians(lat))
    dy = np.radians(lat - LAT0) * R
    r = np.hypot(dx, dy)
    return PLAIN + np.clip(1 - r / BASE_R, 0, None) * (PEAK_H - PLAIN)


def tile_png(z, x, y, fn=terrain):
    n = 2 ** z
    px = (np.arange(256) + 0.5) / 256
    lon = (x + px) / n * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * (y + px) / n))))
    h = fn(lat[:, None], lon[None, :]) + 32768.0
    r = np.floor(h / 256); g = np.floor(h - r * 256); b = np.round((h - r * 256 - g) * 256)
    img = np.stack([r, g, np.clip(b, 0, 255)], axis=-1).astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(img, "RGB").save(buf, "PNG"); return buf.getvalue()


@pytest.fixture
def tiles(monkeypatch):
    calls = []
    state = {"fn": terrain, "fail": False}

    def handler(request: httpx.Request):
        m = re.search(r"/terrarium/(\d+)/(\d+)/(\d+)\.png$", str(request.url))
        calls.append(str(request.url))
        if not m or state["fail"]:
            return httpx.Response(404, content=b"no")
        z, x, y = map(int, m.groups())
        return httpx.Response(200, headers={"content-type": "image/png"}, content=tile_png(z, x, y, state["fn"]))

    monkeypatch.setattr(hz, "_transport", httpx.MockTransport(handler))
    hz.reset_cache()
    yield calls, state
    hz.reset_cache()


def at(arr, az):
    return arr[int(round(az / hz.STEP_DEG)) % len(arr)]


def test_volcan_al_este(tiles):
    r = client.get(f"/api/horizon?lat={LAT0}&lon={LON0}")
    assert r.status_code == 200
    d = r.json()
    assert d["lat"] == LAT0 and d["lon"] == LON0 and d["step_deg"] == 0.5 and len(d["alt"]) == 720
    assert abs(d["ground_m"] - PLAIN) < 3
    drop = PEAK_D ** 2 * (1 - hz.K_REFR) / (2 * R)
    want = math.degrees(math.atan((PEAK_H - PLAIN - hz.EYE_M - drop) / PEAK_D))       # ≈ 9,4°
    got = at(d["alt"], 90)
    assert abs(got - want) < 0.4, (got, want)
    # en la llanura el horizonte queda apenas bajo 0° (curvatura de la Tierra)
    assert -0.3 < at(d["alt"], 270) < 0.0
    assert -0.3 < at(d["alt"], 0) < 0.0
    # el volcán está en la banda de 12 a 40 km, con su cumbre
    b = d["bands"][2]
    assert b["max_km"] == 40 and abs(at(b["alt"], 90) - got) < 1e-6 and at(b["top_m"], 90) > PEAK_H - 250
    assert r.headers["cache-control"] == f"public, max-age={hz.CACHE_SECONDS}"


def test_ancho_angular_del_volcan(tiles):
    d = client.get(f"/api/horizon?lat={LAT0}&lon={LON0}").json()
    half = math.degrees(math.atan(BASE_R / PEAK_D))                                   # ≈ 18,4°
    assert at(d["alt"], 90 + half - 4) > 0.5 and at(d["alt"], 90 + half + 3) < 0.05


def test_cache_por_celda(tiles):
    calls, _ = tiles
    client.get(f"/api/horizon?lat={LAT0}&lon={LON0}")
    n = len(calls)
    assert n > 10
    r2 = client.get(f"/api/horizon?lat={LAT0 + 0.003}&lon={LON0 - 0.004}")       # misma celda de 0,01°
    assert r2.status_code == 200 and len(calls) == n and r2.json()["lat"] == LAT0


def test_sin_teselas_502(tiles):
    _, state = tiles
    state["fail"] = True
    r = client.get("/api/horizon?lat=10&lon=10")
    assert r.status_code == 502 and "relieve" in r.json()["detail"]


def test_mar_a_nivel_cero(tiles):
    _, state = tiles
    state["fn"] = lambda lat, lon: np.full(np.broadcast(lat, lon).shape, -1500.0)
    d = client.get("/api/horizon?lat=-20&lon=-100").json()
    assert d["ground_m"] == 0 and all(-0.5 < a <= 0.0 for a in d["alt"])


def test_celda_y_antimeridiano():
    assert hz.cell_of(0.04312, -78.14563) == (0.04, -78.15)
    assert hz.cell_of(10, 180.0) == (10.0, -180.0)
    t = hz.tiles_for(0, 179.9, 9, 150e3)
    assert any(x == 0 for x, _ in t) and any(x == 511 for x, _ in t)


def test_parametros_invalidos():
    assert client.get("/api/horizon?lat=95&lon=0").status_code == 422
    assert client.get("/api/horizon?lat=0").status_code == 422
