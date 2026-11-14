// track.js — analítica de Teseo. Un único punto de salida para toda la app:
//     track("tab_change", { tab: "sky" })
// Cada llamada hace DOS cosas independientes:
//
//  (a) Google Analytics — solo si existe window.gtag Y la persona aceptó el
//      aviso de cookies (localStorage "yd-consent" === "granted"). Igual que antes.
//
//  (b) Métricas propias, ANÓNIMAS Y AGREGADAS — se envían SIEMPRE (no usan
//      cookies ni datos personales, así que no necesitan consentimiento) al
//      backend de Teseo (POST {VITE_API_URL}/api/m), que solo suma contadores
//      por día. Van en cola, en lotes de hasta 20 cada pocos segundos y al
//      ocultar la página (sendBeacon con text/plain: sin preflight CORS).
//      Si falla, se descarta. Excepción deliberada: si el navegador pide no
//      ser rastreado (navigator.doNotTrack === "1" o Global Privacy Control),
//      tampoco se envía nada al backend propio. Aunque los datos sean
//      anónimos, respetar esa señal es lo honesto y lo que la persona pidió.
//
// Reglas (no negociables):
//   · solo viajan parámetros de una lista blanca, con valores cortos: nunca
//     texto libre ni lo que escribe la persona, ni ubicación, coordenadas,
//     búsquedas o nada que identifique a alguien (el servidor vuelve a filtrar
//     con su propia lista blanca de eventos y valores);
//   · "visitas" = `session_start`, una vez por pestaña (marca en
//     sessionStorage, que se borra al cerrar la pestaña; nada de localStorage
//     ni cookies para esto);
//   · nunca lanza: la analítica no puede romper la app.

const ALLOWED = new Set([
  "tab", "from", "to", "origin", "destination", "lang", "section", "source", "card", "layer", "id", "state",
  "q", "preset", "kind", "endpoint", "screen", "setting",
]);
const NAME_RE = /^[a-z][a-z0-9_]{1,39}$/;
// Eventos que GA4 reserva o ya recoge por su cuenta (index.html envía page_view):
// solo van al backend propio.
const GA_SKIP = new Set(["session_start", "page_view"]);

const ENV = (import.meta.env || {});
const API = ENV.VITE_API_URL || "";
export const METRICS_PATH = "/api/m";

/** Limpia los parámetros: lista blanca de claves y valores primitivos cortos. Pura. */
export function cleanParams(params) {
  const out = {};
  if (!params || typeof params !== "object") return out;
  for (const k of Object.keys(params)) {
    if (!ALLOWED.has(k)) continue;
    const v = params[k];
    if (typeof v === "string") out[k] = v.slice(0, 40);
    else if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) out[k] = v;
  }
  return out;
}

/** Versión para el backend propio: solo cadenas cortas (booleanos → on/off). Pura. */
export function metricParams(params) {
  const out = {};
  const c = cleanParams(params);
  for (const k of Object.keys(c)) {
    const v = c[k];
    if (typeof v === "boolean") out[k] = v ? "on" : "off";
    else if (typeof v === "string" && v.trim() && v.length <= 40) out[k] = v.trim();
  }
  return out;
}

/** true si hay consentimiento explícito de analítica en este navegador. */
export function hasConsent(win = typeof window !== "undefined" ? window : undefined) {
  try { return !!win && win.localStorage.getItem("yd-consent") === "granted"; } catch { return false; }
}

/** true si el navegador pide no ser rastreado (DNT o Global Privacy Control). */
export function optedOut(win = typeof window !== "undefined" ? window : undefined) {
  try {
    if (!win) return false;
    const n = win.navigator || {};
    return n.doNotTrack === "1" || n.doNotTrack === "yes" || win.doNotTrack === "1" || n.globalPrivacyControl === true;
  } catch { return false; }
}

/** Categoría gruesa de pantalla (nunca la resolución exacta). Pura. */
export function screenCategory(width) {
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return undefined;
  return w < 640 ? "small" : w < 1024 ? "medium" : "large";
}

// ─── Cola de métricas propias ────────────────────────────────────────────────

/**
 * Crea un cliente de métricas con cola en memoria. Se exporta para probarlo
 * en Node con un `win` falso y temporizadores inyectados.
 * @returns {{ push, flush, size, enabled, dispose }}
 */
