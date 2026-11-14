// atmosphere.js — atmósfera y contaminación lumínica de la vista Cielo.
// PURO: sin DOM ni three; se prueba con `node scripts/test_sky_atmosphere.mjs`.
//
// Qué se CALCULA con modelos publicados (y qué no):
//
//  1. Fase del cielo según la altura del Sol: día (> −0,833°, salida/puesta con refracción y semidiámetro),
//     crepúsculo civil (hasta −6°), náutico (−12°), astronómico (−18°) y noche. Definiciones del
//     U.S. Naval Observatory / Astronomical Almanac.
//
//  2. Masa de aire: Kasten, F. y Young, A. T. (1989). "Revised optical air mass tables and approximation
//     formula". Applied Optics 28(22), 4735–4738:   X = 1 / [ sen h + 0,50572 (h + 6,07995°)^−1,6364 ]
//     (h = altura aparente en grados). Válida de 0° a 90°: X(90°) = 1,000, X(30°) = 1,994, X(0°) ≈ 38.
//
//  3. Coeficiente de extinción en V y en B (mag por masa de aire) con la corrección por altitud del sitio:
//     Schaefer, B. E. (1998). "To the visual limits". Sky & Telescope 95(5), 57–60, programa VISLIMIT.BAS
//     (y Schaefer 1993, Vistas in Astronomy 36, 311–361). Suma de Rayleigh (∝ e^(−H/8200 m)), aerosoles
//     (∝ e^(−H/1500 m), humedad, estación), ozono y vapor de agua. Constantes transcritas del programa
//     VISLIMIT (versión JavaScript de L. Bogan, bogan.ca/astro/optics/vislimit.html) y contrastadas con la
//     implementación independiente de Stellarium (src/core/modules/Skybright.cpp): coinciden.
//     Al nivel del mar (HR 40 %, 15 °C) da k_V ≈ 0,31; a 2.850 m (Quito) k_V ≈ 0,15.
//     El enrojecimiento cerca del horizonte se estima como el exceso de color E(B−V) = (k_B − k_V)·X.
//
//  4. Brillo del cielo en cada dirección (nanolamberts, banda V): modelo de Schaefer (1993, 1998), mismo
//     programa: luz del Sol de día, crepúsculo, luz de la Luna (según fase, altura y distancia angular) y
//     fondo nocturno con su aumento hacia el horizonte. El fondo nocturno de cada clase de Bortle sale de
//     lightPollution.js (Hänel et al. 2018, tabla 2; ver supuestos allí). Conversión
//     mag/arcsec² ↔ nL:  B[nL] = 34,08·exp(20,7233 − 0,92104·μ)  (equivale a L[cd/m²] ≈ 10,8·10⁴·10^(−0,4μ),
//     Hänel et al. 2018, ec. 1).
//     Contraste con mediciones (Hänel et al. 2018, tabla 2, sitio al nivel del mar): fin del crepúsculo
//     náutico ≈ 19,4 y fin del civil ≈ 12,9 mag/arcsec² en el cenit; el modelo da ≈ 19,2 y ≈ 13,2.
//
//  5. Umbral de visión de una estrella sobre ese fondo: ley de Hecht (1947) con las constantes de
//     Schaefer (1990, PASP 102, 212; y VISLIMIT): I = C1 (1 + √(C2·B))², m = −16,57 − 2,5 log10 I.
//     Schaefer cambia de rama (bastones → conos) en B = 1500 nL; aquí se toma la rama más sensible
//     (mín. de ambas), que coincide con la suya salvo ≤ 0,1 mag cerca del cambio y evita un salto.
//
//  6. Anclaje en la escala de Bortle: para cada clase, la magnitud límite en el cenit en noche cerrada y
//     sin Luna es la PUBLICADA por Bortle (2001) (lightPollution.js). Al umbral de Schaefer (observador
//     medio) se le suma una "ventaja del observador" A (mag) para reproducirla; con esa misma A se calcula
//     cuánto empeora el límite con el Sol, la Luna o cerca del horizonte.
//     · A se fija en los extremos con el fondo de Hänel et al. (2018): clase 1 con 21,9 mag/arcsec² y
//       clase 9 con 16,8; en medio varía linealmente y el fondo de cada clase se deduce invirtiendo el
//       umbral (`bortleSky`). Así A es monótona y "más Bortle" nunca da más estrellas, tampoco con Luna.
//     · A solo vale en visión nocturna: se aplica entera por debajo de 0,005 cd/m² y se anula por encima
//       de 5 cd/m², con transición logarítmica (límites de la visión mesópica, CIE 191:2010). Supuesto de
//       Teseo: la práctica y la adaptación a la oscuridad de los observadores de Bortle no ayudan con luz
//       de día (visión con conos), así que de día se usa el observador medio de Schaefer.
//     · Que A sea grande en cielo oscuro (al nivel del mar ≈ +1,5 mag en clase 1 y ≈ +0,25 en clase 9) refleja que las cifras de Bortle son de un
//       observador experimentado y "con esfuerzo" (Crumey 2014, MNRAS 442, 2600: lo típico es 6–6,6).
//
// Qué NO es un cálculo físico: los COLORES del cielo (gradiente cenit→horizonte, resplandor del lado
// del Sol, tono rojizo del crepúsculo, tinte de la contaminación lumínica). Son una APROXIMACIÓN VISUAL
// por fotogramas clave según la altura del Sol, hecha a mano; la interfaz lo dice ("aproximación visual").
// La transparencia de cada estrella (alpha) también es una decisión visual (ver `visibility`).
//
// No se modelan: nubes, calima o polvo volcánico, montañas en el horizonte, refracción, centelleo,
// adaptación a la oscuridad incompleta, ni que la contaminación lumínica sea más fuerte hacia la ciudad.

