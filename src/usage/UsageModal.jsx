// UsageModal.jsx — «Teseo en números»: la vista pública de cuánto se usa Teseo.
// Se abre desde el pie («Uso de Teseo»), desde el menú del Cielo (evento "teseo:usage")
// y con el enlace directo #uso / #usage (src/ui/hash.js). Va en su propio chunk.
//
// Lee GET {API}/api/metrics/public?days=7|30|90 (backend/app/metrics.py, public_summary):
// recuentos anónimos y agregados por día. Aquí no se calcula ni se estima nada: solo se
// muestra lo que devuelve el backend, con sus umbrales de privacidad explicados.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { fetchJson, isAbort } from "../net.js";
import {
  PERIODS, DEFAULT_DAYS, PRIVACY_URL, TU, usageUrl, fmtInt, fmtDay, fmtLongDate, topRows, isPublicSummary,
  mobileShare, chartModel, chartSummary,
} from "./format.js";
import "./usage.css";

const TOPS = [["tabs", "topTabs"], ["tours", "topTours"], ["sky_objects", "topSky"], ["routes", "topRoutes"]];

function Chart({ data, lang, t }) {
  const id = useId();
  const boxRef = useRef(null);
  const [w, setW] = useState(440);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => { const cw = Math.round(el.getBoundingClientRect().width); if (cw > 0) setW(cw); };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const m = chartModel(data.by_day, { width: w, height: w < 400 ? 170 : 190, lang, maxLabels: w < 400 ? 4 : 6 });
  const peak = m.bars.find(b => b.peak);
  return (
    <figure className="usage__chart" ref={boxRef}>
      <figcaption className="usage__h" id={`${id}-t`}>{t.chartTitle}</figcaption>
      <svg viewBox={`0 0 ${m.width} ${m.height}`} width={m.width} height={m.height} role="img" aria-labelledby={`${id}-t ${id}-d`}>
        <desc id={`${id}-d`}>{chartSummary(data.by_day, lang)}</desc>
        {m.axis.ticks.map(tk => (
          <g key={tk.v} aria-hidden="true">
            <line x1={m.plot.x} x2={m.plot.x + m.plot.w} y1={tk.y} y2={tk.y} className={tk.v === 0 ? "usage__axis" : "usage__grid"} />
            <text x={m.plot.x - 6} y={tk.y + 3.5} textAnchor="end" className="usage__tick">{fmtInt(tk.v, lang)}</text>
          </g>
        ))}
        {m.bars.map(b => (
          <rect key={b.date} x={b.x} y={b.y} width={b.w} height={Math.max(b.h, b.value > 0 ? 1 : 0)} rx={b.w > 6 ? 2 : 0}
            className={`usage__bar${b.today ? " is-today" : ""}${b.peak ? " is-peak" : ""}`}>
            <title>{`${fmtDay(b.date, lang)}${b.today ? ` (${t.chartToday})` : ""}: ${fmtInt(b.value, lang)}`}</title>
          </rect>
        ))}
        {peak && peak.value > 0 && (
          <text x={Math.min(Math.max(peak.x + peak.w / 2, m.plot.x + 10), m.plot.x + m.plot.w - 10)} y={Math.max(peak.y - 5, 9)}
            textAnchor="middle" className="usage__peak" aria-hidden="true">{fmtInt(peak.value, lang)}</text>
        )}
        {m.labels.map(l => (
          <text key={l.i} x={l.x} y={m.height - 6} textAnchor={l.anchor}
            className="usage__tick" aria-hidden="true">{l.text}</text>
        ))}
      </svg>
      <p className="usage__legend" aria-hidden="true"><span className="usage__swatch is-today" />{t.chartToday}</p>
      <table className="usage__sr">
        <caption>{t.chartTitle}</caption>
        <thead><tr><th scope="col">{t.chartDate}</th><th scope="col">{t.chartVisits}</th><th scope="col">{t.chartViews}</th></tr></thead>
        <tbody>
          {data.by_day.map((d, i) => (
            <tr key={d.date}>
              <th scope="row">{fmtLongDate(d.date, lang)}{i === data.by_day.length - 1 ? ` (${t.chartToday})` : ""}</th>
              <td>{fmtInt(d.visits, lang)}</td><td>{fmtInt(d.page_views, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function TopList({ title, rows, lang, t }) {
  return (
    <section className="usage__top">
      <h4 className="usage__g">{title}</h4>
      {rows.length ? (
        <ol className="usage__list">
          {rows.map(r => (
            <li key={r.value}>
              <span className="usage__name">{r.label}</span>
              <span className="usage__count" aria-label={t.times(fmtInt(r.count, lang))}>{fmtInt(r.count, lang)}</span>
              <span className="usage__meter" aria-hidden="true"><span style={{ width: `${Math.max(4, Math.round(r.share * 100))}%` }} /></span>
            </li>
          ))}
        </ol>
      ) : <p className="usage__empty">{t.topEmpty}</p>}
    </section>
  );
}

export default function UsageModal({ lang = "es", api = "", initialDays = DEFAULT_DAYS, onClose }) {
  const t = TU[lang === "en" ? "en" : "es"];
  const [days, setDays] = useState(PERIODS.includes(initialDays) ? initialDays : DEFAULT_DAYS);
  const [state, setState] = useState({ status: "loading", data: null });   // loading | ready | error
  const [attempt, setAttempt] = useState(0);
  const boxRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const ctrl = new AbortController();
    setState(s => ({ status: "loading", data: s.data }));
    fetchJson(usageUrl(api, days), { signal: ctrl.signal, timeout: 15000 })
      .then(d => { if (!isPublicSummary(d)) throw new Error("respuesta inesperada"); setState({ status: "ready", data: d }); })
      .catch(e => { if (!isAbort(e)) setState(s => ({ status: "error", data: s.data && s.data.days === days ? s.data : null })); });
    return () => ctrl.abort();
  }, [api, days, attempt]);

  // foco: entra al diálogo, queda atrapado dentro y vuelve a su origen al cerrar
  useEffect(() => {
    const before = document.activeElement;
    const box = boxRef.current;
    if (box) box.focus({ preventScroll: true });
    return () => { try { if (before && before.isConnected && typeof before.focus === "function") before.focus({ preventScroll: true }); } catch { /* no-op */ } };
  }, []);
  const onKey = useCallback((e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab" || !boxRef.current) return;
    const els = [...boxRef.current.querySelectorAll("button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])")];
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === boxRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, [onClose]);

  const { status, data } = state;
  const showing = data && isPublicSummary(data) ? data : null;
  const stale = showing && status === "loading" && showing.days !== days;
  const phone = showing ? mobileShare(showing.devices) : null;
  const tot = showing ? showing.totals : null;
  const generatedDay = showing && typeof showing.generated === "string" ? showing.generated.slice(0, 10) : null;

  return (
    <div className="modal" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKey}
        className="modal__box usage" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <h2 id={titleId} className="modal__title">{t.title}</h2>
          <button type="button" className="icon-btn" aria-label={t.close} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <p className="modal__p">{t.lead}</p>

        <div className="usage__periods" role="group" aria-label={t.period}>
          {PERIODS.map(d => (
            <button key={d} type="button" aria-pressed={d === days} className={d === days ? "is-on" : ""} onClick={() => setDays(d)}>
              {t.periodOpt(d)}
            </button>
          ))}
        </div>

        <div aria-live="polite" aria-busy={status === "loading"}>
          {status === "loading" && !showing && <p role="status" className="usage__status">{t.loading}</p>}
          {status === "loading" && stale && <p role="status" className="usage__status usage__status--inline">{t.stale}</p>}
          {status === "error" && (
            <div className="usage__error" role="alert">
              <p>{t.error}</p>
              <button type="button" className="usage__retry" onClick={() => setAttempt(n => n + 1)}>{t.retry}</button>
            </div>
          )}
        </div>

        {showing && (
          <div className={`usage__body${stale ? " is-stale" : ""}`}>
            <dl className="usage__stats">
              <div className="usage__stat usage__stat--hero">
                <dt>{t.visits}<span className="usage__hint">{t.visitsHint}</span></dt>
                <dd>{fmtInt(tot.visits, lang)}</dd>
              </div>
              <div className="usage__stat"><dt>{t.pageViews}</dt><dd>{fmtInt(tot.page_views, lang)}</dd></div>
              <div className="usage__stat"><dt>{t.questions}</dt><dd>{fmtInt(tot.questions_opened, lang)}</dd></div>
              <div className="usage__stat"><dt>{t.shares}</dt><dd>{fmtInt(tot.shares, lang)}</dd></div>
              <div className="usage__stat"><dt>{t.reminders}</dt><dd>{fmtInt(tot.reminders, lang)}</dd></div>
            </dl>

            <Chart data={showing} lang={lang} t={t} />

            <p className="usage__phone">{phone !== null ? t.phone(fmtInt(phone, lang)) : t.phoneNone}</p>

            <h3 className="credits__h">{t.top}</h3>
            <div className="usage__tops">
              {TOPS.map(([k, label]) => (
                <TopList key={k} title={t[label]} rows={topRows((showing.top || {})[k], k, lang)} lang={lang} t={t} />
              ))}
            </div>

            {showing.since && showing.all_time && (
              <p className="usage__since">{t.since(fmtLongDate(showing.since, lang), fmtInt(showing.all_time.visits, lang))}</p>
            )}
          </div>
        )}

        <h3 className="credits__h">{t.privacyTitle}</h3>
        <ul className="usage__privacy">
          {t.privacy.map(p => <li key={p}>{p}</li>)}
        </ul>
        <p className="modal__p modal__p--fine">
          <a className="usage__link" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">{t.privacyLink}</a>
          {generatedDay && <><br />{t.updated(fmtLongDate(generatedDay, lang))}</>}
        </p>
      </div>
    </div>
  );
}
