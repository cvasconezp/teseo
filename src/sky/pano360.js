// pano360.js — «Foto 360°» del cielo de Mi cielo: el lugar, la fecha, la hora y las capas encendidas, en una
// imagen equirectangular (2:1) que Google Fotos, Facebook y los visores 360° reconocen y dejan recorrer.
//
//   1. captureFaces(): seis fotos de 90° desde el observador (este, oeste, cenit, nadir, sur, norte) con el
//      mismo renderizador de la vista (mismos colores, montañas, nubes, atmósfera, monumentos, líneas…).
//   2. equirectFromFaces(): las une en la proyección equirectangular (columna = acimut, fila = altura).
//   3. drawPanoLabels(): los nombres (puntos cardinales, cumbres, monumentos, planetas, constelaciones,
//      estrellas brillantes) pintados en su altura y acimut, ensanchados según la latitud para que en el visor
//      se lean derechos.
//   4. drawNadirStamp(): el sello «Teseo · lugar · fecha» en el suelo, bajo el observador (como las cámaras 360°).
//   5. withGPano(): mete en el JPEG los metadatos XMP «GPano» (proyección equirectangular, tamaño, rumbo).
//
// Lo puro (geometría, etiquetas, XMP, nombre del archivo) se prueba en scripts/test_pano360.mjs.

import { labelStyle } from "./viewSnapshot.js";

const R = Math.PI / 180;
const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// ── geometría ─────────────────────────────────────────────────────────────────
/** Dirección en el marco local de Teseo (+X este, +Y cenit, −Z norte) para una altura y un acimut (grados). */
export function dirOf(alt, az) {
  const ca = Math.cos(alt * R);
  return [ca * Math.sin(az * R), Math.sin(alt * R), -ca * Math.cos(az * R)];
}

/** Altura y acimut (grados) de una dirección del marco local. */
export function altAzOf(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  const alt = Math.asin(Math.max(-1, Math.min(1, v[1] / n))) / R;
  const az = ((Math.atan2(v[0], -v[2]) / R) % 360 + 360) % 360;
  return { alt, az };
}

/** Las seis caras: hacia dónde miran (forward) y su «arriba» (up), en el marco local. */
export const FACES = [
  { key: "e", f: [1, 0, 0], u: [0, 1, 0] },
  { key: "w", f: [-1, 0, 0], u: [0, 1, 0] },
  { key: "zen", f: [0, 1, 0], u: [0, 0, 1] },
  { key: "nad", f: [0, -1, 0], u: [0, 0, -1] },
  { key: "s", f: [0, 0, 1], u: [0, 1, 0] },
  { key: "n", f: [0, 0, -1], u: [0, 1, 0] },
];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Derecha de la cámara de una cara (como three.js: derecha = adelante × arriba). */
export function rightOf(face) { return cross(face.f, face.u); }

/**
 * ¿En qué cara y en qué punto de ella (0..1, origen arriba a la izquierda) cae una dirección?
 * Devuelve { i, px, py }.
 */
export function faceOf(d) {
  let best = 0, bd = -Infinity;
  for (let i = 0; i < 6; i++) { const v = dot(d, FACES[i].f); if (v > bd) { bd = v; best = i; } }
  const fc = FACES[best], r = rightOf(fc);
  const x = dot(d, r) / bd, y = dot(d, fc.u) / bd;
  return { i: best, px: (x + 1) / 2, py: (1 - y) / 2 };
}

/** Píxel (x, y) de la imagen equirectangular W × H para una altura y un acimut; `heading` queda en el centro. */
export function equirectXY(alt, az, W, H, heading = 0) {
  let u = ((az - heading) / 360 + 0.5) % 1;
  if (u < 0) u += 1;
  return { x: u * W, y: ((90 - alt) / 180) * H };
}

// ── captura ───────────────────────────────────────────────────────────────────
/**
 * Seis fotos de 90° desde el observador con el renderizador de la vista. `before(cam)` / `after()` dejan
 * ajustar y restaurar lo que dependa de la cámara (tamaño de las estrellas, atmósfera que la sigue…).
 * Devuelve [ImageData × 6] en el orden de FACES.
 */