import { BORTLE, clampBortle, SKY_ENDPOINTS } from "./lightPollution.js";

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const LOG10 = Math.log10;

// ── 1. fases ──────────────────────────────────────────────────────────────
export const SUNRISE_ALT = -0.833;   // centro del Sol en la salida/puesta (refracción 34′ + semidiámetro 16′)
export const PHASE_LIMITS = { civil: -6, nautical: -12, astronomical: -18 };
export function twilightPhase(sunAlt) {
  if (sunAlt > SUNRISE_ALT) return "día";
  if (sunAlt > -6) return "civil";
  if (sunAlt > -12) return "náutico";
  if (sunAlt > -18) return "astronómico";
  return "noche";
}

// ── 2. masa de aire ───────────────────────────────────────────────────────
// Kasten & Young (1989). Por debajo de 0° se usa el valor en 0° (el objeto no se ve: está tras el horizonte).
export function airmass(altDeg) {
  const h = Math.max(0, Math.min(90, altDeg));
  return 1 / (Math.sin(h * D2R) + 0.50572 * Math.pow(h + 6.07995, -1.6364));
}
// Masa de aire que usa Schaefer DENTRO de su modelo de brillo del cielo (VISLIMIT): se conserva tal cual
// para no alterar el modelo calibrado. Z = distancia cenital en grados; por debajo del horizonte, 40.
function airmassSky(zDeg) {
  if (zDeg > 90) return 40;
  const c = Math.cos(zDeg * D2R);
  return 1 / (c + 0.025 * Math.exp(-11 * c));
}

// ── 3. extinción ──────────────────────────────────────────────────────────
// Schaefer (1998), VISLIMIT. Bandas: B (0,44 µm) y V (0,55 µm). Devuelve mag por masa de aire.
// elevation_m: altitud del sitio · rh: humedad relativa (%) · tempC · latDeg · month (1–12).
export function extinction({ elevation_m = 0, rh = 40, tempC = 15, latDeg = 0, month = 6 } = {}) {
  const H = Math.max(0, elevation_m), RH = clamp(rh, 5, 95);   // HR = 100 % divide por log(1) = 0
  const LT = latDeg * D2R, RA = (month - 3) * 30 * D2R, SL = latDeg >= 0 ? 1 : -1;
  const band = (wa, oz, wt) => {
    const kR = 0.1066 * Math.exp(-H / 8200) * Math.pow(wa / 0.55, -4);
    const kA = 0.1 * Math.pow(wa / 0.55, -1.3) * Math.exp(-H / 1500) * Math.pow(1 - 0.32 / Math.log(RH / 100), 1.33) * (1 + SL * Math.sin(RA));
    const kO = oz * (3 + 0.4 * (LT * Math.cos(RA) - Math.cos(3 * LT))) / 3;
    const kW = wt * 0.94 * (RH / 100) * Math.exp(tempC / 15) * Math.exp(-H / 8200);
    return { k: kR + kA + kO + kW, kR, kA, kO, kW };
  };
  const V = band(0.55, 0.031, 0.031), B = band(0.44, 0.0, 0.045);
  return { k: V.k, kB: B.k, parts: V };
}

