// nowWeather.js — el tiempo de ahora en el lugar, para la pastilla «16 °C · Quito» sobre el cielo.
// Open-Meteo (CC BY 4.0, sin clave): temperatura y estado del cielo (código WMO) en este momento. A diferencia del
// pronóstico de las nubes (weather.js, que pide la altura media de la celda del modelo), aquí se pasa la altitud
// del lugar: Open-Meteo corrige la temperatura a esa altura (en una cumbre hace mucho más frío que en el valle).

export const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

/** URL de la consulta: lugar con 2 decimales (≈ 1 km) y, si se sabe, la altitud (m). */
const NOW_VARS = "temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,uv_index,visibility,cloud_cover,dew_point_2m,pressure_msl";
// y los próximos 7 días (en la hora local del lugar: timezone=auto; las horas siguen en s Unix)
const DAY_VARS = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum";
export function nowUrl(lat, lon, elev) {
  // lo de ahora y, con la misma altura del lugar, las mismas variables hora a hora (de 1 h antes a 7 días después):
  // la tarjeta del tiempo las muestra cuando eliges otra hora; y los 7 días, para su franja de días
  const q = new URLSearchParams({ latitude: lat.toFixed(2), longitude: lon.toFixed(2), current: NOW_VARS, hourly: NOW_VARS, daily: DAY_VARS, past_hours: "1", forecast_hours: "168", forecast_days: "7", timeformat: "unixtime", wind_speed_unit: "kmh", timezone: "auto" });
  if (Number.isFinite(elev)) q.set("elevation", String(Math.round(elev)));
  return `${OPEN_METEO}?${q}`;
}

/** Las horas del pronóstico del lugar: [{ t (s), temp, feels, rh, dew (punto de rocío), hPa (presión a nivel del mar), pop, mm (lluvia en la hora), uv, visKm, windKmh, windFrom, code, day, cloud }] (o []). */
function parseHours(h, n) {
  if (!h || !Array.isArray(h.time)) return [];
  const g = (k, i, lo, hi) => n(h[k] && h[k][i], lo, hi);
  return h.time.map((t, i) => {
    const ws = g("wind_speed_10m", i, 0), wd = g("wind_direction_10m", i, -360, 720), vis = g("visibility", i, 0);
    return {
      t: Number(t), temp: g("temperature_2m", i, -90, 70), feels: g("apparent_temperature", i, -90, 70), rh: g("relative_humidity_2m", i, 0, 100),
      dew: g("dew_point_2m", i, -90, 50), hPa: g("pressure_msl", i, 800, 1100),
      pop: g("precipitation_probability", i, 0, 100), mm: g("precipitation", i, 0, 500), uv: g("uv_index", i, 0, 30), visKm: vis != null ? vis / 1000 : null, cloud: g("cloud_cover", i, 0, 100),
      windKmh: ws, windFrom: ws != null && wd != null ? ((wd % 360) + 360) % 360 : null,
      code: Number.isFinite(h.weather_code && h.weather_code[i]) ? h.weather_code[i] : null, day: !(h.is_day && h.is_day[i] === 0),
    };
  }).filter((x) => Number.isFinite(x.t));
}

/** Los días del pronóstico del lugar: [{ t (s, medianoche local), code, tmax, tmin, mm (lluvia del día) }] (o []). */
function parseDays(d, n) {
  if (!d || !Array.isArray(d.time)) return [];
  const g = (k, i, lo, hi) => n(d[k] && d[k][i], lo, hi);
  return d.time.map((t, i) => ({
    t: Number(t), code: Number.isFinite(d.weather_code && d.weather_code[i]) ? d.weather_code[i] : null,
    tmax: g("temperature_2m_max", i, -90, 70), tmin: g("temperature_2m_min", i, -90, 70), mm: g("precipitation_sum", i, 0, 2000),
  })).filter((x) => Number.isFinite(x.t));
}

/** La hora del pronóstico que corresponde a `s` (s Unix): la que la contiene (±30 min), o null. */
export function hourAt(hours, s) {
  if (!hours || !hours.length || !Number.isFinite(s)) return null;
  let best = null, bd = Infinity;
  for (const x of hours) { const d = Math.abs(x.t - s); if (d < bd) { bd = d; best = x; } }
  return bd <= 1800 ? best : null;
}

