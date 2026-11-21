// volcanoes.js — los volcanes del Holoceno del Smithsonian (Global Volcanism Program, /api/volcanoes) junto a los
// nombres de las montañas del horizonte: a cada cumbre que es un volcán se le une su ficha (tipo, última erupción,
// entorno tectónico, roca) y un enlace a su página en el Smithsonian. La base no se guarda en el repositorio (ver
// backend/app/volcanoes.py): el servidor la lee en vivo.

const mem = new Map();
const cellOf = (lat, lon) => `${(Math.round(lat * 2) / 2).toFixed(1)},${(Math.round(lon * 2) / 2).toFixed(1)}`;

/** Volcanes a menos de 260 km (celdas de 0,5°: una consulta sirve para toda la zona). Promesa de una lista. */
export function fetchVolcanoes(lat, lon, { api = "", fetchImpl = (typeof fetch !== "undefined" ? fetch : null) } = {}) {
  const key = cellOf(lat, lon);
  if (mem.has(key)) return mem.get(key);
  if (!fetchImpl) return Promise.reject(new Error("sin red"));
  const [la, lo] = key.split(",");
  const p = fetchImpl(`${api}/api/volcanoes?lat=${la}&lon=${lo}&r_km=260`).then(async (r) => {
    let body = null;
    try { body = await r.json(); } catch { /* no JSON */ }
    if (!r.ok || !body || !Array.isArray(body.volcanoes)) throw new Error((body && body.detail) || `HTTP ${r.status}`);
    return body.volcanoes;
  });
  mem.set(key, p);
  p.catch(() => mem.delete(key));
  return p;
}

const R = 6371;
export function kmBetween(la1, lo1, la2, lo2) {
  const r = Math.PI / 180, dp = (la2 - la1) * r, dl = (lo2 - lo1) * r;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
/** Punto a `d` km en el rumbo `az` (grados desde el norte) desde (lat, lon). */
export function destPoint(lat, lon, az, d) {
  const r = Math.PI / 180, δ = d / R, θ = az * r, φ1 = lat * r, λ1 = lon * r;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [φ2 / r, ((λ2 / r + 540) % 360) - 180];
}

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^(volcan|nevado|cerro|mount|monte|mt\.?)\s+/, "").trim();

/**
 * A cada cumbre del horizonte, su volcán del Smithsonian: el más cercano a menos de 6 km de la cumbre (o a menos de
 * 15 km si se llama igual: el punto del Smithsonian suele estar en el cráter o el centro del macizo). Cada volcán va
 * a una sola cumbre (la más cercana). Devuelve copias de las cumbres, con `volcano` las que lo son.
 */
export function matchVolcanoes(peaks, volcs, obsLat, obsLon) {
  if (!Array.isArray(peaks)) return [];
  if (!Array.isArray(volcs) || !volcs.length) return peaks.map((p) => ({ ...p }));
  const pos = peaks.map((p) => (Number.isFinite(p.lat) && Number.isFinite(p.lon) ? [p.lat, p.lon]
    : Number.isFinite(obsLat) && Number.isFinite(p.az) && Number.isFinite(p.dist_km) ? destPoint(obsLat, obsLon, p.az, p.dist_km) : null));
  const pairs = [];
  volcs.forEach((v, vi) => peaks.forEach((p, pi) => {
    if (!pos[pi]) return;
    const d = kmBetween(pos[pi][0], pos[pi][1], v.lat, v.lon);
    const same = fold(p.name) && (fold(p.name) === fold(v.name) || fold(p.name_es) === fold(v.name) || fold(p.name_en) === fold(v.name));
    if (d < 6 || (same && d < 15)) pairs.push({ vi, pi, d: same ? d - 6 : d });
  }));
  pairs.sort((a, b) => a.d - b.d);
  const usedV = new Set(), usedP = new Set(), out = peaks.map((p) => ({ ...p }));
  for (const q of pairs) {
    if (usedV.has(q.vi) || usedP.has(q.pi)) continue;
    usedV.add(q.vi); usedP.add(q.pi);
    out[q.pi].volcano = volcs[q.vi];
  }
  return out;
}

/** ¿Erupción en los últimos ~125 años (desde 1900)? Para marcar el nombre en el horizonte. */
export const recentEruption = (v) => !!(v && Number.isFinite(v.last_year) && v.last_year >= 1900);

