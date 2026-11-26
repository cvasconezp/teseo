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
  // Chankillo. La «vista general» es el punto de observación oeste: la boca del corredor del edificio de observación
  // (a 3 m de donde la sitúa el mapa de Ghezzi). Las torres, a 45 m (caben varias a la vista). El punto de observación
  // este: a unos 200 m de las torres; desde él los ocasos de junio y de diciembre caen en los extremos de la fila
  // (Ghezzi y Ruggles 2007). Posición aproximada: la que cumple esas dos direcciones (197 m al este del eje).
  // El Templo Fortificado: dentro, en lo más alto del edificio circular del sur, sobre el suelo de su maqueta.
  chankillo: ["chankillo", [{ id: "chankillo-7", dist: 45, lookAlt: 13 }],
    [{ id: "este", name: { es: "Punto de observación este", en: "Eastern observing point" }, lat: -9.561131, lon: -78.225674, look: 270, lookAlt: 4, at: [] },
      { id: "recintos", name: { es: "Recintos del este", en: "Eastern buildings" }, lat: -9.562556, lon: -78.225559, look: 230, lookAlt: 0, at: ["chankillo-este"] },
      { id: "templo", name: { es: "Templo Fortificado", en: "Fortified Temple" }, lat: -9.556881, lon: -78.236106, look: 27, lookAlt: -6, at: ["chankillo-templo"] }],
    { name: { es: "Punto de observación oeste", en: "Western observing point" }, look: 90, lookAlt: 3, at: ["chankillo-obs"] }],
  catequilla: ["catequilla", ["catequilla-muro", "catequilla-disco"]],
  paranal: ["paranal", ["vlt-ut1", "vlt-ut4"]],
  // (Tiwanaku: la vista general ya es el frente de Kalasasaya, con su escalinata y su portada; Akapana se mira
  // desde el este, que es por donde queda despejada: entre ella y Kalasasaya solo hay 22 m)
  tiwanaku: ["tiwanaku", [{ id: "akapana", az: 90 }]],
};
const RAD = Math.PI / 180;
const at = (lat, lon, e, n) => [lat + n / 110574, lon + e / (111320 * Math.cos(lat * RAD))];

/** Lo que sobresale la pieza desde su centro hacia el rumbo `az` (m): media planta si es rectangular; si no, su radio. */
function extentToward(m, az) {
  if (!(m.w > 0 && m.d > 0)) return footprintRadius(m);
  const t = (az - (m.rot || 0)) * RAD;
  return Math.abs(Math.sin(t)) * m.w / 2 + Math.abs(Math.cos(t)) * m.d / 2;
}
/** ¿Cae [lat, lon] sobre la planta de la pieza `q` (con `margin` m de holgura)? Rectángulo girado si tiene w y d; si no, círculo. */
export function onPiece(q, lat, lon, margin = 3) {
  const o = offsetOf(q.lat, q.lon, lat, lon);
  if (!(q.w > 0 && q.d > 0)) return o.d < footprintRadius(q) + margin;
  const t = (o.az - (q.rot || 0)) * RAD, x = o.d * Math.sin(t), y = o.d * Math.cos(t);
  return Math.abs(x) < q.w / 2 + margin && Math.abs(y) < q.d / 2 + margin;
}
/**
 * Punto frente a la pieza `m`: { lat, lon, look, lookAlt, d } (o null si no cabe). Por defecto, del lado de la vista
 * general [vlat, vlon]; con `side` (rumbo desde la pieza), de ese lado. La distancia deja la pieza entera a la vista.
 */
export function frontStop(m, vlat, vlon, others = [], side = null, dist = null) {
  const o = offsetOf(m.lat, m.lon, vlat, vlon), h = m.height || 3, az0 = side != null ? side : o.az;
  for (const da of [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90]) {
    // (las piezas que no se asientan sobre el relieve —`seat`— allanan el suelo dentro de su radio: desde ahí dentro no
    // se ven bien, así que el punto queda fuera de él; las asentadas —las tolas de Cochasquí— admiten acercarse a la fachada)
    const gap = Math.min(40, Math.max(6, h * 1.5)), az = az0 + da;
    const d = dist != null ? dist : Math.max((m.seat ? extentToward(m, az) : footprintRadius(m) * 1.05) + gap, 8);
    const b = az * RAD, [lat, lon] = at(m.lat, m.lon, d * Math.sin(b), d * Math.cos(b));
    // (si queda casi donde la vista general, no aporta: sería la misma vista)
    if (side == null && offsetOf(vlat, vlon, lat, lon).d < Math.max(40, 0.3 * o.d)) return null;
    if (others.some((q) => q !== m && onPiece(q, lat, lon))) continue;
    return { lat, lon, look: ((az + 180) % 360 + 360) % 360, lookAlt: Math.min(25, Math.max(2, Math.atan2(h * 0.45, d - extentToward(m, az) * 0.5) / RAD)), d };
  }
  return null;
}

let cache = null;
/** Todos los puntos de visita: { sitio: [{ id, name: { es, en }, lat, lon, elev, look, lookAlt, at: [ids de rótulos] }] }. */
export function allStops() {
  if (cache) return cache;
  const out = { ...SITE_STOPS };
  for (const [site, [viewId, ids, extra, vo]] of Object.entries(AUTO)) {
    const view = SITES.find((s) => s.id === viewId), all = MONUMENTS.filter((m) => m.site === site && m.kind !== "walls" && !m.modelOnly);   // (los muros bajos y las maquetas se pisan: no estorban)
    if (!view) continue;
    const stops = [{ id: "vista", name: { es: "Vista general", en: "Overview" }, lat: view.lat, lon: view.lon, elev: view.elev ?? null, at: [], ...(vo || {}) }];
    for (const it of ids) {
      const id = it.id || it, m = all.find((q) => q.id === id), f = m && frontStop(m, view.lat, view.lon, all, it.az != null ? it.az : null, it.dist != null ? it.dist : null);
      if (f) stops.push({ id, name: m.name, lat: +f.lat.toFixed(6), lon: +f.lon.toFixed(6), elev: null, look: Math.round(f.look), lookAlt: it.lookAlt != null ? it.lookAlt : Math.round(f.lookAlt), at: [id] });
    }
    for (const x of extra || []) stops.push({ elev: null, ...x });
    if (stops.length > 1) out[site] = stops;
  }
  return (cache = out);
}
/** Los puntos del sitio donde está el observador (a menos de `reach` m de alguno) y en cuál está de pie. Si dos
 *  sitios quedan al alcance, el MÁS CERCANO (no el primero de la tabla). `table` solo para las pruebas. */
export function stopsAt(lat, lon, reach = 1500, table = allStops()) {
  let best = null, bestD = Infinity;
  for (const [site, stops] of Object.entries(table)) {
    const d = stops.map((s) => offsetOf(lat, lon, s.lat, s.lon).d), k = d.indexOf(Math.min(...d));
    if (d[k] <= (site === "machupicchu" ? 700 : reach) && d[k] < bestD) { bestD = d[k]; best = { site, stops, here: d[k] < 12 ? stops[k].id : null }; }
  }
  return best;
}
/** El punto de visita al que lleva el rótulo de un monumento (o null). */
export const stopOf = (monId) => { for (const stops of Object.values(allStops())) { const s = stops.find((q) => q.at.includes(monId)); if (s) return s; } return null; };
