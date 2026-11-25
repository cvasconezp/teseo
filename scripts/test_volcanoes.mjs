// Pruebas: volcanes del Smithsonian junto a las cumbres (src/sky/volcanoes.js), el tiempo de ahora
// (src/sky/nowWeather.js) y la proyección del mapa topográfico (src/sky/topo.js).
import { readFileSync } from "node:fs";
import { matchVolcanoes, volcanoFacts, recentEruption, destPoint, kmBetween, fetchVolcanoes, VT, eruptingInView, bearingDeg, volcanoesOnSkyline } from "../src/sky/volcanoes.js";
import { angleOf } from "../src/sky/terrainLayer.js";
import { nowUrl, parseNow, wxKind, fmtTemp } from "../src/sky/nowWeather.js";
import { toPx, toLL, TOPO_TILE } from "../src/sky/topo.js";
import { veiColumnKm, ventPos, plumeParams, centerHeight } from "../src/sky/plumeLayer.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FALLA:", m); } };

console.log("Volcanes junto a las cumbres");
const volcs = [
  { id: 352010, name: "Cayambe", lat: 0.029, lon: -77.986, elev_m: 5790, type: "Compound", last_year: 1786, tectonic: "Subduction zone / Continental crust (> 25 km)", rock: "Andesite / Basaltic Andesite", country: "Ecuador", region: "Northern Andean Volcanic Arc", url: "https://volcano.si.edu/volcano.cfm?vn=352010" },
  { id: 352020, name: "Guagua Pichincha", lat: -0.171, lon: -78.598, elev_m: 4784, type: "Stratovolcano", last_year: 2002, country: "Ecuador" },
  { id: 352050, name: "Cotopaxi", lat: -0.677, lon: -78.436, elev_m: 5911, type: "Stratovolcano", last_year: 2026, country: "Ecuador" },
];
const peaks = [
  { name: "Cayambe", lat: 0.0252, lon: -77.989, az: 96.2, dist_km: 17.6, ele_m: 5790 },
  { name: "San Bartolo", lat: 0.1058, lon: -78.3041, az: 291.8, dist_km: 19, ele_m: 4021 },
  { name: "Volcán Pichincha", lat: -0.1657, lon: -78.6043, az: 246, dist_km: 56, ele_m: 4794 },
  { name: "Rucu Pichincha", lat: -0.1627, lon: -78.5667, az: 244, dist_km: 52, ele_m: 4696 },
  { name: "Cotopaxi", az: 202.0, dist_km: 86.5, ele_m: 5897 },              // de la caché vieja: sin lat/lon
];
const m = matchVolcanoes(peaks, volcs, 0.041, -78.146);
ok(m[0].volcano && m[0].volcano.id === 352010, "Cayambe: su volcán (a 0,5 km)");
ok(!m[1].volcano, "San Bartolo no es un volcán del Smithsonian");
ok(m[2].volcano && m[2].volcano.id === 352020 && !m[3].volcano, "Guagua Pichincha va a la cumbre más cercana (una sola)");
ok(m[4].volcano && m[4].volcano.id === 352050, "sin coordenadas, se calculan con el rumbo y la distancia");
ok(peaks[0].volcano === undefined, "no cambia la lista original");
ok(matchVolcanoes(peaks, null).every((p) => !p.volcano), "sin volcanes, las cumbres tal cual");
const [la, lo] = destPoint(0, 0, 90, 111.195);
ok(Math.abs(la) < 1e-6 && Math.abs(lo - 1) < 1e-3 && Math.abs(kmBetween(0, 0, 0, 1) - 111.195) < 0.01, "destino y distancia en la esfera");
ok(recentEruption(volcs[1]) && !recentEruption(volcs[0]) && !recentEruption(null), "erupción desde 1900");
const f = volcanoFacts(volcs[0], "es", 2026);
const fx = Object.fromEntries(f.map((x) => [x.label, x.value]));
ok(fx.Tipo === "Volcán compuesto" && fx["Última erupción"] === "1786" && fx.Entorno === "Zona de subducción, corteza continental" && fx["Roca principal"] === "andesita / andesita basáltica", "datos traducidos");
ok(volcanoFacts(volcs[2], "es", 2026).find((x) => x.label === "Última erupción").value.includes("en curso"), "erupción de este año: en curso o muy reciente");
ok(volcanoFacts({ last_year: -5550 }, "es").find((x) => x.label === "Última erupción").value === "hacia el 5.550 a. C.", "años antes de Cristo");
ok(volcanoFacts({ last_year: null }, "en").find((x) => x.label === "Last eruption").value === "No known date", "sin fecha");
ok(VT.es.sub("4.784 m", 2002) === "4.784 m · erupción 2002", "texto bajo el nombre");
{
  let url = "";
  const l = await fetchVolcanoes(0.041, -78.146, { api: "https://x", fetchImpl: async (u) => { url = u; return { ok: true, json: async () => ({ volcanoes: volcs }) }; } });
  ok(l.length === 3 && url === "https://x/api/volcanoes?lat=0.0&lon=-78.0&r_km=260", "una consulta por celda de 0,5°");
  const cj = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
  ok(/pk: \{ peak: p \}/.test(cj) && /setPeakSheet\(lbHit\.pk\.peak\)/.test(cj), "tocar el nombre de una montaña abre su ficha");
}

