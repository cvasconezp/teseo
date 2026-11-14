// Pruebas de la física pura, los datos y los textos de «¿Qué son las ondas
// gravitacionales?» (src/questions/gwData.js, gwText.js, GwTour.jsx).
// Uso:  node scripts/test_questions_gw.mjs   (sale con código 1 si algo falla)
import fs from "node:fs";
import * as K from "../src/questions/constants.js";
import { parseRoute } from "../src/questions/physics.js";
import {
  chirpMass, fIsco, timeToMerger, freqAtTime, cyclesLeft, tauFromCycles, strain, armDifference, energyJ, mpcToMly, mlyToMeters,
  massFromSlider, sliderFromMass, distFromSlider, sliderFromDist, exagExponent, sliderFromExagExponent, exagFactor, visibleStrain,
  MASS_SLIDER, DIST_SLIDER, EXAG_SLIDER, ringPoint, waveform, audioPlan, audioSamples, AUDIO,
  PRESETS, GW_REFS, GW_NEXT, THETA_SUN, LIGO_ARM_M, PROTON_DIAMETER_M, F_LIGO_REF,
} from "../src/questions/gwData.js";
import { GW_T } from "../src/questions/gwText.js";
import { TQ } from "../src/questions/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b));
const within = (a, b, tol) => Math.abs(a - b) <= tol;
const eq = (a, b, name) => ok(a === b, name, `→ obtuvo ${JSON.stringify(a)}, esperaba ${JSON.stringify(b)}`);
const keysOf = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keysOf(v, `${pre}${k}.`) : [`${pre}${k}`]));
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

console.log("Constantes reutilizadas");
eq(K.G, 6.67430e-11, "G = 6,67430e-11 (CODATA 2018)");
eq(K.C, 299792458, "c exacta");
ok(near(THETA_SUN, 4.925491e-6, 1e-5), "G·M☉/c³ = 4,9255 µs", String(THETA_SUN));

console.log("Masa de chirp y última órbita estable");
const c150914 = chirpMass(36, 29);
console.log(`        ℳ(36, 29) = ${c150914.toFixed(2)} M☉; f_ISCO(65 M☉) = ${fIsco(65).toFixed(1)} Hz`);
ok(c150914 >= 28 && c150914 <= 30, "masa de chirp de GW150914 ≈ 28–30 M☉", String(c150914));
ok(near(chirpMass(10, 10), Math.pow(100, 0.6) / Math.pow(20, 0.2), 1e-12), "ℳ(10, 10) con la fórmula directa");
ok(near(chirpMass(36, 29), chirpMass(29, 36), 1e-14), "ℳ es simétrica en las dos masas");
ok(chirpMass(1, 100) > 0 && chirpMass(1, 100) < 100, "ℳ entre 0 y la masa total");
const fi65 = fIsco(65);
ok(fi65 >= 60 && fi65 <= 70, "f_ISCO para 65 M☉ ≈ 60–70 Hz", String(fi65));
ok(within(fIsco(1) * 1, 4397, 5), "f_ISCO(1 M☉) ≈ 4,4 kHz (libro de texto)", String(fIsco(1)));
ok(near(fIsco(10) * 10, fIsco(1), 1e-12), "f_ISCO ∝ 1/M");
ok(fIsco(2.74) > 1500 && fIsco(2.74) < 1700, "f_ISCO de GW170817 ≈ 1,6 kHz", String(fIsco(2.74)));

console.log("Deformación en LIGO");
const dL = armDifference(1e-21);
ok(near(dL, 4e-18, 1e-9), "ΔL de LIGO ≈ 4e-18 m con h = 1e-21", String(dL));
eq(LIGO_ARM_M, 4000, "brazos de 4 km");
const protonFrac = PROTON_DIAMETER_M / (dL / 2);
ok(protonFrac > 800 && protonFrac < 900, "cada brazo cambia ≈ 1/840 del diámetro de un protón (la «milésima»)", String(protonFrac));
ok(within(PROTON_DIAMETER_M, 1.68e-15, 0.01e-15), "diámetro del protón ≈ 1,68 fm (CODATA 2018)");

