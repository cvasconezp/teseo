// ScaleTour.jsx — recorrido «¿Qué tan grande es el universo?» (antes la pestaña «Escala»).
// Los números salen de scaleData.js y los textos de scaleText.js: aquí solo hay interfaz.
import { useEffect, useMemo, useState } from "react";
import {
  SCALE_REFS, SCALE_NEXT, OBJECT_IDS, CAT_COLOR, RULER_TICKS, RULER_STEPS, SPEEDS, TRIP_IDS, TRIP_MARKS,
  Z_PRESETS, Z_STEPS, PLANCK_AGE, VOYAGER_SPEED_MS, VOYAGER_LIGHT_DAY_UTC, COSMO,
  rulerObjects, lightTimeSec, rulerPos, nearestObject, voyagerAt, travelSeconds, tripPos,
  quizRounds, zFromStep, stepFromZ, farView, horizonLy, ageYears, ageAtYears, comovingLy,
  distText, timeText, gText, yearLeft, dateText, readScaleState, Z_CMB,
} from "./scaleData.js";
import { SCALE_T } from "./scaleText.js";
import { parseRoute } from "./physics.js";
import { YEAR } from "./constants.js";
import { num, sig } from "./format.js";
import { TQ } from "./i18n.js";
import { Certainty, Card, Refs, Why, Slider, Ticks, TourHead, ShareRow, useHashSync, sub } from "./shared.jsx";
import "./scale.css";

const store = { obj: null, trip: null, z: null, quiz: null };

function readHash() {
  try {
    const r = parseRoute(window.location.hash || "", ["scale"]);
    if (r.id !== "scale") return {};
    return readScaleState(r.params);
  } catch { return {}; }
}

function Step({ id, title, lead, children }) {
  return (
    <section className="q-step" aria-labelledby={id}>
      <h3 id={id} className="q-h3 q-step__title">{title}</h3>
      {lead && <p className="q-step__lead">{lead}</p>}
      {children}
    </section>
  );
}

