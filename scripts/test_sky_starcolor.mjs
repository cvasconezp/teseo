// Pruebas del color y la temperatura de las estrellas (src/sky/starColor.js) y del
// esquema 2 de public/sky.json (B−V y tipo espectral).
// Uso:  node scripts/test_sky_starcolor.mjs     (sale con código 1 si algo falla)
import { readFileSync } from "node:fs";
import { bvToTemp, bvInRange, tempToXy, tempToHex, tempToLinearRgb, starHex, starTemperature, roundTemp, tempHue, parseSpect, T_SUN, NO_BV_HEX, BV_MIN, BV_MAX, LOWER_BOUND_K } from "../src/sky/starColor.js";
import { describeObject as describeRaw } from "../src/sky/describe.js";
import { TX } from "../src/sky/i18n.js";
// la ficha usa además textos del diccionario de Constellations.jsx (JSX, no importable en Node):
// las claves que falten se sustituyen por su propio nombre; aquí solo se prueban las de las estrellas.
const withFallback = (t) => new Proxy(t, { get: (o, k) => (k in o ? o[k] : Object.assign(() => String(k), { toString: () => String(k) })) });
const describeObject = (o, lang, t, m) => describeRaw(o, lang, withFallback(t), m);

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const sky = JSON.parse(readFileSync(new URL("../public/sky.json", import.meta.url), "utf8"));
const star = (name) => sky.stars.find((s) => s[7] === name);
const pct = (a, b) => (100 * (a - b)) / b;

