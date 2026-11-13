// Pruebas de las funciones puras y de los datos de los recorridos nuevos de la
// pestaña "Preguntas" (agujeros negros, expansión, materia oscura, índice).
// Uso:  node scripts/test_questions_tours.mjs   (sale con código 1 si algo falla)
import fs from "node:fs";
import {
  schwarzschildRadiusM, meanDensity, staticClockRate, farTime, SHADOW_IN_RS, shadowAngularDiameterMuas,
  tidalAcceleration, tidalAtHorizon, circularSpeed,
  hubbleTimeGyr, expansionRate, timeToScale, ageGyr, flatLambdaAgeH0, deceleration, scaleCurve,
  slopeThroughOrigin, rmsResidual, sigmaTension,
  visibleSpeed, haloMassWithin, haloSpeed, totalSpeed, dynamicalMass, keplerSpeedGalactic, rotationModel, reducedChi2, rmsSpeed,
  readNumber, parseRoute,
} from "../src/questions/physics.js";
import * as K from "../src/questions/constants.js";
import { length, duration, mass, quantity, times } from "../src/questions/units.js";
import { BH_REFS, BH_T, PRESETS, SIZE_LADDER, EHT, MASS_SLIDER, DIST_SLIDER, BH_NEXT, nearestSize } from "../src/questions/bhData.js";
import { EXP_REFS, EXP_T, SUPERNOVAE, PLANCK, SH0ES, KEY_PROJECT, H0_SLIDER, OL_SLIDER, TESEO_GALAXY_H0, TESEO_GALAXY_COUNT, EXP_NEXT } from "../src/questions/expansionData.js";
import { DM_REFS, DM_T, NGC3198, GALAXY, UPSILON, HALO, VISIBLE_MASS, PLANETS, PLANET_NAMES, budget, DM_NEXT } from "../src/questions/darkMatterData.js";
import { TQ } from "../src/questions/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b));
const eq = (a, b, name) => ok(a === b, name, `→ obtuvo ${JSON.stringify(a)}, esperaba ${JSON.stringify(b)}`);
const keysOf = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keysOf(v, `${pre}${k}.`) : [`${pre}${k}`]));
const readJson = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));

console.log("Constantes (CODATA / IAU)");
eq(K.G, 6.67430e-11, "G = 6,67430e-11 (CODATA)");
eq(K.C, 299792458, "c exacta");
eq(K.GM_SUN, 1.3271244e20, "(GM)☉ nominal IAU 2015");
eq(K.GM_EARTH, 3.986004e14, "(GM)⊕ nominal IAU 2015");
eq(K.AU, 149597870700, "ua exacta (IAU 2012)");
ok(near(K.PC, 3.0856775814913673e16, 1e-12), "pársec = 648000/π ua", String(K.PC));
ok(near(K.LY, 9.4607304725808e15, 1e-12), "año luz = c × año juliano", String(K.LY));
ok(near(K.M_SUN_KG, 1.98841e30, 1e-5), "masa del Sol = GM/G ≈ 1,98841e30 kg", String(K.M_SUN_KG));
ok(near(K.MPC_IN_LY, 3.2616e6, 1e-4), "1 Mpc ≈ 3,2616 millones de años luz", String(K.MPC_IN_LY));
ok(near(K.G_GALACTIC, 4.30091e-6, 1e-5), "G = 4,30091e-6 kpc·(km/s)²/M☉", String(K.G_GALACTIC));

