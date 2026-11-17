// satellite.js — las nubes vistas desde el espacio, para el panel de Clima de la vista Cielo.
//
// Fuentes, con CORS abierto y sin claves; se elige la que mejor ve el lugar:
//   · NASA GIBS (https://gibs.earthdata.nasa.gov): GOES-Este (GOES-19, sobre 75,2° O; de Alaska a la Patagonia,
//     México, Centro y Sudamérica) y GOES-Oeste (GOES-18, sobre 137° O; costa oeste de EE. UU., Hawái), con el
//     «GeoColor» de NOAA/CIRA: color real de día y nubes por infrarrojo sobre las luces de las ciudades de
//     noche, cada 10 minutos.
//   · EUMETSAT (https://view.eumetsat.int): Meteosat de Tercera Generación (MTG-I1, sobre 0°; Europa, África,
//     Oriente Medio y el Atlántico), «GeoColour» cada 10 minutos.
//   · Fuera de su alcance (Asia oriental, Oceanía), la pasada diaria de VIIRS en el NOAA-20 (GIBS, color real).
// La hora de la imagen más reciente se pregunta al servicio (dominio de tiempos de GIBS o capacidades WMS de la
// capa en EUMETSAT); la imagen se pide por WMS en coordenadas geográficas y se proyecta aquí sobre un globo
// (proyección ortográfica, la de una foto desde lejos) centrado en el lugar. Lo que el satélite no ve se rellena con la Tierra de fondo (NASA Blue Marble), atenuada.
// Puro salvo fetchLatestTime(); se prueba en scripts/test_weather.mjs.

export const GIBS = "https://gibs.earthdata.nasa.gov";
export const EUMETSAT = "https://view.eumetsat.int/geoserver";
const RAD = Math.PI / 180;

const GIBS_WMS = `${GIBS}/wms/epsg4326/best/wms.cgi`, EUM_WMS = `${EUMETSAT}/wms`;
export const SOURCES = {
  "goes-east": { id: "goes-east", wms: GIBS_WMS, layer: "GOES-East_ABI_GeoColor", matrix: "1km", subLon: -75.2, sat: "GOES-19", geo: true, format: "image/png", by: "NOAA/CIRA · NASA GIBS" },
  "goes-west": { id: "goes-west", wms: GIBS_WMS, layer: "GOES-West_ABI_GeoColor", matrix: "1km", subLon: -137.0, sat: "GOES-18", geo: true, format: "image/png", by: "NOAA/CIRA · NASA GIBS" },
  mtg: { id: "mtg", wms: EUM_WMS, layer: "mtg_fd:rgb_geocolour", subLon: 0, sat: "Meteosat-12 (MTG)", geo: true, format: "image/png", by: "EUMETSAT" },
  viirs: { id: "viirs", wms: GIBS_WMS, layer: "VIIRS_NOAA20_CorrectedReflectance_TrueColor", matrix: "250m", sat: "NOAA-20 (VIIRS)", geo: false, format: "image/jpeg", by: "NASA GIBS" },
};
const GEO_SOURCES = [SOURCES["goes-east"], SOURCES["goes-west"], SOURCES.mtg];
const GEO_REACH = 62;   // grados de longitud desde el punto subsatélite en los que la imagen aún es útil

const dLon = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
/** El satélite que mejor ve una longitud. */
export function pickSource(lon) {
  const geo = GEO_SOURCES.map((s) => ({ s, d: dLon(lon, s.subLon) })).sort((a, b) => a.d - b.d)[0];
  return geo.d <= GEO_REACH ? geo.s : SOURCES.viirs;
}

const r2 = (v) => Math.round(v * 100) / 100;
const clampLon = (v) => Math.max(-180, Math.min(180, v));
/** Recuadro [latMín, lonMín, latMáx, lonMáx] de la imagen para el globo. */
export function globeBox(src, lon0) {
  if (src.geo) return [-81, clampLon(r2(src.subLon - 81)), 81, clampLon(r2(src.subLon + 81))];
  return [-90, clampLon(r2(lon0 - 90)), 90, clampLon(r2(lon0 + 90))];
}
/** «Tu zona»: ±half grados de latitud alrededor del lugar (y los de longitud que miden lo mismo en km). */
export function regionBox(lat, lon, half = 4) {
  const hl = half / Math.max(0.3, Math.cos(lat * RAD));
  return [r2(Math.max(-90, lat - half)), r2(lon - hl), r2(Math.min(90, lat + half)), r2(lon + hl)];
}

