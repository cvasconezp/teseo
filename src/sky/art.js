// art.js — representaciones esquemáticas dibujadas en <canvas>, una por tipo de
// objeto. Se usan cuando no hay una imagen real (y en la postal). NO son retratos:
// la interfaz las rotula siempre como "representación". Dibujo determinista: la
// misma semilla produce siempre el mismo dibujo.
//
// Todas las funciones dibujan dentro de la caja (x, y, w, h) del contexto recibido.
import { exoLook, hubbleFamily } from "./explain.js";

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export const seedOf = (str) => String(str || "").split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
const TAU = Math.PI * 2;

/** ¿Nave tipo telescopio o tipo sonda? Solo decide qué silueta se dibuja. */
export function craftKind(name) {
  return /telescop|webb|jwst|hubble|hst|gaia|euclid|kepler|tess|chandra|spitzer|observator|xmm|soho|herschel|planck/i.test(name || "") ? "telescope" : "probe";
}
/** Tipo de dibujo para un objeto de Teseo. */
export function artKind(obj) {
  const L = obj.layer;
  if (L === "probes") return craftKind(obj.name);
  if (L === "comets") return "comet";
  if (L === "meteors") return "meteor";
  if (L === "pulsars") return "pulsar";
  if (L === "blackholes") return "blackhole";
  if (L === "galaxies") return "galaxy";
  if (L === "exoplanets") return "exoplanet";
  if (L === "star") return "star";
  if (L === "messier") return obj.type === "galaxy" ? "galaxy" : obj.type === "globular" ? "globular" : obj.type === "open" || obj.type === "cluster" ? "open" : obj.type === "snr" ? "snr" : "nebula";
  return "nebula";
}

