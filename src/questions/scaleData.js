// scaleData.js — datos, fuentes y cuentas del recorrido «¿Qué tan grande es el universo?».
// Sin React, sin red, sin IA: todo es determinista y está cubierto por scripts/test_q_scale.mjs.
// Los textos viven en scaleText.js; la interfaz, en ScaleTour.jsx.
//
// Cifras verificadas el 16-nov-2026 (fuente primaria entre paréntesis):
//  · Luna: semieje mayor 384 400 km; perigeo y apogeo medios 363 300 y 405 500 km
//    (NASA NSSDCA, Moon Fact Sheet).
//  · Sol: 1 ua = 149 597 870 700 m, exacta (IAU 2012 B2, ver constants.js); la Tierra va de
//    147,095 a 152,100 millones de km del Sol (NASA NSSDCA, Earth Fact Sheet).
//  · Voyager 1: distancia geométrica a la Tierra cada 10 días entre nov-2026 y dic-2028, tabla de
//    vectores de JPL Horizons (objetivo −31, centro 500@399, solución Voyager_1_ST+refit2022_m),
//    consulta del 16-nov-2026. Velocidad respecto al Sol el 16-nov-2026: 16,92 km/s (Horizons).
//    NASA: «el miércoles 18 de noviembre de 2026 a las 2:16:07 a. m. PST la Voyager 1 estará a
//    25 902 millones de km de la Tierra: un día luz»; en el espacio «desde 1977».
//  · Próxima Centauri: paralaje Gaia DR3 768,0665 ± 0,0499 mas (fuente 5853498713190525696,
//    consulta al archivo de Gaia) → 4,2465 años luz.
//  · Sirio: paralaje Hipparcos (nueva reducción, van Leeuwen 2007) 379,21 ± 1,58 mas → 8,60 a. l.
//  · Pléyades (M45): «unos 445 años luz, aunque la cifra no es unánime» (NASA, catálogo Messier del Hubble).
//  · Betelgeuse: 168 (+27 −15) pc (Joyce et al. 2020) → 548 a. l.; otra solución da 222 (+48 −34) pc
//    (Harper et al. 2017) → 724 a. l. Incierta: se dice.
//  · Nebulosa de Orión (cúmulo del Trapecio): 388 ± 5 pc (Kounkel et al. 2017, VLBA) → 1 265 a. l.;
//    antes 414 ± 7 pc (Menten et al. 2007, VLBA) → 1 350 a. l.
//  · Centro galáctico (Sgr A*): R0 = 8 178 ± 13 (est.) ± 22 (sist.) pc (GRAVITY 2019) → 26 670 a. l.
//  · Gran Nube de Magallanes: 49,59 ± 0,09 ± 0,54 kpc (Pietrzyński et al. 2019) → 161 700 a. l.
//  · Andrómeda (M31): 761 ± 11 kpc (Li et al. 2021, cefeidas con el Hubble) → 2,48 millones de a. l.
//  · Cúmulo de Virgo: 16,5 ± 0,1 ± 1,1 Mpc (Mei et al. 2007, ACS Virgo Cluster Survey) → 53,8 M a. l.
//  · GN-z11: z = 10,603 (Bunker et al. 2023, JWST/NIRSpec); antes z = 11,09 (Oesch et al. 2016, Hubble).
//  · Fondo cósmico: z* = 1089,92 ± 0,25 y edad del universo 13,797 ± 0,023 Ga (Planck 2018, tabla 2,
//    columna TT,TE,EE+lowE+lensing); H0 y Ωm, los del resumen (los mismos que usa expansionData.js).
//  · Temperatura del fondo cósmico: 2,72548 ± 0,00057 K (Fixsen 2009); N_eff = 3,046 (valor estándar
//    que usa Planck 2018 para el modelo base).
//  · Horizonte de partículas «unos 46 000 millones de años luz» (Davis y Lineweaver 2004, fig. 1):
//    aquí se recalcula con los parámetros de Planck y debe salir parecido.
import { C, AU, PC, KPC, MPC, LY, YEAR, G, SIGMA_SB } from "./constants.js";
import { PLANCK } from "./expansionData.js";
import { PROXIMA_PARALLAX_MAS, PLANE_MS } from "./timeData.js";
import { num, sig } from "./format.js";