/** URL WMS 1.3.0 de una fuente (EPSG:4326: el BBOX va en orden lat, lon). Sin `time`, la imagen más reciente. */
export function wmsUrl(src, bbox, width, height, time) {
  const q = new URLSearchParams({
    SERVICE: "WMS", REQUEST: "GetMap", VERSION: "1.3.0", LAYERS: src.layer, STYLES: "", CRS: "EPSG:4326",
    BBOX: bbox.join(","), WIDTH: String(width), HEIGHT: String(height), FORMAT: src.format,
  });
  if (src.format === "image/png") q.set("TRANSPARENT", "TRUE");
  if (time) q.set("TIME", time);
  return `${src.wms}?${q}`;
}

const iso = (d) => d.toISOString().slice(0, 19) + "Z";
/** Consulta WMTS del dominio de tiempos de una capa en las últimas `hours` horas. */
export function domainsUrl(layer, matrix, now = new Date(), hours = 6) {
  const a = new Date(now.getTime() - hours * 3600e3);
  return `${GIBS}/wmts/epsg4326/best/1.0.0/${layer}/default/${matrix}/all/${iso(a)}--${iso(now)}.xml`;
}
/**
 * El instante más reciente de un dominio de tiempos, o null: el <Domain> de GIBS («a/b/PT10M,c/d/PT10M» o valores
 * sueltos) o la <Dimension name="time"> de unas capacidades WMS (EUMETSAT).
 */
export function latestTime(xml) {
  const s = String(xml || "");
  const m = /<Domain>([^<]+)<\/Domain>/.exec(s) || /<Dimension[^>]*name="time"[^>]*>([^<]+)<\/Dimension>/i.exec(s);
  if (!m) return null;
  let best = null;
  for (const part of m[1].split(",")) {
    const bits = part.trim().split("/"), end = (bits.length >= 2 ? bits[1] : bits[0]).replace(/\.0+Z$/, "Z");
    if (end && (!best || end > best)) best = end;
  }
  return best;
}
/** Dónde preguntar la hora de la imagen más reciente de una fuente. */
export function timeUrl(src, now = new Date()) {
  if (src.wms === EUM_WMS) { const [ws, name] = src.layer.split(":"); return `${EUMETSAT}/${ws}/${name}/ows?service=WMS&request=GetCapabilities&version=1.3.0`; }
  return domainsUrl(src.layer, src.matrix, now, src.geo ? 6 : 72);
}
/** Hora de la imagen más reciente de la fuente (o null si no responde: se usa su imagen por defecto). */
export async function fetchLatestTime(src, { fetchImpl = fetch, now = new Date() } = {}) {
  try {
    const r = await fetchImpl(timeUrl(src, now));
    if (!r.ok) return null;
    return latestTime(await r.text());
  } catch { return null; }
}

/**
 * Horas a probar, en orden: la más reciente que anuncia el servicio, las dos anteriores (GIBS anuncia a veces una
 * hora cuya imagen aún sale vacía) y, al final, la imagen por defecto (sin hora).
 */
export function timeCandidates(time, src) {
  if (!time) return [null];
  if (!src.geo || !/T\d\d:\d\d/.test(time)) return [time, null];
  const t = Date.parse(time);
  return [time, iso(new Date(t - 600e3)), iso(new Date(t - 1200e3)), null];
}
/** Fracción de píxeles con dato (opacos y, si `blackIsGap`, no negros), muestreando 1 de cada 7. */
export function dataFraction(img, blackIsGap = false) {
  const d = img.data; let n = 0, k = 0;
  for (let i = 0; i < d.length; i += 28) { k++; if (d[i + 3] > 150 && !(blackIsGap && d[i] + d[i + 1] + d[i + 2] < 10)) n++; }
  return k ? n / k : 0;
}

