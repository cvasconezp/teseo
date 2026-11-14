// issPasses.js — «¿Cuándo pasa la ISS sobre mí?»: cliente de /api/iss/passes y lógica pura
// (horas en la zona del dispositivo, próxima pasada visible, cuenta atrás, descripción en palabras).
// Sin DOM ni React: se prueba con scripts/test_sky_iss.mjs. Los textos están en i18n-iss.js.
//
// Contrato de la respuesta (backend/app/iss.py): { stale, updated, observer, window, elements,
// warnings, passes: [{ start, max, end, duration_s, max_alt, visible, visible_from, visible_to,
// visible_duration_s, mag, why_not_visible, track: [{ t, alt, az, lit }] }] }. Cada punto trae
// t (ISO UTC), alt (°), az (° desde el norte hacia el este) y compass / compass_es.

const ENV = (typeof import.meta !== "undefined" && import.meta.env) || {};
export const API = ENV.VITE_API_URL || "";
export const DEFAULT_DAYS = 5;

const loc = (lang) => (lang === "es" ? "es" : "en-US");
const MINUS = "−";

/** URL de la consulta. No se manda nada más que el lugar que la persona eligió.
 *  `track` ("visible" | "all" | "none") y `passStart` (ISO UTC del inicio de una pasada) son opcionales. */
export function issUrl({ lat, lon, altM = 0, days = DEFAULT_DAYS, api = API, track, passStart } = {}) {
  const q = new URLSearchParams({
    lat: String(Math.round(lat * 1000) / 1000),
    lon: String(Math.round(lon * 1000) / 1000),
    alt_m: String(Math.max(-500, Math.min(9000, Math.round(Number(altM) || 0)))),
    days: String(Math.max(1, Math.min(10, Math.round(days)))),
  });
  if (track === "all" || track === "none") q.set("track", track);
  if (passStart) q.set("pass_start", String(passStart));
  return `${String(api).replace(/\/+$/, "")}/api/iss/passes?${q}`;
}

/** Holgura (ms) al reconocer una pasada por su inicio: dos cálculos del servidor con «ahora» distinto
 *  pueden afinar el inicio con un segundo de diferencia (igual que PASS_MATCH_S en backend/app/iss.py). */
export const PASS_MATCH_MS = 120000;

/** De una lista normalizada, la pasada cuyo inicio está más cerca de `startMs` (a menos de PASS_MATCH_MS). */
export function findPass(passes, startMs, tol = PASS_MATCH_MS) {
  let best = null, bd = tol;
  for (const p of passes || []) {
    const d = Math.abs(p.startMs - startMs);
    if (d <= bd) { best = p; bd = d; }
  }
  return best;
}

/** ¿Trae la pasada su trayectoria? (por defecto el servidor solo la manda en las visibles). */
export const hasTrack = (p) => !!(p && Array.isArray(p.track) && p.track.length >= 2);

/**
 * La trayectoria de UNA pasada, para dibujarla en el Cielo aunque no sea visible.
 * Pide `pass_start` (el servidor devuelve solo esa pasada, ~2 KB) y además `track=all`: un servidor
 * anterior que no conozca `pass_start` lo ignora y devuelve todas con su trayectoria (~80 KB en 5 días),
 * de donde se toma la buscada. Devuelve { pass, data } o lanza Error si no aparece.
 */
export async function fetchIssPass({ lat, lon, altM = 0, days = DEFAULT_DAYS, pass, signal, fetchImpl, api } = {}) {
  const f = fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!f) throw new Error("fetch no disponible");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("sin lugar");
  if (!pass || !pass.start) throw new Error("sin pasada");
  const startMs = pass.startMs ?? ms(pass.start.t);
  const res = await f(issUrl({ lat, lon, altM, days, api, track: "all", passStart: pass.start.t }), { signal, headers: { Accept: "application/json" } });
  if (!res.ok) { const err = new Error(`HTTP ${res.status}`); err.status = res.status; throw err; }
  const raw = await res.json();
  if (!raw || !Array.isArray(raw.passes)) throw new Error("respuesta inesperada");
  const data = normalizePasses(raw);
  const hit = findPass(data.passes, startMs);
  if (!hit || !hasTrack(hit)) { const err = new Error("pasada no encontrada"); err.status = 404; throw err; }
  return { pass: hit, data };
}

