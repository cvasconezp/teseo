// hohmannMap.js — geometría del dibujo de la ruta en el mapa de Ruta (SolarMap).
// Funciones puras, sin React ni DOM: se prueban en Node con scripts/test_route_assists.mjs.
//
// El mapa no está a escala: las órbitas de los ocho planetas se reparten a
// distancias iguales (ORBIT_R). La línea que se dibuja es la media elipse de
// Hohmann de la próxima ventana de lanzamiento:
//   · los ÁNGULOS son reales: sale en la longitud heliocéntrica del origen el
//     día de la salida y llega 180° después, en el sentido en que se mueven los
//     planetas;
//   · los RADIOS son reales (r(ν) = a(1−e²)/(1+e·cos ν), en UA) pero se pasan
//     por la misma escala no lineal del mapa (`mapRadius`), interpolando por UA
//     entre los radios de las órbitas: así la elipse cruza cada órbita dibujada
//     justo donde la curva real cruza esa distancia al Sol.
import { SEMI_MAJOR_AXIS_AU, helioPosition, hohmannLocal, launchWindowsLocal } from "../ui/orbits.js";

export const TAU = Math.PI * 2;

/** Planetas en el orden del mapa (de dentro hacia fuera). */
export const MAP_PLANETS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];
/** Radio de cada órbita del mapa, en % del lado del mapa (equiespaciadas). */
export const ORBIT_R = (i) => 9.6 + i * 5.1;
/** Semieje mayor (UA) de cada órbita del mapa, en el mismo orden. */
export const ORBIT_AU = MAP_PLANETS.map((id) => SEMI_MAJOR_AXIS_AU[id]);

// Tangentes de la interpolación cúbica monótona (Fritsch–Butland) por los nodos (UA, radio del mapa).
const NODE_R = ORBIT_AU.map((_, i) => ORBIT_R(i));
const SECANT = ORBIT_AU.slice(1).map((x, i) => (NODE_R[i + 1] - NODE_R[i]) / (x - ORBIT_AU[i]));
const TANGENT = ORBIT_AU.map((_, i) => {
  if (i === 0) return SECANT[0];
  if (i === ORBIT_AU.length - 1) return SECANT[SECANT.length - 1];
  const h0 = ORBIT_AU[i] - ORBIT_AU[i - 1], h1 = ORBIT_AU[i + 1] - ORBIT_AU[i];
  return (3 * (h0 + h1)) / ((2 * h1 + h0) / SECANT[i - 1] + (h1 + 2 * h0) / SECANT[i]);
});

/**
 * Distancia al Sol en UA → radio en el mapa (% del lado). Interpola por UA entre los
 * radios de las órbitas con una cúbica monótona: en el semieje de cada planeta
 * devuelve exactamente ORBIT_R de ese planeta, nunca retrocede y no tiene los
 * «codos» de una interpolación lineal. Por dentro de Mercurio baja linealmente
 * hasta el Sol y por fuera de Neptuno sigue con la pendiente del último tramo.
 * Es estrictamente creciente.
 */
export function mapRadius(au) {
  const x = Math.max(0, au);
  const n = ORBIT_AU.length;
  if (x <= ORBIT_AU[0]) return (ORBIT_R(0) * x) / ORBIT_AU[0];
  if (x >= ORBIT_AU[n - 1]) return NODE_R[n - 1] + TANGENT[n - 1] * (x - ORBIT_AU[n - 1]);
  let i = 1;
  while (x > ORBIT_AU[i]) i++;
  const x0 = ORBIT_AU[i - 1], x1 = ORBIT_AU[i], h = x1 - x0, t = (x - x0) / h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * NODE_R[i - 1] + (t3 - 2 * t2 + t) * h * TANGENT[i - 1]
    + (-2 * t3 + 3 * t2) * NODE_R[i] + (t3 - t2) * h * TANGENT[i];
}

/** Elementos de la elipse de Hohmann entre dos órbitas circulares de radios r1 → r2 (UA). */
export function hohmannEllipse(r1, r2) {
  const a = (r1 + r2) / 2;
  const e = Math.abs(r2 - r1) / (r1 + r2);
  const outbound = r2 > r1;
  // Hacia fuera sale del perihelio (ν = 0) y llega al afelio (ν = π);
  // hacia dentro sale del afelio (ν = π) y llega al perihelio (ν = 2π).
  return { a, e, p: a * (1 - e * e), outbound, nu0: outbound ? 0 : Math.PI, rp: Math.min(r1, r2), ra: Math.max(r1, r2) };
}

/** Distancia al Sol (UA) en el punto s ∈ [0, 1] de la media elipse (s = 0 salida, s = 1 llegada). */
export function hohmannRadiusAU(ell, s) {
  const nu = ell.nu0 + Math.PI * s;
  return ell.p / (1 + ell.e * Math.cos(nu));
}

/** Longitud heliocéntrica (rad) de un planeta en una fecha. */
export function helioLongitude(id, date) {
  const p = helioPosition(id, date);
  return Math.atan2(p.y_au, p.x_au);
}

