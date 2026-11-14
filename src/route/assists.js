// assists.js — datos puros de «Catapultas» (asistencias gravitatorias) en Ruta.
// Sin React ni DOM: se prueba en Node con scripts/test_route_assists.mjs.
//
// CADA fecha de esta lista se comprobó en la fuente indicada en `sources` de su
// misión (NASA, JPL, ESA y, para MESSENGER, el sitio de la misión en Johns Hopkins
// APL, que la operó para NASA). Si una fuente solo da el mes, aquí también solo hay
// el mes ("2024-08"). Las fechas son las que da la fuente (la mayoría en UT; algunas
// de lanzamiento o llegada, en hora local de EE. UU.). Lo que una fuente no dice no
// está aquí: por eso a Parker le faltan las fechas de sus cuatro primeros sobrevuelos
// de Venus y a Pioneer 11 el día del lanzamiento.
//
// Evento: { body, kind, date, end?, n?, scheduled? }
//   kind: "launch"  lanzamiento (siempre desde la Tierra)
//         "assist"  catapulta (sobrevuelo que cambia la velocidad respecto al Sol)
//         "flyby"   sobrevuelo del destino (la nave no se queda en órbita)
//         "arrival" llegada al destino (entra en órbita o aterriza)
//   date: "AAAA-MM-DD" o "AAAA-MM" (solo el mes, según la fuente); end: fin de una ventana
//   n: veces seguidas (p. ej. 7 sobrevuelos de Venus de Parker)
//   scheduled: la fecha es la prevista por la agencia (no ha ocurrido a la fecha de la fuente)

import { SEMI_MAJOR_AXIS_AU, hohmannLocal } from "../ui/orbits.js";

const NASA_GA = { label: "NASA, «Basics of Space Flight», cap. 4 (asistencia gravitatoria)", url: "https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/" };

const voyager2Events = [
  { body: "earth", kind: "launch", date: "1977-08-20" },
  { body: "jupiter", kind: "assist", date: "1979-07-09" },
  { body: "saturn", kind: "assist", date: "1981-08-26" },
  { body: "uranus", kind: "assist", date: "1986-01-24" },
  { body: "neptune", kind: "flyby", date: "1989-08-25" },
];
const voyager2Sources = [
  { label: "NASA, Voyager 2", url: "https://science.nasa.gov/mission/voyager/voyager-2" },
  { label: "NASA, Voyager 1 y 2: viaje planetario", url: "https://science.nasa.gov/mission/voyager/planetary-voyage" },
];

