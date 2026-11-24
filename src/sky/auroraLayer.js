// auroraLayer.js — auroras en la vista Cielo (three.js): un domo, como el de las nubes (cloudsLayer.js), cuyo
// sombreador busca, para cada dirección, dónde corta el rayo de visión a las cortinas de la aurora.
//
// Física del dibujo (los datos y la geometría pura están en aurora.js):
//   · Cada cortina es una lámina a latitud geomagnética casi constante (un cono con vértice en el centro de la
//     Tierra y eje en el dipolo), plegada a lo largo de la longitud geomagnética. El rayo de visión se corta con
//     ese cono de forma exacta (ecuación de segundo grado) en el marco terrestre: perspectiva y curvatura reales,
//     y la Tierra tapa lo que queda detrás del horizonte.
//   · La altura del punto de corte decide el color: verde del oxígeno (557,7 nm) desde un borde inferior nítido
//     cerca de 100 km y apagándose hacia 200 km; rojo del oxígeno (630,0 nm) arriba, de 200 a 400 km; con mucha
//     actividad, un borde inferior violeta y rosado (nitrógeno), y el rojo y el borde bajan.
//   · Rayos alineados con el campo (casi verticales a estas latitudes) que se desplazan a lo largo del arco, y una
//     pulsación lenta. Una lámina vista de canto brilla más (se atraviesa más luz).
//   · La extinción de la atmósfera la apaga y la enrojece cerca del horizonte; con poca luz el ojo la ve más gris.
//   · Dónde está el óvalo y cuán intenso es en cada meridiano lo dan las franjas de aurora.js (OVATION de NOAA, o el
//     óvalo estimado por el Kp). Las formas finas de las cortinas son ilustrativas; su posición, altura y color, no.
//
// Uso: const au = createAuroraLayer(); scene.add(au.mesh);
//   au.setObserver(lat, lon, elevKm, dipole(fecha)); au.setBands(franjas, hemi); au.setLook({ vis, act });
//   en el bucle: au.tick(ms) (true si hay que volver a dibujar) y au.follow(camera).
// Marco: el del cielo local de Teseo: Y = cenit, −Z = norte, +X = este.
import * as THREE from "three";
import { enu, NB, EARTH_KM } from "./aurora.js";

const VERT = `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = `
precision highp float;
varying vec3 vWorld;
uniform vec3 uE, uN, uU, uM, uM1, uM2;
uniform float uR, uObsR, uHemi, uTime, uVis, uAct, uGain;
uniform sampler2D uBands;
#define D2R 0.017453292519943295
#define R2D 57.29577951308232

float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(i), hash(i + 1.0), f); }
float fbm1(float x) { float s = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { s += a * noise1(x); x = x * 2.03 + 17.1; a *= 0.5; } return s; }
float fold2(float x) { return 0.65 * noise1(x) + 0.35 * noise1(x * 2.1 + 5.3); }

// franja del óvalo en una longitud geomagnética: (centro, anchura, intensidad, difusa); centro 0 = sin aurora
vec4 bandAt(float mlon) {
  vec4 b = texture2D(uBands, vec2(fract((mlon + 180.0) / 360.0), 0.5));
  return vec4(b.r > 0.002 ? 40.0 + 50.0 * b.r : 0.0, 10.0 * b.g, b.b, b.a);
}
float mlonOf(vec3 p) { return atan(dot(p, uM2), dot(p, uM1)) * R2D; }

// latitud geomagnética (valor absoluto) del arco k en una longitud: alrededor del centro del óvalo, con pliegues
float arcLat(float k, float mlon, vec4 b) {
  float off = (k - 1.0) * 0.75 * b.y;                  // un arco en el centro y uno a cada lado
  float fold = (fold2(mlon * 0.09 + k * 7.31 + uTime * 0.01) - 0.5) * (0.35 + 0.25 * b.y) * (0.7 + 0.7 * uAct);
  float wave = sin(mlon * 0.35 + k * 2.1 - uTime * 0.05) * 0.2;
  return b.x + off + fold + wave;
}