console.log("B−V → temperatura (Ballesteros 2012, EPL 97, 34008, ec. 14)");
{
  // temperaturas efectivas publicadas (K) y la tolerancia HONESTA que alcanza la fórmula con cada una.
  // Sol: valor nominal UAI 2015. Vega: 9.602 (Kinman & Castelli 2002). Sirio A: 9.940 (Liebert et al. 2005).
  // Arturo: 4.286 (Ramírez & Allende Prieto 2011). Proción: 6.530. Polar: 6.015. Aldebarán: 3.910.
  // Altair: ~7.550 de media (rota tan deprisa que va de 6.900 a 8.450 K del ecuador al polo).
  // Betelgeuse: ~3.600 (Levesque & Massey 2020; varía). Antares: ~3.660. Rigel: 12.100 (Przybilla et al. 2006).
  const cases = [
    // [nombre, B−V, T publicada, tolerancia %]
    ["Sol (B−V 0,65)", 0.65, 5772, 1],
    ["Sol (B−V 0,656, HYG)", 0.656, 5772, 1],
    ["Sirio (0,009)", 0.009, 9940, 2],
    ["Vega (0,00)", 0.0, 9602, 6],
    ["Arturo (1,239)", 1.239, 4286, 3],
    ["Proción (0,432)", 0.432, 6530, 4],
    ["Polar (0,636)", 0.636, 6015, 4],
    ["Aldebarán (1,538)", 1.538, 3910, 6],
    ["Altair (0,221)", 0.221, 7550, 8],
    ["Betelgeuse (1,85, valor habitual)", 1.85, 3600, 9],
    ["Betelgeuse (1,50, HYG/Hipparcos)", 1.5, 3600, 7],
    ["Antares (1,865)", 1.865, 3660, 11],
  ];
  for (const [name, bv, pub, tol] of cases) {
    const T = bvToTemp(bv), e = pct(T, pub);
    ok(Math.abs(e) <= tol, `${name}: ${Math.round(T)} K frente a ${pub} K publicados (${e >= 0 ? "+" : ""}${e.toFixed(1)} %, tolerancia ±${tol} %)`);
  }
  ok(roundTemp(bvToTemp(0.65)) === 5800 && roundTemp(bvToTemp(0)) === 10100 && roundTemp(bvToTemp(1.85)) === 3300, "redondeo a centenas: Sol 5.800, Vega 10.100, Betelgeuse 3.300");
  // donde la fórmula NO alcanza: se comprueba que se queda corta y que la ficha lo avisa
  const rigel = bvToTemp(-0.03), spica = bvToTemp(-0.235);
  ok(pct(rigel, 12100) < -10 && pct(rigel, 12100) > -16, `Rigel (−0,03): ${Math.round(rigel)} K frente a 12.100 → se queda corta un ${(-pct(rigel, 12100)).toFixed(0)} %`);
  ok(pct(spica, 25300) < -35, `Espiga (−0,235): ${Math.round(spica)} K frente a ~25.300 → se queda corta un ${(-pct(spica, 25300)).toFixed(0)} %: por eso es «al menos»`);
  ok(starTemperature(-0.03).lowerBound && starTemperature(-0.235).lowerBound && !starTemperature(0.009).lowerBound && !starTemperature(0.65).lowerBound, `por encima de ${LOWER_BOUND_K} K la ficha dice «al menos»; Sirio y el Sol no llevan esa marca`);
  let mono = true; for (let b = -0.4; b < 2.0; b += 0.01) if (!(bvToTemp(b) > bvToTemp(b + 0.01))) mono = false;
  ok(mono, "la temperatura baja siempre al crecer B−V (−0,4 … 2,0)");
  ok(bvToTemp(null) === null && bvToTemp(undefined) === null && bvToTemp("") === null && bvToTemp(NaN) === null && bvToTemp(-0.7) === null, "sin B−V (o en el polo de la fórmula) no hay temperatura");
  ok(bvInRange(BV_MIN) && bvInRange(BV_MAX) && !bvInRange(2.01) && !bvInRange(-0.41) && !bvInRange(null), "intervalo en que se muestra temperatura");
  const out = starTemperature(3.27), none = starTemperature(null), sun = starTemperature(0.65), bet = starTemperature(1.85);
  ok(out && out.temp === null && out.outOfRange && none === null, "B−V fuera de intervalo: sin kelvin; sin B−V: nada");
  ok(sun.temp === 5800 && sun.vsSun === "similar" && sun.hue === "yellow" && bet.temp === 3300 && bet.vsSun === "cooler" && bet.hue === "red" && starTemperature(0).vsSun === "hotter" && starTemperature(0).hue === "blue", "comparación con el Sol y tono");
  ok(Math.abs(sun.ratio - bvToTemp(0.65) / T_SUN) < 1e-12 && T_SUN === 5772, "cociente con la temperatura nominal del Sol (5.772 K)");
}

