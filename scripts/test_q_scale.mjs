// Pruebas de «¿Qué tan grande es el universo?» (src/questions/scaleData.js, scaleText.js, ScaleTour.jsx):
// cifras verificadas, coherencia de la regla, cosmología (distancia de hoy frente a tiempo de viaje de
// la luz), Voyager 1, juego, viajes, formato y registro en el índice, el buscador y el backend.
// Uso:  node scripts/test_q_scale.mjs   (sale con código 1 si algo falla)
import fs from "node:fs";
import {
  SCALE_REFS, OBJECTS, OBJECT_IDS, CAT_COLOR, COSMO, cosmology, T_CMB, N_EFF, Z_GNZ11, Z_GNZ11_HST, Z_CMB, PLANCK_AGE,
  comovingLy, lookbackYears, ageYears, ageAtYears, horizonLy, thenLy, recessionC, zForLy, farView,
  VOYAGER_TABLE, VOYAGER_SPEED_MS, VOYAGER_LIGHT_DAY_UTC, voyagerAt, voyagerLy, LIGHT_DAY_M,
  rulerObjects, lightTimeSec, rulerPos, nearestObject, RULER_STEPS, RULER_TICKS, LOG_MIN, LOG_MAX,
  SPEEDS, CAR_MS, TRIP_IDS, travelSeconds, tripPos, TRIP_MARKS, quizRounds, Z_PRESETS, zFromStep, stepFromZ, Z_STEPS, Z_MIN,
  distText, timeText, bigNum, gText, yearLeft, readScaleState, lyFromPc, lyFromParallaxMas, SCALE_NEXT,
} from "../src/questions/scaleData.js";
import { SCALE_T } from "../src/questions/scaleText.js";
import { PROXIMA_LY, PLANE_MS } from "../src/questions/timeData.js";
import { PLANCK } from "../src/questions/expansionData.js";
import { C, AU, LY, YEAR, PC, MPC } from "../src/questions/constants.js";
import { parseRoute } from "../src/questions/physics.js";
import { TQ } from "../src/questions/i18n.js";
import { KEYWORDS, searchTours } from "../src/questions/search.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, tol, name) => ok(Math.abs(a - b) <= tol, name, `→ obtuvo ${a}, esperaba ${b} ± ${tol}`);
const rel = (a, b, frac, name) => ok(Math.abs(a - b) <= Math.abs(b) * frac, name, `→ obtuvo ${a}, esperaba ${b} (±${frac * 100} %)`);
const eq = (a, b, name) => ok(a === b, name, `→ obtuvo ${JSON.stringify(a)}, esperaba ${JSON.stringify(b)}`);
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const keysOf = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keysOf(v, `${pre}${k}.`) : [`${pre}${k}`]));

const DAY = new Date("2026-11-16T12:00:00Z");
const objs = rulerObjects(DAY);
const O = Object.fromEntries(objs.map(o => [o.id, o]));

