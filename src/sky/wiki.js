// wiki.js — imagen y entradilla de Wikipedia para la ficha de un objeto.
//
// Por qué existe: el nombre con que llega un objeto no siempre es el título de su
// artículo. "James Webb (JWST)" acababa en la página de un baloncestista, "Gaia" en la
// diosa griega y "Hubble" en una desambiguación; y varias páginas en español no
// tienen imagen aunque la inglesa sí. Aquí hay:
//   1. un mapa explícito nombre → título (ES y EN) para sondas, telescopios y cometas,
//      comprobado contra la API de Wikipedia (fecha en WIKI_VERIFIED);
//   2. una cadena de candidatos para lo que no esté en el mapa, que descarta páginas
//      de desambiguación y, en las naves, artículos que no hablan de una nave;
//   3. si el artículo del idioma elegido no tiene imagen, se toma la del otro idioma
//      (la imagen no tiene idioma; el texto solo se muestra si está en el tuyo);
//   4. el autor y la licencia del archivo, para rotularlo con honestidad.
// Todo es opcional: si la red falla, la ficha muestra su representación esquemática.
import { fetchJson } from "../net.js";

export const WIKI_VERIFIED = "2026-11-13";

// clave normalizada (minúsculas, sin acentos ni paréntesis) → título en.wikipedia (y es.wikipedia
// cuando se comprobó). Si falta el título en español, se sigue el enlace interlingüístico del
// artículo inglés (langlinks), que es exacto por construcción.
const T = (en, es) => ({ en, es: es || null });
// Las 21 naves y los 7 cometas que sirve el backend se comprobaron uno a uno contra la API
// de Wikipedia el 13-nov-2026 (existe, no es desambiguación y tiene imagen).
export const PROBE_TITLES = {
  "voyager 1": T("Voyager 1", "Voyager 1"), "voyager 2": T("Voyager 2", "Voyager 2"), "new horizons": T("New Horizons", "New Horizons"),
  "parker solar probe": T("Parker Solar Probe", "Sonda Solar Parker"),
  "james webb": T("James Webb Space Telescope", "Telescopio espacial James Webb"),
  "hubble": T("Hubble Space Telescope", "Telescopio espacial Hubble"),
  "gaia": T("Gaia (spacecraft)", "Gaia (sonda espacial)"),
  "juno": T("Juno (spacecraft)", "Juno (sonda espacial)"), "lucy": T("Lucy (spacecraft)", "Lucy (sonda espacial)"),
  "psyche": T("Psyche (spacecraft)", "Psyche (nave espacial)"),
  "europa clipper": T("Europa Clipper", "Europa Clipper"), "juice": T("Jupiter Icy Moons Explorer", "Jupiter Icy Moons Explorer"),
  "bepicolombo": T("BepiColombo", "BepiColombo"), "hera": T("Hera (space mission)", "Hera (sonda)"),
  "solar orbiter": T("Solar Orbiter", "Solar Orbiter"),
  "mmx": T("Martian Moons eXploration"), "escapade": T("EscaPADE"),        // sin artículo en español comprobado: se sigue el enlace interlingüístico
  "mars reconnaissance orbiter": T("Mars Reconnaissance Orbiter", "Mars Reconnaissance Orbiter"), "mars express": T("Mars Express", "Mars Express"),
  "exomars trace gas orbiter": T("Trace Gas Orbiter", "ExoMars Trace Gas Orbiter"),
  // otras naves conocidas, por si el backend las añade (títulos en inglés comprobados)
  "euclid": T("Euclid (spacecraft)"), "chandra": T("Chandra X-ray Observatory"), "hayabusa2": T("Hayabusa2"), "maven": T("MAVEN"),
  "kepler": T("Kepler space telescope"), "akatsuki": T("Akatsuki (spacecraft)"), "lunar reconnaissance orbiter": T("Lunar Reconnaissance Orbiter"),
  "mars odyssey": T("2001 Mars Odyssey"), "xmm-newton": T("XMM-Newton"), "dscovr": T("Deep Space Climate Observatory"),
  "chandrayaan-2": T("Chandrayaan-2"), "aditya-l1": T("Aditya-L1"), "iss": T("International Space Station"),
};
export const COMET_TITLES = {
  "1p": T("Halley's Comet", "Cometa Halley"), "2p": T("Comet Encke", "2P/Encke"), "12p": T("12P/Pons–Brooks", "12P/Pons-Brooks"),
  "55p": T("55P/Tempel–Tuttle", "55P/Tempel-Tuttle"), "109p": T("Comet Swift–Tuttle", "109P/Swift-Tuttle"),
  "67p": T("67P/Churyumov–Gerasimenko", "67P/Churyumov-Gerasimenko"), "c/2023 a3": T("Comet Tsuchinshan–ATLAS"),
  "3i/atlas": T("3I/ATLAS"), "c/2025 a6": T("C/2025 A6 (Lemmon)"), "13p": T("13P/Olbers"), "c/2024 g3": T("C/2024 G3 (ATLAS)"),
  "29p": T("29P/Schwassmann–Wachmann"), "46p": T("46P/Wirtanen"), "21p": T("21P/Giacobini–Zinner"), "81p": T("81P/Wild"), "c/1995 o1": T("Comet Hale–Bopp"),
};
// alias: otras formas en que puede llegar el mismo nombre
export const PROBE_ALIASES = {
  "jwst": "james webb", "james webb space telescope": "james webb", "webb": "james webb",
  "hst": "hubble", "hubble space telescope": "hubble", "psp": "parker solar probe", "parker": "parker solar probe",
  "escapade blue": "escapade", "escapade gold": "escapade", "martian moons exploration": "mmx",
  "exomars tgo": "exomars trace gas orbiter", "tgo": "exomars trace gas orbiter", "trace gas orbiter": "exomars trace gas orbiter",
  "mro": "mars reconnaissance orbiter", "jupiter icy moons explorer": "juice",
};

