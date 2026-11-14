// Spectrum.jsx — espectro ESQUEMÁTICO en SVG: curva de cuerpo negro de Planck a una temperatura,
// tira con los colores del visible (380–750 nm) y líneas de absorción típicas de una clase espectral.
// Reutilizable (ficha del Cielo, recorridos de Preguntas…). Sin dependencias: cálculo en composition.js,
// textos en i18n-comp.js. Bajo la capa de visión nocturna se tiñe de rojo como todo lo demás.
//
// Props
//   temp        temperatura efectiva en K (obligatoria; sin ella no se dibuja nada)
//   cls         "O" | "B" | "A" | "F" | "G" | "K" | "M" | "sun"  → líneas por defecto de esa clase
//               ("sun": líneas de Fraunhofer con su letra)
//   lines       opcional: lista de líneas que sustituye a las de la clase
//               [{ nm, depth (0–1), name?, fr?, band?, group?, strength? }]
//   width       opcional: ancho en px; sin él el SVG ocupa el 100 % del contenedor (viewBox de 340)
//   lang        "es" | "en"
//   lowerBound  la temperatura es un mínimo (estrellas muy calientes por B−V): lo dice el texto
//   caption     true (por defecto) añade el pie con la advertencia «esquemático»; false = solo el SVG
//   legend      true (por defecto) añade la leyenda de grupos de líneas con su intensidad
import { useId, useMemo } from "react";
import { spectrumCurve, linesForClass, fraunhoferLines, wavelengthHex, wienPeak, peakZone, VIS_MIN, VIS_MAX } from "./composition.js";
import { COMP } from "./i18n-comp.js";

const H = 150;                 // alto del viewBox
const PAD_L = 8, PAD_R = 8;
const LABEL_Y = [10, 21];      // dos filas de rótulos de líneas
const PLOT_TOP = 28, PLOT_BOT = 98;
const STRIP_TOP = 102, STRIP_H = 12;
const TICK_Y = 128;
const TICKS = [400, 450, 500, 550, 600, 650, 700, 750];
const CHAR_W = 5.4;            // ancho medio estimado de un carácter a 9 px

/** Rótulos agrupados: un rótulo por doblete/triplete muy próximo. */
function labelsFor(lines, useFr) {
  const out = [];
  const seen = new Set();
  for (const l of lines) {
    const g = l.group || l.key || l.nm;
    let text, nm;
    if (useFr && l.fr) {
      // dobletes de Fraunhofer: D₁+D₂ → «D», b₁/b₂/b₄ → «b»; el resto con su letra
      const base = l.fr.replace(/[₀-₉]/g, "");
      if ((base === "D" || base === "b") && seen.has(base)) continue;
      if (base === "D" || base === "b") seen.add(base);
      text = base === "D" || base === "b" ? base : l.fr;
      nm = base === "D" ? 589.3 : base === "b" ? 517.5 : l.nm;
    } else {
      const key = g === "balmer" || g === "hei" || g === "tio" ? (l.key || l.nm) : g;
      if (seen.has(key)) continue;
      seen.add(key);
      if (g === "balmer") text = l.name;
      else if (g === "cahk") { text = "K H"; nm = 395.1; }
      else if (g === "nad") { text = "Na"; nm = 589.3; }
      else if (g === "mgb") { text = "Mg"; nm = 517.5; }
      else if (g === "hei") text = "He I";
      else if (g === "heii") text = "He II";
      else if (g === "tio") text = "TiO";
      else text = l.name || "";
      if (nm == null) nm = l.nm;
    }
    out.push({ text, nm });
  }
  return out.sort((a, b) => a.nm - b.nm);
}

