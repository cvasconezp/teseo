// physics.js — física pura de los recorridos nuevos de "Preguntas".
// Sin React, sin red, sin IA. Todo es determinista y está cubierto por
// scripts/test_questions_tours.mjs. Las constantes vienen de constants.js.
import {
  G, C, GM_SUN, M_SUN_KG, MPC, YEAR, G_GALACTIC, RAD_TO_MUAS,
} from "./constants.js";

// ═══ Agujeros negros (métrica de Schwarzschild: sin giro, sin carga) ═════════

// Radio de Schwarzschild r_s = 2GM/c², en metros, para una masa en masas solares.
export const schwarzschildRadiusM = (mSun) => (2 * GM_SUN * mSun) / (C * C);

// "Densidad media": masa ÷ volumen de una esfera euclídea de radio r_s.
// Es una convención (el interior no es un espacio euclídeo), útil solo para
// comparar: decrece como 1/M².   ρ = 3c⁶ / (32 π G³ M²)   [kg/m³]
export function meanDensity(mSun) {
  const rs = schwarzschildRadiusM(mSun);
  return (mSun * M_SUN_KG) / ((4 / 3) * Math.PI * rs * rs * rs);
}

// Dilatación temporal gravitatoria para un observador ESTÁTICO a r = x·r_s:
//   dτ/dt = √(1 − r_s/r).   Solo tiene sentido fuera del horizonte (x > 1);
// en el horizonte o dentro no existe observador estático → null.
export function staticClockRate(x) {
  if (!Number.isFinite(x) || x <= 1) return null;
  return Math.sqrt(1 - 1 / x);
}
// Tiempo que pasa lejos mientras al observador estático le pasa `local`.
export function farTime(local, x) {
  const k = staticClockRate(x);
  return k == null ? null : local / k;
}

// Sombra de un agujero negro sin giro: diámetro = 2·√27·GM/c² = √27·r_s ≈ 5,196 r_s
export const SHADOW_IN_RS = Math.sqrt(27);
// Diámetro angular de la sombra, en microsegundos de arco, a distancia D (m).
export const shadowAngularDiameterMuas = (mSun, distanceM) =>
  ((SHADOW_IN_RS * schwarzschildRadiusM(mSun)) / distanceM) * RAD_TO_MUAS;

// Marea: diferencia de aceleración entre dos puntos separados `h` metros en
// dirección radial, a distancia r del centro:  Δa = 2GM·h / r³   [m/s²]
export const tidalAcceleration = (mSun, r, h) => (2 * GM_SUN * mSun * h) / (r * r * r);
// …evaluada en el horizonte (r = r_s):  Δa = c⁶·h / (4 G² M²)  → mayor cuanto MENOR es la masa
export const tidalAtHorizon = (mSun, h) => tidalAcceleration(mSun, schwarzschildRadiusM(mSun), h);

// Velocidad de una órbita circular newtoniana: v = √(GM/r)   [m/s]
export const circularSpeed = (gm, r) => Math.sqrt(gm / r);

// ═══ Expansión ═══════════════════════════════════════════════════════════════

// Tiempo de Hubble 1/H0 en miles de millones de años (Ga), con H0 en km/s/Mpc.
export const GYR_PER_INVERSE_H0 = MPC / 1e3 / YEAR / 1e9;   // 977,79 Ga·(km/s/Mpc)
export const hubbleTimeGyr = (H0) => GYR_PER_INVERSE_H0 / H0;

