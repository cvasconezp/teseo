// nasaImages.js — imágenes CURADAS de la NASA Image and Video Library (images.nasa.gov).
// ÚNICO lugar donde se decide qué imagen de la NASA representa a cada objeto.
//
// Por qué un mapa hecho a mano y no una búsqueda: la búsqueda libre de la biblioteca
// devuelve, para una nave, ruedas de prensa, técnicos, cohetes y antenas antes que la
// nave. Cada entrada de aquí se eligió mirando la imagen (fecha en NASA_VERIFIED) y
// se guarda con el título, el crédito y la fecha que da la propia API
// (https://images-api.nasa.gov/search?nasa_id=…). Para volver a comprobarlas contra
// la API real:  node scripts/test_sky_nasa.mjs --red
//
//   kind       "photo"  → fotografía u observación real;
//              "artist" → ilustración o concepto artístico (no es una foto);
//              "render" → imagen generada por computadora a partir de datos.
//   processed  true si es una observación real pero NO lo que vería el ojo: luz no
//              visible (infrarrojo, ultravioleta, rayos X), colores falsos o un mosaico
//              reproyectado. La interfaz lo dice.
//   es / en    qué muestra exactamente la imagen, en una línea.
//   big        tamaño mayor disponible en JPEG ("medium" ≈ 1280 px, o "small" ≈ 640 px).
//   credit     tal como lo da la NASA (campo secondary_creator/photographer, o el
//              «Credit:» de la descripción); "NASA" cuando el registro solo indica el centro.
//
// Condiciones de uso (NASA Images and Media Usage Guidelines,
// https://www.nasa.gov/nasa-brand-center/images-and-media/): el material de la NASA en
// general no tiene copyright y puede usarse con fines educativos e informativos citando
// la fuente; NO se usan aquí imágenes con el logotipo de la NASA como motivo, con
// personas identificables ni de terceros con copyright propio (por eso no hay entrada
// para las naves de la ESA o JAXA cuya única imagen en la biblioteca es «© ESA»).
// El crédito se muestra siempre junto a la imagen, con enlace a su página.
export const NASA_VERIFIED = "2026-11-13";

