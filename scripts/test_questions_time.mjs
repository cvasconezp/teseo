// Pruebas de la física pura, los datos y los textos de «¿Se puede viajar en el
// tiempo?» (src/questions/timeData.js, timeText.js, TimeTour.jsx).
// Uso:  node scripts/test_questions_time.mjs   (sale con código 1 si algo falla)
import fs from "node:fs";
import * as K from "../src/questions/constants.js";
import { parseRoute, staticClockRate } from "../src/questions/physics.js";
import {
  lorentz, lorentzMinusOne, betaFromSlider, sliderFromBeta, BETA_SLIDER, roundTrip, PROXIMA_LY, PROXIMA_PARALLAX_MAS,
  gpsOffsets, issEffect, ISS_MS, PARKER_MS, PLANE_MS, heightRateGain, heightGainSeconds, CHIMBORAZO_M,
  gravityAt, fractionFromSlider, sliderFromFraction, sliderMin, GRAV_SLIDER, PLACES, placeSlider, BODIES, rsOf,
  clockDeficit, extraFar, orbitExtraFar, smallTime, betaPercent, SPEED_PRESETS, HAFELE_KEATING, TIME_REFS, TIME_NEXT,
  GEOID_W0, GPS_RADIUS_M,
} from "../src/questions/timeData.js";
import { TIME_T } from "../src/questions/timeText.js";
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

console.log("Velocidad: factor de Lorentz");
ok(near(lorentz(0.6), 1.25), "γ(0,6 c) = 1,25", String(lorentz(0.6)));
ok(near(lorentz(0.8), 5 / 3), "γ(0,8 c) = 5/3", String(lorentz(0.8)));
eq(lorentz(0), 1, "γ(0) = 1");
ok(within(lorentz(0.9999), 70.71, 0.01), "γ(0,9999 c) ≈ 70,7", String(lorentz(0.9999)));
ok(near(lorentzMinusOne(0.6), 0.25, 1e-12) && near(lorentzMinusOne(0.8), 2 / 3, 1e-12), "γ−1 coincide con γ−1 a velocidades altas");
const bIss = ISS_MS / K.C;
ok(near(lorentzMinusOne(bIss), bIss * bIss / 2, 1e-6), "γ−1 ≈ β²/2 a velocidades bajas, sin perder cifras", String(lorentzMinusOne(bIss)));
ok(lorentzMinusOne(PLANE_MS / K.C) > 0 && lorentzMinusOne(PLANE_MS / K.C) < 1e-12, "avión: γ−1 es un número positivo muy pequeño (<1e-12)");

console.log("GPS (Ashby 2003)");
const gps = gpsOffsets();
console.log(`        gravedad ${gps.gravity.toFixed(2)} µs/día, velocidad ${gps.velocity.toFixed(2)} µs/día, neto ${gps.net.toFixed(2)} µs/día, error ${gps.rangeKmPerDay.toFixed(2)} km/día`);
ok(within(gps.gravity, 45, 1) && gps.gravity > 0, "gravedad ≈ +45 µs/día (±1)", String(gps.gravity));
ok(within(gps.velocity, -7, 1) && gps.velocity < 0, "velocidad ≈ −7 µs/día (±1)", String(gps.velocity));
ok(within(gps.net, 38, 1), "neto ≈ +38 µs/día (±1)", String(gps.net));
ok(near(gps.net, gps.gravity + gps.velocity, 1e-12), "neto = gravedad + velocidad");
ok(within(gps.speed, 3874, 3), "velocidad orbital GPS ≈ 3,87 km/s (Ashby: 3873,9 m/s)", String(gps.speed));
ok(within(gps.altitudeKm, 20200, 50), "altura GPS ≈ 20.200 km", String(gps.altitudeKm));
ok(within(gps.rangeKmPerDay, 11.5, 0.5), "error de distancia ≈ c × 38,6 µs ≈ 11,6 km/día", String(gps.rangeKmPerDay));
ok(near(gps.net * 1e-6 / 86400, 4.4647e-10, 5e-3), "desfase fraccionario ≈ 4,4647e-10 (Ashby, ec. 35)", String(gps.net * 1e-6 / 86400));
ok(near(GEOID_W0 / (K.C * K.C), 6.969290134e-10, 1e-12) && GPS_RADIUS_M === 2.656175e7, "Φ0/c² y radio orbital GPS de Ashby");

