// i18n-comp.js — textos de «¿De qué está hecho?» (composición y espectro) de la ficha del Cielo.
// Mismas claves en ES y EN. Lo importan directamente CompositionBlock.jsx y Spectrum.jsx (como
// GUIDES en GuidesControls.jsx); no se fusiona en TX. Las cifras y sus fuentes están en composition.js.
const loc = (lang) => (lang === "es" ? "es" : "en-US");
const pct = (v, lang) => Number(v).toLocaleString(loc(lang), { maximumFractionDigits: v < 1 ? 3 : 2 });
const nm1 = (v, lang) => Number(v).toLocaleString(loc(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const k0 = (v, lang) => Math.round(v).toLocaleString(loc(lang), { useGrouping: "always" });
const an = (w) => (/^[aeiou]/i.test(w) ? "an" : "a");
const list = (arr, lang) => (arr.length < 2 ? arr.join("") : arr.slice(0, -1).join(", ") + (lang === "es" ? " y " : " and ") + arr[arr.length - 1]);

export const COMP = {
  es: {
    compTitle: "¿De qué está hecho?",
    compAtm: "Atmósfera · por volumen",
    compAtmDry: "Atmósfera · por volumen, aire seco",
    compExo: "Exosfera",
    compSunMass: "Fotosfera · por masa",
    compStarMass: "Composición típica · por masa",
    compStarLead: "Como casi todas las estrellas: sobre todo hidrógeno y helio, con ~1–2 % de elementos más pesados.",
    compStarSunVals: "Valores del Sol, típicos de estrellas como esta (no medidos en esta estrella).",
    compExoText: (sp) => `Tan tenue que no se puede dar en porcentajes. Se han detectado ${sp}.`,
    compUnc: (u) => `Incertidumbre de la NASA: ±${pct(u, "es")} puntos en H₂ y He.`,
    pct: (v) => `${pct(v, "es")} %`,
    list: (arr) => list(arr, "es"),
    gas: {
      CO2: "Dióxido de carbono (CO₂)", N2: "Nitrógeno (N₂)", O2: "Oxígeno (O₂)", Ar: "Argón (Ar)", CO: "Monóxido de carbono (CO)",
      H2: "Hidrógeno (H₂)", He: "Helio (He)", CH4: "Metano (CH₄)",
      H: "Hidrógeno (H)", Z: "Elementos más pesados («metales»)",
    },
    species: { Na: "sodio", Mg: "magnesio", O: "oxígeno", H: "hidrógeno", K: "potasio", Ca: "calcio", He: "helio", Ne: "neón", H2: "hidrógeno molecular", Ar: "argón" },
    compNote: {
      mercury: "Es casi un vacío: sus átomos salen de la superficie, arrancados por el viento solar, la luz del Sol y los micrometeoritos.",
      venus: "Tanto CO₂, a 92 bar en la superficie, atrapa el calor: un efecto invernadero desbocado la hace el planeta más caliente del sistema solar.",
      earth: "Casi todo el oxígeno libre lo producen los seres vivos con la fotosíntesis. El vapor de agua varía y no entra en estas cifras.",
      moon: "Toda junta pesa unas 25 toneladas. Las cantidades son estimaciones nocturnas y varían.",
      mars: "Casi la misma mezcla que Venus, pero tan tenue que el agua líquida no dura en la superficie.",
      jupiter: "Casi la misma mezcla que el Sol: hidrógeno y helio, los dos elementos más abundantes del universo.",
      saturn: "Hidrógeno y helio, como Júpiter. Es tan poco denso que, de media, flotaría en el agua.",
      uranus: "El metano absorbe la luz roja y devuelve la azul: por eso Urano se ve verde azulado.",
      neptune: "El metano absorbe la luz roja: es una de las razones de su color azul.",
      sun: "Tres cuartas partes de su masa son hidrógeno; casi todo lo demás es helio. Su energía sale de convertir hidrógeno en helio en el núcleo.",
    },
    compFinger: "Las líneas oscuras son la huella de cada elemento: así sabemos de qué están hechas las estrellas sin ir hasta ellas.",
    compSrc: {
      nasaMercury: "NASA, Mercury Fact Sheet", nasaVenus: "NASA, Venus Fact Sheet", nasaEarth: "NASA, Earth Fact Sheet",
      nasaMoon: "NASA, Moon Fact Sheet", nasaMars: "NASA, Mars Fact Sheet", nasaJupiter: "NASA, Jupiter Fact Sheet",
      nasaSaturn: "NASA, Saturn Fact Sheet", nasaUranus: "NASA, Uranus Fact Sheet", nasaNeptune: "NASA, Neptune Fact Sheet",
    },
    compSrcLabel: "Fuente",
    compSrcAsplund: "Asplund et al. (2009), ARA&A 47, 481",
    compSrcLines: "Líneas: NIST Atomic Spectra Database (en aire); TiO: Pavlenko et al. (2020) y Gray & Corbally (2009).",
    compSrcSun: "Temperatura: valor nominal de la UAI (2015).",
    compSrcTemp: "Temperatura estimada a partir del índice de color B−V (Ballesteros 2012).",
    // ── espectro ──
    specTitle: "Espectro",
    specCaption: (T, cls, lower) => `Espectro esquemático: curva de cuerpo negro a ${lower ? "≥" : "≈"} ${k0(T, "es")} K con las líneas típicas de una estrella tipo ${cls}. No es una medición de esta estrella.`,
    specCaptionSun: (T) => `Espectro esquemático: curva de cuerpo negro a ${k0(T, "es")} K con las principales líneas de Fraunhofer (las letras son las que les puso Fraunhofer en 1814). El espectro real del Sol tiene miles de líneas más.`,
    specNoLines: "Sin tipo espectral O–M en el catálogo: solo la curva, sin líneas.",
    specMismatch: "No dibujamos su espectro: el tipo espectral del catálogo no cuadra con su color (puede ser una estrella doble o estar enrojecida por el polvo).",
    specAxis: "longitud de onda (nm)",
    specPeak: (nm) => `pico ${k0(nm, "es")} nm`,
    specPeakUv: (nm) => `pico en ${k0(nm, "es")} nm (ultravioleta)`,
    specPeakIr: (nm) => `pico en ${k0(nm, "es")} nm (infrarrojo)`,
    specStrength: ["", "débil", "media", "fuerte"],
    specGroup: { balmer: "Hidrógeno (Balmer)", cahk: "Calcio ionizado (H y K)", nad: "Sodio (D)", mgb: "Magnesio (b)", hei: "Helio", heii: "Helio ionizado", tio: "Óxido de titanio (bandas)" },
    specLegend: "Líneas dibujadas",
    specAria: (T, lower, peakTxt, linesTxt, cls) =>
      `Espectro esquemático de 380 a 750 nanómetros: curva de cuerpo negro de ${lower ? "al menos " : "unos "}${k0(T, "es")} kelvin, ${peakTxt}.` +
      (linesTxt ? ` Líneas de absorción típicas ${cls === "sun" ? "del Sol" : "de una estrella tipo " + cls}: ${linesTxt}.` : " Sin líneas."),
    specAriaPeak: (nm, zone) => zone === "visible" ? `con el pico de emisión en ${k0(nm, "es")} nm` : zone === "uv" ? `con el pico de emisión en ${k0(nm, "es")} nm, en el ultravioleta, fuera del visible` : `con el pico de emisión en ${k0(nm, "es")} nm, en el infrarrojo, fuera del visible`,
    specAriaLine: (name, nm, s) => `${name} ${nm1(nm, "es")} nm${s ? " (" + s + ")" : ""}`,
  },
  en: {
    compTitle: "What is it made of?",
    compAtm: "Atmosphere · by volume",
    compAtmDry: "Atmosphere · by volume, dry air",
    compExo: "Exosphere",
    compSunMass: "Photosphere · by mass",
    compStarMass: "Typical composition · by mass",
    compStarLead: "Like almost every star: mostly hydrogen and helium, with ~1–2% heavier elements.",
    compStarSunVals: "The Sun's values, typical of stars like this one (not measured in this star).",
    compExoText: (sp) => `So thin it can't be given as percentages. Detected so far: ${sp}.`,
    compUnc: (u) => `NASA uncertainty: ±${pct(u, "en")} points on H₂ and He.`,
    pct: (v) => `${pct(v, "en")}%`,
    list: (arr) => list(arr, "en"),
    gas: {
      CO2: "Carbon dioxide (CO₂)", N2: "Nitrogen (N₂)", O2: "Oxygen (O₂)", Ar: "Argon (Ar)", CO: "Carbon monoxide (CO)",
      H2: "Hydrogen (H₂)", He: "Helium (He)", CH4: "Methane (CH₄)",
      H: "Hydrogen (H)", Z: "Heavier elements (\"metals\")",
    },
    species: { Na: "sodium", Mg: "magnesium", O: "oxygen", H: "hydrogen", K: "potassium", Ca: "calcium", He: "helium", Ne: "neon", H2: "molecular hydrogen", Ar: "argon" },
    compNote: {
      mercury: "It is almost a vacuum: its atoms come off the surface, knocked out by the solar wind, sunlight and micrometeorites.",
      venus: "So much CO₂, at 92 bar on the surface, traps heat: a runaway greenhouse effect makes it the hottest planet in the Solar System.",
      earth: "Almost all free oxygen is made by living things through photosynthesis. Water vapour varies and is not included in these figures.",
      moon: "All of it together weighs about 25 tonnes. The amounts are night-time estimates and vary.",
      mars: "Almost the same mix as Venus, but so thin that liquid water does not last on the surface.",
      jupiter: "Almost the same mix as the Sun: hydrogen and helium, the two most abundant elements in the universe.",
      saturn: "Hydrogen and helium, like Jupiter. It is so low in density that, on average, it would float in water.",
      uranus: "Methane absorbs red light and sends back blue: that is why Uranus looks blue-green.",
      neptune: "Methane absorbs red light: it is one of the reasons for its blue colour.",
      sun: "Three quarters of its mass is hydrogen; nearly all the rest is helium. Its energy comes from turning hydrogen into helium in the core.",
    },
    compFinger: "The dark lines are each element's fingerprint: that is how we know what stars are made of without going there.",
    compSrc: {
      nasaMercury: "NASA, Mercury Fact Sheet", nasaVenus: "NASA, Venus Fact Sheet", nasaEarth: "NASA, Earth Fact Sheet",
      nasaMoon: "NASA, Moon Fact Sheet", nasaMars: "NASA, Mars Fact Sheet", nasaJupiter: "NASA, Jupiter Fact Sheet",
      nasaSaturn: "NASA, Saturn Fact Sheet", nasaUranus: "NASA, Uranus Fact Sheet", nasaNeptune: "NASA, Neptune Fact Sheet",
    },
    compSrcLabel: "Source",
    compSrcAsplund: "Asplund et al. (2009), ARA&A 47, 481",
    compSrcLines: "Lines: NIST Atomic Spectra Database (air); TiO: Pavlenko et al. (2020) and Gray & Corbally (2009).",
    compSrcSun: "Temperature: IAU nominal value (2015).",
    compSrcTemp: "Temperature estimated from the B−V colour index (Ballesteros 2012).",
    specTitle: "Spectrum",
    specCaption: (T, cls, lower) => `Schematic spectrum: blackbody curve at ${lower ? "≥" : "≈"} ${k0(T, "en")} K with the lines typical of a type ${cls} star. It is not a measurement of this star.`,
    specCaptionSun: (T) => `Schematic spectrum: blackbody curve at ${k0(T, "en")} K with the main Fraunhofer lines (the letters are the ones Fraunhofer gave them in 1814). The real solar spectrum has thousands more lines.`,
    specNoLines: "No O–M spectral type in the catalogue: curve only, no lines.",
    specMismatch: "We don't draw its spectrum: the catalogue's spectral type doesn't match its colour (it may be a double star or reddened by dust).",
    specAxis: "wavelength (nm)",
    specPeak: (nm) => `peak ${k0(nm, "en")} nm`,
    specPeakUv: (nm) => `peak at ${k0(nm, "en")} nm (ultraviolet)`,
    specPeakIr: (nm) => `peak at ${k0(nm, "en")} nm (infrared)`,
    specStrength: ["", "weak", "medium", "strong"],
    specGroup: { balmer: "Hydrogen (Balmer)", cahk: "Ionised calcium (H and K)", nad: "Sodium (D)", mgb: "Magnesium (b)", hei: "Helium", heii: "Ionised helium", tio: "Titanium oxide (bands)" },
    specLegend: "Lines drawn",
    specAria: (T, lower, peakTxt, linesTxt, cls) =>
      `Schematic spectrum from 380 to 750 nanometres: blackbody curve at ${lower ? "at least " : "about "}${k0(T, "en")} kelvin, ${peakTxt}.` +
      (linesTxt ? ` Absorption lines typical of ${cls === "sun" ? "the Sun" : "a type " + cls + " star"}: ${linesTxt}.` : " No lines."),
    specAriaPeak: (nm, zone) => zone === "visible" ? `with its emission peak at ${k0(nm, "en")} nm` : zone === "uv" ? `with its emission peak at ${k0(nm, "en")} nm, in the ultraviolet, outside the visible range` : `with its emission peak at ${k0(nm, "en")} nm, in the infrared, outside the visible range`,
    specAriaLine: (name, nm, s) => `${name} ${nm1(nm, "en")} nm${s ? " (" + s + ")" : ""}`,
  },
};

// ── «Su vida y su final» (StarLifeBlock.jsx; datos y fuentes en starLife.js) ──
// años en palabras: ES en «millones» (4.600 millones), «billones» = 10¹²; EN en million / billion / trillion
const yUnit = (y, lang) => (y >= 1e12 ? [1e12, lang === "es" ? "billones de años" : "trillion years"]
  : lang !== "es" && y >= 1e9 ? [1e9, "billion years"] : y >= 1e6 ? [1e6, lang === "es" ? "millones de años" : "million years"] : [1, lang === "es" ? "años" : "years"]);
const yNum = (v, lang) => Number(v).toLocaleString(loc(lang), { useGrouping: "always", maximumFractionDigits: v < 10 ? 1 : 0 });
const yrs = (y, lang) => { const [d, u] = yUnit(y, lang); return `${yNum(y / d, lang)} ${u}`; };
const msun = (v, lang, dec) => Number(v).toLocaleString(loc(lang), { minimumFractionDigits: dec, maximumFractionDigits: dec });
const decOf = (v) => { const s = String(v); const i = s.indexOf("."); return i < 0 ? 0 : Math.min(3, s.length - i - 1); };
const massTxt = (m, lang) => {
  if (Array.isArray(m)) return `≈ ${msun(m[0], lang, 0)}–${msun(m[1], lang, 0)} M☉`;
  const d = decOf(m.e != null ? m.e : m.v);
  if (m.approx) return `≈ ${msun(m.v, lang, decOf(m.v))} M☉`;
  return m.e != null ? `${msun(m.v, lang, d)} ± ${msun(m.e, lang, d)} M☉` : `≈ ${msun(m.v, lang, decOf(m.v))} M☉`;
};
const ageTxt = (a, approx, lang) => {
  if (a[0] === a[1]) return `${approx ? "≈ " : ""}${yrs(a[0], lang)}`;
  const [d, u] = yUnit(a[1], lang);
  return lang === "es" ? `entre ${yNum(a[0] / d, lang)} y ${yNum(a[1] / d, lang)} ${u}` : `${yNum(a[0] / d, lang)}–${yNum(a[1] / d, lang)} ${u}`;
};

export const LIFE = {
  es: {
    lifeTitle: "Su vida y su final",
    color: { O: "azul", B: "azul", A: "blanca", F: "blanco-amarillenta", G: "amarilla", K: "naranja", M: "roja" },
    type: {
      ms: (c, L) => L === "M" ? "Es una enana roja: una estrella pequeña y fría de la secuencia principal, que fusiona hidrógeno en su núcleo muy despacio."
        : L === "G" ? "Es una enana amarilla, como el Sol: está en la secuencia principal, fusionando hidrógeno en su núcleo."
        : `Es una estrella ${c} de la secuencia principal (clase V, «enana»): fusiona hidrógeno en su núcleo, como el Sol.`,
      subgiant: (c) => `Es una subgigante ${c}: está agotando el hidrógeno de su núcleo y empieza a hincharse.`,
      giant: (c) => `Es una gigante ${c}: ya agotó el hidrógeno de su núcleo y se ha hinchado muchísimo.`,
      supergiant: (c) => `Es una supergigante ${c}: una estrella muy masiva en sus últimas etapas.`,
      wd: () => "Es una enana blanca: el núcleo apagado de una estrella que ya terminó su vida, y que se va enfriando.",
      none: (spt) => `Tipo ${spt}, clase de luminosidad no indicada en el catálogo: no podemos decir en qué etapa está.`,
    },
    assumed: "El catálogo no indica su clase de luminosidad; la deducimos de su brillo real, que cuadra con el de la secuencia principal.",
    sun: "Es una enana amarilla de tipo G2 V, a mitad de su vida: lleva unos 4.600 millones de años fusionando hidrógeno en su núcleo y le quedan unos 5.000 millones antes de convertirse en gigante roja, expulsar una nebulosa planetaria y quedar como enana blanca.",
    massLabel: "Masa",
    massEst: "Masa estimada por su tipo espectral",
    massEstHint: (spt) => `Valor típico de una enana ${spt} (Pecaut y Mamajek 2013). No es una medida de esta estrella.`,
    massNone: "Sin una masa publicada no damos cifra: las gigantes y supergigantes de un mismo tipo pueden tener masas muy distintas.",
    mass: (m) => massTxt(m, "es"),
    ageLabel: "Edad",
    age: (a, approx) => ageTxt(a, approx, "es"),
    lifeLabel: "Vida en la secuencia principal",
    life: (y) => `≈ ${yrs(y, "es")}`,
    lifeHint: "Aproximación de orden de magnitud: 10.000 millones de años × (M/M☉)^−2,5.",
    lifeRed: "Muchísimo más que la edad del universo: billones de años.",
    fate: {
      redDwarf: "Gastará su hidrógeno tan despacio que vivirá billones de años y acabará como enana blanca de helio. Ninguna estrella ha llegado aún a ese final: el universo es demasiado joven.",
      wdLate: "Ya pasó a la fase de gigante: expulsará sus capas externas en una nebulosa planetaria y su núcleo quedará como enana blanca: el mismo destino que le espera al Sol.",
      wd: "Cuando agote el hidrógeno se hinchará como gigante roja, expulsará sus capas externas en una nebulosa planetaria y su núcleo quedará como enana blanca: el mismo destino que el Sol.",
      border: "Está en la frontera: puede acabar como enana blanca de oxígeno y neón o estallar como supernova.",
      ns: "Acabará estallando como supernova de colapso del núcleo; su núcleo quedará como estrella de neutrones.",
      nsbh: "Acabará como supernova (o colapsando directamente); quedará una estrella de neutrones o un agujero negro: el umbral entre ambos no se conoce bien.",
      bh: "Acabará como supernova o colapsando directamente, y dejará un agujero negro.",
      giantUnknown: "Si nació con menos de unas 8 masas solares, como la mayoría de las gigantes, acabará como enana blanca tras una nebulosa planetaria; si nació con más, como supernova.",
      superUnknown: "Las supergigantes nacen con mucha masa: lo esperable es que acabe como supernova y deje una estrella de neutrones o un agujero negro, según su masa.",
    },
    near: "Su masa está cerca de un umbral: el final podría ser el de al lado.",
    edges: "Los umbrales de masa son aproximados: dependen de la composición, la rotación y la pérdida de masa.",
    stage: {
      ms: "Secuencia principal", subgiant: "Subgigante", giant: "Gigante roja", supergiant: "Supergigante", pn: "Nebulosa planetaria",
      wd: "Enana blanca", wdHe: "Enana blanca de helio", sn: "Supernova", ns: "Estrella de neutrones", nsbh: "Estrella de neutrones o agujero negro",
      bh: "Agujero negro", borderEnd: "Enana blanca o supernova", unknownEnd: "Enana blanca o supernova",
    },
    here: "está aquí",
    hereSr: "(está aquí)",
    timelineAria: "Etapas de su vida, en orden",
    comp: {
      siriusB: "Su compañera, Sirio B, ya es una enana blanca: un adelanto de su propio final.",
      procyonB: "Su compañera, Proción B, ya es una enana blanca: un adelanto de su propio final.",
    },
    exPn: "Ejemplo real de nebulosa planetaria:",
    exSn: "Ejemplo real de resto de supernova:",
    m57: "Nebulosa del Anillo (M57)",
    m1: "Nebulosa del Cangrejo (M1), de la supernova del año 1054",
    goTo: (n) => `Ir a ${n}`,
    refs: "Fuentes",
    refsMs: "Pecaut y Mamajek (2013), ApJS 208, 9 (tabla de E. Mamajek, versión 2022)",
    refsFate: "Finales: OpenStax, Astronomy 2e, tabla 23.1; NASA, Imagine the Universe",
    refsSun: "NASA, «Sun: Facts», «Star Basics» e «Imagine the Universe: Stars»",
  },
  en: {
    lifeTitle: "Its life and its end",
    color: { O: "blue", B: "blue", A: "white", F: "yellow-white", G: "yellow", K: "orange", M: "red" },
    type: {
      ms: (c, L) => L === "M" ? "It is a red dwarf: a small, cool main-sequence star that fuses hydrogen in its core very slowly."
        : L === "G" ? "It is a yellow dwarf, like the Sun: it is on the main sequence, fusing hydrogen in its core."
        : `It is ${an(c)} ${c} main-sequence star (class V, "dwarf"): it fuses hydrogen in its core, like the Sun.`,
      subgiant: (c) => `It is ${an(c)} ${c} subgiant: it is running out of hydrogen in its core and starting to swell.`,
      giant: (c) => `It is ${an(c)} ${c} giant: it has used up the hydrogen in its core and has swollen enormously.`,
      supergiant: (c) => `It is ${an(c)} ${c} supergiant: a very massive star in its last stages.`,
      wd: () => "It is a white dwarf: the dead core of a star that has already ended its life, slowly cooling down.",
      none: (spt) => `Type ${spt}, luminosity class not given in the catalogue: we can't tell what stage it is in.`,
    },
    assumed: "The catalogue gives no luminosity class; we infer it from its true brightness, which matches the main sequence.",
    sun: "It is a G2 V yellow dwarf, halfway through its life: it has been fusing hydrogen in its core for about 4.6 billion years and has about 5 billion left before it becomes a red giant, sheds a planetary nebula and ends up as a white dwarf.",
    massLabel: "Mass",
    massEst: "Mass estimated from its spectral type",
    massEstHint: (spt) => `Typical value for a ${spt} dwarf (Pecaut & Mamajek 2013). Not a measurement of this star.`,
    massNone: "Without a published mass we give no figure: giants and supergiants of the same type can have very different masses.",
    mass: (m) => massTxt(m, "en"),
    ageLabel: "Age",
    age: (a, approx) => ageTxt(a, approx, "en"),
    lifeLabel: "Life on the main sequence",
    life: (y) => `≈ ${yrs(y, "en")}`,
    lifeHint: "Order-of-magnitude approximation: 10 billion years × (M/M☉)^−2.5.",
    lifeRed: "Far longer than the age of the universe: trillions of years.",
    fate: {
      redDwarf: "It will burn its hydrogen so slowly that it will live for trillions of years and end as a helium white dwarf. No star has reached that end yet: the universe is too young.",
      wdLate: "It has already reached the giant phase: it will shed its outer layers as a planetary nebula and its core will be left as a white dwarf: the same fate that awaits the Sun.",
      wd: "When it runs out of hydrogen it will swell into a red giant, shed its outer layers as a planetary nebula, and its core will be left as a white dwarf: the same fate as the Sun.",
      border: "It is on the borderline: it may end as an oxygen-neon white dwarf or explode as a supernova.",
      ns: "It will end by exploding as a core-collapse supernova; its core will be left as a neutron star.",
      nsbh: "It will end as a supernova (or by collapsing directly), leaving a neutron star or a black hole: the dividing line is not well known.",
      bh: "It will end as a supernova or by collapsing directly, leaving a black hole.",
      giantUnknown: "If it was born with less than about 8 solar masses, like most giants, it will end as a white dwarf after a planetary nebula; if it was born with more, as a supernova.",
      superUnknown: "Supergiants are born very massive: it is expected to end as a supernova, leaving a neutron star or a black hole depending on its mass.",
    },
    near: "Its mass is close to a threshold: the end could be the neighbouring one.",
    edges: "The mass thresholds are approximate: they depend on composition, rotation and mass loss.",
    stage: {
      ms: "Main sequence", subgiant: "Subgiant", giant: "Red giant", supergiant: "Supergiant", pn: "Planetary nebula",
      wd: "White dwarf", wdHe: "Helium white dwarf", sn: "Supernova", ns: "Neutron star", nsbh: "Neutron star or black hole",
      bh: "Black hole", borderEnd: "White dwarf or supernova", unknownEnd: "White dwarf or supernova",
    },
    here: "it is here",
    hereSr: "(it is here)",
    timelineAria: "Stages of its life, in order",
    comp: {
      siriusB: "Its companion, Sirius B, is already a white dwarf: a preview of its own end.",
      procyonB: "Its companion, Procyon B, is already a white dwarf: a preview of its own end.",
    },
    exPn: "A real planetary nebula:",
    exSn: "A real supernova remnant:",
    m57: "Ring Nebula (M57)",
    m1: "Crab Nebula (M1), from the supernova of 1054",
    goTo: (n) => `Go to ${n}`,
    refs: "Sources",
    refsMs: "Pecaut & Mamajek (2013), ApJS 208, 9 (E. Mamajek's table, 2022 version)",
    refsFate: "Ends: OpenStax, Astronomy 2e, table 23.1; NASA, Imagine the Universe",
    refsSun: "NASA, \"Sun: Facts\", \"Star Basics\" and \"Imagine the Universe: Stars\"",
  },
};