export const NASA_IMAGES = {
  "probe:voyager 1": {"id": "PIA17462", "title": "Voyager 1 Entering Interstellar Space Artist Concept", "credit": "NASA/JPL-Caltech", "center": "JPL", "date": "2013-09-12", "kind": "artist", "big": "medium", "es": "Concepto artístico de la Voyager 1 entrando en el espacio interestelar", "en": "Artist's concept of Voyager 1 entering interstellar space"},
  "probe:voyager 2": {"id": "PIA17049", "title": "Voyager in Space Artist Concept", "credit": "NASA/JPL-Caltech", "center": "JPL", "date": "2013-09-12", "kind": "artist", "big": "small", "es": "Concepto artístico de una sonda Voyager (las dos son gemelas)", "en": "Artist's concept of a Voyager spacecraft (the two are twins)"},
  "probe:new horizons": {"id": "PIA10075", "title": "New Horizons at Pluto Artist Concept", "credit": "NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute", "center": "JPL", "date": "2007-07-02", "kind": "artist", "big": "medium", "es": "Concepto artístico de New Horizons junto a Plutón", "en": "Artist's concept of New Horizons at Pluto"},
  "probe:hubble": {"id": "s109e5014", "title": "Hubble Space Telescope prior to grapple by STS-109 orbiter Columbia", "credit": "NASA", "center": "JSC", "date": "2002-03-03", "kind": "photo", "big": "medium", "es": "Foto tomada desde el transbordador Columbia (misión STS-109, 2002)", "en": "Photo taken from Space Shuttle Columbia (STS-109 mission, 2002)"},
  "probe:juno": {"id": "PIA13746", "title": "Juno Mission to Jupiter 2010 Artist Concept", "credit": "NASA/JPL", "center": "JPL", "date": "2011-01-03", "kind": "artist", "big": "medium", "es": "Concepto artístico de Juno ante Júpiter", "en": "Artist's concept of Juno at Jupiter"},
  "probe:psyche": {"id": "PIA24473", "title": "Psyche Spacecraft (Illustration)", "credit": "NASA/JPL-Caltech/ASU", "center": "JPL", "date": "2021-03-29", "kind": "artist", "big": "medium", "es": "Ilustración de la nave Psyche", "en": "Illustration of the Psyche spacecraft"},
  "probe:europa clipper": {"id": "PIA26068", "title": "Europa Clipper Artist's Concept", "credit": "NASA/JPL-Caltech", "center": "JPL", "date": "2024-08-27", "kind": "artist", "big": "medium", "es": "Concepto artístico de Europa Clipper en órbita de Júpiter", "en": "Artist's concept of Europa Clipper in orbit around Jupiter"},
  "probe:mars reconnaissance orbiter": {"id": "PIA04241", "title": "Artist concept of Mars Reconnaissance Orbiter", "credit": "NASA/JPL", "center": "JPL", "date": "2002-12-21", "kind": "artist", "big": "medium", "es": "Concepto artístico de Mars Reconnaissance Orbiter", "en": "Artist's concept of Mars Reconnaissance Orbiter"},
  "probe:mars express": {"id": "PIA04802", "title": "Mars Express, Artist Concept", "credit": "JPL/NASA/ESA", "center": "JPL", "date": "2003-10-22", "kind": "artist", "big": "medium", "es": "Concepto artístico de Mars Express en órbita de Marte", "en": "Artist's concept of Mars Express in orbit around Mars"},
  "probe:escapade": {"id": "KSC-20240822-PH-KLS01_0033", "title": "ESCAPADE Unboxed at Astrotech", "credit": "NASA/Kim Shiflett", "center": "KSC", "date": "2024-08-22", "kind": "photo", "big": "medium", "es": "Las dos naves ESCAPADE en la sala limpia antes del lanzamiento (2024)", "en": "The two ESCAPADE spacecraft in the clean room before launch (2024)"},
  "comet:1p": {"id": "PIA17485", "title": "Comet Halley", "credit": "NASA/ESA/Giotto Project", "center": "JPL", "date": "1986-03-14", "kind": "photo", "big": "small", "es": "El núcleo del cometa, fotografiado por la sonda europea Giotto en 1986", "en": "The comet's nucleus, photographed by the European Giotto probe in 1986"},
  "comet:2p": {"id": "PIA07222", "title": "Riding a Trail of Debris", "credit": "NASA/JPL-Caltech/Univ. of Minn.", "center": "JPL", "date": "2005-01-11", "kind": "photo", "big": "medium", "es": "Imagen infrarroja del telescopio espacial Spitzer: el cometa y su estela de escombros", "en": "Infrared image from the Spitzer Space Telescope: the comet and its debris trail", "processed": true},
  "comet:c/2023 a3": {"id": "iss072e020907", "title": "Comet C/2023 A3 is pictured from the International Space Station", "credit": "NASA", "center": "JSC", "date": "2024-09-28", "kind": "photo", "big": "medium", "es": "Foto tomada desde la Estación Espacial Internacional el 28 de septiembre de 2024", "en": "Photo taken from the International Space Station on 28 September 2024"},
  "solar:Sol": {"id": "PIA26681", "title": "Image of Sun From NASA's Solar Dynamics Observatory", "credit": "NASA/GSFC/Solar Dynamics Observatory", "center": "JPL", "date": "2025-09-15", "kind": "photo", "big": "medium", "es": "Imagen en ultravioleta extremo del Solar Dynamics Observatory (10 sep 2025)", "en": "Extreme-ultraviolet image from the Solar Dynamics Observatory (10 Sep 2025)", "processed": true},
  "solar:Luna": {"id": "PIA00405", "title": "Earth Moon", "credit": "NASA/JPL/USGS", "center": "JPL", "date": "1998-06-08", "kind": "photo", "big": "medium", "es": "Foto de la sonda Galileo (7 dic 1992)", "en": "Photo from the Galileo spacecraft (7 Dec 1992)"},
  "solar:Mercurio": {"id": "PIA11245", "title": "Mercury as Never Seen Before", "credit": "NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington", "center": "JPL", "date": "2008-10-07", "kind": "photo", "big": "small", "es": "Foto de la sonda MESSENGER durante su sobrevuelo de 2008", "en": "Photo from the MESSENGER spacecraft during its 2008 flyby"},
  "solar:Venus": {"id": "PIA00271", "title": "Venus - Computer Simulated Global View of the Northern Hemisphere", "credit": "NASA/JPL", "center": "JPL", "date": "1996-07-18", "kind": "render", "big": "medium", "es": "Vista global generada por computadora a partir del radar de la sonda Magallanes: la superficie bajo las nubes", "en": "Computer-simulated global view from Magellan radar data: the surface beneath the clouds"},
  "solar:Marte": {"id": "PIA00407", "title": "Global Color Views of Mars", "credit": "NASA/JPL/USGS", "center": "JPL", "date": "1998-06-08", "kind": "photo", "big": "medium", "es": "Mosaico de fotos de los orbitadores Viking, proyectado sobre un globo", "en": "Mosaic of Viking orbiter photos, projected onto a globe", "processed": true},
  "solar:Júpiter": {"id": "PIA04866", "title": "Cassini Jupiter Portrait", "credit": "NASA/JPL/Space Science Institute", "center": "JPL", "date": "2003-11-13", "kind": "photo", "big": "medium", "es": "Mosaico en color real de la sonda Cassini", "en": "True-colour mosaic from the Cassini spacecraft"},
  "solar:Saturno": {"id": "PIA06193", "title": "The Greatest Saturn Portrait ...Yet", "credit": "NASA/JPL/Space Science Institute", "center": "JPL", "date": "2005-02-24", "kind": "photo", "big": "medium", "es": "Mosaico en color natural de 126 fotos de la sonda Cassini (2004)", "en": "Natural-colour mosaic of 126 photos from the Cassini spacecraft (2004)"},
  "solar:Urano": {"id": "PIA18182", "title": "Uranus as seen by NASA Voyager 2", "credit": "NASA/JPL-Caltech", "center": "JPL", "date": "1986-12-18", "kind": "photo", "big": "medium", "es": "Foto de la sonda Voyager 2 (1986)", "en": "Photo from the Voyager 2 spacecraft (1986)"},
  "solar:Neptuno": {"id": "PIA01492", "title": "Neptune (Voyager 2)", "credit": "NASA/JPL", "center": "JPL", "date": "1998-10-30", "kind": "photo", "big": "medium", "es": "Foto de la sonda Voyager 2 (1989)", "en": "Photo from the Voyager 2 spacecraft (1989)"},
  "messier:1": {"id": "PIA03606", "title": "Most Detailed Image of the Crab Nebula", "credit": "NASA/ESA/JPL/Arizona State Univ.", "center": "JPL", "date": "2005-12-01", "kind": "photo", "big": "medium", "es": "Mosaico del telescopio espacial Hubble", "en": "Hubble Space Telescope mosaic", "processed": true},
  "messier:8": {"id": "PIA13453", "title": "WISE Catches the Lagoon Nebula in Center of Action", "credit": "NASA/JPL-Caltech/UCLA", "center": "JPL", "date": "2011-01-06", "kind": "photo", "big": "medium", "es": "Mosaico infrarrojo del telescopio espacial WISE", "en": "Infrared mosaic from the WISE space telescope", "processed": true},
  "messier:16": {"id": "PIA03096", "title": "Towering Infernos", "credit": "IRAC Image: NASA/JPL-Caltech/Harvard-Smithsonian CfA/ESA/STScI; Visible Light Image: NASA/JPL-Caltech/Harvard-Smithsonian CfA/DSS", "center": "JPL", "date": "2005-11-09", "kind": "photo", "big": "medium", "es": "Imagen infrarroja del telescopio espacial Spitzer (colores falsos)", "en": "Infrared image from the Spitzer Space Telescope (false colour)", "processed": true},
  "messier:17": {"id": "PIA12071", "title": "Celestial Sea of Stars", "credit": "NASA/JPL-Caltech/Univ. of Wisc.", "center": "JPL", "date": "2008-12-08", "kind": "photo", "big": "medium", "es": "Imagen infrarroja del telescopio espacial Spitzer", "en": "Infrared image from the Spitzer Space Telescope", "processed": true},
  "messier:27": {"id": "PIA14417", "title": "Weighing in on the Dumbbell Nebula", "credit": "NASA/JPL-Caltech/Harvard-Smithsonian CfA", "center": "JPL", "date": "2011-08-10", "kind": "photo", "big": "medium", "es": "Imagen infrarroja del telescopio espacial Spitzer", "en": "Infrared image from the Spitzer Space Telescope", "processed": true},
  "messier:31": {"id": "PIA15416", "title": "Andromeda", "credit": "NASA/JPL-Caltech", "center": "JPL", "date": "2012-05-16", "kind": "photo", "big": "medium", "es": "Imagen ultravioleta del telescopio espacial GALEX", "en": "Ultraviolet image from the GALEX space telescope", "processed": true},
  "messier:33": {"id": "PIA03033", "title": "Anatomy of a Triangulum", "credit": "NASA/JPL-Caltech", "center": "JPL", "date": "2005-10-13", "kind": "photo", "big": "medium", "es": "Imagen ultravioleta del telescopio espacial GALEX", "en": "Ultraviolet image from the GALEX space telescope", "processed": true},
  "messier:42": {"id": "PIA01322", "title": "Chaos at the Heart of Orion", "credit": "NASA/JPL-Caltech/STScI", "center": "JPL", "date": "2006-11-07", "kind": "photo", "big": "medium", "es": "Combinación de los telescopios espaciales Spitzer (infrarrojo) y Hubble", "en": "Combined view from the Spitzer (infrared) and Hubble space telescopes", "processed": true},
  "messier:45": {"id": "PIA09262", "title": "Pink Pleiades", "credit": "NASA/JPL-Caltech", "center": "JPL", "date": "2007-04-16", "kind": "photo", "big": "medium", "es": "Imagen infrarroja del telescopio espacial Spitzer: el polvo que rodea a las Pléyades", "en": "Infrared image from the Spitzer Space Telescope: the dust around the Pleiades", "processed": true},
  "messier:51": {"id": "GSFC_20171208_Archive_e001925", "title": "The Two-faced Whirlpool Galaxy", "credit": "NASA, ESA, S. Beckwith (STScI), and the Hubble Heritage Team (STScI/AURA)", "center": "GSFC", "date": "2017-12-08", "kind": "photo", "big": "medium", "es": "Imagen en luz visible del telescopio espacial Hubble (parte central de la galaxia)", "en": "Visible-light image from the Hubble Space Telescope (central part of the galaxy)", "processed": true},
  "messier:57": {"id": "GSFC_20171208_Archive_e001464", "title": "Hubble reveals the Ring Nebula’s true shape", "credit": "NASA, ESA, C. R. O'Dell (Vanderbilt University) et al.; Large Binocular Telescope: D. Thompson (University of Arizona)", "center": "GSFC", "date": "2017-12-08", "kind": "photo", "big": "small", "es": "Hubble (luz visible) combinado con infrarrojo del Large Binocular Telescope", "en": "Hubble (visible light) combined with infrared from the Large Binocular Telescope", "processed": true},
  "messier:81": {"id": "PIA09579", "title": "M81 Galaxy is Pretty in Pink", "credit": "NASA/JPL-Caltech/ESA/Harvard-Smithsonian CfA", "center": "JPL", "date": "2007-06-01", "kind": "photo", "big": "medium", "es": "Combinación de los telescopios espaciales Spitzer, Hubble y GALEX", "en": "Combined view from the Spitzer, Hubble and GALEX space telescopes", "processed": true},
  "messier:87": {"id": "PIA23122", "title": "Spitzer Captures Messier 87", "credit": "NASA/JPL-Caltech/IPAC/Event Horizon Telescope Collaboration", "center": "JPL", "date": "2019-04-25", "kind": "photo", "big": "medium", "es": "Imagen infrarroja de Spitzer; el recuadro amplía las ondas de choque de los chorros", "en": "Spitzer infrared image; the inset enlarges the shock waves from the jets", "processed": true},
  "messier:101": {"id": "PIA15630", "title": "Pinwheel Galaxy Rainbow", "credit": "NASA/JPL-Caltech/ESA/STScI/CXC", "center": "JPL", "date": "2012-05-23", "kind": "photo", "big": "medium", "es": "Combinación de cuatro telescopios espaciales (infrarrojo, visible, ultravioleta y rayos X)", "en": "Combined view from four space telescopes (infrared, visible, ultraviolet and X-rays)", "processed": true},
  "messier:104": {"id": "PIA15226", "title": "Hubble Spies Spectacular Sombrero", "credit": "NASA/STScI/AURA", "center": "JPL", "date": "2005-05-05", "kind": "photo", "big": "medium", "es": "Imagen del telescopio espacial Hubble", "en": "Hubble Space Telescope image", "processed": true},
  "bh:Sgr A*": {"id": "PIA12348", "title": "Great Observatories Unique Views of the Milky Way", "credit": "NASA/JPL-Caltech/ESA/CXC/STScI", "center": "JPL", "date": "2009-11-10", "kind": "photo", "big": "medium", "es": "El centro de la Vía Láctea visto por Hubble, Spitzer y Chandra; Sgr A* está en la zona blanca brillante (no se ve el agujero negro en sí)", "en": "The centre of the Milky Way seen by Hubble, Spitzer and Chandra; Sgr A* lies in the bright white region (the black hole itself is not visible)", "processed": true},
  "bh:M87*": {"id": "PIA23122", "title": "Spitzer Captures Messier 87", "credit": "NASA/JPL-Caltech/IPAC/Event Horizon Telescope Collaboration", "center": "JPL", "date": "2019-04-25", "kind": "photo", "big": "medium", "es": "Su galaxia, M87, en infrarrojo (Spitzer); el recuadro amplía los chorros que lanza el agujero negro (no es la imagen de su sombra)", "en": "Its galaxy, M87, in infrared (Spitzer); the inset enlarges the jets launched by the black hole (this is not the image of its shadow)", "processed": true},
};

