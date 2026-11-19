// Pruebas de nubes y clima: src/sky/weather.js (pronóstico), src/sky/cloudNoise.js (calibración del ruido),
// src/sky/cloudsLayer.js (luz de las nubes) y src/sky/satellite.js (imagen de satélite y proyección).
import { forecastUrl, parseForecast, cloudsAt, coverClass, nextChange, bestNightHour, hourlySeries, fetchForecast } from "../src/sky/weather.js";
import { fbm, threshold, density, layerCoord, LAYER_STYLE, hash12 } from "../src/sky/cloudNoise.js";
import { cloudLight, drift, makeOccluder, OCC_HIDE } from "../src/sky/cloudsLayer.js";
import { pickSource, wmsUrl, latestTime, orthoInverse, orthoForward, regionBox, domainsUrl, timeUrl, SOURCES, timeCandidates, dataFraction } from "../src/sky/satellite.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log("Pronóstico (Open-Meteo)");
const u = new URL(forecastUrl(0.04312, -78.14563));
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

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
