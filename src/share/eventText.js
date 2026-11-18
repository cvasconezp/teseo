// eventText.js — textos, cuadrícula de datos y plan del visual de las imágenes para compartir de «Ahora»
// (eventos del Calendario del cielo, el Sol de hoy, lanzamientos, asteroides y naves rumbo a Marte).
//
// PURO (sin DOM): se prueba en Node con scripts/test_now_share.mjs. Lo dibuja src/share/card.js con el
// mismo lenguaje visual que la postal del Cielo (src/sky/postcard.js).
//
// Reglas:
//  · cada casilla es un dato que el evento YA trae o que la app YA calcula (efemérides de Teseo,
//    visibilidad, catálogos citados); si un dato no existe, su casilla no aparece;
//  · nunca se escriben coordenadas del lugar (la imagen se comparte): solo su nombre o «tu ubicación»;
//  · todo visual lleva su rótulo honesto: «Foto: …», «Representación de Teseo…» o «Simulación con datos de…».
//  · «la IA narra, nunca calcula»: aquí no hay IA; frases fijas con números calculados.
import { ephemeris } from "../ephemeris.js";
import { skyBodies, dateToJ2000, j2000ToDate, AU_KM } from "../sky/frames.js";
import { visibilityOf } from "../sky/objVisibility.js";
import { altAz } from "../sky/guide.js";
import { compassPoint8 } from "../sky/deviceOrientation.js";
import { altAzToEquatorial } from "../sky/issSky.js";
import { nasaImageFor, nasaKindKey } from "../sky/nasaImages.js";
import { BODIES } from "../sky/bodies.js";
import { asteroidSize, passDistance, spacecraftDistances, signalSeconds, splitSeconds, launchStatus, netPrecision, orbitKey } from "../now/math.js";
import { flareInfo, kpInfo, splitRegions } from "../sun/sun.js";
import { describeEvent } from "../now/calendar/i18n.js";
import { TE, cardFileName } from "./i18n.js";

export { TE, cardFileName };

const DAY = 86400000, HOUR = 3600000, MIN = 60000;
export const NOW_SHARE_KINDS = ["moon", "eclipse", "meteor", "planet", "season", "milestone", "iss", "launch", "sun", "asteroid", "mars"];
/** Zona horaria de los atajos de lugar del Cielo (Quito, Cayambe, Guayaquil, Cuenca: todos en Ecuador continental). */
export const PRESET_TZ = "America/Guayaquil";

// índice de compassPoint8 (0 = N, 1 = NE … 7 = NO) → nombre
const DIRS = {
  es: ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"],
  en: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"],
};
const PL_EN = { Sol: "Sun", Luna: "Moon", Mercurio: "Mercury", Venus: "Venus", Marte: "Mars", "Júpiter": "Jupiter", Saturno: "Saturn", Urano: "Uranus", Neptuno: "Neptune" };

