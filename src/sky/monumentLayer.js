// monumentLayer.js — los monumentos (src/sky/monuments.js) en el cielo de «Mi cielo», en el marco local del
// horizonte (x = este, y = arriba, z = −norte), en 3D de verdad: la cámara está en el centro (los ojos del
// observador), así que cada arista recta se ve como se vería en el sitio. Si el monumento queda lejos, todo se
// escala por igual (los ángulos no cambian) para caber dentro de la esfera del cielo.
//
// Aspecto: materiales fotográficos (monumentTextures.js: color, relieve y rugosidad de piedra, arena y hierba
// reales), luz del Sol del momento (dirección y color: blanca a mediodía, dorada al amanecer), luz del cielo en
// las sombras, sombras propias y sobre el suelo, bruma con la distancia y un suelo continuo desde los pies del
// observador hasta la base de cada monumento. De noche, una silueta apenas iluminada por el cielo.
import * as THREE from "three";
import { buildFaces, toLocal, offsetOf, EYE_M, apexOf, altAzOf, groundPatch, footprintRadius } from "./monuments.js";
import { terrainPalette } from "./horizon.js";
import { makeMonumentTexture, MON_MATS } from "./monumentTextures.js";

const MAX_R = 780;

// variación suave del tono a lo largo del monumento (manchas, piedra más o menos limpia) para que la textura no
// se vea repetida, y algo más oscuro junto al suelo (tierra, humedad)
const vnoise = (x, y, z) => {
  const s = (a, b, c) => { const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return h - Math.floor(h); };
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = x - X, fy = y - Y, fz = z - Z;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(s(X, Y, Z), s(X + 1, Y, Z), u), L(s(X, Y + 1, Z), s(X + 1, Y + 1, Z), u), v),
    L(L(s(X, Y, Z + 1), s(X + 1, Y, Z + 1), u), L(s(X, Y + 1, Z + 1), s(X + 1, Y + 1, Z + 1), u), v), w);
};
export function toneAt(p) {
  const n = 0.6 * vnoise(p[0] / 23, p[1] / 23, p[2] / 9) + 0.4 * vnoise(p[0] / 6.5, p[1] / 6.5, p[2] / 3.1);
  const foot = p[2] < 3 ? 0.84 + 0.16 * Math.max(0, p[2]) / 3 : 1;
  return (0.78 + 0.36 * n) * foot;
}     // dentro de la esfera de las estrellas (870) y de las montañas (880)

/**
 * Lo que se dibuja para un lugar: [{ m, o, dz, faces }]. `bases`: { id: altura del suelo (m) bajo el
 * monumento }; `ground`: suelo del observador (m). Sin la altura de la base, el monumento no se dibuja.
 */
/**
 * ¿Está el observador sobre la plataforma de esta pirámide (`standOn`)? `o`: dónde queda la pirámide desde el lugar.
 * La plataforma mide 0,72 × la planta (como la dibuja buildFaces) y va girada `rot`.
 */
export function onPlatform(m, o) {
  if (!m.standOn || !o) return false;
  const a = (m.rot || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), e = -o.e, n = -o.n;
  return Math.abs(e * c - n * sn) < m.w * 0.36 && Math.abs(e * sn + n * c) < m.d * 0.36;
}

export function placeMonuments(list, { lat, lon, ground }, bases, relief = null) {
  const out = [];
  for (const m of list || []) {
    const b = bases && bases[m.id];
    if (!Number.isFinite(b) || !Number.isFinite(ground)) continue;
    const o = offsetOf(lat, lon, m.lat, m.lon);
    // `seat`: en una ladera con muchas piezas (Cochasquí), cada una se asienta sobre el MISMO relieve con el que se
    // dibuja el suelo (la rejilla cercana), no sobre su propia medida: así ninguna queda en el aire ni sobre un pedestal
    const dz0 = relief && m.seat ? reliefAt(relief, o.e, o.n) : b - (ground + EYE_M);
    out.push({ m, o, dz: dz0 + (m.lift || 0) - (m.drop || 0), faces: buildFaces(m, { d: o.d }) });
  }
  // Subido a una plataforma (`standOn`): si el lugar cae dentro de la plataforma de una pirámide, los ojos van a 1,7 m
  // sobre ella, así que todo lo demás (y el suelo) baja lo que haga falta.
  const st = out.find((it) => onPlatform(it.m, it.o));
  if (st) { const up = st.dz + st.m.height + EYE_M; if (up > 0.01) { for (const it of out) it.dz -= up; out.up = up; } }
  return out;
}

