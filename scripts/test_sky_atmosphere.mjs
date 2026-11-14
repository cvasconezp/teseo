// Pruebas de src/sky/atmosphere.js y src/sky/lightPollution.js: masa de aire, fases del crepúsculo,
// extinción, brillo del cielo, magnitud límite (Bortle), Luna, día y monotonía.
// Uso:  node scripts/test_sky_atmosphere.mjs     (sale con código 1 si algo falla)
//
// Referencias independientes del código que se prueba:
//   · Kasten & Young (1989), Applied Optics 28, 4735, tabla: X(90°) = 1, X(30°) = 1,995, X(0°) = 38,09
//   · fases: USNO (−6 / −12 / −18°)
//   · Bortle (2001), S&T: magnitud límite por clase (clase 1: 7,6–8,0 · clase 9: 4,0 o menos)
//   · Hänel et al. (2018), JQSRT 205, 278, tabla 2: fin del crepúsculo náutico 19,4 y civil 12,9
//     mag/arcsec² en el cenit; intervalos natural/rural/suburbano/urbano
//   · catálogo real (public/sky.json, HYG v4.1) y efemérides de la app para Quito
import { readFileSync } from "node:fs";
import {
  airmass, twilightPhase, extinction, skyState, visibility, thresholdMag, magToNl, nlToMag,
  skyBrightnessAt, bortleSky, countBrighter, countVisibleNow, starsHidden, altAzToDir, dirToAltAz,
  backgroundForThreshold, moonMagV, phaseAngleFromIllum, observerThreshold, adaptWeight,
} from "../src/sky/atmosphere.js";
import { BORTLE, BORTLE_TEXT, ENV_SKY, bortleForNelm, nelmText, MEASURED } from "../src/sky/lightPollution.js";
import { ATM } from "../src/sky/i18n-atm.js";
import { ephemeris } from "../src/ephemeris.js";
import { altAz } from "../src/sky/guide.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, eps) => Math.abs(a - b) <= eps;
const f2 = (v) => Number(v).toFixed(2);
const sky = JSON.parse(readFileSync(new URL("../public/sky.json", import.meta.url), "utf8"));
const QUITO = { lat: -0.2202, lon: -78.5123, elevation_m: 2850 };
const SEA = { elevation_m: 0, rh: 40, tempC: 15, latDeg: 0, month: 3 };   // marzo: término estacional de aerosoles nulo
const NIGHT_SUN = { alt: -40, az: 0 };

console.log("Masa de aire (Kasten & Young 1989)");
ok(near(airmass(90), 1, 0.001), "X(90°) = 1", f2(airmass(90)));
ok(near(airmass(30), 1.995, 0.01) && near(airmass(30), 2, 0.02), "X(30°) ≈ 2 (tabla: 1,995)", airmass(30).toFixed(4));
ok(near(airmass(0), 38.09, 0.4), "X(0°) ≈ 38 (tabla: 38,09)", f2(airmass(0)));
ok(airmass(-5) === airmass(0), "bajo el horizonte se usa el valor del horizonte");
let mono = true; for (let h = 1; h <= 90; h++) if (airmass(h) > airmass(h - 1)) mono = false;
ok(mono, "X decrece con la altura");

console.log("Fases del cielo según la altura del Sol");
ok(twilightPhase(10) === "día" && twilightPhase(-0.5) === "día", "día por encima de −0,833°");
ok(twilightPhase(-1) === "civil" && twilightPhase(-5.9) === "civil", "civil hasta −6°");
ok(twilightPhase(-6.1) === "náutico" && twilightPhase(-11.9) === "náutico", "náutico entre −6° y −12°");
ok(twilightPhase(-12.1) === "astronómico" && twilightPhase(-17.9) === "astronómico", "astronómico entre −12° y −18°");
ok(twilightPhase(-18.1) === "noche" && twilightPhase(-60) === "noche", "noche por debajo de −18°");

console.log("Extinción (Schaefer 1998)");
const eSea = extinction(SEA), eQ = extinction({ ...SEA, elevation_m: 2850 });
ok(near(eSea.parts.kR, 0.1066, 1e-4), "Rayleigh en V al nivel del mar = 0,1066 mag/masa de aire", eSea.parts.kR.toFixed(4));
ok(eSea.k >= 0.2 && eSea.k <= 0.35, "k_V al nivel del mar en 0,2–0,35", eSea.k.toFixed(3));
ok(eQ.k < eSea.k && eQ.k > 0.1 && eQ.k < 0.2, "k_V a 2.850 m (Quito) menor: 0,1–0,2", eQ.k.toFixed(3));
ok(eSea.kB > eSea.k, "la extinción en B es mayor que en V (enrojecimiento)", `${eSea.kB.toFixed(3)} > ${eSea.k.toFixed(3)}`);

