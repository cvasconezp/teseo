// mountAlign.js — «Estacionar montura»: cómo encontrar el norte verdadero para orientar el eje polar de una montura
// ecuatorial, en cualquier lugar del mundo. Matemática pura (sin three ni DOM); se prueba en scripts/test_mount.mjs.
//
// Métodos (methodsFor los ordena según la latitud):
//   · polar     la estrella Polar (hemisferio norte) o σ Octantis (sur, débil): su posición alrededor del polo.
//   · landmark  el punto del horizonte que queda justo al norte (o al sur) verdadero, con el relieve real.
//   · shadow    la sombra de un gnomon: el día del equinoccio la punta traza la línea este–oeste; cualquier otro
//               día, el «círculo indio» (dos marcas a la misma distancia del pie, antes y después del mediodía).
//   · ground    el celular plano en el suelo: con un palillo vertical y el Sol (preciso) o con su brújula.
//   · noon      el mediodía solar: la sombra de una vara vertical marca el norte–sur.
//   · compass   la brújula del celular corregida por la declinación magnética (WMM2025): solo para empezar.
//
// El Sol: fórmulas de baja precisión del Astronomical Almanac (sección C, «Low precision formulas for the Sun»;
// ≈ 0,01° entre 1950 y 2050), suficientes aquí: un error de 0,01° en el acimut del Sol es 0,01° en el norte.
// La Polar y σ Octantis: posiciones Hipparcos J2000 precesadas a la fecha (frames.js, IAU 1976).
import { gmstRad } from "./guide.js";
import { j2000ToDate } from "./frames.js";
import { horizonAltAt } from "./andean.js";

const D = Math.PI / 180;
const wrap360 = (a) => ((a % 360) + 360) % 360;
const wrap180 = (a) => { const x = wrap360(a + 180) - 180; return x === -180 ? 180 : x; };
const H = 3600000, DAY = 86400000;

/** El Sol en un instante (ms): { dec, ra (grados), lambda (longitud eclíptica aparente), eotMin (ecuación del tiempo, min) }. */
export function sunCoords(ms) {
  const d = ms / DAY + 2440587.5 - 2451545.0;
  const g = wrap360(357.529 + 0.98560028 * d), q = wrap360(280.459 + 0.98564736 * d);
  const L = wrap360(q + 1.915 * Math.sin(g * D) + 0.02 * Math.sin(2 * g * D));
  const e = 23.439 - 0.00000036 * d;
  const ra = wrap360(Math.atan2(Math.cos(e * D) * Math.sin(L * D), Math.cos(L * D)) / D);
  const dec = Math.asin(Math.sin(e * D) * Math.sin(L * D)) / D;
  return { dec, ra, lambda: L, eotMin: 4 * wrap180(q - ra) };
}

/** Altura y acimut (grados, acimut desde el norte hacia el este) del Sol, sin refracción. */
export function sunAltAz(lat, lon, ms) {
  const s = sunCoords(ms), H0 = (gmstRad(new Date(ms)) / D + lon - s.ra) * D, p = lat * D, dd = s.dec * D;
  const x = -Math.cos(dd) * Math.sin(H0);
  const y = Math.sin(dd) * Math.cos(p) - Math.cos(dd) * Math.sin(p) * Math.cos(H0);
  const z = Math.sin(dd) * Math.sin(p) + Math.cos(dd) * Math.cos(p) * Math.cos(H0);
  return { alt: Math.asin(Math.max(-1, Math.min(1, z))) / D, az: wrap360(Math.atan2(x, y) / D), dec: s.dec };
}

/**
 * Mediodía solar (ms): el paso del Sol por el meridiano el día solar local que contiene `ms` (el de la longitud,
 * no el de la zona horaria; en la práctica, el mismo día civil salvo cerca de la línea de cambio de fecha).
 */
export function solarNoon(lon, ms) {
  const off = (lon / 360) * DAY;                                  // hora solar media local − UTC
  let t = Math.floor((ms + off) / DAY) * DAY + DAY / 2 - off;      // 12:00 de hora solar media
  for (let i = 0; i < 3; i++) t = Math.floor((ms + off) / DAY) * DAY + DAY / 2 - off - sunCoords(t).eotMin * 60000;
  return t;
}

