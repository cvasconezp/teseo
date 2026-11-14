// math.js — "¿Y la Luna? ¿Y el Sol?": números puros, deterministas, sin red y
// sin IA. Todo lo que muestra src/special/MoonSun.jsx sale de aquí y lo
// comprueba scripts/test_special_moonsun.mjs.
//
// Modelo (supuestos visibles en la interfaz):
//   · Transferencias de Hohmann: dos encendidos, órbitas circulares y
//     coplanares, sin atmósfera ni pérdidas por gravedad.
//   · Luna: la Hohmann va dentro del campo de la Tierra (μ⊕) desde una órbita
//     de aparcamiento a 185 km hasta la distancia media de la Luna. Al llegar
//     se cambia a la gravedad de la Luna ("cónicas enlazadas" simplificadas:
//     se ignora la gravedad de la Luna durante el viaje y la del Sol).
//   · Sol: la Hohmann va dentro del campo del Sol (μ☉), de 1 UA a la
//     superficie solar (perihelio = R☉). La salida desde la órbita baja
//     terrestre se calcula con la fórmula de la hipérbola de escape.
//   · Posición de la Luna hoy: método de Paul Schlyter ("How to compute
//     planetary positions", https://stjarnhimlen.se/comp/ppcomp.html), el mismo
//     que usa src/ephemeris.js, con sus perturbaciones principales en longitud
//     y en distancia. Error típico: pocos minutos de arco y unos cientos de km.
//
// Constantes y su fuente:
export const MU_EARTH = 398600.4418;       // km³/s² · GM⊕, IERS Conventions 2010 / WGS 84
export const R_EARTH = 6378.137;           // km · radio ecuatorial, WGS 84
export const LEO_ALT_KM = 185;             // km · altura de la órbita de aparcamiento (supuesto)
export const MU_SUN = 1.32712440018e11;    // km³/s² · GM☉, JPL DE405 / IAU
export const AU_KM = 149597870.7;          // km · unidad astronómica, IAU 2012 (Resolución B2)
export const R_SUN = 695700;               // km · radio solar nominal, IAU 2015 (Resolución B3)
export const MOON_A_KM = 384400;           // km · distancia media Tierra–Luna (NASA, Moon Fact Sheet)
export const MOON_NEAR_KM = 357000;        // km · NASA (Moon Fact Sheet): la distancia "va más o menos de 357 000 km…
export const MOON_FAR_KM = 407000;         // km · …a 407 000 km" a lo largo del año
export const MU_MOON = 4902.8;             // km³/s² · GM de la Luna, efemérides JPL DE430 (4902,800)
export const R_MOON = 1737.4;              // km · radio medio lunar (NASA, Moon Fact Sheet)
export const LLO_ALT_KM = 100;             // km · órbita lunar baja (supuesto)
export const C_KM_S = 299792.458;          // km/s · velocidad de la luz (exacta, SI)
export const SIDEREAL_MONTH_D = 27.321661; // días · vuelta de la Luna respecto a las estrellas
export const SYNODIC_MONTH_D = 29.530589;  // días · de Luna nueva a Luna nueva
export const MARS_AU = 1.524;              // UA · el mismo semieje que usan Ruta y Ventanas (src/ui/orbits.js)

const DAY_S = 86400;
const DAY_MS = 86400000;

// ─── Mecánica orbital básica ────────────────────────────────────────────────

/** Velocidad en órbita circular de radio r (km/s). */
export const circularSpeed = (mu, r) => Math.sqrt(mu / r);
/** Velocidad de escape a la distancia r (km/s). */
export const escapeSpeed = (mu, r) => Math.sqrt((2 * mu) / r);
/** Ecuación de vis-viva: velocidad a la distancia r en una órbita de semieje a. */
export const visViva = (mu, r, a) => Math.sqrt(mu * (2 / r - 1 / a));
/** Medio período de la elipse de transferencia entre r1 y r2 (segundos). */
export const hohmannHalfPeriodS = (mu, r1, r2) => Math.PI * Math.sqrt(Math.pow((r1 + r2) / 2, 3) / mu);

