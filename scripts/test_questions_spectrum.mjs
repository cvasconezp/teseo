// Pruebas de la física pura, los datos, el juego y los textos de «¿Cómo sabemos de qué están
// hechas las estrellas?» (src/questions/spectrumData.js, spectrumText.js, SpectrumTour.jsx).
// Uso:  node scripts/test_questions_spectrum.mjs   (sale con código 1 si algo falla)
import fs from "node:fs";
import { LINES } from "../src/sky/composition.js";
import { starTemperature } from "../src/sky/starColor.js";
import { compositionPlan } from "../src/sky/composition.js";
import { parseRoute } from "../src/questions/physics.js";
import {
  SPECIES, SPECIES_IDS, EXTRA_LINES, SPEC_REFS, MIX_PRESETS, TEMP_PRESETS, CHALLENGES, DEFAULT_STATE, COLD_LIMIT_CM1,
  wienPeak, SUN_TEFF, classOfTemp, tempFromSlider, sliderFromTemp, T_MIN, T_MAX,
  lineFactor, saturation, buildSpectrum, nirCurve, NIR_MIN, NIR_MAX,
  presetSpecies, truthOf, evaluate, challengeSpectrum, encodeMix, decodeMix, readState, HELIUM_D3_NM,
} from "../src/questions/spectrumData.js";
import { SPEC_T } from "../src/questions/spectrumText.js";
import { TQ } from "../src/questions/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const within = (a, b, tol) => Math.abs(a - b) <= tol;
const eq = (a, b, name) => ok(a === b, name, `→ obtuvo ${JSON.stringify(a)}, esperaba ${JSON.stringify(b)}`);
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const keysOf = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keysOf(v, `${pre}${k}.`) : [`${pre}${k}`]));
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

// ─── Longitudes de onda contra NIST ────────────────────────────────────────
// Valores de referencia: NIST Atomic Spectra Database, consulta del 14-nov-2026, línea más intensa
// de cada ventana, longitud OBSERVADA en aire (nm) y energía del nivel inferior (cm⁻¹).
// (Para He II 468,57 NIST solo da la longitud de Ritz, 468,5704.)
const NIST = {
  Ha: [656.279, 82259.158], Hb: [486.135, 82259.158], Hg: [434.0472, 82259.158], Hd: [410.1734, 82259.158],
  HeI447: [447.14802, null], HeI588: [587.5621, null], HeII469: [468.5704, null],
  NaD2: [588.995095, 0], NaD1: [589.592424, 0],
  CaK: [393.366, 0], CaH: [396.847, 0],
  Mgb1: [518.36042, 21870.464], Mgb2: [517.26843, 21870.464], Mgb4: [516.73216, 21870.464],
  CaI423: [422.673, 0],
  Fe386: [385.99111, 0], Fe405: [404.58122, 11976.239], Fe431: [430.79020, 12560.934], Fe438: [438.35447, 11976.239],
  Fe467: [466.81341, 26339.696], Fe496: [495.75965, 22650.416], Fe517: [516.88978, 415.933], Fe527: [527.03560, 12968.554],
  Fe533: [532.80383, 7376.764],
};
console.log("Líneas atómicas contra NIST (±0,2 nm)");
const allLines = Object.fromEntries(SPECIES_IDS.flatMap(id => SPECIES[id].vis.map(l => [l.key, l])));
let nChecked = 0;
for (const [key, [nm, ei]] of Object.entries(NIST)) {
  const l = allLines[key];
  ok(!!l && within(l.nm, nm, 0.2), `${key}: ${l && l.nm} nm ≈ NIST ${nm} nm`, l ? `(Δ = ${(l.nm - nm).toFixed(3)})` : "no existe");
  if (l && ei != null) ok(l.ei === ei || within(l.ei, ei, 0.01), `${key}: nivel inferior ${ei} cm⁻¹ (NIST)`, String(l && l.ei));
  nChecked++;
}
ok(nChecked === 24, "24 líneas atómicas comprobadas (H, He, Na, Ca, Mg, Fe)", String(nChecked));
ok(["H", "He", "Na", "Ca", "Mg", "Fe"].every(id => SPECIES[id].vis.length > 0 && SPECIES[id].vis.every(l => NIST[l.key])), "toda línea atómica de la interfaz tiene su referencia NIST");
ok(Object.keys(EXTRA_LINES).filter(k => k.startsWith("Fe")).length === 9, "nueve líneas de Fe I");
eq(LINES.HeI588.nm, 587.56, "el helio D₃ de composition.js (587,56 nm) coincide con NIST (587,562) ±0,2");
ok(within(HELIUM_D3_NM, 587.562, 0.2), "línea D₃ del helio ≈ 587,562 nm");

