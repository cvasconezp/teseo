// AtmosphereControls.jsx — controles de atmósfera y contaminación lumínica de la vista Cielo.
// Componentes de presentación (el estado vive en Constellations.jsx). Textos: i18n-atm.js (ATM) y
// lightPollution.js (BORTLE_TEXT); cálculos: atmosphere.js.
//
// Props de <AtmosphereControls>:
//   lang            "es" | "en"
//   on, onToggle    interruptor "Atmósfera"
//   available       false si no hay lugar (sin "Mi cielo" no hay Sol ni horizonte): el interruptor se desactiva
//   bortle, onBortle  clase 1–9 (onBortle(n) al mover el deslizador o elegir en "Como mi cielo real")
//   state           resultado de skyState(...) o null (sin él se muestra solo la referencia de Bortle)
//   mags            magnitudes del catálogo (Float32Array o array) para "≈ N estrellas"
//   visibleNow      opcional: nº de estrellas que se ven ahora sobre el horizonte (countVisibleNow)
//   catalogLimit    magnitud hasta la que llega el catálogo (por defecto 6,0: HYG recortado a m ≤ 6)
//   elevation       opcional: { m: metros | null } altitud del lugar usada en la extinción (null = sin dato)
//   deepNote        opcional: texto sobre los objetos de cielo profundo ocultos por la atmósfera
//   onBortleCommit  opcional: se llama con la clase al SOLTAR el deslizador (métricas)
import { useMemo, useState } from "react";
import Icon from "./icons.jsx";
import { ATM } from "./i18n-atm.js";
import { BORTLE_TEXT, BORTLE_SOURCE, GLOBE_AT_NIGHT_URL, bortleForNelm, clampBortle, nelmText } from "./lightPollution.js";
import { countBrighter, starsHidden } from "./atmosphere.js";
import "./atmosphere.css";

const CHART_MAGS = [3, 4, 5, 6, 7];

