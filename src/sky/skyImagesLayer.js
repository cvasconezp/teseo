// skyImagesLayer.js — fotos reales de objetos de cielo profundo (galaxias, nebulosas, cúmulos) dibujadas en el
// cielo, en su sitio, a su tamaño real y con su orientación real, y el recuadro (a tamaño real) de los campos
// profundos del Hubble y del Webb.
//
// Imágenes: recortes de los cartografiados SDSS (luz visible; CC BY) y 2MASS (infrarrojo cercano; dominio
// público), hechos con scripts/build_deepsky_images.py: proyección gnomónica centrada en el objeto, norte arriba
// y este a la izquierda. La lista está en public/deepsky-images.json; las imágenes, en public/textures/deepsky/.
// Marco: el ecuatorial de las estrellas (x → AR 0 h, y → AR 6 h, z → polo norte).
import * as THREE from "three";
import { raDecToVec } from "./guides.js";

/**
 * Las cuatro esquinas (vectores unitarios) de un recorte gnomónico de lado `sizeDeg` centrado en (ra, dec), en el
 * orden [arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda] de la imagen (norte arriba, este a la
 * izquierda).
 */
export function tanCorners(raDeg, decDeg, sizeDeg) {
  const c = raDecToVec(raDeg, decDeg), a = raDeg * Math.PI / 180, d = decDeg * Math.PI / 180;
  const east = [-Math.sin(a), Math.cos(a), 0], north = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  const h = Math.tan((sizeDeg / 2) * Math.PI / 180);
  const P = (x, y) => { const v = [c[0] + east[0] * x * h + north[0] * y * h, c[1] + east[1] * x * h + north[1] * y * h, c[2] + east[2] * x * h + north[2] * y * h], n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };
  return [P(1, 1), P(-1, 1), P(-1, -1), P(1, -1)];
}

/**
 * Esquinas (vectores unitarios) de una imagen de agencia: rectángulo de w × h minutos de arco centrado en (ra,
 * dec), con el norte `north` grados a la izquierda (antihorario) de la vertical de la imagen. Orden: arriba-izquierda,
 * arriba-derecha, abajo-derecha, abajo-izquierda de la imagen.
 */
export function imageCorners(raDeg, decDeg, wArcmin, hArcmin, north) {
  const c = raDecToVec(raDeg, decDeg), a = raDeg * Math.PI / 180, d = decDeg * Math.PI / 180, t = north * Math.PI / 180;
  const E = [-Math.sin(a), Math.cos(a), 0], N = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  // en la imagen: arriba = cos·N − sen·E; derecha = −sen·N − cos·E (con el norte arriba, el este queda a la izquierda)
  const up = [0, 1, 2].map((i) => Math.cos(t) * N[i] - Math.sin(t) * E[i]), right = [0, 1, 2].map((i) => -Math.sin(t) * N[i] - Math.cos(t) * E[i]);
  const hx = Math.tan((wArcmin / 120) * Math.PI / 180), hy = Math.tan((hArcmin / 120) * Math.PI / 180);
  const P = (x, y) => { const v = [0, 1, 2].map((i) => c[i] + right[i] * x * hx + up[i] * y * hy), n = Math.hypot(v[0], v[1], v[2]); return v.map((q) => q / n); };
  return [P(-1, 1), P(1, 1), P(1, -1), P(-1, -1)];
}

/** Clave de agencia ("messier:31", "caldwell:65"…) del recorte de cartografiado con ese id, o null. */
export const surveyKey = (id) => { const m = /^m(\d+)$/.exec(id); return m ? "messier:" + m[1] : ({ ngc253: "caldwell:65", jewelbox: "caldwell:94" })[id] || null; };

const CDN = { "esa-webb": "https://cdn.esawebb.org/archives/images/screen/", "esa-hubble": "https://cdn.esahubble.org/archives/images/screen/", eso: "https://cdn.eso.org/images/screen/" };

