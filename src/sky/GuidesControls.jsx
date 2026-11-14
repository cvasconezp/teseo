// GuidesControls.jsx — grupo "Líneas guía" para el panel Capas → Vista de la vista Cielo.
// Componente de presentación: el estado vive en Constellations.jsx (o en useGuides(), abajo).
// Textos: i18n-guides.js (GUIDES); colores de las muestras: guides.js (GUIDE_COLORS).
//
// Props de <GuidesControls>:
//   lang             "es" | "en"
//   value            { ecliptic, equator, galactic, eqGrid, altAzGrid, meridian, poles } (booleanos)
//   onToggle(k, on)  al pulsar un interruptor
//   localAvailable   false si no hay "Mi cielo" con lugar: la cuadrícula horizontal y el meridiano
//                    se desactivan y explican por qué (los polos siguen; el cenit solo se dibuja con lugar)
//   sources          true (por defecto) para mostrar la nota de fuentes y supuestos al pie
import { useCallback, useEffect, useState } from "react";
import { GUIDES } from "./i18n-guides.js";
import { GUIDE_KEYS, LOCAL_ONLY, DEFAULT_GUIDES, GUIDE_COLORS, sanitizeGuides } from "./guides.js";
import "./guides.css";

export function GuidesControls({ lang = "es", value = DEFAULT_GUIDES, onToggle, localAvailable = false, sources = true }) {
  const tg = GUIDES[lang] || GUIDES.es;
  return (
    <div className="sk-guides" role="group" aria-labelledby="sk-guides-title">
      <h4 id="sk-guides-title" className="sk-guides-title">{tg.guidesTitle}</h4>
      <p className="sk-guides-lead">{tg.guidesLead}</p>
      {GUIDE_KEYS.map((k) => {
        const needsPlace = LOCAL_ONLY.has(k) && !localAvailable;
        const on = !!value[k] && !needsPlace;
        const descId = `sk-guide-desc-${k}`;
        return (
          <div className={`sk-layer sk-guide-row${needsPlace ? " is-unavailable" : ""}`} key={k}>
            <button type="button" role="switch" aria-checked={on} disabled={needsPlace} aria-describedby={descId}
              className="sk-layer-main" onClick={() => onToggle && onToggle(k, !value[k])}>
              <i className={`sk-guide-swatch sk-guide-swatch-${k}`} style={{ "--c": GUIDE_COLORS[k] }} aria-hidden="true" />
              <span className="sk-layer-txt">
                <b>{tg.guideName[k]}</b>
                <small id={descId}>{tg.guideDesc[k]}{needsPlace && <span className="sk-guide-need"> {tg.needPlace}</span>}</small>
              </span>
              <span className="sk-count" />
              <i className="sk-switch" />
            </button>
          </div>
        );
      })}
      {sources && <p className="sk-guides-fine">{tg.assumeGuides}<br />{tg.srcGuides}</p>}
    </div>
  );
}

// Estado de las guías con memoria en localStorage (opcional; el integrador puede usar el suyo).
//   const [guides, toggleGuide, setGuides] = useGuides();
export const GUIDES_STORAGE_KEY = "teseo.sky.guides.v1";
export function useGuides(storageKey = GUIDES_STORAGE_KEY) {
  const [value, setValue] = useState(() => {
    try { return sanitizeGuides(JSON.parse(localStorage.getItem(storageKey) || "null")); } catch { return { ...DEFAULT_GUIDES }; }
  });
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* modo privado: sin memoria */ } }, [value, storageKey]);
  const toggle = useCallback((k, on) => setValue((v) => ({ ...v, [k]: on === undefined ? !v[k] : !!on })), []);
  return [value, toggle, setValue];
}

export default GuidesControls;
