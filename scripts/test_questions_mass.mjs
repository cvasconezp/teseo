// Pruebas de la física pura, los datos y los textos de la pregunta «¿Qué pasa si
// cambio la masa?» (src/questions/massData.js).
// Uso:  node scripts/test_questions_mass.mjs   (sale con código 1 si algo falla)
import * as M from "../src/questions/massData.js";
import { G, C, G0, M_SUN_KG, R_SUN as R_SUN_, R_EARTH as R_EARTH_ } from "../src/questions/constants.js";
import { TQ } from "../src/questions/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b));
const within = (a, b, abs) => Math.abs(a - b) <= abs;
const keysOf = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keysOf(v, `${pre}${k}.`) : [`${pre}${k}`]));
const MJ_ = M.MJ_KG;
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

console.log("Misma masa, distinto tamaño (g, v, ρ con el radio libre)");
const MS = M_SUN_KG, ex = (id) => M.example(id);
{
  const sirius = ex("sirius"), rhoS = M.meanDensity(sirius.mass, sirius.R);
  ok(rhoS > 1e9 && rhoS < 5e9 && Math.round(Math.log10(rhoS)) === 9, "densidad de Sirio B ≈ 10⁹ kg/m³ (2,8 × 10⁹ con 1,018 M☉ y 0,00802 R☉)", String(rhoS));
  ok(near(sirius.R / world("earth").R, 0.876, 5e-3) && sirius.R < world("earth").R, "Sirio B es un poco más pequeña que la Tierra (0,88 R⊕)", String(sirius.R / world("earth").R));
  const gNS = M.surfaceGravity(1.4 * MS, 12e3);
  ok(within(gNS / 1.3e12, 1, 0.03), "estrella de neutrones de 1,4 M☉ y 12 km: g ≈ 1,3 × 10¹² m/s²", String(gNS));
  const ns = ex("ns");
  ok(near(M.meanDensity(ns.mass, ns.R), 3.44e17, 5e-3), "estrella de neutrones (1,4 M☉, 12,45 km): ρ ≈ 3,4 × 10¹⁷ kg/m³");
  const bh = ex("bh10");
  ok(within(bh.R / 1000, 29.5, 0.05) && near(bh.R, M.schwarzschildKg(10 * MS), 1e-12), "agujero negro de 10 M☉: r_s ≈ 29,5 km (≈ 30 km)", String(bh.R));
  const bet = ex("betelgeuse"), rhoB = M.meanDensity(bet.mass, bet.R);
  ok(within(bet.R / R_SUN_, 764, 1e-6) && rhoB < 1e-4 && rhoB < 1.2 / 1e4 && rhoB > 1e-5, "Betelgeuse: 764 R☉ y densidad ≈ 6 × 10⁻⁵ kg/m³, más de 10 000 veces menos que el aire", String(rhoB));
  ok(M.meanDensity(M_SUN_KG, R_SUN_) / rhoB > 1e7, "Betelgeuse es más de 10⁷ veces menos densa que el Sol");
  const bd = ex("browndwarf"), jup = ex("jupiter");
  ok(bd.mass / jup.mass > 60 && bd.mass / jup.mass < 64 && bd.R / jup.R > 0.75 && bd.R / jup.R < 1.0, "enana marrón LHS 6343 C: 62 MJ y un radio menor que el de Júpiter (≈ 0,8)", String(bd.R / jup.R));
  ok(M.example("sun").R > sirius.R * 100 && sirius.mass > M_SUN_KG, "Sirio B pesa más que el Sol y es más de 100 veces más pequeña");
  // El radio no sigue a la masa: ordenados por masa, el radio sube y baja
  const rows = M.TABLE_ORDER.map(ex), byMass = rows.every((e, i, a) => i === 0 || a[i - 1].mass <= e.mass);
  let ups = 0, downs = 0; rows.forEach((e, i) => { if (i) (e.R > rows[i - 1].R ? ups++ : downs++); });
  ok(byMass && ups >= 2 && downs >= 2, "en la tabla, ordenada por masa, el radio sube y baja (no sigue a la masa)", `${ups} subidas, ${downs} bajadas`);
  ok(M.TABLE_ORDER.every(id => M.EXAMPLE_SHORT[id] && M.EXAMPLE_SHORT[id].es && M.EXAMPLE_SHORT[id].en), "cada cuerpo de la tabla tiene rótulo corto ES/EN");
  ok(M.EXAMPLES.every(e => e.name.es && e.name.en && e.the.es && e.the.en && e.colors.length === 2 && e.R > 0 && (e.mass === null || e.mass > 0)), "ejemplos con nombre ES/EN, colores, masa y radio");
  ok(M.EXAMPLES.filter(e => e.ref).every(e => M.MASS_REFS[e.ref]) && M.COMPARES.every(c => c.refs.every(r => M.MASS_REFS[r]) && c.items.every(i => ex(i)) && ["measured", "estimated"].includes(c.level)), "cada ejemplo y comparación cita fuentes que existen");
  ok(M.COMPARES.map(c => c.id).join() === "jupiter,sirius,ns,bh,betelgeuse" && M.COMPARES.every(c => ["es", "en"].every(l => M.MASS_T[l].big.pairs[c.id] && M.MASS_T[l].big.tabs[c.id])), "cinco comparaciones con texto ES/EN");
  // Enanas blancas medidas: la más masiva es la más pequeña (relación masa–radio inversa)
  const wd = M.WD_MEASURED, top = wd.reduce((a, b) => (b.mass > a.mass ? b : a)), small = wd.reduce((a, b) => (b.R < a.R ? b : a));
  ok(top.name === "Sirius B" && small.name === "Sirius B" && wd.length >= 5, "entre las enanas blancas medidas, la más masiva (Sirio B) es la más pequeña");
  ok(wd.every(w => w.R > 0.007 && w.R < 0.016 && w.mass > 0.3 && w.mass < M.CHANDRASEKHAR), "radios de 0,7–1,6 % de R☉ y masas bajo el límite de Chandrasekhar (1,4 M☉)");
}
// Con el radio fijo, más masa da más gravedad; con la masa fija, menos radio da más gravedad (y más densidad)
{
  const Rfix = 6.371e6;
  let a = true, b = true, c = true, d = true;
  for (let l = 15; l < 31.5; l += 0.25) {
    const m1 = Math.pow(10, l), m2 = Math.pow(10, l + 0.25);
    if (!(M.surfaceGravity(m2, Rfix) > M.surfaceGravity(m1, Rfix))) a = false;
    if (!(M.escapeVelocity(m2, Rfix) > M.escapeVelocity(m1, Rfix))) b = false;
    const r1 = 1e3 * Math.pow(10, (l - 15) / 2), r2 = r1 / 1.5;
    if (!(M.surfaceGravity(m1, r2) > M.surfaceGravity(m1, r1))) c = false;
    if (!(M.meanDensity(m1, r2) > M.meanDensity(m1, r1) && M.escapeVelocity(m1, r2) > M.escapeVelocity(m1, r1))) d = false;
  }
  ok(a && b, "con el radio fijo, más masa → más gravedad y más velocidad de escape");
  ok(c && d, "con la masa fija, menos radio → más gravedad, más velocidad de escape y más densidad");
  ok(near(M.surfaceGravity(5.9722e24, 3189.5e3) / M.surfaceGravity(5.9722e24, 6379e3), 4, 1e-3), "la mitad del radio da 4 veces la gravedad (g ∝ 1/R²)");
  ok(near(M.meanDensity(5.9722e24, 3189.5e3) / M.meanDensity(5.9722e24, 6379e3), 8, 1e-3), "la mitad del radio da 8 veces la densidad (ρ ∝ 1/R³)");
  ok(near(M.radiusFromDensity(5.9722e24, M.meanDensity(5.9722e24, 1234e3)), 1234e3, 1e-12), "radiusFromDensity invierte meanDensity");
}
console.log("El radio de Schwarzschild marca el límite");
{
  const ME_ = 5.9722e24;
  for (const m of [1e15, ME_, M_SUN_KG, 10 * M_SUN_KG, 60 * M_SUN_KG]) {
    const rs = M.schwarzschildKg(m);
    if (!(near(M.escapeVelocity(m, rs), C, 1e-9))) { ok(false, "v_escape(r_s) = c", String(m)); break; }
  }
  ok(true, "en el radio de Schwarzschild la velocidad de escape (Newton) vale exactamente c, para cualquier masa");
  const rsE = M.schwarzschildKg(ME_);
  ok(M.escapeVelocity(ME_, rsE * 0.99) > C && M.escapeVelocity(ME_, rsE * 1.01) < C, "por debajo de r_s la velocidad de escape supera a c; por encima, no");
  ok(M.densityBand(ME_, rsE) === "bh" && M.densityBand(ME_, rsE * 0.5) === "bh" && M.densityBand(ME_, rsE * 1.1) === "bh", "en r_s, por debajo y hasta 9/8 r_s → agujero negro");
  ok(M.densityBand(ME_, rsE * 1.2) !== "bh" && M.isBlackHole(ME_, rsE * M.BUCHDAHL) && !M.isBlackHole(ME_, rsE * M.BUCHDAHL * 1.001), "el límite de Buchdahl (9/8 r_s) separa el agujero negro del resto");
  ok(near(M.BUCHDAHL, 1.125, 1e-12), "límite de Buchdahl = 9/8");
  ok(M.isRelativistic(M_SUN_KG, 50 * M.schwarzschildKg(M_SUN_KG)) && !M.isRelativistic(M_SUN_KG, R_SUN_), "cerca de r_s Newton deja de valer; en el Sol, sí");
}
console.log("Rótulos por densidad y modo «Elegir yo el tamaño»");
{
  const ME_ = 5.9722e24, B_ = (m, rho) => M.densityBand(m, M.radiusFromDensity(m, rho));
  ok(B_(ME_, 0.01) === "air" && B_(ME_, 1.1) === "air" && B_(ME_, 1.3) === "gas" && B_(ME_, 100) === "gas", "menos de 1,2 kg/m³ → más tenue que el aire; después, gas");
  ok(B_(ME_, 1000) === "water" && B_(M_SUN_KG, 1410) === "water" && B_(MJ_, 1326) === "water", "1.000 kg/m³ (y el Sol y Júpiter) → como el agua");
  ok(B_(ME_, 5514) === "rock" && B_(ME_, 11341) === "rock" && B_(ME_, 11343) === "lead", "la Tierra → roca; 11.342 kg/m³ (plomo) es el límite de «más denso que el plomo»");
  ok(B_(ME_, 1e5) === "lead" && B_(ME_, 1.9e8) === "lead" && B_(ME_, 2.1e8) === "wd", "una enana marrón (10⁵) está entre el plomo y la enana blanca; desde 2 × 10⁸ → enana blanca");
  ok(B_(M_SUN_KG, M.meanDensity(ex("sirius").mass, ex("sirius").R)) === "wd", "la densidad de Sirio B → enana blanca");
  ok(near(M.teaspoonKg(2e8), 1000, 1e-12) && M.teaspoonKg(2.78e9) > 1e4, "a 2 × 10⁸ kg/m³ una cucharadita (5 mL) pesa una tonelada; en Sirio B, más de 10 t");
  ok(B_(M_SUN_KG, 1e13) === "gap" && B_(M_SUN_KG, 1e16 * 1.01) === "ns" && B_(M_SUN_KG, 3.4e17) === "ns", "entre 10¹² y 10¹⁶, sin astros; desde 10¹⁶ → estrella de neutrones");
  ok(M.DENSITY_BANDS.every((b, i, a) => i === 0 || a[i - 1].max < b.max) && M.BAND_IDS.length === 9, "las bandas están ordenadas y son nueve con el agujero negro");
  ok(M.BAND_IDS.every(id => ["es", "en"].every(l => { const x = M.MASS_T[l].lab.size.bands[id]; return x && x.name && x.note; })), "cada banda tiene nombre y nota en ES y EN");
  ok(M.MASS_T.es.lab.size.bands.bh.name.includes("Schwarzschild") && M.MASS_T.es.lab.size.bands.wd.name.includes("toneladas"), "los rótulos piden «radio de Schwarzschild» y «toneladas»");
  // La Tierra comprimida: enana blanca, estrella de neutrones y agujero negro (los atajos del modo)
  ok(M.densityBand(ME_, M.sizePresetRadius("model", ME_)) === "rock", "atajo «modelo»: la Tierra es roca");
  ok(M.densityBand(ME_, M.sizePresetRadius("water", ME_)) === "water" && M.sizePresetRadius("water", ME_) > R_EARTH_, "atajo «como el agua»: la Tierra inflada");
  ok(M.densityBand(ME_, M.sizePresetRadius("wd", ME_)) === "wd" && M.densityBand(ME_, M.sizePresetRadius("ns", ME_)) === "ns" && M.densityBand(ME_, M.sizePresetRadius("bh", ME_)) === "bh", "atajos: la Tierra comprimida a enana blanca, estrella de neutrones y agujero negro");
  ok(near(M.sizePresetRadius("bh", ME_), M.schwarzschildKg(ME_), 1e-12) && within(M.sizePresetRadius("bh", ME_) * 1000, 8.87, 0.01), "atajo «agujero negro»: el radio de Schwarzschild de la Tierra (8,87 mm)");
  ok(M.densityBand(ME_, M.sizePresetRadius("super", ME_)) === "air" && near(M.sizePresetRadius("super", ME_), 764 * R_SUN_, 1e-9), "atajo «supergigante»: la Tierra de 764 R☉ es más tenue que el aire");
  ok(M.SIZE_PRESETS.every(id => ["es", "en"].every(l => M.MASS_T[l].lab.size.presets[id])), "atajos de tamaño con texto ES/EN");
}
console.log("Deslizador de radio (escala logarítmica)");
{
  const ME_ = 5.9722e24;
  const masses = [1e15, ME_, M_SUN_KG, 20 * M_SUN_KG, 60 * M_SUN_KG];
  ok(masses.every(m => near(Math.pow(10, M.sizeSlider(m).min), M.schwarzschildKg(m), 1e-12) && near(Math.pow(10, M.sizeSlider(m).max), 1000 * R_SUN_, 1e-12)), "va del radio de Schwarzschild de la masa elegida a una supergigante (1.000 R☉)");
  ok(masses.every(m => M.sizeSlider(m).min < M.sizeSlider(m).max) && 1000 * R_SUN_ > 764 * R_SUN_, "el rango es válido para todas las masas y llega más allá de Betelgeuse");
  let okAll = true, why = "";
  for (const m of masses) {
    const s = M.sizeSlider(m);
    // ida y vuelta: log → radio → log, sobre toda la rejilla
    for (let l = s.min; l <= s.max + 1e-9; l += 0.37) {
      const sn = M.snapLogR(l, m), R = Math.pow(10, sn);
      if (!Number.isFinite(R) || R <= 0 || sn < s.min - 1e-12 || sn > s.max + 1e-12 || !near(Math.log10(R), sn, 1e-12)) { okAll = false; why = `${m} ${l}`; }
      const g = M.surfaceGravity(m, R), v = M.escapeVelocity(m, R), r = M.meanDensity(m, R);
      if (![g, v, r].every(x => Number.isFinite(x) && x > 0)) { okAll = false; why = `valores ${m} ${l}`; }
      if (!M.BAND_IDS.includes(M.densityBand(m, R))) { okAll = false; why = `banda ${m} ${l}`; }
    }
  }
  ok(okAll, "el deslizador de radio va y vuelve sin error (radio, g, v, ρ y rótulo finitos en todo el rango)", why);
  ok(masses.every(m => M.densityBand(m, Math.pow(10, M.sizeSlider(m).min)) === "bh"), "con el deslizador al mínimo (r_s) siempre sale «agujero negro»");
  ok(masses.every(m => M.densityBand(m, Math.pow(10, M.sizeSlider(m).max)) === "air"), "con el deslizador al máximo (supergigante) siempre sale «más tenue que el aire»");
  ok(M.snapLogR(-99, ME_) === M.sizeSlider(ME_).min && M.snapLogR(99, ME_) === M.sizeSlider(ME_).max && M.clampLogR(99, ME_) === M.sizeSlider(ME_).max, "snapLogR y clampLogR acotan a los extremos");
  ok(near(M.sizeTickPct(M.schwarzschildKg(ME_), ME_), 0, 1e-9) && near(M.sizeTickPct(1000 * R_SUN_, ME_), 100, 1e-9) && M.sizeTickPct(R_EARTH_, ME_) < M.sizeTickPct(R_SUN_, ME_), "marcas del deslizador: r_s al 0 %, supergigante al 100 %, Tierra antes que el Sol");
  // Ida y vuelta de ida a vuelta: cada atajo cae en la rejilla (±medio paso) sin salirse del rango
  ok(M.SIZE_PRESETS.every(id => masses.every(m => { const l = Math.log10(M.sizePresetRadius(id, m)), s = M.sizeSlider(m); return l >= s.min - 1e-12 && l <= s.max + 1e-12 && Math.abs(M.snapLogR(l, m) - l) <= s.step / 2 + 1e-12; })), "los atajos de tamaño caen dentro del rango y a medio paso de la rejilla");
  // Variar el radio de min a max y volver: g baja y sube de forma monótona
  const s = M.sizeSlider(ME_); let gUp = true, prev = Infinity;
  for (let l = s.min; l <= s.max; l += 0.5) { const g = M.surfaceGravity(ME_, Math.pow(10, l)); if (!(g < prev)) gUp = false; prev = g; }
  prev = 0; for (let l = s.max; l >= s.min; l -= 0.5) { const g = M.surfaceGravity(ME_, Math.pow(10, l)); if (!(g > prev)) gUp = false; prev = g; }
  ok(gUp, "al subir el radio la gravedad baja y al volver sube, sin saltos ni errores");
}
console.log("Textos de la tarjeta nueva y del modo de tamaño");
{
  const sizeKeys = (l) => keysOf(M.MASS_T[l].lab.size).sort().join();
  ok(sizeKeys("es") === sizeKeys("en"), "lab.size: ES y EN con las mismas claves");
  ok(keysOf(M.MASS_T.es.big).sort().join() === keysOf(M.MASS_T.en.big).sort().join(), "big: ES y EN con las mismas claves");
  const SZ = M.MASS_T.es.lab.size;
  ok(SZ.toggle === "Elegir yo el tamaño" && M.MASS_T.es.big.title === "Más masa no siempre es más grande", "textos pedidos: «Elegir yo el tamaño» y «Más masa no siempre es más grande»");
  ok(M.MASS_T.es.lab.size.vsSmaller("2", "4", "8").includes("2 veces menor") && M.MASS_T.en.lab.size.vsBigger("2", "4", "8").includes("2 times bigger"), "frases «frente al modelo» en ES y EN");
  ok(["g", "kg", "t"].every(u => ["es", "en"].every(l => M.MASS_T[l].lab.size.units[u].length === 2)), "unidades de la cucharadita con singular y plural");
  ok(["es", "en"].every(l => /Más masa|More mass/.test(M.MASS_T[l].big.title) && !/NaN|undefined/.test(JSON.stringify(M.MASS_T[l].big.pairs))), "textos de las comparaciones sin NaN ni undefined");
  ok(["es", "en"].every(l => M.MASS_T[l].assumptions.items.some(i => /Buchdahl/.test(i)) && M.MASS_T[l].assumptions.items.some(i => /10¹⁶/.test(i)) && M.MASS_T[l].assumptions.items.some(i => /1\.000|1,000/.test(i))), "«Supuestos» declara los umbrales de densidad, el límite de Buchdahl y el tope del deslizador");
  ok(Object.keys(M.MASS_REFS).includes("joyce2018") && Object.keys(M.MASS_REFS).includes("bond2017") && /arxiv\.org\/abs\/1806\.00061/.test(M.MASS_REFS.joyce2018.url), "Sirio B cita a Joyce et al. 2018 (MNRAS) y Bond et al. 2017");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
