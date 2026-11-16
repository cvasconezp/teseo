// Pruebas de «¿Cómo terminará el universo?» (src/questions/endPhysics.js, endData.js, EndTour.jsx):
// cuentas contra los valores publicados, datos con fuente, textos ES/EN y registro de la pregunta.
// Uso:  node scripts/test_questions_end.mjs   (sale con código 1 si algo falla)
import fs from "node:fs";
import {
  sameSideOddsLog10, shake, leftCount, allOneSide, shakeMany, expectedHits, photonRatio, bhEntropyLog10, hawkingTempK,
  evapYearsLog10, massForEntropy, ripTimeGyr, scaleHistory, bigBangAgo, crunchSketch, eraAt,
} from "../src/questions/endPhysics.js";
import {
  END_REFS, END_T, END_NEXT, EVENTS, ENTROPY_BUDGET, BODIES, T_SUN, LITRE_MOLECULES, BH_PRESETS, ETA_SLIDER, SCENARIOS, CRUNCH, PLANCK,
} from "../src/questions/endData.js";
import { parseRoute } from "../src/questions/physics.js";
import { TQ } from "../src/questions/i18n.js";
import { searchTours } from "../src/questions/search.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const within = (a, b, tol) => Math.abs(a - b) <= tol;
const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
// generador determinista (mulberry32) para las pruebas del azar
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

console.log("Caja de gas");
ok(within(Math.pow(10, sameSideOddsLog10(10)), 512, 1e-6), "10 partículas: 1 en 512 (2 elevado a 9)");
ok(within(sameSideOddsLog10(100), 29.80, 0.01), "100 partículas: 1 en 6,3 × 10²⁹");
ok(within(LITRE_MOLECULES, 2.687e22, 0.002e22), "un litro de gas ideal a 0 °C y 1 atm: 2,69 × 10²² moléculas", String(LITRE_MOLECULES));
{
  const pts = shake(25, rng(1));
  ok(pts.length === 25 && pts.every(p => p.x >= 0 && p.x < 1 && p.y >= 0 && p.y < 1 && p.left === (p.x < 0.5)), "agitar: posiciones dentro de la caja y lado coherente");
  ok(allOneSide([{ left: true }, { left: true }]) && allOneSide([{ left: false }]) && !allOneSide([{ left: true }, { left: false }]) && leftCount([{ left: true }, { left: false }]) === 1, "todas de un lado: izquierda o derecha");
  const hits = shakeMany(4, 200000, rng(7));
  ok(within(hits / 200000, 0.125, 0.004), `4 partículas: frecuencia observada ≈ 1/8 (${(hits / 200000).toFixed(4)})`);
  ok(within(expectedHits(10, 1000), 1.953, 0.001), "10 partículas y 1000 agitadas: se esperan ~2");
}

console.log("Fotones");
ok(T_SUN === 5772, "Sol: 5772 K (IAU 2015 B3)");
ok(BODIES.find(b => b.id === "earth").t === 254.0 && BODIES.find(b => b.id === "venus").t === 226.6 && BODIES.find(b => b.id === "mars").t === 209.8, "temperaturas de cuerpo negro de la NASA: 254,0 / 226,6 / 209,8 K");
ok(within(photonRatio(T_SUN, 254.0), 22.7, 0.05), "Tierra: unos 22–23 fotones infrarrojos por cada fotón del Sol");

console.log("Agujeros negros");
ok(within(bhEntropyLog10(1), 77.02, 0.01), "S de una masa solar ≈ 1,05 × 10⁷⁷ k");
ok(within(hawkingTempK(1), 6.17e-8, 0.01e-8), "temperatura de Hawking de una masa solar ≈ 6,2 × 10⁻⁸ K");
ok(within(evapYearsLog10(1), 67.32, 0.01), "evaporación de una masa solar ≈ 2,1 × 10⁶⁷ años");
ok(within(evapYearsLog10(10) - evapYearsLog10(1), 3, 1e-9) && within(bhEntropyLog10(10) - bhEntropyLog10(1), 2, 1e-9), "escalas: tiempo ∝ M³ y entropía ∝ M²");
ok(within(massForEntropy(Math.log10(9.5e80)), 95, 1), "unas 95 masas solares igualan la entropía de todas las estrellas (Egan y Lineweaver)");
ok(hawkingTempK(1) < 2.7255 && hawkingTempK(1e-8) > 2.7255, "hoy un agujero negro estelar está más frío que el fondo cósmico");
ok(within(evapYearsLog10(1e11), 100.3, 0.05), "los mayores (10¹¹ M☉) se evaporan hacia 10¹⁰⁰ años: comienzo de la era oscura");