/**
 * Nombre y punto más alto de cada monumento colocado: [{ id, name, ele_m, az, alt }]. Con la silueta (`sil`,
 * de monuments.silhouette), el nombre se apoya en lo más alto que se VE cerca de la cima (el borde delantero de
 * la plataforma de arriba queda más alto que su centro), no dentro de la cara.
 */
export function monumentLabels(items, lang = "es", sil = null, step = 0.2) {
  // (la pirámide sobre cuya plataforma se está de pie no lleva etiqueta: no tiene cima a la vista)
  return (items || []).filter(({ m, o }) => m.label !== false && !onPlatform(m, o)).map(({ m, o, dz }) => {
    const v = toLocal(apexOf(m), o, dz), q = altAzOf(v);
    let alt = q.alt;
    if (sil && m.solid) {
      const n = sil.length, c = Math.round(q.az / step), w = Math.max(1, Math.round(1 / step));
      for (let j = c - w; j <= c + w; j++) alt = Math.max(alt, sil[((j % n) + n) % n]);
    }
    const hgt = m.height != null && m.kind !== "stepped" ? m.height : apexOf(m)[2];
    return { id: m.id, name: m.name[lang] || m.name.es, ele_m: hgt < 30 ? Math.round(hgt * 10) / 10 : Math.round(hgt), sub: m.sub ? (m.sub[lang] || m.sub.es) : null, az: q.az, alt, dist_km: o.d / 1000, monument: true };
  });
}

/**
 * Coordenadas de textura (en metros / tesela) de un triángulo según su orientación: las caras inclinadas o
 * verticales llevan u a lo largo de la cara (horizontal) y v hacia arriba por la pendiente; las horizontales, u
 * al este y v al norte. Así las hiladas quedan horizontales y los escalones suben por la escalinata.
 */
export function faceUV(v, tile) {
  const [a, b, c] = v;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const L = Math.hypot(...n) || 1; n = n.map((x) => x / L);
  if (Math.abs(n[2]) > 0.92) return { n, uv: v.map((p) => [p[0] / tile, p[1] / tile]) };
  let h = [-n[1], n[0], 0]; const hl = Math.hypot(h[0], h[1]) || 1; h = [h[0] / hl, h[1] / hl, 0];   // arriba × n
  const s = [n[1] * h[2] - n[2] * h[1], n[2] * h[0] - n[0] * h[2], n[0] * h[1] - n[1] * h[0]];      // n × h
  const sg = s[2] < 0 ? -1 : 1;                                                                      // que suba
  return { n, uv: v.map((p) => [(p[0] * h[0] + p[1] * h[1]) / tile, (sg * (p[0] * s[0] + p[1] * s[1] + p[2] * s[2])) / tile]) };
}

const R_E = 6371008.8, K_REFR = 0.13;

