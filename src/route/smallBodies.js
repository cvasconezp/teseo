// smallBodies.js — el cinturón de asteroides y Ceres para el mapa de la vista Ruta (escala comprimida de
// hohmannMap.js). Puro; se prueba en scripts/test_small_bodies.mjs.
//
// Ceres: elementos osculatores de JPL SBDB (época JD 2461200,5 TDB, eclíptica J2000), propagados con Kepler: basta
// para situarlo en el mapa (error de una fracción de grado en meses). El cinturón: el anillo principal entre 2,1 y
// 3,3 UA con los huecos de Kirkwood (resonancias con Júpiter 3:1, 5:2, 7:3 y 2:1), dibujado con puntos fijos.

const D2R = Math.PI / 180;
/** 1 Ceres (A801 AA), JPL Small-Body Database, consulta del 22 nov 2026. */
export const CERES = { epochJD: 2461200.5, a: 2.765552595034094, e: 0.07969229514816586, i: 10.58802780183462, om: 80.24862682043221, w: 73.29421453021587, ma: 274.4193463761342, n: 0.21430445064843 };

const jd = (date) => date.getTime() / 86400000 + 2440587.5;

/** Posición heliocéntrica eclíptica (UA) de un cuerpo con elementos `el` en `date`: { x, y, z, r }. */
export function keplerXYZ(el, date) {
  const M = ((el.ma + el.n * (jd(date) - el.epochJD)) % 360) * D2R;
  let E = M;
  for (let k = 0; k < 30; k++) { const dE = (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E)); E -= dE; if (Math.abs(dE) < 1e-12) break; }
  const xv = el.a * (Math.cos(E) - el.e), yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const v = Math.atan2(yv, xv), r = Math.hypot(xv, yv);
  const O = el.om * D2R, w = el.w * D2R, I = el.i * D2R, u = v + w;
  const x = r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(I));
  const y = r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(I));
  const z = r * Math.sin(u) * Math.sin(I);
  return { x, y, z, r };
}

/** Huecos de Kirkwood (UA): resonancias 3:1, 5:2, 7:3 y 2:1 con Júpiter. */
export const KIRKWOOD = [2.502, 2.825, 2.958, 3.279];

/** Generador pseudoaleatorio fijo (mulberry32), para que el cinturón no cambie entre visitas. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Puntos del cinturón principal: [{ au, ang (rad), s (tamaño relativo 0,5–1,5) }]. Más densos entre 2,3 y 3,0 UA;
 * vacíos alrededor de los huecos de Kirkwood (±0,025 UA).
 */
export function beltPoints(count = 700, seed = 7) {
  const rnd = rng(seed), out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    // densidad: suma de dos uniformes (triangular) centrada en ~2,7 UA, recortada a 2,1–3,3
    const au = 2.1 + (rnd() + rnd()) * 0.6;
    if (KIRKWOOD.some((g) => Math.abs(au - g) < 0.025)) continue;
    out.push({ au, ang: rnd() * Math.PI * 2, s: 0.5 + rnd() });
  }
  return out;
}

/** El ángulo (rad) de la circunferencia más alejado de todos los dados: para poner un rótulo sin tapar planetas. */
export function freestAngle(angles, step = Math.PI / 24) {
  let best = 0, bd = -1;
  for (let a = 0; a < Math.PI * 2; a += step) {
    const d = Math.min(...angles.map((b) => { const x = Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return x; }));
    if (d > bd) { bd = d; best = a; }
  }
  return best;
}

// ── más allá de Neptuno, sondas, cometas y troyanos ──────────────────────────────────────────────────────────
/** 134340 Plutón, JPL SBDB (época JD 2457588,5 TDB, eclíptica J2000). */
export const PLUTO = { epochJD: 2457588.5, a: 39.58862938517124, e: 0.2518378778576892, i: 17.14771140999114, om: 110.2923840543057, w: 113.7090015158565, ma: 38.68366347318184, n: 0.003956838955553025 };

/**
 * El cinturón de Kuiper (30–50 UA) no cabe con la escala del mapa: va como una franja fina pegada al borde, entre los
 * radios r0 y r1 del mapa, con la distancia real llevada dentro de ella de forma lineal (kuiperR).
 */
