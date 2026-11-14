"""Tests de «Recordarme» (app/push.py): alta, baja, topes, vencimientos, borrado tras enviar, 404/410,
validación de entrada y ausencia de datos personales. El envío se simula (salvo una prueba que cifra de
verdad con pywebpush y descifra con la clave del «navegador», sin red)."""
import base64
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app import main, metrics, push

client = TestClient(main.app)

T0 = 1794614400.0      # 2026-11-14 00:00 UTC
IP = "203.0.113.9"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def keypair():
    k = ec.generate_private_key(ec.SECP256R1())
    pub = k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return k, b64(pub), b64(k.private_numbers().private_value.to_bytes(32, "big"))


_, VAPID_PUB, VAPID_PRIV = keypair()


class Clock:
    def __init__(self, t=T0):
        self.t = t

    def __call__(self):
        return self.t


class FakeSender:
    """Sustituye a pywebpush: guarda lo que se habría enviado y responde con el código indicado."""

    def __init__(self, status=201):
        self.status = status          # int, o dict endpoint → int
        self.calls = []

    def __call__(self, sub, data, ttl, urgency):
        self.calls.append({"sub": sub, "data": json.loads(data), "ttl": ttl, "urgency": urgency})
        if isinstance(self.status, dict):
            return self.status.get(sub["endpoint"], 201)
        return self.status


def make_sub(n=1, host="fcm.googleapis.com"):
    _, pub, _ = keypair()
    return {"endpoint": f"https://{host}/fcm/send/fake-{n}:APA91b{n:04d}", "expirationTime": None,
            "keys": {"p256dh": pub, "auth": b64(os.urandom(16))}}


def iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def remind_body(sub, event_id="moon-full-20261124", at=T0 + 3 * 3600, lead=30, lang="es", **ev):
    event = {"id": event_id, "title": "Luna llena", "at_utc": iso(at), "url": "/#ahora", **ev}
    return {"subscription": sub, "event": event, "lead_min": lead, "lang": lang}


@pytest.fixture
def svc(monkeypatch, tmp_path):
    clock = Clock()
    s = push.PushService(push.load_vapid(VAPID_PUB, VAPID_PRIV, "mailto:pruebas@example.invalid"),
                         push.PushStore(str(tmp_path)), sender=FakeSender(), clock=clock)
    s.clock_obj = clock
    monkeypatch.setattr(push, "service", s)
    monkeypatch.delenv("TESEO_PUSH_EXTRA_HOSTS", raising=False)
    yield s
    s.store.close()


def post(path, body, ip=IP):
    data = body if isinstance(body, (bytes, str)) else json.dumps(body)
    return client.post(path, content=data, headers={"content-type": "application/json", "x-forwarded-for": ip, "user-agent": UA})


def delete(body, ip=IP):
    data = body if isinstance(body, (bytes, str)) else json.dumps(body)
    return client.request("DELETE", "/api/push/remind", content=data,
                          headers={"content-type": "application/json", "x-forwarded-for": ip, "user-agent": UA})


def run_tick(s):
    import asyncio
    return asyncio.run(s.tick())


# ─── Claves y configuración ───────────────────────────────────────────────────

def test_key_endpoint(svc):
    r = client.get("/api/push/key")
    assert r.status_code == 200
    assert r.json()["public_key"] == VAPID_PUB
    assert r.json()["max_per_subscription"] == push.MAX_PER_SUB
    assert r.headers["cache-control"] == "public, max-age=300"


def test_without_keys_everything_503(monkeypatch, tmp_path):
    s = push.PushService(push.load_vapid(None, None, None), push.PushStore(str(tmp_path)), sender=FakeSender())
    monkeypatch.setattr(push, "service", s)
    for r in (client.get("/api/push/key"), post("/api/push/remind", remind_body(make_sub())),
              delete({"endpoint": make_sub()["endpoint"], "event_id": "x"}),
              post("/api/push/test", {"subscription": make_sub()})):
        assert r.status_code == 503
        assert r.json()["code"] == "push_not_configured"
        assert "VAPID" in r.json()["detail"]
        assert r.headers["cache-control"] == "no-store"
    assert s.store.counts() == (0, 0)
    h = client.get("/api/health").json()["push"]
    assert h["configured"] is False and "TESEO_VAPID_PUBLIC" in h["reason_config"]


