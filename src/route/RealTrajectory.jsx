// RealTrajectory.jsx — tarjeta «Trayectoria realista (Lambert)» en la pestaña Ruta.
// Compara la transferencia de Hohmann (circular, coplanar) con la solución de
// Lambert sobre las posiciones reales de los planetas, y dibuja un porkchop
// pequeño (C3 según fecha de salida y de llegada). Si el servidor falla o no
// responde, la tarjeta lo dice y la ruta de Hohmann sigue intacta.
import { useEffect, useMemo, useState, useId } from "react";
import { isAbort } from "../net.js";
import { track, trackNetError } from "../ui/track.js";
import {
  fetchTrajectory, delta, porkchopCells, topCells, porkchopFacts, gridPosition, bandLimits, BAND_COLORS,
} from "./trajectory.js";
import { TR, bodyName } from "./i18n.js";
import "./route.css";

// ─── Formato ─────────────────────────────────────────────────────────────────

const nf = (x, lang, max = 1, min = 0) =>
  Number(x).toLocaleString(lang === "es" ? "es" : "en-US", { maximumFractionDigits: max, minimumFractionDigits: min });
const signed = (x, lang, max = 0) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${nf(Math.abs(x), lang, max)}`;
const dayFmt = (lang, opts) => new Intl.DateTimeFormat(lang === "es" ? "es" : "en-US", { timeZone: "UTC", ...opts });
const fmtDay = (d, lang) => dayFmt(lang, { day: "numeric", month: "short", year: "numeric" }).format(d);
// Etiqueta corta de eje: «14 nov 26», mismo orden en ES y EN
const fmtTick = (d, lang) => {
  const mon = dayFmt(lang, { month: "short" }).format(d).replace(".", "");
  return `${d.getUTCDate()} ${mon} ${String(d.getUTCFullYear()).slice(2)}`;
};

// ─── Datos ───────────────────────────────────────────────────────────────────

// status: loading | ok | empty (sin datos: 404 o respuesta inservible) | error
function useTrajectory(origin, destination) {
  const [st, setSt] = useState({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;
    setSt({ status: "loading", data: null });
    fetchTrajectory(origin, destination, { signal: ctrl.signal })
      .then((data) => {
        if (!alive) return;
        setSt(data ? { status: "ok", data } : { status: "empty", data: null });
        track("trajectory_card", { origin, destination, state: data ? "ok" : "empty" });
      })
      .catch((e) => {
        if (!alive || isAbort(e)) return;
        const gone = /HTTP (400|404|501)\b/.test(String(e && e.message));
        if (!gone) trackNetError("trajectory", e);
        setSt({ status: gone ? "empty" : "error", data: null });
        track("trajectory_card", { origin, destination, state: gone ? "empty" : "fail" });
      });
    return () => { alive = false; ctrl.abort(); };
  }, [origin, destination, attempt]);
  return [st, () => setAttempt((n) => n + 1)];
}

// ─── Porkchop (SVG) ──────────────────────────────────────────────────────────

const VB = { w: 320, h: 296, x0: 78, y0: 8, pw: 234, ph: 246 };

function Porkchop({ pork, hoh, lang, t, ariaId }) {
  const { cells, min } = useMemo(() => porkchopCells(pork), [pork]);
  const [pick, setPick] = useState(null);
  const cw = VB.pw / pork.nd, ch = VB.ph / pork.na;
  const cx = (i) => VB.x0 + i * cw, cy = (j) => VB.y0 + (pork.na - 1 - j) * ch;
  const limits = bandLimits(min.c3);
  const hp = gridPosition(pork, hoh.dep, hoh.arr);

  const onPick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VB.w, y = ((e.clientY - r.top) / r.height) * VB.h;
    const i = Math.floor((x - VB.x0) / cw), jRow = Math.floor((y - VB.y0) / ch);
    const j = pork.na - 1 - jRow;
    setPick(i >= 0 && i < pork.nd && j >= 0 && j < pork.na && pork.c3[i][j] !== null ? { i, j } : null);
  };

  const xt = [0, Math.floor((pork.nd - 1) / 2), pork.nd - 1];
  const yt = [0, Math.floor((pork.na - 1) / 2), pork.na - 1];
  const anchor = ["start", "middle", "end"];
  const sel = pick && { dep: pork.dep[pick.i], arr: pork.arr[pick.j], c3: pork.c3[pick.i][pick.j] };

  return (
    <>
      <svg className="rt-pork" viewBox={`0 0 ${VB.w} ${VB.h}`} role="img" aria-labelledby={ariaId}
        onClick={onPick} style={{ touchAction: "manipulation" }}>
        {cells.map((c) => (
          <rect key={`${c.i}-${c.j}`} x={cx(c.i)} y={cy(c.j)} width={cw + 0.5} height={ch + 0.5} fill={BAND_COLORS[c.band]} opacity={c.past ? 0.28 : 1} />
        ))}
        <rect x={VB.x0} y={VB.y0} width={VB.pw} height={VB.ph} fill="none" stroke="rgba(255,255,255,0.28)" />
        {xt.map((i, k) => (
          <g key={`x${i}`}>
            <line x1={cx(i) + cw / 2} x2={cx(i) + cw / 2} y1={VB.y0 + VB.ph} y2={VB.y0 + VB.ph + 4} stroke="rgba(255,255,255,0.5)" />
            <text className="rt-tick" x={cx(i) + cw / 2 + (k === 0 ? -4 : k === 2 ? 4 : 0)} y={VB.y0 + VB.ph + 17} textAnchor={anchor[k]}>{fmtTick(pork.dep[i], lang)}</text>
          </g>
        ))}
        {yt.map((j) => (
          <g key={`y${j}`}>
            <line x1={VB.x0 - 4} x2={VB.x0} y1={cy(j) + ch / 2} y2={cy(j) + ch / 2} stroke="rgba(255,255,255,0.5)" />
            <text className="rt-tick" x={VB.x0 - 7} y={cy(j) + ch / 2 + 4} textAnchor="end">{fmtTick(pork.arr[j], lang)}</text>
          </g>
        ))}
        <text className="rt-axis" x={VB.x0 + VB.pw / 2} y={VB.h - 6} textAnchor="middle">{t.axisDep} →</text>
        <text className="rt-axis" transform={`translate(12 ${VB.y0 + VB.ph / 2}) rotate(-90)`} textAnchor="middle">{t.axisArr} →</text>
        {hp && (
          <path d={`M${VB.x0 + (hp.x + 0.5) * cw} ${VB.y0 + (pork.na - 1 - hp.y + 0.5) * ch - 6}l6 6l-6 6l-6 -6z`}
            fill="none" stroke="#F2C46D" strokeWidth="2" />
        )}
        <circle cx={cx(min.i) + cw / 2} cy={cy(min.j) + ch / 2} r="6" fill="none" stroke="#04080F" strokeWidth="4.5" />
        <circle cx={cx(min.i) + cw / 2} cy={cy(min.j) + ch / 2} r="6" fill="none" stroke="#fff" strokeWidth="2" />
        {pick && <rect x={cx(pick.i)} y={cy(pick.j)} width={cw} height={ch} fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="2 2" />}
      </svg>
      <ul className="rt-legend" aria-label={t.legend}>
        {BAND_COLORS.map((col, k) => (
          <li key={col}>
            <span className="rt-swatch" style={{ background: col }} aria-hidden="true" />
            {k < limits.length ? t.legendUpTo(nf(limits[k], lang, 1)) : t.legendOver(nf(limits[limits.length - 1], lang, 1))}
          </li>
        ))}
        <li><span className="rt-mark rt-mark--min" aria-hidden="true" />{t.markMin}</li>
        {pork.notBefore && pork.dep[0] < pork.notBefore && <li><span className="rt-swatch rt-swatch--past" aria-hidden="true" />{t.markPast}</li>}
        {hp && <li><span className="rt-mark rt-mark--hoh" aria-hidden="true" />{t.markHohmann}</li>}
      </ul>
      <p className="rt-pick" role="status" aria-live="polite">
        {sel
          ? t.pickValue(fmtDay(sel.dep, lang), fmtDay(sel.arr, lang), Math.round((sel.arr - sel.dep) / 86400000), nf(sel.c3, lang, 1))
          : t.pickHint}
      </p>
    </>
  );
}

// ─── Tarjeta ─────────────────────────────────────────────────────────────────

function Row({ label, h, r, diff, lang, t }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{h}</td>
      <td className="rt-real">
        {r}
        {diff && diff.pct !== null && Math.abs(diff.pct) >= 0.5 && (
          <span className="rt-diff">{signed(diff.pct, lang)} %<span className="rt-sr"> {t.vsHohmann}</span></span>
        )}
      </td>
    </tr>
  );
}

function Body({ d, lang, t }) {
  const uid = useId();
  const o = d.opt, h = d.hoh;
  const oName = bodyName(d.origin, lang), dName = bodyName(d.destination, lang);
  const val = (x, max, unit) => `${nf(x, lang, max, max)} ${unit}`;
  const rows = [
    { k: "dep", label: t.rowDeparture, h: fmtDay(h.dep, lang), r: fmtDay(o.dep, lang) },
    { k: "arr", label: t.rowArrival, h: fmtDay(h.arr, lang), r: fmtDay(o.arr, lang) },
    { k: "dur", label: t.rowDuration, h: `${nf(h.days, lang, 0)} ${t.days}`, r: `${nf(o.days, lang, 0)} ${t.days}`, diff: delta(o.days, h.days) },
    { k: "c3", label: t.rowC3, h: val(h.c3, 1, t.unitC3), r: val(o.c3, 1, t.unitC3), diff: delta(o.c3, h.c3) },
    { k: "vd", label: t.rowVinfDep, h: val(h.vDep, 2, t.unitV), r: val(o.vDep, 2, t.unitV), diff: delta(o.vDep, h.vDep) },
    { k: "va", label: t.rowVinfArr, h: val(h.vArr, 2, t.unitV), r: val(o.vArr, 2, t.unitV), diff: delta(o.vArr, h.vArr) },
    { k: "dv", label: t.rowDv, h: val(h.dvHelio, 2, t.unitV), r: val(o.dvHelio, 2, t.unitV), diff: delta(o.dvHelio, h.dvHelio) },
  ];
  if (o.dvLow !== null && h.dvLow !== null) {
    rows.push({ k: "low", label: t.rowDvLow(oName, dName), h: val(h.dvLow, 2, t.unitV), r: val(o.dvLow, 2, t.unitV), diff: delta(o.dvLow, h.dvLow) });
  }
  const facts = d.pork ? porkchopFacts(d.pork) : null;
  const fmtFacts = facts && {
    min: nf(facts.min, lang, 1), dep: fmtDay(facts.dep, lang), arr: fmtDay(facts.arr, lang), days: facts.days,
    open: facts.openFrom && facts.openTo && facts.openFrom < facts.openTo,
    limit: facts.limit && nf(facts.limit, lang, 1),
    openFrom: facts.openFrom && fmtDay(facts.openFrom, lang), openTo: facts.openTo && fmtDay(facts.openTo, lang),
    depFirst: fmtDay(facts.depFirst, lang), depLast: fmtDay(facts.depLast, lang),
  };
  const assist = d.needsAssist && d.assistNote && (d.assistNote[lang] || d.assistNote.es);

  return (
    <>
      <p className="card__lead">{t.lead(bodyName(d.origin, lang), bodyName(d.destination, lang))}</p>

      <div className="rt-tablewrap">
        <table className="rt-table">
          <caption className="rt-sr">{t.tableCaption(oName, dName)}</caption>
          <thead>
            <tr><td /><th scope="col">{t.colHohmann}</th><th scope="col" className="rt-real">{t.colReal}</th></tr>
          </thead>
          <tbody>{rows.map((r) => <Row key={r.k} {...r} lang={lang} t={t} />)}</tbody>
        </table>
      </div>
      <p className="rt-note">{t.pctNote}</p>

      <p className="rt-why">
        {t.why({
          dh: nf(h.days, lang, 0), dr: nf(o.days, lang, 0), c3r: nf(o.c3, lang, 1), c3h: nf(h.c3, lang, 1), dep: fmtDay(o.dep, lang),
        })}
      </p>
      <p className="rt-note">{t.whyNote}</p>
      {d.startsToday && <p className="rt-note">{t.startsToday}</p>}
      {d.alt && <p className="rt-note">{t.altII(nf(d.alt.c3, lang, 1), nf(d.alt.days, lang, 0), nf(d.alt.vArr, lang, 1))}</p>}
      {assist && (
        <aside className="rt-assist" role="note">
          <strong>{t.assistTitle}</strong>
          <p>{assist}</p>
          <p className="rt-assist__foot">{t.assistFoot}</p>
        </aside>
      )}

      {d.pork && (
        <figure className="rt-fig">
          <h4 className="rt-h">{t.pork}</h4>
          <p className="rt-note">{t.porkLead}</p>
          <span id={`${uid}-aria`} className="rt-sr">{t.porkAria(fmtFacts)}</span>
          <Porkchop pork={d.pork} hoh={h} lang={lang} t={t} ariaId={`${uid}-aria`} />
          <figcaption className="rt-note">{t.porkSummary(fmtFacts)}</figcaption>
          <details className="rt-details">
            <summary>{t.tableToggle}</summary>
            <table className="rt-table rt-table--top">
              <caption className="rt-sr">{t.tableCaption2}</caption>
              <thead><tr><th scope="col">{t.thDep}</th><th scope="col">{t.thArr}</th><th scope="col">{t.thDays}</th><th scope="col">{t.thC3}</th></tr></thead>
              <tbody>
                {topCells(d.pork, 5).map((c) => (
                  <tr key={`${c.i}-${c.j}`}>
                    <td>{fmtDay(c.dep, lang)}</td><td>{fmtDay(c.arr, lang)}</td><td>{c.days}</td><td>{nf(c.c3, lang, 1, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </figure>
      )}

      <p className="rt-note">{t.method}</p>
      <p className="rt-note">{t.verified}</p>
    </>
  );
}

export default function RealTrajectory({ from, to, lang }) {
  const t = TR[lang] || TR.es;
  const [st, retry] = useTrajectory(from.id, to.id);
  return (
    <section className="card rt" aria-labelledby="rt-title">
      <div className="card__head">
        <h3 id="rt-title" className="card__title">{t.title}</h3>
        <span className="tag">{t.tag}</span>
      </div>
      {st.status === "loading" && (
        <div className="rt-state" role="status">
          <span className="rt-skel" /><span className="rt-skel rt-skel--short" />
          <p className="rt-note">{t.loading}</p>
        </div>
      )}
      {st.status === "error" && (
        <div className="rt-state rt-state--off" role="alert">
          <p className="rt-state__title">{t.errorTitle}</p>
          <p className="rt-note">{t.errorBody}</p>
          <button type="button" className="btn btn--ghost" onClick={retry}>{t.retry}</button>
        </div>
      )}
      {st.status === "empty" && (
        <div className="rt-state rt-state--off" role="status">
          <p className="rt-state__title">{t.emptyTitle}</p>
          <p className="rt-note">{t.emptyBody}</p>
        </div>
      )}
      {st.status === "ok" && <Body d={st.data} lang={lang} t={t} />}
    </section>
  );
}