console.log("Tiempo hasta la fusión y amplitud");
const tau = timeToMerger(35, c150914);
ok(tau > 0.1 && tau < 0.4, "tiempo hasta la fusión desde 35 Hz para GW150914 ≈ 0,2 s (orden de magnitud)", String(tau));
ok(within(tau, 0.19, 0.02), "…y en concreto ≈ 0,19 s", String(tau));
for (const f of [20, 35, 100, 500]) ok(near(freqAtTime(timeToMerger(f, c150914), c150914), f, 1e-12), `f(τ(f)) = f a ${f} Hz`);
ok(near(timeToMerger(70, c150914), timeToMerger(35, c150914) / Math.pow(2, 8 / 3), 1e-12), "τ ∝ f^(−8/3)");
ok(timeToMerger(35, chirpMass(1.46, 1.27)) > 20, "con estrellas de neutrones, desde 35 Hz queda mucho más (decenas de segundos)", String(timeToMerger(35, chirpMass(1.46, 1.27))));
const d150914 = mlyToMeters(mpcToMly(410));
const h150914 = strain(c150914, fi65, d150914);
ok(h150914 > 5e-22 && h150914 < 3e-21, "h de GW150914 en la última órbita ≈ 1e-21 (orden de magnitud)", String(h150914));
ok(near(strain(c150914, fi65, 2 * d150914), h150914 / 2, 1e-12), "h ∝ 1/distancia");
ok(within(mpcToMly(410), 1337, 1), "410 Mpc ≈ 1.337 millones de años luz", String(mpcToMly(410)));
ok(within(mpcToMly(40), 130, 1), "40 Mpc ≈ 130 millones de años luz", String(mpcToMly(40)));
ok(near(cyclesLeft(tauFromCycles(30, c150914), c150914), 30, 1e-12), "ciclos ↔ tiempo: ida y vuelta");
ok(near(energyJ(3), 3 * K.M_SUN_KG * K.C ** 2, 1e-12) && within(energyJ(3) / 1e47, 5.36, 0.05), "3 M☉ de energía ≈ 5,4e47 J", String(energyJ(3)));

console.log("Atajos");
const gw170817 = PRESETS.find(p => p.id === "gw170817");
ok(within(chirpMass(gw170817.m1, gw170817.m2), 1.188, 0.01), "GW170817: ℳ ≈ 1,188 M☉ (Abbott 2017)", String(chirpMass(gw170817.m1, gw170817.m2)));
ok(within(gw170817.m1 + gw170817.m2, 2.74, 0.02), "GW170817: masa total ≈ 2,74 M☉");
ok(PRESETS.length === 3 && ["gw150914", "gw170817", "ns"].every(id => PRESETS.find(p => p.id === id)), "tres atajos: GW150914, GW170817 y binaria típica");
ok(PRESETS.every(p => p.m1 >= 1 && p.m1 <= 100 && p.m2 >= 1 && p.m2 <= 100 && p.d >= 10 && p.d <= 10000), "los atajos caben en los deslizadores");
ok(PRESETS.every(p => GW_T.es.s3.presets[p.id] && GW_T.en.s3.presets[p.id] && GW_T.es.s3.notes[p.id] && GW_T.en.s3.notes[p.id]), "cada atajo tiene nombre y nota en ES y EN");

console.log("Escalas de los deslizadores (ida y vuelta)");
let massOk = true;
for (let s = MASS_SLIDER.min; s <= MASS_SLIDER.max; s += MASS_SLIDER.step) {
  const m = massFromSlider(s);
  if (!(m >= 1 && m <= 100) || Math.abs(sliderFromMass(m) - s) > 1) massOk = false;
}
ok(massOk, "masa: deslizador → masa → deslizador (±1 paso) en todo el recorrido");
eq(massFromSlider(0), 1, "masa mínima = 1 M☉");
eq(massFromSlider(200), 100, "masa máxima = 100 M☉");
eq(massFromSlider(-5), 1, "masa: se acota por debajo");
eq(massFromSlider(999), 100, "masa: se acota por arriba");
eq(sliderFromMass(36), Math.round(100 * Math.log10(36)), "masa de 36 M☉ en su posición");
ok(Number.isFinite(sliderFromMass(0)) && sliderFromMass(1e9) === 200 && sliderFromMass(1e-9) === 0, "masa fuera de rango se acota sin NaN");
let distOk = true;
for (let s = DIST_SLIDER.min; s <= DIST_SLIDER.max; s += DIST_SLIDER.step) {
  const d = distFromSlider(s);
  if (!(d >= 10 && d <= 10000) || Math.abs(sliderFromDist(d) - s) > 1) distOk = false;
}
ok(distOk, "distancia: deslizador → distancia → deslizador (±1 paso) en todo el recorrido");
eq(distFromSlider(0), 10, "distancia mínima = 10 millones de años luz");
eq(distFromSlider(300), 10000, "distancia máxima = 10.000 millones de años luz");
eq(distFromSlider(-1), 10, "distancia: se acota por debajo");
let exOk = true;
for (let s = EXAG_SLIDER.min; s <= EXAG_SLIDER.max; s += EXAG_SLIDER.step) if (sliderFromExagExponent(exagExponent(s)) !== s) exOk = false;
ok(exOk, "exageración: deslizador → exponente → deslizador sin pérdida");
ok(within(exagExponent(EXAG_SLIDER.start), 20.3, 1e-9) && within(visibleStrain(EXAG_SLIDER.start), 0.2, 0.005), "exageración inicial ≈ ×2·10²⁰ → anillo deformado ~20 %");
ok(visibleStrain(EXAG_SLIDER.max) <= 0.6 && visibleStrain(EXAG_SLIDER.min) >= 0.03, "la deformación dibujada se mantiene entre 3 % y 60 %");
ok(within(exagFactor(10), 1e20, 1e6), "exagerado ×10²⁰ en el paso 10");

