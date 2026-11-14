"""Tests de las métricas de uso anónimas y agregadas (app/metrics.py + endpoints)."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import pytest
from fastapi.testclient import TestClient

from app import main, metrics

client = TestClient(main.app)

UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
UA_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
UA_TABLET = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1"
FAKE_IP = "203.0.113.77"


class Clock:
    def __init__(self, t=1794614400.0):    # 2026-11-14 00:00 UTC
        self.t = t

    def __call__(self):
        return self.t


@pytest.fixture
def store(monkeypatch, tmp_path):
    s = metrics.MetricsStore(str(tmp_path))
    monkeypatch.setattr(main, "metrics_store", s)
    monkeypatch.setattr(main, "metrics_limiter", metrics.RateLimiter())
    monkeypatch.delenv("TESEO_METRICS_TOKEN", raising=False)
    return s


def post(body, ua=UA_DESKTOP, ctype="text/plain;charset=UTF-8", ip=FAKE_IP, path="/api/m"):
    data = body if isinstance(body, (bytes, str)) else json.dumps(body)
    return client.post(path, content=data, headers={"content-type": ctype, "user-agent": ua, "x-forwarded-for": ip})


def day_counters(store, ev):
    snap = store.snapshot()
    return {k: v for d in snap["days"].values() for k, v in d.get(ev, {}).items()}


# ─── Lista blanca ─────────────────────────────────────────────────────────────

def test_whitelist_events_and_params():
    assert metrics.clean_event({"e": "tab_change", "p": {"tab": "sky"}}) == {"e": "tab_change", "p": {"tab": "sky"}}
    assert metrics.clean_event({"e": "evento_inventado", "p": {}}) is None
    assert metrics.clean_event({"e": "TAB_CHANGE"}) is None
    assert metrics.clean_event("tab_change") is None
    # claves fuera de lista y valores fuera del conjunto se descartan; el evento cuenta
    ev = metrics.clean_event({"e": "tab_change", "p": {"tab": "hacker", "lat": -0.04, "email": "a@b.c"}})
    assert ev == {"e": "tab_change", "p": {}}
    ev = metrics.clean_event({"e": "destination_change", "p": {"origin": "earth", "destination": "mars", "lon": -78}})
    assert ev["p"] == {"origin": "earth", "destination": "mars"}
    # tokens: cortos y sin caracteres raros
    assert metrics.clean_event({"e": "sky_select", "p": {"kind": "messier", "id": "M31"}})["p"] == {"kind": "messier", "id": "M31"}
    assert metrics.clean_event({"e": "sky_select", "p": {"id": "Sgr A*"}})["p"] == {"id": "Sgr A*"}
    assert metrics.clean_event({"e": "sky_select", "p": {"id": "x" * 41}})["p"] == {}
    assert metrics.clean_event({"e": "sky_select", "p": {"id": "<script>"}})["p"] == {}
    assert metrics.clean_event({"e": "sky_select", "p": {"id": "https://evil.example/x?y"}})["p"] == {}
    assert metrics.clean_event({"e": "q_preset", "p": {"q": "drake", "preset": {"a": 1}}})["p"] == {"q": "drake"}
    assert metrics.clean_event({"e": "night_vision", "p": {"state": True}})["p"] == {"state": "on"}


def test_special_dest_moon_sun():
    # ¿Y la Luna? ¿Y el Sol?: solo moon/sun y tres tipos cerrados
    assert metrics.clean_event({"e": "special_dest", "p": {"destination": "moon", "kind": "view"}}) == {"e": "special_dest", "p": {"destination": "moon", "kind": "view"}}
    assert metrics.clean_event({"e": "special_dest", "p": {"destination": "sun", "kind": "venus"}})["p"] == {"destination": "sun", "kind": "venus"}
    assert metrics.clean_event({"e": "special_dest", "p": {"kind": "link"}})["p"] == {"kind": "link"}
    assert metrics.clean_event({"e": "special_dest", "p": {"destination": "mars", "kind": "hack", "dest": "moon"}})["p"] == {}


def test_parse_body_shapes():
    one = json.dumps({"e": "q_open", "p": {"q": "bh"}}).encode()
    assert len(metrics.parse_body(one)) == 1
    batch = json.dumps({"events": [{"e": "q_open", "p": {"q": "bh"}}] * 30}).encode()
    assert len(metrics.parse_body(batch)) == metrics.MAX_BATCH
    assert metrics.parse_body(b"no es json") == []
    assert metrics.parse_body(b"") == []
    assert metrics.parse_body(b"x" * (metrics.MAX_BODY_BYTES + 1)) == []
    assert metrics.parse_body(b"[1,2,3]") == []


def test_device_category():
    assert metrics.device_category(UA_MOBILE) == "mobile"
    assert metrics.device_category(UA_DESKTOP) == "desktop"
    assert metrics.device_category(UA_TABLET) == "tablet"
    assert metrics.device_category("Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 Chrome/130 Safari/537.36") == "tablet"
    assert metrics.device_category("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36") == "mobile"
    assert metrics.device_category("Googlebot/2.1 (+http://www.google.com/bot.html)") is None
    assert metrics.device_category("Mozilla/5.0 HeadlessChrome/130.0") is None
    assert metrics.device_category("") is None


# ─── Endpoint y agregación ────────────────────────────────────────────────────

def test_post_always_204_and_aggregates(store):
    for _ in range(3):
        assert post({"e": "tab_change", "p": {"tab": "sky"}}).status_code == 204
    assert post({"e": "tab_change", "p": {"tab": "questions"}}).status_code == 204
    assert post({"e": "inventado"}).status_code == 204
    assert post(b"{basura").status_code == 204
    assert post(b"x" * 10000).status_code == 204
    r = post({"e": "tab_change", "p": {"tab": "route"}}, path="/api/metrics/event")
    assert r.status_code == 204 and r.content == b""
    c = day_counters(store, "tab_change")
    assert c == {"_": 5, "tab:sky": 3, "tab:questions": 1, "tab:route": 1}
    assert "inventado" not in store.snapshot()["days"].get(metrics.utc_day(), {})


def test_batch_and_session_device(store):
    batch = {"events": [
        {"e": "session_start", "p": {"lang": "es", "screen": "small", "tab": "route"}},
        {"e": "page_view", "p": {"tab": "route"}},
        {"e": "destination_change", "p": {"origin": "earth", "destination": "jupiter"}},
    ]}
    post(batch, ua=UA_MOBILE)
    post({"e": "session_start", "p": {"lang": "en", "screen": "large", "tab": "sky"}}, ua=UA_DESKTOP)
    s = day_counters(store, "session_start")
    assert s["_"] == 2 and s["device:mobile"] == 1 and s["device:desktop"] == 1 and s["lang:en"] == 1
    assert day_counters(store, "destination_change")["pair:earth>jupiter"] == 1
    # el dispositivo solo se cuenta en session_start
    assert not any(k.startswith("device:") for k in day_counters(store, "page_view"))


def test_bots_not_counted(store):
    post({"e": "tab_change", "p": {"tab": "sky"}}, ua="Googlebot/2.1")
    post({"e": "tab_change", "p": {"tab": "sky"}}, ua="")
    assert day_counters(store, "tab_change") == {}


def test_beacon_text_plain_and_json_accepted(store):
    post({"e": "q_open", "p": {"q": "drake"}}, ctype="text/plain;charset=UTF-8")
    post({"e": "q_open", "p": {"q": "drake"}}, ctype="application/json")
    post({"e": "q_open", "p": {"q": "drake"}}, ctype="")
    assert day_counters(store, "q_open")["q:drake"] == 3


def test_rate_limit(store, monkeypatch):
    monkeypatch.setattr(main, "metrics_limiter", metrics.RateLimiter(per_minute=25))
    batch = {"events": [{"e": "q_slider", "p": {"q": "bh"}}] * 20}
    post(batch, ip="198.51.100.1")
    post(batch, ip="198.51.100.1")              # solo caben 5 más
    post(batch, ip="198.51.100.2")              # otro origen: su propio cupo
    assert day_counters(store, "q_slider")["_"] == 45


def test_rate_limiter_window_and_no_raw_ip():
    clock = Clock()
    rl = metrics.RateLimiter(per_minute=3, clock=clock)
    assert rl.allow("192.0.2.9", 2) == 2
    assert rl.allow("192.0.2.9", 2) == 1
    assert rl.allow("192.0.2.9", 1) == 0
    assert all("192.0.2.9" not in k for k in rl._counts)
    clock.t += 61                                # nuevo minuto: sal y contadores nuevos
    assert rl.allow("192.0.2.9", 3) == 3
    assert rl.size() == 1


def test_distinct_values_capped(store):
    for i in range(metrics.MAX_KEYS_PER_EVENT + 50):
        store.record([{"e": "sky_select", "p": {"id": f"HIP{i}"}}])
    c = day_counters(store, "sky_select")
    assert len(c) <= metrics.MAX_KEYS_PER_EVENT + 1
    assert c["_"] == metrics.MAX_KEYS_PER_EVENT + 50
    assert c["id:_other"] >= 50


# ─── Persistencia ─────────────────────────────────────────────────────────────

def test_persist_atomic_and_reload(tmp_path):
    s = metrics.MetricsStore(str(tmp_path))
    assert s.persistent
    s.record([{"e": "tab_change", "p": {"tab": "sky"}}] * 4)
    assert s.flush()
    path = tmp_path / metrics.FILE_NAME
    assert path.exists()
    assert not [p for p in os.listdir(tmp_path) if ".tmp" in p]          # sin temporales sueltos
    # recarga en un proceso "nuevo"
    s2 = metrics.MetricsStore(str(tmp_path))
    assert day_counters(s2, "tab_change") == {"_": 4, "tab:sky": 4}
    # dos procesos a la vez (redespliegue): ninguno pisa al otro
    s.record([{"e": "tab_change", "p": {"tab": "sky"}}])
    s2.record([{"e": "tab_change", "p": {"tab": "sky"}}] * 2)
    s.flush(); s2.flush()
    s3 = metrics.MetricsStore(str(tmp_path))
    assert day_counters(s3, "tab_change")["_"] == 7


def test_atomic_write_failure_keeps_old_file(tmp_path, monkeypatch):
    s = metrics.MetricsStore(str(tmp_path))
    s.record([{"e": "q_open", "p": {"q": "bh"}}])
    s.flush()
    before = (tmp_path / metrics.FILE_NAME).read_text()

    def boom(*a, **k):
        raise OSError("disco lleno")
    monkeypatch.setattr(metrics.os, "replace", boom)
    s.record([{"e": "q_open", "p": {"q": "bh"}}])
    assert s.flush() is False
    assert (tmp_path / metrics.FILE_NAME).read_text() == before         # el archivo bueno sigue intacto
    assert day_counters(s, "q_open")["_"] == 2                          # y lo nuevo no se pierde
    assert "escritura" in s.status()["error"]


def test_memory_mode_without_dir_or_unwritable(tmp_path):
    s = metrics.MetricsStore(None)
    assert not s.persistent and s.status()["storage"] == "memory"
    s.record([{"e": "q_index", "p": {}}])
    s.flush()
    assert day_counters(s, "q_index")["_"] == 1
    ro = tmp_path / "ro"
    ro.mkdir()
    os.chmod(ro, 0o500)
    try:
        if os.access(str(ro), os.W_OK):            # root ignora permisos: no se puede probar aquí
            pytest.skip("ejecutando como root")
        s2 = metrics.MetricsStore(str(ro))
        assert not s2.persistent and "no escribible" in s2.status()["reason"]
    finally:
        os.chmod(ro, 0o700)


def test_unwritable_path_is_a_file(tmp_path):
    f = tmp_path / "soy-un-archivo"
    f.write_text("x")
    s = metrics.MetricsStore(str(f))
    assert not s.persistent and s.status()["storage"] == "memory"


def test_day_offset(monkeypatch):
    t = 1794614400.0 + 2 * 3600                 # 2026-11-14 02:00 UTC = 13-nov 21:00 en Ecuador
    assert metrics.utc_day(t) == "2026-11-14"
    monkeypatch.setenv("TESEO_METRICS_UTC_OFFSET_HOURS", "-5")
    assert metrics.utc_day(t) == "2026-11-13"
    monkeypatch.setenv("TESEO_METRICS_UTC_OFFSET_HOURS", "basura")
    assert metrics.utc_day(t) == "2026-11-14"


def test_retention_prunes_old_days(tmp_path):
    clock = Clock()
    s = metrics.MetricsStore(str(tmp_path), clock=clock, retain_days=3)
    s.record([{"e": "q_index", "p": {}}])
    s.flush()
    clock.t += 5 * 86400
    s.record([{"e": "q_index", "p": {}}])
    s.flush()
    days = s.snapshot()["days"]
    assert len(days) == 1 and metrics.utc_day(clock.t) in days


def test_file_never_contains_ip_or_user_agent(store):
    secret_ip = "198.51.100.234"
    ua = UA_MOBILE + " TeseoMarcaUnica/9.9"
    for ev in ({"e": "session_start", "p": {"lang": "es", "screen": "small", "tab": "sky"}},
               {"e": "tab_change", "p": {"tab": "sky"}}):
        post(ev, ua=ua, ip=secret_ip)
    store.flush()
    raw = (open(store.path, encoding="utf-8").read())
    assert secret_ip not in raw and "198.51.100" not in raw
    assert "TeseoMarcaUnica" not in raw and "iPhone" not in raw and "Mozilla" not in raw
    data = json.loads(raw)
    assert set(data) == {"version", "days"}
    # solo fechas como claves de día (sin marcas de tiempo individuales)
    assert all(len(d) == 10 for d in data["days"])
    assert "device:mobile" in data["days"][metrics.utc_day()]["session_start"]


# ─── Lectura protegida ────────────────────────────────────────────────────────

def test_summary_404_without_token_configured(store):
    assert client.get("/api/metrics/summary").status_code == 404
    assert client.get("/api/metrics/summary.csv?token=x").status_code == 404


def test_summary_401_and_ok(store, monkeypatch):
    monkeypatch.setenv("TESEO_METRICS_TOKEN", "prueba-secreta")
    post({"e": "session_start", "p": {"lang": "es", "screen": "small", "tab": "route"}}, ua=UA_MOBILE)
    post({"e": "page_view", "p": {"tab": "route"}})
    post({"e": "q_open", "p": {"q": "drake"}})
    post({"e": "sky_select", "p": {"kind": "messier", "id": "M31"}})
    assert client.get("/api/metrics/summary").status_code == 401
    r = client.get("/api/metrics/summary", headers={"Authorization": "Bearer mala"})
    assert r.status_code == 401 and r.headers.get("www-authenticate") == "Bearer"
    r = client.get("/api/metrics/summary?days=7", headers={"Authorization": "Bearer prueba-secreta"})
    assert r.status_code == 200
    assert "no-store" in r.headers["cache-control"] and "public" not in r.headers["cache-control"]
    data = r.json()
    assert data["days"] == 7 and len(data["by_day"]) == 7
    assert data["totals"]["sessions"] == 1 and data["totals"]["page_views"] == 1
    assert data["devices"]["mobile"] == 1
    assert data["events"]["q_open"]["params"]["q"] == {"drake": 1}
    assert data["top"]["tours"] == [{"value": "drake", "count": 1}]
    assert data["top"]["sky_objects"] == [{"value": "M31", "count": 1}]
    assert data["by_day"][-1]["date"] == metrics.utc_day()
    # también con ?token=
    assert client.get("/api/metrics/summary?token=prueba-secreta").status_code == 200


def test_summary_csv(store, monkeypatch):
    monkeypatch.setenv("TESEO_METRICS_TOKEN", "t0k")
    post({"e": "tab_change", "p": {"tab": "sky"}})
    post({"e": "tab_change", "p": {"tab": "sky"}})
    assert client.get("/api/metrics/summary.csv").status_code == 401
    r = client.get("/api/metrics/summary.csv", headers={"Authorization": "Bearer t0k"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "no-store" in r.headers["cache-control"]
    lines = r.text.strip().split("\n")
    assert lines[0] == "date,event,param,value,count"
    today = metrics.utc_day()
    assert f"{today},tab_change,,,2" in lines and f"{today},tab_change,tab,sky,2" in lines


def test_health_shows_only_status(store):
    post({"e": "tab_change", "p": {"tab": "sky"}})
    m = client.get("/api/health").json()["metrics"]
    assert m["storage"] == "persistent" and m["events_today"] == 1 and m["days_stored"] == 1
    assert set(m) <= {"storage", "days_stored", "events_today", "reason", "error", "railway_volume"}


def test_status_warns_without_railway_volume(tmp_path, monkeypatch):
    monkeypatch.setenv("RAILWAY_PROJECT_ID", "x")
    monkeypatch.delenv("RAILWAY_VOLUME_MOUNT_PATH", raising=False)
    assert metrics.MetricsStore(str(tmp_path)).status()["railway_volume"] is False
    monkeypatch.setenv("RAILWAY_VOLUME_MOUNT_PATH", str(tmp_path))
    assert metrics.MetricsStore(str(tmp_path)).status()["railway_volume"] is True


# ─── CORS ─────────────────────────────────────────────────────────────────────

def test_cors_preflight_and_simple_post(store):
    origin = "https://teseo.yachaydeep.com"
    r = client.options("/api/m", headers={
        "Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type",
    })
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") in ("*", origin)
    assert "POST" in r.headers.get("access-control-allow-methods", "") or r.headers.get("access-control-allow-methods") == "*"
    r = client.post("/api/m", content=json.dumps({"e": "tab_change", "p": {"tab": "sky"}}),
                    headers={"Origin": origin, "content-type": "text/plain", "user-agent": UA_DESKTOP})
    assert r.status_code == 204
    assert r.headers.get("access-control-allow-origin") in ("*", origin)


def test_cors_with_restricted_origins():
    """Con ALLOWED_ORIGINS de producción, el preflight desde el dominio del
    frontend también pasa (misma configuración que main.py)."""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    app = FastAPI()
    app.add_api_route("/api/m", main.metrics_event, methods=["POST"], status_code=204)
    app.add_middleware(CORSMiddleware, allow_origins=["https://teseo.yachaydeep.com"], allow_methods=["*"], allow_headers=["*"])
    c = TestClient(app)
    r = c.options("/api/m", headers={"Origin": "https://teseo.yachaydeep.com", "Access-Control-Request-Method": "POST",
                                     "Access-Control-Request-Headers": "content-type"})
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == "https://teseo.yachaydeep.com"
    r = c.options("/api/m", headers={"Origin": "https://otro.example", "Access-Control-Request-Method": "POST"})
    assert r.status_code == 400