console.log("Agujeros negros: radio de Schwarzschild");
ok(near(schwarzschildRadiusM(1), 2953.25, 1e-5), "Sol → r_s ≈ 2,95 km", String(schwarzschildRadiusM(1)));
ok(near(schwarzschildRadiusM(K.EARTH_IN_SUNS), 8.870e-3, 1e-4), "Tierra → r_s ≈ 8,87 mm", String(schwarzschildRadiusM(K.EARTH_IN_SUNS)));
ok(near(schwarzschildRadiusM(4.297e6), 1.26901e10, 1e-5), "Sgr A* (4,297e6 M☉) → r_s ≈ 1,269e7 km", String(schwarzschildRadiusM(4.297e6)));
ok(near(schwarzschildRadiusM(4.297e6) / K.AU, 0.0848, 2e-3), "Sgr A* → r_s ≈ 0,085 ua (cabe dentro de la órbita de Mercurio)");
ok(near(schwarzschildRadiusM(6.5e9) / K.AU, 128.3, 2e-3), "M87* (6,5e9 M☉) → r_s ≈ 128 ua", String(schwarzschildRadiusM(6.5e9) / K.AU));
ok(near(schwarzschildRadiusM(10) / schwarzschildRadiusM(1), 10), "r_s es proporcional a la masa");
ok(near(schwarzschildRadiusM(1), 2 * K.G * K.M_SUN_KG / (K.C * K.C), 1e-12), "coincide con 2GM/c² usando G y M por separado");

console.log("Agujeros negros: densidad, tiempo, sombra, marea");
ok(near(meanDensity(1), 1.843e19, 1e-3), "densidad media de un Sol-agujero negro ≈ 1,84e19 kg/m³", String(meanDensity(1)));
ok(near(meanDensity(10) * 100, meanDensity(1), 1e-9), "la densidad media cae como 1/M²");
ok(meanDensity(4.297e6) > 1000 && meanDensity(6.5e9) < 1.2, "Sgr A* es más denso que el agua; M87* menos que el aire");
ok(near(meanDensity(1), 3 * K.C ** 6 / (32 * Math.PI * K.G ** 3 * K.M_SUN_KG ** 2), 1e-12), "densidad = 3c⁶/(32πG³M²)");
eq(staticClockRate(1), null, "en el horizonte no hay observador estático → null");
eq(staticClockRate(0.5), null, "dentro del horizonte → null");
eq(staticClockRate(NaN), null, "distancia inválida → null");
ok(near(staticClockRate(2), Math.SQRT1_2), "a 2 r_s el reloj va a √(1/2) ≈ 0,707");
ok(near(staticClockRate(4 / 3), 0.5), "a 4/3 r_s el reloj va a la mitad");
ok(near(farTime(3600, 4 / 3), 7200), "a 4/3 r_s, 1 hora propia = 2 horas lejos");
ok(near(farTime(3600, 1.5), 3600 * Math.sqrt(3)), "a 1,5 r_s, 1 hora = √3 horas");
ok(Math.abs(staticClockRate(1e9) - 1) < 1e-9, "muy lejos el factor tiende a 1");
ok(farTime(3600, 1.000001) > 3.5e6, "a una millonésima de r_s del horizonte, 1 hora ≈ 1.000 horas");
eq(farTime(3600, 1), null, "tiempo lejano en el horizonte → null (no un número inventado)");
ok(near(SHADOW_IN_RS, 5.196152, 1e-6), "sombra = √27 r_s ≈ 5,196 r_s");
const sgr = EHT.find(o => o.id === "sgra"), m87 = EHT.find(o => o.id === "m87");
const sgrCalc = shadowAngularDiameterMuas(sgr.mass, sgr.distanceM), m87Calc = shadowAngularDiameterMuas(m87.mass, m87.distanceM);
ok(near(sgrCalc, 53.25, 1e-3), "Sgr A*: sombra calculada ≈ 53,3 µas", String(sgrCalc));
ok(Math.abs(sgrCalc - sgr.shadow) < sgr.shadowErr, "Sgr A*: dentro del error de la sombra medida por el EHT (48,7 ± 7,0)");
ok(Math.abs(sgrCalc - sgr.ring) < 2 * sgr.ringErr, "Sgr A*: a menos de 2σ del anillo medido (51,8 ± 2,3)");
ok(near(m87Calc, 39.69, 1e-3), "M87*: sombra calculada ≈ 39,7 µas", String(m87Calc));
ok(Math.abs(m87Calc - m87.ring) < m87.ringErr, "M87*: dentro del error del anillo medido (42 ± 3)");
ok(sgr.independent === true && m87.independent === false, "se declara que la masa de M87* no es independiente de la imagen");
ok(near(tidalAtHorizon(1, 2), K.C ** 6 * 2 / (4 * K.GM_SUN ** 2), 1e-12), "marea en el horizonte = c⁶h/(4G²M²)");
ok(near(tidalAtHorizon(1, 2), 2.061e10, 1e-3), "Sol-agujero negro: ≈ 2,06e10 m/s² entre cabeza y pies", String(tidalAtHorizon(1, 2)));
ok(tidalAtHorizon(4.297e6, 2) < 0.01 * K.G0, "Sgr A*: marea en el horizonte imperceptible");
ok(near(tidalAtHorizon(10, 2) * 100, tidalAtHorizon(1, 2), 1e-9), "la marea en el horizonte cae como 1/M²");
ok(near(tidalAcceleration(K.EARTH_IN_SUNS, K.R_EARTH, 1), 2 * K.G0 / K.R_EARTH, 2e-3), "marea terrestre por metro ≈ 2g/R");
ok(near(circularSpeed(K.GM_SUN, K.AU), 29784.7, 1e-5), "velocidad kepleriana de la Tierra ≈ 29,78 km/s", String(circularSpeed(K.GM_SUN, K.AU)));