console.log("Líneas de Fraunhofer: coinciden con la tabla publicada (±0,2 nm)");
const FRAUNHOFER = { Ha: 656.281, NaD1: 589.592, NaD2: 588.995, Mgb1: 518.362, Mgb2: 517.270, Mgb4: 516.733, Hb: 486.134, Fe431: 430.790, Hd: 410.175, CaH: 396.847, CaK: 393.366, Fe527: 527.039, Fe517: 516.891, Fe496: 495.761, Fe467: 466.814, Fe438: 438.355 };
for (const [k, nm] of Object.entries(FRAUNHOFER)) ok(within(allLines[k].nm, nm, 0.2), `${k} ≈ Fraunhofer ${nm} nm`);

console.log("Bandas moleculares: las posiciones de las fuentes citadas");
const band = (k) => allLines[k].nm;
ok(within(band("O2B"), 686.719, 0.01) && within(band("O2a"), 627.661, 0.01), "O₂: bandas B (686,719) y a (627,661), líneas de Fraunhofer");
ok(SPECIES.O2.nir.length === 1 && within(SPECIES.O2.nir[0].nm, 760, 2), "O₂: banda A en ≈ 760 nm (759,37 de Fraunhofer; 0,76 µm de Gao y OCO-2)");
ok(within(band("CH4_619"), 619, 0.5) && within(band("CH4_727"), 727, 0.5) && within(SPECIES.CH4.nir[0].nm, 890, 0.5), "CH₄: 619, 727 y 890 nm (Cassini ISS)");
ok(sameSet(SPECIES.H2O.nir.map(b => b.nm), [940, 1140, 1380, 1880]), "H₂O: 0,94 · 1,14 · 1,38 · 1,88 µm (Gao et al. 1993)");
ok(sameSet(SPECIES.CO2.nir.map(b => b.nm), [1610, 2010, 2060]), "CO₂: 1,61 (OCO-2) · 2,01 (Gao) · 2,06 µm (OCO-2)");
ok(SPECIES.H2O.vis.length === 0 && SPECIES.CO2.vis.length === 0, "H₂O y CO₂ sin bandas en el visible: no hay posición verificada, no se pone");
ok(sameSet(SPECIES.TiO.vis.map(l => l.nm), [544.8, 619.25, 705.4]), "TiO: 544,8 · 619,25 · 705,4 nm (composition.js)");
ok(SPECIES_IDS.every(id => SPECIES[id].nir.every(b => b.nm >= NIR_MIN && b.nm <= NIR_MAX)), "las bandas del infrarrojo cercano caben en la tira (700–2.200 nm)");
ok(SPECIES_IDS.every(id => SPECIES[id].vis.every(l => l.nm >= 380 && l.nm <= 750)), "las líneas visibles caben en el eje de Spectrum.jsx (380–750 nm)");
ok(SPECIES_IDS.every(id => SPECIES[id].refs.length > 0 && SPECIES[id].refs.every(r => SPEC_REFS[r])), "cada especie cita fuentes que existen");