console.log("Temperatura → color (lugar de Planck de Kim et al. + sRGB)");
{
  // cromaticidades de referencia del cuerpo negro (CIE 1931, tablas de Wyszecki & Stiles)
  for (const [T, x, y] of [[2856, 0.4476, 0.4074], [5000, 0.3451, 0.3516], [6504, 0.3135, 0.3237], [10000, 0.2807, 0.2884]]) {
    const [a, b] = tempToXy(T);
    ok(Math.abs(a - x) < 0.001 && Math.abs(b - y) < 0.001, `${T} K → (x, y) = (${a.toFixed(4)}, ${b.toFixed(4)}), referencia (${x}, ${y})`);
  }
  let cont = 0; for (const T of [2222, 4000]) { const lo = tempToXy(T - 0.01), hi = tempToXy(T + 0.01); cont = Math.max(cont, Math.abs(lo[0] - hi[0]), Math.abs(lo[1] - hi[1])); }
  ok(cont < 0.0015, "los tramos de la aproximación empalman sin salto visible", `${cont}`);
  ok(tempToXy(100)[0] === tempToXy(1667)[0] && tempToXy(1e6)[0] === tempToXy(25000)[0], "fuera de 1.667–25.000 K se acota, no se extrapola");
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const w = rgb(tempToHex(6504)), cold = rgb(tempToHex(3300)), hot = rgb(tempToHex(15000));
  ok(Math.min(...w) >= 245, `6.504 K (≈ D65) sale blanco: ${tempToHex(6504)}`);
  ok(cold[0] === 255 && cold[0] > cold[1] && cold[1] > cold[2] && hot[2] === 255 && hot[2] > hot[1] && hot[1] > hot[0], `3.300 K rojizo (${tempToHex(3300)}), 15.000 K azulado (${tempToHex(15000)})`);
  ok(tempToLinearRgb(4000).every((v) => v >= 0 && v <= 1) && Math.max(...tempToLinearRgb(4000)) === 1, "RGB lineal normalizado al canal mayor");
  const soft = rgb(starHex(1.85)), vivid = rgb(starHex(1.85, true));
  ok(soft[2] > vivid[2] && soft[0] === 255 && starHex(1.85, true) === tempToHex(bvToTemp(1.85)), `realista más suave que resaltado: Betelgeuse ${starHex(1.85)} frente a ${starHex(1.85, true)}`);
  const sat = (h) => { const [r, g, b] = rgb(h); return (Math.max(r, g, b) - Math.min(r, g, b)) / 255; };
  let maxSoft = 0, maxVivid = 0; for (const s of sky.stars) if (s[8] != null) { maxSoft = Math.max(maxSoft, sat(starHex(s[8]))); maxVivid = Math.max(maxVivid, sat(starHex(s[8], true))); }
  ok(maxSoft < 0.3 && maxVivid > 0.6, `el modo realista nunca es chillón: saturación máxima ${maxSoft.toFixed(2)} (resaltado: ${maxVivid.toFixed(2)})`);
  ok(starHex(null) === NO_BV_HEX && starHex(undefined, true, "#abcdef") === "#abcdef" && starHex("", false, "#123456") === "#123456", "sin B−V se conserva el color del catálogo");
  ok(tempHue(3300) === "red" && tempHue(4300) === "orange" && tempHue(5772) === "yellow" && tempHue(7500) === "white" && tempHue(12000) === "blue" && tempHue(0) === null, "nombre del tono por temperatura");
}

console.log("Tipo espectral");
{
  const p = (s) => parseSpect(s);
  ok(p("M2Ib").letter === "M" && p("M2Ib").sub === 2 && p("M2Ib").lum === "Ib", "M2Ib (Betelgeuse): M, 2, supergigante Ib");
  ok(p("A0Vvar").letter === "A" && p("A0Vvar").lum === "V" && p("G2V").lum === "V" && p("B8Ia").lum === "Ia" && p("B2III").lum === "III" && p("K2IIIp").lum === "III", "A0Vvar, G2V, B8Ia, B2III, K2IIIp");
  ok(p("F5IV-V").lum === "IV" && p("F5IV-V").lum2 === "V" && p("K0III-IV").lum === "III" && p("K0III-IV").lum2 === "IV" && p("F7:Ib-IIv SB").lum === "Ib" && p("F7:Ib-IIv SB").lum2 === "II", "intervalos de luminosidad (IV-V, III-IV, Ib-II)");
  ok(p("M1Ib + B2.5V").lum === "Ib" && p("M1Ib + B2.5V").composite && p("M1: comp").composite && p("M1: comp").lum === null, "compuestos: solo se lee la primera estrella");
  ok(p("A0m...").lum === null && p("O7").lum === null && p("M5e-M9e").lum === null && p("B2.5V").sub === 2.5, "sin clase de luminosidad no se inventa una");
  ok(p("DA2").letter === "D" && p("WC8").letter === "W" && p("N3").letter === "C" && p("sdB5").lum === "VI" && p("") === null && p("???") === null, "enanas blancas, Wolf-Rayet, carbono, subenanas y textos ilegibles");
  const bad = sky.stars.filter((s) => s[9] && !parseSpect(s[9]));
  ok(bad.length <= 5, `casi todo tipo espectral del catálogo se puede leer (${bad.length} ilegibles de ${sky.stars.length})`, bad.slice(0, 5).map((s) => s[9]).join(" | "));
  const noText = sky.stars.map((s) => parseSpect(s[9])).filter((x) => x && (!TX.es.spectLetter[x.letter] || (x.lum && !TX.es.spectLum[x.lum]) || !TX.en.spectLetter[x.letter] || (x.lum && !TX.en.spectLum[x.lum])));
  ok(noText.length === 0, "toda clase y luminosidad que aparece en el catálogo tiene explicación en ES y EN", noText.slice(0, 3).map((x) => x.raw).join(" | "));
}

