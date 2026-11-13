// drakeData.js — todos los números y referencias de la pestaña "Preguntas".
//
// Regla de la casa: ningún valor sin procedencia. Cada cifra apunta a una
// entrada de REFS (autor/institución, año, enlace). Las referencias se
// consultaron el 12-nov-2026. Donde NO hay medición (fl, fi, fc, L) se dice
// así y el nivel de certeza es "unknown": los límites de esos deslizadores
// son topes arbitrarios de la interfaz, no intervalos de confianza.
//
// Niveles de certeza (fijos por factor):
//   measured  → hay observaciones directas y varias mediciones independientes
//   estimated → extrapolado de observaciones, con barras de error grandes
//   unknown   → hipótesis: nadie lo sabe

export const REFS = {
  drake1961: {
    cite: "Drake (1961), reunión de Green Bank; valores recogidos en Drake & Sobel (1992), vía Wikipedia «Drake equation»",
    citeEn: "Drake (1961), Green Bank meeting; values as reported in Drake & Sobel (1992), via Wikipedia “Drake equation”",
    url: "https://en.wikipedia.org/wiki/Drake_equation#Original_estimates",
  },
  seti: {
    cite: "SETI Institute, «Drake Equation»",
    citeEn: "SETI Institute, “Drake Equation”",
    url: "https://www.seti.org/drake-equation-index",
  },
  licquia2015: {
    // Abstract: Ṁ★ = 1.65 ± 0.19 M☉/yr (IMF de Kroupa)
    cite: "Licquia & Newman (2015), The Astrophysical Journal 806, 96",
    url: "https://arxiv.org/abs/1407.1078",
  },
  elia2022: {
    // Abstract: SFR global = 2.0 ± 0.7 M☉/yr (Herschel Hi-GAL)
    cite: "Elia et al. (2022), The Astrophysical Journal (datos de Herschel)",
    citeEn: "Elia et al. (2022), The Astrophysical Journal (Herschel data)",
    url: "https://arxiv.org/abs/2211.05573",
  },
  cassan2012: {
    // Abstract: 17 % de estrellas con "Júpiteres", 52 % con Neptunos fríos,
    // 62 % con supertierras, en órbitas de 0,5–10 UA. "Planets are the rule".
    cite: "Cassan et al. (2012), Nature 481, 167",
    url: "https://arxiv.org/abs/1202.0903",
  },
  bryson2021: {
    // Abstract: planetas rocosos (0,5–1,5 R⊕) en zona habitable por estrella
    // tipo Sol (4800–6300 K): 0,37 (+0,48/−0,21) a 0,60 (+0,90/−0,36) con la
    // zona conservadora; 0,58 a 0,88 con la optimista. Intervalos del 68 %.
    cite: "Bryson et al. (2021), The Astronomical Journal (datos de Kepler)",
    citeEn: "Bryson et al. (2021), The Astronomical Journal (Kepler data)",
    url: "https://arxiv.org/abs/2010.14812",
  },
  nasaDrake: {
    cite: "NASA Science (2016), «Are We Alone in the Universe? Revisiting the Drake Equation»",
    citeEn: "NASA Science (2016), “Are We Alone in the Universe? Revisiting the Drake Equation”",
    url: "https://science.nasa.gov/universe/exoplanets/are-we-alone-in-the-universe-revisiting-the-drake-equation/",
  },
  wardBrownlee2000: {
    cite: "Ward & Brownlee (2000), «Rare Earth» (argumento; los valores del preajuste son de Teseo)",
    citeEn: "Ward & Brownlee (2000), “Rare Earth” (the argument; the preset's values are Teseo's)",
    url: "https://en.wikipedia.org/wiki/Rare_Earth_hypothesis",
  },
  esaGalaxy: {
    // "The disc measures about 100 000 light-years across"; disco fino ~700 al
    // de alto, disco grueso ~3000. Usamos 1.000 como cifra redonda intermedia.
    cite: "ESA/Gaia (2018), «Anatomy of the Milky Way»",
    citeEn: "ESA/Gaia (2018), “Anatomy of the Milky Way”",
    url: "https://www.esa.int/ESA_Multimedia/Images/2018/05/Anatomy_of_the_Milky_Way",
  },
  jones1985: {
    cite: "Jones (1985), «“Where is everybody?” An account of Fermi's question», Los Alamos LA-10311-MS",
    citeEn: "Jones (1985), “‘Where is everybody?’ An account of Fermi's question”, Los Alamos LA-10311-MS",
    url: "https://www.osti.gov/biblio/5746675",
  },
  berlin1936: {
    cite: "Juegos de Berlín 1936: primeros con televisión en directo (Wikipedia «1936 Summer Olympics», citando a Inside the Games, 2021)",
    citeEn: "Berlin 1936: first Games with live television (Wikipedia “1936 Summer Olympics”, citing Inside the Games, 2021)",
    url: "https://en.wikipedia.org/wiki/1936_Summer_Olympics",
  },
  lakdawalla2012: {
    // "…so attenuated by that 100-light-year boundary as to be undetectable."
    cite: "Lakdawalla (2012), The Planetary Society, «This is how far human radio broadcasts have reached into the galaxy»",
    citeEn: "Lakdawalla (2012), The Planetary Society, “This is how far human radio broadcasts have reached into the galaxy”",
    url: "https://www.planetary.org/articles/3390",
  },
  hanson1998: {
    cite: "Hanson (1998; primera versión de 1996), «The Great Filter – Are We Almost Past It?»",
    citeEn: "Hanson (1998; first version 1996), “The Great Filter – Are We Almost Past It?”",
    url: "https://mason.gmu.edu/~rhanson/greatfilter.html",
  },
  kardashevWiki: {
    // Fórmula de Sagan (citada vía Carrigan 2010) y valores originales de
    // Kardashov 1964: 4e19, 4e33 y 4e44 erg/s (= 4e12, 4e26 y 4e37 W).
    cite: "Kardashov (1964) y Sagan (1973), resumidos en Wikipedia «Kardashev scale»; fórmula citada en Carrigan (2010)",
    citeEn: "Kardashev (1964) and Sagan (1973), as summarised in Wikipedia “Kardashev scale”; formula as cited in Carrigan (2010)",
    url: "https://en.wikipedia.org/wiki/Kardashev_scale",
  },
  carrigan2010: {
    cite: "Carrigan (2010), «Starry Messages: Searching for Signatures of Interstellar Archaeology»",
    citeEn: "Carrigan (2010), “Starry Messages: Searching for Signatures of Interstellar Archaeology”",
    url: "https://arxiv.org/abs/1001.5455",
  },
  ei2025: {
    // "…total energy demand… reaching a new high of 592 EJ" (2024, +2 %)
    cite: "Energy Institute (2025), Statistical Review of World Energy, 74.ª edición",
    citeEn: "Energy Institute (2025), Statistical Review of World Energy, 74th edition",
    url: "https://energyinst.org/exploring-energy/resources/news-centre/media-releases/renewables-soar,-but-fossil-fuels-continue-to-rise-as-global-electricity-demand-hits-record-levels",
  },
  iau2015: {
    // L☉ nominal = 3,828e26 W; irradiancia solar total nominal = 1361 W/m²
    cite: "Unión Astronómica Internacional (2015), Resolución B3",
    citeEn: "International Astronomical Union (2015), Resolution B3",
    url: "https://arxiv.org/abs/1510.07674",
  },
};

