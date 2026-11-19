// Pruebas de los cometas (src/sky/cometSky.js): órbita de dos cuerpos, brillo, cola en sentido contrario al Sol.
import { trueAnomaly, posAtNu, cometHelio, cometMag, tailModel, cometView, jdOf, earthHelio, cometAt, moveComets, cometsAt, cometObject, minorObjects, asteroidMag, neoPassing } from "../src/sky/cometSky.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const near = (a, b, t) => Math.abs(a - b) <= t;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const EL = JSON.parse(read("../public/comet-orbits.json")).comets;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm = (a) => Math.hypot(...a);

console.log("Órbita");
ok(Object.values(EL).filter((e) => !e.extra).length === 7 && Object.values(EL).every((e) => e.q > 0 && e.e > 0 && e.tp > 2400000), "los siete cometas famosos con sus elementos (JPL SBDB)");
{ const ex = Object.entries(EL).filter(([, e]) => e.extra);
  ok(ex.length >= 3 && ex.length <= 16 && ex.every(([n, e]) => /^[CP]\/\d{4} |^\d+P\//.test(n) && e.M1 != null && e.K1 != null && e.best <= 14), `cometas del momento: ${ex.length}, con su fórmula de brillo y magnitud prevista ≤ 14`); }
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

console.log("Cometas del momento, planetas enanos y asteroides");
{
  const t0 = Date.UTC(2026, 10, 19), all = cometsAt([], EL, t0, 99), some = cometsAt([], EL, t0, 14.5), none = cometsAt([], EL, t0, -5);
  const nx = Object.values(EL).filter((e) => e.extra).length;
  ok(all.length === nx && some.length <= all.length && none.length === 0 && all.every((c) => c.extra && c.mag != null && near(Math.hypot(c.nx, c.ny, c.nz), 1, 1e-9) && c.dist_au > 0), "los cometas del momento salen de su órbita, y solo mientras su brillo previsto supera el límite");
  const famous = [{ name: "2P/Encke", nx: 0.94916, ny: -0.26172, nz: 0.17494, dist_au: 0.9278, epoch: "2026-11-19T00:01Z" }];
  const mix = cometsAt(famous, EL, Date.parse(famous[0].epoch), 99);
  ok(mix[0] === famous[0] && mix.length === 1 + nx && !cometsAt(famous, EL, t0, 99).some((c, i, a) => a.findIndex((x) => x.name === c.name) !== i), "los famosos conservan su dato de Horizons y no se duplican");
  ok(cometObject("X", EL["2P/Encke"], t0).epoch === "2026-11-19T00:00Z", "cada cometa calculado lleva la fecha de su posición");
  const MB = JSON.parse(read("../public/minor-bodies.json")).objects, m = minorObjects(MB, t0), by = Object.fromEntries(m.map((o) => [o.name, o]));
  ok(MB.length === 17 && m.length === 17 && MB.every((o) => o.name && o.name_en && o.note_es && o.note_en && o.wiki_en && o.wiki_es && o.el && o.el.q > 0 && ["dwarf", "asteroid", "nea", "tno"].includes(o.kind)), "17 cuerpos con nombre, nota, artículo y órbita en los dos idiomas");
  // JPL Horizons, 19-nov-2026 0 h UT: Plutón 306,320° −23,637° 36,02 UA · Ceres 116,079° +25,019° 1,969 UA m 7,9 · Vesta 15,596° −4,407° 1,694 UA m 7,1 · Eros 268,542° −25,806° · Eris 26,722° −0,181° 94,62 UA
  const sepDeg = (o, ra, dec) => { const R = Math.PI / 180, b = [Math.cos(dec * R) * Math.cos(ra * R), Math.cos(dec * R) * Math.sin(ra * R), Math.sin(dec * R)], a = [o.nx, o.ny, o.nz], x = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; return Math.atan2(norm(x), dot(a, b)) / R; };
  const errs = [sepDeg(by["Plutón"], 306.32034, -23.63702), sepDeg(by.Ceres, 116.07856, 25.01911), sepDeg(by.Vesta, 15.5956, -4.40699), sepDeg(by.Eros, 268.54188, -25.80649), sepDeg(by.Eris, 26.72226, -0.1811)];
  ok(errs.every((e) => e < 0.06), `posición frente a JPL Horizons: Plutón, Ceres, Vesta, Eros y Eris a menos de 0,06° (máx. ${Math.max(...errs).toFixed(3)}°)`);
  ok(near(by["Plutón"].dist_au, 36.023, 0.06) && near(by.Ceres.dist_au, 1.9687, 0.002) && near(by.Eris.dist_au, 94.616, 0.02), "distancias: Plutón 36 UA, Ceres 1,97 UA, Eris 94,6 UA");
  ok(near(by.Ceres.mag, 7.9, 0.15) && near(by.Vesta.mag, 7.08, 0.15) && near(by.Eros.mag, 14.23, 0.2) && near(by.Eris.mag, 18.6, 0.2), "magnitud (sistema H, G): Ceres 7,9, Vesta 7,1, Eros 14,2, Eris 18,6, como en Horizons");
  ok(near(asteroidMag(3.34, 0.12, 1, 1, 0), 3.34, 1e-9) && asteroidMag(3.34, 0.12, 2, 1, 0.3) > asteroidMag(3.34, 0.12, 2, 1, 0) && asteroidMag(null, 0.15, 1, 1, 0) === null, "la magnitud absoluta H es la de 1 UA sin fase; con fase, más débil");
  const later = Object.fromEntries(minorObjects(MB, t0 + 60 * 86400000).map((o) => [o.name, o]));
  ok(sepDeg(later.Vesta, by.Vesta.ra_deg, by.Vesta.dec_deg) > 3 && sepDeg(later["Plutón"], by["Plutón"].ra_deg, by["Plutón"].dec_deg) < 2 && typeof by.Apofis.approaching === "boolean", "con la fecha: Vesta se mueve varios grados en dos meses; Plutón, casi nada");
}

console.log("Asteroides que pasan cerca de la Tierra");
{ // 2018 NE1: JPL CNEOS da su máximo acercamiento el 19-nov-2026 a las 2:15 UT, a 16,6 distancias lunares (0,04269 UA)
  const el = { q: 0.830949299119775, e: 0.5716778647869499, i: 3.05759089183356, om: 289.8450411359509, w: 70.94553137320914, tp: 2461324.896931184995, epoch: 2461200.5 };
  const api = [{ name: "2018 NE1", des: "2018 NE1", date: "2026-11-19T02:15:19Z", dist_ld: 16.612, dist_km: 6385660, v_rel_km_s: 13.28, h: 23.4, diameter_m: null, diameter_est_m: [55.5, 124.2], el },
    { name: "sin órbita", des: "2026 XX", date: "2026-11-20T00:00:00Z", dist_ld: 3, h: 27 },
    { name: "99942 Apophis (2004 MN4)", des: "99942", date: "2026-11-21T00:00:00Z", dist_ld: 10, h: 19, el }];
  const t0 = Date.parse(api[0].date), fixed = [{ num: 99942 }];
  const near0 = neoPassing(api, t0, fixed), far = neoPassing(api, t0 + 40 * 86400000, fixed);
  ok(near0.length === 1 && near0[0].name === "2018 NE1" && near0[0].kind === "pass" && far.length === 0 && neoPassing(null, t0).length === 0, "solo los que tienen órbita y pasan a menos de 10 días de la fecha; sin repetir Apofis");
  const o = minorObjects(near0, t0)[0];
  ok(o && near(o.dist_au, 0.04269, 0.0015) && near(Math.hypot(o.nx, o.ny, o.nz), 1, 1e-9), `en su máximo acercamiento queda a ${o.dist_au} UA (JPL: 0,0427): la órbita de dos cuerpos coincide`);
  const before = minorObjects(near0, t0 - 3 * 86400000)[0], after = minorObjects(near0, t0 + 3 * 86400000)[0];
  ok(before.dist_au > o.dist_au && after.dist_au > o.dist_au && before.approaching && !after.approaching, "antes se acerca y después se aleja; el mínimo está en la fecha de JPL");
  ok(o.pass.dist_ld === 16.612 && o.diam_est[0] === 55.5 && o.mag > 15, "lleva los datos del paso (distancia, velocidad) y el diámetro estimado; es débil (hace falta telescopio)");
}

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
