// Pruebas del mapa curado de imágenes de la NASA (src/sky/nasaImages.js).
// Uso:  node scripts/test_sky_nasa.mjs          (sin red: estructura, cobertura y rótulos)
//       node scripts/test_sky_nasa.mjs --red    (además, cada nasa_id contra la API real de images.nasa.gov)
import { readFileSync } from "node:fs";
import { NASA_IMAGES, NASA_NONE, NASA_VERIFIED, nasaKey, nasaImageFor, nasaKindKey, imageOrder, nasaUrl, nasaPage } from "../src/sky/nasaImages.js";
import { NASA_CANVAS_OK } from "../src/sky/postcard.js";
import { TX } from "../src/sky/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const backend = readFileSync(new URL("../backend/app/nasa_horizons.py", import.meta.url), "utf8");
const deepsky = JSON.parse(readFileSync(new URL("../public/deepsky.json", import.meta.url), "utf8"));
const bh = JSON.parse(readFileSync(new URL("../public/blackholes.json", import.meta.url), "utf8"));

console.log("Estructura del mapa");
{
  const E = Object.entries(NASA_IMAGES);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(NASA_VERIFIED) && E.length >= 35, `fecha de verificación y ${E.length} entradas`);
  ok(E.every(([, e]) => e.id && e.title && e.credit && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && ["photo", "artist", "render"].includes(e.kind) && e.es && e.en && ["small", "medium"].includes(e.big)), "cada entrada: nasa_id, título, crédito, fecha, tipo, descripción ES/EN y tamaño");
  ok(E.every(([, e]) => e.kind !== "photo" || !/artist|concept|illustration|rendering|simulated/i.test(e.title)), "ninguna imagen cuyo título dice «artist concept», «illustration» o «simulated» está marcada como foto");
  ok(E.filter(([, e]) => /artist|concept|illustration|impression/i.test(e.title)).every(([, e]) => e.kind === "artist"), "toda imagen titulada como concepto artístico está marcada «artist»");
  ok(NASA_IMAGES["solar:Venus"].kind === "render", "Venus (radar de Magallanes, «computer simulated») es «render», no foto");
  ok(E.every(([, e]) => !/©|copyright/i.test(e.credit)), "ninguna con crédito «© …» de terceros");
  ok(E.filter(([k]) => /^messier:|^bh:/.test(k)).every(([, e]) => e.kind === "photo" && e.processed === true), "cielo profundo: observaciones reales marcadas como procesadas (infrarrojo, ultravioleta, colores)");
}

