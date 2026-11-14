// look.js — la mirada del observador EN EL CENTRO de la esfera celeste (vista Cielo).
//
// La cámara se queda en el origen y solo gira: guiñada (yaw, acimut) y cabeceo (pitch,
// altura) dentro de un "marco" con su cenit y su norte. Así lo que se ve es el cielo tal
// como se ve desde la Tierra (no espejado) y nada de lo que queda detrás del observador
// puede dibujarse ni elegirse.
//
//   · Mi cielo (marco local): mundo = horizonte local (Y = cenit, −Z = norte, +X = este).
//   · Sin ubicación (marco ecuatorial): mundo = ecuatorial J2000 (Z = polo norte celeste,
//     X = punto vernal). El "arriba" de la pantalla es el polo norte celeste.
//
// Convención del marco (como un horizonte): yaw 0 mira al "norte" del marco y crece hacia
// el "este" (E = N × U, base diestra); pitch 0 = "horizonte", +90° = "cenit".
// Todo es puro (three, sin DOM): lo comprueban scripts/test_sky_look.mjs.
import * as THREE from "three";

export const SPAN_MIN = 5;        // grados de cielo que abarca el lado largo de la pantalla (zoom máximo)
export const SPAN_MAX = 120;      // … y con el zoom mínimo (más allá la perspectiva deforma demasiado)
export const SPAN_DEF = 100;      // al entrar: ~100° en vertical en el teléfono (≈ 58° en horizontal)
export const PITCH_MIN_LOCAL = -15 * Math.PI / 180;   // Mi cielo: un poco por debajo del horizonte (se ve el suelo)
export const PITCH_MAX = 89.9 * Math.PI / 180;
export const PITCH_MIN_FREE = -PITCH_MAX;             // esfera celeste sin horizonte: cualquier dirección
export const LOCAL_ALT_DEF = 35;                      // Mi cielo: altura inicial de la mirada (°)

const D2R = Math.PI / 180;

// ── tiempo sidéreo y cuaternión ecuatorial → horizonte local ──
export function gmstRad(date) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = JD - 2451545.0;
  let g = 280.46061837 + 360.98564736629 * T;
  g = ((g % 360) + 360) % 360;
  return g * D2R;
}
// Cuaternión que mapea coordenadas ecuatoriales -> mundo local
// (Y = cenit, -Z = Norte, +X = Este) para una latitud/longitud y momento dados.
export function localSkyQuat(latDeg, lonDeg, date) {
  const phi = latDeg * D2R;
  const lst = gmstRad(date) + lonDeg * D2R;
  const up = new THREE.Vector3(Math.cos(phi) * Math.cos(lst), Math.cos(phi) * Math.sin(lst), Math.sin(phi)).normalize();
  const ncp = new THREE.Vector3(0, 0, 1);
  const north = ncp.clone().sub(up.clone().multiplyScalar(ncp.dot(up)));
  if (north.lengthSq() < 1e-6) north.set(1, 0, 0); else north.normalize();
  // Este = Norte × Cenit: así (Este, Cenit, −Norte) es una base diestra (rotación pura).
  const east = new THREE.Vector3().crossVectors(north, up).normalize();
  const B = new THREE.Matrix4().makeBasis(east, up, north.clone().multiplyScalar(-1));
  B.transpose();
  return new THREE.Quaternion().setFromRotationMatrix(B);
}

