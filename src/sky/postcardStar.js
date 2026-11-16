// postcardStar.js — los dos bloques extra de la postal de una ESTRELLA y del Sol (postcard.js), en
// versión sintética (sin tarjetas: un fino separador y un encabezado de una fila):
//   · «Su luz»: banda del visible 380–750 nm con sus líneas oscuras de absorción y la curva de cuerpo
//     negro encima; UN rótulo (dónde es más intensa su luz) y como mucho 2 nombres de líneas. Decide si
//     se dibuja con compositionPlan(), EXACTAMENTE como la ficha (CompositionBlock.jsx / Spectrum.jsx):
//     sin temperatura o con una clase que no cuadra con el color, la ficha no lo muestra y la postal
//     tampoco. Que es un esquema (y no una medición) lo dice el crédito del pie.
//   · «Su vida»: la línea de tiempo de lifePlan() (starLife.js), como StarLifeBlock.jsx, con «HOY» en
//     la etapa actual, la masa en la misma fila del título y UNA frase de su final.
// Todo se mide antes de dibujar (funciones layout* puras: reciben `measureAt(fuente)(px)(texto)`) y
// ningún texto se corta: si no cabe, se parte en líneas (≥ 24 px; las marcas del eje, 20 px). Las
// cifras y sus fuentes están en composition.js y starLife.js.
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
/** Medidas de los bloques (px). Texto ≥ 24 px salvo las marcas del eje (20 px). Sin relleno: los
 *  bloques ocupan el ancho de la columna de texto, alineados con la casilla de la distancia. */
export const SB = { title: 28, text: 24, tick: 20, headGap: 16, plotH: 64, stripH: 24, nameRow: 30, nodeRow: 40, maxLabels: 2 };

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
 * Subtítulo de la postal de estrella (función pura): «Supergigante roja · M2Ib · magnitud 0,45».
 * Todo sale de lo que ya usa la ficha: la etapa de lifePlan() y el color de su letra (LIFE, los mismos
 * de «Es una supergigante roja…»), el tipo espectral y la magnitud de describeObject (info.details).
 * Si la etapa o el color no se conocen, se usa el tipo de la ficha («Estrella»); nada se inventa.
 */
