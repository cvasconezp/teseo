// Pruebas de «Planifica tu viaje con catapultas» (src/route/mga.js, i18n-mga.js y su
// integración): normalización de la respuesta de GET /api/mga (200 y 202), formato de
// cifras y fechas, narración paso a paso, fichas de la línea de esferas, filas de la
// tabla, geometría del recorrido con la escala del mapa de Ruta, textos ES/EN,
// montaje en App.jsx y métricas. Node puro, sin dependencias.
// Los datos de muestra son una respuesta REAL del servidor (Saturno, calculada el
// 14-nov-2026) con los arcos recortados a 3 puntos.
// Uso:  node scripts/test_route_mga.mjs     (sale con código 1 si algo falla)
import { readFileSync } from "node:fs";
import {
  normalizeMga, normalizeOption, fetchMga, mgaUrl, pollDelay, MAX_POLLS, narrate, chips, routeName, tableRows,
  directComparison, routeGeometry, groupMarkers, toMap, fmtLong, fmtShort, fmtMonth, fmtDuration, fmtSpeed, fmtDistance, nf, DIRECT_ONLY,
} from "../src/route/mga.js";
import { MGA } from "../src/route/i18n-mga.js";
import { nameOf } from "../src/route/i18n-assists.js";
import { mapRadius, ORBIT_R } from "../src/route/hohmannMap.js";
import { cleanParams, metricParams } from "../src/ui/track.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const clone = (o) => JSON.parse(JSON.stringify(o));

