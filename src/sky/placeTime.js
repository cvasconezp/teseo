// placeTime.js — la hora «de pared» del lugar que se mira (Mi cielo), no la del teléfono: si estás en Ecuador y
// miras el cielo de Nagarkot, el reloj, la barra del día y las horas de salida y puesta van en hora de Nepal.
// La zona horaria IANA del lugar la da Open-Meteo (timezone=auto, sin clave) y se guarda en localStorage por
// celdas de 0,1°. Sin zona (sin conexión o sin lugar) todo sigue en la zona del dispositivo, como antes.
// Lógica pura salvo fetchTimeZone; se prueba en scripts/test_placetime.mjs.

const fmtCache = new Map();
function partsFmt(tz) {
  const k = tz || "";
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { ...(tz ? { timeZone: tz } : {}), hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    fmtCache.set(k, f);
  }
  return f;
}

/** ¿Es una zona IANA que entiende este navegador? */
export function validTz(tz) {
  if (!tz || typeof tz !== "string") return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** Zona horaria del dispositivo («America/Guayaquil»), o "" si el navegador no la dice. */
export function deviceTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
}

/** Año, mes (1-12), día, hora, minuto y segundo de `date` en la zona `tz` (sin zona: la del dispositivo). */
export function tzParts(date, tz) {
  const o = {};
  for (const p of partsFmt(validTz(tz) ? tz : null).formatToParts(date)) if (p.type !== "literal") o[p.type] = Number(p.value);
  if (o.hour === 24) o.hour = 0;
  return { y: o.year, m: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second };
}

/** Desfase de la zona respecto de UTC en `date`, en minutos (Nepal: +345; Ecuador: −300). */
export function tzOffsetMin(date, tz) {
  const p = tzParts(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - (date.getTime() - date.getMilliseconds())) / 60000);
}

/**
 * El instante cuya hora de pared en `tz` es y-m-d h:mi (mes 1-12; se aceptan valores fuera de rango, como en
 * Date.UTC). Dos pasadas para los cambios de horario de verano.
 */
export function fromParts(y, m, d, h, mi, tz) {
  const naive = Date.UTC(y, m - 1, d, h, mi);
  let t = naive - tzOffsetMin(new Date(naive), tz) * 60000;
  t = naive - tzOffsetMin(new Date(t), tz) * 60000;
  return new Date(t);
}

/**
 * La fecha con un campo movido `dir` (±1) en la hora de pared de `tz`: year, month, day, hour, minute. Mes y
 * año conservan el día si existe (31 de enero + 1 mes → 28/29 de febrero), como un reloj de pulsera.
 */
export function stepFieldTz(date, field, dir, tz) {
  if (field === "minute" || field === "hour") return new Date(date.getTime() + dir * (field === "hour" ? 3600000 : 60000));
  let { y, m, d, h, mi } = tzParts(date, tz);
  if (field === "day") d += dir;
  else if (field === "month" || field === "year") {
    if (field === "month") m += dir; else y += dir;
    const ny = y + Math.floor((m - 1) / 12), nm = ((m - 1) % 12 + 12) % 12 + 1;
    y = ny; m = nm;
    d = Math.min(d, new Date(Date.UTC(y, m, 0)).getUTCDate());
  }
  return fromParts(y, m, d, h, mi, tz);
}

/** El mismo día (en `tz`) a la hora `min` (minutos desde las 00:00). */
export function setMinuteTz(date, min, tz) {
  const { y, m, d } = tzParts(date, tz);
  return fromParts(y, m, d, Math.floor(min / 60), min % 60, tz);
}

/** Minutos desde la medianoche de `tz`. */
export function minuteOfDay(date, tz) {
  const p = tzParts(date, tz);
  return p.h * 60 + p.mi;
}

/** Medianoche (00:00 en `tz`) del día de `date`. */
export function startOfDay(date, tz) {
  const { y, m, d } = tzParts(date, tz);
  return fromParts(y, m, d, 0, 0, tz);
}

/** «UTC+5:45», «UTC−5», «UTC». */
export function utcLabel(offMin) {
  if (!offMin) return "UTC";
  const a = Math.abs(offMin), h = Math.floor(a / 60), mm = a % 60;
  return `UTC${offMin < 0 ? "−" : "+"}${h}${mm ? `:${String(mm).padStart(2, "0")}` : ""}`;
}

/**
 * Rótulo bajo el reloj: «Hora de Nagarkot · UTC+5:45». Sin nombre de lugar (tu ubicación), «Hora local · …»; sin zona del
 * lugar, «Hora de tu teléfono · …».
 */
export function tzCaption(date, tz, place, lang = "es") {
  const es = lang !== "en";
  const off = utcLabel(tzOffsetMin(date, validTz(tz) ? tz : null));
  if (!validTz(tz)) return es ? `Hora de tu teléfono · ${off}` : `Your phone's time · ${off}`;
  if (place) return es ? `Hora de ${place} · ${off}` : `Time in ${place} · ${off}`;
  return es ? `Hora local · ${off}` : `Local time · ${off}`;
}

// ── zona horaria de un lugar (Open-Meteo) ─────────────────────────────────────
const KEY = "teseo_tz_v1";
const cellOf = (lat, lon) => `${(Math.round(lat * 10) / 10).toFixed(1)},${(Math.round(lon * 10) / 10).toFixed(1)}`;
function readCache() {
  try { const o = JSON.parse(localStorage.getItem(KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; }
}
function writeCache(o) {
  try {
    const keys = Object.keys(o);
    if (keys.length > 40) for (const k of keys.slice(0, keys.length - 40)) delete o[k];
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch { /* sin almacenamiento */ }
}

/** Zona ya conocida para un lugar (de la caché), o null. */
export function cachedTimeZone(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const tz = readCache()[cellOf(lat, lon)];
  return validTz(tz) ? tz : null;
}

/** Zona horaria IANA de un lugar («Asia/Kathmandu»), o null si no se pudo saber. */
export async function fetchTimeZone(lat, lon, { signal, fetchFn } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const hit = cachedTimeZone(lat, lon);
  if (hit) return hit;
  const f = fetchFn || (typeof fetch !== "undefined" ? fetch : null);
  if (!f) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&timezone=auto&forecast_days=1&daily=sunrise`;
  const res = await f(url, { signal });
  if (!res.ok) return null;
  const tz = (await res.json())?.timezone;
  if (!validTz(tz) || tz === "GMT") return null;
  const o = readCache(); o[cellOf(lat, lon)] = tz; writeCache(o);
  return tz;
}
