// Pruebas de "¿Y la Luna? ¿Y el Sol?" (src/special/). Node puro, sin dependencias.
// Comprueba las cifras físicas con tolerancias, el modelo lunar contra JPL
// Horizons y USNO, los textos ES/EN y la integración en App.jsx.
// Uso:  node scripts/test_special_moonsun.mjs     (sale con código 1 si algo falla)
import { readFileSync } from "node:fs";
import {
  MU_EARTH, R_EARTH, LEO_ALT_KM, MU_SUN, AU_KM, R_SUN, MOON_A_KM, MU_MOON, R_MOON, C_KM_S, MARS_AU,
  circularSpeed, escapeSpeed, visViva, departureDv, moonTrip, fastMoonTli, timeToRadiusS, sunTrip,
  moonState, phaseKey, nextPhase, moonToday, PHASE_KEYS,
} from "../src/special/math.js";
import { hohmannLocal, SEMI_MAJOR_AXIS_AU } from "../src/ui/orbits.js";
import { TS } from "../src/special/i18n.js";
import { cleanParams, metricParams } from "../src/ui/track.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log("Constantes (fuentes citadas en math.js)");
{
  ok(MU_EARTH === 398600.4418 && R_EARTH === 6378.137 && LEO_ALT_KM === 185, "Tierra: μ⊕ = 398600,4418 km³/s², R⊕ = 6378,137 km, LEO 185 km");
  ok(MU_SUN === 1.32712440018e11 && AU_KM === 149597870.7 && R_SUN === 695700, "Sol: μ☉ = 1,32712440018e11, UA = 149597870,7 km, R☉ = 695700 km");
  ok(MOON_A_KM === 384400 && MU_MOON === 4902.8 && R_MOON === 1737.4, "Luna: a = 384400 km, μ = 4902,8, R = 1737,4 km");
  ok(MARS_AU === SEMI_MAJOR_AXIS_AU.mars, "Marte con el mismo semieje que Ruta (1,524 UA)");
}

console.log("Fórmulas básicas");
{
  ok(near(circularSpeed(MU_EARTH, R_EARTH + 185), 7.793, 0.001), "v circular a 185 km = 7,793 km/s");
  ok(near(escapeSpeed(MU_EARTH, R_EARTH + 185), 11.021, 0.001), "v escape a 185 km = 11,021 km/s");
  ok(near(escapeSpeed(MU_EARTH, R_EARTH + 185) / circularSpeed(MU_EARTH, R_EARTH + 185), Math.SQRT2, 1e-12), "v_esc = √2 · v_circ");
  ok(near(visViva(MU_EARTH, 7000, 7000), circularSpeed(MU_EARTH, 7000), 1e-12), "vis-viva con r = a da la circular");
  ok(near(departureDv(0), escapeSpeed(MU_EARTH, R_EARTH + 185) - circularSpeed(MU_EARTH, R_EARTH + 185), 1e-12), "v∞ = 0 → Δv = v_esc − v_circ (3,23 km/s)");
  ok(near(circularSpeed(MU_SUN, AU_KM), 29.78, 0.01), "v⊕ heliocéntrica ≈ 29,78 km/s");
  // coherencia con Ruta: el v∞ de salida a Marte coincide con el Δv de salida de hohmannLocal
  ok(near(sunTrip().vInfMars, hohmannLocal("earth", "mars").delta_v_departure_km_s, 0.002), "v∞ a Marte = Δv de salida de Ruta (2,946 km/s)", String(sunTrip().vInfMars));
}

