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
    kind: "stepped", base: 225, top: 30, height: 65, tiers: 4, rot: 15.5, color: BASALT, mat: "basalt", ground: "dirt", solid: true,
    stairs: [{ side: "w", w: 14, out: 7 }] },
  { id: "luna", site: "teotihuacan", name: { es: "Pirámide de la Luna", en: "Pyramid of the Moon" }, lat: 19.69969, lon: -98.84395,
    kind: "stepped", base: 145, top: 22, height: 43, tiers: 4, rot: 15.5, color: BASALT, mat: "basalt", ground: "dirt", solid: true,
    stairs: [{ side: "s", w: 12, out: 7 }] },
  { id: "castillo", site: "chichenitza", name: { es: "El Castillo (Kukulcán)", en: "El Castillo (Kukulcan)" }, lat: 20.68290, lon: -88.56865,
    kind: "stepped", base: 55.3, top: 19.5, height: 24, tiers: 9, rot: 17, color: YUCATAN, mat: "yucatan", ground: "grass", solid: true,
    temple: { w: 13, h: 6, doors: { n: 3, s: 1, e: 1, w: 1 } },
    stairs: [{ side: "n", w: 8.8, out: 4.5 }, { side: "s", w: 8.8, out: 4.5 }, { side: "e", w: 8.8, out: 4.5 }, { side: "w", w: 8.8, out: 4.5 }] },
  { id: "keops", site: "giza", name: { es: "Pirámide de Keops", en: "Pyramid of Khufu" }, lat: 29.97917, lon: 31.13417,
    kind: "pyramid", base: 230.3, top: 10, height: 138.5, rot: 0, color: LIMESTONE, mat: "blocks", ground: "sand", solid: true },
  { id: "kefren", site: "giza", name: { es: "Pirámide de Kefrén", en: "Pyramid of Khafre" }, lat: 29.97593, lon: 31.13092,
    kind: "pyramid", base: 215.3, top: 0, height: 136.4, rot: 0, color: LIMESTONE, mat: "blocks", ground: "sand", solid: true, casing: 0.78 },
  { id: "micerino", site: "giza", name: { es: "Pirámide de Micerino", en: "Pyramid of Menkaure" }, lat: 29.97250, lon: 31.12806,
    kind: "pyramid", base: 103.4, top: 4, height: 61, rot: 0, color: LIMESTONE, mat: "blocks", ground: "sand", solid: true },
  { id: "stonehenge", site: "stonehenge", name: { es: "Stonehenge", en: "Stonehenge" }, lat: 51.178844, lon: -1.826189,
    kind: "stonehenge", axis: 49.9, height: 6.7, color: SARSEN, mat: "sarsen", ground: "grass", solid: false },
  { id: "newgrange", site: "newgrange", name: { es: "Newgrange", en: "Newgrange" }, lat: 53.69509, lon: -6.47531,
    kind: "mound", radius: 42.5, wall: 3, height: 13.5, entrance: 135, color: GRASS, wallColor: QUARTZ, mat: "grass", wallMat: "quartz", ground: "grass", solid: true },
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
function quad(out, a, b, c, d, col, mat) { out.push({ v: [a, b, c], c: col, mat }, { v: [a, c, d], c: col, mat }); }

/** Tronco de pirámide (planta rectangular girada `rot`, centrada en (ce, cn)) entre las alturas z0 y z1. */
function frustum(out, { ce = 0, cn = 0, z0, z1, w0, d0 = w0, w1, d1 = w1, rot = 0, col, mat, top = true }) {
  const P = (w, d, z, sx, sy) => { const p = rotP([sx * w / 2, sy * d / 2, z], rot); return [p[0] + ce, p[1] + cn, z]; };
  const b = [P(w0, d0, z0, -1, -1), P(w0, d0, z0, 1, -1), P(w0, d0, z0, 1, 1), P(w0, d0, z0, -1, 1)];
  const t = [P(w1, d1, z1, -1, -1), P(w1, d1, z1, 1, -1), P(w1, d1, z1, 1, 1), P(w1, d1, z1, -1, 1)];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(out, b[i], b[j], t[j], t[i], col, mat); }
  if (top && (w1 > 0 || d1 > 0)) quad(out, t[0], t[1], t[2], t[3], col, mat);
}

/** Bloque (piedra) de ancho w (tangencial), grueso t (radial) y alto h, centrado en (e, n), girado `rot`. */
function block(out, e, n, z0, h, w, t, rot, col, mat) { frustum(out, { ce: e, cn: n, z0, z1: z0 + h, w0: w, d0: t, w1: w, d1: t, rot, col, mat }); }