// ─── Los siete factores ──────────────────────────────────────────────────────
// min/max: recorrido del deslizador (logarítmico, pasos de 0,05 dex).
// modern:  valor de hoy para los factores con respaldo observacional.
// drake:   valor del preajuste "Drake 1961" (dentro de los rangos de 1961).
export const FACTORS = [
  {
    key: "rstar", symbol: "R", sub: "*", certainty: "measured", kind: "rate",
    min: 0.5, max: 10, drake: 1, modern: 2,
    name: { es: "Estrellas que nacen cada año", en: "Stars born each year" },
    what: { es: "en la Vía Láctea", en: "in the Milky Way" },
    why: {
      es: "La Vía Láctea convierte en estrellas entre 1,65 ± 0,19 y 2,0 ± 0,7 masas solares de gas al año, según dos mediciones independientes. Como la estrella típica pesa menos que el Sol, eso son unas pocas estrellas por año: usamos 2. El paso de masa a número de estrellas es una aproximación nuestra. En 1961 Drake usó 1 y lo consideraba prudente.",
      en: "The Milky Way turns between 1.65 ± 0.19 and 2.0 ± 0.7 solar masses of gas into stars each year, according to two independent measurements. Because the typical star weighs less than the Sun, that is a few stars a year: we use 2. Going from mass to a number of stars is our own approximation. In 1961 Drake used 1 and called it conservative.",
    },
    refs: ["licquia2015", "elia2022", "drake1961"],
  },
  {
    key: "fp", symbol: "f", sub: "p", certainty: "measured", kind: "fraction",
    min: 0.1, max: 1, drake: 0.5, modern: 1,
    name: { es: "Estrellas con planetas", en: "Stars with planets" },
    what: { es: "fracción del total", en: "fraction of all stars" },
    why: {
      es: "Las búsquedas por microlente gravitacional encontraron que, entre 0,5 y 10 UA, el 17 % de las estrellas tiene un planeta como Júpiter, el 52 % un Neptuno frío y el 62 % una supertierra: los planetas son la regla y no la excepción. Por eso usamos 1. En 1961 se supuso entre 0,2 y 0,5.",
      en: "Gravitational microlensing surveys found that, between 0.5 and 10 AU, 17% of stars host a Jupiter-like planet, 52% a cool Neptune and 62% a super-Earth: planets are the rule, not the exception. So we use 1. In 1961 the guess was 0.2 to 0.5.",
    },
    refs: ["cassan2012", "drake1961"],
  },
  {
    key: "ne", symbol: "n", sub: "e", certainty: "estimated", kind: "count",
    min: 0.01, max: 5, drake: 2, modern: 0.4,
    name: { es: "Planetas aptos por sistema", en: "Suitable planets per system" },
    what: { es: "rocosos y en zona habitable", en: "rocky, in the habitable zone" },
    why: {
      es: "Con los datos de Kepler se calcula que cada estrella parecida al Sol tiene entre 0,37 y 0,60 planetas rocosos en su zona habitable (hasta 0,88 con una zona más generosa), con márgenes de error casi tan grandes como el propio valor. Usamos 0,4. Es una extrapolación: Kepler apenas detectó planetas así. Y «zona habitable» solo significa que el agua líquida sería posible, no que el planeta sea habitable. En 1961 se supuso entre 1 y 5.",
      en: "Kepler data suggest each Sun-like star has between 0.37 and 0.60 rocky planets in its habitable zone (up to 0.88 with a more generous zone), with error bars nearly as large as the value itself. We use 0.4. It is an extrapolation: Kepler barely detected such planets. And “habitable zone” only means liquid water would be possible, not that the planet is habitable. In 1961 the guess was 1 to 5.",
    },
    refs: ["bryson2021", "drake1961"],
  },
  {
    key: "fl", symbol: "f", sub: "l", certainty: "unknown", kind: "fraction",
    min: 1e-9, max: 1, drake: 1,
    name: { es: "Donde surge la vida", en: "Where life appears" },
    what: { es: "fracción de los planetas aptos", en: "fraction of suitable planets" },
    why: {
      es: "No hay ninguna medición. Conocemos un solo planeta con vida, el nuestro, y con un único caso no se puede calcular una frecuencia. En 1961 se supuso 1 (siempre); otros defienden valores bajísimos. El tope inferior del deslizador es arbitrario: podría ser aún menor.",
      en: "There is no measurement. We know one planet with life, ours, and you cannot work out a frequency from a single case. In 1961 the guess was 1 (always); others argue for extremely low values. The slider's lower limit is arbitrary: it could be lower still.",
    },
    refs: ["seti", "drake1961"],
  },
  {
    key: "fi", symbol: "f", sub: "i", certainty: "unknown", kind: "fraction",
    min: 1e-9, max: 1, drake: 1,
    name: { es: "Donde la vida se vuelve inteligente", en: "Where life becomes intelligent" },
    what: { es: "fracción de los planetas con vida", en: "fraction of living planets" },
    why: {
      es: "No hay ninguna medición. En la Tierra hubo vida durante miles de millones de años antes de que apareciera una especie capaz de hacer ciencia, y pasó una sola vez. En 1961 se supuso 1. La NASA lo resume así: no tenemos idea de qué tan probable es.",
      en: "There is no measurement. Earth had life for billions of years before a species able to do science appeared, and it happened once. In 1961 the guess was 1. NASA sums it up: we have no idea how likely it is.",
    },
    refs: ["nasaDrake", "drake1961"],
  },
  {
    key: "fc", symbol: "f", sub: "c", certainty: "unknown", kind: "fraction",
    min: 1e-3, max: 1, drake: 0.2,
    name: { es: "Que emiten señales detectables", en: "That send detectable signals" },
    what: { es: "fracción de las inteligentes", en: "fraction of intelligent species" },
    why: {
      es: "No hay ninguna medición. Depende de que una especie inteligente desarrolle tecnología que se note desde lejos, como la radio. En 1961 se supuso entre 0,1 y 0,2.",
      en: "There is no measurement. It depends on an intelligent species developing technology that can be noticed from afar, such as radio. In 1961 the guess was 0.1 to 0.2.",
    },
    refs: ["seti", "drake1961"],
  },
  {
    key: "L", symbol: "L", sub: "", certainty: "unknown", kind: "years",
    min: 10, max: 1e9, drake: 10000,
    name: { es: "Años que dura emitiendo", en: "Years it keeps transmitting" },
    what: { es: "vida media de una civilización detectable", en: "average lifetime of a detectable civilization" },
    why: {
      es: "No hay ninguna medición ni forma astronómica de obtenerla. Nuestro único dato somos nosotros, y llevamos menos de un siglo emitiendo. En 1961 se barajó entre 1.000 y 100 millones de años; Drake suele citar 10.000.",
      en: "There is no measurement and no astronomical way to get one. Our only data point is ourselves, and we have been transmitting for less than a century. In 1961 the range discussed was 1,000 to 100 million years; Drake often quotes 10,000.",
    },
    refs: ["seti", "drake1961"],
  },
];