console.log("Anillo de partículas");
const [x0, y0] = ringPoint(0, 0.2, 0), [x1, y1] = ringPoint(Math.PI / 2, 0.2, 0);
ok(near(x0, 1.1) && near(y1, 0.9) && within(y0, 0, 1e-12) && within(x1, 0, 1e-9), "fase 0: se estira a lo ancho y se aplasta a lo alto");
const [xp, yp] = ringPoint(0, 0.2, Math.PI);
ok(near(xp, 0.9), "media vuelta después: al revés", String(xp));
const [xz] = ringPoint(0, 0, 1.234);
eq(xz, 1, "sin deformación el anillo no se mueve");
let area = true;
for (let ph = 0; ph < 6.3; ph += 0.4) { const a = ringPoint(0, 0.3, ph), b = ringPoint(Math.PI / 2, 0.3, ph); if (Math.abs(a[0] * b[1] - (1 + 0.15 * Math.cos(ph)) * (1 - 0.15 * Math.cos(ph))) > 1e-12) area = false; }
ok(area, "x' · y' = 1 − (h/2·cos φ)²: casi no cambia el área (aplasta lo que estira)");

console.log("Forma de onda esquemática");
const w = waveform(36, 29, 14);
ok(w.pts.length > 300 && w.pts.every(p => Number.isFinite(p.t) && Number.isFinite(p.y)), "forma de onda finita y con muchas muestras");
ok(w.pts[0].t === 0 && w.pts.every((p, i) => i === 0 || p.t > w.pts[i - 1].t), "el tiempo avanza");
ok(Math.max(...w.pts.map(p => Math.abs(p.y))) <= 1.0001, "amplitud normalizada ≤ 1");
ok(near(w.fEnd, fIsco(65), 1e-12) && w.fStart < w.fEnd, "sube de frecuencia hasta el ISCO");
const pk = (arr) => Math.max(...arr.map(Math.abs));
const half = Math.floor(w.pts.length / 2);
ok(pk(w.pts.slice(half).map(p => p.y)) > pk(w.pts.slice(0, half).map(p => p.y)), "la amplitud crece hacia la fusión");
for (const [a, b] of [[1, 1], [100, 100], [1, 100], [36, 29], [1.46, 1.27]]) {
  const x = waveform(a, b, 14);
  ok(x.pts.every(p => Number.isFinite(p.y) && Number.isFinite(p.t)) && x.duration > 0, `forma de onda válida con ${a} + ${b} M☉`);
}

console.log("Sonido");
for (const [a, b] of [[36, 29], [1.46, 1.27], [1, 1], [100, 100], [1, 100], [10, 10]]) {
  const { samples, plan } = audioSamples(a, b, 8000);
  ok(samples.length === AUDIO.seconds * 8000 && samples.every(Number.isFinite) && pk(samples) <= 1, `muestras de audio finitas y en [−1, 1] con ${a} + ${b} M☉`);
  ok(plan.audioStart >= 150 && plan.audioEnd <= 2500 && plan.audioStart < plan.audioEnd, `${a} + ${b}: tono desplazado a la banda audible (${plan.audioStart.toFixed(0)}–${plan.audioEnd.toFixed(0)} Hz)`);
}
const pg = audioPlan(36, 29);
ok(pg.k > 5 && pg.stretch > 1, "GW150914 se desplaza en tono y se ralentiza para que se oiga");
const pn = audioPlan(1.46, 1.27);
ok(pn.k === 1 || within(pn.k, 1, 0.1), "GW170817 ya suena en la banda audible: sin desplazar el tono", String(pn.k));
const { samples: s1 } = audioSamples(36, 29, 8000);
ok(pk(s1.slice(0, 400)) < pk(s1.slice(11000, 11400)), "el sonido sube de volumen con la frecuencia y arranca con fundido");
ok(Math.abs(s1[0]) < 1e-3 && Math.abs(s1[s1.length - 1]) < 1e-3, "empieza y acaba en silencio (sin chasquidos)");

