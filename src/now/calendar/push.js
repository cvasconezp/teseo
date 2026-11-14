// push.js — «Recordarme»: avisos push web de los eventos del Calendario del cielo (backend: /api/push/*,
// service worker: public/sw.js). Lleguen aunque la app esté cerrada.
//
// Privacidad (no negociable):
//   · el permiso de notificaciones se pide SOLO cuando la persona toca «Activar aviso» o «Probar», nunca al cargar;
//   · al servidor viaja la suscripción push del navegador (endpoint + claves de cifrado) y, por recordatorio,
//     el id del evento, su hora UTC, el título, la URL interna (#ahora), la antelación y el idioma. Nada más:
//     ni ubicación (el lugar elegido en el Cielo no sale del dispositivo), ni nombre, ni identificadores;
//   · en localStorage («teseo_push_v1») solo se apunta QUÉ eventos tienen recordatorio y a qué hora llega el aviso,
//     para pintar el botón. Sin datos personales.
//
// La primera mitad del archivo es lógica pura (se prueba en scripts/test_now_push.mjs); la segunda usa el
// navegador (Notification, serviceWorker, PushManager, fetch).

export const STORE_KEY = "teseo_push_v1";
export const PUSH_EVENT = "teseo:push-change";
/** Antelaciones: 30 min y 2 h para eventos con hora; la víspera a las 18:00 para los de día completo. */
export const LEADS = { "30": 30, "120": 120, eve: 6 * 60 };
const MIN = 60000;

// ─── Detección (pura) ────────────────────────────────────────────────────────

/** iPhone, iPod o iPad (también el iPad que se anuncia como Mac, con pantalla táctil). */
export function isIOS({ ua = "", platform = "", maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return (platform === "MacIntel" || /Macintosh/.test(ua)) && maxTouchPoints > 1;
}

/** Versión de iOS/iPadOS a partir del user-agent: [mayor, menor] o null (el iPad «de escritorio» no la dice). */
export function iosVersion(ua = "") {
  const m = /OS (\d+)[_.](\d+)(?:[_.]\d+)? like Mac OS X/i.exec(ua);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * ¿Se pueden recibir avisos push aquí?
 * @param env { ua, platform, maxTouchPoints, standalone, secure, hasServiceWorker, hasPushManager, hasNotification }
 * @returns {{ state: "ok"|"ios_install"|"unsupported", reason?: "ios_old"|"insecure"|"no_api" }}
 *   ios_install: iPhone/iPad en Safari sin instalar: Apple solo permite push a webs añadidas a la pantalla de inicio
 *   (iOS/iPadOS 16.4 o posterior).
 */
export function detectPush(env = {}) {
  const apis = !!(env.hasServiceWorker && env.hasPushManager && env.hasNotification);
  if (isIOS(env)) {
    const v = iosVersion(env.ua);
    const old = !!v && (v[0] < 16 || (v[0] === 16 && v[1] < 4));
    if (old) return { state: "unsupported", reason: "ios_old" };
    if (!env.standalone) return { state: "ios_install" };
    return apis && env.secure !== false ? { state: "ok" } : { state: "unsupported", reason: "no_api" };
  }
  if (env.secure === false) return { state: "unsupported", reason: "insecure" };
  return apis ? { state: "ok" } : { state: "unsupported", reason: "no_api" };
}

// ─── Hora del aviso (pura) ───────────────────────────────────────────────────

/** Antelaciones que se ofrecen para un evento. */
export const leadOptions = (ev) => (ev && ev.allDay ? ["eve"] : ["30", "120"]);

/**
 * Cuándo empieza el evento y cuándo llega el aviso.
 *  · Con hora: el inicio es ev.t; aviso 30 min o 2 h antes.
 *  · De día completo (fecha de catálogo, guardada como fecha UTC): el «inicio» es la medianoche LOCAL de esa fecha
 *    y el aviso, 6 h antes: la víspera a las 18:00 en la zona del dispositivo (como el VALARM del .ics).
 * Si la antelación ya pasó, el aviso se adelanta a «ahora» (el servidor hace lo mismo).
 * @returns {{ eventAt: number, leadMin: number, notifyAt: number } | null}  null si el evento ya empezó (o falta < 1 min)
 */
export function reminderTimes(ev, lead, now = Date.now()) {
  if (!ev || !Number.isFinite(ev.t)) return null;
  let eventAt, leadMin;
  if (ev.allDay) {
    const d = new Date(ev.t);
    eventAt = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0).getTime();
    leadMin = LEADS.eve;
  } else {
    if (!(lead in LEADS) || lead === "eve") return null;
    eventAt = ev.t;
    leadMin = LEADS[lead];
  }
  if (!Number.isFinite(eventAt) || eventAt <= now + MIN) return null;
  return { eventAt, leadMin, notifyAt: Math.max(eventAt - leadMin * MIN, now) };
}

/** true si alguna antelación sirve todavía (el evento no ha empezado). */
export const canRemind = (ev, now = Date.now()) => leadOptions(ev).some((l) => !!reminderTimes(ev, l, now));

// ─── Peticiones (puras) ──────────────────────────────────────────────────────

/** Solo lo imprescindible de PushSubscription.toJSON(): endpoint y claves (fuera expirationTime y lo demás). */
export function cleanSubscription(json) {
  if (!json || typeof json.endpoint !== "string" || !json.keys) return null;
  const { p256dh, auth } = json.keys;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  return { endpoint: json.endpoint, keys: { p256dh, auth } };
}

const isoUtc = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/** Cuerpo de POST /api/push/remind. Devuelve null si el evento ya no admite recordatorio. */
export function buildRemindRequest({ subscription, ev, title, lead, lang = "es", url = "/#ahora", now = Date.now() }) {
  const sub = cleanSubscription(subscription);
  const times = reminderTimes(ev, lead, now);
  if (!sub || !times) return null;
  return {
    subscription: sub,
    event: { id: String(ev.id), title: String(title || "").slice(0, 200), at_utc: isoUtc(times.eventAt), url, all_day: !!ev.allDay },
    lead_min: times.leadMin,
    lang: lang === "en" ? "en" : "es",
  };
}

export const buildDeleteRequest = (endpoint, eventId) => ({ endpoint, event_id: String(eventId) });

/** base64url → Uint8Array (applicationServerKey). */
export function urlB64ToUint8Array(s) {
  const b64 = String(s).replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (String(s).length % 4)) % 4);
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** ¿La suscripción existente se creó con esta clave? (si el servidor cambió de clave, hay que renovarla) */
export function sameKey(buf, u8) {
  if (!buf || !u8) return false;
  const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (a.length !== u8.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== u8[i]) return false;
  return true;
}