console.log("Luna: Hohmann LEO → distancia lunar");
{
  const m = moonTrip();
  ok(near(m.tliDv, 3.1, 0.06), "Δv de inyección translunar ≈ 3,1 km/s", m.tliDv.toFixed(4));
  ok(near(m.tliDv, 3.135, 0.001), "TLI exacto del modelo: 3,135 km/s");
  ok(near(m.tofDays, 5, 0.05), "viaje mínimo ≈ 5 días (media elipse)", m.tofDays.toFixed(3));
  ok(near(m.tofDays, 4.978, 0.002), "duración exacta: 4,98 días");
  ok(near(m.vMoon, 1.018, 0.001) && near(m.vApogee, 0.187, 0.001), "Luna a 1,018 km/s; nave en el apogeo a 0,187 km/s");
  ok(near(m.vInf, 0.832, 0.001), "v∞ al llegar a la Luna = 0,832 km/s");
  ok(m.loiDv >= 0.8 && m.loiDv <= 0.9, "inserción en órbita lunar de 100 km entre 0,8 y 0,9 km/s", m.loiDv.toFixed(4));
  ok(near(m.loiDv, 0.822, 0.001), "LOI exacto del modelo: 0,822 km/s");
  ok(near(m.totalDv, m.tliDv + m.loiDv, 1e-12), "Δv total = TLI + LOI");
  ok(near(m.lightS, 1.28, 0.005), "la luz tarda 1,28 s a la distancia media", m.lightS.toFixed(4));
  ok(near(384400 / C_KM_S, 1.2822, 1e-4), "384400 / c = 1,2822 s");
  // a la distancia lunar, el tiempo del modelo rápido coincide con la Hohmann si el apogeo = Luna
  ok(near(timeToRadiusS(R_EARTH + 185, MOON_A_KM, MOON_A_KM) / 86400, m.tofDays, 1e-6), "Kepler: perigeo → apogeo = medio período");
}

console.log("Luna: trayectoria rápida tipo Apolo 11");
{
  // NASA, Apollo 11 Mission Overview: TLI a las 2 h 44 min; órbita lunar a ~75 h 50 min
  const coast = (75 + 50 / 60) - (2 + 44 / 60);
  ok(near(coast, 73.1, 0.01), "Apolo 11: unas 73 h entre la TLI y la órbita lunar");
  const fast = fastMoonTli(coast), base = moonTrip().tliDv;
  ok(fast > base && fast - base < 0.05, "llegar en 73 h cuesta apenas más Δv (< 0,05 km/s)", `${fast.toFixed(4)} vs ${base.toFixed(4)}`);
  ok(near(fast, 3.157, 0.002), "TLI para 73 h = 3,157 km/s");
  ok(fastMoonTli(48) > fastMoonTli(73) && fastMoonTli(73) > fastMoonTli(100), "más rápido → más Δv (monótono)");
  ok(fastMoonTli(200) === base && fastMoonTli(-1) === base, "más lento que la Hohmann o tiempo no válido → TLI de la Hohmann");
}

console.log("Sol: Hohmann 1 UA → superficie solar");
{
  const s = sunTrip();
  ok(near(s.vEarth, 29.78, 0.01), "v⊕ = 29,78 km/s");
  ok(near(s.vAphelion, 2.86, 0.01), "v en el afelio de la elipse = 2,86 km/s", s.vAphelion.toFixed(4));
  ok(near(s.vInf, 26.9, 0.05), "velocidad que hay que quitar ≈ 26,9 km/s", s.vInf.toFixed(4));
  ok(near(s.dvLeo, 21.3, 0.05), "Δv desde LEO ≈ 21,3 km/s", s.dvLeo.toFixed(4));
  ok(near(s.tofDays, 65, 0.1), "caída de la media elipse ≈ 65 días", s.tofDays.toFixed(3));
  ok(near(s.vEscSun, 42.1, 0.05), "escape solar a 1 UA ≈ 42,1 km/s", s.vEscSun.toFixed(4));
  ok(near(s.vInfEscape, 12.3, 0.05), "v∞ para escapar ≈ 12,3 km/s", s.vInfEscape.toFixed(4));
  ok(near(s.dvEscapeLeo, 8.75, 0.01), "Δv desde LEO para salir del sistema solar = 8,75 km/s", s.dvEscapeLeo.toFixed(4));
  ok(near(s.dvMarsLeo, 3.6, 0.05), "Δv desde LEO hacia Marte ≈ 3,6 km/s (mismo método)", s.dvMarsLeo.toFixed(4));
  ok(s.dvMarsLeo < s.dvEscapeLeo && s.dvEscapeLeo < s.dvLeo, "orden: Marte < salir del sistema solar < tocar el Sol");
  ok(near(s.vEscSun, Math.SQRT2 * s.vEarth, 1e-9), "v_esc solar = √2 · v⊕");
}

