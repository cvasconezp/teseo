// Pruebas de los sitios con suelo LiDAR (src/sky/lidarSites.js, lidarPlan.js, lidarInfo.js, lidarStones.js): las
// maquetas de terreno, lo que se apoya en ellas, los puntos de visita y las fichas.
import { readFileSync, statSync } from "node:fs";
import { LIDAR_SITES } from "../src/sky/lidarSites.js";
import { LIDAR_PLAN } from "../src/sky/lidarPlan.js";
import { LIDAR_INFO } from "../src/sky/lidarInfo.js";
import { LIDAR_STONES } from "../src/sky/lidarStones.js";
import { parseTonedModel, modelGround, setSiteModel, siteModel } from "../src/sky/machuModel.js";
import { MONUMENTS, buildFaces, offsetOf, apexOf, monumentsNear, silhouette, lidarAt } from "../src/sky/monuments.js";
import { placeMonuments, drapes, groundReach, groundHeight, RELIEF_R, RELIEF_NA } from "../src/sky/monumentLayer.js";
import { allStops } from "../src/sky/stops.js";
import { SITES } from "../src/sky/places.js";
import { MON_INFO, shapeCredit } from "../src/sky/monumentInfo.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const sites = Object.keys(LIDAR_SITES), by = (id) => MONUMENTS.find((m) => m.id === id);