function stars(ctx, r, x, y, w, h, n, alpha = 0.7) {
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, s = 0.5 + r() * r() * 1.6;
    ctx.fillStyle = `rgba(${220 + Math.round(r() * 35)},${225 + Math.round(r() * 30)},255,${(0.25 + r() * alpha).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(px, py, s * Math.max(1, w / 420), 0, TAU); ctx.fill();
  }
}
function glow(ctx, cx, cy, r0, r1, c0, c1 = "rgba(0,0,0,0)") {
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r1, 0, TAU); ctx.fill();
}

// ── naves ────────────────────────────────────────────────────────────────
function probe(ctx, cx, cy, u) {
  // sonda de espacio profundo: gran antena parabólica, cuerpo, brazo del magnetómetro y generador
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.42);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const line = "#dfe6ff", body = "#8a94b8", dark = "#2a3150";
  // brazo largo (magnetómetro) y brazo del generador
  ctx.strokeStyle = line; ctx.lineWidth = u * 0.035;
  ctx.beginPath(); ctx.moveTo(0, u * 0.1); ctx.lineTo(-u * 1.55, u * 0.42); ctx.stroke();
  ctx.setLineDash([u * 0.05, u * 0.05]); ctx.lineWidth = u * 0.02;
  ctx.beginPath(); ctx.moveTo(0, u * 0.13); ctx.lineTo(-u * 1.55, u * 0.45); ctx.stroke(); ctx.setLineDash([]);
  ctx.lineWidth = u * 0.045;
  ctx.beginPath(); ctx.moveTo(u * 0.1, u * 0.18); ctx.lineTo(u * 0.95, u * 0.62); ctx.stroke();
  ctx.fillStyle = body; ctx.strokeStyle = line; ctx.lineWidth = u * 0.03;
  ctx.beginPath(); ctx.roundRect(u * 0.78, u * 0.5, u * 0.5, u * 0.2, u * 0.05); ctx.fill(); ctx.stroke();
  // cuerpo decagonal
  ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(-u * 0.34, u * 0.02, u * 0.68, u * 0.3, u * 0.05); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#f2c66d"; ctx.beginPath(); ctx.arc(-u * 0.12, u * 0.17, u * 0.07, 0, TAU); ctx.fill();   // disco dorado
  // antena parabólica vista de lado y su alimentador
  const g = ctx.createLinearGradient(0, -u * 0.75, 0, u * 0.05);
  g.addColorStop(0, "#f4f6ff"); g.addColorStop(1, "#9aa6cf");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-u * 0.8, -u * 0.38); ctx.quadraticCurveTo(0, u * 0.42, u * 0.8, -u * 0.38); ctx.quadraticCurveTo(0, -u * 0.12, -u * 0.8, -u * 0.38); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = u * 0.025;
  ctx.beginPath(); ctx.moveTo(-u * 0.5, -u * 0.26); ctx.lineTo(0, -u * 0.86); ctx.lineTo(u * 0.5, -u * 0.26); ctx.stroke();
  ctx.fillStyle = line; ctx.beginPath(); ctx.arc(0, -u * 0.86, u * 0.06, 0, TAU); ctx.fill();
  // cámaras en su plataforma
  ctx.lineWidth = u * 0.035; ctx.beginPath(); ctx.moveTo(u * 0.3, u * 0.1); ctx.lineTo(u * 0.75, -u * 0.05); ctx.stroke();
  ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(u * 0.68, -u * 0.2, u * 0.26, u * 0.22, u * 0.04); ctx.fill(); ctx.stroke();
  ctx.restore();
  // ondas de radio hacia la Tierra
  ctx.strokeStyle = "rgba(125,180,255,0.55)"; ctx.lineWidth = u * 0.025;
  for (let i = 1; i <= 3; i++) { ctx.globalAlpha = 1 - i * 0.25; ctx.beginPath(); ctx.arc(cx - u * 0.35, cy - u * 0.8, u * (0.25 + i * 0.22), -Math.PI * 0.86, -Math.PI * 0.52); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function telescope(ctx, cx, cy, u) {
  // telescopio espacial: tubo con tapa abierta, espejo, dos paneles solares y antena
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.5);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const line = "#dfe6ff";
  ctx.strokeStyle = line; ctx.lineWidth = u * 0.03;
  // paneles solares
  const panel = (sx) => {
    ctx.save(); ctx.translate(sx * u * 0.48, u * 0.1);
    const g = ctx.createLinearGradient(0, -u * 0.5, 0, u * 0.5); g.addColorStop(0, "#35509c"); g.addColorStop(1, "#1a2a5c");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(sx > 0 ? u * 0.1 : -u * 0.62, -u * 0.5, u * 0.52, u * 1.0, u * 0.03); ctx.fill(); ctx.stroke();
    ctx.lineWidth = u * 0.012; ctx.strokeStyle = "rgba(223,230,255,0.45)";
    for (let i = 1; i < 5; i++) { const yy = -u * 0.5 + i * u * 0.2; ctx.beginPath(); ctx.moveTo(sx > 0 ? u * 0.1 : -u * 0.62, yy); ctx.lineTo(sx > 0 ? u * 0.62 : -u * 0.1, yy); ctx.stroke(); }
    ctx.restore(); ctx.strokeStyle = line; ctx.lineWidth = u * 0.03;
    ctx.beginPath(); ctx.moveTo(sx * u * 0.34, u * 0.1); ctx.lineTo(sx * u * 0.58, u * 0.1); ctx.stroke();
  };
  panel(-1); panel(1);
  // tubo
  const g = ctx.createLinearGradient(-u * 0.36, 0, u * 0.36, 0);
  g.addColorStop(0, "#7d88ad"); g.addColorStop(0.45, "#eef1ff"); g.addColorStop(1, "#6a7499");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-u * 0.36, -u * 0.8, u * 0.72, u * 1.6, u * 0.06); ctx.fill(); ctx.stroke();
  ctx.lineWidth = u * 0.02;
  for (const yy of [-0.35, 0.2, 0.55]) { ctx.beginPath(); ctx.moveTo(-u * 0.36, yy * u); ctx.lineTo(u * 0.36, yy * u); ctx.stroke(); }
  // boca del tubo y espejo
  ctx.fillStyle = "#0a1026"; ctx.beginPath(); ctx.ellipse(0, -u * 0.8, u * 0.36, u * 0.11, 0, 0, TAU); ctx.fill(); ctx.lineWidth = u * 0.03; ctx.stroke();
  ctx.fillStyle = "#f2c66d"; ctx.beginPath(); ctx.ellipse(0, -u * 0.78, u * 0.2, u * 0.05, 0, 0, TAU); ctx.fill();
  // tapa abierta
  ctx.fillStyle = "#aab3d6"; ctx.beginPath(); ctx.moveTo(u * 0.36, -u * 0.8); ctx.lineTo(u * 0.8, -u * 1.15); ctx.lineTo(u * 0.5, -u * 1.25); ctx.lineTo(u * 0.2, -u * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke();
  // antena
  ctx.beginPath(); ctx.moveTo(0, u * 0.8); ctx.lineTo(0, u * 1.02); ctx.stroke();
  ctx.fillStyle = "#eef1ff"; ctx.beginPath(); ctx.ellipse(0, u * 1.08, u * 0.16, u * 0.06, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  // haz de luz que entra
  const lg = ctx.createLinearGradient(cx + u * 0.5, cy - u * 0.75, cx + u * 1.3, cy - u * 2.0);
  lg.addColorStop(0, "rgba(242,198,109,0.4)"); lg.addColorStop(1, "rgba(242,198,109,0)");
  ctx.strokeStyle = lg; ctx.lineWidth = u * 0.05;
  for (const d of [-0.13, 0, 0.13]) { ctx.beginPath(); ctx.moveTo(cx + u * (0.42 + d), cy - u * (0.72 - d * 0.5)); ctx.lineTo(cx + u * (1.2 + d), cy - u * (2.0 - d * 0.5)); ctx.stroke(); }
}

// ── cometa: coma, cola de polvo (curva, amarillenta) y cola de iones (recta, azul) ──
function comet(ctx, cx, cy, u) {
  const hx = cx - u * 0.75, hy = cy + u * 0.55;                    // cabeza
  ctx.save();
  // cola de iones: recta, opuesta al Sol
  const ion = ctx.createLinearGradient(hx, hy, hx + u * 2.3, hy - u * 1.55);
  ion.addColorStop(0, "rgba(140,210,255,0.75)"); ion.addColorStop(1, "rgba(140,210,255,0)");
  ctx.fillStyle = ion;
  ctx.beginPath(); ctx.moveTo(hx, hy - u * 0.07); ctx.lineTo(hx + u * 2.35, hy - u * 1.68); ctx.lineTo(hx + u * 2.45, hy - u * 1.48); ctx.lineTo(hx + u * 0.05, hy + u * 0.07); ctx.closePath(); ctx.fill();
  // cola de polvo: ancha y curvada
  const dust = ctx.createLinearGradient(hx, hy, hx + u * 2.1, hy - u * 0.5);
  dust.addColorStop(0, "rgba(255,236,190,0.8)"); dust.addColorStop(1, "rgba(255,236,190,0)");
  ctx.fillStyle = dust;
  ctx.beginPath(); ctx.moveTo(hx - u * 0.04, hy - u * 0.14);
  ctx.bezierCurveTo(hx + u * 0.8, hy - u * 0.75, hx + u * 1.7, hy - u * 0.95, hx + u * 2.45, hy - u * 0.75);
  ctx.bezierCurveTo(hx + u * 1.9, hy - u * 0.45, hx + u * 1.0, hy - u * 0.05, hx + u * 0.06, hy + u * 0.14);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  glow(ctx, hx, hy, 0, u * 0.5, "rgba(190,255,225,0.55)");
  glow(ctx, hx, hy, 0, u * 0.2, "rgba(255,255,255,1)", "rgba(220,255,240,0)");
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hx, hy, u * 0.05, 0, TAU); ctx.fill();
}

// ── lluvia de meteoros: trazos que divergen de un mismo punto (el radiante) ──
function meteor(ctx, cx, cy, u, r) {
  const rx = cx - u * 0.1, ry = cy - u * 0.25;
  ctx.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + r() * 0.35, d0 = u * (0.35 + r() * 0.35), len = u * (0.45 + r() * 0.7);
    const x0 = rx + Math.cos(a) * d0, y0 = ry + Math.sin(a) * d0, x1 = rx + Math.cos(a) * (d0 + len), y1 = ry + Math.sin(a) * (d0 + len);
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.85, "rgba(255,226,160,0.9)"); g.addColorStop(1, "rgba(255,255,255,1)");
    ctx.strokeStyle = g; ctx.lineWidth = u * (0.02 + r() * 0.03);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // el radiante: un punto de referencia, no un objeto
  ctx.strokeStyle = "rgba(242,198,109,0.9)"; ctx.lineWidth = u * 0.025; ctx.setLineDash([u * 0.06, u * 0.06]);
  ctx.beginPath(); ctx.arc(rx, ry, u * 0.2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#f2c66d"; ctx.beginPath(); ctx.arc(rx, ry, u * 0.04, 0, TAU); ctx.fill();
}

// ── cielo profundo ───────────────────────────────────────────────────────
function nebula(ctx, cx, cy, u, r) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const cols = ["rgba(255,110,150,", "rgba(120,160,255,", "rgba(103,232,200,", "rgba(190,120,255,"];
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU, d = r() * u * 0.75, rr = u * (0.35 + r() * 0.6);
    glow(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 0, rr, cols[i % cols.length] + (0.08 + r() * 0.1).toFixed(2) + ")");
  }
  ctx.restore();
  for (let i = 0; i < 5; i++) { const a = r() * TAU, d = r() * u * 0.4; glow(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0, u * 0.09, "rgba(255,255,255,0.95)"); }
}
function cluster(ctx, cx, cy, u, r, dense) {
  const n = dense ? 520 : 46;
  if (dense) glow(ctx, cx, cy, 0, u * 1.1, "rgba(255,236,190,0.28)");
  for (let i = 0; i < n; i++) {
    // globular: densidad que cae desde el centro; abierto: grupo suelto
    const a = r() * TAU, d = dense ? u * 1.25 * Math.pow(r(), 2.2) : u * 1.1 * Math.sqrt(r());
    const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * (dense ? 1 : 0.8);
    const big = !dense && i < 9, s = big ? u * (0.05 + r() * 0.04) : u * (0.008 + r() * 0.018);
    const col = dense ? (r() > 0.25 ? "255,240,205" : "255,200,150") : (r() > 0.4 ? "190,215,255" : "255,255,255");
    if (big) glow(ctx, px, py, 0, s * 4.5, `rgba(${col},0.35)`);
    ctx.fillStyle = `rgba(${col},${(0.55 + r() * 0.45).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill();
  }
}
function snr(ctx, cx, cy, u, r) {
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    const a = r() * TAU, rr = u * (0.75 + r() * 0.3), len = 0.25 + r() * 0.5;
    ctx.strokeStyle = `rgba(${i % 3 === 0 ? "120,200,255" : i % 3 === 1 ? "255,140,120" : "255,220,160"},${(0.12 + r() * 0.3).toFixed(2)})`;
    ctx.lineWidth = u * (0.015 + r() * 0.04);
    ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * (0.78 + r() * 0.2), r() * 0.5, a, a + len); ctx.stroke();
  }
  ctx.restore();
  glow(ctx, cx, cy, 0, u * 0.12, "rgba(255,255,255,0.9)");
}
function galaxy(ctx, cx, cy, u, r, family) {
  ctx.save(); ctx.translate(cx, cy);
  if (family === "E" || family === "S0") {
    // elíptica / lenticular: un óvalo liso de estrellas viejas
    ctx.rotate(-0.4); ctx.scale(1, family === "S0" ? 0.42 : 0.72);
    glow(ctx, 0, 0, 0, u * 1.25, "rgba(255,236,200,0.5)");
    glow(ctx, 0, 0, 0, u * 0.6, "rgba(255,244,220,0.85)");
    glow(ctx, 0, 0, 0, u * 0.16, "rgba(255,255,255,1)");
  } else if (family === "I") {
    for (let i = 0; i < 9; i++) glow(ctx, (r() - 0.5) * u * 1.4, (r() - 0.5) * u * 0.9, 0, u * (0.25 + r() * 0.4), `rgba(${r() > 0.5 ? "150,185,255" : "255,170,200"},0.3)`);
  } else {
    // espiral vista inclinada: dos brazos (y barra si es barrada)
    ctx.rotate(-0.35); ctx.scale(1, 0.5);
    glow(ctx, 0, 0, 0, u * 1.35, "rgba(150,180,255,0.22)");
    ctx.globalCompositeOperation = "lighter";
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 150; i++) {
        const t = i / 150, a = arm * Math.PI + t * 4.4, d = u * (0.2 + t * 1.05);
        const px = Math.cos(a) * d + (r() - 0.5) * u * 0.16, py = Math.sin(a) * d + (r() - 0.5) * u * 0.16;
        glow(ctx, px, py, 0, u * (0.1 + r() * 0.1) * (1 - t * 0.4), `rgba(${i % 7 === 0 ? "255,150,190" : "160,195,255"},${(0.2 * (1 - t * 0.6)).toFixed(2)})`);
      }
    }
    ctx.globalCompositeOperation = "source-over";
    if (family === "SB" || family === "SAB") { ctx.save(); ctx.scale(1, 0.34); glow(ctx, 0, 0, 0, u * 0.5, "rgba(255,236,200,0.8)"); ctx.restore(); }
    glow(ctx, 0, 0, 0, u * 0.3, "rgba(255,240,210,0.9)");
    glow(ctx, 0, 0, 0, u * 0.1, "rgba(255,255,255,1)");
  }
  ctx.restore();
}
function blackhole(ctx, cx, cy, u) {
  // sombra + anillo de fotones + disco de acreción inclinado (esquema, no una imagen)
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.22);
  const disc = (front) => {
    ctx.save(); ctx.beginPath(); ctx.rect(-u * 2, front ? 0 : -u * 2, u * 4, u * 2); ctx.clip();
    ctx.scale(1, 0.3);
    for (const [rr, w, a] of [[1.25, 0.34, 0.35], [1.0, 0.26, 0.7], [0.8, 0.16, 0.95]]) {
      const g = ctx.createLinearGradient(-u * rr, 0, u * rr, 0);
      g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(0.5, `rgba(255,150,60,${a * 0.85})`); g.addColorStop(1, `rgba(200,80,30,${a * 0.6})`);
      ctx.strokeStyle = g; ctx.lineWidth = u * w;
      ctx.beginPath(); ctx.arc(0, 0, u * rr, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  };
  disc(false);
  glow(ctx, 0, 0, u * 0.42, u * 0.75, "rgba(255,170,80,0.55)");
  ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(0, 0, u * 0.46, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(255,205,140,0.95)"; ctx.lineWidth = u * 0.045; ctx.beginPath(); ctx.arc(0, 0, u * 0.48, 0, TAU); ctx.stroke();
  disc(true);
  ctx.restore();
}
function pulsar(ctx, cx, cy, u) {
  ctx.save(); ctx.translate(cx, cy);
  // líneas del campo magnético
  ctx.strokeStyle = "rgba(169,198,255,0.4)"; ctx.lineWidth = u * 0.02;
  ctx.save(); ctx.rotate(0.55);
  for (const k of [0.5, 0.8, 1.15]) for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * u * k * 0.5, 0, u * k * 0.5, u * k * 0.34, 0, 0, TAU); ctx.stroke(); }
  // haces por los polos magnéticos
  for (const s of [-1, 1]) {
    const g = ctx.createLinearGradient(0, 0, 0, s * u * 1.5);
    g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(1, "rgba(150,190,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-u * 0.03, 0); ctx.lineTo(-u * 0.2, s * u * 1.5); ctx.lineTo(u * 0.2, s * u * 1.5); ctx.lineTo(u * 0.03, 0); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // eje de giro
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.setLineDash([u * 0.06, u * 0.07]); ctx.beginPath(); ctx.moveTo(0, -u * 1.35); ctx.lineTo(0, u * 1.35); ctx.stroke(); ctx.setLineDash([]);
  glow(ctx, 0, 0, 0, u * 0.42, "rgba(159,192,255,0.55)");
  const g = ctx.createRadialGradient(-u * 0.05, -u * 0.05, 0, 0, 0, u * 0.2);
  g.addColorStop(0, "#fff"); g.addColorStop(0.6, "#b9d0ff"); g.addColorStop(1, "#5c7fe0");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, u * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
}
function star(ctx, cx, cy, u, hex) {
  const c = hex || "#ffffff";
  const n = parseInt(c.slice(1), 16), rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  glow(ctx, cx, cy, 0, u * 1.5, `rgba(${rgb},0.3)`);
  glow(ctx, cx, cy, 0, u * 0.85, `rgba(${rgb},0.5)`);
  // destellos de difracción (los crea el telescopio, no la estrella: son parte de la convención del dibujo)
  ctx.save(); ctx.translate(cx, cy);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    const g = ctx.createLinearGradient(0, 0, u * 1.5, 0); g.addColorStop(0, `rgba(${rgb},0.7)`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -u * 0.035); ctx.lineTo(u * 1.5, 0); ctx.lineTo(0, u * 0.035); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const g = ctx.createRadialGradient(cx - u * 0.1, cy - u * 0.1, 0, cx, cy, u * 0.5);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.55, c); g.addColorStop(1, `rgba(${rgb},0.85)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, u * 0.5, 0, TAU); ctx.fill();
}
function exoplanet(ctx, cx, cy, u, obj) {
  const look = exoLook(obj.rade, obj.eqt_k), R = u * 0.8;
  if (look.glow) glow(ctx, cx, cy, R * 0.8, R * 1.5, look.base + "88");
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
  g.addColorStop(0, look.light); g.addColorStop(0.5, look.base); g.addColorStop(1, look.dark);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  if (look.banded) {
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? "#000" : "#fff"; ctx.fillRect(cx - R, cy - R + (i / 9) * R * 2 + Math.sin(i * 2.1) * R * 0.03, R * 2, R * 0.12); }
    ctx.globalAlpha = 1;
  }
  const sh = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.3, cx, cy, R * 1.05);
  sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();
  // contorno a trazos: recuerda que es una representación
  ctx.strokeStyle = "rgba(242,198,109,0.8)"; ctx.lineWidth = Math.max(1, u * 0.02); ctx.setLineDash([u * 0.07, u * 0.07]);
  ctx.beginPath(); ctx.arc(cx, cy, R + u * 0.1, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
}

/**
 * Dibuja la representación de `kind` en la caja (x, y, w, h).
 * @param {object} o  { seed, hex (estrella), hubble (galaxia), obj (exoplaneta), bg = true }
 */
export function drawArt(ctx, kind, x, y, w, h, o = {}) {
  const r = rng(o.seed || seedOf(kind));
  const cx = x + w / 2, cy = y + h / 2, u = Math.min(w, h) / (kind === "probe" || kind === "telescope" ? 4.1 : kind === "comet" ? 3.6 : kind === "nebula" || kind === "galaxy" ? 2.3 : 3.3);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (o.bg !== false) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
    g.addColorStop(0, "#111a36"); g.addColorStop(1, "#05080f");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    stars(ctx, r, x, y, w, h, Math.round(w * h / 2600));
  }
  if (kind === "probe") probe(ctx, cx + u * 0.1, cy + u * 0.15, u);
  else if (kind === "telescope") telescope(ctx, cx - u * 0.15, cy + u * 0.2, u);
  else if (kind === "comet") comet(ctx, cx, cy, u);
  else if (kind === "meteor") meteor(ctx, cx, cy, u, r);
  else if (kind === "globular") cluster(ctx, cx, cy, u, r, true);
  else if (kind === "open") cluster(ctx, cx, cy, u, r, false);
  else if (kind === "snr") snr(ctx, cx, cy, u, r);
  else if (kind === "galaxy") galaxy(ctx, cx, cy, u, r, o.hubble ? hubbleFamily(o.hubble) : "S");
  else if (kind === "blackhole") blackhole(ctx, cx, cy, u);
  else if (kind === "pulsar") pulsar(ctx, cx, cy, u);
  else if (kind === "star") star(ctx, cx, cy, u, o.hex);
  else if (kind === "exoplanet") exoplanet(ctx, cx, cy, u, o.obj || {});
  else nebula(ctx, cx, cy, u, r);
  ctx.restore();
}

/** Opciones de dibujo para un objeto de Teseo. */
export function artOptions(obj) {
  return { seed: seedOf(obj.name), hex: obj.hex, hubble: obj.hubble || (obj.layer === "messier" && obj.type === "galaxy" ? "S" : null), obj };
}

// ── esfera con textura real (Sol, Luna, planetas) para la postal ──────────
/**
 * Proyección ortográfica de una textura equirectangular sobre un disco.
 * `tex` = { data, width, height } (ImageData de la textura), `lon0` = longitud central (rad),
 * `tilt` = inclinación del eje (rad). Para la Luna, `phase` = { illum, waxing }.
 */
export function drawSphere(ctx, tex, cx, cy, R, { lon0 = 0, tilt = 0, phase = null, sun = false } = {}) {
  const D = Math.ceil(R * 2), img = ctx.createImageData(D, D), out = img.data;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const { data, width: W, height: H } = tex;
  const k = phase && phase.illum != null ? Math.max(0, Math.min(1, phase.illum)) : null;
  for (let j = 0; j < D; j++) {
    const yy = (R - j - 0.5) / R;
    for (let i = 0; i < D; i++) {
      const xx = (i + 0.5 - R) / R, d2 = xx * xx + yy * yy;
      if (d2 > 1) continue;
      const zz = Math.sqrt(1 - d2);
      // girar el punto al sistema del cuerpo (eje inclinado en el plano de la pantalla)
      const xb = xx * ct + yy * st, yb = -xx * st + yy * ct;
      const lat = Math.asin(yb), lon = Math.atan2(xb, zz) + lon0;
      let u = (lon / TAU + 0.5) % 1; if (u < 0) u += 1;
      const tx = Math.min(W - 1, Math.floor(u * W)), ty = Math.min(H - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * H)));
      const p = (ty * W + tx) * 4, q = (j * D + i) * 4;
      let sh = sun ? 0.82 + 0.18 * zz : 0.35 + 0.65 * Math.pow(zz, 0.55);          // limbo más oscuro
      if (k != null) {
        // fase: terminador = semielipse de semieje (1 − 2k); el lado iluminado depende de si crece
        const w = Math.sqrt(Math.max(0, 1 - yy * yy)), xt = w * (1 - 2 * k);
        const lit = phase.waxing ? xx > xt : xx < -xt;
        if (!lit) sh *= 0.13;
      }
      // borde suavizado
      const edge = Math.min(1, (1 - Math.sqrt(d2)) * R);
      out[q] = data[p] * sh; out[q + 1] = data[p + 1] * sh; out[q + 2] = data[p + 2] * sh; out[q + 3] = 255 * edge;
    }
  }
  const tmp = document.createElement("canvas"); tmp.width = tmp.height = D;
  tmp.getContext("2d").putImageData(img, 0, 0);
  ctx.drawImage(tmp, cx - R, cy - R);
}