export default function Spectrum({ temp, cls = "G", lines, width, lang = "es", lowerBound = false, caption = true, legend = true }) {
  const t = COMP[lang] || COMP.es;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const W = width > 0 ? width : 340;
  const isSun = cls === "sun";
  const drawn = useMemo(() => (lines || (isSun ? fraunhoferLines() : linesForClass(cls))), [lines, cls, isSun]);
  const curve = useMemo(() => (temp > 0 ? spectrumCurve(temp, drawn, { step: 1 }) : []), [temp, drawn]);
  if (!(temp > 0)) return null;

  const x = (nm) => PAD_L + ((nm - VIS_MIN) / (VIS_MAX - VIS_MIN)) * (W - PAD_L - PAD_R);
  const y = (v) => PLOT_BOT - v * (PLOT_BOT - PLOT_TOP);
  const pathLine = curve.map((p, i) => `${i ? "L" : "M"}${x(p.nm).toFixed(1)},${y(p.y).toFixed(1)}`).join("");
  const pathArea = `${pathLine}L${x(VIS_MAX).toFixed(1)},${PLOT_BOT}L${x(VIS_MIN).toFixed(1)},${PLOT_BOT}Z`;

  const peak = wienPeak(temp), zone = peakZone(temp);
  const peakTxt = zone === "visible" ? t.specPeak(peak) : zone === "uv" ? t.specPeakUv(peak) : t.specPeakIr(peak);

  // rótulos en dos filas, sin solaparse (si no caben en ninguna, la línea se dibuja sin rótulo)
  const useFr = isSun || drawn.some((l) => l.fr && !l.group);
  const placed = [];
  const rowEnd = [-Infinity, -Infinity];
  for (const lb of labelsFor(drawn, useFr)) {
    const cx = x(lb.nm), w = lb.text.length * CHAR_W;
    const left = Math.max(PAD_L, Math.min(W - PAD_R - w, cx - w / 2));
    const row = left > rowEnd[0] + 3 ? 0 : left > rowEnd[1] + 3 ? 1 : -1;
    if (row < 0) continue;
    rowEnd[row] = left + w;
    placed.push({ ...lb, cx, tx: left + w / 2, row });
  }

  // grupos para la leyenda y el texto accesible
  const groups = [];
  for (const l of drawn) {
    const g = l.group || "other";
    let e = groups.find((q) => q.g === g);
    if (!e) { e = { g, strength: l.strength || 0, lines: [] }; groups.push(e); }
    e.lines.push(l);
  }
  const lineName = (l) => (isSun && l.fr ? `${l.fr} (${l.name})` : l.name || "");
  const linesTxt = drawn.length
    ? groups.map((e) => e.lines.map((l) => t.specAriaLine(lineName(l), l.nm, "")).join(", ") + (e.strength && !isSun ? ` (${t.specStrength[e.strength]})` : "")).join("; ")
    : "";
  const aria = t.specAria(temp, lowerBound, t.specAriaPeak(peak, zone), linesTxt, isSun ? "sun" : cls);

  const stops = [];
  for (let nm = VIS_MIN; nm <= VIS_MAX; nm += 10) stops.push(nm);

  const svg = (
    <svg className="sk-spec-svg" viewBox={`0 0 ${W} ${H}`} width={width > 0 ? width : "100%"} height={width > 0 ? H : undefined}
      role="img" aria-label={aria} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`rb${uid}`} x1={x(VIS_MIN)} x2={x(VIS_MAX)} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          {stops.map((nm) => <stop key={nm} offset={(nm - VIS_MIN) / (VIS_MAX - VIS_MIN)} stopColor={wavelengthHex(nm)} />)}
        </linearGradient>
      </defs>
      {/* área bajo la curva teñida con el visible, muy suave, y la curva */}
      <path d={pathArea} fill={`url(#rb${uid})`} opacity="0.22" />
      <line x1={x(VIS_MIN)} x2={x(VIS_MAX)} y1={PLOT_BOT} y2={PLOT_BOT} className="sk-spec-base" />
      {/* guías de las líneas rotuladas */}
      {placed.map((p) => (
        <line key={`g${p.text}${p.nm}`} x1={p.cx} x2={p.cx} y1={LABEL_Y[p.row] + 3} y2={STRIP_TOP} className="sk-spec-guide" />
      ))}
      <path d={pathLine} className="sk-spec-curve" />
      {/* pico (Wien): en el visible, línea vertical; fuera, flecha hacia ese lado. El rótulo va en la
          fila inferior, a la izquierda, para que nunca lo tape la curva */}
      <g className="sk-spec-peak">
        {zone === "visible" && <line x1={x(peak)} x2={x(peak)} y1={PLOT_TOP - 2} y2={PLOT_BOT} />}
        {zone === "visible" && <path d={`M${x(peak) - 3},${PLOT_TOP - 4}h6l-3,4z`} className="is-tip" />}
        <text x={PAD_L} y={H - 6} textAnchor="start">{zone === "uv" ? "← " : ""}{peakTxt}{zone === "ir" ? " →" : ""}</text>
      </g>
      {/* tira del visible con las líneas de absorción */}
      <rect x={x(VIS_MIN)} y={STRIP_TOP} width={x(VIS_MAX) - x(VIS_MIN)} height={STRIP_H} rx="2" fill={`url(#rb${uid})`} />
      {drawn.map((l) => l.band ? (
        <rect key={`a${l.nm}`} x={x(l.nm)} y={STRIP_TOP} width={Math.max(2, x(l.nm + 14) - x(l.nm))} height={STRIP_H}
          className="sk-spec-abs" style={{ opacity: Math.min(0.85, 0.25 + l.depth) }} />
      ) : (
        <rect key={`a${l.nm}`} x={x(l.nm) - (l.depth > 0.5 ? 1 : 0.6)} y={STRIP_TOP} width={l.depth > 0.5 ? 2 : 1.2} height={STRIP_H}
          className="sk-spec-abs" style={{ opacity: Math.min(1, 0.35 + l.depth) }} />
      ))}
      {placed.map((p) => (
        <text key={`t${p.text}${p.nm}`} x={p.tx} y={LABEL_Y[p.row]} textAnchor="middle" className="sk-spec-lbl">{p.text}</text>
      ))}
      {TICKS.map((nm) => (
        <g key={nm} className="sk-spec-tick">
          <line x1={x(nm)} x2={x(nm)} y1={STRIP_TOP + STRIP_H} y2={STRIP_TOP + STRIP_H + 3} />
          {nm % 100 === 0 && <text x={x(nm)} y={TICK_Y} textAnchor="middle">{nm}</text>}
        </g>
      ))}
      <text x={W - PAD_R} y={H - 6} textAnchor="end" className="sk-spec-axis">{t.specAxis}</text>
    </svg>
  );
  if (!caption && !legend) return svg;
  return (
    <figure className="sk-spec">
      {svg}
      {legend && groups.length > 0 && !isSun && (
        <ul className="sk-spec-legend" aria-label={t.specLegend}>
          {groups.map((e) => (
            <li key={e.g} data-s={e.strength}><i aria-hidden="true" />{t.specGroup[e.g] || e.g}{e.strength ? <small>{t.specStrength[e.strength]}</small> : null}</li>
          ))}
        </ul>
      )}
      {caption && (
        <figcaption>
          {isSun ? t.specCaptionSun(temp) : drawn.length ? t.specCaption(temp, cls, lowerBound) : t.specCaption(temp, cls, lowerBound) + " " + t.specNoLines}
        </figcaption>
      )}
    </figure>
  );
}
