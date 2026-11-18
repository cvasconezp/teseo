// Pruebas de los monumentos (src/sky/monuments.js y monumentLayer.js): medidas, posición, ángulos tal como se
// verían desde el sitio, silueta para ocultar lo que queda detrás e integración en el cielo.
import { MONUMENTS, monumentsNear, buildFaces, toLocal, altAzOf, offsetOf, silhouette, withMonuments, groundRing, median, apexOf, footprintRadius, SH_STANDING, SH_LINTELS } from "../src/sky/monuments.js";
import { placeMonuments, monumentLabels, faceUV, toneAt, groundHeight, reliefAt, reliefPoints, RELIEF_R, RELIEF_NA } from "../src/sky/monumentLayer.js";
import { tierEdges, stairSteps, detailFor } from "../src/sky/monuments.js";
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
ok(monumentsNear(0.0, -78.17518, 25).map((m) => m.id).join() === "quitsato", "desde su plataforma se dibuja el reloj solar Quitsato");

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

console.log("Aspecto");
const wall = faceUV([[0, 0, 0], [4, 0, 0], [4, 0, 3]], 2);
ok(Math.abs(wall.uv[2][1] - wall.uv[0][1] - 1.5) < 1e-9 && Math.abs(Math.abs(wall.uv[1][0] - wall.uv[0][0]) - 2) < 1e-9, "en una pared, u a lo largo (en teselas) y v hacia arriba: las hiladas quedan horizontales");
const flat = faceUV([[0, 0, 5], [2, 0, 5], [2, 2, 5]], 2);
ok(flat.uv[2][0] === 1 && flat.uv[2][1] === 1, "en una terraza, u al este y v al norte");
ok(toneAt([0, 0, 0]) < toneAt([0, 0, 10]) + 0.5 && toneAt([0, 0, 0]) > 0.5 && toneAt([0, 0, 0]) < 1.2, "tono variable y algo más oscuro junto al suelo");
// la escalinata pasa por fuera de todas las terrazas
const solF = buildFaces(sol).filter((f) => f.mat === "steps");
ok(solF.length === 4 * stairSteps(65, detailFor(300).stepH) && solF.every((f) => f.tex === "basalt") && tierEdges(sol).length === 4, "la Pirámide del Sol tiene su escalinata, con escalones de verdad");
const casF = buildFaces(byId("castillo"));
ok(casF.filter((f) => f.mat === "steps").length === 4 * 4 * stairSteps(24, 0.27) && stairSteps(24, 0.27) === 89 && casF.filter((f) => f.mat === "door").length === 12, "El Castillo: cuatro escalinatas y seis puertas en el templo (tres al norte)");
ok(buildFaces(byId("kefren")).some((f) => f.mat === "casing"), "Kefrén conserva el revestimiento arriba");

