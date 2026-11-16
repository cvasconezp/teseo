// MoonsView.jsx — «Así se ve hoy»: el planeta y sus lunas en el instante elegido, dibujados como en un
// telescopio: el planeta con su textura, achatado y girado según su eje real (ángulo del polo e
// inclinación hacia la Tierra), los anillos de Saturno con su textura y abiertos lo que toca, y las
// lunas como puntos de luz a su escala (con su globo cuando el zoom da para verlo). Norte arriba y
// este a la izquierda, como a simple vista o con prismáticos. Zoom con pellizco, rueda o botones;
// arrastrar mueve la vista; las órbitas se muestran a pedido. Posiciones: src/sky/moons.js.
import { useEffect, useMemo, useRef, useState } from "react";
import { ephemeris } from "../ephemeris.js";
import { planetView, moonName, moonVectorKm, skyAxes, daysSinceT0, moonOrbit, seeWith, moonBody } from "./moons.js";
import { BODIES, bodyName, textureUrl, RING_URL } from "./bodies.js";
import { drawSphere } from "./art.js";
import { num } from "./format.js";

const PLANET_EN = { "Marte": "Mars", "Júpiter": "Jupiter", "Saturno": "Saturn", "Urano": "Uranus", "Neptuno": "Neptune" };
const AU_KM = 149597870.7, ARCSEC = 206264.806, C_KMS = 299792.458, RAD = Math.PI / 180;

/** 125.4 → «2′ 05″»; 17.3 → «17″»; 0.4 → «0,4″». */
export function fmtArc(s, lang) {
  if (s >= 60) { const m = Math.floor(s / 60), r = Math.round(s - 60 * m); return r === 60 ? `${m + 1}′ 00″` : `${m}′ ${String(r).padStart(2, "0")}″`; }
  return `${num(s, lang, s < 10 ? 1 : 0)}″`;
}

/** Datos de la vista para un planeta en una fecha. */
export function viewFor(parent, when) {
  const eb = ephemeris(when).find((b) => b.planet === PLANET_EN[parent]);
  if (!eb) return null;
  const planet = { name: parent, nx: eb.nx, ny: eb.ny, nz: eb.nz, dist_au: eb.dist_au, r_au: eb.r_au };
  return { planet, view: planetView(planet, when) };
}

// texturas como ImageData (mismo origen), cargadas una vez
const texCache = new Map();
function loadTex(url) {
  if (!texCache.has(url)) {
    texCache.set(url, new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
          const x = c.getContext("2d"); x.drawImage(img, 0, 0);
          res(x.getImageData(0, 0, c.width, c.height));
        } catch { res(null); }
      };
      img.onerror = () => res(null);
      img.src = url;
    }));
  }
  return texCache.get(url);
}

/** Escalones «redondos» para la barra de escala, en segundos de arco. */
const SCALE_STEPS = [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200];

