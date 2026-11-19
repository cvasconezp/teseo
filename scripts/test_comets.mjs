// Pruebas de los cometas (src/sky/cometSky.js): órbita de dos cuerpos, brillo, cola en sentido contrario al Sol.
import { trueAnomaly, posAtNu, cometHelio, cometMag, tailModel, cometView, jdOf, earthHelio, cometAt, moveComets } from "../src/sky/cometSky.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const near = (a, b, t) => Math.abs(a - b) <= t;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const EL = JSON.parse(read("../public/comet-orbits.json")).comets;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm = (a) => Math.hypot(...a);

console.log("Órbita");
ok(Object.keys(EL).length === 7 && Object.values(EL).every((e) => e.q > 0 && e.e > 0 && e.tp > 2400000), "siete cometas con sus elementos (JPL SBDB)");
const hal = EL["1P/Halley"];
ok(near(trueAnomaly(hal.q, hal.e, 0).r, hal.q, 1e-9) && near(trueAnomaly(hal.q, hal.e, 0).nu, 0, 1e-9), "en el perihelio está a la distancia q");
// Halley: afelio a unas 35 UA, a medio periodo (~38 años) del perihelio
const a = hal.q / (1 - hal.e), P = 365.25 * Math.pow(a, 1.5), ap = trueAnomaly(hal.q, hal.e, P / 2);
ok(near(a * (1 + hal.e), 35.3, 0.3) && near(ap.r, a * (1 + hal.e), 0.01) && near(P / 365.25, 76, 1.5), `Halley: periodo de ${(P / 365.25).toFixed(1)} años y afelio a ${ap.r.toFixed(1)} UA`);
// hoy (18-nov-2026) Horizons lo da a 35,0 UA del Sol y Encke a 1,60: dos cuerpos, con elementos de 1966 para Halley, coinciden a unas décimas
const now = Date.UTC(2026, 10, 18, 23, 39);
ok(near(cometHelio(hal, now).r, 35.0, 0.25) && near(cometHelio(EL["2P/Encke"], now).r, 1.595, 0.08), `distancia al Sol hoy: Halley ${cometHelio(hal, now).r.toFixed(2)} UA, Encke ${cometHelio(EL["2P/Encke"], now).r.toFixed(3)} UA (Horizons: 35,01 y 1,595)`);
// casi parabólica (C/2023 A3) y elíptica dan posiciones finitas y continuas
const c23 = EL["C/2023 A3 (Tsuchinshan-ATLAS)"], t1 = trueAnomaly(c23.q, c23.e, 30), t2 = trueAnomaly(c23.q, 0.9989, 30), t3 = trueAnomaly(c23.q, 1.0011, 30);
ok(Number.isFinite(t1.r) && near(t1.r, t2.r, 0.01) && near(t1.r, t3.r, 0.01), "órbitas casi parabólicas: la solución es continua entre elipse, parábola e hipérbola");
ok(near(norm(posAtNu(hal, 1.0)), (hal.q * (1 + hal.e)) / (1 + hal.e * Math.cos(1.0)), 1e-9), "la posición en la órbita tiene la distancia de la cónica");

