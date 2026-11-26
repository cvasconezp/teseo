// Pruebas de la lógica pura de las vistas «El hilo» / «El mes» del Calendario del cielo (src/now/calendar/views.js).
// Uso:  node scripts/test_cal_views.mjs   (el script fija la zona horaria él mismo)
//
// Referencias:
//  · Calendario: 1-nov-2026 es domingo; 30-nov-2026 es lunes (hay que comprobarlo con cualquier almanaque).
//  · Luna nueva: 9-nov-2026 ~13:02 UTC; Luna llena: 24-nov-2026 ~14:53 UTC (USNO).
process.env.TZ = "America/Guayaquil";
const V = await import("../src/now/calendar/views.js");
const { buildSkyEvents } = await import("../src/now/calendar/events.js");

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  ok   ", msg); } else { fail++; console.log("  FALLA", msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}${JSON.stringify(a) === JSON.stringify(b) ? "" : `  → ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`}`);

console.log("Claves de día y calendario");
eq(V.weekdayMon("2026-11-01"), 6, "1-nov-2026 es domingo (lunes = 0 → 6)");
eq(V.weekdayMon("2026-11-30"), 0, "30-nov-2026 es lunes");
eq(V.addDays("2026-11-30", 1), "2026-12-01", "sumar un día cruza de mes");
eq(V.addDays("2026-03-01", -1), "2026-02-28", "restar un día cruza de mes");
eq(V.addDays("2028-02-28", 1), "2028-02-29", "2028 es bisiesto");
eq(V.addMonths("2026-12", 1), "2027-01", "mes siguiente cruza de año");
eq(V.addMonths("2026-01", -1), "2025-12", "mes anterior cruza de año");
eq(V.daysInMonth("2026-02"), 28, "febrero de 2026: 28 días");

console.log("Cuadrícula del mes (semana desde el lunes)");
const nov = V.monthGrid("2026-11");
eq(nov.length, 6, "noviembre de 2026 (empieza en domingo): 6 semanas");
ok(nov.every(w => w.length === 7), "todas las semanas tienen 7 celdas");
eq(nov[0].map(c => c && c.day), [null, null, null, null, null, null, 1], "el 1 de noviembre (domingo) cae en la última columna");
eq(nov[5].map(c => c && c.day), [30, null, null, null, null, null, null], "el 30 (lunes) abre la última semana");
eq(nov.flat().filter(Boolean).length, 30, "30 días en total");
const feb = V.monthGrid("2027-02");   // 1-feb-2027 es lunes; 28 días → 4 semanas justas
eq(feb.length, 4, "febrero de 2027 (empieza en lunes): 4 semanas sin huecos");
ok(feb.flat().every(Boolean), "…y sin huecos");
const aug = V.monthGrid("2026-08");   // 1-ago-2026 es sábado; 31 días → 6 semanas
eq(aug.length, 6, "agosto de 2026 (empieza en sábado): 6 semanas");
eq(aug[0].map(c => c && c.day), [null, null, null, null, null, 1, 2], "sábado 1 y domingo 2 cierran la primera semana");

