// GwTour.jsx — recorrido «¿Qué son las ondas gravitacionales?».
// Los números salen de gwData.js / constants.js y los textos de gwText.js: aquí
// solo hay interfaz.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GW_REFS, GW_NEXT, PRESETS, START_PRESET, MASS_SLIDER, DIST_SLIDER, EXAG_SLIDER, F_LIGO_REF, PROTON_DIAMETER_M,
  MASS_MIN, MASS_MAX, DIST_MIN, DIST_MAX,
  massFromSlider, sliderFromMass, distFromSlider, sliderFromDist, exagFactor, visibleStrain, ringPoint,
  chirpMass, totalMass, fIsco, timeToMerger, strain, mlyToMeters, armDifference, energyJ, waveform, audioPlan, audioSamples,
} from "./gwData.js";
import { GW_T } from "./gwText.js";
import { readNumber, parseRoute } from "./physics.js";
import { num, sig, sci, big } from "./format.js";
import { duration } from "./units.js";
import { TQ } from "./i18n.js";
import { Certainty, Card, Refs, Slider, TourHead, ShareRow, useHashSync, Why, Plot, pathOf } from "./shared.jsx";
import "./gw.css";

const store = { m1: null, m2: null, d: null, exag: null };

function readHash() {
  try {
    const r = parseRoute(window.location.hash || "", ["gw"]);
    if (r.id !== "gw") return {};
    return {
      m1: readNumber(r.params.get("a"), MASS_MIN, MASS_MAX),
      m2: readNumber(r.params.get("b"), MASS_MIN, MASS_MAX),
      d: readNumber(r.params.get("d"), DIST_MIN, DIST_MAX),
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

// ─── Formatos ───────────────────────────────────────────────────────────────
const massText = (m, lang) => (lang === "es" ? `${sig(m, lang, 3)} ${m === 1 ? "masa solar" : "masas solares"}` : `${sig(m, lang, 3)} solar ${m === 1 ? "mass" : "masses"}`);
const distText = (mly, lang) => {
  const b = big(mly * 1e6, lang);
  return lang === "es" ? `${/(millón|millones)$/.test(b) ? `${b} de` : b} años luz` : `${b} light-years`;
};
const hzText = (f, lang) => `${sig(f, lang, 3)} Hz`;
const factorText = (f, lang) => { const s = sci(f, lang, 1); return s.includes("×") ? `(${s})` : s; };
const sciH = (h, lang) => `≈ ${sci(h, lang, 1)}`;

function Step({ id, title, lead, children }) {
  return (
    <section className="q-step" aria-labelledby={id}>
      <h3 id={id} className="q-h3 q-step__title">{title}</h3>
      {lead && <p className="q-step__lead">{lead}</p>}
      {children}
    </section>
  );
}

// ─── Anillo de partículas ───────────────────────────────────────────────────
// Se anima con requestAnimationFrame escribiendo directamente en el DOM; se
// detiene fuera de pantalla, con la pestaña oculta, con el botón de pausa y, si
// el sistema pide menos movimiento, no se anima: queda quieto y se recorre el
// ciclo a mano con un deslizador.
const RING_N = 24, RING_R = 70, PERIOD_S = 2.6;

function Ring({ s, lang, expSlider }) {
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(true);
  const [still, setStill] = useState(0);              // fase (0–1) a mano, si hay poco movimiento
  const wrap = useRef(null);
  const dots = useRef([]);
  const hVis = visibleStrain(expSlider);
  const hRef = useRef(hVis), phaseRef = useRef(0);
  hRef.current = hVis;
  const angles = useMemo(() => Array.from({ length: RING_N }, (_, i) => (i / RING_N) * 2 * Math.PI), []);

  const draw = useCallback(() => {
    for (let i = 0; i < RING_N; i++) {
      const el = dots.current[i];
      if (!el) continue;
      const [x, y] = ringPoint(angles[i], hRef.current, phaseRef.current);
      el.setAttribute("cx", (100 + RING_R * x).toFixed(2));
      el.setAttribute("cy", (100 + RING_R * y).toFixed(2));
    }
  }, [angles]);

  useEffect(() => { if (reduce) phaseRef.current = still * 2 * Math.PI; draw(); }, [draw, hVis, reduce, still, playing]);

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
    if (reduce || !playing || !visible) return undefined;
    let raf = 0, last = 0;
    const step = (now) => {
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      phaseRef.current = (phaseRef.current + (dt / 1000) * ((2 * Math.PI) / PERIOD_S)) % (2 * Math.PI);
      draw();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduce, playing, visible, draw]);

  const factor = factorText(exagFactor(expSlider), lang);
  const initial = angles.map(a => ringPoint(a, hVis, 0));
  return (
    <figure className="gw-ring q-fig" ref={wrap}>
      <figcaption className="q-fig__title">{s.ringTitle}</figcaption>
      <svg className="gw-ring__svg" viewBox="0 0 200 200" role="img" aria-label={(reduce ? s.ringAriaStill : s.ringAria)(s.exagValue(factor))}>
        <circle cx="100" cy="100" r={RING_R} className="gw-ring__guide" />
        <circle cx="100" cy="100" r="2.4" className="gw-ring__center" />
        {angles.map((a, i) => (
          <circle key={i} ref={el => { dots.current[i] = el; }} className="gw-ring__p" r="4.2"
            cx={(100 + RING_R * initial[i][0]).toFixed(2)} cy={(100 + RING_R * initial[i][1]).toFixed(2)} />
        ))}
      </svg>
      <p className="gw-ring__tag" aria-hidden="true">{s.exagValue(factor)}</p>
      {reduce ? (
        <>
          <p className="q-fine">{s.reduced}</p>
          <Slider label={s.phaseLabel} value={Math.round(still * 100)} min={0} max={100} step={1} onChange={(v) => setStill(v / 100)}
            valueText={s.phaseValue(Math.round(still * 100))} ariaText={s.phaseAria(Math.round(still * 100))} />
        </>
      ) : (
        <button type="button" className="btn btn--ghost gw-btn" onClick={() => setPlaying(p => !p)}>{playing ? s.pause : s.play}</button>
      )}
      <p className="q-fine">{s.ringNote}</p>
    </figure>
  );
}

// ─── Paso 1 ─────────────────────────────────────────────────────────────────
function WaveStep1({ lang, t, T }) {
  const s = T.s1;
  const rows = s.rows(sci(energyJ(3), lang, 2), lang === "es" ? "unos 1.300 millones de años luz" : "about 1.3 billion light-years");
  const years = lang === "es" ? "1.300 millones de años" : "1.3 billion years";
  return (
    <Step id="q-gw-s1" title={s.title} lead={s.lead}>
      <p className="q-step__p">{s.p1}</p>
      <h4 className="q-h4">{s.calcTitle}</h4>
      <dl className="q-calc q-calc--solo">
        {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>
      <p className="q-step__p">{s.p2(years)}</p>
      <p><Certainty level={s.tag} t={t} short note={s.tagNote} /></p>
      <p className="q-fine">{s.fine}</p>
      <Refs ids={["einstein1916", "abbott2016"]} refs={GW_REFS} lang={lang} t={t} />
      <Card id="q-gw-nobel" title={s.nobel.title} teaser={s.nobel.teaser} level={s.nobel.tag} t={t}>
        <p>{s.nobel.p1}</p>
        <Refs ids={["nobel2017"]} refs={GW_REFS} lang={lang} t={t} />
      </Card>
    </Step>
  );
}

// ─── Paso 2 ─────────────────────────────────────────────────────────────────
function SmallStep({ lang, t, T, expSlider, setExp }) {
  const s = T.s2;
  const dL = armDifference(1e-21), each = dL / 2;
  const hVis = visibleStrain(expSlider), pct = Math.round(hVis * 100), factor = factorText(exagFactor(expSlider), lang);
  const frac = Math.round(PROTON_DIAMETER_M / each);
  const ratio = big(PROTON_DIAMETER_M / 1e-21, lang);
  const mTxt = (x) => `${sci(x, lang, 2)} m`;
  const rows = s.scaleRows(mTxt(dL), mTxt(each), mTxt(PROTON_DIAMETER_M), s.scaleFrac(num(Number(frac.toPrecision(2)), lang)));
  return (
    <Step id="q-gw-s2" title={s.title} lead={s.lead}>
      <Ring s={s} lang={lang} expSlider={expSlider} />
      <Slider label={s.exagLabel} value={expSlider} min={EXAG_SLIDER.min} max={EXAG_SLIDER.max} step={EXAG_SLIDER.step} onChange={setExp}
        valueText={s.exagValue(factor)} ariaText={s.exagAria(sci(exagFactor(expSlider), lang, 1), pct)} />
      <p className="q-fine gw-fine">{s.exagFine(pct)}</p>
      <section className="gw-scale" aria-labelledby="q-gw-scale">
        <h4 id="q-gw-scale" className="q-h4">{s.scaleTitle}</h4>
        <p className="q-step__p">{s.scaleLead}</p>
        <dl className="q-calc q-calc--solo">
          {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
        <p className="q-step__p">{s.scaleP(ratio)}</p>
        <p><Certainty level={s.tag} t={t} short note={s.tagNote} /></p>
        <Why summary={s.why}>
          <p>{s.whyBody}</p>
          <Refs ids={["aasi2015", "codataProton"]} refs={GW_REFS} lang={lang} t={t} />
        </Why>
      </section>
    </Step>
  );
}

// ─── Sonido ─────────────────────────────────────────────────────────────────
function useChirp() {
  const ref = useRef({ ctx: null, src: null });
  const [state, setState] = useState("idle");           // idle | playing | unsupported
  const stop = useCallback(() => {
    const r = ref.current;
    try { if (r.src) { r.src.onended = null; r.src.stop(); } } catch { /* no-op */ }
    r.src = null;
    setState(s => (s === "unsupported" ? s : "idle"));
  }, []);
  const play = useCallback(async (m1, m2) => {
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { setState("unsupported"); return; }
    stop();
    try {
      const r = ref.current;
      if (!r.ctx) r.ctx = new AC();
      const ctx = r.ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const rate = 22050;
      const { samples } = audioSamples(m1, m2, rate);
      const buf = ctx.createBuffer(1, samples.length, rate);
      buf.getChannelData(0).set(samples);
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = 0.22;                              // volumen moderado
      src.buffer = buf;
      src.connect(gain); gain.connect(ctx.destination);
      src.onended = () => { if (ref.current.src === src) { ref.current.src = null; setState("idle"); } };
      r.src = src;
      src.start();
      setState("playing");
    } catch { setState("unsupported"); }
  }, [stop]);
  useEffect(() => () => {
    const r = ref.current;
    try { if (r.src) { r.src.onended = null; r.src.stop(); } } catch { /* no-op */ }
    try { if (r.ctx && r.ctx.close) r.ctx.close(); } catch { /* no-op */ }
    r.ctx = null; r.src = null;
  }, []);
  return { state, play, stop };
}

// ─── Forma de onda ──────────────────────────────────────────────────────────
// Marcas «redondas» (1, 2, 5 × 10ⁿ) para el eje del tiempo: unas 3 a 5.
function niceTicks(max) {
  const raw = max / 4, pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map(k => k * pow).find(v => v >= raw) || pow * 10;
  const out = [];
  for (let v = 0; v <= max * 1.0001; v += step) out.push(Number(v.toPrecision(6)));
  return out;
}

function Wave({ m1, m2, d, lang, S }) {
  const w = useMemo(() => waveform(m1, m2, 14), [m1, m2]);
  const hMax = strain(w.chirp, w.fEnd, mlyToMeters(d));
  const dur = w.duration;
  const unit = dur < 1 ? "ms" : "s", scale = dur < 1 ? 1000 : 1;
  const xMax = dur * scale;
  const xTicks = niceTicks(xMax);
  const xFmt = (v) => num(v, lang, v === 0 || v >= 1 || Number.isInteger(v) ? 0 : 2);
  const yFmt = (v) => (v === 0 ? "0" : `${v < 0 ? "−" : "+"}${sci(hMax, lang, 1)}`);
  const f0 = hzText(w.fStart, lang), f1 = hzText(w.fEnd, lang);
  const aria = S.waveAria(14, f0, f1, duration(dur, lang));
  return (
    <figure className="q-fig gw-wave">
      <figcaption className="q-fig__title">{S.waveTitle}</figcaption>
      <Plot h={220} x={[0, xMax]} y={[-1.2, 1.2]} xTicks={xTicks} yTicks={[-1, 0, 1]} xLabel={S.waveX(unit)} yLabel={S.waveY}
        fmt={yFmt} xFmt={xFmt} aria={aria} pad={{ l: 70 }}>
        {({ sx, sy, m, h }) => (
          <g>
            <line x1={sx(xMax)} x2={sx(xMax)} y1={m.t} y2={h - m.b} className="gw-wave__end" />
            <text x={sx(xMax) - 4} y={m.t + 10} textAnchor="end" className="q-plot__tick">{S.waveEnd}</text>
            <path d={pathOf(w.pts.map(p => [sx(p.t * scale), sy(p.y)]))} className="gw-wave__line" fill="none" />
          </g>
        )}
      </Plot>
      <p className="q-fine">{S.waveCaption(f0, f1)}</p>
    </figure>
  );
}

// ─── Paso 3: laboratorio ────────────────────────────────────────────────────
function LabStep({ lang, t, T, m1, m2, d, setM1, setM2, setD, setPreset, hash }) {
  const S = T.s3;
  const chirp = chirpMass(m1, m2), M = totalMass(m1, m2), fi = fIsco(M);
  const tau = F_LIGO_REF < fi ? timeToMerger(F_LIGO_REF, chirp) : null;
  const h = strain(chirp, fi, mlyToMeters(d));
  const active = PRESETS.find(p => p.m1 === m1 && p.m2 === m2 && p.d === d) || null;
  const plan = useMemo(() => audioPlan(m1, m2), [m1, m2]);
  const { state, play, stop } = useChirp();

  const parts = [];
  if (plan.k > 1.05) parts.push(S.pitchUp(sig(plan.k, lang, 2)));
  else if (plan.k < 0.95) parts.push(S.pitchDown(sig(1 / plan.k, lang, 2)));
  if (plan.stretch > 1.05) parts.push(S.slower(sig(plan.stretch, lang, 2)));
  else if (plan.stretch < 0.95) parts.push(S.faster(sig(1 / plan.stretch, lang, 2)));
  const soundLine = parts.length ? S.soundLabel(parts) : S.soundReal;

  const rows = S.rows(massText(M, lang), massText(chirp, lang), hzText(fi, lang), tau == null ? S.tauPast : duration(tau, lang), sciH(h, lang));
  const chip = (p) => (
    <button key={p.id} type="button" data-preset={p.id} className={`q-preset ${active && active.id === p.id ? "is-on" : ""}`}
      aria-pressed={!!active && active.id === p.id} onClick={() => setPreset(p)}>{S.presets[p.id]}</button>
  );
  return (
    <Step id="q-gw-s3" title={S.title} lead={S.lead}>
      <div className="gw-lab">
        <div className="gw-lab__controls">
          <div className="q-presets" role="group" aria-labelledby="q-gw-presets">
            <p id="q-gw-presets" className="q-presets__label">{S.presetsLabel}</p>
            <div className="q-presets__row q-presets__row--3 gw-presets">{PRESETS.map(chip)}</div>
          </div>
          <Slider label={S.m1Label} value={sliderFromMass(m1)} min={MASS_SLIDER.min} max={MASS_SLIDER.max} step={MASS_SLIDER.step}
            onChange={(v) => setM1(massFromSlider(v))} valueText={massText(m1, lang)} ariaText={massText(m1, lang)} />
          <Slider label={S.m2Label} value={sliderFromMass(m2)} min={MASS_SLIDER.min} max={MASS_SLIDER.max} step={MASS_SLIDER.step}
            onChange={(v) => setM2(massFromSlider(v))} valueText={massText(m2, lang)} ariaText={massText(m2, lang)} />
          <Slider label={S.dLabel} value={sliderFromDist(d)} min={DIST_SLIDER.min} max={DIST_SLIDER.max} step={DIST_SLIDER.step}
            onChange={(v) => setD(distFromSlider(v))} valueText={distText(d, lang)} ariaText={distText(d, lang)} />
          <div className="gw-note">
          <div className="q-presets__note" aria-live="polite">
            <p>{active ? S.notes[active.id] : S.custom}</p>
            {active && active.id === "gw150914" && <Refs ids={["abbott2016", "abbott2017basic"]} refs={GW_REFS} lang={lang} t={t} />}
            {active && active.id === "gw170817" && <Refs ids={["abbott2017bns", "abbott2017mm"]} refs={GW_REFS} lang={lang} t={t} />}
            {active && active.id === "ns" && <Refs ids={["ozel2016"]} refs={GW_REFS} lang={lang} t={t} />}
          </div>
          </div>
          <p className="q-fine gw-fine">{S.kindHint}</p>
        </div>

        <div className="gw-lab__out">
          <div className="q-result q-result--gw">
            <h4 className="q-h4 gw-h4">{S.resultsTitle}</h4>
            <dl className="q-calc q-calc--solo" role="status" aria-live="polite" aria-atomic="true">
              {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
            </dl>
            <p className="q-fine">{S.tauNote}</p>
            <p className="q-fine">{S.hNote}</p>
            <p><Certainty level={S.tag} t={t} short note={S.tagNote} /></p>
          </div>

          <Wave m1={m1} m2={m2} d={d} lang={lang} S={S} />

          <div className="gw-listen">
            <button type="button" className={`btn gw-btn gw-btn--listen ${state === "playing" ? "is-on" : ""}`}
              aria-pressed={state === "playing"} onClick={() => (state === "playing" ? stop() : play(m1, m2))}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {state === "playing" ? <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /> : <path d="M7 4.5v15l12-7.5z" fill="currentColor" />}
              </svg>
              {state === "playing" ? S.listenStop : S.listen}
            </button>
            <p className="gw-listen__label" role="status" aria-live="polite">{state === "unsupported" ? S.audioUnsupported : soundLine}</p>
            <p className="q-fine">{S.soundBand(hzText(plan.audioStart, lang), hzText(plan.audioEnd, lang))} {S.listenNote}</p>
          </div>
        </div>
      </div>

      <Why summary={S.formulaTitle} className="gw-why">
        <ul className="gw-formulas">
          {S.formulas.map((f, i) => (<li key={f}><span className="q-mono gw-formula">{f}</span><span>{S.formulaWhat[i]}</span></li>))}
        </ul>
        <p className="q-fine">{S.formulaNote}</p>
        <Refs ids={["maggiore", "abbott2017basic", "constants"]} refs={GW_REFS} lang={lang} t={t} />
      </Why>
      <ShareRow hash={hash} t={t} />
    </Step>
  );
}

// ─── Paso 4 ─────────────────────────────────────────────────────────────────
function LearnStep({ lang, t, T }) {
  const s = T.s4;
  return (
    <Step id="q-gw-s4" title={s.title} lead={s.lead}>
      <Card id="q-gw-speed" title={s.speed.title} teaser={s.speed.teaser} level={s.speed.tag} t={t} open>
        <p>{s.speed.p1}</p>
        <p>{s.speed.p2}</p>
        <Refs ids={["abbott2017grb"]} refs={GW_REFS} lang={lang} t={t} />
      </Card>
      <Card id="q-gw-gold" title={s.gold.title} teaser={s.gold.teaser} level={s.gold.tag} levelNote={s.gold.tagNote} t={t} open>
        <p>{s.gold.p1}</p>
        <p>{s.gold.p2}</p>
        <Refs ids={["abbott2017mm", "kasen2017"]} refs={GW_REFS} lang={lang} t={t} />
      </Card>
      <Card id="q-gw-count" title={s.count.title} teaser={s.count.teaser} level={s.count.tag} levelNote={s.count.tagNote} t={t} open>
        <p>{s.count.p1(218)}</p>
        <p>{s.count.p2}</p>
        <Refs ids={["gwtc4", "gwtc4ligo"]} refs={GW_REFS} lang={lang} t={t} />
      </Card>
      <Card id="q-gw-lisa" title={s.lisa.title} teaser={s.lisa.teaser} level={s.lisa.tag} levelNote={s.lisa.tagNote} t={t}>
        <p>{s.lisa.p1}</p>
        <p>{s.lisa.p2}</p>
        <Refs ids={["lisa", "lisaAdopt"]} refs={GW_REFS} lang={lang} t={t} />
      </Card>
      <Card id="q-gw-open" title={s.open.title} teaser={s.open.teaser} level={s.open.tag} t={t}>
        <p>{s.open.p1}</p>
      </Card>
    </Step>
  );
}

export default function GwTour({ lang = "es", indexHref }) {
  const t = TQ[lang] || TQ.es;
  const T = GW_T[lang] || GW_T.es;
  const fromHash = useMemo(readHash, []);
  const [m1, setM1] = useState(() => fromHash.m1 ?? store.m1 ?? START_PRESET.m1);
  const [m2, setM2] = useState(() => fromHash.m2 ?? store.m2 ?? START_PRESET.m2);
  const [d, setD] = useState(() => fromHash.d ?? store.d ?? START_PRESET.d);
  const [expSlider, setExp] = useState(() => store.exag ?? EXAG_SLIDER.start);
  useEffect(() => { store.m1 = m1; store.m2 = m2; store.d = d; store.exag = expSlider; }, [m1, m2, d, expSlider]);

  const setPreset = useCallback((p) => { setM1(p.m1); setM2(p.m2); setD(p.d); }, []);

  const prefix = lang === "es" ? "preguntas" : "questions";
  const hash = `#${prefix}?q=gw&a=${Number(m1.toPrecision(3))}&b=${Number(m2.toPrecision(3))}&d=${Number(d.toPrecision(4))}`;
  useHashSync(hash);

  return (
    <section className="q q-tour q-gw-tour" aria-labelledby="q-title">
      <TourHead t={t} title={T.title} lead={T.lead} indexHref={indexHref} />

      <WaveStep1 lang={lang} t={t} T={T} />
      <SmallStep lang={lang} t={t} T={T} expSlider={expSlider} setExp={setExp} />
      <LabStep lang={lang} t={t} T={T} m1={m1} m2={m2} d={d} setM1={setM1} setM2={setM2} setD={setD} setPreset={setPreset} hash={hash} />
      <LearnStep lang={lang} t={t} T={T} />

      <aside className="q-honesty q-assume" aria-labelledby="q-gw-assume">
        <h3 id="q-gw-assume" className="q-honesty__title">{T.assumptionsTitle}</h3>
        <ul className="q-assume__list">{T.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
      </aside>

      <section className="q-sources" aria-labelledby="q-gw-sources">
        <h3 id="q-gw-sources" className="q-h3">{T.sourcesTitle}</h3>
        <Refs ids={Object.keys(GW_REFS)} refs={GW_REFS} lang={lang} t={t} />
      </section>

      <p className="q-fine q-honest">{T.honest}</p>

      <nav className="q-next" aria-labelledby="q-next-title">
        <h3 id="q-next-title" className="q-next__title">{t.nextTitle}</h3>
        <ul>
          <li>
            <a href={`#${prefix}?q=bh`}>{T.nextBhTitle}</a>
            <span>{T.nextBhNote}</span>
          </li>
          <li>
            <a href={`#${prefix}?q=time`}>{T.nextTimeTitle}</a>
            <span>{T.nextTimeNote}</span>
          </li>
          {GW_NEXT.map(l => (
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