export function starSubtitle(obj, info, t, lang) {
  const lt = LIFE[lang] || LIFE.es;
  const details = (info && info.details) || [];
  const det = (label) => { const d = label && details.find((x) => x[0] === label); return d ? String(d[1]).split(" · ")[0].trim() : null; };
  const isSun = obj.layer === "solar" && obj.name === "Sol";
  const sp = isSun ? { letter: "G", sub: 2 } : parseSpect(obj.spect);
  const lp = lifePlan(obj, isSun ? null : sp);
  const color = sp && lt.color[sp.letter];
  const kind = (lp && t.pcStarKind && t.pcStarKind(lp.stage, sp.letter, !!lp.assumed, color)) || (info && info.type ? String(info.type).split(" · ")[0] : "");
  const parts = [kind];
  if (isSun) {
    parts.push("G2\u00a0V");
    const rest = info && info.type && String(info.type).split(" · ").slice(1).join(" · ");
    if (rest) parts.push(rest);
  } else {
    // el tipo del catálogo tal cual (sin los puntos suspensivos con que HYG marca lo dudoso: «A0m...»)
    const spt = det(t.dSpect);
    if (spt && spt !== "—") parts.push(spt.replace(/\.+$/, ""));
    const mag = det(t.dMagnitude);
    if (mag && mag !== "—") parts.push(t.pcGMag(mag));
  }
  return parts.filter(Boolean).join(" · ");
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

/**
 * Encabezado de un bloque (función pura): el título y, en la MISMA fila si cabe, su dato principal
 * («Su luz · más intensa en 763 nm · infrarrojo →»). Si no cabe, el dato va debajo (≤ 2 líneas).
 * Devuelve { title, sub, inline, subX, h, truncated }.
 */
export function layoutHead(measureAt, titleText, subText, inner) {
  const title = fitText(measureAt(SB_FONTS.title), titleText, { max: SB.title, min: 26, maxW: inner, maxLines: 1 });
  if (!subText) return { title, sub: null, inline: true, subX: 0, h: linesH(title, 1.2), truncated: title.truncated };
  const tw = measureAt(SB_FONTS.title)(title.size)(title.lines[0]), dotW = measureAt(SB_FONTS.text)(SB.text)("·");
  const subX = tw + 14 + dotW + 14;
  const one = fitText(measureAt(SB_FONTS.text), subText, { max: SB.text, min: SB.text, maxW: inner - subX, maxLines: 1 });
  if (!one.truncated) return { title, sub: one, inline: true, subX, dotX: tw + 14, h: linesH(title, 1.2), truncated: title.truncated };
  const sub = fitText(measureAt(SB_FONTS.text), subText, { max: SB.text, min: SB.text, maxW: inner, maxLines: 2 });
  return { title, sub, inline: false, subX: 0, h: linesH(title, 1.2) + 4 + linesH(sub), truncated: title.truncated || sub.truncated };
}

// ── su luz (espectro) ───────────────────────────────────────────────────
/**
 * Mide y coloca el bloque «Su luz» (función pura). `measureAt(fontFn)(px)(texto)`.
 * Devuelve { h, head, labels:[{text,nm,cx,tx,w}], ticks:[{text,nm,tx,w}], geo, peakNm, zone, inner, truncated }.
 * Bajo la banda: los nombres de ≤ 2 líneas en su longitud de onda y, si no los pisan, «400» y «700 nm».
 */
export function layoutSpectrum(measureAt, sp, t, lang, { w }) {
  const inner = w;
  const peakNm = wienPeak(sp.temp), zone = peakZone(sp.temp);
  const head = layoutHead(measureAt, t.pcSpecTitle, t.pcSpecPeak(k0(peakNm, lang), zone), inner);
  const xOf = (nm) => ((nm - VIS_MIN) / (VIS_MAX - VIS_MIN)) * inner;
  const mL = measureAt(SB_FONTS.strong)(SB.text), mT = measureAt(SB_FONTS.tick)(SB.tick);
  const taken = [], labels = [], ticks = [];
  const free = (a, b) => taken.every(([c, d]) => b + 16 <= c || a >= d + 16);
  for (const lb of spectrumLabels(sp, t)) {
    const cx = xOf(lb.nm), lw = mL(lb.text), left = Math.max(0, Math.min(inner - lw, cx - lw / 2));
    if (!free(left, left + lw)) continue;
    taken.push([left, left + lw]); labels.push({ ...lb, cx, tx: left, w: lw });
  }
  // marcas discretas del eje: solo los extremos, para dar escala a los nm del rótulo
  for (const nm of [400, 700]) {
    const s = nm === 700 ? `${nm} ${t.pcSpecNm || "nm"}` : String(nm);
    const tw = mT(s), cx = xOf(nm);
    const left = nm === 700 ? Math.min(inner - tw, cx - mT(String(nm)) / 2) : Math.max(0, cx - tw / 2);
    if (!free(left, left + tw)) continue;
    taken.push([left, left + tw]); ticks.push({ text: s, nm, cx, tx: left, w: tw });
  }
  const geo = {};
  let y = 0;
  geo.head = y; y += head.h;
  geo.plotTop = y + SB.headGap + 4; y = geo.plotTop + SB.plotH;
  geo.plotBot = y;
  geo.strip = y + 2; y += 2 + SB.stripH;
  geo.names = y + 8; y += 8 + SB.nameRow;
  return { h: y, head, labels, ticks, geo, zone, peakNm, inner, truncated: head.truncated };
}

/** Dibuja «Su luz» en (x, y) con el ancho w. `put(texto, x, y, px, rol)` anota cada línea en el informe. */
export function drawSpectrum(ctx, L, sp, x, y, w, put) {
  const inner = L.inner, x0 = x, xOf = (nm) => x0 + ((nm - VIS_MIN) / (VIS_MAX - VIS_MIN)) * inner;
  drawHead(ctx, L.head, x0, y + L.geo.head, "#f2c66d", put, "spectrum");
  const top = y + L.geo.plotTop, bot = y + L.geo.plotBot, stripY = y + L.geo.strip;
  const yOf = (v) => bot - v * (bot - top);
  // la curva, con las mismas líneas que la ficha (absorciones de spectrumCurve)
  const curve = spectrumCurve(sp.temp, sp.lines, { step: 1 });
  const grad = ctx.createLinearGradient(x0, 0, x0 + inner, 0);
  for (let nm = VIS_MIN; nm <= VIS_MAX; nm += 10) grad.addColorStop((nm - VIS_MIN) / (VIS_MAX - VIS_MIN), wavelengthHex(nm));
  ctx.beginPath();
  curve.forEach((p, i) => (i ? ctx.lineTo(xOf(p.nm), yOf(p.y)) : ctx.moveTo(xOf(p.nm), yOf(p.y))));
  ctx.lineTo(xOf(VIS_MAX), bot); ctx.lineTo(xOf(VIS_MIN), bot); ctx.closePath();
  ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = grad; ctx.fill(); ctx.restore();
  ctx.beginPath();
  curve.forEach((p, i) => (i ? ctx.lineTo(xOf(p.nm), yOf(p.y)) : ctx.moveTo(xOf(p.nm), yOf(p.y))));
  ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
  // pico de Wien: en el visible, marca dorada; fuera, flecha hacia ese lado
  ctx.fillStyle = "#f2c66d"; ctx.strokeStyle = "#f2c66d"; ctx.lineWidth = 2.5;
  if (L.zone === "visible") {
    const px = xOf(L.peakNm);
    ctx.save(); ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, top - 2); ctx.lineTo(px, bot); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(px - 8, top - 12); ctx.lineTo(px + 8, top - 12); ctx.lineTo(px, top - 2); ctx.closePath(); ctx.fill();
  } else {
    const ax = L.zone === "uv" ? x0 + 2 : x0 + inner - 2, dir = L.zone === "uv" ? -1 : 1, ay = top - 6;   // justo sobre la curva
    ctx.beginPath(); ctx.moveTo(ax - dir * 34, ay); ctx.lineTo(ax - dir * 6, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - dir * 14, ay - 9); ctx.lineTo(ax - dir * 14, ay + 9); ctx.closePath(); ctx.fill();
  }
  // banda del visible con las líneas oscuras
  ctx.save(); roundRect(ctx, x0, stripY, inner, SB.stripH, 6); ctx.clip();
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
  // bajo la banda: los nombres de las líneas (con su marca) y, discretas, las marcas del eje
  const ny = y + L.geo.names;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.font = SB_FONTS.strong(SB.text); ctx.fillStyle = "rgba(240,242,252,0.95)";
  for (const lb of L.labels) {
    ctx.fillRect(x + lb.cx - 1, stripY + SB.stripH + 1, 2, 7);
    ctx.fillText(lb.text, x + lb.tx, ny); put(lb.text, x + lb.tx, ny, SB.text, "spectrum");
  }
  ctx.font = SB_FONTS.tick(SB.tick); ctx.fillStyle = "rgba(226,230,246,0.55)";
  for (const tk of L.ticks) {
    ctx.fillRect(x + tk.cx - 1, stripY + SB.stripH + 1, 2, 5);
    ctx.fillText(tk.text, x + tk.tx, ny + 2); put(tk.text, x + tk.tx, ny + 2, SB.tick, "spectrum-axis");
  }
}