console.log("El tiempo de ahora");
const u = new URL(nowUrl(0.04312, -78.14563, 2911.4));
ok(u.searchParams.get("latitude") === "0.04" && u.searchParams.get("elevation") === "2911" && u.searchParams.get("current").startsWith("temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,") && /apparent_temperature/.test(u.searchParams.get("current")) && u.searchParams.get("wind_speed_unit") === "kmh", "lugar a 1 km y temperatura corregida a la altitud");
ok(!new URL(nowUrl(0, 0, null)).searchParams.get("elevation"), "sin altitud, la del modelo de Open-Meteo");
ok(parseNow({ current: { temperature_2m: 15.6, weather_code: 61, is_day: 1 } }).temp === 15.6 && parseNow({}) === null, "lee la respuesta");
ok(wxKind(0, true) === "sun" && wxKind(0, false) === "moon" && wxKind(3) === "cloud" && wxKind(63) === "rain" && wxKind(95) === "storm" && wxKind(73) === "snow" && wxKind(45) === "fog", "códigos WMO → icono");
{
  const nw = await import("../src/sky/nowWeather.js");
  ok(nw.wxKind(2, true) === "partly" && nw.wxKind(2, false) === "partly_night" && nw.WX_NAMES.es.partly_night === "Parcialmente nublado", "de noche, parcialmente nublado lleva luna");
  const a = nw.wxIcon(95, true, 25, 50), b = nw.wxIcon(95, true, 70, 50), c = nw.wxIcon(63, false, 10, 95), e = nw.wxIcon(3, true, 5, 95);
  ok(a.kind === "partly" && a.maybe === "storm" && b.kind === "storm" && !b.maybe && c.kind === "cloud" && c.maybe === "rain" && e.kind === "cloud" && !e.maybe, "con poca probabilidad, la tormenta o la lluvia van como marca y el icono es el de las nubes");
  ok(nw.wxIcon(61, true, null, 50).kind === "rain", "sin probabilidad, el código manda");
  const D = 1795582800, H = 3600;
  const hrs = (f) => Array.from({ length: 24 }, (_, i) => ({ t: D + i * H, day: i >= 6 && i < 18, ...f(i) }));
  const oneStorm = hrs((i) => ({ code: i === 15 ? 95 : 3, pop: i === 15 ? 80 : 10, cloud: 50 }));
  const wetDay = hrs((i) => ({ code: i >= 12 && i < 17 ? 63 : 3, pop: i >= 12 && i < 17 ? 70 : 10, cloud: 90 }));
  const sunny = hrs(() => ({ code: 1, pop: 0, cloud: 10 }));
  const d1 = nw.dayIcon({ t: D, code: 95 }, oneStorm), d2 = nw.dayIcon({ t: D, code: 63 }, wetDay), d3 = nw.dayIcon({ t: D, code: 1 }, sunny), d4 = nw.dayIcon({ t: D, code: 95 }, []);
  ok(d1.kind === "partly" && d1.maybe === "storm", "una tormenta de una hora no marca todo el día: nubes del día y la tormenta como marca");
  ok(d2.kind === "rain" && !d2.maybe && d3.kind === "sun" && !d3.maybe && d4.kind === "storm", "cinco horas de lluvia: día de lluvia; sin lluvia y despejado: sol; sin horas, el código del día");
}
ok(fmtTemp(15.6) === "16 °C" && fmtTemp(-2.6) === "−3 °C" && fmtTemp(-0.2) === "0 °C", "temperatura redondeada (con signo menos tipográfico)");