export const SCALE_REFS = {
  nasaMoon: { cite: "NASA NSSDCA: ficha de la Luna (semieje mayor 384 400 km)", citeEn: "NASA NSSDCA: Moon fact sheet (semi-major axis 384,400 km)", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html" },
  nasaEarth: { cite: "NASA NSSDCA: ficha de la Tierra (perihelio y afelio)", citeEn: "NASA NSSDCA: Earth fact sheet (perihelion and aphelion)", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html" },
  nistC: { cite: "NIST: velocidad de la luz, exacta por definición", citeEn: "NIST: speed of light, exact by definition", url: "https://physics.nist.gov/cgi-bin/cuu/Value?c" },
  horizons: { cite: "JPL Horizons: efemérides de la Voyager 1 (−31), consulta del 16-nov-2026", citeEn: "JPL Horizons: Voyager 1 (−31) ephemeris, queried 16 Nov 2026", url: "https://ssd.jpl.nasa.gov/horizons/" },
  nasaVoyager: { cite: "NASA: ¿Dónde están las Voyager 1 y 2? (un día luz el 18-nov-2026)", citeEn: "NASA: Where are Voyager 1 and 2 now? (one light-day on 18 Nov 2026)", url: "https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/" },
  gaiaDr3: { cite: "Gaia Collaboration, Vallenari et al. (2023), A&A 674, A1: Gaia DR3 (paralaje de Próxima Centauri)", citeEn: "Gaia Collaboration, Vallenari et al. (2023), A&A 674, A1: Gaia DR3 (Proxima Centauri parallax)", url: "https://arxiv.org/abs/2208.00211" },
  hipparcos: { cite: "van Leeuwen (2007), A&A 474, 653: nueva reducción de Hipparcos (paralaje de Sirio)", citeEn: "van Leeuwen (2007), A&A 474, 653: new Hipparcos reduction (Sirius parallax)", url: "https://arxiv.org/abs/0708.1752" },
  nasaM45: { cite: "NASA, catálogo Messier del Hubble: M45, las Pléyades", citeEn: "NASA, Hubble Messier catalogue: M45, the Pleiades", url: "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-45/" },
  joyce2020: { cite: "Joyce et al. (2020), ApJ 902, 63: masa y distancia de Betelgeuse", citeEn: "Joyce et al. (2020), ApJ 902, 63: Betelgeuse mass and distance", url: "https://arxiv.org/abs/2006.09837" },
  harper2017: { cite: "Harper et al. (2017): solución astrométrica de Betelgeuse con radio y Hipparcos", citeEn: "Harper et al. (2017): Betelgeuse astrometric solution from radio and Hipparcos", url: "https://arxiv.org/abs/1706.06020" },
  kounkel2017: { cite: "Kounkel et al. (2017), GOBELINS II: distancias a las nubes de Orión con el VLBA", citeEn: "Kounkel et al. (2017), GOBELINS II: VLBA distances to the Orion clouds", url: "https://arxiv.org/abs/1609.04041" },
  menten2007: { cite: "Menten et al. (2007): la distancia a la Nebulosa de Orión (VLBA)", citeEn: "Menten et al. (2007): the distance to the Orion Nebula (VLBA)", url: "https://arxiv.org/abs/0709.0485" },
  gravity2019: { cite: "GRAVITY Collaboration (2019), A&A 625, L10: distancia geométrica al centro galáctico", citeEn: "GRAVITY Collaboration (2019), A&A 625, L10: geometric distance to the Galactic Centre", url: "https://arxiv.org/abs/1904.05721" },
  pietrzynski2019: { cite: "Pietrzyński et al. (2019), Nature: distancia a la Gran Nube de Magallanes con un 1 %", citeEn: "Pietrzyński et al. (2019), Nature: a 1% distance to the Large Magellanic Cloud", url: "https://arxiv.org/abs/1903.08096" },
  li2021: { cite: "Li et al. (2021): distancia a Andrómeda (M31) con cefeidas del Hubble", citeEn: "Li et al. (2021): distance to Andromeda (M31) from Hubble Cepheids", url: "https://arxiv.org/abs/2107.08029" },
  mei2007: { cite: "Mei et al. (2007), ApJ 655, 144: distancias en el cúmulo de Virgo", citeEn: "Mei et al. (2007), ApJ 655, 144: distances in the Virgo Cluster", url: "https://arxiv.org/abs/astro-ph/0702510" },
  oesch2016: { cite: "Oesch et al. (2016): GN-z11 con el Hubble (z ≈ 11,1)", citeEn: "Oesch et al. (2016): GN-z11 with Hubble (z ≈ 11.1)", url: "https://arxiv.org/abs/1603.00461" },
  bunker2023: { cite: "Bunker et al. (2023), A&A 677, A88: GN-z11 con el JWST (z = 10,603)", citeEn: "Bunker et al. (2023), A&A 677, A88: GN-z11 with JWST (z = 10.603)", url: "https://arxiv.org/abs/2302.07256" },
  planck2018: { cite: "Planck Collaboration (2020), A&A 641, A6: parámetros cosmológicos de Planck 2018 (tabla 2)", citeEn: "Planck Collaboration (2020), A&A 641, A6: Planck 2018 cosmological parameters (table 2)", url: "https://arxiv.org/abs/1807.06209" },
  fixsen2009: { cite: "Fixsen (2009), ApJ 707, 916: temperatura del fondo cósmico (2,72548 K)", citeEn: "Fixsen (2009), ApJ 707, 916: temperature of the cosmic background (2.72548 K)", url: "https://arxiv.org/abs/0911.1955" },
  davis2004: { cite: "Davis y Lineweaver (2004): confusiones frecuentes sobre los horizontes y la expansión", citeEn: "Davis & Lineweaver (2004): common misconceptions about horizons and expansion", url: "https://arxiv.org/abs/astro-ph/0310808" },
};

// ═══ Conversión de unidades ══════════════════════════════════════════════════
export const KM = 1000;
export const LIGHT_SECOND_M = C;                       // m
export const LIGHT_DAY_M = C * 86400;                  // 25 902 068 371 km
export const lyFromM = (m) => m / LY;
export const mFromLy = (ly) => ly * LY;
export const lyFromPc = (pc) => (pc * PC) / LY;        // 1 pc = 3,26156 a. l.
export const lyFromParallaxMas = (mas) => lyFromPc(1000 / mas);
// Tiempo de viaje de la luz en el espacio quieto: distancia ÷ c (en segundos)
export const lightSeconds = (m) => m / C;

// ═══ Cosmología: ΛCDM plano con radiación ═══════════════════════════════════
// Parámetros: H0 y Ωm de Planck 2018 (expansionData.js). La radiación (fotones + 3 neutrinos sin
// masa) sale de la temperatura del fondo cósmico: ρ_γ = 4σT⁴/c³ y Ω_r = Ω_γ·(1 + 0,2271·N_eff).
// ΩΛ = 1 − Ωm − Ωr (universo plano).
export const T_CMB = 2.72548;          // K (Fixsen 2009)
export const N_EFF = 3.046;
export const Z_GNZ11 = 10.603;         // Bunker et al. 2023
export const Z_GNZ11_HST = 11.09;      // Oesch et al. 2016
export const Z_CMB = 1089.92;          // Planck 2018, z*
export const PLANCK_AGE = { gyr: 13.797, err: 0.023 };   // Planck 2018, tabla 2

export function cosmology(H0 = PLANCK.H0, Om = PLANCK.Om) {
  const H0s = (H0 * 1000) / MPC;                              // 1/s
  const rhoCrit = (3 * H0s * H0s) / (8 * Math.PI * G);        // kg/m³
  const Og = ((4 * SIGMA_SB * T_CMB ** 4) / C ** 3) / rhoCrit;
  const Or = Og * (1 + 0.2271 * N_EFF);
  return { H0, H0s, Om, Or, Og, OL: 1 - Om - Or };
}
export const COSMO = cosmology();

// ∫ f(a) da entre a0 y a1 con a = u² (el integrando queda suave cerca de a = 0). Regla de Simpson.
function integrateA(f, a0, a1, n = 2000) {
  const U0 = Math.sqrt(a0), U1 = Math.sqrt(a1), h = (U1 - U0) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const u = U0 + i * h;
    s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * f(u * u) * 2 * u;
  }
  return (s * h) / 3;
}
// a²·E(a) = √(Ωr + Ωm·a + ΩΛ·a⁴), con E = H/H0
const a2E = (a, p) => Math.sqrt(p.Or + p.Om * a + p.OL * a ** 4);
const aOf = (z) => 1 / (1 + z);

// Distancia comóvil HOY (= distancia propia actual) a un objeto con corrimiento al rojo z, en años luz:
//   D = c/H0 · ∫_a^1 da / (a²·E)
export function comovingLy(z, p = COSMO) {
  if (!(z > 0)) return 0;
  return lyFromM((C / p.H0s) * integrateA((a) => 1 / a2E(a, p), aOf(z), 1));
}
// Tiempo de viaje de la luz (lookback time) en años:  t = 1/H0 · ∫_a^1 da / (a·E) = 1/H0 · ∫ a da / (a²E)
export function lookbackYears(z, p = COSMO) {
  if (!(z > 0)) return 0;
  return integrateA((a) => a / a2E(a, p), aOf(z), 1) / p.H0s / YEAR;
}
// Edad del universo hoy, en años
export const ageYears = (p = COSMO) => integrateA((a) => a / a2E(a, p), 0, 1, 4000) / p.H0s / YEAR;
// Edad del universo cuando salió la luz que hoy vemos con corrimiento z
export const ageAtYears = (z, p = COSMO) => integrateA((a) => a / a2E(a, p), 0, aOf(z), 4000) / p.H0s / YEAR;
// Horizonte de partículas: lo más lejos de donde pudo llegarnos algo desde el Big Bang (z → ∞)
export const horizonLy = (p = COSMO) => lyFromM((C / p.H0s) * integrateA((a) => 1 / a2E(a, p), 0, 1, 4000));
// Distancia a la que estaba el objeto cuando salió la luz: D·a
export const thenLy = (z, p = COSMO) => comovingLy(z, p) / (1 + z);
// Velocidad a la que hoy se aleja ese lugar por la expansión (ley de Hubble), en unidades de c
export const recessionC = (z, p = COSMO) => (p.H0s * mFromLy(comovingLy(z, p))) / C;
// z cuya distancia comóvil es D (años luz); bisección en log(1+z)
export function zForLy(ly, p = COSMO) {
  if (!(ly > 0)) return 0;
  let lo = 0, hi = Math.log(1 + 1e4);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (comovingLy(Math.expm1(mid), p) < ly) lo = mid; else hi = mid;
  }
  return Math.expm1((lo + hi) / 2);
}