// Friedmann sin radiación:  H(a) = H0 · √(Ωm·a⁻³ + Ωk·a⁻² + ΩΛ),  Ωk = 1 − Ωm − ΩΛ.
export function expansionRate(a, Om, OL) {
  const Ok = 1 - Om - OL;
  return Math.sqrt(Om / (a * a * a) + Ok / (a * a) + OL);
}
// Tiempo transcurrido desde a = 0 hasta `a`, en unidades de 1/H0:
//   t(a) = ∫₀ᵃ da' / (a'·E(a')).  Con a' = u² el integrando es finito en 0:
//   2u² / √(Ωm + Ωk·u² + ΩΛ·u⁶).  Regla de Simpson con n intervalos (par).
export function timeToScale(a, Om, OL, n = 400) {
  if (!(a > 0) || !(Om > 0)) return a === 0 ? 0 : NaN;
  const Ok = 1 - Om - OL, U = Math.sqrt(a), h = U / n;
  const f = (u) => { const u2 = u * u; const d = Om + Ok * u2 + OL * u2 * u2 * u2; return d > 0 ? (2 * u2) / Math.sqrt(d) : NaN; };
  let s = f(0) + f(U);
  for (let i = 1; i < n; i++) s += f(i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}
// Edad del universo en Ga (a = 1 es hoy).
export const ageGyr = (H0, Om, OL) => timeToScale(1, Om, OL) * hubbleTimeGyr(H0);
// Solución exacta del caso plano con Λ (sirve para probar la integración):
//   t0·H0 = 2 / (3√ΩΛ) · asinh(√(ΩΛ/Ωm))
export const flatLambdaAgeH0 = (Om) => { const OL = 1 - Om; return OL <= 0 ? 2 / 3 : (2 / (3 * Math.sqrt(OL))) * Math.asinh(Math.sqrt(OL / Om)); };
// Parámetro de desaceleración hoy: q0 = Ωm/2 − ΩΛ  (negativo = la expansión se acelera)
export const deceleration = (Om, OL) => Om / 2 - OL;
// Curva a(t): puntos {t, a} con t en Ga desde el Big Bang, hasta el factor de escala aMax.
export function scaleCurve(H0, Om, OL, aMax = 3, steps = 90) {
  const tH = hubbleTimeGyr(H0), out = [{ t: 0, a: 0 }];
  for (let i = 1; i <= steps; i++) {
    const a = aMax * Math.pow(i / steps, 1.5);          // más puntos donde la curva dobla
    const t = timeToScale(a, Om, OL, 120);
    if (!Number.isFinite(t)) break;
    out.push({ t: t * tH, a });
  }
  return out;
}

// Recta por el origen que mejor ajusta v = H·d (mínimos cuadrados sin pesos).
export function slopeThroughOrigin(points) {
  let sxy = 0, sxx = 0;
  for (const p of points) { sxy += p.d * p.v; sxx += p.d * p.d; }
  return sxx > 0 ? sxy / sxx : NaN;
}
// Desajuste típico (raíz del error cuadrático medio) de los puntos frente a v = H·d.
export function rmsResidual(points, H) {
  let s = 0;
  for (const p of points) { const e = p.v - H * p.d; s += e * e; }
  return points.length ? Math.sqrt(s / points.length) : NaN;
}
// Separación entre dos medidas en "sigmas" (errores gaussianos independientes).
export const sigmaTension = (a, ea, b, eb) => Math.abs(a - b) / Math.hypot(ea, eb);

// ═══ Materia oscura: curvas de rotación ══════════════════════════════════════
// Unidades de galaxias: radios en kpc, velocidades en km/s, masas en M☉.

// Materia visible, con la convención de SPARC (Lelli et al. 2016, ec. 2):
//   V_bar² = V_gas·|V_gas| + Υ·V_disco²    (V_disco tabulada para Υ = 1 M☉/L☉)
// El signo del gas se conserva: un hueco central de gas puede "empujar hacia fuera".
export function visibleSpeed(vgas, vdisk, upsilon) {
  const v2 = vgas * Math.abs(vgas) + upsilon * vdisk * vdisk;
  return v2 > 0 ? Math.sqrt(v2) : 0;
}
// Halo pseudoisotermo: ρ(r) = ρ0 / (1 + (r/rc)²)  →  M(<r) ∝ r − rc·atan(r/rc).
// Se fija por la masa que encierra dentro de un radio de referencia.
const haloShape = (r, rc) => r - rc * Math.atan(r / rc);
export function haloMassWithin(r, mRef, rRef, rc) {
  return mRef * (haloShape(r, rc) / haloShape(rRef, rc));
}
export function haloSpeed(r, mRef, rRef, rc) {
  if (!(r > 0) || !(mRef > 0)) return 0;
  return Math.sqrt((G_GALACTIC * haloMassWithin(r, mRef, rRef, rc)) / r);
}
// Las velocidades de cada componente se suman en cuadratura (las masas se suman).
export const totalSpeed = (vVisible, vHalo) => Math.hypot(vVisible, vHalo);
// Masa encerrada que exige una velocidad circular v a radio r:  M = v²·r / G
export const dynamicalMass = (v, r) => (v * v * r) / G_GALACTIC;
// Caída kepleriana: toda la masa visible M concentrada dentro de r.
export const keplerSpeedGalactic = (m, r) => Math.sqrt((G_GALACTIC * m) / r);

// Modelo completo sobre una tabla de puntos {r, v, e, vgas, vdisk}.
export function rotationModel(rows, { upsilon, haloMass, rRef, rc }) {
  return rows.map(p => {
    const vis = visibleSpeed(p.vgas, p.vdisk, upsilon);
    return { r: p.r, vis, model: totalSpeed(vis, haloSpeed(p.r, haloMass, rRef, rc)) };
  });
}
// χ² reducido del modelo frente a las medidas (usa el error publicado de cada punto).
export function reducedChi2(rows, model, nParams = 1) {
  let s = 0;
  rows.forEach((p, i) => { const z = (p.v - model[i].model) / p.e; s += z * z; });
  return s / Math.max(1, rows.length - nParams);
}
// Desajuste medio en km/s (más fácil de leer que χ²).
export function rmsSpeed(rows, model) {
  let s = 0;
  rows.forEach((p, i) => { const e = p.v - model[i].model; s += e * e; });
  return Math.sqrt(s / rows.length);
}

// ═══ Utilidades compartidas ══════════════════════════════════════════════════
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// Lee un número de un parámetro del hash y lo acota; null si no es válido.
export function readNumber(str, min, max) {
  if (typeof str !== "string" || str.trim() === "") return null;
  const x = Number(str);
  return Number.isFinite(x) ? clamp(x, min, max) : null;
}
// Ruta de la pestaña a partir del hash. Compatibilidad: `?drake=…` sin `q` es Drake.
export function parseRoute(hash, ids) {
  const h = typeof hash === "string" ? hash : "";
  if (!/^#(preguntas|questions)\b/.test(h)) return { match: false, id: null, params: new URLSearchParams() };
  const qi = h.indexOf("?");
  const params = new URLSearchParams(qi < 0 ? "" : h.slice(qi + 1));
  const q = params.get("q");
  let id = null;
  if (q && ids.includes(q)) id = q;
  else if (!q && params.get("drake")) id = "drake";
  return { match: true, id, params };
}