/**
 * Cambio de velocidad para salir de una órbita circular baja con un exceso
 * hiperbólico v∞ (km/s): √(v∞² + v_esc²) − v_circ. Por defecto, LEO de 185 km.
 */
export function departureDv(vInf, mu = MU_EARTH, r = R_EARTH + LEO_ALT_KM) {
  return Math.sqrt(vInf * vInf + escapeSpeed(mu, r) ** 2) - circularSpeed(mu, r);
}

// ─── Luna ───────────────────────────────────────────────────────────────────

/**
 * Viaje mínimo a la Luna (Hohmann en el campo de la Tierra) y frenado para
 * quedarse en una órbita lunar baja.
 * @param {number} [rMoon] distancia a la Luna (km); por defecto la media
 */
export function moonTrip(rMoon = MOON_A_KM) {
  const r1 = R_EARTH + LEO_ALT_KM;
  const a = (r1 + rMoon) / 2;
  const vLeo = circularSpeed(MU_EARTH, r1);
  const vPerigee = visViva(MU_EARTH, r1, a);
  const vApogee = visViva(MU_EARTH, rMoon, a);
  const vMoon = circularSpeed(MU_EARTH, rMoon);          // la Luna en órbita circular
  const vInf = vMoon - vApogee;                           // llegada relativa a la Luna
  const rLlo = R_MOON + LLO_ALT_KM;
  const vPeri = Math.sqrt(vInf * vInf + escapeSpeed(MU_MOON, rLlo) ** 2);
  const loiDv = vPeri - circularSpeed(MU_MOON, rLlo);
  const tofS = hohmannHalfPeriodS(MU_EARTH, r1, rMoon);
  return {
    leoRadiusKm: r1, vLeo, vPerigee, vApogee, vMoon, vInf,
    tliDv: vPerigee - vLeo,                  // inyección translunar
    loiDv,                                    // inserción en órbita lunar
    totalDv: vPerigee - vLeo + loiDv,
    tofDays: tofS / DAY_S,
    lightS: rMoon / C_KM_S,
  };
}

/**
 * Tiempo desde el perigeo hasta la distancia r en una elipse de perigeo rp y
 * apogeo ra alrededor de la Tierra (s). Kepler: t = (E − e·sen E)/n.
 */
export function timeToRadiusS(rp, ra, r, mu = MU_EARTH) {
  const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
  const cosE = Math.min(1, Math.max(-1, (1 - r / a) / e));
  const E = Math.acos(cosE);
  return (E - e * Math.sin(E)) / Math.sqrt(mu / (a * a * a));
}

/**
 * Trayectoria más rápida que la Hohmann: elipse desde la LEO cuyo apogeo queda
 * más allá de la Luna, de modo que llega a la distancia lunar en `hours`.
 * Devuelve el Δv de inyección (km/s). Solo dos cuerpos (Tierra + nave).
 */
export function fastMoonTli(hours, rMoon = MOON_A_KM) {
  const rp = R_EARTH + LEO_ALT_KM, target = hours * 3600;
  if (!(target > 0) || target >= hohmannHalfPeriodS(MU_EARTH, rp, rMoon)) return moonTrip(rMoon).tliDv;
  let lo = rMoon, hi = rMoon * 1000;                      // más apogeo → llega antes
  for (let k = 0; k < 200; k++) {
    const mid = Math.sqrt(lo * hi);
    if (timeToRadiusS(rp, mid, rMoon) > target) lo = mid; else hi = mid;
  }
  const ra = Math.sqrt(lo * hi);
  return visViva(MU_EARTH, rp, (rp + ra) / 2) - circularSpeed(MU_EARTH, rp);
}

// ─── Sol ────────────────────────────────────────────────────────────────────

