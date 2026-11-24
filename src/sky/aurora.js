// aurora.js — auroras en la vista Cielo: geometría y datos, sin DOM ni three (se prueba en scripts/test_aurora.mjs).
//
// De dónde sale cada cosa:
//   · Ahora (±1 h): el pronóstico inmediato OVATION de NOAA SWPC (probabilidad de aurora en una malla de 1°),
//     que llega del servidor (/api/aurora, backend/app/aurora.py). Medido.
//   · Otras horas: un óvalo ESTIMADO a partir del índice Kp de NOAA (observado, o pronosticado hasta ~3 días).
//     Es una aproximación de Teseo con la relación conocida entre el Kp y el borde del óvalo: el borde ecuatorial,
//     a medianoche magnética, queda cerca de 66,5° − 2°·Kp de latitud geomagnética (unos 8° más al polo a mediodía).
//   · El eje del dipolo terrestre (para las coordenadas geomagnéticas) sale de los términos de grado 1 del
//     World Magnetic Model 2025 (NOAA/NCEI y BGS), a la fecha.
//
// Cómo se ve: la luz sale a la altura física de cada emisión (oxígeno verde 557,7 nm, de ~100 a ~200 km;
// oxígeno rojo 630,0 nm, de ~200 a ~400 km; nitrógeno violeta y rosado en el borde de abajo, ~90–100 km, solo con
// actividad fuerte), y la perspectiva se calcula con la curvatura de la Tierra, igual que el relieve.
import { WMM_COEFFS, WMM_EPOCH } from "./wmm2025.js";

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const EARTH_KM = 6371.0;
export const NB = 360;                    // franjas de longitud geomagnética (1°)
export const EDGE_P = 5;                  // % desde el que una franja cuenta como parte del óvalo
export const H = { base: 95, green: 110, top: 300, red: 230 };   // alturas de emisión (km)

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Fecha → año decimal (UTC). */
export function decimalYear(date) {
  const y = date.getUTCFullYear(), t0 = Date.UTC(y, 0, 1), t1 = Date.UTC(y + 1, 0, 1);
  return y + (date.getTime() - t0) / (t1 - t0);
}

/** Unitario en el marco terrestre (x: lon 0°, y: lon 90° E, z: polo norte). */
export function ecef(latDeg, lonDeg) {
  const p = latDeg * D2R, l = lonDeg * D2R;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

/** Ejes locales del observador en el marco terrestre: e (este), n (norte), u (cenit). */
export function enu(latDeg, lonDeg) {
  const p = latDeg * D2R, l = lonDeg * D2R;
  return {
    e: [-Math.sin(l), Math.cos(l), 0],
    n: [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)],
    u: [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)],
  };
}

/**
 * Eje del dipolo (polo norte geomagnético) a la fecha, con g10, g11 y h11 del WMM2025.
 * Devuelve { m, m1, m2, poleLat, poleLon }: m apunta al polo norte geomagnético; m2 = m × z (hacia el este
 * geomagnético en el meridiano 0) y m1 = m2 × m completan la base para la longitud geomagnética.
 */
export function dipole(date) {
  const t = decimalYear(date) - WMM_EPOCH;
  const c = (n, m) => WMM_COEFFS.find((r) => r[0] === n && r[1] === m);
  const [, , g10, , dg10] = c(1, 0), [, , g11, h11, dg11, dh11] = c(1, 1);
  const G10 = g10 + dg10 * t, G11 = g11 + dg11 * t, H11 = h11 + dh11 * t;
  const m = norm([-G11, -H11, -G10]);
  const m2 = norm(cross(m, [0, 0, 1]));
  const m1 = cross(m2, m);
  return { m, m1, m2, poleLat: Math.asin(m[2]) * R2D, poleLon: Math.atan2(m[1], m[0]) * R2D };
}

/** Geográficas → geomagnéticas (dipolo centrado): { mlat, mlon } en grados (mlon de −180 a 180). */
export function geoToMag(latDeg, lonDeg, dp) {
  const p = ecef(latDeg, lonDeg);
  return { mlat: Math.asin(clamp(dot(p, dp.m), -1, 1)) * R2D, mlon: Math.atan2(dot(p, dp.m2), dot(p, dp.m1)) * R2D };
}

