// cometLayer.js — los cometas dibujados como cometas: una coma difusa y, si están cerca del Sol, la cola; y la órbita
// del cometa elegido. La geometría sale de cometSky.js: la cola apunta en sentido contrario al Sol (eso es exacto);
// su largo y su brillo son una estimación. Marco: el ecuatorial de las estrellas.
import * as THREE from "three";
import { cometView } from "./cometSky.js";

const glowTex = () => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.2, "rgba(200,240,255,0.7)"); gr.addColorStop(0.5, "rgba(150,220,255,0.2)"); gr.addColorStop(1, "rgba(150,220,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
};

export function createCometLayer({ radius = 884 } = {}) {
  const group = new THREE.Group();
  let tex = null, items = [], orbitLine = null, views = new Map();
  const add3 = (a, b, ka, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const clear = () => { for (const o of items) { group.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); } items = []; };

  /** Una cola: abanico que se ensancha y se apaga de la cabeza a la punta. `spread`: ancho final / largo. */
  const tailMesh = (head, end, alpha, color, spread, curl) => {
    const N = 28, pos = [], col = [], idx = [], side = unit(cross(head, end));
    const ang = Math.acos(Math.min(1, head[0] * end[0] + head[1] * end[1] + head[2] * end[2]));
    for (let i = 0; i <= N; i++) {
      const f = i / N, c = unit(add3(add3(head, end, 1 - f, f), side, 1, curl * f * f * ang)), w = ang * (0.012 + spread * f) * 0.5;
      const a = alpha * Math.pow(1 - f, 1.6) * (0.35 + 0.65 * Math.min(1, f * 8));
      for (const s of [-1, 0, 1]) { const p = unit(add3(c, side, 1, s * w)); pos.push(p[0] * radius, p[1] * radius, p[2] * radius); const k = s === 0 ? a : 0; col.push(color[0] * k, color[1] * k, color[2] * k); }
      if (i < N) { const b = i * 3; idx.push(b, b + 1, b + 3, b + 1, b + 4, b + 3, b + 1, b + 2, b + 4, b + 2, b + 5, b + 4); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }));
    m.renderOrder = 0.8; m.frustumCulled = false; return m;
  };

  return {
    group,
    /** `comets`: objetos de /api/comets; `orbits`: public/comet-orbits.json (.comets). Devuelve { nombre: vista } (cometView). */
    set(comets, orbits) {
      clear(); views = new Map();
      if (!tex && typeof document !== "undefined") tex = glowTex();
      for (const c of comets || []) {
        const el = orbits && orbits[c.name]; if (!el || !c.dist_au) continue;
        const dir = unit([c.nx, c.ny, c.nz]), ms = c.epoch ? Date.parse(c.epoch) : Date.now();
        const v = cometView(el, dir, c.dist_au, Number.isFinite(ms) ? ms : Date.now()); views.set(c.name, v);
        if (v.tail.len > 0 && v.tail.end) {
          // cola de gas (azulada, recta, estrecha) y cola de polvo (amarillenta, más ancha y algo curvada)
          const t1 = tailMesh(dir, v.tail.end, v.tail.alpha * 0.9, [0.55, 0.8, 1.0], 0.1, 0), t2 = tailMesh(dir, v.tail.end, v.tail.alpha * 0.6, [1.0, 0.9, 0.7], 0.32, 0.22);
          group.add(t1, t2); items.push(t1, t2);
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false, opacity: Math.min(1, 0.4 + v.tail.alpha) }));
          sp.position.set(dir[0] * radius, dir[1] * radius, dir[2] * radius); sp.scale.set(0.03, 0.03, 1); sp.renderOrder = 0.9; group.add(sp); items.push(sp);
        }
      }
      return views;
    },
    /** La órbita del cometa elegido (o null para quitarla). */
    showOrbit(name) {
      if (orbitLine) { group.remove(orbitLine); orbitLine.geometry.dispose(); orbitLine.material.dispose(); orbitLine = null; }
      const v = name && views.get(name); if (!v) return false;
      const pts = []; for (const p of v.orbit) pts.push(p[0] * radius, p[1] * radius, p[2] * radius);
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      orbitLine = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x8be0ff, transparent: true, opacity: 0.75, depthTest: false }));
      orbitLine.renderOrder = 0.7; orbitLine.frustumCulled = false; group.add(orbitLine);
      return true;
    },
    get views() { return views; },
  };
}