// ─── Estado local (puro, con un storage inyectable) ──────────────────────────

/** { v: 1, r: { idEvento: horaDelAviso(ms) } }; se olvidan los avisos que ya llegaron (hace > 5 min). */
export function readState(storage, now = Date.now()) {
  const empty = { v: 1, r: {} };
  let raw = null;
  try { raw = JSON.parse((storage && storage.getItem(STORE_KEY)) || "null"); } catch { raw = null; }
  if (!raw || raw.v !== 1 || typeof raw.r !== "object" || raw.r === null) return empty;
  const r = {};
  for (const [id, at] of Object.entries(raw.r)) if (typeof id === "string" && id.length <= 120 && Number.isFinite(at) && at > now - 5 * MIN) r[id] = at;
  return { v: 1, r };
}
export function writeState(storage, state) {
  try {
    if (!storage) return;
    if (!state || !Object.keys(state.r).length) storage.removeItem(STORE_KEY);
    else storage.setItem(STORE_KEY, JSON.stringify({ v: 1, r: state.r }));
  } catch { /* almacenamiento lleno o bloqueado: solo se pierde el estado del botón */ }
}
export const withReminder = (state, id, notifyAt) => ({ v: 1, r: { ...state.r, [id]: notifyAt } });
export function withoutReminder(state, id) { const r = { ...state.r }; delete r[id]; return { v: 1, r }; }

// ─── Navegador ───────────────────────────────────────────────────────────────

export class PushError extends Error {
  constructor(code, message = code, status = 0) { super(message); this.name = "PushError"; this.code = code; this.status = status; }
}

const W = () => (typeof window !== "undefined" ? window : undefined);
const storage = () => { try { return W() && W().localStorage; } catch { return null; } };

/** Lo que detectPush necesita, leído del navegador. */
export function browserEnv(win = W()) {
  if (!win) return {};
  const n = win.navigator || {};
  let standalone = n.standalone === true;
  try { standalone = standalone || (!!win.matchMedia && win.matchMedia("(display-mode: standalone)").matches); } catch { /* no-op */ }
  return {
    ua: n.userAgent || "", platform: n.platform || "", maxTouchPoints: n.maxTouchPoints || 0, standalone,
    secure: win.isSecureContext !== false,
    hasServiceWorker: "serviceWorker" in n, hasPushManager: "PushManager" in win, hasNotification: "Notification" in win,
  };
}

/** "granted" | "denied" | "default" | "unsupported" */
export function permission(win = W()) {
  try { return win && win.Notification ? win.Notification.permission : "unsupported"; } catch { return "unsupported"; }
}

const base = (api) => String(api || "").replace(/\/+$/, "");
let keyCache = { api: null, promise: null };

