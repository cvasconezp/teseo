// cloudNoise.js — ruido de nubes, el mismo en JavaScript (para calibrar y probar) y en GLSL (para dibujar).
//
// Cada capa de nubes es un ruido fractal (fBm de ruido de valor) sobre el plano de la capa, en km. Para que
// el cielo muestre la NUBOSIDAD del pronóstico, el umbral del ruido se calibra con su distribución real:
// se toman muestras del mismo ruido y el umbral es el cuantil (1 − nubosidad). Así, con 40 % de nubes,
// ~40 % del plano queda cubierto (scripts/test_weather.mjs lo comprueba).

/** Estilo de cada capa: tamaño de los rasgos (km), octavas, estiramiento con el viento, borde y opacidad. */
export const LAYER_STYLE = {
  low:  { scaleKm: 7, octaves: 5, stretch: 1.0, edge: 0.07, maxAlpha: 0.97 },   // cúmulos y estratos
  mid:  { scaleKm: 3.2, octaves: 4, stretch: 1.6, edge: 0.06, maxAlpha: 0.88 }, // altocúmulos
  high: { scaleKm: 14, octaves: 3, stretch: 7.0, edge: 0.16, maxAlpha: 0.55 },  // cirros, en hebras
};

const fract = (x) => x - Math.floor(x);
/** Hash 2D → [0, 1) («hash12» de Dave Hoskins, sin senos: estable en GPU). */
export function hash12(x, y) {
  let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d; b += d; c += d;
  return fract((a + b) * c);
}
const quint = (t) => t * t * t * (t * (t * 6 - 15) + 10);
/** Ruido de valor 2D, suave (interpolación quíntica), en [0, 1]. */
export function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = quint(fx), uy = quint(fy);
  const a = hash12(ix, iy), b = hash12(ix + 1, iy), c = hash12(ix, iy + 1), d = hash12(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
// rotación entre octavas (≈ 37°) para que no se alineen las mallas
const RC = 0.8, RS = 0.6;
/** fBm normalizado a [0, 1]. */
export function fbm(x, y, octaves) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(x, y); norm += amp;
    const nx = (RC * x - RS * y) * 2.03 + 17.1, ny = (RS * x + RC * y) * 2.03 + 9.7;
    x = nx; y = ny; amp *= 0.5;
  }
  return sum / norm;
}

/** Coordenadas de ruido de un punto del plano (km) con la capa estirada a lo largo de `dir` (unitario). */
export function layerCoord(px, py, style, dir = [1, 0]) {
  const al = px * dir[0] + py * dir[1], ac = -px * dir[1] + py * dir[0];
  return [al / (style.scaleKm * style.stretch), ac / style.scaleKm];
}

const SAMPLES = 6000;
const quantiles = {};
/** Valores del ruido de la capa, ordenados (muestreo fijo, una vez por capa). */
function sorted(layer) {
  if (!quantiles[layer]) {
    const st = LAYER_STYLE[layer], v = new Float64Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) v[i] = fbm(hash12(i, 3.7) * 9000 + 0.5, hash12(i, 11.3) * 9000 + 0.5, st.octaves);
    v.sort();
    quantiles[layer] = v;
  }
  return quantiles[layer];
}
/**
 * Umbral del ruido para que la capa cubra `cover` (0–1) del cielo: la densidad es ½ justo en el umbral.
 * Con 0 queda por encima del máximo (sin nubes); con 1, por debajo del mínimo (cubierto).
 */
export function threshold(layer, cover) {
  const st = LAYER_STYLE[layer], v = sorted(layer);
  if (!(cover > 0.003)) return v[v.length - 1] + st.edge * 2;
  if (cover >= 0.997) return v[0] - st.edge * 2;
  const q = (1 - cover) * (v.length - 1), i = Math.floor(q), f = q - i;
  return v[i] + (v[Math.min(v.length - 1, i + 1)] - v[i]) * f;
}
/** Densidad (0–1) de la capa para un valor de ruido `n` con umbral `th`: ½ en el umbral, 1 en el interior. */
export function density(n, th, style) {
  const t = Math.min(1, Math.max(0, (n - (th - style.edge / 2)) / (style.edge * 2)));
  return t * t * (3 - 2 * t);
}

/** El mismo ruido, en GLSL. */
export const GLSL_NOISE = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}
float fbm(vec2 p, int octaves) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int o = 0; o < 6; o++) {
    if (o >= octaves) break;
    sum += amp * vnoise(p); norm += amp;
    p = vec2(0.8 * p.x - 0.6 * p.y, 0.6 * p.x + 0.8 * p.y) * 2.03 + vec2(17.1, 9.7);
    amp *= 0.5;
  }
  return sum / norm;
}`;