// ─── Formato ─────────────────────────────────────────────────────────────────
const loc = (lang) => (lang === "es" ? "es-EC" : "en-US");
/** Desfase UTC de una zona en un instante: "UTC−5", "UTC+5:30", "UTC". Puro. */
export function utcOffsetLabel(ms, tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(ms));
    const g = (k) => Number((parts.find((p) => p.type === k) || {}).value);
    const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second"));
    const off = Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MIN);
    if (!off) return "UTC";
    const a = Math.abs(off), h = Math.floor(a / 60), m = a % 60;
    return `UTC${off < 0 ? "−" : "+"}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
  } catch { return ""; }
}
/** Formateadores con zona horaria (tz undefined = la del dispositivo). */
export function cardFmt(lang, tz, refNow = Date.now()) {
  const l = loc(lang), nl = lang === "es" ? "es" : "en-US", z = tz ? { timeZone: tz } : {};
  const yearOf = (ms) => new Date(ms).getUTCFullYear();
  // el año solo cuando no es el de la fecha de referencia (al crear la imagen)
  const sameYear = (ms) => yearOf(ms) === yearOf(refNow);
  return {
    tz,
    date: (ms) => new Date(ms).toLocaleDateString(l, { weekday: "short", day: "numeric", month: "short", ...(sameYear(ms) ? {} : { year: "numeric" }), ...z }),
    dateShort: (ms) => new Date(ms).toLocaleDateString(l, { day: "numeric", month: "short", ...z }),
    dateUtc: (ms) => new Date(ms).toLocaleDateString(l, { weekday: "short", day: "numeric", month: "short", ...(sameYear(ms) ? {} : { year: "numeric" }), timeZone: "UTC" }),
    time: (ms) => new Date(ms).toLocaleTimeString(l, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...z }),
    month: (ms) => new Date(ms).toLocaleDateString(l, { month: "long", year: "numeric", ...z }),
    n: (x, dec = 0) => Number(x).toLocaleString(nl, { maximumFractionDigits: dec, minimumFractionDigits: dec }),
    year: yearOf,
  };
}
/** Signo menos tipográfico para magnitudes. */
const signed = (f, x, dec = 1) => (x < 0 ? "−" + f.n(-x, dec) : f.n(x, dec));
function kmText(km, f, T) {
  if (km >= 1e6) { const m = km / 1e6; return T.mkm(f.n(m, m < 100 ? 1 : 0)); }
  const step = km >= 1e5 ? 1000 : km >= 1e4 ? 100 : 10;
  return T.km(f.n(Math.round(km / step) * step));
}
function sigText(sec, f, lang) {
  if (sec < 60) return `${f.n(sec, 1)} s`;
  const { h, m, s } = splitSeconds(sec);
  return h ? `${h} h ${m} min` : `${m} min ${s} s`;
}

/**
 * Lugar para los textos: { name, tz, zone } — nunca coordenadas. `place` = readPlace() del calendario
 * ({ lat, lon, elev, kind: "preset" | "me" | "custom", name }).
 */
export function placeInfo(place, lang) {
  const T = TE[lang] || TE.es;
  if (!place) return { name: T.placeCustom, tz: undefined, zone: T.gWhenDevice, lat: null, lon: null, elev: 0 };
  const preset = place.kind === "preset" && place.name;
  const name = preset ? place.name : place.kind === "me" ? T.placeMe : T.placeCustom;
  return { name, tz: preset ? PRESET_TZ : undefined, zone: preset ? T.gWhenTz(place.name) : T.gWhenDevice, lat: place.lat, lon: place.lon, elev: place.elev || 0 };
}

/** «Cuánto falta» al crear la imagen: { label, value, sub }. */
export function untilCell(ms, now, lang, f, { days = false } = {}) {
  const T = TE[lang] || TE.es, d = ms - now, a = Math.abs(d);
  let value;
  if (days || a >= 48 * HOUR) value = T.unit.d(Math.max(days ? 0 : 1, Math.round(a / DAY)));
  else if (a >= 90 * MIN) value = T.unit.h(Math.round(a / HOUR));
  else value = T.unit.min(Math.max(1, Math.round(a / MIN)));
  if (days && Math.round(a / DAY) === 0) value = lang === "es" ? "Es hoy" : "It's today";
  return { label: d < 0 && !(days && Math.round(a / DAY) === 0) ? T.gAgo : T.gUntil, value, sub: T.gUntilSub(f.dateShort(now)), kind: "data" };
}

/** Primeras frases de un texto que quepan en `max` caracteres (nunca corta una frase). */
export function firstSentences(text, max = 150) {
  const parts = String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
  let out = "";
  for (const p of parts) { const n = out ? out + " " + p : p; if (n.length > max) break; out = n; }
  return out || null;
}

// ─── Cálculos que la app ya hace (efemérides, visibilidad) ──────────────────
const bodyAt = (name, ms) => { try { return ephemeris(new Date(ms)).find((b) => b.name === name) || null; } catch { return null; } };
/** Dirección J2000 (topocéntrica si hay lugar) de un cuerpo en un instante, como la escena del Cielo. */
export function bodyDir(name, ms, pl) {
  try {
    const d = new Date(ms), list = skyBodies(ephemeris(d), d, pl && pl.lat != null ? { lat: pl.lat, lon: pl.lon, elev: pl.elev || 0 } : null);
    const b = list.find((x) => x.name === name);
    return b ? [b.nx, b.ny, b.nz] : null;
  } catch { return null; }
}
/** Casilla de altura/dirección desde el lugar en un instante (para Sol, Luna y planetas). */
function localBodyCell(name, ms, pl, T, f, lang) {
  if (!pl || pl.lat == null) return null;
  const dir = bodyDir(name, ms, pl);
  if (!dir) return null;
  let vis = null;
  try { vis = visibilityOf({ layer: "solar", name, nx: dir[0], ny: dir[1], nz: dir[2] }, { lat: pl.lat, lon: pl.lon, elev: pl.elev || 0 }, new Date(ms)); } catch { vis = null; }
  if (!vis || !vis.now) return null;
  const dirName = (DIRS[lang] || DIRS.es)[compassPoint8(vis.now.az)];
  if (vis.now.alt > 0) return { label: T.gFrom(pl.name), value: `${Math.round(vis.now.alt)}°`, sub: T.gToward(dirName), kind: "local" };
  const r = vis.rts, rise = r && r.rise && r.rise.date ? T.gRises(f.time(+r.rise.date)) : null;
  return { label: T.gFrom(pl.name), value: T.gBelow, sub: rise, kind: "local" };
}
const altAzAt = (v, pl, ms) => altAz(v[0], v[1], v[2], pl.lat, pl.lon, new Date(ms));

// ─── Por tipo ────────────────────────────────────────────────────────────────
/**
 * Textos y plan del visual de una imagen de «Ahora».
 * @param spec  { kind, ev?, info?, launch?, sun?, rock?, craft? } — ver NowShare.jsx
 * @param lang  "es" | "en"
 * @param place readPlace() del calendario (o null)
 * @param now   ms al crear la imagen
 * @returns {{ kind, title, type, grid: [{label,value,sub,kind}], curio, where, credit, visual, sky }}
 *   visual = { type, label, … } (qué dibuja card.js y su rótulo honesto)
 *   sky    = { date, center: [J2000] | null, zenith: bool, reticle: bool, allSky?: bool, zoom?: number, local: bool }
 */
export function eventCardText(spec, lang = "es", place = null, now = Date.now()) {
  const T = TE[lang] || TE.es, es = lang === "es";
  const pl = placeInfo(place, lang), f = cardFmt(lang, pl.tz, now);
  const kind = spec.kind;
  const grid = [];
  // p = prioridad (1 esencial … 3 prescindible): si la imagen no cabe, card.js quita primero las de p más alto
  const add = (label, value, sub, k = "data", p = 2) => { if (label && value != null && String(value).trim() && String(value).trim() !== "—") grid.push({ label, value: String(value).trim(), sub: sub ? String(sub) : null, kind: k, p }); };
  const push = (c, p = 2) => { if (c) grid.push({ ...c, p }); };
  const whenCell = (ms, sub) => add(T.gWhen, `${f.date(ms)} · ${f.time(ms)}`, sub || `${pl.zone}${pl.tz ? ` (${utcOffsetLabel(ms, pl.tz)})` : ""}`);
  // el lugar ya va en las casillas («hora de Quito», «Desde Quito»): no hace falta otra línea
  const where = null;
  let out = { kind, title: "", type: "", curio: null, where, credit: "", visual: null, sky: { date: now, center: null, zenith: true, reticle: false, local: pl.lat != null } };
  const ev = spec.ev, d = ev ? ev.data : null;
  // los textos del calendario, rehechos con la zona horaria del lugar (las horas coinciden con las casillas)
  let info = spec.info || {};
  if (ev) { try { info = describeEvent(ev, lang, { time: f.time, n: f.n, pct: (x) => `${Math.round(x * 100)}${es ? " %" : "%"}`, mag: es ? "magnitud" : "magnitude" }); } catch { /* se queda con spec.info */ } }
  const planetCredit = (key) => { const b = BODIES[key]; return T.texCredit[(b && b.credit) || "sss"] || T.texCredit.sss; };

  switch (kind) {
    case "moon": {
      const m = bodyAt("Luna", ev.t);
      out.title = info.title; out.type = T.type.moon;
      whenCell(ev.t); push(untilCell(ev.t, now, lang, f));
      if (m && m.illum != null) add(T.gIllum, `${Math.round(m.illum * 100)}${es ? " %" : "%"}`, T.gIllumSub(!!m.waxing));
      if (m && m.dist_km) add(T.gMoonDist, kmText(m.dist_km, f, T), T.gCenter, "data", 3);
      push(localBodyCell("Luna", ev.t, pl, T, f, lang));
      out.curio = firstSentences(info.what, 150);
      out.credit = T.pcData(T.src.moon);
      out.visual = { type: "moon", label: T.lblMoon, phase: m ? { illum: m.illum, waxing: !!m.waxing } : null };
      out.sky = { date: ev.t, center: bodyDir("Luna", ev.t, pl), zenith: false, reticle: true, local: pl.lat != null };
      break;
    }
    case "eclipse": {
      out.title = info.title;
      whenCell(ev.t); push(untilCell(ev.t, now, lang, f));
      if (ev.sub === "moon") {
        out.type = T.type.eclipseMoon;
        add(T.gKind, T.kindName[d.type] || d.type, T.gMagNasa(signed(f, d.mag, 3)));
        if (d.totMin > 0) add(T.gTotality, T.gMinutes(d.totMin), null, "data", 1); else if (d.umbMin > 0) add(T.gPartial, T.gMinutes(d.umbMin), null, "data", 1);
        if (d.vis && pl.lat != null) {
          const a = Math.round(d.vis.altMax);
          add(T.gFrom(pl.name), d.vis.state === "yes" ? T.gVisYes : d.vis.state === "partial" ? T.gVisPartial : T.gVisNo, a > 0 ? T.gMoonAtMax(a) : T.gMoonBelowMax(a < 0 ? `−${-a}` : String(a)), "local");
        }
        out.curio = firstSentences(info.what, 150);
        out.visual = { type: "eclipse-moon", label: T.lblMoonEclipse(d.type), eclipse: d.type, mag: d.mag };
        out.sky = { date: ev.t, center: bodyDir("Luna", ev.t, pl), zenith: false, reticle: true, local: pl.lat != null };
      } else {
        out.type = T.type.eclipseSun;
        add(T.gKind, T.kindName[d.type] || d.type, T.gMagNasa(signed(f, d.mag, 3)));
        add(T.gEcuador, T.ecuador[d.ecuador] || T.ecuador.map, T.gEcuadorSub, "local");
        if (d.central) add(T.gRegion, d.central, T.gRegionSub);
        out.curio = T.eclipseSafety;
        out.visual = { type: "eclipse-sun", label: T.lblSunEclipse, eclipse: d.type, mag: d.mag };
        out.sky = { date: ev.t, center: bodyDir("Sol", ev.t, pl), zenith: false, reticle: true, local: pl.lat != null };
      }
      out.credit = T.pcData(T.src.eclipse);
      break;
    }
    case "meteor": {
      const o = d.shower;
      out.title = info.title; out.type = T.type.meteor;
      add(T.gWhen, f.dateUtc(ev.t), T.gWhenCatalog);
      push(untilCell(ev.t, now, lang, f, { days: true }));
      if (o.zhr) add(T.gZhr, T.gZhrV(o.zhr), T.gZhrSub);
      const bestT = d.best ? d.best.t : null;
      if (pl.lat != null) {
        if (d.risesInNight && bestT) {
          const aa = altAzAt(j2000ToDate([o.nx, o.ny, o.nz], new Date(bestT)), pl, bestT);
          add(T.gRadiant, `${Math.round(d.maxAlt)}°`, T.gRadiantAt(f.time(bestT), (DIRS[lang] || DIRS.es)[compassPoint8(aa.az)]), "local");
        } else add(T.gRadiant, T.gRadiantNo, null, "local");
      }
      if (d.moon) add(T.gMoonLight, `${Math.round(d.moon.illum * 100)}${es ? " %" : "%"}`, d.moon.up ? T.gMoonLevel[d.moon.level] : T.gMoonDown);
      out.curio = es ? "Sin instrumentos: tumbado, mirando a todo el cielo desde un lugar oscuro, tras 20 minutos de adaptación." : "No instruments: lie back and look at the whole sky from a dark site after 20 minutes of adaptation.";
      out.credit = T.pcData(T.src.meteor);
      // la noche del máximo: a la hora en que el radiante está más alto (o medianoche local si no sube)
      const skyT = bestT || (d.night ? (+new Date(d.night.start) + +new Date(d.night.end)) / 2 : ev.t);
      out.visual = { type: "sky-meteor", label: T.lblMeteor(pl.name, f.time(skyT)), radiant: [o.nx, o.ny, o.nz] };
      out.sky = { date: skyT, center: [o.nx, o.ny, o.nz], zenith: false, reticle: false, local: pl.lat != null, skyHero: true };
      break;
    }
    case "planet": {
      out.title = info.title; out.type = T.type.planet;
      whenCell(ev.t); push(untilCell(ev.t, now, lang, f));
      const best = d.best;
      const bestCell = () => { if (pl.lat != null) add(T.gBest, best ? f.time(best.t) : T.gBestNo, best ? T.gBestAt(Math.round(best.alt)) : null, "local"); };
      if (ev.sub === "opposition" || ev.sub === "elongation") {
        if (ev.sub === "elongation") add(T.gElong, `${f.n(d.elong, 1)}°`, T.gElongSub(d.side === "east"));
        if (d.mag != null) add(T.gMag, signed(f, d.mag, 1), T.gMagSub, "data", ev.sub === "opposition" ? 2 : 3);
        const b = bodyAt(d.planet, ev.t);
        if (b && b.dist_au) add(T.gEarthDist, kmText(b.dist_au * AU_KM, f, T), `${f.n(b.dist_au, 2)} ${T.au}`, "data", 3);
        bestCell();
        out.visual = { type: "planet", key: d.planet, label: T.lblPlanet(planetCredit(d.planet)), labelFallback: T.lblFallbackModel };
        out.sky = { date: best ? best.t : ev.t, center: bodyDir(d.planet, best ? best.t : ev.t, pl), zenith: false, reticle: true, local: pl.lat != null };
      } else {
        add(T.gSep, `${f.n(d.sep, 1)}°`, T.gSepSub);
        const nm = (k) => (es ? k : PL_EN[k] || k);
        if (ev.sub === "moonConj") { if (d.mag != null) add(T.gMag, signed(f, d.mag, 1), nm(d.b), "data", 3); }
        else if (d.magA != null && d.magB != null) add(T.gMags, `${signed(f, d.magA, 1)} · ${signed(f, d.magB, 1)}`, `${nm(d.a)} · ${nm(d.b)}`, "data", 3);
        bestCell();
        const tSky = best ? best.t : ev.t;
        const A = bodyDir(d.a, tSky, pl), B = bodyDir(d.b, tSky, pl);
        const mid = A && B ? norm3([A[0] + B[0], A[1] + B[1], A[2] + B[2]]) : A || B;
        const sepRad = A && B ? Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))) : 0.05;
        out.visual = { type: "sky-conj", label: T.lblConj(pl.name, f.time(tSky)), bodies: [d.a, d.b] };
        // escala: la pareja ocupa ~1/3 del ancho, con un campo de entre ~14° (para que se vean estrellas) y ~60°
        out.sky = { date: tSky, center: mid, zenith: false, reticle: false, local: pl.lat != null, skyHero: true, zoom: Math.max(1080 / (60 * Math.PI / 180), Math.min(1080 / (14 * Math.PI / 180), 340 / Math.max(sepRad, 1e-3))) };
      }
      out.curio = firstSentences(info.what, 150);
      out.credit = T.pcData(T.src.planet);
      break;
    }
    case "season": {
      out.title = info.title; out.type = T.type.season;
      whenCell(ev.t); push(untilCell(ev.t, now, lang, f));
      if (pl.lat != null && d.noonAlt != null) add(T.gNoon, `${Math.round(d.noonAlt)}°`, T.gNoonSub(pl.name), "local");
      const decl = d.k === 1 ? 23.44 : d.k === 3 ? -23.44 : 0;
      add(T.gDecl, decl === 0 ? "0°" : `${decl > 0 ? "+" : "−"}${f.n(Math.abs(decl), 2)}°`, T.gDeclSub[d.k]);
      out.curio = firstSentences(info.what, 150);
      out.credit = T.pcData(T.src.season);
      out.visual = { type: "earth", label: T.lblEarth, season: d.k, lon: pl.lon, lat: pl.lat, place: pl.name };
      out.sky = { date: ev.t, center: bodyDir("Sol", ev.t, pl), zenith: false, reticle: true, local: pl.lat != null };
      break;
    }
    case "milestone": {
      // Hito del espacio (milestones.js): fecha y cifras de la NASA; la imagen es el concepto artístico de la NASA
      out.title = info.title; out.type = T.type.milestone;
      if (ev.allDay) { add(T.gWhen, f.dateUtc(ev.t)); push(untilCell(ev.t, now, lang, f, { days: true })); }
      else { whenCell(ev.t); push(untilCell(ev.t, now, lang, f)); }
      if (ev.sub === "lightday" && d.km) {
        add(T.gFromEarth, kmText(d.km, f, T), T.gLightDay(f.n(d.km / AU_KM, 0)), "data", 1);
        add(T.gSignal, sigText(86400, f, lang), T.gSignalSub, "data", 1);
      }
      if (d.launched) add(T.gLaunched, f.dateUtc(Date.parse(`${d.launched}T12:00:00Z`)), d.craft, "data", 2);
      add(T.gAgency, "NASA", null, "data", 3);
      out.curio = firstSentences(info.what, 150);
      out.credit = T.pcData(T.src.milestone);
      const nasa = nasaImageFor({ layer: "probes", name: d.craft || "" });
      out.visual = nasa
        ? { type: "craft", url: nasa.srcBig, label: T.lblCraftNasa(nasaKindKey(nasa) === "photo" || nasaKindKey(nasa) === "processed" ? "photo" : nasa.kind, nasa.credit), labelFallback: T.lblCraftArt, name: d.craft }
        : { type: "craft", url: null, label: T.lblCraftArt, labelFallback: T.lblCraftArt, name: d.craft };
      out.sky = { date: ev.t, center: null, zenith: true, reticle: false, local: pl.lat != null };
      break;
    }
    case "iss": {
      // el calendario solo lista las visibles; si llega una que no lo es, el título no puede decir «visible»
      out.title = ev.visible === true ? (info.title || (es ? "Pasada visible de la ISS" : "Visible ISS pass")) : (es ? "Pasada de la ISS (no visible a simple vista)" : "ISS pass (not visible to the naked eye)");
      out.type = T.type.iss;
      whenCell(ev.t);
      push(untilCell(ev.t, now, lang, f));
      if (d.maxAlt != null) add(T.gIssMax, `${Math.round(d.maxAlt)}°`, d.maxT ? T.gIssMaxAt(f.time(d.maxT)) : null, "data", 1);
      const a = d.from && (es ? d.from.compass_es : d.from.compass), b = d.to && (es ? d.to.compass_es : d.to.compass);
      if (a && b) add(T.gIssPath, T.gIssPathV(a, b), null, "data", 1);
      if (d.durationS) add(T.gDuration, T.gDurV(Math.max(1, Math.round(d.durationS / 60))), null, "data", 3);
      if (pl.lat != null) add(T.gIssVis, ev.visible === true ? T.gVisYes : T.gVisNo, ev.visible === true ? T.gIssVisSub : (T.gIssWhy[d.why] || null), "local");
      if (d.mag != null && grid.length < 6) add(T.gIssMag, signed(f, d.mag, 1), T.gMagSub, "data", 3);
      out.curio = es ? "Se ve como un punto brillante que no parpadea y cruza el cielo en pocos minutos." : "It looks like a bright, steady dot that crosses the sky in a few minutes.";
      out.credit = T.pcData(T.src.iss);
      out.visual = { type: "sky-iss", label: T.lblIss(pl.name), track: d.track || null, maxT: d.maxT };
      out.sky = { date: d.maxT || ev.t, center: null, zenith: true, allSky: true, reticle: false, local: pl.lat != null, skyHero: true };
      break;
    }
    case "launch": {
      const l = spec.launch || (d && d.launch) || {};
      const t = Date.parse(l.net), prec = netPrecision(l);
      out.title = l.name || l.mission || "—"; out.type = T.type.launch;
      if (Number.isFinite(t)) {
        if (prec === "time") whenCell(t, `${T.gNet.time} · ${pl.zone}${pl.tz ? ` (${utcOffsetLabel(t, pl.tz)})` : ""}`);
        else if (prec === "day") add(T.gWhen, f.dateUtc(t), T.gNet.day);
        else if (prec === "month") add(T.gWhen, f.month(t), T.gNet.month);
        else add(T.gWhen, T.gNet.vague);
        if (prec !== "vague") push(untilCell(t, now, lang, f, { days: prec !== "time" }));
      }
      if (l.rocket) add(T.gRocket, l.rocket);
      if (l.provider && l.provider !== "—") add(T.gProvider, l.provider);
      const ok = orbitKey(l.orbit);
      const orbit = ok ? T.orbits[ok] : (typeof l.orbit === "string" ? l.orbit : null);
      if (orbit) add(T.gOrbit, orbit, null, "data", 3);
      // el lugar: la base de lanzamiento como valor y la plataforma debajo
      if (l.location || l.pad) add(T.gPad, l.location || l.pad, l.location ? l.pad : null);
      const st = launchStatus(l);
      if (st && T.status[st] && grid.length < 6) add(T.gStatus, T.status[st], null, "data", 3);
      out.curio = es ? "Se sigue por la transmisión en línea; las fechas de lanzamiento suelen moverse." : "Follow it on the online broadcast; launch dates often slip.";
      out.credit = T.pcData(T.src.launch);
      const img = typeof l.image === "string" && /^https:\/\//i.test(l.image) ? l.image : null;
      out.visual = { type: "photo-launch", url: img, label: img ? T.lblLaunch(typeof l.image_credit === "string" ? l.image_credit.trim() : "") : T.lblLaunchArt, labelFallback: T.lblLaunchArt };
      out.sky = { date: Number.isFinite(t) ? t : now, center: null, zenith: true, reticle: false, local: pl.lat != null };
      break;
    }
    case "sun": {
      const s = spec.sun || {};
      const day = s.sunspot_number && s.sunspot_number.date ? Date.parse(s.sunspot_number.date + "T12:00:00Z") : now;
      out.title = es ? "El Sol hoy" : "The Sun today"; out.type = T.type.sun(f.dateUtc(day));
      if (s.sunspot_number && Number.isFinite(+s.sunspot_number.value)) add(T.gSpots, f.n(+s.sunspot_number.value), T.gSpotsSub);
      const top = s.strongest_flare_24h, fi = top && flareInfo(top.class);
      if (Array.isArray(s.flares_7d) || top) add(T.gFlare, fi ? fi.cls : T.gNoFlare, fi && top.peak_time ? T.gFlareAt(`${f.time(Date.parse(top.peak_time))} (${pl.zone})`) : null);
      const kpi = s.kp && kpInfo(s.kp.value);
      if (kpi) add(T.gKp, f.n(s.kp.value, 1), kpi.level === "storm" ? T.kpLevel.storm(kpi.g) : T.kpLevel[kpi.level]);
      if (Array.isArray(s.regions) && splitRegions(s.regions)) add(T.gRegions, f.n(s.regions.filter((x) => x && x.region).length), T.gRegionsSub, "data", 3);
      const imgT = s.image && s.image.time ? Date.parse(s.image.time) : null;
      if (imgT) add(T.gSdo, f.time(imgT), `${f.dateShort(imgT)} · ${pl.zone}`, "data", 3);
      out.curio = T.sunCurio;
      out.credit = T.pcData(T.src.sun);
      const url = s.image && typeof s.image.url === "string" ? s.image.url : null;
      out.visual = { type: "photo-sun", url, label: T.lblSun((s.image && s.image.credit) || "NASA/SDO", imgT ? `${f.dateShort(imgT)}, ${f.time(imgT)} (${pl.zone})` : ""), labelFallback: T.lblSunModel };
      out.sky = { date: now, center: bodyDir("Sol", now, pl), zenith: false, reticle: true, local: pl.lat != null };
      break;
    }
    case "asteroid": {
      const o = spec.rock || {}, pass = o.pass || passDistance(o), size = asteroidSize(o);
      out.title = o.name || "—"; out.type = T.type.asteroid;
      if (pass) add(T.gClosest, pass.ld >= 0.95 && pass.ld < 1.05 ? T.gLd1 : T.gLd(f.n(pass.ld, pass.ld < 10 ? 1 : 0)), kmText(pass.km, f, T));
      const t = Date.parse(o.date);
      if (Number.isFinite(t)) { add(T.gPassDate, `${f.date(t)} · ${f.time(t)}`, `${pl.zone}${pl.tz ? ` (${utcOffsetLabel(t, pl.tz)})` : ""}`); push(untilCell(t, now, lang, f)); }
      if (size) {
        const r = (m) => (m < 10 ? f.n(m, 1) : m < 100 ? f.n(Math.round(m)) : f.n(Math.round(m / 10) * 10));
        add(T.gSize, T.gSizeV(r(size.min), r(size.max)), size.basis === "h" ? T.gSizeBasis.h(f.n(+o.h, 1)) : T.gSizeBasis[size.basis]);
      }
      if (Number(o.v_rel_km_s) > 0) add(T.gSpeed, `${f.n(+o.v_rel_km_s, 1)} km/s`, T.gSpeedSub, "data", 3);
      out.curio = T.asteroidCurio;
      out.credit = T.pcData(T.src.asteroid);
      out.visual = { type: "asteroid", label: T.lblAsteroid, ld: pass ? pass.ld : null, name: o.name };
      out.sky = { date: now, center: null, zenith: true, reticle: false, local: pl.lat != null };
      break;
    }
    case "mars": {
      const c = spec.craft || {}, { earthKm, sunKm } = spacecraftDistances(c);
      const phase = T.phase[c.phase] || T.phase.other;
      out.title = c.name || "—"; out.type = T.type.mars(phase);
      if (earthKm != null) add(T.gFromEarth, kmText(earthKm, f, T), `${f.n(earthKm / AU_KM, earthKm / AU_KM < 0.1 ? 3 : 2)} ${T.au}`);
      if (earthKm != null) add(T.gSignal, sigText(signalSeconds(earthKm), f, lang), T.gSignalSub);
      if (sunKm != null) add(T.gFromSun, kmText(sunKm, f, T), `${f.n(sunKm / AU_KM, 2)} ${T.au}`, "data", 3);
      add(T.gPhase, phase);
      if (c.launched != null && c.launched !== "") add(T.gLaunched, /^\d{4}$/.test(String(c.launched)) ? String(c.launched) : f.dateUtc(Date.parse(c.launched)), null, "data", 3);
      const ag = typeof c.agency === "object" && c.agency ? (c.agency[lang] || c.agency.es || c.agency.en) : c.agency;
      if (ag) add(T.gAgency, ag);
      out.curio = earthKm != null ? T.marsCurio(sigText(signalSeconds(earthKm), f, lang)) : null;
      out.credit = T.pcData(T.src.mars);
      const nasa = nasaImageFor({ layer: "probes", name: c.name || "" });
      out.visual = nasa
        ? { type: "craft", url: nasa.srcBig, label: T.lblCraftNasa(nasaKindKey(nasa) === "photo" || nasaKindKey(nasa) === "processed" ? "photo" : nasa.kind, nasa.credit), labelFallback: T.lblCraftArt, name: c.name }
        : { type: "craft", url: null, label: T.lblCraftArt, labelFallback: T.lblCraftArt, name: c.name };
      const dir = Number.isFinite(c.nx) && Number.isFinite(c.ny) && Number.isFinite(c.nz) ? [c.nx, c.ny, c.nz] : null;
      out.sky = { date: now, center: dir, zenith: !dir, reticle: !!dir, local: pl.lat != null };
      break;
    }
    default: break;
  }
  out.grid = grid.slice(0, 6);
  return out;
}

function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

/** Puntos (J2000) de la trayectoria de una pasada de la ISS vista desde el lugar: [{ t, dir, lit, alt }]. */
export function issTrackDirs(track, place) {
  if (!Array.isArray(track) || !place || place.lat == null) return [];
  const out = [];
  for (const q of track) {
    const t = Date.parse(q.t);
    if (!Number.isFinite(t) || !Number.isFinite(q.alt) || !Number.isFinite(q.az)) continue;
    const eq = altAzToEquatorial(q.alt, q.az, place.lat, place.lon, new Date(t));
    out.push({ t, dir: dateToJ2000(eq, new Date(t)), lit: q.lit !== false, alt: q.alt, az: q.az });
  }
  return out;
}
