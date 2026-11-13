// describe.js — convierte el objeto seleccionado en lo que muestra la ficha (función pura,
// sin React ni DOM): la usan ObjectSheet.jsx, la postal y las pruebas de Node.
import { BODIES, bodyName } from "./bodies.js";
import { fmtDist, fmtYears, fmtDuration, fmtKm, fmtMassSun, fmtSuns, num, AU_KM, LIGHT_KM_S, VOYAGER_KM_S, LY_KM, SEC_PER_YEAR } from "./format.js";
import { starTemperature, parseSpect } from "./starColor.js";
import { exoClass, tempBand, methodKey, starClass, schwarzschildKm, bhSizeBand, pulsarSpin, hubbleFamily, magReach, JUPITER_RE, JUPITER_ME } from "./explain.js";
import { signalDelay } from "./riseset.js";

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
    // temperatura: SOLO si el catálogo trae B−V; siempre marcada como estimación (src/sky/starColor.js)
    const tm = starTemperature(o.bv);
    if (tm && tm.temp != null) {
      say(t.tempTitle, tm.lowerBound ? t.tempLower(tm.temp, t.starHueF[tm.hue]) : t.tempLine(tm.temp, t.tempVs[tm.vsSun], t.starHueF[tm.hue]), t.tempHint);
      d.details.push([t.dTemp, `${t.dTempVal(tm.temp, tm.lowerBound)} · ${t.dTempRatio(tm.ratio)}`]);
    } else if (tm) say(t.tempTitle, t.tempOut(tm.bv), t.tempHint);
    else {
      const hue = starHue(o.hex); if (hue) say(null, t.starColorLine(t.starHue[hue]));
      if (o.bv === null) say(null, t.tempNone);
    }
    const sp = parseSpect(o.spect);
    if (sp && t.spectLetter[sp.letter]) {
      const lum = sp.lum ? (sp.lum2 ? t.spectLumRange(sp.lum, sp.lum2) : t.spectLum[sp.lum]) : "";
      say(t.spectTitle, t.spectLine(sp.raw, sp.letter, t.spectLetter[sp.letter], lum) + (sp.composite ? t.spectComposite : ""), t.spectSeq);
    }
    if (tm) d.details.push([t.dBv, num(tm.bv, lang, 3)]);
    if (o.spect) d.details.push([t.dSpect, o.spect]);
    d.details.push([t.dSource, tm ? t.srcStarTemp : t.srcStar]);
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

