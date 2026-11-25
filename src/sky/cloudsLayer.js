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
import { LAYERS, LAYER_KM, BASE_KM_DEFAULT } from "./weather.js";
import { TH_LO, TH_HI, thresholdTexture, sampleThreshold } from "./satClouds.js";

const f1 = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
const NB = 6;                 // bandas del horizonte (backend/app/horizon.py, BANDS_KM)
const THICK = { low: 0.85, mid: 0.55, high: 0.1 };   // cuánto se oscurece la base de una nube gruesa
// las nubes lejanas, de canto: el borde se ensancha (×2 a 25 km), los huecos de un manto denso (más de ~55 %) se
// cierran desde 10 km hasta 50 km, y todas se desvanecen solo en los últimos ~1,7° sobre el horizonte
export const FAR = { edgeKm: 25, fill0: 10, fill1: 50, cov0: 0.55, cov1: 0.9, fillMax: 0.9, fadeY: 0.03 };
const sstepJs = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
// celdas del estratocúmulo y del altocúmulo (km: a lo ancho y a lo largo del viento, donde se alinean en rodillos) y
// cuánto marcan: el centro de cada celda, más grueso, se ve más oscuro desde abajo; los bordes, más finos, más claros.
// Solo cambian el color (y adelgazan algo el borde de una nube suelta), no cuánto cielo tapa la capa
const CELLS = { low: { across: 1.6, along: 2.6, dark: 0.3, light: 0.3 }, mid: { across: 0.7, along: 1.0, dark: 0.18, light: 0.22 } };