/**
 * Plan de dibujo de la ruta de Hohmann entre dos planetas.
 *   dep, arr: fechas (Date) de salida y llegada de la ventana.
 * Devuelve ángulos (rad, eclíptica, antihorario), la polilínea en coordenadas
 * del mapa (x, y en % con el Sol en 50,50 y el eje y hacia abajo, como el SVG)
 * y las posiciones de salida, llegada y del destino «fantasma» en la fecha de llegada.
 */
export function hohmannPlan(fromId, toId, dep, arr, { samples = 120 } = {}) {
  const r1 = SEMI_MAJOR_AXIS_AU[fromId], r2 = SEMI_MAJOR_AXIS_AU[toId];
  const ell = hohmannEllipse(r1, r2);
  const thetaDep = helioLongitude(fromId, dep);
  const thetaArr = thetaDep + Math.PI;                 // 180° después, en el sentido del movimiento
  const toXY = (r, th) => ({ x: 50 + r * Math.cos(th), y: 50 - r * Math.sin(th) });
  const points = [];
  for (let k = 0; k <= samples; k++) {
    const s = k / samples;
    const au = hohmannRadiusAU(ell, s);
    points.push({ s, au, theta: thetaDep + Math.PI * s, ...toXY(mapRadius(au), thetaDep + Math.PI * s) });
  }
  // destino en su posición de la fecha de llegada (el planeta real, no el punto de la elipse)
  const thetaGhost = helioLongitude(toId, arr);
  const rMapTo = mapRadius(r2);
  return {
    ell, thetaDep, thetaArr, points,
    dep: { theta: thetaDep, r: mapRadius(r1), ...toXY(mapRadius(r1), thetaDep) },
    arrivalPoint: { theta: thetaArr, r: rMapTo, ...toXY(rMapTo, thetaArr) },
    ghost: { theta: thetaGhost, r: rMapTo, ...toXY(rMapTo, thetaGhost) },
    // desfase (°) entre el punto de llegada de la elipse y el destino real, en [−180, 180]
    ghostOffsetDeg: ((((thetaGhost - thetaArr) * 180) / Math.PI + 540) % 360) - 180,
  };
}

/**
 * Fechas de la ruta que se dibuja. Prioridad: la primera ventana que dio el servidor
 * (la misma que ve la pestaña Ventanas), luego la ventana local por ángulo de fase y,
 * si no hay ninguna, hoy con el tiempo de vuelo de Hohmann (source: "today").
 * `server`: { dep, arr } en ISO o null. Devuelve { dep, arr, source } con fechas ISO.
 */
export function routeDates(fromId, toId, server = null, now = new Date()) {
  const ok = (x) => typeof x === "string" && Number.isFinite(+new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(x) ? x : `${x}Z`));
  if (server && ok(server.dep) && ok(server.arr)) return { dep: server.dep, arr: server.arr, source: "server" };
  try {
    const w = launchWindowsLocal(fromId, toId, now, 1).windows[0];
    if (w && ok(w.departure_date) && ok(w.arrival_date)) return { dep: w.departure_date, arr: w.arrival_date, source: "local" };
  } catch { /* cae a hoy */ }
  const h = hohmannLocal(fromId, toId, now);
  return { dep: h.departure_date, arr: h.arrival_date, source: "today" };
}

/** Polilínea → atributo `d` de un <path> SVG. */
export function pathD(points) {
  return points.map((q, k) => `${k ? "L" : "M"}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join("");
}

// ─── Etiquetas de los marcadores ─────────────────────────────────────────────

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Coloca una etiqueta (w × h px) junto a un punto (cx, cy en px) donde no pise
 * ningún obstáculo (cajas {x, y, w, h}) y quede dentro del mapa (lado `side`).
 * Prueba ocho direcciones a dos distancias; `avoidPath` (puntos en px) se evita
 * si se puede. Devuelve la caja elegida o null si no hay hueco.
 */
export function placeLabel(cx, cy, w, h, side, obstacles, { avoidPath = [], gap = 9 } = {}) {
  const dirs = [[1, -1], [1, 1], [-1, -1], [-1, 1], [0, -1], [0, 1], [1, 0], [-1, 0]];
  const cands = [];
  for (const g of [gap, gap + 14, gap + 28, gap + 46, gap + 68]) {
    for (const [dx, dy] of dirs) {
      const x = dx > 0 ? cx + g : dx < 0 ? cx - g - w : cx - w / 2;
      const y = dy > 0 ? cy + g * 0.6 : dy < 0 ? cy - g * 0.6 - h : cy - h / 2;
      cands.push({ x, y, w, h });
    }
  }
  const inside = (b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= side && b.y + b.h <= side;
  const free = cands.filter((b) => inside(b) && !obstacles.some((o) => overlap(b, o)));
  const touchesPath = (b) => avoidPath.some((q) => q.x >= b.x - 2 && q.x <= b.x + b.w + 2 && q.y >= b.y - 2 && q.y <= b.y + b.h + 2);
  return free.find((b) => !touchesPath(b)) || free[0] || null;
}
