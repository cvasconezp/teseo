// issLayer.js — capa three.js de la ISS para la vista Cielo: la trayectoria de UNA pasada sobre la esfera,
// marcas de cada minuto, inicio y fin, y la estación como un punto brillante en su posición a la hora simulada.
// Los datos vienen de /api/iss/passes (backend/app/iss.py, SGP4) y se interpolan con issSky.js.
//
//   const iss = new IssLayer({ radius: 880 });
//   scene.add(iss.group);
//   iss.setPass(pasada);                      // con `track`; null = quitarla
//   iss.setLocalFrame(localQuat | null);      // solo se dibuja en «Mi cielo» (null = sin horizonte: oculta)
//   iss.setPixelRatio(renderer.getPixelRatio());
//   const moved = iss.update(tMs);            // en el bucle: coloca el punto; true si cambió algo visible
//   const labels = iss.labelsForView(camera, { w, h }, { clock: (ms) => "19:36" });
//   iss.dotWorld(v3)                          // dónde está el punto (mundo) o null si no se ve (toques)
//   iss.dispose();
//
// Marco: la trayectoria viene en altura/azimut del lugar del observador, es decir, en el marco LOCAL de la
// escena (+X este, +Y cenit, −Z norte: el de localSkyQuat en look.js y eqToLocal en guide.js). En «Mi cielo»
// ese marco es el propio mundo (las estrellas son las que se giran con localQuat), así que el grupo no se
// gira: setLocalFrame solo enciende o apaga la capa. Fijada al horizonte, la trayectoria no depende de la
// hora (lo que se mueve con el tiempo es el punto de la ISS sobre ella).
//
// Orden de dibujo: renderOrder 1, después de estrellas, figuras y planetas (0) y antes que el suelo
// semitransparente (2, con depthTest false), que así la atenúa bajo el horizonte; el anillo del horizonte (3)
// y las etiquetas HTML quedan encima. Sin escribir ni leer profundidad. Las geometrías se crean al elegir la
// pasada, nunca por fotograma; por fotograma solo se mueve un vértice (el punto).
import * as THREE from "three";
import { issPositionAt, issSegments, passSpan } from "./issSky.js";

export const ISS_COLORS = { lit: "#ffd98a", shadow: "#9fb3d9", dot: "#fff6dc", dotShadow: "#a9b8d6", label: "#ffe08a", tick: "#e9dcc0", halo: "#120c02" };
const D2R = Math.PI / 180;
export const EDGE_MS = 1000;      // tolerancia en los extremos de la pasada (ver update)

// ── lógica pura (sin WebGL; la prueban scripts/test_sky_isslayer.mjs) ─────────────────────────────────
const norm = (v) => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Instantes de cada minuto en punto (hora del reloj: los minutos UTC y locales coinciden en todas las zonas
 * con desfase de minutos enteros) dentro de la pasada, lejos (`marginMs`) del inicio y del fin, que ya llevan
 * su propia marca. Devuelve [{ tMs, alt, az, lit, local }].
 */
export function minuteTicks(pass, { everyS = 60, marginMs = 20000 } = {}) {
  const span = passSpan(pass);
  if (!span) return [];
  const step = Math.max(10, everyS) * 1000;
  const out = [];
  for (let t = Math.ceil(span[0] / step) * step; t <= span[1]; t += step) {
    if (t - span[0] < marginMs || span[1] - t < marginMs) continue;
    const q = issPositionAt(pass, t);
    out.push({ tMs: t, alt: q.alt, az: q.az, lit: q.lit, local: q.local });
  }
  return out;
}

/** Dirección del movimiento en `tMs` como vector unitario del plano tangente a la esfera (marco local). */
export function motionTangent(pass, tMs, dtMs = 2000) {
  const span = passSpan(pass);
  if (!span) return null;
  const t0 = Math.max(span[0], tMs - dtMs), t1 = Math.min(span[1], tMs + dtMs);
  if (t1 <= t0) return null;
  const a = issPositionAt(pass, t0).local, b = issPositionAt(pass, t1).local, p = issPositionAt(pass, tMs).local;
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const k = dot(d, p);
  const t = [d[0] - k * p[0], d[1] - k * p[1], d[2] - k * p[2]];
  return Math.hypot(t[0], t[1], t[2]) < 1e-12 ? null : norm(t);
}

