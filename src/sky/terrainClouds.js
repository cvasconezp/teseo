// terrainClouds.js — qué parte del relieve queda DENTRO de las nubes (para que el relieve cercano, terrain3d.js, la
// tape con el gris de la nube y deje ver lo demás).
//
// Antes, las nubes tapaban las montañas por la distancia: si la mirada entraba en la base de una capa antes de llegar
// al filo, el filo quedaba detrás de la nube, fuera cual fuera su altura, y el satélite se leía donde la mirada entra
// en la capa, no sobre la montaña. Con un manto medio sobre Cayambe se borraban el Mojanda (1,4 km sobre el valle) y
// el Cayambe por igual, cuando a la vista solo el Cayambe tenía la cumbre en la nube. Ahora:
//   1. Por altura: cada capa tiene una base (sobre el mar). Lo que queda por debajo de la base se ve, solo con la bruma
//      del aire; lo que la supera se va tapando poco a poco, empezando 400 m por debajo de la base calculada (la base
//      es una estimación y las cumbres altas fabrican su propia nube) y del todo 100 m por encima.
//   2. Por satélite: si hay barrido reciente, la nube cuenta donde el satélite la ve, en la celda de esa ladera (y en
//      la de donde la mirada entra en la capa); sin él, la cobertura del pronóstico, en manchas.
// Bases: las bajas, la calculada por la temperatura y el punto de rocío (cloudBaseKm, weather.js); las medias, que el
// satélite y Open-Meteo definen por su TOPE entre 3 y 8 km sobre el suelo, desde 2 km sobre el suelo (o 1 km sobre las
// bajas): una nube con el tope a 3 km tiene la base bastante más abajo, y la que se pega a una cumbre alta (la del
// Cayambe, 2,9 km sobre el valle) cuenta como media. Las altas (desde 8 km) no llegan a ninguna montaña.
//
// Puro; se prueba en scripts/test_weather.mjs. El sombreador (terrain3d.js) repite inCloud() en la GPU, con manchas.