/** Bordes de las terrazas de una pirámide escalonada: [[altura, media anchura], …]. */
export function tierEdges(m) {
  const out = [], n = m.tiers, h = m.height / n;
  for (let i = 0; i < n; i++) {
    const wb = m.base - ((m.base - m.top) * i) / n, wn = m.base - ((m.base - m.top) * (i + 1)) / n;
    out.push([(i + 1) * h, (wb - (wb - wn) * 0.72) / 2]);
  }
  return out;
}

/** Número de escalones de una escalinata de alto H con escalones de ~stepH. */
export const stairSteps = (H, stepH = 0.3) => Math.max(4, Math.round(H / stepH));

// lado de una planta: dirección hacia fuera y la transversal (marco sin girar)
const SIDE = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] };

/** Escalinata de un lado: rampa con escalones desde el suelo, `out` m fuera de la base, hasta la plataforma. */
function stair(out, m, st, top, H, stepH = 0.3) {
  const [ox, oy] = SIDE[st.side], tx = -oy, ty = ox, a1 = top / 2, hw = st.w / 2;
  // la rampa pasa por fuera de todas las terrazas (si no, sus bordes la atravesarían): su pie se aleja lo justo
  let a0 = m.base / 2 + st.out;
  for (const [z, half] of tierEdges(m)) if (z < H) a0 = Math.max(a0, (half + 0.4 - (a1 * z) / H) / (1 - z / H));
  const P = (a, t, z) => { const p = rotP([ox * a + tx * t, oy * a + ty * t, z], m.rot); return [p[0], p[1], z]; };
  // la superficie de los escalones (v sube por la pendiente) y los costados, de la piedra del monumento
  // escalones de verdad (contrahuella y huella): su alto crece con la distancia para que no titilen a lo lejos
  const ns = stairSteps(H, stepH);
  for (let i = 0; i < ns; i++) {
    const za = (H * i) / ns, zb = (H * (i + 1)) / ns, aa = a0 + ((a1 - a0) * i) / ns, ab = a0 + ((a1 - a0) * (i + 1)) / ns;
    const k0 = out.length;
    quad(out, P(aa, -hw, za), P(aa, hw, za), P(aa, hw, zb), P(aa, -hw, zb), m.color, "steps");
    quad(out, P(aa, -hw, zb), P(aa, hw, zb), P(ab, hw, zb), P(ab, -hw, zb), m.color, "steps");
    // la contrahuella recibe de lleno la luz que rebota en la huella de abajo: por eso no se ve negra a mediodía
    for (let k = k0; k < out.length; k++) { out[k].tex = m.mat; out[k].tone = k < k0 + 2 ? 2.1 : 1.05; }
  }
  for (const sg of [-1, 1]) {
    const t = sg * hw;
    out.push({ v: [P(a0, t, 0), P(a1, t, H), P(a1, t, 0)], c: m.color, mat: m.mat });
    // alfarda: un murete de 0,7 m sobre el costado
    const t2 = sg * (hw + 0.8);
    quad(out, P(a0, t, 0.7), P(a0, t2, 0.7), P(a1, t2, H), P(a1, t, H), m.color, m.mat);
    quad(out, P(a0, t2, 0), P(a0, t2, 0.7), P(a1, t2, H), P(a1, t2, H - 0.7), m.color, m.mat);
    out.push({ v: [P(a0, t, 0), P(a0, t, 0.7), P(a1, t, H)], c: m.color, mat: m.mat });
  }
}

/** Puertas del templo: rectángulos oscuros apenas delante de cada cara. */
function doors(out, m) {
  const T = m.temple, hw = T.w / 2, z0 = m.height;
  for (const side of Object.keys(T.doors || {})) {
    const k = T.doors[side], [ox, oy] = SIDE[side], tx = -oy, ty = ox, dw = k > 1 ? 1.6 : 2.0, gap = (T.w - k * dw) / (k + 1);
    for (let i = 0; i < k; i++) {
      const t0 = -hw + gap * (i + 1) + dw * i, t1 = t0 + dw, a = hw + 0.06;
      const P = (t, z) => { const p = rotP([ox * a + tx * t, oy * a + ty * t, z], m.rot); return [p[0], p[1], z]; };
      quad(out, P(t0, z0 + 0.3), P(t1, z0 + 0.3), P(t1, z0 + 3.2), P(t0, z0 + 3.2), [0.05, 0.05, 0.05], "door");
    }
  }
}