console.log("Cifras verificadas (16-nov-2026)");
near(lightTimeSec(O.moon), 1.282, 0.002, "Luna: la luz tarda 1,28 s (384 400 km, NASA)");
near(lightTimeSec(O.sun), 499.005, 0.01, "Sol: 1 ua ÷ c = 499,0 s (8 min 19 s)");
near(O.proxima.ly, 4.2465, 0.00005, "Próxima Centauri: 4,2465 a. l. (Gaia DR3, 768,0665 mas)");
eq(O.proxima.ly, PROXIMA_LY, "Próxima: la misma cifra que el recorrido del tiempo (timeData.js)");
near(O.sirius.ly, 8.60, 0.01, "Sirio: 8,60 a. l. (Hipparcos 2007, 379,21 mas)");
eq(O.pleiades.ly, 445, "Pléyades: 445 a. l. (NASA)");
near(O.betelgeuse.ly, 548, 1, "Betelgeuse: 548 a. l. (168 pc, Joyce et al. 2020)");
ok(O.betelgeuse.level === "estimated" && O.betelgeuse.range[0] < 500 && O.betelgeuse.range[1] > 630 && Math.round(O.betelgeuse.other) === 724, "Betelgeuse: incierta, con su rango (498–636) y la otra medida (724)");
near(O.orion.ly, 1265, 2, "Nebulosa de Orión: 1 265 a. l. (388 pc, Kounkel et al. 2017)");
near(O.orion.other, 1350, 2, "…y la medida anterior: 1 350 a. l. (414 pc, Menten et al. 2007)");
near(O.gc.ly, 26673, 5, "Centro galáctico: 26 673 a. l. (8 178 pc, GRAVITY 2019)");
ok(O.gc.ly > 26000 && O.gc.ly < 27000, "…entre 26 000 y 27 000 a. l.");
near(O.lmc.ly, 161740, 50, "Gran Nube de Magallanes: 161 740 a. l. (49,59 kpc)");
rel(O.m31.ly, 2.482e6, 0.001, "Andrómeda: 2,48 millones de a. l. (761 kpc, Li et al. 2021)");
rel(O.virgo.ly, 53.8e6, 0.002, "Cúmulo de Virgo: 53,8 millones de a. l. (16,5 Mpc, Mei et al. 2007)");
near(lyFromPc(1), 3.26156, 0.00001, "1 pc = 3,26156 a. l.");
near(lyFromParallaxMas(1000), 3.26156, 0.00001, "paralaje de 1″ → 1 pc");
eq(Z_GNZ11, 10.603, "GN-z11: z = 10,603 (Bunker et al. 2023)");
eq(Z_GNZ11_HST, 11.09, "GN-z11: z = 11,09 con el Hubble (Oesch et al. 2016)");
eq(Z_CMB, 1089.92, "fondo cósmico: z* = 1089,92 (Planck 2018, tabla 2)");
eq(T_CMB, 2.72548, "T del fondo cósmico: 2,72548 K (Fixsen 2009)");
ok(PLANCK.H0 === 67.4 && PLANCK.Om === 0.315, "H0 = 67,4 y Ωm = 0,315: los mismos de ¿El universo se expande?");

console.log("Voyager 1 (JPL Horizons)");
ok(VOYAGER_TABLE.length === 80 && VOYAGER_TABLE.every((r, i) => i === 0 || Date.parse(r[0]) - Date.parse(VOYAGER_TABLE[i - 1][0]) === 10 * 86400e3), "tabla cada 10 días, de nov-2026 a dic-2028");
eq(VOYAGER_TABLE[0][0], "2026-11-01", "empieza el 1-nov-2026");
ok(VOYAGER_TABLE.every(r => r[1] > 170 && r[1] < 182), "distancias entre 170 y 182 ua");
{
  const v = voyagerAt(DAY), lt = v.au * AU / C;
  ok(v.inRange && lt > 86300 && lt < 86400, `16-nov-2026: la señal tarda un poco menos de un día (${(lt / 3600).toFixed(3)} h)`);
  eq(timeText(lt, "es"), "23 h 59 min", "…y se lee «23 h 59 min» (minutos truncados, no «24 h»)");
  const nasa = voyagerAt(new Date(VOYAGER_LIGHT_DAY_UTC));
  near(nasa.au * AU, LIGHT_DAY_M, 0.0004 * LIGHT_DAY_M, "18-nov-2026 10:16 UTC (NASA): a un día luz, ± 0,04 % (interpolando Horizons)");
  near(LIGHT_DAY_M / 1000, 25.902e9, 0.001e9, "1 día luz = 25 902 millones de km (NASA)");
  ok(voyagerAt(new Date("2027-04-20")).au * AU > LIGHT_DAY_M, "en abril de 2027 (mínimo anual) sigue a más de un día luz");
  const before = voyagerAt(new Date("2025-01-01")), after = voyagerAt(new Date("2031-01-01"));
  ok(!before.inRange && before.date === "2026-11-01" && !after.inRange && after.date === "2028-12-30", "fuera de la tabla no se inventa: se da el extremo con su fecha");
  near(VOYAGER_SPEED_MS, 16920, 1, "velocidad respecto al Sol: 16,92 km/s (Horizons)");
  ok(voyagerLy(new Date("2028-12-30")) > voyagerLy(new Date("2026-11-01")), "se aleja");
}

