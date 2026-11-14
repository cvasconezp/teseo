// mga.js — datos de «Planifica tu viaje con catapultas» (asistencias gravitatorias múltiples).
//   · fetch a GET {API}/api/mga?origin=…&destination=… (200 resultado, 202 calculando)
//   · validación y forma de los datos (null si la respuesta no sirve)
//   · narración paso a paso, fichas de la línea de esferas y filas de la tabla
//   · geometría del recorrido con la escala radial del mapa de Ruta (hohmannMap.js)
// Sin React ni DOM: se prueba en Node con scripts/test_route_mga.mjs.
import { fetchJson } from "../net.js";
import { mapRadius, MAP_PLANETS, ORBIT_R, pathD } from "./hohmannMap.js";

export const API = (import.meta.env || {}).VITE_API_URL || "";
export const mgaUrl = (origin, destination) =>
  `${API}/api/mga?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;

export const PLANETS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];
export const DIRECT_ONLY = new Set(["mars", "venus"]);
export const VIABLE_DV = 0.5;
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isBody = (b) => PLANETS.includes(b);

// ─── Normalización ───────────────────────────────────────────────────────────

function normFlyby(f) {
  if (!f || !isBody(f.body) || !isDay(f.date)) return null;
  const n = (k) => (isNum(f[k]) ? f[k] : null);
  return {
    body: f.body, date: f.date,
    vIn: n("v_inf_in_km_s"), vOut: n("v_inf_out_km_s"), turn: n("turn_deg"), turnMax: n("turn_max_deg"),
    periapsis: n("periapsis_km"), altitude: n("altitude_km"),
    powered: n("powered_delta_v_km_s") ?? 0, gain: n("helio_speed_gain_km_s") ?? 0,
    turnLimited: !!f.turn_limited, viable: f.viable !== false,
  };
}

function normLeg(l) {
  if (!l || !isBody(l.from) || !isBody(l.to)) return null;
  const path = Array.isArray(l.path_au)
    ? l.path_au.filter((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]))
    : [];
  return {
    from: l.from, to: l.to, departure: isDay(l.departure) ? l.departure : null, arrival: isDay(l.arrival) ? l.arrival : null,
    days: isNum(l.days) ? l.days : null, revolutions: isNum(l.revolutions) ? l.revolutions : 0,
    resonance: typeof l.resonance === "string" && /^\d+:\d+$/.test(l.resonance) ? l.resonance : null,
    path,
  };
}

/** Una opción del servidor → forma de la tarjeta, o null si le falta lo esencial. */
export function normalizeOption(o) {
  if (!o || typeof o !== "object") return null;
  const seq = Array.isArray(o.sequence) ? o.sequence : [];
  if (seq.length < 2 || !seq.every(isBody) || !isDay(o.departure_date) || !isDay(o.arrival_date)) return null;
  if (!isNum(o.duration_days) || !isNum(o.c3_km2_s2) || !isNum(o.injection_delta_v_km_s)) return null;
  const flybys = (Array.isArray(o.flybys) ? o.flybys : []).map(normFlyby);
  if (flybys.length !== seq.length - 2 || flybys.some((f) => !f)) return null;
  const legs = (Array.isArray(o.legs) ? o.legs : []).map(normLeg).filter(Boolean);
  const arr = o.arrival && typeof o.arrival === "object" ? o.arrival : {};
  const vs = o.vs_direct && typeof o.vs_direct === "object" ? o.vs_direct : null;
  return {
    id: String(o.id || `${o.code}-${o.departure_date}`), code: String(o.code || ""), seq,
    mission: typeof o.mission === "string" ? o.mission : null,
    dep: o.departure_date, arr: o.arrival_date, days: o.duration_days,
    years: isNum(o.duration_years) ? o.duration_years : o.duration_days / 365.25,
    c3: o.c3_km2_s2, vinfDep: isNum(o.v_inf_departure_km_s) ? o.v_inf_departure_km_s : Math.sqrt(o.c3_km2_s2),
    inj: o.injection_delta_v_km_s, powered: isNum(o.powered_delta_v_km_s) ? o.powered_delta_v_km_s : 0,
    maxFlybyDv: isNum(o.max_flyby_delta_v_km_s) ? o.max_flyby_delta_v_km_s : 0,
    cost: isNum(o.cost_km_s) ? o.cost_km_s : o.injection_delta_v_km_s,
    flybys, legs: legs.length === seq.length - 1 ? legs : [],
    arrival: {
      vinf: isNum(arr.v_inf_km_s) ? arr.v_inf_km_s : null, dv: isNum(arr.delta_v_km_s) ? arr.delta_v_km_s : null,
      kind: arr.kind === "low_orbit" ? "low_orbit" : "capture",
      altitude: isNum(arr.orbit_altitude_km) ? arr.orbit_altitude_km : null,
    },
    viable: o.viable_without_dsm !== false,
    isDirect: o.is_direct === true || seq.length === 2,
    startsToday: o.starts_today === true,
    vsDirect: vs && isNum(vs.injection_saving_km_s) ? {
      injSave: vs.injection_saving_km_s, costSave: isNum(vs.cost_saving_km_s) ? vs.cost_saving_km_s : null,
      c3Save: isNum(vs.c3_saving_km2_s2) ? vs.c3_saving_km2_s2 : null, extraDays: isNum(vs.extra_days) ? vs.extra_days : null,
    } : null,
  };
}

/** Respuesta 200 del servidor → datos de la tarjeta, o null si no sirve. */
export function normalizeMga(raw) {
  if (!raw || typeof raw !== "object" || raw.status !== "ok" || !isBody(raw.destination)) return null;
  const options = (Array.isArray(raw.options) ? raw.options : []).map(normalizeOption).filter(Boolean);
  const best = normalizeOption(raw.best);
  if (!best && !options.length) return null;
  const d = raw.direct && typeof raw.direct === "object" ? raw.direct : {};
  const h = d.hohmann && typeof d.hohmann === "object" ? d.hohmann : null;
  const assumptions = raw.assumptions && typeof raw.assumptions === "object" ? raw.assumptions : {};
  return {
    origin: "earth", destination: raw.destination,
    best: best || options[0], options,
    earliest: normalizeOption(raw.earliest), nextJupiter: normalizeOption(raw.next_jupiter),
    jupiterCycle: isNum(raw.jupiter_cycle_years) ? raw.jupiter_cycle_years : null,
    directBest: normalizeOption(d.best), directNext: normalizeOption(d.next),
    hohmann: h && isNum(h.c3_km2_s2) && isNum(h.duration_days) && isNum(h.injection_delta_v_km_s)
      ? { c3: h.c3_km2_s2, days: h.duration_days, inj: h.injection_delta_v_km_s } : null,
    assistsHelp: raw.assists_help === true,
    criterion: raw.criterion === "injection_plus_powered_flybys_plus_insertion" ? "with_insertion" : "launch",
    horizon: raw.horizon && isDay(raw.horizon.from) && isDay(raw.horizon.to) ? { from: raw.horizon.from, to: raw.horizon.to } : null,
    computedFor: isDay(raw.computed_for) ? raw.computed_for : null,
    refreshing: raw.refreshing === true,
    minPeriapsis: assumptions.min_periapsis_km && typeof assumptions.min_periapsis_km === "object" ? assumptions.min_periapsis_km : {},
    viableDv: isNum(assumptions.viable_flyby_dv_km_s) ? assumptions.viable_flyby_dv_km_s : VIABLE_DV,
  };
}

/** GET /api/mga → { state: "ok"|"computing"|"earth_only"|"empty", … }. Lanza si hay error de red/HTTP. */
export async function fetchMga(origin, destination, { signal } = {}) {
  const raw = await fetchJson(mgaUrl(origin, destination), { signal, timeout: 15000 });
  if (raw && raw.status === "computing") {
    return {
      state: "computing",
      progress: isNum(raw.progress) ? Math.max(0, Math.min(1, raw.progress)) : 0,
      eta: isNum(raw.eta_s) ? raw.eta_s : null,
      queue: isNum(raw.queue_position) ? raw.queue_position : 0,
    };
  }
  if (raw && raw.status === "earth_only") return { state: "earth_only" };
  const data = normalizeMga(raw);
  return data ? { state: "ok", data } : { state: "empty" };
}

/** Espera antes de volver a preguntar mientras el servidor calcula (ms, 4–15 s). */
export function pollDelay(st) {
  const eta = st && isNum(st.eta) ? st.eta : 10;
  return Math.round(Math.max(4, Math.min(15, eta / 2)) * 1000);
}
export const MAX_POLLS = 45;     // ~6 min como mucho

// ─── Formato ─────────────────────────────────────────────────────────────────

export const nf = (x, lang, max = 1, min = 0) =>
  Number(x).toLocaleString(lang === "es" ? "es" : "en-US", { maximumFractionDigits: max, minimumFractionDigits: min });

const dayFmt = (lang, opts) => new Intl.DateTimeFormat(lang === "es" ? "es" : "en-GB", { timeZone: "UTC", ...opts });
export const dayDate = (s) => new Date(`${s}T00:00:00Z`);
/** «16 de julio de 2034» / «16 July 2034» */
export const fmtLong = (s, lang) => dayFmt(lang, { day: "numeric", month: "long", year: "numeric" }).format(dayDate(s));
/** «16 jul 2034» / «16 Jul 2034» */
export const fmtShort = (s, lang) => dayFmt(lang, { day: "numeric", month: "short", year: "numeric" }).format(dayDate(s)).replace(".", "");
/** «jul 2034» / «Jul 2034» */
export const fmtMonth = (s, lang) => dayFmt(lang, { month: "short", year: "numeric" }).format(dayDate(s)).replace(".", "");

/** Duración legible: días si < 1 año; si no, años con un decimal. */
export function fmtDuration(days, lang) {
  if (days < 365) return lang === "es" ? `${Math.round(days)} días` : `${Math.round(days)} days`;
  const y = days / 365.25;
  const s = nf(y, lang, 1, 1);
  return lang === "es" ? `${s} años` : `${s} years`;
}

/** Velocidad: m/s por debajo de 1 km/s («240 m/s»), km/s por encima («3,5 km/s»). */
export function fmtSpeed(kms, lang) {
  const a = Math.abs(kms);
  if (a < 0.995) return `${nf(Math.round(a * 1000), lang, 0)} m/s`;
  return `${nf(a, lang, a < 10 ? 2 : 1, a < 10 ? 2 : 1)} km/s`;
}

/** Distancia del sobrevuelo: «1474 km», «245 000 km», «1,2 millones de km». */
export function fmtDistance(km, lang) {
  if (!isNum(km)) return "";
  if (km >= 1e6) {
    const m = Math.round(km / 1e5) / 10;
    if (lang === "es") return m === 1 ? "1 millón de km" : `${nf(m, lang, 1)} millones de km`;
    return `${nf(m, lang, 1)} million km`;
  }
  if (km >= 10000) return `${nf(Math.round(km / 1000) * 1000, lang, 0)} km`;
  return `${nf(Math.round(km), lang, 0)} km`;
}

// ─── Narración paso a paso ───────────────────────────────────────────────────

/**
 * Pasos del viaje en lenguaje llano. Devuelve [{ kind, body, date, text }], con
 * kind = launch | flyby | arrival | warning. `t` son los textos (i18n-mga.js).
 */
export function narrate(o, lang, t, name) {
  const steps = [];
  steps.push({
    kind: "launch", body: o.seq[0], date: o.dep,
    text: t.stepLaunch({ date: fmtLong(o.dep, lang), dv: fmtSpeed(o.inj, lang), c3: nf(o.c3, lang, 1), today: o.startsToday }),
  });
  o.flybys.forEach((f, i) => {
    const body = name(f.body, true);
    const p = { body, date: fmtLong(f.date, lang), alt: fmtDistance(f.altitude, lang), gain: fmtSpeed(f.gain, lang), dest: name(o.seq.at(-1), true) };
    let text = Math.abs(f.gain) < 0.05 ? t.stepFlybyTurn(p) : f.gain > 0 ? t.stepFlybyGain(p) : t.stepFlybyBrake(p);
    if (f.powered >= 0.005) text += t.stepPowered(fmtSpeed(f.powered, lang));
    const next = o.legs[i + 1];
    if (next && next.resonance) {
      const [n, m] = next.resonance.split(":").map(Number);
      text += t.stepResonance({ body, n, m, days: Math.round(next.days || 0) });
    }
    steps.push({ kind: "flyby", body: f.body, date: f.date, text });
  });
  const dest = o.seq.at(-1);
  const a = o.arrival;
  const ap = { body: name(dest, true), date: fmtLong(o.arr, lang), years: fmtDuration(o.days, lang), dv: a.dv === null ? "?" : fmtSpeed(a.dv, lang), alt: a.altitude };
  steps.push({ kind: "arrival", body: dest, date: o.arr, text: a.kind === "low_orbit" ? t.stepArrivalLow(ap) : t.stepArrivalCapture(ap) });
  const bad = o.flybys.filter((f) => f.powered > VIABLE_DV);
  if (!o.viable && bad.length) {
    const worst = bad.reduce((m, f) => (f.powered > m.powered ? f : m));
    steps.push({ kind: "warning", body: worst.body, date: worst.date, text: t.notViable(name(worst.body, true), fmtSpeed(worst.powered, lang)) });
  }
  return steps;
}

/** Fichas de la línea de esferas: cuerpo, fecha corta y Δv del paso (con signo). */
export function chips(o, lang) {
  const out = [{ kind: "launch", body: o.seq[0], date: o.dep, dv: fmtSpeed(o.inj, lang), sign: "launch" }];
  for (const f of o.flybys) {
    const g = Math.abs(f.gain) < 0.05 ? 0 : f.gain;
    out.push({
      kind: "flyby", body: f.body, date: f.date,
      dv: g === 0 ? "±0" : `${g > 0 ? "+" : "−"}${fmtSpeed(g, lang)}`, sign: g > 0 ? "gain" : g < 0 ? "brake" : "turn",
      motor: f.powered >= 0.005 ? fmtSpeed(f.powered, lang) : null, bad: f.powered > VIABLE_DV,
    });
  }
  const a = o.arrival;
  out.push({ kind: "arrival", body: o.seq.at(-1), date: o.arr, dv: a.dv === null ? "" : `−${fmtSpeed(a.dv, lang)}`, sign: "arrival" });
  return out;
}

/** Nombre de la ruta: «Tierra → Venus → Júpiter → Saturno». */
export const routeName = (seq, name) => seq.map((b) => name(b)).join(" → ");

// ─── Tabla de alternativas ───────────────────────────────────────────────────

/** Filas: una por opción, con lo que muestra la tabla (ya formateado). */
export function tableRows(data, lang) {
  return data.options.map((o) => ({
    id: o.id, seq: o.seq, isDirect: o.isDirect, viable: o.viable,
    dep: fmtShort(o.dep, lang), depMonth: fmtMonth(o.dep, lang),
    dur: fmtDuration(o.days, lang), inj: nf(o.inj, lang, 2, 2), c3: nf(o.c3, lang, 1),
    best: data.best && o.id === data.best.id,
  }));
}

/** Frase de comparación con el directo (o null si la opción es el directo). */
export function directComparison(o, data, lang, t) {
  const d = data.directBest;
  if (!d || o.isDirect || !o.vsDirect) return null;
  const extra = o.days - d.days;
  // En Mercurio lo que importa es frenar al llegar: también se dice cuánto menos
  const arrSave = data.criterion === "with_insertion" && o.arrival.dv !== null && d.arrival.dv !== null && d.arrival.dv - o.arrival.dv > 0.05
    ? fmtSpeed(d.arrival.dv - o.arrival.dv, lang) : null;
  return t.vsDirect({ arrSave,
    save: fmtSpeed(o.vsDirect.injSave, lang), c3o: nf(o.c3, lang, 1), c3d: nf(d.c3, lang, 1),
    extra: extra > 30 ? fmtDuration(extra, lang) : null, shorter: extra < -30 ? fmtDuration(-extra, lang) : null,
    better: o.vsDirect.injSave > 0,
  });
}

// ─── Geometría del recorrido (escala del mapa de Ruta) ───────────────────────

/** (x, y) en UA → coordenadas del mapa (% con el Sol en 50,50; y hacia abajo). */
export function toMap([x, y]) {
  const r = Math.hypot(x, y), th = Math.atan2(y, x), R = mapRadius(r);
  return { x: 50 + R * Math.cos(th), y: 50 - R * Math.sin(th) };
}

/**
 * Tramos y encuentros de una opción en el mapa: los puntos de cada arco de Lambert
 * (ángulos reales, radios por `mapRadius`, como la ruta de Hohmann del mapa).
 * Devuelve { legs: [{ d, from, to }], events: [{ x, y, body, kind, date }], orbits: [{ id, r }] }.
 */
export function routeGeometry(o) {
  const legs = o.legs.filter((l) => l.path.length > 1).map((l) => ({ d: pathD(l.path.map(toMap)), from: l.from, to: l.to }));
  const pos = [];
  o.legs.forEach((l, i) => {
    if (!l.path.length) return;
    if (i === 0) pos.push(l.path[0]);
    pos.push(l.path[l.path.length - 1]);
  });
  const kinds = ["launch", ...o.flybys.map(() => "flyby"), "arrival"];
  const dates = [o.dep, ...o.flybys.map((f) => f.date), o.arr];
  const events = pos.length === o.seq.length
    ? pos.map((p, i) => ({ ...toMap(p), body: o.seq[i], kind: kinds[i], date: dates[i] }))
    : [];
  const ids = new Set(o.seq);
  const orbits = MAP_PLANETS.map((id, i) => ({ id, r: ORBIT_R(i), on: ids.has(id) }));
  return { legs, events, orbits, markers: groupMarkers(events) };
}

/**
 * Marcadores numerados del mapa. Los encuentros que caen casi en el mismo punto
 * (p. ej. los dos pasos por Venus de una órbita resonante 2:1, que vuelve al mismo
 * sitio) se dibujan como un solo marcador «2·3» para que ninguno tape a otro.
 */
export function groupMarkers(events, minDist = 4) {
  const out = [];
  events.forEach((e, i) => {
    const g = out.find((m) => Math.hypot(m.x - e.x, m.y - e.y) < minDist);
    if (g) { g.nums.push(i + 1); g.kinds.push(e.kind); } else out.push({ x: e.x, y: e.y, nums: [i + 1], kinds: [e.kind] });
  });
  return out.map((m) => ({ ...m, label: m.nums.join("·") }));
}
