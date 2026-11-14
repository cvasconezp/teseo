// Pruebas de la física pura, los datos y los textos de la pregunta «¿Qué pasa si
// cambio la masa?» (src/questions/massData.js).
// Uso:  node scripts/test_questions_mass.mjs   (sale con código 1 si algo falla)
import * as M from "../src/questions/massData.js";
import { G, C, G0, M_SUN_KG } from "../src/questions/constants.js";
import { TQ } from "../src/questions/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b));
const within = (a, b, abs) => Math.abs(a - b) <= abs;
const keysOf = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keysOf(v, `${pre}${k}.`) : [`${pre}${k}`]));
const world = (id) => M.WORLDS.find(w => w.id === id);
const preset = (id) => M.PRESETS.find(p => p.id === id);

console.log("Gravedad en la superficie (radios medios de la NASA)");
const gE = M.worldGravity(world("earth")), gM = M.worldGravity(world("moon"));
ok(within(gE, 9.82, 0.01) && Number(gE.toFixed(1)) === 9.8, "Tierra: g ≈ 9,8 m/s² (NASA 9,820)", String(gE));
ok(within(gM, 1.62, 0.01) && Number(gM.toFixed(2)) === 1.62, "Luna: g ≈ 1,62 m/s²", String(gM));
ok(within(M.worldGravity(world("mars")), 3.73, 0.01), "Marte: g ≈ 3,73 m/s² (NASA, media)");
ok(within(M.worldGravity(world("jupiter")), 25.92, 0.15), "Júpiter (1 bar): g ≈ 25,9 m/s² (NASA)", String(M.worldGravity(world("jupiter"))));
ok(within(M.worldGravity(world("sun")), 274.0, 0.5), "Sol: g ≈ 274 m/s² (NASA)", String(M.worldGravity(world("sun"))));
ok(within(M.worldGravity(world("pluto")), 0.62, 0.01), "Plutón: g ≈ 0,62 m/s² (NASA)");
ok(near(M.surfaceGravity(1, 1), G), "g(1 kg, 1 m) = G");

console.log("Velocidad de escape");
ok(within(M.escapeVelocity(world("earth").mass, world("earth").R) / 1000, 11.19, 0.01), "Tierra: 11,19 km/s", String(M.escapeVelocity(world("earth").mass, world("earth").R)));
ok(within(M.escapeVelocity(world("moon").mass, world("moon").R) / 1000, 2.38, 0.01), "Luna: 2,38 km/s (NASA)");
ok(within(M.escapeVelocity(world("sun").mass, world("sun").R) / 1000, 617.6, 0.5), "Sol: 617,6 km/s (NASA)");

console.log("Radio de Schwarzschild");
ok(within(M.schwarzschildKg(world("earth").mass) * 1000, 8.87, 0.01), "Tierra: r_s ≈ 8,87 mm", String(M.schwarzschildKg(world("earth").mass)));
ok(within(M.schwarzschildKg(M_SUN_KG) / 1000, 2.95, 0.01), "Sol: r_s ≈ 2,95 km", String(M.schwarzschildKg(M_SUN_KG)));
ok(near(M.schwarzschildKg(10 * M_SUN_KG), 10 * M.schwarzschildKg(M_SUN_KG)), "r_s es proporcional a la masa");
ok(near(M.schwarzschildKg(M_SUN_KG), 2 * G * M_SUN_KG / (C * C), 1e-12), "r_s = 2GM/c²");
{
  const { obj } = M.nearestLadder(2 * M.schwarzschildKg(world("earth").mass));
  ok(obj.id === "coin" || obj.id === "marble", "el horizonte de la Tierra (1,8 cm) se compara con una moneda o una canica", obj.id);
  ok(M.nearestLadder(2 * M.schwarzschildKg(M_SUN_KG)).obj.id === "city", "el del Sol (5,9 km) se compara con una ciudad");
  ok(M.nearestLadder(2 * M.schwarzschildKg(1e15)).obj.id === "proton" || M.nearestLadder(2 * M.schwarzschildKg(1e15)).ratio < 1, "el de un asteroide (1e15 kg) es más pequeño que un átomo");
  ok(M.LADDER.every((o, i, a) => i === 0 || a[i - 1].d < o.d), "la escalera de tamaños está ordenada");
}