console.log("Entropía del universo (Egan y Lineweaver 2010, tabla 1)");
{
  const by = Object.fromEntries(ENTROPY_BUDGET.map(r => [r.id, r.log]));
  ok(within(by.smbh, Math.log10(3.1e104), 1e-9) && within(by.cmb, Math.log10(5.40e89), 1e-9) && within(by.stars, Math.log10(9.5e80), 1e-9), "supermasivos 3,1 × 10¹⁰⁴, fondo cósmico 5,40 × 10⁸⁹, estrellas 9,5 × 10⁸⁰");
  ok(ENTROPY_BUDGET.every((r, i, a) => i === 0 || r.log <= a[i - 1].log), "ordenado de mayor a menor");
}

console.log("Finales");
ok(within(ripTimeGyr(-1.5, 70, 0.3), 22.3, 0.1), "Gran Desgarro con w = −1,5, H₀ = 70, Ω_m = 0,3: ~22 Ga (Caldwell et al. 2003)");
ok(ripTimeGyr(-1, 67.4, 0.315) === Infinity && ripTimeGyr(-0.9, 67.4, 0.315) === Infinity, "sin desgarro si w ≥ −1");
{
  const lcdm = scaleHistory({ H0: 67.4, Om: 0.315, w: -1 });
  ok(within(bigBangAgo(lcdm), 13.8, 0.1), `ΛCDM integrado: edad ≈ 13,8 Ga (${bigBangAgo(lcdm).toFixed(2)})`);
  ok(lcdm.every((p, i, a) => i === 0 || (p.t > a[i - 1].t && p.a >= a[i - 1].a)), "a(t) crece siempre con energía oscura constante");
  const rip = scaleHistory({ H0: 67.4, Om: 0.315, w: -1.5, tMax: 60, aMax: 1e6 });
  const tr = ripTimeGyr(-1.5, 67.4, 0.315);
  ok(rip[rip.length - 1].a > 1e3 && within(rip[rip.length - 1].t, tr, 3), `con w = −1,5 a(t) se dispara cerca del instante del desgarro (${rip[rip.length - 1].t.toFixed(1)} frente a ${tr.toFixed(1)} Ga)`);
  const c = crunchSketch({ H0: 67.4, tPeak: CRUNCH.tPeak, tEnd: CRUNCH.tEnd });
  const top = c.reduce((b, p) => (p.a > b.a ? p : b));
  ok(c[0].a === 1 && c[c.length - 1].a === 0 && within(top.t, CRUNCH.tPeak, 0.4), "esquema del colapso: hoy 1, máximo a los ~11 Ga, cero al final");
  ok(within(CRUNCH.tEnd + 13.8, CRUNCH.total, 0.5), "fechas del colapso coherentes con una vida de ~33 Ga (Luu, Qiu y Tye 2025)");
}
ok(PLANCK.w === -1.03 && PLANCK.wErr === 0.03, "Planck + supernovas + BAO: w = −1,03 ± 0,03");

console.log("Eras y línea del tiempo");
ok(eraAt(10.14) === "stelliferous" && eraAt(20) === "degenerate" && eraAt(50) === "blackhole" && eraAt(105) === "dark", "eras de Adams y Laughlin");
ok(EVENTS.every((e, i, a) => i === 0 || e.eta >= a[i - 1].eta), "sucesos en orden cronológico");
ok(EVENTS.every(e => e.eta >= ETA_SLIDER.min && e.eta <= ETA_SLIDER.max), "todos los sucesos caben en el deslizador");
ok(EVENTS.every(e => ["measured", "estimated", "unknown"].includes(e.level) && e.refs.length && e.refs.every(r => END_REFS[r])), "cada suceso con nivel de certeza y fuente existente");
ok(within(EVENTS.find(e => e.id === "proton").eta, Math.log10(2.4e34), 1e-9), "límite del protón: 2,4 × 10³⁴ años (Super-Kamiokande 2020)");
ok(BH_PRESETS.find(p => p.id === "sgr").log === Math.log10(4e6) && BH_PRESETS.find(p => p.id === "m87").log === Math.log10(6.5e9), "Sgr A* 4 × 10⁶ y M87* 6,5 × 10⁹ masas solares (EHT)");

