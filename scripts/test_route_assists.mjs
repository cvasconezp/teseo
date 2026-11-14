// Pruebas de «Catapultas» y del dibujo de Hohmann en el mapa de Ruta (src/route/):
// datos por destino, secuencias de sobrevuelos, fechas en orden, duraciones, la
// escala radial del mapa (monótona y exacta en cada órbita), la elipse de Hohmann
// (perihelio, afelio y llegada a +180°), colocación de etiquetas, textos ES/EN e
// integración en App.jsx. Node puro, sin dependencias.
// Uso:  node scripts/test_route_assists.mjs     (sale con código 1 si algo falla)
import { readFileSync } from "node:fs";
import {
  MISSIONS, BY_DEST, missionsFor, dateMs, hasDay, missionYears, hohmannYears, orbitalSpeedKmS, maxFlybyDv,
  nextMilestone, daysTo, eventDate,
} from "../src/route/assists.js";
import { GA, NAMES, nameOf } from "../src/route/i18n-assists.js";
import {
  MAP_PLANETS, ORBIT_R, ORBIT_AU, mapRadius, hohmannEllipse, hohmannRadiusAU, hohmannPlan, helioLongitude,
  routeDates, placeLabel, pathD, TAU,
} from "../src/route/hohmannMap.js";
import { SEMI_MAJOR_AXIS_AU, hohmannLocal } from "../src/ui/orbits.js";
import { cleanParams, metricParams } from "../src/ui/track.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const ids = (m) => m.events.map((e) => e.body);
const PLANET_IDS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];

