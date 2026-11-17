// viewSnapshot.js — la postal «tal como lo ves»: una copia de la vista del Cielo en este instante, con todas las
// capas activas (atmósfera, nubes, montañas, líneas, guías…), más los nombres que en pantalla son HTML (estrellas,
// constelaciones, puntos cardinales, montañas), dibujados encima en 2D con los mismos colores.
//
//   snapshotView({ renderer, scene, camera, labels, colors, cssW, cssH }) → <canvas> (o null si no se puede)
//
// El lienzo WebGL no guarda su contenido (sin preserveDrawingBuffer, que costaría rendimiento): se vuelve a
// pintar justo antes de copiarlo, en la misma tarea, y así la copia nunca sale negra.
//
// drawViewCover(ctx, view, { W, H, top, bottom }) coloca la vista en la postal (9:16): llena el ancho; si la
// vista es apaisada (ordenador), se escala para que ocupe al menos la mitad del alto y se recortan los lados,
// y el cielo de arriba y el suelo de abajo se prolongan con la primera y la última fila de la propia imagen.

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Estilo de cada clase de nombre (como en sky.css / atmosphere.css). */
export function labelStyle(cls) {
  if (cls === "con") return { font: `400 13px ${SERIF}`, upper: true, spacing: 0.14, alpha: 0.88, center: false };
  if (cls === "solar") return { font: `600 15px ${SERIF}`, alpha: 1 };
  if (cls === "card") return { font: `600 13px ${SANS}`, alpha: 1, center: true };
  if (cls === "cardn") return { font: `700 16px ${SANS}`, alpha: 1, center: true };
  if (cls === "peak") return { font: `600 12.5px ${SANS}`, alpha: 1, peak: true };
  if (cls === "iss" || cls === "iss_t") return { font: `700 14px ${SANS}`, alpha: 1 };
  if (String(cls).startsWith("guide_")) return { font: `400 11.5px ${SANS}`, alpha: 0.9 };
  return { font: `400 13px ${SERIF}`, alpha: 1 };
}

function spaced(ctx, text, x, y, em) {
  // letter-spacing a mano (el lienzo 2D no lo tiene en todos los navegadores)
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + em; }
  return cx - x;
}

/** Dibuja los nombres de la vista (lista de la vista del Cielo: { name, cls, x, y, dx, flip, subText }). */
export function drawLabels(ctx, labels, colors, k = 1, f = k) {
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 5 * f; ctx.shadowOffsetY = 1 * f;
  for (const l of labels || []) {
    if (!l || !l.name || l.cls === "note") continue;
    const st = labelStyle(l.cls), color = (colors && colors[l.cls]) || "#ffffff";
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.globalAlpha = st.alpha;
    const x = l.x * k, y = l.y * k;          // posición: escala de la pantalla; tamaños: f (legibles en la postal)
    if (st.peak) {
      // palito hasta la cumbre, el nombre encima y la altura debajo del nombre
      ctx.lineWidth = Math.max(1, f); ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.moveTo(x, y - 1 * f); ctx.lineTo(x, y - 13 * f); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2 * f, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.textAlign = "center";
      const hasSub = l.subText != null;
      ctx.font = st.font.replace(/([\d.]+)px/, (_, n) => `${n * f}px`);
      ctx.fillText(l.name, x, y - (hasSub ? 34 : 22) * f);
      if (hasSub) {
        ctx.globalAlpha = 0.8; ctx.font = `400 ${10.5 * f}px ${SANS}`;
        ctx.fillText(`${Number(l.subText).toLocaleString("es", { useGrouping: "always" })} m`, x, y - 20 * f);
      }
      continue;
    }
    ctx.font = st.font.replace(/([\d.]+)px/, (_, n) => `${n * f}px`);
    const text = st.upper ? String(l.name).toUpperCase() : String(l.name);
    if (st.center) { ctx.textAlign = "center"; ctx.fillText(text, x, y); continue; }
    ctx.textAlign = "left";
    const dx = (l.dx || 8) * f;
    const em = st.spacing ? st.spacing * parseFloat(st.font.match(/([\d.]+)px/)[1]) * f : 0;
    const w = em ? [...text].reduce((a, ch) => a + ctx.measureText(ch).width + em, 0) : ctx.measureText(text).width;
    const x0 = l.flip ? x - dx - w : x + dx;
    if (em) spaced(ctx, text, x0, y, em); else ctx.fillText(text, x0, y);
    if (l.sub != null && l.unit) { ctx.globalAlpha = 0.85; ctx.font = `400 ${11.5 * f}px ${SANS}`; ctx.fillText(`${l.sub} ${l.unit}`, x0, y + 15 * f); }
  }
  ctx.restore();
}

/** Copia de la vista actual (escena + nombres). */
export function snapshotView({ renderer, scene, camera, labels, colors, cssW, cssH }) {
  try {
    renderer.render(scene, camera);
    const src = renderer.domElement;
    if (!src.width || !src.height) return null;
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const g = c.getContext("2d");
    g.fillStyle = "#03060d"; g.fillRect(0, 0, c.width, c.height);     // el lienzo WebGL es transparente
    g.drawImage(src, 0, 0);
    const k = c.width / Math.max(1, cssW || src.clientWidth || c.width);
    // en la postal (1080 px de ancho) los nombres deben verse de ~22 px como mínimo, también desde un ordenador
    const sPc = viewPlacement(c.width, c.height, { W: 1080, H: 1920, top: 0, bottom: 1920 }).s;
    drawLabels(g, labels, colors, k, Math.max(k, 22 / (13 * sPc)));
    c.dataset.cssH = String(cssH || "");
    return c;
  } catch { return null; }
}

/** Encaje de la vista en la postal: escala, recorte y posición (puro, para probarlo). */
export function viewPlacement(vw, vh, { W, H, top, bottom }) {
  const areaH = Math.max(1, bottom - top);
  let s = W / vw;
  if (vh * s < H * 0.5) s = (H * 0.5) / vh;                         // apaisada: al menos la mitad del alto
  const dw = vw * s, dh = vh * s;
  const dx = (W - dw) / 2;
  // centrada en la zona libre entre la cabecera y el texto, pero sin dejar huecos si cubre todo el alto
  let dy = top + (areaH - dh) / 2;
  if (dh >= H) dy = Math.min(0, Math.max(H - dh, dy));
  return { s, dx, dy, dw, dh };
}

/** Pinta la vista en la postal; arriba y abajo, prolonga el cielo y el suelo de la propia imagen. */
export function drawViewCover(ctx, view, o) {
  const { W, H } = o;
  const p = viewPlacement(view.width, view.height, o);
  if (p.dy > 0) ctx.drawImage(view, 0, 0, view.width, 1, p.dx, 0, p.dw, p.dy + 1);
  const below = p.dy + p.dh;
  if (below < H) ctx.drawImage(view, 0, view.height - 1, view.width, 1, p.dx, below - 1, p.dw, H - below + 1);
  ctx.drawImage(view, p.dx, p.dy, p.dw, p.dh);
  return p;
}