// ruido determinista (para que las piedras no sean cajas perfectas)
const hash3 = (x, y, z, s) => { const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 4.581) * 43758.5453; return h - Math.floor(h); };
// ruido suave (interpolado) en 3D, entre 0 y 1
function vnoise3(x, y, z, s) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = x - X, fy = y - Y, fz = z - Z;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(X, Y, Z, s), hash3(X + 1, Y, Z, s), u), L(hash3(X, Y + 1, Z, s), hash3(X + 1, Y + 1, Z, s), u), v),
    L(L(hash3(X, Y, Z + 1, s), hash3(X + 1, Y, Z + 1, s), u), L(hash3(X, Y + 1, Z + 1, s), hash3(X + 1, Y + 1, Z + 1, s), u), v), w);
}

/**
 * Piedra tallada a mano y gastada por el tiempo: sección de esquinas redondeadas (superelipse), más estrecha
 * arriba, con bultos suaves a dos escalas (~1 m y ~30 cm), el canto de arriba redondeado e irregular y el pie
 * algo hundido en el suelo. El centro de la cara superior queda exactamente a la altura h. Las caras llevan
 * `smooth` (la capa suaviza la luz entre ellas) y sus coordenadas de textura en metros (`uv`): u rodea la
 * piedra y v sube, así la textura no se corta entre caras.
 */
function rock(out, e, n, z0, h, w, t, rot, col, mat, seed, o = {}) {
  const NS = o.ns || 28, NZ = o.nz || Math.max(3, Math.min(16, Math.round(h / 0.38))), pw = o.pw || 3.4;
  const taperK = o.taper == null ? 0.12 : o.taper, sink = o.sink == null ? 0.12 : o.sink, perim = 1.8 * (w + t);
  const P = (i, j) => {
    const th = (i / NS) * 2 * Math.PI, c = Math.cos(th), sn = Math.sin(th), zf = j / NZ;
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / pw) * w / 2, y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / pw) * t / 2;
    const z = -sink + zf * (h + sink);
    const bump = 1 + 0.11 * (vnoise3(x * 0.9 + 3, y * 0.9 + 5, z * 0.7, seed) - 0.5) * 2 + 0.04 * (vnoise3(x * 3.1, y * 3.1, z * 2.6, seed + 7) - 0.5) * 2;
    const round = zf > 0.84 ? 1 - 0.3 * Math.pow((zf - 0.84) / 0.16, 2) : 1;
    const k = (1 - taperK * zf) * bump * round;
    const q = rotP([x * k, y * k, 0], rot);
    const zt = j === NZ ? z - (0.03 + 0.1 * vnoise3(c * 1.3, sn * 1.3, 0.5, seed + 3)) * Math.min(1, h) : z;
    return { p: [e + q[0], n + q[1], z0 + zt], uv: [(i / NS) * perim, z + sink], l: [x * k, y * k] };
  };
  const tri = (A, B, C) => out.push({ v: [A.p, B.p, C.p], uv: [A.uv, B.uv, C.uv], c: col, mat, smooth: true });
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NS; i++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    tri(a, b, c); tri(a, c, d);
  }
  const top = { p: [e, n, z0 + h], uv: [0, 0] };
  for (let i = 0; i < NS; i++) {
    const a = P(i, NZ), b = P(i + 1, NZ);
    out.push({ v: [top.p, a.p, b.p], uv: [[0, 0], a.l, b.l], c: col, mat, smooth: true });
  }
}

/** Suelo que rodea un monumento (para recibir su sombra): { radius, mat }. */
export function groundPatch(m) {
  return { radius: (m.kind === "stonehenge" ? 95 : footprintRadius(m) + 60), mat: m.ground || "dirt" };
}

/**
 * Hiladas de una pirámide sin revestimiento, como se ven hoy en Guiza: cada hilada es un escalón (cara vertical
 * y repisa), de alto algo distinto y tono propio. `wAt(z)`: ancho de la pirámide a la altura z.
 */
