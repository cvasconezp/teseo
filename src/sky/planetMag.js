// planetMag.js — magnitud aparente V de los planetas vistos desde la Tierra (geocéntrica).
// PURO: sin DOM ni three. Pruebas: node scripts/test_sky_planetmag.mjs (contra JPL Horizons).
//
// FUENTE (verificada en el artículo): Mallama, A. y Hilton, J. L. (2018). "Computing apparent planetary
// magnitudes for The Astronomical Almanac". Astronomy and Computing 25, 10–24 (arXiv:1808.01973).
// Ecuaciones (α = ángulo de fase en grados, r y d = distancias al Sol y a la Tierra en UA):
//   Mercurio  Ec. 2 (polinomio de 6.º grado; α del intervalo observado, ~2°–170°)
//   Venus     Ec. 3 (α ≤ 163,7°) y Ec. 4 (α > 163,7°)
//   Marte     Ec. 6 (α ≤ 50°) y Ec. 7 (α > 50°). SIN las correcciones L(λe) y L(Ls) (longitud del meridiano
//             visible y estación de Marte): necesitan tablas y valen como mucho ±0,06 mag. Supuesto declarado.
//   Júpiter   Ec. 8 (α ≤ 12°) y Ec. 9 (12° < α < 130°)
//   Saturno   Ec. 10: planeta + ANILLOS, válida para α < 6,5° y β < 27° (siempre se cumple α desde la Tierra);
//             β = √(βE·βS) si la Tierra y el Sol ven la misma cara de los anillos, 0 si no. βE y βS son las
//             latitudes saturnocéntricas de la Tierra y del Sol respecto al plano de los anillos (el ecuador),
//             con el polo de Saturno de la IAU (α0 = 40,589°, δ0 = 83,537°). Fuera de ese rango, Ec. 11/12
//             (solo el globo).
//   Urano     Ec. 14/15 con φ′ = media de |latitud planetográfica| sub-Tierra y sub-Sol (Ec. 13, f = 0,0022927;
//             polo IAU α0 = 257,311°, δ0 = −15,175°).
//   Neptuno   Ec. 17 (válida para fechas posteriores a 2000).
// Las posiciones salen de src/ephemeris.js (Schlyter, ~1–2′ en dirección; sin perturbaciones entre planetas
// gigantes): el error en magnitud por la posición es de centésimas.
// JPL Horizons usa estas mismas ecuaciones; scripts/test_sky_planetmag.mjs contrasta con su valor del 13-nov-2026.

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const OBL = 23.4392911 * D2R;            // oblicuidad J2000 (polos IAU en ecuatoriales J2000 → eclíptica)
const poleEcl = (ra, dec) => {
  const a = ra * D2R, d = dec * D2R;
  const x = Math.cos(d) * Math.cos(a), y = Math.cos(d) * Math.sin(a), z = Math.sin(d);
  return [x, y * Math.cos(OBL) + z * Math.sin(OBL), -y * Math.sin(OBL) + z * Math.cos(OBL)];
};
const POLE = { Saturn: poleEcl(40.589, 83.537), Uranus: poleEcl(257.311, -15.175) };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
// latitud (°) de la dirección `v` (desde el planeta) respecto al ecuador del planeta
const latOf = (pole, v) => Math.asin(Math.max(-1, Math.min(1, dot(pole, v) / norm(v)))) * R2D;

// ángulo de fase (°) en el planeta entre el Sol y la Tierra; hel y geo: vectores heliocéntrico y geocéntrico
export function phaseAngle(hel, geo) {
  const c = dot(hel, geo) / (norm(hel) * norm(geo));
  return Math.acos(Math.max(-1, Math.min(1, c))) * R2D;
}

