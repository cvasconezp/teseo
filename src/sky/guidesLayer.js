// guidesLayer.js — capa three.js de LÍNEAS GUÍA para la vista Cielo (geometría en guides.js).
//
//   const guides = new GuidesLayer({ radius: 900, lang: "es" });
//   scene.add(guides.group);
//   guides.setVisible("ecliptic", true);
//   guides.setLocalFrame(qJ2000 | null, qDate);   // ver setLocalFrame: cuaterniones J2000 → mundo y fecha → mundo
//   guides.setFov(camera.fov);                 // densidad de las cuadrículas según el zoom
//   const labels = guides.labelsForView(camera, { w, h });   // [{ key, name, cls, x, y, prio, guide, flip }]
//   guides.dispose();
//
// Estructura: group ─┬─ eq     (ecuatorial J2000: eclíptica y plano galáctico; se gira como las estrellas)
//                    ├─ eqDate (ecuador, cuadrícula AR/Dec y polos celestes DE LA FECHA: el polo alrededor
//                    │          del que gira el cielo esa noche, a ~0,15° del de J2000 en 2026)
//                    └─ local  (marco del horizonte: +X este, +Y cenit, −Z norte; solo en "Mi cielo")
// La eclíptica y el plano galáctico están fijos a las estrellas del catálogo (J2000; la eclíptica de la
// fecha se separa de la de J2000 < 0,01° en este siglo). El ecuador, la cuadrícula y los polos son los de
// la fecha (como la cuadrícula ecuatorial por defecto de Stellarium): así el meridiano local pasa por el
// polo dibujado, el cenit queda en Dec = latitud y la AR rotulada es la de la fecha (la de la ficha de los
// planetas). Ver src/sky/frames.js.
// Las geometrías se crean una vez (las de cuadrícula fina, la primera vez que hacen falta) y
// nunca por fotograma. Materiales finos, sin escribir profundidad y con renderOrder −1: se
// dibujan antes que las estrellas (aditivas), las figuras y el suelo, y las etiquetas HTML
// quedan siempre encima.
import * as THREE from "three";
import {
  eclipticPoints, equatorPoints, galacticEquatorPoints, meridianPoints, eqGridLines, altAzGridLines,
  gridLevelForFov, labelSpecs, GUIDE_KEYS, LOCAL_ONLY, NCP, SCP, ZENITH, NADIR, GUIDE_COLORS, GUIDE_LABEL_COLOR,
} from "./guides.js";

export { GUIDE_COLORS, GUIDE_LABEL_COLOR };
import { GUIDES as GUIDES_TX } from "./i18n-guides.js";

// (las líneas de WebGL miden 1 px físico: con 3 px por punto en el teléfono hacen falta opacidades altas)
const OPACITY = { ecliptic: 0.95, equator: 0.85, galactic: 0.8, eqGridMajor: 0.3, eqGridMinor: 0.15, altAzMajor: 0.32, altAzMinor: 0.16, meridian: 0.8, poles: 0.9 };

