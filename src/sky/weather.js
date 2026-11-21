// weather.js — nubes y clima para la vista Cielo: pronóstico de Open-Meteo (https://open-meteo.com,
// datos CC BY 4.0) para el lugar de «Mi cielo». Puro salvo fetchForecast(); se prueba en
// scripts/test_weather.mjs.
//
// Qué se usa: nubosidad total y por capas (bajas < 3 km, medias 3–8 km, altas > 8 km, en %), probabilidad
// de lluvia y el viento en 850, 500 y 250 hPa (≈ 1,5, 5,5 y 10 km: mueve cada capa de nubes). Son salidas
// de modelos numéricos (que asimilan datos de satélite): la CANTIDAD y la ALTURA de las nubes son las del
// pronóstico; la forma que dibuja el cielo es ilustrativa.
//
// La petición sale del navegador directo a Open-Meteo (permite CORS y cada visitante usa su propia cuota
// gratuita; sin claves). El lugar va redondeado a 0,1° (≈ 11 km), que es más fino que la malla del modelo.

export const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
export const PAST_DAYS = 2, FORECAST_DAYS = 8;
export const LAYERS = ["low", "mid", "high"];
/** Altura típica de la base de cada capa (km), para la perspectiva del dibujo. */
export const LAYER_KM = { low: 1.5, mid: 4.5, high: 9 };
const WIND_LEVEL = { low: "850hPa", mid: "500hPa", high: "250hPa" };
const HOURLY = ["cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "precipitation_probability",
  ...LAYERS.flatMap((l) => [`wind_speed_${WIND_LEVEL[l]}`, `wind_direction_${WIND_LEVEL[l]}`])];

const round1 = (v) => Math.round(v * 10) / 10;

/** URL de la consulta (lugar redondeado a 0,1°). */
export function forecastUrl(lat, lon) {
  const q = new URLSearchParams({
    latitude: String(round1(lat)), longitude: String(round1(lon)),
    hourly: HOURLY.join(","), past_days: String(PAST_DAYS), forecast_days: String(FORECAST_DAYS),
    timezone: "GMT", timeformat: "unixtime", wind_speed_unit: "ms",
    // sin «downscaling»: la altura que devuelve es la media de la celda del modelo, el suelo desde el que se miden
    // las capas de nubes (con ella, desde una cumbre las bajas quedan por debajo; ver cloudLift en cloudsLayer.js).
    // Solo cambia la temperatura, que aquí no se usa.
    elevation: "nan",
  });
  return `${OPEN_METEO}?${q}`;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Respuesta de Open-Meteo → { t: [s Unix], total, low, mid, high (fracciones 0–1 o null), precip (0–1 o null),
 * wind: { low|mid|high: [[ve, vn] m/s hacia donde va] } }. Lanza si no tiene la forma esperada.
 */
export function parseForecast(json) {
  const h = json && json.hourly;
  if (!h || !Array.isArray(h.time) || !h.time.length) throw new Error("pronóstico sin datos horarios");
  const n = h.time.length;
  const frac = (k) => { const a = h[k]; return Array.from({ length: n }, (_, i) => { const v = num(a && a[i]); return v == null ? null : Math.min(1, Math.max(0, v / 100)); }); };
  const wind = {};
  for (const l of LAYERS) {
    const sp = h[`wind_speed_${WIND_LEVEL[l]}`], dir = h[`wind_direction_${WIND_LEVEL[l]}`];
    wind[l] = Array.from({ length: n }, (_, i) => {
      const s = num(sp && sp[i]), d = num(dir && dir[i]);
      if (s == null || d == null) return [0, 0];
      const a = (d * Math.PI) / 180;               // dirección DE DONDE sopla, desde el norte hacia el este
      return [-s * Math.sin(a), -s * Math.cos(a)];  // velocidad hacia donde va: (este, norte)
    });
  }
  return {
    t: h.time.map(Number), total: frac("cloud_cover"), low: frac("cloud_cover_low"), mid: frac("cloud_cover_mid"),
    high: frac("cloud_cover_high"), precip: frac("precipitation_probability"), wind,
    lat: num(json.latitude), lon: num(json.longitude), elevation: num(json.elevation),
  };
}

/** Lineal entre dos valores que pueden faltar. */
const lerp = (a, b, f) => (a == null ? b : b == null ? a : a + (b - a) * f);

/**
 * Nubes en un instante (Date o s Unix): { total, low, mid, high, precip, wind: {low:[ve,vn],…}, t } interpolado
 * entre horas, o null si cae fuera del pronóstico (más de una hora antes del primer dato o después del último).
 */
export function cloudsAt(fc, when) {
  if (!fc || !fc.t.length) return null;
  const s = when instanceof Date ? when.getTime() / 1000 : Number(when);
  const t = fc.t, n = t.length;
  if (!(s >= t[0] - 3600 && s <= t[n - 1] + 3600)) return null;
  let i = 0;
  if (s >= t[n - 1]) i = n - 1;
  else if (s > t[0]) { let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= s) lo = m; else hi = m; } i = lo; }
  const j = Math.min(n - 1, i + 1), f = j === i ? 0 : Math.min(1, Math.max(0, (s - t[i]) / (t[j] - t[i])));
  const pick = (a) => lerp(a[i], a[j], f);
  const out = { t: s, total: pick(fc.total), low: pick(fc.low), mid: pick(fc.mid), high: pick(fc.high), precip: pick(fc.precip), wind: {} };
  for (const l of LAYERS) { const a = fc.wind[l][i], b = fc.wind[l][j]; out.wind[l] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
  if (out.total == null) {   // sin total: el de capas que se solapan al azar
    const p = LAYERS.map((l) => out[l]).filter((v) => v != null);
    out.total = p.length ? 1 - p.reduce((acc, v) => acc * (1 - v), 1) : null;
  }
  return out.total == null ? null : out;
}

