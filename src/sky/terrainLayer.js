// terrainLayer.js — las montañas del horizonte real en la vista Cielo (three.js), en el marco local del
// horizonte (Y = cenit, −Z = norte, +X = este; el grupo «horizon» de Constellations.jsx).
//
// Una franja por banda de distancia (horizon.js / backend/app/horizon.py), de la más lejana a la más cercana:
// cada una sube desde 0° hasta el filo de esa banda en cada acimut, con su color (las lejanas, más claras
// por la perspectiva aérea) y nieve en las cumbres que pasan la línea de nieves. Opacas: tapan estrellas,
// planetas, la ISS y las nubes que quedan detrás (renderOrder después de todos ellos). Bajo 0° sigue el suelo
// sombreado de siempre, que deja ver lo que hay debajo.
import * as THREE from "three";
import { terrainPalette, snowLine } from "./horizon.js";

const RAD = Math.PI / 180;

export function createTerrainLayer({ radius = 880 } = {}) {
  const group = new THREE.Group();
  group.name = "terrain";
  group.visible = false;
  let meshes = [], data = null, lat = 0, enabledFlag = true;

  const clear = () => { for (const m of meshes) { m.geometry.dispose(); m.material.dispose(); group.remove(m); } meshes = []; };

  function build(hz, latDeg) {
    clear();
    data = hz; lat = latDeg || 0;
    if (!hz || !hz.bands || !hz.bands.length) return;
    const n = hz.alt.length, step = hz.step_deg || 360 / n;
    const nb = hz.bands.length;
    // de la banda más lejana a la más cercana: cada una se dibuja encima de la anterior
    for (let k = nb - 1; k >= 0; k--) {
      const b = hz.bands[k];
      const pos = new Float32Array((n + 1) * 2 * 3), col = new Float32Array((n + 1) * 2 * 3);
      const idx = [];
      for (let i = 0; i <= n; i++) {
        const j = i % n, az = j * step * RAD, top = Math.max(0, b.alt[j]) * RAD;
        const sa = Math.sin(az), ca = Math.cos(az);
        // filo
        pos.set([radius * Math.cos(top) * sa, radius * Math.sin(top), -radius * Math.cos(top) * ca], (i * 2) * 3);
        // base: un poco bajo 0° para no dejar rendija con el suelo
        const bot = -0.4 * RAD;
        pos.set([radius * Math.cos(bot) * sa, radius * Math.sin(bot), -radius * Math.cos(bot) * ca], (i * 2 + 1) * 3);
        if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 1, depthTest: false, depthWrite: false, fog: false }));
      // transparente (aunque opaca) para entrar en la misma pasada que estrellas, líneas y nubes, que three dibuja
      // después de los objetos opacos: así el orden lo decide renderOrder y las montañas quedan encima
      m.renderOrder = 2.7 + (nb - 1 - k) * 0.01;      // después de las nubes (2,5); las cercanas, al final
      m.frustumCulled = false;
      m.userData.band = k;
      meshes.push(m); group.add(m);
    }
  }

  // los colores de la paleta son como los del domo de atmósfera (que se escriben tal cual en pantalla); el
  // material básico convierte de lineal a sRGB, así que se pasan a lineal para que coincidan
  const lin = (c) => [Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2)];
  /** Colorea según la luz del cielo (st = skyState(...) o null). */
  function paint(st) {
    if (!data) return;
    const pal = terrainPalette(st, data.bands.length), snowH = snowLine(lat), n = data.alt.length;
    for (const m of meshes) {
      const k = m.userData.band, b = data.bands[k], c = pal.bands[k], col = m.geometry.attributes.color.array;
      for (let i = 0; i <= n; i++) {
        const j = i % n;
        // nieve: solo en el filo de las cumbres que pasan la línea de nieves (y se nota de día)
        const sn = Math.min(1, Math.max(0, (b.top_m[j] - snowH) / 350)) * (b.alt[j] > 0 ? 1 : 0);
        const tc = [c.top[0] + (pal.snow[0] - c.top[0]) * sn, c.top[1] + (pal.snow[1] - c.top[1]) * sn, c.top[2] + (pal.snow[2] - c.top[2]) * sn];
        col.set(lin(tc), (i * 2) * 3);
        col.set(lin(c.bottom), (i * 2 + 1) * 3);
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
