// massData.js — física pura, datos, fuentes y textos del recorrido
// "¿Qué pasa si cambio la masa?" (id «mass»). Sin React ni red: todo está
// cubierto por scripts/test_questions_mass.mjs. Fuentes consultadas el
// 14-nov-2026.
//
// DATOS DE CUERPOS (masa y RADIO MEDIO VOLUMÉTRICO)
//  · Planetas, Luna y Plutón: NASA, Planetary Fact Sheet
//    https://nssdc.gsfc.nasa.gov/planetary/factsheet/ (hojas de cada cuerpo).
//    Masa (10²⁴ kg) · radio medio volumétrico (km):
//    Mercurio 0,33010 · 2439,7 | Venus 4,8673 · 6051,8 | Tierra 5,9722 · 6371,000
//    Luna 0,07346 · 1737,4 | Marte 0,64169 · 3389,5 | Júpiter 1898,13 · 69 911
//    Saturno 568,32 · 58 232 | Urano 86,811 · 25 362 | Neptuno 102,409 · 24 622
//    Plutón 0,01303 · 1188.  En los gigantes el radio es el del nivel de 1 bar.
//  · Sol: constantes nominales IAU 2015 B3 (GM☉ y R☉ en constants.js; M☉ = GM☉/G).
//  · Ceres: NASA/JPL Small-Body Database (Park et al. 2016, Nature 537, 515, datos
//    de la sonda Dawn): GM = 62,6284 km³/s² → M = 9,3835 × 10²⁰ kg; diámetro medio
//    939,4 km → R = 469,7 km (densidad 2,162 g/cm³).
//  · Estrella de neutrones: 1,4 M☉ y 12,45 km (rango 12,45 ± 0,65 km para 1,4 M☉:
//    Miller et al. 2021, ApJL 918, L28, NICER; arXiv:2105.06979).
//
// RADIO PARA CUALQUIER MASA (modelo de Teseo, dicho en «Supuestos»)
//  · Por debajo de Ceres: esfera con la densidad de Ceres (R ∝ M^⅓).
//  · De Ceres a Júpiter: recta en escala log–log entre los mundos medidos de la
//    lista ANCHORS (Ceres, Plutón, Luna, Mercurio, Marte, Venus, Tierra, Neptuno,
//    Saturno, Júpiter). Urano no entra: tiene más masa que Neptuno pero es
//    ligeramente más ancho, y la curva exige radio creciente con la masa.
//  · De Júpiter a 0,075 M☉: casi constante (Hatzes y Rauer 2015, ApJL 810, L25:
//    entre 0,3 y 60 MJ la relación masa–densidad es una sola recta sin rasgo que
//    separe planetas de enanas marrones); se une con recta log–log el radio de
//    Júpiter con el de una estrella de 0,075 M☉.
//  · Estrellas: tabla de la secuencia principal de Mamajek («A Modern Mean Dwarf
//    Stellar Color and Effective Temperature Sequence», versión 2022-04-16;
//    Pecaut y Mamajek 2013, ApJS 208, 9): masa, radio y temperatura. Se usan 27
//    filas, de L2V (0,075 M☉) a O3V (59 M☉). Para M = 1 se usan los valores
//    nominales IAU (R☉, 5772 K).
//
// UMBRALES (aproximados; se rotulan así en la interfaz)
//  · Redondez: «potato radius», Lineweaver y Norman 2010 (arXiv:1004.1091): a un
//    radio medio de ~200–300 km, lunas heladas y asteroides rocosos pasan de
//    patata a esfera. Con 200 km y ρ = 1000 kg/m³ (hielo) → 3,4 × 10¹⁹ kg; con
//    300 km y ρ = 3000 kg/m³ (roca) → 3,4 × 10²⁰ kg. Las dos densidades son
//    valores redondos de Teseo.
//  · ~2 M⊕: transición mundos sólidos → neptunianos (Chen y Kipping 2017,
//    ApJ 834, 17: 2,0 +0,7/−0,6 M⊕). Rogers 2015 (ApJ 801, 41): la mayoría de los
//    planetas de 1,6 R⊕ no son rocosos.
//  · 0,3 MJ: inicio de los «planetas gigantes» (Hatzes y Rauer 2015). Saturno
//    (0,2994 MJ) queda justo debajo: por eso son umbrales aproximados y el
//    preajuste de Saturno se rotula «gigante gaseoso» a mano.
//  · 13 MJ: fusión de deuterio (Spiegel, Burrows y Milsom 2011, ApJ 727, 57:
//    13,0 ± 0,8 MJ para quemar la mitad; rango 11,0–16,3 MJ según composición).
//  · 0,075 M☉ (~79 MJ): fusión estable de hidrógeno (teoría, Chabrier y Baraffe
//    2000, ARA&A 38, 337; es la última fila de la tabla de Mamajek, L2V). Medido:
//    Dupuy y Liu 2017, ApJS 231, 15: frontera ≈ 70 MJ a partir de masas dinámicas.
//  · 8 M☉: masa mínima para una supernova de colapso de núcleo (Smartt 2009,
//    ARA&A 47, 63: 8 ± 1 M☉, dependiente del modelo).
import { G, C, GM_SUN, M_SUN_KG, R_SUN, R_EARTH, AU, G0 } from "./constants.js";
import { SIZE_LADDER } from "./bhData.js";
import { sig, sci } from "./format.js";

export const MJ_KG = 1.89813e27;          // NASA: masa de Júpiter
export const M_EARTH_KG = 5.9722e24;      // NASA
export const M_MOON_KG = 7.346e22;        // NASA

// ═══ Física ══════════════════════════════════════════════════════════════════
export const surfaceGravity = (M, R) => (G * M) / (R * R);                       // m/s²
export const escapeVelocity = (M, R) => Math.sqrt((2 * G * M) / R);              // m/s
export const meanDensity = (M, R) => M / ((4 / 3) * Math.PI * R * R * R);        // kg/m³
export const schwarzschildKg = (M) => (2 * G * M) / (C * C);                      // r_s en m
export const weightN = (m, g) => m * g;                                          // N
// «Kilos» que marcaría una báscula de baño (calibrada con la gravedad estándar g₀)
export const scaleKg = (m, g) => (m * g) / G0;
// Período de una luna de masa despreciable (3.ª ley de Kepler): T = 2π √(a³ / (G (M+m)))
export const orbitPeriod = (M, a, m = 0) => 2 * Math.PI * Math.sqrt((a * a * a) / (G * (M + m)));
// Masa que encierra una órbita de semieje a y período T: M = 4π² a³ / (G T²)
export const massFromOrbit = (a, T) => (4 * Math.PI * Math.PI * a * a * a) / (G * T * T);