console.log("Agujeros negros: datos");
const layer = readJson("../public/blackholes.json").objects;
for (const p of PRESETS.filter(x => x.real)) {
  const o = layer.find(x => x.name === p.name);
  ok(!!o && Math.abs(o.mass_sun / p.mass - 1) < 0.03, `${p.name}: la masa de blackholes.json coincide con la publicada (±3 %)`, o ? `${o.mass_sun} vs ${p.mass}` : "no está en el JSON");
  ok(!!BH_REFS[p.ref] && ["measured", "estimated"].includes(p.level), `${p.name}: tiene fuente y nivel de certeza`);
}
ok(near(Math.pow(10, MASS_SLIDER.min), K.EARTH_IN_SUNS) && near(Math.pow(10, MASS_SLIDER.max), 6.6e10), "deslizador de masa: de la Tierra a TON 618");
ok(PRESETS.every(p => Math.log10(p.mass) >= MASS_SLIDER.min - 1e-9 && Math.log10(p.mass) <= MASS_SLIDER.max + 1e-9), "todos los preajustes caben en el deslizador");
ok(SIZE_LADDER.every((o, i) => i === 0 || o.d > SIZE_LADDER[i - 1].d), "escalera de tamaños ordenada");
eq(nearestSize(2 * schwarzschildRadiusM(K.EARTH_IN_SUNS)).obj.id, "marble", "Tierra-agujero negro ≈ una canica");
eq(nearestSize(2 * schwarzschildRadiusM(21.2)).obj.id, "city", "Cygnus X-1 ≈ una ciudad");
eq(nearestSize(2 * schwarzschildRadiusM(6.5e9)).obj.id, "neptune", "M87* ≈ la órbita de Neptuno");
ok(DIST_SLIDER.min < DIST_SLIDER.start && DIST_SLIDER.start < DIST_SLIDER.max, "deslizador de distancia coherente");