export function captureFaces({ THREE, renderer, scene, near = 0.1, far = 5000, size = 1024, before, after }) {
  const cam = new THREE.PerspectiveCamera(90, 1, near, far);
  cam.position.set(0, 0, 0);
  const prevSize = renderer.getSize(new THREE.Vector2()), prevPR = renderer.getPixelRatio();
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const g = c.getContext("2d", { willReadFrequently: true });
  const out = [];
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    for (const fc of FACES) {
      cam.up.set(fc.u[0], fc.u[1], fc.u[2]);
      cam.lookAt(fc.f[0], fc.f[1], fc.f[2]);
      cam.updateMatrixWorld(true);
      if (before) before(cam);
      renderer.render(scene, cam);
      g.fillStyle = "#03060d"; g.fillRect(0, 0, size, size);       // el lienzo WebGL es transparente
      g.drawImage(renderer.domElement, 0, 0, size, size);
      out.push(g.getImageData(0, 0, size, size));
    }
  } finally {
    renderer.setPixelRatio(prevPR);
    renderer.setSize(prevSize.x, prevSize.y, false);
    if (after) after();
  }
  return out;
}

/**
 * Recortes centrados en cada astro redondo (Sol, Luna, planetas). Los dibujos de three.js (Sprite) siempre miran
 * de frente a la pantalla: lejos del centro de una cara de 90° quedan más chicos de lo que la perspectiva exige en la
 * dirección radial (hasta un 30 % en el borde, un 42 % en las esquinas), y al desplegar la foto salían como óvalos.
 * Con la cámara apuntando justo al astro esa distorsión desaparece: este recorte se pega encima (pastePatches).
 * patches: [{ dir: [x, y, z] unitario, fov (grados) }]; pxPerDeg: la misma densidad que las caras.
 */
export function capturePatches({ THREE, renderer, scene, near = 0.1, far = 5000, patches, pxPerDeg, before, after }) {
  const out = [];
  if (!patches || !patches.length) return out;
  const prevSize = renderer.getSize(new THREE.Vector2()), prevPR = renderer.getPixelRatio();
  try {
    renderer.setPixelRatio(1);
    for (const pt of patches) {
      const size = Math.max(32, Math.min(1024, Math.ceil(pt.fov * pxPerDeg)));
      const cam = new THREE.PerspectiveCamera(pt.fov, 1, near, far);
      const d = pt.dir, up = Math.abs(d[1]) > 0.98 ? [0, 0, d[1] > 0 ? 1 : -1] : [0, 1, 0];
      cam.position.set(0, 0, 0); cam.up.set(up[0], up[1], up[2]); cam.lookAt(d[0], d[1], d[2]); cam.updateMatrixWorld(true);
      renderer.setSize(size, size, false);
      if (before) before(cam);
      renderer.render(scene, cam);
      const c = document.createElement("canvas"); c.width = size; c.height = size;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.fillStyle = "#03060d"; g.fillRect(0, 0, size, size);
      g.drawImage(renderer.domElement, 0, 0, size, size);
      const e = cam.matrixWorld.elements;                       // ejes de la cámara: derecha, arriba, adelante (−z)
      out.push({ dir: d, fov: pt.fov, size, data: g.getImageData(0, 0, size, size), r: [e[0], e[1], e[2]], u: [e[4], e[5], e[6]], f: [-e[8], -e[9], -e[10]] });
    }
  } finally {
    renderer.setPixelRatio(prevPR);
    renderer.setSize(prevSize.x, prevSize.y, false);
    if (after) after();
  }
  return out;
}

