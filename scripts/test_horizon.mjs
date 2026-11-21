// Pruebas del horizonte real en el navegador: src/sky/horizon.js (perfil, refracción, ocultación, salida y puesta
// tras las montañas, colores) y su integración en la vista Cielo y la ficha.
import { cellKey, terrainAltAt, refraction, apparentAlt, behindTerrain, highestPoint, snowLine, terrainRiseSet, terrainPalette, fetchHorizon, fetchPeaks, peaksToLabel, peakName, fetchSummit } from "../src/sky/horizon.js";
import { riseTransitSet, H0_SUN } from "../src/sky/riseset.js";
import { visibilityOf } from "../src/sky/objVisibility.js";
import { angleOf, snowAngles, snowJitter, sunLight, glowOf } from "../src/sky/terrainLayer.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };
const near = (a, b, t) => Math.abs(a - b) <= t;

// un horizonte de prueba: llano (0°) salvo una sierra de 10° entre 240° y 300° (al oeste) y un pico al este
const N = 720, alt = new Array(N).fill(0), top = new Array(N).fill(2800);
for (let i = 0; i < N; i++) { const az = i * 0.5; if (az >= 240 && az <= 300) { alt[i] = 10; top[i] = 4200; } if (Math.abs(az - 96) <= 2) { alt[i] = 9; top[i] = 5790; } }
const HZ = { lat: 0, lon: -78.15, ground_m: 2800, step_deg: 0.5, alt, bands: [
  { max_km: 3, alt: new Array(N).fill(-0.2), top_m: new Array(N).fill(2790) },
  { max_km: 12, alt: alt.map((v) => (v === 10 ? 10 : -0.1)), top_m: top },
  { max_km: 40, alt: alt.map((v) => (v === 9 ? 9 : -0.1)), top_m: top },
  { max_km: 150, alt: new Array(N).fill(0), top_m: new Array(N).fill(1000) }] };

console.log("Perfil");
ok(cellKey(0.04312, -78.14563) === "0.044,-78.146" && cellKey(10, 180) === "10.000,-180.000", "celda de 0,002° como la del servidor");
ok(cellKey(0.04312, -78.14563, true) === "f:0.0432,-78.1456", "celda fina de 0,0002° (cumbres y GPS), con su propia clave");
ok(terrainAltAt(HZ, 270) === 10 && terrainAltAt(HZ, 0) === 0 && terrainAltAt(HZ, 270 + 360) === 10 && terrainAltAt(HZ, -90) === 10, "altura del filo por acimut (y con vueltas)");
ok(near(terrainAltAt(HZ, 239.75), 5, 1e-9), "interpola entre muestras");
ok(near(refraction(0), 0.48, 0.03) && near(refraction(45), 0.017, 0.003) && apparentAlt(-0.5) > -0.5, "refracción: ~29′ en el horizonte, casi nada en lo alto");
const dir = (alt, az) => { const a = alt * Math.PI / 180, z = az * Math.PI / 180; return [Math.cos(a) * Math.sin(z), Math.sin(a), -Math.cos(a) * Math.cos(z)]; };
ok(behindTerrain(HZ, dir(5, 270)) && !behindTerrain(HZ, dir(11, 270)) && !behindTerrain(HZ, dir(5, 180)), "detrás de la sierra sí; por encima o donde es llano, no");
ok(!behindTerrain(HZ, dir(-5, 270)) && !behindTerrain(null, dir(5, 270)), "bajo 0° manda el suelo; sin horizonte, nada");
const hp = highestPoint(HZ);
ok(hp.alt === 10 && hp.az === 240 && hp.km === 12 && hp.top_m === 4200, "lo más alto del horizonte, con su banda y su cumbre");
ok(snowLine(0) === 4900 && snowLine(46) < 3200 && snowLine(-80) >= 600, "línea de nieves según la latitud");

