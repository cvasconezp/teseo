// Ficha de objeto: hoja inferior deslizable en móvil, panel lateral en escritorio.
// Jerarquía: nombre + tipo → visual (3D / imagen / representación) → 3 datos en
// lenguaje humano → descripción → detalles técnicos plegables → acciones.
import { useEffect, useMemo, useRef, useState } from "react";
import Planet3D from "./Planet3D.jsx";
import Icon from "./icons.jsx";
import { BODIES, bodyName } from "./bodies.js";
import { fmtDist, fmtYears, fmtDuration, fmtKm, fmtMassSun, fmtSuns, num, AU_KM, LIGHT_KM_S, VOYAGER_KM_S, LY_KM, SEC_PER_YEAR } from "./format.js";
import { exoClass, tempBand, methodKey, starClass, schwarzschildKm, bhSizeBand, pulsarSpin, hubbleFamily, magReach, JUPITER_RE, JUPITER_ME } from "./explain.js";
import { NoteArt, ExoCompare } from "./NoteArt.jsx";
import { drawArt, artKind, artOptions } from "./art.js";
import { riseTransitSet, bestTonight, signalDelay, horizonFor } from "./riseset.js";
import { altAz } from "./guide.js";
import { compassPoint8 } from "./deviceOrientation.js";
import { citizenFor, CITIZEN_VERIFIED } from "./citizen.js";
import { ephemeris } from "../ephemeris.js";
import { useDialogFocus } from "./focus.js";

// parte del cielo (en %) que ocupa la zona con la que se compara cada patrón
const NOTE_SKY_PCT = { kepler: 0.55, pulsarPlane: 17.4, avoidance: 17.4, globulars: 14.6 };

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

// Tono de una estrella a partir del color del catálogo (que a su vez sale de su
// índice de color B−V, es decir, de su temperatura). Solo nombra el tono: sky.json
// no trae el B−V ni el tipo espectral, así que no se da una temperatura en kelvin.
export function starHue(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return null;
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const d = r - b;
  if (d < -12) return "blue";
  if (d < 22) return "white";
  if (d < 60) return "yellow";
  if (d < 105) return "orange";
  return "red";
}

