// PeakSheet.jsx — ficha de una montaña del horizonte al tocar su nombre: altura, distancia y rumbo y, si es un
// volcán del Holoceno, sus datos del Smithsonian (Global Volcanism Program; src/sky/volcanoes.js) con un enlace a
// su página. Reutiliza el armazón de las fichas (SheetShell) y sus estilos (.sk-facts, .sk-note, .sk-actions).
import Icon from "./icons.jsx";
import { SheetShell } from "./ObjectSheet.jsx";
import { compassLabel } from "./issPasses.js";
import { VT, volcanoFacts, recentEruption } from "./volcanoes.js";

const nf = (lang, v, d = 0) => Number(v).toLocaleString(lang === "es" ? "es" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });

export default function PeakSheet({ t, lang = "es", peak, onClose, onGo, onSimulate, simulating = false, onStop }) {
  const T = VT[lang] || VT.es, v = peak.volcano;
  const dist = Number.isFinite(peak.dist_km) ? nf(lang, peak.dist_km, peak.dist_km < 10 ? 1 : 0) : null;
  const facts = volcanoFacts(v, lang);
  const height = peak.ele_m != null ? peak.ele_m : v && v.elev_m;
  return (
    <SheetShell t={t} lang={lang} title={peak.label || peak.name} subtitle={v ? T.volcano : T.mountain} badge={dist ? T.from(dist, compassLabel(peak.az, lang)) : null}
      resetKey={`${peak.name}:${peak.az}`} onClose={onClose} className="is-peak">
      <dl className="sk-facts is-two">
        {height != null && <div><dt>{T.alt}</dt><dd>{nf(lang, height)} m</dd></div>}
        {facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
      </dl>
      {v && v.erupting && <p className="sk-note peak-sheet-hot" role="note">{T.erupting(new Date().getFullYear())}</p>}
      {v && !v.erupting && recentEruption(v) && <p className="sk-note peak-sheet-hot" role="note">{T.recent}</p>}
      {!v && peak.volcanoChecked && <p className="sk-note">{T.noVolc}</p>}
      <div className="sk-actions">
        {v && !v.erupting && simulating && onStop && <button type="button" className="sk-btn" onClick={onStop}><Icon name="mountain" size={17} />{T.simStopLong}</button>}
        {v && !v.erupting && !simulating && onSimulate && <button type="button" className="sk-btn" onClick={onSimulate}><Icon name="mountain" size={17} />{T.simulate}</button>}
        {onGo && Number.isFinite(peak.lat) && <button type="button" className="sk-btn" onClick={onGo}><Icon name="pin" size={17} />{T.goSummit}</button>}
        {v && v.url && <a className="sk-btn" href={v.url} target="_blank" rel="noopener noreferrer"><Icon name="link" size={17} />{T.more}</a>}
      </div>
      {v && !v.erupting && onSimulate && <p className="peak-sheet-src">{T.simNote}</p>}
      {v && v.erupting && <p className="peak-sheet-src">{T.gasNote}</p>}
      <p className="peak-sheet-src">{T.src}</p>
    </SheetShell>
  );
}
