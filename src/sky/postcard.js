// postcard.js — la postal para compartir (PNG vertical de 1080 × 1350).
//
// Composición, de arriba abajo:
//   1. el visual protagonista: la imagen real de Wikimedia (si se pudo cargar sin
//      "manchar" el lienzo), la esfera con textura real (Sol, Luna, planetas) o la
//      representación esquemática; siempre con su rótulo honesto debajo;
//   2. de fondo, el cielo REAL alrededor del objeto (estrellas del catálogo, figuras
//      y nombres de las constelaciones), con una retícula donde está el objeto;
//   3. nombre, tipo, 2–3 datos en lenguaje humano y, en cielo local, lugar y hora;
//   4. marca de Teseo, URL y crédito de los datos.
// Ningún texto se corta: cada línea se mide con measureText y se ajusta de tamaño o
// se parte (fitLines). El resultado incluye un informe con el ancho de cada línea,
// que las pruebas usan para comprobarlo.
import { drawArt, artKind, artOptions, drawSphere } from "./art.js";
import { BODIES, textureUrl, makeFallbackCanvas, bodyName } from "./bodies.js";
import { dateToJ2000, altAzJ2000 } from "./frames.js";
import { nasaImageFor, nasaKindKey, imageOrder, nasaStatus } from "./nasaImages.js";
/** ¿Se pueden dibujar en la postal las imágenes de images-assets.nasa.gov? (ver fromNasa en heroFor) */
export const NASA_CANVAS_OK = false;
import { compassPoint8 } from "./deviceOrientation.js";

export const PC_W = 1080, PC_H = 1350;
const PAD = 64;
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const TAU = Math.PI * 2;

