// composition.js — «¿De qué está hecho?»: datos y cálculo puros (sin React ni DOM) para la
// ficha de un astro. Lo usan CompositionBlock.jsx, Spectrum.jsx y scripts/test_sky_composition.mjs.
//
// FUENTES (todas comprobadas el 14-nov-2026):
//  · Atmósferas y exosferas: NASA NSSDCA, Planetary Fact Sheets, D. R. Williams
//    (https://nssdc.gsfc.nasa.gov/planetary/factsheet/), una ficha por astro. Porcentajes
//    POR VOLUMEN, tal como los publica la NASA (la de la Tierra es aire seco: sin vapor de agua).
//    Argón y CO₂ de la Tierra vienen en ppm (9.340 y 420): aquí, pasados a %.
//    Mercurio y la Luna no tienen atmósfera sino una exosfera tan tenue que la NASA no da
//    porcentajes comparables (da abundancias en columna o densidades nocturnas estimadas):
//    solo se nombran sus componentes, sin barras.
//  · Fotosfera del Sol, fracciones POR MASA: Asplund, Grevesse, Sauval & Scott (2009),
//    "The chemical composition of the Sun", ARA&A 47, 481 (arXiv:0909.0948), §3.12 y tabla 4:
//    X = 0,7381 (H), Y = 0,2485 (He), Z = 0,0134 (todo lo demás, los «metales»).
//  · Temperatura efectiva del Sol: 5.772 K, valor nominal de la UAI 2015 (Resolución B3);
//    la misma que da la ficha de la NASA. Se importa de starColor.js (T_SUN).
//  · Longitudes de onda de las líneas atómicas: NIST Atomic Spectra Database, longitudes en
//    AIRE (consulta de líneas 380–750 nm de H I, He I, He II, Na I, Mg I y Ca II).
//    Las letras de Fraunhofer son las de la tabla clásica (C = Hα, F = Hβ, G′ = Hγ, h = Hδ,
//    D₁/D₂ = Na, b₁/b₂/b₄ = Mg, H/K = Ca II), que coinciden con NIST.
//  · Bandas de óxido de titanio (TiO, moleculares: NO están en NIST ASD, que es atómica). Solo
//    las tres cabezas de banda que hemos podido verificar:
//      705,4 nm — sistema γ (0,0) y 619,25 nm — sistema γ′ (0,0): Pavlenko et al. (2020),
//        A&A 642, A111 (arXiv:2008.02092);
//      544,8 nm — «TiO 5448»: Gray & Corbally (2009), Stellar Spectral Classification, cap. 6
//        (extracto en NED: ned.ipac.caltech.edu/level5/Gray/Gray26.html).
//  · Constante de Wien b = 2,897771955×10⁶ nm·K y segunda constante de radiación
//    c₂ = hc/k = 1,438776877×10⁷ nm·K: CODATA 2018 (exactas a partir del SI 2019).
//
// Intensidad de las líneas por clase espectral: CUALITATIVA (0 = no se dibuja, 1 = débil,
// 2 = media, 3 = fuerte), según el comportamiento estándar de la clasificación de Morgan–Keenan
// (Balmer máximas en A; Ca II H y K, Na D y Mg b crecen hacia G–K; TiO domina en M; He I en
// O–B con máximo hacia B2; He II solo en O). Es un esquema didáctico, no una medida.

import { T_SUN } from "./starColor.js";

export const WIEN_B = 2.897771955e6;        // nm·K
export const C2 = 1.438776877e7;            // nm·K (hc/k)
export const VIS_MIN = 380, VIS_MAX = 750;  // nm, eje del espectro
export const SUN_TEFF = T_SUN;              // 5772 K

