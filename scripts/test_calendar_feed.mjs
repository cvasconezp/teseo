// Pruebas del calendario de SUSCRIPCIÓN (src/now/calendar/feed.js + api/calendar.js). Node puro, sin red.
// Uso:  node scripts/test_calendar_feed.mjs
import { readFileSync } from "node:fs";
import { buildFeed, parseFeedQuery, feedUrl, subscribeLinks, roundCoord, FEED_PATH } from "../src/now/calendar/feed.js";

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  ok   ", msg); } else { fail++; console.log("  FALLA", msg); } };
const showers = JSON.parse(readFileSync(new URL("../public/meteorshowers.json", import.meta.url), "utf8")).objects;
const now = Date.parse("2026-11-18T15:30:00Z");

console.log("Enlace");
const q = parseFeedQuery(new URLSearchParams("lat=0.04312&lon=-78.15678&lang=es&tz=America/Guayaquil&name=Cayambe"));
ok(q && q.lat === 0.04 && q.lon === -78.16 && q.lang === "es" && q.tz === "America/Guayaquil" && q.name === "Cayambe", "lee el lugar y lo redondea a 0,01° (~1 km)");
ok(parseFeedQuery(new URLSearchParams("lat=abc&lon=1")) === null && parseFeedQuery(new URLSearchParams("lat=95&lon=1")) === null, "rechaza un lugar inválido");
ok(parseFeedQuery(new URLSearchParams("lat=0&lon=0&tz=Mars/Olympus")).tz === "America/Guayaquil", "zona horaria inválida → la de Ecuador");
ok(parseFeedQuery(new URLSearchParams("lat=0&lon=0&name=<script>")).name === "script", "el nombre del lugar se limpia");
const u = feedUrl({ lat: 0.04312, lon: -78.15678, lang: "es", tz: "America/Guayaquil", name: "Cayambe" });
ok(u === `https://teseo.yachaydeep.com${FEED_PATH}?lat=0.04&lon=-78.16&lang=es&tz=America%2FGuayaquil&name=Cayambe`, "enlace https con el lugar ya redondeado");
const L = subscribeLinks(u);
ok(L.webcal.startsWith("webcal://teseo.yachaydeep.com/cal/teseo.ics?") && L.google.startsWith("https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2F"), "enlaces para iPhone (webcal) y Google Calendar (cid)");
ok(roundCoord(-0.226) === -0.23, "redondeo a dos decimales");

console.log("Calendario");
const ics = buildFeed({ lat: 0.04, lon: -78.16, lang: "es", tz: "America/Guayaquil", name: "Cayambe", now, showers,
  launches: [], issPasses: [] });
const lines = ics.split("\r\n");
ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n") && ics.endsWith("END:VCALENDAR\r\n"), "estructura VCALENDAR con CRLF");
ok(/X-WR-CALNAME:Teseo · Cielo de Cayambe/.test(ics) && /REFRESH-INTERVAL;VALUE=DURATION:PT12H/.test(ics) && /X-PUBLISHED-TTL:PT12H/.test(ics), "nombre del calendario y actualización cada 12 h");
const enc = new TextEncoder();
ok(lines.every(l => enc.encode(l).length <= 75), "todas las líneas plegadas a 75 octetos (RFC 5545)");
const uids = [...ics.matchAll(/\r\nUID:([^\r]+)/g)].map(m => m[1]);
ok(uids.length > 80 && new Set(uids).size === uids.length, `UID únicos y estables (${uids.length} eventos en un año)`);
const n = (re) => (ics.replace(/\r\n /g, "").match(re) || []).length;
ok(n(/SUMMARY:Voyager 1 llega a 1 día-luz de la Tierra/g) === 1, "incluye el hito de la Voyager 1 (de hoy)");
ok(n(/SUMMARY:Solsticio de diciembre/g) === 1 && n(/DTSTART:20261221T2050/g) === 1, "solsticio de diciembre a las 20:50 UTC");
ok(n(/SUMMARY:Lluvia de meteoros: Gemínidas/g) >= 1, "lluvias de meteoros");
ok(n(/SUMMARY:Luna llena/g) >= 12, "un año de fases de la Luna");
const flat = ics.replace(/\r\n /g, "");
ok(/DESCRIPTION:[^\r]*Ver en el cielo: https:\/\/teseo\.yachaydeep\.com\/#sky/.test(flat), "cada evento enlaza a la app");
ok(/BEGIN:VALARM/.test(flat) && !/SUMMARY:Luna llena[^]*?BEGIN:VALARM[^]*?END:VEVENT/.test(flat.split("BEGIN:VEVENT").find(b => /SUMMARY:Luna llena/.test(b)) || ""), "avisos solo para lo que no se repite cada semana (la Luna, sin aviso)");
const en = buildFeed({ lat: 0.04, lon: -78.16, lang: "en", tz: "America/Guayaquil", now, showers });
ok(/X-WR-CALNAME:Teseo · Sky from 0.04\\, -78.16/.test(en) && /SUMMARY:Voyager 1 reaches 1 light-day from Earth/.test(en.replace(/\r\n /g, "")), "en inglés");
const only = buildFeed({ lat: 0, lon: -78.43, types: ["season", "milestone"], now, showers });
ok(!/SUMMARY:Luna llena/.test(only) && /SUMMARY:Solsticio de diciembre/.test(only), "filtro de tipos (t=season,milestone)");

console.log("Vercel");
const vj = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
ok(vj.rewrites[0].source === "/cal/teseo.ics" && vj.rewrites[0].destination === "/api/calendar", "/cal/teseo.ics → función api/calendar");
ok(vj.rewrites.some(r => r.source === "/((?!api/).*)" && r.destination === "/index.html"), "la ruta SPA no tapa las funciones /api");
ok(vj.functions && vj.functions["api/calendar.js"] && /meteorshowers\.json/.test(vj.functions["api/calendar.js"].includeFiles), "la función lleva el catálogo de meteoros");
const { default: handler } = await import("../api/calendar.js");
const fakeRes = () => { const r = { statusCode: 0, headers: {}, body: "" }; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.end = (b) => { r.body = b || ""; }; return r; };
const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error("sin red en la prueba"); };
const r1 = fakeRes(); await handler({ url: "/api/calendar?lat=0.04&lon=-78.16&lang=es" }, r1);
ok(r1.statusCode === 200 && r1.headers["content-type"].startsWith("text/calendar") && /s-maxage=21600/.test(r1.headers["cache-control"]) && r1.body.startsWith("BEGIN:VCALENDAR"), "la función responde text/calendar con caché de 6 h (sin red: sin ISS ni lanzamientos)");
const r2 = fakeRes(); await handler({ url: "/api/calendar?lon=1" }, r2);
ok(r2.statusCode === 400, "sin lugar: error 400");
globalThis.fetch = realFetch;

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
