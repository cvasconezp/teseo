// Pruebas de la animación de entrada (src/intro/geometry.js).
import { orbitRadius, arcPath, galaxyPoints, SUN_IN_GALAXY } from "../src/intro/geometry.js";
import { journey, journeyRadius, toCanvas } from "../src/intro/journey.js";
import { PATH, EVENTS } from "../src/intro/cassiniPath.js";
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };

console.log("Sistema solar");
const radii = [0.387, 0.723, 1, 1.524, 5.2, 9.58, 19.2, 30.1].map(orbitRadius);
ok(radii.every((r, i) => i === 0 || r > radii[i - 1]), "las órbitas crecen con la distancia");
ok(radii[0] > 8 && radii[7] <= 88.01, "Mercurio y Neptuno caben en el dibujo");

console.log("Viaje de Cassini (catapultas)");
ok(arcPath(10, 0, Math.PI, 1).match(/A/g).length === 2, "los arcos se parten en tramos de 90° o menos");
const j = journey();
ok(j.d.startsWith("M") && !/NaN/.test(j.d), "la trayectoria es un trazado válido");
ok(PATH.length % 3 === 0 && PATH.length / 3 > 80, "trayectoria real de Horizons con suficientes puntos");
ok(EVENTS.map((e) => e.body).join() === "earth,venus,venus,earth,jupiter,saturn", "lanzamiento, cuatro catapultas (V, V, T, J) y llegada a Saturno");
ok(j.events.every((e, i) => i === 0 || e.frac > j.events[i - 1].frac) && j.events[0].frac === 0 && j.events[5].frac === 1, "los sucesos siguen el orden del hilo");
for (const e of j.events.filter((x) => x.kind === "assist")) {
  const sep = Math.hypot(e.au[0] - e.planet.au[0], e.au[1] - e.planet.au[1]);
  ok(sep < (e.body === "jupiter" ? 0.1 : 0.02), `la sonda pasa junto a ${e.body} el ${e.date} (${sep.toFixed(3)} UA)`);
}
ok(journeyRadius(9.54) < 95 && journeyRadius(0.72) > 20, "de Venus a Saturno cabe en el dibujo");
const [ex, ey] = toCanvas(1, 0), [nx, ny] = toCanvas(0, 1);
ok(ex > 0 && Math.abs(ey) < 1e-9 && ny < 0 && Math.abs(nx) < 1e-9, "mismo sentido que «Tu sistema solar» (norte eclíptico hacia ti)");

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
const trip = /TRIP = \{ start: ([\d.]+), dur: ([\d.]+) \}/.exec(jsx), th = /\.intro__thread \{[^}]*draw ([\d.]+)s linear ([\d.]+)s/.exec(css);
ok(trip && th && trip[1] === th[2] && trip[2] === th[1], "las catapultas se encienden al paso del hilo (TRIP = CSS)");
ok(jsx.includes("cuatro catapultas") && jsx.includes("four slingshots"), "rótulo del viaje en ambos idiomas");
const m = /INTRO_MS = (\d+)/.exec(jsx), out = /intro-out \.6s ease-in (\d+(?:\.\d+)?)s/.exec(css);
ok(m && out && Math.abs(Number(m[1]) / 1000 - (Number(out[1]) + 0.6)) < 0.01, "el fundido termina justo cuando se cierra la intro");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
