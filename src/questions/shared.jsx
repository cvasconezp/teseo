// shared.jsx — piezas comunes a todos los recorridos de "Preguntas":
// etiqueta de certeza, tarjetas, deslizador accesible, fuentes, gráfico SVG
// con ejes rotulados y puntos tocables, y sincronización del estado en el hash.
import { useEffect, useId, useState } from "react";

// Etiqueta de certeza: color + forma del icono + texto (nunca solo color).
export function CertaintyIcon({ level }) {
  return (
    <svg className="q-cert__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {level === "measured" && (<><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="m4.6 8.2 2.3 2.3 4.5-4.8" fill="none" stroke="#04080F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></>)}
      {level === "estimated" && (<><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.8a6.2 6.2 0 0 0 0 12.4z" fill="currentColor" /></>)}
      {level === "unknown" && (<><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.6 2.3" /><path d="M6.2 6.4a1.9 1.9 0 1 1 2.6 1.8c-.5.3-.8.6-.8 1.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="11.6" r="0.9" fill="currentColor" /></>)}
    </svg>
  );
}
export function Certainty({ level, t, short = false, note }) {
  return (
    <span className={`q-cert q-cert--${level}`}>
      <CertaintyIcon level={level} />
      <span>{short ? t.certaintyShort[level] : t.certainty[level]}{note ? ` (${note})` : ""}</span>
    </span>
  );
}

export function Chevron() {
  return (<svg className="q-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg>);
}

// Subíndices tipográficos: "r_s" → r<sub>s</sub>, "Ω_Λ" → Ω<sub>Λ</sub>. Los textos
// se guardan en claro (así los lee bien un lector de pantalla en aria-*).
export function sub(text) {
  if (typeof text !== "string" || text.indexOf("_") < 0) return text;
  const parts = text.split(/([A-Za-zΩρΔ])_([A-Za-zΛ☉]+|\d)/g);
  const out = [];
  for (let i = 0; i < parts.length; i += 3) {
    out.push(parts[i]);
    if (i + 2 < parts.length) out.push(<span key={i} className="q-var">{parts[i + 1]}<sub>{parts[i + 2]}</sub></span>);
  }
  return out;
}

// Lista de fuentes enlazadas. `refs` es el mapa de referencias del recorrido.
export function Refs({ ids, refs, lang, t }) {
  if (!ids || !ids.length) return null;
  return (
    <ul className="q-refs" aria-label={t.sourcesLabel}>
      {ids.map(id => {
        const r = refs[id];
        return (
          <li key={id}>
            <a href={r.url} target="_blank" rel="noopener noreferrer">
              {(lang === "en" && r.citeEn) || r.cite}<span className="q-sr"> ({t.external})</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// "¿De dónde sale este número?"
export function Why({ summary, children, className = "" }) {
  return (
    <details className={`q-why ${className}`}>
      <summary>{summary}<Chevron /></summary>
      <div className="q-why__body">{children}</div>
    </details>
  );
}

export function Card({ id, title, teaser, level, levelNote, t, children, open }) {
  return (
    <details className="q-card" id={id} open={open || undefined}>
      <summary className="q-card__summary">
        <span className="q-card__text">
          <span className="q-card__title">{title}</span>
          <span className="q-card__teaser">{teaser}</span>
          <Certainty level={level} t={t} note={levelNote} />
        </span>
        <Chevron />
      </summary>
      <div className="q-card__body">{children}</div>
    </details>
  );
}

// Cabecera de un recorrido: enlace de vuelta al índice + pregunta + entradilla.
export function TourHead({ t, title, lead, indexHref, titleId = "q-title" }) {
  return (
    <header className="q-head">
      <a className="q-back" href={indexHref}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m15 6-6 6 6 6" /></svg>
        {t.allQuestions}
      </a>
      <h2 id={titleId} className="q-title">{title}</h2>
      <p className="q-lead">{lead}</p>
    </header>
  );
}

// Deslizador nativo: etiqueta visible, valor en <output> y aria-valuetext humano.
export function Slider({ label, hint, value, min, max, step, onChange, valueText, ariaText, level = "plain", children }) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`q-slide q-slide--${level}`}>
      <div className="q-slide__head">
        <label className="q-slide__label" htmlFor={id}>{sub(label)}{hint && <span className="q-slide__hint">{hint}</span>}</label>
        <output className="q-slide__value" htmlFor={id}>{sub(valueText)}</output>
      </div>
      <div className="q-slide__track">
        <input id={id} className="q-range q-range--plain" type="range" min={min} max={max} step={step} value={value}
          style={{ "--fill": `${pct}%` }} aria-valuetext={ariaText || valueText}
          onChange={e => onChange(Number(e.target.value))} />
        {children}
      </div>
    </div>
  );
}

// Marcas bajo un deslizador (posición en % del recorrido).
export function Ticks({ marks }) {
  return (
    <div className={`q-ticks ${marks.length > 1 ? "q-ticks--two" : ""}`} aria-hidden="true">
      {marks.map((m, i) => (<span key={m.label} className={`q-ticks__t ${i % 2 ? "q-ticks__t--low" : ""}`} style={{ left: `${m.pct}%` }}><i />{m.label}</span>))}
    </div>
  );
}

// Estado → hash (para compartir). Con retardo: Safari limita replaceState.
export function useHashSync(hash) {
  useEffect(() => {
    const id = setTimeout(() => {
      try { if (window.location.hash !== hash) window.history.replaceState(null, "", hash); } catch { /* no-op */ }
    }, 200);
    return () => clearTimeout(id);
  }, [hash]);
}

export function ShareRow({ hash, t }) {
  const [copied, setCopied] = useState("");
  useEffect(() => { if (!copied) return; const id = setTimeout(() => setCopied(""), 4000); return () => clearTimeout(id); }, [copied]);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
    try { window.history.replaceState(null, "", hash); } catch { /* no-op */ }
    try { await navigator.clipboard.writeText(url); setCopied("ok"); }
    catch { setCopied("fail"); }
  };
  return (
    <div className="q-share">
      <button type="button" className="btn btn--ghost" onClick={share}>{t.share}</button>
      <span className="q-share__msg" role="status">{copied === "ok" ? t.shared : copied === "fail" ? t.shareFail : ""}</span>
    </div>
  );
}

export function NextLinks({ links, lang, t }) {
  return (
    <nav className="q-next" aria-labelledby="q-next-title">
      <h3 id="q-next-title" className="q-next__title">{t.nextTitle}</h3>
      <ul>
        {links.map(l => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label[lang]}<span className="q-sr"> ({t.external})</span></a>
            <span>{l.note[lang]}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ─── Gráfico SVG ─────────────────────────────────────────────────────────────
// Sistema de coordenadas fijo (viewBox 340 × h): a 360 px de pantalla el texto
// de los ejes queda en ~11 px reales. `children` recibe las escalas sx / sy.
export const PLOT_W = 340;
export function Plot({ h = 250, x, y, xTicks, yTicks, xLabel, yLabel, fmt, xFmt, aria, children, pad = {} }) {
  const m = { l: 44, r: 10, t: 12, b: 40, ...pad };
  const sx = (v) => m.l + ((v - x[0]) / (x[1] - x[0])) * (PLOT_W - m.l - m.r);
  const sy = (v) => h - m.b - ((v - y[0]) / (y[1] - y[0])) * (h - m.t - m.b);
  const f = fmt || String, fx = xFmt || f;
  return (
    <svg className="q-plot" viewBox={`0 0 ${PLOT_W} ${h}`} role="img" aria-label={aria}>
      <g aria-hidden="true">
        {yTicks.map(v => (<g key={`y${v}`}><line x1={m.l} x2={PLOT_W - m.r} y1={sy(v)} y2={sy(v)} className="q-plot__grid" /><text x={m.l - 6} y={sy(v) + 3.5} textAnchor="end" className="q-plot__tick">{f(v)}</text></g>))}
        {xTicks.map(v => (<g key={`x${v}`}><line x1={sx(v)} x2={sx(v)} y1={h - m.b} y2={h - m.b + 4} className="q-plot__axis" /><text x={sx(v)} y={h - m.b + 15} textAnchor="middle" className="q-plot__tick">{fx(v)}</text></g>))}
        <path d={`M${m.l} ${m.t}V${h - m.b}H${PLOT_W - m.r}`} className="q-plot__axis" fill="none" />
        <text x={(m.l + PLOT_W - m.r) / 2} y={h - 6} textAnchor="middle" className="q-plot__label">{xLabel}</text>
        <text transform={`translate(11 ${(m.t + h - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="q-plot__label">{yLabel}</text>
      </g>
      {children({ sx, sy, m, h })}
    </svg>
  );
}

// Trazo a partir de puntos [x, y] ya escalados.
export const pathOf = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");

// Puntos tocables: cada uno es un botón SVG (teclado y lector de pantalla);
// el valor elegido se muestra en texto bajo el gráfico, no en un globo.
export function TapPoints({ points, selected, onSelect, r = 2.6, className = "" }) {
  return points.map((p, i) => (
    <g key={i} className={`q-pt ${className} ${selected === i ? "is-on" : ""}`} role="button" tabIndex={0} aria-label={p.label} aria-pressed={selected === i}
      onClick={() => onSelect(selected === i ? null : i)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(selected === i ? null : i); } }}>
      <circle cx={p.x} cy={p.y} r="11" className="q-pt__hit" />
      {p.e > 0 && <line x1={p.x} x2={p.x} y1={p.y - p.e} y2={p.y + p.e} className="q-pt__err" />}
      <circle cx={p.x} cy={p.y} r={selected === i ? r + 2 : r} className="q-pt__dot" />
    </g>
  ));
}

// Leyenda: muestra (línea, puntos, rayas) + texto.
export function Legend({ items }) {
  return (
    <ul className="q-leg">
      {items.map(it => (
        <li key={it.label}>
          <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true" focusable="false">
            {it.kind === "dot"
              ? <circle cx="13" cy="6" r="3.2" fill={it.color} />
              : <line x1="1" x2="25" y1="6" y2="6" stroke={it.color} strokeWidth="2.4" strokeDasharray={it.dash || undefined} strokeLinecap="round" />}
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  );
}
