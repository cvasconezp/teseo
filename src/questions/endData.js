// endData.js — datos, fuentes y textos del recorrido «¿Cómo terminará el universo?».
// Fuentes consultadas el 16-nov-2026. Cifras copiadas de cada artículo (resumen o tabla):
//  · Egan y Lineweaver (2010), ApJ 710, 1825, tabla 1 (entropía actual del universo observable,
//    en unidades de k): agujeros negros supermasivos 3,1 × 10¹⁰⁴; estelares 5,9 × 10⁹⁷; fotones del
//    fondo cósmico 5,40 × 10⁸⁹; neutrinos reliquia 5,16 × 10⁸⁹; materia oscura ~2 × 10⁸⁸ (±1 en el
//    exponente); gravitones reliquia 6,2 × 10⁸⁷; gas interestelar e intergaláctico 7,1 × 10⁸¹;
//    estrellas 9,5 × 10⁸⁰. Horizonte de sucesos cósmico: 2,6 × 10¹²² (resumen).
//  · NASA, fichas planetarias: temperatura de cuerpo negro Tierra 254,0 K, Venus 226,6 K, Marte 209,8 K.
//  · IAU 2015 B3: temperatura efectiva nominal del Sol 5772 K.
//  · Fixsen (2009), ApJ 707, 916: fondo cósmico a 2,72548 ± 0,00057 K.
//  · Adams y Laughlin (1997), Rev. Mod. Phys. 69, 337: eras con η = log₁₀(t / años): estelífera
//    6 < η < 14, degenerada 15 < η < 37, de los agujeros negros 38 < η < 100, oscura η > 100.
//    Evaporación dinámica de las galaxias: η ≈ 19–20.
//  · Laughlin, Bodenheimer y Adams (1997), ApJ 482, 420: la estrella de masa mínima quema hidrógeno
//    durante unos diez billones (10¹³) de años.
//  · Sackmann, Boothroyd y Kraemer (1993), ApJ 418, 457: el Sol deja la secuencia principal dentro
//    de unos 5000 millones de años y se vuelve gigante roja.
//  · Sawala et al. (2025), Nature Astronomy: ~50 % de probabilidad de fusión Vía Láctea–Andrómeda
//    en los próximos 10 000 millones de años.
//  · Krauss y Scherrer (2007), Gen. Rel. Grav. 39, 1545: en ~10¹¹ años solo se verá el Grupo Local.
//  · Super-Kamiokande (Takenaka et al. 2020), PRD 102, 112011: vida parcial p → e⁺π⁰ > 2,4 × 10³⁴
//    años (90 % de confianza).
//  · EHT: Sgr A* ≈ 4 × 10⁶ M☉ (2022, ApJL 930, L12); M87* = 6,5 × 10⁹ M☉ (2019, ApJL 875, L6).
//  · Planck 2018 (A&A 641, A6): w₀ = −1,03 ± 0,03 con supernovas y BAO; edad 13,8 Ga.
//  · DESI DR2 (2025, arXiv:2503.14738): 3,1σ a favor de una energía oscura que cambia (DESI + CMB);
//    con supernovas, entre 2,8σ y 4,2σ. No llega al umbral de 5σ de un descubrimiento.
//  · Caldwell, Kamionkowski y Weinberg (2003), PRL 91, 071301: con w = −3/2, H₀ = 70 y Ω_m = 0,3 el
//    desgarro llega en unos 22 000 millones de años.
//  · Luu, Qiu y Tye (2025), JCAP: con su modelo de referencia, vida total ~33 000 millones de años,
//    tamaño máximo dentro de ~11 000 millones y colapso unos 20 000 millones de años después de hoy.
//  · Andreassen, Frost y Schwartz (2018), PRD 97, 056006: vida del vacío del Modelo Estándar
//    ~10¹⁶¹ años; con 95 % de confianza, más de 10⁶⁵.
import { evapYearsLog10 } from "./endPhysics.js";
import { K_B } from "./constants.js";

