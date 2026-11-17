// Pruebas de los monumentos (src/sky/monuments.js y monumentLayer.js): medidas, posición, ángulos tal como se
// verían desde el sitio, silueta para ocultar lo que queda detrás e integración en el cielo.
import { MONUMENTS, monumentsNear, buildFaces, toLocal, altAzOf, offsetOf, silhouette, withMonuments, groundRing, median, apexOf, footprintRadius, SH_STANDING, SH_LINTELS } from "../src/sky/monuments.js";
import { placeMonuments, monumentLabels } from "../src/sky/monumentLayer.js";
import { SITES } from "../src/sky/places.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const near = (a, b, t) => Math.abs(a - b) <= t;
const byId = (id) => MONUMENTS.find((m) => m.id === id);
const bbox = (faces) => { const b = { e0: 1e9, e1: -1e9, n0: 1e9, n1: -1e9, u0: 1e9, u1: -1e9 }; for (const f of faces) for (const [e, n, u] of f.v) { b.e0 = Math.min(b.e0, e); b.e1 = Math.max(b.e1, e); b.n0 = Math.min(b.n0, n); b.n1 = Math.max(b.n1, n); b.u0 = Math.min(b.u0, u); b.u1 = Math.max(b.u1, u); } return b; };

console.log("Medidas");
const keops = bbox(buildFaces(byId("keops")));
ok(near(keops.u1, 138.5, 0.01) && near(keops.u0, 0, 1e-9) && near(keops.e1 - keops.e0, 230.3, 0.01) && near(keops.n1 - keops.n0, 230.3, 0.01), "Keops: 138,5 m de alto y 230,3 m de lado");
const sol = byId("sol"), sb = bbox(buildFaces(sol));
ok(near(sb.u1, 65, 0.01), "Pirámide del Sol: 65 m");
// girada 15,5°: la planta ocupa más que 225 m en este y norte (225 · (cos + sen))
ok(near(sb.e1 - sb.e0, 225 * (Math.cos(15.5 * Math.PI / 180) + Math.sin(15.5 * Math.PI / 180)), 0.1), "Pirámide del Sol: girada 15,5° como la Calzada de los Muertos");
const cas = bbox(buildFaces(byId("castillo")));
ok(near(cas.u1, 30, 0.01), "El Castillo: 24 m de cuerpos más 6 m de templo");
const ng = bbox(buildFaces(byId("newgrange")));
ok(near(ng.u1, 13.5, 0.01) && near(ng.e1 - ng.e0, 85, 0.5), "Newgrange: túmulo de 85 m y 13,5 m");
const sh = bbox(buildFaces(byId("stonehenge")));
ok(near(sh.u1, 6.7, 0.01) && sh.n1 > 40, "Stonehenge: lo más alto, la piedra 56 del gran trilito (6,7 m), y la Piedra del Talón fuera del círculo");
ok(SH_STANDING.length === 17 && SH_LINTELS.every(([a, b]) => SH_STANDING.includes(a) && SH_STANDING.includes(b)), "Stonehenge: 17 piedras del círculo en pie y cada dintel sobre dos de ellas");

