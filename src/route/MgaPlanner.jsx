// MgaPlanner.jsx — tarjeta «Planifica tu viaje con catapultas» en la pestaña Ruta.
// Para el destino elegido (desde la Tierra) muestra la mejor ruta con asistencias
// gravitatorias para salir entre hoy y 25 años después, explicada paso a paso; la
// línea de esferas con fechas y Δv; el recorrido en un mapa con la escala del mapa
// de Ruta; las alternativas en una tabla; y los supuestos con sus fuentes. El
// cálculo vive en el servidor (GET /api/mga, app/mga.py): si aún está calculando,
// la tarjeta lo dice y vuelve a preguntar. Si falla, el resto de Ruta sigue igual.
import { useEffect, useMemo, useState, useId } from "react";
import PlanetSphere from "../ui/PlanetSphere.jsx";
import { isAbort } from "../net.js";
import { track, trackNetError } from "../ui/track.js";
import {
  fetchMga, pollDelay, MAX_POLLS, narrate, chips, routeName, tableRows, directComparison, routeGeometry,
  fmtLong, fmtShort, fmtDuration, fmtSpeed, nf, DIRECT_ONLY,
} from "./mga.js";
import { MGA } from "./i18n-mga.js";
import { nameOf } from "./i18n-assists.js";
import "./route.css";

// ─── Datos (con sondeo mientras el servidor calcula) ─────────────────────────

// status: loading | computing | ok | empty | error | slow | earth_only
function useMga(origin, destination) {
  const [st, setSt] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (origin !== "earth") {
      setSt({ status: "earth_only" });
      track("mga_card", { origin, destination, state: "earth_only" });
      return undefined;
    }
    const ctrl = new AbortController();
    let alive = true, timer = null, polls = 0;
    setSt({ status: "loading" });
    const run = () => {
      fetchMga(origin, destination, { signal: ctrl.signal })
        .then((r) => {
          if (!alive) return;
          if (r.state === "computing") {
            polls += 1;
            if (polls === 1) track("mga_card", { origin, destination, state: "computing" });
            if (polls > MAX_POLLS) { setSt({ status: "slow" }); return; }
            setSt({ status: "computing", progress: r.progress, queue: r.queue });
            timer = setTimeout(run, pollDelay(r));
            return;
          }
          if (r.state === "ok") setSt({ status: "ok", data: r.data });
          else setSt({ status: r.state === "earth_only" ? "earth_only" : "empty" });
          track("mga_card", { origin, destination, state: r.state === "ok" ? "ok" : r.state === "earth_only" ? "earth_only" : "empty" });
        })
        .catch((e) => {
          if (!alive || isAbort(e)) return;
          const gone = /HTTP (400|404|501)\b/.test(String(e && e.message));
          if (!gone) trackNetError("mga", e);
          setSt({ status: gone ? "empty" : "error" });
          track("mga_card", { origin, destination, state: gone ? "empty" : "fail" });
        });
    };
    run();
    return () => { alive = false; ctrl.abort(); clearTimeout(timer); };
  }, [origin, destination, attempt]);
  return [st, () => setAttempt((n) => n + 1)];
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

