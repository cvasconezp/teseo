// hipsLayer.js — el mapa fotográfico de todo el cielo: al acercarse, el cielo se cubre con las placas del Digitized Sky
// Survey (DSS2, color), cargadas EN VIVO por teselas HiPS desde ESASky, como hacen Stellarium o Aladin. Nada se guarda
// en el repositorio (las placas del DSS no son de dominio público): solo se piden las teselas que se están mirando.
//
// HiPS: el cielo dividido con HEALPix (esquema anidado). Una tesela de orden k es un píxel HEALPix de ese orden, con
// 512×512 píxeles; dentro de la imagen, la fila sigue la coordenada x del píxel y la columna la y (comprobado con
// scripts/build_deepsky_images.py). Marco: ecuatorial J2000, el de las estrellas (x → AR 0 h, y → AR 6 h, z → polo).
// La parte de cálculo es pura y se prueba en scripts/test_hips.mjs.
import * as THREE from "three";

export const HIPS = {
  base: "https://skies.esac.esa.int/DSSColor",
  minOrder: 3, maxOrder: 9,                       // 9 es el orden nativo del DSS (1,7″ por píxel)
  credit: "Digitized Sky Survey · STScI/NASA, CC BY-NC-SA 4.0 · color y HEALPix: CDS · servido por ESASky (ESA)",
};
/**
 * Detalle fino: donde lo cubre (algo más de un tercio del cielo, sobre todo el norte), el Sloan Digital Sky Survey,
 * cuatro veces más nítido que el DSS (0,4″ por píxel) y en color real. Entra con menos de 2,4° de campo y, donde no
 * hay Sloan, sigue el DSS.
 */
export const HIPS_FINE = {
  base: "https://skies.esac.esa.int/SDSS9Color",
  minOrder: 6, maxOrder: 10, far: 2.4, near: 1.2,
  credit: "Sloan Digital Sky Survey (SDSS DR9), CC BY · HEALPix: CDS · servido por ESASky (ESA)",
  // Donde el Sloan sale mal (objetos grandes y brillantes: franjas saturadas en M31, la nebulosa de Orión en verde,
  // M33 a retazos) se queda el DSS: [AR°, Dec°, radio°]
  avoid: [[10.68, 41.27, 3.2], [83.82, -5.39, 2.2], [23.46, 30.66, 1.3], [56.75, 24.12, 2.0], [85.2, -2.2, 1.8]],
};
/** ¿Cae la dirección unitaria `v` dentro de alguna zona a evitar ([AR°, Dec°, radio°])? */
export function inAvoid(v, zones) {
  const R = Math.PI / 180;
  for (const [ra, dec, rad] of zones || []) {
    const c = Math.cos(dec * R), d = v[0] * c * Math.cos(ra * R) + v[1] * c * Math.sin(ra * R) + v[2] * Math.sin(dec * R);
    if (d > Math.cos(rad * R)) return true;
  }
  return false;
}
const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4], JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];
const TWO_PI = Math.PI * 2;

const spread = (v) => { let r = 0; for (let b = 0; b < 15; b++) r += ((v >> b) & 1) * Math.pow(4, b); return r; };
const squeeze = (v) => { let r = 0; for (let b = 0; b < 15; b++) r |= (Math.floor(v / Math.pow(4, b)) & 1) << b; return r; };

/** Píxel HEALPix (anidado) de orden `order` que contiene la dirección unitaria (x, y, z). */
export function nestPix(order, x, y, z) {
  const ns = 1 << order, za = Math.abs(z);
  let tt = (Math.atan2(y, x) / (Math.PI / 2)) % 4; if (tt < 0) tt += 4;
  let face, ix, iy;
  if (za <= 2 / 3) {
    const t1 = ns * (0.5 + tt), t2 = ns * z * 0.75, jp = Math.floor(t1 - t2), jm = Math.floor(t1 + t2);
    const ifp = Math.floor(jp / ns), ifm = Math.floor(jm / ns);
    face = ifp === ifm ? (ifp & 3) | 4 : ifp < ifm ? ifp & 3 : (ifm & 3) + 8;
    ix = jm & (ns - 1); iy = ns - (jp & (ns - 1)) - 1;
  } else {
    const ntt = Math.min(3, Math.floor(tt)), tp = tt - ntt, tmp = ns * Math.sqrt(3 * (1 - za));
    const jp = Math.min(ns - 1, Math.floor(tp * tmp)), jm = Math.min(ns - 1, Math.floor((1 - tp) * tmp));
    if (z >= 0) { face = ntt; ix = ns - jm - 1; iy = ns - jp - 1; } else { face = ntt + 8; ix = jp; iy = jm; }
  }
  return face * ns * ns + spread(ix) + 2 * spread(iy);
}

