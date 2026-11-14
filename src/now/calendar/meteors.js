// meteors.js — lluvias de meteoros del catálogo de Teseo (public/meteorshowers.json: fecha del
// máximo, ventana de actividad, ZHR, radiante J2000; datos de la IMO, ver scripts/build_meteors.py).
// Aquí se añade, para el lugar de la persona, lo que SÍ se puede calcular: si el radiante sube sobre
// el horizonte esa noche, a qué hora está más alto y si la Luna estorba (fase y altura).
// La fecha es la del catálogo (MM-DD): el máximo real puede variar ±1 día entre años.
import { stateAt, altAzOf, MIN, HOUR, DAY } from "./astro.js";
import { nightWindow } from "../../sky/riseset.js";

const sunDirAt = (d) => stateAt(+d).Sol.v;

/** Evento para un máximo concreto (año y MM-DD) en un lugar. */
export function showerEvent(o, year, lat, lon) {
  const [m, d] = o.peak.split("-").map(Number);
  // mediodía solar local de la fecha del máximo → la noche que empieza esa tarde
  const noon = Date.UTC(year, m - 1, d, 12) - (lon / 15) * HOUR;
  const night = nightWindow(sunDirAt, lat, lon, new Date(noon), -12);
  const radiant = [o.nx, o.ny, o.nz];
  let best = null;
  if (night) {
    for (let t = night.start.getTime(); t <= night.end.getTime(); t += 15 * MIN) {
      const a = altAzOf(radiant, lat, lon, t).alt;
      if (!best || a > best.alt) best = { t, alt: a };
    }
  }
  const risesInNight = !!best && best.alt > 0;
  // la Luna a la hora en que el radiante está más alto
  let moon = null;
  if (best) {
    const mo = stateAt(best.t).Luna, el = Math.acos(Math.max(-1, Math.min(1, mo.v[0] * stateAt(best.t).Sol.v[0] + mo.v[1] * stateAt(best.t).Sol.v[1] + mo.v[2] * stateAt(best.t).Sol.v[2])));
    const illum = (1 - Math.cos(el)) / 2;
    const alt = altAzOf(mo.v, lat, lon, best.t).alt;
    moon = { illum, alt, up: alt > 0, level: alt > 0 && illum >= 0.6 ? "strong" : alt > 0 && illum >= 0.3 ? "some" : "none" };
  }
  return { id: `meteor-${o.name_en || o.name}-${year}`, shower: o, year, date: Date.UTC(year, m - 1, d, 12), night, best, risesInNight, maxAlt: best ? best.alt : null, moon };
}

/** Máximos entre from y to (ms): una entrada por lluvia y año. */
export function findShowerPeaks(showers, from, to, lat, lon) {
  const out = [];
  const y0 = new Date(from).getUTCFullYear();
  for (const o of showers || []) {
    if (!o || !o.peak || !Number.isFinite(o.nx)) continue;
    const [m, d] = o.peak.split("-").map(Number);
    for (let y = y0; y <= y0 + 2; y++) {
      const t = Date.UTC(y, m - 1, d, 12);
      if (t + DAY / 2 > from && t <= to) out.push(showerEvent(o, y, lat, lon));
    }
  }
  return out.sort((a, b) => a.date - b.date);
}
