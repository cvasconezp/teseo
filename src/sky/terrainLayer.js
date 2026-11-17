// terrainLayer.js — las montañas del horizonte real en la vista Cielo (three.js), en el marco local del
// horizonte (Y = cenit, −Z = norte, +X = este; el grupo «horizon» de Constellations.jsx).
//
// Una franja por banda de distancia (horizon.js / backend/app/horizon.py), de la más lejana a la más cercana:
// cada una sube desde 0° hasta el filo de esa banda en cada acimut. Por columna hay cuatro vértices —filo,
// línea de nieves (dos: blanco arriba, tierra abajo, para un borde limpio) y base—, de modo que la nieve
// ocupa solo lo que queda sobre la línea de nieves (con la distancia de cada filo se sabe a qué altura angular
// cae). Las laderas que miran al Sol se aclaran y las otras se oscurecen; las bandas lejanas se aclaran por la
// perspectiva aérea, y cada filo lleva una línea fina que lo separa de la banda de atrás. Opacas: tapan
// estrellas, planetas, la ISS y las nubes que quedan detrás. Bajo 0° sigue el suelo sombreado de siempre.
import * as THREE from "three";
import { terrainPalette, snowLine } from "./horizon.js";

const RAD = Math.PI / 180;
const R_E = 6371008.8, K_REFR = 0.13;
const BASE = -0.4;            // grados: base de cada franja, un poco bajo 0° para no dejar rendija con el suelo

/** Altura angular (grados) a la que queda un punto de altura `hM` a `dKm` km para un observador a `h0M` m. */
export function angleOf(hM, dKm, h0M) {
  const d = Math.max(1, dKm * 1000), drop = (d * d * (1 - K_REFR)) / (2 * R_E);
  return Math.atan2(hM - h0M - drop, d) / RAD;
}

/** Altura angular de la línea de nieves en cada columna de una banda (o null si esa cumbre no la alcanza). */
export function snowAngles(band, h0M, snowH) {
  return band.alt.map((a, j) => {
    if (!(band.top_m[j] > snowH) || !band.dist_km) return null;
    return Math.min(a, angleOf(snowH, band.dist_km[j], h0M));
  });
}

