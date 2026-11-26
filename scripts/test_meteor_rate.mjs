// Pruebas de «Cuántos meteoros verás desde tu lugar» y del evento de lluvia a la mejor hora (Calendario del cielo).
// Uso:  node scripts/test_meteor_rate.mjs   (el script fija la zona horaria él mismo)
//
// Referencias:
//  · IMO, Handbook for Meteor Observers (2022), cap. 7, ec. 7.2: ZHR = N · r^(6,5 − lm) · F / (T · sen h); vale para h ≥ 10°.
//    Tabla 2.1 del mismo manual (ZHR = 100, lm 6,5): h = 70°→94, 50°→77, 30°→50, 10°→17 meteoros por hora.
//    https://www.imo.net/files/books/Handbook_for_meteors_observers.pdf
//  · IMO, 2027 Meteor Shower Calendar (37.ª edición, publicada el 6-jul-2026), tabla 5 «Working List of Visual Meteor Showers»,
//    p. 25: r y V∞ de cada lluvia. https://www.imo.net/files/meteor-shower/cal2027.pdf
//  · Cálculo a mano de la culminación de las Gemínidas (RA 112° = 7 h 28 min): el 14-dic el Sol está a RA ≈ 17 h 31 min, así que
//    el tiempo sidéreo local es 7 h 28 min unas 1,95 h después de la medianoche solar media (≈ 01:56 local medio): madrugada del 15-dic.
process.env.TZ = "America/Guayaquil";
import { readFileSync } from "node:fs";
const { visibleRate, showerEvent, findShowerPeaks, MALE_DARK, MALE_CITY, MIN_RATE_ALT } = await import("../src/now/calendar/meteors.js");
const { buildSkyEvents, nextHighlight, groupByMonth, sortEvents } = await import("../src/now/calendar/events.js");
const { describeEvent } = await import("../src/now/calendar/i18n.js");
const { countdownText } = await import("../src/now/calendar/countdown.js");
const { leadOptions, reminderTimes } = await import("../src/now/calendar/push.js");
const { buildFeed } = await import("../src/now/calendar/feed.js");
const { buildIcs } = await import("../src/now/calendar/ics.js");

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  ok   ", msg); } else { fail++; console.log("  FALLA", msg); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const showers = JSON.parse(readFileSync(new URL("../public/meteorshowers.json", import.meta.url), "utf8")).objects;
const by = (en) => showers.find(o => o.name_en === en);
const fmt = { time: (ms) => new Date(ms).toISOString().slice(11, 16), n: (x, d = 0) => Number(x).toFixed(d), pct: (x) => `${Math.round(x * 100)} %`, mag: "magnitud" };

console.log("Catálogo: r y v de la IMO");
// IMO 2027, tabla 5 (r, V∞ en km/s)
const IMO = { Quadrantids: [2.1, 41], Lyrids: [2.1, 49], "Eta Aquariids": [2.4, 66], "Southern Delta Aquariids": [2.5, 41], Perseids: [2.2, 59], "September Epsilon Perseids": [2.5, 64], Draconids: [2.6, 20], Orionids: [2.5, 66], "Southern Taurids": [2.3, 27], Leonids: [2.5, 71], Geminids: [2.6, 35], Ursids: [2.8, 33] };
ok(showers.length === 12 && showers.every(o => o.name_en in IMO), "las 12 lluvias del catálogo están en la tabla 5 de la IMO");
ok(showers.every(o => o.r === IMO[o.name_en][0] && o.v === IMO[o.name_en][1]), "r y v de cada lluvia coinciden con la tabla 5 (IMO 2027)");

