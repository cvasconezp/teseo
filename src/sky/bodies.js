// bodies.js — datos y texturas 2D de Sol, Luna y planetas para la vista Cielo.
// Sin dependencia de three: solo metadatos reales y dibujo en <canvas>.
// La clave de cada cuerpo es el nombre en español que devuelve ephemeris.js.

// Diámetros, rotación y traslación: NASA Planetary Fact Sheet (valores redondeados).
// `tilt` = oblicuidad en grados (solo orienta el modelo 3D).
export const BODIES = {
  "Sol":      { id: "sun",     es: "Sol",      en: "Sun",     color: "#ffd23f", size: 24, tilt: 7.25,  spin: 1,  diameter_km: 1392700, day_h: 609.1,  credit: "sss" },
  "Luna":     { id: "moon",    es: "Luna",     en: "Moon",    color: "#d8dde8", size: 17, tilt: 6.7,   spin: 0,  diameter_km: 3474.8,  day_h: 655.7,  year_d: 27.32,  credit: "svs" },
  "Mercurio": { id: "mercury", es: "Mercurio", en: "Mercury", color: "#b0a080", size: 9,  tilt: 0.03,  spin: 1,  diameter_km: 4879,    day_h: 1407.6, year_d: 87.97,  credit: "messenger" },
  "Venus":    { id: "venus",   es: "Venus",    en: "Venus",   color: "#ffe6b0", size: 13, tilt: 2.6,   spin: -1, diameter_km: 12104,   day_h: 5832.5, year_d: 224.7,  credit: "sss" },
  "Marte":    { id: "mars",    es: "Marte",    en: "Mars",    color: "#ff6b4a", size: 11, tilt: 25.2,  spin: 1,  diameter_km: 6779,    day_h: 24.6,   year_d: 687,    credit: "sss" },
  "Júpiter":  { id: "jupiter", es: "Júpiter",  en: "Jupiter", color: "#e8c08a", size: 16, tilt: 3.1,   spin: 1,  diameter_km: 139820,  day_h: 9.9,    year_d: 4332.6, credit: "sss" },
  "Saturno":  { id: "saturn",  es: "Saturno",  en: "Saturn",  color: "#e8d8a0", size: 14, tilt: 26.7,  spin: 1,  diameter_km: 116460,  day_h: 10.7,   year_d: 10759,  credit: "sss", ring: true },
  "Urano":    { id: "uranus",  es: "Urano",    en: "Uranus",  color: "#a8e8e8", size: 11, tilt: 97.8,  spin: 1,  diameter_km: 50724,   day_h: 17.2,   year_d: 30687,  credit: "sss" },
  "Neptuno":  { id: "neptune", es: "Neptuno",  en: "Neptune", color: "#6a8cff", size: 11, tilt: 28.3,  spin: 1,  diameter_km: 49244,   day_h: 16.1,   year_d: 60190,  credit: "sss" },
};
export const BODY_NAMES = Object.keys(BODIES);
export const bodyName = (key, lang) => { const b = BODIES[key]; return b ? (b[lang] || b.es) : key; };
export const textureUrl = (id) => `/textures/${id}.jpg`;
export const RING_URL = "/textures/saturn-ring.png";

// generador determinista (las texturas de respaldo no cambian entre cargas)
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Paletas de respaldo: colores aproximados del aspecto real de cada cuerpo.
const FALLBACK = {
  sun:     { base: "#f6a21c", dark: "#c9600a", light: "#ffe27a", mode: "granules" },
  moon:    { base: "#9a9a98", dark: "#5e5e60", light: "#c8c8c4", mode: "craters" },
  mercury: { base: "#8f8780", dark: "#5d5751", light: "#b9b1a8", mode: "craters" },
  venus:   { base: "#e3c489", dark: "#c29a5c", light: "#f6e6bf", mode: "swirl" },
  mars:    { base: "#b9552f", dark: "#7a3620", light: "#dd8a55", mode: "mars" },
  jupiter: { base: "#d2a777", dark: "#9c6b47", light: "#f0dcc0", mode: "bands" },
  saturn:  { base: "#dcc48f", dark: "#b89a62", light: "#f2e4bd", mode: "bands" },
  uranus:  { base: "#a9e3e4", dark: "#86c9cf", light: "#cdf3f1", mode: "smooth" },
  neptune: { base: "#4b6fe0", dark: "#2f4bb0", light: "#86a4f5", mode: "smooth" },
};

