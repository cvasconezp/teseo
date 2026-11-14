// Pruebas de src/sky/issPasses.js, src/sky/issSky.js e i18n-iss.js: cliente de /api/iss/passes, horas en la zona
// del dispositivo, próxima pasada visible, cuenta atrás, interpolación de la trayectoria y textos ES/EN.
// Uso:  node scripts/test_sky_iss.mjs     (sale con código 1 si algo falla)
//
// Datos: tres pasadas REALES calculadas por backend/app/iss.py (TLE de CelesTrak, época 13-nov-2026 21:59 UTC):
// Madrid 15-nov 17:31 UTC (casi cenital, 73°), Madrid 14-nov 18:19 UTC (el tramo visible acaba al entrar en la
// sombra de la Tierra) y Quito 14-nov 19:35 UTC (de día: no visible). `TRUTH` son posiciones alt/az de la pasada
// cenital calculadas aparte con SGP4 cada 7 s, en instantes que NO son puntos de la trayectoria: sirven para medir
// el error real de interpolar.
// Referencias independientes: las horas locales se comparan con la hora UTC más el desfase a mano; la interpolación
// con SGP4 y con una identidad geométrica (dos puntos opuestos a 80° de altura tienen el cenit en medio).
import {
  issUrl, fetchIssPasses, normalizePasses, formatClock, formatDay, formatDayTime, compassLabel, fmtDuration, fmtMag,
  shownEnds, shownMaxAlt, visiblePasses, nextVisiblePass, isHappeningNow, splitWait, formatCountdown, describePass, summarize,
  accuracyWarnings, findPass, hasTrack, fetchIssPass, hiddenReason, upcomingPasses, orbitFacts, PASS_MATCH_MS,
} from "../src/sky/issPasses.js";
import { issPositionAt, issTrack, issSegments, passSpan, slerp, altAzToENU, enuToAltAz, altAzToLocal, altAzToEquatorial } from "../src/sky/issSky.js";
import { altAz, altAzOfLocal } from "../src/sky/guide.js";
import { ISS } from "../src/sky/i18n-iss.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const angSep = (a1, z1, a2, z2) => { const d = Math.PI / 180; const c = Math.sin(a1 * d) * Math.sin(a2 * d) + Math.cos(a1 * d) * Math.cos(a2 * d) * Math.cos((z1 - z2) * d); return Math.acos(Math.max(-1, Math.min(1, c))) / d; };