const VERT = `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// celdas (ver CELLS): Worley con los bordes deformados por ruido; se apagan a lo lejos (más allá de ~40 km serían
// más finas que un píxel) y vistas desde arriba (desde una cumbre se ve la cima, lisa y al sol)
function cellGlsl(c, k) {
  return `
    {
      vec2 qc = vec2(dot(pe, w) / ${f1(c.along)}, (-pe.x * w.y + pe.y * w.x) / ${f1(c.across)});
      // bordes deformados con dos escalas de ruido: celdas irregulares, no un panal
      qc += 0.9 * vec2(vnoise(qc * 0.45 + 3.1), vnoise(qc * 0.45 + 11.7)) + 0.35 * vec2(vnoise(qc * 1.7 + 5.3), vnoise(qc * 1.7 + 8.9)) - 0.625;
      vec2 wc = worley(qc);
      // el grosor: centro de la celda y grumos más pequeños (lo que se ve desde abajo como manchas oscuras)
      float thick = mix(1.0 - smoothstep(0.0, 1.05, wc.x), vnoise(qc * 3.1 + 2.7), 0.35);
      // vetas claras entre celdas: anchas, difusas y cortadas (no una red de líneas)
      float seam = (1.0 - smoothstep(0.0, 0.5, wc.y - wc.x)) * smoothstep(0.35, 0.8, vnoise(qc * 0.9 + 21.3));
      float cf = (1.0 - smoothstep(18.0, 45.0, dist)) * (uH[${k}] > 0.0 ? 1.0 : 0.0);
      col *= 1.0 - ${f1(c.dark)} * cf * thick * t;
      // las vetas, solo cerca (a lo lejos, comprimidas por la perspectiva, dibujarían arcos)
      float cs = cf * (1.0 - smoothstep(5.0, 16.0, dist));
      col = mix(col, lit, ${f1(c.light)} * cs * seam * t);
      a *= 1.0 - 0.4 * cs * seam * (1.0 - t * t);
    }`;
}

function layerGlsl(l, k) {
  const s = LAYER_STYLE[l], ch = "rgb"[k];
  // uH: altura de la capa respecto a ti (km): por encima, se ve mirando arriba; por debajo (desde una cumbre),
  // mirando abajo, y ahí la tapan las montañas que asoman sobre ella (terrainFront)
  return `
  if (uOn[${k}] > 0.5 && uH[${k}] * uSide > 0.0 && uH[${k}] * d.y > 0.0 && abs(d.y) > 0.004
      && (uH[${k}] > 0.0 || terrainFront(d, uH[${k}] / d.y, uObs + uH[${k}] * 1000.0) < 0.5)
      && (uSide < 1.5 || terrainBehind(d, uH[${k}] / d.y) > 0.5)) {
    float dist = min(uH[${k}] / d.y, 240.0);
    float horizonFade = smoothstep(0.004, ${f1(FAR.fadeY)}, abs(d.y));
    vec2 pe = vec2(d.x, -d.z) * dist - uOff[${k}];
    vec2 w = uDir[${k}];
    vec2 q = vec2(dot(pe, w) / ${f1(s.scaleKm * s.stretch)}, (-pe.x * w.y + pe.y * w.x) / ${f1(s.scaleKm)});
    float n = fbm(q, ${s.octaves});
    // nubes del satélite: el umbral de la celda donde cae este punto (la malla viaja con el viento de la capa)
    float th = uTh[${k}];
    // si llueve donde estás, la nube se cierra sobre ti (rainLook.js: thickenForRain)
    vec2 pw = vec2(d.x, -d.z) * dist;
    th -= uOver[${k}] * exp(-dot(pw, pw) / (uOverR * uOverR));
    if (uMapOn > 0.5) {
      vec2 uv = (vec2(d.x, -d.z) * dist - uMapOff[${k}] + uMapHalf) / (2.0 * uMapHalf);
      float e = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
      if (e > 0.0) {
        vec4 m = texture2D(uMap, uv);
        float f = clamp(e / 0.08, 0.0, 1.0); f = f * f * (3.0 - 2.0 * f);
        th = mix(th, ${f1(TH_LO)} + m.${ch} * ${f1(TH_HI - TH_LO)}, m.a * f * uMapW);
      }
    }
    // a lo lejos la capa se ve de canto: los bordes se suavizan y, en un manto denso, los huecos se cierran (se ven
    // los costados de las celdas). Lo mismo en makeOccluder (farEdge, farFill)
    float eW = ${f1(s.edge)} * (1.0 + dist / ${f1(FAR.edgeKm)});
    float t = clamp((n - (th - eW * 0.5)) / (eW * 2.0), 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    ${l === "high" ? "" : `t = max(t, smoothstep(${f1(FAR.fill0)}, ${f1(FAR.fill1)}, dist) * smoothstep(${f1(FAR.cov0)}, ${f1(FAR.cov1)}, uCov[${k}]) * ${f1(FAR.fillMax)});`}
    float a = t * ${f1(s.maxAlpha)} * horizonFade;
    vec3 col = mix(lit, uShade, pow(t, 1.5) * (uH[${k}] > 0.0 ? ${f1(THICK[l])} : 0.12));   // desde arriba, la cima de la nube, al sol
${CELLS[l] ? cellGlsl(CELLS[l], k) : ""}
    col += uSunGlow * rim * (1.0 - t);
    // cielo cubierto: donde la nube es más gruesa, la base es más oscura (manchas del nimboestrato)
    col *= 1.0 - uMottle * ${l === "high" ? "0.0" : "0.34"} * t * smoothstep(0.32, 0.72, n);
    col = mix(col, uHorizon, max((1.0 - exp(-dist / 90.0)) * uHaze, min(0.7, 0.6 * (1.0 - exp(-min(dist, 1.5 / abs(d.y)) * uFogB)))));
    acc.rgb += (1.0 - acc.a) * a * col;
    acc.a += (1.0 - acc.a) * a;
  }`;
}

const FRAG = `
uniform float uOn[3];
uniform float uH[3];
uniform float uSide;
uniform float uObs;
uniform float uTerrOn;
uniform sampler2D uTerr;
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
uniform float uMapOn;
uniform float uMapW;
uniform float uMapHalf;
uniform vec2 uMapOff[3];
uniform sampler2D uMap;
uniform float uOver[3];
uniform float uCov[3];
uniform float uOverR;
uniform float uFogB;
uniform float uRain;
uniform float uMottle;
uniform vec3 uRainCol;
varying vec3 vWorld;
${GLSL_NOISE}
// celdas de Worley: distancia al punto más cercano (x) y al segundo (y) de una malla de puntos al azar
vec2 worley(vec2 p) {
  vec2 i = floor(p), f = p - i;
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + vec2(hash12(i + g), hash12(i + g + vec2(41.3, 17.9))) - f;
      float dd = dot(r, r);
      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
    }
  }
  return vec2(sqrt(d1), sqrt(d2));
}
float rhash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
// densidad (0–1) de la capa baja en un punto del plano (km respecto a ti), con el mismo umbral que su dibujo
float lowDens(vec2 pw) {
  vec2 pe = pw - uOff[0];
  vec2 w = uDir[0];
  vec2 q = vec2(dot(pe, w) / ${f1(LAYER_STYLE.low.scaleKm * LAYER_STYLE.low.stretch)}, (-pe.x * w.y + pe.y * w.x) / ${f1(LAYER_STYLE.low.scaleKm)});
  float n = fbm(q, 3);
  float th = uTh[0] - uOver[0] * exp(-dot(pw, pw) / (uOverR * uOverR));
  if (uMapOn > 0.5) {
    vec2 uv = (pw - uMapOff[0] + uMapHalf) / (2.0 * uMapHalf);
    float e = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
    if (e > 0.0) { vec4 m = texture2D(uMap, uv); th = mix(th, ${f1(TH_LO)} + m.r * ${f1(TH_HI - TH_LO)}, m.a * clamp(e / 0.08, 0.0, 1.0) * uMapW); }
  }
  return smoothstep(th - 0.05, th + 0.12, n);
}
// ¿hay montaña delante de la nube en esta dirección? La franja que se ve es la más cercana cuyo filo queda por
// encima del píxel (las bandas del horizonte, de cerca a lejos: R = ángulo del filo, G = altura m, B = distancia km)
float terrainFront(vec3 d, float distKm, float cloudM) {
  if (uTerrOn < 0.5) return 0.0;
  float alt = degrees(asin(clamp(d.y, -1.0, 1.0)));
  float az = mod(degrees(atan(d.x, -d.z)) + 360.0, 360.0);
  for (int k = 0; k < ${NB}; k++) {
    vec4 b = texture2D(uTerr, vec2(az / 360.0, (float(k) + 0.5) / ${f1(NB)}));
    // la ladera que pisas (la banda más cercana, a menos de 1,5 km, y el suelo bajo ella) va siempre delante: estás
    // por encima de la nube, y lo que tienes a tus pies también
    if (b.x >= alt) return (k == 0 || (b.y > cloudM && b.z < distKm)) ? 1.0 : 0.0;
  }
  return 0.0;
}
// ¿la montaña que se ve en esta dirección está MÁS LEJOS que el punto donde la mirada entra en la capa? Entonces la
// nube va delante: una cumbre más alta que la base de las nubes queda dentro de ellas (vista desde abajo)
float terrainBehind(vec3 d, float distKm) {
  if (uTerrOn < 0.5) return 0.0;
  float alt = degrees(asin(clamp(d.y, -1.0, 1.0)));
  float az = mod(degrees(atan(d.x, -d.z)) + 360.0, 360.0);
  for (int k = 0; k < ${NB}; k++) {
    float v = (float(k) + 0.5) / ${f1(NB)};
    vec4 b = texture2D(uTerr, vec2(az / 360.0, v));
    // el filo guardado va en pasos de 0,2° de acimut, y la montaña dibujada (las franjas y el relieve 3D cercano)
    // sigue su borde exacto, algo más alto: se toma el más alto de los pasos vecinos y 0,3° de margen, para que el
    // filo, su línea y la nieve de la cumbre también queden dentro de la nube
    float top = max(b.x, max(texture2D(uTerr, vec2((az - 0.2) / 360.0, v)).x, texture2D(uTerr, vec2((az + 0.2) / 360.0, v)).x));
    if (top + 0.3 >= alt) return b.z > distKm ? 1.0 : 0.0;
  }
  return 0.0;
}
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  // la pasada sobre las montañas solo pinta donde hay relieve en esta dirección
  if (uSide > 1.5 && (uTerrOn < 0.5 || d.y <= 0.004)) discard;
  if (abs(d.y) <= 0.004) discard;
  float rim = pow(max(dot(d, normalize(uSun)), 0.0), 10.0) * uRim;
  // lado del Sol: en el crepúsculo las nubes hacia el Sol se encienden y las del lado opuesto quedan grises
  vec2 sh = uSun.xz;
  float side = (length(d.xz) > 1e-4 && length(sh) > 1e-4) ? 0.5 + 0.5 * dot(normalize(d.xz), normalize(sh)) : 0.5;
  vec3 lit = mix(uLitAnti, uLit, side * side);
  vec4 acc = vec4(0.0);
  // lluvia: cortinas grises que bajan de las nubes bajas densas hasta el suelo (se ven de lado, hacia el horizonte)
  // y, si llueve donde estás, las gotas que caen (hilos que convergen en el cenit). Delante de las nubes
  if (uSide > 0.0 && uSide < 1.5 && uRain > 0.01 && uOn[0] > 0.5 && uH[0] > 0.0 && d.y > -0.03) {
    float e = max(d.y, 0.0), tg = e / max(sqrt(1.0 - e * e), 1e-3);
    vec2 hd = normalize(vec2(d.x, -d.z) + vec2(1e-6));
    float az = atan(hd.x, hd.y);
    float veil = 0.0;
    for (int i = 0; i < 4; i++) {
      float x = 1.2 * pow(2.3, float(i));                  // 1,2 · 2,8 · 6,3 · 14,6 km
      float z = x * tg;                                     // altura del rayo allí (km)
      float wz = 1.0 - smoothstep(0.55 * uH[0], uH[0], z);   // sin escalón donde el rayo llega a la base
      if (wz > 0.0) {
        float dn = lowDens(hd * x);
        // mantos verticales (la lluvia cae en cortinas, no en una pared lisa)
        float streak = 0.45 + 0.55 * vnoise(hd * x / 0.7 + vec2(float(i) * 7.3, z * 0.15));   // columnas de ~1 km, fijas en el sitio
        veil += (1.0 - veil) * dn * uRain * 0.34 * streak * wz;
      }
    }
    // gotas sobre ti: solo con la nube cerrada encima
    float here = uRain * lowDens(vec2(0.0));
    if (here > 0.05 && d.y > 0.0) {
      float sx = az * 286.5, id = floor(sx), fx = fract(sx);
      float line = smoothstep(0.42, 0.5, fx) * smoothstep(0.58, 0.5, fx);
      float dash = step(0.45, fract(asin(d.y) * (3.0 + 4.0 * rhash(id + 3.1)) + rhash(id)));
      veil += (1.0 - veil) * here * 0.07 * line * dash * (1.0 - smoothstep(0.75, 0.95, d.y));
    }
    acc = vec4(uRainCol * veil, veil);
  }
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
  let horizon = st && st.colors && day > 0.05 ? mix3(lit, st.colors.horizon, 0.7) : lit;
  let rim = 0.5 * Math.max(day, tw), L = { lit, litAnti, shade };
  // cielo cubierto o con lluvia (rainLook.js: st.wx): sin Sol directo, las nubes son grises y las bases oscuras
  const wx = st && st.wx, o = wx ? wx.overcast || 0 : 0, r = wx ? wx.rain || 0 : 0;
  if (o > 0) {
    const dk = 1 - 0.3 * r, gl = [0.7 * dk, 0.72 * dk, 0.76 * dk], gs = [0.3 * dk, 0.32 * dk, 0.36 * dk];
    const ko = o * day * 0.85;
    L = { lit: mix3(lit, gl, ko), litAnti: mix3(litAnti, gl, ko), shade: mix3(shade, mix3(night, gs, day), Math.max(ko * 0.7, r * day)) };
    horizon = mix3(horizon, L.lit, o * 0.5);
    rim *= 1 - o;
  }
  // las cortinas de lluvia: entre la base de la nube y el aire del horizonte
  const rain = mix3(L.shade, horizon, 0.45);
  return { lit: L.lit, litAnti: L.litAnti, shade: L.shade, sunGlow: glow, horizon, rim, haze: 0.65 * day, day, night, rain };
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

