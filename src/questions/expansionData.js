// expansionData.js — datos, fuentes y textos del recorrido "¿El universo se
// expande?". Referencias consultadas el 13-nov-2026.
//
// DECISIÓN SOBRE LOS PUNTOS DEL DIAGRAMA DE HUBBLE
// public/galaxies.json (capa "Galaxias" del Cielo) NO sirve como medición: su
// distancia se calculó en scripts/build_deepsky.py como velocidad ÷ H0 con
// H0 = 70 (ver scripts/README.md y el campo meta.distance del JSON). Dibujar
// velocidad frente a distancia daría una recta perfecta de pendiente 70 por
// construcción: un razonamiento circular. Por eso los puntos "medidos" son las
// 36 supernovas de tipo Ia de la tabla 6 de Freedman et al. (2001, ApJ 553, 47;
// resultado final del Hubble Space Telescope Key Project), cuyas distancias
// salen del brillo de la supernova, calibrado con cefeidas, y no de la
// velocidad. Valores copiados del artículo (arXiv:astro-ph/0012376, tabla 6):
// nombre, V_CMB (km/s), D (Mpc). El artículo obtiene de ellas
// H0 = 71 ± 2 (aleatorio) ± 6 (sistemático) km/s/Mpc; el ajuste sin pesos de
// Teseo sobre los mismos puntos da 70,7.
//
// Otras cifras (texto de cada resumen o tabla):
//  · Planck 2018 (A&A 641, A6): H0 = 67,4 ± 0,5; Ωm = 0,315 ± 0,007;
//    ΩΛ = 0,6847 ± 0,0073; edad = 13,797 ± 0,023 Ga (TT,TE,EE+lowE+lensing).
//  · SH0ES (Riess et al. 2022, ApJL 934, L7): H0 = 73,04 ± 1,04; «5σ» frente a Planck.
//  · Riess et al. 1998 (AJ 116, 1009) y Perlmutter et al. 1999 (ApJ 517, 565):
//    las supernovas lejanas se ven 10–15 % más lejos de lo esperado; Λ > 0.
//  · Nobel de Física 2011: Perlmutter, Schmidt y Riess.
//  · Fondo cósmico: «unos 380 000 años después del Big Bang» (ESA, Planck).
//  · DESI 2024 (arXiv:2404.03002): preferencia, no confirmada, por una energía
//    oscura que cambia con el tiempo.

export const EXP_REFS = {
  freedman2001: { cite: "Freedman et al. (2001), ApJ 553, 47: resultado final del HST Key Project (tabla 6)", citeEn: "Freedman et al. (2001), ApJ 553, 47: final results of the HST Key Project (table 6)", url: "https://arxiv.org/abs/astro-ph/0012376" },
  hubble1929: { cite: "Hubble (1929), PNAS 15, 168: la primera relación velocidad–distancia", citeEn: "Hubble (1929), PNAS 15, 168: the first velocity–distance relation", url: "https://doi.org/10.1073/pnas.15.3.168" },
  planck2018: { cite: "Planck Collaboration (2020), A&A 641, A6: parámetros cosmológicos de Planck 2018", citeEn: "Planck Collaboration (2020), A&A 641, A6: Planck 2018 cosmological parameters", url: "https://arxiv.org/abs/1807.06209" },
  riess2022: { cite: "Riess et al. (2022), ApJL 934, L7: H0 con cefeidas y supernovas (SH0ES)", citeEn: "Riess et al. (2022), ApJL 934, L7: H0 from Cepheids and supernovae (SH0ES)", url: "https://arxiv.org/abs/2112.04510" },
  riess1998: { cite: "Riess et al. (1998), AJ 116, 1009: evidencia de un universo que se acelera", citeEn: "Riess et al. (1998), AJ 116, 1009: evidence for an accelerating universe", url: "https://arxiv.org/abs/astro-ph/9805201" },
  perlmutter1999: { cite: "Perlmutter et al. (1999), ApJ 517, 565: Ω y Λ con 42 supernovas", citeEn: "Perlmutter et al. (1999), ApJ 517, 565: Ω and Λ from 42 supernovae", url: "https://arxiv.org/abs/astro-ph/9812133" },
  nobel2011: { cite: "Premio Nobel de Física 2011", citeEn: "Nobel Prize in Physics 2011", url: "https://www.nobelprize.org/prizes/physics/2011/summary/" },
  esaPlanck: { cite: "ESA, misión Planck", citeEn: "ESA, Planck mission", url: "https://www.esa.int/Science_Exploration/Space_Science/Planck" },
  desi2024: { cite: "DESI Collaboration (2024): oscilaciones acústicas de bariones, resultados cosmológicos", citeEn: "DESI Collaboration (2024): baryon acoustic oscillations, cosmological results", url: "https://arxiv.org/abs/2404.03002" },
  openngc: { cite: "OpenNGC (M. Verga): catálogo de la capa «Galaxias» de Teseo", citeEn: "OpenNGC (M. Verga): catalogue behind Teseo’s “Galaxies” layer", url: "https://github.com/mattiaverga/OpenNGC" },
};

