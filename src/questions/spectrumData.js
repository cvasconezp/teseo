// spectrumData.js — física y datos de «¿Cómo sabemos de qué están hechas las estrellas?».
// Puro (sin React ni DOM): lo usan SpectrumTour.jsx y scripts/test_questions_spectrum.mjs.
// Reutiliza, sin modificarlos, las líneas, Planck y Wien de src/sky/composition.js; aquí solo
// se añade lo que ese módulo no expone (Fe I, Ca I, bandas moleculares, infrarrojo cercano,
// mezclas, atajos y retos del juego).
//
// FUENTES (todas comprobadas el 14-nov-2026):
//  · Líneas ATÓMICAS: NIST Atomic Spectra Database (https://physics.nist.gov/asd), longitud de
//    onda observada EN AIRE (la que se ve a simple vista); la última columna `ei` es la energía
//    del nivel inferior de la transición, también de NIST (cm⁻¹).
//      H I (Balmer): 656,279 · 486,135 · 434,047 · 410,173      He I: 587,562 · 447,148
//      Na I (D): 588,995 · 589,592        Ca II (H y K): 396,847 · 393,366     Ca I: 422,673
//      Mg I (b): 518,360 · 517,268 · 516,732       Fe I: 385,991 · 404,581 · 430,790 · 438,354 ·
//      466,813 · 495,760 · 516,890 · 527,036 · 532,804
//    (H, He, Na, Ca II, Mg y TiO se importan de composition.js, que ya las verificó; la prueba
//    comprueba que coinciden con NIST a ±0,2 nm.)
//  · Bandas MOLECULARES (no están en NIST ASD, que es atómica); posiciones aproximadas:
//      O₂: bandas A (≈ 760 nm), B (≈ 687 nm) y «a» (≈ 628 nm): líneas de Fraunhofer de origen
//        terrestre, 759,370 · 686,719 · 627,661 nm (tabla de «Fraunhofer lines»); A y B también
//        en Stubbs et al. (2007) y la rama R de A en Kimeswenger et al. (2020).
//      H₂O: 0,94 · 1,14 · 1,38 · 1,88 µm y CO₂: 2,01 y 2,08 µm: Gao, Heidebrecht y Goetz (1993).
//      CO₂: 1,61 y 2,06 µm: NASA OCO-2. (Se dibujan 1,61 · 2,01 · 2,06.)
//      CH₄: 619 · 727 · 890 nm: filtros de metano de Cassini ISS (NASA/JPL); el espectro del
//        metano de los planetas gigantes en 300–1000 nm: Karkoschka (1994).
//      TiO: cabezas de banda 544,8 · 619,25 · 705,4 nm, ya verificadas en composition.js.
//    Si una banda molecular no pudo verificarse (p. ej. H₂O en el visible, a ≈ 720 nm), NO se pone.
//  · Intensidades: CUALITATIVAS. Las de las líneas atómicas por clase espectral siguen
//    composition.js (STRENGTH); las de Fe I y Ca I (4227) son de criterio propio, siguiendo el
//    comportamiento estándar de la clasificación de Morgan–Keenan. La profundidad dibujada es
//    didáctica, no una medición.
//  · Wien: b = 2,897771955×10⁶ nm·K (CODATA 2018). Sol: 5.772 K (UAI 2015, resolución B3).

import {
  LINES, STRENGTH, CLASSES, DEPTH, SUN_TEFF, VIS_MIN, VIS_MAX,
  wienPeak, planckRel, spectrumCurve,
} from "../sky/composition.js";

export { wienPeak, planckRel, spectrumCurve, SUN_TEFF, VIS_MIN, VIS_MAX };