// ═══ Escala logarítmica del deslizador (log10 de kg) ═════════════════════════
export const MASS_SLIDER = { min: 15, max: Math.log10(60 * M_SUN_KG), step: 0.01 };   // 1e15 kg … 60 M☉
export const DEFAULT_LOGM = Math.log10(M_EARTH_KG);
export const logToMass = (l) => Math.pow(10, l);
export const massToLog = (m) => Math.log10(m);
// Lleva el valor a la rejilla del deslizador (lo que hace el navegador al arrastrar).
export const snapLog = (l) => {
  const k = Math.round((l - MASS_SLIDER.min) / MASS_SLIDER.step);
  return Math.min(MASS_SLIDER.max, Math.max(MASS_SLIDER.min, MASS_SLIDER.min + k * MASS_SLIDER.step));
};
export const tickPct = (kg) => ((massToLog(kg) - MASS_SLIDER.min) / (MASS_SLIDER.max - MASS_SLIDER.min)) * 100;

// ═══ Cuerpos reales (NASA) ═══════════════════════════════════════════════════
// Para la tabla «masa no es peso». Orden de la tabla.
export const WORLDS = [
  { id: "mercury", mass: 0.33010e24, R: 2439.7e3, name: { es: "Mercurio", en: "Mercury" } },
  { id: "venus", mass: 4.8673e24, R: 6051.8e3, name: { es: "Venus", en: "Venus" } },
  { id: "earth", mass: 5.9722e24, R: 6371.0e3, name: { es: "Tierra", en: "Earth" } },
  { id: "moon", mass: 0.07346e24, R: 1737.4e3, name: { es: "Luna", en: "Moon" } },
  { id: "mars", mass: 0.64169e24, R: 3389.5e3, name: { es: "Marte", en: "Mars" } },
  { id: "jupiter", mass: 1898.13e24, R: 69911e3, name: { es: "Júpiter", en: "Jupiter" }, note: "giant" },
  { id: "saturn", mass: 568.32e24, R: 58232e3, name: { es: "Saturno", en: "Saturn" }, note: "giant" },
  { id: "uranus", mass: 86.811e24, R: 25362e3, name: { es: "Urano", en: "Uranus" }, note: "giant" },
  { id: "neptune", mass: 102.409e24, R: 24622e3, name: { es: "Neptuno", en: "Neptune" }, note: "giant" },
  { id: "pluto", mass: 0.01303e24, R: 1188e3, name: { es: "Plutón", en: "Pluto" } },
  { id: "sun", mass: M_SUN_KG, R: R_SUN, name: { es: "Sol", en: "Sun" }, note: "star" },
  { id: "ns", mass: 1.4 * M_SUN_KG, R: 12.45e3, name: { es: "Estrella de neutrones", en: "Neutron star" }, note: "ns" },
];
export const worldGravity = (w) => surfaceGravity(w.mass, w.R);

// Mundos medidos por los que pasa la curva masa → radio (ordenados por masa y por radio).
export const ANCHORS = [
  { id: "ceres", mass: 62.6284e9 / G, R: 469.7e3 },
  { id: "pluto", mass: 0.01303e24, R: 1188e3 },
  { id: "moon", mass: 0.07346e24, R: 1737.4e3 },
  { id: "mercury", mass: 0.33010e24, R: 2439.7e3 },
  { id: "mars", mass: 0.64169e24, R: 3389.5e3 },
  { id: "venus", mass: 4.8673e24, R: 6051.8e3 },
  { id: "earth", mass: 5.9722e24, R: 6371.0e3 },
  { id: "neptune", mass: 102.409e24, R: 24622e3 },
  { id: "saturn", mass: 568.32e24, R: 58232e3 },
  { id: "jupiter", mass: 1898.13e24, R: 69911e3 },
];
const CERES = ANCHORS[0];

// Secuencia principal [masa M☉, radio R☉, T_eff K] — Mamajek (ver arriba).
export const STARS = [
  [0.075, 0.0970, 2060], [0.080, 0.104, 2420], [0.090, 0.120, 2680], [0.102, 0.137, 2810],
  [0.123, 0.156, 2930], [0.162, 0.196, 3060], [0.23, 0.274, 3210], [0.37, 0.361, 3430],
  [0.50, 0.501, 3660], [0.70, 0.701, 4440], [0.82, 0.783, 5100], [0.94, 0.914, 5480],
  [1.00, 1.000, 5772],                                   // Sol: valores nominales IAU 2015
  [1.13, 1.167, 6050], [1.33, 1.473, 6550], [1.61, 1.728, 7220], [2.18, 2.193, 9700],
  [3.38, 2.86, 12300], [5.4, 3.61, 17000], [7.3, 4.06, 20600], [11.8, 5.71, 26000],
  [17.7, 7.16, 31400], [23.6, 8.47, 35100], [35, 10.27, 39500], [48, 12.13, 42900], [59, 13.43, 44900],
];

// Interpolación log–log de una tabla ordenada [[x, y], …]; fuera del rango, prolonga el último tramo.
function logLog(pts, x) {
  let i = 1;
  while (i < pts.length - 1 && x > pts[i][0]) i++;
  const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
  const s = Math.log(y1 / y0) / Math.log(x1 / x0);
  return y0 * Math.pow(x / x0, s);
}
const ANCHOR_PTS = ANCHORS.map(a => [a.mass, a.R]);
const STAR_R_PTS = STARS.map(s => [s[0] * M_SUN_KG, s[1] * R_SUN]);
const M_HBURN = STARS[0][0] * M_SUN_KG;                         // 0,075 M☉

// Radio (m) del cuerpo de masa M (kg). Modelo de Teseo: ver cabecera.
export function radiusM(M) {
  if (!(M > 0)) return NaN;
  if (M <= CERES.mass) return CERES.R * Math.cbrt(M / CERES.mass);
  const jup = ANCHORS[ANCHORS.length - 1];
  if (M <= jup.mass) return logLog(ANCHOR_PTS, M);
  if (M <= M_HBURN) return logLog([[jup.mass, jup.R], [M_HBURN, STAR_R_PTS[0][1]]], M);
  return logLog(STAR_R_PTS, M);
}
// Temperatura de la superficie (K) de una estrella de la secuencia principal; null si no lo es.
export function starTeff(M) {
  if (!(M >= M_HBURN)) return null;
  const ms = M / M_SUN_KG;
  let i = 1;
  while (i < STARS.length - 1 && ms > STARS[i][0]) i++;
  const [m0, , t0] = STARS[i - 1], [m1, , t1] = STARS[i];
  const f = Math.log(ms / m0) / Math.log(m1 / m0);
  return Math.max(1000, t0 + (t1 - t0) * f);
}