console.log("Unidades y umbral de visión");
ok(near(nlToMag(magToNl(21.3)), 21.3, 1e-9), "mag/arcsec² ↔ nL ida y vuelta");
// Hänel et al. 2018, ec. 1: L[cd/m²] ≈ 10,8·10⁴·10^(−0,4μ); 1 nL = 3,183·10⁻⁶ cd/m²
ok(near(magToNl(22) * 3.183e-6, 10.8e4 * 10 ** (-0.4 * 22), 0.03 * 10.8e4 * 10 ** (-0.4 * 22)), "conversión coherente con Hänel et al. (2018) ec. 1");
let monoT = true; for (let b = -2; b < 10; b += 0.05) if (thresholdMag(10 ** (b + 0.05)) >= thresholdMag(10 ** b)) monoT = false;
ok(monoT, "el umbral empeora (baja) siempre que el cielo se aclara");
let jump = 0; for (let b = 2.5; b < 4; b += 0.001) jump = Math.max(jump, Math.abs(thresholdMag(10 ** (b + 0.001)) - thresholdMag(10 ** b)));
ok(jump < 0.01, "sin saltos entre bastones y conos", jump.toFixed(4));
ok(near(thresholdMag(backgroundForThreshold(5.2)), 5.2, 1e-6), "inversa del umbral");
ok(near(observerThreshold(backgroundForThreshold(4.4, 1.3), 1.3), 4.4, 1e-6), "inversa del umbral con ventaja del observador");
ok(adaptWeight(100) === 1 && adaptWeight(1e9) === 0 && adaptWeight(1e5) > 0 && adaptWeight(1e5) < 1, "la ventaja del observador se anula con luz de día (CIE: 0,005–5 cd/m²)");

console.log("Escala de Bortle: magnitud límite en el cenit, noche cerrada, sin Luna");
for (let c = 1; c <= 9; c++) {
  const s = skyState(NIGHT_SUN, null, c, SEA), r = BORTLE[c].nelm;
  const inRange = (r[0] == null || s.magLimit >= r[0] - 1e-6) && s.magLimit <= r[1] + 1e-6;
  ok(inRange, `clase ${c}: ${f2(s.magLimit)} dentro de ${nelmText(c, "es")}`);
}
ok(skyState(NIGHT_SUN, null, 1, SEA).magLimit >= 7.6, "Bortle 1 ≥ 7,6");
ok(skyState(NIGHT_SUN, null, 9, SEA).magLimit <= 4.0, "Bortle 9 ≤ 4,0");
ok(near(skyState(NIGHT_SUN, null, 1, { ...QUITO, latDeg: QUITO.lat }).magLimit, 7.8, 0.01), "el anclaje no depende del sitio (Quito, 2.850 m)");
let bMono = true, inEnv = true, envDetail = [];
for (let c = 1; c <= 9; c++) {
  const b = bortleSky(c, eSea.k); envDetail.push(`${c}:${f2(b.b0Mag)}/${f2(b.A)}`);
  if (c > 1 && (b.b0Mag > bortleSky(c - 1, eSea.k).b0Mag || b.A > bortleSky(c - 1, eSea.k).A)) bMono = false;
  const r = ENV_SKY[BORTLE[c].env].range;
  if (b.b0Mag < r[0] - 0.25 || b.b0Mag > r[1] + 0.25) inEnv = false;
}
ok(bMono, "fondo y ventaja del observador decrecen con la clase", envDetail.join(" "));
ok(inEnv, "fondo deducido dentro (±0,25) del intervalo de Hänel et al. para su entorno", envDetail.join(" "));
ok(near(bortleSky(1, eSea.k).b0Mag, 21.9, 1e-6) && near(bortleSky(9, eSea.k).b0Mag, 16.8, 1e-6), "extremos: 21,9 y 16,8 mag/arcsec² (Hänel et al. 2018)");

