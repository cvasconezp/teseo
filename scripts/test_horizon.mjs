// Pruebas del horizonte real en el navegador: src/sky/horizon.js (perfil, refracción, ocultación, salida y puesta
// tras las montañas, colores) y su integración en la vista Cielo y la ficha.
import { cellKey, terrainAltAt, refraction, apparentAlt, behindTerrain, highestPoint, snowLine, terrainRiseSet, terrainPalette, fetchHorizon } from "../src/sky/horizon.js";
import { riseTransitSet, H0_SUN } from "../src/sky/riseset.js";
import { visibilityOf } from "../src/sky/objVisibility.js";
import { angleOf, snowAngles } from "../src/sky/terrainLayer.js";
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
const credits = readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");
ok(/Terrain Tiles/.test(credits) && /SRTM/.test(credits), "créditos del relieve");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
