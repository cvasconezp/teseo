// bhData.js — datos, fuentes y textos del recorrido "¿Qué pasa cerca de un
// agujero negro?". Cada cifra lleva su referencia; se consultaron el
// 13-nov-2026. Las constantes físicas están en constants.js.
//
// Verificación de cada masa (texto del resumen o de la tabla del artículo):
//  · Sgr A*  : GRAVITY Collab. 2022, A&A 657, L12 — M = (4,297 ± 0,012) × 10⁶ M☉,
//              R0 = 8277 ± 9 pc (errores estadísticos; órbitas de estrellas).
//  · M87*    : EHT Collab. 2019, ApJL 875, L1 y L6 — M = (6,5 ± 0,7) × 10⁹ M☉,
//              D = 16,8 (+0,8/−0,7) Mpc, anillo de 42 ± 3 µas. OJO: esta masa se
//              dedujo del tamaño del propio anillo. Medida independiente con
//              estrellas: Gebhardt et al. 2011, (6,6 ± 0,4) × 10⁹ M☉.
//  · Cygnus X-1: Miller-Jones et al. 2021, Science 371, 1046 — 21,2 ± 2,2 M☉.
//  · Gaia BH1: El-Badry et al. 2023, MNRAS 518, 1057 — 9,62 ± 0,18 M☉.
//  · Gaia BH3: Gaia Collab. (Panuzzo et al.) 2024, A&A 686, L2 — 32,70 ± 0,82 M☉.
//  · TON 618 : Shemmer et al. 2004, ApJ 614, 547, tabla 2 — log(M/M☉) = 10,82
//              (6,6 × 10¹⁰). Estimación indirecta (anchura de la línea Hβ): puede
//              errar en un factor de varias veces → nivel "estimated".
//  · EHT Sgr A*: EHT Collab. 2022, ApJL 930, L12 — anillo 51,8 ± 2,3 µas;
//              sombra inferida 48,7 ± 7,0 µas.
import { EARTH_IN_SUNS, R_EARTH, R_SUN, AU, PC, MPC } from "./constants.js";

