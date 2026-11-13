// ExpansionTour.jsx — recorrido "¿El universo se expande?".
// Datos y textos: expansionData.js. Física: physics.js. Aquí solo hay interfaz.
import { useEffect, useMemo, useState } from "react";
import { fetchJson, isAbort } from "../net.js";
import {
  EXP_REFS, EXP_T, SUPERNOVAE, H0_SLIDER, OL_SLIDER, PLANCK, SH0ES, KEY_PROJECT, TESEO_GALAXY_H0, TESEO_GALAXY_COUNT, CMB_AGE_YEARS, EXP_NEXT,
} from "./expansionData.js";
import {
  hubbleTimeGyr, ageGyr, scaleCurve, deceleration, slopeThroughOrigin, rmsResidual, sigmaTension, readNumber, parseRoute,
} from "./physics.js";
import { MPC_IN_LY } from "./constants.js";
import { num } from "./format.js";
import { TQ } from "./i18n.js";
import {
  Certainty, Card, Refs, Why, Slider, Ticks, TourHead, ShareRow, NextLinks, useHashSync, Plot, TapPoints, Legend, pathOf, sub,
} from "./shared.jsx";

const store = { h0: null, ol: null, galaxies: null };
const BEST = slopeThroughOrigin(SUPERNOVAE);
const BEST_RMS = rmsResidual(SUPERNOVAE, BEST);
const X_MAX = 500, Y_MAX = 34;                           // Mpc · miles de km/s

function readHash() {
  try {
    const r = parseRoute(window.location.hash || "", ["expansion"]);
    if (r.id !== "expansion") return {};
    return { h0: readNumber(r.params.get("h"), H0_SLIDER.min, H0_SLIDER.max), ol: readNumber(r.params.get("ol"), OL_SLIDER.min, OL_SLIDER.max) };
  } catch { return {}; }
}

function HubbleChart({ h0, lang, T, galaxies, sel, setSel }) {
  const h0Txt = num(h0, lang, 1);
  return (
    <Plot h={262} x={[0, X_MAX]} y={[0, Y_MAX]} xTicks={[0, 100, 200, 300, 400, 500]} yTicks={[0, 10, 20, 30]}
      xLabel={T.xLabel} yLabel={T.yLabel} aria={T.chartAria(SUPERNOVAE.length, h0Txt)}>
      {({ sx, sy }) => {
        const dEnd = Math.min(X_MAX, (Y_MAX * 1000) / h0);
        const pts = SUPERNOVAE.map(p => ({ x: sx(p.d), y: sy(p.v / 1000), label: T.pointAria(p.name, num(p.d, lang, 1), num(p.v, lang)) }));
        return (<>
          {galaxies && (
            <path aria-hidden="true" className="q-plot__cloud"
              d={galaxies.map(d => `M${sx(d).toFixed(1)} ${sy((TESEO_GALAXY_H0 * d) / 1000).toFixed(1)}h0`).join("")} />
          )}
          <line aria-hidden="true" x1={sx(0)} y1={sy(0)} x2={sx(dEnd)} y2={sy((h0 * dEnd) / 1000)} className="q-plot__line q-plot__line--you" />
          <TapPoints points={pts} selected={sel} onSelect={setSel} className="q-pt--measured" />
        </>);
      }}
    </Plot>
  );
}

function ScaleChart({ ol, lang, T, age, ageNo }) {
  const X = [-15, 15], Y = [0, 3];
  const yours = useMemo(() => scaleCurve(PLANCK.H0, 1 - ol, ol, 3.4), [ol]);
  const matter = useMemo(() => scaleCurve(PLANCK.H0, 1, 0, 3.4), []);
  return (
    <Plot h={240} x={X} y={Y} xTicks={[-15, -10, -5, 0, 5, 10, 15]} yTicks={[0, 1, 2, 3]} fmt={(v) => num(v, lang).replace("-", "−")}
      xLabel={T.aX} yLabel={T.aY} aria={T.aAria(num(age, lang, 1), num(ageNo, lang, 1))}>
      {({ sx, sy, m, h }) => {
        const line = (curve, t0) => pathOf(curve.map(p => [sx(p.t - t0), sy(p.a)]));
        return (
          <g aria-hidden="true">
            <defs><clipPath id="q-a-clip"><rect x={m.l} y={m.t} width={340 - m.l - m.r} height={h - m.t - m.b} /></clipPath></defs>
            <line x1={sx(0)} x2={sx(0)} y1={m.t} y2={h - m.b} className="q-plot__now" />
            <text x={sx(0) + 5} y={m.t + 10} className="q-plot__tick">{T.today}</text>
            <g clipPath="url(#q-a-clip)">
              <path d={line(matter, ageNo)} className="q-plot__line q-plot__line--ref" fill="none" />
              <path d={line(yours, age)} className="q-plot__line q-plot__line--you" fill="none" />
            </g>
            <circle cx={sx(0)} cy={sy(1)} r="4" className="q-plot__dotnow" />
          </g>
        );
      }}
    </Plot>
  );
}

