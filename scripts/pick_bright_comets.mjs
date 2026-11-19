// Elige, entre los cometas candidatos (JSON por la entrada estándar: { nombre: elementos }), los que llegarán a ser
// más brillantes que la magnitud `LIM` en algún momento entre 3 meses atrás y 12 meses adelante de `ms`.
// Uso: node scripts/pick_bright_comets.mjs <ms> <LIM> <máximo>   (lo llama scripts/build_comet_orbits.py)
import { cometAt } from "../src/sky/cometSky.js";
const [ms, lim, max] = [Number(process.argv[2]), Number(process.argv[3] || 12), Number(process.argv[4] || 16)];
let txt = ""; for await (const c of process.stdin) txt += c;
const out = [];
for (const [name, el] of Object.entries(JSON.parse(txt))) {
  if (el.M1 == null || el.K1 == null) continue;
  let best = 99, when = 0;
  for (let d = -90; d <= 365; d += 5) { const k = cometAt(el, ms + d * 86400000); if (k.mag != null && k.mag < best) { best = k.mag; when = d; } }
  if (best <= lim) out.push({ name, best: +best.toFixed(1), day: when });
}
out.sort((a, b) => a.best - b.best);
console.log(JSON.stringify(out.slice(0, max)));