// Textura equirectangular procedural (respaldo cuando no existe /textures/<id>.jpg).
// Es una REPRESENTACIÓN de color aproximado, no datos de una misión: la interfaz
// la etiqueta como tal.
export function makeFallbackCanvas(id, W = 512, H = 256) {
  const p = FALLBACK[id] || FALLBACK.moon;
  const base = hexToRgb(p.base), dark = hexToRgb(p.dark), light = hexToRgb(p.light);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const r = rng(id.split("").reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  x.fillStyle = p.base; x.fillRect(0, 0, W, H);

  if (p.mode === "bands" || p.mode === "smooth" || p.mode === "swirl") {
    const n = p.mode === "bands" ? 22 : p.mode === "swirl" ? 12 : 7;
    const amp = p.mode === "bands" ? 0.9 : p.mode === "swirl" ? 0.55 : 0.3;
    for (let i = 0; i < n; i++) {
      const y0 = (i / n) * H, hh = H / n + 1;
      const t = r() * amp;
      x.fillStyle = css(mix(base, r() > 0.5 ? dark : light, t), 0.85);
      x.fillRect(0, y0, W, hh);
    }
    // bordes ondulados entre bandas, para que no parezca un código de barras
    for (let i = 0; i < (p.mode === "smooth" ? 30 : 160); i++) {
      const y0 = r() * H, w = 40 + r() * 160, hh = 2 + r() * (p.mode === "swirl" ? 14 : 5);
      x.fillStyle = css(r() > 0.5 ? dark : light, 0.06 + r() * 0.1);
      x.beginPath(); x.ellipse(r() * W, y0, w, hh, 0, 0, Math.PI * 2); x.fill();
    }
  } else if (p.mode === "mars") {
    for (let i = 0; i < 70; i++) {         // regiones oscuras (basaltos) y claras (polvo)
      x.fillStyle = css(r() > 0.45 ? dark : light, 0.1 + r() * 0.2);
      x.beginPath(); x.ellipse(r() * W, H * (0.2 + r() * 0.6), 20 + r() * 70, 8 + r() * 28, r() * 3, 0, Math.PI * 2); x.fill();
    }
    // casquetes polares
    const cap = (y0, y1) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, "rgba(245,240,235,0.95)"); g.addColorStop(1, "rgba(245,240,235,0)"); x.fillStyle = g; x.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0)); };
    cap(0, H * 0.09); cap(H, H * 0.93);
  } else if (p.mode === "craters") {
    for (let i = 0; i < 26; i++) {         // mares / manchas grandes
      x.fillStyle = css(dark, 0.12 + r() * 0.2);
      x.beginPath(); x.ellipse(r() * W, r() * H, 14 + r() * 50, 10 + r() * 30, r() * 3, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 260; i++) {        // cráteres
      const cx = r() * W, cy = r() * H, rad = 1 + r() * r() * 9;
      x.fillStyle = css(dark, 0.25 + r() * 0.25); x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill();
      x.strokeStyle = css(light, 0.35); x.lineWidth = 0.7; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.stroke();
    }
  } else if (p.mode === "granules") {
    for (let i = 0; i < 900; i++) {
      x.fillStyle = css(r() > 0.5 ? light : dark, 0.08 + r() * 0.14);
      x.beginPath(); x.arc(r() * W, r() * H, 1 + r() * 5, 0, Math.PI * 2); x.fill();
    }
  }
  // costura: los bordes izquierdo y derecho deben coincidir al envolver la esfera
  const seam = x.getImageData(0, 0, 8, H);
  x.putImageData(seam, W - 8, 0);
  return c;
}