// [nombre de la supernova, V_CMB en km/s, distancia en Mpc] — Freedman et al. 2001, tabla 6
export const SUPERNOVAE = [
  ["1990O", 9065, 134.7],
  ["1990T", 12012, 158.9],
  ["1990af", 15055, 198.6],
  ["1991S", 16687, 238.9],
  ["1991U", 9801, 117.1],
  ["1991ag", 4124, 56.0],
  ["1992J", 13707, 183.9],
  ["1992P", 7880, 121.5],
  ["1992ae", 22426, 274.6],
  ["1992ag", 7765, 102.1],
  ["1992al", 4227, 58.0],
  ["1992aq", 30253, 467.0],
  ["1992au", 18212, 262.2],
  ["1992bc", 5935, 88.6],
  ["1992bg", 10696, 151.4],
  ["1992bh", 13518, 202.5],
  ["1992bk", 17371, 235.9],
  ["1992bl", 12871, 176.8],
  ["1992bo", 5434, 77.9],
  ["1992bp", 23646, 309.5],
  ["1992br", 26318, 391.5],
  ["1992bs", 18997, 280.1],
  ["1993B", 21190, 303.4],
  ["1993O", 15567, 236.1],
  ["1993ag", 15002, 215.4],
  ["1993ah", 8604, 119.7],
  ["1993ac", 14764, 202.3],
  ["1993ae", 5424, 71.8],
  ["1994M", 7241, 96.7],
  ["1994Q", 8691, 127.8],
  ["1994S", 4847, 66.8],
  ["1994T", 10715, 149.9],
  ["1995ac", 14634, 185.6],
  ["1995ak", 6673, 82.4],
  ["1996C", 9024, 136.0],
  ["1996bl", 10446, 132.7],
].map(([name, v, d]) => ({ name: `SN ${name}`, v, d }));

export const H0_SLIDER = { min: 40, max: 100, step: 0.5, start: 50 };
export const OL_SLIDER = { min: 0, max: 0.95, step: 0.005 };

export const PLANCK = { H0: 67.4, H0err: 0.5, Om: 0.315, OL: 0.685, ageGyr: 13.80, ageErr: 0.02 };
export const SH0ES = { H0: 73.04, H0err: 1.04 };
export const KEY_PROJECT = { H0: 71, random: 2, systematic: 6 };
// H0 con el que se construyó la capa "Galaxias" de Teseo (scripts/build_deepsky.py)
export const TESEO_GALAXY_H0 = 70;
export const TESEO_GALAXY_COUNT = 2058;                  // meta.count de public/galaxies.json
export const CMB_AGE_YEARS = 380000;

