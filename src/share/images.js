// images.js — imágenes remotas que se DIBUJAN en el lienzo de las imágenes para compartir.
//
// Un <canvas> queda «manchado» (tainted) si se le dibuja una imagen de otro origen que no responde con
// Access-Control-Allow-Origin: después ya no se puede exportar a PNG. Por eso cada host se clasifica:
//
//   CORS_HOSTS   responden «Access-Control-Allow-Origin: *» → se cargan directo con crossOrigin.
//                Comprobado con curl (cabecera Origin) el 16-nov-2026:
//                  thespacedevs-prod.nyc3.digitaloceanspaces.com (fotos de Launch Library 2) → «*»
//                  cdn.esawebb.org, cdn.esahubble.org, cdn.eso.org (agencyImages.js) → «*»
//   PROXY_HOSTS  NO lo hacen (o no siempre) → se piden a través del proxy de Teseo, GET /api/img?u=…
//                (backend/app/img_proxy.py, con la MISMA lista de hosts):
//                  sdo.gsfc.nasa.gov (imagen del día de SDO/HMI): sin cabecera CORS (3 de 3 pruebas)
//                  images-assets.nasa.gov (NASA Image Library): irregular (1 de 3 sin cabecera)
//
// Cualquier otro host no se dibuja: la tarjeta usa su representación con su rótulo. Si una imagen falla
// (red, proxy no desplegado, lienzo manchado), también: nunca se rompe la generación.
import { loadImage, isClean } from "../sky/postcard.js";

export const CORS_HOSTS = ["thespacedevs-prod.nyc3.digitaloceanspaces.com", "cdn.esawebb.org", "cdn.esahubble.org", "cdn.eso.org"];
export const PROXY_HOSTS = ["sdo.gsfc.nasa.gov", "images-assets.nasa.gov"];
export const PROXY_PATH = "/api/img";

/** Host de una URL https (en minúsculas), o null si no es https o no se puede leer. Pura. */
export function httpsHost(u) {
  try {
    const url = new URL(String(u));
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    return url.hostname.toLowerCase();
  } catch { return null; }
}

/** URL del proxy de Teseo para `u`, SOLO si es https y su host está en PROXY_HOSTS; si no, null. Pura. */
export function proxyUrl(u, api = "") {
  const h = httpsHost(u);
  if (!h || !PROXY_HOSTS.includes(h)) return null;
  return `${String(api || "").replace(/\/+$/, "")}${PROXY_PATH}?u=${encodeURIComponent(String(u))}`;
}

/**
 * Cómo se carga una imagen remota (pura): { mode: "cors" | "proxy" | "none", urls: [...] } — urls en orden
 * de intento. En un host del proxy se intenta primero el proxy y luego directo (por si ese día sí trae CORS).
 */
export function remotePlan(u, api = "") {
  const h = httpsHost(u);
  if (!h) return { mode: "none", urls: [] };
  if (CORS_HOSTS.includes(h)) return { mode: "cors", urls: [String(u)] };
  if (PROXY_HOSTS.includes(h)) return { mode: "proxy", urls: [proxyUrl(u, api), String(u)] };
  return { mode: "none", urls: [] };
}

/** Carga una imagen remota que se pueda dibujar SIN manchar el lienzo, o null. Nunca lanza. */
export async function loadRemoteImage(u, api = "", ms = 9000) {
  const plan = remotePlan(u, api);
  for (const src of plan.urls) {
    try {
      const img = await loadImage(src, true, ms);
      if (img && isClean(img)) return { img, via: src === u ? "direct" : "proxy" };
    } catch { /* siguiente */ }
  }
  return null;
}
