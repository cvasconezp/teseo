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
  minOrder: 3, maxOrder: 8,
  credit: "Digitized Sky Survey · STScI/NASA · color y HEALPix: CDS · servido por ESASky (ESA)",
};
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

/** Orden HiPS para que un píxel de tesela ocupe más o menos 1,5 píxeles de pantalla (campo vertical `fov`°, alto `H` px). */
export function hipsOrder(fov, H, { min = HIPS.minOrder, max = HIPS.maxOrder } = {}) {
  return Math.min(max, Math.max(min, Math.ceil(Math.log2((58.6 * H) / (512 * fov * 1.5)))));
}
export const tileUrl = (order, ipix, base = HIPS.base) => `${base}/Norder${order}/Dir${Math.floor(ipix / 10000) * 10000}/Npix${ipix}.jpg`;
/** Cuánto se ve el mapa según el campo: nada con más de `far`°, entero con menos de `near`°. */
export const hipsFade = (fov, far = 24, near = 14) => Math.min(1, Math.max(0, (far - fov) / (far - near)));

const VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
// se resta el fondo de la placa (un velo azulado) para que el cielo siga negro, y la luz se SUMA a lo que hay detrás
const FRAG = "uniform sampler2D map; uniform float k; varying vec2 vUv; void main(){ vec3 c = texture2D(map, vUv).rgb; c = max(c - vec3(0.006, 0.010, 0.018), 0.0) * 1.05; gl_FragColor = vec4(c * k, 1.0);\n#include <colorspace_fragment>\n}";

export function createHipsLayer({ radius = 896, onLoad = null, maxTiles = 110, parallel = 6 } = {}) {
  const group = new THREE.Group(); group.visible = false;
  const tiles = new Map();                       // "orden/pix" → { order, mesh, mat, state: "load"|"ok"|"no", fade, used }
  let on = true, dark = 1, active = 0, tick = 0, loading = 0, queue = [];
  const loader = typeof document !== "undefined" ? new THREE.TextureLoader() : null;
  if (loader) loader.setCrossOrigin("anonymous");
  const tmp = new THREE.Vector3(), qi = new THREE.Quaternion();

  const build = (order, ipix, tex) => {
    const { dirs, uvs, n } = tileGrid(order, ipix), pos = new Float32Array(dirs.length * 3), uv = new Float32Array(dirs.length * 2), idx = [];
    dirs.forEach((d, i) => { pos.set([d[0] * radius, d[1] * radius, d[2] * radius], i * 3); uv.set(uvs[i], i * 2); });
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, b = a + n + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, k: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = -5; mesh.frustumCulled = false; mesh.visible = false; group.add(mesh);
    return { mesh, mat };
  };
  const drop = (key) => { const t = tiles.get(key); if (!t) return; if (t.mesh) { group.remove(t.mesh); t.mesh.geometry.dispose(); if (t.mat.uniforms.map.value) t.mat.uniforms.map.value.dispose(); t.mat.dispose(); } tiles.delete(key); };
  const pump = () => {
    while (loading < parallel && queue.length) {
      const key = queue.shift(), t = tiles.get(key); if (!t || t.state !== "wait") continue;
      // si ya no hace falta (la vista se movió), no se pide
      if (tick - t.used > 2) { tiles.delete(key); continue; }
      t.state = "load"; loading++;
      loader.load(tileUrl(t.order, t.ipix), (tex) => {
        loading--; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        if (tiles.get(key) !== t) { tex.dispose(); pump(); return; }
        Object.assign(t, build(t.order, t.ipix, tex)); t.state = "ok"; t.fade = 0; if (onLoad) onLoad(); pump();
      }, undefined, () => { loading--; t.state = "no"; pump(); });
    }
  };

  return {
    group,
    get active() { return active; },
    get stats() { let ok = 0; for (const t of tiles.values()) if (t.state === "ok") ok++; return { tiles: tiles.size, ok, loading, queued: queue.length }; },
    setOn(v) { on = !!v; if (!on) { group.visible = false; active = 0; } },
    /** `darkness`: 1 de noche, 0 de día (de día no hay mapa). */
    setDarkness(v) { dark = Math.min(1, Math.max(0, v)); },
    /**
     * Una vez por actualización de la vista: decide qué teselas hacen falta, las pide y ajusta su brillo.
     * Devuelve true si hay que volver a dibujar (algo está apareciendo).
     */
    update(camera, viewH) {
      const gain = on && loader ? dark * hipsFade(camera.fov) * 0.9 : 0;
      active = gain > 0.004 ? hipsFade(camera.fov) : 0;
      if (!(gain > 0.004)) { if (group.visible) { group.visible = false; return true; } return false; }
      group.visible = true; tick++;
      const order = hipsOrder(camera.fov, viewH || 700), need = new Set();
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
      // mientras llegan las del orden actual siguen a la vista las que ya había (de otro orden); después se retiran
      for (const [key, t] of tiles) {
        if (t.state !== "ok") continue;
        const cur = t.order === order && need.has(t.ipix), keep = cur || (pending > 0 && tick - t.shown <= 1 && t.order !== order);
        if (cur || keep) t.shown = tick;
        const target = cur || keep ? 1 : 0;
        if (t.fade !== target) { t.fade = target > t.fade ? Math.min(1, t.fade + 0.34) : 0; again = again || t.fade !== target; }
        t.mesh.visible = t.fade > 0; t.mat.uniforms.k.value = t.fade * gain;
        if (!cur && !keep && key) t.shown = -9;
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
