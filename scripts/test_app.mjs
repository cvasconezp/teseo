// Pruebas de las funciones puras de la app (Ruta, Ventanas, enlaces directos,
// analítica y "Ahora en el espacio"). Node puro, sin dependencias.
// Uso:  node scripts/test_app.mjs     (sale con código 1 si algo falla)
import { hohmannLocal, launchWindowsLocal, helioPosition, approxDistanceKm, AU_KM, SEMI_MAJOR_AXIS_AU } from "../src/ui/orbits.js";
import { DAY_MS, parseISO, daysUntil, durationParts, relParts, countdownParts } from "../src/ui/time.js";
import { parseHash, hashBelongsTo, hashForTab } from "../src/ui/hash.js";
import { track, cleanParams, hasConsent } from "../src/ui/track.js";
import {
  C_KM_S, LD_KM, EARTH_DIAMETER_KM, ldToKm, kmToLd, auToKm, signalSeconds, splitSeconds, spacecraftDistances,
  launchStatus, netPrecision, nextLaunch, sortByNet, orbitKey, diameterFromH, asteroidSize, sizeReference, SIZE_REFS,
  speedFacts, passDistance, niceMaxLd, asteroidLayout,
} from "../src/now/math.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, `→ obtuvo ${JSON.stringify(a)}, esperaba ${JSON.stringify(b)}`);

console.log("Hohmann local (src/ui/orbits.js)");
{
  const r = hohmannLocal("earth", "mars", new Date("2026-11-13T00:00:00Z"));
  ok(near(r.transfer_time_days, 258.9, 0.1), "Tierra→Marte: 258,9 días", String(r.transfer_time_days));
  ok(near(r.delta_v_total_km_s, 5.6, 0.05), "Tierra→Marte: Δv total 5,6 km/s", String(r.delta_v_total_km_s));
  ok(near(r.delta_v_departure_km_s, 2.94, 0.02) && near(r.delta_v_arrival_km_s, 2.65, 0.02), "Δv de salida ≈ 2,94 y de llegada ≈ 2,65 km/s", `${r.delta_v_departure_km_s} + ${r.delta_v_arrival_km_s}`);
  ok(near(r.delta_v_departure_km_s + r.delta_v_arrival_km_s, r.delta_v_total_km_s, 0.002), "Δv total = salida + llegada");
  ok(near(r.transfer_semi_major_axis_au, 1.262, 1e-9), "semieje mayor de la transferencia = 1,262 UA", String(r.transfer_semi_major_axis_au));
  ok(near((+new Date(r.arrival_date) - +new Date(r.departure_date)) / DAY_MS, r.transfer_time_days, 0.01), "llegada = salida + duración");
  ok(r.is_outbound === true && r.local === true, "marca is_outbound y local");
  const back = hohmannLocal("mars", "earth");
  ok(near(back.transfer_time_days, r.transfer_time_days, 1e-9) && near(back.delta_v_total_km_s, r.delta_v_total_km_s, 1e-9) && back.is_outbound === false, "Marte→Tierra: misma duración y Δv, sentido contrario");
  const v = hohmannLocal("earth", "venus");
  ok(near(v.transfer_time_days, 146, 1), "Tierra→Venus ≈ 146 días", String(v.transfer_time_days));
  const j = hohmannLocal("earth", "jupiter");
  ok(near(j.transfer_time_days / 365.25, 2.73, 0.02), "Tierra→Júpiter ≈ 2,73 años", String(j.transfer_time_days / 365.25));
  // 3.ª ley de Kepler: medio período de una órbita de 1 UA = medio año
  ok(near(0.5 * Math.pow(1, 1.5) * 365.2568983, 182.63, 0.01), "medio período a 1 UA = 182,63 días");
}

