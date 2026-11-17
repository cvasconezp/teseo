// horizon.js — el horizonte real del lugar (silueta del relieve) en el navegador: lo pide al backend
// (/api/horizon, que lo calcula con AWS Terrain Tiles: ver backend/app/horizon.py), lo guarda en el teléfono y
// responde «¿qué altura tapan las montañas en este acimut?». Puro salvo fetchHorizon(); se prueba en
// scripts/test_horizon.mjs.
//
// Ángulos en grados; acimut desde el norte hacia el este. El perfil del servidor ya incluye la curvatura de la
// Tierra y la refracción del rayo hasta la montaña: es la altura APARENTE del filo. Para comparar con un astro
// se usa también su altura aparente (geométrica + refracción, Sæmundsson 1986).

const STORE_KEY = "teseo_horizon_v2";   // v2: 0,2° y seis bandas (v1 era de 0,5°)
const STORE_MAX = 4;                 // lugares guardados en el teléfono (≈ 140 KB cada uno)
const mem = new Map();

/** Celda de 0,002° (≈ 220 m) del lugar: la misma que usa el servidor. */
export function cellKey(lat, lon) {
  const r = (v) => Math.round(v / 0.002) * 0.002;
  const la = r(lat), lo = ((r(lon) + 540) % 360) - 180;
  return `${la.toFixed(3)},${lo.toFixed(3)}`;
}

/** Altura del filo del relieve en un acimut (interpolación lineal; acepta cualquier número de grados). */
export function terrainAltAt(hz, az) {
  if (!hz || !hz.alt || !hz.alt.length) return 0;
  const n = hz.alt.length, step = hz.step_deg || 360 / n;
  const x = (((az % 360) + 360) % 360) / step, i = Math.floor(x) % n, f = x - Math.floor(x);
  return hz.alt[i] * (1 - f) + hz.alt[(i + 1) % n] * f;
}

/** Refracción (grados) para una altura geométrica h (Sæmundsson 1986, 10 °C y 1010 hPa). */
export function refraction(h) {
  const hh = Math.max(-1.5, h);
  return 1.02 / Math.tan(((hh + 10.3 / (hh + 5.11)) * Math.PI) / 180) / 60;
}
/** Altura aparente (grados) de un astro con altura geométrica h. */
export const apparentAlt = (h) => h + refraction(h);

/** ¿Una dirección local [x, y = cenit, z = −norte] queda detrás del relieve? (sobre 0° y bajo el filo) */
export function behindTerrain(hz, d, margin = 0.05) {
  if (!hz || !(d[1] > 0)) return false;
  const alt = (Math.asin(Math.min(1, d[1])) * 180) / Math.PI;
  const az = (Math.atan2(d[0], -d[2]) * 180) / Math.PI;
  return alt + margin < terrainAltAt(hz, az);
}

/** Lo más alto del horizonte: { alt, az, km, top_m } (km y top_m de la banda donde está). */
export function highestPoint(hz) {
  if (!hz || !hz.alt) return null;
  let i = 0;
  for (let k = 1; k < hz.alt.length; k++) if (hz.alt[k] > hz.alt[i]) i = k;
  const step = hz.step_deg || 0.5, alt = hz.alt[i];
  let km = null, top = null;
  for (const b of hz.bands || []) if (Math.abs(b.alt[i] - alt) < 1e-6) { km = b.max_km; top = b.top_m[i]; break; }
  return { alt, az: i * step, km, top_m: top };
}

/** Línea de nieves permanente aproximada (m) según la latitud: ~4.900 m en los trópicos, más baja hacia los polos. */
export function snowLine(lat) {
  const a = Math.abs(lat);
  return a <= 20 ? 4900 : Math.max(600, 4900 - 70 * (a - 20));
}

/**
 * Cuándo asoma y cuándo se esconde un astro tras el relieve, cerca de su salida y su puesta astronómicas.
 *   altAt(ms), azAt(ms): altura geométrica y acimut del astro; rts: riseTransitSet(...); upper: lo que se suma a
 *   la altura del centro para el borde superior (Sol y Luna ≈ 0,26°).
 * Devuelve { rise: Date|null, set: Date|null, hiddenAllDay } o null si el horizonte no cambia nada (< 1 min).
 */
