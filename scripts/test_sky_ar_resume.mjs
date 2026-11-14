// Pruebas del detector para volver a apuntar al levantar el teléfono (src/sky/arResume.js)
import { createResumeDetector, isDragToManual, RESUME_DEFAULTS } from "../src/sky/arResume.js";

let ok = 0, bad = 0;
const t = (name, cond) => { if (cond) ok++; else { bad++; console.log("FALLA:", name); } };

// recorre una serie [alt, ms, touching?] y devuelve los instantes en que dispara
const run = (det, seq) => seq.filter(([a, ms, tch]) => det.update(a, ms, !!tch)).map(([, ms]) => ms);

{ // teléfono ya levantado al arrastrar: no vuelve solo aunque siga arriba mucho rato
  const d = createResumeDetector();
  const seq = []; for (let ms = 0; ms <= 5000; ms += 100) seq.push([70, ms]);
  t("sin bajar antes no dispara", run(d, seq).length === 0);
  t("sin bajar no queda armado", !d.armed);
}
{ // baja a postura de lectura y luego apunta al cielo: dispara tras ~0,8 s
  const d = createResumeDetector();
  const seq = [[-40, 0], [-30, 100], [10, 200]];
  for (let ms = 300; ms <= 2000; ms += 100) seq.push([65, ms]);
  const f = run(d, seq);
  t("dispara una vez", f.length === 1);
  t("dispara a los 800 ms de estar arriba", f[0] === 1100);
  t("tras disparar se desarma", !d.armed);
}
{ // con el dedo en pantalla no dispara; al soltar empieza a contar
  const d = createResumeDetector();
  const seq = [[-30, 0]];
  for (let ms = 100; ms <= 1500; ms += 100) seq.push([70, ms, true]);
  for (let ms = 1600; ms <= 2600; ms += 100) seq.push([70, ms, false]);
  const f = run(d, seq);
  t("dedo en pantalla bloquea", f.length === 1 && f[0] === 2400);
}
{ // histéresis: entre 20° y 55° no hace nada y una bajada a mitad reinicia la cuenta
  const d = createResumeDetector();
  const seq = [[-10, 0], [40, 100], [40, 900], [60, 1000], [60, 1500], [45, 1600], [60, 1700], [60, 2300], [60, 2500]];
  const f = run(d, seq);
  t("bajar a 45° reinicia la cuenta", f.length === 1 && f[0] === 2500);
}
{ // valores inválidos (sensor sin dato) no disparan
  const d = createResumeDetector();
  t("NaN no dispara", !d.update(NaN, 0) && !d.update(undefined, 100));
}
{ // reset
  const d = createResumeDetector(); d.update(-30, 0); d.reset();
  t("reset desarma", !d.armed);
}
{ // umbrales configurables
  const d = createResumeDetector({ fireAbove: 80, holdMs: 300 });
  const f = run(d, [[0, 0], [75, 100], [75, 600], [85, 700], [85, 1000]]);
  t("cenit estricto (80°) y 300 ms", f.length === 1 && f[0] === 1000);
  t("valores por defecto razonables", RESUME_DEFAULTS.armBelow < RESUME_DEFAULTS.fireAbove && RESUME_DEFAULTS.holdMs >= 500);
}
// arrastre que pasa a manual: en cualquier dirección, no con un toque
t("toque corto no pasa a manual", !isDragToManual(3, 4));
t("arrastre vertical pasa a manual", isDragToManual(0, 30));
t("arrastre horizontal pasa a manual", isDragToManual(-25, 2));
t("arrastre diagonal pasa a manual", isDragToManual(10, 10));

console.log(`${ok} pruebas correctas, ${bad} fallidas`);
if (bad) process.exit(1);
