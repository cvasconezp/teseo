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