// ─── Paso 1: la regla ───────────────────────────────────────────────────────
function RulerStep({ lang, t, T, objs, obj, setObj, voy, now }) {
  const S = T.s1;
  const i = Math.max(0, objs.findIndex(o => o.id === obj));
  const o = objs[i];
  const value = Math.round(rulerPos(o.ly) * RULER_STEPS);
  const name = T.names[o.id];
  const far = o.lookback != null;
  const lt = lightTimeSec(o);
  const left = far || o.ly < 1 ? null : yearLeft(o.ly, now);
  const go = (k) => setObj(objs[Math.min(objs.length - 1, Math.max(0, k))].id);
  const onKey = (e) => {
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowUp" || k === "PageUp") { e.preventDefault(); go(i + 1); }
    else if (k === "ArrowLeft" || k === "ArrowDown" || k === "PageDown") { e.preventDefault(); go(i - 1); }
    else if (k === "Home") { e.preventDefault(); go(0); }
    else if (k === "End") { e.preventDefault(); go(objs.length - 1); }
  };
  const range = o.range ? [timeText(o.range[0] * YEAR, lang), timeText(o.range[1] * YEAR, lang)] : null;
  let note = null;
  if (o.id === "moon" || o.id === "sun") note = S.notes[o.id](range[0], range[1]);
  else if (o.id === "voyager") note = S.notes.voyager(dateText(voy.date, lang), voy.inRange, now.getTime() >= Date.parse(VOYAGER_LIGHT_DAY_UTC));
  else if (o.id === "betelgeuse") note = S.notes.betelgeuse(distText(o.range[0], lang), distText(o.range[1], lang), distText(o.other, lang));
  else if (o.id === "orion") note = S.notes.orion(distText(o.ly, lang), distText(o.other, lang));
  else if (typeof S.notes[o.id] === "string") note = S.notes[o.id];
  const tickPos = (ly) => `${rulerPos(ly) * 100}%`;
  return (
    <Step id="q-scale-s1" title={S.title} lead={S.lead}>
      <div className="sc-ruler">
        <div className="sc-ruler__rail" aria-hidden="true">
          <span className="sc-ruler__line" />
          {objs.map((p, k) => (
            <span key={p.id} className={`sc-ruler__dot ${k === i ? "is-on" : ""}`} style={{ left: tickPos(p.ly), "--c": CAT_COLOR[p.cat] }} />
          ))}
          <span className="sc-ruler__here" style={{ left: 0 }}>{S.here}</span>
        </div>
        <div className="q-slide__track sc-ruler__track">
          <label className="q-sr" htmlFor="sc-ruler-input">{S.sliderLabel}</label>
          <input id="sc-ruler-input" className="q-range q-range--plain sc-range" type="range" min={0} max={RULER_STEPS} step={1} value={value}
            style={{ "--fill": `${(value / RULER_STEPS) * 100}%`, "--c": CAT_COLOR[o.cat] }}
            aria-valuetext={S.sliderAria(name, distText(o.ly, lang))}
            onKeyDown={onKey}
            onChange={e => setObj(objs[nearestObject(objs, Number(e.target.value))].id)} />
        </div>
        <div className="sc-ticks" aria-hidden="true">
          {RULER_TICKS.map((tk, k) => (
            <span key={tk.id} className={`sc-ticks__t ${k % 2 ? "sc-ticks__t--low" : ""}`} style={{ left: tickPos(tk.ly) }}><i />{S.ticks[tk.id]}</span>
          ))}
        </div>
        <div className="sc-ruler__nav">
          <button type="button" className="q-preset" data-preset="obj-prev" onClick={() => go(i - 1)} disabled={i === 0}>← {S.closer}</button>
          <span className="sc-ruler__count" aria-hidden="true">{i + 1} / {objs.length}</span>
          <button type="button" className="q-preset" data-preset="obj-next" onClick={() => go(i + 1)} disabled={i === objs.length - 1}>{S.farther} →</button>
        </div>
      </div>

      <div className="q-result sc-card" style={{ "--c": CAT_COLOR[o.cat] }} role="status" aria-live="polite" aria-atomic="true">
        <p className="sc-card__name">{name}</p>
        <p className="sc-card__what">{T.what[o.id]}</p>
        <dl className="q-calc q-calc--solo sc-card__rows">
          <div><dt>{S.dist}</dt><dd>{distText(o.ly, lang)}</dd></div>
          <div><dt>{far ? S.lightFar : S.light}</dt><dd>{timeText(lt, lang)}</dd></div>
        </dl>
        {left && <p className="sc-card__left">{S.left(String(left.year), left.approx)}</p>}
        {far && <p className="q-note q-note--warn">{S.gnzWarn}</p>}
        {note && <p className="q-step__p">{note}</p>}
        <p className="sc-card__cert"><Certainty level={o.level} t={t} short /></p>
        <Refs ids={o.refs} refs={SCALE_REFS} lang={lang} t={t} />
      </div>
      {!far && o.id !== "moon" && o.id !== "sun" && o.id !== "voyager" && <p className="q-fine q-gap">{S.same}</p>}
    </Step>
  );
}

