// timeDial.js — lógica pura del control de tiempo «tipo Stellarium» (src/sky/TimeSheet.jsx): subir o bajar
// cada campo de la fecha y la hora, velocidades del tiempo y las fases del día (noche, crepúsculo, día) en el
// lugar, para la barra de 24 horas. Se prueba en scripts/test_timedial.mjs.
import { ephemeris } from "../ephemeris.js";
import { altAz } from "./guide.js";
import { startOfDay } from "./placeTime.js";

/** Velocidades: minutos de cielo por segundo de reloj. 0 = en pausa; 1/60 = tiempo real. */
export const RATES = [-1440, -60, -10, -1, 0, 1 / 60, 1, 10, 60, 1440];
export const REAL = 5;

/** Texto de una velocidad. */
export function rateLabel(r, lang = "es") {
  const es = lang !== "en";
  if (r === 0) return es ? "En pausa" : "Paused";
  if (Math.abs(r - 1 / 60) < 1e-9) return es ? "Tiempo real" : "Real time";
  const a = Math.abs(r), back = r < 0;
  const u = a >= 1440 ? (es ? "1 día" : "1 day") : a >= 60 ? (es ? "1 hora" : "1 hour") : a >= 10 ? (es ? "10 min" : "10 min") : (es ? "1 min" : "1 min");
  return es ? `${back ? "−" : "+"}${u} por segundo` : `${back ? "−" : "+"}${u} per second`;
}

/**
 * La fecha con un campo movido `dir` (±1): year, month, day, hour, minute. Mes y año conservan el día si
 * existe (31 de enero + 1 mes → 28/29 de febrero), como un reloj de pulsera.
 */
export function stepField(date, field, dir) {
  const d = new Date(date.getTime());
  if (field === "minute") d.setMinutes(d.getMinutes() + dir);
  else if (field === "hour") d.setHours(d.getHours() + dir);
  else if (field === "day") d.setDate(d.getDate() + dir);
  else if (field === "month" || field === "year") {
    const day = d.getDate();
    d.setDate(1);
    if (field === "month") d.setMonth(d.getMonth() + dir); else d.setFullYear(d.getFullYear() + dir);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return d;
}

/** Fase del Sol según su altura: día (> −0,833°), crepúsculo (hasta −18°) o noche. */
export function phaseOf(alt) {
  if (alt > -0.833) return "day";
  if (alt > -18) return "twilight";
  return "night";
}

/** Altura del Sol (°) en un lugar e instante. */
export function sunAltAt(lat, lon, d) {
  const s = ephemeris(d).find((b) => b.name === "Sol");
  return s ? altAz(s.nx, s.ny, s.nz, lat, lon, d).alt : -90;
}

/**
 * La altura del Sol a lo largo del día local (de 00:00 a 24:00 de la fecha de `date` en la zona `tz` del lugar;
 * sin zona, la del dispositivo), `n` muestras, para pintar la barra: [{ min, alt }]. Sin lugar, null (la barra
 * va sin colores de fase).
 */
export function dayProfile(lat, lon, date, n = 48, tz = null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const d0 = startOfDay(date, tz);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const min = (i / n) * 1440;
    out.push({ min, alt: sunAltAt(lat, lon, new Date(d0.getTime() + min * 60000)) });
  }
  return out;
}

/** Color de la barra para una altura del Sol (día azul verdoso, crepúsculo de azul a negro, noche negra). */
export function phaseColor(alt) {
  const day = [44, 111, 138], night = [6, 8, 12];
  const f = alt >= 0 ? 1 : alt <= -18 ? 0 : Math.pow((alt + 18) / 18, 1.6);
  const c = day.map((x, i) => Math.round(night[i] + (x - night[i]) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Degradado CSS de la barra del día. */
export function dayGradient(profile) {
  if (!profile) return "linear-gradient(90deg,#06080c 0%,#2c6f8a 30%,#2c6f8a 70%,#06080c 100%)";
  return `linear-gradient(90deg,${profile.map((p) => `${phaseColor(p.alt)} ${((p.min / 1440) * 100).toFixed(1)}%`).join(",")})`;
}

/**
 * Nombre de la fase en un minuto del día: «Día», «Noche», «Amanecer» o «Atardecer» (el crepúsculo antes o
 * después del mediodía solar, según suba o baje el Sol).
 */
export function phaseName(profile, min, lang = "es") {
  const es = lang !== "en";
  if (!profile) return "";
  const i = Math.max(0, Math.min(profile.length - 2, Math.floor((min / 1440) * (profile.length - 1))));
  const a = profile[i].alt, b = profile[i + 1].alt, alt = a + (b - a) * (((min / 1440) * (profile.length - 1)) - i);
  const ph = phaseOf(alt);
  if (ph === "day") return es ? "Día" : "Day";
  if (ph === "night") return es ? "Noche" : "Night";
  return b >= a ? (es ? "Amanecer" : "Dawn") : (es ? "Atardecer" : "Dusk");
}
