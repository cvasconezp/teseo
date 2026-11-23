// nowWeather.js — el tiempo de ahora en el lugar, para la pastilla «16 °C · Quito» sobre el cielo.
// Open-Meteo (CC BY 4.0, sin clave): temperatura y estado del cielo (código WMO) en este momento. A diferencia del
// pronóstico de las nubes (weather.js, que pide la altura media de la celda del modelo), aquí se pasa la altitud
// del lugar: Open-Meteo corrige la temperatura a esa altura (en una cumbre hace mucho más frío que en el valle).

export const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

/** URL de la consulta: lugar con 2 decimales (≈ 1 km) y, si se sabe, la altitud (m). */
const NOW_VARS = "temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,uv_index,visibility,cloud_cover";
export function nowUrl(lat, lon, elev) {
  // lo de ahora y, con la misma altura del lugar, las mismas variables hora a hora (de 1 h antes a 26 h después):
  // la tarjeta del tiempo las muestra cuando eliges otra hora
  const q = new URLSearchParams({ latitude: lat.toFixed(2), longitude: lon.toFixed(2), current: NOW_VARS, hourly: NOW_VARS, past_hours: "1", forecast_hours: "26", timeformat: "unixtime", wind_speed_unit: "kmh", timezone: "GMT" });
  if (Number.isFinite(elev)) q.set("elevation", String(Math.round(elev)));
  return `${OPEN_METEO}?${q}`;
}

/** Las horas del pronóstico del lugar: [{ t (s), temp, feels, rh, pop, mm (lluvia en la hora), uv, visKm, windKmh, windFrom, code, day, cloud }] (o []). */
function parseHours(h, n) {
  if (!h || !Array.isArray(h.time)) return [];
  const g = (k, i, lo, hi) => n(h[k] && h[k][i], lo, hi);
  return h.time.map((t, i) => {
    const ws = g("wind_speed_10m", i, 0), wd = g("wind_direction_10m", i, -360, 720), vis = g("visibility", i, 0);
    return {
      t: Number(t), temp: g("temperature_2m", i, -90, 70), feels: g("apparent_temperature", i, -90, 70), rh: g("relative_humidity_2m", i, 0, 100),
      pop: g("precipitation_probability", i, 0, 100), mm: g("precipitation", i, 0, 500), uv: g("uv_index", i, 0, 30), visKm: vis != null ? vis / 1000 : null, cloud: g("cloud_cover", i, 0, 100),
      windKmh: ws, windFrom: ws != null && wd != null ? ((wd % 360) + 360) % 360 : null,
      code: Number.isFinite(h.weather_code && h.weather_code[i]) ? h.weather_code[i] : null, day: !(h.is_day && h.is_day[i] === 0),
    };
  }).filter((x) => Number.isFinite(x.t));
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
    at: Number.isFinite(at) ? at : null,
    hours: parseHours(json.hourly, n),
  };
}

/** Código WMO → icono (icons.jsx) y nombre del estado. */
export function wxKind(code, day = true) {
  if (code == null) return "cloud";
  if (code === 0 || code === 1) return day ? "sun" : "moon";
  if (code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  return "cloud";
}

export const WX_NAMES = {
  es: { sun: "Despejado", moon: "Despejado", partly: "Parcialmente nublado", cloud: "Nublado", fog: "Niebla", rain: "Lluvia", snow: "Nieve", storm: "Tormenta" },
  en: { sun: "Clear", moon: "Clear", partly: "Partly cloudy", cloud: "Cloudy", fog: "Fog", rain: "Rain", snow: "Snow", storm: "Thunderstorm" },
};

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
