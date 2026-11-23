// depthView.js — «Constelaciones en profundidad real»: la constelación elegida sola, en su sitio en el espacio, vista
// desde la Tierra (0°) y girando hasta verla de costado (90°). Escena three.js propia: mientras está activa se dibuja
// en lugar del cielo (sin el fondo de estrellas ni nombres ajenos).
//
// Geometría (depthLayout, pura): el Sol en el origen; cada estrella en su dirección (J2000) a su distancia. Con
// profundidad comprimida ×k, la componente a lo largo de la mirada media (c) se divide entre k y la transversal se
// conserva (como en los diagramas «de costado»: si no, Orión de lado es una aguja de 190 por 2000 años luz). La
// compresión crece con el giro (1 a 0°, k a 90°): desde la Tierra la figura es exactamente la del cielo.
//
// Lo que se dibuja: «Tú (Sol)», las estrellas de la figura (color y brillo del catálogo), la figura (se desvanece al
// girar), las líneas de visión del Sol a cada estrella y las barras de error de la distancia (paralaje de Hipparcos,
// 1σ) que aparecen al girar, el eje de años luz y los objetos de cielo profundo de la constelación con distancia.
import * as THREE from "three";

const LY_PER_MAS = 3261.5638;          // d (años luz) = 3261,5638 / paralaje (mas)
const SPAN = 400;                      // unidades de escena que ocupa la profundidad comprimida (la cámara de OrbitControls no pasa de 3000)

/** Distancia (años luz) → intervalo a 1σ con el error de la paralaje (mas): [dMin, dMax] (dMax null: sin cota). */
export function distRange(d, ePlx) {
  if (!(d > 0) || !(ePlx > 0)) return null;
  const p = LY_PER_MAS / d;
  return [LY_PER_MAS / (p + ePlx), p > ePlx ? LY_PER_MAS / (p - ePlx) : null];
}

/** Paso «bonito» del eje (1, 2 o 5 × 10ⁿ) para unas 3–6 marcas hasta `max`. */
export function niceStep(max) {
  const raw = max / 4, e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
}

/** Compresión efectiva con el giro: 1 de frente (0°), k de costado (90°). a01: 0..1. */
export const kAt = (k, a01) => 1 + (k - 1) * Math.pow(Math.sin((a01 * Math.PI) / 2), 2);

/**
 * Coloca los puntos. items: [{ dir: [x,y,z] (unitario), d (años luz) }]; dirC: dirección media (o null: la media de
 * las direcciones); k: compresión efectiva. Devuelve { c, s (unidades por año luz transversal), maxD, at(dir, d) }.
 */
export function depthLayout(items, k = 1, dirC = null) {
  let c = dirC;
  if (!c) {
    let x = 0, y = 0, z = 0;
    for (const it of items) { x += it.dir[0]; y += it.dir[1]; z += it.dir[2]; }
    const n = Math.hypot(x, y, z) || 1; c = [x / n, y / n, z / n];
  }
  let maxD = 0;
  for (const it of items) if (it.d > maxD) maxD = it.d;
  const s = (SPAN * k) / Math.max(1, maxD);
  const at = (dir, d) => {
    const al = d * (dir[0] * c[0] + dir[1] * c[1] + dir[2] * c[2]);
    const tx = d * dir[0] - al * c[0], ty = d * dir[1] - al * c[1], tz = d * dir[2] - al * c[2];
    return [s * (al / k * c[0] + tx), s * (al / k * c[1] + ty), s * (al / k * c[2] + tz)];
  };
  return { c, s, maxD, at };
}

/**
 * Compresión automática para la vista de costado: que el fondo (del Sol a la estrella principal más lejana) quede
 * unas 1,3 veces el ancho de la figura. Entre 2 y 20, entera. items: [{ dir, d }]; c: dirección media.
 */
export function autoK(items, c) {
  let maxAl = 0, maxT = 0;
  for (const it of items) {
    const al = it.d * (it.dir[0] * c[0] + it.dir[1] * c[1] + it.dir[2] * c[2]);
    const t = Math.sqrt(Math.max(0, it.d * it.d - al * al));
    if (al > maxAl) maxAl = al; if (t > maxT) maxT = t;
  }
  if (!(maxT > 0)) return 2;
  return Math.max(2, Math.min(20, Math.round(maxAl / (1.3 * 2 * maxT))));
}

/** Las estrellas «principales» de una figura: las `n` más brillantes (todas, si hay menos). */
export function mainStars(stars, n = 8) {
  return new Set([...stars].sort((a, b) => a.mag - b.mag).slice(0, n).map((s) => s.key));
}

function dotTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,255,255,0.9)"); r.addColorStop(0.6, "rgba(255,255,255,0.25)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); return t;
}