/** Por qué no se ve una pasada a simple vista: "sun_up" (de día), "iss_in_shadow" (en la sombra de la
 *  Tierra), "partial" (cuando es de noche la ISS ya va en sombra) o null si se ve. */
export function hiddenReason(p) {
  if (!p || p.visible) return null;
  return p.why_not_visible === "sun_up" || p.why_not_visible === "iss_in_shadow" ? p.why_not_visible : "partial";
}

/** Pasadas que aún no han terminado (visibles o no), en orden: para «listar también las no visibles». */
export function upcomingPasses(passes, nowMs = Date.now()) {
  return (passes || []).filter((p) => p.endMs > nowMs);
}

const ms = (iso) => Date.parse(iso);

/** Añade marcas de tiempo en milisegundos para no volver a parsear ISO a cada comparación. */
export function normalizePasses(data) {
  const passes = (data && Array.isArray(data.passes) ? data.passes : []).filter((p) => p && p.start && p.end && p.max).map((p) => ({
    ...p,
    startMs: ms(p.start.t), maxMs: ms(p.max.t), endMs: ms(p.end.t),
    visFromMs: p.visible_from ? ms(p.visible_from.t) : null,
    visToMs: p.visible_to ? ms(p.visible_to.t) : null,
  })).filter((p) => Number.isFinite(p.startMs) && Number.isFinite(p.endMs));
  passes.sort((a, b) => a.startMs - b.startMs);
  return { ...data, passes };
}

/** Pide las pasadas. `fetchImpl` y `signal` permiten probarlo y cancelarlo. Lanza Error("HTTP 502") si falla. */
export async function fetchIssPasses({ lat, lon, altM = 0, days = DEFAULT_DAYS, signal, fetchImpl, api } = {}) {
  const f = fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!f) throw new Error("fetch no disponible");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("sin lugar");
  const res = await f(issUrl({ lat, lon, altM, days, api }), { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).detail || ""; } catch { /* sin cuerpo JSON */ }
    const err = new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.passes)) throw new Error("respuesta inesperada");
  return normalizePasses(data);
}

// ── horas en la zona del dispositivo ─────────────────────────────────────────
const fmtCache = new Map();
function fmt(lang, tz, opts) {
  const key = `${lang}|${tz || ""}|${JSON.stringify(opts)}`;
  let f = fmtCache.get(key);
  if (!f) { f = new Intl.DateTimeFormat(loc(lang), { ...(tz ? { timeZone: tz } : {}), ...opts }); fmtCache.set(key, f); }
  return f;
}
const toDate = (t) => (t instanceof Date ? t : new Date(t));

/** «19:35» (24 h; hh:mm:ss si `seconds`). `timeZone` opcional: por defecto la del dispositivo. */
export function formatClock(t, { lang = "es", timeZone, seconds = false } = {}) {
  return fmt(lang, timeZone, { hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), hourCycle: "h23" }).format(toDate(t));
}
/** «sáb 14 nov» / «Sat, Nov 14». */
export function formatDay(t, { lang = "es", timeZone } = {}) {
  const s = fmt(lang, timeZone, { weekday: "short", day: "numeric", month: "short" }).format(toDate(t));
  return lang === "es" ? s.replace(",", "").replace(/\.$/, "") : s;
}
/** «sáb 14 nov, 19:35». */
export function formatDayTime(t, opts = {}) {
  return `${formatDay(t, opts)}, ${formatClock(t, opts)}`;
}

