// Pruebas de «Trayectoria realista (Lambert)» (src/route/): normalización de la
// respuesta de /api/trajectory, funciones puras del porkchop, textos ES/EN e
// integración mínima en App.jsx. Node puro, sin dependencias.
// Uso:  node scripts/test_route_trajectory.mjs     (sale con código 1 si algo falla)
import { readFileSync } from "node:fs";
import {
  normalizeTrajectory, trajectoryUrl, parseDay, delta, bandIndex, bandLimits, BAND_FACTORS, BAND_COLORS,
  porkchopCells, topCells, openDepartures, gridPosition, porkchopFacts,
} from "../src/route/trajectory.js";
import { TR, BODY_NAMES, bodyName } from "../src/route/i18n.js";
import { cleanParams, metricParams } from "../src/ui/track.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// Respuesta de ejemplo con la forma real del servidor (cifras de Tierra→Marte, 2026)
const sol = (over = {}) => ({
  departure_date: "2026-11-14T00:00:00Z", arrival_date: "2027-08-11T00:00:00Z", transfer_time_days: 271.0,
  c3_km2_s2: 10.88, v_inf_departure_km_s: 3.299, v_inf_arrival_km_s: 2.939, delta_v_heliocentric_km_s: 6.238,
  departure_declination_deg: 18.8,
  injection: { delta_v_km_s: 3.711, parking_altitude_km: 185 },
  insertion: { delta_v_km_s: 2.236, orbit_altitude_km: 300, body_radius_km: 3396.2, body_mu_km3_s2: 42828.4 },
  delta_v_leo_to_low_orbit_km_s: 5.947, ...over,
});
const N = 5;
const depDates = Array.from({ length: N }, (_, i) => new Date(Date.UTC(2026, 10, 14 + 5 * i)).toISOString().slice(0, 10));
const arrDates = Array.from({ length: N }, (_, j) => new Date(Date.UTC(2027, 6, 1 + 20 * j)).toISOString().slice(0, 10));
// C3 sube con la distancia al centro (2,2); esquinas sin solución (null)
const c3 = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) =>
  ((i === 0 && j === 0) || (i === N - 1 && j === N - 1)) ? null : Math.round((10.9 + 2.5 * Math.hypot(i - 2, j - 2)) * 10) / 10));
const raw = () => ({
  origin: "earth", destination: "mars", computed_for: "2026-11-14", starts_today: true, needs_gravity_assist: false,
  assist_note: null, optimum: sol(),
  alternative_type_ii: sol({ transfer_time_days: 360, c3_km2_s2: 10.28 }),
  hohmann: sol({ departure_date: "2026-12-04T02:07:17.893942", arrival_date: "2027-08-20T00:05:06.698734", transfer_time_days: 258.9,
    c3_km2_s2: 8.68, v_inf_departure_km_s: 2.946, v_inf_arrival_km_s: 2.65, delta_v_heliocentric_km_s: 5.596, injection: { delta_v_km_s: 3.615, parking_altitude_km: 185 },
    insertion: { delta_v_km_s: 2.091, orbit_altitude_km: 300 }, delta_v_leo_to_low_orbit_km_s: 5.706, departure_declination_deg: undefined }),
  porkchop: { departure_dates: depDates, arrival_dates: arrDates, c3_km2_s2: c3, c3_grid_min: 10.9, only_type_i: true },
});

console.log("Normalización de la respuesta");
{
  const d = normalizeTrajectory(raw());
  ok(d && d.origin === "earth" && d.destination === "mars", "forma correcta: origen y destino");
  ok(d.opt.days === 271 && near(d.opt.c3, 10.88, 1e-9) && d.opt.dep instanceof Date, "óptimo: días, C3 y fecha como Date");
  ok(near(d.opt.dla, 18.8, 1e-9) && d.hoh.dla === null, "declinación solo si la trae");
  ok(d.opt.injection.parking_altitude_km === 185 && d.opt.insertion.body_radius_km === 3396.2, "inyección e inserción con sus parámetros");
  ok(d.alt && d.alt.days === 360, "alternativa de tipo II");
  ok(d.startsToday === true && d.needsAssist === false && d.assistNote === null, "banderas");
  ok(d.pork && d.pork.nd === N && d.pork.na === N && d.pork.c3[0][0] === null, "porkchop 5×5 con celdas nulas");
  ok(+d.hoh.dep === Date.UTC(2026, 11, 4, 2, 7, 17, 893), "fechas sin zona (Hohmann) se leen como UTC", String(d.hoh.dep.toISOString()));
  ok(normalizeTrajectory(null) === null && normalizeTrajectory({}) === null && normalizeTrajectory([]) === null && normalizeTrajectory("x") === null, "entradas inválidas → null");
  const sinOpt = raw(); sinOpt.optimum = null;
  ok(normalizeTrajectory(sinOpt) === null, "sin óptimo → null (estado «sin datos»)");
  const nanC3 = raw(); nanC3.optimum.c3_km2_s2 = "10";
  ok(normalizeTrajectory(nanC3) === null, "C3 que no es número → null");
  const sinPork = raw(); sinPork.porkchop = { departure_dates: [], arrival_dates: [], c3_km2_s2: [] };
  const d2 = normalizeTrajectory(sinPork);
  ok(d2 && d2.pork === null, "porkchop inservible: la tarjeta sigue con la tabla");
  const dest = raw(); dest.destination = "jupiter"; dest.needs_gravity_assist = true; dest.assist_note = { es: "Juno…", en: "Juno…" };
  const d3 = normalizeTrajectory(dest);
  ok(d3.needsAssist && d3.assistNote.es === "Juno…" && d3.assistNote.en === "Juno…", "nota de asistencia gravitatoria en ES y EN");
  const sinIns = raw(); sinIns.optimum.insertion = null; sinIns.optimum.delta_v_leo_to_low_orbit_km_s = null;
  const d4 = normalizeTrajectory(sinIns);
  ok(d4.opt.insertion === null && d4.opt.dvLow === null, "gigante: sin inserción en órbita baja");
}