console.log("La Luna hoy frente a JPL Horizons (geocéntrica, centro a centro)");
{
  // JPL Horizons, consulta del 2026-11-13: COMMAND=301, CENTER=500@399, QUANTITIES=10,20
  // [fecha UTC, distancia km (delta·UA), fracción iluminada]
  const HZ = [["2026-01-01T00:00", 361045, 0.914], ["2026-02-07T00:00", 395907, 0.7355], ["2026-03-16T00:00", 387631, 0.1072], ["2026-04-22T00:00", 366693, 0.2696], ["2026-05-29T00:00", 402996, 0.9481], ["2026-07-05T00:00", 391933, 0.7798], ["2026-08-11T00:00", 363467, 0.0429], ["2026-09-17T00:00", 401381, 0.3272], ["2026-10-24T00:00", 378671, 0.94], ["2026-11-30T00:00", 371465, 0.6389], ["2027-01-06T00:00", 406002, 0.0316], ["2027-02-12T00:00", 386002, 0.2602], ["2027-03-21T00:00", 368314, 0.9722], ["2027-04-27T00:00", 403634, 0.6722], ["2027-06-03T00:00", 371539, 0.0473], ["2027-07-10T00:00", 376871, 0.4167], ["2027-08-16T00:00", 406038, 0.9847], ["2027-09-22T00:00", 378964, 0.6568], ["2027-10-29T00:00", 374962, 0.0059], ["2027-12-05T00:00", 404441, 0.3867], ["2028-01-11T00:00", 363902, 0.9799], ["2028-02-17T00:00", 383497, 0.5369], ["2028-03-25T00:00", 404460, 0.0143], ["2028-05-01T00:00", 374001, 0.378], ["2028-06-07T00:00", 382586, 0.9984], ["2028-07-14T00:00", 402387, 0.5852], ["2028-08-20T00:00", 359375, 0.0035], ["2028-09-26T00:00", 391058, 0.5473], ["2028-11-02T00:00", 400100, 0.9969], ["2028-12-09T00:00", 370897, 0.5281]];
  let maxD = 0, maxI = 0;
  for (const [iso, km, il] of HZ) {
    const s = moonState(new Date(`${iso}Z`));
    maxD = Math.max(maxD, Math.abs(s.distKm - km)); maxI = Math.max(maxI, Math.abs(s.illum - il));
  }
  ok(maxD < 1000, "distancia: error máximo < 1.000 km en 30 fechas 2026–2028", `${maxD.toFixed(0)} km`);
  ok(maxI < 0.005, "fracción iluminada: error < 0,5 puntos", maxI.toFixed(4));
  const d = moonState(new Date("2026-11-13T12:00:00Z")).distKm;
  ok(d > 356000 && d < 407500, "hoy (13-nov-2026) la distancia cae en el rango típico", d.toFixed(0));
}

