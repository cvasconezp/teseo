// tour.js — el tour para quien empieza en la astronomía y en Teseo: cada parada une una idea del cielo con una
// función de la app (el botón del que habla se ilumina, con un «Pruébalo»). Las paradas de objetos eligen uno que
// esté sobre el horizonte del lugar a esa hora. Puro (sin React ni three.js); se prueba en scripts/test_tour.mjs.
//
// Paradas: mirar alrededor · el lugar (atardecer en Guiza) · el tiempo (un volcán al atardecer) · una constelación ·
// una estrella brillante · un planeta o la Luna · un objeto de cielo profundo · ¿se puede observar hoy? · esta noche.

/** Las paradas, en orden. target = botón que se ilumina (atributo data-tour), o null. */
export const TOUR_STOPS = [
  { id: "look", target: null },
  { id: "place", target: "place", scene: "giza" },
  { id: "time", target: "time", scene: "volcano" },
  { id: "con", target: null, pick: "con" },
  { id: "star", target: null, pick: "star" },
  { id: "planet", target: "time", pick: "planet" },
  { id: "deep", target: "layers", pick: "deep" },
  { id: "weather", target: "weather" },
  { id: "tonight", target: "tonight" },
];

/** Candidatos, en orden de preferencia (los más reconocibles primero). */
export const CANDIDATES = {
  con: ["Ori", "Sco", "Cru", "UMa", "Cyg", "Leo", "Tau", "CMa", "Sgr", "Cas", "Gem", "Lyr", "Boo", "Aql", "Peg", "Cen"],
  star: ["Sirius", "Canopus", "Arcturus", "Vega", "Capella", "Rigel", "Procyon", "Achernar", "Betelgeuse", "Altair", "Aldebaran", "Antares", "Spica", "Pollux", "Fomalhaut", "Deneb", "Regulus"],
  planet: ["Venus", "Júpiter", "Luna", "Marte", "Saturno", "Mercurio"],
  deep: [42, 45, 31, 8, 13, 44, 7, 22, 57, 27, 11, 104, 51, 81],
};

/**
 * El primer candidato que esté por encima de `minAlt` grados. altOf(c) → altitud (o null si no se conoce); sin
 * lugar (altOf null para todos), el primero que exista.
 */
export function pickVisible(cands, altOf, minAlt = 20) {
  let firstKnown = null;
  for (const c of cands) {
    const a = altOf(c);
    if (a === undefined) continue;          // no existe en los datos
    if (firstKnown === null) firstKnown = c;
    if (a === null) return c;               // sin lugar: no se puede filtrar
    if (a >= minAlt) return c;
  }
  // nada alto: el más alto que asome (> 5°), o null
  let best = null, ba = 5;
  for (const c of cands) { const a = altOf(c); if (a != null && a > ba) { best = c; ba = a; } }
  return best;
}

/**
 * Hora (Date) en que el Sol baja a `alt` grados en la tarde del día de `day` en el lugar: búsqueda binaria entre el
 * mediodía solar y 12 h después. sunAltAz(date) → { alt, az }. null si ese día el Sol no baja tanto (polos).
 */
export function sunsetAt(day, lon, sunAltAz, alt = 0) {
  // mediodía solar aproximado de ese día (UTC): 12 h − longitud/15
  const d0 = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12, 0, 0) - (lon / 15) * 3600e3);
  let a = d0.getTime(), b = a + 12 * 3600e3;
  if (!(sunAltAz(new Date(a)).alt > alt) || !(sunAltAz(new Date(b)).alt < alt)) return null;
  for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (sunAltAz(new Date(m)).alt > alt) a = m; else b = m; }
  return new Date((a + b) / 2);
}

/** Punto a `distM` metros de (lat, lon) hacia el acimut `az` (grados): { lat, lon }. */
export function offsetLL(lat, lon, az, distM) {
  const r = (az * Math.PI) / 180;
  return { lat: lat + (distM * Math.cos(r)) / 111320, lon: lon + (distM * Math.sin(r)) / (111320 * Math.cos((lat * Math.PI) / 180)) };
}