/** Pega los recortes de capturePatches sobre la imagen equirectangular (con un borde suave). Modifica `img`. */
export function pastePatches(img, W, H, heading, patches) {
  const out = img.data;
  for (const pt of patches) {
    const half = (pt.fov / 2) * R, rIn = half * 0.62, rOut = half * 0.85, t = Math.tan(half), size = pt.size, src = pt.data.data;
    const c = altAzOf(pt.f), aR = rOut / R;
    const y0 = Math.max(0, Math.floor(((90 - (c.alt + aR)) / 180) * H)), y1 = Math.min(H - 1, Math.ceil(((90 - (c.alt - aR)) / 180) * H));
    const polar = Math.abs(c.alt) + aR > 85;
    const dLon = polar ? 180 : aR / Math.max(0.05, Math.cos(Math.min(85, Math.abs(c.alt) + aR) * R));
    const cx = (((c.az - heading) / 360 + 0.5) % 1 + 1) % 1 * W, wx = Math.ceil((dLon / 360) * W);
    for (let y = y0; y <= y1; y++) {
      const alt = (90 - ((y + 0.5) / H) * 180) * R, ca = Math.cos(alt), sa = Math.sin(alt);
      for (let k = -wx; k <= wx; k++) {
        const x = ((Math.floor(cx) + k) % W + W) % W;
        const az = (heading + ((x + 0.5) / W - 0.5) * 360) * R;
        const d = [ca * Math.sin(az), sa, -ca * Math.cos(az)];
        const z = dot(d, pt.f);
        if (z <= 0) continue;
        const ang = Math.acos(Math.min(1, z));
        if (ang >= rOut) continue;
        const w = ang <= rIn ? 1 : 1 - (ang - rIn) / (rOut - rIn);
        const fx = ((dot(d, pt.r) / z / t + 1) / 2) * size - 0.5, fy = ((1 - dot(d, pt.u) / z / t) / 2) * size - 0.5;
        const x0 = Math.max(0, Math.min(size - 1, Math.floor(fx))), y0b = Math.max(0, Math.min(size - 1, Math.floor(fy)));
        const x1 = Math.min(size - 1, x0 + 1), y1b = Math.min(size - 1, y0b + 1);
        const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0b));
        const a = (y0b * size + x0) * 4, b = (y0b * size + x1) * 4, cc = (y1b * size + x0) * 4, e = (y1b * size + x1) * 4, o = (y * W + x) * 4;
        for (let q = 0; q < 3; q++) {
          const top = src[a + q] + (src[b + q] - src[a + q]) * tx, bot = src[cc + q] + (src[e + q] - src[cc + q]) * tx;
          out[o + q] = out[o + q] + ((top + (bot - top) * ty) - out[o + q]) * w;
        }
      }
    }
  }
  return img;
}

/**
 * Une las seis caras en una imagen equirectangular W × H (W = 2H), con interpolación bilineal dentro de cada
 * cara. `heading`: el acimut que queda en el centro de la imagen (lo primero que muestra un visor).
 */
export function equirectFromFaces(faces, W, H, heading = 0, ImageDataCtor = typeof ImageData !== "undefined" ? ImageData : null) {
  const size = faces[0].width, out = new Uint8ClampedArray(W * H * 4), datas = faces.map((f) => f.data);
  const rights = FACES.map(rightOf);
  const sinAz = new Float32Array(W), cosAz = new Float32Array(W);
  for (let x = 0; x < W; x++) { const az = (heading + ((x + 0.5) / W - 0.5) * 360) * R; sinAz[x] = Math.sin(az); cosAz[x] = Math.cos(az); }
  const d = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const alt = (90 - ((y + 0.5) / H) * 180) * R, ca = Math.cos(alt), sa = Math.sin(alt);
    for (let x = 0; x < W; x++) {
      d[0] = ca * sinAz[x]; d[1] = sa; d[2] = -ca * cosAz[x];
      // cara: el eje dominante
      const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]);
      let i;
      if (ax >= ay && ax >= az) i = d[0] > 0 ? 0 : 1;
      else if (ay >= az) i = d[1] > 0 ? 2 : 3;
      else i = d[2] > 0 ? 4 : 5;
      const fc = FACES[i], r = rights[i], bd = dot(d, fc.f);
      const fx = ((dot(d, r) / bd + 1) / 2) * size - 0.5, fy = ((1 - dot(d, fc.u) / bd) / 2) * size - 0.5;
      const x0 = Math.max(0, Math.min(size - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(size - 1, Math.floor(fy)));
      const x1 = Math.min(size - 1, x0 + 1), y1 = Math.min(size - 1, y0 + 1);
      const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
      const src = datas[i], o = (y * W + x) * 4;
      const a = (y0 * size + x0) * 4, b = (y0 * size + x1) * 4, c = (y1 * size + x0) * 4, e = (y1 * size + x1) * 4;
      for (let k = 0; k < 3; k++) {
        const top = src[a + k] + (src[b + k] - src[a + k]) * tx, bot = src[c + k] + (src[e + k] - src[c + k]) * tx;
        out[o + k] = top + (bot - top) * ty;
      }
      out[o + 3] = 255;
    }
  }
  return ImageDataCtor ? new ImageDataCtor(out, W, H) : { data: out, width: W, height: H };
}

// ── nombres ───────────────────────────────────────────────────────────────────
/** Ensanchamiento horizontal para que un texto a esa altura se lea derecho en el visor (tope 3×). */
export function stretchAt(alt) {
  return Math.min(3, 1 / Math.max(1 / 3, Math.cos(alt * R)));
}

/**
 * Elige qué nombres caben (sin solaparse, en el espacio de la imagen) y dónde van. Prioridad: el orden de la
 * lista. Devuelve [{ ...label, x, y, s, w, h }]. `measure(text, cls)` da el ancho en px a escala 1.
 */
