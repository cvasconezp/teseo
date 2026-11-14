// trajectory.js — datos de «Trayectoria realista (Lambert)».
//   · fetch a GET {API}/api/trajectory?origin=…&destination=…
//   · validación y forma de los datos (null si la respuesta no sirve)
//   · funciones puras del porkchop (bandas de color, celdas, rangos, marcadores)
// Sin React ni DOM: se prueba en Node con scripts/test_route_trajectory.mjs.
import { fetchJson } from "../net.js";

export const API = (import.meta.env || {}).VITE_API_URL || "";

export const trajectoryUrl = (origin, destination) =>
  `${API}/api/trajectory?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const DAY_MS = 86400000;

/** Fecha ISO del servidor → Date. Las fechas sin zona (Hohmann) son UTC. */
export function parseDay(iso) {
  if (typeof iso !== "string") return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(+d) ? d : null;
}

/** Una solución (óptimo, alternativa o Hohmann): solo lo que la tarjeta usa. */
function normSolution(s) {
  if (!s || typeof s !== "object") return null;
  const dep = parseDay(s.departure_date), arr = parseDay(s.arrival_date);
  if (!dep || !arr || !isNum(s.transfer_time_days) || !isNum(s.c3_km2_s2)
      || !isNum(s.v_inf_departure_km_s) || !isNum(s.v_inf_arrival_km_s) || !isNum(s.delta_v_heliocentric_km_s)) return null;
  const inj = s.injection && isNum(s.injection.delta_v_km_s) ? s.injection : null;
  const ins = s.insertion && isNum(s.insertion.delta_v_km_s) ? s.insertion : null;
  return {
    dep, arr, days: s.transfer_time_days, c3: s.c3_km2_s2,
    vDep: s.v_inf_departure_km_s, vArr: s.v_inf_arrival_km_s, dvHelio: s.delta_v_heliocentric_km_s,
    dla: isNum(s.departure_declination_deg) ? s.departure_declination_deg : null,
    injection: inj, insertion: ins,
    dvLow: isNum(s.delta_v_leo_to_low_orbit_km_s) ? s.delta_v_leo_to_low_orbit_km_s : null,
  };
}

/** Porkchop: matriz C3 ND×NA con null donde no hay solución de tipo I. */
function normPorkchop(p) {
  if (!p || !Array.isArray(p.departure_dates) || !Array.isArray(p.arrival_dates) || !Array.isArray(p.c3_km2_s2)) return null;
  const nd = p.departure_dates.length, na = p.arrival_dates.length;
  if (nd < 2 || na < 2 || p.c3_km2_s2.length !== nd) return null;
  if (!p.c3_km2_s2.every((row) => Array.isArray(row) && row.length === na)) return null;
  const dep = p.departure_dates.map(parseDay), arr = p.arrival_dates.map(parseDay);
  if (dep.some((d) => !d) || arr.some((d) => !d)) return null;
  const c3 = p.c3_km2_s2.map((row) => row.map((x) => (isNum(x) && x > 0 ? x : null)));
  if (!c3.some((row) => row.some((x) => x !== null))) return null;
  const notBefore = parseDay(p.not_before);   // salidas anteriores ya pasaron (null: todas válidas)
  return { dep, arr, c3, nd, na, notBefore };
}

/** Respuesta del servidor → datos de la tarjeta, o null si no sirve. */
export function normalizeTrajectory(raw) {
  if (!raw || typeof raw !== "object") return null;
  const opt = normSolution(raw.optimum), hoh = normSolution(raw.hohmann);
  if (!opt || !hoh) return null;
  const note = raw.assist_note && typeof raw.assist_note === "object" ? raw.assist_note : null;
  return {
    origin: String(raw.origin || ""), destination: String(raw.destination || ""),
    opt, hoh, alt: normSolution(raw.alternative_type_ii),
    pork: normPorkchop(raw.porkchop),
    needsAssist: !!raw.needs_gravity_assist,
    assistNote: note ? { es: typeof note.es === "string" ? note.es : "", en: typeof note.en === "string" ? note.en : "" } : null,
    startsToday: !!raw.starts_today,
    computedFor: typeof raw.computed_for === "string" ? raw.computed_for : null,
  };
}

/** GET /api/trajectory → datos normalizados. Lanza si hay error de red/HTTP;
 *  devuelve null si la respuesta no tiene la forma esperada. */
export async function fetchTrajectory(origin, destination, { signal } = {}) {
  const raw = await fetchJson(trajectoryUrl(origin, destination), { signal });
  return normalizeTrajectory(raw);
}

// ─── Comparación ─────────────────────────────────────────────────────────────

/** Diferencia (real − Hohmann) y porcentaje. */
export function delta(real, ref) {
  const d = real - ref;
  return { abs: d, pct: ref !== 0 ? (d / ref) * 100 : null };
}

// ─── Porkchop ────────────────────────────────────────────────────────────────

/** Límites de banda como múltiplos del mínimo: la banda i cubre C3 ≤ min·BAND_FACTORS[i]. */
export const BAND_FACTORS = [1.05, 1.15, 1.3, 1.6, 2.0, 2.6];
/** Paleta (viridis invertida: más claro = menos energía) + una banda final para lo caro. */
export const BAND_COLORS = ["#FDE725", "#B5DE2B", "#6DCD59", "#35B779", "#1F9E89", "#26828E", "#3E4989"];

export const bandLimits = (min) => BAND_FACTORS.map((f) => min * f);

export function bandIndex(c3, min) {
  for (let i = 0; i < BAND_FACTORS.length; i++) if (c3 <= min * BAND_FACTORS[i]) return i;
  return BAND_FACTORS.length;
}

/** ¿La salida de la columna i ya pasó? (no se puede elegir; se dibuja atenuada) */
export const isPast = (pork, i) => !!pork.notBefore && +pork.dep[i] < +pork.notBefore;

/** Celdas con banda y la posición del mínimo (índices i = salida, j = llegada).
 *  El mínimo y las bandas solo cuentan salidas que aún se pueden elegir. */
export function porkchopCells(pork) {
  let min = { c3: Infinity, i: -1, j: -1 };
  for (let i = 0; i < pork.nd; i++) {
    if (isPast(pork, i)) continue;
    for (let j = 0; j < pork.na; j++) {
      const v = pork.c3[i][j];
      if (v !== null && v < min.c3) min = { c3: v, i, j };
    }
  }
  if (min.i < 0) {                      // todo pasado: mínimo de todo el mapa
    for (let i = 0; i < pork.nd; i++) for (let j = 0; j < pork.na; j++) {
      const v = pork.c3[i][j];
      if (v !== null && v < min.c3) min = { c3: v, i, j };
    }
  }
  const cells = [];
  for (let i = 0; i < pork.nd; i++) for (let j = 0; j < pork.na; j++) {
    const v = pork.c3[i][j];
    if (v !== null) cells.push({ i, j, c3: v, band: bandIndex(v, min.c3), past: isPast(pork, i) });
  }
  return { cells, min };
}

/** Las n celdas de menor C3 (para la tabla alternativa). */
export function topCells(pork, n = 5) {
  const { cells } = porkchopCells(pork);
  return cells.filter((c) => !c.past).sort((a, b) => a.c3 - b.c3).slice(0, n).map((c) => ({
    ...c, dep: pork.dep[c.i], arr: pork.arr[c.j], days: Math.round((pork.arr[c.j] - pork.dep[c.i]) / DAY_MS),
  }));
}

/** Rango de fechas de salida (columnas) cuyo mejor C3 queda ≤ factor·mínimo. */
export function openDepartures(pork, factor = 1.3) {
  const best = pork.c3.map((row, i) => (isPast(pork, i) ? Infinity : row.reduce((m, v) => (v !== null && v < m ? v : m), Infinity)));
  const min = Math.min(...best);
  const ok = best.map((v, i) => (v <= min * factor ? i : -1)).filter((i) => i >= 0);
  if (!ok.length) return null;
  return { from: pork.dep[ok[0]], to: pork.dep[ok[ok.length - 1]], limit: min * factor, min };
}

/** Posición fraccionaria (0..nd-1, 0..na-1) de un par de fechas en la rejilla, o null si cae fuera. */
export function gridPosition(pork, dep, arr) {
  const f = (arrDates, d) => {
    const a = +arrDates[0], b = +arrDates[arrDates.length - 1];
    if (!(+d >= a && +d <= b)) return null;
    return ((+d - a) / (b - a)) * (arrDates.length - 1);
  };
  const x = f(pork.dep, dep), y = f(pork.arr, arr);
  return x === null || y === null ? null : { x, y };
}

/** Texto alternativo corto: números clave del mapa, ya formateados por quien llama. */
export function porkchopFacts(pork) {
  const { min } = porkchopCells(pork);
  const open = openDepartures(pork, 1.3);
  return {
    min: min.c3, dep: pork.dep[min.i], arr: pork.arr[min.j],
    days: Math.round((pork.arr[min.j] - pork.dep[min.i]) / DAY_MS),
    openFrom: open && open.from, openTo: open && open.to, limit: open && open.limit,
    depFirst: pork.dep[0], depLast: pork.dep[pork.nd - 1],
  };
}