console.log("Textos, fuentes y enrutado");
const esK = keysOf(GW_T.es).sort(), enK = keysOf(GW_T.en).sort();
ok(JSON.stringify(esK) === JSON.stringify(enK), "ES y EN tienen las mismas claves", esK.filter(k => !enK.includes(k)).concat(enK.filter(k => !esK.includes(k))).join());
ok(GW_T.es.assumptions.length === GW_T.en.assumptions.length && GW_T.es.assumptions.length >= 6, "supuestos en ES y EN");
ok(Object.values(GW_REFS).every(r => r.cite && r.citeEn && /^https:\/\//.test(r.url)), "todas las referencias tienen cita ES/EN y URL https");
ok(GW_NEXT.every(l => /^https:\/\//.test(l.url) && l.label.es && l.label.en && l.note.es && l.note.en), "«Para seguir» con enlaces https y textos ES/EN");
ok(["abbott2016", "abbott2017bns", "abbott2017grb", "abbott2017basic", "maggiore", "nobel2017", "gwtc4", "lisa", "einstein1916", "kasen2017"].every(id => GW_REFS[id]), "fuentes clave presentes");
ok(/PRL 116, 061102|Phys\. Rev\. Lett\. 116, 061102/.test(GW_REFS.abbott2016.cite) && /119, 161101/.test(GW_REFS.abbott2017bns.cite) && /529, 1600209/.test(GW_REFS.abbott2017basic.cite), "citas con volumen y número de artículo");
const tour = read("../src/questions/GwTour.jsx"), qjsx = read("../src/questions/Questions.jsx"), css = read("../src/questions/gw.css"), i18n = read("../src/questions/i18n.js");
const used = [...tour.matchAll(/ids=\{(?:\[([^\]]*)\]|Object\.keys\(GW_REFS\))/g)].flatMap(m => (m[1] ? m[1].split(",").map(x => x.trim()).filter(x => /^"/.test(x)).map(x => x.replace(/"/g, "")) : []));
ok(used.length > 12 && used.every(id => GW_REFS[id]), "todos los ids de fuentes que usa el recorrido existen", used.filter(id => !GW_REFS[id]).join());
ok(/gw: lazy\(\(\) => import\("\.\/GwTour\.jsx"\)\)/.test(qjsx) && /TOUR_IDS = \[[^\]]*"gw"/.test(qjsx), "«gw» registrado en TOURS y TOUR_IDS");
ok(parseRoute("#preguntas?q=gw&a=36", ["bh", "gw"]).id === "gw" && parseRoute("#questions?q=gw", ["gw"]).id === "gw", "ruta #preguntas?q=gw");
ok(/Siete preguntas grandes/.test(i18n) && /Seven big questions/.test(i18n) && !/Seis preguntas grandes|Six big questions/.test(i18n), "recuento del índice: Siete / Seven");
ok(/gw: \{ title: "¿Qué son las ondas gravitacionales\?"/.test(i18n) && /gw: \{ title: "What are gravitational waves\?"/.test(i18n), "entrada del índice en ES y EN");
ok(/href=\{`#\$\{prefix\}\?q=bh`\}/.test(tour) && /href=\{`#\$\{prefix\}\?q=time`\}/.test(tour), "cierre con enlaces a q=bh y q=time");
ok((tour.match(/ariaText=\{/g) || []).length >= 5 && /aria-pressed/.test(tour), "deslizadores con aria-valuetext legible y atajos con aria-pressed");
ok(/requestAnimationFrame/.test(tour) && /cancelAnimationFrame/.test(tour) && /IntersectionObserver/.test(tour) && /prefers-reduced-motion/.test(tour), "animación: rAF, pausa fuera de pantalla y prefers-reduced-motion");
ok(/data-preset=\{p\.id\}/.test(tour), "atajos con data-preset (métrica q_preset)");
ok(/AudioContext/.test(tour) && /onClick=\{\(\) => \(state === "playing" \? stop\(\) : play/.test(tour) && !/autoplay|\.start\(\)\s*;?\s*\n\s*\}, \[\]\)/.test(tour), "el audio solo arranca desde un clic");
ok(/gain\.gain\.value = 0\.2/.test(tour), "volumen moderado");
ok(!/background:\s*(#fff\b|#ffffff|white)/i.test(css) && !/(fill|stroke|color):\s*(#fff\b|#ffffff|white)\s*;/i.test(css.replace(/color: #fff;/g, "")), "sin fondos ni rellenos blancos (compatible con visión nocturna)");
ok(TQ.es.tours.gw && TQ.en.tours.gw, "TQ.tours.gw en ES y EN");
const metrics = read("../backend/app/metrics.py"), mtest = read("../backend/tests/test_metrics.py");
ok(/TOURS = \{[^}]*"gw"[^}]*\}/.test(metrics), "«gw» en TOURS del backend");
ok(/test_tour_gw_en_lista_blanca/.test(mtest), "prueba de «gw» en test_metrics.py");
ok(F_LIGO_REF === 35, "35 Hz de referencia");

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