// Magnitud V. key: "Mercury" … "Neptune" (como `planet` en ephemeris.js). Devuelve { V, eq } o null.
export function planetMagnitude(key, r, d, alpha, hel, geo) {
  const base = 5 * Math.log10(r * d), a = alpha;
  switch (key) {
    case "Mercury": {
      const x = Math.max(2, Math.min(170, a));
      return { V: base - 0.613 + 6.3280e-2 * x - 1.6336e-3 * x ** 2 + 3.3644e-5 * x ** 3 - 3.4265e-7 * x ** 4 + 1.6893e-9 * x ** 5 - 3.0334e-12 * x ** 6, eq: 2 };
    }
    case "Venus":
      if (a <= 163.7) return { V: base - 4.384 - 1.044e-3 * a + 3.687e-4 * a ** 2 - 2.814e-6 * a ** 3 + 8.938e-9 * a ** 4, eq: 3 };
      return { V: base + 236.05828 - 2.81914 * a + 8.39034e-3 * a ** 2, eq: 4 };
    case "Mars":
      if (a <= 50) return { V: base - 1.601 + 0.02267 * a - 0.0001302 * a ** 2, eq: 6 };
      return { V: base - 0.367 - 0.02573 * a + 0.0003445 * a ** 2, eq: 7 };
    case "Jupiter":
      if (a <= 12) return { V: base - 9.395 - 3.7e-4 * a + 6.16e-4 * a ** 2, eq: 8 };
      { const x = Math.min(a, 130) / 180;
        return { V: base - 9.428 - 2.5 * Math.log10(1 - 1.507 * x - 0.363 * x ** 2 - 0.062 * x ** 3 + 2.809 * x ** 4 - 1.876 * x ** 5), eq: 9 }; }
    case "Saturn": {
      let beta = 0, ok = false;
      if (hel && geo) {
        const bE = latOf(POLE.Saturn, geo.map((v) => -v)), bS = latOf(POLE.Saturn, hel.map((v) => -v));
        beta = bE * bS > 0 ? Math.sqrt(bE * bS) : 0;
        ok = true;
      }
      if (ok && a < 6.5 && beta < 27) {
        const sb = Math.sin(beta * D2R);
        return { V: base - 8.914 - 1.825 * sb + 0.026 * a - 0.378 * sb * Math.exp(-2.25 * a), eq: 10, ringTilt: beta };
      }
      if (a <= 6) return { V: base - 8.95 - 3.7e-4 * a + 6.16e-4 * a ** 2, eq: 11 };
      return { V: base - 8.94 + 2.446e-4 * a + 2.672e-4 * a ** 2 - 1.505e-6 * a ** 3 + 4.767e-9 * a ** 4, eq: 12 };
    }
    case "Uranus": {
      let phi = 0;
      if (hel && geo) {
        const f = 0.0022927, g = (lat) => Math.abs(Math.atan(Math.tan(lat * D2R) / ((1 - f) ** 2)) * R2D);
        phi = (g(latOf(POLE.Uranus, geo.map((v) => -v))) + g(latOf(POLE.Uranus, hel.map((v) => -v)))) / 2;
      }
      return { V: base - 7.110 - 8.4e-4 * phi + 6.587e-3 * a + 1.045e-4 * a ** 2, eq: 15 };
    }
    case "Neptune":
      return { V: base - 7.00 + 7.944e-3 * a + 9.617e-5 * a ** 2, eq: 17 };
    default:
      return null;
  }
}

// Magnitud de un planeta de src/ephemeris.js (necesita r_au, dist_au, hel, geo).
export function bodyMagnitude(b) {
  if (!b || b.body !== "planet" || !b.hel || !b.geo) return null;
  const alpha = phaseAngle(b.hel, b.geo);
  const m = planetMagnitude(b.planet, b.r_au, b.dist_au, alpha, b.hel, b.geo);
  return m ? { ...m, alpha } : null;
}

// Sol y Luna, para la visibilidad: el Sol siempre se ve; la Luna, con la fórmula de fase de Schaefer
// (atmosphere.js, moonMagV). Aquí solo el Sol (valor IAU de la magnitud aparente V del Sol: −26,74).
export const SUN_MAG_V = -26.74;