console.log("Hafele–Keating (1971)");
const hk = HAFELE_KEATING;
ok(Math.abs(hk.east.observed - hk.east.predicted) < hk.east.predictedErr + hk.east.observedErr, "este: lo medido concuerda con lo previsto dentro del error");
ok(Math.abs(hk.west.observed - hk.west.predicted) < hk.west.predictedErr + hk.west.observedErr, "oeste: lo medido concuerda con lo previsto dentro del error");
ok(hk.east.observed < 0 && hk.west.observed > 0, "el este pierde y el oeste gana tiempo");

console.log("Próxima Centauri");
ok(within(PROXIMA_LY, 4.2465, 0.0003), "distancia = 4,2465 años luz (paralaje Gaia DR3, 768,0665 mas)", String(PROXIMA_LY));
eq(PROXIMA_PARALLAX_MAS, 768.0665, "paralaje Gaia DR3");
const trip = roundTrip(PROXIMA_LY, 0.9);
ok(within(trip.earth, 9.44, 0.01), "a 0,9 c: ~9,44 años de ida y vuelta en la Tierra", String(trip.earth));
ok(within(trip.ship, 4.11, 0.01), "a 0,9 c: ~4,11 años a bordo", String(trip.ship));
ok(near(trip.earth / trip.ship, lorentz(0.9)), "cociente Tierra/nave = γ");
eq(roundTrip(PROXIMA_LY, 0), null, "sin velocidad no hay viaje (null)");
ok(roundTrip(PROXIMA_LY, 0.9999).ship < 0.13 * 1 + 0.0 && roundTrip(PROXIMA_LY, 0.9999).earth > 8.4, "a 0,9999 c: en la Tierra 8,5 años y a bordo ~0,12", JSON.stringify(roundTrip(PROXIMA_LY, 0.9999)));

console.log("Velocidades de los atajos");
ok(within(ISS_MS, 7660, 20), "ISS ≈ 7,66–7,67 km/s (órbita circular a 400 km)", String(ISS_MS));
ok(within(PARKER_MS / 1000, 192.2, 0.1), "Parker: 430.000 mph = 192,2 km/s", String(PARKER_MS / 1000));
ok(SPEED_PRESETS.length === 8 && SPEED_PRESETS.filter(p => p.real).length === 3, "8 atajos: 3 reales y 5 hipotéticos");
ok([0.1, 0.5, 0.9, 0.99, 0.9999].every(b => SPEED_PRESETS.some(p => !p.real && p.beta === b)), "hipotéticos: 10, 50, 90, 99 y 99,99 % de c");

console.log("Estación Espacial, 6 meses");
const iss = issEffect();
console.log(`        velocidad ${(iss.velocity * 1e3).toFixed(3)} ms, gravedad ${(iss.gravity * 1e3).toFixed(3)} ms, neto ${(iss.net * 1e3).toFixed(3)} ms`);
ok(iss.net < 0 && Math.abs(iss.net) > 1e-3 && Math.abs(iss.net) < 1e-2, "neto del orden de milisegundos y negativo (el astronauta envejece menos)", String(iss.net));
ok(iss.velocity < 0 && iss.gravity > 0 && Math.abs(iss.velocity) > iss.gravity, "gana la velocidad; la gravedad compensa solo una parte");
ok(within(iss.net * 1e3, -4.5, 0.2), "neto ≈ −4,5 ms", String(iss.net * 1e3));
ok(near(iss.net, iss.gravity + iss.velocity, 1e-12), "neto = gravedad + velocidad");

