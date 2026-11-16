// postcardStar.js — los dos bloques extra de la postal de una ESTRELLA y del Sol (postcard.js):
//   · «Espectro (esquemático)»: banda del visible 380–750 nm, curva de cuerpo negro a la temperatura
//     de la estrella y sus líneas de absorción típicas. Decide si se dibuja con compositionPlan(),
//     EXACTAMENTE como la ficha (CompositionBlock.jsx / Spectrum.jsx): sin temperatura o con una clase
//     que no cuadra con el color, la ficha no lo muestra y la postal tampoco.
//   · «Vida y final»: la línea de tiempo de lifePlan() (starLife.js), como StarLifeBlock.jsx, con
//     «HOY» en la etapa actual, la masa (publicada o estimada, rotulada) y una frase de su final.
// Todo se mide antes de dibujar (funciones layout* puras: reciben `measureAt(fuente)(px)(texto)`) y
// ningún texto se corta: si no cabe, se parte en líneas o se achica dentro de su mínimo (≥ 24 px;
// las marcas del eje, 20 px). Las cifras y sus fuentes están en composition.js y starLife.js.
import { compositionPlan, wavelengthHex, wienPeak, peakZone, spectrumCurve, VIS_MIN, VIS_MAX } from "./composition.js";
import { lifePlan } from "./starLife.js";
import { starTemperature, parseSpect } from "./starColor.js";
import { LIFE } from "./i18n-comp.js";

const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const TAU = Math.PI * 2;
export const SB_FONTS = {
  title: (px) => `600 ${px}px ${SANS}`,
  text: (px) => `400 ${px}px ${SANS}`,
  strong: (px) => `600 ${px}px ${SANS}`,
  tick: (px) => `500 ${px}px ${SANS}`,
};
/** Medidas de los bloques (px). Texto ≥ 24 px salvo las marcas del eje (20 px). */
export const SB = { padX: 24, padY: 16, title: 26, text: 24, tick: 20, labelRow: 32, plotH: 80, stripH: 26, tickRow: 28, nodeRow: 42, maxLabels: 4 };

const loc = (lang) => (lang === "es" ? "es" : "en-US");
const k0 = (v, lang) => Math.round(v).toLocaleString(loc(lang), { useGrouping: "always" });

// ── qué se dibuja ───────────────────────────────────────────────────────
/**
 * Bloques de la postal para un objeto (función pura). null si no es una estrella del catálogo ni el Sol.
 *   spectrum  { temp, lowerBound, letter, lines, isSun } — solo si la ficha dibuja el espectro
 *   life      el plan de lifePlan() — solo si tiene camino (etapas) que dibujar
 */
export function starBlocks(obj) {
  if (!obj) return null;
  const isSun = obj.layer === "solar" && obj.name === "Sol";
  if (obj.layer !== "star" && !isSun) return null;
  const plan = compositionPlan(obj, obj.layer === "star" ? starTemperature(obj.bv) : null);
  const spectrum = plan && (plan.kind === "sun" || plan.kind === "star") && plan.temp != null
    ? { temp: plan.temp, lowerBound: !!plan.lowerBound, letter: plan.letter, lines: plan.lines || [], isSun: plan.kind === "sun" } : null;
  const lp = lifePlan(obj, obj.layer === "star" ? parseSpect(obj.spect) : null);
  const life = lp && lp.path && lp.path.length ? lp : null;
  return { spectrum, life };
}

/**
 * Rótulos de líneas para la postal: 2–4, los grupos más intensos primero (función pura).
 * Devuelve [{ text, nm }] ordenados por longitud de onda.
 */
