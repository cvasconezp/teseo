// BlackHoleTour.jsx — recorrido "¿Qué pasa cerca de un agujero negro?".
// Los números salen de bhData.js / constants.js y la física de physics.js:
// aquí solo hay interfaz.
import { useEffect, useMemo, useState } from "react";
import { fetchJson, isAbort } from "../net.js";
import {
  BH_REFS, BH_T, PRESETS, SIZE_LADDER, DENSITY_MARKS, EHT, TIDE_HEIGHT_M, MASS_SLIDER, DIST_SLIDER, DEFAULT_LOGM, BH_NEXT, nearestSize,
} from "./bhData.js";
import {
  schwarzschildRadiusM, meanDensity, staticClockRate, farTime, shadowAngularDiameterMuas, tidalAtHorizon, circularSpeed,
  readNumber, parseRoute,
} from "./physics.js";
import { GM_SUN, AU, G0 } from "./constants.js";
import { num, sig } from "./format.js";
import { length, duration, mass, quantity, times } from "./units.js";
import { TQ } from "./i18n.js";
import { Certainty, Card, Refs, Why, Slider, TourHead, ShareRow, NextLinks, useHashSync, sub } from "./shared.jsx";

const store = { logM: null, logD: null, layer: null };

function readHash() {
  try {
    const r = parseRoute(window.location.hash || "", ["bh"]);
    if (r.id !== "bh") return {};
    return { logM: readNumber(r.params.get("m"), MASS_SLIDER.min, MASS_SLIDER.max), logD: readNumber(r.params.get("d"), DIST_SLIDER.min, DIST_SLIDER.max) };
  } catch { return {}; }
}

// Dibujo a escala: el horizonte y el objeto de referencia, uno junto al otro.
function ScaleDrawing({ ratio, objLabel, horizonLabel, aria }) {
  const R = 44, small = Math.max(1.3, R / Math.max(ratio, 1 / ratio));
  const rH = ratio >= 1 ? R : small, rO = ratio >= 1 ? small : R;
  return (
    <svg className="q-bh__scale" viewBox="0 0 300 118" role="img" aria-label={aria}>
      <g aria-hidden="true">
        <circle cx="78" cy="52" r={rH + 5} fill="none" stroke="#FF9A5C" strokeOpacity="0.5" strokeWidth="3" />
        <circle cx="78" cy="52" r={rH} fill="#000" stroke="#FFB067" strokeWidth="1.6" />
        <circle cx="222" cy="52" r={rO} fill="rgba(125,185,255,0.14)" stroke="#7DB9FF" strokeWidth="1.6" strokeDasharray="4 3" />
        <text x="78" y="112" textAnchor="middle" className="q-plot__label">{horizonLabel}</text>
        <text x="222" y="112" textAnchor="middle" className="q-plot__label">{objLabel}</text>
      </g>
    </svg>
  );
}

function SeenCard({ lang, t, T }) {
  const s = T.seen;
  const max = 60;
  const pct = (v) => `${(v / max) * 100}%`;
  return (
    <Card id="q-bh-seen" title={s.title} teaser={s.teaser} level={s.tag} t={t}>
      <p>{s.p1}</p>
      <p>{s.p2}</p>
      {EHT.map(o => {
        const calc = shadowAngularDiameterMuas(o.mass, o.distanceM);
        const calcTxt = num(calc, lang, 1), ringTxt = `${num(o.ring, lang, 1)} ± ${num(o.ringErr, lang, 1)}`;
        return (
          <div key={o.id} className="q-eht">
            <h4 className="q-h4">{o.name} <span className="q-eht__year">{o.year}</span></h4>
            <div className="q-eht__bars" role="img" aria-label={s.rowAria(o.name, calcTxt, ringTxt)}>
              <div className="q-eht__row"><span className="q-eht__lbl">{s.predicted}</span>
                <span className="q-eht__track"><i className="q-eht__bar q-eht__bar--calc" style={{ width: pct(calc) }} /></span>
                <span className="q-eht__val">{calcTxt} {s.unit}</span></div>
              <div className="q-eht__row"><span className="q-eht__lbl">{s.ring}</span>
                <span className="q-eht__track"><i className="q-eht__bar q-eht__bar--ring" style={{ width: pct(o.ring) }} /><i className="q-eht__err" style={{ left: pct(o.ring - o.ringErr), width: pct(2 * o.ringErr) }} /></span>
                <span className="q-eht__val">{ringTxt} {s.unit}</span></div>
              {o.shadow && (
                <div className="q-eht__row"><span className="q-eht__lbl">{s.shadowMeasured}</span>
                  <span className="q-eht__track"><i className="q-eht__bar q-eht__bar--ring" style={{ width: pct(o.shadow) }} /><i className="q-eht__err" style={{ left: pct(o.shadow - o.shadowErr), width: pct(2 * o.shadowErr) }} /></span>
                  <span className="q-eht__val">{num(o.shadow, lang, 1)} ± {num(o.shadowErr, lang, 1)} {s.unit}</span></div>
              )}
            </div>
            <p className={o.independent ? "q-note q-note--ok" : "q-note q-note--warn"}>{o.independent ? s.independent : s.circular}</p>
            <p className="q-fine">M = {mass(o.mass, lang)} · D = {length(o.distanceM, lang)}</p>
            <p><a className="q-ext" href={o.image} target="_blank" rel="noopener noreferrer">{s.image(o.name)}<span className="q-sr"> ({t.external})</span></a></p>
            <Refs ids={o.refs} refs={BH_REFS} lang={lang} t={t} />
          </div>
        );
      })}
      <p>{s.muas}</p>
      <p className="q-fine">{s.fine}</p>
    </Card>
  );
}

