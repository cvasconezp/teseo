// Pruebas: máscara de estrellas brillantes del mapa fotográfico (src/sky/hipsLayer.js).
import { setHipsMasks, haloRadiusDeg } from "../src/sky/hipsLayer.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FALLA:", m); } };
ok(haloRadiusDeg(-1.46) > haloRadiusDeg(0.13) && haloRadiusDeg(0.13) > 0.9 && haloRadiusDeg(1.3) < 0.75, "halo mayor cuanto más brillante (Sirio > Rigel)");
const stars = Array.from({ length: 30 }, (_, i) => [1, 0, i, -1 + i * 0.2]);
ok(setHipsMasks(stars) === 12 && setHipsMasks([[0, 0, 1, 3]]) === 0 && setHipsMasks(null) === 0, "solo las de magnitud menor que 1,3 (y como mucho 16)");
console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
if (fail) process.exit(1);