// ── puntos cardinales, ángulos, duración, magnitud ───────────────────────────
const DIR8 = { es: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"], en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] };
/** Punto cardinal de 8 vientos para un azimut (° desde el norte hacia el este). */
export function compassLabel(az, lang = "es") {
  const i = Math.floor((((az % 360) + 360) % 360 + 22.5) / 45) % 8;
  return (DIR8[lang] || DIR8.es)[i];
}
export const fmtDeg = (v, lang = "es") => `${Math.round(v).toLocaleString(loc(lang))}°`;

/** «5 min 40 s», «4 min», «45 s». */
export function fmtDuration(s, lang = "es") {
  const sec = Math.max(0, Math.round(s));
  const m = Math.floor(sec / 60), r = sec % 60;
  if (m === 0) return `${r} s`;
  if (m >= 10) return `${m + (r >= 30 ? 1 : 0)} min`;
  return r === 0 ? `${m} min` : `${m} min ${r} s`;
}

/** Magnitud aproximada: se redondea a medio punto (el error real es de ±0,5 o más) y lleva «≈». Nunca `null`→texto. */
export function fmtMag(mag, lang = "es") {
  if (mag == null || !Number.isFinite(mag)) return null;
  const r = Math.round(mag * 2) / 2;
  const s = Math.abs(r).toLocaleString(loc(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `≈ ${r < 0 ? MINUS : r > 0 ? "+" : ""}${s}`;
}

// ── qué parte de la pasada se ve ─────────────────────────────────────────────
/** Extremos que se enseñan: si la pasada es visible, los del tramo visible (por donde de verdad
 *  aparece y desaparece ante tus ojos); si no, los de la pasada entera. */
export function shownEnds(p) {
  if (p.visible && p.visible_from && p.visible_to) return { from: p.visible_from, to: p.visible_to, fromMs: p.visFromMs ?? ms(p.visible_from.t), toMs: p.visToMs ?? ms(p.visible_to.t) };
  return { from: p.start, to: p.end, fromMs: p.startMs ?? ms(p.start.t), toMs: p.endMs ?? ms(p.end.t) };
}

/** Altura máxima DENTRO del tramo que se enseña (si la ISS entra en la sombra antes de culminar,
 *  la altura que ves no es la `max_alt` de la pasada entera). */
export function shownMaxAlt(p) {
  const { from, to, fromMs, toMs } = shownEnds(p);
  let best = Math.max(from.alt, to.alt);
  for (const pt of p.track || []) {
    const t = ms(pt.t);
    if (t >= fromMs && t <= toMs && pt.alt > best) best = pt.alt;
  }
  if (p.maxMs >= fromMs && p.maxMs <= toMs) best = Math.max(best, p.max_alt);
  return best;
}

/** Cuánto dura el tramo visible, o la pasada entera si no es visible. */
export function shownDuration(p) { const e = shownEnds(p); return (e.toMs - e.fromMs) / 1000; }

// ── próxima pasada visible y cuenta atrás ────────────────────────────────────
/** Pasadas visibles que aún no terminaron su tramo visible, en orden. */
export function visiblePasses(passes, nowMs = Date.now()) {
  return (passes || []).filter((p) => p.visible && (p.visToMs ?? p.endMs) > nowMs);
}
/** La próxima (o la que está ocurriendo ahora) pasada visible. */
export function nextVisiblePass(passes, nowMs = Date.now()) {
  return visiblePasses(passes, nowMs)[0] || null;
}
/** ¿Está ocurriendo ahora mismo el tramo visible? */
export function isHappeningNow(p, nowMs = Date.now()) {
  const { fromMs, toMs } = shownEnds(p);
  return nowMs >= fromMs && nowMs <= toMs;
}

/** Descompone una espera en milisegundos: { d, h, m, totalMin }. Redondea hacia abajo los minutos. */
export function splitWait(msLeft) {
  const totalMin = Math.max(0, Math.floor(msLeft / 60000));
  return { d: Math.floor(totalMin / 1440), h: Math.floor((totalMin % 1440) / 60), m: totalMin % 60, totalMin };
}
/** «faltan 3 h 12 min», «faltan 35 min», «faltan 3 d 4 h» (≥ 48 h), «en menos de 1 min», «ahora mismo». */
export function formatCountdown(startMs, nowMs = Date.now(), lang = "es", endMs = null) {
  if (endMs != null && nowMs >= startMs && nowMs <= endMs) return lang === "es" ? "ahora mismo" : "happening now";
  const w = splitWait(startMs - nowMs);
  const es = lang === "es";
  if (startMs - nowMs <= 0) return es ? "ahora mismo" : "happening now";
  if (w.totalMin < 1) return es ? "en menos de 1 min" : "in under a minute";
  let body;
  if (w.totalMin >= 2880) body = `${w.d} d${w.h ? ` ${w.h} h` : ""}`;
  else if (w.totalMin >= 60) body = `${Math.floor(w.totalMin / 60)} h${w.m ? ` ${w.m} min` : ""}`;
  else body = `${w.totalMin} min`;
  return es ? `faltan ${body}` : `in ${body}`;
}

/** Partes para escribir «aparece por el SO, sube a 64°, se pierde por el NE». */
export function describePass(p, lang = "es") {
  const e = shownEnds(p);
  return {
    appears: compassLabel(e.from.az, lang),
    peak: Math.round(shownMaxAlt(p)),
    disappears: compassLabel(e.to.az, lang),
    startMs: e.fromMs,
    endMs: e.toMs,
    durationS: (e.toMs - e.fromMs) / 1000,
    // el tramo visible es bastante más corto que la pasada: la ISS entra o sale de la sombra de la Tierra
    partial: p.visible && Math.abs((p.endMs - p.startMs) - (e.toMs - e.fromMs)) > 20000,
  };
}

/** Resumen del conjunto: nº de pasadas, de visibles y por qué las demás no se ven. */
export function summarize(passes, nowMs = Date.now()) {
  const live = (passes || []).filter((p) => p.endMs > nowMs);
  const vis = live.filter((p) => p.visible);
  const hidden = live.filter((p) => !p.visible);
  return {
    total: live.length,
    visible: vis.length,
    hidden: hidden.length,
    sunUp: hidden.filter((p) => p.why_not_visible === "sun_up").length,
    shadow: hidden.filter((p) => p.why_not_visible === "iss_in_shadow").length,
  };
}

/** ¿Elementos orbitales viejos (más de 3 días) o datos sin actualizar? */
export function accuracyWarnings(data) {
  const w = (data && data.warnings) || [];
  return { outdated: w.includes("elements_old") || !!(data && data.elements && data.elements.outdated), stale: w.includes("stale") || !!(data && data.stale) };
}

// ── la órbita, para la ficha de la ISS ───────────────────────────────────────
const MU_EARTH = 398600.4418;     // km³/s², GM de la Tierra (WGS-84)
const R_EARTH_KM = 6378.137;      // km, radio ecuatorial (WGS-84)
/**
 * Altura media, velocidad, período e inclinación de la órbita a partir de `elements` de la respuesta
 * (perigee_km, apogee_km, period_min, inclination_deg, calculados del TLE en el servidor).
 * Velocidad de una órbita casi circular: v = √(GM/a), con a sacado del período (3.ª ley de Kepler).
 * Sin elementos se usan valores típicos (~420 km, 92,9 min, 51,6°) y `fromElements` es false.
 */
export function orbitFacts(el) {
  const per = el && Number(el.perigee_km), apo = el && Number(el.apogee_km);
  const P = el && Number(el.period_min), inc = el && Number(el.inclination_deg);
  const hasAlt = Number.isFinite(per) && Number.isFinite(apo) && per > 100 && apo >= per;
  const hasP = Number.isFinite(P) && P > 80 && P < 130;
  const altKm = hasAlt ? (per + apo) / 2 : 420;
  const a = hasP ? Math.cbrt(MU_EARTH * ((P * 60) / (2 * Math.PI)) ** 2) : R_EARTH_KM + altKm;
  return {
    altKm, perigeeKm: hasAlt ? per : null, apogeeKm: hasAlt ? apo : null,
    speedKms: Math.sqrt(MU_EARTH / a),
    periodMin: hasP ? P : (2 * Math.PI * Math.sqrt(a ** 3 / MU_EARTH)) / 60,
    inclDeg: Number.isFinite(inc) && inc > 0 ? inc : 51.6,
    fromElements: hasAlt && hasP,
  };
}
