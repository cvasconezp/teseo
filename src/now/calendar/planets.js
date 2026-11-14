// planets.js — oposiciones, máximas elongaciones y conjunciones, calculadas con las
// efemérides de Teseo (src/ephemeris.js, método de Schlyter, ~1–2′). Búsqueda de extremos
// con pasos de 1 día (oposición, elongación) o de 3–6 h (conjunciones) y refinado por
// bisección / sección áurea. Geocéntrico: la paralaje de la Luna (hasta ~1°) NO se aplica.
// Validación contra In-The-Sky.org: scripts/test_now_calendar.mjs.
import { stateAt, sepDeg, bisect, goldenExtreme, wrap180, PLANET_NAMES, DAY, HOUR } from "./astro.js";

const OUTER = ["Marte", "Júpiter", "Saturno", "Urano", "Neptuno"];
const INNER = ["Mercurio", "Venus"];

/** Oposiciones (longitud eclíptica geocéntrica = Sol + 180°) en [from, to] ms. */
export function findOppositions(from, to) {
  const out = [];
  const g = (name) => (ms) => { const s = stateAt(ms); return wrap180(s[name].lon - s.Sol.lon - 180); };
  for (const name of OUTER) {
    const f = g(name);
    let t0 = from - DAY, f0 = f(t0);
    for (let t1 = t0 + DAY; t1 <= to + DAY; t1 += DAY) {
      const f1 = f(t1);
      // cruce de signo con valores pequeños (descarta el salto ±180)
      if (f0 !== f1 && (f0 > 0) !== (f1 > 0) && Math.abs(f0) < 90 && Math.abs(f1) < 90) {
        const t = bisect(f, t0, t1, 10000);
        if (t >= from && t <= to) out.push({ planet: name, t });
      }
      t0 = t1; f0 = f1;
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Máximas elongaciones de Mercurio y Venus: { planet, t, elong (°), side: "east"|"west" }. */
export function findElongations(from, to) {
  const out = [];
  for (const name of INNER) {
    const e = (ms) => { const s = stateAt(ms); return sepDeg(s[name].v, s.Sol.v); };
    const step = DAY;
    let tm = from - 2 * step, em = e(tm), t0 = tm + step, e0 = e(t0);
    for (let t1 = t0 + step; t1 <= to + 2 * step; t1 += step) {
      const e1 = e(t1);
      if (e0 > em && e0 >= e1) {
        const t = goldenExtreme(e, t0 - step, t0 + step, -1, 30000);
        if (t >= from && t <= to) {
          const s = stateAt(t);
          out.push({ planet: name, t, elong: sepDeg(s[name].v, s.Sol.v), side: wrap180(s[name].lon - s.Sol.lon) > 0 ? "east" : "west" });
        }
      }
      tm = t0; em = e0; t0 = t1; e0 = e1;
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Mínimos locales de la separación de dos cuerpos entre `from` y `to`, con paso `stepMs`. */
function closeApproaches(a, b, from, to, stepMs, maxSep) {
  const sep = (ms) => { const s = stateAt(ms); return sepDeg(s[a].v, s[b].v); };
  const out = [];
  let tm = from - stepMs, em = sep(tm), t0 = from, e0 = sep(t0);
  for (let t1 = t0 + stepMs; t1 <= to + stepMs; t1 += stepMs) {
    const e1 = sep(t1);
    if (e0 < em && e0 <= e1) {
      const t = goldenExtreme(sep, tm, t1, 1, 20000);
      const s = sep(t);
      if (t >= from && t <= to && s < maxSep) out.push({ a, b, t, sep: s });
    }
    tm = t0; em = e0; t0 = t1; e0 = e1;
  }
  return out;
}

/**
 * Conjunciones cercanas: Luna–planeta con separación < moonMax° (3° por defecto) y
 * planeta–planeta con separación < planetMax° (2°). Se descartan las que ocurren a menos
 * de 6° del Sol (no se pueden observar). Separación geocéntrica en el instante de mínima.
 */
export function findConjunctions(from, to, { moonMax = 3, planetMax = 2 } = {}) {
  const out = [];
  for (const p of PLANET_NAMES) for (const c of closeApproaches("Luna", p, from, to, 3 * HOUR, moonMax)) out.push({ ...c, kind: "moon" });
  for (let i = 0; i < PLANET_NAMES.length; i++) for (let j = i + 1; j < PLANET_NAMES.length; j++) {
    for (const c of closeApproaches(PLANET_NAMES[i], PLANET_NAMES[j], from, to, 6 * HOUR, planetMax)) out.push({ ...c, kind: "planets" });
  }
  return out.filter(c => { const s = stateAt(c.t); return sepDeg(s[c.b].v, s.Sol.v) >= 6; }).sort((x, y) => x.t - y.t);
}
