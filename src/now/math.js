// math.js — cálculos deterministas de "Ahora en el espacio". Sin red, sin IA,
// sin textos: aquí solo hay números y claves; las palabras las pone i18n.js.
// Probado en scripts/test_app.mjs.

export const C_KM_S = 299_792.458;        // velocidad de la luz (exacta)
export const AU_KM = 149_597_870.7;       // unidad astronómica (IAU 2012)
export const LD_KM = 384_400;             // distancia lunar media usada por CNEOS (≈ 0,00257 UA)
export const EARTH_DIAMETER_KM = 12_742;
export const AIRLINER_KM_S = 0.25;        // 900 km/h, el mismo avión que usa la pestaña Ruta

const num = v => (typeof v === "number" && Number.isFinite(v) ? v : (typeof v === "string" && v.trim() !== "" && Number.isFinite(+v) ? +v : null));
const first = (obj, keys) => { for (const k of keys) { const v = num(obj?.[k]); if (v !== null) return v; } return null; };

// ─── Distancias y señal ──────────────────────────────────────────────────────

export const ldToKm = ld => ld * LD_KM;
export const kmToLd = km => km / LD_KM;
export const auToKm = au => au * AU_KM;

/** Segundos que tarda una señal (a la velocidad de la luz) en recorrer `km`, solo ida. */
export const signalSeconds = km => km / C_KM_S;

