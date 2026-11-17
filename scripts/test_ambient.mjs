// Pruebas de la música ambiental (src/ui/ambient.js) y su botón.
import { PROGRESSION, BAR_SECONDS, OVERLAP, BPM, ARP_ORDER, MASTER_GAIN, STORAGE_KEY, midiToHz, arpeggio } from "../src/ui/ambient.js";
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };

console.log("Motor");
ok(Math.abs(midiToHz(69) - 440) < 1e-9 && Math.abs(midiToHz(57) - 220) < 1e-9, "notas MIDI a Hz: la4 = 440, la3 = 220");
ok(PROGRESSION.length === 4 && PROGRESSION.every(c => c.length === 5), "cuatro acordes de cinco notas");
ok(PROGRESSION.map(c => c[0] % 12).join() === "9,5,0,7", "raíces: la · fa · do · sol (la m9, fa maj7, do, sol)");
ok(PROGRESSION.flat().every(m => m >= 48 && m <= 74), "colchón en registro medio (do3 a re5)");
ok(BAR_SECONDS === 8 && OVERLAP > 0 && OVERLAP < BAR_SECONDS && BPM === 72, "un acorde cada 8 s, fundido con el siguiente, arpegio a 72 pulsos");
const arp = arpeggio(PROGRESSION[0]);
ok(arp.length === 19 && Math.abs(arp[1][0] - 60 / BPM / 2) < 1e-9, "arpegio en corcheas: 19 notas por compás");
ok(arp.every(([t, m, v, p]) => t >= 0 && t < BAR_SECONDS && PROGRESSION[0].includes(m - 12) && v > 0 && v <= 0.8 && p >= -1 && p <= 1), "cada nota del arpegio es del acorde, una octava arriba, suave y dentro del estéreo");
ok(ARP_ORDER.every(i => i >= 0 && i < 5), "orden del arpegio válido");
ok(MASTER_GAIN > 0 && MASTER_GAIN <= 0.2, "volumen de fondo, bajo");

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