// Convierte el objeto seleccionado en lo que muestra la ficha. Todo sale de los
// datos reales del objeto; aquí solo se les da formato.
export function describeObject(o, lang, t, meteorActive) {
  const es = lang === "es";
  // explain = lista "dato → frase": cada entrada sale de un número real del objeto
  const d = { name: o.name, type: "", badge: null, facts: [], note: "", explain: [], details: [], visual: "photo", distNote: "" };
  const say = (title, text, hint) => { if (text) d.explain.push({ title, text, hint: hint || null }); };
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
    d.details.push([t.dSource, t.srcSolar]);
    d.distNote = t.ephemNote;
  } else if (L === "star") {
    d.type = t.typeStar; d.visual = "star";
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    if (o.mag != null) { say(null, t.starMag(o.mag)); d.details.push([t.dMagnitude, `${num(o.mag, lang, 2)} · ${t.magHint}`]); }
    const hue = starHue(o.hex); if (hue) say(null, t.starColorLine(t.starHue[hue]));
    d.details.push([t.dSource, t.srcStar]);
    if (o.dist_ly > 0) d.distNote = t.starDistNote;
  } else if (L === "messier") {
    const ty = MESSIER_TYPE[o.type] || MESSIER_TYPE.other;
    d.type = ty[lang] + ((es ? o.const_es : o.const) ? ` · ${t.inConst(es ? o.const_es : o.const)}` : "");
    if (o.cn) d.name = `${o.name} · ${o.cn}`;
    d.visual = o.type === "galaxy" ? "galaxy" : "deep";
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    d.details.push([t.dCatalog, [o.name, o.ngc && o.ngc.replace(/^(NGC|IC)0*/, "$1 ")].filter(Boolean).join(" · ")]);
    if (o.mag != null) d.details.push([t.dMagnitude, `${num(o.mag, lang, 1)} · ${t.magHint}`]);
    say(null, t.deepWhat[o.type]);
    const reach = magReach(o.mag); if (reach) say(null, t.reach[reach], t.reachHint);
    d.details.push([t.dSource, t.srcMessier]);
    d.distNote = t.distPublished;
  } else if (L === "galaxies") {
    d.type = t.typeGalaxy + ((es ? o.const_es : o.const) ? ` · ${t.inConst(es ? o.const_es : o.const)}` : "");
    d.visual = "galaxy";
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    if (o.cat && o.cat !== o.name) d.details.push([t.dCatalog, o.cat.replace(/^(NGC|IC)0*/, "$1 ")]);
    const fam = hubbleFamily(o.hubble);
    if (o.hubble) d.details.push([t.dHubble, fam ? `${o.hubble} · ${t.hubble[fam]}` : o.hubble]);
    if (fam) say(null, t.galaxyKind(t.hubble[fam]));
    const reach = magReach(o.mag); if (reach) say(null, t.reach[reach], t.reachHint);
    if (o.mag != null) d.details.push([t.dMagnitude, `${num(o.mag, lang, 1)} · ${t.magHint}`]);
    d.details.push([t.dSource, t.srcGalaxy]);
    d.distNote = t.distRedshift;
  } else if (L === "blackholes") {
    d.type = `${t.typeBlackHole} ${es ? o.kind : (BH_KIND_EN[o.kind] || o.kind)}`.trim();
    d.visual = "blackhole";
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    d.note = noteIn(o.note, lang); d.note = d.note ? d.note.charAt(0).toUpperCase() + d.note.slice(1) + "." : "";
    if (o.mass_sun) {
      say(null, t.bhMass(fmtSuns(o.mass_sun, lang)));
      d.details.push([t.dMass, `${fmtMassSun(o.mass_sun, lang)} (${t.approx})`]);
      // radio de Schwarzschild: física pura a partir de la masa publicada
      const rs = schwarzschildKm(o.mass_sun), band = bhSizeBand(rs);
      if (band) {
        const size = band.key === "beyond" ? t.bhSize.beyond(num(band.x, lang, band.x < 10 ? 1 : 0)) : t.bhSize[band.key];
        say(null, `${t.bhRadius(fmtKm(rs, lang))}: ${size}`, t.bhCalc);
        d.details.push([t.dHorizon, `${fmtKm(rs, lang)} · ${t.bhCalc}`]);
      }
    }
    d.details.push([t.dSource, t.srcBlackHole]);
    d.distNote = t.distPublished;
  } else if (L === "pulsars") {
    d.type = t.typePulsar; d.visual = "pulsar";
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    const spin = pulsarSpin(o.period_ms);
    if (spin) {
      const n = spin.perSec;
      const head = n >= 1 ? t.pulsarSpin(num(n, lang, n < 10 ? 1 : 0)) : t.pulsarSlow(num(o.period_ms / 1000, lang, 2));
      d.note = `${head}: ${t.pulsarBand[spin.band]}`;
      say(null, t.pulsarBeam);
      d.details.push([t.dPeriod, `${num(o.period_ms, lang, 2)} ms`]);
    }
    if (o.note) {
      // cada etiqueta del catálogo (milisegundo, binario…) se explica en una frase
      for (const k of o.note.split(",").map((x) => x.trim())) if (t.pulsarKinds[k]) say(null, t.pulsarKinds[k].charAt(0).toUpperCase() + t.pulsarKinds[k].slice(1) + ".");
      d.details.push([t.dKind, noteIn(o.note, lang)]);
    }
    d.details.push([t.dSource, t.srcPulsar]);
    d.distNote = t.distPublished;
  } else if (L === "meteors") {
    d.name = es ? o.name : (o.name_en || o.name);
    d.type = t.typeMeteor; d.visual = "meteor";
    if (meteorActive) d.badge = t.activeNow;
    d.facts.push({ label: t.fPeak, value: fmtMD(o.peak, lang) });
    d.facts.push({ label: t.fActive, value: `${fmtMD(o.start, lang)} – ${fmtMD(o.end, lang)}` });
    d.facts.push({ label: t.fRate, value: t.perHour(o.zhr), hint: t.zhrHint });
    d.note = t.radiantNote;
    if (o.parent) { say(null, t.meteorParent(o.parent)); d.details.push([t.dParent, o.parent]); }
    d.details.push([t.dSource, t.srcMeteor]);
  } else if (L === "comets" || L === "probes") {
    d.type = L === "comets" ? t.typeComet : t.typeProbe; d.visual = L === "comets" ? "comet" : "probe";
    const km = o.dist_km != null ? o.dist_km : (o.dist_au != null ? o.dist_au * AU_KM : null);
    if (km != null) nearFacts(km, o.dist_au);
    if (L === "comets") d.note = o.approaching ? t.approaching : t.receding;
    else {
      // nota corta + estado de la misión en el idioma activo (campos opcionales del backend)
      const note = (es ? o.note_es : o.note_en) || "", status = (es ? o.status_note : o.status_note_en) || "";
      const cap1 = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : "");
      d.note = [note && cap1(note) + (/[.!?]$/.test(note) ? "" : "."), status].filter(Boolean).join(" ");
      const line = t.probeLine(o.agency, o.launched);
      if (line) d.type = `${d.type} · ${line}`;
      if (o.agency) d.details.push([t.fAgency, o.agency]);
      if (o.launched) d.details.push([t.fLaunched, String(o.launched)]);
      const tgt = o.target && (t.targetName[o.target] || String(o.target).replace(/_/g, " "));
      if (tgt) d.details.push([t.fTarget, tgt + (o.phase && t.phaseName[o.phase] ? ` · ${t.phaseName[o.phase]}` : "")]);
    }
    // señal de radio: distancia real de hoy ÷ velocidad de la luz
    const sig = signalDelay(km);
    if (sig) {
      if (L === "probes") say(t.sigTitle, `${t.sigLine(fmtDuration(sig.oneWay, lang), fmtDuration(sig.roundTrip, lang))} ${t.sigBand[sig.band]}`, t.sigHint);
      else say(t.sigTitleComet, t.sigComet(fmtDuration(sig.oneWay, lang)), t.sigHint);
    }
    if (o.sun_dist_km > 0) d.details.push([t.dSunDist, `${fmtKm(o.sun_dist_km, lang)}${o.sun_dist_au >= 0.1 ? ` · ${num(o.sun_dist_au, lang, 2)} ${t.au}` : ""}`]);
    if (o.epoch) d.details.push([t.dEpoch, String(o.epoch).replace("T", " ").replace("Z", " UTC")]);
    d.details.push([t.dSource, t.srcHorizons]);
    d.distNote = t.horizonsNote + (o._stale ? " " + t.staleNote : "");
  } else if (L === "exoplanets") {
    const cls = exoClass(o.rade);
    d.type = [t.typeExoplanet, cls && t.exoClassShort[cls], o.host && t.orbits(o.host)].filter(Boolean).join(" · ");
    d.visual = "exoplanet";
    d.badge = o.hab ? t.habitable : null;
    if (o.dist_ly > 0) lightFacts(o.dist_ly);
    if (o.rade > 0) {
      say(t.exoSizeTitle, t.exoSize(o.rade) + (o.rade >= 4 ? t.exoSizeJup(o.rade / JUPITER_RE) : "") + " " + t.exoClass[cls]);
      d.details.push([t.dRadius, `${num(o.rade, lang, 2)} ${t.earthRadii}`]);
    }
    if (o.mass_e > 0) {
      say(t.exoMassTitle, t.exoMass(o.mass_e) + (o.mass_e >= 30 ? t.exoMassJup(o.mass_e / JUPITER_ME) : ""));
      d.details.push([t.dMass, `${num(o.mass_e, lang, 2)} ${t.earthMasses}`]);
    }
    if (o.period_d > 0) {
      say(t.exoYearTitle, t.exoYear(fmtDuration(o.period_d * 86400, lang)) + t.exoYearCmp(o.period_d));
      d.details.push([t.dYear, `${num(o.period_d, lang, 2)} ${lang === "es" ? "días" : "days"}`]);
    }
    if (o.eqt_k > 0) {
      const c = Math.round(o.eqt_k - 273.15);
      say(t.exoTempTitle, `${t.exoTemp(num(c, lang).replace("-", "−"))} ${t.exoTempBand[tempBand(c)]}`, t.exoTempHint);
      d.details.push([t.dTemp, `${num(o.eqt_k, lang)} K (${num(c, lang).replace("-", "−")} °C)`]);
    }
    if (!(o.rade > 0) && !(o.mass_e > 0) && !(o.period_d > 0) && !(o.eqt_k > 0)) say(null, t.exoNoData);
    if (o.disc_year || o.method) {
      const mk = methodKey(o.method);
      say(t.exoFoundTitle, t.exoFound(o.disc_year, o.method ? (mk ? t.methodName[mk] : o.method) : null) + (mk ? " " + t.methodHow[mk] : ""));
      d.details.push([t.dDiscovered, [o.disc_year, o.method].filter(Boolean).join(" · ")]);
    }
    if (o.host) {
      const sc = starClass(o.spectype);
      const desc = sc && (sc.lum === "giant" ? t.starColor[sc.letter] : t.starLetter[sc.letter]);
      say(t.exoStarTitle, t.exoStar(o.host) + (desc ? t.starTypeIs(sc.letter, desc) + (sc.lum ? t.starLum[sc.lum] : "") : "."));
      d.details.push([t.dHost, o.host + (o.spectype ? ` (${o.spectype})` : "")]);
    }
    say(t.exoHabTitle, o.hab ? t.exoHabYes : t.exoHabNo);
    d.details.push([t.dSource, t.srcExo]);
    d.distNote = t.exoDataNote;
  } else if (L === "note") {
    // explicación de un patrón del cielo: las cifras se cuentan en los datos cargados
    const id = o.note;
    d.name = t.noteTitle[id]; d.type = t.noteType[id]; d.visual = "note";
    const pct = 100 * o.n / o.total;
    d.facts.push({ label: t.noteCount[id], value: t.noteNOf(o.n, o.total), hint: t.noteWhat[id] });
    const pc = es ? " %" : "%";
    d.facts.push({ label: t.noteShare, value: `${num(pct, lang, pct < 10 ? 1 : 0)}${pc}` });
    d.facts.push({ label: t.noteSky, value: `≈ ${num(NOTE_SKY_PCT[id], lang, 1)}${pc}`, hint: t.noteSkyHint });
    d.note = t.noteBody[id];
    d.distNote = t.noteSource[id];
  }
  return d;
}

