// Pruebas de las funciones puras de la pestaña "Preguntas" (src/questions/).
// Uso:  node scripts/test_questions.mjs     (sale con código 1 si algo falla)
import {
  drakeN, roundSig, sliderSteps, valueToPos, posToValue, neighborDistanceLy, roundTripYears, groupSpan,
  kardashev, kardashevPower, ejPerYearToWatts, interceptedSunlightW, radioBubbleRadiusLy,
  encodeDrake, decodeDrake, sameValues, GALAXY, FACTOR_ORDER,
} from "../src/questions/drakeMath.js";
import {
  FACTORS, PRESETS, CUSTOM_START, DRAKE_1961_RANGE, MEASURED_KEYS, UNKNOWN_KEYS, REFS,
  WORLD_ENERGY, SOLAR, KARDASHEV_MARKS, RADIO, FILTER_STEPS, NEXT_LINKS, KARDASHEV_SLIDER,
} from "../src/questions/drakeData.js";
import { num, sig, sci, big, years, lightYears, factorValue, factorShort, headline } from "../src/questions/format.js";
import { TQ } from "../src/questions/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const eq = (a, b, name) => ok(a === b, name, `→ obtuvo ${JSON.stringify(a)}, esperaba ${JSON.stringify(b)}`);

console.log("Ecuación de Drake");
ok(near(drakeN(DRAKE_1961_RANGE.min), 20), "Drake 1961, extremos bajos → N = 20 (documentado)", String(drakeN(DRAKE_1961_RANGE.min)));
ok(near(drakeN(DRAKE_1961_RANGE.max), 5e7), "Drake 1961, extremos altos → N = 50.000.000 (documentado)", String(drakeN(DRAKE_1961_RANGE.max)));
const p61 = PRESETS.find(p => p.id === "drake1961").values;
ok(near(drakeN(p61), 2000), "preajuste Drake 1961 → N = 2.000", String(drakeN(p61)));
ok(FACTOR_ORDER.every(k => p61[k] >= DRAKE_1961_RANGE.min[k] && p61[k] <= DRAKE_1961_RANGE.max[k]), "el preajuste Drake 1961 cae dentro de los rangos de 1961");
ok(near(drakeN({ ...p61, L: 1 }) * 12345, drakeN({ ...p61, L: 12345 })), "N es proporcional a L");
const opt = PRESETS.find(p => p.id === "optimistic").values, pes = PRESETS.find(p => p.id === "pessimistic").values;
ok(near(drakeN(opt), 200000), "preajuste optimista → N = 200.000", String(drakeN(opt)));
ok(near(drakeN(pes), 8e-8), "preajuste pesimista → N = 8e-8 (< 1)", String(drakeN(pes)));
ok(MEASURED_KEYS.every(k => opt[k] === pes[k] && opt[k] === FACTORS.find(f => f.key === k).modern), "optimista y pesimista comparten los factores medidos (valores de hoy)");
ok(near(drakeN(CUSTOM_START), 1600), "«Mi apuesta» inicial → N = 1.600");
ok(Number.isNaN(drakeN({ ...p61, fl: -1 })) && Number.isNaN(drakeN({ ...p61, fl: "x" })), "valores inválidos → NaN, no un número inventado");
eq(drakeN({ ...p61, fl: 0 }), 0, "un factor en cero → N = 0");

