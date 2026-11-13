// Pruebas del medidor de rendimiento y de la resolución adaptativa (src/sky/perf.js).
// Uso:  node scripts/test_sky_perf.mjs     (sale con código 1 si algo falla)
import { perfFlag, percentile, createFrameStats, createAdaptive } from "../src/sky/perf.js";
import { TX } from "../src/sky/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

console.log("Activación por URL");
{
  ok(perfFlag("#sky?L=probes&fps=1", "") && perfFlag("#sky?fps=1", "") && perfFlag("#sky", "?perf=1") && perfFlag("", "perf=1") && perfFlag("#sky?perf=1", ""), "#sky?…&fps=1, ?perf=1 y variantes lo activan");
  ok(!perfFlag("#sky?L=probes", "") && !perfFlag("#sky?fps=0", "") && !perfFlag("", "") && !perfFlag(null, null) && !perfFlag("#sky?o=star~fps=1", ""), "sin el parámetro (o con otro valor) queda apagado");
}

console.log("Estadísticas por cuadro");
{
  ok(percentile([1, 2, 3, 4, 5], 0.5) === 3 && percentile([10], 0.99) === 10 && percentile([], 0.5) === 0 && near(percentile([0, 10], 0.25), 2.5), "percentiles");
  const s = createFrameStats(600);
  for (let i = 0; i < 99; i++) s.push(16, 2); s.push(100, 10);
  const r = s.summary();
  ok(r.n === 100 && near(r.fps, 1000 / 16.84, 0.01), `FPS medio = 1000 / intervalo medio (${r.fps.toFixed(1)})`);
  ok(r.low1 > 9.9 && r.low1 < 60 && r.low1 < r.fps / 2, `el «1 % bajo» refleja el cuadro lento (${r.low1.toFixed(1)} FPS) aunque la media sea alta`);
  ok(near(r.jsMean, 2.08, 0.001) && r.jsP95 <= 10 && r.jsP95 >= 2, "tiempo de JS: media y percentil 95");
  ok(!s.push(5000, 1) && !s.push(0, 1) && !s.push(NaN, 1) && s.summary().n === 100, "una pausa larga (pestaña oculta, bucle en reposo) no cuenta como cuadro lento");
  const w = createFrameStats(10); for (let i = 0; i < 25; i++) w.push(i < 15 ? 50 : 10, 1);
  ok(w.summary().n === 10 && near(w.summary().fps, 100, 0.01), "ventana deslizante: solo los últimos cuadros");
  w.reset(); ok(w.summary().n === 0 && w.summary().fps === 0, "reinicio");
}

console.log("Resolución adaptativa");
{
  const a = createAdaptive({ max: 2 });
  ok(a.ratio === 2 && a.min === 1 && a.max === 2, "arranca en el tope (2) y nunca baja de 1");
  let ch = null; for (let t = 0; t < 2000; t += 500) ch = ch || a.update(22, 500);
  ok(ch === null && a.ratio === 2, "2 s de FPS bajos aún no bastan");
  ch = a.update(22, 500);
  ok(near(ch, 1.6) && near(a.ratio, 1.6), "a los 2,5 s seguidos por debajo de 30 FPS baja un escalón (2 → 1,6)");
  ok(a.update(10, 500) === null && a.update(10, 300) === null, "tras cambiar espera a que se asiente antes de volver a medir");
  let steps = []; for (let t = 0; t < 30000; t += 500) { const c = a.update(20, 500); if (c) steps.push(+c.toFixed(2)); }
  ok(steps.join() === "1.28,1.02,1" && a.ratio === 1, `si sigue lento baja por escalones hasta el suelo y ahí se queda (${steps.join(" → ")})`);
  ok(a.update(40, 20000) === null && a.ratio === 1, "entre 30 y 50 FPS no toca nada (zona muerta: no oscila)");
  let up = null, t = 0; for (; t < 6500 && !up; t += 500) up = a.update(58, 500);
  ok(near(up, 1.25) && t >= 6000, "con FPS de sobra durante 6 s sube un escalón");
  a.update(58, 1000);
  let dn = null; for (let k = 0; k < 8 && !dn; k++) dn = a.update(20, 500);
  ok(near(dn, 1), "si al subir vuelve a caer, baja otra vez…");
  a.update(58, 1000);
  let up2 = null, t2 = 0; for (; t2 < 30000 && !up2; t2 += 500) up2 = a.update(58, 500);
  ok(up2 && t2 >= 12000, `…y la próxima subida espera el doble (${t2 / 1000} s)`);
  const b = createAdaptive({ max: 1 });
  for (let k = 0; k < 40; k++) b.update(10, 500);
  ok(b.min === 0.75 && near(b.ratio, 0.75) && b.update(5, 60000) === null, "pantalla de densidad 1: baja como mucho a 0,75");
  const c = createAdaptive({ max: 2 }); let none = null; for (let k = 0; k < 100; k++) none = none || c.update(60, 500);
  ok(none === null && c.ratio === 2 && c.update(0, 5000) === null && c.update(NaN, 5000) === null, "con buen rendimiento (o sin medida) no cambia nada");
}

console.log("Textos del medidor");
{
  const keys = ["perfTitle", "perfFps", "perfLow", "perfJs", "perfObjs", "perfLabels", "perfRes", "perfIdle", "perfAria", "perfFrames"];
  ok(keys.every((k) => typeof TX.es[k] === "string" && typeof TX.en[k] === "string"), "en español y en inglés");
}

console.log(`\n${passed} pruebas correctas, ${failed} con fallo`);
process.exit(failed ? 1 : 0);
