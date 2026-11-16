"""Tests de «Teseo en números»: GET /api/metrics/public (sin token) y MetricsStore.public_summary.
Sin red: el almacén vive en un directorio temporal y el reloj es fijo (2026-11-14 UTC)."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import pytest
from fastapi.testclient import TestClient

from app import main, metrics

client = TestClient(main.app)

T0 = 1794614400.0          # 2026-11-14 00:00 UTC
DAY = 86400
TOP_KEYS = {"value", "count"}
CONTRACT_KEYS = {"generated", "from", "to", "days", "since", "totals", "by_day", "devices", "top", "all_time", "note"}
TOTALS_KEYS = {"visits", "page_views", "shares", "reminders", "questions_opened", "sky_selections"}


class Clock:
    def __init__(self, t=T0 + 12 * 3600):
        self.t = t

    def __call__(self):
        return self.t


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def store(monkeypatch, tmp_path, clock):
    monkeypatch.delenv("TESEO_METRICS_UTC_OFFSET_HOURS", raising=False)
    s = metrics.MetricsStore(str(tmp_path), clock=clock)
    monkeypatch.setattr(main, "metrics_store", s)
    monkeypatch.setenv("TESEO_METRICS_TOKEN", "secreto")   # el panel #admin y /summary la exigen
    return s


def rec(store, n, e, p=None, device=None):
    for _ in range(n):
        store.record([{"e": e, "p": p or {}}], device)


def fill(store, clock):
    """Un uso realista: 3 días atrás y hoy, con valores por encima y por debajo del umbral."""
    clock.t = T0 - 3 * DAY + 3600            # 2026-11-11
    rec(store, 4, "session_start", {"lang": "es", "tab": "route"}, "mobile")
    rec(store, 6, "page_view", {"tab": "route"})
    clock.t = T0 + 3600                      # 2026-11-14 (hoy)
    rec(store, 14, "session_start", {"lang": "es", "tab": "sky"}, "mobile")
    rec(store, 5, "session_start", {"lang": "en", "tab": "route"}, "desktop")
    rec(store, 3, "session_start", {"lang": "es", "tab": "now"}, "tablet")
    rec(store, 30, "page_view", {"tab": "sky"})
    rec(store, 7, "tab_change", {"tab": "questions"})
    rec(store, 2, "tab_change", {"tab": "now"})
    rec(store, 6, "q_open", {"q": "drake"})
    rec(store, 4, "q_open", {"q": "gw"})                # bajo el umbral → no se publica
    rec(store, 9, "sky_select", {"kind": "planet", "id": "Mars"})
    rec(store, 5, "sky_select", {"kind": "constellation", "id": "Ori"})
    rec(store, 5, "sky_select", {"kind": "star", "id": "Betelgeuse"})
    rec(store, 3, "sky_select", {"kind": "messier", "id": "M31"})   # bajo el umbral
    rec(store, 50, "sky_select", {"kind": "star", "id": "Hola mundo"})   # inventado: nunca se publica
    rec(store, 8, "destination_change", {"origin": "earth", "destination": "mars"})
    rec(store, 2, "destination_change", {"origin": "earth", "destination": "venus"})
    rec(store, 3, "sky_postcard", {"state": "ok"})
    rec(store, 1, "sky_postcard", {"state": "fail"})
    rec(store, 2, "now_share", {"kind": "moon", "state": "ok"})
    rec(store, 1, "sky_share", {"state": "ok"})          # copiar enlace: no es una imagen
    rec(store, 2, "push_remind", {"kind": "on"})
    rec(store, 5, "push_remind", {"kind": "denied"})     # rechazos: no son recordatorios
    rec(store, 9, "net_error", {"endpoint": "launches", "kind": "timeout"})
    rec(store, 9, "q_preset", {"q": "drake", "preset": "optimista"})
    rec(store, 6, "language_change", {"lang": "en"})
    store.flush()


@pytest.fixture(autouse=True)
def _admin_token(monkeypatch):
    monkeypatch.setenv("TESEO_METRICS_TOKEN", "secreto")


def admin_get(url, **kw):
    headers = {"Authorization": "Bearer secreto", **kw.pop("headers", {})}
    return client.get(url, headers=headers, **kw)


def test_contract_exact(store, clock):
    fill(store, clock)
    r = admin_get("/api/metrics/admin?days=7")
    assert r.status_code == 200
    d = r.json()
    assert set(d) == CONTRACT_KEYS
    assert d["from"] == "2026-11-08" and d["to"] == "2026-11-14" and d["days"] == 7
    assert d["generated"].startswith("2026-11-14T") and d["generated"].endswith("+00:00")
    assert d["since"] == "2026-11-11"
    assert set(d["totals"]) == TOTALS_KEYS
    assert d["totals"] == {"visits": 26, "page_views": 36, "shares": 5, "reminders": 2,
                           "questions_opened": 10, "sky_selections": 72}
    assert [x["date"] for x in d["by_day"]] == [f"2026-11-{i:02d}" for i in range(8, 15)]
    assert all(set(x) == {"date", "visits", "page_views"} for x in d["by_day"])
    assert d["by_day"][3] == {"date": "2026-11-11", "visits": 4, "page_views": 6}
    assert d["by_day"][-1] == {"date": "2026-11-14", "visits": 22, "page_views": 30}
    assert d["by_day"][0] == {"date": "2026-11-08", "visits": 0, "page_views": 0}
    assert set(d["top"]) == {"tabs", "tours", "sky_objects", "routes"}
    for lst in d["top"].values():
        assert all(set(x) == TOP_KEYS and isinstance(x["count"], int) for x in lst)
    assert d["all_time"] == {"visits": 26, "page_views": 36}
    assert isinstance(d["note"], str) and "no personas únicas" in d["note"] and "cookies" in d["note"]


def test_threshold_and_known_values_only(store, clock):
    fill(store, clock)
    top = admin_get("/api/metrics/admin?days=7").json()["top"]
    assert metrics.PUBLIC_MIN_COUNT == 5
    # pestañas = entrada (page_view) + cambios (tab_change); "now" (2) queda fuera
    assert top["tabs"] == [{"value": "sky", "count": 30}, {"value": "questions", "count": 7}, {"value": "route", "count": 6}]
    assert top["tours"] == [{"value": "drake", "count": 6}]
    assert top["sky_objects"] == [{"value": "Mars", "count": 9}, {"value": "Betelgeuse", "count": 5}, {"value": "Ori", "count": 5}]
    assert top["routes"] == [{"value": "earth>mars", "count": 8}]
    for lst in top.values():
        assert all(x["count"] >= metrics.PUBLIC_MIN_COUNT for x in lst)
        assert len(lst) <= metrics.PUBLIC_TOP


def test_top_is_capped_at_8(store, clock):
    clock.t = T0 + 3600
    for i in range(1, 13):
        rec(store, 5 + i, "sky_select", {"kind": "messier", "id": f"M{i}"})
    lst = store.public_summary(7)["top"]["sky_objects"]
    assert len(lst) == 8 and lst[0] == {"value": "M12", "count": 17} and lst[-1]["value"] == "M5"


def test_nothing_outside_the_contract(store, clock):
    fill(store, clock)
    raw = admin_get("/api/metrics/admin?days=30").text
    for word in ("net_error", "launches", "timeout", "preset", "optimista", "lang", "screen", "storage",
                 "utc_offset", "Hola mundo", "M31", "venus", "denied", "events", "_other"):
        assert word not in raw, word


def test_public_sky_ids():
    ok = ["Mars", "Moon", "Sun", "Ori", "UMa", "M1", "M31", "M110", "C1", "C109", "LMC", "SMC", "Sirius", "Betelgeuse", "Sgr A*"]
    bad = ["M0", "M111", "C110", "C0", "Hola", "mars", "ORI", "M31 ", "Sirio", "<b>", ""]
    assert all(metrics.public_sky_id(v) for v in ok), [v for v in ok if not metrics.public_sky_id(v)]
    assert not any(metrics.public_sky_id(v) for v in bad), [v for v in bad if metrics.public_sky_id(v)]


def test_public_sky_names_in_sync_with_app_catalogs():
    """app/public_sky_ids.json debe tener los mismos nombres que sirve la app (public/sky.json y public/blackholes.json)."""
    root = os.path.join(os.path.dirname(__file__), "..", "..", "public")
    sky_p, bh_p = os.path.join(root, "sky.json"), os.path.join(root, "blackholes.json")
    if not (os.path.exists(sky_p) and os.path.exists(bh_p)):
        pytest.skip("sin los catálogos del frontend (backend desplegado por separado)")
    with open(sky_p, encoding="utf-8") as f:
        stars = {s[7] for s in json.load(f)["stars"] if len(s) > 7 and s[7]}
    with open(bh_p, encoding="utf-8") as f:
        bhs = {o["name"] for o in json.load(f)["objects"]}
    assert metrics.PUBLIC_SKY_NAMES == stars | bhs
    with open(sky_p, encoding="utf-8") as f:
        assert {c["ab"] for c in json.load(f)["constellations"]} == metrics._IAU_ABBR


def test_devices_null_below_20(store, clock):
    clock.t = T0 + 3600
    rec(store, 12, "session_start", {"tab": "route"}, "mobile")
    rec(store, 7, "session_start", {"tab": "route"}, "desktop")
    rec(store, 5, "session_start", {"tab": "route"}, None)      # sin dispositivo: no cuenta para el umbral
    d = store.public_summary(7)
    assert d["totals"]["visits"] == 24 and d["devices"] is None
    rec(store, 1, "session_start", {"tab": "route"}, "tablet")
    dev = store.public_summary(7)["devices"]
    assert set(dev) == {"mobile", "tablet", "desktop"} and sum(dev.values()) == 100
    assert dev == {"mobile": 60, "tablet": 5, "desktop": 35}


def test_percentages_sum_100():
    for counts in ({"mobile": 1, "tablet": 1, "desktop": 1}, {"mobile": 2, "tablet": 1, "desktop": 0},
                   {"mobile": 7, "tablet": 13, "desktop": 9}, {"mobile": 333, "tablet": 333, "desktop": 334},
                   {"mobile": 20, "tablet": 0, "desktop": 0}):
        p = metrics._percentages(counts)
        assert sum(p.values()) == 100 and all(isinstance(v, int) and v >= 0 for v in p.values()), (counts, p)
    # mayor resto: 7/29 = 24,1 · 13/29 = 44,8 · 9/29 = 31,0 → 24 + 45 + 31
    assert metrics._percentages({"mobile": 7, "tablet": 13, "desktop": 9}) == {"mobile": 24, "tablet": 45, "desktop": 31}
    assert metrics._percentages({"mobile": 0, "tablet": 0, "desktop": 0}) == {"mobile": 0, "tablet": 0, "desktop": 0}


def test_days_validation(store, clock):
    for bad in ("0", "1", "8", "400", "1000", "-7", "abc", "7.5"):
        r = admin_get(f"/api/metrics/admin?days={bad}")
        assert r.status_code == 422, bad
        assert "no-store" in r.headers.get("cache-control", "")
    for good in (7, 30, 90, 365):
        d = admin_get(f"/api/metrics/admin?days={good}").json()
        assert d["days"] == good and len(d["by_day"]) == good
    assert admin_get("/api/metrics/admin").json()["days"] == 30


def test_empty_store(store):
    d = admin_get("/api/metrics/admin").json()
    assert set(d) == CONTRACT_KEYS
    assert d["since"] is None and d["devices"] is None
    assert d["totals"] == {k: 0 for k in TOTALS_KEYS}
    assert d["top"] == {"tabs": [], "tours": [], "sky_objects": [], "routes": []}
    assert d["all_time"] == {"visits": 0, "page_views": 0}


def test_all_time_counts_whole_store(store, clock):
    clock.t = T0 - 200 * DAY
    rec(store, 3, "session_start", {"tab": "route"}, "desktop")
    rec(store, 4, "page_view", {"tab": "route"})
    clock.t = T0 + 3600
    rec(store, 2, "session_start", {"tab": "route"}, "desktop")
    d = store.public_summary(30)
    assert d["totals"]["visits"] == 2
    assert d["all_time"] == {"visits": 5, "page_views": 4}
    assert d["since"] == "2026-04-28"


def test_headers_cache_and_cors(store):
    r = client.get("/api/metrics/public?days=7", headers={"Origin": "https://www.yachaydeep.com"})
    assert r.status_code == 200
    cc = r.headers["cache-control"]
    assert "public" in cc and "max-age=600" in cc and "s-maxage=600" in cc
    assert r.headers.get("access-control-allow-origin") in ("*", "https://www.yachaydeep.com")


def test_cors_open_even_with_restricted_origins(store):
    """En producción ALLOWED_ORIGINS puede limitarse al dominio de Teseo: el endpoint
    público sigue legible desde https://www.yachaydeep.com (GET simple, sin preflight)."""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    app = FastAPI()
    app.add_api_route("/api/metrics/public", main.metrics_public, methods=["GET"])
    app.add_middleware(CORSMiddleware, allow_origins=["https://teseo.yachaydeep.com"], allow_methods=["*"], allow_headers=["*"])
    c = TestClient(app)
    for origin in ("https://www.yachaydeep.com", "https://yachaydeep.com", "https://teseo.yachaydeep.com"):
        r = c.get("/api/metrics/public?days=30", headers={"Origin": origin})
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") in ("*", origin), (origin, dict(r.headers))