def test_load_vapid_validation():
    _, pub2, priv2 = keypair()
    assert push.load_vapid(VAPID_PUB, VAPID_PRIV, "mailto:a@b.c").configured
    assert push.load_vapid(VAPID_PUB, VAPID_PRIV, "https://teseo.example").configured
    bad = push.load_vapid(VAPID_PUB, priv2, "mailto:a@b.c")
    assert not bad.configured and "par" in bad.reason
    assert not push.load_vapid(VAPID_PUB, VAPID_PRIV, "contacto").configured
    assert not push.load_vapid("abc", VAPID_PRIV, "mailto:a@b.c").configured
    assert not push.load_vapid(VAPID_PUB, "no-es-base64!", "mailto:a@b.c").configured
    # la clave privada nunca aparece en el motivo
    for cfg in (bad, push.load_vapid(VAPID_PUB, "xx" + VAPID_PRIV, "mailto:a@b.c")):
        assert VAPID_PRIV not in (cfg.reason or "") and priv2 not in (cfg.reason or "")


# ─── Alta y baja ──────────────────────────────────────────────────────────────

def test_remind_creates_and_upserts(svc):
    sub = make_sub()
    r = post("/api/push/remind", remind_body(sub, lead=30))
    assert r.status_code == 201, r.text
    j = r.json()
    assert j["ok"] and j["event_id"] == "moon-full-20261124" and j["reminders"] == 1
    assert j["notify_at_utc"] == iso(T0 + 3 * 3600 - 30 * 60)
    assert r.headers["cache-control"] == "no-store"
    # mismo evento y navegador → se actualiza (no se duplica)
    r = post("/api/push/remind", remind_body(sub, lead=120))
    assert r.status_code == 201 and r.json()["reminders"] == 1
    d = svc.store.dump()
    assert len(d["subs"]) == 1 and len(d["reminders"]) == 1
    assert d["reminders"][0]["notify_at"] == int(T0 + 3 * 3600 - 120 * 60)
    # otro evento
    r = post("/api/push/remind", remind_body(sub, event_id="meteor-Geminids-2026", at=T0 + 86400, lead=360, all_day=True))
    assert r.status_code == 201 and r.json()["reminders"] == 2


def test_notify_time_already_passed_is_clamped_to_now(svc):
    sub = make_sub()
    r = post("/api/push/remind", remind_body(sub, at=T0 + 10 * 60, lead=30))     # empieza en 10 min, aviso 30 min antes
    assert r.status_code == 201
    assert r.json()["notify_at_utc"] == iso(T0)


def test_delete_removes_reminder_and_empty_subscription(svc):
    sub = make_sub()
    post("/api/push/remind", remind_body(sub, event_id="a"))
    post("/api/push/remind", remind_body(sub, event_id="b"))
    r = delete({"endpoint": sub["endpoint"], "event_id": "a"})
    assert r.status_code == 204 and r.headers["cache-control"] == "no-store"
    assert svc.store.counts() == (1, 1)
    r = delete({"endpoint": sub["endpoint"], "event_id": "b"})
    assert r.status_code == 204
    assert svc.store.counts() == (0, 0)          # sin recordatorios → la suscripción también se borra
    # idempotente: borrar lo que no existe también es 204
    assert delete({"endpoint": sub["endpoint"], "event_id": "b"}).status_code == 204
    assert delete({"endpoint": make_sub(9)["endpoint"], "event_id": "zzz"}).status_code == 204


def test_cors_preflight_delete():
    r = client.options("/api/push/remind", headers={"Origin": "https://teseo.yachaydeep.com",
                                                    "Access-Control-Request-Method": "DELETE",
                                                    "Access-Control-Request-Headers": "content-type"})
    assert r.status_code == 200
    assert "DELETE" in r.headers.get("access-control-allow-methods", "")


# ─── Topes ────────────────────────────────────────────────────────────────────

def test_per_subscription_cap(svc):
    sub = make_sub()
    for i in range(push.MAX_PER_SUB):
        assert post("/api/push/remind", remind_body(sub, event_id=f"ev-{i}")).status_code == 201
    r = post("/api/push/remind", remind_body(sub, event_id="uno-mas"))
    assert r.status_code == 409 and r.json()["code"] == "limit_subscription"
    assert str(push.MAX_PER_SUB) in r.json()["detail"]
    # actualizar uno existente sí se puede estando en el tope
    assert post("/api/push/remind", remind_body(sub, event_id="ev-0", lead=120)).status_code == 201
    # otro navegador no se ve afectado
    assert post("/api/push/remind", remind_body(make_sub(2), event_id="uno-mas")).status_code == 201