/** Clave pública VAPID del servidor, o null si no hay (503: sin claves → la interfaz oculta el botón). */
export function loadPublicKey(api, fetchImpl = typeof fetch === "function" ? fetch : null) {
  if (keyCache.api === api && keyCache.promise) return keyCache.promise;
  const p = (async () => {
    if (!fetchImpl) return null;
    try {
      const r = await fetchImpl(`${base(api)}/api/push/key`, { credentials: "omit" });
      if (!r.ok) return null;
      const j = await r.json();
      return typeof j.public_key === "string" && j.public_key.length > 40 ? j.public_key : null;
    } catch { return null; }
  })();
  keyCache = { api, promise: p };
  p.then((k) => { if (k === null && keyCache.promise === p) keyCache = { api: null, promise: null }; });  // reintento en la próxima carga
  return p;
}

async function askPermission(win) {
  const N = win.Notification;
  if (N.permission === "granted") return "granted";
  if (N.permission === "denied") return "denied";
  // Safari antiguo usa callback; los demás, promesa
  return await new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    try { const p = N.requestPermission(fin); if (p && typeof p.then === "function") p.then(fin, () => fin("default")); } catch { fin("default"); }
  });
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new PushError("sw", "service worker timeout")), ms))]);

async function registration(win) {
  const sw = win.navigator.serviceWorker;
  try { return await withTimeout(sw.ready, 8000); } catch { /* sigue */ }
  const reg = (await sw.getRegistration()) || (await sw.register("/sw.js"));
  return await withTimeout(sw.ready.then(() => reg), 8000);
}

/**
 * Pide permiso (si hace falta) y devuelve la suscripción push de este navegador, creada con la clave del servidor.
 * Llamar SOLO desde el gesto de la persona (clic): Safari lo exige para requestPermission.
 */
export async function ensureSubscription(publicKey, win = W()) {
  const env = detectPush(browserEnv(win));
  if (env.state !== "ok") throw new PushError(env.state === "ios_install" ? "ios_install" : "unsupported");
  const perm = await askPermission(win);       // lo primero: conserva el gesto de usuario
  if (perm === "denied") throw new PushError("denied");
  if (perm !== "granted") throw new PushError("dismissed");
  let reg;
  try { reg = await registration(win); } catch { throw new PushError("sw"); }
  const key = urlB64ToUint8Array(publicKey);
  let sub = null;
  try { sub = await reg.pushManager.getSubscription(); } catch { sub = null; }
  if (sub && !sameKey(sub.options && sub.options.applicationServerKey, key)) {
    try { await sub.unsubscribe(); } catch { /* no-op */ }
    sub = null;
  }
  if (!sub) {
    try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); }
    catch (e) { throw new PushError("subscribe_failed", String((e && e.name) || "error")); }
  }
  return sub;
}

async function call(api, path, method, body) {
  let r;
  try {
    r = await fetch(`${base(api)}${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "omit" });
  } catch { throw new PushError("network"); }
  if (r.ok) return r.status === 204 ? null : r.json().catch(() => null);
  let j = null;
  try { j = await r.json(); } catch { j = null; }
  throw new PushError((j && j.code) || `http_${r.status}`, (j && j.detail) || `HTTP ${r.status}`, r.status);
}

function emit() { try { W().dispatchEvent(new CustomEvent(PUSH_EVENT)); } catch { /* no-op */ } }

/** Estado local actual (qué eventos tienen recordatorio). */
export const localReminders = () => readState(storage()).r;

/** Crea (o actualiza) el recordatorio. Devuelve { notifyAt }. */
export async function addReminder({ api, publicKey, ev, title, lead, lang }) {
  const sub = await ensureSubscription(publicKey);
  const body = buildRemindRequest({ subscription: sub.toJSON(), ev, title, lead, lang });
  if (!body) throw new PushError("started");
  await call(api, "/api/push/remind", "POST", body);
  const notifyAt = reminderTimes(ev, lead).notifyAt;
  writeState(storage(), withReminder(readState(storage()), String(ev.id), notifyAt));
  emit();
  return { notifyAt };
}

/** Quita el recordatorio. Si ya no queda ninguno, también se anula la suscripción en el navegador. */
export async function removeReminder({ api, eventId, win = W() }) {
  let sub = null;
  try {
    const reg = await withTimeout(win.navigator.serviceWorker.ready, 5000);
    sub = await reg.pushManager.getSubscription();
  } catch { sub = null; }
  if (sub) await call(api, "/api/push/remind", "DELETE", buildDeleteRequest(sub.endpoint, eventId));
  const next = withoutReminder(readState(storage()), String(eventId));
  writeState(storage(), next);
  if (sub && !Object.keys(next.r).length) { try { await sub.unsubscribe(); } catch { /* no-op */ } }
  emit();
}

/** Notificación de prueba (el servidor no guarda nada). */
export async function sendTest({ api, publicKey, lang }) {
  const sub = await ensureSubscription(publicKey);
  await call(api, "/api/push/test", "POST", { subscription: cleanSubscription(sub.toJSON()), lang: lang === "en" ? "en" : "es" });
}
