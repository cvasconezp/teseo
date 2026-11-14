// frames.js — MARCOS de referencia del Cielo: precesión (J2000 ↔ equinoccio de la fecha) y
// paralaje topocéntrica (del centro de la Tierra al observador). Matemática pura: sin three ni DOM.
// La comprueban scripts/test_sky_frames.mjs (contra astropy) y las pruebas del Cielo.
//
// QUÉ MARCO USA CADA COSA
//   · Estrellas, constelaciones, cielo profundo, eclíptica y plano galáctico: ecuatorial J2000
//     (public/sky.json, catálogo HYG = posiciones Hipparcos/ICRS de la época J2000).
//   · src/ephemeris.js da el Sol, la Luna y los planetas en el ecuador y equinoccio DE LA FECHA
//     (Schlyter), geocéntricos. Es lo correcto para salidas, puestas, altura y azimut, porque el
//     tiempo sidéreo (guide.js, look.js) también es de la fecha.
//   · La escena del Cielo está en J2000 (el "mundo" es el de las estrellas). Para colocar un cuerpo
//     entre ellas se precesa de la fecha a J2000 (dateToJ2000); para llevar la escena al horizonte
//     local se precesa J2000 → fecha y luego se gira con el tiempo sidéreo (localSkyQuatJ2000 en
//     look.js = localSkyQuat · P). Así las estrellas, que antes se giraban con un tiempo sidéreo de
//     la fecha sin precesar (~0,37° de error en 2026), caen en su altura y azimut reales.
//
// FUENTES (verificadas el 14-nov-2026)
//   · Precesión IAU 1976 (J. H. Lieske et al. 1977, A&A 58, 1–16), con las fórmulas de J. Meeus,
//     «Astronomical Algorithms», 2.ª ed., cap. 21, ec. 21.2 (época inicial J2000, T = 0):
//       ζ = 2306,2181″ t + 0,30188″ t² + 0,017998″ t³
//       z = 2306,2181″ t + 1,09468″ t² + 0,018203″ t³
//       θ = 2004,3109″ t − 0,42665″ t² − 0,041833″ t³        (t en siglos julianos desde J2000)
//     y la rotación P = R3(−z) · R2(θ) · R3(−ζ) (Explanatory Supplement to the Astronomical Almanac,
//     1992, §3.214), equivalente a las ec. 21.4 de Meeus. Frente a IAU 2006 (Capitaine et al. 2003)
//     difiere < 0,1″ en este siglo. Se usa t en UTC en lugar de TT: 69 s de diferencia mueven la
//     precesión 0,0001″.
//   · Paralaje topocéntrica: Meeus cap. 40 en forma rectangular (se resta al vector geocéntrico del
//     astro el del observador) con ρ sen φ′ y ρ cos φ′ de Meeus cap. 11 (elipsoide IAU 1976:
//     a = 6378,14 km, f = 1/298,257; altitud sobre el nivel del mar H en metros). Es exacta (no
//     una serie) y vale igual para la Luna (hasta ~1°), el Sol (8,8″) y los planetas.
//   · No se aplican nutación (≤ 17″ en longitud), aberración anual (≤ 20,5″) ni movimiento propio
//     de las estrellas (Sirio: 0,01° en 2026): todos juntos quedan por debajo de 0,02°, muy lejos de
//     la tolerancia de 0,05° de las pruebas y de un píxel con el zoom habitual.
import { altAz, gmstRad } from "./guide.js";

const D2R = Math.PI / 180;
const AS2R = D2R / 3600;
export const EARTH_EQ_RADIUS_KM = 6378.14;     // Meeus cap. 11 (IAU 1976)
export const EARTH_B_OVER_A = 0.99664719;      // b/a = 1 − f, f = 1/298,257
export const AU_KM = 149597870.7;

