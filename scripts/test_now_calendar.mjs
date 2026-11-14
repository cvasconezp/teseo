// Pruebas del «Calendario del cielo» (src/now/calendar/). Node puro, sin dependencias ni red.
// Uso:  node scripts/test_now_calendar.mjs     (sale con código 1 si algo falla)
//
// REFERENCIAS PUBLICADAS (consultadas el 14-nov-2026; los valores están copiados aquí para que la prueba
// no dependa de la red):
//  · USNO, API de fases de la Luna y de estaciones:
//      https://aa.usno.navy.mil/api/moon/phases/year?year=2026 (y 2027)
//      https://aa.usno.navy.mil/api/seasons?year=2026 (2027, 2028)
//  · In-The-Sky.org, calendario de eventos (hora UTC en cada ficha de https://in-the-sky.org/news.php?id=…):
//      oposiciones, máximas elongaciones, conjunciones y acercamientos Luna–planeta.
//  · NASA GSFC (F. Espenak): regiones de visibilidad de los eclipses lunares
//      https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html y de los solares
//      https://eclipse.gsfc.nasa.gov/SEdecade/SEdecade2021.html
import { readFileSync } from "node:fs";
import { buildSkyEvents, buildFeedEvents, buildEvents, groupByMonth, readPlace, normalizeIss, QUITO, PLACE_KEY } from "../src/now/calendar/events.js";
import { findOppositions, findElongations, findConjunctions } from "../src/now/calendar/planets.js";
import { seasonMoment } from "../src/now/calendar/seasons.js";
import { findEclipses, lunarEclipseVisibility, LUNAR_ECLIPSES, SOLAR_ECLIPSES } from "../src/now/calendar/eclipses.js";
import { classifyLaunch, filterLaunches } from "../src/now/calendar/launchFilter.js";
import { buildIcs, icsUtc, icsEscape, foldLine, icsFileName } from "../src/now/calendar/ics.js";
import { TC, describeEvent, howToSee } from "../src/now/calendar/i18n.js";
import { cleanParams } from "../src/ui/track.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const iso = ms => new Date(ms).toISOString().slice(0, 16) + "Z";
const U = (s) => Date.parse(s + (s.length <= 16 ? ":00Z" : "Z"));
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const showers = JSON.parse(readFileSync(new URL("../public/meteorshowers.json", import.meta.url))).objects;

// ─── 1 · Fases de la Luna (USNO, margen 15 min) ──────────────────────────────
console.log("Fases de la Luna contra el USNO");
{
  const USNO = [
    ["firstQuarter", "2026-11-17T11:48"], ["full", "2026-11-24T14:53"], ["lastQuarter", "2026-12-01T06:08"], ["new", "2026-12-09T00:52"],
    ["firstQuarter", "2026-12-17T05:42"], ["full", "2026-12-24T01:28"], ["lastQuarter", "2026-12-30T18:59"], ["new", "2027-01-07T20:24"],
    ["firstQuarter", "2027-01-15T20:34"], ["full", "2027-01-22T12:17"], ["lastQuarter", "2027-01-29T10:55"], ["new", "2027-02-06T15:56"],
    ["firstQuarter", "2027-02-14T07:58"], ["full", "2027-02-20T23:23"], ["lastQuarter", "2027-02-28T05:16"], ["new", "2027-03-08T09:29"],
    ["firstQuarter", "2027-03-15T16:25"], ["full", "2027-03-22T10:44"],
  ];
  const from = U("2026-11-14T12:00"), ev = buildSkyEvents({ from, days: 130, lat: QUITO.lat, lon: QUITO.lon, showers }).filter(e => e.type === "moon");
  ok(ev.length === USNO.length, `18 fases entre el 14-nov-2026 y el 24-mar-2027 (hay ${ev.length})`);
  let worst = 0, missing = 0;
  for (const [sub, when] of USNO) {
    const e = ev.find(x => x.sub === sub && Math.abs(x.t - U(when)) < 2 * DAY);
    if (!e) { missing++; continue; }
    worst = Math.max(worst, Math.abs(e.t - U(when)) / MIN);
  }
  ok(missing === 0, "cada fase del USNO tiene su evento", `faltan ${missing}`);
  ok(worst <= 15, `todas las fases a ≤ 15 min del USNO (peor: ${worst.toFixed(1)} min)`);
  ok(ev.every(e => /^moon-(new|firstQuarter|full|lastQuarter)-\d{8}$/.test(e.id)), "UID estable de cada fase: tipo + fecha");
}

