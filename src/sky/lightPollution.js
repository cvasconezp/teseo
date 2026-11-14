// lightPollution.js — escala de cielo oscuro de Bortle (1–9) para la vista Cielo.
// Puro: sin DOM ni three. Lo usan atmosphere.js (números) y AtmosphereControls.jsx (textos).
//
// FUENTES (verificadas):
//  · Bortle, J. E. (2001). "Introducing the Bortle Dark-Sky Scale". Sky & Telescope, febrero de 2001.
//    Texto en https://skyandtelescope.org/astronomy-resources/light-pollution-and-astronomy-the-bortle-dark-sky-scale/
//    De ahí salen el nombre de cada clase, su magnitud límite a simple vista (NELM) y los rasgos visuales
//    resumidos abajo. OJO: la versión web de S&T da un único valor para las clases 6, 7 y 8 (5,5 · 5,0 · 4,5);
//    la tabla de la edición impresa (reproducida, p. ej., por la Universidad de Montana:
//    winapps.umt.edu/.../Bortle Dark-Sky Scale.pdf) da intervalos de 0,5 mag (5,1–5,5 · 4,6–5,0 · 4,1–4,5).
//    Usamos los intervalos; el valor web coincide con el extremo brillante de cada uno.
//    Bortle (2001) NO da brillo de cielo en mag/arcsec²: por eso Teseo no muestra un "brillo de cielo de la
//    clase". Las tablas Bortle ↔ SQM que circulan (p. ej. en Wikipedia) no citan fuente y no se usan.
//  · Brillo de fondo típico por entorno (solo para el modelo de atmósfera, ver `envSky`):
//    Hänel, A. et al. (2018). "Measuring night sky brightness: methods and challenges". JQSRT 205, 278–290
//    (arXiv:1709.09558), tabla 2: noche natural estrellada 21,4–21,9; cielo rural (despejado, sin Luna)
//    20,3–21,6; suburbano 17,2–20,4; urbano 16,8–19,2 mag/arcsec² en el cenit. Los autores advierten que son
//    "valores representativos, no definitivos". Teseo solo usa los DOS extremos: la clase 1 ("excellent
//    dark-sky site") al extremo oscuro de la noche natural (21,9) y la clase 9 ("inner-city sky") al extremo
//    brillante del cielo urbano (16,8). El fondo de las clases 2–8 lo deduce atmosphere.js (`bortleSky`) de
//    la magnitud límite de Bortle, de modo que la "ventaja del observador" varíe de forma lineal y monótona
//    entre ambos extremos; los valores resultantes caen dentro de los intervalos de Hänel para su entorno
//    o muy cerca (lo comprueba scripts/test_sky_atmosphere.mjs). Es un supuesto de Teseo, declarado: solo
//    decide CUÁNTO resta la Luna o el crepúsculo en cada clase (en un cielo ya brillante la Luna resta menos).
//  · Las magnitudes límite de Bortle corresponden a un observador experimentado y "con esfuerzo" (clase 1).
//    Crumey (2014, MNRAS 442, 2600) recuerda que el límite típico en cielo oscuro ronda 6–6,6 mag para la
//    mayoría de observadores. Se dice en la interfaz (texto `bortleObserver` en i18n-atm.js).
//
// Ejemplos de lugares: no se dan ejemplos de ciudades concretas salvo con medición publicada (ver
// `MEASURED` abajo); las descripciones usan entornos genéricos ("ciudad grande", "suburbano", "rural").

