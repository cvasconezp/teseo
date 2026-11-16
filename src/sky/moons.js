// moons.js — las lunas de otros planetas: dónde están hoy respecto a su planeta (puro; probado en
// scripts/test_moons.mjs contra posiciones de JPL Horizons).
//
// Órbitas: src/sky/moonsData.js (generado por scripts/build_moons.py a partir de JPL Horizons).
// Aquí se suma el tiempo de luz (vemos el sistema como era hace Δ/c), se proyecta el vector
// luna − planeta sobre el plano del cielo (este, norte) y se decide si la luna pasa por delante
// del disco del planeta o queda escondida detrás.
//
// Datos fijos (consultados el 16-nov-2026):
//  · radios ecuatoriales de los planetas: NASA, fichas planetarias (Marte 3396,2 km; Júpiter 71 492;
//    Saturno 60 268; Urano 25 559; Neptuno 24 764)
//  · anillos de Saturno: borde exterior del anillo A, 136 775 km (NASA, ficha de los anillos de Saturno)
//  · polo norte de Saturno (ICRF): α = 40,589°, δ = 83,537° (IAU WGCCRE 2015, Archinal et al. 2018)
//  · descubrimientos: año y autor de cada luna (NASA Science, páginas de cada luna)
import { MOON_ORBITS, MOON_T0_JD } from "./moonsData.js";

const AU_KM = 149597870.7, C_KMS = 299792.458, ARCSEC = 206264.806;
export const PLANET_RADIUS_KM = { "Marte": 3396.2, "Júpiter": 71492, "Saturno": 60268, "Urano": 25559, "Neptuno": 24764 };
export const SATURN_RING_KM = 136775;
export const SATURN_RING_INNER_KM = 74490;                     // borde interior del anillo C (NASA, ficha de los anillos)
// Polo norte de cada planeta (ICRF, término constante; IAU WGCCRE 2015, Archinal et al. 2018)
const POLE_DEG = { "Marte": [317.269, 54.432], "Júpiter": [268.057, 64.495], "Saturno": [40.589, 83.537], "Urano": [257.311, -15.175], "Neptuno": [299.36, 43.46] };
const poleVec = (name) => { const p = POLE_DEG[name]; if (!p) return null; const a = p[0] * Math.PI / 180, d = p[1] * Math.PI / 180; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; };
const SATURN_POLE = poleVec("Saturno");
/** Vector unitario del polo norte del planeta (ICRF) o null. */
export const planetPole = (name) => poleVec(name);
export const POLAR_FLATTENING = { "Marte": 0.00589, "Júpiter": 0.06487, "Saturno": 0.09796, "Urano": 0.02293, "Neptuno": 0.0171 };   // NASA, fichas planetarias

/**
 * Cómo se presenta el planeta visto desde la Tierra (u: vector unitario Tierra → planeta, ICRF):
 * pa = ángulo de posición de su polo norte (grados, desde el norte del cielo hacia el este) y
 * B = latitud del punto que mira hacia la Tierra (grados; > 0: se ve su hemisferio norte).
 */
export function planetOrientation(name, u) {
  const p = poleVec(name); if (!p) return null;
  const east = (() => { const c = [-u[1], u[0], 0], n = Math.hypot(c[0], c[1]); return [c[0] / n, c[1] / n, 0]; })();
  const north = [u[1] * east[2] - u[2] * east[1], u[2] * east[0] - u[0] * east[2], u[0] * east[1] - u[1] * east[0]];
  const sinB = -(p[0] * u[0] + p[1] * u[1] + p[2] * u[2]);
  const pe = p[0] * east[0] + p[1] * east[1] + p[2] * east[2], pn = p[0] * north[0] + p[1] * north[1] + p[2] * north[2];
  return { pa: Math.atan2(pe, pn) * 180 / Math.PI, B: Math.asin(Math.max(-1, Math.min(1, sinB))) * 180 / Math.PI };
}

