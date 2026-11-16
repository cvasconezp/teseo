// Pruebas de la animación de entrada (src/intro/geometry.js).
import { orbitRadius, arcPath, labyrinth, threadPath, galaxyPoints, WALLS, SUN_IN_GALAXY } from "../src/intro/geometry.js";
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };

console.log("Sistema solar");
const radii = [0.387, 0.723, 1, 1.524, 5.2, 9.58, 19.2, 30.1].map(orbitRadius);
ok(radii.every((r, i) => i === 0 || r > radii[i - 1]), "las órbitas crecen con la distancia");
ok(radii[0] > 8 && radii[7] <= 88.01, "Mercurio y Neptuno caben en el dibujo");

console.log("Laberinto e hilo");
const { walls, spokes } = labyrinth();
ok(walls.length === WALLS.length && spokes.length === WALLS.length - 1, "un muro por anillo y un tabique por pasillo");
const t = threadPath();
ok(t.startsWith("M") && t.trim().endsWith("L0 0"), "el hilo empieza fuera y termina en el centro");
ok(!/NaN/.test(t + walls.join("") + spokes.join("")), "sin NaN en los trazados");
ok(/A\d/.test(arcPath(10, 0, Math.PI, 1)) && (arcPath(10, 0, Math.PI, 1).match(/A/g) || []).length === 2, "los arcos se parten en tramos de 90° o menos");

console.log("Vía Láctea");
const g1 = galaxyPoints(), g2 = galaxyPoints();
ok(g1.length > 1000 && JSON.stringify(g1) === JSON.stringify(g2), "unos 1100 puntos, siempre iguales (semilla fija)");
ok(g1.every(([x, y]) => Math.hypot(x, y) <= 110), "todos dentro del dibujo");
ok(Math.hypot(...SUN_IN_GALAXY) > 30 && Math.hypot(...SUN_IN_GALAXY) < 60, "el Sol, a medio camino del centro");

console.log("Textos e integración");
const jsx = readFileSync(new URL("../src/intro/Intro.jsx", import.meta.url), "utf8");
ok(jsx.includes("El universo es un laberinto.") && jsx.includes("Teseo es tu hilo."), "eslogan en español");
ok(jsx.includes("The universe is a labyrinth.") && jsx.includes("Teseo is your thread."), "eslogan en inglés");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
ok(/<Intro lang=\{lang\} planets=\{PLANETS\}/.test(app) && /reducedMotion\(\)/.test(app), "App monta la intro nueva y la evita con «reducir movimiento»");
const css = readFileSync(new URL("../src/intro/intro.css", import.meta.url), "utf8");
const m = /INTRO_MS = (\d+)/.exec(jsx), out = /intro-out \.6s ease-in (\d+(?:\.\d+)?)s/.exec(css);
ok(m && out && Math.abs(Number(m[1]) / 1000 - (Number(out[1]) + 0.6)) < 0.01, "el fundido termina justo cuando se cierra la intro");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
