// Pruebas del mapa curado de imágenes de agencias (src/sky/agencyImages.js): ESA/Webb, ESA/Hubble y ESO.
// Uso:  node scripts/test_sky_agency.mjs          (sin red: estructura, claves en el catálogo, URLs, rótulos, orden)
//       node scripts/test_sky_agency.mjs --red    (además, cada imagen contra su página y su CDN reales)
import { readFileSync } from "node:fs";
import { AGENCY_IMAGES, AGENCY_NONE, AGENCIES, AGENCY_VERIFIED, AGENCY_LICENSE, agencyKey, agencyImageFor, agencyKindKey, agencyUrl, agencyPage, imageSources, agencyStatus, setAgencyStatus } from "../src/sky/agencyImages.js";
import { imageOrder } from "../src/sky/nasaImages.js";
import { TX } from "../src/sky/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const deepsky = JSON.parse(read("../public/deepsky.json"));
const galaxies = JSON.parse(read("../public/galaxies.json"));
const bh = JSON.parse(read("../public/blackholes.json"));
const caldwell = JSON.parse(read("../public/caldwell.json"));
const E = Object.entries(AGENCY_IMAGES);

console.log("Estructura del mapa");
{
  ok(/^\d{4}-\d{2}-\d{2}$/.test(AGENCY_VERIFIED) && E.length >= 20 && E.length <= 45, `fecha de verificación y ${E.length} entradas (entre 20 y 45)`);
  ok(E.every(([, e]) => e.agency in AGENCIES && e.id && e.title && e.credit && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.kind === "photo" && e.es && e.en && e.tel), "cada entrada: agencia, id, título, crédito, fecha, tipo, telescopio y descripción ES/EN");
  ok(E.every(([, e]) => e.credit.trim() === e.credit && e.credit.length >= 3 && e.credit === e.credit.replace(/\s+/g, " ")), "crédito no vacío ni con espacios sobrantes");
  ok(E.every(([, e]) => !/artist|concept|illustration|impression|simulat|render/i.test(e.title)), "ninguna entrada es una ilustración o simulación (por el título)");
  ok(E.every(([, e]) => ["infrared", "radio", "mixed", undefined].includes(e.band) && !!e.processed === !!e.band), "band ∈ {infrared, radio, mixed} o ausente, y processed ⇔ hay band");
  ok(new Set(E.map(([, e]) => e.agency)).size === 3, "las tres agencias están representadas: " + ["esa-webb", "esa-hubble", "eso"].map((a) => `${a}=${E.filter(([, e]) => e.agency === a).length}`).join(", "));
  ok(new Set(E.map(([k]) => k)).size === E.length, "sin claves repetidas");
  ok(E.every(([, e]) => e.agency !== "esa-webb" || e.band === "infrared"), "toda imagen de Webb está marcada como infrarroja (procesada)");
  ok(AGENCY_IMAGES["bh:M87*"].band === "radio" && AGENCY_IMAGES["bh:Sgr A*"].band === "radio" && /no es una fotograf|not a photograph/.test(AGENCY_IMAGES["bh:M87*"].es + AGENCY_IMAGES["bh:M87*"].en), "las imágenes del EHT se rotulan como reconstruidas con datos de radio, no como fotografía");
}

