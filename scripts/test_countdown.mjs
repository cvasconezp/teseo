// Pruebas de «Hitos del espacio», «cuánto falta» y «Lo próximo» del Calendario del cielo.
// Uso:  TZ=America/Guayaquil node scripts/test_countdown.mjs   (el script fija la zona horaria él mismo)
//
// Referencias:
//  · NASA, «Where Are Voyager 1 and Voyager 2 Now?»: la Voyager 1 llega a 1 día-luz el 18-nov-2026 a las
//    2:16:07 a.m. PST (10:16:07 UTC), a 25 902 068 356 km.
//  · USNO, estaciones 2026: solsticio de diciembre el 21-dic-2026 a las 20:50 UTC.
//  · IMO: Gemínidas, máximo el 14 de diciembre, THZ 150 (catálogo de la app, public/meteorshowers.json).
process.env.TZ = "America/Guayaquil";
import { readFileSync } from "node:fs";
const { MILESTONES, milestoneEvents } = await import("../src/now/calendar/milestones.js");
const { buildSkyEvents, nextHighlight, isHighlight, TYPES } = await import("../src/now/calendar/events.js");
const { countdownText, countdownParts, startOfEvent, dayStart } = await import("../src/now/calendar/countdown.js");
const { describeEvent, TC } = await import("../src/now/calendar/i18n.js");

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  ok   ", msg); } else { fail++; console.log("  FALLA", msg); } };
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const showers = JSON.parse(readFileSync(new URL("../public/meteorshowers.json", import.meta.url), "utf8")).objects;
const fmt = { time: (ms) => new Date(ms).toISOString().slice(11, 16), n: (x, d = 0) => Number(x).toFixed(d), pct: (x) => `${Math.round(x * 100)} %`, mag: "magnitud" };

