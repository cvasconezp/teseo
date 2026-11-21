// nowWeather.js — el tiempo de ahora en el lugar, para la pastilla «16 °C · Quito» sobre el cielo.
// Open-Meteo (CC BY 4.0, sin clave): temperatura y estado del cielo (código WMO) en este momento. A diferencia del
// pronóstico de las nubes (weather.js, que pide la altura media de la celda del modelo), aquí se pasa la altitud
// del lugar: Open-Meteo corrige la temperatura a esa altura (en una cumbre hace mucho más frío que en el valle).

export const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

/** URL de la consulta: lugar con 2 decimales (≈ 1 km) y, si se sabe, la altitud (m). */
export function nowUrl(lat, lon, elev) {
  const q = new URLSearchParams({ latitude: lat.toFixed(2), longitude: lon.toFixed(2), current: "temperature_2m,weather_code,is_day", timezone: "GMT" });
  if (Number.isFinite(elev)) q.set("elevation", String(Math.round(elev)));
  return `${OPEN_METEO}?${q}`;
}

/** Respuesta → { temp (°C), code (WMO), day (bool) } o null si no trae lo esperado. */
export function parseNow(json) {
  const c = json && json.current;
  if (!c || typeof c.temperature_2m !== "number" || !Number.isFinite(c.temperature_2m)) return null;
  return { temp: c.temperature_2m, code: Number.isFinite(c.weather_code) ? c.weather_code : null, day: c.is_day !== 0 };
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