// Objetos del backend para los que NO se encontró una imagen adecuada en la biblioteca
// (se buscó el 13-nov-2026): la ficha usa Wikipedia, como antes. Queda escrito para que
// la ausencia sea una decisión visible y no un olvido.
export const NASA_NONE = {
  "probe:parker solar probe": "solo fotos de montaje con técnicos y del cohete",
  "probe:james webb": "solo fotos de sala limpia con personas o con el logotipo de la NASA, y ruedas de prensa",
  "probe:gaia": "nave de la ESA: sin imagen en la biblioteca",
  "probe:lucy": "solo fotos de montaje con técnicos y del lanzamiento",
  "probe:juice": "nave de la ESA: solo fotos de un instrumento en pruebas",
  "probe:bepicolombo": "nave de ESA/JAXA: sin imagen en la biblioteca",
  "probe:hera": "nave de la ESA: sin imagen en la biblioteca",
  "probe:solar orbiter": "solo fotos del cohete y del montaje",
  "probe:mmx": "nave de JAXA: sin imagen en la biblioteca",
  "probe:exomars trace gas orbiter": "las imágenes disponibles tienen crédito exclusivo de la ESA",
  "comet:12p": "sin imagen en la biblioteca", "comet:55p": "sin imagen en la biblioteca", "comet:109p": "sin imagen en la biblioteca",
  "comet:67p": "las imágenes disponibles son «© ESA/Rosetta»",
  "messier:13": "sin imagen clara del cúmulo", "messier:20": "solo paneles comparativos con anotaciones", "messier:82": "solo imágenes con gráficos superpuestos",
};

