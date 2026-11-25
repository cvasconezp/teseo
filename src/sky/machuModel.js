// La maqueta «Machupicchu» del Ministerio de Cultura del Perú (Sketchfab, CC BY 4.0), encajada sobre la planta de
// OpenStreetMap por scripts/build_machu_maqueta.py (ver allí los cambios: encaje, cota, corrimiento del sector oeste).
// El archivo (public/data/machu-maqueta.bin, ~0,3 MB) solo se descarga al estar en Machu Picchu.
// Coordenadas: [este, norte] en m desde el nodo del Intihuatana (MP0) y altura sobre el nivel del mar.
export const MODEL_CREDIT = "Ministerio de Cultura Perú · «Machupicchu» (Sketchfab) · CC BY 4.0";
export const MODEL_BASE_M = 2400;                 // las alturas del archivo van referidas a esta cota
export const MODEL_MATS = ["wall", "grass", "riser", "floor", "roof", "wood", "channel"];   // clase → nombre
const U = 0.02;                                   // unidad del archivo: 2 cm
let model = null, pending = null;

/** Lee el .bin → { nv, nt, v: Int16Array, f: Uint16Array, cls: Uint8Array } y prepara la consulta de suelo. */
export function parseMachuModel(buf) {
  const dv = new DataView(buf), nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
  const v = new Int16Array(buf.slice(8, 8 + nv * 6)), f = new Uint16Array(buf.slice(8 + nv * 6, 8 + nv * 6 + nt * 6)), cls = new Uint8Array(buf, 8 + nv * 6 + nt * 6, nt);
  // índice de los triángulos pisables (hierba y pisos, no verticales) por celdas de 8 m
  const CELL = 8, cells = new Map(), walk = [];
  for (let t = 0; t < nt; t++) {
    if (cls[t] !== 1 && cls[t] !== 3) continue;
    const a = f[3 * t] * 3, b = f[3 * t + 1] * 3, c = f[3 * t + 2] * 3;
    const ax = v[a] * U, ay = v[a + 1] * U, bx = v[b] * U, by = v[b + 1] * U, cx = v[c] * U, cy = v[c + 1] * U;
    const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(det) < 1e-4) continue;             // cara vertical: no se pisa
    const k = walk.length / 10; walk.push(ax, ay, v[a + 2] * U, bx, by, v[b + 2] * U, cx, cy, v[c + 2] * U, det);
    const x0 = Math.floor(Math.min(ax, bx, cx) / CELL), x1 = Math.floor(Math.max(ax, bx, cx) / CELL), y0 = Math.floor(Math.min(ay, by, cy) / CELL), y1 = Math.floor(Math.max(ay, by, cy) / CELL);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const key = x * 4096 + y; let L = cells.get(key); if (!L) cells.set(key, (L = [])); L.push(k); }
  }
  return { nv, nt, v, f, cls, walk: new Float64Array(walk), cells, CELL };
}
export function setMachuModel(m) { model = m; }
export const machuModel = () => model;
/** Descarga la maqueta una sola vez; devuelve una promesa (null si falla: Teseo sigue con la planta de OpenStreetMap). */
export function loadMachuModel(base = "") {
  if (model) return Promise.resolve(model);
  if (!pending) pending = fetch(`${base}/data/machu-maqueta.bin`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? (model = parseMachuModel(b)) : null)).catch(() => null).then((m) => { if (!m) pending = null; return m; });
  return pending;
}
/** Altura del suelo de la maqueta (m s. n. m.) en [e, n] desde MP0: el piso más alto que hay en esa vertical; null fuera. */
export function modelGround(e, n, m = model) {
  if (!m) return null;
  const g = groundAt(e, n, m);
  if (g != null) return g;
  // justo sobre una arista o un vértice la prueba puede fallar: se mira a 25 cm alrededor
  for (const [de, dn] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) { const q = groundAt(e + de, n + dn, m); if (q != null) return q; }
  return null;
}
function groundAt(e, n, m) {
  const L = m.cells.get(Math.floor(e / m.CELL) * 4096 + Math.floor(n / m.CELL)); if (!L) return null;
  const w = m.walk; let best = null;
  for (const k of L) {
    const i = k * 10, ax = w[i], ay = w[i + 1], det = w[i + 9];
    const u = ((e - ax) * (w[i + 7] - ay) - (w[i + 6] - ax) * (n - ay)) / det, t = ((w[i + 3] - ax) * (n - ay) - (e - ax) * (w[i + 4] - ay)) / det;
    if (u < -1e-6 || t < -1e-6 || u + t > 1 + 1e-6) continue;
    const z = w[i + 2] + u * (w[i + 5] - w[i + 2]) + t * (w[i + 8] - w[i + 2]);
    if (best == null || z > best) best = z;
  }
  return best == null ? null : best + MODEL_BASE_M;
}
/** Triángulos de la maqueta para dibujar: llama a cb(a, b, c, clase) con puntos [e, n, altura − base]. */
export function eachModelFace(cb, m = model) {
  if (!m) return;
  const P = (i) => [m.v[3 * i] * U, m.v[3 * i + 1] * U, m.v[3 * i + 2] * U];
  for (let t = 0; t < m.nt; t++) cb(P(m.f[3 * t]), P(m.f[3 * t + 1]), P(m.f[3 * t + 2]), m.cls[t]);
}