/** Acimut (grados) de (lat1, lon1) a (lat2, lon2), en plano local (vale para pocos km). */
export function bearing(lat1, lon1, lat2, lon2) {
  const dn = lat2 - lat1, de = (lon2 - lon1) * Math.cos((lat1 * Math.PI) / 180);
  return ((Math.atan2(de, dn) * 180) / Math.PI + 360) % 360;
}

/**
 * Guiza al atardecer: a 3 km al este de Keops, en la línea del Sol poniente de hoy, para ver el Sol bajar justo sobre
 * su cúspide (la pirámide, de 139 m, ocupa unos 3° sobre el horizonte desde ahí).
 */
export const KHUFU = { lat: 29.97917, lon: 31.13417 };
export function gizaView(sunAz, distM = 3000) {
  const p = offsetLL(KHUFU.lat, KHUFU.lon, sunAz + 180, distM);
  return { ...p, lookAz: sunAz };
}

/** La cumbre del Chimborazo, desde donde se ve el Sangay (unos 80 km al sureste) sobre las montañas cercanas. */
export const VOLCANO_VIEW = { lat: -1.4692, lon: -78.8175, name: { es: "Cumbre del Chimborazo", en: "Chimborazo summit" }, volcano: "Sangay" };
export const SANGAY = { lat: -2.005, lon: -78.341 };

const yrs = (ly, lang) => {
  const n = ly < 10 ? Math.round(ly * 10) / 10 : Math.round(ly);
  return `${n.toLocaleString(lang === "es" ? "es-EC" : "en-US")} ${lang === "es" ? (n === 1 ? "año" : "años") : n === 1 ? "year" : "years"}`;
};