const PROBE_ALIAS = {
  "jwst": "james webb", "james webb space telescope": "james webb", "webb": "james webb", "hst": "hubble", "hubble space telescope": "hubble",
  "escapade blue": "escapade", "escapade gold": "escapade", "mro": "mars reconnaissance orbiter", "psp": "parker solar probe",
  "exomars tgo": "exomars trace gas orbiter", "tgo": "exomars trace gas orbiter", "trace gas orbiter": "exomars trace gas orbiter",
  "martian moons exploration": "mmx", "jupiter icy moons explorer": "juice",
};
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();
const outside = (s) => s.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
const inside = (s) => { const m = /\(([^)]+)\)/.exec(s); return m ? m[1].trim() : ""; };

/** Clave del mapa para un objeto ("probe:juno", "comet:1p", "solar:Marte", "messier:42", "bh:Sgr A*"), o null. */
export function nasaKey(obj) {
  if (!obj || !obj.layer || !obj.name) return null;
  const L = obj.layer;
  if (L === "probes") {
    const n = norm(obj.name);
    for (const k of [n, outside(n), inside(n)].filter(Boolean)) {
      const key = "probe:" + (PROBE_ALIAS[k] || k);
      if (NASA_IMAGES[key] || NASA_NONE[key]) return key;
    }
    return "probe:" + (PROBE_ALIAS[outside(n)] || outside(n));
  }
  if (L === "comets") {
    const base = outside(norm(obj.name));
    return "comet:" + (/^\d+[pd]\b/.test(base) ? base.split("/")[0] : base);
  }
  if (L === "solar") return "solar:" + obj.name;
  if (L === "messier") return obj.m != null ? "messier:" + obj.m : null;
  if (L === "blackholes") return "bh:" + obj.name;
  return null;
}