console.log("Ventanas de lanzamiento locales");
{
  const w = launchWindowsLocal("earth", "mars", new Date("2026-11-13T00:00:00Z"), 4);
  ok(w.windows.length === 4, "devuelve 4 ventanas");
  const first = new Date(w.windows[0].departure_date);
  const target = Date.UTC(2026, 11, 4);
  ok(Math.abs(+first - target) <= 2 * DAY_MS, "próxima ventana Tierra→Marte: 4-dic-2026 (±2 días, efemérides aproximadas)", first.toISOString());
  ok(near(w.synodic_period_days, 779.9, 0.5), "período sinódico Tierra–Marte ≈ 779,9 días", String(w.synodic_period_days));
  ok(near(w.required_phase_angle_deg, 44.3, 0.5), "ángulo de fase requerido ≈ 44°", String(w.required_phase_angle_deg));
  const gaps = w.windows.slice(1).map((x, i) => (+new Date(x.departure_date) - +new Date(w.windows[i].departure_date)) / DAY_MS);
  ok(gaps.every(g => g > 740 && g < 820), "las ventanas se repiten cada ~26 meses", gaps.map(g => g.toFixed(0)).join(", "));
  ok(w.windows.every(x => near(x.transfer_time_days, 258.9, 0.1) && near(x.delta_v_km_s, 5.6, 0.05)), "cada ventana lleva 258,9 días y Δv 5,6 km/s");
  ok(w.windows.every((x, i) => x.window_number === i + 1) && w.local === true, "numeradas y marcadas como cálculo local");
  // Ruta y Ventanas deben mostrar el mismo número de días (antes: "105" frente a "106")
  const ids = Object.keys(SEMI_MAJOR_AXIS_AU); let mismatch = [];
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    const route = hohmannLocal(a, b), win = launchWindowsLocal(a, b, new Date("2026-11-13T00:00:00Z"), 1);
    if (!win.windows.length) { mismatch.push(`${a}→${b}: sin ventana`); continue; }
    if (win.windows[0].transfer_time_days !== route.transfer_time_days) mismatch.push(`${a}→${b}: ${route.transfer_time_days} ≠ ${win.windows[0].transfer_time_days}`);
  }
  ok(mismatch.length === 0, "los 56 pares de planetas: la ventana lleva exactamente la misma duración que la ruta (2 decimales)", mismatch.slice(0, 4).join("; "));
  const em = hohmannLocal("earth", "mercury"), wm = launchWindowsLocal("earth", "mercury", new Date("2026-11-13T00:00:00Z"), 1).windows[0];
  ok(Math.round(em.transfer_time_days) === 105 && Math.round(wm.transfer_time_days) === 105, "Tierra→Mercurio: 105 días en Ruta y en Ventanas (ya no 105/106)", `${em.transfer_time_days} / ${wm.transfer_time_days}`);
  const same = launchWindowsLocal("earth", "mars", new Date("2026-11-13T00:00:00Z"), 4);
  eq(same.windows.map(x => x.departure_date), w.windows.map(x => x.departure_date), "determinista: misma entrada, mismas fechas");
}

console.log("Efemérides aproximadas");
{
  const d = new Date("2026-11-13T00:00:00Z");
  const e = helioPosition("earth", d), re = Math.hypot(e.x_au, e.y_au, e.z_au);
  ok(re > 0.983 && re < 1.017, "la Tierra está a ~1 UA del Sol", String(re));
  for (const id of ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"]) {
    const p = helioPosition(id, d), r = Math.hypot(p.x_au, p.y_au, p.z_au), a = SEMI_MAJOR_AXIS_AU[id];
    ok(Math.abs(r - a) / a < 0.22, `${id}: distancia al Sol dentro de su órbita (${r.toFixed(3)} UA)`);
  }
  const km = approxDistanceKm("earth", "mars", d);
  ok(km > 0.37 * AU_KM && km < 2.68 * AU_KM, "distancia Tierra–Marte entre 0,37 y 2,68 UA", String(km / AU_KM));
  ok(approxDistanceKm("earth", "earth", d) === 0, "distancia de un planeta a sí mismo = 0");
}