console.log("Chimborazo");
eq(CHIMBORAZO_M, 6263, "altitud 6.263 m");
const chim = heightGainSeconds(CHIMBORAZO_M, 80) * 1e6;
console.log(`        80 años en la cima: ${chim.toFixed(1)} µs de más`);
ok(within(chim, 1716, 40), "80 años en la cima: ≈ 1.716 µs de más (±40)", String(chim));
ok(near(chim, 9.7803 * CHIMBORAZO_M / (K.C * K.C) * 80 * K.YEAR * 1e6, 0.02), "coincide a ±2 % con la cuenta sencilla g·h/c²", String(chim));
ok(heightRateGain(0) === 0 && heightRateGain(CHIMBORAZO_M) > 0 && heightRateGain(2 * CHIMBORAZO_M) > heightRateGain(CHIMBORAZO_M), "el reloj gana más cuanto más alto");

console.log("Gravedad: factor √(1 − r_s/r)");
const earth = gravityAt("earth", 0), sun = gravityAt("sun", 0), wd = gravityAt("wd", 0), ns = gravityAt("ns", 0);
ok(near(earth.deficit, 6.95e-10, 2e-3), "superficie de la Tierra: 1 − k ≈ 6,95e-10", String(earth.deficit));
ok(near(sun.deficit, 2.1225e-6, 2e-3), "superficie del Sol: 1 − k ≈ 2,12e-6", String(sun.deficit));
ok(within(sun.extra * K.YEAR, 67, 1), "Sol: un año de más ≈ 67 s", String(sun.extra * K.YEAR));
ok(wd.rate > 0.9995 && wd.rate < 0.9999, "Sirio B: k ≈ 0,99973", String(wd.rate));
ok(ns.rate > 0.7 && ns.rate < 0.9 && within(ns.rate, 0.83, 0.01), "estrella de neutrones (1,34 M☉, 12,71 km): k ≈ 0,83 (razonable: 0,7–0,9)", String(ns.rate));
ok(near(gravityAt("ns", 0).rate, Math.sqrt(1 - 2 * K.GM_SUN * 1.34 / (K.C * K.C * 12.71e3)), 1e-12), "k de la estrella de neutrones = √(1 − 2GM/(c²R))");
ok(near(clockDeficit(1e-12), 5e-13, 1e-9) && near(clockDeficit(0.75), 0.5), "déficit de ritmo estable: pequeño y grande");
ok(near(extraFar(0.75), 1), "con r_s/r = 0,75 el reloj lejano cuenta el doble (1/k − 1 = 1)");
const bh = gravityAt("bh", 1e-9);
ok(bh.rate > 3e-5 && bh.rate < 3.2e-5, "agujero negro a 1e-9 r_s del horizonte: k ≈ 3,16e-5", String(bh.rate));
ok(near((bh.extra + 1) * 3600 / K.YEAR, 3.6, 0.01), "una hora ahí ≈ 3,6 años lejos", String((bh.extra + 1) * 3600 / K.YEAR));
eq(staticClockRate(1), null, "en el horizonte no hay observador estático (null)");
eq(gravityAt("bh", 0).rate, null, "f = 0 en un agujero negro (horizonte) → sin ritmo");
ok(bh.orbitExtra === null, "dentro de 1,5 r_s no hay órbitas circulares (null)");
const gpsPlace = PLACES.find(p => p.id === "gps"), issPlace = PLACES.find(p => p.id === "iss");
const gGps = gravityAt("earth", gpsPlace.f);
ok(near(gGps.orbitExtra, 1.5 * K.GM_EARTH / (BODIES.earth.R * (1 + gpsPlace.f)) / (K.C * K.C), 2e-3), "órbita circular: déficit ≈ 3GM/(2rc²)", String(gGps.orbitExtra));
ok(gGps.orbitExtra > gGps.extra, "en órbita el reloj se atrasa más que quieto (se suma la velocidad)");
ok(within(gravityAt("earth", issPlace.f).altitude, 4e5, 1), "ISS a 400 km sobre la superficie");
ok(within(gGps.r, 2.656175e7, 1), "GPS a 26.561,75 km del centro");
ok(near(rsOf(BODIES.bh), 2 * 10 * K.GM_SUN / (K.C * K.C)) && near(BODIES.bh.R, rsOf(BODIES.bh)), "agujero negro de 10 M☉: R = r_s");

