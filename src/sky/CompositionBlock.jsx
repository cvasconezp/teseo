// CompositionBlock.jsx — sección «¿De qué está hecho?» de la ficha (ObjectSheet.jsx).
// Planetas y Luna: atmósfera o exosfera (NASA). Sol: fotosfera por masa (Asplund et al. 2009) y
// espectro con líneas de Fraunhofer. Estrellas: composición típica (valores del Sol, rotulados) y
// espectro esquemático de su clase. Cualquier otro objeto: nada (devuelve null).
// Datos y fuentes: composition.js · textos: i18n-comp.js · estilos: composition.css.
import { useMemo } from "react";
import Icon from "./icons.jsx";
import Spectrum from "./Spectrum.jsx";
import { compositionPlan } from "./composition.js";
import { starTemperature } from "./starColor.js";
import { COMP } from "./i18n-comp.js";
import "./composition.css";

/** Barras horizontales de porcentaje: [[clave, %], …]. */
export function Bars({ rows, t, label }) {
  return (
    <ul className="sk-bars" aria-label={label}>
      {rows.map(([k, v]) => (
        <li key={k} data-gas={k}>
          <span className="sk-bars-name">{t.gas[k] || k}</span>
          <span className="sk-bars-val">{t.pct(v)}</span>
          <span className="sk-bars-track" aria-hidden="true"><i style={{ width: `max(3px, ${Math.min(100, v)}%)` }} /></span>
        </li>
      ))}
    </ul>
  );
}

export default function CompositionBlock({ obj, lang }) {
  const t = COMP[lang] || COMP.es;
  const plan = useMemo(() => compositionPlan(obj, obj && obj.layer === "star" ? starTemperature(obj.bv) : null),
    [obj && obj.layer, obj && obj.name, obj && obj.bv, obj && obj.spect]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!plan) return null;
  const key = `${obj.layer}|${obj.name}`;

  let body;
  if (plan.kind === "planet") {
    const a = plan.atm;
    body = a.kind === "exosphere" ? (
      <>
        <h4>{t.compExo}</h4>
        <p>{t.compExoText(t.list(a.species.map((s) => t.species[s] || s)))}</p>
        <p className="sk-comp-note">{t.compNote[a.note]}</p>
        <small className="sk-comp-src">{t.compSrcLabel}: {t.compSrc[a.src]}</small>
      </>
    ) : (
      <>
        <h4>{a.dry ? t.compAtmDry : t.compAtm}</h4>
        <Bars rows={a.gases} t={t} label={a.dry ? t.compAtmDry : t.compAtm} />
        <p className="sk-comp-note">{t.compNote[a.note]}</p>
        <small className="sk-comp-src">{t.compSrcLabel}: {t.compSrc[a.src]}{a.unc ? ` · ${t.compUnc(a.unc)}` : ""}</small>
      </>
    );
  } else if (plan.kind === "sun") {
    body = (
      <>
        <h4>{t.compSunMass}</h4>
        <Bars rows={plan.mass} t={t} label={t.compSunMass} />
        <p className="sk-comp-note">{t.compNote.sun}</p>
        <Spectrum temp={plan.temp} cls="sun" lang={lang} legend={false} />
        <p className="sk-comp-finger">{t.compFinger}</p>
        <small className="sk-comp-src">{t.compSrcLabel}: {t.compSrcAsplund}. {t.compSrcSun} {t.compSrcLines}</small>
      </>
    );
  } else {
    body = (
      <>
        <p>{t.compStarLead}</p>
        <h4>{t.compStarMass}</h4>
        <Bars rows={plan.mass} t={t} label={t.compStarMass} />
        <small className="sk-comp-hint">{t.compStarSunVals}</small>
        {plan.mismatch && <small className="sk-comp-hint">{t.specMismatch}</small>}
        {plan.temp != null && (
          <>
            <Spectrum temp={plan.temp} cls={plan.letter} lang={lang} lowerBound={plan.lowerBound} />
            <p className="sk-comp-finger">{t.compFinger}</p>
          </>
        )}
        <small className="sk-comp-src">
          {t.compSrcLabel}: {t.compSrcAsplund}.{plan.temp != null ? ` ${t.compSrcTemp} ${t.compSrcLines}` : ""}
        </small>
      </>
    );
  }
  return (
    <details className="sk-comp" open key={key}>
      <summary><h3>{t.compTitle}</h3><Icon name="down" size={16} /></summary>
      <div className="sk-comp-body">{body}</div>
    </details>
  );
}
