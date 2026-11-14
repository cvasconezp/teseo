// IssSheet.jsx — ficha breve de la Estación Espacial Internacional al tocarla en el Cielo.
// Reutiliza el armazón de las fichas (SheetShell de ObjectSheet.jsx) y sus estilos (.sk-facts, .sk-note,
// .sk-actions…). No usa ObjectSheet: la ISS no tiene dirección ecuatorial fija (cambia cada segundo) ni
// distancia en años luz, y sus datos son los de la propia respuesta de /api/iss/passes:
//   · la órbita (altura, velocidad, período, inclinación) sale de `elements` (TLE de CelesTrak) con
//     orbitFacts(); sin elementos, valores típicos rotulados como tales;
//   · la pasada (inicio, culminación y fin con su dirección) y si se ve a simple vista, de la pasada.
import Icon from "./icons.jsx";
import { SheetShell } from "./ObjectSheet.jsx";
import { ISS } from "./i18n-iss.js";
import { compassLabel, fmtMag, formatClock, formatDay, hiddenReason, orbitFacts } from "./issPasses.js";

const nf = (lang, v, d = 0) => Number(v).toLocaleString(lang === "es" ? "es" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function IssSheet({ t, lang = "es", pass, data, onClose, onCenter, onRemove, timeZone }) {
  const x = ISS[lang] || ISS.es;
  const o = { lang, timeZone, seconds: true };
  const f = orbitFacts(data && data.elements);
  const why = hiddenReason(pass);
  const mag = pass ? fmtMag(pass.mag, lang) : null;
  const row = (label, pt) => pt && (
    <div key={label}>
      <dt>{label}</dt>
      <dd>{formatClock(Date.parse(pt.t), o)}<small>{x.issRowDir(Math.round(pt.alt), compassLabel(pt.az, lang))}</small></dd>
    </div>
  );
  return (
    <SheetShell t={t} title={x.issSheetTitle} subtitle={x.issSheetType} badge={pass ? `${formatDay(Date.parse(pass.start.t), o)}` : null}
      resetKey={pass ? pass.start.t : "iss"} onClose={onClose} className="is-iss">
      {why && <p className="sk-note iss-sheet-warn" role="note"><Icon name={why === "sun_up" ? "sun" : "moon"} size={17} />{x.issHiddenWhy[why]}</p>}
      <dl className="sk-facts is-two">
        <div><dt>{x.issFAlt}</dt><dd>≈ {nf(lang, Math.round(f.altKm / 5) * 5)} km{f.perigeeKm != null && <small>{x.issAltHint(nf(lang, f.perigeeKm), nf(lang, f.apogeeKm))}</small>}</dd></div>
        <div><dt>{x.issFSpeed}</dt><dd>≈ {nf(lang, f.speedKms, 2)} km/s<small>{x.issSpeedHint(nf(lang, Math.round(f.speedKms * 3600 / 100) * 100))}</small></dd></div>
        <div><dt>{x.issFPeriod}</dt><dd>≈ {nf(lang, f.periodMin, 1)} min<small>{x.issPeriodHint(nf(lang, 1440 / f.periodMin, 1))}</small></dd></div>
        <div><dt>{x.issFIncl}</dt><dd>{nf(lang, f.inclDeg, 1)}°<small>{x.issInclHint}</small></dd></div>
      </dl>
      {!f.fromElements && <p className="sk-note">{x.issTypical}</p>}
      {pass && (
        <section className="iss-sheet-pass">
          <h3>{x.issPassTitle}</h3>
          <dl className="sk-facts">
            {row(x.issRowStart, pass.start)}
            {row(x.issRowPeak, pass.max)}
            {row(x.issRowEnd, pass.end)}
          </dl>
          {pass.visible && pass.visible_from && pass.visible_to && (
            <p className="sk-note">{x.issVisibleYes(formatClock(Date.parse(pass.visible_from.t), o), formatClock(Date.parse(pass.visible_to.t), o))}{mag ? ` ${x.issBright(mag)}` : ""}</p>
          )}
        </section>
      )}
      <div className="sk-actions">
        <button type="button" className="sk-btn" onClick={onCenter}><Icon name="target" size={17} />{x.issCenter}</button>
        <button type="button" className="sk-btn" onClick={onRemove}><Icon name="close" size={17} />{x.issRemove}</button>
      </div>
      <p className="iss-sheet-src">{x.issSheetSource} {x.issSheetApprox}</p>
    </SheetShell>
  );
}
