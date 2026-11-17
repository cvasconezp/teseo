// journey.js — geometría del viaje de Cassini para la animación de entrada (puro; probado en
// scripts/test_intro.mjs). La trayectoria es la real (src/intro/cassiniPath.js, de JPL Horizons) y los
// planetas están donde estaban el día de cada asistencia (helioPosition, el mismo cálculo que Ruta).
//
// Lienzo SVG de -100…100; distancia al Sol en escala logarítmica (Venus ≈ 30, Saturno ≈ 92), ángulos
// reales, y el norte de la eclíptica hacia el observador (como la escena «Tu sistema solar»).
import { PATH, EVENTS, JD0 } from "./cassiniPath.js";
import { helioPosition } from "../ui/orbits.js";

const f = (n) => Math.round(n * 100) / 100;
/** Radio de dibujo para una distancia en UA (hasta Saturno). */
export const journeyRadius = (au) => 10 + (Math.log1p(au) / Math.log1p(10.1)) * 82;
/** UA (x, y en la eclíptica) → lienzo. */
export function toCanvas(x, y) {
  const r = journeyRadius(Math.hypot(x, y)), a = -Math.atan2(y, x);
  return [f(r * Math.cos(a)), f(r * Math.sin(a))];
}
export const ORBITS = [
  { id: "venus", au: 0.723, color: "#E8C27A" },
  { id: "earth", au: 1.0, color: "#5AA2F5" },
  { id: "jupiter", au: 5.203, color: "#E0B07A" },
  { id: "saturn", au: 9.537, color: "#E6D3A3" },
];
const jdToDate = (jd) => new Date((jd - 2440587.5) * 86400000);

export function journey() {
  const pts = [];
  for (let i = 0; i < PATH.length; i += 3) pts.push({ t: PATH[i], au: [PATH[i + 1], PATH[i + 2]], xy: toCanvas(PATH[i + 1], PATH[i + 2]) });
  // longitud acumulada en el lienzo: el hilo se dibuja a velocidad constante sobre la pantalla
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].xy[0] - pts[i - 1].xy[0], pts[i].xy[1] - pts[i - 1].xy[1]));
  const L = cum[cum.length - 1];
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.xy[0]} ${p.xy[1]}`).join("");
  const events = EVENTS.map((e) => {
    const i = pts.reduce((b, p, k) => (Math.abs(p.t - (e.jd - JD0)) < Math.abs(pts[b].t - (e.jd - JD0)) ? k : b), 0);
    let planet = null;
    try { const h = helioPosition(e.body, jdToDate(e.jd)); planet = { au: [h.x_au, h.y_au], xy: toCanvas(h.x_au, h.y_au) }; } catch { /* sin planeta */ }
    return { ...e, frac: cum[i] / L, xy: pts[i].xy, au: pts[i].au, planet };
  });
  return { d, events, orbits: ORBITS.map((o) => ({ ...o, r: f(journeyRadius(o.au)) })) };
}
