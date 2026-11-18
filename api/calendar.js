// api/calendar.js — función de Vercel: calendario de SUSCRIPCIÓN del Calendario del cielo.
//   https://teseo.yachaydeep.com/cal/teseo.ics?lat=0.04&lon=-78.15&lang=es&tz=America/Guayaquil
// (vercel.json reescribe /cal/teseo.ics → /api/calendar). Google Calendar, iPhone y Outlook lo vuelven a leer
// cada pocas horas. El cálculo es el mismo de la app (src/now/calendar/feed.js); los lanzamientos y las pasadas
// de la ISS vienen del backend de Railway y, si fallan, el calendario sale sin ellos.
// Privacidad: el lugar llega redondeado a 0,01° (~1 km); no se guarda nada y no se registran las coordenadas.
import { readFile } from "node:fs/promises";
import { buildFeed, parseFeedQuery } from "../src/now/calendar/feed.js";

const API = (process.env.TESEO_API || process.env.VITE_API_URL || "https://teseo-production.up.railway.app").replace(/\/+$/, "");

async function getJson(url, ms = 6000) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: "application/json" } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function loadShowers() {
  try { return JSON.parse(await readFile(new URL("../public/meteorshowers.json", import.meta.url), "utf8")).objects || []; }
  catch { const d = await getJson("https://teseo.yachaydeep.com/meteorshowers.json"); return (d && d.objects) || []; }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "https://teseo.yachaydeep.com");
  const q = parseFeedQuery(url.searchParams);
  if (!q) {
    res.statusCode = 400;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Teseo: falta el lugar (lat, lon). / Missing place (lat, lon).\n");
    return;
  }
  const iss = new URLSearchParams({ lat: String(q.lat), lon: String(q.lon), alt_m: "0", days: "10" });
  const [showers, launches, passes] = await Promise.all([
    loadShowers(),
    getJson(`${API}/api/launches?limit=20`),
    getJson(`${API}/api/iss/passes?${iss}`),
  ]);
  const body = buildFeed({
    ...q, now: Date.now(), showers,
    launches: Array.isArray(launches && launches.launches) ? launches.launches : [],
    issPasses: Array.isArray(passes && passes.passes) ? passes.passes : [],
  });
  res.statusCode = 200;
  res.setHeader("content-type", "text/calendar; charset=utf-8");
  res.setHeader("content-disposition", 'inline; filename="teseo.ics"');
  // la CDN de Vercel lo guarda 6 h por enlace: muchos teléfonos suscritos al mismo lugar no recalculan
  res.setHeader("cache-control", "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("x-robots-tag", "noindex");
  res.end(body);
}