/** Dirección unitaria del punto (fx, fy) ∈ [0,1]² de la cara `face` de HEALPix. */
export function faceDir(face, fx, fy) {
  const jr = JRLL[face] - fx - fy;
  let nr, z;
  if (jr < 1) { nr = jr; z = 1 - (nr * nr) / 3; } else if (jr > 3) { nr = 4 - jr; z = (nr * nr) / 3 - 1; } else { nr = 1; z = ((2 - jr) * 2) / 3; }
  let tmp = JPLL[face] * nr + fx - fy; if (tmp < 0) tmp += 8; if (tmp >= 8) tmp -= 8;
  const phi = nr < 1e-15 ? 0 : (0.25 * Math.PI * tmp) / nr, s = Math.sqrt(Math.max(0, 1 - z * z));
  return [s * Math.cos(phi), s * Math.sin(phi), z];
}

/**
 * La malla de una tesela: (n+1)² direcciones y sus coordenadas de textura (u, v con v = 0 abajo, como las espera
 * three.js con la imagen volteada). Devuelve { dirs: [[x,y,z]…], uvs: [[u,v]…], n }.
 */
export function tileGrid(order, ipix, n = 8) {
  const ns = 1 << order, face = Math.floor(ipix / (ns * ns)), sub = ipix - face * ns * ns, X = squeeze(sub), Y = squeeze(Math.floor(sub / 2));
  const dirs = [], uvs = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    dirs.push(faceDir(face, (X + i / n) / ns, (Y + j / n) / ns));
    uvs.push([j / n, 1 - i / n]);            // fila de la imagen = x; columna = y
  }
  return { dirs, uvs, n };
}

/** Orden HiPS para que un píxel de tesela ocupe más o menos 1,2 píxeles de pantalla (campo vertical `fov`°, alto `H` px). */
export function hipsOrder(fov, H, { min = HIPS.minOrder, max = HIPS.maxOrder } = {}) {
  return Math.min(max, Math.max(min, Math.ceil(Math.log2((58.6 * H) / (512 * fov * 1.2)))));
}
export const tileUrl = (order, ipix, base = HIPS.base) => `${base}/Norder${order}/Dir${Math.floor(ipix / 10000) * 10000}/Npix${ipix}.jpg`;
/** Cuánto se ve el mapa según el campo: nada con más de `far`°, entero con menos de `near`°. */
/** Suave (sin esquinas): al acercar o alejar, el brillo cambia poco a poco. */
export const hipsFade = (fov, far = 30, near = 11) => { const t = Math.min(1, Math.max(0, (far - fov) / (far - near))); return t * t * (3 - 2 * t); };

// Las estrellas más brillantes dejan en las placas un halo azul enorme con una cruz (reflejos del telescopio), que no
// es parte del cielo: alrededor de cada una el mapa se apaga (uStars: dirección y radio en radianes; setHipsMasks).
const MASKS = { uStars: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 1, 0)) }, uNStars: { value: 0 } };
/** Radio (grados) del halo de una estrella de magnitud `mag` en las placas. */
export const haloRadiusDeg = (mag) => 0.6 + 0.3 * (1.6 - mag);
/** stars: [[x, y, z, mag], …] (dirección unitaria en el marco ecuatorial). Se usan las 16 más brillantes con mag < 1,3. */
export function setHipsMasks(stars) {
  const list = (stars || []).filter((s) => Number.isFinite(s[3]) && s[3] < 1.3).sort((a, b) => a[3] - b[3]).slice(0, 16);
  list.forEach((s, i) => { const L = Math.hypot(s[0], s[1], s[2]) || 1; MASKS.uStars.value[i].set(s[0] / L, s[1] / L, s[2] / L, haloRadiusDeg(s[3]) * Math.PI / 180); });
  MASKS.uNStars.value = list.length;
  return list.length;
}
const VERT = "varying vec2 vUv; varying vec3 vDir; void main(){ vUv = uv; vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
// se resta el fondo de la placa (un velo azulado) para que el cielo siga negro, y la luz se SUMA a lo que hay detrás
const FRAG = "uniform sampler2D map; uniform float k; uniform vec3 bias; uniform vec4 uStars[16]; uniform int uNStars; varying vec2 vUv; varying vec3 vDir; void main(){ vec3 c = texture2D(map, vUv).rgb; c = max(c - bias, 0.0); vec3 d = normalize(vDir); float m = 1.0; for (int i = 0; i < 16; i++) { if (i >= uNStars) break; float a = acos(clamp(dot(d, uStars[i].xyz), -1.0, 1.0)); m *= smoothstep(uStars[i].w * 0.45, uStars[i].w * 1.6, a); } gl_FragColor = vec4(c * k * m, 1.0);\n#include <colorspace_fragment>\n}";

