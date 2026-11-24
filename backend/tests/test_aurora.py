"""Tests de las auroras (app/aurora.py). Sin red: _get_json se sustituye. Las formas simuladas
siguen las respuestas REALES de NOAA SWPC del 23-nov-2026 (ovation_aurora_latest.json y
noaa-planetary-k-index-forecast.json); la malla es sintética: un óvalo entre 64° y 72° N."""
import base64
import os
import sys
from datetime import datetime, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient

from app.main import app
from app import aurora

client = TestClient(app)


def ovation_json(p_band=40, lat_lo=64, lat_hi=72):
    coords = []
    for lon in range(360):
        for lat in range(-90, 91):
            p = p_band if lat_lo <= lat <= lat_hi else 0
            if -72 <= lat <= -64:
                p = 20
            coords.append([lon, lat, p])
    return {"Observation Time": "2026-11-24T03:42:00Z", "Forecast Time": "2026-11-24T05:03:00Z",
            "Data Format": "[Longitude, Latitude, Aurora]", "coordinates": coords, "type": "MultiPoint"}


KP = [
    {"time_tag": "2026-11-23T21:00:00", "kp": 2.33, "observed": "observed", "noaa_scale": None},
    {"time_tag": "2026-11-24T00:00:00", "kp": 1.67, "observed": "estimated", "noaa_scale": None},
    {"time_tag": "2026-11-24T03:00:00", "kp": 1.33, "observed": "estimated", "noaa_scale": None},
    {"time_tag": "2026-11-24T06:00:00", "kp": 3.67, "observed": "predicted", "noaa_scale": None},
    {"time_tag": "2026-11-26T21:00:00", "kp": 5.0, "observed": "predicted", "noaa_scale": "G1"},
    {"time_tag": "2026-11-24T09:00:00", "kp": 11, "observed": "predicted", "noaa_scale": None},   # fuera de rango
]


@pytest.fixture(autouse=True)
def fake_noaa(monkeypatch):
    aurora.ovation.reset(); aurora.kp_forecast.reset(); aurora._OVAL_CELLS.clear()
    calls = []

    async def fake_get(url):
        calls.append(url)
        if url == aurora.OVATION_URL:
            return ovation_json()
        if url == aurora.KP_FORECAST_URL:
            return KP
        raise AssertionError(url)

    monkeypatch.setattr(aurora, "_get_json", fake_get)
    yield calls
    aurora.ovation.reset(); aurora.kp_forecast.reset()


def test_normaliza_ovation_y_rechaza_formatos_raros():
    o = aurora.normalize_ovation(ovation_json())
    assert o["observed"] == "2026-11-24T03:42:00Z" and o["forecast"] == "2026-11-24T05:03:00Z"
    assert len(o["grid"]) == 181 * 360
    assert o["grid"][(70 + 90) * 360 + 19] == 40 and o["grid"][(50 + 90) * 360 + 19] == 0
    with pytest.raises(ValueError):
        aurora.normalize_ovation({"coordinates": [[0, 0, 1]]})
    with pytest.raises(ValueError):
        aurora.normalize_ovation([1, 2, 3])


def test_kp_ordena_filtra_y_toma_el_ultimo_medido():
    s = aurora.normalize_kp_forecast(KP)
    assert [r["t"] for r in s] == sorted(r["t"] for r in s)
    assert all(0 <= r["kp"] <= 9 for r in s) and len(s) == 5
    now = aurora.kp_now(s, datetime(2026, 11, 24, 5, 0, tzinfo=timezone.utc))
    assert now == {"t": "2026-11-24T03:00:00Z", "kp": 1.33, "kind": "estimated"}
    # formato antiguo en filas también vale
    old = aurora.normalize_kp_forecast([["time_tag", "kp", "observed", "noaa_scale"], ["2026-11-24 03:00:00", "2.00", "observed", None]])
    assert old == [{"t": "2026-11-24T03:00:00Z", "kp": 2.0, "kind": "observed"}]


def test_probabilidad_interpolada_y_ovalo_mas_cercano():
    g = aurora.normalize_ovation(ovation_json())["grid"]
    assert aurora.prob_at(g, 69.65, 18.96) == pytest.approx(40)          # Tromsø, dentro del óvalo
    assert aurora.prob_at(g, 0.04, -78.1) == 0                            # Cayambe
    n = aurora.nearest_oval(g, 0.04, -78.1)
    assert n["lat"] == 64 and n["bearing"] in range(330, 361) or n["bearing"] < 30
    assert 7000 < n["km"] < 7300                                          # ~64° de arco hasta el borde del óvalo
    s = aurora.nearest_oval(g, -54.8, -68.3)                              # Ushuaia: busca en el hemisferio sur
    assert s["lat"] == -64 and s["p"] == 20


def test_franja_recortada_alrededor_del_lugar():
    g = aurora.normalize_ovation(ovation_json())["grid"]
    lo, hi, rows = aurora.band(g, 69.65)
    assert (lo, hi) == (34, 90) and len(rows) == (hi - lo + 1) * 360
    lo, hi, rows = aurora.band(g, -54.8)
    assert lo == -90 and hi == -19


def test_endpoint_con_fuentes(fake_noaa):
    r = client.get("/api/aurora", params={"lat": 69.65, "lon": 18.96})
    assert r.status_code == 200
    d = r.json()
    ov = d["ovation"]
    assert ov["here"] == pytest.approx(40) and ov["max"] == 40 and ov["nearest"]["km"] < 80
    rows = base64.b64decode(ov["grid_b64"])
    assert len(rows) == (ov["lat_max"] - ov["lat_min"] + 1) * ov["lon_count"]
    assert d["kp"]["series"][-1]["kp"] == 5.0
    assert {s["id"] for s in d["sources"]} == {"ovation", "kp"} and all(s["ok"] for s in d["sources"])
    assert "max-age" in r.headers.get("cache-control", "")
    # la segunda consulta no vuelve a NOAA
    n = len(fake_noaa)
    client.get("/api/aurora", params={"lat": 0.04, "lon": -78.1})
    assert len(fake_noaa) == n


def test_si_noaa_falla_responde_503(monkeypatch):
    async def boom(url):
        raise RuntimeError("services.swpc.noaa.gov respondió HTTP 503")
    monkeypatch.setattr(aurora, "_get_json", boom)
    r = client.get("/api/aurora", params={"lat": 69.65, "lon": 18.96})
    assert r.status_code == 503
