// timeData.js — física pura, datos y fuentes del recorrido "¿Se puede viajar en
// el tiempo?". Sin React ni red. Los textos viven en timeText.js; las
// constantes generales, en constants.js. Cifras verificadas el 14-nov-2026.
//
//  · Relojes GPS: Ashby (2003), Living Reviews in Relativity 6, 1 — potencial del
//    geoide Φ0/c² = 6,969 290 134 × 10⁻¹⁰ (definición IAU, ec. 18 del artículo) y
//    radio orbital de un satélite GPS a = 2,656 175 × 10⁷ m (±20.184 km de altura
//    sobre el ecuador). Con ellos se obtiene +45,8 µs/día (gravedad), −7,2 µs/día
//    (velocidad) y +38,6 µs/día (neto): la misma cuenta que publica Ashby, que
//    ajusta el reloj a 10,229 999 995 43 MHz (desfase −4,4647 × 10⁻¹⁰).
//    GPS World (Misra, 2023) da «unos 45», «unos 7» y «unos 38 µs/día», y un error
//    de distancia de hasta ~11 km entre dos correcciones diarias.
//  · Hafele y Keating (1971): vuelos alrededor del mundo, publicados en Science
//    177, 166–170 (1972). Este: previsto −40 ± 23 ns, medido −59 ± 10 ns.
//    Oeste: previsto +275 ± 21 ns, medido +273 ± 7 ns.
//  · Próxima Centauri: paralaje Gaia DR3 = 768,0665 ± 0,0499 mas → 1,30197 pc =
//    4,2465 años luz.
//  · Sonda Parker: récord de 430.000 mph (NASA, 2024-25; igualado en 2026) = 192,2 km/s.
//  · Chimborazo: 6.263 m (medición GPS de 2016, IRD e Instituto Geográfico Militar de
//    Ecuador); es el punto de la superficie más alejado del centro de la Tierra (NOAA).
//  · Sirio B: masa 1,018 ± 0,011 M☉ (Bond et al. 2017); radio 0,008098 R☉ ≈ 5.634 km
//    (tabla del artículo de Wikipedia sobre Sirio; ver Supuestos).
//  · Estrella de neutrones: PSR J0030+0451, NICER — 1,34 (+0,15/−0,16) M☉ y radio
//    ecuatorial 12,71 (+1,14/−1,19) km (Riley et al. 2019).
import { C, GM_EARTH, GM_SUN, R_EARTH, R_SUN, YEAR, LY, PC } from "./constants.js";
import { schwarzschildRadiusM, staticClockRate, circularSpeed, clamp } from "./physics.js";
import { num, sig, sci } from "./format.js";
import { duration } from "./units.js";

// ═══ Constantes propias de este recorrido ════════════════════════════════════
export const GEOID_PHI0_C2 = 6.969290134e-10;      // Φ0/c² (adimensional), Ashby 2003
export const GEOID_W0 = GEOID_PHI0_C2 * C * C;     // m²/s² (6,2637 × 10⁷)
export const GPS_RADIUS_M = 2.656175e7;            // m (Ashby 2003)
export const ISS_ALT_M = 4.0e5;                    // m: «unos 400 km» (NASA)
export const OMEGA_EARTH = 7.292115e-5;            // rad/s (WGS84)
export const CHIMBORAZO_M = 6263;                  // m sobre el nivel del mar
export const DAY = 86400;                          // s
export const MPH = 0.44704;                        // m/s por milla/hora (exacto)
export const PROXIMA_PARALLAX_MAS = 768.0665;      // Gaia DR3
export const PROXIMA_LY = (1000 / PROXIMA_PARALLAX_MAS) * (PC / LY);   // 4,2465
export const PARKER_MS = 430000 * MPH;             // 192.227 m/s
export const PLANE_MS = 250;                       // ≈ 900 km/h, crucero típico (aprox.)
export const ISS_MS = circularSpeed(GM_EARTH, R_EARTH + ISS_ALT_M);    // 7.668 m/s