def test_global_caps(svc, monkeypatch):
    monkeypatch.setattr(push, "MAX_SUBS", 2)
    assert post("/api/push/remind", remind_body(make_sub(1))).status_code == 201
    assert post("/api/push/remind", remind_body(make_sub(2))).status_code == 201
    r = post("/api/push/remind", remind_body(make_sub(3)))
    assert r.status_code == 503 and r.json()["code"] == "capacity"
    monkeypatch.setattr(push, "MAX_SUBS", 100)
    monkeypatch.setattr(push, "MAX_REMINDERS", 3)
    assert post("/api/push/remind", remind_body(make_sub(1), event_id="x2")).status_code == 201
    r = post("/api/push/remind", remind_body(make_sub(2), event_id="x3"))
    assert r.status_code == 503 and r.json()["code"] == "capacity"
    # el fallo no deja una suscripción huérfana
    assert post("/api/push/remind", remind_body(make_sub(4))).status_code == 503
    assert svc.store.counts() == (2, 3)


def test_rate_limit_by_origin(svc):
    svc.write_limiter = metrics.RateLimiter(3, clock=svc.clock)
    sub = make_sub()
    codes = [post("/api/push/remind", remind_body(sub, event_id=f"r{i}")).status_code for i in range(4)]
    assert codes == [201, 201, 201, 429]
    assert post("/api/push/remind", remind_body(sub, event_id="otra-ip"), ip="198.51.100.1").status_code == 201
    svc.clock_obj.t += 61
    assert post("/api/push/remind", remind_body(sub, event_id="r9")).status_code == 201


def test_body_size_limit(svc):
    big = remind_body(make_sub())
    big["relleno"] = "x" * (push.MAX_BODY_BYTES + 10)
    r = post("/api/push/remind", big)
    assert r.status_code == 413 and r.json()["code"] == "too_large"
    assert svc.store.counts() == (0, 0)


# ─── Validación de entrada ────────────────────────────────────────────────────

@pytest.mark.parametrize("endpoint", [
    "http://fcm.googleapis.com/fcm/send/x",            # sin https
    "https://localhost/fcm/send/x",                    # SSRF
    "https://127.0.0.1/x",
    "https://169.254.169.254/latest/meta-data",
    "https://evil.example/push",
    "https://fcm.googleapis.com.evil.example/x",       # sufijo engañoso
    "https://user:pw@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://fcm.googleapis.com/x y",
    "https://fcm.googleapis.com/" + "a" * 1100,
    "",
    None,
])
def test_endpoint_rejected(svc, endpoint):
    sub = make_sub()
    sub["endpoint"] = endpoint
    r = post("/api/push/remind", remind_body(sub))
    assert r.status_code == 422, (endpoint, r.text)
    assert r.json()["code"] == "invalid" and "subscription.endpoint" in r.json()["detail"]


def test_known_push_services_accepted(svc, monkeypatch):
    for i, host in enumerate(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com",
                              "wns2-par02p.notify.windows.com", "android.googleapis.com"]):
        assert post("/api/push/remind", remind_body(make_sub(i, host))).status_code == 201, host
    assert post("/api/push/remind", remind_body(make_sub(9, "push.example.org"))).status_code == 422
    monkeypatch.setenv("TESEO_PUSH_EXTRA_HOSTS", "push.example.org")
    assert post("/api/push/remind", remind_body(make_sub(9, "push.example.org"))).status_code == 201


def _bad(svc, body, needle):
    r = post("/api/push/remind", body)
    assert r.status_code == 422, r.text
    assert needle in r.json()["detail"], r.json()["detail"]