console.log("La regla");
ok(objs.length === 14 && OBJECT_IDS.join() === "moon,sun,voyager,proxima,sirius,pleiades,betelgeuse,orion,gc,lmc,m31,virgo,gnz11,cmb", "catorce objetos, de la Luna al fondo cósmico");
ok(objs.every((o, i) => i === 0 || o.ly > objs[i - 1].ly), "orden creciente de distancia");
ok(objs.every(o => rulerPos(o.ly) > 0 && rulerPos(o.ly) < 1), "todos caben en la regla");
ok(objs.every((o, i) => nearestObject(objs, Math.round(rulerPos(o.ly) * RULER_STEPS)) === i), "el deslizador se detiene en cada objeto (posiciones distintas)");
ok(RULER_TICKS.every((t, i) => i === 0 || t.ly > RULER_TICKS[i - 1].ly) && rulerPos(RULER_TICKS[0].ly) > 0 && rulerPos(RULER_TICKS.at(-1).ly) < 1, "marcas de la regla en orden y dentro");
ok(LOG_MIN < Math.log10(O.moon.ly) && LOG_MAX > Math.log10(O.cmb.ly), "la regla va de antes de la Luna a después del fondo cósmico");
ok(objs.filter(o => o.lookback == null).every(o => lightTimeSec(o) === o.ly * YEAR), "objetos cercanos: tiempo de la luz = distancia en años luz");
ok(objs.every(o => CAT_COLOR[o.cat] && o.refs.length && o.refs.every(r => SCALE_REFS[r]) && ["measured", "estimated", "unknown"].includes(o.level)), "cada objeto con color, certeza y fuentes que existen");
ok(O.gnz11.lookback && O.cmb.lookback && O.gnz11.level === "estimated", "GN-z11 y el fondo cósmico llevan tiempo de viaje propio (estimado con un modelo)");

console.log("Cosmología: distancia de hoy ≠ tiempo de viaje de la luz");
{
  const p = COSMO;
  near(p.Om + p.Or + p.OL, 1, 1e-12, "universo plano: Ωm + Ωr + ΩΛ = 1");
  near(p.Og * (p.H0 / 100) ** 2, 2.47e-5, 0.01e-5, "Ω_γ h² = 2,47 × 10⁻⁵ (T = 2,72548 K)");
  near(p.Or / p.Og, 1 + 0.2271 * N_EFF, 1e-12, "Ω_r = Ω_γ · (1 + 0,2271 · N_eff)");
  const age = ageYears() / 1e9;
  near(age, PLANCK_AGE.gyr, 0.03, `edad del universo ${age.toFixed(3)} Ga ≈ 13,797 ± 0,023 (Planck 2018)`);
  const dz = comovingLy(Z_CMB), dmPlanck = (144.43 / 0.0104110) * MPC / LY;
  rel(dz, dmPlanck, 0.005, `fondo cósmico hoy a ${(dz / 1e9).toFixed(2)} Gal ≈ r*/θ* de Planck 2018 (${(dmPlanck / 1e9).toFixed(2)})`);
  const hz = horizonLy() / 1e9;
  ok(hz > 45.5 && hz < 47, `horizonte de partículas ${hz.toFixed(1)} Gal ≈ 46 (Davis y Lineweaver 2004)`);
  ok(horizonLy() > comovingLy(Z_CMB), "el horizonte está más lejos que el fondo cósmico");
  const g = farView(Z_GNZ11), m = farView(Z_CMB);
  ok(g.now > g.lookback && m.now > m.lookback, "distancia de hoy (a. l.) > tiempo de viaje (años): GN-z11 y fondo cósmico");
  ok(g.then < g.lookback && g.lookback < g.now, "GN-z11: distancia entonces < viaje de la luz < distancia hoy");
  near(g.lookback / 1e9, 13.36, 0.03, "GN-z11: su luz salió hace ≈ 13 360 millones de años");
  near(g.now / 1e9, 31.8, 0.1, "GN-z11: hoy está a ≈ 31 800 millones de a. l.");
  near(g.ageThen / 1e6, 434, 10, "GN-z11 (z = 10,603): el universo tenía ≈ 430 millones de años");
  near(ageAtYears(Z_GNZ11_HST) / 1e6, 400, 25, "con z = 11,09: «~400 millones de años tras el Big Bang» (Oesch 2016)");
  ok(m.lookback / 1e9 > 13.7 && m.lookback / 1e9 < PLANCK_AGE.gyr + 0.03, "fondo cósmico: su luz salió hace ≈ 13 800 millones de años");
  ok(m.now / 1e9 > 45 && m.now / 1e9 < 45.6, "fondo cósmico: hoy a ≈ 45 200 millones de a. l. (casi el borde de 46 000)");
  ok(m.ageThen > 3.0e5 && m.ageThen < 4.0e5, `fondo cósmico: salió con el universo de ${Math.round(m.ageThen)} años (ESA: «unos 380 000»)`);
  ok(m.v > 3.0 && m.v < 3.3, `el lugar del fondo cósmico se aleja hoy a ${m.v.toFixed(2)} c (Davis y Lineweaver: 3,2 c con Ωm = 0,3)`);
  near(recessionC(Z_GNZ11), (p.H0s * g.now * LY) / C, 1e-9, "velocidad de hoy = H0 · D");
  // Cercano: los dos números casi coinciden (supuesto del recorrido: < 0,5 % hasta Virgo)
  const zv = zForLy(O.virgo.ly), lb = lookbackYears(zv);
  near(comovingLy(zv), O.virgo.ly, O.virgo.ly * 1e-6, "zForLy invierte la distancia comóvil");
  ok(Math.abs(lb - O.virgo.ly) / O.virgo.ly < 0.005, `Virgo: viaje de la luz y distancia difieren ${(100 * Math.abs(lb - O.virgo.ly) / O.virgo.ly).toFixed(2)} % (< 0,5 %)`);
  ok(comovingLy(0) === 0 && lookbackYears(0) === 0 && thenLy(0) === 0, "z = 0: todo vale cero");
  ok([0.01, 0.1, 1, 3, 10, 100, 1000].every((z, i, a) => i === 0 || (comovingLy(z) > comovingLy(a[i - 1]) && lookbackYears(z) > lookbackYears(a[i - 1]))), "distancia y tiempo crecen con z");
  ok([0.5, 2, 10.603, 1089.92].every(z => comovingLy(z) > lookbackYears(z)), "con expansión, la distancia de hoy siempre supera al viaje de la luz");
  const p2 = cosmology(70, 0.3);
  ok(Math.abs(comovingLy(1, p2) - comovingLy(1)) / comovingLy(1) < 0.08, "con otros parámetros publicados cambia unos pocos por ciento");
}

