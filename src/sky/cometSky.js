// cometSky.js — la órbita, el brillo y la cola de un cometa, para dibujarlo en el cielo. Puro (sin three.js); se
// prueba en scripts/test_comets.mjs.
//
// Órbita: elementos osculadores de JPL SBDB (public/comet-orbits.json; eclíptica J2000) y el problema de dos cuerpos.
// Vale para DIBUJAR la órbita y para saber hacia dónde queda el Sol; la posición del día en el cielo sigue siendo la de
// Horizons (/api/comets); en otras fechas avanza por esta órbita desde esa posición (moveComets). Marco de salida: ecuatorial J2000 (x → AR 0 h, y → AR 6 h, z → polo norte), en UA.
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

/**
 * La Tierra respecto al Sol (UA, ecuatorial J2000) en el instante `ms`. Fórmula de baja precisión del Sol (Meeus,
 * cap. 25): ~0,01°, de sobra para situar un cometa en el cielo.
 */
export function earthHelio(ms) {
  const T = (jdOf(ms) - 2451545) / 36525, M = (357.52911 + 35999.05029 * T) * R, e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  // longitud del Sol llevada del equinoccio de la fecha al de J2000 (precesión: 1,397° por siglo)
  const lon = (280.46646 + 36000.76983 * T + C - 1.396971 * T) * R, nu = M + C * R, rs = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(nu));
  const x = -rs * Math.cos(lon), y = -rs * Math.sin(lon);
  return [x, y * Math.cos(EPS), y * Math.sin(EPS)];
}

/** Dónde está el cometa visto desde la Tierra en `ms` (dos cuerpos): { dir, delta, r, mag }. */
export function cometAt(el, ms) {
  const h = cometHelio(el, ms), geo = sub(h.p, earthHelio(ms)), delta = Math.hypot(geo[0], geo[1], geo[2]);
  return { dir: unit(geo), delta, r: h.r, mag: cometMag(el, h.r, delta) };
}

// gira `v` con la rotación mínima que lleva `a` a `b` (unitarios)
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rotateLike(a, b, v) {
  const k = cross3(a, b), s = Math.hypot(k[0], k[1], k[2]), c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (s < 1e-12) return v;
  const u = [k[0] / s, k[1] / s, k[2] / s], d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2], w = cross3(u, v);
  return [v[0] * c + w[0] * s + u[0] * d * (1 - c), v[1] * c + w[1] * s + u[1] * d * (1 - c), v[2] * c + w[2] * s + u[2] * d * (1 - c)];
}

const AU_KM = 149597870.7;
/**
 * Los cometas de /api/comets llevados a otra fecha: cada uno avanza por su órbita (dos cuerpos) desde la posición
 * exacta de Horizons, de modo que en la fecha del dato coincide con ella y no hay salto. Devuelve la MISMA lista si
 * la fecha es la del dato (±45 min) o faltan elementos. Lejos de hoy (años) es una aproximación: las órbitas cambian.
 */
export function moveComets(objects, orbits, ms, tolMs = 45 * 60000) {
  if (!objects || !orbits || !Number.isFinite(ms)) return objects;
  let changed = false;
  const out = objects.map((c) => {
    const el = orbits[c.name], ms0 = c.epoch ? Date.parse(c.epoch) : NaN;
    if (!el || !c.dist_au || !Number.isFinite(ms0) || Math.abs(ms - ms0) <= tolMs) return c;
    const k0 = cometAt(el, ms0), k1 = cometAt(el, ms), k2 = cometAt(el, ms + 3600000);
    const dir = unit(rotateLike(k0.dir, unit([c.nx, c.ny, c.nz]), k1.dir)), f = c.dist_au / k0.delta, delta = k1.delta * f;
    if (![dir[0], dir[1], dir[2], delta].every(Number.isFinite)) return c;
    changed = true;
    const ra = ((Math.atan2(dir[1], dir[0]) / R) % 360 + 360) % 360, dec = Math.asin(Math.max(-1, Math.min(1, dir[2]))) / R;
    return { ...c, nx: dir[0], ny: dir[1], nz: dir[2], ra_deg: +ra.toFixed(4), dec_deg: +dec.toFixed(4), dist_au: +delta.toFixed(4), dist_km: Math.round(delta * AU_KM),
      light_min: +((delta * AU_KM) / 299792.458 / 60).toFixed(1), approaching: k2.delta < k1.delta, sun_dist_au: +k1.r.toFixed(4), sun_dist_km: Math.round(k1.r * AU_KM),
      epoch: new Date(ms).toISOString().slice(0, 16) + "Z", moved: true };
  });
  return changed ? out : objects;
}

