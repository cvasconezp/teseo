// Pruebas de las auroras (src/sky/aurora.js): eje del dipolo, coordenadas geomagnéticas, punto subsolar,
// perspectiva con la curvatura de la Tierra, óvalo estimado por Kp y franjas para el dibujo.
import { planNights, scoreLevel, KP_TYPICAL } from "../src/sky/auroraPlan.js";
import { encodeBands } from "../src/sky/auroraLayer.js";
import { dipole, geoToMag, magToGeo, subsolar, mlt, ovalEdge, probModel, kpAt, ovalBands, bandsFromKp, bandsFromGrid,
  decodeOvation, probGrid, skyPos, lookAt, darkness, activityKey, compassName, hemiOf, NB, EARTH_KM } from "../src/sky/aurora.js";
let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m, extra); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log("Dipolo y coordenadas geomagnéticas (WMM2025)");
const dp = dipole(new Date("2026-11-24T00:00:00Z"));
ok(near(dp.poleLat, 80.8, 0.3) && near(dp.poleLon, -72.7, 0.6), `polo norte geomagnético ≈ 80,8° N, 72,7° O (${dp.poleLat.toFixed(2)}, ${dp.poleLon.toFixed(2)})`);
const tro = geoToMag(69.65, 18.96, dp), cay = geoToMag(0.04, -78.1, dp), ush = geoToMag(-54.8, -68.3, dp);
ok(near(tro.mlat, 66.8, 1.2), `Tromsø a ~66,8° geomagnéticos (${tro.mlat.toFixed(1)})`);
ok(cay.mlat > 7 && cay.mlat < 14, `Cayambe a ~10° geomagnéticos (${cay.mlat.toFixed(1)})`);
ok(ush.mlat < -40 && hemiOf(-54.8, -68.3, dp) === -1 && hemiOf(69.65, 18.96, dp) === 1, `Ushuaia en el hemisferio sur geomagnético (${ush.mlat.toFixed(1)})`);
const back = magToGeo(tro.mlat, tro.mlon, dp);
ok(near(back.lat, 69.65, 1e-6) && near(back.lon, 18.96, 1e-6), "ida y vuelta geográficas ↔ geomagnéticas");

console.log("Sol y hora magnética");
const ss = subsolar(new Date("2026-06-21T12:00:00Z"));
ok(near(ss.lat, 23.43, 0.1) && near(ss.lon, 0.43, 0.3), `punto subsolar en el solsticio de junio a mediodía UTC (ecuación del tiempo ≈ −1,7 min) (${ss.lat.toFixed(2)}, ${ss.lon.toFixed(2)})`);
const ssm = geoToMag(ss.lat, ss.lon, dp).mlon;
ok(near(mlt(ssm, new Date("2026-06-21T12:00:00Z"), dp), 12, 1e-6) && near(mlt(ssm + 180, new Date("2026-06-21T12:00:00Z"), dp), 0, 1e-6), "mediodía magnético bajo el Sol, medianoche al otro lado");

console.log("Óvalo estimado por Kp");
ok(ovalEdge(3, 0) === 60.5 && near(ovalEdge(3, 12), 68.5, 1e-9), "borde ecuatorial: 66,5° − 2°·Kp a medianoche, +8° a mediodía");
ok(probModel(5, 60, 0) > probModel(5, 60, 12), "más aurora hacia la medianoche que al mediodía");
ok(probModel(1, 50, 0) === 0 && probModel(8, 50, 0) > 20, "a 50° geomagnéticos: nada con Kp 1, sí con una tormenta fuerte (Kp 8)");
const series = [{ t: "2026-11-24T00:00:00Z", kp: 1.67, kind: "estimated" }, { t: "2026-11-24T03:00:00Z", kp: 4.33, kind: "predicted" }];
ok(kpAt(series, new Date("2026-11-24T04:30:00Z")).kp === 4.33 && kpAt(series, new Date("2026-11-25T04:30:00Z")) === null, "Kp de la franja de 3 h que contiene el instante");

console.log("Perspectiva con la curvatura de la Tierra");
const obs = { lat: 69.65, lon: 18.96, elevKm: 0 };
ok(near(skyPos(69.65, 18.96, 110, obs).alt, 90, 1e-6), "aurora justo encima: en el cenit");
const c = Math.acos(EARTH_KM / (EARTH_KM + 110)) * 180 / Math.PI;     // ~10,6° de arco
const hz = skyPos(69.65 + c, 18.96, 110, obs);
ok(near(hz.alt, 0, 0.05) && near(hz.az, 0, 0.5), `a ${c.toFixed(1)}° de arco al norte, una aurora a 110 km roza el horizonte norte (${hz.alt.toFixed(2)}°)`);
ok(skyPos(69.65 + 12, 18.96, 110, obs).alt < 0 && skyPos(69.65 + 12, 18.96, 300, obs).alt > 0, "más lejos, solo asoma la parte alta (roja)");

console.log("Franjas para el dibujo");
const kp5 = bandsFromKp(5, new Date("2026-11-24T22:00:00Z"), dp, 1);
ok(kp5.length === NB * 4 && kp5.some((v, i) => i % 4 === 2 && v > 0.5), "el óvalo de Kp 5 tiene franjas intensas");
const iTro = Math.floor(tro.mlon + 180) % NB;
ok(kp5[iTro * 4] > 58 && kp5[iTro * 4] < 66 && kp5[iTro * 4 + 1] > 1.5 && kp5[iTro * 4 + 1] < 6, `sobre Tromsø de noche, con Kp 5, el óvalo se centra a ${kp5[iTro * 4].toFixed(1)}° (±${kp5[iTro * 4 + 1].toFixed(1)}°) geomagnéticos`);
const lk = lookAt(kp5, dp, 1, obs);
ok(lk.visible && lk.altMax > 40, `desde Tromsø se ve alta (${lk.altMin && lk.altMin.toFixed(0)}°–${lk.altMax.toFixed(0)}°, hacia el ${compassName(lk.az)})`);
const lkC = lookAt(kp5, dp, 1, { lat: 0.04, lon: -78.1 });
ok(!lkC.visible, "desde Cayambe no se ve");
const empty = ovalBands(() => 0, dp, 1);
ok(empty.every((v) => v === 0) && !lookAt(empty, dp, 1, obs).visible, "sin aurora no hay franjas");

