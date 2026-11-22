"""Tests de la estimación de contaminación lumínica (app/lightpollution.py). Sin red: teselas inventadas."""
import io
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
from app import lightpollution as lp

client = TestClient(app)


def png(color):
    buf = io.BytesIO(); Image.new("RGB", (256, 256), color).save(buf, "PNG"); return buf.getvalue()


@pytest.fixture
def sky(monkeypatch):
    state = {"color": (8, 10, 30), "status": 200, "calls": 0}

    def handler(request: httpx.Request):
        state["calls"] += 1
        assert re.search(r"VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/8/\d+/\d+\.png$", str(request.url))
        return httpx.Response(state["status"], content=png(state["color"]))

    monkeypatch.setattr(lp, "_transport", httpx.MockTransport(handler))
    lp.reset_cache()
    yield state
    lp.reset_cache()


def test_noche_cerrada(sky):
    d = client.get("/api/lightpollution?lat=-1.0&lon=-76.0").json()
    assert d["bortle"] == 1 and d["estimate"] is True and d["uncertainty"] == 1 and "NASA" in d["credit"]


def test_todo_iluminado(sky):
    sky["color"] = (255, 255, 230)
    d = client.get("/api/lightpollution?lat=40.4&lon=-3.7").json()
    assert d["bortle"] == 9, d


def test_el_fondo_azulado_no_cuenta(sky):
    sky["color"] = (60, 70, 120)                     # tierra de noche en la imagen: azulada, sin luces
    assert client.get("/api/lightpollution?lat=0&lon=-78").json()["bortle"] == 1


def test_un_pueblo_cerca_y_lejos():
    # una mancha de luz de 5×5 píxeles (≈ 3 km) en una tesela oscura: cerca sube la clase; a 60 km, casi nada
    lat, lon = 0.0, -78.0
    x0, x1, y0, y1, px, py, kmpp = lp.window(lat, lon)
    tiles = {k: np.full((256, 256, 3), (8.0, 10.0, 30.0), dtype=np.float32) for k in lp.tiles_needed(lat, lon)}

    def with_town(dx_km):
        t = {k: v.copy() for k, v in tiles.items()}
        cx, cy = int(px + dx_km / kmpp), int(py)
        for yy in range(cy - 2, cy + 3):
            for xx in range(cx - 2, cx + 3):
                t[(xx // 256, yy // 256)][yy % 256, xx % 256] = (255, 255, 255)
        return lp.bortle_of(lp.light_index(lat, lon, t))

    near, far = with_town(0), with_town(60)
    assert near >= 3 and far <= 2 and near > far, (near, far)


def test_cache_y_celda(sky):
    client.get("/api/lightpollution?lat=0.041&lon=-78.146")
    n = sky["calls"]
    d = client.get("/api/lightpollution?lat=0.049&lon=-78.151").json()
    assert sky["calls"] == n and d["lat"] == 0.05 and d["lon"] == -78.15


def test_sin_servidor(sky):
    sky["status"] = 503
    assert client.get("/api/lightpollution?lat=10&lon=10").status_code == 502


def test_umbrales():
    assert lp.bortle_of(10 ** 0.5) == 9 and lp.bortle_of(10 ** 0.25) == 8 and lp.bortle_of(10 ** -0.2) == 6 and lp.bortle_of(10 ** -0.9) == 3 and lp.bortle_of(0) == 1


def test_parametros():
    assert client.get("/api/lightpollution?lat=95&lon=0").status_code == 422