/** Un cometa «del momento» (sin dato de Horizons) como objeto de la capa: posición de dos cuerpos en `ms`. */
export function cometObject(name, el, ms) {
  const k = cometAt(el, ms), k2 = cometAt(el, ms + 3600000), d = k.dir;
  if (![d[0], d[1], d[2], k.delta].every(Number.isFinite)) return null;
  const ra = ((Math.atan2(d[1], d[0]) / R) % 360 + 360) % 360, dec = Math.asin(Math.max(-1, Math.min(1, d[2]))) / R;
  return { name, nx: d[0], ny: d[1], nz: d[2], ra_deg: +ra.toFixed(4), dec_deg: +dec.toFixed(4), dist_au: +k.delta.toFixed(4), dist_km: Math.round(k.delta * AU_KM),
    light_min: +((k.delta * AU_KM) / 299792.458 / 60).toFixed(1), approaching: k2.delta < k.delta, sun_dist_au: +k.r.toFixed(4), sun_dist_km: Math.round(k.r * AU_KM),
    epoch: new Date(ms).toISOString().slice(0, 16) + "Z", mag: k.mag == null ? null : +k.mag.toFixed(1), extra: true };
}

/**
 * Los cometas de la capa en la fecha `ms`: los de Horizons (movidos si la fecha no es la del dato) más los «del
 * momento» de comet-orbits.json (`extra`), estos solo mientras su brillo previsto supera la magnitud `magLim`.
 */
export function cometsAt(objects, orbits, ms, magLim = 14.5) {
  const base = moveComets(objects, orbits, ms) || [];
  if (!orbits || !Number.isFinite(ms)) return base;
  const have = new Set(base.map((c) => c.name)), add = [];
  for (const [name, el] of Object.entries(orbits)) {
    if (!el.extra || have.has(name)) continue;
    const o = cometObject(name, el, ms); if (o && o.mag != null && o.mag <= magLim) add.push(o);
  }
  return add.length ? [...base, ...add] : base;
}

/** Magnitud de un asteroide o planeta enano (sistema H, G): `r` y `delta` en UA, `alpha` = ángulo de fase (rad). */
export function asteroidMag(H, G, r, delta, alpha) {
  if (H == null) return null;
  const t = Math.tan(Math.min(alpha, 2.9) / 2), p1 = Math.exp(-3.33 * Math.pow(t, 0.63)), p2 = Math.exp(-1.87 * Math.pow(t, 1.22));
  return H + 5 * Math.log10(r * delta) - 2.5 * Math.log10(Math.max(1e-9, (1 - G) * p1 + G * p2));
}

/**
 * Planetas enanos y asteroides (public/minor-bodies.json) en la fecha `ms`: cada objeto con su dirección, distancias,
 * magnitud y si se acerca. Dos cuerpos desde elementos recientes de JPL: bien durante unos años alrededor de hoy.
 */
export function minorObjects(objects, ms) {
  if (!objects || !Number.isFinite(ms)) return [];
  const E = earthHelio(ms), out = [];
  for (const o of objects) {
    if (!o.el) continue;
    const h = cometHelio(o.el, ms), geo = sub(h.p, E), delta = Math.hypot(geo[0], geo[1], geo[2]), d = unit(geo);
    if (![d[0], d[1], d[2], delta].every(Number.isFinite)) continue;
    const re = Math.hypot(E[0], E[1], E[2]), cosA = Math.max(-1, Math.min(1, (h.r * h.r + delta * delta - re * re) / (2 * h.r * delta)));
    const mag = asteroidMag(o.H, o.G == null ? 0.15 : o.G, h.r, delta, Math.acos(cosA)), d2 = cometAt(o.el, ms + 3600000).delta;
    const ra = ((Math.atan2(d[1], d[0]) / R) % 360 + 360) % 360, dec = Math.asin(Math.max(-1, Math.min(1, d[2]))) / R;
    out.push({ ...o, nx: d[0], ny: d[1], nz: d[2], ra_deg: +ra.toFixed(4), dec_deg: +dec.toFixed(4), dist_au: +delta.toFixed(4), dist_km: Math.round(delta * AU_KM),
      light_min: +((delta * AU_KM) / 299792.458 / 60).toFixed(1), approaching: d2 < delta, sun_dist_au: +h.r.toFixed(4), sun_dist_km: Math.round(h.r * AU_KM),
      mag: mag == null ? null : +mag.toFixed(1), epoch: new Date(ms).toISOString().slice(0, 16) + "Z" });
  }
  return out;
}
