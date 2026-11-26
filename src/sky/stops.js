// PUNTOS DE VISITA de cada sitio: lugares donde pararse y hacia dónde mirar, para recorrerlo saltando de uno a otro.
// Machu Picchu los trae a mano (monuments.SITE_STOPS, sobre el suelo de su maqueta). En los demás sitios con varias
// piezas se calculan: la «Vista general» es el lugar del sitio (places.SITES) y, por cada pieza principal, un punto
// frente a ella —del lado de la vista general—, a una distancia que la deja entera a la vista y fuera de las demás.
import { MONUMENTS, SITE_STOPS, footprintRadius, offsetOf, apexOf } from "./monuments.js";
import { SITES } from "./places.js";
import { LIDAR_SITES } from "./lidarSites.js";
import { LIDAR_PLAN } from "./lidarPlan.js";

// sitio → [lugar de la vista general, piezas principales] (solo piezas que se pisan a ras de suelo)
const AUTO = {
  teotihuacan: ["teotihuacan", ["sol", "luna"]],
  giza: ["giza", ["keops", "kefren", "micerino"]],
  // (la G queda ladera arriba: a 21 m de su cara oeste, esa cara —unos 24 m sobre los ojos— tapaba todo el cielo y
  // parecía estarse dentro. A 65 m de la cara se la ve entera)
  cochasqui: ["cochasqui", [{ id: "cq-g", dist: 133, lookAlt: 9 }, "cq-e", "cq-m", "cqm-a"]],
  // Chankillo. La «vista general» es el punto de observación oeste: la boca del corredor del edificio de observación
  // (a 3 m de donde la sitúa el mapa de Ghezzi). Las torres, a 45 m (caben varias a la vista). El punto de observación
  // este: a unos 200 m de las torres; desde él los ocasos de junio y de diciembre caen en los extremos de la fila
  // (Ghezzi y Ruggles 2007). Posición aproximada: la que cumple esas dos direcciones (197 m al este del eje).
  // «Templo desde el aire»: como desde un dron, 60 m sobre el centro del recinto (`air`), mirando hacia las torres.
  // El Templo Fortificado: dentro, en la explanada al sureste de los dos edificios circulares (a 9 m del muro más cercano), sobre
  // el suelo de su maqueta, mirando hacia ellos.
  chankillo: ["chankillo", [{ id: "chankillo-7", dist: 45, lookAlt: 13 }],
    [{ id: "este", name: { es: "Punto de observación este", en: "Eastern observing point" }, lat: -9.561131, lon: -78.225674, look: 270, lookAlt: 4, at: [] },
      { id: "recintos", name: { es: "Recintos del este", en: "Eastern buildings" }, lat: -9.562556, lon: -78.225559, look: 230, lookAlt: 0, at: ["chankillo-este"] },
      { id: "templo", name: { es: "Templo Fortificado", en: "Fortified Temple" }, lat: -9.557105, lon: -78.235889, look: 315, lookAlt: 4, at: ["chankillo-templo"] },
      { id: "templo-aire", name: { es: "Templo desde el aire", en: "Temple from the air" }, lat: -9.556924, lon: -78.236026, look: 135, lookAlt: -38, air: 60, at: [] }],
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

// TOMAS AÉREAS (`air`: los ojos suben esos metros sobre el suelo, como desde un dron) en los sitios arqueológicos. Desde
// el centro del sitio; si es extenso, sus piezas se agrupan (k-medias, un grupo por cada 700 m de extensión, hasta 4) y
// cada grupo tiene la suya, sobre su centro. Altura: la mitad de su radio más 25 m (40 a 220 m) y siempre 40 m por encima
// de lo más alto que quede justo debajo. Mira hacia la pieza principal del grupo (la de mayor planta); si está debajo,
// mira hacia abajo, casi en vertical. Un grupo que ya tiene su toma escrita a mano (el templo de Chankillo) no lleva otra.
const AIR_SITES = [...Object.keys(LIDAR_PLAN).filter((k) => !LIDAR_PLAN[k].own), "teotihuacan", "chichenitza", "giza", "stonehenge", "newgrange", "ingapirca", "maeshowe", "abusimbel", "karnak",
  "angkorwat", "coliseo", "cochasqui", "machupicchu", "chankillo", "catequilla", "tiwanaku"];
const named = (m) => m.label !== false && m.name && m.name.es;
// (Machu Picchu: la planta de la llaqta abarca casi todo el sitio, de unos 500 m: una sola toma, sobre su centro)
const AIR_K = { machupicchu: 1 }, AIR_H = { machupicchu: 120 };
// (además, en un sitio grande con muchos rincones, tomas más bajas por sector: sobre el centro de sus piezas —`over`—, a
// `air` metros, mirando hacia `toward`. Machu Picchu: desde 120 m la ciudad se ve entera pero lejana)
const AIR_EXTRA = {
  machupicchu: [
    { id: "aire-sagrado", es: "Desde el aire · Sector sagrado", en: "From the air · Sacred sector", over: ["intihuatana", "mp-templo-principal", "mp-tres-ventanas"], toward: ["mp-plaza"], air: 70 },
    { id: "aire-plaza", es: "Desde el aire · Plaza Principal", en: "From the air · Main Plaza", over: ["mp-plaza", "mp-tres-portadas", "mp-espejos"], toward: ["mp-templo-principal"], air: 70 },
    { id: "aire-urbano", es: "Desde el aire · Torreón y Cóndor", en: "From the air · Torreón and Condor", over: ["mp-torreon", "mp-casa-inca", "mp-condor"], toward: ["mp-plaza"], air: 70 },
    { id: "aire-puerta", es: "Desde el aire · Puerta de la Ciudad", en: "From the air · City Gate", over: ["mp-puerta", "mp-roca-funeraria"], toward: ["mp-plaza"], air: 80 },
    { id: "aire-roca", es: "Desde el aire · Roca Sagrada", en: "From the air · Sacred Rock", over: ["mp-roca-sagrada"], toward: ["mp-plaza"], air: 70 },
  ],
};
function extraAir(site) {
  const byId = (id) => MONUMENTS.find((m) => m.id === id), mean = (ids) => { const L = ids.map(byId).filter(Boolean); return [L.reduce((a, m) => a + m.lat, 0) / L.length, L.reduce((a, m) => a + m.lon, 0) / L.length]; };
  return (AIR_EXTRA[site] || []).map((x) => {
    const [lat, lon] = mean(x.over), [tl, tn] = mean(x.toward), o = offsetOf(lat, lon, tl, tn);
    return { id: x.id, name: { es: x.es, en: x.en }, lat: +lat.toFixed(6), lon: +lon.toFixed(6), elev: null, look: Math.round(o.az),
      lookAlt: Math.max(-60, Math.min(-25, -Math.round(Math.atan2(x.air, o.d) / RAD))), air: x.air, at: [] };
  });
}
export function aerialStops(site, existing = []) {
  const ms = MONUMENTS.filter((m) => (m.site || m.id) === site);
  if (!ms.length) return [];
  const la0 = ms.reduce((a, m) => a + m.lat, 0) / ms.length, lo0 = ms.reduce((a, m) => a + m.lon, 0) / ms.length;
  // (el suelo LiDAR de un sitio abarca cientos de metros: para encuadrar la toma cuenta el radio de lo que se viene a ver —`airR`—, no el de la maqueta)
  const P = ms.map((m) => { const o = offsetOf(la0, lo0, m.lat, m.lon); return { m, e: o.e, n: o.n, r: m.lidar ? m.airR || 0 : footprintRadius(m) || 0 }; });
  let D = 0; for (const a of P) for (const b of P) D = Math.max(D, Math.hypot(a.e - b.e, a.n - b.n) + a.r + b.r);
  const k = AIR_K[site] || Math.max(1, Math.min(4, Math.ceil(D / 700)));
  // k-medias: la primera semilla, la primera pieza del sitio; cada siguiente, la pieza más alejada de las ya elegidas (siempre sale igual)
  const C = [{ e: P[0].e, n: P[0].n }];
  while (C.length < k) { let best = null, bd = -1; for (const p of P) { const d = Math.min(...C.map((c) => Math.hypot(p.e - c.e, p.n - c.n))); if (d > bd) { bd = d; best = p; } } C.push({ e: best.e, n: best.n }); }
  let lab = P.map(() => 0);
  for (let it = 0; it < 20; it++) {
    lab = P.map((p) => { let bi = 0, bd = Infinity; C.forEach((c, i) => { const d = Math.hypot(p.e - c.e, p.n - c.n); if (d < bd) { bd = d; bi = i; } }); return bi; });
    C.forEach((c, i) => { const g = P.filter((_, j) => lab[j] === i); if (!g.length) return; const w = g.reduce((a, p) => a + p.r + 10, 0); c.e = g.reduce((a, p) => a + p.e * (p.r + 10), 0) / w; c.n = g.reduce((a, p) => a + p.n * (p.r + 10), 0) / w; });
  }
  const out = [];
  C.forEach((c, i) => {
    const g = P.filter((_, j) => lab[j] === i); if (!g.length) return;
    // (si coincide con un punto en tierra —en Stonehenge y el Coliseo la vista general es el centro mismo—, se aparta de
    // él hasta quedar a 10 m: así, de pie en ese punto, no se sube al aire)
    let ce = c.e, cn = c.n;
    for (let it = 0; it < 4; it++) {
      const [la1, lo1] = at(la0, lo0, ce, cn), hit = existing.find((q) => !q.air && offsetOf(la1, lo1, q.lat, q.lon).d < 10);
      if (!hit) break;
      const o = offsetOf(hit.lat, hit.lon, la1, lo1), u = o.d > 0.5 ? [o.e / o.d, o.n / o.d] : [0, 1];
      ce += u[0] * (10.5 - o.d); cn += u[1] * (10.5 - o.d);
    }
    const [lat, lon] = at(la0, lo0, ce, cn), rc = Math.max(...g.map((p) => Math.hypot(p.e - c.e, p.n - c.n) + p.r));
    if (!LIDAR_PLAN[site] && existing.some((q) => q.air && offsetOf(lat, lon, q.lat, q.lon).d < Math.max(rc, 60))) return;
    // (`airH` en la pieza del suelo LiDAR: altura fija de la toma, para que quepa el foso o el anillo entero)
    const airH = AIR_H[site] || (g.map((p) => p.m.airH).find((v) => v > 0)) || 0;
    let air = airH || Math.min(220, Math.max(40, 0.5 * rc + 25));
    // (la pieza principal: con nombre y que no sea un muro bajo —las torres, no el edificio de observación—; si no, la de mayor planta)
    const main = g.filter((p) => named(p.m) && p.m.kind !== "walls").sort((a, b) => b.r - a.r)[0] || g.filter((p) => named(p.m)).sort((a, b) => b.r - a.r)[0] || g[0];
    // (el suelo LiDAR no es un obstáculo: su «alto» es el del terreno, que ya cuenta en la altura de la toma)
    const topOf = (m) => (m.lidar ? 0 : m.labelAt ? m.height || 0 : apexOf(m)[2] || m.height || 0);
    // EN DIAGONAL, NO DESDE EL CENIT: si la toma cae sobre una pieza alta (una pirámide, El Castillo), se aparta a un
    // costado hasta ver la pieza principal de lado y desde arriba, como la de Kefrén (que no se toca: no cae sobre la cima): a su radio más vez y media su
    // alto, en la dirección del resto del grupo o, si no hay, hacia el suroeste. Las piezas bajas (un recinto, una
    // plaza) sí se ven bien desde encima
    let le = ce, ln = cn;
    let moved = false;
    if (!airH && g.some((p) => topOf(p.m) >= 8 && Math.hypot(p.e - ce, p.n - cn) <= 0.6 * p.r + 5)) {
      moved = true;
      const rest = g.filter((p) => p !== main), mx = rest.length ? rest.reduce((a, p) => a + p.e, 0) / rest.length : main.e - 1, my = rest.length ? rest.reduce((a, p) => a + p.n, 0) / rest.length : main.n - 1;
      let ux = mx - main.e, uy = my - main.n, ul = Math.hypot(ux, uy);
      if (ul < 20) { ux = -Math.SQRT1_2; uy = -Math.SQRT1_2; ul = 1; }
      const D = main.r + 1.5 * Math.max(20, topOf(main.m)) + 20;
      le = main.e + (ux / ul) * D; ln = main.n + (uy / ul) * D;
      air = Math.max(40, Math.min(220, topOf(main.m) * 1.3 + 30));
    }
    const [lat2, lon2] = at(la0, lo0, le, ln);
    for (const p of g) if (Math.hypot(p.e - le, p.n - ln) <= p.r + 5) air = Math.max(air, topOf(p.m) + 40);
    const o = offsetOf(lat2, lon2, main.m.lat, main.m.lon);
    const look = o.d > 25 ? Math.round(o.az) : 0, lookAlt = o.d > 25 ? Math.max(-75, Math.min(-15, -Math.round(Math.atan2(moved ? air - topOf(main.m) * 0.4 : air, o.d) / RAD))) : -65;
    const nm = C.length > 1 && named(main.m) ? main.m.name : null;
    out.push({ id: `aire-${i + 1}`, name: nm ? { es: `Desde el aire · ${nm.es}`, en: `From the air · ${nm.en || nm.es}` } : { es: "Desde el aire", en: "From the air" },
      lat: +lat2.toFixed(6), lon: +lon2.toFixed(6), elev: null, look, lookAlt, air: Math.round(air), at: [] });
  });
  return out;
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
  // los sitios con suelo LiDAR (lidarPlan.js): la vista general —su lugar— mirando hacia lo que se viene a ver, y sus
  // puntos propios, dados en metros desde el origen de la maqueta
  for (const [site, P] of Object.entries(LIDAR_PLAN)) {
    const view = SITES.find((s) => s.id === site), L = LIDAR_SITES[site]; if (!view || !L) continue;
    const stops = out[site] ? [...out[site]] : [{ id: "vista", name: { es: "Vista general", en: "Overview" }, lat: view.lat, lon: view.lon, elev: view.elev ?? null, at: P.own ? [] : [site],
      ...(P.look != null ? { look: P.look, lookAlt: P.lookAlt != null ? P.lookAlt : 2 } : {}) }];
    for (const q of P.stops || []) {
      const [la, lo] = at(L.lat, L.lon, q.at[0], q.at[1]);
      stops.push({ id: q.id, name: { es: q.es, en: q.en }, lat: +la.toFixed(6), lon: +lo.toFixed(6), elev: null, look: q.look, lookAlt: q.lookAlt != null ? q.lookAlt : 2, ...(q.air ? { air: q.air } : {}), at: q.for || [] });
    }
    out[site] = stops;
  }
  // las tomas aéreas; los sitios que no tenían puntos de visita estrenan la vista general y la toma aérea
  for (const site of AIR_SITES) {
    let stops = out[site];
    if (!stops) {
      const view = SITES.find((s) => s.id === site); if (!view) continue;
      stops = [{ id: "vista", name: { es: "Vista general", en: "Overview" }, lat: view.lat, lon: view.lon, elev: view.elev ?? null, at: [] }];
    }
    // (`noAuto`: Newark, de 1 km, trae sus tomas aéreas a mano y no lleva la automática)
    const auto = LIDAR_PLAN[site] && LIDAR_PLAN[site].noAuto ? [] : aerialStops(site, stops);
    out[site] = [...stops, ...auto, ...extraAir(site)];
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