// ── su vida ─────────────────────────────────────────────────────────────
/** Frase del final, como la ficha (StarLifeBlock.jsx), en su forma corta de postal. */
export function fateKey(plan) {
  if (plan.kind === "sun") return "sun";
  if (plan.stage === "wd") return "isWd";
  if (!plan.fate) return null;
  return plan.fate === "wd" && (plan.stage === "giant" || plan.stage === "supergiant") ? "wdLate" : plan.fate;
}
/** «Neuhäuser et al. 2022, MNRAS 516, 693» → «Neuhäuser et al. 2022» (va al crédito del pie) */
export const shortRef = (r) => (r ? String(r).split(",")[0].trim() : "");

/** La masa, corta, para la fila del título («masa ≈ 14–19 M☉, publicada»). null si no aplica. */
export function lifeMassText(plan, t, lang) {
  const lt = LIFE[lang] || LIFE.es;
  if (plan.kind === "sun") return t.pcLifeMassSun;
  if (plan.massKind === "curated") return t.pcLifeMass(lt.mass(plan.mass));
  if (plan.massKind === "estimated") return t.pcLifeMassEst(lt.mass(plan.mass));
  if (plan.stage && plan.stage !== "wd") return t.pcLifeMassNone;
  return null;
}

/**
 * Mide y coloca el bloque «Su vida» (función pura). Devuelve
 * { h, head, nodes:[{x, label, here, past}], here, fate, notes:[…], geo, truncated }.
 * * Las etapas van en UNA línea si caben todas así; si no, en dos (tres solo para un nombre muy largo).
 */