export function layoutPanoLabels(labels, { W, H, heading = 0, f = 1, measure, maxAlt = 72 }) {
  const placed = [], boxes = [];
  const hit = (x0, y0, x1, y1) => {
    for (const b of boxes) {
      for (const sh of [0, -W, W]) if (x1 + sh > b[0] && x0 + sh < b[2] && y1 > b[1] && y0 < b[3]) return true;
    }
    return false;
  };
  for (const l of labels) {
    if (!l || !l.name || !Number.isFinite(l.alt) || !Number.isFinite(l.az) || Math.abs(l.alt) > maxAlt) continue;
    const { x, y } = equirectXY(l.alt, l.az, W, H, heading);
    const s = stretchAt(l.alt), w = (measure(l.name, l.cls) + 10) * f * s, h = (l.cls === "peak" ? 48 : 20) * f;
    const center = l.cls === "card" || l.cls === "cardn" || l.cls === "peak";
    const x0 = center ? x - w / 2 : x + 6 * f * s, y0 = l.cls === "peak" ? y - h : y - h / 2;
    if (hit(x0, y0, x0 + w, y0 + h)) continue;
    boxes.push([x0, y0, x0 + w, y0 + h]);
    placed.push({ ...l, x, y, s, w, h });
  }
  return placed;
}

