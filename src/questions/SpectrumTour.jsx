// SpectrumTour.jsx — recorrido «¿Cómo sabemos de qué están hechas las estrellas?» (id «spectrum»).
// Los números y la física salen de spectrumData.js, los textos de spectrumText.js y el dibujo
// del espectro visible es el de src/sky/Spectrum.jsx (se importa tal cual): aquí solo hay interfaz.
import { useCallback, useEffect, useMemo, useState } from "react";
import Spectrum from "../sky/Spectrum.jsx";
import { wavelengthHex } from "../sky/composition.js";
import "../sky/composition.css";
import {
  SPEC_REFS, SPECIES, SPECIES_IDS, MIX_PRESETS, TEMP_PRESETS, CHALLENGES, DEFAULT_STATE, DEFAULT_AMOUNT,
  NIR_MIN, NIR_MAX, T_SLIDER, tempFromSlider, sliderFromTemp, classOfTemp, wienPeak,
  buildSpectrum, nirCurve, encodeMix, readState, evaluate, challengeSpectrum, clampTemp,
} from "./spectrumData.js";
import { SPEC_T } from "./spectrumText.js";
import { parseRoute } from "./physics.js";
import { num } from "./format.js";
import { TQ } from "./i18n.js";
import { Certainty, Card, Refs, Slider, Why, TourHead, ShareRow, useHashSync } from "./shared.jsx";
import "./spectrum.css";

// En memoria (no se guarda en ningún sitio): lo último que se tocó y cuántos retos salieron perfectos.
const store = { state: null, perfect: new Set() };

function readHash() {
  try {
    const r = parseRoute(window.location.hash || "", ["spectrum"]);
    if (r.id !== "spectrum") return {};
    return readState(r.params);
  } catch { return {}; }
}

// ¿Está activa la visión nocturna? (la app pone la clase en <html>)
function useNight() {
  const [on, setOn] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("night-vision"));
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return undefined;
    const el = document.documentElement;
    const mo = new MutationObserver(() => setOn(el.classList.contains("night-vision")));
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    setOn(el.classList.contains("night-vision"));
    return () => mo.disconnect();
  }, []);
  return on;
}

const nm0 = (x, lang) => num(Math.round(x), lang);
const nm1 = (x, lang) => num(Math.round(x * 10) / 10, lang, 1);

function Step({ id, title, lead, children }) {
  return (
    <section className="q-step" aria-labelledby={id}>
      <h3 id={id} className="q-h3 q-step__title">{title}</h3>
      {lead && <p className="q-step__lead">{lead}</p>}
      {children}
    </section>
  );
}

