// explain.js — "dato → explicación": reglas puras que convierten los números
// reales de cada objeto en categorías que la ficha explica en una frase.
// Sin texto ni DOM: las frases viven en i18n.js. Nada se inventa: si falta el
// dato, la función devuelve null y la ficha omite la línea.
import { galLat, sepDirs, galToEq, GAL_CENTER } from "./guide.js";

export const JUPITER_RE = 11.209;        // radio ecuatorial de Júpiter en radios terrestres
export const JUPITER_ME = 317.83;        // masa de Júpiter en masas terrestres
export const EARTH_EQT_C = -18;          // temperatura de equilibrio de la Tierra (255 K), calculada igual

/** Clase de un exoplaneta SOLO por su radio (en radios terrestres). */
export function exoClass(rade) {
  if (!(rade > 0)) return null;
  if (rade < 1.25) return "rocky";
  if (rade < 2) return "superEarth";
  if (rade < 6) return "neptune";
  return "giant";
}
/** Franja de temperatura (°C) para la comparación cotidiana. */
export function tempBand(c) {
  if (!Number.isFinite(c)) return null;
  if (c < -100) return "frozen";
  if (c < -30) return "antarctic";
  if (c <= 50) return "earthlike";
  if (c < 100) return "desert";
  if (c < 300) return "oven";
  if (c < 600) return "venus";
  if (c < 1200) return "lava";
  if (c < 2000) return "iron";
  return "star";
}
// Aspecto de la esfera que REPRESENTA al exoplaneta: el tono sale de su temperatura
// de equilibrio (si existe) y las bandas, de su clase por tamaño. No es un retrato.
const TONES = {
  frozen:    ["#dff1ff", "#8fb7dc", "#2c4a6e"],
  antarctic: ["#d6ecf5", "#7fb0c9", "#27495d"],
  earthlike: ["#cfe9d9", "#5f9f96", "#1d3f47"],
  desert:    ["#f3e2b8", "#c79a55", "#55381a"],
  oven:      ["#f4d3a0", "#c9793c", "#522510"],
  venus:     ["#f7c98a", "#d0652c", "#4f1a0c"],
  lava:      ["#ffc27a", "#d94a22", "#48110a"],
  iron:      ["#ffd58a", "#e8502a", "#5a1208"],
  star:      ["#fff0c2", "#ff7a3c", "#7a1c0a"],
};
const NEUTRAL = ["#d9d6e6", "#8d89a8", "#2c2a40"];
export function exoLook(rade, eqtK) {
  const cls = exoClass(rade);
  const band = eqtK > 0 ? tempBand(eqtK - 273.15) : null;
  const [light, base, dark] = band ? TONES[band] : NEUTRAL;
  return { cls, band, light, base, dark, banded: cls === "neptune" || cls === "giant", glow: band === "iron" || band === "star" };
}

/** Método de descubrimiento (texto del NASA Exoplanet Archive) → clave de explicación. */
const METHODS = {
  "transit": "transit", "radial velocity": "rv", "imaging": "imaging", "microlensing": "microlensing",
  "transit timing variations": "ttv", "eclipse timing variations": "etv", "astrometry": "astrometry",
  "pulsar timing": "pulsarTiming", "orbital brightness modulation": "obm", "pulsation timing variations": "ptv",
  "disk kinematics": "disk",
};
export function methodKey(method) {
  return (method && METHODS[String(method).trim().toLowerCase()]) || null;
}
/** Tipo espectral ("G2 V", "M4.5 V", "K0 III"…) → letra de clase y, si consta, si es gigante. */
export function starClass(spectype) {
  if (!spectype) return null;
  const m = /^\s*(?:sd|d|g)?([OBAFGKMLT])/.exec(String(spectype));
  if (!m) return null;
  const rest = String(spectype).slice(m[0].length);
  const lum = /(^|[^IV])III(?![IV])/.test(rest) ? "giant" : /(^|[^IV])IV(?![IV/])/.test(rest) && !/V\b/.test(rest.replace(/IV/g, "")) ? "subgiant" : null;
  return { letter: m[1], lum };
}