function coursed(out, m, z0, z1, wAt, courseH) {
  const corner = (w, z, sx, sy) => rotP([sx * w / 2, sy * w / 2, z], m.rot);
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  let z = z0, i = 0;
  while (z < z1 - 1e-6) {
    let hh = courseH * (0.78 + 0.44 * hash3(i, 1, 2, m.base));
    if (z1 - z - hh < courseH * 0.4) hh = z1 - z;
    const zb = z + hh, wa = wAt(z), wb = wAt(zb), tone = 0.88 + 0.24 * hash3(i, 5, 9, m.base), k0 = out.length;
    for (let c = 0; c < 4; c++) {
      const d = (c + 1) % 4;
      quad(out, corner(wa, z, ...C[c]), corner(wa, z, ...C[d]), corner(wa, zb, ...C[d]), corner(wa, zb, ...C[c]), m.color, m.mat);
      quad(out, corner(wa, zb, ...C[c]), corner(wa, zb, ...C[d]), corner(wb, zb, ...C[d]), corner(wb, zb, ...C[c]), m.color, m.mat);
    }
    for (let k = k0; k < out.length; k++) out[k].tone = tone;
    z = zb; i++;
  }
}

/** Alto de las hiladas y de los escalones según la distancia (m) desde donde se miran. */
export function detailFor(d = 300) {
  return { courseH: Math.min(3.2, Math.max(0.95, d / 700)), stepH: Math.min(1.2, Math.max(0.27, d / 1200)) };
}

/**
 * Triángulos del monumento: [{ v: [[e, n, u] × 3], c: color, mat, tex?, tone?, smooth?, uv? }]. `opt.d`: distancia
 * (m) desde donde se mira (decide el detalle de hiladas y escalones).
 */
