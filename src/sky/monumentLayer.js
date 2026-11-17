// monumentLayer.js — los monumentos (src/sky/monuments.js) en el cielo de «Mi cielo», en el marco local del
// horizonte (x = este, y = arriba, z = −norte), en 3D de verdad: la cámara está en el centro (los ojos del
// observador), así que cada arista recta se ve como se vería en el sitio. Si el monumento queda lejos, todo se
// escala por igual (los ángulos no cambian) para caber dentro de la esfera del cielo.
//
// Aspecto: texturas de piedra generadas en el navegador (monumentTextures.js) con relieve, luz del Sol del
// momento (dirección y color: blanca a mediodía, dorada al amanecer) y del cielo, y sombras propias (cada cuerpo
// de la pirámide hace sombra sobre el de abajo y sobre el suelo que la rodea). De noche, una silueta apenas
// iluminada por el cielo, como las montañas.
import * as THREE from "three";
import { buildFaces, toLocal, offsetOf, EYE_M, apexOf, altAzOf, groundPatch } from "./monuments.js";
import { terrainPalette } from "./horizon.js";
import { makeMonumentTexture } from "./monumentTextures.js";

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

const texCache = new Map();
function tex(kind) {
  if (!texCache.has(kind)) texCache.set(kind, makeMonumentTexture(kind, THREE));
  return texCache.get(kind);
}

function radialFade() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "#fff"); gr.addColorStop(0.62, "#fff"); gr.addColorStop(1, "#000");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function createMonumentLayer() {
  const group = new THREE.Group();
  let meshes = [], items = [], enabledFlag = true, k = 1;
  // luces solo para los monumentos (las demás capas usan materiales sin luz)
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  const sunTarget = new THREE.Object3D();
  sun.target = sunTarget;
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x6b5a45, 0);
  group.add(sun, sunTarget, hemi);
  let box = new THREE.Box3();

  function clear() {
    for (const m of meshes) { group.remove(m); m.geometry.dispose(); if (m.userData.ownMap && m.material.map) m.material.map.dispose(); m.material.dispose(); }
    meshes = [];
  }

  function build(list) {
    clear();
    items = list || [];
    if (!items.length) return;
    let far = 1;
    for (const it of items) for (const f of it.faces) for (const v of f.v) { const q = toLocal(v, it.o, it.dz); far = Math.max(far, Math.hypot(q[0], q[1], q[2])); }
    k = Math.min(1, MAX_R / far);
    box = new THREE.Box3();
    // una malla por material
    const byMat = new Map();
    for (const it of items) for (const f of it.faces) {
      const mat = f.mat || it.m.mat || "basalt";
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push({ f, it });
    }
    for (const [mat, list2] of byMat) {
      const T = tex(mat), n = list2.length;
      const pos = new Float32Array(n * 9), nor = new Float32Array(n * 9), uv = new Float32Array(n * 6), col = new Float32Array(n * 9);
      list2.forEach(({ f, it }, i) => {
        const { n: nn, uv: tuv } = faceUV(f.v, T.tile);
        for (let j = 0; j < 3; j++) {
          const q = toLocal(f.v[j], it.o, it.dz);
          pos.set([q[0] * k, q[1] * k, q[2] * k], i * 9 + j * 3);
          nor.set([nn[0], nn[2], -nn[1]], i * 9 + j * 3);       // (E, N, U) → (x, y, z) = (E, U, −N)
          uv.set(tuv[j], i * 6 + j * 2);
          const t = mat === "door" ? 1 : toneAt(f.v[j]);
          col.set([t, t * 0.985, t * 0.97], i * 9 + j * 3);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.computeBoundingBox(); box.union(g.boundingBox);
      const material = new THREE.MeshStandardMaterial({ map: T.map, bumpMap: T.bump, vertexColors: true, bumpScale: mat === "steps" ? 3 : 1.6, roughness: mat === "casing" ? 0.7 : 0.93, metalness: 0,
        side: THREE.DoubleSide, shadowSide: THREE.BackSide, transparent: true, opacity: 1, depthTest: true, depthWrite: true, fog: false });
      const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.renderOrder = 10;               // lo último: delante del Sol, la Luna, las nubes y las montañas (2,5–2,7)
      mesh.frustumCulled = false;
      meshes.push(mesh); group.add(mesh);
    }
    // el suelo que rodea cada monumento: recibe su sombra y se funde con el cielo hacia fuera
    const fade = radialFade();
    for (const it of items) {
      // hasta los pies del observador si está cerca (la explanada que pisa), para que no quede un hueco oscuro
      const gp = groundPatch(it.m), T = tex(gp.mat), R = it.o.d < 800 ? Math.max(gp.radius, it.o.d + 60) : gp.radius;
      const map = T.map.clone(); map.needsUpdate = true; map.repeat.set((2 * R) / T.tile, (2 * R) / T.tile);
      const q = toLocal([0, 0, -0.05], it.o, it.dz);
      const g = new THREE.CircleGeometry(R * k, 64); g.rotateX(-Math.PI / 2); g.translate(q[0] * k, q[1] * k, q[2] * k);
      const material = new THREE.MeshStandardMaterial({ map, alphaMap: fade, roughness: 1, metalness: 0, transparent: true, depthWrite: false, depthTest: true, fog: false });
      const mesh = new THREE.Mesh(g, material);
      mesh.receiveShadow = true; mesh.renderOrder = 9.9; mesh.frustumCulled = false; mesh.userData.ownMap = true;
      meshes.push(mesh); group.add(mesh);
    }
    // la cámara de sombras abarca los monumentos
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2 + 5 * k;
    sunTarget.position.copy(c);
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.1, far: r * 4 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.25 * k;
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
      sun.color.setRGB(1, 0.93 - 0.25 * low, 0.84 - 0.45 * low);
      sun.intensity = 3.2 * sunUp;
      sun.castShadow = true;
    } else { sun.intensity = 0; sun.castShadow = false; }
    const sky = st && st.colors ? st.colors.horizon : [0.1, 0.11, 0.17];
    hemi.color.setRGB(0.55 + 0.45 * sky[0], 0.6 + 0.4 * sky[1], 0.7 + 0.3 * sky[2]);
    hemi.groundColor.setRGB(0.42, 0.36, 0.3);
    // de noche, casi a oscuras (como la silueta de las montañas); de día, el cielo aclara las caras en sombra
    hemi.intensity = 0.09 + 1.15 * day;
  }

  return {
    group,
    set(list, st) { build(list); paint(st); group.visible = enabledFlag && meshes.length > 0; },
    paint,
    setEnabled(b) { enabledFlag = !!b; group.visible = enabledFlag && meshes.length > 0; },
    get items() { return items; },
    dispose() { clear(); if (group.parent) group.parent.remove(group); },
  };
}
