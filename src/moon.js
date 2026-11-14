// moon.js — Luna geocéntrica por el método de Paul Schlyter ("How to compute planetary
// positions", https://stjarnhimlen.se/comp/ppcomp.html), con TODAS sus perturbaciones:
// longitud (12 términos), latitud (5) y distancia (2). Módulo común de src/ephemeris.js (el
// Cielo) y de src/special/math.js (¿Y la Luna?): así los dos dan siempre la misma Luna.
// Sin dependencias, determinista. Longitud y latitud: eclíptica de la fecha.
// Validación: scripts/test_special_moonsun.mjs y scripts/test_moon_ephemeris.mjs (JPL Horizons).

/** Radio ecuatorial terrestre (km, WGS 84). Schlyter da la distancia en radios terrestres. */
export const MOON_R_EARTH_KM = 6378.137;

const RAD = Math.PI / 180;
const sind = x => Math.sin(x * RAD), cosd = x => Math.cos(x * RAD);
const atan2d = (y, x) => Math.atan2(y, x) / RAD;
const rev = x => ((x % 360) + 360) % 360;

function kepler(Mdeg, e) {
  const M = rev(Mdeg) * RAD;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 12; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/**
 * @param {number} d días desde 1999-12-31 0h UT (la "day number" de Schlyter)
 * @returns {{lon:number, lat:number, rEr:number, distKm:number, sunLon:number}}
 *   lon (0–360) y lat (°) eclípticas de la fecha, distancia en radios terrestres y en km,
 *   y la longitud eclíptica del Sol (°) de ese mismo instante.
 */
export function moonSchlyter(d) {
  // Sol (para el argumento de las perturbaciones y la elongación)
  const ws = 282.9404 + 4.70935e-5 * d, es = 0.016709 - 1.151e-9 * d, Ms = 356.047 + 0.9856002585 * d;
  const Es = kepler(Ms, es);
  const sunLon = rev(atan2d(Math.sqrt(1 - es * es) * Math.sin(Es), Math.cos(Es) - es) + ws);
  // Luna: elementos medios
  const N = 125.1228 - 0.0529538083 * d, i = 5.1454, w = 318.0634 + 0.1643573223 * d;
  const a = 60.2666, e = 0.0549, Mm = 115.3654 + 13.0649929509 * d;   // a en radios terrestres
  const E = kepler(Mm, e);
  const xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = atan2d(yv, xv), r = Math.hypot(xv, yv), u = v + w;
  const xh = r * (cosd(N) * cosd(u) - sind(N) * sind(u) * cosd(i));
  const yh = r * (sind(N) * cosd(u) + cosd(N) * sind(u) * cosd(i));
  const zh = r * sind(u) * sind(i);
  let lon = atan2d(yh, xh), lat = atan2d(zh, Math.hypot(xh, yh));
  // Perturbaciones (Schlyter)
  const Ls = rev(Ms + ws), Lm = rev(Mm + w + N), D = rev(Lm - Ls), F = rev(Lm - N);
  lon += -1.274 * sind(Mm - 2 * D) + 0.658 * sind(2 * D) - 0.186 * sind(Ms) - 0.059 * sind(2 * Mm - 2 * D)
       - 0.057 * sind(Mm - 2 * D + Ms) + 0.053 * sind(Mm + 2 * D) + 0.046 * sind(2 * D - Ms) + 0.041 * sind(Mm - Ms)
       - 0.035 * sind(D) - 0.031 * sind(Mm + Ms) - 0.015 * sind(2 * F - 2 * D) + 0.011 * sind(Mm - 4 * D);
  lat += -0.173 * sind(F - 2 * D) - 0.055 * sind(Mm - F - 2 * D) - 0.046 * sind(Mm + F - 2 * D)
       + 0.033 * sind(F + 2 * D) + 0.017 * sind(2 * Mm + F);
  const rEr = r - 0.58 * cosd(Mm - 2 * D) - 0.46 * cosd(2 * D);
  return { lon: rev(lon), lat, rEr, distKm: rEr * MOON_R_EARTH_KM, sunLon };
}
