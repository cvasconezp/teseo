// astro.js — utilidades comunes del Calendario del cielo. Solo IMPORTA las efemérides
// de Teseo (src/ephemeris.js) y la conversión alt/az de src/sky/guide.js; no las modifica.
// Puro (sin DOM): se prueba en scripts/test_now_calendar.mjs.
import { ephemeris } from "../../ephemeris.js";
import { altAz } from "../../sky/guide.js";

export const RAD = Math.PI / 180;
export const MIN = 60000, HOUR = 3600000, DAY = 86400000;
export const wrap180 = x => { const y = ((x % 360) + 360) % 360; return y > 180 ? y - 360 : y; };
export const rev360 = x => ((x % 360) + 360) % 360;

/** Nombres (en español, como los devuelve ephemeris()) de los planetas. */
export const PLANET_NAMES = ["Mercurio", "Venus", "Marte", "Júpiter", "Saturno", "Urano", "Neptuno"];
export const PLANET_EN = { Mercurio: "Mercury", Venus: "Venus", Marte: "Mars", "Júpiter": "Jupiter", Saturno: "Saturn", Urano: "Uranus", Neptuno: "Neptune" };

const OBL_RAD = (d) => (23.4393 - 3.563e-7 * d) * RAD;

/**
 * Estado geocéntrico en un instante (ms UTC): para cada cuerpo, vector unitario
 * ecuatorial, longitud y latitud eclípticas (°, de la fecha) y el cuerpo crudo de
 * ephemeris() (para la magnitud). Los elementos de Schlyter dan ~1–2′.
 */
const CACHE = new Map();
export function stateAt(ms) {
  // las rejillas de búsqueda se repiten entre pares de cuerpos: se guarda el resultado
  const hit = CACHE.get(ms); if (hit) return hit;
  if (CACHE.size > 40000) CACHE.clear();
  const r = computeState(ms); CACHE.set(ms, r); return r;
}
function computeState(ms) {
  const list = ephemeris(new Date(ms));
  const d = ms / DAY + 2440587.5 - 2451543.5, ecl = OBL_RAD(d);
  const out = {};
  for (const b of list) {
    const ra = b.ra * RAD, dec = b.dec * RAD;
    const v = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
    // equatorial → eclíptica: y' = y cos ε + z sin ε ; z' = −y sin ε + z cos ε
    const ye = v[1] * Math.cos(ecl) + v[2] * Math.sin(ecl), ze = -v[1] * Math.sin(ecl) + v[2] * Math.cos(ecl);
    out[b.name] = { v, lon: rev360(Math.atan2(ye, v[0]) / RAD), lat: Math.asin(Math.max(-1, Math.min(1, ze))) / RAD, raw: b };
  }
  return out;
}

/** Separación angular (°) entre dos vectores unitarios. Estable también para ángulos pequeños. */
export function sepDeg(a, b) {
  const cx = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return Math.atan2(Math.hypot(cx[0], cx[1], cx[2]), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / RAD;
}

/** Bisección sobre f(ms) con cambio de signo entre t0 y t1 (hasta ~`tolMs`). */
export function bisect(f, t0, t1, tolMs = 15000) {
  let a = t0, b = t1, fa = f(a);
  while (b - a > tolMs) {
    const m = (a + b) / 2, fm = f(m);
    if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

/** Mínimo (o máximo con sign = −1) de f en [t0, t1] por sección áurea. */
export function goldenExtreme(f, t0, t1, sign = 1, tolMs = 30000) {
  const g = 0.381966;
  let lo = t0, hi = t1;
  while (hi - lo > tolMs) {
    const m1 = lo + g * (hi - lo), m2 = hi - g * (hi - lo);
    if (sign * f(m1) < sign * f(m2)) hi = m2; else lo = m1;
  }
  return (lo + hi) / 2;
}

export const altAzOf = (v, lat, lon, ms) => altAz(v[0], v[1], v[2], lat, lon, new Date(ms));

/**
 * ¿Hay algún momento, a ±`halfHours` h de `ms`, con el Sol por debajo de `sunLimit` y todos los
 * vectores `names` a más de `minAlt` grados? Devuelve el mejor muestreo (cada 30 min) o null.
 */
export function nightVisibility(ms, names, lat, lon, { halfHours = 12, sunLimit = -6, minAlt = 5 } = {}) {
  let best = null;
  for (let t = ms - halfHours * HOUR; t <= ms + halfHours * HOUR; t += 30 * MIN) {
    const st = stateAt(t);
    if (altAzOf(st.Sol.v, lat, lon, t).alt >= sunLimit) continue;
    let low = Infinity;
    for (const n of names) low = Math.min(low, altAzOf(st[n].v, lat, lon, t).alt);
    if (low > minAlt && (!best || low > best.alt)) best = { t, alt: low };
  }
  return best;
}
