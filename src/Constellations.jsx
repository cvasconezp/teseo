import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ─── i18n ──────────────────────────────────────────────────────────────
const TC = {
  en: {
    title: "Constellations in real depth",
    intro: "The stars of a constellation look like a flat drawing — but they sit at wildly different distances. Pick one and pull the slider to see its true 3D shape.",
    pick: "Constellation",
    all: "Whole sky",
    flat: "As seen from Earth",
    depth: "Real depth",
    lightyears: "light-years",
    away: "away",
    from: "Distance from Earth",
    dragHint: "Drag to orbit · scroll to zoom",
    note: "Star positions & distances: real (HYG / Hipparcos). 3D depth uses a logarithmic scale of the real distance so it stays viewable — the distances shown are the real ones.",
    loading: "Loading the real sky…",
    nearest: "Nearest", farthest: "Farthest", spread: "Depth spread",
  },
  es: {
    title: "Constelaciones en profundidad real",
    intro: "Las estrellas de una constelación parecen un dibujo plano — pero están a distancias muy distintas. Elige una y mueve el control para ver su forma 3D real.",
    pick: "Constelación",
    all: "Todo el cielo",
    flat: "Como se ve desde la Tierra",
    depth: "Profundidad real",
    lightyears: "años luz",
    away: "de distancia",
    from: "Distancia desde la Tierra",
    dragHint: "Arrastra para girar · rueda para acercar",
    note: "Posiciones y distancias estelares: reales (HYG / Hipparcos). La profundidad 3D usa una escala logarítmica de la distancia real para que sea visualizable — las distancias mostradas son las reales.",
    loading: "Cargando el cielo real…",
    nearest: "Más cercana", farthest: "Más lejana", spread: "Rango de profundidad",
  },
};