export function spectrumLabels(sp, t) {
  const lines = sp.lines || [];
  if (sp.isSun) {
    // líneas de Fraunhofer con su letra, en orden de fama: D (sodio), C (Hα), H y K (calcio), F (Hβ), b (magnesio)
    const has = (k) => lines.some((l) => l.key === k);
    const out = [];
    if (has("NaD2")) out.push({ text: "Na (D)", nm: 589.3 });
    if (has("Ha")) out.push({ text: "Hα (C)", nm: 656.28 });
    if (has("CaK")) out.push({ text: `${t.pcSpecHK}`, nm: 395.1 });
    if (has("Hb")) out.push({ text: "Hβ (F)", nm: 486.13 });
    if (has("Mgb1")) out.push({ text: "Mg (b)", nm: 517.5 });
    return out.slice(0, SB.maxLabels).sort((a, b) => a.nm - b.nm);
  }
  const groups = new Map();
  for (const l of lines) { const g = l.group || l.key; if (!groups.has(g) || l.strength > groups.get(g)) groups.set(g, l.strength || 0); }
  // a igual intensidad, este orden (los nombres que más se reconocen primero)
  const pref = ["balmer", "nad", "cahk", "tio", "mgb", "hei", "heii"];
  const order = [...groups.keys()].sort((a, b) => (groups.get(b) - groups.get(a)) || (pref.indexOf(a) - pref.indexOf(b)));
  const out = [];
  for (const g of order) {
    if (out.length >= SB.maxLabels) break;
    // Balmer: Hα; Hβ si es media o fuerte; en las de tipo A (fuerte) la serie que las define: Hγ y Hδ también
    if (g === "balmer") {
      out.push({ text: "Hα", nm: 656.28 });
      if (groups.get(g) >= 2) out.push({ text: "Hβ", nm: 486.13 });
      if (groups.get(g) >= 3) out.push({ text: "Hγ", nm: 434.05 }, { text: "Hδ", nm: 410.17 });
    }
    else if (g === "cahk") out.push({ text: t.pcSpecHK, nm: 395.1 });
    else if (g === "nad") out.push({ text: "Na", nm: 589.3 });
    else if (g === "mgb") out.push({ text: "Mg", nm: 517.5 });
    else if (g === "hei") out.push({ text: "He I", nm: 447.15 });
    else if (g === "heii") out.push({ text: "He II", nm: 468.57 });
    else if (g === "tio") out.push({ text: "TiO", nm: 619.25 });
  }
  return out.slice(0, SB.maxLabels).sort((a, b) => a.nm - b.nm);
}

// ── texto que no se corta (copia mínima de fitLines para no depender de postcard.js) ──
function wrap(measure, text, maxW) {
  // se parte solo por espacios normales: un espacio duro (U+00A0) mantiene unidas dos palabras
  const words = String(text || "").split(/[ \t\n\r]+/).filter(Boolean), lines = [];
  let cur = "";
  for (const w of words) {
    const tryLine = cur ? cur + " " + w : w;
    if (measure(tryLine) <= maxW || !cur) { cur = tryLine; continue; }
    lines.push(cur); cur = w;
  }
  if (cur) lines.push(cur);
  return lines;
}
/** Mayor tamaño (max → min) con el que el texto cabe en maxLines líneas de ancho ≤ maxW. */
export function fitText(measureAt, text, { max, min, maxW, maxLines }) {
  for (let size = max; size >= min; size -= 1) {
    const m = measureAt(size), lines = wrap(m, text, maxW);
    if (lines.length <= maxLines && lines.every((l) => m(l) <= maxW)) return { size, lines, truncated: false };
  }
  const m = measureAt(min), lines = wrap(m, text, maxW);
  return { size: min, lines, truncated: lines.length > maxLines || lines.some((l) => m(l) > maxW) };
}
const linesH = (f, k = 1.24) => (f ? Math.round(f.size * k) * f.lines.length : 0);

// ── espectro ────────────────────────────────────────────────────────────
/**
 * Mide y coloca el bloque del espectro (función pura). `measureAt(fontFn)(px)(texto)`.
 * Devuelve { h, title, peak, caption, labels:[{text,nm,cx,tx,w,row}], rows, geo, truncated }.
 */