const FIX = JSON.parse(String.raw`{"passes":{"shadow_end":{"id":"2026-11-14T18:19:10Z","start":{"t":"2026-11-14T18:19:10Z","alt":10.0,"az":254.8,"compass":"WSW","compass_es":"OSO"},"max":{"t":"2026-11-14T18:22:22Z","alt":43.6,"az":328.8,"compass":"NNW","compass_es":"NNO","sun_alt":-16.1,"sunlit":true},"end":{"t":"2026-11-14T18:25:35Z","alt":10.0,"az":42.9,"compass":"NE","compass_es":"NE"},"duration_s":385,"max_alt":43.6,"visible":true,"visible_from":{"t":"2026-11-14T18:19:10Z","alt":10.0,"az":254.8,"compass":"WSW","compass_es":"OSO"},"visible_to":{"t":"2026-11-14T18:23:48Z","alt":26.4,"az":25.1,"compass":"NNE","compass_es":"NNE"},"visible_duration_s":278,"mag":-2.9,"why_not_visible":null,"track":[{"t":"2026-11-14T18:19:10.0Z","alt":10.0,"az":254.8,"lit":true},{"t":"2026-11-14T18:19:20.0Z","alt":11.1,"az":255.7,"lit":true},{"t":"2026-11-14T18:19:30.0Z","alt":12.2,"az":256.7,"lit":true},{"t":"2026-11-14T18:19:40.0Z","alt":13.4,"az":257.8,"lit":true},{"t":"2026-11-14T18:19:50.0Z","alt":14.7,"az":259.0,"lit":true},{"t":"2026-11-14T18:20:00.0Z","alt":16.1,"az":260.4,"lit":true},{"t":"2026-11-14T18:20:10.0Z","alt":17.6,"az":261.9,"lit":true},{"t":"2026-11-14T18:20:20.0Z","alt":19.2,"az":263.7,"lit":true},{"t":"2026-11-14T18:20:30.0Z","alt":21.0,"az":265.7,"lit":true},{"t":"2026-11-14T18:20:40.0Z","alt":22.9,"az":268.0,"lit":true},{"t":"2026-11-14T18:20:50.0Z","alt":25.0,"az":270.6,"lit":true},{"t":"2026-11-14T18:21:00.0Z","alt":27.2,"az":273.7,"lit":true},{"t":"2026-11-14T18:21:10.0Z","alt":29.5,"az":277.3,"lit":true},{"t":"2026-11-14T18:21:20.0Z","alt":32.0,"az":281.6,"lit":true},{"t":"2026-11-14T18:21:30.0Z","alt":34.6,"az":286.7,"lit":true},{"t":"2026-11-14T18:21:40.0Z","alt":37.1,"az":292.7,"lit":true},{"t":"2026-11-14T18:21:50.0Z","alt":39.5,"az":299.8,"lit":true},{"t":"2026-11-14T18:22:00.0Z","alt":41.5,"az":307.9,"lit":true},{"t":"2026-11-14T18:22:10.0Z","alt":42.9,"az":317.1,"lit":true},{"t":"2026-11-14T18:22:20.0Z","alt":43.6,"az":326.8,"lit":true},{"t":"2026-11-14T18:22:22.0Z","alt":43.6,"az":328.8,"lit":true},{"t":"2026-11-14T18:22:30.0Z","alt":43.3,"az":336.7,"lit":true},{"t":"2026-11-14T18:22:40.0Z","alt":42.2,"az":346.1,"lit":true},{"t":"2026-11-14T18:22:50.0Z","alt":40.4,"az":354.7,"lit":true},{"t":"2026-11-14T18:23:00.0Z","alt":38.2,"az":2.2,"lit":true},{"t":"2026-11-14T18:23:10.0Z","alt":35.7,"az":8.6,"lit":true},{"t":"2026-11-14T18:23:20.0Z","alt":33.1,"az":14.0,"lit":true},{"t":"2026-11-14T18:23:30.0Z","alt":30.6,"az":18.6,"lit":true},{"t":"2026-11-14T18:23:40.0Z","alt":28.2,"az":22.5,"lit":true},{"t":"2026-11-14T18:23:50.0Z","alt":25.9,"az":25.8,"lit":false},{"t":"2026-11-14T18:24:00.0Z","alt":23.8,"az":28.6,"lit":false},{"t":"2026-11-14T18:24:10.0Z","alt":21.8,"az":31.0,"lit":false},{"t":"2026-11-14T18:24:20.0Z","alt":20.0,"az":33.1,"lit":false},{"t":"2026-11-14T18:24:30.0Z","alt":18.4,"az":34.9,"lit":false},{"t":"2026-11-14T18:24:40.0Z","alt":16.8,"az":36.6,"lit":false},{"t":"2026-11-14T18:24:50.0Z","alt":15.4,"az":38.0,"lit":false},{"t":"2026-11-14T18:25:00.0Z","alt":14.1,"az":39.3,"lit":false},{"t":"2026-11-14T18:25:10.0Z","alt":12.8,"az":40.4,"lit":false},{"t":"2026-11-14T18:25:20.0Z","alt":11.7,"az":41.5,"lit":false},{"t":"2026-11-14T18:25:30.0Z","alt":10.6,"az":42.4,"lit":false},{"t":"2026-11-14T18:25:35.4Z","alt":10.0,"az":42.9,"lit":false}]},"overhead":{"id":"2026-11-15T17:31:13Z","start":{"t":"2026-11-15T17:31:13Z","alt":10.0,"az":238.8,"compass":"WSW","compass_es":"OSO"},"max":{"t":"2026-11-15T17:34:32Z","alt":72.8,"az":324.4,"compass":"NW","compass_es":"NO","sun_alt":-7.4,"sunlit":true},"end":{"t":"2026-11-15T17:37:52Z","alt":10.0,"az":50.1,"compass":"NE","compass_es":"NE"},"duration_s":399,"max_alt":72.8,"visible":true,"visible_from":{"t":"2026-11-15T17:31:13Z","alt":10.0,"az":238.8,"compass":"WSW","compass_es":"OSO"},"visible_to":{"t":"2026-11-15T17:37:52Z","alt":10.0,"az":50.1,"compass":"NE","compass_es":"NE"},"visible_duration_s":399,"mag":-3.6,"why_not_visible":null,"track":[{"t":"2026-11-15T17:31:12.7Z","alt":10.0,"az":238.8,"lit":true},{"t":"2026-11-15T17:31:20.0Z","alt":10.8,"az":239.0,"lit":true},{"t":"2026-11-15T17:31:30.0Z","alt":12.0,"az":239.4,"lit":true},{"t":"2026-11-15T17:31:40.0Z","alt":13.3,"az":239.7,"lit":true},{"t":"2026-11-15T17:31:50.0Z","alt":14.6,"az":240.1,"lit":true},{"t":"2026-11-15T17:32:00.0Z","alt":16.1,"az":240.5,"lit":true},{"t":"2026-11-15T17:32:10.0Z","alt":17.8,"az":241.0,"lit":true},{"t":"2026-11-15T17:32:20.0Z","alt":19.6,"az":241.6,"lit":true},{"t":"2026-11-15T17:32:30.0Z","alt":21.6,"az":242.2,"lit":true},{"t":"2026-11-15T17:32:40.0Z","alt":23.8,"az":243.0,"lit":true},{"t":"2026-11-15T17:32:50.0Z","alt":26.3,"az":243.9,"lit":true},{"t":"2026-11-15T17:33:00.0Z","alt":29.1,"az":244.9,"lit":true},{"t":"2026-11-15T17:33:10.0Z","alt":32.4,"az":246.2,"lit":true},{"t":"2026-11-15T17:33:20.0Z","alt":36.1,"az":247.9,"lit":true},{"t":"2026-11-15T17:33:30.0Z","alt":40.4,"az":250.1,"lit":true},{"t":"2026-11-15T17:33:40.0Z","alt":45.3,"az":253.0,"lit":true},{"t":"2026-11-15T17:33:50.0Z","alt":50.9,"az":257.1,"lit":true},{"t":"2026-11-15T17:34:00.0Z","alt":57.2,"az":263.3,"lit":true},{"t":"2026-11-15T17:34:10.0Z","alt":63.7,"az":273.4,"lit":true},{"t":"2026-11-15T17:34:20.0Z","alt":69.6,"az":290.9,"lit":true},{"t":"2026-11-15T17:34:30.0Z","alt":72.8,"az":319.3,"lit":true},{"t":"2026-11-15T17:34:31.6Z","alt":72.8,"az":324.4,"lit":true},{"t":"2026-11-15T17:34:40.0Z","alt":71.0,"az":350.2,"lit":true},{"t":"2026-11-15T17:34:50.0Z","alt":65.7,"az":11.0,"lit":true},{"t":"2026-11-15T17:35:00.0Z","alt":59.3,"az":22.9,"lit":true},{"t":"2026-11-15T17:35:10.0Z","alt":52.9,"az":30.1,"lit":true},{"t":"2026-11-15T17:35:20.0Z","alt":47.1,"az":34.7,"lit":true},{"t":"2026-11-15T17:35:30.0Z","alt":41.9,"az":37.9,"lit":true},{"t":"2026-11-15T17:35:40.0Z","alt":37.5,"az":40.3,"lit":true},{"t":"2026-11-15T17:35:50.0Z","alt":33.6,"az":42.1,"lit":true},{"t":"2026-11-15T17:36:00.0Z","alt":30.2,"az":43.5,"lit":true},{"t":"2026-11-15T17:36:10.0Z","alt":27.3,"az":44.7,"lit":true},{"t":"2026-11-15T17:36:20.0Z","alt":24.7,"az":45.6,"lit":true},{"t":"2026-11-15T17:36:30.0Z","alt":22.4,"az":46.4,"lit":true},{"t":"2026-11-15T17:36:40.0Z","alt":20.3,"az":47.1,"lit":true},{"t":"2026-11-15T17:36:50.0Z","alt":18.4,"az":47.7,"lit":true},{"t":"2026-11-15T17:37:00.0Z","alt":16.8,"az":48.2,"lit":true},{"t":"2026-11-15T17:37:10.0Z","alt":15.2,"az":48.6,"lit":true},{"t":"2026-11-15T17:37:20.0Z","alt":13.8,"az":49.0,"lit":true},{"t":"2026-11-15T17:37:30.0Z","alt":12.5,"az":49.4,"lit":true},{"t":"2026-11-15T17:37:40.0Z","alt":11.3,"az":49.7,"lit":true},{"t":"2026-11-15T17:37:50.0Z","alt":10.2,"az":50.0,"lit":true},{"t":"2026-11-15T17:37:51.9Z","alt":10.0,"az":50.1,"lit":true}]},"quito_day":{"id":"2026-11-14T19:35:37Z","start":{"t":"2026-11-14T19:35:37Z","alt":10.0,"az":199.6,"compass":"SSW","compass_es":"SSO"},"max":{"t":"2026-11-14T19:38:49Z","alt":44.4,"az":125.5,"compass":"SE","compass_es":"SE","sun_alt":46.7,"sunlit":true},"end":{"t":"2026-11-14T19:41:59Z","alt":10.0,"az":51.5,"compass":"NE","compass_es":"NE"},"duration_s":381,"max_alt":44.4,"visible":false,"visible_from":null,"visible_to":null,"visible_duration_s":0,"mag":null,"why_not_visible":"sun_up","track":[{"t":"2026-11-14T19:35:37.4Z","alt":10.0,"az":199.6,"lit":true},{"t":"2026-11-14T19:35:40.0Z","alt":10.3,"az":199.3,"lit":true},{"t":"2026-11-14T19:35:50.0Z","alt":11.4,"az":198.5,"lit":true},{"t":"2026-11-14T19:36:00.0Z","alt":12.5,"az":197.5,"lit":true},{"t":"2026-11-14T19:36:10.0Z","alt":13.8,"az":196.4,"lit":true},{"t":"2026-11-14T19:36:20.0Z","alt":15.1,"az":195.2,"lit":true},{"t":"2026-11-14T19:36:30.0Z","alt":16.5,"az":193.8,"lit":true},{"t":"2026-11-14T19:36:40.0Z","alt":18.1,"az":192.3,"lit":true},{"t":"2026-11-14T19:36:50.0Z","alt":19.7,"az":190.6,"lit":true},{"t":"2026-11-14T19:37:00.0Z","alt":21.6,"az":188.5,"lit":true},{"t":"2026-11-14T19:37:10.0Z","alt":23.5,"az":186.2,"lit":true},{"t":"2026-11-14T19:37:20.0Z","alt":25.7,"az":183.5,"lit":true},{"t":"2026-11-14T19:37:30.0Z","alt":28.0,"az":180.4,"lit":true},{"t":"2026-11-14T19:37:40.0Z","alt":30.5,"az":176.6,"lit":true},{"t":"2026-11-14T19:37:50.0Z","alt":33.1,"az":172.1,"lit":true},{"t":"2026-11-14T19:38:00.0Z","alt":35.7,"az":166.8,"lit":true},{"t":"2026-11-14T19:38:10.0Z","alt":38.4,"az":160.4,"lit":true},{"t":"2026-11-14T19:38:20.0Z","alt":40.8,"az":152.8,"lit":true},{"t":"2026-11-14T19:38:30.0Z","alt":42.8,"az":144.1,"lit":true},{"t":"2026-11-14T19:38:40.0Z","alt":44.0,"az":134.4,"lit":true},{"t":"2026-11-14T19:38:48.7Z","alt":44.4,"az":125.5,"lit":true},{"t":"2026-11-14T19:38:50.0Z","alt":44.4,"az":124.1,"lit":true},{"t":"2026-11-14T19:39:00.0Z","alt":43.8,"az":113.9,"lit":true},{"t":"2026-11-14T19:39:10.0Z","alt":42.3,"az":104.4,"lit":true},{"t":"2026-11-14T19:39:20.0Z","alt":40.2,"az":96.0,"lit":true},{"t":"2026-11-14T19:39:30.0Z","alt":37.7,"az":88.7,"lit":true},{"t":"2026-11-14T19:39:40.0Z","alt":35.0,"az":82.6,"lit":true},{"t":"2026-11-14T19:39:50.0Z","alt":32.3,"az":77.5,"lit":true},{"t":"2026-11-14T19:40:00.0Z","alt":29.7,"az":73.2,"lit":true},{"t":"2026-11-14T19:40:10.0Z","alt":27.3,"az":69.6,"lit":true},{"t":"2026-11-14T19:40:20.0Z","alt":25.0,"az":66.6,"lit":true},{"t":"2026-11-14T19:40:30.0Z","alt":22.9,"az":64.0,"lit":true},{"t":"2026-11-14T19:40:40.0Z","alt":21.0,"az":61.8,"lit":true},{"t":"2026-11-14T19:40:50.0Z","alt":19.2,"az":59.9,"lit":true},{"t":"2026-11-14T19:41:00.0Z","alt":17.5,"az":58.2,"lit":true},{"t":"2026-11-14T19:41:10.0Z","alt":16.0,"az":56.7,"lit":true},{"t":"2026-11-14T19:41:20.0Z","alt":14.6,"az":55.4,"lit":true},{"t":"2026-11-14T19:41:30.0Z","alt":13.3,"az":54.2,"lit":true},{"t":"2026-11-14T19:41:40.0Z","alt":12.1,"az":53.2,"lit":true},{"t":"2026-11-14T19:41:50.0Z","alt":10.9,"az":52.2,"lit":true},{"t":"2026-11-14T19:41:58.6Z","alt":10.0,"az":51.5,"lit":true}]}},"truth_overhead":[[1794763874300,10.172,238.869],[1794763881300,10.957,239.075],[1794763888300,11.782,239.294],[1794763895300,12.649,239.53],[1794763902300,13.563,239.783],[1794763909300,14.53,240.056],[1794763916300,15.556,240.351],[1794763923300,16.646,240.672],[1794763930300,17.809,241.023],[1794763937300,19.053,241.407],[1794763944300,20.389,241.831],[1794763951300,21.829,242.301],[1794763958300,23.385,242.825],[1794763965300,25.073,243.414],[1794763972300,26.911,244.081],[1794763979300,28.92,244.843],[1794763986300,31.123,245.722],[1794763993300,33.545,246.748],[1794764000300,36.216,247.96],[1794764007300,39.165,249.416],[1794764014300,42.42,251.196],[1794764021300,46.006,253.418],[1794764028300,49.933,256.264],[1794764035300,54.183,260.02],[1794764042300,58.688,265.157],[1794764049300,63.283,272.464],[1794764056300,67.631,283.221],[1794764063300,71.105,299.068],[1794764070300,72.777,320.26],[1794764077300,71.973,342.589],[1794764084300,69.043,0.523],[1794764091300,64.929,12.937],[1794764098300,60.384,21.314],[1794764105300,55.833,27.122],[1794764112300,51.491,31.31],[1794764119300,47.456,34.445],[1794764126300,43.758,36.868],[1794764133300,40.395,38.793],[1794764140300,37.348,40.356],[1794764147300,34.588,41.651],[1794764154300,32.086,42.74],[1794764161300,29.814,43.67],[1794764168300,27.743,44.473],[1794764175300,25.85,45.174],[1794764182300,24.114,45.791],[1794764189300,22.516,46.34],[1794764196300,21.04,46.831],[1794764203300,19.671,47.273],[1794764210300,18.397,47.673],[1794764217300,17.208,48.039],[1794764224300,16.094,48.373],[1794764231300,15.048,48.68],[1794764238300,14.063,48.964],[1794764245300,13.131,49.227],[1794764252300,12.249,49.472],[1794764259300,11.411,49.701],[1794764266300,10.613,49.915]]}`);
const RAW = FIX.passes, TRUTH = FIX.truth_overhead;
const data = (extra = {}) => ({ source: "CelesTrak (NORAD GP) · SGP4", stale: false, warnings: [], window: { days: 5 },
  elements: { epoch: "2026-11-13T21:59:13Z", age_hours: 2, outdated: false }, passes: [RAW.overhead, RAW.shadow_end, RAW.quito_day], ...extra });