// corte del rayo O + s·d con el cono de latitud geomagnética m (grados, con signo): raíces s0, s1 (o −1)
vec2 cone(vec3 O, vec3 d, float mDeg) {
  float sm = sin(mDeg * D2R), c2 = sm * sm;
  float a = dot(d, uM), b = dot(O, uM);
  float A = a * a - c2, B = 2.0 * (a * b - c2 * dot(O, d)), C = b * b - c2 * dot(O, O);
  float disc = B * B - 4.0 * A * C;
  if (disc < 0.0 || abs(A) < 1e-9) return vec2(-1.0);
  float q = sqrt(disc);
  vec2 s = vec2((-B - q) / (2.0 * A), (-B + q) / (2.0 * A));
  if (s.x > s.y) s = s.yx;
  // solo la hoja del hemisferio pedido: el producto con el eje debe tener el signo de la latitud
  vec3 p0 = O + d * s.x, p1 = O + d * s.y;
  if (s.x <= 0.0 || dot(p0, uM) * sm < 0.0) s.x = -1.0;
  if (s.y <= 0.0 || dot(p1, uM) * sm < 0.0) s.y = -1.0;
  return s;
}

// distancia a la que el rayo choca con la Tierra (o un número enorme)
float earthHit(vec3 O, vec3 d) {
  float b = dot(O, d), c = dot(O, O) - uR * uR, disc = b * b - c;
  if (disc < 0.0) return 1e9;
  float s = -b - sqrt(disc);
  return s > 0.0 ? s : 1e9;
}

// distancia a la que el rayo llega a una altura h (salida de la esfera R + h), o −1
float shell(vec3 O, vec3 d, float h) {
  float r = uR + h, b = dot(O, d), c = dot(O, O) - r * r, disc = b * b - c;
  if (disc < 0.0) return -1.0;
  float s = -b + sqrt(disc);
  return s > 0.0 ? s : -1.0;
}

// luz de un punto de corte con el arco k
vec3 curtain(float k, vec3 p, vec3 d, float sHit) {
  float r = length(p), h = r - uR;
  if (h < 80.0 || h > 450.0 || sHit > earthHit(uObsR * uU, d)) return vec3(0.0);
  float mlon = mlonOf(p);
  vec4 b = bandAt(mlon);
  if (b.z < 0.01) return vec3(0.0);
  // rayos: estrías a lo largo del arco que se desplazan; su brillo decide hasta dónde suben
  float rayA = noise1(mlon * 6.0 + k * 13.0 - uTime * 0.18);
  float rayB = noise1(mlon * 27.0 + k * 5.0 - uTime * 0.55);
  float rayC = noise1(mlon * 71.0 + k * 3.0 + uTime * 0.9);
  float rays = 0.12 + 0.88 * pow(rayA, 2.0) * (0.45 + 0.55 * rayB) * (0.75 + 0.25 * rayC);
  float low = 100.0 - 9.0 * uAct;                                   // borde inferior: baja con la actividad
  float top = 150.0 + 140.0 * rays * (0.6 + 0.4 * uAct);
  float green = smoothstep(low - 4.0, low + 3.0, h) * exp(-max(h - (low + 12.0), 0.0) / 34.0) * (1.0 - smoothstep(top - 60.0, top + 10.0, h));
  float red = exp(-pow((h - 235.0) / 70.0, 2.0)) * (0.08 + 0.95 * uAct * uAct) * (0.5 + 0.5 * rays);
  float fringe = exp(-pow((h - low - 1.5) / 4.5, 2.0)) * smoothstep(0.45, 0.85, uAct);
  // cuánto brilla este arco en este meridiano; el más ecuatorial suele ser el más vivo
  float w = k < 0.5 ? 0.7 : (k < 1.5 ? 1.0 : 0.45);   // el central, el más vivo; el del lado polar, el más tenue
  float pulse = 0.82 + 0.18 * sin(uTime * (0.6 + 0.3 * k) + mlon * 0.7);
  float I = b.z * w * pulse * (0.15 + 0.85 * rays);
  // lámina vista de canto: atraviesa más luz
  vec3 ph = p / r, nrm = normalize(uM - dot(ph, uM) * ph);
  float edge = min(1.0 / max(abs(dot(d, nrm)), 0.33), 3.0);
  vec3 col = vec3(0.36, 1.0, 0.58) * green + vec3(1.0, 0.16, 0.24) * red + vec3(0.62, 0.32, 1.0) * fringe * 0.9 + vec3(1.0, 0.35, 0.65) * fringe * 0.35;
  return col * I * edge;
}

