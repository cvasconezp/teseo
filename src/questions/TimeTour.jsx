// TimeTour.jsx — recorrido "¿Se puede viajar en el tiempo?".
// Los números salen de timeData.js / constants.js / physics.js y los textos de
// timeText.js: aquí solo hay interfaz.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TIME_REFS, TIME_NEXT, PLACES, BODIES, SPEED_PRESETS, BETA_SLIDER, GRAV_SLIDER, HAFELE_KEATING, CHIMBORAZO_M,
  PROXIMA_LY,
  lorentz, lorentzMinusOne, betaFromSlider, sliderFromBeta, roundTrip,
  gravityAt, fractionFromSlider, sliderMin, placeSlider,
  gpsOffsets, issEffect, heightRateGain, heightGainSeconds,
  smallTime, smallLength, betaPercent,
} from "./timeData.js";
import { TIME_T } from "./timeText.js";
import { readNumber, parseRoute } from "./physics.js";
import { C, YEAR } from "./constants.js";
import { num, sig, sci, years } from "./format.js";
import { length } from "./units.js";
import { TQ } from "./i18n.js";
import { Certainty, Card, Refs, Slider, Ticks, TourHead, ShareRow, useHashSync, sub } from "./shared.jsx";
import "./time.css";

const store = { beta: null, obj: null, s: null };
const START_AGE = 20;          // edad inicial de los dos relojes
const LOOP_YEARS = 10;         // años del reloj lejano que dura una vuelta de la animación
const LOOP_SECONDS = 12;       // segundos reales que dura esa vuelta

function readHash() {
  try {
    const r = parseRoute(window.location.hash || "", ["time"]);
    if (r.id !== "time") return {};
    const o = r.params.get("o");
    const obj = o && BODIES[o] ? o : null;
    return {
      beta: readNumber(r.params.get("v"), 0, 0.9999),
      obj,
      s: obj ? readNumber(r.params.get("d"), sliderMin(obj), GRAV_SLIDER.max) : null,
    };
  } catch { return {}; }
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(() => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia("(prefers-reduced-motion: reduce)"); } catch { return undefined; }
    const on = () => setReduce(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", on); else if (mq.addListener) mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", on); else if (mq.removeListener) mq.removeListener(on); };
  }, []);
  return reduce;
}

const signed = (n, lang, d = 0) => `${n < 0 ? "−" : "+"}${num(Math.abs(n), lang, d)}`;

// ─── Dos relojes de años ────────────────────────────────────────────────────
// Cada vuelta de la aguja es un año. La aguja "lejana" da 1 vuelta por año; la
// otra, `rate` vueltas por año. Se anima con requestAnimationFrame escribiendo
// directamente en el DOM (sin re-renderizar 60 veces por segundo); se detiene
// fuera de pantalla, con la pestaña oculta, con el botón de pausa y, si el
// sistema pide menos movimiento, no se anima: se muestra el estado a los 10 años.
function Dial({ handRef, ageRef, who, color }) {
  const ticks = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div className="q-clock">
      <svg viewBox="0 0 120 120" className="q-clock__face" aria-hidden="true" focusable="false">
        <circle cx="60" cy="60" r="54" className="q-clock__ring" />
        {ticks.map(i => (
          <line key={i} x1="60" y1="10" x2="60" y2={i % 3 === 0 ? 20 : 15} className="q-clock__tick" transform={`rotate(${i * 30} 60 60)`} />
        ))}
        <g ref={handRef}>
          <line x1="60" y1="60" x2="60" y2="18" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="18" r="5" fill={color} />
        </g>
        <circle cx="60" cy="60" r="5" className="q-clock__hub" />
      </svg>
      <span className="q-clock__who">{who}</span>
      <span className="q-clock__age" ref={ageRef} aria-hidden="true" />
    </div>
  );
}

