"""
metrics.py — métricas de uso propias de Teseo: ANÓNIMAS Y AGREGADAS.

Privacidad por diseño (LOPDP de Ecuador / RGPD):
  · No se guarda NADA que identifique a una persona: ni IP, ni user-agent,
    ni cookies, ni identificadores persistentes, ni la hora de cada evento.
  · Cada evento solo INCREMENTA contadores por (día UTC, evento, parámetro=valor),
    p. ej.  2026-11-14 · tab_change · tab:sky → 37.
  · Eventos y parámetros pasan por una LISTA BLANCA en el servidor; los valores
    son cortos y, casi siempre, de un conjunto conocido. Nunca texto libre.
  · La categoría de dispositivo (móvil / tableta / escritorio) se deriva del
    user-agent en el momento y el user-agent se descarta al instante; solo se
    cuenta en `session_start`.
  · El límite de abuso usa un hash de la IP con una sal aleatoria que cambia
    cada minuto y vive solo en memoria: al acabar el minuto se borran la sal y
    los contadores, así que ni siquiera el hash sobrevive.

Persistencia: un JSON en $TESEO_METRICS_DIR (p. ej. un volumen de Railway en
/data). Se escribe de forma atómica (temporal + fsync + rename) cada ~30 s y al
apagar. En cada escritura se LEE el archivo, se le SUMAN los incrementos
pendientes y se reescribe: si durante un redespliegue conviven dos procesos,
ninguno pisa los conteos del otro. Sin la variable (o si el directorio no se
puede escribir) funciona solo en memoria y /api/health lo indica.
"""

from __future__ import annotations

import copy
import csv
import hashlib
import io
import json
import os
import re
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

FILE_NAME = "teseo-metrics.json"
RETAIN_DAYS = 400               # días que se conservan (solo agregados por día)
FLUSH_SECONDS = 30              # cada cuánto se escribe a disco si hay cambios
MAX_BODY_BYTES = 4096           # cuerpo máximo de un POST
MAX_BATCH = 20                  # eventos por lote
MAX_KEYS_PER_EVENT = 300        # valores distintos por (día, evento); el resto → "_other"
# Eventos por minuto y origen. Alto a propósito: en un evento con wifi compartida
# todo el público sale por la MISMA IP pública (~50 personas × ~10 eventos/min).
def _rate_default() -> int:
    try:
        return max(20, int(os.environ.get("TESEO_METRICS_RATE_PER_MIN", "1500")))
    except ValueError:
        return 1500


RATE_PER_MINUTE = _rate_default()
OTHER = "_other"

# ─── Lista blanca ─────────────────────────────────────────────────────────────
# Cada parámetro admite un conjunto cerrado de valores (set) o, solo para
# nombres de catálogo (objetos del cielo, preajustes, tarjetas), un "token":
# texto corto sin espacios raros, limitado además por MAX_KEYS_PER_EVENT.

TOKEN_RE = re.compile(r"^[\w][\w .+\-*'()]{0,39}$", re.UNICODE)
TOKEN = "token"

