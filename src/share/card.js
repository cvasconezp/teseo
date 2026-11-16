// card.js — dibuja la imagen para compartir de un evento de «Ahora» (1080 × 1920, formato de historias)
// con el MISMO lenguaje visual que la postal del Cielo (src/sky/postcard.js): cabecera «TESEO · con Killa
// Ñan · Astronomía comunitaria» en la zona segura superior, cielo real de fondo, visual protagonista con su
// rótulo honesto, título, tipo, cuadrícula de datos, frase, velo de contraste y pie con la URL, «Yachay
// Deep Labs × Killa Ñan» y el crédito de los datos. Ningún texto se corta (fitLines) y el resultado trae un
// informe (report) con cada línea, como la postal, para las pruebas.
//
// No cambia nada de la postal: importa sus piezas (tamaños, fitLines, layoutGrid, planLayout, el dibujo del
// cielo, la retícula…). Los textos y datos salen de eventText.js (puro).
import {
  PC_W, PC_H, SAFE_TOP, SAFE_BOTTOM, GRID, GRID_FONTS, GRID_MIN, PAD, SERIF, SANS, HERO_TOP, HERO_W, HERO_MIN, BAND_MAX,
  fitLines, layoutGrid, planLayout, makeProjection, zenithDir, drawChart, drawReticle, drawHighlighted, roundRect, loadImage,
} from "../sky/postcard.js";
import { drawSphere, drawArt } from "../sky/art.js";
import { BODIES, textureUrl, makeFallbackCanvas } from "../sky/bodies.js";
import { dateToJ2000, skyBodies } from "../sky/frames.js";
import { ephemeris } from "../ephemeris.js";
import { eventCardText, issTrackDirs, placeInfo, cardFmt, TE } from "./eventText.js";
import { loadRemoteImage } from "./images.js";

const TAU = Math.PI * 2;
const W = PC_W, H = PC_H, MAXW = W - PAD * 2, CX = W / 2;
const F = {
  title: (px) => `600 ${px}px ${SERIF}`, type: (px) => `500 ${px}px ${SANS}`, fact: (px) => `400 ${px}px ${SANS}`,
  small: (px) => `400 ${px}px ${SANS}`, url: (px) => `600 ${px}px ${SANS}`, coop: (px) => `600 ${px}px ${SANS}`,
  head: (px) => `600 ${px}px ${SANS}`, headSub: (px) => `500 ${px}px ${SANS}`, cap: (px) => `400 ${px}px ${SANS}`,
};

// ─── Texto: medida y reparto (puro: recibe measureAt(font)(px)(texto) → ancho) ─────────────────────────
/**
 * Mide y parte todos los textos de la tarjeta. `cells` puede venir recortada (de 6 a 4) si no cabe.
 * skyHero: el visual es el propio cielo → su rótulo va en el bloque de texto, encima del título.
 * Devuelve { title, type, grid, facts, where, cap, textH, truncated }.
 */
export function layoutText(measureAt, txt, { cells = txt.grid, capLabel = null, skyHero = false, curioLines = 3 } = {}) {
  const lh = (f, k) => Math.round(f.size * k) * f.lines.length;
  const title = fitLines(measureAt(F.title), txt.title, { max: 86, min: 56, maxW: MAXW, maxLines: 2 });
  const type = fitLines(measureAt(F.type), txt.type, { max: 34, min: 26, maxW: MAXW, maxLines: 2 });
  const grid = layoutGrid((role, px) => measureAt(GRID_FONTS[role])(px), cells, { x: PAD, y: 0, w: MAXW });
  const bullets = cells.length ? [txt.curio].filter(Boolean) : [];
  const facts = bullets.map((s) => fitLines(measureAt(F.fact), s, { max: 32, min: 26, maxW: MAXW - 34, maxLines: curioLines }));
  const where = txt.where ? fitLines(measureAt(F.fact), txt.where, { max: 28, min: 24, maxW: MAXW - 34, maxLines: 2 }) : null;
  const cap = capLabel ? fitLines(measureAt(F.cap), capLabel, { max: 24, min: 20, maxW: MAXW, maxLines: skyHero ? 3 : 2 }) : null;
  const capH = cap ? Math.round(cap.size * 1.3) * cap.lines.length : 0;
  const textH = (skyHero && cap ? capH + 18 : 0) + lh(title, 1.02) + 10 + lh(type, 1.3) + (grid.height ? 22 + grid.height : 0)
    + facts.reduce((a, f) => a + 22 + lh(f, 1.32), 0) + (where ? 16 + lh(where, 1.3) : 0);
  const truncated = [title, type, ...facts, where, cap].some((f) => f && f.truncated) || grid.truncated;
  return { title, type, grid, facts, where, cap, capH, textH, truncated };
}

/** Reparto vertical con recorte progresivo (de 6 a 4 casillas, luego 2 líneas de frase), como la postal. */
export function fitCard(measureAt, txt, { capLabel, skyHero, hasHero }) {
  let cells = txt.grid, curioLines = 3, L, plan;
  for (;;) {
    L = layoutText(measureAt, txt, { cells, capLabel, skyHero, curioLines });
    plan = skyHero ? { blockTop: PC_H - SAFE_BOTTOM - 22 - L.textH, fits: PC_H - SAFE_BOTTOM - 22 - L.textH - SAFE_TOP >= 560 } : planLayout(L.textH, L.capH, hasHero);
    if (plan.fits) break;
    // de dos en dos (de 6 a 4), quitando primero los datos menos importantes (p más alto; a igualdad, los del
    // final): nunca la primera casilla («cuándo») ni las del lugar
    const dataIdx = cells.map((c, i) => (c.kind === "data" && i > 0 ? i : -1)).filter((i) => i >= 0)
      .sort((a, b) => (cells[b].p || 2) - (cells[a].p || 2) || b - a);
    if (cells.length > GRID_MIN && dataIdx.length) { const drop = new Set(dataIdx.slice(0, Math.min(2, cells.length - GRID_MIN))); cells = cells.filter((_, i) => !drop.has(i)); continue; }
    if (curioLines > 2) { curioLines = 2; continue; }
    break;
  }
  return { L, plan, cells };
}