console.log("Crepúsculo: brillo del cielo en el cenit frente a Hänel et al. (2018), tabla 2");
const zen = (sunAlt) => skyState({ alt: sunAlt, az: 270 }, null, 1, SEA).zenith.mag;
ok(near(zen(-12), 19.4, 1.0), "fin del náutico (−12°): ≈ 19,4 mag/arcsec²", f2(zen(-12)));
ok(near(zen(-6), 12.9, 1.0), "fin del civil (−6°): ≈ 12,9 mag/arcsec²", f2(zen(-6)));
ok(zen(30) < 8.8, "de día el cielo es más brillante que un día nublado (< 8,8)", f2(zen(30)));
let twMono = true; for (let h = -24; h < 2; h += 0.5) if (zen(h + 0.5) > zen(h) + 1e-9) twMono = false;
ok(twMono, "el cielo se aclara de forma continua al subir el Sol (crepúsculo)");
// de día el modelo de Schaefer da un cenit casi constante (la luz dispersada varias veces compensa)
let dMin = Infinity, dMax = -Infinity; for (let h = 3; h <= 60; h += 1) { dMin = Math.min(dMin, zen(h)); dMax = Math.max(dMax, zen(h)); }
ok(dMax - dMin < 1.0, "de día el brillo del cenit apenas cambia con la altura del Sol", `${f2(dMin)}–${f2(dMax)}`);
ok(skyState({ alt: -8, az: 270 }, null, 1, SEA).magLimit < skyState({ alt: -15, az: 270 }, null, 1, SEA).magLimit, "al anochecer aparecen más estrellas");
// el horizonte del lado del Sol es más brillante que el opuesto durante el crepúsculo
{
  const st = skyState({ alt: -4, az: 270 }, null, 3, SEA);
  const west = skyBrightnessAt(altAzToDir(10, 270), st).total, east = skyBrightnessAt(altAzToDir(10, 90), st).total;
  ok(west > east * 2, "crepúsculo: el cielo bajo del lado del Sol es más brillante", `${f2(nlToMag(west))} vs ${f2(nlToMag(east))}`);
}

console.log("Luna");
ok(near(moonMagV(0), -12.73, 1e-9) && near(phaseAngleFromIllum(1), 0, 1e-9) && near(phaseAngleFromIllum(0.5), 90, 1e-9), "magnitud y ángulo de fase");
for (const c of [1, 5, 8]) {
  const dark = skyState(NIGHT_SUN, null, c, SEA).magLimit;
  const full = skyState(NIGHT_SUN, { alt: 60, az: 90, illum: 1 }, c, SEA).magLimit;
  const half = skyState(NIGHT_SUN, { alt: 60, az: 90, illum: 0.5 }, c, SEA).magLimit;
  const set = skyState(NIGHT_SUN, { alt: -10, az: 90, illum: 1 }, c, SEA).magLimit;
  const nw = skyState(NIGHT_SUN, { alt: 60, az: 90, illum: 0 }, c, SEA).magLimit;
  ok(full < half && half < dark, `clase ${c}: la Luna llena alta resta más que el cuarto (${f2(dark)} → ${f2(half)} → ${f2(full)})`);
  ok(near(set, dark, 1e-9) && near(nw, dark, 1e-9), `clase ${c}: Luna bajo el horizonte o nueva no cambia nada`);
}
{
  const d1 = skyState(NIGHT_SUN, null, 1, SEA).magLimit - skyState(NIGHT_SUN, { alt: 60, az: 90, illum: 1 }, 1, SEA).magLimit;
  const d8 = skyState(NIGHT_SUN, null, 8, SEA).magLimit - skyState(NIGHT_SUN, { alt: 60, az: 90, illum: 1 }, 8, SEA).magLimit;
  ok(d1 > 1.5, "en cielo oscuro la Luna llena resta más de 1,5 mag", f2(d1));
  ok(d8 > 0.05 && d8 < d1, "en la ciudad resta menos (el cielo ya es brillante)", f2(d8));
  const st = skyState(NIGHT_SUN, { alt: 40, az: 90, illum: 1 }, 3, SEA);
  const nearMoon = visibility({ mag: 4, alt: 40, az: 100 }, st), farMoon = visibility({ mag: 4, alt: 40, az: 270 }, st);
  ok(nearMoon.margin < farMoon.margin, "cerca de la Luna se ven menos estrellas", `${f2(nearMoon.margin)} < ${f2(farMoon.margin)}`);
}

