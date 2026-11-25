// Pruebas de nubes y clima: src/sky/weather.js (pronóstico), src/sky/cloudNoise.js (calibración del ruido),
// src/sky/cloudsLayer.js (luz de las nubes) y src/sky/satellite.js (imagen de satélite y proyección).
import { forecastUrl, parseForecast, cloudsAt, coverClass, nextChange, bestNightHour, hourlySeries, fetchForecast, bestWindow } from "../src/sky/weather.js";
import { fbm, threshold, density, layerCoord, LAYER_STYLE, hash12 } from "../src/sky/cloudNoise.js";
import { cloudLight, drift, makeOccluder, OCC_HIDE, cloudLift, layerHeight, layerParams } from "../src/sky/cloudsLayer.js";
import { pickSource, wmsUrl, latestTime, orthoInverse, orthoForward, regionBox, domainsUrl, timeUrl, SOURCES, timeCandidates, dataFraction } from "../src/sky/satellite.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log("Pronóstico (Open-Meteo)");
const u = new URL(forecastUrl(0.04312, -78.14563));
ok(u.searchParams.get("elevation") === "nan", "pide la altura media de la celda del modelo (el suelo de las capas de nubes)");
ok(u.origin + u.pathname === "https://api.open-meteo.com/v1/forecast", "consulta a Open-Meteo");
ok(u.searchParams.get("latitude") === "0" && u.searchParams.get("longitude") === "-78.1", "el lugar va redondeado a 0,1°");
ok(/cloud_cover_low/.test(u.searchParams.get("hourly")) && /wind_direction_250hPa/.test(u.searchParams.get("hourly")), "pide nubes por capas y viento en altura");
ok(u.searchParams.get("timeformat") === "unixtime" && u.searchParams.get("wind_speed_unit") === "ms", "horas Unix y viento en m/s");

const T0 = 1795000000 - (1795000000 % 3600);
const N = 30;
const hourly = { time: [], cloud_cover: [], cloud_cover_low: [], cloud_cover_mid: [], cloud_cover_high: [], precipitation_probability: [] };
for (const lv of ["850hPa", "500hPa", "250hPa"]) { hourly[`wind_speed_${lv}`] = []; hourly[`wind_direction_${lv}`] = []; }
for (let i = 0; i < N; i++) {
  hourly.time.push(T0 + i * 3600);
  const tot = i < 10 ? 90 : i < 20 ? 10 : 70;
  hourly.cloud_cover.push(tot); hourly.cloud_cover_low.push(tot * 0.8); hourly.cloud_cover_mid.push(20); hourly.cloud_cover_high.push(i === 5 ? null : 5);
  hourly.precipitation_probability.push(i < 2 ? null : 30);
  hourly.wind_speed_850hPa.push(10); hourly.wind_direction_850hPa.push(90);   // sopla del este: va hacia el oeste
  hourly.wind_speed_500hPa.push(20); hourly.wind_direction_500hPa.push(0);    // del norte: va hacia el sur
  hourly.wind_speed_250hPa.push(30); hourly.wind_direction_250hPa.push(270);
}
const fc = parseForecast({ latitude: 0, longitude: -78.1, elevation: 2830, hourly });
ok(fc.t.length === N && near(fc.total[0], 0.9, 1e-9) && fc.high[5] === null, "convierte % a fracciones y conserva los huecos");
ok(near(fc.wind.low[0][0], -10, 1e-9) && near(fc.wind.low[0][1], 0, 1e-9), "viento del este → nubes hacia el oeste");
ok(near(fc.wind.mid[0][1], -20, 1e-9) && near(fc.wind.high[0][0], 30, 1e-9), "viento del norte → hacia el sur; del oeste → hacia el este");
let threw = false; try { parseForecast({ error: true, reason: "x" }); } catch { threw = true; }
ok(threw, "una respuesta sin datos horarios es un error");

const c95 = cloudsAt(fc, T0 + 9.5 * 3600);
ok(near(c95.total, 0.5, 1e-9), "interpola entre horas (90 % → 10 %: 50 % a la media hora)");
ok(cloudsAt(fc, new Date((T0 + 3600) * 1000)).total === 0.9, "acepta una fecha");
ok(cloudsAt(fc, T0 - 7200) === null && cloudsAt(fc, T0 + (N + 1) * 3600) === null, "fuera del pronóstico: null");
ok(near(cloudsAt(fc, T0 + 5 * 3600).high, 0.05, 1e-9), "un dato que falta se toma del vecino");
ok([0, 0.1, 0.45, 0.75, 1].map(coverClass).join() === "0,1,2,3,4", "categorías por octas: despejado … cubierto");
const ch = nextChange(fc, T0 + 3600);
ok(ch && ch.kind === "clears" && ch.t === T0 + 10 * 3600, "«despeja a las…»: la primera hora bajo 30 %");
const ch2 = nextChange(fc, T0 + 12 * 3600);
ok(ch2 && ch2.kind === "clouds" && ch2.t === T0 + 20 * 3600, "«se nubla a las…»: la primera hora sobre 60 %");
ok(nextChange(fc, T0 + 24 * 3600) === null, "sin cambio a la vista: null");
const best = bestNightHour(fc, T0, (s) => s >= T0 + 15 * 3600 && s < T0 + 25 * 3600);
ok(best && best.t === T0 + 15 * 3600 && near(best.total, 0.1, 1e-9), "mejor hora de la noche: la primera con menos nubes");
ok(bestNightHour(fc, T0, () => false) === null, "sin horas de noche: null");
const ser = hourlySeries(fc, T0 + 1800, 24);
ok(ser.length === 24 && ser[0].t === T0 && ser[23].total != null, "serie horaria de 24 h");