/** Normaliza un nombre para buscarlo en los mapas. */
export function normName(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();
}
const outside = (s) => s.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
const inside = (s) => { const m = /\(([^)]+)\)/.exec(s); return m ? m[1].trim() : ""; };

/** Títulos explícitos { en, es|null } de una nave o un cometa, o null si su nombre no está en el mapa. */
export function mappedTitle(layer, name) {
  const n = normName(name);
  const keys = [n, outside(n), inside(n)].filter(Boolean);
  if (layer === "probes") {
    for (const k of keys) { const e = PROBE_TITLES[k] || PROBE_TITLES[PROBE_ALIASES[k]]; if (e) return e; }
    return null;
  }
  if (layer === "comets") {
    // "1P/Halley" → por su designación ("1p"); "C/2023 A3 (Tsuchinshan-ATLAS)" → "c/2023 a3"
    const base = outside(n), des = /^\d+[pd]\b/.test(base) ? base.split("/")[0] : base;
    for (const k of [n, base, des]) { const e = COMET_TITLES[k]; if (e) return e; }
    return null;
  }
  return null;
}

// Sistema solar y agujeros negros: los mismos títulos que ya usaba la ficha (si alguno resultara ser
// una desambiguación, se descarta y se sigue el enlace interlingüístico del artículo en inglés).
const SOLAR_WIKI = { "Sol": T("Sun", "Sol"), "Luna": T("Moon", "Luna"), "Mercurio": T("Mercury (planet)", "Mercurio (planeta)"), "Venus": T("Venus", "Venus (planeta)"), "Marte": T("Mars", "Marte"), "Júpiter": T("Jupiter", "Júpiter (planeta)"), "Saturno": T("Saturn", "Saturno (planeta)"), "Urano": T("Uranus", "Urano (planeta)"), "Neptuno": T("Neptune", "Neptuno (planeta)") };
const BH_WIKI = { "Sgr A*": T("Sagittarius A*", "Sagittarius A*"), "M87*": T("Messier 87", "Messier 87"), "M31* (Andrómeda)": T("Andromeda Galaxy", "Andromeda Galaxy"), "Gaia BH1": T("Gaia BH1", "Gaia BH1"), "Gaia BH3": T("Gaia BH3", "Gaia BH3") };
const SPACECRAFT_RE = /spacecraft|space probe|space telescope|telescope|satellite|space station|mission|orbiter|lander|rover|observatory|nasa|\besa\b|jaxa|sonda|telescopio|sat[eé]lite|estaci[oó]n espacial|misi[oó]n|nave|orbitador|observatorio|astromóvil/i;
const COMET_RE = /comet|cometa/i;

