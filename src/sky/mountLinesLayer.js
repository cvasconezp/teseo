// mountLinesLayer.js — las líneas de «Estacionar montura» pintadas en el suelo de la vista Cielo (three.js), en el
// marco local del horizonte (Y = cenit, −Z = norte, +X = este): norte–sur, este–oeste de los equinoccios y las
// direcciones de salida y puesta del Sol en los solsticios (mountAlign.groundLines).
//
// Una recta del suelo que pasa por el observador se ve, desde sus ojos, como medio círculo máximo: del nadir al
// horizonte en ese acimut. Cada línea es una cinta de ancho angular constante (sin el grosor fijo de 1 px de
// WebGL), dibujada encima del relieve (sin prueba de profundidad): es una guía, como las líneas de un plano.
import * as THREE from "three";

const D = Math.PI / 180;
const STYLE = {
  ns: { color: 0xffffff, half: 0.22, opacity: 0.92 },
  eq: { color: 0xef9f27, half: 0.17, opacity: 0.9 },
  sol: { color: 0xf0997b, half: 0.12, opacity: 0.85, dash: 2.2 },   // grados de altura por trazo
};

/** Vértices de una cinta del nadir al horizonte en el acimut `az` (grados), de semiancho `half` (grados). */
export function ribbon(az, half, radius = 870, { from = -89.2, to = -0.25, step = 0.6, dash = 0 } = {}) {
  const pos = [], idx = [];
  const dh = [Math.sin(az * D), 0, -Math.cos(az * D)], side = [Math.cos(az * D), 0, Math.sin(az * D)], t = Math.tan(half * D);
  const at = (alt, s) => {
    const c = Math.cos(alt * D), sn = Math.sin(alt * D);
    const v = [c * dh[0] + s * t * side[0], sn, c * dh[2] + s * t * side[2]];
    const l = Math.hypot(v[0], v[1], v[2]);
    return [radius * v[0] / l, radius * v[1] / l, radius * v[2] / l];
  };
  let k = 0;
  for (let a = from; a < to - 1e-9; a += step) {
    const b = Math.min(to, a + step);
    if (dash && Math.floor((a - from) / dash) % 2 === 1) continue;
    pos.push(...at(a, -1), ...at(a, 1), ...at(b, -1), ...at(b, 1));
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    k += 4;
  }
  return { pos: new Float32Array(pos), idx };
}

export function createMountLines({ radius = 870 } = {}) {
  const group = new THREE.Group();
  group.name = "mount-lines";
  group.visible = false;
  let meshes = [], last = null, scale = 1;
  const clear = () => { for (const m of meshes) { m.geometry.dispose(); m.material.dispose(); group.remove(m); } meshes = []; };
  return {
    group,
    /** lines: groundLines(lat) o null para quitarlas; `to` (grados) alarga una línea hasta el filo del horizonte. */
    set(lines) {
      last = lines;
      clear();
      if (!lines || !lines.length) { group.visible = false; return; }
      for (const l of lines) {
        const st = STYLE[l.kind] || STYLE.sol, r = ribbon(l.az, st.half * scale, radius, { dash: st.dash || 0, ...(Number.isFinite(l.to) ? { to: l.to } : {}) });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(r.pos, 3));
        g.setIndex(r.idx);
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: st.opacity, side: THREE.DoubleSide, depthTest: false, depthWrite: false, fog: false }));
        m.renderOrder = 2.96;                 // sobre el suelo, las franjas, el relieve 3D y los monumentos
        m.frustumCulled = false;
        meshes.push(m); group.add(m);
      }
      group.visible = true;
    },
    /**
     * Ancho según el zoom (fov vertical de la cámara, grados): el ancho angular es fijo, así que con zoom la línea
     * engordaría. Se rehace solo si el zoom cambió más de un 20 %.
     */
    setFov(fov) {
      const k = Math.min(1.4, Math.max(0.08, fov / 70));
      if (Math.abs(Math.log(k / scale)) < 0.18) return;
      scale = k;
      if (last) this.set(last);
    },
    dispose() { clear(); if (group.parent) group.parent.remove(group); },
  };
}
