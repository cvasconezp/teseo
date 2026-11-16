// postcard.js — la postal para compartir: PNG vertical de 1080 × 1920 (9:16), el formato de las
// historias de Instagram, WhatsApp y TikTok.
//
// Composición, de arriba abajo:
//   0. zona segura superior (220 px, la tapan las apps con su barra): solo la marca, pequeña
//      («TESEO» + «con Killa Ñan · Astronomía comunitaria») y adornos;
//   1. el visual protagonista: la imagen real de Wikimedia (si se pudo cargar sin "manchar" el
//      lienzo), la esfera con textura real (Sol, Luna, planetas) o la representación esquemática;
//      siempre con su rótulo honesto debajo;
//   2. de fondo, el cielo REAL alrededor del objeto (estrellas del catálogo, figuras y nombres de
//      las constelaciones), con una retícula donde está el objeto;
//   3. nombre y tipo; una CUADRÍCULA DE DATOS (4–6 casillas: etiqueta pequeña + valor grande) con
//      datos que ya calcula la ficha (describeObject) — si un dato no existe, no hay casilla —;
//      una frase de dato curioso y, en cielo local, lugar y hora;
//   4. zona segura inferior (~260 px, la tapa la barra de respuesta): solo la marca — URL,
//      «Yachay Deep Labs × Killa Ñan · Astronomía comunitaria» y el crédito de los datos.
// Postal de una ESTRELLA (o del Sol) con espectro y/o vida (postcardStar.js), versión sintética: el
// mismo visual centrado; subtítulo «tipo · clase · magnitud»; solo la casilla de la distancia; «Su luz»
// y «Su vida» sin tarjetas (un separador fino); la altura o la hora de salida en la línea del cielo
// local, y la advertencia de que el espectro es un esquema, en el crédito del pie.
// Ningún texto se corta: cada línea se mide con measureText y se ajusta de tamaño o se parte
// (fitLines). El resultado incluye un informe con el ancho y la posición de cada línea, que las
// pruebas usan para comprobarlo.
import { drawArt, artKind, artOptions, drawSphere } from "./art.js";
import { BODIES, textureUrl, makeFallbackCanvas, bodyName } from "./bodies.js";
import { dateToJ2000, altAzJ2000 } from "./frames.js";
import { altAz } from "./guide.js";
import { visibilityOf } from "./objVisibility.js";
import { nasaImageFor, nasaKindKey, imageOrder, nasaStatus } from "./nasaImages.js";
/** ¿Se pueden dibujar en la postal las imágenes de images-assets.nasa.gov? (ver fromNasa en heroFor) */
export const NASA_CANVAS_OK = false;
import { compassPoint8 } from "./deviceOrientation.js";
import { loadRemoteImage } from "../share/images.js";
import { moonBody } from "./moons.js";
import { API as SUN_API } from "../sun/sun.js";
/** Imagen del Sol de hoy (NASA/SDO, HMI: luz visible continua, donde se ven las manchas). */
/** Fracción del lado de la imagen de SDO que ocupa el disco solar (medido en latest_1024_HMIIF: ~0,925). */
export const SDO_DISK = 0.93;
export const SDO_LATEST = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIF.jpg";
import { starBlocks, starSubtitle, layoutSpectrum, drawSpectrum, layoutLife, drawLife, drawRule, shortRef } from "./postcardStar.js";

export const PC_W = 1080, PC_H = 1920;
/** Zonas que tapan las apps de historias con su interfaz: arriba la barra de progreso y el perfil; abajo, la de respuesta. */
export const SAFE_TOP = 220, SAFE_BOTTOM = 260;
/**
 * Plazas de la cuadrícula de datos: como mucho 6 (3 filas de 2) y al menos 4 si hay datos para ello.
 * Una casilla ancha (la distancia unificada) ocupa una fila entera: cuenta como 2 plazas.
 */
export const GRID_MAX = 6, GRID_MIN = 4;
export const slotsOf = (cells) => cells.reduce((a, c) => a + (c.wide ? 2 : 1), 0);
export const PAD = 64;
export const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
export const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const TAU = Math.PI * 2;
/** Tamaños de la cuadrícula (px). Mínimo de cualquier texto: 24 px (créditos: 20 px). */
export const GRID = { cols: 2, gap: 16, padX: 22, padY: 14, label: 24, sub: 24, valueMax: 50, valueOne: 36, valueMin: 30 };
/** Fuentes de la cuadrícula, por papel. */
export const GRID_FONTS = { label: (px) => `500 ${px}px ${SANS}`, value: (px) => `600 ${px}px ${SANS}`, sub: (px) => `400 ${px}px ${SANS}` };

// ── texto que nunca se corta (funciones puras: reciben `measure(texto) → ancho`) ──
/** Parte `text` en líneas de ancho ≤ maxW. Una palabra más ancha que la línea se parte por caracteres. */
export function wrapLines(measure, text, maxW) {
  // solo espacios normales: un espacio duro (U+00A0) mantiene unidas dos palabras («NIST · finales»)
  const words = String(text || "").split(/[ \t\n\r]+/).filter(Boolean), lines = [];
  let cur = "";
  const pushLong = (word) => {
    let part = "";
    for (const ch of word) {
      if (part && measure(part + ch) > maxW) { lines.push(part); part = ch; } else part += ch;
    }
    return part;
  };
  for (const w of words) {
    const tryLine = cur ? cur + " " + w : w;
    if (measure(tryLine) <= maxW) { cur = tryLine; continue; }
    if (cur) lines.push(cur);
    cur = measure(w) <= maxW ? w : pushLong(w);
  }
  if (cur) lines.push(cur);
  return lines;
}
/**
 * Elige el mayor tamaño (entre max y min) con el que el texto cabe en `maxLines` líneas de
 * ancho ≤ maxW. Si ni al mínimo cabe, recorta la última línea con "…". `measureAt(px)` devuelve
 * la función de medida para ese tamaño. Devuelve { size, lines, truncated }.
 */
export function fitLines(measureAt, text, { max, min, maxW, maxLines = 2, step = 2 }) {
  let size = max, lines = [];
  for (; size >= min; size -= step) {
    lines = wrapLines(measureAt(size), text, maxW);
    if (lines.length <= maxLines) return { size, lines, truncated: false };
  }
  size = min;
  const measure = measureAt(size);
  lines = wrapLines(measure, text, maxW);
  if (lines.length <= maxLines) return { size, lines, truncated: false };
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] + " " + lines.slice(maxLines).join(" ");
  while (last.length > 1 && measure(last + "…") > maxW) last = last.slice(0, -1).replace(/\s+$/, "");
  kept[maxLines - 1] = last + "…";
  return { size, lines: kept, truncated: true };
}

// ── proyección del cielo (estereográfica, centrada en una dirección) ─────────
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/**
 * Proyector centrado en `center` (unitario) con `upHint` hacia arriba. Visto desde
 * dentro de la esfera celeste: con el norte arriba, el este queda a la izquierda.
 * `pxPerRad` = píxeles por radián en el centro. project(d) → [x, y, z] (z = coseno al centro).
 */
export function makeProjection(center, upHint, pxPerRad, cx, cy) {
  const f = norm(center);
  let right = cross(f, upHint);
  if (Math.hypot(right[0], right[1], right[2]) < 1e-6) right = cross(f, [1, 0, 0]);
  right = norm(right);
  const up = cross(right, f);
  const project = (d) => {
    const z = dot(d, f), k = 2 / (1 + Math.max(-0.999, z));
    return [cx + pxPerRad * k * dot(d, right), cy - pxPerRad * k * dot(d, up), z];
  };
  const unproject = (px, py) => {
    const X = (px - cx) / pxPerRad, Y = (cy - py) / pxPerRad, r2 = X * X + Y * Y;
    const z = (4 - r2) / (4 + r2), k = (1 + z) / 2;
    return [f[0] * z + right[0] * X * k + up[0] * Y * k, f[1] * z + right[1] * X * k + up[1] * Y * k, f[2] * z + right[2] * X * k + up[2] * Y * k];
  };
  return { project, unproject, f, right, up };
}
/** Dirección del cenit en coordenadas ecuatoriales para un lugar y un instante. */
export function zenithDir(lat, lon, date) {
  const T = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  let g = (280.46061837 + 360.98564736629 * T) % 360; if (g < 0) g += 360;
  const lst = (g + lon) * Math.PI / 180, phi = lat * Math.PI / 180;
  return [Math.cos(phi) * Math.cos(lst), Math.cos(phi) * Math.sin(lst), Math.sin(phi)];
}