export const MISSIONS = {
  voyager2_neptune: {
    id: "voyager2_neptune", name: "Voyager 2", agency: "NASA", dest: "neptune", launch: "1977-08-20",
    events: voyager2Events,
    note: {
      es: "NASA: Voyager 2 es la única nave que ha visitado Urano y Neptuno. La técnica recortó el viaje a Neptuno de unos 30 años a 12. Se apoyó en una alineación de Júpiter, Saturno, Urano y Neptuno que, según NASA, se da cada unos 175 años.",
      en: "NASA: Voyager 2 is the only spacecraft to have visited Uranus and Neptune. The technique cut the trip to Neptune from about 30 years to 12. It relied on an alignment of Jupiter, Saturn, Uranus and Neptune that, according to NASA, happens about every 175 years.",
    },
    sources: voyager2Sources,
  },
  voyager2_uranus: {
    id: "voyager2_uranus", name: "Voyager 2", agency: "NASA", dest: "uranus", launch: "1977-08-20",
    events: voyager2Events.slice(0, 4).map((e) => (e.body === "uranus" ? { ...e, kind: "flyby" } : e)),
    note: {
      es: "NASA: Voyager 2 es la única nave que ha visitado Urano y Neptuno. Siguió después hasta Neptuno (1989); aquí se cuenta solo el tramo hasta Urano.",
      en: "NASA: Voyager 2 is the only spacecraft to have visited Uranus and Neptune. It went on to Neptune (1989); only the leg up to Uranus is counted here.",
    },
    sources: voyager2Sources,
  },
  voyager1: {
    id: "voyager1", name: "Voyager 1", agency: "NASA", dest: "saturn", launch: "1977-09-05",
    events: [
      { body: "earth", kind: "launch", date: "1977-09-05" },
      { body: "jupiter", kind: "assist", date: "1979-03-05" },
      { body: "saturn", kind: "flyby", date: "1980-11-12" },
    ],
    note: null,
    sources: [{ label: "NASA, Voyager 1", url: "https://science.nasa.gov/mission/voyager/voyager-1" }],
  },
  pioneer11: {
    id: "pioneer11", name: "Pioneer 11", agency: "NASA", dest: "saturn", launch: "1973-04-06",
    events: [
      { body: "earth", kind: "launch", date: "1973-04" },
      { body: "jupiter", kind: "assist", date: "1974-12-03" },
      { body: "saturn", kind: "flyby", date: "1979-09-01" },
    ],
    note: {
      es: "NASA: tras el sobrevuelo de Júpiter, los planificadores usaron su gravedad para lanzar la nave hacia Saturno.",
      en: "NASA: after the Jupiter flyby, mission planners used its gravity to sling the spacecraft toward Saturn.",
    },
    sources: [
      { label: "NASA Historia, Pioneer 11 (lanzamiento y Saturno)", url: "https://www.nasa.gov/history/45-years-ago-pioneer-11-launched-to-study-jupiter-and-saturn" },
      { label: "NASA, Pioneer 11 en Júpiter (3 dic 1974)", url: "https://www.nasa.gov/feature/45-years-ago-pioneer-11-explores-jupiter" },
    ],
  },
  cassini: {
    id: "cassini", name: "Cassini–Huygens", agency: "NASA", dest: "saturn", launch: "1997-10-15",
    events: [
      { body: "earth", kind: "launch", date: "1997-10-15" },
      { body: "venus", kind: "assist", date: "1998-04" },
      { body: "venus", kind: "assist", date: "1999-06" },
      { body: "earth", kind: "assist", date: "1999-08" },
      { body: "jupiter", kind: "assist", date: "2000-12" },
      { body: "saturn", kind: "arrival", date: "2004-07-01" },
    ],
    note: {
      es: "Entró en órbita de Saturno el 1 de julio de 2004 (UTC; el 30 de junio en California).",
      en: "It entered Saturn orbit on 1 July 2004 (UTC; 30 June in California).",
    },
    sources: [{ label: "NASA, cronología de Cassini", url: "https://science.nasa.gov/mission/cassini/the-journey/timeline/" }],
  },
  galileo: {
    id: "galileo", name: "Galileo", agency: "NASA", dest: "jupiter", launch: "1989-10-18",
    events: [
      { body: "earth", kind: "launch", date: "1989-10-18" },
      { body: "venus", kind: "assist", date: "1990-02-10" },
      { body: "earth", kind: "assist", date: "1990-12-08" },
      { body: "earth", kind: "assist", date: "1992-12-08" },
      { body: "jupiter", kind: "arrival", date: "1995-12-07" },
    ],
    note: {
      es: "NASA: como la trayectoria directa prevista ya no estaba disponible, los ingenieros diseñaron una ruta con asistencias gravitatorias.",
      en: "NASA: because the planned direct trajectory was no longer available, engineers designed a flight path using gravity assists.",
    },
    sources: [{ label: "NASA, Galileo", url: "https://science.nasa.gov/mission/galileo/" }],
  },
  juno: {
    id: "juno", name: "Juno", agency: "NASA", dest: "jupiter", launch: "2011-08-05",
    events: [
      { body: "earth", kind: "launch", date: "2011-08-05" },
      { body: "earth", kind: "assist", date: "2013-10-09" },
      { body: "jupiter", kind: "arrival", date: "2016-07-04" },
    ],
    note: {
      es: "Llegó a Júpiter el 4 de julio de 2016 (hora del Pacífico, según JPL).",
      en: "It reached Jupiter on 4 July 2016 (Pacific time, per JPL).",
    },
    sources: [{ label: "JPL, Juno: datos de la misión", url: "https://www.jpl.nasa.gov/news/press_kits/juno/facts" }],
  },
  europaclipper: {
    id: "europaclipper", name: "Europa Clipper", agency: "NASA", dest: "jupiter", launch: "2024-10-14",
    events: [
      { body: "earth", kind: "launch", date: "2024-10-14" },
      { body: "mars", kind: "assist", date: "2025-03-01" },
      { body: "earth", kind: "assist", date: "2026-12-02", end: "2026-12-07", scheduled: true },
      { body: "jupiter", kind: "arrival", date: "2030-04-11", scheduled: true },
    ],
    note: {
      es: "Fechas previstas por JPL: sobrevuelo de la Tierra entre el 2 y el 7 de diciembre de 2026 (a unos 3.200 km) y entrada en órbita de Júpiter el 11 de abril de 2030.",
      en: "Dates planned by JPL: Earth flyby between 2 and 7 December 2026 (about 3,200 km away) and Jupiter orbit insertion on 11 April 2030.",
    },
    sources: [
      { label: "JPL, kit de prensa: misión", url: "https://www.jpl.nasa.gov/press-kits/europa-clipper/mission/" },
      { label: "NASA, cronología de Europa Clipper", url: "https://science.nasa.gov/mission/europa-clipper/mission-timeline" },
    ],
  },
  juice: {
    id: "juice", name: "JUICE", agency: "ESA", dest: "jupiter", launch: "2023-04-14",
    events: [
      { body: "earth", kind: "launch", date: "2023-04-14" },
      { body: "moon", kind: "assist", date: "2024-08" },
      { body: "earth", kind: "assist", date: "2024-08" },
      { body: "venus", kind: "assist", date: "2025-08-31" },
      { body: "earth", kind: "assist", date: "2026-09-28" },
      { body: "earth", kind: "assist", date: "2029-01", scheduled: true },
      { body: "jupiter", kind: "arrival", date: "2031-07-21", scheduled: true },
    ],
    note: {
      es: "ESA: la Luna y la Tierra se encadenan en un solo paso (primer sobrevuelo Luna-Tierra de la historia). Llegada a Júpiter prevista para el 21 de julio de 2031.",
      en: "ESA: the Moon and Earth are chained in a single pass (the first lunar-Earth flyby ever). Jupiter arrival is planned for 21 July 2031.",
    },
    sources: [
      { label: "ESA, calendario de la misión", url: "https://www.cosmos.esa.int/web/juice/mission-calendar" },
      { label: "ESA, sobrevuelo de Venus", url: "https://www.esa.int/Enabling_Support/Operations/Juice_team_resolves_anomaly_on_approach_to_Venus" },
      { label: "ESA, sobrevuelo de la Tierra", url: "https://www.esa.int/articles/juice-to-fly-past-earth-for-third-gravity-assist" },
    ],
  },
  messenger: {
    id: "messenger", name: "MESSENGER", agency: "NASA", dest: "mercury", launch: "2004-08-03",
    events: [
      { body: "earth", kind: "launch", date: "2004-08-03" },
      { body: "earth", kind: "assist", date: "2005-08-02" },
      { body: "venus", kind: "assist", date: "2006-10-24" },
      { body: "venus", kind: "assist", date: "2007-06-05" },
      { body: "mercury", kind: "assist", date: "2008-01-14" },
      { body: "mercury", kind: "assist", date: "2008-10-06" },
      { body: "mercury", kind: "assist", date: "2009-09-29" },
      { body: "mercury", kind: "arrival", date: "2011-03-18" },
    ],
    note: {
      es: "Una Tierra, dos Venus y tres Mercurio antes de entrar en órbita de Mercurio el 18 de marzo de 2011.",
      en: "One Earth, two Venus and three Mercury flybys before entering Mercury orbit on 18 March 2011.",
    },
    sources: [{ label: "MESSENGER (NASA/APL), diseño de la misión", url: "https://messenger.jhuapl.edu/About/Mission-Design.html" }],
  },
  bepicolombo: {
    id: "bepicolombo", name: "BepiColombo", agency: "ESA", dest: "mercury", launch: "2018-10-20",
    events: [
      { body: "earth", kind: "launch", date: "2018-10-20" },
      { body: "earth", kind: "assist", date: "2020-04-10" },
      { body: "venus", kind: "assist", date: "2020-10-15" },
      { body: "venus", kind: "assist", date: "2021-08-11" },
      { body: "mercury", kind: "assist", n: 6, date: "2025-01-08" },
      { body: "mercury", kind: "arrival", date: "2026-11-21", scheduled: true },
    ],
    note: {
      es: "Seis sobrevuelos de Mercurio: 1 oct 2021, 23 jun 2022, 19 jun 2023, 4 sep 2024, 1 dic 2024 y 8 ene 2025. ESA prevé la entrada en órbita de Mercurio el 21 de noviembre de 2026.",
      en: "Six Mercury flybys: 1 Oct 2021, 23 Jun 2022, 19 Jun 2023, 4 Sep 2024, 1 Dec 2024 and 8 Jan 2025. ESA plans Mercury orbit insertion on 21 November 2026.",
    },
    sources: [
      { label: "ESA, ficha de BepiColombo", url: "https://www.esa.int/Science_Exploration/Space_Science/BepiColombo/BepiColombo_factsheet" },
      { label: "ESA, viaje a Mercurio", url: "https://www.esa.int/Science_Exploration/Space_Science/BepiColombo/Journey_to_Mercury" },
    ],
  },
  parker: {
    id: "parker", name: "Parker Solar Probe", agency: "NASA", dest: "venus", launch: "2018-08-12", target: "sun",
    events: [
      { body: "earth", kind: "launch", date: "2018-08-12" },
      { body: "venus", kind: "assist", n: 7, date: "2024-11-06" },
      { body: "sun", kind: "flyby", date: "2024-12-24" },
    ],
    note: {
      es: "Siete sobrevuelos de Venus. Cada uno frena a la sonda (el de octubre de 2021 le quitó unos 6.040 mph) y le permite acercarse más al Sol. Fechas verificadas: 5.º, 16 oct 2021; 6.º, ago 2023; 7.º y último, 6 nov 2024. El 24 dic 2024 pasó a 3,8 millones de millas de la superficie solar.",
      en: "Seven Venus flybys. Each one slows the probe (the October 2021 one cut about 6,040 mph) and lets it get closer to the Sun. Verified dates: 5th, 16 Oct 2021; 6th, Aug 2023; 7th and last, 6 Nov 2024. On 24 Dec 2024 it passed within 3.8 million miles of the solar surface.",
    },
    sources: [
      { label: "NASA, Parker Solar Probe (lanzamiento)", url: "https://science.nasa.gov/mission/parker-solar-probe/" },
      { label: "Johns Hopkins APL, séptimo sobrevuelo de Venus", url: "https://www.jhuapl.edu/news/news-releases/241108-venus-gravity-assist-7" },
      { label: "NASA, quinto sobrevuelo de Venus", url: "https://science.nasa.gov/blogs/parker-solar-probe/2021/10/19/parker-solar-probe-completes-its-fifth-venus-flyby" },
    ],
  },
  perseverance: {
    id: "perseverance", name: "Mars 2020 (Perseverance)", agency: "NASA", dest: "mars", launch: "2020-07-30",
    events: [
      { body: "earth", kind: "launch", date: "2020-07-30" },
      { body: "mars", kind: "arrival", date: "2021-02-18" },
    ],
    note: {
      es: "Viaje directo de unos seis meses y medio: sin sobrevuelos de otros planetas por el camino (203 días, según JPL).",
      en: "A direct trip of about six and a half months: no flybys of other planets along the way (203 days, per JPL).",
    },
    sources: [{ label: "JPL, kit de prensa de Mars 2020", url: "https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission" }],
  },
};

