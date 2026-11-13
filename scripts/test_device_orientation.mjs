// Pruebas del módulo src/sky/deviceOrientation.js (modo "Apuntar al cielo").
// Uso:  node scripts/test_device_orientation.mjs     (sale con código 1 si algo falla)
// Sin dependencias nuevas: solo Node y three (ya instalado) para contrastar el cuaternión.
import * as THREE from "three";
import {
  cameraQuat, cameraLook, lookFromQuat, wrap360, angleDiff, smoothAngle, normalizeScreenAngle,
  validAngles, compassReliable, compassAlphaOffset, compassPoint8,
} from "../src/sky/deviceOrientation.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => {
  if (cond) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FALLA ${name} ${detail}`); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const nearAng = (a, b, eps = 1e-6) => Math.abs(angleDiff(a, b)) <= eps;
const fmt = (l) => `(alt ${l.alt.toFixed(3)}, az ${l.az.toFixed(3)}, up E${l.upE.toFixed(2)} N${l.upN.toFixed(2)} U${l.upU.toFixed(2)})`;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

console.log("Casos conocidos (retrato, ángulo de pantalla 0)");
{
  // 1. plano boca arriba, parte superior al norte → la cámara trasera mira al nadir
  let l = cameraLook(0, 0, 0, 0);
  ok(near(l.alt, -90), "plano boca arriba → nadir (alt −90°)", fmt(l));
  ok(near(l.upN, 1) && near(l.upU, 0), "plano boca arriba → el 'arriba' de la pantalla apunta al norte", fmt(l));
  l = cameraLook(123, 0, 0, 0);
  ok(near(l.alt, -90), "plano boca arriba con cualquier alpha → nadir", fmt(l));

  // 2. vertical en retrato, pantalla hacia el sur (el usuario mira al norte)
  l = cameraLook(0, 90, 0, 0);
  ok(near(l.alt, 0) && nearAng(l.az, 0), "vertical mirando al norte → alt 0°, az 0°", fmt(l));
  ok(near(l.upU, 1), "vertical → el 'arriba' es el cenit", fmt(l));

  // 3. igual pero mirando al este (alpha es antihorario: este = 270)
  l = cameraLook(270, 90, 0, 0);
  ok(near(l.alt, 0) && nearAng(l.az, 90), "vertical mirando al este → az 90°", fmt(l));
  l = cameraLook(180, 90, 0, 0);
  ok(near(l.alt, 0) && nearAng(l.az, 180), "vertical mirando al sur → az 180°", fmt(l));
  l = cameraLook(90, 90, 0, 0);
  ok(near(l.alt, 0) && nearAng(l.az, 270), "vertical mirando al oeste → az 270°", fmt(l));

  // 4. inclinado 45° hacia arriba (la parte superior se acerca al usuario: beta = 135)
  l = cameraLook(0, 135, 0, 0);
  ok(near(l.alt, 45) && nearAng(l.az, 0), "inclinado 45° hacia arriba, al norte → alt 45°, az 0°", fmt(l));
  l = cameraLook(270, 135, 0, 0);
  ok(near(l.alt, 45) && nearAng(l.az, 90), "inclinado 45° hacia arriba, al este → alt 45°, az 90°", fmt(l));
  l = cameraLook(0, 60, 0, 0);
  ok(near(l.alt, -30) && nearAng(l.az, 0), "inclinado 30° hacia abajo (beta 60) → alt −30°", fmt(l));

  // 5. sobre la cabeza con la pantalla hacia abajo → cenit
  l = cameraLook(0, 180, 0, 0);
  ok(near(l.alt, 90), "sobre la cabeza, pantalla hacia abajo (beta 180) → cenit (alt 90°)", fmt(l));
  l = cameraLook(0, -180, 0, 0);
  ok(near(l.alt, 90), "beta −180 equivale a 180 → cenit", fmt(l));
  l = cameraLook(40, 0, 90, 0);
  ok(near(l.alt, 0), "de canto (gamma 90) → la cámara mira al horizonte", fmt(l));
}

console.log("Horizontal (landscape): mismo resultado físico con ángulo de pantalla 90 / 270");
{
  // teléfono girado en antihorario (parte superior al oeste), pantalla al sur, mirando al norte:
  // alpha 90, beta 0, gamma −90; la interfaz gira → screen.orientation.angle = 90
  let l = cameraLook(90, 0, -90, 90);
  ok(near(l.alt, 0) && nearAng(l.az, 0) && near(l.upU, 1), "landscape 90°, mirando al norte → alt 0, az 0, arriba = cenit", fmt(l));
  // girado en horario (parte superior al este): alpha 270, beta 0, gamma 90; ángulo 270
  l = cameraLook(270, 0, 90, 270);
  ok(near(l.alt, 0) && nearAng(l.az, 0) && near(l.upU, 1), "landscape 270°, mirando al norte → alt 0, az 0, arriba = cenit", fmt(l));
  // la misma postura expresada con gamma en su rango (−90): alpha 90, beta 180, gamma −90
  l = cameraLook(90, 180, -90, 270);
  ok(near(l.alt, 0) && nearAng(l.az, 0) && near(l.upU, 1), "landscape 270° (ángulos equivalentes) → mismo resultado", fmt(l));
  // sin compensar el ángulo de pantalla el 'arriba' quedaría de lado: la compensación importa
  l = cameraLook(90, 0, -90, 0);
  ok(near(l.alt, 0) && nearAng(l.az, 0) && near(l.upU, 0, 1e-9), "sin compensar (ángulo 0) el 'arriba' NO es el cenit (control)", fmt(l));
  // retrato invertido (180): teléfono cabeza abajo, pantalla al sur
  l = cameraLook(180, -90, 0, 180);
  ok(near(l.alt, 0) && nearAng(l.az, 0) && near(l.upU, 1), "retrato invertido 180°, mirando al norte → arriba = cenit", fmt(l));
}

// ── Contraste independiente: se construye la postura física y se obtienen los
// ángulos de Euler con el algoritmo del apéndice de la especificación W3C.
function eulerFromMatrix(m) { // m[fila][col], R = Rz·Rx·Ry
  let alpha, beta, gamma;
  if (m[2][2] > 1e-12) {
    alpha = Math.atan2(-m[0][1], m[1][1]); beta = Math.asin(m[2][1]); gamma = Math.atan2(-m[2][0], m[2][2]);
  } else if (m[2][2] < -1e-12) {
    alpha = Math.atan2(m[0][1], -m[1][1]); beta = -Math.asin(m[2][1]);
    beta += beta >= 0 ? -Math.PI : Math.PI; gamma = Math.atan2(m[2][0], -m[2][2]);
  } else if (m[2][0] > 0) {
    alpha = Math.atan2(-m[0][1], m[1][1]); beta = Math.asin(m[2][1]); gamma = -Math.PI / 2;
  } else if (m[2][0] < 0) {
    alpha = Math.atan2(m[0][1], -m[1][1]); beta = -Math.asin(m[2][1]);
    beta += beta >= 0 ? -Math.PI : Math.PI; gamma = -Math.PI / 2;
  } else {
    alpha = Math.atan2(m[1][0], m[0][0]); beta = m[2][1] > 0 ? Math.PI / 2 : -Math.PI / 2; gamma = 0;
  }
  return [wrap360(alpha * R2D), beta * R2D, gamma * R2D];
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// Para "la cámara mira a (alt, az) con el horizonte nivelado" y una interfaz girada θ,
// devuelve los ángulos que daría el sensor.
function sensorFor(alt, az, theta) {
  const a = alt * D2R, z = az * D2R, t = theta * D2R;
  const fwd = [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];             // E, N, U
  const up = [-Math.sin(a) * Math.sin(z), -Math.sin(a) * Math.cos(z), Math.cos(a)];
  const right = cross(fwd, up);
  // ejes del dispositivo: derecha_pantalla = cosθ·x − sinθ·y ; arriba_pantalla = sinθ·x + cosθ·y
  const x = [0, 1, 2].map(i => Math.cos(t) * right[i] + Math.sin(t) * up[i]);
  const y = [0, 1, 2].map(i => -Math.sin(t) * right[i] + Math.cos(t) * up[i]);
  const zz = fwd.map(v => -v);
  return eulerFromMatrix([[x[0], y[0], zz[0]], [x[1], y[1], zz[1]], [x[2], y[2], zz[2]]]);
}
console.log("Barrido: postura física → ángulos del sensor (algoritmo W3C) → módulo, en las 4 orientaciones de pantalla");
{
  let worst = 0, n = 0, bad = "";
  for (const theta of [0, 90, 180, 270]) {
    for (let alt = -85; alt <= 85; alt += 17) {
      for (let az = 0; az < 360; az += 23) {
        const [al, be, ga] = sensorFor(alt, az, theta);
        const l = cameraLook(al, be, ga, theta);
        const e = Math.max(Math.abs(l.alt - alt), Math.abs(angleDiff(l.az, az)), Math.abs(l.upU - Math.cos(alt * D2R)));
        if (e > worst) { worst = e; bad = `alt ${alt} az ${az} θ ${theta} → ${fmt(l)}`; }
        n++;
      }
    }
  }
  ok(worst < 1e-6, `${n} posturas coinciden en altitud, azimut y horizonte nivelado (error máx. ${worst.toExponential(2)})`, bad);
  // ángulos de pantalla "raros": −90 (window.orientation en iOS) se normaliza a 270
  ok(normalizeScreenAngle(-90) === 270 && normalizeScreenAngle(90) === 90 && normalizeScreenAngle(undefined) === 0 && normalizeScreenAngle(360) === 0,
    "normalizeScreenAngle: −90 → 270, indefinido → 0");
}

console.log("Cuaternión compatible con three.js");
{
  let worst = 0;
  const q = new THREE.Quaternion(), f = new THREE.Vector3(), u = new THREE.Vector3(), arr = [0, 0, 0, 1];
  for (const theta of [0, 90, 270]) for (let alt = -80; alt <= 80; alt += 20) for (let az = 5; az < 360; az += 35) {
    const [al, be, ga] = sensorFor(alt, az, theta);
    cameraQuat(arr, al, be, ga, theta, 0);
    q.set(arr[0], arr[1], arr[2], arr[3]);
    worst = Math.max(worst, Math.abs(q.length() - 1));
    f.set(0, 0, -1).applyQuaternion(q); u.set(0, 1, 0).applyQuaternion(q);
    // marco de Teseo: +X Este, +Y cenit, −Z Norte
    const a = alt * D2R, z = az * D2R;
    worst = Math.max(worst, Math.abs(f.x - Math.cos(a) * Math.sin(z)), Math.abs(f.y - Math.sin(a)), Math.abs(-f.z - Math.cos(a) * Math.cos(z)));
    worst = Math.max(worst, Math.abs(u.y - Math.cos(a)));
  }
  ok(worst < 1e-6, `cámara de three.js: −Z mira a (alt, az) y +Y queda nivelado (error máx. ${worst.toExponential(2)})`);
  // lookFromQuat es la inversa
  cameraQuat(arr, ...sensorFor(35, 45, 0), 0, 0);
  const l = lookFromQuat(arr[0], arr[1], arr[2], arr[3], {});
  ok(near(l.alt, 35) && nearAng(l.az, 45), "lookFromQuat recupera alt 35°, az 45° (NE)", fmt(l));
}

console.log("Alineación manual (desfase de azimut)");
{
  let l = cameraLook(0, 90, 0, 0, 25);
  ok(near(l.alt, 0) && nearAng(l.az, 25), "desfase +25° → el azimut pasa de 0° a 25°", fmt(l));
  l = cameraLook(0, 135, 0, 0, -40);
  ok(near(l.alt, 45) && nearAng(l.az, 320), "desfase −40° con alt 45° → az 320°, altitud intacta", fmt(l));
  l = cameraLook(90, 0, -90, 90, 10);
  ok(near(l.alt, 0) && nearAng(l.az, 10) && near(l.upU, 1), "desfase en landscape → az 10°, horizonte nivelado", fmt(l));
}

console.log("Ángulos: cruce 0/360 y suavizado");
{
  ok(angleDiff(350, 10) === -20 && angleDiff(10, 350) === 20 && angleDiff(180, 0) === 180 && angleDiff(0, 180) === 180, "angleDiff toma el camino corto");
  ok(near(smoothAngle(350, 10, 0.5), 0) && near(smoothAngle(10, 350, 0.5), 0) && near(smoothAngle(359, 1, 0.25), 359.5), "smoothAngle cruza 0/360 sin saltar");
  ok(wrap360(-10) === 350 && wrap360(725) === 5 && wrap360(360) === 0, "wrap360");
  // cuaterniones consecutivos al cruzar el norte: sin salto (el mismo giro pequeño)
  const a = cameraQuat([0, 0, 0, 1], 1, 100, 0, 0), b = cameraQuat([0, 0, 0, 1], 359, 100, 0, 0);
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  ok(near(2 * Math.acos(Math.min(1, dot)) * R2D, 2, 1e-6), "alpha 1° → 359°: los cuaterniones difieren solo 2°");
}

console.log("Valores nulos y brújula de iOS");
{
  ok(!validAngles(null, 10, 10) && !validAngles(10, null, 0) && !validAngles(undefined, 1, 1) && !validAngles(NaN, 1, 1) && validAngles(0, 0, 0),
    "validAngles rechaza null / undefined / NaN y acepta ceros");
  ok(compassReliable(0) && compassReliable(45) && compassReliable(-60) && !compassReliable(90) && !compassReliable(135) && !compassReliable(null),
    "compassReliable: solo entre plano y casi vertical");
  // iOS: alpha relativo 30, la brújula dice que la parte superior apunta al este (90)
  const off = compassAlphaOffset(90, 30);
  ok(near(off, 240), "compassAlphaOffset(rumbo 90, alpha 30) = 240");
  let l = cameraLook(30 + off, 90, 0, 0);
  ok(near(l.alt, 0) && nearAng(l.az, 90), "con ese desfase, al poner el teléfono vertical la cámara mira al este", fmt(l));
  // el desfase no depende de hacia dónde se gire después (alpha baja 50° = giro horario de 50°)
  l = cameraLook(30 - 50 + off, 120, 0, 0);
  ok(near(l.alt, 30) && nearAng(l.az, 140), "tras girar 50° a la derecha y subir 30° → az 140°, alt 30°", fmt(l));
  ok([0, 44, 90, 135, 180, 225, 270, 315, 338, 359].map(compassPoint8).join("") === "0123456700", "compassPoint8: N, NE, E, SE, S, SO, O, NO");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