console.log("Wien y Planck");
ok(within(wienPeak(5772), 502.04, 0.1), "pico de Wien a 5.772 K ≈ 502 nm", String(wienPeak(5772)));
eq(SUN_TEFF, 5772, "temperatura del Sol = 5.772 K (UAI 2015)");
ok(within(wienPeak(3300), 878, 1) && within(wienPeak(15000), 193.2, 0.1), "M a 3.300 K → 878 nm (infrarrojo); B a 15.000 K → 193 nm (ultravioleta)");
eq(classOfTemp(5772), "G", "5.772 K es clase G"); eq(classOfTemp(3300), "M", "3.300 K es clase M"); eq(classOfTemp(9500), "A", "9.500 K es clase A");
eq(classOfTemp(15000), "B", "15.000 K es clase B"); eq(classOfTemp(40000), "O", "40.000 K es clase O");
ok(tempFromSlider(0) === T_MIN && tempFromSlider(100) === T_MAX && Math.abs(sliderFromTemp(tempFromSlider(40)) - 40) <= 1, "deslizador de temperatura logarítmico, de 2.500 a 35.000 K");
ok(TEMP_PRESETS.map(p => p.T).join() === "5772,3300,15000", "atajos de temperatura: Sol, roja M, azul B");
{
  const c = nirCurve(5772, []), mx = Math.max(...c.map(p => p.y));
  ok(c.length > 300 && Math.abs(mx - 1) < 1e-9, "curva del infrarrojo cercano normalizada a 1");
  const d = nirCurve(5772, [{ nm: 1380, half: 45, depth: 0.8 }]);
  const i = d.findIndex(p => p.nm === 1380);
  ok(d[i].y < c[i].y * 0.25, "una banda a 1.380 nm la baja de verdad");
}

console.log("Mezclas: física de cada ambiente");
const sunSpec = buildSpectrum({ mode: "star", T: SUN_TEFF, mix: { He: 0.7, H: 0.7 } });
ok(sunSpec.present.includes("H") && !sunSpec.present.includes("He") && sunSpec.silent.some(s => s.id === "He" && s.reason === "class"), "a 5.772 K el helio no deja líneas visibles (y lo dice) pero el hidrógeno sí");
const bSpec = buildSpectrum({ mode: "star", T: 15000, mix: { He: 0.7, H: 0.7 } });
ok(bSpec.present.includes("He") && bSpec.present.includes("H"), "a 15.000 K el helio sí deja líneas");
ok(bSpec.visLines.some(l => within(l.nm, 587.56, 0.2)) && bSpec.visLines.some(l => within(l.nm, 447.15, 0.2)), "…en 587,56 y 447,15 nm");
const molStar = buildSpectrum({ mode: "star", T: SUN_TEFF, mix: { CO2: 1, O2: 1, CH4: 1, H2O: 1 } });
ok(molStar.present.length === 0 && molStar.silent.length === 4 && molStar.silent.every(s => s.reason === "hot"), "en una estrella las moléculas se rompen: ninguna deja bandas");
const atomPlanet = buildSpectrum({ mode: "planet", T: SUN_TEFF, mix: { H: 1, He: 1, Na: 1, Ca: 1, Mg: 1, Fe: 1, TiO: 1 } });
ok(sameSet(atomPlanet.present, ["Na", "Ca", "Fe"]), "gas frío: solo Na, Ca I y Fe I (líneas del estado fundamental); H, He y Mg no", atomPlanet.present.join());
ok(atomPlanet.silent.find(s => s.id === "TiO").reason === "tio" && atomPlanet.silent.find(s => s.id === "H").reason === "cold", "motivos: TiO no sobrevive en un planeta; H necesita calor");
ok(atomPlanet.visLines.every(l => l.group !== "cahk") && atomPlanet.visLines.some(l => l.group === "cai"), "gas frío: sin Ca II (necesita ion), con Ca I 422,7 nm");
ok(Object.values(allLines).filter(l => !l.mol && lineFactor(l, "planet", SUN_TEFF) > 0).every(l => l.ei < COLD_LIMIT_CM1 && !l.needsIon), "regla del gas frío: nivel inferior < 300 cm⁻¹ y sin ion");
const tioM = buildSpectrum({ mode: "star", T: 3300, mix: { TiO: 0.7 } });
ok(tioM.present.includes("TiO") && tioM.visLines.length === 3, "TiO en una M fría: tres cabezas de banda");
ok(!buildSpectrum({ mode: "star", T: 15000, mix: { TiO: 1 } }).present.includes("TiO"), "TiO no aparece en una estrella B");
ok(saturation(0) === 0 && Math.abs(saturation(1) - 1) < 1e-12 && saturation(0.5) > 0.5, "la profundidad crece con la cantidad y se aplana");
ok(buildSpectrum({ mode: "planet", T: SUN_TEFF, mix: { CO2: 1 } }).nir.every(b => b.depth > buildSpectrum({ mode: "planet", T: SUN_TEFF, mix: { CO2: 0.3 } }).nir.find(c => c.nm === b.nm).depth), "más CO₂ (Venus) → bandas más profundas que con menos (Marte)");
ok(buildSpectrum({ mode: "star", T: SUN_TEFF, mix: {} }).visLines.length === 0, "mezcla vacía: sin líneas");