// ── sombreado propio sobre el material estándar de three ─────────────────────────────────────────────────
// · la foto no se repite a la vista: su tono varía a gran escala con una copia muy ampliada de sí misma y, en
//   materiales sin dibujo regular (hierba, arena, roca), a lo lejos se mezcla con otra copia más grande y girada
// · bruma: con la distancia real el color se va hacia el del cielo junto al horizonte
// · curva de película (ACES): los claros al sol no se queman y las sombras conservan color
const GLSL_UNIFORMS = `
uniform float uK; uniform float uMacro; uniform float uBlend; uniform float uScaleB; uniform vec3 uHaze; uniform float uHazeK; uniform float uExposure;
vec3 teseoAces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
`;
const GLSL_MAP = `
#ifdef USE_MAP
  float tsDist = length(vViewPosition) / uK;
  vec4 tsA = texture2D(map, vMapUv);
  vec2 tsUvB = mat2(0.829, -0.559, 0.559, 0.829) * vMapUv * uScaleB + vec2(0.37, 0.11);
  vec4 tsB = texture2D(map, tsUvB);
  float tsW = uBlend * smoothstep(6.0, 60.0, tsDist * uScaleB * 5.8) * 0.85;
  vec4 tsC = mix(tsA, tsB, tsW);
  float tsAvg = max(0.04, texture2D(map, vMapUv, 12.0).g);
  // manchas grandes y suaves: la propia foto muy ampliada y desenfocada (niveles pequeños del mipmap)
  float tsMac = texture2D(map, vMapUv * 0.043 + vec2(0.21, 0.63), 5.0).g / tsAvg;
  float tsMac2 = texture2D(map, mat2(0.6, -0.8, 0.8, 0.6) * vMapUv * 0.0093, 6.0).g / tsAvg;
  tsC.rgb *= mix(1.0, clamp(0.25 + 0.4 * tsMac + 0.35 * tsMac2, 0.6, 1.4), uMacro);
  diffuseColor *= tsC;
#endif
`;
const GLSL_OUT = `
  {
    float tsD = length(vViewPosition) / uK;
    float tsH = 1.0 - exp(-tsD * uHazeK);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, tsH);
    gl_FragColor.rgb = teseoAces(gl_FragColor.rgb * uExposure);
  }
`;

const texCache = new Map();

/** Hasta dónde llega el suelo continuo (m): algo más lejos que el monumento más lejano. */
export function groundReach(items) {
  let reach = 260;
  for (const it of items || []) reach = Math.max(reach, it.o.d + footprintRadius(it.m) + 220);
  return reach;
}

// Relieve del suelo cercano (para sitios en ladera o sobre una cresta, m.relief): alturas del modelo de relieve
// en una rejilla polar alrededor del observador (RELIEF_NA acimuts × los radios RELIEF_R, como fracción del
// alcance del suelo).
export const RELIEF_R = [0.08, 0.2, 0.38, 0.6, 0.9], RELIEF_NA = 12;
/** Puntos [lat, lon] de la rejilla, por anillos (de dentro afuera) y, en cada uno, por acimut desde el norte. */
export function reliefPoints(lat, lon, reach) {
  const out = [], ck = Math.cos((lat * Math.PI) / 180);
  for (const f of RELIEF_R) for (let i = 0; i < RELIEF_NA; i++) {
    const a = (i / RELIEF_NA) * 2 * Math.PI, r = f * reach;
    out.push([lat + (r * Math.cos(a)) / 110574, lon + (r * Math.sin(a)) / (111320 * ck)]);
  }
  return out;
}
/** Altura del relieve (m, respecto a los ojos) en (e, n): interpolada en la rejilla; a los pies, 1,7 m abajo. */
export function reliefAt(grid, e, n) {
  const r = Math.hypot(e, n), NA = RELIEF_NA, rad = RELIEF_R.map((f) => f * grid.reach);
  let az = (Math.atan2(e, n) / (2 * Math.PI)) * NA; if (az < 0) az += NA;
  const i0 = Math.floor(az) % NA, i1 = (i0 + 1) % NA, fa = az - Math.floor(az);
  const ring = (j) => grid.h[j * NA + i0] * (1 - fa) + grid.h[j * NA + i1] * fa;
  if (r <= rad[0]) { const t = r / rad[0]; return -EYE_M * (1 - t) + ring(0) * t; }
  for (let j = 1; j < rad.length; j++) if (r <= rad[j]) { const t = (r - rad[j - 1]) / (rad[j] - rad[j - 1]); return ring(j - 1) * (1 - t) + ring(j) * t; }
  return ring(rad.length - 1);
}

/**
 * Altura (m, respecto a los ojos) del suelo continuo en un punto (e, n) alrededor del observador: a sus pies,
 * 1,7 m por debajo; junto a cada monumento, la de su base; entre medias, una mezcla suave según la cercanía.
 * Con `grid` (relieve cercano), lejos de los monumentos manda el relieve: una cresta cae por detrás.
 */