console.log("Salida y puesta tras las montañas");
// el Sol en el ecuador un día de equinoccio, con la sierra al oeste: se esconde antes de su puesta
const lat = 0, lon = -78.15, date = new Date("2026-03-20T17:00:00Z");
const RAD = Math.PI / 180;
const sunDirAt = (d) => {   // dirección ecuatorial aproximada del Sol (Meeus, baja precisión)
  const n = (d.getTime() / 86400000 + 2440587.5) - 2451545, L = (280.46 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) % 360;
  const lam = (L + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD)) * RAD, eps = 23.439 * RAD;
  return [Math.cos(lam), Math.cos(eps) * Math.sin(lam), Math.sin(eps) * Math.sin(lam)];
};
const rts = riseTransitSet(sunDirAt, lat, lon, date, { minAlt: H0_SUN });
const { altAz } = await import("../src/sky/guide.js");
const altAt = (ms) => { const d = new Date(ms), v = sunDirAt(d); return altAz(v[0], v[1], v[2], lat, lon, d).alt; };
const azAt = (ms) => { const d = new Date(ms), v = sunDirAt(d); return altAz(v[0], v[1], v[2], lat, lon, d).az; };
const tr = terrainRiseSet(altAt, azAt, HZ, rts, { upper: 0.26 });
const early = tr && tr.set ? (rts.set.date.getTime() - tr.set.getTime()) / 60000 : null;
ok(tr && tr.set && early > 35 && early < 45, `el Sol se esconde tras la sierra de 10° unos 40 min antes de su puesta (${early && early.toFixed(1)} min)`);
ok(tr && (!tr.rise || Math.abs(tr.rise - rts.rise.date) < 90000), "por el este (llano a 90°) sale a su hora");
ok(near(apparentAlt(altAt(tr.set.getTime())) + 0.26, terrainAltAt(HZ, azAt(tr.set.getTime())), 0.02), "en ese instante el borde del Sol toca el filo");
const flat = { ...HZ, alt: new Array(N).fill(0) };
ok(terrainRiseSet(altAt, azAt, flat, rts, { upper: 0.26 }) === null, "horizonte llano: la ficha no añade nada");
const wall = { ...HZ, alt: new Array(N).fill(91) };
const tw = terrainRiseSet(altAt, azAt, wall, rts, { upper: 0.26 });
ok(tw && tw.hiddenAllDay, "rodeado de paredes más altas que el cenit: no llega a asomar");

console.log("Ficha (objVisibility)");
const sunObj = { layer: "solar", name: "Sol", nx: 1, ny: 0, nz: 0 };
const v0 = visibilityOf(sunObj, { lat, lon }, date), v1 = visibilityOf(sunObj, { lat, lon, horizon: HZ }, date);
ok(v0.terrain === null && v1.terrain && v1.terrain.set instanceof Date, "con horizonte, la ficha trae cuándo se esconde tras las montañas");
ok(v1.terrain.set < v1.rts.set.date, "y es antes que la puesta astronómica");

console.log("Colores");
const night = terrainPalette(null), day = terrainPalette({ sunAlt: 40, colors: { horizon: [0.75, 0.82, 0.92] } });
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
ok(lum(night.bands[0].top) < lum(night.bands[3].top) && lum(night.bands[3].top) < 0.3, "de noche: siluetas oscuras, las lejanas más claras");
ok(lum(day.bands[3].top) > lum(day.bands[0].top) && day.bands[3].top[2] > day.bands[0].top[2], "de día: las lejanas se azulan (perspectiva aérea)");
ok(lum(day.snow) > 0.8 && lum(night.snow) < 0.2, "nieve blanca de día, apagada de noche");

console.log("Nieve");
ok(near(angleOf(5790, 18, 2830), 9.3, 0.1), "el Cayambe (5.790 m a 18 km) se ve a ~9,3° desde 2.830 m");
const sb = { alt: [9.3, 5], top_m: [5790, 4200], dist_km: [18, 18] };
const sn = snowAngles(sb, 2830, 4900);
ok(sn[1] === null && sn[0] > 6 && sn[0] < 9.3, `la nieve empieza en la línea de nieves (${sn[0] && sn[0].toFixed(2)}°), bajo la cumbre; sin nieve donde no llega`);
{
  const js = Array.from({ length: 400 }, (_, i) => snowJitter(80 + i * 0.2, 45));
  const mx = Math.max(...js), mn = Math.min(...js), jumps = js.slice(1).map((v, i) => Math.abs(v - js[i]));
  ok(mx > 120 && mn < -120 && mx < 300 && mn > -300 && Math.max(...jumps) < 120, "el borde de la nieve sube y baja (±~250 m) sin saltos bruscos");
  ok(snowJitter(90, 45) === snowJitter(90, 45), "y siempre igual en el mismo sitio");
}

