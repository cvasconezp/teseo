// seasons.js — equinoccios y solsticios. Jean Meeus, «Astronomical Algorithms» (2.ª ed.),
// cap. 27: instante medio por polinomio (tabla 27.A, años 1000–3000) más 24 términos
// periódicos (tabla 27.C). El resultado es en TD (tiempo dinámico); se pasa a UT restando ΔT.
// Precisión: ~1 min. Se compara con el USNO en scripts/test_now_calendar.mjs (±10 min).
const TABLE = [
  [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],   // equinoccio de marzo
  [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030],    // solsticio de junio
  [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],    // equinoccio de septiembre
  [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],   // solsticio de diciembre
];
const TERMS = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112],
  [156, 73.14, 45036.886], [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906],
  [70, 243.58, 9037.513], [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417], [18, 155.12, 67555.328],
  [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
  [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];
const RAD = Math.PI / 180;
/** ΔT = TD − UT (s) para 2026–2030: ~69 s, +0,5 s por año (IERS/Espenak). El error (<2 s) es irrelevante aquí. */
export const deltaTSeconds = (year) => 69.2 + 0.5 * (year - 2026);

/** @param k 0 = equinoccio de marzo, 1 = solsticio de junio, 2 = equinoccio de septiembre, 3 = solsticio de diciembre */
export function seasonMoment(year, k) {
  const Y = (year - 2000) / 1000, c = TABLE[k];
  const jde0 = c[0] + c[1] * Y + c[2] * Y ** 2 + c[3] * Y ** 3 + c[4] * Y ** 4;
  const T = (jde0 - 2451545.0) / 36525, W = 35999.373 * T - 2.47;
  const dl = 1 + 0.0334 * Math.cos(W * RAD) + 0.0007 * Math.cos(2 * W * RAD);
  let S = 0; for (const [A, B, C] of TERMS) S += A * Math.cos((B + C * T) * RAD);
  const jde = jde0 + (0.00001 * S) / dl;
  const msTD = (jde - 2440587.5) * 86400000;
  return msTD - deltaTSeconds(year) * 1000;           // ms UTC
}

/** Estaciones entre `from` y `to` (ms): [{ kind: "equinox"|"solstice", k, t }] */
export function findSeasons(from, to) {
  const out = [];
  for (let y = new Date(from).getUTCFullYear() - 1; y <= new Date(to).getUTCFullYear() + 1; y++) {
    for (let k = 0; k < 4; k++) { const t = seasonMoment(y, k); if (t >= from && t <= to) out.push({ k, kind: k % 2 === 0 ? "equinox" : "solstice", t }); }
  }
  return out.sort((a, b) => a.t - b.t);
}
