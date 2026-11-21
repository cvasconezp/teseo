"""Volcanes del Holoceno del Smithsonian (app/volcanoes.py): análisis de la WFS, cercanía y el punto /api/volcanoes."""
import json

import httpx
from fastapi.testclient import TestClient

from app import volcanoes as vo
from app.main import app

client = TestClient(app)

FEAT = {"type": "FeatureCollection", "features": [
    {"properties": {"Volcano_Number": 352050, "Volcano_Name": "Cotopaxi", "Latitude": -0.677, "Longitude": -78.436,
                    "Elevation": 5911, "Primary_Volcano_Type": "Stratovolcano", "Volcanic_Landform": "Composite",
                    "Last_Eruption_Year": 2023, "Evidence_Category": "Eruption Observed",
                    "Tectonic_Setting": "Subduction zone / Continental crust (> 25 km)", "Major_Rock_Type": "Andesite / Basaltic Andesite",
                    "Country": "Ecuador", "Region": "South America", "Subregion": "Ecuador", "Geological_Summary": "…"}},
    {"properties": {"Volcano_Number": 352010, "Volcano_Name": "Cayambe", "Latitude": 0.029, "Longitude": -77.986,
                    "Elevation": 5790, "Primary_Volcano_Type": "Compound", "Last_Eruption_Year": 1786, "Country": "Ecuador"}},
    {"properties": {"Volcano_Number": 283030, "Volcano_Name": "Fujisan", "Latitude": 35.361, "Longitude": 138.728,
                    "Elevation": 3776, "Primary_Volcano_Type": "Stratovolcano", "Last_Eruption_Year": 1708, "Country": "Japan"}},
    {"properties": {"Volcano_Name": "sin número", "Latitude": 1, "Longitude": 1}},
]}


def test_parse_y_campos():
    v = vo.parse(FEAT)
    assert len(v) == 3
    c = v[0]
    assert c["id"] == 352050 and c["last_year"] == 2023 and c["elev_m"] == 5911 and c["type"] == "Stratovolcano"
    assert c["url"] == "https://volcano.si.edu/volcano.cfm?vn=352050"
    assert "summary" not in c and "Geological_Summary" not in c        # el resumen no se copia (ver la cabecera)


def test_cercanos_ordenados():
    v = vo.near(vo.parse(FEAT), 0.04, -78.15, 220)
    assert [x["name"] for x in v] == ["Cayambe", "Cotopaxi"] and 15 < v[0]["dist_km"] < 20


def test_punto(monkeypatch):
    vo._cache.update(at=0.0, list=None, failed_at=0.0, error=None)
    monkeypatch.setattr(vo, "_transport", httpx.MockTransport(lambda req: httpx.Response(200, json=FEAT)))
    d = client.get("/api/volcanoes?lat=0.04&lon=-78.15").json()
    assert [x["name"] for x in d["volcanoes"]] == ["Cayambe", "Cotopaxi"] and "Smithsonian" in d["source"]


def test_falla_sin_copia(monkeypatch):
    vo._cache.update(at=0.0, list=None, failed_at=0.0, error=None)
    monkeypatch.setattr(vo, "_transport", httpx.MockTransport(lambda req: httpx.Response(503)))
    assert client.get("/api/volcanoes?lat=0&lon=0").status_code == 502
    vo._cache.update(at=0.0, list=None, failed_at=0.0, error=None)
