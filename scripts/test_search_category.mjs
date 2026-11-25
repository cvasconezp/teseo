// Pruebas de src/sky/searchCategory.js: qué categoría (capa entera) pide lo escrito en el buscador del Cielo.
// Uso:  node scripts/test_search_category.mjs     (sale con código 1 si algo falla)
// Lo escrito debe ser el COMIENZO de un término: los trozos de nombres propios («ome» de Omega Centauri,
// «tar» de la Tarántula, «ald» de Aldebarán) no deben encender cometas, púlsares ni Caldwell.
import { readFileSync } from "node:fs";
import { categoryOf, CATEGORY_TERMS } from "../src/sky/searchCategory.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => {
  if (cond) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FALLA ${name} ${detail}`); }
};
const key = (q) => (categoryOf(q) || {}).key || null;

console.log("Categorías legítimas");
ok(key("cometas") === "comets" && key("comet") === "comets" && key("come") === "comets", "«cometas», «comet», «come»");
ok(key("pulsares") === "pulsars" && key("púlsares") === "pulsars" && key("puls") === "pulsars", "«pulsares», «púlsares», «puls»");
ok(key("satélites") === "probes" && key("satelites") === "probes" && key("telescopio") === "probes" && key("voyager") === "probes", "«satélites», «telescopio», «voyager» → sondas");
ok(key("estrella de neutrones") === "pulsars" && key("estrella de neu") === "pulsars", "términos de varias palabras al escribir más de una");
ok(key("agujero negro") === "blackholes" && key("black hole") === "blackholes" && key("agujero") === "blackholes", "agujeros negros");
ok(key("galaxias") === "galaxies" && key("caldwell") === "caldwell" && key("ngc") === "ngc" && key("exoplanetas") === "exoplanets", "galaxias, Caldwell, NGC, exoplanetas");
ok(key("lluvia de meteoros") === "meteors" && key("meteoros") === "meteors", "lluvias de meteoros");
ok(key("nebulosa") === "messier" && key("cluster") === "messier", "nebulosas y cúmulos");

console.log("Lo que no es categoría");
ok(key("estrella") === null, "«estrella» sigue buscando estrellas por nombre");
ok(key("sat") === null && key("mar") === null && key("sol") === null, "«sat», «mar», «sol» siguen siendo planetas y el Sol");
ok(key("co") === null && key("") === null && key(null) === null, "menos de 3 letras: nada");
ok(key("webb") === null, "«webb» se busca por nombre en las sondas (cargadas sin encender la capa)");
for (const q of ["ome", "omeg", "tar", "tara", "ald", "alde", "ulsar", "eta", "ometa"]) ok(key(q) === null, `«${q}» (trozo de nombre) no es categoría`);

console.log("Ningún prefijo de un nombre real cae en una categoría por un trozo interior");
// mismos nombres que revisó la auditoría: constelaciones, estrellas con nombre y catálogos pequeños
const pub = (f) => JSON.parse(readFileSync(new URL(`../public/${f}`, import.meta.url), "utf8"));
const names = new Set();
const sky = pub("sky.json");
for (const c of sky.constellations) { names.add(c.la); names.add(c.en); if (c.es) names.add(c.es); }
for (const s of sky.stars) if (s[7]) names.add(s[7]);
for (const f of ["caldwell.json", "deepsky.json", "oddities.json", "special-stars.json", "minor-bodies.json"]) {
  try { for (const o of pub(f).objects) for (const k of ["cn", "name", "name_en", "es", "en"]) if (typeof o[k] === "string") names.add(o[k]); } catch { /* fichero opcional */ }
}
const bad = [];
for (const n of names) {
  const w = n.toLowerCase();
  for (let L = 3; L <= 5; L++) {
    const q = w.slice(0, L); if (q.length < L || q.includes(" ")) continue;
    const c = categoryOf(q);
    if (c && !c.terms.some((t) => t.startsWith(q))) bad.push(`${q}→${c.key} (${n})`);
  }
}
ok(names.size > 300, "hay nombres que revisar", String(names.size));
ok(bad.length === 0, "0 casos de categoría por trozo interior", bad.slice(0, 8).join(", "));

console.log("Constellations.jsx");
const src = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/categoryOf\(query\)/.test(src) && !/const CATEGORY_TERMS/.test(src), "el componente usa categoryOf (sin copia de los términos)");
const eff = src.slice(src.indexOf("// si se busca una categoría"), src.indexOf("// si se busca una categoría") + 700);
ok(/loadLayer\(cfg\)/.test(eff) && !/setEnabled/.test(eff), "buscar una categoría descarga sus datos sin encender la capa");
ok(src.indexOf("// si se busca una categoría") > src.indexOf("const loadLayer = useCallback"), "el efecto va después de declarar loadLayer");
ok(CATEGORY_TERMS.length >= 14, "todas las categorías siguen definidas");

console.log(`\n${passed} ok, ${failed} fallan`);
process.exit(failed ? 1 : 0);
