// Pruebas de la efeméride de los planetas (src/ephemeris.js) frente a JPL Horizons (posiciones aparentes geocéntricas,
// equinoccio de la fecha, consultadas el 19-nov-2026): con las perturbaciones mutuas de Júpiter, Saturno y Urano.
import { ephemeris } from "../src/ephemeris.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const R = Math.PI / 180;
const sep = (b, ra, dec) => { const v = [Math.cos(dec * R) * Math.cos(ra * R), Math.cos(dec * R) * Math.sin(ra * R), Math.sin(dec * R)], x = [b.ny * v[2] - b.nz * v[1], b.nz * v[0] - b.nx * v[2], b.nx * v[1] - b.ny * v[0]]; return Math.atan2(Math.hypot(...x), b.nx * v[0] + b.ny * v[1] + b.nz * v[2]) / R; };
// [fecha, cuerpo, AR aparente (°), Dec aparente (°)] de Horizons
const REF = [
  ["2026-11-19T06:00:00Z", "Sol", 234.6202, -19.4666],
  ["2026-11-19T06:00:00Z", "Mercurio", 216.0166, -11.7683],
  ["2026-11-19T06:00:00Z", "Venus", 201.4578, -9.5718],
  ["2026-11-19T06:00:00Z", "Marte", 150.1142, 14.3325],
  ["2026-11-19T06:00:00Z", "Júpiter", 148.6300, 13.5213],
  ["2026-11-19T06:00:00Z", "Saturno", 8.7085, 0.8939],
  ["2026-11-19T06:00:00Z", "Urano", 61.9884, 20.7920],
  ["2026-11-19T06:00:00Z", "Neptuno", 2.1834, -0.5857],
  ["2027-06-01T00:00:00Z", "Sol", 68.6934, 21.9931],
  ["2027-06-01T00:00:00Z", "Mercurio", 93.0392, 24.8398],
  ["2027-06-01T00:00:00Z", "Venus", 48.7423, 16.7594],
  ["2027-06-01T00:00:00Z", "Marte", 159.3476, 10.0626],
  ["2027-06-01T00:00:00Z", "Júpiter", 143.1280, 15.5832],
  ["2027-06-01T00:00:00Z", "Saturno", 23.1197, 7.1753],
  ["2027-06-01T00:00:00Z", "Urano", 64.1753, 21.2087],
  ["2027-06-01T00:00:00Z", "Neptuno", 6.2860, 1.2142],
  ["2020-12-21T18:00:00Z", "Sol", 270.3682, -23.4367],
  ["2020-12-21T18:00:00Z", "Mercurio", 271.3756, -25.0082],
  ["2020-12-21T18:00:00Z", "Venus", 245.9769, -20.5272],
  ["2020-12-21T18:00:00Z", "Marte", 21.2325, 9.6124],
  ["2020-12-21T18:00:00Z", "Júpiter", 302.7933, -20.5144],
  ["2020-12-21T18:00:00Z", "Saturno", 302.7716, -20.4147],
  ["2020-12-21T18:00:00Z", "Urano", 34.7732, 13.4055],
  ["2020-12-21T18:00:00Z", "Neptuno", 349.6786, -5.6211],
  ["2035-03-10T12:00:00Z", "Sol", 350.5701, -4.0618],
  ["2035-03-10T12:00:00Z", "Mercurio", 331.6302, -13.7736],
  ["2035-03-10T12:00:00Z", "Venus", 313.9446, -17.2049],
  ["2035-03-10T12:00:00Z", "Marte", 278.9359, -23.5109],
  ["2035-03-10T12:00:00Z", "Júpiter", 17.0741, 6.0799],
  ["2035-03-10T12:00:00Z", "Saturno", 121.0170, 20.8379],
  ["2035-03-10T12:00:00Z", "Urano", 97.0917, 23.6072],
  ["2035-03-10T12:00:00Z", "Neptuno", 19.8760, 6.6451],
];
const worst = {};
for (const [iso, name, ra, dec] of REF) { const b = ephemeris(new Date(iso)).find((x) => x.name === name), e = sep(b, ra, dec); worst[name] = Math.max(worst[name] || 0, e); }
const fmt = (n) => `${name(n)} ${(worst[n] * 60).toFixed(1)}′`, name = (n) => n;
ok(REF.length === 32 && Object.keys(worst).length === 8, "32 posiciones de referencia: el Sol y siete planetas en cuatro fechas (2020–2035)");
ok(["Sol", "Mercurio", "Venus", "Marte"].every((n) => worst[n] < 0.03), `Sol y planetas interiores, a menos de 2′: ${["Sol", "Mercurio", "Venus", "Marte"].map(fmt).join(", ")}`);
ok(worst["Júpiter"] < 0.04 && worst["Saturno"] < 0.04, `Júpiter y Saturno con sus perturbaciones mutuas, a menos de 2,4′ (sin ellas, Saturno quedaba a 7′): ${["Júpiter", "Saturno"].map(fmt).join(", ")}`);
ok(worst["Urano"] < 0.06 && worst["Neptuno"] < 0.06, `Urano y Neptuno, a menos de 3,6′: ${["Urano", "Neptuno"].map(fmt).join(", ")}`);
console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