export const EXP_NEXT = [
  { url: "https://science.nasa.gov/dark-energy/", label: { es: "Energía oscura (NASA)", en: "Dark energy (NASA)" }, note: { es: "qué se sabe y cómo se estudia", en: "what is known and how it is studied" } },
  { url: "https://www.esa.int/Science_Exploration/Space_Science/Euclid", label: { es: "Misión Euclid (ESA)", en: "Euclid mission (ESA)" }, note: { es: "el telescopio que cartografía el universo oscuro", en: "the telescope mapping the dark universe" } },
  { url: "https://www.desi.lbl.gov/", label: { es: "DESI", en: "DESI" }, note: { es: "el mapa 3D de millones de galaxias", en: "the 3D map of millions of galaxies" } },
  { url: "https://science.nasa.gov/mission/roman-space-telescope/", label: { es: "Telescopio Roman (NASA)", en: "Roman Space Telescope (NASA)" }, note: { es: "el siguiente observatorio dedicado a la energía oscura", en: "the next observatory devoted to dark energy" } },
  { url: "https://www.nobelprize.org/prizes/physics/2011/summary/", label: { es: "Nobel de Física 2011", en: "Nobel Prize in Physics 2011" }, note: { es: "el descubrimiento de la expansión acelerada", en: "the discovery of the accelerating expansion" } },
];