const N = normalizePasses(data());
const P = Object.fromEntries(N.passes.map((p) => [p.start.t, p]));
const over = P["2026-11-15T17:31:13Z"], shadow = P["2026-11-14T18:19:10Z"], day = P["2026-11-14T19:35:37Z"];
const T0 = Date.parse("2026-11-14T00:00:00Z");

console.log("Pedir las pasadas");
{
  const u = issUrl({ lat: -0.2202, lon: -78.5123, altM: 2850.4, days: 5, api: "https://api.example.org/" });
  ok(u === "https://api.example.org/api/iss/passes?lat=-0.22&lon=-78.512&alt_m=2850&days=5", "URL: lugar redondeado a ~100 m, sin barra doble", u);
  ok(issUrl({ lat: 1, lon: 2, altM: 99999, days: 99, api: "" }).endsWith("alt_m=9000&days=10"), "URL: altitud y días dentro de los límites del servidor");
  ok(issUrl({ lat: 1, lon: 2, altM: -9999, days: 0, api: "" }).endsWith("alt_m=-500&days=1"), "URL: límites inferiores");
  let seen = null;
  const good = async (url, opts) => { seen = { url, opts }; return { ok: true, status: 200, json: async () => data() }; };
  const d = await fetchIssPasses({ lat: 40.42, lon: -3.7, altM: 650, fetchImpl: good, api: "" });
  ok(seen.url.startsWith("/api/iss/passes?lat=40.42&lon=-3.7&alt_m=650&days=5") && d.passes.length === 3 && typeof d.passes[0].startMs === "number", "fetch: pide y normaliza (tiempos en ms, orden cronológico)");
  ok(d.passes.every((p, i, a) => i === 0 || a[i - 1].startMs <= p.startMs), "las pasadas salen ordenadas por inicio");
  const bad = async () => ({ ok: false, status: 502, json: async () => ({ detail: "Error consultando CelesTrak: ConnectTimeout" }) });
  let err = null; try { await fetchIssPasses({ lat: 1, lon: 2, fetchImpl: bad, api: "" }); } catch (e) { err = e; }
  ok(err && err.status === 502 && /CelesTrak/.test(err.message), "HTTP 502: lanza con el detalle del servidor", err && err.message);
  const junk = async () => ({ ok: true, status: 200, json: async () => ({ nada: 1 }) });
  err = null; try { await fetchIssPasses({ lat: 1, lon: 2, fetchImpl: junk, api: "" }); } catch (e) { err = e; }
  ok(err && /inesperada/.test(err.message), "respuesta sin `passes`: error claro");
  err = null; try { await fetchIssPasses({ lat: NaN, lon: 2, fetchImpl: good }); } catch (e) { err = e; }
  ok(err && /sin lugar/.test(err.message), "sin lugar no hay petición");
  const ctl = new AbortController();
  const slow = (url, { signal }) => new Promise((res, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("abortado"), { name: "AbortError" }))));
  const pr = fetchIssPasses({ lat: 1, lon: 2, fetchImpl: slow, signal: ctl.signal, api: "" });
  ctl.abort();
  err = null; try { await pr; } catch (e) { err = e; }
  ok(err && err.name === "AbortError", "se puede cancelar (cambio de lugar o desmontaje)");
  ok(normalizePasses({ passes: [null, { nada: 1 }] }).passes.length === 0 && normalizePasses(null).passes.length === 0, "pasadas mal formadas se descartan sin romper");
}

