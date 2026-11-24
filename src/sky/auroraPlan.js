// auroraPlan.js — planificador de noches de aurora (puro; se prueba en scripts/test_aurora.mjs).
//
// Para un lugar y unas fechas, cada media hora de cada noche cruza:
//   · oscuridad: el Sol bajo −12° (con el cielo aún claro la aurora débil no se ve);
//   · la Luna: alta y llena resta contraste (aurora.darkness);
//   · las nubes: el pronóstico horario de Open-Meteo (hasta 16 días; más allá, «sin pronóstico»);
//   · la actividad: el Kp de NOAA SWPC (observado o pronosticado, ~3 días); más allá, una actividad habitual (Kp 2),
//     marcada como estimada. Con el Kp, la probabilidad sobre el lugar sale del óvalo estimado (aurora.probModel).
// La puntuación de cada media hora es probabilidad × cielo despejado × oscuridad; la de la noche, la mejor media hora.
import { geoToMag, mlt, probModel, darkness, kpAt } from "./aurora.js";

export const KP_TYPICAL = 2;
const STEP = 30 * 60e3;

/** Mediodía solar (aprox.) del día de `date` en ese lugar, como instante UTC. */
function localNoon(date, lon) {
  const offMs = (lon / 15) * 3600e3;
  const loc = new Date(date.getTime() + offMs);
  return Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate(), 12) - offMs;
}

/**
 * opts: { lat, lon, start: Date, nights (≤ 21), dp (aurora.dipole), sun(date) → alt°, moon(date) → { alt, illum },
 *         cloud(date) → 0–1 | null, kpSeries ([{t, kp, kind}] de NOAA) }.
 * → [{ day: Date (mediodía local), dark: bool, hours: [...], best: { t, score, p, cloud, moonAlt, moonIllum, kp, kind } | null,
 *      kind: "forecast" | "estimated" }]
 */
export function planNights({ lat, lon, start, nights = 7, dp, sun, moon, cloud, kpSeries = null }) {
  const me = geoToMag(lat, lon, dp), am = Math.abs(me.mlat);
  const out = [];
  let noon = localNoon(start, lon);
  if (start.getTime() - noon > 12 * 3600e3) noon += 24 * 3600e3;
  for (let n = 0; n < Math.min(21, nights); n++, noon += 24 * 3600e3) {
    const hours = [];
    let best = null, anyForecast = false;
    for (let t = noon; t < noon + 24 * 3600e3; t += STEP) {
      const d = new Date(t), sa = sun(d);
      if (sa > -12) continue;
      const mo = moon(d) || { alt: -90, illum: 0 };
      const k = kpAt(kpSeries, d);
      const kp = k ? k.kp : KP_TYPICAL, kind = k ? k.kind : "typical";
      if (k) anyForecast = true;
      const p = probModel(kp, am, mlt(me.mlon, d, dp));
      const c = cloud ? cloud(d) : null;
      const dk = darkness(sa, mo.alt, mo.illum);
      const score = (p / 100) * (c == null ? 1 : 1 - c) * dk;
      const h = { t: d, p, cloud: c, moonAlt: mo.alt, moonIllum: mo.illum, kp, kind, score };
      hours.push(h);
      if (!best || score > best.score) best = h;
    }
    out.push({ day: new Date(noon), dark: hours.length > 0, hours, best, kind: anyForecast ? "forecast" : "estimated" });
  }
  return out;
}

/** Puntuación de una noche en cinco niveles (0–4) para mostrarla con barras. */
export function scoreLevel(s) {
  if (!(s > 0.005)) return 0;
  if (s < 0.05) return 1;
  if (s < 0.15) return 2;
  if (s < 0.35) return 3;
  return 4;
}
