// feed.js — calendario de SUSCRIPCIÓN del Calendario del cielo (Google Calendar, iPhone, Outlook…).
// Lo sirve la función de Vercel api/calendar.js en https://teseo.yachaydeep.com/cal/teseo.ics?lat=…&lon=…
// Usa exactamente el mismo cálculo que la tarjeta de la app (events.js + i18n.js); aquí solo se arma el .ics.
// Puro (sin red ni navegador): se prueba en scripts/test_calendar_feed.mjs.
import { buildSkyEvents, buildFeedEvents, sortEvents, TYPES } from "./events.js";
import { describeEvent, TC } from "./i18n.js";
import { buildCalendar } from "./ics.js";

const DAY = 86400000;
export const FEED_DAYS = 365;
export const FEED_PATH = "/cal/teseo.ics";
export const FEED_ORIGIN = "https://teseo.yachaydeep.com";

/** Lugar del enlace redondeado a 0,01° (~1 km): basta para el cielo y no delata una casa. */
export const roundCoord = (x) => Math.round(Number(x) * 100) / 100;

const validTz = (tz) => { try { if (!tz) return null; new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return null; } };

/** Lee y valida los parámetros del enlace. Devuelve null si el lugar no es válido. */
export function parseFeedQuery(q) {
  const get = (k) => (q && typeof q.get === "function" ? q.get(k) : q ? q[k] : null);
  const rawLat = get("lat"), rawLon = get("lon");
  if (rawLat == null || rawLon == null || String(rawLat).trim() === "" || String(rawLon).trim() === "") return null;
  const lat = Number(rawLat), lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const lang = get("lang") === "en" ? "en" : "es";
  const tz = validTz(get("tz")) || "America/Guayaquil";
  const want = String(get("t") || "").split(",").filter(k => TYPES.includes(k));
  const name = String(get("name") || "").replace(/[^\p{L}\p{N} .,'-]/gu, "").slice(0, 40) || null;
  return { lat: roundCoord(lat), lon: roundCoord(lon), lang, tz, types: want.length ? want : null, name };
}

/** Enlace de suscripción (https) para un lugar. */
export function feedUrl({ lat, lon, lang = "es", tz, name } = {}, origin = FEED_ORIGIN) {
  const p = new URLSearchParams({ lat: String(roundCoord(lat)), lon: String(roundCoord(lon)), lang });
  if (tz) p.set("tz", tz);
  if (name) p.set("name", name);
  return `${origin}${FEED_PATH}?${p}`;
}
/** Enlaces listos para cada calendario. */
export function subscribeLinks(httpsUrl) {
  const webcal = httpsUrl.replace(/^https?:/, "webcal:");
  return {
    https: httpsUrl,
    webcal,                                                                        // iPhone, iPad, Mac (Calendario) y Outlook de escritorio
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent("Teseo")}`,
  };
}

/** Formato de los textos con la zona horaria del lugar (las horas de las descripciones coinciden con las del calendario). */
function feedFmt(lang, tz) {
  const l = lang === "es" ? "es-EC" : "en-US", nl = lang === "es" ? "es" : "en-US";
  const time = new Intl.DateTimeFormat(l, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz });
  return {
    time: (ms) => time.format(new Date(ms)),
    n: (x, dec = 0) => Number(x).toLocaleString(nl, { maximumFractionDigits: dec, minimumFractionDigits: dec }),
    pct: (x) => `${Math.round(x * 100)} %`,
    mag: lang === "es" ? "magnitud" : "magnitude",
  };
}

/**
 * El .ics completo.
 * @param o { lat, lon, lang, tz, types?, name?, now, showers, launches, issPasses, days? }
 */
export function buildFeed({ lat, lon, lang = "es", tz = "America/Guayaquil", types = null, name = null, now = Date.now(), showers = [], launches = [], issPasses = [], days = FEED_DAYS } = {}) {
  const T = TC[lang] || TC.es, es = lang === "es";
  const from = now - 2 * DAY;                     // lo de ayer sigue un rato (algunos calendarios borran lo que desaparece)
  let list = [];
  try { list = buildSkyEvents({ from, days: days + 2, lat, lon, showers }); } catch { list = []; }
  try { list = list.concat(buildFeedEvents({ from: now, days, launches, issPasses })); } catch { /* sin red: sin lanzamientos ni ISS */ }
  list = sortEvents(list).filter(e => !types || types.includes(e.type));
  const fmt = feedFmt(lang, tz);
  const where = name || `${fmt.n(lat, 2)}, ${fmt.n(lon, 2)}`;
  const out = [];
  for (const ev of list) {
    let info;
    try { info = describeEvent(ev, lang, fmt); } catch { continue; }
    const vis = info.vis ? `${info.vis.state === true ? T.visYes : info.vis.state === "partial" ? T.visPartial : T.visNo} (${where}). ${info.vis.text}` : "";
    const link = info.links[0] && info.links[0].href;
    const sky = info.sky ? `${FEED_ORIGIN}/${info.sky}` : null;
    const desc = [info.what, vis, info.note, info.region ? `NASA: ${info.region}` : "",
      sky ? `${T.seeSky}: ${sky}` : "", link ? `${es ? "Fuente" : "Source"}: ${link}` : "", es ? "Teseo · Calendario del cielo, calculado por Teseo." : "Teseo · Sky calendar, computed by Teseo."].filter(Boolean).join("\n\n");
    out.push({
      uid: `${ev.id}@teseo.yachaydeep.com`, start: ev.t, allDay: !!ev.allDay, durationMin: ev.durationMin,
      title: info.title, description: desc, url: sky || link || FEED_ORIGIN, categories: T.types[ev.type] || ev.type,
      alarm: ev.type !== "moon" && ev.type !== "planet",     // avisos solo para lo que no se repite cada semana
    });
  }
  const calName = es ? `Teseo · Cielo de ${where}` : `Teseo · Sky from ${where}`;
  const calDesc = es
    ? `Calendario del cielo de Teseo para ${where}: Luna, eclipses, lluvias de meteoros, planetas, estaciones, hitos del espacio, pasadas visibles de la ISS y lanzamientos. Calculado por Teseo; se actualiza solo. ${FEED_ORIGIN}`
    : `Teseo sky calendar for ${where}: Moon, eclipses, meteor showers, planets, seasons, space milestones, visible ISS passes and launches. Computed by Teseo; updates itself. ${FEED_ORIGIN}`;
  return buildCalendar(out, { now, name: calName, description: calDesc, refreshHours: 12, prodId: `-//Teseo//Calendario del cielo//${es ? "ES" : "EN"}` });
}