export function createTerrainLayer({ radius = 880 } = {}) {
  const group = new THREE.Group();
  group.name = "terrain";
  group.visible = false;
  let meshes = [], data = null, lat = 0, enabledFlag = true;
  const clear = () => {
    for (const m of meshes) { m.geometry.dispose(); m.material.dispose(); group.remove(m); }
    meshes = [];
  };
  const P = (az, alt) => [radius * Math.cos(alt * RAD) * Math.sin(az * RAD), radius * Math.sin(alt * RAD), -radius * Math.cos(alt * RAD) * Math.cos(az * RAD)];

  function build(hz, latDeg) {
    clear();
    data = hz; lat = latDeg || 0;
    if (!hz || !hz.bands || !hz.bands.length) return;
    const n = hz.alt.length, step = hz.step_deg || 360 / n, nb = hz.bands.length;
    const h0 = (hz.ground_m || 0) + (hz.eye_m || 1.7), snowH = snowLine(lat);
    for (let k = nb - 1; k >= 0; k--) {                 // de la más lejana a la más cercana
      const b = hz.bands[k], sa = snowAngles(b, h0, snowH);
      const pos = new Float32Array((n + 1) * 4 * 3), col = new Float32Array((n + 1) * 4 * 3), idx = [];
      const line = new Float32Array((n + 1) * 3);
      for (let i = 0; i <= n; i++) {
        const j = i % n, az = j * step, top = Math.max(0, b.alt[j]);
        const snow = sa[j] == null ? top : Math.max(0, Math.min(top, sa[j]));
        pos.set(P(az, top), (i * 4) * 3);
        pos.set(P(az, snow), (i * 4 + 1) * 3);
        pos.set(P(az, snow), (i * 4 + 2) * 3);
        pos.set(P(az, BASE), (i * 4 + 3) * 3);
        line.set(P(az, top + 0.005), i * 3);
        if (i < n) {
          const a = i * 4, c = a + 4;
          idx.push(a, a + 1, c, a + 1, c + 1, c);             // nieve: filo → línea de nieves
          idx.push(a + 2, a + 3, c + 2, a + 3, c + 3, c + 2); // tierra: línea de nieves → base
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setIndex(idx);
      // transparente (aunque opaca) para entrar en la misma pasada que estrellas, líneas y nubes, que three dibuja
      // después de los objetos opacos: así el orden lo decide renderOrder y las montañas quedan encima
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 1, depthTest: false, depthWrite: false, fog: false }));
      m.renderOrder = 2.7 + (nb - 1 - k) * 0.01;      // después de las nubes (2,5); las cercanas, al final
      m.frustumCulled = false;
      m.userData.band = k;
      meshes.push(m); group.add(m);
      // el filo: una línea fina que separa esta banda de la de atrás
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.BufferAttribute(line, 3));
      const l = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, fog: false }));
      l.renderOrder = m.renderOrder + 0.005;
      l.frustumCulled = false;
      l.userData.band = k; l.userData.line = true;
      meshes.push(l); group.add(l);
    }
  }

  // los colores de la paleta son como los del domo de atmósfera (que se escriben tal cual en pantalla); el
  // material básico convierte de lineal a sRGB, así que se pasan a lineal para que coincidan
  const lin = (c) => [Math.pow(Math.max(0, c[0]), 2.2), Math.pow(Math.max(0, c[1]), 2.2), Math.pow(Math.max(0, c[2]), 2.2)];
  const scale = (c, f) => [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
  /** Colorea según la luz del cielo (st = skyState(...) o null). */
  function paint(st) {
    if (!data) return;
    const n = data.alt.length, step = data.step_deg || 360 / n, nb = data.bands.length;
    const pal = terrainPalette(st, nb);
    // de dónde viene la luz del Sol (acimut) y cuánto marca el relieve (más con el Sol bajo, nada de noche)
    const sd = st && st.sunDir ? st.sunDir : null;
    const sunAz = sd ? Math.atan2(sd[0], -sd[2]) : 0;
    const relief = sd ? pal.day * (0.22 + 0.3 * (1 - Math.min(1, Math.max(0, sd[1])))) : 0;
    const W = Math.max(1, Math.round(1.5 / step));
    for (const m of meshes) {
      const k = m.userData.band, b = data.bands[k], c = pal.bands[k];
      if (m.userData.line) {
        // de noche, un filo algo más claro que la banda; de día, algo más oscuro (como en un grabado)
        const e = pal.day > 0.5 ? scale(c.top, 0.72) : [c.top[0] + 0.07, c.top[1] + 0.075, c.top[2] + 0.1];
        m.material.color.setRGB(...lin(e));
        m.material.opacity = 0.5 + 0.3 * (1 - k / Math.max(1, nb - 1));
        continue;
      }
      const col = m.geometry.attributes.color.array;
      for (let i = 0; i <= n; i++) {
        const j = i % n, az = j * step * RAD;
        // pendiente del filo (suavizada en ±1,5°, para que no salgan rayas): si sube hacia la derecha, la
        // ladera visible mira a la izquierda (hacia acimut menor)
        const slope = (b.alt[(j + W) % n] - b.alt[(j - W + n) % n]) / (2 * W * step);
        const shade = 1 + relief * Math.tanh(2 * slope) * Math.sin(az - sunAz);
        const snow = scale(pal.snow, 0.86 + 0.14 * shade);
        col.set(lin(snow), (i * 4) * 3);
        col.set(lin(scale(snow, 0.94)), (i * 4 + 1) * 3);
        col.set(lin(scale(c.top, shade)), (i * 4 + 2) * 3);
        col.set(lin(scale(c.bottom, 0.5 + 0.5 * shade)), (i * 4 + 3) * 3);
      }
      m.geometry.attributes.color.needsUpdate = true;
    }
  }

  return {
    group,
    /** hz: respuesta de /api/horizon (o null para quitarlo); latDeg: para la línea de nieves. */
    set(hz, latDeg, st) { build(hz, latDeg); paint(st); group.visible = !!hz && meshes.length > 0 && enabledFlag; },
    paint,
    setEnabled(b) { enabledFlag = !!b; group.visible = enabledFlag && meshes.length > 0; },
    get data() { return data; },
    dispose() { clear(); if (group.parent) group.parent.remove(group); },
  };
}