console.log("Horas en la zona del dispositivo");
{
  const t = "2026-11-14T18:19:10Z";
  ok(formatClock(t, { lang: "es", timeZone: "Europe/Madrid" }) === "19:19", "Madrid (UTC+1 en noviembre): 18:19 UTC → 19:19");
  ok(formatClock(t, { lang: "es", timeZone: "America/Guayaquil" }) === "13:19", "Quito (UTC−5): 18:19 UTC → 13:19");
  ok(formatClock(t, { lang: "en", timeZone: "Asia/Kolkata" }) === "23:49", "Calcuta (UTC+5:30): medias horas");
  ok(formatClock("2026-11-14T04:05:00Z", { lang: "en", timeZone: "America/Guayaquil" }) === "23:05", "24 h, sin AM/PM, con cero delante");
  ok(formatClock(t, { lang: "es", timeZone: "UTC", seconds: true }) === "18:19:10", "con segundos");
  ok(formatDay("2026-11-14T18:19:10Z", { lang: "es", timeZone: "Europe/Madrid" }) === "sáb 14 nov", "día en español", formatDay("2026-11-14T18:19:10Z", { lang: "es", timeZone: "Europe/Madrid" }));
  ok(/^Sat,? Nov 14$/.test(formatDay("2026-11-14T18:19:10Z", { lang: "en", timeZone: "Europe/Madrid" })), "día en inglés", formatDay("2026-11-14T18:19:10Z", { lang: "en", timeZone: "Europe/Madrid" }));
  ok(formatDay("2026-11-15T03:30:00Z", { lang: "es", timeZone: "America/Guayaquil" }) === "sáb 14 nov", "el día cambia con la zona: 03:30 UTC del 15 es aún 14 en Quito");
  ok(formatDayTime(t, { lang: "es", timeZone: "UTC" }) === "sáb 14 nov, 18:19", "día y hora juntos");
  ok(/^\d\d:\d\d$/.test(formatClock(t, { lang: "es" })), "sin zona: usa la del dispositivo");
}

