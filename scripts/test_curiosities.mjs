// Pruebas: «¿Sabías que…?» (src/sky/curiosities.js).
import { curiosityFor, CURIOSITY_T } from "../src/sky/curiosities.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FALLA:", m); } };
ok(/polar/.test(curiosityFor({ layer: "star", name: "Vega" }, "es")) && /pole star/.test(curiosityFor({ layer: "star", name: "Vega" }, "en")), "Vega, en los dos idiomas");
ok(curiosityFor({ layer: "solar", name: "Júpiter" }) && curiosityFor({ layer: "solar", name: "Saturno" }).includes("flotaría") && curiosityFor({ layer: "messier", name: "M 31" }), "planetas con tilde y Messier con espacio");
ok(curiosityFor({ layer: "star", name: "HD 1234" }) === null && curiosityFor(null) === null && curiosityFor({ layer: "moon", name: "Luna" }) === null && curiosityFor({ layer: "galaxies", name: "M31" }) === null, "sin dato: null");
ok(CURIOSITY_T.es && CURIOSITY_T.en, "título en los dos idiomas");
console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
if (fail) process.exit(1);
