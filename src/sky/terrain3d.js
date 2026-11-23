// terrain3d.js — el relieve en 3D (hasta 300 km) con la imagen de satélite encima, en la vista Cielo.
//
// El servidor (backend/app/terrain3d.py) da las alturas en una rejilla polar (acimut × distancia geométrica) y
// una imagen de Sentinel-2 cloudless 2016 (EOX, CC BY 4.0) en esa misma rejilla. Aquí se levanta la malla en el
// marco local del horizonte (x = este, y = cenit, z = −norte; el observador en el origen), con la misma caída
// por curvatura y refracción que el horizonte (horizon.py), de modo que su silueta coincide con la de las franjas
// de terrainLayer.js, que siguen detrás (y más allá de 25 km son lo único que hay).
//
// La luz: la del cielo de cada momento (día, crepúsculo, noche con o sin Luna), el Sol sobre cada ladera según
// su pendiente real, la sombra del valle, el arrebol, la nieve sobre la línea de nieves y la bruma con la
// distancia. Lo de geometría (decodeNear, nearGeometry) no depende de three.js: se prueba en node.
import * as THREE from "three";
import { cellKey, snowLine } from "./horizon.js";

const RAD = Math.PI / 180;
const R_E = 6371008.8, K_REFR = 0.13;
export const UNITS_PER_M = 0.0024;        // 300 km → 720 unidades (dentro de la esfera del cielo, radio ≈ 900)
// Lo muy cercano quedaría por delante del plano cercano de la cámara (0,1 unidades = 8 m) y se recortaría: cada
// vértice se aleja OFFSET unidades a lo largo de su propia dirección. Visto desde el origen nada cambia (misma
// dirección, mismo orden de cerca a lejos).
export const NEAR_OFFSET = 1.5;
// filtrado anisótropo de la imagen polar: alto, afila lo lejano rasante pero, mirando ladera abajo, deja nítida cada
// columna y emborrona el radio (rayas verticales). Con 1, igual de nítido lo lejano y sin rayas
const ANISO = 1;
// cerca, las columnas de la malla (cada 0,5°) quedan a pocos metros unas de otras, mucho menos que el dato del
// relieve (10–30 m): cada una con su propia altura, el perfil sale en escalones. Se promedian a lo ancho ±15 m
const SMOOTH_ARC_M = 15;
const FLAT_IN = 150, FLAT_OUT = 450;      // m: más cerca, el modelo mezcla casas y árboles con el suelo → llano

/** Respuesta de /api/terrain/near → { nAz, nR, dMin, dMax, ground, eye, heights: Float32Array(nAz·nR) } o null. */
export function decodeNear(body) {
  if (!body || !body.heights || !(body.n_az > 2) || !(body.n_r > 2)) return null;
  const bin = typeof atob === "function" ? atob(body.heights) : Buffer.from(body.heights, "base64").toString("binary");
  const n = body.n_az * body.n_r;
  if (bin.length < n * 2) return null;
  const h = new Float32Array(n), sc = body.h_scale || 4, off = body.h_off || 500;
  for (let i = 0; i < n; i++) h[i] = (bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) / sc - off;
  return { nAz: body.n_az, nR: body.n_r, dMin: body.d_min_m, dMax: body.d_max_m, ground: body.ground_m || 0, eye: body.eye_m || 1.7, heights: h, credit: body.credit || null };
}

/** Distancia (m) del anillo j. */
/**
 * La rejilla de relieve de los monumentos (monumentLayer.js: RELIEF_R × RELIEF_NA, alturas respecto a los ojos) sacada
 * de las alturas del relieve 3D: así el piso de un sitio sigue la loma (Catequilla) en vez de ser un llano a la
 * altura de los pies que tapa el valle.
 */