/** Pinta los nombres colocados (con su ensanchamiento) y repite al otro lado los que cruzan el borde. */
export function drawPanoLabels(ctx, placed, colors, { W, f = 1 }) {
  ctx.save();
  ctx.textBaseline = "middle";
  for (const l of placed) {
    for (const sh of [0, -W, W]) {
      const x = l.x + sh;
      if (x + l.w < -20 || x - l.w > W + 20) continue;
      const st = labelStyle(l.cls), color = (colors && colors[l.cls]) || "#ffffff";
      ctx.save();
      ctx.translate(x, l.y); ctx.scale(l.s, 1);
      ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 6 * f; ctx.shadowOffsetY = 1 * f;
      ctx.fillStyle = color; ctx.strokeStyle = color; ctx.globalAlpha = st.alpha;
      ctx.font = st.font.replace(/([\d.]+)px/, (_, n) => `${n * f}px`);
      const text = st.upper ? String(l.name).toUpperCase() : String(l.name);
      if (st.peak) {
        ctx.lineWidth = Math.max(1, f); ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.moveTo(0, -1 * f); ctx.lineTo(0, -13 * f); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 2 * f, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.textAlign = "center";
        const sub = l.subText != null ? (typeof l.subText === "string" ? l.subText : `${Number(l.subText).toLocaleString("es", { useGrouping: "always" })} m`) : null;
        ctx.fillText(text, 0, -(sub ? 34 : 22) * f);
        if (sub) { ctx.globalAlpha = 0.8; ctx.font = `400 ${10.5 * f}px ${SANS}`; ctx.fillText(sub, 0, -20 * f); }
      } else if (st.center) {
        ctx.textAlign = "center"; ctx.fillText(text, 0, 0);
      } else {
        ctx.textAlign = "left"; ctx.fillText(text, 6 * f, 0);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * Sello en el suelo, bajo el observador: un óvalo oscuro con «Teseo», el lugar y la fecha, a −62° de altura
 * frente al centro de la imagen, ensanchado para leerse derecho al mirar hacia abajo.
 */
export function drawNadirStamp(ctx, { W, H, lines, small = [], f = 1 }) {
  const alt = -62, y = ((90 - alt) / 180) * H, x = W / 2, s = stretchAt(alt);
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, 1);
  const pad = 18 * f, lh = 22 * f, sh = 15 * f;
  const fontOf = (i) => (i === 0 ? `700 ${20 * f}px ${SANS}` : `500 ${15 * f}px ${SANS}`);
  const smallFont = `400 ${10.5 * f}px ${SANS}`;
  const widths = lines.map((t, i) => { ctx.font = fontOf(i); return ctx.measureText(t).width; });
  ctx.font = smallFont; for (const t of small) widths.push(ctx.measureText(t).width);
  const w = Math.max(...widths) + pad * 2;
  const h = lines.length * lh + (small.length ? small.length * sh + 8 * f : 0) + pad * 1.4;
  ctx.globalAlpha = 0.72; ctx.fillStyle = "#070b17";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 14 * f); else ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fill();
  ctx.globalAlpha = 1; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  lines.forEach((t, i) => {
    ctx.font = fontOf(i);
    ctx.fillStyle = i === 0 ? "#b9a6ff" : "#e6e8f5";
    ctx.fillText(t, 0, -h / 2 + pad * 0.7 + lh * (i + 0.5));
  });
  // créditos de los datos, en letra pequeña bajo el lugar y la fecha
  ctx.font = smallFont; ctx.fillStyle = "#aeb3d6";
  small.forEach((t, i) => ctx.fillText(t, 0, -h / 2 + pad * 0.7 + lh * lines.length + 8 * f + sh * (i + 0.5)));
  ctx.restore();
}

// ── créditos de los datos ─────────────────────────────────────────────────────
/**
 * Créditos de lo que aparece en la foto (licencias de CREDITS.md): estrellas y constelaciones siempre; relieve,
 * nombres de montañas, nubes y planetas solo si están. `f`: { terrain, landsat, peaks, clouds, planets }.
 */
export function panoCredits(f = {}, lang = "es") {
  const es = lang !== "en";
  const out = [es ? "Estrellas: HYG v4.1 (CC BY-SA 4.0) · Constelaciones: Stellarium (CC BY-SA)" : "Stars: HYG v4.1 (CC BY-SA 4.0) · Constellations: Stellarium (CC BY-SA)"];
  const more = [];
  if (f.terrain) more.push(es ? "Relieve: AWS Terrain Tiles (SRTM/NASA, GMTED2010/USGS)" : "Terrain: AWS Terrain Tiles (SRTM/NASA, GMTED2010/USGS)");
  if (f.landsat) more.push(es ? "Colores: Sentinel-2 cloudless – s2maps.eu, EOX (datos Copernicus 2016–2017, CC BY 4.0)" : "Colours: Sentinel-2 cloudless – s2maps.eu, EOX (Copernicus data 2016–2017, CC BY 4.0)");
  if (f.peaks) more.push(es ? "Montañas: Wikidata, © colaboradores de OpenStreetMap (ODbL)" : "Peaks: Wikidata, © OpenStreetMap contributors (ODbL)");
  if (f.clouds) more.push(es ? "Nubes: Open-Meteo.com (CC BY 4.0)" : "Clouds: Open-Meteo.com (CC BY 4.0)");
  if (f.sat) more.push(es ? `Nubes de ahora: ${f.sat}` : `Clouds now: ${f.sat}`);
  if (f.planets) more.push(es ? "Planetas: Solar System Scope (CC BY 4.0)" : "Planets: Solar System Scope (CC BY 4.0)");
  if (f.andean) more.push(es ? "Sitios andinos: Cobo, «Astronomía Quitu-Caranqui» (2012), y Wikipedia" : "Andean sites: Cobo, “Astronomía Quitu-Caranqui” (2012), and Wikipedia");
  // de dos en dos por línea, para que el sello no crezca demasiado
  for (let i = 0; i < more.length; i += 2) out.push(more.slice(i, i + 2).join(" · "));
  return out;
}

/** Créditos cortos para la marca que siempre se ve en el Cielo (capturas de pantalla). */
export function shortCredits(f = {}, lang = "es") {
  const parts = ["HYG", "Stellarium"];
  if (f.terrain) parts.push("AWS Terrain Tiles");
  if (f.landsat) parts.push("Sentinel-2 cloudless (EOX)");
  if (f.peaks) parts.push("© OpenStreetMap", "Wikidata");
  if (f.clouds) parts.push("Open-Meteo");
  if (f.sat) parts.push(f.sat);
  if (f.aurora) parts.push(f.aurora === "kp" ? (lang === "en" ? "estimated aurora (NOAA Kp)" : "aurora estimada (Kp NOAA)") : "NOAA SWPC OVATION");
  if (f.planets) parts.push("Solar System Scope");
  if (f.andean) parts.push("Cobo (2012)");
  return `${lang === "en" ? "Data" : "Datos"}: ${parts.join(" · ")}`;
}

const xmlEsc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── metadatos 360° (XMP «GPano») ──────────────────────────────────────────────
/** El paquete XMP con los datos de la proyección (Google Photo Sphere). */
export function gpanoXmp({ W, H, heading = 0, software = "Teseo", title = "", credits = [] }) {
  const hd = Math.round(((heading % 360) + 360) % 360 * 10) / 10;
  // autoría y créditos dentro del archivo (dc:*): viajan con la foto aunque se recorte el sello
  const alt = (t) => `<rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(t)}</rdf:li></rdf:Alt>`;
  const dc = `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">`
    + `<dc:creator><rdf:Seq><rdf:li>Teseo — teseo.yachaydeep.com</rdf:li></rdf:Seq></dc:creator>`
    + (title ? `<dc:title>${alt(title)}</dc:title>` : "")
    + (credits.length ? `<dc:rights>${alt(credits.join(" · "))}</dc:rights><dc:description>${alt([title, ...credits].filter(Boolean).join(" — "))}</dc:description>` : "")
    + `</rdf:Description>`;
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>`
    + `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`
    + `<rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/">`
    + `<GPano:ProjectionType>equirectangular</GPano:ProjectionType>`
    + `<GPano:UsePanoramaViewer>True</GPano:UsePanoramaViewer>`
    + `<GPano:CroppedAreaImageWidthPixels>${W}</GPano:CroppedAreaImageWidthPixels>`
    + `<GPano:CroppedAreaImageHeightPixels>${H}</GPano:CroppedAreaImageHeightPixels>`
    + `<GPano:FullPanoWidthPixels>${W}</GPano:FullPanoWidthPixels>`
    + `<GPano:FullPanoHeightPixels>${H}</GPano:FullPanoHeightPixels>`
    + `<GPano:CroppedAreaLeftPixels>0</GPano:CroppedAreaLeftPixels>`
    + `<GPano:CroppedAreaTopPixels>0</GPano:CroppedAreaTopPixels>`
    + `<GPano:PoseHeadingDegrees>${hd}</GPano:PoseHeadingDegrees>`
    + `<GPano:InitialViewHeadingDegrees>0</GPano:InitialViewHeadingDegrees>`
    + `<GPano:CaptureSoftware>${software}</GPano:CaptureSoftware>`
    + `</rdf:Description>${dc}</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}

/**
 * Inserta el XMP en un JPEG (Uint8Array) como segmento APP1, tras SOI y el APP0 (JFIF) si lo hay.
 * Devuelve un Uint8Array nuevo; si los bytes no son un JPEG, los devuelve tal cual.
 */
export function withGPano(jpeg, opts) {
  if (!jpeg || jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const ns = "http://ns.adobe.com/xap/1.0/\u0000";
  const payload = new TextEncoder().encode(ns + gpanoXmp(opts));
  const len = payload.length + 2;
  if (len > 0xffff) return jpeg;
  let at = 2;
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) at = 4 + ((jpeg[4] << 8) | jpeg[5]);   // tras el APP0 (JFIF)
  const seg = new Uint8Array(4 + payload.length);
  seg[0] = 0xff; seg[1] = 0xe1; seg[2] = (len >> 8) & 0xff; seg[3] = len & 0xff;
  seg.set(payload, 4);
  const out = new Uint8Array(jpeg.length + seg.length);
  out.set(jpeg.subarray(0, at), 0); out.set(seg, at); out.set(jpeg.subarray(at), at + seg.length);
  return out;
}

/** «teseo-360-nagarkot-2026-11-18-0656.jpg» (sin tildes ni espacios). */
export function panoFileName(place, parts) {
  const slug = String(place || "cielo").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "cielo";
  const z = (n) => String(n).padStart(2, "0");
  return `teseo-360-${slug}-${parts.y}-${z(parts.m)}-${z(parts.d)}-${z(parts.h)}${z(parts.mi)}.jpg`;
}

/**
 * Tamaño según el equipo, para que al hacer zoom en el visor 360 se vean los detalles (píxeles por grado = W / 360):
 *  · 8192 × 4096 (caras de 2048, ~23 px/°) con 8 GB o más y texturas de 8192 (computadoras y celulares grandes, no iOS);
 *  · 5760 × 2880 (caras de 1440, 16 px/°) en el resto, y siempre en iOS: Safari no deja lienzos de más de 16,7 Mpx;
 *  · 2048 × 1024 (caras de 512) con menos de 4 GB o texturas pequeñas.
 * `deviceMemoryGb` puede faltar (Safari, Firefox): se toma como equipo normal.
 */
export function panoSize(deviceMemoryGb, maxTexture = 4096, ios = false) {
  const mem = Number.isFinite(deviceMemoryGb) ? deviceMemoryGb : null;
  if ((mem != null && mem < 4) || maxTexture < 2048) return { W: 2048, H: 1024, face: 512 };
  if (!ios && mem != null && mem >= 8 && maxTexture >= 8192) return { W: 8192, H: 4096, face: 2048 };
  return { W: 5760, H: 2880, face: 1440 };
}
