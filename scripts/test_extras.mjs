// Pruebas de las dos listas escogidas (scripts/build_extras.py): public/oddities.json y public/special-stars.json.
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const ODD = JSON.parse(read("../public/oddities.json")), ST = JSON.parse(read("../public/special-stars.json"));
const radec = (o) => [(Math.atan2(o.ny, o.nx) * 180 / Math.PI + 360) % 360, Math.asin(o.nz) * 180 / Math.PI];
const at = (list, name, ra, dec, tol = 0.2) => { const o = list.find((x) => x.name === name); if (!o) return false; const [a, d] = radec(o); return Math.abs(((a - ra + 540) % 360) - 180) * Math.cos(d * Math.PI / 180) < tol && Math.abs(d - dec) < tol; };
const full = (o, kinds) => o.name && o.name_en && o.note_es && o.note_en && o.wiki_en && kinds.includes(o.kind) && Math.abs(Math.hypot(o.nx, o.ny, o.nz) - 1) < 1e-4 && !/TODO|\?\?/.test(o.note_es + o.note_en);

console.log("Nebulosas oscuras, supernovas y cuásares");
ok(ODD.objects.length === ODD.count && ODD.count >= 20 && ODD.objects.every((o) => full(o, ["dark", "snr", "quasar", "lens", "gcluster"])) && /SIMBAD/.test(ODD.meta.source), `${ODD.count} objetos con nombre, nota y artículo en los dos idiomas; posiciones de SIMBAD`);
// posiciones conocidas: Cabeza de Caballo 5 h 41 min, −2° 28′; Casiopea A 23 h 23,4 min, +58° 49′; SN 1987A 5 h 35,5 min, −69° 16′; cúmulo de Coma 12 h 59,8 min, +27° 59′
ok(at(ODD.objects, "Cabeza de Caballo", 85.25, -2.46) && at(ODD.objects, "Casiopea A", 350.86, 58.81) && at(ODD.objects, "Supernova 1987A", 83.87, -69.27) && at(ODD.objects, "Cúmulo de Coma", 194.95, 27.98), "la Cabeza de Caballo, Casiopea A, la supernova 1987A y el cúmulo de Coma, en su sitio");
ok(new Set(ODD.objects.map((o) => o.name)).size === ODD.count && ODD.objects.every((o) => o.dist_ly > 0) && ["dark", "snr", "quasar", "lens", "gcluster"].every((k) => ODD.objects.some((o) => o.kind === k)), "sin repetidos, todos con distancia, y de los cinco tipos");
{ const bh = JSON.parse(read("../public/blackholes.json")).objects.map((o) => o.name), cw = JSON.parse(read("../public/caldwell.json")).objects.map((o) => o.cn || "");
  ok(!ODD.objects.some((o) => bh.includes(o.name_en) || cw.includes(o.name_en)), "no repite objetos de «Agujeros negros» (3C 273, TON 618) ni de Caldwell (Velo, Saco de Carbón)"); }

console.log("Estrellas dobles y variables");
ok(ST.objects.length === ST.count && ST.count >= 20 && ST.objects.every((o) => full(o, ["double", "variable", "nova", "nearby"]) && o.dist_ly > 0), `${ST.count} estrellas con nombre, nota, artículo y distancia`);
// Albireo 19 h 30,7 min, +27° 58′; Algol 3 h 08,2 min, +40° 57′; Mira 2 h 19,3 min, −2° 59′; Eta Carinae 10 h 45,1 min, −59° 41′
ok(at(ST.objects, "Albireo", 292.68, 27.96) && at(ST.objects, "Algol", 47.04, 40.96) && at(ST.objects, "Mira", 34.84, -2.98) && at(ST.objects, "Eta Carinae", 161.26, -59.68), "Albireo, Algol, Mira y Eta Carinae, en su sitio");
ok(ST.objects.filter((o) => o.kind === "variable" || o.kind === "nova").every((o) => o.mag == null) && ST.objects.filter((o) => o.kind === "double").every((o) => o.mag != null && o.mag < 6), "las variables no llevan una magnitud fija; las dobles sí, y se ven a simple vista");
{ const sir = ST.objects.find((o) => o.id === "Sirius"), ac = ST.objects.find((o) => o.id === "alf Cen A"), px = ST.objects.find((o) => o.name_en === "Proxima Centauri");
  ok(sir.mag === -1.46 && ac.dist_ly === 4.37 && px.dist_ly === 4.24, "Sirio, magnitud −1,46; Alfa Centauri a 4,37 años luz y Próxima a 4,24"); }

console.log("En la vista");
const src = read("../src/Constellations.jsx"), desc = read("../src/sky/describe.js"), panels = read("../src/sky/panels.jsx"), wiki = read("../src/sky/wiki.js"), art = read("../src/sky/art.js");
ok(/key: "oddities",\s+file: "\/oddities\.json"/.test(src) && /key: "specialstars", file: "\/special-stars\.json"/.test(src) && /"oddities", "specialstars"/.test(panels), "dos capas, cada una con su fichero y su fila en el panel");
ok(/L === "oddities" \|\| L === "specialstars"/.test(desc) && /L === "minor" \|\| L === "oddities" \|\| L === "specialstars"/.test(wiki) && /L === "specialstars"\) return "star"/.test(art), "ficha con tipo, distancia, nota y fuente; foto por el artículo indicado; ilustración según el tipo");
ok(/for \(const k of \["oddities", "specialstars"\]\) if \(query\.trim\(\)\.length >= 3/.test(src), "el buscador las encuentra con la capa apagada");
for (const lang of ["typeDark", "typeSnr", "typeQuasar", "typeLens", "typeGcluster", "typeDouble", "typeVariable", "typeNova", "typeNearby", "extrasSrc"]) if ((src.match(new RegExp(lang + ":", "g")) || []).length !== 2) { ok(false, "falta el texto " + lang + " en algún idioma"); }
ok(true, "los nombres de tipo están en español y en inglés");

console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