/** Categoría de nubosidad (fracción 0–1) según los octas de la OMM: 0 despejado … 4 cubierto. */
export function coverClass(f) {
  if (f == null) return null;
  const okta = Math.round(f * 8);
  return okta <= 0 ? 0 : okta <= 2 ? 1 : okta <= 4 ? 2 : okta <= 7 ? 3 : 4;
}

/**
 * Próximo cambio claro a partir de `from` (s), dentro de `hours`: { kind: "clears"|"clouds", t } cuando la
 * nubosidad total baja de 30 % (si ahora está sobre 60 %) o sube de 60 % (si ahora está bajo 30 %); si no, null.
 */
export function nextChange(fc, from, hours = 12) {
  const c0 = cloudsAt(fc, from); if (!c0) return null;
  const want = c0.total >= 0.6 ? "clears" : c0.total < 0.3 ? "clouds" : null;
  if (!want) return null;
  for (let k = 1; k <= hours; k++) {
    const c = cloudsAt(fc, from + k * 3600); if (!c) return null;
    if (want === "clears" && c.total < 0.3) return { kind: want, t: from + k * 3600 };
    if (want === "clouds" && c.total >= 0.6) return { kind: want, t: from + k * 3600 };
  }
  return null;
}

/**
 * La hora con menos nubes entre las que pasa `isNight(s)` en las próximas `hours` (en punto): { t, total } o null.
 * A igualdad gana la primera.
 */
export function bestNightHour(fc, from, isNight, hours = 24) {
  let best = null;
  const h0 = Math.ceil(from / 3600) * 3600;
  for (let k = 0; k < hours; k++) {
    const s = h0 + k * 3600;
    if (!isNight(s)) continue;
    const c = cloudsAt(fc, s); if (!c) continue;
    if (!best || c.total < best.total - 1e-9) best = { t: s, total: c.total };
  }
  return best;
}

/** Serie horaria de nubosidad total desde `from` (s): [{ t, total }] (las horas sin dato, total null). */
export function hourlySeries(fc, from, hours = 24) {
  const h0 = Math.floor(from / 3600) * 3600, out = [];
  for (let k = 0; k < hours; k++) { const c = cloudsAt(fc, h0 + k * 3600); out.push({ t: h0 + k * 3600, total: c ? c.total : null }); }
  return out;
}

// ── red ──────────────────────────────────────────────────────────────────────────────────────────────────
const cache = new Map();   // url → { at, data } | { at, promise }
const TTL_MS = 30 * 60 * 1000;

/** Pronóstico del lugar (cacheado 30 min por celda de 0,1°). Rechaza con Error si Open-Meteo falla. */
export function fetchForecast(lat, lon, { fetchImpl = (typeof fetch !== "undefined" ? fetch : null), now = Date.now() } = {}) {
  const url = forecastUrl(lat, lon);
  const hit = cache.get(url);
  if (hit && now - hit.at < TTL_MS) return hit.promise || Promise.resolve(hit.data);
  if (!fetchImpl) return Promise.reject(new Error("sin red"));
  const promise = fetchImpl(url).then(async (r) => {
    let body = null;
    try { body = await r.json(); } catch { /* cuerpo no JSON */ }
    if (!r.ok) throw new Error((body && body.reason) || `Open-Meteo respondió HTTP ${r.status}`);
    return parseForecast(body);
  });
  cache.set(url, { at: now, promise });
  promise.then((data) => cache.set(url, { at: now, data }), () => cache.delete(url));
  return promise;
}
