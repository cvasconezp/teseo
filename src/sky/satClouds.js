// satClouds.js — las nubes de AHORA vistas por el satélite (backend /api/clouds-sat, app/cloudsat.py) para dibujarlas
// en su sitio en el cielo: una malla de 101 × 101 celdas de 3 km (150 km a la redonda) con el % de cada celda
// cubierto por nubes bajas, medias y altas. Cerca de la hora del barrido manda el satélite; lejos, el pronóstico.
//
// Puro salvo fetchSatClouds(); se prueba en scripts/test_weather.mjs.
import { threshold } from "./cloudNoise.js";
import { LAYERS } from "./weather.js";

/** Minutos alrededor del barrido en que el satélite manda del todo, y a partir de los cuales ya no cuenta. */
export const SAT_FULL_MIN = 45, SAT_FADE_MIN = 120;

/** Respuesta del backend → { t (s), sat, by, n, res, half (km: medio lado de la malla), layers: {low|mid|high: Uint8Array}, cover, mean }. */
export function parseSatClouds(j) {
  if (!j || !j.layers || !Number.isFinite(j.n) || !j.time) return null;
  const n = j.n, layers = {}, mean = {};
  for (const l of LAYERS) {
    const L = j.layers[l]; if (!L || !L.grid) return null;
    const bin = typeof atob === "function" ? atob(L.grid) : Buffer.from(L.grid, "base64").toString("binary");
    if (bin.length !== n * n) return null;
    const a = new Uint8Array(n * n);
    for (let i = 0; i < a.length; i++) a[i] = bin.charCodeAt(i);
    layers[l] = a; mean[l] = Math.min(1, Math.max(0, +L.cover || 0));
  }
  const t = Date.parse(j.time) / 1000;
  if (!Number.isFinite(t)) return null;
  return { t, sat: j.sat, by: j.by, source: j.source, n, res: j.res_km, half: j.radius_km + j.res_km / 2, layers, cover: +j.cover || 0, mean };
}

/**
 * Alturas típicas de cada capa sobre el observador (km) para medir cuánto cielo tapa cada celda: bajas, medias y altas
 * (las de Open-Meteo: < 3 km, 3–8 km, > 8 km).
 */
export const DOME_H_KM = { low: 1.2, mid: 5, high: 10 };

/**
 * Fracción de la bóveda del cielo cubierta, como la estima quien mira desde el suelo (las octas de la OMM): cada celda
 * cuenta según el ángulo sólido que ocupa vista desde el centro, h·A / (d² + h²)^(3/2). Una nube encima pesa mucho más
 * que una a 140 km, que apenas asoma sobre el horizonte. `grid` en % (255 sin dato), malla n × n de paso `res` km.
 */
export function domeCover(grid, n, res, hKm) {
  const c0 = (n - 1) / 2;
  let sw = 0, sv = 0;
  for (let r = 0; r < n; r++) {
    const y = (r - c0) * res;
    for (let c = 0; c < n; c++) {
      const v = grid[r * n + c];
      if (v === 255) continue;
      const x = (c - c0) * res, q = x * x + y * y + hKm * hKm, w = hKm / (q * Math.sqrt(q));
      sw += w; sv += w * v;
    }
  }
  return sw > 0 ? sv / sw / 100 : null;
}

/** Peso del satélite (0–1) en el instante `s` (s Unix): 1 cerca del barrido, 0 lejos. */
export function satWeight(sat, s) {
  if (!sat || !Number.isFinite(s)) return 0;
  const m = Math.abs(s - sat.t) / 60;
  if (m <= SAT_FULL_MIN) return 1;
  if (m >= SAT_FADE_MIN) return 0;
  const f = (m - SAT_FULL_MIN) / (SAT_FADE_MIN - SAT_FULL_MIN);
  return 1 - f * f * (3 - 2 * f);
}

/**
 * El satélite solo ve el tope: bajo una nube alta puede haber medias y bajas (un cumulonimbo o un nimboestrato
 * tienen el tope a 10–13 km y son opacos hasta abajo). Bajo cada tope se completan las capas inferiores con la
 * nubosidad que da el pronóstico para ellas; donde el satélite ve el suelo, no hay nubes en ninguna capa.
 * Devuelve una vista { t, n, res, half, sat, by, layers (Uint8Array, % o 255), mean, cover, key } (se recuerda).
 */