let calls = 0;
const fakeFetch = async () => { calls++; return { ok: true, status: 200, json: async () => ({ hourly }) }; };
const a1 = await fetchForecast(1.23, 4.56, { fetchImpl: fakeFetch, now: 1000 });
const a2 = await fetchForecast(1.21, 4.58, { fetchImpl: fakeFetch, now: 2000 });
ok(calls === 1 && a1 === a2, "la misma celda de 0,1° no se vuelve a pedir en 30 min");
await fetchForecast(1.23, 4.56, { fetchImpl: fakeFetch, now: 1000 + 31 * 60000 });
ok(calls === 2, "pasados 30 min se vuelve a pedir");
let reason = null;
try { await fetchForecast(9, 9, { fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: true, reason: "Daily API request limit exceeded." }) }) }); } catch (e) { reason = e.message; }
ok(reason && /limit/.test(reason), "si Open-Meteo falla, el error trae su motivo");

console.log("Ruido de nubes (calibración)");
ok(hash12(1, 2) >= 0 && hash12(1, 2) < 1 && hash12(1, 2) !== hash12(2, 1), "hash en [0, 1) y no simétrico");
for (const layer of ["low", "mid", "high"]) {
  const st = LAYER_STYLE[layer];
  for (const cover of [0, 0.15, 0.5, 0.85, 1]) {
    const th = threshold(layer, cover);
    let covered = 0, n = 0;
    for (let i = 0; i < 70; i++) for (let j = 0; j < 70; j++) {
      const [x, y] = layerCoord(i * 1.9 + 3000, j * 1.9 + 5000, st, [0.6, 0.8]);
      if (density(fbm(x, y, st.octaves), th, st) >= 0.5) covered++; n++;
    }
    ok(cover === 0 || cover === 1 ? covered / n === cover : near(covered / n, cover, 0.12), `capa ${layer}, ${Math.round(cover * 100)} %: cubre ${Math.round(covered / n * 100)} % del plano`);
  }
}

console.log("Luz de las nubes");
const st = (sunAlt, cls, moon = null) => ({ sunAlt, cls, sunDir: [0, 1, 0], moonAlt: moon ? 45 : -90, moonIllum: moon || 0, moonFade: 1,
  colors: { sunGlow: [1, 0.55, 0.3], horizon: [0.7, 0.8, 0.95] } });
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const dayL = cloudLight(st(40, 5)), cityN = cloudLight(st(-30, 8)), darkN = cloudLight(st(-30, 1)), moonN = cloudLight(st(-30, 1, 1));
ok(lum(dayL.lit) > 0.85 && lum(dayL.shade) < lum(dayL.lit), "de día: blancas, grises por debajo");
ok(lum(darkN.lit) < 0.02, "noche en cielo oscuro: casi negras (solo tapan estrellas)");
ok(lum(cityN.lit) > 3 * lum(darkN.lit) && cityN.lit[0] > cityN.lit[2], "noche en ciudad: más claras y anaranjadas");
ok(lum(moonN.lit) > lum(darkN.lit) + 0.08, "la Luna llena las ilumina");
const dusk = cloudLight(st(-3, 5));
ok(dusk.lit[0] > dusk.lit[2] + 0.1, "en el crepúsculo, teñidas del color del Sol bajo");
ok(lum(dusk.lit) > lum(dusk.litAnti) && dusk.litAnti[2] >= dusk.litAnti[0] - 0.15, "hacia el Sol, encendidas; del lado opuesto, más grises");
ok(near(lum(dayL.lit), lum(dayL.litAnti), 1e-9), "a pleno día, igual de blancas a ambos lados");
const dr = drift([10, 0], 3600);
ok(near(dr.off[0], 36, 1e-9) && dr.dir[0] === 1, "viento de 10 m/s: la capa se mueve 36 km en una hora");