// Nombres, descubrimiento y un dato que la distingue (ES/EN). Orden: por planeta y distancia.
export const MOON_INFO = {
  Phobos: { es: "Fobos", en: "Phobos", year: 1877, by: "Asaph Hall",
    note: { es: "Se acerca a Marte unos 2 metros por siglo: dentro de unos 50 millones de años chocará con él o se romperá en un anillo.", en: "It creeps about 2 metres closer to Mars every century: in some 50 million years it will crash into the planet or break up into a ring." } },
  Deimos: { es: "Deimos", en: "Deimos", year: 1877, by: "Asaph Hall",
    note: { es: "Mide unos 12 kilómetros: desde la superficie de Marte se vería como una estrella brillante.", en: "About 12 kilometres across: from the surface of Mars it would look like a bright star." } },
  Io: { es: "Ío", en: "Io", year: 1610, by: "Galileo Galilei",
    note: { es: "El mundo con más actividad volcánica del sistema solar: tiene cientos de volcanes.", en: "The most volcanically active world in the solar system, with hundreds of volcanoes." } },
  Europa: { es: "Europa", en: "Europa", year: 1610, by: "Galileo Galilei",
    note: { es: "Bajo su corteza de hielo hay un océano de agua salada. La sonda Europa Clipper, de la NASA, llegará en 2030.", en: "A salty ocean lies beneath its icy crust. NASA’s Europa Clipper will arrive in 2030." } },
  Ganymede: { es: "Ganímedes", en: "Ganymede", year: 1610, by: "Galileo Galilei",
    note: { es: "La luna más grande del sistema solar, mayor que Mercurio, y la única con campo magnético propio. La misión JUICE, de la ESA, llegará en 2031.", en: "The largest moon in the solar system, bigger than Mercury, and the only one with its own magnetic field. ESA’s JUICE will arrive in 2031." } },
  Callisto: { es: "Calisto", en: "Callisto", year: 1610, by: "Galileo Galilei",
    note: { es: "Su superficie es de las más antiguas y llenas de cráteres del sistema solar.", en: "Its surface is among the oldest and most heavily cratered in the solar system." } },
  Mimas: { es: "Mimas", en: "Mimas", year: 1789, by: "William Herschel",
    note: { es: "Su cráter Herschel mide unos 130 kilómetros: casi un tercio de la luna entera.", en: "Its Herschel crater is about 130 kilometres wide: almost a third of the whole moon." } },
  Enceladus: { es: "Encélado", en: "Enceladus", year: 1789, by: "William Herschel",
    note: { es: "Lanza chorros de agua desde un océano oculto bajo su polo sur; la sonda Cassini voló a través de ellos.", en: "It sprays jets of water from an ocean hidden beneath its south pole; the Cassini spacecraft flew through them." } },
  Tethys: { es: "Tetis", en: "Tethys", year: 1684, by: "Giovanni Domenico Cassini",
    note: { es: "Está hecha casi solo de hielo de agua y la cruza un cañón de unos 2000 kilómetros, Ithaca Chasma.", en: "It is made almost entirely of water ice and is crossed by a canyon some 2,000 kilometres long, Ithaca Chasma." } },
  Dione: { es: "Dione", en: "Dione", year: 1684, by: "Giovanni Domenico Cassini",
    note: { es: "Hielo con acantilados brillantes; la sonda Cassini detectó a su alrededor una atmósfera tenuísima de oxígeno.", en: "Ice with bright cliffs; the Cassini spacecraft detected an extremely thin oxygen atmosphere around it." } },
  Rhea: { es: "Rea", en: "Rhea", year: 1672, by: "Giovanni Domenico Cassini",
    note: { es: "La segunda luna más grande de Saturno, después de Titán.", en: "Saturn’s second largest moon, after Titan." } },
  Titan: { es: "Titán", en: "Titan", year: 1655, by: "Christiaan Huygens",
    note: { es: "La única luna con una atmósfera densa —más que la de la Tierra— y con lagos de metano líquido. La misión Dragonfly, de la NASA, despegará en 2028.", en: "The only moon with a thick atmosphere—denser than Earth’s—and lakes of liquid methane. NASA’s Dragonfly mission will launch in 2028." } },
  Iapetus: { es: "Jápeto", en: "Iapetus", year: 1671, by: "Giovanni Domenico Cassini",
    note: { es: "Tiene una cara oscura como el carbón y otra brillante como la nieve.", en: "One face is as dark as coal and the other as bright as snow." } },
  Miranda: { es: "Miranda", en: "Miranda", year: 1948, by: "Gerard Kuiper",
    note: { es: "Tiene uno de los acantilados más altos del sistema solar, Verona Rupes, de unos 20 kilómetros. La Voyager 2 la fotografió en 1986.", en: "It has one of the tallest cliffs in the solar system, Verona Rupes, about 20 kilometres high. Voyager 2 photographed it in 1986." } },
  Ariel: { es: "Ariel", en: "Ariel", year: 1851, by: "William Lassell",
    note: { es: "La más brillante de las lunas de Urano.", en: "The brightest of Uranus’s moons." } },
  Umbriel: { es: "Umbriel", en: "Umbriel", year: 1851, by: "William Lassell",
    note: { es: "La más oscura de las grandes lunas de Urano.", en: "The darkest of Uranus’s large moons." } },
  Titania: { es: "Titania", en: "Titania", year: 1787, by: "William Herschel",
    note: { es: "La luna más grande de Urano.", en: "Uranus’s largest moon." } },
  Oberon: { es: "Oberón", en: "Oberon", year: 1787, by: "William Herschel",
    note: { es: "La más alejada de las grandes lunas de Urano, cubierta de cráteres.", en: "The outermost of Uranus’s large moons, covered in craters." } },
  Triton: { es: "Tritón", en: "Triton", year: 1846, by: "William Lassell",
    note: { es: "Gira alrededor de Neptuno en sentido contrario a su rotación: seguramente fue capturada del cinturón de Kuiper. La Voyager 2 vio géiseres de nitrógeno en 1989.", en: "It orbits Neptune backwards relative to the planet’s spin: it was probably captured from the Kuiper Belt. Voyager 2 saw nitrogen geysers in 1989." } },
};

