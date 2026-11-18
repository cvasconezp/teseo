// cometSky.js — la órbita, el brillo y la cola de un cometa, para dibujarlo en el cielo. Puro (sin three.js); se
// prueba en scripts/test_comets.mjs.
//
// Órbita: elementos osculadores de JPL SBDB (public/comet-orbits.json; eclíptica J2000) y el problema de dos cuerpos.
// Vale para DIBUJAR la órbita y para saber hacia dónde queda el Sol; la posición del día en el cielo sigue siendo la de
// Horizons (/api/comets). Marco de salida: ecuatorial J2000 (x → AR 0 h, y → AR 6 h, z → polo norte), en UA.
const R = Math.PI / 180, K = 0.01720209895;          // constante de Gauss (UA^1,5 / día)
const EPS = 23.4392911 * R;                           // oblicuidad J2000

export const jdOf = (ms) => ms / 86400000 + 2440587.5;

/** Anomalía verdadera (rad) y distancia al Sol (UA) a `dt` días del perihelio, para cualquier excentricidad. */
export function trueAnomaly(q, e, dt) {
  if (Math.abs(e - 1) < 1e-3) {
    // parabólica (ecuación de Barker: s + s³/3 = k·dt / (√2·q^1,5), con s = tan(ν/2))
    const W = (1.5 * K * dt) / (Math.SQRT2 * Math.pow(q, 1.5)), Y = Math.cbrt(W + Math.sqrt(W * W + 1)), s = Y - 1 / Y;
    return { nu: 2 * Math.atan(s), r: q * (1 + s * s) };
  }
  if (e < 1) {
    const a = q / (1 - e), n = K / Math.pow(a, 1.5);
    const M = ((n * dt + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    // bisección (la función es monótona) y remate con Newton: no falla con excentricidades cercanas a 1
    let lo = -Math.PI, hi = Math.PI, E = M;
    for (let i = 0; i < 50; i++) { E = (lo + hi) / 2; if (E - e * Math.sin(E) - M > 0) hi = E; else lo = E; }
    for (let i = 0; i < 4; i++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); if (Number.isFinite(d)) E -= d; }
    return { nu: 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)), r: a * (1 - e * Math.cos(E)) };
  }
  const a = q / (e - 1), M = (K / Math.pow(a, 1.5)) * dt;
  let H = Math.asinh(M / e);
  for (let i = 0; i < 60; i++) { const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1); H -= d; if (Math.abs(d) < 1e-13) break; }
  return { nu: 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2)), r: a * (e * Math.cosh(H) - 1) };
}

/** Posición heliocéntrica (UA, ecuatorial J2000) con anomalía verdadera `nu`. */
export function posAtNu(el, nu) {
  const r = (el.q * (1 + el.e)) / (1 + el.e * Math.cos(nu)), u = el.w * R + nu, O = el.om * R, i = el.i * R;
  const x = r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i));
  const y = r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i));
  const z = r * Math.sin(u) * Math.sin(i);
  return [x, y * Math.cos(EPS) - z * Math.sin(EPS), y * Math.sin(EPS) + z * Math.cos(EPS)];
}

/** Posición heliocéntrica (UA, ecuatorial J2000) y anomalía verdadera en el instante `ms`. */
export function cometHelio(el, ms) {
  const { nu, r } = trueAnomaly(el.q, el.e, jdOf(ms) - el.tp);
  return { p: posAtNu(el, nu), nu, r };
}

/** Magnitud total estimada: m = M1 + 5·log Δ + K1·log r (null si faltan M1 o K1). */
export const cometMag = (el, r, delta) => (el && el.M1 != null && el.K1 != null ? el.M1 + 5 * Math.log10(delta) + el.K1 * Math.log10(r) : null);

/**
 * La cola (ESTIMADA): largo en UA y opacidad 0–1. Un cometa solo desarrolla cola cerca del Sol (aquí, a menos de 4 UA);
 * el largo crece al acercarse (∝ 1/r², hasta 0,5 UA) y la opacidad sigue a la magnitud total (tenue desde la 12).
 */
export function tailModel(r, mag) {
  if (!(r < 4)) return { len: 0, alpha: 0 };
  const len = Math.min(0.5, 0.12 / (r * r)) * Math.min(1, (4 - r) / 1.5);
  const alpha = mag == null ? 0.4 : Math.min(1, Math.max(0.12, (14 - mag) / 8));
  return { len, alpha };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

/**
 * Todo lo que hace falta para dibujar un cometa: `dir` = dirección en el cielo (unitaria), `delta` = distancia a la
 * Tierra (UA), `ms` = instante de esa posición. Devuelve { r, mag, tail: { len, alpha, end }, earth, orbit } donde
 * `tail.end` es la dirección (unitaria) de la punta de la cola: la cola apunta en sentido contrario al Sol, visto
 * desde la Tierra; `orbit` son direcciones de puntos de su órbita vistos desde la Tierra de ese momento.
 */
export function cometView(el, dir, delta, ms, { orbitPts = 240, rMax = 45 } = {}) {
  const h = cometHelio(el, ms), geo = [dir[0] * delta, dir[1] * delta, dir[2] * delta];
  const earth = sub(h.p, geo);                                  // la Tierra respecto al Sol (UA)
  const mag = cometMag(el, h.r, delta), t = tailModel(h.r, mag);
  const end = t.len > 0 ? unit(add(geo, unit(h.p), t.len)) : null;
  // la órbita: toda la elipse si cabe dentro de rMax; si no, el tramo cercano al Sol
  const cosLim = Math.max(-1, Math.min(1, ((el.q * (1 + el.e)) / rMax - 1) / el.e)), nuMax = el.e < 1 && (el.q * (1 + el.e)) / (1 - el.e) <= rMax ? Math.PI : Math.acos(cosLim) * 0.999;
  const orbit = [];
  for (let i = 0; i <= orbitPts; i++) { const nu = -nuMax + (2 * nuMax * i) / orbitPts; orbit.push(unit(sub(posAtNu(el, nu), earth))); }
  return { r: h.r, nu: h.nu, mag, tail: { ...t, end }, earth, orbit, closed: nuMax === Math.PI };
}