console.log("Cobertura de lo que pide la ficha");
{
  const sc = backend.slice(backend.indexOf("SPACECRAFT = ["));
  const probes = [...sc.matchAll(/_sc\("[^"]+",\s*"([^"]+)"/g)].map((m) => m[1]);
  const cm = backend.slice(backend.indexOf("NOTABLE_COMETS = ["));
  const comets = [...cm.slice(0, cm.indexOf("]")).matchAll(/\("[^"]+",\s*"([^"]+)"\)/g)].map((m) => m[1]);
  const decided = (layer, name) => { const k = nasaKey({ layer, name }); return !!(NASA_IMAGES[k] || NASA_NONE[k]); };
  const missP = probes.filter((n) => !decided("probes", n)), missC = comets.filter((n) => !decided("comets", n));
  ok(probes.length === 21 && missP.length === 0, `las 21 naves del backend tienen imagen curada o una razón escrita para no tenerla`, missP.join(", "));
  ok(comets.length === 7 && missC.length === 0, "los 7 cometas, igual", missC.join(", "));
  const withImg = probes.filter((n) => nasaImageFor({ layer: "probes", name: n }));
  console.log(`        naves con imagen NASA: ${withImg.length}/21 · cometas: ${comets.filter((n) => nasaImageFor({ layer: "comets", name: n })).length}/7`);
  ok(["Sol", "Luna", "Mercurio", "Venus", "Marte", "Júpiter", "Saturno", "Urano", "Neptuno"].every((n) => nasaImageFor({ layer: "solar", name: n })), "Sol, Luna y los 8 planetas (sin la Tierra, que es nuestro punto de vista)");
  const ms = [1, 8, 13, 16, 17, 20, 27, 31, 33, 42, 45, 51, 57, 81, 82, 87, 101, 104];
  const msMiss = ms.filter((m) => { const k = "messier:" + m; return !(NASA_IMAGES[k] || NASA_NONE[k]); });
  ok(msMiss.length === 0, "los Messier emblemáticos: con imagen o con razón escrita", msMiss.join(","));
  ok(Object.keys(NASA_IMAGES).filter((k) => k.startsWith("messier:")).every((k) => deepsky.objects.some((o) => "messier:" + o.m === k)), "cada clave Messier existe en deepsky.json");
  ok(Object.keys(NASA_IMAGES).filter((k) => k.startsWith("bh:")).every((k) => bh.objects.some((o) => "bh:" + o.name === k)), "cada clave de agujero negro existe en blackholes.json");
  ok(nasaKey({ layer: "probes", name: "James Webb (JWST)" }) === "probe:james webb" && nasaKey({ layer: "probes", name: "Hubble (HST)" }) === "probe:hubble" && nasaKey({ layer: "probes", name: "ESCAPADE Gold" }) === "probe:escapade", "nombres del backend → clave (Webb, Hubble, ESCAPADE Gold)");
  ok(nasaKey({ layer: "comets", name: "C/2023 A3 (Tsuchinshan-ATLAS)" }) === "comet:c/2023 a3" && nasaKey({ layer: "comets", name: "1P/Halley" }) === "comet:1p", "cometas por designación");
  ok(nasaImageFor({ layer: "star", name: "Sirius" }) === null && nasaImageFor({ layer: "pulsars", name: "J0437-4715" }) === null && nasaImageFor(null) === null && nasaImageFor({ layer: "probes", name: "Nave Que No Existe" }) === null, "sin entrada → null (cae a Wikipedia y a la representación)");
}

console.log("Carga, orden y rótulos");
{
  const m42 = nasaImageFor({ layer: "messier", name: "M42", m: 42 });
  ok(m42.src === "https://images-assets.nasa.gov/image/PIA01322/PIA01322~small.jpg" && m42.srcBig.endsWith("~medium.jpg") && m42.page === "https://images.nasa.gov/details/PIA01322", "URL de ~640 px para la ficha, mayor para lo demás, y página de la NASA");
  ok(nasaUrl("a b", "thumb").includes("a%20b/a%20b~thumb.jpg") && nasaPage("x/y") === "https://images.nasa.gov/details/x%2Fy", "los identificadores se codifican en la URL");
  ok(imageOrder({ layer: "probes" }).join() === "nasa,wiki" && imageOrder({ layer: "comets" }).join() === "nasa,wiki" && imageOrder({ layer: "solar" }).join() === "nasa,wiki", "naves, cometas y sistema solar: NASA primero");
  ok(imageOrder({ layer: "messier" }).join() === "wiki,nasa" && imageOrder({ layer: "blackholes" }).join() === "wiki,nasa" && imageOrder({ layer: "galaxies" }).join() === "wiki,nasa", "cielo profundo: Wikipedia primero, NASA de respaldo");
  const kinds = Object.values(NASA_IMAGES).map((e) => nasaKindKey(e));
  ok(kinds.every((k) => ["photo", "processed", "artist", "render"].includes(k)) && nasaKindKey({ kind: "artist", processed: true }) === "artist", "una ilustración nunca se rotula como foto, aunque lleve otras marcas");
  for (const lang of ["es", "en"]) {
    const t = TX[lang];
    ok(["photo", "processed", "artist", "render"].every((k) => typeof t.nasaKind[k] === "string" && t.nasaKind[k]) && /no es una fotograf|not a photograph/.test(t.nasaKind.artist) && /no es una fotograf|not a photograph/.test(t.nasaKind.render), `[${lang}] rótulos: «${t.nasaKind.artist}» · «${t.nasaKind.processed}»`);
  }
  ok(NASA_CANVAS_OK === false, "postal: imágenes de la NASA desactivadas mientras su CDN no envíe CORS de forma fiable (comprobado el 13-nov-2026)");
}

if (process.argv.includes("--red")) {
  console.log("Contra la API real (images-api.nasa.gov)");
  const ids = [...new Set(Object.values(NASA_IMAGES).map((e) => e.id))];
  for (const id of ids) {
    const e = Object.values(NASA_IMAGES).find((x) => x.id === id);
    try {
      const s = await (await fetch(`https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(id)}`)).json();
      const d = s.collection.items[0] && s.collection.items[0].data[0];
      const a = await (await fetch(`https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`)).json();
      const hrefs = a.collection.items.map((x) => x.href);
      ok(d && d.nasa_id === id && d.date_created.slice(0, 10) === e.date && hrefs.some((h) => h.endsWith(`~small.jpg`)) && hrefs.some((h) => h.endsWith(`~${e.big}.jpg`)), `${id}: existe, misma fecha y tamaños disponibles`);
    } catch (err) { ok(false, `${id}: la API respondió`, String(err)); }
  }
}

console.log(`\n${passed} pruebas correctas, ${failed} con fallo`);
process.exit(failed ? 1 : 0);
