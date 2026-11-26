// models.js — siete modelos del tiempo para el mismo punto, para la tarjeta del tiempo (WxCard.jsx).
// Open-Meteo (CC BY 4.0, sin clave) entrega en una sola consulta la temperatura hora a hora y, por día, la máxima,
// la mínima y la lluvia de varios modelos (ECMWF, GFS, ICON, Météo-France, UKMO, JMA y GEM). Con ellos:
//   · la MEDIANA es el valor que se muestra: suele fallar menos que cualquier modelo por separado;
//   · el RANGO (mínimo–máximo) dice cuánto se fía uno: si los modelos no coinciden, la tarjeta avisa.
// La altitud del lugar va en la consulta, como en nowWeather.js: cada modelo corrige su temperatura a esa altura.
// Puro salvo fetchModels(); se prueba en scripts/test_models.mjs.

import { wxKind, codeAtTemp } from "./nowWeather.js";

export const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
export const MODELS = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless", "meteofrance_seamless", "ukmo_seamless", "jma_seamless", "gem_seamless"];
/** Desde cuándo los modelos «no coinciden»: grados de diferencia entre el más frío y el más cálido, y mm de lluvia en el día. */
export const SPREAD_T = 3, SPREAD_MM = 10;

/** URL: el lugar con 2 decimales (≈ 1 km), su altitud si se sabe; de 1 h atrás a 7 días adelante, hora a hora y por día (en su hora local). */
export function modelsUrl(lat, lon, elev) {
  const q = new URLSearchParams({
    latitude: lat.toFixed(2), longitude: lon.toFixed(2), hourly: "temperature_2m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum", models: MODELS.join(","),
    past_hours: "1", forecast_hours: "168", forecast_days: "7", timeformat: "unixtime", timezone: "auto",
  });
  if (Number.isFinite(elev)) q.set("elevation", String(Math.round(elev)));
  return `${OPEN_METEO}?${q}`;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Mediana de una lista (sin los null); null si está vacía. */
export function median(xs) {
  const a = (xs || []).filter((x) => num(x) != null).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** { n, med, lo, hi } de una lista (sin los null) o null si ningún modelo trae el dato. */
export function stats(xs) {
  const a = (xs || []).filter((x) => num(x) != null);
  if (!a.length) return null;
  return { n: a.length, med: median(a), lo: Math.min(...a), hi: Math.max(...a) };
}

/**
 * Respuesta → { hours: [{ t, temps: [°C por modelo], codes: [código WMO por modelo] }], days: [{ t (s, medianoche local), tmax, tmin, mm: [por modelo] }] }
 * (cada lista, con un valor por modelo o null) o null si no trae lo esperado.
 */
export function parseModels(json) {
  const h = json && json.hourly, d = json && json.daily;
  if (!h || !Array.isArray(h.time)) return null;
  const col = (blk, k, i) => MODELS.map((m) => num(blk[`${k}_${m}`] && blk[`${k}_${m}`][i]));
  const hours = h.time.map((t, i) => ({ t: Number(t), temps: col(h, "temperature_2m", i), codes: col(h, "weather_code", i) })).filter((x) => Number.isFinite(x.t));
  const days = d && Array.isArray(d.time)
    ? d.time.map((t, i) => ({ t: Number(t), tmax: col(d, "temperature_2m_max", i), tmin: col(d, "temperature_2m_min", i), mm: col(d, "precipitation_sum", i) })).filter((x) => Number.isFinite(x.t))
    : [];
  if (!hours.some((x) => x.temps.some((v) => v != null))) return null;
  return { hours, days };
}

/** La temperatura de los modelos en `s` (s Unix), interpolada entre las dos horas que la rodean: stats() o null. */
export function tempAt(mod, s) {
  const hs = mod && mod.hours;
  if (!hs || !hs.length || !Number.isFinite(s)) return null;
  let i = hs.findIndex((x) => x.t > s);
  if (i === 0) return s >= hs[0].t - 1800 ? stats(hs[0].temps) : null;
  if (i < 0) { const last = hs[hs.length - 1]; return s <= last.t + 1800 ? stats(last.temps) : null; }
  const a = hs[i - 1], b = hs[i], f = (s - a.t) / (b.t - a.t);
  return stats(MODELS.map((_, k) => (a.temps[k] != null && b.temps[k] != null ? a.temps[k] + (b.temps[k] - a.temps[k]) * f : null)));
}

/**
 * QUÉ CIELO DAN LOS MODELOS a la hora más cercana a `s` (±30 min): cada uno vota por lo suyo —lluvia, aguanieve,
 * nieve, tormenta o seco (despejado, nubes, niebla)—, con su código pasado por su propia temperatura (nieve o
 * aguanieve en frío, nowWeather.codeAtTemp). { n, counts: { rain, sleet, snow, storm, dry } } o null con menos de 3.
 * Para el icono (nowWeather.voteIcon: por mayoría) y la barra de acuerdo de la tarjeta.
 */
export function skyVote(mod, s) {
  const hs = mod && mod.hours;
  if (!hs || !hs.length || !Number.isFinite(s)) return null;
  let best = null, bd = Infinity;
  for (const x of hs) { const d = Math.abs(x.t - s); if (d < bd) { bd = d; best = x; } }
  if (!best || bd > 1800 || !best.codes) return null;
  const counts = { rain: 0, sleet: 0, snow: 0, storm: 0, dry: 0 };
  let n = 0;
  best.codes.forEach((c, k) => {
    if (c == null) return;
    const kind = wxKind(codeAtTemp(c, best.temps ? best.temps[k] : null));
    counts[kind in counts ? kind : "dry"]++; n++;
  });
  return n >= 3 ? { n, counts } : null;
}

/** El día (de los modelos) que contiene `s`: { t, tmax, tmin, mm } con stats() en cada uno, o null. */
export function dayAt(mod, s) {
  const ds = mod && mod.days;
  if (!ds || !ds.length || !Number.isFinite(s)) return null;
  const d = ds.find((x, i) => s >= x.t && s < (ds[i + 1] ? ds[i + 1].t : x.t + 86400));
  return d ? { t: d.t, tmax: stats(d.tmax), tmin: stats(d.tmin), mm: stats(d.mm) } : null;
}

/**
 * ¿Coinciden los modelos? Con la temperatura de esa hora (stats) y la lluvia de ese día (stats): null si coinciden
 * (o faltan datos), o { t: [lo, hi] | null, mm: [lo, hi] | null } con lo que no coincide. Hacen falta al menos 3 modelos.
 */
export function disagreement(temp, mm, vote = null) {
  const tOff = temp && temp.n >= 3 && temp.hi - temp.lo >= SPREAD_T;
  const mOff = mm && mm.n >= 3 && mm.hi - mm.lo >= SPREAD_MM;
  // (y el cielo: si 3 o más dan que cae algo y 3 o más que no —en 7, un 4 contra 3—, no coinciden en si llueve)
  const wet = vote ? vote.n - vote.counts.dry : 0, skyOff = !!(vote && vote.n >= 3 && Math.min(wet, vote.counts.dry) >= 3);
  if (!tOff && !mOff && !skyOff) return null;
  return { t: tOff || mOff ? (temp && temp.n >= 3 ? [temp.lo, temp.hi] : null) : null, mm: tOff || mOff ? (mm && mm.n >= 3 ? [mm.lo, mm.hi] : null) : null, sky: skyOff, skyN: vote ? vote.n : 0,
    n: Math.max(temp ? temp.n : 0, mm ? mm.n : 0, vote ? vote.n : 0) };
}

// ── red ──────────────────────────────────────────────────────────────────────────────────────────────────
const cache = new Map();   // url → { at, data } | { at, promise }
const TTL_MS = 30 * 60 * 1000;

/** Los modelos del punto (cacheados 30 min por lugar y altura). Rechaza con Error si Open-Meteo falla. */
export function fetchModels(lat, lon, elev, { fetchImpl = (typeof fetch !== "undefined" ? fetch : null), now = Date.now() } = {}) {
  const url = modelsUrl(lat, lon, elev);
  const hit = cache.get(url);
  if (hit && now - hit.at < TTL_MS) return hit.promise || Promise.resolve(hit.data);
  if (!fetchImpl) return Promise.reject(new Error("sin red"));
  const promise = fetchImpl(url).then(async (r) => {
    let body = null;
    try { body = await r.json(); } catch { /* cuerpo no JSON */ }
    if (!r.ok) throw new Error((body && body.reason) || `Open-Meteo respondió HTTP ${r.status}`);
    const data = parseModels(body);
    if (!data) throw new Error("modelos sin datos");
    return data;
  });
  cache.set(url, { at: now, promise });
  promise.then((data) => cache.set(url, { at: now, data }), () => cache.delete(url));
  return promise;
}
