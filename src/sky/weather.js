// weather.js — nubes y clima para la vista Cielo: pronóstico de Open-Meteo (https://open-meteo.com,
// datos CC BY 4.0) para el lugar de «Mi cielo». Puro salvo fetchForecast(); se prueba en
// scripts/test_weather.mjs.
//
// Qué se usa: nubosidad total y por capas (bajas < 3 km, medias 3–8 km, altas > 8 km, en %), probabilidad
// de lluvia, tipo de tiempo (código OMM), lluvia (mm) y visibilidad (para dibujar la lluvia y la bruma: rainLook.js)
// y el viento en 850, 500 y 250 hPa (≈ 1,5, 5,5 y 10 km: mueve cada capa de nubes). Son salidas
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
  "weather_code", "precipitation", "visibility", "temperature_2m", "dew_point_2m",
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
    // La temperatura y el punto de rocío son, así, los de ese mismo suelo: con ellos se calcula la base de las nubes
    // (cloudBaseKm) en el mismo marco que las capas.
    elevation: "nan",
  });
  return `${OPEN_METEO}?${q}`;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Respuesta de Open-Meteo → { t: [s Unix], total, low, mid, high (fracciones 0–1 o null), precip (0–1 o null),
 * code (código OMM o null), mm (mm en la hora o null), visKm (km o null),
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
  // camino recorrido por cada capa desde la primera hora (km, este y norte): la suma del viento hora a hora. Con él las
  // nubes se desplazan de forma continua (antes el desplazamiento volvía a cero cada 6 h y el cielo cambiaba de golpe)
  const tt = h.time.map(Number), adv = {};
  for (const l of LAYERS) {
    const a = [[0, 0]];
    for (let i = 1; i < n; i++) { const dt = (tt[i] - tt[i - 1]) / 1000, u = wind[l][i - 1], v = wind[l][i]; a.push([a[i - 1][0] + ((u[0] + v[0]) / 2) * dt, a[i - 1][1] + ((u[1] + v[1]) / 2) * dt]); }
    adv[l] = a;
  }
  const raw = (k, f = 1) => { const a = h[k]; return Array.from({ length: n }, (_, i) => { const v = num(a && a[i]); return v == null ? null : v * f; }); };
  return {
    code: raw("weather_code"), mm: raw("precipitation"), visKm: raw("visibility", 0.001), tC: raw("temperature_2m"), dewC: raw("dew_point_2m"),
    t: h.time.map(Number), total: frac("cloud_cover"), low: frac("cloud_cover_low"), mid: frac("cloud_cover_mid"),
    high: frac("cloud_cover_high"), precip: frac("precipitation_probability"), wind, adv,
    lat: num(json.latitude), lon: num(json.longitude), elevation: num(json.elevation),
  };
}

/** Base de las nubes bajas usada cuando no hay temperatura y punto de rocío (km sobre el suelo del pronóstico). */
export const BASE_KM_DEFAULT = 1.5;
/**
 * Base de las nubes bajas (km sobre el suelo) por la temperatura y el punto de rocío a 2 m: el nivel de condensación por
 * ascenso, ≈ 125 m por cada grado de diferencia (fórmula de Espy; el aire que sube se enfría hasta saturarse).
 * Entre 0,2 y 3,5 km; null sin datos. Con 15 °C y punto de rocío de 9 °C: 0,75 km.
 */
export function cloudBaseKm(tC, dewC) {
  if (!Number.isFinite(tC) || !Number.isFinite(dewC)) return null;
  return Math.min(3.5, Math.max(0.2, 0.125 * Math.max(0, tC - dewC)));
}

/** Lineal entre dos valores que pueden faltar. */
const lerp = (a, b, f) => (a == null ? b : b == null ? a : a + (b - a) * f);

/**
 * Nubes en un instante (Date o s Unix): { total, low, mid, high, precip, code, mm, visKm, baseKm (base de las bajas, km
 * sobre el suelo del pronóstico, o null), wind: {low:[ve,vn],…}, t } interpolado
 * (el código de tiempo, el de la hora más cercana)
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
  const cd = fc.code ? (f < 0.5 ? fc.code[i] : fc.code[j]) : null;
  out.code = cd == null ? null : Math.round(cd);
  out.mm = fc.mm ? pick(fc.mm) : null; out.visKm = fc.visKm ? pick(fc.visKm) : null;
  out.baseKm = fc.tC && fc.dewC ? cloudBaseKm(pick(fc.tC), pick(fc.dewC)) : null;
  for (const l of LAYERS) { const a = fc.wind[l][i], b = fc.wind[l][j]; out.wind[l] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
  if (fc.adv) {
    out.adv = {};
    // (dentro de la hora, el viento va de a hacia w en línea recta: el tramo recorrido es su media por el tiempo)
    for (const l of LAYERS) { const a = fc.wind[l][i], w = out.wind[l], dt = (s - t[i]) / 1000, A = fc.adv[l][i]; out.adv[l] = [A[0] + ((a[0] + w[0]) / 2) * dt, A[1] + ((a[1] + w[1]) / 2) * dt]; }
  }
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

/**
 * La mejor ventana para observar en una serie horaria [{ t, total }]: el tramo seguido de horas más despejado.
 * Cuentan solo las horas que pasan `isNight(t)` (si se da). Se parte de la hora con menos nubes y se extiende a las
 * vecinas que no la superan en más de 15 puntos ni pasan de 50 %. Devuelve { i0, i1 (índices, inclusive), t0, t1
 * (s; t1 = fin de la última hora), min } o null si no hay horas válidas o la más despejada pasa de 50 %.
 */
export function bestWindow(series, isNight) {
  const ok = (p) => p && p.total != null && (!isNight || isNight(p.t));
  let k = -1;
  series.forEach((p, i) => { if (ok(p) && (k < 0 || p.total < series[k].total - 1e-9)) k = i; });
  if (k < 0 || series[k].total > 0.5) return null;
  const lim = Math.min(0.5, series[k].total + 0.15), fits = (i) => i >= 0 && i < series.length && ok(series[i]) && series[i].total <= lim + 1e-9;
  let i0 = k, i1 = k;
  while (fits(i0 - 1)) i0--;
  while (fits(i1 + 1)) i1++;
  return { i0, i1, t0: series[i0].t, t1: series[i1].t + 3600, min: series[k].total };
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