// ═══ Velocidad: relatividad especial ═════════════════════════════════════════
// γ = 1/√(1 − β²), β = v/c.
export const lorentz = (beta) => 1 / Math.sqrt(1 - beta * beta);
// γ − 1 sin pérdida de cifras a velocidades bajas: β² / (√(1−β²)·(1+√(1−β²))).
export function lorentzMinusOne(beta) {
  const s = Math.sqrt(1 - beta * beta);
  return (beta * beta) / (s * (1 + s));
}
// Escala del deslizador: t = −log10(1 − β), de 0 (reposo) a 4 (β = 0,9999).
export const BETA_SLIDER = { min: 0, max: 4, step: 0.01, start: 1 };
export const betaFromSlider = (t) => (t <= 0 ? 0 : 1 - Math.pow(10, -clamp(t, 0, BETA_SLIDER.max)));
export const sliderFromBeta = (b) => (b <= 0 ? 0 : clamp(-Math.log10(1 - clamp(b, 0, 0.9999999)), 0, BETA_SLIDER.max));

// Ida y vuelta a una estrella a `ly` años luz, a velocidad constante (sin
// aceleración): en la Tierra pasan 2·ly/β años; a bordo, eso entre γ.
export function roundTrip(ly, beta) {
  if (!(beta > 0)) return null;
  const earth = (2 * ly) / beta;
  return { earth, ship: earth / lorentz(beta) };
}

// ═══ Gravedad: relatividad general (Schwarzschild, observador estático) ══════
// Déficit de ritmo 1 − √(1 − r_s/r), calculado sin perder cifras cuando r_s/r es diminuto.
export function clockDeficit(compactness) {
  return compactness / (1 + Math.sqrt(1 - compactness));
}
// Segundos extra que cuenta un reloj lejano por cada segundo propio: 1/k − 1.
export function extraFar(compactness) {
  const d = clockDeficit(compactness);
  return d / (1 - d);
}
// Para una órbita circular (geodésica) el reloj marcha a √(1 − 3GM/(rc²)) = √(1 − 3r_s/(2r)).
export const orbitDeficit = (compactness) => clockDeficit((3 / 2) * compactness);
export const orbitExtraFar = (compactness) => { const d = orbitDeficit(compactness); return d / (1 - d); };

// Objetos del laboratorio de gravedad. gm = G·M (m³/s²); R = radio (m); para el
// agujero negro, R = horizonte y la distancia se mide sobre él.
const BH_MASS_SUN = 10;
export const BODIES = {
  earth: { gm: GM_EARTH, R: R_EARTH },
  sun: { gm: GM_SUN, R: R_SUN },
  wd: { gm: 1.018 * GM_SUN, R: 0.008098 * R_SUN },        // Sirio B
  ns: { gm: 1.34 * GM_SUN, R: 12.71e3 },                    // PSR J0030+0451
  bh: { gm: BH_MASS_SUN * GM_SUN, R: schwarzschildRadiusM(BH_MASS_SUN) },
};
export const rsOf = (body) => (2 * body.gm) / (C * C);

// Deslizador de distancia: f = (r − R)/R = 10^s. En un cuerpo con superficie el
// extremo de la izquierda es la propia superficie (f = 0); en el agujero negro
// no existe f = 0 (el horizonte), y el extremo es una milmillonésima de r_s.
export const GRAV_SLIDER = { max: 1, step: 0.01, min: -4, minBh: -9 };
export const sliderMin = (obj) => (obj === "bh" ? GRAV_SLIDER.minBh : GRAV_SLIDER.min);
export const fractionFromSlider = (s, obj) => (obj !== "bh" && s <= GRAV_SLIDER.min ? 0 : Math.pow(10, clamp(s, sliderMin(obj), GRAV_SLIDER.max)));
export const sliderFromFraction = (f, obj) => (f <= 0 ? sliderMin(obj) : clamp(Math.log10(f), sliderMin(obj), GRAV_SLIDER.max));