export function reliefFromNear(nr, reach, ground, radii, na, eye = 1.7) {
  if (!nr || !nr.heights) return null;
  const L = Math.log(nr.dMax / nr.dMin), h = new Array(radii.length * na);
  radii.forEach((f, j) => {
    const r = f * reach, x = Math.min(nr.nR - 1, Math.max(0, ((nr.nR - 1) * Math.log(Math.max(r, nr.dMin) / nr.dMin)) / L));
    const j0 = Math.floor(x), j1 = Math.min(nr.nR - 1, j0 + 1), t = x - j0;
    for (let i = 0; i < na; i++) {
      const ai = Math.round((i / na) * nr.nAz) % nr.nAz;
      let v = nr.heights[ai * nr.nR + j0] * (1 - t) + nr.heights[ai * nr.nR + j1] * t;
      // más cerca que el primer anillo (60 m) no hay medida: rampa suave desde el suelo bajo los pies
      if (r < nr.dMin) v = ground + (v - ground) * (r / nr.dMin);
      h[j * na + i] = v - ground - eye;
    }
  });
  return { reach, h, radii, na };
}

export function ringDist(nr, j) { return nr.dMin * Math.pow(nr.dMax / nr.dMin, j / (nr.nR - 1)); }

/**
 * La malla: posiciones (unidades de escena), uv de la imagen, normales (marco local), altura (m) y distancia (m)
 * de cada vértice, e índices (de cerca a lejos: lo cercano se dibuja primero y tapa lo de atrás).
 * Cerca del observador (< 150 m) lo que sobresale de la altura de sus pies se allana, y empalma con el relieve hasta 450 m.
 */
/** Metros que se sube al observador al situarlo en una cumbre o un mirador (como en una torre baja): con los ojos a
 * 1,7 m, una cima ancha tapa casi todo el paisaje de abajo. */