/** Textos del tour. Las funciones reciben los datos de la parada. */
export const TOUR_T = {
  es: {
    step: (i, n) => `Parada ${i} de ${n}`, exit: "Salir del tour", prev: "Anterior", next: "Siguiente", done: "Terminar", tryIt: "Pruébalo",
    look: { title: "Mira alrededor", text: "Estás en el centro de una esfera: el cielo te rodea y el horizonte lo parte en dos. Lo que ves está en su posición real.", tip: "Arrastra para girar y pellizca (o usa la rueda) para acercar." },
    place: { title: "El cielo depende de dónde estás", text: "Así se pone hoy el Sol sobre las pirámides de Guiza, en Egipto. Desde otro lugar, el mismo momento se ve distinto: cambian el horizonte, la hora del Sol y las estrellas que asoman.", tip: "Toca Lugar y elige tu ubicación o un sitio de la lista." },
    time: {
      title: "El tiempo mueve el cielo",
      text: (v) => (v ? `Desde la cumbre del Chimborazo, el ${v} en erupción al atardecer: su columna de ceniza (simulada, con el viento real) se tiñe de rojo cuando el Sol baja.` : "Atardecer desde la cumbre del Chimborazo: cuando el Sol baja, las montañas y las nubes se tiñen de rojo y luego se apagan."),
      tip: "Toca Tiempo y adelanta unos minutos para ver cómo cambia la luz.",
    },
    con: { text: (n) => `Las constelaciones son figuras que unen estrellas para orientarse; sus estrellas no están juntas, solo en la misma dirección. ${n} está ahora sobre el horizonte.`, tip: "Toca una de sus estrellas para ver su ficha." },
    star: { text: (ly, lang) => `Su luz tarda ${yrs(ly, lang)} en llegar: la ves como era entonces. El color dice su temperatura: las azuladas son más calientes que el Sol; las rojizas, más frías.`, textNoDist: "El color de una estrella dice su temperatura: las azuladas son más calientes que el Sol; las rojizas, más frías.", tip: "Tócala: la ficha da su distancia y su tipo." },
    planet: { text: (moon) => (moon ? "La Luna y los planetas se mueven cerca de la línea dorada, la eclíptica: el camino del Sol en el cielo. La Luna cambia de fase y de lugar cada noche." : "Los planetas se mueven cerca de la línea dorada, la eclíptica: el camino del Sol en el cielo. De una noche a otra cambian de lugar entre las estrellas."), tip: "Toca Tiempo y adelanta horas o días." },
    deep: {
      kind: { nebula: "una nube de gas y polvo donde nacen estrellas", cluster: "un grupo de estrellas que nacieron juntas", galaxy: "otra galaxia: miles de millones de estrellas", other: "un objeto de cielo profundo" },
      text: (kind, dist) => `Es ${kind}${dist ? `, a ${dist}` : ""}. Con unos binoculares y cielo oscuro ya se nota.`,
      tip: "Toca Capas y enciende galaxias, nebulosas, cometas o satélites.",
    },
    weather: { title: "¿Se puede observar hoy?", text: "Las nubes deciden. Arriba está el tiempo de tu lugar: al tocarlo verás las nubes de ahora (del satélite), las de las próximas 12 horas y la mejor ventana para observar.", textNoPlace: "Las nubes deciden. Con un lugar elegido, arriba aparece su tiempo: las nubes de ahora (del satélite) y la mejor ventana para observar.", tip: "Toca la temperatura de arriba." },
    tonight: { title: "Qué ver esta noche", text: "«Esta noche» reúne lo mejor que se ve hoy desde tu lugar: planetas, la Luna, lluvias de meteoros y objetos brillantes. En el celular, «Apuntar al cielo» muestra lo que tienes delante al levantar el teléfono.", tip: "Toca Esta noche." },
    away: "Volvemos a tu cielo.",
  },
  en: {
    step: (i, n) => `Stop ${i} of ${n}`, exit: "Leave the tour", prev: "Previous", next: "Next", done: "Finish", tryIt: "Try it",
    look: { title: "Look around", text: "You're at the centre of a sphere: the sky surrounds you and the horizon cuts it in two. Everything is in its real position.", tip: "Drag to turn and pinch (or scroll) to zoom." },
    place: { title: "The sky depends on where you are", text: "This is today's sunset over the pyramids of Giza, in Egypt. From somewhere else the same moment looks different: the horizon, the Sun's timing and the stars that rise all change.", tip: "Tap Place and pick your location or a site from the list." },
    time: {
      title: "Time moves the sky",
      text: (v) => (v ? `From the summit of Chimborazo, ${v} erupting at sunset: its ash column (simulated, with the real wind) turns red as the Sun goes down.` : "Sunset from the summit of Chimborazo: as the Sun goes down, mountains and clouds turn red and then fade."),
      tip: "Tap Time and move a few minutes ahead to watch the light change.",
    },
    con: { text: (n) => `Constellations are figures that join stars to help you find your way; their stars aren't close together, just in the same direction. ${n} is above the horizon now.`, tip: "Tap one of its stars to open its card." },
    star: { text: (ly, lang) => `Its light takes ${yrs(ly, lang)} to reach us: you see it as it was back then. Its colour tells its temperature: bluish stars are hotter than the Sun; reddish ones, cooler.`, textNoDist: "A star's colour tells its temperature: bluish stars are hotter than the Sun; reddish ones, cooler.", tip: "Tap it: the card gives its distance and type." },
    planet: { text: (moon) => (moon ? "The Moon and the planets move close to the golden line, the ecliptic: the Sun's path across the sky. The Moon changes phase and place every night." : "The planets move close to the golden line, the ecliptic: the Sun's path across the sky. From night to night they shift among the stars."), tip: "Tap Time and move hours or days ahead." },
    deep: {
      kind: { nebula: "a cloud of gas and dust where stars are born", cluster: "a group of stars born together", galaxy: "another galaxy: billions of stars", other: "a deep-sky object" },
      text: (kind, dist) => `It's ${kind}${dist ? `, ${dist} away` : ""}. Binoculars and a dark sky already show it.`,
      tip: "Tap Layers and turn on galaxies, nebulae, comets or satellites.",
    },
    weather: { title: "Can you observe today?", text: "Clouds decide. Your place's weather is up top: tap it to see the clouds right now (from the satellite), the next 12 hours and the best window to observe.", textNoPlace: "Clouds decide. With a place chosen, its weather appears up top: the clouds right now (from the satellite) and the best window to observe.", tip: "Tap the temperature up top." },
    tonight: { title: "What to see tonight", text: "“Tonight” gathers the best of today's sky from your place: planets, the Moon, meteor showers and bright objects. On a phone, “Point at the sky” shows what's in front of you as you raise it.", tip: "Tap Tonight." },
    away: "Back to your sky.",
  },
};