console.log("Expansión");
ok(near(hubbleTimeGyr(70), 13.968, 1e-4), "1/H0 con H0 = 70 → 13,97 Ga", String(hubbleTimeGyr(70)));
ok(near(hubbleTimeGyr(67.4), 14.507, 1e-4), "1/H0 con H0 = 67,4 → 14,51 Ga", String(hubbleTimeGyr(67.4)));
const agePlanck = ageGyr(67.4, 0.315, 0.685);
ok(Math.abs(agePlanck - 13.8) < 0.02, "edad con Planck (Ωm 0,315, ΩΛ 0,685, H0 67,4) ≈ 13,8 Ga", String(agePlanck));
ok(Math.abs(ageGyr(67.36, 0.3153, 0.6847) - 13.797) < 0.03, "con los valores de tabla (67,36; 0,3153; 0,6847) ≈ 13,797 ± 0,023 publicado", String(ageGyr(67.36, 0.3153, 0.6847)));
ok(Math.abs(agePlanck - PLANCK.ageGyr) <= PLANCK.ageErr, "coincide con la edad que muestra la interfaz");
for (const Om of [0.1, 0.315, 0.6, 0.9]) ok(near(timeToScale(1, Om, 1 - Om), flatLambdaAgeH0(Om), 1e-6), `integración numérica = solución exacta (Ωm = ${Om})`, `${timeToScale(1, Om, 1 - Om)} vs ${flatLambdaAgeH0(Om)}`);
ok(near(timeToScale(1, 1, 0), 2 / 3, 1e-7), "solo materia (Einstein–de Sitter): edad = 2/(3·H0)", String(timeToScale(1, 1, 0)));
ok(near(ageGyr(67.4, 1, 0), 9.6715, 1e-4), "sin energía oscura y H0 = 67,4 → 9,67 Ga", String(ageGyr(67.4, 1, 0)));
ok(near(timeToScale(0.5, 1, 0), (2 / 3) * Math.pow(0.5, 1.5), 1e-6), "Einstein–de Sitter: t ∝ a^(3/2)");
eq(timeToScale(0, 0.3, 0.7), 0, "a = 0 → t = 0");
ok(Number.isNaN(timeToScale(1, 0, 1)), "sin materia la integral diverge → NaN, no un número inventado");
ok(near(expansionRate(1, 0.315, 0.685), 1), "hoy (a = 1) H = H0");
ok(deceleration(0.315, 0.685) < 0 && deceleration(1, 0) > 0, "con Planck la expansión se acelera; solo con materia se frena");
ok(near(deceleration(2 / 3, 1 / 3), 0), "ΩΛ = 1/3 → ni acelera ni frena");
const curve = scaleCurve(67.4, 0.315, 0.685, 3);
ok(curve[0].t === 0 && curve[0].a === 0 && curve.every((p, i) => i === 0 || (p.t > curve[i - 1].t && p.a > curve[i - 1].a)), "a(t) crece de forma monótona desde 0");
ok(near(curve[curve.length - 1].a, 3), "la curva llega al tamaño pedido");
eq(SUPERNOVAE.length, 36, "36 supernovas (Freedman et al. 2001, tabla 6)");
ok(SUPERNOVAE.every(p => p.v > 0 && p.d > 0 && /^SN \d{4}[A-Za-z]{1,2}$/.test(p.name)), "cada supernova tiene nombre, velocidad y distancia");
const s90 = SUPERNOVAE.find(p => p.name === "SN 1990O"), s92 = SUPERNOVAE.find(p => p.name === "SN 1992aq");
ok(s90.v === 9065 && s90.d === 134.7 && s92.v === 30253 && s92.d === 467.0, "valores de muestra idénticos a la tabla publicada");
ok(near(s90.v / s90.d, 67.3, 1e-3) && near(s92.v / s92.d, 64.7, 3e-3), "v/d reproduce la columna H0 de la tabla (67,3 y 64,7)");
const best = slopeThroughOrigin(SUPERNOVAE);
ok(Math.abs(best - KEY_PROJECT.H0) < KEY_PROJECT.random, "ajuste de Teseo (≈70,7) a menos de 2 del valor publicado (71 ± 2 ± 6)", String(best));
ok(rmsResidual(SUPERNOVAE, best) < rmsResidual(SUPERNOVAE, best + 3) && rmsResidual(SUPERNOVAE, best) < rmsResidual(SUPERNOVAE, best - 3), "el mejor ajuste minimiza el desajuste");
ok(near(slopeThroughOrigin([{ d: 1, v: 70 }, { d: 2, v: 140 }]), 70), "recta exacta → pendiente exacta");
eq(rmsResidual([{ d: 1, v: 70 }, { d: 2, v: 140 }], 70), 0, "recta exacta → desajuste 0");
ok(Number.isNaN(slopeThroughOrigin([])), "sin puntos → NaN");
ok(near(sigmaTension(SH0ES.H0, SH0ES.H0err, PLANCK.H0, PLANCK.H0err), 4.89, 2e-3), "tensión de Hubble: 73,04 ± 1,04 frente a 67,4 ± 0,5 → 4,9σ");
ok(H0_SLIDER.min < best && best < H0_SLIDER.max && Math.abs(H0_SLIDER.start - best) > 10, "el deslizador empieza lejos del ajuste (hay algo que ajustar)");
ok(OL_SLIDER.max < 1, "siempre queda algo de materia (el modelo la necesita)");
const gal = readJson("../public/galaxies.json");
eq(gal.meta.count, TESEO_GALAXY_COUNT, "número de galaxias de Teseo = meta.count del JSON");
ok(new RegExp(`H0=${TESEO_GALAXY_H0}\\b`).test(gal.meta.distance), "el JSON declara que su distancia sale de la ley de Hubble con H0 = 70 (circularidad)");
ok(gal.objects.every(o => !("v" in o) && !("radvel" in o) && !("z" in o)), "el JSON no trae velocidades: no puede ser un diagrama de Hubble independiente");