export const SUMMIT_LIFT_M = 5;
/** Copia de las alturas con cada anillo cercano promediado a lo ancho (±SMOOTH_ARC_M de arco), media circular. */
export function smoothNear(heights, nAz, nR, d, dAz) {
  const out = Float32Array.from(heights), col = new Float64Array(nAz + 1);
  for (let j = 0; j < nR; j++) {
    const half = Math.min(Math.floor(nAz / 4), Math.round(SMOOTH_ARC_M / (dAz * d[j])));
    if (half < 1) break;                                         // (más lejos, las columnas ya miden más que el dato)
    col[0] = 0;
    for (let i = 0; i < nAz; i++) col[i + 1] = col[i] + heights[i * nR + j];
    const tot = col[nAz], n = 2 * half + 1;
    for (let i = 0; i < nAz; i++) {
      const a = i - half, b = i + half + 1;
      let sum;
      if (a >= 0 && b <= nAz) sum = col[b] - col[a];
      else if (a < 0) sum = col[b] + (tot - col[nAz + a]);
      else sum = (tot - col[a]) + col[b - nAz];
      out[i * nR + j] = sum / n;
    }
  }
  return out;
}
export function nearGeometry(nr, scale = UNITS_PER_M, lift = 0, groundAt = null) {
  // (`groundAt`: el suelo bajo los pies con que se colocan los monumentos, si lo hay: malla y monumentos a la misma altura)
  const { nAz, nR, heights } = nr, ground = Number.isFinite(groundAt) ? groundAt : nr.ground, eye = nr.eye + (lift > 0 ? lift : 0);
  // un anillo más, en el centro (todos sus vértices bajo los pies): cierra el hueco de los primeros 60 m
  const cols = nAz + 1, R = nR + 1, nv = cols * R, h0 = ground + eye;
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), nor = new Float32Array(nv * 3), hd = new Float32Array(nv * 2);
  const d = new Float64Array(nR), w = new Float64Array(nR);
  for (let j = 0; j < nR; j++) {
    d[j] = ringDist(nr, j);
    const x = Math.min(1, Math.max(0, (d[j] - FLAT_IN) / (FLAT_OUT - FLAT_IN)));
    w[j] = x * x * (3 - 2 * x);
  }
  // solo se allana lo que sube (un bulto del modelo delante de los ojos); lo que baja se deja como es: desde una
  // cumbre, una plataforma a la altura de los pies taparía todo el paisaje de abajo
  const dAz = (2 * Math.PI) / nAz;
  const hs = smoothNear(heights, nAz, nR, d, dAz);
  // (en una cumbre —lift— solo se allanan los bultos bajos: una subida de verdad, como la otra cima del Chimborazo a
  // 200 m, se deja; allanada, quedaba una plataforma con un corte recto y la cumbre detrás)
  const H = (i, j) => { const h = hs[(((i % nAz) + nAz) % nAz) * nR + j]; if (h <= ground) return h; const k = lift > 0 ? w[j] + (1 - w[j]) * sstep(12, 35, h - ground) : w[j]; return ground + (h - ground) * k; };
  const BASE_M = 60, jLo = new Int32Array(nR), jHi = new Int32Array(nR), mAz = new Int32Array(nR);
  for (let j = 0; j < nR; j++) {
    let a = Math.max(0, j - 1), b = Math.min(nR - 1, j + 1);
    while (d[b] - d[a] < BASE_M && (a > 0 || b < nR - 1)) { if (a > 0) a--; if (d[b] - d[a] < BASE_M && b < nR - 1) b++; }
    jLo[j] = a; jHi[j] = b;
    mAz[j] = Math.max(1, Math.min(Math.floor(nAz / 8), Math.round(BASE_M / 2 / (dAz * d[j]))));
  }
  for (let i = 0; i < cols; i++) {
    const az = i * dAz, s = Math.sin(az), c = Math.cos(az);
    { const k = i * R; pos[k * 3] = 0; pos[k * 3 + 1] = -(eye * scale + NEAR_OFFSET); pos[k * 3 + 2] = 0; uv[k * 2] = i / nAz; uv[k * 2 + 1] = 0; nor[k * 3 + 1] = 1; hd[k * 2] = ground; hd[k * 2 + 1] = 0; }
    for (let j = 0; j < nR; j++) {
      const k = i * R + j + 1, h = H(i, j), dj = d[j];
      const y = h - h0 - (dj * dj * (1 - K_REFR)) / (2 * R_E);
      const rr = Math.hypot(dj, y), f = (rr * scale + NEAR_OFFSET) / rr;
      pos[k * 3] = dj * s * f; pos[k * 3 + 1] = y * f; pos[k * 3 + 2] = -dj * c * f;
      uv[k * 2] = i / nAz; uv[k * 2 + 1] = j / (nR - 1);
      // pendiente: a lo largo del radio y a lo largo del acimut
      // pendiente medida sobre al menos ~60 m (cerca, los vértices están a centímetros unos de otros y la pendiente
      // de vértice a vértice es ruido: saldrían rayas de luz y sombra)
      const j0 = jLo[j], j1 = jHi[j], m = mAz[j];
      const hr = (H(i, j1) - H(i, j0)) / (d[j1] - d[j0]);
      const ht = (H(i + m, j) - H(i - m, j)) / (2 * m * dAz * dj);
      const gE = hr * s + ht * c, gN = hr * c - ht * s;
      const il = 1 / Math.hypot(gE, gN, 1);
      nor[k * 3] = -gE * il; nor[k * 3 + 1] = il; nor[k * 3 + 2] = gN * il;
      hd[k * 2] = h; hd[k * 2 + 1] = dj;
    }
  }
  const idx = new Uint32Array(nAz * (R - 1) * 6);
  let q = 0;
  for (let j = 0; j < R - 1; j++) for (let i = 0; i < nAz; i++) {
    const a = i * R + j, b = (i + 1) * R + j;
    idx[q++] = a; idx[q++] = a + 1; idx[q++] = b; idx[q++] = b; idx[q++] = a + 1; idx[q++] = b + 1;
  }
  return { pos, uv, nor, hd, idx, h0 };
}

