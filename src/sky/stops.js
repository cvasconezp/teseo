// PUNTOS DE VISITA de cada sitio: lugares donde pararse y hacia dónde mirar, para recorrerlo saltando de uno a otro.
// Machu Picchu los trae a mano (monuments.SITE_STOPS, sobre el suelo de su maqueta). En los demás sitios con varias
// piezas se calculan: la «Vista general» es el lugar del sitio (places.SITES) y, por cada pieza principal, un punto
// frente a ella —del lado de la vista general—, a una distancia que la deja entera a la vista y fuera de las demás.
import { MONUMENTS, SITE_STOPS, footprintRadius, offsetOf } from "./monuments.js";
import { SITES } from "./places.js";

// sitio → [lugar de la vista general, piezas principales] (solo piezas que se pisan a ras de suelo)
const AUTO = {
  teotihuacan: ["teotihuacan", ["sol", "luna"]],
  giza: ["giza", ["keops", "kefren", "micerino"]],
  cochasqui: ["cochasqui", ["cq-g", "cq-e", "cq-m", "cqm-a"]],
  chankillo: ["chankillo", ["chankillo-7"]],
  catequilla: ["catequilla", ["catequilla-muro", "catequilla-disco"]],
  paranal: ["paranal", ["vlt-ut1", "vlt-ut4"]],
  tiwanaku: ["tiwanaku", ["akapana", "kalasasaya"]],
};
const RAD = Math.PI / 180;
const at = (lat, lon, e, n) => [lat + n / 110574, lon + e / (111320 * Math.cos(lat * RAD))];

/** Punto frente a la pieza `m`, visto desde [vlat, vlon]: { lat, lon, look, lookAlt, d } (o null si no cabe). */
export function frontStop(m, vlat, vlon, others = []) {
  const o = offsetOf(m.lat, m.lon, vlat, vlon), r = footprintRadius(m), h = m.height || 3;
  const d = Math.max(r * 1.15 + Math.min(60, Math.max(4, h)), h * 1.2, 8);
  if (o.d < d + 15) return null;                       // la vista general ya está frente a ella
  for (const da of [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90]) {
    const b = (o.az + da) * RAD, e = d * Math.sin(b), n = d * Math.cos(b), [lat, lon] = at(m.lat, m.lon, e, n);
    if (others.some((q) => q !== m && offsetOf(lat, lon, q.lat, q.lon).d < footprintRadius(q) + 3)) continue;
    return { lat, lon, look: ((o.az + da + 180) % 360 + 360) % 360, lookAlt: Math.min(25, Math.max(2, (Math.atan2(h * 0.45, d) / RAD))), d };
  }
  return null;
}

let cache = null;
/** Todos los puntos de visita: { sitio: [{ id, name: { es, en }, lat, lon, elev, look, lookAlt, at: [ids de rótulos] }] }. */
export function allStops() {
  if (cache) return cache;
  const out = { ...SITE_STOPS };
  for (const [site, [viewId, ids]] of Object.entries(AUTO)) {
    const view = SITES.find((s) => s.id === viewId), all = MONUMENTS.filter((m) => m.site === site);
    if (!view) continue;
    const stops = [{ id: "vista", name: { es: "Vista general", en: "Overview" }, lat: view.lat, lon: view.lon, elev: view.elev ?? null, at: [] }];
    for (const id of ids) {
      const m = all.find((q) => q.id === id), f = m && frontStop(m, view.lat, view.lon, all);
      if (f) stops.push({ id, name: m.name, lat: +f.lat.toFixed(6), lon: +f.lon.toFixed(6), elev: null, look: Math.round(f.look), lookAlt: Math.round(f.lookAlt), at: [id] });
    }
    if (stops.length > 1) out[site] = stops;
  }
  return (cache = out);
}
/** Los puntos del sitio donde está el observador (a menos de `reach` m de alguno) y en cuál está de pie. */
export function stopsAt(lat, lon, reach = 1500) {
  for (const [site, stops] of Object.entries(allStops())) {
    const d = stops.map((s) => offsetOf(lat, lon, s.lat, s.lon).d), k = d.indexOf(Math.min(...d));
    if (d[k] <= (site === "machupicchu" ? 700 : reach)) return { site, stops, here: d[k] < 12 ? stops[k].id : null };
  }
  return null;
}
/** El punto de visita al que lleva el rótulo de un monumento (o null). */
export const stopOf = (monId) => { for (const stops of Object.values(allStops())) { const s = stops.find((q) => q.at.includes(monId)); if (s) return s; } return null; };