/** 754,3 s → { h: 0, m: 12, s: 34 } (redondeado al segundo). */
export function splitSeconds(sec) {
  const t = Math.max(0, Math.round(sec));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

// El contrato dice "dist_au | distancia a la Tierra y al Sol si existe": se
// aceptan los nombres que ya usa /api/probes (dist_au, dist_km, light_min) y
// variantes razonables. Siempre gana la distancia; light_min solo se usa si
// no llegó ninguna distancia.
const EARTH_KM = ["dist_km", "earth_dist_km", "dist_earth_km", "distance_km", "distance_from_earth_km", "earth_distance_km", "range_km"];
const EARTH_AU = ["dist_au", "earth_dist_au", "dist_earth_au", "distance_au", "distance_from_earth_au", "earth_distance_au", "delta_au", "range_au"];
const SUN_KM = ["sun_dist_km", "dist_sun_km", "distance_from_sun_km", "sun_distance_km", "helio_dist_km"];
const SUN_AU = ["sun_dist_au", "dist_sun_au", "distance_from_sun_au", "sun_distance_au", "helio_dist_au", "r_au"];
const LIGHT_MIN = ["light_min", "light_time_min", "light_minutes"];

/**
 * Distancias de una nave tal como lleguen del backend → km.
 * { earthKm, sunKm, fromLightTime }  (null si el dato no existe)
 */
export function spacecraftDistances(sc) {
  const src = sc && typeof sc.position === "object" && sc.position ? { ...sc.position, ...sc } : (sc || {});
  let earthKm = first(src, EARTH_KM);
  if (earthKm === null) { const au = first(src, EARTH_AU); if (au !== null) earthKm = auToKm(au); }
  let sunKm = first(src, SUN_KM);
  if (sunKm === null) { const au = first(src, SUN_AU); if (au !== null) sunKm = auToKm(au); }
  let fromLightTime = false;
  if (earthKm === null) {
    const lm = first(src, LIGHT_MIN);
    if (lm !== null) { earthKm = lm * 60 * C_KM_S; fromLightTime = true; }
  }
  if (earthKm !== null && !(earthKm >= 0)) earthKm = null;
  if (sunKm !== null && !(sunKm >= 0)) sunKm = null;
  return { earthKm, sunKm, fromLightTime };
}

// ─── Lanzamientos ────────────────────────────────────────────────────────────

// Estado en lenguaje claro. Acepta la abreviatura o el id de Launch Library 2
// y, si no, deduce del nombre largo. Devuelve una clave o null (desconocido).
const STATUS_BY_ID = { 1: "go", 2: "tbd", 3: "success", 4: "failure", 5: "hold", 6: "flight", 7: "partial", 8: "tbc", 9: "success" };
const STATUS_BY_ABBREV = { go: "go", tbd: "tbd", tbc: "tbc", success: "success", failure: "failure", hold: "hold", "in flight": "flight", "partial failure": "partial", "payload deployed": "success" };
export function launchStatus(l) {
  const raw = l?.status && typeof l.status === "object" ? (l.status.abbrev ?? l.status.id ?? l.status.name) : l?.status;
  if (typeof raw === "number" && STATUS_BY_ID[raw]) return STATUS_BY_ID[raw];
  if (typeof raw === "string") {
    const k = raw.trim().toLowerCase();
    if (STATUS_BY_ABBREV[k]) return STATUS_BY_ABBREV[k];
    if (/^\d+$/.test(k) && STATUS_BY_ID[+k]) return STATUS_BY_ID[+k];
  }
  const name = `${typeof raw === "string" ? raw : ""} ${l?.status_name || ""}`.toLowerCase();
  if (/partial/.test(name)) return "partial";
  if (/fail/.test(name)) return "failure";
  if (/success|deployed/.test(name)) return "success";
  if (/in flight/.test(name)) return "flight";
  if (/hold/.test(name)) return "hold";
  if (/to be confirmed|\btbc\b/.test(name)) return "tbc";
  if (/to be determined|\btbd\b/.test(name)) return "tbd";
  if (/go for launch|\bgo\b/.test(name)) return "go";
  return null;
}

// Precisión de la fecha: ¿se puede mostrar la hora y una cuenta regresiva?
//   "time"  → hora fiable (segundo/minuto/hora)      "day"  → solo el día
//   "month" → solo el mes                             "vague" → trimestre, año…
export function netPrecision(l) {
  const raw = l?.net_precision && typeof l.net_precision === "object" ? (l.net_precision.abbrev || l.net_precision.name) : l?.net_precision;
  if (raw === null || raw === undefined || raw === "") return "time";   // sin dato: se confía en `net`
  if (typeof raw === "number") return raw <= 2 ? "time" : raw <= 6 ? "day" : raw === 7 ? "month" : "vague";
  const k = String(raw).trim().toLowerCase();
  if (/^(sec|second|min|minute|hour|hr)s?$/.test(k)) return "time";
  if (/^(day|morning|afternoon|evening|night|week)s?$/.test(k)) return "day";
  if (/^(month|m)$/.test(k)) return "month";
  return "vague";
}

/** Primer lanzamiento aún no despegado con hora fiable, o null. `launches` puede venir desordenado. */
export function nextLaunch(launches, now = Date.now()) {
  let best = null, bestT = Infinity;
  for (const l of launches || []) {
    const t = Date.parse(l?.net);
    if (!Number.isFinite(t) || t <= now) continue;
    const st = launchStatus(l);
    if (st === "success" || st === "failure" || st === "partial" || st === "flight") continue;
    if (netPrecision(l) !== "time") continue;
    if (t < bestT) { best = l; bestT = t; }
  }
  return best;
}

/** Orden cronológico estable; los que no tienen fecha válida van al final. */
export function sortByNet(launches) {
  return [...(launches || [])].map((l, i) => ({ l, i, t: Date.parse(l?.net) }))
    .sort((a, b) => (Number.isFinite(a.t) ? a.t : Infinity) - (Number.isFinite(b.t) ? b.t : Infinity) || a.i - b.i)
    .map(x => x.l);
}

// Órbita de destino → clave de diccionario (traducción por tabla, no por IA).
const ORBIT_RULES = [
  [/sun.?synchronous|\bsso\b/, "sso"],
  [/geostationary transfer|geosynchronous transfer|\bgto\b/, "gto"],
  [/geostationary|geosynchronous|\bgeo\b|\bgso\b/, "geo"],
  [/medium earth|\bmeo\b/, "meo"],
  [/polar|\bpo\b/, "polar"],
  [/low earth|\bleo\b/, "leo"],
  [/lunar|moon|\btli\b/, "lunar"],
  [/mars/, "mars"],
  [/heliocentric|solar|l1|l2|lagrang|interplanet|escape/, "helio"],
  [/sub.?orbital/, "sub"],
  [/elliptical|molniya|\bheo\b/, "heo"],
];
export function orbitKey(orbit) {
  const raw = orbit && typeof orbit === "object" ? `${orbit.abbrev || ""} ${orbit.name || ""}` : orbit;
  const k = String(raw || "").toLowerCase();
  if (!k.trim()) return null;
  for (const [re, key] of ORBIT_RULES) if (re.test(k)) return key;
  return null;
}

// ─── Asteroides ──────────────────────────────────────────────────────────────

/**
 * Diámetro (m) a partir de la magnitud absoluta H y un albedo supuesto:
 *   D = 1329 km / √p × 10^(−H/5)      (fórmula estándar; la usa CNEOS)
 */
export const diameterFromH = (h, albedo) => (1329 / Math.sqrt(albedo)) * Math.pow(10, -h / 5) * 1000;
export const ALBEDO_RANGE = [0.25, 0.05];   // claro → pequeño · oscuro → grande

/**
 * Tamaño de un asteroide, diciendo de dónde sale:
 *   basis "measured" → diámetro medido (diameter_m)
 *   basis "source"   → estimación de la fuente (diameter_est_m: [min, max])
 *   basis "h"        → estimación de Teseo a partir del brillo (H), albedo 0,25–0,05
 * Devuelve { min, max, estimated, basis } o null si no hay con qué.
 */
export function asteroidSize(o) {
  const d = num(o?.diameter_m);
  if (d !== null && d > 0) return { min: d, max: d, estimated: false, basis: "measured" };
  const est = o?.diameter_est_m;
  if (Array.isArray(est) && est.length >= 2) {
    const a = num(est[0]), b = num(est[1]);
    if (a !== null && b !== null && a > 0 && b > 0) return { min: Math.min(a, b), max: Math.max(a, b), estimated: true, basis: "source" };
  }
  const h = num(o?.h);
  if (h !== null) return { min: diameterFromH(h, ALBEDO_RANGE[0]), max: diameterFromH(h, ALBEDO_RANGE[1]), estimated: true, basis: "h" };
  return null;
}

// Referencias cotidianas (metros, dimensión mayor)
export const SIZE_REFS = [
  { key: "car", m: 4.5 },
  { key: "bus", m: 12 },
  { key: "whale", m: 27 },
  { key: "airliner", m: 70 },
  { key: "pitch", m: 105 },
  { key: "stadium", m: 250 },
  { key: "eiffel", m: 330 },
  { key: "burj", m: 828 },
  { key: "everest", m: 8849 },
];

/** Referencia más parecida en escala logarítmica: { key, m, ratio } (ratio = tamaño / referencia). */
export function sizeReference(meters) {
  if (!(meters > 0)) return null;
  let best = SIZE_REFS[0];
  for (const r of SIZE_REFS) if (Math.abs(Math.log(meters / r.m)) < Math.abs(Math.log(meters / best.m))) best = r;
  return { key: best.key, m: best.m, ratio: meters / best.m };
}

/** Velocidad relativa: km/h y cuántas veces un avión comercial (900 km/h). */
export function speedFacts(kms) {
  if (!(kms > 0)) return null;
  return { kmh: kms * 3600, airliners: kms / AIRLINER_KM_S, secondsAroundEarth: 40_075 / kms };
}

/** Distancia de paso de un objeto en LD y km, con lo que haya llegado. */
export function passDistance(o) {
  let ld = num(o?.dist_ld), km = num(o?.dist_km);
  const au = num(o?.dist_au);
  if (km === null && ld !== null) km = ldToKm(ld);
  if (km === null && au !== null) km = auToKm(au);
  if (ld === null && km !== null) ld = kmToLd(km);
  if (ld === null || km === null || !(ld >= 0)) return null;
  return { ld, km, earths: km / EARTH_DIAMETER_KM };
}

/** Tope "redondo" del gráfico, en distancias lunares. */
export function niceMaxLd(maxLd) {
  for (const n of [2, 5, 10, 20, 50, 100]) if (maxLd <= n) return n;
  return Math.ceil(maxLd / 100) * 100;
}

/**
 * Coloca cada objeto en el gráfico: radio proporcional a su distancia real
 * (escala lineal) y un ángulo repartido con el ángulo áureo, que solo sirve
 * para que no se amontonen (la dirección NO es un dato).
 * Devuelve [{ i, ld, x, y }] en unidades donde el borde del gráfico es r = 1.
 */
export function asteroidLayout(distancesLd, maxLd) {
  const GOLDEN = 2.399963229728653;
  return distancesLd.map((ld, i) => {
    const r = Math.min(1, ld / maxLd), a = -Math.PI / 2 + i * GOLDEN;
    return { i, ld, x: r * Math.cos(a), y: r * Math.sin(a) };
  });
}
