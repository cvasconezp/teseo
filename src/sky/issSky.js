// issSky.js — la ISS en el cielo: dónde está en cada instante de una pasada.
// Funciones puras (sin DOM, sin React, sin red) para que la vista Cielo dibuje la ISS y su trayectoria.
//
// Entrada: una pasada de /api/iss/passes (con `track`: puntos { t, alt, az, lit } cada ~10 s, desde el
// instante en que cruza 10° hasta que baja de 10°; ver backend/app/iss.py). Entre dos puntos se interpola
// sobre la ESFERA (arco de círculo máximo, «slerp»), no linealmente en altura/azimut: así una pasada que
// cruza cerca del cenit (donde el azimut gira a toda velocidad) no da saltos ni atajos absurdos.
//
// Marcos:
//   · altura/azimut: grados, azimut desde el norte hacia el este (como el backend);
//   · «local»: [este, arriba, −norte], el mismo vector local que usan eqToLocal / altAzOfLocal de guide.js;
//   · ecuatorial: [nx, ny, nz] (ascensión recta/declinación), el de las efemérides de Teseo.
import { altAzOfLocal, eqToLocal } from "./guide.js";

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/** altura/azimut (°) → vector unitario [este, norte, arriba]. */
export function altAzToENU(alt, az) {
  const a = alt * D2R, z = az * D2R;
  return [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];
}
/** vector [este, norte, arriba] → { alt, az } en grados (az en [0, 360)). */
export function enuToAltAz(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return { alt: Math.asin(Math.max(-1, Math.min(1, v[2] / n))) * R2D, az: ((Math.atan2(v[0], v[1]) * R2D) % 360 + 360) % 360 };
}
/** altura/azimut (°) → vector local [este, arriba, −norte] (el de guide.js / la escena del Cielo). */
export function altAzToLocal(alt, az) {
  const [e, n, u] = altAzToENU(alt, az);
  return [e, u, -n];
}
/** altura/azimut (°) visto desde (lat, lon) en `date` → dirección ecuatorial unitaria [nx, ny, nz]
 *  (inversa exacta de altAz() de guide.js: la rotación inversa es la traspuesta). */
export function altAzToEquatorial(alt, az, latDeg, lonDeg, date) {
  const l = altAzToLocal(alt, az);
  const out = [0, 0, 0];
  const basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let j = 0; j < 3; j++) {
    const c = eqToLocal(basis[j][0], basis[j][1], basis[j][2], latDeg, lonDeg, date);
    out[j] = c[0] * l[0] + c[1] * l[1] + c[2] * l[2];
  }
  return out;
}

/** Interpolación esférica entre dos vectores unitarios (f de 0 a 1). */
export function slerp(a, b, f) {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const th = Math.acos(dot);
  if (th < 1e-9) return [a[0], a[1], a[2]];
  const s = Math.sin(th), k0 = Math.sin((1 - f) * th) / s, k1 = Math.sin(f * th) / s;
  return [k0 * a[0] + k1 * b[0], k0 * a[1] + k1 * b[1], k0 * a[2] + k1 * b[2]];
}

// puntos de la trayectoria con tiempo en ms y vector, cacheados en el propio objeto (WeakMap)
const prepared = new WeakMap();
function prep(pass) {
  let p = prepared.get(pass);
  if (p) return p;
  const pts = (pass && pass.track) || [];
  p = {
    t: pts.map((q) => Date.parse(q.t)),
    v: pts.map((q) => altAzToENU(q.alt, q.az)),
    lit: pts.map((q) => q.lit !== false),
  };
  prepared.set(pass, p);
  return p;
}

/** Instantes (ms) entre los que la trayectoria está definida: [inicio, fin], o null si no hay puntos. */
export function passSpan(pass) {
  const p = prep(pass);
  return p.t.length ? [p.t[0], p.t[p.t.length - 1]] : null;
}

/**
 * Posición de la ISS en el instante `tMs` (ms Unix) de la pasada.
 * Devuelve { alt, az, tMs, state, lit, visible, enu, local } o null si no hay trayectoria.
 *   state    "before" | "during" | "after" (antes de cruzar los 10°, durante, después)
 *   lit      ¿ilumina el Sol a la ISS (fuera de la sombra de la Tierra)?
 *   visible  ¿se ve a simple vista en este instante? (dentro del tramo visible de la pasada)
 * Fuera de la pasada, con `clamp` (por defecto sí) devuelve el extremo más cercano; con clamp:false, null.
 */
export function issPositionAt(pass, tMs, { clamp = true } = {}) {
  const p = prep(pass);
  const n = p.t.length;
  if (!n) return null;
  const state = tMs < p.t[0] ? "before" : tMs > p.t[n - 1] ? "after" : "during";
  if (state !== "during" && !clamp) return null;
  const t = Math.max(p.t[0], Math.min(p.t[n - 1], tMs));
  // búsqueda binaria del tramo [i, i+1] que contiene t
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (p.t[mid] <= t) lo = mid; else hi = mid; }
  const i = n === 1 ? 0 : lo, j = n === 1 ? 0 : hi;
  const span = p.t[j] - p.t[i];
  const f = span > 0 ? (t - p.t[i]) / span : 0;
  const enu = slerp(p.v[i], p.v[j], f);
  const { alt, az } = enuToAltAz(enu);
  const vf = pass.visible && pass.visible_from ? Date.parse(pass.visible_from.t) : null;
  const vt = pass.visible && pass.visible_to ? Date.parse(pass.visible_to.t) : null;
  return {
    alt, az, tMs: t, state,
    lit: f < 0.5 ? p.lit[i] : p.lit[j],
    visible: vf != null && vt != null && tMs >= vf && tMs <= vt,
    enu,
    local: [enu[0], enu[2], -enu[1]],
  };
}

/** La trayectoria para dibujarla: puntos { tMs, alt, az, lit, local } cada `stepS` segundos (0 = los del servidor). */
export function issTrack(pass, stepS = 0) {
  const p = prep(pass);
  const n = p.t.length;
  if (!n) return [];
  const make = (t) => { const q = issPositionAt(pass, t); return { tMs: q.tMs, alt: q.alt, az: q.az, lit: q.lit, local: q.local }; };
  if (!(stepS > 0)) return p.t.map((t) => make(t));
  const out = [];
  for (let t = p.t[0]; t < p.t[n - 1]; t += stepS * 1000) out.push(make(t));
  out.push(make(p.t[n - 1]));
  return out;
}

/** La trayectoria troceada en tramos de luz y sombra [{ lit, points }] (para dibujar la parte
 *  iluminada con trazo fuerte y la que está en la sombra de la Tierra con trazo tenue). */
export function issSegments(pass) {
  const pts = issTrack(pass);
  const segs = [];
  for (const q of pts) {
    const last = segs[segs.length - 1];
    if (last && last.lit === q.lit) last.points.push(q);
    else {
      // el nuevo tramo empieza en el último punto del anterior, para que no queden huecos
      segs.push({ lit: q.lit, points: last ? [last.points[last.points.length - 1], q] : [q] });
    }
  }
  return segs;
}

/** Dirección «local» de la ISS en `tMs` en forma de ángulos de guide.js (útil para etiquetas). */
export function issAltAzLocal(pass, tMs) {
  const q = issPositionAt(pass, tMs);
  return q ? altAzOfLocal(q.local[0], q.local[1], q.local[2]) : null;
}