const FLAT_R = 900;
const BG_R = 1000;
function depthRadius(d) {
  if (!d || d <= 0) return FLAT_R;
  const dd = Math.min(d, 4000);
  const r = 50 + 13 * Math.sqrt(dd);   // raíz cuadrada: más cerca = más cerca, spread visible
  return Math.max(60, Math.min(1000, r));
}
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function Constellations({ lang = "es" }) {
  const t = TC[lang];
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [sky, setSky] = useState(null);
  const [sel, setSel] = useState(null);      // abbr or null
  const [depth, setDepth] = useState(0);     // 0..1
  const [labels, setLabels] = useState([]);  // projected labels
  const depthRef = useRef(0);
  const selRef = useRef(null);

  useEffect(() => { depthRef.current = depth; }, [depth]);
  useEffect(() => { selRef.current = sel; }, [sel]);

  // Load data
  useEffect(() => {
    fetch("/sky.json").then(r => r.json()).then(setSky).catch(() => {});
  }, []);

  // Build scene once data is ready
  useEffect(() => {
    if (!sky || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth, H = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04080f, 0.00018);
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 6000);
    camera.position.set(0, 0, 1700);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 50;
    controls.maxDistance = 3000;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.15;

    // index stars by hip
    const byHip = new Map();
    sky.stars.forEach(s => byHip.set(s[0], s));
    const asterHips = new Set();
    sky.constellations.forEach(c => c.lines.forEach(p => p.forEach(h => asterHips.add(h))));

    // ── background + asterism star points ──
    const N = sky.stars.length;
    const posFlat = new Float32Array(N * 3);
    const posDeep = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const hipIndex = new Map();
    sky.stars.forEach((s, i) => {
      const [hip, nx, ny, nz, mag, hex, dist] = s;
      hipIndex.set(hip, i);
      const rf = FLAT_R, rd = depthRadius(dist);
      posFlat[i*3] = nx*rf; posFlat[i*3+1] = ny*rf; posFlat[i*3+2] = nz*rf;
      posDeep[i*3] = nx*rd; posDeep[i*3+1] = ny*rd; posDeep[i*3+2] = nz*rd;
      let [r,g,b] = hexToRgb(hex);
      const isAster = asterHips.has(hip);
      let bright = Math.max(0.16, Math.min(1, 1.5 - mag * 0.16));
      if (isAster) bright = Math.max(bright, 0.85);
      colors[i*3]=r*bright; colors[i*3+1]=g*bright; colors[i*3+2]=b*bright;
      sizes[i] = isAster ? Math.max(3.0, 9.5 - mag * 0.8) : Math.max(0.8, 5.2 - mag * 0.62);
    });
    const sGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(posFlat.slice(), 3);
    sGeo.setAttribute("position", posAttr);
    sGeo.setAttribute("scolor", new THREE.BufferAttribute(colors, 3));
    sGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const starTex = makeStarTexture();
    const sMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: starTex } },
      vertexShader: [
        "attribute float size;",
        "attribute vec3 scolor;",
        "varying vec3 vColor;",
        "void main(){",
        "  vColor = scolor;",
        "  vec4 mv = modelViewMatrix * vec4(position,1.0);",
        "  gl_PointSize = clamp(size * (520.0 / -mv.z), 0.6, 16.0);",
        "  gl_Position = projectionMatrix * mv;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D map;",
        "varying vec3 vColor;",
        "void main(){",
        "  vec4 t = texture2D(map, gl_PointCoord);",
        "  if (t.a < 0.02) discard;",
        "  gl_FragColor = vec4(vColor, 1.0) * t;",
        "}",
      ].join("\n"),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(sGeo, sMat);
    scene.add(points);

    // ── constellation lines ──
    const segHips = []; // pairs of hip
    const conMeta = {};
    sky.constellations.forEach(c => {
      conMeta[c.ab] = c;
      c.lines.forEach(poly => {
        for (let k = 0; k < poly.length - 1; k++) {
          if (hipIndex.has(poly[k]) && hipIndex.has(poly[k+1]))
            segHips.push([poly[k], poly[k+1], c.ab]);
        }
      });
    });
    const L = segHips.length;
    const lPos = new Float32Array(L * 6);
    const lCol = new Float32Array(L * 6);
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3));
    lGeo.setAttribute("color", new THREE.BufferAttribute(lCol, 3));
    const lMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 });
    const lines = new THREE.LineSegments(lGeo, lMat);
    scene.add(lines);

    // earth marker
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x60a5fa })
    );
    scene.add(earth);

    sceneRef.current = { scene, camera, renderer, controls, points, lines,
      posFlat, posDeep, posAttr, segHips, hipIndex, conMeta, lPos, lCol, byHip, sizes, N };

    // resize
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // animation
    let raf;
    const tmp = new THREE.Vector3();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const ref = sceneRef.current; if (!ref) return;
      const dpt = depthRef.current;
      const selAb = selRef.current;
      // lerp star positions flat<->deep
      const pa = ref.posAttr.array;
      for (let i = 0; i < ref.N * 3; i++) pa[i] = ref.posFlat[i] + (ref.posDeep[i] - ref.posFlat[i]) * dpt;
      ref.posAttr.needsUpdate = true;
      // update lines
      const selSet = selAb;
      for (let s = 0; s < ref.segHips.length; s++) {
        const [ha, hb, ab] = ref.segHips[s];
        const ia = ref.hipIndex.get(ha), ib = ref.hipIndex.get(hb);
        const hidden = selSet && ab !== selSet;
        if (hidden) {
          for (let q=0;q<6;q++) ref.lPos[s*6+q]=0;   // colapsar -> invisible
        } else {
          ref.lPos[s*6+0]=pa[ia*3]; ref.lPos[s*6+1]=pa[ia*3+1]; ref.lPos[s*6+2]=pa[ia*3+2];
          ref.lPos[s*6+3]=pa[ib*3]; ref.lPos[s*6+4]=pa[ib*3+1]; ref.lPos[s*6+5]=pa[ib*3+2];
        }
        let r,g,b;
        if (!selSet) { r=0.42;g=0.45;b=0.78; }
        else { r=0.70;g=0.58;b=1.0; }
        ref.lCol[s*6+0]=r; ref.lCol[s*6+1]=g; ref.lCol[s*6+2]=b;
        ref.lCol[s*6+3]=r; ref.lCol[s*6+4]=g; ref.lCol[s*6+5]=b;
      }
      ref.lines.geometry.attributes.position.needsUpdate = true;
      ref.lines.geometry.attributes.color.needsUpdate = true;
      ref.controls.update();
      ref.renderer.render(ref.scene, ref.camera);
      // project labels for selected constellation
      if (selAb && ref.conMeta[selAb]) {
        const named = collectNamed(ref.conMeta[selAb], ref.byHip);
        const w = mount.clientWidth, h = mount.clientHeight;
        const out = [];
        named.forEach(st => {
          const i = ref.hipIndex.get(st[0]);
          tmp.set(pa[i*3], pa[i*3+1], pa[i*3+2]).project(ref.camera);
          if (tmp.z < 1) out.push({
            hip: st[0], name: st[7], dist: st[6],
            x: (tmp.x*0.5+0.5)*w, y: (-tmp.y*0.5+0.5)*h,
          });
        });
        setLabels(out);
      } else if (labelsNonEmpty.current) { setLabels([]); labelsNonEmpty.current=false; }
      if (selAb) labelsNonEmpty.current = true;
    };
    const labelsNonEmpty = { current: false };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [sky]);

  // posiciona la cámara según la profundidad: 0 = vista desde la Tierra (plano),
  // 1 = vista lateral que REVELA la profundidad real en distancia.
  const positionCamera = useCallback((dpt) => {
    const ref = sceneRef.current;
    if (!ref || !ref.selCentroidDir) return;
    const v = ref.selCentroidDir;
    const targetR = FLAT_R + (ref.selAvgR - FLAT_R) * dpt;
    const target = v.clone().multiplyScalar(targetR);
    const up = Math.abs(v.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(v, up).normalize();
    const angle = dpt * Math.PI * 0.42;            // hasta ~75° de giro lateral
    const dist = 520 + 200 * dpt;
    const dir = v.clone().multiplyScalar(-Math.cos(angle))
      .add(side.multiplyScalar(Math.sin(angle))).normalize();
    ref.camera.position.copy(target.clone().add(dir.multiplyScalar(dist)));
    ref.controls.target.copy(target);
    ref.controls.update();
  }, []);

  // al cambiar de constelación
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    if (!sel) {
      ref.selCentroidDir = null;
      ref.controls.autoRotate = true;
      ref.controls.target.set(0, 0, 0);
      ref.camera.position.set(0, 0, 1700);
      ref.controls.update();
      return;
    }
    const c = ref.conMeta[sel]; if (!c) return;
    let cx=0,cy=0,cz=0,n=0,sumR=0,cnt=0;
    const seen=new Set();
    c.lines.forEach(p=>p.forEach(h=>{ if(!seen.has(h)){seen.add(h); const st=ref.byHip.get(h); if(st){cx+=st[1];cy+=st[2];cz+=st[3];n++; sumR+=depthRadius(st[6]); cnt++;}}}));
    if(n===0) return;
    ref.selCentroidDir = new THREE.Vector3(cx/n,cy/n,cz/n).normalize();
    ref.selAvgR = cnt ? sumR/cnt : FLAT_R;
    ref.controls.autoRotate = false;
    positionCamera(depthRef.current);
  }, [sel, positionCamera]);

  // al mover el slider de profundidad, gira la cámara para revelarla
  useEffect(() => {
    if (sel) positionCamera(depth);
  }, [depth, sel, positionCamera]);

  const onPick = useCallback((e) => {
    const v = e.target.value;
    setSel(v === "__all__" ? null : v);
    setDepth(0);   // siempre arranca en 'plano' y el usuario revela la profundidad
  }, []);

  const selMeta = sky && sel ? sky.constellations.find(c => c.ab === sel) : null;
  const stats = selMeta ? constellationStats(selMeta, sky) : null;

  return (
    <div className="relative w-full" style={{ height: 460 }}>
      <div ref={mountRef} className="absolute inset-0 rounded-2xl overflow-hidden"
        style={{ background: "radial-gradient(ellipse at center, #0a1020 0%, #04080f 80%)", border: "1px solid rgba(124,58,237,0.18)" }} />

      {!sky && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40"
          style={{ fontFamily: "Inter,system-ui", fontSize: 13 }}>{t.loading}</div>
      )}

      {/* labels */}
      {labels.map(l => (
        <div key={l.hip} className="absolute pointer-events-none"
          style={{ left: l.x, top: l.y, transform: "translate(8px,-50%)" }}>
          <div style={{ fontFamily: "Cormorant Garamond,Georgia,serif", color: "#fff", fontSize: 13, lineHeight: 1, textShadow: "0 1px 6px #000" }}>{l.name}</div>
          <div style={{ fontFamily: "JetBrains Mono,monospace", color: "#A78BFA", fontSize: 9, textShadow: "0 1px 6px #000" }}>{l.dist.toLocaleString()} {t.lightyears.split("-").join(" ")}</div>
        </div>
      ))}

      {/* top controls */}
      {sky && (
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto">
            <select value={sel || "__all__"} onChange={onPick}
              className="px-3 py-2 rounded-xl text-white text-sm outline-none"
              style={{ background: "rgba(9,14,28,0.9)", border: "1px solid rgba(124,58,237,0.4)", fontFamily: "Inter,system-ui", maxWidth: 200 }}>
              <option value="__all__">✦ {t.all}</option>
              {[...sky.constellations].sort((a,b)=>a.la.localeCompare(b.la)).map(c => (
                <option key={c.ab} value={c.ab}>{c.la} · {c.en}</option>
              ))}
            </select>
          </div>
          <div className="text-right text-white/30 pointer-events-none" style={{ fontFamily: "Inter,system-ui", fontSize: 9, maxWidth: 150 }}>
            {t.dragHint}
          </div>
        </div>
      )}

      {/* depth slider */}
      {sky && sel && (
        <div className="absolute bottom-3 left-3 right-3 pointer-events-auto">
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(9,14,28,0.92)", border: "1px solid rgba(124,58,237,0.3)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ color: depth < 0.5 ? "#60A5FA" : "rgba(255,255,255,0.4)", fontFamily: "Inter,system-ui", fontSize: 10 }}>{t.flat}</span>
              <span style={{ color: depth >= 0.5 ? "#A78BFA" : "rgba(255,255,255,0.4)", fontFamily: "Inter,system-ui", fontSize: 10 }}>{t.depth}</span>
            </div>
            <input type="range" min="0" max="1" step="0.01" value={depth}
              onChange={e => setDepth(parseFloat(e.target.value))}
              className="w-full" style={{ accentColor: "#7C3AED" }} />
            {stats && (
              <div className="flex items-center justify-between mt-1.5" style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                <span>{t.nearest}: {stats.near.name||"—"} {stats.near.d.toLocaleString()} {t.lightyears}</span>
                <span>{t.farthest}: {stats.far.name||"—"} {stats.far.d.toLocaleString()} {t.lightyears}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function collectNamed(c, byHip) {
  const seen = new Set(); const out = [];
  c.lines.forEach(p => p.forEach(h => {
    if (seen.has(h)) return; seen.add(h);
    const s = byHip.get(h);
    if (s && s[7]) out.push(s);
  }));
  out.sort((a, b) => a[4] - b[4]);
  return out.slice(0, 7);
}
function constellationStats(c, sky) {
  const byHip = new Map(); sky.stars.forEach(s => byHip.set(s[0], s));
  let near = { d: Infinity, name: "" }, far = { d: -1, name: "" };
  const seen = new Set();
  c.lines.forEach(p => p.forEach(h => {
    if (seen.has(h)) return; seen.add(h);
    const s = byHip.get(h); if (!s || !s[6]) return;
    if (s[6] < near.d) near = { d: s[6], name: s[7] };
    if (s[6] > far.d) far = { d: s[6], name: s[7] };
  }));
  return { near, far };
}
function makeStarTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.Texture(c); tex.needsUpdate = true;
  return tex;
}