export function groundHeight(e, n, items, grid = null) {
  let sw, sh;
  // `items.up`: el observador está subido a una plataforma (placeMonuments): todo el suelo queda esos metros más abajo
  const up = (items && items.up) || 0;
  // (a los pies del observador manda siempre su propio suelo: si no, un monumento cercano y más alto podría
  // levantar el suelo por encima de sus ojos)
  if (grid) { const w0 = 1 / (e * e + n * n + 4); sw = 1 / (22 * 22) + w0; sh = reliefAt(grid, e, n) / (22 * 22) - EYE_M * w0; }
  else { sw = 1 / (e * e + n * n + 16); sh = -EYE_M * sw; }
  for (const it of items) {
    // las piezas asentadas sobre el relieve (`seat`) no aplanan el suelo a su alrededor: la ladera sigue igual y la
    // pieza sale de ella (enterrada por el lado alto, alta por el bajo, como las pirámides de Cochasquí)
    if (grid && it.m.seat) continue;
    const d = Math.hypot(e - it.o.e, n - it.o.n), r = Math.max(d - 0.7 * footprintRadius(it.m), 1.5);
    // con relieve, cada monumento solo levanta el suelo a su alrededor (hasta 80 m de su borde, sobre todo en los primeros 25)
    const w = grid ? Math.max(0, 1 / (r * r) - 1 / (80 * 80)) * 4 : 1 / (r * r);
    sw += w; sh += (it.dz + up - (it.m.lift || 0)) * w;
  }
  return sh / sw - up;
}

