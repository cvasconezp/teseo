// caldwell.js — búsqueda en la capa Caldwell (public/caldwell.json), sin React ni DOM: la usan
// Constellations.jsx y scripts/test_sky_caldwell.mjs.
//
// Se encuentra cada objeto por «C80», «c 80», «Caldwell 80», «NGC 5139» / «NGC5139», por cualquiera de sus
// nombres comunes en español o en inglés y por el título de su artículo; sin distinguir acentos
// («tarantula», «nube de magallanes»). Las Nubes de Magallanes, además, por «LMC» / «SMC».

/** Minúsculas y sin acentos. */
export const deacc = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Alias que, escritos enteros, identifican el objeto: el primero de los resultados. */
export function caldwellAliases(o) {
  const out = [String(o.name || "").toLowerCase()];
  if (o.c != null) out.push(`c ${o.c}`, `caldwell ${o.c}`, `caldwell${o.c}`);
  for (const id of o.ids || []) {
    const m = /^(NGC|IC)0*(\d+)$/.exec(id);
    if (m) out.push(`${m[1].toLowerCase()} ${m[2]}`, `${m[1].toLowerCase()}${m[2]}`);
  }
  return out;
}

const HAY = new WeakMap();
function hayOf(o) {
  let h = HAY.get(o);
  if (!h) {
    const alias = caldwellAliases(o);
    const names = [o.cn, o.cn_es, o.cat, o.wiki, o.wiki_es].filter(Boolean).join(" ");
    h = { alias, text: deacc(alias.join(" ") + " " + names) };
    HAY.set(o, h);
  }
  return h;
}

/**
 * ¿Coincide el objeto con la búsqueda `q`? Devuelve null o { exact }.
 *   extra       texto adicional para buscar (p. ej. el nombre de la constelación)
 *   otherLoaded true si la capa donde vive el objeto (campo `in`, p. ej. «Galaxias») ya está cargada:
 *               entonces solo se busca por su número Caldwell, para no repetir el resultado que ya da esa capa.
 */
export function caldwellMatch(o, q, { extra = "", otherLoaded = false } = {}) {
  const qd = deacc(q).trim();
  if (qd.length < 2) return null;
  const h = hayOf(o);
  const exact = h.alias.includes(qd);
  if (o.in && otherLoaded && !(exact || (o.c != null && (`c${o.c}`.startsWith(qd) || `caldwell ${o.c}`.startsWith(qd))))) return null;
  return (h.text + " " + deacc(extra)).includes(qd) ? { exact } : null;
}