/** Punta de flecha en `p` (unitario) apuntando hacia `t` (tangente): dos segmentos [p, ala], de `lenDeg` grados. */
export function arrowHead(p, t, lenDeg = 2.2, halfWidthDeg = 1.3) {
  const n = norm(cross(p, t)), a = Math.tan(lenDeg * D2R), b = Math.tan(halfWidthDeg * D2R);
  const w1 = norm([p[0] - t[0] * a + n[0] * b, p[1] - t[1] * a + n[1] * b, p[2] - t[2] * a + n[2] * b]);
  const w2 = norm([p[0] - t[0] * a - n[0] * b, p[1] - t[1] * a - n[1] * b, p[2] - t[2] * a - n[2] * b]);
  return [[p, w1], [p, w2]];
}

/** Marca perpendicular a la trayectoria en `p` (tangente `t`), de `halfDeg` grados a cada lado. */
export function tickMark(p, t, halfDeg = 0.9) {
  const n = norm(cross(p, t)), c = Math.tan(halfDeg * D2R);
  return [norm([p[0] - n[0] * c, p[1] - n[1] * c, p[2] - n[2] * c]), norm([p[0] + n[0] * c, p[1] + n[1] * c, p[2] + n[2] * c])];
}

/** Círculo pequeño (radio `rDeg`) alrededor de `p`, como polilínea cerrada de `n` puntos unitarios. */
export function ringAround(p, rDeg = 1.1, n = 24) {
  const a = Math.abs(p[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(p, a)), v = cross(p, u), r = Math.tan(rDeg * D2R), out = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2, c = Math.cos(th) * r, s = Math.sin(th) * r;
    out.push(norm([p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s]));
  }
  return out;
}

/** Tramos de luz y sombra con sus vértices escalados a la esfera: [{ lit, positions: Float32Array }]. */
export function segmentArrays(pass, R) {
  return issSegments(pass).filter((s) => s.points.length >= 2).map((s) => {
    const a = new Float32Array(s.points.length * 3);
    s.points.forEach((q, i) => { a[i * 3] = q.local[0] * R; a[i * 3 + 1] = q.local[1] * R; a[i * 3 + 2] = q.local[2] * R; });
    return { lit: s.lit, positions: a };
  });
}

/** Copia de una polilínea desplazada `offDeg` grados hacia un lado (para un trazo de ~2 px con líneas de 1 px). */
export function offsetPolyline(positions, offDeg) {
  const n = positions.length / 3, out = new Float32Array(positions.length), k = Math.tan(offDeg * D2R);
  for (let i = 0; i < n; i++) {
    const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
    const p = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]], R = Math.hypot(p[0], p[1], p[2]) || 1;
    const u = [p[0] / R, p[1] / R, p[2] / R];
    const d = [positions[j1 * 3] - positions[j0 * 3], positions[j1 * 3 + 1] - positions[j0 * 3 + 1], positions[j1 * 3 + 2] - positions[j0 * 3 + 2]];
    const nn = norm(cross(u, d.some((x) => x !== 0) ? d : [0, 1, 0]));
    const q = norm([u[0] + nn[0] * k, u[1] + nn[1] * k, u[2] + nn[2] * k]);
    out[i * 3] = q[0] * R; out[i * 3 + 1] = q[1] * R; out[i * 3 + 2] = q[2] * R;
  }
  return out;
}

/** Distancia angular (°) del punto unitario `p` al arco de círculo máximo entre `a` y `b` (unitarios). */
export function arcDistance(p, a, b) {
  const n = cross(a, b), nl = Math.hypot(n[0], n[1], n[2]);
  const toEnds = Math.min(Math.acos(Math.max(-1, Math.min(1, dot(p, a)))), Math.acos(Math.max(-1, Math.min(1, dot(p, b)))));
  if (nl < 1e-12) return toEnds / D2R;
  const nn = [n[0] / nl, n[1] / nl, n[2] / nl], s = dot(p, nn);
  // proyección de p sobre el plano del círculo máximo: ¿cae entre a y b?
  const q = norm([p[0] - s * nn[0], p[1] - s * nn[1], p[2] - s * nn[2]]);
  const inside = dot(cross(a, q), nn) >= -1e-12 && dot(cross(q, b), nn) >= -1e-12;
  return (inside ? Math.asin(Math.min(1, Math.abs(s))) : toEnds) / D2R;
}

