// Pruebas de src/sky/planetMag.js: magnitud aparente de los planetas (Mallama y Hilton 2018).
// Uso:  node scripts/test_sky_planetmag.mjs     (sale con código 1 si algo falla)
//
// Referencia independiente: JPL Horizons (ssd.jpl.nasa.gov), columna APmag, observador geocéntrico
// (500@399), 2026-11-13 00:00 UT, consultada el 13-nov-2026. Horizons incluye los anillos de Saturno
// cuando α < 6,5° y β < 27°, como la Ec. 10.
//   planeta     APmag    r (UA)           Δ (UA)           S-T-O (°)
const HZ = {
  Mercury: { V: 0.501, r: 0.309721662157, d: 0.79639287332004, a: 120.3849 },
  Venus:   { V: -4.760, r: 0.721594576487, d: 0.32087651477321, a: 140.2422 },
  Mars:    { V: 0.749, r: 1.606829761115, d: 1.33284710891306, a: 37.9294 },
  Jupiter: { V: -2.072, r: 5.320686324539, d: 5.31448320427407, a: 10.6818 },
  Saturn:  { V: 0.520, r: 9.421598382110, d: 8.66355493705057, a: 4.0308 },
  Uranus:  { V: 5.602, r: 19.43349208879, d: 18.4700180002958, a: 0.6923 },
  Neptune: { V: 7.705, r: 29.87703436700, d: 29.2155500686419, a: 1.4231 },
};
import { planetMagnitude, bodyMagnitude, phaseAngle } from "../src/sky/planetMag.js";
import { ephemeris } from "../src/ephemeris.js";

let failed = 0, passed = 0;
const ok = (c, n, d = "") => { if (c) { passed++; console.log(`  ok    ${n}`); } else { failed++; console.log(`  FALLA ${n} ${d}`); } };
const f3 = (v) => Number(v).toFixed(3);
const T = new Date("2026-11-13T00:00:00Z");
const eph = Object.fromEntries(ephemeris(T).filter((b) => b.body === "planet").map((b) => [b.planet, b]));

console.log("Ecuaciones con la geometría de Horizons (aísla las fórmulas)");
for (const k of Object.keys(HZ)) {
  const h = HZ[k], b = eph[k];
  const m = planetMagnitude(k, h.r, h.d, h.a, b.hel, b.geo);       // las latitudes de anillos/polo, con las efemérides de Teseo
  const tol = k === "Mars" ? 0.08 : 0.03;                          // Marte: sin L(λe) ni L(Ls) (±0,06 mag)
  ok(Math.abs(m.V - h.V) <= tol, `${k}: ${f3(m.V)} frente a ${h.V} de Horizons (Ec. ${m.eq}, tolerancia ${tol})`);
}
console.log("Cadena completa con las efemérides de Teseo (posiciones de Schlyter)");
for (const k of Object.keys(HZ)) {
  const b = eph[k], m = bodyMagnitude(b), h = HZ[k];
  ok(Math.abs(b.r_au - h.r) / h.r < 0.01 && Math.abs(b.dist_au - h.d) / h.d < 0.01, `${k}: r y Δ dentro del 1 % de Horizons`, `${f3(b.r_au)}/${f3(b.dist_au)}`);
  ok(Math.abs(m.alpha - h.a) < 0.6, `${k}: ángulo de fase ${m.alpha.toFixed(2)}° frente a ${h.a}°`);
  const tol = k === "Mars" ? 0.1 : 0.06;
  ok(Math.abs(m.V - h.V) <= tol, `${k}: magnitud ${f3(m.V)} frente a ${h.V} (tolerancia ${tol})`);
}
console.log("Casos de control");
ok(planetMagnitude("Saturn", 9.5, 8.5, 1, [9.5, 0, 0], [8.5, 0, 0]).eq === 10, "Saturno cerca de la oposición usa la ecuación con anillos");
ok(eph.Saturn && bodyMagnitude(eph.Saturn).ringTilt >= 0 && bodyMagnitude(eph.Saturn).ringTilt < 27, "inclinación efectiva de los anillos en 2026 < 27°", f3(bodyMagnitude(eph.Saturn).ringTilt));
ok(Math.abs(phaseAngle([1, 0, 0], [0, 1, 0]) - 90) < 1e-9, "ángulo de fase de vectores perpendiculares = 90°");
// Venus: más brillante que −3,8 en toda su órbita vista desde la Tierra (Mallama y Hilton: −4,92 a −3,82 aprox.)
let vMin = Infinity, vMax = -Infinity;
for (let d = 0; d < 600; d += 3) { const b = ephemeris(new Date(T.getTime() + d * 86400000)).find((x) => x.planet === "Venus"); const m = bodyMagnitude(b); if (m.alpha < 170) { vMin = Math.min(vMin, m.V); vMax = Math.max(vMax, m.V); } }
ok(vMin > -5.0 && vMin < -4.6 && vMax < -3.5, `Venus en 20 meses entre ${f3(vMin)} y ${f3(vMax)}`);
ok(bodyMagnitude({ body: "moon" }) === null, "solo planetas");
console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
