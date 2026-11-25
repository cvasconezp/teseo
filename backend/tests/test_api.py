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


def test_narrative_prompt_uses_human_dates(monkeypatch):
    """La narrativa recibe fechas legibles (sin microsegundos) y nunca
    devuelve una frase cortada si el modelo se queda sin tokens."""
    from types import SimpleNamespace as NS
    from app import narrative

    seen = {}

    class FakeCompletions:
        def create(self, **kw):
            seen["prompt"] = kw["messages"][1]["content"]
            msg = NS(content="Partimos de la Tierra el 13 de noviembre de 2026 rumbo a Marte. El viaje dura 259 días y culmina el 30 de julio de 2027 a las 00")
            return NS(choices=[NS(message=msg, finish_reason="length")])

    monkeypatch.setattr(narrative, "_get_client", lambda: NS(chat=NS(completions=FakeCompletions())))
    out = narrative.generate_travel_narrative({
        "origin": "earth", "destination": "mars",
        "departure_date": "2026-11-13T02:14:17.064033", "arrival_date": "2027-07-30T00:19:01.5",
        "transfer_time_days": 258.92, "delta_v_total_km_s": 5.596}, lang="es")
    assert "13 de noviembre de 2026" in seen["prompt"] and "064033" not in seen["prompt"]
    assert "la Tierra" in seen["prompt"] and "259 días" in seen["prompt"]
    assert out.endswith("Marte.")


# ─── Auditoría 2026-11-25 ─────────────────────────────────────────────────
import asyncio
import json as _json
from datetime import datetime

import pytest

from app import main as _main
from app import metrics as _metrics
from app import narrative as _narr
from app import nasa_horizons as _nh


@pytest.fixture
def fake_groq(monkeypatch):
    calls = {"n": 0}

    def gen(data, lang="es"):
        calls["n"] += 1
        return f"narración {lang} {data['origin']}→{data['destination']}"

    monkeypatch.setattr(_narr, "generate_travel_narrative", gen)
    _narr._narr_cache.clear()
    yield calls
    _narr._narr_cache.clear()


def test_route_narrative_is_cached_and_lang_normalized(fake_groq):
    body = {"origin": "earth", "destination": "mars", "include_narrative": True}
    a = client.post("/api/route", json={**body, "lang": "en"}).json()
    b = client.post("/api/route", json={**body, "lang": "en"}).json()
    assert a["narrative"] == b["narrative"] == "narración en earth→mars" and fake_groq["n"] == 1
    # un idioma que no existe → español (no rompe la ruta)
    assert client.post("/api/route", json={**body, "lang": "fr"}).json()["narrative"].startswith("narración es")
    assert client.post("/api/route", json={**body, "lang": "x" * 6}).status_code == 422          # max_length


def test_route_rate_limit_only_when_calling_groq(fake_groq, monkeypatch):
    monkeypatch.setattr(_main, "ai_limiter", _metrics.RateLimiter(per_minute=1))
    body = {"origin": "earth", "include_narrative": True}
    assert client.post("/api/route", json={**body, "destination": "mars"}).status_code == 200
    r = client.post("/api/route", json={**body, "destination": "venus"})
    assert r.status_code == 429 and r.headers["retry-after"] == "60"
    # ya en caché, o sin narración: sin límite
    assert client.post("/api/route", json={**body, "destination": "mars"}).status_code == 200
    assert client.post("/api/route", json={"origin": "earth", "destination": "venus", "include_narrative": False}).status_code == 200


