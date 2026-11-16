// endPhysics.js — cuentas del recorrido «¿Cómo terminará el universo?» (puro; probado en
// scripts/test_questions_end.mjs). Las constantes vienen de constants.js.
//
//  · Caja de gas: N partículas, cada una cae al azar en una mitad. La probabilidad de que
//    TODAS queden en la misma mitad (cualquiera de las dos) es 2 · (1/2)^N = 2^(1−N).
//  · Fotones: un cuerpo negro a temperatura T emite fotones de energía media 2,701 kT, así que,
//    a igual energía, el número de fotones va como 1/T: por cada fotón que llega del Sol (T☉)
//    salen T☉ / T_planeta fotones infrarrojos (aproximación de cuerpo negro).
//  · Agujero negro (Bekenstein–Hawking y Hawking, sin rotación ni carga):
//      S / k = 4π G M² / (ħ c)            T_H = ħ c³ / (8π G M k)
//      t_evap = 5120 π G² M³ / (ħ c⁴)     (solo fotones; con más partículas, algo menor)
//  · Gran Desgarro (Caldwell, Kamionkowski y Weinberg 2003, ec. 2), w < −1:
//      t_rip − t_hoy ≈ (2/3) |1 + w|⁻¹ H₀⁻¹ (1 − Ω_m)^(−1/2)
//  · Factor de escala a(t) en un universo plano con materia y energía oscura de w constante:
//      da/dt = H₀ a √(Ω_m a⁻³ + (1 − Ω_m) a^(−3(1+w)))      (radiación despreciada)
import { G, C, HBAR, K_B, YEAR, M_SUN_KG } from "./constants.js";
import { hubbleTimeGyr } from "./physics.js";

const LOG2 = Math.log10(2);

// ── Caja de gas ────────────────────────────────────────────────────────────
/** log₁₀ de «1 en X»: X = 2^(n−1) es el inverso de la probabilidad de que n partículas estén todas en la misma mitad. */
export const sameSideOddsLog10 = (n) => (n >= 1 ? (n - 1) * LOG2 : 0);

/** Reparte n partículas al azar: { x, y, left } con x ∈ [0,1) (left = x < 0,5). rng() ∈ [0,1). */
export function shake(n, rng = Math.random) {
  const out = [];
  for (let i = 0; i < n; i++) { const x = rng(), y = rng(); out.push({ x, y, left: x < 0.5 }); }
  return out;
}
export const leftCount = (pts) => pts.reduce((k, p) => k + (p.left ? 1 : 0), 0);
export const allOneSide = (pts) => { const l = leftCount(pts); return pts.length > 0 && (l === 0 || l === pts.length); };

/** Agita `trials` veces n partículas y cuenta cuántas veces quedaron todas a un mismo lado. */
export function shakeMany(n, trials, rng = Math.random) {
  let hits = 0;
  for (let t = 0; t < trials; t++) {
    let l = 0;
    for (let i = 0; i < n; i++) if (rng() < 0.5) l++;
    if (l === 0 || l === n) hits++;
  }
  return hits;
}
/** Veces esperadas en `trials` intentos. */
export const expectedHits = (n, trials) => trials * Math.pow(2, 1 - n);

// ── Fotones que entran y salen ─────────────────────────────────────────────
export const photonRatio = (tSun, tBody) => tSun / tBody;

// ── Agujeros negros (en logaritmos: las masas grandes desbordan si no) ─────
const lg = Math.log10;
/** log₁₀(S/k) de un agujero negro de mSun masas solares. */
export const bhEntropyLog10 = (mSun) => lg(4 * Math.PI * G / (HBAR * C)) + 2 * lg(mSun * M_SUN_KG);
/** Temperatura de Hawking en kelvin. */
export const hawkingTempK = (mSun) => (HBAR * C ** 3) / (8 * Math.PI * G * mSun * M_SUN_KG * K_B);
/** log₁₀ del tiempo de evaporación en años. */
export const evapYearsLog10 = (mSun) => lg((5120 * Math.PI * G * G) / (HBAR * C ** 4)) + 3 * lg(mSun * M_SUN_KG) - lg(YEAR);
/** Masa (en masas solares) cuya entropía iguala 10^log10S. */
export const massForEntropy = (log10S) => Math.pow(10, (log10S - bhEntropyLog10(1)) / 2);