// ═══ Voyager 1 ═══════════════════════════════════════════════════════════════
// Distancia geométrica Tierra–Voyager 1 (ua), cada 10 días, JPL Horizons (consulta del 16-nov-2026).
export const VOYAGER_TABLE = [
  ["2026-11-01", 172.8556], ["2026-11-11", 173.0294], ["2026-11-21", 173.1816], ["2026-12-01", 173.3105],
  ["2026-12-11", 173.4150], ["2026-12-21", 173.4948], ["2026-12-31", 173.5503], ["2027-01-10", 173.5827],
  ["2027-01-20", 173.5942], ["2027-01-30", 173.5873], ["2027-02-09", 173.5653], ["2027-02-19", 173.5319],
  ["2027-03-01", 173.4912], ["2027-03-11", 173.4473], ["2027-03-21", 173.4046], ["2027-03-31", 173.3672],
  ["2027-04-10", 173.3391], ["2027-04-20", 173.3241], ["2027-04-30", 173.3251], ["2027-05-10", 173.3449],
  ["2027-05-20", 173.3857], ["2027-05-30", 173.4489], ["2027-06-09", 173.5355], ["2027-06-19", 173.6456],
  ["2027-06-29", 173.7787], ["2027-07-09", 173.9339], ["2027-07-19", 174.1095], ["2027-07-29", 174.3033],
  ["2027-08-08", 174.5126], ["2027-08-18", 174.7342], ["2027-08-28", 174.9647], ["2027-09-07", 175.2004],
  ["2027-09-17", 175.4372], ["2027-09-27", 175.6711], ["2027-10-07", 175.8981], ["2027-10-17", 176.1144],
  ["2027-10-27", 176.3163], ["2027-11-06", 176.5007], ["2027-11-16", 176.6647], ["2027-11-26", 176.8063],
  ["2027-12-06", 176.9239], ["2027-12-16", 177.0168], ["2027-12-26", 177.0852], ["2028-01-05", 177.1298],
  ["2028-01-15", 177.1521], ["2028-01-25", 177.1547], ["2028-02-04", 177.1403], ["2028-02-14", 177.1125],
  ["2028-02-24", 177.0752], ["2028-03-05", 177.0324], ["2028-03-15", 176.9886], ["2028-03-25", 176.9479],
  ["2028-04-04", 176.9143], ["2028-04-14", 176.8919], ["2028-04-24", 176.8839], ["2028-05-04", 176.8934],
  ["2028-05-14", 176.9228], ["2028-05-24", 176.9738], ["2028-06-03", 177.0478], ["2028-06-13", 177.1453],
  ["2028-06-23", 177.2661], ["2028-07-03", 177.4097], ["2028-07-13", 177.5745], ["2028-07-23", 177.7588],
  ["2028-08-02", 177.9602], ["2028-08-12", 178.1755], ["2028-08-22", 178.4018], ["2028-09-01", 178.6351],
  ["2028-09-11", 178.8717], ["2028-09-21", 179.1077], ["2028-10-01", 179.3388], ["2028-10-11", 179.5613],
  ["2028-10-21", 179.7713], ["2028-10-31", 179.9654], ["2028-11-10", 180.1406], ["2028-11-20", 180.2944],
  ["2028-11-30", 180.4249], ["2028-12-10", 180.5310], ["2028-12-20", 180.6125], ["2028-12-30", 180.6695]
];
export const VOYAGER_SPEED_MS = 16.92e3;                 // respecto al Sol, 16-nov-2026 (Horizons)
export const VOYAGER_LAUNCH_YEAR = 1977;                 // NASA
export const VOYAGER_LIGHT_DAY_UTC = "2026-11-18T10:16:07Z";   // NASA: 18-nov-2026, 2:16:07 a. m. PST
const dayMs = (iso) => Date.parse(`${iso}T00:00:00Z`);

