// meteors.js — lluvias de meteoros del catálogo de Teseo (public/meteorshowers.json: fecha del
// máximo, ventana de actividad, ZHR, radiante J2000; datos de la IMO, ver scripts/build_meteors.py).
// Aquí se añade, para el lugar de la persona, lo que SÍ se puede calcular: si el radiante sube sobre
// el horizonte esa noche, a qué hora está más alto y si la Luna estorba (fase y altura).
// La fecha es la del catálogo (MM-DD): el máximo real puede variar ±1 día entre años.
import { stateAt, altAzOf, MIN, HOUR, DAY } from "./astro.js";
import { nightWindow } from "../../sky/riseset.js";

const sunDirAt = (d) => stateAt(+d).Sol.v;

// Magnitud límite a simple vista (MALE) de las dos cifras que se muestran. 6,5 es la del ZHR de la IMO
// (cielo oscuro). 4,5 es el techo de la clase 8 de Bortle (4,1–4,5, «cielo de ciudad»; ver
// src/sky/lightPollution.js). No son una medición del cielo de la persona.
export const MALE_DARK = 6.5, MALE_CITY = 4.5;
/** Duración del evento a la mejor hora (min), como la de un eclipse solar en el calendario; nunca sale de la noche. */
export const WINDOW_MIN = 120;

/** Altura mínima del radiante para estimar: la fórmula de la IMO «se puede aplicar con radiantes a hR ≥ 10°». */
export const MIN_RATE_ALT = 10;
/**
 * Tasa visible estimada (meteoros por hora) con la relación estándar de la IMO:
 *   ZHR = N · r^(6,5 − MALE) · F / (T · sen h)   →   N/T ≈ ZHR · sen(h) / r^(6,5 − MALE)   (sin obstáculos ni nubes: F = 1)
 * Fuente: IMO, Handbook for Meteor Observers (2022), cap. 7, ec. 7.2 y §7.3.3 (vale para h ≥ 10°):
 * https://www.imo.net/files/books/Handbook_for_meteors_observers.pdf. r: IMO, Calendario 2027, tabla 5.
 * null si falta el ZHR o r, o si el radiante está a menos de MIN_RATE_ALT° (incluido bajo el horizonte).
 */
export function visibleRate(zhr, r, altDeg, male) {
  if (!(Number.isFinite(zhr) && zhr > 0) || !(Number.isFinite(r) && r > 0) || !(Number.isFinite(altDeg) && altDeg >= MIN_RATE_ALT) || !Number.isFinite(male)) return null;
  return zhr * Math.sin(altDeg * Math.PI / 180) / Math.pow(r, 6.5 - male);
}

/** Evento para un máximo concreto (año y MM-DD) en un lugar. */
export function showerEvent(o, year, lat, lon) {
  const [m, d] = o.peak.split("-").map(Number);
  // mediodía solar local de la fecha del máximo → la noche que empieza esa tarde
  const noon = Date.UTC(year, m - 1, d, 12) - (lon / 15) * HOUR;
  const night = nightWindow(sunDirAt, lat, lon, new Date(noon), -12);
  const radiant = [o.nx, o.ny, o.nz];
  let best = null;
  if (night) {
    for (let t = night.start.getTime(); t <= night.end.getTime(); t += 15 * MIN) {
      const a = altAzOf(radiant, lat, lon, t).alt;
      if (!best || a > best.alt) best = { t, alt: a };
    }
  }
  const risesInNight = !!best && best.alt > 0;
  // la Luna a la hora en que el radiante está más alto
  let moon = null;
  if (best) {
    const mo = stateAt(best.t).Luna, el = Math.acos(Math.max(-1, Math.min(1, mo.v[0] * stateAt(best.t).Sol.v[0] + mo.v[1] * stateAt(best.t).Sol.v[1] + mo.v[2] * stateAt(best.t).Sol.v[2])));
    const illum = (1 - Math.cos(el)) / 2;
    const alt = altAzOf(mo.v, lat, lon, best.t).alt;
    moon = { illum, alt, up: alt > 0, level: alt > 0 && illum >= 0.6 ? "strong" : alt > 0 && illum >= 0.3 ? "some" : "none" };
  }
  // Ventana del evento: SIEMPRE dentro de la noche y con la mejor hora dentro. Si mejor + 2 h cabe, [mejor, mejor + 2 h]; si no
  // (el radiante sigue subiendo al amanecer), termina con la noche y empieza 2 h antes (o al inicio de la noche si es más corta).
  // La mejor hora puede caer en la madrugada del día siguiente al del catálogo. Sin mejor hora (el radiante no sube): null → todo el día.
  let window = null;
  if (risesInNight) {
    const end = night.end.getTime(), fits = best.t + WINDOW_MIN * MIN <= end;
    const startMs = fits ? best.t : Math.max(night.start.getTime(), end - WINDOW_MIN * MIN);
    window = { start: startMs, durationMin: fits ? WINDOW_MIN : Math.floor((end - startMs) / MIN) };
  }
  // meteoros por hora desde este lugar a la mejor hora: bajo un cielo oscuro y desde una ciudad (null si no hay r)
  const rates = risesInNight && Number.isFinite(o.r)
    ? { dark: visibleRate(o.zhr, o.r, best.alt, MALE_DARK), city: visibleRate(o.zhr, o.r, best.alt, MALE_CITY) } : null;
  return { id: `meteor-${o.name_en || o.name}-${year}`, shower: o, year, date: Date.UTC(year, m - 1, d, 12), night, best, risesInNight, maxAlt: best ? best.alt : null, moon, window, rates: rates && rates.dark != null ? rates : null };
}

/** Cuándo empieza y termina el evento (ms): la ventana de la mejor hora o, sin ella, el día del catálogo. */
export const showerSpan = (p) => (p.window ? { start: p.window.start, end: p.window.start + p.window.durationMin * MIN } : { start: p.date, end: p.date + DAY / 2 });

/** Máximos entre from y to (ms): una entrada por lluvia y año. */
export function findShowerPeaks(showers, from, to, lat, lon) {
  const out = [];
  const y0 = new Date(from).getUTCFullYear();
  for (const o of showers || []) {
    if (!o || !o.peak || !Number.isFinite(o.nx)) continue;
    const [m, d] = o.peak.split("-").map(Number);
    for (let y = y0 - 1; y <= y0 + 2; y++) {
      const t = Date.UTC(y, m - 1, d, 12);
      // la mejor hora puede caer hasta ~un día después de la fecha del catálogo: se calcula y se filtra por la hora real
      if (t + 2 * DAY <= from || t - DAY > to) continue;
      const p = showerEvent(o, y, lat, lon), sp = showerSpan(p);
      if (sp.end > from && sp.start <= to) out.push(p);
    }
  }
  return out.sort((a, b) => showerSpan(a).start - showerSpan(b).start);
}