export const KUIPER = { au0: 30, au1: 50, r0: 46.6, r1: 49.4 };
export const kuiperR = (au) => KUIPER.r0 + (Math.min(KUIPER.au1, Math.max(KUIPER.au0, au)) - KUIPER.au0) / (KUIPER.au1 - KUIPER.au0) * (KUIPER.r1 - KUIPER.r0);
/** Puntos del cinturón de Kuiper: [{ au, ang, s }], más densos en el «cinturón clásico» (42–48 UA). */
export function kuiperPoints(count = 420, seed = 11) {
  const rnd = rng(seed), out = [];
  for (let k = 0; k < count; k++) {
    const au = rnd() < 0.6 ? 42 + rnd() * 6 : 30 + rnd() * 20;
    out.push({ au, ang: rnd() * Math.PI * 2, s: 0.5 + rnd() });
  }
  return out;
}

/**
 * Troyanos de Júpiter: dos nubes que comparten su órbita 60° por delante (L4) y 60° por detrás (L5). jupAng: ángulo
 * de Júpiter (rad, el del mapa). Devuelve [{ ang, dr (desvío radial, unidades del mapa), s, l4 }].
 */
export function trojanPoints(jupAng, count = 220, seed = 5) {
  const rnd = rng(seed), out = [];
  const gauss = () => { let u = 0; for (let k = 0; k < 4; k++) u += rnd(); return (u - 2) / 0.577; };   // ~N(0,1)
  for (let k = 0; k < count; k++) {
    const l4 = k % 2 === 0, da = Math.max(-0.45, Math.min(0.45, gauss() * 0.16));
    out.push({ ang: jupAng + (l4 ? 1 : -1) * (Math.PI / 3) + da, dr: gauss() * 0.7, s: 0.5 + rnd(), l4 });
  }
  return out;
}

const EPS = 23.4392911 * D2R;
/** Vector ecuatorial J2000 → eclíptico J2000. */
export const eqToEcl = (v) => [v[0], v[1] * Math.cos(EPS) + v[2] * Math.sin(EPS), -v[1] * Math.sin(EPS) + v[2] * Math.cos(EPS)];

/**
 * Una sonda de /api/probes (dirección vista desde la Tierra, ecuatorial, y distancia en UA) → posición heliocéntrica
 * eclíptica { x, y, z, r, lon (rad) }. earth = posición heliocéntrica eclíptica de la Tierra [x, y, z] (UA).
 */
export function probeHelio(p, earth) {
  const g = eqToEcl([p.nx * p.dist_au, p.ny * p.dist_au, p.nz * p.dist_au]);
  const x = g[0] + earth[0], y = g[1] + earth[1], z = g[2] + (earth[2] || 0);
  return { x, y, z, r: Math.hypot(x, y, z), lon: Math.atan2(y, x) };
}

/** Posición heliocéntrica eclíptica (UA) de un cometa con anomalía verdadera nu (elementos de comet-orbits.json). */
export function cometEclAtNu(el, nu) {
  const r = (el.q * (1 + el.e)) / (1 + el.e * Math.cos(nu)), u = el.w * D2R + nu, O = el.om * D2R, I = el.i * D2R;
  return [r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(I)), r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(I)), r * Math.sin(u) * Math.sin(I)];
}

/** La parte de la órbita de un cometa a menos de rMax UA del Sol, como puntos eclípticos [[x, y, z]…]. */
export function cometOrbit(el, rMax = 32, n = 160) {
  const Q = el.e < 1 ? (el.q * (1 + el.e)) / (1 - el.e) : Infinity;
  const nuMax = Q <= rMax ? Math.PI : Math.acos(Math.max(-1, Math.min(1, ((el.q * (1 + el.e)) / rMax - 1) / el.e))) * 0.999;
  const out = [];
  for (let k = 0; k <= n; k++) out.push(cometEclAtNu(el, -nuMax + (2 * nuMax * k) / n));
  return out;
}

/**
 * El cometa más brillante de la lista ahora, si se puede ver (magnitud ≤ magLim): { name, el, mag, p (eclíptica),
 * r } o null. at(el) → { r, mag, nu } (cometAt + trueAnomaly de cometSky.js).
 */
export function brightestComet(orbits, at, magLim = 11) {
  let best = null;
  for (const [name, el] of Object.entries(orbits || {})) {
    if (!el || !Number.isFinite(el.q) || !Number.isFinite(el.e)) continue;
    const s = at(el); if (!s || !Number.isFinite(s.mag) || s.mag > magLim) continue;
    if (!best || s.mag < best.mag) best = { name, el, mag: s.mag, r: s.r, p: cometEclAtNu(el, s.nu) };
  }
  return best;
}