// ─── Paso 2: ¿cuánto tarda la luz? ─────────────────────────────────────────
function QuizStep({ lang, t, T, rounds }) {
  const S = T.s2;
  const [st, setSt] = useState(() => store.quiz || { k: 0, picks: {} });
  useEffect(() => { store.quiz = st; }, [st]);
  const n = rounds.length;
  const finished = st.k >= n;
  const score = rounds.filter(r => st.picks[r.id] === r.answer).length;
  const r = finished ? null : rounds[st.k];
  const pick = r ? st.picks[r.id] : undefined;
  const answered = pick !== undefined;
  const correct = r ? timeText(r.options[r.answer], lang) : "";
  const why = r ? (typeof S.why[r.id] === "function" ? S.why[r.id](correct) : S.why[r.id]) : "";
  return (
    <Step id="q-scale-s2" title={S.title} lead={S.lead}>
      <div className="sc-quiz">
        {!finished ? (<>
          <p className="sc-quiz__round">{S.round(st.k + 1, n)}</p>
          <p className="sc-quiz__q" id="sc-quiz-q">{S.q[r.id]}</p>
          <div className="sc-quiz__opts" role="group" aria-labelledby="sc-quiz-q">
            {r.options.map((s, j) => {
              const txt = timeText(s, lang);
              const cls = answered ? (j === r.answer ? "is-right" : j === pick ? "is-wrong" : "is-dim") : "";
              return (
                <button key={j} type="button" className={`q-preset sc-quiz__opt ${cls}`} data-preset={`quiz-${r.id}`}
                  aria-label={S.optionAria(txt)} aria-pressed={pick === j} disabled={answered}
                  onClick={() => setSt(p => ({ ...p, picks: { ...p.picks, [r.id]: j } }))}>{txt}</button>
              );
            })}
          </div>
          <div className="sc-quiz__fb" role="status" aria-live="polite">
            {answered && (<>
              <p className={`sc-quiz__verdict ${pick === r.answer ? "is-right" : "is-wrong"}`}>{pick === r.answer ? S.right : S.wrong(correct)}</p>
              <p className="q-step__p">{why}</p>
            </>)}
          </div>
          {answered && (
            <button type="button" className="btn btn--ghost sc-quiz__next" onClick={() => setSt(p => ({ ...p, k: p.k + 1 }))}>
              {st.k + 1 < n ? S.next : S.done}
            </button>
          )}
        </>) : (
          <div className="sc-quiz__end" role="status" aria-live="polite">
            <p className="sc-quiz__score">{S.score(score, n)}</p>
            <p className="q-step__p">{S.scoreNote(score, n)}</p>
            <button type="button" className="btn btn--ghost sc-quiz__next" data-preset="quiz-again" onClick={() => setSt({ k: 0, picks: {} })}>{S.again}</button>
          </div>
        )}
      </div>
      <Refs ids={["nistC"]} refs={SCALE_REFS} lang={lang} t={t} />
    </Step>
  );
}