console.log("Materia oscura");
eq(NGC3198.length, 43, "43 puntos de NGC 3198 (SPARC)");
ok(NGC3198.every((p, i) => p.r > 0 && p.v > 0 && p.e > 0 && (i === 0 || p.r > NGC3198[i - 1].r)), "radios crecientes, velocidades y errores positivos");
const last = NGC3198[NGC3198.length - 1];
ok(last.r === 44.08 && last.v === 149 && last.e === 3 && last.vgas === 47.84 && last.vdisk === 61.63, "último punto idéntico a la tabla publicada");
ok(NGC3198[0].r === 0.32 && NGC3198[0].v === 24.4, "primer punto idéntico a la tabla publicada");
eq(HALO.rRef, last.r, "la masa del halo se define dentro del último punto medido");
const outer = NGC3198.filter(p => p.r > 20);
ok(Math.abs(outer.reduce((s, p) => s + p.v, 0) / outer.length - GALAXY.vFlat) < GALAXY.vFlatErr, "la curva medida es plana: media exterior ≈ V_plana de SPARC (150,1 ± 3,9)");
ok(near(visibleSpeed(0, 100, 0.5), 100 * Math.SQRT1_2), "V_vis con Υ = 0,5: √0,5 · V_disco");
eq(visibleSpeed(-10, 0, 0.5), 0, "gas con signo negativo y sin disco → 0, no NaN");
ok(near(visibleSpeed(last.vgas, last.vdisk, UPSILON), 64.713, 1e-4), "materia visible en el último punto ≈ 64,7 km/s", String(visibleSpeed(last.vgas, last.vdisk, UPSILON)));
ok(near(haloMassWithin(HALO.rRef, 2e11, HALO.rRef, HALO.rc), 2e11), "el halo encierra la masa pedida en el radio de referencia");
eq(haloSpeed(10, 0, HALO.rRef, HALO.rc), 0, "sin halo → 0 km/s");
ok(near(haloSpeed(HALO.rRef, 2e11, HALO.rRef, HALO.rc), keplerSpeedGalactic(2e11, HALO.rRef)), "en el radio de referencia V_halo = √(GM/r)");
ok(haloSpeed(30, 2e11, HALO.rRef, HALO.rc) / haloSpeed(15, 2e11, HALO.rRef, HALO.rc) > 1 && haloSpeed(30, 2e11, HALO.rRef, HALO.rc) / haloSpeed(15, 2e11, HALO.rRef, HALO.rc) < 1.1, "lejos del núcleo el halo da una velocidad casi plana");
ok(near(totalSpeed(3, 4), 5), "las componentes se suman en cuadratura");
ok(near(dynamicalMass(last.v, last.r), 2.275e11, 1e-3), "masa dinámica dentro de 44 kpc ≈ 2,3e11 M☉", String(dynamicalMass(last.v, last.r)));
ok(near(keplerSpeedGalactic(dynamicalMass(150, 30), 30), 150), "masa dinámica y velocidad kepleriana son inversas");
ok(near(VISIBLE_MASS, 3.36e10, 2e-3), "masa visible (estrellas + gas) ≈ 3,4e10 M☉", String(VISIBLE_MASS));
const model = (m) => rotationModel(NGC3198, { upsilon: UPSILON, haloMass: m, rRef: HALO.rRef, rc: HALO.rc });
ok(near(rmsSpeed(NGC3198, model(0)), 56.1, 1e-3), "sin halo el modelo falla por ≈ 56 km/s", String(rmsSpeed(NGC3198, model(0))));
let bestM = 0, bestR = Infinity;
for (let m = HALO.min; m <= HALO.max; m += HALO.step) { const r = rmsSpeed(NGC3198, model(m)); if (r < bestR) { bestR = r; bestM = m; } }
ok(near(bestM, 1.9e11, 0.06) && bestR < 6, "mejor ajuste del deslizador ≈ 1,9e11 M☉ con desajuste < 6 km/s", `${bestM} ${bestR}`);
ok(reducedChi2(NGC3198, model(bestM)) < 2, "χ² reducido del mejor ajuste < 2", String(reducedChi2(NGC3198, model(bestM))));
ok(model(0)[42].model < 70 && model(bestM)[42].model > 140, "en el borde: 65 km/s sin halo, ≈150 con halo");
ok(model(HALO.max).every(p => p.model < 215), "ni con el halo máximo se sale del gráfico");
eq(PLANETS.length, 8, "ocho planetas");
ok(PLANETS.find(p => p.id === "mercury").v === 47.4 && PLANETS.find(p => p.id === "neptune").v === 5.4, "Mercurio 47,4 km/s y Neptuno 5,4 km/s (NASA)");
ok(PLANETS.every(p => Math.abs(circularSpeed(K.GM_SUN, p.d * 1e9) / 1000 / p.v - 1) < 0.02), "cada planeta cumple v = √(GM/r) a menos del 2 %");
const b = budget();
ok(near(b.ordinary, 0.0493, 2e-3) && near(b.dark, 0.2645, 1e-3) && b.energy === 0.6847, "presupuesto de Planck: 4,9 % / 26,4 % / 68,5 %", JSON.stringify(b));
ok(b.rest > 0 && b.rest < 0.003, "lo que falta para 100 % es < 0,3 % (neutrinos)");

