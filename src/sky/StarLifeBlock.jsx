// StarLifeBlock.jsx — sección «Su vida y su final» de la ficha de una estrella y del Sol
// (ObjectSheet.jsx). Tipo y etapa según el tipo espectral del catálogo; masa publicada (tabla
// curada con referencia) o estimada por tipo espectral (solo enanas, rotulada); final esperado por
// rangos de masa; línea de tiempo con «está aquí». Datos y fuentes: starLife.js · textos: i18n-comp.js.
import { useMemo } from "react";
import Icon from "./icons.jsx";
import { lifePlan, sig1 } from "./starLife.js";
import { parseSpect } from "./starColor.js";
import { LIFE } from "./i18n-comp.js";
import "./composition.css";

export default function StarLifeBlock({ obj, lang }) {
  const t = LIFE[lang] || LIFE.es;
  const plan = useMemo(() => lifePlan(obj, obj && obj.layer === "star" ? parseSpect(obj.spect) : null),
    [obj && obj.layer, obj && obj.name, obj && obj.spect, obj && obj.mag, obj && obj.dist_ly]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!plan) return null;
  const isSun = plan.kind === "sun";
  const color = t.color[plan.letter];
  const spt = obj.spect || "";
  const typeTxt = isSun ? t.sun
    : plan.stage && color ? t.type[plan.stage](color, plan.letter)
    : plan.stage === "wd" ? t.type.wd()
    : t.type.none(spt);

  const facts = [];
  if (isSun) facts.push([t.massLabel, "1 M☉"], [t.ageLabel, t.age([4.6e9, 4.6e9], true)], [t.lifeLabel, t.life(1e10)]);
  else {
    if (plan.massKind === "curated") facts.push([t.massLabel, t.mass(plan.mass)]);
    else if (plan.massKind === "estimated") facts.push([t.massEst, t.mass(plan.mass), t.massEstHint(`${plan.letter}${plan.sub}V`)]);
    if (plan.age) facts.push([t.ageLabel, t.age(plan.age, plan.ageApprox)]);
    if (plan.stage === "ms" && plan.mass) {
      if (plan.lifetime) facts.push([t.lifeLabel, t.life(sig1(plan.lifetime)), t.lifeHint]);
      else facts.push([t.lifeLabel, t.lifeRed]);
    }
  }
  const path = plan.path || [];
  const showPn = path.includes("pn"), showSn = path.includes("sn");

  return (
    <details className="sk-comp sk-life" open key={`${obj.layer}|${obj.name}`}>
      <summary><h3>{t.lifeTitle}</h3><Icon name="down" size={16} /></summary>
      <div className="sk-comp-body">
        <p>{typeTxt}</p>
        {plan.assumed && <small className="sk-comp-hint">{t.assumed}</small>}
        {facts.length > 0 && (
          <dl className="sk-life-facts">
            {facts.map(([k, v, h]) => <div key={k}><dt>{k}</dt><dd>{v}{h && <small>{h}</small>}</dd></div>)}
          </dl>
        )}
        {!isSun && !plan.mass && plan.stage && plan.stage !== "wd" && plan.stage !== "ms" && <small className="sk-comp-hint">{t.massNone}</small>}
        {path.length > 0 && (
          <ol className="sk-tl" aria-label={t.timelineAria} style={{ "--n": path.length }}>
            {path.map((s, i) => (
              <li key={s} className={i === plan.here ? "is-here" : i < plan.here ? "is-past" : ""} aria-current={i === plan.here ? "step" : undefined}>
                <i aria-hidden="true" />
                <span>{t.stage[s]}</span>
                {i === plan.here && <em><span aria-hidden="true">{t.here}</span><span className="sk-sr">{t.hereSr}</span></em>}
              </li>
            ))}
          </ol>
        )}
        {!isSun && plan.fate && plan.stage !== "wd" && <p className="sk-comp-note">{t.fate[plan.fate === "wd" && (plan.stage === "giant" || plan.stage === "supergiant") ? "wdLate" : plan.fate]}{plan.near && plan.fate !== "nsbh" && plan.fate !== "border" ? " " + t.near : ""}</p>}
        {plan.comp && <p className="sk-comp-note">{t.comp[plan.comp]}</p>}
        {(showPn || showSn) && (
          <p className="sk-life-ex">
            {showPn && <span>{t.exPn} <a href="#sky?o=messier~M57" aria-label={t.goTo(t.m57)}>{t.m57}</a></span>}
            {showSn && <span>{t.exSn} <a href="#sky?o=messier~M1" aria-label={t.goTo(t.m1)}>{t.m1}</a></span>}
          </p>
        )}
        <small className="sk-comp-src">
          {t.refs}: {isSun ? t.refsSun : [...plan.ref, plan.massKind === "estimated" ? t.refsMs : null].filter(Boolean).join("; ")}{isSun ? "" : (plan.ref.length || plan.massKind ? "; " : "") + t.refsFate}. {path.length > 0 && !isSun ? t.edges : ""}
        </small>
      </div>
    </details>
  );
}