// ───────────────────────── atmósferas (NASA) ─────────────────────────
// gases: [clave, % por volumen]. Las claves de gas tienen nombre en i18n-comp.js (gas).
// note: clave de la frase llamativa (i18n-comp.js, compNote). src: clave de la fuente.
export const ATMOSPHERES = {
  "Mercurio": { kind: "exosphere", species: ["Na", "Mg", "O", "H", "K", "Ca"], note: "mercury", src: "nasaMercury" },
  "Venus":    { kind: "atmosphere", basis: "volume", gases: [["CO2", 96.5], ["N2", 3.5]], note: "venus", src: "nasaVenus" },
  "Tierra":   { kind: "atmosphere", basis: "volume", dry: true, gases: [["N2", 78.08], ["O2", 20.95], ["Ar", 0.934], ["CO2", 0.042]], note: "earth", src: "nasaEarth" },
  "Luna":     { kind: "exosphere", species: ["He", "Ne", "H2", "Ar"], note: "moon", src: "nasaMoon" },
  "Marte":    { kind: "atmosphere", basis: "volume", gases: [["CO2", 95.1], ["N2", 2.59], ["Ar", 1.94], ["O2", 0.16], ["CO", 0.06]], note: "mars", src: "nasaMars" },
  "Júpiter":  { kind: "atmosphere", basis: "volume", gases: [["H2", 89.8], ["He", 10.2]], unc: 2.0, note: "jupiter", src: "nasaJupiter" },
  "Saturno":  { kind: "atmosphere", basis: "volume", gases: [["H2", 96.3], ["He", 3.25]], unc: 2.4, note: "saturn", src: "nasaSaturn" },
  "Urano":    { kind: "atmosphere", basis: "volume", gases: [["H2", 82.5], ["He", 15.2], ["CH4", 2.3]], unc: 3.3, note: "uranus", src: "nasaUranus" },
  "Neptuno":  { kind: "atmosphere", basis: "volume", gases: [["H2", 80.0], ["He", 19.0], ["CH4", 1.5]], unc: 3.2, note: "neptune", src: "nasaNeptune" },
};

// Fotosfera del Sol por masa (Asplund et al. 2009), en %.
export const SUN_MASS = [["H", 73.81], ["He", 24.85], ["Z", 1.34]];

// ───────────────────────── líneas espectrales ─────────────────────────
// nm = longitud de onda en aire (NIST ASD); el valor que se dibuja es el del centro del
// multiplete con la línea más intensa. fr = letra de Fraunhofer, si la tiene.
export const LINES = {
  Ha:   { nm: 656.28,  ion: "H I",   name: "Hα", fr: "C" },
  Hb:   { nm: 486.13,  ion: "H I",   name: "Hβ", fr: "F" },
  Hg:   { nm: 434.05,  ion: "H I",   name: "Hγ", fr: "G′" },
  Hd:   { nm: 410.17,  ion: "H I",   name: "Hδ", fr: "h" },
  CaK:  { nm: 393.37,  ion: "Ca II", name: "Ca II K", fr: "K" },
  CaH:  { nm: 396.85,  ion: "Ca II", name: "Ca II H", fr: "H" },
  NaD2: { nm: 588.995, ion: "Na I",  name: "Na D₂", fr: "D₂" },
  NaD1: { nm: 589.592, ion: "Na I",  name: "Na D₁", fr: "D₁" },
  Mgb1: { nm: 518.36,  ion: "Mg I",  name: "Mg b₁", fr: "b₁" },
  Mgb2: { nm: 517.27,  ion: "Mg I",  name: "Mg b₂", fr: "b₂" },
  Mgb4: { nm: 516.73,  ion: "Mg I",  name: "Mg b₄", fr: "b₄" },
  HeI447: { nm: 447.15, ion: "He I", name: "He I 447" },
  HeI588: { nm: 587.56, ion: "He I", name: "He I 588" },
  HeII469: { nm: 468.57, ion: "He II", name: "He II 469" },
  // cabezas de banda (moleculares): la absorción empieza aquí y se extiende hacia el rojo
  TiO545: { nm: 544.8,  ion: "TiO", name: "TiO 545", band: true },
  TiO619: { nm: 619.25, ion: "TiO", name: "TiO 619", band: true },
  TiO705: { nm: 705.4,  ion: "TiO", name: "TiO 705", band: true },
};

// Grupos que se dibujan juntos y se rotulan una vez (dobletes muy próximos).
export const GROUPS = {
  balmer: ["Ha", "Hb", "Hg", "Hd"],
  cahk: ["CaK", "CaH"],
  nad: ["NaD2", "NaD1"],
  mgb: ["Mgb1", "Mgb2", "Mgb4"],
  hei: ["HeI447", "HeI588"],
  heii: ["HeII469"],
  tio: ["TiO545", "TiO619", "TiO705"],
};

