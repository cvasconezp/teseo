// EndTour.jsx — recorrido «¿Cómo terminará el universo?».
// Datos, fuentes y textos: endData.js. Cuentas: endPhysics.js. Aquí solo hay interfaz.
// Cinco pasos: caja de gas (flecha del tiempo), fotones Sol–Tierra, entropía de los agujeros
// negros, eras del futuro (escala logarítmica) y finales posibles según la energía oscura.
import { useEffect, useMemo, useState } from "react";
import {
  END_REFS, END_T, END_NEXT, BOX_SLIDER, MANY, LITRE_MOLECULES, T_SUN, BODIES, ENTROPY_BUDGET, HORIZON_LOG, STARS_LOG, CMB_K,
  BH_SLIDER, BH_PRESETS, ETA_SLIDER, NOW_ETA, EVENTS, ETA_PRESETS, PLANCK, W_SLIDER, CRUNCH, VACUUM, SCENARIOS,
} from "./endData.js";
import {
  sameSideOddsLog10, shake, leftCount, allOneSide, shakeMany, expectedHits, photonRatio, bhEntropyLog10, hawkingTempK,
  evapYearsLog10, massForEntropy, ripTimeGyr, scaleHistory, crunchSketch, eraAt, ERA_BOUNDS,
} from "./endPhysics.js";
import { readNumber, parseRoute } from "./physics.js";
import { num, sig, sci, big, years } from "./format.js";
import { TQ } from "./i18n.js";
import { Certainty, Refs, Why, Slider, Ticks, TourHead, ShareRow, NextLinks, useHashSync, Plot, Legend, pathOf, sub, Card } from "./shared.jsx";
import "./end.css";

const store = { n: null, eta: null, m: null, w: null, s: null, body: null };
const pow10 = (x) => Math.pow(10, x);
const clampTo = (v, s) => Math.min(s.max, Math.max(s.min, v));

function readHash() {
  try {
    const r = parseRoute(window.location.hash || "", ["end"]);
    if (r.id !== "end") return {};
    const p = r.params;
    const s = p.get("s");
    return {
      n: readNumber(p.get("n"), BOX_SLIDER.min, BOX_SLIDER.max),
      eta: readNumber(p.get("eta"), ETA_SLIDER.min, ETA_SLIDER.max),
      m: readNumber(p.get("m"), BH_SLIDER.min, BH_SLIDER.max),
      w: readNumber(p.get("w"), W_SLIDER.min, W_SLIDER.max),
      s: SCENARIOS.includes(s) ? s : null,
    };
  } catch { return {}; }
}

// «1 en X» legible: número, notación científica o «10 elevado a …» si ni siquiera cabe en un double.
function oddsText(log10, lang, T) {
  if (log10 < 6) return num(Math.round(pow10(log10)), lang);
  if (log10 < 300) return sci(pow10(log10), lang);
  return T.oddsHuge(sci(log10, lang));
}

