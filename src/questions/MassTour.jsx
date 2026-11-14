// MassTour.jsx — recorrido "¿Qué pasa si cambio la masa?".
// Datos, textos y fuentes: massData.js. Aquí solo hay interfaz y animación.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MASS_T, MASS_REFS, MASS_NEXT, MASS_SLIDER, DEFAULT_LOGM, PRESETS, WORLDS, WEIGHINGS, ORBIT_DISTANCES, DEFAULT_ORBIT,
  M_EARTH_KG, MJ_KG, DM_OVER_ORDINARY,
  surfaceGravity, escapeVelocity, meanDensity, schwarzschildKg, weightN, scaleKg, orbitPeriod, massFromOrbit, animSeconds,
  worldGravity, radiusM, starTeff, classify, massHuman, logToMass, massToLog, tickPct, nearestLadder, kelvinToRgb,
  EXAMPLE_SHORT, COMPARES, TABLE_ORDER, WD_MEASURED, example, exampleDensity, teaspoonKg,
  densityBand, isRelativistic, sizeSlider, clampLogR, sizeTickPct, sizePresetRadius, SIZE_PRESETS,
} from "./massData.js";
import { readNumber, parseRoute, clamp } from "./physics.js";
import { R_EARTH, R_SUN, M_SUN_KG } from "./constants.js";
import { num, sig, sci } from "./format.js";
import { length, duration, quantity, times } from "./units.js";
import { TQ } from "./i18n.js";
import {
  Certainty, Card, Refs, Why, Slider, Ticks, TourHead, ShareRow, NextLinks, useHashSync, sub,
} from "./shared.jsx";