console.log("Red");
let calls = 0;
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
const f = async (url) => { calls++; return { ok: true, status: 200, json: async () => ({ ...HZ, url }) }; };
const h1 = await fetchHorizon(0.0431, -78.1456, { api: "https://api.x", fetchImpl: f });
ok(calls === 1 && /lat=0\.044&lon=-78\.146$/.test(h1.url), "pide al servidor la celda redondeada");
await fetchHorizon(0.0436, -78.1462, { api: "https://api.x", fetchImpl: f });
ok(calls === 1, "la misma celda no se vuelve a pedir");
ok(JSON.parse(store.get("teseo_horizon_v2"))[0].key === "0.044,-78.146", "se guarda en el teléfono");
let err = null;
try { await fetchHorizon(5, 5, { fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({ detail: "No se pudo leer el relieve" }) }) }); } catch (e) { err = e.message; }
ok(err && /relieve/.test(err), "si el servidor falla, el error trae su motivo");

console.log("Integración");
const sky = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/createTerrainLayer\(\)/.test(sky) && /behindTerrain\(/.test(sky) && /teseo_terrain/.test(sky), "el cielo dibuja las montañas, oculta lo que queda detrás y recuerda el interruptor");
ok(/horizon: hzData/.test(sky), "la ficha recibe el horizonte del lugar");
// nombres de las montañas
{
  const hzd = { step_deg: 0.2, alt: Array.from({ length: 1800 }, (_, i) => (i === 450 ? 9.41 : i === 900 ? 2.1 : 0)) };
  const list = [{ name: "Cayambe", name_en: "Cayambe Volcano", az: 90, alt: 9.41, ele_m: 5790 }, { name: "Viejo", az: 180, alt: 3.5 }, { name: "Sur", az: 180, alt: 2.1 }];
  const lab = peaksToLabel(list, hzd);
  const hzb = { ...hzd, bands: [{ alt: hzd.alt.map((v, i) => (i === 300 ? 1.2 : -1)) }, { alt: hzd.alt.map((v, i) => (i === 300 ? 4 : v)) }] };
  ok(peaksToLabel([{ name: "Delante", az: 60, alt: 1.2, band: 0 }], hzb).length === 1, "una cumbre delante de una sierra más alta también se rotula");
  ok(lab.length === 2 && lab[0].name === "Cayambe" && lab[1].name === "Sur", "solo se rotulan las cumbres que siguen sobre la silueta dibujada");
  ok(peaksToLabel(list, hzd, 1).length === 1 && peaksToLabel(null, hzd).length === 0 && peaksToLabel(list, null).length === 0, "límite y sin datos");
  ok(peakName(list[0], "en") === "Cayambe Volcano" && peakName(list[0], "es") === "Cayambe", "nombre en el idioma si OpenStreetMap lo tiene");
  let url = null;
  const res = await fetchPeaks(0.0401, -78.1502, { api: "https://x", fetchImpl: async (u) => { url = u; return { ok: true, json: async () => ({ peaks: list }) }; } });
  ok(url === "https://x/api/peaks?lat=0.040&lon=-78.150" && res.peaks.length === 3, "petición por celda del horizonte");
  ok(/teseo_peaks/.test(sky) && /peaksToLabel\(/.test(sky) && /cls: (p\.cls \|\| )?"peak"/.test(sky), "el cielo rotula las cumbres y recuerda el interruptor (apagado por defecto)");
}
const credits = readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");
ok(/Terrain Tiles/.test(credits) && /SRTM/.test(credits), "créditos del relieve");
ok(/OpenStreetMap/.test(credits) && /ODbL/.test(credits), "créditos de los nombres de las montañas");

// sombra de las montañas y arrebol (sunLight / glowOf)
{
  // valle con montañas de 4° al oeste: el Sol a 2°, al oeste (270°), ya está detrás de ellas
  const valle = { sunAlt: 2, sunAz: 270, hzSun: 4 };
  ok(sunLight({ ...valle, alt: 0, dKm: 0.5, az: 90 }) < 0.02, "Sol a 2° tras montañas de 4°: el pie del valle queda en sombra");
  ok(sunLight({ ...valle, alt: 1, dKm: 3, az: 90 }) < 0.05, "y una loma baja cercana también");
  // una cumbre alta al este, 2,9 km sobre el observador a 60 km (≈ 2,4° de altura): sigue al sol
  const altCumbre = angleOf(2900 + 2800, 60, 2800);
  ok(sunLight({ ...valle, alt: altCumbre, dKm: 60, az: 90 }) > 0.95, `la cumbre nevada a 60 km (${altCumbre.toFixed(1)}°) sigue al sol: arrebol`);
  // Sol ya 1° bajo el horizonte astronómico: el valle, a oscuras; la cumbre aún encendida
  const tras = { sunAlt: -1, sunAz: 270, hzSun: 4 };
  ok(sunLight({ ...tras, alt: altCumbre, dKm: 60, az: 90 }) > 0.5 && sunLight({ ...tras, alt: 0, dKm: 0.5, az: 90 }) === 0, "con el Sol a −1°, la cumbre todavía brilla y el valle no");
  ok(sunLight({ sunAlt: -3.5, sunAz: 270, hzSun: 4, alt: altCumbre, dKm: 60, az: 90 }) < 0.05, "a −3,5° se apaga también la cumbre");
  // la curvatura: una cumbre hacia el Sol lo ve más alto que una del lado contrario
  const cerca = sunLight({ sunAlt: -1.6, sunAz: 270, hzSun: 0, alt: altCumbre, dKm: 60, az: 270 });
  const lejos = sunLight({ sunAlt: -1.6, sunAz: 270, hzSun: 0, alt: altCumbre, dKm: 60, az: 90 });
  ok(cerca > lejos, `la cumbre del lado del Sol se apaga después (${cerca.toFixed(2)} > ${lejos.toFixed(2)})`);
  // mediodía: todo al sol, sin arrebol; de noche, nada
  ok(sunLight({ sunAlt: 60, sunAz: 0, hzSun: 5, alt: 0, dKm: 1, az: 180 }) === 1 && glowOf(60, 1) === 0, "a mediodía todo al sol y sin arrebol");
  ok(sunLight({ sunAlt: -20, sunAz: 0, hzSun: 0, alt: 3, dKm: 50, az: 0 }) === 0, "de noche, nada");
  ok(glowOf(1, 1) > 0.95 && glowOf(4, 1) > 0.3 && glowOf(4, 1) < 0.8 && glowOf(1, 0) === 0, "el arrebol, fuerte con el Sol rasante y solo donde da el Sol");
  const tl = readFileSync(new URL("../src/sky/terrainLayer.js", import.meta.url), "utf8");
  ok(/litAt\(b, j, true\)/.test(tl) && /litAt\(b, j, false\)/.test(tl) && /glowOf\(sunAlt, lt\)/.test(tl), "el pintado usa la luz del filo y la del pie de cada banda");
}

console.log("Cumbre más cercana (/api/summit)");
{
  let url = "";
  const sm = await fetchSummit(-0.68917, -78.42889, { r: 1500, api: "https://x", fetchImpl: async (u) => { url = u; return { ok: true, json: async () => ({ found: true, lat: -0.68043, lon: -78.43785, ground_m: 5880 }) }; } });
  ok(sm && sm.ground_m === 5880 && /\/api\/summit\?lat=-0\.68917&lon=-78\.42889&r=1500$/.test(url), "pide la cumbre con el radio de búsqueda");
  await fetchSummit(0, 0, { r: 99999, strict: true, fetchImpl: async (u) => { url = u; return { ok: false }; } });
  ok(/r=2000&strict=1$/.test(url), "radio acotado a 2 km; strict para el GPS");
  ok(await fetchSummit(0, 0, { fetchImpl: async () => { throw new Error("x"); } }) === null, "si falla, null (el lugar se queda como estaba)");
  ok(await fetchSummit(0, 0, { timeoutMs: 20, fetchImpl: () => new Promise(() => {}) }) === null, "si tarda, null");
  const cj = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
  ok(/enableHighAccuracy: true/.test(cj) && /maximumAge: 60000/.test(cj), "GPS en alta precisión y sin posiciones viejas");
  ok(/strict: true/.test(cj) && /cellKey\(lat, lon, placeFine\)/.test(cj), "el GPS busca la cima en modo estricto y el horizonte usa la celda fina");
}

{
  const tl2 = readFileSync(new URL("../src/sky/terrainLayer.js", import.meta.url), "utf8");
  ok(!/-89\.5/.test(tl2), "las montañas no tapan el suelo entero: bajo ellas se siguen viendo las estrellas del otro lado");
}

{
  const tl3 = readFileSync(new URL("../src/sky/terrainLayer.js", import.meta.url), "utf8");
  const cj3 = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
  ok(/userData\.floor = true/.test(tl3) && /snowyFloor = \(hz\.ground_m \|\| 0\) >= snowH/.test(tl3), "en una cumbre, suelo opaco bajo las montañas: nieve sobre la línea de nieves, tierra debajo");
  ok(/placeSummit \|\| topAll/.test(cj3) && /summit: true/.test(cj3), "solo en las cumbres (elegidas, GPS en la cima o todo el horizonte por debajo)");
}

console.log("Colores del satélite y textura");
{
  const hm = await import("../src/sky/horizon.js");
  const row = Buffer.from(new Uint8Array([255, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 255])).toString("base64");
  const d = hm.decodeLandColors({ step_deg: 0.4, credit: "EOX", bands: [{ top: row, bottom: row }] });
  ok(d && d.bands[0].top.length === 12 && d.credit === "EOX", "decodifica los colores (RGB por columna)");
  const sm = hm.smoothLand(new Float32Array([1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1]), 1, 0);
  ok(Math.abs(sm[0] - 1 / 3) < 1e-6 && Math.abs(sm[2] - 2 / 3) < 1e-6, "media móvil circular a lo largo del acimut (sin rayas)");
  ok(hm.decodeLandColors({}) === null, "sin bandas, nada");
  const day = { sunAlt: 40, colors: { horizon: [0.6, 0.7, 0.9] } };
  const pal = hm.terrainPalette(day, 6);
  const green = pal.col(0, [0.2, 0.5, 0.1]), desert = pal.col(0, [0.7, 0.55, 0.35]);
  ok(green.top[1] > green.top[0] && desert.top[0] > desert.top[2], "el color del satélite cambia el de la ladera (verde, desierto)");
  const far = pal.col(5, [0.2, 0.5, 0.1]);
  ok(Math.abs(far.top[2] - 0.9) < Math.abs(green.top[2] - 0.9), "las bandas lejanas se acercan al color del horizonte (bruma)");
  const night = hm.terrainPalette({ sunAlt: -30, colors: { horizon: [0.05, 0.05, 0.08] } }, 6);
  const ng = night.col(0, [0.2, 0.5, 0.1]), nd = night.col(0, [0.7, 0.55, 0.35]);
  ok(Math.abs(ng.top[0] - nd.top[0]) < 1e-6, "de noche el color del satélite no se nota (siluetas)");
  const tl4 = readFileSync(new URL("../src/sky/terrainLayer.js", import.meta.url), "utf8");
  ok(/export function texturize/.test(tl4) && /onBeforeCompile/.test(tl4) && /landAt\(k, j\)/.test(tl4), "textura generada y color por columna en las franjas");
}

{
  let u2 = "";
  const hm2 = await import("../src/sky/horizon.js");
  await hm2.fetchPeaks(-0.68043, -78.43785, { api: "https://x", fine: true, fetchImpl: async (u) => { u2 = u; return { ok: true, json: async () => ({ peaks: [] }) }; } });
  ok(/\/api\/peaks\?lat=-0\.6804&lon=-78\.4378&fine=1$/.test(u2), "en una cumbre, los nombres sobre el mismo horizonte fino que se dibuja");
}

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