/** Misiones por planeta de destino, en el orden en que se muestran. */
export const BY_DEST = {
  mercury: ["bepicolombo", "messenger"],
  venus: ["parker"],
  earth: [],
  mars: ["perseverance"],
  jupiter: ["europaclipper", "juice", "juno", "galileo"],
  saturn: ["cassini", "voyager1", "pioneer11"],
  uranus: ["voyager2_uranus"],
  neptune: ["voyager2_neptune"],
};

/** Qué planetas no necesitan catapulta para ir desde la Tierra, con la razón. */
export const DIRECT_DEST = { mars: true, venus: true };

/** Misiones de un destino (objetos completos). */
export const missionsFor = (destId) => (BY_DEST[destId] || []).map((id) => MISSIONS[id]);

// ─── Fechas ──────────────────────────────────────────────────────────────────

const DAY_MS = 86400000;
/** "AAAA-MM-DD" o "AAAA-MM" → milisegundos UTC (el mes solo cuenta como el día 1). */
export function dateMs(s) {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s || "");
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1);
}
export const hasDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

/** Duración del viaje en años: del lanzamiento a la llegada (o al último hito). */
export function missionYears(m) {
  const last = m.events[m.events.length - 1];
  return (dateMs(last.date) - dateMs(m.launch)) / DAY_MS / 365.25;
}