function TensionCard({ h0, lang, t, T }) {
  const k = T.tension;
  const lo = 64, hi = 76;
  const pct = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  const s = sigmaTension(SH0ES.H0, SH0ES.H0err, PLANCK.H0, PLANCK.H0err);
  const fmt = (o) => `${num(o.H0, lang, 2)} ± ${num(o.H0err, lang, 2)}`;
  const rows = [{ id: "planck", label: k.planck, o: PLANCK }, { id: "shoes", label: k.shoes, o: SH0ES }];
  const inRange = h0 >= lo && h0 <= hi;
  return (
    <Card id="q-exp-tension" title={k.title} teaser={k.teaser} level={k.tag} levelNote={k.tagNote} t={t}>
      <p>{k.p1}</p>
      <div className="q-tension" role="img" aria-label={k.aria(fmt(PLANCK), fmt(SH0ES), num(s, lang, 1))}>
        {rows.map(r => (
          <div key={r.id} className={`q-tension__row q-tension__row--${r.id}`}>
            <p className="q-tension__lbl">{r.label} <strong>{fmt(r.o)}</strong></p>
            <div className="q-tension__track">
              <i className="q-tension__err" style={{ left: pct(r.o.H0 - r.o.H0err), width: `${((2 * r.o.H0err) / (hi - lo)) * 100}%` }} />
              <i className="q-tension__dot" style={{ left: pct(r.o.H0) }} />
            </div>
          </div>
        ))}
        <div className="q-tension__row q-tension__row--you">
          <p className="q-tension__lbl">{k.yours} <strong>{num(h0, lang, 1)}</strong></p>
          <div className="q-tension__track">{inRange && <i className="q-tension__dot" style={{ left: pct(h0) }} />}</div>
        </div>
        <div className="q-tension__axis" aria-hidden="true">
          {[64, 67, 70, 73, 76].map(v => <span key={v} style={{ left: pct(v) }}>{v}</span>)}
        </div>
        <p className="q-tension__axislbl" aria-hidden="true">{k.axis}</p>
      </div>
      <p>{k.sigma(num(s, lang, 1))}</p>
      <p>{k.p2}</p>
      <Refs ids={["planck2018", "riess2022"]} refs={EXP_REFS} lang={lang} t={t} />
    </Card>
  );
}

