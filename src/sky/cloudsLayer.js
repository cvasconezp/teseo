// cloudsLayer.js — nubes del pronóstico en la vista Cielo (three.js): un domo, como el de la atmósfera
// (atmosphereLayer.js), que dibuja tres capas de nubes (bajas, medias y altas) vistas desde abajo.
//
// Cada píxel mira en una dirección; esa dirección corta el plano de cada capa (a 1,5, 4,5 y 9 km) en un
// punto, y ahí se evalúa el ruido de nubes (cloudNoise.js) con el umbral calibrado para la nubosidad del
// pronóstico. Así las nubes se apiñan hacia el horizonte con la perspectiva real, y cada capa se desplaza
// con el viento de su altura al mover la hora. Las capas se componen de cerca a lejos (las bajas tapan a las
// medias y estas a las altas) y tapan estrellas, planetas, la Luna y el Sol.
//
// Color: de día, blancas y grises por debajo cuanto más gruesas; en el crepúsculo, teñidas del color del Sol
// bajo; de noche, iluminadas por la Luna y por la luz de la ciudad (más anaranjadas cuanto mayor la clase de
// Bortle; casi negras en un cielo oscuro, donde solo se notan porque tapan estrellas). Aproximación visual.
//
// Uso:
//   const cl = createCloudsLayer();             // { mesh, update(clouds, st, tSec), follow(camera), setEnabled(b) }
//   scene.add(cl.mesh);
//   cl.update(cloudsAt(fc, fecha), skyState(...), fecha / 1000);
//   // en el bucle: cl.follow(camera)
// Marco: el del cielo local de Teseo: Y = cenit, −Z = norte, +X = este.
import * as THREE from "three";
import { GLSL_NOISE, LAYER_STYLE, threshold, fbm } from "./cloudNoise.js";
import { LAYERS, LAYER_KM } from "./weather.js";

const f1 = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
const THICK = { low: 0.85, mid: 0.55, high: 0.1 };   // cuánto se oscurece la base de una nube gruesa