console.log("URL y fechas");
{
  ok(trajectoryUrl("earth", "mars") === "/api/trajectory?origin=earth&destination=mars", "URL relativa sin VITE_API_URL", trajectoryUrl("earth", "mars"));
  ok(parseDay("2026-11-14T00:00:00Z").toISOString() === "2026-11-14T00:00:00.000Z" && parseDay("2026-11-14").toISOString().startsWith("2026-11-14"), "parseDay");
  ok(parseDay("basura") === null && parseDay(null) === null, "parseDay inválido → null");
  const x = delta(10.88, 8.68);
  ok(near(x.abs, 2.2, 1e-9) && near(x.pct, 25.35, 0.01), "delta: +2,2 (+25,4 %)", JSON.stringify(x));
  ok(delta(5, 0).pct === null, "delta con referencia 0 no divide");
}

console.log("Porkchop: bandas, mínimo y rangos");
{
  ok(BAND_COLORS.length === BAND_FACTORS.length + 1, "una banda más que límites");
  ok(bandIndex(10, 10) === 0 && bandIndex(10.5, 10) === 0 && bandIndex(10.6, 10) === 1 && bandIndex(30, 10) === BAND_FACTORS.length, "bandIndex en los bordes");
  const lim = bandLimits(10);
  ok(lim.length === BAND_FACTORS.length && near(lim[0], 10.5, 1e-9) && lim.every((v, i) => i === 0 || v > lim[i - 1]), "límites crecientes");
  const { pork } = normalizeTrajectory(raw());
  const { cells, min } = porkchopCells(pork);
  ok(cells.length === N * N - 2, "cuenta solo las celdas con solución", String(cells.length));
  ok(min.i === 2 && min.j === 2 && near(min.c3, 10.9, 1e-9), "mínimo en el centro", JSON.stringify(min));
  ok(cells.find((c) => c.i === 2 && c.j === 2).band === 0 && cells.every((c) => c.band >= 0 && c.band <= BAND_FACTORS.length), "bandas en rango");
  const top = topCells(pork, 3);
  ok(top.length === 3 && top[0].c3 <= top[1].c3 && top[1].c3 <= top[2].c3 && top[0].i === 2 && top[0].j === 2, "topCells ordenado por C3");
  ok(top[0].days === Math.round((pork.arr[2] - pork.dep[2]) / 86400000), "topCells con días de vuelo");
  const o = openDepartures(pork, 1.3);
  ok(o && near(o.min, 10.9, 1e-9) && o.from <= o.to && near(o.limit, 14.17, 0.01), "salidas dentro del 30 % del mínimo", JSON.stringify(o));
  const f = porkchopFacts(pork);
  ok(near(f.min, 10.9, 1e-9) && f.days === Math.round((pork.arr[2] - pork.dep[2]) / 86400000) && +f.depFirst === +pork.dep[0], "porkchopFacts");
  const g = gridPosition(pork, pork.dep[2], pork.arr[3]);
  ok(g && near(g.x, 2, 1e-9) && near(g.y, 3, 1e-9), "gridPosition: celda exacta");
  const g2 = gridPosition(pork, new Date((+pork.dep[1] + +pork.dep[2]) / 2), pork.arr[0]);
  ok(g2 && near(g2.x, 1.5, 1e-9) && near(g2.y, 0, 1e-9), "gridPosition: interpola");
  ok(gridPosition(pork, new Date(Date.UTC(2020, 0, 1)), pork.arr[0]) === null, "gridPosition fuera del mapa → null");
}