// ── 4. brillo del cielo ───────────────────────────────────────────────────
export const magToNl = (mu) => 34.08 * Math.exp(20.7233 - 0.92104 * mu);
export const nlToMag = (b) => (20.7233 - Math.log(Math.max(b, 1e-6) / 34.08)) / 0.92104;
const RAW_TO_NL = 1e12 / 1.11e-3;             // ergios del programa → nanolamberts (VISLIMIT: ×1e12, /1,11e−3)
const MO_V = -11.05, MS_V = -26.74;           // constantes de banda V del programa (Luna/Sol)
// función de dispersión de VISLIMIT para el Sol o la Luna a ρ grados del punto mirado
function scatterF(rhoDeg) {
  const r = Math.max(rhoDeg, 0.5);            // el disco mide ~0,5°: no se evalúa más cerca
  const c = Math.cos(r * D2R);
  return 6.2e7 / (r * r) + Math.pow(10, 6.15 - r / 40) + Math.pow(10, 5.36) * (1.06 + c * c);
}
// factor de aumento del fondo nocturno hacia el horizonte (Schaefer, tipo van Rhijn)
const nightShape = (zDeg) => { const s = Math.sin(Math.min(90, zDeg) * D2R); return 0.4 + 0.6 / Math.sqrt(1 - 0.96 * s * s); };
// magnitud de la Luna llena… a fase α (ángulo de fase en grados, 0 = llena): Schaefer (1998)
export const moonMagV = (phaseAngleDeg) => { const a = Math.abs(phaseAngleDeg); return -12.73 + 0.026 * a + 4e-9 * Math.pow(a, 4); };
export const phaseAngleFromIllum = (illum) => Math.acos(clamp(2 * illum - 1, -1, 1)) * R2D;

// dir en el marco local: [x = este, y = cenit, z = −norte] (como src/sky/look.js)
export function altAzToDir(altDeg, azDeg, out = [0, 0, 0]) {
  const a = altDeg * D2R, z = azDeg * D2R, c = Math.cos(a);
  out[0] = c * Math.sin(z); out[1] = Math.sin(a); out[2] = -c * Math.cos(z);
  return out;
}
export function dirToAltAz(d) {
  const alt = Math.asin(clamp(d[1], -1, 1)) * R2D;
  let az = Math.atan2(d[0], -d[2]) * R2D; if (az < 0) az += 360;
  return { alt, az };
}
const angDeg = (a, b) => Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)) * R2D;

