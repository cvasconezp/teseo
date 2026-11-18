// milkyWayLayer.js — la Vía Láctea como se ve en un cielo oscuro: su resplandor, las nubes de polvo que la
// cruzan y las Nubes de Magallanes, detrás de las estrellas.
//
// Imagen: «Deep Star Maps 2020» de NASA/Goddard Space Flight Center Scientific Visualization Studio (mapa
// `milkyway_2020`, solo el resplandor de la galaxia, sin estrellas sueltas; dominio público), en coordenadas
// celestes J2000 y proyección equirrectangular: el centro es la ascensión recta 0 h, que crece hacia la
// izquierda, y el norte queda arriba. Se preparó en public/textures/milkyway-4k.webp y -2k.webp (curva de tono
// para pantalla y fondo llevado a negro, así solo suma luz donde hay galaxia).
//
// El marco de la escena es el ecuatorial (x hacia AR 0 h, y hacia AR 6 h, z hacia el polo norte), el mismo de las
// estrellas: la esfera se construye con esas direcciones y no gira con la hora ni con el lugar.
import * as THREE from "three";
import { raDecToVec } from "./guides.js";

/** Coordenada u de la imagen para una ascensión recta (grados, de −180 a 180): centro en 0 h, creciente a la izquierda. */
export const milkyU = (raDeg) => 0.5 - raDeg / 360;

/**
 * Cuánto se ve la Vía Láctea (0–1) con el cielo del momento (st = skyState o null si la atmósfera está apagada):
 * nada con el Sol a menos de 8° bajo el horizonte, todo desde 16°; se apaga con la contaminación lumínica (brillo
 * del cielo en el cenit, mag/arcsec²: desde 21,6 en un cielo oscuro hasta 18,6 en una ciudad) y con la Luna.
 */
export function milkyWayVisibility(st) {
  if (!st) return 1;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const night = 1 - sm(-16, -8, st.sunAlt);
  const dark = Math.pow(Math.min(1, Math.max(0, (st.b0Mag - 18.6) / 3.0)), 1.5);
  const moonRatio = st.zenith && st.zenith.parts && st.b0Nl ? st.zenith.parts.moon / st.b0Nl : 0;
  return night * dark / (1 + 0.8 * Math.max(0, moonRatio));
}

// con el cielo más oscuro la imagen entra al 80 %: se ve con claridad sin tapar las estrellas débiles
const GAIN = 0.8;

export function createMilkyWayLayer({ radius = 895, small = false, onLoad = null } = {}) {
  const NA = 96, ND = 48, pos = new Float32Array((NA + 1) * (ND + 1) * 3), uv = new Float32Array((NA + 1) * (ND + 1) * 2), idx = [];
  for (let j = 0; j <= ND; j++) for (let i = 0; i <= NA; i++) {
    const ra = -180 + (360 * i) / NA, dec = -90 + (180 * j) / ND, v = raDecToVec(ra, dec), k = j * (NA + 1) + i;
    pos.set([v[0] * radius, v[1] * radius, v[2] * radius], k * 3);
    uv.set([milkyU(ra), (dec + 90) / 180], k * 2);
  }
  for (let j = 0; j < ND; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const tex = new THREE.TextureLoader().load(`/textures/milkyway-${small ? "2k" : "4k"}.webp`, () => { if (onLoad) onLoad(); });
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // suma luz sin tocar la transparencia del lienzo (el cielo de la página se ve a través de él)
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -5; mesh.frustumCulled = false;
  let level = 1;
  return {
    mesh,
    /** Intensidad 0–1 (ver milkyWayVisibility). */
    setIntensity(v) { level = Math.min(1, Math.max(0, v)); mat.color.setScalar(level * GAIN); mesh.visible = level > 0.004 && mesh.userData.on !== false; },
    setOn(b) { mesh.userData.on = !!b; mesh.visible = !!b && level > 0.004; },
    get intensity() { return level; },
    dispose() { geo.dispose(); mat.dispose(); tex.dispose(); if (mesh.parent) mesh.parent.remove(mesh); },
  };
}