export function terrainRiseSet(altAt, azAt, hz, rts, { upper = 0, stepMin = 2 } = {}) {
  if (!hz || !rts || rts.state !== "normal") return null;
  const above = (ms) => apparentAlt(altAt(ms)) + upper - terrainAltAt(hz, azAt(ms));
  const step = stepMin * 60000;
  const refine = (a, b) => {   // above(a) y above(b) con signos distintos
    let fa = above(a);
    for (let k = 0; k < 18; k++) { const m = (a + b) / 2, fm = above(m); if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m; }
    return new Date((a + b) / 2);
  };
  const r0 = rts.rise ? rts.rise.date.getTime() : null, s0 = rts.set ? rts.set.date.getTime() : null;
  const tr = rts.transit ? rts.transit.date.getTime() : null;
  let rise = null, set = null;
  if (r0 != null) {
    const end = tr != null && tr > r0 ? tr : r0 + 12 * 3600e3;
    let prev = r0 - step;
    for (let t = r0; t <= end; t += step) { if (above(t) > 0) { rise = above(prev) > 0 ? new Date(t) : refine(prev, t); break; } prev = t; }
  }
  if (s0 != null) {
    const start = tr != null && tr < s0 ? tr : s0 - 12 * 3600e3;
    let prev = s0 + step;
    for (let t = s0; t >= start; t -= step) { if (above(t) > 0) { set = above(prev) > 0 ? new Date(t) : refine(t, prev); break; } prev = t; }
  }
  const hiddenAllDay = (r0 != null || s0 != null) && !rise && !set;
  const same = (a, b) => !a || !b || Math.abs(a.date.getTime() - b.getTime()) < 60000;
  if (!hiddenAllDay && same(rts.rise, rise) && same(rts.set, set)) return null;
  return { rise, set, hiddenAllDay };
}

// ── colores del relieve ─────────────────────────────────────────────────────────────────────────────────
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/**
 * Colores (RGB lineal 0–1) de cada banda, de la más cercana a la más lejana: [{ top, bottom }], y el de la nieve.
 * st = skyState(...) de atmosphere.js o null (sin atmósfera: siluetas de noche). Las bandas lejanas se aclaran
 * hacia el color del horizonte (perspectiva aérea); de noche quedan un poco más claras que las cercanas.
 */
export function terrainPalette(st, nBands = 4) {
  const sunAlt = st ? st.sunAlt : -90;
  const day = sstep(-8, 6, sunAlt);
  const horizon = st && st.colors ? st.colors.horizon : [0.1, 0.11, 0.17];
  const moon = st && st.moonAlt > 0 ? (st.moonIllum || 0) * Math.sqrt(Math.sin((st.moonAlt * Math.PI) / 180)) : 0;
  // de noche, siluetas: las cercanas casi negras y las lejanas algo más claras (brillo del cielo); la Luna las aclara
  const nightBase = [0.05 + 0.08 * moon, 0.056 + 0.085 * moon, 0.085 + 0.1 * moon];
  const nightFar = [0.17 + 0.1 * moon, 0.185 + 0.1 * moon, 0.27 + 0.12 * moon];
  const land = [0.17, 0.2, 0.13];                     // monte andino de día (pajonal, bosque, cultivos)
  const out = [];
  for (let k = 0; k < nBands; k++) {
    const f = nBands > 1 ? k / (nBands - 1) : 0;      // 0 cerca … 1 lejos
    const n = mix(nightBase, nightFar, Math.pow(f, 0.8) * 0.95);
    // de día, perspectiva aérea marcada: cada banda más lejana se acerca bastante más al color del horizonte
    const dTop = mix(land, horizon, 0.06 + 0.78 * Math.pow(f, 0.85));
    const dBot = mix(mix(land, [0, 0, 0], 0.18), horizon, 0.04 + 0.7 * Math.pow(f, 0.85));
    const top = mix(n, dTop, day), bottom = mix(mix(n, [0, 0, 0], 0.25), dBot, day);
    out.push({ top, bottom });
  }
  return { bands: out, snow: mix([0.09, 0.1, 0.13], [0.9, 0.92, 0.95], day), day };
}