/** Tipo de un objeto Messier para el texto (según el campo type de los datos). */
export function deepKind(type) {
  const t = String(type || "").toLowerCase();
  if (/galax/.test(t)) return "galaxy";
  if (/nebul|remnant|supernova|planetary/.test(t)) return "nebula";
  if (/cluster|cúmulo|cumulo|open|globular/.test(t)) return "cluster";
  return "other";
}

/** Nombres para el título de cada parada (es, en). */
export const NAMES = {
  con: { Ori: ["Orión", "Orion"], Sco: ["Escorpio", "Scorpius"], Cru: ["La Cruz del Sur", "The Southern Cross"], UMa: ["La Osa Mayor", "The Great Bear"],
    Cyg: ["El Cisne", "Cygnus, the Swan"], Leo: ["Leo", "Leo"], Tau: ["Tauro", "Taurus"], CMa: ["El Can Mayor", "Canis Major"], Sgr: ["Sagitario", "Sagittarius"],
    Cas: ["Casiopea", "Cassiopeia"], Gem: ["Géminis", "Gemini"], Lyr: ["La Lira", "Lyra"], Boo: ["El Boyero", "Boötes"], Aql: ["El Águila", "Aquila"],
    Peg: ["Pegaso", "Pegasus"], Cen: ["El Centauro", "Centaurus"] },
  star: { Sirius: ["Sirio", "Sirius"], Canopus: ["Canopo", "Canopus"], Arcturus: ["Arturo", "Arcturus"], Vega: ["Vega", "Vega"], Capella: ["Capella", "Capella"],
    Rigel: ["Rigel", "Rigel"], Procyon: ["Proción", "Procyon"], Achernar: ["Achernar", "Achernar"], Betelgeuse: ["Betelgeuse", "Betelgeuse"], Altair: ["Altair", "Altair"],
    Aldebaran: ["Aldebarán", "Aldebaran"], Antares: ["Antares", "Antares"], Spica: ["Espiga", "Spica"], Pollux: ["Pólux", "Pollux"], Fomalhaut: ["Fomalhaut", "Fomalhaut"],
    Deneb: ["Deneb", "Deneb"], Regulus: ["Régulo", "Regulus"] },
  planet: { Venus: ["Venus", "Venus"], "Júpiter": ["Júpiter", "Jupiter"], Luna: ["La Luna", "The Moon"], Marte: ["Marte", "Mars"], Saturno: ["Saturno", "Saturn"], Mercurio: ["Mercurio", "Mercury"] },
  deep: { 42: ["Nebulosa de Orión (M42)", "Orion Nebula (M42)"], 45: ["Las Pléyades (M45)", "The Pleiades (M45)"], 31: ["Galaxia de Andrómeda (M31)", "Andromeda Galaxy (M31)"],
    8: ["Nebulosa de la Laguna (M8)", "Lagoon Nebula (M8)"], 13: ["Gran cúmulo de Hércules (M13)", "Great Hercules Cluster (M13)"], 44: ["El Pesebre (M44)", "The Beehive (M44)"],
    7: ["Cúmulo de Ptolomeo (M7)", "Ptolemy Cluster (M7)"], 22: ["Cúmulo globular M22", "Globular cluster M22"], 57: ["Nebulosa del Anillo (M57)", "Ring Nebula (M57)"],
    27: ["Nebulosa Dumbbell (M27)", "Dumbbell Nebula (M27)"], 11: ["Cúmulo del Pato Salvaje (M11)", "Wild Duck Cluster (M11)"], 104: ["Galaxia del Sombrero (M104)", "Sombrero Galaxy (M104)"],
    51: ["Galaxia del Remolino (M51)", "Whirlpool Galaxy (M51)"], 81: ["Galaxia de Bode (M81)", "Bode's Galaxy (M81)"] },
};
export const nameOf = (kind, key, lang) => { const n = NAMES[kind] && NAMES[kind][key]; return n ? n[lang === "en" ? 1 : 0] : String(key); };
