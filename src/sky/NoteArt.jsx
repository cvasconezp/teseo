// Esquemas explicativos de las fichas: comparación de tamaño de un exoplaneta y
// dibujos de los patrones del cielo. Son REPRESENTACIONES y la ficha las rotula así.
import { useEffect, useRef, useState } from "react";
import { exoLook, JUPITER_RE } from "./explain.js";
import { textureUrl } from "./bodies.js";

// puntos deterministas (el dibujo no cambia entre cargas)
function dots(seed, n, fn) {
  let s = seed >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out = [];
  for (let i = 0; i < n * 40 && out.length < n; i++) { const p = fn(r); if (p) out.push(p); }
  return out;
}
const inOval = (x, y) => (x * x) / (92 * 92) + (y * y) / (46 * 46) <= 1;

/** Dibujo de un patrón del cielo. `id`: kepler | pulsarPlane | avoidance | globulars. */
export function NoteArt({ id }) {
  if (id === "kepler") {
    // plano focal de Kepler: 5 × 5 módulos sin las cuatro esquinas = 21, cada uno con 2 CCD
    const cells = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      if ((r === 0 || r === 4) && (c === 0 || c === 4)) continue;
      cells.push(<g key={`${r}-${c}`} transform={`translate(${c * 22 - 55},${r * 22 - 55})`}>
        <rect x="1.5" y="1.5" width="9" height="19" rx="1" /><rect x="11.5" y="1.5" width="9" height="19" rx="1" />
      </g>);
    }
    return (
      <svg className="sk-noteart art-kepler" viewBox="-100 -75 200 150" aria-hidden="true">
        <g transform="rotate(13)">{cells}</g>
      </svg>
    );
  }
  if (id === "globulars") {
    const pts = dots(11, 46, (r) => { const a = r() * Math.PI * 2, d = Math.pow(r(), 1.6) * 44; return { x: -22 + Math.cos(a) * d, y: Math.sin(a) * d * 0.9 }; });
    return (
      <svg className="sk-noteart art-globulars" viewBox="-100 -60 200 120" aria-hidden="true">
        <ellipse className="disc" cx="-22" cy="0" rx="74" ry="7" />
        <ellipse className="bulge" cx="-22" cy="0" rx="13" ry="10" />
        {pts.map((p, i) => <circle key={i} className="dot" cx={p.x} cy={p.y} r="1.7" />)}
        <circle className="sun" cx="34" cy="0" r="3" />
      </svg>
    );
  }
  // mapa de todo el cielo (óvalo) con el plano de la Vía Láctea como franja central
  const plane = id === "pulsarPlane";
  const pts = dots(plane ? 5 : 9, plane ? 90 : 110, (r) => {
    const x = (r() * 2 - 1) * 92, y = plane ? (r() + r() + r() - 1.5) * (r() < 0.78 ? 7 : 40) : (r() * 2 - 1) * 46;
    if (!inOval(x, y)) return null;
    if (!plane && Math.abs(y) < 8) return null;
    return { x, y };
  });
  return (
    <svg className={`sk-noteart art-${id}`} viewBox="-100 -60 200 120" aria-hidden="true">
      <ellipse className="sky" cx="0" cy="0" rx="92" ry="46" />
      <rect className="band" x="-92" y="-7" width="184" height="14" rx="7" />
      {pts.map((p, i) => <circle key={i} className="dot" cx={p.x} cy={p.y} r="1.5" />)}
    </svg>
  );
}

/**
 * Comparación de tamaño A ESCALA REAL: la Tierra (y Júpiter si el planeta es grande)
 * con su textura real, junto a una esfera que representa al exoplaneta. El radio de
 * la esfera sale del dato real; su tono, de la temperatura de equilibrio si existe.
 */
export function ExoCompare({ obj, t }) {
  const hostRef = useRef(null);
  const [box, setBox] = useState({ w: 320, h: 150 });
  useEffect(() => {
    const el = hostRef.current; if (!el) return;
    const read = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }));
    read();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); };
  }, []);
  const look = exoLook(obj.rade, obj.eqt_k);
  const sphere = {
    background: `radial-gradient(circle at 34% 30%, ${look.light} 0%, ${look.base} 46%, ${look.dark} 100%)`,
    boxShadow: look.glow ? `0 0 22px ${look.base}` : undefined,
  };
  if (!(obj.rade > 0)) {
    return (
      <div className="sk-exo" ref={hostRef}>
        <figure className="sk-exo-body"><div className="sk-exo-disc is-unknown" style={{ width: 84, height: 84 }}><span>?</span></div></figure>
      </div>
    );
  }
  const withJup = obj.rade >= 4;
  const refs = [{ key: "earth", r: 1, label: t.earth }];
  if (withJup) refs.push({ key: "jupiter", r: JUPITER_RE, label: t.jupiter });
  const gap = 18, labelH = 34;
  const scaleFor = (list) => {
    const maxR = Math.max(obj.rade, ...list.map((x) => x.r)), sumR = obj.rade + list.reduce((a, x) => a + x.r, 0);
    return Math.min((box.h - labelH - 14) / (2 * maxR), (box.w - 28 - gap * list.length) / (2 * sumR));
  };
  let k = scaleFor(refs);
  // si la Tierra quedaría en menos de 3 px (planeta enorme), la referencia es solo Júpiter
  let shown = refs;
  if (withJup && 2 * k < 3) { shown = refs.filter((x) => x.key !== "earth"); k = scaleFor(shown); }
  const px = (r) => Math.max(2, Math.round(2 * r * k));
  return (
    <div className="sk-exo" ref={hostRef} style={{ gap }}>
      {shown.map((x) => (
        <figure className="sk-exo-body" key={x.key}>
          <div className={`sk-exo-disc is-${x.key}`} style={{ width: px(x.r), height: px(x.r), backgroundImage: `url(${textureUrl(x.key)})` }} />
          <figcaption>{x.label}</figcaption>
        </figure>
      ))}
      <figure className="sk-exo-body is-target">
        <div className={`sk-exo-disc is-exo${look.banded ? " is-banded" : ""}`} style={{ width: px(obj.rade), height: px(obj.rade), ...sphere }} />
        <figcaption>{obj.name}<small>{t.exoRep}</small></figcaption>
      </figure>
    </div>
  );
}