def test_input_validation(svc):
    sub = make_sub()
    s = dict(sub, keys={"p256dh": b64(b"\x04" + b"1" * 10), "auth": sub["keys"]["auth"]})
    _bad(svc, remind_body(s), "p256dh")
    s = dict(sub, keys={"p256dh": sub["keys"]["p256dh"], "auth": b64(b"short")})
    _bad(svc, remind_body(s), "auth")
    _bad(svc, remind_body(dict(sub, keys="x")), "subscription.keys")
    _bad(svc, {"event": remind_body(sub)["event"], "lead_min": 30}, "subscription")
    b = remind_body(sub); b["event"]["at_utc"] = "2026-11-14T03:00:00"              # sin zona
    _bad(svc, b, "zona horaria")
    b = remind_body(sub); b["event"]["at_utc"] = "mañana"
    _bad(svc, b, "at_utc")
    _bad(svc, remind_body(sub, at=T0 - 60), "ya empezó")
    _bad(svc, remind_body(sub, at=T0 + 500 * 86400), "días en el futuro")
    for lead in (-1, push.MAX_LEAD_MIN + 1, True, "30", 30.5, None):
        _bad(svc, remind_body(sub, lead=lead), "lead_min")
    for url in ("https://evil.example/", "//evil.example/x", "javascript:alert(1)", "/a b", "/" + "x" * 300):
        _bad(svc, remind_body(sub, url=url), "event.url")
    for eid in ("", " espacio", "a" * 200, "<script>", None, 5):
        b = remind_body(sub); b["event"]["id"] = eid
        _bad(svc, b, "event.id")
    b = remind_body(sub); b["event"]["title"] = "   "
    _bad(svc, b, "title")
    b = remind_body(sub); b["lang"] = "fr"
    _bad(svc, b, "lang")
    b = remind_body(sub); b["event"]["all_day"] = "sí"
    _bad(svc, b, "all_day")
    for raw in (b"no es json", b"\xff\xfe", b"[1, 2]", b'"texto"'):
        r = post("/api/push/remind", raw)
        assert r.status_code in (400, 422), raw
    assert delete({"endpoint": "https://evil.example/x", "event_id": "a"}).status_code == 422
    assert delete({"endpoint": sub["endpoint"]}).status_code == 422
    assert svc.store.counts() == (0, 0)


def test_title_is_cleaned_and_truncated(svc):
    sub = make_sub()
    b = remind_body(sub)
    b["event"]["title"] = "Luna‮ y\x00 Júpiter\n\n" + "á" * 200
    assert post("/api/push/remind", b).status_code == 201
    t = svc.store.dump()["reminders"][0]["title"]
    assert len(t) <= push.MAX_TITLE_LEN and t.endswith("…")
    assert "\x00" not in t and "‮" not in t and "\n" not in t
    assert t.startswith("Luna y Júpiter")


def test_meteor_ids_with_spaces_are_valid(svc):
    assert post("/api/push/remind", remind_body(make_sub(), event_id="meteor-Eta Aquariids-2027")).status_code == 201
    assert post("/api/push/remind", remind_body(make_sub(), event_id="launch-1f9c6a2e-7b1d-4f0e-9d3b-0c1e2f3a4b5c")).status_code == 201


# ─── Bucle: vencimientos, borrado tras enviar, 404/410 ────────────────────────

def test_due_reminders_are_sent_and_deleted(svc):
    sub_a, sub_b = make_sub(1), make_sub(2)
    post("/api/push/remind", remind_body(sub_a, event_id="pronto", at=T0 + 40 * 60, lead=30))   # aviso a T0+10min
    post("/api/push/remind", remind_body(sub_a, event_id="tarde", at=T0 + 5 * 3600, lead=30))
    post("/api/push/remind", remind_body(sub_b, event_id="pronto", at=T0 + 40 * 60, lead=30, lang="en"))
    assert run_tick(svc)["sent"] == 0 and svc.sender.calls == []        # nada vence aún
    svc.clock_obj.t = T0 + 10 * 60
    out = run_tick(svc)
    assert out["sent"] == 2
    calls = sorted(svc.sender.calls, key=lambda c: c["data"]["lang"])
    assert calls[0]["data"] == {"v": 1, "kind": "remind", "title": "Luna llena", "url": "/#ahora",
                                "body": "Starts in 30 min. Tap to see it in Teseo.", "tag": "teseo-pronto", "lang": "en"}
    assert calls[1]["data"]["body"] == "Empieza en 30 min. Toca para verlo en Teseo."
    assert calls[1]["urgency"] == "high" and 60 <= calls[1]["ttl"] <= 30 * 60
    # enviados → borrados; B se queda sin recordatorios → su suscripción también
    d = svc.store.dump()
    assert [r["event_id"] for r in d["reminders"]] == ["tarde"]
    assert [s["endpoint"] for s in d["subs"]] == [sub_a["endpoint"]]
    assert run_tick(svc)["sent"] == 0                                  # no se repite
    svc.clock_obj.t = T0 + 5 * 3600 - 30 * 60
    assert run_tick(svc)["sent"] == 1
    assert svc.store.counts() == (0, 0)