/**
 * Títulos candidatos, en orden, para buscar el artículo de un objeto.
 * Cada uno: { lang, title, check? } — `check(extracto)` descarta páginas que no tratan del objeto.
 */
export function wikiCandidates(obj, lang) {
  if (!obj || obj.layer === "note" || !obj.name) return [];
  const other = lang === "es" ? "en" : "es";
  const L = obj.layer, out = [];
  const add = (lg, title, check) => { if (title && !out.some((c) => c.lang === lg && c.title === title)) out.push({ lang: lg, title, check }); };
  const both = (fn) => { fn(lang); fn(other); };
  if (L === "solar") { const m = SOLAR_WIKI[obj.name]; both((lg) => add(lg, m ? (m[lg] || m.en) : obj.name)); }
  else if (L === "messier") both((lg) => add(lg, `Messier ${obj.m}`));
  else if (L === "star") both((lg) => add(lg, obj.name));
  else if (L === "blackholes") { const m = BH_WIKI[obj.name]; both((lg) => add(lg, m ? (m[lg] || m.en) : outside(obj.name))); }
  else if (L === "pulsars") both((lg) => { add(lg, outside(obj.name)); if (/^[JB]\d/.test(obj.name)) add(lg, "PSR " + outside(obj.name)); });
  else if (L === "galaxies") {
    // nombre común si lo hay; si no, el catálogo "NGC0055" → "NGC 55"
    const cat = (obj.cat || obj.name || "").replace(/^(NGC|IC)0*(\d+)/i, "$1 $2");
    both((lg) => { if (obj.cat && obj.name !== obj.cat) add(lg, obj.name); add(lg, cat); });
  }
  else if (L === "meteors") { add("es", obj.wiki_es || obj.name); add("en", obj.name_en || obj.name); if (lang === "en") out.reverse(); }
  else if (L === "exoplanets") { both((lg) => add(lg, obj.name)); if (obj.host) both((lg) => add(lg, obj.host)); }
  else if (L === "probes" || L === "comets") {
    const re = L === "probes" ? SPACECRAFT_RE : COMET_RE, ok = (x) => re.test(x || "");
    const m = mappedTitle(L, obj.name);                          // el mapa ya está comprobado: sin filtro
    if (m) { if (m[lang]) add(lang, m[lang]); add("en", m.en); if (m.es) add("es", m.es); }
    const base = outside(obj.name), alt = inside(obj.name);
    if (L === "probes") both((lg) => { add(lg, base, ok); add(lg, `${base} (${lg === "es" ? "sonda espacial" : "spacecraft"})`, ok); if (alt) add(lg, alt, ok); });
    else both((lg) => { add(lg, obj.name, ok); add(lg, base, ok); if (alt) add(lg, `${lg === "es" ? "Cometa" : "Comet"} ${alt}`, ok); });
  }
  else if (L === "con") {
    // "Orion (constellation)" / "Orión (constelación)"; el nombre solo suele ser el personaje o una desambiguación
    const ok = (x) => /constellation|constelaci[oó]n/i.test(x || "");
    add("en", `${obj.name} (constellation)`, ok); add("en", obj.name, ok);
    if (obj.es) { add("es", `${obj.es} (constelación)`, ok); add("es", obj.es, ok); }
    add("es", `${obj.name} (constelación)`, ok);
    if (lang === "es") out.sort((a, b) => (a.lang === "es" ? 0 : 1) - (b.lang === "es" ? 0 : 1));
  }
  else both((lg) => add(lg, obj.name));
  return out;
}

const cache = new Map();
const host = (lang) => (lang === "es" ? "es.wikipedia.org" : "en.wikipedia.org");