/** Respuesta → { temp (°C), code (WMO), day (bool) } o null si no trae lo esperado. */
export function parseNow(json) {
  const c = json && json.current;
  if (!c || typeof c.temperature_2m !== "number" || !Number.isFinite(c.temperature_2m)) return null;
  const ws = Number.isFinite(c.wind_speed_10m) && c.wind_speed_10m >= 0 ? c.wind_speed_10m : null;
  const wd = ws != null && Number.isFinite(c.wind_direction_10m) ? ((c.wind_direction_10m % 360) + 360) % 360 : null;
  const n = (v, lo = -Infinity, hi = Infinity) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
  // la hora del dato (s Unix con timeformat=unixtime; texto UTC «2026-11-23T01:45» si se pidió sin él)
  const at = typeof c.time === "number" ? c.time * 1000 : typeof c.time === "string" ? Date.parse(c.time.length === 16 ? `${c.time}:00Z` : c.time) : NaN;
  // windKmh: velocidad a 10 m del suelo; windFrom: de dónde viene (grados desde el norte hacia el este), como en meteorología.
  // Para la tarjeta: feels (sensación, °C), rh (humedad, %), pop (probabilidad de lluvia, %), uv, visKm, cloud (%)
  return {
    temp: c.temperature_2m, code: Number.isFinite(c.weather_code) ? c.weather_code : null, day: c.is_day !== 0, windKmh: ws, windFrom: wd,
    feels: n(c.apparent_temperature, -90, 70), rh: n(c.relative_humidity_2m, 0, 100), pop: n(c.precipitation_probability, 0, 100),
    uv: n(c.uv_index, 0, 30), visKm: n(c.visibility, 0) != null ? c.visibility / 1000 : null, cloud: n(c.cloud_cover, 0, 100),
    dew: n(c.dew_point_2m, -90, 50), hPa: n(c.pressure_msl, 800, 1100),
    at: Number.isFinite(at) ? at : null,
    hours: parseHours(json.hourly, n),
    days: parseDays(json.daily, n),
  };
}

/** Código WMO → icono (icons.jsx) y nombre del estado. */
export function wxKind(code, day = true) {
  if (code == null) return "cloud";
  if (code === 0 || code === 1) return day ? "sun" : "moon";
  if (code === 2) return day ? "partly" : "partly_night";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  return "cloud";
}

export const WX_NAMES = {
  es: { sun: "Despejado", moon: "Despejado", partly: "Parcialmente nublado", partly_night: "Parcialmente nublado", cloud: "Nublado", fog: "Niebla", rain: "Lluvia", snow: "Nieve", storm: "Tormenta" },
  en: { sun: "Clear", moon: "Clear", partly: "Partly cloudy", partly_night: "Partly cloudy", cloud: "Cloudy", fog: "Fog", rain: "Rain", snow: "Snow", storm: "Thunderstorm" },
};
/** «posible lluvia» y compañía: lo que el pronóstico da con poca probabilidad (marca pequeña junto al icono). */
export const WX_MAYBE = {
  es: { rain: "posible lluvia", snow: "posible nieve", storm: "posible tormenta" },
  en: { rain: "chance of rain", snow: "chance of snow", storm: "chance of thunderstorms" },
};

/** Lo que moja, de menos a más severo (para elegir el peor). */
export const WET = { rain: 1, snow: 2, storm: 3 };
/** Probabilidad (%) por debajo de la cual la lluvia, la nieve o la tormenta de una hora solo se marcan como posibles. */
export const MAYBE_POP = 30;
const nubes = (cloud, day) => (cloud != null && cloud < 25 ? (day ? "sun" : "moon") : cloud != null && cloud < 70 ? (day ? "partly" : "partly_night") : "cloud");

/**
 * Icono de una hora: { kind, maybe }. El código de la hora dice cómo llovería SI llueve; con poca probabilidad (< 30 %)
 * el icono es el de sus nubes (cloud, %) y la lluvia, la nieve o la tormenta va como marca pequeña (maybe).
 */
