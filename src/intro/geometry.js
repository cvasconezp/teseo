// geometry.js — geometría pura de la animación de entrada (se prueba en Node).
//
// Tres escenas, todas en un lienzo SVG de -100…100:
//   · sistema solar: órbitas a escala logarítmica y planetas en su longitud de HOY;
//   · Vía Láctea: dos brazos en espiral logarítmica hechos de puntos (semilla fija);
//   · laberinto: muros circulares con una puerta cada uno y el hilo de Ariadna que
//     entra desde fuera y llega al centro recorriendo los pasillos.

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const f = (n) => Math.round(n * 100) / 100;
const pt = (r, a) => [f(r * Math.cos(a)), f(r * Math.sin(a))];

/** Radio de dibujo de una órbita (escala logarítmica: Mercurio ≈ 12, Neptuno ≈ 88). */
export function orbitRadius(au) {
  return 8 + (Math.log1p(au) / Math.log1p(30.1)) * 80;
}

/** Arco de r entre a0 y a1 recorrido en sentido dir (+1 horario en pantalla, −1 antihorario), en tramos ≤ 90°. */
export function arcPath(r, a0, a1, dir, move = true) {
  let span = dir > 0 ? (a1 - a0) : (a0 - a1);
  span = ((span % TAU) + TAU) % TAU;
  if (span === 0) span = TAU;
  const n = Math.max(1, Math.ceil(span / (Math.PI / 2)));
  const step = (span / n) * dir;
  const [x0, y0] = pt(r, a0);
  let d = move ? `M${x0} ${y0}` : "";
  for (let i = 1; i <= n; i++) {
    const [x, y] = pt(r, a0 + step * i);
    d += ` A${f(r)} ${f(r)} 0 0 ${dir > 0 ? 1 : 0} ${x} ${y}`;
  }
  return d;
}

// Laberinto: muros (de fuera adentro) y la puerta de cada uno, alternando arriba y abajo
export const WALLS = [90, 72, 54, 36, 18];
export const GATE_HALF = 0.2;                     // media apertura de cada puerta (rad)
const GATES = WALLS.map((_, k) => (k % 2 === 0 ? -90 : 90) * D2R + (k % 2 === 0 ? 0.25 : -0.25) * (k / 2));

/** Muros del laberinto: un arco por muro (todo salvo la puerta) y un tabique por pasillo. */
export function labyrinth() {
  const walls = WALLS.map((r, k) => arcPath(r, GATES[k] + GATE_HALF, GATES[k] - GATE_HALF, +1));
  // tabique en el medio del lado que el hilo NO recorre, para que se lea como laberinto
  const spokes = [];
  for (let k = 0; k < WALLS.length - 1; k++) {
    const a = GATES[k] - Math.PI / 2;   // el hilo gira siempre en sentido horario: el tabique, del otro lado
    const [x0, y0] = pt(WALLS[k], a), [x1, y1] = pt(WALLS[k + 1], a);
    spokes.push(`M${x0} ${y0} L${x1} ${y1}`);
  }
  return { walls, spokes };
}

/** El hilo de Ariadna: entra por la puerta exterior y llega al centro por los pasillos. */
export function threadPath() {
  const mid = (k) => (WALLS[k] + WALLS[k + 1]) / 2;
  const [sx, sy] = pt(WALLS[0] + 10, GATES[0]);
  let d = `M${sx} ${sy}`;
  for (let k = 0; k < WALLS.length - 1; k++) {
    const r = mid(k), dir = 1;          // siempre horario: con puertas alternas, un pasillo por la derecha y el siguiente por la izquierda
    const [x, y] = pt(r, GATES[k]);
    d += ` L${x} ${y}`;
    d += arcPath(r, GATES[k], GATES[k + 1], dir, false);
  }
  const [lx, ly] = pt(WALLS[WALLS.length - 1] / 2, GATES[WALLS.length - 1]);
  d += ` L${lx} ${ly} L0 0`;
  return d;
}

/** Generador pseudoaleatorio con semilla (la galaxia sale igual siempre). */
export function seeded(seed = 7) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Puntos de la Vía Láctea: bulbo + dos brazos en espiral logarítmica. [x, y, r, color, opacidad]. */
export function galaxyPoints(n = 700) {
  const rnd = seeded(11);
  const pts = [];
  const cols = ["#ffffff", "#c9b8ff", "#9ec5ff", "#ffe6b0"];
  for (let i = 0; i < n; i++) {
    let x, y, r;
    if (i < n * 0.18) {                               // bulbo central
      r = Math.abs((rnd() + rnd() + rnd() - 1.5) * 16);
      const a = rnd() * TAU;
      x = r * Math.cos(a); y = r * Math.sin(a) * 0.8;
    } else {                                          // brazos
      const arm = i % 2, t = rnd() * 3.2 + 0.3;
      r = 7 * Math.exp(0.78 * t);
      if (r > 92) r = 92 - rnd() * 8;
      const a = t * 1.25 + arm * Math.PI + (rnd() - 0.5) * 0.5;
      const spread = (rnd() - 0.5) * (4 + r * 0.12);
      x = (r + spread) * Math.cos(a); y = (r + spread) * Math.sin(a) * 0.8;
    }
    pts.push([f(x), f(y), f(0.35 + rnd() * 0.9), cols[Math.floor(rnd() * cols.length)], f(0.35 + rnd() * 0.6)]);
  }
  return pts;
}

/** Dónde está el Sol en el dibujo de la galaxia (a unos 26 000 de 50 000 años luz del centro: ~0,55 del radio). */
export const SUN_IN_GALAXY = (() => { const [x, y] = pt(50, -0.6); return [x, f(y * 0.8)]; })();