console.log("Fases frente al Observatorio Naval de EE. UU. (USNO)");
{
  // aa.usno.navy.mil/api/moon/phases/date?date=2026-01-01&nump=60 (UTC)
  const USNO = [["full", "2026-01-03T10:03"], ["new", "2026-01-18T19:52"], ["full", "2026-02-01T22:09"], ["new", "2026-02-17T12:01"], ["full", "2026-03-03T11:38"], ["new", "2026-03-19T01:23"], ["full", "2026-04-02T02:12"], ["new", "2026-04-17T11:52"], ["full", "2026-05-01T17:23"], ["new", "2026-05-16T20:01"], ["full", "2026-05-31T08:45"], ["new", "2026-06-15T02:54"], ["full", "2026-06-29T23:56"], ["new", "2026-07-14T09:43"], ["full", "2026-07-29T14:36"], ["new", "2026-08-12T17:37"], ["full", "2026-08-28T04:18"], ["new", "2026-09-11T03:27"], ["full", "2026-09-26T16:49"], ["new", "2026-10-10T15:50"], ["full", "2026-10-26T04:12"], ["new", "2026-11-09T07:02"], ["full", "2026-11-24T14:53"], ["new", "2026-12-09T00:52"], ["full", "2026-12-24T01:28"], ["new", "2027-01-07T20:24"], ["full", "2027-01-22T12:17"], ["new", "2027-02-06T15:56"], ["full", "2027-02-20T23:23"], ["new", "2027-03-08T09:29"]];
  let maxMin = 0;
  for (const [kind, iso] of USNO) {
    const t = Date.parse(`${iso}Z`);
    const got = nextPhase(new Date(t - 5 * 86400000), kind === "new" ? 0 : 180);
    maxMin = Math.max(maxMin, got ? Math.abs(+got - t) / 60000 : Infinity);
  }
  ok(maxMin <= 15, "30 lunas nuevas y llenas: error ≤ 15 min (la interfaz dice «unos 15 minutos»)", `${maxMin.toFixed(1)} min`);
  const today = moonToday(new Date("2026-11-13T12:00:00Z"));
  ok(near(+today.nextFull, Date.parse("2026-11-24T14:53Z"), 15 * 60000), "desde el 13-nov-2026: próxima llena el 24-nov ~14:53 UTC");
  ok(near(+today.nextNew, Date.parse("2026-12-09T00:52Z"), 15 * 60000), "desde el 13-nov-2026: próxima nueva el 9-dic ~00:52 UTC");
  ok(today.phase === "waxingCrescent" && today.waxing && today.illum > 0.1 && today.illum < 0.25, "13-nov-2026: creciente, ~16 % iluminada", `${today.phase} ${today.illum.toFixed(3)}`);
  ok(near(today.lightS, today.distKm / C_KM_S, 1e-12), "tiempo de luz de hoy = distancia / c");
  ok(nextPhase(new Date("2026-11-24T15:30:00Z"), 180) > new Date("2026-12-20T00:00:00Z"), "justo después de una llena, la siguiente es la del mes próximo");
}

console.log("Nombre de la fase");
{
  ok([0, 359, 22].every(e => phaseKey(e) === "new") && phaseKey(23) === "waxingCrescent", "Luna nueva: ±22,5°");
  ok(phaseKey(90) === "firstQuarter" && phaseKey(180) === "full" && phaseKey(270) === "lastQuarter" && phaseKey(-90) === "lastQuarter", "cuartos y llena");
  ok(PHASE_KEYS.length === 8 && new Set(PHASE_KEYS).size === 8, "8 fases distintas");
}