export const EXP_T = {
  es: {
    title: "¿El universo se expande?",
    lead: "Las galaxias lejanas se alejan de nosotros, y más deprisa cuanto más lejos están. Cada punto de este gráfico es una supernova real. Ajusta la recta: de su pendiente sale una edad para el universo.",
    chartTitle: "Diagrama de Hubble",
    chartAria: (n, h) => `Diagrama de Hubble con ${n} supernovas: la velocidad a la que se alejan crece con la distancia. Tu recta tiene pendiente ${h} kilómetros por segundo por megapársec.`,
    xLabel: "Distancia (megapársecs)",
    yLabel: "Velocidad (miles de km/s)",
    legPoints: "36 supernovas Ia (medido)",
    legLine: "Tu recta: v = H₀ · d",
    legTeseo: "Galaxias de Teseo (no es una medición)",
    slider: "Constante de Hubble, H₀",
    sliderHint: "la pendiente de la recta",
    sliderValue: (h) => `${h} km/s por Mpc`,
    fit: "Desajuste típico de tu recta",
    fitUnit: "km/s",
    fitGood: "Encaja con los datos.",
    fitOff: "Todavía no encaja: mueve la pendiente.",
    best: "Poner el mejor ajuste",
    bestNote: (h, kp) => `Mejor ajuste de Teseo a estos 36 puntos: ${h}. El artículo original obtuvo ${kp}.`,
    ageLabel: "Edad que implica tu recta (1 ÷ H₀)",
    ageUnit: "mil millones de años",
    ageNote: "1 ÷ H₀ sería la edad exacta si el universo se hubiera expandido siempre al mismo ritmo. No fue así: primero se frenó y ahora se acelera. Por casualidad, los dos efectos casi se compensan.",
    pick: "Toca un punto para ver sus datos.",
    picked: (name, d, v, back) => `${name}: a ${d} Mpc, se aleja a ${v} km/s. Su luz salió hace unos ${back} millones de años.`,
    pointAria: (name, d, v) => `${name}: ${d} megapársecs, ${v} kilómetros por segundo`,
    backNote: "Tiempo de viaje ≈ distancia ÷ velocidad de la luz: aproximación válida para estas distancias.",
    circTitle: "Por qué no usamos las galaxias del Cielo de Teseo",
    circBody: (n, h) => `La capa «Galaxias» del Cielo tiene ${n} galaxias, pero su distancia se calculó a partir de su velocidad, suponiendo H₀ = ${h}. Si las dibujáramos aquí caerían en una recta perfecta: no por la naturaleza, sino por construcción. Sería razonar en círculo. Las 36 supernovas tienen distancias medidas por su brillo, sin usar la velocidad.`,
    circShow: "Mostrarlas de todos modos",
    circHide: "Ocultarlas",
    circLoading: "Cargando las galaxias…",
    circError: "No se pudieron cargar las galaxias. El diagrama no las necesita.",
    circShown: (n, h) => `${n} galaxias de Teseo dibujadas: todas sobre la recta de ${h}, como era de esperar. Sirven para ver hasta dónde llega la capa, no para medir nada.`,
    whySummary: "¿De dónde salen estos puntos?",
    whyBody: "Una supernova de tipo Ia es la explosión de una enana blanca; todas alcanzan casi el mismo brillo real, así que su brillo aparente dice a qué distancia están. La velocidad sale del corrimiento al rojo de su galaxia. Los 36 puntos son la tabla 6 de Freedman y colaboradores (2001), el resultado final del proyecto clave del telescopio Hubble. Edwin Hubble publicó la primera relación de este tipo en 1929.",
    backTitle: "Mirar lejos es mirar atrás",
    backBody: (cmb) => `La luz tarda en llegar: cada punto del gráfico es una explosión que ocurrió hace cientos de millones de años. Cuanto más lejos miramos, más joven es el universo que vemos. El límite es el fondo cósmico de microondas: luz que salió unos ${cmb} años después del Big Bang. Es la última marca de la regla en la pestaña Escala.`,
    accelTitle: "Con y sin energía oscura",
    accelLead: "La gravedad de la materia debería ir frenando la expansión. Este modelo deja elegir cuánta energía oscura hay y dibuja cómo cambia el tamaño del universo con el tiempo.",
    olSlider: "Energía oscura, Ω_Λ",
    olHint: "fracción del total; el resto es materia",
    olValue: (ol, om) => `${ol} % energía oscura, ${om} % materia`,
    planckBtn: "Valores de Planck",
    noneBtn: "Sin energía oscura",
    modelAge: "Edad del universo en este modelo",
    modelNow: "Hoy la expansión",
    accelerates: "se acelera",
    decelerates: "se frena",
    coasting: "ni se acelera ni se frena",
    aAria: (age, ageNo) => `Tamaño del universo frente al tiempo. Con tu energía oscura el universo tiene ${age} mil millones de años; solo con materia tendría ${ageNo}.`,
    aX: "Tiempo respecto a hoy (miles de millones de años)",
    aY: "Tamaño (hoy = 1)",
    legYours: "Tu modelo",
    legMatter: "Solo materia",
    today: "hoy",
    modelFine: (h) => `Ecuación de Friedmann para un universo plano, integrada paso a paso: H(a) = H₀·√(Ω_m/a³ + Ω_Λ), con Ω_m = 1 − Ω_Λ y H₀ = ${h} (Planck). No incluye la radiación, que solo importa en los primeros cientos de miles de años. Las dos curvas comparten el ritmo de expansión de hoy.`,
    planckAge: (a, e) => `Con los valores de Planck el modelo da la edad publicada: ${a} ± ${e} mil millones de años.`,
    threadTitle: "El hilo sigue",
    tension: {
      title: "La tensión de Hubble",
      teaser: "Dos métodos, dos números, y nadie sabe por qué.",
      p1: "Hay dos caminos para medir H₀. Uno mide distancias a galaxias cercanas con cefeidas y supernovas. El otro parte del fondo cósmico de microondas y calcula qué ritmo de expansión debería haber hoy según el modelo estándar.",
      aria: (a, b, s) => `Planck da ${a}; la escalera de distancias da ${b}. Están separados ${s} sigmas.`,
      planck: "Fondo cósmico (Planck 2018)",
      shoes: "Cefeidas + supernovas (SH0ES 2022)",
      yours: "Tu recta",
      axis: "H₀ (km/s por Mpc)",
      sigma: (s) => `Con errores independientes, la diferencia es de ${s} veces la incertidumbre combinada. Es muy difícil que sea casualidad.`,
      p2: "O alguna de las dos mediciones tiene un error que nadie ha encontrado, o al modelo estándar le falta algo. Hoy no se sabe cuál de las dos. Así se ve la ciencia cuando está viva.",
      tag: "measured",
      tagNote: "los dos valores; la causa es desconocida",
    },
    accel: {
      title: "1998: la expansión se acelera",
      teaser: "Las supernovas lejanas brillaban menos de lo esperado.",
      p1: "Dos equipos midieron supernovas de tipo Ia tan lejanas que su luz había viajado miles de millones de años. Esperaban ver cuánto se había frenado la expansión. Encontraron lo contrario: las supernovas estaban entre un 10 y un 15 % más lejos de lo previsto. La expansión se está acelerando.",
      p2: "Saul Perlmutter, Brian Schmidt y Adam Riess recibieron el Nobel de Física de 2011 por este descubrimiento. Desde entonces lo han confirmado métodos independientes, entre ellos el fondo cósmico de microondas.",
      tag: "measured",
    },
    dark: {
      title: "Qué es la energía oscura",
      teaser: "Un nombre para algo que no entendemos.",
      p1: "«Energía oscura» es la etiqueta de lo que causa la aceleración; no dice qué es. La idea más simple es la constante cosmológica de Einstein: una energía del propio espacio vacío, igual en todas partes y en todo momento. Encaja con las observaciones, pero nadie sabe explicar su valor.",
      p2: "Otras ideas: que cambie con el tiempo, o que la gravedad se comporte distinto a escalas enormes. Mediciones de 2024 del instrumento DESI insinúan que podría cambiar con el tiempo; no está confirmado.",
      p3: "Según Planck, es el 68,5 % de todo lo que hay en el universo.",
      tag: "unknown",
    },
    honest: "La recta, el desajuste y la edad se calculan en tu teléfono con los datos publicados; ninguna IA interviene en el cálculo.",
  },
  en: {
    title: "Is the universe expanding?",
    lead: "Distant galaxies are moving away from us, and faster the farther they are. Every point on this chart is a real supernova. Fit the line: its slope gives an age for the universe.",
    chartTitle: "Hubble diagram",
    chartAria: (n, h) => `Hubble diagram with ${n} supernovae: the speed at which they recede grows with distance. Your line has a slope of ${h} kilometres per second per megaparsec.`,
    xLabel: "Distance (megaparsecs)",
    yLabel: "Speed (thousand km/s)",
    legPoints: "36 type Ia supernovae (measured)",
    legLine: "Your line: v = H₀ · d",
    legTeseo: "Teseo’s galaxies (not a measurement)",
    slider: "Hubble constant, H₀",
    sliderHint: "the slope of the line",
    sliderValue: (h) => `${h} km/s per Mpc`,
    fit: "Typical misfit of your line",
    fitUnit: "km/s",
    fitGood: "It fits the data.",
    fitOff: "Not fitting yet: move the slope.",
    best: "Set the best fit",
    bestNote: (h, kp) => `Teseo’s best fit to these 36 points: ${h}. The original paper found ${kp}.`,
    ageLabel: "Age your line implies (1 ÷ H₀)",
    ageUnit: "billion years",
    ageNote: "1 ÷ H₀ would be the exact age if the universe had always expanded at the same rate. It did not: first it slowed, and now it speeds up. By coincidence, the two effects nearly cancel.",
    pick: "Tap a point to see its data.",
    picked: (name, d, v, back) => `${name}: ${d} Mpc away, receding at ${v} km/s. Its light left about ${back} million years ago.`,
    pointAria: (name, d, v) => `${name}: ${d} megaparsecs, ${v} kilometres per second`,
    backNote: "Travel time ≈ distance ÷ speed of light: an approximation that holds at these distances.",
    circTitle: "Why we do not use the galaxies from Teseo’s Sky",
    circBody: (n, h) => `The “Galaxies” layer of the Sky has ${n} galaxies, but their distance was computed from their speed, assuming H₀ = ${h}. Plotted here they would fall on a perfect line: not because of nature, but by construction. That would be circular reasoning. The 36 supernovae have distances measured from their brightness, without using the speed.`,
    circShow: "Show them anyway",
    circHide: "Hide them",
    circLoading: "Loading the galaxies…",
    circError: "The galaxies could not be loaded. The diagram does not need them.",
    circShown: (n, h) => `${n} Teseo galaxies drawn: all on the ${h} line, as expected. They show how far the layer reaches; they measure nothing.`,
    whySummary: "Where do these points come from?",
    whyBody: "A type Ia supernova is the explosion of a white dwarf; they all reach nearly the same true brightness, so their apparent brightness tells how far they are. The speed comes from the redshift of the host galaxy. The 36 points are table 6 of Freedman and collaborators (2001), the final result of the Hubble telescope’s Key Project. Edwin Hubble published the first relation of this kind in 1929.",
    backTitle: "Looking far is looking back",
    backBody: (cmb) => `Light takes time to arrive: every point on the chart is an explosion that happened hundreds of millions of years ago. The farther we look, the younger the universe we see. The limit is the cosmic microwave background: light that left about ${cmb} years after the Big Bang. It is the last mark on the ruler in the Scale tab.`,
    accelTitle: "With and without dark energy",
    accelLead: "The gravity of matter should keep slowing the expansion. This model lets you choose how much dark energy there is and draws how the size of the universe changes over time.",
    olSlider: "Dark energy, Ω_Λ",
    olHint: "fraction of the total; the rest is matter",
    olValue: (ol, om) => `${ol}% dark energy, ${om}% matter`,
    planckBtn: "Planck values",
    noneBtn: "No dark energy",
    modelAge: "Age of the universe in this model",
    modelNow: "Today the expansion",
    accelerates: "is speeding up",
    decelerates: "is slowing down",
    coasting: "is neither speeding up nor slowing",
    aAria: (age, ageNo) => `Size of the universe against time. With your dark energy the universe is ${age} billion years old; with matter alone it would be ${ageNo}.`,
    aX: "Time relative to today (billion years)",
    aY: "Size (today = 1)",
    legYours: "Your model",
    legMatter: "Matter only",
    today: "today",
    modelFine: (h) => `Friedmann equation for a flat universe, integrated step by step: H(a) = H₀·√(Ω_m/a³ + Ω_Λ), with Ω_m = 1 − Ω_Λ and H₀ = ${h} (Planck). It leaves out radiation, which only matters in the first few hundred thousand years. Both curves share today’s expansion rate.`,
    planckAge: (a, e) => `With Planck’s values the model returns the published age: ${a} ± ${e} billion years.`,
    threadTitle: "The thread goes on",
    tension: {
      title: "The Hubble tension",
      teaser: "Two methods, two numbers, and nobody knows why.",
      p1: "There are two routes to H₀. One measures distances to nearby galaxies with Cepheids and supernovae. The other starts from the cosmic microwave background and works out what expansion rate there should be today under the standard model.",
      aria: (a, b, s) => `Planck gives ${a}; the distance ladder gives ${b}. They are ${s} sigma apart.`,
      planck: "Cosmic background (Planck 2018)",
      shoes: "Cepheids + supernovae (SH0ES 2022)",
      yours: "Your line",
      axis: "H₀ (km/s per Mpc)",
      sigma: (s) => `With independent errors, the gap is ${s} times the combined uncertainty. It is very unlikely to be chance.`,
      p2: "Either one of the two measurements has an error nobody has found, or the standard model is missing something. Today nobody knows which. This is what science looks like while it is alive.",
      tag: "measured",
      tagNote: "both values; the cause is unknown",
    },
    accel: {
      title: "1998: the expansion is speeding up",
      teaser: "Distant supernovae were fainter than expected.",
      p1: "Two teams measured type Ia supernovae so distant that their light had travelled for billions of years. They expected to see how much the expansion had slowed. They found the opposite: the supernovae were 10 to 15% farther than predicted. The expansion is accelerating.",
      p2: "Saul Perlmutter, Brian Schmidt and Adam Riess received the 2011 Nobel Prize in Physics for this discovery. Independent methods have confirmed it since, the cosmic microwave background among them.",
      tag: "measured",
    },
    dark: {
      title: "What dark energy is",
      teaser: "A name for something we do not understand.",
      p1: "“Dark energy” is the label for whatever causes the acceleration; it does not say what it is. The simplest idea is Einstein’s cosmological constant: an energy of empty space itself, the same everywhere and at all times. It fits the observations, but nobody can explain its value.",
      p2: "Other ideas: that it changes over time, or that gravity behaves differently on enormous scales. 2024 measurements from the DESI instrument hint that it may change over time; this is not confirmed.",
      p3: "According to Planck, it is 68.5% of everything in the universe.",
      tag: "unknown",
    },
    honest: "The line, the misfit and the age are computed on your phone from the published data; no AI takes part in the calculation.",
  },
};
