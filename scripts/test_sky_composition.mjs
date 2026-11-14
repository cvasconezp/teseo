// Pruebas de «¿De qué está hecho?» (src/sky/composition.js) y «Su vida y su final» (src/sky/starLife.js):
// Planck y Wien, longitudes de onda NIST, porcentajes de la NASA, clasificación por letra, etapas,
// masas curadas, finales por masa y textos ES/EN.
// Uso:  node scripts/test_sky_composition.mjs     (sale con código 1 si algo falla)
import { readFileSync } from "node:fs";
import {
  WIEN_B, C2, VIS_MIN, VIS_MAX, SUN_TEFF, ATMOSPHERES, SUN_MASS, LINES, GROUPS, STRENGTH, CLASSES,
  spectralLetter, linesForClass, fraunhoferLines, planckRel, wienPeak, peakZone, spectrumCurve, absorption,
  wavelengthHex, compositionPlan, sumPct,
} from "../src/sky/composition.js";
import { MS_TABLE, msRow, CURATED, fateOf, nearEdge, msLifetime, sig1, absMag, stageOf, lifePlan, PATHS, massRange } from "../src/sky/starLife.js";
import { starTemperature, parseSpect } from "../src/sky/starColor.js";
import { COMP, LIFE } from "../src/sky/i18n-comp.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const sky = JSON.parse(readFileSync(new URL("../public/sky.json", import.meta.url), "utf8"));
const starRow = (name) => sky.stars.find((s) => s[7] === name);
const starObj = (name) => { const s = starRow(name); return s && { layer: "star", name: s[7], mag: s[4], dist_ly: s[6], bv: s[8], spect: s[9] || "" }; };