TABS = {"route", "windows", "scale", "sky", "questions"}
BODIES = {"mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "light", "moon", "sun", "pluto"}
LANGS = {"es", "en"}
SCREENS = {"small", "medium", "large"}
ON_OFF = {"on", "off"}
TOURS = {"drake", "bh", "expansion", "dm", "mass", "time", "gw", "spectrum"}
NOW_CARDS = {"mars", "launches", "asteroids", "calendar"}
NOW_KINDS = {"details", "webcast", "info", "show_all", "select", "ld_help", "cneos", "filter", "ics", "sky"}
NOW_SOURCES = {"link", "windows", "route", "header", "teaser"}
SPECIAL_DESTS = {"moon", "sun"}
SPECIAL_KINDS = {"view", "link", "venus", "pick"}
ENDPOINTS = {
    "missions_mars", "launches", "asteroids", "launch_windows", "position", "distance", "route",
    "exoplanets", "comets", "probes", "blackholes_json", "trajectory", "iss_passes", "other",
}
ERROR_KINDS = {"timeout", "http4xx", "http5xx", "network", "parse"}
SKY_LAYERS = {"messier", "pulsars", "blackholes", "galaxies", "meteors", "comets", "probes", "exoplanets"}
SKY_KINDS = {
    "planet", "moon", "sun", "star", "constellation", "messier", "pulsars", "blackholes", "galaxies",
    "meteors", "comets", "probes", "exoplanets", "other",
}
SKY_AR = {"on", "off", "denied", "nosensor", "pending"}
SKY_SETTINGS = {"atmosphere", "light_pollution", "labels", "lines", "art", "grid", "horizon", "night", "guides", "other"}
STATES = {"on", "off", "ok", "fail", "start", "done", "skip"}
ISS_KINDS = {"view", "show", "retry"}
ISS_STATES = {"ok", "empty", "stale", "fail"}

EVENTS: Dict[str, Dict[str, Any]] = {
    # sesión y navegación
    "session_start":      {"lang": LANGS, "screen": SCREENS, "tab": TABS},
    "page_view":          {"tab": TABS},
    "tab_change":         {"tab": TABS},
    "destination_change": {"origin": BODIES, "destination": BODIES},
    "language_change":    {"lang": LANGS},
    "night_vision":       {"state": ON_OFF},
    "credits_open":       {},
    "data_retry":         {"tab": TABS},
    "net_error":          {"endpoint": ENDPOINTS, "kind": ERROR_KINDS},
    # Ahora en el espacio
    "now_open":           {"source": NOW_SOURCES},
    "now_card_view":      {"card": NOW_CARDS},
    "now_item":           {"card": NOW_CARDS, "kind": NOW_KINDS},
    "now_retry":          {"card": NOW_CARDS},
    # ¿Y la Luna? ¿Y el Sol? (src/special/): vista de cada tarjeta, enlace desde
    # Ruta y botón "Ver ventanas a Venus"
    "special_dest":       {"destination": SPECIAL_DESTS, "kind": SPECIAL_KINDS},
    # Trayectoria realista (Lambert) en Ruta: resultado de la tarjeta (src/route/)
    "trajectory_card":    {"origin": BODIES, "destination": BODIES, "state": {"ok", "fail", "empty"}},
    # Catapultas (asistencias gravitatorias) en Ruta: vista de la tarjeta por destino (src/route/GravityAssists.jsx)
    "assists_card":       {"origin": BODIES, "destination": BODIES},
    # Preguntas
    "q_index":            {},
    "q_search":           {"state": {"ok", "fail"}},
    "q_nav":              {"q": TOURS},
    "q_open":             {"q": TOURS},
    "q_preset":           {"q": TOURS, "preset": TOKEN},
    "q_slider":           {"q": TOURS},
    "q_share":            {"q": TOURS, "state": {"ok", "fail"}},
    "q_next":             {"q": TOURS},
    "q_card":             {"q": TOURS, "card": TOKEN},
    "q_see_sky":          {"q": TOURS},
    # Cielo (los cablea src/Constellations.jsx / src/sky/*)
    "sky_layer":          {"layer": SKY_LAYERS, "state": ON_OFF},
    "sky_select":         {"kind": SKY_KINDS, "id": TOKEN},
    "sky_search":         {"state": {"ok", "empty"}, "kind": SKY_KINDS},
    "sky_ar":             {"state": SKY_AR},
    "sky_postcard":       {"state": {"ok", "fail"}},
    "sky_share":          {"state": {"ok", "fail"}},
    "sky_fullscreen":     {"state": ON_OFF},
    "sky_tour":           {"state": {"start", "done", "skip"}},
    "sky_view_from":      {"kind": {"earth", "star"}},
    "sky_location":       {"kind": {"gps", "manual", "default"}},
    "sky_time":           {"kind": {"now", "forward", "back", "custom"}},
    "sky_setting":        {"setting": SKY_SETTINGS, "state": STATES},
    "sky_nasa_image":     {"kind": SKY_KINDS},
    # ISS: pasadas sobre mi lugar (src/sky/IssPassesCard.jsx). kind: ver la tarjeta,
    # "Verla en el cielo", reintentar. state: resultado de la consulta.
    "iss_passes":         {"kind": ISS_KINDS, "state": ISS_STATES},
}

# Pares que interesa contar juntos (además de por separado)
COMBOS = {"destination_change": ("pair", "origin", "destination")}

_BOT_RE = re.compile(r"bot|crawl|spider|slurp|preview|lighthouse|headless|phantom|python-|curl/|wget|httpclient|monitor", re.I)
_TABLET_RE = re.compile(r"ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))", re.I)
_MOBILE_RE = re.compile(r"mobi|iphone|ipod|android.*mobile|windows phone|opera mini|iemobile", re.I)


def device_category(user_agent: Optional[str]) -> Optional[str]:
    """'mobile' | 'tablet' | 'desktop', o None si parece un robot. El
    user-agent no se guarda: solo se usa para esta clasificación."""
    ua = (user_agent or "")[:512]
    if not ua or _BOT_RE.search(ua):
        return None
    if _TABLET_RE.search(ua):
        return "tablet"
    if _MOBILE_RE.search(ua):
        return "mobile"
    return "desktop"


def _valid_value(rule: Any, v: Any) -> Optional[str]:
    if isinstance(v, bool):
        v = "on" if v else "off"
    if not isinstance(v, str):
        return None
    v = v.strip()
    if not v or len(v) > 40:
        return None
    if rule == TOKEN:
        return v if TOKEN_RE.match(v) else None
    return v if v in rule else None


def clean_event(raw: Any) -> Optional[Dict[str, Any]]:
    """{e, p} → {"e": nombre, "p": {param: valor}} o None si no pasa la lista
    blanca. Los parámetros desconocidos o con valores no admitidos se descartan
    (el evento cuenta igual)."""
    if not isinstance(raw, dict):
        return None
    name = raw.get("e")
    if not isinstance(name, str) or name not in EVENTS:
        return None
    rules = EVENTS[name]
    params = raw.get("p")
    out: Dict[str, str] = {}
    if isinstance(params, dict):
        for k, rule in rules.items():
            if k in params:
                val = _valid_value(rule, params[k])
                if val is not None:
                    out[k] = val
    return {"e": name, "p": out}


def parse_body(body: bytes) -> list:
    """Cuerpo crudo (JSON como text/plain, application/json o Blob de
    sendBeacon) → lista de eventos limpios. Nunca lanza."""
    if not body or len(body) > MAX_BODY_BYTES:
        return []
    try:
        data = json.loads(body.decode("utf-8"))
    except Exception:
        return []
    if isinstance(data, dict) and isinstance(data.get("events"), list):
        items = data["events"][:MAX_BATCH]
    elif isinstance(data, dict):
        items = [data]
    elif isinstance(data, list):
        items = data[:MAX_BATCH]
    else:
        return []
    return [ev for ev in (clean_event(x) for x in items) if ev]


def _offset_hours() -> float:
    """Desfase opcional del "día" respecto a UTC (TESEO_METRICS_UTC_OFFSET_HOURS,
    p. ej. -5 para Ecuador continental). Por defecto 0: día UTC."""
    try:
        v = float(os.environ.get("TESEO_METRICS_UTC_OFFSET_HOURS", "0") or 0)
        return v if -14 <= v <= 14 else 0.0
    except ValueError:
        return 0.0


def utc_day(ts: Optional[float] = None) -> str:
    """Día del contador (UTC, o UTC + TESEO_METRICS_UTC_OFFSET_HOURS)."""
    t = (ts if ts is not None else time.time()) + _offset_hours() * 3600
    return datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d")


# ─── Límite de abuso (solo memoria, ventana de un minuto) ─────────────────────

class RateLimiter:
    """Cuenta eventos por origen en la ventana del minuto actual. La clave es
    sha256(sal_del_minuto + ip)[:16]; la sal se crea al empezar cada minuto y
    se descarta con todos los contadores al terminarlo. La IP nunca se guarda."""

    def __init__(self, per_minute: int = RATE_PER_MINUTE, clock=time.time):
        self.per_minute = per_minute
        self.clock = clock
        self._lock = threading.Lock()
        self._window = None
        self._salt = b""
        self._counts: Dict[str, int] = {}

    def allow(self, ip: Optional[str], n: int = 1) -> int:
        """Cuántos de los `n` eventos caben en la ventana (0..n)."""
        with self._lock:
            window = int(self.clock() // 60)
            if window != self._window:
                self._window = window
                self._salt = secrets.token_bytes(16)
                self._counts = {}
            key = hashlib.sha256(self._salt + (ip or "?").encode("utf-8", "ignore")).hexdigest()[:16]
            used = self._counts.get(key, 0)
            room = max(0, self.per_minute - used)
            take = min(room, n)
            self._counts[key] = used + take
            # tope de memoria: muchísimos orígenes distintos en un minuto
            if len(self._counts) > 50000:
                self._counts.clear()
            return take

    def size(self) -> int:
        return len(self._counts)


# ─── Almacén de contadores ────────────────────────────────────────────────────

def _empty() -> Dict[str, Any]:
    return {"version": 1, "days": {}}


def _merge_into(dst: Dict[str, Any], src: Dict[str, Any]) -> None:
    """Suma los contadores de `src` en `dst` (respetando MAX_KEYS_PER_EVENT)."""
    ddays = dst.setdefault("days", {})
    for day, events in (src.get("days") or {}).items():
        if not isinstance(events, dict):
            continue
        dday = ddays.setdefault(day, {})
        for ev, counters in events.items():
            if not isinstance(counters, dict):
                continue
            dev = dday.setdefault(ev, {})
            for key, n in counters.items():
                if not isinstance(n, int) or n <= 0:
                    continue
                if key not in dev and key != "_" and len(dev) >= MAX_KEYS_PER_EVENT:
                    key = f"{key.split(':', 1)[0]}:{OTHER}"
                dev[key] = dev.get(key, 0) + n


def _prune(data: Dict[str, Any], today: str, retain: int = RETAIN_DAYS) -> None:
    cutoff = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=retain - 1)).strftime("%Y-%m-%d")
    for day in [d for d in data.get("days", {}) if d < cutoff]:
        del data["days"][day]