// ── Disco pequeño para el cielo 3D ────────────────────────────────────────
// Dibuja en un canvas 128×128 el cuerpo con halo + (si hay) su textura real
// recortada en círculo. `img` puede ser null: se usa la textura de respaldo.
// Para la Luna, `phase` = { illum 0..1, waxing } pinta la fase real del momento.
export const SPRITE_PX = 128;
export function drawBodySprite(canvas, key, img, phase) {
  const b = BODIES[key]; if (!b) return;
  const S = SPRITE_PX, cx = S / 2, cy = S / 2;
  const x = canvas.getContext("2d");
  x.clearRect(0, 0, S, S);
  const col = hexToRgb(b.color);
  const R = b.ring ? 21 : b.id === "sun" ? 26 : 28;     // radio del disco en px

  // halo: lo hace localizable; no representa el tamaño real del cuerpo
  const halo = x.createRadialGradient(cx, cy, R * 0.6, cx, cy, S / 2);
  halo.addColorStop(0, css(col, b.id === "sun" ? 0.85 : 0.42));
  halo.addColorStop(0.45, css(col, b.id === "sun" ? 0.28 : 0.12));
  halo.addColorStop(1, css(col, 0));
  x.fillStyle = halo; x.fillRect(0, 0, S, S);

  const src = img || makeFallbackCanvas(b.id, 256, 128);
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  const disc = () => {
    x.save();
    x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.clip();
    // hemisferio central de la textura equirectangular
    x.drawImage(src, sw * 0.25, 0, sw * 0.5, sh, cx - R, cy - R, R * 2, R * 2);
    if (b.id !== "sun") {                               // volumen: limbo más oscuro
      const g = x.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R * 1.05);
      g.addColorStop(0, "rgba(255,255,255,0.10)"); g.addColorStop(0.7, "rgba(0,0,0,0.05)"); g.addColorStop(1, "rgba(0,0,0,0.6)");
      x.fillStyle = g; x.fillRect(cx - R, cy - R, R * 2, R * 2);
    }
    x.restore();
  };
  const ring = (front) => {
    x.save();
    x.translate(cx, cy); x.rotate(-0.38);
    x.beginPath(); x.rect(-S, front ? 0 : -S, S * 2, S);  x.clip();
    for (const [rr, w, a] of [[R * 2.05, 5, 0.75], [R * 1.62, 4, 0.5], [R * 2.3, 1.5, 0.35]]) {
      x.strokeStyle = `rgba(226,205,160,${a})`; x.lineWidth = w;
      x.beginPath(); x.ellipse(0, 0, rr, rr * 0.3, 0, 0, Math.PI * 2); x.stroke();
    }
    x.restore();
  };
  if (b.ring) ring(false);
  disc();
  if (b.ring) ring(true);

  if (b.id === "moon" && phase && phase.illum != null) {
    // fase real: se oscurece la parte no iluminada (queda algo de luz cenicienta)
    const k = Math.max(0, Math.min(1, phase.illum)), lit = phase.waxing ? 1 : -1;
    x.save();
    x.beginPath(); x.arc(cx, cy, R + 0.5, 0, Math.PI * 2); x.clip();
    x.fillStyle = "rgba(4,7,14,0.86)";
    // fila a fila: el terminador es una semielipse de semieje R·(1−2k)
    for (let yy = -R; yy <= R; yy++) {
      const w = Math.sqrt(Math.max(0, R * R - yy * yy));
      const xt = w * (1 - 2 * k);                       // límite luz/sombra (lado iluminado a la derecha)
      if (lit > 0) x.fillRect(cx - w - 1, cy + yy, xt + w + 1, 1);
      else x.fillRect(cx - xt, cy + yy, xt + w + 1, 1);
    }
    x.restore();
  }
}