// Brillo total (nL) en la dirección d, con las partes por separado (para pruebas y depuración).
export function skyBrightnessAt(d, st) {
  const Z = Math.acos(clamp(d[1], -1, 1)) * R2D;
  const Zs = Math.min(Z, 90);                                   // bajo el horizonte se usa el horizonte
  const k = st.k, X = airmassSky(Zs);
  const fExt = 1 - Math.pow(10, -0.4 * k * X);                  // fracción de luz dispersada en la columna
  // fondo nocturno (natural + artificial) de la clase: medido en el cenit; crece hacia el horizonte con el
  // factor de Schaefer. Sin su atenuación por extinción: Schaefer la aplica a la luz que viene de fuera de
  // la atmósfera pero omite la luz nocturna dispersada en la propia atmósfera, que la compensa (el cielo
  // nocturno real es más brillante cerca del horizonte, no más oscuro). Supuesto de Teseo.
  const night = st.b0Nl * (nightShape(Zs) / nightShape(0));
  // Sol: mínimo entre crepúsculo y luz diurna (VISLIMIT)
  let sun = 0;
  if (st.sunAlt > -24) {
    const RS = Math.max(angDeg(d, st.sunDir), 0.5);
    const bt = Math.pow(10, -0.4 * (MS_V - MO_V + 32.5 - st.sunAlt - Zs / (360 * k))) * (100 / RS) * fExt;
    const bd = Math.pow(10, -0.4 * (MS_V - MO_V + 43.27)) * fExt * (scatterF(RS) * st.c4 + 440000 * (1 - st.c4));
    sun = Math.min(bt, bd) * RAW_TO_NL;
  }
  // Luna: solo sobre el horizonte (desvanecida en los 2° anteriores a su salida)
  let moon = 0;
  if (st.moonFade > 0) {
    const RM = angDeg(d, st.moonDir);
    moon = st.moonPre * fExt * (scatterF(RM) * st.c3 + 440000 * (1 - st.c3)) * st.moonFade * RAW_TO_NL;
  }
  return { total: night + sun + moon, night, sun, moon };
}

// ── 5. umbral de visión ───────────────────────────────────────────────────
// Magnitud de la estrella más débil visible sobre un fondo B (nL), tal como llega al ojo (sin extinción).
export function thresholdMag(bNl) {
  const B = Math.max(bNl, 0);
  const iRod = Math.pow(10, -9.8) * Math.pow(1 + Math.sqrt(Math.pow(10, -1.9) * B), 2);
  const iCone = Math.pow(10, -8.35) * Math.pow(1 + Math.sqrt(Math.pow(10, -5.9) * B), 2);
  return -16.57 - 2.5 * LOG10(Math.min(iRod, iCone));
}

// Peso de la ventaja del observador según la luminancia del fondo: 1 en visión escotópica (≤ 0,005 cd/m²),
// 0 en fotópica (≥ 5 cd/m²), logarítmico en la mesópica (CIE 191:2010). 1 nL = 3,183·10⁻⁶ cd/m².
const NL_SCOTOPIC = 0.005 / 3.183e-6, NL_PHOTOPIC = 5 / 3.183e-6;
export function adaptWeight(bNl) {
  if (bNl <= NL_SCOTOPIC) return 1;
  if (bNl >= NL_PHOTOPIC) return 0;
  return 1 - LOG10(bNl / NL_SCOTOPIC) / LOG10(NL_PHOTOPIC / NL_SCOTOPIC);
}
// Umbral (magnitud tal como llega al ojo) para un observador con ventaja A.
export const observerThreshold = (bNl, A) => thresholdMag(bNl) + A * adaptWeight(bNl);

// Inversa: fondo (nL) sobre el que el umbral con ventaja A vale m (bisección en escala logarítmica; la
// función es estrictamente decreciente para A ≥ −1).
export function backgroundForThreshold(m, A = 0) {
  let lo = -6, hi = 12;                                   // log10 nL
  for (let i = 0; i < 90; i++) { const mid = (lo + hi) / 2; if (observerThreshold(10 ** mid, A) > m) lo = mid; else hi = mid; }
  return 10 ** ((lo + hi) / 2);
}

// ── 6. Bortle → fondo nocturno y ventaja del observador ──────────────────
// Para un coeficiente de extinción k: A (mag, en magnitudes tal como llegan al ojo) y el fondo nocturno
// en el cenit (nL y mag/arcsec²) que el modelo asocia a la clase. En el cenit (X = 1) la estrella más débil
// visible tiene magnitud de catálogo  observerThreshold(b0, A) − k = NELM de Bortle.
const _bortleCache = new Map();
export function bortleSky(cls, k = 0.2) {
  const c = clampBortle(cls), key = `${c}|${k.toFixed(4)}`;
  if (_bortleCache.has(key)) return _bortleCache.get(key);
  const kz = k * airmass(90);              // extinción en el cenit
  const B1 = magToNl(SKY_ENDPOINTS[1]), B9 = magToNl(SKY_ENDPOINTS[9]);
  const A1 = (BORTLE[1].nelmRef + kz - thresholdMag(B1)) / adaptWeight(B1);
  const A9 = (BORTLE[9].nelmRef + kz - thresholdMag(B9)) / adaptWeight(B9);
  const A = A1 + (A9 - A1) * (c - 1) / 8;
  const b0Nl = c === 1 ? B1 : c === 9 ? B9 : backgroundForThreshold(BORTLE[c].nelmRef + kz, A);
  const out = { cls: c, A, b0Nl, b0Mag: nlToMag(b0Nl) };
  if (_bortleCache.size > 400) _bortleCache.clear();
  _bortleCache.set(key, out);
  return out;
}