console.log("Puntos cardinales, duración y magnitud");
{
  ok(["N", "NE", "E", "SE", "S", "SO", "O", "NO"].every((c, i) => compassLabel(i * 45, "es") === c), "8 vientos en español (SO, O, NO)");
  ok(["N", "NE", "E", "SE", "S", "SW", "W", "NW"].every((c, i) => compassLabel(i * 45, "en") === c), "8 vientos en inglés (SW, W, NW)");
  ok(compassLabel(359.9, "es") === "N" && compassLabel(22.4, "es") === "N" && compassLabel(22.6, "es") === "NE" && compassLabel(-10, "es") === "N" && compassLabel(725, "es") === "N", "bordes de sector y azimut fuera de rango");
  ok(fmtDuration(45) === "45 s" && fmtDuration(240) === "4 min" && fmtDuration(340) === "5 min 40 s" && fmtDuration(615) === "10 min" && fmtDuration(645) === "11 min", "duración legible");
  ok(fmtMag(-3.6, "es") === "≈ −3,5" && fmtMag(-3.6, "en") === "≈ −3.5" && fmtMag(-1.2, "es") === "≈ −1,0" && fmtMag(0.3, "es") === "≈ +0,5" && fmtMag(0, "es") === "≈ 0,0", "magnitud redondeada a 0,5, con signo menos de verdad", [fmtMag(-3.6, "es"), fmtMag(-1.2, "es"), fmtMag(0.3, "es")].join(" "));
  ok(fmtMag(null) === null && fmtMag(undefined) === null && fmtMag(NaN) === null, "sin magnitud: null (la tarjeta no inventa nada)");
}

console.log("Qué parte de la pasada se ve");
{
  ok(over.visible && shadow.visible && !day.visible, "visibilidad de las tres pasadas de prueba");
  const e = shownEnds(shadow);
  ok(e.from.t === shadow.visible_from.t && e.to.t === "2026-11-14T18:23:48Z", "pasada visible: se enseñan los extremos del tramo visible");
  ok(shownEnds(day).to.t === day.end.t, "no visible: los de la pasada entera");
  // la ISS entra en sombra a 26° (el tramo visible acaba ahí, después de culminar a 44°): «sube a» es la del tramo visible
  ok(shadow.max_alt > 43 && shownMaxAlt(shadow) > 43 && shownMaxAlt(shadow) <= shadow.max_alt + 0.05, "sube a lo que de verdad ves", String(shownMaxAlt(shadow)));
  const d = describePass(over, "es");
  ok(d.appears === "SO" && d.disappears === "NE" && d.peak === 73, "pasada cenital: aparece por el SO, sube a 73°, se pierde por el NE", JSON.stringify(d));
  ok(describePass(over, "en").appears === "SW", "en inglés el punto cardinal es SW");
  ok(describePass(shadow, "es").partial === true && describePass(over, "es").partial === false, "partial: solo cuando el tramo visible es bastante más corto que la pasada");
  ok(near(describePass(over, "es").durationS, 399, 2), "duración del tramo visible");
}