console.log("Peso y «kilos de báscula»");
const w60 = (id) => M.scaleKg(60, M.worldGravity(world(id)));
ok(near(w60("earth"), 60 * 9.8201 / G0, 5e-4), "60 kg en la Tierra marcan ≈ 60 en la báscula (NASA: g medio 9,82 frente a g₀ = 9,80665)", String(w60("earth")));
ok(within(w60("mars"), 22.7, 0.15), "60 kg en Marte ≈ 22,7 kg de báscula (con g = 3,73: 22,8)", String(w60("mars")));
ok(within(w60("moon"), 9.9, 0.1), "60 kg en la Luna ≈ 9,9 kg de báscula", String(w60("moon")));
ok(near(M.weightN(60, 9.82), 589.2, 1e-9), "peso = m·g");
ok(w60("jupiter") > 140 && w60("jupiter") < 170, "en Júpiter la báscula marca ≈ 159 kg", String(w60("jupiter")));
ok(M.WORLDS.length === 12 && M.WORLDS.map(w => w.id).join() === "mercury,venus,earth,moon,mars,jupiter,saturn,uranus,neptune,pluto,sun,ns", "doce lugares, en el orden pedido");
ok(M.WORLDS.every(w => w.name.es && w.name.en && w.mass > 0 && w.R > 0), "cada lugar tiene nombre ES/EN, masa y radio");

console.log("Kepler: período y masa");
const moonT = M.orbitPeriod(world("earth").mass, 384400e3) / 86400;
ok(within(moonT, 27.3, 0.2), "Luna con la masa de la Tierra: T ≈ 27,3 días (masa de prueba: 27,5)", String(moonT));
const moonT2 = M.orbitPeriod(world("earth").mass, 384400e3, world("moon").mass) / 86400;
ok(within(moonT2, 27.32, 0.06), "contando también la masa de la Luna: T ≈ 27,3 días (sidéreo 27,32)", String(moonT2));
ok(near(M.orbitPeriod(4 * 5.9722e24, 3e8) * 2, M.orbitPeriod(5.9722e24, 3e8), 1e-12), "4 veces la masa → la mitad del período");
ok(within(M.orbitPeriod(M_SUN_KG, 149597870700) / 86400, 365.25, 0.5), "la Tierra alrededor del Sol: ≈ 365 días");
for (const w of M.WEIGHINGS) {
  const m = M.massFromOrbit(w.a, w.T);
  ok(Math.abs(m / w.known - 1) < 0.02, `masa de ${w.id} a partir de su luna: dentro del 2 % de lo publicado`, `${m} frente a ${w.known}`);
}
ok(near(M.massFromOrbit(384400e3, M.orbitPeriod(5.9722e24, 384400e3)), 5.9722e24, 1e-12), "massFromOrbit invierte orbitPeriod");
ok(M.animSeconds(1, 1) === 6 && M.animSeconds(1e-6, 1) >= 1.5 && M.animSeconds(1e9, 1) <= 14, "la animación se mantiene en 1,5–14 s por vuelta");
ok(M.animSeconds(2, 1) > M.animSeconds(1, 1) && M.animSeconds(0.5, 1) < M.animSeconds(1, 1), "más lento → vuelta más lenta en pantalla (orden conservado)");

console.log("Escala logarítmica del deslizador");
ok(M.MASS_SLIDER.min === 15 && near(M.massToLog(60 * M_SUN_KG), M.MASS_SLIDER.max), "va de 10¹⁵ kg a 60 M☉");
for (let l = M.MASS_SLIDER.min; l <= M.MASS_SLIDER.max; l += 0.37) {
  if (!near(M.massToLog(M.logToMass(l)), l, 1e-12)) { ok(false, "ida y vuelta de la escala", String(l)); break; }
}
ok(true, "ida y vuelta (log → masa → log) sin error en todo el rango");
ok(M.PRESETS.every(p => near(M.logToMass(M.massToLog(p.mass)), p.mass, 1e-12)), "ida y vuelta de cada atajo (masa → log → masa)");
ok(M.PRESETS.every(p => { const s = M.snapLog(M.massToLog(p.mass)); return Math.abs(s - M.massToLog(p.mass)) <= M.MASS_SLIDER.step / 2 + 1e-12; }), "al arrastrar, la rejilla del deslizador desvía como mucho medio paso (≈ 1,2 % en masa)");
ok(M.snapLog(0) === M.MASS_SLIDER.min && M.snapLog(99) === M.MASS_SLIDER.max, "snapLog acota a los extremos");
ok(near(M.tickPct(1e15), 0, 1e-9) && near(M.tickPct(60 * M_SUN_KG), 100, 1e-9), "las marcas van del 0 % al 100 %");
ok(M.tickPct(7.346e22) < M.tickPct(5.9722e24) && M.tickPct(5.9722e24) < M.tickPct(1.89813e27) && M.tickPct(1.89813e27) < M.tickPct(1.98841e30), "marcas Luna < Tierra < Júpiter < Sol");