export function buildFaces(m, opt = {}) {
  const out = [], col = m.color, det = detailFor(opt.d);
  if (m.kind === "pyramid") {
    const top = m.top || 0, wAt = (z) => m.base + ((top - m.base) * z) / m.height;
    if (m.casing) {
      // Kefrén: hiladas desnudas abajo y, en el último cuarto, el revestimiento liso que se conserva (sobresale
      // un poco del núcleo gastado)
      const zc = m.height * m.casing, wc = wAt(zc);
      coursed(out, m, 0, zc, wAt, det.courseH);
      frustum(out, { z0: zc - 0.6, z1: m.height, w0: wc + 3.2, w1: top, rot: m.rot, col, mat: "casing", top: top > 0 });
    } else {
      coursed(out, m, 0, m.height, wAt, det.courseH);
      if (top > 0) frustum(out, { z0: m.height - 0.01, z1: m.height, w0: top, w1: top, rot: m.rot, col, mat: m.mat });
    }
  } else if (m.kind === "stepped") {
    // cuerpos escalonados: cada uno con talud (se estrecha al subir) y una terraza antes del siguiente
    const n = m.tiers, h = m.height / n;
    for (let i = 0; i < n; i++) {
      const wb = m.base - ((m.base - m.top) * i) / n, wn = m.base - ((m.base - m.top) * (i + 1)) / n;
      const wt = wb - (wb - wn) * 0.72;
      frustum(out, { z0: i * h, z1: (i + 1) * h, w0: wb, w1: wt, rot: m.rot, col, mat: m.mat });
    }
    for (const st of m.stairs || []) stair(out, m, st, m.top, m.height, det.stepH);
    if (m.temple) {
      // templo: muro, moldura a media altura y cornisa que sobresalen un poco
      const T = m.temple;
      block(out, 0, 0, m.height, T.h, T.w, T.w, m.rot, col, m.mat);
      block(out, 0, 0, m.height + T.h * 0.56, 0.45, T.w + 0.5, T.w + 0.5, m.rot, col, m.mat);
      block(out, 0, 0, m.height + T.h - 0.7, 0.7, T.w + 0.7, T.w + 0.7, m.rot, col, m.mat);
      doors(out, m);
    }
  } else if (m.kind === "mound") {
    // túmulo: muro de cuarzo (vertical) y encima la cúpula de hierba, casi plana arriba
    const seg = 96, rings = 14;
    const ring = (r, z) => Array.from({ length: seg }, (_, k) => { const a = (k / seg) * 2 * Math.PI; return [r * Math.sin(a), r * Math.cos(a), z]; });
    const b0 = ring(m.radius, 0), b1 = ring(m.radius, m.wall);
    for (let k = 0; k < seg; k++) { const j = (k + 1) % seg; quad(out, b0[k], b0[j], b1[j], b1[k], m.wallColor, m.wallMat); }
    const g0 = out.length;
    let prev = b1;
    for (let i = 1; i <= rings; i++) {
      const f = i / rings, r = m.radius * (1 - f), z = m.wall + (m.height - m.wall) * Math.pow(1 - Math.pow(1 - f, 2.2), 0.55);
      if (i === rings) { for (let k = 0; k < seg; k++) out.push({ v: [prev[k], prev[(k + 1) % seg], [0, 0, m.height]], c: col, mat: m.mat }); break; }
      const cur = ring(r, z);
      for (let k = 0; k < seg; k++) { const j = (k + 1) % seg; quad(out, prev[k], prev[j], cur[j], cur[k], col, m.mat); }
      prev = cur;
    }
    // hierba: luz suave y la textura tendida en planta (sin cortes entre caras)
    for (let k = g0; k < out.length; k++) { out[k].smooth = true; out[k].uv = out[k].v.map((p) => [p[0], p[1] + p[2] * 0.6]); }
    // la entrada (al sureste, hacia donde sale el Sol del solsticio de invierno) y, encima, la abertura por
    // la que entra su luz
    if (m.entrance != null) {
      const az = m.entrance * RAD, r = m.radius + 0.07, ox = Math.sin(az), oy = Math.cos(az), tx = Math.cos(az), ty = -Math.sin(az);
      const P = (t, z) => [ox * r + tx * t, oy * r + ty * t, z];
      quad(out, P(-0.55, 0), P(0.55, 0), P(0.55, 1.6), P(-0.55, 1.6), [0.05, 0.05, 0.05], "door");
      quad(out, P(-0.5, 2.0), P(0.5, 2.0), P(0.5, 2.5), P(-0.5, 2.5), [0.05, 0.05, 0.05], "door");
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
  const R = 15.6, ax = m.axis, col = m.color, mat = m.mat;
  const azOf = (k) => ax + 6 + (k - 1) * 12;               // la 1 y la 30 flanquean la entrada
  const at = (az, r) => [r * Math.sin(az * RAD), r * Math.cos(az * RAD)];
  for (const k of SH_STANDING) { const [e, n] = at(azOf(k), R); rock(out, e, n, 0, 4.1, 2.1, 1.1, azOf(k), col, mat, k); }
  for (const [a, b] of SH_LINTELS) {
    const az = (azOf(a) + (((azOf(b) - azOf(a)) % 360) + 360) % 360 / 2), [e, n] = at(az, R);
    rock(out, e, n, 4.05, 0.8, 2 * R * Math.sin(6 * RAD) + 1.4, 1.0, az, col, mat, 100 + a);
  }
  // trilitos: [acimut desde el centro, radio, alto, ¿izquierda en pie?, ¿derecha en pie?, ¿dintel?]
  // (alto de las piedras en pie: 5,2 y 5,6 m con dinteles de 0,9 m, ~6,1 y 6,5 m en total; del gran trilito, que
  // con su dintel llegaba a 7,3 m, queda en pie la piedra 56, de 6,7 m)
  const TRI = [[ax + 64, 8.8, 5.2, true, true, true], [ax + 118, 8.0, 5.6, true, true, true], [ax + 180, 7.4, 6.7, false, true, false],
    [ax + 242, 8.0, 5.6, true, true, true], [ax + 296, 8.8, 5.2, false, true, false]];
  for (const [az, r, h, l, rr, lin] of TRI) {
    const [e, n] = at(az, r), tx = Math.cos(az * RAD), ty = -Math.sin(az * RAD);   // tangente
    if (l) rock(out, e - tx * 1.25, n - ty * 1.25, 0, h, 2.2, 1.2, az, col, mat, 200 + az);
    if (rr) rock(out, e + tx * 1.25, n + ty * 1.25, 0, h, 2.2, 1.2, az, col, mat, 300 + az);
    if (lin) rock(out, e, n, h - 0.05, 0.9, 4.9, 1.1, az, col, mat, 400 + az);
  }
  const [he, hn] = at(51.3, 77);
  rock(out, he, hn, 0, 4.7, 2.4, 2.1, 51.3, col, mat, 77, { taper: 0.3 });
  // piedras caídas (posición aproximada): tres del círculo, tumbadas hacia fuera, y los restos del gran trilito
  // (la piedra 55, partida, y su dintel) en el centro
  for (const k of [8, 12, 14, 25]) { const [fe, fn] = at(azOf(k), R + 2.6); rock(out, fe, fn, 0, 0.95, 1.9, 4.0, azOf(k), col, mat, 500 + k, { taper: 0.05, sink: 0.25, nz: 4 }); }
  { const [fe, fn] = at(ax + 176, 3.4); rock(out, fe, fn, 0, 1.0, 2.1, 4.2, ax + 172, col, mat, 555, { taper: 0.05, sink: 0.3, nz: 4 }); }
  { const [fe, fn] = at(ax + 150, 1.2); rock(out, fe, fn, 0, 0.85, 1.2, 4.6, ax + 60, col, mat, 556, { taper: 0.05, sink: 0.2, nz: 4 }); }
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
