// Ficha de objeto: hoja inferior deslizable en móvil, panel lateral en escritorio.
// Jerarquía: nombre + tipo → visual (3D / imagen / representación) → 3 datos en
// lenguaje humano → descripción → detalles técnicos plegables → acciones.
import { useEffect, useRef, useState } from "react";
import Planet3D from "./Planet3D.jsx";
import Icon from "./icons.jsx";
import { BODIES, bodyName } from "./bodies.js";
import { fmtDist, fmtYears, fmtDuration, fmtKm, fmtMassSun, num, AU_KM, LIGHT_KM_S, VOYAGER_KM_S, LY_KM, SEC_PER_YEAR } from "./format.js";

const MESSIER_TYPE = {
  galaxy: { es: "Galaxia", en: "Galaxy" }, globular: { es: "Cúmulo globular", en: "Globular cluster" },
  open: { es: "Cúmulo abierto", en: "Open cluster" }, nebula: { es: "Nebulosa", en: "Nebula" },
  snr: { es: "Remanente de supernova", en: "Supernova remnant" }, cluster: { es: "Cúmulo o asociación estelar", en: "Star cluster or association" },
  other: { es: "Objeto de cielo profundo", en: "Deep-sky object" },
};
// Los catálogos estáticos traen estas notas solo en español: se traducen aquí.
const BH_KIND_EN = { supermasivo: "supermassive", estelar: "stellar-mass" };
const NOTE_EN = {
  "centro de la Vía Láctea": "centre of the Milky Way", "1ra imagen (EHT 2019)": "first image ever taken (EHT, 2019)",
  "1er candidato confirmado": "first confirmed candidate", "binaria de rayos X": "X-ray binary", "microquasar": "microquasar",
  "chorros superlumínicos": "apparently superluminal jets", "uno de los más cercanos": "one of the nearest",
  "en la Gran Nube de Magallanes": "in the Large Magellanic Cloud", "el más cercano conocido (Gaia BH1)": "nearest known (Gaia BH1)",
  "el estelar más masivo de la galaxia": "most massive stellar black hole in the galaxy", "fuera del plano galáctico": "outside the galactic plane",
  "microquasar variable": "variable microquasar", "en la galaxia de Andrómeda": "in the Andromeda galaxy",
  "uno de los más masivos (cuásar)": "one of the most massive (quasar)", "binaria de rayos X masiva": "massive X-ray binary",
  "nova de rayos X": "X-ray nova", "primer cuásar identificado (1963)": "first quasar identified (1963)",
  "uno de los más masivos medidos": "one of the most massive measured",
  "milisegundo": "millisecond", "binario": "binary", "en remanente de SN": "in a supernova remnant",
};
const noteIn = (note, lang) => {
  if (!note) return "";
  if (lang === "es") return note.replace("1ra", "primera").replace("1er", "primer").replace("remanente de SN", "remanente de supernova");
  return NOTE_EN[note] || note.split(",").map((s) => NOTE_EN[s.trim()] || s.trim()).join(", ");
};
const fmtMD = (md, lang) => {
  const [m, d] = md.split("-").map(Number);
  return new Date(2024, m - 1, d).toLocaleDateString(lang === "es" ? "es" : "en-US", { day: "numeric", month: "short" });
};
const raDec = (ra, dec, lang) => {
  const h = ra / 15, hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${lang === "es" ? "AR" : "RA"} ${hh} h ${String(mm % 60).padStart(2, "0")} m · Dec ${dec >= 0 ? "+" : "−"}${Math.abs(dec).toFixed(1)}°`;
};

// Convierte el objeto seleccionado en lo que muestra la ficha. Todo sale de los
// datos reales del objeto; aquí solo se les da formato.
export function describeObject(o, lang, t, meteorActive) {
  const es = lang === "es";
  const d = { name: o.name, type: "", badge: null, facts: [], note: "", details: [], visual: "photo", distNote: "" };
  const lightFacts = (ly) => {
    d.facts.push({ label: t.fDistance, value: fmtDist(ly, lang) });
    d.facts.push({ label: t.fLightLeft, value: t.ago(fmtYears(ly, lang)), hint: t.fLightHint });
    d.facts.push({ label: t.fVoyager, value: fmtYears(ly * LY_KM / VOYAGER_KM_S / SEC_PER_YEAR, lang) });
  };
  const nearFacts = (km, au) => {
    d.facts.push({ label: t.fDistance, value: fmtKm(km, lang), hint: au != null && au >= 0.1 ? `${num(au, lang, 2)} ${t.au}` : null });
    d.facts.push({ label: t.fLightTakes, value: fmtDuration(km / LIGHT_KM_S, lang) });
    d.facts.push({ label: t.fVoyager, value: fmtDuration(km / VOYAGER_KM_S, lang) });
  };
  const L = o.layer;
  if (L === "solar") {
    const b = BODIES[o.name] || {};
    d.name = bodyName(o.name, lang);
    d.type = o.name === "Sol" ? t.typeSun : o.name === "Luna" ? t.typeMoon : t.typePlanet;
    d.visual = "3d";
    const km = o.dist_km != null ? o.dist_km : (o.dist_au != null ? o.dist_au * AU_KM : null);
    if (km) nearFacts(km, o.dist_km != null ? null : o.dist_au);
    if (o.illum != null) d.note = t.moonPhase(Math.round(o.illum * 100), o.waxing);
    if (o.name === "Sol") d.note = t.capSunWarn;
    if (b.diameter_km) d.details.push([t.dDiameter, `${fmtKm(b.diameter_km, lang)} · ${t.timesEarth(num(b.diameter_km / 12742, lang, b.diameter_km < 12742 ? 2 : 1))}`]);
    if (b.day_h) d.details.push([t.dRotation, fmtDuration(b.day_h * 3600, lang) + (b.spin < 0 ? ` (${t.retrograde})` : "")]);
    if (b.year_d) d.details.push([o.name === "Luna" ? t.dOrbitEarth : t.dOrbitSun, fmtDuration(b.year_d * 86400, lang)]);
    if (o.ra != null) d.details.push([t.dPosition, raDec(o.ra, o.dec, lang)]);
    d.distNote = t.ephemNote;
  } else if (L === "star") {
    d.type = t.typeStar; d.visual = "star";
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    if (o.mag != null) d.details.push([t.dMagnitude, `${num(o.mag, lang, 2)} · ${t.magHint}`]);
    d.details.push([t.dSource, "HYG v4.1 (Hipparcos / Yale / Gliese)"]);
  } else if (L === "messier") {
    const ty = MESSIER_TYPE[o.type] || MESSIER_TYPE.other;
    d.type = ty[lang] + ((es ? o.const_es : o.const) ? ` · ${t.inConst(es ? o.const_es : o.const)}` : "");
    if (o.cn) d.name = `${o.name} · ${o.cn}`;
    d.visual = o.type === "galaxy" ? "galaxy" : "deep";
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    d.details.push([t.dCatalog, [o.name, o.ngc && o.ngc.replace(/^(NGC|IC)0*/, "$1 ")].filter(Boolean).join(" · ")]);
    if (o.mag != null) d.details.push([t.dMagnitude, `${num(o.mag, lang, 1)} · ${t.magHint}`]);
    d.distNote = t.distPublished;
  } else if (L === "galaxies") {
    d.type = t.typeGalaxy + ((es ? o.const_es : o.const) ? ` · ${t.inConst(es ? o.const_es : o.const)}` : "");
    d.visual = "galaxy";
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    if (o.cat && o.cat !== o.name) d.details.push([t.dCatalog, o.cat.replace(/^(NGC|IC)0*/, "$1 ")]);
    if (o.hubble) d.details.push([t.dHubble, o.hubble]);
    if (o.mag != null) d.details.push([t.dMagnitude, `${num(o.mag, lang, 1)} · ${t.magHint}`]);
    d.distNote = t.distRedshift;
  } else if (L === "blackholes") {
    d.type = `${t.typeBlackHole} ${es ? o.kind : (BH_KIND_EN[o.kind] || o.kind)}`.trim();
    d.visual = "blackhole";
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    d.note = noteIn(o.note, lang); d.note = d.note ? d.note.charAt(0).toUpperCase() + d.note.slice(1) + "." : "";
    if (o.mass_sun) d.details.push([t.dMass, fmtMassSun(o.mass_sun, lang)]);
    d.distNote = t.distPublished;
  } else if (L === "pulsars") {
    d.type = t.typePulsar; d.visual = "pulsar";
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    if (o.period_ms) {
      const perSec = 1000 / o.period_ms;
      d.note = perSec >= 1 ? t.pulsarSpin(num(perSec, lang, perSec < 10 ? 1 : 0)) : t.pulsarSlow(num(o.period_ms / 1000, lang, 2));
      d.details.push([t.dPeriod, `${num(o.period_ms, lang, 2)} ms`]);
    }
    if (o.note) d.details.push([t.dKind, noteIn(o.note, lang)]);
    d.details.push([t.dSource, "ATNF Pulsar Catalogue"]);
    d.distNote = t.distPublished;
  } else if (L === "meteors") {
    d.name = es ? o.name : (o.name_en || o.name);
    d.type = t.typeMeteor; d.visual = "meteor";
    if (meteorActive) d.badge = t.activeNow;
    d.facts.push({ label: t.fPeak, value: fmtMD(o.peak, lang) });
    d.facts.push({ label: t.fActive, value: `${fmtMD(o.start, lang)} – ${fmtMD(o.end, lang)}` });
    d.facts.push({ label: t.fRate, value: t.perHour(o.zhr), hint: t.zhrHint });
    d.note = t.radiantNote;
    if (o.parent) d.details.push([t.dParent, o.parent]);
  } else if (L === "comets" || L === "probes") {
    d.type = L === "comets" ? t.typeComet : t.typeProbe; d.visual = L === "comets" ? "comet" : "probe";
    if (o.dist_au != null) nearFacts(o.dist_au * AU_KM, o.dist_au);
    if (L === "comets") d.note = o.approaching ? t.approaching : t.receding;
    else d.note = (es ? o.note_es : o.note_en) || "";
    d.distNote = t.horizonsNote;
  } else if (L === "exoplanets") {
    d.type = t.typeExoplanet + (o.host ? ` · ${t.orbits(o.host)}` : ""); d.visual = "exoplanet";
    d.badge = o.hab ? t.habitable : null;
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    if (o.rade) d.details.push([t.dRadius, `${num(o.rade, lang, 2)} ${t.earthRadii}`]);
    if (o.mass_e) d.details.push([t.dMass, `${num(o.mass_e, lang, 2)} ${t.earthMasses}`]);
    if (o.period_d) d.details.push([t.dYear, fmtDuration(o.period_d * 86400, lang)]);
    if (o.eqt_k) d.details.push([t.dTemp, `${num(o.eqt_k, lang)} K (${num(Math.round(o.eqt_k - 273), lang)} °C)`]);
    if (o.host) d.details.push([t.dHost, o.host + (o.spectype ? ` (${o.spectype})` : "")]);
    if (o.disc_year) d.details.push([t.dDiscovered, `${o.disc_year}${o.method ? " · " + o.method : ""}`]);
    d.details.push([t.dSource, "NASA Exoplanet Archive"]);
    if (!o.hab) d.note = t.notHabitable;
  }
  return d;
}

// Visual principal: modelo 3D (sistema solar), imagen de Wikipedia (si existe) o
// una representación esquemática claramente etiquetada. Nunca se inventan fotos.
function Visual({ obj, info, t, lang, wiki, wikiState }) {
  const [texStatus, setTexStatus] = useState("loading");
  const [imgOk, setImgOk] = useState(false);
  const [imgFail, setImgFail] = useState(false);
  useEffect(() => { setTexStatus("loading"); setImgOk(false); setImgFail(false); }, [obj.name, obj.layer]);
  useEffect(() => { setImgOk(false); setImgFail(false); }, [wiki && wiki.thumb]);

  if (info.visual === "3d") {
    const b = BODIES[obj.name] || {};
    const real = texStatus === "real";
    return (
      <figure className="sk-visual is-3d">
        <div className="sk-visual-stage">
          <i className="sk-orbit" aria-hidden="true" />
          <Planet3D bodyKey={obj.name} onStatus={setTexStatus}
            phase={obj.name === "Luna" && obj.illum != null ? { illum: obj.illum, waxing: obj.waxing } : null}
            ariaLabel={t.model3dAria(info.name)} />
          <span className="sk-drag-hint" aria-hidden="true"><Icon name="hand" size={14} />{t.dragToSpin}</span>
        </div>
        <figcaption>
          <b>{texStatus === "fallback" || texStatus === "nowebgl" ? t.cap3dFallback : t.cap3dReal}</b>
          {real && <span>{t.texCredit[b.credit] || t.texCredit.sss}</span>}
          {obj.name === "Luna" && obj.illum != null && <span className="sk-cap-extra">{t.capMoonPhase}</span>}
        </figcaption>
      </figure>
    );
  }
  const hasPhoto = wiki && wiki.thumb && !imgFail;
  if (hasPhoto) {
    const cap = obj.layer === "exoplanets" ? t.capArtist
      : (obj.layer === "star" || obj.layer === "pulsars" || obj.layer === "blackholes") ? t.capWikiMixed : t.capWiki;
    return (
      <figure className="sk-visual is-photo">
        <div className={`sk-visual-stage${imgOk ? " is-loaded" : ""}`}>
          {!imgOk && <i className="sk-skeleton" aria-hidden="true" />}
          <img src={wiki.thumb} alt={t.imgAlt(info.name)} onLoad={() => setImgOk(true)} onError={() => setImgFail(true)} />
        </div>
        <figcaption><b>{cap}</b><a href={wiki.url} target="_blank" rel="noopener noreferrer">{t.capLicense}</a></figcaption>
      </figure>
    );
  }
  if (wikiState === "loading" && info.visual !== "star") {
    return (
      <figure className="sk-visual is-photo">
        <div className="sk-visual-stage"><i className="sk-skeleton" aria-hidden="true" /></div>
        <figcaption><span role="status">{t.capLoading}</span></figcaption>
      </figure>
    );
  }
  // sin imagen: representación etiquetada
  const kind = info.visual;
  const cap = kind === "star" ? t.capStar : (kind === "blackhole" || kind === "pulsar" || kind === "exoplanet") ? t.capSchematic : t.capNoImage;
  return (
    <figure className="sk-visual is-illus">
      <div className="sk-visual-stage">
        <div className={`sk-illus illus-${kind}`} style={kind === "star" ? { "--orb": obj.hex || "#ffffff" } : undefined} aria-hidden="true">
          <i /><i /><i />
        </div>
      </div>
      <figcaption><b>{cap}</b></figcaption>
    </figure>
  );
}

export default function ObjectSheet({ obj, lang, t, wiki, wikiState, meteorActive, onClose, onShare, shareState, onPostcard, onViewFrom, onCenter, canViewFrom }) {
  const info = describeObject(obj, lang, t, meteorActive);
  const [mode, setMode] = useState("peek");           // móvil: "peek" (media altura) | "full"
  const [dragY, setDragY] = useState(0);
  const startRef = useRef(null);
  const bodyRef = useRef(null);
  useEffect(() => { setMode("peek"); if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [obj.name, obj.layer]);

  // asa: arrastrar arriba expande, abajo reduce / cierra; un toque alterna
  const onDown = (e) => { startRef.current = { y: e.clientY, moved: false }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no-op */ } };
  const onMove = (e) => { const s = startRef.current; if (!s) return; const dy = e.clientY - s.y; if (Math.abs(dy) > 6) s.moved = true; setDragY(mode === "full" ? Math.max(0, dy) : dy); };
  const onUp = () => {
    const s = startRef.current; startRef.current = null;
    const dy = dragY; setDragY(0);
    if (!s) return;
    if (!s.moved) { setMode((m) => (m === "peek" ? "full" : "peek")); return; }
    if (dy < -40) setMode("full");
    else if (dy > 40) { if (mode === "full") setMode("peek"); else onClose(); }
  };
  const extract = wiki && wiki.extract ? (wiki.extract.length > 340 ? wiki.extract.slice(0, 340).replace(/\s+\S*$/, "") + "…" : wiki.extract) : "";

  return (
    <section className={`sk-sheet is-${mode}${dragY ? " is-dragging" : ""}`} role="dialog" aria-labelledby="sk-sheet-title"
      style={dragY ? { "--drag": `${dragY}px` } : undefined}>
      <button type="button" className="sk-grab" aria-label={mode === "peek" ? t.sheetExpand : t.sheetCollapse} aria-expanded={mode === "full"}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMode((m) => (m === "peek" ? "full" : "peek")); } }}>
        <i />
      </button>
      <header className="sk-sheet-head">
        <div>
          <h2 id="sk-sheet-title">{info.name}</h2>
          <p className="sk-type">{info.type}{info.badge && <em>{info.badge}</em>}</p>
        </div>
        <button type="button" className="sk-iconbtn" onClick={onClose} aria-label={t.closeSheet}><Icon name="close" size={18} /></button>
      </header>
      <div className="sk-sheet-body" ref={bodyRef}>
        <Visual obj={obj} info={info} t={t} lang={lang} wiki={wiki} wikiState={wikiState} />
        {info.facts.length > 0 && (
          <dl className="sk-facts">
            {info.facts.map((f) => (
              <div key={f.label}><dt>{f.label}</dt><dd>{f.value}{f.hint && <small>{f.hint}</small>}</dd></div>
            ))}
          </dl>
        )}
        {info.note && <p className="sk-note">{info.note}</p>}
        {extract && (
          <p className="sk-desc">{extract} <a href={wiki.url} target="_blank" rel="noopener noreferrer">{t.readMore}</a></p>
        )}
        {(info.details.length > 0 || info.distNote) && (
          <details className="sk-details">
            <summary>{t.techDetails}<Icon name="down" size={16} /></summary>
            <dl>
              {info.details.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {info.distNote && <p>{info.distNote}</p>}
          </details>
        )}
        <div className="sk-actions">
          {canViewFrom && (
            <button type="button" className="sk-btn primary wide" onClick={onViewFrom}><Icon name="eye" size={18} />{t.viewFromHere}</button>
          )}
          <button type="button" className="sk-btn" onClick={onShare} aria-live="polite">
            <Icon name={shareState === "ok" ? "check" : shareState === "fail" ? "warn" : "share"} size={17} />
            {shareState === "ok" ? t.linkCopied : shareState === "fail" ? t.linkFailed : t.share}
          </button>
          <button type="button" className="sk-btn" onClick={onPostcard}><Icon name="camera" size={17} />{t.postcard}</button>
          <button type="button" className="sk-btn" onClick={onCenter}><Icon name="target" size={17} />{t.center}</button>
        </div>
      </div>
    </section>
  );
}