export const MEASURED_KEYS = FACTORS.filter(f => f.certainty !== "unknown").map(f => f.key);
export const UNKNOWN_KEYS = FACTORS.filter(f => f.certainty === "unknown").map(f => f.key);

// ─── Rangos originales de 1961 (para la nota del preajuste y las pruebas) ────
// Mínimo → N = 20; máximo → N = 50.000.000; conclusión de la reunión: N ≈ L.
export const DRAKE_1961_RANGE = {
  min: { rstar: 1, fp: 0.2, ne: 1, fl: 1, fi: 1, fc: 0.1, L: 1000 },
  max: { rstar: 1, fp: 0.5, ne: 5, fl: 1, fi: 1, fc: 0.2, L: 1e8 },
  nMin: 20, nMax: 5e7,
};

// ─── Preajustes ──────────────────────────────────────────────────────────────
// "drake1961": un punto dentro de los rangos documentados de 1961 (N = 2.000).
// "optimistic" y "pessimistic": ESCENARIOS ILUSTRATIVOS DE TESEO, no
// mediciones ni citas. Comparten a propósito los tres factores con respaldo
// observacional (valores de hoy) y solo cambian lo que nadie sabe: así se ve
// que toda la diferencia sale de ahí.
const modern = { rstar: 2, fp: 1, ne: 0.4 };
export const PRESETS = [
  {
    id: "drake1961", refs: ["drake1961", "seti"],
    values: { rstar: 1, fp: 0.5, ne: 2, fl: 1, fi: 1, fc: 0.2, L: 10000 },
    label: { es: "Drake 1961", en: "Drake 1961" },
    note: {
      es: "Un punto dentro de los rangos que se manejaron en la reunión de Green Bank de 1961. Con sus extremos, N iba de 20 a 50 millones; la reunión lo resumió en N ≈ L.",
      en: "A point inside the ranges discussed at the 1961 Green Bank meeting. At their extremes N ran from 20 to 50 million; the meeting summed it up as N ≈ L.",
    },
  },
  {
    id: "optimistic", refs: [],
    values: { ...modern, fl: 1, fi: 0.5, fc: 0.5, L: 1e6 },
    label: { es: "Optimista", en: "Optimistic" },
    note: {
      es: "Escenario ilustrativo de Teseo, no una medición: la vida surge siempre que puede, la mitad de las veces llega a ser inteligente y las civilizaciones duran un millón de años. Los tres factores medidos son los de hoy.",
      en: "An illustrative Teseo scenario, not a measurement: life appears whenever it can, becomes intelligent half the time, and civilizations last a million years. The three measured factors are today's values.",
    },
  },
  {
    id: "pessimistic", refs: ["wardBrownlee2000"],
    values: { ...modern, fl: 1e-3, fi: 1e-6, fc: 0.1, L: 1000 },
    label: { es: "Tierra rara", en: "Rare Earth" },
    longLabel: { es: "Pesimista (Tierra rara)", en: "Pessimistic (Rare Earth)" },
    note: {
      es: "Escenario ilustrativo de Teseo inspirado en la hipótesis de la Tierra rara: la vida compleja exigiría una cadena de casualidades. Los valores son nuestros, no del libro. Los tres factores medidos son idénticos a los del optimista.",
      en: "An illustrative Teseo scenario inspired by the Rare Earth hypothesis: complex life would need a chain of lucky accidents. The values are ours, not the book's. The three measured factors are identical to the optimistic preset.",
    },
  },
];
// "Mi propia apuesta" arranca con los factores medidos de hoy y, para lo que
// nadie sabe, las conjeturas de 1961; a partir de ahí es del usuario.
export const CUSTOM_START = { ...modern, fl: 1, fi: 1, fc: 0.2, L: 10000 };
export const DEFAULT_VALUES = PRESETS[0].values;