console.log("Maquetas");
let total = 0; const bad = [];
for (const k of sites) {
  const L = LIDAR_SITES[k], f = new URL(`../public/data/${L.file}`, import.meta.url), b = readFileSync(f), mdl = parseTonedModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), L.base);
  setSiteModel(k, mdl); total += statSync(f).size;
  const g0 = modelGround(0, 0, mdl);
  if (!(mdl.nv < 65536 && mdl.nt > 3000 && mdl.cls.every((c) => c === 1) && mdl.tone.length === mdl.nt)) bad.push(k + ": formato");
  if (!(g0 != null && Math.abs(g0 - L.z0) < 0.06)) bad.push(`${k}: suelo en el origen ${g0} ≠ ${L.z0}`);
  if (modelGround(L.clip + 6, 0, mdl) != null || modelGround(0, -(L.clip - 3), mdl) == null) bad.push(k + ": borde");
  if (!(L.clip <= 600 && statSync(f).size < 1.1e6)) bad.push(k + ": tamaño");
}
ok(bad.length === 0, `las ${sites.length} maquetas LiDAR: solo terreno, con tono, a su cota, de menos de 1,1 MB cada una` + (bad.length ? " — " + bad.join("; ") : ""));
ok(total < 6.5e6, `en total pesan ${(total / 1e6).toFixed(1)} MB (cada una se descarga solo en su sitio)`);
ok(sites.every((k) => /Open Government Licence|CC BY 4\.0|dominio público/.test(LIDAR_SITES[k].src) && /^https:\/\//.test(LIDAR_SITES[k].url)), "cada maqueta lleva organismo, licencia y enlace de su dato");

console.log("Piezas");
ok(sites.every((k) => MONUMENTS.some((m) => m.lidar && m.site === k && m.model === k && m.modelOnly && m.absBase === LIDAR_SITES[k].base && m.foot === LIDAR_SITES[k].clip)), "cada sitio LiDAR tiene su pieza de terreno, a la cota de su archivo");
ok(MONUMENTS.filter((m) => m.lidar).every((m) => !drapes(m)), "el terreno de una maqueta no se vuelve a tender sobre el suelo (antes subía sobre la cabeza y tapaba el cielo)");
{ const badL = [];
  for (const m of MONUMENTS.filter((q) => q.lidar && q.label !== false)) { const [e, n, u] = apexOf(m), g = modelGround(e, n, siteModel(m.model)); if (!(g != null && Math.abs(g - m.absBase + (m.labelEN ? m.labelEN[2] : 3) - u) < 1e-6)) badL.push(m.id); }
  ok(badL.length === 0, "los rótulos se apoyan en el suelo de la maqueta en su punto (la cima del túmulo, el centro del anillo)" + (badL.length ? " — " + badL.join(" ") : "")); }
// de pie en la vista general, con la maqueta cargada: nada sube por encima de los ojos más de lo que mide, las piezas se apoyan en el suelo LiDAR
const reliefOf = (lat, lon, near) => {
  const mm = near.find((m) => m.model), mdl = siteModel(mm.model), o = offsetOf(mm.lat, mm.lon, lat, lon), here = modelGround(o.e, o.n, mdl); if (here == null) return null;
  const reach = groundReach(near.map((m) => ({ m, o: offsetOf(lat, lon, m.lat, m.lon) })));
  return { reach, h: new Array(RELIEF_R.length * RELIEF_NA).fill(-1.7), abs0dem: here, abs0: here, edge: () => null, exact: (e, n) => { const a = modelGround(o.e + e, o.n + n, mdl); return a == null ? null : a - here - 1.7; } };
};
{ const A = allStops(), out = [], roof = [], seat = [];
  for (const k of sites) for (const q of (A[k] || []).filter((x) => !x.air)) {
    const near = monumentsNear(q.lat, q.lon, 25).filter((m) => m.site === k), rl = reliefOf(q.lat, q.lon, near);
    if (!rl) { out.push(`${k}:${q.id}`); continue; }
    const items = placeMonuments(near, { lat: q.lat, lon: q.lon, ground: 100 }, Object.fromEntries(near.map((m) => [m.id, 100])), rl);
    const top = Math.max(...silhouette(items.filter((it) => it.m.lidar), 1));
    if (top > 35) roof.push(`${k}:${q.id} ${top.toFixed(0)}°`);
    for (const it of items.filter((x) => x.m.seatModel)) { const ex = rl.exact(it.o.e, it.o.n); if (ex != null && Math.abs(it.dz - ex) > 1e-6) seat.push(it.m.id); }
  }
  ok(out.length === 0, "todos los puntos de visita en tierra de los sitios LiDAR caen dentro de su maqueta (se pisa suelo medido)" + (out.length ? " — " + out.join(" ") : ""));
  ok(roof.length === 0, "desde ningún punto de visita el terreno sube más de 35° sobre el horizonte" + (roof.length ? " — " + roof.join(" ") : ""));
  ok(seat.length === 0, "las piezas con `seatModel` (piedras, fachada, entrada) van a la cota del suelo LiDAR bajo su centro" + (seat.length ? " — " + seat.join(" ") : "")); }

// lo que encontró la revisión de código (26-nov-2026): cada hallazgo, una prueba
{ const A = allStops(), alien = [], reach = [];
  for (const k of sites) { const q = A[k][0], near = monumentsNear(q.lat, q.lon, 25);
    for (const m of near) if ((m.lidar || m.kind === "stones" || m.kind === "portal") && m.site !== k) alien.push(`${k}←${m.id}`);
    const r = groundReach(near.map((m) => ({ m, o: offsetOf(q.lat, q.lon, m.lat, m.lon) }))); if (r > 2 * LIDAR_SITES[k].clip + 230) reach.push(`${k} ${Math.round(r)}`); }
  ok(alien.length === 0, "desde un sitio no entran el suelo ni las piedras del sitio vecino (Maeshowe–Stenness–Brodgar, Newgrange–Knowth–Dowth, Avebury–Silbury, los dos de Newark)" + (alien.length ? " — " + alien.join(" ") : ""));
  ok(reach.length === 0, "el suelo propio de cada sitio no pasa del diámetro de su maqueta y 230 m (antes, 2 a 3 km por las piezas vecinas: escala, relieve y sombras bastos)" + (reach.length ? " — " + reach.join(" ") : "")); }
{ // la Piedra del Talón de Stonehenge, a 77 m y casi 2 m más abajo que el círculo: en su suelo
  const sh = by("stonehenge"), q = allStops().stonehenge.find((x) => x.id === "avenida"), near = monumentsNear(q.lat, q.lon, 25).filter((m) => m.site === "stonehenge"), rl = reliefOf(q.lat, q.lon, near);
  const it = placeMonuments(near, { lat: q.lat, lon: q.lon, ground: 100 }, Object.fromEntries(near.map((m) => [m.id, 100])), rl).find((x) => x.m.id === "stonehenge");
  const he = 77 * Math.sin(51.3 * Math.PI / 180), hn = 77 * Math.cos(51.3 * Math.PI / 180), heel = it.faces.filter((f) => f.v.every((v) => Math.hypot(v[0] - he, v[1] - hn) < 3));
  const zb = Math.min(...heel.flatMap((f) => f.v.map((v) => v[2]))), g = modelGround(he, hn, siteModel("stonehenge")) - modelGround(0, 0, siteModel("stonehenge"));
  ok(heel.length > 100 && g < -1.5 && Math.abs(zb - (g - 0.12)) < 0.15, `la Piedra del Talón se apoya en su suelo, ${(-g).toFixed(1)} m más bajo que el círculo (antes flotaba)`); }
{ // Newgrange: el túmulo, de base plana, sobre un llano de la maqueta
  const ng = by("newgrange"), o = offsetOf(LIDAR_SITES.newgrange.lat, LIDAR_SITES.newgrange.lon, ng.lat, ng.lon), mdl = siteModel("newgrange"), g0 = modelGround(o.e, o.n, mdl); let worst = 0;
  for (let a = 0; a < 360; a += 15) worst = Math.max(worst, Math.abs(modelGround(o.e + 42.5 * Math.sin(a * Math.PI / 180), o.n + 42.5 * Math.cos(a * Math.PI / 180), mdl) - g0));
  ok(worst < 0.35, `Newgrange: el suelo bajo el borde del túmulo queda a ${worst.toFixed(2)} m de la cota de su centro (antes hasta 3,4 m: flotaba por el norte)`); }
{ // fuera de la maqueta (o antes de que cargue), la cota de archivo de la pieza LiDAR no hunde el suelo del sitio
  const m = by("avebury"), o = { e: 0, n: 700, d: 700, az: 0 }, items = [{ m, o, dz: m.absBase - 161.7, faces: [] }], flat = { reach: 1200, h: new Array(RELIEF_R.length * RELIEF_NA).fill(-1.7) };
  ok(Math.abs(groundHeight(0, 700, items, flat) + 1.7) < 0.2 && Math.abs(groundHeight(0, 420, items, flat) + 1.7) < 0.2, "visto desde fuera de la maqueta, el suelo del sitio sigue el relieve (antes bajaba 10 a 37 m hasta la cota del archivo)"); }
ok(MONUMENTS.filter((m) => m.lidar || m.kind === "stones" || m.kind === "portal").every((m) => m.far === LIDAR_SITES[m.site].clip + 350), "el suelo LiDAR y sus piedras solo se dibujan desde su sitio y hasta 350 m de su maqueta");

console.log("Piedras");
{ const badS = [], n = Object.fromEntries(Object.entries(LIDAR_STONES).map(([k, L]) => [k, L.length]));
  for (const [k, L] of Object.entries(LIDAR_STONES)) for (const [e, nn, h, w, t] of L) if (!(modelGround(e, nn, siteModel(k)) != null && h >= 1 && h <= 6 && w >= 0.5 && w <= 4.5 && t >= 0.5 && t <= 2.5)) badS.push(`${k}(${e},${nn})`);
  ok(badS.length === 0 && n.stenness === 4 && n.brodgar >= 15 && n.brodgar <= 36 && n.avebury >= 20, `piedras en pie medidas: Brodgar ${n.brodgar}, Stenness ${n.stenness}, Avebury ${n.avebury}; todas sobre su maqueta y de 1 a 6 m` + (badS.length ? " — " + badS.slice(0, 5).join(" ") : ""));
  const p = by("brodgar-piedras"), flat = buildFaces(p), slope = buildFaces(p, { ground: (e) => 0.1 * e });
  const zmin = (F) => Math.min(...F.flatMap((f) => f.v.map((v) => v[2]))), z0 = zmin(flat), emin = Math.min(...LIDAR_STONES.brodgar.map((q) => q[0]));
  const dz = Math.abs(zmin(slope) - (z0 + 0.1 * emin));
  ok(p.kind === "stones" && p.seatModel && Math.abs(z0 + 0.4) < 0.05 && dz < 0.3, "cada piedra se asienta en el suelo de su propio sitio (hundida 0,4 m), no en un plano común"); }

console.log("Puntos de visita y fichas");
{ const A = allStops();
  ok(sites.every((k) => A[k] && A[k].length >= 2 && A[k][0].id === "vista" && A[k].some((q) => q.air >= 40 && q.air <= 220 && q.lookAlt < 0)), "cada sitio LiDAR tiene vista general y al menos una toma aérea de 40 a 220 m");
  ok(A.newark.filter((q) => q.air).length === 2 && A.stonehenge.some((q) => q.air === 110) && A.stonehenge.some((q) => q.id === "aire-eje" && q.air === 55) && A.stonehenge.some((q) => q.id === "avenida"), "Newark: dos tomas aéreas (Círculo y Octágono); Stonehenge: toma a 110 m (cabe el foso) y un punto en la Avenida");
  const nw = sites.filter((k) => !LIDAR_PLAN[k].own);
  ok(nw.length === 13 && nw.every((k) => { const s = SITES.find((x) => x.id === k), I = LIDAR_INFO[k], m = by(k); return s && s.note.es && s.note.en && m && m.label && MON_INFO[k] && MON_INFO[k].sources.length >= 3 && MON_INFO[k].body.es.length >= 2 && !I.stub; }), "los trece sitios nuevos: lugar en la lista, pieza con rótulo y ficha con tres fuentes o más");
  ok(nw.every((k) => { const v = LIDAR_PLAN[k].view, s = SITES.find((x) => x.id === k), [la, lo] = lidarAt(k, v[0], v[1]); return Math.abs(s.lat - la) < 1e-6 && Math.abs(s.lon - lo) < 1e-6 && Math.hypot(v[0], v[1]) < LIDAR_SITES[k].clip - 20; }), "el lugar de cada sitio nuevo es su punto de vista, dentro de la maqueta");
  ok(["stonehenge-suelo", "newgrange-suelo", "maeshowe", ...nw].every((id) => { const c = shapeCredit(id, by(id).site); return c && /LiDAR/.test(c.text) && /Cambios de Teseo/.test(c.text) && /^https:/.test(c.url); }) && /Environment Agency/.test(shapeCredit("silbury", "silbury").text) && /Historic Environment Scotland/.test(shapeCredit("maeshowe", "maeshowe").text) && /Geological Survey Ireland/.test(shapeCredit("knowth", "knowth").text) && /U\.S\. Geological Survey/.test(shapeCredit("cahokia", "cahokia").text),
    "el crédito de cada suelo LiDAR nombra el organismo, la licencia y los cambios de Teseo");
  const ng = by("newgrange"), d = offsetOf(LIDAR_SITES.newgrange.lat, LIDAR_SITES.newgrange.lon, ng.lat, ng.lon);
  ok(ng.seatModel && Math.abs(d.e + 6.4) < 1 && Math.abs(d.n - 0.7) < 1 && by("stonehenge").seatModel && by("maeshowe").lidar && by("maeshowe-entrada").kind === "portal", "Newgrange va en el centro del túmulo medido en el LiDAR; Stonehenge se apoya en su suelo; Maeshowe es su túmulo medido, con la entrada aparte"); }

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