export function createMonumentLayer({ onReady = null } = {}) {
  const group = new THREE.Group();
  let meshes = [], items = [], enabledFlag = true, k = 1, pending = 0;
  // uniformes comunes a todos los materiales (los propios de cada uno, en su copia)
  const shared = { uK: { value: 1 }, uHaze: { value: new THREE.Color(0.5, 0.6, 0.75) }, uHazeK: { value: 1 / 14000 }, uExposure: { value: 0.9 } };
  // luces solo para los monumentos (las demás capas usan materiales sin luz)
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  const small = typeof window !== "undefined" && Math.min(window.innerWidth || 1000, window.innerHeight || 1000) < 700;
  sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096);
  sun.shadow.bias = -0.0003;
  sun.shadow.radius = 2.5;
  const sunTarget = new THREE.Object3D();
  sun.target = sunTarget;
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x6b5a45, 0);
  group.add(sun, sunTarget, hemi);
  let box = new THREE.Box3();

  const show = () => { group.visible = enabledFlag && meshes.length > 0 && pending === 0; };
  function tex(kind) {
    if (!texCache.has(kind)) {
      const T = makeMonumentTexture(kind, THREE, () => { T.left--; if (T.left === 0) for (const cb of T.waiters.splice(0)) cb(); });
      T.left = T.parts; T.waiters = [];
      texCache.set(kind, T);
    }
    const T = texCache.get(kind);
    if (T.left > 0) { pending++; T.waiters.push(() => { pending--; show(); if (pending === 0 && onReady) onReady(); }); }
    return T;
  }

  function material(mat, { ground = false } = {}) {
    if (mat === "door") return new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, metalness: 0, side: THREE.DoubleSide, transparent: true, depthWrite: true, fog: false });
    const T = tex(mat), cfg = T.cfg || MON_MATS.dirt;
    const m = new THREE.MeshStandardMaterial({ map: T.map, normalMap: T.normalMap, aoMap: T.armMap, roughnessMap: T.armMap, roughness: 1, metalness: 0,
      vertexColors: true, side: ground ? THREE.FrontSide : THREE.DoubleSide, shadowSide: THREE.BackSide, transparent: true, opacity: 1,
      // el suelo también escribe profundidad: lo que queda enterrado (el pie de una pirámide en ladera) no se ve a
      // través de él; un pequeño desplazamiento evita que parpadee con lo que se apoya justo encima
      depthTest: true, depthWrite: true, ...(ground ? { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 } : {}), fog: false });
    m.color.setRGB(cfg.tint[0], cfg.tint[1], cfg.tint[2]);
    m.normalScale.set(cfg.normal, cfg.normal);
    m.aoMapIntensity = 1;
    const own = { uMacro: { value: cfg.macro }, uBlend: { value: cfg.blend }, uScaleB: { value: ground ? 0.173 : 0.41 } };
    if (cfg.matte) { m.roughnessMap = null; m.roughness = 0.97; }
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, shared, own);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + GLSL_UNIFORMS)
        .replace("#include <map_fragment>", GLSL_MAP)
        .replace("#include <tonemapping_fragment>", GLSL_OUT + "\n#include <tonemapping_fragment>");
    };
    m.customProgramCacheKey = () => "teseo-monument-v2";
    return m;
  }

  function clear() {
    for (const m of meshes) { group.remove(m); m.geometry.dispose(); m.material.dispose(); }
    meshes = []; pending = 0;
    for (const T of texCache.values()) T.waiters = [];
  }

  let skirt = true, last = null;      // faldón llano más allá del sitio (sin relieve 3D alrededor) y lo último que se puso
  function build(list, grid = null) {
    clear();
    items = list || [];
    if (!items.length) return;
    let far = 1;
    for (const it of items) for (const f of it.faces) for (const v of f.v) { const q = toLocal(v, it.o, it.dz); far = Math.max(far, Math.hypot(q[0], q[1], q[2])); }
    // el suelo llega algo más lejos que el monumento más lejano
    const reach = groundReach(items);
    k = Math.min(1, MAX_R / Math.max(far, reach));
    shared.uK.value = k;
    box = new THREE.Box3();
    // una malla por material
    const byMat = new Map();
    for (const it of items) for (const f of it.faces) {
      const mat = f.tex || f.mat || it.m.mat || "basalt";
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push({ f, it });
    }
    for (const [mat, list2] of byMat) {
      const material_ = material(mat), tile = mat === "door" ? 1 : (MON_MATS[mat] || MON_MATS.dirt).tile, n = list2.length;
      const pos = new Float32Array(n * 9), nor = new Float32Array(n * 9), uv = new Float32Array(n * 6), col = new Float32Array(n * 9);
      // luz suave en las piedras y el túmulo: la normal de cada vértice es la media de las caras que lo comparten
      const acc = new Map(), keyOf = (it, p) => `${it.m.id}|${Math.round(p[0] * 200)}|${Math.round(p[1] * 200)}|${Math.round(p[2] * 200)}`;
      const info = list2.map(({ f }) => faceUV(f.v, tile));
      list2.forEach(({ f, it }, i) => {
        if (!f.smooth) return;
        const [a, b, c] = f.v, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const an = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];   // ponderada por el área
        for (const p of f.v) { const key = keyOf(it, p), s = acc.get(key) || [0, 0, 0]; s[0] += an[0]; s[1] += an[1]; s[2] += an[2]; acc.set(key, s); }
      });
      list2.forEach(({ f, it }, i) => {
        const { n: nn, uv: tuv } = info[i];
        for (let j = 0; j < 3; j++) {
          const q = toLocal(f.v[j], it.o, it.dz);
          pos.set([q[0] * k, q[1] * k, q[2] * k], i * 9 + j * 3);
          let vn = nn;
          if (f.smooth) { const s = acc.get(keyOf(it, f.v[j])), L = Math.hypot(s[0], s[1], s[2]) || 1; vn = [s[0] / L, s[1] / L, s[2] / L]; }
          nor.set([vn[0], vn[2], -vn[1]], i * 9 + j * 3);       // (E, N, U) → (x, y, z) = (E, U, −N)
          uv.set(f.uv ? [f.uv[j][0] / tile, f.uv[j][1] / tile] : tuv[j], i * 6 + j * 2);
          const t = mat === "door" ? 1 : (1 + (toneAt(f.v[j]) - 0.96) * 0.45) * (f.tone || 1);
          col.set([t, t * 0.99, t * 0.975], i * 9 + j * 3);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.computeBoundingBox(); box.union(g.boundingBox);
      const mesh = new THREE.Mesh(g, material_);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.renderOrder = 10;               // lo último: delante del Sol, la Luna, las nubes y las montañas (2,5–2,7)
      mesh.frustumCulled = false;
      meshes.push(mesh); group.add(mesh);
    }
    // el suelo: una sola malla alrededor del observador (anillos cada vez más anchos), con la textura del lugar;
    // recibe las sombras y se desvanece hacia fuera, donde sigue el horizonte del relieve
    {
      const near = items.reduce((a, b) => (a.o.d <= b.o.d ? a : b)), gmat = groundPatch(near.m).mat, tile = (MON_MATS[gmat] || MON_MATS.dirt).tile;
      // con relieve (crestas, laderas) la malla es más fina, para que el suelo llegue al pie de cada monumento
      const fine = !!(grid && grid.reach === reach), NR = fine ? 168 : 64, NS = fine ? 288 : 144, r0 = 0.6;
      // El suelo sigue más allá del último monumento como un faldón llano (8 anillos, hasta 12 veces el
      // alcance) a la altura que tenía en su borde: desde un sitio alto (la plataforma de una pirámide) se mira hacia
      // abajo, y sin él quedaba una franja oscura entre el suelo y las montañas lejanas.
      // (con el relieve en 3D alrededor —terrain3d.js— el faldón ya no hace falta: el suelo del sitio acaba en su
      // borde, desvanecido, y más allá se ve el terreno de verdad)
      const EX = skirt ? 8 : 0, FAR = skirt ? 12 : 1, verts = (NR + 1 + EX) * NS + 1;
      const pos = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), col = new Float32Array(verts * 4), idx = [];
      const rEnd = EX ? reach * FAR : reach;
      const put = (i, e, n, r) => {
        // (en el faldón, la altura es la del borde de la malla en esa dirección)
        const q = r > reach ? reach / r : 1;
        const h = groundHeight(e * q, n * q, items, grid && grid.reach === reach ? grid : null) - (r * r * (1 - K_REFR)) / (2 * R_E);
        // lo que caería más lejos que la esfera del cielo se acerca por su misma línea de visión (se ve igual, pero
        // queda DELANTE de las líneas de las constelaciones y de las estrellas bajo el horizonte, que si no se verían encima)
        let px = e * k, py = h * k, pz = -n * k; const pl = Math.hypot(px, py, pz); if (pl > MAX_R) { const q2 = MAX_R / pl; px *= q2; py *= q2; pz *= q2; }
        pos.set([px, py, pz], i * 3); uv.set([e / tile, n / tile], i * 2);
        const fade = 1 - Math.min(1, Math.max(0, (r - (skirt ? 0.9 : 0.6) * rEnd) / ((skirt ? 0.1 : 0.4) * rEnd)));
        col.set([1, 1, 1, fade * fade * (3 - 2 * fade)], i * 4);
      };
      put(0, 0, 0, 0);
      for (let j = 0; j <= NR; j++) {
        const r = r0 * Math.pow(reach / r0, j / NR);
        for (let i = 0; i < NS; i++) { const a = (i / NS) * 2 * Math.PI; put(1 + j * NS + i, r * Math.sin(a), r * Math.cos(a), r); }
      }
      for (let m = 1; m <= EX; m++) {
        const r = reach * Math.pow(FAR, m / EX);
        for (let i = 0; i < NS; i++) { const a = (i / NS) * 2 * Math.PI; put(1 + (NR + m) * NS + i, r * Math.sin(a), r * Math.cos(a), r); }
      }
      for (let i = 0; i < NS; i++) idx.push(0, 1 + ((i + 1) % NS), 1 + i);
      for (let j = 0; j < NR + EX; j++) for (let i = 0; i < NS; i++) {
        const a = 1 + j * NS + i, b = 1 + j * NS + ((i + 1) % NS), c = a + NS, d = b + NS;
        idx.push(a, d, c, a, b, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      g.setAttribute("color", new THREE.BufferAttribute(col, 4));
      g.setIndex(idx); g.computeVertexNormals();
      // el faldón es llano: su normal mira arriba (al acercarlo a la esfera del cielo su forma deja de serlo, y sin esto se sombrearía)
      { const na = g.attributes.normal.array; for (let i = 1 + NR * NS; i < verts; i++) na.set([0, 1, 0], i * 3); g.attributes.normal.needsUpdate = true; }
      const mesh = new THREE.Mesh(g, material(gmat, { ground: true }));
      mesh.receiveShadow = true; mesh.renderOrder = 9.9; mesh.frustumCulled = false;
      meshes.push(mesh); group.add(mesh);
    }
    // la cámara de sombras abarca los monumentos
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2 + 5 * k;
    sunTarget.position.copy(c);
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.1, far: r * 4 });
    sun.shadow.camera.updateProjectionMatrix();
    // el sesgo sigue al tamaño del píxel de sombra: con hiladas de 1 m a 1 km, sin él cada escalón se mancharía
    sun.shadow.normalBias = Math.max(0.1 * k, (2.2 * 2 * r) / sun.shadow.mapSize.x);
    sun.userData.center = c; sun.userData.r = r;
  }

  /** La luz del momento (st = skyState o null): dirección y color del Sol, luz del cielo de día o de noche. */
  function paint(st) {
    if (!meshes.length) return;
    const pal = terrainPalette(st, 1), day = pal.day;
    const sd = st && st.sunDir ? st.sunDir : null;            // [este, arriba, −norte]
    const sunUp = sd ? Math.max(0, Math.min(1, (sd[1] + 0.02) / 0.12)) : 0;
    const low = sd ? Math.max(0, 1 - Math.max(0, sd[1]) / 0.35) : 0;   // Sol bajo: luz dorada
    if (sd && sunUp > 0) {
      const c = sun.userData.center || new THREE.Vector3(), r = sun.userData.r || 100;
      sun.position.set(c.x + sd[0] * r * 2, c.y + Math.max(0.02, sd[1]) * r * 2, c.z + sd[2] * r * 2);
      sun.color.setRGB(1, 0.94 - 0.3 * low, 0.86 - 0.52 * low);
      // un Sol alto da ~π (una cara blanca de frente refleja 1); bajo, la atmósfera le quita fuerza
      sun.intensity = Math.PI * sunUp * (1 - 0.35 * low);
      sun.castShadow = true;
    } else { sun.intensity = 0; sun.castShadow = false; }
    const sky = st && st.colors ? st.colors.horizon : [0.1, 0.11, 0.17];
    const zen = st && st.colors && st.colors.zenith ? st.colors.zenith : sky;
    // luz del cielo (azulada de día: tiñe las sombras) y la que rebota en el suelo
    hemi.color.setRGB(0.35 + 0.35 * sky[0] + 0.3 * zen[0], 0.4 + 0.3 * sky[1] + 0.3 * zen[1], 0.5 + 0.2 * sky[2] + 0.3 * zen[2]);
    hemi.groundColor.setRGB(0.5 * (0.4 + 0.6 * sunUp), 0.43 * (0.4 + 0.6 * sunUp), 0.34 * (0.4 + 0.6 * sunUp));
    hemi.intensity = 0.24 + 0.94 * day;
    // bruma del color del cielo junto al horizonte (de noche, casi negra)
    shared.uHaze.value.setRGB(sky[0] * (0.25 + 0.75 * day), sky[1] * (0.25 + 0.75 * day), sky[2] * (0.25 + 0.75 * day));
    shared.uExposure.value = 0.92;
  }

  return {
    group,
    set(list, st, grid = null) { last = { list, st, grid }; build(list, grid); paint(st); show(); },
    /** Con el relieve 3D alrededor (terrain3d.js) el suelo del sitio no se alarga en un faldón llano. */
    setSkirt(b) { if (skirt === !!b) return; skirt = !!b; if (last) { build(last.list, last.grid); paint(last.st); show(); } },
    paint,
    setEnabled(b) { enabledFlag = !!b; show(); },
    get items() { return items; },
    get loading() { return pending > 0; },
    dispose() { clear(); if (group.parent) group.parent.remove(group); },
  };
}
