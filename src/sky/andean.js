// andean.js — capa «Astronomía andina» del Cielo: (1) por dónde sale y se pone el Sol en los solsticios y
// equinoccios, sobre el horizonte REAL del lugar, en cualquier parte del mundo; (2) los sitios arqueoastronómicos
// quitu-caranquis cercanos (discos líticos, Catequilla, Cochasquí, Pambamarca…), rotulados donde se ven.
// Puro (sin React ni Three): se prueba en scripts/test_andean.mjs.
//
// FUENTES
//   · Cobo A., Cristóbal (2012). Astronomía Quitu-Caranqui, Catequilla y los discos líticos: evidencias de la
//     astronomía antigua en los Andes ecuatoriales. Quito: QUIMERADREAMS Editores. Tabla 1 (coordenadas
//     geodésicas GNSS, WGS84) de los discos líticos y el vértice de Catequilla; las alturas del libro son
//     elipsoidales: se restan 25 m (ondulación del geoide que da el propio libro en Catequilla: 25,38 m).
//   · Cochasquí, Pambamarca (cumbre) y el Reloj Solar Quitsato: coordenadas de Wikipedia. Cochasquí es un complejo
//     de 84 ha: el punto es su centro aproximado (±500 m).
// Solo se rotula lo que tiene coordenadas publicadas: los puntos de la tabla de acimuts de Cobo sin coordenadas
// (Jachi Rumi, Padre Rumi…) no se inventan a partir de su propio acimut.

const D = Math.PI / 180;
const dms = (d, m, s, sign = 1) => sign * (d + m / 60 + s / 3600);
const COBO = "cobo", WIKI = "wiki";

/** Sitios. elev en m sobre el nivel del mar; kind: "site" | "disc" | "summit" | "modern". */
export const ANDEAN_SITES = [
  { id: "catequilla", kind: "site", src: COBO, lat: dms(0, 0, 0.743445), lon: dms(78, 25, 42.334076, -1), elev: 2636, es: "Catequilla", en: "Catequilla" },
  { id: "d-catequilla", kind: "disc", src: COBO, lat: dms(0, 0, 2.151097), lon: dms(78, 25, 43.397144, -1), elev: 2633, es: "Disco lítico de Catequilla", en: "Catequilla stone disc", near: "catequilla" },
  { id: "d-quebrada-colorada", kind: "disc", src: COBO, lat: dms(0, 0, 24.770546), lon: dms(78, 26, 20.34127, -1), elev: 2387, es: "Disco lítico Quebrada Colorada", en: "Quebrada Colorada stone disc" },
  { id: "d-hda-rumicucho", kind: "disc", src: COBO, lat: dms(0, 0, 55.740311), lon: dms(78, 26, 37.279714, -1), elev: 2428, es: "Disco lítico Hacienda Rumicucho", en: "Hacienda Rumicucho stone disc" },
  { id: "d-rumicucho", kind: "disc", src: COBO, lat: dms(0, 0, 52.398252), lon: dms(78, 25, 50.311509, -1), elev: 2405, es: "Rumicucho", en: "Rumicucho" },
  { id: "d-itagua", kind: "disc", src: COBO, lat: dms(0, 3, 40.377078), lon: dms(78, 28, 0.407397, -1), elev: 2975, es: "Disco lítico Itagua", en: "Itagua stone disc" },
  { id: "d-jarata", kind: "disc", src: COBO, lat: dms(0, 0, 48.338887, -1), lon: dms(78, 25, 42.248757, -1), elev: 2655, es: "Disco lítico Jarata", en: "Jarata stone disc" },
  { id: "d-marca-alta", kind: "disc", src: COBO, lat: dms(0, 1, 53.107617), lon: dms(78, 27, 22.814899, -1), elev: 2979, es: "Disco lítico La Marca Alta", en: "La Marca Alta stone disc" },
  { id: "d-marca-baja", kind: "disc", src: COBO, lat: dms(0, 1, 39.140931), lon: dms(78, 27, 32.482591, -1), elev: 2871, es: "Disco lítico La Marca Baja", en: "La Marca Baja stone disc" },
  { id: "d-pacpo", kind: "disc", src: COBO, lat: dms(0, 1, 22.080994, -1), lon: dms(78, 25, 41.374822, -1), elev: 2754, es: "Disco lítico Pacpo", en: "Pacpo stone disc" },
  { id: "d-potrerillos", kind: "disc", src: COBO, lat: dms(0, 3, 21.59517), lon: dms(78, 26, 31.048235, -1), elev: 2316, es: "Disco lítico Potrerillos", en: "Potrerillos stone disc" },
  { id: "d-purgapamba", kind: "disc", src: COBO, lat: dms(0, 5, 11.624411), lon: dms(78, 26, 29.39517, -1), elev: 1951, es: "Disco lítico Purgapamba", en: "Purgapamba stone disc" },
  { id: "d-tanlagua-alta", kind: "disc", src: COBO, lat: dms(0, 2, 22.560312), lon: dms(78, 27, 12.913971, -1), elev: 2674, es: "Disco lítico Tanlagua Alta", en: "Tanlagua Alta stone disc" },
  { id: "d-tanlagua-baja", kind: "disc", src: COBO, lat: dms(0, 2, 22.575622), lon: dms(78, 27, 3.897551, -1), elev: 2604, es: "Disco lítico Tanlagua Baja", en: "Tanlagua Baja stone disc" },
  { id: "cochasqui", kind: "site", src: WIKI, lat: 0.05667, lon: -78.31028, elev: 3100, es: "Cochasquí", en: "Cochasquí" },
  { id: "pambamarca", kind: "summit", src: WIKI, lat: -0.07972, lon: -78.20861, elev: 4062, es: "Pambamarca (pucarás)", en: "Pambamarca (pukaras)" },
  { id: "quitsato", kind: "modern", src: WIKI, lat: 0, lon: -78.175, elev: 2800, es: "Reloj Solar Quitsato", en: "Quitsato Sundial" },
];