// ─── Fuentes ────────────────────────────────────────────────────────────────
export const SPEC_REFS = {
  nist: { cite: "Kramida, Ralchenko, Reader y el equipo de NIST ASD: Atomic Spectra Database (NIST). Longitudes de onda en aire.", citeEn: "Kramida, Ralchenko, Reader and the NIST ASD Team: Atomic Spectra Database (NIST). Wavelengths in air.", url: "https://physics.nist.gov/asd" },
  newton: { cite: "Isaac Newton (1672): primer artículo a la Royal Society, con el prisma. Resumen en «Spectroscopy», Wikipedia", citeEn: "Isaac Newton (1672): first paper to the Royal Society, with the prism. Summary in “Spectroscopy”, Wikipedia", url: "https://en.wikipedia.org/wiki/Spectroscopy" },
  fraunhofer: { cite: "Líneas de Fraunhofer (1814) y su tabla de longitudes de onda: «Fraunhofer lines», Wikipedia", citeEn: "Fraunhofer lines (1814) and their wavelength table: “Fraunhofer lines”, Wikipedia", url: "https://en.wikipedia.org/wiki/Fraunhofer_lines" },
  kirchhoff: { cite: "Gustav Kirchhoff y Robert Bunsen (1859–1860): «Gustav Kirchhoff», Wikipedia", citeEn: "Gustav Kirchhoff and Robert Bunsen (1859–1860): “Gustav Kirchhoff”, Wikipedia", url: "https://en.wikipedia.org/wiki/Gustav_Kirchhoff" },
  helium: { cite: "Descubrimiento del helio, 1868 (Janssen, Lockyer) y 1895 (Ramsay): «Helium», Wikipedia", citeEn: "Discovery of helium, 1868 (Janssen, Lockyer) and 1895 (Ramsay): “Helium”, Wikipedia", url: "https://en.wikipedia.org/wiki/Helium" },
  payne: { cite: "Cecilia Payne (1925): Stellar Atmospheres; a Contribution to the Observational Study of High Temperature in the Reversing Layers of Stars. Tesis, Harvard (registro ADS)", citeEn: "Cecilia Payne (1925): Stellar Atmospheres; a Contribution to the Observational Study of High Temperature in the Reversing Layers of Stars. Thesis, Harvard (ADS record)", url: "https://ui.adsabs.harvard.edu/abs/1925PhDT.........1P/abstract" },
  payneBio: { cite: "Cecilia Payne-Gaposchkin y la reacción de H. N. Russell (1925–1929): Wikipedia", citeEn: "Cecilia Payne-Gaposchkin and H. N. Russell’s reaction (1925–1929): Wikipedia", url: "https://en.wikipedia.org/wiki/Cecilia_Payne-Gaposchkin" },
  gao1993: { cite: "Gao, Heidebrecht y Goetz (1993): Derivation of Scaled Surface Reflectances from AVIRIS Data. Remote Sensing of Environment 44, 165–178 (bandas de H₂O, O₂ y CO₂)", citeEn: "Gao, Heidebrecht and Goetz (1993): Derivation of Scaled Surface Reflectances from AVIRIS Data. Remote Sensing of Environment 44, 165–178 (H₂O, O₂ and CO₂ bands)", url: "https://oceancolor.gsfc.nasa.gov/fileshare/bryan_franz/pace_st/members/gao/10_gao_heidebrecht_RSE_surf_refl_1993.pdf" },
  oco2: { cite: "NASA/JPL, Orbiting Carbon Observatory-2: bandas del O₂ (0,76 µm) y del CO₂ (1,61 y 2,06 µm)", citeEn: "NASA/JPL, Orbiting Carbon Observatory-2: O₂ (0.76 µm) and CO₂ (1.61 and 2.06 µm) bands", url: "https://ocov2.jpl.nasa.gov/science/measurement-approach/" },
  stubbs2007: { cite: "Stubbs, High y George (2007): Towards More Precise Survey Photometry for PanSTARRS and LSST (bandas A y B del O₂), arXiv:0708.1364", citeEn: "Stubbs, High and George (2007): Towards More Precise Survey Photometry for PanSTARRS and LSST (O₂ A and B bands), arXiv:0708.1364", url: "https://arxiv.org/abs/0708.1364" },
  kimeswenger2020: { cite: "Kimeswenger, Rainer y Przybilla (2020): Refined Telluric Absorption Correction … in the O₂ A-Band, arXiv:2011.10845", citeEn: "Kimeswenger, Rainer and Przybilla (2020): Refined Telluric Absorption Correction … in the O₂ A-Band, arXiv:2011.10845", url: "https://arxiv.org/abs/2011.10845" },
  cassiniCH4: { cite: "NASA/JPL, Cassini ISS: tres longitudes de onda del metano (619, 727 y 890 nm), imagen de Júpiter", citeEn: "NASA/JPL, Cassini ISS: three methane wavelengths (619, 727 and 890 nm), image of Jupiter", url: "https://www.eurekalert.org/multimedia/693353" },
  karkoschka1994: { cite: "Karkoschka (1994): Spectrophotometry of the Jovian Planets and Titan at 300- to 1000-nm Wavelength: the Methane Spectrum. Icarus 111, 174–192", citeEn: "Karkoschka (1994): Spectrophotometry of the Jovian Planets and Titan at 300- to 1000-nm Wavelength: the Methane Spectrum. Icarus 111, 174–192", url: "https://atmos.nmsu.edu/planetary_datasets/titan_infrared.html" },
  tio: { cite: "Bandas de TiO: Pavlenko et al. (2020), A&A 642, A111 (arXiv:2008.02092), y Gray y Corbally (2009), Stellar Spectral Classification, cap. 6", citeEn: "TiO bands: Pavlenko et al. (2020), A&A 642, A111 (arXiv:2008.02092), and Gray and Corbally (2009), Stellar Spectral Classification, ch. 6", url: "https://arxiv.org/abs/2008.02092" },
  nasaMars: { cite: "NASA NSSDCA, Mars Fact Sheet: CO₂ 95,1 %; presión en superficie 6,36 mb", citeEn: "NASA NSSDCA, Mars Fact Sheet: CO₂ 95.1 %; surface pressure 6.36 mb", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html" },
  nasaVenus: { cite: "NASA NSSDCA, Venus Fact Sheet: CO₂ 96,5 %; presión en superficie 92 bar", citeEn: "NASA NSSDCA, Venus Fact Sheet: CO₂ 96.5 %; surface pressure 92 bar", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html" },
  nasaJupiter: { cite: "NASA NSSDCA, Jupiter Fact Sheet: H₂ 89,8 % y He 10,2 % por volumen", citeEn: "NASA NSSDCA, Jupiter Fact Sheet: H₂ 89.8 % and He 10.2 % by volume", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html" },
  nasaEarth: { cite: "NASA NSSDCA, Earth Fact Sheet: N₂ 78,08 % y O₂ 20,95 % (aire seco)", citeEn: "NASA NSSDCA, Earth Fact Sheet: N₂ 78.08 % and O₂ 20.95 % (dry air)", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html" },
  wien: { cite: "CODATA 2018 (NIST): constante de desplazamiento de Wien, 2,897 771 955 × 10⁻³ m·K", citeEn: "CODATA 2018 (NIST): Wien displacement constant, 2.897 771 955 × 10⁻³ m·K", url: "https://physics.nist.gov/cgi-bin/cuu/Value?bwien" },
  iau2015: { cite: "UAI 2015, resolución B3: temperatura efectiva nominal del Sol, 5.772 K", citeEn: "IAU 2015 Resolution B3: nominal solar effective temperature, 5772 K", url: "https://arxiv.org/abs/1510.07674" },
  webbNasa: { cite: "NASA (25-ago-2022): NASA’s Webb Detects Carbon Dioxide in Exoplanet Atmosphere", citeEn: "NASA (25 Aug 2022): NASA’s Webb Detects Carbon Dioxide in Exoplanet Atmosphere", url: "https://science.nasa.gov/missions/webb/nasas-webb-detects-carbon-dioxide-in-exoplanet-atmosphere/" },
  webbEsa: { cite: "ESA/Webb (25-ago-2022): weic2213, el primer CO₂ indiscutible en un planeta fuera del sistema solar", citeEn: "ESA/Webb (25 Aug 2022): weic2213, the first clear CO₂ detection in a planet outside the Solar System", url: "https://esawebb.org/news/weic2213/" },
  webbNature: { cite: "JWST Transiting Exoplanet Community ERS Team: Identification of carbon dioxide in an exoplanet atmosphere. Nature (2023), doi:10.1038/s41586-022-05269-w (arXiv:2208.11692)", citeEn: "JWST Transiting Exoplanet Community ERS Team: Identification of carbon dioxide in an exoplanet atmosphere. Nature (2023), doi:10.1038/s41586-022-05269-w (arXiv:2208.11692)", url: "https://doi.org/10.1038/s41586-022-05269-w" },
  lovelock: { cite: "Lovelock (1965): el desequilibrio químico de una atmósfera como biofirma; resumido en «Biosignature», Wikipedia", citeEn: "Lovelock (1965): chemical disequilibrium in an atmosphere as a biosignature; summarised in “Biosignature”, Wikipedia", url: "https://en.wikipedia.org/wiki/Biosignature" },
  schwieterman2018: { cite: "Schwieterman et al. (2018): Exoplanet Biosignatures: A Review of Remotely Detectable Signs of Life. Astrobiology 18, 663–708", citeEn: "Schwieterman et al. (2018): Exoplanet Biosignatures: A Review of Remotely Detectable Signs of Life. Astrobiology 18, 663–708", url: "https://doi.org/10.1089/ast.2017.1729" },
  luque2025: { cite: "Luque et al. (2025): Insufficient evidence for DMS and DMDS in the atmosphere of K2-18 b. A&A 700, A284 (arXiv:2505.13407)", citeEn: "Luque et al. (2025): Insufficient evidence for DMS and DMDS in the atmosphere of K2-18 b. A&A 700, A284 (arXiv:2505.13407)", url: "https://arxiv.org/abs/2505.13407" },
};

// ─── Clases espectrales y temperatura ───────────────────────────────────────
export const T_MIN = 2500, T_MAX = 35000;
export const T_SLIDER = { min: 0, max: 100, step: 1 };
/** Deslizador 0–100 → temperatura (escala logarítmica, redondeada a 10 K). */
export const tempFromSlider = (s) => Math.round(T_MIN * Math.pow(T_MAX / T_MIN, Math.min(100, Math.max(0, s)) / 100) / 10) * 10;
export const sliderFromTemp = (T) => Math.round((Math.log(Math.min(T_MAX, Math.max(T_MIN, T)) / T_MIN) / Math.log(T_MAX / T_MIN)) * 100);
export const clampTemp = (T) => Math.min(T_MAX, Math.max(T_MIN, T));

/** Letra de clase O–M de una temperatura (límites en los huecos de la tabla de Pecaut y Mamajek, ver composition.js). */
export function classOfTemp(T) {
  if (T >= 30000) return "O";
  if (T >= 10000) return "B";
  if (T >= 7500) return "A";
  if (T >= 6000) return "F";
  if (T >= 5300) return "G";
  if (T >= 3900) return "K";
  return "M";
}

export const TEMP_PRESETS = [
  { id: "sun", T: SUN_TEFF },     // G2V, 5.772 K (UAI 2015)
  { id: "m", T: 3300 },           // enana roja tipo M
  { id: "b", T: 15000 },          // estrella azul tipo B
];

// Intensidad cualitativa por clase (0–3) de lo que composition.js no trae: criterio propio.
const OWN_STRENGTH = {
  //        O  B  A  F  G  K  M
  cai:    [0, 0, 0, 1, 2, 3, 3],   // Ca I 422,7 nm: crece hacia las estrellas frías
  fe:     [0, 0, 1, 2, 3, 3, 2],   // Fe I: aparece desde A, máxima en G–K, velada por TiO en M
};
const GATE_STRENGTH = { ...STRENGTH, ...OWN_STRENGTH };
const FACTOR = [0, 0.35, 0.65, 1];     // de intensidad cualitativa 0–3 a factor de profundidad

// ─── Especies ───────────────────────────────────────────────────────────────
export const SPECIES_IDS = ["H", "He", "Na", "Ca", "Mg", "Fe", "O2", "H2O", "CO2", "CH4", "TiO"];
export const ATOM_IDS = ["H", "He", "Na", "Ca", "Mg", "Fe"];
export const MOLECULE_IDS = ["O2", "H2O", "CO2", "CH4", "TiO"];

// Energía del nivel inferior de cada línea (cm⁻¹, NIST). Un gas FRÍO solo absorbe desde su estado
// fundamental (o casi): kT a 300 K son ≈ 208 cm⁻¹. Si la línea necesita además un ion (Ca II) o un
// átomo ya excitado (H n = 2, He 2p, Mg 3p…), solo aparece en gas caliente: el de una estrella.
export const COLD_LIMIT_CM1 = 300;
const EI = {
  Ha: 82259.158, Hb: 82259.158, Hg: 82259.158, Hd: 82259.158,
  HeI447: 169086.764, HeI588: 169086.764, HeII469: null,
  NaD2: 0, NaD1: 0,
  CaK: 0, CaH: 0,
  Mgb1: 21870.464, Mgb2: 21870.464, Mgb4: 21870.464,
};
const ION = { CaK: true, CaH: true, HeII469: true };

// Líneas nuevas (NIST, aire): Fe I, Ca I
export const EXTRA_LINES = {
  CaI423: { nm: 422.673, ion: "Ca I", name: "Ca I", group: "cai", gate: "cai", ei: 0, w: 1 },
  Fe386: { nm: 385.991, ion: "Fe I", name: "Fe I", group: "fe", gate: "fe", ei: 0, w: 0.5 },
  Fe405: { nm: 404.581, ion: "Fe I", name: "Fe I", group: "fe", gate: "fe", ei: 11976.239, w: 0.6 },
  Fe431: { nm: 430.790, ion: "Fe I", name: "Fe I", group: "fe", gate: "fe", ei: 12560.934, w: 0.7 },
  Fe438: { nm: 438.354, ion: "Fe I", name: "Fe I", group: "fe", gate: "fe", ei: 11976.239, w: 0.5 },
  Fe467: { nm: 466.813, ion: "Fe I", name: "Fe I", group: "fe", gate: "fe", ei: 26339.696, w: 0.3 },
  Fe496: { nm: 495.760, ion: "Fe I", name: "Fe I", group: "fe", gate: "fe", ei: 22650.416, w: 0.4 },
  Fe517: { nm: 516.890, ion: "Fe I", name: "Fe I", group: "fe", gate: "fe", ei: 415.933, w: 0.4 },
  Fe527: { nm: 527.036, ion: "Fe I", name: "Fe I", group: "fe", gate: "fe", ei: 12968.554, w: 0.55 },
  Fe533: { nm: 532.804, ion: "Fe I", name: "Fe I", group: "fe", gate: "fe", ei: 7376.764, w: 0.4 },
};

// Lectura de una línea de composition.js con sus propiedades de mezcla
const fromComp = (key, w) => {
  const L = LINES[key];
  const group = Object.keys({ Ha: 1, Hb: 1, Hg: 1, Hd: 1 }).includes(key) ? "balmer"
    : key.startsWith("Ca") ? "cahk" : key.startsWith("Na") ? "nad" : key.startsWith("Mgb") ? "mgb"
    : key === "HeII469" ? "heii" : key.startsWith("HeI") ? "hei" : "tio";
  return { key, nm: L.nm, ion: L.ion, name: L.name, band: !!L.band, group, gate: group, ei: EI[key] ?? null, needsIon: !!ION[key], w };
};
const extra = (key) => ({ key, band: false, needsIon: false, ...EXTRA_LINES[key] });

// Bandas moleculares en el visible (cabeza de banda; absorbe hacia el rojo)
const MOL_VIS = {
  O2B: { key: "O2B", nm: 686.719, ion: "O₂", name: "O₂", group: "o2", band: true, mol: true, w: 0.8 },     // Fraunhofer B
  O2a: { key: "O2a", nm: 627.661, ion: "O₂", name: "O₂", group: "o2", band: true, mol: true, w: 0.4 },     // Fraunhofer a
  CH4_619: { key: "CH4_619", nm: 619, ion: "CH₄", name: "CH₄", group: "ch4", band: true, mol: true, w: 0.35 },   // «débil»
  CH4_727: { key: "CH4_727", nm: 727, ion: "CH₄", name: "CH₄", group: "ch4", band: true, mol: true, w: 0.65 },   // «más fuerte»
};
// Bandas en el infrarrojo cercano (700–2.200 nm): centro y semiancho aproximados, en nm
export const NIR_MIN = 700, NIR_MAX = 2200;
const MOL_NIR = {
  O2: [{ nm: 760, half: 6, w: 0.9, ref: "A" }],                                              // 759,37 (cabeza) a 771 nm
  CH4: [{ nm: 890, half: 18, w: 1, ref: "890" }],                                            // «muy fuerte» en Cassini
  H2O: [{ nm: 940, half: 25, w: 0.7 }, { nm: 1140, half: 28, w: 0.6 }, { nm: 1380, half: 45, w: 1 }, { nm: 1880, half: 60, w: 1 }],
  CO2: [{ nm: 1610, half: 20, w: 0.5 }, { nm: 2010, half: 14, w: 0.8 }, { nm: 2060, half: 14, w: 1 }],
};

/** Datos de cada especie: líneas visibles, bandas del infrarrojo cercano y fuentes. */
export const SPECIES = {
  H:   { id: "H",   kind: "atom", sym: "H",   vis: [fromComp("Ha", 1), fromComp("Hb", 0.85), fromComp("Hg", 0.7), fromComp("Hd", 0.6)], nir: [], refs: ["nist"] },
  He:  { id: "He",  kind: "atom", sym: "He",  vis: [fromComp("HeI447", 0.7), fromComp("HeI588", 1), fromComp("HeII469", 0.8)], nir: [], refs: ["nist"] },
  Na:  { id: "Na",  kind: "atom", sym: "Na",  vis: [fromComp("NaD2", 1), fromComp("NaD1", 0.9)], nir: [], refs: ["nist"] },
  Ca:  { id: "Ca",  kind: "atom", sym: "Ca",  vis: [fromComp("CaK", 1), fromComp("CaH", 0.9), extra("CaI423")], nir: [], refs: ["nist"] },
  Mg:  { id: "Mg",  kind: "atom", sym: "Mg",  vis: [fromComp("Mgb1", 0.8), fromComp("Mgb2", 0.8), fromComp("Mgb4", 0.7)], nir: [], refs: ["nist"] },
  Fe:  { id: "Fe",  kind: "atom", sym: "Fe",  vis: Object.keys(EXTRA_LINES).filter(k => k.startsWith("Fe")).map(extra), nir: [], refs: ["nist"] },
  O2:  { id: "O2",  kind: "molecule", sym: "O₂",  vis: [MOL_VIS.O2a, MOL_VIS.O2B], nir: MOL_NIR.O2, refs: ["fraunhofer", "stubbs2007", "kimeswenger2020", "gao1993"] },
  H2O: { id: "H2O", kind: "molecule", sym: "H₂O", vis: [], nir: MOL_NIR.H2O, refs: ["gao1993"] },
  CO2: { id: "CO2", kind: "molecule", sym: "CO₂", vis: [], nir: MOL_NIR.CO2, refs: ["oco2", "gao1993"] },
  CH4: { id: "CH4", kind: "molecule", sym: "CH₄", vis: [MOL_VIS.CH4_619, MOL_VIS.CH4_727], nir: MOL_NIR.CH4, refs: ["cassiniCH4", "karkoschka1994"] },
  TiO: { id: "TiO", kind: "molecule", sym: "TiO", hot: true, vis: ["TiO545", "TiO619", "TiO705"].map(k => fromComp(k, k === "TiO545" ? 0.6 : k === "TiO619" ? 0.8 : 1)), nir: [], refs: ["tio"] },
};
for (const id of SPECIES_IDS) for (const l of SPECIES[id].vis) if (l.group === "tio") l.mol = true;

// ─── Mezcla → espectro ──────────────────────────────────────────────────────
export const MODES = ["star", "planet"];

/**
 * ¿Con qué fuerza (0–1) se ve una línea según dónde esté el gas?
 *  · "star": gas de la superficie de una estrella (caliente). Los átomos dependen de la clase
 *    espectral (composition.js: STRENGTH); las moléculas se rompen por el calor, salvo el TiO
 *    en estrellas frías.
 *  · "planet": gas frío que la luz de la estrella atraviesa. Las moléculas absorben; los átomos
 *    solo si la línea sale del estado fundamental y no necesita ion. El TiO no sobrevive.
 */
export function lineFactor(line, mode, T) {
  if (mode === "planet") {
    if (line.group === "tio") return 0;
    if (line.mol) return 1;
    return line.ei != null && line.ei < COLD_LIMIT_CM1 && !line.needsIon ? 1 : 0;
  }
  if (line.mol && line.group !== "tio") return 0;
  const i = CLASSES.indexOf(classOfTemp(T));
  return FACTOR[GATE_STRENGTH[line.gate][i]] ?? 0;
}

/** Saturación de una línea con la cantidad de gas (0–1): crece deprisa y se aplana. */
export const saturation = (a) => {
  const x = Math.min(1, Math.max(0, a));
  return (1 - Math.exp(-3 * x)) / (1 - Math.exp(-3));
};
const MAX_DEPTH = DEPTH[3];       // 0,62: la línea más fuerte dibujada
export const MIN_VISIBLE = 0.04;  // por debajo, la línea no se dibuja

export const lineDepth = (line, mode, T, amount) => MAX_DEPTH * (line.w ?? 1) * lineFactor(line, mode, T) * saturation(amount);

/** ¿Por qué una especie activa no deja nada? "cold" (hace falta calor), "hot" (se rompe con el calor),
 *  "class" (a esta temperatura esa clase no la muestra), "tio" (el TiO no sobrevive en un planeta). */
export function silentReason(id, mode, T) {
  const sp = SPECIES[id];
  if (mode === "planet") return id === "TiO" ? "tio" : sp.kind === "atom" ? "cold" : null;
  if (sp.kind === "molecule" && id !== "TiO") return "hot";
  return "class";
}

/**
 * Espectro de una mezcla.
 *   mode: "star" | "planet" · T: temperatura de la luz, K · mix: { H: 0.6, … } (cantidad 0–1)
 * Devuelve:
 *   visLines  líneas para <Spectrum lines=…> (nm, depth, name, group, band…), con nombre
 *   nir       bandas del infrarrojo cercano [{ id, nm, half, depth }]
 *   present   ids de las especies que dejan algo visible (en el visible o en el infrarrojo cercano)
 *   silent    [{ id, reason }] activas pero sin huella en estas condiciones
 */
export function buildSpectrum({ mode, T, mix }) {
  const visLines = [], nir = [], present = [], silent = [];
  for (const id of SPECIES_IDS) {
    const amount = mix && mix[id];
    if (!(amount > 0)) continue;
    const sp = SPECIES[id];
    let drew = false;
    for (const l of sp.vis) {
      const depth = lineDepth(l, mode, T, amount);
      if (depth >= MIN_VISIBLE) {
        visLines.push({ key: l.key, group: l.group, nm: l.nm, name: l.name, ion: l.ion, band: l.band, depth, id });
        drew = true;
      }
    }
    // En el infrarrojo cercano solo hay moléculas del gas frío (de un planeta)
    const nirFactor = mode === "planet" && sp.kind === "molecule" && id !== "TiO" ? 1 : 0;
    for (const b of sp.nir) {
      const depth = MAX_DEPTH * 1.25 * b.w * nirFactor * saturation(amount);
      if (depth >= MIN_VISIBLE) { nir.push({ id, nm: b.nm, half: b.half, depth: Math.min(0.9, depth) }); drew = true; }
    }
    if (drew) present.push(id); else silent.push({ id, reason: silentReason(id, mode, T) });
  }
  visLines.sort((a, b) => a.nm - b.nm);
  nir.sort((a, b) => a.nm - b.nm);
  return { visLines, nir, present, silent };
}

/** Curva del infrarrojo cercano: Planck normalizada al máximo del tramo × bandas (gaussianas). */
export function nirCurve(T, bands, step = 4) {
  const pts = [];
  let max = 0;
  for (let nm = NIR_MIN; nm <= NIR_MAX + 1e-9; nm += step) {
    const b = planckRel(nm, T);
    if (b > max) max = b;
    pts.push({ nm, b });
  }
  return pts.map(({ nm, b }) => {
    let f = 1;
    for (const k of bands) { const z = (nm - k.nm) / k.half; f *= 1 - k.depth * Math.exp(-z * z); }
    return { nm, y: max > 0 ? (b / max) * f : 0 };
  });
}

// ─── Atajos de mezcla ───────────────────────────────────────────────────────
export const MIX_PRESETS = [
  { id: "earth",   mode: "planet", T: SUN_TEFF, mix: { O2: 0.6, H2O: 0.5 } },
  { id: "mars",    mode: "planet", T: SUN_TEFF, mix: { CO2: 0.3 } },
  { id: "venus",   mode: "planet", T: SUN_TEFF, mix: { CO2: 1 } },
  { id: "jupiter", mode: "planet", T: SUN_TEFF, mix: { He: 0.6, CH4: 0.6 } },
  { id: "sun",     mode: "star",   T: SUN_TEFF, mix: { H: 0.6, Na: 0.6, Ca: 0.6, Mg: 0.6, Fe: 0.6 } },
];
export const presetById = (id) => MIX_PRESETS.find(p => p.id === id) || null;
/** Especies activas de un atajo, en el orden canónico. */
export const presetSpecies = (p) => SPECIES_IDS.filter(id => p.mix[id] > 0);

export const DEFAULT_AMOUNT = 0.6;
export const DEFAULT_STATE = { mode: "star", T: SUN_TEFF, mix: { H: DEFAULT_AMOUNT, Na: DEFAULT_AMOUNT, Ca: DEFAULT_AMOUNT, Mg: DEFAULT_AMOUNT, Fe: DEFAULT_AMOUNT } };

// ─── Estado ↔ enlace (#preguntas?q=spectrum&m=planet&t=5772&e=O2:0.6,H2O:0.5) ───
export function encodeMix(mix) {
  return SPECIES_IDS.filter(id => mix[id] > 0).map(id => `${id}:${Number(mix[id].toFixed(2))}`).join(",");
}
export function decodeMix(str) {
  if (typeof str !== "string") return null;
  const out = {};
  for (const part of str.split(",")) {
    const [id, v] = part.split(":");
    if (!SPECIES_IDS.includes(id)) continue;
    const x = Number(v);
    if (Number.isFinite(x) && x > 0) out[id] = Math.min(1, x);
  }
  return Object.keys(out).length ? out : null;
}
export function readState(params) {
  const m = params.get("m"), t = Number(params.get("t")), e = decodeMix(params.get("e"));
  return {
    mode: MODES.includes(m) ? m : null,
    T: Number.isFinite(t) && params.get("t") !== null && params.get("t") !== "" ? clampTemp(t) : null,
    mix: e,
  };
}

// ─── Juego: «¿De qué está hecho?» ──────────────────────────────────────────
// Cada reto es la mezcla de un astro real. La respuesta correcta SALE DEL MODELO
// (buildSpectrum → present): si el modelo no dibuja nada de un elemento, ese elemento no cuenta
// como «presente» aunque esté en el astro (p. ej. el helio de Júpiter).
const AMT = 0.7;
export const CHALLENGES = [
  { id: "sun",     mode: "star",   T: SUN_TEFF, mix: { H: AMT, Na: AMT, Ca: AMT, Mg: AMT, Fe: AMT }, refs: ["nist", "iau2015", "fraunhofer"] },
  { id: "m",       mode: "star",   T: 3300,     mix: { TiO: AMT, Na: AMT, Ca: AMT, Mg: AMT, Fe: AMT }, refs: ["tio", "nist"] },
  { id: "a",       mode: "star",   T: 9500,     mix: { H: 1, Ca: AMT }, refs: ["nist", "payne"] },
  { id: "b",       mode: "star",   T: 15000,    mix: { H: AMT, He: AMT }, refs: ["nist", "helium"] },
  { id: "earth",   mode: "planet", T: SUN_TEFF, mix: { O2: 0.6, H2O: 0.5 }, refs: ["nasaEarth", "gao1993", "fraunhofer"] },
  { id: "mars",    mode: "planet", T: SUN_TEFF, mix: { CO2: 0.3 }, refs: ["nasaMars", "oco2", "gao1993"] },
  { id: "jupiter", mode: "planet", T: SUN_TEFF, mix: { He: AMT, CH4: AMT }, refs: ["nasaJupiter", "cassiniCH4", "karkoschka1994"] },
];
export const challengeById = (id) => CHALLENGES.find(c => c.id === id) || null;
export const challengeSpectrum = (c) => buildSpectrum({ mode: c.mode, T: c.T, mix: c.mix });
/** Especies que de verdad dejan huella en el espectro del reto. */
export const truthOf = (c) => challengeSpectrum(c).present;

/**
 * Compara lo marcado con lo que hay. `marked`: Set o lista de ids.
 *   found   presentes y marcados · missed  presentes y sin marcar · extra  marcados sin huella
 *   perfect sin fallos ni sobras · rows  una fila por especie relevante (presente o marcada)
 */
export function evaluate(c, marked) {
  const m = new Set(marked);
  const truth = new Set(truthOf(c));
  const spec = challengeSpectrum(c);
  const found = SPECIES_IDS.filter(id => truth.has(id) && m.has(id));
  const missed = SPECIES_IDS.filter(id => truth.has(id) && !m.has(id));
  const extra = SPECIES_IDS.filter(id => !truth.has(id) && m.has(id));
  const rows = SPECIES_IDS.filter(id => truth.has(id) || m.has(id)).map(id => {
    const inMix = c.mix[id] > 0;
    return {
      id, present: truth.has(id), marked: m.has(id), ok: truth.has(id) === m.has(id),
      // marcado pero sin huella: ¿está en el astro y no se ve, o no está?
      hidden: !truth.has(id) && m.has(id) && inMix,
      silent: spec.silent.find(s => s.id === id) || null,
    };
  });
  return { found, missed, extra, rows, perfect: !missed.length && !extra.length, total: truth.size };
}

// ─── Sobre el sitio donde se descubrió el helio: línea D₃ (He I 587,562 nm, NIST) ───
export const HELIUM_D3_NM = LINES.HeI588.nm;