// ─── Visuales ────────────────────────────────────────────────────────────────
const texCache = new Map();
async function textureData(id, w = 1024, h = 512) {
  const key = `${id}:${w}`;
  if (texCache.has(key)) return texCache.get(key);
  const img = await loadImage(textureUrl(id), false);
  const src = img || makeFallbackCanvas(id, 512, 256);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.drawImage(src, 0, 0, w, h);
  let tex = null;
  try { tex = x.getImageData(0, 0, w, h); } catch { tex = null; }
  const out = tex ? { tex, real: !!img } : null;
  texCache.set(key, out);
  return out;
}

/**
 * Visual protagonista: { kind: "model" | "photo" | "canvas", label, source, size(maxW, maxH) → {w,h}, draw(ctx, x, y, w, h) }
 * o null cuando el visual es el propio cielo (meteoros, conjunciones, ISS). Nunca lanza.
 */
async function makeHero(v, T, api) {
  if (!v || /^sky-/.test(v.type)) return null;
  // inset: margen alrededor de la esfera para las marcas (eje y polo de la Tierra) sin salirse de su caja
  const sphere = (tex, opts, label, glow, ring, inset = 0) => ({
    kind: "model", label, source: "model",
    size: (maxW, maxH) => { const R = Math.min(maxH / 2 - inset, ring ? maxW / 4.6 : maxW / 2.6 - inset); return { w: ring ? R * 4.7 : R * 2 + inset * 2, h: R * 2 + inset * 2, R }; },
    draw: (ctx, x, y, w, h) => {
      const R = h / 2 - inset, cx = x + w / 2, cy = y + h / 2;
      if (glow) { const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * glow.k); g.addColorStop(0, glow.c); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * glow.k, 0, TAU); ctx.fill(); }
      if (ring) drawRing(ctx, cx, cy, R, false);
      drawSphere(ctx, tex, cx, cy, R, opts);
      if (ring) drawRing(ctx, cx, cy, R, true);
      if (v.after) v.after(ctx, cx, cy, R);
    },
  });
  try {
    if (v.type === "moon") {
      const t = await textureData("moon"); if (!t) return null;
      return sphere(t.tex, { lon0: 0, tilt: 0, phase: v.phase }, t.real ? v.label : T.lblFallbackModel, { k: 1.45, c: "rgba(216,221,232,0.30)" });
    }
    if (v.type === "eclipse-moon") {
      const t = await textureData("moon"); if (!t) return null;
      const h = sphere(t.tex, { lon0: 0, tilt: 0, phase: null }, v.label, { k: 1.4, c: v.eclipse === "total" ? "rgba(200,70,30,0.28)" : "rgba(216,221,232,0.22)" });
      const base = h.draw;
      h.draw = (ctx, x, y, w, hh) => { base(ctx, x, y, w, hh); drawEarthShadow(ctx, x + w / 2, y + hh / 2, hh / 2, v.eclipse, v.mag); };
      return h;
    }
    if (v.type === "eclipse-sun") {
      const t = await textureData("sun"); if (!t) return null;
      return {
        kind: "canvas", frame: false, label: v.label, source: "representation",
        size: (maxW, maxH) => { const s = Math.min(maxW * 0.7, maxH); return { w: s, h: s }; },
        draw: (ctx, x, y, w, h) => drawSolarEclipse(ctx, t.tex, x + w / 2, y + h / 2, h * 0.34, v.eclipse, v.mag),
      };
    }
    if (v.type === "planet") {
      const b = BODIES[v.key]; if (!b) return null;
      const t = await textureData(b.id); if (!t) return null;
      return sphere(t.tex, { lon0: 0.6, tilt: b.ring ? -0.38 : Math.max(-0.45, Math.min(0.45, (b.tilt || 0) * Math.PI / 180)) }, t.real ? v.label : v.labelFallback, { k: 1.45, c: b.color + "55" }, !!b.ring);
    }
    if (v.type === "earth") {
      const t = await textureData("earth"); if (!t) return null;
      const tilt = v.season === 1 ? -23.44 * Math.PI / 180 : v.season === 3 ? 23.44 * Math.PI / 180 : 0;
      const lon0 = v.lon != null ? v.lon * Math.PI / 180 - 0.55 : 0;
      const h = sphere(t.tex, { lon0, tilt, phase: { illum: 0.5, waxing: true } }, t.real ? v.label : T.lblFallbackModel, { k: 1.3, c: "rgba(110,160,255,0.28)" }, false, 60);
      v.after = (ctx, cx, cy, R) => drawEarthMarks(ctx, cx, cy, R, tilt, lon0, v);
      return h;
    }
    if (v.type === "asteroid") {
      return { kind: "canvas", label: v.label, source: "representation", aspect: 1.5,
        size: (maxW, maxH) => { const w = Math.min(maxW, maxH * 1.5); return { w, h: w / 1.5 }; },
        draw: (ctx, x, y, w, h) => drawAsteroidScale(ctx, x, y, w, h, v, T) };
    }
    if (v.type === "photo-launch" || v.type === "photo-sun" || v.type === "craft") {
      const got = v.url ? await loadRemoteImage(v.url, api) : null;
      if (got) {
        const img = got.img;
        return { kind: "photo", label: v.label, source: got.via, img,
          size: (maxW, maxH) => { const iw = img.naturalWidth, ih = img.naturalHeight, s = Math.min(maxW / iw, maxH / ih, 1.6 * Math.max(1, 640 / Math.max(iw, ih))); return { w: Math.round(iw * s), h: Math.round(ih * s) }; },
          draw: (ctx, x, y, w, h) => { ctx.fillStyle = "#05080f"; ctx.fillRect(x, y, w, h); ctx.drawImage(img, x, y, w, h); } };
      }
      // sin foto: la representación, con su rótulo
      if (v.type === "photo-sun") {
        const t = await textureData("sun"); if (!t) return null;
        return sphere(t.tex, { lon0: 0.6, tilt: 0, sun: true }, v.labelFallback, { k: 1.9, c: "#ffd23fcc" });
      }
      if (v.type === "craft") {
        return { kind: "canvas", label: v.labelFallback, source: "representation", size: artSize, draw: (ctx, x, y, w, h) => drawArt(ctx, "probe", x, y, w, h, { seed: 7, obj: { layer: "probes", name: v.name || "" } }) };
      }
      return { kind: "canvas", label: v.labelFallback, source: "representation", size: artSize, draw: (ctx, x, y, w, h) => drawRocket(ctx, x, y, w, h) };
    }
  } catch { /* cae a «sin visual»: el cielo y los datos siguen */ }
  return null;
}
const artSize = (maxW, maxH) => { const w = Math.min(maxW, 820, maxH * 1.41); return { w: Math.round(w), h: Math.round(w / 1.41) }; };