/** Proyección ortográfica centrada en (lat0, lon0): punto del disco (x a la derecha, y hacia abajo, radio 1) → lat/lon, o null. */
export function orthoInverse(x, y, lat0, lon0) {
  const Y = -y, rho = Math.hypot(x, Y);
  if (rho > 1) return null;
  if (rho < 1e-12) return { lat: lat0, lon: lon0 };
  const c = Math.asin(rho), sc = Math.sin(c), cc = Math.cos(c), p0 = lat0 * RAD;
  const lat = Math.asin(cc * Math.sin(p0) + (Y * sc * Math.cos(p0)) / rho);
  const lon = lon0 * RAD + Math.atan2(x * sc, rho * Math.cos(p0) * cc - Y * Math.sin(p0) * sc);
  return { lat: lat / RAD, lon: ((lon / RAD + 540) % 360) - 180 };
}
/** lat/lon → punto del disco (y hacia abajo) y si está en la cara visible. */
export function orthoForward(lat, lon, lat0, lon0) {
  const p = lat * RAD, p0 = lat0 * RAD, dl = (lon - lon0) * RAD;
  const x = Math.cos(p) * Math.sin(dl);
  const Y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl);
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl);
  return { x, y: -Y, visible: cosc >= 0 };
}

/**
 * Pinta el globo en `out` (ImageData de size×size) a partir de la imagen del satélite (`img`: ImageData sobre el
 * recuadro `box`) y la Tierra de fondo (`base`: ImageData equirectangular de todo el mundo). `blackIsGap`: en
 * VIIRS, el negro puro son franjas sin pasada. Devuelve la fracción del disco cubierta por el satélite.
 */
export function paintGlobe(out, img, box, base, lat0, lon0, { blackIsGap = false } = {}) {
  const S = out.width, R = S / 2 - 1, o = out.data;
  const [la0, lo0, la1, lo1] = box;
  let inDisk = 0, fromSat = 0;
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const k = (j * S + i) * 4;
      const x = (i + 0.5 - S / 2) / R, y = (j + 0.5 - S / 2) / R;
      const g = orthoInverse(x, y, lat0, lon0);
      if (!g) { o[k + 3] = 0; continue; }
      inDisk++;
      let r = 0, gg = 0, b = 0, done = false;
      if (img && g.lat >= la0 && g.lat <= la1 && g.lon >= lo0 && g.lon <= lo1) {
        const u = Math.min(img.width - 1, Math.floor(((g.lon - lo0) / (lo1 - lo0)) * img.width));
        const v = Math.min(img.height - 1, Math.floor(((la1 - g.lat) / (la1 - la0)) * img.height));
        const s = (v * img.width + u) * 4, a = img.data[s + 3] / 255;
        const R0 = img.data[s], G0 = img.data[s + 1], B0 = img.data[s + 2];
        if (a > 0.6 && !(blackIsGap && R0 + G0 + B0 < 10)) { r = R0; gg = G0; b = B0; done = true; fromSat++; }
      }
      if (!done && base) {
        const u = Math.min(base.width - 1, Math.floor(((g.lon + 180) / 360) * base.width));
        const v = Math.min(base.height - 1, Math.floor(((90 - g.lat) / 180) * base.height));
        const s = (v * base.width + u) * 4;
        r = base.data[s] * 0.38; gg = base.data[s + 1] * 0.38; b = base.data[s + 2] * 0.42;
      }
      // oscurecimiento leve hacia el borde (como en una foto del disco) y un filo de atmósfera
      const rho = Math.hypot(x, y), limb = 0.78 + 0.22 * Math.sqrt(Math.max(0, 1 - rho * rho));
      const rimA = Math.max(0, (rho - 0.93) / 0.07);
      o[k] = Math.min(255, r * limb + 90 * rimA * 0.5);
      o[k + 1] = Math.min(255, gg * limb + 150 * rimA * 0.5);
      o[k + 2] = Math.min(255, b * limb + 255 * rimA * 0.5);
      o[k + 3] = 255;
    }
  }
  return inDisk ? fromSat / inDisk : 0;
}