console.log("Escalas de los deslizadores (ida y vuelta)");
let maxErr = 0;
for (let t = 0; t <= BETA_SLIDER.max + 1e-9; t += BETA_SLIDER.step) { const t2 = sliderFromBeta(betaFromSlider(t)); maxErr = Math.max(maxErr, Math.abs(t2 - t)); }
ok(maxErr < 1e-9, "velocidad: slider → β → slider sin error (<1e-9)", String(maxErr));
eq(betaFromSlider(0), 0, "slider 0 = reposo");
ok(near(betaFromSlider(4), 0.9999), "slider 4 = 0,9999 c");
ok(near(betaFromSlider(1), 0.9) && near(betaFromSlider(2), 0.99) && near(betaFromSlider(3), 0.999), "marcas: 1 → 90 %, 2 → 99 %, 3 → 99,9 %");
let mono = true, prev = -1;
for (let t = 0; t <= 4; t += 0.05) { const b = betaFromSlider(t); if (!(b > prev) && !(t === 0)) mono = false; prev = b; }
ok(mono, "β crece con el deslizador");
ok(betaFromSlider(-1) === 0 && betaFromSlider(9) <= 0.9999 + 1e-12, "valores fuera de rango se acotan");
for (const p of SPEED_PRESETS.filter(p => p.beta > 0.05)) ok(near(betaFromSlider(sliderFromBeta(p.beta)), p.beta, 1e-9), `atajo ${p.id}: β → slider → β`);
let gErr = 0;
for (const obj of Object.keys(BODIES)) {
  const lo = sliderMin(obj);
  for (let s = lo + GRAV_SLIDER.step; s <= GRAV_SLIDER.max + 1e-9; s += 0.1) { const s2 = sliderFromFraction(fractionFromSlider(s, obj), obj); gErr = Math.max(gErr, Math.abs(s2 - s)); }
}
ok(gErr < 1e-9, "gravedad: slider → distancia → slider sin error (<1e-9)", String(gErr));
eq(fractionFromSlider(GRAV_SLIDER.min, "earth"), 0, "extremo izquierdo en la Tierra = la superficie");
ok(fractionFromSlider(GRAV_SLIDER.minBh, "bh") > 0, "en el agujero negro el extremo izquierdo nunca es el horizonte");
ok(PLACES.every(p => { const s = placeSlider(p); return s >= sliderMin(p.obj) && s <= GRAV_SLIDER.max && near(fractionFromSlider(s, p.obj), p.f || 1e-300, 1e-9) || p.f === 0; }), "cada lugar cae dentro de su deslizador y vuelve igual");
ok(PLACES.length === 8 && PLACES.map(p => p.id).join() === "earth,chimborazo,iss,gps,sun,siriusb,ns,bh", "8 lugares: Tierra, Chimborazo, ISS, GPS, Sol, Sirio B, estrella de neutrones, agujero negro");

console.log("Formato");
eq(betaPercent(0.9999, "es"), "99,99", "99,99 %");
eq(betaPercent(0.5, "es"), "50", "50 %");
eq(betaPercent(0.9437, "en"), "94.37", "94,37 % en inglés con punto");
eq(smallTime(0.022, "es"), "22 ms", "22 ms");
ok(/µs/.test(smallTime(4.5e-6, "es")) && /ns/.test(smallTime(4.5e-9, "en")), "µs y ns");

