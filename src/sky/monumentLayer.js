// monumentLayer.js — los monumentos (src/sky/monuments.js) en el cielo de «Mi cielo», en el marco local del
// horizonte (x = este, y = arriba, z = −norte), en 3D de verdad: la cámara está en el centro (los ojos del
// observador), así que cada arista recta se ve como se vería en el sitio. Si el monumento queda lejos, todo se
// escala por igual (los ángulos no cambian) para caber dentro de la esfera del cielo.
//
// Se dibuja después de las montañas, con prueba de profundidad solo entre sus propias caras (las demás capas no
// escriben profundidad), así que una cara tapa a la de detrás. Color: la piedra con la luz del Sol de ese momento
// (de noche, una silueta como las montañas).
import * as THREE from "three";
import { buildFaces, toLocal, offsetOf, EYE_M, apexOf, altAzOf } from "./monuments.js";
import { terrainPalette } from "./horizon.js";

const lin = (c) => [Math.pow(Math.max(0, c[0]), 2.2), Math.pow(Math.max(0, c[1]), 2.2), Math.pow(Math.max(0, c[2]), 2.2)];
const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
const MAX_R = 780;     // dentro de la esfera de las estrellas (870) y de las montañas (880)

/**
 * Lo que se dibuja para un lugar: [{ m, o, dz, faces }]. `bases`: { id: altura del suelo (m) bajo el
 * monumento }; `ground`: suelo del observador (m). Sin la altura de la base, el monumento no se dibuja.
 */
export function placeMonuments(list, { lat, lon, ground }, bases) {
  const out = [];
  for (const m of list || []) {
    const b = bases && bases[m.id];
    if (!Number.isFinite(b) || !Number.isFinite(ground)) continue;
    out.push({ m, o: offsetOf(lat, lon, m.lat, m.lon), dz: b - (ground + EYE_M), faces: buildFaces(m) });
  }
  return out;
}

/**
 * Nombre y punto más alto de cada monumento colocado: [{ id, name, ele_m, az, alt }]. Con la silueta (`sil`,
 * de monuments.silhouette), el nombre se apoya en lo más alto que se VE cerca de la cima (el borde delantero de
 * la plataforma de arriba queda más alto que su centro), no dentro de la cara.
 */
export function monumentLabels(items, lang = "es", sil = null, step = 0.2) {
  return (items || []).map(({ m, o, dz }) => {
    const v = toLocal(apexOf(m), o, dz), q = altAzOf(v);
    let alt = q.alt;
    if (sil && m.solid) {
      const n = sil.length, c = Math.round(q.az / step), w = Math.max(1, Math.round(1 / step));
      for (let j = c - w; j <= c + w; j++) alt = Math.max(alt, sil[((j % n) + n) % n]);
    }
    return { id: m.id, name: m.name[lang] || m.name.es, ele_m: Math.round(apexOf(m)[2]), az: q.az, alt, dist_km: o.d / 1000, monument: true };
  });
}

export function createMonumentLayer() {
  const group = new THREE.Group();
  let mesh = null, edges = null, items = [], enabledFlag = true;

  function clear() {
    if (mesh) { group.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh = null; }
    if (edges) { group.remove(edges); edges.geometry.dispose(); edges.material.dispose(); edges = null; }
  }

  function build(list) {
    clear();
    items = list || [];
    if (!items.length) return;
    // escala común: lo más lejano dentro de MAX_R (y nada más cerca que el plano de recorte de la cámara)
    let far = 1;
    const tri = [];
    for (const it of items) for (const f of it.faces) {
      const p = f.v.map((v) => toLocal(v, it.o, it.dz));
      for (const q of p) far = Math.max(far, Math.hypot(q[0], q[1], q[2]));
      tri.push({ p, f });
    }
    const k = Math.min(1, MAX_R / far);
    const pos = new Float32Array(tri.length * 9), col = new Float32Array(tri.length * 9);
    tri.forEach((t, i) => { for (let j = 0; j < 3; j++) pos.set([t.p[j][0] * k, t.p[j][1] * k, t.p[j][2] * k], i * 9 + j * 3); });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.userData.tri = tri;
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 1, depthTest: true, depthWrite: true, fog: false });
    mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = 2.8;        // después de las montañas (2,7…) y antes de sus líneas de filo no importa: están detrás
    mesh.frustumCulled = false;
    group.add(mesh);
    // las aristas (cuerpos, terrazas, piedras): una línea fina, como el filo de las montañas
    edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthTest: true, depthWrite: false, fog: false }));
    edges.renderOrder = 2.81;
    edges.frustumCulled = false;
    group.add(edges);
  }

  /** Colorea cada cara con la luz del Sol (st = skyState o null). */
  function paint(st) {
    if (!mesh) return;
    const pal = terrainPalette(st, 1), day = pal.day, night = pal.bands[0].top;
    const sd = st && st.sunDir ? st.sunDir : null;            // [este, arriba, −norte]
    const col = mesh.geometry.attributes.color.array, tri = mesh.geometry.userData.tri;
    tri.forEach((t, i) => {
      // normal de la cara (en el marco local, sin escala) mirando hacia el observador
      const [a, b, c] = t.p;
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
      if (nx * cx + ny * cy + nz * cz > 0) { nx = -nx; ny = -ny; nz = -nz; }
      const sun = sd && sd[1] > -0.02 ? Math.max(0, nx * sd[0] + ny * sd[1] + nz * sd[2]) : 0;
      const sky = 0.5 + 0.25 * Math.max(0, ny);                 // luz del cielo: más en las caras que miran arriba
      const lit = t.f.c.map((x) => Math.min(1, x * (sky * 0.75 + 0.75 * sun)));
      const nightC = mix(night, [0, 0, 0], 0.15 * (1 - Math.max(0, ny)));
      const cc = lin(mix(nightC, lit, day));
      for (let j = 0; j < 3; j++) col.set(cc, i * 9 + j * 3);
    });
    mesh.geometry.attributes.color.needsUpdate = true;
    if (edges) {
      const base = items[0] ? items[0].m.color : [0.6, 0.6, 0.6];
      edges.material.color.setRGB(...lin(mix(night.map((x) => x + 0.08), base.map((x) => x * 0.42), day)));
    }
  }

  return {
    group,
    set(list, st) { build(list); paint(st); group.visible = enabledFlag && !!mesh; },
    paint,
    setEnabled(b) { enabledFlag = !!b; group.visible = enabledFlag && !!mesh; },
    get items() { return items; },
    dispose() { clear(); if (group.parent) group.parent.remove(group); },
  };
}
