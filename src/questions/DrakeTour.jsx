// DrakeTour.jsx — recorrido "¿Estamos solos?" de la pestaña "Preguntas"
// (ecuación de Drake + Fermi, Gran Filtro y Kardashov).
// Se carga con React.lazy desde Questions.jsx (el índice de recorridos). Los números salen de drakeData.js y
// la aritmética de drakeMath.js: aquí solo hay interfaz.
import { useState, useEffect, useRef, useMemo, useId, useCallback } from "react";
import { fetchJson, isAbort } from "../net.js";
import {
  FACTORS, PRESETS, CUSTOM_START, DEFAULT_VALUES, MEASURED_KEYS, UNKNOWN_KEYS, REFS,
  RADIO, FILTER_STEPS, WORLD_ENERGY, KARDASHEV_SLIDER, KARDASHEV_MARKS, NEXT_LINKS,
} from "./drakeData.js";
import {
  drakeN, sliderSteps, valueToPos, posToValue, neighborDistanceLy, roundTripYears, groupSpan,
  kardashev, ejPerYearToWatts, radioBubbleRadiusLy, encodeDrake, decodeDrake, sameValues, GALAXY, clamp,
} from "./drakeMath.js";
import { num, sig, sci, big, years, lightYears, factorValue, factorShort, headline } from "./format.js";
import { TQ } from "./i18n.js";
import { Certainty, Chevron, TourHead } from "./shared.jsx";

const API = import.meta.env.VITE_API_URL || "";
const EXO_TIMEOUT_MS = 45000;                       // igual que la capa del Cielo
const US_LOG = Math.log10(ejPerYearToWatts(WORLD_ENERGY.ej));
const HASH_RE = /^#(preguntas|questions)\b/;

// El estado vive fuera del componente: al cambiar de pestaña el panel se
// desmonta, y así al volver todo sigue como estaba (también el catálogo).
const store = { values: null, custom: null, logP: null, exo: null };

function readHash() {
  try {
    const h = window.location.hash || "";
    if (!HASH_RE.test(h)) return {};
    const qi = h.indexOf("?");
    if (qi < 0) return {};
    const p = new URLSearchParams(h.slice(qi + 1));
    const values = decodeDrake(p.get("drake"), FACTORS);
    const k = Number(p.get("kp"));
    return { values, logP: p.get("kp") && Number.isFinite(k) ? clamp(k, KARDASHEV_SLIDER.minLog, KARDASHEV_SLIDER.maxLog) : null };
  } catch { return {}; }
}

// ─── Piezas pequeñas ─────────────────────────────────────────────────────────

function Sym({ f }) { return <span className="q-sym" aria-hidden="true">{f.symbol}{f.sub && <sub>{f.sub}</sub>}</span>; }

