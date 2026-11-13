// Matemática del modo "Apuntar al cielo": de los ángulos del sensor de
// orientación del teléfono a la orientación de la cámara del visor.
// Módulo puro (sin DOM ni three.js): se prueba con Node en
// scripts/test_device_orientation.mjs.
//
// ── Convenciones ────────────────────────────────────────────────────────
// Marco del dispositivo (W3C DeviceOrientation):
//   x = hacia la derecha de la pantalla, y = hacia la parte superior de la
//   pantalla, z = saliendo de la pantalla hacia el usuario. Todo referido a la
//   orientación NATURAL del teléfono (retrato), gire o no la interfaz.
// Marco terrestre (W3C): X = Este, Y = Norte, Z = arriba (cenit).
// Ángulos (grados), rotación intrínseca Z-X'-Y'':
//   alpha: giro sobre Z, 0..360, positivo en sentido ANTIHORARIO visto desde
//          arriba (alpha = 90 → la parte superior del teléfono apunta al Oeste).
//   beta:  giro sobre X', −180..180 (90 = teléfono vertical, pantalla hacia ti).
//   gamma: giro sobre Y'', −90..90.
//   R = Rz(alpha) · Rx(beta) · Ry(gamma) lleva vectores del dispositivo al
//   marco terrestre: v_tierra = R · v_dispositivo.
// Cámara trasera: mira por −z del dispositivo. Su "arriba" es el borde
//   superior de la INTERFAZ, que depende de screen.orientation.angle (θ):
//   arriba = (sin θ, cos θ, 0), derecha = (cos θ, −sin θ, 0) en ejes del
//   dispositivo (θ = 90: teléfono girado en antihorario, su parte superior
//   queda a la izquierda del usuario).
// Marco local de Teseo (el de `localSkyQuat`): +X = Este, +Y = cenit,
//   −Z = Norte. Es decir (E, N, U) → (E, U, −N).
// Azimut: grados desde el Norte en sentido HORARIO (N = 0, E = 90).
//   Rumbo de brújula = 360 − alpha con el teléfono plano.
// Altitud: grados sobre el horizonte (cenit = 90, nadir = −90).

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Lleva un ángulo a [0, 360). */
export function wrap360(a) {
  const r = a % 360;
  return r < 0 ? r + 360 : r;
}

/** Diferencia angular más corta a − b, en (−180, 180]. */
export function angleDiff(a, b) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  else if (d <= -180) d += 360;
  return d;
}

/** Paso bajo sobre el círculo: de `prev` hacia `target` una fracción k (sin saltos en 0/360). */
export function smoothAngle(prev, target, k) {
  return wrap360(prev + angleDiff(target, prev) * k);
}

/** screen.orientation.angle normalizado a 0 | 90 | 180 | 270 (acepta −90 de window.orientation). */
export function normalizeScreenAngle(a) {
  if (typeof a !== "number" || !Number.isFinite(a)) return 0;
  return wrap360(Math.round(a / 90) * 90);
}

/** ¿Son utilizables los tres ángulos de un evento? (llegan null sin sensor). */
export function validAngles(alpha, beta, gamma) {
  return Number.isFinite(alpha) && Number.isFinite(beta) && Number.isFinite(gamma)
    && alpha !== null && beta !== null && gamma !== null;
}

/**
 * Cuaternión [x, y, z, w] de la cámara en el marco local de Teseo
 * (+X Este, +Y cenit, −Z Norte) para una lectura del sensor.
 * Con la convención de three.js: la cámara mira por su −Z y su arriba es +Y.
 * Escribe en `out` (sin crear objetos) y lo devuelve.
 *
 * @param {number[]} out        arreglo de 4 posiciones
 * @param {number} alpha        grados (absoluto: 0 = parte superior al Norte)
 * @param {number} beta         grados
 * @param {number} gamma        grados
 * @param {number} screenAngle  screen.orientation.angle (0, 90, 180, 270)
 * @param {number} azOffset     grados que se SUMAN al azimut (alineación manual)
 */