console.log("Clasificación: umbrales");
const cls = (kg) => M.classify(kg);
const MJ = M.MJ_KG, ME = M.M_EARTH_KG;
ok(cls(1e15) === "irregular", "10¹⁵ kg → roca irregular");
ok(cls(M.THRESHOLDS.roundIce * 0.99) === "irregular" && cls(M.THRESHOLDS.roundIce * 1.01) === "transition", "≈ 3 × 10¹⁹ kg (200 km de hielo) → empieza la zona gris");
ok(cls(M.THRESHOLDS.roundRock * 0.99) === "transition" && cls(M.THRESHOLDS.roundRock * 1.01) === "round", "≈ 3 × 10²⁰ kg (300 km de roca) → mundo redondo");
ok(near(M.THRESHOLDS.roundIce, 3.351e19, 1e-3) && near(M.THRESHOLDS.roundRock, 3.393e20, 1e-3), "umbrales de redondez recalculados con 200 km·1000 kg/m³ y 300 km·3000 kg/m³");
ok(cls(world("moon").mass) === "round" && cls(world("earth").mass) === "round" && cls(M.ANCHORS[0].mass) === "round", "Ceres, Luna y Tierra → mundo redondo");
ok(cls(1.99 * ME) === "round" && cls(2.01 * ME) === "neptunian", "2 masas de la Tierra: sólido → neptuniano");
ok(cls(world("neptune").mass) === "neptunian" && cls(world("uranus").mass) === "neptunian", "Neptuno y Urano → neptunianos");
ok(cls(0.29 * MJ) === "neptunian" && cls(0.31 * MJ) === "giant", "0,3 MJ: neptuniano → gigante");
ok(cls(MJ) === "giant" && cls(12.9 * MJ) === "giant", "Júpiter y 12,9 MJ → gigante gaseoso");
ok(cls(13.1 * MJ) === "browndwarf" && cls(13 * MJ) === "browndwarf", "13 MJ (fusión de deuterio) → enana marrón");
ok(cls(70 * MJ) === "browndwarf" && cls(0.0749 * M_SUN_KG) === "browndwarf", "70 MJ → enana marrón");
ok(cls(0.0751 * M_SUN_KG) === "star" && cls(M.PRESETS.find(p => p.id === "mj80").mass) === "star", "0,075 M☉ (≈ 79 MJ) → estrella; 80 MJ ya lo es");
ok(cls(M_SUN_KG) === "star" && cls(7.9 * M_SUN_KG) === "star", "Sol y 7,9 M☉ → estrella");
ok(cls(8.1 * M_SUN_KG) === "massive" && cls(60 * M_SUN_KG) === "massive" && cls(20 * M_SUN_KG) === "massive", "8 M☉ o más → estrella masiva (supernova)");
ok(near(M.THRESHOLDS.hydrogen / MJ, 78.6, 2e-3), "0,075 M☉ ≈ 78,6 MJ");
ok(preset("saturn").kind === "giant" && cls(preset("saturn").mass) === "neptunian", "Saturno (0,2994 MJ) cae justo bajo el umbral: el atajo lo rotula «gigante»");
ok(M.KINDS.every(k => TQkind(k)), "cada clase tiene nombre, descripción y texto en ES y EN");
function TQkind(k) { return ["es", "en"].every(l => { const x = M.MASS_T[l].lab.kind[k]; return x && x.name && x.what && x.blurb; }); }
ok(M.KINDS.join() === "irregular,transition,round,neptunian,giant,browndwarf,star,massive", "orden de las clases");