console.log("Datos y referencias");
eq(FACTORS.map(f => f.key).join(), FACTOR_ORDER.join(), "siete factores en el orden de la ecuación");
eq(FACTORS.map(f => f.certainty).join(), "measured,measured,estimated,unknown,unknown,unknown,unknown", "certeza: R* y fp medidos, ne estimado, el resto hipótesis");
ok(FACTORS.every(f => f.refs.length > 0 && f.refs.every(r => REFS[r] && /^https:\/\//.test(REFS[r].url))), "cada factor tiene al menos una fuente con URL https");
ok(FACTORS.every(f => f.name.es && f.name.en && f.why.es && f.why.en && f.what.es && f.what.en), "cada factor tiene textos ES y EN");
ok(Object.values(REFS).every(r => r.cite && /^https:\/\//.test(r.url)), "todas las referencias tienen cita y URL");
ok([...PRESETS.map(p => p.values), CUSTOM_START, DRAKE_1961_RANGE.min].every(v => FACTORS.every(f => v[f.key] >= f.min && v[f.key] <= f.max)), "los preajustes caben en los deslizadores");
ok(DRAKE_1961_RANGE.max.L <= FACTORS.find(f => f.key === "L").max && DRAKE_1961_RANGE.max.ne <= FACTORS.find(f => f.key === "ne").max, "los extremos de 1961 caben en los deslizadores");
ok(FACTORS.filter(f => f.kind === "fraction").every(f => f.max <= 1), "ninguna fracción puede pasar de 1");
eq(FILTER_STEPS.length, 9, "Gran Filtro: los nueve pasos de Hanson");
ok(NEXT_LINKS.length >= 2 && NEXT_LINKS.every(l => /^https:\/\//.test(l.url)), "«Para seguir»: enlaces https");
const keysOf = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => v && typeof v === "object" && !Array.isArray(v) ? keysOf(v, `${pre}${k}.`) : [`${pre}${k}`]);
eq(keysOf(TQ.es).sort().join(), keysOf(TQ.en).sort().join(), "i18n: ES y EN tienen las mismas claves");

console.log("Deslizadores logarítmicos");
eq(roundSig(0.30000000000000004), 0.3, "roundSig limpia colas binarias");
eq(roundSig(1234), 1200, "roundSig a 2 cifras");
for (const f of FACTORS) {
  const n = sliderSteps(f.min, f.max);
  let stable = true, mono = true, prev = -Infinity;
  for (let i = 0; i <= n; i++) {
    const v = posToValue(i, f.min, f.max);
    if (valueToPos(v, f.min, f.max) !== i) stable = false;
    if (!(v > prev)) mono = false;
    if (v < f.min || v > f.max) mono = false;
    prev = v;
  }
  ok(stable && mono, `${f.key}: ${n} pasos, posición ↔ valor estable y creciente`);
  eq(posToValue(0, f.min, f.max), f.min, `${f.key}: extremo inferior exacto`);
  eq(posToValue(n, f.min, f.max), f.max, `${f.key}: extremo superior exacto`);
}
ok(PRESETS.every(p => FACTORS.every(f => near(posToValue(valueToPos(p.values[f.key], f.min, f.max), f.min, f.max), p.values[f.key], 0.03))), "los valores de los preajustes coinciden con un paso del deslizador (±3 %)");

console.log("Distancia entre civilizaciones");
const R = GALAXY.diameterLy / 2, V = Math.PI * R * R * GALAXY.thicknessLy;
eq(neighborDistanceLy(0.5), null, "N < 1 → sin vecina (null)");
eq(neighborDistanceLy(1), null, "N = 1 → sin vecina (null)");
eq(neighborDistanceLy(1.99), null, "N < 2 → sin vecina (null)");
eq(neighborDistanceLy(NaN), null, "N inválido → null");
ok(near(neighborDistanceLy(1e6), Math.cbrt(V / 1e6)), "N = 1 millón → fórmula de volumen (≈199 años luz)", String(neighborDistanceLy(1e6)));
ok(Math.abs(neighborDistanceLy(1e6) - 198.8) < 0.1, "N = 1 millón → 198,8 años luz");
ok(near(neighborDistanceLy(2000), Math.sqrt(Math.PI * R * R / 2000)), "N = 2.000 → fórmula de lámina (d > grosor)");
ok(Math.abs(neighborDistanceLy(2000) - 1981.7) < 0.1, "N = 2.000 (Drake 1961) → 1.981,7 años luz", String(neighborDistanceLy(2000)));
const Nc = Math.PI * R * R / (GALAXY.thicknessLy ** 2);
ok(near(neighborDistanceLy(Nc * 1.0000001), 1000, 1e-6) && near(neighborDistanceLy(Nc * 0.9999999), 1000, 1e-6), "las dos ramas empalman en d = grosor (N ≈ 7.854)");
ok(neighborDistanceLy(2) <= GALAXY.diameterLy, "nunca mayor que el diámetro de la galaxia");
{ let dec = true, prev = Infinity; for (let e = 0.4; e < 11; e += 0.1) { const d = neighborDistanceLy(10 ** e); if (!(d < prev)) dec = false; prev = d; } ok(dec, "más civilizaciones → vecinas más cerca (monótona)"); }
eq(roundTripYears(1981.7), 3963.4, "señal de ida y vuelta = 2·d años");
eq(roundTripYears(null), null, "sin vecina → sin tiempo de señal");

console.log("Variación por grupos");
const gm = groupSpan(FACTORS, p61, MEASURED_KEYS), gu = groupSpan(FACTORS, p61, UNKNOWN_KEYS);
ok(near(gm.orders, Math.log10(10 / 0.5) + 1 + Math.log10(5 / 0.01)), "órdenes de magnitud del grupo medido/estimado = suma de sus deslizadores", String(gm.orders));
ok(near(gu.orders, 9 + 9 + 3 + 8), "órdenes de magnitud del grupo hipotético = 29", String(gu.orders));
ok(gu.orders > 5 * gm.orders, "lo hipotético domina la variación (>5× en órdenes de magnitud)");
ok(gm.nMin <= 2000 && gm.nMax >= 2000 && gu.nMin <= 2000 && gu.nMax >= 2000, "el N actual cae dentro de ambos intervalos");
ok(near(gm.nMax / gm.nMin, 10 ** gm.orders, 1e-6), "intervalo de N coherente con los órdenes de magnitud");

console.log("Kardashov");
const Pw = ejPerYearToWatts(WORLD_ENERGY.ej);
ok(Math.abs(Pw - 1.876e13) < 0.002e13, `consumo mundial ${WORLD_ENERGY.year}: ${WORLD_ENERGY.ej} EJ/año ≈ 1,876e13 W`, String(Pw));
ok(Math.abs(kardashev(Pw) - 0.727) < 0.001, "K de la humanidad ≈ 0,727 (≈ 0,73)", String(kardashev(Pw)));
eq(kardashev(Pw).toFixed(2), "0.73", "K de la humanidad se muestra como 0,73");
ok(near(kardashev(1e16), 1) && near(kardashev(1e26), 2) && near(kardashev(1e36), 3), "Tipo I, II y III = 1e16, 1e26 y 1e36 W");
ok(near(kardashevPower(kardashev(3.3e21)), 3.3e21, 1e-9), "kardashevPower es la inversa");
const sun = interceptedSunlightW(SOLAR.irradianceWm2, SOLAR.earthRadiusM);
ok(Math.abs(sun - 1.739e17) < 0.002e17, "luz solar que intercepta la Tierra ≈ 1,74e17 W", String(sun));
ok(near(KARDASHEV_MARKS.find(m => m.id === "sunlight").watts, sun), "el hito «luz solar en la Tierra» usa ese cálculo");
ok(Math.abs(kardashev(SOLAR.luminosityW) - 2.058) < 0.001, "toda la luz del Sol → K ≈ 2,06");
ok(KARDASHEV_MARKS.every(m => Math.log10(m.watts) > KARDASHEV_SLIDER.minLog && Math.log10(m.watts) < KARDASHEV_SLIDER.maxLog) && Math.log10(Pw) > KARDASHEV_SLIDER.minLog, "todos los hitos caben en el deslizador");

console.log("Burbuja de radio");
eq(radioBubbleRadiusLy(2026, RADIO.sinceYear), 90, "2026 − 1936 = 90 años luz de radio");
eq(radioBubbleRadiusLy(1900, 1936), 0, "nunca negativa");
ok(2 * 90 / GALAXY.diameterLy === 0.0018, "diámetro de la burbuja = 0,18 % del de la galaxia");

console.log("Enlace compartible");
for (const p of [...PRESETS.map(x => x.values), CUSTOM_START]) ok(sameValues(decodeDrake(encodeDrake(p), FACTORS), p), `ida y vuelta: ${encodeDrake(p)}`);
eq(encodeDrake(p61), "1,0.5,2,1,1,0.2,10000", "formato del enlace para Drake 1961");
eq(decodeDrake("1,2,3", FACTORS), null, "faltan factores → null");
eq(decodeDrake("1,0.5,2,1,1,x,10000", FACTORS), null, "texto → null");
eq(decodeDrake("1,0.5,2,1,1,,10000", FACTORS), null, "hueco → null");
eq(decodeDrake("1,0.5,2,1,-1,0.2,10000", FACTORS), null, "negativo → null");
eq(decodeDrake(null, FACTORS), null, "sin parámetro → null");
const clamped = decodeDrake("999,7,2,1,1,0.2,1e30", FACTORS);
ok(clamped.rstar === 10 && clamped.fp === 1 && clamped.L === 1e9, "valores fuera de rango se recortan al deslizador (una fracción nunca pasa de 1)");

console.log("Formato por idioma");
eq(num(10000, "es"), "10.000", "es: 10.000");
eq(num(2000, "es"), "2.000", "es: 2.000 (agrupa 4 cifras)");
eq(num(10000, "en"), "10,000", "en: 10,000");
eq(sig(0.4, "es"), "0,4", "es: 0,4");
eq(sig(0.4, "en"), "0.4", "en: 0.4");
eq(sci(1.876e13, "es"), "1,9 × 10¹³", "científica es");
eq(sci(1e-6, "en"), "10⁻⁶", "científica: potencia exacta");
eq(sci(9.99e5, "en"), "10⁶", "científica: redondeo que cambia de orden");
eq(big(3.2e6, "es"), "3,2 millones", "es: millones");
eq(big(1e6, "es"), "1 millón", "es: 1 millón");
eq(big(2e9, "es"), "2.000 millones", "es: 2.000 millones");
eq(big(2e9, "en"), "2 billion", "en: 2 billion");
eq(big(3.2e6, "en"), "3.2 million", "en: million");
eq(years(1e6, "es"), "1 millón de años", "es: 1 millón de años");
eq(years(10000, "es"), "10.000 años", "es: 10.000 años");
eq(years(3963.4, "en"), "4,000 years", "en: years");
eq(lightYears(1981.7, "es"), "2.000 años luz", "es: años luz");
const F = Object.fromEntries(FACTORS.map(f => [f.key, f]));
eq(factorValue(F.rstar, 2, "es"), "2 por año", "R* es");
eq(factorValue(F.fp, 1, "es"), "todas (100 %)", "fp = 1 es");
eq(factorValue(F.fp, 0.5, "en"), "50%", "fp = 0.5 en");
eq(factorValue(F.fi, 1e-6, "es"), "1 de cada millón", "fi = 1e-6 es");
eq(factorValue(F.fi, 1e-6, "en"), "1 in 1 million", "fi = 1e-6 en");
eq(factorValue(F.fl, 1e-3, "es"), "1 de cada 1.000", "fl = 1e-3 es");
eq(factorValue(F.L, 10000, "en"), "10,000 years", "L en");
eq(factorShort(1e-6, "es"), "10⁻⁶", "valor corto pequeño");
eq(factorShort(10000, "es"), "10.000", "valor corto grande");

console.log("Titular del resultado");
eq(headline(2000, "es").big, "Unas 2.000", "es: Unas 2.000");
eq(headline(12.3, "es").big, "Unas 12", "es: Unas 12");
eq(headline(12.3, "en").big, "About 12", "en: About 12");
eq(headline(3.2e6, "es").big, "Unos 3,2 millones", "es: Unos 3,2 millones");
ok(headline(3.2e6, "es").partitive === true, "es: «de civilizaciones» tras millones");
eq(headline(200000, "en").big, "About 200,000", "en: About 200,000");
eq(headline(0.999, "es").kind, "none", "N = 0,999 → menos de una");
eq(headline(8e-8, "es").big, "Menos de una", "N = 8e-8 → «Menos de una»");
eq(headline(8e-8, "en").big, "Fewer than one", "N = 8e-8 → «Fewer than one»");
eq(headline(0, "es").kind, "none", "N = 0 → menos de una");
eq(headline(NaN, "es").kind, "none", "N inválido → nunca un número inventado");
eq(headline(1, "es").kind, "one", "N = 1 → más o menos una");
eq(headline(1.49, "en").big, "About one", "N = 1,49 → About one");
eq(headline(1.5, "es").big, "Unas 2", "N = 1,5 → Unas 2");

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