class MetricsStore:
    def __init__(self, directory: Optional[str] = None, clock=time.time,
                 retain_days: int = RETAIN_DAYS, flush_seconds: int = FLUSH_SECONDS):
        self.clock = clock
        self.retain_days = retain_days
        self.flush_seconds = flush_seconds
        self._lock = threading.RLock()
        self.base = _empty()          # último estado leído/escrito (o todo, en memoria)
        self.pending = _empty()       # incrementos aún no escritos
        self.dirty = False
        self.last_flush: Optional[float] = None
        self.last_error: Optional[str] = None
        self.path: Optional[str] = None
        self.reason: Optional[str] = None
        self._configure(directory)

    # -- configuración y disco -------------------------------------------------
    def _configure(self, directory: Optional[str]) -> None:
        if not directory:
            self.reason = "TESEO_METRICS_DIR no definida"
            return
        try:
            os.makedirs(directory, exist_ok=True)
            probe = os.path.join(directory, f".probe-{os.getpid()}")
            with open(probe, "w") as f:
                f.write("ok")
            os.remove(probe)
        except Exception as e:
            self.reason = f"directorio no escribible ({type(e).__name__})"
            return
        self.path = os.path.join(directory, FILE_NAME)
        try:
            self.base = self._read_disk()
        except Exception as e:
            self.last_error = f"lectura: {type(e).__name__}"

    @property
    def persistent(self) -> bool:
        return self.path is not None

    def _read_disk(self) -> Dict[str, Any]:
        if not self.path or not os.path.exists(self.path):
            return _empty()
        with open(self.path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or not isinstance(data.get("days"), dict):
            raise ValueError("formato desconocido")
        clean = _empty()
        _merge_into(clean, data)        # valida tipos al cargar
        return clean

    def _write_disk(self, data: Dict[str, Any]) -> None:
        tmp = f"{self.path}.tmp-{os.getpid()}"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"), sort_keys=True)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, self.path)

    # -- registro --------------------------------------------------------------
    def record(self, events: list, device: Optional[str] = None) -> int:
        """Suma una lista de eventos ya limpios (ver clean_event)."""
        if not events:
            return 0
        day = utc_day(self.clock())
        with self._lock:
            dday = self.pending["days"].setdefault(day, {})
            for ev in events:
                counters = dday.setdefault(ev["e"], {})
                self._inc(counters, "_")
                for k, v in ev["p"].items():
                    self._inc(counters, f"{k}:{v}")
                combo = COMBOS.get(ev["e"])
                if combo and combo[1] in ev["p"] and combo[2] in ev["p"]:
                    self._inc(counters, f"{combo[0]}:{ev['p'][combo[1]]}>{ev['p'][combo[2]]}")
                if ev["e"] == "session_start" and device:
                    self._inc(counters, f"device:{device}")
            self.dirty = True
        return len(events)

    @staticmethod
    def _inc(counters: Dict[str, int], key: str) -> None:
        if key not in counters and key != "_" and len(counters) >= MAX_KEYS_PER_EVENT:
            key = f"{key.split(':', 1)[0]}:{OTHER}"
        counters[key] = counters.get(key, 0) + 1

    # -- escritura -------------------------------------------------------------
    def flush(self) -> bool:
        """Lleva los incrementos pendientes a la base (y al disco si hay)."""
        with self._lock:
            today = utc_day(self.clock())
            if not self.persistent:
                _merge_into(self.base, self.pending)
                _prune(self.base, today, self.retain_days)
                self.pending = _empty()
                self.dirty = False
                return True
            try:
                try:
                    disk = self._read_disk()
                except Exception as e:      # archivo corrupto: no se pierde lo nuevo
                    self.last_error = f"lectura: {type(e).__name__}"
                    disk = copy.deepcopy(self.base)
                _merge_into(disk, self.pending)
                _prune(disk, today, self.retain_days)
                self._write_disk(disk)
            except Exception as e:
                self.last_error = f"escritura: {type(e).__name__}"
                return False
            self.base = disk
            self.pending = _empty()
            self.dirty = False
            self.last_flush = self.clock()
            self.last_error = None
            return True

    # -- lectura ---------------------------------------------------------------
    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            data = copy.deepcopy(self.base)
            _merge_into(data, self.pending)
            _prune(data, utc_day(self.clock()), self.retain_days)
            return data

    def status(self) -> Dict[str, Any]:
        snap = self.snapshot()
        today = utc_day(self.clock())
        events_today = sum(c.get("_", 0) for c in snap["days"].get(today, {}).values())
        out = {
            "storage": "persistent" if self.persistent else "memory",
            "days_stored": len(snap["days"]),
            "events_today": events_today,
        }
        if not self.persistent:
            out["reason"] = self.reason
        elif os.environ.get("RAILWAY_PROJECT_ID") or os.environ.get("RAILWAY_ENVIRONMENT_NAME"):
            # En Railway, un directorio escribible sin volumen se borra en cada despliegue
            vol = (os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") or "").rstrip("/")
            out["railway_volume"] = bool(vol) and os.path.abspath(self.path).startswith(vol + "/")
        if self.last_error:
            out["error"] = self.last_error
        return out

    def summary(self, days: int = 30, top: int = 15) -> Dict[str, Any]:
        days = max(1, min(int(days), self.retain_days))
        snap = self.snapshot()
        today = utc_day(self.clock())
        start = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=days - 1)).strftime("%Y-%m-%d")
        dates = [(datetime.strptime(start, "%Y-%m-%d") + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]

        events: Dict[str, Dict[str, Any]] = {}
        by_day = []
        devices = {"mobile": 0, "tablet": 0, "desktop": 0}
        for d in dates:
            dd = snap["days"].get(d, {})
            row = {"date": d, "sessions": 0, "page_views": 0, "events": 0,
                   "devices": {"mobile": 0, "tablet": 0, "desktop": 0}, "by_event": {}}
            for ev, counters in dd.items():
                total = counters.get("_", 0)
                row["events"] += total
                row["by_event"][ev] = total
                agg = events.setdefault(ev, {"total": 0, "params": {}})
                agg["total"] += total
                for key, n in counters.items():
                    if key == "_":
                        continue
                    p, _, v = key.partition(":")
                    agg["params"].setdefault(p, {})
                    agg["params"][p][v] = agg["params"][p].get(v, 0) + n
                    if ev == "session_start" and p == "device" and v in row["devices"]:
                        row["devices"][v] += n
                        devices[v] += n
            row["sessions"] = dd.get("session_start", {}).get("_", 0)
            row["page_views"] = dd.get("page_view", {}).get("_", 0)
            by_day.append(row)

        # parámetros ordenados de mayor a menor
        for agg in events.values():
            agg["params"] = {p: dict(sorted(vals.items(), key=lambda kv: (-kv[1], kv[0])))
                             for p, vals in sorted(agg["params"].items())}

        def topof(ev: str, param: str):
            vals = events.get(ev, {}).get("params", {}).get(param, {})
            return [{"value": v, "count": n} for v, n in list(vals.items())[:top]]

        return {
            "generated": datetime.fromtimestamp(self.clock(), tz=timezone.utc).isoformat(timespec="seconds"),
            "from": dates[0],
            "to": dates[-1],
            "days": days,
            "storage": "persistent" if self.persistent else "memory",
            "totals": {
                "sessions": sum(r["sessions"] for r in by_day),
                "page_views": sum(r["page_views"] for r in by_day),
                "events": sum(r["events"] for r in by_day),
            },
            "devices": devices,
            "by_day": by_day,
            "events": dict(sorted(events.items(), key=lambda kv: (-kv[1]["total"], kv[0]))),
            "top": {
                "tabs": topof("tab_change", "tab"),
                "entry_tabs": topof("page_view", "tab"),
                "routes": topof("destination_change", "pair"),
                "tours": topof("q_open", "q"),
                "presets": topof("q_preset", "preset"),
                "now_cards": topof("now_card_view", "card"),
                "sky_objects": topof("sky_select", "id"),
                "sky_kinds": topof("sky_select", "kind"),
                "sky_layers": topof("sky_layer", "layer"),
                "net_errors": topof("net_error", "endpoint"),
            },
            "utc_offset_hours": _offset_hours(),
            "note": "Recuentos anónimos y agregados por día (UTC salvo desfase configurado): sin IP, sin user-agent, sin cookies ni identificadores.",
        }

    def csv(self, days: int = 30) -> str:
        days = max(1, min(int(days), self.retain_days))
        snap = self.snapshot()
        today = utc_day(self.clock())
        start = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=days - 1)).strftime("%Y-%m-%d")
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(["date", "event", "param", "value", "count"])
        for d in sorted(x for x in snap["days"] if x >= start):
            for ev in sorted(snap["days"][d]):
                counters = snap["days"][d][ev]
                w.writerow([d, ev, "", "", counters.get("_", 0)])
                for key in sorted(k for k in counters if k != "_"):
                    p, _, v = key.partition(":")
                    w.writerow([d, ev, p, v, counters[key]])
        return buf.getvalue()


def client_ip(headers, fallback: Optional[str]) -> Optional[str]:
    """IP del visitante tras el proxy de Railway (solo para el límite por
    minuto: se usa hasheada con sal efímera y nunca se guarda)."""
    xff = headers.get("x-forwarded-for") or ""
    first = xff.split(",")[0].strip()
    return first or headers.get("x-real-ip") or fallback