function VacuumCard({ lang, t, T }) {
  const v = T.vacuum;
  const rs = schwarzschildRadiusM(1);
  const speed = circularSpeed(GM_SUN, AU) / 1000;
  const rows = v.rows(length(rs, lang), `${num(speed, lang, 1)} km/s`, `${times(AU / rs, lang)} r_s`);
  return (
    <Card id="q-bh-vacuum" title={v.title} teaser={v.teaser} level={v.tag} levelNote={v.tagNote} t={t}>
      <p>{v.p1}</p>
      <h4 className="q-h4">{v.calcTitle}</h4>
      <dl className="q-calc">
        {rows.map(([k, val]) => (<div key={k}><dt>{k}</dt><dd>{sub(val)}</dd></div>))}
      </dl>
      <p>{v.p2}</p>
      <Refs ids={["iau2015", "nasaFacts", "gravity2022"]} refs={BH_REFS} lang={lang} t={t} />
    </Card>
  );
}

function SpagCard({ lang, t, T, current }) {
  const s = T.spag;
  const list = [...PRESETS.filter(p => ["sun", "cygx1", "sgra", "m87"].includes(p.id)).map(p => ({ key: p.id, label: p.label[lang], m: p.mass }))];
  if (current && !list.some(r => Math.abs(Math.log10(r.m / current.m)) < 0.02)) list.push({ key: "you", label: current.label, m: current.m, you: true });
  list.sort((a, b) => a.m - b.m);
  return (
    <Card id="q-bh-spag" title={s.title} teaser={s.teaser} level={s.tag} levelNote={s.tagNote} t={t}>
      <p>{sub(s.p1)}</p>
      <table className="q-table">
        <caption>{s.tableTitle(TIDE_HEIGHT_M)}</caption>
        <thead><tr>{s.col.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {list.map(r => { const a = tidalAtHorizon(r.m, TIDE_HEIGHT_M); return (
            <tr key={r.key} className={r.you ? "is-you" : ""}><th scope="row">{r.label}</th><td>{quantity(a, lang)} m/s²</td><td>{quantity(a / G0, lang)} g</td></tr>
          ); })}
        </tbody>
      </table>
      <p>{s.p2}</p>
      <p className="q-fine">{s.fine}</p>
    </Card>
  );
}

function UnknownCard({ lang, t, T }) {
  const u = T.unknown;
  return (
    <Card id="q-bh-unknown" title={u.title} teaser={u.teaser} level={u.tag} t={t}>
      <p>{u.p1}</p><p>{u.p2}</p><p>{u.p3}</p>
      <Refs ids={["hawking1974", "nobel2020", "nasaBH"]} refs={BH_REFS} lang={lang} t={t} />
    </Card>
  );
}

export default function BlackHoleTour({ lang = "es", onSeeSky, indexHref }) {
  const t = TQ[lang] || TQ.es;
  const T = BH_T[lang] || BH_T.es;
  const fromHash = useMemo(readHash, []);
  const [logM, setLogM] = useState(() => fromHash.logM ?? store.logM ?? DEFAULT_LOGM);
  const [logD, setLogD] = useState(() => fromHash.logD ?? store.logD ?? DIST_SLIDER.start);
  const [layer, setLayer] = useState(store.layer);      // public/blackholes.json (capa del Cielo)
  useEffect(() => { store.logM = logM; store.logD = logD; }, [logM, logD]);

  // Masas de la capa del Cielo: se piden al abrir el recorrido (3 KB).
  useEffect(() => {
    if (store.layer) return;
    const ctrl = new AbortController();
    fetchJson("/blackholes.json", { signal: ctrl.signal })
      .then(d => {
        if (!d || !Array.isArray(d.objects)) throw new Error("bad payload");
        store.layer = d.objects.filter(o => o && typeof o.name === "string" && o.mass_sun > 0);
        setLayer(store.layer);
      })
      .catch(e => { if (!isAbort(e)) setLayer(null); });
    return () => ctrl.abort();
  }, []);

  // Preajustes: los reales toman la masa de la capa del Cielo si ya llegó.
  const presets = useMemo(() => PRESETS.map(p => {
    const o = p.real && layer ? layer.find(x => x.name === p.name) : null;
    return { ...p, m: o ? o.mass_sun : p.mass, fromLayer: !!o };
  }), [layer]);
  const active = presets.find(p => Math.abs(Math.log10(p.m) - logM) < 0.006) || null;

  const m = Math.pow(10, logM);
  const rs = schwarzschildRadiusM(m);
  const { obj, ratio } = nearestSize(2 * rs);
  const rho = meanDensity(m);
  const tide = tidalAtHorizon(m, TIDE_HEIGHT_M) / G0;
  const x = 1 + Math.pow(10, logD);
  const rate = staticClockRate(x);
  const far = farTime(3600, x);

  const hash = `#${lang === "es" ? "preguntas" : "questions"}?q=bh&m=${Number(logM.toFixed(3))}&d=${Number(logD.toFixed(2))}`;
  useHashSync(hash);

  const cmp = ratio > 0.8 && ratio < 1.25 ? T.sameAs(obj.name[lang]) : ratio >= 1 ? T.bigger(times(ratio, lang), obj.name[lang]) : T.smaller(times(1 / ratio, lang), obj.name[lang]);
  const massTxt = mass(m, lang);
  const xTxt = x < 1.01 ? num(x, lang, 6) : x < 10 ? num(x, lang, 2) : num(x, lang, 0);
  const densCmp = rho >= DENSITY_MARKS.water * 1.5 ? T.densityWater(times(rho / DENSITY_MARKS.water, lang))
    : rho < DENSITY_MARKS.air ? T.densityAir
    : rho < DENSITY_MARKS.water / 1.5 ? T.densityLess(times(DENSITY_MARKS.water / rho, lang)) : T.densityWater("1");

  const seeSky = () => {
    const o = active && active.real ? `&o=blackholes~${encodeURIComponent(active.name)}` : "";
    if (onSeeSky) onSeeSky();
    // onSeeSky abre el Cielo con otra capa: se corrige el hash antes de que el
    // Cielo se monte y lo lea (Constellations lee `L=` y `o=` al montarse).
    try { window.history.replaceState(null, "", `#sky?L=blackholes${o}`); } catch { /* no-op */ }
  };

  const real = presets.filter(p => p.real), hypo = presets.filter(p => !p.real);
  const chip = (p) => (
    <button key={p.id} type="button" data-preset={p.id} className={`q-preset ${active && active.id === p.id ? "is-on" : ""}`}
      aria-pressed={!!active && active.id === p.id} onClick={() => setLogM(Math.log10(p.m))}>{p.label[lang]}</button>
  );

  return (
    <section className="q q-tour q-bh" aria-labelledby="q-title">
      <TourHead t={t} title={T.title} lead={T.lead} indexHref={indexHref} />

      <div className="q-grid">
        <div className="q-grid__result">
          <Slider label={T.massLabel} hint={T.massHint} value={logM} min={MASS_SLIDER.min} max={MASS_SLIDER.max} step={MASS_SLIDER.step}
            onChange={setLogM} valueText={massTxt} />
          <div className="q-result q-result--bh">
            <p className="q-result__label" id="q-bh-rs-label">{T.rsLabel} <span className="q-mono">{sub(T.formula)}</span></p>
            <p className="q-result__big" role="status" aria-live="polite" aria-atomic="true">
              <span className="q-result__n q-result__n--num">{length(rs, lang)}</span>
              <span className="q-result__unit">{cmp}</span>
            </p>
            <ScaleDrawing ratio={ratio} objLabel={obj.short[lang]} horizonLabel={T.horizon} aria={T.scaleAria(cmp, obj.name[lang])} />
            {obj.approx && <p className="q-fine">{T.approx}</p>}

            <dl className="q-dist__list q-bh__facts">
              <div><dt>{T.densityLabel}</dt><dd>{quantity(rho, lang)} {T.densityUnit}<span className="q-bh__cmp">{densCmp}</span></dd></div>
              <div><dt>{T.tideLabel}</dt><dd>{tide < 0.001 ? <span className="q-bh__cmp q-bh__cmp--solo">{T.tideSoft}</span> : <>{quantity(tide, lang)} g<span className="q-bh__cmp">{T.tideUnit}</span></>}</dd></div>
            </dl>
            <p className="q-fine">{T.densityNote}</p>
            <Why summary={T.whyRs} className="q-why--dist">
              <p>{sub(T.whyRsBody)}</p>
              <Refs ids={["iau2015", "codata", "nasaBH"]} refs={BH_REFS} lang={lang} t={t} />
            </Why>
          </div>
        </div>

        <div className="q-grid__controls">
          <div className="q-presets" role="group" aria-labelledby="q-bh-real">
            <p id="q-bh-real" className="q-presets__label">{T.presetsLabel}</p>
            <div className="q-presets__row q-presets__row--3">{real.map(chip)}</div>
          </div>
          <div className="q-presets q-presets--second" role="group" aria-labelledby="q-bh-hypo">
            <p id="q-bh-hypo" className="q-presets__label">{T.hypoLabel}</p>
            <div className="q-presets__row">{hypo.map(chip)}</div>
          </div>
          <div className="q-presets__note" aria-live="polite">
            {active && active.real && (<>
              <p><Certainty level={active.level} t={t} short /></p>
              <p>{T.realNote(active.what[lang].charAt(0).toUpperCase() + active.what[lang].slice(1), active.published[lang])}{active.fromLayer ? ` ${T.jsonNote}` : ""}</p>
              <Refs ids={[active.ref]} refs={BH_REFS} lang={lang} t={t} />
            </>)}
            {active && !active.real && <p>{T.hypoNote(active.label[lang])}</p>}
            {!active && <p>{T.customNote}</p>}
          </div>

          <section className="q-time" aria-labelledby="q-bh-time">
            <h3 id="q-bh-time" className="q-h3">{T.timeTitle}</h3>
            <p className="q-time__lead">{T.timeLead}</p>
            <Slider label={T.distLabel} hint={T.distHint} value={logD} min={DIST_SLIDER.min} max={DIST_SLIDER.max} step={DIST_SLIDER.step}
              onChange={setLogD} valueText={T.distValue(xTxt, length((x - 1) * rs, lang))} ariaText={T.distAria(xTxt, length((x - 1) * rs, lang))} />
            <p className="q-time__out" role="status" aria-live="polite" aria-atomic="true">
              <span className="q-time__a">{T.timeFor}</span>
              <span className="q-time__eq">{T.timeEquals}</span>
              <strong className="q-time__b">{duration(far, lang)}</strong>
            </p>
            <p className="q-time__rate">{T.timeRate(sig(rate * 100, lang, 3))}</p>
            <p className="q-formula">{sub(T.timeFormula)}</p>
            <p><Certainty level="estimated" t={t} short note={T.timeTagNote} /></p>
            <p className="q-fine">{sub(T.timeNote)}</p>
          </section>

          <ShareRow hash={hash} t={t} />
        </div>
      </div>

      <section className="q-thread" aria-labelledby="q-thread-title">
        <h3 id="q-thread-title" className="q-h3 q-thread__title">{T.threadTitle}</h3>
        <SeenCard lang={lang} t={t} T={T} />
        <VacuumCard lang={lang} t={t} T={T} />
        <SpagCard lang={lang} t={t} T={T} current={active ? null : { m, label: massTxt }} />
        <UnknownCard lang={lang} t={t} T={T} />
      </section>

      <section className="q-exo q-sky" aria-label={T.skyBtn}>
        <p className="q-exo__text">{layer ? T.skyNote(layer.length) : T.skyNoteNoCount}</p>
        <button type="button" className="btn btn--ghost q-exo__btn" onClick={seeSky}>{T.skyBtn}</button>
        <p className="q-fine">{T.honest}</p>
      </section>

      <NextLinks links={BH_NEXT} lang={lang} t={t} />
    </section>
  );
}
