// events.js — reúne todos los eventos del Calendario del cielo en una lista cronológica de datos
// NEUTROS (sin textos): los textos ES/EN salen de i18n.js. Todo se calcula o se cita:
//   Luna ........ src/special/math.js (nextPhase; validado con el USNO, ~15 min)
//   Eclipses .... eclipses.js (lista NASA GSFC 2026–2028; visibilidad lunar calculada)
//   Meteoros .... meteors.js (catálogo IMO de la app + radiante y Luna calculados)
//   Planetas .... planets.js (src/ephemeris.js; oposiciones, elongaciones, conjunciones)
//   Estaciones .. seasons.js (Meeus, cap. 27)
//   ISS ......... pasadas del backend (/api/iss/passes), solo las visibles
//   Lanzamientos  launchFilter.js sobre /api/launches
import { nextPhase } from "../../special/math.js";
import { bodyMagnitude } from "../../sky/planetMag.js";
import { netPrecision } from "../math.js";
import { stateAt, nightVisibility, PLANET_EN, DAY, HOUR } from "./astro.js";
import { findOppositions, findElongations, findConjunctions } from "./planets.js";
import { findEclipses } from "./eclipses.js";
import { findSeasons } from "./seasons.js";
import { findShowerPeaks } from "./meteors.js";
import { filterLaunches } from "./launchFilter.js";

export const QUITO = { name: "Quito", lat: -0.22, lon: -78.5125, elev: 2850 };
export const PLACE_KEY = "teseo_place_v1";    // la misma clave que escribe el Cielo (src/Constellations.jsx)
export const TYPES = ["moon", "eclipse", "meteor", "planet", "season", "iss", "launch"];

/**
 * Lugar elegido en el Cielo (localStorage `teseo_place_v1`: { kind, lat, lon, elev }; kind es el nombre de un
 * atajo —Quito, Cayambe…—, "me" (GPS), "custom" u "off"). Sin dato válido: Quito, como el Cielo.
 */
export function readPlace(storage) {
  let saved = null;
  try { saved = JSON.parse((storage && storage.getItem(PLACE_KEY)) || "null"); } catch { saved = null; }
  if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon) && saved.kind !== "off" && Math.abs(saved.lat) <= 90 && Math.abs(saved.lon) <= 180) {
    const kind = typeof saved.kind === "string" ? saved.kind : "custom";
    return { lat: saved.lat, lon: saved.lon, elev: Number.isFinite(saved.elev) ? saved.elev : 0, kind: kind === "me" || kind === "custom" ? kind : "preset", name: kind === "me" || kind === "custom" ? null : kind, isDefault: false };
  }
  return { ...QUITO, kind: "preset", isDefault: true };
}

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
const PHASES = [[0, "new"], [90, "firstQuarter"], [180, "full"], [270, "lastQuarter"]];

function moonEvents(from, to) {
  const out = [];
  for (const [target, phase] of PHASES) {
    let d = from;
    for (let guard = 0; guard < 20; guard++) {
      const r = nextPhase(new Date(d), target);
      if (!r || +r > to) break;
      out.push({ id: `moon-${phase}-${ymd(+r)}`, type: "moon", sub: phase, t: +r, durationMin: 30, visible: null, data: { phase } });
      d = +r + DAY;
    }
  }
  return out;
}

const sunNoonAlt = (lat, decDeg) => 90 - Math.abs(lat - decDeg);

/**
 * Eventos CALCULADOS en el dispositivo (Luna, eclipses, meteoros, planetas, estaciones) para un lugar.
 * [{ id, type, sub, t, allDay?, durationMin, visible: true|false|"partial"|null, data }] sin ordenar.
 */
