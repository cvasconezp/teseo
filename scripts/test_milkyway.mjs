// Pruebas de la Vía Láctea (src/sky/milkyWayLayer.js), de los puntos negros de las estrellas apagadas y del
// dibujo de los planetas sin saltos al acercarse.
import { milkyU, milkyWayVisibility } from "../src/sky/milkyWayLayer.js";
import { skyState } from "../src/sky/atmosphere.js";
import { SPAN_MIN } from "../src/sky/look.js";
import { SPRITE_PX, SPRITE_RES } from "../src/sky/bodies.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const near = (a, b, t) => Math.abs(a - b) <= t;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const size = (p) => fs.statSync(new URL(p, import.meta.url)).size;

console.log("Vía Láctea");
// el mapa de la NASA: centro en AR 0 h, creciente hacia la izquierda. El centro galáctico (AR 266,4°) cae al 74–76 %
// del ancho y la Gran Nube de Magallanes (AR 80,9°), al 27,5 %
ok(near(milkyU(0), 0.5, 1e-12) && near(milkyU(-180), 1, 1e-12) && near(milkyU(180), 0, 1e-12), "el centro de la imagen es la ascensión recta 0 h y crece hacia la izquierda");
ok(near(milkyU(266.4 - 360), 0.76, 0.01) && near(milkyU(80.9), 0.275, 0.005), "el centro galáctico y la Gran Nube de Magallanes caen donde están en el mapa");
ok(size("../public/textures/milkyway-4k.webp") > 100000 && size("../public/textures/milkyway-4k.webp") < 1500000 && size("../public/textures/milkyway-2k.webp") < 300000, "la imagen está en dos tamaños (el pequeño para teléfonos)");
const night = { alt: -40, az: 0 }, noMoon = { alt: -30, az: 90, illum: 0 };
const dark = milkyWayVisibility(skyState(night, noMoon, 1, {})), sub = milkyWayVisibility(skyState(night, noMoon, 6, {})), city = milkyWayVisibility(skyState(night, noMoon, 9, {}));
ok(milkyWayVisibility(null) === 1 && dark > 0.85 && sub < dark * 0.6 && city < 0.05, `se ve entera en un cielo oscuro (${dark.toFixed(2)}), menos en las afueras (${sub.toFixed(2)}) y nada en una ciudad (${city.toFixed(2)})`);
ok(milkyWayVisibility(skyState({ alt: -5, az: 270 }, noMoon, 1, {})) === 0 && milkyWayVisibility(skyState({ alt: 30, az: 180 }, noMoon, 1, {})) === 0, "no se ve de día ni en el crepúsculo");
const full = milkyWayVisibility(skyState(night, { alt: 60, az: 90, illum: 1 }, 1, {}));
ok(full < dark * 0.75, `la Luna llena la apaga (${full.toFixed(2)})`);
// con Luna, un cielo más oscuro nunca la muestra menos que uno con más luces (antes pasaba)
{ const moon = { alt: 50, az: 90, illum: 0.6 }, v = [1, 3, 5, 7].map((b) => milkyWayVisibility(skyState(night, moon, b, {})));
  ok(v[0] > 0.05 && v.every((x, i) => i === 0 || x <= v[i - 1] + 1e-9), `con media Luna sigue el orden de la contaminación lumínica (${v.map((x) => x.toFixed(2)).join(" ≥ ")})`); }
ok(/setExtinction\(k, up\)/.test(read("../src/sky/milkyWayLayer.js")) && /milky\.setExtinction\(st \? st\.k : 0/.test(read("../src/Constellations.jsx")), "hacia el horizonte se apaga con la extinción del aire, como las estrellas");
const sky = read("../src/Constellations.jsx"), layer = read("../src/sky/milkyWayLayer.js");
ok(/createMilkyWayLayer\(/.test(sky) && /milky\.setIntensity\(milkyWayVisibility\(st\)\)/.test(sky) && /ref\.milky\.mesh\.quaternion\.copy\(q\)/.test(sky) && /ref\.milky\.setOn\(inside\)/.test(sky),
  "el cielo la dibuja detrás de las estrellas, gira con ellas y sigue la oscuridad del cielo");
ok(/blendSrcAlpha: THREE\.ZeroFactor/.test(layer), "suma luz sin cambiar la transparencia del lienzo");

console.log("Estrellas apagadas");
ok(/max\(vColor\.r, max\(vColor\.g, vColor\.b\)\) < 0\.003\) discard/.test(sky) && /blendSrc: THREE\.SrcAlphaFactor, blendDst: THREE\.OneFactor, blendSrcAlpha: THREE\.ZeroFactor/.test(sky),
  "una estrella que la atmósfera apaga no deja un punto negro (no toca la transparencia del lienzo)");

console.log("Planetas");
ok(SPRITE_RES === 2 * SPRITE_PX, "los marcadores se dibujan al doble de resolución");
ok(/b\.id === "moon" \? \(Math\.min/.test(sky) && /drawSphere\(off\.getContext\("2d"\), img\._teseoData/.test(read("../src/sky/bodies.js")), "la Luna se dibuja como esfera en un lienzo grande, para verla de cerca");
ok(SPAN_MIN <= 0.06, "el zoom máximo llega a unos 3,6 minutos de arco");
ok(/const shrink = fovNow >= 7 \? 1 : fovNow <= 2 \? 0\.45/.test(sky) && /const rPx = Math\.max\(real, mark \* shrink\)/.test(sky), "al acercarse el planeta encoge poco a poco hasta su tamaño real, sin saltos");
ok(/if \(ref\.updateRealPlanets\) ref\.updateRealPlanets\(\);/.test(sky), "el eje y los anillos llevan su orientación real a cualquier zoom");
for (const n of ["sun", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"]) {
  const b = fs.readFileSync(new URL(`../public/textures/${n}.jpg`, import.meta.url));
  // cabecera JPEG: busca el marco SOF y lee el ancho
  let w = 0; for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xff) { i++; continue; } const mk = b[i + 1]; if (mk >= 0xc0 && mk <= 0xc3 || mk === 0xc2) { w = b.readUInt16BE(i + 7); break; } i += 2 + b.readUInt16BE(i + 2); }
  ok(w === 2048, `textura de ${n} a 2048 px`);
}

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
