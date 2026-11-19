// places.js — buscar un lugar del mundo para «Mi cielo» y una lista de sitios astronómicos y arqueológicos.
// Puro salvo searchPlaces(); se prueba en scripts/test_places.mjs.
//
// Buscador: Open-Meteo Geocoding (https://open-meteo.com/en/docs/geocoding-api), con los nombres de GeoNames
// (CC BY 4.0). Sale del navegador (permite CORS, sin claves; cuota gratuita por visitante). Da ciudades y pueblos
// con su altura; los sitios arqueológicos casi no los tiene, por eso van aparte, con coordenadas comprobadas.

export const GEOCODER = "https://geocoding-api.open-meteo.com/v1/search";

/**
 * Sitios astronómicos y arqueológicos (coordenadas de Wikipedia o de sus fichas oficiales, comprobadas el
 * 17-nov-2026; altura en m cuando la fuente la da). Teseo dibuja el relieve que los rodea y, donde los hay, los monumentos (src/sky/monuments.js): por eso
 * algunos sitios son un punto de vista frente al monumento, no su centro.
 */
export const SITES = [
  { id: "machupicchu", wiki: { es: "Machu_Picchu", en: "Machu_Picchu" }, name: { es: "Machu Picchu", en: "Machu Picchu" }, lat: -13.16312, lon: -72.545683, elev: 2430,
    note: { es: "Ciudadela inca del siglo XV sobre el río Urubamba, a 2.430 m (Perú). Desde la cima del Intihuatana, la piedra tallada «donde se amarra el Sol», mirando al Huayna Picchu; al sureste, más abajo, los templos de la Plaza Sagrada y, al otro lado de la plaza, el sector urbano (edificios en posición aproximada).", en: "15th-century Inca citadel above the Urubamba River, at 2,430 m (Peru). From the top of the Intihuatana hill, by the carved stone known as the hitching post of the Sun, facing Huayna Picchu; to the south-east, lower down, the temples of the Sacred Plaza and, across the main plaza, the urban sector (buildings in approximate positions)." } },
  { id: "chankillo", wiki: { es: "Chankillo", en: "Chankillo" }, name: { es: "Chankillo · Trece Torres", en: "Chankillo · Thirteen Towers" }, lat: -9.561185, lon: -78.229591, elev: null,
    note: { es: "Desde el punto de observación oeste, a unos 235 m de las torres: sus trece torres (entre 200 y 300 a. C.) forman un horizonte artificial que marca por dónde sale el Sol a lo largo del año, de la torre 1 en junio a la 13 en diciembre. Cómo usarlo: mira al este y adelanta la fecha en «Tiempo»: cada amanecer el Sol asoma por un hueco o una torre distinta, y así se sabía el día del año con dos o tres de margen. Patrimonio de la Humanidad desde 2021 (Perú).", en: "From the western observing point, about 235 m from the towers: its thirteen towers (200–300 BCE) form an artificial horizon marking where the Sun rises through the year, from tower 1 in June to tower 13 in December. How to use it: look east and step the date in “Time”: each sunrise the Sun appears at a different gap or tower, which gave the day of the year to within two or three days. World Heritage since 2021 (Peru)." } },
  { id: "cochasqui", wiki: { es: "Cochasqu%C3%AD", en: "Cochasqu%C3%AD" }, name: { es: "Cochasquí", en: "Cochasquí" }, lat: 0.055947, lon: -78.307397, elev: 3115,
    note: { es: "Pirámides truncas de los caranquis (c. 950–1530) en las faldas del Mojanda, a 3.100 m (Ecuador). De pie en el vértice oeste de la plataforma de la pirámide mayor, la G (unos 76 × 62 m), a 14 m sobre la ladera: al sur baja su rampa y alrededor quedan las otras catorce pirámides (A–P) y los montículos funerarios, cubiertos de hierba como están hoy. Disposición según el plano de Wentscher (1982); el alto de casi todas es estimado. En la plataforma de la E, la vecina, se hallaron dos círculos de barro cocido con canales que se han interpretado como calendarios.", en: "Caranqui truncated pyramids (c. 950–1530) on the slopes of Mojanda, at 3,100 m (Ecuador). Standing at the west corner of the platform of the largest pyramid, G (about 76 × 62 m), 14 m above the slope: its ramp runs down to the south and around it lie the other fourteen pyramids (A–P) and the burial mounds, grass-covered as they are today. Layout after the plan by Wentscher (1982); the height of most is estimated. On the platform of E, next to it, two fired-clay circles with channels were found and have been read as calendars." } },
  { id: "catequilla", wiki: { es: "Catequilla", en: "Catequilla" }, name: { es: "Catequilla · cima", en: "Catequilla · summit" }, lat: 0.000207, lon: -78.428426, elev: 2636,
    note: { es: "Cerro sobre la línea ecuatorial con un muro semicircular quitu-caranqui; según Cobo (2012), desde aquí el Sol sale por Cochasquí en junio, por el Reloj Solar Quitsato en los equinoccios y por Pambamarca en diciembre. Coordenadas GNSS del vértice medido por Cobo (Ecuador).", en: "Hill on the equator with a semicircular Quitu-Caranqui wall; according to Cobo (2012), from here the Sun rises over Cochasquí in June, over the Quitsato Sundial at the equinoxes and over Pambamarca in December. GNSS coordinates of the vertex surveyed by Cobo (Ecuador)." } },
  { id: "quitsato", wiki: { es: "Reloj_Solar_Quitsato", en: "Quitsato_Sundial" }, name: { es: "Reloj solar Quitsato", en: "Quitsato sundial" }, lat: 0.0, lon: -78.17518, elev: null,
    note: { es: "Reloj solar de 54 m de diámetro sobre la línea ecuatorial, cerca de Cayambe (Ecuador), inaugurado en 2007. Desde la plataforma, 20 m al oeste del poste: en los equinoccios el Sol sale justo detrás de él.", en: "A 54 m sundial on the equator near Cayambe (Ecuador), opened in 2007. From the platform, 20 m west of the pole: at the equinoxes the Sun rises right behind it." } },
  { id: "tiwanaku", wiki: { es: "Tiahuanaco", en: "Tiwanaku" }, name: { es: "Tiwanaku", en: "Tiwanaku" }, lat: -16.554757, lon: -68.672263, elev: 3863,
    note: { es: "Centro ceremonial de Tiwanaku (Bolivia), a unos 3.860 m. Desde el este, junto al Templete Semisubterráneo, en el eje de Kalasasaya: su portada enmarca la estela Ponce y, en los equinoccios, el Sol se pone justo detrás; al sur, Akapana.", en: "Tiwanaku ceremonial centre (Bolivia), at about 3,860 m. From the east, by the Semi-Subterranean Temple, on the axis of Kalasasaya: its gateway frames the Ponce Stela and, at the equinoxes, the Sun sets right behind it; to the south, Akapana." } },
  { id: "teotihuacan", wiki: { es: "Teotihuacan", en: "Teotihuacan" }, name: { es: "Teotihuacan · Pirámide del Sol", en: "Teotihuacan · Pyramid of the Sun" }, lat: 19.69300, lon: -98.84590, elev: 2300,
    note: { es: "Desde la Calzada de los Muertos, frente a la Pirámide del Sol (65 m, hacia los años 100–200); al norte, la de la Luna (México).", en: "From the Avenue of the Dead, facing the Pyramid of the Sun (65 m, built around 100–200 CE); to the north, the Pyramid of the Moon (Mexico)." } },
  { id: "chichenitza", wiki: { es: "Chich%C3%A9n_Itz%C3%A1", en: "Chichen_Itza" }, name: { es: "Chichén Itzá · El Castillo", en: "Chichen Itza · El Castillo" }, lat: 20.68425, lon: -88.56865, elev: null,
    note: { es: "Desde la Gran Plaza, frente a la escalinata norte de El Castillo o templo de Kukulcán, pirámide maya de los siglos VIII al XII (Yucatán, México).", en: "From the Great Plaza, facing the north stairway of El Castillo, the Temple of Kukulcan, a Maya pyramid from the 8th–12th centuries (Yucatán, Mexico)." } },
  { id: "paranal", wiki: { es: "Observatorio_Paranal", en: "Paranal_Observatory" }, name: { es: "Observatorio Paranal (ESO)", en: "Paranal Observatory (ESO)" }, lat: -24.627907, lon: -70.404299, elev: 2635,
    note: { es: "El observatorio de ESO con el Very Large Telescope, a 2.635 m en el desierto de Atacama (Chile). Desde la explanada, con los cuatro telescopios de 8,2 m al norte.", en: "ESO's observatory with the Very Large Telescope, at 2,635 m in the Atacama Desert (Chile). From the platform, with the four 8.2 m telescopes to the north." } },
  { id: "stonehenge", wiki: { es: "Stonehenge", en: "Stonehenge" }, name: { es: "Stonehenge", en: "Stonehenge" }, lat: 51.178844, lon: -1.826189, elev: null,
    note: { es: "Desde el centro del círculo de piedras (llanura de Salisbury, Inglaterra; 3000–2000 a. C.): el eje mira hacia donde sale el Sol en el solsticio de junio, sobre la Piedra del Talón.", en: "From the centre of the stone circle (Salisbury Plain, England; 3000–2000 BCE): its axis points to the June solstice sunrise, over the Heel Stone." } },
  { id: "newgrange", wiki: { es: "Newgrange", en: "Newgrange" }, name: { es: "Newgrange", en: "Newgrange" }, lat: 53.69464, lon: -6.47457, elev: null,
    note: { es: "Frente a la entrada de esta tumba de corredor de hacia el 3200 a. C. (Irlanda): en el solsticio de invierno, el Sol naciente entra por una abertura sobre la puerta y alumbra la cámara.", en: "Passage tomb from about 3200 BCE (Ireland): at the winter solstice the rising Sun shines through a roof-box and lights the chamber." } },
  { id: "giza", wiki: { es: "Necr%C3%B3polis_de_Guiza", en: "Giza_pyramid_complex" }, name: { es: "Pirámides de Guiza", en: "Pyramids of Giza" }, lat: 29.97120, lon: 31.12380, elev: null,
    note: { es: "Desde el mirador del suroeste: Micerino delante, Kefrén y la Gran Pirámide de Keops (hacia el 2600 a. C.) detrás (Egipto).", en: "From the south-west viewpoint: Menkaure in front, Khafre and the Great Pyramid of Khufu (about 2600 BCE) behind (Egypt)." } },
];