export function buildSkyEvents({ from = Date.now(), days = 90, lat = QUITO.lat, lon = QUITO.lon, showers = [] } = {}) {
  const to = from + days * DAY;
  const ev = [];

  ev.push(...moonEvents(from, to));

  for (const e of findEclipses(from, to, lat, lon)) {
    let visible = null;
    if (e.body === "moon") visible = e.vis.state === "yes" ? true : e.vis.state === "partial" ? "partial" : false;
    else visible = e.ecuador === "yes" ? true : e.ecuador === "partial" ? "partial" : e.ecuador === "no" ? false : null;
    ev.push({ id: `${e.id}`, type: "eclipse", sub: e.body, t: e.t, durationMin: e.body === "moon" ? Math.max(60, e.umbMin || 60) : 120, visible, data: e });
  }

  for (const p of findShowerPeaks(showers, from, to, lat, lon)) {
    ev.push({ id: p.id, type: "meteor", sub: "shower", t: p.date, allDay: true, durationMin: 24 * 60, visible: p.risesInNight, data: p });
  }

  const mag = (name, t) => { try { const m = bodyMagnitude(stateAt(t)[name].raw); return m ? m.V : null; } catch { return null; } };
  for (const o of findOppositions(from, to)) {
    const vis = nightVisibility(o.t, [o.planet], lat, lon);
    ev.push({ id: `opp-${PLANET_EN[o.planet]}-${ymd(o.t)}`, type: "planet", sub: "opposition", t: o.t, durationMin: 60, visible: !!vis, data: { planet: o.planet, mag: mag(o.planet, o.t), best: vis } });
  }
  for (const o of findElongations(from, to)) {
    const vis = nightVisibility(o.t, [o.planet], lat, lon);
    ev.push({ id: `elong-${PLANET_EN[o.planet]}-${o.side}-${ymd(o.t)}`, type: "planet", sub: "elongation", t: o.t, durationMin: 60, visible: !!vis, data: { planet: o.planet, side: o.side, elong: o.elong, mag: mag(o.planet, o.t), best: vis } });
  }
  for (const c of findConjunctions(from, to)) {
    const vis = nightVisibility(c.t, [c.a, c.b].filter(n => n !== "Luna"), lat, lon) && nightVisibility(c.t, [c.a, c.b], lat, lon);
    ev.push({ id: `conj-${c.a === "Luna" ? "Moon" : PLANET_EN[c.a]}-${PLANET_EN[c.b]}-${ymd(c.t)}`, type: "planet", sub: c.kind === "moon" ? "moonConj" : "planetConj", t: c.t, durationMin: 60, visible: !!vis, data: { a: c.a, b: c.b, sep: c.sep, mag: c.kind === "moon" ? mag(c.b, c.t) : null, magA: c.kind === "planets" ? mag(c.a, c.t) : null, magB: c.kind === "planets" ? mag(c.b, c.t) : null, best: vis } });
  }

  for (const s of findSeasons(from, to)) {
    const decl = s.k === 1 ? 23.44 : s.k === 3 ? -23.44 : 0;
    ev.push({ id: `season-${["marEquinox", "junSolstice", "sepEquinox", "decSolstice"][s.k]}-${ymd(s.t)}`, type: "season", sub: ["marEquinox", "junSolstice", "sepEquinox", "decSolstice"][s.k], t: s.t, durationMin: 30, visible: null, data: { k: s.k, kind: s.kind, noonAlt: sunNoonAlt(lat, decl) } });
  }

  return ev;
}

/** Eventos que llegan de la red: pasadas de la ISS y lanzamientos relevantes. */
export function buildFeedEvents({ from = Date.now(), days = 90, launches = [], issPasses = [] } = {}) {
  const to = from + days * DAY;
  const ev = [];
  for (const p of normalizeIss(issPasses)) if (p.t >= from && p.t <= to) ev.push(p);

  for (const { launch: l, reasons } of filterLaunches(launches)) {
    const t = Date.parse(l.net);
    if (!Number.isFinite(t) || t < from || t > to) continue;
    const prec = netPrecision(l);
    ev.push({ id: `launch-${l.id || String(l.name).replace(/\W+/g, "-").toLowerCase()}`, type: "launch", sub: reasons[0], t, allDay: prec === "day" || prec === "month" || prec === "vague", approx: prec !== "time", durationMin: 60, visible: null, data: { launch: l, reasons, precision: prec } });
  }
  return ev;
}

/** Todo junto, en orden cronológico. */
export function buildEvents(opts = {}) {
  return sortEvents([...buildSkyEvents(opts), ...buildFeedEvents(opts)]);
}
export const sortEvents = (list) => list.slice().sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));

/**
 * Pasadas de la ISS (/api/iss/passes) → eventos. Tolerante: acepta { passes: [...] } o la lista, ignora lo que no
 * entienda y solo deja las pasadas visibles (`visible: true`).
 */
export function normalizeIss(data) {
  const list = Array.isArray(data) ? data : data && Array.isArray(data.passes) ? data.passes : [];
  const ms = (p) => (p && p.t ? Date.parse(p.t) : NaN);
  const out = [];
  for (const p of list) {
    if (!p || p.visible !== true) continue;
    const start = ms(p.visible_from) , max = ms(p.max), end = ms(p.end), st = ms(p.start);
    const t = Number.isFinite(start) ? start : Number.isFinite(st) ? st : max;
    if (!Number.isFinite(t)) continue;
    const dur = Number.isFinite(p.visible_duration_s) && p.visible_duration_s > 0 ? p.visible_duration_s : p.duration_s;
    out.push({
      id: `iss-${ymd(t)}-${new Date(t).toISOString().slice(11, 16).replace(":", "")}`, type: "iss", sub: "pass", t,
      durationMin: Math.max(5, Math.round((Number(dur) || 300) / 60)), visible: true,
      data: { maxAlt: Number.isFinite(p.max_alt) ? p.max_alt : (p.max && Number.isFinite(p.max.alt) ? p.max.alt : null), maxT: Number.isFinite(max) ? max : null,
        from: p.start || null, to: p.end || null, durationS: Number.isFinite(dur) ? dur : null, mag: Number.isFinite(p.mag) ? p.mag : null, endT: Number.isFinite(end) ? end : null },
    });
  }
  return out;
}

/** Agrupa por mes local del dispositivo: [{ key: "2026-11", t, items: [...] }] */
export function groupByMonth(events) {
  const groups = [];
  for (const e of events) {
    const d = new Date(e.t);
    // los eventos de fecha completa (sin hora) se agrupan por su fecha UTC; los demás, por la fecha local
    const key = e.allDay ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, t: e.t, items: [] }; groups.push(g); }
    g.items.push(e);
  }
  return groups;
}

export { HOUR };