const julianCenturies = (date) => (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;

/** Ángulos de precesión IAU 1976 (radianes) desde J2000 hasta `date` (Meeus 21.2). */
export function precessionAngles(date) {
  const t = julianCenturies(date), t2 = t * t, t3 = t2 * t;
  return {
    zeta: (2306.2181 * t + 0.30188 * t2 + 0.017998 * t3) * AS2R,
    z: (2306.2181 * t + 1.09468 * t2 + 0.018203 * t3) * AS2R,
    theta: (2004.3109 * t - 0.42665 * t2 - 0.041833 * t3) * AS2R,
  };
}

// matriz de la última fecha pedida (la escena y las búsquedas piden muchas veces la misma)
let _pMs = NaN, _pM = null;
/**
 * Matriz de precesión P (3×3, por filas) tal que v_fecha = P · v_J2000.
 * P = R3(−z) · R2(θ) · R3(−ζ). Su traspuesta lleva de la fecha a J2000.
 */
export function precessionMatrix(date) {
  const ms = date.getTime();
  if (ms === _pMs && _pM) return _pM;
  const { zeta, z, theta } = precessionAngles(date);
  const cz = Math.cos(zeta), sz = Math.sin(zeta), cZ = Math.cos(z), sZ = Math.sin(z), ct = Math.cos(theta), st = Math.sin(theta);
  const M = [
    [cz * ct * cZ - sz * sZ, -sz * ct * cZ - cz * sZ, -st * cZ],
    [cz * ct * sZ + sz * cZ, -sz * ct * sZ + cz * cZ, -st * sZ],
    [cz * st, -sz * st, ct],
  ];
  _pMs = ms; _pM = M;
  return M;
}

/** Vector ecuatorial J2000 → ecuador y equinoccio medios de la fecha. */
export function j2000ToDate(v, date, out = [0, 0, 0]) {
  const P = precessionMatrix(date), x = v[0], y = v[1], z = v[2];
  out[0] = P[0][0] * x + P[0][1] * y + P[0][2] * z;
  out[1] = P[1][0] * x + P[1][1] * y + P[1][2] * z;
  out[2] = P[2][0] * x + P[2][1] * y + P[2][2] * z;
  return out;
}
/** Vector del ecuador y equinoccio de la fecha → J2000 (P traspuesta: es una rotación). */
export function dateToJ2000(v, date, out = [0, 0, 0]) {
  const P = precessionMatrix(date), x = v[0], y = v[1], z = v[2];
  out[0] = P[0][0] * x + P[1][0] * y + P[2][0] * z;
  out[1] = P[0][1] * x + P[1][1] * y + P[2][1] * z;
  out[2] = P[0][2] * x + P[1][2] * y + P[2][2] * z;
  return out;
}

/** Altura/azimut (grados) de una dirección J2000 (estrella, objeto del catálogo, cuerpo ya colocado en la escena). */
export function altAzJ2000(nx, ny, nz, latDeg, lonDeg, date) {
  const v = j2000ToDate([nx, ny, nz], date);
  return altAz(v[0], v[1], v[2], latDeg, lonDeg, date);
}

/** ρ sen φ′ y ρ cos φ′ del observador (radios ecuatoriales terrestres), Meeus cap. 11. */
export function observerRho(latDeg, elevM = 0) {
  const phi = latDeg * D2R, h = (Number.isFinite(elevM) ? elevM : 0) / (EARTH_EQ_RADIUS_KM * 1000);
  const u = Math.atan(EARTH_B_OVER_A * Math.tan(phi));
  return { rhoSin: EARTH_B_OVER_A * Math.sin(u) + h * Math.sin(phi), rhoCos: Math.cos(u) + h * Math.cos(phi) };
}

/**
 * Paralaje topocéntrica (Meeus cap. 40, forma rectangular). `dir` = dirección geocéntrica unitaria en el
 * ecuador de la fecha; `distKm` = distancia geocéntrica. Devuelve { dir, distKm } vistos desde el observador
 * (latitud y longitud en grados, longitud positiva al este; altitud en metros), en el mismo marco de la fecha.
 */
export function topocentric(dir, distKm, latDeg, lonDeg, elevM, date) {
  const { rhoSin, rhoCos } = observerRho(latDeg, elevM);
  const lst = gmstRad(date) + lonDeg * D2R;
  const R = EARTH_EQ_RADIUS_KM;
  const x = dir[0] * distKm - R * rhoCos * Math.cos(lst);
  const y = dir[1] * distKm - R * rhoCos * Math.sin(lst);
  const z = dir[2] * distKm - R * rhoSin;
  const d = Math.hypot(x, y, z);
  return { dir: [x / d, y / d, z / d], distKm: d };
}

const raDecVec = (raDeg, decDeg) => {
  const a = raDeg * D2R, d = decDeg * D2R, cd = Math.cos(d);
  return [cd * Math.cos(a), cd * Math.sin(a), Math.sin(d)];
};
/** Distancia geocéntrica (km) de un cuerpo de ephemeris(): la Luna trae dist_km; el Sol y los planetas, dist_au. */
export const bodyDistKm = (b) => (b.dist_km != null ? b.dist_km : b.dist_au != null ? b.dist_au * AU_KM : null);

/**
 * Cuerpos de ephemeris(date) listos para la escena del Cielo, que está en J2000:
 *   nx, ny, nz  dirección J2000 (topocéntrica si hay `place`) — la que se dibuja, se elige y se encuadra
 *   eqDate      la misma dirección en el ecuador de la fecha — para altura y azimut con altAz() de guide.js
 *   topo        true si se aplicó la paralaje del observador
 * Los demás campos (ra, dec de la fecha geocéntricos, distancias, fase, magnitud…) se conservan.
 * place = { lat, lon, elev } (grados, metros) o null (sin lugar: geocéntrico, p. ej. fuera de «Mi cielo»).
 */
export function skyBodies(list, date, place = null) {
  const topoOn = !!(place && Number.isFinite(place.lat) && Number.isFinite(place.lon));
  return list.map((b) => {
    // la dirección se rehace desde ra/dec (sin redondear) en lugar de nx/ny/nz (5 decimales)
    let v = b.ra != null && b.dec != null ? raDecVec(b.ra, b.dec) : [b.nx, b.ny, b.nz];
    const km = bodyDistKm(b);
    if (topoOn && km > 0) v = topocentric(v, km, place.lat, place.lon, place.elev || 0, date).dir;
    const w = dateToJ2000(v, date);
    return { ...b, nx: w[0], ny: w[1], nz: w[2], eqDate: v, topo: topoOn && km > 0 };
  });
}