// Estado físico de un punto: objeto + fracción f. r = R·(1+f).
export function gravityAt(obj, f) {
  const b = BODIES[obj];
  const r = b.R * (1 + f);
  const comp = rsOf(b) / r;
  return {
    r, altitude: b.R * f, compactness: comp,
    rate: staticClockRate(1 / comp),            // null en el horizonte o dentro
    deficit: comp < 1 ? clockDeficit(comp) : null,
    extra: comp < 1 ? extraFar(comp) : null,
    orbitExtra: comp < 2 / 3 ? orbitExtraFar(comp) : null,
  };
}

// Lugares con nombre. `alt` en metros sobre la superficie (o `f` si es relativo al horizonte).
export const PLACES = [
  { id: "earth", obj: "earth", alt: 0, level: "estimated" },
  { id: "chimborazo", obj: "earth", alt: CHIMBORAZO_M, level: "estimated" },
  { id: "iss", obj: "earth", alt: ISS_ALT_M, orbit: true, level: "estimated" },
  { id: "gps", obj: "earth", alt: GPS_RADIUS_M - R_EARTH, orbit: true, level: "measured" },
  { id: "sun", obj: "sun", alt: 0, level: "estimated" },
  { id: "siriusb", obj: "wd", alt: 0, level: "estimated" },
  { id: "ns", obj: "ns", alt: 0, level: "estimated" },
  { id: "bh", obj: "bh", f: 1e-9, level: "estimated" },
].map(p => ({ ...p, f: p.f ?? p.alt / BODIES[p.obj].R }));
export const placeSlider = (p) => sliderFromFraction(p.f, p.obj);

// ═══ Relojes de satélite: GPS e ISS frente a un reloj en el geoide ═══════════
// Reloj en una órbita circular de radio r: (W0 − GM/r − v²/2)/c² con v² = GM/r.
// Separado en la parte gravitatoria (W0 − GM/r) y la de velocidad (−v²/2).
export function orbitClockOffset(r) {
  const v2 = GM_EARTH / r;
  return { gravity: (GEOID_W0 - GM_EARTH / r) / (C * C), velocity: -(v2 / 2) / (C * C), speed: Math.sqrt(v2) };
}
export function gpsOffsets() {
  const o = orbitClockOffset(GPS_RADIUS_M);
  const gravity = o.gravity * DAY * 1e6, velocity = o.velocity * DAY * 1e6;   // µs/día
  const net = gravity + velocity;
  return { gravity, velocity, net, speed: o.speed, altitudeKm: (GPS_RADIUS_M - R_EARTH) / 1e3, rangeKmPerDay: (C * net * 1e-6) / 1e3 };
}
// ISS durante `days` días: segundos que gana (gravedad), pierde (velocidad) y neto.
export function issEffect(days = 365.25 / 2) {
  const o = orbitClockOffset(R_EARTH + ISS_ALT_M), s = days * DAY;
  return { gravity: o.gravity * s, velocity: o.velocity * s, net: (o.gravity + o.velocity) * s, speed: o.speed };
}

// ═══ Chimborazo frente al nivel del mar ══════════════════════════════════════
// Reloj fijo a la Tierra en el ecuador: ritmo = 1 − U/c², con U = GM/r + ½Ω²r².
// La cima está más lejos del centro: U menor → el reloj va más rápido.
export function heightRateGain(h, R = R_EARTH) {
  const dU = GM_EARTH * (1 / R - 1 / (R + h)) - 0.5 * OMEGA_EARTH * OMEGA_EARTH * ((R + h) * (R + h) - R * R);
  return dU / (C * C);
}
// Segundos de más que envejeces en `years` años en lo alto, frente al nivel del mar.
export const heightGainSeconds = (h, years) => heightRateGain(h) * years * YEAR;