console.log("La fórmula");
const dark = visibleRate(150, 2.6, 60, MALE_DARK), city = visibleRate(150, 2.6, 60, MALE_CITY);
ok(MALE_DARK === 6.5 && MALE_CITY === 4.5, "cielo oscuro: magnitud límite 6,5; ciudad: 4,5");
ok(near(dark, 150 * 0.8660254, 1e-6) && Math.round(dark) === 130, `Gemínidas, ZHR 150, r 2,6, radiante a 60°, MALE 6,5 → 150 × 0,866 = ${dark.toFixed(1)} ≈ 130`);
ok(near(city, 129.9038 / 6.76, 1e-4) && Math.round(city) === 19, `con MALE 4,5: 130 ÷ 2,6² = ${city.toFixed(2)} ≈ 19`);
// Tabla 2.1 del manual de la IMO (ZHR 100, MALE 6,5)
ok([[90, 100], [70, 94], [50, 77], [30, 50], [10, 17]].every(([h, n]) => Math.round(visibleRate(100, 2.5, h, 6.5)) === n), "reproduce la tabla 2.1 del manual de la IMO (h = 90, 70, 50, 30, 10°)");
ok(near(visibleRate(150, 1, 90, 4.5), 150, 1e-9), "con r = 1 la magnitud límite no cambia nada (cenit: ZHR)");
ok(visibleRate(150, 2.6, 60, 5.5) > city && visibleRate(150, 2.6, 60, 5.5) < dark, "monótona: más oscuro, más meteoros");
console.log("Sin estimación");
ok(visibleRate(150, null, 60, 6.5) === null && visibleRate(150, undefined, 60, 6.5) === null && visibleRate(150, NaN, 60, 6.5) === null, "sin r → sin estimación");
ok(visibleRate(null, 2.6, 60, 6.5) === null && visibleRate(0, 2.6, 60, 6.5) === null, "sin ZHR → sin estimación");
ok(visibleRate(150, 2.6, -5, 6.5) === null && visibleRate(150, 2.6, 0, 6.5) === null, "radiante bajo el horizonte (o en él) → sin estimación (no sale un número negativo)");
ok(MIN_RATE_ALT === 10 && visibleRate(150, 2.6, 9.9, 6.5) === null && visibleRate(150, 2.6, 10, 6.5) > 0, "radiante a menos de 10°: la fórmula de la IMO no vale → sin estimación");

console.log("El evento, a la mejor hora (hemisferio norte: Madrid)");
const MAD = { lat: 40.42, lon: -3.7 };
const gem = by("Geminids");
const eM = showerEvent(gem, 2026, MAD.lat, MAD.lon);
const bestM = new Date(eM.best.t);
ok(eM.window && eM.window.start === eM.best.t, "el inicio del evento es la mejor hora (radiante más alto de la noche)");
ok(near(eM.best.t, Date.UTC(2026, 11, 15, 2, 10), 30 * MIN), `Gemínidas en Madrid culminan a mano ≈ 02:10 UTC del 15-dic (el código da ${bestM.toISOString().slice(0, 16)}Z)`);
ok(bestM.getUTCDate() === 15 && eM.date === Date.UTC(2026, 11, 14, 12), "la mejor hora cae en la madrugada del 15-dic, un día después de la fecha del catálogo (14-dic)");
ok(eM.window.durationMin >= 30 && eM.window.durationMin <= 120 && eM.window.start + eM.window.durationMin * MIN <= +eM.night.end + 1, `duración ${eM.window.durationMin} min: hasta 2 h y sin pasar del final de la noche`);
ok(near(eM.maxAlt, 90 - (40.42 - 33), 1) && eM.rates && near(eM.rates.dark, 150 * Math.sin(eM.maxAlt * Math.PI / 180), 1e-6), `radiante a ${eM.maxAlt.toFixed(1)}° (≈ 90° − |40,42° − 33°|); tasa con la altura de la mejor hora`);
ok(near(eM.rates.city, eM.rates.dark / 2.6 ** 2, 1e-9), "«desde una ciudad» = «cielo oscuro» ÷ r²");