console.log("Semana de un día");
eq(V.weekOf("2026-11-25"), ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"], "miércoles 25 → lunes 23 a domingo 29");
eq(V.weekOf("2026-11-29")[0], "2026-11-23", "el domingo pertenece a la semana que termina en él");
eq(V.weekOf("2026-11-30")[0], "2026-11-30", "el lunes abre su semana");
eq(V.weekOf("2026-12-02"), ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"], "una semana puede cruzar de mes");
eq(V.weekOf("2027-01-01")[0], "2026-12-28", "…y de año");

console.log("Día de un evento (zona horaria)");
// 02:30 UTC del 25-nov = 21:30 del 24-nov en Ecuador (UTC−5): el día del evento es el local, no el UTC
const late = { id: "x", type: "moon", t: Date.UTC(2026, 10, 25, 2, 30) };
eq(V.dayKeyOf(late), "2026-11-24", "evento de las 21:30 locales: su día es el 24 (en UTC sería el 25)");
// un evento «de todo el día» lleva su fecha del catálogo en UTC: su día es esa fecha, no la local
const allDay = { id: "y", type: "meteor", t: Date.UTC(2026, 11, 14), allDay: true };
eq(V.dayKeyOf(allDay), "2026-12-14", "evento de todo el día: la fecha del catálogo (14-dic), no la víspera local");
process.env.TZ = "Pacific/Auckland";   // UTC+13 en noviembre: el mismo instante ya es el 25 por la mañana
eq(V.dayKeyOf(late), "2026-11-25", "en Nueva Zelanda (UTC+13) el mismo evento cae el 25");
eq(V.dayKeyOf(allDay), "2026-12-14", "…y el evento de todo el día sigue en el 14");
eq(V.dayKeyOfMs(Date.UTC(2026, 10, 24, 12, 0)), "2026-11-25", "dayKeyOfMs usa el día local (Auckland: 25 a la 01:00)");
process.env.TZ = "America/Guayaquil";
eq(V.dayKeyOfMs(Date.UTC(2026, 10, 25, 4, 59)), "2026-11-24", "dayKeyOfMs: 23:59 local del 24 (Ecuador)");
eq(V.dayKeyOfMs(Date.UTC(2026, 10, 25, 5, 0)), "2026-11-25", "dayKeyOfMs: medianoche local del 25 (Ecuador)");

console.log("Agrupar por día y semana");
const evs = [
  { id: "a", type: "moon", t: Date.UTC(2026, 10, 24, 14, 53) },
  { id: "b", type: "planet", t: Date.UTC(2026, 10, 24, 20, 0) },
  { id: "c", type: "eclipse", t: Date.UTC(2026, 10, 25, 2, 30) },      // día 24 local
  { id: "d", type: "season", t: Date.UTC(2026, 11, 2, 15, 0) },
  { id: "e", type: "meteor", t: Date.UTC(2026, 11, 14), allDay: true },
];
const by = V.groupByDay(evs);
eq([...by.keys()], ["2026-11-24", "2026-12-02", "2026-12-14"], "tres días con eventos (el de las 21:30 se suma al 24)");
eq(by.get("2026-11-24").map(e => e.id), ["a", "b", "c"], "el orden recibido se conserva dentro del día");
eq(V.eventsOfWeek(by, "2026-11-26").map(e => e.id), ["a", "b", "c"], "la semana del jueves 26 trae los eventos del martes 24");
eq(V.eventsOfWeek(by, "2026-11-30").map(e => e.id), ["d"], "la semana del lunes 30 trae el del miércoles 2-dic");
eq(V.eventsOfWeek(by, "2026-12-07"), [], "semana sin eventos: lista vacía");
eq(V.nextDayWithEvents(by, "2026-11-24"), "2026-12-02", "siguiente día con eventos");
eq(V.nextDayWithEvents(by, "2026-12-14"), null, "no hay más eventos después del último día");

console.log("Día seleccionado por defecto");
eq(V.defaultSelected({ todayKey: "2026-11-26", monthKey: "2026-11", byDay: by }), "2026-11-26", "hoy, si está en el mes mostrado");
eq(V.defaultSelected({ todayKey: "2026-11-26", monthKey: "2026-12", byDay: by }), "2026-12-02", "otro mes: el primer día con eventos");
eq(V.defaultSelected({ todayKey: "2026-11-26", monthKey: "2027-01", byDay: by }), "2027-01-01", "otro mes sin eventos: el día 1");

console.log("Rango de meses de la agenda");
const from = new Date(2026, 10, 26).getTime();
eq(V.monthRange(from, 30), { first: "2026-11", last: "2026-12" }, "30 días desde el 26-nov: noviembre y diciembre");
eq(V.monthRange(from, 365), { first: "2026-11", last: "2027-11" }, "365 días: hasta noviembre de 2027");
eq(V.clampMonth("2027-05", { first: "2026-11", last: "2026-12" }), "2026-12", "un mes fuera del rango se recorta");
eq(V.clampMonth("2026-01", { first: "2026-11", last: "2026-12" }), "2026-11", "…por abajo también");

console.log("Marcas de un día");
const TYPES = ["moon", "eclipse", "meteor", "planet", "season", "milestone", "iss", "launch"];
eq(V.dayMarks([{ type: "planet" }, { type: "moon" }, { type: "planet" }], TYPES), { types: ["moon", "planet"], more: 0 }, "un tipo, una marca, en el orden de los filtros");
eq(V.dayMarks(["launch", "iss", "season", "meteor", "moon"].map(type => ({ type })), TYPES), { types: ["moon", "meteor", "season"], more: 2 }, "como máximo 3 marcas; el resto se cuenta");
eq(V.dayMarks([], TYPES), { types: [], more: 0 }, "día sin eventos: sin marcas");

console.log("Luna de cada día (moonState, src/special/math.js)");
const newMoon = V.moonOfDay("2026-11-09"), fullMoon = V.moonOfDay("2026-11-24");
ok(newMoon.illum < 0.02, `Luna nueva (9-nov-2026): casi sin luz (${newMoon.illum.toFixed(3)})`);
ok(fullMoon.illum > 0.97, `Luna llena (24-nov-2026): casi toda iluminada (${fullMoon.illum.toFixed(3)})`);
ok(V.moonOfDay("2026-11-16").waxing && !V.moonOfDay("2026-12-01").waxing, "crece entre la nueva y la llena; mengua después");
const q = V.moonOfDay("2026-11-17");
ok(q.illum > 0.4 && q.illum < 0.6, `cuarto creciente (17-nov-2026): ~50 % (${q.illum.toFixed(2)})`);
// las fases principales de events.js caen el día que dicen las efemérides
const sky = buildSkyEvents({ from: new Date(2026, 10, 1).getTime(), days: 30, lat: -0.22, lon: -78.5, showers: [] });
const full = sky.find(e => e.type === "moon" && e.sub === "full");
ok(full && V.dayKeyOf(full) === "2026-11-24", "la Luna llena de events.js cae el 24-nov-2026 (hora de Ecuador)");
ok(sky.filter(e => e.type === "moon").every(e => V.PHASE_SHAPE[e.sub]), "las 4 fases principales tienen dibujo");

console.log("Trazado de la fase");
eq(V.moonLitPath(0, true), "", "Luna nueva: sin parte iluminada");
ok(/a9 9 0 1 0 18 0/.test(V.moonLitPath(1, true)), "Luna llena: círculo completo");
ok(/^M12 3A9 9 0 0 1 12 21A0 9 0 0 [01] 12 3z$/.test(V.moonLitPath(0.5, true)), "cuarto creciente: mitad derecha con terminador recto");
ok(/^M12 3A9 9 0 0 0 12 21A0 9 0 0 [01] 12 3z$/.test(V.moonLitPath(0.5, false)), "cuarto menguante: mitad izquierda");
ok(/A4.5 9 0 0 0 12 3z$/.test(V.moonLitPath(0.25, true)), "creciente (25 %): el terminador va por la derecha (menos de media Luna)");
ok(/A4.5 9 0 0 1 12 3z$/.test(V.moonLitPath(0.75, true)), "gibosa (75 %): el terminador pasa a la izquierda");

console.log("Ventana de un día");
const dayEvs = [
  { id: "t2", type: "planet", t: Date.UTC(2026, 10, 24, 20, 0) },                       // 15:00 locales
  { id: "t1", type: "moon", t: Date.UTC(2026, 10, 24, 14, 53) },                        // 09:53 locales
  { id: "t0", type: "meteor", t: Date.UTC(2026, 10, 24), allDay: true },                // todo el día: empieza a las 00:00 locales
  { id: "tz", type: "eclipse", t: Date.UTC(2026, 10, 25, 2, 30) },                      // 21:30 del 24 en Ecuador
  { id: "n1", type: "season", t: Date.UTC(2026, 11, 2, 15, 0) },
];
const byD = V.groupByDay(dayEvs);
eq(V.eventsOfDay(byD, "2026-11-24").map(e => e.id), ["t0", "t1", "t2", "tz"], "eventos de un día en orden de hora (todo el día primero; el de las 21:30 locales al final)");
eq(V.eventsOfDay(byD, "2026-11-25"), [], "día sin eventos: lista vacía");
eq(V.monthEvents(dayEvs, "2026-11").map(e => e.id), ["t0", "t1", "t2", "tz"], "eventos del mes mostrado, por día y hora");
eq(V.monthEvents(dayEvs, "2026-12").map(e => e.id), ["n1"], "…y los de otro mes aparte");
eq(V.monthEvents(dayEvs, "2027-01"), [], "mes sin eventos: vacío");
const rg = { first: "2026-11", last: "2026-12" };
eq(V.shiftDay("2026-11-30", 1, rg), "2026-12-01", "día siguiente cruza de mes");
eq(V.shiftDay("2026-12-01", -1, rg), "2026-11-30", "día anterior cruza de mes");
eq(V.shiftDay("2026-11-01", -1, rg), null, "antes del primer mes de la agenda: no hay día anterior");
eq(V.shiftDay("2026-12-31", 1, rg), null, "después del último mes: no hay día siguiente");
eq(V.nextDayWithEvents(byD, "2026-11-24"), "2026-12-02", "siguiente evento desde un día con eventos: otro día (y de otro mes)");
eq(V.nextDayWithEvents(byD, "2026-11-10"), "2026-11-24", "siguiente evento desde un día sin eventos");
// día pasado frente a hoy, en la zona local: a las 23:30 locales del 25 (04:30 UTC del 26) hoy es el 25
const todayEc = V.dayKeyOfMs(Date.UTC(2026, 10, 26, 4, 30));
eq(todayEc, "2026-11-25", "a las 23:30 de Ecuador todavía es 25 (en UTC ya sería 26)");
ok(V.isPastDay("2026-11-24", todayEc) && !V.isPastDay("2026-11-25", todayEc) && !V.isPastDay("2026-11-26", todayEc), "pasado = antes del día local de hoy; hoy y el futuro no");
process.env.TZ = "Pacific/Auckland";
const todayNz = V.dayKeyOfMs(Date.UTC(2026, 10, 26, 4, 30));
eq(todayNz, "2026-11-26", "en Nueva Zelanda el mismo instante ya es 26 (UTC+13)");
ok(V.isPastDay("2026-11-25", todayNz), "…y allí el 25 ya es pasado");
process.env.TZ = "America/Guayaquil";
const ph = V.moonOfDay("2026-11-24"), ph2 = V.moonOfDay("2026-11-17");
eq([ph.phase, V.moonOfDay("2026-11-09").phase, ph2.phase], ["full", "new", "firstQuarter"], "nombre de la fase del día (llena, nueva, cuarto creciente)");
ok(V.moonOfDay("2026-11-20").phase === "waxingGibbous" && V.moonOfDay("2026-11-13").phase === "waxingCrescent", "gibosa y creciente intermedias");

console.log("Marcador «Hoy» del hilo");
const now = Date.UTC(2026, 10, 24, 18, 0);
const row = [{ id: "p", t: Date.UTC(2026, 10, 24, 14, 53) }, { id: "q", t: Date.UTC(2026, 10, 25, 9, 0) }];
eq(V.todayMarkerIndex(row, now), 1, "va entre lo ya ocurrido y lo que falta");
eq(V.todayMarkerIndex([row[1]], now), 0, "todo por delante: arriba del todo");
eq(V.todayMarkerIndex([row[0]], now), 1, "todo ya ocurrido: al final");
eq(V.todayMarkerIndex([{ id: "z", type: "meteor", t: Date.UTC(2026, 10, 24), allDay: true }], now), 1, "un evento de todo el día de hoy cuenta como empezado");

console.log(`\n${pass} correctas, ${fail} fallas`);
process.exit(fail ? 1 : 0);