// ── 1 · Caja de gas ────────────────────────────────────────────────────────
function GasBox({ pts, T }) {
  const W = 340, H = 168, P = 10;
  const l = leftCount(pts), all = allOneSide(pts);
  return (
    <svg className={`q-end-box ${all ? "is-all" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.boxAria(pts.length, l, pts.length - l)}>
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="14" className="q-end-box__wall" />
      <line x1={W / 2} x2={W / 2} y1="8" y2={H - 8} className="q-end-box__mid" />
      <g aria-hidden="true">
        {pts.map((p, i) => <circle key={i} cx={P + p.x * (W - 2 * P)} cy={P + p.y * (H - 2 * P)} r="5" className={`q-end-box__p ${p.left ? "is-l" : "is-r"}`} />)}
      </g>
    </svg>
  );
}

function BoxStep({ lang, t, T, n, setN }) {
  const [pts, setPts] = useState(() => shake(n));
  const [run, setRun] = useState(null);
  useEffect(() => { setPts(shake(n)); setRun(null); }, [n]);
  const l = leftCount(pts), all = allOneSide(pts);
  const odds = sameSideOddsLog10(n);
  const rows = [
    { id: "ten", n: 10 }, { id: "hundred", n: 100 }, { id: "litre", n: LITRE_MOLECULES },
  ];
  return (
    <section className="q-step" aria-labelledby="q-end-box">
      <h3 id="q-end-box" className="q-h3 q-step__title">{T.boxTitle}</h3>
      <p className="q-step__lead">{T.boxLead}</p>
      <div className="q-grid">
        <div className="q-grid__result">
          <figure className="q-fig">
            <GasBox pts={pts} T={T} />
            <p className="q-fig__pick" role="status" aria-live="polite">
              {T.boxNow(l, n - l)}{all ? <strong className="q-end-all"> {T.boxAll}</strong> : null}
            </p>
          </figure>
        </div>
        <div className="q-grid__controls">
          <Slider label={T.boxSlider} value={n} min={BOX_SLIDER.min} max={BOX_SLIDER.max} step={BOX_SLIDER.step} onChange={setN} valueText={T.boxValue(n)} />
          <div className="q-row">
            <button type="button" className="q-preset" data-preset="shake" onClick={() => { setPts(shake(n)); setRun(null); }}>{T.shakeOne}</button>
            <button type="button" className="q-preset" data-preset="shake-many" onClick={() => setRun({ hits: shakeMany(n, MANY), k: MANY })}>{T.shakeMany(num(MANY, lang))}</button>
          </div>
          <div className="q-readout" role="status" aria-live="polite" aria-atomic="true">
            <p className="q-readout__label">{T.boxOdds}</p>
            <p className="q-readout__big"><span className="q-readout__unit">{T.boxOne}</span> <span className="q-readout__n">{oddsText(odds, lang, T)}</span></p>
            {run && <p className="q-readout__fit">{T.boxRun(num(run.hits, lang), num(run.k, lang), sig(expectedHits(n, run.k), lang))}</p>}
          </div>
          <p><Certainty level="measured" t={t} short note={lang === "es" ? "es una cuenta exacta" : "an exact count"} /></p>
          <Why summary={T.whyBoxSummary}><p>{T.whyBox}</p></Why>
        </div>
      </div>
      <div className="q-end-big">
        <h4 className="q-end-big__title">{T.bigTitle}</h4>
        <dl className="q-end-big__list">
          {rows.map(r => (
            <div key={r.id}>
              <dt>{T.bigRows[r.id]}</dt>
              <dd>{T.boxOne} {oddsText(sameSideOddsLog10(r.n), lang, T)}</dd>
            </div>
          ))}
        </dl>
        <p className="q-fine">{T.litreNote(sci(LITRE_MOLECULES, lang))}</p>
        <Refs ids={["nistK"]} refs={END_REFS} lang={lang} t={t} />
      </div>
      <p className="q-step__p q-end-point">{T.boxPoint}</p>
    </section>
  );
}

// ── 2 · Fotones ────────────────────────────────────────────────────────────
function Photons({ k, name, T }) {
  const W = 340, H = 150, px = 230, py = 75;
  const out = Math.round(k);
  const rays = Array.from({ length: out }, (_, i) => {
    const a = (-70 + (140 * (i + 0.5)) / out) * (Math.PI / 180);
    return { x1: px + Math.cos(a) * 26, y1: py + Math.sin(a) * 26, x2: px + Math.cos(a) * (52 + (i % 3) * 9), y2: py + Math.sin(a) * (52 + (i % 3) * 9) };
  });
  return (
    <svg className="q-end-ph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.sunAria(out, name)}>
      <g aria-hidden="true">
        <circle cx="-18" cy={py} r="56" className="q-end-ph__sun" />
        <line x1="44" y1={py} x2={px - 30} y2={py} className="q-end-ph__in" />
        <path d={`M${px - 30} ${py}l-9 -5v10z`} className="q-end-ph__head" />
        <circle cx={px} cy={py} r="22" className="q-end-ph__planet" />
        {rays.map((r, i) => <line key={i} {...r} className="q-end-ph__out" />)}
        <text x="52" y={py - 10} className="q-end-ph__lbl">{T.sunIn}</text>
        <text x={W - 6} y={H - 8} textAnchor="end" className="q-end-ph__lbl q-end-ph__lbl--out">{T.sunOut(out)}</text>
      </g>
    </svg>
  );
}

function SunStep({ lang, t, T, body, setBody }) {
  const b = BODIES.find(x => x.id === body) || BODIES[0];
  const k = photonRatio(T_SUN, b.t);
  return (
    <section className="q-step" aria-labelledby="q-end-sun">
      <h3 id="q-end-sun" className="q-h3 q-step__title">{T.sunTitle}</h3>
      <p className="q-step__lead">{T.sunLead}</p>
      <figure className="q-fig">
        <Photons k={k} name={T.bodies[b.id]} T={T} />
        <p className="q-fine">{T.sunCalc(num(T_SUN, lang), num(b.t, lang, 1), num(k, lang, 1))}</p>
      </figure>
      <div className="q-row" role="group" aria-label={T.sunTitle}>
        {BODIES.map(x => (
          <button key={x.id} type="button" data-preset={`body-${x.id}`} className={`q-preset ${x.id === b.id ? "is-on" : ""}`} aria-pressed={x.id === b.id} onClick={() => setBody(x.id)}>{T.bodies[x.id]}</button>
        ))}
      </div>
      <p><Certainty level="estimated" t={t} short note={lang === "es" ? "aproximación de cuerpo negro" : "black-body approximation"} /></p>
      <p className="q-step__p q-end-point">{T.sunPoint}</p>
      <Why summary={T.whySunSummary}><p>{T.whySun}</p></Why>
      <Refs ids={["nasaEarth", "iau2015", "kleidon"]} refs={END_REFS} lang={lang} t={t} />
    </section>
  );
}

// ── 3 · Entropía y agujeros negros ─────────────────────────────────────────
const LEDGER_MIN = 76, LEDGER_MAX = 124;
const ledgerPct = (log) => ((log - LEDGER_MIN) / (LEDGER_MAX - LEDGER_MIN)) * 100;

function BhStep({ lang, t, T, m, setM }) {
  const S = bhEntropyLog10(pow10(m));
  const TH = hawkingTempK(pow10(m));
  const evap = evapYearsLog10(pow10(m));
  const beats = S > STARS_LOG;
  const tick = (v) => ((v - BH_SLIDER.min) / (BH_SLIDER.max - BH_SLIDER.min)) * 100;
  return (
    <section className="q-step" aria-labelledby="q-end-bh">
      <h3 id="q-end-bh" className="q-h3 q-step__title">{T.bhTitle}</h3>
      <p className="q-step__lead">{T.bhLead}</p>
      <figure className="q-fig q-end-ledger">
        <figcaption className="q-fig__title">{T.ledgerTitle}</figcaption>
        <ul className="q-end-ledger__list" role="img" aria-label={T.ledgerAria}>
          {ENTROPY_BUDGET.map(r => (
            <li key={r.id} className={`q-end-ledger__row q-end-ledger__row--${r.level}`} aria-hidden="true">
              <span className="q-end-ledger__lbl">{T.ledger[r.id]}</span>
              <span className="q-end-ledger__track"><i style={{ width: `${ledgerPct(r.log)}%` }} /></span>
              <span className="q-end-ledger__val">{sci(pow10(r.log), lang)}</span>
            </li>
          ))}
          <li className="q-end-ledger__row q-end-ledger__row--you" aria-hidden="true">
            <span className="q-end-ledger__lbl">{T.bhEntropy}</span>
            <span className="q-end-ledger__track"><i style={{ width: `${Math.max(0, ledgerPct(S))}%` }} /></span>
            <span className="q-end-ledger__val">{sci(pow10(S), lang)}</span>
          </li>
        </ul>
        <p className="q-fine">{T.ledgerNote(Math.round(HORIZON_LOG))}</p>
      </figure>
      <div className="q-grid q-gap">
        <div className="q-grid__controls">
          <Slider label={T.bhSlider} value={m} min={BH_SLIDER.min} max={BH_SLIDER.max} step={BH_SLIDER.step} onChange={setM} valueText={T.bhValue(big(pow10(m), lang), m < 0.01)}>
            <Ticks marks={[{ label: "Sgr A*", pct: tick(BH_PRESETS[1].log) }, { label: "M87*", pct: tick(BH_PRESETS[2].log) }]} />
          </Slider>
          <div className="q-row">
            {BH_PRESETS.map(p => {
              const on = Math.abs(m - p.log) < 0.03;
              return <button key={p.id} type="button" data-preset={`bh-${p.id}`} className={`q-preset ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => setM(p.log)}>{T.bhPresets[p.id]}</button>;
            })}
          </div>
        </div>
        <div className="q-grid__result">
          <div className="q-readout" role="status" aria-live="polite" aria-atomic="true">
            <p className="q-readout__label">{T.bhEntropy}</p>
            <p className="q-readout__big"><span className="q-readout__n">{sci(pow10(S), lang)}</span> <span className="q-readout__unit">k</span></p>
            <p className={`q-readout__fit ${beats ? "is-ok" : ""}`}>{beats ? T.bhVsStars : T.bhVsStarsNo(num(Math.round(massForEntropy(STARS_LOG)), lang))}</p>
            <p className="q-readout__sub">{T.bhTemp(sci(TH, lang))} {T.bhEvap(years(pow10(evap), lang))}</p>
          </div>
          <p className="q-note q-note--warn">{TH < CMB_K ? T.bhCold(num(CMB_K, lang, 4)) : T.bhWarm(num(CMB_K, lang, 4))}</p>
          <p><Certainty level="estimated" t={t} short note={lang === "es" ? "teoría bien establecida; aún no observada" : "well-established theory; not yet observed"} /></p>
          <Why summary={T.whyBhSummary}><p>{T.whyBh}</p></Why>
          <Refs ids={["egan2010", "bekenstein1973", "hawking1975", "fixsen2009", "ehtSgr", "ehtM87"]} refs={END_REFS} lang={lang} t={t} />
        </div>
      </div>
    </section>
  );
}