console.log("Atajos de mezcla");
const P = Object.fromEntries(MIX_PRESETS.map(p => [p.id, p]));
ok(sameSet(presetSpecies(P.earth), ["O2", "H2O"]) && P.earth.mode === "planet", "Tierra → O₂ y H₂O (planeta)");
ok(sameSet(presetSpecies(P.mars), ["CO2"]) && P.mars.mode === "planet", "Marte → CO₂");
ok(sameSet(presetSpecies(P.venus), ["CO2"]) && P.venus.mode === "planet", "Venus → CO₂");
ok(sameSet(presetSpecies(P.jupiter), ["He", "CH4"]) && P.jupiter.mode === "planet", "Júpiter → He y CH₄ (el H₂ casi no deja líneas)");
ok(sameSet(presetSpecies(P.sun), ["H", "Na", "Ca", "Mg", "Fe"]) && P.sun.mode === "star" && P.sun.T === 5772, "Sol → H, Na, Ca, Mg y Fe (estrella, 5.772 K)");
eq(MIX_PRESETS.map(p => p.id).join(), "earth,mars,venus,jupiter,sun", "cinco atajos, en el orden pedido");
ok(P.venus.mix.CO2 > P.mars.mix.CO2, "Venus lleva más CO₂ que Marte");
{
  const r = Object.fromEntries(MIX_PRESETS.map(p => [p.id, buildSpectrum(p)]));
  ok(sameSet(r.earth.present, ["O2", "H2O"]) && r.earth.visLines.some(l => within(l.nm, 686.719, 0.01)) && r.earth.nir.some(b => b.nm === 760) && r.earth.nir.some(b => b.nm === 940), "Tierra: bandas del O₂ (628, 687, 760 nm) y del H₂O (940 nm…)");
  ok(sameSet(r.mars.present, ["CO2"]) && r.mars.visLines.length === 0 && r.mars.nir.length === 3, "Marte: nada en el visible, tres bandas del CO₂ en el infrarrojo cercano");
  ok(sameSet(r.jupiter.present, ["CH4"]) && r.jupiter.silent.some(s => s.id === "He"), "Júpiter: solo deja huella el metano; el helio se queda sin líneas");
  ok(sameSet(r.sun.present, ["H", "Na", "Ca", "Mg", "Fe"]), "Sol: las cinco especies dejan líneas");
  ok(r.jupiter.visLines.some(l => l.nm === 619) && r.jupiter.visLines.some(l => l.nm === 727) && r.jupiter.nir.some(b => b.nm === 890), "Júpiter: metano a 619, 727 y 890 nm");
}
ok(Object.keys(DEFAULT_STATE.mix).length === 5 && DEFAULT_STATE.mode === "star", "estado inicial: el Sol");