function Clocks({ C: Ck, rate, lang, ariaShip }) {
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(true);
  const wrap = useRef(null);
  const farHand = useRef(null), farAge = useRef(null), hereHand = useRef(null), hereAge = useRef(null);
  const tRef = useRef(LOOP_YEARS), rateRef = useRef(rate), langRef = useRef(lang);
  rateRef.current = rate; langRef.current = lang;

  const draw = useCallback(() => {
    const t = tRef.current, r = rateRef.current, l = langRef.current;
    if (farHand.current) farHand.current.setAttribute("transform", `rotate(${(t * 360) % 360} 60 60)`);
    if (hereHand.current) hereHand.current.setAttribute("transform", `rotate(${(t * r * 360) % 360} 60 60)`);
    if (farAge.current) farAge.current.textContent = Ck.age(num(START_AGE + t, l, 1));
    if (hereAge.current) hereAge.current.textContent = Ck.age(num(START_AGE + t * r, l, 1));
  }, [Ck]);

  // Estado quieto: a los 10 años (o donde se pausó)
  useEffect(() => { draw(); }, [draw, rate, lang, reduce, playing]);

  // Fuera de pantalla → no se anima
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const on = () => setVisible(v => (document.hidden ? false : v));
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  useEffect(() => {
    if (reduce) { tRef.current = LOOP_YEARS; draw(); return undefined; }
    if (!playing || !visible) return undefined;
    let raf = 0, last = 0;
    const step = (now) => {
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      tRef.current = (tRef.current + (dt / 1000) * (LOOP_YEARS / LOOP_SECONDS)) % LOOP_YEARS;
      draw();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduce, playing, visible, draw]);

  return (
    <figure className="q-clocks" ref={wrap}>
      <figcaption className="q-clocks__title">{Ck.title}</figcaption>
      <div className="q-clocks__row" role="img" aria-label={Ck.aria(ariaShip)}>
        <Dial handRef={farHand} ageRef={farAge} who={Ck.earth} color="#7DB9FF" />
        <Dial handRef={hereHand} ageRef={hereAge} who={Ck.ship} color="#F2C46D" />
      </div>
      {reduce
        ? <p className="q-fine q-clocks__fine">{Ck.reduced}</p>
        : <button type="button" className="btn btn--ghost q-clocks__btn" onClick={() => setPlaying(p => !p)}>{playing ? Ck.pause : Ck.play}</button>}
      <p className="q-fine q-clocks__fine">{Ck.note}</p>
    </figure>
  );
}

// "1 año para ti = …" para un reloj lento: a partir de cuánto se pasa de "1 año y X" a "1,2 años".
function yearsLine(extra, S, lang) {
  return extra < 0.05 ? S.yearPlus(smallTime(extra * YEAR, lang)) : S.yearMany(sig(1 + extra, lang, 3));
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

// ─── Paso 1: el GPS y los aviones ───────────────────────────────────────────
function GpsStep({ lang, t, T }) {
  const s = T.s1, g = gpsOffsets(), hk = s.hk;
  const rows = s.rows(`${signed(Number(g.gravity.toPrecision(3)), lang, 1)} µs`, `${signed(Number(g.velocity.toPrecision(2)), lang, 1)} µs`,
    `${signed(Number(g.net.toPrecision(3)), lang, 1)} µs`, `${sig(g.rangeKmPerDay, lang, 3)} km`);
  const hkCell = (v, e) => `${signed(v, lang)} ± ${num(e, lang)}`;
  return (
    <Step id="q-time-s1" title={s.title} lead={s.lead}>
      <h4 className="q-h4">{s.calcTitle}</h4>
      <dl className="q-calc q-calc--solo">
        {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>
      <p className="q-step__p">{s.p1}</p>
      <p><Certainty level={s.tag} t={t} short note={s.tagNote} /></p>
      <p className="q-fine">{s.fine}</p>
      <Refs ids={["ashby2003", "misra2023"]} refs={TIME_REFS} lang={lang} t={t} />
      <Card id="q-time-hk" title={hk.title} teaser={hk.teaser} level={hk.tag} t={t}>
        <p>{hk.p1}</p>
        <table className="q-table">
          <caption>{hk.tableTitle}</caption>
          <thead><tr>{hk.col.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">{hk.east}</th><td>{hkCell(HAFELE_KEATING.east.predicted, HAFELE_KEATING.east.predictedErr)}</td><td>{hkCell(HAFELE_KEATING.east.observed, HAFELE_KEATING.east.observedErr)}</td></tr>
            <tr><th scope="row">{hk.west}</th><td>{hkCell(HAFELE_KEATING.west.predicted, HAFELE_KEATING.west.predictedErr)}</td><td>{hkCell(HAFELE_KEATING.west.observed, HAFELE_KEATING.west.observedErr)}</td></tr>
          </tbody>
        </table>
        <p>{hk.p2}</p>
        <Refs ids={["hafeleKeating1", "hafeleKeating2"]} refs={TIME_REFS} lang={lang} t={t} />
      </Card>
    </Step>
  );
}

// ─── Paso 2: velocidad ──────────────────────────────────────────────────────
function SpeedStep({ lang, t, T, beta, setBeta }) {
  const s = T.s2;
  const slider = sliderFromBeta(beta);
  const gm1 = lorentzMinusOne(beta), gamma = lorentz(beta);
  const active = SPEED_PRESETS.find(p => Math.abs(p.beta - beta) <= 1e-9) || null;
  const kmps = beta < 0.01 ? (beta === 0 ? "0" : sig((beta * C) / 1000, lang, 3)) : null;
  const pct = betaPercent(beta, lang);
  const valueText = s.speedValue(pct, kmps), ariaText = s.speedAria(pct, kmps);
  const rt = roundTrip(PROXIMA_LY, beta);
  const gap = rt ? rt.earth * (gm1 / gamma) : 0;
  const pctLabel = (b) => (lang === "es" ? `${betaPercent(b, lang)} %` : `${betaPercent(b, lang)}%`);
  const tick = (b, label) => ({ label: label ?? pctLabel(b), pct: (sliderFromBeta(b) / BETA_SLIDER.max) * 100 });
  const chip = (p) => (
    <button key={p.id} type="button" data-preset={`v-${p.id}`} className={`q-preset ${active && active.id === p.id ? "is-on" : ""}`}
      aria-pressed={!!active && active.id === p.id} onClick={() => setBeta(p.beta)}>{s.presets[p.id]}</button>
  );
  const real = SPEED_PRESETS.filter(p => p.real), hypo = SPEED_PRESETS.filter(p => !p.real);
  const iss = issEffect();
  const msNet = smallTime(Math.abs(iss.net), lang);
  return (
    <Step id="q-time-s2" title={s.title} lead={s.lead}>
      <div className="q-grid">
        <div className="q-grid__result">
          <Slider label={s.speedLabel} hint={s.speedHint} value={slider} min={BETA_SLIDER.min} max={BETA_SLIDER.max} step={BETA_SLIDER.step}
            onChange={(v) => setBeta(betaFromSlider(v))} valueText={valueText} ariaText={ariaText}>
            <Ticks marks={[tick(0, "0"), tick(0.9), tick(0.99), tick(0.9999)]} />
          </Slider>

          <div className="q-result q-result--time">
            <p className="q-result__label">{s.gammaLabel} <span className="q-mono">{s.gammaFormula}</span></p>
            <p className="q-result__big">
              <span className="q-result__n q-result__n--num">{gm1 < 1e-3 ? "≈ 1" : sig(gamma, lang, 3)}</span>
              {gm1 < 1e-3 && <span className="q-result__unit">{s.gammaTiny(sci(gm1, lang))}</span>}
            </p>
            <div className="q-time__out" role="status" aria-live="polite" aria-atomic="true">
              <span className="q-time__a">{s.yearFor}</span>
              <span className="q-time__eq">{s.yearEquals}</span>
              <strong className="q-time__b">{yearsLine(gm1, s, lang)}</strong>
            </div>
            <p className="q-fine">{s.yearNote}</p>
          </div>

          <Clocks C={s.clocks} rate={1 / gamma} lang={lang} ariaShip={years(LOOP_YEARS / gamma, lang)} />
        </div>

        <div className="q-grid__controls">
          <div className="q-presets" role="group" aria-labelledby="q-time-vreal">
            <p id="q-time-vreal" className="q-presets__label">{s.presetsReal}</p>
            <div className="q-presets__row q-presets__row--3">{real.map(chip)}</div>
          </div>
          <div className="q-presets q-presets--second" role="group" aria-labelledby="q-time-vhypo">
            <p id="q-time-vhypo" className="q-presets__label">{s.presetsHypo}</p>
            <div className="q-presets__row q-presets__row--3">{hypo.map(chip)}</div>
          </div>
          <div className="q-presets__note" aria-live="polite">
            {active && active.real && (<>
              <p>{s.realNote(s.presets[active.id], sig((active.beta * C) / 1000, lang, 3))}</p>
              <p className="q-fine">{active.id === "parker" ? s.parkerNote : active.id === "plane" ? s.planeNote : ""}</p>
              {active.ref && <Refs ids={[active.ref]} refs={TIME_REFS} lang={lang} t={t} />}
            </>)}
            {active && !active.real && <p>{s.hypoNote(s.presets[active.id])}</p>}
            {!active && <p>{s.customNote}</p>}
          </div>

          <section className="q-time q-trip" aria-labelledby="q-time-trip">
            <h4 id="q-time-trip" className="q-h4">{s.tripTitle}</h4>
            <p className="q-time__lead">{s.tripLead(num(PROXIMA_LY, lang, 4))}</p>
            {rt ? (<>
              <dl className="q-calc q-calc--solo" role="status" aria-live="polite" aria-atomic="true">
                <div><dt>{s.tripEarth}</dt><dd>{years(rt.earth, lang)}</dd></div>
                <div><dt>{s.tripShip}</dt><dd>{years(rt.ship, lang)}</dd></div>
              </dl>
              <p className="q-step__p">{gm1 < 1e-3 ? s.tripSlow : ""}{gm1 < 1e-3 ? " " : ""}{s.tripGap(smallTime(gap * YEAR, lang))}</p>
            </>) : <p className="q-step__p">{s.tripNone}</p>}
            <p><Certainty level={s.tripTag} t={t} short note={s.tripTagNote} /></p>
            <Refs ids={["proxima"]} refs={TIME_REFS} lang={lang} t={t} />
          </section>

          <aside className="q-honesty q-twin" aria-labelledby="q-time-twin">
            <h4 id="q-time-twin" className="q-honesty__title">{s.twinTitle}</h4>
            <p>{s.twinBody}</p>
          </aside>
        </div>
      </div>

      <Card id="q-time-iss" title={s.iss.title} teaser={s.iss.teaser} level={s.iss.tag} levelNote={s.iss.tagNote} t={t}>
        <p>{s.iss.p1}</p>
        <dl className="q-calc q-calc--solo">
          {s.iss.rows(num(iss.speed / 1000, lang, 2), `−${smallTime(Math.abs(iss.velocity), lang)}`, `+${smallTime(iss.gravity, lang)}`, `−${msNet}`).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
        <p>{s.iss.p2(msNet)}</p>
        <p className="q-fine">{s.iss.fine}</p>
        <Refs ids={["nasaIss", "ashby2003"]} refs={TIME_REFS} lang={lang} t={t} />
      </Card>
    </Step>
  );
}

// ─── Paso 3: gravedad ───────────────────────────────────────────────────────
function GravityStep({ lang, t, T, obj, s, setPlace, setS, hash }) {
  const S = T.s3;
  const f = fractionFromSlider(s, obj);
  const g = gravityAt(obj, f);
  const place = PLACES.find(p => p.obj === obj && Math.abs(placeSlider(p) - s) < 0.006) || null;
  const bh = obj === "bh";
  const x = 1 + f;
  const lenTxt = (m) => smallLength(m, lang) || length(m, lang);
  const xTxt = f < 0.01 ? `1 + ${sci(f, lang)}` : x < 10 ? num(x, lang, 2) : num(x, lang, 1);
  const valueText = bh ? S.distAboveBh(xTxt, lenTxt(g.altitude)) : f === 0 ? S.distSurface : S.distAbove(lenTxt(g.altitude));
  const ariaText = bh ? S.distAriaBh(xTxt, lenTxt(g.altitude)) : f === 0 ? S.distAriaSurface : S.distAria(lenTxt(g.altitude));
  const hourMode = g.extra > 1;
  const farSec = (g.extra + 1) * 3600;
  const rateTxt = g.deficit < 1e-3 ? S.rateTiny(sci(g.deficit, lang)) : S.ratePct(sig(g.rate * 100, lang, 3));
  const level = place ? place.level : "estimated";
  const earthTick = (label, id) => { const p = PLACES.find(q => q.id === id); return { label, pct: ((placeSlider(p) - GRAV_SLIDER.min) / (GRAV_SLIDER.max - GRAV_SLIDER.min)) * 100 }; };
  const earthTicks = obj === "earth" ? [earthTick("Chimborazo", "chimborazo"), earthTick("ISS", "iss"), earthTick("GPS", "gps")] : null;
  const lo = sliderMin(obj);
  const chip = (p) => (
    <button key={p.id} type="button" data-preset={`g-${p.id}`} className={`q-preset ${place && place.id === p.id ? "is-on" : ""}`}
      aria-pressed={!!place && place.id === p.id} onClick={() => setPlace(p)}>{S.presets[p.id]}</button>
  );
  const h = CHIMBORAZO_M, rate80 = heightRateGain(h), sec80 = heightGainSeconds(h, 80);
  const us80 = sec80 * 1e6;
  return (
    <Step id="q-time-s3" title={S.title} lead={S.lead}>
      <div className="q-grid">
        <div className="q-grid__result">
          <Slider label={S.distLabel} hint={S.distHint} value={Math.max(lo, s)} min={lo} max={GRAV_SLIDER.max} step={GRAV_SLIDER.step}
            onChange={setS} valueText={valueText} ariaText={ariaText}>
            {earthTicks && <Ticks marks={earthTicks} />}
          </Slider>

          <div className="q-result q-result--time">
            <div className="q-time__out" role="status" aria-live="polite" aria-atomic="true">
              <span className="q-time__a">{hourMode ? S.hourFor : S.yearFor}</span>
              <span className="q-time__eq">{hourMode ? S.hourEquals : S.yearEquals}</span>
              <strong className="q-time__b">{hourMode ? smallTime(farSec, lang) : yearsLine(g.extra, S, lang)}</strong>
            </div>
            <p className="q-time__rate">{S.rateLabel}: <span className="q-mono">{rateTxt}</span></p>
            <p className="q-formula">{sub(S.formula)}</p>
            <p><Certainty level={level} t={t} short note={level === "measured" ? S.tagNoteMeasured : S.tagNoteEstimated} /></p>
            {place && place.orbit && g.orbitExtra != null && <p className="q-note q-note--ok">{S.orbitNote(smallTime(g.orbitExtra * YEAR, lang))}</p>}
            {bh && <p className="q-note q-note--warn">{S.bhNote}</p>}
            <p className="q-fine">{sub(S.rsNote)}</p>
          </div>

          <Clocks C={S.clocks} rate={g.rate ?? 0} lang={lang} ariaShip={years(LOOP_YEARS * (g.rate ?? 0), lang)} />
        </div>

        <div className="q-grid__controls">
          <div className="q-presets" role="group" aria-labelledby="q-time-gplaces">
            <p id="q-time-gplaces" className="q-presets__label">{S.presetsLabel}</p>
            <div className="q-presets__row">{PLACES.map(chip)}</div>
          </div>
          <div className="q-presets__note" aria-live="polite">
            <p>{place ? S.notes[place.id] : S.customNote}</p>
            {place && place.id === "gps" && <Refs ids={["ashby2003"]} refs={TIME_REFS} lang={lang} t={t} />}
            {place && place.id === "chimborazo" && <Refs ids={["chimborazo", "noaa"]} refs={TIME_REFS} lang={lang} t={t} />}
            {place && place.id === "siriusb" && <Refs ids={["bond2017", "sirius"]} refs={TIME_REFS} lang={lang} t={t} />}
            {place && place.id === "ns" && <Refs ids={["riley2019"]} refs={TIME_REFS} lang={lang} t={t} />}
            {place && (place.id === "earth" || place.id === "sun" || place.id === "iss") && <Refs ids={["iau2015"]} refs={TIME_REFS} lang={lang} t={t} />}
          </div>

          <section className="q-time" aria-labelledby="q-time-chim">
            <h4 id="q-time-chim" className="q-h4">{S.chim.title}</h4>
            <p className="q-time__lead">{S.chim.lead}</p>
            <dl className="q-calc q-calc--solo">
              {S.chim.rows(`${num(h, lang)} m`, sci(rate80, lang), `${num(Number(us80.toPrecision(3)), lang)} µs`, `${sig(us80 / 1000, lang, 2)} ms`).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
            </dl>
            <p className="q-step__p">{S.chim.p}</p>
            <p><Certainty level={S.chim.tag} t={t} short note={S.chim.tagNote} /></p>
            <p className="q-fine">{S.chim.fine}</p>
            <Refs ids={["chimborazo", "noaa"]} refs={TIME_REFS} lang={lang} t={t} />
          </section>

          <ShareRow hash={hash} t={t} />
        </div>
      </div>

      <Card id="q-time-miller" title={S.miller.title} teaser={S.miller.teaser} level={S.miller.tag} levelNote={S.miller.tagNote} t={t}>
        <p>{S.miller.p1}</p>
        <p>{S.miller.p2}</p>
        <Refs ids={["thorne"]} refs={TIME_REFS} lang={lang} t={t} />
      </Card>
    </Step>
  );
}

// ─── Paso 4 y cierre ────────────────────────────────────────────────────────
function PastStep({ lang, t, T }) {
  const s = T.s4;
  return (
    <Step id="q-time-s4" title={s.title} lead={s.lead}>
      <Card id="q-time-future" title={s.future.title} teaser={s.future.teaser} level={s.future.tag} t={t} open>
        <p>{s.future.p1}</p>
        <p>{s.future.p2}</p>
        <Refs ids={["hafeleKeating2", "ashby2003"]} refs={TIME_REFS} lang={lang} t={t} />
      </Card>
      <Card id="q-time-past" title={s.past.title} teaser={s.past.teaser} level={s.past.tag} t={t} open>
        <p>{s.past.p1}</p>
        <p>{s.past.p2}</p>
        <Refs ids={["hawking1992"]} refs={TIME_REFS} lang={lang} t={t} />
      </Card>
    </Step>
  );
}

export default function TimeTour({ lang = "es", indexHref }) {
  const t = TQ[lang] || TQ.es;
  const T = TIME_T[lang] || TIME_T.es;
  const fromHash = useMemo(readHash, []);
  const startPlace = PLACES.find(p => p.id === "ns");
  const [beta, setBeta] = useState(() => fromHash.beta ?? store.beta ?? betaFromSlider(BETA_SLIDER.start));
  const [obj, setObj] = useState(() => fromHash.obj ?? store.obj ?? startPlace.obj);
  const [s, setS] = useState(() => fromHash.s ?? store.s ?? placeSlider(startPlace));
  useEffect(() => { store.beta = beta; store.obj = obj; store.s = s; }, [beta, obj, s]);

  const setPlace = useCallback((p) => { setObj(p.obj); setS(placeSlider(p)); }, []);

  const prefix = lang === "es" ? "preguntas" : "questions";
  const hash = `#${prefix}?q=time&v=${Number(beta.toPrecision(6))}&o=${obj}&d=${Number(s.toFixed(3))}`;
  useHashSync(hash);

  return (
    <section className="q q-tour q-time-tour" aria-labelledby="q-title">
      <TourHead t={t} title={T.title} lead={T.lead} indexHref={indexHref} />

      <GpsStep lang={lang} t={t} T={T} />
      <SpeedStep lang={lang} t={t} T={T} beta={beta} setBeta={setBeta} />
      <GravityStep lang={lang} t={t} T={T} obj={obj} s={s} setPlace={setPlace} setS={setS} hash={hash} />
      <PastStep lang={lang} t={t} T={T} />

      <aside className="q-honesty q-assume" aria-labelledby="q-time-assume">
        <h3 id="q-time-assume" className="q-honesty__title">{T.assumptionsTitle}</h3>
        <ul className="q-assume__list">{T.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
      </aside>

      <section className="q-sources" aria-labelledby="q-time-sources">
        <h3 id="q-time-sources" className="q-h3">{T.sourcesTitle}</h3>
        <Refs ids={Object.keys(TIME_REFS)} refs={TIME_REFS} lang={lang} t={t} />
      </section>

      <p className="q-fine q-honest">{T.honest}</p>

      <nav className="q-next" aria-labelledby="q-next-title">
        <h3 id="q-next-title" className="q-next__title">{t.nextTitle}</h3>
        <ul>
          <li>
            <a href={`#${prefix}?q=bh`}>{T.nextBhTitle}</a>
            <span>{T.nextBhNote}</span>
          </li>
          {TIME_NEXT.map(l => (
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