// Último estado del deslizador del laboratorio (no la masa personal: esa no se guarda).
const store = { logM: null, orbit: null, pair: null, sizeOn: false, logR: null };
const STEPS = 4;

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
// Longitud: por debajo de 1 mm se da en notación científica (un asteroide de 10¹⁵ kg tiene r_s ≈ 10⁻¹² m).
const lengthFine = (m, lang) => (m < 1e-3 ? `${sci(m, lang, 2)} m` : length(m, lang));
// Masa corta de la tabla: M⊕, MJ o M☉ según el tamaño (el mismo criterio que massHuman).
function massShort(kg, lang) {
  if (kg < 0.1 * MJ_KG) return `${sig(kg / M_EARTH_KG, lang, 3)} M⊕`;
  if (kg < 0.075 * M_SUN_KG) return `${sig(kg / MJ_KG, lang, 3)} MJ`;
  return `${sig(kg / M_SUN_KG, lang, 3)} M☉`;
}
// Cuánto pesa una cucharadita (5 mL) de material con la densidad rho.
function teaspoonText(rho, SZ, lang) {
  const kg = teaspoonKg(rho);
  let v, u;
  if (kg < 1) { const g = kg * 1000; v = g < 0.01 ? sci(g, lang, 2) : sig(g, lang, 2); u = "g"; }
  else if (kg < 1000) { v = sig(kg, lang, 2); u = "kg"; }
  else { v = times(kg / 1000, lang); u = "t"; }
  return `${v} ${SZ.units[u][v === "1" ? 0 : 1]}`;
}
// «Casi como la Tierra», «3 veces el de la Tierra»…: el texto de un radio frente al terrestre.
function earthVs(R, lang, L) {
  const k = R / R_EARTH;
  if (Math.abs(Math.log10(k)) < 0.02) return L.size.nearEarth;
  return L.radiusVs(k < 0.001 ? sci(k, lang, 2) : ratioTxt(k, lang), k >= 1);
}
// ¿El cuerpo es tan pequeño frente a su referencia que se dibuja como un punto?
const isDot = (R) => { const ref = artRef(R); return R * (ART_MAX / Math.max(R, ref.R)) < 3; };

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
  } else if (kind === "blackhole") {
    art = (<g>
      <defs><radialGradient id={`h${uid}`}><stop offset="0.55" stopColor="#FF9A5C" stopOpacity="0.5" /><stop offset="1" stopColor="#FF9A5C" stopOpacity="0" /></radialGradient></defs>
      <circle cx={cx} cy={cy} r={Math.min(78, px * 1.6 + 4)} fill={`url(#h${uid})`} />
      <circle cx={cx} cy={cy} r={px} fill="#000" stroke="#FF9A5C" strokeWidth="1.8" />
    </g>);
  } else if (kind === "neutron" || kind === "whitedwarf") {
    const col = kind === "neutron" ? "#7FB2FF" : "#CFE0FF";
    art = (<g>
      <defs>
        <radialGradient id={`h${uid}`}><stop offset="0.5" stopColor={col} stopOpacity="0.6" /><stop offset="1" stopColor={col} stopOpacity="0" /></radialGradient>
        <radialGradient id={`g${uid}`} cx="42%" cy="38%" r="70%"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor={col} /></radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={Math.min(78, px * 1.7 + 4)} fill={`url(#h${uid})`} />
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
      <p className="q-mass__step">{T.stepLabel(1, STEPS)}</p>
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

// ── Paso 2: más masa no siempre es más grande ───────────────────────────────
// Dos cuerpos reales a escala entre sí (si uno es muy pequeño, se dibuja como un punto con un anillo).
function PairArt({ items, lang, aria }) {
  const uid = useId().replace(/:/g, "");
  const [a, b] = items;
  const MAXP = 58, gap = 44, cy = 68;
  const scale = MAXP / Math.max(a.R, b.R);
  const px = (e) => Math.max(2.5, e.R * scale);
  const pa = px(a), pb = px(b);
  const x0 = (300 - (2 * pa + 2 * pb + gap)) / 2;
  const xs = [x0 + pa, x0 + 2 * pa + gap + pb];
  return (
    <svg className="q-mass__art q-mass__pair" viewBox="0 0 300 172" role="img" aria-label={aria}>
      <g aria-hidden="true">
        {items.map((e, i) => {
          const p = i ? pb : pa, x = xs[i], dot = e.R * scale < 3.2;
          const [c0, c1] = e.colors;
          return (
            <g key={e.id}>
              <defs><radialGradient id={`p${i}${uid}`} cx="36%" cy="30%" r="80%"><stop offset="0" stopColor={c0} /><stop offset="1" stopColor={c1} /></radialGradient></defs>
              {e.id === "bh10"
                ? (<><circle cx={x} cy={cy} r={p * 1.35 + 2} fill="#FF9A5C" fillOpacity="0.18" /><circle cx={x} cy={cy} r={p} fill="#000" stroke="#FF9A5C" strokeWidth="1.8" /></>)
                : (<circle cx={x} cy={cy} r={p} fill={`url(#p${i}${uid})`} stroke={e.approx ? "#fff" : "none"} strokeOpacity="0.8" strokeWidth="1.2" strokeDasharray={e.approx ? "4 3" : undefined} />)}
              {dot && <circle cx={x} cy={cy} r={10} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.2" strokeDasharray="2.5 2.5" />}
              <text x={x} y="150" textAnchor="middle" className="q-plot__label">{EXAMPLE_SHORT[e.id][lang]}</text>
              <text x={x} y="164" textAnchor="middle" className="q-plot__label">{e.approx ? "≈ " : ""}{lengthFine(e.R, lang)}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// Frase «X tiene k veces la masa de Y, pero un radio…» (o, con la ciudad, que no tiene masa, el ancho).
function cmpSentence(a, b, lang, B) {
  if (a.mass && b.mass) {
    const k = b.mass / a.mass, r = b.R / a.R;
    let rp, but = true;
    if (r >= 1.1) { rp = B.radBigger(times(r, lang)); but = false; }
    else if (r > 0.9) rp = B.radSame;
    else if (r > 0.1) rp = B.radSmallish(sig(r, lang, 2));
    else rp = B.radSmaller(times(1 / r, lang));
    return B.cmpMass(cap(b.the[lang]), a.the[lang], times(k, lang), (but ? B.cmpRadiusBut : B.cmpRadiusAnd)(rp));
  }
  return B.cmpWidth(cap(b.the[lang]), a.the[lang], sig(b.R / a.R, lang, 2));
}
const densityVsTxt = (rho, lang, B) => (rho >= 1000 ? B.densityVs(times(rho / 1000, lang)) : B.densityVsLess(fmt3(rho / 1000, lang)));

function BigStep({ lang, t, T }) {
  const B = T.big;
  const [pairId, setPairId] = useState(() => store.pair || COMPARES[0].id);
  useEffect(() => { store.pair = pairId; }, [pairId]);
  const pair = COMPARES.find(c => c.id === pairId) || COMPARES[0];
  const items = pair.items.map(example);
  const [a, b] = items;
  const P = B.pairs[pair.id];
  const big = a.R >= b.R ? a : b, small = big === a ? b : a;
  const dotNote = isDotPair(small, big) ? B.dotOne(cap(small.the[lang]), times(big.R / small.R, lang), big.the[lang]) : "";
  const aria = B.art(a.the[lang], lengthFine(a.R, lang), b.the[lang], lengthFine(b.R, lang), dotNote);
  return (
    <section className="q-mass__sec" aria-labelledby="q-mass-big">
      <p className="q-mass__step">{T.stepLabel(2, STEPS)}</p>
      <h3 id="q-mass-big" className="q-h3">{B.title}</h3>
      <p className="q-model__lead">{B.stepLead}</p>

      <div className="q-mass__panel">
        <p className="q-presets__label" id="q-mass-pairs">{B.chooseLabel}</p>
        <div className="q-chips q-chips--wrap" role="group" aria-labelledby="q-mass-pairs">
          {COMPARES.map(c => (
            <button key={c.id} type="button" data-preset={`big_${c.id}`} className={`q-preset ${c.id === pair.id ? "is-on" : ""}`} aria-pressed={c.id === pair.id} onClick={() => setPairId(c.id)}>{B.tabs[c.id]}</button>
          ))}
        </div>
        <h4 className="q-h4 q-mass__h4 q-mass__pairtitle" role="status" aria-live="polite" aria-atomic="true">{P.title}</h4>
        <PairArt items={items} lang={lang} aria={aria} />
        {dotNote && <p className="q-fine">{dotNote}</p>}
        <p className="q-mass__blurb">{P.text}</p>
        <p className="q-mass__blurb q-mass__cmpline"><strong>{cmpSentence(a, b, lang, B)}</strong></p>
        <p className="q-mass__tags"><Certainty level={pair.level} t={t} short note={P.note} /></p>
        <table className="q-table q-mass__cmp">
          <caption className="q-sr">{B.art(a.the[lang], lengthFine(a.R, lang), b.the[lang], lengthFine(b.R, lang), "")}</caption>
          <thead><tr><th scope="col"><span className="q-sr">{B.colObject}</span></th>{items.map(e => <th key={e.id} scope="col">{EXAMPLE_SHORT[e.id][lang]}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">{B.factMass}</th>{items.map(e => <td key={e.id}>{e.mass ? massShort(e.mass, lang) : "—"}</td>)}</tr>
            <tr><th scope="row">{B.factRadius}</th>{items.map(e => (
              <td key={e.id}>{e.approx ? "≈ " : ""}{lengthFine(e.R, lang)}{e.horizon && <span className="q-mass__sub">{B.factHorizon}</span>}{e.approx && <span className="q-mass__sub">{B.factApprox}</span>}</td>
            ))}</tr>
            <tr><th scope="row">{B.factDensity}</th>{items.map(e => { const d = exampleDensity(e); return (
              <td key={e.id}>{d ? <>{quantity(d, lang)} kg/m³<span className="q-mass__sub">{densityVsTxt(d, lang, B)}</span></> : "—"}</td>
            ); })}</tr>
          </tbody>
        </table>
        <p className="q-fine">{B.scaleNote}</p>
        <Refs ids={pair.refs} refs={MASS_REFS} lang={lang} t={t} />
      </div>

      <h4 className="q-h4 q-mass__h4 q-mass__h4--gap">{B.tableTitle}</h4>
      <table className="q-table q-mass__order">
        <caption className="q-sr">{B.tableCaption}</caption>
        <thead><tr><th scope="col">{B.colObject}</th><th scope="col">{B.colMass}</th><th scope="col">{B.colRadius}</th><th scope="col">{B.colDensity}</th></tr></thead>
        <tbody>
          {TABLE_ORDER.map(id => {
            const e = example(id), d = exampleDensity(e);
            return (
              <tr key={id}>
                <th scope="row">{EXAMPLE_SHORT[id][lang]}</th>
                <td>{massShort(e.mass, lang)}</td>
                <td>{lengthFine(e.R, lang)}</td>
                <td>{quantity(d, lang)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="q-fine">{B.tableNote}</p>

      <Why summary={B.wdTitle}>
        <p>{B.wdLead}</p>
        <table className="q-table q-mass__wd">
          <caption className="q-sr">{B.wdCaption}</caption>
          <thead><tr><th scope="col">{B.wdName}</th><th scope="col">{B.colMass}</th><th scope="col">{B.colRadius}</th></tr></thead>
          <tbody>
            {WD_MEASURED.map(w => (
              <tr key={w.name} className={w.dynamical ? "is-you" : ""}>
                <th scope="row">{w.name === "Sirius B" ? EXAMPLE_SHORT.sirius[lang] : w.name}</th>
                <td>{sig(w.mass, lang, 3)} ± {sig(w.dm, lang, 2)} M☉</td>
                <td>{sig(w.R, lang, 3)} R☉<span className="q-mass__sub">{lang === "es" ? `${sig((w.R * R_SUN) / R_EARTH, lang, 2)} de la Tierra` : `${sig((w.R * R_SUN) / R_EARTH, lang, 2)} of Earth’s`}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="q-fine">{B.wdNote}</p>
        <Refs ids={["joyce2018", "bond2017", "nasaWD"]} refs={MASS_REFS} lang={lang} t={t} />
      </Why>

      <h4 className="q-h4 q-mass__h4 q-mass__h4--gap">{B.sumTitle}</h4>
      <p className="q-mass__blurb">{B.sumText}</p>
      <Why summary={B.whySummary}>
        <ul className="q-formulas">{B.whyBody.map(f => <li key={f} className="q-formula">{sub(f)}</li>)}</ul>
        <p>{B.whyFine}</p>
      </Why>
    </section>
  );
}
// ¿El menor de los dos cuerpos se dibuja como un punto? (misma regla que PairArt)
function isDotPair(small, big) { return small.R * (58 / big.R) < 3.2; }

// ── Paso 3: laboratorio ─────────────────────────────────────────────────────
function Lab({ lang, t, T, personKg, logM, setLogM, sizeOn, setSizeOn, logR, setLogR }) {
  const L = T.lab, SZ = L.size;
  const M = logToMass(logM);
  const Rm = radiusM(M);
  const sl = sizeSlider(M);
  // En el modo «elegir tamaño», el radio lo pone la persona (siempre dentro del rango).
  const logRc = sizeOn ? clampLogR(logR == null ? Math.log10(Rm) : logR, M) : null;
  const R = sizeOn ? Math.pow(10, logRc) : Rm;
  const band = sizeOn ? densityBand(M, R) : null;
  const isBH = band === "bh";
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

  // Modo «elegir tamaño»: marcas del deslizador de radio (se omiten las que quedan fuera o muy juntas).
  const sizeMarks = [];
  if (sizeOn) {
    const cand = [
      { label: "r_s", pct: 0 },
      { label: SZ.tickCity, pct: sizeTickPct(5000, M) },
      { label: SZ.tickEarth, pct: sizeTickPct(R_EARTH, M) },
      { label: SZ.tickSun, pct: sizeTickPct(R_SUN, M) },
      { label: SZ.tickSuper, pct: 100 },
    ];
    for (const c of cand) {
      if (c.pct < 0 || c.pct > 100) continue;
      while (sizeMarks.length > 1 && c.pct - sizeMarks[sizeMarks.length - 1].pct < 16) sizeMarks.pop();
      if (sizeMarks.length && c.pct - sizeMarks[sizeMarks.length - 1].pct < 16) continue;
      sizeMarks.push(c);
    }
  }
  const B_ = band ? SZ.bands[band] : null;
  const artKind = sizeOn ? ({ bh: "blackhole", ns: "neutron", gap: "neutron", wd: "whitedwarf" }[band] || kind) : kind;
  const artTeff = sizeOn && isStar && R > 5 * Rm ? 3500 : teff;
  const headName = sizeOn ? B_.name : K.name;
  const caveat = !sizeOn ? "" : band === "wd" && M < 0.1 * M_SUN_KG ? SZ.caveat.wdLow : (band === "wd" || band === "gap") && M > 1.4 * M_SUN_KG ? SZ.caveat.wdHigh
    : band === "ns" && M < 1 * M_SUN_KG ? SZ.caveat.nsLow : band === "ns" && M > 3 * M_SUN_KG ? SZ.caveat.nsHigh : "";
  const kR = R / Rm;
  const vsModel = Math.abs(Math.log10(kR)) < 0.02 ? SZ.vsSame
    : kR < 1 ? SZ.vsSmaller(times(1 / kR, lang), times(1 / (kR * kR), lang), times(1 / (kR * kR * kR), lang))
      : SZ.vsBigger(times(kR, lang), times(kR * kR, lang), times(kR * kR * kR, lang));
  const sizeVisible = `${lengthFine(R, lang)} · ${earthVs(R, lang, L)}`;
  const toggleSize = () => {
    if (!sizeOn && logR == null) setLogR(Math.log10(Rm));
    setSizeOn(!sizeOn);
  };
  const dotted = isDot(R);
  return (
    <section className="q-mass__sec" aria-labelledby="q-mass-lab">
      <p className="q-mass__step">{T.stepLabel(3, STEPS)}</p>
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

        <div className="q-mass__size">
          <button type="button" role="switch" aria-checked={sizeOn} data-size-switch className={`q-mass__switch ${sizeOn ? "is-on" : ""}`} onClick={toggleSize}>
            <span className="q-mass__knob" aria-hidden="true"><i /></span>
            <span className="q-mass__switchtxt"><strong>{SZ.toggle}</strong><span>{SZ.toggleHint}</span></span>
          </button>
          {sizeOn && (
            <>
              <p className="q-fine">{SZ.massFixed(massTxt)}</p>
              <Slider label={SZ.slider} hint={SZ.sliderHint} value={logRc} min={sl.min} max={sl.max} step={sl.step}
                onChange={setLogR} valueText={sizeVisible} ariaText={SZ.sliderValue(lengthFine(R, lang), earthVs(R, lang, L), B_.name)}>
                <Ticks marks={sizeMarks} />
              </Slider>
              <div className="q-presets q-presets--chips" role="group" aria-labelledby="q-mass-sizepresets">
                <p id="q-mass-sizepresets" className="q-presets__label">{SZ.presetsLabel}</p>
                <div className="q-chips">
                  {SIZE_PRESETS.map(id => (
                    <button key={id} type="button" data-size={id} className={`q-preset ${Math.abs(Math.log10(sizePresetRadius(id, M)) - logRc) < 0.006 ? "is-on" : ""}`}
                      aria-pressed={Math.abs(Math.log10(sizePresetRadius(id, M)) - logRc) < 0.006} onClick={() => setLogR(Math.log10(sizePresetRadius(id, M)))}>{SZ.presets[id]}</button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="q-mass__panel q-mass__panel--out">
        <p className="q-result__label">{sizeOn ? SZ.bandLabel : L.kindLabel}</p>
        <p className="q-mass__kind" role="status" aria-live="polite" aria-atomic="true">
          <span className="q-mass__kindname">{headName}</span>
          {!sizeOn && <span className="q-mass__kindwhat">{K.what}</span>}
        </p>
        <BodyArt kind={artKind} R={R} teff={artTeff} lang={lang} aria={L.artAria(headName, lengthFine(R, lang), earthVs(R, lang, L))} />
        {sizeOn && dotted && <p className="q-fine">{L.dotNote}</p>}
        <p className="q-mass__blurb">{sizeOn ? B_.note : K.blurb}</p>
        {sizeOn && <p className="q-mass__blurb">{SZ.teaspoon(teaspoonText(rho, SZ, lang))}</p>}
        {caveat && <p className="q-fine">{caveat}</p>}
        {sizeOn && <p className="q-mass__blurb q-mass__vs">{vsModel}</p>}
        <p className="q-mass__tags">
          {sizeOn
            ? <Certainty level="estimated" t={t} short note={SZ.tag} />
            : (<>
              <Certainty level="estimated" t={t} short note={L.tagThreshold} />
              <Certainty level={certainty} t={t} short note={certainty === "measured" ? L.measuredTag : L.estimatedTag} />
            </>)}
        </p>
        {!sizeOn && <p className="q-fine">{L.approx}</p>}
        {!sizeOn && <p className="q-fine">{L.radiusNote}</p>}
        <p className="q-fine">{L.artNote}</p>
        {!sizeOn && logM > MASS_SLIDER.max - 0.5 && <p className="q-fine">{L.limitNote}</p>}

        <dl className="q-dist__list q-mass__facts">
          <div><dt>{L.radius}</dt><dd>{lengthFine(R, lang)}<span className="q-bh__cmp">{radiusTxtVs(rRatio, lang, L)}</span></dd></div>
          <div><dt>{L.gravity}</dt><dd>{isBH ? SZ.gravityBH : <>{fmt3(g, lang)} m/s²<span className="q-bh__cmp">{L.gravityVs(ratioTxt(ratioG, lang))}</span></>}</dd></div>
          <div><dt>{L.escape}</dt><dd>{isBH ? SZ.escapeBH : <>{fmtSpeed(vEsc, lang)}<span className="q-bh__cmp">{L.escapeVs(ratioTxt(vEsc / 11186, lang))}</span></>}</dd></div>
          <div><dt>{L.density}</dt><dd>{quantity(rho, lang)} kg/m³<span className="q-bh__cmp">{L.densityVs}</span></dd></div>
          {!sizeOn && isStar && teff && <div><dt>{L.temp}</dt><dd>{num(Math.round(teff / 10) * 10, lang)} K<span className="q-bh__cmp">{L.tempNote}</span></dd></div>}
        </dl>
        {!sizeOn && (isGiantOrStar || isStar) && <p className="q-fine">{isStar ? L.surfaceStar : L.surfaceGiant}</p>}
        {sizeOn && !isBH && isRelativistic(M, R) && <p className="q-fine">{SZ.relNote}</p>}
      </div>

      <div className="q-mass__panel q-mass__panel--here">
        <h4 className="q-h4 q-mass__h4">{L.hereTitle}</h4>
        {isBH ? <p className="q-mass__blurb">{SZ.hereBH}</p> : (
          <>
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
            {(sizeOn ? !["rock", "lead"].includes(band) : (isStar || isGiantOrStar)) && <p className="q-fine">{L.hereNoSurface}</p>}
          </>
        )}
      </div>

      <div className="q-mass__panel q-mass__panel--bh">
        <h4 className="q-h4 q-mass__h4">{L.bhTitle}</h4>
        <p className="q-fine">{sub(L.bhLead)}</p>
        <p className="q-mass__bh" role="status" aria-live="polite" aria-atomic="true">
          <span className="q-mono">{sub("r_s")} = </span><strong>{lengthFine(rs, lang)}</strong>
        </p>
        <p className="q-mass__blurb">{bhText}</p>
        {obj.approx && <p className="q-fine">{L.bhApprox}</p>}
        <p className="q-fine">{L.bhNote}</p>
      </div>

      <Why summary={L.whySummary}>
        <ul className="q-formulas">{L.whyBody.map(f => <li key={f} className="q-formula">{sub(f)}</li>)}</ul>
        <p>{L.whyFine}</p>
        <Refs ids={["nasaFacts", "ceres", "mamajek", "hatzes", "codata", "iau2015", ...(sizeOn ? ["buchdahl", "lead"] : [])]} refs={MASS_REFS} lang={lang} t={t} />
      </Why>
    </section>
  );
}
function radiusTxtVs(r, lang, L) { return L.radiusVs(r < 0.001 ? sci(r, lang, 2) : ratioTxt(r, lang), r >= 1); }

// ── Paso 4: órbita ──────────────────────────────────────────────────────────
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
      <p className="q-mass__step">{T.stepLabel(4, STEPS)}</p>
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
  const [sizeOn, setSizeOn] = useState(() => store.sizeOn);       // «Elegir yo el tamaño» (apagado por defecto)
  const [logR, setLogR] = useState(() => store.logR);             // log10 del radio elegido (m); null hasta que se enciende
  useEffect(() => { store.logM = logM; }, [logM]);
  useEffect(() => { store.sizeOn = sizeOn; store.logR = logR; }, [sizeOn, logR]);

  const hash = `#${prefix(lang)}?q=mass&m=${Number(logM.toFixed(3))}`;
  useHashSync(hash);

  return (
    <section className="q q-tour q-mass" aria-labelledby="q-title">
      <TourHead t={t} title={T.title} lead={T.lead} indexHref={indexHref} />

      <WeightStep lang={lang} t={t} T={T} personKg={personKg} setPersonKg={setPersonKg} />
      <BigStep lang={lang} t={t} T={T} />
      <Lab lang={lang} t={t} T={T} personKg={personKg} logM={logM} setLogM={setLogM}
        sizeOn={sizeOn} setSizeOn={setSizeOn} logR={logR} setLogR={setLogR} />
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