function drawRing(ctx, cx, cy, R, front) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.38);
  ctx.beginPath(); ctx.rect(-R * 3, front ? 0 : -R * 3, R * 6, R * 3); ctx.clip();
  for (const [rr, w, a] of [[2.12, 0.2, 0.75], [1.68, 0.2, 0.5], [1.42, 0.1, 0.28], [2.32, 0.05, 0.35]]) {
    ctx.strokeStyle = `rgba(226,205,160,${a})`; ctx.lineWidth = R * w;
    ctx.beginPath(); ctx.ellipse(0, 0, R * rr, R * rr * 0.3, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Sombra de la Tierra sobre la Luna (representación). Radio de la umbra ≈ 2,7 radios lunares y de la penumbra
 * ≈ umbra + 2 radios lunares (valores medios). La distancia entre centros sale de la magnitud umbral de la NASA:
 * m = (Ru + R − d) / 2R  →  d = Ru + R − 2·R·m. La sombra se dibuja desde arriba a la izquierda.
 */
function drawEarthShadow(ctx, cx, cy, R, type, mag) {
  const Ru = 2.7 * R, Rp = Ru + 2 * R, m = Number.isFinite(mag) ? mag : 0.5;
  const d = Math.max(0, Ru + R - 2 * R * m), ang = -2.4, sx = cx + Math.cos(ang) * d, sy = cy + Math.sin(ang) * d;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R - 0.5, 0, TAU); ctx.clip();
  // penumbra: oscurecimiento suave (en la totalidad toda la Luna está en la umbra: solo cuenta el tono rojizo)
  if (type !== "total") {
    const gp = ctx.createRadialGradient(sx, sy, Ru, sx, sy, Rp);
    gp.addColorStop(0, "rgba(10,8,12,0.55)"); gp.addColorStop(1, "rgba(10,8,12,0)");
    ctx.fillStyle = gp; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  }
  if (m > 0) {
    if (type === "total") {
      // en la totalidad la Luna se ve rojiza: la luz que la alcanza atraviesa la atmósfera de la Tierra
      ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgb(236,112,64)"; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.globalCompositeOperation = "screen"; ctx.fillStyle = "rgba(70,18,6,0.55)"; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.globalCompositeOperation = "source-over";
      const gu = ctx.createRadialGradient(sx, sy, Ru * 0.6, sx, sy, Ru);
      gu.addColorStop(0, "rgba(40,6,2,0.35)"); gu.addColorStop(1, "rgba(60,12,4,0.05)");
      ctx.fillStyle = gu; ctx.beginPath(); ctx.arc(sx, sy, Ru, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = "rgba(22,8,6,0.86)"; ctx.beginPath(); ctx.arc(sx, sy, Ru, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(170,60,30,0.45)"; ctx.lineWidth = 6; ctx.stroke();
    }
  }
  ctx.restore();
}

/** Eclipse de Sol (representación): disco del Sol con textura y el de la Luna, de radio = magnitud × radio solar. */
function drawSolarEclipse(ctx, tex, cx, cy, R, type, mag) {
  const k = Number.isFinite(mag) ? mag : 0.95, Rm = R * (type === "partial" ? 1.02 : k);
  const off = type === "partial" ? (1 - k) * 2 * R + (R - Rm) : 0;
  if (type === "total") {
    // corona (solo visible en la totalidad)
    const g = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 2.6);
    g.addColorStop(0, "rgba(255,250,235,0.85)"); g.addColorStop(0.25, "rgba(220,225,255,0.35)"); g.addColorStop(1, "rgba(200,210,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 2.6, 0, TAU); ctx.fill();
  } else {
    const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.9);
    g.addColorStop(0, "#ffd23fcc"); g.addColorStop(1, "#ffd23f00");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.9, 0, TAU); ctx.fill();
  }
  if (type !== "total") drawSphere(ctx, tex, cx, cy, R, { lon0: 0.6, tilt: 0, sun: true });
  ctx.fillStyle = "#030409"; ctx.beginPath(); ctx.arc(cx + off, cy - off * 0.2, Rm, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2; ctx.stroke();
}

/** Marcas sobre la Tierra de las estaciones: eje y polo norte, el lugar y los rayos del Sol que llegan por la derecha. */
function drawEarthMarks(ctx, cx, cy, R, tilt, lon0, v) {
  const st = Math.sin(tilt), ct = Math.cos(tilt);
  const ax = -st, ay = -ct;                        // dirección del polo norte en pantalla (y hacia abajo)
  ctx.save();
  ctx.strokeStyle = "rgba(230,236,255,0.75)"; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(cx - ax * (R + 22), cy - ay * (R + 22)); ctx.lineTo(cx + ax * (R + 22), cy + ay * (R + 22)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `600 28px ${SANS}`; ctx.fillStyle = "#e6deff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("N", cx + ax * (R + 22) + 26, cy + ay * (R + 22) + 4);
  // rayos del Sol
  ctx.strokeStyle = "rgba(242,198,109,0.85)"; ctx.lineWidth = 4;
  for (const dy of [-0.55, 0, 0.55]) {
    const y = cy + dy * R, x1 = Math.min(cx + R * 1.95, PC_W - PAD), x0 = cx + R * 1.3;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x0, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 16, y - 10); ctx.moveTo(x0, y); ctx.lineTo(x0 + 16, y + 10); ctx.stroke();
  }
  // el lugar elegido (si se ve en la cara dibujada)
  if (v.lat != null && v.lon != null) {
    const phi = v.lat * Math.PI / 180, lam = v.lon * Math.PI / 180 - lon0;
    const xb = Math.cos(phi) * Math.sin(lam), yb = Math.sin(phi), zz = Math.cos(phi) * Math.cos(lam);
    if (zz > 0.1) {
      const xx = xb * ct - yb * st, yy = xb * st + yb * ct, px = cx + xx * R, py = cy - yy * R;
      ctx.fillStyle = "#f2c66d"; ctx.strokeStyle = "#1a1206"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, 10, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.font = `600 28px ${SANS}`; ctx.textAlign = "left"; ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 8;
      ctx.fillStyle = "#ffffff"; ctx.fillText(v.place || "", px + 18, py);
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
}

/** Asteroide: la Tierra, la órbita de la Luna y la distancia mínima del paso, a escala lineal (en distancias lunares). */
function drawAsteroidScale(ctx, x, y, w, h, v, T) {
  const es = T === TE.es;
  ctx.save();
  const g = ctx.createRadialGradient(x + w * 0.2, y + h / 2, 0, x + w * 0.2, y + h / 2, w);
  g.addColorStop(0, "#101a36"); g.addColorStop(1, "#05080f");
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const ld = Number.isFinite(v.ld) ? v.ld : 1;
  const maxLd = Math.max(1.3, ld * 1.12), x0 = x + 90, cy = y + h * 0.42, px = (w - 150) / maxLd;
  // regla en distancias lunares
  ctx.strokeStyle = "rgba(201,184,255,0.45)"; ctx.lineWidth = 2; ctx.fillStyle = "rgba(226,230,246,0.85)";
  ctx.font = `500 24px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "top";
  const step = maxLd > 30 ? 10 : maxLd > 12 ? 5 : maxLd > 5 ? 2 : 1;
  const ry = y + h - 100;
  ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x0 + maxLd * px, ry); ctx.stroke();
  for (let k = 0; k <= maxLd + 1e-9; k += step) {
    const xx = x0 + k * px;
    ctx.beginPath(); ctx.moveTo(xx, ry - 8); ctx.lineTo(xx, ry + 8); ctx.stroke();
    ctx.fillText(String(k), xx, ry + 12);
  }
  ctx.textAlign = "center"; ctx.fillText(es ? "escala en distancias lunares (DL)" : "scale in lunar distances (LD)", x0 + maxLd * px / 2, ry + 46);
  // órbita de la Luna (1 DL)
  ctx.strokeStyle = "rgba(216,221,232,0.6)"; ctx.lineWidth = 2.5; ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.arc(x0, cy, px, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  // la distancia del asteroide: línea y punto
  const ax = x0 + ld * px;
  ctx.strokeStyle = "rgba(242,198,109,0.9)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0 + 22, cy); ctx.lineTo(ax - 18, cy); ctx.stroke();
  const gl = ctx.createRadialGradient(ax, cy, 0, ax, cy, 26); gl.addColorStop(0, "rgba(242,198,109,0.9)"); gl.addColorStop(1, "rgba(242,198,109,0)");
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(ax, cy, 26, 0, TAU); ctx.fill();
  ctx.fillStyle = "#f2c66d"; ctx.beginPath(); ctx.arc(ax, cy, 8, 0, TAU); ctx.fill();
  // Tierra y Luna (ampliadas: a escala serían de ~1 px)
  const ge = ctx.createRadialGradient(x0 - 6, cy - 6, 2, x0, cy, 20); ge.addColorStop(0, "#9cc7ff"); ge.addColorStop(1, "#2a5bd0");
  ctx.fillStyle = ge; ctx.beginPath(); ctx.arc(x0, cy, 18, 0, TAU); ctx.fill();
  const ma = -0.8, mx = x0 + Math.cos(ma) * px, my = cy + Math.sin(ma) * px;
  ctx.fillStyle = "#d8dde8"; ctx.beginPath(); ctx.arc(mx, my, 9, 0, TAU); ctx.fill();
  // nombres (≥ 24 px)
  ctx.textBaseline = "middle"; ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 6;
  ctx.font = `600 26px ${SANS}`; ctx.fillStyle = "#cfe0ff"; ctx.textAlign = "left";
  ctx.fillText(es ? "Tierra" : "Earth", x + 24, cy + 52);
  ctx.fillStyle = "#e6e9f2"; ctx.fillText(es ? "Luna" : "Moon", mx + 16, my - 4);
  ctx.fillStyle = "#f2c66d"; ctx.textAlign = ax > x + w - 260 ? "right" : "left";
  const lx = ax > x + w - 260 ? ax - 18 : ax + 18;
  ctx.fillText(v.name || "", lx, cy - 40);
  ctx.font = `500 24px ${SANS}`; ctx.fillText(`${String(Math.round(ld * 10) / 10).replace(".", es ? "," : ".")} ${es ? "DL" : "LD"}`, lx, cy + 40);
  ctx.restore();
}

/** Cohete esquemático (cuando no hay foto que se pueda dibujar). */
function drawRocket(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "#0b1430"); g.addColorStop(1, "#1c1530");
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, top = y + h * 0.1, bh = h * 0.62, bw = Math.min(w * 0.09, 64);
  const fl = ctx.createLinearGradient(0, top + bh, 0, y + h); fl.addColorStop(0, "rgba(255,210,120,0.95)"); fl.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = fl; ctx.beginPath(); ctx.moveTo(cx - bw * 0.7, top + bh); ctx.quadraticCurveTo(cx, y + h * 1.05, cx + bw * 0.7, top + bh); ctx.fill();
  ctx.fillStyle = "#e9ecf5"; ctx.beginPath();
  ctx.moveTo(cx, top); ctx.quadraticCurveTo(cx + bw, top + bh * 0.18, cx + bw * 0.55, top + bh * 0.3); ctx.lineTo(cx + bw * 0.55, top + bh);
  ctx.lineTo(cx - bw * 0.55, top + bh); ctx.lineTo(cx - bw * 0.55, top + bh * 0.3); ctx.quadraticCurveTo(cx - bw, top + bh * 0.18, cx, top); ctx.fill();
  ctx.fillStyle = "#9aa6c8";
  ctx.beginPath(); ctx.moveTo(cx - bw * 0.55, top + bh * 0.78); ctx.lineTo(cx - bw * 1.3, top + bh); ctx.lineTo(cx - bw * 0.55, top + bh); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + bw * 0.55, top + bh * 0.78); ctx.lineTo(cx + bw * 1.3, top + bh); ctx.lineTo(cx + bw * 0.55, top + bh); ctx.fill();
}

// ─── Superposiciones sobre el cielo ─────────────────────────────────────────
function drawRadiant(ctx, x, y) {
  ctx.save();
  // estelas ILUSTRATIVAS que salen del radiante (el rótulo lo dice)
  const rays = [[-2.6, 150, 330], [-1.9, 120, 300], [-1.1, 170, 360], [-0.3, 130, 290], [0.5, 160, 340], [1.4, 140, 300], [2.2, 180, 350], [2.9, 120, 260]];
  for (const [a, r0, r1] of rays) {
    const x0 = x + Math.cos(a) * r0, y0 = y + Math.sin(a) * r0, x1 = x + Math.cos(a) * r1, y1 = y + Math.sin(a) * r1;
    const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,244,214,0.9)");
    ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.strokeStyle = "#f2c66d"; ctx.lineWidth = 4; ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
  ctx.restore();
}
/** Puntos proyectados de la pasada y sus marcas (inicio, máximo, final) con el rótulo ya colocado. */
function issLayout(ctx, proj, pts, fmt) {
  const P = pts.map((q) => ({ ...q, p: proj.project(q.dir) }));
  if (P.length < 2) return { P, marks: [] };
  const iMax = P.reduce((m, q, i) => (q.alt > P[m].alt ? i : m), 0);
  ctx.save(); ctx.font = `600 26px ${SANS}`;
  const placed = [], marks = [];
  for (const [i, k] of [[0, "start"], [iMax, "max"], [P.length - 1, "end"]]) {
    const q = P[i], text = k === "max" ? `${fmt.time(q.t)} · ${Math.round(q.alt)}°` : fmt.time(q.t);
    const w = ctx.measureText(text).width + 20, h = 38;
    // a un lado de la trayectoria: el que se aleja del centro del dibujo, sin pisar otro rótulo
    const dir = Math.atan2(P[Math.min(P.length - 1, i + 1)].p[1] - P[Math.max(0, i - 1)].p[1], P[Math.min(P.length - 1, i + 1)].p[0] - P[Math.max(0, i - 1)].p[0]);
    let best = null;
    for (const side of [1, -1]) for (const dist of [34, 60, 90]) {
      const nx = -Math.sin(dir) * side, ny = Math.cos(dir) * side;
      const cxl = q.p[0] + nx * (dist + w / 2 * Math.abs(nx)), cyl = q.p[1] + ny * (dist + h / 2 * Math.abs(ny));
      let x = cxl - w / 2, y = cyl - h / 2;
      x = Math.max(PAD - 40, Math.min(PC_W - PAD + 40 - w, x));
      const hit = placed.some((b) => x < b.x + b.w + 6 && x + w + 6 > b.x && y < b.y + b.h + 6 && y + h + 6 > b.y);
      if (!hit) { best = { x, y, w, h }; break; }
    }
    if (!best) best = { x: q.p[0] + 18, y: q.p[1] - 19 - placed.length * 42, w, h };
    placed.push(best);
    marks.push({ k, x: q.p[0], y: q.p[1], t: q.t, alt: q.alt, text, box: best });
  }
  ctx.restore();
  return { P, marks };
}
function drawIssTrack(ctx, lay) {
  const { P, marks } = lay;
  if (P.length < 2) return;
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], lit = a.lit && b.lit;
    ctx.strokeStyle = lit ? "#f2c66d" : "rgba(170,180,210,0.75)"; ctx.lineWidth = lit ? 7 : 4; ctx.setLineDash(lit ? [] : [10, 12]);
    ctx.beginPath(); ctx.moveTo(a.p[0], a.p[1]); ctx.lineTo(b.p[0], b.p[1]); ctx.stroke();
  }
  ctx.setLineDash([]);
  // flecha del sentido de la marcha
  const e = P[P.length - 1].p, s = P[Math.max(0, P.length - 4)].p, ang = Math.atan2(e[1] - s[1], e[0] - s[0]);
  ctx.fillStyle = "#f2c66d"; ctx.beginPath(); ctx.moveTo(e[0] + Math.cos(ang) * 22, e[1] + Math.sin(ang) * 22);
  ctx.lineTo(e[0] + Math.cos(ang + 2.5) * 22, e[1] + Math.sin(ang + 2.5) * 22); ctx.lineTo(e[0] + Math.cos(ang - 2.5) * 22, e[1] + Math.sin(ang - 2.5) * 22); ctx.fill();
  // puntos con hora: inicio, máximo y final, con su rótulo sobre una pastilla oscura
  for (const m of marks) {
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#0a0f1e"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.k === "max" ? 11 : 8, 0, TAU); ctx.fill(); ctx.stroke();
    const b = m.box;
    roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fillStyle = "rgba(6,10,22,0.82)"; ctx.fill();
    ctx.strokeStyle = "rgba(242,198,109,0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `600 26px ${SANS}`; ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(m.text, b.x + b.w / 2, b.y + b.h / 2 + 1);
  }
  ctx.restore();
}
/** Cielo entero (cenit en el centro): suelo fuera del horizonte, línea del horizonte y los cuatro puntos cardinales. */
function drawAllSkyFrame(ctx, cx, cy, Rh, lang) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, PC_W, PC_H); ctx.arc(cx, cy, Rh, 0, TAU, true);
  ctx.fillStyle = "rgba(5,8,13,0.86)"; ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(125,180,255,0.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, TAU); ctx.stroke();
  ctx.font = `600 30px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "rgba(147,197,253,0.95)";
  // con el norte arriba y mirando hacia arriba, el este queda a la izquierda
  for (const [t, dx, dy] of [["N", 0, -1], ["S", 0, 1], ["E", -1, 0], [lang === "es" ? "O" : "W", 1, 0]]) ctx.fillText(t, cx + dx * (Rh + 26), cy + dy * (Rh + 26));
  ctx.restore();
}
/** Para el cielo entero: estrellas hasta magnitud 4,6 y todas las de las figuras (menos ruido, mismas líneas). */
const lightSky = new WeakMap();
function skyForAllSky(sky) {
  let s = lightSky.get(sky);
  if (s) return s;
  const inLines = new Set(); sky.constellations.forEach((c) => c.lines.forEach((pl) => pl.forEach((h) => inLines.add(h))));
  s = { ...sky, stars: sky.stars.filter((st) => st[4] <= 4.6 || inLines.has(st[0])) };
  lightSky.set(sky, s);
  return s;
}

// ─── El cielo ────────────────────────────────────────────────────────────────
function conDirsOf(sky) {
  const byHip = new Map(); sky.stars.forEach((st) => byHip.set(st[0], st));
  return sky.constellations.map((c) => {
    let x = 0, y = 0, z = 0; const seen = new Set();
    c.lines.forEach((pl) => pl.forEach((h) => { if (seen.has(h)) return; seen.add(h); const st = byHip.get(h); if (st) { x += st[1]; y += st[2]; z += st[3]; } }));
    const L = Math.hypot(x, y, z);
    return L > 0 ? { ab: c.ab, name: c.la, dir: [x / L, y / L, z / L] } : null;
  }).filter(Boolean);
}
const conCache = new WeakMap();

/**
 * Dibuja la imagen para compartir de un evento de «Ahora».
 * @param p { spec, lang, place, api, now, sky }  sky = catálogo /sky.json (o null: fondo liso)
 * @returns {Promise<{ canvas, report }>}  report como el de la postal (+ kind, heroSource)
 */
export async function buildEventCard(p) {
  const { spec, lang = "es", place = null, api = "", sky = null } = p;
  const now = p.now || Date.now();
  const T = TE[lang] || TE.es;
  const txt = eventCardText(spec, lang, place, now);
  const pl = placeInfo(place, lang), fmt = cardFmt(lang, pl.tz, now);
  try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load(`600 80px ${SERIF}`), document.fonts.load(`400 30px ${SANS}`), document.fonts.load(`600 30px ${SANS}`)]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fuentes de respaldo */ }
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const report = { kind: txt.kind, hero: "none", heroLabel: "", heroSource: "none", lines: [], grid: [], overflow: false, gridOverflow: false, truncated: false, safeZoneOk: true, w: W, h: H };
  const measureAt = (font) => (px) => (s) => { ctx.font = font(px); return ctx.measureText(s).width; };

  // 1 · visual y textos
  const hero = await makeHero(txt.visual, T, api);
  const skyHero = !!(txt.sky && txt.sky.skyHero);
  const capLabel = hero ? hero.label : skyHero && txt.visual ? txt.visual.label : null;
  const { L, plan } = fitCard(measureAt, txt, { capLabel, skyHero, hasHero: !!hero });
  const blockTop = plan.blockTop;
  report.truncated = L.truncated;
  const url = fitLines(measureAt(F.url), T.pcUrl, { max: 44, min: 30, maxW: MAXW, maxLines: 1 });
  const coop = fitLines(measureAt(F.coop), T.pcCoop, { max: 32, min: 24, maxW: MAXW, maxLines: 2 });
  const creditL = fitLines(measureAt(F.small), txt.credit, { max: 22, min: 20, maxW: MAXW, maxLines: 2 });
  const headSub = fitLines(measureAt(F.headSub), T.pcHeadWith, { max: 28, min: 24, maxW: MAXW, maxLines: 1 });
  if ([url, coop, creditL, headSub].some((f) => f.truncated)) report.truncated = true;

  // 2 · encuadre: visual arriba y retícula en la banda; o el cielo como protagonista
  let heroTop = plan.heroTop || HERO_TOP, heroDims = null, capTop = 0, retY;
  const cap = L.cap, capH = L.capH;
  if (hero) {
    heroDims = hero.size(HERO_W, Math.max(HERO_MIN, plan.heroMaxH));
    let band = blockTop - (heroTop + heroDims.h + 16 + capH);
    if (band > BAND_MAX) { heroTop += Math.round((band - BAND_MAX) / 2); band = blockTop - (heroTop + heroDims.h + 16 + capH); }
    capTop = heroTop + heroDims.h + 16;
    retY = Math.round(capTop + capH + (band - 40) / 2 + 12);
  } else retY = Math.round((SAFE_TOP + blockTop - 40) / 2);

  const sk = txt.sky || {};
  const date = new Date(sk.date || now);
  const local = pl.lat != null && sk.local ? { lat: pl.lat, lon: pl.lon, date, place: pl.name } : null;
  const zen = pl.lat != null ? dateToJ2000(zenithDir(pl.lat, pl.lon, date), date) : [0, 0, 1];
  const pole = dateToJ2000([0, 0, 1], date);
  const center = sk.allSky ? zen : (sk.center || zen);
  const upHint = sk.allSky ? pole : zen;
  const areaH = blockTop - 40 - SAFE_TOP;
  const Rh = Math.max(240, Math.min(W / 2 - 80, areaH / 2 - 56));            // radio del horizonte (cielo entero)
  const pxPerRad = sk.allSky ? Rh / 2 : (sk.zoom || W / (105 * Math.PI / 180));
  const proj = makeProjection(center, upHint, pxPerRad, CX, retY);
  const capW = cap ? Math.max(...cap.lines.map((l) => measureAt(F.cap)(cap.size)(l))) : 0;
  const boxW = Math.max(heroDims ? heroDims.w : 0, hero ? capW : 0);
  const heroBox = hero ? { x: CX - boxW / 2 - 16, y: heroTop - 14, w: boxW + 32, h: heroDims.h + 16 + capH + 30 } : null;
  const guideTop = hero ? capTop + capH : retY;
  const reticle = !!(sk.reticle && sk.center);
  // ISS: la trayectoria y sus rótulos se colocan ANTES del cielo para que los nombres de estrellas no los pisen
  const v = txt.visual || {};
  const issLay = v.type === "sky-iss" ? issLayout(ctx, proj, issTrackDirs(v.track, pl), fmt) : null;
  const issHit = (x0, y0, x1, y1) => !!issLay && (issLay.marks.some((m) => x1 > m.box.x - 4 && x0 < m.box.x + m.box.w + 4 && y1 > m.box.y - 4 && y0 < m.box.y + m.box.h + 4) ||
    issLay.P.some((q) => x1 > q.p[0] - 10 && x0 < q.p[0] + 10 && y1 > q.p[1] - 10 && y0 < q.p[1] + 10));
  // en el cielo entero, ningún nombre fuera del horizonte (ahí va el suelo)
  const outsideSky = (x0, y0, x1, y1) => !!sk.allSky && [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].some(([x, y]) => Math.hypot(x - CX, y - retY) > Rh - 6);
  const avoid = (x0, y0, x1, y1) => issHit(x0, y0, x1, y1) || outsideSky(x0, y0, x1, y1) || (y0 < SAFE_TOP + 6) || (y1 > blockTop - 36) || (heroBox && x1 > heroBox.x && x0 < heroBox.x + heroBox.w && y1 > heroBox.y && y0 < heroBox.y + heroBox.h) ||
    (reticle && Math.abs((x0 + x1) / 2 - CX) < 70 + (x1 - x0) / 2 && Math.abs((y0 + y1) / 2 - retY) < 62) ||
    (hero && reticle && x1 > CX - 24 && x0 < CX + 24 && y1 > guideTop && y0 < retY);
  if (sky && sky.stars) {
    let conDirs = conCache.get(sky); if (!conDirs) { conDirs = conDirsOf(sky); conCache.set(sky, conDirs); }
    let bodies = [];
    try { bodies = skyBodies(ephemeris(date), date, local ? { lat: pl.lat, lon: pl.lon, elev: pl.elev || 0 } : null); } catch { bodies = []; }
    // cielo entero: sin el horizonte de drawChart (sus cardinales quedan justo en el borde); se dibuja aparte
    drawChart(ctx, { sky: sk.allSky ? skyForAllSky(sky) : sky, conDirs, proj, avoid, bodies, highlight: null, lang, local: sk.allSky ? null : local, cx: CX, cy: retY, labelStars: null });
  } else {
    const g = ctx.createRadialGradient(CX, retY, 0, CX, retY, H * 0.8);
    g.addColorStop(0, "#0d1530"); g.addColorStop(0.6, "#070c1c"); g.addColorStop(1, "#03060d");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (sk.allSky) drawAllSkyFrame(ctx, CX, retY, Rh, lang);
  // superposiciones del cielo protagonista
  if (v.type === "sky-meteor") { const q = proj.project(v.radiant); if (q[2] > 0) drawRadiant(ctx, q[0], q[1]); }
  if (v.type === "sky-conj") {
    ctx.save(); ctx.strokeStyle = "rgba(242,198,109,0.9)"; ctx.lineWidth = 3;
    for (const n of v.bodies || []) {
      let dir = null;
      try { const b = skyBodies(ephemeris(date), date, local ? { lat: pl.lat, lon: pl.lon, elev: pl.elev || 0 } : null).find((x) => x.name === n); dir = b && [b.nx, b.ny, b.nz]; } catch { dir = null; }
      if (!dir) continue;
      const q = proj.project(dir); if (q[2] <= 0) continue;
      ctx.beginPath(); ctx.arc(q[0], q[1], 17, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  if (issLay) {
    drawIssTrack(ctx, issLay);
    for (const m of issLay.marks) report.lines.push({ text: m.text, x: m.box.x, w: m.box.w, right: m.box.x + m.box.w, y: m.box.y + 6, size: 26, role: "sky-label" });
    report.issPoints = issLay.P.length;
  }

  const line = (ln, x, y, size, role) => { const w = ctx.measureText(ln).width; report.lines.push({ text: ln, x, w, right: x + w, y, size, role }); return w; };
  if (hero) {
    const x = Math.round(CX - heroDims.w / 2), y = Math.round(heroTop), w = heroDims.w, h = heroDims.h;
    if (hero.kind === "model" || hero.frame === false) hero.draw(ctx, x, y, w, h);
    else {
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.75)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
      roundRect(ctx, x, y, w, h, 28); ctx.fillStyle = "#05080f"; ctx.fill(); ctx.restore();
      ctx.save(); roundRect(ctx, x, y, w, h, 28); ctx.clip(); hero.draw(ctx, x, y, w, h); ctx.restore();
      roundRect(ctx, x, y, w, h, 28); ctx.strokeStyle = "rgba(201,184,255,0.55)"; ctx.lineWidth = 2.5; ctx.stroke();
    }
    report.hero = hero.kind; report.heroLabel = hero.label; report.heroSource = hero.source; report.heroBox = { x, y, w, h };
    ctx.font = F.cap(cap.size); ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = "rgba(226,230,246,0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 8;
    let yy = capTop;
    for (const ln of cap.lines) { const lw = ctx.measureText(ln).width; ctx.fillText(ln, CX - lw / 2, yy); line(ln, CX - lw / 2, yy, cap.size, "caption"); yy += Math.round(cap.size * 1.3); }
    ctx.shadowBlur = 0;
    if (reticle) {
      ctx.save(); ctx.strokeStyle = "rgba(242,198,109,0.8)"; ctx.lineWidth = 2; ctx.setLineDash([7, 8]);
      ctx.beginPath(); ctx.moveTo(CX, yy + 6); ctx.lineTo(CX, retY - 50); ctx.stroke(); ctx.restore();
      drawReticle(ctx, CX, retY);
    }
  } else if (reticle) drawReticle(ctx, CX, retY);
  if (!hero && skyHero) { report.hero = "sky"; report.heroLabel = capLabel || ""; report.heroSource = "simulation"; }

  // 3 · cabecera de marca (igual que la postal)
  const topVeil = ctx.createLinearGradient(0, 0, 0, SAFE_TOP + 30);
  topVeil.addColorStop(0, "rgba(4,7,14,0.9)"); topVeil.addColorStop(0.75, "rgba(4,7,14,0.55)"); topVeil.addColorStop(1, "rgba(4,7,14,0)");
  ctx.fillStyle = topVeil; ctx.fillRect(0, 0, W, SAFE_TOP + 30);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  {
    ctx.save();
    ctx.font = F.head(32);
    try { ctx.letterSpacing = "12px"; } catch { /* sin letterSpacing */ }
    const hw = ctx.measureText(T.pcHead).width, hx = CX - hw / 2 + 6, hy = 118;
    ctx.fillStyle = "#e6deff"; ctx.fillText(T.pcHead, hx, hy);
    report.lines.push({ text: T.pcHead, x: hx, w: hw, right: hx + hw, y: hy, size: 32, role: "header" });
    ctx.restore();
    ctx.fillStyle = "rgba(242,198,109,0.75)"; ctx.fillRect(hx - 92, hy + 17, 64, 2); ctx.fillRect(hx + hw + 22, hy + 17, 64, 2);
    ctx.font = F.headSub(headSub.size);
    const sw = ctx.measureText(headSub.lines[0]).width, sx = CX - sw / 2, sy = hy + 50;
    drawHighlighted(ctx, headSub.lines[0], sx, sy, "rgba(226,230,246,0.88)", "#f2c66d");
    report.lines.push({ text: headSub.lines[0], x: sx, w: sw, right: sx + sw, y: sy, size: headSub.size, role: "header" });
  }

  // 4 · bloque de texto sobre el velo
  const veilTop = blockTop - 170;
  const veil = ctx.createLinearGradient(0, veilTop, 0, H);
  veil.addColorStop(0, "rgba(4,7,14,0)"); veil.addColorStop(0.16, "rgba(4,7,14,0.86)"); veil.addColorStop(1, "rgba(4,7,14,0.97)");
  ctx.fillStyle = veil; ctx.fillRect(0, veilTop, W, H - veilTop);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  let y = blockTop;
  const put = (f, font, color, x, k, role) => {
    ctx.font = font(f.size); ctx.fillStyle = color;
    for (const ln of f.lines) { ctx.fillText(ln, x, y); line(ln, x, y, f.size, role); y += Math.round(f.size * k); }
  };
  if (!hero && skyHero && cap) {
    // rótulo del cielo protagonista, encima del título
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 6;
    put(cap, F.cap, "rgba(226,230,246,0.9)", PAD, 1.3, "caption"); ctx.restore(); y += 18;
  }
  put(L.title, F.title, "#ffffff", PAD, 1.02, "title"); y += 10;
  put(L.type, F.type, "#cfc4ff", PAD, 1.3, "type");
  if (L.grid.cells.length) {
    y += 22;
    const gy = y;
    for (const c of L.grid.cells) {
      const x0 = c.x, y0 = gy + c.y, loc = c.kind === "local";
      roundRect(ctx, x0, y0, c.w, c.h, 22); ctx.fillStyle = loc ? "rgba(12,24,48,0.82)" : "rgba(18,20,46,0.82)"; ctx.fill();
      ctx.strokeStyle = loc ? "rgba(125,180,255,0.5)" : "rgba(167,139,250,0.42)"; ctx.lineWidth = 2; ctx.stroke();
      const tx = x0 + GRID.padX, limit = x0 + c.w - GRID.padX + 1;
      let yy = y0 + GRID.padY;
      const cellPut = (f, role, color, k) => {
        ctx.font = GRID_FONTS[role](f.size); ctx.fillStyle = color;
        for (const ln of f.lines) { ctx.fillText(ln, tx, yy); const w = line(ln, tx, yy, f.size, "grid-" + role); if (tx + w > limit) report.gridOverflow = true; yy += Math.round(f.size * k); }
      };
      cellPut(c.label, "label", loc ? "#a9cdff" : "#c9b8ff", 1.22); yy += 4;
      cellPut(c.value, "value", "#ffffff", 1.08);
      if (c.sub) { yy += 4; cellPut(c.sub, "sub", "rgba(226,230,246,0.82)", 1.22); }
      if (yy > y0 + c.h - GRID.padY + 2) report.gridOverflow = true;
      const txt2 = (f) => (f && f.lines ? f.lines.join(" ") : f || null);
      report.grid.push({ label: txt2(c.label), value: txt2(c.value), sub: txt2(c.sub), kind: c.kind, x: x0, y: y0, w: c.w, h: c.h });
    }
    y = gy + L.grid.height;
  }
  for (const f of L.facts) {
    y += 22;
    ctx.fillStyle = "#f2c66d"; ctx.beginPath(); ctx.arc(PAD + 9, y + f.size * 0.62, 6, 0, TAU); ctx.fill();
    put(f, F.fact, "rgba(240,242,252,0.96)", PAD + 34, 1.32, "fact");
  }
  if (L.where) {
    y += 16;
    ctx.strokeStyle = "#7db4ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(PAD + 9, y + L.where.size * 0.62, 6, 0, TAU); ctx.stroke();
    put(L.where, F.fact, "#a9cdff", PAD + 34, 1.3, "local");
  }
  report.blockTop = blockTop; report.blockBottom = y;

  // 5 · pie de marca
  y = H - SAFE_BOTTOM + 16;
  const sep = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  sep.addColorStop(0, "rgba(167,139,250,0)"); sep.addColorStop(0.5, "rgba(242,198,109,0.7)"); sep.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = sep; ctx.fillRect(PAD, y, MAXW, 2); y += 24;
  const center2 = (f, font, role, k, draw) => {
    ctx.font = font(f.size);
    for (const ln of f.lines) { const w = ctx.measureText(ln).width, x = CX - w / 2; draw(ln, x, y); line(ln, x, y, f.size, role); y += Math.round(f.size * k); }
  };
  center2(url, F.url, "url", 1.2, (ln, x, yy) => { ctx.fillStyle = "#ffffff"; ctx.fillText(ln, x, yy); }); y += 12;
  center2(coop, F.coop, "coop", 1.25, (ln, x, yy) => drawHighlighted(ctx, ln, x, yy, "#e6deff", "#f2c66d")); y += 12;
  center2(creditL, F.small, "credit", 1.3, (ln, x, yy) => { ctx.fillStyle = "rgba(226,230,246,0.78)"; ctx.fillText(ln, x, yy); });
  report.bottom = y;
  if (y > H - 24) report.overflow = true;
  for (const l of report.lines) if (l.role !== "sky-label" && (l.x < PAD - 1 || l.right > W - PAD + 1)) report.overflow = true;
  if (report.gridOverflow) report.overflow = true;
  const brandRoles = new Set(["header", "url", "coop", "credit", "sky-label"]);
  for (const l of report.lines) if (!brandRoles.has(l.role) && (l.y < SAFE_TOP || l.y + l.size > H - SAFE_BOTTOM)) report.safeZoneOk = false;
  report.gridCells = L.grid.cells.length;
  report.minText = Math.min(...report.lines.filter((l) => l.role !== "credit" && l.role !== "caption").map((l) => l.size));
  report.title = txt.title;
  return { canvas, report };
}
