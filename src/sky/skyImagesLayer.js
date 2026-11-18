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

export function createSkyImagesLayer({ radius = 893, onLoad = null, fetchImpl = (typeof fetch !== "undefined" ? fetch : null) } = {}) {
  const group = new THREE.Group();
  const mats = [];
  let level = 1, on = true;
  const loader = new THREE.TextureLoader();
  const apply = () => { for (const m of mats) m.color.setScalar(level); group.visible = on && level > 0.004; };
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
  return {
    group,
    setIntensity(v) { level = Math.min(1, Math.max(0, v)); apply(); },
    setOn(b) { on = !!b; apply(); },
    get count() { return mats.length; },
  };
}
