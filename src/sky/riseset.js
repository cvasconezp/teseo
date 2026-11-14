// riseset.js — salida, culminación y puesta de un astro para un lugar y una fecha, y
// el mejor momento de la noche para verlo. Matemática pura (sin DOM ni three): se
// prueba con Node en scripts/test_sky_riseset.mjs.
//
// Generaliza la búsqueda de salidas de "Esta noche" (guide.js → nextCrossing): se
// muestrea la altitud real del astro (la Luna y los planetas se mueven; una estrella
// no) y cada cruce del horizonte se afina por bisección.
import { altAz, nextCrossing, horizonAt } from "./guide.js";

// Altitud geométrica del centro del astro en el momento en que se le ve salir o
// ponerse (convención habitual de los almanaques; Meeus, Astronomical Algorithms, cap. 15):
export const H0_STAR = -0.5667;   // estrellas y planetas: refracción media en el horizonte (34′)
export const H0_SUN = -0.8333;    // Sol: refracción + semidiámetro (borde superior)
export const H0_MOON = 0.125;     // Luna: refracción + semidiámetro − paralaje horizontal media
export const horizonFor = (kind) => (kind === "sun" ? H0_SUN : kind === "moon" ? H0_MOON : H0_STAR);
// Luna con su paralaje del momento (Meeus cap. 15, ec. 15.1 y nota): h0 = 0,7275·π − 0°34′, con
// π = asen(6378,14 km / distancia). Se aplica a la altura GEOCÉNTRICA (la de ephemeris()): el término
// 0,7275·π = π − semidiámetro (0,2725·π) baja el centro geocéntrico hasta el borde superior visto desde
// la superficie. Con π entre 54′ y 61′ va de +0,09° a +0,18° (H0_MOON = 0,125° es su valor medio:
// hasta ~11 s de diferencia en la hora de salida en el ecuador).
export const moonH0 = (distKm) => 0.7275 * Math.asin(6378.14 / distKm) * 180 / Math.PI - 0.5667;

const MIN = 60000, HOUR = 3600000;