console.log("Formato de magnitudes");
eq(length(schwarzschildRadiusM(K.EARTH_IN_SUNS), "es"), "8,87 mm", "es: 8,87 mm");
eq(length(schwarzschildRadiusM(1), "es"), "2,95 km", "es: 2,95 km");
eq(length(schwarzschildRadiusM(1), "en"), "2.95 km", "en: 2.95 km");
eq(length(schwarzschildRadiusM(4.297e6), "es"), "12,7 millones de km", "es: Sgr A* 12,7 millones de km");
eq(length(schwarzschildRadiusM(6.5e9), "es"), "128 ua", "es: M87* 128 ua");
eq(length(schwarzschildRadiusM(6.5e9), "en"), "128 au", "en: M87* 128 au");
eq(length(0.5, "es"), "50 cm", "50 cm");
eq(length(26000 * K.LY, "es"), "26.000 años luz", "26.000 años luz");
eq(length(-1, "es"), "—", "longitud inválida → raya");
eq(duration(3600, "es"), "1 h", "1 hora");
eq(duration(7200, "en"), "2 h", "2 hours");
eq(duration(5091, "es"), "1 h 25 min", "1 h 25 min");
eq(duration(90, "es"), "1 min 30 s", "1 min 30 s");
eq(duration(86400 * 1.5, "es"), "1 día 12 h", "1 día 12 h");
eq(duration(86400 * 3, "en"), "3 days", "3 days");
eq(duration(365.25 * 86400 * 2, "es"), "2 años", "2 años");
eq(duration(NaN, "es"), "—", "duración inválida → raya");
eq(mass(K.EARTH_IN_SUNS, "es"), "1 masa de la Tierra", "1 masa de la Tierra");
eq(mass(1, "en"), "1 solar mass", "1 solar mass");
eq(mass(21.2, "es"), "21 masas solares", "21 masas solares");
eq(mass(4.3e6, "es"), "4,3 millones de masas solares", "4,3 millones de masas solares");
eq(mass(6.5e9, "en"), "6.5 billion solar masses", "6.5 billion solar masses");
eq(quantity(1000, "es"), "1.000", "cantidad 1.000");
eq(quantity(1.84e19, "es"), "1,8 × 10¹⁹", "cantidad en notación científica");
eq(times(2.4, "es"), "2,4", "2,4 veces");
eq(times(5.07e7, "es"), "51 millones de", "51 millones de veces");