// Visual principal: modelo 3D (sistema solar), imagen de Wikipedia (si existe) o
// una representación esquemática claramente etiquetada. Nunca se inventan fotos.
function Visual({ obj, info, t, lang, wiki, wikiState, credit }) {
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
  if (info.visual === "exoplanet") {
    const sized = obj.rade > 0;
    return (
      <figure className="sk-visual is-exo" role="img" aria-label={t.exoFigAria(obj.name)}>
        <div className="sk-visual-stage"><ExoCompare obj={obj} t={t} /></div>
        <figcaption><b>{sized ? t.exoCap : t.exoCapNoSize}</b>{sized && <span>{obj.eqt_k > 0 ? t.exoCapTone : t.exoCapNoTone}</span>}</figcaption>
      </figure>
    );
  }
  if (info.visual === "note") {
    return (
      <figure className="sk-visual is-illus">
        <div className="sk-visual-stage"><NoteArt id={obj.note} /></div>
        <figcaption><b>{obj.note === "kepler" ? t.capKepler : t.capNote}</b></figcaption>
      </figure>
    );
  }
  const hasPhoto = wiki && wiki.thumb && !imgFail;
  if (hasPhoto) {
    const mixed = obj.layer === "star" || obj.layer === "pulsars" || obj.layer === "blackholes" || obj.layer === "exoplanets";
    const who = credit && [credit.artist, credit.license].filter(Boolean).join(" · ");
    return (
      <figure className="sk-visual is-photo">
        <div className={`sk-visual-stage${imgOk ? " is-loaded" : ""}`}>
          {!imgOk && <i className="sk-skeleton" aria-hidden="true" />}
          <img src={wiki.thumb} alt={t.imgAlt(info.name)} onLoad={() => setImgOk(true)} onError={() => setImgFail(true)} />
        </div>
        <figcaption>
          <b>{who ? `${t.capImgBy(who)} · ${t.capImgCommons}` : mixed ? t.capWikiMixed : t.capWiki}</b>
          {who && mixed && <span>{t.capWikiMixed}</span>}
          {wiki.imgLang && wiki.imgLang !== lang && <span>{t.capImgOtherLang}</span>}
          <a href={(credit && credit.page) || wiki.imgUrl || wiki.url} target="_blank" rel="noopener noreferrer">{t.capLicense}</a>
        </figcaption>
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
  // sin imagen: representación propia del tipo de objeto, siempre rotulada
  const kind = artKind(obj);
  return (
    <figure className="sk-visual is-illus">
      <div className="sk-visual-stage"><ArtCanvas kind={kind} obj={obj} label={t.artAria(info.name)} /></div>
      <figcaption>
        <b>{t.capRep[kind] || t.capSchematic}</b>
        {kind !== "star" && wikiState === "done" && <span>{t.capNoPhoto}</span>}
      </figcaption>
    </figure>
  );
}

// Representación esquemática en <canvas> (src/sky/art.js), nítida a la densidad de la pantalla.
export function ArtCanvas({ kind, obj, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return undefined;
    const paint = () => {
      const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawArt(x, kind, 0, 0, w, h, artOptions(obj));
    };
    paint();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(paint) : null;
    if (ro) ro.observe(c);
    return () => { if (ro) ro.disconnect(); };
  }, [kind, obj.name, obj.hex, obj.hubble, obj.rade, obj.eqt_k]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="sk-art" role="img" aria-label={label} />;
}

// ── salida, culminación y puesta desde "Mi cielo" ───────────────────────────
const bodyDirAt = (name) => (d) => { const b = ephemeris(d).find((x) => x.name === name); return [b.nx, b.ny, b.nz]; };
const sunDirAt = bodyDirAt("Sol");
/** Cálculo para la ficha: { rts, best, now } o null si el objeto no tiene dirección. */
export function visibilityOf(obj, local, when) {
  if (!obj || obj.nx == null || !local) return null;
  const solar = obj.layer === "solar";
  const dirAt = solar ? bodyDirAt(obj.name) : () => [obj.nx, obj.ny, obj.nz];
  const minAlt = horizonFor(solar && obj.name === "Sol" ? "sun" : solar && obj.name === "Luna" ? "moon" : "star");
  const rts = riseTransitSet(dirAt, local.lat, local.lon, when, { minAlt });
  const d0 = dirAt(when), now = altAz(d0[0], d0[1], d0[2], local.lat, local.lon, when);
  const isSun = solar && obj.name === "Sol";
  // estrellas débiles y cielo profundo piden cielo oscuro (−12°); la Luna y los planetas ya se ven con −6°
  const best = isSun ? null : bestTonight(dirAt, sunDirAt, local.lat, local.lon, when, { sunLimit: solar ? -6 : -12 });
  return { rts, best, now, isSun };
}
export function RiseSet({ obj, t, lang, local, when, onNeedPlace }) {
  // el cálculo se rehace por minuto, no por render
  const minute = Math.floor(when.getTime() / 60000);
  const vis = useMemo(() => (local ? visibilityOf(obj, local, new Date(minute * 60000)) : null),
    [obj.name, obj.layer, obj.nx, obj.ny, obj.nz, local && local.lat, local && local.lon, minute]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (obj.nx == null || obj.layer === "note") return null;
  if (!local) {
    return (
      <div className="sk-rs is-off">
        <p>{t.rsNeedPlace}</p>
        <button type="button" className="sk-btn" onClick={onNeedPlace}><Icon name="pin" size={16} />{t.rsActivate}</button>
      </div>
    );
  }
  if (!vis) return null;
  const loc = lang === "es" ? "es-EC" : "en-US";
  const hm = (d) => d.toLocaleTimeString(loc, lang === "es" ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { hour: "numeric", minute: "2-digit" });
  // si el instante cae en otro día que el de referencia, se dice cuál
  const dayOf = (d) => (d.toDateString() === when.toDateString() ? "" : t.rsDay(d.toLocaleDateString(loc, { weekday: "short", day: "numeric" })));
  const { rts, best, now, isSun } = vis;
  // si los tres instantes caen en el mismo día (distinto de hoy), el día se dice una sola vez
  const evs = [rts.rise, rts.transit, rts.set].filter(Boolean).map((x) => dayOf(x.date));
  const oneDay = evs.length > 0 && evs.every((d) => d === evs[0]) ? evs[0] : null;
  const at = (x) => (x ? hm(x.date) + (oneDay != null ? "" : dayOf(x.date)) : null);
  const tDay = rts.transit && oneDay == null ? dayOf(rts.transit.date) : "";
  const main = rts.state === "never" ? t.rsNever
    : rts.state === "always" ? t.rsAlways(hm(rts.transit.date), Math.round(rts.transit.alt), dayOf(rts.transit.date))
    : t.rsLine(at(rts.rise), rts.transit ? hm(rts.transit.date) : null, rts.transit ? Math.round(rts.transit.alt) : null, at(rts.set), tDay) + (oneDay || "");
  let bestLine = null;
  if (isSun) bestLine = t.rsSun;
  else if (best) {
    if (best.ok) bestLine = Math.abs(best.date.getTime() - when.getTime()) < 6 * 60000 ? t.rsBestNow(Math.round(best.alt)) : t.rsBest(hm(best.date) + dayOf(best.date), Math.round(best.alt));
    else if (best.reason === "daylight") bestLine = rts.state === "never" ? null : t.rsDaylight;
    else if (best.reason === "gone") bestLine = t.rsGone;
    else if (best.reason === "low") bestLine = t.rsLow(Math.ceil(best.alt));
    else if (best.reason === "nonight") bestLine = t.rsNoNight;
  }
  return (
    <section className="sk-rs" aria-label={t.rsTitle(local.place)}>
      <h3><Icon name="pin" size={15} />{t.rsTitle(local.place)}</h3>
      <p className="sk-rs-main">{main}</p>
      <p>{now.alt > 0 ? t.rsUp(Math.round(now.alt), compassPoint8(now.az)) : t.rsDown}{bestLine ? " " + bestLine : ""}</p>
      <small>{t.rsHint}</small>
    </section>
  );
}

// ── "Participa": ciencia ciudadana relacionada (src/sky/citizen.js) ─────────
export function Citizen({ obj, t, lang, local }) {
  const list = citizenFor(obj, local);
  if (!list.length) return null;
  return (
    <section className="sk-join" aria-label={t.joinTitle}>
      <h3>{t.joinTitle}</h3>
      <ul>
        {list.map((p) => (
          <li key={p.id}>
            <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={t.joinOpen(p.name)}><b>{p.name}</b> <span>{p.org}</span></a>
            <p>{p[lang] || p.es}</p>
            <small>{t.joinNeeds[p.needs]}</small>
          </li>
        ))}
      </ul>
      <small className="sk-join-foot">{t.joinVerified(CITIZEN_VERIFIED)}</small>
    </section>
  );
}

// ── armazón de la ficha (hoja inferior deslizable en móvil, panel lateral en escritorio) ──
// Es un diálogo no modal: el cielo sigue usable detrás. Al abrirse lleva el foco a su
// título (los lectores de pantalla lo anuncian) y al cerrarse lo devuelve a donde estaba.
export function SheetShell({ t, title, subtitle, badge, resetKey, onClose, children, className = "" }) {
  const [mode, setMode] = useState("peek");           // móvil: "peek" (media altura) | "full"
  const [dragY, setDragY] = useState(0);
  const startRef = useRef(null);
  const bodyRef = useRef(null);
  const boxRef = useRef(null);
  useEffect(() => { setMode("peek"); if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [resetKey]);
  useDialogFocus(boxRef, { trap: false });
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
  return (
    <section ref={boxRef} className={`sk-sheet is-${mode}${dragY ? " is-dragging" : ""} ${className}`} role="dialog" aria-labelledby="sk-sheet-title"
      style={dragY ? { "--drag": `${dragY}px` } : undefined}>
      <button type="button" className="sk-grab" aria-label={mode === "peek" ? t.sheetExpand : t.sheetCollapse} aria-expanded={mode === "full"}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMode((m) => (m === "peek" ? "full" : "peek")); } }}>
        <i />
      </button>
      <header className="sk-sheet-head">
        <div>
          <h2 id="sk-sheet-title" tabIndex={-1}>{title}</h2>
          <p className="sk-type">{subtitle}{badge && <em>{badge}</em>}</p>
        </div>
        <button type="button" className="sk-iconbtn" onClick={onClose} aria-label={t.closeSheet}><Icon name="close" size={18} /></button>
      </header>
      <div className="sk-sheet-body" ref={bodyRef}>{children}</div>
    </section>
  );
}

export default function ObjectSheet({ obj, lang, t, wiki, wikiState, credit, meteorActive, onClose, onShare, onViewFrom, onCenter, canViewFrom, onFind, findAria, local, when, onNeedPlace }) {
  const info = describeObject(obj, lang, t, meteorActive);
  // exoplanetas: si Wikipedia solo tiene la página de la estrella, su texto no describe al planeta
  const wikiFits = obj.layer !== "exoplanets" || (wiki && wiki.title && wiki.title.toLowerCase().includes(String(obj.name).toLowerCase()));
  const isNote = obj.layer === "note";
  const extract = wiki && wiki.extract && wikiFits ? (wiki.extract.length > 340 ? wiki.extract.slice(0, 340).replace(/\s+\S*$/, "") + "…" : wiki.extract) : "";

  return (
    <SheetShell t={t} title={info.name} subtitle={info.type} badge={info.badge} resetKey={`${obj.layer}|${obj.name}|${obj.note || ""}`} onClose={onClose}>
        <Visual obj={obj} info={info} t={t} lang={lang} wiki={wiki} wikiState={wikiState} credit={credit} />
        {info.facts.length > 0 && (
          <dl className="sk-facts">
            {info.facts.map((f) => (
              <div key={f.label}><dt>{f.label}</dt><dd>{f.value}{f.hint && <small>{f.hint}</small>}</dd></div>
            ))}
          </dl>
        )}
        {info.note && <p className="sk-note">{info.note}</p>}
        {!isNote && <RiseSet obj={obj} t={t} lang={lang} local={local} when={when} onNeedPlace={onNeedPlace} />}
        {info.explain.length > 0 && (
          <ul className="sk-explain">
            {info.explain.map((e, i) => (
              <li key={i}>{e.title && <b>{e.title}</b>}<span>{e.text}</span>{e.hint && <small>{e.hint}</small>}</li>
            ))}
          </ul>
        )}
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
          {onFind && (
            <button type="button" className="sk-btn wide sk-find-btn" onClick={onFind} aria-label={findAria}><Icon name="point" size={18} />{t.findIt}</button>
          )}
          {!isNote && <button type="button" className="sk-btn" onClick={onShare}><Icon name="share" size={17} />{t.share}</button>}
          <button type="button" className="sk-btn" onClick={onCenter}><Icon name="target" size={17} />{t.center}</button>
        </div>
        {!isNote && <Citizen obj={obj} t={t} lang={lang} local={!!local} />}
    </SheetShell>
  );
}