/**
 * Cuánto más alto que el suelo del pronóstico estás (km, ≥ 0): las capas de nubes se miden desde el suelo del
 * modelo (Open-Meteo da su altura en el punto pedido), así que desde una cumbre quedan más cerca o por debajo.
 * obsM: tu altura (m); refM: la del suelo del pronóstico. En una ciudad más baja que ese suelo no cambia nada.
 */
export function cloudLift(obsM, refM) {
  return Number.isFinite(obsM) && Number.isFinite(refM) ? Math.max(0, obsM - refM) / 1000 : 0;
}
/**
 * Altura de cada capa sobre el suelo del pronóstico (km). La de las bajas es su base calculada (cloudBaseKm: por la
 * temperatura y el punto de rocío); sin ella, 1,5 km. Las medias y las altas quedan siempre por encima de las bajas.
 */
export function layerKm(baseKm) {
  const low = Number.isFinite(baseKm) ? baseKm : BASE_KM_DEFAULT;
  const mid = Math.max(LAYER_KM.mid, low + 1.5);
  return { low, mid, high: Math.max(LAYER_KM.high, mid + 2) };
}
/** Altura de una capa respecto a ti (km): positiva encima, negativa debajo (nunca a menos de 120 m: no se entra en ella). */
export function layerHeight(l, lift = 0, baseKm = null) {
  const h = layerKm(baseKm)[l] - lift;
  return Math.abs(h) < 0.12 ? (h < 0 ? -0.12 : 0.12) : h;
}

