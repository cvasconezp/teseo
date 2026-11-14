// atmosphereLayer.js — domo de cielo (three.js) para la vista Cielo: una esfera grande vista desde dentro
// que pinta el gradiente cenit→horizonte, el resplandor del lado del Sol y el suelo, con los colores que
// calcula atmosphere.js (`skyState(...).colors`). Los COLORES son una aproximación visual (ver
// atmosphere.js); qué estrellas se ven lo decide `visibility`, no este domo.
//
// Uso:
//   const atm = createAtmosphereLayer();          // { mesh, update(state, sunDirWorld), follow(camera), setEnabled(b), dispose() }
//   scene.add(atm.mesh);
//   atm.update(skyState(...));                     // al cambiar la hora, el lugar o la clase de Bortle
//   // en el bucle, antes de renderer.render: atm.follow(camera)
//
// Marco: el del cielo local de Teseo (src/sky/look.js): Y = cenit, −Z = norte, +X = este. Si la escena
// usa otro, pasa `sunDirWorld` (vector unitario del Sol en coordenadas de mundo) a update().
//
// Orden de dibujo: el domo se dibuja PRIMERO (renderOrder muy negativo), sin escribir ni leer profundidad,
// así que todo lo demás (estrellas aditivas, líneas, planetas, suelo, etiquetas) queda por encima. De noche
// cerrada su opacidad es 0 y el cielo queda exactamente como sin atmósfera. La dirección de cada píxel se
// calcula desde la cámara (cameraPosition), así que es correcta con la cámara en el centro o desplazada,
// siempre que quede dentro de la esfera; follow(camera) la mantiene centrada en la cámara.
import * as THREE from "three";

const VERT = `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunGlow;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform float uAlpha;
uniform float uGlow;
varying vec3 vWorld;
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  float h = d.y;                                   // seno de la altura
  float up = clamp(h, 0.0, 1.0);
  // gradiente: el color de horizonte domina en los ~20° más bajos
  float tH = pow(1.0 - up, 3.2);
  vec3 col = mix(uZenith, uHorizon, tH);
  // lado del Sol: el horizonte se aclara/enrojece hacia el acimut del Sol (crepúsculo)
  vec2 dh = d.xz; vec2 sh = uSunDir.xz;
  float az = (length(dh) > 1e-4 && length(sh) > 1e-4) ? dot(normalize(dh), normalize(sh)) : 0.0;
  float sideW = 0.5 + 0.5 * az;
  col = mix(col, uSunGlow, uGlow * tH * sideW * sideW * 0.75);
  // halo alrededor del Sol (más ancho cerca del horizonte)
  float c = dot(d, normalize(uSunDir));
  float halo = exp((c - 1.0) * 7.0) * 0.28 + exp((c - 1.0) * 80.0) * 0.45;
  col = mix(col, uSunGlow, clamp(halo * uGlow, 0.0, 0.85));
  // bajo el horizonte: suelo oscuro con un borde suave (el anillo y el disco del suelo de la app van encima)
  float g = smoothstep(0.0, -0.06, h);
  col = mix(col, uGround, g);
  gl_FragColor = vec4(min(col, vec3(1.0)), uAlpha);
}`;

export function createAtmosphereLayer({ radius = 4000, segments = 48 } = {}) {
  const uniforms = {
    uZenith: { value: new THREE.Color(0, 0, 0) },
    uHorizon: { value: new THREE.Color(0, 0, 0) },
    uSunGlow: { value: new THREE.Color(0, 0, 0) },
    uGround: { value: new THREE.Color(0, 0, 0) },
    uSunDir: { value: new THREE.Vector3(0, -1, 0) },
    uAlpha: { value: 0 },
    uGlow: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.round(segments / 2)), material);
  mesh.name = "atmosphere";
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  let enabled = true, alpha = 0;

  const setC = (u, rgb) => u.value.setRGB(rgb[0], rgb[1], rgb[2]);
  return {
    mesh, uniforms,
    update(state, sunDirWorld) {
      if (!state) { alpha = 0; mesh.visible = false; return; }
      const c = state.colors;
      setC(uniforms.uZenith, c.zenith); setC(uniforms.uHorizon, c.horizon);
      setC(uniforms.uSunGlow, c.sunGlow); setC(uniforms.uGround, c.ground);
      const s = sunDirWorld || state.sunDir;
      uniforms.uSunDir.value.set(s[0], s[1], s[2]).normalize();
      uniforms.uGlow.value = c.glow;
      alpha = c.alpha;
      uniforms.uAlpha.value = alpha;
      // opaco (de día y en el crepúsculo claro): sin mezcla, más barato de rellenar en GPU modestas
      const opaque = alpha >= 0.999;
      if (material.transparent === opaque) { material.transparent = !opaque; material.needsUpdate = true; }
      mesh.visible = enabled && alpha > 0.003;
    },
    follow(camera) {
      if (!mesh.visible) return;
      mesh.position.copy(camera.position);
      mesh.updateMatrix(); mesh.updateMatrixWorld(true);
    },
    setEnabled(b) { enabled = !!b; mesh.visible = enabled && alpha > 0.003; },
    get visible() { return mesh.visible; },
    dispose() { mesh.geometry.dispose(); material.dispose(); if (mesh.parent) mesh.parent.remove(mesh); },
  };
}