// ── 7. estado del cielo ───────────────────────────────────────────────────
// sun, moon: { alt, az } en grados (az desde el norte hacia el este); moon.illum = fracción iluminada (0–1).
// opts: { elevation_m, rh, tempC, latDeg, month }.
export function skyState(sun, moon, bortle = 5, opts = {}) {
  const cls = clampBortle(bortle);
  const ext = extinction(opts);
  const k = ext.k;
  const { A, b0Nl, b0Mag } = bortleSky(cls, k);
  const sunAlt = sun ? sun.alt : -90;
  const sunDir = sun ? altAzToDir(sun.alt, sun.az) : [0, -1, 0];
  const st = {
    cls, k, kB: ext.kB, b0Mag, b0Nl,
    sunAlt, sunDir, c4: Math.pow(10, -0.4 * k * airmassSky(90 - sunAlt)),
    moonAlt: moon ? moon.alt : -90, moonDir: moon ? altAzToDir(moon.alt, moon.az) : [0, -1, 0],
    moonIllum: moon && moon.illum != null ? moon.illum : 0,
    moonFade: 0, moonPre: 0, c3: 1,
  };
  if (moon && moon.alt > -2 && st.moonIllum > 0.001) {
    const mm = moonMagV(phaseAngleFromIllum(st.moonIllum));
    st.moonFade = moon.alt >= 0 ? 1 : 1 + moon.alt / 2;
    st.moonPre = Math.pow(10, -0.4 * (mm - MO_V + 43.27));
    st.c3 = Math.pow(10, -0.4 * k * airmassSky(90 - moon.alt));
  }
  // ventaja del observador de Bortle: reproduce su magnitud límite en el cenit con el fondo de la clase
  const nelm = BORTLE[cls].nelmRef;
  st.A = A;                              // ventaja del observador (mag), ver punto 6
  const zen = skyBrightnessAt([0, 1, 0], st);
  st.zenith = { nl: zen.total, mag: nlToMag(zen.total), parts: zen };
  st.magLimit = observerThreshold(zen.total, A) - k * airmass(90);   // magnitud de catálogo, en el cenit
  st.nelmDark = nelm;
  st.phase = twilightPhase(sunAlt);
  st.colors = skyColors(st);
  return st;
}

// ── visibilidad de un objeto ──────────────────────────────────────────────
// star: { mag, alt, az } o { mag, dir: [x,y,z] } (marco local). Devuelve:
//   visible: si su magnitud tras la extinción queda por debajo del umbral en ese punto del cielo;
//   magAparenteConExtincion: m + k·X (X de Kasten & Young);
//   alpha (0–1): DECISIÓN VISUAL — 0 si no se ve; si se ve, de 0,25 en el umbral a 1 cuando supera el
//     umbral en 1,5 mag o más (lo que está justo en el límite se percibe apenas);
//   reddening: exceso de color E(B−V) = (k_B − k_V)·X, para teñir de rojo cerca del horizonte;
//   margin: umbral − magnitud (mag). skyMag: brillo del cielo allí (mag/arcsec²).
const _d = [0, 0, 0];
export function visibility(star, st) {
  const d = star.dir || altAzToDir(star.alt, star.az, _d);
  const alt = star.dir ? Math.asin(clamp(d[1], -1, 1)) * R2D : star.alt;
  if (alt <= 0) return { visible: false, magAparenteConExtincion: Infinity, alpha: 0, reddening: 0, margin: -Infinity, skyMag: NaN };
  const X = airmass(alt);
  const mObs = star.mag + st.k * X;
  const b = skyBrightnessAt(d, st).total;
  const margin = observerThreshold(b, st.A) - mObs;
  const visible = margin >= 0;
  return {
    visible, magAparenteConExtincion: mObs,
    alpha: visible ? 0.25 + 0.75 * smooth(0, 1.5, margin) : 0,
    reddening: (st.kB - st.k) * X, margin, skyMag: nlToMag(b),
  };
}