/** Geomagnéticas → geográficas. */
export function magToGeo(mlatDeg, mlonDeg, dp) {
  const a = mlatDeg * D2R, b = mlonDeg * D2R;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const p = [0, 1, 2].map((i) => ca * cb * dp.m1[i] + ca * sb * dp.m2[i] + sa * dp.m[i]);
  return { lat: Math.asin(clamp(p[2], -1, 1)) * R2D, lon: Math.atan2(p[1], p[0]) * R2D };
}

/** Punto subsolar (baja precisión, NOAA): { lat, lon } en grados. */
export function subsolar(date) {
  const jd = date.getTime() / 86400000 + 2440587.5, n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * D2R;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R, eps = (23.439 - 0.0000004 * n) * D2R;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const gmst = ((280.46061837 + 360.98564736629 * n) % 360) * D2R;
  let lon = (ra - gmst) * R2D;
  lon = ((lon + 540) % 360) - 180;
  return { lat: dec * R2D, lon };
}

/** Hora local magnética (0–24 h) de una longitud geomagnética. */
export function mlt(mlonDeg, date, dp) {
  const s = subsolar(date), ms = geoToMag(s.lat, s.lon, dp).mlon;
  return (((mlonDeg - ms) / 15 + 12) % 24 + 24) % 24;
}

// ── datos de NOAA (OVATION) ───────────────────────────────────────────────
/** Respuesta de /api/aurora → { latMin, latMax, nLon, data: Uint8Array, observed, forecast } o null. */
export function decodeOvation(ov) {
  if (!ov || !ov.grid_b64) return null;
  const bin = typeof atob === "function" ? atob(ov.grid_b64) : Buffer.from(ov.grid_b64, "base64").toString("binary");
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const nLon = ov.lon_count || 360;
  if (data.length !== (ov.lat_max - ov.lat_min + 1) * nLon) return null;
  return { latMin: ov.lat_min, latMax: ov.lat_max, nLon, data, observed: ov.observed, forecast: ov.forecast };
}

/** Probabilidad (%) en un punto de la malla de OVATION (interpolada; 0 fuera de la franja recibida). */
export function probGrid(g, lat, lon) {
  if (!g || lat < g.latMin || lat > g.latMax) return 0;
  const y = lat - g.latMin, x = ((lon % 360) + 360) % 360;
  const y0 = Math.floor(y), x0 = Math.floor(x), y1 = Math.min(g.latMax - g.latMin, y0 + 1), x1 = (x0 + 1) % g.nLon;
  const fy = y - y0, fx = x - x0, v = (r, c) => g.data[r * g.nLon + c];
  return (v(y0, x0) * (1 - fx) + v(y0, x1) * fx) * (1 - fy) + (v(y1, x0) * (1 - fx) + v(y1, x1) * fx) * fy;
}

// ── óvalo estimado a partir del Kp ────────────────────────────────────────
/** Borde ecuatorial del óvalo (latitud geomagnética, °) a una hora local magnética, para un Kp. */
export function ovalEdge(kp, mltH) {
  const mid = 66.5 - 2 * clamp(kp, 0, 9);
  return mid + 4 * (1 - Math.cos((mltH / 12) * Math.PI));    // +8° a mediodía magnético
}

/** Probabilidad estimada (%) en una latitud geomagnética (valor absoluto) y hora magnética, para un Kp. */
export function probModel(kp, absMlat, mltH) {
  const k = clamp(kp, 0, 9);
  const edge = ovalEdge(k, mltH), w = 2.2 + 0.45 * k, c = edge + w;
  const night = 0.35 + 0.65 * Math.pow(Math.cos(((mltH - 23.5) / 24) * Math.PI), 2);   // más intensa hacia la medianoche
  const peak = clamp(8 + 9 * k, 0, 95) * night;
  const z = (absMlat - c) / w;
  return absMlat < edge - 3 * w ? 0 : peak * Math.exp(-0.5 * z * z * (absMlat < c ? 1 : 0.5));
}