function ChipLine({ o, lang, t, name }) {
  const list = chips(o, lang);
  return (
    <ol className="mga-chips" aria-label={t.chipsAria(routeName(o.seq, name))}>
      {list.map((c, i) => (
        <li key={i} className={`mga-chip mga-chip--${c.kind}${c.bad ? " is-bad" : ""}`}>
          <span className="rt-sr">{t.chipSpoken(name(c.body), t.chipKind[c.kind], fmtLong(c.date, lang), c.dv, c.motor)}</span>
          <span className="mga-chip__vis" aria-hidden="true">
            <span className="mga-chip__sphere"><PlanetSphere id={c.body} size={28} spin={false} /></span>
            <span className="mga-chip__name">{name(c.body)}</span>
            <span className="mga-chip__date">{fmtShort(c.date, lang)}</span>
            {c.dv && <span className={`mga-chip__dv mga-dv--${c.sign}`}>{c.dv}</span>}
            {c.motor && <span className={`mga-chip__motor${c.bad ? " is-bad" : ""}`}>{t.motor} {c.motor}</span>}
          </span>
          {i < list.length - 1 && <span className="ga-arrow" aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}

function Figures({ o, lang, t }) {
  return (
    <dl className="mga-figs">
      <div><dt>{t.figDuration}</dt><dd>{fmtDuration(o.days, lang)}</dd></div>
      <div><dt>{t.figC3}</dt><dd>{nf(o.c3, lang, 1, 1)} <small>{t.unitC3}</small></dd></div>
      <div><dt>{t.figInj}</dt><dd>{fmtSpeed(o.inj, lang)}</dd></div>
      {o.arrival.dv !== null && <div><dt>{t.figArrival}</dt><dd>{fmtSpeed(o.arrival.dv, lang)}</dd></div>}
    </dl>
  );
}

function Steps({ o, lang, t, name }) {
  const steps = narrate(o, lang, t, name);
  return (
    <ol className="mga-steps" aria-label={t.stepsAria}>
      {steps.map((s, i) => (
        <li key={i} className={`mga-step mga-step--${s.kind}`}>
          <span className="mga-step__dot" aria-hidden="true">
            {s.kind === "warning" ? "!" : <PlanetSphere id={s.body} size={20} spin={false} />}
          </span>
          <p className="mga-step__text">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

const LEG_COLORS = ["#F2C46D", "#C4B5FD", "#F2C46D", "#C4B5FD", "#F2C46D", "#C4B5FD"];

function RouteMap({ o, lang, t, name }) {
  const uid = useId();
  const g = useMemo(() => routeGeometry(o), [o]);
  if (!g.legs.length) return null;
  const route = routeName(o.seq, name);
  return (
    <figure className="rt-fig mga-map">
      <h4 className="rt-h">{t.mapTitle}</h4>
      <svg viewBox="0 0 100 100" className="mga-map__svg" role="img" aria-labelledby={`${uid}-map`}>
        <title id={`${uid}-map`}>{t.mapAria(route, fmtLong(o.dep, lang), fmtLong(o.arr, lang))}</title>
        {g.orbits.map((c) => (
          <circle key={c.id} cx="50" cy="50" r={c.r} fill="none"
            stroke={c.on ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.1)"} strokeWidth={c.on ? 0.32 : 0.2} />
        ))}
        <circle cx="50" cy="50" r="2.4" fill="#FDBA3B" />
        {g.legs.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke={LEG_COLORS[i % LEG_COLORS.length]} strokeWidth="0.75"
            strokeLinecap="round" strokeLinejoin="round" strokeDasharray={o.legs[i] && o.legs[i].resonance ? "1.6 1" : undefined} />
        ))}
        {g.markers.map((m, i) => {
          const kind = m.kinds.includes("arrival") ? "arrival" : m.kinds.includes("launch") ? "launch" : "flyby";
          const w = m.nums.length > 1 ? 2.3 + 1.6 * (m.label.length - 1) / 2 : 2.3;
          return (
            <g key={i}>
              {m.nums.length > 1
                ? <rect x={m.x - w} y={m.y - 2.3} width={2 * w} height="4.6" rx="2.3" fill="#04080F" stroke="#F2C46D" strokeWidth="0.6" />
                : <circle cx={m.x} cy={m.y} r="2.3" fill="#04080F" stroke={kind === "arrival" ? "#C4B5FD" : kind === "launch" ? "#fff" : "#F2C46D"} strokeWidth="0.6" />}
              <text x={m.x} y={m.y + 1.0} textAnchor="middle" className="mga-map__num">{m.label}</text>
            </g>
          );
        })}
      </svg>
      <ol className="mga-map__legend">
        {g.events.map((e, i) => (
          <li key={i}><span className="mga-map__badge" aria-hidden="true">{i + 1}</span>{name(e.body)} · {fmtShort(e.date, lang)}</li>
        ))}
      </ol>
      <figcaption className="rt-note">{t.mapNote}</figcaption>
    </figure>
  );
}

function MiniRoute({ seq, name }) {
  return (
    <span className="mga-mini" aria-hidden="true">
      {seq.map((b, i) => <span key={i} className="mga-mini__s"><PlanetSphere id={b} size={14} spin={false} /></span>)}
    </span>
  );
}

function AltTable({ data, selId, onSelect, lang, t, name, direct }) {
  const rows = tableRows(data, lang);
  return (
    <div className="mga-tablewrap">
      <table className="rt-table rt-table--top mga-table">
        <caption className="rt-sr">{direct ? t.windowsCaption : t.altCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{direct ? t.thDep : t.thRoute}</th>
            {!direct && <th scope="col">{t.thDep}</th>}
            <th scope="col">{t.thDur}</th>
            {direct && <th scope="col">{t.thC3}</th>}
            <th scope="col">{t.thInj}</th>
            {!direct && <th scope="col">{t.thViable}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sel = r.id === selId;
            const label = t.rowAria(direct ? name(data.destination) : routeName(r.seq, name), r.dep, sel);
            return (
              <tr key={r.id} className={`${sel ? "is-sel" : ""}${r.viable ? "" : " is-bad"}`} onClick={() => onSelect(r.id)}>
                <td>
                  <button type="button" className="mga-rowbtn" aria-pressed={sel} aria-label={label} onClick={(e) => { e.stopPropagation(); onSelect(r.id); }}>
                    {direct ? <span>{r.dep}</span> : <MiniRoute seq={r.seq} name={name} />}
                    {!direct && r.isDirect && <span className="mga-pill">{t.direct}</span>}
                    {r.best && <span className="mga-pill mga-pill--best">{direct ? t.bestWindow : t.bestMark}</span>}
                  </button>
                </td>
                {!direct && <td>{r.depMonth}</td>}
                <td>{r.dur}</td>
                {direct && <td>{r.c3}</td>}
                <td>{r.inj}</td>
                {!direct && <td className={r.viable ? "mga-yes" : "mga-no"}>{r.viable ? `✓ ${t.yes}` : `✗ ${t.no}`}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Assumptions({ data, lang, t, origin }) {
  const giant = ["jupiter", "saturn", "uranus", "neptune"].includes(data.destination);
  const items = t.assumptions({ viable: fmtSpeed(data.viableDv, lang), giant, withInsertion: data.criterion === "with_insertion" });
  return (
    <details className="rt-details" onToggle={(e) => { if (e.currentTarget.open) track("mga_card", { origin, destination: data.destination, kind: "assumptions" }); }}>
      <summary>{t.assumptionsTitle}</summary>
      <ul className="mga-list">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
      <p className="rt-note">{t.validation}</p>
      {data.computedFor && <p className="rt-note">{t.computedFor(fmtLong(data.computedFor, lang))}</p>}
      <p className="rt-note">{t.sources}:</p>
      <ul className="ga-sources">
        {t.sourceList.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}
      </ul>
    </details>
  );
}

// ─── Cuerpo con datos ────────────────────────────────────────────────────────

function Body({ data, lang, t, origin }) {
  const name = (id, art = false) => nameOf(id, lang, art);
  const direct = DIRECT_ONLY.has(data.destination);
  const pool = useMemo(() => {
    const m = new Map();
    for (const o of [data.best, ...data.options, data.earliest, data.nextJupiter, data.directBest]) if (o && !m.has(o.id)) m.set(o.id, o);
    return m;
  }, [data]);
  const [selId, setSelId] = useState(data.best.id);
  useEffect(() => { setSelId(data.best.id); }, [data]);
  const sel = pool.get(selId) || data.best;
  const isBest = sel.id === data.best.id;
  const select = (id) => {
    if (id === selId) return;
    setSelId(id);
    track("mga_card", { origin, destination: data.destination, kind: "option" });
  };
  const destName = name(data.destination, true);
  const cmp = directComparison(sel, data, lang, t);
  const jupiterDest = ["saturn", "uranus", "neptune"].includes(data.destination) && data.jupiterCycle;
  // Si la salida más temprana es también la próxima por Júpiter, una sola caja (la de Júpiter) lo dice.
  const sameAsJupiter = jupiterDest && data.nextJupiter && data.earliest && data.nextJupiter.id === data.earliest.id;
  const showEarliest = !direct && data.earliest && data.earliest.id !== data.best.id && !sameAsJupiter;

  return (
    <>
      <p className="card__lead">{direct ? t.leadDirect(destName) : t.lead(destName)}</p>
      {data.refreshing && <p className="rt-note">{t.refreshing}</p>}
      {direct && (
        <aside className="rt-assist" role="note">
          <strong>{t.directOnlyTitle[data.destination]}</strong>
          <p>{t.directOnlyBody[data.destination]}</p>
        </aside>
      )}

      <h4 className="rt-h">{isBest ? (direct ? t.bestWindowTitle : sel.isDirect ? t.bestDirectTitle : t.bestTitle) : t.selTitle}</h4>
      <p className="mga-route">{routeName(sel.seq, name)}</p>
      {sel.mission && t.mission[sel.mission] && <p className="rt-note mga-mission">{t.mission[sel.mission]}</p>}
      {!isBest && <button type="button" className="mga-link" onClick={() => setSelId(data.best.id)}>{t.backToBest}</button>}
      <ChipLine o={sel} lang={lang} t={t} name={name} />
      <Figures o={sel} lang={lang} t={t} />
      <Steps o={sel} lang={lang} t={t} name={name} />
      {cmp && <p className="rt-why">{cmp}</p>}

      <RouteMap o={sel} lang={lang} t={t} name={name} />

      {showEarliest && (
        <section className="mga-box" aria-label={t.earliestTitle}>
          <h4 className="mga-box__title">{t.earliestTitle}</h4>
          <p>{t.earliestBody({ route: routeName(data.earliest.seq, name), date: fmtLong(data.earliest.dep, lang), years: fmtDuration(data.earliest.days, lang), dv: fmtSpeed(data.earliest.inj, lang) })}</p>
          {selId !== data.earliest.id && <button type="button" className="btn btn--ghost mga-box__btn" onClick={() => select(data.earliest.id)}>{t.showRoute}</button>}
        </section>
      )}
      {jupiterDest && (
        <section className="mga-box" aria-label={t.jupiterTitle}>
          <h4 className="mga-box__title">{t.jupiterTitle}</h4>
          {data.nextJupiter ? (
            <>
              <p>{t.jupiterBody({ date: fmtLong(data.nextJupiter.dep, lang), cycle: nf(data.jupiterCycle, lang, 0), dest: destName, route: routeName(data.nextJupiter.seq, name), years: fmtDuration(data.nextJupiter.days, lang) })}{sameAsJupiter && data.earliest.id !== data.best.id ? ` ${t.alsoEarliest}` : ""}</p>
              {selId !== data.nextJupiter.id && <button type="button" className="btn btn--ghost mga-box__btn" onClick={() => select(data.nextJupiter.id)}>{t.showRoute}</button>}
            </>
          ) : <p>{t.jupiterNone({ cycle: nf(data.jupiterCycle, lang, 0), dest: destName })}</p>}
        </section>
      )}

      <h4 className="rt-h">{direct ? t.windowsTitle : t.altTitle}</h4>
      <p className="rt-note">{t.altLead}</p>
      <AltTable data={data} selId={selId} onSelect={select} lang={lang} t={t} name={name} direct={direct} />
      {data.hohmann && (
        <p className="rt-note">{t.hohmannLine({ c3: nf(data.hohmann.c3, lang, 1), years: fmtDuration(data.hohmann.days, lang), dv: fmtSpeed(data.hohmann.inj, lang) })}</p>
      )}
      <Assumptions data={data} lang={lang} t={t} origin={origin} />
    </>
  );
}

// ─── Tarjeta ─────────────────────────────────────────────────────────────────

export default function MgaPlanner({ from, to, lang }) {
  const t = MGA[lang] || MGA.es;
  const [st, retry] = useMga(from.id, to.id);
  const pct = st.status === "computing" && st.progress > 0.02 ? Math.round(st.progress * 100) : 0;
  return (
    <section className="card rt mga" aria-labelledby="mga-title">
      <div className="card__head">
        <h3 id="mga-title" className="card__title">{t.title}</h3>
        <span className="tag">{t.tag}</span>
      </div>
      {(st.status === "loading" || st.status === "computing") && (
        <div className="rt-state" role="status" aria-live="polite">
          <span className="rt-skel" /><span className="rt-skel rt-skel--short" />
          <p className="rt-note">{st.status === "loading" ? t.loading : t.computing(pct)}</p>
          {st.status === "computing" && st.queue > 1 && <p className="rt-note">{t.computingQueue(st.queue - 1)}</p>}
        </div>
      )}
      {(st.status === "error" || st.status === "slow") && (
        <div className="rt-state rt-state--off" role="alert">
          <p className="rt-state__title">{st.status === "slow" ? t.slowTitle : t.errorTitle}</p>
          <p className="rt-note">{st.status === "slow" ? t.slowBody : t.errorBody}</p>
          <button type="button" className="btn btn--ghost" onClick={retry}>{t.retry}</button>
        </div>
      )}
      {st.status === "empty" && (
        <div className="rt-state rt-state--off" role="status">
          <p className="rt-state__title">{t.emptyTitle}</p>
          <p className="rt-note">{t.emptyBody}</p>
        </div>
      )}
      {st.status === "earth_only" && (
        <div className="rt-state rt-state--off" role="status">
          <p className="rt-state__title">{t.earthOnlyTitle}</p>
          <p className="rt-note">{t.earthOnlyBody}</p>
        </div>
      )}
      {st.status === "ok" && <Body data={st.data} lang={lang} t={t} origin={from.id} />}
    </section>
  );
}
