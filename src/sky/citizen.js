// citizen.js — "Participa": proyectos de ciencia ciudadana reales y vigentes
// relacionados con cada tipo de objeto. ÚNICA fuente de estos enlaces.
//
// Cada entrada se comprobó a mano el día indicado en CITIZEN_VERIFIED (la página
// abre y el proyecto sigue aceptando participantes). `how` dice cómo se comprobó:
//   "fetch"  → se abrió la página y se leyó su contenido;
//   "search" → apareció con ese título en un buscador (la página no pudo abrirse
//              desde el entorno de comprobación).
// Si un proyecto cierra o cambia de dirección, se corrige o se borra AQUÍ.
// `needs`: lo que hace falta para participar → "phone" | "computer" | "eyes" | "telescope".
export const CITIZEN_VERIFIED = "2026-11-13";

export const CITIZEN = [
  {
    id: "exoplanet-watch", org: "NASA", name: "Exoplanet Watch", how: "fetch",
    url: "https://science.nasa.gov/citizen-science/exoplanet-watch/",
    layers: ["exoplanets"], needs: "computer",
    es: "Mide el tránsito de un exoplaneta: pides datos de un telescopio robótico y los analizas con su programa gratuito. No hace falta telescopio.",
    en: "Measure an exoplanet's transit: request data from a robotic telescope and analyse it with their free software. No telescope needed.",
  },
  {
    id: "planet-hunters-tess", org: "Zooniverse", name: "Planet Hunters TESS", how: "fetch",
    url: "https://www.zooniverse.org/projects/nora-dot-eisner/planet-hunters-tess",
    layers: ["exoplanets"], needs: "computer",
    es: "Busca planetas nuevos: revisas curvas de luz del telescopio TESS y marcas las caídas de brillo.",
    en: "Hunt for new planets: look through light curves from the TESS telescope and mark the dips in brightness.",
  },
  {
    id: "galaxy-zoo", org: "Zooniverse", name: "Galaxy Zoo", how: "fetch",
    url: "https://www.zooniverse.org/projects/zookeeper/galaxy-zoo",
    layers: ["galaxies"], messier: ["galaxy"], needs: "computer",
    es: "Clasifica galaxias por su forma a partir de imágenes reales de telescopios. Sirve cualquier navegador.",
    en: "Classify galaxies by their shape from real telescope images. Any web browser will do.",
  },
  {
    id: "globe-at-night", org: "NSF NOIRLab", name: "Globe at Night", how: "fetch",
    url: "https://globeatnight.org/",
    layers: ["star", "con"], localOnly: true, needs: "phone",
    es: "Mide la contaminación lumínica de tu cielo: comparas las estrellas que ves en una constelación con sus cartas y envías el resultado. Hay campañas de diez noches cada mes; consulta las fechas vigentes en su web.",
    en: "Measure the light pollution of your sky: compare the stars you can see in a constellation with their charts and submit the result. There are ten-night campaigns every month; check the current dates on their site.",
  },
  {
    id: "imo-fireball", org: "International Meteor Organization", name: "Report a Fireball", how: "fetch",
    url: "https://www.imo.net/observations/fireballs/fireball-report-program/",
    layers: ["meteors"], needs: "eyes",
    es: "¿Viste un bólido, un meteoro muy brillante? Cuéntalo: con muchos reportes se reconstruye su trayectoria.",
    en: "Saw a fireball, a very bright meteor? Report it: many reports together let scientists rebuild its path.",
  },
  {
    id: "iasc-asteroids", org: "IASC · Zooniverse", name: "IASC's Asteroid Search", how: "fetch",
    url: "https://www.zooniverse.org/projects/iascsearch/iascs-asteroid-search/about/faq",
    layers: ["comets"], needs: "computer",
    es: "Busca asteroides en imágenes del observatorio Pan-STARRS. Suben imágenes nuevas dos veces por semana; a ratos se agotan.",
    en: "Look for asteroids in images from the Pan-STARRS observatory. New images arrive twice a week and sometimes run out.",
  },
  {
    id: "aavso", org: "AAVSO", name: "AAVSO", how: "fetch",
    url: "https://www.aavso.org/get-involved",
    layers: ["star"], messier: ["snr"], needs: "eyes",
    es: "Sigue el brillo de estrellas variables y envía tus medidas. Se puede empezar a simple vista o con binoculares.",
    en: "Track the brightness of variable stars and submit your estimates. You can start with your eyes or binoculars.",
  },
];

/**
 * Proyectos relacionados con un objeto. `local` = hay cielo local activo (algunos
 * proyectos solo tienen sentido mirando tu propio cielo). Máximo dos.
 */
export function citizenFor(obj, local = false) {
  if (!obj || !obj.layer) return [];
  const L = obj.layer;
  return CITIZEN.filter((p) => {
    if (p.localOnly && !local) return false;
    if (L === "messier") return !!(p.messier && p.messier.includes(obj.type));
    return p.layers.includes(L);
  }).slice(0, 2);
}