// ── 4 · Línea del tiempo ───────────────────────────────────────────────────
// «Hoy» se escribe con sus tres cifras (13.800 millones), no redondeado a dos.
const yearsAt = (eta, lang, T) => (Math.abs(eta - NOW_ETA) < 0.01 ? T.nowYears : years(pow10(eta), lang));
const ERA_COLORS = { stelliferous: "#F2C46D", degenerate: "#7DB9FF", blackhole: "#A78BFA", dark: "#3A4360" };
function Timeline({ eta, lang, T }) {
  const W = 340, x0 = 10, x1 = 330, sx = (v) => x0 + ((v - ETA_SLIDER.min) / (ETA_SLIDER.max - ETA_SLIDER.min)) * (x1 - x0);
  const era = eraAt(eta);
  return (
    <svg className="q-end-tl" viewBox={`0 0 ${W} 74`} role="img" aria-label={T.timeAria(yearsAt(eta, lang, T), T.eras[era].name)}>
      <g aria-hidden="true">
        {ERA_BOUNDS.map(e => {
          const a = Math.max(e.from, ETA_SLIDER.min), b = Math.min(e.to, ETA_SLIDER.max);
          return b > a ? <rect key={e.id} x={sx(a)} y="22" width={sx(b) - sx(a)} height="12" fill={ERA_COLORS[e.id]} opacity={e.id === era ? 1 : 0.45} /> : null;
        })}
        {EVENTS.map(ev => <circle key={ev.id} cx={sx(ev.eta)} cy="28" r="2.6" className={`q-end-tl__ev ${ev.eta <= eta + 0.01 ? "is-past" : ""}`} />)}
        <line x1={sx(eta)} x2={sx(eta)} y1="12" y2="44" className="q-end-tl__now" />
        <path d={`M${sx(eta)} 12l-5 -8h10z`} className="q-end-tl__head" />
        {[10, 30, 50, 70, 90, 110].map(v => <text key={v} x={sx(v)} y="62" textAnchor="middle" className="q-plot__tick">{sci(pow10(v), lang)}</text>)}
      </g>
    </svg>
  );
}