console.log("Fuentes y textos");
ok(Object.values(END_REFS).every(r => /^https:\/\//.test(r.url) && r.cite && r.citeEn), "cada fuente con enlace https y cita en ES y EN");
ok(END_NEXT.every(l => /^https:\/\//.test(l.url) && l.label.es && l.label.en && l.note.es && l.note.en), "«Para seguir» con enlaces https y textos ES/EN");
{
  const keys = (o) => Object.keys(o).sort().join();
  ok(keys(END_T.es) === keys(END_T.en), "mismas claves en ES y EN");
  for (const k of ["eras", "events", "scen", "bodies", "bhPresets", "etaPresets", "ledger", "bigRows"]) ok(keys(END_T.es[k]) === keys(END_T.en[k]), `mismas claves en «${k}»`);
  ok(EVENTS.every(e => END_T.es.events[e.id] && END_T.en.events[e.id]), "texto de cada suceso en ES y EN");
  ok(SCENARIOS.every(s => END_T.es.scen[s] && END_T.en.scen[s]), "nombre de cada final en ES y EN");
  ok(ENTROPY_BUDGET.every(r => END_T.es.ledger[r.id] && END_T.en.ledger[r.id]), "nombre de cada partida de entropía en ES y EN");
  ok(/esquema/.test(END_T.es.crunchText(11, 19.5, 33)) && /sketch/.test(END_T.en.crunchText(11, 19.5, 33)), "el colapso se presenta como esquema, no como cálculo");
  ok(/5σ/.test(END_T.es.crunchHint) && /3,1σ/.test(END_T.es.crunchHint) && /3\.1σ/.test(END_T.en.crunchHint), "DESI: 3,1σ, sin llegar a los 5σ de un descubrimiento");
  ok(/10 elevado a 161/.test(END_T.es.vacuumText(161, 65)) && /65/.test(END_T.es.vacuumText(161, 65)), "vacío: 10¹⁶¹ años, más de 10⁶⁵ con 95 %");
}

console.log("Registro de la pregunta");
{
  const qjsx = read("../src/questions/Questions.jsx"), tour = read("../src/questions/EndTour.jsx"), css = read("../src/questions/end.css");
  ok(/end: lazy\(\(\) => import\("\.\/EndTour\.jsx"\)\)/.test(qjsx) && /TOUR_IDS = \[[^\]]*"end"/.test(qjsx), "«end» registrado en TOURS y TOUR_IDS");
  ok(/id === "end"/.test(qjsx), "el índice tiene el emblema de «end»");
  ok(TQ.es.tours.end && TQ.en.tours.end && /terminará/.test(TQ.es.tours.end.title) && /end/.test(TQ.en.tours.end.title), "ficha del índice en ES y EN");
  ok(/TOURS = \{[^}]*"end"[^}]*\}/.test(read("../backend/app/metrics.py")), "«end» en TOURS del backend");
  const ids = qjsx.match(/TOUR_IDS = \[([^\]]*)\]/)[1].split(",").map(s => s.trim().replace(/"/g, ""));
  ok(searchTours("entropía", ids, TQ).includes("end") && searchTours("big crunch", ids, TQ).includes("end"), "el buscador encuentra la pregunta por «entropía» y «big crunch»");
  const r = parseRoute("#preguntas?q=end&n=12&m=6.6&eta=40&w=-1.2&s=rip", ["end"]);
  ok(r.id === "end" && r.params.get("s") === "rip" && r.params.get("eta") === "40", "ruta #preguntas?q=end con su estado");
  ok(!/localStorage|sessionStorage|document\.cookie/.test(tour), "no guarda nada en el navegador");
  ok(!/background:\s*(#fff\b|#ffffff|white)/i.test(css) && !/fill:\s*(#fff\b|white)/i.test(css), "sin fondos ni rellenos blancos (visión nocturna)");
  ok((tour.match(/aria-pressed/g) || []).length >= 4 && /role="img"/.test(tour) && /aria-live="polite"/.test(tour), "botones con aria-pressed, figuras con role=img y lecturas con aria-live");
  ok(/data-preset=\{`end-\$\{s\}`\}/.test(tour) && /data-preset=\{`eta-\$\{p\.id\}`\}/.test(tour), "atajos con data-preset (métrica q_preset)");
  ok(/q=expansion/.test(tour) && /q=bh/.test(tour), "enlaces a las preguntas de la expansión y de los agujeros negros");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