const BEST = {"id":"EVVEJS-2034-07-31","code":"EVVEJS","sequence":["earth","venus","venus","earth","jupiter","saturn"],"mission":"cassini","departure_date":"2034-07-31","arrival_date":"2047-11-22","duration_days":4861,"duration_years":13.3,"c3_km2_s2":14.0,"v_inf_departure_km_s":3.75,"injection_delta_v_km_s":3.847,"departure_declination_deg":-24.9,"flybys":[{"body":"venus","date":"2034-11-05","v_inf_in_km_s":8.19,"v_inf_out_km_s":8.19,"turn_deg":45.5,"turn_max_deg":51.3,"periapsis_km":7677,"altitude_km":1625,"min_periapsis_km":6352,"powered_delta_v_km_s":0.0,"turn_limited":false,"helio_speed_gain_km_s":4.07,"viable":true},{"body":"venus","date":"2036-01-29","v_inf_in_km_s":8.19,"v_inf_out_km_s":8.19,"turn_deg":47.7,"turn_max_deg":51.3,"periapsis_km":7151,"altitude_km":1100,"min_periapsis_km":6352,"powered_delta_v_km_s":0.0,"turn_limited":false,"helio_speed_gain_km_s":1.8,"viable":true},{"body":"earth","date":"2037-08-17","v_inf_in_km_s":13.79,"v_inf_out_km_s":13.79,"turn_deg":25.8,"turn_max_deg":27.6,"periapsis_km":7294,"altitude_km":916,"min_periapsis_km":6678,"powered_delta_v_km_s":0.0,"turn_limited":false,"helio_speed_gain_km_s":4.76,"viable":true},{"body":"jupiter","date":"2040-10-09","v_inf_in_km_s":5.79,"v_inf_out_km_s":6.7,"turn_deg":97.4,"turn_max_deg":133.6,"periapsis_km":1078570,"altitude_km":1007078,"min_periapsis_km":285968,"powered_delta_v_km_s":0.341,"turn_limited":false,"helio_speed_gain_km_s":7.04,"viable":true}],"legs":[{"from":"earth","to":"venus","departure":"2034-07-31","arrival":"2034-11-05","days":97,"revolutions":0,"resonance":null,"path_au":[[0.6291,-0.7966],[0.7984,0.2542],[0.4434,0.57]]},{"from":"venus","to":"venus","departure":"2034-11-05","arrival":"2036-01-29","days":449,"revolutions":1,"resonance":"2:1","path_au":[[0.4434,0.57],[0.644,-1.1979],[0.4434,0.57]]},{"from":"venus","to":"earth","departure":"2036-01-29","arrival":"2037-08-17","days":566,"revolutions":0,"resonance":null,"path_au":[[0.4434,0.5701],[-0.5063,-1.8435],[0.8199,-0.5939]]},{"from":"earth","to":"jupiter","departure":"2037-08-17","arrival":"2040-10-09","days":1149,"revolutions":0,"resonance":null,"path_au":[[0.8199,-0.5939],[-5.3217,-0.0147],[-5.3317,-1.1348]]},{"from":"jupiter","to":"saturn","departure":"2040-10-09","arrival":"2047-11-22","days":2600,"revolutions":0,"resonance":null,"path_au":[[-5.3317,-1.1348],[-1.5335,-9.788],[0.9169,-10.0022]]}],"powered_delta_v_km_s":0.341,"max_flyby_delta_v_km_s":0.341,"cost_km_s":4.189,"arrival":{"v_inf_km_s":2.6,"delta_v_km_s":0.15,"kind":"capture","orbit_altitude_km":null,"capture_periapsis_km":150000},"viable_without_dsm":true,"is_direct":false,"score":4.204,"vs_direct":{"injection_saving_km_s":3.402,"cost_saving_km_s":3.061,"c3_saving_km2_s2":90.8,"extra_days":2485},"starts_today":false};
const DIRECT = {"id":"ES-2043-01-14","code":"ES","sequence":["earth","saturn"],"mission":null,"departure_date":"2043-01-14","arrival_date":"2049-07-17","duration_days":2376,"duration_years":6.5,"c3_km2_s2":104.8,"v_inf_departure_km_s":10.24,"injection_delta_v_km_s":7.25,"departure_declination_deg":-9.2,"flybys":[],"legs":[{"from":"earth","to":"saturn","departure":"2043-01-14","arrival":"2049-07-17","days":2376,"revolutions":0,"resonance":null,"path_au":[[-0.387,0.9042],[2.5498,-9.2625],[3.9775,-9.1812]]}],"powered_delta_v_km_s":0.0,"max_flyby_delta_v_km_s":0.0,"cost_km_s":7.25,"arrival":{"v_inf_km_s":5.19,"delta_v_km_s":0.592,"kind":"capture","orbit_altitude_km":null,"capture_periapsis_km":150000},"viable_without_dsm":true,"is_direct":true,"score":7.309,"vs_direct":{"injection_saving_km_s":0.0,"cost_saving_km_s":0.0,"c3_saving_km2_s2":0.0,"extra_days":0},"starts_today":false};
const EJS = {"id":"EJS-2030-01-18","code":"EJS","sequence":["earth","jupiter","saturn"],"mission":null,"departure_date":"2030-01-18","arrival_date":"2039-04-12","duration_days":3370,"duration_years":9.2,"c3_km2_s2":78.2,"v_inf_departure_km_s":8.84,"injection_delta_v_km_s":6.337,"departure_declination_deg":-12.7,"flybys":[{"body":"jupiter","date":"2032-03-02","v_inf_in_km_s":7.01,"v_inf_out_km_s":7.01,"turn_deg":121.1,"turn_max_deg":128.3,"periapsis_km":381598,"altitude_km":310106,"min_periapsis_km":285968,"powered_delta_v_km_s":0.0,"turn_limited":false,"helio_speed_gain_km_s":6.44,"viable":true}],"legs":[{"from":"earth","to":"jupiter","departure":"2030-01-18","arrival":"2032-03-02","days":774,"revolutions":0,"resonance":null,"path_au":[[-0.4627,0.8682],[0.4008,-4.6351],[1.346,-5.0099]]},{"from":"jupiter","to":"saturn","departure":"2032-03-02","arrival":"2039-04-12","days":2597,"revolutions":0,"resonance":null,"path_au":[[1.346,-5.0099],[-7.1655,2.9601],[-9.4355,0.6158]]}],"powered_delta_v_km_s":0.0,"max_flyby_delta_v_km_s":0.0,"cost_km_s":6.337,"arrival":{"v_inf_km_s":4.18,"delta_v_km_s":0.385,"kind":"capture","orbit_altitude_km":null,"capture_periapsis_km":150000},"viable_without_dsm":true,"is_direct":false,"score":6.376,"vs_direct":{"injection_saving_km_s":0.912,"cost_saving_km_s":0.912,"c3_saving_km2_s2":26.6,"extra_days":994},"starts_today":false};
const MARS_OPTS = [{"id":"EMa-2026-11-14","code":"EMa","sequence":["earth","mars"],"mission":null,"departure_date":"2026-11-14","arrival_date":"2027-10-15","duration_days":335,"duration_years":0.9,"c3_km2_s2":10.6,"v_inf_departure_km_s":3.26,"injection_delta_v_km_s":3.699,"departure_declination_deg":38.1,"flybys":[],"legs":[{"from":"earth","to":"mars","departure":"2026-11-14","arrival":"2027-10-15","days":335,"revolutions":0,"resonance":null,"path_au":[[0.6194,0.7717],[-1.1003,-1.0902],[-0.1578,-1.46]]}],"powered_delta_v_km_s":0.0,"max_flyby_delta_v_km_s":0.0,"cost_km_s":3.699,"arrival":{"v_inf_km_s":2.98,"delta_v_km_s":2.256,"kind":"low_orbit","orbit_altitude_km":300.0,"capture_periapsis_km":null},"viable_without_dsm":true,"is_direct":true,"score":3.924,"vs_direct":{"injection_saving_km_s":-0.114,"cost_saving_km_s":-0.114,"c3_saving_km2_s2":-2.6,"extra_days":128},"starts_today":true},{"id":"EMa-2028-11-25","code":"EMa","sequence":["earth","mars"],"mission":null,"departure_date":"2028-11-25","arrival_date":"2029-09-25","duration_days":304,"duration_years":0.8,"c3_km2_s2":9.0,"v_inf_departure_km_s":3.01,"injection_delta_v_km_s":3.631,"departure_declination_deg":29.3,"flybys":[],"legs":[{"from":"earth","to":"mars","departure":"2028-11-25","arrival":"2029-09-25","days":304,"revolutions":0,"resonance":null,"path_au":[[0.446,0.8806],[-0.7378,-1.2555],[0.1914,-1.4271]]}],"powered_delta_v_km_s":0.0,"max_flyby_delta_v_km_s":0.0,"cost_km_s":3.631,"arrival":{"v_inf_km_s":2.99,"delta_v_km_s":2.263,"kind":"low_orbit","orbit_altitude_km":300.0,"capture_periapsis_km":null},"viable_without_dsm":true,"is_direct":true,"score":3.857,"vs_direct":{"injection_saving_km_s":-0.046,"cost_saving_km_s":-0.046,"c3_saving_km2_s2":-1.0,"extra_days":97},"starts_today":false},{"id":"EMa-2031-01-18","code":"EMa","sequence":["earth","mars"],"mission":null,"departure_date":"2031-01-18","arrival_date":"2031-11-12","duration_days":299,"duration_years":0.8,"c3_km2_s2":9.0,"v_inf_departure_km_s":3.0,"injection_delta_v_km_s":3.629,"departure_declination_deg":15.9,"flybys":[],"legs":[{"from":"earth","to":"mars","departure":"2031-01-18","arrival":"2031-11-12","days":299,"revolutions":0,"resonance":null,"path_au":[[-0.4562,0.8716],[0.5736,-1.2854],[1.2415,-0.6044]]}],"powered_delta_v_km_s":0.0,"max_flyby_delta_v_km_s":0.0,"cost_km_s":3.629,"arrival":{"v_inf_km_s":4.15,"delta_v_km_s":2.95,"kind":"low_orbit","orbit_altitude_km":300.0,"capture_periapsis_km":null},"viable_without_dsm":true,"is_direct":true,"score":3.924,"vs_direct":{"injection_saving_km_s":-0.044,"cost_saving_km_s":-0.044,"c3_saving_km2_s2":-1.0,"extra_days":91},"starts_today":false}];

