// Pruebas de los datos y reglas puras de la ronda 3 de la vista Cielo: mapa de títulos
// de Wikipedia, texto de la postal que nunca se corta, postal vertical 9:16 (cuadrícula de
// datos, zonas seguras, Killa Ñan), alto del visor, constelaciones,
// ciencia ciudadana y paridad de textos ES/EN.
// Uso:  node scripts/test_sky_data.mjs     (sale con código 1 si algo falla)
import { readFileSync } from "node:fs";
import { mappedTitle, wikiCandidates, normName, PROBE_TITLES, COMET_TITLES, isObjectPicture } from "../src/sky/wiki.js";
import { wrapLines, fitLines, makeProjection, zenithDir, postcardText, postcardGrid, layoutGrid, planLayout, slotsOf, PC_W, PC_H, SAFE_TOP, SAFE_BOTTOM, HERO_TOP, BLOCK_BOTTOM, GRID, GRID_MAX } from "../src/sky/postcard.js";
import { describeObject } from "../src/sky/describe.js";
import { stageHeight, pickViewportHeight, STAGE_MIN } from "../src/sky/viewport.js";
import { CON_INFO, constellationData, conNameEs, conOrigin } from "../src/sky/constellations.js";
import { CITIZEN, citizenFor, CITIZEN_VERIFIED } from "../src/sky/citizen.js";
import { TX } from "../src/sky/i18n.js";
import { artKind, craftKind } from "../src/sky/art.js";
import { altAz } from "../src/sky/guide.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const backend = readFileSync(new URL("../backend/app/nasa_horizons.py", import.meta.url), "utf8");
const sky = JSON.parse(readFileSync(new URL("../public/sky.json", import.meta.url), "utf8"));

