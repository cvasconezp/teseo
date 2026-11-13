// Paneles de la vista Cielo: etiquetas, buscador, dock, capas, ubicación, tiempo,
// tour y primeros pasos. Componentes de presentación: el estado vive en
// Constellations.jsx y los textos llegan por `t` (diccionario TC).
import { memo, useEffect, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { fmtWhenLong } from "./format.js";

// ── Etiquetas proyectadas ────────────────────────────────────────────────
// Tienen su propio estado: el bucle de render las actualiza ~12 veces/s sin
// volver a renderizar toda la vista.
export const SkyLabels = memo(function SkyLabels({ apiRef, colors, unit, locale }) {
  const [labels, setLabels] = useState([]);
  useEffect(() => { apiRef.current = setLabels; return () => { apiRef.current = null; }; }, [apiRef]);
  return (
    <div className="sk-labels" aria-hidden="true">
      {labels.map((l) => (
        <div key={l.key} className={`sk-label sk-label-${l.cls.startsWith("obj_") ? "obj" : l.cls}`}
          style={{ transform: `translate(${Math.round(l.x)}px,${Math.round(l.y)}px)`, color: colors[l.cls] || "#fff" }}>
          <span style={l.dx ? { transform: `translate(${l.dx}px,-50%)` } : undefined}>{l.name}</span>
          {l.sub != null && <small>{l.sub.toLocaleString(locale)} {unit}</small>}
        </div>
      ))}
    </div>
  );
});

// ── Buscador ─────────────────────────────────────────────────────────────
export function SearchBox({ t, query, setQuery, results, onResult, quick }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const close = () => { setOpen(false); if (inputRef.current) inputRef.current.blur(); };
  const showQuick = open && query.trim().length < 2;
  const showResults = open && query.trim().length >= 2;
  return (
    <div className="sk-search" ref={boxRef}
      onBlur={(e) => { if (!boxRef.current || !boxRef.current.contains(e.relatedTarget)) setOpen(false); }}>
      <div className="sk-search-field">
        <Icon name="search" size={19} />
        <input ref={inputRef} type="search" value={query} enterKeyHint="search" autoComplete="off" spellCheck="false"
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setQuery(""); close(); }
            if (e.key === "Enter") { const r = results.find((x) => x.type !== "loading"); if (r) { onResult(r); close(); } }
          }}
          aria-label={t.searchAria} placeholder={t.searchPlaceholder} />
        {query && (
          <button type="button" className="sk-search-clear" onClick={() => { setQuery(""); if (inputRef.current) inputRef.current.focus(); }} aria-label={t.searchClear}>
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      {showQuick && (
        <div className="sk-search-pop">
          <p className="sk-pop-title">{t.searchTry}</p>
          <div className="sk-quick">
            {quick.map((q) => (
              <button key={q.label} type="button" onClick={() => { q.onPick(); close(); }}>{q.label}</button>
            ))}
          </div>
        </div>
      )}
      {showResults && (
        <div className="sk-search-pop" role="listbox" aria-label={t.searchResults}>
          {results.length === 0 && <p className="sk-pop-empty">{t.searchEmpty}</p>}
          {results.map((r, i) => r.type === "loading" ? (
            <p key={i} className="sk-pop-empty" role="status">{r.label}</p>
          ) : (
            <button key={i} type="button" role="option" aria-selected="false" className="sk-result" onClick={() => { onResult(r); close(); }}>
              <span className="sk-result-name">{r.label}</span>
              <span className="sk-result-kind">{r.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dock de acciones principales ─────────────────────────────────────────
export function Dock({ t, panel, onPanel, localMode, tourReady, onTour, timeLabel, isNow, layersOn, layersWarn, playing }) {
  // función normal (no componente): así los botones no se remontan en cada render
  const item = ({ id, icon, label, active, onClick, disabled, badge, tone }) => (
    <button type="button" key={id} className={`sk-dock-item${active ? " is-active" : ""}${tone ? " tone-" + tone : ""}`}
      onClick={onClick} disabled={disabled} aria-pressed={id === "tour" ? undefined : !!active}
      aria-expanded={id === "tour" ? undefined : panel === id}>
      <span className="sk-dock-icon"><Icon name={icon} size={22} />{badge}</span>
      <span className="sk-dock-label">{label}</span>
    </button>
  );
  return (
    <nav className="sk-dock" aria-label={t.dockAria}>
      {item({ id: "layers", icon: "layers", label: t.layers, active: panel === "layers", onClick: () => onPanel("layers"),
        badge: layersWarn ? <i className="sk-badge warn" role="img" aria-label={t.layerFailed} /> : layersOn > 0 ? <i className="sk-badge">{layersOn}</i> : null })}
      {item({ id: "location", icon: "pin", label: t.mySky, active: panel === "location" || localMode, tone: localMode ? "blue" : null, onClick: () => onPanel("location") })}
      {item({ id: "tour", icon: "tour", label: t.tour, onClick: onTour, disabled: !tourReady })}
      {item({ id: "time", icon: playing ? "play" : "clock", label: timeLabel, active: panel === "time" || !isNow, tone: !isNow ? "gold" : null, onClick: () => onPanel("time") })}
    </nav>
  );
}

function PanelShell({ title, onClose, t, children, className = "", labelledBy }) {
  return (
    <section className={`sk-panel ${className}`} role="dialog" aria-labelledby={labelledBy}>
      <header className="sk-panel-head">
        <h2 id={labelledBy}>{title}</h2>
        <button type="button" className="sk-iconbtn" onClick={onClose} aria-label={t.close}><Icon name="close" size={18} /></button>
      </header>
      <div className="sk-panel-body">{children}</div>
    </section>
  );
}

// ── Capas ────────────────────────────────────────────────────────────────
const GROUPS = [
  { id: "near", keys: ["__solar", "meteors", "comets", "probes"] },
  { id: "deep", keys: ["messier", "galaxies", "blackholes", "pulsars", "exoplanets"] },
];
export function LayersPanel({ t, lang, layers, datasets, enabled, loadingLayer, layerError, onToggle, onRetry,
  showSolar, onToggleSolar, constellations, sel, onPick, labelDensity, onDensity, onClose }) {
  const row = (key) => {
    if (key === "__solar") {
      return (
        <div className="sk-layer" key={key}>
          <button type="button" role="switch" aria-checked={showSolar} className="sk-layer-main" onClick={onToggleSolar}>
            <i className="sk-dot" style={{ background: "#ffd23f" }} />
            <span className="sk-layer-txt"><b>{t.solarLayer}</b><small>{t.layerDesc.solar}</small></span>
            <span className="sk-count">9</span>
            <i className="sk-switch" />
          </button>
        </div>
      );
    }
    const cfg = layers.find((l) => l.key === key); if (!cfg) return null;
    const on = !!enabled[key], ds = datasets[key];
    const loading = !!loadingLayer[key], err = !!layerError[key];
    const hex = "#" + cfg.color.toString(16).padStart(6, "0");
    const usable = cfg.api || cfg.lazy || !!ds || err;
    const count = ds ? (ds.count ?? (ds.objects || []).length) : null;
    return (
      <div className={`sk-layer${err ? " has-error" : ""}`} key={key}>
        <button type="button" role="switch" aria-checked={on} disabled={!usable} className="sk-layer-main"
          onClick={() => onToggle(key)}>
          <i className="sk-dot" style={{ background: hex }} />
          <span className="sk-layer-txt"><b>{cfg[lang] || cfg.es}</b><small>{t.layerDesc[key]}</small></span>
          <span className="sk-count" role={loading ? "status" : undefined}>
            {loading ? <><i className="sk-spin" />{t.loadingShort}</> : count != null ? count.toLocaleString(lang === "es" ? "es" : "en-US") : ""}
          </span>
          <i className="sk-switch" />
        </button>
        {err && (
          <div className="sk-layer-err" role="alert">
            <Icon name="warn" size={15} /><span>{t.layerErrorLine}</span>
            <button type="button" onClick={() => onRetry(cfg)}><Icon name="retry" size={14} />{t.retry}</button>
          </div>
        )}
      </div>
    );
  };
  return (
    <PanelShell t={t} title={t.layersTitle} onClose={onClose} labelledBy="sk-layers-title">
      <p className="sk-panel-lead">{t.layersLead}</p>
      {GROUPS.map((g) => (
        <div className="sk-group" key={g.id}>
          <h3>{t.groups[g.id]}</h3>
          {g.keys.map(row)}
        </div>
      ))}
      <div className="sk-group">
        <h3>{t.groups.view}</h3>
        <label className="sk-field">
          <span>{t.constellation3d}</span>
          <select value={sel || "__all__"} onChange={onPick}>
            <option value="__all__">{t.all}</option>
            {constellations.map((c) => <option key={c.ab} value={c.ab}>{c.la} · {c.en}</option>)}
          </select>
          <small>{t.constellation3dHint}</small>
        </label>
        <div className="sk-field">
          <span id="sk-density">{t.labelDensity}</span>
          <div className="sk-seg" role="radiogroup" aria-labelledby="sk-density">
            {[["pocas", t.densFew], ["normal", t.densNormal], ["muchas", t.densMany]].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={labelDensity === v} onClick={() => onDensity(v)}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <p className="sk-panel-foot">{t.scaleNote}</p>
    </PanelShell>
  );
}

// ── Mi cielo (ubicación) ─────────────────────────────────────────────────
export function LocationPanel({ t, localMode, lat, lon, placeName, geo, onUseMyLocation, places, onPlace, onManual, onExit, onClose }) {
  const [mLat, setMLat] = useState(lat != null ? String(lat) : "");
  const [mLon, setMLon] = useState(lon != null ? String(lon) : "");
  const [bad, setBad] = useState(false);
  useEffect(() => { if (lat != null) setMLat(String(lat)); if (lon != null) setMLon(String(lon)); }, [lat, lon]);
  const submit = (e) => {
    e.preventDefault();
    const a = parseFloat(String(mLat).replace(",", ".")), o = parseFloat(String(mLon).replace(",", "."));
    if (!Number.isFinite(a) || !Number.isFinite(o) || Math.abs(a) > 90 || Math.abs(o) > 180) { setBad(true); return; }
    setBad(false); onManual(a, o);
  };
  const geoMsg = geo === "asking" ? t.geoAsking : geo === "denied" ? t.geoDenied : geo === "unavailable" ? t.geoUnavailable
    : geo === "timeout" ? t.geoTimeout : geo === "unsupported" ? t.geoUnsupported : null;
  return (
    <PanelShell t={t} title={t.mySkyTitle} onClose={onClose} labelledBy="sk-loc-title">
      <p className="sk-panel-lead">{t.mySkyLead}</p>
      {localMode && lat != null && (
        <div className="sk-loc-now">
          <Icon name="pin" size={18} />
          <div><b>{placeName || t.customPlace}</b><small>{t.latLon(lat, lon)}</small></div>
          <button type="button" className="sk-btn ghost" onClick={onExit}>{t.exitMySky}</button>
        </div>
      )}
      <button type="button" className="sk-btn primary wide" onClick={onUseMyLocation} disabled={geo === "asking"}>
        {geo === "asking" ? <i className="sk-spin" /> : <Icon name="locate" size={19} />}
        {geo === "asking" ? t.geoAskingBtn : t.useMyLocation}
      </button>
      {geoMsg && (
        <p className={`sk-geo-msg${geo === "asking" ? "" : " is-error"}`} role={geo === "asking" ? "status" : "alert"}>{geoMsg}</p>
      )}
      <div className="sk-group">
        <h3>{t.orPickPlace}</h3>
        <div className="sk-quick">
          {places.map((p) => (
            <button key={p.name} type="button" aria-pressed={localMode && placeName === p.name} onClick={() => onPlace(p)}>{p.name}</button>
          ))}
        </div>
      </div>
      <form className="sk-group" onSubmit={submit} noValidate>
        <h3>{t.orCoords}</h3>
        <div className="sk-coords">
          <label><span>{t.latitude}</span><input inputMode="decimal" value={mLat} onChange={(e) => setMLat(e.target.value)} placeholder="-0.18" aria-invalid={bad} /></label>
          <label><span>{t.longitude}</span><input inputMode="decimal" value={mLon} onChange={(e) => setMLon(e.target.value)} placeholder="-78.47" aria-invalid={bad} /></label>
          <button type="submit" className="sk-btn">{t.apply}</button>
        </div>
        {bad && <p className="sk-geo-msg is-error" role="alert">{t.coordsBad}</p>}
        <small className="sk-hint">{t.coordsHint}</small>
      </form>
    </PanelShell>
  );
}

// ── Tiempo ───────────────────────────────────────────────────────────────
export function TimePanel({ t, lang, when, whenStr, isNow, playing, onShift, onTogglePlay, onNow, onSet, onClose }) {
  const w = fmtWhenLong(when, lang);
  return (
    <PanelShell t={t} title={t.timeTitle} onClose={onClose} labelledBy="sk-time-title" className="sk-panel-time">
      <div className="sk-when" aria-live="polite">
        <strong>{w.time}</strong>
        <span>{w.date}</span>
        {isNow ? <em>{t.isNow}</em> : <button type="button" className="sk-btn gold" onClick={onNow}>{t.backToNow}</button>}
      </div>
      <div className="sk-steps">
        <button type="button" onClick={() => onShift(-1440)}><Icon name="prev" size={16} />{t.dayBack}</button>
        <button type="button" onClick={() => onShift(-60)}><Icon name="prev" size={16} />{t.hourBack}</button>
        <button type="button" onClick={() => onShift(60)}>{t.hourFwd}<Icon name="next" size={16} /></button>
        <button type="button" onClick={() => onShift(1440)}>{t.dayFwd}<Icon name="next" size={16} /></button>
      </div>
      <button type="button" className={`sk-btn wide${playing ? " gold" : " primary"}`} onClick={onTogglePlay} aria-pressed={playing}>
        <Icon name={playing ? "pause" : "play"} size={18} />{playing ? t.pauseTime : t.playTime}
      </button>
      <label className="sk-field">
        <span>{t.pickDate}</span>
        <input type="datetime-local" value={whenStr} onChange={(e) => { if (e.target.value) onSet(e.target.value); }} />
      </label>
      <p className="sk-panel-foot">{t.timeNote}</p>
    </PanelShell>
  );
}

// ── Tour guiado ──────────────────────────────────────────────────────────
export function TourCard({ t, title, fact, index, total, text, auto, onPrev, onNext, onToggleAuto, onExit, onRetry }) {
  return (
    <section className="sk-tour" aria-label={t.tourAria}>
      <div className="sk-tour-progress" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => <i key={i} className={i < index ? "done" : i === index ? "now" : ""} />)}
      </div>
      <div className="sk-tour-head">
        <div>
          <p className="sk-tour-step">{t.tourStep(index + 1, total)}</p>
          <h2>{title}</h2>
          {fact && <p className="sk-tour-fact">{fact}</p>}
        </div>
        <button type="button" className="sk-iconbtn" onClick={onExit} aria-label={t.tourExit}><Icon name="close" size={18} /></button>
      </div>
      <p className="sk-tour-text" aria-live="polite">
        {text === null ? <span className="sk-narrating"><i className="sk-spin" />{t.narrating}</span>
          : text ? <>“{text}”<small>{t.aiNarration}</small></>
          : <span className="sk-tour-off">{t.tourNoText} <button type="button" onClick={onRetry}><Icon name="retry" size={14} />{t.retry}</button></span>}
      </p>
      <div className="sk-tour-nav">
        <button type="button" className="sk-btn" onClick={onPrev}><Icon name="prev" size={17} />{t.prev}</button>
        <button type="button" className="sk-btn" onClick={onToggleAuto} aria-pressed={auto}>
          <Icon name={auto ? "pause" : "play"} size={16} />{auto ? t.tourPause : t.tourResume}
        </button>
        <button type="button" className="sk-btn primary" onClick={onNext}>{t.next}<Icon name="next" size={17} /></button>
      </div>
    </section>
  );
}

// ── Primeros pasos (una sola vez) ────────────────────────────────────────
export function Onboarding({ t, onDone, onTour, tourReady }) {
  const [step, setStep] = useState(0);
  const steps = t.onboard;
  const last = step === steps.length - 1;
  const s = steps[step];
  return (
    <section className="sk-onboard" role="dialog" aria-label={t.onboardAria}>
      <div className={`sk-onboard-art art-${step}`} aria-hidden="true">
        {step === 0 && <span className="sk-gesture"><Icon name="hand" size={30} /></span>}
        {step === 1 && <span className="sk-tap"><i /><Icon name="hand" size={28} /></span>}
        {step === 2 && <span className="sk-art-icons"><Icon name="layers" size={24} /><Icon name="pin" size={24} /><Icon name="tour" size={24} /><Icon name="clock" size={24} /></span>}
      </div>
      <div className="sk-onboard-copy" aria-live="polite">
        <h2>{s.title}</h2>
        <p>{s.body}</p>
      </div>
      <div className="sk-onboard-nav">
        <div className="sk-dots" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i === step ? "now" : ""} />)}</div>
        {!last && <button type="button" className="sk-btn ghost" onClick={onDone}>{t.skip}</button>}
        {!last && <button type="button" className="sk-btn primary" onClick={() => setStep(step + 1)}>{t.next}<Icon name="next" size={16} /></button>}
        {last && <button type="button" className="sk-btn ghost" onClick={onDone}>{t.exploreAlone}</button>}
        {last && <button type="button" className="sk-btn primary" disabled={!tourReady} onClick={() => { onDone(); onTour(); }}><Icon name="tour" size={17} />{t.startTour}</button>}
      </div>
    </section>
  );
}