const SATURN = {
  status: "ok", origin: "earth", destination: "saturn", computed_for: "2026-11-14",
  horizon: { from: "2026-11-14", to: "2051-11-13", years: 25 }, assists_help: true,
  criterion: "injection_plus_powered_flybys", jupiter_cycle_years: 19.9,
  best: BEST, options: [BEST, EJS, DIRECT], earliest: EJS, next_jupiter: EJS,
  direct: { best: DIRECT, next: DIRECT, hohmann: { duration_days: 2209, c3_km2_s2: 105.9, v_inf_departure_km_s: 10.29, injection_delta_v_km_s: 7.284, v_inf_arrival_km_s: 5.44, arrival_delta_v_km_s: 0.649 } },
  assumptions: { viable_flyby_dv_km_s: 0.5, min_periapsis_km: { earth: 6678, jupiter: 285968, venus: 6352 } },
};
const MARS = {
  status: "ok", origin: "earth", destination: "mars", computed_for: "2026-11-14", horizon: { from: "2026-11-14", to: "2051-11-13", years: 25 },
  assists_help: false, criterion: "injection_plus_powered_flybys", jupiter_cycle_years: null,
  best: MARS_OPTS[1], options: MARS_OPTS, earliest: null, next_jupiter: null,
  direct: { best: MARS_OPTS[1], next: MARS_OPTS[0], hohmann: { duration_days: 259, c3_km2_s2: 8.7, v_inf_departure_km_s: 2.95, injection_delta_v_km_s: 3.615, v_inf_arrival_km_s: 2.65, arrival_delta_v_km_s: 2.091 } },
  assumptions: { viable_flyby_dv_km_s: 0.5, min_periapsis_km: {} },
};