def test_all_day_reminder_body(svc):
    post("/api/push/remind", remind_body(make_sub(), event_id="meteor-Geminids-2026", at=T0 + 6 * 3600, lead=360, all_day=True))
    run_tick(svc)
    c = svc.sender.calls[0]
    assert c["data"]["body"].startswith("Es mañana.")
    assert c["ttl"] > 6 * 3600           # vale hasta el día del evento


@pytest.mark.parametrize("status", [404, 410])
def test_gone_subscription_is_deleted_with_all_reminders(svc, status):
    sub = make_sub()
    post("/api/push/remind", remind_body(sub, event_id="ya", at=T0 + 20 * 60, lead=30))
    post("/api/push/remind", remind_body(sub, event_id="luego", at=T0 + 9 * 3600, lead=30))
    svc.sender.status = status
    out = run_tick(svc)
    assert out["gone"] == 1
    assert svc.store.counts() == (0, 0)


def test_retry_on_5xx_then_drop(svc):
    sub = make_sub()
    post("/api/push/remind", remind_body(sub, event_id="ev", at=T0 + 3 * 3600, lead=180))
    svc.sender.status = 503
    assert run_tick(svc)["retry"] == 1
    assert svc.store.counts() == (1, 1)
    assert run_tick(svc)["retry"] == 0          # aún en espera (backoff)
    for _ in range(push.MAX_ATTEMPTS + 2):
        svc.clock_obj.t += 901
        run_tick(svc)
    assert svc.store.counts() == (0, 0)          # se descarta tras MAX_ATTEMPTS
    assert len(svc.sender.calls) == push.MAX_ATTEMPTS


def test_4xx_drops_reminder_only(svc):
    sub = make_sub()
    post("/api/push/remind", remind_body(sub, event_id="mal", at=T0 + 20 * 60, lead=30))
    post("/api/push/remind", remind_body(sub, event_id="bien", at=T0 + 9 * 3600, lead=30))
    svc.sender.status = 400
    assert run_tick(svc)["dropped"] == 1
    assert [r["event_id"] for r in svc.store.dump()["reminders"]] == ["bien"]


def test_lease_prevents_double_send(svc):
    post("/api/push/remind", remind_body(make_sub(), event_id="ev", at=T0 + 20 * 60, lead=30))
    first = svc.store.claim_due(int(T0))
    assert len(first) == 1
    assert svc.store.claim_due(int(T0)) == []             # otro proceso no lo toma mientras dura el lease
    assert len(svc.store.claim_due(int(T0) + push.LEASE_S + 1)) == 1


def test_purge_stale(svc):
    post("/api/push/remind", remind_body(make_sub(), event_id="ev", at=T0 + 20 * 60, lead=0))
    svc.clock_obj.t = T0 + 20 * 60 + push.STALE_AFTER_S + 5    # el servidor estuvo caído: ya no tiene sentido
    out = run_tick(svc)
    assert out["purged"] == 1 and out["sent"] == 0
    assert svc.store.counts() == (0, 0)


def test_tick_does_nothing_without_keys(tmp_path):
    s = push.PushService(push.load_vapid(None, None, None), push.PushStore(str(tmp_path)), sender=FakeSender())
    assert run_tick(s) == {"sent": 0, "gone": 0, "dropped": 0, "retry": 0, "purged": 0}


def test_reminder_body_texts():
    assert push.reminder_body("es", 1000 + 30 * 60, False, 1000) == "Empieza en 30 min. Toca para verlo en Teseo."
    assert push.reminder_body("es", 1000 + 120 * 60, False, 1000).startswith("Empieza en 2 h.")
    assert push.reminder_body("en", 1000 + 135 * 60, False, 1000).startswith("Starts in 2 h 15 min.")
    assert push.reminder_body("es", 1030, False, 1000).startswith("Empieza ahora")
    assert push.reminder_body("en", 1000 + 6 * 3600, True, 1000).startswith("It's tomorrow")