const mat = (color, opacity, dashed = false) => {
  const o = { color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, fog: false, toneMapped: false };
  return dashed ? new THREE.LineDashedMaterial({ ...o, dashSize: 9, gapSize: 7 }) : new THREE.LineBasicMaterial(o);
};
const scaled = (pts, R) => { const a = new Float32Array(pts.length); for (let i = 0; i < pts.length; i++) a[i] = pts[i] * R; return a; };
const geoOf = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(arr, 3)); g.computeBoundingSphere(); return g; };
// círculo cerrado como LineLoop (o como Line con el primer punto repetido si va a trazos)
function loop(pts, R, material, dashed) {
  let arr = scaled(pts, R);
  if (dashed) { const b = new Float32Array(arr.length + 3); b.set(arr); b.set(arr.subarray(0, 3), arr.length); arr = b; }
  const o = dashed ? new THREE.Line(geoOf(arr), material) : new THREE.LineLoop(geoOf(arr), material);
  if (dashed) o.computeLineDistances();
  return o;
}
// varias polilíneas (abiertas o cerradas) en un solo LineSegments: una llamada de dibujo
function segments(lines, R, material) {
  let n = 0;
  for (const l of lines) { const k = l.pts.length / 3; n += l.closed ? k : k - 1; }
  const arr = new Float32Array(n * 6);
  let o = 0;
  for (const l of lines) {
    const p = l.pts, k = p.length / 3, m = l.closed ? k : k - 1;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % k;
      arr[o++] = p[i * 3] * R; arr[o++] = p[i * 3 + 1] * R; arr[o++] = p[i * 3 + 2] * R;
      arr[o++] = p[j * 3] * R; arr[o++] = p[j * 3 + 1] * R; arr[o++] = p[j * 3 + 2] * R;
    }
  }
  return new THREE.LineSegments(geoOf(arr), material);
}
// marca de polo o cenit: anillo de 1,2° y cruz de 2,4°, en el plano tangente a `dir`
function marker(dir, R, material) {
  const d = new THREE.Vector3(...dir).normalize();
  const a = new THREE.Vector3(Math.abs(d.z) > 0.9 ? 1 : 0, Math.abs(d.z) > 0.9 ? 0 : 0, Math.abs(d.z) > 0.9 ? 0 : 1);
  const u = new THREE.Vector3().crossVectors(d, a).normalize(), v = new THREE.Vector3().crossVectors(d, u);
  const r = Math.tan(1.2 * Math.PI / 180), c = Math.tan(2.4 * Math.PI / 180), lines = [], ring = [];
  const at = (x, y) => new THREE.Vector3().copy(d).addScaledVector(u, x).addScaledVector(v, y).normalize();
  for (let i = 0; i < 32; i++) { const t = i / 32 * Math.PI * 2, p = at(Math.cos(t) * r, Math.sin(t) * r); ring.push(p.x, p.y, p.z); }
  lines.push({ pts: new Float32Array(ring), closed: true });
  for (const [x0, y0, x1, y1] of [[-c, 0, -r, 0], [r, 0, c, 0], [0, -c, 0, -r], [0, r, 0, c]]) {
    const p = at(x0, y0), q = at(x1, y1); lines.push({ pts: new Float32Array([p.x, p.y, p.z, q.x, q.y, q.z]) });
  }
  return segments(lines, R, material);
}

// guías ecuatoriales que se dibujan en el ecuador DE LA FECHA (grupo eqDate)
export const DATE_GUIDES = new Set(["equator", "eqGrid", "poles"]);

const _vp = new THREE.Matrix4(), _cp = new THREE.Vector3(), _f = new THREE.Vector3(), _h = new THREE.Vector3();

export class GuidesLayer {
  constructor({ radius = 900, lang = "es" } = {}) {
    this.radius = radius;
    this.lang = lang;
    this.state = Object.fromEntries(GUIDE_KEYS.map((k) => [k, false]));
    this.localOn = false;
    this.level = 0;
    this.group = new THREE.Group(); this.group.name = "guides";
    this.eq = new THREE.Group(); this.eq.name = "guides-eq";
    this.eqDate = new THREE.Group(); this.eqDate.name = "guides-eq-date";
    this.local = new THREE.Group(); this.local.name = "guides-local";
    this.group.add(this.eq, this.eqDate, this.local);
    this.mats = {
      ecliptic: mat(GUIDE_COLORS.ecliptic, OPACITY.ecliptic),
      equator: mat(GUIDE_COLORS.equator, OPACITY.equator),
      galactic: mat(GUIDE_COLORS.galactic, OPACITY.galactic, true),
      eqGridMajor: mat(GUIDE_COLORS.eqGrid, OPACITY.eqGridMajor), eqGridMinor: mat(GUIDE_COLORS.eqGrid, OPACITY.eqGridMinor),
      altAzMajor: mat(GUIDE_COLORS.altAzGrid, OPACITY.altAzMajor), altAzMinor: mat(GUIDE_COLORS.altAzGrid, OPACITY.altAzMinor),
      meridian: mat(GUIDE_COLORS.meridian, OPACITY.meridian),
      poles: mat(GUIDE_COLORS.poles, OPACITY.poles),
    };
    const R = radius;
    this.objs = {
      ecliptic: loop(eclipticPoints(1), R, this.mats.ecliptic),
      equator: loop(equatorPoints(1), R, this.mats.equator),
      galactic: loop(galacticEquatorPoints(1), R, this.mats.galactic, true),
      meridian: loop(meridianPoints(1), R, this.mats.meridian),
      polesEq: new THREE.Group(), polesLocal: new THREE.Group(),
      eqGrid: new THREE.Group(), altAzGrid: new THREE.Group(),
    };
    this.objs.polesEq.add(marker(NCP, R, this.mats.poles), marker(SCP, R, this.mats.poles));
    this.objs.polesLocal.add(marker(ZENITH, R, this.mats.poles), marker(NADIR, R, this.mats.poles));
    this.eq.add(this.objs.galactic, this.objs.ecliptic);
    this.eqDate.add(this.objs.eqGrid, this.objs.equator, this.objs.polesEq);
    this.local.add(this.objs.altAzGrid, this.objs.meridian, this.objs.polesLocal);
    this.gridLevels = { eqGrid: [], altAzGrid: [] };   // por nivel: { major, minor } (se crean al necesitarse)
    this.group.traverse((o) => { o.renderOrder = -1; o.frustumCulled = false; });
    this._specs = null; this._specsKey = "";
    this._apply();
  }