export function layoutSpectrum(measureAt, sp, t, lang, { w }) {
  const inner = w - 2 * SB.padX;
  const title = fitText(measureAt(SB_FONTS.title), t.pcSpecTitle, { max: SB.title, min: 24, maxW: inner, maxLines: 1 });
  const peakNm = wienPeak(sp.temp), zone = peakZone(sp.temp);
  const peak = fitText(measureAt(SB_FONTS.text), t.pcSpecPeak(k0(peakNm, lang), zone), { max: SB.text, min: 24, maxW: inner, maxLines: 2 });
  const tio = (sp.lines || []).some((l) => l.group === "tio");
  const capText = sp.isSun ? t.pcSpecCapSun(k0(sp.temp, lang)) : t.pcSpecCap(k0(sp.temp, lang), sp.letter, sp.lowerBound, tio);
  const caption = fitText(measureAt(SB_FONTS.text), capText, { max: SB.text, min: 24, maxW: inner, maxLines: 3 });
  // rótulos de líneas: en una fila si caben sin pisarse; si no, en dos; si ni así, se omite el rótulo
  const xOf = (nm) => SB.padX + ((nm - VIS_MIN) / (VIS_MAX - VIS_MIN)) * inner;
  const mL = measureAt(SB_FONTS.strong)(SB.text);
  const rowEnd = [-Infinity, -Infinity], labels = [];
  for (const lb of spectrumLabels(sp, t)) {
    const cx = xOf(lb.nm), lw = mL(lb.text);
    const left = Math.max(SB.padX, Math.min(SB.padX + inner - lw, cx - lw / 2));
    const row = left > rowEnd[0] + 14 ? 0 : left > rowEnd[1] + 14 ? 1 : -1;
    if (row < 0) continue;
    rowEnd[row] = left + lw;
    labels.push({ ...lb, cx, tx: left, w: lw, row });
  }
  const rows = labels.some((l) => l.row === 1) ? 2 : 1;
  const geo = {};
  let y = SB.padY;
  geo.title = y; y += linesH(title, 1.2);
  geo.peak = y; y += linesH(peak) + 8;
  geo.labels = y; y += rows * SB.labelRow;
  geo.plotTop = y + 6; y += SB.plotH;
  geo.plotBot = y;
  geo.strip = y + 4; y += 4 + SB.stripH;
  geo.ticks = y + 6; y += SB.tickRow;
  geo.caption = y + 6; y += 6 + linesH(caption);
  const h = y + SB.padY;
  return { h, title, peak, caption, labels, rows, geo, zone, peakNm, inner, nmLabel: t.pcSpecNm, truncated: [title, peak, caption].some((f) => f.truncated) };
}