/** Radio de Schwarzschild (km) de un agujero negro de `massSun` masas solares: 2GM/c². */
export function schwarzschildKm(massSun) {
  return massSun > 0 ? 2.9532 * massSun : null;
}
const AU_KM = 149597870.7;
/** Con qué comparar ese radio. Devuelve { key, x } (x = múltiplo cuando hace falta). */
export function bhSizeBand(km) {
  if (!(km > 0)) return null;
  if (km < 30) return { key: "city" };
  if (km < 1737) return { key: "moon" };
  if (km < 6371) return { key: "earth" };
  if (km < 695700) return { key: "sun" };
  const au = km / AU_KM;
  if (au < 0.387) return { key: "mercury" };
  if (au < 1) return { key: "earthOrbit" };
  if (au < 5.2) return { key: "jupiterOrbit" };
  if (au < 30.07) return { key: "neptuneOrbit" };
  return { key: "beyond", x: au / 30.07 };
}
/** Vueltas por segundo de un púlsar y franja de comparación. */
export function pulsarSpin(periodMs) {
  if (!(periodMs > 0)) return null;
  const perSec = 1000 / periodMs;
  return { perSec, band: perSec >= 200 ? "blender" : perSec >= 20 ? "wheel" : perSec >= 1 ? "fast" : "slow" };
}
/** Tipo de Hubble del catálogo → familia ("E", "S0", "SB", "S", "I") o null. */
export function hubbleFamily(h) {
  if (!h) return null;
  const s = String(h).trim();
  if (/^S0|^SB0|^E-S0|^S0-a/i.test(s)) return "S0";
  if (/^E/.test(s)) return "E";
  if (/^SB/.test(s)) return "SB";
  if (/^SAB/.test(s)) return "SAB";
  if (/^S/.test(s)) return "S";
  if (/^I/.test(s)) return "I";
  return null;
}
/** Con qué se alcanza a ver un objeto difuso de esa magnitud (regla orientativa). */
export function magReach(mag) {
  if (mag == null || !Number.isFinite(mag)) return null;
  return mag <= 4.5 ? "eye" : mag <= 8 ? "binoculars" : "telescope";
}

// ── Notas sobre patrones del cielo ───────────────────────────────────────
// Cada nota sale de CONTAR en los datos cargados; si el patrón no aparece en
// ellos (p. ej. una capa con pocos objetos), la nota no se muestra.
const D2R = Math.PI / 180;
const eq = (raDeg, decDeg) => [Math.cos(decDeg * D2R) * Math.cos(raDeg * D2R), Math.cos(decDeg * D2R) * Math.sin(raDeg * D2R), Math.sin(decDeg * D2R)];
export const KEPLER_CENTER = eq(290.667, 44.5);   // centro del campo de Kepler (AR 19 h 22 m 40 s, Dec +44° 30′)
export const KEPLER_RADIUS = 8.5;                 // grados: el campo abarca ~16° de esquina a esquina
const share = (list, test) => { let n = 0; for (const o of list) if (test(o)) n++; return n; };

export function buildSkyNotes(datasets) {
  const notes = [];
  const objs = (k) => (datasets[k] && datasets[k].objects) || null;
  const exo = objs("exoplanets");
  if (exo && exo.length) {
    const n = share(exo, (o) => sepDirs(o.nx, o.ny, o.nz, KEPLER_CENTER[0], KEPLER_CENTER[1], KEPLER_CENTER[2]) <= KEPLER_RADIUS);
    // el campo ocupa ~0,55 % del cielo: se muestra si concentra al menos el 10 % de la capa
    if (n >= 5 && n / exo.length >= 0.1) notes.push({ id: "kepler", layer: "exoplanets", dir: KEPLER_CENTER, n, total: exo.length });
  }
  const psr = objs("pulsars");
  if (psr && psr.length >= 50) {
    const n = share(psr, (o) => Math.abs(galLat(o.nx, o.ny, o.nz)) < 10);
    if (n / psr.length >= 0.4) notes.push({ id: "pulsarPlane", layer: "pulsars", dir: galToEq(27, -3), n, total: psr.length });
  }
  const gal = objs("galaxies");
  if (gal && gal.length >= 50) {
    const n = share(gal, (o) => Math.abs(galLat(o.nx, o.ny, o.nz)) < 10);
    // una franja de ±10° es el 17 % del cielo: hay "zona vacía" si contiene menos del 5 %
    if (n / gal.length < 0.05) notes.push({ id: "avoidance", layer: "galaxies", dir: galToEq(52, 0), n, total: gal.length });
  }
  const mes = objs("messier");
  if (mes) {
    const glob = mes.filter((o) => o.type === "globular");
    const n = share(glob, (o) => sepDirs(o.nx, o.ny, o.nz, GAL_CENTER[0], GAL_CENTER[1], GAL_CENTER[2]) <= 45);
    // un círculo de 45° es el 15 % del cielo
    if (glob.length >= 10 && n / glob.length >= 0.4) notes.push({ id: "globulars", layer: "messier", dir: galToEq(8, 15), n, total: glob.length });
  }
  return notes;
}
