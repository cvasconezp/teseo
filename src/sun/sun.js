// sun.js — «El Sol hoy»: lógica pura (sin React, sin red). La probamos en Node
// (scripts/test_sun_today.mjs). Aquí NO se inventa ningún dato: solo se formatea, se ordena y se
// traduce a categorías lo que llega de GET /api/sun/today (SILSO, NOAA SWPC, NASA SDO).
// «La IA narra, nunca calcula»: las frases las escribimos nosotros, a mano, con tabla de textos.

export const API = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) || "";
export const SUN_PATH = "/api/sun/today";

// Páginas oficiales de cada fuente (todas comprobadas el 16-nov-2026).
export const LINKS = {
  silso: "https://www.sidc.be/SILSO/eisnplot",
  regions: "https://www.swpc.noaa.gov/products/solar-region-summary",
  flares: "https://www.swpc.noaa.gov/products/goes-x-ray-flux",
  kp: "https://www.swpc.noaa.gov/products/planetary-k-index",
  cycle: "https://www.swpc.noaa.gov/products/solar-cycle-progression",
  scales: "https://www.swpc.noaa.gov/noaa-scales-explanation",
  sdo: "https://sdo.gsfc.nasa.gov/data/",
  sdoHome: "https://sdo.gsfc.nasa.gov/",
};

// ─── Tamaño de las regiones: «≈ N Tierras» ───────────────────────────────────
// El tamaño de una región activa (NOAA) viene en millonésimas del hemisferio solar visible (MSH).
//   hemisferio solar = 2π·R☉²  (R☉ = 695 700 km)   → 1 MSH = 2π·R☉²·10⁻⁶ ≈ 3,04 millones de km²
//   superficie de la Tierra = 4π·R⊕²  (R⊕ = 6 371 km) ≈ 510 millones de km²
//   → la superficie ENTERA de la Tierra ≈ 2·(R⊕/R☉)²·10⁶ ≈ 167,7 MSH  (≈ 168; no 169)
// (Ojo: el círculo que la Tierra «tapa» al pasar delante del Sol, π·R⊕², son solo ≈ 42 MSH; aquí se
// compara con su superficie total, que es la forma en que NOAA/SIDC suelen explicar esta unidad.)
export const R_SUN_KM = 695700;
export const R_EARTH_KM = 6371;
export const EARTH_MSH = 2 * (R_EARTH_KM / R_SUN_KM) ** 2 * 1e6;

// Número finito o null (Number(null) sería 0: un dato ausente no puede pasar por cero).
const numOrNull = (v) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Cuántas «superficies de la Tierra» caben en un área de `msh` millonésimas de hemisferio. null si no hay dato. */
export function earthsOf(msh) {
  const a = numOrNull(msh);
  return a !== null && a >= 0 ? a / EARTH_MSH : null;
}