  _ensureLevel(kind, lvl) {
    const list = this.gridLevels[kind];
    if (list[lvl]) return list[lvl];
    const R = this.radius;
    // muestreo: 1° para las principales (se ven con cualquier zoom) y para las del nivel 2 (campo < 13°);
    // 2° basta para las del nivel 1 (campo 13–38°: la cuerda se separa del arco < 1 px)
    const sample = lvl === 1 ? 2 : 1;
    let major = null, minor = null;
    if (kind === "eqGrid") {
      const g = eqGridLines(lvl, sample), lines = [...g.meridians, ...g.parallels.map((p) => ({ ...p, closed: true }))];
      if (lvl === 0) major = segments(lines, R, this.mats.eqGridMajor);
      else { const mi = lines.filter((l) => !l.major); if (mi.length) minor = segments(mi, R, this.mats.eqGridMinor); }
    } else {
      const g = altAzGridLines(lvl, sample), lines = [...g.verticals, ...g.almucantars.map((a) => ({ ...a, closed: true }))];
      if (lvl === 0) major = segments(lines, R, this.mats.altAzMajor);
      else { const mi = lines.filter((l) => !l.major); if (mi.length) minor = segments(mi, R, this.mats.altAzMinor); }
    }
    for (const o of [major, minor]) if (o) { o.renderOrder = -1; o.frustumCulled = false; this.objs[kind].add(o); }
    list[lvl] = { major, minor };
    return list[lvl];
  }

  _apply() {
    const s = this.state, loc = this.localOn;
    this.objs.ecliptic.visible = s.ecliptic;
    this.objs.equator.visible = s.equator;
    this.objs.galactic.visible = s.galactic;
    this.objs.polesEq.visible = s.poles;
    this.local.visible = loc;
    this.objs.meridian.visible = s.meridian;
    this.objs.polesLocal.visible = s.poles;
    for (const kind of ["eqGrid", "altAzGrid"]) {
      const on = s[kind] && (kind !== "altAzGrid" || loc);
      this.objs[kind].visible = on;
      if (!on) continue;
      // el nivel 0 (líneas principales) siempre; las secundarias, solo las del nivel actual
      this._ensureLevel(kind, 0);
      if (this.level > 0) this._ensureLevel(kind, this.level);
      this.gridLevels[kind].forEach((L, i) => { if (L && L.minor) L.minor.visible = i === this.level; });
    }
    this.eq.visible = s.ecliptic || s.galactic;
    this.eqDate.visible = s.equator || s.eqGrid || s.poles;
  }

  /** Enciende o apaga una guía ("ecliptic", "equator", "galactic", "eqGrid", "altAzGrid", "meridian", "poles"). */
  setVisible(key, on) {
    if (!(key in this.state)) return;
    this.state[key] = !!on;
    this._apply();
  }
  /** Aplica de una vez un objeto { clave: booleano } (p. ej. el estado del panel). */
  setAll(obj) { for (const k of GUIDE_KEYS) if (obj && k in obj) this.state[k] = !!obj[k]; this._apply(); }
  isVisible(key) { return !!this.state[key] && (!LOCAL_ONLY.has(key) || this.localOn); }
  anyVisible() { return GUIDE_KEYS.some((k) => this.isVisible(k)); }

  /**
   * Marco de las guías.
   *   q      "Mi cielo": cuaternión J2000 → local, el mismo que gira las estrellas (localSkyQuatJ2000).
   *          null = sin ubicación: el mundo es el propio J2000 (identidad) y no hay guías locales.
   *   qDate  cuaternión ecuador de la fecha → mundo, para ecuador, cuadrícula y polos: en "Mi cielo",
   *          localSkyQuat (look.js); sin ubicación, la precesión inversa (precessionQuat(date).invert()).
   *          Si falta, el de q (o la identidad): todas las guías en J2000.
   */
  setLocalFrame(q, qDate) {
    if (q) { this.eq.quaternion.copy(q); this.localOn = true; }
    else { this.eq.quaternion.identity(); this.localOn = false; }
    if (qDate) this.eqDate.quaternion.copy(qDate); else this.eqDate.quaternion.copy(this.eq.quaternion);
    this.group.updateMatrixWorld(true);
    this._apply();
  }
  /** Campo de visión vertical actual (grados): elige la densidad de las cuadrículas. */
  setFov(fovDeg) {
    const lvl = gridLevelForFov(fovDeg, this.level);
    if (lvl === this.level) return false;
    this.level = lvl;
    this._apply();
    return true;
  }
  setLang(lang) { this.lang = lang === "en" ? "en" : "es"; }

