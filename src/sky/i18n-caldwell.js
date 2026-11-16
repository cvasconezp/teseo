// i18n-caldwell.js — textos de la capa Caldwell (y las Nubes de Magallanes) en el Cielo.
// Se fusionan en TX (src/sky/i18n.js); los objetos anidados (layerDesc, deepWhat, noteTitle…) se
// fusionan clave a clave, sin pisar lo que ya había. Mismas claves en ES y EN.
const n0 = (v, lang, d = 0) => Number(v).toLocaleString(lang === "es" ? "es" : "en-US", { maximumFractionDigits: d });
const MOON_ARCMIN = 31;   // diámetro aparente medio de la Luna llena (≈ 31′)

export const CALDWELL = {
  es: {
    layerDesc: {
      caldwell: "Los 109 objetos de Patrick Moore que Messier no incluyó —muchos del cielo sur— y las dos Nubes de Magallanes. Fuente: OpenNGC; distancias publicadas (NASA y artículos). Sus galaxias lejanas se ven en «Galaxias».",
    },
    deepWhat: {
      planetary: "Una nebulosa planetaria: el gas que expulsó una estrella parecida al Sol al final de su vida. No tiene nada que ver con los planetas: el nombre viene de cómo se veían en los telescopios antiguos.",
      clneb: "Un cúmulo de estrellas jóvenes que todavía está envuelto en la nube de gas de la que nacieron.",
      dark: "Una nebulosa oscura: una nube de polvo tan densa que tapa las estrellas de detrás. Se ve como un hueco negro sobre la Vía Láctea.",
    },
    cwCloudType: "Galaxia satélite de la Vía Láctea",
    cwCloudWhat: "Una galaxia enana que gira alrededor de la Vía Láctea. Desde Ecuador se ve a simple vista como una nube pálida, lejos de las luces de la ciudad.",
    cwOrigin: "Las Nubes de Magallanes no están en el catálogo Caldwell: Teseo las añade porque son las galaxias más vistosas del cielo sur.",
    cwNoDist: "No encontramos una distancia publicada que podamos verificar, así que no la mostramos.",
    cwUnc: (alt, src) => `Otra fuente (${src}) da unos ${alt}: la distancia de este objeto es incierta.`,
    cwAltSrc: { nasa: "la ficha de NASA", wikipedia: "la tabla del catálogo en Wikipedia" },
    cwDistNote: {
      paper: "Distancia medida y publicada en un artículo científico (la fuente está en los detalles técnicos).",
      nasa: "Distancia de la ficha del objeto en el catálogo Caldwell del Hubble (NASA): redondeada, tómala como aproximada.",
      wiki: "Distancia de la referencia que cita Wikipedia para este objeto: tómala como aproximada.",
      tarantula: "La Tarántula está dentro de la Gran Nube de Magallanes: se le da la distancia medida de la Gran Nube.",
      rosette: "Es una suposición: se le da la distancia de la Nebulosa Roseta, a la que este cúmulo ilumina.",
    },
    srcCaldwell: (d) => `OpenNGC (posición, tipo, tamaño)${d ? ` · Distancia: ${d}` : ""}`,
    dSize: "Tamaño en el cielo",
    sizeVal: (arcmin, lang) => `${n0(arcmin, lang, arcmin < 10 ? 1 : 0)}′ · ${arcmin >= MOON_ARCMIN ? `${n0(arcmin / MOON_ARCMIN, lang, 1)} × la Luna llena` : "la Luna llena mide 31′"}`,
    sizeLine: (x) => `En el cielo ocupa unas ${x} veces el ancho de la Luna llena, aunque a simple vista solo se note su parte más brillante.`,
    cwCatalog: (c, cat) => `Caldwell ${c}${cat ? ` · ${cat}` : ""}`,
    // patrón de la capa
    noteTitle: { messierSouth: "Lo que Messier no podía ver" },
    noteTag: { messierSouth: "¿Por qué Messier no los vio?" },
    noteType: { messierSouth: "Una huella de dónde se hizo cada catálogo" },
    noteBody: {
      messierSouth: "Charles Messier observaba desde París, a 49° de latitud norte. Desde allí, el cielo al sur de la declinación −41° nunca sale sobre el horizonte, y ninguno de sus 110 objetos está tan al sur (el más austral, M7, está a −35°). Patrick Moore armó el Caldwell en 1995 pensando también en el hemisferio sur: por eso esta capa trae la Nebulosa de Carina, Omega Centauri o el Joyero. Desde Ecuador, en la línea equinoccial, se ven todos a lo largo del año.",
    },
    noteCount: { messierSouth: "Al sur de −41°" },
    noteWhat: { messierSouth: "objetos de esta capa" },
    noteSource: { messierSouth: "Conteo hecho sobre los objetos que dibuja la capa Caldwell. Límite: 90° − 48,85° (latitud de París) = −41,15° de declinación." },
    noteLayerLine: { messierSouth: (n, total) => `${n} de ${total} nunca salen sobre el horizonte de París, donde trabajaba Messier.` },
  },
  en: {
    layerDesc: {
      caldwell: "Patrick Moore's 109 objects that Messier left out —many of them in the southern sky— plus the two Magellanic Clouds. Source: OpenNGC; published distances (NASA and papers). Its distant galaxies are shown under «Galaxies».",
    },
    deepWhat: {
      planetary: "A planetary nebula: the gas a Sun-like star blew off at the end of its life. It has nothing to do with planets: the name comes from how they looked in old telescopes.",
      clneb: "A cluster of young stars still wrapped in the gas cloud they were born from.",
      dark: "A dark nebula: a dust cloud so thick it blocks the stars behind it. It shows up as a black gap on the Milky Way.",
    },
    cwCloudType: "Satellite galaxy of the Milky Way",
    cwCloudWhat: "A dwarf galaxy that orbits the Milky Way. From Ecuador you can see it with the naked eye as a pale cloud, away from city lights.",
    cwOrigin: "The Magellanic Clouds are not in the Caldwell catalogue: Teseo adds them because they are the most striking galaxies of the southern sky.",
    cwNoDist: "We found no published distance we could verify, so none is shown.",
    cwUnc: (alt, src) => `Another source (${src}) gives about ${alt}: this object's distance is uncertain.`,
    cwAltSrc: { nasa: "NASA's page", wikipedia: "the catalogue table on Wikipedia" },
    cwDistNote: {
      paper: "Distance measured and published in a scientific paper (the source is in the technical details).",
      nasa: "Distance from the object's page in NASA's Hubble Caldwell catalog: rounded, take it as approximate.",
      wiki: "Distance from the reference Wikipedia cites for this object: take it as approximate.",
      tarantula: "The Tarantula lies inside the Large Magellanic Cloud: it is given the measured distance of the Cloud.",
      rosette: "This is an assumption: it is given the distance of the Rosette Nebula, which this cluster lights up.",
    },
    srcCaldwell: (d) => `OpenNGC (position, type, size)${d ? ` · Distance: ${d}` : ""}`,
    dSize: "Size in the sky",
    sizeVal: (arcmin, lang) => `${n0(arcmin, lang, arcmin < 10 ? 1 : 0)}′ · ${arcmin >= MOON_ARCMIN ? `${n0(arcmin / MOON_ARCMIN, lang, 1)} × the full Moon` : "the full Moon is 31′"}`,
    sizeLine: (x) => `In the sky it spans about ${x} times the width of the full Moon, though the naked eye only picks up its brightest part.`,
    cwCatalog: (c, cat) => `Caldwell ${c}${cat ? ` · ${cat}` : ""}`,
    noteTitle: { messierSouth: "What Messier could not see" },
    noteTag: { messierSouth: "Why didn't Messier see these?" },
    noteType: { messierSouth: "A trace of where each catalogue was made" },
    noteBody: {
      messierSouth: "Charles Messier observed from Paris, at 49° north. From there, the sky south of declination −41° never rises above the horizon, and none of his 110 objects lies that far south (the southernmost, M7, is at −35°). Patrick Moore put the Caldwell list together in 1995 with the southern hemisphere in mind too: that is why this layer has the Carina Nebula, Omega Centauri or the Jewel Box. From Ecuador, right on the equator, all of them can be seen over the year.",
    },
    noteCount: { messierSouth: "South of −41°" },
    noteWhat: { messierSouth: "objects in this layer" },
    noteSource: { messierSouth: "Count made on the objects the Caldwell layer draws. Limit: 90° − 48.85° (latitude of Paris) = −41.15° declination." },
    noteLayerLine: { messierSouth: (n, total) => `${n} of ${total} never rise above the horizon of Paris, where Messier worked.` },
  },
};

/** Fuente de la distancia en el idioma de la ficha (el JSON la guarda en español). */
export function cwSrcName(src, lang) {
  if (!src || lang === "es") return src || "";
  return src.replace("NASA, catálogo Caldwell del Hubble", "NASA, Hubble's Caldwell Catalog")
    .replace("(vía Wikipedia)", "(via Wikipedia)").replace(" y ", " & ").replace("SEDS, NGC Online", "SEDS NGC Online");
}
