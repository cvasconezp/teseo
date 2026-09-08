"""Tests de los endpoints FastAPI (sin red: narrativa degradada, sin NASA)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app
from app import exoplanets

client = TestClient(app)


def test_health():
    assert client.get("/").json()["status"] == "ok"


def test_bodies():
    data = client.get("/api/bodies").json()
    assert len(data["bodies"]) == 8
    ids = {b["id"] for b in data["bodies"]}
    assert {"earth", "mars", "jupiter"} <= ids


def test_route_ok_without_groq():
    r = client.post("/api/route", json={"origin": "earth", "destination": "mars", "include_narrative": False})
    assert r.status_code == 200
    assert 250 <= r.json()["transfer_time_days"] <= 270


def test_route_same_body_400():
    assert client.post("/api/route", json={"origin": "earth", "destination": "earth"}).status_code == 400


def test_route_survives_groq_failure(monkeypatch):
    """Si Groq falla (p. ej. modelo deprecado -> 404), la ruta debe seguir
    devolviendo TODOS los números; la narrativa es un extra que degrada a
    None. Regresión del bug del modelo Enterprise de Groq (sept 2026)."""
    from app import narrative

    def boom(*a, **k):
        raise RuntimeError("404 - The model does not exist or you do not have access")

    monkeypatch.setattr(narrative, "generate_travel_narrative", boom)
    r = client.post("/api/route", json={"origin": "earth", "destination": "mars", "include_narrative": True})
    assert r.status_code == 200
    body = r.json()
    assert 250 <= body["transfer_time_days"] <= 270
    assert body["narrative"] is None
    assert "narrative_error" in body


def test_habitability_heuristic():
    # planeta rocoso en zona habitable
    assert exoplanets._is_habitable(1.0, 1.0) is True
    # gigante / fuera de zona
    assert exoplanets._is_habitable(5.0, 1.0) is False
    assert exoplanets._is_habitable(1.0, 50.0) is False
    assert exoplanets._is_habitable(None, None) is False
