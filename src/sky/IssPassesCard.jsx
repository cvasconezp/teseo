// IssPassesCard.jsx — «La ISS sobre ti»: próximas pasadas visibles de la Estación Espacial Internacional.
// Componente de presentación + su propia consulta a /api/iss/passes (lógica en issPasses.js, textos en
// i18n-iss.js, trayectoria para el Cielo en issSky.js). No toca el estado de Constellations.jsx.
//
// Props:
//   lang       "es" | "en"
//   lat, lon   lugar de la persona (grados). Sin ellos la tarjeta pide elegir un lugar en «Mi cielo».
//   altM       altitud del lugar en metros (opcional; por defecto 0)
//   days       días a calcular, 1–10 (por defecto 5)
//   onShow     opcional: onShow(pasada, datos) al pulsar «Verla en el cielo». Sin él no se dibuja el botón.
//              La pasada es la del servidor, ya normalizada (con startMs, endMs, track…); `datos` es la
//              respuesta entera (elements: período, inclinación…). Las pasadas NO visibles llegan sin
//              `track` (el servidor solo la manda en las visibles): quien la dibuje la pide con fetchIssPass.
//   hiddenDefault  opcional: empezar listando también las no visibles (por defecto no)
//   maxItems   cuántas pasadas visibles listar (por defecto 5)
//   data       opcional: respuesta ya pedida (normalizada o cruda); si se da, no se consulta la red
//   nowMs      opcional: «ahora» fijo en ms (pruebas y capturas); por defecto el reloj, con tic de 30 s
//   timeZone   opcional: zona horaria IANA; por defecto la del dispositivo
//   onTrack    opcional: sustituye a track() de métricas (pruebas)
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { ISS } from "./i18n-iss.js";
import {
  DEFAULT_DAYS, accuracyWarnings, describePass, fetchIssPasses, fmtDuration, fmtMag, formatClock, formatCountdown, formatDay,
  hiddenReason, isHappeningNow, nextVisiblePass, normalizePasses, summarize, upcomingPasses, visiblePasses,
} from "./issPasses.js";
import { track } from "../ui/track.js";
import "./iss.css";

function SatelliteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" transform="rotate(45 12 12)" />
      <path d="m7.2 7.2-3.7-3.7M3.2 8.8l3.4 3.4-2.4 2.4-3.4-3.4zM15.4 3.2l5.4 5.4-2.4 2.4-5.4-5.4zM16.8 16.8l3.7 3.7" />
    </svg>
  );
}