export function wxIcon(code, day = true, pop = null, cloud = null) {
  const k = wxKind(code, day);
  if (WET[k] && pop != null && pop < MAYBE_POP) return { kind: nubes(cloud, day), maybe: k };
  return { kind: k, maybe: null };
}

/**
 * Icono de un día que represente el día, no su peor hora: con sus horas (hours de parseNow; hacen falta 12 o más),
 * lluvia, nieve o tormenta solo si se esperan en 3 horas o más (con 40 % o más de probabilidad); si no, el de sus nubes
 * de día (o niebla, si dura), y la marca pequeña de lo que pueda caer (30 % o más). Sin horas, el código del día.
 */
export function dayIcon(d, hours) {
  const hs = (hours || []).filter((h) => h.t >= d.t && h.t < d.t + 86400);
  if (hs.length < 12) return { kind: wxKind(d.code, true), maybe: null };
  const kOf = (h) => wxKind(h.code, true);
  const worst = (arr) => arr.reduce((best, h) => { const k = kOf(h); return (WET[k] || 0) > (WET[best] || 0) ? k : best; }, null);
  const wet = hs.filter((h) => WET[kOf(h)] && (h.pop == null || h.pop >= 40));
  if (wet.length >= 3) return { kind: worst(wet), maybe: null };
  const lit = hs.filter((h) => h.day), base = lit.length ? lit : hs;
  const cl = base.map((h) => h.cloud).filter((v) => v != null);
  const fog = base.filter((h) => kOf(h) === "fog").length >= 3;
  const kind = fog ? "fog" : cl.length ? nubes(cl.reduce((a, b) => a + b, 0) / cl.length, true) : (WET[wxKind(d.code, true)] ? "cloud" : wxKind(d.code, true));
  const may = hs.filter((h) => WET[kOf(h)] && (h.pop == null || h.pop >= MAYBE_POP));
  return { kind, maybe: may.length ? worst(may) : null };
}

/** «16 °C» (o «−3 °C»), redondeado al grado. */
export const fmtTemp = (t) => `${Math.round(t) === 0 ? 0 : Math.round(t)}`.replace("-", "−") + " °C";

const ROSE = { es: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"], en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] };
const ROSE_LONG = {
  es: ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"],
  en: ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"],
};
/** Rumbo (grados) → «NE» (o, con long, «noreste»), en 8 rumbos. */
export function compass8(deg, lang = "es", long = false) {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return ((long ? ROSE_LONG : ROSE)[lang] || (long ? ROSE_LONG : ROSE).es)[i];
}
/** «12 km/h» (redondeado; en calma, «0 km/h»). */
export const fmtWind = (kmh) => `${Math.round(kmh)} km/h`;
/** Texto largo: «Viento del noreste, 12 km/h» / «Calma». */
export function windText(now, lang = "es") {
  if (!now || now.windKmh == null) return "";
  if (now.windKmh < 1 || now.windFrom == null) return lang === "en" ? "Calm" : "Calma";
  return lang === "en" ? `Wind from the ${compass8(now.windFrom, "en", true)}, ${fmtWind(now.windKmh)}` : `Viento del ${compass8(now.windFrom, "es", true)}, ${fmtWind(now.windKmh)}`;
}
/** El viento como vector (m/s; [hacia el este, hacia el norte]) o null: hacia dónde sopla. */
export function windVector(now) {
  if (!now || now.windKmh == null || now.windFrom == null || now.windKmh < 1) return null;
  const sp = now.windKmh / 3.6, a = (now.windFrom * Math.PI) / 180;
  return [-sp * Math.sin(a), -sp * Math.cos(a)];
}

/** El dato del tiempo guardado ({ ...w, place: { lat, lon } }) solo si es de este lugar o de uno a menos de ~5 km
 *  (puntos de un mismo sitio: si el servicio limita la consulta nueva, se conserva el de al lado); si no, null. Así,
 *  si la consulta del lugar nuevo falla, la pastilla no muestra el tiempo de otra ciudad con el nombre del nuevo. */
export const NEAR_DEG = 0.05;
export function wxForPlace(w, lat, lon) {
  if (!w || !w.place || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return Math.abs(w.place.lat - lat) <= NEAR_DEG && Math.abs(w.place.lon - lon) <= NEAR_DEG ? w : null;
}