const sky0 = (c) => ({ total: c, low: c, mid: 0, high: 0, wind: { low: [5, 0], mid: [0, 0], high: [0, 0] } });
ok(makeOccluder(sky0(0), 1e9) === null && makeOccluder(null, 0) === null, "sin nubes no hay nada que tapar");
const occ1 = makeOccluder(sky0(1), 1e9);
ok(occ1([0, 1, 0]) > 0.9 && occ1([0.6, 0.5, 0.62]) > 0.9 && occ1([1, 0, 0]) === 0, "cubierto: tapa todo el cielo (no lo que está bajo el horizonte)");
let hid = 0, tot = 0;
for (let i = 0; i < 600; i++) {
  const occH = makeOccluder(sky0(0.5), 1e9 + i * 4001);   // cada muestra, con las nubes en otro sitio
  const az = hash12(i, 1) * 6.283, alt = 0.25 + hash12(i, 2) * 1.2, d = [Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az)];
  if (occH(d) > OCC_HIDE) hid++; tot++;
}
ok(hid / tot > 0.12 && hid / tot < 0.5, `con 50 % de nubes bajas, la parte espesa tapa ${Math.round(hid / tot * 100)} % de las direcciones`);

console.log("Satélite (NASA GIBS)");
const sat = (lon) => pickSource(lon).id;
ok(sat(-78.1) === "goes-east" && sat(-99.1) === "goes-east" && sat(-68.1) === "goes-east" && sat(-70.6) === "goes-east" && sat(-74.1) === "goes-east", "Ecuador, México, Bolivia, Chile y Colombia: GOES-Este");
ok(sat(-122.4) === "goes-west" && sat(-157.9) === "goes-west", "California y Hawái: GOES-Oeste");
ok(sat(-3.7) === "mtg" && sat(2.3) === "mtg" && sat(31.2) === "mtg", "España, Francia y Egipto: Meteosat (EUMETSAT)");
ok(sat(139.7) === "viirs" && sat(151.2) === "viirs", "Japón y Australia: pasada diaria de VIIRS");
const w = new URL(wmsUrl(SOURCES["goes-east"], [-81, -156, 81, 6], 512, 512, "2026-11-17T16:30:00Z"));
ok(w.hostname === "gibs.earthdata.nasa.gov" && w.searchParams.get("TIME") === "2026-11-17T16:30:00Z" && w.searchParams.get("BBOX") === "-81,-156,81,6", "imagen WMS con su hora");
const we = new URL(wmsUrl(SOURCES.mtg, [-81, -81, 81, 81], 512, 512, null));
ok(we.hostname === "view.eumetsat.int" && we.searchParams.get("LAYERS") === "mtg_fd:rgb_geocolour" && !we.searchParams.has("TIME"), "imagen del Meteosat (EUMETSAT), la más reciente");
ok(/\/mtg_fd\/rgb_geocolour\/ows\?.*GetCapabilities/.test(timeUrl(SOURCES.mtg)), "la hora del Meteosat, de las capacidades de su capa");
ok(latestTime('<Dimension name="time" default="x" units="ISO8601">2024-09-23T00:00:00.000Z/2026-11-17T17:00:00.000Z/PT10M</Dimension>') === "2026-11-17T17:00:00Z", "lee la hora de unas capacidades WMS");
const dom = `<Domains><DimensionDomain><Domain>2026-11-17T12:00:00Z/2026-11-17T15:00:00Z/PT10M,2026-11-17T15:30:00Z/2026-11-17T16:30:00Z/PT10M</Domain></DimensionDomain></Domains>`;
ok(latestTime(dom) === "2026-11-17T16:30:00Z", "la imagen más reciente, del dominio de tiempos");
ok(latestTime("<Domain>2026-11-15/2026-11-16/P1D</Domain>") === "2026-11-16", "también con días (VIIRS)");
ok(latestTime("<x/>") === null, "sin dominio: null");
ok(/GOES-East_ABI_GeoColor\/default\/1km\/all\/.+--.+\.xml$/.test(domainsUrl("GOES-East_ABI_GeoColor", "1km", new Date("2026-11-17T17:00:00Z"), 6)), "consulta del dominio de tiempos (WMTS)");
ok(timeCandidates("2026-11-17T16:40:00Z", SOURCES["goes-east"]).join() === "2026-11-17T16:40:00Z,2026-11-17T16:30:00Z,2026-11-17T16:20:00Z,", "si la hora anunciada sale vacía, prueba las dos anteriores y la de por defecto");
ok(timeCandidates("2026-11-16", SOURCES.viirs).join() === "2026-11-16," && timeCandidates(null, SOURCES.mtg).join() === "", "VIIRS: el día anunciado; sin hora: la de por defecto");
const im = { data: new Uint8ClampedArray(4 * 70) };
for (let i = 0; i < 70; i++) im.data[i * 4 + 3] = i < 35 ? 255 : 0;
ok(near(dataFraction(im), 0.5, 0.1), "fracción de la imagen con dato");
const c0 = orthoInverse(0, 0, 0.04, -78.1);
ok(near(c0.lat, 0.04, 1e-9) && near(c0.lon, -78.1, 1e-9), "el centro del globo es tu lugar");
ok(orthoInverse(0.8, 0.7, 0, -78) === null, "fuera del disco: nada");
let maxErr = 0;
for (const [lat, lon] of [[10, -70], [-30, -100], [45, -78], [0, -20]]) {
  const p = orthoForward(lat, lon, 0.04, -78.1); const q = orthoInverse(p.x, p.y, 0.04, -78.1);
  maxErr = Math.max(maxErr, Math.abs(q.lat - lat), Math.abs(((q.lon - lon + 540) % 360) - 180));
}
ok(maxErr < 1e-6, "proyección ortográfica: ida y vuelta exacta");
const n0 = orthoForward(30, -78.1, 0, -78.1);
ok(n0.y < 0 && near(n0.x, 0, 1e-9), "el norte queda arriba");
const rb = regionBox(0.04, -78.1, 4);
ok(rb.join() === "-3.96,-82.1,4.04,-74.1", "«tu zona»: ±4° alrededor del lugar");