/**
 * Parámetros de cada capa para un instante: umbral, desplazamiento, dirección del viento, altura (km) y cuánto se
 * cierra sobre ti con lluvia (over; clouds.overR, el radio en km).
 */
export function layerParams(clouds, tSec, lift = 0) {
  const dt = tSec - Math.floor(tSec / ANCHOR_S) * ANCHOR_S;
  return LAYERS.map((l) => {
    const c = clouds ? clouds[l] || 0 : 0, dr = drift((clouds && clouds.wind && clouds.wind[l]) || [0, 0], dt);
    const over = clouds && clouds.over ? clouds.over[l] || 0 : 0;
    return { layer: l, on: c > 0.003, cover: c, th: threshold(l, c), off: dr.off, dir: dr.dir, h: layerHeight(l, lift, clouds ? clouds.baseKm : null), over };
  });
}

/**
 * Cuánto tapan las nubes una dirección del cielo local (opacidad 0–1), con la MISMA cuenta que el sombreador:
 * para decidir qué estrellas, planetas y objetos llevan nombre y entran en «se ven ahora». d = [x, y, z], Y = cenit.
 */
export function makeOccluder(clouds, tSec, lift = 0, map = null) {
  if (!clouds) return null;
  const P = layerParams(clouds, tSec, lift).filter((p) => p.on && p.h > 0);   // las de abajo no tapan el cielo
  if (!P.length) return null;
  const R2 = (clouds.overR || 25) ** 2;
  return (d) => {
    if (!(d[1] > 0.004)) return 0;
    const hf = sstepJs(0.004, FAR.fadeY, d[1]);
    let a = 0;
    for (const p of P) {
      const st = LAYER_STYLE[p.layer], dist = Math.min(p.h / d[1], 240);
      const ex = d[0] * dist - p.off[0], ny = -d[2] * dist - p.off[1], w = p.dir;
      const n = fbm((ex * w[0] + ny * w[1]) / (st.scaleKm * st.stretch), (-ex * w[1] + ny * w[0]) / st.scaleKm, st.octaves);
      const px = d[0] * dist, py = -d[2] * dist;
      let th = p.th - p.over * Math.exp(-(px * px + py * py) / R2);
      if (map && map.w > 0) {   // el mismo umbral local del satélite que lee el sombreador
        const k = LAYERS.indexOf(p.layer), o = map.off[k] || [0, 0];
        const m = sampleThreshold(map.tex, map.n, map.half, k, d[0] * dist - o[0], -d[2] * dist - o[1]);
        if (m) th += (m.th - th) * m.w * map.w;
      }
      const eW = st.edge * (1 + dist / FAR.edgeKm);
      let t = Math.min(1, Math.max(0, (n - (th - eW / 2)) / (eW * 2)));
      t = t * t * (3 - 2 * t);
      if (p.layer !== "high") t = Math.max(t, sstepJs(FAR.fill0, FAR.fill1, dist) * sstepJs(FAR.cov0, FAR.cov1, p.cover) * FAR.fillMax);
      const al = t * st.maxAlpha * hf;
      a += (1 - a) * al;
    }
    return a;
  };
}

