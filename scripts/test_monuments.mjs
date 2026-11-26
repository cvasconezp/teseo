// Pruebas de los monumentos (src/sky/monuments.js y monumentLayer.js): medidas, posición, ángulos tal como se
// verían desde el sitio, silueta para ocultar lo que queda detrás e integración en el cielo.
import { MONUMENTS, monumentsNear, buildFaces, toLocal, altAzOf, offsetOf, silhouette, withMonuments, groundRing, median, apexOf, footprintRadius, SH_STANDING, SH_LINTELS } from "../src/sky/monuments.js";
import { placeMonuments, onPlatform, monumentLabels, faceUV, toneAt, groundHeight, reliefAt, reliefPoints, RELIEF_R, RELIEF_NA, groundSilhouette } from "../src/sky/monumentLayer.js";
import { parseMachuModel, setMachuModel, modelGround, parseIntiScan, setIntiScan, intiScan } from "../src/sky/machuModel.js";
import { INTI_SCAN } from "../src/sky/intiScan.js";
import { allStops, stopsAt as allStopsAt, stopOf as allStopOf, onPiece } from "../src/sky/stops.js";
import { tierEdges, stairSteps, detailFor, tolaRings, llaqtaPlan, LLAQTA, MP_CONTROL, MP_RELIEF_FIX, mpReliefDelta, SITE_STOPS } from "../src/sky/monuments.js";
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
// (a 60 m del centro: dentro de su bulto, fuera de la plataforma de arriba)
ok(monumentsNear(sol.lat, sol.lon + 60 / (111320 * Math.cos(sol.lat * Math.PI / 180)), 25).every((m) => m.id !== "sol"), "desde dentro de una pirámide no se dibuja esa pirámide");
ok(monumentsNear(sol.lat, sol.lon, 25).every((m) => m.id !== "sol"), "ni desde su centro (no se sube a las pirámides)");
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
  const ch = site("chankillo"), tw = MONUMENTS.filter((m) => m.site === "chankillo" && m.kind === "tower");
  const azT = (m) => offsetOf(ch.lat, ch.lon, m.lat, m.lon);
  const sunAz = (dec) => Math.acos(Math.sin(dec * R2) / Math.cos(ch.lat * R2)) / R2;      // a 0° de altura
  ok(tw.length === 13 && tw.filter((m) => m.label !== false).length === 1 && tw.every((m) => m.height >= 2 && m.height <= 6 && m.w * m.d >= 75 && m.w * m.d <= 125),
    "Chankillo: trece torres de 2 a 6 m y 75 a 125 m², con un solo nombre");
  ok(near(azT(tw[6]).d, 235, 8) && near(offsetOf(tw[0].lat, tw[0].lon, tw[12].lat, tw[12].lon).d, 193, 6), "Chankillo: a unos 235 m del punto de observación; la fila mide unos 200 m");
  ok(near(azT(tw[12]).az, sunAz(-23.44), 2) && azT(tw[0]).az - sunAz(23.44) < 1.5 && azT(tw[0]).az - sunAz(23.44) > -1.5,
    "Chankillo: el Sol de diciembre sale por la torre 13 y el de junio junto a la torre 1 (Ghezzi y Ruggles 2007)");
  ok(monumentsNear(ch.lat, ch.lon, 25).filter((m) => m.kind === "tower").length === 13 && tw.every((m) => m.relief && groundRing(m, 8).every(([la, lo]) => offsetOf(m.lat, m.lon, la, lo).d < 4)),
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
  ok(buildFaces(byId("intihuatana")).length === 0, "sin el escaneo descargado, el Intihuatana no dibuja nada (queda su rótulo)");
  { const sb = readFileSync(new URL("../public/data/inti-scan.bin", import.meta.url)); setIntiScan(parseIntiScan(sb.buffer.slice(sb.byteOffset, sb.byteOffset + sb.byteLength))); }
  const ih = bbox(buildFaces(byId("intihuatana")));
  void ih;
  { const S = intiScan(), f = buildFaces(byId("intihuatana"));
    ok(byId("intihuatana").kind === "scan" && f.length >= S.cls.length && f.length - S.cls.length < 400 && S.f.length === 3 * S.cls.length && Math.max(...S.f) < S.v.length / 3 && /CC BY-NC 3\.0/.test(INTI_SCAN.credit) && /Arkansas/.test(INTI_SCAN.credit), "Machu Picchu: la cima del Intihuatana es la malla del escaneo láser, con su crédito y su licencia");
    ok(S.cls.filter((c) => c === 0).length > 9000 && S.cls.includes(1) && S.cls.includes(2) && f.some((x) => x.mat === "earth") && f.every((x) => x.uv && x.uv.length === 3) && f.some((x) => x.smooth), "la malla separa la roca tallada (más de 9.000 triángulos), los muros y el piso; va con luz suave y textura proyectada"); }
  ok(near(Math.max(...Array.from(intiScan().cls).flatMap((c, t) => (c === 0 ? [0, 1, 2].map((j) => intiScan().v[3 * intiScan().f[3 * t + j] + 2] / 100) : []))), 1.68, 0.03) && ih.u1 < 3 && near(offsetOf(site("machupicchu-intihuatana").lat, site("machupicchu-intihuatana").lon, byId("intihuatana").lat, byId("intihuatana").lon).d, 5, 0.5), "Machu Picchu: el gnomon del Intihuatana, 1,68 m sobre el piso (medido), a 5 m del punto de vista");
  // Cochasquí y Machu Picchu (aproximados)
  const cq = MONUMENTS.filter((m) => m.site === "cochasqui"), mp = MONUMENTS.filter((m) => m.site === "machupicchu");
  { const pyr = cq.filter((m) => m.kind === "tola"), mounds = cq.filter((m) => m.kind === "mound"), L = (x) => byId("cq-" + x);
    ok(pyr.length === 15 && pyr.map((m) => m.name.es.slice(-1)).join("") === "ABCDEFGHJKLMNOP" && mounds.length === 11 && cq.every((m) => m.relief), "Cochasquí: las quince pirámides (A–P, sin la I) y once montículos funerarios, sobre la ladera");
    ok(pyr.filter((m) => m.ramp > 0).map((m) => m.name.es.slice(-1)).join("") === "BCEFGJKLM" && pyr.every((m) => m.rot === (m.id === "cq-g" ? 33 : 27.6)), "con rampa: B, C, E, F, G, J, K, L y M; giradas 27,6° (el eje medido de la rampa de la E), y la G, 33° (el de la suya)");
    ok(near(L("g").w * 0.72, 76.5, 2) && near(L("g").d * 0.72, 61, 3) && near(L("g").w + 10.5, 117, 8) && /21 m/.test(L("g").sub.es) && !/estimado/.test(L("g").sub.es) && !/estimado/.test(L("e").sub.es) && L("g").rampW > 1, "la G con sus medidas publicadas: plataforma de 75–78 × 58–64 m, base de 110–125 m, 21 m por el lado bajo y rampa ancha");
    ok(L("e").ramp === 67 && near(L("e").d * 0.72, 49, 2.5) && near(L("e").w * 0.72, 30, 1) && L("g").w > L("m").w && L("m").ramp > 200 && L("g").height >= pyr.reduce((a, m) => Math.max(a, m.height), 0), "la E con las medidas de Oberem (plataforma de 51 × 28 m, rampa de 67 m); la G es la mayor y la M tiene una rampa de más de 200 m");
    // en el plano, la E queda entre la D (al oeste) y la F; la G, al sur de la F; la K y la L, hacia el sureste; la M, al suroeste
    const E = (x) => offsetOf(L("g").lat, L("g").lon, L(x).lat, L(x).lon);
    ok(E("d").e < E("e").e && E("e").e < E("f").e && E("f").n > 80 && E("k").e > 100 && E("k").n < -60 && E("l").e > E("k").e && E("m").e < -150 && E("m").n < -100 && E("a").n > 200, "disposición del plano de Wentscher: D–E–F en la fila alta, G en el centro, K y L al sureste, M al suroeste, A arriba");
    ok(cq.every((m) => /estimado|diámetro|lado bajo/.test(m.sub.es)) && monumentsNear(site("cochasqui").lat, site("cochasqui").lon, 25).length === 26, "cada una dice que su alto es estimado o medido; desde el lugar se cargan las 26 piezas (también la G, bajo los pies)");
    // el suelo: pocas consultas de altura (4 anillos de 8 puntos para las grandes y un punto para el resto)
    ok(cq.filter((m) => m.ring == null).length === 4 && cq.filter((m) => m.ring == null).length * 8 + cq.filter((m) => m.ring != null).length + 5 <= 80, "las alturas del terreno caben en una sola consulta (menos de 80 puntos)");
    // gastadas por la lluvia: hombro redondeado, plataforma apenas abombada y caras suaves; las medidas no cambian
    { const G = L("g"), fg = buildFaces(G), bg = bbox(fg);
      const { rings, top } = tolaRings({ H: G.height, DEEP: -16, wb: G.w + 10.5, db: G.d + 10.5, wt: G.w * 0.72, dt: G.d * 0.72 });
      const atH = rings.filter((r) => Math.abs(r.z - G.height) < 1e-9);
      ok(near(top, G.height + 0.3, 1e-9) && near(bg.u1, G.height + 0.3, 1e-6) && atH.length >= 1 && atH.every((r) => r.a < G.w * 0.36) && rings.some((r) => r.z === 0 && r.a > (G.w + 10.5) / 2), "tola gastada: plataforma a su alto (0,3 m de abombado), arista redondeada hacia dentro y pie algo abierto");
      ok(fg.filter((x) => x.smooth).length > fg.length * 0.9, "cuerpo y rampa de caras suaves (sin aristas de cuchillo)"); }
    const f = buildFaces(byId("cqm-a")), bb = bbox(f);
    ok(near(bb.u1, 5, 1e-9) && bb.u0 <= -3.9 && f.length < 400, "los montículos: cúpula baja con faldón bajo la base (en ladera no queda hueco) y pocas caras");
    ok(mounds.filter((m) => /funerario [a-gmx]$/.test(m.name.es)).length === 9 && mounds.filter((m) => m.label).length === 1, "nueve montículos llevan su letra (a–g, m, x); solo el «a» muestra el nombre a la vista");
    { const k = buildFaces(L("k")).length, j = buildFaces(L("j")).length, l = buildFaces(L("l")).length;
      ok(L("k").rampsN === 2 && j === l && k > j && (k - j) % 2 === 0, "la K tiene además sus dos rampas pequeñas hacia el norte (dos rampas iguales de más)"); }
    { // asiento: con el relieve cercano, cada pieza queda a la altura del suelo dibujado en su sitio (no en el aire)
      const s1 = { lat: 0.054507, lon: -78.306662 }, near1 = monumentsNear(s1.lat, s1.lon, 25), bases = Object.fromEntries(near1.map((m) => [m.id, 3140]));
      const grid = { reach: 900, h: Array.from({ length: RELIEF_R.length * RELIEF_NA }, (_, i) => { const a = ((i % RELIEF_NA) / RELIEF_NA) * 2 * Math.PI, r = RELIEF_R[Math.floor(i / RELIEF_NA)] * 900; return 0.18 * r * Math.cos(a - 0.5) - 1.7; }) };
      const flat = placeMonuments(near1, { lat: s1.lat, lon: s1.lon, ground: 3100 }, bases), seated = placeMonuments(near1, { lat: s1.lat, lon: s1.lon, ground: 3100 }, bases, grid);
      ok(flat.every((it) => near(it.dz, 40 - 1.7, 1e-9)) && seated.every((it) => near(it.dz, reliefAt(grid, it.o.e, it.o.n), 1e-9)) && cq.every((m) => m.seat) && !byId("chankillo-1").seat, "con el relieve cercano, cada pieza de Cochasquí se asienta sobre el mismo suelo que se dibuja (las de otros sitios, no)"); }
    { // la ladera no se aplana bajo las piezas asentadas, y el suelo tapa lo enterrado
      const lay = readFileSync(new URL("../src/sky/monumentLayer.js", import.meta.url), "utf8");
      const grid = { reach: 900, h: new Array(RELIEF_R.length * RELIEF_NA).fill(5) }, it = [{ m: { ...L("k") }, o: { e: 100, n: 100, d: 141 }, dz: 40 }];
      ok(near(groundHeight(100, 100, it, grid), groundHeight(100, 100, [], grid), 1e-9) && groundHeight(100, 100, [{ ...it[0], m: { ...L("k"), seat: false } }], grid) > 30 && /depthWrite: true, \.\.\.\(ground \? \{ polygonOffset: true/.test(lay), "una pieza asentada no levanta el suelo a su alrededor; el suelo escribe profundidad (tapa lo enterrado)"); }
    { // el lugar: de pie en el vértice oeste de la plataforma de la G; los ojos a 1,7 m sobre ella y todo lo demás, más abajo
      const sg = site("cochasqui"), nearG = monumentsNear(sg.lat, sg.lon, 25), bases = Object.fromEntries(nearG.map((m) => [m.id, 3100]));
      const items = placeMonuments(nearG, { lat: sg.lat, lon: sg.lon, ground: 3100 }, bases), g = items.find((it) => it.m.id === "cq-g");
      ok(!SITES.some((x) => x.id === "cochasqui-g") && g && onPlatform(g.m, g.o) && g.o.e > 35 && g.o.e < 50 && Math.abs(g.o.n) < 12 && near(Math.hypot(g.o.e, g.o.n), 44, 3), "un solo lugar «Cochasquí»: en el vértice oeste de la plataforma de la G (su centro queda 44 m al este), unos 5 m hacia dentro");
      ok(near(g.dz + L("g").height, -1.7, 1e-9) && near(items.up, L("g").height, 1e-9) && items.filter((it) => it.m.id !== "cq-g").every((it) => near(it.dz, -1.7 - L("g").height, 1e-9)), "la plataforma queda 1,7 m bajo los ojos y las demás pirámides, 14 m más abajo");
      ok(near(groundHeight(300, 0, items), -1.7 - L("g").height, 0.5) && !monumentLabels(items, "es").some((l) => /Pirámide G/.test(JSON.stringify(l))), "el suelo baja con ellas y la G no lleva etiqueta bajo los pies");
      // fuera de la plataforma (el borde está a 5 m; 12 m más al oeste ya es ladera) no se está «subido»
      ok(!onPlatform(g.m, { e: g.o.e + 12, n: g.o.n - 1.3 }) && onPlatform(g.m, { e: 0, n: 0 }) && !onPlatform(L("m"), { e: 0, n: 0 }), "solo cuenta como «subido» dentro del rectángulo de la plataforma, y solo en la G"); }
  }

  // Machu Picchu: la llaqta entera (planta de OpenStreetMap) sobre el relieve
  { const ll = byId("mp-llaqta"), plan = llaqtaPlan(ll.skip, ll.clear), here = site("machupicchu-intihuatana");
    ok(plan.rooms.length === 98 && plan.terraces.length === 173 && llaqtaPlan(ll.skip).terraces.length === 171 && plan.walls.length === 18 && plan.steps.length === 24 && plan.rooms.filter((r) => r.gables.length === 2).length > 60, "llaqta: 98 recintos (tres tienen pieza propia), 171 andenes (173 tramos al despejar la huella del escaneo del Intihuatana), 18 muros y 24 escalinatas; la mayoría de los recintos, con dos hastiales");
    const all = [...plan.rooms.flatMap((r) => r.pts), ...plan.terraces.flat(), ...plan.walls.flat(), ...plan.steps.flat()];
    ok(all.every((q) => Math.hypot(q[0], q[1]) <= 441) && ll.foot === 440 && ll.walkIn && ll.label === false && ll.seat === "ground" && ll.reliefGrid.na * ll.reliefGrid.radii.length === 432, "todo a menos de 440 m del Intihuatana; rejilla de relieve propia (12 × 36)");
    // sobre una ladera que baja hacia el este: los muros siguen el suelo y los andenes hacen bancal
    const slope = (e) => -0.3 * e, f0 = buildFaces(ll), f1 = buildFaces(ll, { ground: slope });
    const zAt = (fs) => { let lo = Infinity, hi = -Infinity; for (const f of fs) for (const v of f.v) if (v[0] > 150) { lo = Math.min(lo, v[2]); hi = Math.max(hi, v[2]); } return [lo, hi]; };
    ok(f0.length === f1.length && f0.length > 9000 && zAt(f0)[1] < 8 && zAt(f1)[1] < -30 && zAt(f1)[0] > -150, "13 mil caras; con relieve, lo del este queda decenas de metros más abajo");
    ok(f1.some((f) => f.mat === "incafine") && f1.some((f) => f.mat === "incarustic") && f1.some((f) => f.mat === "heath") && ["mp-tres-ventanas", "mp-templo-principal", "mp-torreon"].every((id) => byId(id).mat === "incafine"), "dos labras: sillares finos en templos y Casa del Inca, mampostería rústica en lo demás; bancales de hierba");
    // colocación: todo se asienta sobre el suelo que se dibuja; la llaqta recibe ese suelo
    const grid = { reach: 660, ...ll.reliefGrid, h: new Array(432).fill(-20) };
    const items = placeMonuments(mp, { lat: here.lat, lon: here.lon, ground: 2449 }, Object.fromEntries(mp.map((m) => [m.id, 2449])), grid);
    const it = (id) => items.find((x) => x.m.id === id);
    ok(items.length === mp.length && it("intihuatana").dz > -6 && it("intihuatana").dz < -1.5 && it("mp-roca-sagrada").dz < -15 && near(it("mp-llaqta").dz, -1.7, 0.2), "a los pies manda el suelo del observador; lejos, el relieve (la Roca Sagrada, 20 m más abajo)");
    ok(mp.length === 13 && mp.filter((m) => m.kind === "mark").every((m) => buildFaces(m).length === 0 && /OpenStreetMap|explanada/.test(m.sub.es)) && mp.filter((m) => m.label !== false).length === 12, "13 piezas: la llaqta, cuatro con forma propia, el Intihuatana y siete rótulos de lugares");
    ok(f1.filter((f) => f.mat === "thatch").length === 7 * 4 && f1.filter((f) => f.mat === "door").length > 300 && byId("mp-torreon").height === 3.2, "siete recintos restaurados con techo de paja a dos aguas; puertas y ventanas de hastial en los recintos; Torreón de 3,2 m (JICA)");
    { const at = (e, n) => mpReliefDelta(-13.16312 + n / 110574, -72.545683 + e / (111320 * Math.cos(13.16312 * Math.PI / 180)));
      ok(MP_RELIEF_FIX.every((c) => c[3] === "jica" || c[3] === "maqueta") && MP_RELIEF_FIX.filter((c) => c[3] === "jica").every((c) => Math.abs(c[2]) <= 1) && at(0, 0) - at(70, 5) > 11 && at(0, 0) - at(70, 5) < 14.5 && at(104.9, -250.6) === 0 && at(500, 400) === 0 && Math.abs(at(100.7, -108.6)) < 1,
        "corrección del relieve: cada punto con su fuente; la colina del Intihuatana sube unos 12–14 m respecto a la plaza; las cotas de JICA casi no se tocan; fuera del sitio, nada"); }
    { const st = SITE_STOPS.machupicchu, pin = (q, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const u = poly[i], v = poly[j]; if ((u[1] > q[1]) !== (v[1] > q[1]) && q[0] < ((v[0] - u[0]) * (q[1] - u[1])) / (v[1] - u[1]) + u[0]) c = !c; } return c; };
      const ll2 = byId("mp-llaqta"), rooms = llaqtaPlan(ll2.skip, ll2.clear).rooms, en = (s0) => { const o = offsetOf(ll2.lat, ll2.lon, s0.lat, s0.lon); return [o.e, o.n]; };
      ok(st.length === 8 && new Set(st.map((s0) => s0.id)).size === 8 && st.every((s0) => s0.name.es && s0.name.en && s0.elev > 2400 && s0.elev < 2500 && s0.at.every((id) => byId(id))), "puntos de visita de Machu Picchu: ocho, con nombre en los dos idiomas, altitud y rótulos que existen");
      // la maqueta del Ministerio de Cultura (public/data/machu-maqueta.bin)
      const bin = readFileSync(new URL("../public/data/machu-maqueta.bin", import.meta.url)), mm = parseMachuModel(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
      ok(mm.nv > 12000 && mm.nt > 25000 && mm.nv < 65536 && Math.max(...mm.cls) <= 6, "maqueta: se lee el archivo (vértices, triángulos y clases)");
      ok(near(modelGround(0, 0, mm), 2452.7, 0.2) && near(modelGround(74.3, 2.5, mm), 2425.5, 0.3) && modelGround(104.9, -250.6, mm) === null && modelGround(900, 900, mm) === null && near(modelGround(132.9, -192, mm), 2463.3, 0.3), "maqueta: la cima del Intihuatana a 2.452,7 m, la plaza a 2.425,5 m; fuera de ella no hay suelo");
      ok(st.filter((s0) => modelGround(...en(s0), mm) != null).length === 8 && st.every((s0) => { const g0 = modelGround(...en(s0), mm); return g0 == null || Math.abs(g0 - s0.elev) < 1; }) && st.every((s0) => s0.look >= 0 && s0.look < 360), "los puntos de visita: los ocho sobre el suelo de la maqueta, con su altitud y un rumbo de mirada");
      { ok(buildFaces(ll2).some((f) => f.mat === "door"), "sin la maqueta cargada, la llaqta sigue saliendo de la planta de OpenStreetMap");
        setMachuModel(mm); const fm = buildFaces(ll2), tor = buildFaces(byId("mp-torreon"));
        ok(fm.length > 25000 && fm.some((f) => f.mat === "thatch") && fm.some((f) => f.mat === "heath") && fm.some((f) => f.mat === "inca") && fm.some((f) => f.mat === "incarustic") && !fm.some((f) => f.mat === "door") && tor.length === 0, "con la maqueta: terreno, andenes, muros finos y rústicos y techos; el Torreón propio no se dibuja dos veces");
        const here = { lat: st[2].lat, lon: st[2].lon, ground: 2440 }, o2 = offsetOf(ll2.lat, ll2.lon, here.lat, here.lon), abs0 = modelGround(o2.e, o2.n, mm);
        const rl = { reach: 440, radii: [0.5, 1], na: 4, h: new Array(8).fill(-1.7), abs0, exact: (e, n) => { const a0 = modelGround(o2.e + e, o2.n + n, mm); return a0 == null ? null : a0 - abs0 - 1.7; } };
        const it2 = placeMonuments([ll2, byId("intihuatana")], here, { [ll2.id]: 2440, intihuatana: 2440 }, rl);
        ok(near(it2[0].dz, 2400 - abs0 - 1.7, 1e-6) && near(it2[1].dz, 2452.8 - abs0 - 1.7, 1e-6) && near(groundHeight(0, 0, [], rl), -1.7, 1e-6), "con la maqueta, cada pieza va a su cota: la maqueta, el escaneo del Intihuatana y los pies del observador");
        const gs = groundSilhouette([], rl, 0.2);
        ok(gs.length === 1800 && Math.max(...gs) > 3 && Math.min(...gs) < 0, "el suelo del sitio entra en la silueta: donde sube sobre el horizonte, tapa el cielo");
        setMachuModel(null); }
      // los demás sitios: puntos calculados frente a sus piezas principales
      { const A = allStops(), names = Object.keys(A).sort().join(",");
        ok(names === "abusimbel,angkorwat,avebury,brodgar,cahokia,catequilla,chankillo,chichenitza,cochasqui,coliseo,dowth,giza,greatcircle,housesteads,ingapirca,karnak,knowth,machupicchu,maeshowe,maidencastle,newark,newgrange,paranal,povertypoint,serpentmound,silbury,stenness,stonehenge,teotihuacan,tiwanaku" && Object.values(A).every((L) => L.length >= 2 && new Set(L.map((q) => q.id)).size === L.length), "puntos de visita en veintisiete sitios; cada uno, al menos la vista general y otro");
        { const air = Object.entries(A).filter(([s]) => s !== "paranal").map(([s, L]) => [s, L.filter((q) => q.air)]);
          ok(air.every(([, L]) => L.length >= 1 && L.every((q) => q.air >= 40 && q.air <= 220 && q.lookAlt < 0)) && A.giza.filter((q) => q.air).length === 2 && A.machupicchu.filter((q) => q.air).length === 6 && A.stonehenge.filter((q) => q.air).length === 2 && !A.paranal.some((q) => q.air),
            "tomas aéreas en los sitios arqueológicos: una en los compactos (Stonehenge suma una oblicua sobre el eje del solsticio), varias en los extensos (Guiza, dos; Machu Picchu, la ciudad entera y cinco sectores), entre 40 y 220 m, mirando hacia abajo"); }
        { const bad2 = []; for (const [s, L] of Object.entries(A)) for (const q of L.filter((x) => x.air)) for (const m of MONUMENTS.filter((m) => (m.site || m.id) === s)) { const o = offsetOf(q.lat, q.lon, m.lat, m.lon); if (!m.lidar && o.d <= footprintRadius(m) && (m.labelAt ? m.height || 0 : apexOf(m)[2] || m.height || 0) > q.air - 30) bad2.push(s + ":" + q.id); }
          ok(bad2.length === 0, "ninguna toma aérea queda dentro de una pieza: siempre 30 m o más por encima de lo que tiene debajo" + (bad2.length ? " — " + bad2.join(" ") : "")); }
        { const bad3 = [], bad4 = [];
          for (const [s, L] of Object.entries(A)) for (const q of L.filter((x) => x.air)) {
            const near = monumentsNear(q.lat, q.lon, 25, { air: q.air }), own = MONUMENTS.filter((m) => (m.site || m.id) === s && offsetOf(q.lat, q.lon, m.lat, m.lon).d <= Math.min(25000, m.far || Infinity));
            if (!near.length || own.some((m) => !near.includes(m))) bad3.push(s + ":" + q.id);
            if (L.some((x) => !x.air && offsetOf(q.lat, q.lon, x.lat, x.lon).d < 6) || allStopsAt(q.lat, q.lon).here !== q.id) bad4.push(s + ":" + q.id); }
          ok(bad3.length === 0, "desde cada toma aérea se dibujan todas las piezas de su sitio, también la que queda debajo" + (bad3.length ? " — " + bad3.join(" ") : ""));
          ok(bad4.length === 0, "ninguna toma aérea coincide con un punto en tierra (de pie en la vista general no se sube al aire)" + (bad4.length ? " — " + bad4.join(" ") : "")); }
        const bad = [];
        for (const [sid, L] of Object.entries(A)) { if (sid === "machupicchu") continue; const ps = MONUMENTS.filter((m) => m.site === sid && m.kind !== "walls" && !m.modelOnly);
          for (const q of L.slice(1)) { if (q.air || !q.at.length || !byId(q.id)) continue; const m0 = byId(q.id), o0 = offsetOf(q.lat, q.lon, m0.lat, m0.lon);
            if (!(Math.abs(((o0.az - q.look + 540) % 360) - 180) < 1.5) || ps.some((m) => onPiece(m, q.lat, q.lon, m === m0 ? 2 : 3)) || offsetOf(L[0].lat, L[0].lon, q.lat, q.lon).d < 40) bad.push(sid + ":" + q.id); } }
        ok(bad.length === 0, "cada punto calculado mira a su pieza, queda fuera de su planta, no pisa ninguna otra y está a más de 40 m de la vista general" + (bad.length ? " — " + bad.join(" ") : ""));
        { const T = A.tiwanaku, d01 = offsetOf(T[0].lat, T[0].lon, T[1].lat, T[1].lon).d, ak = byId("akapana");
          ok(T.length === 3 && T[2].air > 0 && d01 > 150 && T[1].look === 270 && offsetOf(T[1].lat, T[1].lon, ak.lat, ak.lon).d > footprintRadius(ak), "Tiwanaku: la vista general (el frente de Kalasasaya) y Akapana desde el este, fuera de su radio y lejos de la vista general"); }
        const tw = allStopsAt(A.tiwanaku[1].lat, A.tiwanaku[1].lon);
        ok(tw.site === "tiwanaku" && tw.here === A.tiwanaku[1].id && allStopsAt(0, 0) === null && allStopOf("keops").id === "keops" && allStopOf("mp-torreon").id === "sol", "stopsAt y stopOf funcionan en todos los sitios"); }
      ok(allStopsAt(st[2].lat, st[2].lon).here === "plaza" && allStopsAt(st[0].lat + 0.0003, st[0].lon).here === null && allStopsAt(0, -78) === null && allStopOf("mp-torreon").id === "sol" && allStopOf("ponce") === null, "stopsAt dice en qué punto se está; stopOf lleva de un rótulo a su punto"); }
    { // con dos sitios al alcance, el más cercano (antes, el primero de la tabla)
      const T = { a: [{ id: "a0", lat: 0, lon: 0, at: [] }], b: [{ id: "b0", lat: 0.005, lon: 0, at: [] }] };
      const r = allStopsAt(0.004, 0, 1500, T);
      ok(r && r.site === "b" && allStopsAt(0.001, 0, 1500, T).site === "a" && allStopsAt(0.03, 0, 1500, T) === null, "stopsAt elige el sitio más cercano dentro del alcance, no el primero");
      const A2 = allStops(), wrong = [];
      for (const [sid, L] of Object.entries(A2)) for (const q of L) { const h = allStopsAt(q.lat, q.lon); if (!h || h.site !== sid) wrong.push(sid + ":" + q.id); }
      ok(wrong.length === 0, "cada punto de visita cae en su propio sitio", wrong.join(" "));
      ok(!/export function stopsAt|export const stopOf/.test(readFileSync(new URL("../src/sky/monuments.js", import.meta.url), "utf8")), "sin la copia vieja de stopsAt/stopOf en monuments.js (la buena es stops.js)"); }
    ok(MP_CONTROL.length === 2 && near(MP_CONTROL[0].m, 2429.59, 1e-9) && MP_CONTROL[1].m > 2436 && MP_CONTROL[1].m < 2437.5, "cotas de control de JICA: Templo del Sol y Plaza Sagrada");
    ok(near(byId("mp-templo-principal").height, 4.05, 1e-9) && byId("mp-templo-principal").w === 11 && byId("mp-roca-sagrada").w === 7 && byId("mp-roca-sagrada").height === 3 && near(LLAQTA.wallT, 0.85, 1e-9), "medidas publicadas: Templo Principal 11 × 8 × 4,05 m, Roca Sagrada 7 × 3 m, muros de 0,85 m"); }
  // rótulos y relieve cercano
  const lab = monumentLabels(placeMonuments(tw, { lat: ch.lat, lon: ch.lon, ground: 187 }, Object.fromEntries(tw.map((m) => [m.id, 210]))), "es");
  ok(lab.length === 1 && lab[0].sub === "13 torres de 2 a 6 m de alto", "las Trece Torres llevan un solo rótulo, con su texto");
  const grid = { reach: 500, h: new Array(RELIEF_R.length * RELIEF_NA).fill(-10) };
  ok(near(reliefAt(grid, 0, 0), -1.7, 1e-9) && near(reliefAt(grid, 300, 0), -10, 1e-9) && reliefPoints(0, 0, 500).length === RELIEF_R.length * RELIEF_NA && RELIEF_R.length * RELIEF_NA <= 64,
    "relieve cercano: a los pies, 1,7 m bajo los ojos; lejos, el del modelo; cabe en una consulta");
  const far = { m: { id: "x", foot: 5 }, o: { e: 230, n: 0, d: 230 }, dz: 25 };
  ok(near(groundHeight(0, 0, [far], grid), -1.7, 0.05) && near(groundHeight(0, 0, [{ ...far, o: { e: 30, n: 0, d: 30 } }], grid), -1.7, 0.6) && near(groundHeight(230, 0, [far], grid), 25, 0.8), "con relieve, ningún monumento (ni uno cercano y más alto) levanta el suelo bajo los pies del observador");
}

console.log("Integración");
const sky = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/createMonumentLayer\(/.test(sky) && /teseo_monuments/.test(sky) && /ref\.hzData = hzEff/.test(sky) && /monLabels/.test(sky), "el cielo dibuja los monumentos, oculta lo que tapan, los nombra y recuerda el interruptor");
ok(/horizon: hzData/.test(sky), "la ficha (salida y puesta tras las montañas) sigue con el relieve solo");


// fichas de las estructuras
{ const { MON_INFO, shapeCredit } = await import("../src/sky/monumentInfo.js"); const ck = ok;
  console.log("Fichas de las estructuras");
  ck(Object.keys(MON_INFO).every((id) => MONUMENTS.some((m) => m.id === id)), "cada ficha es de una estructura que existe");
  ck(Object.values(MON_INFO).every((f) => f.kind.es && f.kind.en && f.body.es.length === f.body.en.length && (!f.facts || f.facts.es.length === f.facts.en.length) && (!f.teseo || (f.teseo.es && f.teseo.en)) && f.sources.length >= 1 && f.sources.every((q) => q.label && (!q.url || /^https:\/\//.test(q.url)))), "cada ficha va en los dos idiomas y con sus fuentes");
  ck(MONUMENTS.filter((m) => m.label !== false && !m.modelHide && !MON_INFO[m.id]).length === 0, "todas las estructuras con rótulo tienen ficha");
  ck(/reconstrucción|modelo 3D propio/.test(shapeCredit("akapana", "tiwanaku").text) && /Ghezzi y Ruggles/.test(shapeCredit("chankillo-7", "chankillo").text) && /ESO/.test(shapeCredit("vlt-ut1", "paranal").text), "el crédito de la forma nombra de dónde salen las medidas cuando se sabe");
  ck(/28 de octubre/.test(MON_INFO.intihuatana.teseo.es) && /13 de febrero/.test(MON_INFO.intihuatana.teseo.es) && /equinoccios no/.test(MON_INFO.intihuatana.teseo.es), "Intihuatana: el paso cenital (28 de octubre y 13 de febrero), no los equinoccios");
  ck(shapeCredit("intihuatana", "machupicchu") === null && /CC BY 4\.0/.test(shapeCredit("mp-condor", "machupicchu").text) && /modelo 3D propio/.test(shapeCredit("mp-templo-principal", "machupicchu").text) && /modelo 3D propio/.test(shapeCredit("akapana", "tiwanaku").text) && /own 3D model/.test(shapeCredit("keops", "giza", "en").text), "toda estructura dice de dónde sale su forma: la maqueta (CC BY 4.0) o una reconstrucción propia");
}

{
  // Chankillo: el punto de observación este y las torres sobre su cresta
  const { stopsAt } = await import("../src/sky/stops.js");
  const { offsetOf } = await import("../src/sky/monuments.js");
  const { volcanoesOnSkyline } = await import("../src/sky/volcanoes.js");
  const st = stopsAt(-9.561185, -78.229591).stops, este = st.find((q) => q.id === "este");
  const b1 = offsetOf(este.lat, este.lon, MONUMENTS.find((m) => m.id === "chankillo-1").lat, MONUMENTS.find((m) => m.id === "chankillo-1").lon);
  const b13 = offsetOf(este.lat, este.lon, MONUMENTS.find((m) => m.id === "chankillo-13").lat, MONUMENTS.find((m) => m.id === "chankillo-13").lon);
  ok(!!este && este.look === 270 && b1.d > 190 && b1.d < 240 && Math.abs(b1.az - 293.8) < 2.5 && Math.abs(b13.az - 246.2) < 2.5, "Chankillo: el punto este queda a unos 200 m y ve los ocasos de los solsticios en los extremos de la fila");
  ok(MONUMENTS.filter((m) => m.site === "chankillo" && m.kind === "tower").every((m) => m.crest && m.reliefGrid && m.reliefGrid.na * m.reliefGrid.radii.length <= 400), "Chankillo: las torres no allanan la ladera y piden una rejilla de relieve fina");
  // el rótulo de un volcán va al filo que está a SU distancia, no a una ladera cercana más alta en la misma ventana
  const n = 1800, alt = new Array(n).fill(0), near = new Array(n).fill(0), far = new Array(n).fill(0), dn = new Array(n).fill(0.3), df = new Array(n).fill(35.5);
  for (let i = 0; i < n; i++) { const az = i * 0.2; near[i] = 4.3 + (95 - az) * 0.1; far[i] = 4.27 - Math.abs(az - 95.6) * 1.2; alt[i] = Math.max(near[i], far[i]); }
  const hz = { alt, step_deg: 0.2, ground_m: 3031, eye_m: 1.7, bands: [{ alt: near, dist_km: dn }, { alt: far, dist_km: df }] };
  const ang = (h, d, h0) => Math.atan2(h - h0 - (d * d * 1000) / (2 * 6371 * 1.15), d * 1000) * 180 / Math.PI;
  const v = [{ id: 1, name: "Cayambe", lat: 0.029, lon: -77.986, elev_m: 5790 }];
  const withB = volcanoesOnSkyline(v, hz, 0.055947, -78.307397, ang), noB = volcanoesOnSkyline(v, { ...hz, bands: undefined }, 0.055947, -78.307397, ang);
  ok(withB.length === 1 && Math.abs(withB[0].az - 95.6) < 0.25 && noB.length === 1 && noB[0].az < 93, "el rótulo del Cayambe desde Cochasquí va a su cumbre, no a la ladera cercana");
}
{
  // Chankillo completo: templo (maqueta del Ministerio de Cultura), edificio de observación, plaza y recintos
  const fs = await import("node:fs");
  const { parseTonedModel, modelGround, CHANKILLO_BASE_M } = await import("../src/sky/machuModel.js");
  const { isAloof, groundReach } = await import("../src/sky/monumentLayer.js");
  const { stopsAt } = await import("../src/sky/stops.js");
  const { MON_INFO, shapeCredit } = await import("../src/sky/monumentInfo.js");
  const { offsetOf, buildFaces } = await import("../src/sky/monuments.js");
  const by = (id) => MONUMENTS.find((m) => m.id === id);
  const b = fs.readFileSync(new URL("../public/data/chankillo-templo.bin", import.meta.url)), mdl = parseTonedModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), CHANKILLO_BASE_M);
  const gS = modelGround(-8.8, -5.2, mdl), gR = modelGround(-1.1, -55.8, mdl);
  ok(mdl.nv < 65536 && mdl.nt > 80000 && b.length < 1.3e6 && mdl.tone.length === mdl.nt && mdl.cls.every((c) => c < 2), "templo de Chankillo: maqueta de menos de 1,3 MB, con clase y tono por cara");
  { let w = 0, top = 0; for (let t = 0; t < mdl.nt; t++) if (mdl.cls[t] === 0) w++; const F = buildFaces(by("chankillo-templo")).filter((f) => f.mat === "chkstone"); for (const f of F) for (const q of f.v) top = Math.max(top, q[2]);
    ok(w > 9000 && w < 18000 && (F.length === w || F.length === 0), `templo de Chankillo: ${w} caras de muro (clase 0), de piedra gris, como los recintos, y sin suavizar`); }
  ok(gS > 309 && gS < 313 && gR > 303 && gR < 308 && modelGround(400, 0, mdl) == null, "templo de Chankillo: el suelo de la maqueta está a su cota (unos 310 m en lo alto) y fuera no hay");
  const T = by("chankillo-templo"), O = by("chankillo-obs"), E = by("chankillo-este");
  const mouth = offsetOf(-9.561185, -78.229591, O.lat, O.lon);
  ok(T && T.model === "chankillo" && T.modelOnly && T.absBase === CHANKILLO_BASE_M && offsetOf(by("chankillo-7").lat, by("chankillo-7").lon, T.lat, T.lon).d > 950, "el Templo Fortificado está a 1 km al noroeste de las torres, con su maqueta");
  ok(O.kind === "walls" && O.segs.length === 8 && mouth.d < 60 && buildFaces(O).length === O.segs.length * 10 && E.segs.length === 23 && MONUMENTS.filter((m) => m.kind === "walls").every((m) => m.height <= 1), "edificio de observación y recintos del este: muros trazados de 1 m como máximo (ruinas: no se reconstruye su alzado); el punto oeste queda junto al edificio");
  const st = stopsAt(-9.561185, -78.229591).stops;
  ok(st.slice(0, 6).map((q) => q.id).join(",") === "vista,chankillo-7,este,recintos,templo,templo-aire" && st[5].air === 60 && st.slice(6).every((q) => q.air) && st[0].name.es === "Punto de observación oeste" && st[0].at[0] === "chankillo-obs" && modelGround(...(() => { const o = offsetOf(T.lat, T.lon, st[4].lat, st[4].lon); return [o.e, o.n]; })(), mdl) != null, "Chankillo: seis puntos de visita más sus tomas aéreas; el del templo cae sobre el suelo de su maqueta");
  ok(["chankillo-templo", "chankillo-obs", "chankillo-este"].every((id) => MON_INFO[id] && MON_INFO[id].sources.length >= 3) && /Ministerio de Cultura/.test(shapeCredit("chankillo-templo", "chankillo").text) && /CC BY 4\.0/.test(shapeCredit("chankillo-templo", "chankillo").text) && /trazaron a mano/.test(shapeCredit("chankillo-obs", "chankillo").text) && /Ghezzi y Ruggles \(2007\)/.test(shapeCredit("chankillo-7", "chankillo").text), "Chankillo: fichas con fuentes y crédito de la forma de cada pieza");
  { const { placeMonuments } = await import("../src/sky/monumentLayer.js"); const T0 = by("chankillo-templo"), q = { lat: -9.556924, lon: -78.236026 };
    const base = placeMonuments([T0], { ...q, ground: 300 }, { [T0.id]: 300 }), air = placeMonuments([T0], { ...q, ground: 300, air: 60 }, { [T0.id]: 300 });
    ok(air.up === 60 && Math.abs(air[0].dz - (base[0].dz - 60)) < 1e-9, "«Templo desde el aire»: los ojos suben 60 m y todo lo demás baja lo mismo"); }
  // los rótulos se apoyan en su propia pieza: nunca más de 3° por encima de su cima (antes subían al borde de otra pieza delante)
  { const { placeMonuments, monumentLabels } = await import("../src/sky/monumentLayer.js"); const { silhouette, toLocal } = await import("../src/sky/monuments.js"); const bad = [];
    for (const [s, L] of Object.entries(allStops())) for (const q of L) {
      const near = monumentsNear(q.lat, q.lon, 25, { air: q.air || 0 }), items = placeMonuments(near, { lat: q.lat, lon: q.lon, ground: 100, air: q.air || 0 }, Object.fromEntries(near.map((m) => [m.id, 100])), null);
      const a = monumentLabels(items, "es", silhouette(items, 0.2), 0.2), b = monumentLabels(items, "es", null, 0.2);
      a.forEach((x, i) => { if (x.alt - b[i].alt > 3.01) bad.push(s + ":" + q.id + ":" + x.id); }); }
    ok(bad.length === 0, "en todos los puntos de visita, cada rótulo queda a menos de 3° de la cima de su pieza" + (bad.length ? " — " + bad.slice(0, 6).join(" ") : "")); }
  // las torres no flotan: la fila sube 16 m de la 1 a la 13 y el suelo dibujado llega al pie de cada una, desde cualquier punto
  {
    const { placeMonuments, groundHeight, reliefPoints, markAloof } = await import("../src/sky/monumentLayer.js");
    const tw = MONUMENTS.filter((m) => m.kind === "tower" && m.site === "chankillo"), t1 = tw[0], t13 = tw[12];
    // cresta sintética: sube de 198 a 214 m a lo largo de la fila y cae 0,35 m por metro a los lados
    const ridge = (la, lo) => { const a = offsetOf(t1.lat, t1.lon, t13.lat, t13.lon), p = offsetOf(t1.lat, t1.lon, la, lo), L = a.d, t = (p.e * a.e + p.n * a.n) / (L * L), d = Math.abs(p.e * a.n - p.n * a.e) / L; return 198 + 16 * Math.min(1, Math.max(0, t)) - 0.35 * d; };
    let worst = 0, mixed = false;
    for (const q of stopsAt(-9.561185, -78.229591).stops.slice(0, 4)) {
      const near = monumentsNear(q.lat, q.lon), ground = ridge(q.lat, q.lon), bases = Object.fromEntries(near.map((m) => [m.id, ridge(m.lat, m.lon)]));
      const pre = markAloof(near.map((m) => ({ m, o: offsetOf(q.lat, q.lon, m.lat, m.lon) }))), reach = groundReach(pre), spec = tw[0].reliefGrid;
      const al = pre.filter((it) => it.m.kind === "tower").map((it) => isAloof(it)); if (al.some((x) => x !== al[0])) mixed = true;
      const relief = { reach, h: reliefPoints(q.lat, q.lon, reach, spec).map(([la, lo]) => ridge(la, lo) - ground - 1.7), ...spec };
      const items = placeMonuments(near, { lat: q.lat, lon: q.lon, ground }, bases, relief);
      for (const it of items) if (it.m.kind === "tower") for (const [de, dn] of [[0, 0], [3, 0], [-3, 0], [0, 5], [0, -5]]) worst = Math.max(worst, Math.abs(groundHeight(it.o.e + de, it.o.n + dn, items, relief) - it.dz));
    }
    ok(worst < 1.2 && !mixed, `Chankillo: desde sus cuatro primeros puntos, el suelo llega al pie de las trece torres (como mucho ${worst.toFixed(2)} m de diferencia) y la fila va toda junta`);
  }
  // las piezas lejanas de un sitio extenso no estiran el suelo propio
  const items = MONUMENTS.filter((m) => m.site === "chankillo").map((m) => ({ m, o: offsetOf(-9.561185, -78.229591, m.lat, m.lon) }));
  ok(isAloof(items.find((it) => it.m.id === "chankillo-templo")) && !isAloof(items.find((it) => it.m.id === "chankillo-7")) && groundReach(items) < 520, "Chankillo: desde el punto oeste el templo no cuenta para el alcance del suelo (menos de 520 m)");
  // las nubes se desplazan de forma continua: sin salto al pasar un múltiplo de 6 h
  const { parseForecast, cloudsAt } = await import("../src/sky/weather.js");
  const { layerParams } = await import("../src/sky/cloudsLayer.js");
  const H = 3600, t0 = 1795651200, ts = Array.from({ length: 48 }, (_, i) => t0 + i * H), hourly = { time: ts, cloud_cover: ts.map(() => 50), cloud_cover_low: ts.map(() => 50), cloud_cover_mid: ts.map(() => 20), cloud_cover_high: ts.map(() => 80), precipitation_probability: ts.map(() => 0) };
  for (const l of ["850hPa", "500hPa", "250hPa"]) { hourly["wind_speed_" + l] = ts.map((_, i) => 18 + i * 0.2); hourly["wind_direction_" + l] = ts.map(() => 270); }
  const fc = parseForecast({ hourly }), off = (s) => layerParams(cloudsAt(fc, s), s)[0].off[0];
  ok(t0 % (6 * H) === 0 && Math.abs(off(t0 + 12 * H) - off(t0 + 12 * H - 60) - 1.22) < 0.05 && Math.abs(off(t0 + 12 * H + 60) - off(t0 + 12 * H) - 1.22) < 0.05 && off(t0 + 12 * H) > 800, "las nubes avanzan con el viento sin saltos al cruzar las 6 h (1,2 km por minuto con viento de 73 km/h)");
}
{ // los muros bajos (kind "walls") van a lo largo de su trazo y, con el suelo del sitio, en tramos sobre él
  const m = MONUMENTS.find((x) => x.id === "chankillo-este-n"), seg = m.segs[0], [e1, n1, e2, n2] = seg, L = Math.hypot(e2 - e1, n2 - n1);
  const along = (F) => { const ux = (e2 - e1) / L, uy = (n2 - n1) / L; let a = 1e9, b = -1e9, w = 0; for (const f of F) for (const v of f.v) { const t = (v[0] - e1) * ux + (v[1] - n1) * uy, q = Math.abs(-(v[0] - e1) * uy + (v[1] - n1) * ux); a = Math.min(a, t); b = Math.max(b, t); w = Math.max(w, q); } return { a, b, w }; };
  const E = along(buildFaces({ ...m, segs: [seg] })), T = along(buildFaces({ ...m, segs: [seg] }, { ground: (e, n) => 0.05 * e }));
  const zs = buildFaces({ ...m, segs: [seg] }, { ground: (e, n) => 0.05 * e }).flatMap((f) => f.v.map((v) => v[2]));
  ok(E.b - E.a > L && E.w < m.thick && T.b - T.a > L && T.w < m.thick && Math.max(...zs) - Math.min(...zs) > 2,
    "Chankillo: los muros bajos siguen su trazo (no atravesados) y, en ladera, cada tramo sobre su suelo");
}
console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