// ═══ En qué se convierte ═════════════════════════════════════════════════════
const rho = (r, d) => (4 / 3) * Math.PI * r * r * r * d;
export const THRESHOLDS = {
  roundIce: rho(200e3, 1000),            // ≈ 3,4 × 10¹⁹ kg
  roundRock: rho(300e3, 3000),           // ≈ 3,4 × 10²⁰ kg
  neptunian: 2.0 * M_EARTH_KG,           // Chen y Kipping 2017
  giant: 0.3 * MJ_KG,                    // Hatzes y Rauer 2015
  deuterium: 13 * MJ_KG,                 // Spiegel et al. 2011
  hydrogen: 0.075 * M_SUN_KG,            // teoría; ≈ 79 MJ
  supernova: 8 * M_SUN_KG,               // Smartt 2009
};
export const KINDS = ["irregular", "transition", "round", "neptunian", "giant", "browndwarf", "star", "massive"];
export function classify(M) {
  const t = THRESHOLDS;
  if (M < t.roundIce) return "irregular";
  if (M < t.roundRock) return "transition";
  if (M < t.neptunian) return "round";
  if (M < t.giant) return "neptunian";
  if (M < t.deuterium) return "giant";
  if (M < t.hydrogen) return "browndwarf";
  if (M < t.supernova) return "star";
  return "massive";
}

// Atajos a objetos reales (y tres valores redondos). Saturno: ver cabecera.
export const PRESETS = [
  { id: "asteroid", mass: 1e15, label: { es: "Asteroide", en: "Asteroid" }, real: false },
  { id: "ceres", mass: ANCHORS[0].mass, label: { es: "Ceres", en: "Ceres" }, real: true },
  { id: "moon", mass: M_MOON_KG, label: { es: "Luna", en: "Moon" }, real: true },
  { id: "mercury", mass: 0.33010e24, label: { es: "Mercurio", en: "Mercury" }, real: true },
  { id: "mars", mass: 0.64169e24, label: { es: "Marte", en: "Mars" }, real: true },
  { id: "earth", mass: M_EARTH_KG, label: { es: "Tierra", en: "Earth" }, real: true },
  { id: "neptune", mass: 102.409e24, label: { es: "Neptuno", en: "Neptune" }, real: true },
  { id: "saturn", mass: 568.32e24, label: { es: "Saturno", en: "Saturn" }, real: true, kind: "giant" },
  { id: "jupiter", mass: MJ_KG, label: { es: "Júpiter", en: "Jupiter" }, real: true },
  { id: "mj13", mass: 13 * MJ_KG, label: { es: "13 MJ", en: "13 MJ" }, real: false },
  { id: "mj80", mass: 80 * MJ_KG, label: { es: "80 MJ", en: "80 MJ" }, real: false },
  { id: "sun", mass: M_SUN_KG, label: { es: "Sol", en: "Sun" }, real: true },
  { id: "m20", mass: 20 * M_SUN_KG, label: { es: "20 M☉", en: "20 M☉" }, real: false },
];

// ═══ Texto de la masa ════════════════════════════════════════════════════════
const OF = {
  moon: { es: "de la Luna", en: "the Moon" }, earth: { es: "de la Tierra", en: "Earth" },
  jupiter: { es: "de Júpiter", en: "Jupiter" }, sun: { es: "del Sol", en: "the Sun" },
};
// «3 veces la masa de la Tierra» (también es el aria-valuetext del deslizador).
export function massHuman(kg, lang) {
  const es = lang === "es";
  let unit, ref;
  if (kg < 0.01 * M_MOON_KG) return `${sci(kg, lang, 2)} kg`;
  if (kg < 0.1 * M_EARTH_KG) { unit = "moon"; ref = M_MOON_KG; }
  else if (kg < 0.1 * MJ_KG) { unit = "earth"; ref = M_EARTH_KG; }
  else if (kg < THRESHOLDS.hydrogen) { unit = "jupiter"; ref = MJ_KG; }
  else { unit = "sun"; ref = M_SUN_KG; }
  const k = kg / ref;
  if (Math.abs(k - 1) < 0.005) return es ? `la masa ${OF[unit].es}` : `the mass of ${OF[unit].en}`;
  if (sig(k, lang, 2) === "1") return es ? `casi la masa ${OF[unit].es}` : `about the mass of ${OF[unit].en}`;   // 0,995–1,05: nunca «1 veces»
  return es ? `${sig(k, lang, 2)} veces la masa ${OF[unit].es}` : `${sig(k, lang, 2)} times the mass of ${OF[unit].en}`;
}

// ═══ Escalera de tamaños para el horizonte de un agujero negro ═══════════════
// Lo cotidiano y lo diminuto, además de la escalera de la pregunta de los
// agujeros negros (canica, balón, cancha, ciudad, Tierra…). Los tamaños de
// objetos cotidianos son aproximados; protón: radio de carga 0,8414 fm y átomo
// de hidrógeno: 2 × radio de Bohr (5,29 × 10⁻¹¹ m), ambos CODATA 2018.
export const LADDER = [
  { id: "proton", d: 1.683e-15, approx: false, name: { es: "un protón", en: "a proton" } },
  { id: "atom", d: 1.058e-10, approx: false, name: { es: "un átomo de hidrógeno", en: "a hydrogen atom" } },
  { id: "coin", d: 0.02, approx: true, name: { es: "una moneda", en: "a coin" } },
  ...SIZE_LADDER.filter(o => ["marble", "ball", "pitch", "city", "earth", "sun"].includes(o.id)),
].sort((a, b) => a.d - b.d);
export function nearestLadder(diameter) {
  let best = LADDER[0], bd = Infinity;
  for (const o of LADDER) { const d = Math.abs(Math.log(diameter / o.d)); if (d < bd) { bd = d; best = o; } }
  return { obj: best, ratio: diameter / best.d };
}

// ═══ «Así se pesa un planeta»: cuerpo central y luna (NASA) ══════════════════
// a = semieje mayor (km), T = período sidéreo (días); `known` = masa publicada (kg).
export const WEIGHINGS = [
  { id: "jupiter", a: 421800e3, T: 1.769138 * 86400, known: MJ_KG, name: { es: "Júpiter, con su luna Ío", en: "Jupiter, from its moon Io" }, ref: "nasaJovian" },
  { id: "earth", a: 384400e3, T: 27.3217 * 86400, known: M_EARTH_KG, name: { es: "La Tierra, con la Luna", en: "Earth, from the Moon" }, ref: "nasaFacts" },
  { id: "sun", a: AU, T: 365.256 * 86400, known: M_SUN_KG, name: { es: "El Sol, con la Tierra", en: "The Sun, from Earth" }, ref: "nasaFacts" },
];