// ── red ─────────────────────────────────────────────────────────────────────────────────────────────────
function readStore() { try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
function writeStore(list) { try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, STORE_MAX))); } catch { /* lleno o privado */ } }

/** Horizonte del lugar: memoria → teléfono → servidor. Rechaza con Error si el servidor no responde. */
export function fetchHorizon(lat, lon, { api = "", fetchImpl = (typeof fetch !== "undefined" ? fetch : null) } = {}) {
  const key = cellKey(lat, lon);
  if (mem.has(key)) return mem.get(key);
  const saved = readStore().find((e) => e.key === key);
  if (saved && saved.data && saved.data.alt) { const p = Promise.resolve(saved.data); mem.set(key, p); return p; }
  if (!fetchImpl) return Promise.reject(new Error("sin red"));
  const [la, lo] = key.split(",");
  const p = fetchImpl(`${api}/api/horizon?lat=${la}&lon=${lo}`).then(async (r) => {
    let body = null;
    try { body = await r.json(); } catch { /* no JSON */ }
    if (!r.ok || !body || !Array.isArray(body.alt)) throw new Error((body && body.detail) || `HTTP ${r.status}`);
    writeStore([{ key, data: body }, ...readStore().filter((e) => e.key !== key)]);
    return body;
  });
  mem.set(key, p);
  p.catch(() => mem.delete(key));
  return p;
}

// ── nombres de las montañas (/api/peaks, OpenStreetMap) ─────────────────────
// El servidor solo devuelve las cumbres que forman la silueta y, para cada una, el punto exacto de la silueta
// (acimut y ángulo del filo de su banda), así que el rótulo cae siempre sobre la cumbre dibujada.
const peaksMem = new Map();

/** Cumbres con nombre del horizonte del lugar: promesa de { peaks: [...], source }, en caché por celda. */
export function fetchPeaks(lat, lon, { api = "", fetchImpl = (typeof fetch !== "undefined" ? fetch : null) } = {}) {
  const key = cellKey(lat, lon);
  if (peaksMem.has(key)) return peaksMem.get(key);
  if (!fetchImpl) return Promise.reject(new Error("sin red"));
  const [la, lo] = key.split(",");
  const p = fetchImpl(`${api}/api/peaks?lat=${la}&lon=${lo}`).then(async (r) => {
    let body = null;
    try { body = await r.json(); } catch { /* no JSON */ }
    if (!r.ok || !body || !Array.isArray(body.peaks)) throw new Error((body && body.detail) || `HTTP ${r.status}`);
    return body;
  });
  peaksMem.set(key, p);
  p.catch(() => peaksMem.delete(key));
  return p;
}

/** Nombre de una cumbre en el idioma de la interfaz (si OpenStreetMap lo tiene), si no el local. */
export const peakName = (p, lang) => (p && (p[`name_${lang}`] || p.name)) || "";

/**
 * Cumbres para rotular, en orden de prioridad (las que más destacan primero) y solo las que siguen sobre la
 * silueta actual: si el relieve cambió (otra celda), una cumbre cuyo ángulo ya no coincide con el dibujo no se
 * rotula. `max`: cuántas como mucho.
 */
export function peaksToLabel(peaks, hzData, max = 12) {
  if (!Array.isArray(peaks) || !hzData || !Array.isArray(hzData.alt)) return [];
  const step = hzData.step_deg || 0.5, n = hzData.alt.length, out = [];
  for (const p of peaks) {
    const i = ((Math.round(p.az / step) % n) + n) % n;
    // el filo de su banda (una sierra más lejana y más alta puede asomar detrás: la cumbre sigue a la vista)
    const ridge = hzData.bands && hzData.bands[p.band] ? hzData.bands[p.band].alt : hzData.alt;
    if (Math.abs(ridge[i] - p.alt) > 0.05) continue;           // ya no es la silueta que se ve
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}
