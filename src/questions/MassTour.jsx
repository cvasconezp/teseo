// MassTour.jsx — recorrido "¿Qué pasa si cambio la masa?".
// Datos, textos y fuentes: massData.js. Aquí solo hay interfaz y animación.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MASS_T, MASS_REFS, MASS_NEXT, MASS_SLIDER, DEFAULT_LOGM, PRESETS, WORLDS, WEIGHINGS, ORBIT_DISTANCES, DEFAULT_ORBIT,
  M_EARTH_KG, DM_OVER_ORDINARY,
  surfaceGravity, escapeVelocity, meanDensity, schwarzschildKg, weightN, scaleKg, orbitPeriod, massFromOrbit, animSeconds,
  worldGravity, radiusM, starTeff, classify, massHuman, logToMass, massToLog, tickPct, nearestLadder, kelvinToRgb,
} from "./massData.js";
import { readNumber, parseRoute, clamp } from "./physics.js";
import { R_EARTH } from "./constants.js";
import { num, sig, sci } from "./format.js";
import { length, duration, quantity, times } from "./units.js";
import { TQ } from "./i18n.js";
import {
  Certainty, Card, Refs, Why, Slider, Ticks, TourHead, ShareRow, NextLinks, useHashSync, sub,
} from "./shared.jsx";

// Último estado del deslizador del laboratorio (no la masa personal: esa no se guarda).
const store = { logM: null, orbit: null };

function readHash() {
  try {
    const r = parseRoute(window.location.hash || "", ["mass"]);
    if (r.id !== "mass") return {};
    return { logM: readNumber(r.params.get("m"), MASS_SLIDER.min, MASS_SLIDER.max) };
  } catch { return {}; }
}

const prefix = (lang) => (lang === "es" ? "preguntas" : "questions");

// ── Formato ─────────────────────────────────────────────────────────────────
const fmt3 = (x, lang) => (x > 0 && (x < 0.01 || x >= 1e6) ? sci(x, lang, 2) : sig(x, lang, 3));
const fmtSpeed = (v, lang) => (v < 1000 ? `${sig(v, lang, 2)} m/s` : `${sig(v / 1000, lang, 3)} km/s`);
const fmtKg = (x, lang) => (x >= 1e6 || x < 0.01 ? sci(x, lang, 3) : sig(x, lang, 3));
const ratioTxt = (k, lang) => (k >= 100 ? times(k, lang) : sig(k, lang, 2));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Dibujo del cuerpo ───────────────────────────────────────────────────────
// Tamaños A ESCALA REAL entre el cuerpo y una referencia conocida (el círculo a trazos). La referencia
// se elige sola entre Ceres, la Luna, la Tierra, Júpiter y el Sol: la de radio más parecido, para que
// los dos se vean (una escala logarítmica haría parecer la Tierra casi tan grande como Júpiter).
// Radios medios en metros (NASA Fact Sheets; Ceres: JPL SBDB; Sol: IAU 2015).
const ART_REFS = [
  { id: "ceres",   R: 469.7e3 },
  { id: "moon",    R: 1737.4e3 },
  { id: "earth",   R: 6371.0e3 },
  { id: "jupiter", R: 69911e3 },
  { id: "sun",     R: 695700e3 },
];
const REF_NAMES = {
  es: { ceres: "Ceres", moon: "Luna", earth: "Tierra", jupiter: "Júpiter", sun: "Sol" },
  en: { ceres: "Ceres", moon: "Moon", earth: "Earth", jupiter: "Jupiter", sun: "Sun" },
};
const ART_MAX = 66;   // radio en unidades del dibujo del mayor de los dos
function artRef(R) {
  // La Tierra es la referencia natural mientras los dos se vean (radios entre 1/12 y 12 veces el suyo);
  // si no, la referencia conocida más parecida en tamaño, sin usar el mismo cuerpo (±5 %).
  const byId = Object.fromEntries(ART_REFS.map(r => [r.id, r]));
  const same = (ref) => { const k = R / ref.R; return k > 0.95 && k < 1.05; };
  const kE = R / byId.earth.R;
  if (!same(byId.earth) && kE >= 1 / 12 && kE <= 12) return byId.earth;
  if (same(byId.earth)) return byId.moon;
  let best = null, bd = Infinity;
  for (const ref of ART_REFS) {
    if (same(ref) || ref.id === "earth") continue;
    const d = Math.abs(Math.log(R / ref.R)); if (d < bd) { bd = d; best = ref; }
  }
  return best;
}
const LUMPY = [1, 0.84, 0.95, 0.72, 0.9, 1, 0.8, 0.93, 0.86, 1, 0.76, 0.9];
const BANDS = ["#E7D3B2", "#C79E76", "#EEDCC1", "#B58760", "#E3C9A2", "#A87656", "#E9D6B6", "#BE8E66"];

