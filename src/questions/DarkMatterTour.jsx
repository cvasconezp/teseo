// DarkMatterTour.jsx — recorrido "¿De qué está hecho el universo?".
// Datos y textos: darkMatterData.js. Física: physics.js. Aquí solo hay interfaz.
import { useEffect, useMemo, useState } from "react";
import {
  DM_REFS, DM_T, NGC3198, GALAXY, UPSILON, HALO, VISIBLE_MASS, PLANETS, PLANET_NAMES, budget, DM_NEXT,
} from "./darkMatterData.js";
import { rotationModel, rmsSpeed, dynamicalMass, circularSpeed, readNumber, parseRoute } from "./physics.js";
import { GM_SUN } from "./constants.js";
import { num, sig, sci } from "./format.js";
import { TQ } from "./i18n.js";
import {
  Certainty, Card, Refs, Why, Slider, TourHead, ShareRow, NextLinks, useHashSync, Plot, TapPoints, Legend, pathOf, sub,
} from "./shared.jsx";

const store = { halo: null };
const modelFor = (haloMass) => rotationModel(NGC3198, { upsilon: UPSILON, haloMass, rRef: HALO.rRef, rc: HALO.rc });
// Mejor ajuste entre los pasos del deslizador (se calcula una vez, al cargar)
export const BEST_HALO = (() => {
  let best = 0, bestRms = Infinity;
  for (let m = HALO.min; m <= HALO.max; m += HALO.step) { const r = rmsSpeed(NGC3198, modelFor(m)); if (r < bestRms) { bestRms = r; best = m; } }
  return { mass: best, rms: bestRms };
})();
const LAST = NGC3198[NGC3198.length - 1];

function readHash() {
  try {
    const r = parseRoute(window.location.hash || "", ["dm"]);
    if (r.id !== "dm") return {};
    const h = readNumber(r.params.get("halo"), 0, HALO.max / 1e10);
    return { halo: h == null ? null : Math.round(h) * 1e10 };
  } catch { return {}; }
}

function RotationChart({ model, lang, T, sel, setSel }) {
  return (
    <Plot h={262} x={[0, 46]} y={[0, 200]} xTicks={[0, 10, 20, 30, 40]} yTicks={[0, 50, 100, 150, 200]}
      xLabel={T.xLabel} yLabel={T.yLabel} aria={T.chartAria(GALAXY.name, num(GALAXY.vFlat, lang), num(model[model.length - 1].vis, lang))}>
      {({ sx, sy }) => {
        const pts = NGC3198.map(p => ({ x: sx(p.r), y: sy(p.v), e: Math.abs(sy(p.v + p.e) - sy(p.v)), label: T.pointAria(num(p.r, lang, 1), num(p.v, lang, 1), num(p.e, lang, 1)) }));
        return (<>
          <g aria-hidden="true">
            <path d={pathOf(model.map(p => [sx(p.r), sy(p.vis)]))} className="q-plot__line q-plot__line--ref" fill="none" />
            <path d={pathOf(model.map(p => [sx(p.r), sy(Math.min(p.model, 215))]))} className="q-plot__line q-plot__line--you" fill="none" />
          </g>
          <TapPoints points={pts} selected={sel} onSelect={setSel} r={2.2} className="q-pt--measured" />
        </>);
      }}
    </Plot>
  );
}

function PlanetChart({ lang, T, sel, setSel }) {
  const lx = (d) => Math.log10(d);
  const kepler = (d) => circularSpeed(GM_SUN, d * 1e9) / 1000;
  const curve = useMemo(() => { const out = []; for (let l = lx(45); l <= lx(5600); l += 0.03) out.push(Math.pow(10, l)); return out; }, []);
  return (
    <Plot h={220} x={[lx(40), lx(6000)]} y={[0, 55]} xTicks={[lx(100), lx(1000)]} yTicks={[0, 10, 20, 30, 40, 50]}
      xFmt={(v) => num(Math.pow(10, v), lang)} xLabel={T.solarX} yLabel={T.solarY} aria={T.solarAria}>
      {({ sx, sy }) => {
        const pts = PLANETS.map(p => ({ x: sx(lx(p.d)), y: sy(p.v), label: `${PLANET_NAMES[lang][p.id]}: ${num(p.v, lang, 1)} km/s` }));
        return (<>
          <g aria-hidden="true">
            <path d={pathOf(curve.map(d => [sx(lx(d)), sy(Math.min(kepler(d), 55))]))} className="q-plot__line q-plot__line--ref" fill="none" />
            {PLANETS.filter(p => ["mercury", "earth", "jupiter", "neptune"].includes(p.id)).map(p => (
              <text key={p.id} x={sx(lx(p.d)) + 7} y={sy(p.v) - 6} className="q-plot__tick q-plot__tick--name">{PLANET_NAMES[lang][p.id]}</text>
            ))}
          </g>
          <TapPoints points={pts} selected={sel} onSelect={setSel} r={3.4} className="q-pt--planet" />
        </>);
      }}
    </Plot>
  );
}

