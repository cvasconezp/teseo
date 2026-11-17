// geometry.js — geometría pura de la animación de entrada (se prueba en Node).
//
// Tres escenas, todas en un lienzo SVG de -100…100:
//   · sistema solar: órbitas a escala logarítmica y planetas en su longitud de HOY;
//   · Vía Láctea: dos brazos en espiral logarítmica hechos de puntos (semilla fija);
//   (el viaje de Cassini, la cuarta escena, está en journey.js).

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

export function seeded(seed = 7) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Puntos de la Vía Láctea, vista de frente: una espiral BARRADA como la nuestra (barra central
 * de ~5 kpc, dos brazos principales —Escudo-Centauro y Perseo— y dos menores —Norma y
 * Sagitario—, con un ángulo de paso de ~12°), un disco tenue y el brazo de Orión, el
 * pequeño brazo donde está el Sol. Es una representación, no un mapa: la forma general
 * sigue a Churchwell et al. (2009, Spitzer/GLIMPSE) y Reid et al. (2019).
 * Cada punto: [x, y, radio, color, opacidad].
 */
export const ARM_PITCH = 12 * D2R;                 // ángulo de paso de los brazos
const BAR_HALF = 20, BAR_TILT = 27 * D2R, R_MAX = 92;
const B = Math.tan(ARM_PITCH);
/** Punto del brazo k (0–3) a la fracción u (0–1) de su recorrido, en el plano de la galaxia. */
function armPoint(k, u) {
  const th = u * Math.log(R_MAX / BAR_HALF) / B;  // de la punta de la barra al borde
  const r = BAR_HALF * Math.exp(B * th);
  const a = BAR_TILT + k * Math.PI / 2 + th;
  return [r, a];
}
export function galaxyPoints(n = 1300) {
  const rnd = seeded(11);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 0.58;   // ≈ normal(0, 1)
  const pts = [];
  const warm = ["#fff3d6", "#ffe6b0", "#ffd9a0"], cool = ["#ffffff", "#c9b8ff", "#9ec5ff", "#b9d4ff"];
  const push = (x, y, size, col, op) => pts.push([f(x), f(y * 0.86), f(size), col, f(op)]);
  const nBar = Math.round(n * 0.14), nDisk = Math.round(n * 0.03), nSpur = Math.round(n * 0.04);
  const nArms = n - nBar - nDisk - nSpur;
  // barra y bulbo: estrellas viejas, amarillentas
  for (let i = 0; i < nBar; i++) {
    const along = gauss() * BAR_HALF * 0.42, across = gauss() * 4.2;
    const x = along * Math.cos(BAR_TILT) - across * Math.sin(BAR_TILT), y = along * Math.sin(BAR_TILT) + across * Math.cos(BAR_TILT);
    push(x, y, 0.35 + rnd() * 0.6, warm[Math.floor(rnd() * warm.length)], 0.45 + rnd() * 0.5);
  }
  // brazos: los principales (0 y 2) con más estrellas que los menores (1 y 3)
  const weight = [1, 0.38, 1, 0.38], wsum = weight.reduce((a, b) => a + b, 0);
  for (let k = 0; k < 4; k++) {
    const m = Math.round(nArms * weight[k] / wsum);
    for (let i = 0; i < m; i++) {
      const u = i / m + (rnd() - 0.5) / m;           // repartidos a lo largo del brazo (sin grumos al azar)
      const [r, a] = armPoint(k, u);
      const w = (0.7 + r * 0.018) * gauss();
      const along = (rnd() - 0.5) * 3;
      const x = (r + w) * Math.cos(a) - along * Math.sin(a), y = (r + w) * Math.sin(a) + along * Math.cos(a);
      const core = Math.exp(-(w * w) / 18);          // más brillo en el eje del brazo
      push(x, y, 0.3 + rnd() * (k % 2 ? 0.45 : 0.7), cool[Math.floor(rnd() * cool.length)], (k % 2 ? 0.25 : 0.35) + 0.55 * core);
    }
  }
  // disco tenue entre los brazos
  for (let i = 0; i < nDisk; i++) {
    const r = BAR_HALF * 0.6 + Math.abs(gauss()) * 34, a = rnd() * TAU;
    if (r > R_MAX) continue;
    push(r * Math.cos(a), r * Math.sin(a), 0.3 + rnd() * 0.4, cool[0], 0.15 + rnd() * 0.25);
  }
  // brazo de Orión: un tramo corto donde está el Sol
  const [sr, sa] = SUN_POLAR;
  for (let i = 0; i < nSpur; i++) {
    const t = (rnd() - 0.5) * 0.55, r = sr + t * 28 + gauss() * 2.2, a = sa + t * 0.9;
    push(r * Math.cos(a), r * Math.sin(a), 0.35 + rnd() * 0.6, cool[Math.floor(rnd() * cool.length)], 0.35 + rnd() * 0.45);
  }
  return pts;
}

/** El Sol: a ~8,2 kpc del centro de un disco de ~15 kpc (0,55 del radio dibujado), en el brazo
 *  de Orión, entre los brazos de Perseo (principal) y Sagitario (menor). [radio, ángulo]. */
export const SUN_POLAR = (() => {
  const r = R_MAX * 0.55;
  const th = Math.log(r / BAR_HALF) / B;                 // en el brazo 0 a ese radio…
  return [r, BAR_TILT + th + Math.PI / 4];             // …y un cuarto de vuelta entre brazos más allá
})();
export const SUN_IN_GALAXY = (() => { const [r, a] = SUN_POLAR; return [f(r * Math.cos(a)), f(r * Math.sin(a) * 0.86)]; })();
