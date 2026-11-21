// terrainLayer.js — las montañas del horizonte real en la vista Cielo (three.js), en el marco local del
// horizonte (Y = cenit, −Z = norte, +X = este; el grupo «horizon» de Constellations.jsx).
//
// Una franja por banda de distancia (horizon.js / backend/app/horizon.py), de la más lejana a la más cercana:
// cada una sube desde 0° hasta el filo de esa banda en cada acimut. Por columna hay cuatro vértices —filo,
// línea de nieves (dos: blanco arriba, tierra abajo, para un borde limpio) y base—, de modo que la nieve
// ocupa solo lo que queda sobre la línea de nieves (con la distancia de cada filo se sabe a qué altura angular
// cae). Las laderas que miran al Sol se aclaran y las otras se oscurecen; cuando el Sol queda detrás de las
// montañas del horizonte, el paisaje pasa a la sombra (más oscuro y azulado, solo con la luz del cielo), y con
// el Sol rasante las cumbres altas que aún lo ven se encienden de anaranjado y rosa (arrebol, sunLight); las
// bandas lejanas se aclaran por la
// perspectiva aérea, y cada filo lleva una línea fina que lo separa de la banda de atrás. Opacas: tapan
// estrellas, planetas, la ISS y las nubes que quedan detrás. Bajo 0° sigue el suelo sombreado de siempre.
// Desde una cumbre los filos quedan bajo el horizonte (ángulos negativos): las franjas bajan entonces hasta el
// filo más bajo, y el paisaje se ve desde arriba.
import * as THREE from "three";
import { terrainPalette, snowLine } from "./horizon.js";

const RAD = Math.PI / 180;
const R_E = 6371008.8, K_REFR = 0.13;
const CUT_MIX = 0.5;   // cuánto toma una columna el color de la banda de atrás en los cortes (más, y salen rayas)
const BASE = -0.4;            // grados: base de cada franja, un poco bajo 0° para no dejar rendija con el suelo

/**
 * Textura generada para las laderas (con «Colores del satélite»): ruido fractal en la dirección de cada píxel,
 * estirado en vertical (quebradas y canales que bajan) más un grano fino, que oscurece o aclara el color del
 * vértice hasta ±(amplitud). Su escala angular depende de la distancia de la banda (un rasgo de ~250 m se ve
 * mayor cerca que lejos) y la amplitud baja con la distancia (la bruma la borra). Sin datos de nadie.
 */