function refine(altAt, tA, tB, minAlt) {
  // bisección: altAt(tA) y altAt(tB) quedan a lados distintos de minAlt
  let a = tA, b = tB, fa = altAt(a) - minAlt;
  for (let i = 0; i < 12; i++) {
    const m = (a + b) / 2, fm = altAt(m) - minAlt;
    if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}
function maxBetween(altAt, t0, t1, stepMs = 5 * MIN) {
  let best = t0, bestA = altAt(t0);
  for (let t = t0 + stepMs; t <= t1; t += stepMs) { const a = altAt(t); if (a > bestA) { bestA = a; best = t; } }
  const e = altAt(t1); if (e > bestA) { bestA = e; best = t1; }
  // afinado por sección áurea alrededor del mejor muestreo
  let lo = Math.max(t0, best - stepMs), hi = Math.min(t1, best + stepMs);
  const g = 0.381966;
  for (let i = 0; i < 14 && hi - lo > 5000; i++) {
    const m1 = lo + g * (hi - lo), m2 = hi - g * (hi - lo);
    if (altAt(m1) < altAt(m2)) lo = m1; else hi = m2;
  }
  const t = (lo + hi) / 2;
  return { date: new Date(t), alt: altAt(t) };
}

/**
 * Salida, culminación y puesta del "pase" actual o del siguiente.
 * Si el astro está arriba ahora: la salida es la que ya ocurrió y la puesta, la que
 * viene. Si está abajo: la próxima salida y la puesta que le sigue.
 *
 * @param {(d: Date) => number[]} dirAt  dirección ecuatorial [nx, ny, nz] en un instante
 * @param {number} lat, lon             grados
 * @param {Date} date                   instante de referencia
 * @param {object} [o]  { minAlt = H0_STAR, stepMin = 10 }  (minAlt: grados o función (ms) → grados, ver moonH0)
 * @returns {{ state: "normal"|"always"|"never", upNow: boolean,
 *             rise: {date, az}|null, transit: {date, alt}|null, set: {date, az}|null }}
 *   "always" = no se pone en 24 h; "never" = no sale en 24 h.
 */
export function riseTransitSet(dirAt, lat, lon, date, { minAlt = H0_STAR, stepMin = 10 } = {}) {
  const altAt = (ms) => { const d = new Date(ms); const v = dirAt(d); return altAz(v[0], v[1], v[2], lat, lon, d).alt; };
  const azAt = (ms) => { const d = new Date(ms); const v = dirAt(d); return altAz(v[0], v[1], v[2], lat, lon, d).az; };
  const h0 = horizonAt(minAlt), relAt = (ms) => altAt(ms) - h0(ms);   // altura sobre el horizonte convencional
  const t0 = date.getTime(), step = stepMin * MIN;
  const cross = (from, dir, back) => {
    const c = nextCrossing(dirAt, lat, lon, new Date(from), { dir, maxHours: 24.5, stepMin: back ? -stepMin : stepMin, minAlt });
    if (!c) return null;
    const tc = c.date.getTime();
    const t = refine(relAt, tc - step, tc + step, 0);
    return { date: new Date(t), az: azAt(t) };
  };
  const upNow = relAt(t0) > 0;
  let rise = null, set = null;
  if (upNow) {
    rise = cross(t0, 1, true);
    set = cross(t0, -1, false);
    if (!rise && !set) return { state: "always", upNow, rise: null, set: null, transit: maxBetween(altAt, t0, t0 + 24 * HOUR) };
  } else {
    rise = cross(t0, 1, false);
    if (!rise) return { state: "never", upNow, rise: null, set: null, transit: null };
    set = cross(rise.date.getTime() + MIN, -1, false);
  }
  const a = rise ? rise.date.getTime() : t0 - 12 * HOUR, b = set ? set.date.getTime() : (rise ? rise.date.getTime() : t0) + 24 * HOUR;
  return { state: "normal", upNow, rise, set, transit: maxBetween(altAt, a, b) };
}

/**
 * La noche que contiene `date` o, si es de día, la siguiente: desde que el Sol baja
 * de `sunLimit` hasta que vuelve a subir. Devuelve { start, end } (Date) o null si
 * en 24 h no llega a oscurecer (verano polar). Si no amanece en 24 h, `end` = start + 24 h.
 */
export function nightWindow(sunDirAt, lat, lon, date, sunLimit = -12) {
  const t0 = date.getTime();
  const sunAlt = (ms) => { const d = new Date(ms); const v = sunDirAt(d); return altAz(v[0], v[1], v[2], lat, lon, d).alt; };
  const cr = (from, dir, back) => {
    const c = nextCrossing(sunDirAt, lat, lon, new Date(from), { dir, maxHours: 24.5, stepMin: back ? -10 : 10, minAlt: sunLimit });
    if (!c) return null;
    const tc = c.date.getTime();
    return refine(sunAlt, tc - 10 * MIN, tc + 10 * MIN, sunLimit);
  };
  let start;
  if (sunAlt(t0) <= sunLimit) { start = cr(t0, -1, true); if (start == null) start = t0 - 24 * HOUR; }
  else { start = cr(t0, -1, false); if (start == null) return null; }
  let end = cr(Math.max(start, t0) + MIN, 1, false);
  if (end == null) end = start + 24 * HOUR;
  return { start: new Date(start), end: new Date(end) };
}

/**
 * Mejor momento de la noche para ver el astro: cuando está más alto con el cielo
 * oscuro. Devuelve
 *   { ok: true, date, alt, night }           hay un buen momento
 *   { ok: false, reason: "daylight", night } solo está arriba con el cielo claro
 *   { ok: false, reason: "gone", night }     estuvo arriba esta noche, pero ya se puso
 *   { ok: false, reason: "low", alt, date, night }  de noche no pasa de `minUseful` grados
 *   { ok: false, reason: "nonight" }         no oscurece en 24 h
 */
export function bestTonight(dirAt, sunDirAt, lat, lon, date, { sunLimit = -12, minUseful = 10 } = {}) {
  const night = nightWindow(sunDirAt, lat, lon, date, sunLimit);
  if (!night) return { ok: false, reason: "nonight" };
  const altAt = (ms) => { const d = new Date(ms); const v = dirAt(d); return altAz(v[0], v[1], v[2], lat, lon, d).alt; };
  // desde ahora si la noche ya empezó: no se recomienda una hora que ya pasó
  const from = Math.max(night.start.getTime(), Math.min(date.getTime(), night.end.getTime()));
  const m = maxBetween(altAt, from, night.end.getTime());
  if (m.alt <= 0) {
    // ¿estuvo arriba antes, esta misma noche? Entonces ya se puso; si no, solo sale con el cielo claro
    const earlier = from > night.start.getTime() ? maxBetween(altAt, night.start.getTime(), from) : null;
    return { ok: false, reason: earlier && earlier.alt > 0 ? "gone" : "daylight", night };
  }
  if (m.alt < minUseful) return { ok: false, reason: "low", alt: m.alt, date: m.date, night };
  return { ok: true, date: m.date, alt: m.alt, night };
}

// ── Señal de radio a una nave ─────────────────────────────────────────────
export const LIGHT_KM_S = 299792.458;
/**
 * Tiempo que tarda una señal de radio (viaja a la velocidad de la luz) en recorrer
 * `distKm`, y el de ida y vuelta. `band` clasifica el ida y vuelta para la frase.
 */
export function signalDelay(distKm) {
  if (!(distKm > 0)) return null;
  const oneWay = distKm / LIGHT_KM_S, roundTrip = 2 * oneWay;
  const band = roundTrip < 4 ? "call" : roundTrip < 120 ? "seconds" : roundTrip < 3600 ? "minutes" : roundTrip < 86400 ? "hours" : "days";
  return { oneWay, roundTrip, band };
}