def test_summary_still_needs_token(store, monkeypatch):
    monkeypatch.delenv("TESEO_METRICS_TOKEN", raising=False)
    assert client.get("/api/metrics/summary").status_code == 404
    monkeypatch.setenv("TESEO_METRICS_TOKEN", "secreto")
    assert client.get("/api/metrics/summary").status_code == 401
    assert client.get("/api/metrics/summary?token=secreto").status_code == 200


def test_usage_open_whitelist():
    # el panel solo se abre con #admin: el pie y el menú del Cielo ya no lo enlazan
    assert metrics.clean_event({"e": "usage_open", "p": {"from": "link"}}) == {"e": "usage_open", "p": {"from": "link"}}
    for src in ("footer", "sky"):
        assert metrics.clean_event({"e": "usage_open", "p": {"from": src}}) == {"e": "usage_open", "p": {}}
    assert metrics.clean_event({"e": "usage_open", "p": {"from": "evil", "lat": 1}}) == {"e": "usage_open", "p": {}}
    assert metrics.clean_event({"e": "usage_open"}) == {"e": "usage_open", "p": {}}


def test_note_mentions_offset(store, monkeypatch):
    monkeypatch.setenv("TESEO_METRICS_UTC_OFFSET_HOURS", "-5")
    assert "UTC−5" in store.public_summary(7)["note"]
    monkeypatch.setenv("TESEO_METRICS_UTC_OFFSET_HOURS", "0")
    assert "(UTC)" in store.public_summary(7)["note"]


# ── lo público: solo las cifras de la landing de yachaydeep.com ──────────────
def test_public_is_minimal(store, clock):
    fill(store, clock)
    r = client.get("/api/metrics/public?days=30", headers={"Origin": "https://www.yachaydeep.com"})
    assert r.status_code == 200
    d = r.json()
    assert set(d) == {"generated", "from", "to", "days", "since", "totals", "all_time", "note"}
    assert set(d["totals"]) == {"visits", "page_views", "shares"}
    assert set(d["all_time"]) == {"visits", "page_views"}
    assert r.headers.get("access-control-allow-origin") == "*"
    for word in ("top", "by_day", "devices", "tours", "sky_objects", "routes", "reminders"):
        assert word not in r.text


def test_admin_needs_token(store):
    assert client.get("/api/metrics/admin?days=7").status_code == 401
    assert client.get("/api/metrics/admin?days=7", headers={"Authorization": "Bearer otro"}).status_code == 401
    assert admin_get("/api/metrics/admin?days=7").status_code == 200


def test_admin_is_not_cached(store):
    r = admin_get("/api/metrics/admin?days=7")
    assert "no-store" in r.headers["cache-control"]