console.log("Deslizador del paso 4");
ok(Math.abs(zFromStep(0) - Z_MIN) < 1e-12 && Math.abs(zFromStep(Z_STEPS) - Z_CMB) < 1e-6, "de z = 0,001 a z = 1089,92");
ok(Z_PRESETS.every(q => q.z > Z_MIN && q.z <= Z_CMB), "los atajos caben en el deslizador (Virgo incluido)");
ok(Z_PRESETS.every(q => Math.abs(zFromStep(stepFromZ(q.z)) - q.z) / q.z < 0.01), "el deslizador llega a cada atajo con menos de un 1 % de error en z");
ok(Z_PRESETS.map(q => q.id).join() === "virgo,gnz11,cmb" && Z_PRESETS.every((q, i) => i === 0 || q.z > Z_PRESETS[i - 1].z), "atajos: Virgo, GN-z11, fondo cósmico (en orden)");
ok(Z_PRESETS.every(q => Math.abs(stepFromZ(zFromStep(stepFromZ(q.z))) - stepFromZ(q.z)) === 0), "ida y vuelta paso ↔ z");
ok(new Set(Z_PRESETS.map(q => stepFromZ(q.z))).size === 3, "cada atajo cae en un paso distinto");

console.log("Juego: ¿cuánto tarda la luz?");
{
  const R = quizRounds(DAY);
  eq(R.map(r => r.id).join(), "moon,sun,voyager,proxima,m31", "cinco preguntas: Luna, Sol, Voyager 1, Próxima, Andrómeda");
  ok(R.every(r => r.options.length === 3 && r.answer >= 0 && r.answer < 3), "tres opciones y una respuesta en cada una");
  ok(R.every(r => near1(r.options[r.answer], lightTimeSec(O[r.id]))), "la respuesta es el tiempo calculado de la luz");
  ok(R.every(r => new Set(r.options.map(s => timeText(s, "es"))).size === 3), "las tres opciones se leen distintas");
  ok(R.every(r => r.options.every((s, j) => j === r.answer || Math.abs(Math.log10(s / r.options[r.answer])) > 0.5)), "los señuelos están lejos de la respuesta (más de ×3)");
  ok(new Set(R.map(r => r.answer)).size === 3, "la respuesta no está siempre en el mismo sitio");
}
function near1(a, b) { return Math.abs(a - b) <= Math.abs(b) * 1e-9; }