# ─── Notificación de prueba ───────────────────────────────────────────────────

def test_test_notification_sends_and_is_rate_limited(svc):
    sub = make_sub()
    r = post("/api/push/test", {"subscription": sub, "lang": "en"})
    assert r.status_code == 200 and r.json() == {"ok": True, "sent": True}
    c = svc.sender.calls[0]
    assert c["data"]["kind"] == "test" and c["data"]["title"] == "Teseo: test notification"
    assert c["sub"]["endpoint"] == sub["endpoint"]
    assert svc.store.counts() == (0, 0)                         # la prueba no guarda nada
    r = post("/api/push/test", {"subscription": sub})
    assert r.status_code == 429 and r.headers["retry-after"] == str(push.TEST_MIN_INTERVAL_S)
    svc.clock_obj.t += push.TEST_MIN_INTERVAL_S + 1
    assert post("/api/push/test", {"subscription": sub}).status_code == 200
    assert len(svc.sender.calls) == 2


def test_test_notification_gone_and_failure(svc):
    sub = make_sub()
    post("/api/push/remind", remind_body(sub))
    svc.sender.status = 410
    r = post("/api/push/test", {"subscription": sub})
    assert r.status_code == 410 and r.json()["code"] == "subscription_gone"
    assert svc.store.counts() == (0, 0)                         # y se borra lo que hubiera
    svc.sender.status = 500
    r = post("/api/push/test", {"subscription": make_sub(2)})
    assert r.status_code == 502 and r.json()["code"] == "push_failed"
    assert post("/api/push/test", {"subscription": {"endpoint": "https://evil.example/x"}}).status_code == 422


# ─── Privacidad y almacenamiento ──────────────────────────────────────────────

def test_nothing_personal_is_stored(svc):
    sub = make_sub()
    secret_ip, ua = "198.51.100.234", "AgenteSecreto/9.9 (X11; Linux)"
    r = client.post("/api/push/remind", content=json.dumps(remind_body(sub, lat=-0.22, lon=-78.5, email="a@b.c")),
                    headers={"content-type": "application/json", "x-forwarded-for": secret_ip, "user-agent": ua,
                             "cookie": "sesion=abc123", "x-real-ip": secret_ip})
    assert r.status_code == 201
    d = svc.store.dump()
    # columnas exactas: ni IP, ni user-agent, ni fechas de alta, ni identificadores propios
    assert set(d["subs"][0]) == {"id", "endpoint", "p256dh", "auth"}
    assert set(d["reminders"][0]) == {"id", "sub_id", "event_id", "notify_at", "event_at", "title", "url", "lang",
                                      "all_day", "attempts", "lease_until"}
    svc.store.db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    raw = b""
    for name in os.listdir(os.path.dirname(svc.store.path)):
        with open(os.path.join(os.path.dirname(svc.store.path), name), "rb") as f:
            raw += f.read()
    for needle in (secret_ip, ua, "abc123", "a@b.c", "-78.5", "-0.22", "expirationTime"):
        assert needle.encode() not in raw, needle
    assert oct(os.stat(svc.store.path).st_mode & 0o777) == "0o600"


def test_persistence_across_restarts(tmp_path):
    vapid = push.load_vapid(VAPID_PUB, VAPID_PRIV, "mailto:a@b.c")
    s1 = push.PushService(vapid, push.PushStore(str(tmp_path)), sender=FakeSender(), clock=Clock())
    s1.remind(remind_body(make_sub(), event_id="persistente"))
    s1.store.close()
    s2 = push.PushService(vapid, push.PushStore(str(tmp_path)), sender=FakeSender(), clock=Clock())
    assert s2.store.persistent and s2.store.counts() == (1, 1)
    s2.store.close()


def test_memory_mode_and_health(monkeypatch, tmp_path):
    st = push.PushStore(None)
    assert not st.persistent and "no definida" in st.reason
    blocker = tmp_path / "archivo"
    blocker.write_text("x")
    st2 = push.PushStore(str(blocker))                  # es un archivo, no un directorio
    assert not st2.persistent and "no escribible" in st2.reason
    s = push.PushService(push.load_vapid(VAPID_PUB, VAPID_PRIV, "mailto:a@b.c"), st, sender=FakeSender(), clock=Clock())
    s.remind(remind_body(make_sub()))
    assert s.store.counts() == (1, 1)                   # en memoria funciona igual
    monkeypatch.setattr(push, "service", s)
    h = client.get("/api/health").json()["push"]
    assert h == {"configured": True, "storage": "memory", "loop": "stopped", "reason": st.reason}
    # el estado nunca lleva recuentos ni endpoints
    assert "fcm" not in json.dumps(h)