// nelm: intervalo publicado por Bortle (2001) · nelmRef: valor que usa el modelo (punto medio del intervalo;
// para la clase 9, "4,0 o menos", se usa 4,0: el modelo da entonces el MEJOR caso de esa clase).
export const BORTLE = [
  null,
  { cls: 1, nelm: [7.6, 8.0], nelmRef: 7.8, env: "natural" },
  { cls: 2, nelm: [7.1, 7.5], nelmRef: 7.3, env: "natural" },
  { cls: 3, nelm: [6.6, 7.0], nelmRef: 6.8, env: "rural" },
  { cls: 4, nelm: [6.1, 6.5], nelmRef: 6.3, env: "rural" },
  { cls: 5, nelm: [5.6, 6.0], nelmRef: 5.8, env: "suburban" },
  { cls: 6, nelm: [5.1, 5.5], nelmRef: 5.3, env: "suburban" },
  { cls: 7, nelm: [4.6, 5.0], nelmRef: 4.8, env: "urban" },
  { cls: 8, nelm: [4.1, 4.5], nelmRef: 4.3, env: "urban" },
  { cls: 9, nelm: [null, 4.0], nelmRef: 4.0, env: "urban" },
];

// Brillo de cielo en el cenit (mag/arcsec², V ≈ SQM) por entorno: Hänel et al. (2018), tabla 2.
export const ENV_SKY = {
  natural:  { range: [21.4, 21.9], mid: 21.65 },
  rural:    { range: [20.3, 21.6], mid: 20.95 },
  suburban: { range: [17.2, 20.4], mid: 18.8 },
  urban:    { range: [16.8, 19.2], mid: 18.0 },
};
// Extremos del fondo nocturno (mag/arcsec², cenit) que usa el modelo: Hänel et al. (2018), tabla 2.
export const SKY_ENDPOINTS = { 1: ENV_SKY.natural.range[1], 9: ENV_SKY.urban.range[0] };

export const clampBortle = (b) => Math.max(1, Math.min(9, Math.round(Number(b) || 5)));
export const BORTLE_DEFAULT = 5;   // valor neutro cuando no hay respaldo para el lugar

// Mediciones publicadas en Ecuador (para elegir un valor por defecto en la fase de integración).
// Solo lo que tiene fuente; NO es una lista de "clases Bortle oficiales" de cada ciudad.
export const MEASURED = {
  quito: {
    sqm: { north: 16.39, valley: 16.31, south: 15.53, worst: 13.69 },
    src: "Aroca Morocho, B. A. y Herrera Paucar, P. M. (2022). Estudio y análisis del grado de la contaminación lumínica en el Distrito Metropolitano de Quito. Tesis de grado, Universidad Politécnica Salesiana. dspace.ups.edu.ec/handle/123456789/22443 — 31 puntos residenciales con SQM-LU-DL; según el resumen, predominan las clases «cielo urbano» y «cielo de centro urbano» de Bortle.",
  },
};

