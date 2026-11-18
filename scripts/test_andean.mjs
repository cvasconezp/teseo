// Pruebas de la capa «Astronomía andina» (src/sky/andean.js). Node puro, sin red.
// Uso:  node scripts/test_andean.mjs
// Dato: scripts/hz_catequilla.json = respuesta de /api/horizon para Catequilla (18-nov-2026), redondeada a 0,01°.
// Referencias: Cobo A., C. (2012), «Astronomía Quitu-Caranqui, Catequilla y los discos líticos», tabla de
// acimuts desde Catequilla (Cochasquí 66°30′, Jachi Rumi 113°30′; Cayambe 90°) y Tabla 1 (coordenadas GNSS).
import { readFileSync } from "node:fs";
import { ANDEAN_SITES, andeanSitesFrom, solarHorizonMarks, andeanLabels, distAz, apparentAltOf, TX_AND, OBLIQUITY } from "../src/sky/andean.js";

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  ok   ", msg); } else { fail++; console.log("  FALLA", msg); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const hz = JSON.parse(readFileSync(new URL("./hz_catequilla.json", import.meta.url), "utf8"));
const CAT = ANDEAN_SITES.find(s => s.id === "catequilla");

console.log("Datos");
ok(near(CAT.lat, 0.000207, 1e-6) && near(CAT.lon, -78.428426, 1e-6), "Catequilla: 0°0′0,74″ N, 78°25′42,33″ W (GNSS de Cobo 2012)");
ok(ANDEAN_SITES.filter(s => s.src === "cobo").length === 14, "los 14 puntos de la Tabla 1 del libro");
ok(new Set(ANDEAN_SITES.map(s => s.id)).size === ANDEAN_SITES.length && ANDEAN_SITES.every(s => s.es && s.en && Number.isFinite(s.elev)), "ids únicos, nombres ES/EN y altura");
ok(/Cobo A\., Cristóbal \(2012\)/.test(TX_AND.es.source) && /QUIMERADREAMS/.test(TX_AND.es.source) && /Wikipedia/.test(TX_AND.en.source), "la referencia al libro va en el panel (ES/EN)");
ok(/no prueba que se construyera a propósito/.test(TX_AND.es.caveat), "con la advertencia de que una alineación no prueba intención");

console.log("Geometría");
const da = distAz(0, 0, 0, 1);
ok(near(da.az, 90, 1e-9) && near(da.dist / 1000, 111.19, 0.01), "acimut y distancia sobre la esfera");
ok(near(apparentAltOf(10000, 0), -0.039, 0.002), "un punto a la misma altura, a 10 km, queda 0,04° bajo el horizonte (curvatura y refracción)");

console.log("El Sol desde Catequilla (relieve real)");
const marks = Object.fromEntries(solarHorizonMarks(CAT.lat, hz).map(m => [m.key, m]));
ok(near(marks.junRise.az, 66.56, 0.05) && near(marks.decRise.az, 113.45, 0.05), `salida en los solsticios: ${marks.junRise.az.toFixed(2)}° y ${marks.decRise.az.toFixed(2)}° (Cobo: 66°30′ y 113°30′)`);
ok(near(marks.eqRise.az, 90, 0.05) && near(marks.eqSet.az, 270, 0.05), "equinoccios: este y oeste exactos");
ok(near(marks.junSet.az, 293.4, 0.1) && near(marks.decSet.az, 246.4, 0.3), "puestas en los solsticios (Cobo: 293°30′ y 246°30′)");
ok(marks.junRise.alt > 1.5 && marks.junRise.alt < 2.5 && marks.decSet.alt > 5, "el Sol aparece sobre la silueta (≈1,9°) y se esconde tras el Casitahua (>5°)");
const flat = Object.fromEntries(solarHorizonMarks(0, null).map(m => [m.key, m]));
ok(near(flat.junRise.az, 90 - OBLIQUITY, 0.05), "con horizonte plano, en el ecuador: 90° − oblicuidad");
const north = solarHorizonMarks(70, null);
ok(!north.some(m => m.key === "junSet") && !north.some(m => m.key === "decRise"), "más allá del círculo polar: sin puesta en junio ni salida en diciembre");

console.log("Sitios desde Catequilla");
const sites = Object.fromEntries(andeanSitesFrom({ lat: CAT.lat, lon: CAT.lon, ground: hz.ground_m, hz }).map(s => [s.id, s]));
ok(!sites.catequilla && !sites["d-catequilla"], "el sitio donde estás no se rotula");
ok(sites.cochasqui && near(sites.cochasqui.az, 64.5, 0.2) && near(sites.cochasqui.distKm, 14.6, 0.2) && !sites.cochasqui.hidden, "Cochasquí a la vista: 64,5°, 14,6 km, justo bajo la cresta del Mojanda");
ok(sites.pambamarca && near(sites.pambamarca.az, 110, 0.2) && !sites.pambamarca.hidden, "Pambamarca a 110°: forma la silueta");
ok(sites.quitsato && near(sites.quitsato.az, 90, 0.05), "Quitsato, también en la latitud cero, queda justo al este (equinoccios)");
const L = andeanLabels({ lat: CAT.lat, lon: CAT.lon, ground: hz.ground_m, hz, lang: "es" });
ok(L.sun.length === 6 && L.sun.every(x => x.cls === "andsun") && L.sites.every(x => x.cls === "andsite"), "6 marcas del Sol y los sitios, con su estilo");
ok(L.sun.find(x => x.name === "junRise").label === "Sale el Sol · solsticio de junio" && L.sun.find(x => x.name === "junRise").subText === "66,6°", "rótulo «Sale el Sol · solsticio de junio · 66,6°»");
ok(L.sites.find(x => x.name === "cochasqui").subText === "15 km", "Cochasquí rotulado con su distancia");
ok(andeanSitesFrom({ lat: 40.4, lon: -3.7, hz: null }).length === 0, "lejos de los Andes (Madrid): sin sitios, solo el Sol");

const sky = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/ANDEAN_KEY = "teseo_andean"/.test(sky) && /andeanLabels\(\{ lat, lon/.test(sky) && /\.\.\.\(ref\.andLabels \|\| \[\]\)/.test(sky), "el Cielo dibuja la capa (apagada por defecto, se recuerda)");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