export function createMetrics({
  win, endpoint, flushMs = 4000, batch = 20, maxQueue = 100,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id),
} = {}) {
  let queue = [];
  let timer = null;
  let enabled = false;
  try { enabled = !!win && typeof endpoint === "string" && /^https?:\/\//i.test(endpoint) && !optedOut(win); } catch { enabled = false; }

  const send = (body) => {
    try {
      const nav = win.navigator;
      if (nav && typeof nav.sendBeacon === "function" && nav.sendBeacon(endpoint, body)) return true;
    } catch { /* sigue con fetch */ }
    try {
      if (typeof win.fetch === "function") {
        // sin cabeceras propias: el cuerpo string viaja como text/plain (sin preflight)
        const p = win.fetch(endpoint, { method: "POST", body, keepalive: true, mode: "no-cors", credentials: "omit" });
        if (p && typeof p.catch === "function") p.catch(() => {});
        return true;
      }
    } catch { /* se descarta */ }
    return false;
  };

  const flush = () => {
    try {
      if (timer !== null) { clearTimer(timer); timer = null; }
      let sent = 0;
      while (queue.length) {
        const chunk = queue.slice(0, batch);
        queue = queue.slice(batch);
        send(JSON.stringify({ events: chunk }));
        sent += chunk.length;
      }
      return sent;
    } catch { queue = []; return 0; }
  };

  const schedule = () => {
    if (timer !== null) return;
    try { timer = setTimer(() => { timer = null; flush(); }, flushMs); } catch { timer = null; }
  };

  const push = (event, params) => {
    try {
      if (!enabled || typeof event !== "string" || !NAME_RE.test(event)) return false;
      if (queue.length >= maxQueue) queue.shift();               // nunca crece sin límite
      queue.push({ e: event, p: metricParams(params) });
      if (queue.length >= batch) flush(); else schedule();
      return true;
    } catch { return false; }
  };

  let onHide = null;
  try {
    if (enabled && typeof win.addEventListener === "function") {
      onHide = () => { try { if (!win.document || win.document.visibilityState === "hidden") flush(); } catch { flush(); } };
      win.addEventListener("visibilitychange", onHide);
      win.addEventListener("pagehide", flush);
    }
  } catch { /* no-op */ }

  return {
    push, flush,
    size: () => queue.length,
    enabled: () => enabled,
    dispose() {
      try {
        if (timer !== null) clearTimer(timer);
        if (onHide) { win.removeEventListener("visibilitychange", onHide); win.removeEventListener("pagehide", flush); }
      } catch { /* no-op */ }
      timer = null; queue = [];
    },
  };
}

let defaultClient;
function client() {
  if (defaultClient !== undefined) return defaultClient;
  defaultClient = null;
  try {
    if (typeof window !== "undefined" && API) defaultClient = createMetrics({ win: window, endpoint: `${API.replace(/\/+$/, "")}${METRICS_PATH}` });
  } catch { defaultClient = null; }
  return defaultClient;
}

/**
 * Envía un evento anónimo. Devuelve true si se envió a Google Analytics
 * (las métricas propias van aparte y no cambian el valor devuelto).
 * @param {string} event  nombre en snake_case (p. ej. "tab_change")
 * @param {object} [params] solo claves de la lista blanca
 * @param {object} [win]  ventana (para pruebas)
 * @param {object} [metrics] cliente de métricas (para pruebas); por defecto el global
 */
export function track(event, params, win = typeof window !== "undefined" ? window : undefined, metrics) {
  try {
    if (typeof event !== "string" || !NAME_RE.test(event)) return false;
    try { const m = metrics === undefined ? (win === (typeof window !== "undefined" ? window : undefined) ? client() : null) : metrics; if (m) m.push(event, params); } catch { /* no-op */ }
    if (GA_SKIP.has(event)) return false;
    if (!win || typeof win.gtag !== "function") return false;
    if (!hasConsent(win)) return false;
    win.gtag("event", event, cleanParams(params));
    return true;
  } catch { return false; }
}

// ─── Ayudas ──────────────────────────────────────────────────────────────────

const onceMem = new Set();
/** true la primera vez que se pide `key` en esta pestaña (sessionStorage; si no hay, en memoria). */
export function firstInSession(key, win = typeof window !== "undefined" ? window : undefined) {
  const k = `teseo-once:${key}`;
  try {
    const ss = win && win.sessionStorage;
    if (ss) {
      if (ss.getItem(k)) return false;
      ss.setItem(k, "1");
      return true;
    }
  } catch { /* sessionStorage bloqueado: memoria */ }
  if (onceMem.has(k)) return false;
  onceMem.add(k);
  return true;
}

/** Como track(), pero solo la primera vez por pestaña para esa clave (p. ej. deslizadores). */
export function trackOnce(key, event, params, win, metrics) {
  try {
    if (!firstInSession(key, win)) return false;
    return track(event, params, win, metrics) || true;
  } catch { return false; }
}

/**
 * Al cargar la app: `page_view` (cada carga, con la pestaña inicial) y
 * `session_start` (una vez por pestaña, con idioma y tamaño de pantalla).
 */
export function startSession({ lang, tab } = {}, win = typeof window !== "undefined" ? window : undefined, metrics) {
  try {
    track("page_view", { tab }, win, metrics);
    if (firstInSession("session", win)) {
      track("session_start", { lang, tab, screen: screenCategory(win && win.innerWidth) }, win, metrics);
    }
  } catch { /* no-op */ }
}

/** Clasifica un error de red sin guardar el mensaje ni la URL. null = cancelación. Pura. */
export function errorKind(err) {
  if (!err) return "network";
  if (err.name === "AbortError") return null;
  if (err.name === "TimeoutError") return "timeout";
  const m = /HTTP (\d)\d\d/.exec(String(err.message || ""));
  if (m) return m[1] === "5" ? "http5xx" : "http4xx";
  if (err.name === "SyntaxError") return "parse";
  return "network";
}

const errCount = new Map();
// Al salir de la página el navegador corta las peticiones en curso ("Failed to
// fetch"): eso no es un fallo del servicio y no se cuenta.
let leaving = false;
try {
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", () => { leaving = true; });
    window.addEventListener("pagehide", () => { leaving = true; });
    window.addEventListener("pageshow", () => { leaving = false; });
  }
} catch { /* no-op */ }
function pageGoingAway(win) {
  try { return leaving || (!!win && !!win.document && win.document.visibilityState === "hidden"); } catch { return false; }
}

/** Error de red agregado por endpoint (máx. 3 por endpoint y tipo en cada carga). */
export function trackNetError(endpoint, err, win = typeof window !== "undefined" ? window : undefined, metrics) {
  try {
    const kind = errorKind(err);
    if (!kind || pageGoingAway(win)) return false;
    const key = `${endpoint}|${kind}`;
    const n = errCount.get(key) || 0;
    if (n >= 3) return false;
    errCount.set(key, n + 1);
    track("net_error", { endpoint, kind }, win, metrics);
    return true;
  } catch { return false; }
}

export default track;
