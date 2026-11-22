// plumeLayer.js — columnas de gases y ceniza ILUSTRATIVAS sobre los volcanes del horizonte, en el marco local del
// horizonte (x este, y arriba, z −norte; el observador en el origen; distancias en km).
//   · simulate(v): la última erupción de un volcán: la columna sube hasta la altura típica de su índice de
//     explosividad (VEI) y el viento del pronóstico la tumba y se la lleva.
//   · ambient(list): la pluma de los volcanes que el Smithsonian da en erupción y se ven desde el lugar.
// Humo volumétrico: cada pluma es un rectángulo que mira al observador; en cada píxel se recorre el rayo a través
// de una densidad analítica (un tubo que sigue la línea central de una pluma tumbada por el viento, cada vez más
// ancho, con el borde roto por ruido fractal que viaja con el viento: las «coliflores») y se ilumina con la luz
// del Sol del momento (una muestra de sombra hacia el Sol). Como las cámaras del Instituto Geofísico: plumas bajas
// y tumbadas en las erupciones pequeñas; columna vertical con paraguas en las grandes.
// No es una predicción ni una alerta: solo la altura (por el VEI) y la dirección del viento salen de datos.
import * as THREE from "three";

const R_SKY = 850;                      // radio de la esfera donde se dibuja el rectángulo (como los nombres, a 860)
const STEPS = 40;
// altura de la columna (km sobre el cráter) para cada VEI: la parte baja del intervalo de Newhall y Self (1982).
// El VEI de una erupción larga es el de su momento más fuerte; casi todo el tiempo la columna fue menor
export const VEI_KM = [0.1, 0.6, 2.5, 6, 13, 25, 32, 38, 42];
export const veiColumnKm = (vei) => VEI_KM[Math.max(0, Math.min(8, Number.isFinite(vei) ? Math.round(vei) : 2))];

/** Posición (km; x este, y arriba, z −norte) del cráter visto desde el observador: rumbo, ángulo y distancia. */
export function ventPos(azDeg, altDeg, distKm) {
  const a = azDeg * Math.PI / 180, h = distKm * Math.tan(altDeg * Math.PI / 180);
  return [distKm * Math.sin(a), h, -distKm * Math.cos(a)];
}

/**
 * Forma de la pluma (km): H altura sobre el cráter, Lb distancia en la que el viento la tumba (corta: columna
 * casi vertical; larga: pluma tendida), len largo que se dibuja, r0 radio en el cráter, ash 0–1 (0 vapor blanco,
 * 1 ceniza). kind: "sim" (la última erupción, por su VEI) o "gas" (en erupción ahora: baja, sobre todo gases).
 */
export function plumeParams(vei, kind = "sim", windMs = 5) {
  const w = Math.max(0.4, Math.min(2, (Number.isFinite(windMs) ? windMs : 5) / 6));
  if (kind === "gas") {
    const H = Math.max(0.8, Math.min(2.2, veiColumnKm(vei) * 0.5));
    return { H, Lb: H * 0.9 * w, len: Math.max(7, H * 6), r0: 0.16, ash: 0.3, strong: 0 };
  }
  const H = veiColumnKm(vei), strong = H >= 10 ? 1 : 0;
  return strong
    ? { H, Lb: H * 0.14 * w, len: H * 2.6, r0: 0.05 * H + 0.3, ash: 0.9, strong }
    : { H: Math.max(0.5, H), Lb: Math.max(0.4, H * 0.8 * w), len: Math.max(5, Math.min(22, H * 5)), r0: 0.12 + 0.05 * H, ash: 0.8, strong };
}

/** Altura (km) de la línea central a `u` km del cráter a favor del viento. */
export const centerHeight = (u, P) => P.H * (1 - Math.exp(-Math.max(0, u) / P.Lb));

