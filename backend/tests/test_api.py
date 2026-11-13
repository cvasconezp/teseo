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


def test_position_cache_and_stale_fallback(monkeypatch):
    """La posición se cachea por (cuerpo, día) y, si la NASA cae, se sirve
    el último vector real marcado como `stale` en vez de un error."""
    import asyncio
    from datetime import datetime
    from app import nasa_horizons as nh

    nh._position_cache.clear(); nh._last_good_position.clear()
    calls = {"n": 0}

    async def no_sleep(*a, **k): return None
    monkeypatch.setattr(nh.asyncio, "sleep", no_sleep)
    nh._horizons_lock = None

    class FakeResp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self):
            return {"result": "$$SOE\n2461358.5 = A.D. 2026-Nov-13 00:00:00.0000 TDB \n X = 1.0E+00 Y = 2.0E+00 Z = 3.0E-01\n$$EOE"}

    class FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, *a, **k):
            calls["n"] += 1
            if calls["fail"]:
                raise RuntimeError("NASA caída")
            return FakeResp()

    calls["fail"] = False
    monkeypatch.setattr(nh.httpx, "AsyncClient", FakeClient)
    p1 = asyncio.run(nh.get_body_position("mars", datetime(2026, 11, 13, 5)))
    p2 = asyncio.run(nh.get_body_position("mars", datetime(2026, 11, 13, 9)))
    assert calls["n"] == 1 and p1["x_au"] == p2["x_au"] and "stale" not in p2

    calls["fail"] = True
    p3 = asyncio.run(nh.get_body_position("mars", datetime(2026, 11, 14)))
    assert p3["stale"] is True and p3["x_au"] == p1["x_au"]
    nh._horizons_lock = None


def test_horizons_requests_never_overlap(monkeypatch):
    """Regresión del 502 en producción: Horizons rechaza peticiones
    simultáneas, así que 8 planetas pedidos a la vez deben ir en fila."""
    import asyncio
    from datetime import datetime
    from app import nasa_horizons as nh

    nh._position_cache.clear(); nh._last_good_position.clear(); nh._horizons_lock = None
    state = {"active": 0, "max": 0, "n": 0}

    class FakeResp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self):
            return {"result": "$$SOE\n X = 1.0E+00 Y = 2.0E+00 Z = 3.0E-01\n$$EOE"}

    class FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, *a, **k):
            state["active"] += 1; state["n"] += 1
            state["max"] = max(state["max"], state["active"])
            await asyncio.sleep(0.01)
            state["active"] -= 1
            return FakeResp()

    monkeypatch.setattr(nh.httpx, "AsyncClient", FakeClient)

    async def run():
        bodies = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"]
        return await asyncio.gather(*(nh.get_body_position(b, datetime(2026, 11, 13)) for b in bodies))

    res = asyncio.run(run())
    assert len(res) == 8 and state["n"] == 8 and state["max"] == 1
    nh._position_cache.clear(); nh._last_good_position.clear(); nh._horizons_lock = None
    nh._position_cache.clear(); nh._last_good_position.clear()
