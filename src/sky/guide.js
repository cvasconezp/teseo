// guide.js — matemática pura (sin DOM ni three) para "Esta noche" y la flecha guía:
// coordenadas locales (altitud/azimut), separación angular, hacia dónde girar el
// teléfono, coordenadas galácticas y búsqueda de la hora de salida de un astro.
//
// Marco local de Teseo: +X = Este, +Y = cenit, −Z = Norte.
// Azimut: 0 = N, 90 = E (sentido horario visto desde arriba). Altitud: 90 = cenit.
import { wrap360, angleDiff } from "./deviceOrientation.js";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

/** Tiempo sidéreo medio de Greenwich (radianes). Misma fórmula que la vista 3D. */
export function gmstRad(date) {
  const T = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  let g = (280.46061837 + 360.98564736629 * T) % 360;
  if (g < 0) g += 360;
  return g * D2R;
}

/**
 * Dirección ecuatorial unitaria (nx, ny, nz) → vector local [este, arriba, −norte]
 * para una latitud/longitud (grados) y un instante.
 */
export function eqToLocal(nx, ny, nz, latDeg, lonDeg, date, out = [0, 0, 0]) {
  const phi = latDeg * D2R, lst = gmstRad(date) + lonDeg * D2R;
  const cp = Math.cos(phi), sp = Math.sin(phi), cl = Math.cos(lst), sl = Math.sin(lst);
  // cenit, norte y este expresados en ecuatoriales
  const ux = cp * cl, uy = cp * sl, uz = sp;
  let nxx = -sp * ux, nyy = -sp * uy, nzz = 1 - sp * uz;          // polo norte celeste menos su parte vertical
  const nl = Math.hypot(nxx, nyy, nzz);
  if (nl < 1e-6) { nxx = 1; nyy = 0; nzz = 0; } else { nxx /= nl; nyy /= nl; nzz /= nl; }
  const ex = nyy * uz - nzz * uy, ey = nzz * ux - nxx * uz, ez = nxx * uy - nyy * ux;   // este = norte × cenit
  out[0] = nx * ex + ny * ey + nz * ez;
  out[1] = nx * ux + ny * uy + nz * uz;
  out[2] = -(nx * nxx + ny * nyy + nz * nzz);
  return out;
}

/** Altitud y azimut (grados) de un vector local unitario [x, y, z]. */
export function altAzOfLocal(x, y, z) {
  return { alt: Math.asin(clamp1(y)) * R2D, az: wrap360(Math.atan2(x, -z) * R2D) };
}

/** Altitud/azimut de una dirección ecuatorial vista desde un lugar y un instante. */
export function altAz(nx, ny, nz, latDeg, lonDeg, date) {
  const v = eqToLocal(nx, ny, nz, latDeg, lonDeg, date);
  return altAzOfLocal(v[0], v[1], v[2]);
}

/** ¿Está sobre el horizonte? `min` = altitud mínima útil en grados. */
export function isAboveHorizon(alt, min = 0) {
  return Number.isFinite(alt) && alt > min;
}

/** Separación angular (grados) entre dos direcciones dadas en altitud/azimut. */
export function angularSep(alt1, az1, alt2, az2) {
  const a1 = alt1 * D2R, a2 = alt2 * D2R, dz = (az1 - az2) * D2R;
  return Math.acos(clamp1(Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(dz))) * R2D;
}

/**
 * Flecha guía: dónde queda el objetivo respecto a la mirada de la cámara.
 * (qx,qy,qz,qw) = orientación de la cámara en el marco local; (tx,ty,tz) = objetivo
 * unitario en el mismo marco. Devuelve
 *   sep   separación angular mirada↔objetivo (0 = centrado)
 *   ang   hacia dónde apunta la flecha en pantalla: 0 = arriba, 90 = derecha (horario)
 *   cx,cy componentes del objetivo en los ejes derecha/arriba de la pantalla
 */
