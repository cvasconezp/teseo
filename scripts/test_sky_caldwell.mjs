// Pruebas de la capa Caldwell (public/caldwell.json, scripts/build_caldwell.py) y de su integración en el Cielo:
// catálogo completo (109 + 2 Nubes de Magallanes), sin duplicados con Messier ni con «Galaxias», cada distancia con
// su fuente, valores de referencia, búsqueda, ficha, postal, imagen, patrón de la capa y textos.
// Uso:  node scripts/test_sky_caldwell.mjs
import { readFileSync } from "node:fs";
import { caldwellMatch, caldwellAliases, deacc } from "../src/sky/caldwell.js";
import { describeObject, caldwellCommon } from "../src/sky/describe.js";
import { postcardGrid, GRID_MAX } from "../src/sky/postcard.js";
import { buildSkyNotes } from "../src/sky/explain.js";
import { agencyImageFor, imageSources } from "../src/sky/agencyImages.js";
import { wikiCandidates } from "../src/sky/wiki.js";
import { artKind, artOptions } from "../src/sky/art.js";
import { citizenFor } from "../src/sky/citizen.js";
import { TX } from "../src/sky/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const data = JSON.parse(read("../public/caldwell.json"));
const messier = JSON.parse(read("../public/deepsky.json")).objects;
const galaxies = JSON.parse(read("../public/galaxies.json")).objects;
const O = data.objects;
const byName = (n) => O.find((o) => o.name === n);
const drawn = O.filter((o) => !o.in);
const D2R = Math.PI / 180;
const decOf = (o) => Math.asin(o.nz) / D2R;
const raOf = (o) => ((Math.atan2(o.ny, o.nx) / D2R) + 360) % 360;

console.log("Catálogo");
{
  const cs = O.filter((o) => o.c != null).map((o) => o.c);
  ok(cs.length === 109 && new Set(cs).size === 109 && cs.every((c, i) => c === i + 1), "los 109 objetos Caldwell, del C1 al C109, una vez cada uno y en orden");
  const clouds = O.filter((o) => o.c == null);
  ok(clouds.length === 2 && byName("LMC") && byName("SMC") && clouds.every((o) => o.origin && /no forma parte del catálogo Caldwell/.test(o.origin)), "más la Gran y la Pequeña Nube de Magallanes, marcadas como añadidas (no son Caldwell)");
  ok(O.length === 111 && data.meta.count === 111, `111 entradas en total (meta.count = ${data.meta.count})`);
  ok(O.every((o) => o.name === (o.c != null ? "C" + o.c : o.name)) && new Set(O.map((o) => o.name)).size === O.length, "nombre «C<n>» único (las Nubes: LMC y SMC)");
  ok(O.every((o) => Math.abs(Math.hypot(o.nx, o.ny, o.nz) - 1) < 1e-4), "cada dirección es un vector unitario");
  const TYPES = new Set(["open", "globular", "planetary", "nebula", "snr", "galaxy", "clneb", "dark", "cluster"]);
  ok(O.every((o) => TYPES.has(o.type)), "cada tipo es uno de los conocidos (cúmulos, nebulosas, planetarias, galaxias, oscura…)", O.filter((o) => !TYPES.has(o.type)).map((o) => o.name + ":" + o.type).join(", "));
  ok(O.every((o) => o.const && o.const_es && o.const_la), "cada objeto trae su constelación (abreviatura IAU, nombre en español y nombre latino)");
  ok(O.every((o) => o.mag == null || (o.mag_src && o.mag > -2 && o.mag < 14)), "magnitud razonable y con su fuente (mag_src)");
  ok(O.filter((o) => o.mag == null).map((o) => o.name).join() === "C37,C99", "sin magnitud solo NGC 6885 (identificación incierta en OpenNGC) y el Saco de Carbón (nebulosa oscura)");
  ok(O.filter((o) => o.type === "globular").every((o) => o.mag_src === "Baumgardt et al. 2020") && byName("C80").mag === 3.5, "globulares: magnitud V de Baumgardt et al. 2020 (Omega Centauri 3,5, a simple vista)");
  ok(byName("C89").ids.includes("NGC6087") && byName("C14").ids.join() === "NGC0869,NGC0884" && byName("C41").cat === "Mel 25", "correcciones conocidas: C89 = NGC 6087; C14 = NGC 869 + NGC 884; C41 = Hiades (Mel 25)");
  ok(Math.abs(decOf(byName("C80")) - (-47.48)) < 0.05 && Math.abs(raOf(byName("C80")) - 201.69) < 0.05, "Omega Centauri en AR 201,69°, Dec −47,48° (OpenNGC)");
  ok(Math.abs(decOf(byName("LMC")) - (-69.76)) < 0.05 && Math.abs(decOf(byName("SMC")) - (-72.83)) < 0.05 && byName("LMC").size > 600, "las Nubes en su sitio (Dec −69,8° y −72,8°) y la Gran Nube con más de 10° de ancho");
}