console.log("Radio por régimen");
const R = M.radiusM;
ok(near(R(world("earth").mass), 6371e3, 1e-9) && near(R(world("moon").mass), 1737.4e3, 1e-9) && near(R(world("mars").mass), 3389.5e3, 1e-9) && near(R(world("jupiter").mass), 69911e3, 1e-9), "pasa exactamente por Tierra, Luna, Marte y Júpiter (NASA)");
ok(near(R(M.ANCHORS[0].mass), 469.7e3, 1e-9), "pasa por Ceres (469,7 km)");
ok(near(R(M_SUN_KG), 6.957e8, 1e-9), "el Sol sale con el radio nominal IAU");
ok(near(R(1e15) / R(8e15), 0.5, 1e-9), "por debajo de Ceres, R ∝ M^⅓ (densidad constante)");
ok(near(M.meanDensity(1e15, R(1e15)), 2162, 2e-3), "un asteroide de 10¹⁵ kg tiene la densidad de Ceres (2,16 g/cm³)", String(M.meanDensity(1e15, R(1e15))));
{
  // Crece con la masa salvo en el tramo de gigantes y enanas marrones (Júpiter → 0,075 M☉), donde el radio es casi constante
  // y baja un poco (≈ 3 %), como en Hatzes y Rauer (2015); ahí se exige que no cambie más de un 5 %.
  let mono = true, prev = 0; const j = M.MJ_KG, h = M.THRESHOLDS.hydrogen;
  for (let l = 15; l <= M.MASS_SLIDER.max; l += 0.01) {
    const m = Math.pow(10, l), r = R(m), plateau = m > j && m < h;
    if (!plateau && r < prev * (1 - 1e-12)) { mono = false; break; }
    prev = r;
  }
  ok(mono, "el radio crece con la masa (salvo la meseta de gigantes y enanas marrones)");
  ok(Math.abs(Math.log(R(h) / R(j))) < 0.05, "en la meseta (1 MJ → 0,075 M☉) el radio cambia menos de un 5 %", String(R(h) / R(j)));
}
{ let jump = 0, prev = R(1e15); for (let l = 15.001; l <= M.MASS_SLIDER.max; l += 0.001) { const r = R(Math.pow(10, l)); jump = Math.max(jump, Math.abs(Math.log(r / prev))); prev = r; } ok(jump < 0.02, "sin saltos: el cambio de radio por paso de 0,001 dex es < 2 %", String(jump)); }
ok(R(13 * MJ) / 69911e3 > 0.9 && R(13 * MJ) / 69911e3 < 1.05, "13 MJ: radio ≈ el de Júpiter (casi constante)", String(R(13 * MJ) / 69911e3));
ok(R(0.075 * M_SUN_KG) / 6.957e8 > 0.09 && R(0.075 * M_SUN_KG) / 6.957e8 < 0.105, "0,075 M☉: ≈ 0,097 R☉");
ok(R(20 * M_SUN_KG) / 6.957e8 > 7 && R(20 * M_SUN_KG) / 6.957e8 < 8.5, "20 M☉: 7–8,5 R☉ (tabla de Mamajek)", String(R(20 * M_SUN_KG) / 6.957e8));
ok(M.ANCHORS.every((a, i, arr) => i === 0 || (arr[i - 1].mass < a.mass && arr[i - 1].R < a.R)), "los anclajes crecen en masa y en radio");
ok(M.STARS.every((s, i, arr) => i === 0 || (arr[i - 1][0] < s[0] && arr[i - 1][1] < s[1] && arr[i - 1][2] < s[2])), "la tabla de estrellas crece en masa, radio y temperatura");
ok(M.starTeff(M_SUN_KG) === 5772, "Sol: 5772 K (IAU 2015)");
ok(M.starTeff(0.0749 * M_SUN_KG) === null && M.starTeff(1e27) === null, "sin temperatura de secuencia principal por debajo de 0,075 M☉");
ok(within(M.starTeff(20 * M_SUN_KG), 33000, 2500), "20 M☉: ≈ 33.000 K", String(M.starTeff(20 * M_SUN_KG)));
ok(M.starTeff(0.5 * M_SUN_KG) === 3660, "0,5 M☉: 3660 K (M1V)");
{
  const [r1, g1, b1] = M.kelvinToRgb(3000), [r2, g2, b2] = M.kelvinToRgb(5800), [r3, g3, b3] = M.kelvinToRgb(30000);
  ok(r1 > b1 && b3 > r3 && r2 >= 250 && b2 > b1, "color por temperatura: roja → blanca → azulada", `${[r1, g1, b1]} ${[r2, g2, b2]} ${[r3, g3, b3]}`);
}