// ─── Burbuja de radio (tarjeta de Fermi) ─────────────────────────────────────
// Año de referencia: 1936, primeros Juegos Olímpicos televisados en directo
// (Berlín). Es una convención: la TV en VHF atraviesa la ionosfera, cosa que
// la radio de onda larga y media anterior apenas hace. Que esas señales sean
// DETECTABLES a esa distancia es otra cuestión (no lo son, ver lakdawalla2012).
export const RADIO = { sinceYear: 1936, sunToCenterLy: 26000, refs: ["berlin1936", "lakdawalla2012", "esaGalaxy"] };

// ─── Gran Filtro: los nueve pasos de Hanson (1998) ───────────────────────────
export const FILTER_STEPS = [
  { es: "Un sistema estelar adecuado, con química orgánica", en: "The right star system, with organic chemistry" },
  { es: "Algo que se reproduce (por ejemplo, ARN)", en: "Something that reproduces (e.g. RNA)" },
  { es: "Vida unicelular simple (procariotas)", en: "Simple single-cell life (prokaryotes)" },
  { es: "Vida unicelular compleja (eucariotas)", en: "Complex single-cell life (eukaryotes)" },
  { es: "Reproducción sexual", en: "Sexual reproduction" },
  { es: "Vida multicelular", en: "Multi-cell life" },
  { es: "Animales de cerebro grande que usan herramientas", en: "Tool-using animals with big brains" },
  { es: "Donde estamos ahora", en: "Where we are now", here: true },
  { es: "Expansión por la galaxia", en: "Colonization explosion", future: true },
];