function RefList({ ids, lang, t }) {
  if (!ids || !ids.length) return null;
  return (
    <ul className="q-refs" aria-label={t.sourcesLabel}>
      {ids.map(id => {
        const r = REFS[id];
        return (
          <li key={id}>
            <a href={r.url} target="_blank" rel="noopener noreferrer">
              {(lang === "en" && r.citeEn) || r.cite}<span className="q-sr"> ({t.external})</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Ecuación en vivo ────────────────────────────────────────────────────────
function Equation({ values, lang, t }) {
  return (
    <div className="q-eq" role="img" aria-label={`${t.eqAria}: N = ${FACTORS.map(f => `${t.symbolSay[f.key]} ${factorShort(values[f.key], lang)}`).join(" × ")}`}>
      <span className="q-eq__n" aria-hidden="true"><span className="q-eq__sym">N</span></span>
      <span className="q-eq__op" aria-hidden="true">=</span>
      {FACTORS.map((f, i) => (
        <span key={f.key} className="q-eq__group" aria-hidden="true">
          {i > 0 && <span className="q-eq__op">·</span>}
          <span className={`q-eq__term q-eq__term--${f.certainty}`}>
            <span className="q-eq__sym">{f.symbol}{f.sub && <sub>{f.sub}</sub>}</span>
            <span className="q-eq__val">{factorShort(values[f.key], lang)}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── Un factor ───────────────────────────────────────────────────────────────
function Factor({ f, value, onChange, lang, t }) {
  const id = useId();
  const steps = sliderSteps(f.min, f.max);
  const pos = valueToPos(value, f.min, f.max);
  const human = factorValue(f, value, lang);
  return (
    <li className={`q-factor q-factor--${f.certainty}`}>
      <div className="q-factor__head">
        <Sym f={f} />
        <label className="q-factor__name" htmlFor={id}>
          {f.name[lang]}
          <span className="q-factor__what">{f.what[lang]}</span>
        </label>
        <output className="q-factor__value" htmlFor={id}>{human}</output>
      </div>
      <input id={id} className="q-range" type="range" min={0} max={steps} step={1} value={pos}
        style={{ "--fill": `${(pos / steps) * 100}%` }}
        aria-label={t.sliderAria(f.name[lang], t.symbolSay[f.key])}
        aria-valuetext={human}
        onChange={e => onChange(f.key, posToValue(Number(e.target.value), f.min, f.max))} />
      <div className="q-factor__foot">
        <Certainty level={f.certainty} t={t} />
        <details className="q-why">
          <summary>{t.whySummary}<Chevron /></summary>
          <div className="q-why__body">
            <p>{f.why[lang]}</p>
            <RefList ids={f.refs} lang={lang} t={t} />
          </div>
        </details>
      </div>
    </li>
  );
}

// ─── ¿De dónde viene la variación? ───────────────────────────────────────────
function Spread({ values, N, lang, t }) {
  const m = useMemo(() => groupSpan(FACTORS, values, MEASURED_KEYS), [values]);
  const u = useMemo(() => groupSpan(FACTORS, values, UNKNOWN_KEYS), [values]);
  // eje logarítmico común: de lo más bajo a lo más alto que alcanza cualquiera
  const lo = Math.log10(Math.min(m.nMin, u.nMin)), hi = Math.log10(Math.max(m.nMax, u.nMax));
  const x = (n) => `${((Math.log10(n) - lo) / (hi - lo)) * 100}%`;
  const w = (g) => `${Math.max(1.2, ((Math.log10(g.nMax) - Math.log10(g.nMin)) / (hi - lo)) * 100)}%`;
  const fmtN = (n) => (n < 0.01 || n >= 1e15 ? sci(n, lang, 1) : n < 100 ? sig(n, lang) : big(n, lang));
  const om = Math.round(m.orders), ou = Math.round(u.orders);
  const verdictKey = N < 1e-6 ? "tiny" : N < 1 ? "none" : N < 1.5 ? "one" : N < 1000 ? "few" : N < 1e6 ? "many" : "crowd";
  const Row = ({ g, cls, label, orders }) => (
    <div className={`q-spread__row q-spread__row--${cls}`}>
      <p className="q-spread__label"><strong>{label}</strong> <span>{t.spreadOrders(orders)}</span></p>
      <div className="q-spread__track" aria-hidden="true">
        <span className="q-spread__bar" style={{ left: x(g.nMin), width: w(g) }} />
        <span className="q-spread__now" style={{ left: x(N) }} />
      </div>
      <p className="q-spread__range">{t.spreadRange(fmtN(g.nMin), fmtN(g.nMax))}</p>
    </div>
  );
  return (
    <section className="q-spread" aria-labelledby="q-spread-title">
      <h3 id="q-spread-title" className="q-h3">{t.spreadTitle}</h3>
      <p className="q-spread__lead">{t.spreadLead}</p>
      <div role="img" aria-label={t.spreadAria(om, ou)}>
        <Row g={m} cls="measured" label={t.spreadMeasured} orders={om} />
        <Row g={u} cls="unknown" label={t.spreadUnknown} orders={ou} />
      </div>
      <p className="q-verdict" aria-live="polite">{t.verdict[verdictKey]}</p>
      <p className="q-fine">{t.spreadFine} {t.honest}</p>
    </section>
  );
}

// ─── Contexto: el catálogo real de exoplanetas ───────────────────────────────
function ExoContext({ lang, t, onSeeSky }) {
  const [state, setState] = useState(store.exo ? { status: "ok", data: store.exo } : { status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  // No se pide el catálogo (pesa cientos de KB) hasta que la tarjeta se acerca a la vista
  useEffect(() => {
    if (store.exo) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!near || store.exo) return;
    const ctrl = new AbortController();
    setState({ status: "loading" });
    fetchJson(`${API}/api/exoplanets`, { signal: ctrl.signal, timeout: EXO_TIMEOUT_MS })
      .then(d => {
        const count = Number(d && d.count), habitable = Number(d && d.habitable);
        if (!Number.isFinite(count) || !Number.isFinite(habitable)) throw new Error("bad payload");
        store.exo = { count, habitable };
        setState({ status: "ok", data: store.exo });
      })
      .catch(e => { if (!isAbort(e)) setState({ status: "error" }); });
    return () => ctrl.abort();
  }, [near, attempt]);

  const ok = state.status === "ok";
  const parts = ok ? t.exoText(num(state.data.count, lang), num(state.data.habitable, lang)) : null;
  return (
    <section ref={ref} className="q-exo" aria-labelledby="q-exo-title">
      <h3 id="q-exo-title" className="q-h3">{t.exoTitle}</h3>
      {ok && (<>
        <p className="q-exo__text">{parts[0]}<strong className="q-exo__num">{parts[1]}</strong>{parts[2]}<strong className="q-exo__num">{parts[3]}</strong>{parts[4]}</p>
        <p className="q-fine">{t.exoRule} {t.exoSource}</p>
      </>)}
      {(state.status === "loading" || state.status === "idle") && <p className="q-exo__status" role="status">{t.exoLoading}</p>}
      {state.status === "error" && (
        <p className="q-exo__status" role="status">
          {t.exoError}{" "}
          <button type="button" className="q-link" onClick={() => setAttempt(n => n + 1)}>{t.exoRetry}</button>
        </p>
      )}
      <p className="q-exo__bias">{t.exoBias}</p>
      <button type="button" className="btn btn--ghost q-exo__btn" onClick={onSeeSky}>{t.exoSee}</button>
    </section>
  );
}

// ─── Tarjetas del hilo ───────────────────────────────────────────────────────
function Card({ id, title, teaser, level, levelNote, t, children }) {
  return (
    <details className="q-card" id={id}>
      <summary className="q-card__summary">
        <span className="q-card__text">
          <span className="q-card__title">{title}</span>
          <span className="q-card__teaser">{teaser}</span>
          <Certainty level={level} t={t} note={levelNote} />
        </span>
        <Chevron />
      </summary>
      <div className="q-card__body">{children}</div>
    </details>
  );
}

function FermiCard({ N, lang, t }) {
  const f = t.fermi;
  const year = new Date().getFullYear();
  const r = radioBubbleRadiusLy(year, RADIO.sinceYear);
  const pct = sig((2 * r / GALAXY.diameterLy) * 100, lang);
  // Vista desde arriba. 300 unidades = 100.000 años luz → 1 unidad = 333 años luz.
  const S = 300 / GALAXY.diameterLy, C = 160, sunX = C + RADIO.sunToCenterLy * S, sunY = C;
  return (
    <Card id="q-fermi" title={f.title} teaser={f.teaser} level={f.tag} t={t}>
      <p>{f.p1}</p>
      <p>{f.p2} <strong className="q-mono">{f.withN(N < 0.01 ? sci(N, lang, 1) : N < 100 ? sig(N, lang) : big(N, lang))}</strong>.</p>
      <RefList ids={["jones1985"]} lang={lang} t={t} />

      <h4 className="q-h4">{f.bubbleTitle}</h4>
      <p>{f.bubbleText(num(r, lang), RADIO.sinceYear, pct)}</p>
      <figure className="q-galaxy">
        <svg viewBox="0 0 320 320" role="img" aria-label={f.bubbleAria(num(r, lang))}>
          <defs>
            <radialGradient id="q-gal-g">
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.08" stopColor="#C4B5FD" stopOpacity="0.38" />
              <stop offset="0.45" stopColor="#7C3AED" stopOpacity="0.16" /><stop offset="1" stopColor="#60A5FA" stopOpacity="0.05" />
            </radialGradient>
          </defs>
          <circle cx={C} cy={C} r="150" fill="url(#q-gal-g)" stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeDasharray="2 4" />
          <circle cx={C} cy={C} r="2" fill="#fff" opacity="0.9" />
          <text x={C} y={C + 16} textAnchor="middle" className="q-galaxy__lbl">{f.centerLabel}</text>
          {/* anillo indicador (NO es la burbuja) y la burbuja a escala real */}
          <circle cx={sunX} cy={sunY} r="11" fill="none" stroke="#F2C46D" strokeWidth="1" strokeDasharray="3 3" opacity="0.9" />
          <circle cx={sunX} cy={sunY} r={r * S} fill="#F2C46D" />
          <text x={sunX} y={sunY - 17} textAnchor="middle" className="q-galaxy__lbl q-galaxy__lbl--us">{f.hereLabel}</text>
          {/* regla del diámetro */}
          <path d="M10 306H310M10 301v10M310 301v10" stroke="rgba(255,255,255,0.5)" strokeWidth="1" fill="none" />
        </svg>
        <figcaption><span className="q-galaxy__rule">{f.galaxyLabel}</span>{f.bubbleCaption}</figcaption>
      </figure>
      <p className="q-fine">{f.bubbleFine(RADIO.sinceYear)}</p>
      <RefList ids={RADIO.refs} lang={lang} t={t} />
    </Card>
  );
}

function FilterCard({ lang, t }) {
  const f = t.filter;
  return (
    <Card id="q-filter" title={f.title} teaser={f.teaser} level={f.tag} t={t}>
      <p>{f.p1}</p>
      <ol className="q-ladder">
        {FILTER_STEPS.map((s, i) => (
          <li key={i} className={`q-ladder__step ${s.here ? "is-here" : ""} ${s.future ? "is-future" : ""}`}>
            <span className="q-ladder__n" aria-hidden="true">{i + 1}</span>
            <span className="q-ladder__text">{s[lang]}</span>
            {i === 6 && <span className="q-ladder__ask q-ladder__ask--behind"><strong>{f.behind}</strong> {f.behindNote}</span>}
            {s.here && <span className="q-ladder__ask q-ladder__ask--ahead"><strong>{f.ahead}</strong> {f.aheadNote}</span>}
          </li>
        ))}
      </ol>
      <p>{f.p2}</p>
      <RefList ids={["hanson1998"]} lang={lang} t={t} />
    </Card>
  );
}

function KardashevCard({ logP, setLogP, lang, t }) {
  const k = t.kard;
  const id = useId();
  const { minLog, maxLog, step } = KARDASHEV_SLIDER;
  const K = (logP - 6) / 10;
  const fmtK = (x) => num(x, lang, 2);
  const pText = sci(Math.pow(10, logP), lang);
  const marks = useMemo(() => [
    { id: "us", log: US_LOG, label: k.us(WORLD_ENERGY.year), us: true },
    ...KARDASHEV_MARKS.map(m => ({ id: m.id, log: Math.log10(m.watts), label: m.label[lang], note: m.note && m.note[lang], type: m.type })),
  ].sort((a, b) => a.log - b.log), [lang, k]);
  const pct = (l) => `${((l - minLog) / (maxLog - minLog)) * 100}%`;
  return (
    <Card id="q-kard" title={k.title} teaser={k.teaser} level={k.tag} levelNote={k.tagNote} t={t}>
      <p>{k.p1}</p>
      <p className="q-formula">{k.formula}</p>

      <div className="q-kard">
        <p className="q-kard__k"><span className="q-kard__klabel">{k.kLabel}</span><output htmlFor={id} className="q-kard__kval">K = {fmtK(K)}</output></p>
        <label className="q-kard__plabel" htmlFor={id}>{k.sliderLabel}: <span className="q-mono">{pText} W</span></label>
        <div className="q-kard__slider">
          <input id={id} className="q-range q-range--plain" type="range" min={minLog} max={maxLog} step={step} value={logP}
            style={{ "--fill": pct(logP) }}
            aria-valuetext={k.sliderText(pText, fmtK(K))}
            onChange={e => setLogP(Number(e.target.value))} />
          <div className="q-kard__ticks" aria-hidden="true">
            {marks.filter(m => m.type || m.us).map(m => (
              <span key={m.id} className={`q-kard__tick ${m.us ? "is-us" : ""}`} style={{ left: pct(m.log) }}>
                <i />{m.us ? (lang === "es" ? "hoy" : "today") : m.label.replace(/^(Tipo|Type) /, "")}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p>{k.usNote({ year: WORLD_ENERGY.year, val: num(WORLD_ENERGY.ej, lang) }, sci(Math.pow(10, US_LOG), lang), fmtK(kardashev(Math.pow(10, US_LOG))))}</p>

      <h4 className="q-h4">{k.marksTitle}</h4>
      <ul className="q-marks">
        {marks.map(m => (
          <li key={m.id}>
            <button type="button" className={`q-mark ${Math.abs(logP - m.log) < 0.03 ? "is-on" : ""} ${m.type ? "q-mark--type" : ""}`}
              aria-label={k.set(m.label)} aria-pressed={Math.abs(logP - m.log) < 0.03}
              onClick={() => setLogP(m.log)}>
              <span className="q-mark__label">{m.label}{m.note && <span className="q-mark__note">{m.note}</span>}</span>
              <span className="q-mark__num"><span>{sci(Math.pow(10, m.log), lang)} W</span><strong>K {fmtK((m.log - 6) / 10)}</strong></span>
            </button>
          </li>
        ))}
      </ul>
      <p className="q-fine">{k.fine}</p>
      <RefList ids={["kardashevWiki", "ei2025", "iau2015"]} lang={lang} t={t} />
    </Card>
  );
}

// ─── Pestaña ─────────────────────────────────────────────────────────────────
export default function DrakeTour({ lang = "es", onSeeSky, indexHref }) {
  const t = TQ[lang] || TQ.es;
  const fromHash = useMemo(readHash, []);
  const [values, setValues] = useState(() => fromHash.values || store.values || DEFAULT_VALUES);
  const [logP, setLogP] = useState(() => fromHash.logP ?? store.logP ?? US_LOG);
  const [copied, setCopied] = useState("");
  const resultRef = useRef(null);
  const gridRef = useRef(null);
  const [showBar, setShowBar] = useState(false);

  const preset = PRESETS.find(p => sameValues(p.values, values));
  const presetId = preset ? preset.id : "custom";
  // si el enlace trae valores que no son un preajuste, son "mi apuesta"
  useEffect(() => { if (!preset && !store.custom) store.custom = values; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const N = drakeN(values);
  const h = headline(N, lang);
  const d = neighborDistanceLy(N);

  useEffect(() => { store.values = values; store.logP = logP; }, [values, logP]);

  // Estado → hash (para compartir). Con retardo: Safari limita replaceState.
  const hash = `#${lang === "es" ? "preguntas" : "questions"}?q=drake&drake=${encodeDrake(values)}${Math.abs(logP - US_LOG) > 1e-6 ? `&kp=${Number(logP.toFixed(2))}` : ""}`;
  useEffect(() => {
    const id = setTimeout(() => {
      try { if (window.location.hash !== hash) window.history.replaceState(null, "", hash); } catch { /* no-op */ }
    }, 200);
    return () => clearTimeout(id);
  }, [hash]);

  // Barra compacta con el resultado cuando el titular queda fuera de la vista
  // (solo mientras la calculadora sigue en pantalla: en las tarjetas ya no pinta nada)
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const res = resultRef.current, grid = gridRef.current;
      if (!res || !grid) return;
      setShowBar(res.getBoundingClientRect().bottom < 110 && grid.getBoundingClientRect().bottom > 220);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    check();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const setFactor = useCallback((key, v) => {
    setValues(prev => { const next = { ...prev, [key]: v }; store.custom = next; return next; });
  }, []);
  const pick = (id) => {
    if (id === "custom") { setValues(store.custom || CUSTOM_START); return; }
    setValues(PRESETS.find(p => p.id === id).values);
  };
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
    try { window.history.replaceState(null, "", hash); } catch { /* no-op */ }
    try { await navigator.clipboard.writeText(url); setCopied("ok"); }
    catch { setCopied("fail"); }
  };
  useEffect(() => { if (!copied) return; const id = setTimeout(() => setCopied(""), 4000); return () => clearTimeout(id); }, [copied]);

  const unit = h.kind === "none" ? t.civNone : h.kind === "one" ? t.civOne : t.civs(h.partitive);
  const presetNote = preset ? preset.note[lang] : t.customNote;

  return (
    <section className="q" aria-labelledby="q-title">
      <TourHead t={t} title={t.title} lead={t.lead} indexHref={indexHref} />

      <div className={`q-bar ${showBar ? "is-on" : ""}`} aria-hidden="true">
        <span className="q-bar__label">N ≈</span>
        <span className="q-bar__val">{h.big}</span>
        <span className="q-bar__unit">{h.kind === "some" ? t.civs(h.partitive) : ""}</span>
      </div>

      <div className="q-grid" ref={gridRef}>
        <div className="q-grid__result">
          <div className="q-result" ref={resultRef}>
            <Equation values={values} lang={lang} t={t} />
            <ul className="q-legend" aria-label={t.eqLegend}>
              {["measured", "estimated", "unknown"].map(l => <li key={l}><Certainty level={l} t={t} short /></li>)}
            </ul>

            <p className="q-result__label" id="q-result-label">{t.resultLabel}</p>
            <p className="q-result__big" role="status" aria-live="polite" aria-atomic="true" aria-labelledby="q-result-label q-result-n">
              <span id="q-result-n"><span className="q-result__n">{h.big}</span> <span className="q-result__unit">{unit}</span></span>
            </p>
            {h.kind === "none" && N > 0 && <p className="q-result__detail">{t.noneDetail(1 / N >= 1e15 ? sci(1 / N, lang, 1) : big(1 / N, lang), 1 / N >= 999500 && 1 / N < 1e15)}</p>}

            <div className="q-dist">
              <h3 className="q-dist__title">{t.distTitle}</h3>
              {d == null ? <p className="q-dist__none">{t.distNone}</p> : (
                <dl className="q-dist__list">
                  <div><dt>{t.distNeighbor}</dt><dd>{lightYears(d, lang)}</dd></div>
                  <div><dt>{t.distSignal}</dt><dd>{years(roundTripYears(d), lang)}</dd></div>
                </dl>
              )}
              <details className="q-why q-why--dist">
                <summary>{t.distHow}<Chevron /></summary>
                <div className="q-why__body"><p>{t.distHowBody}</p><RefList ids={["esaGalaxy"]} lang={lang} t={t} /></div>
              </details>
            </div>
          </div>

          <Spread values={values} N={N} lang={lang} t={t} />
        </div>

        <div className="q-grid__controls">
          <div className="q-presets" role="group" aria-labelledby="q-presets-label">
            <p id="q-presets-label" className="q-presets__label">{t.presetsLabel}</p>
            <div className="q-presets__row">
              {PRESETS.map(p => (
                <button key={p.id} type="button" className={`q-preset ${presetId === p.id ? "is-on" : ""}`}
                  aria-pressed={presetId === p.id} aria-label={(p.longLabel || p.label)[lang]} onClick={() => pick(p.id)}>{p.label[lang]}</button>
              ))}
              <button type="button" className={`q-preset ${presetId === "custom" ? "is-on" : ""}`}
                aria-pressed={presetId === "custom"} onClick={() => pick("custom")}>{t.custom}</button>
            </div>
            <div className="q-presets__note" aria-live="polite">
              <p>{presetNote}</p>
              {preset && <RefList ids={preset.refs} lang={lang} t={t} />}
            </div>
          </div>

          <h3 className="q-h3 q-factors__title">{t.factorsTitle}</h3>
          <ol className="q-factors">
            {FACTORS.map(f => <Factor key={f.key} f={f} value={values[f.key]} onChange={setFactor} lang={lang} t={t} />)}
          </ol>

          <div className="q-share">
            <button type="button" className="btn btn--ghost" onClick={share}>{t.share}</button>
            <span className="q-share__msg" role="status">{copied === "ok" ? t.shared : copied === "fail" ? t.shareFail : ""}</span>
          </div>
        </div>
      </div>

      <ExoContext lang={lang} t={t} onSeeSky={onSeeSky} />

      <section className="q-thread" aria-labelledby="q-thread-title">
        <h3 id="q-thread-title" className="q-h3 q-thread__title">{t.threadTitle}</h3>
        <FermiCard N={N} lang={lang} t={t} />
        <FilterCard lang={lang} t={t} />
        <KardashevCard logP={logP} setLogP={setLogP} lang={lang} t={t} />
      </section>

      <nav className="q-next" aria-labelledby="q-next-title">
        <h3 id="q-next-title" className="q-next__title">{t.nextTitle}</h3>
        <ul>
          {NEXT_LINKS.map(l => (
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