console.log("Rutas y estado compartible");
const ids = ["bh", "expansion", "dm", "drake"];
eq(parseRoute("#preguntas", ids).id, null, "#preguntas → índice");
ok(parseRoute("#preguntas", ids).match, "#preguntas es de esta pestaña");
eq(parseRoute("#questions?q=bh&m=6.63", ids).id, "bh", "#questions?q=bh → agujeros negros");
eq(parseRoute("#preguntas?q=bh&m=6.63", ids).params.get("m"), "6.63", "conserva los parámetros");
eq(parseRoute("#preguntas?drake=1.5,1,0.4,1,1,0.1,1000", ids).id, "drake", "enlace antiguo ?drake=… → ¿Estamos solos?");
eq(parseRoute("#preguntas?q=drake&drake=1.5,1,0.4,1,1,0.1,1000&kp=16", ids).id, "drake", "enlace nuevo de Drake");
eq(parseRoute("#preguntas?q=nope", ids).id, null, "recorrido desconocido → índice");
ok(parseRoute("#sky?L=blackholes", ids).match === false, "#sky no es de esta pestaña");
ok(parseRoute("#preguntasx", ids).match === false && parseRoute(undefined, ids).match === false, "hash ajeno o ausente → no coincide");
eq(readNumber("70.5", 40, 100), 70.5, "número válido");
eq(readNumber("500", 40, 100), 100, "se acota al máximo");
eq(readNumber("-3", 40, 100), 40, "se acota al mínimo");
eq(readNumber("abc", 40, 100), null, "texto → null");
eq(readNumber("", 40, 100), null, "vacío → null");
eq(readNumber(null, 40, 100), null, "ausente → null");

console.log("Textos, fuentes y enlaces");
for (const [name, T] of [["agujeros negros", BH_T], ["expansión", EXP_T], ["materia oscura", DM_T]]) {
  eq(keysOf(T.es).sort().join(), keysOf(T.en).sort().join(), `${name}: ES y EN tienen las mismas claves`);
}
eq(keysOf(TQ.es).sort().join(), keysOf(TQ.en).sort().join(), "índice: ES y EN tienen las mismas claves");
ok(ids.every(id => TQ.es.tours[id] && TQ.en.tours[id] && TQ.es.tours[id].title && TQ.en.tours[id].teaser), "cada recorrido tiene tarjeta en el índice (ES y EN)");
for (const [name, R] of [["agujeros negros", BH_REFS], ["expansión", EXP_REFS], ["materia oscura", DM_REFS]]) {
  ok(Object.values(R).every(r => r.cite && /^https:\/\//.test(r.url)), `${name}: todas las referencias tienen cita y URL https`);
}
for (const [name, L] of [["agujeros negros", BH_NEXT], ["expansión", EXP_NEXT], ["materia oscura", DM_NEXT]]) {
  ok(L.length >= 3 && L.every(l => /^https:\/\//.test(l.url) && l.label.es && l.label.en && l.note.es && l.note.en), `${name}: «Para seguir» con enlaces https y textos ES/EN`);
}
ok(EHT.every(o => o.refs.every(r => BH_REFS[r]) && /^https:\/\/www\.eso\.org\//.test(o.image)), "EHT: fuentes y enlace a la imagen oficial (no se incrusta)");
ok(Object.keys(PLANET_NAMES.es).length === 8 && Object.keys(PLANET_NAMES.en).length === 8, "nombres de planetas ES/EN");

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
