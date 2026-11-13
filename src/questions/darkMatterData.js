// darkMatterData.js — datos, fuentes y textos del recorrido "¿De qué está
// hecho el universo?". Referencias consultadas el 13-nov-2026.
//
// DECISIÓN SOBRE LA CURVA DE ROTACIÓN: DATOS REALES, NO ILUSTRATIVOS
// Los 43 puntos son la curva de rotación de NGC 3198 tal como está tabulada en
// la base SPARC (Lelli, McGaugh & Schombert 2016, AJ 152, 157), archivo
// «MassModels_Lelli2016c.mrt» de https://astroweb.cwru.edu/SPARC/ :
//   R (kpc) · V_obs (km/s) · error de V_obs (km/s) · V_gas (km/s) · V_disco (km/s)
// SPARC combina medidas de radio (hidrógeno, Begeman 1987) y ópticas (Hα,
// Daigle et al. 2006). V_gas y V_disco son lo que cada componente VISIBLE
// aportaría a la velocidad, calculado por SPARC a partir del gas observado y
// de la luz infrarroja (3,6 µm) de las estrellas; V_disco está dada para una
// razón masa/luz Υ = 1 y V_gas ya incluye el helio (×1,33). NGC 3198 no tiene
// bulbo (V_bul = 0 en toda la tabla). Tabla 1 de SPARC para esta galaxia:
//   D = 13,80 ± 1,40 Mpc (cefeidas) · L[3,6] = 38,279 × 10⁹ L☉ ·
//   M_HI = 10,869 × 10⁹ M☉ · V_plana = 150,1 ± 3,9 km/s · calidad 1 (alta).
//
// MODELO (simplificado, y dicho en la interfaz)
//   visible:  V_vis² = V_gas·|V_gas| + Υ·V_disco²,  Υ = 0,5 M☉/L☉ (valor que
//             adopta SPARC a 3,6 µm; es una estimación)
//   halo:     pseudoisotermo, ρ(r) = ρ0 / (1 + (r/rc)²), esférico
//   total:    V² = V_vis² + V_halo²
// El deslizador fija la masa del halo dentro del último punto medido (44,08 kpc).
// El radio del núcleo rc = 2,7 kpc lo eligió Teseo ajustando estos mismos datos
// (mínimo de χ² en una malla de rc y masa); con él, el mejor ajuste es
// 1,9 × 10¹¹ M☉, χ² reducido ≈ 1,2, desajuste medio ≈ 5 km/s. Sin halo: 56 km/s.
//
// PRESUPUESTO (Planck 2018, A&A 641, A6, tabla 2, TT,TE,EE+lowE+lensing)
//   Ω_b·h² = 0,02237 ± 0,00015 · Ω_c·h² = 0,1200 ± 0,0012 · H0 = 67,36 ± 0,54
//   Ω_Λ = 0,6847 ± 0,0073 · Ω_m = 0,3153 ± 0,0073
//   → ordinaria 4,9 % · materia oscura 26,4 % · energía oscura 68,5 %
//     (el ~0,2 % restante: sobre todo neutrinos).
//
// PLANETAS: NASA Planetary Fact Sheet (distancia media al Sol en 10⁶ km y
// velocidad orbital media en km/s).

