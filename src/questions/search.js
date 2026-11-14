// search.js — buscador por palabras clave del índice de Preguntas.
// Se busca en el título, el resumen y la etiqueta de cada pregunta (en los dos idiomas) y en una
// lista de palabras clave, sin distinguir mayúsculas ni tildes. Todas las palabras escritas deben
// aparecer (búsqueda «y»), pero cada una puede ser el comienzo de una palabra («agu» → agujero).

// Palabras clave por pregunta (ES y EN). Las preguntas que aún no existan en TOUR_IDS se ignoran.
export const KEYWORDS = {
  mass: {
    es: "masa peso báscula gravedad densidad tamaño radio inercia órbita kepler luna planeta enana marrón enana blanca estrella neutrones schwarzschild compresión pesar sirio betelgeuse",
    en: "mass weight scale gravity density size radius inertia orbit kepler moon planet brown dwarf white dwarf star neutron schwarzschild compress weigh sirius betelgeuse",
  },
  time: {
    es: "tiempo viaje viajar relatividad einstein dilatación velocidad luz gps reloj relojes gemelos paradoja próxima centauri chimborazo gravedad pasado futuro agujero gusano envejecer",
    en: "time travel relativity einstein dilation speed light gps clock clocks twins paradox proxima centauri chimborazo gravity past future wormhole aging",
  },
  bh: {
    es: "agujero negro agujeros negros horizonte eventos schwarzschild marea mareas espaguetización cuásar sagitario m87 tiempo luz singularidad",
    en: "black hole black holes horizon event schwarzschild tide tides spaghettification quasar sagittarius m87 time light singularity",
  },
  gw: {
    es: "ondas gravitacionales onda ligo virgo chirrido sonido fusión agujeros negros estrellas neutrones einstein espaciotiempo kilonova oro lisa nobel deformación",
    en: "gravitational waves wave ligo virgo chirp sound merger black holes neutron stars einstein spacetime kilonova gold lisa nobel strain",
  },
  expansion: {
    es: "expansión universo hubble big bang edad supernovas energía oscura galaxias corrimiento rojo cosmología",
    en: "expansion universe hubble big bang age supernovae dark energy galaxies redshift cosmology",
  },
  dm: {
    es: "materia oscura galaxia galaxias rotación ngc 3198 masa invisible universo composición",
    en: "dark matter galaxy galaxies rotation ngc 3198 invisible mass universe composition",
  },
  drake: {
    es: "vida extraterrestre extraterrestres alienígenas ecuación drake fermi gran filtro kardashov civilizaciones seti exoplanetas habitables solos",
    en: "life extraterrestrial aliens equation drake fermi great filter kardashev civilizations seti exoplanets habitable alone",
  },
  spectrum: {
    es: "espectro luz prisma colores arcoíris líneas elementos composición química hidrógeno helio atmósfera james webb biofirma fraunhofer estrellas hechas",
    en: "spectrum light prism colors rainbow lines elements composition chemistry hydrogen helium atmosphere james webb biosignature fraunhofer stars made",
  },
};

export const SEARCH_TEXT = {
  es: {
    label: "Buscar en las preguntas",
    placeholder: "Ej.: agujero negro, tiempo, luz",
    clear: "Borrar la búsqueda",
    count: (n, total) => (n === total ? `${total} preguntas` : n === 1 ? "1 pregunta encontrada" : `${n} preguntas encontradas`),
    empty: (q) => `Ninguna pregunta habla de «${q}». Prueba con otra palabra: masa, tiempo, luz, galaxias, vida…`,
    navLabel: "Otras preguntas", navTitle: "Sigue explorando", prev: "Anterior", next: "Siguiente",
  },
  en: {
    label: "Search the questions",
    placeholder: "E.g. black hole, time, light",
    clear: "Clear search",
    count: (n, total) => (n === total ? `${total} questions` : n === 1 ? "1 question found" : `${n} questions found`),
    empty: (q) => `No question mentions “${q}”. Try another word: mass, time, light, galaxies, life…`,
    navLabel: "Other questions", navTitle: "Keep exploring", prev: "Previous", next: "Next",
  },
};

/** Minúsculas y sin tildes ni diéresis ("Agujéro" → "agujero"); conserva la ñ. */
export function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ñ/g, "\u0000")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\u0000/g, "ñ");
}

/** Texto en el que se busca para una pregunta: títulos y resúmenes en ES y EN más sus palabras clave. */
export function haystack(id, tq) {
  const parts = [];
  for (const lang of ["es", "en"]) {
    const tr = tq?.[lang]?.tours?.[id];
    if (tr) parts.push(tr.title, tr.teaser, tr.tag);
    if (KEYWORDS[id]) parts.push(KEYWORDS[id][lang]);
  }
  return norm(parts.join(" "));
}

/** Ids que contienen todas las palabras de la consulta (cada una como comienzo de palabra). */
export function searchTours(query, ids, tq) {
  const words = norm(query).split(/[^a-z0-9ñ*]+/).filter(Boolean);
  if (!words.length) return ids.slice();
  return ids.filter(id => {
    const hay = " " + haystack(id, tq).replace(/[^a-z0-9ñ*]+/g, " ");
    return words.every(w => hay.includes(" " + w));
  });
}