// Texturas del globo 3D (public/textures/moon-<clave>.jpg; scripts/build_moon_textures.py): mosaicos globales del
// USGS con imágenes de misiones de la NASA, dominio público. Las lunas de Urano no tienen mosaico global (la
// Voyager 2 solo vio su hemisferio sur): su ficha usa la foto.
export const MOON_TEXTURES = {
  Phobos: { es: "Viking", en: "Viking" }, Deimos: { es: "Viking", en: "Viking" },
  Io: { es: "Galileo y Voyager", en: "Galileo and Voyager" }, Europa: { es: "Galileo y Voyager", en: "Galileo and Voyager" },
  Ganymede: { es: "Galileo y Voyager", en: "Galileo and Voyager" }, Callisto: { es: "Galileo y Voyager", en: "Galileo and Voyager" },
  Mimas: { es: "Cassini", en: "Cassini" }, Enceladus: { es: "Cassini", en: "Cassini" }, Tethys: { es: "Cassini", en: "Cassini" },
  Dione: { es: "Cassini", en: "Cassini" }, Rhea: { es: "Cassini", en: "Cassini" },
  Titan: { es: "Cassini, en infrarrojo cercano (atraviesa la neblina)", en: "Cassini, in near infrared (it sees through the haze)" },
  Iapetus: { es: "Cassini y Voyager", en: "Cassini and Voyager" }, Triton: { es: "Voyager 2", en: "Voyager 2" },
};
/** Cuerpo para el globo 3D (mismas claves que BODIES en bodies.js) o null si la luna no tiene textura. */
export function moonBody(key) {
  if (!MOON_TEXTURES[key]) return null;
  const o = MOON_ORBITS.find((x) => x.key === key);
  return { id: `moon-${key.toLowerCase()}`, es: MOON_INFO[key].es, en: MOON_INFO[key].en, color: "#c8c8c4", size: 8, tilt: 0, spin: 1,
    diameter_km: o ? 2 * o.radius_km : null, credit: "usgs", mission: MOON_TEXTURES[key] };
}