const from = Date.UTC(2026, 10, 26, 12);
const skyM = buildSkyEvents({ from, days: 60, ...MAD, showers });
const gM = skyM.find(e => e.id === "meteor-Geminids-2026");
ok(gM && !gM.allDay && gM.t === eM.best.t && gM.durationMin === eM.window.durationMin, "en la lista el evento va con hora (no de todo el día) y con la duración de la ventana");
ok(skyM.indexOf(gM) >= 0 && sortEvents(skyM).every((e, i, a) => i === 0 || a[i - 1].t <= e.t), "el orden de la lista usa la hora del evento");
const cd = countdownText(gM, gM.t - 3 * HOUR, "es");
ok(cd.state === "soon" && cd.text === "En 3 h 0 min", `cuenta regresiva a la hora real: «${cd.text}»`);
ok(countdownText(gM, gM.t + 30 * MIN, "es").state === "past", "pasada la hora, «ya ocurrió»");
ok(JSON.stringify(leadOptions(gM)) === '["30","120"]' && reminderTimes(gM, "30", gM.t - 5 * HOUR).eventAt === gM.t, "recordatorios: 30 min / 2 h antes de la hora real (no la víspera)");
const grp = groupByMonth(sortEvents(skyM));
ok(grp.some(g => g.items.includes(gM)), "agrupado por mes sin romperse");
// el evento sigue en la lista si ya pasó la fecha del catálogo pero aún no su mejor hora (00:30 UTC del 15-dic)
const late = buildSkyEvents({ from: Date.UTC(2026, 11, 15, 0, 30), days: 3, ...MAD, showers }).find(e => e.id === "meteor-Geminids-2026");
ok(late && late.t === eM.best.t, "a las 00:30 UTC del 15-dic (pasada la fecha del catálogo, antes de la mejor hora) el evento sigue en la lista");
ok(!buildSkyEvents({ from: eM.best.t + 3 * HOUR, days: 3, ...MAD, showers }).some(e => e.id === "meteor-Geminids-2026"), "después de su ventana ya no está");
const hl = nextHighlight({ now: Date.UTC(2026, 10, 26, 12), ...MAD, showers });
ok(hl && hl.id === "meteor-Geminids-2026" && !hl.allDay && hl.t === eM.best.t, "«Lo próximo»: las Gemínidas, a su mejor hora");

console.log("Hemisferio sur (Santiago de Chile) y ecuador (Quito)");
const eS = showerEvent(gem, 2026, -33.45, -70.67), eQ = showerEvent(gem, 2026, -0.22, -78.51);
ok(near(eS.maxAlt, 90 - (33 + 33.45), 1) && eS.window && near(eS.best.t, Date.UTC(2026, 11, 15, 6, 40), 30 * MIN), `Santiago: radiante bajo (${eS.maxAlt.toFixed(1)}° ≈ 90° − 66,45°), mejor hora ≈ 06:40 UTC (a mano) del 15-dic`);
ok(eS.rates && Math.round(eS.rates.dark) === 60 && Math.round(eS.rates.city) === 9, `Santiago: 150 × sen(23,5°) ≈ 60 bajo cielo oscuro y 60 ÷ 2,6² ≈ 9 desde una ciudad (${eS.rates.dark.toFixed(1)} y ${eS.rates.city.toFixed(1)})`);
ok(eQ.window && eQ.rates && near(eQ.maxAlt, 90 - 33.22, 1) && Math.round(eQ.rates.dark) === Math.round(150 * Math.sin(eQ.maxAlt * Math.PI / 180)), "Quito: el mismo cálculo");
// Úrsidas desde 5° S: el radiante apenas sube (< 10°) → hay mejor hora, pero no se estima
const urs = by("Ursids"), eU = showerEvent(urs, 2026, -5, -70);
ok(eU.risesInNight && eU.maxAlt > 0 && eU.maxAlt < 10 && eU.window && eU.rates === null, `radiante que casi no sube (${eU.maxAlt.toFixed(1)}°): evento a esa hora, sin estimación`);

console.log("Sin mejor hora: se conserva el comportamiento anterior");
const quadS = buildSkyEvents({ from, days: 90, lat: -60, lon: -60, showers }).find(e => e.id === "meteor-Quadrantids-2027");
ok(quadS && quadS.allDay === true && quadS.durationMin === 24 * 60 && quadS.t === Date.UTC(2027, 0, 3, 12) && quadS.visible === false && quadS.data.window === null && quadS.data.rates === null, "Cuadrántidas desde 60° S (el radiante no sube): sigue siendo de todo el día, en la fecha del catálogo");
const june = showerEvent(by("Perseids"), 2026, 70, 20);   // sol de medianoche: no hay noche cerrada
ok(june.night === null && june.window === null && june.best === null, "sin noche (Sol de medianoche, 70° N en agosto): sin mejor hora, todo el día");