// ── texto que nunca se corta (funciones puras: reciben `measure(texto) → ancho`) ──
/** Parte `text` en líneas de ancho ≤ maxW. Una palabra más ancha que la línea se parte por caracteres. */
export function wrapLines(measure, text, maxW) {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines = [];
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
function loadImage(src, cors, ms = 9000) {
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
function isClean(img) {
  try {
    const c = document.createElement("canvas"); c.width = c.height = 2;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1);
    return true;
  } catch { return false; }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
const hexRgb = (h) => { const n = parseInt(String(h || "#ffffff").slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// ── el cielo de fondo ────────────────────────────────────────────────────
function drawChart(ctx, o) {
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
    const CW = 108, CH = 135, cell = document.createElement("canvas"); cell.width = CW; cell.height = CH;
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
    label(txt, p[0], p[1], `${labelStars ? 26 : 23}px ${SANS}`, "rgba(255,255,255,0.92)", 13);
  }
}

function drawReticle(ctx, x, y, r = 30) {
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
  if (obj.layer === "solar") {
    const b = BODIES[obj.name];
    if (b) {
      const img = await loadImage(textureUrl(b.id), false);
      const src = img || makeFallbackCanvas(b.id, 512, 256);
      const c = document.createElement("canvas"); c.width = 720; c.height = 360;
      const x = c.getContext("2d"); x.drawImage(src, 0, 0, 720, 360);
      let tex = null;
      try { tex = x.getImageData(0, 0, 720, 360); } catch { tex = null; }
      if (tex) model = { kind: "model", tex, body: b, key: obj.name, phase: obj.name === "Luna" && obj.illum != null ? { illum: obj.illum, waxing: obj.waxing } : null,
        label: img ? t.pcModel(t.texCredit[b.credit] || t.texCredit.sss) : t.pcModelFallback };
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
  if (obj.layer === "solar") {
    const h = await fromNasa();
    if (h) return h;
    if (model) return model;
  } else {
    for (const src of imageOrder(obj)) {
      const h = src === "nasa" ? await fromNasa() : await fromWiki();
      if (h) return h;
    }
  }
  if (obj.layer === "note") return null;
  return { kind: "art", art: artKind(obj), opts: artOptions(obj), label: t.pcArt };
}

function drawHero(ctx, hero, cx, top, maxW, maxH) {
  // devuelve la caja ocupada { x, y, w, h }
  if (hero.kind === "model") {
    const R = Math.min(maxH / 2, hero.body.ring ? maxW / 4.6 : maxW / 2.6), cy = top + maxH / 2;
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
    const w = hero.body.ring ? R * 4.7 : R * 2;
    return { x: cx - w / 2, y: cy - R, w, h: R * 2 };
  }
  let w, h, draw;
  if (hero.kind === "photo") {
    const iw = hero.img.naturalWidth, ih = hero.img.naturalHeight, s = Math.min(maxW / iw, maxH / ih);
    w = Math.round(iw * s); h = Math.round(ih * s);
    draw = (x, y) => { ctx.fillStyle = "#05080f"; ctx.fillRect(x, y, w, h); ctx.drawImage(hero.img, x, y, w, h); };
  } else {
    w = Math.min(maxW, 620); h = Math.min(maxH, 440);
    draw = (x, y) => drawArt(ctx, hero.art, x, y, w, h, hero.opts);
  }
  const x = Math.round(cx - w / 2), y = Math.round(top + (maxH - h) / 2);
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.75)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  roundRect(ctx, x, y, w, h, 28); ctx.fillStyle = "#05080f"; ctx.fill(); ctx.restore();
  ctx.save(); roundRect(ctx, x, y, w, h, 28); ctx.clip(); draw(x, y); ctx.restore();
  roundRect(ctx, x, y, w, h, 28); ctx.strokeStyle = "rgba(201,184,255,0.55)"; ctx.lineWidth = 2.5; ctx.stroke();
  return { x, y, w, h };
}

/**
 * Textos de la postal a partir del objeto (función pura).
 * @returns {{ title, type, facts: string[], local: string|null, credit: string }}
 */
export function postcardText({ obj, info, lang, t, local, con, fmt }) {
  if (con) {
    const facts = [];
    if (con.near && con.far && con.far.d > 0) facts.push(t.pcConFact(con.near.name || t.pcAStar, fmt.dist(con.near.d), con.far.name || t.pcAStar, fmt.dist(con.far.d)));
    facts.push(t.pcConAligned);
    return { title: con.title, type: con.type, facts, local: local ? localLine(con.dir, local, t, lang, fmt) : null, credit: t.pcData(t.pcSrcSky) };
  }
  if (!obj) {
    return { title: local ? t.pcSkyFrom(local.place) : t.pcSky, type: local ? fmt.when(local.date) : t.pcSkySub, facts: [t.pcSkyFact], local: null, credit: t.pcData(t.pcSrcSky) };
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
  return { title: info.name, type: info.type + (info.badge ? ` · ${info.badge}` : ""), facts: facts.slice(0, 3), local: local && obj.nx != null ? localLine([obj.nx, obj.ny, obj.nz], local, t, lang, fmt) : null, credit: t.pcData(src || t.pcSrcSky) };
}
function localLine(dir, local, t, lang, fmt) {
  const p = altAzJ2000(dir[0], dir[1], dir[2], local.lat, local.lon, local.date);   // dir: J2000, como la escena
  return p.alt > 0 ? t.pcLocalUp(local.place, fmt.when(local.date), Math.round(p.alt), compassPoint8(p.az)) : t.pcLocalDown(local.place, fmt.when(local.date));
}

/**
 * Dibuja la postal.
 * @param {object} p
 *   lang, t, fmt            idioma, diccionario y formateadores { dist, years, km, dur, when }
 *   sky, conDirs, bodies    catálogo de estrellas, centroides de constelaciones, efemérides del momento
 *   obj, info               objeto seleccionado y su descripción (describeObject) — o null
 *   wiki, credit            imagen de Wikipedia y su autor/licencia (opcionales)
 *   con                     { ab, title, type, dir, near, far, stars:Set<hip>, radius } para una constelación
 *   center                  dirección del centro si no hay objeto ni constelación
 *   local                   { lat, lon, date, place } en cielo local, o null
 * @returns {Promise<{ canvas, report }>}  report = { hero, heroLabel, lines:[{text,x,w,right}], overflow, truncated }
 */
export async function buildPostcard(p) {
  const { lang, t, fmt, sky, conDirs, bodies, obj, info, wiki, credit, con, local } = p;
  try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load(`600 80px ${SERIF}`), document.fonts.load(`400 30px ${SANS}`), document.fonts.load(`600 30px ${SANS}`)]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* se dibuja con las fuentes de respaldo */ }
  const canvas = document.createElement("canvas"); canvas.width = PC_W; canvas.height = PC_H;
  const ctx = canvas.getContext("2d");
  const W = PC_W, H = PC_H, maxW = W - PAD * 2;
  const report = { hero: "none", heroLabel: "", lines: [], overflow: false, truncated: false, w: W, h: H };
  const measureAt = (font) => (px) => (s) => { ctx.font = font(px); return ctx.measureText(s).width; };

  // 1 · textos, medidos antes de dibujar nada
  const txt = postcardText({ obj, info, lang, t, local, con, fmt });
  const fTitle = (px) => `600 ${px}px ${SERIF}`, fType = (px) => `500 ${px}px ${SANS}`, fFact = (px) => `400 ${px}px ${SANS}`, fSmall = (px) => `400 ${px}px ${SANS}`, fBrand = (px) => `600 ${px}px ${SANS}`;
  const title = fitLines(measureAt(fTitle), txt.title, { max: 96, min: 56, maxW, maxLines: 2 });
  const type = fitLines(measureAt(fType), txt.type, { max: 34, min: 26, maxW, maxLines: 2 });
  const facts = txt.facts.map((f) => fitLines(measureAt(fFact), f, { max: 34, min: 27, maxW: maxW - 34, maxLines: 3 }));
  const localL = txt.local ? fitLines(measureAt(fFact), txt.local, { max: 30, min: 24, maxW: maxW - 34, maxLines: 2 }) : null;
  const brand = fitLines(measureAt(fBrand), t.pcBrand, { max: 30, min: 22, maxW, maxLines: 1 });
  const creditL = fitLines(measureAt(fSmall), txt.credit, { max: 22, min: 18, maxW, maxLines: 2 });
  const lh = (f, k = 1.22) => Math.round(f.size * k) * f.lines.length;
  const blockH = lh(title, 1.02) + 14 + lh(type, 1.3) + 26 + facts.reduce((a, f) => a + lh(f, 1.3) + 12, 0) + (localL ? lh(localL, 1.3) + 14 : 0) + 30 + lh(brand, 1.2) + 8 + lh(creditL, 1.3);
  const blockTop = H - PAD + 6 - blockH;
  report.truncated = [title, type, ...facts, localL, brand, creditL].some((f) => f && f.truncated);

  // 2 · visual protagonista y encuadre del cielo
  const hero = con ? null : await heroFor(obj, wiki, credit, t);
  const heroTop = 64, capFont = (px) => `400 ${px}px ${SANS}`;
  const cap = hero ? fitLines(measureAt(capFont), hero.label, { max: 22, min: 17, maxW: maxW, maxLines: 2 }) : null;
  const capH = cap ? Math.round(cap.size * 1.3) * cap.lines.length : 0;
  let heroMaxH = 0, retY;
  if (hero) {
    // bajo el visual: rótulo, línea guía y retícula (≥ 150 px), y aire antes del texto
    heroMaxH = Math.max(240, Math.min(470, blockTop - heroTop - capH - 16 - 190));
    retY = heroTop + heroMaxH + 16 + capH + 100;
  } else retY = Math.round((blockTop - 40) / 2) + 30;
  const cx = W / 2;
  const centerDir = con ? con.dir : obj && obj.nx != null ? [obj.nx, obj.ny, obj.nz] : (p.center || [0, 0, 1]);
  const upHint = local ? dateToJ2000(zenithDir(local.lat, local.lon, local.date), local.date) : [0, 0, 1];
  // escala: una constelación se encuadra entera; un objeto muestra ~105° de cielo a lo ancho
  const pxPerRad = con ? Math.min(1500, Math.max(520, (Math.min(W * 0.42, (blockTop - 80) * 0.44)) / Math.max(0.12, con.radius))) : W / (105 * Math.PI / 180);
  const proj = makeProjection(centerDir, upHint, pxPerRad, cx, retY);
  const heroBox = hero ? { x: cx - (hero.kind === "model" ? 300 : 345), y: heroTop - 14, w: hero.kind === "model" ? 600 : 690, h: heroMaxH + capH + 44 } : null;
  const avoid = (x0, y0, x1, y1) => (y1 > blockTop - 36) || (heroBox && x1 > heroBox.x && x0 < heroBox.x + heroBox.w && y1 > heroBox.y && y0 < heroBox.y + heroBox.h) || (Math.abs((x0 + x1) / 2 - cx) < 70 + (x1 - x0) / 2 && Math.abs((y0 + y1) / 2 - retY) < 62 && !con);
  drawChart(ctx, { sky, conDirs, proj, avoid, bodies: p.showSolar === false ? [] : bodies, highlight: con ? con.ab : null, lang, local, cx, cy: retY, labelStars: con ? con.stars : null, starHex: p.starHex });

  if (hero) {
    const box = drawHero(ctx, hero, cx, heroTop, 690, heroMaxH);
    report.hero = hero.kind; report.heroLabel = hero.label; report.heroSource = hero.source || hero.kind; report.heroBox = box;
    // rótulo honesto bajo el visual
    ctx.font = capFont(cap.size); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "rgba(226,230,246,0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 8;
    let y = heroTop + heroMaxH + 16;
    for (const ln of cap.lines) { const w = ctx.measureText(ln).width; ctx.fillText(ln, cx, y); report.lines.push({ text: ln, x: cx - w / 2, w, right: cx + w / 2, role: "caption" }); y += Math.round(cap.size * 1.3); }
    ctx.shadowBlur = 0;
    // del visual a su lugar en el cielo
    ctx.save(); ctx.strokeStyle = "rgba(242,198,109,0.8)"; ctx.lineWidth = 2; ctx.setLineDash([7, 8]);
    ctx.beginPath(); ctx.moveTo(cx, y + 6); ctx.lineTo(cx, retY - 50); ctx.stroke(); ctx.restore();
    drawReticle(ctx, cx, retY);
  } else if (!con && obj) drawReticle(ctx, cx, retY);

  // 3 · bloque de texto sobre un velo que garantiza el contraste
  const veil = ctx.createLinearGradient(0, blockTop - 150, 0, H);
  veil.addColorStop(0, "rgba(4,7,14,0)"); veil.addColorStop(0.3, "rgba(4,7,14,0.86)"); veil.addColorStop(1, "rgba(4,7,14,0.97)");
  ctx.fillStyle = veil; ctx.fillRect(0, blockTop - 150, W, H - blockTop + 150);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  let y = blockTop;
  const put = (f, font, color, x, k, role) => {
    ctx.font = font(f.size); ctx.fillStyle = color;
    for (const ln of f.lines) {
      const w = ctx.measureText(ln).width;
      ctx.fillText(ln, x, y);
      report.lines.push({ text: ln, x, w, right: x + w, role });
      if (x + w > W - PAD + 1) report.overflow = true;
      y += Math.round(f.size * k);
    }
  };
  put(title, fTitle, "#ffffff", PAD, 1.02, "title"); y += 14;
  put(type, fType, "#cfc4ff", PAD, 1.3, "type"); y += 26;
  for (const f of facts) {
    ctx.fillStyle = "#f2c66d"; ctx.beginPath(); ctx.arc(PAD + 9, y + f.size * 0.62, 6, 0, TAU); ctx.fill();
    put(f, fFact, "rgba(240,242,252,0.96)", PAD + 34, 1.3, "fact"); y += 12;
  }
  if (localL) {
    ctx.strokeStyle = "#7db4ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(PAD + 9, y + localL.size * 0.62, 6, 0, TAU); ctx.stroke();
    put(localL, fFact, "#a9cdff", PAD + 34, 1.3, "local"); y += 14;
  }
  y += 10;
  ctx.fillStyle = "rgba(167,139,250,0.5)"; ctx.fillRect(PAD, y, maxW, 2); y += 20;
  put(brand, fBrand, "#e6deff", PAD, 1.2, "brand"); y += 8;
  put(creditL, fSmall, "rgba(226,230,246,0.78)", PAD, 1.3, "credit");
  report.bottom = y;
  if (y > H - 20) report.overflow = true;
  for (const l of report.lines) if (l.x < 0 || l.right > W - PAD + 1) report.overflow = true;
  return { canvas, report };
}

/** canvas → Blob PNG (null si el lienzo no se puede exportar). */
export function canvasBlob(canvas) {
  return new Promise((resolve) => {
    try { canvas.toBlob((b) => resolve(b), "image/png"); } catch { resolve(null); }
  });
}