console.log("Brillo y cola");
ok(near(cometMag({ M1: 5, K1: 10 }, 1, 1), 5, 1e-12) && near(cometMag({ M1: 5, K1: 10 }, 2, 1), 5 + 10 * Math.log10(2), 1e-12) && cometMag({ M1: null, K1: 8 }, 1, 1) === null, "magnitud total: M1 + 5·log Δ + K1·log r");
ok(tailModel(35, 25).len === 0 && tailModel(4.3, 18).len === 0 && tailModel(1, 5).len > tailModel(2, 5).len && tailModel(0.4, 2).len <= 0.5 && tailModel(1, 5).alpha > tailModel(1, 13).alpha, "sin cola lejos del Sol; más larga al acercarse y más tenue si es débil");
// la cola apunta en sentido contrario al Sol: en el espacio, la punta está más lejos del Sol que la cabeza, en línea con él
{
  const en = EL["2P/Encke"], h = cometHelio(en, now), earth = [0.55, 0.75, 0.33];          // una Tierra cualquiera a ~1 UA
  const geo = [h.p[0] - earth[0], h.p[1] - earth[1], h.p[2] - earth[2]], delta = norm(geo), dir = geo.map((x) => x / delta);
  const v = cometView(en, dir, delta, now);
  ok(v.tail.len > 0 && near(v.earth[0], earth[0], 1e-9) && near(v.earth[2], earth[2], 1e-9), "de la posición en el cielo y la órbita sale dónde está la Tierra");
  // dirección al Sol vista desde la Tierra, y la cola: en el cielo, la cola se aleja del Sol
  const sun = earth.map((x) => -x / norm(earth)), angHead = Math.acos(dot(dir, sun)), angEnd = Math.acos(dot(v.tail.end, sun));
  ok(angEnd > angHead, "en el cielo, la punta de la cola queda más lejos del Sol que la cabeza");
  ok(v.orbit.length === 241 && v.closed && v.orbit.every((p) => near(norm(p), 1, 1e-9)) && Math.max(...v.orbit.map((p) => dot(p, dir))) > 0.9999, "la órbita dibujada pasa por donde está el cometa");
  const far = cometView(hal, [0, 1, 0], 34.7, now);
  ok(far.tail.len === 0 && far.tail.end === null && far.closed, "Halley, a 35 UA: sin cola y con la órbita entera");
}
const sky = read("../src/Constellations.jsx");
ok(/createCometLayer\(\)/.test(sky) && /ref\.cometLayer\.showOrbit\(on && selObj && selObj\.layer === "comets"/.test(sky), "el cielo dibuja coma y cola, y la órbita del cometa abierto");

console.log("Con la fecha");
{ // datos de Horizons del 19-nov-2026 (los que da /api/comets)
  const NOW = [{"name": "2P/Encke", "nx": 0.94916, "ny": -0.26172, "nz": 0.17494, "dist_au": 0.9278, "epoch": "2026-11-19T00:01Z", "ra_deg": 344.5845, "dec_deg": 10.0751}, {"name": "1P/Halley", "nx": -0.57324, "ny": 0.81814, "nz": 0.04518, "dist_au": 34.6757, "epoch": "2026-11-19T00:01Z", "ra_deg": 125.0174, "dec_deg": 2.5895}];
  const t0 = Date.parse(NOW[0].epoch), day = 86400000, ang = (a, b) => { const x = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; return Math.atan2(norm(x), dot(a, b)) * 180 / Math.PI; };   // (acos pierde precisión con vectores redondeados)
  const e = earthHelio(t0), es = earthHelio(Date.UTC(2026, 2, 20, 14, 46));
  ok(near(norm(e), 0.9886, 0.002) && near(norm(earthHelio(Date.UTC(2026, 6, 5))), 1.0167, 0.001), "la Tierra: a 0,989 UA del Sol en noviembre y a 1,017 en julio (afelio)");
  ok(Math.abs(es[1]) < 0.01 && Math.abs(es[2]) < 0.004 && es[0] < -0.99, "en el equinoccio de marzo el Sol está en AR 0 h, salvo la precesión desde 2000 (la Tierra, en el lado contrario)");
  const k = cometAt(EL["2P/Encke"], t0), enc = NOW[0];
  ok(ang(k.dir, [enc.nx, enc.ny, enc.nz]) < 0.15 && near(k.delta, enc.dist_au, 0.003), "Encke hoy, por dos cuerpos: a menos de 0,15° de la posición de Horizons");
  ok(moveComets(NOW, EL, t0) === NOW && moveComets(NOW, EL, t0 + 20 * 60000) === NOW && moveComets(NOW, null, t0 + day) === NOW, "en la fecha del dato (±45 min) queda la posición de Horizons, sin tocar");
  const m1 = moveComets(NOW, EL, t0 + 46 * 60000), m30 = moveComets(NOW, EL, t0 + 30 * day), b30 = moveComets(NOW, EL, t0 - 30 * day);
  ok(m1 !== NOW && m1.every((c, i) => ang([c.nx, c.ny, c.nz], [NOW[i].nx, NOW[i].ny, NOW[i].nz]) < 0.05), "sin salto: justo después, cada cometa sigue donde lo daba Horizons");
  const dE = ang([m30[0].nx, m30[0].ny, m30[0].nz], [enc.nx, enc.ny, enc.nz]), dH = ang([m30[1].nx, m30[1].ny, m30[1].nz], [NOW[1].nx, NOW[1].ny, NOW[1].nz]);
  ok(dE > 3 && dE < 25 && dH < 1.5 && dH > 0.05, `en 30 días Encke (cercano) se mueve ${dE.toFixed(1)}° y Halley (a 35 UA) ${dH.toFixed(2)}°`);
  ok(m30.every((c) => c.moved && near(Math.hypot(c.nx, c.ny, c.nz), 1, 1e-9) && c.dist_km > 0 && c.light_min > 0 && /Z$/.test(c.epoch) && c.ra_deg >= 0 && c.ra_deg < 360) && m30[0].epoch.slice(0, 10) === "2026-12-19", "el cometa movido lleva su ascensión recta, distancia, tiempo de luz y fecha nuevas");
  ok(ang([b30[0].nx, b30[0].ny, b30[0].nz], [m30[0].nx, m30[0].ny, m30[0].nz]) > dE, "también hacia atrás en el tiempo");
  ok(typeof m30[0].approaching === "boolean" && moveComets([{ name: "X/Desconocido", nx: 1, ny: 0, nz: 0, dist_au: 2, epoch: NOW[0].epoch }], EL, t0 + day)[0].moved === undefined, "un cometa sin elementos se queda donde estaba");
}

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