// ─── Infrarrojo cercano: tira propia (Spectrum.jsx solo llega a 750 nm) ─────
const NW = 340, NH = 104, NPAD = 8, NTOP = 24, NBOT = 62, NSTRIP = 66, NSTRIP_H = 10;
const NTICKS = [800, 1000, 1500, 2000];
function NirStrip({ T, bands, labels, lang, S }) {
  const x = (nm) => NPAD + ((nm - NIR_MIN) / (NIR_MAX - NIR_MIN)) * (NW - 2 * NPAD);
  const y = (v) => NBOT - v * (NBOT - NTOP);
  const curve = useMemo(() => nirCurve(T, bands, 4), [T, bands]);
  const path = curve.map((p, i) => `${i ? "L" : "M"}${x(p.nm).toFixed(1)},${y(p.y).toFixed(1)}`).join("");
  // un rótulo por especie (sobre su banda más a la izquierda), sin pisarse
  const lab = [];
  if (labels) {
    const seen = new Set();
    let end = -Infinity;
    for (const b of bands) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      const text = SPECIES[b.id].sym, w = text.length * 6 + 4, left = Math.max(NPAD, Math.min(NW - NPAD - w, x(b.nm) - w / 2));
      if (left < end + 3) continue;
      end = left + w;
      lab.push({ text, cx: x(b.nm), tx: left + w / 2 });
    }
  }
  const aria = S.nirAria(bands.length ? bands.map(b => `${labels ? SPECIES[b.id].sym + " " : ""}${nm0(b.nm, lang)} nm`).join(", ") : "", T);
  return (
    <div role="img" aria-label={aria}>
      <svg className="q-nir" viewBox={`0 0 ${NW} ${NH}`} aria-hidden="true" focusable="false">
        <path d={`${path}L${x(NIR_MAX)},${NBOT}L${x(NIR_MIN)},${NBOT}Z`} className="q-nir__area" />
        <line x1={x(NIR_MIN)} x2={x(NIR_MAX)} y1={NBOT} y2={NBOT} className="q-nir__base" />
        <path d={path} className="q-nir__curve" />
        <rect x={x(NIR_MIN)} y={NSTRIP} width={x(NIR_MAX) - x(NIR_MIN)} height={NSTRIP_H} rx="2" className="q-nir__strip" />
        {bands.map(b => (
          <rect key={`${b.id}${b.nm}`} x={x(b.nm - b.half)} y={NSTRIP} width={Math.max(2, x(b.nm + b.half) - x(b.nm - b.half))} height={NSTRIP_H}
            className="q-nir__abs" style={{ opacity: Math.min(1, 0.4 + b.depth) }} />
        ))}
        {lab.map(l => (
          <g key={l.text}>
            <line x1={l.cx} x2={l.cx} y1={16} y2={NSTRIP} className="q-nir__guide" />
            <text x={l.tx} y={12} textAnchor="middle" className="q-nir__lbl">{l.text}</text>
          </g>
        ))}
        {NTICKS.map(nm => (
          <g key={nm} className="q-nir__tick">
            <line x1={x(nm)} x2={x(nm)} y1={NSTRIP + NSTRIP_H} y2={NSTRIP + NSTRIP_H + 3} />
            <text x={x(nm)} y={NSTRIP + NSTRIP_H + 14} textAnchor="middle">{num(nm, lang)}</text>
          </g>
        ))}
        <text x={NW - NPAD} y={NH - 4} textAnchor="end" className="q-nir__axis">{S.axis}</text>
      </svg>
    </div>
  );
}

// Espectro visible (Spectrum.jsx) + tira del infrarrojo cercano + nota de visión nocturna.
// `named` = false oculta nombres y guías (reto del juego antes de comprobar).
function SpectrumFigure({ mode, T, spec, named, lang, S, night, mystery = false }) {
  const lines = useMemo(() => spec.visLines.map(l => (named
    ? { key: l.key, group: l.group, nm: l.nm, name: l.name, depth: l.depth, band: l.band }
    : { nm: l.nm, depth: l.depth, band: l.band })), [spec, named]);
  const peak = wienPeak(T);
  const visTxt = spec.visLines.length
    ? spec.visLines.map(l => `${named ? l.name + " " : ""}${nm0(l.nm, lang)} nm`).join(", ")
    : "";
  const aria = mystery && !named ? S.mysteryAria(visTxt, spec.visLines.length)
    : S.specAria(mode, T, classOfTemp(T), peak, visTxt, named);
  return (
    <figure className={`q-spec-fig ${named ? "" : "is-mystery"}`}>
      <div role="img" aria-label={aria}>
        <div aria-hidden="true">
          <Spectrum temp={T} cls="G" lines={lines} lang={lang} caption={false} legend={false} />
        </div>
      </div>
      <p className="q-spec-fig__nir">{S.nirTitle}</p>
      <NirStrip T={T} bands={spec.nir} labels={named} lang={lang} S={S} />
      <figcaption className="q-fine">{S.schematic}</figcaption>
      <p className={`q-spec-night ${night ? "is-on" : ""}`}>{S.night}</p>
    </figure>
  );
}

