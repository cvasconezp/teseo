"""
push.py — «Recordarme»: avisos push web de los eventos del Calendario del cielo.

Endpoints (APIRouter incluido en main.py):
  GET    /api/push/key     → clave pública VAPID (503 si el servidor no tiene claves)
  POST   /api/push/remind  → {subscription, event: {id, title, at_utc, url, all_day?}, lead_min, lang?} → 201
  DELETE /api/push/remind  → {endpoint, event_id} → 204 (idempotente)
  POST   /api/push/test    → {subscription, lang?} → envía una notificación de prueba (con límite de frecuencia)
Un bucle en segundo plano (cada ~60 s) envía los avisos vencidos.

Privacidad por diseño (LOPDP de Ecuador / RGPD):
  · Se guarda SOLO la suscripción push del navegador (endpoint + claves p256dh/auth, imprescindibles para
    cifrar el aviso) y, por recordatorio: id del evento, hora UTC del aviso, hora UTC del evento, título
    corto, URL interna de la app (p. ej. «/#ahora»), idioma del aviso (es/en) y si es de día completo.
  · Nada de ubicación, IP, user-agent, cookies, cuentas ni identificadores propios; tampoco la hora en que
    se creó nada. El endpoint NUNCA va a los registros ni a las métricas.
  · Un recordatorio se BORRA al enviarse (o si ya no tiene sentido: el evento pasó o el servicio de push lo
    rechaza). Una suscripción se borra cuando ya no le quedan recordatorios o cuando el servicio de push
    responde 404/410 (el navegador la anuló).
  · El límite de abuso por origen reutiliza metrics.RateLimiter: hash de la IP con sal efímera de un minuto,
    solo en memoria.

Robustez y abuso:
  · Topes: MAX_PER_SUB recordatorios por suscripción y topes globales de suscripciones y recordatorios.
  · Cuerpo máximo MAX_BODY_BYTES; validación estricta de cada campo (422 con mensaje legible).
  · Solo se envía a servicios de push conocidos (FCM, Mozilla, Apple, Windows): evita que el servidor sirva
    para hacer peticiones a direcciones arbitrarias (SSRF). Se pueden añadir dominios con TESEO_PUSH_EXTRA_HOSTS.
  · Envío con «arrendamiento» (lease): si durante un redespliegue conviven dos procesos con el mismo
    volumen, no envían el mismo aviso a la vez.

Almacenamiento: SQLite (biblioteca estándar) en $TESEO_PUSH_DIR o, si no está, en $TESEO_METRICS_DIR (el
volumen persistente que ya usan las métricas). Sin directorio escribible: SQLite en memoria (se pierde al
reiniciar) y /api/health lo indica.

Claves VAPID (variables de entorno): TESEO_VAPID_PUBLIC (punto P-256 sin comprimir, base64url, 65 bytes),
TESEO_VAPID_PRIVATE (escalar de 32 bytes, base64url) y TESEO_VAPID_SUBJECT («mailto:…» o «https://…»).
Sin ellas (o si no casan entre sí) los endpoints responden 503 y la interfaz oculta el botón.

Envío: pywebpush (cifrado aes128gcm, RFC 8291, y firma VAPID, RFC 8292). Es síncrono (requests), así que
se llama en el threadpool. Para las pruebas el envío se sustituye por una función simulada (`sender`).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import re
import secrets
import sqlite3
import threading
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from app import metrics

log = logging.getLogger("teseo.push")

FILE_NAME = "teseo-push.sqlite3"
MAX_BODY_BYTES = 4096
MAX_ENDPOINT_LEN = 1024
MAX_TITLE_LEN = 80
MAX_URL_LEN = 200
MAX_LEAD_MIN = 2 * 24 * 60          # hasta dos días de antelación
MAX_AHEAD_DAYS = 400                # eventos como mucho a ~13 meses (el calendario muestra 12)
STALE_AFTER_S = 3600                # un aviso no enviado se descarta 1 h después de empezar el evento
MAX_ATTEMPTS = 5                    # reintentos ante 429/5xx/red
LEASE_S = 120                       # «arrendamiento» de un aviso mientras se envía
BATCH = 200                         # avisos por vuelta del bucle
SEND_CONCURRENCY = 8
SEND_TIMEOUT_S = 10
TEST_MIN_INTERVAL_S = 30            # una prueba cada 30 s por suscripción


def _env_int(name: str, default: int, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(os.environ.get(name, str(default)))))
    except ValueError:
        return default


MAX_PER_SUB = _env_int("TESEO_PUSH_MAX_PER_SUB", 30, 1, 500)
MAX_SUBS = _env_int("TESEO_PUSH_MAX_SUBS", 20000, 1, 10_000_000)
MAX_REMINDERS = _env_int("TESEO_PUSH_MAX_REMINDERS", 100000, 1, 50_000_000)
TICK_SECONDS = _env_int("TESEO_PUSH_TICK_SECONDS", 60, 5, 3600)
# Peticiones por minuto y origen (alto: en una charla todo el público comparte la IP pública de la wifi)
WRITE_RATE_PER_MIN = _env_int("TESEO_PUSH_RATE_PER_MIN", 300, 5, 100000)
TEST_RATE_PER_MIN = _env_int("TESEO_PUSH_TEST_RATE_PER_MIN", 30, 1, 10000)

# Servicios de push conocidos (sufijos de dominio). Solo a ellos se envía.
PUSH_HOST_SUFFIXES = (
    "fcm.googleapis.com",            # Chrome, Edge (Android), Opera, Samsung Internet…
    "android.googleapis.com",        # FCM antiguo
    "push.services.mozilla.com",     # Firefox
    "push.apple.com",                # Safari (macOS 13+, iOS/iPadOS 16.4+ instalada)
    "notify.windows.com",            # Edge en Windows (WNS)
)

LANGS = ("es", "en")
EVENT_ID_RE = re.compile(r"^[\w][\w .:+\-()'@]{0,119}$", re.UNICODE)
APP_URL_RE = re.compile(r"^/(?!/)[A-Za-z0-9\-._~!$&'()*+,;=:@/?#%]*$")
B64URL_RE = re.compile(r"^[A-Za-z0-9_\-]+={0,2}$")
_CTRL_RE = re.compile(r"[\x00-\x1f\x7f-\x9f​-‏‪-‮⁦-⁩]")

TEXTS = {
    "es": {
        "starts_now": "Empieza ahora",
        "starts_in_min": "Empieza en {m} min",
        "starts_in_h": "Empieza en {h} h",
        "starts_in_hm": "Empieza en {h} h {m} min",
        "tomorrow": "Es mañana",
        "today": "Es hoy",
        "tap": "Toca para verlo en Teseo.",
        "test_title": "Teseo: notificación de prueba",
        "test_body": "Así te llegarán los recordatorios del Calendario del cielo.",
    },
    "en": {
        "starts_now": "Starting now",
        "starts_in_min": "Starts in {m} min",
        "starts_in_h": "Starts in {h} h",
        "starts_in_hm": "Starts in {h} h {m} min",
        "tomorrow": "It's tomorrow",
        "today": "It's today",
        "tap": "Tap to see it in Teseo.",
        "test_title": "Teseo: test notification",
        "test_body": "This is how Sky calendar reminders will reach you.",
    },
}


# ─── Utilidades base64url y claves ────────────────────────────────────────────

def b64url_decode(s: str) -> bytes:
    if not isinstance(s, str) or not s or len(s) > 2048 or not B64URL_RE.match(s):
        raise ValueError("base64url inválido")
    s = s.rstrip("=")
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


@dataclass
class VapidConfig:
    public_key: Optional[str] = None
    subject: Optional[str] = None
    signer: Any = None              # py_vapid.Vapid ya cargado (nunca se serializa)
    reason: Optional[str] = None

    @property
    def configured(self) -> bool:
        return self.signer is not None and self.public_key is not None


def load_vapid(public: Optional[str], private: Optional[str], subject: Optional[str]) -> VapidConfig:
    """Valida las tres variables y prepara el firmante. Nunca incluye la clave privada en `reason`."""
    public, private, subject = (public or "").strip(), (private or "").strip(), (subject or "").strip()
    if not public or not private or not subject:
        missing = [n for n, v in (("TESEO_VAPID_PUBLIC", public), ("TESEO_VAPID_PRIVATE", private),
                                  ("TESEO_VAPID_SUBJECT", subject)) if not v]
        return VapidConfig(reason=f"faltan variables: {', '.join(missing)}")
    if not (subject.startswith("mailto:") and "@" in subject) and not subject.startswith("https://"):
        return VapidConfig(reason="TESEO_VAPID_SUBJECT debe ser «mailto:…» o «https://…»")
    try:
        pub = b64url_decode(public)
        if len(pub) != 65 or pub[0] != 4:
            raise ValueError
    except ValueError:
        return VapidConfig(reason="TESEO_VAPID_PUBLIC no es una clave P-256 sin comprimir en base64url (65 bytes)")
    try:
        raw = b64url_decode(private)
        if len(raw) != 32:
            raise ValueError
        from cryptography.hazmat.primitives import serialization
        from py_vapid import Vapid
        signer = Vapid.from_raw(private.rstrip("=").encode("ascii"))
        derived = signer.public_key.public_bytes(serialization.Encoding.X962,
                                                 serialization.PublicFormat.UncompressedPoint)
    except Exception:
        return VapidConfig(reason="TESEO_VAPID_PRIVATE no es válida (escalar P-256 de 32 bytes en base64url)")
    if derived != pub:
        return VapidConfig(reason="TESEO_VAPID_PUBLIC y TESEO_VAPID_PRIVATE no forman un par")
    return VapidConfig(public_key=b64url_encode(pub), subject=subject, signer=signer)


# ─── Validación de entrada (pura; ValueError → 422) ───────────────────────────

def _extra_hosts() -> Tuple[str, ...]:
    raw = os.environ.get("TESEO_PUSH_EXTRA_HOSTS", "")
    return tuple(h.strip().lower().lstrip(".") for h in raw.split(",") if h.strip())


def endpoint_allowed(endpoint: str) -> bool:
    try:
        u = urlsplit(endpoint)
    except ValueError:
        return False
    if u.scheme != "https" or u.username or u.password or not u.hostname:
        return False
    try:
        if u.port not in (None, 443):
            return False
    except ValueError:
        return False
    host = u.hostname.lower()
    return any(host == s or host.endswith("." + s) for s in PUSH_HOST_SUFFIXES + _extra_hosts())


def clean_endpoint(endpoint: Any) -> str:
    if not isinstance(endpoint, str) or not endpoint.strip():
        raise ValueError("subscription.endpoint: falta o no es texto")
    endpoint = endpoint.strip()
    if len(endpoint) > MAX_ENDPOINT_LEN:
        raise ValueError("subscription.endpoint: demasiado largo")
    if any(ord(c) < 33 or ord(c) > 126 for c in endpoint):
        raise ValueError("subscription.endpoint: caracteres no válidos")
    if not endpoint_allowed(endpoint):
        raise ValueError("subscription.endpoint: no es un servicio de push conocido (https)")
    return endpoint


def clean_subscription(sub: Any) -> Dict[str, Any]:
    """{endpoint, keys: {p256dh, auth}, expirationTime?} → {endpoint, p256dh, auth} normalizado."""
    if not isinstance(sub, dict):
        raise ValueError("subscription: falta o no es un objeto")
    endpoint = clean_endpoint(sub.get("endpoint"))
    keys = sub.get("keys")
    if not isinstance(keys, dict):
        raise ValueError("subscription.keys: falta o no es un objeto")
    try:
        p256dh = b64url_decode(keys.get("p256dh"))
        if len(p256dh) != 65 or p256dh[0] != 4:
            raise ValueError
    except (ValueError, TypeError):
        raise ValueError("subscription.keys.p256dh: no es una clave P-256 válida")
    try:
        auth = b64url_decode(keys.get("auth"))
        if len(auth) != 16:
            raise ValueError
    except (ValueError, TypeError):
        raise ValueError("subscription.keys.auth: debe tener 16 bytes en base64url")
    return {"endpoint": endpoint, "p256dh": b64url_encode(p256dh), "auth": b64url_encode(auth)}


def clean_title(title: Any) -> str:
    if not isinstance(title, str):
        raise ValueError("event.title: falta o no es texto")
    if len(title) > 400:
        raise ValueError("event.title: demasiado largo")
    t = unicodedata.normalize("NFC", _CTRL_RE.sub(" ", title))
    t = re.sub(r"\s+", " ", t).strip()
    if not t:
        raise ValueError("event.title: vacío")
    if len(t) > MAX_TITLE_LEN:
        t = t[: MAX_TITLE_LEN - 1].rstrip() + "…"
    return t


def clean_url(url: Any) -> str:
    if url is None or url == "":
        return "/#ahora"
    if not isinstance(url, str) or len(url) > MAX_URL_LEN or not APP_URL_RE.match(url):
        raise ValueError("event.url: debe ser una ruta interna de la app (p. ej. «/#ahora»)")
    return url


def parse_utc(value: Any) -> int:
    """ISO 8601 con zona («…Z» o «…-05:00») → segundos UTC (enteros)."""
    if not isinstance(value, str) or not (10 <= len(value) <= 40):
        raise ValueError("event.at_utc: debe ser una fecha ISO 8601 con zona horaria")
    try:
        dt = datetime.fromisoformat(value.strip().replace("z", "Z"))
    except ValueError:
        raise ValueError("event.at_utc: fecha ISO 8601 inválida")
    if dt.tzinfo is None:
        raise ValueError("event.at_utc: falta la zona horaria (usa «Z» para UTC)")
    return int(dt.timestamp())


def clean_lead(lead: Any) -> int:
    if isinstance(lead, bool) or not isinstance(lead, int) or not (0 <= lead <= MAX_LEAD_MIN):
        raise ValueError(f"lead_min: entero entre 0 y {MAX_LEAD_MIN}")
    return lead


def clean_lang(lang: Any) -> str:
    if lang is None:
        return "es"
    if lang not in LANGS:
        raise ValueError("lang: «es» o «en»")
    return lang


def clean_event_id(eid: Any, field: str = "event.id") -> str:
    if not isinstance(eid, str) or not EVENT_ID_RE.match(eid):
        raise ValueError(f"{field}: identificador no válido")
    return eid


def parse_remind(data: Any, now: float) -> Dict[str, Any]:
    """Cuerpo de POST /api/push/remind → datos limpios (solo lo que se guardará)."""
    if not isinstance(data, dict):
        raise ValueError("el cuerpo debe ser un objeto JSON")
    sub = clean_subscription(data.get("subscription"))
    ev = data.get("event")
    if not isinstance(ev, dict):
        raise ValueError("event: falta o no es un objeto")
    event_id = clean_event_id(ev.get("id"))
    title = clean_title(ev.get("title"))
    event_at = parse_utc(ev.get("at_utc"))
    url = clean_url(ev.get("url"))
    all_day = ev.get("all_day", False)
    if not isinstance(all_day, bool):
        raise ValueError("event.all_day: debe ser true o false")
    lead = clean_lead(data.get("lead_min"))
    lang = clean_lang(data.get("lang"))
    now_i = int(now)
    if event_at <= now_i:
        raise ValueError("event.at_utc: el evento ya empezó")
    if event_at > now_i + MAX_AHEAD_DAYS * 86400:
        raise ValueError(f"event.at_utc: más de {MAX_AHEAD_DAYS} días en el futuro")
    notify_at = max(event_at - lead * 60, now_i)   # si la antelación ya pasó, se avisa en la próxima vuelta
    return {"sub": sub, "event_id": event_id, "title": title, "event_at": event_at, "notify_at": notify_at,
            "url": url, "lang": lang, "all_day": all_day}


def parse_delete(data: Any) -> Tuple[str, str]:
    if not isinstance(data, dict):
        raise ValueError("el cuerpo debe ser un objeto JSON")
    return clean_endpoint(data.get("endpoint")), clean_event_id(data.get("event_id"), "event_id")


def parse_test(data: Any) -> Tuple[Dict[str, Any], str]:
    if not isinstance(data, dict):
        raise ValueError("el cuerpo debe ser un objeto JSON")
    return clean_subscription(data.get("subscription")), clean_lang(data.get("lang"))


# ─── Texto de la notificación ─────────────────────────────────────────────────

def reminder_body(lang: str, event_at: int, all_day: bool, now: float) -> str:
    """Texto relativo («Empieza en 30 min»): no hace falta saber la zona horaria de nadie."""
    T = TEXTS.get(lang, TEXTS["es"])
    remaining = event_at - now
    if all_day:
        lead = T["tomorrow"] if remaining > 0 else T["today"]
    else:
        m = int(round(remaining / 60))
        if m <= 1:
            lead = T["starts_now"]
        elif m < 60:
            lead = T["starts_in_min"].format(m=m)
        elif m % 60 == 0:
            lead = T["starts_in_h"].format(h=m // 60)
        else:
            lead = T["starts_in_hm"].format(h=m // 60, m=m % 60)
    return f"{lead}. {T['tap']}"


def reminder_payload(row: Dict[str, Any], now: float) -> Dict[str, Any]:
    return {
        "v": 1, "kind": "remind",
        "title": row["title"],
        "body": reminder_body(row["lang"], row["event_at"], bool(row["all_day"]), now),
        "url": row["url"],
        "tag": f"teseo-{row['event_id']}"[:120],
        "lang": row["lang"],
    }


def probe_payload(lang: str) -> Dict[str, Any]:
    T = TEXTS.get(lang, TEXTS["es"])
    return {"v": 1, "kind": "test", "title": T["test_title"], "body": T["test_body"],
            "url": "/#ahora", "tag": "teseo-test", "lang": lang}


# ─── Almacén (SQLite) ─────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS subs (
  id INTEGER PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY,
  sub_id INTEGER NOT NULL REFERENCES subs(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  notify_at INTEGER NOT NULL,
  event_at INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  lang TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  UNIQUE (sub_id, event_id)
);
CREATE INDEX IF NOT EXISTS reminders_due ON reminders (notify_at);
"""