/** Base de las nubes medias para el relieve (km sobre el suelo del pronóstico) y separación mínima sobre las bajas. */
export const MID_BASE_KM = 2, MID_OVER_LOW_KM = 1;
/** Sin base calculada, la de las bajas (km sobre el suelo), como en cloudsLayer.js. */
export const LOW_BASE_DEFAULT_KM = 1.5;
/** La transición (m): empieza 400 m por debajo de la base y se completa 100 m por encima. */
export const FADE_BELOW_M = 400, FADE_ABOVE_M = 100;
/** Cuánto tapa cada capa dentro de ella: una nube baja es casi opaca; una media deja adivinar la silueta. */
export const OPACITY = { low: 0.93, mid: 0.85 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Bases de las capas bajas y medias (m sobre el mar), con el suelo del pronóstico refM (m) y la base calculada (km). */
export function cloudBasesM(baseKm, refM) {
  const low = Number.isFinite(baseKm) ? baseKm : LOW_BASE_DEFAULT_KM, g = Number.isFinite(refM) ? refM : 0;
  return { low: g + low * 1000, mid: g + Math.max(MID_BASE_KM, low + MID_OVER_LOW_KM) * 1000 };
}

/** Cuánto de una altura hM (m) queda dentro de una capa con base baseM (m): 0 debajo, 1 dentro. */
export function heightIn(hM, baseM) {
  return sstep(baseM - FADE_BELOW_M, baseM + FADE_ABOVE_M, hM);
}

/**
 * Parámetros para el relieve: clouds = las nubes del instante (mergeClouds), sat = la vista del satélite (fuseSat) o
 * null, w = su peso (satWeight), off = mapOffsets(...), refM = suelo del pronóstico (m). Devuelve null sin nubes que
 * puedan tocar el relieve; si no, { baseL, baseM (m), covL, covM (0–1, las del pronóstico), w, sat: { n, half, tex
 * (bytes RGBA: R baja, G media en %·2,55; A = 255 con dato), key } o null, offL, offM (km este, norte) }.
 */
export function terrainClouds({ clouds, sat = null, w = 0, off = null, refM = null, onL = null, onM = null } = {}) {
  if (!clouds || !Number.isFinite(refM)) return null;
  const covL = clamp01(clouds.low || 0), covM = clamp01(clouds.mid || 0);
  const useSat = !!(sat && sat.layers && w > 0);
  if (covL < 0.01 && covM < 0.01 && !useSat) return null;
  const b = cloudBasesM(clouds.baseKm, refM), o = off || [[0, 0], [0, 0], [0, 0]];
  // (onL, onM: si cloudsLayer dibuja esa capa por encima de los ojos —layerParams(...).h > 0—; si queda debajo, el mar
  // de nubes es suyo y aquí no cuenta. Con null se decide por la altura de los ojos)
  return { onL, onM, baseL: b.low, baseM: b.mid, covL, covM, w: useSat ? clamp01(w) : 0, sat: useSat ? satTexture(sat) : null,
    offL: [o[0][0], o[0][1]], offM: [o[1][0], o[1][1]] };
}

/** La malla del satélite como textura (se recuerda por barrido y mezcla con el pronóstico). */
export function satTexture(sat) {
  const key = sat.key || `${sat.t}`;
  if (sat._terr && sat._terr.key === key) return sat._terr;
  const n = sat.n, tex = new Uint8Array(n * n * 4), L = sat.layers.low, M = sat.layers.mid;
  for (let i = 0; i < n * n; i++) {
    if (L[i] === 255 || M[i] === 255) continue;          // sin dato: A = 0 (manda el pronóstico)
    tex[i * 4] = Math.round(L[i] * 2.55); tex[i * 4 + 1] = Math.round(M[i] * 2.55); tex[i * 4 + 3] = 255;
  }
  sat._terr = { n, half: sat.half, tex, key };
  return sat._terr;
}

/** Cobertura de una capa (0 baja, 1 media) en el punto (e, n) km según el satélite, o null fuera de la malla / sin dato. */
export function satCoverAt(s, k, e, n, off = [0, 0]) {
  if (!s) return null;
  const u = (e - off[0] + s.half) / (2 * s.half), v = (n - off[1] + s.half) / (2 * s.half);
  if (u <= 0 || v <= 0 || u >= 1 || v >= 1) return null;
  const c = Math.min(s.n - 1, Math.floor(u * s.n)), r = Math.min(s.n - 1, Math.floor(v * s.n)), i = (r * s.n + c) * 4;
  return s.tex[i + 3] ? s.tex[i + k] / 255 : null;
}

/**
 * Cuánto tapa la nube (0–1, sin las manchas del ruido) un punto del relieve a hM m de altura, en (e, n) km respecto
 * a quien mira, que está a obsM m. Cada capa cuenta su cobertura en el punto y donde la mirada entra en ella (la mayor).
 * Una capa por debajo de los ojos no cuenta aquí (desde una cumbre, el mar de nubes lo dibuja cloudsLayer).
 */
export function inCloud(p, hM, e, n, obsM) {
  if (!p) return 0;
  let clear = 1;
  for (const [k, base, fc, op, off] of [[0, p.baseL, p.covL, OPACITY.low, p.offL], [1, p.baseM, p.covM, OPACITY.mid, p.offM]]) {
    if ((k === 0 ? p.onL : p.onM) === false || ((k === 0 ? p.onL : p.onM) == null && obsM > base - 50)) continue;
    const lo = Math.max(base - FADE_BELOW_M, obsM + 100), hf = sstep(lo, Math.max(lo + 100, base + FADE_ABOVE_M), hM);
    if (!(hf > 0)) continue;
    const f = clamp01((lo - obsM) / Math.max(1, hM - obsM));
    const at = (ee, nn) => { const s = satCoverAt(p.sat, k, ee, nn, off); return s == null ? fc : fc + (s - fc) * p.w; };
    const c = Math.max(at(e, n), at(e * f, n * f));
    clear *= 1 - op * hf * c;
  }
  return 1 - clear;
}