console.log("Claves que existen en el catálogo de Teseo");
{
  const m = new Set(deepsky.objects.map((o) => o.m)), cats = new Set(galaxies.objects.map((o) => o.cat)), bhs = new Set(bh.objects.map((o) => o.name));
  // en Caldwell solo cuentan los objetos que dibuja esa capa (no los que viven en «Galaxias»)
  const cw = new Set(caldwell.objects.filter((o) => !o.in).map((o) => (o.c != null ? String(o.c) : o.name)));
  const missing = E.filter(([k]) => { const [t, v] = [k.split(":")[0], k.slice(k.indexOf(":") + 1)]; return t === "messier" ? !m.has(Number(v)) : t === "gal" ? !cats.has(v) : t === "bh" ? !bhs.has(v) : t === "caldwell" ? !cw.has(v) : true; }).map(([k]) => k);
  ok(missing.length === 0, "cada clave existe en deepsky.json (messier), galaxies.json (gal), blackholes.json (bh) o caldwell.json (caldwell, objeto dibujado)", missing.join(", "));
  ok(agencyKey({ layer: "caldwell", c: 80, name: "C80" }) === "caldwell:80" && agencyKey({ layer: "caldwell", c: null, name: "SMC" }) === "caldwell:SMC", "clave de un objeto Caldwell por su número y de una Nube de Magallanes por su nombre");
  const southAsked = { 92: "Carina", 103: "Tarántula", 63: "Hélice", 65: "NGC 253", 80: "Omega Centauri", 106: "47 Tucanae", 94: "Joyero", SMC: "Pequeña Nube" };
  const southMissing = Object.entries(southAsked).filter(([k]) => !AGENCY_IMAGES["caldwell:" + k]).map(([, n]) => n);
  ok(southMissing.length === 0, "joyas del cielo sur con imagen de agencia: " + Object.values(southAsked).join(", "), southMissing.join(", "));
  ok(AGENCY_NONE["caldwell:LMC"] && !AGENCY_IMAGES["caldwell:LMC"], "la Gran Nube de Magallanes figura en AGENCY_NONE con su motivo (no hay observación de la galaxia entera)");
  ok(!Object.keys(AGENCY_NONE).some((k) => /Carina|Omega Centauri|47 Tucanae|NGC 253/.test(k)), "AGENCY_NONE ya no dice que Carina, Omega Centauri, 47 Tucanae o NGC 253 carecen de ficha");
  ok(agencyKey({ layer: "messier", m: 42 }) === "messier:42" && agencyKey({ layer: "galaxies", cat: "NGC5128", name: "Centaurus A" }) === "gal:NGC5128" && agencyKey({ layer: "blackholes", name: "Sgr A*" }) === "bh:Sgr A*", "clave de un Messier, de una galaxia por su designación NGC y de un agujero negro");
  ok(agencyKey(null) === null && agencyKey({ layer: "star", name: "Sirius" }) === null && agencyKey({ layer: "galaxies", cat: "Mrk 1", name: "x" }) === null && agencyKey({ layer: "messier", name: "sin m" }) === null && agencyKey({ layer: "galaxies", name: "Sin cat" }) === null, "sin clave: nulo, estrella, designación rara, Messier sin número, galaxia sin cat");
  const asked = [1, 8, 16, 17, 20, 27, 31, 33, 42, 51, 57, 74, 81, 82, 83, 87, 101, 104];
  console.log(`        Messier pedidos con imagen: ${asked.filter((n) => AGENCY_IMAGES["messier:" + n]).length}/${asked.length}; sin ella: ${asked.filter((n) => !AGENCY_IMAGES["messier:" + n]).join(", ") || "ninguno"}`);
  ok(AGENCY_IMAGES["gal:NGC5128"] && AGENCY_IMAGES["bh:M87*"] && AGENCY_IMAGES["bh:Sgr A*"] && AGENCY_IMAGES["gal:NGC1300"], "Centauro A, NGC 1300, M87* y Sgr A* tienen imagen");
}

