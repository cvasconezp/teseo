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
const prof = dayProfile(0.05, -78.15, new Date(Date.UTC(2026, 2, 20, 17)), 48, "America/Guayaquil");   // en hora de Ecuador, sea cual sea la zona del equipo
const noon = prof[24].alt, midnight = prof[0].alt;
ok(prof.length === 49 && noon > 80 && midnight < -60, `en el ecuador, en el equinoccio: el Sol casi en el cenit a mediodía (${noon.toFixed(1)}°) y bajo el horizonte a medianoche`);
ok(phaseName(prof, 12 * 60) === "Día" && phaseName(prof, 0) === "Noche" && phaseName(prof, 18 * 60 + 25) === "Atardecer" && phaseName(prof, 5 * 60 + 50) === "Amanecer", "Día, Noche, Atardecer y Amanecer");
ok(/linear-gradient/.test(dayGradient(prof)) && dayGradient(null).startsWith("linear-gradient") && phaseColor(30) === "rgb(44,111,138)" && phaseColor(-30) === "rgb(6,8,12)", "la barra del día con sus colores");
ok(dayProfile(null, null, new Date()) === null, "sin lugar, sin fases");

const sky = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/<ArRail /.test(sky) && /<TimeSheet /.test(sky) && /openPanel\("location"\)/.test(sky) && /openPanel\("layers"\)/.test(sky), "en el modo apuntar, a la derecha: tiempo, lugar, capas y buscar");
ok(/help=\{false\}/.test(sky), "la ayuda de alinear el norte ya no sale sola");
ok(/const railView = !!\(sky && !tourActive && !arBar\)/.test(sky) && /onTour=\{\(\) => \{ setTsOpen\(false\); startTour\(\); \}\}/.test(sky) && /!tourActive && !railView && \(\s*<Dock/.test(sky), "al mirar arrastrando (teléfono y ordenador), la misma columna (con el tour) en lugar de la barra de abajo");
ok((sky.match(/!covered && !railOpen && \(\s*<ArRail/g) || []).length === 2 && /if \(railOpen\) setTsOpen\(false\)/.test(sky), "con el menú «…» abierto, la columna y el tiempo se apartan");

ok(/panel === "time" && \([\s\S]{0,200}<TimeSheet [\s\S]{0,400}docked extra=/.test(sky) && !/<TimePanel /.test(sky), "«Ahora» abre el mismo control de tiempo (ya no el panel antiguo)");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"), css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
ok(/<SkyView lang=\{lang\} onMenu=/.test(app) && /function AppMenu\(/.test(app) && /className="sk-menu-btn"/.test(sky), "en el teléfono, en Cielo: botón ☰ con las secciones, la música, la visión nocturna y el idioma");
ok(/\.app--sky \.app__body > header\.shell, \.app--sky \.tabs \{ display: none; \}/.test(css), "y sin cabecera ni pestañas: la vista ocupa toda la pantalla");
ok(/const \[tab,\s*setTab\]\s*= useState\("sky"\)/.test(app), "la pantalla principal (sin enlace) es el Cielo, después de la animación");
ok(/teseo_place_asked_v1/.test(sky) && /welcome=\{welcomePlace\}/.test(sky) && /if \(welcomePlace && sky\) setPanel\("location"\)/.test(sky), "la primera vez, lo primero que se pide es la ubicación (y no se vuelve a pedir)");
ok(/welcomeSkip: "Ahora no \(usar Quito\)"/.test(sky) && /!place0\.isDefault \|\| !place0\.local/.test(sky), "con «Ahora no» sigue con Quito; quien ya eligió lugar o llega con un enlace no lo ve");
console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