  _labelSpecs() {
    const key = `${this.level}|${this.lang}`;
    if (this._specsKey !== key) {
      const tx = GUIDES_TX[this.lang] || GUIDES_TX.es;
      this._specs = labelSpecs(this.level, { ...tx.lineName, ...tx.poleName }, this.lang);
      this._specsKey = key;
    }
    return this._specs;
  }

  /**
   * Etiquetas de las guías visibles, ya proyectadas a la pantalla (px CSS, origen arriba a la izquierda).
   * camera: la de la vista (matrices al día). viewport: { w, h }.
   * Devuelve [{ key, name, cls, guide, x, y, prio, flip, alts? }], de mayor a menor prioridad (alts: otras
 * posiciones posibles del nombre de una línea, por si la primera está ocupada):
   *   · nombres de línea ("Eclíptica"…), en el punto de la línea más cercano al centro;
   *   · polos, cenit y nadir; · AR y azimut abajo; Dec a la izquierda y altitud a la derecha.
   * Respeta lo que ya hace la vista: en "Mi cielo" no nombra lo que está bajo el horizonte
   * (salvo las líneas del propio horizonte y el nadir) y, vista desde fuera, nada de la cara oculta.
   */
  labelsForView(camera, viewport) {
    const out = [];
    if (!this.anyVisible()) return out;
    const W = viewport.w, H = viewport.h, R = this.radius;
    this.group.updateMatrixWorld(true);
    _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const e = _vp.elements;
    camera.getWorldPosition(_cp);
    const outside = _cp.length() > R * 0.25;
    const specs = this._labelSpecs();
    const mEq = this.eq.matrixWorld.elements, mEqD = this.eqDate.matrixWorld.elements, mLo = this.local.matrixWorld.elements;
    let sx = 0, sy = 0;
    // proyecta la muestra i de pts en el marco m; deja la posición en sx, sy. false si no se ve.
    const proj = (pts, i, m, below) => {
      const x = pts[i * 3] * R, y = pts[i * 3 + 1] * R, z = pts[i * 3 + 2] * R;
      const wx = m[0] * x + m[4] * y + m[8] * z + m[12], wy = m[1] * x + m[5] * y + m[9] * z + m[13], wz = m[2] * x + m[6] * y + m[10] * z + m[14];
      if (this.localOn && !below && wy < -0.02 * R) return false;
      if (outside && wx * _cp.x + wy * _cp.y + wz * _cp.z <= wx * wx + wy * wy + wz * wz) return false;
      const cw = e[3] * wx + e[7] * wy + e[11] * wz + e[15];
      if (cw <= 1e-6) return false;
      const cx = (e[0] * wx + e[4] * wy + e[8] * wz + e[12]) / cw, cy = (e[1] * wx + e[5] * wy + e[9] * wz + e[13]) / cw;
      if (cx < -1.2 || cx > 1.2 || cy < -1.2 || cy > 1.2) return false;
      sx = (cx * 0.5 + 0.5) * W; sy = (-cy * 0.5 + 0.5) * H;
      return true;
    };
    const txL = 12, txR = W - 12, mx = 12, my = 56;
    const inBox = (x, y) => x >= mx && x <= W - mx && y >= my && y <= H - my;
    // AR y azimut van sobre una horizontal de la pantalla: el 80 % de la altura o, en "Mi cielo",
    // justo encima del horizonte si este queda más arriba (bajo el suelo no se leerían).
    let tyRA = H * 0.8, tyAz = H * 0.8;
    if (this.localOn) {
      const f = _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const hl = Math.hypot(f.x, f.z);
      if (hl > 0.05) {
        _h.set(f.x / hl * R, 0, f.z / hl * R).project(camera);
        const yh = (-_h.y * 0.5 + 0.5) * H;
        if (_h.z < 1 && yh > my + 60 && yh < H * 0.8 + 14) { tyAz = yh - 14; tyRA = yh - 40; }
      }
    }
    // cajas ocupadas por las propias etiquetas de las guías (los nombres no se pisan entre sí)
    const boxes = [];
    const boxOf = (x, y, text) => [x - 4, y - 10, x + text.length * 7.6 + 14, y + 10];
    const hits = (b) => boxes.some((o) => b[2] > o[0] && b[0] < o[2] && b[3] > o[1] && b[1] < o[3]);
    const push = (sp, cls, x, y, prio, flip) => out.push({ key: `${cls}:${sp.id}`, name: sp.text, cls, guide: sp.guide, x, y, prio, flip });
    const cand = [];
    // tres pasadas: puntos fijos (polos, cenit), nombres de línea, y marcas de cuadrícula
    for (const pass of ["point", "center", "cross"]) {
      for (const sp of specs) {
        const mode = sp.mode === "point" || sp.mode === "center" ? sp.mode : "cross";
        if (mode !== pass || !this.isVisible(sp.guide) || (sp.localOnly && !this.localOn)) continue;
        const m = sp.frame === "local" ? mLo : DATE_GUIDES.has(sp.guide) ? mEqD : mEq, pts = sp.pts, n = pts.length / 3;
        const below = sp.frame === "local";
        const cls = "guide_" + sp.guide;
        if (mode === "point") {
          if (proj(pts, 0, m, true) && inBox(sx, sy)) { push(sp, cls, sx, sy, 2, false); boxes.push(boxOf(sx, sy, sp.text)); }
          continue;
        }
        if (mode === "center") {
          // el punto de la línea más cercano al centro que no pise otro nombre de guía
          cand.length = 0;
          for (let i = 0; i < n; i++) if (proj(pts, i, m, below) && inBox(sx, sy)) cand.push((sx - W / 2) ** 2 + (sy - H / 2) ** 2, sx, sy);
          let bi = -1, bd = Infinity;
          for (let pass2 = 0; pass2 < 2 && bi < 0; pass2++) {
            for (let k = 0; k < cand.length; k += 3) {
              if (cand[k] >= bd) continue;
              if (pass2 === 0 && hits(boxOf(cand[k + 1], cand[k + 2], sp.text))) continue;
              bd = cand[k]; bi = k;
            }
          }
          if (bi >= 0) {
            push(sp, cls, cand[bi + 1], cand[bi + 2], 3, false); boxes.push(boxOf(cand[bi + 1], cand[bi + 2], sp.text));
            // otras posiciones a lo largo de la línea (cada ≥ 70 px, de más a menos centrada) por si la vista
            // no puede poner el nombre en la primera porque ya hay ahí una estrella u otro nombre
            const alts = [], used = [[cand[bi + 1], cand[bi + 2]]], order = [];
            for (let k = 0; k < cand.length; k += 3) order.push(k);
            order.sort((a, b) => cand[a] - cand[b]);
            for (const k of order) {
              if (alts.length >= 6) break;
              const x = cand[k + 1], y = cand[k + 2];
              if (used.some(([ux, uy]) => (x - ux) ** 2 + (y - uy) ** 2 < 4900)) continue;
              used.push([x, y]); alts.push({ x, y });
            }
            out[out.length - 1].alts = alts;
          }
          continue;
        }
        // cruce con una recta de la pantalla: "y" (horizontal abajo), "x" (vertical izquierda), "x2" (derecha)
        const alongY = sp.mode === "y";
        const target = alongY ? (sp.frame === "local" ? tyAz : tyRA) : sp.mode === "x" ? txL : txR;
        const m2 = sp.closed ? n : n - 1;
        let best = Infinity, bx = 0, by = 0, pOk = proj(pts, 0, m, below), px = sx, py = sy;
        for (let i = 1; i <= m2; i++) {
          const ok = proj(pts, i % n, m, below), cx = sx, cy = sy;
          if (ok && pOk) {
            const a = alongY ? py - target : px - target, b = alongY ? cy - target : cx - target;
            if (a * b <= 0 && Math.abs(cx - px) + Math.abs(cy - py) < Math.max(W, H) * 0.5) {
              const f = a === b ? 0 : a / (a - b);
              const ix = px + (cx - px) * f, iy = py + (cy - py) * f;
              const fx = alongY ? ix : target, fy = alongY ? target : iy;
              if (inBox(fx, fy)) {
                const d = alongY ? Math.abs(fx - W / 2) : Math.abs(fy - H / 2);
                if (d < best) { best = d; bx = fx; by = fy; }
              }
            }
          }
          pOk = ok; px = cx; py = cy;
        }
        if (best < Infinity) push(sp, cls, bx, by, 1, sp.mode === "x2");
      }
    }
    out.sort((a, b) => b.prio - a.prio);
    return out;
  }

  /** Libera geometrías y materiales y saca el grupo de la escena. */
  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const k in this.mats) this.mats[k].dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
    this.gridLevels = { eqGrid: [], altAzGrid: [] };
    this._specs = null;
  }
}

export function createGuidesLayer(opts) { return new GuidesLayer(opts); }
export default GuidesLayer;