export function createDepthView() {
  const scene = new THREE.Scene();
  const tex = dotTexture();
  let data = null, objs = [], view = { a: 0, k: 7, mainOnly: true }, layout = null, active = false;
  const clear = () => { for (const o of objs) { o.geometry.dispose(); o.material.dispose(); scene.remove(o); } objs = []; };
  const add = (o) => { objs.push(o); scene.add(o); return o; };

  function rebuild() {
    clear();
    if (!data) return;
    const a = view.a, k = kAt(view.k, a);
    const all = [...data.stars, ...data.dso];
    layout = depthLayout(all, k, data.c);
    const at = layout.at, show = (st) => !view.mainOnly || data.main.has(st.key);
    // estrellas: tamaño por brillo, color del catálogo; las que no son principales, más tenues al girar
    const P = [], C = [], S = [];
    for (const st of data.stars) {
      const p = at(st.dir, st.d); P.push(...p);
      const f = show(st) ? 1 : 1 - 0.6 * a;
      C.push(st.color[0] * f, st.color[1] * f, st.color[2] * f);
      S.push(Math.max(5, 15 - 2.4 * st.mag));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute("size", new THREE.Float32BufferAttribute(S, 1));
    const pm = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uPx: { value: data.px || 1 } },
      vertexShader: "attribute float size; varying vec3 vC; uniform float uPx; void main(){ vC = color; gl_PointSize = size * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform sampler2D map; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a); }",
      vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const pts = add(new THREE.Points(g, pm)); pts.renderOrder = 5;
    // la figura: se desvanece al girar (de costado sus líneas ya no dibujan nada reconocible)
    const fig = [];
    for (const [i, j] of data.lines) fig.push(...at(data.stars[i].dir, data.stars[i].d), ...at(data.stars[j].dir, data.stars[j].d));
    if (fig.length) {
      const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(fig, 3));
      const lf = add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xb4a7ff, transparent: true, opacity: 0.75 * (1 - a) + 0.08, depthTest: false })));
      lf.renderOrder = 3;
    }
    // líneas de visión y barras de error: aparecen al girar
    if (a > 0.02) {
      const sl = [], eb = [];
      for (const st of [...data.stars, ...data.dso]) {
        if (st.dso ? false : !show(st)) continue;
        sl.push(0, 0, 0, ...at(st.dir, st.d));
        if (st.range) {
          const d1 = st.range[1] == null ? Math.max(st.d * 1.6, layout.maxD * 1.1) : st.range[1];
          eb.push(...at(st.dir, st.range[0]), ...at(st.dir, d1));
        }
      }
      const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(sl, 3));
      add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xdfe3f5, transparent: true, opacity: 0.42 * a, depthTest: false }))).renderOrder = 2;
      if (eb.length) {
        // la barra: una cinta corta y ancha (en unidades de la escena, perpendicular a la línea y a la vista lateral)
        const eg = new THREE.BufferGeometry(); eg.setAttribute("position", new THREE.Float32BufferAttribute(eb, 3));
        add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85 * a, depthTest: false }))).renderOrder = 4;
      }
      // eje de años luz: del Sol a lo largo de la mirada media, con marcas
      const step = niceStep(layout.maxD), ax = [0, 0, 0, ...at(layout.c, layout.maxD * 1.05)];
      const up = Math.abs(layout.c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const tk = 6 / Math.max(1e-6, layout.s);   // marcas de ~6 unidades
      for (let d = step; d <= layout.maxD * 1.05; d += step) {
        const p = at(layout.c, d); ax.push(p[0] - up[0] * tk * layout.s, p[1] - up[1] * tk * layout.s, p[2] - up[2] * tk * layout.s, p[0] + up[0] * tk * layout.s, p[1] + up[1] * tk * layout.s, p[2] + up[2] * tk * layout.s);
      }
      const ag = new THREE.BufferGeometry(); ag.setAttribute("position", new THREE.Float32BufferAttribute(ax, 3));
      add(new THREE.LineSegments(ag, new THREE.LineBasicMaterial({ color: 0x6f78a8, transparent: true, opacity: 0.8 * a, depthTest: false }))).renderOrder = 1;
    }
    // el Sol y los objetos de cielo profundo
    const sp = new THREE.BufferGeometry();
    const sunAndDso = [0, 0, 0], sc = [1, 0.92, 0.66], ss = [11];
    for (const o of data.dso) { sunAndDso.push(...at(o.dir, o.d)); sc.push(1, 0.45, 0.5); ss.push(9); }
    sp.setAttribute("position", new THREE.Float32BufferAttribute(sunAndDso, 3));
    sp.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3));
    sp.setAttribute("size", new THREE.Float32BufferAttribute(ss, 1));
    const sun = add(new THREE.Points(sp, pm.clone())); sun.material.uniforms.map.value = tex; sun.renderOrder = 6;
  }

  return {
    scene,
    get active() { return active; },
    set active(v) { active = !!v; },
    /**
     * stars: [{ key, name, dir, d, mag, color: [r,g,b], ePlx, si }]; lines: [[i, j]] (índices en stars); dso: [{ name,
     * dir, d }]; px: escala de píxeles. Las estrellas sin distancia fiable (≥ 100 000 a. l.) se dejan fuera.
     */
    setData({ stars, lines, dso = [], px = 1 }) {
      const keep = stars.map((s) => s.d > 0 && s.d < 100000);
      const idx = new Map(); const st = [];
      stars.forEach((s, i) => { if (keep[i]) { idx.set(i, st.length); st.push({ ...s, range: distRange(s.d, s.ePlx) }); } });
      const ln = lines.filter(([i, j]) => idx.has(i) && idx.has(j)).map(([i, j]) => [idx.get(i), idx.get(j)]);
      let x = 0, y = 0, z = 0;
      for (const s of st) { x += s.dir[0]; y += s.dir[1]; z += s.dir[2]; }
      const n = Math.hypot(x, y, z) || 1;
      const maxStar = st.reduce((m, s) => Math.max(m, s.d), 0);
      data = { stars: st, lines: ln, dso: dso.filter((o) => o.d > 0 && o.d <= Math.max(2000, maxStar * 1.5)).map((o) => ({ ...o, dso: true })),
        c: [x / n, y / n, z / n], main: mainStars(st), px };
      data.autoK = autoK(st.filter((s) => data.main.has(s.key)), data.c);
      rebuild();
    },
    setView({ a = view.a, k = view.k, mainOnly = view.mainOnly } = {}) {
      if (a === view.a && k === view.k && mainOnly === view.mainOnly) return;
      view = { a, k, mainOnly }; rebuild();
    },
    get view() { return view; },
    /** La compresión que conviene a esta constelación (autoK de sus estrellas principales). */
    get autoK() { return data ? data.autoK : 7; },
    /** Centro (para la cámara) y tamaño de lo dibujado, en unidades de la escena. */
    frame() {
      if (!data || !layout) return null;
      // con «Solo principales», el encuadre es el de esas estrellas (las demás pueden quedar fuera)
      const vis = view.mainOnly ? data.stars.filter((s) => data.main.has(s.key)) : data.stars;
      const pts = [...vis.map((s) => layout.at(s.dir, s.d)), [0, 0, 0]];
      // el centro de la caja que lo contiene todo (la media se iría hacia donde hay más estrellas juntas)
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const p of pts) for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], p[q]); hi[q] = Math.max(hi[q], p[q]); }
      const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2, cz = (lo[2] + hi[2]) / 2;
      let r = 0; for (const p of pts) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz));
      // el centro de las estrellas (sin el Sol): la cámara de frente sale del Sol mirando hacia ellas
      const st = vis.map((s) => layout.at(s.dir, s.d));
      const sx = st.reduce((m, p) => m + p[0], 0) / st.length, sy = st.reduce((m, p) => m + p[1], 0) / st.length, sz = st.reduce((m, p) => m + p[2], 0) / st.length;
      return { center: [cx, cy, cz], radius: r, stars: [sx, sy, sz], c: layout.c };
    },
    /**
     * Nombres para el bucle de etiquetas (proyectados con la cámara): [{ x, y, name, sub, cls, si? }] y el eje.
     * T: textos { you, ly: (n) => "498 años luz", range: (a, b) => "…" }.
     */
    labels(camera, W, H, T) {
      if (!data || !layout) return [];
      const out = [], v = new THREE.Vector3(), a = view.a, at = layout.at;
      const proj = (p) => { v.set(p[0], p[1], p[2]).project(camera); if (v.z >= 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return null; return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; };
      const sun = proj([0, 0, 0]);
      if (sun && a > 0.05) out.push({ x: sun[0], y: sun[1], name: T.you, sub: null, cls: "solar", key: "dv:sun", left: true });
      const list = [...data.stars].sort((p, q) => p.mag - q.mag);
      for (const st of list) {
        if (!st.name || (view.mainOnly && !data.main.has(st.key) && a > 0.3)) continue;   // sin nombre propio: solo el punto
        const p = proj(at(st.dir, st.d)); if (!p) continue;
        const rng = st.range && a > 0.3 ? T.range(st.range[0], st.range[1]) : null;
        out.push({ x: p[0], y: p[1], name: st.name, sub: T.ly(st.d) + (rng ? ` ${rng}` : ""), cls: "star", si: st.si, key: "dv:" + st.key });
      }
      for (const o of data.dso) { const p = proj(at(o.dir, o.d)); if (p) out.push({ x: p[0], y: p[1], name: o.name, sub: T.ly(o.d), cls: "obj_messier", key: "dv:o:" + o.name }); }
      if (a > 0.3) {
        const step = niceStep(layout.maxD);
        for (let d = step; d <= layout.maxD * 1.05; d += step) { const p = proj(at(layout.c, d)); if (p) out.push({ x: p[0], y: p[1] + 12, name: T.tick(d), sub: null, cls: "dvtick", key: "dv:t:" + d }); }
      }
      return out;
    },
    dispose() { clear(); tex.dispose(); },
  };
}
