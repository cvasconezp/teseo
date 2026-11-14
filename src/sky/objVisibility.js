// objVisibility.js — salida, culminación, puesta, mejor momento y posición ACTUAL (altura/azimut)
// de un objeto de la vista Cielo desde «Mi cielo». Puro (sin DOM ni React): lo usan la ficha
// (ObjectSheet.jsx → RiseSet) y el aviso de «Encuéntralo»; lo prueba scripts/test_sky_frames.mjs.
//
// Marcos (ver frames.js):
//   · Las salidas, puestas y alturas se calculan en el ecuador y equinoccio DE LA FECHA, con el tiempo
//     sidéreo de la fecha (guide.js → altAz).
//   · Sol, Luna y planetas: ephemeris() ya está en la fecha (geocéntrico). La Luna sale y se pone con el
//     criterio de Meeus cap. 15 sobre la altura geocéntrica, h0 = 0,7275·π − 0,5667° (riseset.js → moonH0),
//     con su paralaje del momento. La altura y el azimut de «ahora» son TOPOCÉNTRICOS (frames.js →
//     topocentric), los mismos que dibuja el Cielo: para la Luna, hasta ~1° menos que la geocéntrica.
//   · Estrellas, constelaciones y cielo profundo: el catálogo está en J2000; se precesan a la fecha
//     (frames.js → j2000ToDate). En un día la precesión cambia 0,00004°: basta hacerlo una vez.
import { riseTransitSet, bestTonight, horizonFor, moonH0 } from "./riseset.js";
import { altAz } from "./guide.js";
import { ephemeris } from "../ephemeris.js";
import { j2000ToDate, topocentric, bodyDistKm } from "./frames.js";

// el cuerpo `name` de ephemeris(d), con un pequeño recuerdo del último instante (las búsquedas
// piden la dirección y la distancia del mismo instante seguidas)
function bodyCache(name) {
  let ms = NaN, b = null;
  return (d) => { const t = d.getTime(); if (t !== ms) { ms = t; b = ephemeris(d).find((x) => x.name === name); } return b; };
}
const dirOfBody = (b) => [b.nx, b.ny, b.nz];

/**
 * { rts, best, now, isSun } o null si el objeto no tiene dirección.
 *   obj    objeto de la escena: { layer, name, nx, ny, nz } (nx… en J2000; para "solar" se usa ephemeris por nombre)
 *   local  { lat, lon, elev? } (grados; metros)
 *   when   Date
 */
export function visibilityOf(obj, local, when) {
  if (!obj || obj.nx == null || !local) return null;
  const solar = obj.layer === "solar";
  const isSun = solar && obj.name === "Sol", isMoon = solar && obj.name === "Luna";
  let dirAt, minAlt, nowDir;
  if (solar) {
    const at = bodyCache(obj.name);
    dirAt = (d) => dirOfBody(at(d));
    minAlt = isMoon ? (ms) => moonH0(at(new Date(ms)).dist_km) : horizonFor(isSun ? "sun" : "star");
    const b0 = at(when), km = bodyDistKm(b0);
    nowDir = km > 0 ? topocentric(dirOfBody(b0), km, local.lat, local.lon, local.elev || 0, when).dir : dirOfBody(b0);
  } else {
    const v = j2000ToDate([obj.nx, obj.ny, obj.nz], when);
    dirAt = () => v;
    minAlt = horizonFor("star");
    nowDir = v;
  }
  const rts = riseTransitSet(dirAt, local.lat, local.lon, when, { minAlt });
  const now = altAz(nowDir[0], nowDir[1], nowDir[2], local.lat, local.lon, when);
  const sunAt = bodyCache("Sol"), sunDirAt = (d) => dirOfBody(sunAt(d));
  // estrellas débiles y cielo profundo piden cielo oscuro (−12°); la Luna y los planetas ya se ven con −6°
  const best = isSun ? null : bestTonight(dirAt, sunDirAt, local.lat, local.lon, when, { sunLimit: solar ? -6 : -12 });
  return { rts, best, now, isSun };
}