console.log("Próxima pasada visible y cuenta atrás");
{
  const vis = visiblePasses(N.passes, T0);
  ok(vis.length === 2 && vis[0].start.t === "2026-11-14T18:19:10Z", "visiblePasses: solo las visibles, en orden");
  ok(nextVisiblePass(N.passes, T0).start.t === "2026-11-14T18:19:10Z", "la próxima visible desde las 00:00 es la de las 18:19");
  const t1 = Date.parse("2026-11-14T18:23:00Z");
  ok(nextVisiblePass(N.passes, t1).start.t === "2026-11-14T18:19:10Z" && isHappeningNow(shadow, t1), "durante el tramo visible sigue siendo «la próxima» y está en curso");
  const t2 = Date.parse("2026-11-14T18:24:00Z");
  ok(nextVisiblePass(N.passes, t2).start.t === "2026-11-15T17:31:13Z" && !isHappeningNow(shadow, t2), "al acabar el tramo visible pasa a la siguiente");
  ok(nextVisiblePass(N.passes, Date.parse("2026-11-16T00:00:00Z")) === null && nextVisiblePass([], T0) === null, "sin más pasadas visibles: null");
  const s = splitWait(3 * 3600e3 + 12 * 60e3 + 59e3);
  ok(s.h === 3 && s.m === 12 && s.d === 0 && s.totalMin === 192, "splitWait redondea los minutos hacia abajo");
  const L = (ms, lang = "es") => formatCountdown(T0 + ms, T0, lang);
  ok(L(3 * 3600e3 + 12 * 60e3) === "faltan 3 h 12 min", "faltan 3 h 12 min", L(3 * 3600e3 + 12 * 60e3));
  ok(L(2 * 3600e3) === "faltan 2 h" && L(35 * 60e3) === "faltan 35 min" && L(59 * 60e3 + 59e3) === "faltan 59 min", "horas exactas y minutos sueltos");
  ok(L(26 * 3600e3 + 5 * 60e3) === "faltan 26 h 5 min", "menos de 48 h: horas y minutos");
  ok(L(3 * 86400e3 + 4 * 3600e3) === "faltan 3 d 4 h" && L(2 * 86400e3) === "faltan 2 d", "desde 48 h: días y horas");
  ok(L(30e3) === "en menos de 1 min" && formatCountdown(T0 - 5e3, T0, "es") === "ahora mismo", "casi ya, y ya pasó");
  ok(L(3 * 3600e3 + 12 * 60e3, "en") === "in 3 h 12 min" && L(30e3, "en") === "in under a minute", "inglés");
  ok(formatCountdown(T0 - 60e3, T0, "es", T0 + 60e3) === "ahora mismo" && formatCountdown(T0 - 60e3, T0, "en", T0 + 60e3) === "happening now", "en curso");
  const sm = summarize(N.passes, T0);
  ok(sm.total === 3 && sm.visible === 2 && sm.hidden === 1 && sm.sunUp === 1 && sm.shadow === 0, "resumen: total, visibles y por qué no se ve la otra", JSON.stringify(sm));
  ok(summarize(N.passes, Date.parse("2026-11-16T00:00:00Z")).total === 0, "las pasadas ya terminadas no cuentan");
  ok(accuracyWarnings(data({ warnings: ["elements_old", "stale"] })).outdated && accuracyWarnings(data({ stale: true })).stale && !accuracyWarnings(data()).outdated, "avisos de elementos viejos y datos sin actualizar");
}

console.log("Interpolar la posición de la ISS");
{
  // en los instantes de la trayectoria devuelve exactamente ese punto
  let worst = 0;
  for (const pt of over.track) { const q = issPositionAt(over, Date.parse(pt.t)); worst = Math.max(worst, angSep(q.alt, q.az, pt.alt, pt.az)); }
  ok(worst < 1e-6, "en cada punto de la trayectoria da ese punto", worst.toExponential(2));
  // frente a SGP4 en instantes intermedios
  let maxErr = 0, sumErr = 0;
  for (const [tMs, alt, az] of TRUTH) { const q = issPositionAt(over, tMs, { clamp: false }); const e = angSep(q.alt, q.az, alt, az); maxErr = Math.max(maxErr, e); sumErr += e; }
  ok(TRUTH.length > 40 && maxErr < 0.25, `entre puntos (cada 10 s) la posición queda a ${maxErr.toFixed(3)}° de SGP4 (máx.), media ${(sumErr / TRUTH.length).toFixed(3)}°`, `${maxErr}`);
  // con un punto de cada dos (20 s): sigue por debajo de 0,5°, el objetivo de una predicción visual
  const thin = { ...over, track: over.track.filter((_, i) => i % 2 === 0) };
  let maxThin = 0;
  for (const [tMs, alt, az] of TRUTH) { const q = issPositionAt(thin, tMs, { clamp: false }); if (q) maxThin = Math.max(maxThin, angSep(q.alt, q.az, alt, az)); }
  ok(maxThin < 0.5, `con la mitad de los puntos (20 s) el error máximo es ${maxThin.toFixed(3)}° (< 0,5°)`);
  // por qué se interpola sobre la esfera: dos puntos opuestos a 80° tienen el cenit en medio; lo lineal en alt/az no
  const arc = { visible: false, track: [{ t: "2026-11-14T00:00:00Z", alt: 80, az: 0, lit: true }, { t: "2026-11-14T00:00:20Z", alt: 80, az: 180, lit: true }] };
  const mid = issPositionAt(arc, Date.parse("2026-11-14T00:00:10Z"));
  ok(near(mid.alt, 90, 1e-6), "pasada por el cenit: a medio camino entre dos puntos opuestos a 80° está a 90°", String(mid.alt));
  const q3 = issPositionAt(arc, Date.parse("2026-11-14T00:00:05Z"));
  ok(q3.alt > 80 && q3.alt < 90 && (q3.az === 0 || near(q3.az, 0, 1e-6) || near(q3.az, 360, 1e-6)), "a un cuarto del camino: más alto que los extremos y todavía por el norte");
  // fuera de la pasada
  const before = issPositionAt(over, Date.parse(over.track[0].t) - 60e3), after = issPositionAt(over, Date.parse(over.track.at(-1).t) + 60e3);
  ok(before.state === "before" && near(before.alt, over.track[0].alt, 1e-6) && after.state === "after" && near(after.alt, over.track.at(-1).alt, 1e-6), "antes y después: estado y extremo más cercano (clamp)");
  ok(issPositionAt(over, Date.parse(over.track[0].t) - 1, { clamp: false }) === null && issPositionAt({ track: [] }, 0) === null && issPositionAt({}, 0) === null, "sin clamp o sin trayectoria: null");
  const dur = issPositionAt(over, Date.parse(over.max.t));
  ok(dur.state === "during" && near(dur.alt, over.max_alt, 0.5), "en la culminación está a la altura máxima", `${dur.alt} vs ${over.max_alt}`);
  // visible y lit
  const inVis = issPositionAt(shadow, Date.parse("2026-11-14T18:22:00Z")), after2 = issPositionAt(shadow, Date.parse("2026-11-14T18:24:30Z"));
  ok(inVis.visible && inVis.lit && !after2.visible && !after2.lit, "dentro del tramo visible: visible e iluminada; en la sombra: ni una cosa ni otra");
  ok(issPositionAt(day, Date.parse(day.max.t)).visible === false, "pasada no visible: nunca visible");
  const sp = passSpan(over);
  ok(sp[0] < sp[1] && near((sp[1] - sp[0]) / 1000, over.duration_s, 1.5), "passSpan: de inicio a fin de la pasada");
  // trayectoria y tramos luz/sombra
  const tr = issTrack(shadow);
  ok(tr.length === shadow.track.length && tr.every((p) => Array.isArray(p.local) && p.local.length === 3), "issTrack: los puntos del servidor, con vector local");
  ok(issTrack(over, 5).length > over.track.length && near(issTrack(over, 5).at(-1).tMs, passSpan(over)[1], 1), "issTrack con paso: remuestrea hasta el final");
  const segs = issSegments(shadow);
  ok(segs.length === 2 && segs[0].lit === true && segs[1].lit === false, "issSegments: un tramo iluminado y otro en la sombra");
  ok(segs[0].points.at(-1) === segs[1].points[0], "los tramos se tocan (sin huecos al dibujar)");
  ok(issSegments(over).length === 1 && issSegments({ track: [] }).length === 0, "una pasada toda iluminada: un tramo; sin datos: ninguno");
}