console.log("Viajes");
ok(SPEEDS.map(s => s.id).join() === "light,voyager,plane,car" && SPEEDS.every((s, i) => i === 0 || s.ms < SPEEDS[i - 1].ms), "luz > Voyager 1 > avión > auto");
eq(SPEEDS[0].ms, C, "la luz: c exacta");
ok(PLANE_MS === 250 && Math.abs(CAR_MS * 3.6 - 100) < 1e-9, "avión 900 km/h (timeData.js) y auto 100 km/h");
eq(TRIP_IDS.join(), "moon,sun,proxima,gc,m31", "destinos: Luna, Sol, Próxima, centro galáctico y Andrómeda");
near(travelSeconds(O.moon.ly, CAR_MS) / 86400, 160.2, 0.1, "a la Luna en auto: 160 días");
near(travelSeconds(O.proxima.ly, VOYAGER_SPEED_MS) / YEAR, 75200, 100, "a Próxima a la velocidad de la Voyager 1: unos 75 000 años");
ok(travelSeconds(O.m31.ly, CAR_MS) > PLANCK_AGE.gyr * 1e9 * YEAR && travelSeconds(O.proxima.ly, CAR_MS) < PLANCK_AGE.gyr * 1e9 * YEAR, "a Andrómeda en auto: más que la edad del universo; a Próxima, no");
ok(TRIP_MARKS.every((m, i) => i === 0 || m.sec > TRIP_MARKS[i - 1].sec) && TRIP_MARKS.every(m => tripPos(m.sec) > 0 && tripPos(m.sec) < 1), "marcas del eje en orden y dentro");
ok(TRIP_IDS.every(id => SPEEDS.every(s => tripPos(travelSeconds(O[id].ly, s.ms)) <= 1)), "todas las barras caben en el eje");

console.log("Formato");
eq(distText(O.moon.ly, "es"), "384.400 km", "Luna: «384.400 km»");
eq(distText(O.sun.ly, "es"), "149,6 millones de km", "Sol: «149,6 millones de km»");
eq(distText(O.sun.ly, "en"), "149.6 million km", "Sun: «149.6 million km»");
eq(timeText(lightTimeSec(O.sun), "es"), "8 min 19 s", "«8 min 19 s»");
eq(timeText(lightTimeSec(O.moon), "es"), "1,28 s", "«1,28 s»");
eq(distText(O.proxima.ly, "es"), "4,25 años luz", "«4,25 años luz»");
eq(distText(O.m31.ly, "es"), "2,48 millones de años luz", "«2,48 millones de años luz»");
eq(distText(O.gnz11.ly, "es"), "31.800 millones de años luz", "GN-z11 hoy: «31.800 millones de años luz»");
eq(distText(O.gnz11.ly, "en"), "31.8 billion light-years", "GN-z11 today: «31.8 billion light-years»");
eq(timeText(lightTimeSec(O.gnz11), "es"), "13.400 millones de años", "GN-z11, viaje de su luz: «13.400 millones de años»");
eq(timeText(travelSeconds(O.m31.ly, CAR_MS), "es"), "26,8 billones de años", "auto a Andrómeda: «26,8 billones de años» (billón = 10¹²)");
eq(timeText(travelSeconds(O.m31.ly, CAR_MS), "en"), "26.8 trillion years", "car to Andromeda: «26.8 trillion years»");
eq(timeText(86400 * 160.2, "en"), "160 days", "«160 days»");
eq(distText(1, "es"), "1 año luz", "singular: «1 año luz»");
eq(gText(31.8e9, "es"), "31,8", "miles de millones con un decimal");
eq(bigNum(2.5e6, "en"), "2.5 million", "bigNum en inglés");
{
  const y = yearLeft(8.6, DAY), y2 = yearLeft(445, DAY);
  ok(y.year === 2018 && !y.approx, "Sirio: su luz salió en 2018");
  ok(/String\(left\.year\)/.test(read("../src/questions/ScaleTour.jsx")), "el año se escribe sin separador de miles («2018», no «2.018»)");
  ok(y2.year === 1580 && y2.approx, "Pléyades: hacia 1580 (redondeado a la decena)");
  ok(yearLeft(26673, DAY) === null, "más de 3 000 años: no se da un año de calendario");
}