console.log("Fechas, duraciones y cuenta regresiva (src/ui/time.js)");
{
  ok(+parseISO("2026-12-04T09:10:00") === Date.UTC(2026, 11, 4, 9, 10), "fecha ISO sin zona se lee como UTC");
  ok(+parseISO("2026-12-04T09:10:00Z") === Date.UTC(2026, 11, 4, 9, 10), "con Z");
  ok(+parseISO("2026-12-04T09:10:00-05:00") === Date.UTC(2026, 11, 4, 14, 10), "con desfase −05:00");
  ok(+parseISO("2026-12-04") === Date.UTC(2026, 11, 4), "solo fecha");
  const d = new Date(); ok(parseISO(d) === d, "un Date se devuelve tal cual");
  const now = Date.UTC(2026, 10, 13, 15, 0);
  ok(daysUntil("2026-12-04T09:10:00", now) === 21, "13-nov → 4-dic-2026: faltan 21 días");
  ok(daysUntil("2026-11-13T23:59:00", now) === 0, "el mismo día: 0");
  ok(daysUntil("2026-11-14T00:01:00", now) === 1, "pasada la medianoche UTC: 1");
  ok(daysUntil("2020-01-01", now) === 0, "fecha pasada: nunca negativo");
  eq(durationParts(258.9), { n: 8, half: true, unit: "month" }, "258,9 días → 8 meses y medio");
  eq(durationParts(146), { n: 5, half: false, unit: "month" }, "146 días → 5 meses");
  eq(durationParts(30), { n: 30, half: false, unit: "day" }, "30 días → 30 días");
  eq(durationParts(0.2), { n: 1, half: false, unit: "day" }, "menos de un día → 1 día");
  eq(durationParts(997.6), { n: 2, half: true, unit: "year" }, "997,6 días (Júpiter) → 2 años y medio");
  eq(durationParts(365.25 * 30.6), { n: 31, half: false, unit: "year" }, "30,6 años → 31 años");
  eq(durationParts(357), { n: 11, half: true, unit: "month" }, "357 días → 11 meses y medio (no salta a 12 meses)");
  eq(durationParts(358), { n: 1, half: false, unit: "year" }, "358 días → 1 año");
  eq(relParts(21), { n: 21, unit: "day" }, "relativo: 21 días");
  eq(relParts(800), { n: 2.2, unit: "year" }, "relativo: 800 días → 2,2 años");
  eq(relParts(400), { n: 13, unit: "month" }, "relativo: 400 días → 13 meses");
  const t0 = Date.UTC(2026, 10, 13, 12, 0, 0);
  eq(countdownParts(t0 + ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000, t0), { past: false, total: 183845, d: 2, h: 3, m: 4, s: 5 }, "cuenta regresiva: 2 d 3 h 4 min 5 s");
  eq(countdownParts(t0 + 999, t0), { past: false, total: 0, d: 0, h: 0, m: 0, s: 0 }, "menos de un segundo: 0 s y aún no ha pasado");
  eq(countdownParts(t0 - 5000, t0), { past: true, total: 0, d: 0, h: 0, m: 0, s: 0 }, "instante pasado: past = true, nunca negativo");
  ok(countdownParts("no es fecha", t0) === null, "fecha inválida → null");
  ok(countdownParts("2026-11-13T12:00:10", t0).s === 10, "acepta ISO sin zona (UTC)");
}