export default function IssPassesCard({ lang = "es", lat, lon, altM = 0, days = DEFAULT_DAYS, onShow, maxItems = 5, data: dataProp, nowMs, timeZone, onTrack, hiddenDefault = false }) {
  const t = ISS[lang] || ISS.es;
  const uid = useId();
  const hasPlace = Number.isFinite(lat) && Number.isFinite(lon);
  const [state, setState] = useState({ status: dataProp ? "ok" : "idle", data: dataProp ? normalizePasses(dataProp) : null });
  const [tick, setTick] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);
  // «Ver también las que no se ven»: la respuesta normal ya trae TODAS las pasadas (las no visibles sin
  // trayectoria), así que listar las no visibles no cuesta otra consulta; la trayectoria de la que se
  // elija se pide aparte (pass_start) solo al pulsar «Verla en el cielo».
  const [showHidden, setShowHidden] = useState(!!hiddenDefault);
  const emit = useRef(onTrack || track);
  emit.current = onTrack || track;

  // consulta (se cancela al cambiar de lugar o al desmontar)
  useEffect(() => {
    if (dataProp) { setState({ status: "ok", data: normalizePasses(dataProp) }); return undefined; }
    if (!hasPlace) { setState({ status: "idle", data: null }); return undefined; }
    const ctl = new AbortController();
    setState((s) => ({ status: "loading", data: s.data }));
    fetchIssPasses({ lat, lon, altM, days, signal: ctl.signal })
      .then((d) => {
        setState({ status: "ok", data: d });
        const sum = summarize(d.passes, Date.now());
        emit.current("iss_passes", { kind: "view", state: accuracyWarnings(d).stale ? "stale" : sum.visible ? "ok" : "empty" });
      })
      .catch((e) => {
        if (e && e.name === "AbortError") return;
        setState({ status: "error", data: null });
        emit.current("iss_passes", { kind: "view", state: "fail" });
      });
    return () => ctl.abort();
  }, [dataProp, hasPlace, lat, lon, altM, days, attempt]);

  // las cuentas atrás se refrescan cada 30 s (no hace falta más: se muestran minutos)
  useEffect(() => {
    if (nowMs != null) return undefined;
    const id = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [nowMs]);
  const now = nowMs != null ? nowMs : tick;

  const retry = useCallback(() => { emit.current("iss_passes", { kind: "retry" }); setAttempt((n) => n + 1); }, []);
  const show = useCallback((p) => { emit.current("iss_passes", { kind: "show", state: p.visible ? "ok" : "hidden" }); onShow && onShow(p, state.data); }, [onShow, state.data]);
  const toggleHidden = useCallback(() => {
    setShowHidden((v) => { if (!v) emit.current("iss_passes", { kind: "list_all", state: "ok" }); return !v; });
  }, []);

  const data = state.data;
  const visible = useMemo(() => (data ? visiblePasses(data.passes, now).slice(0, maxItems) : []), [data, now, maxItems]);
  const allPasses = useMemo(() => (data ? upcomingPasses(data.passes, now).slice(0, Math.max(maxItems, 10)) : []), [data, now, maxItems]);
  const listed = showHidden ? allPasses : visible;
  const hiddenCount = data ? upcomingPasses(data.passes, now).filter((p) => !p.visible).length : 0;
  const next = useMemo(() => (data ? nextVisiblePass(data.passes, now) : null), [data, now]);
  const sum = useMemo(() => (data ? summarize(data.passes, now) : null), [data, now]);
  const warn = data ? accuracyWarnings(data) : { outdated: false, stale: false };
  const o = { lang, timeZone };
  const tzName = timeZone || (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "");
  const windowDays = (data && data.window && data.window.days) || days;

  const headingId = `${uid}-h`;
  const el = data && data.elements;

  return (
    <section className="iss-card" aria-labelledby={headingId} aria-busy={state.status === "loading" ? "true" : undefined}>
      <header className="iss-head">
        <span className="iss-ico" aria-hidden="true"><SatelliteIcon /></span>
        <div>
          <h3 id={headingId}>{t.issTitle}</h3>
          <p className="iss-lead">{t.issLead}</p>
        </div>
      </header>

      {!hasPlace && !dataProp && <p className="iss-note">{t.issNeedPlace}</p>}

      {state.status === "loading" && !data && (
        <div className="iss-skel" role="status" aria-label={t.issLoading}>
          <i /><i />
        </div>
      )}

      {state.status === "error" && (
        <div className="iss-error" role="alert">
          <p className="iss-note">{t.issError}</p>
          <button type="button" className="iss-retry" onClick={retry}><Icon name="retry" size={18} />{t.issRetry}</button>
        </div>
      )}

      {data && state.status !== "error" && (
        <>
          {next && (
            <div className="iss-next">
              <span>{t.issNext}</span>
              <b>{formatCountdown(describePass(next, lang).startMs, now, lang, describePass(next, lang).endMs)}</b>
            </div>
          )}

          {!showHidden && visible.length === 0 && (
            <div className="iss-empty">
              <strong>{t.issEmpty(windowDays)}</strong>
              <p className="iss-note">{t.issEmptyWhy(sum.total, sum.sunUp, sum.shadow)}</p>
              <p className="iss-fine">{t.issEmptyHelp}</p>
            </div>
          )}
          {showHidden && hiddenCount > 0 && <p className="iss-fine">{t.issHiddenLead}</p>}
          {listed.length > 0 && (
            <ul className="iss-list" aria-label={showHidden ? t.issAllLabel : t.issListLabel}>
              {listed.map((p) => {
                const d = describePass(p, lang);
                const startIso = new Date(d.startMs).toISOString();
                const mag = fmtMag(p.mag, lang);
                const happening = isHappeningNow(p, now);
                const day = formatDay(d.startMs, o), clock = formatClock(d.startMs, o);
                const why = hiddenReason(p);
                return (
                  <li key={p.id || p.start.t} className={`iss-pass${happening ? " is-now" : ""}${why ? " is-hidden" : ""}`}>
                    <div className="iss-when">
                      <span>
                        <time className="iss-day" dateTime={startIso}>{day}</time>{" "}
                        <time className="iss-time" dateTime={startIso}>{clock}</time>
                      </span>
                      <span className="iss-chips">
                        {happening && <span className="iss-chip is-now">{t.issNowTag}</span>}
                        {why && <span className="iss-chip is-hidden">{t.issHiddenTag[why]}</span>}
                        <span className="iss-chip">{fmtDuration(d.durationS, lang)}</span>
                        {mag && <span className="iss-chip is-mag" title={t.issMagTitle} aria-label={`${t.issMag(mag)}. ${t.issMagTitle}`}>{mag}</span>}
                      </span>
                    </div>
                    <p className="iss-route">{t.issAppears(d.appears, d.peak, d.disappears)}</p>
                    {d.partial && <p className="iss-fine">{t.issPartial(clock, formatClock(d.endMs, o))}</p>}
                    {onShow && (
                      <button type="button" className="iss-show" onClick={() => show(p)} aria-label={t.issShowAria(day, clock)}>
                        <Icon name="eye" size={18} />{t.issShow}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {(hiddenCount > 0 || showHidden) && (
            <button type="button" className="iss-toggle" onClick={toggleHidden} aria-pressed={showHidden}>
              <Icon name={showHidden ? "eye" : "layers"} size={17} />{showHidden ? t.issHideHidden : t.issShowHidden}
            </button>
          )}

          {warn.stale && <p className="iss-warn" role="note"><Icon name="warn" size={16} />{t.issStale}</p>}
          {warn.outdated && <p className="iss-warn" role="note"><Icon name="warn" size={16} />{t.issOutdated}</p>}
        </>
      )}

      <footer className="iss-foot">
        <span className="iss-source">{t.issSource}</span>
        {el && el.epoch && <span className="iss-fine">{t.issEpoch(`${formatDay(el.epoch, o)} ${formatClock(el.epoch, o)}`, t.issAge(el.age_hours))}</span>}
        <span className="iss-fine">{t.issApprox}</span>
        {data && <span className="iss-fine">{t.issTimeNote(tzName)}</span>}
      </footer>
    </section>
  );
}
