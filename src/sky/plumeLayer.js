// plumeLayer.js — columnas de ceniza ILUSTRATIVAS sobre los volcanes del horizonte, en el marco local del
// horizonte (x este, y arriba, z −norte; el mismo que monumentLayer y los nombres de las montañas).
//   · simulate(v): la última erupción de un volcán, en bucle de ~26 s (≈ 20 min de erupción comprimidos): la
//     columna sube hasta la altura típica de su índice de explosividad (VEI) y la ceniza se abre en paraguas a
//     unos ¾ de esa altura, arrastrada por el viento del pronóstico.
//   · ambient(list): una pluma baja y suave sobre los volcanes que el Smithsonian da en erupción este año.
// No es una predicción ni una alerta: la forma es genérica; solo la altura (por el VEI) y la dirección del
// viento salen de datos. Partículas como puntos con un sombreado redondo y suave.
import * as THREE from "three";

const R_SKY = 850;                      // radio de la esfera donde se dibujan (como los nombres, a 860)
const N_SIM = 420, N_AMB = 90;
// altura típica de la columna (km sobre el cráter) para cada VEI (Newhall y Self, 1982)
export const VEI_KM = [0.1, 0.6, 3, 9, 17, 27, 35, 40, 45];
export const veiColumnKm = (vei) => VEI_KM[Math.max(0, Math.min(8, Number.isFinite(vei) ? Math.round(vei) : 2))];

/** Posición (km; x este, y arriba, z −norte) del cráter visto desde el observador: rumbo, ángulo y distancia. */
export function ventPos(azDeg, altDeg, distKm) {
  const a = azDeg * Math.PI / 180, h = distKm * Math.tan(altDeg * Math.PI / 180);
  return [distKm * Math.sin(a), h, -distKm * Math.cos(a)];
}

/**
 * Una partícula de ceniza en el instante relativo `age` (0–1 de su vida), con su semilla `s` (0–1, tres valores):
 * desplazamiento (km) desde el cráter y radio (km). Sube deprisa, frena al llegar a ~¾ de la altura H y se abre
 * en un paraguas que el viento (ve, vn en km por unidad de vida) arrastra.
 */
export function particle(age, s, H, wind) {
  const rise = 1 - Math.pow(1 - Math.min(1, age / 0.45), 2.2);           // 0 → 1 en el primer 45 % de la vida
  const top = H * (0.72 + 0.28 * s[0]);
  const up = top * rise;
  const spread = (0.08 + 0.35 * age) * H * (0.5 + s[1]);                // el paraguas se abre con la edad
  const ang = s[2] * Math.PI * 2;
  const drift = Math.max(0, age - 0.25);
  const x = Math.cos(ang) * spread * (0.4 + rise) + wind[0] * drift;
  const z = -(Math.sin(ang) * spread * (0.4 + rise) * 0.6 + wind[1] * drift);
  const r = (0.07 + 0.36 * age) * H * (0.3 + 0.4 * s[1]);
  return { e: x, u: up, n: -z, r };
}

const VERT = `
attribute float aSize; attribute float aAlpha;
varying float vA; varying float vHot;
attribute float aHot;
uniform float uPx;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPx, 2.0, 420.0);
  vA = aAlpha; vHot = aHot;
}`;
const FRAG = `
uniform vec3 uAsh; uniform vec3 uHot;
varying float vA; varying float vHot;
void main() {
  vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0;
  if (d > 1.0) discard;
  float a = vA * (1.0 - smoothstep(0.5, 1.0, d));
  vec3 c = mix(uAsh, uHot, vHot * 0.8) * (0.78 + 0.4 * (0.5 - p.y));   // arriba más clara: luz desde arriba
  gl_FragColor = vec4(c, a);
}`;