console.log("Enlaces directos (src/ui/hash.js)");
{
  const cases = [
    ["#ventanas", "windows", false], ["#windows", "windows", false], ["#escala", "scale", false], ["#scale", "scale", false],
    ["#preguntas", "questions", false], ["#questions", "questions", false], ["#preguntas?drake=abc&kp=17.2", "questions", false],
    ["#preguntas?q=agujeros-negros", "questions", false], ["#questions?q=x", "questions", false],
    ["#sky", "sky", false], ["#sky?L=exoplanets&c=Ori", "sky", false], ["#cielo", "sky", false],
    ["#ruta", "route", false], ["#route", "route", false], ["#ahora", "windows", true], ["#now", "windows", true], ["#VENTANAS", "windows", false],
  ];
  for (const [h, tab, now] of cases) eq(parseHash(h), { tab, now }, `${h} → ${tab}${now ? " + Ahora" : ""}`);
  for (const h of ["", "#", "#otra", "#skyline", "#escalas", "#nowhere", "#preguntasx?q=1", null, undefined, "ventanas"]) ok(parseHash(h) === null, `${JSON.stringify(h)} no abre nada`);
  ok(hashBelongsTo("#sky?c=Ori", "sky") && !hashBelongsTo("#sky?c=Ori", "route") && !hashBelongsTo("", "route"), "hashBelongsTo distingue pestañas");
  eq([hashForTab("windows", "es"), hashForTab("windows", "en"), hashForTab("scale", "es"), hashForTab("scale", "en")], ["#ventanas", "#windows", "#escala", "#scale"], "hash canónico por idioma");
  eq([hashForTab("route", "es"), hashForTab("sky", "es"), hashForTab("questions", "es"), hashForTab("questions", "en")], ["", "#sky", "#preguntas", "#questions"], "portada sin hash; Cielo siempre #sky");
  eq([hashForTab("windows", "es", true), hashForTab("windows", "en", true)], ["#ahora", "#now"], "hash de Ahora en el espacio");
  for (const tab of ["windows", "scale", "questions", "sky"]) for (const lang of ["es", "en"]) ok(parseHash(hashForTab(tab, lang)).tab === tab, `ida y vuelta: ${tab}/${lang}`);
}

console.log("Analítica con consentimiento (src/ui/track.js)");
{
  const mk = (consent, withGtag = true) => {
    const calls = [];
    const win = { localStorage: { getItem: k => (k === "yd-consent" ? consent : null) } };
    if (withGtag) win.gtag = (...a) => calls.push(a);
    return { win, calls };
  };
  let w = mk("granted");
  ok(track("tab_change", { tab: "sky" }, w.win) === true && w.calls.length === 1, "con consentimiento: se envía");
  eq(w.calls[0], ["event", "tab_change", { tab: "sky" }], "forma del evento");
  w = mk("denied"); ok(track("tab_change", { tab: "sky" }, w.win) === false && w.calls.length === 0, "consentimiento denegado: no se envía");
  w = mk(null); ok(track("tab_change", { tab: "sky" }, w.win) === false && w.calls.length === 0, "sin respuesta al aviso: no se envía");
  w = mk("granted", false); ok(track("tab_change", { tab: "sky" }, w.win) === false, "sin window.gtag: no hace nada");
  ok(track("tab_change", { tab: "sky" }, undefined) === false, "sin window (SSR/Node): no hace nada");
  w = mk("granted"); ok(track("Evento Raro!", {}, w.win) === false && track("", {}, w.win) === false && w.calls.length === 0, "nombres de evento no válidos se descartan");
  eq(cleanParams({ tab: "sky", lat: -0.04, lon: -78.1, email: "a@b.c", name: "X", lang: "es", origin: "earth", destination: "mars" }), { tab: "sky", lang: "es", origin: "earth", destination: "mars" }, "solo viajan claves de la lista blanca (nada de ubicación ni datos personales)");
  eq(cleanParams({ tab: { a: 1 }, lang: ["es"], section: null, source: "x".repeat(100), state: true, id: 3 }), { source: "x".repeat(40), state: true, id: 3 }, "solo valores primitivos y cortos");
  eq(cleanParams(null), {}, "sin parámetros → {}");
  const boom = { localStorage: { getItem() { throw new Error("bloqueado"); } }, gtag() { throw new Error("x"); } };
  ok(track("tab_change", {}, boom) === false && hasConsent(boom) === false, "nunca lanza, aunque localStorage o gtag fallen");
}

