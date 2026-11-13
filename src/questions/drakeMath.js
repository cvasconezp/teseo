// drakeMath.js — aritmética pura de la pestaña "Preguntas".
// Sin React, sin red, sin IA: todo lo que aquí se calcula es determinista y
// está cubierto por scripts/test_questions.mjs.

// ─── Ecuación de Drake ───────────────────────────────────────────────────────
// N = R* · fp · ne · fl · fi · fc · L
export const FACTOR_ORDER = ["rstar", "fp", "ne", "fl", "fi", "fc", "L"];

export function drakeN(v) {
  let n = 1;
  for (const k of FACTOR_ORDER) {
    const x = Number(v[k]);
    if (!Number.isFinite(x) || x < 0) return NaN;
    n *= x;
  }
  return n;
}

// ─── Deslizadores logarítmicos ───────────────────────────────────────────────
// Cada paso es 0,05 dex (×1,122) y el valor se redondea a 2 cifras
// significativas: lo que se ve es exactamente lo que se multiplica. El
// redondeo (≤0,021 dex) es menor que medio paso, así que posición ↔ valor es
// estable (el teclado nunca se "atasca").
export const STEP_DEX = 0.05;

export function roundSig(x, sig = 2) {
  if (!Number.isFinite(x) || x === 0) return x;
  const p = Math.floor(Math.log10(Math.abs(x)));
  const f = Math.pow(10, sig - 1 - p);
  // toPrecision evita colas binarias (0.30000000000000004)
  return Number((Math.round(x * f) / f).toPrecision(sig));
}
export function sliderSteps(min, max) { return Math.round((Math.log10(max) - Math.log10(min)) / STEP_DEX); }
export function valueToPos(value, min, max) {
  const n = sliderSteps(min, max);
  const pos = Math.round((Math.log10(value) - Math.log10(min)) / STEP_DEX);
  return Math.min(n, Math.max(0, pos));
}
export function posToValue(pos, min, max) {
  const n = sliderSteps(min, max);
  if (pos <= 0) return min;
  if (pos >= n) return max;
  return roundSig(Math.pow(10, Math.log10(min) + pos * STEP_DEX), 2);
}
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ─── Distancia entre vecinas ─────────────────────────────────────────────────
// Supuesto (simplificación declarada en la interfaz): N civilizaciones
// repartidas al azar y de manera uniforme en un disco de 100.000 años luz de
// diámetro y 1.000 de grosor. Distancia típica entre vecinas:
//   · si caben "en volumen":   d = (V / N)^(1/3),  V = π R² h
//   · si d supera el grosor h, el disco se comporta como una lámina:
//                              d = (π R² / N)^(1/2)
// Las dos ramas coinciden en d = h (N = πR²/h² ≈ 7.854). Con menos de dos
// civilizaciones no hay vecina dentro de la galaxia: se devuelve null.
export const GALAXY = { diameterLy: 100000, thicknessLy: 1000 };

export function neighborDistanceLy(N, g = GALAXY) {
  if (!Number.isFinite(N) || N < 2) return null;
  const R = g.diameterLy / 2, h = g.thicknessLy;
  const area = Math.PI * R * R;
  const d3 = Math.cbrt((area * h) / N);
  const d = d3 <= h ? d3 : Math.sqrt(area / N);
  return Math.min(d, g.diameterLy);
}
// Una señal de radio viaja a la velocidad de la luz: ida y vuelta = 2·d años.
export const roundTripYears = (dLy) => (dLy == null ? null : 2 * dLy);

// ─── ¿De dónde viene la variación? ───────────────────────────────────────────
// Para un grupo de factores: órdenes de magnitud que abarcan sus deslizadores
// y el intervalo de N que se alcanza moviendo SOLO ese grupo (el resto fijo).
export function groupSpan(factors, values, keys) {
  let lo = 1, hi = 1, cur = 1;
  for (const f of factors) {
    if (keys.includes(f.key)) { lo *= f.min; hi *= f.max; cur *= values[f.key]; }
  }
  const N = drakeN(values);
  const rest = cur > 0 ? N / cur : 0;
  return { orders: Math.log10(hi / lo), nMin: rest * lo, nMax: rest * hi };
}

// ─── Kardashov (interpolación de Sagan) ──────────────────────────────────────
// K = (log10 P − 6) / 10, con P en vatios.  Tipo I = 1e16 W, II = 1e26, III = 1e36.
export const kardashev = (watts) => (Math.log10(watts) - 6) / 10;
export const kardashevPower = (K) => Math.pow(10, 10 * K + 6);
export const SECONDS_PER_YEAR = 365.25 * 86400;                 // año juliano
export const ejPerYearToWatts = (ej) => (ej * 1e18) / SECONDS_PER_YEAR;
// Potencia solar que intercepta la Tierra: irradiancia × sección del planeta
export const interceptedSunlightW = (irradiance, radiusM) => irradiance * Math.PI * radiusM * radiusM;

// ─── Burbuja de radio ────────────────────────────────────────────────────────
// Las ondas viajan 1 año luz por año: radio = años transcurridos.
export const radioBubbleRadiusLy = (year, since) => Math.max(0, year - since);

// ─── Estado compartible (hash) ───────────────────────────────────────────────
// drake=R*,fp,ne,fl,fi,fc,L   (números; se validan contra el rango de cada factor)
const compact = (x) => String(Number(x.toPrecision(3)));
export function encodeDrake(values) { return FACTOR_ORDER.map(k => compact(values[k])).join(","); }
export function decodeDrake(str, factors) {
  if (typeof str !== "string") return null;
  const parts = str.split(",");
  if (parts.length !== FACTOR_ORDER.length) return null;
  const out = {};
  for (let i = 0; i < FACTOR_ORDER.length; i++) {
    const f = factors.find(x => x.key === FACTOR_ORDER[i]);
    const x = Number(parts[i]);
    if (!f || parts[i].trim() === "" || !Number.isFinite(x) || x <= 0) return null;
    out[f.key] = clamp(x, f.min, f.max);
  }
  return out;
}
export function sameValues(a, b) {
  return FACTOR_ORDER.every(k => Math.abs(Math.log10(a[k]) - Math.log10(b[k])) < 1e-9);
}
