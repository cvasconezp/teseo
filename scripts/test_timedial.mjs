// Pruebas del control de tiempo tipo Stellarium (src/sky/timeDial.js) y de su lugar en el modo apuntar.
import { RATES, REAL, rateLabel, stepField, phaseOf, dayProfile, dayGradient, phaseName, phaseColor } from "../src/sky/timeDial.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };

ok(RATES[REAL] === 1 / 60 && RATES.includes(0) && RATES[0] === -1440 && RATES[RATES.length - 1] === 1440, "velocidades de −1 día a +1 día por segundo, con pausa y tiempo real");
ok(rateLabel(0) === "En pausa" && rateLabel(1 / 60) === "Tiempo real" && rateLabel(60) === "+1 hora por segundo" && rateLabel(-1440, "en") === "−1 day per second", "textos de la velocidad");
const d = new Date(2026, 0, 31, 23, 59);
ok(stepField(d, "minute", 1).getDate() === 1 && stepField(d, "minute", 1).getMonth() === 1, "un minuto más pasa al día siguiente");
ok(stepField(d, "month", 1).getMonth() === 1 && stepField(d, "month", 1).getDate() === 28, "31 de enero + 1 mes → 28 de febrero");
ok(stepField(new Date(2028, 1, 29, 12), "year", 1).getDate() === 28, "29 de febrero + 1 año → 28 de febrero");
ok(stepField(d, "hour", -1).getHours() === 22 && stepField(d, "day", 1).getDate() === 1, "hora y día");
ok(phaseOf(10) === "day" && phaseOf(-6) === "twilight" && phaseOf(-30) === "night", "fases del Sol");
const prof = dayProfile(0.05, -78.15, new Date(2026, 2, 20, 12), 48);
const noon = prof[24].alt, midnight = prof[0].alt;
ok(prof.length === 49 && noon > 80 && midnight < -60, `en el ecuador, en el equinoccio: el Sol casi en el cenit a mediodía (${noon.toFixed(1)}°) y bajo el horizonte a medianoche`);
ok(phaseName(prof, 12 * 60) === "Día" && phaseName(prof, 0) === "Noche" && phaseName(prof, 18 * 60 + 25) === "Atardecer" && phaseName(prof, 5 * 60 + 50) === "Amanecer", "Día, Noche, Atardecer y Amanecer");
ok(/linear-gradient/.test(dayGradient(prof)) && dayGradient(null).startsWith("linear-gradient") && phaseColor(30) === "rgb(44,111,138)" && phaseColor(-30) === "rgb(6,8,12)", "la barra del día con sus colores");
ok(dayProfile(null, null, new Date()) === null, "sin lugar, sin fases");

const sky = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/<ArRail /.test(sky) && /<TimeSheet /.test(sky) && /openPanel\("location"\)/.test(sky) && /openPanel\("layers"\)/.test(sky), "en el modo apuntar, a la derecha: tiempo, lugar, capas y buscar");
ok(/help=\{false\}/.test(sky), "la ayuda de alinear el norte ya no sale sola");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
