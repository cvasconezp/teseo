// format.js — números en lenguaje humano, en ES y EN. Sin dependencias.
const loc = (lang) => (lang === "es" ? "es" : "en-US");
export const num = (n, lang, digits = 0) =>
  Number(n).toLocaleString(loc(lang), { maximumFractionDigits: digits, minimumFractionDigits: 0 });

// 6500 -> "6,5 mil" · 2.5e6 -> "2,5 millones" · 1.2e9 -> "1,2 mil millones"
function big(n, lang) {
  const es = lang === "es";
  const d = (v) => num(v, lang, v < 10 ? 1 : 0);
  if (n < 1e4) return num(Math.round(n), lang);
  if (n < 1e6) return `${d(n / 1e3)} ${es ? "mil" : "thousand"}`;
  if (n < 1e9) { const v = n / 1e6; return `${d(v)} ${es ? (v < 1.05 ? "millón" : "millones") : "million"}`; }
  if (n < 1e12) return `${d(n / 1e9)} ${es ? "mil millones" : "billion"}`;
  return `${d(n / 1e12)} ${es ? "billones" : "trillion"}`;
}
const de = (n, lang) => (lang === "es" && n >= 1e6 ? "de " : "");

export function fmtDist(ly, lang) {
  if (!ly || ly <= 0) return lang === "es" ? "distancia no disponible" : "distance not available";
  return `${big(ly, lang)} ${de(ly, lang)}${lang === "es" ? "años luz" : (Math.round(ly) === 1 ? "light-year" : "light-years")}`;
}
export function fmtYears(y, lang) {
  if (!y || y <= 0) return "—";
  return `${big(y, lang)} ${de(y, lang)}${lang === "es" ? "años" : "years"}`;
}
// duración a partir de segundos: "1,3 segundos", "8 minutos", "4,2 horas", "9 meses", "12 años"
export function fmtDuration(sec, lang) {
  const es = lang === "es";
  if (!(sec > 0)) return "—";
  const u = (v, one, many, digits = 1) => `${num(v, lang, v < 10 ? digits : 0)} ${Math.abs(v - 1) < 0.05 ? one : many}`;
  if (sec < 90) return u(sec, es ? "segundo" : "second", es ? "segundos" : "seconds");
  const min = sec / 60; if (min < 90) return u(min, es ? "minuto" : "minute", es ? "minutos" : "minutes");
  const h = min / 60; if (h < 48) return u(h, es ? "hora" : "hour", es ? "horas" : "hours");
  const d = h / 24; if (d < 60) return u(d, es ? "día" : "day", es ? "días" : "days", 0);
  const mo = d / 30.44; if (mo < 24) return u(mo, es ? "mes" : "month", es ? "meses" : "months", 0);
  return fmtYears(d / 365.25, lang);
}
export function fmtKm(km, lang) {
  if (km >= 1e6) return `${big(km, lang)} ${de(km, lang)}km`;
  return `${num(Math.round(km), lang)} km`;
}
export function fmtMassSun(m, lang) {
  return `${big(m, lang)} ${lang === "es" ? (m >= 1e6 ? "de " : "") + "masas solares" : "solar masses"}`;
}
// "4,3 millones de soles" · "21 soles" · "1 sol"
export function fmtSuns(m, lang) {
  const one = Math.abs(m - 1) < 0.05;
  return `${big(m, lang)} ${de(m, lang)}${lang === "es" ? (one ? "sol" : "soles") : (one ? "Sun" : "Suns")}`;
}
export const AU_KM = 149597870.7;
export const LIGHT_KM_S = 299792.458;
export const VOYAGER_KM_S = 17;                 // Voyager 1 ≈ 17 km/s respecto al Sol (NASA/JPL)
export const LY_KM = 9.4607e12;
export const SEC_PER_YEAR = 31557600;

// "jueves 12 de noviembre · 21:14"
export function fmtWhenLong(date, lang) {
  const d = date.toLocaleDateString(loc(lang) === "es" ? "es-EC" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const h = date.toLocaleTimeString(loc(lang) === "es" ? "es-EC" : "en-US", { hour: "2-digit", minute: "2-digit" });
  return { date: d.charAt(0).toUpperCase() + d.slice(1), time: h };
}
export function fmtWhenShort(date, lang) {
  return date.toLocaleString(lang === "es" ? "es-EC" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