export const BH_REFS = {
  gravity2022: { cite: "GRAVITY Collaboration (2022), A&A 657, L12: masa y distancia de Sgr A*", citeEn: "GRAVITY Collaboration (2022), A&A 657, L12: mass and distance of Sgr A*", url: "https://arxiv.org/abs/2112.07478" },
  eht2019: { cite: "Event Horizon Telescope (2019), ApJL 875, L1: la sombra de M87*", citeEn: "Event Horizon Telescope (2019), ApJL 875, L1: the shadow of M87*", url: "https://arxiv.org/abs/1906.11238" },
  eht2019vi: { cite: "Event Horizon Telescope (2019), ApJL 875, L6: sombra y masa de M87*", citeEn: "Event Horizon Telescope (2019), ApJL 875, L6: shadow and mass of M87*", url: "https://arxiv.org/abs/1906.11243" },
  gebhardt2011: { cite: "Gebhardt et al. (2011), ApJ 729, 119: masa de M87* con estrellas", citeEn: "Gebhardt et al. (2011), ApJ 729, 119: mass of M87* from stars", url: "https://arxiv.org/abs/1101.1954" },
  eht2022: { cite: "Event Horizon Telescope (2022), ApJL 930, L12: la sombra de Sgr A*", citeEn: "Event Horizon Telescope (2022), ApJL 930, L12: the shadow of Sgr A*", url: "https://arxiv.org/abs/2311.08680" },
  millerJones2021: { cite: "Miller-Jones et al. (2021), Science 371, 1046: Cygnus X-1", url: "https://arxiv.org/abs/2102.09091" },
  elBadry2023: { cite: "El-Badry et al. (2023), MNRAS 518, 1057: Gaia BH1", url: "https://arxiv.org/abs/2209.06833" },
  gaia2024: { cite: "Gaia Collaboration, Panuzzo et al. (2024), A&A 686, L2: Gaia BH3", url: "https://arxiv.org/abs/2404.10486" },
  shemmer2004: { cite: "Shemmer et al. (2004), ApJ 614, 547: masa de TON 618 (tabla 2)", citeEn: "Shemmer et al. (2004), ApJ 614, 547: mass of TON 618 (table 2)", url: "https://arxiv.org/abs/astro-ph/0406559" },
  codata: { cite: "NIST / CODATA: constante de gravitación G", citeEn: "NIST / CODATA: Newtonian constant of gravitation G", url: "https://physics.nist.gov/cgi-bin/cuu/Value?bg" },
  iau2015: { cite: "IAU (2015), Resolución B3: constantes nominales del Sol y la Tierra", citeEn: "IAU (2015), Resolution B3: nominal solar and terrestrial constants", url: "https://arxiv.org/abs/1510.07674" },
  nasaFacts: { cite: "NASA, Planetary Fact Sheet: distancias y velocidades orbitales", citeEn: "NASA, Planetary Fact Sheet: orbital distances and speeds", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/" },
  nasaBH: { cite: "NASA Science, «Black Holes»", citeEn: "NASA Science, “Black Holes”", url: "https://science.nasa.gov/universe/black-holes/" },
  nobel2020: { cite: "Premio Nobel de Física 2020 (Penrose, Genzel y Ghez)", citeEn: "Nobel Prize in Physics 2020 (Penrose, Genzel and Ghez)", url: "https://www.nobelprize.org/prizes/physics/2020/summary/" },
  hawking1974: { cite: "Hawking (1974), Nature 248, 30: «Black hole explosions?»", citeEn: "Hawking (1974), Nature 248, 30: “Black hole explosions?”", url: "https://doi.org/10.1038/248030a0" },
};

// Deslizador de masa: log10(M/M☉), de la masa de la Tierra a la de TON 618.
export const MASS_SLIDER = { min: Math.log10(EARTH_IN_SUNS), max: Math.log10(6.6e10), step: 0.01 };
// Deslizador de distancia: log10(r/r_s − 1). De una millonésima de r_s sobre el horizonte a 101 r_s.
export const DIST_SLIDER = { min: -6, max: 2, step: 0.02, start: Math.log10(0.5) };
export const DEFAULT_LOGM = Math.log10(4.3e6);          // Sgr A*

// Preajustes. Los reales se emparejan por nombre con public/blackholes.json
// (la capa del Cielo): de ahí salen la masa que usa la calculadora y la
// distancia; `published` es el valor del artículo, para mostrarlo y probarlo.
export const PRESETS = [
  { id: "earth", real: false, mass: EARTH_IN_SUNS, label: { es: "La Tierra", en: "Earth" } },
  { id: "sun", real: false, mass: 1, label: { es: "El Sol", en: "The Sun" } },
  { id: "gaiabh1", real: true, name: "Gaia BH1", mass: 9.62, published: { es: "9,62 ± 0,18", en: "9.62 ± 0.18" }, level: "measured", ref: "elBadry2023", label: { es: "Gaia BH1", en: "Gaia BH1" }, what: { es: "el más cercano conocido", en: "the nearest known" } },
  { id: "cygx1", real: true, name: "Cygnus X-1", mass: 21.2, published: { es: "21,2 ± 2,2", en: "21.2 ± 2.2" }, level: "measured", ref: "millerJones2021", label: { es: "Cygnus X-1", en: "Cygnus X-1" }, what: { es: "el primero que se identificó", en: "the first one identified" } },
  { id: "gaiabh3", real: true, name: "Gaia BH3", mass: 32.7, published: { es: "32,70 ± 0,82", en: "32.70 ± 0.82" }, level: "measured", ref: "gaia2024", label: { es: "Gaia BH3", en: "Gaia BH3" }, what: { es: "el estelar más masivo de la galaxia", en: "the heaviest stellar one in our galaxy" } },
  { id: "sgra", real: true, name: "Sgr A*", mass: 4.297e6, published: { es: "(4,297 ± 0,012) × 10⁶", en: "(4.297 ± 0.012) × 10⁶" }, level: "measured", ref: "gravity2022", label: { es: "Sgr A*", en: "Sgr A*" }, what: { es: "el del centro de la Vía Láctea", en: "the one at the centre of the Milky Way" } },
  { id: "m87", real: true, name: "M87*", mass: 6.5e9, published: { es: "(6,5 ± 0,7) × 10⁹", en: "(6.5 ± 0.7) × 10⁹" }, level: "measured", ref: "eht2019", label: { es: "M87*", en: "M87*" }, what: { es: "el de la primera imagen", en: "the one in the first image" } },
  { id: "ton618", real: true, name: "TON 618", mass: 6.6e10, published: { es: "6,6 × 10¹⁰", en: "6.6 × 10¹⁰" }, level: "estimated", ref: "shemmer2004", label: { es: "TON 618", en: "TON 618" }, what: { es: "un cuásar: de los más masivos estimados", en: "a quasar: among the most massive estimated" } },
];

// Escalera de tamaños para comparar el DIÁMETRO del horizonte (2·r_s), en metros.
// Los tres primeros son objetos cotidianos de tamaño aproximado; el resto sale
// de las constantes IAU y de la hoja de datos planetarios de la NASA.
export const SIZE_LADDER = [
  { id: "marble", d: 0.016, approx: true, name: { es: "una canica", en: "a marble" }, short: { es: "canica", en: "marble" } },
  { id: "ball", d: 0.22, approx: true, name: { es: "un balón de fútbol", en: "a football" }, short: { es: "balón", en: "football" } },
  { id: "pitch", d: 105, approx: true, name: { es: "una cancha de fútbol", en: "a football pitch" }, short: { es: "cancha", en: "pitch" } },
  { id: "city", d: 10000, approx: true, name: { es: "una ciudad de 10 km de ancho", en: "a city 10 km across" }, short: { es: "ciudad", en: "city" } },
  { id: "earth", d: 2 * R_EARTH, name: { es: "la Tierra", en: "Earth" }, short: { es: "Tierra", en: "Earth" } },
  { id: "sun", d: 2 * R_SUN, name: { es: "el Sol", en: "the Sun" }, short: { es: "Sol", en: "Sun" } },
  { id: "mercury", d: 2 * 57.9e9, name: { es: "la órbita de Mercurio", en: "Mercury’s orbit" }, short: { es: "órbita de Mercurio", en: "Mercury’s orbit" } },
  { id: "earthOrbit", d: 2 * AU, name: { es: "la órbita de la Tierra", en: "Earth’s orbit" }, short: { es: "órbita de la Tierra", en: "Earth’s orbit" } },
  { id: "neptune", d: 2 * 4515.0e9, name: { es: "la órbita de Neptuno", en: "Neptune’s orbit" }, short: { es: "órbita de Neptuno", en: "Neptune’s orbit" } },
];

// Objeto de la escalera cuyo tamaño queda más cerca (en proporción) del diámetro dado.
export function nearestSize(diameter) {
  let best = SIZE_LADDER[0], bd = Infinity;
  for (const o of SIZE_LADDER) { const d = Math.abs(Math.log(diameter / o.d)); if (d < bd) { bd = d; best = o; } }
  return { obj: best, ratio: diameter / best.d };
}

// Densidades de referencia (aproximadas, de uso corriente) para la densidad media.
export const DENSITY_MARKS = { water: 1000, air: 1.2 };

// "¿Los hemos visto?": lo calculado frente a lo medido por el EHT.
export const EHT = [
  { id: "sgra", name: "Sgr A*", year: 2022, mass: 4.297e6, distanceM: 8277 * PC, ring: 51.8, ringErr: 2.3, shadow: 48.7, shadowErr: 7.0, independent: true, refs: ["eht2022", "gravity2022"], image: "https://www.eso.org/public/news/eso2208-eht-mw/" },
  { id: "m87", name: "M87*", year: 2019, mass: 6.5e9, distanceM: 16.8 * MPC, ring: 42, ringErr: 3, independent: false, refs: ["eht2019", "eht2019vi", "gebhardt2011"], image: "https://www.eso.org/public/news/eso1907/" },
];

export const TIDE_HEIGHT_M = 2;        // de la cabeza a los pies

export const BH_NEXT = [
  { url: "https://www.eso.org/public/news/eso2208-eht-mw/", label: { es: "La imagen de Sgr A* (ESO / EHT, 2022)", en: "The image of Sgr A* (ESO / EHT, 2022)" }, note: { es: "el comunicado oficial, con la imagen y cómo se hizo", en: "the official release, with the image and how it was made" } },
  { url: "https://www.eso.org/public/news/eso1907/", label: { es: "La imagen de M87* (ESO / EHT, 2019)", en: "The image of M87* (ESO / EHT, 2019)" }, note: { es: "la primera imagen de un agujero negro", en: "the first image of a black hole" } },
  { url: "https://eventhorizontelescope.org/", label: { es: "Event Horizon Telescope", en: "Event Horizon Telescope" }, note: { es: "la red de radiotelescopios del tamaño de la Tierra", en: "the Earth-sized network of radio telescopes" } },
  { url: "https://science.nasa.gov/universe/black-holes/", label: { es: "Agujeros negros (NASA)", en: "Black holes (NASA)" }, note: { es: "tipos, cómo se forman y cómo se detectan", en: "types, how they form and how they are found" } },
  { url: "https://www.zooniverse.org/projects/cobalt-lensing/black-hole-hunters", label: { es: "Black Hole Hunters (Zooniverse)", en: "Black Hole Hunters (Zooniverse)" }, note: { es: "ciencia ciudadana: busca agujeros negros en curvas de luz", en: "citizen science: look for black holes in light curves" } },
];

export const BH_T = {
  es: {
    title: "¿Qué pasa cerca de un agujero negro?",
    lead: "Un agujero negro es una región de la que nada sale, ni la luz. Su borde, el horizonte, depende de un solo número: la masa. Elige una y mira cuánto mide, y cuánto se frena el tiempo a su lado.",
    massLabel: "Masa del agujero negro",
    massHint: "escala logarítmica: cada paso multiplica",
    presetsLabel: "Prueba con uno de verdad",
    hypoLabel: "o con un ejercicio mental",
    hypoNote: (name) => `Ejercicio mental: ${name} no es un agujero negro, ni se conoce ninguno con esa masa. La pregunta es cuánto habría que comprimir su masa.`,
    customNote: "Masa elegida a mano. La fórmula es la misma para cualquier masa.",
    realNote: (what, pub) => `${what}. Masa publicada: ${pub} masas solares.`,
    jsonNote: "La calculadora usa la masa de la capa «Agujeros negros» del Cielo de Teseo, que redondea ese valor.",
    rsLabel: "Radio del horizonte",
    rsAria: "Radio de Schwarzschild",
    formula: "r_s = 2·G·M / c²",
    sameAs: (name) => `Su diámetro es más o menos el de ${name}.`,
    bigger: (k, name) => `Su diámetro es ${k} veces el de ${name}.`,
    smaller: (k, name) => `Su diámetro es ${k} veces menor que el de ${name}.`,
    approx: "Tamaño cotidiano aproximado.",
    scaleAria: (a, b) => `Dibujo a escala: el horizonte junto a ${b}. ${a}`,
    horizon: "horizonte",
    densityLabel: "Densidad media",
    densityUnit: "kg/m³",
    densityWater: (k) => `${k} veces la del agua`,
    densityLess: (k) => `${k} veces menor que la del agua`,
    densityAir: "menos que el aire que respiras",
    densityNote: "Masa repartida en una esfera del tamaño del horizonte. Es una convención para comparar: no describe el interior.",
    tideLabel: "Marea en el horizonte",
    tideUnit: "g = gravedad de la Tierra. Es la diferencia entre la cabeza y los pies (2 m).",
    tideSoft: "imperceptible: menos de una milésima de la gravedad de la Tierra",
    whyRs: "¿De dónde sale este número?",
    whyRsBody: "Karl Schwarzschild lo dedujo en 1916 de las ecuaciones de Einstein: r_s = 2GM/c². Vale para un agujero negro que no gira y sin carga eléctrica; los reales giran, y su horizonte es algo menor. Teseo usa el producto G·M del Sol fijado por la Unión Astronómica Internacional y la velocidad de la luz, exacta por definición. La densidad media es M ÷ (4/3·π·r_s³) y decrece con el cuadrado de la masa: por eso los agujeros negros gigantes son, en promedio, menos densos que el agua.",
    timeTitle: "El tiempo, cerca del horizonte",
    timeLead: "Imagina a alguien que logra quedarse quieto a cierta distancia, con los motores encendidos para no caer. Su reloj va más lento que el de quien está lejos.",
    distLabel: "Distancia al centro",
    distHint: "en radios del horizonte",
    distValue: (x, above) => `${x} r_s: ${above} sobre el horizonte`,
    distAria: (x, above) => `${x} radios del horizonte: ${above} por encima de él`,
    timeFor: "1 hora para ti",
    timeEquals: "para alguien lejos son",
    timeRate: (pct) => `Tu reloj marcha al ${pct} % del ritmo lejano.`,
    timeFormula: "t_lejos = t_tuyo / √(1 − r_s / r)",
    timeNote: "Vale solo fuera del horizonte y para un observador inmóvil, lejos de cualquier otra masa. Quien orbita o cae vive otra cuenta. En el horizonte el factor se hace infinito: ahí nadie puede quedarse quieto.",
    timeTagNote: "cálculo con relatividad general; nadie ha puesto un reloj ahí",
    threadTitle: "Lo que se dice de ellos",
    seen: {
      title: "¿Los hemos visto?",
      teaser: "Dos, y su tamaño coincide con lo calculado.",
      p1: "Un agujero negro no emite luz, pero el gas caliente que lo rodea sí. La gravedad curva esa luz y deja una silueta oscura, la sombra, rodeada de un anillo brillante. Para un agujero negro que no gira, la sombra mide √27 ≈ 5,2 radios del horizonte de ancho: 2,6 veces el horizonte mismo.",
      p2: "El Event Horizon Telescope, una red de radiotelescopios repartidos por todo el planeta, fotografió dos: M87* (publicado en 2019) y Sgr A* (2022). Teseo calcula aquí el tamaño de la sombra con la masa y la distancia publicadas, y lo compara con el anillo medido.",
      predicted: "Sombra calculada",
      ring: "Anillo medido",
      shadowMeasured: "Sombra medida",
      unit: "µas",
      rowAria: (name, calc, ring) => `${name}: sombra calculada ${calc} microsegundos de arco; anillo medido ${ring}.`,
      independent: "Prueba independiente: la masa viene de las órbitas de estrellas alrededor de Sgr A*, no de la imagen.",
      circular: "Ojo: esta masa la dedujo el propio EHT del tamaño del anillo, así que aquí la coincidencia no prueba nada por sí sola. La medida independiente, con el movimiento de las estrellas, da (6,6 ± 0,4) × 10⁹ masas solares: compatible.",
      muas: "Un microsegundo de arco (µas) es la milmillonésima parte de un grado, dividida entre 3,6. Visto desde aquí, el anillo de Sgr A* tiene más o menos el tamaño de una rosquilla en la Luna (la comparación es del comunicado oficial).",
      fine: "El anillo no es exactamente la sombra: es el gas que la rodea, y el EHT calibra la relación con simulaciones. El giro del agujero negro cambia poco el tamaño.",
      image: (name) => `Ver la imagen oficial de ${name}`,
      tag: "measured",
    },
    vacuum: {
      title: "«Se lo tragan todo»",
      teaser: "No aspiran: atraen igual que cualquier masa.",
      p1: "Si el Sol se convirtiera ahora mismo en un agujero negro con su misma masa, la Tierra seguiría en su órbita. Lejos del horizonte, la gravedad solo depende de la masa y de la distancia, y ninguna de las dos cambiaría.",
      calcTitle: "La cuenta",
      rows: (rs, v, far) => [
        ["Horizonte de un Sol convertido en agujero negro", rs],
        ["Velocidad orbital de la Tierra, con el Sol de hoy: v = √(GM/r)", v],
        ["Velocidad orbital de la Tierra, con el agujero negro", v],
        ["Distancia de la Tierra, en radios de ese horizonte", far],
      ],
      p2: "Lo que sí cambiaría: se acabaría la luz. Un agujero negro solo captura lo que pasa muy cerca; desde lejos se orbita igual que alrededor de una estrella. Así se pesó Sgr A*: siguiendo durante décadas a las estrellas que giran a su alrededor.",
      tag: "measured",
      tagNote: "la ley de la gravedad; el Sol no se convertirá en agujero negro",
    },
    spag: {
      title: "Espaguetización",
      teaser: "Depende del tamaño: los pequeños estiran más.",
      p1: "Cerca de una masa, tus pies sienten más gravedad que tu cabeza. Esa diferencia, la marea, te estira. En el horizonte vale Δa = 2·G·M·h / r_s³, que crece cuanto menor es el agujero negro.",
      tableTitle: (h) => `Marea entre cabeza y pies (${h} m) al cruzar el horizonte`,
      col: ["Agujero negro", "Marea", "En gravedades terrestres"],
      p2: "En uno de masa estelar, la marea te destruiría mucho antes de llegar al horizonte. En uno supermasivo cruzarías el horizonte sin notar nada especial; el estiramiento llegaría después, más adentro.",
      fine: "Es la marea radial para un cuerpo en caída libre, sin giro del agujero negro. Nadie lo ha medido: es un cálculo.",
      tag: "estimated",
      tagNote: "calculado, no medido",
    },
    unknown: {
      title: "Lo que nadie sabe",
      teaser: "Qué hay dentro, y qué pasa con la información.",
      p1: "La relatividad general predice que en el centro la densidad se hace infinita: una singularidad. Casi nadie cree que eso ocurra de verdad; se toma como señal de que la teoría deja de valer ahí. Haría falta una teoría cuántica de la gravedad, y no la tenemos.",
      p2: "En 1974 Stephen Hawking calculó que los agujeros negros deberían emitir una radiación tenue y evaporarse muy despacio. Nunca se ha observado. Si ocurre, plantea un problema sin resolver: qué pasa con la información de todo lo que cayó.",
      p3: "Tampoco sabemos cómo crecieron tan rápido los agujeros negros gigantes del universo joven. Lo que sí está medido es el exterior: masas, órbitas, sombras y ondas gravitacionales.",
      tag: "unknown",
    },
    skyBtn: "Verlos en el cielo",
    skyNote: (n) => `Abre el Cielo de Teseo con la capa de ${n} agujeros negros.`,
    skyNoteNoCount: "Abre el Cielo de Teseo con la capa de agujeros negros.",
    honest: "Esto es aritmética con fórmulas publicadas. Teseo la hace en tu teléfono; ninguna IA interviene en el cálculo.",
  },
  en: {
    title: "What happens near a black hole?",
    lead: "A black hole is a region nothing leaves, not even light. Its edge, the horizon, depends on a single number: the mass. Pick one and see how big it is, and how much time slows beside it.",
    massLabel: "Mass of the black hole",
    massHint: "logarithmic scale: each step multiplies",
    presetsLabel: "Try a real one",
    hypoLabel: "or a thought experiment",
    hypoNote: (name) => `Thought experiment: ${name} is not a black hole, and none is known with that mass. The question is how far its mass would have to be squeezed.`,
    customNote: "Mass picked by hand. The formula is the same for any mass.",
    realNote: (what, pub) => `${what}. Published mass: ${pub} solar masses.`,
    jsonNote: "The calculator uses the mass from the “Black holes” layer of Teseo’s Sky, which rounds that value.",
    rsLabel: "Radius of the horizon",
    rsAria: "Schwarzschild radius",
    formula: "r_s = 2·G·M / c²",
    sameAs: (name) => `Its diameter is about that of ${name}.`,
    bigger: (k, name) => `Its diameter is ${k} times that of ${name}.`,
    smaller: (k, name) => `Its diameter is ${k} times smaller than that of ${name}.`,
    approx: "Approximate everyday size.",
    scaleAria: (a, b) => `Scale drawing: the horizon next to ${b}. ${a}`,
    horizon: "horizon",
    densityLabel: "Mean density",
    densityUnit: "kg/m³",
    densityWater: (k) => `${k} times that of water`,
    densityLess: (k) => `${k} times lower than water`,
    densityAir: "less than the air you breathe",
    densityNote: "Mass spread over a sphere the size of the horizon. It is a convention for comparing: it does not describe the interior.",
    tideLabel: "Tide at the horizon",
    tideUnit: "g = Earth’s gravity. This is the difference between head and feet (2 m).",
    tideSoft: "imperceptible: under a thousandth of Earth’s gravity",
    whyRs: "Where does this number come from?",
    whyRsBody: "Karl Schwarzschild derived it in 1916 from Einstein’s equations: r_s = 2GM/c². It holds for a black hole that does not spin and has no electric charge; real ones spin, and their horizon is somewhat smaller. Teseo uses the Sun’s G·M product fixed by the International Astronomical Union and the speed of light, exact by definition. Mean density is M ÷ (4/3·π·r_s³) and falls with the square of the mass: that is why giant black holes are, on average, less dense than water.",
    timeTitle: "Time, near the horizon",
    timeLead: "Picture someone who manages to hover at a set distance, engines on so as not to fall. Their clock runs slower than the clock of someone far away.",
    distLabel: "Distance from the centre",
    distHint: "in horizon radii",
    distValue: (x, above) => `${x} r_s: ${above} above the horizon`,
    distAria: (x, above) => `${x} horizon radii: ${above} above it`,
    timeFor: "1 hour for you",
    timeEquals: "is, for someone far away,",
    timeRate: (pct) => `Your clock runs at ${pct}% of the far-away rate.`,
    timeFormula: "t_far = t_yours / √(1 − r_s / r)",
    timeNote: "Valid only outside the horizon and for an observer holding still, far from any other mass. Anyone orbiting or falling gets a different sum. At the horizon the factor becomes infinite: nobody can hold still there.",
    timeTagNote: "computed with general relativity; nobody has put a clock there",
    threadTitle: "What people say about them",
    seen: {
      title: "Have we seen one?",
      teaser: "Two, and their size matches the calculation.",
      p1: "A black hole emits no light, but the hot gas around it does. Gravity bends that light and leaves a dark silhouette, the shadow, inside a bright ring. For a black hole that does not spin, the shadow is √27 ≈ 5.2 horizon radii across: 2.6 times the horizon itself.",
      p2: "The Event Horizon Telescope, a network of radio telescopes spread across the planet, imaged two: M87* (published in 2019) and Sgr A* (2022). Here Teseo computes the shadow size from the published mass and distance, and compares it with the measured ring.",
      predicted: "Computed shadow",
      ring: "Measured ring",
      shadowMeasured: "Measured shadow",
      unit: "µas",
      rowAria: (name, calc, ring) => `${name}: computed shadow ${calc} microarcseconds; measured ring ${ring}.`,
      independent: "Independent test: the mass comes from the orbits of stars around Sgr A*, not from the image.",
      circular: "Careful: the EHT itself derived this mass from the size of the ring, so the match here proves nothing on its own. The independent measurement, from the motion of stars, gives (6.6 ± 0.4) × 10⁹ solar masses: compatible.",
      muas: "A microarcsecond (µas) is a billionth of a degree, divided by 3.6. Seen from here, the ring of Sgr A* is about the size of a doughnut on the Moon (the comparison comes from the official release).",
      fine: "The ring is not exactly the shadow: it is the gas around it, and the EHT calibrates the relation with simulations. The black hole’s spin changes the size only slightly.",
      image: (name) => `See the official image of ${name}`,
      tag: "measured",
    },
    vacuum: {
      title: "“They swallow everything”",
      teaser: "They do not suck: they pull like any other mass.",
      p1: "If the Sun turned into a black hole of the same mass right now, Earth would stay in its orbit. Far from the horizon, gravity depends only on mass and distance, and neither would change.",
      calcTitle: "The sums",
      rows: (rs, v, far) => [
        ["Horizon of a Sun turned black hole", rs],
        ["Earth’s orbital speed with today’s Sun: v = √(GM/r)", v],
        ["Earth’s orbital speed with the black hole", v],
        ["Earth’s distance, in radii of that horizon", far],
      ],
      p2: "What would change: the light would go out. A black hole only captures what passes very close; from far away you orbit it just as you orbit a star. That is how Sgr A* was weighed: by following, for decades, the stars that circle it.",
      tag: "measured",
      tagNote: "the law of gravity; the Sun will not become a black hole",
    },
    spag: {
      title: "Spaghettification",
      teaser: "It depends on size: small ones stretch harder.",
      p1: "Near a mass, your feet feel more gravity than your head. That difference, the tide, stretches you. At the horizon it is Δa = 2·G·M·h / r_s³, which grows the smaller the black hole is.",
      tableTitle: (h) => `Tide between head and feet (${h} m) when crossing the horizon`,
      col: ["Black hole", "Tide", "In Earth gravities"],
      p2: "At a stellar-mass one, the tide would destroy you long before the horizon. At a supermassive one you would cross the horizon feeling nothing special; the stretching would come later, further in.",
      fine: "This is the radial tide for a body in free fall, with no black-hole spin. Nobody has measured it: it is a calculation.",
      tag: "estimated",
      tagNote: "computed, not measured",
    },
    unknown: {
      title: "What nobody knows",
      teaser: "What is inside, and what happens to information.",
      p1: "General relativity predicts that density becomes infinite at the centre: a singularity. Almost nobody thinks that really happens; it is read as a sign that the theory stops working there. A quantum theory of gravity would be needed, and we do not have one.",
      p2: "In 1974 Stephen Hawking calculated that black holes should emit a faint radiation and evaporate very slowly. It has never been observed. If it happens, it raises an unsolved problem: what becomes of the information in everything that fell in.",
      p3: "Nor do we know how the giant black holes of the young universe grew so fast. What has been measured is the outside: masses, orbits, shadows and gravitational waves.",
      tag: "unknown",
    },
    skyBtn: "See them in the sky",
    skyNote: (n) => `Opens Teseo’s Sky with the layer of ${n} black holes.`,
    skyNoteNoCount: "Opens Teseo’s Sky with the black-hole layer.",
    honest: "This is arithmetic with published formulas. Teseo does it on your phone; no AI takes part in the calculation.",
  },
};
