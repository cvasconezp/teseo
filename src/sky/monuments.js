// monuments.js — monumentos astronómicos y arqueológicos dibujados en el cielo de «Mi cielo», con sus medidas
// reales y en su sitio exacto. Puro (sin three.js): datos, geometría en metros y proyección al cielo del lugar.
// Se prueba en scripts/test_monuments.mjs; la capa que los pinta es src/sky/monumentLayer.js.
//
// Medidas: alto y lado de la base de cada monumento (Wikipedia y fichas de los sitios); la forma es
// simplificada (cuerpos escalonados sin escaleras ni templos menores, piedras como bloques). Posición: el centro
// de cada pirámide se comprobó con el modelo de relieve (SRTM: el bulto de la pirámide), salvo El Castillo y
// Micerino (donde el modelo mezcla árboles o la ladera; coordenadas de Wikipedia). La base se asienta sobre el
// suelo del mismo modelo (el servidor da la altura del terreno alrededor: /api/elevation).
//
// Marco local: E (este), N (norte), U (arriba), en metros desde el centro de la base del monumento.

const RAD = Math.PI / 180;
const R_E = 6371008.8, K_REFR = 0.13;
export const EYE_M = 1.7;

// colores (sRGB 0–1) de la piedra a pleno sol
const BASALT = [0.55, 0.5, 0.46];      // Teotihuacan: piedra volcánica y estuco perdido
const LIMESTONE = [0.82, 0.74, 0.58];  // Guiza: caliza
const YUCATAN = [0.8, 0.77, 0.68];     // Chichén Itzá: caliza clara
const SARSEN = [0.62, 0.61, 0.56];     // Stonehenge: arenisca sarsen
const QUARTZ = [0.9, 0.89, 0.86];      // Newgrange: muro de cuarzo
const GRASS = [0.42, 0.55, 0.3];       // Newgrange: el túmulo con hierba

/**
 * Monumentos. `kind`: stepped (cuerpos escalonados), pyramid (caras lisas), stonehenge, mound (túmulo).
 * `rot`: giro de la planta en grados hacia el este desde el norte (Teotihuacan: 15,5°, la orientación de la
 * Calzada de los Muertos). `site`: id del sitio de places.js desde donde se suele mirar.
 */
export const MONUMENTS = [
  { id: "sol", site: "teotihuacan", name: { es: "Pirámide del Sol", en: "Pyramid of the Sun" }, lat: 19.69240, lon: -98.84360,
    kind: "stepped", base: 225, top: 30, height: 65, tiers: 4, rot: 15.5, color: BASALT, solid: true },
  { id: "luna", site: "teotihuacan", name: { es: "Pirámide de la Luna", en: "Pyramid of the Moon" }, lat: 19.69969, lon: -98.84395,
    kind: "stepped", base: 145, top: 22, height: 43, tiers: 4, rot: 15.5, color: BASALT, solid: true },
  { id: "castillo", site: "chichenitza", name: { es: "El Castillo (Kukulcán)", en: "El Castillo (Kukulcan)" }, lat: 20.68290, lon: -88.56865,
    kind: "stepped", base: 55.3, top: 19.5, height: 24, tiers: 9, rot: 17, color: YUCATAN, solid: true, temple: { w: 13, h: 6 } },
  { id: "keops", site: "giza", name: { es: "Pirámide de Keops", en: "Pyramid of Khufu" }, lat: 29.97917, lon: 31.13417,
    kind: "pyramid", base: 230.3, top: 10, height: 138.5, rot: 0, color: LIMESTONE, solid: true },
  { id: "kefren", site: "giza", name: { es: "Pirámide de Kefrén", en: "Pyramid of Khafre" }, lat: 29.97593, lon: 31.13092,
    kind: "pyramid", base: 215.3, top: 0, height: 136.4, rot: 0, color: LIMESTONE, solid: true },
  { id: "micerino", site: "giza", name: { es: "Pirámide de Micerino", en: "Pyramid of Menkaure" }, lat: 29.97250, lon: 31.12806,
    kind: "pyramid", base: 103.4, top: 4, height: 61, rot: 0, color: LIMESTONE, solid: true },
  { id: "stonehenge", site: "stonehenge", name: { es: "Stonehenge", en: "Stonehenge" }, lat: 51.178844, lon: -1.826189,
    kind: "stonehenge", axis: 49.9, height: 6.7, color: SARSEN, solid: false },
  { id: "newgrange", site: "newgrange", name: { es: "Newgrange", en: "Newgrange" }, lat: 53.69509, lon: -6.47531,
    kind: "mound", radius: 42.5, wall: 3, height: 13.5, color: GRASS, wallColor: QUARTZ, solid: true },
];