/** «≈ 0,1» · «≈ 1,0» · «≈ 12»: un decimal por debajo de 10, enteros después. null si no hay dato. */
export function fmtEarths(msh, lang = "es") {
  const e = earthsOf(msh);
  if (e == null) return null;
  const digits = e < 10 ? 1 : 0;
  return "≈ " + e.toLocaleString(lang === "es" ? "es" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// ─── Fulguraciones (clases de rayos X de GOES) ──────────────────────────────
const LETTER_RANK = { A: 0, B: 1, C: 2, M: 3, X: 4 };

/** 'M1.1' → { letter:"M", num:1.1, rank:[3,1.1], r: 1 } ; null si no es una clase válida.
 *  r = escala NOAA de apagones de radio: M1→R1, M5→R2, X1→R3, X10→R4, X20→R5 (null en A/B/C). */
export function flareInfo(cls) {
  const s = String(cls || "").trim().toUpperCase();
  const m = /^([ABCMX])(\d+(?:\.\d+)?)$/.exec(s);
  if (!m) return null;
  const letter = m[1], num = parseFloat(m[2]);
  let r = null;
  if (letter === "M") r = num >= 5 ? 2 : 1;
  else if (letter === "X") r = num >= 20 ? 5 : num >= 10 ? 4 : 3;
  return { letter, num, rank: [LETTER_RANK[letter], num], r, cls: s };
}

/** Compara dos clases: >0 si a es más fuerte que b. */
export function compareFlares(a, b) {
  const x = flareInfo(a), y = flareInfo(b);
  if (!x || !y) return 0;
  return x.rank[0] - y.rank[0] || x.num - y.num;
}

/** Nivel para el texto: "quiet" (A/B), "small" (C), "medium" (M) o "big" (X). */
export function flareLevel(cls) {
  const f = flareInfo(cls);
  if (!f) return null;
  return f.letter === "X" ? "big" : f.letter === "M" ? "medium" : f.letter === "C" ? "small" : "quiet";
}

/** Resumen de la lista de 7 días: cuántas fulguraciones y cuántas M o X. null si no hay lista. */
export function flareSummary(list) {
  if (!Array.isArray(list)) return null;
  let mx = 0, strongest = null;
  for (const f of list) {
    const i = flareInfo(f && f.class);
    if (!i) continue;
    if (i.letter === "M" || i.letter === "X") mx += 1;
    if (!strongest || compareFlares(i.cls, strongest.class) > 0) strongest = f;
  }
  return { total: list.filter(f => flareInfo(f && f.class)).length, mx, strongest };
}

// ─── Índice Kp ──────────────────────────────────────────────────────────────
/** Nivel de actividad geomagnética: "quiet" (Kp < 3), "active" (3 ≤ Kp < 5) o "storm" (Kp ≥ 5, escala G1–G5 de NOAA). */
export function kpInfo(kp) {
  const v = numOrNull(kp);
  if (v === null || v < 0 || v > 9) return null;
  if (v >= 5) return { level: "storm", g: Math.min(5, Math.floor(v) - 4) };
  return { level: v >= 3 ? "active" : "quiet", g: null };
}

// ─── Ubicación en el disco solar ────────────────────────────────────────────
/** 'S09W02' → { ns:"S", lat:9, ew:"W", lon:2, limb:false } ; null si no cuadra con el formato NOAA. */
export function parseLocation(loc) {
  const m = /^([NS])(\d{1,2})([EW])(\d{1,2})$/.exec(String(loc || "").trim().toUpperCase());
  if (!m) return null;
  const lon = parseInt(m[4], 10);
  return { ns: m[1], lat: parseInt(m[2], 10), ew: m[3], lon, limb: lon >= 75 };
}

/** Regiones con tamaño medido (las que se listan) y cuántas más hay sin medida (recién salidas o en el borde). */
export function splitRegions(regions) {
  if (!Array.isArray(regions)) return null;
  const withArea = regions.filter(r => r && Number.isFinite(Number(r.area)) && Number(r.area) > 0)
    .sort((a, b) => b.area - a.area || a.region - b.region);
  return { shown: withArea, hidden: regions.length - withArea.length };
}

/** Mayor probabilidad (%) de fulguración M o X entre las regiones, para la frase del pronóstico. null sin datos. */
export function maxFlareProb(regions) {
  if (!Array.isArray(regions) || !regions.length) return null;
  let m = null, x = null;
  for (const r of regions) {
    const p = r && r.flare_prob;
    if (!p) continue;
    if (Number.isFinite(p.m)) m = Math.max(m ?? 0, p.m);
    if (Number.isFinite(p.x)) x = Math.max(x ?? 0, p.x);
  }
  return m == null && x == null ? null : { m, x };
}

// ─── Ciclo solar ────────────────────────────────────────────────────────────
// El mínimo entre los ciclos 24 y 25 fue en diciembre de 2019 (SIDC/NOAA): el ciclo 25 empieza ahí.
export const CYCLE25_START = "2019-12";

/** Mes con más manchas (mensual, SILSO) entre `from` (por defecto el inicio del ciclo 25) y `to` (incluido, opcional). null si no hay. */
export function cyclePeak(months, from = CYCLE25_START, to = null) {
  if (!Array.isArray(months)) return null;
  let best = null;
  for (const m of months) {
    if (!m || m.t < from || (to && m.t > to) || !Number.isFinite(m.ssn)) continue;
    if (!best || m.ssn > best.ssn) best = { t: m.t, ssn: m.ssn };
  }
  return best;
}

/** 'YYYY-MM' → año decimal (mitad del mes). */
export function monthToYear(t) {
  const m = /^(\d{4})-(\d{2})/.exec(String(t || ""));
  return m ? parseInt(m[1], 10) + (parseInt(m[2], 10) - 0.5) / 12 : NaN;
}

/** 'YYYY-MM-DD' o ISO → año decimal. */
export function dateToYear(s) {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? `${s}T12:00:00Z` : s);
  if (isNaN(d)) return NaN;
  const y = d.getUTCFullYear();
  const a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1);
  return y + (d.getTime() - a) / (b - a);
}

const f1 = (n) => Math.round(n * 10) / 10;