console.log("Marcos de referencia");
{
  for (const [alt, az] of [[10, 0], [45, 90], [80, 200], [0, 270], [89.9, 33]]) {
    const r = enuToAltAz(altAzToENU(alt, az));
    ok(near(r.alt, alt, 1e-9) && (near(r.az, az, 1e-6) || alt > 89), `ENU ida y vuelta (${alt}°, ${az}°)`);
  }
  ok(near(altAzToENU(0, 90)[0], 1, 1e-12) && near(altAzToENU(0, 0)[1], 1, 1e-12) && near(altAzToENU(90, 0)[2], 1, 1e-12), "azimut 0 = norte, 90 = este, altura 90 = cenit");
  const l = altAzToLocal(30, 120), b = altAzOfLocal(l[0], l[1], l[2]);
  ok(near(b.alt, 30, 1e-9) && near(b.az, 120, 1e-9), "vector local [este, arriba, −norte] compatible con altAzOfLocal de guide.js");
  // altAzToEquatorial es la inversa exacta de altAz() de guide.js
  const date = new Date("2026-11-14T20:00:00Z");
  for (const [lat, lon, a0, z0] of [[-0.22, -78.51, 40, 110], [40.42, -3.7, 12, 300], [-33.9, 151.2, 75, 10]]) {
    const v = altAzToEquatorial(a0, z0, lat, lon, date);
    const back = altAz(v[0], v[1], v[2], lat, lon, date);
    ok(near(Math.hypot(...v), 1, 1e-9) && near(back.alt, a0, 1e-6) && near(back.az, z0, 1e-5), `altAzToEquatorial ↔ altAz (${lat}, ${lon})`, JSON.stringify(back));
  }
  const m = slerp([1, 0, 0], [0, 1, 0], 0.5);
  ok(near(m[0], Math.SQRT1_2, 1e-12) && near(m[1], Math.SQRT1_2, 1e-12) && near(Math.hypot(...m), 1, 1e-12), "slerp: punto medio de dos vectores ortogonales");
  ok(slerp([1, 0, 0], [1, 0, 0], 0.3)[0] === 1, "slerp con vectores iguales no divide por cero");
}

console.log("Una sola pasada (pass_start) y pasadas no visibles");
{
  const u = issUrl({ lat: -0.22, lon: -78.51, altM: 2850, api: "", track: "all", passStart: "2026-11-14T19:35:37Z" });
  ok(u === "/api/iss/passes?lat=-0.22&lon=-78.51&alt_m=2850&days=5&track=all&pass_start=2026-11-14T19%3A35%3A37Z", "URL con track=all y pass_start", u);
  ok(!issUrl({ lat: 1, lon: 2, api: "", track: "visible" }).includes("track=") && !issUrl({ lat: 1, lon: 2, api: "" }).includes("pass_start"), "sin esos parámetros la URL no cambia (track=visible es el valor por defecto)");
  ok(findPass(N.passes, day.startMs + 1000) === day && findPass(N.passes, day.startMs - PASS_MATCH_MS) === day && findPass(N.passes, day.startMs + PASS_MATCH_MS + 1) === null, "findPass: ±2 min de holgura sobre el inicio");
  ok(hasTrack(day) && !hasTrack({ ...day, track: [] }) && !hasTrack(null), "hasTrack");
  // servidor nuevo: devuelve solo esa pasada
  const calls = [];
  const fresh = async (url) => { calls.push(url); return { ok: true, status: 200, json: async () => data({ passes: [RAW.quito_day], pass_start: RAW.quito_day.start.t }) }; };
  const hidden = { ...day, track: [] };
  const r1 = await fetchIssPass({ lat: -0.22, lon: -78.51, altM: 2850, pass: hidden, fetchImpl: fresh, api: "" });
  ok(calls[0].includes("pass_start=2026-11-14T19%3A35%3A37Z") && calls[0].includes("track=all") && hasTrack(r1.pass) && r1.pass.id === day.id && typeof r1.pass.startMs === "number", "fetchIssPass: pide esa pasada y la devuelve normalizada, con trayectoria");
  // servidor anterior (no conoce pass_start): devuelve todas con track=all y se elige la buscada
  const old = async () => ({ ok: true, status: 200, json: async () => data() });
  const r2 = await fetchIssPass({ lat: -0.22, lon: -78.51, pass: hidden, fetchImpl: old, api: "" });
  ok(r2.pass.id === day.id && hasTrack(r2.pass), "con un servidor anterior también funciona (toma la pasada de la lista completa)");
  const none = async () => ({ ok: true, status: 200, json: async () => data({ passes: [] }) });
  let err = null; try { await fetchIssPass({ lat: 1, lon: 2, pass: hidden, fetchImpl: none, api: "" }); } catch (e) { err = e; }
  ok(err && err.status === 404, "si la pasada ya no está: error claro (404)");
  const down = async () => ({ ok: false, status: 502, json: async () => ({}) });
  err = null; try { await fetchIssPass({ lat: 1, lon: 2, pass: hidden, fetchImpl: down, api: "" }); } catch (e) { err = e; }
  ok(err && err.status === 502, "HTTP 502: lanza");
  err = null; try { await fetchIssPass({ lat: 1, lon: 2, fetchImpl: fresh, api: "" }); } catch (e) { err = e; }
  ok(err && /sin pasada/.test(err.message), "sin pasada no hay petición");
  ok(hiddenReason(day) === "sun_up" && hiddenReason(over) === null && hiddenReason({ visible: false, why_not_visible: "iss_in_shadow" }) === "iss_in_shadow" && hiddenReason({ visible: false, why_not_visible: "partial" }) === "partial" && hiddenReason({ visible: false }) === "partial", "hiddenReason: de día, en sombra o parcial");
  const up = upcomingPasses(N.passes, Date.parse("2026-11-14T19:00:00Z"));
  ok(up.length === 2 && up[0] === day && up[1] === over, "upcomingPasses: visibles y no visibles que aún no han terminado, en orden");
}