console.log("Enlace (hash)");
eq(encodeMix({ O2: 0.6, H2O: 0.5 }), "O2:0.6,H2O:0.5", "codifica la mezcla en el orden canónico");
ok(JSON.stringify(decodeMix("H2O:0.5,O2:0.6,Xx:1,CO2:abc,Fe:5")) === JSON.stringify({ O2: 0.6, H2O: 0.5, Fe: 1 }) || JSON.stringify(decodeMix("H2O:0.5,O2:0.6,Xx:1,CO2:abc,Fe:5")) === JSON.stringify({ H2O: 0.5, O2: 0.6, Fe: 1 }), "decodifica y descarta ids y cantidades inválidos (acota a 1)");
eq(decodeMix("zz:1"), null, "sin ids válidos → null");
{
  const r = parseRoute("#preguntas?q=spectrum&m=planet&t=3300&e=CO2:0.3", ["spectrum"]);
  const s = readState(r.params);
  ok(r.id === "spectrum" && s.mode === "planet" && s.T === 3300 && s.mix.CO2 === 0.3, "ruta #preguntas?q=spectrum con modo, temperatura y mezcla");
  const bad = readState(new URLSearchParams("m=otra&t=abc&e="));
  ok(bad.mode === null && bad.T === null && bad.mix === null, "valores inválidos del enlace se ignoran");
  eq(readState(new URLSearchParams("t=999999")).T, 35000, "temperatura acotada a 35.000 K");
  ok(parseRoute("#questions?q=spectrum", ["mass", "spectrum"]).id === "spectrum", "ruta en inglés #questions?q=spectrum");
}