export default function MoonsView({ parent, focus, lang, t, when }) {
  const minute = Math.floor(when.getTime() / 60000);
  const data = useMemo(() => viewFor(parent, new Date(minute * 60000)), [parent, minute]);
  const canvasRef = useRef(null), boxRef = useRef(null);
  const [orbits, setOrbits] = useState(false);
  const [tex, setTex] = useState({});                          // { planet, ring, moons: {key: ImageData} }
  const view = useRef({ zoom: 1, px: 0, py: 0 });              // zoom relativo al encuadre inicial y desplazamiento (px CSS)
  const [tick, setTick] = useState(0);                         // fuerza un redibujo tras zoom o arrastre
  const redraw = () => setTick((n) => n + 1);

  // texturas del planeta, de los anillos y de las lunas con mosaico
  useEffect(() => {
    let alive = true;
    const b = BODIES[parent];
    const jobs = [b ? loadTex(textureUrl(b.id)) : Promise.resolve(null), parent === "Saturno" ? loadTex(RING_URL) : Promise.resolve(null)];
    const keys = data ? data.view.moons.map((m) => m.key).filter((k) => moonBody(k)) : [];
    keys.forEach((k) => jobs.push(loadTex(textureUrl(moonBody(k).id))));
    Promise.all(jobs).then(([planet, ring, ...ms]) => {
      if (!alive) return;
      const moons = {}; keys.forEach((k, i) => { moons[k] = ms[i]; });
      setTex({ planet, ring, moons });
    });
    return () => { alive = false; };
  }, [parent, !!data]);   // eslint-disable-line react-hooks/exhaustive-deps

  // al cambiar de planeta o de luna, vuelve al encuadre inicial
  useEffect(() => { view.current = { zoom: 1, px: 0, py: 0 }; redraw(); }, [parent, focus]);

  const geo = useMemo(() => {
    if (!data) return null;
    const { planet, view: v } = data;
    const fit = focus ? v.moons.filter((m) => m.key === focus) : v.moons.filter((m) => m.key !== "Iapetus");
    const extent = Math.max(v.radius * 5, ...fit.map((m) => m.aArcsec)) * 1.12;
    const all = Math.max(v.radius * 5, ...v.moons.map((m) => m.aArcsec)) * 1.12;
    const u0 = [planet.nx, planet.ny, planet.nz], n0 = Math.hypot(...u0), u = u0.map((x) => x / n0);
    const { east, north } = skyAxes(u);
    const D = planet.dist_au * AU_KM;
    const t0 = daysSinceT0(new Date(minute * 60000)) - D / C_KMS / 86400;
    // órbitas proyectadas (segundos de arco), 96 puntos por vuelta
    const paths = {};
    for (const m of v.moons) {
      const o = moonOrbit(m.key), P = 2 * Math.PI / Math.abs(o.n), pts = [];
      for (let i = 0; i <= 96; i++) {
        const w = moonVectorKm(m.key, t0 + (P * i) / 96);
        pts.push([(w[0] * east[0] + w[1] * east[1] + w[2] * east[2]) / D * ARCSEC, (w[0] * north[0] + w[1] * north[1] + w[2] * north[2]) / D * ARCSEC]);
      }
      paths[m.key] = pts;
    }
    return { v, extent, all, paths };
  }, [data, focus, minute]);

  // ── dibujo ──
  useEffect(() => {
    const c = canvasRef.current; if (!c || !geo) return;
    const W = c.clientWidth || 300, H = c.clientHeight || W, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { v, extent, paths } = geo, vw = view.current;
    const k = ((Math.min(W, H) / 2 - 10) / extent) * vw.zoom;    // px por segundo de arco
    const cx = W / 2 + vw.px, cy = H / 2 + vw.py;
    const sx = (a) => cx - a * k, sy = (b) => cy - b * k;        // este a la izquierda, norte arriba
    x.fillStyle = "#020408"; x.fillRect(0, 0, W, H);
    const pa = (v.orient ? v.orient.pa : 0) * RAD, B = (v.orient ? v.orient.B : 0) * RAD;
    const R = v.radius * k;
    // 1) órbitas (debajo de todo: el planeta tapa lo que pasa por detrás)
    if (orbits) {
      for (const m of v.moons) {
        const on = m.key === focus;
        x.beginPath();
        paths[m.key].forEach((p, i) => (i ? x.lineTo(sx(p[0]), sy(p[1])) : x.moveTo(sx(p[0]), sy(p[1]))));
        x.strokeStyle = on ? "rgba(242,198,109,0.85)" : "rgba(170,160,230,0.38)";
        x.lineWidth = on ? 1.6 : 1; x.setLineDash(on ? [5, 4] : []); x.stroke(); x.setLineDash([]);
      }
    }
    // 2) planeta y anillos, en el marco del planeta (polo hacia arriba tras girar −PA)
    const ring = v.ring && tex.ring ? v.ring : null;
    const ringBand = (front) => {
      if (!ring) return;
      const { data: rd, width: rw, height: rh } = tex.ring, row = Math.floor(rh / 2);
      const inner = ring.inner * k, outer = ring.a * k, sinB = Math.abs(Math.sin(B));
      const step = Math.max(0.6, (outer - inner) / 220);
      // con B > 0 se ve la cara norte: la mitad cercana del anillo queda del lado contrario al polo (abajo)
      const near = B >= 0 ? [0, Math.PI] : [Math.PI, 2 * Math.PI];
      const [a0, a1] = front ? near : [near[1], near[0] + 2 * Math.PI];
      for (let r = inner; r <= outer; r += step) {
        const uu = Math.min(rw - 1, Math.floor(((r - inner) / (outer - inner)) * rw)), p = (row * rw + uu) * 4;
        const al = rd[p + 3] / 255; if (al < 0.03) continue;
        x.beginPath(); x.ellipse(0, 0, r, Math.max(0.25, r * sinB), 0, a0, a1);
        x.strokeStyle = `rgba(${rd[p]},${rd[p + 1]},${rd[p + 2]},${(al * 0.95).toFixed(3)})`;
        x.lineWidth = step * 1.25; x.stroke();
      }
    };
    x.save(); x.translate(cx, cy); x.rotate(-pa);
    ringBand(false);
    if (tex.planet && R >= 2.5) {
      // la esfera se calcula a resolución acotada y se escala (arrastrar y acercar siguen fluidos)
      const Rr = Math.min(Math.ceil(R * dpr), 240), off = document.createElement("canvas");
      off.width = off.height = 2 * Rr;
      drawSphere(off.getContext("2d"), tex.planet, Rr, Rr, Rr, { lat0: B, lon0: 0.6 });
      const f = 1 - (v.flattening || 0) * Math.cos(B) ** 2;
      x.save(); x.scale(1, f); x.drawImage(off, -R, -R, 2 * R, 2 * R); x.restore();
    } else {
      x.fillStyle = "#e8c08a"; x.beginPath(); x.arc(0, 0, Math.max(2.5, R), 0, 2 * Math.PI); x.fill();
    }
    ringBand(true);
    x.restore();
    // 3) lunas: punto de luz con halo; con radio de ≥ 3 px, su globo con textura
    const labels = [];
    const boxes = [[cx - R - 2, cy - R - 2, cx + R + 2, cy + R + 2]];
    const hit = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    const order = [...v.moons].sort((a, b) => (b.key === focus) - (a.key === focus) || a.mag - b.mag);
    for (const m of order) {
      if (m.state === "hidden") continue;
      const mx = sx(m.x), my = sy(m.y);
      if (mx < -20 || mx > W + 20 || my < -20 || my > H + 20) continue;
      const r = m.rArcsec * k, on = m.key === focus, mt = tex.moons && tex.moons[m.key];
      if (r >= 3 && mt) {
        const Rr = Math.min(Math.ceil(r * dpr), 160), off = document.createElement("canvas");
        off.width = off.height = 2 * Rr;
        drawSphere(off.getContext("2d"), mt, Rr, Rr, Rr, { lat0: B });
        x.save(); x.translate(mx, my); x.rotate(-pa); x.drawImage(off, -r, -r, 2 * r, 2 * r); x.restore();
      } else {
        const glow = Math.max(2.2, r * 2.2) + (on ? 1.5 : 0);
        const g = x.createRadialGradient(mx, my, 0, mx, my, glow * 2.2);
        g.addColorStop(0, on ? "rgba(255,226,150,1)" : "rgba(240,242,255,1)");
        g.addColorStop(0.35, on ? "rgba(242,198,109,0.55)" : "rgba(220,226,255,0.35)");
        g.addColorStop(1, "rgba(220,226,255,0)");
        x.fillStyle = g; x.beginPath(); x.arc(mx, my, glow * 2.2, 0, 2 * Math.PI); x.fill();
        x.fillStyle = on ? "#ffe29a" : "#f4f6ff"; x.beginPath(); x.arc(mx, my, Math.max(1.3, r), 0, 2 * Math.PI); x.fill();
      }
      if (on) { x.strokeStyle = "rgba(242,198,109,0.9)"; x.lineWidth = 1.2; x.beginPath(); x.arc(mx, my, Math.max(7, r + 4), 0, 2 * Math.PI); x.stroke(); }
      const name = moonName(m.key, lang);
      x.font = `${on ? 600 : 400} ${on ? 12.5 : 11}px Inter, system-ui, sans-serif`;
      const tw = x.measureText(name).width + 4;
      for (const dy of m.y >= 0 ? [-Math.max(9, r + 6), Math.max(15, r + 13)] : [Math.max(15, r + 13), -Math.max(9, r + 6)]) {
        const bx = [mx - tw / 2, my + dy - 11, mx + tw / 2, my + dy + 2];
        if (!hit(bx)) { boxes.push(bx); labels.push([name, mx, my + dy, on]); break; }
      }
    }
    x.textAlign = "center";
    for (const [name, lx, ly, on] of labels) {
      x.font = `${on ? 600 : 400} ${on ? 12.5 : 11}px Inter, system-ui, sans-serif`;
      x.fillStyle = on ? "#f2c66d" : "rgba(238,240,250,0.78)"; x.fillText(name, lx, ly);
    }
    // 4) rosa de los vientos y barra de escala
    x.font = "600 11px Inter, system-ui, sans-serif"; x.fillStyle = "rgba(200,206,226,0.8)";
    x.fillText(t.compassN, W / 2, 16); x.textAlign = "left"; x.fillText(t.compassE, 8, H / 2 + 4); x.textAlign = "right"; x.fillText(t.compassW, W - 8, H / 2 + 4);
    const want = (W * 0.28) / k, st = SCALE_STEPS.reduce((b, s) => (s <= want ? s : b), SCALE_STEPS[0]);
    const bl = st * k;
    x.strokeStyle = "rgba(200,206,226,0.85)"; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(12, H - 14); x.lineTo(12 + bl, H - 14); x.moveTo(12, H - 18); x.lineTo(12, H - 10); x.moveTo(12 + bl, H - 18); x.lineTo(12 + bl, H - 10); x.stroke();
    x.textAlign = "left"; x.font = "11px Inter, system-ui, sans-serif"; x.fillText(fmtArc(st, lang), 16 + bl, H - 10);
  }, [geo, tex, orbits, tick, focus, lang, t]);

  // ── zoom y desplazamiento ──
  useEffect(() => {
    const c = canvasRef.current; if (!c || !geo) return undefined;
    const pts = new Map();
    let last = null;
    const limits = () => {
      const W = c.clientWidth || 300;
      const kFit = (W / 2 - 10) / geo.extent;
      const zMin = Math.min(1, geo.extent / geo.all), zMax = Math.max(4, (W * 1.6) / (geo.v.radius * 2 * kFit));
      return { zMin, zMax };
    };
    const zoomAt = (f, ox, oy) => {
      const vw = view.current, { zMin, zMax } = limits();
      const z = Math.max(zMin, Math.min(zMax, vw.zoom * f)), g = z / vw.zoom;
      const W = c.clientWidth, H = c.clientHeight;
      // el punto bajo el dedo o el cursor queda quieto
      vw.px = (vw.px + W / 2 - ox) * g + ox - W / 2; vw.py = (vw.py + H / 2 - oy) * g + oy - H / 2;
      vw.zoom = z; redraw();
    };
    const rel = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const onWheel = (e) => { e.preventDefault(); const [ox, oy] = rel(e); zoomAt(Math.exp(-e.deltaY * 0.0018), ox, oy); };
    const onDown = (e) => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, rel(e)); last = null; };
    const onMove = (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId), cur = rel(e); pts.set(e.pointerId, cur);
      if (pts.size === 1) { view.current.px += cur[0] - prev[0]; view.current.py += cur[1] - prev[1]; redraw(); return; }
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (last) zoomAt(d / last, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      last = d;
    };
    const onUp = (e) => { pts.delete(e.pointerId); last = null; };
    const onDbl = () => { view.current = { zoom: 1, px: 0, py: 0 }; redraw(); };
    c.addEventListener("wheel", onWheel, { passive: false });
    c.addEventListener("pointerdown", onDown); c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp); c.addEventListener("pointercancel", onUp); c.addEventListener("dblclick", onDbl);
    c.zoomBy = (f) => zoomAt(f, c.clientWidth / 2, c.clientHeight / 2);
    return () => {
      c.removeEventListener("wheel", onWheel); c.removeEventListener("pointerdown", onDown); c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp); c.removeEventListener("pointercancel", onUp); c.removeEventListener("dblclick", onDbl);
    };
  }, [geo]);
  // redibujar si cambia el tamaño
  useEffect(() => {
    const el = boxRef.current; if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => redraw()); ro.observe(el); return () => ro.disconnect();
  }, []);

  if (!data || !geo) return null;
  const { v } = geo;
  const pName = bodyName(parent, lang);
  const dirOf = (m) => (Math.abs(m.x) >= Math.abs(m.y) ? (m.x > 0 ? t.dirE : t.dirW) : (m.y > 0 ? t.dirN : t.dirS));
  const rowText = (m) => (m.state === "hidden" ? t.moonHidden(pName) : m.state === "transit" ? t.moonTransit(pName) : t.moonRow(fmtArc(m.sep, lang), dirOf(m), num(m.mag, lang, 1)));
  const sel = focus ? v.moons.find((m) => m.key === focus) : null;
  const list = v.moons.map((m) => `${moonName(m.key, lang)}: ${rowText(m)}`).join(". ");
  const loc = lang === "es" ? "es-EC" : "en-US";
  const stamp = new Date(minute * 60000).toLocaleString(loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const zoomBtn = (f) => () => { const c = canvasRef.current; if (c && c.zoomBy) c.zoomBy(f); };
  return (
    <section className="sk-moons" aria-label={focus ? t.moonsTitle : t.moonsTitlePlanet}>
      <h3>{focus ? t.moonsTitle : t.moonsTitlePlanet} <small>{stamp}</small></h3>
      <div className="sk-moons-stage" ref={boxRef}>
        <canvas ref={canvasRef} className="sk-moons-canvas" role="img" aria-label={t.moonsAria(pName, list)} />
        <div className="sk-moons-tools" role="group" aria-label={t.moonsZoomGroup}>
          <button type="button" onClick={zoomBtn(1.6)} aria-label={t.moonsZoomIn}>+</button>
          <button type="button" onClick={zoomBtn(1 / 1.6)} aria-label={t.moonsZoomOut}>−</button>
          <button type="button" onClick={() => { view.current = { zoom: 1, px: 0, py: 0 }; redraw(); }} aria-label={t.moonsZoomFit}>⤢</button>
        </div>
      </div>
      <div className="sk-moons-bar">
        <button type="button" className={`sk-chip${orbits ? " is-on" : ""}`} aria-pressed={orbits} onClick={() => setOrbits((o) => !o)}>{t.moonsOrbits}</button>
        <small>{t.moonsHint}</small>
      </div>
      {sel && sel.state !== "free" && <p className="sk-moons-state">{sel.state === "hidden" ? t.moonStateHidden(moonName(sel.key, lang), pName) : t.moonStateTransit(moonName(sel.key, lang), pName)}</p>}
      {sel && (
        <dl className="sk-facts sk-moons-facts">
          <div><dt>{t.sepNow}</dt><dd>{t.sepVal(fmtArc(sel.sep, lang))}</dd></div>
          <div><dt>{t.seeTitle}</dt><dd>{t.see[seeWith(sel.mag, sel.sep, parent)]}<small>{t.seeHint}</small></dd></div>
        </dl>
      )}
      {!focus && (
        <ul className="sk-moons-list">
          {v.moons.map((m) => <li key={m.key}><b>{moonName(m.key, lang)}</b> {rowText(m)}</li>)}
        </ul>
      )}
      {v.ring && <p className="sk-moons-note">{t.ringLine(num(Math.abs(v.ring.tilt), lang, 1))}</p>}
      <small className="sk-moons-src">{t.moonsOrient} {t.moonsTexNote} {t.moonsSrc}</small>
    </section>
  );
}