// ═══ Formato ═════════════════════════════════════════════════════════════════
// Duración corta, de nanosegundos a años, con 2–3 cifras.
export function smallTime(s, lang) {
  if (!Number.isFinite(s) || s < 0) return "—";
  if (s === 0) return "0 s";
  if (s < 1e-6) return `${sig(s * 1e9, lang, 2)} ns`;
  if (s < 1e-3) return `${sig(s * 1e6, lang, 3)} µs`;
  if (s < 1) return `${sig(s * 1e3, lang, 3)} ms`;
  if (s < 60) return `${sig(s, lang, 3)} s`;
  return duration(s, lang);
}
// Longitud corta: de nanómetros a km (los grandes los formatea units.length).
export function smallLength(m, lang) {
  if (m < 1e-6) return `${sig(m * 1e9, lang, 2)} nm`;
  if (m < 1e-3) return `${sig(m * 1e6, lang, 3)} µm`;
  return null;
}
// Porcentaje de c con las cifras justas: 0,5 → "50"; 0,9999 → "99,99".
export function betaPercent(beta, lang) {
  const u = Math.max(1 - beta, 1e-9);
  if (beta < 0.01) return sig(beta * 100, lang, 2);
  const d = clamp(Math.ceil(-Math.log10(u)), 1, 6);
  return num(beta * 100, lang, d);
}
export { sci };

// ═══ Fuentes (todas con URL https) ═══════════════════════════════════════════
export const TIME_REFS = {
  ashby2003: { cite: "Ashby (2003), Living Reviews in Relativity 6, 1: «Relativity in the Global Positioning System»", citeEn: "Ashby (2003), Living Reviews in Relativity 6, 1: “Relativity in the Global Positioning System”", url: "https://doi.org/10.12942/lrr-2003-1" },
  misra2023: { cite: "Misra (2023), GPS World: «Inside the box: GPS and relativity»", citeEn: "Misra (2023), GPS World: “Inside the box: GPS and relativity”", url: "https://www.gpsworld.com/inside-the-box-gps-and-relativity/" },
  hafeleKeating1: { cite: "Hafele y Keating (1972), Science 177, 166: relojes atómicos alrededor del mundo, predicción", citeEn: "Hafele and Keating (1972), Science 177, 166: around-the-world atomic clocks, prediction", url: "https://doi.org/10.1126/science.177.4044.166" },
  hafeleKeating2: { cite: "Hafele y Keating (1972), Science 177, 168: relojes atómicos alrededor del mundo, medición", citeEn: "Hafele and Keating (1972), Science 177, 168: around-the-world atomic clocks, observation", url: "https://doi.org/10.1126/science.177.4044.168" },
  codata: { cite: "NIST / CODATA: constante de gravitación G", citeEn: "NIST / CODATA: Newtonian constant of gravitation G", url: "https://physics.nist.gov/cgi-bin/cuu/Value?bg" },
  speedOfLight: { cite: "NIST: velocidad de la luz, exacta por definición", citeEn: "NIST: speed of light, exact by definition", url: "https://physics.nist.gov/cgi-bin/cuu/Value?c" },
  iau2015: { cite: "IAU (2015), Resolución B3: constantes nominales del Sol y la Tierra", citeEn: "IAU (2015), Resolution B3: nominal solar and terrestrial constants", url: "https://arxiv.org/abs/1510.07674" },
  proxima: { cite: "Próxima Centauri (Wikipedia): paralaje de Gaia DR3 de 768,0665 mas, 4,2465 años luz", citeEn: "Proxima Centauri (Wikipedia): Gaia DR3 parallax of 768.0665 mas, 4.2465 light-years", url: "https://en.wikipedia.org/wiki/Proxima_Centauri" },
  parker: { cite: "NASA (2026), Parker Solar Probe: «igualó su récord de 430.000 mph»", citeEn: "NASA (2026), Parker Solar Probe: “equaled its record-setting speed of 430,000 mph”", url: "https://science.nasa.gov/blogs/parker-solar-probe/2026/06/11/parker-solar-probe-makes-28th-close-pass-of-sun/" },
  nasaIss: { cite: "NASA, datos de la Estación Espacial Internacional: unas 16 órbitas al día", citeEn: "NASA, International Space Station facts: about 16 orbits a day", url: "https://www.nasa.gov/international-space-station/space-station-facts-and-figures/" },
  chimborazo: { cite: "Chimborazo (Wikipedia): 6.263 m según la medición GPS de 2016", citeEn: "Chimborazo (Wikipedia): 6,263 m from the 2016 GPS survey", url: "https://en.wikipedia.org/wiki/Chimborazo" },
  noaa: { cite: "NOAA, Servicio Nacional del Océano: el punto más alejado del centro de la Tierra", citeEn: "NOAA National Ocean Service: the point farthest from Earth’s centre", url: "https://oceanservice.noaa.gov/facts/highestpoint.html" },
  bond2017: { cite: "Bond et al. (2017), ApJ 840, 70: el sistema de Sirio; masa de Sirio B", citeEn: "Bond et al. (2017), ApJ 840, 70: the Sirius system; mass of Sirius B", url: "https://arxiv.org/abs/1703.10625" },
  sirius: { cite: "Sirio (Wikipedia): radio de Sirio B", citeEn: "Sirius (Wikipedia): radius of Sirius B", url: "https://en.wikipedia.org/wiki/Sirius" },
  riley2019: { cite: "Riley et al. (2019), ApJL 887, L21: NICER y PSR J0030+0451", citeEn: "Riley et al. (2019), ApJL 887, L21: NICER and PSR J0030+0451", url: "https://arxiv.org/abs/1912.05702" },
  thorne: { cite: "Thorne, «The Science of Interstellar» (extracto en Space.com)", citeEn: "Thorne, “The Science of Interstellar” (excerpt on Space.com)", url: "https://www.space.com/28077-science-of-interstellar-book-excerpt.html" },
  hawking1992: { cite: "Hawking (1992), Physical Review D 46, 603: «Chronology protection conjecture»", citeEn: "Hawking (1992), Physical Review D 46, 603: “Chronology protection conjecture”", url: "https://doi.org/10.1103/PhysRevD.46.603" },
};