export function texturize(mat, k, nb, maxKm, on = true) {
  const dKm = Math.max(0.8, maxKm * 0.7);
  const freq = Math.min(420, Math.max(14, dKm / 0.25));        // ciclos por radián
  const amp = 0.21 * (1 - 0.75 * (nb > 1 ? k / (nb - 1) : 0));
  const tex = { value: on ? 1 : 0 };
  mat.userData.tex = tex;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTex = tex; sh.uniforms.uFreq = { value: freq }; sh.uniforms.uAmp = { value: amp };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vTdir;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTdir = normalize(position);");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying vec3 vTdir;
uniform float uTex, uFreq, uAmp;
float th(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float tn(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(th(i), th(i + vec3(1,0,0)), f.x), mix(th(i + vec3(0,1,0)), th(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(th(i + vec3(0,0,1)), th(i + vec3(1,0,1)), f.x), mix(th(i + vec3(0,1,1)), th(i + vec3(1,1,1)), f.x), f.y), f.z);
}`).replace("#include <color_fragment>", `#include <color_fragment>
if (uTex > 0.5) {
  vec3 q = vTdir * uFreq;
  float gully = tn(vec3(q.x, q.y * 0.6, q.z)) * 0.6 + tn(vec3(q.x * 2.1, q.y * 1.1, q.z * 2.1)) * 0.4;
  float grain = tn(q * 4.3) * 0.55 + tn(q * 9.7) * 0.45;
  float t = (gully - 0.5) * 1.3 + (grain - 0.5) * 0.7;
  diffuseColor.rgb *= clamp(1.0 + uAmp * t, 0.55, 1.45);
}`);
  };
  mat.customProgramCacheKey = () => `teseo-terrain-tex`;
  return mat;
}

/** Altura angular (grados) a la que queda un punto de altura `hM` a `dKm` km para un observador a `h0M` m. */
export function angleOf(hM, dKm, h0M) {
  const d = Math.max(1, dKm * 1000), drop = (d * d * (1 - K_REFR)) / (2 * R_E);
  return Math.atan2(hM - h0M - drop, d) / RAD;
}

/**
 * ¿Le llega el Sol a un punto del paisaje? 0 (en sombra) … 1 (al sol), suave en ~1°.
 * - El punto está a `dKm` km en el acimut `az` y se ve a `alt` grados desde el observador. Visto desde allí, el
 *   Sol está algo más alto si el punto queda hacia el Sol (la Tierra es curva: `dKm`/R radianes).
 * - Un punto bajo (laderas cercanas, el fondo del valle) comparte la sombra del observador: tiene sol solo si el
 *   Sol está sobre el horizonte de montañas del observador en esa dirección (`hzSun`).
 * - Una cumbre alta respecto del observador (≥ 1,5 km) ve su propio horizonte, más bajo: el Sol le llega hasta
 *   que baja `dip` = √(2h/R) bajo el horizonte astronómico (unos 1,7° para 3 km). Es el arrebol: las cumbres
 *   siguen encendidas unos minutos después de que el valle quedó en sombra, y se encienden antes al amanecer.
 */
export function sunLight({ sunAlt, sunAz, hzSun = 0, alt, dKm, az }) {
  if (!Number.isFinite(sunAlt) || sunAlt < -8) return 0;
  const d = Math.max(0, dKm) * 1000;
  const sunAt = sunAlt + ((d / R_E) / RAD) * Math.cos((sunAz - az) * RAD);
  const hRel = d * Math.tan(alt * RAD) + (d * d * (1 - K_REFR)) / (2 * R_E);
  const dip = Math.sqrt((2 * Math.max(0, hRel)) / R_E) / RAD;
  const q = Math.min(1, Math.max(0, hRel / 1500));
  const thr = (1 - q) * Math.max(hzSun, -0.6) + q * -dip;
  const x = Math.min(1, Math.max(0, (sunAt - thr) / 0.9 + 0.5));
  return x * x * (3 - 2 * x);
}

/** Cuánto arrebol (luz anaranjada y rosada del Sol rasante) recibe un punto al sol: 1 con el Sol en su horizonte, 0 desde ~8°. */
export function glowOf(sunAlt, lit) {
  const x = Math.min(1, Math.max(0, (sunAlt - 1) / 7));
  return lit * (1 - x * x * (3 - 2 * x));
}

/**
 * Variación (m) de la línea de nieves a lo largo de la montaña: el borde de un glaciar no es una recta (lenguas
 * que bajan por las quebradas, rocas que asoman). Determinista, según la posición en metros a lo largo del
 * horizonte (acimut × distancia), así no cambia al girar ni depende de la resolución.
 */
export function snowJitter(azDeg, dKm) {
  const x = azDeg * RAD * dKm * 1000;
  return 150 * Math.sin(x / 900 + 0.7) + 90 * Math.sin(x / 370 + 2.1) + 45 * Math.sin(x / 150 + 4.2);
}

/**
 * Altura angular de la línea de nieves en cada columna de una banda (o null si esa cumbre no la alcanza).
 * Con `stepDeg`, la línea no es recta: sube y baja con snowJitter (unos ±250 m).
 */
export function snowAngles(band, h0M, snowH, stepDeg = 0) {
  return band.alt.map((a, j) => {
    if (!band.dist_km) return null;
    const h = snowH + (stepDeg ? snowJitter(j * stepDeg, band.dist_km[j]) : 0);
    if (!(band.top_m[j] > h)) return null;
    return Math.min(a, angleOf(h, band.dist_km[j], h0M));
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

  let floorOn = false, snowyFloor = false;
  let land = null, landOn = true;     // colores del satélite (fetchLandColors) y si se usan
  function build(hz, latDeg, floor = false) {
    clear();
    data = hz; lat = latDeg || 0; floorOn = !!floor;
    if (!hz || !hz.bands || !hz.bands.length) return;
    const n = hz.alt.length, step = hz.step_deg || 360 / n, nb = hz.bands.length;
    const h0 = (hz.ground_m || 0) + (hz.eye_m || 1.7), snowH = snowLine(lat);
    // la base de las franjas: un poco bajo 0° o, desde una cumbre (filos bajo el horizonte), bajo el filo más bajo
    let lowest = 0;
    for (const b of hz.bands) for (const v of b.alt) if (v < lowest) lowest = v;
    const base = Math.min(BASE, lowest - 0.4), above = base < BASE;
    if (above) {
      // bruma lejana: entre 0° y los filos más lejanos (más allá de 150 km no hay modelo) se ve aire, no suelo
      const pos = new Float32Array((n + 1) * 2 * 3), idx = [];
      for (let i = 0; i <= n; i++) {
        pos.set(P(i * step, 0.02), i * 6); pos.set(P(i * step, base), i * 6 + 3);
        if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array((n + 1) * 2 * 3), 3));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 1, depthTest: false, depthWrite: false, fog: false }));
      m.renderOrder = 2.69; m.frustumCulled = false; m.userData.band = nb - 1; m.userData.haze = true;
      meshes.push(m); group.add(m);
    }
    if (floorOn) {
      // de pie en una cumbre: bajo las franjas, el suelo que pisas (nieve por encima de la línea de nieves, tierra
      // por debajo), opaco: ahí no se ven las estrellas del otro lado de la Tierra
      snowyFloor = (hz.ground_m || 0) >= snowH;
      const pos = new Float32Array((n + 2) * 3), idx = [];
      for (let i = 0; i <= n; i++) {
        pos.set(P(i * step, base + 0.3), i * 3);
        if (i < n) idx.push(i, n + 1, i + 1);
      }
      pos.set(P(0, -90), (n + 1) * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array((n + 2) * 3), 3));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 1, depthTest: false, depthWrite: false, fog: false }));
      m.renderOrder = 2.695; m.frustumCulled = false; m.userData.band = 0; m.userData.floor = true;
      meshes.push(m); group.add(m);
    }
    for (let k = nb - 1; k >= 0; k--) {                 // de la más lejana a la más cercana
      const b = hz.bands[k], sa = snowAngles(b, h0, snowH, step);
      const pos = new Float32Array((n + 1) * 4 * 3), col = new Float32Array((n + 1) * 4 * 3), idx = [];
      const line = new Float32Array((n + 1) * 3);
      for (let i = 0; i <= n; i++) {
        const j = i % n, az = j * step, top = Math.max(base + 0.05, b.alt[j]);
        // en una cumbre nevada, la ladera que pisas es nieve hasta abajo (empalma con el suelo de nieve)
        const snow = k === 0 && floorOn && snowyFloor ? base + 0.05 : sa[j] == null ? top : Math.max(base + 0.05, Math.min(top, sa[j]));
        pos.set(P(az, top), (i * 4) * 3);
        pos.set(P(az, snow), (i * 4 + 1) * 3);
        pos.set(P(az, snow), (i * 4 + 2) * 3);
        // todas las franjas acaban un poco bajo el filo más bajo: más abajo sigue el suelo translúcido de siempre,
        // a través del cual se ven las estrellas del otro lado de la Tierra (la v1.47.0 lo tapaba entero)
        pos.set(P(az, base), (i * 4 + 3) * 3);
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
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 1, depthTest: false, depthWrite: false, fog: false });
      texturize(mat, k, nb, hz.bands[k].max_km, landOn);
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = 2.7 + (nb - 1 - k) * 0.01;      // después de las nubes (2,5); las cercanas, al final
      m.frustumCulled = false;
      m.userData.band = k;
      meshes.push(m); group.add(m);
      // el filo: una línea fina que separa esta banda de la de atrás
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.BufferAttribute(line, 3));
      lg.setAttribute("color", new THREE.BufferAttribute(new Float32Array((n + 1) * 3), 3));
      const l = new THREE.Line(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, fog: false }));
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
    // sombra de las montañas y arrebol: ¿le llega el Sol a cada filo y al pie de cada banda? (sunLight)
    const sunAlt = st && Number.isFinite(st.sunAlt) ? st.sunAlt : -90;
    const sunAzDeg = ((sunAz / RAD) % 360 + 360) % 360;
    const js = Math.round(sunAzDeg / step) % n;
    const hzSun = data.alt ? Math.max(data.alt[(js - 1 + n) % n], data.alt[js], data.alt[(js + 1) % n]) : 0;
    const lightOn = sd && sunAlt > -8;
    // luz de cada columna, suavizada en ±1,5° de acimut: el filo sube y baja de una columna a otra y, sin
    // suavizar, el borde de la sombra dejaría franjas verticales en las laderas
    const litCache = new Map();
    const litArr = (b, top) => {
      const key = b; let m = litCache.get(key);
      if (!m) { m = {}; litCache.set(key, m); }
      if (m[top]) return m[top];
      const raw = new Float32Array(n), out = new Float32Array(n), Wl = Math.max(1, Math.round(1.5 / step));
      if (lightOn) for (let j = 0; j < n; j++) raw[j] = sunLight({ sunAlt, sunAz: sunAzDeg, hzSun, alt: top ? b.alt[j] : 0, dKm: b.dist_km ? b.dist_km[j] : 0, az: j * step });
      for (let j = 0; j < n; j++) { let sum = 0; for (let q = -Wl; q <= Wl; q++) sum += raw[(j + q + n) % n]; out[j] = sum / (2 * Wl + 1); }
      m[top] = out; return out;
    };
    const litAt = (b, j, top) => (lightOn ? litArr(b, top)[j] : 0);
    // la luz que falta cuando el Sol está tapado (solo la del cielo: más oscura y azulada) y el tinte del arrebol
    const dim = 0.42 * pal.day, SKY = [0.55, 0.66, 0.95], GLOW = [1.0, 0.5, 0.33], GLOW_SNOW = [1.0, 0.6, 0.55];
    const light = (c0, lit, glow, snowy) => {
      let c = scale(c0, 1 - dim * (1 - lit));
      const lum = (c[0] + c[1] + c[2]) / 3;
      c = mix3(c, [SKY[0] * lum * 1.3, SKY[1] * lum * 1.3, SKY[2] * lum * 1.3], 0.22 * pal.day * (1 - lit));
      if (glow > 0.001) {
        const g = snowy ? GLOW_SNOW : GLOW, k = snowy ? 0.8 : 0.45, bri = snowy ? 1.0 : Math.max(0.45, lum * 1.6);
        c = mix3(c, [g[0] * bri, g[1] * bri, g[2] * bri], k * glow);
      }
      return c;
    };
    const W = Math.max(1, Math.round(2.5 / step));
    // ¿el filo de la banda es una cresta o solo el corte de una ladera que sigue subiendo en la banda de atrás?
    // (su punto más alto está en el límite lejano de la banda). Un corte no es una silueta: se pinta con el color
    // de la banda de atrás y sin línea de filo, para que la montaña se vea una sola vez. Suavizado en ±2,5° para
    // que no salgan franjas donde el filo cae a veces en el límite y a veces no.
    const cutOf = (k) => {
      const b = data.bands[k], raw = new Float32Array(n), out = new Float32Array(n), Wc = Math.max(1, Math.round(2.5 / step));
      if (k >= nb - 1) return out;
      for (let j = 0; j < n; j++) raw[j] = Math.min(1, Math.max(0, ((b.dist_km ? b.dist_km[j] : 0) / b.max_km - 0.9) / 0.08));
      for (let j = 0; j < n; j++) { let sum = 0; for (let q = -Wc; q <= Wc; q++) sum += raw[(j + q + n) % n]; out[j] = sum / (2 * Wc + 1); }
      return out;
    };
    // el modelado de las laderas solo existe donde da el Sol (en la sombra de una montaña la luz es pareja)
    const shadeOf = (b, j, lit = 1) => {
      const slope = (b.alt[(j + W) % n] - b.alt[(j - W + n) % n]) / (2 * W * step);
      return 1 + 0.8 * relief * lit * Math.tanh(1.5 * slope) * Math.sin(j * step * RAD - sunAz);
    };
    const mix3 = (a, c, f) => [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f, a[2] + (c[2] - a[2]) * f];
    const cuts = {};
    let floorMesh = null;
    // color de satélite de una columna (j: 0,2°) de la banda k, ya con la luz del día y la perspectiva aérea
    const landAt = (k, j) => {
      const lb = land && landOn && land.bands[k]; if (!lb) return null;
      const m = lb.top.length / 3, q = Math.min(m - 1, Math.floor((j * m) / n)) * 3;
      return pal.col(k, [lb.top[q], lb.top[q + 1], lb.top[q + 2]], [lb.bottom[q], lb.bottom[q + 1], lb.bottom[q + 2]]);
    };
    for (const m of meshes) if (!m.userData.line && !m.userData.haze && !m.userData.floor) cuts[m.userData.band] = cutOf(m.userData.band);
    for (const m of meshes) {
      const k = m.userData.band, b = data.bands[k], c = pal.bands[k], cut = cuts[k];
      if (m.userData.floor) { floorMesh = m; continue; }   // se pinta al final, con el pie de la banda más cercana
      if (m.userData.haze) {
        // arriba, el color del horizonte del cielo (empalma con el domo); abajo, el de la banda más lejana
        const hc = st && st.colors && st.colors.horizon ? st.colors.horizon : c.top;
        const hcol = m.geometry.attributes.color.array, top = lin(hc), bot = lin(mix3(hc, c.top, 0.6));
        for (let i = 0; i <= n; i++) { hcol.set(top, i * 6); hcol.set(bot, i * 6 + 3); }
        m.geometry.attributes.color.needsUpdate = true;
        continue;
      }
      const nk = Math.min(nb - 1, k + 1), bn = data.bands[nk], cn = pal.bands[nk];
      if (m.userData.line) {
        // de noche, un filo algo más claro que la banda; de día, algo más oscuro (como en un grabado); sobre un
        // corte, el color del relleno (la línea desaparece)
        const e = pal.day > 0.5 ? scale(c.top, 0.72) : [c.top[0] + 0.07, c.top[1] + 0.075, c.top[2] + 0.1];
        const lc = m.geometry.attributes.color.array;
        for (let i = 0; i <= n; i++) {
          const j = i % n, f = cut[j];
          const lt = litAt(b, j, true), ln = litAt(bn, j, true);
          const fill = mix3(light(scale(c.top, shadeOf(b, j, lt)), lt, glowOf(sunAlt, lt), false), light(scale(cn.top, shadeOf(bn, j, ln)), ln, glowOf(sunAlt, ln), false), f);
          lc.set(lin(mix3(light(e, lt, 0, false), fill, f)), i * 3);
        }
        m.geometry.attributes.color.needsUpdate = true;
        m.material.opacity = 0.5 + 0.3 * (1 - k / Math.max(1, nb - 1));
        continue;
      }
      const col = m.geometry.attributes.color.array;
      for (let i = 0; i <= n; i++) {
        const j = i % n;
        // pendiente del filo (suavizada en ±2,5°, para que no salgan rayas): si sube hacia la derecha, la
        // ladera visible mira a la izquierda (hacia acimut menor). Solo se sabe la forma del filo, no la de la
        // ladera entera: la luz marca la parte alta y se apaga hacia la base (si llegara abajo, cada columna
        // sería una franja vertical)
        // luz del Sol en el filo (y en el de la banda de atrás, para los cortes) y en el pie de la banda: con el
        // Sol bajo, el pie puede quedar en la sombra del valle mientras el filo sigue al sol
        const lt = litAt(b, j, true), ln = litAt(bn, j, true), lb = litAt(b, j, false);
        const gt = glowOf(sunAlt, lt);
        const shade = shadeOf(b, j, lt), f = cut[j] * CUT_MIX;
        const snow = light(scale(pal.snow, 0.86 + 0.14 * shade), lt, gt, true);
        col.set(lin(snow), (i * 4) * 3);
        col.set(lin(scale(snow, 0.94)), (i * 4 + 1) * 3);
        // con los colores del satélite, los de esta columna (y los de la banda de atrás para los cortes)
        const cc = landAt(k, j) || c, ccn = f > 0 ? landAt(nk, j) || cn : cn;
        col.set(lin(mix3(light(scale(cc.top, shade), lt, gt, false), light(scale(ccn.top, shadeOf(bn, j, ln)), ln, glowOf(sunAlt, ln), false), f)), (i * 4 + 2) * 3);
        col.set(lin(light(cc.bottom, lb, glowOf(sunAlt, lb) * 0.5, false)), (i * 4 + 3) * 3);
      }
      m.geometry.attributes.color.needsUpdate = true;
    }
    // el suelo de la cumbre: el color medio del pie de la banda más cercana (nieve o tierra), para que empalme
    if (floorMesh) {
      const b0 = meshes.find((x) => x.userData.band === 0 && !x.userData.line && !x.userData.floor && !x.userData.haze);
      const fc = [0, 0, 0];
      if (b0) {
        const a = b0.geometry.attributes.color.array, v = snowyFloor ? 1 : 3;
        for (let i = 0; i < n; i++) for (let q = 0; q < 3; q++) fc[q] += a[(i * 4 + v) * 3 + q] / n;
      }
      const fa = floorMesh.geometry.attributes.color.array;
      for (let i = 0; i <= n + 1; i++) fa.set(fc, i * 3);
      floorMesh.geometry.attributes.color.needsUpdate = true;
    }
  }

  return {
    group,
    /** hz: respuesta de /api/horizon (o null para quitarlo); latDeg: para la línea de nieves; floor: de pie en una
     * cumbre (suelo opaco bajo las montañas). */
    set(hz, latDeg, st, floor = false) { build(hz, latDeg, floor); paint(st); group.visible = !!hz && meshes.length > 0 && enabledFlag; },
    get floor() { return floorOn; },
    /** Colores del satélite (decodeLandColors) para el horizonte actual, o null; on: si se usan (y la textura). */
    setLand(lc, on = true) { land = lc || null; landOn = !!on; for (const m of meshes) if (m.material.userData.tex) m.material.userData.tex.value = landOn ? 1 : 0; },
    paint,
    setEnabled(b) { enabledFlag = !!b; group.visible = enabledFlag && meshes.length > 0; },
    get data() { return data; },
    dispose() { clear(); if (group.parent) group.parent.remove(group); },
  };
}