console.log("URLs y licencia");
{
  const HOST = { "esa-webb": ["cdn.esawebb.org", "esawebb.org"], "esa-hubble": ["cdn.esahubble.org", "esahubble.org"], eso: ["cdn.eso.org", "www.eso.org"] };
  const all = E.map(([k]) => agencyImageFor(agencyKeyToObj(k)));
  function agencyKeyToObj(k) { const [t, v] = [k.split(":")[0], k.slice(k.indexOf(":") + 1)]; return t === "messier" ? { layer: "messier", m: Number(v), name: "M" + v } : t === "gal" ? { layer: "galaxies", cat: v, name: v } : t === "caldwell" ? (/^\d+$/.test(v) ? { layer: "caldwell", c: Number(v), name: "C" + v } : { layer: "caldwell", c: null, name: v }) : { layer: "blackholes", name: v }; }
  ok(all.every((a) => a), "agencyImageFor resuelve todas las entradas");
  ok(all.every((a) => { const s = new URL(a.src), p = new URL(a.page); return s.protocol === "https:" && p.protocol === "https:" && s.hostname === HOST[a.agency][0] && p.hostname === HOST[a.agency][1] && s.pathname.endsWith(`/${a.id}.jpg`) && /\/screen\//.test(s.pathname) && p.pathname.endsWith(`/${a.id}/`); }), "src https en el CDN oficial (versión «screen») y página https en el dominio oficial, con el id");
  ok(agencyUrl("esa-webb", "weic2216b") === "https://cdn.esawebb.org/archives/images/screen/weic2216b.jpg" && agencyUrl("esa-hubble", "heic0602a") === "https://cdn.esahubble.org/archives/images/screen/heic0602a.jpg" && agencyUrl("eso", "eso1907a") === "https://cdn.eso.org/images/screen/eso1907a.jpg", "patrón de la URL «screen» de cada agencia");
  ok(agencyPage("esa-webb", "weic2216b") === "https://esawebb.org/images/weic2216b/" && agencyPage("esa-hubble", "heic0602a") === "https://esahubble.org/images/heic0602a/" && agencyPage("eso", "eso1907a") === "https://www.eso.org/public/images/eso1907a/", "patrón de la página de cada agencia");
  ok(all.every((a) => a.license === "CC BY 4.0" && a.agencyName && a.usage.startsWith("https://")) && AGENCY_LICENSE.url === "https://creativecommons.org/licenses/by/4.0/", "licencia CC BY 4.0 y enlace a las condiciones de uso en cada imagen");
  const src = read("../src/sky/agencyImages.js");
  ok(/CC BY 4\.0|Creative Commons/.test(src) && src.includes("esawebb.org/copyright") && src.includes("esahubble.org/copyright") && src.includes("eso.org/public/outreach/copyright") && /SIN ALTERAR/.test(src), "la cabecera cita la licencia, la condición del crédito y las tres páginas de condiciones");
  const ids = E.map(([, e]) => e.agency + e.id);
  ok(new Set(ids).size === ids.length, "cada imagen se usa una sola vez");
}

console.log("Orden de fuentes, rótulos y carga");
{
  ok(imageSources({ layer: "messier", m: 42 }).join() === "agency,wiki,nasa" && imageSources({ layer: "galaxies", cat: "NGC5128", name: "Centaurus A" }).join() === "agency,wiki,nasa" && imageSources({ layer: "blackholes", name: "Sgr A*" }).join() === "agency,wiki,nasa", "cielo profundo con imagen de agencia: agencia, Wikipedia, NASA");
  ok(imageSources({ layer: "caldwell", c: 92, name: "C92" }).join() === "agency,wiki,nasa" && imageSources({ layer: "caldwell", c: null, name: "LMC" }).join() === "wiki,nasa", "Caldwell: Carina con imagen de agencia primero; la Gran Nube, Wikipedia");
  ok(imageSources({ layer: "messier", m: 45, name: "M45" }).join() === "wiki,nasa" && imageSources({ layer: "galaxies", cat: "NGC253", name: "x" }).join() === "wiki,nasa", "cielo profundo sin imagen de agencia: sigue Wikipedia y NASA");
  ok(imageSources({ layer: "probes", name: "Voyager 1" }).join() === "nasa,wiki" && imageSources({ layer: "solar", name: "Marte" }).join() === "nasa,wiki" && imageSources({ layer: "comets", name: "1P/Halley" }).join() === "nasa,wiki", "naves, cometas y sistema solar: NASA primero, sin cambios");
  ok(imageOrder({ layer: "messier" }).join() === "wiki,nasa", "imageOrder() no se tocó (lo usan la postal y test_sky_nasa)");
  ok(["infrared", "radio", "mixed", "observation"].map((k) => agencyKindKey({ band: k === "observation" ? undefined : k })).join() === "infrared,radio,mixed,observation", "clave de rótulo por tipo de banda");
  for (const lang of ["es", "en"]) {
    const t = TX[lang], k = t.agencyKind;
    const ir = k.infrared("JWST"), rd = k.radio("EHT"), ob = k.observation("Hubble"), mx = k.mixed("Hubble");
    ok(/JWST/.test(ir) && (lang === "es" ? /infrarroja/.test(ir) : /nfrared/.test(ir)) && /EHT/.test(rd) && /no es una fotograf|not a photograph/.test(rd) && ob && mx, `[${lang}] rótulos: «${ir}» · «${rd}»`);
    ok(t.agencyOpen["esa-webb"].includes("ESA/Webb") && t.agencyOpen["esa-hubble"].includes("ESA/Hubble") && t.agencyOpen.eso.includes("ESO"), `[${lang}] enlaces: «${t.agencyOpen["esa-webb"]}», «${t.agencyOpen["esa-hubble"]}», «${t.agencyOpen.eso}»`);
    const cap = t.agencyCap("ESA/Webb", "NASA, ESA, CSA, STScI");
    ok(cap.includes("NASA, ESA, CSA, STScI") && cap.includes("ESA/Webb") && cap.includes("CC BY 4.0"), `[${lang}] pie: «${cap}»`);
    ok(typeof t.agencyAlt("x", "M42") === "string" && t.dImgAgency, `[${lang}] texto alternativo y detalle técnico`);
  }
  const e = agencyImageFor({ layer: "messier", m: 16, name: "M16" });
  ok(agencyStatus(e) === null, "estado de carga inicial: sin dato");
  setAgencyStatus(e, "fail");
  ok(agencyStatus(e) === "fail" && agencyStatus(agencyImageFor({ layer: "messier", m: 42, name: "M42" })) === null, "si una imagen falla se recuerda solo esa (y la ficha pasa a la siguiente fuente)");
  const sheet = read("../src/sky/ObjectSheet.jsx");
  ok(/imageSources\(obj\)/.test(sheet) && /agencyUsable && order\[0\] === "agency"/.test(sheet) && /setAgencyStatus\(agency, "fail"\)/.test(sheet) && /agencyOpen\[agency\.agency\]/.test(sheet) && /agencyCap\(agency\.agencyName, agency\.credit\)/.test(sheet), "ObjectSheet: orden por imageSources, caída a la siguiente fuente si falla, pie con agencia y crédito, enlace «Ver en…»");
  const pc = read("../src/sky/postcard.js");
  ok(!/agencyImages|agencyImageFor/.test(pc), "la postal NO usa imágenes de agencia (decisión pendiente; el CORS está anotado en agencyImages.js)");
}

if (process.argv.includes("--red")) {
  console.log("Contra las páginas y CDN reales (esawebb.org, esahubble.org, eso.org)");
  const dec = (s) => s.replace(/&#39;|&rsquo;/g, "’").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const norm = (s) => dec(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, "").replace(/\.$/, "");
  for (const [k, e] of E) {
    try {
      const v = k.slice(k.indexOf(":") + 1);
      const a = k.startsWith("caldwell") ? agencyImageFor(/^\d+$/.test(v) ? { layer: "caldwell", c: Number(v), name: "C" + v } : { layer: "caldwell", c: null, name: v })
        : agencyImageFor({ layer: k.startsWith("messier") ? "messier" : k.startsWith("gal") ? "galaxies" : "blackholes", m: Number(k.slice(8)), cat: k.slice(4), name: k.slice(3) });
      const page = await (await fetch(a.page)).text();
      const head = await fetch(a.src, { method: "HEAD" });
      const creditOk = norm(page).includes(norm(e.credit));
      ok(head.status === 200 && /image\/jpeg/.test(head.headers.get("content-type") || "") && page.includes(e.id) && creditOk, `${k} (${e.id}): CDN 200 JPEG, la página existe y contiene el crédito`, `${head.status} ${creditOk}`);
    } catch (err) { ok(false, `${k}: respondió`, String(err)); }
  }
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