const VERT = `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

function layerGlsl(l, k) {
  const s = LAYER_STYLE[l];
  return `
  if (uOn[${k}] > 0.5) {
    float dist = min(${f1(LAYER_KM[l])} / d.y, 240.0);
    vec2 pe = vec2(d.x, -d.z) * dist - uOff[${k}];
    vec2 w = uDir[${k}];
    vec2 q = vec2(dot(pe, w) / ${f1(s.scaleKm * s.stretch)}, (-pe.x * w.y + pe.y * w.x) / ${f1(s.scaleKm)});
    float n = fbm(q, ${s.octaves});
    float t = clamp((n - (uTh[${k}] - ${f1(s.edge / 2)})) / ${f1(s.edge * 2)}, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    float a = t * ${f1(s.maxAlpha)} * horizonFade;
    vec3 col = mix(lit, uShade, pow(t, 1.5) * ${f1(THICK[l])});
    col += uSunGlow * rim * (1.0 - t);
    col = mix(col, uHorizon, (1.0 - exp(-dist / 90.0)) * uHaze);
    acc.rgb += (1.0 - acc.a) * a * col;
    acc.a += (1.0 - acc.a) * a;
  }`;
}

const FRAG = `
uniform float uOn[3];
uniform float uTh[3];
uniform vec2 uOff[3];
uniform vec2 uDir[3];
uniform vec3 uLit;
uniform vec3 uLitAnti;
uniform vec3 uShade;
uniform vec3 uSunGlow;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform float uRim;
uniform float uHaze;
varying vec3 vWorld;
${GLSL_NOISE}
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  if (d.y <= 0.004) discard;
  float horizonFade = smoothstep(0.004, 0.06, d.y);
  float rim = pow(max(dot(d, normalize(uSun)), 0.0), 10.0) * uRim;
  // lado del Sol: en el crepúsculo las nubes hacia el Sol se encienden y las del lado opuesto quedan grises
  vec2 sh = uSun.xz;
  float side = (length(d.xz) > 1e-4 && length(sh) > 1e-4) ? 0.5 + 0.5 * dot(normalize(d.xz), normalize(sh)) : 0.5;
  vec3 lit = mix(uLitAnti, uLit, side * side);
  vec4 acc = vec4(0.0);
${LAYERS.map(layerGlsl).join("\n")}
  if (acc.a < 0.003) discard;
  gl_FragColor = vec4(acc.rgb / acc.a, acc.a);
}`;

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/**
 * Luz de las nubes para un estado del cielo (skyState de atmosphere.js): colores RGB lineales 0–1.
 * { lit, shade, sunGlow, horizon, rim, haze, day, night } — `night` es el color de una nube de noche.
 */
export function cloudLight(st) {
  const sunAlt = st ? st.sunAlt : -90, cls = st ? st.cls : 5;
  const day = sstep(-6, 8, sunAlt);
  const tw = sstep(-10, -2, sunAlt) * (1 - sstep(3, 14, sunAlt));
  const lp = Math.pow(Math.max(0, (cls - 1) / 8), 1.5);
  let night = [0.010 + 0.11 * lp, 0.012 + 0.083 * lp, 0.016 + 0.058 * lp];       // luz de ciudad desde abajo
  if (st && st.moonAlt > 0 && st.moonIllum > 0) {
    const m = st.moonIllum * Math.sqrt(Math.sin((st.moonAlt * Math.PI) / 180)) * (st.moonFade ?? 1);
    night = add3(night, [0.15, 0.16, 0.18], m);
  }
  const glow = st && st.colors ? st.colors.sunGlow : [1, 0.6, 0.35];
  const base = mix3(night, [0.95, 0.95, 0.96], day);
  const lit = add3(base, glow, 0.95 * tw);                                   // hacia el Sol
  const litAnti = add3(add3(base, glow, 0.18 * tw), [0.10, 0.11, 0.17], tw);   // del lado opuesto: luz del cielo
  const shade = add3(mix3(mix3(night, [0, 0, 0], 0.25), [0.5, 0.52, 0.57], day), glow, 0.22 * tw);
  const horizon = st && st.colors && day > 0.05 ? mix3(lit, st.colors.horizon, 0.7) : lit;
  return { lit, litAnti, shade, sunGlow: glow, horizon, rim: 0.5 * Math.max(day, tw), haze: 0.65 * day, day, night };
}

/** Desplazamiento de una capa (km, este y norte) con el viento [ve, vn] m/s durante `dt` s, y su dirección. */
export function drift(v, dt) {
  const s = Math.hypot(v[0], v[1]);
  return { off: [(v[0] * dt) / 1000, (v[1] * dt) / 1000], dir: s > 0.1 ? [v[0] / s, v[1] / s] : [1, 0] };
}
const ANCHOR_S = 6 * 3600;   // el desplazamiento se mide desde el último múltiplo de 6 h (precisión de la GPU)

/**
 * Opacidad de nube a partir de la cual algo se da por tapado (sin nombre y sin poder elegirlo). Solo la nube espesa:
 * a través de una nube fina o media el astro se sigue viendo (más débil), y lo que se ve debe poder nombrarse y
 * tocarse. (Antes era 0,45 y, de noche, con nubes oscuras casi invisibles, desaparecían los nombres de astros que
 * seguían a la vista.)
 */
export const OCC_HIDE = 0.8;

/** Parámetros de cada capa para un instante: umbral, desplazamiento y dirección del viento. */
export function layerParams(clouds, tSec) {
  const dt = tSec - Math.floor(tSec / ANCHOR_S) * ANCHOR_S;
  return LAYERS.map((l) => {
    const c = clouds ? clouds[l] || 0 : 0, dr = drift((clouds && clouds.wind && clouds.wind[l]) || [0, 0], dt);
    return { layer: l, on: c > 0.003, th: threshold(l, c), off: dr.off, dir: dr.dir };
  });
}

/**
 * Cuánto tapan las nubes una dirección del cielo local (opacidad 0–1), con la MISMA cuenta que el sombreador:
 * para decidir qué estrellas, planetas y objetos llevan nombre y entran en «se ven ahora». d = [x, y, z], Y = cenit.
 */
export function makeOccluder(clouds, tSec) {
  if (!clouds) return null;
  const P = layerParams(clouds, tSec).filter((p) => p.on);
  if (!P.length) return null;
  return (d) => {
    if (!(d[1] > 0.004)) return 0;
    const fade = Math.min(1, Math.max(0, (d[1] - 0.004) / 0.056)), hf = fade * fade * (3 - 2 * fade);
    let a = 0;
    for (const p of P) {
      const st = LAYER_STYLE[p.layer], dist = Math.min(LAYER_KM[p.layer] / d[1], 240);
      const ex = d[0] * dist - p.off[0], ny = -d[2] * dist - p.off[1], w = p.dir;
      const n = fbm((ex * w[0] + ny * w[1]) / (st.scaleKm * st.stretch), (-ex * w[1] + ny * w[0]) / st.scaleKm, st.octaves);
      let t = Math.min(1, Math.max(0, (n - (p.th - st.edge / 2)) / (st.edge * 2)));
      t = t * t * (3 - 2 * t);
      const al = t * st.maxAlpha * hf;
      a += (1 - a) * al;
    }
    return a;
  };
}

export function createCloudsLayer({ radius = 3800, segments = 40 } = {}) {
  const uniforms = {
    uOn: { value: [0, 0, 0] }, uTh: { value: [9, 9, 9] },
    uOff: { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] },
    uDir: { value: [new THREE.Vector2(1, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 0)] },
    uLit: { value: new THREE.Color(1, 1, 1) }, uLitAnti: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.5, 0.5, 0.5) },
    uSunGlow: { value: new THREE.Color(1, 0.6, 0.3) }, uHorizon: { value: new THREE.Color(1, 1, 1) },
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uRim: { value: 0 }, uHaze: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.round(segments / 2)), material);
  mesh.name = "clouds";
  mesh.renderOrder = 2.5;          // después de estrellas, planetas y lunas; antes de la línea del horizonte
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  let enabled = false, any = false, last = null;
  const setC = (u, c) => u.value.setRGB(Math.min(1, c[0]), Math.min(1, c[1]), Math.min(1, c[2]));

  return {
    mesh, uniforms,
    /** clouds: cloudsAt(...) o null; st: skyState(...); tSec: instante del cielo (s Unix). */
    update(clouds, st, tSec) {
      last = clouds || null;
      any = false;
      if (clouds && st) {
        layerParams(clouds, tSec).forEach((p, k) => {
          uniforms.uOn.value[k] = p.on ? 1 : 0;
          uniforms.uTh.value[k] = p.th;
          uniforms.uOff.value[k].set(p.off[0], p.off[1]);
          uniforms.uDir.value[k].set(p.dir[0], p.dir[1]);
          if (p.on) any = true;
        });
        const L = cloudLight(st);
        setC(uniforms.uLit, L.lit); setC(uniforms.uLitAnti, L.litAnti); setC(uniforms.uShade, L.shade); setC(uniforms.uSunGlow, L.sunGlow); setC(uniforms.uHorizon, L.horizon);
        uniforms.uSun.value.set(st.sunDir[0], st.sunDir[1], st.sunDir[2]);
        uniforms.uRim.value = L.rim; uniforms.uHaze.value = L.haze;
      }
      mesh.visible = enabled && any;
    },
    follow(camera) {
      if (!mesh.visible) return;
      mesh.position.copy(camera.position);
      mesh.updateMatrix(); mesh.updateMatrixWorld(true);
    },
    setEnabled(b) { enabled = !!b; mesh.visible = enabled && any; },
    get visible() { return mesh.visible; },
    get clouds() { return last; },
    dispose() { mesh.geometry.dispose(); material.dispose(); if (mesh.parent) mesh.parent.remove(mesh); },
  };
}