console.log("Textos, fuentes e integración");
eq(keysOf(TIME_T.es).sort().join(), keysOf(TIME_T.en).sort().join(), "ES y EN tienen las mismas claves");
eq(TIME_T.es.assumptions.length, TIME_T.en.assumptions.length, "mismos supuestos en ES y EN");
ok(TIME_T.es.assumptions.length >= 6 && /aceleración/.test(TIME_T.es.assumptions[0]), "Supuestos visibles; el primero dice que se ignora la aceleración");
eq(keysOf(TQ.es).sort().join(), keysOf(TQ.en).sort().join(), "índice: ES y EN tienen las mismas claves");
ok(TQ.es.tours.time && TQ.en.tours.time && TQ.es.tours.time.title && TQ.en.tours.time.teaser && TQ.es.tours.time.tag, "tarjeta «time» del índice en ES y EN");
ok(Object.values(TIME_REFS).every(r => r.cite && r.citeEn && /^https:\/\//.test(r.url)), "todas las referencias tienen cita ES/EN y URL https");
ok(TIME_NEXT.length >= 3 && TIME_NEXT.every(l => /^https:\/\//.test(l.url) && l.label.es && l.label.en && l.note.es && l.note.en), "«Para seguir» con enlaces https y textos ES/EN");
ok(PLACES.every(p => TIME_T.es.s3.presets[p.id] && TIME_T.en.s3.presets[p.id] && TIME_T.es.s3.notes[p.id] && TIME_T.en.s3.notes[p.id]), "cada lugar tiene nombre y nota en ES y EN");
ok(SPEED_PRESETS.every(p => TIME_T.es.s2.presets[p.id] && TIME_T.en.s2.presets[p.id]), "cada atajo de velocidad tiene nombre en ES y EN");
ok(["plane", "iss", "parker"].every(id => SPEED_PRESETS.find(p => p.id === id)), "avión, ISS y Parker");
const tour = read("../src/questions/TimeTour.jsx"), qjsx = read("../src/questions/Questions.jsx"), css = read("../src/questions/time.css");
const used = [...tour.matchAll(/ids=\{(?:\[([^\]]*)\]|Object\.keys\(TIME_REFS\))/g)].flatMap(m => (m[1] ? m[1].split(",").map(x => x.trim()).filter(x => /^"/.test(x)).map(x => x.replace(/"/g, "")) : []));
ok(used.length > 8 && used.every(id => TIME_REFS[id]), "todos los ids de fuentes que usa el recorrido existen", used.filter(id => !TIME_REFS[id]).join());
ok(/time: lazy\(\(\) => import\("\.\/TimeTour\.jsx"\)\)/.test(qjsx) && /TOUR_IDS = \[[^\]]*"time"/.test(qjsx), "«time» registrado en TOURS y TOUR_IDS");
ok(parseRoute("#preguntas?q=time&v=0.9", ["bh", "time"]).id === "time" && parseRoute("#questions?q=time", ["time"]).id === "time", "ruta #preguntas?q=time");
ok(/href=\{`#\$\{prefix\}\?q=bh`\}/.test(tour), "cierre con enlace a la pregunta de agujeros negros (q=bh)");
ok((tour.match(/ariaText=\{/g) || []).length >= 2 && /aria-pressed/.test(tour), "deslizadores con aria-valuetext legible y atajos con aria-pressed");
ok(/requestAnimationFrame/.test(tour) && /cancelAnimationFrame/.test(tour) && /IntersectionObserver/.test(tour) && /prefers-reduced-motion/.test(tour), "animación: rAF, pausa fuera de pantalla y prefers-reduced-motion");
ok(/data-preset=\{`v-/.test(tour) && /data-preset=\{`g-/.test(tour), "atajos con data-preset (métrica q_preset)");
ok(!/background:\s*(#fff\b|#ffffff|white)/i.test(css) && !/fill:\s*(#fff\b|white)/i.test(css), "sin fondos ni rellenos blancos (compatible con visión nocturna)");
const metrics = read("../backend/app/metrics.py");
ok(/TOURS = \{[^}]*"time"[^}]*\}/.test(metrics), "«time» en TOURS del backend");

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