function TimeStep({ lang, t, T, eta, setEta }) {
  const era = eraAt(eta);
  const past = EVENTS.filter(e => e.eta <= eta + 0.01);
  const next = EVENTS.find(e => e.eta > eta + 0.01);
  const shown = past.slice(-3).reverse();
  const share = pow10(NOW_ETA - eta) * 100;
  const shareTxt = share >= 0.01 ? sig(share, lang) : sci(share, lang);
  const pct = lang === "es" ? `el ${shareTxt} %` : `${shareTxt}%`;
  const ev = (e) => (
    <li key={e.id} className="q-end-ev">
      <span className="q-end-ev__when">{yearsAt(e.eta, lang, T)}</span>
      <span className="q-end-ev__what">{T.events[e.id]}</span>
      <Certainty level={e.level} t={t} short />
    </li>
  );
  const refs = [...new Set(EVENTS.flatMap(e => e.refs))];
  return (
    <section className="q-step" aria-labelledby="q-end-time">
      <h3 id="q-end-time" className="q-h3 q-step__title">{T.timeTitle}</h3>
      <p className="q-step__lead">{T.timeLead}</p>
      <figure className="q-fig">
        <Timeline eta={eta} lang={lang} T={T} />
        <ul className="q-end-eras" aria-hidden="true">
          {ERA_BOUNDS.map(e => <li key={e.id} className={e.id === era ? "is-on" : ""}><i style={{ background: ERA_COLORS[e.id] }} />{T.eras[e.id].name}</li>)}
        </ul>
      </figure>
      <Slider label={T.etaSlider} value={eta} min={ETA_SLIDER.min} max={ETA_SLIDER.max} step={ETA_SLIDER.step} onChange={setEta} valueText={yearsAt(eta, lang, T)} />
      <div className="q-row">
        {ETA_PRESETS.map(p => {
          const on = Math.abs(eta - p.eta) < 0.05;
          return <button key={p.id} type="button" data-preset={`eta-${p.id}`} className={`q-preset ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => setEta(p.eta)}>{T.etaPresets[p.id]}</button>;
        })}
      </div>
      <div className="q-readout q-end-era" role="status" aria-live="polite" aria-atomic="true">
        <p className="q-readout__label">{yearsAt(eta, lang, T)}</p>
        <p className="q-end-era__name" style={{ color: ERA_COLORS[era] === "#3A4360" ? "#AEB7D6" : ERA_COLORS[era] }}>{T.eras[era].name}</p>
        <p className="q-readout__sub">{T.eras[era].body}</p>
        {eta > NOW_ETA + 0.05 && <p className="q-readout__fit">{T.pastShare(pct)}</p>}
      </div>
      <div className="q-end-evs">
        <h4 className="q-end-evs__title">{T.passed}</h4>
        <ul>{shown.map(ev)}</ul>
        <h4 className="q-end-evs__title">{T.next}</h4>
        {next ? <ul>{ev(next)}</ul> : <p className="q-fine">{T.nothingNext}</p>}
      </div>
      <Refs ids={refs} refs={END_REFS} lang={lang} t={t} />
    </section>
  );
}

// ── 5 · Finales ────────────────────────────────────────────────────────────
function EndPlot({ scen, w, lang, T }) {
  const std = useMemo(() => scaleHistory({ H0: PLANCK.H0, Om: PLANCK.Om, w: -1, tMax: 40, aMax: 7 }), []);
  const rip = useMemo(() => (scen === "rip" && w < -1 ? scaleHistory({ H0: PLANCK.H0, Om: PLANCK.Om, w, tMax: 40, aMax: 7 }) : null), [scen, w]);
  const crunch = useMemo(() => crunchSketch({ H0: PLANCK.H0, tPeak: CRUNCH.tPeak, tEnd: CRUNCH.tEnd }), []);
  const tRip = scen === "rip" ? ripTimeGyr(w, PLANCK.H0, PLANCK.Om) : Infinity;
  return (
    <Plot h={240} x={[-14, 40]} y={[0, 6]} xTicks={[-10, 0, 10, 20, 30, 40]} yTicks={[0, 2, 4, 6]} fmt={(v) => num(v, lang).replace("-", "−")}
      xLabel={T.plotX} yLabel={T.plotY} aria={T.plotAria(T.scen[scen].name)}>
      {({ sx, sy, m, h }) => {
        const line = (pts) => pathOf(pts.map(p => [sx(p.t), sy(p.a)]));
        return (
          <g aria-hidden="true">
            <defs><clipPath id="q-end-clip"><rect x={m.l} y={m.t} width={340 - m.l - m.r} height={h - m.t - m.b} /></clipPath></defs>
            <line x1={sx(0)} x2={sx(0)} y1={m.t} y2={h - m.b} className="q-plot__now" />
            <text x={sx(0) + 5} y={m.t + 10} className="q-plot__tick">{T.today}</text>
            <g clipPath="url(#q-end-clip)">
              <path d={line(std)} className={`q-plot__line ${scen === "freeze" || scen === "vacuum" ? "q-plot__line--you" : "q-plot__line--ref"}`} fill="none" />
              {rip && <path d={line(rip)} className="q-plot__line q-plot__line--you" fill="none" />}
              {scen === "crunch" && <path d={line(crunch)} className="q-plot__line q-plot__line--you q-end-sketch" fill="none" />}
              {Number.isFinite(tRip) && tRip < 40 && <line x1={sx(tRip)} x2={sx(tRip)} y1={m.t} y2={h - m.b} className="q-end-rip" />}
            </g>
            <circle cx={sx(0)} cy={sy(1)} r="4" className="q-plot__dotnow" />
          </g>
        );
      }}
    </Plot>
  );
}

function EndStep({ lang, t, T, scen, setScen, w, setW, hash }) {
  const tRip = ripTimeGyr(w, PLANCK.H0, PLANCK.Om);
  const legend = scen === "crunch"
    ? [{ kind: "line", color: "var(--q-estimated)", dash: "5 4", label: T.legStd }, { kind: "line", color: "var(--thread)", dash: "2 5", label: T.legSketch }]
    : scen === "rip" && w < -1
      ? [{ kind: "line", color: "var(--q-estimated)", dash: "5 4", label: T.legStd }, { kind: "line", color: "var(--thread)", label: T.legScen }]
      : [{ kind: "line", color: "var(--thread)", label: T.legStd }];
  const wTick = (v) => ((v - W_SLIDER.min) / (W_SLIDER.max - W_SLIDER.min)) * 100;
  const fmtW = (v) => num(v, lang, 2).replace("-", "−");
  return (
    <section className="q-step" aria-labelledby="q-end-end">
      <h3 id="q-end-end" className="q-h3 q-step__title">{T.endTitle}</h3>
      <p className="q-step__lead">{T.endLead}</p>
      <div className="q-end-scen" role="group" aria-label={T.endTitle}>
        {SCENARIOS.map(s => (
          <button key={s} type="button" data-preset={`end-${s}`} className={`q-preset q-end-scen__btn ${s === scen ? "is-on" : ""}`} aria-pressed={s === scen} onClick={() => setScen(s)}>
            <span className="q-end-scen__name">{T.scen[s].name}</span>
            <span className="q-end-scen__short">{T.scen[s].short}</span>
          </button>
        ))}
      </div>
      <div className="q-grid">
        <div className="q-grid__result">
          <figure className="q-fig">
            <EndPlot scen={scen} w={w} lang={lang} T={T} />
            <Legend items={legend} />
            {scen === "vacuum" && <p className="q-fine">{T.vacuumNoPlot}</p>}
          </figure>
        </div>
        <div className="q-grid__controls">
          {scen === "freeze" && (<>
            <p className="q-step__p">{T.freezeText}</p>
            <p><Certainty level="estimated" t={t} short note={lang === "es" ? "lo que prefiere el modelo estándar" : "what the standard model prefers"} /></p>
            <Refs ids={["planck2018", "adams1997"]} refs={END_REFS} lang={lang} t={t} />
          </>)}
          {scen === "rip" && (<>
            <Slider label={T.wSlider} hint={T.wHint} value={w} min={W_SLIDER.min} max={W_SLIDER.max} step={W_SLIDER.step} onChange={setW} valueText={T.wValue(fmtW(w))}>
              <Ticks marks={[{ label: "Planck", pct: wTick(PLANCK.w) }]} />
            </Slider>
            <div className="q-readout" role="status" aria-live="polite">
              <p className="q-readout__fit">{Number.isFinite(tRip) ? T.ripIn(num(tRip, lang, tRip < 100 ? 1 : 0)) : T.ripNever}</p>
            </div>
            <p className="q-step__p">{T.ripText(fmtW(PLANCK.w), num(PLANCK.wErr, lang, 2))}</p>
            <p className="q-fine">{sub(T.ripCheck(num(ripTimeGyr(-1.5, 70, 0.3), lang, 1)))}</p>
            <p><Certainty level="unknown" t={t} short note={lang === "es" ? "las mediciones no lo favorecen" : "measurements do not favour it"} /></p>
            <Refs ids={["caldwell2003", "planck2018", "desi2025"]} refs={END_REFS} lang={lang} t={t} />
          </>)}
          {scen === "crunch" && (<>
            <p className="q-step__p">{T.crunchText(num(CRUNCH.tPeak, lang), num(CRUNCH.tEnd, lang), num(CRUNCH.total, lang))}</p>
            <p className="q-note q-note--warn">{T.crunchHint}</p>
            <p><Certainty level="unknown" t={t} short note={lang === "es" ? "una hipótesis entre varias" : "one hypothesis among several"} /></p>
            <Refs ids={["luu2025", "desi2025"]} refs={END_REFS} lang={lang} t={t} />
          </>)}
          {scen === "vacuum" && (<>
            <p className="q-step__p">{T.vacuumText(VACUUM.best, VACUUM.low95)}</p>
            <p><Certainty level="unknown" t={t} short note={lang === "es" ? "depende de física aún no medida" : "depends on physics not yet measured"} /></p>
            <Refs ids={["andreassen2018"]} refs={END_REFS} lang={lang} t={t} />
          </>)}
          <ShareRow hash={hash} t={t} />
        </div>
      </div>
    </section>
  );
}

export default function EndTour({ lang = "es", indexHref }) {
  const t = TQ[lang] || TQ.es;
  const T = END_T[lang] || END_T.es;
  const fromHash = useMemo(readHash, []);
  const [n, setN] = useState(() => fromHash.n ?? store.n ?? BOX_SLIDER.start);
  const [body, setBody] = useState(() => store.body ?? "earth");
  const [m, setM] = useState(() => fromHash.m ?? store.m ?? BH_SLIDER.start);
  const [eta, setEta] = useState(() => fromHash.eta ?? store.eta ?? ETA_SLIDER.start);
  const [w, setW] = useState(() => fromHash.w ?? store.w ?? W_SLIDER.start);
  const [scen, setScen] = useState(() => fromHash.s ?? store.s ?? "freeze");
  useEffect(() => { Object.assign(store, { n, body, m, eta, w, s: scen }); }, [n, body, m, eta, w, scen]);

  const prefix = lang === "es" ? "preguntas" : "questions";
  const r2 = (v) => Math.round(v * 100) / 100;
  const hash = `#${prefix}?q=end&n=${n}&m=${r2(m)}&eta=${r2(eta)}&w=${r2(w)}&s=${scen}`;
  useHashSync(hash);

  return (
    <section className="q q-tour q-end" aria-labelledby="q-title">
      <TourHead t={t} title={T.title} lead={T.lead} indexHref={indexHref} />
      <BoxStep lang={lang} t={t} T={T} n={n} setN={(v) => setN(clampTo(Math.round(v), BOX_SLIDER))} />
      <SunStep lang={lang} t={t} T={T} body={body} setBody={setBody} />
      <BhStep lang={lang} t={t} T={T} m={m} setM={(v) => setM(clampTo(v, BH_SLIDER))} />
      <TimeStep lang={lang} t={t} T={T} eta={eta} setEta={(v) => setEta(clampTo(v, ETA_SLIDER))} />
      <EndStep lang={lang} t={t} T={T} scen={scen} setScen={setScen} w={w} setW={(v) => setW(clampTo(v, W_SLIDER))} hash={hash} />

      <section className="q-thread" aria-labelledby="q-thread-title">
        <h3 id="q-thread-title" className="q-h3 q-thread__title">{T.threadTitle}</h3>
        <Card id="q-end-known" title={T.known.title} teaser={T.known.teaser} level="measured" t={t}>
          <p>{T.known.p1}</p>
          <Refs ids={["planck2018", "egan2010"]} refs={END_REFS} lang={lang} t={t} />
        </Card>
        <Card id="q-end-unknown" title={T.unknown.title} teaser={T.unknown.teaser} level="unknown" t={t}>
          <p>{T.unknown.p1}</p><p>{T.unknown.p2}</p>
          <Refs ids={["desi2025", "superk2020"]} refs={END_REFS} lang={lang} t={t} />
        </Card>
      </section>

      <nav className="q-end-links" aria-labelledby="q-end-links">
        <h3 id="q-end-links" className="q-next__title">{T.linksTitle}</h3>
        <ul>
          <li><a href={`#${prefix}?q=expansion`}>{T.linkExp}</a></li>
          <li><a href={`#${prefix}?q=bh`}>{T.linkBh}</a></li>
        </ul>
      </nav>

      <p className="q-fine q-honest">{T.honest}</p>
      <NextLinks links={END_NEXT} lang={lang} t={t} />
    </section>
  );
}