export function createHipsLayer({ radius = 896, onLoad = null, maxTiles = 110, parallel = 6, base = HIPS.base, minOrder = HIPS.minOrder, maxOrder = HIPS.maxOrder,
  far = 30, near = 11, bias = [0.006, 0.010, 0.018], needAll = false, renderOrder = -5, avoid = null } = {}) {
  const group = new THREE.Group(); group.visible = false;
  const tiles = new Map();                       // "orden/pix" → { order, mesh, mat, state: "load"|"ok"|"no", fade, used }
  let on = true, dark = 1, active = 0, tick = 0, loading = 0, queue = [], dim = 0, under = 0, cov = needAll ? 0 : 1;
  const BIAS = new THREE.Vector3(bias[0], bias[1], bias[2]);
  // el orden (nivel de detalle) que se está mostrando, el anterior mientras se cruza con él, y cuánto va el cruce (0–1)
  let shownOrder = null, prevOrder = null, xf = 1;
  const loader = typeof document !== "undefined" ? new THREE.TextureLoader() : null;
  if (loader) loader.setCrossOrigin("anonymous");
  const tmp = new THREE.Vector3(), qi = new THREE.Quaternion();

  const build = (order, ipix, tex) => {
    const { dirs, uvs, n } = tileGrid(order, ipix), pos = new Float32Array(dirs.length * 3), uv = new Float32Array(dirs.length * 2), idx = [];
    dirs.forEach((d, i) => { pos.set([d[0] * radius, d[1] * radius, d[2] * radius], i * 3); uv.set(uvs[i], i * 2); });
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, b = a + n + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, k: { value: 0 }, bias: { value: BIAS }, uStars: MASKS.uStars, uNStars: MASKS.uNStars }, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = renderOrder; mesh.frustumCulled = false; mesh.visible = false; group.add(mesh);
    return { mesh, mat };
  };
  const drop = (key) => { const t = tiles.get(key); if (!t) return; if (t.mesh) { group.remove(t.mesh); t.mesh.geometry.dispose(); if (t.mat.uniforms.map.value) t.mat.uniforms.map.value.dispose(); t.mat.dispose(); } tiles.delete(key); };
  const pump = () => {
    while (loading < parallel && queue.length) {
      const key = queue.shift(), t = tiles.get(key); if (!t || t.state !== "wait") continue;
      // si ya no hace falta (la vista se movió), no se pide
      if (tick - t.used > 2) { tiles.delete(key); continue; }
      t.state = "load"; loading++;
      loader.load(tileUrl(t.order, t.ipix, base), (tex) => {
        loading--; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        if (tiles.get(key) !== t) { tex.dispose(); pump(); return; }
        Object.assign(t, build(t.order, t.ipix, tex)); t.state = "ok"; t.fade = 0; if (onLoad) onLoad(); pump();
      }, undefined, () => { loading--; t.state = "no"; pump(); });
    }
  };

  return {
    group,
    get active() { return active; },
    /** Cuánto se está viendo de verdad este mapa (0–1): su aparición por el campo × si cubre toda la vista. */
    get level() { return active * cov; },
    get stats() { let ok = 0; for (const t of tiles.values()) if (t.state === "ok") ok++; return { tiles: tiles.size, ok, loading, queued: queue.length }; },
    setOn(v) { on = !!v; if (!on) { group.visible = false; active = 0; } },
    /** `darkness`: 1 de noche, 0 de día (de día no hay mapa). */
    setDarkness(v) { dark = Math.min(1, Math.max(0, v)); },
    /** Cuánto cubre la vista una imagen de agencia ya visible (0–1): el mapa se atenúa en esa medida. */
    setDim(v) { dim = Math.min(1, Math.max(0, v || 0)); },
    /** Cuánto se ve otro mapa más fino encima (0–1): este se retira en esa medida (no suman su luz). */
    setUnder(v) { under = Math.min(1, Math.max(0, v || 0)); },
    /**
     * Una vez por actualización de la vista: decide qué teselas hacen falta, las pide y ajusta su brillo.
     * Devuelve true si hay que volver a dibujar (algo está apareciendo).
     */
    update(camera, viewH) {
      // `dim`: donde una imagen de agencia cubre la vista, el mapa baja (si no, sumarían su luz)
      const fd = hipsFade(camera.fov, far, near), base0 = on && loader ? dark * fd * 0.8 * (1 - 0.85 * dim) : 0;
      active = base0 > 0.004 ? fd : 0;
      if (!(base0 > 0.004)) { if (group.visible) { group.visible = false; return true; } return false; }
      group.visible = true; tick++;
      const order = hipsOrder(camera.fov, viewH || 700, { min: minOrder, max: maxOrder }), need = new Set();
      qi.copy(group.quaternion).invert();
      // rayos repartidos por la pantalla (y algo más allá del borde) → píxeles HEALPix que se ven
      for (let i = 0; i <= 10; i++) for (let j = 0; j <= 8; j++) {
        tmp.set((i / 10) * 2.2 - 1.1, (j / 8) * 2.2 - 1.1, 0.5).unproject(camera).sub(camera.position).normalize().applyQuaternion(qi);
        need.add(nestPix(order, tmp.x, tmp.y, tmp.z));
      }
      let pending = 0, again = false;
      for (const ipix of need) {
        const key = order + "/" + ipix; let t = tiles.get(key);
        if (!t) { t = { order, ipix, state: "wait", fade: 0, used: tick }; tiles.set(key, t); queue.push(key); }
        t.used = tick; if (t.state === "wait" || t.state === "load") pending++;
      }
      pump();
      // un mapa que no cubre todo el cielo (`needAll`) solo se enseña donde tiene TODAS las teselas de la vista
      if (needAll) {
        let miss = 0; for (const ipix of need) { const t = tiles.get(order + "/" + ipix); if (t && t.state === "no") miss++; }
        tmp.set(0, 0, 0.5).unproject(camera).sub(camera.position).normalize().applyQuaternion(qi);
        const bad = miss > 0 || inAvoid([tmp.x, tmp.y, tmp.z], avoid);
        const target = bad ? 0 : pending === 0 ? 1 : cov;
        if (cov !== target) { cov = target > cov ? Math.min(1, cov + 0.2) : Math.max(0, cov - 0.34); again = true; }
      }
      const gain = base0 * cov * (1 - under);
      // Cambio de nivel de detalle SIN salto de brillo: el nivel nuevo no se enseña hasta tener todas sus teselas; entonces
      // se cruza con el anterior (uno sube mientras el otro baja: la suma de luz no cambia). Como la luz se suma, enseñar
      // los dos a la vez daría el doble de brillo durante un momento.
      if (shownOrder == null) { shownOrder = order; xf = 1; }
      else if (order !== shownOrder && pending === 0) {
        prevOrder = shownOrder; shownOrder = order; xf = 0;
        for (const ipix of need) { const t = tiles.get(order + "/" + ipix); if (t && t.state === "ok") t.fade = 1; }   // entran con el cruce, no con su propia aparición
      }
      if (xf < 1) { xf = Math.min(1, xf + 0.25); again = true; if (xf === 1) prevOrder = null; }
      for (const [, t] of tiles) {
        if (t.state !== "ok") continue;
        const isCur = t.order === shownOrder, isPrev = prevOrder != null && t.order === prevOrder;
        // del nivel que se muestra: las que hacen falta ahora (o, si aún se espera al nivel nuevo, las que ya estaban a la vista)
        const want = isCur ? (order === shownOrder ? need.has(t.ipix) : t.fade > 0) : isPrev ? t.fade > 0 : false;
        if (want && isCur && t.fade < 1) { t.fade = Math.min(1, t.fade + 0.34); again = again || t.fade < 1; }
        if (!want) t.fade = 0;
        const kk = t.fade * (isCur ? (prevOrder != null ? xf : 1) : 1 - xf);
        t.mesh.visible = kk > 0.003; t.mat.uniforms.k.value = kk * gain;
      }
      if (tiles.size > maxTiles) {
        const old = [...tiles].filter(([, t]) => t.state !== "load" && tick - t.used > 3).sort((a, b) => a[1].used - b[1].used);
        for (const [key] of old.slice(0, tiles.size - maxTiles)) drop(key);
      }
      return again || pending > 0;
    },
    dispose() { for (const key of [...tiles.keys()]) drop(key); queue = []; },
  };
}