console.log("Normalización de la respuesta");
const D = normalizeMga(SATURN);
{
  ok(D && D.destination === "saturn" && D.best.id === "EVVEJS-2034-07-31", "respuesta de Saturno válida; mejor opción EVVEJS");
  ok(D.options.length === 3 && D.options.some((o) => o.isDirect), "tres alternativas, con el directo como referencia");
  ok(D.best.seq.join() === "earth,venus,venus,earth,jupiter,saturn" && D.best.mission === "cassini", "secuencia tipo Cassini");
  ok(D.best.flybys.length === 4 && D.best.legs.length === 5, "4 sobrevuelos y 5 tramos");
  ok(D.best.legs[1].resonance === "2:1" && D.best.legs[1].revolutions === 1, "el tramo Venus–Venus es resonante 2:1");
  ok(near(D.best.c3, D.best.vinfDep ** 2, 0.2), "C3 = v∞² (coherencia interna)");
  ok(near(D.best.cost, D.best.inj + D.best.powered, 0.002), "coste = inyección + sobrevuelos propulsados");
  ok(D.best.viable && D.best.maxFlybyDv <= 0.5, "viable sin maniobras (≤ 0,5 km/s por sobrevuelo)");
  ok(D.jupiterCycle === 19.9 && D.nextJupiter && D.nextJupiter.seq.includes("jupiter"), "próxima oportunidad con Júpiter y ciclo de ~20 años");
  ok(D.hohmann && D.hohmann.c3 === 105.9 && D.directBest.inj === 7.25, "comparación con Hohmann y con el Lambert directo");
  ok(D.criterion === "launch" && D.computedFor === "2026-11-14", "criterio y fecha de cálculo");
  ok(normalizeMga({ ...SATURN, status: "computing" }) === null, "una respuesta «calculando» no es un plan");
  ok(normalizeMga({ status: "ok", destination: "pluton", options: [] }) === null, "destino desconocido: null");
  ok(normalizeMga(null) === null && normalizeMga("x") === null, "basura: null");
  const bad = clone(BEST); bad.flybys = bad.flybys.slice(1);
  ok(normalizeOption(bad) === null, "opción incoherente (faltan sobrevuelos): se descarta");
  const noDate = clone(BEST); noDate.departure_date = "2034/07/31";
  ok(normalizeOption(noDate) === null, "fecha con formato raro: se descarta");
  const noPath = clone(BEST); noPath.legs[0].path_au = [[1, "x"]];
  ok(normalizeOption(noPath).legs[0].path.length === 0, "puntos no numéricos del arco se filtran");
  const merc = normalizeMga({ ...SATURN, destination: "mercury", criterion: "injection_plus_powered_flybys_plus_insertion" });
  ok(merc.criterion === "with_insertion", "Mercurio: el orden incluye la inserción");
  ok(DIRECT_ONLY.has("mars") && DIRECT_ONLY.has("venus") && !DIRECT_ONLY.has("saturn"), "Marte y Venus: solo directo");
}