// Distancia de la Voyager 1 en una fecha: interpolación lineal en la tabla. Fuera de la tabla no se
// inventa nada: se devuelve el extremo más cercano con su fecha (inRange = false).
export function voyagerAt(date = new Date()) {
  const t = date instanceof Date ? date.getTime() : Number(date);
  const T = VOYAGER_TABLE;
  if (!Number.isFinite(t) || t <= dayMs(T[0][0])) return { au: T[0][1], date: T[0][0], inRange: t === dayMs(T[0][0]) };
  const last = T[T.length - 1];
  if (t >= dayMs(last[0])) return { au: last[1], date: last[0], inRange: t === dayMs(last[0]) };
  let i = 0;
  while (dayMs(T[i + 1][0]) < t) i++;
  const t0 = dayMs(T[i][0]), t1 = dayMs(T[i + 1][0]);
  const f = (t - t0) / (t1 - t0);
  return { au: T[i][1] + f * (T[i + 1][1] - T[i][1]), date: new Date(t).toISOString().slice(0, 10), inRange: true };
}
export const voyagerLy = (date) => lyFromM(voyagerAt(date).au * AU);

// ═══ Los objetos de la regla ════════════════════════════════════════════════
// ly: distancia HOY en años luz. Para todo lo que está dentro de unos cientos de millones de años luz,
// esa cifra es también el tiempo de viaje de la luz (la expansión apenas cuenta: ver test). Para GN-z11
// y el fondo cósmico, la distancia de hoy y el tiempo de viaje de la luz son números distintos.
// cat: color en la regla. level: etiqueta de certeza de la DISTANCIA.
const MOON_KM = 384400, MOON_PERIGEE_KM = 363300, MOON_APOGEE_KM = 405500;
const SUN_PERI_KM = 147.095e6, SUN_APH_KM = 152.100e6;
export const SIRIUS_PARALLAX_MAS = 379.21;
export const PLEIADES_LY = 445;
export const BETELGEUSE_PC = { val: 168, plus: 27, minus: 15, other: 222 };
export const ORION_PC = { val: 388, err: 5, other: 414 };
export const GC_PC = 8178;
export const LMC_KPC = 49.59;
export const M31_KPC = 761;
export const VIRGO_MPC = 16.5;