export function fuseSat(sat, fc) {
  if (!sat) return null;
  const q = (v) => Math.round(Math.min(1, Math.max(0, v || 0)) * 20) / 20;   // pasos de 5 %
  const fl = q(fc && fc.low), fm = q(fc && fc.mid), key = `${sat.t}|${fl}|${fm}`;
  if (sat._fused && sat._fused.key === key) return sat._fused;
  const n2 = sat.n * sat.n, L = sat.layers;
  const low = new Uint8Array(n2), mid = new Uint8Array(n2), high = new Uint8Array(n2);
  let sl = 0, sm = 0, sh = 0, st = 0, cnt = 0;
  for (let i = 0; i < n2; i++) {
    if (L.low[i] === 255 || L.mid[i] === 255 || L.high[i] === 255) { low[i] = mid[i] = high[i] = 255; continue; }
    const h = L.high[i] / 100, m = L.mid[i] / 100, l = L.low[i] / 100;
    const mm = Math.min(1, m + h * fm), ll = Math.min(1, l + (m + h) * fl);
    high[i] = Math.round(h * 100); mid[i] = Math.round(mm * 100); low[i] = Math.round(ll * 100);
    sl += ll; sm += mm; sh += h; st += Math.min(1, l + m + h); cnt++;
  }
  const c = Math.max(1, cnt);
  // lo que ve quien está en el centro (para la tarjeta): cada capa pesada por la bóveda; el total, sin contar dos
  // veces lo que se tapa entre capas
  const dome = {};
  for (const [l, g] of [["low", low], ["mid", mid], ["high", high]]) { const d = domeCover(g, sat.n, sat.res, DOME_H_KM[l]); dome[l] = d == null ? (l === "low" ? sl : l === "mid" ? sm : sh) / c : d; }
  dome.total = 1 - (1 - dome.low) * (1 - dome.mid) * (1 - dome.high);
  sat._fused = { t: sat.t, n: sat.n, res: sat.res, half: sat.half, sat: sat.sat, by: sat.by, source: sat.source,
    layers: { low, mid, high }, mean: { low: sl / c, mid: sm / c, high: sh / c }, cover: st / c, dome, key };
  return sat._fused;
}

/**
 * Las nubes del instante mezclando pronóstico (cloudsAt de weather.js, o null) y satélite con peso w: la cobertura
 * media de cada capa (para lo que queda fuera de la malla y para la tarjeta) y el viento del pronóstico. Una capa que
 * el satélite ve en algún sitio queda encendida aunque su media sea mínima.
 */
export function mergeClouds(fc, sat, w) {
  if (!sat || !(w > 0)) return fc;
  const out = { ...(fc || {}), wind: (fc && fc.wind) || { low: [0, 0], mid: [0, 0], high: [0, 0] }, sat: true, satW: w };
  for (const l of LAYERS) {
    const f = fc && fc[l] != null ? fc[l] : sat.mean[l];
    let c = f + (sat.mean[l] - f) * w;
    if (c < 0.004 && sat.layers[l].some((v) => v > 0 && v < 255)) c = 0.004;
    out[l] = c;
  }
  const ft = fc && fc.total != null ? fc.total : sat.cover;
  out.total = ft + (sat.cover - ft) * w;
  // lo que se ve desde tu sitio (la tarjeta): el pronóstico ya es de tu zona; el satélite, pesado por la bóveda
  if (sat.dome) {
    out.dome = {};
    for (const l of [...LAYERS, "total"]) { const f = fc && fc[l] != null ? fc[l] : sat.dome[l]; out.dome[l] = f + (sat.dome[l] - f) * w; }
  }
  return out;
}

/** Los umbrales van en bytes (texturas que toda GPU filtra): [TH_LO, TH_HI] → 0–255 (paso ≈ 0,007, menor que el borde). */
export const TH_LO = -0.4, TH_HI = 1.4;
const enc = (th) => Math.max(0, Math.min(255, Math.round(((th - TH_LO) / (TH_HI - TH_LO)) * 255)));
export const decTh = (b) => TH_LO + (b / 255) * (TH_HI - TH_LO);

