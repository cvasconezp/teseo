// Pruebas de «Constelaciones en profundidad real» (src/sky/depthView.js): geometría, compresión, error de la
// paralaje y estrellas principales; y el campo nuevo de sky.json (error de la paralaje de Hipparcos).
import { depthLayout, distRange, niceStep, kAt, autoK, mainStars } from "../src/sky/depthView.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };
const near = (a, b, t) => Math.abs(a - b) <= t;
const norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };

const sky = JSON.parse(readFileSync(new URL("../public/sky.json", import.meta.url)));
const by = new Map(sky.stars.map((s) => [s[7], s]));
const ori = ["Betelgeuse", "Rigel", "Bellatrix", "Mintaka", "Alnilam", "Alnitak", "Saiph", "Meissa"].map((n) => by.get(n));
const items = ori.map((s) => ({ key: s[0], dir: [s[1], s[2], s[3]], d: s[6], mag: s[4] }));

console.log("Geometría");
const L1 = depthLayout(items, 1);
const ang = (a, b) => Math.acos(Math.min(1, norm(a).reduce((m, x, i) => m + x * norm(b)[i], 0))) * 180 / Math.PI;
ok(items.every((it) => ang(L1.at(it.dir, it.d), it.dir) < 1e-6), "sin compresión, cada estrella queda en su dirección del cielo (de frente es la figura de siempre)");
const L7 = depthLayout(items, 7), b = items[0];
const along = (L, it) => { const p = L.at(it.dir, it.d); return p[0] * L.c[0] + p[1] * L.c[1] + p[2] * L.c[2]; };
const across = (L, it) => { const p = L.at(it.dir, it.d), a = along(L, it); return Math.hypot(p[0] - a * L.c[0], p[1] - a * L.c[1], p[2] - a * L.c[2]); };
ok(near(along(L7, b) / L7.s * 7, b.d * (b.dir[0] * L7.c[0] + b.dir[1] * L7.c[1] + b.dir[2] * L7.c[2]), 1e-6) && near(across(L7, b) / L7.s, across(L1, b) / L1.s, 1e-6), "comprimida ×7: el fondo se divide entre 7 y el ancho (en años luz) no cambia");
ok(near(kAt(7, 0), 1, 1e-12) && near(kAt(7, 1), 7, 1e-12) && kAt(7, 0.5) > 1 && kAt(7, 0.5) < 7, "la compresión crece con el giro: 1 de frente, ×k de costado");
const k = autoK(items, L1.c);
ok(k >= 2 && k <= 20 && Number.isInteger(k), `compresión automática para Orión: ×${k}`);

console.log("Distancia y error");
const al = by.get("Alnilam"), r = distRange(al[6], al[10]);
ok(near(al[10], 0.45, 1e-9) && near(r[0], 1553, 5) && near(r[1], 2718, 5), "Alnilam: 1977 años luz, de 1553 a 2718 a 1σ (paralaje 1,65 ± 0,45 mas)");
ok(distRange(1000, 5)[1] === null && distRange(0, 1) === null && distRange(500, null) === null, "si el error supera la paralaje, sin cota de lejanía; sin datos, null");
ok(sky.stars.filter((s) => s[10] != null).length > 5000 && sky.meta.star_fields[10] === "e_plx_mas" && /van Leeuwen/.test(sky.meta.e_plx_source), "sky.json trae el error de la paralaje de Hipparcos 2007 y lo documenta");

console.log("Escala y principales");
ok(niceStep(1977) === 500 && niceStep(300) === 100 && niceStep(90) === 20, "pasos del eje: 500, 100, 20 años luz");
const m = mainStars(items, 7);
ok(m.size === 7 && !m.has(by.get("Meissa")[0]) && m.has(by.get("Rigel")[0]), "principales: las más brillantes de la figura");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