/** Altura y azimut (°) de un vértice del marco local (+X este, +Y cenit, −Z norte). */
export function localToAltAz(x, y, z) {
  const r = Math.hypot(x, y, z) || 1;
  return { alt: Math.asin(Math.max(-1, Math.min(1, y / r))) / D2R, az: ((Math.atan2(x, -z) / D2R) % 360 + 360) % 360 };
}

/**
 * Aclara etiquetas: recorre los candidatos en orden de prioridad (mayor primero) y descarta los que caen a
 * menos de `minPx` de otro ya aceptado. Cada candidato: { x, y, prio, ... }. Pura.
 */
export function thinLabels(cands, minPx = 46) {
  const keep = [];
  const sorted = [...cands].sort((a, b) => (b.prio || 0) - (a.prio || 0));
  for (const c of sorted) if (keep.every((k) => (k.x - c.x) ** 2 + (k.y - c.y) ** 2 >= minPx * minPx)) keep.push(c);
  return keep;
}

// ── reproducción: velocidades y reloj al segundo (puros) ───────────────────────────────────────────────
export const ISS_RATES = [1, 10, 60];
export const DT_CAP_MS = 250;     // un cuadro nunca avanza más de 250 ms reales (tras una pausa del navegador)
/** Siguiente velocidad del ciclo ×1 → ×10 → ×60 → ×1. */
export const nextRate = (r) => { const i = ISS_RATES.indexOf(r); return i < 0 ? ISS_RATES[1] : ISS_RATES[(i + 1) % ISS_RATES.length]; };
/** Estado de la ISS en palabras para la píldora: "lit" | "shadow" (durante), "before" | "after" (fuera). */
export function pillState(pos, nowMs, pass) {
  if (pos) return pos.lit ? "lit" : "shadow";
  if (pass && Number.isFinite(pass.startMs) && nowMs < pass.startMs) return "before";
  return "after";
}
/**
 * Un paso del reloj de la ISS. ck = { t, playing, live, rate, lastMin, endMs }; dtMs = tiempo real del cuadro.
 * Reproduciendo avanza dt·velocidad (dt recortado a DT_CAP_MS); en «ahora» sigue a `nowMs`. Muta `ck`.
 * Devuelve { minute: ¿cambió el minuto? (para escribir whenStr), ended: ¿pasó 15 s del fin de la pasada? }.
 */
export function stepClock(ck, dtMs, nowMs = Date.now()) {
  if (ck.playing) ck.t += Math.min(DT_CAP_MS, Math.max(0, dtMs || 0)) * (ck.rate || 1);
  else if (ck.live) ck.t = nowMs;
  const mn = Math.floor(ck.t / 60000), minute = ck.playing && mn !== ck.lastMin;
  if (minute) ck.lastMin = mn;
  return { minute, ended: !!(ck.playing && ck.endMs != null && ck.t > ck.endMs + 15000) };
}

// ── textura del punto: núcleo blanco y halo cálido ─────────────────────────────────────────────────────
function dotTexture() {
  if (typeof document === "undefined") return null;   // node (pruebas): sin lienzo
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.18, "rgba(255,255,255,1)");
  r.addColorStop(0.32, "rgba(255,236,190,0.75)"); r.addColorStop(0.6, "rgba(255,210,130,0.22)"); r.addColorStop(1, "rgba(255,200,120,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const lineMat = (color, opacity, dashed) => {
  const o = { color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, depthTest: false, fog: false, toneMapped: false };
  return dashed ? new THREE.LineDashedMaterial({ ...o, dashSize: 10, gapSize: 8 }) : new THREE.LineBasicMaterial(o);
};
const geoOf = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(arr, 3)); g.computeBoundingSphere(); return g; };
const flat = (pairs, R) => { const a = new Float32Array(pairs.length * 6); pairs.forEach(([p, q], i) => { a.set([p[0] * R, p[1] * R, p[2] * R, q[0] * R, q[1] * R, q[2] * R], i * 6); }); return a; };