def test_route_narrative_error_is_generic(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("Error code: 404 - {'error': {'message': 'org_01SECRETO'}}")
    monkeypatch.setattr(_narr, "generate_travel_narrative", boom)
    _narr._narr_cache.clear()
    d = client.post("/api/route", json={"origin": "earth", "destination": "jupiter", "include_narrative": True}).json()
    assert d["narrative"] is None and "SECRETO" not in _json.dumps(d) and d["narrative_error"]
    assert not _narr._narr_cache                                                   # un fallo no se cachea


def test_route_departure_date_bounds():
    for bad, code in (("9999-12-30", 422), ("1800-01-01", 422), ("ayer", 400)):
        r = client.post("/api/route", json={"origin": "earth", "destination": "mars", "departure_date": bad,
                                            "include_narrative": False})
        assert r.status_code == code and bad not in r.json()["detail"], (bad, r.json())


def test_empty_groq_answer_is_a_failure(monkeypatch):
    from types import SimpleNamespace as NS

    class C:
        def create(self, **kw):
            return NS(choices=[NS(message=NS(content=""), finish_reason="length")])

    monkeypatch.setattr(_narr, "_get_client", lambda: NS(chat=NS(completions=C())))
    with pytest.raises(RuntimeError):
        _narr.generate_travel_narrative({"origin": "earth", "destination": "mars", "departure_date": "2026-11-13",
                                         "arrival_date": "2027-07-30", "transfer_time_days": 259,
                                         "delta_v_total_km_s": 5.6})
    with pytest.raises(RuntimeError):
        _narr.explain_concept("órbita")


def test_explain_validates_concept_and_limits(monkeypatch):
    seen = {}
    monkeypatch.setattr(_narr, "explain_concept", lambda c, l: seen.update(c=c, l=l) or "texto")
    assert client.post("/api/explain", json={"concept": "x" * 121}).status_code == 422
    assert client.post("/api/explain", json={"concept": "   "}).status_code == 422
    r = client.post("/api/explain", json={"concept": "ventana\n\tde  lanzamiento", "lang": "de"})
    assert r.status_code == 200 and seen == {"c": "ventana de lanzamiento", "l": "es"}
    monkeypatch.setattr(_main, "ai_limiter", _metrics.RateLimiter(per_minute=1))
    assert client.post("/api/explain", json={"concept": "a"}).status_code == 200
    assert client.post("/api/explain", json={"concept": "a"}).status_code == 429


def test_explain_503_is_generic(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("clave gsk_SECRETA")
    monkeypatch.setattr(_narr, "explain_concept", boom)
    r = client.post("/api/explain", json={"concept": "órbita"})
    assert r.status_code == 503 and "SECRETA" not in r.text and "id " in r.json()["detail"]


def test_dates_bounded_and_day_only():
    assert client.get("/api/position/mars?date=2101-01-01").status_code == 422
    assert client.get("/api/positions?date=1899-12-31").status_code == 422
    assert client.get("/api/distance/earth/mars?date=9999-01-01").status_code == 422
    r = client.get("/api/position/mars?date=<script>")
    assert r.status_code == 400 and "<script>" not in r.text
    assert _main._parse_date("2026-11-25T23:30:00-05:00") == datetime(2026, 11, 25)
    assert _main._parse_date("2026-11-25T23:30:00-05:00", day_only=False) == datetime(2026, 11, 26, 4, 30)


def test_launch_windows_dates(monkeypatch):
    assert client.get("/api/launch-windows/earth/mars?start_date=9999-12-30").status_code == 422
    calls = []
    real = _main.orbital.find_launch_windows
    monkeypatch.setattr(_main.orbital, "find_launch_windows", lambda *a: calls.append(a) or real(*a))
    _main._windows_cache.clear()
    a = client.get("/api/launch-windows/earth/mars?start_date=2030-01-01&count=1")
    b = client.get("/api/launch-windows/earth/mars?start_date=2030-01-01T05:00:00%2B03:00&count=1")
    assert a.status_code == b.status_code == 200 and a.json() == b.json() and len(calls) == 1
    w = a.json()["windows"][0]
    assert "." not in w["departure_date"] and "." not in w["arrival_date"]       # sin microsegundos
    assert datetime.fromisoformat(w["departure_date"]).year == 2031


def test_launch_windows_overflow_is_422(monkeypatch):
    def boom(*a):
        raise OverflowError("date value out of range")
    monkeypatch.setattr(_main.orbital, "find_launch_windows", boom)
    _main._windows_cache.clear()
    assert client.get("/api/launch-windows/earth/mars?start_date=2099-01-01").status_code == 422
    _main._windows_cache.clear()


def test_find_launch_windows_accepts_tz_and_stops_at_2200():
    from datetime import timezone, timedelta
    from app import orbital
    a = orbital.find_launch_windows("earth", "mars", datetime(2030, 1, 1, 3, tzinfo=timezone(timedelta(hours=3))), 1)
    b = orbital.find_launch_windows("earth", "mars", datetime(2030, 1, 1), 1)
    assert a["windows"][0]["departure_date"] == b["windows"][0]["departure_date"]
    late = orbital.find_launch_windows("earth", "saturn", datetime(2199, 6, 1), 3)
    assert all(datetime.fromisoformat(w["departure_date"]) < orbital.WINDOWS_UNTIL for w in late["windows"])


def test_position_single_flight_and_stale_only_near_day(monkeypatch):
    _nh._position_cache.clear(); _nh._last_good_position.clear(); _nh._horizons_lock = None
    st = {"n": 0, "fail": False}

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
            st["n"] += 1
            await asyncio.sleep(0.05)
            if st["fail"]:
                raise RuntimeError("NASA caída")
            return FakeResp()

    async def no_sleep(*a, **k): return None
    monkeypatch.setattr(_nh, "_retry_pause", no_sleep)
    monkeypatch.setattr(_nh.httpx, "AsyncClient", FakeClient)

    async def both():
        return await asyncio.gather(*(_nh.get_body_position("mars", datetime(2026, 11, 13)) for _ in range(4)))

    res = asyncio.run(both())
    assert st["n"] == 1 and all(r["x_au"] == 1.0 for r in res)                      # una sola consulta
    st["fail"] = True
    late = asyncio.run(_nh.get_body_position("mars", datetime(2026, 11, 14)))
    # el de ayer sirve, pero con SU fecha (y la pedida aparte)
    assert late["stale"] is True and late["date"] == "2026-11-13" and late["requested_date"].startswith("2026-11-14")
    with pytest.raises(RuntimeError):                                              # el de hace un año, no
        asyncio.run(_nh.get_body_position("mars", datetime(2027, 11, 14)))
    _nh._position_cache.clear(); _nh._last_good_position.clear(); _nh._horizons_lock = None


def test_unexpected_500_is_generic(monkeypatch):
    def boom(*a, **k):
        raise KeyError("/srv/secreto/ruta.py")
    monkeypatch.setattr(_main.orbital, "find_launch_windows", boom)
    _main._windows_cache.clear()
    r = client.get("/api/launch-windows/earth/uranus")
    assert r.status_code == 500 and "secreto" not in r.text and "(id " in r.json()["detail"]
    _main._windows_cache.clear()


def test_expensive_routes_rate_limited(monkeypatch):
    monkeypatch.setattr(_main, "API_RATE_PER_MIN", 2)
    monkeypatch.setattr(_main, "api_limiter", _metrics.RateLimiter(per_minute=2))
    h = {"x-real-ip": "203.0.113.50"}
    codes = [client.get("/api/launch-windows/earth/earth", headers=h).status_code for _ in range(3)]
    assert codes == [400, 400, 429]
    r = client.get("/api/launch-windows/earth/earth", headers=h)
    assert r.headers["retry-after"] == "60" and "no-store" in r.headers["cache-control"]
    # las baratas y las OPTIONS no cuentan; otra IP tampoco comparte cubeta
    assert client.get("/api/bodies", headers=h).status_code == 200
    assert client.options("/api/route", headers={**h, "Origin": "https://x.org", "Access-Control-Request-Method": "POST"}).status_code == 200
    assert client.get("/api/launch-windows/earth/earth", headers={"x-real-ip": "203.0.113.51"}).status_code == 400


def test_nosniff_and_docs_flag():
    r = client.get("/api/bodies")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 200                         # TESEO_DOCS=1 por defecto


def test_version_matches_package_json():
    from app.version import VERSION
    pkg = os.path.join(os.path.dirname(__file__), "..", "..", "package.json")
    if not os.path.exists(pkg):
        pytest.skip("sin package.json (imagen del backend)")
    with open(pkg, encoding="utf-8") as f:
        assert _json.load(f)["version"] == VERSION == _main.VERSION
    from app import peaks
    assert f"Teseo/{VERSION} " in peaks.WD_UA


def test_trajectory_none_when_lambert_does_not_converge(monkeypatch):
    import numpy as np
    from app import lambert, orbital
    real = lambert._eval_pairs

    def nan_on_single(o, d, dep, arr):
        g = real(o, d, dep, arr)
        if len(np.atleast_1d(dep)) == 1:
            g = dict(g); g["vinf_dep"] = np.array([np.nan])
        return g

    monkeypatch.setattr(lambert, "_eval_pairs", nan_on_single)
    hoy = datetime(2026, 6, 1)
    w = orbital.find_launch_windows("earth", "mars", hoy, 1)["windows"][0]
    h = orbital.compute_hohmann_transfer("earth", "mars", datetime.fromisoformat(w["departure_date"])).to_dict()
    with pytest.raises(ValueError):
        lambert.compute_trajectory("earth", "mars", w, h, hoy)


def test_tiles_decoded_only_in_their_format():
    import io as _io
    from PIL import Image, UnidentifiedImageError
    from app import horizon, landcolor
    buf = _io.BytesIO(); Image.new("RGB", (256, 256), (1, 2, 3)).save(buf, "JPEG")
    with pytest.raises(UnidentifiedImageError):
        horizon.decode_terrarium(buf.getvalue())                                   # el relieve solo es PNG
    png = _io.BytesIO(); Image.new("RGB", (256, 256), (1, 2, 3)).save(png, "PNG")
    with pytest.raises(UnidentifiedImageError):
        landcolor.decode_jpeg(png.getvalue())                                      # el satélite solo es JPEG