// ─── Paso 1: la luz trae un código de barras ───────────────────────────────
const H_LINES = [410.173, 434.047, 486.135, 656.279];     // Balmer, NIST (aire)
function Strips({ S }) {
  const W = 340, x0 = 8, x1 = 332, nmx = (nm) => x0 + ((nm - 380) / 370) * (x1 - x0);
  const stops = []; for (let nm = 380; nm <= 750; nm += 10) stops.push(nm);
  const rows = [
    { y: 4, kind: "cont" },
    { y: 36, kind: "emis" },
    { y: 68, kind: "abs" },
  ];
  return (
    <svg className="q-strips" viewBox={`0 0 ${W} 100`} role="img" aria-label={S.stripsAria}>
      <defs>
        <linearGradient id="q-spec-rb" gradientUnits="userSpaceOnUse" x1={x0} x2={x1} y1="0" y2="0">
          {stops.map(nm => <stop key={nm} offset={(nm - 380) / 370} stopColor={wavelengthHex(nm)} />)}
        </linearGradient>
      </defs>
      {rows.map(r => (
        <g key={r.kind}>
          <rect x={x0} y={r.y} width={x1 - x0} height="26" rx="3" fill={r.kind === "emis" ? "#05070d" : "url(#q-spec-rb)"} />
          {r.kind === "emis" && H_LINES.map(nm => <rect key={nm} x={nmx(nm) - 1.4} y={r.y} width="2.8" height="26" fill={wavelengthHex(nm)} />)}
          {r.kind === "abs" && H_LINES.map(nm => <rect key={nm} x={nmx(nm) - 1.4} y={r.y} width="2.8" height="26" fill="#05070d" />)}
        </g>
      ))}
    </svg>
  );
}

function Prism({ S }) {
  const cols = [380, 440, 490, 530, 580, 620, 700];
  return (
    <svg className="q-prism" viewBox="0 0 340 110" role="img" aria-label={S.prismAria}>
      <line x1="10" y1="58" x2="128" y2="58" className="q-prism__beam" />
      <path d="M128 18 L176 100 L96 100 Z" className="q-prism__glass" transform="translate(30 -4) rotate(0)" />
      {cols.map((nm, i) => (
        <line key={nm} x1="190" y1="58" x2="330" y2={22 + i * 11} stroke={wavelengthHex(nm)} strokeWidth="5" strokeLinecap="round" opacity="0.95" />
      ))}
    </svg>
  );
}

function LightStep({ lang, t, T }) {
  const S = T.s1;
  return (
    <Step id="q-spec-s1" title={S.title} lead={S.lead}>
      <Prism S={S} />
      <p className="q-step__p">{S.prism}</p>
      <figure className="q-strips-fig">
        <figcaption className="q-h4">{S.stripsTitle}</figcaption>
        <Strips S={S} />
        <ol className="q-strips__keys">{S.strips.map(([a, b]) => <li key={a}><strong>{a}</strong> {b}</li>)}</ol>
      </figure>
      <p className="q-step__p">{S.rule}</p>
      <p><Certainty level="measured" t={t} short note={S.tagNote} /></p>
      <Refs ids={["nist"]} refs={SPEC_REFS} lang={lang} t={t} />
      <h4 className="q-h4">{S.timelineTitle}</h4>
      <ol className="q-time-list">
        {S.timeline.map(it => (
          <li key={it.year} className="q-time-item">
            <span className="q-time-item__year">{it.year}</span>
            <div>
              <p className="q-time-item__who">{it.who}</p>
              <p className="q-time-item__text">{it.text}</p>
              <Refs ids={it.refs} refs={SPEC_REFS} lang={lang} t={t} />
            </div>
          </li>
        ))}
      </ol>
    </Step>
  );
}