// ─── Paso 3: viajes ─────────────────────────────────────────────────────────
function TripStep({ lang, t, T, objs, trip, setTrip }) {
  const S = T.s3;
  const o = objs.find(x => x.id === trip) || objs.find(x => x.id === "proxima");
  const dest = T.the[o.id];
  const speeds = S.speeds(sig(VOYAGER_SPEED_MS / 1000, lang, 3));
  const rows = SPEEDS.map(v => ({ ...v, sec: travelSeconds(o.ly, v.ms) }));
  const uniSec = PLANCK_AGE.gyr * 1e9 * YEAR;
  const beyond = rows.filter(r => r.id !== "light" && r.sec > uniSec);
  return (
    <Step id="q-scale-s3" title={S.title} lead={S.lead}>
      <div className="q-presets" role="group" aria-labelledby="sc-trip-dest">
        <p id="sc-trip-dest" className="q-presets__label">{S.destLabel}</p>
        <div className="q-presets__row sc-trip__chips">
          {TRIP_IDS.map(id => (
            <button key={id} type="button" data-preset={`trip-${id}`} className={`q-preset ${id === o.id ? "is-on" : ""}`}
              aria-pressed={id === o.id} onClick={() => setTrip(id)}>{S.chips[id]}</button>
          ))}
        </div>
      </div>
      <figure className="q-fig sc-trip">
        <figcaption className="q-fig__title">{distText(o.ly, lang)}</figcaption>
        <div role="img" aria-label={S.chartAria(dest, rows.map(r => `${S.vehicles[r.id]}, ${timeText(r.sec, lang)}`).join("; "))}>
          <ul className="sc-bars" aria-hidden="true">
            {rows.map(r => (
              <li key={r.id} className={`sc-bars__row sc-bars__row--${r.id}`}>
                <span className="sc-bars__head">
                  <span className="sc-bars__who">{S.vehicles[r.id]} <span className="sc-bars__speed">{speeds[r.id]}</span></span>
                  <strong className="sc-bars__val">{timeText(r.sec, lang)}</strong>
                </span>
                <span className="sc-bars__track">
                  {TRIP_MARKS.map(m => <i key={m.id} className={`sc-bars__mark sc-bars__mark--${m.id}`} style={{ left: `${tripPos(m.sec) * 100}%` }} />)}
                  <span className="sc-bars__bar" style={{ width: `${Math.max(1.5, tripPos(r.sec) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
          <div className="sc-axis" aria-hidden="true">
            {TRIP_MARKS.map(m => (
              <span key={m.id} className={`sc-axis__t sc-axis__t--${m.id} ${m.id === "year" ? "sc-axis__t--low" : ""}`} style={{ left: `${tripPos(m.sec) * 100}%` }}><i />{S.marks[m.id]}</span>
            ))}
          </div>
        </div>
        <p className="q-fine">{S.axisNote}</p>
      </figure>
      <div aria-live="polite">
        {beyond.length > 0 && <p className="q-note q-note--warn">{S.beyond(dest, S.who[beyond[0].id])}</p>}
      </div>
      <p className="q-fine q-gap">{S.voyNote}</p>
      <p><Certainty level="estimated" t={t} short note={lang === "es" ? "velocidades supuestas" : "assumed speeds"} /></p>
      <Refs ids={["horizons", ...o.refs.filter(r => r !== "nistC")]} refs={SCALE_REFS} lang={lang} t={t} />
    </Step>
  );
}

// ─── Paso 4: lo más lejano ─────────────────────────────────────────────────
function FarStep({ lang, t, T, z, setZ }) {
  const S = T.s4;
  const zStep = stepFromZ(z);
  const f = useMemo(() => farView(z), [z]);
  const active = Z_PRESETS.find(p => Math.abs(p.z - z) <= p.z * 1e-4) || null;
  const zTxt = z < 1 ? sig(z, lang, 2) : z < 100 ? num(z, lang, 1) : num(z, lang, 0);
  const g = (x) => gText(x, lang);
  // Cifra grande + unidad: en miles de millones desde 1 000 millones; si no, en millones
  const big = (x, kind) => (x >= 1e9
    ? [g(x), kind === "y" ? S.gUnitY : S.gUnitLy]
    : [num(Math.round(x / 1e5) / 10, lang, 1), kind === "y" ? S.mUnitY : S.mUnitLy]);
  const [ltN, ltU] = big(f.lookback, "y"), [nowN, nowU] = big(f.now, "ly");
  const ltTxt = timeText(f.lookback * YEAR, lang), nowTxt = distText(f.now, lang);
  const MAX = 50e9;
  const bar = (x) => `${Math.max(0.6, (x / MAX) * 100)}%`;
  const hz = horizonLy(), cmb = comovingLy(Z_CMB);
  const age = ageYears();
  const tickPct = (zz) => (stepFromZ(zz) / Z_STEPS) * 100;
  return (
    <Step id="q-scale-s4" title={S.title} lead={S.lead}>
      <div className="q-grid">
        <div className="q-grid__result">
          <div className="q-result sc-far" role="status" aria-live="polite" aria-atomic="true">
            {z > 0 ? (
              <p className="sc-far__sentence">{S.sentence(<strong key="a" className="sc-far__lt">{ltTxt}</strong>, <strong key="b" className="sc-far__now">{nowTxt}</strong>)}</p>
            ) : <p className="sc-far__sentence">{S.here}</p>}
            <dl className="sc-far__rows">
              <div className="sc-far__row sc-far__row--lt"><dt>{S.rows.lookback}</dt><dd><span className="sc-far__n">{ltN}</span> <span className="sc-far__u">{ltU}</span></dd></div>
              <div className="sc-far__row sc-far__row--now"><dt>{S.rows.now}</dt><dd><span className="sc-far__n">{nowN}</span> <span className="sc-far__u">{nowU}</span></dd></div>
              <div className="sc-far__row sc-far__row--then"><dt>{S.rows.then}</dt><dd>{distText(f.then, lang)}</dd></div>
              <div className="sc-far__row sc-far__row--age"><dt>{S.rows.age}</dt><dd>{timeText(f.ageThen * YEAR, lang)}</dd></div>
            </dl>
            <p className="sc-card__cert"><Certainty level={S.tag} t={t} short note={S.tagNote} /></p>
          </div>

          <figure className="q-fig sc-three">
            <figcaption className="q-fig__title">{S.barsTitle}</figcaption>
            <div role="img" aria-label={S.barsAria(distText(f.then, lang), ltTxt, nowTxt)}>
              <ul className="sc-three__bars" aria-hidden="true">
                <li className="sc-three__row sc-three__row--then"><span className="sc-three__lbl">{S.rows.then}</span><span className="sc-three__track"><span className="sc-three__bar" style={{ width: bar(f.then) }} /></span></li>
                <li className="sc-three__row sc-three__row--lt"><span className="sc-three__lbl">{S.rows.lookback}</span><span className="sc-three__track"><span className="sc-three__bar" style={{ width: bar(f.lookback) }} /></span></li>
                <li className="sc-three__row sc-three__row--now"><span className="sc-three__lbl">{S.rows.now}</span><span className="sc-three__track"><span className="sc-three__bar" style={{ width: bar(f.now) }} /></span></li>
              </ul>
              <div className="sc-three__axis" aria-hidden="true">{[0, 10, 20, 30, 40, 50].map(v => <span key={v} style={{ left: `${v * 2}%` }}>{v}</span>)}</div>
              <p className="sc-three__axislbl" aria-hidden="true">{S.barsAxis}</p>
            </div>
            <p className="q-fine">{S.barsFine}</p>
          </figure>
        </div>

        <div className="q-grid__controls">
          <Slider label={S.sliderLabel} hint={S.sliderHint} value={zStep} min={0} max={Z_STEPS} step={1} onChange={(v) => setZ(zFromStep(v))}
            valueText={S.zValue(zTxt)} ariaText={S.zAria(zTxt, ltTxt, nowTxt)}>
            <Ticks marks={Z_PRESETS.map(p => ({ label: S.ticks[p.id], pct: tickPct(p.z) }))} />
          </Slider>
          <div className="q-presets" role="group" aria-label={S.sliderLabel}>
            <div className="q-presets__row q-presets__row--3">
              {Z_PRESETS.map(p => (
                <button key={p.id} type="button" data-preset={`z-${p.id}`} className={`q-preset ${active && active.id === p.id ? "is-on" : ""}`}
                  aria-pressed={!!active && active.id === p.id} onClick={() => setZ(p.z)}>{S.presets[p.id]}</button>
              ))}
            </div>
          </div>
          <div className="q-presets__note" aria-live="polite">
            {active ? <p>{S.presetNotes[active.id]}</p> : null}
            {active && active.id === "gnz11" && <Refs ids={["bunker2023", "oesch2016"]} refs={SCALE_REFS} lang={lang} t={t} />}
            {active && active.id === "virgo" && <Refs ids={["mei2007"]} refs={SCALE_REFS} lang={lang} t={t} />}
            {active && active.id === "cmb" && <Refs ids={["planck2018"]} refs={SCALE_REFS} lang={lang} t={t} />}
          </div>
          {active && active.id !== "virgo" && <p><Certainty level={S.zTag} t={t} short note={S.zTagNote} /></p>}

          <p className="sc-ant">{S.ant}</p>
          <p className="q-note q-note--warn">{S.fix}</p>

          <Why summary={S.why}>
            <p>{sub(S.whyBody)}</p>
            <ul className="q-formulas">{S.formulas.map(x => <li key={x} className="q-formula">{sub(x)}</li>)}</ul>
            <p>{S.check(num(age / 1e9, lang, 2), `${num(PLANCK_AGE.gyr, lang, 3)} ± ${num(PLANCK_AGE.err, lang, 3)}`)}</p>
            <p className="q-fine">{sub(`Ω_r = ${num(COSMO.Or * 1e5, lang, 1)} × 10⁻⁵ · Ω_Λ = ${num(COSMO.OL, lang, 3)}`)}</p>
            <Refs ids={["planck2018", "fixsen2009"]} refs={SCALE_REFS} lang={lang} t={t} />
          </Why>
        </div>
      </div>

      <Card id="q-scale-faster" title={S.faster.title} teaser={S.faster.teaser} level={S.faster.tag} t={t}>
        <p>{S.faster.p1(z > 0 ? `${sig(f.v, lang, 2)} ${lang === "es" ? "veces" : "times"}` : "0")}</p>
        <p>{S.faster.p2}</p>
        <Refs ids={["davis2004"]} refs={SCALE_REFS} lang={lang} t={t} />
      </Card>
      <Card id="q-scale-edge" title={S.edge.title} teaser={S.edge.teaser} level={S.edge.tag} t={t}>
        <p>{S.edge.p1(distText(hz, lang), distText(2 * hz, lang), distText(cmb, lang))}</p>
        <p>{S.edge.p2(num(Number(ageAtYears(Z_CMB).toPrecision(2)), lang))}</p>
        <Refs ids={["davis2004", "planck2018"]} refs={SCALE_REFS} lang={lang} t={t} />
      </Card>
      <Card id="q-scale-whole" title={S.whole.title} teaser={S.whole.teaser} level={S.whole.tag} t={t}>
        <p>{S.whole.p1}</p>
      </Card>
    </Step>
  );
}

export default function ScaleTour({ lang = "es", indexHref }) {
  const t = TQ[lang] || TQ.es;
  const T = SCALE_T[lang] || SCALE_T.es;
  const fromHash = useMemo(readHash, []);
  // La fecha se fija al abrir el recorrido: la Voyager 1 se mueve, pero no hace falta repintar.
  const now = useMemo(() => new Date(), []);
  const objs = useMemo(() => rulerObjects(now), [now]);
  const voy = useMemo(() => voyagerAt(now), [now]);
  const rounds = useMemo(() => quizRounds(now), [now]);
  const [obj, setObj] = useState(() => fromHash.obj ?? store.obj ?? "sun");
  const [trip, setTrip] = useState(() => fromHash.trip ?? store.trip ?? "proxima");
  const [z, setZ] = useState(() => fromHash.z ?? store.z ?? Z_PRESETS[1].z);
  useEffect(() => { store.obj = obj; store.trip = trip; store.z = z; }, [obj, trip, z]);

  const prefix = lang === "es" ? "preguntas" : "questions";
  const hash = `#${prefix}?q=scale&o=${obj}&d=${trip}&z=${Number(z.toPrecision(6))}`;
  useHashSync(hash);

  return (
    <section className="q q-tour q-scale-tour" aria-labelledby="q-title">
      <TourHead t={t} title={T.title} lead={T.lead} indexHref={indexHref} />

      <RulerStep lang={lang} t={t} T={T} objs={objs} obj={OBJECT_IDS.includes(obj) ? obj : "sun"} setObj={setObj} voy={voy} now={now} />
      <QuizStep lang={lang} t={t} T={T} rounds={rounds} />
      <TripStep lang={lang} t={t} T={T} objs={objs} trip={trip} setTrip={setTrip} />
      <FarStep lang={lang} t={t} T={T} z={z} setZ={setZ} />

      <ShareRow hash={hash} t={t} />

      <aside className="q-honesty q-assume" aria-labelledby="q-scale-assume">
        <h3 id="q-scale-assume" className="q-honesty__title">{T.assumptionsTitle}</h3>
        <ul className="q-assume__list">{T.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
      </aside>

      <section className="q-sources" aria-labelledby="q-scale-sources">
        <h3 id="q-scale-sources" className="q-h3">{T.sourcesTitle}</h3>
        <Refs ids={Object.keys(SCALE_REFS)} refs={SCALE_REFS} lang={lang} t={t} />
      </section>

      <p className="q-fine q-honest">{T.honest}</p>

      <nav className="q-next" aria-labelledby="q-next-title">
        <h3 id="q-next-title" className="q-next__title">{t.nextTitle}</h3>
        <ul>
          <li>
            <a href={`#${prefix}?q=expansion`}>{T.nextExpansionTitle}</a>
            <span>{T.nextExpansionNote}</span>
          </li>
          {SCALE_NEXT.map(l => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label[lang]}<span className="q-sr"> ({t.external})</span></a>
              <span>{l.note[lang]}</span>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
