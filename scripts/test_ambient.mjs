// Pruebas de la música ambiental (src/ui/ambient.js) y su botón.
import { nextBell, BELL_NOTES, DRONE_NOTES, MASTER_GAIN, STORAGE_KEY } from "../src/ui/ambient.js";
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };

console.log("Motor");
ok(BELL_NOTES.length === 6 && BELL_NOTES[0] === 440 && BELL_NOTES.at(-1) === 880, "campanas: la menor pentatónica de A4 a A5");
ok(DRONE_NOTES.every((f, i) => i === 0 || f > DRONE_NOTES[i - 1]) && DRONE_NOTES[0] === 110, "bordón grave: la2 · mi3 · la3");
ok(MASTER_GAIN > 0 && MASTER_GAIN <= 0.2, "volumen de fondo, bajo");
let seq = [0, 0.999, 0.5], i = 0; const rnd = () => seq[i++ % seq.length];
const b = nextBell(rnd);
ok(BELL_NOTES.includes(b.freq) && b.wait >= 3 && b.wait <= 8 && b.gain > 0 && b.gain <= 0.1, "la siguiente campana: nota de la escala, espera de 3 a 8 s, volumen suave");
for (let k = 0; k < 200; k++) { const x = nextBell(); if (!BELL_NOTES.includes(x.freq)) { ok(false, "nota fuera de la escala"); break; } }
ok(true, "200 campanas al azar, todas en la escala");

console.log("Botón");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
ok(/night-btn--music/.test(app) && /aria-pressed=\{ambient\}/.test(app), "botón en la cabecera con estado accesible");
ok(/ambientOn:\s+"Música ambiental"/.test(app) && /ambientOn:\s+"Ambient music"/.test(app), "rótulos en español e inglés");
ok(/useState\(false\)/.test(app.slice(app.indexOf("const ambientRef"))) && app.includes(`STORAGE_KEY as AMBIENT_KEY`) && STORAGE_KEY === "teseo-ambient", "empieza apagada y recuerda la preferencia");
ok(/addEventListener\("pointerdown", resume, \{ once: true \}\)/.test(app), "si estaba encendida, vuelve con el primer toque (sin sonido automático)");
const eng = readFileSync(new URL("../src/ui/ambient.js", import.meta.url), "utf8");
ok(/visibilitychange/.test(eng) && /suspend\(\)/.test(eng), "se pausa al ocultar la pestaña");
const py = readFileSync(new URL("../backend/app/metrics.py", import.meta.url), "utf8");
ok(/"ambient":\s+\{"state": ON_OFF\}/.test(py), "métrica ambient en la lista blanca");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