/** Radio (m) de la planta: hasta él no se puede estar «dentro» del monumento. */
export function footprintRadius(m) {
  if (m.kind === "mound") return m.radius;
  if (m.kind === "stonehenge") return 0;              // se puede estar en el centro del círculo
  return (m.base / 2) * Math.SQRT2;
}

/** Distancia (m) y acimut (°) del lugar al monumento (aproximación local, suficiente a menos de 50 km). */
export function offsetOf(lat0, lon0, lat, lon) {
  const n = (lat - lat0) * RAD * R_E, e = (lon - lon0) * RAD * R_E * Math.cos(((lat + lat0) / 2) * RAD);
  return { e, n, d: Math.hypot(e, n), az: ((Math.atan2(e, n) / RAD) + 360) % 360 };
}

/** Monumentos a menos de `km` del lugar (y fuera de su planta), del más cercano al más lejano. */
export function monumentsNear(lat, lon, km = 20) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  return MONUMENTS.map((m) => ({ m, o: offsetOf(lat, lon, m.lat, m.lon) }))
    .filter(({ m, o }) => o.d <= km * 1000 && (m.kind === "stonehenge" || o.d > footprintRadius(m) + 3))
    .sort((a, b) => a.o.d - b.o.d).map(({ m }) => m);
}

/** Puntos donde medir el suelo alrededor de un monumento (fuera de su bulto en el modelo de relieve). */
export function groundRing(m, n = 8) {
  const r = Math.max(25, footprintRadius(m) + 30);
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI;
    out.push([m.lat + (r * Math.cos(a)) / (R_E * RAD), m.lon + (r * Math.sin(a)) / (R_E * RAD * Math.cos(m.lat * RAD))]);
  }
  return out;
}
export const median = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

// ── geometría (triángulos en E, N, U) ────────────────────────────────────────────────────────────────────
const rotP = (p, r) => { const c = Math.cos(r * RAD), s = Math.sin(r * RAD); return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c, p[2]]; };
function quad(out, a, b, c, d, col) { out.push({ v: [a, b, c], c: col }, { v: [a, c, d], c: col }); }

/** Tronco de pirámide (planta rectangular girada `rot`, centrada en (ce, cn)) entre las alturas z0 y z1. */
function frustum(out, { ce = 0, cn = 0, z0, z1, w0, d0 = w0, w1, d1 = w1, rot = 0, col, top = true }) {
  const P = (w, d, z, sx, sy) => { const p = rotP([sx * w / 2, sy * d / 2, z], rot); return [p[0] + ce, p[1] + cn, z]; };
  const b = [P(w0, d0, z0, -1, -1), P(w0, d0, z0, 1, -1), P(w0, d0, z0, 1, 1), P(w0, d0, z0, -1, 1)];
  const t = [P(w1, d1, z1, -1, -1), P(w1, d1, z1, 1, -1), P(w1, d1, z1, 1, 1), P(w1, d1, z1, -1, 1)];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(out, b[i], b[j], t[j], t[i], col); }
  if (top && (w1 > 0 || d1 > 0)) quad(out, t[0], t[1], t[2], t[3], col);
}

/** Bloque (piedra) de ancho w (tangencial), grueso t (radial) y alto h, centrado en (e, n), girado `rot`. */
function block(out, e, n, z0, h, w, t, rot, col) { frustum(out, { ce: e, cn: n, z0, z1: z0 + h, w0: w, d0: t, w1: w, d1: t, rot, col }); }