function BudgetCard({ lang, t, T }) {
  const b = T.budget, v = budget();
  const pct = (x) => num(x * 100, lang, 1);
  const rows = [
    { id: "ordinary", label: b.ordinary, note: b.ordinaryNote, x: v.ordinary },
    { id: "dark", label: b.dark, note: b.darkNote, x: v.dark },
    { id: "energy", label: b.energy, note: b.energyNote, x: v.energy },
  ];
  return (
    <Card id="q-dm-budget" title={b.title} teaser={b.teaser} level={b.tag} levelNote={b.tagNote} t={t}>
      <p>{b.p1}</p>
      <div className="q-budget" role="img" aria-label={b.aria(pct(v.ordinary), pct(v.dark), pct(v.energy))}>
        <div className="q-budget__bar" aria-hidden="true">
          {rows.map(r => <i key={r.id} className={`q-budget__seg q-budget__seg--${r.id}`} style={{ width: `${r.x * 100}%` }} />)}
        </div>
        <ul className="q-budget__list" aria-hidden="true">
          {rows.map(r => (
            <li key={r.id} className={`q-budget__item q-budget__item--${r.id}`}>
              <strong>{pct(r.x)} %</strong><span>{r.label}<em>{r.note}</em></span>
            </li>
          ))}
        </ul>
      </div>
      <p>{b.rest(pct(v.rest))}</p>
      <p>{b.more}</p>
      <p className="q-fine">{sub(b.fine)}</p>
      <Refs ids={["planck2018"]} refs={DM_REFS} lang={lang} t={t} />
    </Card>
  );
}