/** Años que tardaría una transferencia de Hohmann directa de la Tierra al destino (cálculo de Teseo). */
export function hohmannYears(destId) {
  return hohmannLocal("earth", destId).transfer_time_days / 365.25;
}

/** Velocidad orbital circular (km/s) de un planeta: 29,7847 km/s / √(a en UA), como en orbits.js. */
export function orbitalSpeedKmS(id) {
  return 29.7847 / Math.sqrt(SEMI_MAJOR_AXIS_AU[id]);
}

/** Tope teórico del cambio de velocidad respecto al Sol de un sobrevuelo: 2 · v∞ (giro de 180°). */
export const maxFlybyDv = (vInf) => 2 * vInf;

/** Primer hito aún por venir (fecha posterior a `now`), o null. `now` en ms. */
export function nextMilestone(m, now = Date.now()) {
  for (const e of m.events) {
    if (e.kind === "launch") continue;
    const t = dateMs(e.end || e.date) + (hasDay(e.end || e.date) ? DAY_MS : 31 * DAY_MS);
    if (t > now) return e;
  }
  return null;
}

/** Días hasta el inicio de un evento (puede ser negativo). */
export const daysTo = (e, now = Date.now()) => Math.ceil((dateMs(e.date) - now) / DAY_MS);

// ─── Formato de fechas (Intl, siempre en UTC) ────────────────────────────────

const loc = (lang) => (lang === "es" ? "es" : "en-US");
const dfmt = (lang, o) => new Intl.DateTimeFormat(loc(lang), { timeZone: "UTC", ...o });
const noDot = (s) => s.replace(".", "");

/**
 * Fecha de un evento. Corta: «oct 1997». Larga: «15 oct 1997» (solo si la fuente
 * da el día; si no, sigue siendo «oct 1997»). Ventanas: «2–7 dic 2026» / «Dec 2–7, 2026».
 */
export function eventDate(e, lang, long = false) {
  const a = dateMs(e.date);
  if (e.end) {
    const b = dateMs(e.end);
    const d1 = new Date(a).getUTCDate(), d2 = new Date(b).getUTCDate();
    const mon = noDot(dfmt(lang, { month: "short" }).format(a)), yr = new Date(a).getUTCFullYear();
    return lang === "es" ? `${d1}–${d2} ${mon} ${yr}` : `${mon} ${d1}–${d2}, ${yr}`;
  }
  if (long && hasDay(e.date)) return noDot(dfmt(lang, { day: "numeric", month: "short", year: "numeric" }).format(a));
  return noDot(dfmt(lang, { month: "short", year: "numeric" }).format(a));
}