def test_store_falls_back_to_memory_on_corrupt_file(tmp_path):
    (tmp_path / push.FILE_NAME).write_bytes(b"esto no es una base sqlite" * 100)
    st = push.PushStore(str(tmp_path))
    assert not st.persistent and "no se pudo abrir" in st.reason


def test_loop_starts_and_stops_with_app(monkeypatch, tmp_path):
    s = push.PushService(push.load_vapid(VAPID_PUB, VAPID_PRIV, "mailto:a@b.c"), push.PushStore(str(tmp_path)),
                         sender=FakeSender(), clock=Clock())
    monkeypatch.setattr(push, "service", s)
    monkeypatch.setenv("TESEO_PREWARM", "0")
    with TestClient(main.app) as c:
        assert c.get("/api/health").json()["push"]["loop"] == "running"
    assert s.task is None


# ─── Envío real con pywebpush (sin red): cifrado RFC 8291 y firma VAPID ───────

def test_real_webpush_encryption_roundtrip(monkeypatch):
    import http_ece
    import requests
    from py_vapid import Vapid

    browser_key, browser_pub, _ = keypair()
    auth = os.urandom(16)
    sub = {"endpoint": "https://fcm.googleapis.com/fcm/send/real-test", "p256dh": browser_pub, "auth": b64(auth)}
    captured = {}

    class FakeResp:
        status_code = 201
        text = ""
        reason = "Created"
        headers = {}

    def fake_post(self, url, data=None, headers=None, timeout=None, **kw):
        captured.update(url=url, data=data, headers=headers, timeout=timeout)
        return FakeResp()

    monkeypatch.setattr(requests.Session, "post", fake_post)
    vapid = push.load_vapid(VAPID_PUB, VAPID_PRIV, "mailto:pruebas@example.invalid")
    send = push.make_webpush_sender(vapid)
    payload = json.dumps(push.probe_payload("es"), ensure_ascii=False)
    assert send(sub, payload, 300, "normal") == 201
    assert captured["url"] == sub["endpoint"]
    h = {k.lower(): v for k, v in captured["headers"].items()}
    assert h["content-encoding"] == "aes128gcm" and h["ttl"] == "300" and h["urgency"] == "normal"
    # el navegador puede descifrarlo con su clave privada y su secreto auth
    plain = http_ece.decrypt(captured["data"], private_key=browser_key, auth_secret=auth, version="aes128gcm")
    assert json.loads(plain.decode("utf-8")) == push.probe_payload("es")
    # la cabecera VAPID lleva nuestra clave pública y un JWT firmado por ella
    assert h["authorization"].startswith("vapid t=") and f"k={VAPID_PUB}" in h["authorization"]
    token = h["authorization"].split("t=", 1)[1].split(",", 1)[0]
    claims = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
    assert claims["aud"] == "https://fcm.googleapis.com" and claims["sub"] == "mailto:pruebas@example.invalid"
    assert Vapid.from_raw(VAPID_PRIV.encode()).verify_token(
        validation_token=token.rsplit(".", 1)[0].encode(), verification_token=token.rsplit(".", 1)[1]) is not None


def test_real_sender_maps_errors(monkeypatch):
    import requests

    class R:
        def __init__(self, code):
            self.status_code, self.text, self.reason, self.headers = code, "", "x", {}

    vapid = push.load_vapid(VAPID_PUB, VAPID_PRIV, "mailto:a@b.c")
    send = push.make_webpush_sender(vapid)
    _, pub, _ = keypair()
    sub = {"endpoint": "https://fcm.googleapis.com/fcm/send/x", "p256dh": pub, "auth": b64(os.urandom(16))}
    monkeypatch.setattr(requests.Session, "post", lambda self, *a, **k: R(410))
    assert send(sub, "{}", 60, "high") == 410

    def boom(self, *a, **k):
        raise requests.ConnectionError("sin red")
    monkeypatch.setattr(requests.Session, "post", boom)
    assert send(sub, "{}", 60, "high") == 0
