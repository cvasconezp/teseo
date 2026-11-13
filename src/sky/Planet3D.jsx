// Planet3D — modelo 3D de un cuerpo del sistema solar (Three.js).
// Esfera con la textura real de /textures/<id>.jpg, luz tipo Sol con terminador
// suave, anillos para Saturno, corona para el Sol, giro lento y arrastre.
// Si la textura no existe (p. ej. mars.jpg / venus.jpg aún no publicadas) usa una
// textura procedural de respaldo y avisa con onStatus("fallback") para que la
// ficha la etiquete como representación.
// Solo se importa desde el chunk diferido de la vista Cielo.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BODIES, textureUrl, RING_URL, makeFallbackCanvas } from "./bodies.js";

const reducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

export default function Planet3D({ bodyKey, phase, ariaLabel, onStatus }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  const [failed, setFailed] = useState(false);       // sin WebGL: se muestra un disco CSS
  const body = BODIES[bodyKey];

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !body) return;
    let disposed = false, raf = 0;
    const disposables = [];                           // geometrías, materiales y texturas
    const track = (o) => { disposables.push(o); return o; };
    const still = reducedMotion();
    const isSun = body.id === "sun";

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setFailed(true); statusRef.current && statusRef.current("nowebgl");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.display = "block"; canvas.style.width = "100%"; canvas.style.height = "100%";
    canvas.style.touchAction = "pan-y";               // el gesto vertical sigue desplazando la ficha
    canvas.style.cursor = "grab";
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

    // inclinación axial -> giro propio
    const tilt = new THREE.Group();
    tilt.rotation.z = -THREE.MathUtils.degToRad(Math.min(body.tilt, 98));
    const drag = new THREE.Group();                   // lo que mueve el usuario
    drag.add(tilt); scene.add(drag);
    drag.rotation.x = body.ring ? 0.32 : 0.12;        // ligera vista desde arriba (se aprecian los anillos)

    const fallbackTex = track(new THREE.CanvasTexture(makeFallbackCanvas(body.id)));
    fallbackTex.colorSpace = THREE.SRGBColorSpace;
    const geo = track(new THREE.SphereGeometry(1, 72, 48));
    const mat = track(isSun
      ? new THREE.MeshBasicMaterial({ map: fallbackTex })
      : new THREE.MeshLambertMaterial({ map: fallbackTex }));
    const globe = new THREE.Mesh(geo, mat);
    globe.rotation.y = -Math.PI / 2;                  // centro de la textura (longitud 0) hacia la cámara
    tilt.add(globe);

    let needsRender = true;
    const invalidate = () => { needsRender = true; };

    // textura real; si falla, se queda la de respaldo
    const loader = new THREE.TextureLoader();
    loader.load(textureUrl(body.id), (tex) => {
      if (disposed) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      track(tex); mat.map = tex; mat.needsUpdate = true; invalidate();
      statusRef.current && statusRef.current("real");
    }, undefined, () => { if (!disposed) statusRef.current && statusRef.current("fallback"); });

    let fit = 1.22;                                   // radio que debe caber en el encuadre
    if (isSun) {
      // corona: resplandor aditivo alrededor del disco (el Sol emite, no recibe sombra)
      const c = document.createElement("canvas"); c.width = c.height = 256;
      const x = c.getContext("2d");
      const g = x.createRadialGradient(128, 128, 60, 128, 128, 128);
      g.addColorStop(0, "rgba(255,214,120,0.95)"); g.addColorStop(0.18, "rgba(255,170,60,0.5)");
      g.addColorStop(0.5, "rgba(255,120,30,0.14)"); g.addColorStop(1, "rgba(255,100,20,0)");
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      const ctex = track(new THREE.CanvasTexture(c));
      const cmat = track(new THREE.SpriteMaterial({ map: ctex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const corona = new THREE.Sprite(cmat); corona.scale.set(4.2, 4.2, 1); corona.renderOrder = -1;
      scene.add(corona);
      fit = 1.7;
    } else {
      // luz tipo Sol + un mínimo de luz ambiente para que el lado nocturno no sea negro puro
      const sun = new THREE.DirectionalLight(0xfff4e6, 3.1);
      if (body.id === "moon" && phase && phase.illum != null) {
        // la Luna se ilumina con su fase real: ángulo de fase i, con k = (1 + cos i) / 2
        const i = Math.acos(Math.max(-1, Math.min(1, 2 * phase.illum - 1)));
        sun.position.set((phase.waxing ? 1 : -1) * Math.sin(i), 0.12, Math.cos(i)).multiplyScalar(5);
      } else {
        sun.position.set(-3.2, 1.6, 3.6);
      }
      scene.add(sun);
      scene.add(new THREE.AmbientLight(0x8fa3ff, body.id === "moon" ? 0.22 : 0.16));
    }

    if (body.ring) {
      // anillos reales de Saturno: tira radial 2048×125 con alfa. RingGeometry trae
      // UV planos, así que se reasignan: u = posición radial (0 interior, 1 exterior).
      const inner = 1.236, outer = 2.27;              // anillo C interior … borde exterior del A, en radios de Saturno
      const rgeo = track(new THREE.RingGeometry(inner, outer, 160, 1));
      const pos = rgeo.attributes.position, uv = rgeo.attributes.uv;
      for (let k = 0; k < pos.count; k++) {
        const rad = Math.hypot(pos.getX(k), pos.getY(k));
        uv.setXY(k, (rad - inner) / (outer - inner), 0.5);
      }
      uv.needsUpdate = true;
      const rmat = track(new THREE.MeshBasicMaterial({ color: 0xcfc6ad, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
      const ring = new THREE.Mesh(rgeo, rmat);
      ring.rotation.x = Math.PI / 2;                  // plano ecuatorial
      tilt.add(ring);
      loader.load(RING_URL, (tex) => {
        if (disposed) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace; track(tex);
        rmat.map = tex; rmat.opacity = 0.96; rmat.color.set(0xe9e2cf); rmat.needsUpdate = true; invalidate();
      }, undefined, () => {
        if (disposed) return;                         // sin textura: anillo liso translúcido
        rmat.opacity = 0.45; rmat.needsUpdate = true; invalidate();
      });
      fit = 2.42;
    }

    const resize = () => {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const vertical = body.ring ? 1.5 : fit;         // los anillos, inclinados, ocupan menos alto
      camera.position.set(0, 0, Math.max(vertical / t, fit / (t * camera.aspect)) * 1.04);
      camera.updateProjectionMatrix(); invalidate();
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host);

    // arrastre para girar (horizontal: giro propio; vertical con ratón: cabeceo)
    let dragging = false, lastX = 0, lastY = 0, idleUntil = 0;
    const down = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.style.cursor = "grabbing"; try { canvas.setPointerCapture(e.pointerId); } catch { /* no-op */ } };
    const move = (e) => {
      if (!dragging) return;
      globe.rotation.y += (e.clientX - lastX) * 0.011;
      if (e.pointerType !== "touch") drag.rotation.x = Math.max(-1.1, Math.min(1.1, drag.rotation.x + (e.clientY - lastY) * 0.007));
      lastX = e.clientX; lastY = e.clientY; invalidate();
    };
    const up = () => { dragging = false; canvas.style.cursor = "grab"; idleUntil = performance.now() + 1800; };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    apiRef.current = { nudge: (d) => { globe.rotation.y += d; idleUntil = performance.now() + 1800; invalidate(); } };

    // giro lento (pausado con prefers-reduced-motion; la Luna no gira: muestra siempre la misma cara)
    const spin = still ? 0 : body.spin * 0.12;        // rad/s
    let last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (spin && !dragging && now > idleUntil) { globe.rotation.y += spin * dt; needsRender = true; }
      if (needsRender) { renderer.render(scene, camera); needsRender = false; }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* no-op */ }
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      apiRef.current = null;
    };
    // la fase solo afecta a la Luna; se recrea si cambia de forma apreciable
  }, [bodyKey, body, phase && phase.illum, phase && phase.waxing]);  // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e) => {
    if (!apiRef.current) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); apiRef.current.nudge(-0.2); }
    if (e.key === "ArrowRight") { e.preventDefault(); apiRef.current.nudge(0.2); }
  };

  if (!body) return null;
  return (
    <div ref={hostRef} className="sk-planet3d" role="img" aria-label={ariaLabel} tabIndex={0} onKeyDown={onKey}>
      {failed && <div className="sk-orb" style={{ "--orb": body.color }} aria-hidden="true" />}
    </div>
  );
}