/** Llegar a la superficie del Sol, escapar del sistema solar y, para comparar, ir a Marte. */
export function sunTrip() {
  const r1 = AU_KM, r2 = R_SUN;
  const a = (r1 + r2) / 2;
  const vEarth = circularSpeed(MU_SUN, r1);              // la Tierra alrededor del Sol
  const vAphelion = visViva(MU_SUN, r1, a);               // la elipse que roza el Sol, en su punto lejano
  const vInf = vEarth - vAphelion;                        // lo que hay que "quitar"
  const vEscSun = escapeSpeed(MU_SUN, r1);
  const vInfEscape = vEscSun - vEarth;
  const rMars = MARS_AU * AU_KM;
  const vInfMars = vEarth * (Math.sqrt((2 * rMars) / (r1 + rMars)) - 1);
  return {
    vEarth, vAphelion, vInf,
    dvLeo: departureDv(vInf),
    tofDays: hohmannHalfPeriodS(MU_SUN, r1, r2) / DAY_S,
    vEscSun, vInfEscape,
    dvEscapeLeo: departureDv(vInfEscape),
    vInfMars,
    dvMarsLeo: departureDv(vInfMars),
    lightS: (AU_KM - R_SUN) / C_KM_S,
  };
}

// ─── La Luna hoy (método de Paul Schlyter) ──────────────────────────────────

import { moonSchlyter } from "../moon.js";

const RAD = Math.PI / 180;
const cosd = x => Math.cos(x * RAD);
const rev = x => ((x % 360) + 360) % 360;
const dayNum = ms => ms / DAY_MS + 2440587.5 - 2451543.5;   // días desde 1999-12-31 0h

/**
 * Luna geocéntrica en una fecha: distancia (km), longitudes eclípticas de Luna
 * y Sol, elongación (0–360°, 0 = Luna nueva, 180 = llena), fracción iluminada.
 */
export function moonState(date = new Date()) {
  // Schlyter completo (longitud, latitud y distancia): src/moon.js, común con src/ephemeris.js
  const { lon: moonLon, lat, rEr, sunLon } = moonSchlyter(dayNum(+date));
  const elong = rev(moonLon - sunLon);
  // Fracción iluminada a partir del ángulo Sol–Tierra–Luna (la paralaje del Sol es despreciable)
  const psi = Math.acos(Math.max(-1, Math.min(1, cosd(lat) * cosd(moonLon - sunLon)))) / RAD;
  return {
    distKm: rEr * R_EARTH,
    moonLon, moonLat: lat, sunLon, elong,
    illum: (1 - cosd(psi)) / 2,
    waxing: elong < 180,
  };
}

/** Nombre de la fase (8 tramos de 45° centrados en 0°, 45°, 90°…). */
export const PHASE_KEYS = ["new", "waxingCrescent", "firstQuarter", "waxingGibbous", "full", "waningGibbous", "lastQuarter", "waningCrescent"];
export function phaseKey(elong) {
  return PHASE_KEYS[Math.floor(rev(elong + 22.5) / 45) % 8];
}

const wrap180 = x => { const y = rev(x); return y > 180 ? y - 360 : y; };

/**
 * Próximo instante (después de `date`) en que la elongación vale `target`
 * (0 = Luna nueva, 180 = Luna llena). Paso de 6 h y bisección hasta ~1 min.
 */
export function nextPhase(date = new Date(), target = 0) {
  const f = ms => wrap180(moonState(new Date(ms)).elong - target);
  const step = 6 * 3600000;
  let t0 = +date, f0 = f(t0);
  for (let k = 0; k < 4 * 32; k++) {                       // como mucho un mes y pico
    const t1 = t0 + step, f1 = f(t1);
    if (f0 < 0 && f1 >= 0 && f1 - f0 < 90) {              // cruce real (no el salto de ±180)
      let lo = t0, hi = t1;
      while (hi - lo > 30000) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
      return new Date(Math.round((lo + hi) / 2));
    }
    t0 = t1; f0 = f1;
  }
  return null;
}

/** Resumen de la Luna hoy para la tarjeta. */
export function moonToday(date = new Date()) {
  const s = moonState(date);
  return {
    ...s,
    phase: phaseKey(s.elong),
    lightS: s.distKm / C_KM_S,
    nextNew: nextPhase(date, 0),
    nextFull: nextPhase(date, 180),
  };
}