/** Próximo equinoccio después de `ms`: { t (ms, ± unos minutos), kind: "mar"|"sep" }. */
export function nextEquinox(ms) {
  const s = (t) => Math.sin(sunCoords(t).lambda * D);
  let a = ms, fa = s(a);
  for (let k = 0; k < 400; k++) {
    const b = a + DAY, fb = s(b);
    if ((fa <= 0 && fb > 0) || (fa >= 0 && fb < 0)) {
      let lo = a, hi = b;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, fm = s(m); if ((fa <= 0) === (fm <= 0)) lo = m; else hi = m; }
      const t = (lo + hi) / 2;
      return { t, kind: wrap360(sunCoords(t).lambda) < 90 || wrap360(sunCoords(t).lambda) > 270 ? "mar" : "sep" };
    }
    a = b; fa = fb;
  }
  return null;
}

/** ¿Sirve hoy el método del equinoccio? El Sol casi no cambia de declinación ese día (|δ| < 0,7°): la punta de la sombra va en línea recta. */
export const equinoxToday = (ms) => Math.abs(sunCoords(ms).dec) < 0.7;

/**
 * Plan de la sombra del gnomon para el día de `ms` en (lat, lon). gnomonM: alto del gnomon (m).
 * Con el Sol entre 15° y 75° de altura (si no, la sombra es demasiado larga o demasiado corta):
 *   · equinox: hoy sirve la línea recta del equinoccio: marcas a las horas t1 y t2 (mediodía ∓ offsetH) → este–oeste.
 *   · indian: círculo indio: radio = largo de la sombra en t1; la sombra vuelve a tocarlo en t2.
 *     errDeg: cuánto gira la línea este–oeste porque el Sol cambió de declinación entre las dos marcas.
 * Devuelve { noon, equinox (bool), t1, t2, offsetH, alt, radiusM, errDeg } o null si el Sol no sube lo bastante.
 */
export function shadowPlan(lat, lon, ms, gnomonM = 1) {
  const noon = solarNoon(lon, ms), eq = equinoxToday(noon);
  for (const offsetH of [2.5, 2, 1.5, 1]) {
    const t1 = noon - offsetH * H, t2 = noon + offsetH * H;
    const a1 = sunAltAz(lat, lon, t1), a2 = sunAltAz(lat, lon, t2);
    if (a1.alt < 15 || a2.alt < 15 || a1.alt > 75) continue;
    const dDec = (a2.dec - a1.dec) * D, h = a1.alt * D, sinA = Math.abs(Math.sin(a1.az * D));
    const errDeg = Math.abs(dDec) * Math.cos(a1.dec * D) / (2 * Math.cos(lat * D) * Math.cos(h) * Math.max(0.2, sinA)) / D;
    return { noon, equinox: eq, t1, t2, offsetH, alt: a1.alt, radiusM: gnomonM / Math.tan(h), errDeg };
  }
  return null;
}

/**
 * La sombra a mediodía: largo (m, para un gnomon de `gnomonM`) y hacia dónde cae ("N" o "S"); con el Sol casi en el
 * cenit (sombra < 5 % del gnomon) la línea no se distingue y `usable` es false.
 */
export function noonShadow(lat, lon, ms, gnomonM = 1) {
  const noon = solarNoon(lon, ms), s = sunAltAz(lat, lon, noon);
  const len = s.alt > 0 ? gnomonM / Math.tan(s.alt * D) : Infinity;
  return { noon, alt: s.alt, lengthM: len, toward: s.az > 90 && s.az < 270 ? "N" : "S", usable: s.alt > 3 && len >= 0.05 * gnomonM };
}

/**
 * El celular en el suelo con un palillo vertical: el acimut de la sombra (grados desde el norte verdadero) en `ms` y
 * si sirve (Sol entre 8° y 78°: más alto, la sombra de un palillo de 5 cm mide menos de 1 cm).
 */
export function groundShadow(lat, lon, ms) {
  const s = sunAltAz(lat, lon, ms);
  return { shadowAz: wrap360(s.az + 180), sunAz: s.az, alt: s.alt, usable: s.alt >= 8 && s.alt <= 78 };
}

/** Acimutes (grados) de las líneas del suelo: norte–sur, este–oeste (equinoccios) y salidas y puestas en los solsticios
 * con el horizonte plano (sin relieve: la línea en el suelo). Más allá de los círculos polares, sin solsticios. */