function BodyArt({ kind, R, teff, aria, lang }) {
  const uid = useId().replace(/:/g, "");
  const ref = artRef(R), scale = ART_MAX / Math.max(R, ref.R);
  const px = Math.max(2, R * scale), ep = Math.max(1.5, ref.R * scale), cx = 150, cy = 84;
  const refLabel = `${REF_NAMES[lang === "es" ? "es" : "en"][ref.id]} ${lang === "es" ? "(a escala)" : "(to scale)"}`;
  let art;
  if (kind === "irregular" || kind === "transition") {
    const n = LUMPY.length, amp = kind === "irregular" ? 1 : 0.33;
    const pts = LUMPY.map((k, i) => { const a = (i / n) * Math.PI * 2, r = px * (1 - (1 - k) * amp * (kind === "irregular" ? 1 : 1)); return `${(cx + Math.cos(a) * r * 1.08).toFixed(1)},${(cy + Math.sin(a) * r * 0.92).toFixed(1)}`; }).join(" ");
    art = (<g>
      <defs><radialGradient id={`g${uid}`} cx="36%" cy="30%" r="80%"><stop offset="0" stopColor="#B9B0A4" /><stop offset="1" stopColor="#4E4841" /></radialGradient></defs>
      <polygon points={pts} fill={`url(#g${uid})`} stroke="#2C2823" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx={cx - px * 0.25} cy={cy - px * 0.1} r={Math.max(1.2, px * 0.14)} fill="#000" opacity="0.28" />
      <circle cx={cx + px * 0.28} cy={cy + px * 0.2} r={Math.max(1, px * 0.1)} fill="#000" opacity="0.28" />
    </g>);
  } else if (kind === "round") {
    art = (<g>
      <defs><radialGradient id={`g${uid}`} cx="36%" cy="30%" r="80%"><stop offset="0" stopColor="#C2B8AA" /><stop offset="1" stopColor="#4B453E" /></radialGradient></defs>
      <circle cx={cx} cy={cy} r={px} fill={`url(#g${uid})`} />
      <circle cx={cx - px * 0.3} cy={cy - px * 0.2} r={px * 0.13} fill="#000" opacity="0.22" />
      <circle cx={cx + px * 0.34} cy={cy + px * 0.12} r={px * 0.09} fill="#000" opacity="0.22" />
      <circle cx={cx - px * 0.05} cy={cy + px * 0.42} r={px * 0.11} fill="#000" opacity="0.22" />
    </g>);
  } else if (kind === "neptunian") {
    art = (<g>
      <defs>
        <radialGradient id={`g${uid}`} cx="36%" cy="30%" r="80%"><stop offset="0" stopColor="#9BD6F2" /><stop offset="1" stopColor="#24528C" /></radialGradient>
        <clipPath id={`c${uid}`}><circle cx={cx} cy={cy} r={px} /></clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={px} fill={`url(#g${uid})`} />
      <g clipPath={`url(#c${uid})`} opacity="0.35">
        <rect x={cx - px} y={cy - px * 0.35} width={px * 2} height={px * 0.12} fill="#fff" />
        <rect x={cx - px} y={cy + px * 0.2} width={px * 2} height={px * 0.1} fill="#fff" />
      </g>
    </g>);
  } else if (kind === "giant") {
    const h = (px * 2) / BANDS.length;
    art = (<g>
      <defs><clipPath id={`c${uid}`}><circle cx={cx} cy={cy} r={px} /></clipPath>
        <radialGradient id={`s${uid}`} cx="36%" cy="30%" r="85%"><stop offset="0.5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.5" /></radialGradient></defs>
      <g clipPath={`url(#c${uid})`}>{BANDS.map((c, i) => <rect key={i} x={cx - px} y={cy - px + i * h} width={px * 2} height={h + 0.6} fill={c} />)}</g>
      <circle cx={cx} cy={cy} r={px} fill={`url(#s${uid})`} />
    </g>);
  } else if (kind === "browndwarf") {
    art = (<g>
      <defs>
        <radialGradient id={`g${uid}`} cx="40%" cy="35%" r="80%"><stop offset="0" stopColor="#D1618B" /><stop offset="0.6" stopColor="#7E2A4A" /><stop offset="1" stopColor="#2A0F1E" /></radialGradient>
        <radialGradient id={`h${uid}`}><stop offset="0.7" stopColor="#E0668F" stopOpacity="0.35" /><stop offset="1" stopColor="#E0668F" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={px * 1.5} fill={`url(#h${uid})`} />
      <circle cx={cx} cy={cy} r={px} fill={`url(#g${uid})`} />
    </g>);
  } else {
    const [r, g, b] = kelvinToRgb(teff || 5772), col = `rgb(${r},${g},${b})`;
    const glow = Math.min(78, px * (kind === "massive" ? 1.55 : 1.4));
    art = (<g>
      <defs>
        <radialGradient id={`h${uid}`}><stop offset="0.55" stopColor={col} stopOpacity="0.55" /><stop offset="1" stopColor={col} stopOpacity="0" /></radialGradient>
        <radialGradient id={`g${uid}`} cx="45%" cy="40%" r="70%"><stop offset="0" stopColor="#fff" /><stop offset="0.55" stopColor={col} /><stop offset="1" stopColor={col} /></radialGradient>
      </defs>
      {kind === "massive" && [0, 45, 90, 135].map(a => (
        <line key={a} x1={cx - 78} x2={cx + 78} y1={cy} y2={cy} stroke={col} strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${a} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={glow} fill={`url(#h${uid})`} />
      <circle cx={cx} cy={cy} r={px} fill={`url(#g${uid})`} />
    </g>);
  }
  return (
    <svg className="q-mass__art" viewBox="0 0 300 168" role="img" aria-label={aria}>
      <g aria-hidden="true">
        {art}
        <circle cx={cx} cy={cy} r={ep} fill="none" stroke="#0A1020" strokeOpacity="0.55" strokeWidth="3.4" />
        <circle cx={cx} cy={cy} r={ep} fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.3" strokeDasharray="4 3" />
        <text x={cx} y="162" textAnchor="middle" className="q-plot__label">{refLabel}</text>
      </g>
    </svg>
  );
}

// Figura «tú» sobre la superficie.
function Person() {
  return (
    <svg className="q-mass__person" viewBox="0 0 40 70" aria-hidden="true" focusable="false">
      <circle cx="20" cy="9" r="7" fill="currentColor" />
      <path d="M12 20h16a4 4 0 0 1 4 4v18h-5v24h-6V48h-4v18h-6V42H8V24a4 4 0 0 1 4-4z" fill="currentColor" />
    </svg>
  );
}

// ── Paso 1: masa no es peso ─────────────────────────────────────────────────
function WeightStep({ lang, t, T, personKg, setPersonKg }) {
  const W = T.w;
  const [text, setText] = useState(String(personKg));
  const onField = (e) => {
    const v = e.target.value;
    setText(v);
    const x = Number(String(v).replace(",", "."));
    if (Number.isFinite(x) && x > 0) setPersonKg(clamp(x, 1, 500));
  };
  const onSlide = (v) => { setPersonKg(v); setText(String(v)); };
  const kTxt = sig(personKg, lang, 3);
  const slideV = clamp(Math.round(personKg), 20, 150);
  return (
    <section className="q-mass__sec" aria-labelledby="q-mass-w">
      <p className="q-mass__step">{T.stepLabel(1, 3)}</p>
      <h3 id="q-mass-w" className="q-h3">{W.title}</h3>
      <p className="q-model__lead">{W.lead}</p>
      <div className="q-mass__you">
        <Slider label={W.slider} hint={W.sliderHint} value={slideV} min={20} max={150} step={1} onChange={onSlide} valueText={W.sliderValue(num(slideV, lang))} />
        <label className="q-mass__field">
          <span>{W.field}</span>
          <input type="number" inputMode="decimal" min="1" max="500" step="any" value={text} onChange={onField} />
        </label>
      </div>
      <table className="q-table q-mass__table">
        <caption>{W.caption(kTxt)}</caption>
        <thead><tr><th scope="col">{W.colWorld}</th><th scope="col">{W.colWeight}</th><th scope="col">{W.colScale}</th></tr></thead>
        <tbody>
          {WORLDS.map(w => {
            const g = worldGravity(w), wN = weightN(personKg, g), sk = scaleKg(personKg, g);
            return (
              <tr key={w.id} className={w.id === "earth" ? "is-you" : ""}>
                <th scope="row">{w.name[lang]}</th>
                <td>{fmtKg(wN, lang)} N</td>
                <td>{fmtKg(sk, lang)} {W.unitScale}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="q-mass__same" role="status" aria-live="polite">{W.same(kTxt)}</p>
      <p className="q-fine">{W.scale}</p>
      <p className="q-fine">{W.notes}</p>
      <p className="q-fine">{W.nsNote}</p>
      <p><Certainty level="measured" t={t} short note={lang === "es" ? "datos de la NASA; la estrella de neutrones es un orden de magnitud" : "NASA data; the neutron star is an order of magnitude"} /></p>
      <Why summary={W.whySummary}>
        <ul className="q-formulas">{W.whyBody.map(f => <li key={f} className="q-formula">{f}</li>)}</ul>
        <p>{W.whyFine}</p>
        <Refs ids={["nasaFacts", "codata", "nicer"]} refs={MASS_REFS} lang={lang} t={t} />
      </Why>
    </section>
  );
}

// ── Paso 2: laboratorio ─────────────────────────────────────────────────────
function Lab({ lang, t, T, personKg, logM, setLogM }) {
  const L = T.lab;
  const M = logToMass(logM);
  const R = radiusM(M);
  const g = surfaceGravity(M, R);
  const vEsc = escapeVelocity(M, R);
  const rho = meanDensity(M, R);
  const rs = schwarzschildKg(M);
  const teff = starTeff(M);
  const preset = PRESETS.find(p => Math.abs(massToLog(p.mass) - logM) < 0.006) || null;
  const kind = (preset && preset.kind) || classify(M);
  const K = L.kind[kind];
  const gE = surfaceGravity(M_EARTH_KG, R_EARTH);
  const isGiantOrStar = kind === "giant" || kind === "neptunian" || kind === "browndwarf";
  const isStar = kind === "star" || kind === "massive";
  const kTxt = sig(personKg, lang, 3);
  const ratioG = g / gE;
  const barPct = clamp(((Math.log10(ratioG) + 4) / 7) * 100, 2, 100);
  const earthPct = (4 / 7) * 100;
  const rRatio = R / R_EARTH;
  const { obj, ratio } = nearestLadder(2 * rs);
  const bhText = ratio > 0.8 && ratio < 1.25 ? L.bhSame(obj.name[lang]) : ratio >= 1 ? L.bhBigger(times(ratio, lang), obj.name[lang]) : L.bhSmaller(times(1 / ratio, lang), obj.name[lang]);
  const massTxt = massHuman(M, lang);
  const marks = [
    { label: L.tickMoon, pct: tickPct(7.346e22) },
    { label: L.tickJup, pct: tickPct(1.89813e27) }, { label: L.tickSun, pct: tickPct(1.98841e30) },
  ];
  const certainty = preset && preset.real ? "measured" : "estimated";
  return (
    <section className="q-mass__sec" aria-labelledby="q-mass-lab">
      <p className="q-mass__step">{T.stepLabel(2, 3)}</p>
      <h3 id="q-mass-lab" className="q-h3">{L.title}</h3>
      <p className="q-model__lead">{L.lead}</p>

      <div className="q-mass__panel">
        <Slider label={L.slider} hint={L.sliderHint} value={logM} min={MASS_SLIDER.min} max={MASS_SLIDER.max} step={MASS_SLIDER.step}
          onChange={setLogM} valueText={massTxt}>
          <Ticks marks={marks} />
        </Slider>
        <div className="q-presets q-presets--chips" role="group" aria-labelledby="q-mass-presets">
          <p id="q-mass-presets" className="q-presets__label">{L.presetsLabel}</p>
          <div className="q-chips">
            {PRESETS.map(p => (
              <button key={p.id} type="button" data-preset={p.id} className={`q-preset ${preset && preset.id === p.id ? "is-on" : ""}`}
                aria-pressed={!!preset && preset.id === p.id} onClick={() => setLogM(massToLog(p.mass))}>{p.label[lang]}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="q-mass__panel q-mass__panel--out">
        <p className="q-result__label">{L.kindLabel}</p>
        <p className="q-mass__kind" role="status" aria-live="polite" aria-atomic="true">
          <span className="q-mass__kindname">{K.name}</span>
          <span className="q-mass__kindwhat">{K.what}</span>
        </p>
        <BodyArt kind={kind} R={R} teff={teff} lang={lang} aria={L.artAria(K.name, length(R, lang), radiusTxtVs(rRatio, lang, L))} />
        <p className="q-mass__blurb">{K.blurb}</p>
        <p className="q-mass__tags">
          <Certainty level="estimated" t={t} short note={L.tagThreshold} />
          <Certainty level={certainty} t={t} short note={certainty === "measured" ? L.measuredTag : L.estimatedTag} />
        </p>
        <p className="q-fine">{L.approx}</p>
        {logM > MASS_SLIDER.max - 0.5 && <p className="q-fine">{L.limitNote}</p>}

        <dl className="q-dist__list q-mass__facts">
          <div><dt>{L.radius}</dt><dd>{length(R, lang)}<span className="q-bh__cmp">{radiusTxtVs(rRatio, lang, L)}</span></dd></div>
          <div><dt>{L.gravity}</dt><dd>{fmt3(g, lang)} m/s²<span className="q-bh__cmp">{L.gravityVs(ratioTxt(ratioG, lang))}</span></dd></div>
          <div><dt>{L.escape}</dt><dd>{fmtSpeed(vEsc, lang)}<span className="q-bh__cmp">{L.escapeVs(ratioTxt(vEsc / 11186, lang))}</span></dd></div>
          <div><dt>{L.density}</dt><dd>{quantity(rho, lang)} kg/m³<span className="q-bh__cmp">{L.densityVs}</span></dd></div>
          {isStar && teff && <div><dt>{L.temp}</dt><dd>{num(Math.round(teff / 10) * 10, lang)} K<span className="q-bh__cmp">{L.tempNote}</span></dd></div>}
        </dl>
        {(isGiantOrStar || isStar) && <p className="q-fine">{isStar ? L.surfaceStar : L.surfaceGiant}</p>}
      </div>

      <div className="q-mass__panel q-mass__panel--here">
        <h4 className="q-h4 q-mass__h4">{L.hereTitle}</h4>
        <div className="q-mass__here">
          <div className="q-mass__figure"><Person /><i aria-hidden="true" /></div>
          <div className="q-mass__heretxt">
            <p className="q-fine">{L.hereLead(kTxt)}</p>
            <p className="q-mass__hereline"><span>{L.hereWeight}</span><strong>{fmtKg(weightN(personKg, g), lang)} N</strong></p>
            <p className="q-mass__hereline"><span>{L.hereScale}</span><strong>{fmtKg(scaleKg(personKg, g), lang)} kg</strong></p>
          </div>
        </div>
        <div className="q-wbar" role="img" aria-label={L.hereBarAria(ratioTxt(ratioG, lang))}>
          <div className="q-wbar__track" aria-hidden="true"><i style={{ width: `${barPct}%` }} /><b style={{ left: `${earthPct}%` }} /></div>
          <div className="q-wbar__lbl" aria-hidden="true"><span style={{ left: `${earthPct}%` }}>{L.hereBarEarth}</span></div>
        </div>
        <p className="q-fine">{ratioG >= 1 ? L.hereRatio(ratioTxt(ratioG, lang), true) : L.hereRatio(ratioTxt(ratioG, lang), false)}. {L.hereBarFine}</p>
        {(isStar || isGiantOrStar) && <p className="q-fine">{L.hereNoSurface}</p>}
      </div>

      <div className="q-mass__panel q-mass__panel--bh">
        <h4 className="q-h4 q-mass__h4">{L.bhTitle}</h4>
        <p className="q-fine">{sub(L.bhLead)}</p>
        <p className="q-mass__bh" role="status" aria-live="polite" aria-atomic="true">
          <span className="q-mono">{sub("r_s")} = </span><strong>{length(rs, lang)}</strong>
        </p>
        <p className="q-mass__blurb">{bhText}</p>
        {obj.approx && <p className="q-fine">{L.bhApprox}</p>}
        <p className="q-fine">{L.bhNote}</p>
      </div>

      <Why summary={L.whySummary}>
        <ul className="q-formulas">{L.whyBody.map(f => <li key={f} className="q-formula">{sub(f)}</li>)}</ul>
        <p>{L.whyFine}</p>
        <Refs ids={["nasaFacts", "ceres", "mamajek", "hatzes", "codata", "iau2015"]} refs={MASS_REFS} lang={lang} t={t} />
      </Why>
    </section>
  );
}
function radiusTxtVs(r, lang, L) { return L.radiusVs(ratioTxt(r, lang), r >= 1); }

// ── Paso 3: órbita ──────────────────────────────────────────────────────────
function useReducedMotion() {
  const [r, setR] = useState(() => { try { return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } });
  useEffect(() => {
    let mq; try { mq = window.matchMedia("(prefers-reduced-motion: reduce)"); } catch { return undefined; }
    if (!mq) return undefined;
    const on = () => setR(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", on); else if (mq.addListener) mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", on); else if (mq.removeListener) mq.removeListener(on); };
  }, []);
  return r;
}

const RO = 104, CX = 150, CY = 124;

function OrbitSim({ perMine, perRef, bodyPx, inside, T, aria }) {
  const O = T.orbit;
  const wrap = useRef(null), mineRef = useRef(null), refRef = useRef(null);
  const phase = useRef({ a: 0.6, b: 0.6 });
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [onScreen, setOnScreen] = useState(true);
  const run = playing && !reduced && onScreen && !inside;

  const place = useCallback(() => {
    const at = (el, ang, r) => { if (el) el.setAttribute("transform", `translate(${(CX + Math.cos(ang) * r).toFixed(2)} ${(CY - Math.sin(ang) * r).toFixed(2)})`); };
    at(mineRef.current, phase.current.a, RO);
    at(refRef.current, phase.current.b, RO);
  }, []);
  useEffect(() => { place(); }, [place, perMine, perRef, inside]);

  // Se detiene cuando la figura sale de la pantalla.
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver((es) => setOnScreen(es[es.length - 1].isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!run) return undefined;
    let raf = 0, last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      phase.current.a += (2 * Math.PI * dt) / perMine;
      phase.current.b += (2 * Math.PI * dt) / perRef;
      place();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, perMine, perRef, place]);

  const stepOnce = () => { phase.current.a += 0.8; phase.current.b += 0.8 * (perMine / perRef); place(); };
  return (
    <div ref={wrap} className="q-orbit">
      <svg className="q-orbit__svg" viewBox="0 0 300 248" role="img" aria-label={aria}>
        <g aria-hidden="true">
          <circle cx={CX} cy={CY} r={RO} fill="none" stroke="rgba(255,255,255,0.22)" strokeDasharray="3 5" />
          <circle cx={CX} cy={CY} r={bodyPx} className="q-orbit__body" />
          <g ref={refRef}><circle r="6" className="q-orbit__ref" /></g>
          <g ref={mineRef}><circle r="7.5" className="q-orbit__mine" /></g>
        </g>
      </svg>
      <ul className="q-leg q-orbit__leg">
        <li><svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true" focusable="false"><circle cx="13" cy="7" r="6" fill="var(--violet)" /></svg>{O.legendMine}</li>
        <li><svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true" focusable="false"><circle cx="13" cy="7" r="5" fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="3 2.4" /></svg>{O.legendRef}</li>
      </ul>
      <div className="q-row q-orbit__ctl">
        {reduced
          ? <button type="button" className="btn btn--ghost" onClick={stepOnce} disabled={inside}>{O.step}</button>
          : <button type="button" className="btn btn--ghost" onClick={() => setPlaying(p => !p)} aria-pressed={!playing} disabled={inside}>{playing ? O.pause : O.play}</button>}
      </div>
    </div>
  );
}

function OrbitStep({ lang, t, T, logM }) {
  const O = T.orbit;
  const M = logToMass(logM);
  const R = radiusM(M);
  const [dist, setDist] = useState(() => store.orbit || DEFAULT_ORBIT);
  useEffect(() => { store.orbit = dist; }, [dist]);
  const d = ORBIT_DISTANCES.find(x => x.id === dist) || ORBIT_DISTANCES[2];
  const inside = R >= d.a;
  const Tm = orbitPeriod(M, d.a), Te = orbitPeriod(M_EARTH_KG, d.a);
  const perMine = animSeconds(Tm, Te), perRef = animSeconds(Te, Te);
  const bodyPx = inside ? RO * 0.9 : clamp((RO * R) / d.a, 5, RO * 0.9);
  const k = Te / Tm;
  const cmp = Math.abs(Math.log10(k)) < 0.01 ? O.same : k > 1 ? O.faster(ratioTxt(k, lang)) : O.slower(ratioTxt(1 / k, lang));
  return (
    <section className="q-mass__sec" aria-labelledby="q-mass-orbit">
      <p className="q-mass__step">{T.stepLabel(3, 3)}</p>
      <h3 id="q-mass-orbit" className="q-h3">{O.title}</h3>
      <p className="q-model__lead">{O.lead}</p>
      <div className="q-mass__panel">
        <p className="q-presets__label" id="q-mass-dist">{O.distLabel}</p>
        <div className="q-chips q-chips--wrap" role="group" aria-labelledby="q-mass-dist">
          {ORBIT_DISTANCES.map(x => (
            <button key={x.id} type="button" data-preset={`orbit_${x.id}`} className={`q-preset ${x.id === dist ? "is-on" : ""}`} aria-pressed={x.id === dist} onClick={() => setDist(x.id)}>{x.label[lang]}</button>
          ))}
        </div>
        <OrbitSim perMine={perMine} perRef={perRef} bodyPx={bodyPx} inside={inside} T={T}
          aria={O.aria(duration(Tm, lang), length(d.a, lang))} />
        {inside
          ? <p className="q-mass__blurb" role="status">{O.inside}</p>
          : (<div className="q-mass__orbitout" role="status" aria-live="polite" aria-atomic="true">
            <p><strong>{O.yours}:</strong> {O.period(duration(Tm, lang))}</p>
            <p><strong>{O.earth}:</strong> {O.period(duration(Te, lang))}</p>
            <p className="q-mass__blurb">{cmp}</p>
          </div>)}
        <p className="q-fine">{O.notRealTime}</p>
      </div>
      <h4 className="q-h4 q-mass__h4">{O.formulaTitle}</h4>
      <p className="q-formula">{O.formula}</p>
      <p className="q-fine">{O.formulaWords}</p>
      <p className="q-fine">{O.testMass}</p>
    </section>
  );
}

function WeighCard({ lang, t, T }) {
  const O = T.orbit;
  return (
    <Card id="q-mass-weigh" title={O.weighTitle} teaser={O.weighTeaser} level="measured" t={t}>
      <p>{sub(O.weighLead)}</p>
      <dl className="q-points">
        {WEIGHINGS.map(w => {
          const M = massFromOrbit(w.a, w.T);
          const diff = (M / w.known - 1) * 100;
          const pct = `${diff >= 0 ? "+" : "−"}${sig(Math.abs(diff), lang, 2)} %`;
          return (
            <div key={w.id}>
              <dt>{w.name[lang]}</dt>
              <dd>{O.weighRow(length(w.a, lang), duration(w.T, lang), fmtKg(M, lang), fmtKg(w.known, lang), pct)}</dd>
            </div>
          );
        })}
      </dl>
      <p className="q-fine">{O.weighFine}</p>
      <Refs ids={["nasaJovian", "nasaFacts", "codata"]} refs={MASS_REFS} lang={lang} t={t} />
    </Card>
  );
}

function ThresholdCard({ lang, t, T }) {
  const th = T.thresholds;
  return (
    <Card id="q-mass-thresholds" title={th.title} teaser={th.teaser} level={th.tag} levelNote={lang === "es" ? "umbrales aproximados" : "approximate thresholds"} t={t}>
      <p>{th.p1}</p>
      <dl className="q-points">
        {th.items.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>
      <Refs ids={["potato", "chenKipping", "rogers", "hatzes", "spiegel", "chabrier", "dupuy", "smartt"]} refs={MASS_REFS} lang={lang} t={t} />
    </Card>
  );
}

export default function MassTour({ lang = "es", indexHref }) {
  const t = TQ[lang] || TQ.es;
  const T = MASS_T[lang] || MASS_T.es;
  const fromHash = useMemo(readHash, []);
  const [logM, setLogM] = useState(() => fromHash.logM ?? store.logM ?? DEFAULT_LOGM);
  const [personKg, setPersonKg] = useState(60);      // solo en memoria: no va al hash ni a ningún almacén
  useEffect(() => { store.logM = logM; }, [logM]);

  const hash = `#${prefix(lang)}?q=mass&m=${Number(logM.toFixed(3))}`;
  useHashSync(hash);

  return (
    <section className="q q-tour q-mass" aria-labelledby="q-title">
      <TourHead t={t} title={T.title} lead={T.lead} indexHref={indexHref} />

      <WeightStep lang={lang} t={t} T={T} personKg={personKg} setPersonKg={setPersonKg} />
      <Lab lang={lang} t={t} T={T} personKg={personKg} logM={logM} setLogM={setLogM} />
      <OrbitStep lang={lang} t={t} T={T} logM={logM} />

      <section className="q-thread" aria-labelledby="q-thread-title">
        <h3 id="q-thread-title" className="q-h3 q-thread__title">{lang === "es" ? "El hilo sigue" : "The thread goes on"}</h3>
        <WeighCard lang={lang} t={t} T={T} />
        <ThresholdCard lang={lang} t={t} T={T} />
      </section>

      <section className="q-exo q-mass__close" aria-labelledby="q-mass-close">
        <h3 id="q-mass-close" className="q-h3">{T.close.title}</h3>
        <p className="q-exo__text q-mass__closetext">{T.close.lead(sig(DM_OVER_ORDINARY, lang, 2))}</p>
        <a className="btn btn--ghost q-exo__btn" href={`#${prefix(lang)}?q=dm`}>{T.close.link}</a>
      </section>

      <section className="q-mass__assume" aria-labelledby="q-mass-assume">
        <h3 id="q-mass-assume" className="q-h3">{T.assumptions.title}</h3>
        <ul className="q-mass__list">{T.assumptions.items.map(s => <li key={s}>{s}</li>)}</ul>
        <h4 className="q-h4">{T.assumptions.sourcesTitle}</h4>
        <Refs ids={Object.keys(MASS_REFS)} refs={MASS_REFS} lang={lang} t={t} />
      </section>

      <p className="q-fine q-honest">{T.honest}</p>
      <ShareRow hash={hash} t={t} />
      <p className="q-fine">{T.shareNote}</p>
      <NextLinks links={MASS_NEXT} lang={lang} t={t} />
    </section>
  );
}
