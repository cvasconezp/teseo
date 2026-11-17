// seo.js — idioma y dirección canónica para buscadores. Puro (se prueba en Node).
//
// Teseo tiene una sola página con dos idiomas. Para que Google indexe cada idioma por
// separado, cada uno tiene su propia dirección:
//   español  → https://teseo.yachaydeep.com/          (la principal, x-default)
//   inglés   → https://teseo.yachaydeep.com/?lang=en
// index.html declara ambas con hreflang y la app ajusta la canónica al idioma visible.
// Los rastreadores no tienen preferencia guardada y suelen anunciar inglés: sin ?lang=
// ven el español, que es el idioma principal de Teseo.

export const SITE = "https://teseo.yachaydeep.com/";

/** "?lang=en" → "en"; "?lang=es" → "es"; otro → null */
export function langFromSearch(search) {
  try { const v = new URLSearchParams(String(search || "")).get("lang"); return v === "en" || v === "es" ? v : null; } catch { return null; }
}

/** ¿Es un buscador o una herramienta de vista previa? */
export function isCrawler(ua) {
  return /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|lighthouse|google-inspectiontool|chrome-lighthouse/i.test(String(ua || ""));
}

/** Idioma inicial: ?lang= > preferencia guardada > (rastreador → español) > idioma del navegador > español */
export function pickLang({ search = "", saved = null, nav = "", ua = "" } = {}) {
  const q = langFromSearch(search);
  if (q) return q;
  if (saved === "es" || saved === "en") return saved;
  if (isCrawler(ua)) return "es";
  if (/^en\b/i.test(String(nav || ""))) return "en";
  return "es";
}

/** Dirección canónica de cada idioma */
export const canonicalFor = (lang) => (lang === "en" ? `${SITE}?lang=en` : SITE);

/** Mantiene ?lang= coherente con el idioma elegido, sin tocar el resto (ni el #). Solo si ya estaba. */
export function searchWithLang(search, lang) {
  const p = new URLSearchParams(String(search || ""));
  if (!p.has("lang")) return null;
  if (lang === "es") p.delete("lang"); else p.set("lang", lang);
  const s = p.toString();
  return s ? `?${s}` : "";
}