/** Kp para un instante en la serie de NOAA ([{t, kp, kind}]): { kp, kind } o null si queda fuera. */
export function kpAt(series, date) {
  if (!Array.isArray(series) || !series.length) return null;
  const ms = date.getTime();
  let best = null;
  for (const r of series) {
    const t0 = Date.parse(r.t);
    if (t0 <= ms && ms < t0 + 3 * 3600e3) best = r;
  }
  return best ? { kp: best.kp, kind: best.kind } : null;
}

// ── franjas del óvalo para el dibujo ──────────────────────────────────────
/**
 * Recorre cada meridiano geomagnético del hemisferio `hemi` (+1 norte, −1 sur) y devuelve un Float32Array(NB·4):
 * [centro del óvalo (|latitud geomagnética|, °), anchura (desviación, °), intensidad (0–1), brillo difuso (0–1)]
 * por franja (centro 0 = sin aurora). El centro y la anchura son la media y la desviación de la latitud pesadas por
 * la probabilidad; las cortinas se reparten alrededor del centro. prob(lat, lon, mlatAbs, mlonDeg) da el % de cada punto.
 */
export function ovalBands(prob, dp, hemi = 1) {
  const out = new Float32Array(NB * 4);
  for (let i = 0; i < NB; i++) {
    const mlon = i - 180 + 0.5;
    let pk = 0, sw = 0, s1 = 0, s2 = 0;
    for (let a = 45; a <= 88; a += 0.5) {
      const g = magToGeo(hemi * a, mlon, dp);
      const p = prob(g.lat, g.lon, a, mlon);
      if (p >= EDGE_P) { sw += p; s1 += p * a; s2 += p * a * a; }
      if (p > pk) pk = p;
    }
    if (sw > 0) {
      const c = s1 / sw, sd = Math.sqrt(Math.max(0.09, s2 / sw - c * c));
      out[i * 4] = c; out[i * 4 + 1] = clamp(sd, 0.4, 8);
      out[i * 4 + 2] = clamp(pk / 70, 0, 1);
      out[i * 4 + 3] = clamp((sw / (sd * 2 * 2.5)) / 60, 0, 1);    // probabilidad media dentro de ±1 desviación
    }
  }
  // suavizado circular (±3°): sin escalones de un meridiano a otro
  const sm = new Float32Array(out.length);
  for (let i = 0; i < NB; i++) for (let c = 0; c < 4; c++) {
    let s = 0, w = 0;
    for (let k = -3; k <= 3; k++) {
      const j = (i + k + NB) % NB, v = out[j * 4 + c], wk = 1 - Math.abs(k) / 4;
      if (c < 2 && !out[j * 4]) continue;              // los meridianos vacíos no tiran del centro ni de la anchura
      s += v * wk; w += wk;
    }
    sm[i * 4 + c] = w ? s / w : 0;
  }
  return sm;
}

/** Límites de una franja: [ecuatorial, polar] = centro ∓ 1,6 desviaciones (o null si no hay aurora). */
export function bandEdges(bands, i) {
  const c = bands[i * 4], w = bands[i * 4 + 1];
  return c ? [c - 1.6 * w, c + 1.6 * w] : null;
}

/** Bandas a partir de la malla de OVATION. */
export function bandsFromGrid(g, dp, hemi) { return ovalBands((lat, lon) => probGrid(g, lat, lon), dp, hemi); }

/** Bandas del óvalo estimado para un Kp y un instante. */
export function bandsFromKp(kp, date, dp, hemi) {
  const s = subsolar(date), ms = geoToMag(s.lat, s.lon, dp).mlon;
  return ovalBands((lat, lon, a, mlon) => probModel(kp, a, (((mlon - ms) / 15 + 12) % 24 + 24) % 24), dp, hemi);
}