export function cameraQuat(out, alpha, beta, gamma, screenAngle = 0, azOffset = 0) {
  // sumar azimut (horario) equivale a restar alpha (antihorario)
  const a = (alpha - azOffset) * D2R, b = beta * D2R, g = gamma * D2R, th = screenAngle * D2R;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  // columnas de R = ejes del dispositivo expresados en (Este, Norte, Arriba)
  const xE = cA * cG - sA * sB * sG, xN = cG * sA + cA * sB * sG, xU = -cB * sG;
  const yE = -cB * sA,               yN = cA * cB,               yU = sB;
  const zE = cG * sA * sB + cA * sG, zN = sA * sG - cA * cG * sB, zU = cB * cG;
  const cT = Math.cos(th), sT = Math.sin(th);
  // ejes de la cámara en (E, N, U): derecha, arriba y "atrás" (= +z del dispositivo)
  const rE = cT * xE - sT * yE, rN = cT * xN - sT * yN, rU = cT * xU - sT * yU;
  const uE = sT * xE + cT * yE, uN = sT * xN + cT * yN, uU = sT * xU + cT * yU;
  // matriz de rotación en el marco de Teseo (E, U, −N); columnas = derecha, arriba, atrás
  const m00 = rE,  m01 = uE,  m02 = zE;
  const m10 = rU,  m11 = uU,  m12 = zU;
  const m20 = -rN, m21 = -uN, m22 = -zN;
  // matriz → cuaternión (rama estable según la traza)
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  out[0] = x; out[1] = y; out[2] = z; out[3] = w;
  return out;
}

/**
 * Hacia dónde mira una cámara con cuaternión (x, y, z, w) en el marco de Teseo.
 * Escribe en `out` { alt, az, upE, upN, upU } (grados; "up" en Este/Norte/Arriba).
 */
export function lookFromQuat(x, y, z, w, out = {}) {
  // adelante = q · (0, 0, −1); arriba = q · (0, 1, 0)
  const fx = -2 * (x * z + w * y), fy = -2 * (y * z - w * x), fz = -(1 - 2 * (x * x + y * y));
  const ux = 2 * (x * y - w * z), uy = 1 - 2 * (x * x + z * z), uz = 2 * (y * z + w * x);
  out.alt = Math.asin(Math.max(-1, Math.min(1, fy))) * R2D;
  // en el cenit/nadir el azimut no está definido: se usa el del "arriba" de la pantalla
  const horiz = Math.hypot(fx, fz);
  out.az = horiz > 1e-6 ? wrap360(Math.atan2(fx, -fz) * R2D) : wrap360(Math.atan2(fy > 0 ? -ux : ux, fy > 0 ? uz : -uz) * R2D);
  out.upE = ux; out.upU = uy; out.upN = -uz;
  return out;
}

/** Atajo: altitud/azimut y "arriba" de la cámara trasera para una lectura del sensor. */
export function cameraLook(alpha, beta, gamma, screenAngle = 0, azOffset = 0) {
  const q = cameraQuat([0, 0, 0, 1], alpha, beta, gamma, screenAngle, azOffset);
  return lookFromQuat(q[0], q[1], q[2], q[3], {});
}

// ── Brújula de iOS ──────────────────────────────────────────────────────
// En iOS `alpha` es relativo (0 = hacia donde apuntaba el teléfono al empezar)
// y el norte llega aparte en `webkitCompassHeading`: rumbo magnético, en
// sentido horario, de la parte SUPERIOR del teléfono. Con el teléfono entre
// plano y casi vertical (|beta| < ~70°) la proyección horizontal de esa parte
// superior tiene rumbo 360 − alpha_absoluto, así que
//     desfase = (360 − rumbo) − alpha_relativo
// convierte el alpha relativo en absoluto. Más allá de la vertical (al mirar
// alto en el cielo) esa proyección se invierte y el rumbo deja de ser fiable:
// ahí se conserva el último desfase bueno (el giroscopio mantiene el resto).

/** ¿Es fiable el rumbo de brújula en esta postura? */
export function compassReliable(beta) {
  return Number.isFinite(beta) && Math.abs(beta) < 70;
}

/** Desfase (grados, 0..360) que hay que sumar al alpha relativo para hacerlo absoluto. */
export function compassAlphaOffset(compassHeading, alpha) {
  return wrap360(360 - compassHeading - alpha);
}

/** Punto cardinal de 8 rumbos para un azimut: 0 = N, 1 = NE, 2 = E … 7 = NO. */
export function compassPoint8(az) {
  return Math.round(wrap360(az) / 45) % 8;
}