export const CLASSES = ["O", "B", "A", "F", "G", "K", "M"];

// Intensidad cualitativa de cada grupo por clase (0 no se dibuja · 1 débil · 2 media · 3 fuerte).
export const STRENGTH = {
  //        O  B  A  F  G  K  M
  balmer: [1, 2, 3, 2, 1, 1, 0],
  cahk:   [0, 0, 1, 2, 3, 3, 2],
  nad:    [0, 0, 1, 1, 2, 3, 3],
  mgb:    [0, 0, 1, 1, 2, 3, 2],
  hei:    [2, 3, 0, 0, 0, 0, 0],
  heii:   [3, 0, 0, 0, 0, 0, 0],
  tio:    [0, 0, 0, 0, 0, 0, 3],
};

/** Letra de clase O…M a partir de un tipo espectral del catálogo ("M2Ib", "A0m...", "sdB5"…). null si no es O–M. */
export function spectralLetter(spect) {
  const s = String(spect || "").trim();
  const m = /^(?:sd|sg|g|d(?=[OBAFGKM]))?([OBAFGKM])/.exec(s);
  return m ? m[1] : null;
}

// Temperaturas efectivas de cada letra en la secuencia principal (Pecaut & Mamajek 2013, tabla de
// E. Mamajek, versión 2022.04.16: O9.5V 31.900 K … M0V 3.850 K). Sirven para detectar tipos espectrales
// del catálogo que no cuadran con el color (p. ej. Capella figura como «M1: comp» con B−V 0,795).
export const CLASS_TEFF = { O: [31900, 50000], B: [10400, 31400], A: [7400, 9700], F: [5990, 7220], G: [5380, 5930], K: [3930, 5270], M: [2000, 3850] };
/**
 * ¿Es coherente la letra con la temperatura estimada por B−V? Margen amplio (−20 % / +25 %) porque
 * la fórmula de B−V es aproximada y las gigantes son algo más frías que las enanas de su tipo; en O y B
 * basta con que sea caliente (≥ 9.000 K), porque ahí la estimación por color es solo un mínimo.
 */
export function classMatchesTemp(letter, T) {
  const r = CLASS_TEFF[letter];
  if (!r || !(T > 0)) return false;
  if (letter === "O" || letter === "B") return T >= 9000;
  return T >= r[0] * 0.8 && T <= r[1] * 1.25;
}

/** Profundidad (0–1) con que se dibuja una intensidad cualitativa. */
export const DEPTH = [0, 0.18, 0.38, 0.62];

/**
 * Líneas típicas de una clase: [{ key, group, nm, name, ion, fr, band, strength, depth }],
 * ordenadas por longitud de onda. Vacío si la letra no es O–M.
 */
export function linesForClass(letter) {
  const i = CLASSES.indexOf(letter);
  if (i < 0) return [];
  const out = [];
  for (const [group, keys] of Object.entries(GROUPS)) {
    const s = STRENGTH[group][i];
    if (!s) continue;
    for (const key of keys) out.push({ key, group, ...LINES[key], strength: s, depth: DEPTH[s] });
  }
  return out.sort((a, b) => a.nm - b.nm);
}

/** Líneas de Fraunhofer del Sol con su letra (intensidades de una estrella G). */
export function fraunhoferLines() {
  return linesForClass("G").filter((l) => l.fr);
}

// ───────────────────────── cuerpo negro ─────────────────────────
/** Radiancia espectral de Planck SIN constantes delante (∝ λ⁻⁵ / (e^(c₂/λT) − 1)); λ en nm, T en K. */
export function planckRel(nm, T) {
  if (!(nm > 0) || !(T > 0)) return 0;
  const x = C2 / (nm * T);
  if (x > 700) return 0;                      // evita desbordar exp(); el valor real es despreciable
  return 1 / (nm ** 5 * Math.expm1(x));
}

/** Pico de emisión (ley de desplazamiento de Wien), en nm. */
export const wienPeak = (T) => WIEN_B / T;

/** Dónde cae el pico respecto al eje visible: "uv" (más azul que 380 nm), "visible" o "ir" (más rojo que 750). */
export function peakZone(T) {
  const p = wienPeak(T);
  return p < VIS_MIN ? "uv" : p > VIS_MAX ? "ir" : "visible";
}