const ASSETS = "https://images-assets.nasa.gov/image/";
/** URL de un tamaño ("thumb" | "small" | "medium" | "large") de una imagen de la biblioteca. */
export const nasaUrl = (id, size = "small") => `${ASSETS}${encodeURIComponent(id)}/${encodeURIComponent(id)}~${size}.jpg`;
/** Página de la imagen en NASA Images (título, descripción completa y descargas). */
export const nasaPage = (id) => `https://images.nasa.gov/details/${encodeURIComponent(id)}`;

/**
 * Imagen curada de un objeto, lista para usar:
 *   { id, title, credit, date, kind, processed, es, en, src (≈640 px, ficha), srcBig (postal), page }
 * o null si el objeto no tiene entrada (entonces: Wikipedia y, si no, representación propia).
 */
export function nasaImageFor(obj) {
  const key = nasaKey(obj), e = key && NASA_IMAGES[key];
  if (!e) return null;
  return { ...e, processed: !!e.processed, key, src: nasaUrl(e.id, "small"), srcBig: nasaUrl(e.id, e.big || "small"), page: nasaPage(e.id) };
}

/** Clave del rótulo (t.nasaKind[…]) que dice qué clase de imagen es. Nunca "photo" para una ilustración. */
export const nasaKindKey = (e) => (e.kind === "photo" ? (e.processed ? "processed" : "photo") : e.kind === "render" ? "render" : "artist");

/**
 * Orden de las fuentes de imagen para un objeto (la representación propia va siempre al final):
 *   naves, cometas y cuerpos del sistema solar → NASA curada, luego Wikipedia;
 *   cielo profundo y lo demás                  → Wikipedia, luego NASA curada.
 * Razón: de una nave, la biblioteca de la NASA tiene la imagen "oficial" y dice con certeza si es
 * foto o ilustración (Wikipedia no siempre); de una nebulosa o galaxia, la imagen principal de
 * Wikipedia suele ser la vista completa en luz visible, y las de la NASA elegidas aquí son a
 * menudo infrarrojas o detalles: buenas como respaldo, no como primera opción.
 */
export function imageOrder(obj) {
  const L = obj && obj.layer;
  return L === "probes" || L === "comets" || L === "solar" ? ["nasa", "wiki"] : ["wiki", "nasa"];
}

// caché en memoria del resultado de cargar cada imagen: "ok" | "fail" (no se reintenta en la misma sesión)
const status = new Map();
export const nasaStatus = (id) => status.get(id) || null;
export const setNasaStatus = (id, s) => { status.set(id, s); };