console.log("Texto de la masa (aria-valuetext)");
ok(M.massHuman(3 * ME, "es") === "3 veces la masa de la Tierra", "3 masas de la Tierra → «3 veces la masa de la Tierra»", M.massHuman(3 * ME, "es"));
ok(M.massHuman(ME, "es") === "la masa de la Tierra" && M.massHuman(ME, "en") === "the mass of Earth", "la Tierra, en ES y EN");
ok(M.massHuman(20 * MJ, "es") === "20 veces la masa de Júpiter" && M.massHuman(20 * MJ, "en") === "20 times the mass of Jupiter", "20 MJ");
ok(M.massHuman(20 * M_SUN_KG, "es") === "20 veces la masa del Sol" && M.massHuman(20 * M_SUN_KG, "en") === "20 times the mass of the Sun", "20 M☉");
ok(M.massHuman(world("moon").mass, "es") === "la masa de la Luna", "la Luna");
ok(M.massHuman(1.02 * ME, "es") === "casi la masa de la Tierra" && M.massHuman(1.02 * ME, "en") === "about the mass of Earth", "1,02 masas de la Tierra: «casi la masa…», nunca «1 veces»");
ok(["es", "en"].every(l => { for (let x = 15; x <= M.MASS_SLIDER.max; x += 0.003) if (/^1 (veces|times)/.test(M.massHuman(Math.pow(10, x), l))) return false; return true; }), "en todo el rango, nunca «1 veces» ni «1 times»");
ok(/kg$/.test(M.massHuman(1e15, "es")), "el asteroide se da en kg", M.massHuman(1e15, "es"));
ok(["es", "en"].every(l => M.PRESETS.every(p => !/NaN|undefined|Infinity/.test(M.massHuman(p.mass, l)))), "ningún atajo produce NaN ni undefined");

console.log("Textos, fuentes y enlaces");
ok(keysOf(M.MASS_T.es).sort().join() === keysOf(M.MASS_T.en).sort().join(), "ES y EN tienen las mismas claves");
ok(M.MASS_T.es.assumptions.items.length === M.MASS_T.en.assumptions.items.length && M.MASS_T.es.thresholds.items.length === M.MASS_T.en.thresholds.items.length, "mismas listas en ES y EN");
ok(Object.values(M.MASS_REFS).every(r => r.cite && r.citeEn && /^https:\/\//.test(r.url)), "todas las fuentes tienen cita ES/EN y URL https");
ok(M.MASS_NEXT.length >= 3 && M.MASS_NEXT.every(l => /^https:\/\//.test(l.url) && l.label.es && l.label.en && l.note.es && l.note.en), "«Para seguir» con enlaces https y textos ES/EN");
ok(M.WEIGHINGS.every(w => M.MASS_REFS[w.ref]), "cada pesada cita una fuente existente");
ok(M.PRESETS.every(p => p.label.es && p.label.en && /^[\w]+$/.test(p.id)), "atajos con etiqueta ES/EN e id válido para las métricas");
ok(M.PRESETS.map(p => p.mass).every((m, i, a) => i === 0 || a[i - 1] < m), "atajos ordenados por masa");
ok(near(M.DM_OVER_ORDINARY, 5.364, 1e-3), "materia oscura / ordinaria (Planck) ≈ 5,36");
ok(TQ.es.tours.mass && TQ.en.tours.mass && TQ.es.tours.mass.title && TQ.en.tours.mass.teaser && TQ.es.tours.mass.tag && TQ.en.tours.mass.tag, "tarjeta del índice «mass» en ES y EN");
ok(keysOf(TQ.es).sort().join() === keysOf(TQ.en).sort().join(), "índice: ES y EN tienen las mismas claves");
ok(M.ORBIT_DISTANCES.some(d => d.id === M.DEFAULT_ORBIT) && M.ORBIT_DISTANCES.every(d => d.a > 0 && d.label.es && d.label.en), "distancias de órbita válidas");

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