class LimitError(Exception):
    def __init__(self, code: str, message: str, status: int):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


class PushStore:
    """Suscripciones y recordatorios. Una conexión por proceso protegida por un candado; entre procesos
    (redespliegue con el mismo volumen) protege el bloqueo de SQLite y el «lease» de cada envío."""

    def __init__(self, directory: Optional[str] = None):
        self._lock = threading.RLock()
        self.path: Optional[str] = None
        self.reason: Optional[str] = None
        self.last_error: Optional[str] = None
        target = ":memory:"
        if not directory:
            self.reason = "TESEO_PUSH_DIR/TESEO_METRICS_DIR no definida"
        else:
            try:
                os.makedirs(directory, exist_ok=True)
                probe = os.path.join(directory, f".probe-push-{os.getpid()}")
                with open(probe, "w") as f:
                    f.write("ok")
                os.remove(probe)
                target = os.path.join(directory, FILE_NAME)
            except Exception as e:
                self.reason = f"directorio no escribible ({type(e).__name__})"
        try:
            self.db = self._connect(target)
        except Exception as e:      # archivo corrupto o ilegible: memoria, y se dice en /api/health
            self.reason = f"no se pudo abrir la base ({type(e).__name__})"
            target = ":memory:"
            self.db = self._connect(target)
        self.path = None if target == ":memory:" else target

    @staticmethod
    def _connect(target: str) -> sqlite3.Connection:
        db = sqlite3.connect(target, timeout=10, isolation_level=None, check_same_thread=False)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        if target != ":memory:":
            try:
                db.execute("PRAGMA journal_mode = WAL")
            except sqlite3.DatabaseError:
                pass
            db.execute("PRAGMA synchronous = NORMAL")
            os.chmod(target, 0o600)
        db.executescript(SCHEMA)
        db.execute("PRAGMA user_version = 1")
        return db

    @property
    def persistent(self) -> bool:
        return self.path is not None

    def _tx(self):
        return _Tx(self)

    # -- altas y bajas ---------------------------------------------------------
    def add(self, r: Dict[str, Any], max_per_sub: int, max_subs: int, max_reminders: int) -> int:
        """Crea o actualiza (mismo evento → se reemplaza) un recordatorio. Devuelve cuántos tiene la suscripción."""
        s = r["sub"]
        with self._tx() as db:
            row = db.execute("SELECT id FROM subs WHERE endpoint = ?", (s["endpoint"],)).fetchone()
            if row is None:
                if db.execute("SELECT COUNT(*) FROM subs").fetchone()[0] >= max_subs:
                    raise LimitError("capacity", "El servicio de recordatorios está lleno ahora mismo; prueba más tarde o usa «A mi calendario».", 503)
                sub_id = db.execute("INSERT INTO subs (endpoint, p256dh, auth) VALUES (?, ?, ?)",
                                    (s["endpoint"], s["p256dh"], s["auth"])).lastrowid
            else:
                sub_id = row["id"]
                db.execute("UPDATE subs SET p256dh = ?, auth = ? WHERE id = ?", (s["p256dh"], s["auth"], sub_id))
            exists = db.execute("SELECT 1 FROM reminders WHERE sub_id = ? AND event_id = ?",
                                (sub_id, r["event_id"])).fetchone()
            if not exists:
                if db.execute("SELECT COUNT(*) FROM reminders WHERE sub_id = ?", (sub_id,)).fetchone()[0] >= max_per_sub:
                    raise LimitError("limit_subscription", f"Ya tienes {max_per_sub} recordatorios en este navegador: quita alguno antes de añadir otro.", 409)
                if db.execute("SELECT COUNT(*) FROM reminders").fetchone()[0] >= max_reminders:
                    raise LimitError("capacity", "El servicio de recordatorios está lleno ahora mismo; prueba más tarde o usa «A mi calendario».", 503)
            db.execute(
                """INSERT INTO reminders (sub_id, event_id, notify_at, event_at, title, url, lang, all_day)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (sub_id, event_id) DO UPDATE SET notify_at = excluded.notify_at,
                     event_at = excluded.event_at, title = excluded.title, url = excluded.url,
                     lang = excluded.lang, all_day = excluded.all_day, attempts = 0, lease_until = 0""",
                (sub_id, r["event_id"], r["notify_at"], r["event_at"], r["title"], r["url"], r["lang"], int(r["all_day"])))
            return db.execute("SELECT COUNT(*) FROM reminders WHERE sub_id = ?", (sub_id,)).fetchone()[0]

    def remove(self, endpoint: str, event_id: str) -> None:
        with self._tx() as db:
            row = db.execute("SELECT id FROM subs WHERE endpoint = ?", (endpoint,)).fetchone()
            if row is None:
                return
            db.execute("DELETE FROM reminders WHERE sub_id = ? AND event_id = ?", (row["id"], event_id))
            self._drop_if_empty(db, row["id"])

    def drop_subscription(self, endpoint: str = None, sub_id: int = None) -> None:
        with self._tx() as db:
            if sub_id is not None:
                db.execute("DELETE FROM subs WHERE id = ?", (sub_id,))
            else:
                db.execute("DELETE FROM subs WHERE endpoint = ?", (endpoint,))

    @staticmethod
    def _drop_if_empty(db: sqlite3.Connection, sub_id: int) -> None:
        db.execute("DELETE FROM subs WHERE id = ? AND NOT EXISTS (SELECT 1 FROM reminders WHERE sub_id = ?)",
                   (sub_id, sub_id))

    # -- envío -----------------------------------------------------------------
    def claim_due(self, now: int, limit: int = BATCH) -> List[Dict[str, Any]]:
        """Toma los avisos vencidos y los «arrienda» LEASE_S segundos para que nadie más los envíe."""
        with self._tx() as db:
            rows = db.execute(
                """SELECT r.id, r.sub_id, r.event_id, r.notify_at, r.event_at, r.title, r.url, r.lang,
                          r.all_day, r.attempts, s.endpoint, s.p256dh, s.auth
                   FROM reminders r JOIN subs s ON s.id = r.sub_id
                   WHERE r.notify_at <= ? AND r.lease_until <= ?
                   ORDER BY r.notify_at LIMIT ?""", (now, now, limit)).fetchall()
            ids = [r["id"] for r in rows]
            if ids:
                db.execute(f"UPDATE reminders SET lease_until = ? WHERE id IN ({','.join('?' * len(ids))})",
                           (now + LEASE_S, *ids))
            return [dict(r) for r in rows]

    def done(self, reminder_id: int, sub_id: int) -> None:
        """Enviado (o descartado): se borra el recordatorio y, si era el último, la suscripción."""
        with self._tx() as db:
            db.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
            self._drop_if_empty(db, sub_id)

    def retry_later(self, reminder_id: int, attempts: int, when: int) -> None:
        with self._tx() as db:
            db.execute("UPDATE reminders SET attempts = ?, lease_until = ? WHERE id = ?", (attempts, when, reminder_id))

    def purge(self, now: int) -> int:
        """Borra avisos que ya no tienen sentido (evento pasado hace más de STALE_AFTER_S) y suscripciones vacías."""
        with self._tx() as db:
            n = db.execute("DELETE FROM reminders WHERE event_at < ?", (now - STALE_AFTER_S,)).rowcount
            db.execute("DELETE FROM subs WHERE NOT EXISTS (SELECT 1 FROM reminders WHERE reminders.sub_id = subs.id)")
            return n

    # -- lectura ---------------------------------------------------------------
    def counts(self) -> Tuple[int, int]:
        with self._lock:
            s = self.db.execute("SELECT COUNT(*) FROM subs").fetchone()[0]
            r = self.db.execute("SELECT COUNT(*) FROM reminders").fetchone()[0]
            return s, r

    def dump(self) -> Dict[str, List[Dict[str, Any]]]:
        """Todo lo guardado (para las pruebas de privacidad)."""
        with self._lock:
            return {
                "subs": [dict(r) for r in self.db.execute("SELECT * FROM subs ORDER BY id")],
                "reminders": [dict(r) for r in self.db.execute("SELECT * FROM reminders ORDER BY id")],
            }

    def close(self) -> None:
        with self._lock:
            try:
                self.db.close()
            except Exception:
                pass