// Hafele–Keating (nanosegundos; previsión y medida)
export const HAFELE_KEATING = {
  east: { predicted: -40, predictedErr: 23, observed: -59, observedErr: 10 },
  west: { predicted: 275, predictedErr: 21, observed: 273, observedErr: 7 },
};

// Atajos de velocidad. `beta` se fija exacto (los lentos quedan en el extremo izquierdo del deslizador).
export const SPEED_PRESETS = [
  { id: "plane", real: true, beta: PLANE_MS / C, approx: true },
  { id: "iss", real: true, beta: ISS_MS / C },
  { id: "parker", real: true, beta: PARKER_MS / C, ref: "parker" },
  { id: "p10", real: false, beta: 0.1 },
  { id: "p50", real: false, beta: 0.5 },
  { id: "p90", real: false, beta: 0.9 },
  { id: "p99", real: false, beta: 0.99 },
  { id: "p9999", real: false, beta: 0.9999 },
];

// Enlaces externos de «Para seguir» (el interno a q=bh va aparte, en el recorrido).
export const TIME_NEXT = [
  { url: "https://doi.org/10.12942/lrr-2003-1", label: { es: "Relatividad en el GPS (Ashby, 2003)", en: "Relativity in the GPS (Ashby, 2003)" }, note: { es: "el artículo de referencia, con todas las cuentas", en: "the reference article, with all the sums" } },
  { url: "https://www.gpsworld.com/inside-the-box-gps-and-relativity/", label: { es: "GPS y relatividad (GPS World)", en: "GPS and relativity (GPS World)" }, note: { es: "explicado por un ingeniero del sistema", en: "explained by a GPS engineer" } },
  { url: "https://www.space.com/28077-science-of-interstellar-book-excerpt.html", label: { es: "La ciencia de «Interstellar» (Kip Thorne)", en: "The science of “Interstellar” (Kip Thorne)" }, note: { es: "qué es real y qué es ficción en la película", en: "what is real and what is fiction in the film" } },
];