// ── utilidades de lienzo ─────────────────────────────────────────────────
export function loadImage(src, cors, ms = 9000) {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    const done = (v) => { clearTimeout(tm); resolve(v); };
    const tm = setTimeout(() => done(null), ms);
    img.onload = () => done(img.naturalWidth > 0 ? img : null);
    img.onerror = () => done(null);
    img.src = src;
  });
}
/** ¿Se puede leer el lienzo después de dibujar esta imagen? (false = quedaría "tainted") */
export function isClean(img) {
  try {
    const c = document.createElement("canvas"); c.width = c.height = 2;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1);
    return true;
  } catch { return false; }
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
const hexRgb = (h) => { const n = parseInt(String(h || "#ffffff").slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// ── el cielo de fondo ────────────────────────────────────────────────────
export function drawChart(ctx, o) {
  const { sky, conDirs, proj, avoid, bodies, highlight, lang, local, labelStars } = o;
  const W = PC_W, H = PC_H;
  const g = ctx.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, H * 0.8);
  g.addColorStop(0, "#0d1530"); g.addColorStop(0.6, "#070c1c"); g.addColorStop(1, "#03060d");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const byHip = new Map(); sky.stars.forEach((s) => byHip.set(s[0], s));
  const inView = (p) => p[2] > -0.35 && p[0] > -40 && p[0] < W + 40 && p[1] > -40 && p[1] < H + 40;
  // figuras de las constelaciones
  ctx.lineCap = "round";
  for (const c of sky.constellations) {
    const hot = highlight === c.ab;
    ctx.strokeStyle = hot ? "rgba(201,184,255,0.95)" : "rgba(125,140,220,0.42)";
    ctx.lineWidth = hot ? 3 : 1.6;
    for (const poly of c.lines) {
      ctx.beginPath(); let pen = false;
      for (const hip of poly) {
        const s = byHip.get(hip); if (!s) { pen = false; continue; }
        const p = proj.project([s[1], s[2], s[3]]);
        if (p[2] < -0.35) { pen = false; continue; }
        if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
        pen = true;
      }
      ctx.stroke();
    }
  }
  // estrellas: tamaño por magnitud, color del catálogo
  for (const s of sky.stars) {
    const p = proj.project([s[1], s[2], s[3]]);
    if (!inView(p)) continue;
    const mag = s[4], r = Math.max(1, 6.2 - mag * 0.82), [cr, cg, cb] = hexRgb(o.starHex ? o.starHex(s) : s[5]);
    if (mag < 2.6) {
      const gl = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 3.6);
      gl.addColorStop(0, `rgba(${cr},${cg},${cb},0.5)`); gl.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p[0], p[1], r * 3.6, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.max(0.35, Math.min(1, 1.25 - mag * 0.13)).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
  }
  // cielo local: el suelo bajo el horizonte y los puntos cardinales
  if (local) {
    // el mapa está en J2000 (estrellas del catálogo y cuerpos ya precesados): el cenit y el polo de la
    // fecha se llevan a J2000 (frames.js) para que horizonte y cardinales caigan donde están de verdad
    const zen = dateToJ2000(zenithDir(local.lat, local.lon, local.date), local.date), pole = dateToJ2000([0, 0, 1], local.date);
    const CW = 108, CH = Math.round(108 * PC_H / PC_W), cell = document.createElement("canvas"); cell.width = CW; cell.height = CH;
    const cx2 = cell.getContext("2d"), im = cx2.createImageData(CW, CH);
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
      const d = proj.unproject((i + 0.5) * W / CW, (j + 0.5) * H / CH);
      const alt = dot(d, zen);                                    // seno de la altitud
      const q = (j * CW + i) * 4;
      im.data[q] = 6; im.data[q + 1] = 10; im.data[q + 2] = 14; im.data[q + 3] = alt < 0 ? Math.min(205, 150 + -alt * 400) : 0;
    }
    cx2.putImageData(im, 0, 0);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(cell, 0, 0, W, H); ctx.restore();
    // línea del horizonte y cardinales (N, E, S, O/W)
    const pz = dot(pole, zen), north = norm([pole[0] - zen[0] * pz, pole[1] - zen[1] * pz, pole[2] - zen[2] * pz]), east = cross(north, zen);
    ctx.strokeStyle = "rgba(125,180,255,0.75)"; ctx.lineWidth = 2.5; ctx.beginPath(); let pen = false;
    for (let a = 0; a <= 360; a += 2) {
      const ar = a * Math.PI / 180, d = [north[0] * Math.cos(ar) + east[0] * Math.sin(ar), north[1] * Math.cos(ar) + east[1] * Math.sin(ar), north[2] * Math.cos(ar) + east[2] * Math.sin(ar)];
      const p = proj.project(d);
      if (p[2] < -0.2) { pen = false; continue; }
      if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      pen = true;
    }
    ctx.stroke();
    ctx.font = `600 30px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    [["N", 0], ["E", 90], ["S", 180], [lang === "es" ? "O" : "W", 270]].forEach(([tt, a]) => {
      const ar = a * Math.PI / 180, d = [north[0] * Math.cos(ar) + east[0] * Math.sin(ar), north[1] * Math.cos(ar) + east[1] * Math.sin(ar), north[2] * Math.cos(ar) + east[2] * Math.sin(ar)];
      const p = proj.project(d);
      if (p[2] < 0 || p[0] < 30 || p[0] > W - 30 || p[1] < 30 || p[1] > H - 30 || avoid(p[0] - 24, p[1] + 4, p[0] + 24, p[1] + 52)) return;
      ctx.fillStyle = "rgba(147,197,253,0.95)"; ctx.fillText(tt, p[0], p[1] + 28);
    });
  }
  // Sol, Luna y planetas del momento
  const boxes = [];
  const free = (x0, y0, x1, y1) => {
    if (x0 < 14 || x1 > W - 14 || y0 < 14 || avoid(x0, y0, x1, y1)) return false;
    for (const b of boxes) if (x1 > b[0] && x0 < b[2] && y1 > b[1] && y0 < b[3]) return false;
    boxes.push([x0 - 8, y0 - 6, x1 + 8, y1 + 6]); return true;
  };
  const label = (txt, x, y, font, color, dx = 12) => {
    ctx.font = font; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const w = ctx.measureText(txt).width, hh = parseInt(font.match(/(\d+)px/)[1], 10);
    let x0 = x + dx;
    if (!free(x0, y - hh / 2, x0 + w, y + hh / 2)) { x0 = x - dx - w; if (!free(x0, y - hh / 2, x0 + w, y + hh / 2)) return false; }
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 8;
    ctx.fillStyle = color; ctx.fillText(txt, x0, y);
    ctx.shadowBlur = 0;
    return true;
  };
  for (const b of bodies || []) {
    const p = proj.project([b.nx, b.ny, b.nz]);
    if (!inView(p) || p[2] < 0) continue;
    const meta = BODIES[b.name]; if (!meta) continue;
    const r = b.name === "Sol" ? 13 : b.name === "Luna" ? 11 : 8;
    const gl = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 2.6);
    gl.addColorStop(0, meta.color); gl.addColorStop(0.4, meta.color + "aa"); gl.addColorStop(1, meta.color + "00");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p[0], p[1], r * 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = meta.color; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
    if (Math.hypot(p[0] - o.cx, p[1] - o.cy) > 46) label(bodyName(b.name, lang), p[0], p[1], `600 27px ${SERIF}`, "#ffe9a8", r + 8);
  }
  // nombres: primero las constelaciones (las más cercanas al centro), luego las estrellas brillantes
  const cons = (conDirs || []).map((c) => ({ c, p: proj.project(c.dir) })).filter((x) => x.p[2] > 0.2 && inView(x.p))
    .sort((a, b) => Math.hypot(a.p[0] - o.cx, a.p[1] - o.cy) - Math.hypot(b.p[0] - o.cx, b.p[1] - o.cy));
  for (const { c, p } of cons.slice(0, 14)) {
    const hot = highlight === c.ab;
    ctx.save();
    try { ctx.letterSpacing = "3px"; } catch { /* navegador sin letterSpacing en canvas */ }
    label(c.name.toUpperCase(), p[0], p[1], `${hot ? 600 : 500} ${hot ? 30 : 24}px ${SERIF}`, hot ? "#e4dbff" : "rgba(201,184,255,0.85)", 12);
    ctx.restore();
  }
  const named = sky.stars.filter((s) => s[7] && (labelStars ? labelStars.has(s[0]) : s[4] <= 2.3)).sort((a, b) => a[4] - b[4]).slice(0, 16);
  for (const s of named) {
    const p = proj.project([s[1], s[2], s[3]]);
    if (!inView(p) || p[2] < 0.1) continue;
    const txt = labelStars && s[6] > 0 ? `${s[7]} · ${Math.round(s[6]).toLocaleString(lang === "es" ? "es" : "en-US")} ${lang === "es" ? "a. l." : "ly"}` : s[7];
    label(txt, p[0], p[1], `${labelStars ? 26 : 24}px ${SANS}`, "rgba(255,255,255,0.92)", 13);
  }
}

export function drawReticle(ctx, x, y, r = 30) {
  ctx.save();
  ctx.strokeStyle = "#f2c66d"; ctx.lineWidth = 3; ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5)); ctx.lineTo(x + Math.cos(a) * (r + 18), y + Math.sin(a) * (r + 18)); ctx.stroke(); }
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
}

// ── el visual protagonista ───────────────────────────────────────────────
async function heroFor(obj, wiki, credit, t) {
  if (!obj) return null;
  // la Luna siempre va con el modelo: muestra su fase de ese momento, que una foto de archivo no da
  const nasa = obj.layer === "solar" && obj.name === "Luna" ? null : nasaImageFor(obj);
  let model = null;
  if (obj.layer === "solar" || obj.layer === "moon") {
    const b = obj.layer === "solar" ? BODIES[obj.name] : moonBody(obj.name);   // una luna: globo con el mosaico del USGS
    if (b) {
      const img = await loadImage(textureUrl(b.id), false);
      if (!img && obj.layer === "moon") { /* sin textura no se inventa el globo de una luna */ } else {
      const src = img || makeFallbackCanvas(b.id, 512, 256);
      const c = document.createElement("canvas"); c.width = 720; c.height = 360;
      const x = c.getContext("2d"); x.drawImage(src, 0, 0, 720, 360);
      let tex = null;
      try { tex = x.getImageData(0, 0, 720, 360); } catch { tex = null; }
      if (tex) model = { kind: "model", tex, body: b, key: obj.name, phase: obj.name === "Luna" && obj.illum != null ? { illum: obj.illum, waxing: obj.waxing } : null,
        label: img ? t.pcModel(t.texCredit[b.credit] || t.texCredit.sss) : t.pcModelFallback };
      }
    }
  }
  const fromWiki = async () => {
    if (!(wiki && wiki.thumb)) return null;
    const img = await loadImage(wiki.thumb, true);
    if (!(img && isClean(img))) return null;
    const label = credit && (credit.artist || credit.license) ? t.pcPhoto([credit.artist, credit.license].filter(Boolean).join(" · ")) : t.pcPhotoGeneric;
    return { kind: "photo", img, label, source: "wiki" };
  };
  // Imagen curada de la NASA: SOLO si el servidor de imágenes permitiera leerla desde el lienzo (CORS).
  // Comprobado el 13-nov-2026 con peticiones reales (cabecera Origin) a images-assets.nasa.gov: la API
  // (images-api.nasa.gov) sí responde "Access-Control-Allow-Origin: *", pero las imágenes casi nunca
  // (0 de 9 en la última prueba; 14 de 72 en otra, según la copia que tenga la CDN en caché). Con una
  // respuesta así de irregular la postal no puede depender de ellas: queda desactivado y la postal usa
  // Wikipedia o la representación propia. La ficha sí muestra la imagen de la NASA (un <img> no necesita CORS).
  const fromNasa = async () => {
    if (!NASA_CANVAS_OK || !nasa || nasaStatus(nasa.id) === "fail") return null;
    const img = await loadImage(nasa.srcBig + "?cors=1", true, 6000);
    if (!(img && isClean(img))) return null;
    return { kind: "photo", img, label: t.pcNasa(t.nasaKind[nasaKindKey(nasa)], nasa.credit), source: "nasa", nasaKind: nasa.kind };
  };
  // El Sol: la imagen REAL de hoy de NASA/SDO (instrumento HMI), donde se ven las manchas solares;
  // pasa por el intermediario /api/img (sdo.gsfc.nasa.gov no manda CORS). Si falla, el modelo con textura.
  const fromSdo = async () => {
    if (!(obj.layer === "solar" && obj.name === "Sol")) return null;
    const r = await loadRemoteImage(SDO_LATEST, SUN_API, 9000);
    return r ? { kind: "photo", img: r.img, label: t.pcSdo, source: "sdo", disk: SDO_DISK } : null;
  };
  if (obj.layer === "solar") {
    const s = await fromSdo();
    if (s) return s;
    const h = await fromNasa();
    if (h) return h;
    if (model) return model;
  } else {
    for (const src of imageOrder(obj)) {
      const h = src === "nasa" ? await fromNasa() : await fromWiki();
      if (h) return h;
    }
  }
  if (obj.layer === "moon") { const w = await fromWiki(); return w || model; }   // foto de la luna; si no, su globo; nunca una nebulosa
  if (obj.layer === "note") return null;     // una luna sin foto: postal sin visual, nunca una nebulosa genérica
  return { kind: "art", art: artKind(obj), opts: artOptions(obj), label: t.pcArt };
}

/** Tamaño que ocupará el visual dentro de maxW × maxH (para reservarle sitio antes de dibujar el cielo). */
export function heroSize(hero, maxW, maxH) {
  if (hero.kind === "model") {
    const R = Math.min(maxH / 2, hero.body.ring ? maxW / 4.6 : maxW / 2.6);
    return { w: hero.body.ring ? R * 4.7 : R * 2, h: R * 2, R };
  }
  if (hero.kind === "photo") {
    // una miniatura de Wikipedia (640 px) no se amplía más de 1,6× para que no se vea borrosa
    const iw = hero.img.naturalWidth, ih = hero.img.naturalHeight, s = Math.min(maxW / iw, maxH / ih, 1.6 * Math.max(1, 640 / Math.max(iw, ih)));
    return { w: Math.round(iw * s), h: Math.round(ih * s) };
  }
  const w = Math.min(maxW, 820, maxH * 1.41);
  return { w: Math.round(w), h: Math.round(w / 1.41) };
}

function drawHero(ctx, hero, cx, top, maxW, maxH) {
  // devuelve la caja ocupada { x, y, w, h }; el visual se apoya arriba (top) y ocupa su alto real
  const size = heroSize(hero, maxW, maxH);
  if (hero.kind === "model") {
    const R = size.R, cy = top + R;
    const col = hero.body.color;
    const gl = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * (hero.key === "Sol" ? 1.9 : 1.45));
    gl.addColorStop(0, col + (hero.key === "Sol" ? "cc" : "55")); gl.addColorStop(1, col + "00");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, R * 1.9, 0, TAU); ctx.fill();
    const ring = (front) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.38);
      ctx.beginPath(); ctx.rect(-R * 3, front ? 0 : -R * 3, R * 6, R * 3); ctx.clip();
      for (const [rr, w, a] of [[2.12, 0.2, 0.75], [1.68, 0.2, 0.5], [1.42, 0.1, 0.28], [2.32, 0.05, 0.35]]) {
        ctx.strokeStyle = `rgba(226,205,160,${a})`; ctx.lineWidth = R * w;
        ctx.beginPath(); ctx.ellipse(0, 0, R * rr, R * rr * 0.3, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    };
    if (hero.body.ring) ring(false);
    drawSphere(ctx, hero.tex, cx, cy, R, { lon0: 0.6, tilt: hero.body.ring ? -0.38 : Math.max(-0.45, Math.min(0.45, (hero.body.tilt || 0) * Math.PI / 180)), phase: hero.phase, sun: hero.key === "Sol" });
    if (hero.body.ring) ring(true);
    return { x: cx - size.w / 2, y: cy - R, w: size.w, h: R * 2 };
  }
  if (hero.disk) {
    // foto del Sol de SDO: el disco ocupa ~93 % del cuadro; se recorta en círculo, sin marco, con resplandor
    const R = Math.min(size.w, size.h) / 2, cy = top + R;
    const gl = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.6);
    gl.addColorStop(0, "rgba(255,190,90,0.55)"); gl.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, TAU); ctx.fill();
    const iw = hero.img.naturalWidth, ih = hero.img.naturalHeight, d = Math.min(iw, ih) * hero.disk;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.drawImage(hero.img, (iw - d) / 2, (ih - d) / 2, d, d, cx - R, cy - R, 2 * R, 2 * R);
    ctx.restore();
    return { x: cx - R, y: top, w: 2 * R, h: 2 * R };
  }
  const { w, h } = size;
  const draw = hero.kind === "photo"
    ? (x, y) => { ctx.fillStyle = "#05080f"; ctx.fillRect(x, y, w, h); ctx.drawImage(hero.img, x, y, w, h); }
    : (x, y) => drawArt(ctx, hero.art, x, y, w, h, hero.opts);
  const x = Math.round(cx - w / 2), y = Math.round(top);
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.75)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  roundRect(ctx, x, y, w, h, 28); ctx.fillStyle = "#05080f"; ctx.fill(); ctx.restore();
  ctx.save(); roundRect(ctx, x, y, w, h, 28); ctx.clip(); draw(x, y); ctx.restore();
  roundRect(ctx, x, y, w, h, 28); ctx.strokeStyle = "rgba(201,184,255,0.55)"; ctx.lineWidth = 2.5; ctx.stroke();
  return { x, y, w, h };
}

// ── la cuadrícula de datos ───────────────────────────────────────────────
const fmtNum = (n, lang, digits = 0) => Number(n).toLocaleString(lang === "es" ? "es" : "en-US", { maximumFractionDigits: digits });
/** "−1,46 · menor es más brillante" → { value: "−1,46", sub: "menor es más brillante" } */
const splitDot = (v) => { const s = String(v), i = s.indexOf(" · "); return i < 0 ? { value: s, sub: null } : { value: s.slice(0, i), sub: s.slice(i + 3) }; };
const timeOf = (fmt, lang) => (fmt && fmt.time) || ((d) => d.toLocaleTimeString(lang === "es" ? "es-EC" : "en-US", { hour: "2-digit", minute: "2-digit" }));

// pronombre de la frase de la luz: «la ves» (estrella, galaxia, nebulosa) o «lo ves» (cúmulo, agujero negro…)
const FEM_DEEP = new Set(["galaxy", "nebula", "planetary", "dark"]);
const lightFem = (obj) => obj.layer === "star" || obj.layer === "galaxies" || ((obj.layer === "messier" || obj.layer === "caldwell") && FEM_DEEP.has(obj.type));
/** A partir de un millón de años la frase lo compara con nuestra especie (Homo sapiens: ~300.000 años; Hublin et al. 2017, Nature 546, 289). */
export const LIGHT_DEEP_YEARS = 1e6;

/**
 * La casilla ÚNICA de distancia (función pura): la distancia como valor y, en la sub-línea, cuánto
 * tarda la luz —«Su luz salió hace 498 años: la ves como era entonces» (estrellas y cielo profundo),
 * «su luz tarda 8,2 minutos en llegar» (Sistema Solar, cometas) o «una señal de radio tarda…» (sondas)—.
 * Los valores son los que ya da la ficha: info.facts (describeObject) y fmt.years (= fmtYears, el mismo
 * formateador de la ficha). Ocupa una fila entera (wide). null si la ficha no da distancia.
 */
export function distanceCell(obj, info, t, fmt) {
  const facts = (info && info.facts) || [];
  const fd = facts.find((f) => f.label === t.fDistance);
  if (!fd || fd.value == null || !String(fd.value).trim()) return null;
  let sub = null;
  const takes = facts.find((f) => f.label === t.fLightTakes);
  const yrs = obj.dist_ly > 0 && fmt && fmt.years ? fmt.years(obj.dist_ly) : null;
  if (yrs && facts.some((f) => f.label === t.fLightLeft)) sub = t.pcLightAgo(yrs, lightFem(obj), obj.dist_ly >= LIGHT_DEEP_YEARS);
  else if (takes && takes.value && takes.value !== "—") sub = obj.layer === "probes" ? t.pcSignalTakes(takes.value) : t.pcLightTakes(takes.value);
  return { label: t.fDistance, value: String(fd.value), sub, kind: "dist", wide: true };
}

/**
 * Casillas de datos del cielo local para una dirección: altura y dirección de ahora, y la próxima
 * salida o puesta (objVisibility.js, lo mismo que muestra la ficha). [] si no se puede calcular.
 */
function localCells(target, local, t, lang, fmt) {
  if (!local || !target || target.nx == null) return [];
  let vis = null;
  try { vis = visibilityOf(target, local, local.date); } catch { vis = null; }
  if (!vis || !vis.now) return [];
  const out = [], hm = timeOf(fmt, lang);
  out.push(vis.now.alt > 0
    ? { label: t.pcGAlt, value: `${Math.round(vis.now.alt)}°`, sub: t.pcGDir(compassPoint8(vis.now.az)), kind: "local" }
    : { label: t.pcGAlt, value: t.pcGBelow, sub: null, kind: "local" });
  const r = vis.rts, day = (d) => (d.toDateString() === local.date.toDateString() ? null : t.pcGTomorrow);
  if (r && r.state === "always") out.push({ label: t.pcGHorizon, value: t.pcGAlways, sub: null, kind: "local" });
  else if (r && r.state === "never") out.push({ label: t.pcGHorizon, value: t.pcGNever, sub: null, kind: "local" });
  else if (r && r.upNow && r.set) out.push({ label: t.pcGSet, value: hm(r.set.date), sub: day(r.set.date), kind: "local" });
  else if (r && !r.upNow && r.rise) out.push({ label: t.pcGRise, value: hm(r.rise.date), sub: day(r.rise.date), kind: "local" });
  return out;
}

/**
 * Línea del cielo local de la postal de estrella (una sola frase, en vez de la casilla): la altura y la
 * dirección si está sobre el horizonte; si no, cuándo sale (hoy o mañana) o que hoy no sale. Usa
 * visibilityOf (objVisibility.js), lo mismo que la ficha. null sin lugar o sin dirección.
 */
export function starLocalLine(obj, local, t, lang, fmt) {
  if (!local || !obj || obj.nx == null) return null;
  let vis = null;
  try { vis = visibilityOf(obj, local, local.date); } catch { vis = null; }
  const line = (what) => t.pcLocalStar(local.place, fmt.when(local.date), what);
  if (!vis || !vis.now) {
    const p = altAzJ2000(obj.nx, obj.ny, obj.nz, local.lat, local.lon, local.date);
    return line(p.alt > 0 ? t.pcLsUp(Math.round(p.alt), compassPoint8(p.az)) : t.pcLsDown);
  }
  if (vis.now.alt > 0) return line(t.pcLsUp(Math.round(vis.now.alt), compassPoint8(vis.now.az)));
  const r = vis.rts;
  if (r && r.state === "never") return line(t.pcLsNever);
  if (r && !r.upNow && r.rise) return line(t.pcLsRise(timeOf(fmt, lang)(r.rise.date), r.rise.date.toDateString() !== local.date.toDateString()));
  return line(t.pcLsDown);
}

/**
 * Casillas de la cuadrícula (función pura): [{ label, value, sub, kind }], como mucho GRID_MAX.
 * Cada valor sale de lo que ya calcula la ficha (info.facts / info.details de describeObject), de
 * la constelación o del catálogo; si un dato no existe, su casilla no aparece.
 */
export function postcardGrid({ obj, info, t, lang, local, con, fmt, sky, bodies, star }) {
  const data = [];
  const add = (label, value, sub) => {
    if (!label || value == null) return;
    const v = String(value).trim();
    if (!v || v === "—") return;
    data.push({ label, value: v, sub: sub ? String(sub) : null, kind: "data" });
  };
  // la distancia y su luz: UNA casilla ancha (antes eran dos casi iguales, «Distancia» y «Su luz salió hace»)
  const dist = () => { const c = obj && info ? distanceCell(obj, info, t, fmt) : null; if (c) data.push(c); };
  const facts = (info && info.facts) || [], details = (info && info.details) || [];
  const fact = (label, as) => { const f = label && facts.find((x) => x.label === label); if (f) add(as || f.label, f.value, f.hint); };
  const det = (label, split, as) => {
    const d = label && details.find((x) => x[0] === label); if (!d) return;
    const p = split ? splitDot(d[1]) : { value: d[1], sub: null };
    add(as || label, p.value, p.sub);
  };
  let loc = [];
  if (con) {
    if (con.near) add(t.conNear, fmt.dist(con.near.d), con.near.name || t.pcAStar);
    if (con.far && con.far !== con.near && con.far.d > 0) add(t.conFar, fmt.dist(con.far.d), con.far.name || t.pcAStar);
    if (con.stars && con.stars.size) add(t.pcGStars, fmtNum(con.stars.size, lang));
    if (con.bright && con.bright.mag != null) add(t.pcGBright, con.bright.name || t.conStarUnnamed, t.pcGMag(fmtNum(con.bright.mag, lang, 2)));
    if (con.dir) loc = localCells({ layer: "con", name: con.ab, nx: con.dir[0], ny: con.dir[1], nz: con.dir[2] }, local, t, lang, fmt);
  } else if (!obj) {
    // el cielo sin objeto: lo que hay en el mapa y, con lugar, lo que está sobre el horizonte
    if (sky && sky.stars) add(t.pcGCatStars, fmtNum(sky.stars.length, lang), t.pcGCatStarsSub);
    if (sky && sky.constellations) add(t.pcGCons, fmtNum(sky.constellations.length, lang), t.pcGConsSub);
    const bs = bodies || [];
    const moon = bs.find((b) => b.name === "Luna");
    if (moon && moon.illum != null) add(t.pcGMoon, `${Math.round(moon.illum * 100)}${lang === "es" ? " %" : "%"}`, t.pcGMoonSub(!!moon.waxing));
    if (local && bs.length) {
      const altOf = (b) => (b.eqDate ? altAz(b.eqDate[0], b.eqDate[1], b.eqDate[2], local.lat, local.lon, local.date).alt : altAzJ2000(b.nx, b.ny, b.nz, local.lat, local.lon, local.date).alt);
      const up = bs.filter((b) => b.nx != null && b.name !== "Sol" && b.name !== "Luna" && b.name !== "Tierra" && BODIES[b.name] && altOf(b) > 0).map((b) => bodyName(b.name, lang));
      add(t.pcGPlanetsUp, up.length ? up.join(", ") : t.pcGNone);
    }
  } else {
    const L = obj.layer;
    if (star && (star.spectrum || star.life)) {
      // postal de una estrella (o del Sol) con espectro y/o vida, versión sintética: SOLO la distancia
      // unificada (ancha). La clase y la magnitud van en el subtítulo (starSubtitle) y la altura o la
      // hora de salida, en la línea del cielo local (starLocalLine)
      dist();
      return data.slice(0, 1);
    }
    if (L === "star") { dist(); det(t.dMagnitude, true); det(t.dTemp, true); det(t.dSpect); fact(t.fVoyager); }
    else if (L === "solar") { dist(); det(t.dDiameter, true); det(t.dAppMag, true); det(t.dOrbitSun); det(t.dOrbitEarth); det(t.dRotation); }
    else if (L === "moon") { dist(); det(t.dMoonDiameter, true); det(t.dMoonOrbit); det(t.dDiscovered); }
    else if (L === "probes") { dist(); det(t.fTarget); det(t.fAgency); det(t.fLaunched); det(t.dSunDist, true); }
    else if (L === "comets") { dist(); det(t.dSunDist, true); fact(t.fVoyager); }
    else if (L === "messier") { dist(); det(t.dMagnitude, true); det(t.dCatalog); fact(t.fVoyager); }
    else if (L === "caldwell") { dist(); det(t.dMagnitude, true); det(t.dCatalog); det(t.dSize, true); fact(t.fVoyager); }
    else if (L === "galaxies") { dist(); det(t.dHubble, true); det(t.dMagnitude, true); det(t.dCatalog); fact(t.fVoyager); }
    else if (L === "blackholes") { dist(); det(t.dMass); det(t.dHorizon, true); fact(t.fVoyager); }
    else if (L === "pulsars") { dist(); det(t.dPeriod); det(t.dKind); fact(t.fVoyager); }
    else if (L === "exoplanets") { dist(); det(t.dRadius); det(t.dMass); det(t.dTemp); det(t.dYear); det(t.dHost); det(t.dDiscovered); }
    else if (L === "meteors") { fact(t.fPeak); fact(t.fActive); fact(t.fRate); det(t.dParent); }
    if (obj.nx != null) loc = localCells(obj, local, t, lang, fmt);
  }
  // sin repetir etiquetas (p. ej. dos detalles con la misma); los del cielo local van al final.
  // Se llenan las plazas por orden (la distancia ancha cuenta 2): si no hay más datos reales, la
  // cuadrícula queda más corta — nunca se rellena
  const seen = new Set(), uniq = data.filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true)));
  const kept = [];
  let used = 0;
  for (const c of uniq) { const n = c.wide ? 2 : 1; if (used + n > GRID_MAX - loc.length) break; kept.push(c); used += n; }
  return [...kept, ...loc];
}

/**
 * Coloca las casillas en filas de GRID.cols columnas (función pura). `measureFor(papel, px)` devuelve
 * la función de medida del papel ("label" | "value" | "sub") a ese tamaño. Una casilla `wide` (la
 * distancia unificada) ocupa siempre su fila; las demás van de `cols` en `cols` (con `group`, los datos
 * y el cielo local en filas distintas) y una que queda sola ocupa todo el ancho. Sin casillas `wide`, con
 * un número impar de casillas, la PRIMERA ocupa todo el ancho (el dato principal). En cada fila los
 * valores van al mismo tamaño: el mayor con el que todos caben en ≤ 2 líneas (3 si ni al mínimo caben).
 * Devuelve { cells: [{ …casilla, x, y, w, h, inner, label, value, sub }], height, truncated }.
 */
export function layoutGrid(measureFor, cells, { x = PAD, y = 0, w = PC_W - 2 * PAD, cols = GRID.cols, group = true } = {}) {
  const { gap, padX, padY } = GRID;
  const rows = [];
  if (!cells.some((c) => c.wide)) {
    let i = 0;
    if (cells.length % cols === 1) { rows.push([cells[0]]); i = 1; }
    for (; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));
  } else {
    // una casilla ancha ocupa su fila; las demás van de `cols` en `cols` (con 2 columnas, si los datos
    // son impares el último ocupa su fila para que el cielo local quede junto); una que queda sola
    // ocupa todo el ancho
    let buf = [];
    const flush = () => { for (let i = 0; i < buf.length; i += cols) rows.push(buf.slice(i, i + cols)); buf = []; };
    for (const c of cells) {
      if (c.wide) { flush(); rows.push([c]); continue; }
      if (group && cols === 2 && buf.length % 2 === 1 && buf[buf.length - 1].kind !== c.kind) flush();
      buf.push(c);
    }
    flush();
  }
  const out = [], lh = (f, k) => Math.round(f.size * k) * f.lines.length;
  let cy = y, truncated = false;
  for (const row of rows) {
    const cw = row.length === 1 ? w : (w - gap * (row.length - 1)) / row.length, inner = cw - padX * 2;
    // primero en UNA línea (hasta valueOne px: «787 millones de km» no deja «km» suelto); si no cabe,
    // en 2 líneas; solo un valor que ni al mínimo cabe en 2 (p. ej. una lista de planetas) usa 3
    const mv = (px) => measureFor("value", px);
    const fitV = (c, max, min) => {
      if (max >= GRID.valueOne) { const one = fitLines(mv, c.value, { max, min: Math.max(min, GRID.valueOne), maxW: inner, maxLines: 1 }); if (!one.truncated) return one; }
      const f = fitLines(mv, c.value, { max: Math.min(max, 44), min, maxW: inner, maxLines: 2 });
      return f.truncated ? fitLines(mv, c.value, { max: min, min, maxW: inner, maxLines: 3 }) : f;
    };
    const vs = Math.min(...row.map((c) => fitV(c, GRID.valueMax, GRID.valueMin).size));
    const laid = row.map((c, k) => {
      const label = fitLines((px) => measureFor("label", px), c.label, { max: GRID.label, min: GRID.label, maxW: inner, maxLines: 2 });
      const value = fitV(c, vs, Math.min(vs, GRID.valueMin));
      const sub = c.sub ? fitLines((px) => measureFor("sub", px), c.sub, { max: GRID.sub, min: GRID.sub, maxW: inner, maxLines: 3 }) : null;
      if (label.truncated || value.truncated || (sub && sub.truncated)) truncated = true;
      const h = padY + lh(label, 1.22) + 4 + lh(value, 1.08) + (sub ? 4 + lh(sub, 1.22) : 0) + padY;
      return { ...c, x: x + k * (cw + gap), y: cy, w: cw, inner, label, value, sub, h };
    });
    const rh = Math.max(...laid.map((c) => c.h));
    for (const c of laid) { c.h = rh; out.push(c); }
    cy += rh + gap;
  }
  return { cells: out, height: out.length ? cy - gap - y : 0, truncated };
}

// ── reparto vertical ─────────────────────────────────────────────────────
export const HERO_TOP = SAFE_TOP + 22, HERO_MIN = 360, HERO_MAX = 680, HERO_W = PC_W - 2 * PAD;
/** Bajo el rótulo del visual: línea guía + retícula (≥ 150 px) y aire antes del título. */
export const BAND_MIN = 150, BAND_MAX = 360;
/** Línea inferior del bloque de texto: por encima de la zona que tapa la barra de respuesta. */
export const BLOCK_BOTTOM = PC_H - SAFE_BOTTOM - 22;
/** Postal de estrella (versión sintética): el visual va centrado, como en las demás capas, con un alto
 *  mínimo algo menor (STAR_HERO_MIN) y una franja para la retícula de al menos STAR_BAND_MIN; sin visual,
 *  el cielo con la retícula necesita STAR_ZONE_MIN. STAR_GAP: aire entre la distancia, «Su luz» y «Su vida»
 *  (con un separador fino en medio). */
export const STAR_HERO_MIN = 240, STAR_BAND_MIN = 140, STAR_ZONE_MIN = 110, STAR_GAP = 48;
/** Si así no cabe, antes de quitar el visual se prueba con una franja y un visual algo menores. */
export const STAR_HERO_MIN2 = 190, STAR_BAND_MIN2 = 112;
/** Alto del bloque de texto de la postal de estrella (función pura; las piezas ya medidas). */
export function starTextH({ titleH, typeH, gridH, specH, lifeH, localH }) {
  return titleH + 12 + typeH + (gridH ? 30 + gridH : 0) + (specH ? STAR_GAP + specH : 0) + (lifeH ? STAR_GAP + lifeH : 0) + (localH ? 34 + localH : 0);
}
/**
 * Reparto vertical (función pura): textH = alto del bloque de texto; capH = alto del rótulo del visual
 * (0 sin visual). Devuelve { blockTop, heroTop, heroMaxH, fits }: el bloque se apoya en BLOCK_BOTTOM
 * y el visual se lleva el sitio que queda (entre HERO_MIN y HERO_MAX).
 */
export function planLayout(textH, capH, hasHero) {
  const blockTop = BLOCK_BOTTOM - textH;
  if (!hasHero) return { blockTop, heroTop: HERO_TOP, heroMaxH: 0, fits: blockTop - SAFE_TOP >= 320 };
  const free = blockTop - HERO_TOP - capH - 16 - BAND_MIN;
  return { blockTop, heroTop: HERO_TOP, heroMaxH: Math.max(HERO_MIN, Math.min(HERO_MAX, free)), fits: free >= HERO_MIN };
}

/**
 * Textos de la postal a partir del objeto (función pura).
 * @returns {{ title, type, facts: string[], grid, curio: string|null, local: string|null, where: string|null, credit: string }}
 *   facts  2–3 frases (distancia, luz, dato propio) — la forma corta, por si la cuadrícula queda vacía
 *   grid   casillas de datos (postcardGrid)
 *   curio  la frase de dato curioso (la explicación corta que ya usa la ficha)
 *   local  línea completa de cielo local (lugar, hora, altura y dirección)
 *   where  solo lugar y hora: se usa cuando la altura ya va en la cuadrícula
 */
export function postcardText({ obj, info, lang, t, local, con, fmt, sky, bodies, star }) {
  const grid = postcardGrid({ obj, info, t, lang, local, con, fmt, sky, bodies, star });
  const where = local ? t.pcWhere(local.place, fmt.when(local.date)) : null;
  if (con) {
    const facts = [];
    if (con.near && con.far && con.far.d > 0) facts.push(t.pcConFact(con.near.name || t.pcAStar, fmt.dist(con.near.d), con.far.name || t.pcAStar, fmt.dist(con.far.d)));
    facts.push(t.pcConAligned);
    const ratio = con.near && con.far && con.near.d > 0 ? con.far.d / con.near.d : 0;
    const curio = t.pcConAligned + (ratio >= 1.5 && t.conRatio ? " " + t.conRatio(fmtNum(ratio, lang, ratio < 10 ? 1 : 0)) : "");
    return { title: con.title, type: con.type, facts, grid, curio, local: local ? localLine(con.dir, local, t, lang, fmt) : null, where, credit: t.pcData(t.pcSrcSky) };
  }
  if (!obj) {
    return { title: local ? t.pcSkyFrom(local.place) : t.pcSky, type: local ? fmt.when(local.date) : t.pcSkySub, facts: [t.pcSkyFact], grid, curio: t.pcSkyFact, local: null, where: null, credit: t.pcData(t.pcSrcSky) };
  }
  const facts = [];
  if (obj.layer === "solar" || obj.layer === "probes" || obj.layer === "comets") {
    const km = obj.dist_km != null ? obj.dist_km : (obj.dist_au != null ? obj.dist_au * 149597870.7 : null);
    if (km) { facts.push(t.pcDistKm(fmt.km(km))); facts.push(obj.layer === "probes" ? t.pcSignal(fmt.dur(km / 299792.458)) : t.pcLightNear(fmt.dur(km / 299792.458))); }
  } else if (obj.dist_ly > 0) {
    facts.push(t.pcDistLy(fmt.dist(obj.dist_ly)));
    facts.push(t.pcLight(fmt.years(obj.dist_ly)));
  } else if (obj.layer === "meteors" && info.facts.length) {
    facts.push(`${info.facts[0].label}: ${info.facts[0].value}. ${info.facts[2] ? info.facts[2].label + ": " + info.facts[2].value + "." : ""}`.trim());
  }
  // un dato más, propio del objeto: la primera explicación corta (o su nota)
  // (la frase de la señal de radio ya está arriba: no se repite)
  const extra = [...(info.explain || []).filter((e) => e.title !== t.sigTitle && e.title !== t.sigTitleComet).map((e) => e.text), info.note].filter((s) => s && s.length <= 150)[0];
  if (extra && facts.length < 3) facts.push(extra);
  const src = (info.details.find((d) => d[0] === t.dSource) || [])[1];
  const starPc = !!(star && (star.spectrum || star.life));
  return { title: info.name, type: starPc ? starSubtitle(obj, info, t, lang) : info.type + (info.badge ? ` · ${info.badge}` : ""), facts: facts.slice(0, 3), grid, curio: extra || null,
    local: local && obj.nx != null ? (starPc ? starLocalLine(obj, local, t, lang, fmt) : localLine([obj.nx, obj.ny, obj.nz], local, t, lang, fmt)) : null, where, credit: t.pcData(src || t.pcSrcSky) };
}
function localLine(dir, local, t, lang, fmt) {
  const p = altAzJ2000(dir[0], dir[1], dir[2], local.lat, local.lon, local.date);   // dir: J2000, como la escena
  return p.alt > 0 ? t.pcLocalUp(local.place, fmt.when(local.date), Math.round(p.alt), compassPoint8(p.az)) : t.pcLocalDown(local.place, fmt.when(local.date));
}

/** Texto con «Killa Ñan» resaltado: dibuja `line` desde x (alineado a la izquierda) en dos colores. */
export function drawHighlighted(ctx, line, x, y, color, hiColor, hi = "Killa Ñan") {
  const parts = line.split(hi);
  let cx = x;
  parts.forEach((part, i) => {
    if (part) { ctx.fillStyle = color; ctx.fillText(part, cx, y); cx += ctx.measureText(part).width; }
    if (i < parts.length - 1) { ctx.fillStyle = hiColor; ctx.fillText(hi, cx, y); cx += ctx.measureText(hi).width; }
  });
}

/**
 * Dibuja la postal.
 * @param {object} p
 *   lang, t, fmt            idioma, diccionario y formateadores { dist, years, km, dur, when, time? }
 *   sky, conDirs, bodies    catálogo de estrellas, centroides de constelaciones, efemérides del momento
 *   obj, info               objeto seleccionado y su descripción (describeObject) — o null
 *   wiki, credit            imagen de Wikipedia y su autor/licencia (opcionales)
 *   con                     { ab, title, type, dir, near, far, bright, stars:Set<hip>, radius } para una constelación
 *   center                  dirección del centro si no hay objeto ni constelación
 *   local                   { lat, lon, date, place } en cielo local, o null
 * @returns {Promise<{ canvas, report }>}
 *   report = { hero, heroLabel, lines:[{text,x,w,right,y,size,role}], grid:[…], overflow, gridOverflow, truncated, safeZoneOk }
 */
export async function buildPostcard(p) {
  const { lang, t, fmt, sky, conDirs, bodies, obj, info, wiki, credit, con, local } = p;
  try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load(`600 80px ${SERIF}`), document.fonts.load(`400 30px ${SANS}`), document.fonts.load(`600 30px ${SANS}`)]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* se dibuja con las fuentes de respaldo */ }
  const canvas = document.createElement("canvas"); canvas.width = PC_W; canvas.height = PC_H;
  const ctx = canvas.getContext("2d");
  const W = PC_W, H = PC_H, maxW = W - PAD * 2, cx = W / 2;
  const report = { hero: "none", heroLabel: "", lines: [], grid: [], overflow: false, gridOverflow: false, truncated: false, safeZoneOk: true, w: W, h: H, starMode: false, spectrum: null, life: null };
  const measureAt = (font) => (px) => (s) => { ctx.font = font(px); return ctx.measureText(s).width; };

  // 0 · ¿estrella (o el Sol) con espectro y/o vida? Se decide como en la ficha (postcardStar.js)
  const sb = !con && obj ? starBlocks(obj) : null;
  const starMode = !!(sb && (sb.spectrum || sb.life));
  report.starMode = starMode;

  // 1 · textos, medidos antes de dibujar nada
  const txt = postcardText({ obj, info, lang, t, local, con, fmt, sky, bodies, star: starMode ? sb : null });
  const fTitle = (px) => `600 ${px}px ${SERIF}`, fType = (px) => `500 ${px}px ${SANS}`, fFact = (px) => `400 ${px}px ${SANS}`;
  const fSmall = (px) => `400 ${px}px ${SANS}`, fUrl = (px) => `600 ${px}px ${SANS}`, fCoop = (px) => `600 ${px}px ${SANS}`, fHead = (px) => `600 ${px}px ${SANS}`, fHeadSub = (px) => `500 ${px}px ${SANS}`;
  const title = fitLines(measureAt(fTitle), txt.title, { max: 86, min: 56, maxW, maxLines: 2 });
  const type = fitLines(measureAt(fType), txt.type, { max: starMode ? 32 : 34, min: 26, maxW, maxLines: 2 });
  const measureFor = (role, px) => measureAt(GRID_FONTS[role])(px);
  const lh = (f, k) => Math.round(f.size * k) * f.lines.length;
  const hero = con ? null : await heroFor(obj, wiki, credit, t);
  const capFont = (px) => `400 ${px}px ${SANS}`;
  let cells = txt.grid, grid, facts = [], localL = null, blockTop;
  let spec = null, life = null, useHero = !!hero, heroMaxH = 0;
  // rótulo honesto del visual (en la postal de estrella, en una línea siempre que quepa a ≥ 20 px)
  let cap = hero && starMode ? fitLines(measureAt(capFont), hero.label, { max: 24, min: 20, maxW, maxLines: 1 }) : null;
  if (hero && (!cap || cap.truncated)) cap = fitLines(measureAt(capFont), hero.label, { max: 24, min: 20, maxW, maxLines: 2 });
  let capH = cap ? Math.round(cap.size * 1.3) * cap.lines.length : 0;
  // dónde va cada cosa del visual (se calcula abajo)
  let heroTop = HERO_TOP, capTop = 0, retX = cx, retY, heroBox = null, guide = null, hsz = null, veilTop;

  if (starMode) {
    // ── postal de estrella, sintética: el visual centrado (como en las demás capas) y, apoyados abajo,
    // título → subtítulo (tipo · clase · magnitud) → la distancia → «Su luz» → «Su vida» → cielo local.
    // Sin la fila de casillas pequeñas. Si el texto no deja sitio al visual, la postal va sin él (solo el
    // cielo con la retícula); el texto nunca se corta.
    spec = sb.spectrum ? layoutSpectrum(measureAt, sb.spectrum, t, lang, { w: maxW }) : null;
    life = sb.life ? layoutLife(measureAt, sb.life, t, lang, { w: maxW }) : null;
    // la línea del cielo local, en UNA línea si cabe (≥ 24 px); si no, en dos
    localL = txt.local ? fitLines(measureAt(fFact), txt.local, { max: 28, min: 24, maxW: maxW - 34, maxLines: 1 }) : null;
    if (localL && localL.truncated) localL = fitLines(measureAt(fFact), txt.local, { max: 28, min: 24, maxW: maxW - 34, maxLines: 2 });
    grid = layoutGrid(measureFor, cells, { x: PAD, y: 0, w: maxW });
    const textH = starTextH({ titleH: lh(title, 1.02), typeH: lh(type, 1.3), gridH: grid.height, specH: spec ? spec.h : 0, lifeH: life ? life.h : 0, localH: localL ? lh(localL, 1.3) : 0 });
    blockTop = BLOCK_BOTTOM - textH;
    // el visual: con la franja normal de la retícula; si no cabe, con una algo menor; si ni así, sin visual
    const free = blockTop - HERO_TOP - capH - 16 - STAR_BAND_MIN, free2 = blockTop - HERO_TOP - capH - 16 - STAR_BAND_MIN2;
    useHero = !!hero && (free >= STAR_HERO_MIN || free2 >= STAR_HERO_MIN2);
    heroMaxH = !useHero ? 0 : free >= STAR_HERO_MIN ? Math.min(HERO_MAX, free) : free2;
    const zone = blockTop - HERO_TOP;
    if (zone < STAR_ZONE_MIN) report.overflow = true;
    report.starLayout = { cells: cells.length, hero: useHero, heroMaxH: Math.round(heroMaxH), zone: Math.round(zone) };
  } else {
    // frases bajo la cuadrícula: el dato curioso (o, si no hay cuadrícula, las frases cortas)
    const bullets = (cells.length ? [txt.curio].filter(Boolean) : txt.facts);
    const useWhere = txt.where && cells.some((c) => c.kind === "local");
    const localText = useWhere ? txt.where : txt.local;
    localL = localText ? fitLines(measureAt(fFact), localText, { max: 28, min: 24, maxW: maxW - 34, maxLines: 2 }) : null;
    let curioLines = 3, textH, plan;
    // si el texto no deja sitio al visual, se quitan casillas (de 6 plazas a 4) y luego líneas del dato curioso
    for (;;) {
      grid = layoutGrid(measureFor, cells, { x: PAD, y: 0, w: maxW });
      facts = bullets.map((f) => fitLines(measureAt(fFact), f, { max: 32, min: 26, maxW: maxW - 34, maxLines: curioLines }));
      textH = lh(title, 1.02) + 10 + lh(type, 1.3) + (grid.height ? 22 + grid.height : 0) + facts.reduce((a, f) => a + 22 + lh(f, 1.32), 0) + (localL ? 16 + lh(localL, 1.3) : 0);
      plan = planLayout(textH, capH, !!hero);
      if (plan.fits) break;
      const dataIdx = cells.map((c, i) => (c.kind === "data" ? i : -1)).filter((i) => i >= 0);
      // de dos en dos (de 6 plazas a 4): con 5 una quedaría sola en su fila y no se ganaría sitio
      const extra = slotsOf(cells) - GRID_MIN;
      if (extra > 0 && dataIdx.length) { const drop = new Set(dataIdx.slice(-Math.min(2, extra))); cells = cells.filter((_, i) => !drop.has(i)); continue; }
      if (curioLines > 2) { curioLines = 2; continue; }
      break;
    }
    blockTop = plan.blockTop;
    heroTop = plan.heroTop; heroMaxH = plan.heroMaxH;
  }
  if (!useHero) { cap = null; capH = 0; }
  // el visual, centrado; debajo su rótulo y, en la franja que queda hasta el texto, la retícula
  hsz = useHero ? heroSize(hero, HERO_W, heroMaxH) : null;
  if (useHero) {
    const heroH = hsz.h;
    let band = blockTop - (heroTop + heroH + 16 + capH);
    // si sobra mucho sitio, el conjunto baja un poco para quedar equilibrado
    if (band > BAND_MAX) { heroTop += Math.round((band - BAND_MAX) / 2); band = blockTop - (heroTop + heroH + 16 + capH); }
    capTop = heroTop + heroH + 16;
    // la retícula en la franja libre (en la postal de estrella, centrada: la franja puede ser estrecha)
    retY = Math.round(starMode ? capTop + capH + band / 2 : capTop + capH + (band - 40) / 2 + 12);
    // caja que no deben pisar los nombres del cielo: el visual y su rótulo (que puede ser más ancho)
    const capW = Math.max(...cap.lines.map((l) => measureAt(capFont)(cap.size)(l)));
    const boxW = Math.max(hsz.w, capW);
    heroBox = { x: cx - boxW / 2 - 16, y: heroTop - 14, w: boxW + 32, h: heroH + 16 + capH + 30 };
    guide = { x0: cx, y0: capTop + capH + 6, x1: cx, y1: retY - 50 };
  } else retY = Math.round((SAFE_TOP + blockTop - 40) / 2);
  veilTop = blockTop - 170;
  report.truncated = [title, type, ...facts, localL, cap].some((f) => f && f.truncated) || grid.truncated || !!(spec && spec.truncated) || !!(life && life.truncated);

  // pie (zona segura inferior): URL, Yachay Deep Labs × Killa Ñan y crédito de los datos
  const url = fitLines(measureAt(fUrl), t.pcUrl, { max: 44, min: 30, maxW, maxLines: 1 });
  const coop = fitLines(measureAt(fCoop), t.pcCoop, { max: 32, min: 24, maxW, maxLines: 2 });
  // crédito: en la postal de estrella, solo las fuentes de lo dibujado, que el espectro es un esquema y la
  // referencia de la masa (hasta 3 líneas de 20–22 px; el pie se aprieta un poco para que quepan)
  const kFmt = (v) => Math.round(v).toLocaleString(lang === "es" ? "es" : "en-US", { useGrouping: "always" });
  const creditText = starMode && t.pcCreditStar ? t.pcCreditStar({
    sun: obj.layer === "solar",
    spec: sb.spectrum ? { T: kFmt(sb.spectrum.temp), lower: !!sb.spectrum.lowerBound, tio: (sb.spectrum.lines || []).some((l) => l.group === "tio") } : null,
    est: !!(sb.life && sb.life.massKind === "estimated"), life: !!sb.life && obj.layer === "star",
    massRef: sb.life && sb.life.massKind === "curated" ? shortRef(sb.life.ref && sb.life.ref[0]).replace(/ /g, "\u00a0") || null : null,   // la referencia no se parte
  }) : txt.credit;
  let creditL = fitLines(measureAt(fSmall), creditText, { max: 22, min: 20, maxW, maxLines: 2 });
  if (creditL.truncated && starMode) creditL = fitLines(measureAt(fSmall), creditText, { max: 20, min: 20, maxW, maxLines: 3 });
  const headSub = fitLines(measureAt(fHeadSub), t.pcHeadWith, { max: 28, min: 24, maxW, maxLines: 1 });
  if ([url, coop, creditL, headSub].some((f) => f.truncated)) report.truncated = true;

  // 2 · encuadre del cielo, centrado donde va la retícula
  const centerDir = con ? con.dir : obj && obj.nx != null ? [obj.nx, obj.ny, obj.nz] : (p.center || [0, 0, 1]);
  const upHint = local ? dateToJ2000(zenithDir(local.lat, local.lon, local.date), local.date) : [0, 0, 1];
  // escala: una constelación se encuadra entera; un objeto muestra ~105° de cielo a lo ancho
  const areaH = blockTop - 40 - SAFE_TOP;
  const pxPerRad = con ? Math.min(1500, Math.max(520, Math.min(W * 0.42, areaH * 0.44) / Math.max(0.12, con.radius))) : W / (105 * Math.PI / 180);
  const proj = makeProjection(centerDir, upHint, pxPerRad, retX, retY);
  const inBox = (b, x0, y0, x1, y1) => b && x1 > b.x && x0 < b.x + b.w && y1 > b.y && y0 < b.y + b.h;
  const guideBox = guide ? { x: Math.min(guide.x0, guide.x1) - 24, y: Math.min(guide.y0, guide.y1) - 16, w: Math.abs(guide.x1 - guide.x0) + 48, h: Math.abs(guide.y1 - guide.y0) + 32 } : null;
  const avoid = (x0, y0, x1, y1) => (y0 < SAFE_TOP + 6) || (y1 > blockTop - 36) || (useHero && inBox(heroBox, x0, y0, x1, y1)) ||
    (!con && Math.abs((x0 + x1) / 2 - retX) < 70 + (x1 - x0) / 2 && Math.abs((y0 + y1) / 2 - retY) < 62) ||
    (useHero && inBox(guideBox, x0, y0, x1, y1));
  drawChart(ctx, { sky, conDirs, proj, avoid, bodies: p.showSolar === false ? [] : bodies, highlight: con ? con.ab : null, lang, local, cx: retX, cy: retY, labelStars: con ? con.stars : null, starHex: p.starHex });

  const line = (ln, x, y, size, role) => {
    const w = ctx.measureText(ln).width;
    report.lines.push({ text: ln, x, w, right: x + w, y, size, role });
    return w;
  };
  if (hero && useHero) {
    const box = drawHero(ctx, hero, cx, heroTop, HERO_W, heroMaxH);
    report.hero = hero.kind; report.heroLabel = hero.label; report.heroSource = hero.source || hero.kind; report.heroBox = box;
    // rótulo honesto bajo el visual
    ctx.font = capFont(cap.size); ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(226,230,246,0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 8;
    let y = capTop;
    for (const ln of cap.lines) { const w = ctx.measureText(ln).width, x = cx - w / 2; ctx.fillText(ln, x, y); line(ln, x, y, cap.size, "caption"); y += Math.round(cap.size * 1.3); }
    ctx.shadowBlur = 0;
    // del visual a su lugar en el cielo
    if (guide.y1 - guide.y0 >= 10) {
      ctx.save(); ctx.strokeStyle = "rgba(242,198,109,0.8)"; ctx.lineWidth = 2; ctx.setLineDash([7, 8]);
      ctx.beginPath(); ctx.moveTo(guide.x0, guide.y0); ctx.lineTo(guide.x1, guide.y1); ctx.stroke(); ctx.restore();
    }
    drawReticle(ctx, retX, retY);
  } else if (!con && obj) drawReticle(ctx, retX, retY);

  // 3 · cabecera de marca, discreta, dentro de la zona segura superior (sobre un velo suave)
  const topVeil = ctx.createLinearGradient(0, 0, 0, SAFE_TOP + 30);
  topVeil.addColorStop(0, "rgba(4,7,14,0.9)"); topVeil.addColorStop(0.75, "rgba(4,7,14,0.55)"); topVeil.addColorStop(1, "rgba(4,7,14,0)");
  ctx.fillStyle = topVeil; ctx.fillRect(0, 0, W, SAFE_TOP + 30);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  {
    ctx.save();
    ctx.font = fHead(32);
    try { ctx.letterSpacing = "12px"; } catch { /* sin letterSpacing en canvas: se mide igual que se dibuja */ }
    const hw = ctx.measureText(t.pcHead).width, hx = cx - hw / 2 + 6, hy = 118;
    ctx.fillStyle = "#e6deff"; ctx.fillText(t.pcHead, hx, hy);
    report.lines.push({ text: t.pcHead, x: hx, w: hw, right: hx + hw, y: hy, size: 32, role: "header" });
    ctx.restore();
    ctx.fillStyle = "rgba(242,198,109,0.75)"; ctx.fillRect(hx - 92, hy + 17, 64, 2); ctx.fillRect(hx + hw + 22, hy + 17, 64, 2);
    ctx.font = fHeadSub(headSub.size);
    const sw = ctx.measureText(headSub.lines[0]).width, sx = cx - sw / 2, sy = hy + 50;
    drawHighlighted(ctx, headSub.lines[0], sx, sy, "rgba(226,230,246,0.88)", "#f2c66d");
    report.lines.push({ text: headSub.lines[0], x: sx, w: sw, right: sx + sw, y: sy, size: headSub.size, role: "header" });
  }

  // 4 · bloque de texto sobre un velo que garantiza el contraste
  const veil = ctx.createLinearGradient(0, veilTop, 0, H);
  const solid = Math.min(0.5, Math.max(0.04, (blockTop - veilTop) / (H - veilTop)));
  veil.addColorStop(0, "rgba(4,7,14,0)"); veil.addColorStop(0.16, "rgba(4,7,14,0.86)"); veil.addColorStop(1, "rgba(4,7,14,0.97)");
  ctx.fillStyle = veil; ctx.fillRect(0, veilTop, W, H - veilTop);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  let y = blockTop;
  const put = (f, font, color, x, k, role) => {
    ctx.font = font(f.size); ctx.fillStyle = color;
    for (const ln of f.lines) { ctx.fillText(ln, x, y); line(ln, x, y, f.size, role); y += Math.round(f.size * k); }
  };
  put(title, fTitle, "#ffffff", PAD, 1.02, "title"); y += starMode ? 12 : 10;
  put(type, fType, "#cfc4ff", PAD, 1.3, "type");
  if (grid.cells.length) {
    y += starMode ? 30 : 22;
    const gy = y;
    for (const c of grid.cells) {
      const x0 = c.x, y0 = gy + c.y, loc = c.kind === "local", dist = c.kind === "dist";
      roundRect(ctx, x0, y0, c.w, c.h, 22); ctx.fillStyle = loc ? "rgba(12,24,48,0.82)" : dist ? "rgba(34,26,30,0.86)" : "rgba(18,20,46,0.82)"; ctx.fill();
      ctx.strokeStyle = loc ? "rgba(125,180,255,0.5)" : dist ? "rgba(242,198,109,0.7)" : "rgba(167,139,250,0.42)"; ctx.lineWidth = dist ? 2.5 : 2; ctx.stroke();
      const tx = x0 + GRID.padX, limit = x0 + c.w - GRID.padX + 1;
      let yy = y0 + GRID.padY;
      const cellPut = (f, role, color, k) => {
        ctx.font = GRID_FONTS[role](f.size); ctx.fillStyle = color;
        for (const ln of f.lines) { ctx.fillText(ln, tx, yy); const w = line(ln, tx, yy, f.size, "grid-" + role); if (tx + w > limit) report.gridOverflow = true; yy += Math.round(f.size * k); }
      };
      cellPut(c.label, "label", loc ? "#a9cdff" : dist ? "#f2c66d" : "#c9b8ff", 1.22); yy += 4;
      cellPut(c.value, "value", "#ffffff", 1.08);
      if (c.sub) { yy += 4; cellPut(c.sub, "sub", dist ? "rgba(248,238,214,0.94)" : "rgba(226,230,246,0.82)", 1.22); }
      if (yy > y0 + c.h - GRID.padY + 2) report.gridOverflow = true;
      report.grid.push({ label: c.label, value: c.value, sub: c.sub, kind: c.kind, wide: !!c.wide, x: x0, y: y0, w: c.w, h: c.h });
    }
    y = gy + grid.height;
  }
  const putStar = (ln, x, yy, size, role) => line(ln, x, yy, size, role);
  if (spec) {
    drawRule(ctx, PAD, y + STAR_GAP / 2 - 1, maxW);
    y += STAR_GAP;
    drawSpectrum(ctx, spec, sb.spectrum, PAD, y, maxW, putStar);
    report.spectrum = { x: PAD, y, w: maxW, h: spec.h, temp: sb.spectrum.temp, letter: sb.spectrum.letter, sun: sb.spectrum.isSun, peakNm: spec.peakNm, zone: spec.zone, labels: spec.labels.map((l) => l.text), lines: sb.spectrum.lines.length };
    y += spec.h;
  }
  if (life) {
    drawRule(ctx, PAD, y + STAR_GAP / 2 - 1, maxW);
    y += STAR_GAP;
    drawLife(ctx, life, t, PAD, y, maxW, putStar);
    report.life = { x: PAD, y, w: maxW, h: life.h, path: sb.life.path.slice(), here: sb.life.here, stage: sb.life.stage, massKind: sb.life.massKind, near: sb.life.near, assumed: sb.life.assumed, notes: life.notes.length };
    y += life.h;
  }
  for (const f of facts) {
    y += 22;
    ctx.fillStyle = "#f2c66d"; ctx.beginPath(); ctx.arc(PAD + 9, y + f.size * 0.62, 6, 0, TAU); ctx.fill();
    put(f, fFact, "rgba(240,242,252,0.96)", PAD + 34, 1.32, "fact");
  }
  if (localL) {
    y += starMode ? 34 : 16;
    ctx.strokeStyle = "#7db4ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(PAD + 9, y + localL.size * 0.62, 6, 0, TAU); ctx.stroke();
    put(localL, fFact, "#a9cdff", PAD + 34, 1.3, "local");
  }
  report.blockTop = blockTop; report.blockBottom = y;
  if (y > BLOCK_BOTTOM + 2) report.overflow = true;

  // 5 · pie de marca, centrado, en la zona segura inferior
  y = H - SAFE_BOTTOM + 16;
  const sep = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  sep.addColorStop(0, "rgba(167,139,250,0)"); sep.addColorStop(0.5, "rgba(242,198,109,0.7)"); sep.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = sep; ctx.fillRect(PAD, y, maxW, 2); y += 24;
  const center = (f, font, role, k, draw) => {
    ctx.font = font(f.size);
    for (const ln of f.lines) { const w = ctx.measureText(ln).width, x = cx - w / 2; draw(ln, x, y); line(ln, x, y, f.size, role); y += Math.round(f.size * k); }
  };
  const footGap = creditL.lines.length > 2 ? 9 : 12;
  center(url, fUrl, "url", 1.2, (ln, x, yy) => { ctx.fillStyle = "#ffffff"; ctx.fillText(ln, x, yy); }); y += footGap;
  center(coop, fCoop, "coop", 1.25, (ln, x, yy) => drawHighlighted(ctx, ln, x, yy, "#e6deff", "#f2c66d")); y += footGap;
  center(creditL, fSmall, "credit", 1.3, (ln, x, yy) => { ctx.fillStyle = "rgba(226,230,246,0.78)"; ctx.fillText(ln, x, yy); });
  report.bottom = y;
  if (y > H - 24) report.overflow = true;
  for (const l of report.lines) if (l.x < PAD - 1 || l.right > W - PAD + 1) report.overflow = true;
  if (report.gridOverflow) report.overflow = true;
  // texto importante (todo menos la marca) fuera de las zonas que tapan las apps
  const brandRoles = new Set(["header", "url", "coop", "credit"]);
  for (const l of report.lines) if (!brandRoles.has(l.role) && (l.y < SAFE_TOP || l.y + l.size > H - SAFE_BOTTOM)) report.safeZoneOk = false;
  // ningún texto pequeño: ≥ 24 px salvo el rótulo del visual y el crédito (≥ 20) y las marcas del eje del espectro (20)
  report.minSize = Math.min(...report.lines.filter((l) => !brandRoles.has(l.role) && l.role !== "caption" && l.role !== "spectrum-axis").map((l) => l.size));
  report.gridCells = grid.cells.length;
  return { canvas, report };
}

/** canvas → Blob PNG (null si el lienzo no se puede exportar). */
export function canvasBlob(canvas) {
  return new Promise((resolve) => {
    try { canvas.toBlob((b) => resolve(b), "image/png"); } catch { resolve(null); }
  });
}