class _Tx:
    """BEGIN IMMEDIATE … COMMIT/ROLLBACK con el candado del proceso."""

    def __init__(self, store: PushStore):
        self.store = store

    def __enter__(self) -> sqlite3.Connection:
        self.store._lock.acquire()
        try:
            self.store.db.execute("BEGIN IMMEDIATE")
        except Exception:
            self.store._lock.release()
            raise
        return self.store.db

    def __exit__(self, exc_type, exc, tb):
        db = self.store.db
        try:
            if exc_type is None:
                try:
                    db.execute("COMMIT")
                except Exception as e:      # no se oculta: quien llama debe saber que no se guardó
                    self.store.last_error = f"sqlite: {type(e).__name__}"
                    try:
                        db.execute("ROLLBACK")
                    except Exception:
                        pass
                    raise
            else:
                try:
                    db.execute("ROLLBACK")
                except Exception:
                    pass
        finally:
            self.store._lock.release()
        return False


# ─── Envío ────────────────────────────────────────────────────────────────────

# Resultado de un envío: código HTTP del servicio de push (201/202 = aceptado). Un fallo de red se
# representa con 0. La función recibe la suscripción, el texto del payload, TTL (s) y urgencia.
Sender = Callable[[Dict[str, Any], str, int, str], int]