const _v = new THREE.Vector3(), _f = new THREE.Vector3();

export class IssLayer {
  constructor({ radius = 880, dotPx = 15 } = {}) {
    this.radius = radius;
    this.dotPx = dotPx;
    this.pr = 1;
    this.pass = null;
    this.localOn = false;
    this.visible = true;
    this.pos = null;                       // última posición (issPositionAt) o null fuera de la pasada
    this.ends = null;                      // { start: {tMs, local}, end: {tMs, local} }
    this.ticks = [];
    this.group = new THREE.Group(); this.group.name = "iss";
    this.trackGroup = new THREE.Group(); this.trackGroup.name = "iss-track";
    this.mats = {
      lit: lineMat(ISS_COLORS.lit, 0.95), litSoft: lineMat(ISS_COLORS.lit, 0.55),
      shadow: lineMat(ISS_COLORS.shadow, 0.6, true),
      tickLit: lineMat(ISS_COLORS.tick, 0.85), tickShadow: lineMat(ISS_COLORS.shadow, 0.55),
      ends: lineMat(ISS_COLORS.lit, 0.95),
      // contorno oscuro a ambos lados: sobre el cielo negro no se ve; sobre el cielo azul de día da contraste
      halo: lineMat(ISS_COLORS.halo, 0.5),
    };
    this.tex = dotTexture();
    this.dotMat = new THREE.PointsMaterial({ size: dotPx, sizeAttenuation: false, map: this.tex, color: new THREE.Color(ISS_COLORS.dot), transparent: true,
      opacity: 1, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
    this.dotPos = new Float32Array(3);
    this.dot = new THREE.Points(geoOf(this.dotPos), this.dotMat);
    this.dot.name = "iss-dot";
    this.dot.visible = false;
    this.group.add(this.trackGroup, this.dot);
    this.group.traverse((o) => { o.renderOrder = 1; o.frustumCulled = false; });
    this._lit = null; this._key = "";
    this._apply();
  }

  _apply() { this.group.visible = !!(this.pass && this.localOn && this.visible); }
  get active() { return this.group.visible; }

  _clearTrack() {
    for (const o of [...this.trackGroup.children]) { if (o.geometry) o.geometry.dispose(); this.trackGroup.remove(o); }
  }

  /** Elige la pasada a dibujar (con `track`; ver issSky.js) o null para quitarla. */
  setPass(pass) {
    this._clearTrack();
    this.pass = pass && Array.isArray(pass.track) && pass.track.length >= 2 ? pass : null;
    this.pos = null; this.ticks = []; this.ends = null; this._key = ""; this.dot.visible = false;
    if (this.pass) {
      const R = this.radius, add = (o, ro = 1) => { o.renderOrder = ro; o.frustumCulled = false; this.trackGroup.add(o); };
      for (const s of segmentArrays(this.pass, R)) {
        // el contorno se dibuja antes (renderOrder 0,95) que el trazo
        add(new THREE.Line(geoOf(offsetPolyline(s.positions, -0.1)), this.mats.halo), 0.95);
        add(new THREE.Line(geoOf(offsetPolyline(s.positions, s.lit ? 0.17 : 0.1)), this.mats.halo), 0.95);
        if (s.lit) {
          // trazo continuo de ~2 px: la línea y una copia desplazada una fracción de grado
          add(new THREE.Line(geoOf(s.positions), this.mats.lit));
          add(new THREE.Line(geoOf(offsetPolyline(s.positions, 0.07)), this.mats.litSoft));
        } else {
          const l = new THREE.Line(geoOf(s.positions), this.mats.shadow); l.computeLineDistances(); add(l);
        }
      }
      // marcas de cada minuto (perpendiculares a la trayectoria)
      this.ticks = minuteTicks(this.pass);
      const tl = [], ts = [];
      for (const k of this.ticks) { const tg = motionTangent(this.pass, k.tMs); if (tg) (k.lit ? tl : ts).push(tickMark(k.local, tg)); }
      if (tl.length) add(new THREE.LineSegments(geoOf(flat(tl, R)), this.mats.tickLit));
      if (ts.length) add(new THREE.LineSegments(geoOf(flat(ts, R)), this.mats.tickShadow));
      // inicio: un anillo; fin: una punta de flecha en el sentido del movimiento
      const [t0, t1] = passSpan(this.pass);
      const p0 = issPositionAt(this.pass, t0), p1 = issPositionAt(this.pass, t1);
      this.ends = { start: { tMs: t0, local: p0.local, lit: p0.lit }, end: { tMs: t1, local: p1.local, lit: p1.lit } };
      const ring = ringAround(p0.local), ringPairs = ring.map((p, i) => [p, ring[(i + 1) % ring.length]]);
      const tEnd = motionTangent(this.pass, t1) || [0, 1, 0];
      add(new THREE.LineSegments(geoOf(flat([...ringPairs, ...arrowHead(p1.local, tEnd)], R)), this.mats.ends));
    }
    this._apply();
    return !!this.pass;
  }

  /** «Mi cielo»: q = cuaternión ecuatorial → local (localSkyQuat). null = sin horizonte: la capa no se dibuja. */
  setLocalFrame(q) { this.localOn = !!q; this.group.quaternion.identity(); this.group.updateMatrixWorld(true); this._apply(); }
  setVisible(on) { this.visible = !!on; this._apply(); }
  /** Densidad de píxeles del renderizador: el tamaño del punto está en píxeles del lienzo. */
  setPixelRatio(pr) { if (pr > 0 && pr !== this.pr) { this.pr = pr; this._key = ""; } }

  /**
   * Coloca la ISS en `tMs` (ms Unix; sin recortar: antes o después de la pasada no se dibuja).
   * Devuelve true si cambió algo visible (para que el bucle vuelva a dibujar).
   */
  update(tMs) {
    if (!this.pass || !this.active) { const was = this.dot.visible; this.dot.visible = false; this.pos = null; return was; }
    // sin recortar, salvo ±1 s en los extremos: el inicio y el fin de la pasada vienen redondeados al segundo
    // («19:35:37Z») y el primer punto de la trayectoria lleva décimas («19:35:37.4Z»); a la hora exacta del
    // inicio la ISS debe verse ya, en el punto de partida
    let q = null;
    if (Number.isFinite(tMs)) {
      const sp = passSpan(this.pass);
      if (tMs >= sp[0] - EDGE_MS && tMs <= sp[1] + EDGE_MS) {
        q = issPositionAt(this.pass, tMs);
        if (q.state !== "during") q = { ...q, state: "during" };
      }
    }
    this.pos = q;
    if (!q) { const was = this.dot.visible; this.dot.visible = false; this._key = ""; return was; }
    const R = this.radius - 4;
    const x = q.local[0] * R, y = q.local[1] * R, z = q.local[2] * R;
    const key = `${q.lit ? 1 : 0}|${this.pr}`;
    const moved = !this.dot.visible || Math.abs(x - this.dotPos[0]) + Math.abs(y - this.dotPos[1]) + Math.abs(z - this.dotPos[2]) > 0.02 || key !== this._key;
    if (moved) {
      this.dotPos[0] = x; this.dotPos[1] = y; this.dotPos[2] = z;
      this.dot.geometry.attributes.position.needsUpdate = true;
      this.dot.geometry.computeBoundingSphere();
      if (key !== this._key) {
        // en la sombra de la Tierra la ISS no refleja el Sol: un punto pequeño y tenue, gris azulado
        this.dotMat.color.set(q.lit ? ISS_COLORS.dot : ISS_COLORS.dotShadow);
        this.dotMat.opacity = q.lit ? 1 : 0.45;
        this.dotMat.size = (q.lit ? this.dotPx : this.dotPx * 0.62) * this.pr;
        this._key = key;
      }
      this.dot.visible = true;
    }
    return moved;
  }

  /** Posición del punto en el mundo (para el toque), o null si no se dibuja. */
  dotWorld(out = new THREE.Vector3()) {
    if (!this.active || !this.dot.visible) return null;
    return out.set(this.dotPos[0], this.dotPos[1], this.dotPos[2]).applyMatrix4(this.group.matrixWorld);
  }

  /**
   * Etiquetas ya proyectadas a la pantalla (px CSS), de mayor a menor prioridad:
   *   «ISS» junto al punto (prio 6) · hora de inicio y de fin (prio 4) · hora de cada minuto (prio 2),
   *   aclaradas para que no se amontonen (≥ 46 px entre ellas).
   * opts.clock(ms) → "19:36" (hora local corta); opts.name → texto del punto (por defecto «ISS»).
   */
  labelsForView(camera, viewport, { clock = (ms) => new Date(ms).toISOString().slice(11, 16), name = "ISS" } = {}) {
    if (!this.active) return [];
    const W = viewport.w, H = viewport.h, R = this.radius, out = [];
    this.group.updateMatrixWorld(true);
    _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const proj = (local, r = R) => {
      _v.set(local[0] * r, local[1] * r, local[2] * r).applyMatrix4(this.group.matrixWorld);
      if (_v.clone().sub(camera.position).dot(_f) <= 0) return null;      // detrás del observador
      _v.project(camera);
      if (!(_v.z < 1) || Math.abs(_v.x) > 1.02 || Math.abs(_v.y) > 1.02) return null;
      return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H };
    };
    if (this.pos && this.dot.visible) {
      const s = proj(this.pos.local, R - 4);
      if (s) out.push({ key: "iss:dot", name, cls: "iss", x: s.x, y: s.y, prio: 6, dx: 12, pk: { iss: true } });
    }
    const cands = [];
    if (this.ends) {
      for (const k of ["start", "end"]) {
        const e = this.ends[k], s = proj(e.local);
        if (s) cands.push({ key: `iss:${k}`, name: clock(e.tMs), cls: "iss_t", x: s.x, y: s.y, prio: 4, dx: 9, edge: k });
      }
    }
    for (const k of this.ticks) {
      const s = proj(k.local);
      if (s) cands.push({ key: `iss:t${k.tMs}`, name: clock(k.tMs), cls: "iss_t", x: s.x, y: s.y, prio: 2, dx: 7 });
    }
    // las horas no se ponen encima del nombre «ISS»
    const thinned = thinLabels([...out.map((o) => ({ ...o, _dot: true })), ...cands], 46).filter((c) => !c._dot);
    return [...out, ...thinned.sort((a, b) => b.prio - a.prio)];
  }

  /**
   * Comprobación de lo DIBUJADO (lee los vértices de las geometrías, no los datos): altura máxima de la
   * trayectoria y distancia angular (°) de un punto (alt, az) a la polilínea, medida sobre la esfera
   * (cada segmento recto, visto desde el centro, es un arco de círculo máximo). → { peakAlt, distDeg } | null.
   */
  drawnCheck(alt, az) {
    const p = [Math.cos(alt * D2R) * Math.sin(az * D2R), Math.sin(alt * D2R), -Math.cos(alt * D2R) * Math.cos(az * D2R)];
    let peak = -90, best = 180;
    for (const o of this.trackGroup.children) {
      if (o.type !== "Line" || (o.material !== this.mats.lit && o.material !== this.mats.shadow)) continue;
      const a = o.geometry.attributes.position.array;
      for (let i = 0; i + 2 < a.length; i += 3) {
        const u = norm([a[i], a[i + 1], a[i + 2]]);
        peak = Math.max(peak, Math.asin(u[1]) / D2R);
        best = Math.min(best, Math.acos(Math.max(-1, Math.min(1, dot(u, p)))) / D2R);
        if (i + 5 < a.length) best = Math.min(best, arcDistance(p, u, norm([a[i + 3], a[i + 4], a[i + 5]])));
      }
    }
    return peak > -90 ? { peakAlt: peak, distDeg: best } : null;
  }

  dispose() {
    this._clearTrack();
    this.dot.geometry.dispose();
    this.dotMat.dispose();
    if (this.tex) this.tex.dispose();
    for (const k in this.mats) this.mats[k].dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
    this.pass = null;
  }
}

export function createIssLayer(opts) { return new IssLayer(opts); }
export default IssLayer;