console.log("Desde el sitio");
const site = (id) => SITES.find((s) => s.id === id);
const teo = site("teotihuacan"), nT = monumentsNear(teo.lat, teo.lon, 25);
ok(nT.map((m) => m.id).join(",") === "sol,luna", "desde la Calzada se ven la Pirámide del Sol y la de la Luna");
const oS = offsetOf(teo.lat, teo.lon, sol.lat, sol.lon);
ok(oS.d > footprintRadius(sol) * 0.75 && oS.d < 400 && near(oS.az, 105.5, 3), `la Pirámide del Sol, al este, de frente (a ${Math.round(oS.d)} m, acimut ${oS.az.toFixed(1)}°)`);
// ángulo de la cima a mano: 65 m de alto a la distancia del centro, desde los ojos (1,7 m) sobre el mismo suelo
const top = altAzOf(toLocal(apexOf(sol), oS, -1.7));
ok(near(top.alt, Math.atan2(65 - 1.7, oS.d) * 180 / Math.PI, 0.05), `su cima se ve a ${top.alt.toFixed(1)}° (como en el sitio)`);
const g = site("giza"), nG = monumentsNear(g.lat, g.lon, 25).map((m) => m.id);
ok(nG[0] === "micerino" && nG.includes("kefren") && nG.includes("keops"), "desde el mirador de Guiza: Micerino delante, Kefrén y Keops detrás");
ok(monumentsNear(sol.lat, sol.lon, 25).every((m) => m.id !== "sol"), "desde dentro de una pirámide no se dibuja esa pirámide");
ok(monumentsNear(byId("stonehenge").lat, byId("stonehenge").lon, 1).some((m) => m.id === "stonehenge"), "en el centro de Stonehenge sí: es un círculo de piedras");
ok(monumentsNear(0.05, -78.15, 25).length === 0, "en Cayambe no hay monumentos (por ahora)");

console.log("Suelo");
const ring = groundRing(sol, 8);
ok(ring.length === 8 && ring.every(([la, lo]) => offsetOf(sol.lat, sol.lon, la, lo).d > footprintRadius(sol) + 20), "el suelo se mide fuera del bulto de la pirámide");
ok(median([3, 1, 2]) === 2 && median([4, 1, 3, 2]) === 2.5 && median([]) === null, "mediana");
const items = placeMonuments(nT, { lat: teo.lat, lon: teo.lon, ground: 2300 }, { sol: 2300, luna: 2310 });
ok(items.length === 2 && near(items[0].dz, -1.7, 1e-9) && near(items[1].dz, 8.3, 1e-9), "cada base sobre su suelo, respecto a los ojos");
ok(placeMonuments(nT, { lat: teo.lat, lon: teo.lon, ground: 2300 }, { sol: 2300 }).length === 1, "sin la altura de su base, un monumento no se dibuja");
const labs = monumentLabels(items, "en");
ok(labs[0].name === "Pyramid of the Sun" && labs[0].ele_m === 65 && near(labs[0].alt, top.alt, 0.01), "su nombre va en la cima");

console.log("Lo que queda detrás");
const sil = silhouette(items, 0.2);
const iTop = Math.round(top.az / 0.2);
ok(sil[iTop] >= top.alt - 0.05 && sil[iTop] < top.alt + 2 && sil[Math.round(((oS.az + 180) % 360) / 0.2)] === -90, "la silueta de la pirámide tapa hasta su cima (el borde delantero de arriba) y nada al otro lado");
ok(monumentLabels(items, "es", sil)[0].alt >= sil[iTop] - 0.01, "el nombre se apoya en lo más alto que se ve, no dentro de la cara");
const hz = { step_deg: 0.2, alt: new Array(1800).fill(1), bands: [] };
const hz2 = withMonuments(hz, sil);
ok(hz2.alt[iTop] > 10 && hz2.alt[0] === 1 && hz.alt[iTop] === 1 && hz2.monuments, "el horizonte con monumentos: una estrella tras la pirámide queda oculta");
ok(withMonuments(hz, new Float32Array(1800).fill(-90)) === hz, "sin monumentos, el mismo horizonte");
const shItems = placeMonuments([byId("stonehenge")], { lat: 51.17, lon: -1.82, ground: 100 }, { stonehenge: 100 });
ok(Math.max(...silhouette(shItems, 0.2)) === -90, "Stonehenge no tapa el cielo entero entre sus piedras (no es macizo)");

console.log("Integración");
const sky = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/createMonumentLayer\(\)/.test(sky) && /teseo_monuments/.test(sky) && /ref\.hzData = hzEff/.test(sky) && /monLabels/.test(sky), "el cielo dibuja los monumentos, oculta lo que tapan, los nombra y recuerda el interruptor");
ok(/horizon: hzData/.test(sky), "la ficha (salida y puesta tras las montañas) sigue con el relieve solo");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