console.log("Textos ES/EN");
{
  const keys = o => Object.keys(o).sort().join(",");
  ok(keys(TS.es) === keys(TS.en), "mismas claves en ES y EN");
  ok(keys(TS.es.phases) === keys(TS.en.phases) && PHASE_KEYS.every(k => TS.es.phases[k] && TS.en.phases[k]), "las 8 fases tienen nombre en ES y EN");
  let bad = [];
  for (const lang of ["es", "en"]) for (const [k, v] of Object.entries(TS[lang])) {
    if (typeof v === "function") { const out = v("1", "2", "3"); if (typeof out !== "string" || !out.trim() || /undefined/.test(out)) bad.push(`${lang}.${k}`); }
    else if (typeof v === "string" && !v.trim()) bad.push(`${lang}.${k}`);
  }
  ok(bad.length === 0, "todas las entradas producen texto", bad.join(", "));
  ok(/cambio de velocidad que debe dar el cohete/.test(TS.es.dvExplain) && /change in speed the rocket must make/.test(TS.en.dvExplain), "Δv explicado en palabras");
  ok(/185/.test(TS.es.moonAssume("185", "384.400", "100")) && /Supuestos/.test(TS.es.sunAssume("185", "695.700")), "líneas de supuestos visibles");
  ok(/12 de agosto de 2018/.test(TS.es.parker) && /7 sobrevuelos de Venus/.test(TS.es.parker) && /24 de diciembre de 2024/.test(TS.es.parker) && /6,1 millones de km/.test(TS.es.parker) && /692\.000 km\/h/.test(TS.es.parker), "Parker (NASA/JHU): 12-ago-2018, 7 Venus, 24-dic-2024, 6,1 M km, 692.000 km/h");
  ok(/August 12, 2018/.test(TS.en.parker) && /6\.1 million km/.test(TS.en.parker) && /692,000 km\/h/.test(TS.en.parker), "Parker en EN con las mismas cifras");
  ok(/16 de julio de 1969/.test(TS.es.apolloBody("73", "3,16", "0,02")) && /19 de julio/.test(TS.es.apolloBody("73", "3,16", "0,02")), "Apolo 11 (NASA): 16-jul-1969 → 19-jul");
  ok(/90 minutos/.test(TS.es.moonWhen3) && /dos semanas/.test(TS.es.moonWhen3), "Artemis I (NASA): 90 min a oscuras, ~2 semanas de oportunidades");
}

console.log("Métricas");
{
  eq(metricParams({ destination: "moon", kind: "view" }), { destination: "moon", kind: "view" }, "special_dest pasa la lista blanca del cliente (destination, kind)");
  ok(!("dest" in cleanParams({ dest: "moon" })), "la clave «dest» no está permitida: por eso se usa «destination»");
  const py = readFileSync(new URL("../backend/app/metrics.py", import.meta.url), "utf8");
  ok(/"special_dest":\s*\{"destination": SPECIAL_DESTS, "kind": SPECIAL_KINDS\}/.test(py) && /SPECIAL_DESTS = \{"moon", "sun"\}/.test(py) && /SPECIAL_KINDS = \{"view", "link", "venus", "pick"\}/.test(py), "el backend admite special_dest con los mismos valores");
}

console.log("Integración en App.jsx (Luna y Sol como destinos especiales)");
{
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  ok(/const SPECIALS = \[/.test(app) && /id:"moon"/.test(app) && /id:"sun"/.test(app), "Luna y Sol están en el selector de destino (SPECIALS)");
  ok(/special=\{special\} onSpecial=\{pickSpecial\}/.test(app), "el selector de destino ofrece los destinos especiales");
  ok(/\{special && \(tab==="route" \|\| tab==="windows"\) && \(/.test(app) && /<MoonSun lang=\{lang\} only=\{special\.id\}/.test(app), "con Luna o Sol elegidos, Ruta y Ventanas muestran solo su tarjeta");
  ok(/\{!special && tab==="windows" && \(\s*\n\s*<LaunchWindows/.test(app), "las ventanas de planetas no muestran la Luna ni el Sol sin elegirlos");
  ok(/const PLANETS = \[\n(\s+\{ id:"\w+".*\},\n){8}\];/.test(app), "PLANETS sigue con sus 8 planetas");
  ok(/setFrom\(PLANETS\[2\]\)/.test(app.slice(app.indexOf("const pickSpecial"), app.indexOf("const pickDest"))), "la Luna y el Sol se calculan siempre desde la Tierra");
}

function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name, `→ obtuvo ${JSON.stringify(a)}, esperaba ${JSON.stringify(b)}`); }

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