/**
 * Curva de cuerpo negro muestreada en el eje visible, normalizada a su máximo DENTRO del eje
 * (para que la forma se lea siempre; la escala vertical no es absoluta).
 * Devuelve [{ nm, y }] con y en [0, 1]. Si se pasan líneas, cada una resta una absorción
 * (gaussiana estrecha para líneas atómicas; para bandas, caída brusca en la cabeza y
 * recuperación gradual hacia el rojo).
 */
export function spectrumCurve(T, lines = [], { from = VIS_MIN, to = VIS_MAX, step = 1 } = {}) {
  const pts = [];
  let max = 0;
  for (let nm = from; nm <= to + 1e-9; nm += step) {
    const b = planckRel(nm, T);
    if (b > max) max = b;
    pts.push({ nm, y: b });
  }
  if (!(max > 0)) return pts.map((p) => ({ nm: p.nm, y: 0 }));
  return pts.map(({ nm, y }) => {
    let f = 1;
    for (const l of lines) f *= 1 - absorption(nm, l);
    return { nm, y: (y / max) * f };
  });
}

/** Fracción absorbida (0–1) por una línea o banda a la longitud de onda nm. */
export function absorption(nm, line) {
  const d = line.depth || 0;
  if (!d) return 0;
  if (line.band) {
    const dx = nm - line.nm;
    if (dx < 0) return 0;
    return d * Math.exp(-dx / 14);            // banda degradada al rojo: ~14 nm de cola (esquema)
  }
  const sigma = 1.3;                          // nm: ancho dibujado, exagerado para que se vea
  const dx = (nm - line.nm) / sigma;
  return d * Math.exp(-dx * dx);
}

// ───────────────────────── color del arcoíris ─────────────────────────
/**
 * Color sRGB aproximado de una longitud de onda visible (aproximación por tramos de
 * D. Bruton, 1996; solo PRESENTACIÓN: no es colorimetría). Devuelve "#rrggbb".
 */
export function wavelengthHex(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  // atenuación en los bordes, donde el ojo es poco sensible
  const k = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 700 ? 0.3 + 0.7 * (780 - nm) / 80 : 1;
  const enc = (v) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v * k)), 0.8)).toString(16).padStart(2, "0");
  return "#" + enc(r) + enc(g) + enc(b);
}

// ───────────────────────── qué mostrar para cada objeto ─────────────────────────
/**
 * Plan de la sección para el objeto seleccionado, o null si no lleva sección (Messier,
 * galaxias, púlsares, exoplanetas, sondas, constelaciones…).
 *   { kind: "planet", key, atm }                              planetas y Luna
 *   { kind: "sun", mass, temp, lines }                        el Sol
 *   { kind: "star", mass, temp, lowerBound, letter, lines }   estrellas (temp/letter pueden ser null)
 * `temp` se pasa ya calculada (starColor.starTemperature) para no duplicar la fórmula.
 */
export function compositionPlan(obj, starTemp) {
  if (!obj) return null;
  if (obj.layer === "solar") {
    if (obj.name === "Sol") return { kind: "sun", mass: SUN_MASS, temp: SUN_TEFF, lowerBound: false, letter: "G", lines: fraunhoferLines() };
    const atm = ATMOSPHERES[obj.name];
    return atm ? { kind: "planet", key: obj.name, atm } : null;
  }
  if (obj.layer === "star") {
    const letter = spectralLetter(obj.spect);
    const temp = starTemp && starTemp.temp != null ? starTemp.temp : null;
    // el espectro necesita una temperatura (B−V) Y una clase O–M coherente con ella; si no, solo la composición
    const showSpectrum = temp != null && letter != null && classMatchesTemp(letter, temp);
    return {
      kind: "star", mass: SUN_MASS, temp: showSpectrum ? temp : null, lowerBound: !!(starTemp && starTemp.lowerBound),
      mismatch: temp != null && letter != null && !showSpectrum,
      letter, lines: showSpectrum ? linesForClass(letter) : [],
    };
  }
  return null;
}

/** Suma de porcentajes de una lista [clave, %]. */
export const sumPct = (gases) => gases.reduce((s, [, v]) => s + v, 0);
