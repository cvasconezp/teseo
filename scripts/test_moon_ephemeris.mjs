// Pruebas de la Luna de src/ephemeris.js (la que dibuja el Cielo) frente a JPL Horizons.
// Node puro, sin dependencias. Uso:  node scripts/test_moon_ephemeris.mjs   (exit 1 si algo falla)
//
// Datos: JPL Horizons API (https://ssd.jpl.nasa.gov/api/horizons.api), consulta del 2026-11-14:
//   COMMAND='301' CENTER='500@399' EPHEM_TYPE='OBSERVER' QUANTITIES='2,20' CSV_FORMAT='YES'
//   ANG_FORMAT='DEG' TIME_TYPE='UT' TLIST='<18 fechas JD UT, 2025–2028>'
//   Cantidad 2 = RA/Dec aparentes (ecuador y equinoccio de la fecha, con tiempo-luz y nutación),
//   que es el marco en que Schlyter da sus coordenadas; cantidad 20 = delta (UA, centro a centro).
//   Nota: la cantidad 1 (astrométrica J2000) difiere ~0,37° en 2026 por la precesión, no por la Luna.
// Observador geocéntrico: la paralaje topocéntrica (hasta ~1°) NO está en ephemeris() (no recibe
// la posición del observador); ver el informe del cambio.
import { ephemeris } from "../src/ephemeris.js";
import { moonState } from "../src/special/math.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };

const AU_KM = 149597870.7;
const RAD = Math.PI / 180;
// [fecha UTC, RA aparente (°), Dec aparente (°), distancia (km = delta · UA)]
const HZ = [
    ["2025-01-14T06:00", 121.30186, 24.85417, 382657],
    ["2025-03-29T18:00", 11.78712, 6.64591, 358347],
    ["2025-06-10T00:00", 241.62832, -25.70075, 402823],
    ["2025-08-22T12:00", 143.71148, 16.98478, 384217],
    ["2025-10-07T03:00", 11.68009, 7.45735, 361537],
    ["2025-12-19T21:00", 265.52773, -28.22986, 403846],
    ["2026-02-26T09:00", 92.54946, 28.27258, 370659],
    ["2026-05-13T15:00", 6.87381, 5.95007, 371203],
    ["2026-08-02T00:00", 349.11269, -2.81281, 388848],
    ["2026-11-14T12:00", 291.53844, -24.93586, 405343],
    ["2027-01-25T20:00", 170.82393, 1.02631, 370792],
    ["2027-04-09T06:00", 43.62596, 21.94362, 376104],
    ["2027-07-21T14:00", 331.83504, -9.73018, 404627],
    ["2027-10-03T01:00", 223.90267, -21.97869, 380872],
    ["2028-01-17T10:00", 186.30051, -8.02000, 371293],
    ["2028-04-30T17:00", 114.74852, 21.78628, 374815],
    ["2028-08-12T23:00", 40.64225, 20.85921, 395910],
    ["2028-11-26T04:00", 356.07174, 3.68350, 404751]
];
const luna = (iso) => ephemeris(new Date(`${iso}:00Z`)).find((b) => b.name === "Luna");
// separación angular (°) entre dos posiciones RA/Dec
function sep(ra1, de1, ra2, de2) {
  const c = Math.sin(de1 * RAD) * Math.sin(de2 * RAD) + Math.cos(de1 * RAD) * Math.cos(de2 * RAD) * Math.cos((ra1 - ra2) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
}

console.log("Luna de ephemeris() frente a JPL Horizons (geocéntrica, 18 fechas 2025–2028)");
{
  let maxKm = 0, maxDeg = 0;
  for (const [iso, ra, de, km] of HZ) {
    const m = luna(iso);
    maxKm = Math.max(maxKm, Math.abs(m.dist_km - km));
    maxDeg = Math.max(maxDeg, sep(m.ra, m.dec, ra, de));
  }
  ok(HZ.length >= 12, "al menos 12 fechas entre 2025 y 2028", String(HZ.length));
  ok(HZ[0][0] < "2025-02" && HZ[HZ.length - 1][0] > "2028-10", "las fechas cubren de 2025 a 2028");
  ok(maxKm <= 1500, "distancia: error máximo ≤ 1.500 km", `${maxKm.toFixed(0)} km`);
  ok(maxDeg <= 0.3, "posición: error máximo ≤ 0,3° (RA/Dec aparentes)", `${maxDeg.toFixed(3)}°`);
  console.log(`        (errores máximos: ${maxKm.toFixed(0)} km, ${maxDeg.toFixed(3)}°)`);
  // cada fecha por separado, para ver cuál falla si algo se rompe
  for (const [iso, ra, de, km] of HZ) {
    const m = luna(iso);
    const dk = Math.abs(m.dist_km - km), dd = sep(m.ra, m.dec, ra, de);
    ok(dk <= 1500 && dd <= 0.3, `${iso}Z: ${dk.toFixed(0)} km, ${dd.toFixed(3)}°`);
  }
}

console.log("Interfaz de ephemeris() intacta");
{
  const out = ephemeris(new Date("2026-11-14T12:00:00Z"));
  const nombres = out.map((b) => b.name).join(",");
  ok(nombres === "Sol,Mercurio,Venus,Marte,Júpiter,Saturno,Urano,Neptuno,Luna", "mismos cuerpos y orden", nombres);
  const m = out.find((b) => b.name === "Luna");
  ok(m.body === "moon" && ["nx", "ny", "nz", "ra", "dec", "illum", "waxing", "dist_km"].every((k) => k in m), "Luna: body, nx, ny, nz, ra, dec, illum, waxing, dist_km");
  ok(Math.abs(Math.hypot(m.nx, m.ny, m.nz) - 1) < 1e-4, "dirección unitaria");
  ok(m.ra >= 0 && m.ra < 360 && m.dec > -30 && m.dec < 30, "ra en grados 0–360 y dec en grados", `${m.ra} ${m.dec}`);
  ok(Number.isInteger(m.dist_km) && m.dist_km > 350000 && m.dist_km < 410000, "dist_km entero en km (no radios terrestres ni UA)", String(m.dist_km));
  ok(m.illum >= 0 && m.illum <= 1 && typeof m.waxing === "boolean", "illum 0–1 y waxing booleano");
  ok(m.waxing === true && m.illum > 0.1 && m.illum < 0.3, "14-nov-2026: creciente, poco iluminada (Horizons: ~0,16–0,25)", `${m.illum}`);
  const p = out.find((b) => b.planet === "Mars");
  ok(p && Array.isArray(p.hel) && Array.isArray(p.geo) && p.r_au > 1 && p.dist_au > 0, "planetas conservan r_au, hel y geo (planetMag.js)");
  ok(out[0].name === "Sol" && out[0].dist_au > 0.98 && out[0].dist_au < 1.02, "el Sol conserva dist_au");
}

console.log("Coherencia con ¿Y la Luna? (src/special/math.js)");
{
  let maxKm = 0;
  for (const [iso] of HZ) maxKm = Math.max(maxKm, Math.abs(luna(iso).dist_km - moonState(new Date(`${iso}:00Z`)).distKm));
  ok(maxKm <= 0.5, "ephemeris() y moonState() dan la misma distancia (redondeo ≤ 0,5 km)", `${maxKm.toFixed(3)} km`);
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