console.log("Ahora en el espacio: distancias y señal (src/now/math.js)");
{
  ok(C_KM_S === 299792.458, "c = 299.792,458 km/s");
  ok(near(signalSeconds(AU_KM), 499.004784, 1e-5), "1 UA → 499,005 s (8 min 19 s)", String(signalSeconds(AU_KM)));
  ok(near(signalSeconds(LD_KM), 1.2822, 1e-4), "1 distancia lunar → 1,282 s", String(signalSeconds(LD_KM)));
  ok(near(signalSeconds(0.0098 * AU_KM), 4.890, 0.001), "0,0098 UA → 4,89 s");
  ok(near(signalSeconds(1.5 * AU_KM) / 60, 12.475, 0.001), "1,5 UA → 12,5 min");
  ok(signalSeconds(0) === 0, "distancia 0 → 0 s");
  eq(splitSeconds(499.004784), { h: 0, m: 8, s: 19 }, "499 s → 8 min 19 s");
  eq(splitSeconds(3725.4), { h: 1, m: 2, s: 5 }, "3.725 s → 1 h 2 min 5 s");
  eq(splitSeconds(59.6), { h: 0, m: 1, s: 0 }, "59,6 s redondea a 1 min 0 s");
  ok(ldToKm(1) === 384400 && ldToKm(10) === 3844000, "1 DL = 384.400 km; 10 DL = 3.844.000 km");
  ok(near(kmToLd(384400), 1, 1e-12) && near(kmToLd(auToKm(1)), 389.17, 0.01), "km → DL (1 UA ≈ 389,17 DL)", String(kmToLd(auToKm(1))));
  ok(near(kmToLd(ldToKm(2.37)), 2.37, 1e-12), "DL → km → DL es la identidad");
  ok(near(auToKm(0.00257), 384467, 1), "0,00257 UA ≈ 384.467 km");

  const d1 = spacecraftDistances({ dist_au: 0.0098, dist_km: 1466059, sun_dist_au: 0.9891 });
  ok(d1.earthKm === 1466059 && near(d1.sunKm, 0.9891 * AU_KM, 1) && !d1.fromLightTime, "nave: gana dist_km; Sol desde UA");
  ok(near(spacecraftDistances({ dist_au: 2 }).earthKm, 2 * AU_KM, 1), "nave: solo dist_au (forma de /api/probes)");
  const real = spacecraftDistances({ dist_au: 0.045, dist_km: 6725692, light_min: 0.4, sun_dist_au: 0.9944, sun_dist_km: 148759815, earth_dist_au: 0.045, earth_dist_km: 6725692 });
  ok(real.earthKm === 6725692 && real.sunKm === 148759815 && near(signalSeconds(real.earthKm), 22.43, 0.01), "nave: forma real de /api/missions/mars (MMX a 6,7 millones de km → 22,4 s de señal)", JSON.stringify(real));
  ok(near(spacecraftDistances({ distance_from_earth_au: 0.5, distance_from_sun_au: 1.2 }).sunKm, 1.2 * AU_KM, 1), "nave: nombres largos");
  ok(near(spacecraftDistances({ position: { dist_au: 0.3 } }).earthKm, 0.3 * AU_KM, 1), "nave: distancia anidada en position");
  const d2 = spacecraftDistances({ light_min: 4.2 });
  ok(d2.fromLightTime && near(signalSeconds(d2.earthKm), 252, 1e-6), "nave: solo light_min → 4,2 min de señal");
  eq(spacecraftDistances({ name: "x" }), { earthKm: null, sunKm: null, fromLightTime: false }, "nave sin distancia → null (no se inventa)");
  eq(spacecraftDistances({ dist_au: null, dist_km: "", sun_dist_au: "abc" }), { earthKm: null, sunKm: null, fromLightTime: false }, "null, vacío o texto → null");
  eq(spacecraftDistances(null), { earthKm: null, sunKm: null, fromLightTime: false }, "objeto nulo → null");
  ok(spacecraftDistances({ dist_km: "1500000" }).earthKm === 1500000, "número como cadena");
  ok(spacecraftDistances({ dist_km: -5 }).earthKm === null, "distancia negativa → null");
}