/** Página de Wikipedia del sitio (comprobadas el 18-nov-2026), en el idioma de la app. */
export const siteUrl = (site, lang = "es") => (site && site.wiki ? `https://${lang === "en" ? "en" : "es"}.wikipedia.org/wiki/${site.wiki[lang === "en" ? "en" : "es"]}` : null);

/** Texto sin tildes ni mayúsculas, para comparar. */
export const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Sitios cuyo nombre (en cualquier idioma) contiene el texto buscado. */
export function searchSites(q) {
  const f = fold(q);
  if (f.length < 2) return [];
  return SITES.filter((s) => fold(s.name.es).includes(f) || fold(s.name.en).includes(f) || fold(s.id).includes(f.replace(/\s+/g, "")));
}

/** URL de la búsqueda (8 resultados, en el idioma de la app). */
export function geocodeUrl(q, lang = "es") {
  const p = new URLSearchParams({ name: String(q).trim(), count: "8", language: lang === "en" ? "en" : "es", format: "json" });
  return `${GEOCODER}?${p}`;
}

/** Respuesta de Open-Meteo → [{ name, lat, lon, elev, region, country, cc }] (sin duplicados por nombre y lugar). */
export function parseGeocode(json) {
  const out = [], seen = new Set();
  for (const r of (json && json.results) || []) {
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude) || !r.name) continue;
    const key = `${r.name}|${r.latitude.toFixed(2)}|${r.longitude.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: r.name, lat: +r.latitude.toFixed(4), lon: +r.longitude.toFixed(4), elev: Number.isFinite(r.elevation) ? Math.round(r.elevation) : null,
      region: r.admin1 || null, country: r.country || null, cc: r.country_code || null });
  }
  return out;
}

/** Una línea para mostrar un resultado: «Comunidad de Madrid, España · 665 m». */
export function placeLine(p, lang = "es") {
  const parts = [p.region, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const el = p.elev != null ? `${p.elev.toLocaleString(lang === "es" ? "es" : "en-US", { useGrouping: "always" })} m` : null;
  return [parts.join(", "), el].filter(Boolean).join(" · ");
}

const cache = new Map();
/** Busca lugares del mundo (≥ 2 letras). Rechaza con Error si el servicio falla. */
export function searchPlaces(q, lang = "es", { fetchImpl = (typeof fetch !== "undefined" ? fetch : null), signal } = {}) {
  const key = `${lang}|${fold(q)}`;
  if (fold(q).length < 2) return Promise.resolve([]);
  if (cache.has(key)) return cache.get(key);
  if (!fetchImpl) return Promise.reject(new Error("sin red"));
  const p = fetchImpl(geocodeUrl(q, lang), signal ? { signal } : undefined).then(async (r) => {
    let body = null;
    try { body = await r.json(); } catch { /* no JSON */ }
    if (!r.ok) throw new Error((body && body.reason) || `HTTP ${r.status}`);
    return parseGeocode(body);
  });
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

export const TP = {
  es: {
    searchTitle: "Busca un lugar del mundo",
    placeholder: "Ciudad, pueblo o sitio…",
    searchAria: "Buscar un lugar por su nombre",
    searching: "Buscando…",
    none: "Sin resultados. Prueba con otro nombre o escribe las coordenadas abajo.",
    error: "No se pudo buscar ahora (Open-Meteo). Prueba más tarde o escribe las coordenadas.",
    sitesTitle: "Sitios astronómicos y arqueológicos",
    sitesHint: "Teseo dibuja las montañas que los rodean y también el monumento; donde la posición es aproximada, lo dice.",
    siteMore: "Saber más en Wikipedia",
    source: "Búsqueda: Open-Meteo, con los nombres de GeoNames (CC BY 4.0).",
    site: "Sitio",
  },
  en: {
    searchTitle: "Search any place in the world",
    placeholder: "City, town or site…",
    searchAria: "Search a place by name",
    searching: "Searching…",
    none: "No results. Try another name or type the coordinates below.",
    error: "Couldn't search right now (Open-Meteo). Try later or type the coordinates.",
    sitesTitle: "Astronomical and archaeological sites",
    sitesHint: "Teseo draws the mountains around them and the monument too; where a position is approximate, it says so.",
    siteMore: "Learn more on Wikipedia",
    source: "Search: Open-Meteo, with GeoNames place names (CC BY 4.0).",
    site: "Site",
  },
};