console.log("Sin duplicados");
{
  const mNgc = new Set(messier.map((o) => o.ngc).filter(Boolean));
  ok(!O.some((o) => (o.ids || []).some((i) => mNgc.has(i))), "ningún objeto repite un Messier (por número NGC)");
  ok(!O.some((o) => messier.some((m) => Math.acos(Math.min(1, o.nx * m.nx + o.ny * m.ny + o.nz * m.nz)) / D2R < 0.05)), "ninguno cae en la misma posición que un Messier");
  const ids = O.flatMap((o) => o.ids || []);
  ok(new Set(ids).size === ids.length, "ninguna designación NGC/IC aparece dos veces");
  const gCat = new Map(galaxies.map((g) => [g.cat, g]));
  const shouldDup = O.filter((o) => (o.ids || []).some((i) => gCat.has(i)));
  ok(shouldDup.length === 21 && shouldDup.every((o) => o.in === "galaxies"), `las ${shouldDup.length} galaxias que ya están en «Galaxias» llevan in = "galaxies"`);
  ok(O.filter((o) => o.in).every((o) => galaxies.some((g) => g.name === o.in_name && o.ids.includes(g.cat))), "in_name es el nombre exacto con el que se abren en galaxies.json");
  ok(byName("C77").in === "galaxies" && byName("C77").in_name === "Centaurus A", "Centauro A (C77) no se duplica: vive en «Galaxias»");
  ok(O.filter((o) => o.in).every((o) => o.dist_ly == null), "las que viven en otra capa no traen distancia propia (manda la de su capa)");
  ok(data.count === drawn.length && drawn.length === 90 && data.meta.drawn === 90, `la capa dibuja ${drawn.length} objetos (count del panel = ${data.count})`);
  const src = read("../src/Constellations.jsx");
  ok(/cfg\.key === "caldwell" \? \{ \.\.\.raw, objects: raw\.objects\.filter\(o => !o\.in\) \}/.test(src), "Constellations.jsx no dibuja los objetos con `in`");
  ok(/res\.obj\.in\) \{[\s\S]{0,200}pendingObjRef\.current = res\.obj\.in \+ "~" \+ encodeURIComponent\(res\.obj\.in_name\)/.test(src), "al elegir C77 en el buscador se abre su ficha en «Galaxias»");
}