// ── Gran Desgarro ──────────────────────────────────────────────────────────
/** Miles de millones de años hasta el desgarro; Infinity si w ≥ −1 (no hay desgarro). */
export function ripTimeGyr(w, H0, Om) {
  if (!(w < -1)) return Infinity;
  return (2 / 3) / Math.abs(1 + w) * hubbleTimeGyr(H0) / Math.sqrt(1 - Om);
}

// ── Historia del factor de escala ──────────────────────────────────────────
/** Ritmo de expansión H(a) en 1/Ga. */
export function hubbleRate(a, { H0, Om, w }) {
  const h0 = 1 / hubbleTimeGyr(H0);
  return h0 * Math.sqrt(Om / (a * a * a) + (1 - Om) * Math.pow(a, -3 * (1 + w)));
}
/**
 * a(t) con t en Ga contado desde hoy (a = 1 en t = 0), integrado con RK4 hacia atrás hasta a ≈ 0
 * y hacia delante hasta tMax o hasta que a supere aMax. Devuelve [{ t, a }] ordenado por t.
 */
export function scaleHistory({ H0, Om, w, tMax = 40, aMax = 8, dt = 0.05 }) {
  const p = { H0, Om, w };
  const f = (a) => a * hubbleRate(a, p);
  const step = (a, h) => {
    const k1 = f(a), k2 = f(a + (h / 2) * k1), k3 = f(a + (h / 2) * k2), k4 = f(a + h * k3);
    return a + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  };
  const back = [];
  let a = 1, t = 0;
  while (a > 0.02 && t > -20) { const h = Math.min(dt, a / (4 * f(a))); a = step(a, -h); t -= h; if (!(a > 0)) break; back.push({ t, a: Math.max(a, 0) }); }
  const fwd = [{ t: 0, a: 1 }];
  a = 1; t = 0;
  while (t < tMax && a < aMax) {
    const h = Math.min(dt, 0.05 / hubbleRate(a, p));          // pasos más cortos si la expansión se dispara
    a = step(a, h); t += h;
    if (!Number.isFinite(a)) break;
    fwd.push({ t, a });
  }
  return [...back.reverse(), ...fwd];
}
/** Edad del universo en Ga según scaleHistory (instante en que a → 0). */
export function bigBangAgo(hist) {
  const first = hist[0];
  return first ? -first.t : NaN;
}

/**
 * Esquema (NO es un cálculo) de un Gran Colapso con las fechas del modelo de referencia de
 * Luu, Qiu y Tye (2025): tamaño máximo dentro de `tPeak` Ga y colapso dentro de `tEnd` Ga.
 * Subida: Hermite cúbico (pendiente de hoy H₀, cero en el máximo). Bajada: aPeak·(1 − s^2,2), sin rebotes.
 */
export function crunchSketch({ H0, tPeak = 11, tEnd = 19.5, aPeak = 1.45, n = 60 }) {
  const h0 = 1 / hubbleTimeGyr(H0);
  const herm = (p0, m0, p1, m1, s, L) => {
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * L * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * L * m1;
  };
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = (tEnd * i) / n;
    const a = t <= tPeak
      ? herm(1, h0, aPeak, 0, t / tPeak, tPeak)
      : aPeak * (1 - Math.pow((t - tPeak) / (tEnd - tPeak), 2.2));   // cae cada vez más deprisa hasta a = 0
    out.push({ t, a: Math.max(0, a) });
  }
  return out;
}

// ── Eras de Adams y Laughlin (1997), η = log₁₀(años desde el Big Bang) ──────
export const ERA_BOUNDS = [
  { id: "stelliferous", from: 6, to: 14 },
  { id: "degenerate", from: 14, to: 38 },
  { id: "blackhole", from: 38, to: 100 },
  { id: "dark", from: 100, to: Infinity },
];
export function eraAt(eta) {
  for (const e of ERA_BOUNDS) if (eta < e.to) return e.id;
  return "dark";
}