export const OBJECTS = [
  { id: "moon", cat: "near", level: "measured", ly: lyFromM(MOON_KM * KM), range: [lyFromM(MOON_PERIGEE_KM * KM), lyFromM(MOON_APOGEE_KM * KM)], refs: ["nasaMoon", "nistC"] },
  { id: "sun", cat: "near", level: "measured", ly: lyFromM(AU), range: [lyFromM(SUN_PERI_KM * KM), lyFromM(SUN_APH_KM * KM)], refs: ["nasaEarth", "nistC"] },
  { id: "voyager", cat: "human", level: "measured", ly: null, refs: ["horizons", "nasaVoyager"] },
  { id: "proxima", cat: "star", level: "measured", ly: lyFromParallaxMas(PROXIMA_PARALLAX_MAS), refs: ["gaiaDr3"] },
  { id: "sirius", cat: "star", level: "measured", ly: lyFromParallaxMas(SIRIUS_PARALLAX_MAS), refs: ["hipparcos"] },
  { id: "pleiades", cat: "star", level: "estimated", ly: PLEIADES_LY, refs: ["nasaM45"] },
  { id: "betelgeuse", cat: "star", level: "estimated", ly: lyFromPc(BETELGEUSE_PC.val),
    range: [lyFromPc(BETELGEUSE_PC.val - BETELGEUSE_PC.minus), lyFromPc(BETELGEUSE_PC.val + BETELGEUSE_PC.plus)], other: lyFromPc(BETELGEUSE_PC.other), refs: ["joyce2020", "harper2017"] },
  { id: "orion", cat: "neb", level: "measured", ly: lyFromPc(ORION_PC.val), other: lyFromPc(ORION_PC.other), refs: ["kounkel2017", "menten2007"] },
  { id: "gc", cat: "neb", level: "measured", ly: lyFromPc(GC_PC), refs: ["gravity2019"] },
  { id: "lmc", cat: "gal", level: "measured", ly: lyFromPc(LMC_KPC * 1000), refs: ["pietrzynski2019"] },
  { id: "m31", cat: "gal", level: "measured", ly: lyFromPc(M31_KPC * 1000), refs: ["li2021"] },
  { id: "virgo", cat: "gal", level: "measured", ly: lyFromPc(VIRGO_MPC * 1e6), refs: ["mei2007"] },
  { id: "gnz11", cat: "cosmos", level: "estimated", z: Z_GNZ11, ly: comovingLy(Z_GNZ11), lookback: lookbackYears(Z_GNZ11), refs: ["bunker2023", "planck2018"] },
  { id: "cmb", cat: "cosmos", level: "estimated", z: Z_CMB, ly: comovingLy(Z_CMB), lookback: lookbackYears(Z_CMB), refs: ["planck2018", "fixsen2009"] },
];
export const OBJECT_IDS = OBJECTS.map(o => o.id);
export const CAT_COLOR = { near: "#9FD0FF", human: "#F2C46D", star: "#FFFFFF", neb: "#67E8C8", gal: "#FF9D5C", cosmos: "#C9B8FF" };

