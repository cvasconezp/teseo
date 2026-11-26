// countdown.js — «cuánto falta» para cada evento del Calendario del cielo, y las piezas de la cuenta
// regresiva grande de «Lo próximo». Funciones puras (sin React): se prueban en scripts/test_countdown.mjs.
import { localMidnightOf } from "./events.js";

const MIN = 60000, HOUR = 3600000, DAY = 86400000;

/** Día local (medianoche) de un instante. (Calendar.jsx lo usa para que la agenda empiece «hoy» aunque
 *  la pestaña siga abierta pasada la medianoche.) */
export const dayStart = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
/** Días de calendario (locales) entre hoy y una fecha. */
const dayDiff = (fromMs, toMs) => Math.round((dayStart(toMs) - dayStart(fromMs)) / DAY);

/** Momento en que empieza el evento: la hora exacta, o la medianoche local de su día si es «de todo el día». */
export const startOfEvent = (ev) => (ev.allDay ? localMidnightOf(ev.t) : ev.t);

/**
 * Texto corto de cuánto falta.
 * @returns {{ state: "past"|"now"|"today"|"soon"|"later", text: string }}
 *   past  = ya ocurrió (hoy, ayer o antes) · now = en este minuto · today = evento de todo el día que es hoy
 *   soon  = faltan menos de 24 h (la tarjeta lo resalta) · later = más adelante
 */
export function countdownText(ev, now, lang = "es") {
  const es = lang !== "en";
  if (ev.allDay) {
    const n = dayDiff(now, localMidnightOf(ev.t));
    if (n === -1) return { state: "past", text: es ? "Ayer" : "Yesterday" };
    if (n < -1) return { state: "past", text: es ? "Ya ocurrió" : "Already happened" };
    if (n === 0) return { state: "today", text: es ? "Hoy" : "Today" };
    if (n === 1) return { state: "soon", text: es ? "Mañana" : "Tomorrow" };
    return { state: "later", text: es ? `En ${n} días` : `In ${n} days` };
  }
  const dt = ev.t - now;
  // una lluvia de meteoros es una ventana de la noche: mientras dura, «Ahora» (no «ya ocurrió»)
  if (ev.type === "meteor" && dt < 0 && now < ev.t + (ev.durationMin || 0) * MIN) return { state: "now", text: es ? "Ahora" : "Now" };
  if (dt < -MIN) {
    const n = dayDiff(now, ev.t);   // pasada la medianoche, lo de ayer no es «hoy»
    if (n === 0) return { state: "past", text: es ? "Hoy · ya ocurrió" : "Today · already happened" };
    if (n === -1) return { state: "past", text: es ? "Ayer · ya ocurrió" : "Yesterday · already happened" };
    return { state: "past", text: es ? "Ya ocurrió" : "Already happened" };
  }
  if (dt < MIN) return { state: "now", text: es ? "Ahora" : "Now" };
  const d = Math.floor(dt / DAY), h = Math.floor((dt % DAY) / HOUR), m = Math.floor((dt % HOUR) / MIN);
  if (dt < HOUR) return { state: "soon", text: es ? `En ${m} min` : `In ${m} min` };
  if (dt < DAY) return { state: "soon", text: es ? `En ${h} h ${m} min` : `In ${h} h ${m} min` };
  if (d < 3) {
    const days = es ? (d === 1 ? "1 día" : `${d} días`) : (d === 1 ? "1 day" : `${d} days`);
    return { state: "later", text: h ? (es ? `En ${days} y ${h} h` : `In ${days} ${h} h`) : (es ? `En ${days}` : `In ${days}`) };
  }
  const n = dayDiff(now, ev.t);
  return { state: "later", text: es ? `En ${n} días` : `In ${n} days` };
}

/** Partes de la cuenta regresiva grande (días, horas, minutos, segundos) hasta `target`; null si ya pasó. */
export function countdownParts(target, now) {
  let s = Math.floor((target - now) / 1000);
  if (s < 0) return null;
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return { d, h, m, s };
}