console.log("Petición (200, 202, solo desde la Tierra, errores)");
{
  const realFetch = globalThis.fetch;
  const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  globalThis.fetch = reply(202, { status: "computing", destination: "saturn", running: true, queue_position: 0, progress: 0.4, eta_s: 12 });
  let r = await fetchMga("earth", "saturn");
  ok(r.state === "computing" && r.progress === 0.4 && r.eta === 12, "202 → «calculando» con progreso");
  ok(pollDelay(r) === 6000 && pollDelay({ eta: 200 }) === 15000 && pollDelay({ eta: 1 }) === 4000 && pollDelay(null) === 5000, "espera entre sondeos: entre 4 y 15 s");
  ok(MAX_POLLS >= 20 && MAX_POLLS <= 60, "tope de sondeos razonable");
  globalThis.fetch = reply(200, SATURN);
  r = await fetchMga("earth", "saturn");
  ok(r.state === "ok" && r.data.best.code === "EVVEJS", "200 → plan");
  globalThis.fetch = reply(200, { status: "earth_only", origin: "mars", destination: "saturn", message: { es: "x", en: "y" } });
  r = await fetchMga("mars", "saturn");
  ok(r.state === "earth_only", "origen distinto de la Tierra → «solo desde la Tierra»");
  globalThis.fetch = reply(200, { status: "ok", destination: "saturn" });
  r = await fetchMga("earth", "saturn");
  ok(r.state === "empty", "respuesta sin opciones → vacío");
  globalThis.fetch = reply(503, { detail: "x" });
  let threw = false;
  try { await fetchMga("earth", "saturn"); } catch (e) { threw = /HTTP 503/.test(e.message); }
  ok(threw, "503 → error (la tarjeta muestra «Reintentar»)");
  globalThis.fetch = realFetch;
  ok(/\/api\/mga\?origin=earth&destination=saturn$/.test(mgaUrl("earth", "saturn")), "URL del endpoint");
}

console.log("Formato (ES y EN)");
{
  ok(fmtLong("2034-07-31", "es") === "31 de julio de 2034" && fmtLong("2034-07-31", "en") === "31 July 2034", "fecha larga");
  ok(fmtShort("2034-07-31", "es") === "31 jul 2034" && fmtShort("2034-07-31", "en") === "31 Jul 2034", "fecha corta");
  ok(fmtMonth("2034-07-31", "es") === "jul 2034", "mes y año");
  ok(fmtDuration(4861, "es") === "13,3 años" && fmtDuration(4861, "en") === "13.3 years" && fmtDuration(97, "es") === "97 días", "duración en años o días");
  ok(fmtSpeed(3.847, "es") === "3,85 km/s" && fmtSpeed(0.341, "es") === "341 m/s" && fmtSpeed(0.341, "en") === "341 m/s" && fmtSpeed(11.83, "en") === "11.8 km/s", "velocidad: m/s por debajo de 1 km/s");
  ok(fmtDistance(1625, "es") === "1625 km" && fmtDistance(310106, "es") === "310.000 km" && fmtDistance(1007078, "es") === "1 millón de km" && fmtDistance(2687098, "es") === "2,7 millones de km", "distancia de sobrevuelo (singular y plural)", fmtDistance(1007078, "es"));
  ok(fmtDistance(2687098, "en") === "2.7 million km" && fmtDistance(310106, "en") === "310,000 km", "distancia (EN)");
  ok(nf(13.3, "es", 1) === "13,3" && nf(13.3, "en", 1) === "13.3", "separador decimal ES/EN");
}

console.log("Narración paso a paso");
const name = (lang) => (id, art = false) => nameOf(id, lang, art);
{
  const es = narrate(D.best, "es", MGA.es, name("es"));
  ok(es.length === 6 && es[0].kind === "launch" && es.at(-1).kind === "arrival", "salida, 4 sobrevuelos y llegada");
  ok(es[0].text.startsWith("Sales de la Tierra el 31 de julio de 2034.") && es[0].text.includes("3,85 km/s") && es[0].text.includes("C3 = 14"), "paso 1: «Sales de la Tierra el 31 de julio de 2034…»", es[0].text);
  ok(es[1].text.startsWith("Pasas por Venus el 5 de noviembre de 2034") && es[1].text.includes("te da 4,07 km/s respecto al Sol"), "sobrevuelo: «Pasas por Venus el … te da X km/s»", es[1].text);
  ok(/da 1 vuelta al Sol|das 1 vuelta al Sol/.test(es[1].text) && es[1].text.includes("Venus da 2"), "explica la órbita resonante 2:1", es[1].text);
  ok(es[3].text.includes("Pasas por la Tierra el 17 de agosto de 2037"), "la Tierra con artículo");
  ok(es[4].text.includes("enciendes el motor: 341 m/s"), "sobrevuelo propulsado: dice cuánto motor", es[4].text);
  ok(es[5].text.startsWith("Llegas a Saturno el 22 de noviembre de 2047, tras 13,3 años.") && es[5].text.includes("frenar al menos 150 m/s"), "llegada: «Llegas a Saturno el …, tras N años»", es[5].text);
  const en = narrate(D.best, "en", MGA.en, name("en"));
  ok(en[0].text.startsWith("You leave Earth on 31 July 2034.") && en[1].text.startsWith("You pass Venus on 5 November 2034") && en[5].text.startsWith("You reach Saturn on 22 November 2047, after 13.3 years."), "versión inglesa");
  const brake = clone(BEST); brake.flybys[0].helio_speed_gain_km_s = -3.2;
  const b = narrate(normalizeOption(brake), "es", MGA.es, name("es"));
  ok(b[1].text.includes("te frena 3,20 km/s") && b[1].text.includes("caer hacia Saturno"), "si el paso frena, lo dice");
  const bad = clone(EJS); bad.flybys[0].powered_delta_v_km_s = 1.2; bad.viable_without_dsm = false;
  const w = narrate(normalizeOption(bad), "es", MGA.es, name("es"));
  ok(w.at(-1).kind === "warning" && w.at(-1).text.includes("no es viable") && w.at(-1).text.includes("1,20 km/s"), "no viable: aviso honesto con el ΔV que pide");
  const today = clone(EJS); today.starts_today = true;
  ok(narrate(normalizeOption(today), "es", MGA.es, name("es"))[0].text.includes("hoy mismo"), "salida hoy: lo dice (la ventana ya está abierta)");
  const mars = normalizeMga(MARS);
  const ms = narrate(mars.best, "es", MGA.es, name("es"));
  ok(ms.length === 2 && ms[1].text.includes("órbita baja de 300 km"), "Marte directo: salida y llegada a órbita baja");
}