console.log("Extinción y horizonte");
{
  const st = skyState(NIGHT_SUN, null, 5, SEA);
  const hi = visibility({ mag: 1, alt: 60, az: 0 }, st), lo = visibility({ mag: 1, alt: 2, az: 0 }, st);
  ok(near(hi.magAparenteConExtincion, 1 + st.k * airmass(60), 1e-9), "m con extinción = m + k·X");
  ok(lo.magAparenteConExtincion > hi.magAparenteConExtincion + 3, "a 2° la estrella pierde varias magnitudes", f2(lo.magAparenteConExtincion));
  ok(lo.reddening > hi.reddening && lo.reddening > 1, "cerca del horizonte se enrojece (E(B−V) mayor)", `${f2(hi.reddening)} → ${f2(lo.reddening)}`);
  const v4hi = visibility({ mag: 4.5, alt: 70, az: 0 }, st), v4lo = visibility({ mag: 4.5, alt: 4, az: 0 }, st);
  ok(v4hi.visible && !v4lo.visible, "una estrella de mag 4,5 se ve alta pero no a 4° (Bortle 5)");
  ok(!visibility({ mag: -1.46, alt: -1, az: 0 }, st).visible, "bajo el horizonte no se ve nada");
  const ss = skyBrightnessAt(altAzToDir(5, 0), st).total, sz = skyBrightnessAt([0, 1, 0], st).total;
  ok(ss > sz, "de noche el cielo es más brillante cerca del horizonte", `${f2(nlToMag(ss))} vs ${f2(nlToMag(sz))}`);
  const v = visibility({ mag: 2, dir: altAzToDir(50, 120) }, st), w = visibility({ mag: 2, alt: 50, az: 120 }, st);
  ok(near(v.margin, w.margin, 1e-9), "acepta dirección o alt/az");
  const aa = dirToAltAz(altAzToDir(33, 250)); ok(near(aa.alt, 33, 1e-9) && near(aa.az, 250, 1e-9), "alt/az ↔ dirección (marco local: Y cenit, −Z norte, +X este)");
}

console.log("De día: con el Sol a +10° no se ve ninguna estrella del catálogo (Quito, efemérides reales)");
// buscar el instante del 13-nov-2026 en que el Sol está a +10° sobre Quito (por la mañana)
let tDay = null;
for (let m = 0; m < 24 * 60; m += 1) {
  const d = new Date(Date.UTC(2026, 10, 13, 0, m));
  const s = ephemeris(d).find((b) => b.name === "Sol"); const a = altAz(s.nx, s.ny, s.nz, QUITO.lat, QUITO.lon, d);
  if (a.alt >= 10) { tDay = d; break; }
}
const bodiesAt = (d) => {
  const out = {};
  for (const b of ephemeris(d)) { const a = altAz(b.nx, b.ny, b.nz, QUITO.lat, QUITO.lon, d); out[b.name] = { alt: a.alt, az: a.az, illum: b.illum }; }
  return out;
};
const starsAt = (d) => sky.stars.map((s) => { const a = altAz(s[1], s[2], s[3], QUITO.lat, QUITO.lon, d); return { mag: s[4], alt: a.alt, az: a.az, name: s[7] }; });
{
  const B = bodiesAt(tDay), cond = { elevation_m: 2850, latDeg: QUITO.lat, month: 11 };
  const st = skyState(B["Sol"], B["Luna"], 1, cond);                  // el caso más favorable: Bortle 1
  const stars = starsAt(tDay), up = stars.filter((s) => s.alt > 0);
  const vis = up.filter((s) => visibility(s, st).visible);
  ok(tDay && near(B["Sol"].alt, 10, 0.3), `Sol a ${f2(B["Sol"].alt)}° (${tDay.toISOString()})`);
  ok(st.phase === "día" && starsHidden(st), `fase día y límite por debajo de Sirio (límite ${f2(st.magLimit)})`);
  ok(vis.length === 0, `ninguna de las ${up.length} estrellas sobre el horizonte se ve`, vis.slice(0, 5).map((s) => s.name || s.mag).join(", "));
  // planetas: criterio documentado — visibles solo si su magnitud supera el umbral del cielo diurno allí.
  // Venus cerca de su máximo brillo (≈ −4,6) lejos del Sol sí; Júpiter (≈ −2,9 como mucho) queda en el
  // límite solo en el aire limpio de Quito; Sirio (−1,46) no. Magnitudes de máximo brillo aproximadas.
  const best = (mag) => { let m = -Infinity; for (let alt = 15; alt <= 85; alt += 5) for (let az = 0; az < 360; az += 15) m = Math.max(m, visibility({ mag, alt, az }, st).margin); return m; };
  ok(best(-1.46) < 0, "Sirio (−1,46) no se ve en ninguna parte del cielo", f2(best(-1.46)));
  ok(best(-2.9) < 0.5, "Júpiter en su máximo (−2,9): como mucho en el límite, en la zona más oscura del cielo", f2(best(-2.9)));
  ok(best(-2.0) < 0, "Júpiter con su brillo típico (−2,0) no se ve", f2(best(-2.0)));
  ok(best(-4.6) > 0, "Venus en su máximo brillo (−4,6) sí, lejos del Sol", f2(best(-4.6)));
}