void main() {
  vec3 v = normalize(vWorld - cameraPosition);
  if (v.y < -0.25) discard;
  vec3 d = normalize(v.x * uE + v.y * uU - v.z * uN);       // dirección en el marco terrestre
  vec3 O = uObsR * uU;
  vec3 acc = vec3(0.0);
  // punto de referencia del rayo (a 120 km) para leer la franja de partida
  float s120 = shell(O, d, 120.0);
  if (s120 < 0.0) discard;
  float mlon0 = mlonOf(O + d * s120);
  for (int ki = 0; ki < 3; ki++) {
    float k = float(ki);
    float ml = mlon0;
    vec4 b = bandAt(ml);
    if (b.x <= 0.0) { ml = mlonOf(O + d * shell(O, d, 250.0)); b = bandAt(ml); }
    if (b.x <= 0.0) continue;
    // dos pasadas: el arco se pliega, así que su latitud depende de la longitud del punto de corte
    vec2 s = cone(O, d, uHemi * arcLat(k, ml, b));
    for (int it = 0; it < 2; it++) {
      float sRef = s.x > 0.0 ? s.x : s.y;
      if (sRef <= 0.0) break;
      float ml2 = mlonOf(O + d * sRef);
      vec4 b2 = bandAt(ml2);
      if (b2.x <= 0.0) break;
      s = cone(O, d, uHemi * arcLat(k, ml2, b2));
    }
    if (s.x > 0.0) acc += curtain(k, O + d * s.x, d, s.x);
    if (s.y > 0.0) acc += curtain(k, O + d * s.y, d, s.y);
  }
  // aurora difusa: un fondo tenue dentro de la franja, más espeso cerca del horizonte (más camino)
  float s200 = shell(O, d, 200.0);
  if (s200 > 0.0 && s120 < earthHit(O, d)) {
    vec3 pd = O + d * mix(s120, s200, 0.3);
    vec4 bd = bandAt(mlonOf(pd));
    float am = abs(asin(clamp(dot(normalize(pd), uM), -1.0, 1.0)) * R2D);
    float inside = bd.x > 0.0 ? exp(-0.5 * pow((am - bd.x) / max(bd.y, 0.4), 2.0)) : 0.0;
    float path = min((s200 - s120) / 100.0, 6.0);
    acc += vec3(0.25, 0.9, 0.45) * bd.w * inside * path * 0.05;
  }
  // extinción de la atmósfera (más fuerte en azul) cerca del horizonte
  float sa = max(v.y, 0.0);
  float X = min(1.0 / (sa + 0.025 * exp(-11.0 * sa)), 38.0);
  acc *= exp(-X * vec3(0.09, 0.13, 0.25));
  // con poca luz el ojo pierde el color
  float L = dot(acc, vec3(0.3, 0.59, 0.11)) * uGain;
  float sat = smoothstep(0.02, 0.3, L);
  acc = mix(vec3(L / max(uGain, 1e-3)), acc, 0.3 + 0.7 * sat);
  gl_FragColor = vec4(acc * uGain * uVis, 1.0);
}`;

/** Franjas Float32Array(NB·4) de aurora.js → bytes RGBA para la textura. */
export function encodeBands(bands) {
  const out = new Uint8Array(NB * 4);
  for (let i = 0; i < NB; i++) {
    const c = bands[i * 4], w = bands[i * 4 + 1];
    out[i * 4] = c ? Math.max(1, Math.round(((c - 40) / 50) * 255)) : 0;
    out[i * 4 + 1] = c ? Math.max(1, Math.round((Math.min(w, 10) / 10) * 255)) : 0;
    out[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, bands[i * 4 + 2])) * 255);
    out[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, bands[i * 4 + 3])) * 255);
  }
  return out;
}

export function createAuroraLayer({ radius = 3700, segments = 32 } = {}) {
  const data = new Uint8Array(NB * 4);
  const tex = new THREE.DataTexture(data, NB, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; tex.generateMipmaps = false; tex.needsUpdate = true;
  const v3 = () => new THREE.Vector3();
  const uniforms = {
    uE: { value: v3() }, uN: { value: v3() }, uU: { value: v3() }, uM: { value: v3() }, uM1: { value: v3() }, uM2: { value: v3() },
    uR: { value: EARTH_KM }, uObsR: { value: EARTH_KM }, uHemi: { value: 1 }, uTime: { value: 0 },
    uVis: { value: 0 }, uAct: { value: 0 }, uGain: { value: 1.35 }, uBands: { value: tex },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, transparent: true,
    depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const geo = new THREE.SphereGeometry(radius, segments, Math.round(segments / 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "aurora";
  mesh.renderOrder = 2.4;          // después de estrellas y planetas; antes de las nubes (2,5), que la tapan, y del relieve
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  let enabled = false, any = false, vis = 0;
  const show = () => { mesh.visible = enabled && any && vis > 0.01; };
  const set = (u, a) => u.value.set(a[0], a[1], a[2]);

  return {
    mesh, uniforms,
    /** Lugar del observador (grados, km sobre el nivel del mar) y eje del dipolo (aurora.dipole). */
    setObserver(lat, lon, elevKm, dp) {
      const b = enu(lat, lon);
      set(uniforms.uE, b.e); set(uniforms.uN, b.n); set(uniforms.uU, b.u);
      set(uniforms.uM, dp.m); set(uniforms.uM1, dp.m1); set(uniforms.uM2, dp.m2);
      uniforms.uObsR.value = EARTH_KM + Math.max(0, elevKm || 0);
    },
    /** Franjas del óvalo (aurora.ovalBands) y hemisferio (+1/−1); null = sin aurora. */
    setBands(bands, hemi = 1) {
      if (!bands) { any = false; show(); return; }
      data.set(encodeBands(bands)); tex.needsUpdate = true;
      uniforms.uHemi.value = hemi < 0 ? -1 : 1;
      any = false;
      for (let i = 0; i < NB; i++) if (bands[i * 4 + 2] > 0.02) { any = true; break; }
      show();
    },
    /** vis: 0–1 (aurora.darkness); act: Kp/9 (más rojo y borde violeta con actividad). */
    setLook({ vis: v = 0, act = 0 } = {}) {
      vis = v; uniforms.uVis.value = v; uniforms.uAct.value = Math.min(1, Math.max(0, act)); show();
    },
    /** Avanza la animación (ms del reloj). Devuelve true si se ve (hay que dibujar este cuadro). */
    tick(ms) { if (!mesh.visible) return false; uniforms.uTime.value = (ms / 1000) % 100000; return true; },
    follow(camera) {
      if (!mesh.visible) return;
      mesh.position.copy(camera.position);
      mesh.updateMatrix(); mesh.updateMatrixWorld(true);
    },
    setEnabled(b) { enabled = !!b; show(); },
    get visible() { return mesh.visible; },
    dispose() { geo.dispose(); material.dispose(); tex.dispose(); if (mesh.parent) mesh.parent.remove(mesh); },
  };
}