console.log("Línea de esferas y comparación");
{
  const c = chips(D.best, "es");
  ok(c.length === 6 && c[0].kind === "launch" && c.at(-1).kind === "arrival", "una ficha por paso");
  ok(c[0].dv === "3,85 km/s" && c[1].dv === "+4,07 km/s" && c[4].motor === "341 m/s" && c.at(-1).dv === "−150 m/s", "Δv de cada paso con signo", JSON.stringify(c.map((x) => x.dv)));
  ok(c.filter((x) => x.kind === "flyby").every((x) => x.sign === "gain"), "todos los sobrevuelos de esta ruta aceleran");
  ok(routeName(D.best.seq, name("es")) === "Tierra → Venus → Venus → Tierra → Júpiter → Saturno", "nombre de la ruta (ES)");
  ok(routeName(D.best.seq, name("en")) === "Earth → Venus → Venus → Earth → Jupiter → Saturn", "nombre de la ruta (EN)");
  const cmp = directComparison(D.best, D, "es", MGA.es);
  ok(cmp && cmp.includes("ahorras 3,40 km/s") && cmp.includes("C3 14 frente a 104,8") && cmp.includes("6,8 años más"), "frente al directo: ahorro y años de más", cmp);
  ok(directComparison(D.directBest, D, "es", MGA.es) === null, "el directo no se compara consigo mismo");
  ok(!cmp.includes("al llegar frenas"), "fuera de Mercurio no se habla del frenado");
  const mercD = clone(DIRECT); mercD.arrival = { v_inf_km_s: 11.8, delta_v_km_s: 9.62, kind: "low_orbit", orbit_altitude_km: 200 };
  const mercO = clone(EJS); mercO.arrival = { v_inf_km_s: 6.2, delta_v_km_s: 4.51, kind: "low_orbit", orbit_altitude_km: 200 };
  const M = normalizeMga({ ...SATURN, destination: "mercury", criterion: "injection_plus_powered_flybys_plus_insertion", best: mercO, options: [mercO, mercD], direct: { ...SATURN.direct, best: mercD } });
  const mc = directComparison(M.best, M, "es", MGA.es);
  ok(mc.includes("al llegar frenas 5,11 km/s menos"), "Mercurio: dice cuánto menos frenas al llegar", mc);
}

console.log("Tabla de alternativas");
{
  const rows = tableRows(D, "es");
  ok(rows.length === 3 && rows[0].best && !rows[1].best, "una fila por opción; la mejor marcada");
  ok(rows[0].dep === "31 jul 2034" && rows[0].depMonth === "jul 2034" && rows[0].dur === "13,3 años" && rows[0].inj === "3,85", "salida, duración y Δv de inyección", JSON.stringify(rows[0]));
  ok(rows[2].isDirect && rows[2].inj === "7,25" && rows[2].viable, "el directo, como referencia");
  const en = tableRows(D, "en");
  ok(en[1].dur === "9.2 years" && en[1].inj === "6.34", "EN");
  const mars = tableRows(normalizeMga(MARS), "es");
  ok(mars.map((r) => r.dep).join("|") === "14 nov 2026|25 nov 2028|18 ene 2031", "Marte: ventanas por fecha", mars.map((r) => r.dep).join("|"));
  ok(mars.every((r) => r.isDirect && r.viable), "Marte: todo directo");
}