// Objetos con la distancia de la Voyager 1 en la fecha dada
export function rulerObjects(date = new Date()) {
  return OBJECTS.map(o => (o.id === "voyager" ? { ...o, ly: voyagerLy(date) } : o));
}
// Tiempo que tarda la luz en llegar, en segundos. Para lo cosmológico, el tiempo de viaje real.
export const lightTimeSec = (o) => (o.lookback != null ? o.lookback * YEAR : o.ly * YEAR);

// Regla logarítmica: posición (0–1) de una distancia en años luz.
export const LOG_MIN = -8;      // 10⁻⁸ a. l. ≈ 0,3 segundos luz
export const LOG_MAX = 11;      // 10¹¹ a. l.
export const rulerPos = (ly) => (Math.log10(ly) - LOG_MIN) / (LOG_MAX - LOG_MIN);
export const RULER_TICKS = [
  { id: "s", ly: 1 / YEAR }, { id: "h", ly: 3600 / YEAR }, { id: "y", ly: 1 },
  { id: "k", ly: 1e3 }, { id: "m", ly: 1e6 }, { id: "g", ly: 1e9 },
];
// Del valor del deslizador (0–1000, lineal sobre la regla) al objeto más cercano en la regla
export const RULER_STEPS = 1000;
export function nearestObject(objs, v) {
  let best = 0, bd = Infinity;
  objs.forEach((o, i) => { const d = Math.abs(rulerPos(o.ly) * RULER_STEPS - v); if (d < bd) { bd = d; best = i; } });
  return best;
}

// ═══ Viajes: luz, Voyager 1, avión y auto ═══════════════════════════════════
export const CAR_MS = 100 / 3.6;          // 100 km/h, supuesto
export const SPEEDS = [
  { id: "light", ms: C },
  { id: "voyager", ms: VOYAGER_SPEED_MS },
  { id: "plane", ms: PLANE_MS },           // ≈ 900 km/h (timeData.js)
  { id: "car", ms: CAR_MS },
];
export const TRIP_IDS = ["moon", "sun", "proxima", "gc", "m31"];
export const travelSeconds = (ly, ms) => mFromLy(ly) / ms;
// Eje de las barras de viaje: de 1 s a 10²² s (≈ 3 × 10¹⁴ años), en log10 de segundos
export const TRIP_AXIS = [0, 22];
export const tripPos = (sec) => Math.min(1, Math.max(0, (Math.log10(Math.max(sec, 1)) - TRIP_AXIS[0]) / (TRIP_AXIS[1] - TRIP_AXIS[0])));
export const TRIP_MARKS = [
  { id: "day", sec: 86400 }, { id: "year", sec: YEAR }, { id: "my", sec: 1e6 * YEAR }, { id: "universe", sec: PLANCK_AGE.gyr * 1e9 * YEAR },
];

