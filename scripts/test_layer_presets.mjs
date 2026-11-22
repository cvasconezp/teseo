// Pruebas: grupos de capas (src/sky/layerPresets.js).
import { DEFAULT_LAYERS, LAYER_PRESETS, PRESET_T, presetState, presetOf } from "../src/sky/layerPresets.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FALLA:", m); } };
const KEYS = ["photo", "ngc", "minor", "comets", "probes", "messier", "galaxies", "deepfields", "blackholes", "meteors", "caldwell", "oddities", "specialstars", "pulsars", "exoplanets"];
const basic = presetState("basic", KEYS), ess = presetState("essential", KEYS), adv = presetState("advanced", KEYS);
ok(DEFAULT_LAYERS.every((k) => basic[k]) && !basic.pulsars && !basic.meteors && Object.keys(basic).length === KEYS.length, "básicas: las de siempre, el resto apagado");
ok(ess.photo && ess.messier && !ess.galaxies && KEYS.every((k) => adv[k]), "imprescindibles: pocas; avanzadas: todas");
ok(presetOf(basic, KEYS) === "basic" && presetOf(ess, KEYS) === "essential" && presetOf(adv, KEYS) === "advanced", "reconoce el grupo encendido");
ok(presetOf({ ...basic, pulsars: true }, KEYS) === null && presetOf(basic, KEYS, false) === null && presetState("nope", KEYS) === null, "elección propia, sin planetas o grupo inexistente: ninguno");
ok(LAYER_PRESETS.every((p) => PRESET_T.es[p.id] && PRESET_T.en[p.id] && PRESET_T.es.hint[p.id] && PRESET_T.en.hint[p.id]), "textos en los dos idiomas");
console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
if (fail) process.exit(1);
