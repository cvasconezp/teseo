// Pruebas del tour (src/sky/tour.js): elección de lo visible, atardecer, Guiza y textos.
import { TOUR_STOPS, CANDIDATES, pickVisible, sunsetAt, offsetLL, bearing, gizaView, KHUFU, TOUR_T, deepKind, nameOf } from "../src/sky/tour.js";
import { ephemeris } from "../src/ephemeris.js";
import { altAz } from "../src/sky/guide.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };
const near = (a, b, t) => Math.abs(a - b) <= t;

ok(TOUR_STOPS.length === 9 && TOUR_STOPS[1].scene === "giza" && TOUR_STOPS[2].scene === "volcano" && TOUR_STOPS[8].target === "tonight", "nueve paradas, con Guiza, el volcán y Esta noche");
ok(pickVisible(["a", "b", "c"], (c) => ({ a: 5, b: 40, c: 60 })[c]) === "b", "el primero por encima de 20°");
ok(pickVisible(["a", "b"], (c) => ({ a: 8, b: 12 })[c]) === "b", "si nada pasa de 20°, el más alto que asome");
ok(pickVisible(["a", "b"], () => -10) === null, "nada visible: ninguno");
ok(pickVisible(["x", "a"], (c) => (c === "x" ? undefined : null)) === "a", "sin lugar, el primero que existe en los datos");

const sunAt = (lat, lon) => (d) => { const s = ephemeris(d).find((b) => b.name === "Sol"); return altAz(s.nx, s.ny, s.nz, lat, lon, d); };
const sg = sunsetAt(new Date(Date.UTC(2026, 11, 21)), KHUFU.lon, sunAt(KHUFU.lat, KHUFU.lon), 0);
const loc = sg ? sg.getUTCHours() + 2 + sg.getUTCMinutes() / 60 : null;     // hora de Egipto (UTC+2)
ok(sg && loc > 16.6 && loc < 17.4, `atardecer en Guiza el 21 de diciembre hacia las 17:00 (${sg && sg.toISOString()})`);
const az = sunAt(KHUFU.lat, KHUFU.lon)(sg).az;
ok(az > 238 && az < 246, `el Sol se pone hacia el suroeste en diciembre (${az && az.toFixed(1)}°)`);
ok(sunsetAt(new Date(Date.UTC(2026, 11, 21)), 0, sunAt(80, 0), 0) === null, "en la noche polar no hay atardecer");
const p = offsetLL(0, 0, 90, 1113.2);
ok(near(p.lat, 0, 1e-9) && near(p.lon, 0.01, 1e-6) && near(bearing(0, 0, p.lat, p.lon), 90, 1e-6), "desplazamientos y rumbos en el plano local");
const gv = gizaView(az);
const toK = bearing(gv.lat, gv.lon, KHUFU.lat, KHUFU.lon);
ok(near(((toK - az + 540) % 360) - 180, 0, 0.2) && near(gv.lookAz, az, 1e-9), "desde el punto de Guiza (3 km al este), Keops queda en la línea del Sol poniente");
ok(deepKind("galaxy") === "galaxy" && deepKind("open") === "cluster" && deepKind("globular") === "cluster" && deepKind("nebula") === "nebula" && deepKind("planetary") === "nebula", "tipos de cielo profundo");
ok(nameOf("con", "Cru", "es") === "La Cruz del Sur" && nameOf("star", "Sirius", "es") === "Sirio" && nameOf("deep", 42, "en") === "Orion Nebula (M42)", "nombres para los títulos");
for (const lang of ["es", "en"]) {
  const T = TOUR_T[lang];
  ok(T.look.title && T.place.tip && T.time.text("Sangay").includes("Sangay") && T.time.text(null) && T.star.text(8.6, lang).includes("8,6") === (lang === "es") && T.weather.textNoPlace && T.tonight.tip, `textos completos (${lang})`);
}
ok(TOUR_T.es.star.text(1, "es").includes("1 año ") && TOUR_T.en.star.text(640, "en").includes("640 years"), "años de luz en singular y plural");
ok(CANDIDATES.planet.includes("Luna") && CANDIDATES.deep.includes(42), "candidatos");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