export default function ExpansionTour({ lang = "es", indexHref }) {
  const t = TQ[lang] || TQ.es;
  const T = EXP_T[lang] || EXP_T.es;
  const fromHash = useMemo(readHash, []);
  const [h0, setH0] = useState(() => fromHash.h0 ?? store.h0 ?? H0_SLIDER.start);
  const [ol, setOl] = useState(() => fromHash.ol ?? store.ol ?? PLANCK.OL);
  const [sel, setSel] = useState(null);
  const [gal, setGal] = useState(store.galaxies ? { status: "ok", shown: false } : { status: "idle", shown: false });
  useEffect(() => { store.h0 = h0; store.ol = ol; }, [h0, ol]);

  const hash = `#${lang === "es" ? "preguntas" : "questions"}?q=expansion&h=${h0}&ol=${Number(ol.toFixed(3))}`;
  useHashSync(hash);

  // Las galaxias de Teseo solo se descargan (326 KB) si alguien pide verlas.
  const [wantGal, setWantGal] = useState(false);
  useEffect(() => {
    if (!wantGal || store.galaxies) return;
    const ctrl = new AbortController();
    setGal({ status: "loading", shown: true });
    fetchJson("/galaxies.json", { signal: ctrl.signal })
      .then(d => {
        if (!d || !Array.isArray(d.objects)) throw new Error("bad payload");
        store.galaxies = d.objects.map(o => Number(o.dist_ly) / MPC_IN_LY).filter(x => x > 0 && x <= X_MAX);
        setGal({ status: "ok", shown: true });
      })
      .catch(e => { if (!isAbort(e)) { setGal({ status: "error", shown: false }); setWantGal(false); } });
    return () => ctrl.abort();
  }, [wantGal]);
  const toggleGal = () => {
    if (store.galaxies) setGal(g => ({ status: "ok", shown: !g.shown }));
    else setWantGal(true);
  };
  const galaxies = gal.status === "ok" && gal.shown ? store.galaxies : null;

  const rms = rmsResidual(SUPERNOVAE, h0);
  const fits = rms < BEST_RMS * 1.15;
  const hubbleAge = hubbleTimeGyr(h0);
  const p = sel == null ? null : SUPERNOVAE[sel];

  const age = ageGyr(PLANCK.H0, 1 - ol, ol), ageNo = ageGyr(PLANCK.H0, 1, 0);
  const q0 = deceleration(1 - ol, ol);
  const atPlanck = Math.abs(ol - PLANCK.OL) < 0.003;
  const olPct = (v) => num(v * 100, lang, 1);
  const tickPct = (v, s) => ((v - s.min) / (s.max - s.min)) * 100;

  return (
    <section className="q q-tour q-exp" aria-labelledby="q-title">
      <TourHead t={t} title={T.title} lead={T.lead} indexHref={indexHref} />

      <div className="q-grid">
        <div className="q-grid__result">
          <figure className="q-fig">
            <figcaption className="q-fig__title">{T.chartTitle}</figcaption>
            <HubbleChart h0={h0} lang={lang} T={T} galaxies={galaxies} sel={sel} setSel={setSel} />
            <Legend items={[
              { kind: "dot", color: "var(--q-measured)", label: T.legPoints },
              { kind: "line", color: "var(--thread)", label: T.legLine },
              ...(galaxies ? [{ kind: "line", color: "#9DB4FF", dash: "1 5", label: T.legTeseo }] : []),
            ]} />
            <p className="q-fig__pick" role="status" aria-live="polite">
              {p ? T.picked(p.name, num(p.d, lang, 1), num(p.v, lang), num(Math.round((p.d * MPC_IN_LY) / 1e6 / 10) * 10, lang)) : T.pick}
            </p>
            {p && <p className="q-fine">{T.backNote}</p>}
          </figure>
        </div>

        <div className="q-grid__controls">
          <Slider label={T.slider} hint={T.sliderHint} value={h0} min={H0_SLIDER.min} max={H0_SLIDER.max} step={H0_SLIDER.step}
            onChange={setH0} valueText={T.sliderValue(num(h0, lang, 1))}>
            <Ticks marks={[{ label: "Planck", pct: tickPct(PLANCK.H0, H0_SLIDER) }, { label: "SH0ES", pct: tickPct(SH0ES.H0, H0_SLIDER) }]} />
          </Slider>

          <div className="q-readout" role="status" aria-live="polite" aria-atomic="true">
            <p className="q-readout__label">{T.ageLabel}</p>
            <p className="q-readout__big"><span className="q-readout__n">{num(hubbleAge, lang, 1)}</span> <span className="q-readout__unit">{T.ageUnit}</span></p>
            <p className={`q-readout__fit ${fits ? "is-ok" : ""}`}>{T.fit}: <strong>{num(Math.round(rms / 10) * 10, lang)} {T.fitUnit}</strong>. {fits ? T.fitGood : T.fitOff}</p>
          </div>
          <p><Certainty level="estimated" t={t} short note={lang === "es" ? "1 ÷ H₀ es una aproximación" : "1 ÷ H₀ is an approximation"} /></p>
          <p className="q-fine q-gap">{T.ageNote}</p>

          <div className="q-row">
            <button type="button" className="btn btn--ghost" onClick={() => setH0(Math.round(BEST * 2) / 2)}>{T.best}</button>
          </div>
          <p className="q-fine q-gap">{T.bestNote(num(BEST, lang, 1), `${KEY_PROJECT.H0} ± ${KEY_PROJECT.random} ± ${KEY_PROJECT.systematic}`)}</p>

          <Why summary={T.whySummary}>
            <p>{T.whyBody}</p>
            <Refs ids={["freedman2001", "hubble1929"]} refs={EXP_REFS} lang={lang} t={t} />
          </Why>

          <aside className="q-honesty" aria-labelledby="q-exp-circ">
            <h3 id="q-exp-circ" className="q-honesty__title">{T.circTitle}</h3>
            <p>{T.circBody(num(TESEO_GALAXY_COUNT, lang), TESEO_GALAXY_H0)}</p>
            <button type="button" className="q-link" onClick={toggleGal} aria-pressed={!!galaxies}>{galaxies ? T.circHide : T.circShow}</button>
            <p className="q-fine" role="status">
              {gal.status === "loading" ? T.circLoading : gal.status === "error" ? T.circError : galaxies ? T.circShown(num(galaxies.length, lang), TESEO_GALAXY_H0) : ""}
            </p>
            <Refs ids={["openngc"]} refs={EXP_REFS} lang={lang} t={t} />
          </aside>

          <ShareRow hash={hash} t={t} />
        </div>
      </div>

      <section className="q-exo q-plain" aria-labelledby="q-exp-back">
        <h3 id="q-exp-back" className="q-h3">{T.backTitle}</h3>
        <p className="q-plain__text">{T.backBody(num(CMB_AGE_YEARS, lang))}</p>
        <p><Certainty level="measured" t={t} short /></p>
        <Refs ids={["esaPlanck"]} refs={EXP_REFS} lang={lang} t={t} />
      </section>

      <section className="q-model" aria-labelledby="q-exp-model">
        <h3 id="q-exp-model" className="q-h3">{T.accelTitle}</h3>
        <p className="q-model__lead">{T.accelLead}</p>
        <div className="q-grid q-grid--model">
          <div className="q-grid__result">
            <figure className="q-fig">
              <ScaleChart ol={ol} lang={lang} T={T} age={age} ageNo={ageNo} />
              <Legend items={[{ kind: "line", color: "var(--thread)", label: T.legYours }, { kind: "line", color: "var(--q-estimated)", dash: "5 4", label: T.legMatter }]} />
            </figure>
          </div>
          <div className="q-grid__controls">
            <Slider label={T.olSlider} hint={T.olHint} value={ol} min={OL_SLIDER.min} max={OL_SLIDER.max} step={OL_SLIDER.step}
              onChange={setOl} valueText={T.olValue(olPct(ol), olPct(1 - ol))}>
              <Ticks marks={[{ label: "Planck", pct: tickPct(PLANCK.OL, OL_SLIDER) }]} />
            </Slider>
            <div className="q-row">
              <button type="button" className={`q-preset ${atPlanck ? "is-on" : ""}`} aria-pressed={atPlanck} onClick={() => setOl(PLANCK.OL)}>{T.planckBtn}</button>
              <button type="button" className={`q-preset ${ol === 0 ? "is-on" : ""}`} aria-pressed={ol === 0} onClick={() => setOl(0)}>{T.noneBtn}</button>
            </div>
            <div className="q-readout" role="status" aria-live="polite" aria-atomic="true">
              <p className="q-readout__label">{T.modelAge}</p>
              <p className="q-readout__big"><span className="q-readout__n">{num(age, lang, 1)}</span> <span className="q-readout__unit">{T.ageUnit}</span></p>
              <p className="q-readout__fit">{T.modelNow} <strong>{Math.abs(q0) < 0.005 ? T.coasting : q0 < 0 ? T.accelerates : T.decelerates}</strong>.</p>
            </div>
            <p><Certainty level="estimated" t={t} short note={lang === "es" ? "modelo simplificado" : "simplified model"} /></p>
            {atPlanck && <p className="q-note q-note--ok">{T.planckAge(num(PLANCK.ageGyr, lang, 2), num(PLANCK.ageErr, lang, 2))}</p>}
            <p className="q-fine q-gap">{sub(T.modelFine(num(PLANCK.H0, lang, 1)))}</p>
            <Refs ids={["planck2018"]} refs={EXP_REFS} lang={lang} t={t} />
          </div>
        </div>
      </section>

      <section className="q-thread" aria-labelledby="q-thread-title">
        <h3 id="q-thread-title" className="q-h3 q-thread__title">{T.threadTitle}</h3>
        <TensionCard h0={h0} lang={lang} t={t} T={T} />
        <Card id="q-exp-accel" title={T.accel.title} teaser={T.accel.teaser} level={T.accel.tag} t={t}>
          <p>{T.accel.p1}</p><p>{T.accel.p2}</p>
          <Refs ids={["riess1998", "perlmutter1999", "nobel2011"]} refs={EXP_REFS} lang={lang} t={t} />
        </Card>
        <Card id="q-exp-dark" title={T.dark.title} teaser={T.dark.teaser} level={T.dark.tag} t={t}>
          <p>{T.dark.p1}</p><p>{T.dark.p2}</p><p>{T.dark.p3}</p>
          <Refs ids={["planck2018", "desi2024"]} refs={EXP_REFS} lang={lang} t={t} />
        </Card>
      </section>

      <p className="q-fine q-honest">{T.honest}</p>
      <NextLinks links={EXP_NEXT} lang={lang} t={t} />
    </section>
  );
}