def make_webpush_sender(vapid: VapidConfig) -> Sender:
    """Envío real con pywebpush (importado aquí para que el módulo cargue aunque falte la librería)."""
    import requests
    from pywebpush import WebPushException, webpush

    session = requests.Session()
    session.trust_env = True        # respeta HTTPS_PROXY si lo hay (en Railway no)

    def send(sub: Dict[str, Any], data: str, ttl: int, urgency: str) -> int:
        info = {"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}}
        try:
            resp = webpush(info, data=data, vapid_private_key=vapid.signer,
                           vapid_claims={"sub": vapid.subject}, ttl=ttl, timeout=SEND_TIMEOUT_S,
                           headers={"Urgency": urgency}, requests_session=session)
            return int(getattr(resp, "status_code", 201) or 201)
        except WebPushException as e:
            resp = getattr(e, "response", None)
            return int(resp.status_code) if resp is not None else 0
        except Exception:
            return 0

    return send


def _limiter_key(salt: bytes, endpoint: str) -> str:
    return hashlib.sha256(salt + endpoint.encode("utf-8", "ignore")).hexdigest()[:16]


class PushService:
    def __init__(self, vapid: VapidConfig, store: PushStore, sender: Optional[Sender] = None,
                 clock: Callable[[], float] = time.time):
        self.vapid = vapid
        self.store = store
        self.clock = clock
        self._sender = sender
        self.write_limiter = metrics.RateLimiter(WRITE_RATE_PER_MIN, clock=clock)
        self.test_limiter = metrics.RateLimiter(TEST_RATE_PER_MIN, clock=clock)
        # última prueba por suscripción: hash con sal efímera, solo en memoria
        self._test_salt = secrets.token_bytes(16)
        self._test_last: Dict[str, float] = {}
        self._test_lock = threading.Lock()
        self.task: Optional[asyncio.Task] = None
        self.last_tick: Optional[float] = None
        self.last_error: Optional[str] = None
        self.sent_ok = 0                   # contadores del proceso (sin datos de nadie)
        self.sent_fail = 0

    @classmethod
    def from_env(cls) -> "PushService":
        vapid = load_vapid(os.environ.get("TESEO_VAPID_PUBLIC"), os.environ.get("TESEO_VAPID_PRIVATE"),
                           os.environ.get("TESEO_VAPID_SUBJECT"))
        directory = (os.environ.get("TESEO_PUSH_DIR", "").strip()
                     or os.environ.get("TESEO_METRICS_DIR", "").strip() or None)
        return cls(vapid, PushStore(directory))

    @property
    def sender(self) -> Sender:
        if self._sender is None:
            self._sender = make_webpush_sender(self.vapid)
        return self._sender

    def require_configured(self) -> None:
        if not self.vapid.configured:
            raise HTTPException(
                status_code=503,
                detail={"detail": "Los recordatorios push no están disponibles en este servidor (faltan las claves VAPID). Usa «A mi calendario».",
                        "code": "push_not_configured"},
                headers={"Cache-Control": "no-store"})

    # -- operaciones -----------------------------------------------------------
    def remind(self, data: Any) -> Dict[str, Any]:
        r = parse_remind(data, self.clock())
        n = self.store.add(r, MAX_PER_SUB, MAX_SUBS, MAX_REMINDERS)
        return {"ok": True, "event_id": r["event_id"],
                "notify_at_utc": datetime.fromtimestamp(r["notify_at"], tz=timezone.utc).isoformat().replace("+00:00", "Z"),
                "reminders": n, "max": MAX_PER_SUB}

    def unremind(self, data: Any) -> None:
        endpoint, event_id = parse_delete(data)
        self.store.remove(endpoint, event_id)

    def test_allowed(self, endpoint: str) -> bool:
        now = self.clock()
        key = _limiter_key(self._test_salt, endpoint)
        with self._test_lock:
            if len(self._test_last) > 10000:
                self._test_last = {k: t for k, t in self._test_last.items() if now - t < TEST_MIN_INTERVAL_S}
            last = self._test_last.get(key)
            if last is not None and now - last < TEST_MIN_INTERVAL_S:
                return False
            self._test_last[key] = now
            return True

    def send_test(self, sub: Dict[str, Any], lang: str) -> int:
        return self.sender(sub, json.dumps(probe_payload(lang), ensure_ascii=False), 300, "normal")

    # -- bucle -----------------------------------------------------------------
    def _send_one(self, row: Dict[str, Any], now: float) -> Tuple[Dict[str, Any], int]:
        payload = json.dumps(reminder_payload(row, now), ensure_ascii=False)
        ttl = int(max(60, min(86400, row["event_at"] - now + (12 * 3600 if row["all_day"] else 0))))
        sub = {"endpoint": row["endpoint"], "p256dh": row["p256dh"], "auth": row["auth"]}
        try:
            return row, int(self.sender(sub, payload, ttl, "high"))
        except Exception:
            return row, 0

    def handle_result(self, row: Dict[str, Any], status: int, now: float) -> str:
        """Decide qué hacer tras un envío. Devuelve 'sent' | 'gone' | 'dropped' | 'retry'."""
        if 200 <= status < 300:
            self.store.done(row["id"], row["sub_id"])
            self.sent_ok += 1
            return "sent"
        self.sent_fail += 1
        if status in (404, 410):            # el navegador anuló la suscripción: fuera, con todos sus avisos
            self.store.drop_subscription(sub_id=row["sub_id"])
            return "gone"
        attempts = int(row.get("attempts", 0)) + 1
        retryable = status == 0 or status == 429 or status >= 500
        if not retryable or attempts >= MAX_ATTEMPTS or now >= row["event_at"]:
            self.store.done(row["id"], row["sub_id"])   # 400/403/413… o demasiados intentos: se descarta
            return "dropped"
        self.store.retry_later(row["id"], attempts, int(now) + min(60 * 2 ** attempts, 900))
        return "retry"

    async def tick(self) -> Dict[str, int]:
        """Una vuelta: purga lo caducado y envía lo vencido (en el threadpool, con concurrencia limitada)."""
        now = self.clock()
        out = {"sent": 0, "gone": 0, "dropped": 0, "retry": 0, "purged": 0}
        if not self.vapid.configured:
            return out
        out["purged"] = await run_in_threadpool(self.store.purge, int(now))
        rows = await run_in_threadpool(self.store.claim_due, int(now))
        sem = asyncio.Semaphore(SEND_CONCURRENCY)

        async def one(row):
            async with sem:
                return await run_in_threadpool(self._send_one, row, now)

        for row, status in await asyncio.gather(*(one(r) for r in rows)):
            res = await run_in_threadpool(self.handle_result, row, status, now)
            out[res] += 1
        self.last_tick = now
        return out

    async def loop(self) -> None:
        while True:
            try:
                await self.tick()
                self.last_error = None
            except asyncio.CancelledError:
                raise
            except Exception as e:      # nunca se cae el bucle; nunca se registra el endpoint
                self.last_error = type(e).__name__
                log.warning("push: fallo en la vuelta del bucle (%s)", type(e).__name__)
            await asyncio.sleep(TICK_SECONDS)

    # -- estado (para /api/health: sin recuentos ni datos de nadie) ----------------
    def status(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {
            "configured": self.vapid.configured,
            "storage": "persistent" if self.store.persistent else "memory",
            "loop": "running" if self.task is not None and not self.task.done() else "stopped",
        }
        if not self.vapid.configured:
            out["reason_config"] = self.vapid.reason
        if not self.store.persistent:
            out["reason"] = self.store.reason
        elif os.environ.get("RAILWAY_PROJECT_ID") or os.environ.get("RAILWAY_ENVIRONMENT_NAME"):
            vol = (os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") or "").rstrip("/")
            out["railway_volume"] = bool(vol) and os.path.abspath(self.store.path).startswith(vol + "/")
        if self.last_tick:
            out["last_tick"] = datetime.fromtimestamp(self.last_tick, tz=timezone.utc).isoformat(timespec="seconds")
        err = self.last_error or self.store.last_error
        if err:
            out["error"] = err
        return out


service = PushService.from_env()


def status() -> Dict[str, Any]:
    """Estado para /api/health (nunca lanza)."""
    try:
        return service.status()
    except Exception as e:
        return {"configured": False, "storage": "unknown", "error": type(e).__name__}


# ─── Endpoints ────────────────────────────────────────────────────────────────

_NO_STORE = {"Cache-Control": "no-store"}


async def _start_loop() -> None:
    if os.getenv("TESEO_PUSH_LOOP", "1") == "1" and service.task is None:
        service.task = asyncio.create_task(service.loop())


async def _stop_loop() -> None:
    task, service.task = service.task, None
    if task:
        task.cancel()


router = APIRouter(prefix="/api/push", tags=["push"], on_startup=[_start_loop], on_shutdown=[_stop_loop])


def _error(status: int, detail: str, code: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail, "code": code}, headers=_NO_STORE)


async def _read_json(request: Request) -> Any:
    """Lee el cuerpo sin pasar de MAX_BODY_BYTES y lo decodifica. Errores → HTTPException legible."""
    try:
        if int(request.headers.get("content-length") or 0) > MAX_BODY_BYTES:
            raise HTTPException(413, detail={"detail": f"Petición demasiado grande (máx. {MAX_BODY_BYTES} bytes).", "code": "too_large"})
    except ValueError:
        raise HTTPException(400, detail={"detail": "Content-Length inválido.", "code": "bad_request"})
    buf = bytearray()
    async for chunk in request.stream():
        buf.extend(chunk)
        if len(buf) > MAX_BODY_BYTES:
            raise HTTPException(413, detail={"detail": f"Petición demasiado grande (máx. {MAX_BODY_BYTES} bytes).", "code": "too_large"})
    try:
        return json.loads(bytes(buf).decode("utf-8"))
    except Exception:
        raise HTTPException(400, detail={"detail": "El cuerpo debe ser JSON válido (UTF-8).", "code": "bad_json"})


def _rate(limiter: metrics.RateLimiter, request: Request) -> None:
    ip = metrics.client_ip(request.headers, request.client.host if request.client else None)
    if limiter.allow(ip, 1) < 1:
        raise HTTPException(429, detail={"detail": "Demasiadas peticiones; espera un minuto.", "code": "rate_limited"},
                            headers={"Retry-After": "60", **_NO_STORE})


def _as_response(e: HTTPException) -> JSONResponse:
    d = e.detail if isinstance(e.detail, dict) else {"detail": str(e.detail), "code": "error"}
    return JSONResponse(status_code=e.status_code, content=d, headers={**_NO_STORE, **(e.headers or {})})


@router.get("/key")
def push_key():
    """Clave pública VAPID con la que el navegador crea la suscripción."""
    if not service.vapid.configured:
        return _error(503, "Los recordatorios push no están disponibles en este servidor (faltan las claves VAPID).",
                      "push_not_configured")
    return JSONResponse({"public_key": service.vapid.public_key, "max_per_subscription": MAX_PER_SUB},
                        headers={"Cache-Control": "public, max-age=300"})


@router.post("/remind", status_code=201)
async def push_remind(request: Request):
    """Guarda un recordatorio (o lo actualiza si ya existía para ese evento y navegador)."""
    try:
        service.require_configured()
        _rate(service.write_limiter, request)
        data = await _read_json(request)
        try:
            result = await run_in_threadpool(service.remind, data)
        except ValueError as e:
            return _error(422, f"Parámetro inválido — {e}", "invalid")
        except LimitError as e:
            return _error(e.status, e.message, e.code)
    except HTTPException as e:
        return _as_response(e)
    return JSONResponse(result, status_code=201, headers=_NO_STORE)


@router.delete("/remind", status_code=204)
async def push_unremind(request: Request):
    """Quita un recordatorio; si era el último de esa suscripción, borra también la suscripción."""
    try:
        service.require_configured()
        _rate(service.write_limiter, request)
        data = await _read_json(request)
        try:
            await run_in_threadpool(service.unremind, data)
        except ValueError as e:
            return _error(422, f"Parámetro inválido — {e}", "invalid")
    except HTTPException as e:
        return _as_response(e)
    return Response(status_code=204, headers=_NO_STORE)


@router.post("/test")
async def push_test(request: Request):
    """Envía ya una notificación de prueba a esa suscripción. No guarda nada."""
    try:
        service.require_configured()
        _rate(service.test_limiter, request)
        data = await _read_json(request)
        try:
            sub, lang = parse_test(data)
        except ValueError as e:
            return _error(422, f"Parámetro inválido — {e}", "invalid")
        if not service.test_allowed(sub["endpoint"]):
            return JSONResponse(status_code=429, headers={"Retry-After": str(TEST_MIN_INTERVAL_S), **_NO_STORE},
                                content={"detail": f"Ya enviamos una prueba hace poco; espera {TEST_MIN_INTERVAL_S} s.", "code": "rate_limited"})
        status_code = await run_in_threadpool(service.send_test, sub, lang)
    except HTTPException as e:
        return _as_response(e)
    if 200 <= status_code < 300:
        return JSONResponse({"ok": True, "sent": True}, headers=_NO_STORE)
    if status_code in (404, 410):
        await run_in_threadpool(service.store.drop_subscription, sub["endpoint"])
        return _error(410, "Esta suscripción ya no es válida; vuelve a activar los avisos.", "subscription_gone")
    return _error(502, "El servicio de notificaciones del navegador no aceptó el aviso; inténtalo más tarde.", "push_failed")