export const MOON_KEYS = MOON_ORBITS.map((o) => o.key);
const ORBIT = Object.fromEntries(MOON_ORBITS.map((o) => [o.key, o]));
export const moonOrbit = (key) => ORBIT[key] || null;
export const moonName = (key, lang) => { const m = MOON_INFO[key]; return m ? (m[lang] || m.es) : key; };
/** Lunas de un planeta (clave de BODIES: "Júpiter"…), en orden de distancia al planeta. */
export const moonsOf = (parent) => MOON_ORBITS.filter((o) => o.parent === parent).sort((a, b) => a.a_km - b.a_km).map((o) => o.key);
export const hasMoons = (parent) => MOON_ORBITS.some((o) => o.parent === parent);

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; };

/** Días (UT) desde la época de las órbitas. */
export const daysSinceT0 = (date) => date.getTime() / 86400000 + 2440587.5 - MOON_T0_JD;

/** Posición de la luna respecto al centro del planeta, ICRF, km, en el instante t (días desde T0). */
export function moonVectorKm(key, t) {
  const o = ORBIT[key]; if (!o) return null;
  const lam = o.l0 + o.n * t;
  const nu = lam + 2 * o.e * Math.sin(lam - o.varpi);
  const r = o.a_km * (1 - o.e * Math.cos(lam - o.varpi));
  const X = o.X, Y = cross(o.N, o.X), c = Math.cos(nu), s = Math.sin(nu);
  return [r * (c * X[0] + s * Y[0]), r * (c * X[1] + s * Y[1]), r * (c * X[2] + s * Y[2])];
}

/** Ejes del plano del cielo en la dirección u (vector unitario Tierra → planeta, ICRF): este y norte. */
export function skyAxes(u) {
  const east = unit(cross([0, 0, 1], u));
  const north = cross(u, east);
  return { east, north };
}

/**
 * Vista de un planeta y sus lunas en una fecha. planet: { name (clave de BODIES), nx, ny, nz (dirección
 * J2000 ≈ ICRF), dist_au (Tierra–planeta), r_au (Sol–planeta) }.
 * Devuelve { radius (″), moons: [{ key, x, y (″; x hacia el este, y hacia el norte), sep (″), depth (km;
 * > 0 = más lejos que el planeta), state: "free" | "transit" | "hidden", mag }], ring (solo Saturno) }.
 */
export function planetView(planet, date) {
  const u = unit([planet.nx, planet.ny, planet.nz]);
  const D = planet.dist_au * AU_KM;
  const { east, north } = skyAxes(u);
  const t = daysSinceT0(date) - D / C_KMS / 86400;          // el sistema tal como era cuando salió su luz
  const R = (PLANET_RADIUS_KM[planet.name] || 0) / D * ARCSEC;
  const moons = moonsOf(planet.name).map((key) => {
    const v = moonVectorKm(key, t), o = ORBIT[key];
    const x = dot(v, east) / D * ARCSEC, y = dot(v, north) / D * ARCSEC, depth = dot(v, u);
    const sep = Math.hypot(x, y);
    const state = sep < R ? (depth > 0 ? "hidden" : "transit") : "free";
    // magnitud: la de Horizons en T0, corregida por las distancias de hoy (sin cambio de fase)
    const mag = planet.r_au && planet.dist_au ? o.mag + 5 * Math.log10((planet.r_au * planet.dist_au) / (o.r_au * o.d_au)) : o.mag;
    return { key, x, y, sep, depth, state, mag, aArcsec: o.a_km / D * ARCSEC, rArcsec: o.radius_km / D * ARCSEC };
  });
  let ring = null;
  if (planet.name === "Saturno") {
    // anillo: elipse de semieje mayor Rr y menor Rr·|sen B|, girada según el polo proyectado
    const Rr = SATURN_RING_KM / D * ARCSEC;
    const sinB = -dot(SATURN_POLE, u);                        // u apunta de la Tierra a Saturno
    const pe = dot(SATURN_POLE, east), pn = dot(SATURN_POLE, north);
    const poleAngle = Math.atan2(pe, pn);                      // ángulo de posición del polo (desde el norte hacia el este)
    ring = { a: Rr, b: Rr * Math.abs(sinB), inner: SATURN_RING_INNER_KM / D * ARCSEC, tilt: Math.asin(Math.max(-1, Math.min(1, sinB))) * 180 / Math.PI, pa: poleAngle * 180 / Math.PI };
  }
  return { radius: R, moons, ring, orient: planetOrientation(planet.name, u), flattening: POLAR_FLATTENING[planet.name] || 0 };
}