// ═══ Juego: ¿cuánto tarda la luz? ════════════════════════════════════════════
// Opciones en segundos. Solo una es la respuesta (la calculada); las demás son señuelos redondos.
export function quizRounds(date = new Date()) {
  const objs = Object.fromEntries(rulerObjects(date).map(o => [o.id, o]));
  const lt = (id) => lightTimeSec(objs[id]);
  return [
    { id: "moon", options: [lt("moon"), 60, 3600], answer: 0 },
    { id: "sun", options: [8, lt("sun"), 8 * 3600], answer: 1 },
    { id: "voyager", options: [23 * 60, YEAR, lt("voyager")], answer: 2 },
    { id: "proxima", options: [4.25 * 86400, lt("proxima"), 425 * YEAR], answer: 1 },
    { id: "m31", options: [lt("m31"), 2500 * YEAR, 2.5e9 * YEAR], answer: 0 },
  ];
}

// ═══ Paso 4: deslizador de corrimiento al rojo ══════════════════════════════
// Posición 0–1000, lineal en log10(z), de z = 0,001 (unos 14 millones de años luz) al fondo cósmico.
// El estado guarda z exacto (los atajos caen justo en su valor); el deslizador solo lo aproxima.
export const Z_STEPS = 1000;
export const Z_MIN = 0.001;
const LZ0 = Math.log10(Z_MIN), LZ1 = Math.log10(Z_CMB);
export const zFromStep = (s) => Math.pow(10, LZ0 + (Math.min(Z_STEPS, Math.max(0, s)) / Z_STEPS) * (LZ1 - LZ0));
export const stepFromZ = (z) => Math.round(((Math.log10(Math.min(Z_CMB, Math.max(Z_MIN, z))) - LZ0) / (LZ1 - LZ0)) * Z_STEPS);
export const Z_PRESETS = [
  { id: "virgo", z: zForLy(lyFromPc(VIRGO_MPC * 1e6)) },
  { id: "gnz11", z: Z_GNZ11 },
  { id: "cmb", z: Z_CMB },
];
// Las tres cifras del paso 4 para un z dado
export function farView(z, p = COSMO) {
  return { z, lookback: lookbackYears(z, p), ageThen: ageAtYears(z, p), now: comovingLy(z, p), then: thenLy(z, p), v: recessionC(z, p) };
}