export const ANDEAN_RANGE_KM = 70;
const R_EARTH = 6371000;

/** Distancia (m) y acimut (grados desde el norte) de A a B, sobre la esfera. */
export function distAz(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * D, p2 = lat2 * D, dl = (lon2 - lon1) * D;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return { dist: 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a))), az: (Math.atan2(y, x) / D + 360) % 360 };
}

/** Altura angular aparente (grados) de un punto a `dist` m y `dh` m más alto, con la curvatura y la refracción (k = 0,13). */
export const apparentAltOf = (dist, dh) => (Math.atan2(dh, dist) - (dist / (2 * R_EARTH)) * (1 - 0.13)) / D;

/** Altura del horizonte (grados) en un acimut, interpolada en el perfil de /api/horizon. */
export function horizonAltAt(hz, az, arr = hz && hz.alt) {
  if (!hz || !Array.isArray(arr) || !arr.length) return 0;
  const st = hz.step_deg || 0.2, n = arr.length, i = (((az % 360) + 360) % 360) / st;
  const i0 = Math.floor(i) % n, i1 = (i0 + 1) % n, f = i - Math.floor(i);
  return arr[i0] * (1 - f) + arr[i1] * f;
}
/** Lo más alto del relieve MÁS CERCA que `distKm` en ese acimut (bandas de /api/horizon). */
function nearerRidge(hz, az, distKm) {
  let m = -90;
  for (const b of (hz && hz.bands) || []) if (b.max_km < distKm) m = Math.max(m, horizonAltAt(hz, az, b.alt));
  return m;
}

/**
 * Sitios a la vista desde el lugar (y los tapados por el relieve, marcados).
 * @returns [{ id, name, kind, src, az, alt, distKm, hidden }]  ordenados del más cercano al más lejano
 */
export function andeanSitesFrom({ lat, lon, ground = 0, eye = 1.7, hz = null, lang = "es", range = ANDEAN_RANGE_KM, sites = ANDEAN_SITES } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const out = [];
  for (const s of sites) {
    const { dist, az } = distAz(lat, lon, s.lat, s.lon);
    if (dist > range * 1000 || dist < 250) continue;                // lejos, o estás encima
    const alt = apparentAltOf(dist, s.elev - (ground + eye));
    const block = hz ? nearerRidge(hz, az, dist / 1000) : -90;
    out.push({ id: s.id, name: s[lang] || s.es, kind: s.kind, src: s.src, az, alt, distKm: dist / 1000, hidden: alt < block - 0.15 });
  }
  return out.sort((a, b) => a.distKm - b.distKm);
}

// ── el Sol en solsticios y equinoccios ────────────────────────────────────────────────────────────────────
export const OBLIQUITY = 23.436;          // grados (2026); hace 1000 años era 23,57°: el acimut cambia ~0,1°
const refr = (h) => 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * D) / 60;   // Sæmundsson, grados
/** Acimut (grados) del Sol con declinación `dec` a la altura verdadera `h`, al salir (rise) o al ponerse. */
function sunAz(lat, dec, h, rise) {
  const c = (Math.sin(dec * D) - Math.sin(lat * D) * Math.sin(h * D)) / (Math.cos(lat * D) * Math.cos(h * D));
  if (c < -1 || c > 1) return null;
  const A = Math.acos(c) / D;
  return rise ? A : 360 - A;
}
/**
 * Dónde asoma (o se esconde) el borde superior del Sol tras el relieve en solsticios y equinoccios.
 * @returns [{ key: "junRise"|"eqRise"|"decRise"|"junSet"|"eqSet"|"decSet", rise, dec, az, alt }]
 */