const nearMem = new Map();
/** Relieve cercano del lugar: { data (decodeNear), texUrl }. Una vez por celda. */
export function fetchNearTerrain(lat, lon, { api = "", fine = false, fetchImpl = (typeof fetch !== "undefined" ? fetch : null) } = {}) {
  const key = cellKey(lat, lon, fine);
  if (nearMem.has(key)) return nearMem.get(key);
  if (!fetchImpl) return Promise.reject(new Error("sin red"));
  const [la, lo] = key.replace(/^f:/, "").split(",");
  const qs = `lat=${la}&lon=${lo}${fine ? "&fine=1" : ""}`;
  const p = fetchImpl(`${api}/api/terrain/near?${qs}`).then(async (r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = decodeNear(await r.json());
    if (!data) throw new Error("respuesta sin relieve");
    return { data, texUrl: `${api}/api/terrain/near.jpg?${qs}` };
  });
  nearMem.set(key, p);
  p.catch(() => nearMem.delete(key));
  if (nearMem.size > 6) nearMem.delete(nearMem.keys().next().value);
  return p;
}

const VERT = `
attribute vec2 aHD;
varying vec2 vUv; varying vec3 vN; varying vec3 vDir; varying float vH; varying float vD; varying vec3 vP;
void main() {
  vUv = uv; vN = normal; vH = aHD.x; vD = aHD.y; vDir = position; vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = `
