// MonSheet.jsx — ficha de una estructura de un sitio (un monumento) al tocar su nombre: qué es, qué se sabe y qué se
// discute, lo que Teseo permite comprobar y las fuentes (src/sky/monumentInfo.js). Con «Ir aquí» si tiene punto de
// visita. Reutiliza el armazón de las fichas (SheetShell) y sus estilos, como PeakSheet.
import Icon from "./icons.jsx";
import { SheetShell } from "./ObjectSheet.jsx";
import { compassLabel } from "./issPasses.js";
import { MON_INFO, MT, shapeCredit } from "./monumentInfo.js";

export default function MonSheet({ t, lang = "es", mon, onClose, onGo, here = false }) {
  const T = MT[lang] || MT.es, info = MON_INFO[mon.id] || null, L = (o) => (o ? o[lang] || o.es : null);
  const sc = shapeCredit(mon.id, mon.site, lang);
  const d = Number.isFinite(mon.dist_km) ? Math.round(mon.dist_km * 1000) : null;
  return (
    <SheetShell t={t} lang={lang} title={mon.name} subtitle={info ? L(info.kind) : mon.sub || null} badge={d != null && d > 3 ? T.from(d.toLocaleString(lang === "es" ? "es" : "en-US"), compassLabel(mon.az, lang)) : null}
      resetKey={`mon:${mon.id}`} onClose={onClose} className="is-peak is-mon">
      {info && info.facts && L(info.facts) && <dl className="sk-facts is-two">{L(info.facts).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {info && L(info.body).map((p, i) => <p key={i} className="mon-sheet-p">{p}</p>)}
      {info && info.teseo && <p className="sk-note" role="note">{L(info.teseo)}</p>}
      {!info && <p className="sk-note">{T.noInfo}</p>}
      <div className="sk-actions">
        {onGo && !here && <button type="button" className="sk-btn" onClick={onGo}><Icon name="pin" size={17} />{T.go}</button>}
        {here && <span className="mon-sheet-here"><Icon name="pin" size={15} />{T.here}</span>}
      </div>
      {sc && <p className="peak-sheet-src"><b>{T.credits}. </b>{sc.text} <a href={sc.url} target="_blank" rel="noopener noreferrer">{lang === "es" ? "Ver" : "View"}</a></p>}
      {info && info.sources && (
        <div className="mon-sheet-srcs"><p className="peak-sheet-src"><b>{T.sources}</b></p>
          <ul>{info.sources.map((s) => <li key={s.label}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a> : s.label}</li>)}</ul></div>
      )}
    </SheetShell>
  );
}
