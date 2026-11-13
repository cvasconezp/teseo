// time.js — fechas, duraciones y cuenta regresiva. Funciones puras (sin DOM,
// sin textos): la interfaz les pone las palabras. Probadas en scripts/test_app.mjs.

export const DAY_MS = 86400000;

// El backend manda fechas ISO en UTC sin sufijo; sin la "Z" el navegador las
// leería como hora local y el día podría bailar.
export function parseISO(s) {
  if (s instanceof Date) return s;
  if (typeof s === "number") return new Date(s);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}

/** Días de calendario (UTC) que faltan hasta una fecha; nunca negativo. */
export function daysUntil(d, now = Date.now()) {
  return Math.max(0, Math.floor(+parseISO(d) / DAY_MS) - Math.floor(now / DAY_MS));
}

/**
 * Duración en unidades humanas, redondeada a medios:
 *   258,9 días → { n: 8, half: true, unit: "month" }  ("8 meses y medio")
 */
export function durationParts(days) {
  if (days < 45) return { n: Math.max(1, Math.round(days)), half: false, unit: "day" };
  const months = days / 30.4375;
  if (months < 11.75) { const r = Math.round(months * 2) / 2; return { n: Math.floor(r), half: r % 1 !== 0, unit: "month" }; }
  const years = days / 365.25;
  if (years < 10) { const r = Math.round(years * 2) / 2; return { n: Math.floor(r), half: r % 1 !== 0, unit: "year" }; }
  return { n: Math.round(years), half: false, unit: "year" };
}

/** Tiempo relativo para listas: días hasta 60, meses hasta ~23, luego años con un decimal. */
export function relParts(days) {
  if (days < 60) return { n: days, unit: "day" };
  if (days < 700) return { n: Math.round(days / 30.4375), unit: "month" };
  return { n: Math.round((days / 365.25) * 10) / 10, unit: "year" };
}

/**
 * Cuenta regresiva hasta un instante: { past, total, d, h, m, s } (enteros).
 * `total` son los segundos que faltan (0 si ya pasó).
 */
export function countdownParts(target, now = Date.now()) {
  const ms = +parseISO(target) - now;
  if (!Number.isFinite(ms)) return null;
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    past: ms <= 0, total,
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}