console.log("Mapa nombre → título de Wikipedia");
{
  // los nombres salen del propio backend: si alguien añade una nave, esta prueba dice si le falta título
  const sc = backend.slice(backend.indexOf("SPACECRAFT = ["));
  const probes = [...sc.matchAll(/_sc\("[^"]+",\s*"([^"]+)"/g)].map((m) => m[1]);
  const cm = backend.slice(backend.indexOf("NOTABLE_COMETS = ["));
  const comets = [...cm.slice(0, cm.indexOf("]")).matchAll(/\("[^"]+",\s*"([^"]+)"\)/g)].map((m) => m[1]);
  ok(probes.length >= 21 && comets.length >= 7, `se leen las naves (${probes.length}) y los cometas (${comets.length}) del backend`);
  const missP = probes.filter((n) => !mappedTitle("probes", n)), missC = comets.filter((n) => !mappedTitle("comets", n));
  ok(missP.length === 0, "todas las naves del backend tienen título explícito", missP.join(", "));
  ok(missC.length === 0, "todos los cometas del backend tienen título explícito", missC.join(", "));
  ok(mappedTitle("probes", "James Webb (JWST)").en === "James Webb Space Telescope" && mappedTitle("probes", "JWST").en === "James Webb Space Telescope", "James Webb no acaba en una persona: va al telescopio (por nombre o por sigla)");
  ok(mappedTitle("probes", "Hubble (HST)").es === "Telescopio espacial Hubble", "Hubble → Telescopio espacial Hubble");
  ok(mappedTitle("probes", "Gaia").en === "Gaia (spacecraft)", "Gaia → la nave, no la diosa");
  ok(mappedTitle("probes", "ESCAPADE Blue").en === "EscaPADE" && mappedTitle("probes", "ESCAPADE Gold").en === "EscaPADE", "las dos ESCAPADE comparten artículo");
  ok(mappedTitle("probes", "ExoMars Trace Gas Orbiter").es === "ExoMars Trace Gas Orbiter", "ExoMars TGO");
  ok(mappedTitle("comets", "1P/Halley").es === "Cometa Halley" && mappedTitle("comets", "C/2023 A3 (Tsuchinshan-ATLAS)").en === "Comet Tsuchinshan–ATLAS", "cometas por designación");
  ok(mappedTitle("probes", "Nave Que No Existe") === null && mappedTitle("comets", "999P/Nada") === null, "un nombre fuera del mapa devuelve null…");
  const c = wikiCandidates({ layer: "probes", name: "Nave Que No Existe (NQE)" }, "es");
  ok(c.length >= 4 && c[0].title === "Nave Que No Existe" && c.some((x) => x.title === "Nave Que No Existe (sonda espacial)") && c.every((x) => typeof x.check === "function"), "…y cae a la búsqueda normal, con filtro de «¿habla de una nave?»", JSON.stringify(c.map((x) => x.title)));
  ok(c[0].check("An asteroid sample-return spacecraft") && !c[0].check("In Greek mythology, the personification of the Earth"), "el filtro acepta naves y rechaza páginas que no lo son");
  const p = wikiCandidates({ layer: "probes", name: "Parker Solar Probe" }, "es");
  ok(p[0].lang === "es" && p[0].title === "Sonda Solar Parker" && !p[0].check && p[1].title === "Parker Solar Probe" && p[1].lang === "en", "en español: primero el artículo en español, luego el inglés (para la imagen)");
  const m = wikiCandidates({ layer: "probes", name: "MMX" }, "es");
  ok(m[0].lang === "en" && m[0].title === "Martian Moons eXploration", "sin título en español comprobado: se parte del inglés (y se sigue su enlace interlingüístico)");
  ok(wikiCandidates({ layer: "con", name: "Orion", es: "Orión" }, "es")[0].title === "Orión (constelación)", "constelaciones: «Orión (constelación)», no el personaje");
  ok(!isObjectPicture("DeltaCruLightCurve.png") && !isObjectPicture("Beta_Crucis_light_curve.png") && !isObjectPicture("Sirius_A_and_B_size_comparison.png") && !isObjectPicture("Vega_spectrum.png"), "imágenes que no son el objeto: curvas de luz, comparaciones, espectros");
  ok(isObjectPicture("Mimosa_star.jpg") && isObjectPicture("Betelgeuse_captured_by_ALMA.jpg"), "las fotos del objeto sí");
  // estrellas con nombre de otra cosa: «Mimosa» (la planta), «Atlas», «Electra»… primero «X (estrella)» y siempre
  // con filtro: el resumen tiene que hablar de una estrella
  const mim = wikiCandidates({ layer: "star", name: "Mimosa" }, "es");
  ok(mim[0].title === "Mimosa (estrella)" && mim[1].title === "Mimosa (star)" && mim.every((c) => typeof c.check === "function"), "estrellas: primero «Mimosa (estrella)», todas con filtro");
  ok(!mim[0].check("Mimosa es un género de plantas de la familia de las fabáceas.") && mim[0].check("Beta Crucis es la segunda estrella más brillante de la constelación de la Cruz del Sur."), "el filtro descarta la planta y acepta la estrella");
  ok(!mim[1].check("Mimosa is a genus of about 400 species of shrubs and herbs.") && mim[1].check("Beta Crucis is a binary star system in the constellation of Crux."), "también en inglés");
  const gal = wikiCandidates({ layer: "galaxies", name: "Sunflower", cat: "NGC5055" }, "en");
  ok(gal.every((c) => typeof c.check === "function") && !gal[0].check("Helianthus is a genus of flowering plants.") && gal[0].check("The Sunflower Galaxy is a spiral galaxy."), "galaxias con nombre común: solo artículos de galaxias");
  ok(wikiCandidates({ layer: "exoplanets", name: "Kepler-22b", host: "Kepler-22" }, "es").every((c) => typeof c.check === "function"), "exoplanetas, con filtro");
  ok(wikiCandidates({ layer: "note", name: "kepler" }, "es").length === 0 && wikiCandidates(null, "es").length === 0, "sin objeto no hay candidatos");
  ok(normName("  Ésta   (Prueba)–X ") === "esta (prueba)-x", "normalización de nombres");
  ok(Object.keys(PROBE_TITLES).length >= 20 && Object.keys(COMET_TITLES).length >= 7, "tamaño de los mapas");
  ok(craftKind("James Webb (JWST)") === "telescope" && craftKind("Hubble (HST)") === "telescope" && craftKind("Gaia") === "telescope" && craftKind("Voyager 1") === "probe" && craftKind("Juno") === "probe", "silueta: telescopio o sonda según la nave");
  ok(artKind({ layer: "comets", name: "x" }) === "comet" && artKind({ layer: "messier", type: "globular" }) === "globular" && artKind({ layer: "messier", type: "snr" }) === "snr" && artKind({ layer: "pulsars" }) === "pulsar", "cada tipo de objeto tiene su representación");
}

console.log("Texto de la postal: nunca se corta");
{
  // medidor de prueba: ancho proporcional al número de caracteres y al tamaño
  const measureAt = (px) => (s) => s.length * px * 0.55;
  const maxW = 952;
  const cases = ["Sgr A*", "Agujero negro supermasivo · 26 mil años luz · en la constelación de Sagitario", "C/2023 A3 (Tsuchinshan-ATLAS)", "Supercalifragilisticoespialidoso".repeat(4),
    "Una de dos sondas gemelas que estudiarán cómo Marte pierde su atmósfera tras sobrevolar la Tierra con encendido de motor el 7 y el 9 de noviembre de 2026", ""];
  let worst = 0, allFit = true;
  for (const text of cases) for (const [max, min, lines] of [[96, 56, 2], [34, 26, 2], [34, 27, 3], [22, 18, 2], [30, 22, 1]]) {
    const f = fitLines(measureAt, text, { max, min, maxW, maxLines: lines });
    const w = Math.max(0, ...f.lines.map((l) => measureAt(f.size)(l)));
    worst = Math.max(worst, w);
    if (w > maxW + 1e-9 || f.lines.length > lines || f.size > max || f.size < min) allFit = false;
  }
  ok(allFit, "ninguna línea supera el ancho ni el número de líneas, a ningún tamaño", `ancho máx ${worst}`);
  const t1 = fitLines(measureAt, "Sgr A*", { max: 96, min: 56, maxW, maxLines: 2 });
  ok(t1.size === 96 && t1.lines.length === 1 && !t1.truncated, "un título corto va al tamaño máximo");
  const t2 = fitLines(measureAt, "Agujero negro supermasivo · 26 mil años luz", { max: 60, min: 26, maxW: 700, maxLines: 1 });
  ok(t2.size < 60 && t2.lines.length === 1 && !t2.truncated && t2.lines[0].endsWith("luz"), "la línea que se cortaba («…26 mil añ») ahora encoge y cabe entera", JSON.stringify(t2));
  const t3 = fitLines(measureAt, "palabra ".repeat(60), { max: 30, min: 24, maxW: 400, maxLines: 2 });
  ok(t3.truncated && t3.lines.length === 2 && t3.lines[1].endsWith("…") && measureAt(24)(t3.lines[1]) <= 400, "si ni al mínimo cabe, se recorta con puntos suspensivos dentro del ancho");
  ok(wrapLines(measureAt(20), "a".repeat(200), 300).every((l) => measureAt(20)(l) <= 300), "una palabra más ancha que la línea se parte");
  ok(wrapLines(measureAt(20), "uno dos tres", 1e6).length === 1 && wrapLines(measureAt(20), "", 100).length === 0, "casos límite del partido de líneas");
}

console.log("Postal: textos y proyección del cielo");
{
  const t = TX.es, fmt = { dist: (d) => `${d} años luz`, years: (y) => `${y} años`, km: (k) => `${Math.round(k)} km`, dur: (s) => `${Math.round(s)} s`, when: () => "12 nov 2026, 21:00" };
  const info = { name: "Sgr A*", type: "Agujero negro supermasivo", facts: [], explain: [{ text: "Tiene la masa de 4,3 millones de soles." }], note: "", details: [[TX.es.dSource || "Fuente", "EHT"]], badge: null };
  const tt = { ...t, dSource: "Fuente" }; info.details = [["Fuente", "EHT"]];
  const a = postcardText({ obj: { layer: "blackholes", name: "Sgr A*", dist_ly: 26000, nx: 0, ny: 0, nz: 1 }, info, lang: "es", t: tt, local: null, fmt });
  ok(a.title === "Sgr A*" && a.facts.length === 3 && a.facts[1].includes("26000 años") && a.facts[2].includes("4,3 millones") && a.local === null && a.credit.includes("EHT"), "agujero negro: distancia, luz y un dato propio", JSON.stringify(a));
  const b = postcardText({ obj: { layer: "probes", name: "Voyager 1", dist_km: 299792.458 * 3600, nx: 0, ny: 0, nz: 1 }, info: { ...info, name: "Voyager 1", explain: [] }, lang: "es", t: tt, local: { lat: 0, lon: 0, date: new Date("2026-11-13T02:00:00Z"), place: "Quito" }, fmt });
  ok(b.facts[1].includes("señal de radio") && b.facts[1].includes("3600 s") && /Quito/.test(b.local), "sonda: señal de radio y línea de cielo local", JSON.stringify(b));
  const cm = postcardText({ obj: { layer: "comets", name: "1P/Halley", dist_km: 5.2e9, nx: 0, ny: 0, nz: 1 }, info: { ...info, name: "1P/Halley", explain: [{ title: tt.sigTitleComet, text: tt.sigComet("4,8 horas") }], note: "Ahora mismo se está acercando a la Tierra." }, lang: "es", t: tt, local: null, fmt });
  ok(cm.facts.length === 3 && cm.facts.filter((f) => /luz tarda/.test(f)).length === 1 && cm.facts[2] === "Ahora mismo se está acercando a la Tierra.", "cometa: la frase de la luz no se repite; el tercer dato es si se acerca o se aleja", JSON.stringify(cm.facts));
  const s = postcardText({ obj: null, info: null, lang: "es", t: tt, local: null, fmt });
  ok(s.title === t.pcSky && s.facts.length === 1, "sin objeto: postal del cielo");
  // proyección: el centro cae en el centro; con el norte arriba, el este queda a la izquierda
  const pr = makeProjection([1, 0, 0], [0, 0, 1], 800, 540, 600);
  const c = pr.project([1, 0, 0]), n = pr.project([Math.cos(0.1), 0, Math.sin(0.1)]), e = pr.project([Math.cos(0.1), Math.sin(0.1), 0]);
  ok(Math.abs(c[0] - 540) < 1e-9 && Math.abs(c[1] - 600) < 1e-9, "el objeto queda centrado en su zona");
  ok(n[1] < 600 && Math.abs(n[0] - 540) < 1e-6 && e[0] < 540 && Math.abs(e[1] - 600) < 1e-6, "norte arriba y este a la izquierda (cielo visto desde dentro)");
  ok(Math.abs(Math.hypot(n[0] - 540, n[1] - 600) - 800 * 2 * Math.tan(0.05)) < 1e-6, "escala estereográfica: 2·tan(θ/2) píxeles por radián");
  let worst = 0;
  for (const d of [[0.9, 0.3, 0.2], [0.5, -0.6, 0.62], [0.2, 0.1, -0.97]]) { const L = Math.hypot(...d), u = d.map((x) => x / L), p = pr.project(u), back = pr.unproject(p[0], p[1]); worst = Math.max(worst, ...back.map((x, i) => Math.abs(x - u[i]))); }
  ok(worst < 1e-9, "proyectar y desproyectar devuelve la misma dirección", `${worst}`);
  const date = new Date("2026-11-13T02:00:00Z"), z = zenithDir(-0.2202, -78.5123, date);
  ok(Math.abs(altAz(z[0], z[1], z[2], -0.2202, -78.5123, date).alt - 90) < 1e-6, "el cenit calculado para la postal está a 90° de altura");
}

console.log("Postal vertical 9:16: formato, cuadrícula de datos y Killa Ñan");
{
  ok(PC_W === 1080 && PC_H === 1920, "la postal mide 1080 × 1920 (9:16, historias)", `${PC_W}×${PC_H}`);
  ok(SAFE_TOP >= 200 && SAFE_BOTTOM >= 240 && HERO_TOP >= SAFE_TOP && BLOCK_BOTTOM <= PC_H - SAFE_BOTTOM, "zonas seguras: el visual empieza bajo los 220 px superiores y el texto acaba sobre los 260 inferiores");
  // Killa Ñan: con presencia clara en la cabecera, en el pie y en el texto que acompaña al compartir
  for (const L of ["es", "en"]) {
    const T = TX[L];
    ok(/Yachay Deep Labs × Killa Ñan · /.test(T.pcCoop) && /Killa Ñan/.test(T.pcHeadWith), `${L}: línea «Yachay Deep Labs × Killa Ñan · …» en el pie y Killa Ñan en la cabecera`, `${T.pcCoop} | ${T.pcHeadWith}`);
    ok(T.pcUrl === "teseo.yachaydeep.com", `${L}: la URL del pie es teseo.yachaydeep.com`);
    ok(/ · Teseo, (con|with) Killa Ñan$/.test(T.shareText("Vega")) && /Killa Ñan/.test(T.shareTextSky), `${L}: el texto de compartir menciona a Killa Ñan`, T.shareText("Vega"));
  }
  ok(TX.es.pcCoop === "Yachay Deep Labs × Killa Ñan · Astronomía comunitaria", "es: texto exacto de la línea de cooperación");
  // el diálogo: la vista previa declara 1080 × 1920 y cabe en el teléfono
  const dlg = readFileSync(new URL("../src/sky/ShareDialog.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/sky/sky.css", import.meta.url), "utf8");
  const prev = (css.match(/\.sk-share-preview \{[^}]*\}/) || [""])[0];
  ok(/useState\(\[1080, 1920\]\)/.test(dlg) && /width=\{dims\[0\]\} height=\{dims\[1\]\}/.test(dlg), "la vista previa declara 1080 × 1920 por defecto (la foto 360°, su propio tamaño)");
  ok(/aspect-ratio: 1080 \/ 1920/.test(prev) && /max-height: 70vh/.test(prev) && /object-fit: contain/.test(css.match(/\.sk-share-preview img \{[^}]*\}/)[0]), "CSS: proporción 9:16, máx. 70vh y object-fit: contain", prev);

  // la ficha usa también textos de Constellations.jsx (JSX, no importable en Node): se copian aquí los que hacen falta
  const T = { ...TX.es, fDistance: "Distancia", fLightLeft: "Su luz salió hace", fLightTakes: "Su luz tarda", fVoyager: "En la Voyager 1 tardarías", ago: (s) => s,
    fLightHint: "lo ves como era entonces", au: "UA", typeStar: "Estrella", typePlanet: "Planeta", typeSun: "Estrella", typeMoon: "Satélite",
    dDiameter: "Diámetro", timesEarth: (x) => `${x} × la Tierra`, dRotation: "Una vuelta sobre sí", retrograde: "al revés", dOrbitSun: "Una vuelta al Sol", dOrbitEarth: "Una vuelta a la Tierra",
    dPosition: "Posición en el cielo", dMagnitude: "Magnitud aparente", magHint: "menor es más brillante", dSource: "Fuente", dCatalog: "Catálogo", dHubble: "Tipo de Hubble",
    dMass: "Masa", dPeriod: "Período de giro", dKind: "Tipo", dParent: "Proviene de", dRadius: "Radio", earthRadii: "radios terrestres", earthMasses: "masas terrestres",
    dYear: "Su año dura", dHost: "Estrella", dDiscovered: "Descubierto", fPeak: "Noche máxima", fActive: "Activa", fRate: "En su mejor momento", perHour: (n) => `~${n} por hora`,
    zhrHint: "con cielo oscuro y despejado", typeMeteor: "Lluvia de meteoros", radiantNote: "Radiante.", meteorParent: (p) => `Viene de ${p}.`, typeExoplanet: "Exoplaneta", orbits: (h) => `orbita ${h}` };
  const fmt = { dist: (d) => `${d} años luz`, years: (y) => `${y} años`, km: (k) => `${Math.round(k)} km`, dur: (s) => `${Math.round(s)} s`, when: () => "12 nov 2026, 21:00", time: (d) => d.toISOString().slice(11, 16) };
  const sirio = sky.stars.find((s) => s[7] === "Sirio" || s[7] === "Sirius");
  const so = { layer: "star", name: sirio[7], nx: sirio[1], ny: sirio[2], nz: sirio[3], mag: sirio[4], dist_ly: sirio[6], hex: sirio[5], bv: 0.009, spect: "A0m..." };
  const g = postcardGrid({ obj: so, info: describeObject(so, "es", T, false), t: T, lang: "es", local: null, fmt });
  const labels = g.map((c) => c.label);
  ok(slotsOf(g) === GRID_MAX && g.length === 5 && labels[0] === "Distancia" && g[0].wide && /^Su luz salió hace 8\.6 años: la ves como era entonces$/.test(g[0].sub) && !labels.includes(T.fLightLeft) && labels.includes("Magnitud aparente") && labels.includes(T.dTemp) && labels.includes(T.dSpect), "estrella: distancia y luz en UNA casilla ancha, magnitud, temperatura y tipo espectral (6 plazas)", JSON.stringify(labels));
  const mag = g.find((c) => c.label === "Magnitud aparente");
  ok(mag.value === so.mag.toLocaleString("es", { maximumFractionDigits: 2 }) && mag.sub === "menor es más brillante", "el valor grande es el número; la aclaración va debajo", JSON.stringify(mag));
  const bare = { ...so, bv: null, spect: "", mag: null, hex: "#zzzzzz" };
  const gb = postcardGrid({ obj: bare, info: describeObject(bare, "es", T, false), t: T, lang: "es", local: null, fmt });
  ok(!gb.some((c) => c.label === T.dTemp || c.label === T.dSpect || c.label === "Magnitud aparente") && gb.length === 2, "sin B−V, tipo espectral ni magnitud no se inventa ninguna casilla (la cuadrícula queda más corta)", JSON.stringify(gb.map((c) => c.label)));
  // cielo local: altura y salida/puesta al final, sin pasar de 6
  const local = { lat: 0.0389, lon: -78.1426, date: new Date("2026-11-17T04:00:00Z"), place: "Cayambe" };
  const gl = postcardGrid({ obj: so, info: describeObject(so, "es", T, false), t: T, lang: "es", local, fmt });
  ok(slotsOf(gl) === GRID_MAX && gl.length === 5 && gl[0].kind === "dist" && gl[3].kind === "local" && gl[4].kind === "local" && gl[3].label === T.pcGAlt, "cielo local: distancia (ancha) + 2 datos + altura + salida/puesta", JSON.stringify(gl.map((c) => [c.label, c.value, c.sub])));
  ok(/^\d+°$/.test(gl[3].value) && /^hacia el /.test(gl[3].sub) || gl[3].value === T.pcGBelow, "la altura es un número de grados con su dirección (o «bajo el horizonte»)", JSON.stringify(gl[3]));
  ok([T.pcGSet, T.pcGRise, T.pcGHorizon].includes(gl[4].label) && (/^\d\d:\d\d$/.test(gl[4].value) || gl[4].label === T.pcGHorizon), "hora de salida o puesta (o «no se pone» / «hoy no sale»)", JSON.stringify(gl[4]));
  // planeta: datos de la ficha (diámetro con su comparación)
  const jup = { layer: "solar", name: "Júpiter", nx: 1, ny: 0, nz: 0, dist_au: 4.5, mag: -2.7, body: "planet", ra: 100, dec: 20 };
  const gj = postcardGrid({ obj: jup, info: describeObject(jup, "es", T, false), t: T, lang: "es", local: null, fmt });
  ok(gj.some((c) => c.label === "Diámetro" && /km$/.test(c.value) && /× la Tierra/.test(c.sub)) && !gj.some((c) => c.label === "Su luz tarda") && /^su luz tarda .+ en llegar$/.test(gj[0].sub) && gj.length >= 4 && slotsOf(gj) <= GRID_MAX, "planeta: distancia con la luz en la misma casilla, diámetro (× la Tierra) y más", JSON.stringify(gj.map((c) => [c.label, c.value, c.sub])));
  // sonda: la luz se rotula como señal de radio
  const vg = { layer: "probes", name: "Voyager 1", nx: 0, ny: 0, nz: 1, dist_km: 2.5e10, agency: "NASA", launched: 1977 };
  const gv = postcardGrid({ obj: vg, info: describeObject(vg, "es", { ...T, typeProbe: "Nave", probeLine: () => "", fAgency: "Agencia", fLaunched: "Lanzamiento", targetName: {}, phaseName: {}, sigLine: () => "", sigBand: {} }, false), t: T, lang: "es", local: null, fmt });
  ok(!gv.some((c) => c.label === T.pcGSignal) && /^una señal de radio tarda .+ en llegar$/.test(gv[0].sub) && gv.some((c) => c.label === "Agencia" && c.value === "NASA"), "sonda: la señal de radio va en la casilla de distancia; y la agencia", JSON.stringify(gv.map((c) => [c.label, c.sub])));
  // lluvia de meteoros: noche máxima, actividad y tasa
  const met = { layer: "meteors", name: "Gemínidas", peak: "12-14", start: "12-04", end: "12-17", zhr: 150, parent: "3200 Faetón" };
  const gm = postcardGrid({ obj: met, info: describeObject(met, "es", T, false), t: T, lang: "es", local: null, fmt });
  ok(gm.map((c) => c.label).join("|") === "Noche máxima|Activa|En su mejor momento|Proviene de", "meteoros: noche máxima, actividad, tasa y origen", JSON.stringify(gm.map((c) => c.label)));
  // constelación: la más cercana, la más lejana, cuántas estrellas y la más brillante
  const ori = sky.constellations.find((c) => c.ab === "Ori"), od = constellationData(ori, sky.stars);
  const con = { ab: "Ori", title: "Orion", type: "Constelación · Orión", dir: od.dir, radius: od.radius, stars: od.hips, near: { name: od.near.name, d: od.near.dist }, far: { name: od.far.name, d: od.far.dist }, bright: { name: od.stars[0].name, mag: od.stars[0].mag } };
  const gc = postcardGrid({ con, t: T, lang: "es", local, fmt });
  ok(gc.length === GRID_MAX && gc[0].label === T.conNear && gc[2].value === String(od.hips.size) && gc[3].label === T.pcGBright && gc[3].value === od.stars[0].name, "constelación: cercana, lejana, nº de estrellas, la más brillante + cielo local", JSON.stringify(gc.map((c) => [c.label, c.value])));
  const tc = postcardText({ con, t: T, lang: "es", local, fmt });
  ok(tc.curio.startsWith(T.pcConAligned) && /veces más lejos/.test(tc.curio) && tc.where === "Desde Cayambe · 12 nov 2026, 21:00", "constelación: dato curioso con la proporción real y lugar/hora", JSON.stringify([tc.curio, tc.where]));
  // cielo sin objeto: lo que hay en el mapa (cifras del catálogo, no inventadas)
  const gs = postcardGrid({ obj: null, t: T, lang: "es", local: null, fmt, sky, bodies: [] });
  ok(gs[0].value === sky.stars.length.toLocaleString("es") && gs[1].value === String(sky.constellations.length), "cielo sin objeto: nº real de estrellas y constelaciones del mapa", JSON.stringify(gs));

  // la cuadrícula nunca desborda: medidor proporcional, valores larguísimos, 1 a 6 casillas
  const mf = (role, px) => (s) => s.length * px * (role === "value" ? 0.6 : 0.55);
  const long = [
    { label: "Distancia", value: "26 mil años luz", sub: "lo ves como era entonces" },
    { label: "Masa", value: "4,3 millones de masas solares (aprox.)" },
    { label: "Radio del horizonte", value: "12,7 millones de km", sub: "calculado a partir de su masa (2GM/c², sin rotación)" },
    { label: "Temperatura (estimada)", value: "≈ 9.940 K", sub: "no es una medida directa · 1,7 veces la del Sol" },
    { label: "En la Voyager 1 tardarías", value: "458 millones de años" },
    { label: "Planetas sobre el horizonte", value: "Mercurio, Venus, Marte, Júpiter, Saturno, Urano, Neptuno" },
  ];
  let allIn = true, worst = "";
  for (let n = 1; n <= 6; n++) {
    const lay = layoutGrid(mf, long.slice(0, n), { x: 64, y: 0, w: 952 });
    if (lay.truncated) { allIn = false; worst = `trunc n=${n}`; }
    for (const c of lay.cells) {
      if (c.x < 64 - 1e-6 || c.x + c.w > 1016 + 1e-6) { allIn = false; worst = `caja n=${n}`; }
      for (const [role, f] of [["label", c.label], ["value", c.value], ["sub", c.sub]]) if (f) for (const l of f.lines) if (mf(role, f.size)(l) > c.inner + 1e-6) { allIn = false; worst = `${role} «${l}»`; }
      if (c.value.size < GRID.valueMin || c.label.size < 24 || (c.sub && c.sub.size < 24)) { allIn = false; worst = `tamaño n=${n}`; }
    }
    if (n % 2 === 1 && lay.cells[0].w !== 952) { allIn = false; worst = `impar n=${n}`; }
  }
  ok(allIn, "cuadrícula: ninguna línea sale de su casilla ni de los márgenes, sin recortes y con texto ≥ 24 px", worst);
  const lay6 = layoutGrid(mf, long, { x: 64, y: 0, w: 952 });
  ok(lay6.cells.length === 6 && lay6.cells.every((c, i, a) => i % 2 === 0 || c.h === a[i - 1].h) && Math.abs(lay6.cells[1].x - (64 + lay6.cells[0].w + GRID.gap)) < 1e-6, "6 casillas en 3 filas de 2, con el mismo alto por fila");
  // reparto vertical: el bloque acaba sobre la zona segura inferior y el visual no baja de su mínimo
  const pl = planLayout(800, 31, true);
  ok(pl.blockTop + 800 === BLOCK_BOTTOM && pl.heroMaxH >= 300 && pl.heroTop >= SAFE_TOP && pl.fits, "reparto: texto apoyado sobre la zona segura y visual grande", JSON.stringify(pl));
  ok(!planLayout(1300, 62, true).fits, "si el texto es demasiado alto, el reparto avisa (y la postal quita casillas)");
}

console.log("Alto del visor");
{
  ok(stageHeight(740, 151).height === 589 && stageHeight(740, 151).fits, "390×740 con cabecera de 151 px → 589 px: llega justo al borde inferior");
  ok(stageHeight(844, 151).height === 693, "al esconderse la barra (844) crece hasta el nuevo borde");
  ok(stageHeight(900, 150, 16).height === 734, "escritorio: deja el margen inferior");
  const s = stageHeight(390, 151);
  ok(s.height === STAGE_MIN && !s.fits, "teléfono apaisado: no encoge por debajo del mínimo y la página vuelve a desplazarse");
  ok(pickViewportHeight(740, 740, { height: 740, scale: 1, offsetTop: 0 }) === 740, "medidas coincidentes");
  ok(pickViewportHeight(844, 844, { height: 796, scale: 1, offsetTop: 0 }) === 796, "una barra del navegador que tapa 48 px: manda lo visible");
  ok(pickViewportHeight(740, 740, { height: 420, scale: 1, offsetTop: 0 }) === 740, "el teclado en pantalla no encoge el visor");
  ok(pickViewportHeight(740, 740, { height: 370, scale: 2, offsetTop: 0 }) === 740, "con zoom de pellizco se ignora visualViewport");
  ok(pickViewportHeight(0, 812, null) === 812 && pickViewportHeight(0, 0, { height: 700, scale: 1 }) === 700, "respaldos: innerHeight y visualViewport");
}

console.log("Constelaciones");
{
  ok(Object.keys(CON_INFO).length === 88 && sky.constellations.every((c) => conNameEs(c.ab) && "PAVKCFMHL".includes(conOrigin(c.ab))), "las 88 tienen nombre en español y origen");
  const n = {}; for (const k in CON_INFO) n[CON_INFO[k][1]] = (n[CON_INFO[k][1]] || 0) + 1;
  // Ptolomeo: 48 = 47 que siguen igual + Argo Navis (hoy Carina, Puppis y Vela); Coma Berenices aparte
  ok(n.P === 47 && n.A === 3 && n.V === 1 && n.L === 14 && n.K === 12 && n.H === 7 && n.M === 2 && n.F === 1 && n.C === 1, "recuento por origen coherente con la tabla (47 + Argo en 3 + 14 de Lacaille + 12 australes + 7 de Hevelius…)", JSON.stringify(n));
  const ori = sky.constellations.find((c) => c.ab === "Ori"), d = constellationData(ori, sky.stars);
  ok(d && d.stars.length >= 15 && d.stars[0].name === "Rigel" && d.stars.some((s) => s.name === "Betelgeuse"), "Orión: sus estrellas, de más a menos brillante");
  ok(d.near.dist < d.far.dist && d.ratio > 3 && d.near.dist > 20 && d.far.dist > 1000, "Orión: la más lejana está varias veces más lejos que la más cercana", `${d.near.name} ${d.near.dist} / ${d.far.name} ${d.far.dist}`);
  ok(Math.abs(Math.hypot(...d.dir) - 1) < 1e-9 && d.radius > 0.15 && d.radius < 0.5, "centroide unitario y tamaño angular razonable", `${d.radius}`);
  ok(sky.constellations.every((c) => constellationData(c, sky.stars)), "las 88 producen ficha");
  console.log(`        Orión: ${d.near.name} a ${d.near.dist} a. l. · ${d.far.name} a ${d.far.dist} a. l.`);
}

console.log("sky.json: esquema");
{
  // esquema 2: [hip, x, y, z, mag, color, dist_ly, nombre, B−V|null, espectro]. Los 8 primeros no cambian de
  // posición ni de significado: el código antiguo (y un sky.json antiguo en caché) siguen funcionando.
  ok(sky.meta && sky.meta.schema === 2 && sky.meta.star_fields.slice(0, 8).join() === "hip,x,y,z,mag,color,dist_ly,name", "meta.schema = 2 y los 8 primeros campos de siempre", JSON.stringify(sky.meta && sky.meta.star_fields));
  ok(sky.stars.length === 5044 && sky.stars.every((s) => s.length === 10), "5.044 estrellas de 10 campos");
  ok(sky.stars.every((s) => Number.isInteger(s[0]) && s[0] > 0 && typeof s[4] === "number" && typeof s[6] === "number" && s[6] > 0 && typeof s[7] === "string"), "HIP, magnitud, distancia y nombre con su tipo");
  ok(sky.stars.filter((s) => s[8] != null).length >= 5040 && sky.stars.filter((s) => s[9]).length === sky.stars.length, "casi todas con B−V y todas con tipo espectral (HYG v4.1)");
  ok(/build_sky\.py/.test(sky.meta.generator) && /CC BY-SA 4\.0/.test(sky.meta.stars_source), "generador y licencia declarados");
}

console.log("Participa (ciencia ciudadana)");
{
  ok(citizenFor({ layer: "meteors" })[0].url === "https://www.imo.net/observations/fireballs/fireball-report-program/" && /diez noches cada mes/.test(CITIZEN.find((p) => p.id === "globe-at-night").es) && /ten-night campaigns every month/.test(CITIZEN.find((p) => p.id === "globe-at-night").en), "IMO: página del programa de bólidos; Globe at Night: campañas mensuales de diez noches (verificado 13-nov-2026)");
  ok(!CITIZEN.some((p) => /no se pudo confirmar|could not be confirmed/i.test(p.es + p.en)), "ningún texto dice que no se pudo confirmar");
  ok(/^\d{4}-\d{2}-\d{2}$/.test(CITIZEN_VERIFIED), "hay fecha de verificación");
  ok(CITIZEN.every((p) => /^https:\/\//.test(p.url) && p.es && p.en && p.name && p.org && ["fetch", "search"].includes(p.how) && TX.es.joinNeeds[p.needs] && TX.en.joinNeeds[p.needs]), "cada proyecto: URL https, textos ES/EN, cómo se comprobó y qué hace falta");
  ok(new Set(CITIZEN.map((p) => p.id)).size === CITIZEN.length, "sin duplicados");
  const ids = (o, local) => citizenFor(o, local).map((p) => p.id).join(",");
  ok(ids({ layer: "exoplanets" }) === "exoplanet-watch,planet-hunters-tess", "exoplanetas → Exoplanet Watch y Planet Hunters TESS");
  ok(ids({ layer: "galaxies" }) === "galaxy-zoo" && ids({ layer: "messier", type: "galaxy" }) === "galaxy-zoo", "galaxias → Galaxy Zoo");
  ok(ids({ layer: "meteors" }) === "imo-fireball" && ids({ layer: "comets" }) === "iasc-asteroids", "meteoros → IMO; cometas → IASC");
  ok(ids({ layer: "star" }, false) === "aavso" && ids({ layer: "star" }, true) === "globe-at-night,aavso" && ids({ layer: "con" }, true) === "globe-at-night", "estrellas → AAVSO, y Globe at Night solo con cielo local");
  ok(ids({ layer: "solar" }) === "" && ids({ layer: "probes" }) === "" && ids(null) === "" && ids({ layer: "messier", type: "open" }) === "", "donde no hay proyecto relacionado no se muestra nada");
}

console.log("Textos ES/EN");
{
  const deep = (a, b, path, out) => { for (const k in a) { if (!(k in b)) out.push(path + k); else if (a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) deep(a[k], b[k], path + k + ".", out); else if (typeof a[k] !== typeof b[k]) out.push(path + k + " (tipo)"); } return out; };
  const m1 = deep(TX.es, TX.en, "", []), m2 = deep(TX.en, TX.es, "", []);
  ok(m1.length === 0 && m2.length === 0, "cada clave existe en los dos idiomas", [...m1, ...m2].join(", "));
  ok(TX.es.declOn(-5.07).includes("−5,1°") && TX.en.declOn(4.26).includes("+4.3°"), "declinación con signo y un decimal en cada idioma", TX.es.declOn(-5.07));
  ok(TX.es.rsLine("18:42", "00:10", 85, "05:51") === "Sale 18:42 · más alto 00:10 (85°) · se pone 05:51", "línea de salida, culminación y puesta");
}

console.log(`\n${passed} pruebas correctas, ${failed} con fallo`);
process.exit(failed ? 1 : 0);
