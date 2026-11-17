"""Tests de los nombres de las montañas (app/peaks.py). Sin red: el relieve es el de test_horizon (llanura a
2.800 m con un volcán de 5.800 m a 18 km al este) y Overpass se sustituye por un MockTransport con cumbres
inventadas: la del volcán (se ve), una loma detrás del volcán (tapada), una cumbre del mapa en plena llanura (no
forma silueta) y una sin nombre."""
import math
import os
import re
import sys
from urllib.parse import unquote_plus

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient

from app.main import app
from app import horizon as hz
from app import peaks as pk
from tests.test_horizon import LAT0, LON0, PEAK_LON, PEAK_D, R, tile_png, terrain

client = TestClient(app)
BEHIND_LON = LON0 + math.degrees((PEAK_D + 9000) / R)       # 27 km al este, detrás del volcán
FLAT_LAT = LAT0 + math.degrees(12000 / R)                   # 12 km al norte, en la llanura

NODES = [
    {"type": "node", "id": 1, "lat": LAT0 + 0.0004, "lon": PEAK_LON - 0.0003, "tags": {"natural": "volcano", "name": "Volcán Prueba", "name:en": "Test Volcano", "ele": "5.790"}},
    {"type": "node", "id": 2, "lat": LAT0, "lon": BEHIND_LON, "tags": {"natural": "peak", "name": "Loma Escondida", "ele": "3100"}},
    {"type": "node", "id": 3, "lat": FLAT_LAT, "lon": LON0, "tags": {"natural": "peak", "name": "Cerro del Mapa", "ele": "2830"}},
    {"type": "node", "id": 4, "lat": LAT0, "lon": LON0 + 0.05, "tags": {"natural": "peak"}},
]


@pytest.fixture
def net(monkeypatch):
    st = {"over": 0, "fail": set(), "query": None}

    def handler(request: httpx.Request):
        u = str(request.url)
        m = re.search(r"/terrarium/(\d+)/(\d+)/(\d+)\.png$", u)
        if m:
            z, x, y = map(int, m.groups())
            return httpx.Response(200, headers={"content-type": "image/png"}, content=tile_png(z, x, y, terrain))
        st["over"] += 1
        st["query"] = request.content.decode()
        if any(h in u for h in st["fail"]):
            return httpx.Response(429, content=b"busy")
        return httpx.Response(200, json={"elements": NODES})

    t = httpx.MockTransport(handler)
    monkeypatch.setattr(hz, "_transport", t)
    monkeypatch.setattr(pk, "_transport", t)
    hz.reset_cache(); pk.reset_cache()
    yield st
    hz.reset_cache(); pk.reset_cache()


def test_solo_las_cumbres_de_la_silueta(net):
    r = client.get(f"/api/peaks?lat={LAT0}&lon={LON0}")
    assert r.status_code == 200
    d = r.json()
    names = [p["name"] for p in d["peaks"]]
    assert names == ["Volcán Prueba"], names
    p = d["peaks"][0]
    assert p["name_en"] == "Test Volcano" and p["volcano"] and p["ele_m"] == 5790 and abs(p["dist_km"] - 18) < 0.3
    # el rótulo va en el punto exacto de la silueta dibujada: mismo acimut y ángulo que el filo de su banda
    prof = client.get(f"/api/horizon?lat={LAT0}&lon={LON0}").json()
    i = int(round(p["az"] / prof["step_deg"]))
    assert abs(p["az"] - 90) < 0.5 and p["alt"] == prof["bands"][p["band"]]["alt"][i] and p["alt"] == prof["alt"][i]
    assert p["lift"] > 2
    assert d["candidates"] == 4 and "OpenStreetMap" in d["source"]


def test_consulta_y_cache(net):
    client.get(f"/api/peaks?lat={LAT0}&lon={LON0}")
    q = unquote_plus(net["query"])
    assert "around:40000" in q and "around:150000" in q and "number(t" in q and "volcano" in q
    client.get(f"/api/peaks?lat={LAT0 + 0.0005}&lon={LON0}")                  # misma celda: sin otra consulta
    assert net["over"] == 1


def test_servidor_de_respaldo(net):
    net["fail"].add("overpass-api.de")
    r = client.get(f"/api/peaks?lat={LAT0}&lon={LON0}")
    assert r.status_code == 200 and net["over"] == 2 and r.json()["peaks"]


def test_sin_overpass_502(net):
    net["fail"].update(["overpass-api.de", "kumi.systems", "mail.ru"])
    r = client.get(f"/api/peaks?lat={LAT0}&lon={LON0}")
    assert r.status_code == 502 and "montañas" in r.json()["detail"]


def test_alturas_y_rumbos():
    assert pk.parse_ele("5790") == 5790 and pk.parse_ele("5.790 m") == 5790 and pk.parse_ele("4784.5") == 4784.5
    assert abs(pk.parse_ele("14505 ft") - 4421.1) < 0.2 and pk.parse_ele("n/a") is None and pk.parse_ele(None) is None
    az, d = pk.bearing_dist(0, 0, 0, 1)
    assert abs(az - 90) < 1e-6 and abs(d - 111.2) < 0.1
    az, _ = pk.bearing_dist(0, 0, -1, 0)
    assert abs(az - 180) < 1e-6