/** Triángulos del monumento: [{ v: [[e, n, u] × 3], c: color }]. */
export function buildFaces(m) {
  const out = [], col = m.color;
  if (m.kind === "pyramid") {
    frustum(out, { z0: 0, z1: m.height, w0: m.base, w1: m.top || 0, rot: m.rot, col, top: m.top > 0 });
  } else if (m.kind === "stepped") {
    // cuerpos escalonados: cada uno con talud (se estrecha al subir) y una terraza antes del siguiente
    const n = m.tiers, h = m.height / n;
    for (let i = 0; i < n; i++) {
      const wb = m.base - ((m.base - m.top) * i) / n, wn = m.base - ((m.base - m.top) * (i + 1)) / n;
      const wt = wb - (wb - wn) * 0.72;
      frustum(out, { z0: i * h, z1: (i + 1) * h, w0: wb, w1: wt, rot: m.rot, col });
    }
    if (m.temple) block(out, 0, 0, m.height, m.temple.h, m.temple.w, m.temple.w, m.rot, col);
  } else if (m.kind === "mound") {
    // túmulo: muro de cuarzo (vertical) y encima la cúpula de hierba, casi plana arriba
    const seg = 48, rings = 7;
    const ring = (r, z) => Array.from({ length: seg }, (_, k) => { const a = (k / seg) * 2 * Math.PI; return [r * Math.sin(a), r * Math.cos(a), z]; });
    const b0 = ring(m.radius, 0), b1 = ring(m.radius, m.wall);
    for (let k = 0; k < seg; k++) { const j = (k + 1) % seg; quad(out, b0[k], b0[j], b1[j], b1[k], m.wallColor); }
    let prev = b1;
    for (let i = 1; i <= rings; i++) {
      const f = i / rings, r = m.radius * (1 - f), z = m.wall + (m.height - m.wall) * Math.pow(1 - Math.pow(1 - f, 2.2), 0.55);
      if (i === rings) { for (let k = 0; k < seg; k++) out.push({ v: [prev[k], prev[(k + 1) % seg], [0, 0, m.height]], c: col }); break; }
      const cur = ring(r, z);
      for (let k = 0; k < seg; k++) { const j = (k + 1) % seg; quad(out, prev[k], prev[j], cur[j], cur[k], col); }
      prev = cur;
    }
  } else if (m.kind === "stonehenge") {
    stonehenge(out, m);
  }
  return out;
}

