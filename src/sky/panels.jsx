// Paneles de la vista Cielo: etiquetas, buscador, dock, capas, ubicación, tiempo,
// tour y primeros pasos. Componentes de presentación: el estado vive en
// Constellations.jsx y los textos llegan por `t` (diccionario TC).
import { memo, useEffect, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { fmtWhenLong } from "./format.js";
import { compassPoint8 } from "./deviceOrientation.js";
import { bodyName } from "./bodies.js";
import { useDialogFocus } from "./focus.js";

// ── Etiquetas proyectadas ────────────────────────────────────────────────
// Tienen su propio estado: el bucle de render las actualiza ~12 veces/s sin
// volver a renderizar toda la vista.
// Medidor de rendimiento opcional (#sky?...&fps=1): se actualiza dos veces por segundo desde el bucle
// de animación escribiendo directamente en el DOM (no provoca renders de React).
export const PerfMeter = memo(function PerfMeter({ t, lang, apiRef }) {
  const box = useRef(null);
  useEffect(() => {
    const n = (v, d = 0) => Number(v).toLocaleString(lang === "es" ? "es" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    apiRef.current = (s) => {
      const el = box.current; if (!el) return;
      const set = (k, v) => { const x = el.querySelector(`[data-k="${k}"]`); if (x && x.textContent !== v) x.textContent = v; };
      set("fps", s.n ? n(s.fps) : "–"); set("low", s.n ? n(s.low1) : "–");
      set("js", s.n ? `${n(s.jsMean, 1)} ms (p95 ${n(s.jsP95, 1)})` : "–");
      set("drawn", n(s.drawnPerS) + (s.idle ? ` · ${t.perfIdle}` : ""));
      set("objs", n(s.objs)); set("labels", n(s.labels));
      set("res", `${s.w}×${s.h} · ×${n(s.ratio, 2)}${s.ratio < s.base ? ` (↓ ${n(s.base, 2)})` : ""}${s.dpr > s.base ? ` · dpr ${n(s.dpr, 2)}` : ""}`);
      el.dataset.idle = String(!!s.idle); el.dataset.ratio = String(s.ratio);
    };
    return () => { apiRef.current = null; };
  }, [apiRef, lang, t]);
  const row = (k, label) => <div><dt>{label}</dt><dd data-k={k}>–</dd></div>;
  return (
    <dl className="sk-perf" ref={box} aria-label={t.perfAria}>
      {row("fps", t.perfFps)}{row("low", t.perfLow)}{row("js", t.perfJs)}{row("drawn", t.perfFrames)}{row("objs", t.perfObjs)}{row("labels", t.perfLabels)}{row("res", t.perfRes)}
    </dl>
  );
});

export const SkyLabels = memo(function SkyLabels({ apiRef, colors, unit, locale, onNote, noteAria }) {
  const [labels, setLabels] = useState([]);
  useEffect(() => { apiRef.current = setLabels; return () => { apiRef.current = null; }; }, [apiRef]);
  return (
    <div className="sk-labels">
      {labels.map((l) => l.cls === "note" ? (
        // nota sobre un patrón del cielo: es un botón (lo demás son etiquetas mudas)
        <button key={l.key} type="button" className="sk-skynote" onClick={() => onNote(l.id)} aria-label={noteAria(l.name)}
          style={{ transform: `translate(${Math.round(l.x)}px,${Math.round(l.y)}px) translate(-50%,-135%)` }}>
          <i aria-hidden="true">?</i>{l.name}
        </button>
      ) : (
        <div key={l.key} aria-hidden="true" className={`sk-label sk-label-${l.cls.startsWith("obj_") ? "obj" : l.cls}${l.flip ? " is-flip" : ""}${l.hot ? " is-hot" : ""}`}
          style={{ transform: `translate(${Math.round(l.x)}px,${Math.round(l.y)}px)`, color: colors[l.cls] || "#fff" }}>
          <span style={l.dx ? { transform: l.flip ? `translate(calc(-100% - ${l.dx}px),-50%)` : `translate(${l.dx}px,-50%)` } : undefined}>{l.name}</span>
          {l.sub != null && <small>{l.sub.toLocaleString(locale)} {unit}</small>}
        </div>
      ))}
    </div>
  );
});

// ── Buscador ─────────────────────────────────────────────────────────────
export function SearchBox({ t, query, setQuery, results, onResult, quick, compact }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const close = () => { setOpen(false); if (inputRef.current) inputRef.current.blur(); };
  const showQuick = open && query.trim().length < 2;
  const showResults = open && query.trim().length >= 2;
  // en el teléfono, vacío y sin foco, se queda en una píldora corta que se abre al tocarla
  const collapsed = !!compact && !open && !query;
  return (
    <div className={`sk-search${collapsed ? " is-collapsed" : ""}`} ref={boxRef}
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
          aria-label={t.searchAria} placeholder={collapsed ? t.searchShort : t.searchPlaceholder} />
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
export function Dock({ t, panel, onPanel, localMode, tourReady, onTour, timeLabel, isNow, layersOn, layersWarn, playing, mySkyLabel }) {
  // función normal (no componente): así los botones no se remontan en cada render
  const item = ({ id, icon, label, active, onClick, disabled, badge, tone }) => (
    <button type="button" key={id} className={`sk-dock-item${active ? " is-active" : ""}${tone ? " tone-" + tone : ""}`}
      onClick={onClick} disabled={disabled} aria-pressed={id === "tour" ? undefined : !!active}
      aria-expanded={id === "tour" ? undefined : panel === id}>
      <span className="sk-dock-icon"><Icon name={icon} size={21} /></span>
      <span className="sk-dock-label">{label}</span>
      {badge}
    </button>
  );
  return (
    <nav className="sk-dock" aria-label={t.dockAria}>
      {item({ id: "layers", icon: "layers", label: t.layers, active: panel === "layers", onClick: () => onPanel("layers"),
        badge: layersWarn ? <i className="sk-badge warn" role="img" aria-label={t.layerFailed} /> : layersOn > 0 ? <i className="sk-badge">{layersOn}</i> : null })}
      {item({ id: "location", icon: "pin", label: mySkyLabel || t.mySky, active: panel === "location" || localMode, tone: localMode ? "blue" : null, onClick: () => onPanel("location") })}
      {item({ id: "tour", icon: "tour", label: t.tour, onClick: onTour, disabled: !tourReady })}
      {item({ id: "time", icon: playing ? "play" : "clock", label: timeLabel, active: panel === "time" || !isNow, tone: !isNow ? "gold" : null, onClick: () => onPanel("time") })}
    </nav>
  );
}

function PanelShell({ title, onClose, t, children, className = "", labelledBy }) {
  const boxRef = useRef(null);
  useDialogFocus(boxRef, { trap: true });
  return (
    <section ref={boxRef} className={`sk-panel ${className}`} role="dialog" aria-labelledby={labelledBy}>
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
  showSolar, onToggleSolar, constellations, sel, onPick, labelDensity, onDensity, onClose, notes = [], onNote, vivid = false, onVivid, outside = false, onOutside , atmosphere, guides}) {
  // patrón llamativo de la capa (contado en los datos cargados): una línea y un botón para verlo
  const noteLine = (key) => {
    const n = enabled[key] && notes.find((x) => x.layer === key);
    return n ? (
      <div className="sk-layer-note">
        <span>{t.noteLayerLine[n.id](n.n, n.total)}</span>
        <button type="button" onClick={() => onNote(n.id)}>{t.noteSee}</button>
      </div>
    ) : null;
  };
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
        {noteLine(key)}
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
        {atmosphere}
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
        {onVivid && (
          <div className="sk-layer">
            <button type="button" role="switch" aria-checked={vivid} className="sk-layer-main" onClick={onVivid}>
              <i className="sk-dot" style={{ background: "linear-gradient(90deg,#a8c0ff,#fff1ea 50%,#ffbd78)" }} />
              <span className="sk-layer-txt"><b>{t.vividStars}</b><small>{t.vividHint}</small></span>
              <i className="sk-switch" />
            </button>
          </div>
        )}
        {onOutside && (
          <div className="sk-layer">
            <button type="button" role="switch" aria-checked={!!outside} className="sk-layer-main" onClick={onOutside}>
              <i className="sk-dot" style={{ background: "radial-gradient(circle at 35% 35%,#c9d7ff,#3b4a7a 70%)" }} />
              <span className="sk-layer-txt"><b>{t.outsideView}</b><small>{t.outsideHint}</small></span>
              <i className="sk-switch" />
            </button>
          </div>
        )}
        {guides}
      </div>
      <p className="sk-panel-foot">{t.scaleNote}<br />{t.baseSources}</p>
    </PanelShell>
  );
}

// ── Mi cielo (ubicación) ─────────────────────────────────────────────────
export function LocationPanel({ t, localMode, lat, lon, placeName, geo, onUseMyLocation, places, onPlace, onManual, onExit, onClose, pointing, onTonight }) {
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
      {localMode && lat != null && onTonight && (
        <button type="button" className="sk-btn wide sk-tonight-btn" onClick={onTonight}><Icon name="moon" size={19} />{t.tonightTitle}</button>
      )}
      <button type="button" className={`sk-btn wide${localMode ? "" : " primary"}`} onClick={onUseMyLocation} disabled={geo === "asking"}>
        {geo === "asking" ? <i className="sk-spin" /> : <Icon name="locate" size={19} />}
        {geo === "asking" ? t.geoAskingBtn : t.useMyLocation}
      </button>
      {geoMsg && (
        <p className={`sk-geo-msg${geo === "asking" ? "" : " is-error"}`} role={geo === "asking" ? "status" : "alert"}>{geoMsg}</p>
      )}
      {/* solo en teléfonos y tabletas con sensores de orientación */}
      {pointing && (
        <div className={`sk-point-card${pointing.state !== "off" ? " is-armed" : ""}`}>
          <button type="button" className="sk-btn wide sk-point-btn" onClick={pointing.onStart} aria-pressed={pointing.state !== "off"}>
            <Icon name="point" size={20} /><span>{t.pointSky}</span><em className="sk-exp">{t.experimental}</em>
          </button>
          <p role="status">{pointing.state === "pending" ? t.pointPickPlace : pointing.state === "on" ? t.pointActive : t.pointLead}</p>
        </div>
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

// ── Apuntar al cielo ─────────────────────────────────────────────────────
// Fuera del modo: una fila corta con "Esta noche" y "Apuntar". Dentro: una sola
// píldora (rumbo · altitud, controles, salir); todo lo demás se oculta y vuelve
// un momento con "Controles". El rumbo y la altitud tienen estado propio: el
// bucle de render los actualiza sin volver a renderizar toda la vista.
export function SkyActions({ t, onTonight, onPoint }) {
  return (
    <div className="sk-cta">
      {onTonight && <button type="button" className="sk-cta-btn" onClick={onTonight}><Icon name="moon" size={19} /><span>{t.tonight}</span></button>}
      {onPoint && <button type="button" className="sk-cta-btn is-point" onClick={onPoint}><Icon name="point" size={20} /><span>{t.pointSky}</span></button>}
    </div>
  );
}

export const PointingBar = memo(function PointingBar({ t, mode, source, error, aligned, apiRef, onStart, onExit, onReset, onDismiss, canRetry,
  ctl, onCtl, help, onZoom, onLayers, onTonight, onSearch, north }) {
  const [look, setLook] = useState(null);   // { p: punto cardinal 0-7, a: altitud en grados enteros }
  useEffect(() => {
    apiRef.current = (az, alt) => {
      const a = Math.round(alt), p = compassPoint8(az);
      setLook((l) => (l && l.a === a && l.p === p ? l : { a, p }));
    };
    return () => { apiRef.current = null; };
  }, [apiRef]);
  useEffect(() => { if (mode !== "on") setLook(null); }, [mode]);

  if (mode === "error") {
    return (
      <div className="sk-ar is-error" role="alert">
        <p><Icon name="warn" size={18} /><span>{error === "denied" ? t.pointDenied : t.pointNoSensor}</span></p>
        <div className="sk-ar-row">
          {canRetry && error === "denied" && <button type="button" className="sk-btn" onClick={onStart}><Icon name="retry" size={16} />{t.retry}</button>}
          <button type="button" className="sk-btn" onClick={onDismiss}>{t.close}</button>
        </div>
      </div>
    );
  }
  const waiting = !look || !source;
  const below = !waiting && look.a < 0;
  const text = waiting ? t.pointPillWait : look.a >= 80 ? t.pointPillZenith : look.a <= -80 ? t.pointPillNadir : t.pointPill(look.p, look.a);
  const aria = waiting ? t.pointStarting : look.a >= 80 ? t.pointZenith : look.a <= -80 ? t.pointNadir : t.pointPillAria(look.p, look.a);
  const hint = source === "relative" ? t.pointHintRel : t.pointHint;
  // norte geográfico: la declinación magnética solo se aplica cuando el norte viene de la brújula
  const northLine = source === "absolute" && north ? north : null;
  return (
    <>
      {/* ayuda de alineación: sola los primeros segundos; después, dentro de "Controles" */}
      {help && !ctl && <p className="sk-arhelp" role="status">{hint}{northLine ? ` · ${northLine}` : ""}</p>}
      {ctl && (
        <div className="sk-artray" role="group" aria-label={t.pointTray}>
          <div className="sk-artray-row">
            <button type="button" className="sk-artray-btn" onClick={onSearch}><Icon name="search" size={19} /><span>{t.searchShort}</span></button>
            <button type="button" className="sk-artray-btn" onClick={onLayers}><Icon name="layers" size={19} /><span>{t.layers}</span></button>
            <button type="button" className="sk-artray-btn" onClick={onTonight}><Icon name="moon" size={19} /><span>{t.tonight}</span></button>
            <button type="button" className="sk-artray-btn is-icon" onClick={() => onZoom(1.25)} aria-label={t.zoomOut}><Icon name="minus" size={20} /></button>
            <button type="button" className="sk-artray-btn is-icon" onClick={() => onZoom(0.8)} aria-label={t.zoomIn}><Icon name="plus" size={20} /></button>
          </div>
          <div className="sk-artray-help">
            <p>{hint}</p>
            {northLine && <p className="sk-artray-north" title={t.declWhy}><Icon name="target" size={14} />{northLine}</p>}
            {aligned && <button type="button" className="sk-btn" onClick={onReset}><Icon name="retry" size={15} />{t.pointReset}</button>}
          </div>
        </div>
      )}
      <section className={`sk-arpill${below ? " is-below" : ""}`} aria-label={t.pointActive}>
        <span className="sk-arpill-read" role="img" aria-label={aria}>
          {waiting ? <i className="sk-spin" /> : <Icon name="point" size={19} />}
          <strong>{text}</strong>
        </span>
        <button type="button" className="sk-arpill-more" onClick={onCtl} aria-expanded={!!ctl} aria-label={ctl ? t.pointControlsHide : t.pointControls} title={t.pointControls}>
          <Icon name={ctl ? "down" : "dots"} size={20} />
        </button>
        <button type="button" className="sk-arpill-exit" onClick={onExit} aria-label={t.pointExitAria}>
          <Icon name="close" size={16} /><span>{t.pointExit}</span>
        </button>
      </section>
    </>
  );
});

// ── Flecha guía (modo apuntar) ───────────────────────────────────────────
// El bucle de render llama a apiRef.current(sep, ang, dAz, dAlt, visible, sx, sy):
// la flecha y la retícula se mueven tocando el DOM directamente (sin renders);
// solo el texto pasa por estado, y redondeado para no parpadear.
export const GuideHud = memo(function GuideHud({ t, label, apiRef, onStop }) {
  const arrowRef = useRef(null), retRef = useRef(null);
  const [msg, setMsg] = useState({ found: false, dAz: 0, dAlt: 0, sep: 0, follow: false, below: false, ready: false });
  useEffect(() => {
    apiRef.current = (sep, ang, dAz, dAlt, visible, sx, sy, tgtAlt, lookAlt) => {
      const found = sep < 6;
      if (arrowRef.current) {
        arrowRef.current.style.transform = `rotate(${ang.toFixed(1)}deg)`;
        arrowRef.current.style.opacity = found ? "0" : "1";
      }
      if (retRef.current) {
        retRef.current.style.opacity = visible ? "1" : "0";
        if (visible) retRef.current.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
      }
      const q = (v) => (Math.abs(v) > 25 ? Math.round(v / 5) * 5 : Math.round(v));
      const a = q(dAz), b = q(dAlt), sp = q(sep), below = tgtAlt < 0;
      // cerca del cenit o del nadir "girar a la derecha" deja de tener sentido: manda la flecha
      const follow = Math.abs(lookAlt) > 60 || Math.abs(tgtAlt) > 75;
      setMsg((m) => (m.ready && m.found === found && m.dAz === a && m.dAlt === b && m.sep === sp && m.follow === follow && m.below === below ? m : { found, dAz: a, dAlt: b, sep: sp, follow, below, ready: true }));
    };
    return () => { apiRef.current = null; };
  }, [apiRef]);
  return (
    <div className={`sk-guide${msg.found ? " is-found" : ""}`}>
      <div className="sk-guide-ring" aria-hidden="true"><div className="sk-guide-arrow" ref={arrowRef}><i /></div></div>
      <div className="sk-guide-reticle" ref={retRef} aria-hidden="true"><i /></div>
      <div className="sk-guide-msg" aria-label={t.guideAria}>
        <div className="sk-guide-txt">
          <strong>{msg.found ? t.guideFound(label) : t.guideFinding(label)}</strong>
          <span>{!msg.ready ? "" : msg.found ? t.guideFoundSub : msg.follow ? t.guideFollow(msg.sep) : t.guideTurn(msg.dAz, msg.dAlt)}</span>
          {msg.ready && msg.below && !msg.found && <small>{t.guideBelow}</small>}
        </div>
        <button type="button" className="sk-iconbtn" onClick={onStop} aria-label={t.guideStop} title={t.guideStop}><Icon name="close" size={18} /></button>
        <span className="sk-sr" role="status">{msg.found ? t.guideFound(label) : ""}</span>
      </div>
    </div>
  );
});

// ── Esta noche en tu cielo ───────────────────────────────────────────────
const TN_ICON = { moon: "moon", planet: "planet", shower: "meteor", con: "constellation", deep: "sparkle" };
export function TonightPanel({ t, lang, data, placeName, onGo, onFind, onGoTime, onClose }) {
  const loc = lang === "es" ? "es-EC" : "en-US";
  const hm = (d) => d.toLocaleTimeString(loc, lang === "es" ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { hour: "numeric", minute: "2-digit" });
  const md = (o) => { const [m, d] = o.peak.split("-").map(Number); return new Date(2024, m - 1, d).toLocaleDateString(lang === "es" ? "es" : "en-US", { day: "numeric", month: "short" }); };
  const where = (it) => (it.alt >= 65 ? t.tnHigh : it.alt >= 30 ? t.tnMid(compassPoint8(it.az)) : t.tnLow(compassPoint8(it.az)));
  const describe = (it) => {
    if (it.kind === "planet") {
      const name = bodyName(it.key, lang);
      if (!it.up) return { name, sub: t.tnRises(hm(it.rise.date), compassPoint8(it.rise.az)) };
      return { name, sub: `${where(it)} · ${it.scope ? t.tnScope : t.tnNaked}` };
    }
    if (it.kind === "moon") {
      const ph = t.tnMoon(t.moonPhases[it.phase], Math.round(it.illum * 100));
      return { name: bodyName("Luna", lang), sub: it.up ? `${ph} · ${where(it)}` : it.rise ? `${ph} · ${t.tnRises(hm(it.rise.date), compassPoint8(it.rise.az))}` : `${ph}. ${t.tnMoonDown}` };
    }
    if (it.kind === "shower") {
      const name = lang === "es" ? it.obj.name : (it.obj.name_en || it.obj.name);
      const rad = it.up ? t.tnRadiantUp(it.alt, compassPoint8(it.az)) : it.rise ? t.tnRadiantRises(hm(it.rise.date)) : "";
      return { name, sub: `${t.tnPeak(md(it.obj), it.toPeak)} · ${t.tnRate(it.zhr)}${rad ? ". " + rad : ""}`, tag: t.tnShower };
    }
    if (it.kind === "con") return { name: it.name, sub: `${t.tnCon} · ${where(it)}` };
    return { name: it.obj.cn ? `${it.obj.name} · ${it.obj.cn}` : it.obj.name, sub: `${where(it)} · ${it.naked ? t.tnDeepEye : t.tnDeepBino}` };
  };
  const row = (it) => {
    const d = describe(it);
    return (
      <li key={it.id} className={`sk-tn-row kind-${it.kind}${it.up ? "" : " is-later"}`}>
        <button type="button" className="sk-tn-main" onClick={() => onGo(it)} aria-label={t.goTo(d.name)}>
          <span className="sk-tn-icon" aria-hidden="true"><Icon name={TN_ICON[it.kind]} size={20} /></span>
          <span className="sk-tn-txt">
            <span className="sk-tn-head"><b>{d.name}</b>{it.up && <em className="sk-tn-pos">{t.altDir(it.alt, compassPoint8(it.az))}</em>}</span>
            <small>{d.sub}</small>
          </span>
        </button>
        {onFind && it.up && !data.shifted && (
          <button type="button" className="sk-tn-find" onClick={() => onFind(it, d.name)} aria-label={t.findItAria(d.name)}>
            <Icon name="point" size={17} /><span>{t.findIt}</span>
          </button>
        )}
      </li>
    );
  };
  const up = data ? data.items.filter((i) => i.up) : [];
  const later = data ? data.items.filter((i) => !i.up).sort((a, b) => (a.rise ? a.rise.date.getTime() : Infinity) - (b.rise ? b.rise.date.getTime() : Infinity)) : [];
  return (
    <PanelShell t={t} title={t.tonightTitle} onClose={onClose} labelledBy="sk-tonight-title" className="sk-panel-tonight">
      {!data ? <p className="sk-panel-lead">{t.tonightNeedPlace}</p> : data.noNight ? <p className="sk-panel-lead">{t.tonightNoNight}</p> : (
        <>
          <p className="sk-panel-lead">{data.shifted ? t.tonightShifted(hm(data.evalDate)) : t.tonightLead(placeName, hm(data.evalDate))}</p>
          {data.shifted && <button type="button" className="sk-btn gold" onClick={() => onGoTime(data.evalDate)}><Icon name="clock" size={17} />{t.tonightGo}</button>}
          {up.length === 0 && later.length === 0 && <p className="sk-pop-empty">{t.tonightEmpty}</p>}
          {up.length > 0 && (
            <div className="sk-group"><h3>{data.shifted ? t.tonightUpAt(hm(data.evalDate)) : t.tonightUp}</h3><ul className="sk-tn-list">{up.map(row)}</ul></div>
          )}
          {later.length > 0 && (
            <div className="sk-group"><h3>{t.tonightLater}</h3><ul className="sk-tn-list">{later.map(row)}</ul></div>
          )}
          <p className="sk-panel-foot">{t.tonightFoot}</p>
        </>
      )}
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
