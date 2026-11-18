// sunImage.js — el Sol de verdad en el cielo: la imagen en luz visible del Solar Dynamics Observatory (NASA), con
// las manchas de ese momento. SDO publica una cada 15 minutos desde mayo de 2010 (instrumento HMI, «Intensitygram»
// coloreado, 1024 px; cortesía de NASA/SDO y los equipos científicos de AIA, EVE y HMI; dominio público):
//   https://sdo.gsfc.nasa.gov/assets/img/browse/AAAA/MM/DD/AAAAMMDD_HHMM00_1024_HMIIC.jpg
// El servidor de SDO no manda cabeceras CORS: la imagen se pide por el intermediario de Teseo (/api/img), que ya
// la admite (backend/app/img_proxy.py). Puro salvo la carga; se prueba en scripts/test_sunimage.mjs.

export const SDO_START_MS = Date.UTC(2010, 4, 15);     // primeras imágenes de HMI
export const SDO_LAG_MS = 60 * 60 * 1000;              // las imágenes tardan en publicarse: se pide la de hace una hora
export const SDO_FUTURE_MS = 12 * 3600 * 1000;         // más allá de 12 h en el futuro no hay Sol real que mostrar
const SLOT = 15 * 60 * 1000;

// en la imagen de 1024 px el disco está centrado y mide 961 px de diámetro (medido: de la columna 31 a la 992)
export const SDO_DISC = { c: 511.5 / 1024, r: 480.5 / 1024 };

/** Polo norte de rotación del Sol (J2000): AR 286,13°, Dec +63,87° (IAU). Vector ecuatorial unitario. */
export const SUN_POLE = (() => { const a = 286.13 * Math.PI / 180, d = 63.87 * Math.PI / 180; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; })();

/**
 * Instante (ms) de la imagen que corresponde a `whenMs`, o null si no hay: antes de 2010 o más de 12 h en el
 * futuro. Para «ahora» (y hasta 12 h después) es la última publicada.
 */
export function sdoSlot(whenMs, nowMs = Date.now()) {
  if (!Number.isFinite(whenMs) || whenMs - nowMs > SDO_FUTURE_MS) return null;
  const t = Math.floor(Math.min(whenMs, nowMs - SDO_LAG_MS) / SLOT) * SLOT;
  return t < SDO_START_MS ? null : t;
}

/** URL de SDO de la imagen de un instante (ms, múltiplo de 15 min). */
export function sdoUrl(slotMs) {
  const d = new Date(slotMs), p = (n) => String(n).padStart(2, "0");
  const ymd = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
  return `https://sdo.gsfc.nasa.gov/assets/img/browse/${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${ymd}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}00_1024_HMIIC.jpg`;
}

/** La misma, por el intermediario de Teseo (con CORS). */
export const sdoProxied = (slotMs, api = "") => `${api}/api/img?u=${encodeURIComponent(sdoUrl(slotMs))}`;

/**
 * Carga la imagen del Sol de `whenMs`. Si falta la de ese cuarto de hora (hay huecos), prueba las tres anteriores.
 * Devuelve una promesa de { img, slot } o null (sin imagen: se queda la textura genérica).
 */
export function loadSunImage(whenMs, { api = "", nowMs = Date.now(), ImageCtor = (typeof Image !== "undefined" ? Image : null) } = {}) {
  const first = sdoSlot(whenMs, nowMs);
  if (first == null || !ImageCtor) return Promise.resolve(null);
  const attempt = (slot, left) => new Promise((resolve) => {
    const img = new ImageCtor();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ img, slot });
    img.onerror = () => resolve(left > 0 && slot - SLOT >= SDO_START_MS ? attempt(slot - SLOT, left - 1) : null);
    img.src = sdoProxied(slot, api);
  });
  return attempt(first, 3);
}