export default function DarkMatterTour({ lang = "es", indexHref }) {
  const t = TQ[lang] || TQ.es;
  const T = DM_T[lang] || DM_T.es;
  const fromHash = useMemo(readHash, []);
  const [halo, setHalo] = useState(() => fromHash.halo ?? store.halo ?? 0);
  const [sel, setSel] = useState(null);
  const [planet, setPlanet] = useState(null);
  useEffect(() => { store.halo = halo; }, [halo]);

  const hash = `#${lang === "es" ? "preguntas" : "questions"}?q=dm&halo=${Math.round(halo / 1e10)}`;
  useHashSync(hash);

  const model = useMemo(() => modelFor(halo), [halo]);
  const rms = rmsSpeed(NGC3198, model);
  const good = rms < BEST_HALO.rms * 1.25;
  const lastModel = model[model.length - 1].model;
  const verdict = good ? T.fitGood : lastModel < LAST.v ? T.fitLow : T.fitHigh;
  const haloTxt = halo ? sci(halo, lang, 2) : "";
  const p = sel == null ? null : NGC3198[sel];
  const pl = planet == null ? null : PLANETS[planet];
  const dyn = dynamicalMass(LAST.v, LAST.r);
  const b = budget();

  return (
    <section className="q q-tour q-dm" aria-labelledby="q-title">
      <TourHead t={t} title={T.title} lead={T.lead} indexHref={indexHref} />

      <div className="q-grid">
        <div className="q-grid__result">
          <figure className="q-fig">
            <figcaption className="q-fig__title">{T.chartTitle(GALAXY.name)}</figcaption>
            <RotationChart model={model} lang={lang} T={T} sel={sel} setSel={setSel} />
            <Legend items={[
              { kind: "dot", color: "var(--q-measured)", label: T.legMeasured },
              { kind: "line", color: "var(--q-estimated)", dash: "5 4", label: T.legVisible },
              { kind: "line", color: "var(--thread)", label: T.legModel },
            ]} />
            <p className="q-fig__pick" role="status" aria-live="polite">
              {p ? T.picked(num(p.r, lang, 2), num(p.v, lang, 1), num(p.e, lang, 1), num(model[sel].vis, lang)) : T.pick}
            </p>
          </figure>
        </div>

        <div className="q-grid__controls">
          <Slider label={T.slider} hint={T.sliderHint} value={halo} min={HALO.min} max={HALO.max} step={HALO.step}
            onChange={setHalo} valueText={T.sliderValue(haloTxt)} />

          <div className="q-readout" role="status" aria-live="polite" aria-atomic="true">
            <p className="q-readout__label">{T.ratioLabel}</p>
            <p className="q-readout__big"><span className="q-readout__n">{halo ? sig(halo / VISIBLE_MASS, lang) : "0"}</span> <span className="q-readout__unit">{T.ratioUnit}</span></p>
            {!halo && <p className="q-readout__sub">{T.ratioNone}</p>}
            <p className={`q-readout__fit ${good ? "is-ok" : ""}`}>{T.fit}: <strong>{num(rms, lang, 1)} {T.fitUnit}</strong>. {verdict}</p>
          </div>
          <p><Certainty level="estimated" t={t} short note={lang === "es" ? "modelo simplificado sobre datos medidos" : "simplified model on measured data"} /></p>
          <div className="q-row">
            <button type="button" className="btn btn--ghost" onClick={() => setHalo(BEST_HALO.mass)}>{T.best}</button>
          </div>

          <div className="q-need">
            <h3 className="q-h4">{T.needTitle}</h3>
            <p>{T.need(num(LAST.r, lang), num(LAST.v, lang), sci(dyn, lang, 2), sci(VISIBLE_MASS, lang, 2), sig(dyn / VISIBLE_MASS - 1, lang))}</p>
          </div>

          <Why summary={T.whySummary}>
            <p>{T.whyBody(num(GALAXY.distanceMpc, lang, 1), num(GALAXY.distanceErr, lang, 1))}</p>
            <Refs ids={["sparc", "sparcData"]} refs={DM_REFS} lang={lang} t={t} />
          </Why>
          <Why summary={T.modelSummary}>
            <ul className="q-formulas">{T.modelBody.map(f => <li key={f} className="q-formula">{sub(f)}</li>)}</ul>
            <p>{sub(T.modelFine)}</p>
          </Why>

          <ShareRow hash={hash} t={t} />
        </div>
      </div>

      <section className="q-model" aria-labelledby="q-dm-solar">
        <h3 id="q-dm-solar" className="q-h3">{T.solarTitle}</h3>
        <p className="q-model__lead">{T.solarLead}</p>
        <figure className="q-fig q-fig--narrow">
          <PlanetChart lang={lang} T={T} sel={planet} setSel={setPlanet} />
          <Legend items={[{ kind: "dot", color: "var(--q-measured)", label: T.legPlanets }, { kind: "line", color: "var(--q-estimated)", dash: "5 4", label: T.legKepler }]} />
          <p className="q-fig__pick" role="status" aria-live="polite">
            {pl ? T.solarPicked(PLANET_NAMES[lang][pl.id], num(pl.d, lang, 1), num(pl.v, lang, 1), num(circularSpeed(GM_SUN, pl.d * 1e9) / 1000, lang, 1)) : T.solarPick}
          </p>
        </figure>
        <p className="q-model__lead">{T.solarAfter}</p>
        <p><Certainty level="measured" t={t} short /></p>
        <Refs ids={["nasaFacts"]} refs={DM_REFS} lang={lang} t={t} />
      </section>

      <section className="q-thread" aria-labelledby="q-thread-title">
        <h3 id="q-thread-title" className="q-h3 q-thread__title">{T.threadTitle}</h3>
        <Card id="q-dm-evidence" title={T.evidence.title} teaser={T.evidence.teaser} level={T.evidence.tag} t={t}>
          <p>{T.evidence.p1}</p>
          <dl className="q-points">
            {T.evidence.items.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{typeof v === "function" ? v(sig(b.dark / b.ordinary, lang)) : v}</dd></div>))}
          </dl>
          <Refs ids={["rubin1970", "nasaDM", "clowe2006", "chandraBullet", "planck2018"]} refs={DM_REFS} lang={lang} t={t} />
        </Card>
        <Card id="q-dm-unknown" title={T.unknown.title} teaser={T.unknown.teaser} level={T.unknown.tag} t={t}>
          <p>{T.unknown.p1}</p><p>{T.unknown.p2}</p>
          <Refs ids={["nasaDM", "lz2023"]} refs={DM_REFS} lang={lang} t={t} />
        </Card>
        <Card id="q-dm-mond" title={T.mond.title} teaser={T.mond.teaser} level={T.mond.tag} levelNote={T.mond.tagNote} t={t}>
          <p>{T.mond.p1}</p><p>{T.mond.p2}</p><p>{T.mond.p3}</p>
          <Refs ids={["milgrom1983", "mcgaugh2016", "clowe2006"]} refs={DM_REFS} lang={lang} t={t} />
        </Card>
        <BudgetCard lang={lang} t={t} T={T} />
      </section>

      <p className="q-fine q-honest">{T.honest}</p>
      <NextLinks links={DM_NEXT} lang={lang} t={t} />
    </section>
  );
}