/** Un artículo: { lang, title, thumb, file, extract, url, missing, disamb } o null si la red falla. */
export async function fetchWiki(title, lang) {
  const key = lang + ":" + title;
  if (cache.has(key)) return cache.get(key);
  const url = `https://${host(lang)}/w/api.php?action=query&prop=pageimages%7Cextracts%7Cpageprops%7Clanglinks&lllang=${lang === "es" ? "en" : "es"}&lllimit=1&exintro&explaintext&redirects=1&piprop=thumbnail%7Cname&pithumbsize=640&ppprop=disambiguation&format=json&origin=*&titles=${encodeURIComponent(title)}`;
  try {
    // enriquecimiento opcional de la ficha: timeout corto y fallo silencioso
    const d = await fetchJson(url, { timeout: 10000 });
    const pg = Object.values(d.query.pages)[0];
    const res = {
      lang, title: pg.title, thumb: (pg.thumbnail || {}).source || null, file: pg.pageimage || null, extract: pg.extract || "",
      url: `https://${host(lang)}/wiki/${encodeURIComponent(String(pg.title).replace(/ /g, "_"))}`,
      langlink: (pg.langlinks && pg.langlinks[0] && pg.langlinks[0]["*"]) || null,
      missing: pg.missing !== undefined || pg.invalid !== undefined, disamb: !!(pg.pageprops && pg.pageprops.disambiguation !== undefined),
    };
    cache.set(key, res);
    return res;
  } catch { return null; }
}

/**
 * Recorre los candidatos y devuelve lo mejor que haya:
 *   { title, extract, url, lang }  artículo en el idioma de la interfaz (si existe)
 *   { thumb, file, imgUrl, imgLang } imagen (puede venir del artículo en el otro idioma)
 * o null si no hay nada utilizable. `isStale()` permite abandonar si la selección cambió.
 */
export async function fetchWikiFor(obj, lang, isStale = () => false) {
  const cands = wikiCandidates(obj, lang);
  let text = null, image = null, tried = 0;
  const usable = (w, c) => w && !w.missing && !w.disamb && !(c && c.check && !c.check(w.extract));
  for (const c of cands) {
    if (text && image) break;
    if (tried >= 7) break;
    if (c.lang !== lang && image && text) continue;
    if (c.lang !== lang && image && !text && tried > 3) continue;
    tried++;
    const w = await fetchWiki(c.title, c.lang);
    if (isStale()) return null;
    if (!usable(w, c)) continue;
    if (c.lang === lang) { if (!text) text = w; }
    else if (!text && w.langlink) {
      // el artículo del otro idioma dice cuál es su equivalente exacto en el tuyo
      const w2 = await fetchWiki(w.langlink, lang);
      if (isStale()) return null;
      if (usable(w2, null)) { text = w2; if (!image && w2.thumb) image = w2; }
    }
    if (!image && w.thumb) image = w;
  }
  if (!text && !image) return null;
  const base = text || image;
  return {
    title: base.title, lang: base.lang, url: base.url,
    extract: text ? text.extract : "",                     // nunca texto en otro idioma
    thumb: image ? image.thumb : null, file: image ? image.file : null,
    imgUrl: image ? image.url : null, imgLang: image ? image.lang : null,
    missing: false,
  };
}

const creditCache = new Map();
const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
/**
 * Autor y licencia de un archivo de imagen (metadatos de Wikimedia Commons).
 * Devuelve { artist, license, page } o null. `artist` puede faltar.
 */
export async function fetchImageCredit(file, lang = "en") {
  if (!file) return null;
  if (creditCache.has(file)) return creditCache.get(file);
  const url = `https://${host(lang)}/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&iiextmetadatafilter=Artist%7CLicenseShortName%7CCredit&format=json&origin=*&titles=${encodeURIComponent("File:" + file)}`;
  try {
    const d = await fetchJson(url, { timeout: 8000 });
    const pg = Object.values(d.query.pages)[0];
    const md = pg && pg.imageinfo && pg.imageinfo[0] && pg.imageinfo[0].extmetadata;
    if (!md) { creditCache.set(file, null); return null; }
    let artist = stripHtml((md.Artist || {}).value) || stripHtml((md.Credit || {}).value);
    if (artist.length > 70) artist = artist.slice(0, 68).replace(/\s+\S*$/, "") + "…";
    const res = { artist: artist || null, license: stripHtml((md.LicenseShortName || {}).value) || null, page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}` };
    creditCache.set(file, res);
    return res;
  } catch { return null; }
}