console.log("Recorrido en el mapa (escala de Ruta)");
{
  const g = routeGeometry(D.best);
  ok(g.legs.length === 5 && g.legs.every((l) => /^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+)+$/.test(l.d)), "un trazo por tramo");
  ok(g.events.length === 6 && g.events[0].kind === "launch" && g.events.at(-1).kind === "arrival", "un marcador por encuentro");
  ok(g.orbits.filter((o) => o.on).map((o) => o.id).join() === "venus,earth,jupiter,saturn", "se resaltan las órbitas de la ruta");
  const p = toMap([1, 0]);
  ok(near(p.x, 50 + ORBIT_R(2), 1e-9) && near(p.y, 50, 1e-9), "1 UA cae justo en la órbita de la Tierra del mapa");
  const q = toMap([0, -5.2]);
  ok(near(Math.hypot(q.x - 50, q.y - 50), mapRadius(5.2), 1e-9) && q.y > 50, "ángulo real y radio comprimido (y hacia abajo)");
  const e = g.events[4];
  ok(near(Math.hypot(e.x - 50, e.y - 50), mapRadius(Math.hypot(-5.3317, -1.1348)), 1e-6), "Júpiter en su distancia al Sol del día del encuentro");
  ok(g.events.every((v) => v.x > 0 && v.x < 100 && v.y > 0 && v.y < 100), "todo dentro del mapa (hasta Saturno)");
  // Los dos pasos por Venus de la resonancia 2:1 caen en el mismo punto: un solo marcador «2·3»
  ok(g.markers.length === 5 && g.markers.some((m) => m.label === "2·3"), "marcadores que coinciden se fusionan («2·3»)", g.markers.map((m) => m.label).join());
  ok(g.markers.flatMap((m) => m.nums).join() === "1,2,3,4,5,6", "ningún encuentro se pierde al fusionar");
  const sep = groupMarkers([{ x: 10, y: 10, kind: "launch" }, { x: 20, y: 10, kind: "arrival" }]);
  ok(sep.length === 2 && sep[0].label === "1" && sep[1].label === "2", "marcadores separados no se fusionan");
}