/** Camino SVG con los puntos [x,y] (null corta la línea: huecos donde no hay dato). */
export function pathOf(points) {
  let d = "", pen = false;
  for (const p of points) {
    if (!p) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${f1(p[0])} ${f1(p[1])}`;
    pen = true;
  }
  return d;
}

/**
 * Geometría de la gráfica del ciclo (todo en coordenadas del viewBox; sin DOM).
 *  cycle = { months:[{t,ssn,smoothed}]|null, predicted:[{t,ssn,low,high}]|null }
 *  todayYear = año decimal de «hoy» ; todayValue = manchas de hoy (opcional)
 * Devuelve null si no hay nada que dibujar.
 */
export function cycleGeometry(cycle, todayYear, todayValue, { w = 320, h = 150, left = 30, right = 8, top = 10, bottom = 22 } = {}) {
  if (!cycle) return null;
  const months = Array.isArray(cycle.months) ? cycle.months : [];
  const lastObs = months.length ? months[months.length - 1].t : null;
  // la predicción solo se dibuja desde el último mes observado
  const pred = (Array.isArray(cycle.predicted) ? cycle.predicted : []).filter(p => !lastObs || p.t >= lastObs);
  if (!months.length && !pred.length) return null;
  const years = [...months, ...pred].map(p => monthToYear(p.t)).filter(Number.isFinite);
  if (Number.isFinite(todayYear)) years.push(todayYear);
  const x0 = Math.floor(Math.min(...years)), x1 = Math.ceil(Math.max(...years));
  const vals = [...months.map(m => m.ssn), ...pred.map(p => (Number.isFinite(p.high) ? p.high : p.ssn)), Number.isFinite(todayValue) ? todayValue : 0];
  const rawMax = Math.max(...vals, 10);
  const step = rawMax > 150 ? 50 : 25;
  const yMax = Math.ceil(rawMax / step) * step;
  const X = (yr) => left + ((yr - x0) / (x1 - x0)) * (w - left - right);
  const Y = (v) => top + (1 - v / yMax) * (h - top - bottom);
  const pt = (t, v) => (Number.isFinite(v) ? [X(monthToYear(t)), Y(v)] : null);

  const monthly = months.map(m => pt(m.t, m.ssn));
  const smoothed = months.map(m => pt(m.t, m.smoothed));
  const predLine = pred.map(p => pt(p.t, p.ssn));
  const hi = pred.filter(p => Number.isFinite(p.high) && Number.isFinite(p.low));
  let band = "";
  if (hi.length > 1) {
    band = pathOf(hi.map(p => [X(monthToYear(p.t)), Y(p.high)])) +
      hi.slice().reverse().map(p => `L${f1(X(monthToYear(p.t)))} ${f1(Y(p.low))}`).join("") + "Z";
  }
  const xticks = [];
  for (let yr = Math.ceil(x0 / 5) * 5; yr <= x1; yr += 5) xticks.push({ year: yr, x: f1(X(yr)) });
  const yticks = [];
  for (let v = 0; v <= yMax; v += step) yticks.push({ value: v, y: f1(Y(v)) });
  const today = Number.isFinite(todayYear)
    ? { x: f1(X(todayYear)), y: Number.isFinite(todayValue) ? f1(Y(todayValue)) : null }
    : null;
  return {
    w, h, left, right, top, bottom, yMax, x0, x1,
    monthly: pathOf(monthly), smoothed: pathOf(smoothed), predicted: pathOf(predLine), band,
    xticks, yticks, today,
    hasSmoothed: smoothed.some(Boolean), hasPredicted: predLine.filter(Boolean).length > 1,
  };
}

// ─── Fechas y horas ─────────────────────────────────────────────────────────
const MONTHS = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const two = (n) => String(n).padStart(2, "0");

/** ISO UTC → «16 nov 2026, 13:30 UTC» (es) / «16 Nov 2026, 13:30 UTC» (en). null si no se puede leer. */
export function fmtUtc(iso, lang = "es") {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const mo = (MONTHS[lang] || MONTHS.es)[d.getUTCMonth()];
  return `${d.getUTCDate()} ${mo} ${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

/** 'YYYY-MM-DD' → «16 nov 2026». */
export function fmtDay(s, lang = "es") {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  if (!m) return null;
  return `${parseInt(m[3], 10)} ${(MONTHS[lang] || MONTHS.es)[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

/** 'YYYY-MM' → «abr 2024». */
export function fmtMonth(t, lang = "es") {
  const m = /^(\d{4})-(\d{2})/.exec(String(t || ""));
  return m ? `${(MONTHS[lang] || MONTHS.es)[parseInt(m[2], 10) - 1]} ${m[1]}` : null;
}

/** Número con coma decimal en español. */
export function fmtNum(n, lang = "es", digits = 0) {
  const v = numOrNull(n);
  if (v === null) return null;
  return v.toLocaleString(lang === "es" ? "es" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** ¿La respuesta del servidor trae algo que mostrar? (al menos una sección con datos) */
export function hasAnyData(d) {
  return !!d && typeof d === "object" && !Array.isArray(d) &&
    !!(d.sunspot_number || d.regions || d.flares_7d || d.kp || d.cycle);
}