// ── perspectiva ───────────────────────────────────────────────────────────
/** Dónde se ve desde el observador un punto (lat, lon) a hKm de altura: { alt, az, km } (az desde el norte). */
export function skyPos(lat, lon, hKm, obs) {
  const R = EARTH_KM, ro = R + (obs.elevKm || 0);
  const b = enu(obs.lat, obs.lon), p = ecef(lat, lon).map((v) => v * (R + hKm));
  const o = b.u.map((v) => v * ro), d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const km = Math.hypot(d[0], d[1], d[2]);
  const e = dot(d, b.e), n = dot(d, b.n), u = dot(d, b.u);
  return { alt: Math.asin(clamp(u / km, -1, 1)) * R2D, az: (Math.atan2(e, n) * R2D + 360) % 360, km };
}

const COMPASS = { es: ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"],
  en: ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"] };
export const compassName = (az, lang = "es") => (COMPASS[lang] || COMPASS.es)[Math.round(((az % 360) + 360) % 360 / 45) % 8];

/**
 * Hacia dónde mirar: recorre las franjas con aurora y proyecta sus bordes a 110 y 230 km.
 * { visible, az (dirección media), azFrom, azTo, altMin, altMax, overhead } o { visible: false }.
 */
export function lookAt(bands, dp, hemi, obs) {
  let sx = 0, sy = 0, wsum = 0, aMin = 90, aMax = -90, over = false;
  const azs = [];
  const me = geoToMag(obs.lat, obs.lon, dp), myLon = Math.floor(me.mlon + 180) % NB, myLat = Math.abs(me.mlat);
  for (let i = 0; i < NB; i++) {
    const I = bands[i * 4 + 2], ed = bandEdges(bands, i);
    if (I < 0.04 || !ed) continue;
    for (const lat of [ed[0], bands[i * 4], ed[1]]) {
      const g = magToGeo(hemi * lat, i - 180 + 0.5, dp);
      for (const h of [H.green, H.red]) {
        const s = skyPos(g.lat, g.lon, h, obs);
        if (s.alt < 1) continue;
        sx += I * Math.sin(s.az * D2R); sy += I * Math.cos(s.az * D2R); wsum += I;
        aMin = Math.min(aMin, s.alt); aMax = Math.max(aMax, s.alt); azs.push(s.az);
        if (s.alt > 70) over = true;
      }
    }
    // ¿estás dentro de la franja? entonces la tienes encima
    if (i === myLon && myLat >= ed[0] && myLat <= ed[1]) { over = true; aMax = 90; }
  }
  if (!wsum) return { visible: false };
  const az = (Math.atan2(sx, sy) * R2D + 360) % 360;
  // abanico alrededor de la dirección media
  let lo = 0, hi = 0;
  for (const a of azs) { const d = ((a - az + 540) % 360) - 180; lo = Math.min(lo, d); hi = Math.max(hi, d); }
  return { visible: true, az, azFrom: (az + lo + 360) % 360, azTo: (az + hi + 360) % 360, altMin: Math.max(0, aMin), altMax: aMax, overhead: over };
}

// ── qué tan visible es (cielo claro, Luna) ────────────────────────────────
/** Factor 0–1: 0 de día; 1 con el Sol bajo −15°. La Luna llena alta resta hasta un 45 %. */
export function darkness(sunAlt, moonAlt = -90, moonIllum = 0) {
  const t = clamp((-4 - sunAlt) / 11, 0, 1);
  const sky = t * t * (3 - 2 * t);
  const moon = moonAlt > 0 ? 0.45 * moonIllum * Math.min(1, moonAlt / 30) : 0;
  return sky * (1 - moon);
}

/** Nombre de la actividad según el Kp (escala G de NOAA a partir de Kp 5). */
export function activityKey(kp) {
  if (kp == null) return null;
  if (kp >= 9) return "g5"; if (kp >= 8) return "g4"; if (kp >= 7) return "g3"; if (kp >= 6) return "g2"; if (kp >= 5) return "g1";
  if (kp >= 4) return "active"; if (kp >= 2) return "unsettled"; return "quiet";
}

/** Hemisferio geomagnético del observador (+1 norte, −1 sur). */
export const hemiOf = (lat, lon, dp) => (geoToMag(lat, lon, dp).mlat >= 0 ? 1 : -1);