console.log("Ahora en el espacio: lanzamientos");
{
  const st = [["Go", "go"], ["TBC", "tbc"], ["TBD", "tbd"], ["Hold", "hold"], ["Success", "success"], ["Failure", "failure"], ["In Flight", "flight"], ["Partial Failure", "partial"], [1, "go"], [2, "tbd"], [8, "tbc"], ["8", "tbc"]];
  for (const [s, k] of st) ok(launchStatus({ status: s }) === k, `estado ${JSON.stringify(s)} → ${k}`);
  ok(launchStatus({ status: "X", status_name: "Go for Launch" }) === "go", "deduce del nombre largo: Go for Launch");
  ok(launchStatus({ status_name: "To Be Confirmed" }) === "tbc" && launchStatus({ status_name: "To Be Determined" }) === "tbd", "nombres largos TBC / TBD");
  ok(launchStatus({ status: { id: 1, abbrev: "Go" } }) === "go", "estado como objeto");
  ok(launchStatus({ status: "Weird", status_name: "Some New Status" }) === null && launchStatus({}) === null && launchStatus(null) === null, "estado desconocido → null (se muestra tal cual, sin adivinar)");
  eq(["Second", "Minute", "Hour", "Day", "Month", "Quarter", "Year", null, undefined].map(p => netPrecision({ net_precision: p })), ["time", "time", "time", "day", "month", "vague", "vague", "time", "time"], "precisión de la fecha");
  ok(netPrecision({ net_precision: { name: "Day" } }) === "day", "precisión como objeto");
  const now = Date.UTC(2026, 10, 13, 12);
  const iso = h => new Date(now + h * 3600000).toISOString();
  const L = [
    { id: "c", net: iso(30), status: "Go", net_precision: "Minute" },
    { id: "past", net: iso(-1), status: "Go" },
    { id: "day", net: iso(2), status: "TBD", net_precision: "Day" },
    { id: "flown", net: iso(1), status: "Success" },
    { id: "b", net: iso(5), status: "TBC", net_precision: "Second" },
    { id: "bad", net: "nope", status: "Go" },
  ];
  ok(nextLaunch(L, now).id === "b", "siguiente = el primero futuro con hora fiable y sin despegar");
  ok(nextLaunch([], now) === null && nextLaunch(null, now) === null && nextLaunch([L[1], L[2]], now) === null, "sin candidatos → null");
  eq(sortByNet(L).map(l => l.id), ["past", "flown", "day", "b", "c", "bad"], "orden cronológico; fechas inválidas al final");
  eq(["Low Earth Orbit", "LEO", "Sun-Synchronous Orbit", "SSO", "Geostationary Transfer Orbit", "GTO", "Geostationary Orbit", "Medium Earth Orbit", "Polar Orbit", "Lunar Orbit", "Mars Orbit", "Heliocentric N/A", "Suborbital", "Exotic Orbit", "", null].map(orbitKey),
    ["leo", "leo", "sso", "sso", "gto", "gto", "geo", "meo", "polar", "lunar", "mars", "helio", "sub", null, null, null], "órbitas → clave de diccionario (desconocida → null)");
}