export function layoutLife(measureAt, plan, t, lang, { w }) {
  const lt = LIFE[lang] || LIFE.es;
  const inner = w;
  const head = layoutHead(measureAt, t.pcLifeTitle, lifeMassText(plan, t, lang), inner);
  // nodos repartidos a lo ancho: cada rótulo ocupa su tramo y nunca sale del bloque
  const n = plan.path.length, seg = inner / n;
  const fitNode = (maxLines) => plan.path.map((s, i) => {
    const font = i === plan.here ? SB_FONTS.strong : SB_FONTS.text;
    const label = fitText(measureAt(font), lt.stage[s] || s, { max: SB.text, min: SB.text, maxW: seg - 12, maxLines });
    return { key: s, x: seg * (i + 0.5), label, here: i === plan.here, past: plan.here >= 0 && i < plan.here };
  });
  let nodes = fitNode(1);
  for (let k = 2; k <= 3 && nodes.some((nd) => nd.label.truncated); k++) nodes = fitNode(k);
  const fk = fateKey(plan);
  const fate = fk && t.pcFate[fk] ? fitText(measureAt(SB_FONTS.text), t.pcFate[fk], { max: SB.text, min: SB.text, maxW: inner, maxLines: 3 }) : null;
  // avisos de incertidumbre: en una línea discreta (dos solo si no cabe)
  const notes = [];
  if (plan.near && plan.fate !== "nsbh" && plan.fate !== "border") notes.push(fitText(measureAt(SB_FONTS.text), lt.near, { max: SB.text, min: SB.text, maxW: inner, maxLines: 2 }));
  if (plan.assumed) notes.push(fitText(measureAt(SB_FONTS.text), t.pcLifeAssumed, { max: SB.text, min: SB.text, maxW: inner, maxLines: 2 }));
  const hereW = measureAt(SB_FONTS.strong)(SB.text)(t.pcLifeNow);
  const geo = {};
  let y = 0;
  geo.head = y; y += head.h + SB.headGap + 4;
  // la etapa actual se marca con una píldora dorada «HOY» sobre la propia línea
  geo.node = y + SB.nodeRow / 2; y += SB.nodeRow;
  geo.labels = y + 8; y += 8 + Math.max(...nodes.map((nd) => linesH(nd.label, 1.2)));
  if (fate) { geo.fate = y + 16; y += 16 + linesH(fate); }
  geo.notes = [];
  for (const nt of notes) { geo.notes.push(y + 8); y += 8 + linesH(nt); }
  const truncated = [head, fate, ...notes, ...nodes.map((nd) => nd.label)].some((f) => f && f.truncated);
  return { h: y, head, nodes, here: plan.here, fate, notes, geo, inner, hereW, truncated };
}