console.log("Integración");
const sky = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/createCloudsLayer\(\)/.test(sky) && /clouds\.follow\(/.test(sky), "el cielo crea la capa de nubes y la sigue con la cámara");
ok(/teseo_clouds/.test(sky), "el interruptor de nubes se recuerda");
const credits = readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");
ok(/Open-Meteo/.test(credits) && /GIBS/.test(credits), "créditos de Open-Meteo y NASA GIBS");

console.log("Nubes desde una cumbre");
ok(cloudLift(5788, 3600) === 2.188 && cloudLift(2850, 3500) === 0 && cloudLift(null, 3000) === 0, "cuánto subes sobre el suelo del pronóstico (nunca baja de 0)");
{
  const W = await import("../src/sky/weather.js"), CL = await import("../src/sky/cloudsLayer.js");
  ok(near(W.cloudBaseKm(15, 9), 0.75, 1e-12) && W.cloudBaseKm(12, 12) === 0.2 && W.cloudBaseKm(35, 0) === 3.5 && W.cloudBaseKm(null, 5) === null, "base de las nubes por la temperatura y el punto de rocío (125 m por grado, entre 0,2 y 3,5 km)");
  const K = CL.layerKm(0.75), K2 = CL.layerKm(3.5), K0 = CL.layerKm(null);
  ok(K.low === 0.75 && K.mid === 4.5 && K.high === 9 && K2.mid === 5 && K2.high === 9 && K0.low === 1.5, "las medias y las altas quedan por encima de las bajas; sin datos, 1,5 km");
  ok(near(CL.layerHeight("low", 0.2, 0.75), 0.55, 1e-12) && CL.layerHeight("low", 1, 0.75) < 0, "la base calculada, respecto a ti (desde una cumbre, debajo)");
  const T2 = 1795420800;
  const fcB = W.parseForecast({ latitude: 0, longitude: -78.1, elevation: 2850, hourly: { time: [T2, T2 + 3600], cloud_cover: [100, 100], cloud_cover_low: [100, 100], cloud_cover_mid: [30, 30], cloud_cover_high: [90, 90], temperature_2m: [14, 16], dew_point_2m: [9, 9] } });
  ok(near(W.cloudsAt(fcB, T2 + 1800).baseKm, 0.125 * 6, 1e-9) && W.cloudsAt(W.parseForecast({ hourly: { time: [T2], cloud_cover: [50] } }), T2).baseKm === null, "cada instante trae su base (interpolada); sin datos, null");
  ok(/temperature_2m/.test(new URL(W.forecastUrl(0, -78)).searchParams.get("hourly")) && /dew_point_2m/.test(new URL(W.forecastUrl(0, -78)).searchParams.get("hourly")), "el pronóstico de la zona pide temperatura y punto de rocío");
  const P = CL.layerParams({ low: 0.5, mid: 0.2, high: 0.1, baseKm: 0.75, wind: { low: [0, 0], mid: [0, 0], high: [0, 0] } }, T2, 0);
  ok(near(P[0].h, 0.75, 1e-12) && P[1].h === 4.5, "las capas del dibujo usan la base calculada");
}
ok(layerHeight("low", 0) === 1.5 && layerHeight("low", 2.2) < 0 && layerHeight("mid", 2.2) > 0 && Math.abs(layerHeight("low", 1.5)) === 0.12, "desde la cumbre las bajas quedan debajo y las medias encima (nunca dentro)");
{
  const allLow = { low: 1, mid: 0, high: 0, wind: { low: [5, 0], mid: [0, 0], high: [0, 0] } };
  ok(makeOccluder(allLow, 1e9, 2.5) === null && makeOccluder(allLow, 1e9, 0) !== null, "un mar de nubes por debajo no tapa las estrellas");
  ok(layerParams(allLow, 1e9, 2.5)[0].h < 0, "la capa baja va por debajo");
  const cl = readFileSync(new URL("../src/sky/cloudsLayer.js", import.meta.url), "utf8");
  ok(/float terrainFront\(/.test(cl) && /below\.renderOrder = 2\.8/.test(cl) && /uSide/.test(cl), "las de abajo se dibujan tras las montañas, que las tapan donde asoman");
  const cj = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
  ok(/ref\.clouds\.setView\(cloudLiftKm, hzData\)/.test(cj) && /makeOccluder\(cf\.clouds, d\.getTime\(\) \/ 1000, cloudLiftKm, map\)/.test(cj), "la vista y las estrellas tapadas usan la misma altura de las capas (y el mismo mapa del satélite)");
}

// mejor ventana para observar (tarjeta del clima)
{
  const S = (arr, t0 = 0) => arr.map((v, i) => ({ t: t0 + i * 3600, total: v == null ? null : v / 100 }));
  const w = bestWindow(S([85, 80, 70, 55, 40, 25, 20, 30, 45, 60, 70, 75]));
  ok(w && w.i0 === 5 && w.i1 === 7 && w.t1 === 8 * 3600 && near(w.min, 0.2, 1e-9), "ventana: de la hora más despejada a las vecinas que no la pasan en 15 puntos");
  ok(bestWindow(S([90, 80, 70, 60, 55])) === null, "sin ventana si lo más despejado pasa de 50 %");
  ok(bestWindow(S([10, 10, 80, 5, 5]), null).i0 === 3, "gana el tramo de la hora más despejada");
  const night = (t) => t >= 2 * 3600;
  const wn = bestWindow(S([0, 0, 30, 35, 90]), night);
  ok(wn && wn.i0 === 2 && wn.i1 === 3, "solo cuenta las horas de noche");
  ok(bestWindow(S([null, null])) === null && bestWindow([]) === null, "sin datos, sin ventana");
  const { parseNow: pn } = await import("../src/sky/nowWeather.js");
  const r = pn({ current: { time: "2026-11-23T01:45", temperature_2m: 13, apparent_temperature: 13.4, relative_humidity_2m: 94, precipitation_probability: 75, uv_index: 0, visibility: 11320, cloud_cover: 100, weather_code: 3, is_day: 0, wind_speed_10m: 1, wind_direction_10m: 45 } });
  ok(r.feels === 13.4 && r.rh === 94 && r.pop === 75 && r.uv === 0 && near(r.visKm, 11.32, 1e-9) && r.cloud === 100 && r.at === Date.UTC(2026, 10, 23, 1, 45), "lee sensación, humedad, lluvia, UV, visibilidad y la hora del dato");
  const r2 = pn({ current: { temperature_2m: 10, relative_humidity_2m: 140 } });
  ok(r2.rh === null && r2.feels === null && r2.at === null, "lo que falta o no es creíble queda en null");
}

// nubes del satélite (satClouds.js)
{
  const sc = await import("../src/sky/satClouds.js");
  const n = 5, b64 = (arr) => Buffer.from(Uint8Array.from(arr)).toString("base64");
  const fill = (v) => new Array(n * n).fill(v);
  const high = fill(0); for (let i = 0; i < 10; i++) high[i] = 100;      // las dos filas del sur, nubes altas
  const low = fill(0); low[24] = 255;                                     // la celda del extremo noreste, sin dato
  const j = { time: "2026-11-23T02:10:21Z", sat: "GOES-19", by: "NOAA", source: "goes-east", n, res_km: 3, radius_km: 6, cover: 0.4,
    layers: { low: { cover: 0, grid: b64(low) }, mid: { cover: 0, grid: b64(fill(0)) }, high: { cover: 0.4, grid: b64(high) } } };
  const sat = sc.parseSatClouds(j);
  ok(sat && sat.n === 5 && sat.half === 7.5 && sat.layers.high[0] === 100 && sat.layers.low[24] === 255 && sat.t === Date.UTC(2026, 10, 23, 2, 10, 21) / 1000, "lee la malla del satélite");
  ok(sc.parseSatClouds({ ...j, layers: { ...j.layers, low: { cover: 0, grid: "AAAA" } } }) === null, "rechaza una malla de tamaño equivocado");
  ok(sc.satWeight(sat, sat.t + 30 * 60) === 1 && sc.satWeight(sat, sat.t - 200 * 60) === 0 && sc.satWeight(sat, sat.t + 80 * 60) > 0 && sc.satWeight(sat, sat.t + 80 * 60) < 1, "el satélite manda cerca del barrido y se apaga lejos");
  const f = sc.fuseSat(sat, { low: 0.5, mid: 1, high: 0 });
  ok(f.layers.high[0] === 100 && f.layers.mid[0] === 100 && f.layers.low[0] === 50 && f.layers.mid[12] === 0 && f.layers.low[24] === 255, "bajo un tope alto se completan medias y bajas con el pronóstico; donde se ve el suelo, nada");
  ok(sc.fuseSat(sat, { low: 0.5, mid: 1, high: 0 }) === f, "la fusión se recuerda mientras no cambie el pronóstico");
  const m = sc.mergeClouds({ low: 0.9, mid: 0.9, high: 0.9, total: 1, wind: { low: [1, 0], mid: [0, 0], high: [0, 0] } }, f, 1);
  ok(near(m.high, f.mean.high, 1e-9) && m.wind.low[0] === 1 && m.sat === true, "con peso 1, la media de cada capa es la del satélite y el viento el del pronóstico");
  {
    // bóveda: una celda llena encima tapa casi todo el cielo; un anillo lejano, casi nada
    const N = 101, g1 = new Uint8Array(N * N), g2 = new Uint8Array(N * N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const d = Math.hypot(r - 50, c - 50) * 3; if (d <= 20) g1[r * N + c] = 100; else g2[r * N + c] = 100; }
    const near20 = sc.domeCover(g1, N, 3, 1.2), far = sc.domeCover(g2, N, 3, 1.2);
    ok(near20 > 0.9 && far < 0.1 && near(near20 + far, 1, 1e-9), "nubes bajas en 20 km a la redonda tapan más del 90 % de la bóveda; las del resto, menos del 10 %");
    ok(f.dome && near(f.dome.total, 1 - (1 - f.dome.low) * (1 - f.dome.mid) * (1 - f.dome.high), 1e-12) && near(m.dome.high, f.dome.high, 1e-9), "la tarjeta recibe la nubosidad de la bóveda por capa y total");
  }
  const tex = sc.thresholdTexture(f);
  ok(tex.length === n * n * 4 && tex[3] === 255 && tex[24 * 4 + 3] === 0, "textura de umbrales con la validez en el canal alfa");
  ok(near(sc.decTh(tex[2]), threshold("high", 1), 0.01) && near(sc.decTh(tex[12 * 4 + 2]), threshold("high", 0), 0.01), "los umbrales codificados son los del ruido para esa cobertura");
  const cen = sc.sampleThreshold(tex, n, f.half, 2, 0, -4.5), out = sc.sampleThreshold(tex, n, f.half, 2, 50, 0);
  ok(cen && near(cen.th, threshold("high", 1), 0.02) && cen.w > 0.9 && out === null, "se lee el umbral local como la GPU, y nada fuera de la malla");
  const off = sc.mapOffsets({ wind: { low: [10, 0], mid: [0, -5], high: [0, 0] } }, sat.t + 600, sat.t);
  ok(near(off[0][0], 6, 1e-9) && near(off[1][1], -3, 1e-9), "la malla viaja con el viento de cada capa");
}

// la tarjeta del tiempo a otra hora: horas del pronóstico del lugar (nowWeather.js)
{
  const nw = await import("../src/sky/nowWeather.js");
  const u = new URL(nw.nowUrl(0.07, -78.13, 2830));
  ok(u.searchParams.get("hourly") === u.searchParams.get("current") && u.searchParams.get("forecast_hours") === "168" && u.searchParams.get("elevation") === "2830", "las horas se piden con las mismas variables y la altura del lugar");
  ok(u.searchParams.get("timezone") === "auto" && u.searchParams.get("forecast_days") === "7" && /precipitation_sum/.test(u.searchParams.get("daily")) && /dew_point_2m/.test(u.searchParams.get("hourly")) && /pressure_msl/.test(u.searchParams.get("hourly")), "pide los 7 días en la hora local, el punto de rocío y la presión");
  const T0 = 1795420800;
  const r = nw.parseNow({ current: { time: T0, temperature_2m: 13, weather_code: 3, is_day: 1, wind_speed_10m: 2, wind_direction_10m: 45, precipitation_probability: 0 },
    hourly: { time: [T0, T0 + 3600, T0 + 7200], temperature_2m: [13, 14, 12], apparent_temperature: [12, 13, 11], relative_humidity_2m: [82, 90, 140], precipitation_probability: [0, 100, 60], precipitation: [0, 2.5, null],
      uv_index: [2, 3, 0], visibility: [2200, 900, null], wind_speed_10m: [2, 6, 0], wind_direction_10m: [45, 200, 10], weather_code: [3, 63, 61], is_day: [1, 1, 0], cloud_cover: [85, 100, 90] } });
  ok(r.at === T0 * 1000 && r.hours.length === 3 && r.hours[1].pop === 100 && r.hours[1].code === 63 && near(r.hours[1].visKm, 0.9, 1e-9) && r.hours[2].rh === null && r.hours[2].day === false, "lee las horas (y descarta lo que no es creíble)");
  const r2 = nw.parseNow({ current: { time: T0, temperature_2m: 13, dew_point_2m: 9.4, pressure_msl: 1016.3 },
    hourly: { time: [T0], temperature_2m: [13], dew_point_2m: [9], pressure_msl: [1500] },
    daily: { time: [T0, T0 + 86400], weather_code: [80, 51], temperature_2m_max: [17.5, 18.5], temperature_2m_min: [9.6, null], precipitation_sum: [8.6, -1] } });
  ok(r2.dew === 9.4 && r2.hPa === 1016.3 && r2.hours[0].dew === 9 && r2.hours[0].hPa === null, "lee el punto de rocío y la presión (y descarta una presión imposible)");
  ok(r2.days.length === 2 && r2.days[0].code === 80 && r2.days[0].tmax === 17.5 && r2.days[0].mm === 8.6 && r2.days[1].tmin === null && r2.days[1].mm === null, "lee los días");
  ok(nw.parseNow({ current: { time: T0, temperature_2m: 13 } }).days.length === 0, "sin días, la lista va vacía");
  ok(nw.hourAt(r.hours, T0 + 3600 + 600).t === T0 + 3600 && nw.hourAt(r.hours, T0 + 5 * 3600) === null && nw.hourAt([], T0) === null, "la hora que contiene un instante, o ninguna");
}

// lluvia, cielo cubierto y bruma (rainLook.js)
{
  const rl = await import("../src/sky/rainLook.js");
  const ul = new URL(forecastUrl(0.07, -78.13));
  ok(/weather_code/.test(ul.searchParams.get("hourly")) && /visibility/.test(ul.searchParams.get("hourly")) && /(^|,)precipitation(,|$)/.test(ul.searchParams.get("hourly")), "el pronóstico pide tipo de tiempo, lluvia y visibilidad");
  const T1 = 1795420800;
  const fcR = parseForecast({ latitude: 0.1, longitude: -78.1, elevation: 3100, hourly: { time: [T1, T1 + 3600], cloud_cover: [72, 60], cloud_cover_low: [30, 20], cloud_cover_mid: [7, 5], cloud_cover_high: [58, 50],
    precipitation_probability: [98, 50], weather_code: [63, 3], precipitation: [2.4, 0], visibility: [4700, 24140] } });
  const c0 = cloudsAt(fcR, T1 + 600), c1 = cloudsAt(fcR, T1 + 3000);
  ok(c0.code === 63 && c1.code === 3 && near(c0.visKm, 4.7 + (24.14 - 4.7) / 6, 1e-6) && near(c0.mm, 2.4 * 5 / 6, 1e-9), "el código es el de la hora más cercana; lluvia y visibilidad se interpolan");
  ok(rl.withPointRain({ low: 0.3, code: 3, mm: 0, visKm: 24, precip: 0.52 }, { code: 61, mm: 0.4, visKm: 11, pop: 26 }).precip === 0.26
    && rl.withPointRain({ low: 0.3, code: 3, precip: 0.52 }, { code: 61, mm: 0.4, visKm: 11, pop: 26 }).code === 61
    && rl.withPointRain({ low: 0.3, code: 3, precip: 0.52 }, null).rainSrc === "cell" && rl.withPointRain(null, null) === null, "la lluvia del dibujo es la de tu punto (la misma de la tarjeta); sin ella, la de la zona");
  ok(rl.rainAmount({ code: 63, mm: 2 }) === 0.7 && rl.rainAmount({ code: 3, mm: 0 }) === 0 && rl.rainAmount({ code: 95, mm: 0 }) === 1 && rl.rainAmount({ code: null, mm: 6 }) === 1 && rl.rainAmount(null) === 0, "intensidad de la lluvia por código y milímetros");
  ok(rl.visBeta(24.14) === 0 && rl.visBeta(null) === 0 && near(rl.visBeta(4.7), 3.912 * (1 / 4.7 - 1 / 20), 1e-9), "bruma solo si el pronóstico baja la visibilidad (Koschmieder)");
  const fc = { low: 0.3, mid: 0.07, high: 0.58, total: 0.72, code: 63, mm: 2.4, visKm: 4.7, wind: { low: [0, 0], mid: [0, 0], high: [0, 0] } };
  const look = rl.rainLook(fc);
  const th = rl.thickenForRain(fc, look);
  ok(look.rain === 0.7 && th.low > 0.7 && th.mid > 0.4 && th.high === 0.58 && th.over.low > 0.3 && th.overR === 25, "con lluvia, las bajas y medias se engrosan y se cierran sobre ti");
  ok(rl.thickenForRain({ ...fc, code: 3, mm: 0 }, rl.rainLook({ ...fc, code: 3, mm: 0 })).low === 0.3, "sin lluvia no cambia nada");
  ok(rl.thickenForRain({ ...fc, code: 81 }, rl.rainLook({ ...fc, code: 81 })).overR === 7, "un chubasco se cierra en un radio corto");
  ok(rl.overcastOf(th, look) > 0.65 && rl.overcastOf({ low: 0.1, mid: 0, high: 1 }, null) < 0.25, "cubierto con bajas gruesas o lluvia; los cirros solo blanquean");
  ok(rl.overcastOf({ low: 0.3, mid: 0.1, high: 0.4, sat: true, satW: 1 }, look) < rl.overcastOf({ low: 0.3, mid: 0.1, high: 0.4 }, look), "con el satélite, los claros que ve siguen azules aunque llueva");
  // con el satélite: si no ve nubes sobre ti, la lluvia del pronóstico no se dibuja
  const n = 9, empty = () => new Uint8Array(n * n), full = () => new Uint8Array(n * n).fill(80);
  const clear = { n, res: 3, layers: { low: empty(), mid: empty(), high: empty() } }, cloudy = { n, res: 3, layers: { low: full(), mid: empty(), high: full() } };
  ok(rl.rainLook(fc, clear, 1).rain < 0.01 && near(rl.rainLook(fc, cloudy, 1).rain, 0.7, 1e-9) && near(rl.rainLook(fc, clear, 0).rain, 0.7, 1e-9), "el satélite reciente manda: sin nubes encima, sin lluvia");
  // la probabilidad: un chubasco al 25 % casi no se dibuja ni borra las montañas; al 80 %, entero
  const sh = { ...fc, code: 80, mm: 0.1, visKm: 4.88 };
  const l25 = rl.rainLook({ ...sh, precip: 0.25 }), l80 = rl.rainLook({ ...sh, precip: 0.8 }), lNo = rl.rainLook(sh);
  const l49 = rl.rainLook({ ...sh, precip: 0.49 });
  ok(l25.rain < 0.01 && near(l80.rain, 0.5, 1e-9) && near(lNo.rain, 0.5, 1e-9) && l49.rain > 0.15 && l49.rain < 0.25, "la lluvia del dibujo cuenta según su probabilidad: 49 %, algo menos de la mitad (sin ella, como antes)");
  ok(rl.hazeAt(l25, 15) < 0.3 && rl.hazeAt(l80, 15) > 0.7 && rl.hazeAt(lNo, 15) > 0.9, "la bruma de la lluvia, también: al 25 %, las montañas a 15 km se ven");
  ok(near(rl.expectedBeta(0.6, 1), 0.6, 1e-12) && rl.expectedBeta(0.6, 0) === 0 && rl.expectedBeta(0, 0.5) === 0 && near(rl.hazeAt({ beta: rl.expectedBeta(0.6, 0.5) }, 15), 0.5 * (1 - Math.exp(-9)), 1e-9), "la bruma esperada a 15 km es la media");
  ok(near(rl.rainLook({ ...fc, code: 45, visKm: 0.4, precip: 0.05 }).beta, rl.visBeta(0.4), 1e-12), "la niebla no depende de la probabilidad de lluvia");
  ok(rl.hazeAt({ beta: 0.6 }, 15) > 0.9 && rl.hazeAt({ beta: 0.6 }, 15) <= 0.95 && rl.hazeAt({ beta: 0 }, 50) === 0 && rl.hazeAt(null, 5) === 0, "la bruma borra lo lejano (sin pasar de 95 %)");
  const st = { sunAlt: 50, cls: 5, moonAlt: -10, moonIllum: 0, colors: { zenith: [0.17, 0.44, 0.82], horizon: [0.66, 0.8, 0.94], sunGlow: [1, 0.96, 0.87], glow: 0.6, ground: [0.1, 0.1, 0.1], alpha: 1 } };
  const ws = rl.weatherSky(st, th, look);
  ok(ws !== st && ws.wx.rain === 0.7 && ws.colors.zenith[2] - ws.colors.zenith[0] < 0.15 && ws.colors.glow < 0.3 && st.colors.zenith[0] === 0.17, "de día con lluvia el cielo pierde el azul y el resplandor del Sol (sin tocar el original)");
  ok(rl.weatherSky(st, { low: 0.05, mid: 0, high: 0 }, { rain: 0, beta: 0 }) === st, "despejado: el cielo queda igual");
  const L0 = cloudLight(st), L1 = cloudLight(ws);
  ok(L1.lit[0] < L0.lit[0] - 0.1 && L1.shade[0] < L0.shade[0] && L1.rim < L0.rim && L1.rain.length === 3, "nubes de lluvia: grises, con la base oscura y sin borde de Sol");
  const P = layerParams(th, T1, 0);
  ok(P[0].over > 0 && P[2].over === 0, "el cierre sobre ti llega a cada capa");
  const occ0 = makeOccluder({ ...fc, over: null }, T1, 0), occ1 = makeOccluder(th, T1, 0);
  ok(occ1([0, 1, 0]) >= occ0([0, 1, 0]) && occ1([0, 1, 0]) > 0.9, "con lluvia, el cenit queda tapado también para los nombres");
}

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