export function groundLines(lat, eps = 23.436) {
  const out = [
    { key: "ns", az: 0, kind: "ns" }, { key: "sn", az: 180, kind: "ns" },
    { key: "eqRise", az: 90, kind: "eq" }, { key: "eqSet", az: 270, kind: "eq" },
  ];
  const c = Math.sin(eps * D) / Math.cos(lat * D);
  if (Math.abs(c) < 1) {
    const A = Math.acos(c) / D;                                     // salida en el solsticio de junio (desde el norte)
    out.push({ key: "junRise", az: A, kind: "sol" }, { key: "junSet", az: 360 - A, kind: "sol" },
      { key: "decRise", az: 180 - A, kind: "sol" }, { key: "decSet", az: 180 + A, kind: "sol" });
  }
  return out;
}

/** Refracción (grados) a una altura aparente `h` (Bennett 1982), escalada por la presión relativa `pf`. */
export function refractionAt(h, pf = 1) {
  return pf * (1 / Math.tan((h + 7.31 / (h + 4.4)) * D)) / 60;
}

/**
 * Las líneas del suelo con el relieve real: dónde ASOMA y se OCULTA el Sol (el borde de arriba) en los solsticios y
 * equinoccios detrás de las montañas de /api/horizon (`hz`, con su altura aparente por acimut). Para cada día se busca
 * el acimut en que la trayectoria del Sol corta el horizonte: cos A = (sen δ − sen φ sen h) / (cos φ cos h), con h la
 * altura verdadera del centro = horizonte − refracción (menor en la altura: presión ≈ e^(−z/8400)) − 0,267°.
 * Devuelve las de groundLines (N–S y E–O quedan fijas) más las de los solsticios corridas (`hor`: altura del horizonte
 * en ese punto) y, con kind "eqR", las de los equinoccios con relieve. Sin horizonte, groundLines tal cual.
 */
export function groundLinesReal(lat, hz, elevM = 0, eps = 23.436) {
  if (!hz || !hz.alt || !hz.alt.length) return groundLines(lat, eps);
  const pf = Math.exp(-Math.max(0, elevM || 0) / 8400), sp = Math.sin(lat * D), cp = Math.cos(lat * D);
  const cross = (dec, east) => {
    let A = null, ca = Math.sin(dec * D) / cp;
    if (Math.abs(ca) >= 1) return null;
    A = Math.acos(ca) / D; if (!east) A = 360 - A;
    let hApp = 0;
    for (let k = 0; k < 8; k++) {
      hApp = horizonAltAt(hz, A);
      const h = (hApp - refractionAt(hApp, pf) - 0.267) * D;
      ca = (Math.sin(dec * D) - sp * Math.sin(h)) / (cp * Math.cos(h));
      if (Math.abs(ca) >= 1) return null;
      const An = Math.acos(ca) / D, Ab = east ? An : 360 - An;
      if (Math.abs(Ab - A) < 0.01) { A = Ab; break; }
      A = Ab;
    }
    return { az: A, hor: hApp };
  };
  const out = groundLines(lat, eps).filter((l) => l.kind !== "sol");
  for (const [key, dec, east, kind] of [["junRise", eps, true, "sol"], ["junSet", eps, false, "sol"], ["decRise", -eps, true, "sol"], ["decSet", -eps, false, "sol"], ["eqRiseR", 0, true, "eqR"], ["eqSetR", 0, false, "eqR"]]) {
    const c = cross(dec, east);
    if (c) out.push({ key, az: c.az, kind, hor: c.hor, real: true });
  }
  return out;
}

/**
 * El punto del horizonte justo al norte (az 0) o al sur (180) verdadero con el relieve real (hz de /api/horizon):
 * { az, alt (grados), distKm (a qué distancia está ese filo), clear (si hay relieve marcado: más de 0,4° de alto y
 * más cerca de 150 km) }. Sin horizonte, null.
 */