// ═══ Formato ═════════════════════════════════════════════════════════════════
const r3 = (x) => Number(x.toPrecision(3));
const esDe = (s) => (/(millón|millones|billón|billones)$/.test(s) ? `${s} de` : s);
// Número grande con 3 cifras: 2,48 millones · 31.800 millones (es) / 31.8 billion (en)
export function bigNum(x, lang) {
  const es = lang === "es";
  if (x < 1e6) return num(r3(x), lang, x < 10 ? 2 : x < 100 ? 1 : 0);
  if (x < 1e9 || (es && x < 1e12)) { const m = r3(x / 1e6); return es ? `${num(m, lang, m < 10 ? 2 : m < 100 ? 1 : 0)} ${m === 1 ? "millón" : "millones"}` : `${num(m, lang, m < 10 ? 2 : 1)} million`; }
  if (x < 1e12) return `${num(r3(x / 1e9), lang, 2)} billion`;
  const b = r3(x / 1e12);
  return es ? `${num(b, lang, b < 10 ? 2 : 1)} ${b === 1 ? "billón" : "billones"}` : `${num(b, lang, b < 10 ? 2 : 1)} trillion`;
}
// Distancia: en km para el sistema solar, en años luz más allá
export function distText(ly, lang) {
  const es = lang === "es";
  if (!(ly > 0)) return "—";
  if (ly < 0.01) {
    const km = mFromLy(ly) / KM;
    if (km < 1e6) return `${num(Math.round(km / 100) * 100, lang)} km`;
    // 4 cifras: «149,6 millones de km», «25.900 millones de km»
    const big4 = es || km < 1e9 ? km / 1e6 : km / 1e9;
    const v = num(Number(big4.toPrecision(4)), lang, big4 < 1000 ? 1 : 0);
    return es ? `${v} millones de km` : `${v} ${km < 1e9 ? "million" : "billion"} km`;
  }
  const b = ly < 10 ? sig(ly, lang, 3) : bigNum(ly, lang);
  return es ? `${esDe(b)} ${ly >= 0.995 && ly < 1.005 ? "año luz" : "años luz"}` : `${b} ${ly >= 0.995 && ly < 1.005 ? "light-year" : "light-years"}`;
}
// Duración: segundos → «1,28 s», «8 min 19 s», «23 h 58 min», «160 días», «4,25 años», «2,48 millones de años»
export function timeText(sec, lang) {
  const es = lang === "es";
  if (!Number.isFinite(sec) || sec < 0) return "—";
  if (sec < 59.95) return `${sig(sec, lang, sec < 10 ? 3 : 2)} s`;
  if (sec < 3599.5) { const t = Math.round(sec); const m = Math.floor(t / 60), r = t % 60; return r ? `${m} min ${r} s` : `${m} min`; }
  // Minutos truncados (no redondeados): 23 h 59,6 min se lee «23 h 59 min», no «24 h»
  if (sec < 2 * 86400) { const t = Math.floor(sec / 60); const h = Math.floor(t / 60), r = t % 60; return r ? `${h} h ${r} min` : `${h} h`; }
  if (sec < YEAR) { const d = Math.round(sec / 86400); return `${num(d, lang)} ${es ? "días" : "days"}`; }
  const y = sec / YEAR;
  const b = y < 10 ? sig(y, lang, 3) : bigNum(y, lang);
  const one = y >= 0.995 && y < 1.005;
  return es ? `${esDe(b)} ${one ? "año" : "años"}` : `${b} ${one ? "year" : "years"}`;
}
// «Miles de millones» con una cifra decimal para el paso 4: 31,8 / 13,4
export const gText = (x, lang) => num(Math.round(x / 1e8) / 10, lang, 1);
// Año en que salió la luz que te llega hoy (solo para menos de 3 000 años). Con más de 100 años de
// viaje se redondea a la decena: la distancia no se conoce al año.
export function yearLeft(lightYears, now = new Date()) {
  if (!(lightYears >= 0) || lightYears > 3000) return null;
  const y = Math.floor(now.getUTCFullYear() + (now.getUTCMonth() + 0.5) / 12 - lightYears);
  return lightYears > 100 ? { year: Math.round(y / 10) * 10, approx: true } : { year: y, approx: false };
}
// Fecha ISO → «16 nov 2026» / «16 Nov 2026»
export function dateText(iso, lang) {
  const d = new Date(`${iso}T12:00:00Z`);
  try { return d.toLocaleDateString(lang === "es" ? "es" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); }
  catch { return iso; }
}

// Hash: #preguntas?q=scale&o=<objeto>&d=<destino>&z=<corrimiento al rojo>
export function readScaleState(params) {
  const o = params.get("o"), d = params.get("d"), z = params.get("z");
  const zn = z == null || z === "" ? null : Number(z);
  return {
    obj: OBJECT_IDS.includes(o) ? o : null,
    trip: TRIP_IDS.includes(d) ? d : null,
    z: Number.isFinite(zn) ? Math.min(Z_CMB, Math.max(Z_MIN, zn)) : null,
  };
}

export const SCALE_NEXT = [
  { url: "https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/", label: { es: "¿Dónde están las Voyager? (NASA)", en: "Where are the Voyagers? (NASA)" }, note: { es: "el cuentakilómetros en vivo de las dos sondas", en: "the live odometer of both probes" } },
  { url: "https://www.esa.int/Science_Exploration/Space_Science/Gaia", label: { es: "Misión Gaia (ESA)", en: "Gaia mission (ESA)" }, note: { es: "el satélite que mide la distancia a las estrellas por paralaje", en: "the satellite measuring the distances to stars by parallax" } },
  { url: "https://www.esa.int/Science_Exploration/Space_Science/Planck", label: { es: "Misión Planck (ESA)", en: "Planck mission (ESA)" }, note: { es: "el mapa del fondo cósmico", en: "the map of the cosmic background" } },
];