const VERT = `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = `
precision highp float;
varying vec3 vDir;
uniform vec3 uVent, uC, uSun, uLit, uShadow, uAshCol, uHot;
uniform vec2 uW;
uniform float uH, uLb, uLen, uR0, uRb, uT, uAsh, uNight, uFront, uStrong, uGain;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p, int oct) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { if (i >= oct) break; s += a * n3(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
// densidad (0–1) en el punto p (km, marco del observador); path: cuánto ha recorrido la pluma hasta ahí
float dens(vec3 p, int oct, out float path) {
  vec3 q = p - uVent;
  float u = dot(q.xz, uW), v = dot(q.xz, vec2(-uW.y, uW.x)), z = q.y;
  path = 0.0;
  if (z < -0.03) return 0.0;
  float uc = max(u, 0.0);
  float hc = uH * (1.0 - exp(-uc / uLb));
  // distancia a la línea central: a la misma altura (tramo que sube) o en la misma vertical (tramo tendido)
  float zc = clamp(z, 0.0, 0.97 * uH);
  float ucz = -uLb * log(1.0 - zc / uH);
  float dA = z < 0.97 * uH ? length(vec2(u - ucz, v)) : 1e3;
  float dB = length(vec3(min(u, 0.0), v, z - hc));
  float dd = min(dA, dB);
  path = mix(ucz + zc, uc + hc, smoothstep(-0.5, 0.5, (dA - dB) / (uR0 + 0.3)));
  // se ensancha al alejarse, cada vez menos (si no, una pluma larga acabaría ocupando medio cielo)
  float r = uR0 + 0.2 * path / (1.0 + path / 12.0) + uStrong * 0.35 * uH * smoothstep(0.75 * uH, uH, z);   // el paraguas de las grandes
  if (dd > r * 1.7) return 0.0;
  // el borde, roto por ruido que viaja con la pluma (coliflores); más grueso cuanto más ancha
  // coordenadas que crecen con la pluma (los bultos se agrandan al alejarse) y viajan con ella sin deformarse
  float sc = 0.55 * r + 0.25;
  // (la tercera pasa sin salto del tramo que sube al tendido: con un salto se vería una arista recta en el humo)
  float tb = smoothstep(-0.5 * r, 0.5 * r, dA - dB);
  vec3 nc = vec3(log(sc) / 0.11 - uT * 0.3, v / sc, mix(u - ucz, z - hc, tb) / sc);
  float nz = fbm(nc, oct);
  dd += r * 1.25 * (nz - 0.45);
  float d = smoothstep(r, r * 0.45, dd);
  // pulsos del cráter, el frente que avanza y la cola que se deshace
  float pulse = 0.62 + 0.38 * n3(vec3((path - uT * 0.55) * 0.9 / (uH * 0.5 + 0.5), 3.1, 7.7));
  d *= pulse * smoothstep(uFront, uFront * 0.82, path) * mix(1.0, 0.25, smoothstep(0.35 * uLen, uLen, path)) * smoothstep(uLen, uLen * 0.8, path);
  return d;
}
void main() {
  vec3 d = normalize(vDir);
  // el rayo contra la esfera que envuelve la pluma
  float b = dot(d, uC), c = dot(uC, uC) - uRb * uRb, disc = b * b - c;
  if (disc <= 0.0) discard;
  float sq = sqrt(disc), tA = max(b - sq, 0.0), tB = b + sq;
  // …y contra las dos losas que la ciñen (ancho a través del viento y altura): pasos más cortos, sin rayado
  float rm = 1.7 * (uR0 + min(2.4, 0.2 * (uLen + uH)) + uStrong * 0.35 * uH);
  float dv = dot(d.xz, vec2(-uW.y, uW.x)), v0 = dot(uVent.xz, vec2(-uW.y, uW.x));
  if (abs(dv) > 1e-4) { float a1 = (v0 - rm) / dv, a2 = (v0 + rm) / dv; tA = max(tA, min(a1, a2)); tB = min(tB, max(a1, a2)); }
  if (abs(d.y) > 1e-4) { float a1 = (uVent.y - 0.05) / d.y, a2 = (uVent.y + uH + rm) / d.y; tA = max(tA, min(a1, a2)); tB = min(tB, max(a1, a2)); }
  if (tB <= tA) discard;
  float dt = (tB - tA) / float(${STEPS});
  // desfase por píxel suave y fijo (ruido de gradiente entrelazado): sin grano ni parpadeo
  float jit = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
  float T = 1.0; vec3 col = vec3(0.0);
  float k = 3.2 / (uR0 + 0.06 * uLen);
  for (int i = 0; i < ${STEPS}; i++) {
    vec3 p = d * (tA + (float(i) + jit) * dt);
    float path, rho = dens(p, 4, path);
    if (rho > 0.004) {
      float pl, shd = dens(p + uSun * (uR0 + min(1.5, 0.12 * path)) * 0.9, 2, pl);
      float lit = exp(-1.8 * shd);
      // ceniza cerca del cráter, más clara (vapor y ceniza fina) al alejarse
      float ash = uAsh * mix(1.0, 0.55, smoothstep(0.0, uLen * 0.7, path));
      vec3 base = mix(vec3(0.97), uAshCol, ash);
      vec3 cc = base * mix(uShadow, uLit, lit);
      cc += uHot * uNight * exp(-length(p - uVent) / (uR0 * 2.5)) * 1.6;      // de noche, el resplandor del cráter
      float a = 1.0 - exp(-rho * dt * k * uGain);
      col += T * a * cc; T *= 1.0 - a;
      if (T < 0.02) break;
    }
  }
  float A = 1.0 - T;
  if (A < 0.004) discard;
  gl_FragColor = vec4(col / A, A);
}`;

export function createPlumeLayer() {
  const group = new THREE.Group();
  group.name = "plumes";
  const look = { wind: null, windMs: 5, sun: [0.3, 0.8, 0.3], lit: [1, 1, 1], shadow: [0.45, 0.5, 0.6], night: 0 };
  const mk = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uVent: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0.3, 0.8, 0.3) },
        uLit: { value: new THREE.Vector3(1, 1, 1) }, uShadow: { value: new THREE.Vector3(0.45, 0.5, 0.6) }, uAshCol: { value: new THREE.Vector3(0.56, 0.5, 0.45) },
        uHot: { value: new THREE.Vector3(1.0, 0.42, 0.12) }, uW: { value: new THREE.Vector2(1, 0) },
        uH: { value: 1 }, uLb: { value: 1 }, uLen: { value: 5 }, uR0: { value: 0.2 }, uRb: { value: 5 }, uT: { value: 0 }, uAsh: { value: 0.5 },
        uNight: { value: 0 }, uFront: { value: 1e3 }, uStrong: { value: 0 }, uGain: { value: 1 } } });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false; mesh.renderOrder = 2.79;         // tras las montañas (2,7–2,76)
    mesh.visible = false; group.add(mesh);
    return mesh;
  };
  const simMesh = mk(), ambMeshes = [mk(), mk(), mk()];
  let simV = null, ambList = [], t0 = 0;

  // coloca el rectángulo de una pluma y sus parámetros
  function place(mesh, v, kind) {
    const P = plumeParams(v.vei, kind, look.windMs), U = mesh.material.uniforms;
    const P0 = ventPos(v.az, v.alt, v.dist_km);
    // sin viento del pronóstico, de lado respecto a quien mira (como se suele ver en las cámaras)
    const hl = Math.hypot(P0[0], P0[2]) || 1, W = look.wind || [-P0[2] / hl, P0[0] / hl];
    const rmax = P.r0 + 0.2 * (P.len + 0.6 * P.H) + P.strong * 0.35 * P.H;
    const C = [P0[0] + W[0] * P.len * 0.5, P0[1] + P.H * 0.55, P0[2] + W[1] * P.len * 0.5];
    const Rb = 0.5 * P.len + 0.6 * P.H + rmax;
    U.uVent.value.set(P0[0], P0[1], P0[2]); U.uC.value.set(C[0], C[1], C[2]); U.uW.value.set(W[0], W[1]);
    U.uH.value = P.H; U.uLb.value = P.Lb; U.uLen.value = P.len; U.uR0.value = P.r0; U.uRb.value = Rb; U.uAsh.value = P.ash; U.uStrong.value = P.strong;
    U.uGain.value = kind === "gas" ? 0.7 : 1;
    mesh.userData.P = P;
    // rectángulo perpendicular a la dirección del centro, a R_SKY, que cubre la esfera envolvente
    const L = Math.hypot(C[0], C[1], C[2]) || 1, n = new THREE.Vector3(C[0] / L, C[1] / L, C[2] / L);
    const ang = L > Rb * 1.02 ? Math.min(1.35, Math.asin(Rb / L) * 1.05) : 1.35, half = R_SKY * Math.tan(ang);
    const up = Math.abs(n.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const ex = new THREE.Vector3().crossVectors(up, n).normalize(), ey = new THREE.Vector3().crossVectors(n, ex);
    const pos = mesh.geometry.attributes.position.array, c0 = n.clone().multiplyScalar(R_SKY);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], i) => { const p = c0.clone().addScaledVector(ex, a * half).addScaledVector(ey, b * half); pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; });
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.visible = true;
  }
  function relook(mesh) {
    const U = mesh.material.uniforms;
    U.uSun.value.set(look.sun[0], look.sun[1], look.sun[2]); U.uLit.value.set(look.lit[0], look.lit[1], look.lit[2]);
    U.uShadow.value.set(look.shadow[0], look.shadow[1], look.shadow[2]); U.uNight.value = look.night;
  }
  function refresh() {
    if (simV) place(simMesh, simV, "sim"); else simMesh.visible = false;
    ambMeshes.forEach((m, i) => { if (ambList[i]) place(m, ambList[i], "gas"); else m.visible = false; });
    for (const m of [simMesh, ...ambMeshes]) relook(m);
  }

  return {
    group,
    /** Simular la última erupción de `v` = { az, alt, dist_km, vei }; null para quitarla. */
    simulate(v) { const was = simV; simV = v || null; if (!was || !v || was.az !== v.az || was.dist_km !== v.dist_km) t0 = performance.now(); refresh(); },
    /** Plumas de los volcanes en erupción que se ven: [{ az, alt, dist_km, vei }] (hasta 3). */
    ambient(list) { ambList = Array.isArray(list) ? list.slice(0, ambMeshes.length) : []; refresh(); },
    /**
     * Viento (ve, vn en m/s, hacia donde va), dirección del Sol (marco local), day 0–1, glow 0–1 (arrebol) y el
     * color del horizonte del cielo.
     */
    setLook({ windMs, day = 1, glow = 0, sunDir, horizon } = {}) {
      if (windMs && (windMs[0] || windMs[1])) { const sp = Math.hypot(windMs[0], windMs[1]); look.wind = [windMs[0] / sp, -windMs[1] / sp]; look.windMs = sp; }
      if (sunDir) { const s = new THREE.Vector3(sunDir[0], Math.max(0.08, sunDir[1]), sunDir[2]).normalize(); look.sun = [s.x, s.y, s.z]; }
      const hz = horizon || [0.6, 0.7, 0.9], d = Math.max(0.1, day);
      // luz del Sol (rojiza con el arrebol) y luz del cielo en las sombras; de noche, casi a oscuras
      look.lit = [d * (1 - 0.02 * glow), d * (1 - 0.4 * glow), d * (1 - 0.62 * glow)];
      look.shadow = [d * (0.38 + 0.25 * hz[0]), d * (0.4 + 0.25 * hz[1]), d * (0.44 + 0.28 * hz[2])];
      look.night = 1 - day;
      refresh();
    },
    get active() { return !!simV || ambList.length > 0; },
    get simulating() { return simV; },
    /** Cada cuadro: el tiempo de las plumas. Devuelve si hay alguna (hay que seguir dibujando). */
    update(now) {
      if (!simV && !ambList.length) return false;
      const t = (now % 3600000) / 1000;
      for (const m of ambMeshes) if (m.visible) m.material.uniforms.uT.value = t;
      if (simV) {
        const U = simMesh.material.uniforms, P = simMesh.userData.P, age = (now - t0) / 1000;
        U.uT.value = t;
        U.uFront.value = P ? Math.max(0.2, (P.len + P.H) * Math.min(1, age / 14)) : 1e3;   // el frente tarda ~14 s en llegar al final
      }
      return true;
    },
    dispose() { for (const m of [simMesh, ...ambMeshes]) { m.geometry.dispose(); m.material.dispose(); } if (group.parent) group.parent.remove(group); },
  };
}