export const DM_REFS = {
  sparc: { cite: "Lelli, McGaugh y Schombert (2016), AJ 152, 157: base de datos SPARC", citeEn: "Lelli, McGaugh & Schombert (2016), AJ 152, 157: the SPARC database", url: "https://arxiv.org/abs/1606.09251" },
  sparcData: { cite: "SPARC: tablas de datos (Case Western Reserve University)", citeEn: "SPARC: data tables (Case Western Reserve University)", url: "https://astroweb.cwru.edu/SPARC/" },
  rubin1970: { cite: "Rubin y Ford (1970), ApJ 159, 379: rotación de la galaxia de Andrómeda", citeEn: "Rubin & Ford (1970), ApJ 159, 379: rotation of the Andromeda galaxy", url: "https://ui.adsabs.harvard.edu/abs/1970ApJ...159..379R/abstract" },
  nasaFacts: { cite: "NASA, Planetary Fact Sheet", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/" },
  planck2018: { cite: "Planck Collaboration (2020), A&A 641, A6: parámetros cosmológicos de Planck 2018", citeEn: "Planck Collaboration (2020), A&A 641, A6: Planck 2018 cosmological parameters", url: "https://arxiv.org/abs/1807.06209" },
  clowe2006: { cite: "Clowe et al. (2006), ApJ 648, L109: el cúmulo Bala", citeEn: "Clowe et al. (2006), ApJ 648, L109: the Bullet Cluster", url: "https://arxiv.org/abs/astro-ph/0608407" },
  chandraBullet: { cite: "Chandra (NASA): imágenes del cúmulo Bala, 1E 0657-56", citeEn: "Chandra (NASA): images of the Bullet Cluster, 1E 0657-56", url: "https://chandra.harvard.edu/photo/2006/1e0657/" },
  nasaDM: { cite: "NASA Science, «Dark Matter»", citeEn: "NASA Science, “Dark Matter”", url: "https://science.nasa.gov/dark-matter/" },
  lz2023: { cite: "LUX-ZEPLIN (2023), PRL 131, 041002: primera búsqueda, sin señal", citeEn: "LUX-ZEPLIN (2023), PRL 131, 041002: first search, no signal", url: "https://arxiv.org/abs/2207.03764" },
  milgrom1983: { cite: "Milgrom (1983), ApJ 270, 365: la propuesta de la dinámica modificada (MOND)", citeEn: "Milgrom (1983), ApJ 270, 365: the proposal of modified dynamics (MOND)", url: "https://ui.adsabs.harvard.edu/abs/1983ApJ...270..365M/abstract" },
  mcgaugh2016: { cite: "McGaugh, Lelli y Schombert (2016), PRL 117, 201101: relación de aceleración radial", citeEn: "McGaugh, Lelli & Schombert (2016), PRL 117, 201101: the radial acceleration relation", url: "https://arxiv.org/abs/1609.05917" },
};

// [R kpc, V_obs km/s, error km/s, V_gas km/s, V_disco km/s (Υ = 1)] — SPARC, NGC 3198
export const NGC3198 = [
  [0.32, 24.40, 35.90, 0.00, 63.28],
  [0.64, 43.30, 16.30, 0.00, 73.66],
  [0.96, 45.50, 16.10, 0.00, 78.98],
  [1.28, 58.50, 15.40, 0.35, 82.70],
  [1.61, 68.80, 7.61, 0.15, 84.22],
  [1.93, 76.90, 10.30, -0.05, 83.17],
  [2.24, 82.00, 8.09, -0.47, 87.04],
  [2.57, 86.90, 7.60, -0.95, 88.91],
  [2.89, 97.60, 3.03, -1.43, 88.98],
  [3.21, 100.00, 5.31, -1.14, 93.81],
  [3.54, 107.00, 7.51, -0.39, 101.22],
  [3.85, 113.00, 7.32, 0.36, 108.53],
  [4.17, 117.00, 5.21, 1.52, 115.51],
  [4.50, 119.00, 5.67, 3.07, 120.51],
  [4.82, 127.00, 5.39, 4.63, 125.42],
  [5.15, 132.00, 4.34, 6.02, 129.40],
  [5.46, 134.00, 2.36, 7.16, 133.15],
  [5.78, 137.00, 0.89, 8.31, 136.45],
  [6.10, 140.00, 2.84, 9.46, 139.41],
  [6.43, 142.00, 0.88, 10.61, 141.85],
  [6.74, 144.00, 1.23, 11.77, 142.32],
  [7.06, 146.00, 1.57, 12.87, 140.94],
  [8.04, 147.00, 3.00, 16.39, 135.68],
  [9.04, 148.00, 3.00, 20.03, 130.79],
  [10.04, 152.00, 2.00, 23.68, 128.10],
  [11.04, 155.00, 2.00, 27.08, 126.67],
  [12.05, 156.00, 2.00, 30.11, 124.98],
  [14.05, 157.00, 2.00, 34.48, 118.12],
  [16.07, 153.00, 2.00, 36.43, 108.22],
  [18.13, 153.00, 2.00, 37.76, 101.10],
  [20.05, 154.00, 2.00, 39.83, 96.40],
  [22.12, 153.00, 2.00, 40.92, 91.56],
  [24.03, 150.00, 2.00, 41.77, 87.03],
  [26.10, 149.00, 2.00, 43.71, 82.67],
  [28.16, 148.00, 2.00, 45.41, 79.06],
  [30.08, 146.00, 2.00, 45.29, 76.07],
  [32.14, 147.00, 2.00, 44.56, 73.27],
  [34.06, 148.00, 2.00, 44.81, 70.91],
  [36.12, 148.00, 2.00, 45.90, 68.62],
  [38.19, 149.00, 2.00, 46.75, 66.59],
  [40.10, 150.00, 2.00, 47.48, 64.84],
  [42.17, 150.00, 3.00, 48.93, 63.10],
  [44.08, 149.00, 3.00, 47.84, 61.63],
].map(([r, v, e, vgas, vdisk]) => ({ r, v, e, vgas, vdisk }));

export const GALAXY = {
  name: "NGC 3198",
  distanceMpc: 13.8, distanceErr: 1.4,
  luminosity36: 38.279e9,      // L☉ a 3,6 µm
  massHI: 10.869e9,            // M☉ de hidrógeno atómico
  heliumFactor: 1.33,          // SPARC: gas total = 1,33 × M_HI
  vFlat: 150.1, vFlatErr: 3.9,
};
export const UPSILON = 0.5;                                   // M☉/L☉ a 3,6 µm
export const HALO = { rc: 2.7, rRef: 44.08, min: 0, max: 4e11, step: 1e10 };
// Masa visible total de la galaxia: estrellas (Υ·L) + gas (1,33·M_HI)
export const VISIBLE_MASS = UPSILON * GALAXY.luminosity36 + GALAXY.heliumFactor * GALAXY.massHI;

// [id, distancia media al Sol (10⁶ km), velocidad orbital media (km/s)] — NASA
export const PLANETS = [
  ["mercury", 57.9, 47.4], ["venus", 108.2, 35.0], ["earth", 149.6, 29.8], ["mars", 228.0, 24.1],
  ["jupiter", 778.5, 13.1], ["saturn", 1432.0, 9.7], ["uranus", 2867.0, 6.8], ["neptune", 4515.0, 5.4],
].map(([id, d, v]) => ({ id, d, v }));
export const PLANET_NAMES = {
  es: { mercury: "Mercurio", venus: "Venus", earth: "Tierra", mars: "Marte", jupiter: "Júpiter", saturn: "Saturno", uranus: "Urano", neptune: "Neptuno" },
  en: { mercury: "Mercury", venus: "Venus", earth: "Earth", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune" },
};

// Planck 2018
export const PLANCK_DENSITIES = { ombh2: 0.02237, omch2: 0.1200, H0: 67.36, OL: 0.6847 };
export function budget(p = PLANCK_DENSITIES) {
  const h2 = (p.H0 / 100) ** 2;
  const ordinary = p.ombh2 / h2, dark = p.omch2 / h2, energy = p.OL;
  return { ordinary, dark, energy, rest: 1 - ordinary - dark - energy };
}

export const DM_NEXT = [
  { url: "https://science.nasa.gov/dark-matter/", label: { es: "Materia oscura (NASA)", en: "Dark matter (NASA)" }, note: { es: "las pruebas, explicadas con imágenes", en: "the evidence, explained with images" } },
  { url: "https://www.esa.int/Science_Exploration/Space_Science/Euclid", label: { es: "Misión Euclid (ESA)", en: "Euclid mission (ESA)" }, note: { es: "cartografía la materia oscura con lentes gravitacionales", en: "maps dark matter through gravitational lensing" } },
  { url: "https://rubinobservatory.org/", label: { es: "Observatorio Vera C. Rubin", en: "Vera C. Rubin Observatory" }, note: { es: "en Chile; lleva el nombre de quien midió las curvas de rotación", en: "in Chile; named after the astronomer who measured rotation curves" } },
  { url: "https://astroweb.cwru.edu/SPARC/", label: { es: "SPARC: los datos de 175 galaxias", en: "SPARC: data for 175 galaxies" }, note: { es: "la tabla de donde salen los puntos de este gráfico", en: "the table behind the points on this chart" } },
  { url: "https://www.zooniverse.org/projects/zookeeper/galaxy-zoo", label: { es: "Galaxy Zoo (Zooniverse)", en: "Galaxy Zoo (Zooniverse)" }, note: { es: "ciencia ciudadana: clasifica galaxias reales", en: "citizen science: classify real galaxies" } },
];

export const DM_T = {
  es: {
    title: "¿De qué está hecho el universo?",
    lead: "Lo que vemos, estrellas y gas, no pesa lo suficiente para explicar cómo giran las galaxias. Aquí está la medida real de una. Añade masa invisible hasta que la cuenta cuadre.",
    chartTitle: (g) => `Curva de rotación de ${g}`,
    chartAria: (g, far, vis) => `Curva de rotación de ${g}. Las velocidades medidas se mantienen cerca de ${far} kilómetros por segundo hasta el borde; la materia visible sola predice ${vis} en el último punto.`,
    xLabel: "Distancia al centro (kilopársecs)",
    yLabel: "Velocidad de giro (km/s)",
    legMeasured: "Medido (43 puntos, con su error)",
    legVisible: "Solo materia visible",
    legModel: "Visible + tu halo",
    slider: "Masa del halo invisible",
    sliderHint: "dentro de 44 kilopársecs del centro",
    sliderValue: (m) => (m ? `${m} masas solares` : "sin halo"),
    sliderNone: "sin halo",
    ratioLabel: "Tu halo, comparado con las estrellas y el gas",
    ratioUnit: "veces la masa visible",
    ratioNone: "Sin halo: solo cuenta lo que se ve.",
    fit: "Desajuste medio con lo medido",
    fitUnit: "km/s",
    fitGood: "El modelo encaja con las medidas.",
    fitLow: "Falta masa: el modelo queda por debajo en el borde.",
    fitHigh: "Sobra masa: el modelo queda por encima.",
    best: "Poner el mejor ajuste",
    pick: "Toca un punto para ver sus datos.",
    picked: (r, v, e, vis) => `A ${r} kpc del centro: medido ${v} ± ${e} km/s. Solo con lo visible serían ${vis} km/s.`,
    pointAria: (r, v, e) => `${r} kilopársecs: ${v} más o menos ${e} kilómetros por segundo`,
    needTitle: "La cuenta en el borde",
    need: (r, v, dyn, vis, k) => `Para girar a ${v} km/s a ${r} kpc del centro hace falta que esa órbita encierre ${dyn} masas solares (M = v²·r / G). Las estrellas y el gas de toda la galaxia suman ${vis}. Falta ${k} veces más de lo que se ve.`,
    whySummary: "¿De dónde salen estos puntos y estas curvas?",
    whyBody: (d, e) => `Los puntos son la curva de rotación de NGC 3198 de la base de datos SPARC: velocidades del gas medidas con radiotelescopios (hidrógeno) y en luz visible. La galaxia está a ${d} ± ${e} megapársecs, distancia medida con cefeidas. La curva azul también viene de SPARC: es lo que aportan el gas observado y las estrellas, pesadas por su luz infrarroja suponiendo 0,5 masas solares por cada luminosidad solar. Ese factor es una estimación.`,
    modelSummary: "El modelo, con sus fórmulas y lo que simplifica",
    modelBody: [
      "Visible: V_vis² = V_gas·|V_gas| + 0,5·V_disco²",
      "Halo: densidad ρ(r) = ρ₀ / (1 + (r/r_c)²), con r_c = 2,7 kpc",
      "Masa del halo dentro de r: M(r) ∝ r − r_c·arctan(r/r_c)",
      "Total: V² = V_vis² + G·M_halo(r) / r",
    ],
    modelFine: "Simplificaciones: halo esférico de una forma concreta (hay otras, como NFW); el radio r_c lo fijó Teseo ajustando estos mismos datos, así que tú solo mueves la masa; la razón masa/luz de las estrellas se deja fija en 0,5. Un ajuste profesional deja libres esos tres números.",
    solarTitle: "La misma ley, en casa",
    solarLead: "En el sistema solar casi toda la masa está en el centro, en el Sol. La gravedad de Newton, la misma que usa la pestaña Ruta, dice entonces que cuanto más lejos, más despacio: v = √(G·M / r). Los planetas la cumplen.",
    solarAria: "Velocidad orbital de los ocho planetas frente a su distancia al Sol: cae de 47,4 kilómetros por segundo en Mercurio a 5,4 en Neptuno, sobre la curva de Kepler.",
    solarX: "Distancia al Sol (millones de km, escala logarítmica)",
    solarY: "Velocidad (km/s)",
    legPlanets: "Planetas (NASA)",
    legKepler: "v = √(G·M☉ / r)",
    solarPick: "Toca un planeta.",
    solarPicked: (n, d, v, k) => `${n}: a ${d} millones de km, ${v} km/s medidos; la fórmula da ${k}.`,
    solarAfter: "En una galaxia, más allá de donde se acaban las estrellas, debería pasar lo mismo: la curva azul del gráfico de arriba cae. Las medidas no caen. O hay masa que no vemos, o la gravedad no funciona igual a esas escalas.",
    threadTitle: "El hilo sigue",
    evidence: {
      title: "No es solo una galaxia",
      teaser: "Lentes gravitacionales, el cúmulo Bala y el fondo cósmico.",
      p1: "Vera Rubin y Kent Ford midieron en 1970 el giro de la galaxia de Andrómeda; desde entonces se han medido cientos de galaxias, y casi todas piden masa que no se ve. Hay además pruebas que no dependen de ninguna curva de rotación.",
      items: [
        ["Lentes gravitacionales", "La masa curva la luz que pasa cerca. Midiendo cuánto deforman los cúmulos de galaxias la imagen de las galaxias de fondo se obtiene su masa total: mucha más que la que brilla."],
        ["El cúmulo Bala", "Dos cúmulos de galaxias que chocaron. El gas caliente, que es la mayor parte de la materia ordinaria, quedó frenado en el centro; el mapa de masa, hecho con lentes gravitacionales, sigue de largo junto a las galaxias. La masa no está donde está el gas: la separación se midió con una significación de 8 sigmas."],
        ["El fondo cósmico de microondas", (k) => `El patrón de manchas de la primera luz del universo depende de cuánta materia siente la luz y cuánta no. Planck mide ${k} veces más materia oscura que ordinaria.`],
      ],
      tag: "measured",
    },
    unknown: {
      title: "Qué es: nadie lo sabe",
      teaser: "Se mide su gravedad; nunca se ha detectado una partícula.",
      p1: "«Materia oscura» nombra un efecto, no una sustancia conocida. No emite ni absorbe luz, y solo se nota por su gravedad. Podría ser una partícula nueva (los candidatos más buscados se llaman WIMP y axiones), agujeros negros muy antiguos o algo que nadie ha imaginado.",
      p2: "Los detectores más sensibles, enterrados bajo tierra para aislarlos, llevan décadas buscando. El experimento LUX-ZEPLIN publicó en 2023 su primera búsqueda: sus datos eran compatibles con no haber visto nada. Cada resultado nulo descarta posibilidades, pero no dice qué es.",
      tag: "unknown",
    },
    mond: {
      title: "¿Y si la gravedad fuera distinta?",
      teaser: "La alternativa: no falta masa, falla la ley.",
      p1: "En 1983 Mordehai Milgrom propuso otra salida: quizá no hay materia invisible, sino que la gravedad se comporta distinto cuando la aceleración es diminuta, como en el borde de las galaxias. La idea se llama MOND, dinámica newtoniana modificada.",
      p2: "A su favor: en las galaxias, la materia visible por sí sola permite predecir la curva de rotación con mucha precisión, algo que MOND anticipó y que con materia oscura hay que explicar aparte. En contra: no reproduce bien los cúmulos de galaxias como el cúmulo Bala ni el fondo cósmico de microondas sin añadir, de todos modos, algo invisible.",
      p3: "Hoy es una hipótesis minoritaria: la mayoría de quienes investigan esto consideran que la materia oscura explica más observaciones a la vez. Sigue siendo una línea de trabajo activa, y mientras no se detecte una partícula la pregunta no está cerrada.",
      tag: "unknown",
      tagNote: "hipótesis minoritaria",
    },
    budget: {
      title: "El presupuesto del universo",
      teaser: "Lo que conocemos es menos del 5 %.",
      p1: "A partir del fondo cósmico de microondas, la misión Planck midió cuánto hay de cada cosa en el universo de hoy.",
      aria: (a, b, c) => `Materia ordinaria ${a} por ciento, materia oscura ${b} por ciento, energía oscura ${c} por ciento.`,
      ordinary: "Materia ordinaria",
      ordinaryNote: "átomos: estrellas, gas, planetas, nosotros",
      dark: "Materia oscura",
      darkNote: "gravedad sin luz; no se sabe qué es",
      energy: "Energía oscura",
      energyNote: "lo que acelera la expansión; tampoco se sabe qué es",
      rest: (r) => `El ${r} % que falta para 100 son sobre todo neutrinos.`,
      fine: "Valores de Planck 2018 dentro del modelo cosmológico estándar: Ω_b·h² = 0,02237, Ω_c·h² = 0,1200, H₀ = 67,36 y Ω_Λ = 0,6847. Teseo solo divide entre h².",
      more: "La energía oscura tiene su propio recorrido: «¿El universo se expande?».",
      tag: "measured",
      tagNote: "dentro del modelo estándar",
    },
    honest: "Las curvas y el desajuste se calculan en tu teléfono con los datos publicados; ninguna IA interviene en el cálculo.",
  },
  en: {
    title: "What is the universe made of?",
    lead: "What we see, stars and gas, does not weigh enough to explain how galaxies spin. Here is the real measurement of one. Add unseen mass until the sums match.",
    chartTitle: (g) => `Rotation curve of ${g}`,
    chartAria: (g, far, vis) => `Rotation curve of ${g}. Measured speeds stay near ${far} kilometres per second out to the edge; visible matter alone predicts ${vis} at the last point.`,
    xLabel: "Distance from the centre (kiloparsecs)",
    yLabel: "Orbital speed (km/s)",
    legMeasured: "Measured (43 points, with errors)",
    legVisible: "Visible matter only",
    legModel: "Visible + your halo",
    slider: "Mass of the unseen halo",
    sliderHint: "within 44 kiloparsecs of the centre",
    sliderValue: (m) => (m ? `${m} solar masses` : "no halo"),
    sliderNone: "no halo",
    ratioLabel: "Your halo, compared with the stars and gas",
    ratioUnit: "times the visible mass",
    ratioNone: "No halo: only what is seen counts.",
    fit: "Mean misfit to the measurements",
    fitUnit: "km/s",
    fitGood: "The model matches the measurements.",
    fitLow: "Mass is missing: the model falls short at the edge.",
    fitHigh: "Too much mass: the model overshoots.",
    best: "Set the best fit",
    pick: "Tap a point to see its data.",
    picked: (r, v, e, vis) => `${r} kpc from the centre: measured ${v} ± ${e} km/s. From visible matter alone it would be ${vis} km/s.`,
    pointAria: (r, v, e) => `${r} kiloparsecs: ${v} plus or minus ${e} kilometres per second`,
    needTitle: "The sums at the edge",
    need: (r, v, dyn, vis, k) => `To orbit at ${v} km/s ${r} kpc from the centre, that orbit must enclose ${dyn} solar masses (M = v²·r / G). The stars and gas of the whole galaxy add up to ${vis}. ${k} times more than what is seen is missing.`,
    whySummary: "Where do these points and curves come from?",
    whyBody: (d, e) => `The points are the rotation curve of NGC 3198 from the SPARC database: gas speeds measured with radio telescopes (hydrogen) and in visible light. The galaxy is ${d} ± ${e} megaparsecs away, a distance measured with Cepheids. The blue curve also comes from SPARC: it is what the observed gas and the stars contribute, with the stars weighed by their infrared light assuming 0.5 solar masses per solar luminosity. That factor is an estimate.`,
    modelSummary: "The model, with its formulas and what it simplifies",
    modelBody: [
      "Visible: V_vis² = V_gas·|V_gas| + 0.5·V_disk²",
      "Halo: density ρ(r) = ρ₀ / (1 + (r/r_c)²), with r_c = 2.7 kpc",
      "Halo mass within r: M(r) ∝ r − r_c·arctan(r/r_c)",
      "Total: V² = V_vis² + G·M_halo(r) / r",
    ],
    modelFine: "Simplifications: a spherical halo of one particular shape (there are others, such as NFW); Teseo fixed the radius r_c by fitting these same data, so you only move the mass; the stars’ mass-to-light ratio is held at 0.5. A professional fit leaves those three numbers free.",
    solarTitle: "The same law, at home",
    solarLead: "In the solar system nearly all the mass sits at the centre, in the Sun. Newton’s gravity, the same one the Route tab uses, then says: the farther out, the slower, v = √(G·M / r). The planets obey it.",
    solarAria: "Orbital speed of the eight planets against their distance from the Sun: it falls from 47.4 kilometres per second at Mercury to 5.4 at Neptune, along the Kepler curve.",
    solarX: "Distance from the Sun (million km, logarithmic scale)",
    solarY: "Speed (km/s)",
    legPlanets: "Planets (NASA)",
    legKepler: "v = √(G·M☉ / r)",
    solarPick: "Tap a planet.",
    solarPicked: (n, d, v, k) => `${n}: ${d} million km out, ${v} km/s measured; the formula gives ${k}.`,
    solarAfter: "In a galaxy, beyond where the stars run out, the same should happen: the blue curve in the chart above drops. The measurements do not. Either there is mass we cannot see, or gravity does not work the same way on those scales.",
    threadTitle: "The thread goes on",
    evidence: {
      title: "It is not just one galaxy",
      teaser: "Gravitational lenses, the Bullet Cluster and the cosmic background.",
      p1: "Vera Rubin and Kent Ford measured the rotation of the Andromeda galaxy in 1970; hundreds of galaxies have been measured since, and nearly all call for mass that is not seen. There is also evidence that does not rely on any rotation curve.",
      items: [
        ["Gravitational lenses", "Mass bends the light passing near it. Measuring how much galaxy clusters distort the images of background galaxies gives their total mass: far more than what shines."],
        ["The Bullet Cluster", "Two galaxy clusters that collided. The hot gas, which is most of the ordinary matter, was slowed down in the middle; the mass map, made with gravitational lensing, carried on alongside the galaxies. The mass is not where the gas is: the offset was measured at a significance of 8 sigma."],
        ["The cosmic microwave background", (k) => `The pattern of spots in the universe’s first light depends on how much matter feels light and how much does not. Planck measures ${k} times more dark matter than ordinary matter.`],
      ],
      tag: "measured",
    },
    unknown: {
      title: "What it is: nobody knows",
      teaser: "Its gravity is measured; no particle has ever been detected.",
      p1: "“Dark matter” names an effect, not a known substance. It neither emits nor absorbs light, and shows itself only through gravity. It could be a new particle (the most sought-after candidates are called WIMPs and axions), very old black holes, or something nobody has imagined.",
      p2: "The most sensitive detectors, buried underground to shield them, have been searching for decades. The LUX-ZEPLIN experiment published its first search in 2023: its data were consistent with having seen nothing. Each null result rules out possibilities, but does not say what it is.",
      tag: "unknown",
    },
    mond: {
      title: "What if gravity were different?",
      teaser: "The alternative: no mass is missing, the law is off.",
      p1: "In 1983 Mordehai Milgrom proposed another way out: perhaps there is no unseen matter, and gravity instead behaves differently when acceleration is tiny, as at the edge of galaxies. The idea is called MOND, modified Newtonian dynamics.",
      p2: "In its favour: in galaxies, visible matter alone predicts the rotation curve very precisely, something MOND anticipated and that dark matter has to explain separately. Against it: it does not reproduce galaxy clusters such as the Bullet Cluster, or the cosmic microwave background, without adding something unseen anyway.",
      p3: "Today it is a minority hypothesis: most researchers in the field think dark matter explains more observations at once. It remains an active line of work, and until a particle is detected the question is not closed.",
      tag: "unknown",
      tagNote: "minority hypothesis",
    },
    budget: {
      title: "The universe’s budget",
      teaser: "What we know is under 5%.",
      p1: "From the cosmic microwave background, the Planck mission measured how much of each thing there is in today’s universe.",
      aria: (a, b, c) => `Ordinary matter ${a} percent, dark matter ${b} percent, dark energy ${c} percent.`,
      ordinary: "Ordinary matter",
      ordinaryNote: "atoms: stars, gas, planets, us",
      dark: "Dark matter",
      darkNote: "gravity without light; nobody knows what it is",
      energy: "Dark energy",
      energyNote: "what speeds up the expansion; also unknown",
      rest: (r) => `The ${r}% missing from 100 is mostly neutrinos.`,
      fine: "Planck 2018 values within the standard cosmological model: Ω_b·h² = 0.02237, Ω_c·h² = 0.1200, H₀ = 67.36 and Ω_Λ = 0.6847. Teseo only divides by h².",
      more: "Dark energy has its own tour: “Is the universe expanding?”.",
      tag: "measured",
      tagNote: "within the standard model",
    },
    honest: "The curves and the misfit are computed on your phone from the published data; no AI takes part in the calculation.",
  },
};