console.log("Monotonía: más Bortle → nunca más estrellas");
{
  const conds = [
    ["noche sin Luna", NIGHT_SUN, null], ["Luna llena alta", NIGHT_SUN, { alt: 70, az: 0, illum: 1 }],
    ["cuarto creciente", NIGHT_SUN, { alt: 30, az: 270, illum: 0.5 }], ["crepúsculo −8°", { alt: -8, az: 260 }, null],
    ["crepúsculo −14°", { alt: -14, az: 260 }, null], ["día +5°", { alt: 5, az: 100 }, null],
  ];
  for (const [name, sun, moon] of conds) {
    let okm = true, row = [];
    for (let c = 1; c <= 9; c++) { const l = skyState(sun, moon, c, SEA).magLimit; row.push(f2(l)); if (c > 1 && l > skyState(sun, moon, c - 1, SEA).magLimit + 1e-9) okm = false; }
    ok(okm, `${name}: límite no crece con la clase`, row.join(" "));
  }
  // con el catálogo real, en Quito, esta noche (12-nov-2026 21:00 hora local)
  const T = new Date("2026-11-13T02:00:00Z"), B = bodiesAt(T), up = starsAt(T).filter((s) => s.alt > 0);
  const items = up.map((s) => ({ mag: s.mag, dir: altAzToDir(s.alt, s.az) }));
  const counts = [];
  for (let c = 1; c <= 9; c++) counts.push(countVisibleNow(items, skyState(B["Sol"], B["Luna"], c, { elevation_m: 2850, latDeg: QUITO.lat, month: 11 })));
  ok(counts.every((n, i) => i === 0 || n <= counts[i - 1]), `nº de estrellas visibles ahora por clase: ${counts.join(" · ")}`);
  ok(counts[8] < counts[0] / 4, "en clase 9 se ve menos de un cuarto que en clase 1");
  const t0 = performance.now(); countVisibleNow(items, skyState(B["Sol"], B["Luna"], 5, { elevation_m: 2850 })); const dt = performance.now() - t0;
  ok(dt < 40, `visibility() para ${items.length} estrellas en < 40 ms`, `${dt.toFixed(1)} ms`);
}

console.log("Catálogo, colores y textos");
{
  const mags = sky.stars.map((s) => s[4]);
  ok(countBrighter(mags, 6.0) === mags.filter((m) => m <= 6).length && countBrighter(mags, 6.0) > 5000, "countBrighter con el catálogo real", String(countBrighter(mags, 6.0)));
  const night = skyState({ alt: -40, az: 0 }, null, 1, SEA).colors, day = skyState({ alt: 30, az: 90 }, null, 1, SEA).colors;
  const dusk = skyState({ alt: -4, az: 270 }, null, 1, SEA).colors;
  ok(night.alpha === 0, "noche cerrada en sitio oscuro: el domo no se dibuja (opacidad 0)");
  ok(day.alpha === 1 && day.zenith[2] > day.zenith[0], "de día: cielo opaco y azul");
  ok(dusk.horizon[0] / dusk.horizon[2] > dusk.zenith[0] / dusk.zenith[2], "crepúsculo: horizonte más rojizo que el cenit");
  const city = skyState({ alt: -40, az: 0 }, null, 9, SEA).colors;
  ok(city.alpha > 0 && city.horizon[0] > night.horizon[0], "ciudad: resplandor en el horizonte");
  ok(night.approx === "visual", "los colores se declaran aproximación visual");
  ok(bortleForNelm(7) === 3 && bortleForNelm(3) === 9 && bortleForNelm(8) === 1 && bortleForNelm(5.8) === 5, "magnitud de la carta → clase de Bortle más cercana");
  const keys = (o) => Object.keys(o).sort().join(",");
  ok(keys(ATM.es) === keys(ATM.en), "i18n-atm: mismas claves en ES y EN");
  ok(["name", "where", "desc"].every((k) => BORTLE_TEXT.es[k].length === 10 && BORTLE_TEXT.en[k].length === 10 && BORTLE_TEXT.es[k].slice(1).every(Boolean)), "textos de las 9 clases en ES y EN");
  ok(MEASURED.quito.sqm.north < ENV_SKY.urban.range[1], "Quito medido (Aroca y Herrera 2022) más brillante que el tope urbano de Hänel");
  ok(typeof ATM.es.dayWarn === "string" && ATM.es.dayWarn.startsWith("Es de día"), "aviso de día");
}

console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