// Cociente materia oscura / materia ordinaria (Planck 2018, TT,TE,EE+lowE+lensing):
// Ω_c·h² = 0,1200 y Ω_b·h² = 0,02237 → 5,36.
export const DM_OVER_ORDINARY = 0.1200 / 0.02237;

// Duración de una vuelta en la animación (s): conserva el orden, pero comprime
// siglos y minutos a un rango que se ve. 6 s = la masa de la Tierra a esa distancia.
export const animSeconds = (T, Tref) => Math.min(14, Math.max(1.5, 6 + 1.1 * Math.log10(T / Tref)));

export const ORBIT_DISTANCES = [
  { id: "near", a: 1e8, label: { es: "100.000 km", en: "100,000 km" } },
  { id: "moon", a: 384400e3, label: { es: "384.400 km (Luna)", en: "384,400 km (Moon)" } },
  { id: "au", a: AU, label: { es: "1 ua (Tierra–Sol)", en: "1 au (Earth–Sun)" } },
];
export const DEFAULT_ORBIT = "au";

// Color aproximado de un cuerpo negro (Tanner Helland) → "rgb(r,g,b)"; solo para dibujar.
export function kelvinToRgb(K) {
  const t = Math.min(40000, Math.max(1000, K)) / 100;
  const cl = (v) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [cl(r), cl(g), cl(b)];
}