export function createCloudsLayer({ radius = 3800, segments = 40 } = {}) {
  const terrData = new Float32Array(1800 * NB * 4);
  const terrTex = new THREE.DataTexture(terrData, 1800, NB, THREE.RGBAFormat, THREE.FloatType);
  terrTex.minFilter = THREE.NearestFilter; terrTex.magFilter = THREE.NearestFilter;
  terrTex.wrapS = THREE.RepeatWrapping; terrTex.needsUpdate = true;
  const uniforms = {
    uOn: { value: [0, 0, 0] }, uTh: { value: [9, 9, 9] },
    uH: { value: LAYERS.map((l) => LAYER_KM[l]) }, uObs: { value: 0 }, uTerrOn: { value: 0 }, uTerr: { value: terrTex },
    uOff: { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] },
    uDir: { value: [new THREE.Vector2(1, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 0)] },
    uLit: { value: new THREE.Color(1, 1, 1) }, uLitAnti: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.5, 0.5, 0.5) },
    uSunGlow: { value: new THREE.Color(1, 0.6, 0.3) }, uHorizon: { value: new THREE.Color(1, 1, 1) },
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uRim: { value: 0 }, uHaze: { value: 0 },
    uMapOn: { value: 0 }, uMapW: { value: 0 }, uMapHalf: { value: 151.5 }, uMap: { value: null },
    uMapOff: { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] },
    uOver: { value: [0, 0, 0] }, uCov: { value: [0, 0, 0] }, uOverR: { value: 25 }, uFogB: { value: 0 }, uRain: { value: 0 }, uMottle: { value: 0 }, uRainCol: { value: new THREE.Color(0.5, 0.52, 0.56) },
  };
  let mapTex = null, mapSat = null;
  const mat = (side) => new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uSide: { value: side } }, vertexShader: VERT, fragmentShader: FRAG,
    side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, fog: false,
  });
  const material = mat(1), matBelow = mat(-1), matOver = mat(2);
  const geo = new THREE.SphereGeometry(radius, segments, Math.round(segments / 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "clouds";
  mesh.renderOrder = 2.5;          // después de estrellas, planetas y lunas; antes de la línea del horizonte
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  // las capas que quedan por debajo (desde una cumbre): después de las montañas, que las tapan donde asoman
  const below = new THREE.Mesh(geo, matBelow);
  below.name = "clouds-below";
  below.renderOrder = 2.8;
  below.frustumCulled = false;
  below.visible = false;
  mesh.add(below);
  // las capas de encima, otra vez, sobre las montañas: donde la mirada entra en la nube antes de llegar a la ladera
  // (una cumbre más alta que la base de las nubes, vista desde abajo, queda dentro de ellas)
  const over = new THREE.Mesh(geo, matOver);
  over.name = "clouds-over-terrain";
  over.renderOrder = 2.79;          // después del relieve (2,69–2,78); antes de las capas de abajo (2,8)
  over.frustumCulled = false;
  over.visible = false;
  mesh.add(over);
  let enabled = false, any = false, last = null, lift = 0;
  const setC = (u, c) => u.value.setRGB(Math.min(1, c[0]), Math.min(1, c[1]), Math.min(1, c[2]));

  return {
    mesh, uniforms,
    /** clouds: cloudsAt(...) o null; st: skyState(...); tSec: instante del cielo (s Unix). */
    update(clouds, st, tSec) {
      last = clouds || null;
      any = false;
      let anyBelow = false, anyAbove = false;
      if (clouds && st) {
        layerParams(clouds, tSec, lift).forEach((p, k) => {
          uniforms.uOn.value[k] = p.on ? 1 : 0;
          uniforms.uH.value[k] = p.h;
          if (p.on && p.h < 0) anyBelow = true;
          if (p.on && p.h > 0) anyAbove = true;
          uniforms.uTh.value[k] = p.th;
          uniforms.uOff.value[k].set(p.off[0], p.off[1]);
          uniforms.uDir.value[k].set(p.dir[0], p.dir[1]);
          uniforms.uOver.value[k] = p.over;
          uniforms.uCov.value[k] = p.cover;
          if (p.on) any = true;
        });
        uniforms.uOverR.value = clouds.overR || 25;
        const L = cloudLight(st);
        setC(uniforms.uLit, L.lit); setC(uniforms.uLitAnti, L.litAnti); setC(uniforms.uShade, L.shade); setC(uniforms.uSunGlow, L.sunGlow); setC(uniforms.uHorizon, L.horizon);
        uniforms.uSun.value.set(st.sunDir[0], st.sunDir[1], st.sunDir[2]);
        uniforms.uRim.value = L.rim; uniforms.uHaze.value = L.haze;
        const wx = st.wx;
        uniforms.uFogB.value = wx && wx.beta > 0 ? wx.beta : 0;
        uniforms.uRain.value = wx && wx.rain > 0 ? wx.rain : 0;
        uniforms.uMottle.value = wx ? (wx.overcast || 0) * L.day : 0;
        setC(uniforms.uRainCol, L.rain);
      }
      below.visible = anyBelow;
      over.visible = anyAbove && uniforms.uTerrOn.value > 0.5;
      mesh.visible = enabled && any;
    },
    /**
     * Desde dónde se miran: tu altura sobre el suelo del pronóstico (cloudLift) y las bandas del horizonte real
     * (hz de /api/horizon, o null) para que las montañas que asoman tapen las nubes de abajo. Llamar antes de update.
     */
    setView(liftKm, hz) {
      lift = Number.isFinite(liftKm) ? liftKm : 0;
      const ok = !!(hz && hz.bands && hz.bands.length && hz.alt && hz.alt.length);
      uniforms.uTerrOn.value = ok ? 1 : 0;
      uniforms.uObs.value = ok ? (hz.ground_m || 0) + (hz.eye_m || 1.7) : 0;
      if (ok) {
        const n = hz.alt.length;
        for (let k = 0; k < NB; k++) {
          const b = hz.bands[Math.min(k, hz.bands.length - 1)];
          for (let i = 0; i < 1800; i++) {
            const j = Math.floor((i / 1800) * n) % n, o = (k * 1800 + i) * 4;
            terrData[o] = k < hz.bands.length ? b.alt[j] : -90;
            terrData[o + 1] = b.top_m ? b.top_m[j] : 0;
            terrData[o + 2] = b.dist_km ? b.dist_km[j] : 0;
            terrData[o + 3] = 1;
          }
        }
        terrTex.needsUpdate = true;
      }
    },
    /**
     * Nubes del satélite (satClouds.js): sat = parseSatClouds(...) o null, w = peso (satWeight), off = mapOffsets(...).
     * Devuelve el mapa para makeOccluder ({ tex, n, half, w, off }) o null.
     */
    setMap(sat, w = 0, off = null) {
      if (!sat || !(w > 0)) { uniforms.uMapOn.value = 0; return null; }
      if (!mapSat || sat.key !== mapSat.key || sat.t !== mapSat.t) {
        const data = thresholdTexture(sat);
        if (mapTex) mapTex.dispose();
        mapTex = new THREE.DataTexture(data, sat.n, sat.n, THREE.RGBAFormat, THREE.UnsignedByteType);
        mapTex.minFilter = THREE.LinearFilter; mapTex.magFilter = THREE.LinearFilter;
        mapTex.wrapS = mapTex.wrapT = THREE.ClampToEdgeWrapping; mapTex.generateMipmaps = false; mapTex.needsUpdate = true;
        mapSat = sat; mapSat._tex = data;
        uniforms.uMap.value = mapTex;
      }
      uniforms.uMapOn.value = 1; uniforms.uMapW.value = w; uniforms.uMapHalf.value = sat.half;
      const o = off || [[0, 0], [0, 0], [0, 0]];
      for (let k = 0; k < 3; k++) uniforms.uMapOff.value[k].set(o[k][0], o[k][1]);
      return { tex: mapSat._tex, n: sat.n, half: sat.half, w, off: o };
    },
    follow(camera) {
      if (!mesh.visible) return;
      mesh.position.copy(camera.position);
      mesh.updateMatrix(); mesh.updateMatrixWorld(true);
    },
    setEnabled(b) { enabled = !!b; mesh.visible = enabled && any; },
    get visible() { return mesh.visible; },
    get clouds() { return last; },
    dispose() { geo.dispose(); material.dispose(); matBelow.dispose(); terrTex.dispose(); if (mapTex) mapTex.dispose(); if (mesh.parent) mesh.parent.remove(mesh); },
  };
}