precision highp float;
uniform sampler2D map;
uniform vec3 uSun, uHorizon, uNightNear, uNightFar, uSnow;
uniform float uDay, uSunAlt, uHzSun, uH0, uSnowH, uOpaque, uGlow, uFadeLo, uFadeHi, uUnits, uOvc, uFogB;
varying vec2 vUv; varying vec3 vN; varying vec3 vDir; varying float vH; varying float vD; varying vec3 vP;
float th(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tn(vec2 x) { vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(th(i), th(i + vec2(1, 0)), f.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float alt = degrees(asin(clamp(normalize(vDir).y, -1.0, 1.0)));
  float a = mix(smoothstep(uFadeLo, uFadeHi, alt), 1.0, uOpaque);
  if (a < 0.004) discard;
  // bajo los pies (más cerca que el primer anillo de la imagen) el color se toma muy desenfocado: sin rayas
  // cerca, cada píxel del satélite (10 m) ocupa decenas de columnas de la imagen polar y casi nada a lo largo del
  // radio: sin desenfocar, cada columna sería una raya. Se lee un nivel más borroso cuanto más cerca
  // (cada fila de la imagen polar mide ~2,7 veces lo que una columna: el desenfoque del mipmap alarga cada píxel
  // a lo largo del radio y salen rayas verticales; se compensa promediando también a lo ancho)
  float lod = clamp(log2(2600.0 / max(vD, 30.0)), 0.0, 6.5);
  float du = exp2(lod) * 0.9 / 2048.0;
  vec3 c = (texture2D(map, vUv + vec2(-1.5 * du, 0.0), lod).rgb + texture2D(map, vUv + vec2(-0.5 * du, 0.0), lod).rgb
          + texture2D(map, vUv + vec2(0.5 * du, 0.0), lod).rgb + texture2D(map, vUv + vec2(1.5 * du, 0.0), lod).rgb) * 0.25;
  if (vD < 400.0) {
    // (a menos de ~100 m la imagen polar no tiene nada que decir a lo largo del radio: el color es el del terreno
    // de alrededor —a unos 300 m—, mitad el promedio de todo el contorno y mitad el de esa dirección, muy borroso;
    // el detalle lo pone el grano de más abajo)
    const float V300 = 0.206;
    vec3 avg = vec3(0.0);
    for (int q = 0; q < 8; q++) avg += texture2D(map, vec2((float(q) + 0.5) / 8.0, V300), 5.0).rgb;
    vec3 sector = texture2D(map, vec2(vUv.x, V300), 5.5).rgb;
    c = mix(mix(avg / 8.0, sector, 0.15), c, smoothstep(90.0, 400.0, vD));
  }
  // el mosaico es más claro y menos saturado que el suelo visto de lado: a albedo
  float g = (c.r + c.g + c.b) / 3.0;
  vec3 alb = (vec3(g) + (c - g) * 1.3) * 0.6 * min(1.0, 0.62 / max(0.05, g));
  // restos de nubes del mosaico (claros y sin color; también los invernaderos): ahí, el color medio del monte
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float cloudy = smoothstep(0.4, 0.6, g) * (1.0 - smoothstep(0.1, 0.26, sat));
  alb = mix(alb, vec3(0.19, 0.21, 0.15), cloudy);
  // grano fino (el píxel del satélite mide 10 m: de cerca hace falta algo más menudo)
  // metros: la posición horizontal más la altura (en una ladera empinada la posición horizontal casi no cambia de
  // arriba abajo y el grano saldría en rayas verticales)
  vec2 wm = normalize(vP.xz + vec2(1e-6)) * vD + vec2(vH, vH * 0.73);
  float grain = tn(wm / 9.0) * 0.6 + tn(wm / 31.0) * 0.4;
  alb *= 1.0 + 0.16 * (grain - 0.5) * (1.0 - smoothstep(1500.0, 6000.0, vD));
  // bajo los pies y alrededor: matas, piedras y manchas a varias escalas (0,6 m … 30 m), para que el suelo
  // cercano tenga la misma textura que el paisaje y no sea un color liso
  float nearK = 1.0 - smoothstep(120.0, 900.0, vD), nearDet = 0.0;
  if (nearK > 0.0) {
    float fine = tn(wm / 0.6) * (1.0 - smoothstep(12.0, 45.0, vD));   // (más lejos haría un cuadriculado)
    float tuft = tn(wm / 2.3) * 0.55 + tn(wm / 6.5 + 17.0) * 0.45;
    float blot = tn(wm / 21.0 + 5.0);
    nearDet = nearK * (0.34 * (tuft - 0.5) + 0.22 * (fine - 0.5) + 0.26 * (blot - 0.5));
    alb *= 1.0 + nearDet;
    alb *= mix(vec3(1.0), mix(vec3(1.10, 1.04, 0.84), vec3(0.90, 1.02, 0.96), tn(wm / 4.1 + 31.0)), 0.7 * nearK);
  }
  // nieve sobre la línea de nieves (con el borde roto)
  // (más nieve en lo llano y menos en lo empinado: las paredes de roca asoman)
  float sj = (tn(wm / 260.0) - 0.5) * 110.0 + (tn(wm / 70.0) - 0.5) * 50.0 + (normalize(vN).y - 0.85) * 500.0;
  float sn = smoothstep(uSnowH - 40.0, uSnowH + 40.0, vH + sj);
  // ¿le llega el Sol? El fondo del valle comparte la sombra del observador; lo alto ve su propio horizonte
  float hRel = max(0.0, vH - uH0);
  float dip = degrees(sqrt(2.0 * hRel / 6371008.8));
  float q = clamp(hRel / 1500.0, 0.0, 1.0);
  float thr = mix(max(uHzSun, -0.6), -dip, q);
  float lit = uSunAlt < -8.0 ? 0.0 : smoothstep(0.0, 1.0, (uSunAlt - thr) / 0.9 + 0.5);
  lit *= 1.0 - uOvc;                                               // cielo cubierto: sin Sol directo
  // (bajo los pies la luz es la de un suelo parejo: sin las rayas que dejaría la pendiente de cada dirección)
  vec3 n = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(vN), smoothstep(10.0, 140.0, vD)));
  float ndl = max(0.0, dot(n, uSun));
  float shade = mix(0.6, 0.48 + 0.72 * ndl, lit);
  // la nieve: sin quemarse (se ve el relieve del glaciar) y con las grietas y manchas de la imagen
  float shadeS = mix(0.62, 0.5 + 0.48 * ndl, lit);
  vec3 dcol = mix(alb * shade, uSnow * (0.82 + 0.2 * g) * shadeS * (1.0 + 0.45 * nearDet), sn);   // la nieve cercana, con su relieve menudo
  // en la sombra, solo la luz del cielo (más azulada)
  float lum = (dcol.r + dcol.g + dcol.b) / 3.0;
  dcol = mix(dcol, vec3(0.55, 0.66, 0.95) * lum * 1.3, mix(0.22, 0.4, sn) * (1.0 - lit * smoothstep(-0.15, 0.5, dot(n, uSun))));
  // arrebol: el Sol rasante enciende de anaranjado lo que aún lo ve
  float gl = uGlow * lit * smoothstep(-0.15, 0.7, dot(n, uSun));     // suave: sin motas donde la ladera gira
  dcol = mix(dcol, mix(vec3(1.0, 0.5, 0.33) * max(0.45, lum * 1.6), vec3(1.0, 0.6, 0.55), sn), mix(0.45, 0.8, sn) * gl);
  // bruma con la distancia
  dcol = mix(dcol, uHorizon, 0.86 * (1.0 - exp(-vD / 95000.0)));   // aire limpio de altura: no todo blanquecino
  // y la del tiempo (lluvia, niebla: rainLook.js), con la visibilidad del pronóstico
  dcol = mix(dcol, uHorizon, min(0.95, 1.0 - exp(-vD * uFogB)));
  // de noche, siluetas (algo más claras lejos), con un resto del relieve
  float f = sqrt(clamp(vD / 300000.0, 0.0, 1.0));
  vec3 ncol = mix(uNightNear, uNightFar, pow(f, 0.8) * 0.95) * (0.82 + 0.5 * g + 0.5 * sn);
  gl_FragColor = vec4(mix(ncol, dcol, uDay), a);
}`;

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Capa three.js del relieve cercano. `onReady` avisa cuando la imagen terminó de cargar (hay que redibujar). */
export function createNearTerrainLayer({ onReady = null } = {}) {
  const group = new THREE.Group();
  group.name = "terrain3d";
  group.visible = false;
  let mesh = null, key = null, enabled = true, seq = 0, h0 = 0, coverKm = 0, loading = false;
  const uniforms = {
    map: { value: null }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uHorizon: { value: new THREE.Vector3(0.1, 0.11, 0.17) },
    uNightNear: { value: new THREE.Vector3(0.05, 0.056, 0.085) }, uNightFar: { value: new THREE.Vector3(0.17, 0.185, 0.27) },
    uSnow: { value: new THREE.Vector3(0.9, 0.92, 0.95) }, uDay: { value: 0 }, uSunAlt: { value: -90 }, uHzSun: { value: 0 },
    uH0: { value: 0 }, uSnowH: { value: 4900 }, uOpaque: { value: 0 }, uGlow: { value: 0 }, uFadeLo: { value: -9 }, uFadeHi: { value: -2.5 },
    uUnits: { value: UNITS_PER_M }, uOvc: { value: 0 }, uFogB: { value: 0 },
  };
  const clear = () => {
    if (mesh) { mesh.geometry.dispose(); if (uniforms.map.value) uniforms.map.value.dispose(); mesh.material.dispose(); group.remove(mesh); }
    mesh = null; key = null; uniforms.map.value = null; group.visible = false;
  };
  return {
    group,
    get key() { return key; },
    get ready() { return !!mesh; },
    /** true mientras se descarga la imagen de una malla nueva (las franjas planas no deben asomar entretanto). */
    get loading() { return loading; },
    /** km que cubre la malla cuando está puesta y visible (0 si no). */
    get coverKm() { return mesh && group.visible ? coverKm : 0; },
    /** near: { data, texUrl } de fetchNearTerrain (o null para quitarlo); k: clave del lugar. */
    set(near, k0, { lift = 0, ground = null } = {}) {
      const my = ++seq, k = `${k0}|${lift}|${Number.isFinite(ground) ? ground.toFixed(1) : "-"}`;
      if (!near) { loading = false; clear(); return; }
      if (k === key && mesh) return;
      loading = true;
      new THREE.TextureLoader().setCrossOrigin("anonymous").load(near.texUrl, (tex) => {
        if (my !== seq) { tex.dispose(); return; }
        loading = false;
        clear();
        tex.colorSpace = THREE.NoColorSpace;                      // los colores se escriben tal cual, como las franjas
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = ANISO;
        const G = nearGeometry(near.data, UNITS_PER_M, lift, ground);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(G.pos, 3));
        g.setAttribute("uv", new THREE.BufferAttribute(G.uv, 2));
        g.setAttribute("normal", new THREE.BufferAttribute(G.nor, 3));
        g.setAttribute("aHD", new THREE.BufferAttribute(G.hd, 2));
        g.setIndex(new THREE.BufferAttribute(G.idx, 1));
        uniforms.map.value = tex; h0 = G.h0; uniforms.uH0.value = h0; coverKm = near.data.dMax / 1000;
        // transparente para entrar en la misma pasada que las franjas (el orden lo da renderOrder), pero con
        // profundidad propia: lo cercano tapa lo de atrás
        const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: true, depthWrite: true, side: THREE.DoubleSide, fog: false });
        mesh = new THREE.Mesh(g, mat);
        mesh.renderOrder = 2.78;                                  // después de todas las franjas (2,70–2,76)
        mesh.frustumCulled = false;
        mesh.onBeforeRender = (renderer) => renderer.clearDepth(); // nada de lo dibujado antes la tapa
        mesh.onAfterRender = (renderer) => renderer.clearDepth();  // …ni ella tapa lo que viene después (monumentos, con su propia escala)
        group.add(mesh); key = k; group.visible = enabled;
        if (onReady) onReady();
      }, undefined, () => { if (my === seq) { loading = false; if (onReady) onReady(); } /* sin imagen: quedan las franjas */ });
    },
    /** st: skyState(...) o null; hz: el horizonte (para la sombra del valle); lat; floor: de pie en una cumbre. */
    setLook(st, { hz = null, lat = 0, floor = false, lowest = 0 } = {}) {
      const sunAlt = st && Number.isFinite(st.sunAlt) ? st.sunAlt : -90;
      const sd = st && st.sunDir ? st.sunDir : [0, 1, 0];
      uniforms.uSun.value.set(sd[0], sd[1], sd[2]).normalize();
      uniforms.uSunAlt.value = sunAlt;
      const day = sstep(-8, 6, sunAlt);
      uniforms.uDay.value = day;
      const hc = st && st.colors && st.colors.horizon ? st.colors.horizon : [0.1, 0.11, 0.17];
      uniforms.uHorizon.value.set(hc[0], hc[1], hc[2]);
      const moon = st && st.moonAlt > 0 ? (st.moonIllum || 0) * Math.sqrt(Math.sin(st.moonAlt * RAD)) : 0;
      uniforms.uNightNear.value.set(0.05 + 0.08 * moon, 0.056 + 0.085 * moon, 0.085 + 0.1 * moon);
      uniforms.uNightFar.value.set(0.17 + 0.1 * moon, 0.185 + 0.1 * moon, 0.27 + 0.12 * moon);
      let hzSun = 0;
      if (hz && hz.alt && hz.alt.length) {
        const n = hz.alt.length, step = hz.step_deg || 360 / n;
        const az = ((Math.atan2(sd[0], -sd[2]) / RAD) % 360 + 360) % 360, j = Math.round(az / step) % n;
        hzSun = Math.max(hz.alt[(j - 1 + n) % n], hz.alt[j], hz.alt[(j + 1) % n]);
      }
      uniforms.uHzSun.value = hzSun;
      uniforms.uSnowH.value = snowLine(lat || 0);
      uniforms.uOpaque.value = floor ? 1 : 0;
      const x = Math.min(1, Math.max(0, (sunAlt - 1) / 7));
      uniforms.uGlow.value = sunAlt > -8 ? 1 - x * x * (3 - 2 * x) : 0;
      // el tiempo (rainLook.js): cielo cubierto y bruma (β en 1/km → 1/m)
      const wx = st && st.wx;
      uniforms.uOvc.value = wx ? wx.overcast || 0 : 0;
      uniforms.uFogB.value = wx && wx.beta > 0 ? (wx.beta / 1000) * day : 0;
      // fuera de una cumbre, el relieve se deshace hacia abajo y deja ver el suelo translúcido de siempre
      const top = Math.min(-0.9, lowest - 0.9);
      uniforms.uFadeHi.value = top; uniforms.uFadeLo.value = top - 2.6;
    },
    setEnabled(b) { enabled = !!b; group.visible = enabled && !!mesh; },
    dispose() { seq++; clear(); if (group.parent) group.parent.remove(group); },
  };
}