console.log("Distancias: siempre con fuente");
{
  const withD = drawn.filter((o) => o.dist_ly > 0);
  const KINDS = new Set(["paper", "nasa", "wiki", "assumed"]);
  ok(withD.every((o) => o.dist_src && o.dist_ref && KINDS.has(o.dist_kind) && typeof o.dist_unc === "boolean"), `cada una de las ${withD.length} distancias trae fuente corta, referencia, tipo y marca de incertidumbre`);
  ok(withD.every((o) => Number.isInteger(o.dist_ly)), "distancias en años luz enteros");
  ok(drawn.filter((o) => !(o.dist_ly > 0)).map((o) => o.name).join() === "C31,C37", "sin distancia verificable solo IC 405 (C31) y NGC 6885 (C37), que van sin distancia");
  ok(drawn.filter((o) => !(o.dist_ly > 0)).every((o) => !o.dist_src && !o.dist_kind), "y sin fuente inventada");
  ok(withD.filter((o) => o.dist_kind === "wiki").every((o) => /vía Wikipedia/.test(o.dist_src)), "las citadas de segunda mano dicen «vía Wikipedia»");
  ok(withD.filter((o) => o.dist_kind === "nasa").every((o) => /science\.nasa\.gov\/.*caldwell-(\d+|60-61)\//.test(o.dist_ref)), "las de NASA enlazan la ficha del objeto");
  ok(withD.filter((o) => o.dist_unc && o.dist_kind !== "assumed").every((o) => o.dist_alt_ly > 0 && ["nasa", "wikipedia"].includes(o.dist_alt_src)), "si es incierta por discrepancia, trae el otro valor y de dónde sale");
  ok(withD.filter((o) => o.dist_alt_ly > 0).every((o) => Math.max(o.dist_alt_ly, o.dist_ly) / Math.min(o.dist_alt_ly, o.dist_ly) > 1.29), "solo se marca discrepancia si las fuentes difieren más de un 30 %");
  const glob = drawn.filter((o) => o.type === "globular");
  ok(glob.length === 18 && glob.every((o) => o.dist_src === "Baumgardt y Vasiliev 2021" && /stab1474/.test(o.dist_ref)), "los 18 cúmulos globulares: Baumgardt y Vasiliev 2021 (MNRAS 505, 5957)");
  const near = (n, lo, hi) => { const o = byName(n); return o && o.dist_ly >= lo && o.dist_ly <= hi; };
  ok(near("C80", 16900, 18000) && /Baumgardt/.test(byName("C80").dist_src), `Omega Centauri ≈ 17 000 a. l. (${byName("C80").dist_ly})`);
  ok(near("C106", 14500, 15000), `47 Tucanae ≈ 15 000 a. l. (${byName("C106").dist_ly})`);
  ok(near("LMC", 161000, 163000) && /Pietrzyński et al\. 2019/.test(byName("LMC").dist_src) && /49,59/.test(byName("LMC").dist_ref), `Gran Nube ≈ 162 000 a. l. (Pietrzyński et al. 2019, 49,59 kpc) (${byName("LMC").dist_ly})`);
  ok(near("SMC", 202000, 206000) && /Graczyk et al\. 2020/.test(byName("SMC").dist_src), `Pequeña Nube ≈ 204 000 a. l. (Graczyk et al. 2020, 62,44 kpc) (${byName("SMC").dist_ly})`);
  ok(near("C65", 10.5e6, 11.5e6) && /Rekola/.test(byName("C65").dist_src), `NGC 253 ≈ 3,3–3,5 Mpc (${byName("C65").dist_ly})`);
  ok(byName("C103").dist_ly === byName("LMC").dist_ly && byName("C103").dist_note === "tarantula" && byName("C103").dist_unc === false, "la Tarántula, a la distancia de la Gran Nube (suposición segura y dicha)");
  ok(near("C92", 7000, 8500) && near("C63", 600, 700) && near("C94", 6000, 7000) && near("C41", 148, 156), "Carina ≈ 7 500, Hélice ≈ 650, Joyero ≈ 6 500, Hiades ≈ 151 a. l.");
  ok(near("C70", 6.0e6, 6.3e6) && /Gieren/.test(byName("C70").dist_src) && byName("C70").dist_alt_src !== "nasa", "NGC 300: Gieren et al. 2005 (la errata del recuadro de NASA, 7 500 a. l., no se usa ni como contraste)");
  ok(byName("C50").dist_unc && byName("C50").dist_note === "rosette", "NGC 2244: distancia supuesta (la de la Roseta), marcada incierta");
  const meta = data.meta;
  ok(/CC BY-SA 4\.0/.test(meta.sources.positions) && meta.licenses.OpenNGC === "CC BY-SA 4.0" && meta.sources.distances.BV21 && meta.sources.distances.P19 && meta.assumptions.length >= 5, "meta: fuentes, licencias (OpenNGC CC BY-SA 4.0) y supuestos visibles");
  ok(meta.with_distance === withD.length, `meta.with_distance = ${meta.with_distance}`);
}

console.log("Búsqueda");
{
  const find = (q, opts) => O.map((o) => ({ o, m: caldwellMatch(o, q, opts) })).filter((x) => x.m).sort((a, b) => (b.m.exact ? 1 : 0) - (a.m.exact ? 1 : 0)).map((x) => x.o.name);
  const first = (q, opts) => find(q, opts)[0];
  ok(first("C80") === "C80" && first("c80") === "C80" && first("Caldwell 80") === "C80" && first("caldwell80") === "C80", "«C80», «Caldwell 80», «caldwell80» → Omega Centauri");
  ok(first("NGC 5139") === "C80" && first("ngc5139") === "C80" && first("Omega Centauri") === "C80", "«NGC 5139», «ngc5139», «Omega Centauri»");
  ok(first("C8") === "C8" && find("C8").includes("C80"), "«C8» pone primero a C8 (y también lista C80…)");
  ok(first("NGC 104") === "C106" && first("47 Tucanae") === "C106" && first("47 tuc") === "C106", "47 Tucanae por «NGC 104», «47 Tucanae» y «47 tuc»");
  const mag = find("Nube de Magallanes");
  ok(mag.length === 2 && mag.includes("LMC") && mag.includes("SMC") && first("Gran Nube") === "LMC" && first("Large Magellanic") === "LMC" && first("pequeña nube") === "SMC" && first("SMC") === "SMC", "«Nube de Magallanes» da las dos; «Gran Nube», «Large Magellanic», «pequeña nube», «SMC»");
  ok(first("tarantula") === "C103" && first("Tarántula") === "C103" && first("30 Doradus") === "C103", "Tarántula con y sin acento, y «30 Doradus»");
  ok(first("Nebulosa de Carina") === "C92" && first("Carina Nebula") === "C92" && first("Eta Carinae") === "C92", "Carina en español e inglés");
  ok(first("Joyero") === "C94" && first("Jewel Box") === "C94" && first("Helice") === "C63" && first("Helix") === "C63" && first("Escultor")  === "C65", "Joyero / Jewel Box, Hélice / Helix, galaxia del Escultor");
  ok(first("Centauro A") === "C77" && first("C77") === "C77", "Centauro A (C77) se encuentra aunque viva en «Galaxias»…");
  ok(!find("Centaurus A", { otherLoaded: true }).length && find("C77", { otherLoaded: true }).join() === "C77" && find("caldwell 77", { otherLoaded: true }).join() === "C77", "…y si «Galaxias» ya está cargada, solo por su número Caldwell (sin resultado repetido)");
  ok(caldwellMatch(byName("C80"), "o") === null, "con menos de 2 letras no busca");
  ok(caldwellAliases(byName("C14")).includes("ngc 884") && first("NGC 869") === "C14", "el Doble Cúmulo se encuentra por cualquiera de sus dos NGC");
  ok(deacc("Pléyades del Sur") === "pleyades del sur" && first("pleyades del sur") === "C102", "Pléyades del Sur (IC 2602), sin acentos");
  const src = read("../src/Constellations.jsx");
  ok(/caldwellMatch\(o, q, \{ extra: conExp\("", o\.const\), otherLoaded: !!\(o\.in && datasets\[o\.in\]\) \}\)/.test(src) && /score\(a\.label, a\.exact\)/.test(src), "Constellations.jsx usa caldwellMatch y pone primero la coincidencia exacta");
  ok(/query\.trim\(\)\.length >= 2 && !datasets\.caldwell/.test(src), "el catálogo se carga al empezar a buscar, aunque la capa esté apagada");
  ok(/\{ key: "caldwell",\s+terms: \["caldwell"\] \}/.test(src), "buscar «caldwell» lista la capa");
}

console.log("Ficha, postal e imagen");
{
  const T = { ...TX.es, fDistance: "Distancia", fLightLeft: "Su luz salió hace", fVoyager: "En la Voyager 1 tardarías", ago: (s) => s, fLightHint: "lo ves como era entonces",
    dMagnitude: "Magnitud aparente", magHint: "menor es más brillante", dSource: "Fuente", dCatalog: "Catálogo", inConst: (c) => `en ${c}`, distPublished: "Distancia publicada." };
  const TE = { ...TX.en, fDistance: "Distance", fLightLeft: "Its light left", fVoyager: "On Voyager 1 it would take", ago: (s) => s, fLightHint: "you see it as it was then",
    dMagnitude: "Apparent magnitude", magHint: "lower is brighter", dSource: "Source", dCatalog: "Catalogue", inConst: (c) => `in ${c}`, distPublished: "Published distance." };
  const L = (o) => ({ ...o, layer: "caldwell" });
  const om = describeObject(L(byName("C80")), "es", T, false);
  const fact = (d, l) => (d.facts.find((f) => f.label === l) || {}).value || "";
  const det = (d, l) => ((d.details.find((x) => x[0] === l) || [])[1]) || "";
  ok(om.name === "C80 · Omega Centauri" && /^Cúmulo globular · en Centauro$/.test(om.type), `nombre y tipo: «${om.name}» · «${om.type}»`);
  ok(/^1[78]\D{0,2}(700|mil) años luz$/.test(fact(om, "Distancia")) && fact(om, "Su luz salió hace") && fact(om, "En la Voyager 1 tardarías"), `distancia, «su luz salió hace…» y la Voyager: ${fact(om, "Distancia")} · ${fact(om, "Su luz salió hace")}`);
  ok(det(om, "Catálogo") === "Caldwell 80 · NGC 5139" && /Baumgardt y Vasiliev 2021/.test(det(om, "Fuente")) && /OpenNGC/.test(det(om, "Fuente")), `catálogo «${det(om, "Catálogo")}» y fuente «${det(om, "Fuente")}»`);
  ok(/27′ · la Luna llena mide 31′/.test(det(om, T.dSize)) && /^3,5 · /.test(det(om, "Magnitud aparente")), `tamaño «${det(om, T.dSize)}» y magnitud`);
  ok(om.explain.some((e) => /cúmulo globular/.test(e.text)) && om.explain.some((e) => /simple vista/.test(e.text)) && om.distNote === T.cwDistNote.paper, "explica qué es, si se ve a simple vista y de dónde sale la distancia");
  const lmc = describeObject(L(byName("LMC")), "es", T, false), lmcEn = describeObject(L(byName("LMC")), "en", TE, false);
  ok(lmc.name === "Gran Nube de Magallanes" && lmcEn.name === "Large Magellanic Cloud" && /^Galaxia satélite de la Vía Láctea · en Dorado$/.test(lmc.type), `Nube: «${lmc.name}» / «${lmcEn.name}» · «${lmc.type}»`);
  ok(lmc.note === T.cwOrigin && /Pietrzyński et al\. 2019/.test(det(lmc, "Fuente")) && lmc.explain.some((e) => /veces el ancho de la Luna llena/.test(e.text)), "la Nube dice que no es Caldwell, cita a Pietrzyński et al. 2019 y compara su tamaño con la Luna");
  const ic405 = describeObject(L(byName("C31")), "es", T, false);
  ok(fact(ic405, "Distancia") === T.conNoDist && !fact(ic405, "Su luz salió hace") && ic405.explain.some((e) => e.text === T.cwNoDist) && ic405.distNote === "" && !/Distancia:/.test(det(ic405, "Fuente")), `sin distancia: «${T.conNoDist}», sin «su luz salió hace» y lo explica`);
  const ngc2244 = describeObject(L(byName("C50")), "es", T, false);
  ok(ngc2244.distNote === T.cwDistNote.rosette, "NGC 2244: la ficha dice que la distancia es una suposición");
  const jb = describeObject(L(byName("C94")), "es", T, false);
  ok(jb.explain.some((e) => /Otra fuente \(la tabla del catálogo en Wikipedia\) da unos .* incierta/.test(e.text)), "incierta: la ficha da el otro valor y su fuente");
  const omEn = describeObject(L(byName("C80")), "en", TE, false);
  ok(/Baumgardt & Vasiliev 2021/.test(det(omEn, "Source")) && omEn.type === "Globular cluster · in Centaurus" && /full Moon/.test(det(omEn, TE.dSize)), `en inglés: «${det(omEn, "Source")}»`);
  const car = describeObject(L(byName("C92")), "en", TE, false);
  ok(/NASA, Hubble's Caldwell Catalog/.test(det(car, "Source")) && car.distNote === TE.cwDistNote.nasa, "Carina (en): fuente NASA traducida");
  ok(caldwellCommon(byName("C13"), "es") === "Cúmulo de la Lechuza" && caldwellCommon(byName("C13"), "en") === "Owl Cluster" && caldwellCommon(byName("C3"), "es") === "", "nombre común: el primero de la lista, en el idioma de la ficha");
  for (const n of ["C80", "LMC", "C92", "C31"]) {
    const ob = L(byName(n)), info = describeObject(ob, "es", T, false);
    const g = postcardGrid({ obj: ob, info, t: T, lang: "es", local: null, fmt: { dist: (d) => `${d}` } });
    const labels = g.map((c) => c.label);
    ok(g.length >= 4 && g.length <= GRID_MAX && labels[0] === "Distancia" && labels.includes("Catálogo") && labels.includes(T.dSize) && labels.includes("Magnitud aparente"), `postal de ${n}: ${labels.join(" · ")}`);
  }
  for (const [n, id] of [["C92", "eso1250a"], ["C103", "eso0613a"], ["C63", "eso0907a"], ["C65", "eso1152a"], ["C80", "eso1119b"], ["C106", "eso1302a"], ["C94", "eso0940a"], ["SMC", "eso1714a"]]) {
    const a = agencyImageFor(L(byName(n)));
    ok(a && a.id === id && a.agency === "eso" && a.license === "CC BY 4.0" && imageSources(L(byName(n)))[0] === "agency", `${n}: imagen de ESO ${id} (${a && a.credit})`);
  }
  ok(!agencyImageFor(L(byName("LMC"))) && imageSources(L(byName("LMC"))).join() === "wiki,nasa", "la Gran Nube: imagen de Wikipedia (no hay observación de agencia de la galaxia entera)");
  const wc = wikiCandidates(L(byName("C80")), "es"), we = wikiCandidates(L(byName("C80")), "en");
  ok(wc[0].lang === "es" && wc[0].title === "NGC 5139" && wc.some((c) => c.lang === "en" && c.title === "Omega Centauri") && we[0].title === "Omega Centauri" && we[0].lang === "en", "Wikipedia: «NGC 5139» en español (redirige) y «Omega Centauri» en inglés");
  ok(wikiCandidates(L(byName("LMC")), "es")[0].title === "Gran Nube de Magallanes" && wikiCandidates(L(byName("C99")), "en")[0].title === "Coalsack Nebula", "Wikipedia: Gran Nube de Magallanes; Saco de Carbón sin designación NGC");
  ok(artKind(L(byName("C80"))) === "globular" && artKind(L(byName("LMC"))) === "galaxy" && artOptions(L(byName("LMC"))).hubble === "I" && artKind(L(byName("C63"))) === "nebula", "representación: globular, galaxia irregular (Nubes), nebulosa");
  ok(citizenFor(L(byName("C65"))).some((p) => p.id === "galaxy-zoo"), "ciencia ciudadana: Galaxy Zoo para las galaxias Caldwell");
}

console.log("Patrón de la capa y textos");
{
  const notes = buildSkyNotes({ caldwell: data });
  const n = notes.find((x) => x.id === "messierSouth");
  const south = drawn.filter((o) => decOf(o) < -41.15).length;
  ok(n && n.layer === "caldwell" && n.n === south && n.total === drawn.length, `«Lo que Messier no podía ver»: ${n && n.n} de ${n && n.total} al sur de −41,15° (contados en los datos)`);
  ok(n && n.n / n.total > 0.171, "y son más que el 17,1 % que tocaría al azar");
  const mMin = Math.min(...messier.map(decOf));
  const m7 = messier.find((o) => o.m === 7);
  ok(mMin > -41.15 && Math.abs(decOf(m7) - mMin) < 1e-9 && Math.round(decOf(m7)) === -35, `lo que dice el texto: ningún Messier al sur de −41° y el más austral es M7 (${decOf(m7).toFixed(1)}°)`);
  for (const lang of ["es", "en"]) {
    const t = TX[lang];
    ok(t.layerDesc.caldwell && t.layerDesc.messier && t.layerDesc.galaxies, `[${lang}] descripción de la capa sin borrar las demás: «${t.layerDesc.caldwell.slice(0, 60)}…»`);
    ok(/OpenNGC/.test(t.layerDesc.caldwell) && /NASA/.test(t.layerDesc.caldwell) && /Magall|Magell/.test(t.layerDesc.caldwell), `[${lang}] la descripción dice qué es y de dónde salen los datos`);
    ok(t.deepWhat.planetary && t.deepWhat.clneb && t.deepWhat.dark && t.deepWhat.globular, `[${lang}] tipos nuevos explicados sin perder los de Messier`);
    ok(t.noteTag.messierSouth && t.noteTag.globulars, `[${lang}] etiqueta de la nota en el cielo: «${t.noteTag.messierSouth}»`);
    ok(t.noteTitle.messierSouth && t.noteTitle.kepler && t.noteBody.messierSouth && t.noteSource.messierSouth && t.noteLayerLine.messierSouth(33, 90) && t.noteLayerLine.globulars, `[${lang}] patrón: título, texto, fuente y línea de la capa`);
    ok(t.cwDistNote.paper && t.cwDistNote.nasa && t.cwDistNote.wiki && t.cwDistNote.tarantula && t.cwDistNote.rosette && t.cwNoDist && t.conNoDist, `[${lang}] nota de distancia para cada tipo de fuente y frase para «sin distancia»`);
  }
}

console.log("Integración");
{
  const src = read("../src/Constellations.jsx"), panels = read("../src/sky/panels.jsx");
  ok(/\{ key: "caldwell",\s+file: "\/caldwell\.json",[^}]*size: 8, lazy: true \}/.test(src) && /\{ key: "messier",\s+file: "\/deepsky\.json",[^}]*size: 8 \}/.test(src), "capa con interruptor, mismo tamaño de símbolo que Messier (8)");
  ok(/MAG_LAYERS = new Set\(\["messier", "caldwell", "galaxies"\]\)/.test(src), "símbolo por magnitud y ocultación con atmósfera, como Messier");
  ok(/keys: \["messier", "caldwell", "galaxies"/.test(panels), "panel de capas: Caldwell en «Cielo profundo», junto a Messier");
  ok(/obj_caldwell:"#[0-9a-f]{6}"/.test(src) && /if \(key === "caldwell"\) return !!ob\.cn/.test(src), "color de etiqueta y nombres notables");
  ok(/\["star", "messier", "caldwell",/.test(src), "métricas: tipo de objeto «caldwell»");
  const metrics = read("../backend/app/metrics.py");
  ok(/SKY_LAYERS = \{[^}]*"caldwell"/.test(metrics) && /SKY_KINDS = \{[\s\S]*?"caldwell"[\s\S]*?\}/.test(metrics), "backend/app/metrics.py acepta la capa y el tipo «caldwell»");
  const app = read("../src/App.jsx");
  ok(/Cúmulos, nebulosas y galaxias", "[^"]*Caldwell[^"]*Baumgardt[^"]*Pietrzyński[^"]*Graczyk/.test(app) && /Clusters, nebulae and galaxies", "[^"]*Caldwell[^"]*Baumgardt[^"]*Pietrzyński[^"]*Graczyk/.test(app), "créditos (es y en): Caldwell y las fuentes de las distancias");
  const pc = read("../src/sky/postcard.js");
  ok(/L === "caldwell"\) \{ fact\(t\.fDistance\)/.test(pc), "la postal tiene cuadrícula de datos para la capa");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