/**
 * Las lunas de un planeta como direcciones en el cielo (mismo marco que la del planeta, J2000 ≈ ICRF):
 * [{ key, dir: [x, y, z] unitario, state, mag, sep (″), aArcsec }]. Para dibujarlas en la escena.
 */
export function moonsSky(planet, date) {
  const n0 = Math.hypot(planet.nx, planet.ny, planet.nz), u = [planet.nx / n0, planet.ny / n0, planet.nz / n0];
  const { east, north } = skyAxes(u);
  return planetView(planet, date).moons.map((m) => {
    const ex = m.x / ARCSEC, ny = m.y / ARCSEC;
    const d = [u[0] + ex * east[0] + ny * north[0], u[1] + ex * east[1] + ny * north[1], u[2] + ex * east[2] + ny * north[2]];
    const n = Math.hypot(d[0], d[1], d[2]);
    return { key: m.key, dir: [d[0] / n, d[1] / n, d[2] / n], state: m.state, mag: m.mag, sep: m.sep, aArcsec: m.aArcsec };
  });
}

/** Con qué se ve (orientativo): según magnitud y separación del planeta, que deslumbra. */
export function seeWith(mag, sep, parent) {
  if (parent === "Marte") return "hard";                     // Fobos y Deimos se pierden en el brillo de Marte
  if (mag <= 7 && sep >= 60) return "binoculars";
  if (mag <= 10.5) return "small";
  if (mag <= 13.5) return "medium";
  return "large";
}

/** ¿Coincide un texto de búsqueda con una luna? (sin tildes, inicio de palabra o nombre completo). */
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function searchMoons(q) {
  const f = fold(q).trim();
  if (f.length < 2) return [];
  const planetFor = { marte: "Marte", mars: "Marte", jupiter: "Júpiter", saturno: "Saturno", saturn: "Saturno", urano: "Urano", uranus: "Urano", neptuno: "Neptuno", neptune: "Neptuno" };
  // «lunas de Júpiter», «moons of Saturn», «satélites de Urano», «galileanos»
  const m = /^(lunas?|moons?|satelites?|satellites?)( (de|of|del))? ?(.*)$/.exec(f);
  if (m) {
    const rest = m[4].trim();
    if (!rest) return f.startsWith("luna ") || f === "luna" || f === "moon" ? [] : MOON_KEYS.slice();
    const p = Object.keys(planetFor).find((k) => k.startsWith(rest) || rest.startsWith(k));
    return p ? moonsOf(planetFor[p]) : [];
  }
  if (/^galilea/.test(f) || /^galilean/.test(f)) return ["Io", "Europa", "Ganymede", "Callisto"];
  if (f.length < 2) return [];
  return MOON_KEYS.filter((k) => {
    const names = [MOON_INFO[k].es, MOON_INFO[k].en].map(fold);
    return names.some((n) => n === f || n.startsWith(f) || (f.length >= 3 && n.includes(f)));
  });
}