console.log("sky.json (esquema 2)");
{
  ok(sky.meta.schema === 2 && Array.isArray(sky.meta.star_fields) && sky.meta.star_fields.join() === "hip,x,y,z,mag,color,dist_ly,name,bv,spect" && /Ballesteros/.test(sky.meta.star_fields_note) && sky.meta.generator === "scripts/build_sky.py", "meta documenta el esquema, la fórmula y el generador");
  ok(sky.stars.length === 5044 && sky.constellations.length === 88, `5.044 estrellas y 88 constelaciones (${sky.stars.length}, ${sky.constellations.length})`);
  const shape = sky.stars.every((s) => s.length === 10 && Number.isInteger(s[0]) && [1, 2, 3, 4, 6].every((i) => typeof s[i] === "number") && /^#[0-9a-f]{6}$/.test(s[5]) && typeof s[7] === "string" && (s[8] === null || typeof s[8] === "number") && typeof s[9] === "string");
  ok(shape, "cada estrella: [hip, x, y, z, mag, color, dist_ly, nombre, B−V|null, espectro]");
  ok(sky.stars.every((s) => Math.abs(Math.hypot(s[1], s[2], s[3]) - 1) < 2e-5), "las direcciones siguen siendo vectores unitarios");
  ok(new Set(sky.stars.map((s) => s[0])).size === sky.stars.length, "sin HIP repetidos");
  const hips = new Set(sky.stars.map((s) => s[0]));
  ok(sky.constellations.every((c) => c.lines.every((l) => l.every((h) => hips.has(h)))), "toda estrella usada por una línea de constelación existe");
  const noBv = sky.stars.filter((s) => s[8] === null);
  ok(noBv.length === 2 && noBv.every((s) => s[5] === NO_BV_HEX), `solo ${noBv.length} estrellas sin B−V, y conservan el color neutro del catálogo`);
  const mism = sky.stars.filter((s) => s[5] !== starHex(s[8], true, NO_BV_HEX));
  ok(mism.length === 0, "el color guardado coincide, estrella a estrella, con starHex(B−V) de JavaScript (Python y JS dan lo mismo)", `${mism.length} distintas, p. ej. ${JSON.stringify(mism[0])}`);
  const bvs = sky.stars.filter((s) => s[8] != null).map((s) => s[8]);
  ok(Math.min(...bvs) > -0.4 && Math.max(...bvs) < 3.5, `B−V entre ${Math.min(...bvs)} y ${Math.max(...bvs)}`);
  const outR = sky.stars.filter((s) => s[8] != null && !bvInRange(s[8]));
  ok(outR.length < 30, `${outR.length} estrellas con B−V fuera de −0,4…2,0: se pintan, pero sin kelvin`);
  // datos de siempre, intactos (los deep-links y el frontend dependen de ellos)
  const sirius = star("Sirius"), betel = star("Betelgeuse"), vega = star("Vega"), rigel = star("Rigel");
  ok(sirius[0] === 32349 && sirius[4] === -1.44 && sirius[6] === 8.6 && betel[0] === 27989 && vega[0] === 91262 && rigel[0] === 24436, "Sirio, Betelgeuse, Vega y Rigel: mismo HIP, magnitud y distancia que antes");
  ok(sirius[8] === 0.009 && betel[8] === 1.5 && betel[9] === "M2Ib" && vega[9] === "A0Vvar" && rigel[9] === "B8Ia" && rigel[8] === -0.03, "B−V y tipo espectral de HYG para las estrellas conocidas");
  console.log(`        Betelgeuse en HYG: B−V = ${betel[8]} (Hipparcos; el valor habitual es ~1,85) → ${roundTemp(bvToTemp(betel[8]))} K`);
}

console.log("Ficha de estrella");
{
  for (const lang of ["es", "en"]) {
    const t = TX[lang], b = star("Betelgeuse"), v = star("Vega"), r = star("Rigel");
    const mk = (s) => describeObject({ layer: "star", name: s[7], nx: s[1], ny: s[2], nz: s[3], mag: s[4], dist_ly: s[6], hex: starHex(s[8]), bv: s[8], spect: s[9] }, lang, t, false);
    const B = mk(b), V = mk(v), R = mk(r);
    const tb = B.explain.find((e) => e.title === t.tempTitle), sb = B.explain.find((e) => e.title === t.spectTitle);
    ok(tb && /3[.,]800 K/.test(tb.text) && tb.text.includes(t.tempVs.cooler) && tb.text.includes(t.starHueF.red) && tb.hint === t.tempHint, `[${lang}] Betelgeuse: «${tb && tb.text}»`);
    ok(sb && sb.text.startsWith("M2Ib") && sb.text.includes(t.spectLum.Ib) && sb.hint === t.spectSeq, `[${lang}] Betelgeuse: «${sb && sb.text}»`);
    ok(/estimad|estimated/.test(t.tempTitle) && B.details.some((d) => d[0] === t.dTemp && /≈/.test(d[1])) && B.details.some((d) => d[0] === t.dBv) && B.details.some((d) => d[0] === t.dSpect && d[1] === "M2Ib") && B.details.some((d) => /Ballesteros/.test(d[1])), `[${lang}] marca de estimación, B−V, tipo y fuente en los detalles`);
    ok(V.explain.find((e) => e.title === t.tempTitle).text.includes(t.tempVs.hotter), `[${lang}] Vega: más caliente que el Sol`);
    const tr = R.explain.find((e) => e.title === t.tempTitle);
    ok(/10[.,]500/.test(tr.text) && tr.text === t.tempLower(10500, t.starHueF.blue) && R.details.some((d) => d[0] === t.dTemp && /≥/.test(d[1])), `[${lang}] Rigel: «al menos», no un valor cerrado`);
    const N = describeObject({ layer: "star", name: "x", nx: 1, ny: 0, nz: 0, mag: 5, dist_ly: 100, hex: NO_BV_HEX, bv: null, spect: "O7" }, lang, t, false);
    ok(!N.explain.some((e) => e.title === t.tempTitle) && N.explain.some((e) => e.text === t.tempNone) && !N.details.some((d) => d[0] === t.dTemp), `[${lang}] sin B−V: no hay temperatura y se dice por qué`);
    const O = describeObject({ layer: "star", name: "x", nx: 1, ny: 0, nz: 0, mag: 5, dist_ly: 100, hex: "#ffc89b", bv: undefined, spect: "" }, lang, t, false);
    ok(!O.explain.some((e) => e.title === t.tempTitle || e.text === t.tempNone) && O.explain.some((e) => /cat[aá]log/.test(e.text)), `[${lang}] sky.json antiguo en caché (sin esos campos): la ficha queda como antes`);
    const X = describeObject({ layer: "star", name: "x", nx: 1, ny: 0, nz: 0, mag: 5, dist_ly: 100, hex: "#ff9834", bv: 3.27, spect: "C5II" }, lang, t, false);
    ok(X.explain.find((e) => e.title === t.tempTitle).text === t.tempOut(3.27) && !X.details.some((d) => d[0] === t.dTemp), `[${lang}] B−V = 3,27: se explica que queda fuera del intervalo`);
  }
}

console.log(`\n${passed} pruebas correctas, ${failed} con fallo`);
process.exit(failed ? 1 : 0);