// ─── Fichas de elementos y atajos ──────────────────────────────────────────
function SpeciesChips({ T, mix, silentIds, onToggle, ariaGroup }) {
  const S = T.s2;
  return (
    <div className="q-spec-chips" role="group" aria-label={ariaGroup}>
      {SPECIES_IDS.map(id => {
        const on = mix[id] > 0, sp = SPECIES[id], silent = on && silentIds.has(id);
        const name = T.species[id];
        return (
          <button key={id} type="button" className={`q-spec-chip ${on ? "is-on" : ""} ${silent ? "is-silent" : ""}`}
            aria-pressed={on} aria-label={`${name} (${sp.sym})${silent ? ", " + S.silentShort : ""}`} onClick={() => onToggle(id)}>
            <span className="q-spec-chip__sym" aria-hidden="true">{sp.sym}</span>
            <span className="q-spec-chip__name" aria-hidden="true">{name}</span>
            <span className="q-spec-chip__state" aria-hidden="true">{silent ? S.silentShort : on ? S.on : S.off}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Paso 2: el laboratorio ────────────────────────────────────────────────
function LabStep({ lang, t, T, st, setSt, hash }) {
  const S = T.s2;
  const night = useNight();
  const { mode, T: temp, mix } = st;
  const spec = useMemo(() => buildSpectrum({ mode, T: temp, mix }), [mode, temp, mix]);
  const silentIds = useMemo(() => new Set(spec.silent.map(s => s.id)), [spec]);
  const active = SPECIES_IDS.filter(id => mix[id] > 0);

  const toggle = useCallback((id) => setSt(s => {
    const m = { ...s.mix };
    if (m[id] > 0) delete m[id]; else m[id] = DEFAULT_AMOUNT;
    return { ...s, mix: m };
  }), [setSt]);
  const setAmount = useCallback((id, v) => setSt(s => ({ ...s, mix: { ...s.mix, [id]: v } })), [setSt]);
  const applyPreset = (p) => setSt({ mode: p.mode, T: p.T, mix: { ...p.mix } });

  const sameMix = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => Math.abs(a[k] - b[k]) < 1e-9); };
  const activePreset = MIX_PRESETS.find(p => p.mode === mode && p.T === temp && sameMix(p.mix, mix));
  const cls = classOfTemp(temp), peak = wienPeak(temp);
  const mixChip = (p) => (
    <button key={p.id} type="button" data-preset={`mix-${p.id}`} className={`q-preset ${activePreset && activePreset.id === p.id ? "is-on" : ""}`}
      aria-pressed={!!activePreset && activePreset.id === p.id} onClick={() => applyPreset(p)}>{S.presets[p.id]}</button>
  );
  const tempChip = (p) => (
    <button key={p.id} type="button" data-preset={`temp-${p.id}`} className={`q-preset ${temp === p.T ? "is-on" : ""}`}
      aria-pressed={temp === p.T} onClick={() => setSt(s => ({ ...s, T: p.T }))}>{S.temps[p.id]}</button>
  );
  const modeBtn = (m) => (
    <button key={m} type="button" data-preset={`mode-${m}`} className={`q-preset ${mode === m ? "is-on" : ""}`}
      aria-pressed={mode === m} onClick={() => setSt(s => ({ ...s, mode: m }))}>{S.modes[m]}</button>
  );
  const note = activePreset ? S.presetNotes[activePreset.id] : S.customNote;

  return (
    <Step id="q-spec-s2" title={S.title} lead={S.lead}>
      <div className="q-presets" role="group" aria-labelledby="q-spec-modes">
        <p id="q-spec-modes" className="q-presets__label">{S.modeLabel}</p>
        <div className="q-presets__row">{["star", "planet"].map(modeBtn)}</div>
      </div>
      <p className="q-presets__note" aria-live="polite">{S.modeNote[mode]}</p>

      <SpectrumFigure mode={mode} T={temp} spec={spec} named lang={lang} S={S} night={night} />

      <Slider label={S.tempLabel} value={sliderFromTemp(temp)} min={T_SLIDER.min} max={T_SLIDER.max} step={T_SLIDER.step}
        onChange={v => setSt(s => ({ ...s, T: tempFromSlider(v) }))}
        valueText={`${num(temp, lang)} K · ${S.classWord} ${cls}`} ariaText={S.tempAria(num(temp, lang), cls, nm0(peak, lang))} />
      <div className="q-presets q-presets--second" role="group" aria-label={S.tempLabel}>
        <div className="q-presets__row q-presets__row--3">{TEMP_PRESETS.map(tempChip)}</div>
      </div>
      <p className="q-fine q-spec-temp">{S.peakNote(nm0(peak, lang))}</p>

      <h4 className="q-h4 q-spec-h4">{S.speciesTitle}</h4>
      <p className="q-fine">{S.speciesHint}</p>
      <SpeciesChips T={T} mix={mix} silentIds={silentIds} onToggle={toggle} ariaGroup={S.speciesTitle} />

      {active.length > 0 && (
        <div className="q-spec-amounts">
          {active.map(id => (
            <Slider key={id} label={S.amountLabel(T.species[id])} hint={S.amountHint} value={Math.round(mix[id] * 100)} min={5} max={100} step={5}
              onChange={v => setAmount(id, v / 100)} valueText={`${Math.round(mix[id] * 100)} %`} ariaText={S.amountAria(T.species[id], Math.round(mix[id] * 100))} />
          ))}
        </div>
      )}

      <div className="q-spec-read" aria-live="polite">
        <h4 className="q-h4 q-spec-h4">{S.readTitle}</h4>
        {spec.present.length === 0 && <p className="q-note">{active.length ? S.nothingDrawn : S.emptyMix}</p>}
        {spec.present.length > 0 && (
          <ul className="q-spec-read__list">
            {spec.present.map(id => {
              const sp = SPECIES[id];
              const vis = spec.visLines.filter(l => l.id === id).map(l => nm0(l.nm, lang));
              const nir = spec.nir.filter(b => b.id === id).map(b => nm0(b.nm, lang));
              return <li key={id}><strong>{sp.sym}</strong> {S.readItem(vis, nir)}</li>;
            })}
          </ul>
        )}
        {spec.silent.map(s => <p key={s.id} className="q-note q-note--warn"><strong>{SPECIES[s.id].sym}</strong> {S.silent[s.reason](T.species[s.id])}</p>)}
        {SPECIES_IDS.some(id => mix[id] > 0 && SPECIES[id].vis.length === 0 && !silentIds.has(id)) && <p className="q-fine">{S.nirOnly}</p>}
      </div>
      <p><Certainty level="measured" t={t} short note={S.tagPositions} /> <Certainty level="estimated" t={t} short note={S.tagDepths} /></p>

      <div className="q-presets" role="group" aria-labelledby="q-spec-mixes">
        <p id="q-spec-mixes" className="q-presets__label">{S.presetsLabel}</p>
        <div className="q-presets__row q-presets__row--5">{MIX_PRESETS.map(mixChip)}</div>
      </div>
      <div className="q-presets__note" aria-live="polite">
        <p>{note}</p>
        {activePreset && activePreset.id === "mars" && <Refs ids={["nasaMars"]} refs={SPEC_REFS} lang={lang} t={t} />}
        {activePreset && activePreset.id === "venus" && <Refs ids={["nasaVenus"]} refs={SPEC_REFS} lang={lang} t={t} />}
        {activePreset && activePreset.id === "jupiter" && <Refs ids={["nasaJupiter"]} refs={SPEC_REFS} lang={lang} t={t} />}
        {activePreset && activePreset.id === "earth" && <Refs ids={["nasaEarth"]} refs={SPEC_REFS} lang={lang} t={t} />}
        {activePreset && activePreset.id === "sun" && <Refs ids={["iau2015"]} refs={SPEC_REFS} lang={lang} t={t} />}
      </div>

      <Card id="q-spec-pvs" title={S.pvs.title} teaser={S.pvs.teaser} level="estimated" levelNote={S.pvs.tagNote} t={t}>
        <p>{S.pvs.p1}</p>
        <p>{S.pvs.p2}</p>
        <p>{S.pvs.p3}</p>
      </Card>
      <Card id="q-spec-n2" title={S.n2.title} teaser={S.n2.teaser} level="estimated" levelNote={S.n2.tagNote} t={t}>
        <p>{S.n2.p1}</p>
        <p>{S.n2.p2}</p>
        <Refs ids={["nasaEarth", "nasaJupiter"]} refs={SPEC_REFS} lang={lang} t={t} />
      </Card>
      <Why summary={S.refsSummary} className="q-spec-why">
        <ul className="q-spec-refs-list">
          {SPECIES_IDS.map(id => (
            <li key={id}><strong>{SPECIES[id].sym}</strong> {S.fingerprint(SPECIES[id].vis.map(l => nm1(l.nm, lang)), SPECIES[id].nir.map(b => nm0(b.nm, lang)), SPECIES[id].kind)}</li>
          ))}
        </ul>
        <Refs ids={["nist", "fraunhofer", "gao1993", "oco2", "cassiniCH4", "tio"]} refs={SPEC_REFS} lang={lang} t={t} />
      </Why>
      <ShareRow hash={hash} t={t} />
    </Step>
  );
}

// ─── Paso 3: el juego ──────────────────────────────────────────────────────
function Mark({ ok }) {
  return (
    <svg className={`q-spec-mark ${ok ? "is-ok" : "is-bad"}`} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      {ok ? <path d="m3.5 9.5 3.4 3.4 7.6-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="m4.5 4.5 9 9M13.5 4.5l-9 9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}

function GameStep({ lang, t, T }) {
  const G = T.s3, S = T.s2;
  const night = useNight();
  const [idx, setIdx] = useState(0);
  const [marks, setMarks] = useState(() => ({}));       // por reto: { id: true }
  const [checked, setChecked] = useState({});             // por reto: resultado de evaluate()
  const [, force] = useState(0);
  const c = CHALLENGES[idx];
  const marked = marks[c.id] || {};
  const res = checked[c.id] || null;
  const spec = useMemo(() => challengeSpectrum(c), [c]);
  const silentIds = useMemo(() => new Set(), []);
  const markedIds = SPECIES_IDS.filter(id => marked[id]);
  const info = G.challenges[c.id];

  const toggle = (id) => { if (res) return; setMarks(m => ({ ...m, [c.id]: { ...m[c.id], [id]: !(m[c.id] && m[c.id][id]) } })); };
  const check = () => {
    const r = evaluate(c, markedIds);
    setChecked(k => ({ ...k, [c.id]: r }));
    if (r.perfect) store.perfect.add(c.id);
    force(n => n + 1);
  };
  const again = () => { setChecked(k => { const n = { ...k }; delete n[c.id]; return n; }); setMarks(m => ({ ...m, [c.id]: {} })); };
  const go = (i) => { setIdx(i); try { document.getElementById("q-spec-s3")?.scrollIntoView({ block: "start", behavior: "auto" }); } catch { /* no-op */ } };
  const mixForChips = useMemo(() => Object.fromEntries(SPECIES_IDS.map(id => [id, marked[id] ? 1 : 0])), [marked]);
  const perfectCount = [...store.perfect].filter(id => CHALLENGES.some(x => x.id === id)).length;
  const last = idx === CHALLENGES.length - 1;

  return (
    <Step id="q-spec-s3" title={G.title} lead={G.lead}>
      <nav className="q-game-nav" aria-label={G.navLabel}>
        {CHALLENGES.map((x, i) => (
          <button key={x.id} type="button" className={`q-game-dot ${i === idx ? "is-on" : ""} ${checked[x.id] ? (checked[x.id].perfect ? "is-perfect" : "is-done") : ""}`}
            aria-current={i === idx ? "step" : undefined} aria-label={G.dotAria(i + 1, !!checked[x.id], !!(checked[x.id] && checked[x.id].perfect))} onClick={() => go(i)}>{i + 1}</button>
        ))}
      </nav>
      <h4 className="q-h4 q-game-title">{res ? G.revealTitle(info.name, idx + 1) : G.mysteryTitle(idx + 1, CHALLENGES.length)}</h4>
      <p className="q-step__p">{G.kind[c.mode]}</p>

      <SpectrumFigure mode={c.mode} T={c.T} spec={spec} named={!!res} lang={lang} S={S} night={night} mystery />

      <Why summary={G.hintSummary}><p>{info.hint}</p></Why>
      <Why summary={G.refSummary}>
        <ul className="q-spec-refs-list">
          {SPECIES_IDS.map(id => (
            <li key={id}><strong>{SPECIES[id].sym}</strong> {S.fingerprint(SPECIES[id].vis.map(l => nm1(l.nm, lang)), SPECIES[id].nir.map(b => nm0(b.nm, lang)), SPECIES[id].kind)}</li>
          ))}
        </ul>
        <p className="q-fine">{G.refNote}</p>
      </Why>

      <h4 className="q-h4 q-spec-h4">{G.pickTitle}</h4>
      <SpeciesChips T={T} mix={mixForChips} silentIds={silentIds} onToggle={toggle} ariaGroup={G.pickTitle} />
      <div className="q-game-actions">
        {!res && <button type="button" className="btn q-game-btn" onClick={check}>{G.check}</button>}
        {res && <button type="button" className="btn btn--ghost q-game-btn" onClick={again}>{G.again}</button>}
        {res && (last
          ? <button type="button" className="btn q-game-btn" onClick={() => go(0)}>{G.restart}</button>
          : <button type="button" className="btn q-game-btn" onClick={() => go(idx + 1)}>{G.next}</button>)}
      </div>

      <div className="q-game-result" role="status" aria-live="polite" aria-atomic="false">
        {res && (
          <>
            <p className={`q-game-verdict ${res.perfect ? "is-perfect" : ""}`}>{res.perfect ? G.perfect : G.partial(res.found.length, res.total, res.extra.length)}</p>
            <ul className="q-game-rows">
              {res.rows.map(r => (
                <li key={r.id} className={r.ok ? "is-ok" : "is-bad"}>
                  <Mark ok={r.ok} />
                  <span><strong>{SPECIES[r.id].sym}</strong> {" "}
                    {r.ok ? G.rowOk(T.species[r.id]) : r.present ? G.rowMissed(T.species[r.id]) : r.hidden && r.silent ? G.rowHidden(T.species[r.id], S.silent[r.silent.reason](T.species[r.id])) : G.rowExtra(T.species[r.id])}
                  </span>
                </li>
              ))}
              {res.rows.length === 0 && <li>{G.nothing}</li>}
            </ul>
            <p className="q-step__p">{info.explain}</p>
            <Refs ids={c.refs} refs={SPEC_REFS} lang={lang} t={t} />
          </>
        )}
      </div>
      <p className="q-fine q-game-tally">{G.tally(perfectCount, CHALLENGES.length)}</p>
    </Step>
  );
}

// ─── Paso 4: vida en exoplanetas ───────────────────────────────────────────
function TransitDip({ S }) {
  // Esquema (NO son los datos): 3,0–5,5 µm, con una caída entre 4,1 y 4,6 µm
  const x = (um) => 40 + ((um - 3) / 2.5) * 280;
  const pts = [];
  for (let um = 3; um <= 5.001; um += 0.05) {
    const z = (um - 4.3) / 0.22;
    const y = 36 + 22 * Math.exp(-z * z) + 6 * Math.sin(um * 9) * 0.3;
    pts.push(`${pts.length ? "L" : "M"}${x(um).toFixed(1)} ${y.toFixed(1)}`);
  }
  return (
    <svg className="q-dip" viewBox="0 0 340 130" role="img" aria-label={S.dipAria}>
      <g aria-hidden="true">
        <rect x={x(4.1)} y="8" width={x(4.6) - x(4.1)} height="76" className="q-dip__band" />
        <path d="M40 10V90H322" className="q-dip__axis" fill="none" />
        <path d={pts.join("")} className="q-dip__line" fill="none" />
        {[3, 3.5, 4, 4.5, 5].map(u => <g key={u}><line x1={x(u)} x2={x(u)} y1="90" y2="94" className="q-dip__axis" /><text x={x(u)} y="106" textAnchor="middle" className="q-dip__tick">{u.toString().replace(".", S.decimal)}</text></g>)}
        <text x="181" y="124" textAnchor="middle" className="q-dip__label">{S.dipX}</text>
        <text transform="translate(11 50) rotate(-90)" textAnchor="middle" className="q-dip__label">{S.dipY}</text>
        <text x={x(4.35)} y="22" textAnchor="middle" className="q-dip__tick">CO₂</text>
      </g>
    </svg>
  );
}

function LifeStep({ lang, t, T }) {
  const S = T.s4;
  return (
    <Step id="q-spec-s4" title={S.title} lead={S.lead}>
      <Card id="q-spec-webb" title={S.webb.title} teaser={S.webb.teaser} level="measured" t={t} open>
        <p>{S.webb.p1}</p>
        <TransitDip S={S} />
        <p className="q-fine">{S.webb.fine}</p>
        <p>{S.webb.p2}</p>
        <Refs ids={["webbNasa", "webbEsa", "webbNature"]} refs={SPEC_REFS} lang={lang} t={t} />
      </Card>
      <Card id="q-spec-bio" title={S.bio.title} teaser={S.bio.teaser} level="unknown" t={t} open>
        <p>{S.bio.p1}</p>
        <p>{S.bio.p2}</p>
        <p>{S.bio.p3}</p>
        <Refs ids={["lovelock", "schwieterman2018"]} refs={SPEC_REFS} lang={lang} t={t} />
      </Card>
      <Card id="q-spec-k2" title={S.k2.title} teaser={S.k2.teaser} level="unknown" t={t}>
        <p>{S.k2.p1}</p>
        <p>{S.k2.p2}</p>
        <Refs ids={["luque2025"]} refs={SPEC_REFS} lang={lang} t={t} />
      </Card>
    </Step>
  );
}

// ─── Recorrido ─────────────────────────────────────────────────────────────
export default function SpectrumTour({ lang = "es", indexHref }) {
  const t = TQ[lang] || TQ.es;
  const T = SPEC_T[lang] || SPEC_T.es;
  const fromHash = useMemo(readHash, []);
  const [st, setSt] = useState(() => ({
    mode: fromHash.mode || (store.state && store.state.mode) || DEFAULT_STATE.mode,
    T: fromHash.T != null ? clampTemp(fromHash.T) : (store.state ? store.state.T : DEFAULT_STATE.T),
    mix: fromHash.mix || (store.state && store.state.mix) || { ...DEFAULT_STATE.mix },
  }));
  useEffect(() => { store.state = st; }, [st]);

  const prefix = lang === "es" ? "preguntas" : "questions";
  const hash = `#${prefix}?q=spectrum&m=${st.mode}&t=${Math.round(st.T)}&e=${encodeMix(st.mix)}`;
  useHashSync(hash);

  const nextLinks = [
    { url: "#sky?o=star~Betelgeuse", label: T.next.sky.label, note: T.next.sky.note, internal: true },
    { url: `#${prefix}?q=mass`, label: T.next.mass.label, note: T.next.mass.note, internal: true },
  ];
  const refIds = Object.keys(SPEC_REFS);

  return (
    <section className="q q-tour q-spectrum-tour" aria-labelledby="q-title">
      <TourHead t={t} title={T.title} lead={T.lead} indexHref={indexHref} />

      <LightStep lang={lang} t={t} T={T} />
      <LabStep lang={lang} t={t} T={T} st={st} setSt={setSt} hash={hash} />
      <GameStep lang={lang} t={t} T={T} />
      <LifeStep lang={lang} t={t} T={T} />

      <aside className="q-honesty q-assume" aria-labelledby="q-spec-assume">
        <h3 id="q-spec-assume" className="q-honesty__title">{T.assumptionsTitle}</h3>
        <ul className="q-assume__list">{T.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
      </aside>

      <section className="q-sources" aria-labelledby="q-spec-sources">
        <h3 id="q-spec-sources" className="q-h3">{T.sourcesTitle}</h3>
        <Refs ids={refIds} refs={SPEC_REFS} lang={lang} t={t} />
      </section>

      <p className="q-fine q-honest">{T.honest}</p>

      <nav className="q-next" aria-labelledby="q-next-title">
        <h3 id="q-next-title" className="q-next__title">{t.nextTitle}</h3>
        <ul>
          {nextLinks.map(l => (
            <li key={l.url}>
              <a href={l.url}>{l.label}</a>
              <span>{l.note}</span>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