console.log("Cuerpo negro: Planck y Wien (CODATA 2018)");
{
  ok(WIEN_B === 2.897771955e6 && C2 === 1.438776877e7, "constantes de Wien y c₂ exactas");
  ok(near(wienPeak(5772), 502.04, 0.05), "Sol 5.772 K → pico ≈ 502 nm", wienPeak(5772));
  ok(near(wienPeak(3000), 965.92, 0.05) && peakZone(3000) === "ir", "3.000 K → 966 nm, infrarrojo");
  ok(peakZone(10500) === "uv" && near(wienPeak(10500), 275.98, 0.05), "10.500 K → 276 nm, ultravioleta");
  ok(peakZone(5772) === "visible", "el pico del Sol cae en el visible");
  // el máximo numérico de Planck (muestreo fino) coincide con la ley de Wien
  for (const T of [4000, 5772, 7000]) {
    let best = 0, at = 0;
    for (let nm = 300; nm <= 900; nm += 0.05) { const b = planckRel(nm, T); if (b > best) { best = b; at = nm; } }
    ok(near(at, WIEN_B / T, 0.1), `Planck(${T} K) tiene su máximo donde dice Wien (${(WIEN_B / T).toFixed(1)} nm)`, at);
  }
  // cociente B(λ1)/B(λ2) contra la fórmula completa con constantes h, c, k (CODATA)
  const h = 6.62607015e-34, c = 299792458, k = 1.380649e-23;
  const Bfull = (nm, T) => { const l = nm * 1e-9; return (2 * h * c * c) / (l ** 5 * Math.expm1((h * c) / (l * k * T))); };
  ok(near(planckRel(450, 5772) / planckRel(650, 5772), Bfull(450, 5772) / Bfull(650, 5772), 1e-6), "forma relativa = Planck completa (450/650 nm)");
  ok(planckRel(500, 0) === 0 && planckRel(-1, 5000) === 0 && planckRel(380, 50) === 0, "sin desbordes con T o λ absurdas");
  const cv = spectrumCurve(5772);
  ok(cv.length === VIS_MAX - VIS_MIN + 1 && near(Math.max(...cv.map((p) => p.y)), 1, 1e-12), "curva normalizada a 1 dentro de 380–750 nm");
  const hot = spectrumCurve(20000), cool = spectrumCurve(3000);
  ok(hot[0].y > hot[hot.length - 1].y && cool[0].y < cool[cool.length - 1].y, "estrella caliente baja hacia el rojo; fría sube hacia el rojo");
  const withLines = spectrumCurve(9700, linesForClass("A"));
  const at = (arr, nm) => arr.find((p) => p.nm === nm).y;
  ok(at(withLines, 656) < at(spectrumCurve(9700), 656) * 0.6, "Hα fuerte en una A: la curva cae > 40 % en 656 nm");
  ok(absorption(600, { nm: 589.3, depth: 0.5 }) < 0.001 && absorption(700, { nm: 705.4, depth: 0.6, band: true }) === 0, "absorción local; las bandas solo hacia el rojo");
  ok(/^#[0-9a-f]{6}$/.test(wavelengthHex(380)) && wavelengthHex(700).startsWith("#") && wavelengthHex(520).slice(3, 5) === "ff", "colores del visible bien formados (520 nm verde)");
}

console.log("\nLongitudes de onda (NIST ASD, aire) con tolerancia 0,2 nm");
{
  // valores de NIST Atomic Spectra Database (consulta 14-nov-2026) y cabezas de banda de TiO publicadas
  const NIST = {
    Ha: 656.279, Hb: 486.135, Hg: 434.047, Hd: 410.173, CaK: 393.366, CaH: 396.847, NaD2: 588.995, NaD1: 589.592,
    Mgb1: 518.360, Mgb2: 517.268, Mgb4: 516.732, HeI447: 447.148, HeI588: 587.562, HeII469: 468.57,
    TiO545: 544.8, TiO619: 619.25, TiO705: 705.4,
  };
  for (const [k, v] of Object.entries(NIST)) ok(LINES[k] && near(LINES[k].nm, v, 0.2), `${k}: ${LINES[k] && LINES[k].nm} nm ≈ ${v}`);
  ok(Object.keys(LINES).every((k) => k in NIST), "todas las líneas dibujadas tienen su valor verificado en la prueba");
  const fr = Object.fromEntries(fraunhoferLines().map((l) => [l.fr, l.nm]));
  ok(near(fr.C, 656.281, 0.2) && near(fr.F, 486.134, 0.2) && near(fr.K, 393.366, 0.2) && near(fr.H, 396.847, 0.2) && near(fr["D₁"], 589.592, 0.2) && near(fr["b₁"], 518.362, 0.2), "letras de Fraunhofer en su sitio (C, F, H, K, D₁, b₁)");
  ok(!fraunhoferLines().some((l) => l.band || l.ion.startsWith("He")), "el Sol no lleva TiO ni helio");
  ok(Object.values(LINES).every((l) => l.nm >= VIS_MIN && l.nm <= VIS_MAX), "todas dentro de 380–750 nm");
}

console.log("\nClasificación por letra y líneas por clase");
{
  const cases = [["M2Ib", "M"], ["B8Ia", "B"], ["A0m...", "A"], ["G2V", "G"], ["K2IIIp", "K"], ["O9.5Ib SB", "O"], ["F5IV-V", "F"], ["sdB5", "B"], ["DA2", null], ["C5II", null], ["WC8", null], ["", null], [null, null]];
  for (const [s, L] of cases) ok(spectralLetter(s) === L, `"${s}" → ${L}`);
  ok(CLASSES.join("") === "OBAFGKM" && Object.values(STRENGTH).every((a) => a.length === 7 && a.every((v) => v >= 0 && v <= 3)), "tabla de intensidades 7 clases × 0–3");
  const has = (L, g) => linesForClass(L).some((l) => l.group === g);
  const str = (L, g) => (linesForClass(L).find((l) => l.group === g) || {}).strength || 0;
  ok(str("A", "balmer") === 3 && ["O", "B", "F", "G", "K", "M"].every((L) => str(L, "balmer") < 3), "Balmer máximas en A");
  ok(has("M", "tio") && !has("K", "tio") && !has("G", "tio"), "TiO solo en M");
  ok(has("O", "heii") && !has("B", "heii"), "He II solo en O");
  ok(str("B", "hei") === 3 && str("O", "hei") === 2 && !has("A", "hei"), "He I en O–B, máximo en B");
  ok(str("G", "cahk") === 3 && str("K", "cahk") === 3 && str("A", "cahk") === 1, "Ca II H y K fuertes en G y K");
  ok(str("K", "nad") === 3 && !has("B", "nad"), "Na D fuerte en K, ausente en B");
  ok(linesForClass("X").length === 0 && linesForClass(null).length === 0, "letra desconocida → sin líneas");
  const ls = linesForClass("G"); ok(ls.every((l, i) => i === 0 || ls[i - 1].nm <= l.nm), "líneas ordenadas por longitud de onda");
}

console.log("\nAtmósferas (NASA Fact Sheets) y Sol (Asplund et al. 2009)");
{
  const expect = {
    "Venus": [["CO2", 96.5], ["N2", 3.5]], "Tierra": [["N2", 78.08], ["O2", 20.95], ["Ar", 0.934], ["CO2", 0.042]],
    "Marte": [["CO2", 95.1], ["N2", 2.59], ["Ar", 1.94], ["O2", 0.16], ["CO", 0.06]], "Júpiter": [["H2", 89.8], ["He", 10.2]],
    "Saturno": [["H2", 96.3], ["He", 3.25]], "Urano": [["H2", 82.5], ["He", 15.2], ["CH4", 2.3]], "Neptuno": [["H2", 80.0], ["He", 19.0], ["CH4", 1.5]],
  };
  for (const [k, g] of Object.entries(expect)) ok(JSON.stringify(ATMOSPHERES[k].gases) === JSON.stringify(g), `${k}: cifras de la NASA`);
  for (const [k, a] of Object.entries(ATMOSPHERES)) if (a.gases) {
    const s = sumPct(a.gases);
    ok(s <= 100.5 && s >= 99, `${k}: suman ${s.toFixed(3)} % (≤ 100,5)`);
    ok(a.gases.every((g, i) => i === 0 || a.gases[i - 1][1] >= g[1]), `${k}: de mayor a menor`);
  }
  ok(ATMOSPHERES.Mercurio.kind === "exosphere" && !ATMOSPHERES.Mercurio.gases && ATMOSPHERES.Luna.kind === "exosphere" && !ATMOSPHERES.Luna.gases, "Mercurio y Luna: exosfera sin porcentajes");
  ok(JSON.stringify(ATMOSPHERES.Mercurio.species) === JSON.stringify(["Na", "Mg", "O", "H", "K", "Ca"]), "Mercurio: especies que lista la NASA");
  ok(near(sumPct(SUN_MASS), 100, 1e-9) && SUN_MASS[0][1] === 73.81 && SUN_MASS[1][1] === 24.85 && SUN_MASS[2][1] === 1.34, "Sol: X 73,81 · Y 24,85 · Z 1,34 % (suman 100)");
  ok(SUN_TEFF === 5772, "Sol a 5.772 K (UAI 2015)");
}

console.log("\nPlan por objeto (qué se muestra)");
{
  const sun = compositionPlan({ layer: "solar", name: "Sol" });
  ok(sun.kind === "sun" && sun.temp === 5772 && sun.lines.every((l) => l.fr), "Sol: fotosfera + espectro de Fraunhofer");
  ok(compositionPlan({ layer: "solar", name: "Marte" }).kind === "planet" && compositionPlan({ layer: "solar", name: "Luna" }).atm.kind === "exosphere", "Marte y Luna");
  for (const L of ["messier", "galaxies", "pulsars", "exoplanets", "probes", "blackholes", "con", "note", "comets", "meteors"]) ok(compositionPlan({ layer: L, name: "x" }) === null, `capa ${L}: sin sección`);
  const bet = starObj("Betelgeuse"), bp = compositionPlan(bet, starTemperature(bet.bv));
  ok(bp.letter === "M" && bp.temp === 3800 && bp.lines.some((l) => l.band), "Betelgeuse (M2Ib, B−V 1,5): espectro M a ≈ 3.800 K con TiO", JSON.stringify([bp.letter, bp.temp]));
  ok(peakZone(bp.temp) === "ir", "Betelgeuse: pico fuera del visible (infrarrojo)");
  const rig = starObj("Rigel"), rp = compositionPlan(rig, starTemperature(rig.bv));
  ok(rp.letter === "B" && rp.lowerBound && peakZone(rp.temp) === "uv", "Rigel: B, temperatura mínima, pico ultravioleta");
  const sir = starObj("Sirius"), sp = compositionPlan(sir, starTemperature(sir.bv));
  ok(sp.letter === "A" && sp.lines.some((l) => l.group === "balmer" && l.strength === 3), "Sirio: A con Balmer fuertes");
  const noBv = compositionPlan({ layer: "star", name: "x", bv: null, spect: "G2V" }, starTemperature(null));
  ok(noBv.temp === null && noBv.lines.length === 0, "sin B−V: composición sí, espectro no");
  const noSp = compositionPlan({ layer: "star", name: "x", bv: 0.65, spect: "" }, starTemperature(0.65));
  ok(noSp.temp === null, "sin tipo espectral: sin espectro");
  const carbon = compositionPlan({ layer: "star", name: "x", bv: 1.2, spect: "C5II" }, starTemperature(1.2));
  ok(carbon.temp === null, "estrella de carbono (clase C): sin espectro O–M");
  const cap = starObj("Capella"), cp = compositionPlan(cap, starTemperature(cap.bv));
  ok(cp.temp === null && cp.lines.length === 0 && cp.mismatch && !bp.mismatch, "Capella («M1: comp» con B−V 0,795, incoherente): no se dibujan líneas de M");
}

console.log("\nVida y final: tabla de Pecaut y Mamajek, etapas, masas, finales");
{
  ok(MS_TABLE.length > 80 && MS_TABLE.every((r, i) => i === 0 || MS_TABLE[i - 1][1] >= r[1]), "tabla ordenada por temperatura decreciente");
  const g2 = msRow("G", 2), m2 = msRow("M", 2), b8 = msRow("B", 8);
  ok(g2.mass === 1.0 && g2.teff === 5770 && g2.mv === 4.8, "G2V: 1,00 M☉, 5.770 K, Mv 4,80");
  ok(m2.mass === 0.44 && b8.mass === 3.38, "M2V 0,44 M☉ · B8V 3,38 M☉");
  ok(msRow("G", null) === null && msRow("X", 2) === null, "sin subclase o letra rara: sin fila");
  ok(near(absMag(-1.44, 8.6), 1.45, 0.02), "Sirio: magnitud absoluta ≈ +1,45", absMag(-1.44, 8.6));
  const st = (s, mAbs) => stageOf(parseSpect(s), mAbs);
  ok(st("G2V").stage === "ms" && st("K2IIIp").stage === "giant" && st("M2Ib").stage === "supergiant" && st("B8Ia").stage === "supergiant", "V, III, Ib, Ia");
  ok(st("F5IV-V").stage === "subgiant" && st("B2III").stage === "giant" && st("DA2").stage === "wd" && st("F0II").stage === "giant", "IV, III, D, II");
  const sirius = st("A0m...", absMag(-1.44, 8.6));
  ok(sirius.stage === "ms" && sirius.assumed, "Sirio sin clase: secuencia principal deducida de su brillo (A0V Mv 0,99)");
  ok(st("A0m...", -5).stage === null, "sin clase y brillo incoherente: no se decide");
  ok(fateOf(0.2) === "redDwarf" && fateOf(1) === "wd" && fateOf(7.9) === "wd" && fateOf(9) === "border" && fateOf(15) === "ns" && fateOf(25) === "nsbh" && fateOf(50) === "bh", "finales por masa (OpenStax 23.1 + NASA)");
  ok(fateOf(0) === null && fateOf(undefined) === null, "sin masa: sin final");
  ok(nearEdge([18, 24]) && !nearEdge([14, 19]) && nearEdge([7.7, 8.3]), "detección de rango que cruza un umbral");
  ok(near(msLifetime(1), 1e10, 1) && near(msLifetime(2), 1e10 * 2 ** -2.5, 1) && msLifetime(0.3) === null, "vida ≈ 10¹⁰ años × M^−2,5; sin cifra por debajo de 0,5 M☉");
  ok(sig1(1767766952) === 2e9 && sig1(5.59e6) === 6e6, "redondeo a una cifra significativa");
  for (const [n, c] of Object.entries(CURATED)) {
    const r = massRange(c.mass);
    ok(starRow(n) && r[0] > 0 && r[1] >= r[0] && c.ref.length > 0 && c.ref.every((x) => /\d{4}/.test(x)), `curada: ${n} existe en el catálogo, con masa y referencia`);
  }
  const L = (n) => lifePlan(starObj(n), parseSpect(starObj(n).spect));
  const bet = L("Betelgeuse");
  ok(bet.stage === "supergiant" && bet.fate === "ns" && bet.path[bet.here] === "supergiant" && bet.massKind === "curated", "Betelgeuse: supergigante → supernova → estrella de neutrones");
  const rig = L("Rigel");
  ok(rig.fate === "nsbh" && rig.near && rig.age[0] === 7e6, "Rigel: 21 ± 3 M☉ cruza 20 → neutrones o agujero negro; edad 8 ± 1 Ma");
  const sir = L("Sirius");
  ok(sir.stage === "ms" && sir.fate === "wd" && sir.here === 0 && sir.comp === "siriusB" && sir.lifetime > 1e9, "Sirio: secuencia principal → enana blanca, compañera Sirio B");
  const arc = L("Arcturus");
  ok(arc.stage === "giant" && arc.fate === "wd" && arc.path[arc.here] === "giant" && arc.lifetime === null, "Arturo: gigante → enana blanca (sin vida de secuencia principal: ya salió)");
  const ald = L("Aldebaran");
  ok(ald.stage === "giant" && ald.mass === null && ald.fate === "giantUnknown", "Aldebarán: gigante sin masa curada → final condicional, sin cifra");
  const ran = L("Ran");
  ok(ran.stage === "ms" && ran.massKind === "estimated" && ran.mass.v === 0.82 && ran.fate === "wd", "Ran (K2V): masa estimada 0,82 M☉ por tipo espectral");
  const spica = L("Spica");
  ok(spica.massKind === "estimated" && spica.fate === "ns", "Espiga (B1V): masa estimada 11,8 M☉ → supernova");
  const can = L("Canopus");
  ok(can.fate === "border" && can.near, "Canopus 8,0 ± 0,3 M☉: frontera enana blanca / supernova");
  const red = lifePlan({ layer: "star", name: "x", mag: 11, dist_ly: 4.2, spect: "M5.5Ve" }, parseSpect("M5.5Ve"));
  ok(red.fate === "redDwarf" && red.lifetime === null && red.path.join() === PATHS.redDwarf.join(), "enana roja M5.5V: enana blanca de helio, sin cifra de vida");
  const wdS = lifePlan({ layer: "star", name: "x", mag: 8, dist_ly: 10, spect: "DA2" }, parseSpect("DA2"));
  ok(wdS.stage === "wd" && wdS.here === wdS.path.length - 1, "enana blanca: marcador al final");
  const sun = lifePlan({ layer: "solar", name: "Sol" });
  ok(sun.kind === "sun" && sun.fate === "wd" && sun.here === 0 && sun.age[0] === 4.6e9, "Sol: G2V, 4.600 Ma, secuencia principal → enana blanca");
  ok(lifePlan({ layer: "solar", name: "Marte" }) === null && lifePlan({ layer: "messier", name: "M1" }, null) === null, "planetas y cielo profundo: sin bloque de vida");
  ok(lifePlan({ layer: "star", name: "x" }, null) === null, "estrella sin tipo espectral: sin bloque de vida");
}

console.log("\nTextos ES/EN");
{
  const keysOf = (o) => Object.keys(o).sort().join();
  ok(keysOf(COMP.es) === keysOf(COMP.en), "COMP: mismas claves en ES y EN");
  ok(keysOf(LIFE.es) === keysOf(LIFE.en), "LIFE: mismas claves en ES y EN");
  for (const lang of ["es", "en"]) {
    const t = COMP[lang], l = LIFE[lang];
    ok(Object.values(ATMOSPHERES).every((a) => t.compNote[a.note] && t.compSrc[a.src] && (a.gases || []).every(([g]) => t.gas[g]) && (a.species || []).every((s) => t.species[s])), `[${lang}] cada atmósfera tiene nota, fuente y nombres`);
    ok(Object.keys(GROUPS).every((g) => t.specGroup[g]), `[${lang}] nombre de cada grupo de líneas`);
    ok(/3\.?,?800/.test(t.specCaption(3800, "M", false)) && /M/.test(t.specCaption(3800, "M", false)) && (lang === "es" ? /No es una medición/ : /not a measurement/).test(t.specCaption(3800, "M", false)), `[${lang}] el pie dice temperatura, clase y que no es una medición`);
    ok(t.specCaption(10500, "B", true).includes("≥"), `[${lang}] temperatura mínima marcada con ≥`);
    const all = new Set(Object.values(PATHS).flat());
    ok([...all].every((s) => l.stage[s]), `[${lang}] nombre de cada etapa`);
    ok(["redDwarf", "wd", "wdLate", "border", "ns", "nsbh", "bh", "giantUnknown", "superUnknown"].every((f) => l.fate[f]), `[${lang}] frase de cada final`);
    ok(["ms", "subgiant", "giant", "supergiant", "wd", "none"].every((s) => typeof l.type[s] === "function"), `[${lang}] frase de cada tipo`);
    ok(l.mass([14, 19]).includes("14") && l.mass({ v: 2.063, e: 0.023 }).includes("±"), `[${lang}] formato de masa (rango y ±)`);
  }
  ok(LIFE.es.age([2e8, 3e8]) === "entre 200 y 300 millones de años" && LIFE.en.age([6e9, 8.5e9]) === "6–8.5 billion years", "edades en palabras");
  ok(LIFE.es.life(1e10) === "≈ 10.000 millones de años" && LIFE.en.life(1e10) === "≈ 10 billion years", "10.000 millones = 10 billion");
  ok(LIFE.es.type.supergiant("roja") === "Es una supergigante roja: una estrella muy masiva en sus últimas etapas.", "frase de supergigante roja");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