const fmt = (v, lang) => Number(v).toLocaleString(lang === "es" ? "es" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const nelmText = (cls, lang) => {
  const b = BORTLE[clampBortle(cls)];
  if (b.nelm[0] == null) return lang === "es" ? `${fmt(b.nelm[1], lang)} o menos` : `${fmt(b.nelm[1], lang)} or less`;
  return `${fmt(b.nelm[0], lang)}–${fmt(b.nelm[1], lang)}`;
};

// Nombres y rasgos (resumen propio del texto de Bortle 2001). `where` = entorno genérico orientativo.
export const BORTLE_TEXT = {
  es: {
    name: [null, "Cielo oscuro excelente", "Cielo oscuro típico", "Cielo rural", "Transición rural–suburbana", "Cielo suburbano", "Suburbano brillante", "Transición suburbana–urbana", "Cielo de ciudad", "Centro de ciudad"],
    where: [null, "sitio oscuro remoto, lejos de toda población", "sitio oscuro", "campo abierto", "campo cerca de pueblos", "afueras de una ciudad", "barrio periférico iluminado", "borde de una ciudad", "ciudad grande", "centro de una ciudad grande"],
    desc: [null,
      "La luz zodiacal es llamativa y la Vía Láctea de Escorpio y Sagitario llega a proyectar sombras tenues. M33 se ve a simple vista sin esfuerzo.",
      "La Vía Láctea muestra mucha estructura. Las nubes solo se notan como huecos oscuros entre las estrellas.",
      "La contaminación lumínica solo se nota en el horizonte; las nubes están oscuras sobre la cabeza. La luz zodiacal destaca en primavera y otoño.",
      "Se ven cúpulas de luz sobre los pueblos en varias direcciones. La Vía Láctea impresiona, pero con poco detalle.",
      "Hay luces en casi todas las direcciones y las nubes se ven más claras que el cielo. La Vía Láctea es débil cerca del horizonte y se desvanece en lo alto.",
      "Ya no hay luz zodiacal y la Vía Láctea solo asoma cerca del cenit. Hasta 35° sobre el horizonte el cielo brilla gris blanquecino.",
      "Todo el cielo tiene un fondo gris blanquecino. La Vía Láctea es invisible o casi. Las nubes se ven muy iluminadas.",
      "El cielo brilla gris blanquecino o anaranjado: se pueden leer titulares de un periódico. Faltan estrellas de algunas constelaciones.",
      "Todo el cielo está iluminado, incluso en el cenit. Muchas estrellas de las constelaciones no se ven; constelaciones débiles como Cáncer o Piscis desaparecen.",
    ],
  },
  en: {
    name: [null, "Excellent dark-sky site", "Typical truly dark site", "Rural sky", "Rural/suburban transition", "Suburban sky", "Bright suburban sky", "Suburban/urban transition", "City sky", "Inner-city sky"],
    where: [null, "remote dark site, far from any town", "dark site", "open countryside", "countryside near towns", "outskirts of a city", "brightly lit outer suburb", "edge of a city", "large city", "centre of a large city"],
    desc: [null,
      "The zodiacal light is striking and the Milky Way in Scorpius and Sagittarius can cast faint shadows. M33 is an obvious naked-eye object.",
      "The Milky Way is highly structured. Clouds show only as dark holes against the stars.",
      "Light pollution shows only along the horizon; clouds are dark overhead. The zodiacal light stands out in spring and autumn.",
      "Light domes are visible over towns in several directions. The Milky Way is impressive but shows little structure.",
      "Lights are evident in most directions and clouds look brighter than the sky. The Milky Way is weak near the horizon and washed out overhead.",
      "The zodiacal light is gone and the Milky Way shows only near the zenith. Up to 35° above the horizon the sky glows greyish white.",
      "The whole sky has a greyish-white background. The Milky Way is invisible or nearly so. Clouds are brilliantly lit.",
      "The sky glows whitish grey or orange: you can read newspaper headlines. Some constellation stars are missing.",
      "The whole sky is lit, even at the zenith. Many constellation stars are invisible; faint constellations such as Cancer or Pisces disappear.",
    ],
  },
};

export const BORTLE_SOURCE = {
  es: "Escala de Bortle: J. E. Bortle, Sky & Telescope, febrero de 2001. Magnitud límite a simple vista en el cenit, noche cerrada y sin Luna, para un observador experimentado.",
  en: "Bortle scale: J. E. Bortle, Sky & Telescope, February 2001. Naked-eye limiting magnitude at the zenith on a dark, moonless night, for an experienced observer.",
};

// Globe at Night (https://globeatnight.org/): ciencia ciudadana sobre el brillo del cielo. Cada campaña
// propone una constelación y siete cartas de magnitud; el participante elige la que se parece a su cielo
// (más de una hora tras la puesta de Sol, sin Luna, tras ~10 min de adaptación) y la reporta con fecha,
// hora, lugar y nubosidad. Fuente del procedimiento: SciStarter, "How Bad is Light Pollution in Your
// Community? Find Out by Helping the 'Globe at Night' Project".
export const GLOBE_AT_NIGHT_URL = "https://globeatnight.org/";

// Clase de Bortle cuya magnitud límite de referencia queda más cerca de la que el usuario vio
// (para "Como mi cielo real"). Fuera del intervalo de la escala (≥ 7,8 o ≤ 4,0) se queda en el extremo.
export function bortleForNelm(m) {
  let best = 1, d = Infinity;
  for (let c = 1; c <= 9; c++) { const dd = Math.abs(BORTLE[c].nelmRef - m); if (dd < d - 1e-9) { d = dd; best = c; } }
  return best;
}