console.log("Textos ES/EN");
{
  const keys = (o) => Object.keys(o).sort().join();
  ok(keys(MGA.es) === keys(MGA.en), "mismas claves en ES y EN");
  const p = { viable: "500 m/s", giant: true, withInsertion: false };
  ok(MGA.es.assumptions(p).length >= 8 && MGA.en.assumptions(p).length === MGA.es.assumptions(p).length, "supuestos en ES y EN");
  const all = JSON.stringify(MGA.es) + JSON.stringify(MGA.en) + MGA.es.assumptions(p).join() + MGA.en.assumptions(p).join();
  ok(!/\bundefined\b|\[object|TODO|XXX/.test(all), "sin marcadores olvidados");
  ok(MGA.es.assumptions(p).some((s) => s.includes("sin(δ/2) = 1/(1 + r_p·v∞²/μ)")), "cita la fórmula del ángulo de giro");
  ok(MGA.es.assumptions(p).some((s) => /anteproyecto/.test(s)) && MGA.en.assumptions(p).some((s) => /preliminary proposal/.test(s)), "dice que es un anteproyecto, no un plan de misión");
  ok(MGA.es.assumptions(p).some((s) => /cónicas empalmadas/.test(s)) && MGA.es.assumptions(p).some((s) => /baja precisión/.test(s)) && MGA.es.assumptions(p).some((s) => /25 años/.test(s)), "supuestos: cónicas empalmadas, efemérides de baja precisión, tope de 25 años");
  ok(MGA.es.assumptions({ ...p, withInsertion: true }).some((s) => /Mercurio/.test(s)), "Mercurio: explica el criterio");
  ok(MGA.es.sourceList.length >= 5 && MGA.es.sourceList.every((s) => /^https:\/\/(science\.nasa\.gov|pds-ppi\.igpp\.ucla\.edu|pds\.nasa\.gov|sci\.esa\.int|nssdc\.gsfc\.nasa\.gov)\//.test(s.url)), "fuentes de NASA, NASA PDS y ESA");
  ok(MGA.es.validation.includes("16,3 frente a 16,6") && MGA.en.validation.includes("16.3 vs 16.6"), "validación con Cassini visible");
  ok(MGA.es.directOnlyTitle.mars.includes("no ayudan") && MGA.en.directOnlyTitle.mars.includes("don't help"), "Marte: dice que las catapultas no ayudan");
  ok(MGA.es.jupiterBody({ date: "x", cycle: "20", dest: "Saturno", route: "r", years: "9 años" }).includes("cada unos 20 años"), "explica el ciclo de Júpiter");
  ok(MGA.es.thViable === "Viable" && MGA.es.altLead.includes("sin maniobras en espacio profundo"), "cabecera corta («Viable») explicada encima de la tabla");
  ok(MGA.es.computing(40).includes("40 %") && MGA.en.computing(40).includes("40%") && MGA.es.computing(0).includes("unos segundos"), "estado «calculando» amable");
}

console.log("Integración en App.jsx, componente, estilos y métricas");
{
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  ok(/import MgaPlanner from "\.\/route\/MgaPlanner\.jsx"/.test(app) && /import \{ MGA \} from "\.\/route\/i18n-mga\.js"/.test(app), "App importa la tarjeta y sus textos");
  const iGA = app.indexOf("<GravityAssists"), iM = app.indexOf("<MgaPlanner"), iWin = app.indexOf("<LaunchWindows");
  ok(iGA > 0 && iM > iGA && iM < iWin, "justo debajo de «Catapultas», en Ruta");
  ok(/<SectionBoundary name="Planifica tu viaje con catapultas"[^>]*>\s*<MgaPlanner from=\{from\} to=\{to\} lang=\{lang\}\/>/.test(app), "envuelta en SectionBoundary");
  ok(/!special && tab==="route" && \(<>[\s\S]*<MgaPlanner[\s\S]*<\/>\)/.test(app), "solo con destino planeta");
  const jsx = readFileSync(new URL("../src/route/MgaPlanner.jsx", import.meta.url), "utf8");
  ok(/role="status"/.test(jsx) && /role="alert"/.test(jsx) && /aria-live="polite"/.test(jsx), "estados accesibles (calculando, error)");
  ok(/<caption/.test(jsx) && /scope="col"/.test(jsx) && /aria-pressed=\{sel\}/.test(jsx), "tabla con encabezados y filas seleccionables");
  ok(/role="img"/.test(jsx) && /<title id=/.test(jsx), "el mapa tiene texto alternativo");
  ok(/trackNetError\("mga", e\)/.test(jsx) && /track\("mga_card"/.test(jsx), "métricas: mga_card y errores de red del endpoint mga");
  ok(!/kind: "(view|steps)"/.test(jsx), "solo kind: option o assumptions");
  const css = readFileSync(new URL("../src/route/route.css", import.meta.url), "utf8");
  ok(/\.mga-chips/.test(css) && /\.mga-steps/.test(css) && /\.mga-table/.test(css) && /min-height: 44px/.test(css), "estilos .mga* con objetivos táctiles de 44 px");
  const be = readFileSync(new URL("../backend/app/metrics.py", import.meta.url), "utf8");
  ok(/"mga_card":\s*\{"origin": BODIES, "destination": BODIES,\s*"state": \{"ok", "fail", "empty", "computing", "earth_only"\},\s*"kind": \{"option", "assumptions"\}\}/.test(be), "evento mga_card en la lista blanca del servidor");
  ok(/"iss_passes", "mga", "other"/.test(be), "endpoint mga para net_error");
  const pr = cleanParams({ origin: "earth", destination: "saturn", state: "ok", kind: "option", id: "EVVEJS-2034" });
  ok(pr.origin === "earth" && pr.state === "ok" && pr.kind === "option", "track.js admite origin, destination, state y kind");
  ok(metricParams({ destination: "saturn", state: "computing" }).state === "computing", "metricParams conserva state");
  const main = readFileSync(new URL("../backend/app/main.py", import.meta.url), "utf8");
  ok(/@app\.get\("\/api\/mga"\)/.test(main) && /status_code=202/.test(main) && /"Retry-After"/.test(main), "endpoint /api/mga con 202 y Retry-After");
  ok(/\("\/api\/mga", 3600\)/.test(main), "Cache-Control del endpoint");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
if (failed) process.exit(1);