export function drawLife(ctx, L, t, x, y, w, put) {
  const x0 = x;
  drawHead(ctx, L.head, x0, y + L.geo.head, "rgba(226,230,246,0.86)", put, "life");
  const ny = y + L.geo.node, first = x + L.nodes[0].x, last = x + L.nodes[L.nodes.length - 1].x;
  // la línea: recorrida (hasta HOY) continua; lo que falta, punteada
  const hereX = L.here >= 0 ? x + L.nodes[L.here].x : first;
  ctx.lineWidth = 3; ctx.lineCap = "round";
  if (L.here > 0) { ctx.strokeStyle = "rgba(201,184,255,0.85)"; ctx.beginPath(); ctx.moveTo(first, ny); ctx.lineTo(hereX, ny); ctx.stroke(); }
  ctx.save(); ctx.setLineDash([8, 9]); ctx.strokeStyle = "rgba(201,184,255,0.5)"; ctx.beginPath(); ctx.moveTo(hereX, ny); ctx.lineTo(last, ny); ctx.stroke(); ctx.restore();
  for (const nd of L.nodes) {
    const cx = x + nd.x;
    if (nd.here) {
      // píldora «HOY», centrada en su nodo y siempre dentro del bloque
      const pw = L.hereW + 30, ph = 36;
      const px = Math.max(x0, Math.min(x + w - pw, cx - pw / 2));
      const g = ctx.createRadialGradient(px + pw / 2, ny, 0, px + pw / 2, ny, pw * 0.8);
      g.addColorStop(0, "rgba(242,198,109,0.45)"); g.addColorStop(1, "rgba(242,198,109,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px + pw / 2, ny, pw * 0.8, 0, TAU); ctx.fill();
      roundRect(ctx, px, ny - ph / 2, pw, ph, ph / 2); ctx.fillStyle = "#f2c66d"; ctx.fill();
      ctx.font = SB_FONTS.strong(SB.text); ctx.fillStyle = "#1a1306"; ctx.textBaseline = "middle";
      ctx.fillText(t.pcLifeNow, px + 15, ny + 1); put(t.pcLifeNow, px + 15, ny - SB.text / 2, SB.text, "life");
      ctx.textBaseline = "top";
    } else if (nd.past) {
      ctx.fillStyle = "#c9b8ff"; ctx.beginPath(); ctx.arc(cx, ny, 9, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = "#0b0f22"; ctx.beginPath(); ctx.arc(cx, ny, 9, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(201,184,255,0.85)"; ctx.lineWidth = 2.5; ctx.stroke();
    }
    // rótulo de la etapa, centrado bajo su nodo
    const f = nd.label, font = nd.here ? SB_FONTS.strong : SB_FONTS.text;
    ctx.font = font(f.size); ctx.fillStyle = nd.here ? "#ffffff" : "rgba(226,230,246,0.78)";
    let ly = y + L.geo.labels;
    for (const ln of f.lines) {
      const lw = ctx.measureText(ln).width, lx = cx - lw / 2;
      ctx.fillText(ln, lx, ly); put(ln, lx, ly, f.size, "life");
      ly += Math.round(f.size * 1.2);
    }
  }
  if (L.fate) text(ctx, L.fate, SB_FONTS.text, "rgba(240,242,252,0.96)", x0, y + L.geo.fate, 1.24, put, "life");
  L.notes.forEach((nt, i) => text(ctx, nt, SB_FONTS.text, "rgba(246,223,166,0.82)", x0, y + L.geo.notes[i], 1.24, put, "life"));
}

/** Separador fino entre bloques (sin tarjetas): una línea que se desvanece hacia los lados. */
export function drawRule(ctx, x, y, w) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "rgba(167,139,250,0.05)"); g.addColorStop(0.5, "rgba(201,184,255,0.4)"); g.addColorStop(1, "rgba(167,139,250,0.05)");
  ctx.fillStyle = g; ctx.fillRect(x, Math.round(y), w, 2);
}

// ── utilidades de dibujo ────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
function text(ctx, f, font, color, x, y, k, put, role = "spectrum") {
  ctx.font = font(f.size); ctx.fillStyle = color;
  for (const ln of f.lines) { ctx.fillText(ln, x, y); put(ln, x, y, f.size, role); y += Math.round(f.size * k); }
}
/** Encabezado: título (lila) y su dato, en la misma fila tras un «·» o debajo. */
function drawHead(ctx, H, x, y, subColor, put, role) {
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  text(ctx, H.title, SB_FONTS.title, "#c9b8ff", x, y, 1.2, put, role);
  if (!H.sub) return;
  if (H.inline) {
    // misma línea de base aproximada: el dato (24 px) baja lo que le falta al título (28 px)
    const dy = Math.round((H.title.size - H.sub.size) * 0.8);
    ctx.font = SB_FONTS.text(H.sub.size); ctx.fillStyle = "rgba(201,184,255,0.7)"; ctx.fillText("·", x + H.dotX, y + dy);
    text(ctx, H.sub, SB_FONTS.text, subColor, x + H.subX, y + dy, 1.24, put, role);
  } else text(ctx, H.sub, SB_FONTS.text, subColor, x, y + linesH(H.title, 1.2) + 4, 1.24, put, role);
}