/** Dibuja el espectro en (x, y) con el ancho w. `put(texto, x, y, px, rol)` anota cada línea en el informe. */
export function drawSpectrum(ctx, L, sp, x, y, w, put) {
  const inner = L.inner, x0 = x + SB.padX, xOf = (nm) => x0 + ((nm - VIS_MIN) / (VIS_MAX - VIS_MIN)) * inner;
  panel(ctx, x, y, w, L.h);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  text(ctx, L.title, SB_FONTS.title, "#c9b8ff", x0, y + L.geo.title, 1.2, put);
  text(ctx, L.peak, SB_FONTS.text, "#f2c66d", x0, y + L.geo.peak, 1.24, put);
  const top = y + L.geo.plotTop, bot = y + L.geo.plotBot, stripY = y + L.geo.strip;
  const yOf = (v) => bot - v * (bot - top);
  // la curva, con las mismas líneas que la ficha (absorciones de spectrumCurve)
  const curve = spectrumCurve(sp.temp, sp.lines, { step: 1 });
  const grad = ctx.createLinearGradient(x0, 0, x0 + inner, 0);
  for (let nm = VIS_MIN; nm <= VIS_MAX; nm += 10) grad.addColorStop((nm - VIS_MIN) / (VIS_MAX - VIS_MIN), wavelengthHex(nm));
  ctx.beginPath();
  curve.forEach((p, i) => (i ? ctx.lineTo(xOf(p.nm), yOf(p.y)) : ctx.moveTo(xOf(p.nm), yOf(p.y))));
  ctx.lineTo(xOf(VIS_MAX), bot); ctx.lineTo(xOf(VIS_MIN), bot); ctx.closePath();
  ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = grad; ctx.fill(); ctx.restore();
  ctx.strokeStyle = "rgba(226,230,246,0.35)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(xOf(VIS_MIN), bot); ctx.lineTo(xOf(VIS_MAX), bot); ctx.stroke();
  // guías de las líneas rotuladas (del rótulo a la banda)
  ctx.save(); ctx.strokeStyle = "rgba(226,230,246,0.45)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
  for (const lb of L.labels) {
    const ly = y + L.geo.labels + lb.row * SB.labelRow + SB.text + 4;
    ctx.beginPath(); ctx.moveTo(x + lb.cx, ly); ctx.lineTo(x + lb.cx, stripY); ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  curve.forEach((p, i) => (i ? ctx.lineTo(xOf(p.nm), yOf(p.y)) : ctx.moveTo(xOf(p.nm), yOf(p.y))));
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.stroke();
  // pico de Wien: en el visible, línea dorada; fuera, flecha hacia ese lado
  ctx.fillStyle = "#f2c66d"; ctx.strokeStyle = "#f2c66d"; ctx.lineWidth = 2.5;
  if (L.zone === "visible") {
    const px = xOf(L.peakNm);
    ctx.save(); ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(px, top - 4); ctx.lineTo(px, bot); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(px - 8, top - 12); ctx.lineTo(px + 8, top - 12); ctx.lineTo(px, top - 2); ctx.closePath(); ctx.fill();
  } else {
    const ax = L.zone === "uv" ? x0 + 2 : x0 + inner - 2, dir = L.zone === "uv" ? -1 : 1, ay = top + 12;
    ctx.beginPath(); ctx.moveTo(ax - dir * 34, ay); ctx.lineTo(ax - dir * 6, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - dir * 14, ay - 9); ctx.lineTo(ax - dir * 14, ay + 9); ctx.closePath(); ctx.fill();
  }
  // banda del visible con las líneas oscuras
  ctx.save(); roundRect(ctx, x0, stripY, inner, SB.stripH, 5); ctx.clip();
  ctx.fillStyle = grad; ctx.fillRect(x0, stripY, inner, SB.stripH);
  for (const l of sp.lines) {
    if (l.band) {
      ctx.fillStyle = `rgba(4,6,12,${Math.min(0.85, 0.25 + l.depth).toFixed(2)})`;
      ctx.fillRect(xOf(l.nm), stripY, Math.max(3, xOf(l.nm + 14) - xOf(l.nm)), SB.stripH);
    } else {
      const lw = l.depth > 0.5 ? 4 : l.depth > 0.3 ? 3 : 2;
      ctx.fillStyle = `rgba(4,6,12,${Math.min(1, 0.4 + l.depth).toFixed(2)})`;
      ctx.fillRect(xOf(l.nm) - lw / 2, stripY, lw, SB.stripH);
    }
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(226,230,246,0.4)"; ctx.lineWidth = 1.5; roundRect(ctx, x0, stripY, inner, SB.stripH, 5); ctx.stroke();
  // rótulos de las líneas
  ctx.font = SB_FONTS.strong(SB.text); ctx.fillStyle = "#ffffff";
  for (const lb of L.labels) {
    const ly = y + L.geo.labels + lb.row * SB.labelRow;
    ctx.fillText(lb.text, x + lb.tx, ly); put(lb.text, x + lb.tx, ly, SB.text, "spectrum");
  }
  // marcas del eje (20 px)
  ctx.font = SB_FONTS.tick(SB.tick); ctx.fillStyle = "rgba(226,230,246,0.8)";
  const ty = y + L.geo.ticks;
  for (const nm of [400, 500, 600, 700]) {
    const s = nm === 700 ? `${nm} ${L.nmLabel || "nm"}` : String(nm);
    const tw = ctx.measureText(s).width, tx = Math.min(x0 + inner - tw, xOf(nm) - (nm === 700 ? ctx.measureText(String(nm)).width / 2 : tw / 2));
    ctx.fillRect(xOf(nm) - 1, stripY + SB.stripH, 2, 6);
    ctx.fillText(s, tx, ty); put(s, tx, ty, SB.tick, "spectrum-axis");
  }
  text(ctx, L.caption, SB_FONTS.text, "rgba(226,230,246,0.86)", x0, y + L.geo.caption, 1.24, put);
}

// ── vida y final ────────────────────────────────────────────────────────
/** Frase del final, como la ficha (StarLifeBlock.jsx), en su forma corta de postal. */
export function fateKey(plan) {
  if (plan.kind === "sun") return "sun";
  if (plan.stage === "wd") return "isWd";
  if (!plan.fate) return null;
  return plan.fate === "wd" && (plan.stage === "giant" || plan.stage === "supergiant") ? "wdLate" : plan.fate;
}
/** «Neuhäuser et al. 2022, MNRAS 516, 693» → «Neuhäuser et al. 2022» */
const shortRef = (r) => (r ? String(r).split(",")[0].trim() : "");

/**
 * Mide y coloca el bloque «Vida y final» (función pura). Devuelve
 * { h, title, mass, nodes:[{x, label, here, past}], here, fate, notes:[…], geo, truncated }.
 */
export function layoutLife(measureAt, plan, t, lang, { w }) {
  const lt = LIFE[lang] || LIFE.es;
  const inner = w - 2 * SB.padX;
  const title = fitText(measureAt(SB_FONTS.title), t.pcLifeTitle, { max: SB.title, min: 24, maxW: inner, maxLines: 1 });
  let massTxt = null;
  if (plan.kind === "sun") massTxt = t.pcLifeMassSun;
  else if (plan.massKind === "curated") massTxt = t.pcLifeMass(lt.mass(plan.mass), shortRef(plan.ref && plan.ref[0]));
  else if (plan.massKind === "estimated") massTxt = t.pcLifeMassEst(lt.mass(plan.mass), `${plan.letter}${plan.sub}V`);
  else if (plan.stage && plan.stage !== "wd") massTxt = t.pcLifeMassNone;
  const mass = massTxt ? fitText(measureAt(SB_FONTS.text), massTxt, { max: SB.text, min: 24, maxW: inner, maxLines: 2 }) : null;
  // nodos repartidos a lo ancho: cada rótulo ocupa su tramo y nunca sale del bloque
  const n = plan.path.length, seg = inner / n;
  const nodes = plan.path.map((s, i) => {
    const font = i === plan.here ? SB_FONTS.strong : SB_FONTS.text;
    const label = fitText(measureAt(font), lt.stage[s] || s, { max: SB.text, min: 24, maxW: seg - 12, maxLines: 3 });
    return { key: s, x: SB.padX + seg * (i + 0.5), label, here: i === plan.here, past: plan.here >= 0 && i < plan.here };
  });
  const fk = fateKey(plan);
  const fate = fk && t.pcFate[fk] ? fitText(measureAt(SB_FONTS.text), t.pcFate[fk], { max: SB.text, min: 24, maxW: inner, maxLines: 3 }) : null;
  const notes = [];
  if (plan.near && plan.fate !== "nsbh" && plan.fate !== "border") notes.push(fitText(measureAt(SB_FONTS.text), lt.near, { max: SB.text, min: 24, maxW: inner - 30, maxLines: 2 }));
  if (plan.assumed) notes.push(fitText(measureAt(SB_FONTS.text), t.pcLifeAssumed, { max: SB.text, min: 24, maxW: inner - 30, maxLines: 2 }));
  const hereW = measureAt(SB_FONTS.strong)(SB.text)(t.pcLifeNow);
  const geo = {};
  let y = SB.padY;
  geo.title = y; y += linesH(title, 1.2);
  if (mass) { geo.mass = y; y += linesH(mass); }
  y += 10;
  // la etapa actual se marca con una píldora dorada «HOY» sobre la propia línea (no ocupa una fila aparte)
  geo.node = y + SB.nodeRow / 2; y += SB.nodeRow;
  geo.labels = y + 4; y += 4 + Math.max(...nodes.map((nd) => linesH(nd.label, 1.2)));
  if (fate) { geo.fate = y + 10; y += 10 + linesH(fate); }
  geo.notes = [];
  for (const nt of notes) { geo.notes.push(y + 6); y += 6 + linesH(nt); }
  const h = y + SB.padY;
  const truncated = [title, mass, fate, ...notes, ...nodes.map((nd) => nd.label)].some((f) => f && f.truncated);
  return { h, title, mass, nodes, here: plan.here, fate, notes, geo, inner, hereW, truncated };
}

export function drawLife(ctx, L, t, x, y, w, put) {
  const x0 = x + SB.padX;
  panel(ctx, x, y, w, L.h);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  text(ctx, L.title, SB_FONTS.title, "#c9b8ff", x0, y + L.geo.title, 1.2, put, "life");
  if (L.mass) text(ctx, L.mass, SB_FONTS.text, "rgba(240,242,252,0.95)", x0, y + L.geo.mass, 1.24, put, "life");
  const ny = y + L.geo.node, first = x + L.nodes[0].x, last = x + L.nodes[L.nodes.length - 1].x;
  // la línea: recorrida (hasta HOY) continua; lo que falta, punteada
  const hereX = L.here >= 0 ? x + L.nodes[L.here].x : first;
  ctx.lineWidth = 4; ctx.lineCap = "round";
  if (L.here > 0) { ctx.strokeStyle = "rgba(201,184,255,0.85)"; ctx.beginPath(); ctx.moveTo(first, ny); ctx.lineTo(hereX, ny); ctx.stroke(); }
  ctx.save(); ctx.setLineDash([10, 9]); ctx.strokeStyle = "rgba(201,184,255,0.55)"; ctx.beginPath(); ctx.moveTo(hereX, ny); ctx.lineTo(last, ny); ctx.stroke(); ctx.restore();
  for (const nd of L.nodes) {
    const cx = x + nd.x;
    if (nd.here) {
      // píldora «HOY», centrada en su nodo y siempre dentro del bloque
      const pw = L.hereW + 30, ph = 38;
      const px = Math.max(x0, Math.min(x + w - SB.padX - pw, cx - pw / 2));
      const g = ctx.createRadialGradient(px + pw / 2, ny, 0, px + pw / 2, ny, pw * 0.8);
      g.addColorStop(0, "rgba(242,198,109,0.55)"); g.addColorStop(1, "rgba(242,198,109,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px + pw / 2, ny, pw * 0.8, 0, TAU); ctx.fill();
      roundRect(ctx, px, ny - ph / 2, pw, ph, ph / 2); ctx.fillStyle = "#f2c66d"; ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = SB_FONTS.strong(SB.text); ctx.fillStyle = "#1a1306"; ctx.textBaseline = "middle";
      ctx.fillText(t.pcLifeNow, px + 15, ny + 1); put(t.pcLifeNow, px + 15, ny - SB.text / 2, SB.text, "life");
      ctx.textBaseline = "top";
    } else if (nd.past) {
      ctx.fillStyle = "#c9b8ff"; ctx.beginPath(); ctx.arc(cx, ny, 10, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = "#0b0f22"; ctx.beginPath(); ctx.arc(cx, ny, 10, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(201,184,255,0.9)"; ctx.lineWidth = 3; ctx.stroke();
    }
    // rótulo de la etapa, centrado bajo su nodo
    const f = nd.label, font = nd.here ? SB_FONTS.strong : SB_FONTS.text;
    ctx.font = font(f.size); ctx.fillStyle = nd.here ? "#ffffff" : "rgba(226,230,246,0.82)";
    let ly = y + L.geo.labels;
    for (const ln of f.lines) {
      const lw = ctx.measureText(ln).width, lx = cx - lw / 2;
      ctx.fillText(ln, lx, ly); put(ln, lx, ly, f.size, "life");
      ly += Math.round(f.size * 1.2);
    }
  }
  if (L.fate) text(ctx, L.fate, SB_FONTS.text, "rgba(240,242,252,0.96)", x0, y + L.geo.fate, 1.24, put, "life");
  L.notes.forEach((nt, i) => {
    const ny2 = y + L.geo.notes[i];
    ctx.strokeStyle = "#f2c66d"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x0 + 9, ny2 + nt.size * 0.6, 8, 0, TAU); ctx.stroke();
    ctx.fillStyle = "#f2c66d"; ctx.fillRect(x0 + 8, ny2 + nt.size * 0.6 - 4, 2, 5); ctx.fillRect(x0 + 8, ny2 + nt.size * 0.6 + 3, 2, 2);
    text(ctx, nt, SB_FONTS.text, "#f6dfa6", x0 + 30, ny2, 1.24, put, "life");
  });
}

// ── utilidades de dibujo ────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
function panel(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 22); ctx.fillStyle = "rgba(14,16,38,0.9)"; ctx.fill();
  ctx.strokeStyle = "rgba(167,139,250,0.42)"; ctx.lineWidth = 2; ctx.stroke();
}
function text(ctx, f, font, color, x, y, k, put, role = "spectrum") {
  ctx.font = font(f.size); ctx.fillStyle = color;
  for (const ln of f.lines) { ctx.fillText(ln, x, y); put(ln, x, y, f.size, role); y += Math.round(f.size * k); }
}