console.log("Juego: «¿De qué está hecho?»");
ok(CHALLENGES.length >= 5, "al menos cinco retos", String(CHALLENGES.length));
eq(CHALLENGES.map(c => c.id).join(), "sun,m,a,b,earth,mars,jupiter", "retos: Sol, M, A, B, Tierra, Marte y Júpiter");
const C = Object.fromEntries(CHALLENGES.map(c => [c.id, c]));
ok(sameSet(truthOf(C.sun), ["H", "Na", "Ca", "Mg", "Fe"]), "Sol: H, Na, Ca, Mg, Fe", truthOf(C.sun).join());
ok(sameSet(truthOf(C.m), ["TiO", "Na", "Ca", "Mg", "Fe"]) && C.m.T === 3300, "estrella M: TiO, Na, Ca, Mg, Fe", truthOf(C.m).join());
ok(sameSet(truthOf(C.a), ["H", "Ca"]) && classOfTemp(C.a.T) === "A", "estrella A: hidrógeno (y la K del calcio)", truthOf(C.a).join());
ok(sameSet(truthOf(C.b), ["H", "He"]) && classOfTemp(C.b.T) === "B", "estrella B: H y He", truthOf(C.b).join());
ok(sameSet(truthOf(C.earth), ["O2", "H2O"]) && C.earth.mode === "planet", "Tierra: O₂ y H₂O");
ok(sameSet(truthOf(C.mars), ["CO2"]) && C.mars.mode === "planet", "Marte: CO₂");
ok(sameSet(truthOf(C.jupiter), ["CH4"]) && C.jupiter.mix.He > 0, "Júpiter: solo CH₄ deja huella aunque el He esté en el planeta");
ok(CHALLENGES.every(c => Object.keys(c.mix).every(id => c.mix[id] > 0) && c.refs.every(r => SPEC_REFS[r])), "cada reto tiene mezcla y fuentes que existen");
ok(CHALLENGES.every(c => truthOf(c).length >= 1), "ningún reto está vacío");
{
  // Hidrógeno muy fuerte en la A: es la línea más profunda de su espectro
  const a = challengeSpectrum(C.a), top = [...a.visLines].sort((x, y) => y.depth - x.depth)[0];
  ok(top.id === "H", "estrella A: la línea más profunda es de hidrógeno");
  const sunH = Math.max(...challengeSpectrum(C.sun).visLines.filter(l => l.id === "H").map(l => l.depth));
  ok(Math.max(...a.visLines.filter(l => l.id === "H").map(l => l.depth)) > sunH * 1.8, "el hidrógeno es mucho más fuerte en la A que en el Sol");
}
{
  let r = evaluate(C.sun, ["H", "Na", "Ca", "Mg", "Fe"]);
  ok(r.perfect && r.found.length === 5 && r.missed.length === 0 && r.extra.length === 0 && r.total === 5, "todo bien → perfecto");
  r = evaluate(C.sun, []);
  ok(!r.perfect && r.missed.length === 5 && r.found.length === 0 && r.extra.length === 0, "sin marcar nada → faltan los cinco");
  r = evaluate(C.sun, ["H", "Na", "He"]);
  ok(sameSet(r.found, ["H", "Na"]) && sameSet(r.missed, ["Ca", "Mg", "Fe"]) && sameSet(r.extra, ["He"]) && !r.perfect, "mezcla de aciertos, olvidos y una sobra");
  ok(r.rows.find(x => x.id === "He" && !x.ok && !x.present && x.marked) && r.rows.find(x => x.id === "H" && x.ok) && r.rows.find(x => x.id === "Fe" && !x.ok && x.present && !x.marked), "una fila por especie: acierto o fallo");
  ok(!r.rows.some(x => x.id === "CO2"), "no se listan especies irrelevantes (ni presentes ni marcadas)");
  r = evaluate(C.jupiter, ["CH4", "He"]);
  ok(sameSet(r.found, ["CH4"]) && sameSet(r.extra, ["He"]) && r.rows.find(x => x.id === "He").hidden === true && r.rows.find(x => x.id === "He").silent.reason === "cold", "Júpiter: marcar el He es un fallo, y se explica que está pero no se ve");
  r = evaluate(C.jupiter, ["CH4"]);
  ok(r.perfect, "Júpiter: solo CH₄ es perfecto");
  r = evaluate(C.mars, ["CO2", "O2"]);
  ok(sameSet(r.extra, ["O2"]) && r.rows.find(x => x.id === "O2").hidden === false, "Marte: O₂ sobra y no estaba en la mezcla (no es «oculto»)");
  r = evaluate(C.b, new Set(["He", "H"]));
  ok(r.perfect, "acepta un Set; B: H y He, perfecto");
  r = evaluate(C.m, ["TiO", "Na"]);
  ok(sameSet(r.found, ["TiO", "Na"]) && sameSet(r.missed, ["Ca", "Mg", "Fe"]), "M: marcar TiO y Na deja tres por encontrar");
  r = evaluate(C.earth, ["O2", "H2O", "CO2"]);
  ok(sameSet(r.extra, ["CO2"]) && sameSet(r.found, ["O2", "H2O"]), "Tierra: el CO₂ marcado de más cuenta como sobra");
}

