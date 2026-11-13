// geomag.js — declinación magnética con el World Magnetic Model (WMM2025, NOAA/NCEI
// y BGS). Módulo puro: sin DOM ni three. Se usa en "Apuntar al cielo" para pasar
// del norte magnético (lo que da la brújula del teléfono) al norte geográfico (el
// del mapa del cielo).
//
// Es el desarrollo en armónicos esféricos de grado 12 del informe técnico del WMM:
// coordenadas geodésicas WGS84 → geocéntricas, funciones asociadas de Legendre
// seminormalizadas de Schmidt, campo en ejes geocéntricos y giro a ejes geodésicos.
// scripts/test_sky_geomag.mjs comprueba que reproduce los 100 valores de prueba
// oficiales (WMM2025_TestValues.txt).
import { WMM_COEFFS, WMM_EPOCH, WMM_VALID_UNTIL, WMM_NAME } from "./wmm2025.js";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const WGS84_A = 6378.137;                  // km, semieje mayor
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const REF_R = 6371.2;                      // km, radio de referencia geomagnético
const NMAX = 12;
const idx = (n, m) => n * (n + 1) / 2 + m;

// tablas g, h y sus variaciones seculares indexadas por (n, m)
const SIZE = idx(NMAX, NMAX) + 1;
const G = new Float64Array(SIZE), H = new Float64Array(SIZE), DG = new Float64Array(SIZE), DH = new Float64Array(SIZE);
for (const [n, m, g, h, dg, dh] of WMM_COEFFS) { const k = idx(n, m); G[k] = g; H[k] = h; DG[k] = dg; DH[k] = dh; }

/** Fecha → año decimal (2026-07-02 ≈ 2026.5), en UTC. */
export function decimalYear(date) {
  const y = date.getUTCFullYear();
  const t0 = Date.UTC(y, 0, 1), t1 = Date.UTC(y + 1, 0, 1);
  return y + (date.getTime() - t0) / (t1 - t0);
}

/**
 * Campo magnético principal en un punto.
 * @param {number} latDeg   latitud geodésica (grados, norte +)
 * @param {number} lonDeg   longitud (grados, este +)
 * @param {number} altKm    altura sobre el elipsoide WGS84 (km)
 * @param {number} year     año decimal
 * @returns {{x:number,y:number,z:number,h:number,f:number,decl:number,incl:number}}
 *   x norte, y este, z abajo (nT); decl = declinación (grados, este +); incl = inclinación.
 */
export function magneticField(latDeg, lonDeg, altKm = 0, year = WMM_EPOCH) {
  const phi = latDeg * D2R, lam = lonDeg * D2R;
  const sphi = Math.sin(phi), cphi = Math.cos(phi);
  // geodésicas → geocéntricas
  const rc = WGS84_A / Math.sqrt(1 - WGS84_E2 * sphi * sphi);
  const p = (rc + altKm) * cphi, zz = (rc * (1 - WGS84_E2) + altKm) * sphi;
  const r = Math.hypot(p, zz);
  const phiC = Math.asin(zz / r);
  const ct = Math.sin(phiC), st = Math.cos(phiC);        // cos y sen de la colatitud geocéntrica

  // Legendre seminormalizadas de Schmidt y su derivada respecto a la colatitud
  const P = new Float64Array(SIZE), dP = new Float64Array(SIZE);
  P[0] = 1; dP[0] = 0;
  for (let n = 1; n <= NMAX; n++) {
    for (let m = 0; m <= n; m++) {
      const k = idx(n, m);
      if (n === m) {
        const k1 = idx(n - 1, n - 1), c = n === 1 ? 1 : Math.sqrt((2 * n - 1) / (2 * n));
        P[k] = c * st * P[k1];
        dP[k] = c * (st * dP[k1] + ct * P[k1]);
      } else {
        const k1 = idx(n - 1, m), den = Math.sqrt(n * n - m * m);
        let a = (2 * n - 1) * ct * P[k1], b = (2 * n - 1) * (ct * dP[k1] - st * P[k1]);
        if (n - 2 >= m) { const k2 = idx(n - 2, m), q = Math.sqrt((n - 1) * (n - 1) - m * m); a -= q * P[k2]; b -= q * dP[k2]; }
        P[k] = a / den; dP[k] = b / den;
      }
    }
  }
  const dt = year - WMM_EPOCH;
  let xc = 0, yc = 0, zc = 0;
  const ratio = REF_R / r;
  let rn = ratio * ratio;                                 // (a/r)^(n+2)
  for (let n = 1; n <= NMAX; n++) {
    rn *= ratio;
    let sx = 0, sy = 0, sz = 0;
    for (let m = 0; m <= n; m++) {
      const k = idx(n, m);
      const g = G[k] + dt * DG[k], h = H[k] + dt * DH[k];
      const cm = Math.cos(m * lam), sm = Math.sin(m * lam);
      const a = g * cm + h * sm;
      sx += a * dP[k];
      sy += m * (g * sm - h * cm) * P[k];
      sz += a * P[k];
    }
    xc += rn * sx; yc += rn * sy; zc -= (n + 1) * rn * sz;
  }
  // en el polo geográfico exacto la componente este no está definida (st = 0)
  yc = st > 1e-10 ? yc / st : 0;
  // de ejes geocéntricos a geodésicos
  const d = phiC - phi, cd = Math.cos(d), sd = Math.sin(d);
  const x = xc * cd - zc * sd, y = yc, z = xc * sd + zc * cd;
  const hh = Math.hypot(x, y);
  return { x, y, z, h: hh, f: Math.hypot(hh, z), decl: Math.atan2(y, x) * R2D, incl: Math.atan2(z, hh) * R2D };
}

/**
 * Declinación magnética (grados; positiva = el norte magnético queda al ESTE del
 * geográfico) para un lugar y una fecha. Devuelve también si la fecha cae dentro
 * del periodo de validez del modelo y si la brújula es fiable ahí: el WMM define
 * zonas de "precaución" (H < 6000 nT) y "sin fiabilidad" (H < 2000 nT) cerca de
 * los polos magnéticos.
 */
export function declination(latDeg, lonDeg, date = new Date(), altKm = 0) {
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return null;
  const year = decimalYear(date);
  const f = magneticField(latDeg, lonDeg, altKm, year);
  return { decl: f.decl, valid: year >= WMM_EPOCH && year < WMM_VALID_UNTIL, zone: f.h < 2000 ? "blackout" : f.h < 6000 ? "caution" : "ok", model: WMM_NAME, year };
}

/** Rumbo geográfico (0 = norte verdadero, horario) a partir del rumbo magnético. */
export function trueHeading(magneticHeading, declDeg) {
  const a = (magneticHeading + declDeg) % 360;
  return a < 0 ? a + 360 : a;
}
