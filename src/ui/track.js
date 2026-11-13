// track.js — analítica mínima, anónima y solo con consentimiento.
// Un único punto de salida para toda la app:  track("tab_change", { tab: "sky" })
//
// Reglas (no negociables):
//   · solo se envía si existe window.gtag Y el usuario aceptó el aviso de
//     cookies (localStorage "yd-consent" === "granted"); si no, no hace nada;
//   · solo viajan parámetros de una lista blanca, con valores cortos (cadena,
//     número o booleano): nunca texto libre, ubicación, coordenadas ni nada
//     que identifique a una persona;
//   · nunca lanza: la analítica no puede romper la app.

const ALLOWED = new Set(["tab", "from", "to", "origin", "destination", "lang", "section", "source", "card", "layer", "id", "state"]);
const NAME_RE = /^[a-z][a-z0-9_]{1,39}$/;

/** Limpia los parámetros: lista blanca de claves y valores primitivos cortos. Pura. */
export function cleanParams(params) {
  const out = {};
  if (!params || typeof params !== "object") return out;
  for (const k of Object.keys(params)) {
    if (!ALLOWED.has(k)) continue;
    const v = params[k];
    if (typeof v === "string") out[k] = v.slice(0, 40);
    else if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) out[k] = v;
  }
  return out;
}

/** true si hay consentimiento explícito de analítica en este navegador. */
export function hasConsent(win = typeof window !== "undefined" ? window : undefined) {
  try { return !!win && win.localStorage.getItem("yd-consent") === "granted"; } catch { return false; }
}

/**
 * Envía un evento anónimo. Devuelve true si se envió.
 * @param {string} event  nombre en snake_case (p. ej. "tab_change")
 * @param {object} [params] solo claves de la lista blanca
 */
export function track(event, params, win = typeof window !== "undefined" ? window : undefined) {
  try {
    if (!win || typeof win.gtag !== "function") return false;
    if (typeof event !== "string" || !NAME_RE.test(event)) return false;
    if (!hasConsent(win)) return false;
    win.gtag("event", event, cleanParams(params));
    return true;
  } catch { return false; }
}

export default track;