console.log("Hash");
{
  const r = parseRoute("#preguntas?q=scale&o=gnz11&d=m31&z=10.603", ["scale"]);
  const s = readScaleState(r.params);
  ok(r.id === "scale" && s.obj === "gnz11" && s.trip === "m31" && s.z === 10.603, "#preguntas?q=scale con objeto, destino y z exacto");
  const bad = readScaleState(new URLSearchParams("o=pluton&d=cmb&z=99999"));
  ok(bad.obj === null && bad.trip === null && bad.z === Z_CMB, "valores inválidos se descartan o se acotan");
  ok(readScaleState(new URLSearchParams("z=abc")).z === null && readScaleState(new URLSearchParams("z=0")).z === Z_MIN, "z no numérico se ignora; z = 0 se acota a 0,001");
  ok(parseRoute("#questions?q=scale", ["mass", "scale"]).id === "scale", "ruta en inglés #questions?q=scale");
}

console.log("Integración");
{
  const qjsx = read("../src/questions/Questions.jsx"), tour = read("../src/questions/ScaleTour.jsx"), css = read("../src/questions/scale.css");
  ok(/scale: lazy\(\(\) => import\("\.\/ScaleTour\.jsx"\)\)/.test(qjsx), "«scale» registrado en TOURS");
  const ids = JSON.parse(qjsx.match(/TOUR_IDS = (\[[^\]]*\])/)[1]);
  ok(ids.includes("scale") && ids.length === 9, "«scale» en TOUR_IDS: nueve preguntas");
  ok(/id === "scale"/.test(qjsx), "el índice tiene el emblema de «scale»");
  const words = { 9: ["Nueve", "Nine"] }[ids.length];
  ok(TQ.es.indexLead.startsWith(`${words[0]} preguntas grandes`) && TQ.en.indexLead.startsWith(`${words[1]} big questions`), "la entradilla del índice cuenta las preguntas que hay (Nueve / Nine)");
  ok(TQ.es.tours.scale && TQ.en.tours.scale && TQ.es.tours.scale.teaser && TQ.en.tours.scale.tag, "tarjeta del índice «scale» en ES y EN");
  ok(SCALE_T.es.title === TQ.es.tours.scale.title && SCALE_T.en.title === TQ.en.tours.scale.title, "el título del recorrido coincide con el del índice");
  ok(KEYWORDS.scale && /escala/.test(KEYWORDS.scale.es) && /scale/.test(KEYWORDS.scale.en), "palabras clave del buscador");
  for (const q of ["escala", "tamaño", "universo", "distancia", "año luz", "observable", "voyager", "Andromeda", "light year", "size"]) ok(searchTours(q, ids, TQ).includes("scale"), `buscar «${q}» encuentra la pregunta`);
  ok(!searchTours("espectro", ids, TQ).includes("scale"), "«espectro» no la encuentra");
  const metrics = read("../backend/app/metrics.py"), tmetrics = read("../backend/tests/test_metrics.py");
  ok(/TOURS = \{[^}]*"scale"[^}]*\}/.test(metrics) && /test_tour_scale_en_lista_blanca/.test(tmetrics), "«scale» en TOURS del backend y en su prueba");
  ok(/data-preset=\{`trip-\$\{id\}`\}/.test(tour) && /data-preset=\{`z-\$\{p\.id\}`\}/.test(tour) && /data-preset=\{`quiz-\$\{r\.id\}`\}/.test(tour), "atajos con data-preset (métrica q_preset)");
  ok(/q=scale&o=\$\{obj\}&d=\$\{trip\}&z=\$\{Number\(z\.toPrecision\(6\)\)\}/.test(tour) && /useHashSync\(hash\)/.test(tour), "el estado viaja en el hash #preguntas?q=scale…");
  ok(/aria-valuetext/.test(tour) && /role="img"/.test(tour) && /aria-live="polite"/.test(tour), "deslizador con aria-valuetext, gráficos con role=img y lecturas en vivo");
  ok(/ArrowRight/.test(tour) && /ArrowLeft/.test(tour), "la regla se maneja con el teclado (de objeto en objeto)");
  ok(!/background:\s*(#fff\b|#ffffff|white)/i.test(css) && !/fill:\s*(#fff\b|white)/i.test(css), "sin fondos blancos (compatible con visión nocturna)");
  ok(!/localStorage|sessionStorage|document\.cookie|fetch\(/.test(tour), "no guarda nada ni pide nada a la red");
  const used = [...tour.matchAll(/ids=\{\[([^\]]*)\]/g)].flatMap(m => m[1].split(",").map(x => x.trim()).filter(x => /^"/.test(x)).map(x => x.replace(/"/g, "")));
  ok(used.length >= 8 && used.every(id => SCALE_REFS[id]), "todos los ids de fuentes que usa el recorrido existen", used.filter(id => !SCALE_REFS[id]).join());
  ok(Object.values(SCALE_REFS).every(r => /^https:\/\//.test(r.url) && r.cite && r.citeEn), "cada fuente tiene enlace https y cita en ES y EN");
  ok(SCALE_NEXT.every(l => /^https:\/\//.test(l.url) && l.label.es && l.label.en && l.note.es && l.note.en), "enlaces «Para seguir» en ES y EN");
  ok(/q=expansion/.test(tour), "cierra enlazando con ¿El universo se expande?");
}

console.log("Textos ES/EN");
{
  const es = SCALE_T.es, en = SCALE_T.en;
  const ke = keysOf(es).sort().join(), kn = keysOf(en).sort().join();
  eq(ke === kn, true, "ES y EN tienen las mismas claves");
  ok(OBJECT_IDS.every(id => es.names[id] && en.names[id] && es.the[id] && en.the[id] && es.what[id] && en.what[id]), "nombre y descripción de cada objeto en ES y EN");
  ok(quizRounds(DAY).every(r => es.s2.q[r.id] && en.s2.q[r.id] && es.s2.why[r.id] && en.s2.why[r.id]), "cada pregunta del juego con texto y explicación");
  ok(SPEEDS.every(s => es.s3.vehicles[s.id] && en.s3.vehicles[s.id]) && TRIP_MARKS.every(m => es.s3.marks[m.id] && en.s3.marks[m.id]), "vehículos y marcas del eje rotulados");
  ok(RULER_TICKS.every(t => es.s1.ticks[t.id] && en.s1.ticks[t.id]), "marcas de la regla rotuladas");
  ok(Z_PRESETS.every(q => es.s4.presets[q.id] && en.s4.presetNotes[q.id]), "atajos del paso 4 rotulados");
  ok(/Tiempo de viaje de la luz/.test(es.s4.rows.lookback) && /HOY/.test(es.s4.rows.now) && /Light travel time/.test(en.s4.rows.lookback) && /TODAY/.test(en.s4.rows.now), "los dos números del paso 4 llevan rótulo claro");
  ok(es.s4.sentence("A", "B").join("") === "La luz salió hace A, pero ese lugar hoy está a B.", "frase «la luz salió hace X, pero ese lugar hoy está a Y»");
  ok(/13\.400 millones de años luz/.test(es.s4.fix) && /no su distancia de hoy/.test(es.s4.fix), "se explica la corrección de la antigua pestaña Escala");
  ok(es.s4.whole.tag === "unknown" && es.s4.edge.tag === "estimated", "el universo entero: «nadie lo sabe»; el borde observable: estimado");
  ok(es.assumptions.length === en.assumptions.length && es.assumptions.length >= 5, "supuestos visibles en ES y EN");
  ok(/ninguna IA/.test(es.honest) && /no AI/.test(en.honest), "«la IA narra, nunca calcula»: aquí no interviene");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