// ─── 2 · Planetas contra In-The-Sky.org (±1 día) ─────────────────────────────
console.log("Oposiciones, elongaciones y conjunciones contra In-The-Sky.org (±1 día)");
{
  const f = U("2026-11-14T00:00"), t = U("2027-11-14T00:00");
  const opp = findOppositions(f, t), elo = findElongations(f, t);
  const ITS_OPP = [["Urano", "2026-11-25T22:33"], ["Júpiter", "2027-02-11T00:21"], ["Marte", "2027-02-19T15:44"], ["Neptuno", "2027-09-28T14:10"], ["Saturno", "2027-10-18T00:27"]];
  for (const [p, when] of ITS_OPP) {
    const o = opp.find(x => x.planet === p);
    ok(!!o && Math.abs(o.t - U(when)) <= DAY, `oposición de ${p}: ${o ? iso(o.t) : "—"} vs In-The-Sky ${when}Z`, o ? `dif ${((o.t - U(when)) / HOUR).toFixed(1)} h` : "");
  }
  ok(opp.length === 5, "exactamente 5 oposiciones en 12 meses (Marte, Júpiter, Saturno, Urano, Neptuno)", `hay ${opp.length}`);
  const ITS_ELO = [["Mercurio", "west", "2026-11-21T00:33"], ["Venus", "west", "2027-01-03T18:21"], ["Mercurio", "east", "2027-02-03T05:11"], ["Mercurio", "west", "2027-03-17T04:20"], ["Mercurio", "east", "2027-05-28T13:13"]];
  for (const [p, side, when] of ITS_ELO) {
    const e = elo.find(x => x.planet === p && x.side === side && Math.abs(x.t - U(when)) <= 3 * DAY);
    ok(!!e && Math.abs(e.t - U(when)) <= DAY, `máxima elongación ${side === "east" ? "este" : "oeste"} de ${p}: ${e ? iso(e.t) : "—"} vs ${when}Z`, e ? `dif ${((e.t - U(when)) / HOUR).toFixed(1)} h` : "");
  }
  const mw = elo.find(x => x.planet === "Venus");
  ok(mw && mw.elong > 46 && mw.elong < 47.5, `Venus: elongación máxima ≈ 47° (${mw && mw.elong.toFixed(1)}°; valor típico 45–47°)`);
  const conj = findConjunctions(f, t);
  const mj = conj.find(c => c.kind === "planets" && c.a === "Marte" && c.b === "Júpiter" && c.t < U("2026-12-01T00:00"));
  ok(!!mj && Math.abs(mj.t - U("2026-11-16T02:04")) <= DAY && Math.abs(mj.sep - (1 + 11 / 60)) < 0.1, `Marte–Júpiter: ${mj ? iso(mj.t) + " a " + mj.sep.toFixed(2) + "°" : "—"} vs In-The-Sky 2026-11-16T02:04Z a 1°11′`);
  const lj = conj.find(c => c.kind === "moon" && c.b === "Júpiter" && Math.abs(c.t - U("2026-11-30T08:24")) < DAY);
  ok(!!lj && Math.abs(lj.t - U("2026-11-30T08:24")) <= 2 * HOUR && Math.abs(lj.sep - (1 + 3 / 60)) < 0.1, `Luna–Júpiter: ${lj ? iso(lj.t) + " a " + lj.sep.toFixed(2) + "°" : "—"} vs In-The-Sky 2026-11-30T08:24Z a 1°03′`);
  const lj2 = conj.find(c => c.kind === "moon" && c.b === "Júpiter" && Math.abs(c.t - U("2027-01-23T23:20")) < DAY);
  ok(!!lj2 && Math.abs(lj2.t - U("2027-01-23T23:20")) <= 2 * HOUR && Math.abs(lj2.sep - (1 + 21 / 60)) < 0.1, `Luna–Júpiter: ${lj2 ? iso(lj2.t) + " a " + lj2.sep.toFixed(2) + "°" : "—"} vs In-The-Sky 2027-01-23T23:20Z a 1°21′`);
  ok(!conj.some(c => c.kind === "moon" && c.b === "Saturno" && Math.abs(c.t - U("2026-11-20T20:02")) < DAY), "Luna–Saturno del 20-nov-2026 (6°03′ según In-The-Sky) NO se lista: supera los 3°");
  ok(conj.every(c => c.kind === "moon" ? c.sep < 3 : c.sep < 2), "umbrales: Luna–planeta < 3°, planeta–planeta < 2°");
}