// Stonehenge tal como está hoy (simplificado): el círculo de sarsen (30 piedras de 4,1 m, numeradas en el sentido
// de las agujas del reloj desde la entrada, en el eje del solsticio de verano, acimut ~49,9°) con las que siguen en
// pie y sus dinteles; la herradura de los cinco trilitos abierta hacia el noreste (en pie, con dintel, 51-52, 53-54
// y 57-58; del gran trilito queda la 56; del último, la 60) y la Piedra del Talón a 77 m, cerca del eje.
export const SH_STANDING = [1, 2, 3, 4, 5, 6, 7, 10, 11, 16, 21, 22, 23, 27, 28, 29, 30];
export const SH_LINTELS = [[29, 30], [30, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [21, 22]];
function stonehenge(out, m) {
  const R = 15.6, ax = m.axis, col = m.color;
  const azOf = (k) => ax + 6 + (k - 1) * 12;               // la 1 y la 30 flanquean la entrada
  const at = (az, r) => [r * Math.sin(az * RAD), r * Math.cos(az * RAD)];
  for (const k of SH_STANDING) { const [e, n] = at(azOf(k), R); block(out, e, n, 0, 4.1, 2.1, 1.1, azOf(k), col); }
  for (const [a, b] of SH_LINTELS) {
    const az = (azOf(a) + (((azOf(b) - azOf(a)) % 360) + 360) % 360 / 2), [e, n] = at(az, R);
    block(out, e, n, 4.1, 0.8, 2 * R * Math.sin(6 * RAD) + 1.4, 1.0, az, col);
  }
  // trilitos: [acimut desde el centro, radio, alto, ¿izquierda en pie?, ¿derecha en pie?, ¿dintel?]
  // (alto de las piedras en pie: 5,2 y 5,6 m con dinteles de 0,9 m, ~6,1 y 6,5 m en total; del gran trilito, que
  // con su dintel llegaba a 7,3 m, queda en pie la piedra 56, de 6,7 m)
  const TRI = [[ax + 64, 8.8, 5.2, true, true, true], [ax + 118, 8.0, 5.6, true, true, true], [ax + 180, 7.4, 6.7, false, true, false],
    [ax + 242, 8.0, 5.6, true, true, true], [ax + 296, 8.8, 5.2, false, true, false]];
  for (const [az, r, h, l, rr, lin] of TRI) {
    const [e, n] = at(az, r), tx = Math.cos(az * RAD), ty = -Math.sin(az * RAD);   // tangente
    if (l) block(out, e - tx * 1.25, n - ty * 1.25, 0, h, 2.2, 1.2, az, col);
    if (rr) block(out, e + tx * 1.25, n + ty * 1.25, 0, h, 2.2, 1.2, az, col);
    if (lin) block(out, e, n, h, 0.9, 4.9, 1.1, az, col);
  }
  const [he, hn] = at(51.3, 77);
  block(out, he, hn, 0, 4.7, 2.4, 2.1, 51.3, col);
}

/** Lo más alto del monumento (para el nombre): [e, n, u]. */
export function apexOf(m) {
  if (m.kind === "stonehenge") return [0, 0, m.height];
  return [0, 0, m.height + (m.temple ? m.temple.h : 0)];
}

// ── proyección al cielo del lugar ──────────────────────────────────────────────────────────────────────────
/**
 * Punto del monumento en el marco del observador: [x, y, z] = [este, arriba, −norte] en metros, con la
 * curvatura de la Tierra (y la refracción estándar) como el horizonte. `o`: offsetOf(lugar → monumento);
 * `dz`: altura de la base sobre los ojos del observador.
 */
export function toLocal(p, o, dz) {
  const e = o.e + p[0], n = o.n + p[1], d2 = e * e + n * n;
  return [e, p[2] + dz - (d2 * (1 - K_REFR)) / (2 * R_E), -n];
}
export const altAzOf = (v) => ({ az: ((Math.atan2(v[0], -v[2]) / RAD) + 360) % 360, alt: Math.atan2(v[1], Math.hypot(v[0], v[2])) / RAD });

/**
 * Silueta angular de los monumentos macizos: para cada paso de acimut, la altura (°) más alta que tapan.
 * `items`: [{ m, o, dz }]. Devuelve Float32Array con −90 donde no hay monumento.
 */
export function silhouette(items, step = 0.2) {
  const n = Math.round(360 / step), out = new Float32Array(n).fill(-90);
  for (const { m, o, dz, faces } of items) {
    if (!m.solid) continue;
    for (const f of faces || buildFaces(m)) {
      for (let i = 0; i < 3; i++) {
        const a = toLocal(f.v[i], o, dz), b = toLocal(f.v[(i + 1) % 3], o, dz);
        const A = altAzOf(a), B = altAzOf(b);
        let dAz = ((B.az - A.az + 540) % 360) - 180;
        const k = Math.min(600, Math.max(2, Math.ceil(Math.abs(dAz) / (step / 2)) + Math.ceil(Math.abs(B.alt - A.alt) / 0.2)));
        for (let s = 0; s <= k; s++) {
          const t = s / k, v = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
          const q = altAzOf(v), j = Math.round(q.az / step) % n;
          if (q.alt > out[j]) out[j] = q.alt;
        }
      }
    }
  }
  return out;
}

/** El horizonte con los monumentos: copia de `hz` cuyo perfil total (alt) incluye la silueta `sil`. */
export function withMonuments(hz, sil) {
  if (!hz || !sil) return hz;
  const n = hz.alt.length;
  if (sil.length !== n) return hz;
  let any = false;
  const alt = hz.alt.map((a, i) => { if (sil[i] > a) { any = true; return Math.round(sil[i] * 100) / 100; } return a; });
  return any ? { ...hz, alt, monuments: true } : hz;
}