console.log("Mapa topográfico");
const [px, py] = toPx(-0.2, -78.5, 11), [la2, lo2] = toLL(px, py, 11);
ok(Math.abs(la2 + 0.2) < 1e-9 && Math.abs(lo2 + 78.5) < 1e-9, "Mercator ida y vuelta");
ok(Math.abs(toPx(0, 0, 0)[0] - 128) < 1e-9 && Math.abs(toPx(0, 0, 0)[1] - 128) < 1e-9, "el centro del mundo en el zoom 0");
ok(/^https:\/\/[abc]\.tile\.opentopomap\.org\/12\/1\/2\.png$/.test(TOPO_TILE(12, 1, 2)), "teselas de OpenTopoMap");

{
  const { parseNow: pn, compass8, windText, windVector, fmtWind } = await import("../src/sky/nowWeather.js");
  const w = pn({ current: { temperature_2m: 12, weather_code: 2, is_day: 1, wind_speed_10m: 14.4, wind_direction_10m: 45 } });
  ok(w.windKmh === 14.4 && w.windFrom === 45 && compass8(45) === "NE" && compass8(225, "es") === "SO" && compass8(225, "en") === "SW" && compass8(350) === "N", "viento: velocidad y de dónde viene, en 8 rumbos");
  ok(windText(w, "es") === "Viento del noreste, 14 km/h" && windText(w, "en") === "Wind from the northeast, 14 km/h" && fmtWind(3.6) === "4 km/h", "viento en palabras");
  const v = windVector(w);
  ok(Math.abs(v[0] + 4 * Math.SQRT1_2) < 1e-9 && Math.abs(v[1] + 4 * Math.SQRT1_2) < 1e-9, "el viento del noreste sopla hacia el suroeste (4 m/s)");
  const calm = pn({ current: { temperature_2m: 12, wind_speed_10m: 0.4, wind_direction_10m: 10 } });
  ok(windText(calm, "es") === "Calma" && windVector(calm) === null && pn({ current: { temperature_2m: 5 } }).windKmh === null && windText(pn({ current: { temperature_2m: 5 } })) === "", "calma y respuesta sin viento");
}
console.log("Erupciones ilustrativas");
ok(veiColumnKm(2) === 2.5 && veiColumnKm(3) === 6 && veiColumnKm(4) === 13 && veiColumnKm(null) === 2.5 && veiColumnKm(12) === 42, "altura de la columna según el VEI (Newhall y Self)");
const vp = ventPos(90, 0, 10);
ok(Math.abs(vp[0] - 10) < 1e-9 && Math.abs(vp[1]) < 1e-9 && Math.abs(vp[2]) < 1e-9, "cráter al este, en el horizonte");
const weak = plumeParams(2, "sim", 6), big = plumeParams(4, "sim", 6), gas = plumeParams(2, "gas", 6);
ok(weak.strong === 0 && big.strong === 1 && plumeParams(3, "sim", 6).strong === 0 && weak.H === 2.5 && big.H === 13 && big.Lb / big.H < weak.Lb / weak.H, "erupción pequeña: pluma tendida; grande: columna casi vertical con paraguas");
ok(gas.H <= 2.2 && gas.ash < weak.ash, "en erupción ahora: pluma baja y clara (sobre todo gases)");
ok(plumeParams(2, "sim", 12).Lb > weak.Lb, "con más viento se tumba antes de subir (pluma más tendida)");
ok(centerHeight(0, weak) === 0 && centerHeight(100, weak) > 2.49 && centerHeight(weak.Lb, weak) > 1.5 && centerHeight(weak.Lb, weak) < 1.65, "la línea central sube y se allana a la altura de la columna");
{
  const pl = readFileSync(new URL("../src/sky/plumeLayer.js", import.meta.url), "utf8");
  ok(/float dens\(/.test(pl) && /uSun/.test(pl) && /fbm\(/.test(pl), "humo volumétrico con ruido y luz del Sol");
}
const fv = volcanoFacts({ last_vei: 2, last_start: 2022 }, "es");
ok(fv.find((x) => x.label === "Explosividad (VEI)").value === "2 de 8 · erupción de 2022", "VEI de la última erupción en la ficha");
ok(recentEruption({ erupting: true }), "en erupción este año cuenta como reciente");
{
  const ps = readFileSync(new URL("../src/sky/PeakSheet.jsx", import.meta.url), "utf8");
  ok(/onSimulate/.test(ps) && /T\.simNote/.test(ps), "botón de simular con su aviso de que es ilustrativa");
}

console.log("Volcanes en erupción a la vista");
{
  const hzFlat = { step_deg: 0.2, ground_m: 2800, eye_m: 1.7, alt: new Array(1800).fill(0.5) };
  const vs = [{ id: 1, name: "Sangay", lat: -2.005, lon: -78.341, elev_m: 5286, erupting: true, last_vei: 2 },
    { id: 2, name: "Cotopaxi", lat: -0.677, lon: -78.436, elev_m: 5911, erupting: false }];
  const iv = eruptingInView(vs, hzFlat, -1.67, -78.65, angleOf);
  ok(iv.length === 1 && iv[0].name === "Sangay" && Math.abs(iv[0].az - bearingDeg(-1.67, -78.65, -2.005, -78.341)) < 1e-9, "solo los que están en erupción, con su rumbo");
  const hzWall = { ...hzFlat, alt: new Array(1800).fill(8) };
  ok(eruptingInView(vs, hzWall, -1.67, -78.65, angleOf).length === 0, "tapados por montañas más cercanas, no");
  ok(Math.abs(bearingDeg(0, 0, 1, 0)) < 1e-9 && Math.abs(bearingDeg(0, 0, 0, 1) - 90) < 1e-9, "rumbo norte y este");
  const ps2 = readFileSync(new URL("../src/sky/PeakSheet.jsx", import.meta.url), "utf8");
  ok(/v && !v\.erupting && onSimulate/.test(ps2) && /T\.gasNote/.test(ps2), "simular solo si no está en erupción; si lo está, la pluma");
}

{
  // un volcán de 5.900 m a 80 km visto desde 5.790 m: su cumbre forma el filo en su rumbo
  const az = bearingDeg(0.025, -77.989, -0.677, -78.436), d = kmBetween(0.025, -77.989, -0.677, -78.436);
  const alt = angleOf(5911, d, 5790 + 1.7), hzS = { step_deg: 0.2, ground_m: 5790, eye_m: 1.7, alt: new Array(1800).fill(-3) };
  hzS.alt[Math.round(az / 0.2)] = alt + 0.1;
  const on = volcanoesOnSkyline([{ id: 352050, name: "Cotopaxi", lat: -0.677, lon: -78.436, elev_m: 5911 }], hzS, 0.025, -77.989, angleOf);
  ok(on.length === 1 && on[0].name === "Cotopaxi" && Math.abs(on[0].alt - (alt + 0.1)) < 1e-9, "un volcán del Smithsonian que forma la silueta se nombra aunque el mapa no lo traiga");
  hzS.alt.fill(2);
  ok(volcanoesOnSkyline([{ id: 352050, name: "Cotopaxi", lat: -0.677, lon: -78.436, elev_m: 5911 }], hzS, 0.025, -77.989, angleOf).length === 0, "si el filo es de otra montaña, no");
}

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
if (fail) process.exit(1);