// ─── 3 · Equinoccios y solsticios contra el USNO (±10 min) ───────────────────
console.log("Equinoccios y solsticios contra el USNO (±10 min)");
{
  const USNO = {
    2026: ["03-20T14:46", "06-21T08:24", "09-23T00:05", "12-21T20:50"],
    2027: ["03-20T20:25", "06-21T14:11", "09-23T06:02", "12-22T02:42"],
    2028: ["03-20T02:17", "06-20T20:02", "09-22T11:45", "12-21T08:19"],
  };
  const names = ["equinoccio de marzo", "solsticio de junio", "equinoccio de septiembre", "solsticio de diciembre"];
  let worst = 0;
  for (const y of [2026, 2027, 2028]) for (let k = 0; k < 4; k++) {
    const want = U(`${y}-${USNO[y][k]}`), got = seasonMoment(y, k), d = Math.abs(got - want) / MIN;
    worst = Math.max(worst, d);
    ok(d <= 10, `${names[k]} ${y}: ${iso(got)} vs USNO ${USNO[y][k]} (${d.toFixed(1)} min)`);
  }
  ok(worst <= 2, `Meeus cap. 27 coincide con el USNO al minuto (peor: ${worst.toFixed(1)} min)`);
}

// ─── 4 · Eclipses ────────────────────────────────────────────────────────────
console.log("Eclipses: lista NASA y visibilidad lunar desde Quito");
{
  ok(SOLAR_ECLIPSES.length === 6 && LUNAR_ECLIPSES.length === 8, "lista curada 2026–2028: 6 solares y 8 lunares (NASA GSFC)");
  const se = SOLAR_ECLIPSES.find(e => e.id === "se-2026-08-12");
  ok(Math.abs(se.t - U("2026-08-12T17:46")) < 2 * MIN, `eclipse solar total 12-ago-2026: máximo ${iso(se.t)} (timeanddate: 17:46 UTC)`);
  const le = LUNAR_ECLIPSES.find(e => e.id === "le-2026-03-03");
  ok(Math.abs(le.t - U("2026-03-03T11:33")) < 2 * MIN, `eclipse lunar total 3-mar-2026: máximo ${iso(le.t)} (timeanddate: 11:33 UTC)`);
  const vis = (id) => lunarEclipseVisibility(LUNAR_ECLIPSES.find(e => e.id === id), QUITO.lat, QUITO.lon);
  // NASA: la región de visibilidad incluye «Americas» → Quito (UTC−5) lo ve
  ok(vis("le-2026-08-28").state === "yes", "28-ago-2026 (NASA: «e Pacific, Americas, Europe, Africa»): visible desde Quito", JSON.stringify(vis("le-2026-08-28")));
  ok(vis("le-2028-01-12").state === "yes", "12-ene-2028 (NASA: «Americas, Europe, Africa»): visible desde Quito");
  ok(vis("le-2027-08-17").state === "yes", "17-ago-2027 (NASA: «Pacific, Americas»): visible desde Quito");
  // NASA: la región NO incluye América → Quito no lo ve
  ok(vis("le-2027-07-18").state === "no", "18-jul-2027 (NASA: «e Africa, Asia, Australia, Pacific»): NO visible desde Quito");
  ok(vis("le-2028-07-06").state === "no", "6-jul-2028 (NASA: «Europe, Africa, Asia, Australia»): NO visible desde Quito");
  ok(vis("le-2028-12-31").state === "no", "31-dic-2028 (NASA: «Europe, Africa, Asia, Australia, Pacific»): NO visible desde Quito");
  // 3-mar-2026: NASA incluye «Americas», pero en Quito la Luna se pone al amanecer: solo el comienzo
  ok(vis("le-2026-03-03").state === "partial" && vis("le-2026-03-03").altMax < 0, "3-mar-2026 (NASA: «…Americas»): en Quito la Luna se pone antes del máximo → visible solo en parte");
  // en otro lugar el resultado cambia (Madrid: 11:33 UTC = 12:33 → de día; Sídney: noche): el cálculo depende del lugar
  ok(lunarEclipseVisibility(LUNAR_ECLIPSES.find(e => e.id === "le-2028-12-31"), -33.87, 151.21).state === "yes", "31-dic-2028 desde Sídney (NASA: Australia): sí");
  // ventana
  const all = findEclipses(U("2026-11-14T00:00"), U("2027-11-14T00:00"), QUITO.lat, QUITO.lon);
  ok(all.map(e => e.id).join() === "se-2027-02-06,le-2027-02-20,le-2027-07-18,se-2027-08-02,le-2027-08-17", "eclipses de los próximos 12 meses: 6-feb, 20-feb, 18-jul, 2-ago y 17-ago de 2027", all.map(e => e.id).join());
  // Sol: solo se marca lo que la NASA dice
  const eq = Object.fromEntries(SOLAR_ECLIPSES.map(e => [e.id, e.ecuador]));
  ok(eq["se-2028-01-26"] === "yes", "26-ene-2028 (NASA, franja anular: «Ecuador, Peru, Brazil…»): visible desde Ecuador = sí");
  ok(eq["se-2027-02-06"] === "partial", "6-feb-2027 (NASA: «S. America…»): parcial, sin detallar Ecuador");
  ok(eq["se-2026-08-12"] === "no" && eq["se-2027-08-02"] === "no" && eq["se-2028-07-22"] === "no", "12-ago-2026, 2-ago-2027 y 22-jul-2028: la región NASA no incluye Sudamérica → no");
  ok(SOLAR_ECLIPSES.every(e => /^https:\/\/eclipse\.gsfc\.nasa\.gov\//.test(e.map)), "cada eclipse solar enlaza al mapa de la NASA");
}

// ─── 5 · Filtro de lanzamientos ──────────────────────────────────────────────
console.log("Filtro de lanzamientos");
{
  const L = {
    starlink: { id: "1", name: "Falcon 9 Block 5 | Starlink Group 17-30", mission: "Starlink Group 17-30", mission_type: "Communications", rocket: "Falcon 9 Block 5", description: "A batch of satellites for the Starlink mega-constellation - SpaceX's project for space-based Internet communication system." },
    starship: { id: "2", name: "Starship | Flight 15", mission: "Flight 15", mission_type: "Test Flight", rocket: "Starship", description: "Fifteenth integrated flight test of Starship, deploying Starlink V3 satellites." },
    starshipDesc: { id: "2b", name: "Starship | Starlink V3 Demo", mission: "Starlink V3 Demo", mission_type: "Communications", rocket: "Starship", description: "Test flight of Starship carrying the first Starlink V3 satellites." },
    crew: { id: "3", name: "Falcon 9 Block 5 | Crew-13", mission: "Crew-13", mission_type: "Human Exploration", rocket: "Falcon 9 Block 5", description: "Crew Dragon will carry four astronauts to the International Space Station." },
    artemis: { id: "4", name: "Space Launch System Block 1 | Artemis III", mission: "Artemis III", mission_type: "Human Exploration", rocket: "Space Launch System Block 1", description: "The first crewed lunar landing of the Artemis programme." },
    kuiper: { id: "5", name: "Atlas V 551 | Project Kuiper (KA-03)", mission: "Project Kuiper (KA-03)", mission_type: "Communications", rocket: "Atlas V 551", description: "Batch of Amazon's Project Kuiper broadband satellites." },
    leo: { id: "5b", name: "Vulcan Centaur | Amazon Leo (LV-04)", mission: "Amazon Leo (LV-04)", mission_type: "Communications", rocket: "Vulcan Centaur", description: "Batch of Amazon Leo broadband satellites." },
    oneweb: { id: "6", name: "Falcon 9 Block 5 | OneWeb Launch 22", mission: "OneWeb Launch 22", mission_type: "Communications", rocket: "Falcon 9 Block 5", description: "Satellites for the OneWeb constellation." },
    qianfan: { id: "7", name: "Long March 6A | Qianfan (Thousand Sails) Group 9", mission: "Qianfan Group 9", mission_type: "Communications", rocket: "Long March 6A", description: "Spacesail Qianfan (G60) megaconstellation batch." },
    guowang: { id: "8", name: "Long March 5B | Guowang Group 12", mission: "Guowang Group 12", mission_type: "Communications", rocket: "Long March 5B", description: "China SatNet Guowang constellation." },
    ariane64: { id: "9", name: "Ariane 64 | Amazon Leo (LE-01)", mission: "Amazon Leo (LE-01)", mission_type: "Communications", rocket: "Ariane 64", description: "Maiden flight of the Ariane 64 variant, carrying Amazon Leo satellites." },
    neutron: { id: "10", name: "Neutron | Maiden Flight", mission: "Maiden Flight", mission_type: "Test Flight", rocket: "Neutron", description: "First flight of Rocket Lab's Neutron." },
    telescope: { id: "11", name: "Falcon Heavy | Nancy Grace Roman Space Telescope", mission: "Roman Space Telescope", mission_type: "Astrophysics", rocket: "Falcon Heavy", description: "NASA infrared space telescope." },
    earthSci: { id: "12", name: "Vega-C | Biomass", mission: "Biomass", mission_type: "Earth Science", rocket: "Vega-C", description: "ESA forest biomass mission." },
    probe: { id: "13", name: "Long March 5 | Chang'e-7", mission: "Chang'e-7", mission_type: "Lunar Science", rocket: "Long March 5", description: "Chinese lunar south pole orbiter, lander and rover." },
    cargo: { id: "14", name: "Falcon 9 Block 5 | CRS-35", mission: "CRS-35", mission_type: "Resupply", rocket: "Falcon 9 Block 5", description: "Cargo Dragon resupply mission to the ISS, with science experiments." },
    comsat: { id: "15", name: "Ariane 6 | Eutelsat 36D", mission: "Eutelsat 36D", mission_type: "Communications", rocket: "Ariane 62", description: "Geostationary communications satellite." },
    rideshare: { id: "16", name: "Falcon 9 Block 5 | Transporter-18", mission: "Transporter-18", mission_type: "Dedicated Rideshare", rocket: "Falcon 9 Block 5", description: "Rideshare mission." },
    artemisI: { id: "17", name: "Space Launch System Block 1 | Artemis I", mission: "Artemis I", mission_type: "Test Flight", rocket: "Space Launch System Block 1", description: "Uncrewed lunar orbit test." },
  };
  const c = (k) => classifyLaunch(L[k]);
  ok(!c("starlink").show && c("starlink").routine, "Starlink rutinario: fuera");
  ok(c("starship").show && c("starship").reasons.includes("test"), "Starship Flight 15 (descripción menciona Starlink): dentro, «Prueba de vehículo nuevo»", JSON.stringify(c("starship")));
  ok(c("starshipDesc").show && c("starshipDesc").reasons.includes("test"), "Starship con Starlink V3 y «test flight» en la descripción: dentro");
  ok(c("crew").show && c("crew").reasons.includes("crew"), "Crew Dragon (Crew-13): dentro, «Tripulado»", JSON.stringify(c("crew")));
  ok(c("artemis").show && c("artemis").reasons.includes("moon") && c("artemis").reasons.includes("crew"), "Artemis III: dentro, «Luna» y «Tripulado»", JSON.stringify(c("artemis")));
  ok(c("artemisI").show && c("artemisI").reasons.includes("moon") && !c("artemisI").reasons.includes("crew"), "Artemis I (sin tripulación): dentro, «Luna», no «Tripulado»", JSON.stringify(c("artemisI")));
  ok(!c("kuiper").show && c("kuiper").routine, "Kuiper: fuera");
  ok(!c("leo").show, "Amazon Leo (antes Kuiper) rutinario: fuera");
  ok(!c("oneweb").show && !c("qianfan").show && !c("guowang").show, "OneWeb, Qianfan/G60 y Guowang: fuera");
  ok(c("ariane64").show && c("ariane64").reasons.includes("test"), "primer vuelo de Ariane 64 con satélites Amazon Leo: dentro (excepción de vehículo nuevo)", JSON.stringify(c("ariane64")));
  ok(c("neutron").show && c("neutron").reasons.includes("test"), "Neutron, vuelo inaugural: dentro");
  ok(c("telescope").show && c("telescope").reasons.includes("science"), "telescopio espacial: dentro, «Ciencia»");
  ok(c("earthSci").show && c("earthSci").reasons.includes("science"), "ciencia de la Tierra (Biomass): dentro, «Ciencia»");
  ok(c("probe").show && c("probe").reasons.includes("moon") && c("probe").reasons.includes("science"), "Chang'e-7: dentro, «Luna» y «Ciencia»");
  ok(!c("cargo").show && !c("comsat").show && !c("rideshare").show, "carguero de rutina, satélite de comunicaciones y rideshare: fuera");
  ok(filterLaunches(Object.values(L)).length === 10, "filterLaunches deja 10 de 19", String(filterLaunches(Object.values(L)).length));
  ok(!classifyLaunch(null).show && !classifyLaunch({}).show && filterLaunches(null).length === 0, "entradas vacías o inválidas no rompen");
  // eventos
  const net = (k, extra = {}) => ({ ...L[k], net: "2026-12-10T15:00:00Z", net_precision: "Minute", ...extra });
  const feed = buildFeedEvents({ from: U("2026-11-14T00:00"), days: 90, launches: [net("starlink"), net("crew"), net("starship", { net: "2026-12-12T00:00:00Z", net_precision: "Day" }), net("kuiper")] });
  ok(feed.length === 2 && feed.every(e => e.type === "launch"), "como eventos: solo Crew-13 y Starship");
  ok(feed.find(e => e.id === "launch-3").allDay === false && feed.find(e => e.id === "launch-2").allDay === true, "precisión «Day» → fecha sin hora");
}

// ─── 6 · .ics ────────────────────────────────────────────────────────────────
console.log("Archivo .ics");
{
  const ev = { uid: "opp-Uranus-20261125@teseo.yachaydeep.com", start: U("2026-11-25T22:33"), durationMin: 60, title: "Urano en oposición", description: "Línea 1; con punto y coma, comas\nLínea 2", url: "https://in-the-sky.org/" };
  const s = buildIcs(ev, { now: U("2026-11-14T12:00") });
  ok(s.startsWith("BEGIN:VCALENDAR\r\n") && s.trimEnd().endsWith("END:VCALENDAR") && s.endsWith("\r\n"), "BEGIN:VCALENDAR … END:VCALENDAR");
  ok(!/[^\r]\n/.test(s), "todos los saltos de línea son CRLF");
  ok(s.includes("\r\nDTSTART:20261125T223300Z\r\n") && s.includes("\r\nDTEND:20261125T233300Z\r\n"), "DTSTART y DTEND en UTC (…Z)");
  ok(s.includes("\r\nUID:opp-Uranus-20261125@teseo.yachaydeep.com\r\n"), "UID estable");
  ok(buildIcs(ev, { now: 1 }).split("\r\n").filter(l => l.startsWith("UID:"))[0] === s.split("\r\n").filter(l => l.startsWith("UID:"))[0], "mismo evento, mismo UID aunque cambie la hora de generación");
  ok(s.includes("VERSION:2.0") && s.includes("BEGIN:VEVENT") && s.includes("END:VEVENT") && s.includes("DTSTAMP:20261114T120000Z"), "VERSION, VEVENT y DTSTAMP");
  ok(s.includes("SUMMARY:Urano en oposición") && s.includes("DESCRIPTION:Línea 1\\; con punto y coma\\, comas\\nLínea 2"), "texto escapado (; , salto de línea)");
  ok(buildIcs({ uid: "x@teseo", start: 0, title: "T" }).includes("BEGIN:VALARM\r\nACTION:DISPLAY") && buildIcs({ uid: "x@teseo", start: 0, title: "T", allDay: true }).includes("TRIGGER:-PT6H"), "el .ics trae aviso (30 min antes; víspera 18:00 en día completo)");
  ok(icsEscape("a\\b;c,d\n") === "a\\\\b\\;c\\,d\\n", "icsEscape (RFC 5545: \; escapado)");
  ok(icsUtc(Date.UTC(2027, 0, 5, 3, 4, 5)) === "20270105T030405Z", "icsUtc con ceros a la izquierda");
  const long = buildIcs({ ...ev, description: "ñ".repeat(120) });
  const enc = new TextEncoder();
  ok(long.split("\r\n").every(l => enc.encode(l).length <= 75), "líneas plegadas a ≤ 75 octetos (UTF-8)");
  ok(long.replace(/\r\n /g, "").includes("DESCRIPTION:" + "ñ".repeat(120)), "el plegado no pierde ni parte caracteres");
  const day = buildIcs({ uid: "m@x", start: U("2026-12-14T12:00"), allDay: true, title: "Gemínidas" });
  ok(day.includes("\r\nDTSTART;VALUE=DATE:20261214\r\n") && day.includes("\r\nDTEND;VALUE=DATE:20261215\r\n"), "evento de día completo: DTSTART;VALUE=DATE y DTEND al día siguiente");
  ok(icsFileName(ev) === "teseo-2026-11-25-urano-en-oposicion.ics", "nombre de archivo sin acentos ni espacios", icsFileName(ev));
}

// ─── 7 · Lugar, agrupación y textos ──────────────────────────────────────────
console.log("Lugar, agrupación, ISS y textos");
{
  const store = (v) => ({ getItem: (k) => (k === PLACE_KEY ? v : null) });
  ok(PLACE_KEY === "teseo_place_v1", "misma clave que el Cielo: teseo_place_v1");
  let p = readPlace(store(null));
  ok(p.isDefault && p.name === "Quito" && p.lat === -0.22 && p.lon === -78.5125 && p.elev === 2850, "sin dato guardado: Quito (−0,22; −78,5125; 2.850 m)");
  p = readPlace(store(JSON.stringify({ kind: "Cayambe", lat: 0.0431, lon: -78.1456, elev: 2830 })));
  ok(!p.isDefault && p.name === "Cayambe" && p.lat === 0.0431 && p.elev === 2830, "lugar guardado: Cayambe");
  p = readPlace(store(JSON.stringify({ kind: "me", lat: 40.4, lon: -3.7, elev: null })));
  ok(p.kind === "me" && p.name === null && p.elev === 0, "GPS: sin nombre y altitud 0 si no hay");
  ok(readPlace(store(JSON.stringify({ kind: "off" }))).isDefault, "«off» (salió de Mi cielo): Quito");
  ok(readPlace(store("{no es json")).isDefault && readPlace(store(JSON.stringify({ kind: "x", lat: 999, lon: 0 }))).isDefault && readPlace(null).isDefault, "dato corrupto o fuera de rango: Quito");

  const from = U("2026-11-14T12:00");
  const sky = buildSkyEvents({ from, days: 90, lat: QUITO.lat, lon: QUITO.lon, showers });
  const types = new Set(sky.map(e => e.type));
  ok(["moon", "meteor", "planet", "eclipse", "season"].every(k => types.has(k)), `90 días desde Quito con Luna, meteoros, planetas, eclipses y estaciones (${[...types].join(", ")})`);
  const by = (id) => sky.find(e => e.id === id);
  ok(!!by("opp-Uranus-20261125") && !!by("season-decSolstice-20261221") && !!by("meteor-Geminids-2026") && !!by("meteor-Quadrantids-2027") && !!by("se-2027-02-06"), "incluye oposición de Urano, solsticio, Gemínidas, Cuadrántidas y el eclipse solar del 6-feb-2027");
  ok(sky.every(e => e.t >= from && e.t <= from + 90 * DAY + DAY), "todos dentro de la ventana de 90 días");
  const gem = by("meteor-Geminids-2026");
  ok(gem.visible === true && gem.data.maxAlt > 40 && gem.data.moon && gem.data.moon.level !== undefined, `Gemínidas desde Quito: radiante hasta ${gem.data.maxAlt.toFixed(0)}° y Luna calculada`);
  const urs = by("meteor-Ursids-2026");
  ok(urs.data.maxAlt < 20 && urs.data.moon.level === "strong", `Úrsidas (dec +76°) desde Quito: radiante bajo (${urs.data.maxAlt.toFixed(0)}°) y Luna llena estorba`);
  const dec = by("season-decSolstice-20261221");
  ok(Math.abs(dec.data.noonAlt - 66.8) < 0.1, "solsticio de diciembre en Quito: Sol a ~66,8° al mediodía (90° − |−0,22° + 23,44°|)");
  // lugar distinto → visibilidad distinta: Quadrantids desde Quito (dec +49°) suben; desde latitud −60° no
  const quad = buildSkyEvents({ from, days: 90, lat: -60, lon: -60, showers }).find(e => e.id === "meteor-Quadrantids-2027");
  ok(quad && quad.visible === false, "Cuadrántidas desde 60° S: el radiante no sube de noche");

  const g = groupByMonth(buildEvents({ from, days: 90, lat: QUITO.lat, lon: QUITO.lon, showers }));
  ok(g.length >= 3 && g.every((m, i) => i === 0 || m.key > g[i - 1].key), "agrupado por mes, en orden");
  ok(g.every(m => m.items.every((e, i) => i === 0 || e.t >= m.items[i - 1].t)), "cronológico dentro de cada mes");

  const iss = normalizeIss({ passes: [
    { start: { t: "2026-11-15T23:30:10Z", compass_es: "SO", compass: "SW" }, max: { t: "2026-11-15T23:33:40Z", alt: 62.3 }, end: { t: "2026-11-15T23:37:00Z", compass_es: "NE", compass: "NE" }, duration_s: 410, max_alt: 62.3, visible: true, visible_from: { t: "2026-11-15T23:30:10Z" }, visible_duration_s: 400, mag: -3.2 },
    { start: { t: "2026-11-16T10:00:00Z" }, max: { t: "2026-11-16T10:03:00Z", alt: 20 }, end: { t: "2026-11-16T10:06:00Z" }, duration_s: 360, max_alt: 20, visible: false },
  ] });
  ok(iss.length === 1 && iss[0].type === "iss" && iss[0].data.maxAlt === 62.3 && iss[0].visible === true, "ISS: solo las pasadas visibles, con altura máxima");
  ok(normalizeIss(null).length === 0 && normalizeIss({}).length === 0 && normalizeIss([null, 3, {}]).length === 0, "ISS: respuesta vacía o rara → ninguna pasada, sin error");

  // textos en ES y EN para todos los eventos (12 meses): sin undefined/NaN y con título
  const f = { time: (ms) => new Date(ms).toISOString().slice(11, 16), n: (x, d = 0) => Number(x).toFixed(d), pct: (x) => `${Math.round(x * 100)} %`, mag: "magnitud" };
  const feed = buildFeedEvents({ from, days: 365, launches: [{ id: "z", name: "Falcon 9 Block 5 | Crew-13", mission: "Crew-13", mission_type: "Human Exploration", rocket: "Falcon 9", provider: "SpaceX", net: "2027-01-10T10:00:00Z", description: "NASA astronauts", webcast_url: "https://example.org/w", info_url: "javascript:alert(1)" }], issPasses: [] });
  const everything = [...buildSkyEvents({ from, days: 365, lat: QUITO.lat, lon: QUITO.lon, showers }), ...feed, ...iss];
  let bad = 0, noVis = 0;
  for (const lang of ["es", "en"]) for (const e of everything) {
    const d = describeEvent(e, lang, f), all = [d.title, d.what, d.vis && d.vis.text, d.note].join(" | ");
    if (!d.title || !d.what || /undefined|NaN|\[object/.test(all)) { bad++; console.log("   texto roto:", lang, e.id, all.slice(0, 160)); }
    if (e.type === "eclipse" && !d.vis && e.sub === "moon") noVis++;
  }
  ok(bad === 0, `textos ES y EN de los ${everything.length} eventos de 12 meses sin «undefined» ni «NaN»`);
  ok(noVis === 0, "todo eclipse lunar dice si es visible o no");
  const la = describeEvent(feed[0], "es", f);
  ok(la.links.length === 1 && la.links[0].href === "https://example.org/w", "lanzamientos: solo enlaces http(s) (se descarta javascript:)");
  ok(describeEvent(everything.find(e => e.id === "se-2027-02-06"), "es", f).what.includes("NUNCA mires al Sol"), "eclipse solar: aviso de seguridad");
  ok(howToSee(5.7, "es").includes("prismáticos") && howToSee(7.8, "es").includes("telescopio") && howToSee(-2, "es") === "A simple vista.", "cómo ver según la magnitud (Urano 5,7 / Neptuno 7,8 / Júpiter)");
  ok(Object.keys(TC.es).every(k => k in TC.en) && Object.keys(TC.en).every(k => k in TC.es), "ES y EN tienen las mismas claves");
  ok(JSON.stringify(cleanParams({ card: "calendar", kind: "ics" })) === '{"card":"calendar","kind":"ics"}', "métricas: card y kind pasan la lista blanca de track.js");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
