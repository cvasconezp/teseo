// views.js — lógica PURA (sin React) de las dos vistas del Calendario del cielo: «El hilo» y «El mes».
// Usa los mismos eventos que la lista (events.js); aquí solo se agrupan por día, se arma la cuadrícula
// mensual (semana de lunes a domingo) y se calcula la iluminación diaria de la Luna con moonState()
// (src/special/math.js, la misma de las fases). Se prueba en scripts/test_cal_views.mjs.
//
// Zona horaria: el día de un evento es su día LOCAL en la zona del dispositivo (la que ya usa la app en
// groupByMonth y en las horas de las tarjetas). Los eventos «de todo el día» llevan su fecha del catálogo en
// UTC: su día es esa fecha, no la local.
import { moonState, phaseKey } from "../../special/math.js";
import { startOfEvent } from "./countdown.js";

export const VIEW_KEY = "teseo_cal_view";
export const VIEWS = ["thread", "month"];

const p2 = (n) => String(n).padStart(2, "0");
/** "2026-11-05" a partir de año, mes (1–12) y día. */
export const keyOf = (y, m, d) => `${y}-${p2(m)}-${p2(d)}`;
/** [y, m (1–12), d] de una clave "YYYY-MM-DD". */
export const partsOf = (key) => key.split("-").map(Number);
/** Clave del día local de un instante (ms). */
export const dayKeyOfMs = (ms) => { const d = new Date(ms); return keyOf(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
/** Día (clave) de un evento: su día local, o su fecha UTC si es «de todo el día». */
export function dayKeyOf(ev) {
  const d = new Date(ev.t);
  return ev.allDay ? keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) : keyOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
/** Mes ("YYYY-MM") de una clave de día. */
export const monthOfKey = (key) => key.slice(0, 7);
/** Suma `n` días a una clave (aritmética de calendario, sin husos: pasa por UTC al mediodía). */
export function addDays(key, n) {
  const [y, m, d] = partsOf(key);
  const t = new Date(Date.UTC(y, m - 1, d + n, 12));
  return keyOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
/** Día de la semana con lunes = 0 … domingo = 6. */
export function weekdayMon(key) {
  const [y, m, d] = partsOf(key);
  return (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() + 6) % 7;
}
export const addMonths = (monthKey, n) => {
  const [y, m] = monthKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}`;
};
export const daysInMonth = (monthKey) => { const [y, m] = monthKey.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

/**
 * Cuadrícula de un mes: lista de semanas (de lunes a domingo); cada celda es { key, day } o null (hueco de otro mes).
 * Siempre 7 celdas por semana; 4 a 6 semanas.
 */
export function monthGrid(monthKey) {
  const first = `${monthKey}-01`;
  const lead = weekdayMon(first), n = daysInMonth(monthKey);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= n; d++) cells.push({ key: `${monthKey}-${p2(d)}`, day: d });
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Las 7 claves (lunes a domingo) de la semana que contiene `key`. */
export function weekOf(key) {
  const mon = addDays(key, -weekdayMon(key));
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** Map clave-de-día → eventos de ese día (en el orden recibido). */
export function groupByDay(events) {
  const map = new Map();
  for (const e of events) {
    const k = dayKeyOf(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return map;
}

/** Eventos de una semana (la de `key`), en el orden recibido. */
export function eventsOfWeek(byDay, key) {
  const out = [];
  for (const k of weekOf(key)) { const l = byDay.get(k); if (l) out.push(...l); }
  return out;
}

/** Día seleccionado por defecto en un mes: hoy si está en él; si no, el primer día con eventos; si no, el día 1. */
export function defaultSelected({ todayKey, monthKey, byDay }) {
  if (monthOfKey(todayKey) === monthKey) return todayKey;
  const n = daysInMonth(monthKey);
  for (let d = 1; d <= n; d++) { const k = `${monthKey}-${p2(d)}`; if (byDay.has(k)) return k; }
  return `${monthKey}-01`;
}

/** Primer día con eventos posterior a `afterKey` (o null). */
export function nextDayWithEvents(byDay, afterKey) {
  let best = null;
  for (const k of byDay.keys()) if (k > afterKey && (best === null || k < best)) best = k;
  return best;
}

/** Meses (primero y último, "YYYY-MM") que cubre el rango de la agenda: desde `fromMs` durante `days` días. */
export function monthRange(fromMs, days) {
  return { first: monthOfKey(dayKeyOfMs(fromMs)), last: monthOfKey(dayKeyOfMs(fromMs + days * 86400000 - 1)) };
}
export const clampMonth = (monthKey, range) => (monthKey < range.first ? range.first : monthKey > range.last ? range.last : monthKey);

/**
 * Marcas de un día: tipos distintos de sus eventos (en el orden de `typeOrder`), hasta `max`.
 * `more` = cuántos tipos quedaron fuera.
 */
export function dayMarks(list, typeOrder, max = 3) {
  const present = new Set((list || []).map(e => e.type));
  const types = typeOrder.filter(t => present.has(t));
  return { types: types.slice(0, max), more: Math.max(0, types.length - max) };
}

/**
 * Luna de un día: fracción iluminada (0–1) y si crece, al mediodía local de ese día (moonState de src/special/math.js).
 * `phase` es el nombre de la fase en 8 tramos (PHASE_KEYS de math.js). Para días de fase principal es aproximada (mediodía, no el instante exacto): se usa solo como dibujo.
 */
export function moonOfDay(key) {
  const [y, m, d] = partsOf(key);
  const s = moonState(new Date(y, m - 1, d, 12));
  return { illum: s.illum, waxing: s.waxing, phase: phaseKey(s.elong) };
}

/** Fases principales de la Luna → { illum, waxing } con que se dibujan los nudos del hilo. */
export const PHASE_SHAPE = { new: { illum: 0, waxing: true }, firstQuarter: { illum: 0.5, waxing: true }, full: { illum: 1, waxing: true }, lastQuarter: { illum: 0.5, waxing: false } };

/**
 * Trazado SVG (viewBox 0 0 24 24, disco de radio r) de la parte iluminada de la Luna, o "" si no hay luz.
 * Creciente: ilumina la derecha; menguante: la izquierda (hemisferio norte; en Teseo es solo un dibujo).
 */
export function moonLitPath(illum, waxing, cx = 12, cy = 12, r = 9) {
  const f = Math.max(0, Math.min(1, illum));
  if (f < 0.015) return "";
  if (f > 0.985) return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
  const rx = +(r * Math.abs(1 - 2 * f)).toFixed(2);
  const gibbous = f > 0.5;
  const top = `${cx} ${cy - r}`, bot = `${cx} ${cy + r}`;
  const side = waxing ? 1 : 0;                     // 1 = derecha
  // semicírculo exterior (lado iluminado) y regreso por el terminador
  const outer = `A${r} ${r} 0 0 ${side} ${bot}`;
  const back = `A${rx} ${r} 0 0 ${(gibbous ? side : 1 - side)} ${top}`;
  return `M${top}${outer}${back}z`;
}

/** Índice del primer evento que aún no empieza (donde va el marcador «Hoy» del hilo); events.length si todos ya pasaron. */
export function todayMarkerIndex(events, now) {
  const i = events.findIndex(e => startOfEvent(e) > now);
  return i < 0 ? events.length : i;
}

// ─── Ventana de un día y «El hilo de <mes>» ───────────────────────────────────
/** Eventos de un día, en orden de hora (los «de todo el día» van con su medianoche local). */
export function eventsOfDay(byDay, key) {
  return (byDay.get(key) || []).slice().sort((a, b) => startOfEvent(a) - startOfEvent(b) || a.id.localeCompare(b.id));
}
/** Eventos de un mes ("YYYY-MM"), por día y, dentro del día, por hora. */
export function monthEvents(events, monthKey) {
  return events.filter(e => monthOfKey(dayKeyOf(e)) === monthKey)
    .sort((a, b) => dayKeyOf(a).localeCompare(dayKeyOf(b)) || startOfEvent(a) - startOfEvent(b) || a.id.localeCompare(b.id));
}
/** ¿Ya pasó ese día (en el día local de hoy)? La agenda empieza hoy: de los días pasados no hay eventos calculados. */
export const isPastDay = (key, todayKey) => key < todayKey;
/** ¿Cae el día dentro de los meses que cubre la agenda? */
export const dayInRange = (key, range) => { const m = monthOfKey(key); return m >= range.first && m <= range.last; };
/** El día `n` días antes/después, o null si sale del rango de la agenda. */
export function shiftDay(key, n, range) { const k = addDays(key, n); return dayInRange(k, range) ? k : null; }