export function horizonMark(hz, az) {
  if (!hz || !hz.alt || !hz.alt.length) return null;
  const alt = horizonAltAt(hz, az);
  let distKm = null, best = -Infinity;
  for (const b of hz.bands || []) {
    const a = horizonAltAt(hz, az, b.alt);
    if (a > best - 1e-6) {
      best = a;
      if (b.dist_km) { const st = hz.step_deg || 0.2, n = b.dist_km.length; distKm = b.dist_km[Math.round(wrap360(az) / st) % n]; }
      else distKm = b.max_km || null;
    }
  }
  return { az, alt, distKm, clear: alt > 0.4 && distKm != null && distKm < 150 };
}

// estrellas cerca de los polos celestes (Hipparcos, J2000): la Polar (α UMi, HIP 11767) y σ Octantis (HIP 104382)
const POLE_STARS = {
  north: { name: "Polaris", ra: 37.95456067, dec: 89.26410897, mag: 1.98 },
  south: { name: "sigmaOct", ra: 317.19541, dec: -88.95650, mag: 5.42 },
};

/**
 * Dónde está la estrella del polo respecto al polo celeste, como en el reloj de un buscador de la polar: `clock`
 * (1–12; 12 = encima del polo) visto a simple vista mirando hacia el polo (en el buscador puede verse invertida),
 * `distDeg` (separación del polo), `alt` (su altura) y `poleAlt` (= |latitud|). Cerca del ecuador (|lat| < 5°) null.
 */
export function poleStar(lat, lon, ms) {
  if (Math.abs(lat) < 5) return null;
  const hemi = lat > 0 ? "north" : "south", s = POLE_STARS[hemi], date = new Date(ms);
  const v0 = [Math.cos(s.dec * D) * Math.cos(s.ra * D), Math.cos(s.dec * D) * Math.sin(s.ra * D), Math.sin(s.dec * D)];
  const v = j2000ToDate(v0, date);
  const ra = wrap360(Math.atan2(v[1], v[0]) / D), dec = Math.asin(Math.max(-1, Math.min(1, v[2]))) / D;
  const lst = gmstRad(date) / D + lon, ha = wrap360(lst - ra);       // ángulo horario (grados)
  // mirando al polo norte, el oeste queda a la izquierda: HA 6 h (al oeste del polo) = las 9; mirando al sur, a la derecha
  let clock = hemi === "north" ? wrap360(360 - ha) / 30 : wrap360(ha) / 30;
  clock = Math.round(clock) % 12 || 12;
  const p = lat * D, dd = dec * D, h = ha * D;
  const alt = Math.asin(Math.sin(dd) * Math.sin(p) + Math.cos(dd) * Math.cos(p) * Math.cos(h)) / D;
  return { hemi, name: s.name, mag: s.mag, clock, haDeg: ha, distDeg: 90 - Math.abs(dec), alt, poleAlt: Math.abs(lat) };
}

/**
 * Métodos en orden de conveniencia para la latitud: [{ key, rec (recomendado) }]. Cerca del ecuador la Polar no
 * se ve (el polo está en el horizonte); en el norte es el método natural; en el sur σ Octantis es muy débil.
 */
export function methodsFor(lat, { hasLandmark = false } = {}) {
  const north = lat >= 8, south = lat <= -8;
  const order = north ? ["polar", "landmark", "shadow", "ground", "noon", "compass"]
    : south ? ["landmark", "shadow", "ground", "polar", "noon", "compass"]
    : ["landmark", "shadow", "ground", "noon", "compass"];
  const rec = north ? "polar" : hasLandmark ? "landmark" : "shadow";
  return order.map((key) => ({ key, rec: key === rec }));
}

/** Precisión típica de cada método (grados) y su clase: "fine" (≤ 0,5°), "ok" (≤ 1°), "rough". */
export const METHOD_ACC = { polar: 0.1, landmark: 0.1, shadow: 0.5, ground: 0.7, noon: 1, compass: 5 };
export const accClass = (deg) => (deg <= 0.5 ? "fine" : deg <= 1 ? "ok" : "rough");

/**
 * Estado de la brújula del celular para el aviso: src ("absolute" | "relative" | null) y acc (precisión de iOS en
 * grados, o null si el sistema no la da). → "ok" | "calibrate" (precisión peor que 15° o inválida) | "none" (sin norte).
 */
export function compassStatus(src, acc) {
  if (src !== "absolute") return "none";
  if (acc != null && (acc < 0 || acc > 15)) return "calibrate";
  return "ok";
}