console.log("Lluvia sin r en el catálogo");
const noR = showers.map(o => (o.name_en === "Geminids" ? { ...o, r: null, v: null } : o));
const eNR = buildSkyEvents({ from, days: 60, ...MAD, showers: noR }).find(e => e.id === "meteor-Geminids-2026");
ok(eNR && eNR.data.rates === null && !eNR.allDay && eNR.t === eM.best.t, "sin r: el evento sigue a la mejor hora, pero sin estimación");
const tNR = describeEvent(eNR, "es", fmt);
ok(!/por hora bajo un cielo oscuro|desde una ciudad|Cómo se calcula/.test(tNR.what + tNR.note) && /hasta ~150 meteoros por hora \(THZ/.test(tNR.what), "sin r: se mantiene el texto actual (solo la cifra teórica)");

console.log("Textos (ES y EN)");
const synth = (zhr, r, alt) => ({ type: "meteor", sub: "shower", t: 1, durationMin: 120, visible: true, data: { shower: { name: "Gemínidas", name_en: "Geminids", zhr, r }, risesInNight: true, maxAlt: alt, best: { t: Date.UTC(2026, 11, 15, 2, 10), alt }, moon: null, rates: visibleRate(zhr, r, alt, 6.5) == null ? null : { dark: visibleRate(zhr, r, alt, 6.5), city: visibleRate(zhr, r, alt, 4.5) } } });
const es60 = describeEvent(synth(150, 2.6, 60), "es", fmt), en60 = describeEvent(synth(150, 2.6, 60), "en", fmt);
ok(/Con el radiante a 60°, verías unos 130 por hora bajo un cielo oscuro y unos 19 por hora desde una ciudad \(son estimaciones\)\./.test(es60.what), `ES: «${es60.what.match(/Con el radiante[^.]*\.[^.]*\./)}»`);
ok(/With the radiant at 60°, you would see about 130 per hour under a dark sky and about 19 per hour from a city \(these are estimates\)\./.test(en60.what), `EN: «${en60.what.match(/With the radiant[^.]*\.[^.]*\./)}»`);
ok(/hasta ~150 meteoros por hora \(THZ, la tasa teórica con cielo ideal; verás menos\)/.test(es60.what) && /up to ~150 meteors per hour \(ZHR, the theoretical rate under ideal skies; you will see fewer\)/.test(en60.what), "se conserva la cifra teórica (THZ/ZHR) como referencia");
ok(/Cómo se calcula: THZ × sen\(altura del radiante\) ÷ r\^\(6,5 − magnitud límite\), fórmula estándar de la IMO \(r: Calendario 2027, tabla 5\)/.test(es60.note) && /How it is calculated: ZHR × sin\(radiant altitude\) ÷ r\^\(6\.5 − limiting magnitude\), the standard IMO formula \(r: 2027 Calendar, table 5\)/.test(en60.note), "línea de sustento visible (ES y EN)");
ok(/^Hora: cuando el radiante está más alto esa noche/.test(es60.note) && /^Time: when the radiant is highest that night/.test(en60.note), "la nota dice que la hora es la del radiante más alto (y que el máximo real varía ±1 día)");
const esLow = describeEvent(synth(10, 2.8, 20), "es", fmt), enLow = describeEvent(synth(10, 2.8, 20), "en", fmt);
ok(/verías unos 3 por hora bajo un cielo oscuro y menos de uno por hora desde una ciudad/.test(esLow.what) && /you would see about 3 per hour under a dark sky and fewer than one per hour from a city/.test(enLow.what), "por debajo de 1: «menos de uno por hora» / «fewer than one per hour»");
const e1 = describeEvent(synth(5, 2.0, 30), "es", fmt);   // 5 × 0,5 = 2,5 → unos 3; ciudad 2,5 ÷ 4 = 0,6
ok(/menos de uno por hora/.test(e1.what), "0,6 se dice «menos de uno», no «1»");
const eOne = describeEvent(synth(8, 2.0, 30), "es", fmt);   // 8 × 0,5 = 4 → 4; ciudad 4 ÷ 4 = 1 → «1 por hora»
ok(/desde una ciudad|1 por hora/.test(eOne.what) && /y 1 por hora desde una ciudad/.test(eOne.what), "exactamente 1: «1 por hora»");
const lowTxt = describeEvent({ ...synth(10, 2.8, 5), data: { ...synth(10, 2.8, 5).data, rates: null } }, "es", fmt);
ok(/menos de 10° la IMO no da una fórmula fiable, así que no estimamos/.test(lowTxt.what) && /verás pocos meteoros/.test(lowTxt.vis.text), "radiante a menos de 10°: se explica por qué no hay cifra y se conserva el aviso de pocos meteoros");
const realG = describeEvent(gM, "es", fmt);
ok(/Luna|luna/.test(realG.what) && /unos \d+ por hora bajo un cielo oscuro/.test(realG.what), "evento real: conserva el aviso de la Luna y añade las dos cifras");
ok(/Luna|Moon/.test(describeEvent(gM, "en", fmt).what), "EN: aviso de la Luna conservado");
ok(es60.icsDesc.includes("Cómo se calcula") && en60.icsDesc.includes("How it is calculated"), "el .ics de un solo evento (Añadir a mi calendario) lleva también la línea de sustento");

console.log("Suscripción .ics (Madrid, Europe/Madrid)");
const now = Date.UTC(2026, 10, 26, 15);
const ics = buildFeed({ ...MAD, lang: "es", tz: "Europe/Madrid", name: "Madrid", now, showers, days: 120 });
const veventOf = (txt, summary) => txt.replace(/\r\n /g, "").split("BEGIN:VEVENT").find(b => b.includes(`SUMMARY:${summary}`));
const vG = veventOf(ics, "Lluvia de meteoros: Gemínidas");
const dtstart = vG && vG.match(/DTSTART:(\d{8}T\d{6}Z)/), dtend = vG && vG.match(/DTEND:(\d{8}T\d{6}Z)/);
ok(vG && dtstart && !/DTSTART;VALUE=DATE/.test(vG), "el .ics lleva las Gemínidas con hora (DTSTART con hora UTC, no de todo el día)");
const toMs = (z) => Date.UTC(+z.slice(0, 4), +z.slice(4, 6) - 1, +z.slice(6, 8), +z.slice(9, 11), +z.slice(11, 13), +z.slice(13, 15));
ok(dtstart && Math.abs(toMs(dtstart[1]) - eM.best.t) < 1000 && dtstart[1].startsWith("20261215T"), `DTSTART = mejor hora (${dtstart && dtstart[1]}), en la fecha real: 15-dic`);
ok(dtend && toMs(dtend[1]) - toMs(dtstart[1]) === eM.window.durationMin * MIN, "DTEND = inicio + duración de la ventana");
const madTime = new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Madrid" }).format(new Date(toMs(dtstart[1])));
ok(vG.includes(`a las ${madTime}.`) && madTime.slice(0, 2) === "03", `la descripción da la hora en la zona del lugar (${madTime} de Madrid = 02:xx UTC + 1 h)`);
ok(/unos \d+ por hora bajo un cielo oscuro/.test(vG) && /Cómo se calcula/.test(vG) && /TRIGGER:-PT30M/.test(vG), "el .ics trae las dos cifras, el sustento y aviso 30 min antes");
const icsQ = buildFeed({ lat: -60, lon: -60, lang: "es", tz: "America/Argentina/Ushuaia", now, showers, days: 120 });
const vQ = veventOf(icsQ, "Lluvia de meteoros: Cuadrántidas");
ok(vQ && /DTSTART;VALUE=DATE:20270103/.test(vQ) && /TRIGGER:-PT6H/.test(vQ), "sin mejor hora (60° S): el .ics conserva el evento de todo el día (3-ene-2027)");
const icsEn = buildFeed({ lat: -33.45, lon: -70.67, lang: "en", tz: "America/Santiago", now, showers, days: 120 });
const vSG = veventOf(icsEn, "Meteor shower: Geminids");
ok(vSG && /about \d+ per hour under a dark sky/.test(vSG) && /DTSTART:20261215T06/.test(vSG), "Santiago (EN): las dos cifras y mejor hora ≈ 06:3x UTC del 15-dic");
const one = buildIcs({ uid: "x@teseo", start: gM.t, durationMin: gM.durationMin, title: "Gemínidas", description: es60.icsDesc });
ok(/DTSTART:20261215T0\d{5}Z/.test(one) && !/VALUE=DATE/.test(one), "«Añadir a mi calendario» (evento suelto) también va con hora");

console.log("Postal para compartir");
const { eventCardText } = await import("../src/share/eventText.js");
const card = eventCardText({ kind: "meteor", ev: gM }, "es", { lat: MAD.lat, lon: MAD.lon, kind: "preset", name: "Madrid" }, Date.UTC(2026, 10, 26, 15));
const when = card.grid.find(g => g.label === "Cuándo");
ok(when && /14/.test(when.value) && /catálogo/.test(when.sub || ""), `la postal sigue dando la fecha del catálogo (${when && when.value}), no la del día siguiente`);

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