/**
 * Textura de umbrales (bytes RGBA, n × n, fila 0 al sur): R, G, B = umbral del ruido de cada capa para la
 * cobertura de la celda (el mismo que usa el pronóstico: cloudNoise.threshold), codificado con TH_LO–TH_HI;
 * A = 255 con dato, 0 sin él.
 */
export function thresholdTexture(sat, out = null) {
  const n = sat.n, data = out && out.length === n * n * 4 ? out : new Uint8Array(n * n * 4);
  const L = LAYERS.map((l) => sat.layers[l]);
  const memo = LAYERS.map(() => new Map());
  for (let i = 0; i < n * n; i++) {
    const nod = L.some((a) => a[i] === 255);
    for (let k = 0; k < 3; k++) {
      const v = nod ? Math.round(sat.mean[LAYERS[k]] * 100) : L[k][i];
      let th = memo[k].get(v);
      if (th === undefined) { th = enc(threshold(LAYERS[k], v / 100)); memo[k].set(v, th); }
      data[i * 4 + k] = th;
    }
    data[i * 4 + 3] = nod ? 0 : 255;
  }
  return data;
}

/** Desvanecido junto al borde de la malla (0 fuera, 1 dentro), en coordenadas de textura. */
export function edgeFade(u, v) {
  const e = Math.min(u, v, 1 - u, 1 - v);
  if (e <= 0) return 0;
  const f = Math.min(1, e / 0.08);
  return f * f * (3 - 2 * f);
}

/**
 * Umbral local de la capa k en el punto (e, n) km (este, norte; ya corrido con el viento), como lo lee la GPU
 * (filtro bilineal de la textura): { th, w } con w = peso del dato (validez × borde), o null fuera de la malla.
 */
export function sampleThreshold(tex, n, half, k, e, nn) {
  const u = (e + half) / (2 * half), v = (nn + half) / (2 * half);
  const fade = edgeFade(u, v);
  if (!(fade > 0)) return null;
  const x = u * n - 0.5, y = v * n - 0.5;
  const x0 = Math.max(0, Math.min(n - 1, Math.floor(x))), y0 = Math.max(0, Math.min(n - 1, Math.floor(y)));
  const x1 = Math.min(n - 1, x0 + 1), y1 = Math.min(n - 1, y0 + 1), fx = Math.min(1, Math.max(0, x - x0)), fy = Math.min(1, Math.max(0, y - y0));
  const at = (xx, yy, c) => tex[(yy * n + xx) * 4 + c];
  const bl = (c) => (at(x0, y0, c) * (1 - fx) + at(x1, y0, c) * fx) * (1 - fy) + (at(x0, y1, c) * (1 - fx) + at(x1, y1, c) * fx) * fy;
  return { th: decTh(bl(k)), w: (bl(3) / 255) * fade };
}

/** Cuánto se ha movido cada capa con su viento desde el barrido (km este, norte): la malla viaja con las nubes. */
export function mapOffsets(clouds, tSec, satT) {
  const dt = Number.isFinite(tSec) && Number.isFinite(satT) ? tSec - satT : 0;
  return LAYERS.map((l) => { const v = (clouds && clouds.wind && clouds.wind[l]) || [0, 0]; return [(v[0] * dt) / 1000, (v[1] * dt) / 1000]; });
}

/** Crédito corto del satélite para la marca del cielo y las imágenes. */
export function satCredit(sat) {
  if (!sat) return "";
  return sat.source === "himawari" ? "JMA/NOAA Himawari-9" : sat.source === "msg" || sat.source === "iodc" ? "EUMETSAT Meteosat" : `NOAA ${sat.sat}`;
}

/** Pide las nubes del satélite al backend. Rechaza si no hay satélite o falla. */
export async function fetchSatClouds(lat, lon, ground, { api = "", fetchImpl = (typeof fetch !== "undefined" ? fetch : null), signal } = {}) {
  if (!fetchImpl) throw new Error("sin red");
  const q = new URLSearchParams({ lat: lat.toFixed(3), lon: lon.toFixed(3), ground: String(Math.round(Number.isFinite(ground) ? ground : 0)) });
  const r = await fetchImpl(`${api}/api/clouds-sat?${q}`, { signal });
  if (!r.ok) throw new Error(`clouds-sat HTTP ${r.status}`);
  const s = parseSatClouds(await r.json());
  if (!s) throw new Error("respuesta sin malla");
  return s;
}