export function createPlumeLayer() {
  const group = new THREE.Group();
  group.name = "plumes";
  const mk = (n) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute("aHot", new THREE.BufferAttribute(new Float32Array(n), 1));
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uPx: { value: 500 }, uAsh: { value: new THREE.Color(0.55, 0.52, 0.5) }, uHot: { value: new THREE.Color(1, 0.45, 0.15) } } });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false; pts.renderOrder = 2.79;          // tras las montañas (2,7–2,76), antes que las nubes de abajo
    pts.visible = false; group.add(pts);
    return pts;
  };
  const sim = mk(N_SIM), amb = mk(N_AMB);
  const seeds = (n) => Array.from({ length: n }, (_, i) => { const h = (k) => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }; return [h(1), h(2), h(3), h(4)]; });
  const sSim = seeds(N_SIM), sAmb = seeds(N_AMB);
  let simV = null, ambList = [], t0 = 0, wind = [0.5, 0], look = { day: 1 };

  // escribe las partículas de un volcán (km → dirección en la esfera del cielo)
  function fill(pts, sd, from, count, v, H, tLife, phase, hotOn, alphaK) {
    const pos = pts.geometry.attributes.position.array, size = pts.geometry.attributes.aSize.array;
    const al = pts.geometry.attributes.aAlpha.array, hot = pts.geometry.attributes.aHot.array;
    const P0 = ventPos(v.az, v.alt, v.dist_km);
    const w = [wind[0] * H * 0.9, wind[1] * H * 0.9];
    for (let q = 0; q < count; q++) {
      const i = from + q, s = sd[q];
      const age = ((phase + s[3]) % 1);
      const p = particle(age, s, H, w);
      const x = P0[0] + p.e, y = P0[1] + p.u, z = P0[2] - p.n, L = Math.hypot(x, y, z) || 1;
      pos[i * 3] = (x / L) * R_SKY; pos[i * 3 + 1] = (y / L) * R_SKY; pos[i * 3 + 2] = (z / L) * R_SKY;
      size[i] = (p.r / L) * 2;                                          // diámetro angular (rad)
      const fadeIn = Math.min(1, age / 0.06), fadeOut = 1 - Math.pow(age, 3);
      al[i] = alphaK * fadeIn * fadeOut * (0.3 + 0.5 * s[1]);
      hot[i] = hotOn ? Math.max(0, 1 - age / 0.07) * (1 - look.day) : 0; // de noche, el resplandor del cráter
    }
  }

  return {
    group,
    /** Simular la última erupción de `v` = { az, alt, dist_km, vei }; null para quitarla. */
    simulate(v) { simV = v || null; t0 = performance.now(); sim.visible = !!simV; },
    /** Plumas suaves sobre los volcanes en erupción este año: [{ az, alt, dist_km, vei }]. */
    ambient(list) { ambList = Array.isArray(list) ? list.slice(0, 4) : []; amb.visible = ambList.length > 0; },
    /** Viento (ve, vn en m/s) y luz: day 0–1 y el color de la ceniza según el cielo. */
    setLook({ windMs, day = 1, horizon } = {}) {
      if (windMs) { const sp = Math.hypot(windMs[0], windMs[1]) || 1; const k = Math.min(1.2, sp / 12); wind = [(windMs[0] / sp) * k, (windMs[1] / sp) * k]; }
      look.day = day;
      const base = [0.36 + 0.24 * day, 0.34 + 0.22 * day, 0.33 + 0.2 * day];
      const c = horizon ? [base[0] * 0.75 + horizon[0] * 0.25 * day, base[1] * 0.75 + horizon[1] * 0.25 * day, base[2] * 0.75 + horizon[2] * 0.25 * day] : base;
      for (const p of [sim, amb]) p.material.uniforms.uAsh.value.setRGB(c[0], c[1], c[2]);
    },
    get active() { return !!simV || ambList.length > 0; },
    get simulating() { return simV; },
    /** Cada cuadro: mueve las partículas. pxPerRad = píxeles por radián de la vista. Devuelve si hay algo. */
    update(now, pxPerRad) {
      if (!simV && !ambList.length) return false;
      for (const p of [sim, amb]) p.material.uniforms.uPx.value = pxPerRad;
      if (simV) {
        const H = veiColumnKm(simV.vei), ph = ((now - t0) / 26000) % 1;
        fill(sim, sSim, 0, N_SIM, simV, H, 26, ph, true, 1);
        for (const k of ["position", "aSize", "aAlpha", "aHot"]) sim.geometry.attributes[k].needsUpdate = true;
      }
      if (ambList.length) {
        const per = Math.floor(N_AMB / ambList.length);
        ambList.forEach((v, j) => fill(amb, sAmb, j * per, per, v, Math.min(4, veiColumnKm(v.vei) * 0.5), 40, ((now / 40000) + j * 0.37) % 1, false, 0.55));
        amb.geometry.setDrawRange(0, per * ambList.length);
        for (const k of ["position", "aSize", "aAlpha", "aHot"]) amb.geometry.attributes[k].needsUpdate = true;
      }
      return true;
    },
    dispose() { for (const p of [sim, amb]) { p.geometry.dispose(); p.material.dispose(); } if (group.parent) group.parent.remove(group); },
  };
}