console.log("Ahora en el espacio: asteroides");
{
  ok(near(diameterFromH(22, 0.25), 105.8, 0.1) && near(diameterFromH(22, 0.05), 236.6, 0.1), "H = 22 → 106–237 m (tabla de CNEOS: 110–240 m)", `${diameterFromH(22, 0.25)} – ${diameterFromH(22, 0.05)}`);
  ok(near(diameterFromH(17.75, 0.14), 1000, 10), "H = 17,75 con albedo 0,14 → 1 km (definición de asteroide de 1 km)", String(diameterFromH(17.75, 0.14)));
  eq(asteroidSize({ diameter_m: 330, diameter_est_m: [1, 2], h: 18 }), { min: 330, max: 330, estimated: false, basis: "measured" }, "tamaño: gana el diámetro medido");
  eq(asteroidSize({ diameter_m: null, diameter_est_m: [31, 14], h: 26 }), { min: 14, max: 31, estimated: true, basis: "source" }, "tamaño: estimación de la fuente (ordenada)");
  const fromH = asteroidSize({ diameter_m: null, diameter_est_m: null, h: 22 });
  ok(fromH.estimated && fromH.basis === "h" && near(fromH.min, 105.8, 0.1) && near(fromH.max, 236.6, 0.1), "tamaño: sin estimación, sale del brillo (H) y se marca como estimado");
  ok(asteroidSize({ diameter_m: null, diameter_est_m: null, h: null }) === null && asteroidSize({}) === null && asteroidSize(null) === null, "sin datos → null (\"tamaño no publicado\")");
  ok(asteroidSize({ diameter_est_m: [0, 5], h: null }) === null, "estimación con ceros no vale");
  eq([4, 12, 30, 70, 110, 240, 330, 900, 9000].map(m => sizeReference(m).key), ["car", "bus", "whale", "airliner", "pitch", "stadium", "eiffel", "burj", "everest"], "referencia cotidiana más cercana");
  ok(sizeReference(24).key === "whale" && near(sizeReference(24).ratio, 24 / 27, 1e-12), "24 m → ballena azul, ratio 0,89");
  ok(sizeReference(0) === null && sizeReference(-3) === null, "tamaño no positivo → null");
  ok(SIZE_REFS.every((r, i) => i === 0 || r.m > SIZE_REFS[i - 1].m), "referencias ordenadas de menor a mayor");
  const sp = speedFacts(12.4);
  ok(sp.kmh === 44640 && near(sp.airliners, 49.6, 1e-9), "12,4 km/s = 44.640 km/h ≈ 50 aviones comerciales");
  ok(speedFacts(0) === null && speedFacts(NaN) === null, "velocidad no válida → null");
  const p = passDistance({ dist_ld: 0.62, dist_km: 238328 });
  ok(p.ld === 0.62 && p.km === 238328 && near(p.earths, 18.7, 0.05), "paso a 0,62 DL = 238.328 km ≈ 18,7 diámetros terrestres", String(p.earths));
  ok(passDistance({ dist_ld: 3.3, dist_km: null }).km === 3.3 * 384400, "solo DL → km");
  ok(near(passDistance({ dist_km: 768800 }).ld, 2, 1e-12), "solo km → DL");
  ok(near(passDistance({ dist_au: 0.01 }).ld, 3.8917, 1e-3), "solo UA → DL");
  ok(passDistance({ dist_ld: null, dist_km: null, dist_au: null }) === null && passDistance(null) === null, "sin distancia → null");
  ok(EARTH_DIAMETER_KM === 12742 && near(LD_KM / EARTH_DIAMETER_KM, 30.17, 0.01), "la Luna está a ~30 diámetros terrestres");
  eq([0.5, 2, 2.1, 5, 9.9, 10, 10.5, 37, 120].map(niceMaxLd), [2, 2, 5, 5, 10, 10, 20, 50, 200], "tope redondo del gráfico");
  const lay = asteroidLayout([1, 5, 10, 12], 10);
  ok(lay.every((q, i) => near(Math.hypot(q.x, q.y), Math.min(1, [1, 5, 10, 12][i] / 10), 1e-12)), "gráfico: el radio de cada punto es proporcional a su distancia (escala lineal)");
  ok(near(lay[0].x, 0, 1e-12) && lay[0].y < 0, "gráfico: el primero arriba; los demás repartidos");
  ok(new Set(lay.map(q => Math.atan2(q.y, q.x).toFixed(3))).size === 4, "gráfico: ángulos distintos");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