console.log("Datos de la interfaz");
{
  const tour = read("../src/questions/SpectrumTour.jsx"), qjsx = read("../src/questions/Questions.jsx"), css = read("../src/questions/spectrum.css"), data = read("../src/questions/spectrumData.js");
  ok(/spectrum: lazy\(\(\) => import\("\.\/SpectrumTour\.jsx"\)\)/.test(qjsx) && /TOUR_IDS = \[[^\]]*"spectrum"/.test(qjsx), "«spectrum» registrado en TOURS y TOUR_IDS");
  ok(/id === "spectrum"/.test(qjsx), "el índice tiene el emblema de «spectrum»");
  ok(/from "\.\.\/sky\/Spectrum\.jsx"/.test(tour) && /from "\.\.\/sky\/composition\.js"/.test(data), "reutiliza Spectrum.jsx y composition.js (sin copiarlos)");
  ok(!/background:\s*(#fff\b|#ffffff|white)/i.test(css) && !/fill:\s*(#fff\b|white)/i.test(css), "sin fondos ni rellenos blancos (compatible con visión nocturna)");
  ok((tour.match(/aria-pressed/g) || []).length >= 4 && /aria-label=\{`\$\{name\} \(\$\{sp\.sym\}\)/.test(tour), "interruptores con aria-pressed y aria-label");
  ok(/role="img"/.test(tour) && /aria-hidden="true"/.test(tour), "espectro con role=\"img\" y descripción textual de las líneas");
  ok(/night-vision/.test(tour) && /q-spec-night/.test(tour), "rótulo de visión nocturna junto al espectro");
  ok(/data-preset=\{`mix-\$\{p\.id\}`\}/.test(tour) && /data-preset=\{`temp-\$\{p\.id\}`\}/.test(tour) && /data-preset=\{`mode-\$\{m\}`\}/.test(tour), "atajos con data-preset (métrica q_preset)");
  ok(!/localStorage|sessionStorage|document\.cookie/.test(tour + data), "el juego no guarda nada (ni localStorage ni cookies)");
  ok(/url: `#\$\{prefix\}\?q=mass`/.test(tour) && /#sky\?o=star~Betelgeuse/.test(tour), "cierre con enlaces a la pregunta de la masa (q=mass) y a Betelgeuse en el Cielo");
  const used = [...tour.matchAll(/ids=\{(?:\[([^\]]*)\])/g)].flatMap(m => m[1].split(",").map(x => x.trim()).filter(x => /^"/.test(x)).map(x => x.replace(/"/g, "")));
  ok(used.length > 15 && used.every(id => SPEC_REFS[id]), "todos los ids de fuentes que usa el recorrido existen", used.filter(id => !SPEC_REFS[id]).join());
  ok(Object.values(SPEC_REFS).every(r => /^https:\/\//.test(r.url) && r.cite && r.citeEn), "cada fuente tiene enlace https y cita en ES y EN");
  const metrics = read("../backend/app/metrics.py");
  ok(/TOURS = \{[^}]*"spectrum"[^}]*\}/.test(metrics), "«spectrum» en TOURS del backend");
  ok(/Siete preguntas grandes/.test(read("../src/questions/i18n.js")) && /Seven big questions/.test(read("../src/questions/i18n.js")), "el índice dice «Siete» (ES) y «Seven» (EN)");
}
{
  // Betelgeuse: la ficha del Cielo debe poder dibujar su espectro (tipo M coherente con su color)
  const sky = JSON.parse(read("../public/sky.json"));
  const st = sky.stars.find(s => s[7] === "Betelgeuse");
  ok(!!st, "Betelgeuse está en el catálogo del Cielo (para #sky?o=star~Betelgeuse)");
  const plan = compositionPlan({ layer: "star", spect: st[9] }, starTemperature(st[8]));
  ok(plan && plan.kind === "star" && plan.temp > 0 && plan.letter === "M" && plan.lines.length > 0, `la ficha de Betelgeuse dibuja su espectro (M, ${plan && plan.temp} K)`);
}

console.log("Textos ES/EN");
{
  const es = SPEC_T.es, en = SPEC_T.en;
  const ke = keysOf(es).sort(), kn = keysOf(en).sort();
  ok(JSON.stringify(ke) === JSON.stringify(kn), "mismas claves en ES y EN", ke.filter(k => !kn.includes(k)).concat(kn.filter(k => !ke.includes(k))).join());
  ok(SPECIES_IDS.every(id => es.species[id] && en.species[id]), "nombre de cada especie en ES y EN");
  ok(es.s1.timeline.length === 5 && en.s1.timeline.length === 5 && es.s1.timeline.every(t => t.refs.every(r => SPEC_REFS[r])), "cinco hitos de la historia, con fuentes");
  eq(es.s1.timeline.map(t => t.year).join(), "1666–1672,1814,1859–1860,1868,1925", "fechas: Newton 1666–1672, Fraunhofer 1814, Kirchhoff y Bunsen 1859–1860, helio 1868, Payne 1925");
  eq(en.s1.timeline.map(t => t.year).join(), "1666–1672,1814,1859–1860,1868,1925", "mismas fechas en EN");
  ok(/18 de agosto de 1868/.test(es.s1.timeline[3].text) && /18 August 1868/.test(en.s1.timeline[3].text) && /1895/.test(es.s1.timeline[3].text), "eclipse del 18-ago-1868 y helio en la Tierra en 1895");
  ok(/1672/.test(es.s1.timeline[0].text) && /570/.test(es.s1.timeline[1].text) && /1925|tesis/.test(es.s1.timeline[4].text), "cifras de la historia: 1672, más de 570 líneas, tesis de Payne");
  ok(es.s3.challenges && CHALLENGES.every(c => es.s3.challenges[c.id] && en.s3.challenges[c.id] && es.s3.challenges[c.id].hint && es.s3.challenges[c.id].explain), "cada reto tiene nombre, pista y explicación en ES y EN");
  ok(es.assumptions.length === en.assumptions.length && es.assumptions.length >= 6, "«Supuestos» con la misma lista en ES y EN");
  ok(/WASP-39/.test(es.s4.webb.title) && /2022/.test(es.s4.webb.p1) && /4,3 µm/.test(es.s4.webb.p1) && /4\.3 µm/.test(en.s4.webb.p1) && /25 de agosto de 2022/.test(es.s4.webb.p2) && /25 August 2022/.test(en.s4.webb.p2), "WASP-39 b: CO₂ a 4,3 µm, anunciado el 25-ago-2022");
  ok(/26 sigmas/.test(es.s4.webb.p1) && /26 sigma/.test(en.s4.webb.p1), "26 sigmas (Nature)");
  ok(/hipótesis|biofirma/i.test(es.s4.bio.teaser) && /posible/.test(es.s4.bio.teaser), "O₂ + CH₄ se presenta como «posible biofirma»");
  ok(/Ninguno de los casos citados/.test(es.s4.k2.p2) && /None of the cases cited/.test(en.s4.k2.p2), "K2-18 b se presenta como caso abierto, no como confirmado");
  ok(/14\.000 veces/.test(es.s3.challenges.mars.explain) && 92000 / 6.36 > 14000 && 92000 / 6.36 < 15000, "Venus es unas 14.000 veces más densa que Marte (92 bar / 6,36 mb)");
  ok(es.s2.silent.cold() && es.s2.silent.hot() && es.s2.silent.class() && es.s2.silent.tio() && en.s2.silent.cold(), "avisos de «sin líneas aquí»");
  ok(/rojos/.test(es.s2.night) && /red/.test(en.s2.night), "rótulo de visión nocturna: los colores se ven rojos");
  ok(/N₂/.test(es.s2.n2.p1) && /78,08/.test(es.s2.n2.p1) && /78\.08/.test(en.s2.n2.p1), "el N₂ casi no deja líneas (78,08 % del aire seco, NASA)");
  const t = TQ.es, u = TQ.en;
  ok(t.tours.spectrum && u.tours.spectrum && t.tours.spectrum.title === "¿Cómo sabemos de qué están hechas las estrellas?" && u.tours.spectrum.title === "How do we know what stars are made of?", "índice: título, entradilla y etiqueta en ES y EN");
  ok(es.title === t.tours.spectrum.title && en.title === u.tours.spectrum.title, "el título del recorrido coincide con el del índice");
  // Ningún texto del reto antes de comprobar revela la respuesta en el ARIA del espectro
  ok(!/Na|H₂O|CO₂|CH₄/.test(es.s2.mysteryAria("401 nm", 1)), "la descripción del espectro misterioso no nombra elementos");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