// ── marcos de la mirada ──
// Cuaternión que lleva el marco "horizonte" (E = +X, U = +Y, N = −Z) al mundo.
// local: identidad. Ecuatorial: U = polo norte celeste (+Z), N = punto vernal (+X), E = N × U = −Y.
export function lookFrame(local) {
  if (local) return new THREE.Quaternion();
  const E = new THREE.Vector3(0, -1, 0), U = new THREE.Vector3(0, 0, 1), N = new THREE.Vector3(1, 0, 0);
  const M = new THREE.Matrix4().makeBasis(E, U, N.clone().negate());
  return new THREE.Quaternion().setFromRotationMatrix(M);
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _e = new THREE.Euler();
// dirección (mundo, unitaria) → { yaw, pitch } en el marco qF
export function dirToYawPitch(dir, qF, out = {}) {
  _v.copy(dir).normalize().applyQuaternion(_qi.copy(qF).invert());
  out.pitch = Math.asin(Math.max(-1, Math.min(1, _v.y)));
  out.yaw = Math.atan2(_v.x, -_v.z);
  return out;
}
// { yaw, pitch } en el marco qF → dirección en el mundo
export function yawPitchToDir(yaw, pitch, qF, out = new THREE.Vector3()) {
  const c = Math.cos(pitch);
  return out.set(Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c).applyQuaternion(qF);
}
// orientación de la cámara (mira por −Z, arriba +Y) para esa mirada: el "arriba" de la
// pantalla apunta al cenit del marco (o al polo norte celeste)
export function lookQuat(yaw, pitch, qF, out = new THREE.Quaternion()) {
  _e.set(pitch, -yaw, 0, "YXZ");
  return out.copy(qF).multiply(_q.setFromEuler(_e));
}

// "span" = grados que abarca el lado largo de la pantalla → campo de visión vertical de three
export function spanToFov(span, aspect) {
  const half = Math.tan(span * D2R / 2);
  return 2 * Math.atan(aspect >= 1 ? half / aspect : half) / D2R;
}
// lado corto deseado (grados) → span
export function shortToSpan(shortDeg, aspect) {
  const a = aspect >= 1 ? aspect : 1 / aspect;
  return 2 * Math.atan(Math.tan(shortDeg * D2R / 2) * a) / D2R;
}
export const clampSpan = (s) => Math.max(SPAN_MIN, Math.min(SPAN_MAX, s));

// Arrastre: el cielo sigue al dedo. dx, dy en px CSS; fovDeg = campo vertical; h = alto del visor.
// Cerca del cenit el giro de acimut se acelera (hasta ~3×) para que el punto central siga al dedo.
export function dragDelta(dx, dy, fovDeg, h, pitch) {
  const k = 2 * Math.tan(fovDeg * D2R / 2) / Math.max(1, h);     // radianes por px en el centro de la vista
  return { dyaw: -dx * k / Math.max(0.35, Math.cos(pitch)), dpitch: dy * k };
}
// Límite del cabeceo "indulgente": si una búsqueda dejó la mirada bajo el límite (un objeto
// bajo el horizonte), se puede subir desde ahí pero no bajar más.
export function clampPitch(next, prev, min, max) {
  const lo = Math.min(min, prev), hi = Math.max(max, prev);
  return Math.max(lo, Math.min(hi, next));
}
// Mirada inicial de Mi cielo. En latitudes tropicales (|lat| < 20°, p. ej. Ecuador) el
// ecuador celeste y la eclíptica pasan casi por el cenit: lo que va a verse esa noche
// —la Luna, los planetas, Orión en noviembre— SALE por el este, así que se mira al este.
// Más al norte se mira al sur (y más al sur, al norte): allí culminan el ecuador y la eclíptica.
export function localDefaultAz(lat) {
  return Math.abs(lat) < 20 ? 90 : lat > 0 ? 180 : 0;
}

// Uniforme uScale de las estrellas desde dentro: algo más grandes al acercar (como en Stellarium).
export function starScaleFor(fovDeg) {
  return Math.max(1.5, Math.min(3.2, 1.9 * Math.pow(75 / Math.max(1, fovDeg), 0.35)));
}

// ── selección por toque ──
// Proyecta un punto del mundo a la pantalla SOLO si se ve: delante de la cámara (producto
// escalar positivo con la mirada), dentro del encuadre y, con la esfera vista desde fuera,
// en el hemisferio que da a la cámara. Devuelve { x, y } en px CSS o null.
const _f = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3();
export function screenOf(camera, p, w, h, mode, out = {}) {
  _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _d.copy(p).sub(camera.position);
  if (_d.dot(_f) <= 0) return null;                                   // detrás del observador
  if (mode === "out" && p.dot(camera.position) <= p.lengthSq()) return null;   // cara oculta de la esfera
  _p.copy(p).project(camera);
  if (!(_p.z > -1 && _p.z < 1) || Math.abs(_p.x) > 1.02 || Math.abs(_p.y) > 1.02) return null;
  out.x = (_p.x * 0.5 + 0.5) * w; out.y = (-_p.y * 0.5 + 0.5) * h;
  return out;
}
// Elige entre los candidatos bajo el dedo. Cada uno: { sx, sy, r, prio, … } con r = radio
// visible del objeto en px (disco de un planeta) y prio = ventaja en px para desempatar
// (planetas, Sol y Luna > objetos con nombre > estrellas débiles). Solo cuentan los que
// están a menos de max(radio táctil, r) del toque; gana el más cercano EN PANTALLA (menos
// la ventaja). `same` = los que caen prácticamente en el mismo punto que el ganador
// (para el selector de objetos amontonados), ordenados igual.
export function rankHits(cands, px, py, touchR, sameR = 14) {
  const hits = [];
  for (const c of cands) {
    const d = Math.hypot(c.sx - px, c.sy - py);
    if (d > Math.max(touchR, c.r || 0)) continue;
    const de = Math.max(0, d - 0.8 * (c.r || 0));                   // dentro del disco dibujado = distancia 0
    hits.push({ ...c, d: de, score: de - (c.prio || 0) });
  }
  if (!hits.length) return { best: null, same: [] };
  hits.sort((a, b) => a.score - b.score);
  const best = hits[0];
  const same = hits.filter((h) => Math.hypot(h.sx - best.sx, h.sy - best.sy) < sameR);
  return { best, same };
}