// ═══ Fuentes ═════════════════════════════════════════════════════════════════
export const MASS_REFS = {
  nasaFacts: { cite: "NASA, Planetary Fact Sheet: masas, radios y gravedades", citeEn: "NASA, Planetary Fact Sheet: masses, radii and gravities", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/" },
  nasaJovian: { cite: "NASA, Jovian Satellite Fact Sheet: la luna Ío", citeEn: "NASA, Jovian Satellite Fact Sheet: the moon Io", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/joviansatfact.html" },
  ceres: { cite: "NASA/JPL, Small-Body Database: Ceres (Park et al. 2016, Nature 537, 515)", citeEn: "NASA/JPL, Small-Body Database: Ceres (Park et al. 2016, Nature 537, 515)", url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=Ceres" },
  codata: { cite: "NIST / CODATA: constante de gravitación G", citeEn: "NIST / CODATA: Newtonian constant of gravitation G", url: "https://physics.nist.gov/cgi-bin/cuu/Value?bg" },
  iau2015: { cite: "IAU (2015), Resolución B3: constantes nominales del Sol y la Tierra", citeEn: "IAU (2015), Resolution B3: nominal solar and terrestrial constants", url: "https://arxiv.org/abs/1510.07674" },
  potato: { cite: "Lineweaver y Norman (2010): «El radio de la patata», cuándo un cuerpo se redondea", citeEn: "Lineweaver & Norman (2010): “The Potato Radius”, when a body turns round", url: "https://arxiv.org/abs/1004.1091" },
  chenKipping: { cite: "Chen y Kipping (2017), ApJ 834, 17: masas y radios de otros mundos", citeEn: "Chen & Kipping (2017), ApJ 834, 17: masses and radii of other worlds", url: "https://arxiv.org/abs/1603.08614" },
  rogers: { cite: "Rogers (2015), ApJ 801, 41: la mayoría de los planetas de 1,6 radios terrestres no son rocosos", citeEn: "Rogers (2015), ApJ 801, 41: most 1.6 Earth-radius planets are not rocky", url: "https://arxiv.org/abs/1407.4457" },
  hatzes: { cite: "Hatzes y Rauer (2015), ApJL 810, L25: planetas gigantes según la relación masa–densidad", citeEn: "Hatzes & Rauer (2015), ApJL 810, L25: giant planets from the mass–density relation", url: "https://arxiv.org/abs/1506.05097" },
  spiegel: { cite: "Spiegel, Burrows y Milsom (2011), ApJ 727, 57: el límite de masa de la fusión de deuterio", citeEn: "Spiegel, Burrows & Milsom (2011), ApJ 727, 57: the deuterium-burning mass limit", url: "https://arxiv.org/abs/1008.5150" },
  chabrier: { cite: "Chabrier y Baraffe (2000), ARA&A 38, 337: teoría de las estrellas de poca masa y los objetos subestelares", citeEn: "Chabrier & Baraffe (2000), ARA&A 38, 337: theory of low-mass stars and substellar objects", url: "https://arxiv.org/abs/astro-ph/0006383" },
  dupuy: { cite: "Dupuy y Liu (2017), ApJS 231, 15: masas dinámicas de enanas ultrafrías (frontera ≈ 70 MJ)", citeEn: "Dupuy & Liu (2017), ApJS 231, 15: dynamical masses of ultracool dwarfs (boundary ≈ 70 MJ)", url: "https://arxiv.org/abs/1703.05775" },
  mamajek: { cite: "Pecaut y Mamajek (2013), ApJS 208, 9, y la tabla de Mamajek (2022): estrellas de la secuencia principal", citeEn: "Pecaut & Mamajek (2013), ApJS 208, 9, and Mamajek’s table (2022): main-sequence stars", url: "https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt" },
  smartt: { cite: "Smartt (2009), ARA&A 47, 63: progenitoras de supernovas de colapso de núcleo (8 ± 1 M☉)", citeEn: "Smartt (2009), ARA&A 47, 63: progenitors of core-collapse supernovae (8 ± 1 M☉)", url: "https://arxiv.org/abs/0908.0700" },
  nicer: { cite: "Miller et al. (2021), ApJL 918, L28: radio de una estrella de neutrones (NICER)", citeEn: "Miller et al. (2021), ApJL 918, L28: the radius of a neutron star (NICER)", url: "https://arxiv.org/abs/2105.06979" },
  planck2018: { cite: "Planck Collaboration (2020), A&A 641, A6: parámetros cosmológicos de Planck 2018", citeEn: "Planck Collaboration (2020), A&A 641, A6: Planck 2018 cosmological parameters", url: "https://arxiv.org/abs/1807.06209" },
};

export const MASS_NEXT = [
  { url: "https://science.nasa.gov/solar-system/planets/", label: { es: "Los planetas del sistema solar (NASA)", en: "The planets of the solar system (NASA)" }, note: { es: "cada mundo, con sus datos y su historia", en: "each world, with its data and story" } },
  { url: "https://exoplanets.nasa.gov/", label: { es: "Exoplanetas (NASA)", en: "Exoplanets (NASA)" }, note: { es: "mundos con masas y radios muy distintos a los nuestros", en: "worlds with masses and radii very unlike ours" } },
  { url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/", label: { es: "Planetary Fact Sheet (NASA)", en: "Planetary Fact Sheet (NASA)" }, note: { es: "las tablas de donde salen los números de la tabla de pesos", en: "the tables behind the weights table" } },
  { url: "https://www.zooniverse.org/projects/hughdickinson/backyard-worlds-planet-9", label: { es: "Backyard Worlds (Zooniverse)", en: "Backyard Worlds (Zooniverse)" }, note: { es: "ciencia ciudadana: busca enanas marrones cercanas", en: "citizen science: hunt for nearby brown dwarfs" } },
];

// ═══ Textos ══════════════════════════════════════════════════════════════════
export const MASS_T = {
  es: {
    title: "¿Qué pasa si cambio la masa?",
    lead: "La masa es cuánta materia hay en algo. No es lo mismo que el peso. Aquí juegas con las dos: llevas tu cuerpo a otros mundos y subes la masa de una roca hasta convertirla en estrella.",
    stepLabel: (n, total) => `Paso ${n} de ${total}`,
    w: {
      title: "Masa no es peso",
      lead: "Tu masa es cuánta materia tienes. También es cuánto cuesta empujarte o frenarte. Tu peso es la fuerza con que un mundo te tira hacia abajo. Pon tu masa y mírala en otros lugares: cambia el peso, no tú.",
      slider: "Tu masa",
      sliderHint: "no se guarda en ningún sitio",
      sliderValue: (k) => `${k} kilogramos`,
      field: "O escribe tu masa (kg)",
      caption: (k) => `Tus ${k} kg en cada lugar`,
      colWorld: "Lugar",
      colWeight: "Tu peso",
      colScale: "Una báscula marcaría",
      same: (k) => `Tu masa es ${k} kg en todos esos lugares. No cambia.`,
      scale: "Una báscula de baño mide una fuerza y la muestra en «kilos» como si estuvieras en la Tierra. Por eso en la Luna marca poco aunque tengas la misma materia.",
      notes: "Para los planetas gigantes se usa el nivel de nubes (1 bar), porque no tienen suelo. En el Sol y en la estrella de neutrones la «superficie» es la capa visible: nadie podría estar ahí, es solo una cuenta.",
      nsNote: "La estrella de neutrones usa 1,4 M☉ y 12,45 km con la gravedad de Newton. Cerca de un objeto tan compacto la relatividad cambia mucho el resultado, así que ese número es solo un orden de magnitud.",
      whySummary: "¿De dónde salen estos números?",
      whyBody: ["g = G·M / R²  (gravedad en la superficie)", "peso = masa × g  (en newtons, N)", "báscula = peso / 9,80665  (kilos)"],
      whyFine: "M y R de cada lugar son de la hoja de datos de la NASA (radio medio). G es la constante de gravitación de CODATA.",
      unitScale: "kg",
      you: "tu masa",
    },
    lab: {
      title: "El laboratorio de masas",
      lead: "Mueve el deslizador desde una roca de unos kilómetros hasta una estrella enorme. Cada vuelta del dedo multiplica la masa por muchísimo. Mira en qué se convierte.",
      slider: "Masa del cuerpo",
      sliderHint: "escala logarítmica: cada tramo multiplica la masa",
      tickAst: "asteroide",
      tickMoon: "Luna",
      tickEarth: "Tierra",
      tickJup: "Júpiter",
      tickSun: "Sol",
      presetsLabel: "Atajos a cuerpos de verdad",
      kindLabel: "En qué se convertiría",
      approx: "Los umbrales son aproximados: dependen de la composición y de cómo se mida.",
      artAria: (kind, r, e) => `Dibujo ilustrativo: ${kind}. Radio ${r}, ${e}.`,
      artEarth: "Tierra",
      artNote: "Dibujo ilustrativo, sin colores reales. Los tamaños van en escala logarítmica; el círculo de rayas es el tamaño de la Tierra.",
      radius: "Radio",
      radiusVs: (k, big) => big ? `${k} veces el de la Tierra` : `${k} del radio de la Tierra`,
      gravity: "Gravedad en la superficie",
      gravityVs: (k) => `${k} veces la de la Tierra`,
      escape: "Velocidad de escape",
      escapeVs: (k) => `${k} veces la de la Tierra (11,2 km/s)`,
      density: "Densidad media",
      densityVs: "El agua pesa 1.000 kg/m³",
      temp: "Temperatura de la superficie",
      tempNote: "estrella de secuencia principal",
      surfaceGiant: "En los gigantes, el nivel de nubes (1 bar).",
      surfaceStar: "En las estrellas, la capa visible: no hay suelo donde pisar.",
      hereTitle: "Tú, en la superficie",
      hereLead: (k) => `Con tus ${k} kg:`,
      hereWeight: "Peso",
      hereScale: "Una báscula marcaría",
      hereBarAria: (ratio) => `Barra de peso en escala logarítmica: ${ratio} veces tu peso en la Tierra.`,
      hereBarEarth: "Tierra",
      hereBarFine: "Escala logarítmica: cada marca multiplica por 10.",
      hereRatio: (k, big) => big ? `${k} veces tu peso en la Tierra` : `${k} de tu peso en la Tierra`,
      hereNoSurface: "Aquí no hay un suelo firme: es solo la cuenta a la altura indicada.",
      bhTitle: "¿Y si la comprimieras hasta ser un agujero negro?",
      bhLead: "Todo cuerpo tiene un tamaño crítico: si toda su masa cupiera dentro de ese radio, ni la luz escaparía. Se llama radio de Schwarzschild: r_s = 2·G·M / c².",
      bhValue: "r_s",
      bhCmp: (obj) => `Su horizonte mediría de lado a lado casi como ${obj}.`,
      bhBigger: (k, obj) => `Su horizonte sería ${k} veces más ancho que ${obj}.`,
      bhSmaller: (k, obj) => `Su horizonte sería ${k} veces más pequeño que ${obj}.`,
      bhApprox: "Los tamaños de la moneda, la canica, el balón, la cancha y la ciudad son aproximados.",
      bhNote: "El Sol no tiene masa suficiente para colapsar así: esto es solo un «¿y si?». Un agujero negro de masa solar existe, pero se forma de una estrella mucho más masiva.",
      bhSame: (obj) => `Su horizonte mediría casi lo mismo que ${obj}.`,
      whySummary: "Las tres fórmulas",
      whyBody: ["g = G·M / R²", "v_escape = √(2·G·M / R)", "r_s = 2·G·M / c²"],
      whyFine: "Gravedad de Newton y agujero negro de Schwarzschild (sin giro ni carga). Para la masa elegida, el radio sale del modelo de «Supuestos».",
      measuredTag: "datos de la NASA",
      estimatedTag: "el radio sale de un modelo",
      kind: {
        irregular: { name: "Roca irregular", what: "asteroide o cometa", blurb: "Su gravedad no basta para vencer la dureza de la roca y del hielo. Conserva la forma de patata que le dejaron los choques." },
        transition: { name: "Zona gris: patata o esfera", what: "depende del material", blurb: "Entre unos 200 km de radio (hielo) y unos 300 km (roca), la propia gravedad empieza a redondear los cuerpos. Depende de cuánta fuerza aguante el material." },
        round: { name: "Mundo redondo", what: "luna, planeta enano o planeta rocoso", blurb: "Su gravedad lo hizo esférico: bajo ese peso, hasta la roca fluye muy despacio hasta quedar redonda (equilibrio hidrostático)." },
        neptunian: { name: "Súper-Tierra, mini-Neptuno o gigante de hielo", what: "como Neptuno o Urano", blurb: "Con más de unas 2 masas de la Tierra, los planetas suelen retener mucho gas y hielo. Casi ninguno de los de 1,6 radios terrestres es rocoso." },
        giant: { name: "Gigante gaseoso", what: "como Saturno o Júpiter", blurb: "Casi todo hidrógeno y helio. Añadir masa casi no lo agranda: entre unas 0,3 y 60 masas de Júpiter el radio se queda cerca del de Júpiter." },
        browndwarf: { name: "Enana marrón", what: "ni planeta ni estrella", blurb: "Funde deuterio durante un tiempo, pero no llega a fundir hidrógeno. Brilla poco y se enfría con los años." },
        star: { name: "Estrella", what: "funde hidrógeno", blurb: "Su centro llega a fundir hidrógeno de forma estable: brilla por su cuenta. La temperatura de su superficie manda sobre su color." },
        massive: { name: "Estrella masiva", what: "acabará en supernova", blurb: "Con unas 8 masas solares o más, lo habitual es que su núcleo colapse en una supernova. Estrellas así, como Betelgeuse, acaban hinchándose antes: aquí solo se dibuja su etapa estable." },
      },
      tagThreshold: "umbral aproximado",
      limitNote: "El deslizador llega a 60 masas solares: la tabla de estrellas con la que se calcula el radio termina en 59.",
    },
    orbit: {
      title: "La masa también se nota desde lejos",
      lead: "Para pesar un planeta no hace falta tocarlo: basta mirar cómo se mueve algo a su alrededor. Pon una luna lejos del cuerpo que elegiste arriba. Con más masa, la gravedad tira más fuerte y la luna da la vuelta más rápido.",
      distLabel: "Distancia de la luna al centro",
      yours: "Tu cuerpo",
      earth: "Con la masa de la Tierra",
      period: (d) => `una vuelta cada ${d}`,
      faster: (k) => `${k} veces más rápido que con la masa de la Tierra.`,
      slower: (k) => `${k} veces más lento que con la masa de la Tierra.`,
      same: "Casi igual que con la masa de la Tierra.",
      inside: "A esta distancia la luna quedaría dentro del cuerpo. Elige una distancia mayor.",
      play: "Animar",
      pause: "Pausar",
      step: "Mover la luna",
      aria: (p, d) => `Una luna orbita a ${d} del cuerpo elegido y da una vuelta cada ${p}.`,
      legendMine: "tu luna",
      legendRef: "luna con la masa de la Tierra",
      notRealTime: "La animación no va en tiempo real: acelera o frena para que se vea, pero conserva el orden de rápido a lento. Los períodos escritos sí son los reales.",
      formulaTitle: "La regla de Kepler",
      formula: "T² = 4π²·a³ / (G·M)",
      formulaWords: "T es lo que tarda en dar una vuelta, a es la distancia y M la masa del centro. Si multiplicas M por 4, T se reduce a la mitad.",
      testMass: "La luna es una masa de prueba: no tiene masa propia ni más fuerzas que la del centro.",
      weighTitle: "Así se pesa un planeta",
      weighTeaser: "Júpiter, con las órbitas de sus lunas.",
      weighLead: "Despejando M de la regla de Kepler: M = 4π²·a³ / (G·T²). Con la distancia y el tiempo de una luna sale la masa del centro.",
      weighRow: (a, T, M, K, pct) => `Distancia ${a}, una vuelta cada ${T}. Resultado: ${M} kg. Valor publicado: ${K} kg (${pct}).`,
      weighFine: "En el caso de la Tierra y el Sol, la cuenta incluye también la masa de la luna, por eso queda un poco más alta.",
    },
    thresholds: {
      title: "Los umbrales, uno a uno",
      teaser: "De dónde sale cada frontera y qué tan firme es.",
      p1: "Todos son aproximados. Cambian con la composición, la edad y la forma de medir.",
      items: [
        ["Se redondea por su gravedad", "Radio medio de unos 200 km (hielo) a 300 km (roca): entre 3 × 10¹⁹ y 3 × 10²⁰ kg, con densidades de 1.000 y 3.000 kg/m³ que supuso Teseo. Lineweaver y Norman (2010)."],
        ["Mundos sólidos → neptunianos", "Hacia 2 masas de la Tierra (2,0 +0,7/−0,6) cambia la relación masa–radio. Chen y Kipping (2017). Rogers (2015): casi ningún planeta de 1,6 radios terrestres es rocoso."],
        ["Gigante gaseoso", "Desde unas 0,3 masas de Júpiter. Hatzes y Rauer (2015). Saturno (0,299) queda justo en el límite."],
        ["Enana marrón: fusiona deuterio", "Unas 13 masas de Júpiter: 13,0 ± 0,8, y entre 11 y 16 según la composición. Spiegel, Burrows y Milsom (2011)."],
        ["Estrella: fusiona hidrógeno", "Teoría: unas 0,075 masas solares (≈ 79 de Júpiter). Chabrier y Baraffe (2000). Medido con órbitas: la frontera ronda las 70 de Júpiter (Dupuy y Liu 2017)."],
        ["Supernova", "Desde unas 8 masas solares (8 ± 1, según el modelo). Smartt (2009)."],
      ],
      tag: "estimated",
    },
    close: {
      title: "¿Y toda la masa del universo?",
      lead: (k) => `Pesaste planetas por cómo se mueven sus lunas. Con las galaxias pasa algo parecido, y el resultado es raro: lo que vemos (estrellas, gas, planetas) es solo una parte. Según el satélite Planck, hay unas ${k} veces más materia oscura que materia ordinaria. No se ve; se nota por su gravedad.`,
      link: "Ver «¿De qué está hecho el universo?»",
    },
    assumptions: {
      title: "Supuestos y límites",
      items: [
        "Masas y radios del sistema solar: hojas de la NASA (radio medio). Ceres: NASA/JPL. Estrella de neutrones: 1,4 M☉ y 12,45 km (NICER).",
        "Radio de cualquier otra masa: debajo de Ceres, la densidad de Ceres; de Ceres a Júpiter, una recta (en escala log–log) por los mundos medidos; entre la Tierra y Neptuno no hay mundos en el sistema solar, así que es una recta entre los dos y los exoplanetas reales se dispersan mucho.",
        "De Júpiter a 0,075 masas solares el radio casi no cambia (Hatzes y Rauer 2015). Para las estrellas se usa la tabla de la secuencia principal de Mamajek, hasta 59 masas solares.",
        "Gravedad de Newton en una esfera sin giro. En las estrellas y en los gigantes, «superficie» es la capa visible o el nivel de 1 bar.",
        "Las estrellas se dibujan en su etapa estable. Las masivas, como Betelgeuse, se hinchan y cambian antes de explotar.",
        "Los umbrales son aproximados (ver «Los umbrales, uno a uno»).",
        "Agujero negro de Schwarzschild: sin giro ni carga. Solo se calcula el tamaño del horizonte.",
        "La luna de la animación es una masa de prueba en órbita circular.",
        "Los dibujos son ilustraciones: los colores no son fotografías.",
      ],
      sourcesTitle: "Fuentes",
    },
    honest: "Las cuentas se hacen en tu teléfono con los datos publicados; ninguna IA interviene en el cálculo. Tu masa no se envía ni se guarda.",
    shareNote: "El enlace guarda el deslizador del laboratorio, no tu masa personal.",
  },
  en: {
    title: "What happens if I change the mass?",
    lead: "Mass is how much stuff is in something. It is not the same as weight. Here you play with both: you take your body to other worlds and raise the mass of a rock until it becomes a star.",
    stepLabel: (n, total) => `Step ${n} of ${total}`,
    w: {
      title: "Mass is not weight",
      lead: "Your mass is how much matter you have. It is also how hard you are to push or to stop. Your weight is the force a world pulls you down with. Enter your mass and see it in other places: the weight changes, you do not.",
      slider: "Your mass",
      sliderHint: "not saved anywhere",
      sliderValue: (k) => `${k} kilograms`,
      field: "Or type your mass (kg)",
      caption: (k) => `Your ${k} kg in each place`,
      colWorld: "Place",
      colWeight: "Your weight",
      colScale: "A scale would read",
      same: (k) => `Your mass is ${k} kg in all of these places. It does not change.`,
      scale: "A bathroom scale measures a force and shows it as “kilos” as if you were on Earth. That is why it reads low on the Moon even though you have the same amount of matter.",
      notes: "For the giant planets the cloud level (1 bar) is used, because they have no ground. For the Sun and the neutron star the “surface” is the visible layer: nobody could stand there, it is only a sum.",
      nsNote: "The neutron star uses 1.4 M☉ and 12.45 km with Newton’s gravity. Near an object that compact, relativity changes the result a lot, so that number is only an order of magnitude.",
      whySummary: "Where do these numbers come from?",
      whyBody: ["g = G·M / R²  (surface gravity)", "weight = mass × g  (in newtons, N)", "scale = weight / 9.80665  (kilos)"],
      whyFine: "Each place’s M and R come from NASA’s fact sheet (mean radius). G is the CODATA gravitational constant.",
      unitScale: "kg",
      you: "your mass",
    },
    lab: {
      title: "The mass lab",
      lead: "Move the slider from a rock a few kilometres wide to an enormous star. Each stretch multiplies the mass by a lot. See what it turns into.",
      slider: "Mass of the body",
      sliderHint: "logarithmic scale: each stretch multiplies the mass",
      tickAst: "asteroid",
      tickMoon: "Moon",
      tickEarth: "Earth",
      tickJup: "Jupiter",
      tickSun: "Sun",
      presetsLabel: "Shortcuts to real bodies",
      kindLabel: "What it would become",
      approx: "The thresholds are approximate: they depend on composition and on how they are measured.",
      artAria: (kind, r, e) => `Illustration: ${kind}. Radius ${r}, ${e}.`,
      artEarth: "Earth",
      artNote: "Illustration, not real colours. Sizes are on a logarithmic scale; the dashed circle is Earth’s size.",
      radius: "Radius",
      radiusVs: (k, big) => big ? `${k} times Earth’s` : `${k} of Earth’s radius`,
      gravity: "Surface gravity",
      gravityVs: (k) => `${k} times Earth’s`,
      escape: "Escape velocity",
      escapeVs: (k) => `${k} times Earth’s (11.2 km/s)`,
      density: "Mean density",
      densityVs: "Water is 1,000 kg/m³",
      temp: "Surface temperature",
      tempNote: "main-sequence star",
      surfaceGiant: "For giants, the cloud level (1 bar).",
      surfaceStar: "For stars, the visible layer: there is no ground to stand on.",
      hereTitle: "You, on the surface",
      hereLead: (k) => `With your ${k} kg:`,
      hereWeight: "Weight",
      hereScale: "A scale would read",
      hereBarAria: (ratio) => `Weight bar on a logarithmic scale: ${ratio} times your weight on Earth.`,
      hereBarEarth: "Earth",
      hereBarFine: "Logarithmic scale: each mark multiplies by 10.",
      hereRatio: (k, big) => big ? `${k} times your weight on Earth` : `${k} of your weight on Earth`,
      hereNoSurface: "There is no solid ground here: it is just the sum at the stated height.",
      bhTitle: "What if you squeezed it into a black hole?",
      bhLead: "Every body has a critical size: if all its mass fitted inside that radius, not even light could escape. It is called the Schwarzschild radius: r_s = 2·G·M / c².",
      bhValue: "r_s",
      bhCmp: (obj) => `Its horizon would be about as wide as ${obj}.`,
      bhBigger: (k, obj) => `Its horizon would be ${k} times wider than ${obj}.`,
      bhSmaller: (k, obj) => `Its horizon would be ${k} times smaller than ${obj}.`,
      bhApprox: "The sizes of the coin, marble, football, pitch and city are approximate.",
      bhNote: "The Sun does not have enough mass to collapse like this: it is only a “what if”. Solar-mass black holes exist, but they form from much more massive stars.",
      bhSame: (obj) => `Its horizon would be almost the same size as ${obj}.`,
      whySummary: "The three formulas",
      whyBody: ["g = G·M / R²", "v_escape = √(2·G·M / R)", "r_s = 2·G·M / c²"],
      whyFine: "Newtonian gravity and a Schwarzschild black hole (no spin, no charge). For the chosen mass, the radius comes from the model in “Assumptions”.",
      measuredTag: "NASA data",
      estimatedTag: "the radius comes from a model",
      kind: {
        irregular: { name: "Irregular rock", what: "asteroid or comet", blurb: "Its gravity is not enough to beat the strength of rock and ice. It keeps the potato shape that impacts left it." },
        transition: { name: "Grey zone: potato or sphere", what: "depends on the material", blurb: "Between about 200 km of radius (ice) and 300 km (rock), a body’s own gravity starts rounding it. It depends on how much force the material can take." },
        round: { name: "Round world", what: "moon, dwarf planet or rocky planet", blurb: "Its gravity made it spherical: under that weight even rock slowly flows until it is round (hydrostatic equilibrium)." },
        neptunian: { name: "Super-Earth, mini-Neptune or ice giant", what: "like Neptune or Uranus", blurb: "Above about 2 Earth masses, planets tend to keep a lot of gas and ice. Almost none of the 1.6-Earth-radius planets is rocky." },
        giant: { name: "Gas giant", what: "like Saturn or Jupiter", blurb: "Mostly hydrogen and helium. Adding mass hardly makes it bigger: between about 0.3 and 60 Jupiter masses the radius stays close to Jupiter’s." },
        browndwarf: { name: "Brown dwarf", what: "neither planet nor star", blurb: "It fuses deuterium for a while, but never reaches hydrogen fusion. It shines faintly and cools with age." },
        star: { name: "Star", what: "fuses hydrogen", blurb: "Its core reaches steady hydrogen fusion: it shines on its own. Its surface temperature decides its colour." },
        massive: { name: "Massive star", what: "will end as a supernova", blurb: "With about 8 solar masses or more, its core usually collapses in a supernova. Stars like that, such as Betelgeuse, swell up first: here only the steady stage is drawn." },
      },
      tagThreshold: "approximate threshold",
      limitNote: "The slider goes up to 60 solar masses: the table of stars used for the radius ends at 59.",
    },
    orbit: {
      title: "Mass shows from far away, too",
      lead: "To weigh a planet you do not need to touch it: just watch how something moves around it. Put a moon far from the body you chose above. With more mass, gravity pulls harder and the moon goes round faster.",
      distLabel: "Distance from the moon to the centre",
      yours: "Your body",
      earth: "With Earth’s mass",
      period: (d) => `one lap every ${d}`,
      faster: (k) => `${k} times faster than with Earth’s mass.`,
      slower: (k) => `${k} times slower than with Earth’s mass.`,
      same: "Almost the same as with Earth’s mass.",
      inside: "At this distance the moon would be inside the body. Pick a larger distance.",
      play: "Play",
      pause: "Pause",
      step: "Move the moon",
      aria: (p, d) => `A moon orbits ${d} from the chosen body and goes round once every ${p}.`,
      legendMine: "your moon",
      legendRef: "moon with Earth’s mass",
      notRealTime: "The animation is not in real time: it speeds up or slows down so you can see it, but it keeps the order from fast to slow. The periods written are the real ones.",
      formulaTitle: "Kepler’s rule",
      formula: "T² = 4π²·a³ / (G·M)",
      formulaWords: "T is how long one lap takes, a is the distance and M is the mass of the centre. If you multiply M by 4, T is halved.",
      testMass: "The moon is a test mass: it has no mass of its own and feels no force but the centre’s.",
      weighTitle: "How a planet is weighed",
      weighTeaser: "Jupiter, from the orbits of its moons.",
      weighLead: "Solving Kepler’s rule for M: M = 4π²·a³ / (G·T²). With a moon’s distance and period you get the mass of the centre.",
      weighRow: (a, T, M, K, pct) => `Distance ${a}, one lap every ${T}. Result: ${M} kg. Published value: ${K} kg (${pct}).`,
      weighFine: "For Earth and the Sun the sum also includes the moon’s mass, which is why it comes out a little higher.",
    },
    thresholds: {
      title: "The thresholds, one by one",
      teaser: "Where each border comes from and how firm it is.",
      p1: "All of them are approximate. They change with composition, age and how they are measured.",
      items: [
        ["Rounded by its own gravity", "Mean radius of about 200 km (ice) to 300 km (rock): between 3 × 10¹⁹ and 3 × 10²⁰ kg, with densities of 1,000 and 3,000 kg/m³ that Teseo assumed. Lineweaver & Norman (2010)."],
        ["Solid worlds → Neptunian worlds", "Around 2 Earth masses (2.0 +0.7/−0.6) the mass–radius relation changes. Chen & Kipping (2017). Rogers (2015): almost no 1.6-Earth-radius planet is rocky."],
        ["Gas giant", "From about 0.3 Jupiter masses. Hatzes & Rauer (2015). Saturn (0.299) sits right at the limit."],
        ["Brown dwarf: fuses deuterium", "About 13 Jupiter masses: 13.0 ± 0.8, and between 11 and 16 depending on composition. Spiegel, Burrows & Milsom (2011)."],
        ["Star: fuses hydrogen", "Theory: about 0.075 solar masses (≈ 79 Jupiter). Chabrier & Baraffe (2000). Measured from orbits: the boundary is around 70 Jupiter (Dupuy & Liu 2017)."],
        ["Supernova", "From about 8 solar masses (8 ± 1, model-dependent). Smartt (2009)."],
      ],
      tag: "estimated",
    },
    close: {
      title: "And all the mass in the universe?",
      lead: (k) => `You weighed planets from how their moons move. Something similar happens with galaxies, and the result is odd: what we see (stars, gas, planets) is only a part. According to the Planck satellite, there is about ${k} times more dark matter than ordinary matter. It cannot be seen; it shows through its gravity.`,
      link: "See “What is the universe made of?”",
    },
    assumptions: {
      title: "Assumptions and limits",
      items: [
        "Solar-system masses and radii: NASA fact sheets (mean radius). Ceres: NASA/JPL. Neutron star: 1.4 M☉ and 12.45 km (NICER).",
        "Radius for any other mass: below Ceres, Ceres’ density; from Ceres to Jupiter, a straight line (log–log) through the measured worlds; there are no solar-system worlds between Earth and Neptune, so it is a line between the two, and real exoplanets scatter widely.",
        "From Jupiter to 0.075 solar masses the radius barely changes (Hatzes & Rauer 2015). For stars the main-sequence table by Mamajek is used, up to 59 solar masses.",
        "Newtonian gravity on a non-spinning sphere. For stars and giants, “surface” is the visible layer or the 1-bar level.",
        "Stars are drawn in their steady stage. Massive ones, such as Betelgeuse, swell up and change before exploding.",
        "The thresholds are approximate (see “The thresholds, one by one”).",
        "Schwarzschild black hole: no spin, no charge. Only the horizon size is computed.",
        "The animation’s moon is a test mass on a circular orbit.",
        "The drawings are illustrations: the colours are not photographs.",
      ],
      sourcesTitle: "Sources",
    },
    honest: "The sums are done on your phone with published data; no AI is involved in the calculation. Your mass is neither sent nor saved.",
    shareNote: "The link stores the lab slider, not your personal mass.",
  },
};