export function AtmosphereControls({ lang = "es", on, onToggle, available = true, bortle, onBortle, state, mags, visibleNow, catalogLimit = 6.0, elevation, deepNote, onBortleCommit }) {
  const ta = ATM[lang] || ATM.es, bt = BORTLE_TEXT[lang] || BORTLE_TEXT.es;
  const cls = clampBortle(bortle);
  const [realOpen, setRealOpen] = useState(false);
  const [picked, setPicked] = useState(null);   // { mag, cls } de la carta elegida
  const limit = state ? state.magLimit : null;
  const count = useMemo(() => (mags && limit != null ? countBrighter(mags, limit) : null), [mags, limit]);
  const total = mags ? mags.length : 0;
  const hidden = state && starsHidden(state);
  const pick = (m) => { const c = bortleForNelm(m); setPicked({ mag: m, cls: c }); onBortle && onBortle(c); };

  return (
    <div className="sk-atm">
      <div className="sk-layer">
        <button type="button" role="switch" aria-checked={!!on && available} disabled={!available} className="sk-layer-main" onClick={onToggle}>
          <i className="sk-dot sk-atm-dot" />
          <span className="sk-layer-txt"><b>{ta.atmLayer}</b><small>{available ? ta.atmLayerDesc : ta.atmNeedPlace}</small></span>
          <span className="sk-count">{on && available && state ? ta.skyPhaseName[state.phase] : ""}</span>
          <i className="sk-switch" />
        </button>
      </div>

      <div className="sk-atm-lp" aria-disabled={!available || !on ? "true" : undefined}>
        <div className="sk-atm-lp-head">
          <span id="sk-atm-lp-title">{ta.lpTitle}</span>
          <b>{ta.lpClass(cls, bt.name[cls])}</b>
        </div>
        <input type="range" min="1" max="9" step="1" value={cls} aria-label={ta.lpSliderAria} aria-valuetext={ta.lpValueText(cls, bt.name[cls])}
          onChange={(e) => { setPicked(null); onBortle && onBortle(Number(e.target.value)); }}
          onPointerUp={(e) => onBortleCommit && onBortleCommit(Number(e.currentTarget.value))}
          onKeyUp={(e) => onBortleCommit && /Arrow|Home|End|Page/.test(e.key) && onBortleCommit(Number(e.currentTarget.value))} />
        <div className="sk-atm-ends" aria-hidden="true"><span>{ta.lpEnds[0]}</span><span>{ta.lpEnds[1]}</span></div>
        <p className="sk-atm-desc">{bt.desc[cls]} <span className="sk-atm-where">{ta.lpWhere(bt.where[cls])}</span></p>
        <dl className="sk-atm-stats">
          {state && on && available && (
            <div><dt>{hidden ? ta.lpLimitNone : ta.lpLimitNow(limit)}</dt>
              {!hidden && count != null && <dd>{limit > catalogLimit && count >= total ? ta.lpCountAll(total) : ta.lpCount(count)}</dd>}
              {!hidden && visibleNow != null && <dd>{ta.lpCountNow(visibleNow)}</dd>}
            </div>
          )}
          <div><dt>{ta.lpLimitDark(nelmText(cls, lang))}</dt><dd className="sk-atm-fine">{ta.lpObserver}</dd></div>
          {elevation && available && <div><dt>{elevation.m != null ? ta.elevLine(elevation.m) : ta.elevNone}</dt>{elevation.preset && <dd className="sk-atm-fine">{ta.elevSrc}</dd>}</div>}
        </dl>
        {deepNote && on && available && <p className="sk-atm-fine sk-atm-deep">{deepNote}</p>}
        <button type="button" className="sk-btn wide sk-atm-real" aria-expanded={realOpen} onClick={() => setRealOpen((v) => !v)}>
          <Icon name="eye" size={17} />{ta.realSky}
        </button>
        {realOpen && (
          <div className="sk-atm-gan">
            <h4>{ta.realSkyTitle}</h4>
            <p>{ta.realSkyLead}</p>
            <ol>{ta.realSkySteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            <div className="sk-atm-pick" role="group" aria-label={ta.realSkyPick}>
              <span>{ta.realSkyPick}</span>
              <div>{CHART_MAGS.map((m) => (
                <button key={m} type="button" aria-pressed={!!picked && picked.mag === m && picked.cls === cls} onClick={() => pick(m)}>{m}</button>
              ))}</div>
            </div>
            {picked && picked.cls === cls && <p className="sk-atm-ok" role="status">{ta.realSkySet(picked.cls)}</p>}
            <p className="sk-atm-fine">{ta.realSkyCaveat}</p>
            <a className="sk-btn wide gold" href={GLOBE_AT_NIGHT_URL} target="_blank" rel="noopener noreferrer"><Icon name="link" size={16} />{ta.realSkyLink}</a>
          </div>
        )}
      </div>
      <p className="sk-atm-fine">{ta.atmApprox} {ta.atmAssume}<br />{BORTLE_SOURCE[lang] || BORTLE_SOURCE.es}</p>
    </div>
  );
}

// Aviso de día: se muestra sobre el cielo cuando la atmósfera está activa y no se ve ninguna estrella.
//   planets: nombres (ya traducidos) de planetas que aun así se verían (visibility(...).visible), opcional.
export function DayWarning({ lang = "es", onAtmOff, onNightfall, planets, onDismiss }) {
  const ta = ATM[lang] || ATM.es;
  return (
    <div className="sk-atm-day" role="status">
      <Icon name="sun" size={20} />
      <div>
        <p>{ta.dayWarn}</p>
        {planets && planets.length > 0 && <p className="sk-atm-fine">{ta.dayPlanets(planets.join(lang === "es" ? " y " : " and "), planets.length)}</p>}
        <div className="sk-atm-day-actions">
          {onNightfall && <button type="button" onClick={onNightfall}><Icon name="moon" size={15} />{ta.dayWarnNight}</button>}
          {onAtmOff && <button type="button" onClick={onAtmOff}>{ta.dayWarnOff}</button>}
        </div>
      </div>
      {onDismiss && <button type="button" className="sk-atm-day-x" onClick={onDismiss} aria-label={ta.dayHide} title={ta.dayHide}><Icon name="close" size={16} /></button>}
    </div>
  );
}

export default AtmosphereControls;