const TYPES = {
  es: { stratovolcano: "Estratovolcán", "stratovolcano(es)": "Estratovolcanes", compound: "Volcán compuesto", caldera: "Caldera", "caldera(s)": "Calderas",
    shield: "Volcán en escudo", "shield(s)": "Volcanes en escudo", "lava dome": "Domo de lava", "lava dome(s)": "Domos de lava", "pyroclastic cone": "Cono piroclástico",
    "pyroclastic cone(s)": "Conos piroclásticos", "volcanic field": "Campo volcánico", complex: "Complejo volcánico", "fissure vent(s)": "Fisuras",
    maar: "Maar", "maar(s)": "Maares", submarine: "Volcán submarino", "tuff cone(s)": "Conos de toba", "lava cone": "Cono de lava", "subglacial": "Volcán subglaciar" },
  en: {},
};
const ROCKS = {
  es: { andesite: "andesita", "basaltic andesite": "andesita basáltica", dacite: "dacita", rhyolite: "riolita", basalt: "basalto", "picro-basalt": "picrobasalto",
    trachyte: "traquita", trachyandesite: "traquiandesita", "trachybasalt": "traquibasalto", phonolite: "fonolita", "trachyte / trachydacite": "traquita / traquidacita",
    "trachyandesite / basaltic trachyandesite": "traquiandesita", "andesite / basaltic andesite": "andesita / andesita basáltica", "basalt / picro-basalt": "basalto / picrobasalto",
    "dacite": "dacita", "rhyolite": "riolita", "foidite": "foidita", "tephrite / basanite / trachybasalt": "tefrita / basanita" },
};
const TECT = {
  es: [["subduction zone", "Zona de subducción"], ["rift zone", "Zona de rift"], ["intraplate", "Intraplaca"]],
  en: [["subduction zone", "Subduction zone"], ["rift zone", "Rift zone"], ["intraplate", "Intraplate"]],
};
const tr = (map, v) => (v ? map[String(v).trim().toLowerCase()] || v : null);

export const VT = {
  es: {
    volcano: "Volcán", mountain: "Cumbre", from: (d, dir) => `a ${d} km, hacia el ${dir}`, alt: "Altura",
    type: "Tipo", last: "Última erupción", tect: "Entorno", rock: "Roca principal", where: "País y región",
    lastYear: (y) => (y < 0 ? `hacia el ${(-y).toLocaleString("es", { useGrouping: "always" })} a. C.` : String(y)),
    ongoing: (y) => `${y} (en curso o muy reciente)`, unknown: "Sin fecha conocida",
    recent: "Ha entrado en erupción desde 1900.", more: "Ver en el Smithsonian",
    sub: (h, y) => `${h} · erupción ${y}`,
    src: "Datos del volcán: Global Volcanism Program, Smithsonian Institution (Volcanoes of the World). Altura de la cumbre: OpenStreetMap / Wikidata.",
    noVolc: "No figura como volcán del Holoceno en la base del Smithsonian (o lo es de hace más de 12 000 años).",
    goSummit: "Situarme en su cumbre",
  },
  en: {
    volcano: "Volcano", mountain: "Summit", from: (d, dir) => `${d} km away, to the ${dir}`, alt: "Height",
    type: "Type", last: "Last eruption", tect: "Setting", rock: "Main rock", where: "Country and region",
    lastYear: (y) => (y < 0 ? `around ${(-y).toLocaleString("en-US")} BCE` : String(y)),
    ongoing: (y) => `${y} (ongoing or very recent)`, unknown: "No known date",
    recent: "It has erupted since 1900.", more: "View at the Smithsonian",
    sub: (h, y) => `${h} · erupted ${y}`,
    src: "Volcano data: Global Volcanism Program, Smithsonian Institution (Volcanoes of the World). Summit height: OpenStreetMap / Wikidata.",
    noVolc: "Not listed as a Holocene volcano in the Smithsonian database (or older than 12,000 years).",
    goSummit: "Put me on its summit",
  },
};

/** Datos de la ficha ya traducidos: [{ label, value }]. */
export function volcanoFacts(v, lang = "es", nowYear = new Date().getFullYear()) {
  const T = VT[lang] || VT.es, out = [];
  if (!v) return out;
  if (v.type) out.push({ label: T.type, value: (lang === "es" ? tr(TYPES.es, v.type) : v.type) });
  const y = v.last_year;
  out.push({ label: T.last, value: Number.isFinite(y) ? (y >= nowYear - 1 ? T.ongoing(y) : T.lastYear(y)) : T.unknown });
  if (v.tectonic) {
    const low = v.tectonic.toLowerCase(), hit = (TECT[lang] || TECT.es).find(([k]) => low.includes(k));
    out.push({ label: T.tect, value: hit ? hit[1] + (low.includes("continental") ? (lang === "es" ? ", corteza continental" : ", continental crust") : low.includes("oceanic") ? (lang === "es" ? ", corteza oceánica" : ", oceanic crust") : "") : v.tectonic });
  }
  if (v.rock) out.push({ label: T.rock, value: lang === "es" ? tr(ROCKS.es, v.rock) : v.rock });
  const where = [v.country, v.region && v.region !== v.country ? v.region : null].filter(Boolean).join(" · ");
  if (where) out.push({ label: T.where, value: where });
  return out;
}