export const END_REFS = {
  egan2010: { cite: "Egan y Lineweaver (2010), ApJ 710, 1825: la entropía del universo observable", citeEn: "Egan & Lineweaver (2010), ApJ 710, 1825: the entropy of the observable universe", url: "https://arxiv.org/abs/0909.3983" },
  nasaEarth: { cite: "NASA, ficha de la Tierra (temperatura de cuerpo negro)", citeEn: "NASA, Earth fact sheet (black-body temperature)", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html" },
  iau2015: { cite: "IAU 2015, Resolución B3: valores nominales del Sol (5772 K)", citeEn: "IAU 2015 Resolution B3: nominal solar values (5772 K)", url: "https://arxiv.org/abs/1510.07674" },
  kleidon: { cite: "Kleidon (2020): la Tierra como sistema y la degradación de la energía del Sol", citeEn: "Kleidon (2020): the Earth as a whole system and the degradation of solar energy", url: "https://arxiv.org/abs/2005.09216" },
  nistK: { cite: "NIST: constante de Boltzmann (exacta desde 2019)", citeEn: "NIST: Boltzmann constant (exact since 2019)", url: "https://physics.nist.gov/cgi-bin/cuu/Value?k" },
  bekenstein1973: { cite: "Bekenstein (1973), Phys. Rev. D 7, 2333: la entropía de un agujero negro", citeEn: "Bekenstein (1973), Phys. Rev. D 7, 2333: black-hole entropy", url: "https://doi.org/10.1103/PhysRevD.7.2333" },
  hawking1975: { cite: "Hawking (1975), Commun. Math. Phys. 43, 199: los agujeros negros radian", citeEn: "Hawking (1975), Commun. Math. Phys. 43, 199: black holes radiate", url: "https://doi.org/10.1007/BF02345020" },
  fixsen2009: { cite: "Fixsen (2009), ApJ 707, 916: temperatura del fondo cósmico (2,7255 K)", citeEn: "Fixsen (2009), ApJ 707, 916: temperature of the cosmic background (2.7255 K)", url: "https://arxiv.org/abs/0911.1955" },
  ehtSgr: { cite: "Event Horizon Telescope (2022), ApJL 930, L12: Sagitario A*", citeEn: "Event Horizon Telescope (2022), ApJL 930, L12: Sagittarius A*", url: "https://doi.org/10.3847/2041-8213/ac6674" },
  ehtM87: { cite: "Event Horizon Telescope (2019), ApJL 875, L6: la masa de M87*", citeEn: "Event Horizon Telescope (2019), ApJL 875, L6: the mass of M87*", url: "https://doi.org/10.3847/2041-8213/ab1141" },
  adams1997: { cite: "Adams y Laughlin (1997), Rev. Mod. Phys. 69, 337: «Un universo que muere»", citeEn: "Adams & Laughlin (1997), Rev. Mod. Phys. 69, 337: “A dying universe”", url: "https://arxiv.org/abs/astro-ph/9701131" },
  laughlin1997: { cite: "Laughlin, Bodenheimer y Adams (1997), ApJ 482, 420: el final de la secuencia principal", citeEn: "Laughlin, Bodenheimer & Adams (1997), ApJ 482, 420: the end of the main sequence", url: "https://doi.org/10.1086/304125" },
  sackmann1993: { cite: "Sackmann, Boothroyd y Kraemer (1993), ApJ 418, 457: el futuro del Sol", citeEn: "Sackmann, Boothroyd & Kraemer (1993), ApJ 418, 457: the Sun’s future", url: "https://doi.org/10.1086/173407" },
  sawala2025: { cite: "Sawala et al. (2025), Nature Astronomy: no es seguro que choquemos con Andrómeda", citeEn: "Sawala et al. (2025), Nature Astronomy: no certainty of a Milky Way–Andromeda collision", url: "https://doi.org/10.1038/s41550-025-02563-1" },
  krauss2007: { cite: "Krauss y Scherrer (2007), Gen. Rel. Grav. 39, 1545: el fin de la cosmología", citeEn: "Krauss & Scherrer (2007), Gen. Rel. Grav. 39, 1545: the end of cosmology", url: "https://arxiv.org/abs/0704.0221" },
  superk2020: { cite: "Super-Kamiokande (2020), Phys. Rev. D 102, 112011: búsqueda de la desintegración del protón", citeEn: "Super-Kamiokande (2020), Phys. Rev. D 102, 112011: search for proton decay", url: "https://arxiv.org/abs/2010.16098" },
  planck2018: { cite: "Planck Collaboration (2020), A&A 641, A6: parámetros cosmológicos", citeEn: "Planck Collaboration (2020), A&A 641, A6: cosmological parameters", url: "https://arxiv.org/abs/1807.06209" },
  desi2025: { cite: "DESI (2025), segunda publicación de datos: indicios de una energía oscura que cambia", citeEn: "DESI (2025), Data Release 2: hints of evolving dark energy", url: "https://arxiv.org/abs/2503.14738" },
  caldwell2003: { cite: "Caldwell, Kamionkowski y Weinberg (2003), PRL 91, 071301: el Gran Desgarro", citeEn: "Caldwell, Kamionkowski & Weinberg (2003), PRL 91, 071301: the Big Rip", url: "https://arxiv.org/abs/astro-ph/0302506" },
  luu2025: { cite: "Luu, Qiu y Tye (2025), JCAP: «La duración de nuestro universo»", citeEn: "Luu, Qiu & Tye (2025), JCAP: “The lifespan of our universe”", url: "https://arxiv.org/abs/2506.24011" },
  andreassen2018: { cite: "Andreassen, Frost y Schwartz (2018), Phys. Rev. D 97, 056006: la vida del vacío", citeEn: "Andreassen, Frost & Schwartz (2018), Phys. Rev. D 97, 056006: the lifetime of the vacuum", url: "https://arxiv.org/abs/1707.08124" },
};

// ── Caja de gas ──
export const BOX_SLIDER = { min: 2, max: 40, step: 1, start: 10 };
export const MANY = 1000;
/** Moléculas en un litro de gas ideal a 0 °C y 1 atm: n = P / (k T) (sale de k, exacta). */
export const LITRE_MOLECULES = 101325 / (K_B * 273.15) / 1000;          // ≈ 2,69 × 10²²

// ── Fotones ──
export const T_SUN = 5772;
export const BODIES = [
  { id: "earth", t: 254.0 },
  { id: "venus", t: 226.6 },
  { id: "mars", t: 209.8 },
];

// ── Entropía del universo observable (Egan y Lineweaver 2010, tabla 1), log₁₀(S/k) ──
export const ENTROPY_BUDGET = [
  { id: "smbh", log: Math.log10(3.1e104), level: "estimated" },
  { id: "sbh", log: Math.log10(5.9e97), level: "estimated" },
  { id: "cmb", log: Math.log10(5.40e89), level: "measured" },
  { id: "nu", log: Math.log10(5.16e89), level: "estimated" },
  { id: "dm", log: Math.log10(2e88), level: "unknown" },
  { id: "gas", log: Math.log10(7.1e81), level: "estimated" },
  { id: "stars", log: Math.log10(9.5e80), level: "estimated" },
];
export const HORIZON_LOG = Math.log10(2.6e122);
export const STARS_LOG = Math.log10(9.5e80);
export const CMB_K = 2.7255;

// ── Agujeros negros: deslizador en log₁₀(M / M☉) ──
export const BH_SLIDER = { min: 0, max: 11, step: 0.05, start: 0 };
export const BH_PRESETS = [
  { id: "sun", log: 0 },
  { id: "sgr", log: Math.log10(4e6) },
  { id: "m87", log: Math.log10(6.5e9) },
  { id: "galaxy", log: 11 },
];

// ── Línea del tiempo (η = log₁₀ de años desde el Big Bang) ──
export const NOW_ETA = Math.log10(13.8e9);
export const ETA_SLIDER = { min: 10, max: 110, step: 0.1, start: NOW_ETA };
export const EVENTS = [
  { id: "now", eta: NOW_ETA, level: "measured", refs: ["planck2018"] },
  { id: "sun", eta: Math.log10(13.8e9 + 5e9), level: "estimated", refs: ["sackmann1993"] },
  { id: "andromeda", eta: Math.log10(13.8e9 + 10e9), level: "estimated", refs: ["sawala2025"] },
  { id: "island", eta: 11, level: "estimated", refs: ["krauss2007"] },
  { id: "dwarfs", eta: 13, level: "estimated", refs: ["laughlin1997"] },
  { id: "lastStars", eta: 14, level: "estimated", refs: ["adams1997"] },
  { id: "galaxies", eta: 19.5, level: "estimated", refs: ["adams1997"] },
  { id: "proton", eta: Math.log10(2.4e34), level: "unknown", refs: ["superk2020"] },
  { id: "remnants", eta: 38, level: "unknown", refs: ["adams1997"] },
  { id: "bhSun", eta: evapYearsLog10(1), level: "estimated", refs: ["hawking1975"] },
  { id: "bhSgr", eta: evapYearsLog10(4e6), level: "estimated", refs: ["hawking1975", "ehtSgr"] },
  { id: "bhBig", eta: evapYearsLog10(1e11), level: "estimated", refs: ["hawking1975", "adams1997"] },
];
export const ETA_PRESETS = [
  { id: "now", eta: ETA_SLIDER.start },
  { id: "stars", eta: 14 },
  { id: "bh", eta: 67.4 },
  { id: "dark", eta: 101 },
];

// ── Finales posibles ──
export const PLANCK = { H0: 67.4, Om: 0.315, w: -1.03, wErr: 0.03 };
export const W_SLIDER = { min: -1.6, max: -1, step: 0.01, start: -1 };
export const CRUNCH = { tPeak: 11, tEnd: 19.5, total: 33 };
export const VACUUM = { best: 161, low95: 65 };
export const SCENARIOS = ["freeze", "rip", "crunch", "vacuum"];

export const END_NEXT = [
  { url: "https://science.nasa.gov/dark-energy/", label: { es: "Energía oscura (NASA)", en: "Dark energy (NASA)" }, note: { es: "de ella depende el final", en: "the ending depends on it" } },
  { url: "https://www.desi.lbl.gov/", label: { es: "DESI", en: "DESI" }, note: { es: "el mapa que insinúa que la energía oscura cambia", en: "the map hinting that dark energy changes" } },
  { url: "https://www.esa.int/Science_Exploration/Space_Science/Euclid", label: { es: "Misión Euclid (ESA)", en: "Euclid mission (ESA)" }, note: { es: "medirá la energía oscura con más precisión", en: "will measure dark energy more precisely" } },
  { url: "https://www.hyperk.org/", label: { es: "Hyper-Kamiokande", en: "Hyper-Kamiokande" }, note: { es: "seguirá buscando protones que se desintegren", en: "will keep looking for decaying protons" } },
];

const ERAS_ES = {
  stelliferous: { name: "Era estelífera", body: "La era de las estrellas: casi toda la energía sale de la fusión nuclear. Es la nuestra." },
  degenerate: { name: "Era degenerada", body: "Ya no nacen estrellas. Quedan enanas blancas, enanas marrones y estrellas de neutrones que se enfrían a oscuras." },
  blackhole: { name: "Era de los agujeros negros", body: "Solo quedan agujeros negros, que se evaporan muy despacio por radiación de Hawking." },
  dark: { name: "Era oscura", body: "Ni estrellas ni agujeros negros: un gas cada vez más frío y diluido de fotones, electrones y neutrinos." },
};
const ERAS_EN = {
  stelliferous: { name: "Stelliferous Era", body: "The age of stars: almost all energy comes from nuclear fusion. It is ours." },
  degenerate: { name: "Degenerate Era", body: "No more stars are born. White dwarfs, brown dwarfs and neutron stars cool down in the dark." },
  blackhole: { name: "Black Hole Era", body: "Only black holes remain, evaporating very slowly through Hawking radiation." },
  dark: { name: "Dark Era", body: "No stars, no black holes: an ever colder, ever thinner gas of photons, electrons and neutrinos." },
};

export const END_T = {
  es: {
    title: "¿Cómo terminará el universo?",
    lead: "El final depende de una flecha que ya conoces: el café se enfría y no se vuelve a calentar solo. Esa flecha se llama entropía. Síguela con el dedo: de una caja de gas a la Tierra, a los agujeros negros y al último instante que podemos calcular.",
    // 1 · caja
    boxTitle: "1 · Por qué el tiempo va hacia adelante",
    boxLead: "Mete partículas en una caja y agítala. Cada una cae al azar a la izquierda o a la derecha. ¿Cuántas veces quedan todas del mismo lado, como si el gas se ordenara solo?",
    boxAria: (n, l, r) => `Caja con ${n} partículas: ${l} a la izquierda y ${r} a la derecha.`,
    boxSlider: "Partículas en la caja",
    boxValue: (n) => `${n}`,
    shakeOne: "Agitar",
    shakeMany: (k) => `Agitar ${k} veces`,
    boxNow: (l, r) => `Izquierda ${l} · derecha ${r}`,
    boxAll: "¡Todas del mismo lado!",
    boxOdds: "Probabilidad de que queden todas de un lado",
    boxOne: "1 en",
    boxRun: (hits, k, exp) => `En ${k} agitadas quedaron todas de un lado ${hits} ${hits === 1 ? "vez" : "veces"}; lo esperado era unas ${exp}.`,
    bigTitle: "¿Y con más partículas?",
    bigRows: { ten: "10 partículas", hundred: "100 partículas", litre: "Un litro de aire" },
    litreNote: (n) => `Un litro de aire tiene unas ${n} moléculas (gas ideal a 0 °C y 1 atmósfera, con la constante de Boltzmann).`,
    oddsHuge: (e) => `10 elevado a ${e}`,
    boxPoint: "Ninguna ley prohíbe que el aire de tu cuarto se junte en una esquina. Simplemente hay muchísimas más formas de estar repartido que de estar ordenado. Eso es la entropía: cuenta las formas. Y por eso el tiempo tiene dirección: el pasado era más ordenado que el presente.",
    whyBoxSummary: "¿De dónde sale «1 en 2 elevado a N − 1»?",
    whyBox: "Cada partícula tiene dos opciones, así que N partículas tienen 2 elevado a N combinaciones, todas igual de probables. Solo dos son «todas a un lado» (todas a la izquierda o todas a la derecha): 2 entre 2 elevado a N, es decir, 1 en 2 elevado a N − 1.",
    // 2 · fotones
    sunTitle: "2 · La Tierra exporta desorden",
    sunLead: "La Tierra devuelve al espacio casi la misma energía que recibe del Sol. Lo que cambia es la forma: entra como pocos fotones visibles y sale como muchos fotones infrarrojos.",
    bodies: { earth: "Tierra", venus: "Venus", mars: "Marte" },
    sunAria: (k, b) => `Por cada fotón que llega del Sol, ${b} devuelve unos ${k} fotones infrarrojos.`,
    sunIn: "1 fotón del Sol",
    sunOut: (k) => `≈ ${k} fotones infrarrojos`,
    sunCalc: (ts, tb, k) => `Sol: ${ts} K · planeta: ${tb} K (temperatura de cuerpo negro) · ${ts} ÷ ${tb} ≈ ${k}`,
    sunPoint: "Muchos fotones fríos tienen mucha más entropía que pocos calientes. Las plantas, el clima y tú vivís de esa diferencia: no de la energía del Sol, que se devuelve casi entera, sino de su orden.",
    whySunSummary: "¿Por qué el número de fotones va con la temperatura?",
    whySun: "La energía media de un fotón de cuerpo negro es proporcional a su temperatura. Si sale tanta energía como entra, pero a una temperatura 22 veces menor, tienen que salir unas 22 veces más fotones. Es una aproximación: la Tierra no es un cuerpo negro perfecto y la luz del Sol llega diluida.",
    // 3 · agujeros negros
    bhTitle: "3 · ¿Dónde está el desorden del universo?",
    bhLead: "Casi toda la entropía del universo observable no está en las estrellas ni en el gas: está en los agujeros negros. Mueve la masa y compara.",
    ledgerTitle: "Entropía del universo observable (exponente de 10, en unidades de k)",
    ledgerAria: "Barras con el exponente de la entropía de cada componente del universo observable: agujeros negros supermasivos, 104; agujeros negros estelares, 98; fotones del fondo cósmico, 90; neutrinos, 90; materia oscura, 88; gas, 82; estrellas, 81.",
    ledger: { smbh: "Agujeros negros supermasivos", sbh: "Agujeros negros estelares", cmb: "Fotones del fondo cósmico", nu: "Neutrinos reliquia", dm: "Materia oscura (muy incierto)", gas: "Gas y polvo", stars: "Todas las estrellas" },
    ledgerNote: (h) => `El límite: el horizonte cósmico podría guardar hasta 10 elevado a ${h}. Queda muchísimo por desordenar.`,
    bhSlider: "Masa del agujero negro",
    bhValue: (m, one) => (one ? "1 masa solar" : `${m} masas solares`),
    bhPresets: { sun: "1 masa solar", sgr: "Sagitario A*", m87: "M87*", galaxy: "Una galaxia entera" },
    bhEntropy: "Su entropía",
    bhVsStars: "Más que todas las estrellas del universo observable juntas.",
    bhVsStarsNo: (m) => `Todavía menos que todas las estrellas juntas. A partir de unas ${m} masas solares, un solo agujero negro las supera.`,
    bhTemp: (t) => `Temperatura de Hawking: ${t} K.`,
    bhEvap: (y) => `Tardaría ${y} en evaporarse.`,
    bhCold: (cmb) => `Hoy el fondo cósmico está a ${cmb} K, más caliente que el agujero negro: por ahora absorbe más de lo que radia y crece. Solo empezará a evaporarse cuando el universo se enfríe por debajo de su temperatura.`,
    bhWarm: (cmb) => `Está más caliente que el fondo cósmico (${cmb} K): ya podría estar evaporándose.`,
    whyBhSummary: "¿De dónde salen estas cifras?",
    whyBh: "La entropía de un agujero negro es proporcional al área de su horizonte (Bekenstein): crece con el cuadrado de la masa. Hawking mostró que radia como un cuerpo negro con una temperatura inversa a la masa, y que se evapora en un tiempo proporcional al cubo de la masa. Aquí no se considera la rotación ni la carga, y la evaporación cuenta solo fotones.",
    // 4 · línea del tiempo
    timeTitle: "4 · El futuro, era por era",
    timeLead: "Mueve el deslizador hacia el futuro. Cada paso multiplica el tiempo por diez: el final del deslizador no es diez veces más lejos que hoy, sino 10 elevado a 100 veces.",
    etaSlider: "Años desde el Big Bang",
    nowYears: "13.800 millones de años",
    etaPresets: { now: "Hoy", stars: "Últimas estrellas", bh: "Agujeros negros", dark: "Era oscura" },
    timeAria: (y, era) => `Línea del tiempo en escala logarítmica. Marcador en ${y}, ${era}.`,
    pastShare: (p) => `Todo lo que ha pasado hasta hoy es ${p} de ese tiempo.`,
    passed: "Ya pasó",
    next: "Lo siguiente",
    nothingNext: "Nada más que calcular: solo un universo cada vez más frío y vacío.",
    eras: ERAS_ES,
    events: {
      now: "Hoy: 13.800 millones de años. Todavía nacen estrellas.",
      sun: "El Sol agota el hidrógeno de su núcleo y se hincha como gigante roja.",
      andromeda: "La Vía Láctea y Andrómeda: un 50 % de probabilidad de haberse fusionado para entonces.",
      island: "Solo se ven las galaxias del Grupo Local. Las demás cruzaron el horizonte (si la energía oscura no cambia).",
      dwarfs: "Las estrellas más pequeñas terminan de quemar su hidrógeno.",
      lastStars: "Se apagan las últimas estrellas. Empieza la era degenerada.",
      galaxies: "Las galaxias se deshacen: los encuentros lanzan los restos de estrellas al vacío; el resto cae al agujero negro central.",
      proton: "Si el protón se desintegra, tarda al menos esto: Super-Kamiokande nunca ha visto uno (límite: 2,4 × 10³⁴ años).",
      remnants: "Si los protones se desintegran, desaparecen las enanas blancas y las estrellas de neutrones. Quedan los agujeros negros.",
      bhSun: "Se evapora un agujero negro de una masa solar.",
      bhSgr: "Se evapora Sagitario A*, el agujero negro del centro de la Vía Láctea.",
      bhBig: "Se evaporan los agujeros negros más grandes posibles. Empieza la era oscura.",
    },
    // 5 · finales
    endTitle: "5 · ¿Cómo termina? Depende de la energía oscura",
    endLead: "La energía oscura acelera la expansión. Si es constante, el universo se enfría para siempre. Si cambia, puede desgarrarse o volver a colapsar. Elige un final.",
    scen: {
      freeze: { name: "Congelación lenta", short: "Se expande para siempre" },
      rip: { name: "Gran Desgarro", short: "La expansión lo rompe todo" },
      crunch: { name: "Gran Colapso", short: "Se frena y vuelve a caer" },
      vacuum: { name: "Cambio de vacío", short: "Una burbuja lo transforma todo" },
    },
    plotX: "Miles de millones de años desde hoy",
    plotY: "Tamaño del universo (hoy = 1)",
    plotAria: (s) => `Tamaño del universo frente al tiempo. Escenario: ${s}.`,
    legStd: "Energía oscura constante",
    legScen: "El escenario elegido",
    legSketch: "Esquema con las fechas publicadas",
    today: "hoy",
    freezeText: "Es el final del modelo estándar, con la energía oscura constante. Las galaxias lejanas se alejan cada vez más deprisa, las estrellas se apagan, los agujeros negros se evaporan y todo se enfría hacia el cero absoluto sin llegar nunca. A esto se le llama también muerte térmica: la entropía alcanza su máximo y ya no puede pasar nada nuevo.",
    wSlider: "Parámetro w de la energía oscura",
    wHint: "−1 = constante; menos de −1 = «fantasma»",
    wValue: (w) => `w = ${w}`,
    ripNever: "Con w = −1 no hay desgarro: es la congelación lenta.",
    ripIn: (g) => `Desgarro dentro de unos ${g} mil millones de años.`,
    ripText: (w, e) => `Si la energía oscura crece con la expansión (w menor que −1), al final separa galaxias, estrellas, planetas y hasta los átomos. Las mediciones no lo favorecen: Planck con supernovas da w = ${w} ± ${e}, y DESI apunta más bien a una energía oscura que se debilita.`,
    ripCheck: (g) => `Comprobación: con w = −1,5, H₀ = 70 y Ω_m = 0,3, el artículo original da unos 22 000 millones de años; la cuenta de Teseo da ${g} mil millones.`,
    crunchText: (p, e, tot) => `Si la energía oscura se debilita y el fondo es una constante cosmológica negativa, la expansión se frena, se invierte y todo vuelve a caer. Con el modelo de referencia de Luu, Qiu y Tye (2025), el universo llegaría a su tamaño máximo dentro de unos ${p} mil millones de años y colapsaría unos ${e} mil millones de años después de hoy: una vida total de unos ${tot} mil millones de años. La curva es un esquema con esas fechas, no una reproducción del modelo.`,
    crunchHint: "La pista viene de DESI: 3,1σ a favor de una energía oscura que cambia, y hasta 4,2σ con supernovas. Un descubrimiento exige 5σ.",
    vacuumText: (b, l) => `Con las masas medidas del bosón de Higgs y del quark top, nuestro vacío parece no ser el más estable posible. Podría formarse una burbuja de otro vacío que crece a casi la velocidad de la luz. El cálculo más completo da una vida de 10 elevado a ${b} años; con un 95 % de confianza, más de 10 elevado a ${l}. Mucho después de que se apague la última estrella.`,
    vacuumNoPlot: "No hay curva que dibujar: no cambia la expansión, cambia la física.",
    // cierre
    threadTitle: "Lo que sabemos y lo que no",
    known: {
      title: "Medido: el universo se acelera y la entropía crece",
      teaser: "La expansión acelerada y la segunda ley están firmes.",
      p1: "Que la expansión se acelera está medido con supernovas, el fondo cósmico y el mapa de galaxias. Que la entropía total crece es la segunda ley de la termodinámica: no se ha visto nunca que falle a escala macroscópica.",
    },
    unknown: {
      title: "Desconocido: qué es la energía oscura",
      teaser: "De ella depende el final, y no sabemos qué es.",
      p1: "Si es una constante, el futuro es una congelación lenta. Si cambia, puede haber desgarro o colapso. DESI, Euclid y Roman la están midiendo con más precisión que nunca.",
      p2: "Tampoco sabemos si el protón se desintegra: si no lo hace, las enanas blancas frías durarían muchísimo más que en la línea del tiempo.",
    },
    honest: "Las fechas lejanas suponen que la física que conocemos sigue valiendo durante 10 elevado a 100 años. Es la mejor apuesta que tenemos, no una certeza.",
    linksTitle: "Sigue el hilo",
    linkExp: "¿El universo se expande?",
    linkBh: "¿Qué pasa cerca de un agujero negro?",
  },
  en: {
    title: "How will the universe end?",
    lead: "The ending depends on an arrow you already know: coffee cools down and never heats up again on its own. That arrow is called entropy. Follow it with your finger: from a box of gas to the Earth, to black holes and to the last moment we can calculate.",
    boxTitle: "1 · Why time moves forward",
    boxLead: "Put particles in a box and shake it. Each one lands at random on the left or the right. How often do they all end up on the same side, as if the gas tidied itself up?",
    boxAria: (n, l, r) => `Box with ${n} particles: ${l} on the left and ${r} on the right.`,
    boxSlider: "Particles in the box",
    boxValue: (n) => `${n}`,
    shakeOne: "Shake",
    shakeMany: (k) => `Shake ${k} times`,
    boxNow: (l, r) => `Left ${l} · right ${r}`,
    boxAll: "All on one side!",
    boxOdds: "Chance that they all end up on one side",
    boxOne: "1 in",
    boxRun: (hits, k, exp) => `In ${k} shakes they all ended up on one side ${hits} ${hits === 1 ? "time" : "times"}; about ${exp} were expected.`,
    bigTitle: "And with more particles?",
    bigRows: { ten: "10 particles", hundred: "100 particles", litre: "One litre of air" },
    litreNote: (n) => `One litre of air holds about ${n} molecules (ideal gas at 0 °C and 1 atmosphere, from the Boltzmann constant).`,
    oddsHuge: (e) => `10 to the power ${e}`,
    boxPoint: "No law forbids the air in your room from gathering in one corner. There are simply vastly more ways to be spread out than to be tidy. That is entropy: it counts the ways. And that is why time has a direction: the past was more ordered than the present.",
    whyBoxSummary: "Where does “1 in 2 to the N − 1” come from?",
    whyBox: "Each particle has two options, so N particles have 2 to the N combinations, all equally likely. Only two are “all on one side” (all left or all right): 2 out of 2 to the N, that is, 1 in 2 to the N − 1.",
    sunTitle: "2 · The Earth exports disorder",
    sunLead: "The Earth sends back to space almost the same energy it receives from the Sun. What changes is the form: it comes in as a few visible photons and leaves as many infrared ones.",
    bodies: { earth: "Earth", venus: "Venus", mars: "Mars" },
    sunAria: (k, b) => `For each photon arriving from the Sun, ${b} sends back about ${k} infrared photons.`,
    sunIn: "1 photon from the Sun",
    sunOut: (k) => `≈ ${k} infrared photons`,
    sunCalc: (ts, tb, k) => `Sun: ${ts} K · planet: ${tb} K (black-body temperature) · ${ts} ÷ ${tb} ≈ ${k}`,
    sunPoint: "Many cold photons carry far more entropy than a few hot ones. Plants, the weather and you live off that difference: not off the Sun’s energy, which is returned almost entirely, but off its order.",
    whySunSummary: "Why does the number of photons follow the temperature?",
    whySun: "The mean energy of a black-body photon is proportional to its temperature. If as much energy leaves as comes in, but at a temperature 22 times lower, about 22 times more photons must leave. It is an approximation: the Earth is not a perfect black body and sunlight arrives diluted.",
    bhTitle: "3 · Where is the universe’s disorder?",
    bhLead: "Almost all the entropy of the observable universe is not in stars or gas: it is in black holes. Move the mass and compare.",
    ledgerTitle: "Entropy of the observable universe (power of 10, in units of k)",
    ledgerAria: "Bars with the power of ten of the entropy of each component of the observable universe: supermassive black holes, 104; stellar black holes, 98; cosmic background photons, 90; neutrinos, 90; dark matter, 88; gas, 82; stars, 81.",
    ledger: { smbh: "Supermassive black holes", sbh: "Stellar black holes", cmb: "Cosmic background photons", nu: "Relic neutrinos", dm: "Dark matter (very uncertain)", gas: "Gas and dust", stars: "All the stars" },
    ledgerNote: (h) => `The limit: the cosmic horizon could hold up to 10 to the power ${h}. There is a lot of disorder still to come.`,
    bhSlider: "Black-hole mass",
    bhValue: (m, one) => (one ? "1 solar mass" : `${m} solar masses`),
    bhPresets: { sun: "1 solar mass", sgr: "Sagittarius A*", m87: "M87*", galaxy: "A whole galaxy" },
    bhEntropy: "Its entropy",
    bhVsStars: "More than all the stars in the observable universe combined.",
    bhVsStarsNo: (m) => `Still less than all the stars combined. From about ${m} solar masses, a single black hole beats them.`,
    bhTemp: (t) => `Hawking temperature: ${t} K.`,
    bhEvap: (y) => `It would take ${y} to evaporate.`,
    bhCold: (cmb) => `Today the cosmic background is at ${cmb} K, hotter than the black hole: for now it absorbs more than it radiates and grows. It will only start to evaporate once the universe cools below its temperature.`,
    bhWarm: (cmb) => `It is hotter than the cosmic background (${cmb} K): it could already be evaporating.`,
    whyBhSummary: "Where do these figures come from?",
    whyBh: "A black hole’s entropy is proportional to the area of its horizon (Bekenstein): it grows with the square of the mass. Hawking showed that it radiates like a black body with a temperature inversely proportional to its mass, and evaporates in a time proportional to the cube of the mass. Rotation and charge are ignored here, and evaporation counts photons only.",
    timeTitle: "4 · The future, era by era",
    timeLead: "Move the slider into the future. Each step multiplies time by ten: the end of the slider is not ten times further than today, but 10 to the power 100 times.",
    etaSlider: "Years since the Big Bang",
    nowYears: "13.8 billion years",
    etaPresets: { now: "Today", stars: "Last stars", bh: "Black holes", dark: "Dark Era" },
    timeAria: (y, era) => `Timeline on a logarithmic scale. Marker at ${y}, ${era}.`,
    pastShare: (p) => `Everything that has happened until today is ${p} of that time.`,
    passed: "Already happened",
    next: "Next",
    nothingNext: "Nothing left to calculate: only an ever colder, emptier universe.",
    eras: ERAS_EN,
    events: {
      now: "Today: 13.8 billion years. Stars are still being born.",
      sun: "The Sun runs out of hydrogen in its core and swells into a red giant.",
      andromeda: "The Milky Way and Andromeda: a 50% chance of having merged by then.",
      island: "Only the Local Group galaxies remain visible. All others have crossed the horizon (if dark energy does not change).",
      dwarfs: "The smallest stars finish burning their hydrogen.",
      lastStars: "The last stars go out. The Degenerate Era begins.",
      galaxies: "Galaxies fall apart: encounters fling stellar remnants into the void; the rest falls into the central black hole.",
      proton: "If the proton decays, it takes at least this long: Super-Kamiokande has never seen one (limit: 2.4 × 10³⁴ years).",
      remnants: "If protons decay, white dwarfs and neutron stars disappear. Black holes remain.",
      bhSun: "A one-solar-mass black hole evaporates.",
      bhSgr: "Sagittarius A*, the black hole at the centre of the Milky Way, evaporates.",
      bhBig: "The largest possible black holes evaporate. The Dark Era begins.",
    },
    endTitle: "5 · How does it end? It depends on dark energy",
    endLead: "Dark energy speeds up the expansion. If it is constant, the universe cools forever. If it changes, it may tear apart or collapse again. Pick an ending.",
    scen: {
      freeze: { name: "Slow freeze", short: "Expands forever" },
      rip: { name: "Big Rip", short: "Expansion tears everything apart" },
      crunch: { name: "Big Crunch", short: "Slows down and falls back" },
      vacuum: { name: "Vacuum decay", short: "A bubble transforms everything" },
    },
    plotX: "Billions of years from today",
    plotY: "Size of the universe (today = 1)",
    plotAria: (s) => `Size of the universe versus time. Scenario: ${s}.`,
    legStd: "Constant dark energy",
    legScen: "The chosen scenario",
    legSketch: "Sketch with the published dates",
    today: "today",
    freezeText: "It is the ending of the standard model, with constant dark energy. Distant galaxies recede ever faster, stars go out, black holes evaporate and everything cools towards absolute zero without ever reaching it. It is also called heat death: entropy reaches its maximum and nothing new can happen.",
    wSlider: "Dark-energy parameter w",
    wHint: "−1 = constant; below −1 = “phantom”",
    wValue: (w) => `w = ${w}`,
    ripNever: "With w = −1 there is no rip: it is the slow freeze.",
    ripIn: (g) => `Rip in about ${g} billion years.`,
    ripText: (w, e) => `If dark energy grows as space expands (w below −1), it eventually pulls apart galaxies, stars, planets and even atoms. Measurements do not favour it: Planck with supernovae gives w = ${w} ± ${e}, and DESI points rather to a weakening dark energy.`,
    ripCheck: (g) => `Check: with w = −1.5, H₀ = 70 and Ω_m = 0.3 the original paper gives about 22 billion years; Teseo’s calculation gives ${g} billion.`,
    crunchText: (p, e, tot) => `If dark energy weakens and the background is a negative cosmological constant, the expansion slows, reverses and everything falls back. With the benchmark model of Luu, Qiu and Tye (2025), the universe would reach its largest size in about ${p} billion years and collapse about ${e} billion years from today: a total life of about ${tot} billion years. The curve is a sketch with those dates, not a reproduction of the model.`,
    crunchHint: "The hint comes from DESI: 3.1σ in favour of a changing dark energy, and up to 4.2σ with supernovae. A discovery needs 5σ.",
    vacuumText: (b, l) => `With the measured masses of the Higgs boson and the top quark, our vacuum seems not to be the most stable one possible. A bubble of a different vacuum could form and grow at nearly the speed of light. The most complete calculation gives a lifetime of 10 to the power ${b} years; with 95% confidence, more than 10 to the power ${l}. Long after the last star goes out.`,
    vacuumNoPlot: "There is no curve to draw: the expansion does not change, physics does.",
    threadTitle: "What we know and what we don’t",
    known: {
      title: "Measured: the universe accelerates and entropy grows",
      teaser: "The accelerating expansion and the second law stand firm.",
      p1: "That the expansion accelerates is measured with supernovae, the cosmic background and galaxy maps. That total entropy grows is the second law of thermodynamics: it has never been seen to fail on macroscopic scales.",
    },
    unknown: {
      title: "Unknown: what dark energy is",
      teaser: "The ending depends on it, and we do not know what it is.",
      p1: "If it is a constant, the future is a slow freeze. If it changes, a rip or a crunch are possible. DESI, Euclid and Roman are measuring it more precisely than ever.",
      p2: "Nor do we know whether the proton decays: if it does not, cold white dwarfs would last far longer than the timeline shows.",
    },
    honest: "The far-off dates assume that the physics we know keeps holding for 10 to the power 100 years. It is our best bet, not a certainty.",
    linksTitle: "Follow the thread",
    linkExp: "Is the universe expanding?",
    linkBh: "What happens near a black hole?",
  },
};