// Cuántas estrellas de un catálogo de magnitudes quedan por debajo de un límite (todo el cielo, sin horizonte).
export function countBrighter(mags, limit) { let n = 0; for (let i = 0; i < mags.length; i++) if (mags[i] <= limit) n++; return n; }
// Cuántas se ven AHORA: items = [{ mag, dir }] en el marco local.
export function countVisibleNow(items, st) { let n = 0; for (const it of items) if (visibility(it, st).visible) n++; return n; }

// ── colores: APROXIMACIÓN VISUAL (no es un modelo de dispersión) ──────────
// Fotogramas clave hechos a mano según la altura del Sol. Cada uno: [altura, cenit, horizonte, resplandor
// del lado del Sol, opacidad]. La noche cerrada coincide con el fondo de la vista (#04080f) y opacidad 0,
// para que de noche el cielo quede exactamente como sin atmósfera.
const KEYS = [
  [-18, [4, 8, 15], [6, 10, 20], [6, 10, 20], 0.0],
  [-12, [6, 11, 30], [22, 26, 56], [52, 38, 70], 0.55],
  [-8, [12, 26, 66], [86, 60, 96], [170, 82, 70], 0.85],
  [-4, [26, 58, 122], [214, 128, 96], [255, 128, 64], 1],
  [0, [46, 92, 168], [242, 178, 128], [255, 176, 96], 1],
  [6, [52, 110, 196], [176, 206, 236], [255, 226, 180], 1],
  [20, [44, 112, 210], [168, 204, 240], [255, 246, 222], 1],
];
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export function skyColors(st) {
  const h = st.sunAlt;
  let i = 0; while (i < KEYS.length - 2 && h > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  let zenith = mix3(a[1], b[1], t), horizon = mix3(a[2], b[2], t);
  const sunGlow = mix3(a[3], b[3], t);
  let alpha = lerp(a[4], b[4], t);
  // luz de la Luna y contaminación lumínica: solo cuando ya es de noche (atenuadas en el crepúsculo)
  const nightW = 1 - smooth(-12, -4, h);
  const moonRatio = st.zenith ? st.zenith.parts.moon / st.b0Nl : 0;
  const mw = clamp(LOG10(1 + moonRatio) / 1.4, 0, 1) * nightW;          // 1 ≈ Luna llena alta en cielo oscuro
  const lp = clamp((21.65 - st.b0Mag) / 4.2, 0, 1) * nightW;            // 0 natural · ~0,7 suburbano · ~0,9 urbano
  zenith = mix3(zenith, [22, 34, 66], mw * 0.75);
  horizon = mix3(horizon, [40, 54, 88], mw * 0.75);
  zenith = mix3(zenith, [30, 28, 34], lp * 0.55);
  horizon = mix3(horizon, [92, 70, 52], lp * 0.8);                        // resplandor gris-anaranjado de la ciudad
  alpha = Math.max(alpha, Math.max(mw * 0.7, lp * 0.75));
  const n = (c) => [c[0] / 255, c[1] / 255, c[2] / 255];
  return {
    zenith: n(zenith), horizon: n(horizon), sunGlow: n(sunGlow), alpha,
    glow: clamp(smooth(-14, -2, h) * (h > 8 ? 0.6 : 1), 0, 1),        // intensidad del resplandor solar
    ground: n(mix3([4, 6, 10], horizon, 0.18)),
    approx: "visual",
  };
}

// ¿Se ve alguna estrella? Sirve para el aviso "es de día". Sirio (m = −1,46) es la más brillante.
export const SIRIUS_MAG = -1.46;
export const starsHidden = (st) => st.magLimit < SIRIUS_MAG;