console.log("Textos ES / EN");
{
  const ks = (o) => Object.keys(o).sort().join();
  ok(ks(TR.es) === ks(TR.en), "ES y EN tienen las mismas claves", `${ks(TR.es)} | ${ks(TR.en)}`);
  ok(Object.keys(TR.es).every((k) => typeof TR.es[k] === typeof TR.en[k]), "mismo tipo (texto o función) en ambos idiomas");
  ok(ks(BODY_NAMES.es) === ks(BODY_NAMES.en) && Object.keys(BODY_NAMES.es).length === 8, "ocho cuerpos con nombre en ambos idiomas");
  ok(bodyName("earth", "es") === "la Tierra" && bodyName("earth", "en") === "Earth" && bodyName("zzz", "es") === "zzz", "bodyName");
  for (const lang of ["es", "en"]) {
    const t = TR[lang];
    const f = { min: "10,9", dep: "14 nov 2026", arr: "11 ago 2027", days: 271, open: true, limit: "14,2", openFrom: "14 nov 2026", openTo: "4 dic 2026", depFirst: "14 nov 2026", depLast: "13 mar 2027" };
    const out = [t.lead("la Tierra", "Marte"), t.why({ dh: "259", dr: "271", c3r: "10,9", c3h: "8,7", dep: "14 nov 2026" }), t.altII("10,3", "360", "3,6"),
      t.porkAria(f), t.porkSummary(f), t.pickValue("a", "b", 1, "2"), t.rowDvLow("x", "y"), t.legendUpTo("1"), t.legendOver("2"), t.tableCaption("a", "b")];
    ok(out.every((s) => typeof s === "string" && s.length > 3 && !/undefined|NaN|\[object/.test(s)), `${lang}: las funciones de texto devuelven cadenas limpias`);
    ok(/10,9/.test(t.porkAria(f)) && /14 nov 2026/.test(t.porkAria(f)), `${lang}: el aria-label del mapa lleva el mínimo y las fechas`);
  }
  ok(/Lambert/.test(TR.es.title) && /Lambert/.test(TR.en.title), "título con «Lambert» en ambos idiomas");
  ok(/14,49/.test(TR.es.verified) && /14\.49/.test(TR.en.verified) && /8,19/.test(TR.es.verified), "la comprobación cita los C3 publicados (14,49 y 8,19)");
}

console.log("Métricas (claves que admite track.js)");
{
  const p = { origin: "earth", destination: "mars", state: "ok" };
  ok(JSON.stringify(cleanParams(p)) === JSON.stringify(p) && JSON.stringify(metricParams(p)) === JSON.stringify(p), "origin, destination y state pasan track.js");
  const be = readFileSync(new URL("../backend/app/metrics.py", import.meta.url), "utf8");
  ok(/"trajectory_card":\s*\{"origin": BODIES, "destination": BODIES, "state": \{"ok", "fail", "empty"\}\}/.test(be), "evento trajectory_card en la lista blanca del servidor");
}

console.log("Integración en App.jsx");
{
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  ok((app.match(/<RealTrajectory\b/g) || []).length === 1, "la tarjeta se monta una sola vez");
  const iTech = app.indexOf("<TechDetails lang={lang} route={route}");
  const iRt = app.indexOf("<RealTrajectory");
  const iWin = app.indexOf('{!special && tab==="windows"');
  ok(iTech > 0 && iRt > iTech && iRt < iWin, "va justo debajo de <TechDetails> y antes de la pestaña Ventanas");
  const iRoute = app.indexOf('{!special && tab==="route" && (<>');
  ok(iRoute > 0 && iRoute < iTech, "dentro del bloque !special && tab === ruta (con Luna o Sol no se muestra)");
  const around = app.slice(iRt - 260, iRt + 120);
  ok(/<SectionBoundary name="Trayectoria realista"/.test(around), "envuelta en SectionBoundary");
  ok(/from "\.\/route\/RealTrajectory\.jsx"/.test(app) && /from "\.\/route\/i18n\.js"/.test(app), "importa solo la tarjeta y sus textos");
}

console.log("Archivos de la pieza");
{
  const css = readFileSync(new URL("../src/route/route.css", import.meta.url), "utf8");
  ok(/^\s*\.rt[\w-]*[ ,{]/m.test(css) && !/^\s*(body|html|\*|\.card)\b/m.test(css), "route.css solo define clases .rt*");
  const jsx = readFileSync(new URL("../src/route/RealTrajectory.jsx", import.meta.url), "utf8");
  ok(/role="img"/.test(jsx) && /aria-labelledby/.test(jsx) && /<details/.test(jsx) && /<caption/.test(jsx), "porkchop accesible: role img, aria y tabla alternativa");
  ok(/status === "loading"/.test(jsx) && /status === "error"/.test(jsx) && /status === "empty"/.test(jsx), "estados: cargando, error y sin datos");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
if (failed) process.exit(1);