console.log("La órbita para la ficha (elements de la respuesta)");
{
  // elements reales de la respuesta del 14-nov-2026 (TLE de CelesTrak): período 92,9 min, 51,63°, 414–424 km
  const f = orbitFacts({ perigee_km: 414, apogee_km: 424, period_min: 92.9, inclination_deg: 51.63 });
  ok(f.fromElements && f.altKm === 419 && f.inclDeg === 51.63 && f.periodMin === 92.9, "toma altura, período e inclinación de los elementos");
  ok(near(f.speedKms, 7.66, 0.01), "velocidad v = √(GM/a), con a del período (3.ª ley de Kepler): ≈ 7,66 km/s", f.speedKms.toFixed(4));
  // a del período: 6795 km ≈ R⊕ + altura media (la altura sale de los mismos elementos por otro camino)
  const a = Math.cbrt(398600.4418 * (92.9 * 60 / (2 * Math.PI)) ** 2);
  ok(near(a - 6378.137, 419, 5), "coherente: el semieje del período da la misma altura (±5 km)", (a - 6378.137).toFixed(1));
  const g = orbitFacts(null);
  ok(!g.fromElements && g.altKm === 420 && near(g.periodMin, 92.8, 0.3) && near(g.speedKms, 7.66, 0.02) && g.inclDeg === 51.6, "sin elementos: valores típicos, rotulados como tales");
  ok(!orbitFacts({ perigee_km: 9, apogee_km: 4, period_min: 5 }).fromElements, "elementos absurdos: se ignoran");
}

console.log("Textos ES/EN");
{
  const kinds = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v]));
  ok(JSON.stringify(Object.keys(ISS.es).sort()) === JSON.stringify(Object.keys(ISS.en).sort()), "mismas claves en español e inglés");
  ok(JSON.stringify(kinds(ISS.es)) === JSON.stringify(kinds(ISS.en)), "cada clave es del mismo tipo (texto o función) en los dos idiomas");
  for (const lang of ["es", "en"]) {
    const t = ISS[lang];
    const outs = [t.issCount(1), t.issCount(3), t.issEmpty(5), t.issEmptyWhy(0, 0, 0), t.issEmptyWhy(1, 1, 0), t.issEmptyWhy(12, 7, 5), t.issAppears("SO", 64, "NE"), t.issDuration("5 min"), t.issPartial("19:19", "19:23"),
      t.issMag("≈ −3,5"), t.issShowAria("sáb 14 nov", "19:35"), t.issEpoch("sáb 14 nov 16:59", "13 h"), t.issEpoch("x", ""), t.issAge(0.5), t.issAge(13), t.issAge(100), t.issTimeNote("America/Guayaquil"), t.issTimeNote("")];
    ok(outs.every((s) => typeof s === "string" && s.length > 0 && !/undefined|NaN|\[object/.test(s)), `${lang}: ninguna frase sale vacía ni con undefined/NaN`, outs.find((s) => /undefined|NaN/.test(s)));
  }
  for (const lang of ["es", "en"]) {
    const t = ISS[lang];
    const outs = [t.issShowing("sáb 14 nov, 19:19"), t.issSpeed(10), t.issSpeedAria(1), t.issSpeedAria(60), t.issPillAria("19:22:22", t.issState.lit), t.issAltHint("414", "424"), t.issSpeedHint("27.600"),
      t.issPeriodHint("15,5"), t.issRowDir(44, "SE"), t.issVisibleYes("19:19:10", "19:23:48"), t.issBright("≈ −3,0"), ...Object.values(t.issHiddenTag), ...Object.values(t.issHiddenWhy), ...Object.values(t.issState)];
    ok(outs.every((x) => typeof x === "string" && x.length > 0 && !/undefined|NaN|\[object/.test(x)), `${lang}: textos de la ISS en el Cielo sin huecos`);
    ok(JSON.stringify(Object.keys(t.issHiddenWhy).sort()) === '["iss_in_shadow","partial","sun_up"]' && JSON.stringify(Object.keys(t.issHiddenTag).sort()) === '["iss_in_shadow","partial","sun_up"]', `${lang}: un aviso por cada razón de no verse`);
  }
  ok(ISS.es.issHiddenWhy.sun_up === "Esta pasada no se ve a simple vista: es de día." && ISS.es.issHiddenWhy.iss_in_shadow === "Esta pasada no se ve a simple vista: va por la sombra de la Tierra.", "los avisos del encargo, en español");
  ok(ISS.es.issAppears("SO", 64, "NE") === "Aparece por el SO, sube a 64°, se pierde por el NE", "la frase del encargo, en español");
  ok(ISS.es.issEmpty(5) === "Ninguna pasada visible en los próximos 5 días." && ISS.es.issSource === "Elementos orbitales: CelesTrak · Propagación SGP4", "estado vacío y fuente, en español");
  ok(ISS.es.issEmptyWhy(12, 7, 5) === "La ISS pasa 12 veces, pero ninguna se ve: 7 de día y 5 con la ISS dentro de la sombra de la Tierra.", "por qué no se ve ninguna", ISS.es.issEmptyWhy(12, 7, 5));
  ok(ISS.en.issEmptyWhy(1, 0, 1) === "The ISS passes 1 time, but it isn’t visible: 1 with the ISS inside Earth’s shadow.", "singular en inglés", ISS.en.issEmptyWhy(1, 0, 1));
  ok(ISS.es.issCount(1) === "1 pasada visible" && ISS.es.issCount(2) === "2 pasadas visibles", "plural");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
if (failed) process.exit(1);