export function solarHorizonMarks(lat, hz = null) {
  const out = [];
  for (const [k, dec] of [["jun", OBLIQUITY], ["eq", 0], ["dec", -OBLIQUITY]]) {
    for (const rise of [true, false]) {
      let found = null;
      for (let h = -3; h <= 45; h += 0.02) {
        const az = sunAz(lat, dec, h, rise);
        if (az == null) break;                                       // ese día el Sol no sale o no se pone
        const top = h + refr(h) + 0.267;                             // borde superior aparente
        if (top >= horizonAltAt(hz, az)) { found = { az, alt: Math.max(top - 0.267, horizonAltAt(hz, az)) }; break; }
      }
      if (found) out.push({ key: `${k}${rise ? "Rise" : "Set"}`, rise, dec, az: found.az, alt: found.alt });
    }
  }
  return out;
}

export const TX_AND = {
  es: {
    layer: "Astronomía andina",
    desc: "Por dónde sale y se pone el Sol en solsticios y equinoccios, sobre tu horizonte real, y los sitios quitu-caranquis cercanos.",
    marks: { junRise: "Sale el Sol · solsticio de junio", eqRise: "Sale el Sol · equinoccios", decRise: "Sale el Sol · solsticio de diciembre",
      junSet: "Se pone el Sol · solsticio de junio", eqSet: "Se pone el Sol · equinoccios", decSet: "Se pone el Sol · solsticio de diciembre" },
    markSub: (az) => `${az}°`,
    siteSub: (km, hidden) => `${km} km${hidden ? " · tras el relieve" : ""}`,
    near: (n) => `${n} ${n === 1 ? "sitio cercano" : "sitios cercanos"} rotulados.`,
    none: "No hay sitios quitu-caranquis registrados cerca: se marcan solo las direcciones del Sol.",
    source: "Sitios y discos líticos: Cobo A., Cristóbal (2012), «Astronomía Quitu-Caranqui, Catequilla y los discos líticos», Quito, QUIMERADREAMS Editores (coordenadas GNSS). Cochasquí, Pambamarca y Quitsato: Wikipedia. Sol: calculado por Teseo con el relieve real.",
    caveat: "Que un sitio quede en la línea del Sol no prueba que se construyera a propósito.",
  },
  en: {
    layer: "Andean astronomy",
    desc: "Where the Sun rises and sets at the solstices and equinoxes, over your real horizon, plus nearby Quitu-Caranqui sites.",
    marks: { junRise: "Sunrise · June solstice", eqRise: "Sunrise · equinoxes", decRise: "Sunrise · December solstice",
      junSet: "Sunset · June solstice", eqSet: "Sunset · equinoxes", decSet: "Sunset · December solstice" },
    markSub: (az) => `${az}°`,
    siteSub: (km, hidden) => `${km} km${hidden ? " · behind the terrain" : ""}`,
    near: (n) => `${n} nearby ${n === 1 ? "site" : "sites"} labelled.`,
    none: "No Quitu-Caranqui sites recorded nearby: only the Sun's directions are marked.",
    source: "Sites and stone discs: Cobo A., Cristóbal (2012), “Astronomía Quitu-Caranqui, Catequilla y los discos líticos”, Quito, QUIMERADREAMS Editores (GNSS coordinates). Cochasquí, Pambamarca and Quitsato: Wikipedia. Sun: computed by Teseo over the real terrain.",
    caveat: "A site lying on the Sun's line does not prove it was built on purpose.",
  },
};

/** Etiquetas para el Cielo: primero las direcciones del Sol, luego los sitios a la vista. */
export function andeanLabels({ lat, lon, ground, hz, lang = "es" }) {
  const T = TX_AND[lang] || TX_AND.es;
  const nf = (x, d) => Number(x).toLocaleString(lang === "es" ? "es" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sun = solarHorizonMarks(lat, hz).map((m) => ({ az: m.az, alt: m.alt, name: m.key, label: T.marks[m.key], subText: T.markSub(nf(m.az, 1)), cls: "andsun" }));
  const sites = andeanSitesFrom({ lat, lon, ground, hz, lang }).filter((s) => !s.hidden || s.kind !== "disc")
    .map((s) => ({ az: s.az, alt: s.alt, name: s.id, label: s.name, subText: T.siteSub(nf(s.distKm, s.distKm < 10 ? 1 : 0), s.hidden), cls: "andsite" }));
  return { sun, sites, all: [...sun, ...sites] };
}