console.log("Hitos del espacio");
const v1 = MILESTONES.find(m => m.id === "voyager1-lightday");
ok(v1 && v1.t === Date.UTC(2026, 10, 18, 10, 16, 7), "Voyager 1 a 1 día-luz: 18-nov-2026 10:16:07 UTC (05:16:07 en Ecuador), como la NASA");
ok(v1 && v1.km === 25902068356 && Math.abs(v1.km - 299792.458 * 86400) < 100, "la distancia es la de la NASA (25 902 068 356 km) y equivale a un día-luz (c × 86 400 s)");
ok(MILESTONES.every(m => /^https:\/\/science\.nasa\.gov\//.test(m.source)), "cada hito trae su fuente oficial de la NASA");
ok(TYPES.includes("milestone") && TC.es.types.milestone === "Hitos" && TC.en.types.milestone === "Milestones", "categoría «Hitos» en el filtro (ES/EN)");
const today0 = new Date(2026, 10, 18).getTime();                       // medianoche del 18-nov en Ecuador
const sky = buildSkyEvents({ from: today0, days: 30, lat: 0, lon: -78.43, showers });
const vEv = sky.find(e => e.id === "milestone-voyager1-lightday");
ok(!!vEv && vEv.type === "milestone", "desde el comienzo de hoy, el hito de la Voyager aparece en la agenda aunque ya pasó");
const vInfo = describeEvent(vEv, "es", fmt);
ok(/Voyager 1 llega a 1 día-luz/.test(vInfo.title) && /25,9 mil millones de km|25.9 mil millones de km/.test(vInfo.what) && vInfo.links[0].href === v1.source, "título, distancia y enlace a la NASA");
ok(vInfo.sky === "#sky?o=probes~Voyager%201", "«Ver en el cielo» abre la Voyager 1 en el Cielo");
ok(milestoneEvents(Date.UTC(2027, 7, 20, 15), Date.UTC(2027, 8, 30)).some(e => e.id === "milestone-voyager2-50y"), "un aniversario sigue apareciendo durante su día");
ok(milestoneEvents(Date.UTC(2026, 11, 1), Date.UTC(2027, 0, 1)).length === 0, "fuera del período no hay hitos");

console.log("Cuánto falta");
const at = (iso) => Date.parse(iso);
const now = at("2026-11-18T15:30:00Z");                               // 10:30 en Ecuador
const ev = (t, allDay = false) => ({ t, allDay });
ok(countdownText(vEv, now, "es").text === "Hoy · ya ocurrió" && countdownText(vEv, now, "es").state === "past", "lo de esta madrugada: «Hoy · ya ocurrió»");
ok(countdownText(ev(now + 30 * 1000), now).text === "Ahora", "dentro del minuto: «Ahora»");
ok(countdownText(ev(now + 12 * MIN), now).text === "En 12 min", "«En 12 min»");
ok(countdownText(ev(now + 5 * HOUR + 12 * MIN), now).text === "En 5 h 12 min" && countdownText(ev(now + 5 * HOUR), now).state === "soon", "«En 5 h 12 min», resaltado (menos de 24 h)");
ok(countdownText(ev(now + DAY + 5 * HOUR), now).text === "En 1 día y 5 h", "«En 1 día y 5 h»");
ok(countdownText(ev(at("2026-12-21T20:50:00Z")), now).text === "En 33 días", "solsticio de diciembre: «En 33 días»");
ok(countdownText(ev(Date.UTC(2026, 10, 18, 12), true), now).text === "Hoy" && countdownText(ev(Date.UTC(2026, 10, 19, 12), true), now).text === "Mañana", "eventos de todo el día: «Hoy», «Mañana»");
ok(countdownText(ev(Date.UTC(2026, 11, 14, 12), true), now).text === "En 26 días", "Gemínidas (14-dic): «En 26 días»");
ok(countdownText(ev(now + 3 * HOUR), now, "en").text === "In 3 h 0 min" && countdownText(vEv, now, "en").text === "Today · already happened", "en inglés");
// pestaña abierta pasada la medianoche: lo de ayer no puede salir «Hoy · ya ocurrió»
const nextDay = at("2026-11-19T05:30:00Z");                           // 00:30 del 19-nov en Ecuador
ok(countdownText(vEv, nextDay, "es").text === "Ayer · ya ocurrió" && countdownText(vEv, nextDay, "en").text === "Yesterday · already happened" && countdownText(vEv, nextDay).state === "past", "pasada la medianoche, lo de ayer: «Ayer · ya ocurrió» (ES/EN)");
ok(countdownText(vEv, at("2026-11-21T15:00:00Z")).text === "Ya ocurrió", "hace más de un día: «Ya ocurrió»");
ok(countdownText(ev(Date.UTC(2026, 10, 18, 12), true), nextDay).text === "Ayer" && countdownText(ev(Date.UTC(2026, 10, 18, 12), true), nextDay).state === "past", "evento de todo el día de ayer: «Ayer», no «Hoy»");
ok(dayStart(nextDay) === new Date(2026, 10, 19).getTime() && dayStart(now) === today0, "dayStart: medianoche local del día del reloj");
const p = countdownParts(at("2026-12-21T20:50:00Z"), now);
ok(p && p.d === 33 && p.h === 5 && p.m === 20 && p.s === 0, "cuenta regresiva grande: 33 d 05 h 20 min 00 s");
ok(countdownParts(now - 1000, now) === null, "si ya pasó, no hay cuenta regresiva");
ok(startOfEvent(ev(Date.UTC(2026, 11, 14, 12), true)) === new Date(2026, 11, 14).getTime(), "un evento de todo el día empieza a la medianoche local");

console.log("Lo próximo");
const nx = nextHighlight({ now, lat: 0, lon: -78.43, showers });
ok(nx && nx.type === "meteor" && /Gem/.test(nx.data.shower.name), "hoy, lo próximo importante son las Gemínidas (THZ 150)");
const nx2 = nextHighlight({ now: at("2026-12-16T12:00:00Z"), lat: 0, lon: -78.43, showers });
ok(nx2 && nx2.id.startsWith("season-decSolstice"), "pasadas las Gemínidas: el solsticio de diciembre");
ok(!isHighlight({ type: "meteor", data: { shower: { zhr: 15 } } }) && !isHighlight({ type: "planet" }) && isHighlight({ type: "milestone" }), "las lluvias pequeñas y los planetas no entran en «Lo próximo»");
const nx3 = nextHighlight({ now: at("2027-08-14T12:00:00Z"), lat: 0, lon: -78.43, showers });
ok(nx3 && nx3.id === "milestone-voyager2-50y", "en agosto de 2027: los 50 años de la Voyager 2 (el eclipse lunar penumbral del 17 no cuenta)");
ok(!isHighlight({ type: "eclipse", sub: "moon", data: { type: "penumbral" } }) && isHighlight({ type: "eclipse", sub: "moon", data: { type: "total" } }), "un eclipse lunar penumbral no entra en «Lo próximo»; uno total, sí");

console.log("Compartir un hito");
const { eventCardText, NOW_SHARE_KINDS } = await import("../src/share/eventText.js");
const card = eventCardText({ kind: "milestone", ev: vEv }, "es", { lat: -0.22, lon: -78.51, kind: "preset", name: "Quito" }, now);
ok(NOW_SHARE_KINDS.includes("milestone"), "los hitos se pueden compartir");
ok(/Voyager 1 llega a 1 día-luz/.test(card.title) && card.type === "Hito del espacio · Calendario del cielo", "postal: título y tipo");
ok(card.grid.some(c => c.label === "Una señal de radio tarda" && c.value === "24 h 0 min") && card.grid.some(c => c.label === "Distancia a la Tierra"), "postal: distancia y «una señal de radio tarda 24 h»");
ok(card.visual && card.visual.type === "craft" && /NASA/.test(card.credit), "postal: imagen de la nave (NASA) y crédito de la NASA");
const card2 = eventCardText({ kind: "milestone", ev: milestoneEvents(Date.UTC(2027, 7, 1), Date.UTC(2027, 8, 30))[0] }, "en", null, now);
ok(/50 years since Voyager 2 launched/.test(card2.title) && card2.grid.some(c => c.label === "Launch"), "postal del aniversario (en inglés)");

const cal = readFileSync(new URL("../src/now/calendar/Calendar.jsx", import.meta.url), "utf8");
ok(/const now = useNow\(30000\);\s*const from = dayStart\(now\);/.test(cal) && !/const \[from\] = useState/.test(cal) && /<NextUp key=\{highlight\.id\}/.test(cal) && /className=\{`cal-cd is-\$\{cd\.state\}`\}/.test(cal), "la agenda empieza hoy a medianoche, muestra «Lo próximo» y el «cuánto falta» de cada evento");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