export function guideArrow(qx, qy, qz, qw, tx, ty, tz, out = {}) {
  // ejes de la cámara en el marco local: derecha = q·(1,0,0), arriba = q·(0,1,0), adelante = q·(0,0,−1)
  const rx = 1 - 2 * (qy * qy + qz * qz), ry = 2 * (qx * qy + qw * qz), rz = 2 * (qx * qz - qw * qy);
  const ux = 2 * (qx * qy - qw * qz), uy = 1 - 2 * (qx * qx + qz * qz), uz = 2 * (qy * qz + qw * qx);
  const fx = -2 * (qx * qz + qw * qy), fy = -2 * (qy * qz - qw * qx), fz = -(1 - 2 * (qx * qx + qy * qy));
  const cx = tx * rx + ty * ry + tz * rz, cy = tx * ux + ty * uy + tz * uz, cf = tx * fx + ty * fy + tz * fz;
  out.sep = Math.acos(clamp1(cf)) * R2D;
  out.cx = cx; out.cy = cy;
  // justo detrás (o justo delante) la dirección en pantalla no está definida: se indica "arriba"
  out.ang = Math.hypot(cx, cy) > 1e-6 ? wrap360(Math.atan2(cx, cy) * R2D) : 0;
  return out;
}

/**
 * Instrucción en lenguaje humano: cuántos grados girar (dAz > 0 = a la derecha)
 * y cuántos subir (dAlt > 0) para pasar de la mirada actual al objetivo.
 */
export function turnHint(lookAlt, lookAz, tgtAlt, tgtAz) {
  return { dAz: angleDiff(tgtAz, lookAz), dAlt: tgtAlt - lookAlt };
}

// ── Coordenadas galácticas (J2000) ───────────────────────────────────────
const dirOf = (raDeg, decDeg) => [Math.cos(decDeg * D2R) * Math.cos(raDeg * D2R), Math.cos(decDeg * D2R) * Math.sin(raDeg * D2R), Math.sin(decDeg * D2R)];
export const GAL_POLE = dirOf(192.85948, 27.12825);       // polo norte galáctico
export const GAL_CENTER = dirOf(266.40499, -28.93617);    // centro de la Vía Láctea (Sgr A*)
const GAL_Y = [                                            // l = 90°, b = 0 (polo × centro)
  GAL_POLE[1] * GAL_CENTER[2] - GAL_POLE[2] * GAL_CENTER[1],
  GAL_POLE[2] * GAL_CENTER[0] - GAL_POLE[0] * GAL_CENTER[2],
  GAL_POLE[0] * GAL_CENTER[1] - GAL_POLE[1] * GAL_CENTER[0],
];

/** Latitud galáctica (grados) de una dirección ecuatorial: 0 = plano de la Vía Láctea. */
export function galLat(nx, ny, nz) {
  return Math.asin(clamp1(nx * GAL_POLE[0] + ny * GAL_POLE[1] + nz * GAL_POLE[2])) * R2D;
}
/** Dirección ecuatorial unitaria de un punto de coordenadas galácticas (l, b) en grados. */
export function galToEq(lDeg, bDeg) {
  const cl = Math.cos(lDeg * D2R), sl = Math.sin(lDeg * D2R), cb = Math.cos(bDeg * D2R), sb = Math.sin(bDeg * D2R);
  return [0, 1, 2].map((i) => cb * (cl * GAL_CENTER[i] + sl * GAL_Y[i]) + sb * GAL_POLE[i]);
}
/** Separación angular (grados) entre dos direcciones unitarias. */
export function sepDirs(ax, ay, az, bx, by, bz) {
  return Math.acos(clamp1(ax * bx + ay * by + az * bz)) * R2D;
}

/**
 * Próxima salida sobre el horizonte. `dirAt(date)` devuelve [nx, ny, nz] del astro en
 * ese instante (fijo para una estrella, variable para la Luna). Busca a pasos de
 * `stepMin` minutos hasta `maxHours` y afina por interpolación lineal.
 * Devuelve { date, az } o null si no sale en ese intervalo (o ya está arriba).
 */
export function nextRise(dirAt, latDeg, lonDeg, from, maxHours = 14, stepMin = 10, minAlt = 0) {
  const altAt = (ms) => { const d = new Date(ms); const v = dirAt(d); return altAz(v[0], v[1], v[2], latDeg, lonDeg, d); };
  let t0 = from.getTime(), a0 = altAt(t0).alt;
  if (a0 > minAlt) return null;
  const step = stepMin * 60000, end = t0 + maxHours * 3600000;
  for (let t1 = t0 + step; t1 <= end; t1 += step) {
    const p = altAt(t1);
    if (p.alt > minAlt) {
      const f = (minAlt - a0) / (p.alt - a0 || 1e-9);
      const ms = t0 + f * step;
      return { date: new Date(ms), az: altAt(ms).az };
    }
    t0 = t1; a0 = p.alt;
  }
  return null;
}