// ─── Kardashov ───────────────────────────────────────────────────────────────
export const WORLD_ENERGY = { ej: 592, year: 2024, ref: "ei2025" };       // EJ/año
export const SOLAR = { luminosityW: 3.828e26, irradianceWm2: 1361, earthRadiusM: 6.3781e6, ref: "iau2015" };
export const KARDASHEV_SLIDER = { minLog: 10, maxLog: 38, step: 0.05 };
// Hitos (potencia en W). Los "Tipo" salen de la fórmula de Sagan (K entero).
export const KARDASHEV_MARKS = [
  { id: "typeI", watts: 1e16, type: true, label: { es: "Tipo I", en: "Type I" }, note: { es: "toda la energía de un planeta", en: "all the energy of a planet" } },
  { id: "sunlight", watts: 1361 * Math.PI * 6.3781e6 * 6.3781e6, label: { es: "Toda la luz solar que llega a la Tierra", en: "All the sunlight reaching Earth" }, refs: ["iau2015"] },
  { id: "typeII", watts: 1e26, type: true, label: { es: "Tipo II", en: "Type II" }, note: { es: "toda la energía de una estrella", en: "all the energy of a star" } },
  { id: "sun", watts: 3.828e26, label: { es: "Toda la luz del Sol", en: "All the Sun's light" }, refs: ["iau2015"] },
  { id: "typeIII", watts: 1e36, type: true, label: { es: "Tipo III", en: "Type III" }, note: { es: "toda la energía de una galaxia", en: "all the energy of a galaxy" } },
  { id: "galaxy", watts: 4e37, label: { es: "Toda la luz de una galaxia como la nuestra", en: "All the light of a galaxy like ours" }, refs: ["kardashevWiki"] },
];

// ─── Para seguir (enlaces comprobados el 12-nov-2026) ────────────────────────
export const NEXT_LINKS = [
  { url: "https://www.seti.org/", label: { es: "SETI Institute", en: "SETI Institute" }, note: { es: "quienes buscan señales", en: "the people listening for signals" } },
  { url: "https://science.nasa.gov/citizen-science/exoplanet-watch/", label: { es: "Exoplanet Watch (NASA)", en: "Exoplanet Watch (NASA)" }, note: { es: "ciencia ciudadana: mide tránsitos de exoplanetas", en: "citizen science: time exoplanet transits" } },
  { url: "https://www.zooniverse.org/projects/nora-dot-eisner/planet-hunters-tess", label: { es: "Planet Hunters TESS", en: "Planet Hunters TESS" }, note: { es: "busca planetas en datos reales del telescopio TESS", en: "hunt for planets in real TESS telescope data" } },
];