console.log("Datos por destino");
{
  ok(PLANET_IDS.every((p) => p in BY_DEST), "hay entrada para los ocho planetas");
  ok(BY_DEST.earth.length === 0, "la Tierra no tiene misiones en la lista");
  ok(missionsFor("neptune").map((m) => m.id).join() === "voyager2_neptune", "Neptuno: Voyager 2");
  ok(missionsFor("uranus").map((m) => m.id).join() === "voyager2_uranus", "Urano: Voyager 2 (tramo hasta Urano)");
  ok(["cassini", "voyager1", "pioneer11"].every((id) => BY_DEST.saturn.includes(id)), "Saturno: Cassini, Voyager 1 y Pioneer 11");
  ok(["galileo", "juno", "europaclipper", "juice"].every((id) => BY_DEST.jupiter.includes(id)), "Júpiter: Galileo, Juno, Europa Clipper y JUICE");
  ok(["messenger", "bepicolombo"].every((id) => BY_DEST.mercury.includes(id)), "Mercurio: MESSENGER y BepiColombo");
  ok(BY_DEST.venus.join() === "parker", "Venus: Parker Solar Probe (Venus sirve de catapulta)");
  ok(BY_DEST.mars.join() === "perseverance", "Marte: viaje directo (Mars 2020)");
  const marte = missionsFor("mars")[0];
  ok(!marte.events.some((e) => e.kind === "assist"), "las misiones a Marte no tienen catapultas");
  ok(Object.values(MISSIONS).every((m) => BY_DEST[m.dest].includes(m.id)), "toda misión está en la lista de su destino");
  ok(Object.values(MISSIONS).every((m) => m.dest === (m.events[m.events.length - 1].body) || m.target), "el último hito es el destino (Parker: el Sol)");
  ok(Object.values(MISSIONS).every((m) => m.events[0].kind === "launch" && m.events[0].body === "earth"), "todas salen de la Tierra");
  ok(Object.values(MISSIONS).every((m) => ["arrival", "flyby"].includes(m.events[m.events.length - 1].kind)), "todas terminan en llegada o sobrevuelo del destino");
  ok(Object.values(MISSIONS).every((m) => m.sources.length >= 1 && m.sources.every((s) => /^https:\/\/(science\.nasa\.gov|www\.nasa\.gov|www\.jpl\.nasa\.gov|www\.esa\.int|www\.cosmos\.esa\.int|messenger\.jhuapl\.edu|www\.jhuapl\.edu)\//.test(s.url) && s.label)), "cada misión cita fuentes NASA, JPL o ESA (o el sitio de la propia misión)");
  const bodies = new Set(Object.values(MISSIONS).flatMap(ids));
  ok([...bodies].every((b) => b in NAMES.es && b in NAMES.en), "todos los cuerpos tienen nombre ES y EN");
  ok(Object.values(MISSIONS).every((m) => !m.note || (m.note.es && m.note.en)), "las notas están en ES y EN");
}

console.log("Secuencias de sobrevuelos (verificadas en NASA, JPL y ESA)");
{
  ok(ids(MISSIONS.voyager2_neptune).join() === "earth,jupiter,saturn,uranus,neptune", "Voyager 2 → Neptuno: Tierra, Júpiter, Saturno, Urano, Neptuno");
  ok(ids(MISSIONS.voyager2_uranus).join() === "earth,jupiter,saturn,uranus", "Voyager 2 → Urano: Tierra, Júpiter, Saturno, Urano");
  ok(MISSIONS.voyager2_uranus.events.at(-1).kind === "flyby" && MISSIONS.voyager2_neptune.events.at(-1).kind === "flyby", "Voyager 2: Urano y Neptuno son sobrevuelos (no entró en órbita)");
  ok(ids(MISSIONS.voyager1).join() === "earth,jupiter,saturn", "Voyager 1: Tierra, Júpiter, Saturno");
  ok(ids(MISSIONS.pioneer11).join() === "earth,jupiter,saturn", "Pioneer 11: Tierra, Júpiter, Saturno");
  ok(ids(MISSIONS.cassini).join() === "earth,venus,venus,earth,jupiter,saturn", "Cassini: Tierra → Venus → Venus → Tierra → Júpiter → Saturno");
  ok(ids(MISSIONS.galileo).join() === "earth,venus,earth,earth,jupiter", "Galileo (VEEGA): Tierra, Venus, Tierra, Tierra, Júpiter");
  ok(ids(MISSIONS.juno).join() === "earth,earth,jupiter", "Juno: Tierra, Tierra, Júpiter");
  ok(ids(MISSIONS.europaclipper).join() === "earth,mars,earth,jupiter", "Europa Clipper: Tierra, Marte, Tierra, Júpiter");
  ok(ids(MISSIONS.juice).join() === "earth,moon,earth,venus,earth,earth,jupiter", "JUICE: Luna-Tierra, Venus, Tierra, Tierra, Júpiter");
  ok(ids(MISSIONS.messenger).join() === "earth,earth,venus,venus,mercury,mercury,mercury,mercury", "MESSENGER: 1 Tierra, 2 Venus, 3 Mercurio y la órbita");
  const bepi = MISSIONS.bepicolombo.events;
  ok(bepi.filter((e) => e.body === "earth" && e.kind === "assist").length === 1 && bepi.filter((e) => e.body === "venus").length === 2
    && bepi.find((e) => e.body === "mercury" && e.kind === "assist").n === 6, "BepiColombo: 1 Tierra, 2 Venus, 6 Mercurio");
  ok(MISSIONS.parker.events.find((e) => e.body === "venus").n === 7, "Parker: 7 sobrevuelos de Venus");
  ok(MISSIONS.parker.events.at(-1).body === "sun", "Parker termina en el Sol");
  ok(MISSIONS.juno.events[1].date === "2013-10-09", "Juno: sobrevuelo de la Tierra el 9 oct 2013");
  ok(MISSIONS.juno.events.at(-1).date === "2016-07-04" && MISSIONS.juno.launch === "2011-08-05", "Juno: lanzamiento 5 ago 2011, llegada 4 jul 2016 (JPL)");
  ok(MISSIONS.voyager2_neptune.events.map((e) => e.date).join() === "1977-08-20,1979-07-09,1981-08-26,1986-01-24,1989-08-25", "Voyager 2: fechas de NASA (UT)");
  const ec = MISSIONS.europaclipper.events;
  ok(ec[1].date === "2025-03-01" && ec[2].date === "2026-12-02" && ec[2].end === "2026-12-07" && ec[2].scheduled, "Europa Clipper: Marte 1 mar 2025; Tierra 2–7 dic 2026 (prevista)");
  ok(MISSIONS.juice.events.find((e) => e.body === "venus").date === "2025-08-31" && MISSIONS.juice.events.at(-1).date === "2031-07-21", "JUICE: Venus 31 ago 2025; llegada prevista 21 jul 2031");
  ok(MISSIONS.cassini.events.at(-1).date === "2004-07-01" && MISSIONS.cassini.launch === "1997-10-15", "Cassini: lanzamiento 15 oct 1997, órbita de Saturno 1 jul 2004");
  ok(MISSIONS.messenger.events.at(-1).date === "2011-03-18", "MESSENGER: órbita de Mercurio el 18 mar 2011");
}

console.log("Fechas en orden");
{
  for (const m of Object.values(MISSIONS)) {
    const t = m.events.map((e) => dateMs(e.date));
    ok(t.every(Number.isFinite), `${m.id}: todas las fechas válidas`);
    ok(t.every((x, i) => i === 0 || x >= t[i - 1]), `${m.id}: fechas en orden`);
    ok(m.events.every((e) => !e.end || dateMs(e.end) >= dateMs(e.date)), `${m.id}: las ventanas terminan después de empezar`);
    ok(Math.abs(dateMs(m.launch) - t[0]) <= 31 * 86400000, `${m.id}: el lanzamiento coincide con el primer hito`);
    ok(m.events.every((e) => hasDay(e.date) || /^\d{4}-\d{2}$/.test(e.date)), `${m.id}: formato AAAA-MM-DD o AAAA-MM`);
  }
  ok(dateMs("2024-08") === Date.UTC(2024, 7, 1) && dateMs("2024-08-31") === Date.UTC(2024, 7, 31) && Number.isNaN(dateMs("agosto")), "dateMs: mes, día y basura");
  const e = { date: "1997-10-15" };
  ok(eventDate(e, "es", true) === "15 oct 1997" && eventDate(e, "es") === "oct 1997", "formato ES de fecha larga y corta");
  ok(eventDate(e, "en", true) === "Oct 15, 1997", "formato EN", eventDate(e, "en", true));
  ok(eventDate({ date: "2026-12-02", end: "2026-12-07" }, "es") === "2–7 dic 2026" && eventDate({ date: "2026-12-02", end: "2026-12-07" }, "en") === "Dec 2–7, 2026", "ventanas ES y EN");
  ok(eventDate({ date: "2024-08" }, "es", true) === "ago 2024", "si la fuente solo da el mes, la fecha larga sigue siendo el mes");
}

console.log("Duraciones frente a Hohmann");
{
  ok(near(missionYears(MISSIONS.voyager2_neptune), 12.0, 0.1), "Voyager 2 a Neptuno: 12 años (NASA)", String(missionYears(MISSIONS.voyager2_neptune)));
  ok(near(hohmannYears("neptune"), 30.6, 0.2), "Hohmann Tierra → Neptuno ≈ 30,6 años (NASA: «unos 30»)", String(hohmannYears("neptune")));
  ok(missionYears(MISSIONS.voyager2_neptune) < hohmannYears("neptune") / 2, "Voyager 2 tardó menos de la mitad que Hohmann");
  ok(near(missionYears(MISSIONS.cassini), 6.71, 0.03) && near(hohmannYears("saturn"), 6.03, 0.05), "Cassini 6,7 años; Hohmann a Saturno 6,0");
  ok(near(missionYears(MISSIONS.galileo), 6.14, 0.03) && near(hohmannYears("jupiter"), 2.73, 0.03), "Galileo 6,1 años; Hohmann a Júpiter 2,7");
  ok(near(missionYears(MISSIONS.juno), 4.91, 0.03), "Juno ≈ 4,9 años");
  ok(near(missionYears(MISSIONS.europaclipper), 5.49, 0.03), "Europa Clipper ≈ 5,5 años (JPL: «5½ años»)");
  ok(near(missionYears(MISSIONS.juice), 8.27, 0.03), "JUICE ≈ 8,3 años (ESA: «más de ocho años»)");
  ok(near(missionYears(MISSIONS.messenger), 6.62, 0.03), "MESSENGER ≈ 6,6 años");
  ok(near(missionYears(MISSIONS.bepicolombo), 8.09, 0.03), "BepiColombo ≈ 8,1 años");
  ok(near(missionYears(MISSIONS.perseverance) * 365.25, 203, 1), "Mars 2020: 203 días (JPL)");
  ok(near(hohmannYears("mars") * 365.25, hohmannLocal("earth", "mars").transfer_time_days, 1e-6), "Hohmann a Marte coincide con hohmannLocal (259 d)");
  ok(near(orbitalSpeedKmS("earth"), 29.78, 0.01) && near(orbitalSpeedKmS("jupiter"), 13.06, 0.02), "velocidades orbitales: Tierra 29,78 y Júpiter 13,06 km/s");
  ok(maxFlybyDv(5) === 10, "tope teórico de un sobrevuelo: 2·v∞");
  // el mismo vector: girar v∞ 180° cambia la velocidad en 2·v∞ (aritmética vectorial)
  const vin = [3, 4], vout = [-3, -4];
  ok(Math.hypot(vout[0] - vin[0], vout[1] - vin[1]) === maxFlybyDv(Math.hypot(...vin)), "comprobación vectorial del 2·v∞");
}

console.log("Próximo hito (a 14 nov 2026)");
{
  const now = Date.UTC(2026, 10, 14);
  const ec = nextMilestone(MISSIONS.europaclipper, now);
  ok(ec && ec.body === "earth" && ec.kind === "assist" && daysTo(ec, now) === 18, "Europa Clipper: sobrevuelo de la Tierra en 18 días", JSON.stringify(ec));
  const bp = nextMilestone(MISSIONS.bepicolombo, now);
  ok(bp && bp.kind === "arrival" && daysTo(bp, now) === 7, "BepiColombo: entrada en órbita de Mercurio en 7 días");
  const ju = nextMilestone(MISSIONS.juice, now);
  ok(ju && ju.date === "2029-01" && daysTo(ju, now) > 60, "JUICE: lo próximo es enero de 2029 (no se destaca)");
  ok(nextMilestone(MISSIONS.juno, now) === null && nextMilestone(MISSIONS.cassini, now) === null, "misiones terminadas: sin hito próximo");
  ok(nextMilestone(MISSIONS.europaclipper, Date.UTC(2026, 11, 7, 12)) !== null && nextMilestone(MISSIONS.europaclipper, Date.UTC(2026, 11, 9)).kind === "arrival", "pasada la ventana, el hito siguiente es la llegada");
}

console.log("Escala radial del mapa");
{
  ok(ORBIT_AU.length === 8 && MAP_PLANETS.every((id, i) => ORBIT_AU[i] === SEMI_MAJOR_AXIS_AU[id]), "semiejes iguales a los de orbits.js");
  ok(MAP_PLANETS.every((id, i) => mapRadius(SEMI_MAJOR_AXIS_AU[id]) === ORBIT_R(i)), "en el radio de cada planeta devuelve exactamente su órbita");
  let mono = true, prev = -1;
  for (let au = 0; au <= 40; au += 0.005) { const r = mapRadius(au); if (!(r > prev)) { mono = false; break; } prev = r; }
  ok(mono, "estrictamente creciente de 0 a 40 UA");
  ok(mapRadius(0) === 0, "0 UA → centro del mapa");
  ok(near(mapRadius(0.2), (ORBIT_R(0) * 0.2) / 0.387, 1e-12), "dentro de Mercurio: lineal hasta el Sol");
  ok(mapRadius(31) > ORBIT_R(7) && mapRadius(40) > mapRadius(31), "más allá de Neptuno sigue creciendo");
  ok(MAP_PLANETS.slice(1).every((_, k) => { const lo = ORBIT_AU[k], hi = ORBIT_AU[k + 1]; const r = mapRadius((lo + hi) / 2); return r > ORBIT_R(k) && r < ORBIT_R(k + 1); }), "entre dos órbitas el radio queda entre las dos (cúbica monótona, sin pasarse)");
  ok(near(mapRadius(ORBIT_AU[3] + 1e-6) - mapRadius(ORBIT_AU[3] - 1e-6), 0, 1e-4), "continua en cada órbita (sin saltos)");
  ok(mapRadius(-3) === 0, "UA negativas se recortan a 0");
}

console.log("Elipse de Hohmann");
{
  for (const [a, b] of [["earth", "mars"], ["earth", "jupiter"], ["earth", "neptune"], ["earth", "venus"], ["mars", "earth"], ["jupiter", "mercury"], ["venus", "mercury"]]) {
    const r1 = SEMI_MAJOR_AXIS_AU[a], r2 = SEMI_MAJOR_AXIS_AU[b];
    const ell = hohmannEllipse(r1, r2);
    ok(near(ell.a * (1 - ell.e), Math.min(r1, r2), 1e-12) && near(ell.a * (1 + ell.e), Math.max(r1, r2), 1e-12), `${a}→${b}: perihelio y afelio son los radios de las órbitas`);
    ok(near(hohmannRadiusAU(ell, 0), r1, 1e-12) && near(hohmannRadiusAU(ell, 1), r2, 1e-12), `${a}→${b}: sale en r1 y llega en r2`);
    let lo = Infinity, hi = 0;
    for (let k = 0; k <= 1000; k++) { const r = hohmannRadiusAU(ell, k / 1000); lo = Math.min(lo, r); hi = Math.max(hi, r); }
    ok(near(lo, Math.min(r1, r2), 1e-9) && near(hi, Math.max(r1, r2), 1e-9), `${a}→${b}: el mínimo y el máximo del recorrido son perihelio y afelio`);
    let m = true; let p = hohmannRadiusAU(ell, 0);
    for (let k = 1; k <= 1000; k++) { const r = hohmannRadiusAU(ell, k / 1000); if (r2 > r1 ? r < p - 1e-12 : r > p + 1e-12) m = false; p = r; }
    ok(m, `${a}→${b}: la distancia al Sol cambia sin retroceder`);
  }
  const ell = hohmannEllipse(1, 1.524);
  ok(near(ell.e, 0.2073, 1e-3) && near(ell.a, 1.262, 1e-9), "Tierra→Marte: a = 1,262 UA, e = 0,207");

  const dep = new Date("2026-12-04T02:00:00Z"), arr = new Date("2027-08-20T00:00:00Z");
  const pl = hohmannPlan("earth", "mars", dep, arr);
  ok(near(pl.thetaDep, helioLongitude("earth", dep), 1e-12), "la salida va en la longitud heliocéntrica del origen ese día");
  ok(near(pl.thetaArr - pl.thetaDep, Math.PI, 1e-12) && near(pl.points.at(-1).theta - pl.points[0].theta, Math.PI, 1e-12), "llegada a +180° de la salida");
  ok(near(pl.points[0].x, 50 + ORBIT_R(2) * Math.cos(pl.thetaDep), 1e-9) && near(pl.points[0].y, 50 - ORBIT_R(2) * Math.sin(pl.thetaDep), 1e-9), "empieza en la órbita de origen del mapa");
  const L = pl.points.at(-1);
  ok(near(Math.hypot(L.x - 50, L.y - 50), ORBIT_R(3), 1e-9), "termina en la órbita de destino del mapa");
  ok(pl.points.length === 121, "121 puntos (120 tramos)");
  // el recorrido avanza en el sentido del movimiento (antihorario): el ángulo crece
  ok(pl.points.every((q, i) => i === 0 || q.theta > pl.points[i - 1].theta), "avanza en el sentido en que se mueven los planetas");
  ok(near(pl.ghost.theta, helioLongitude("mars", arr), 1e-12) && near(pl.ghost.r, ORBIT_R(3), 1e-12), "destino «fantasma» en su posición de la fecha de llegada, sobre su órbita");
  ok(Math.abs(pl.ghostOffsetDeg) < 25, "el destino real queda cerca del punto de llegada (<25°)", String(pl.ghostOffsetDeg));

  // la elipse cruza cada órbita del mapa a la distancia en UA que le corresponde
  const pj = hohmannPlan("earth", "jupiter", dep, new Date("2029-06-01Z"));
  const crossMars = pj.points.find((q) => q.au >= 1.524);
  ok(crossMars && near(Math.hypot(crossMars.x - 50, crossMars.y - 50), ORBIT_R(3), 1.2), "Tierra→Júpiter: cruza la órbita de Marte hacia donde está dibujada");
  let exact = true;
  for (let i = 3; i <= 4; i++) {
    let lo = 0, hi = 1;
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (hohmannRadiusAU(hohmannEllipse(1, 5.203), mid) < ORBIT_AU[i]) lo = mid; else hi = mid; }
    const au = hohmannRadiusAU(hohmannEllipse(1, 5.203), (lo + hi) / 2);
    if (!near(mapRadius(au), ORBIT_R(i), 1e-9)) exact = false;
  }
  ok(exact, "en el punto donde la elipse real cruza 1,524 y 5,203 UA, el mapa la pone en esas órbitas");
  ok(typeof pathD(pl.points) === "string" && pathD(pl.points).startsWith("M") && (pathD(pl.points).match(/L/g) || []).length === 120, "pathD: una M y 120 L");
  ok(pl.points.every((q) => q.x >= 0 && q.x <= 100 && q.y >= 0 && q.y <= 100), "todo el trazado cabe en el mapa (Tierra→Marte)");
  const pn = hohmannPlan("earth", "neptune", dep, new Date("2057-06-01Z"));
  ok(pn.points.every((q) => q.x >= 0 && q.x <= 100 && q.y >= 0 && q.y <= 100), "todo el trazado cabe en el mapa (Tierra→Neptuno)");

  // desfase del destino real respecto al punto de llegada, con las ventanas locales de hoy
  const now = new Date("2026-11-14T12:00:00Z");
  for (const to of ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"]) {
    const rd = routeDates("earth", to, null, now);
    const p = hohmannPlan("earth", to, new Date(rd.dep), new Date(rd.arr));
    ok(rd.source === "local" && Math.abs(p.ghostOffsetDeg) < 30, `Tierra→${to}: ventana local y destino a ${p.ghostOffsetDeg.toFixed(1)}° del punto de llegada`);
  }
}

console.log("Fechas de la ruta (próxima ventana)");
{
  const now = new Date("2026-11-14T12:00:00Z");
  const loc = routeDates("earth", "mars", null, now);
  ok(loc.source === "local" && new Date(loc.dep) > now && new Date(loc.dep) < new Date("2026-12-31"), "Tierra→Marte: ventana local a fin de 2026", loc.dep);
  ok(near((new Date(loc.arr) - new Date(loc.dep)) / 86400000, 258.9, 1), "tiempo de vuelo de Hohmann ≈ 259 días");
  const srv = routeDates("earth", "mars", { dep: "2026-12-04T02:07:17.893942", arr: "2027-08-20T00:05:06.698734" }, now);
  ok(srv.source === "server" && srv.dep.startsWith("2026-12-04"), "si el servidor da una ventana, se usa");
  ok(routeDates("earth", "mars", { dep: "basura", arr: "x" }, now).source === "local", "una respuesta inservible cae a la ventana local");
  ok(routeDates("earth", "mars", { dep: "2026-12-04T00:00:00", arr: null }, now).source === "local", "ventana incompleta: cae a la local");
}

console.log("Etiquetas de los marcadores");
{
  const side = 300;
  const obs = [{ x: 100, y: 100, w: 80, h: 100 }];
  const b = placeLabel(150, 150, 90, 17, side, [], { gap: 6 });
  ok(b && b.x >= 0 && b.y >= 0 && b.x + b.w <= side && b.y + b.h <= side, "dentro del mapa");
  const c = placeLabel(190, 150, 90, 17, side, obs, { gap: 6 });
  ok(c && !(c.x < 180 && c.x + c.w > 100 && c.y < 200 && c.y + c.h > 100), "no pisa los obstáculos");
  const d = placeLabel(2, 2, 90, 17, side, [], { gap: 6 });
  ok(d && d.x >= 0 && d.y >= 0, "junto al borde elige un lado con hueco");
  ok(placeLabel(150, 150, 90, 17, side, [{ x: 0, y: 0, w: side, h: side }]) === null, "sin hueco devuelve null (queda el marcador sin etiqueta)");
  const path = [];
  for (let x = 0; x <= side; x += 2) path.push({ x, y: 150 });
  const e = placeLabel(150, 150, 90, 17, side, [], { avoidPath: path, gap: 8 });
  ok(e && !path.some((q) => q.x >= e.x - 2 && q.x <= e.x + e.w + 2 && q.y >= e.y - 2 && q.y <= e.y + e.h + 2), "prefiere no tapar la línea cuando hay hueco");
}

console.log("Textos ES y EN");
{
  const keys = (o) => Object.keys(o).sort().join();
  ok(keys(GA.es) === keys(GA.en), "mismas claves en ES y EN");
  for (const k of Object.keys(GA.es)) ok(typeof GA.es[k] === typeof GA.en[k], `tipo de «${k}» igual en ES y EN`);
  ok(keys(GA.es.kind) === keys(GA.en.kind) && keys(GA.es.kindCap) === keys(GA.en.kindCap) && keys(GA.es.nextKinds) === keys(GA.en.nextKinds), "tipos de hito en ES y EN");
  ok(/detrás/.test(GA.es.how) && /delante/.test(GA.es.how) && /misma rapidez/.test(GA.es.how), "ES: misma rapidez en el marco del planeta; gana por detrás, pierde por delante");
  ok(/behind/.test(GA.en.how) && /in front/.test(GA.en.how) && /same speed/.test(GA.en.how), "EN: same speed in the planet's frame; gains behind, loses in front");
  ok(/Voyager/.test(GA.es.uses) && /Parker/.test(GA.es.uses) && /Voyager/.test(GA.en.uses) && /Parker/.test(GA.en.uses), "usos: acelerar hacia fuera y frenar hacia el Sol");
  ok(/2·v∞/.test(GA.es.limit("13,1")) && /13,1/.test(GA.es.limit("13,1")) && /2·v∞/.test(GA.en.limit("13.1")), "tope 2·v∞ en ES y EN");
  ok(GA.es.missionsTitle("Júpiter").includes("Júpiter") && GA.en.missionsTitle("Jupiter").includes("Jupiter"), "título por destino");
  ok(nameOf("earth", "es", true) === "la Tierra" && nameOf("earth", "es") === "Tierra" && nameOf("sun", "en") === "Sun", "nombres con y sin artículo");
  ok(GA.es.next("a", "b").startsWith("Próximo") && GA.en.next("a", "b").startsWith("Next"), "etiqueta «Próximo»");
  ok(GA.es.slower("2,1").includes("energía") && GA.en.slower("2.1").includes("energy"), "mensaje honesto: la catapulta ahorra energía, no tiempo");
  const all = JSON.stringify(GA);
  ok(!/\bundefined\b|\[object|TODO|XXX/.test(all), "sin marcadores olvidados");
}

console.log("Integración en App.jsx, métricas y red");
{
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  ok(/import GravityAssists from "\.\/route\/GravityAssists\.jsx"/.test(app), "App importa la tarjeta");
  const iRT = app.indexOf("<RealTrajectory"), iGA = app.indexOf("<GravityAssists"), iWin = app.indexOf("<LaunchWindows");
  ok(iRT > 0 && iGA > iRT && iGA < iWin, "la tarjeta va debajo de la trayectoria realista, en Ruta");
  ok(/!special && tab==="route" && \(<>[\s\S]*<GravityAssists[\s\S]*<\/>\)/.test(app), "solo con destino planeta (no con `special`)");
  ok(/<SectionBoundary name="Catapultas"[^>]*>\s*<GravityAssists/.test(app), "envuelta en SectionBoundary como las demás");
  ok(!/const ORBIT_R\s*=/.test(app) && /import \{[^}]*ORBIT_R[^}]*\} from "\.\/route\/hohmannMap\.js"/.test(app), "ORBIT_R se importa de hohmannMap.js (una sola escala)");
  ok(/plan=\{mapPlan\}/.test(app) && /routeDates\(from\.id, to\.id, srv\)/.test(app), "el mapa recibe las fechas de la próxima ventana");
  ok(/launch-windows\/\$\{from\.id\}\/\$\{to\.id\}\?count=4/.test(app), "usa el endpoint de ventanas que ya existe (sin pedir nada nuevo)");
  ok(/hohmannPlan\(from\.id, to\.id/.test(app) && /if \(special \|\| !depISO/.test(app), "la elipse solo se dibuja con destino planeta");
  ok(/special !== "sun"\) return ""/.test(app) || /if \(special !== "sun"\) return "";/.test(app), "Luna: sin hilo");
  ok(/mapNote:\s+"Toca un planeta[^"]*La línea es la ruta de Hohmann de la próxima ventana: ángulos reales, distancias comprimidas\."/.test(app), "pie ES: «La línea es la ruta de Hohmann de la próxima ventana: ángulos reales, distancias comprimidas»");
  ok(/mapNote:\s+"Tap a planet[^"]*The line is the Hohmann route for the next window: real angles, compressed distances\."/.test(app), "pie EN");
  ok(/mapNasa:\s+"Posiciones de hoy: NASA JPL"/.test(app) && /mapNasa:\s+"Today's positions: NASA JPL"/.test(app), "se mantiene «Posiciones de hoy: NASA JPL»");
  ok(/mapNoteSpecial:\s+"[^"]*el hilo es esquemático/.test(app) && /mapNoteSpecial:\s+"[^"]*the thread is schematic/.test(app), "con la Luna o el Sol se conserva el pie «esquemático»");
  ok(/mapDep:\s+\(d\) => `Salida: \$\{d\}`/.test(app) && /mapArr:\s+\(d\) => `Llegada: \$\{d\}`/.test(app) && /mapDep:\s+\(d\) => `Departure: \$\{d\}`/.test(app) && /mapArr:\s+\(d\) => `Arrival: \$\{d\}`/.test(app), "marcadores «Salida: …» y «Llegada: …» (ES/EN)");
  ok(/mapNoWindow/.test(app) && /mapPlan\.source==="today"/.test(app), "sin ventana: usa hoy y lo dice en el pie");
  ok(/onClick=\{\(\)=>onPick\(p\)\}/.test(app) && /onClick=\{\(\)=>onPickSun && onPickSun\(\)\}/.test(app), "tocar planetas y el Sol no cambió");
  ok(/className="map__ghost"/.test(app) && /className=\{`map__tag map__tag--\$\{k\}`\}/.test(app) && /aria-hidden="true" className=\{`map__tag/.test(app), "marcadores y etiquetas presentes");
  ok(/mapRouteLabel/.test(app) && /aria-label=\{routeLabel \?/.test(app), "el grupo del mapa describe la ruta para lectores de pantalla");

  const be = readFileSync(new URL("../backend/app/metrics.py", import.meta.url), "utf8");
  ok(/"assists_card":\s*\{"origin": BODIES, "destination": BODIES\}/.test(be), "evento assists_card en la lista blanca del servidor");
  const p = cleanParams({ origin: "earth", destination: "jupiter", mission: "juno" });
  ok(p.origin === "earth" && p.destination === "jupiter" && !("mission" in p), "track.js: claves origin/destination admitidas; otras se descartan");
  ok(metricParams({ origin: "earth", destination: "neptune" }).destination === "neptune", "metricParams conserva destination");

  const lam = readFileSync(new URL("../backend/app/lambert.py", import.meta.url), "utf8");
  ok(!/21 jun 1999|21 Jun 1999/.test(lam) && /24 jun 1999/.test(lam) && /24 Jun 1999/.test(lam), "lambert.py: Cassini, Venus del 24 jun 1999 (antes decía 21)");
  ok(/Voyager 2, el 24 de enero de 1986/.test(lam) && /Voyager 2, el 25 de agosto de 1989/.test(lam), "lambert.py: Voyager 2 con fechas de NASA");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
if (failed) process.exit(1);