export function createSkyImagesLayer({ radius = 893, onLoad = null, fetchImpl = (typeof fetch !== "undefined" ? fetch : null) } = {}) {
  const group = new THREE.Group();
  const mats = [];
  let level = 1, on = true, dark = 1, eff = 1;
  const loader = new THREE.TextureLoader();
  const apply = () => { eff = Math.max(eff, level); for (const m of mats) m.color.setScalar(eff); group.visible = on && (level > 0.004 || dark > 0.004); };
  const addImage = (o) => {
    const cs = tanCorners(o.ra, o.dec, o.size), pos = new Float32Array(12);
    cs.forEach((v, i) => pos.set([v[0] * radius, v[1] * radius, v[2] * radius], i * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const tex = loader.load(`/textures/deepsky/${o.id}.webp`, () => { if (onLoad) onLoad(); });
    tex.colorSpace = THREE.SRGBColorSpace;
    // suma luz sin tocar la transparencia del lienzo, como la Vía Láctea
    const m = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    mats.push(m);
    { const k = surveyKey(o.id); if (k) surveyByKey.set(k, { m, size: o.size }); }
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -4; mesh.frustumCulled = false; group.add(mesh);
  };
  const addFrame = (o) => {
    const cs = tanCorners(o.ra, o.dec, o.size_arcmin / 60), pts = [];
    for (const v of [...cs, cs[0]]) pts.push(v[0] * radius, v[1] * radius, v[2] * radius);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthTest: false }));
    line.renderOrder = 0.5; line.frustumCulled = false; group.add(line);
  };
  if (fetchImpl) {
    fetchImpl("/deepsky-images.json").then((r) => r.json()).then((d) => { for (const o of d.objects || []) addImage(o); apply(); if (onLoad) onLoad(); }).catch(() => { /* sin fotos: quedan los puntos */ });
    fetchImpl("/deepfields.json").then((r) => r.json()).then((d) => { for (const o of d.objects || []) if (o.size_arcmin) addFrame(o); if (onLoad) onLoad(); }).catch(() => { /* sin recuadros */ });
  }
  // imágenes de agencia (ESA/Hubble, ESA/Webb, ESO): se descargan solo al acercarse a ellas
  const agency = [], surveyByKey = new Map(), fwd = new THREE.Vector3(), inv = new THREE.Quaternion();
  const FEATHER = { v: "varying vec2 vUv2;", f: "varying vec2 vUv2;" };
  const addAgency = (o) => {
    const cs = imageCorners(o.ra, o.dec, o.w, o.h, o.north), pos = new Float32Array(12);
    cs.forEach((v, i) => pos.set([v[0] * (radius - 1), v[1] * (radius - 1), v[2] * (radius - 1)], i * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    // los bordes de la imagen se funden con el cielo (sin esto se vería un rectángulo pegado)
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + FEATHER.v).replace("#include <begin_vertex>", "#include <begin_vertex>\nvUv2 = uv;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + FEATHER.f)
        .replace("#include <map_fragment>", "#include <map_fragment>\n{ vec2 e = smoothstep(0.0, 0.07, vUv2) * smoothstep(0.0, 0.07, 1.0 - vUv2); diffuseColor.rgb *= e.x * e.y; }");
    };
    m.customProgramCacheKey = () => "teseo-skyimage-v1";
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -3; mesh.frustumCulled = false; mesh.visible = false; group.add(mesh);
    const c = raDecToVec(o.ra, o.dec);
    agency.push({ o, mesh, m, c: new THREE.Vector3(c[0], c[1], c[2]), size: Math.max(o.w, o.h) / 60, state: 0, k: 0 });
  };
  if (fetchImpl) fetchImpl("/agency-sky.json").then((r) => r.json()).then((d) => { for (const o of d.images || []) if (CDN[o.agency] && o.w < 600) addAgency(o); if (onLoad) onLoad(); }).catch(() => { /* sin imágenes de agencia */ });
  /**
   * Cada cuadro: carga y muestra las imágenes de agencia que están en pantalla y ya se ven con tamaño suficiente
   * (más de ~90 px), y las hace aparecer poco a poco. Devuelve true si algo sigue cambiando.
   */
  const update = (camera, viewH) => {
    if (!group.visible) return false;
    // al acercarse se ve como por un telescopio: aunque el cielo sea claro (afueras, Luna), la foto sube de brillo
    // (hasta el 85 %) entre 25° y 8° de campo; de día o en el crepúsculo claro, no
    { const z = dark * 0.85 * Math.min(1, Math.max(0, (25 - camera.fov) / 17)), e2 = Math.max(level, z);
      if (Math.abs(e2 - eff) > 0.004) { eff = e2; for (const m of mats) m.color.setScalar(eff); } }
    if (!agency.length) return false;
    inv.copy(group.quaternion).invert();
    camera.getWorldDirection(fwd).applyQuaternion(inv);
    const fov = camera.fov, aspect = camera.aspect || 1, diag = (fov / 2) * Math.hypot(1, aspect);
    let busy = false;
    for (const a of agency) {
      const sep = Math.acos(Math.min(1, Math.max(-1, fwd.dot(a.c)))) * 180 / Math.PI, px = (a.size / fov) * viewH;
      const want = sep < diag + a.size && px > 90;
      if (want && a.state === 0) {
        a.state = 1;
        loader.load(CDN[a.o.agency] + encodeURIComponent(a.o.id) + ".jpg", (tex) => { tex.colorSpace = THREE.SRGBColorSpace; a.m.map = tex; a.m.needsUpdate = true; a.state = 2; if (onLoad) onLoad(); }, undefined, () => { a.state = 3; });
      }
      const target = want && a.state === 2 ? Math.min(1, (px - 90) / 140) : 0;
      if (Math.abs(target - a.k) > 0.002) { a.k += (target - a.k) * 0.18; busy = true; } else a.k = target;
      a.mesh.visible = a.k > 0.004; a.m.color.setScalar(a.k * eff * 0.8);
      // el recorte de cartografiado del mismo objeto se retira mientras se ve la imagen de agencia (si no, sumarían su luz), salvo que esta sea solo un trozo pequeño (M31)
      const sv = surveyByKey.get(a.o.key);
      if (sv && a.size >= 0.3 * sv.size) sv.m.color.setScalar(eff * (1 - a.k));
    }
    return busy;
  };
  return {
    group,
    update,
    get agencyCount() { return agency.length; },
    /** `v`: brillo a simple vista (0–1, según el cielo); `darkness`: 1 de noche, 0 de día (para el brillo «de telescopio»). */
    setIntensity(v, darkness = 1) { level = Math.min(1, Math.max(0, v)); dark = Math.min(1, Math.max(0, darkness)); eff = level; apply(); },
    setOn(b) { on = !!b; apply(); },
    get count() { return mats.length; },
  };
}