console.log("Malla de NOAA (OVATION)");
const rows = 90 - 34 + 1, buf = new Uint8Array(rows * 360);
for (let la = 64; la <= 72; la++) for (let lo = 0; lo < 360; lo++) buf[(la - 34) * 360 + lo] = 40;
const b64 = Buffer.from(buf).toString("base64");
const g = decodeOvation({ grid_b64: b64, lat_min: 34, lat_max: 90, lon_count: 360, observed: "2026-11-24T03:42:00Z" });
ok(g && near(probGrid(g, 69.65, 18.96), 40, 1e-9) && probGrid(g, 50, 0) === 0 && probGrid(g, 10, 0) === 0, "se decodifica y se interpola; fuera de la franja vale 0");
ok(decodeOvation({ grid_b64: b64, lat_min: 34, lat_max: 80, lon_count: 360 }) === null, "una franja con tamaño incoherente se descarta");
const bg = bandsFromGrid(g, dp, 1);
ok(bg.some((v, i) => i % 4 === 2 && v > 0.4), "las franjas salen también de la malla real");

console.log("Visibilidad y textos");
ok(darkness(10) === 0 && darkness(-20) === 1 && darkness(-20, 40, 1) < 0.6 && darkness(-9) > 0 && darkness(-9) < 1, "de día no; noche cerrada sí; la Luna llena alta resta; en el crepúsculo, a medias");
ok(activityKey(1) === "quiet" && activityKey(4.3) === "active" && activityKey(5) === "g1" && activityKey(9) === "g5", "escala de actividad (G1–G5 de NOAA desde Kp 5)");
ok(compassName(2) === "norte" && compassName(350, "en") === "north" && compassName(46) === "noreste", "puntos cardinales");

console.log("Planificador de noches");
const sunFake = (d) => { const h = ((d.getUTCHours() + d.getUTCMinutes() / 60 + 18.96 / 15) % 24); return h > 15 || h < 9 ? -20 : 5; };   // noche de 15 h a 9 h, hora local
const moonDown = () => ({ alt: -10, illum: 0.5 });
const plan = planNights({ lat: 69.65, lon: 18.96, start: new Date("2027-02-10T12:00:00Z"), nights: 7, dp, sun: sunFake, moon: moonDown, cloud: () => 0.2, kpSeries: null });
ok(plan.length === 7 && plan.every((n) => n.dark && n.best && n.kind === "estimated"), "una semana en Tromsø: siete noches oscuras, estimadas (sin Kp de NOAA tan lejos)");
ok(plan[0].best.kind === "typical" && plan[0].best.kp === KP_TYPICAL && plan[0].best.p > 20, `actividad habitual (Kp ${KP_TYPICAL}) y aun así buena probabilidad en Tromsø (${plan[0].best.p.toFixed(0)} %)`);
ok(Math.abs(plan[0].best.score - plan[0].best.p / 100 * 0.8) < 1e-9, "puntuación = probabilidad × cielo despejado × oscuridad");
const cloudy = planNights({ lat: 69.65, lon: 18.96, start: new Date("2027-02-10T12:00:00Z"), nights: 1, dp, sun: sunFake, moon: moonDown, cloud: () => 1, kpSeries: null });
ok(cloudy[0].best.score === 0 && scoreLevel(0) === 0, "cielo cubierto: puntuación cero");
const series2 = [{ t: "2027-02-10T18:00:00Z", kp: 6, kind: "predicted" }];
const fc = planNights({ lat: 69.65, lon: 18.96, start: new Date("2027-02-10T12:00:00Z"), nights: 1, dp, sun: sunFake, moon: moonDown, cloud: null, kpSeries: series2 });
ok(fc[0].kind === "forecast" && fc[0].hours.some((h) => h.kind === "predicted" && h.kp === 6), "con el Kp de NOAA, la noche queda como pronóstico");
const summer = planNights({ lat: 69.65, lon: 18.96, start: new Date("2027-06-21T12:00:00Z"), nights: 1, dp, sun: () => 5, moon: moonDown, cloud: null });
ok(!summer[0].dark && summer[0].best === null, "sol de medianoche: no oscurece, no hay aurora visible");
const cayP = planNights({ lat: 0.04, lon: -78.1, start: new Date("2027-02-10T12:00:00Z"), nights: 2, dp, sun: () => -30, moon: moonDown, cloud: () => 0, kpSeries: null });
ok(cayP.every((n) => n.best.score === 0), "desde Cayambe, ninguna noche con aurora");
ok(scoreLevel(0.02) === 1 && scoreLevel(0.5) === 4, "niveles de la puntuación");

console.log("Textura de franjas");
const enc = encodeBands(kp5);
ok(enc.length === NB * 4 && enc.every((v) => v >= 0 && v <= 255) && enc[iTro * 4] > 0, "las franjas caben en bytes (0 = sin óvalo)");
const enc0 = encodeBands(empty);
ok(enc0.every((v) => v === 0), "sin óvalo, todo a cero");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