console.log("Segunda tanda: Chankillo, Quitsato, Catequilla, Paranal, Tiwanaku, Machu Picchu");
{
  const R2 = Math.PI / 180;
  // Chankillo: desde el punto de observación oeste, las torres cubren el arco anual de la salida del Sol
  const ch = site("chankillo"), tw = MONUMENTS.filter((m) => m.site === "chankillo");
  const azT = (m) => offsetOf(ch.lat, ch.lon, m.lat, m.lon);
  const sunAz = (dec) => Math.acos(Math.sin(dec * R2) / Math.cos(ch.lat * R2)) / R2;      // a 0° de altura
  ok(tw.length === 13 && tw.filter((m) => m.label !== false).length === 1 && tw.every((m) => m.height >= 2 && m.height <= 6 && m.w * m.d >= 75 && m.w * m.d <= 125),
    "Chankillo: trece torres de 2 a 6 m y 75 a 125 m², con un solo nombre");
  ok(near(azT(tw[6]).d, 235, 8) && near(offsetOf(tw[0].lat, tw[0].lon, tw[12].lat, tw[12].lon).d, 193, 6), "Chankillo: a unos 235 m del punto de observación; la fila mide unos 200 m");
  ok(near(azT(tw[12]).az, sunAz(-23.44), 2) && azT(tw[0]).az - sunAz(23.44) < 1.5 && azT(tw[0]).az - sunAz(23.44) > -1.5,
    "Chankillo: el Sol de diciembre sale por la torre 13 y el de junio junto a la torre 1 (Ghezzi y Ruggles 2007)");
  ok(monumentsNear(ch.lat, ch.lon, 25).length === 13 && tw.every((m) => m.relief && groundRing(m, 8).every(([la, lo]) => offsetOf(m.lat, m.lon, la, lo).d < 4)),
    "Chankillo: cada torre se asienta en la cresta (el suelo se mide en su centro) y el suelo sigue el relieve");
  // Quitsato
  const q = byId("quitsato"), qs = site("quitsato"), qb = bbox(buildFaces(q));
  ok(q.lat === 0 && qs.lat === 0 && near(qb.u1, 10, 1e-9) && near(qb.e1 - qb.e0, 54, 0.01) && near(offsetOf(qs.lat, qs.lon, q.lat, q.lon).az, 90, 0.01) && near(offsetOf(qs.lat, qs.lon, q.lat, q.lon).d, 20, 0.5),
    "Quitsato: en la línea ecuatorial, plataforma de 54 m y poste de 10 m; se mira desde 20 m al oeste (el Sol de los equinoccios sale detrás)");
  ok(monumentsNear(0.05, -78.15, 25).length === 0, "Quitsato: lo pequeño no se dibuja de lejos (desde Cayambe, a 6 km)");
  ok(monumentsNear(0, -78.175, 25).length === 0, "Quitsato: desde el centro exacto (dentro del poste) no se dibuja");
  // Catequilla
  const cw = byId("catequilla-muro"), cs = site("catequilla"), cd = byId("catequilla-disco");
  ok(near(((cw.az1 - cw.az0) * R2) * cw.radius, 107, 0.5) && cw.radius * 2 === 68 && cw.az0 === 293.5 && cw.az1 - 360 === 113.5,
    "Catequilla: muro de 68 m de diámetro y 107 m de arco, de la puesta de junio (293,5°) a la salida de diciembre (113,5°)");
  const dOff = offsetOf(cs.lat, cs.lon, cd.lat, cd.lon);
  ok(near(dOff.n, 43.3, 1.5) && near(dOff.e, -32.9, 1.5) && cd.radius === 4, "Catequilla: el disco lítico, 43 m al norte y 33 m al oeste del vértice (UTM de Cobo 2017)");
  ok(monumentsNear(cs.lat, cs.lon, 25).map((m) => m.id).join() === "catequilla-muro,catequilla-disco" && cw.walkIn, "Catequilla: desde la cima se está dentro del arco del muro");
  // Paranal
  const ut = [1, 2, 3, 4].map((i) => byId(`vlt-ut${i}`));
  ok(near(offsetOf(ut[0].lat, ut[0].lon, ut[3].lat, ut[3].lon).d, 130.2, 0.5) && near(offsetOf(ut[0].lat, ut[0].lon, ut[1].lat, ut[1].lon).d, 56.6, 0.5),
    "Paranal: los telescopios guardan las distancias del VLTI (UT1–UT4: 130 m; UT1–UT2: 57 m)");
  const ub = bbox(buildFaces(ut[0]));
  ok(near(ub.u1, 28.5, 1e-9) && near(ub.e1 - ub.e0, 29.5, 0.1), "Paranal: cerramiento de 28,5 m de alto y 29 m de diámetro (más el zócalo)");
  // Tiwanaku
  const ak = bbox(buildFaces(byId("akapana"))), ka = byId("kalasasaya"), ps = byId("puerta-del-sol");
  ok(near(ak.u1, 16.5, 1e-9) && near(ak.e1 - ak.e0, 197, 0.01), "Tiwanaku: Akapana, 16,5 m de alto y 197 m de ancho");
  const tw2 = site("tiwanaku"), itemsT = placeMonuments([ka, ps], { lat: tw2.lat, lon: tw2.lon, ground: 3863 }, { kalasasaya: 3863, "puerta-del-sol": 3863 });
  ok(near(itemsT[1].dz - itemsT[0].dz, ka.height, 1e-9) && near(bbox(buildFaces(ps)).u1, 3, 1e-9), "Tiwanaku: la Puerta del Sol (3 m) está sobre la plataforma de Kalasasaya");
  ok(tw2.lat === ka.lat && byId("ponce").lat === ka.lat && near(offsetOf(tw2.lat, tw2.lon, byId("ponce").lat, byId("ponce").lon).az, 270, 0.01), "Tiwanaku: el punto de vista, la portada de Kalasasaya y la estela Ponce están en el mismo eje este–oeste");
  // Machu Picchu
  const ih = bbox(buildFaces(byId("intihuatana")));
  void ih;
  ok(near(ih.u1, 1.8, 0.01) && near(offsetOf(site("machupicchu").lat, site("machupicchu").lon, byId("intihuatana").lat, byId("intihuatana").lon).d, 5, 0.5), "Machu Picchu: el Intihuatana, 1,8 m, a 5 m del punto de vista");
  // Cochasquí y Machu Picchu (aproximados)
  const cq = MONUMENTS.filter((m) => m.site === "cochasqui"), mp = MONUMENTS.filter((m) => m.site === "machupicchu");
  ok(cq.length === 0 && monumentsNear(site("cochasqui").lat, site("cochasqui").lon, 25).length === 0, "Cochasquí: sin pirámides todavía (pendiente)");
  const mpi = placeMonuments(mp.filter((m) => m.id !== "intihuatana"), { lat: site("machupicchu").lat, lon: site("machupicchu").lon, ground: 2430 }, Object.fromEntries(mp.map((m) => [m.id, 2430])));
  ok(mp.length === 20 && mpi.every((it) => it.dz < -10) && mp.filter((m) => m.label !== false).length === 5 && mp.every((m) => m.id === "intihuatana" || /aproximad/.test(m.sub.es)), "Machu Picchu: templos y casas más abajo que la cima del Intihuatana, marcados como aproximados");
  // rótulos y relieve cercano
  const lab = monumentLabels(placeMonuments(tw, { lat: ch.lat, lon: ch.lon, ground: 187 }, Object.fromEntries(tw.map((m) => [m.id, 210]))), "es");
  ok(lab.length === 1 && lab[0].sub === "13 torres de 2 a 6 m de alto", "las Trece Torres llevan un solo rótulo, con su texto");
  const grid = { reach: 500, h: new Array(RELIEF_R.length * RELIEF_NA).fill(-10) };
  ok(near(reliefAt(grid, 0, 0), -1.7, 1e-9) && near(reliefAt(grid, 300, 0), -10, 1e-9) && reliefPoints(0, 0, 500).length === RELIEF_R.length * RELIEF_NA && RELIEF_R.length * RELIEF_NA <= 64,
    "relieve cercano: a los pies, 1,7 m bajo los ojos; lejos, el del modelo; cabe en una consulta");
  const far = { m: { id: "x", foot: 5 }, o: { e: 230, n: 0, d: 230 }, dz: 25 };
  ok(near(groundHeight(1, 0, [far], grid), reliefAt(grid, 1, 0), 1e-9) && near(groundHeight(230, 0, [far], grid), 25, 0.8), "con relieve, un monumento lejano no levanta el suelo bajo el observador, solo el suyo");
}

console.log("Integración");
const sky = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/createMonumentLayer\(/.test(sky) && /teseo_monuments/.test(sky) && /ref\.hzData = hzEff/.test(sky) && /monLabels/.test(sky), "el cielo dibuja los monumentos, oculta lo que tapan, los nombra y recuerda el interruptor");
ok(/horizon: hzData/.test(sky), "la ficha (salida y puesta tras las montañas) sigue con el relieve solo");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
