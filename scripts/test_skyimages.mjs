// Pruebas de las fotos reales en el cielo (src/sky/skyImagesLayer.js) y de la capa «Campos profundos».
import { tanCorners } from "../src/sky/skyImagesLayer.js";
import { raDecToVec, angSepDeg, vecToRaDec } from "../src/sky/guides.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const near = (a, b, t) => Math.abs(a - b) <= t;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

console.log("Fotos en el cielo");
const man = JSON.parse(read("../public/deepsky-images.json"));
ok(man.objects.length >= 18 && man.objects.every((o) => fs.existsSync(new URL(`../public/textures/deepsky/${o.id}.webp`, import.meta.url)) && o.size > 0 && ["sdss", "2mass"].includes(o.survey)), `${man.objects.length} objetos, cada uno con su imagen y su cartografiado (SDSS o 2MASS)`);
const tot = man.objects.reduce((s, o) => s + fs.statSync(new URL(`../public/textures/deepsky/${o.id}.webp`, import.meta.url)).size, 0);
ok(tot < 1.5e6, `las imágenes pesan ${(tot / 1e6).toFixed(2)} MB en total`);
// geometría: el recorte mide lo que dice, el norte queda arriba y el este a la izquierda
const m31 = man.objects.find((o) => o.id === "m31"), cs = tanCorners(m31.ra, m31.dec, m31.size), c = raDecToVec(m31.ra, m31.dec);
const mid = (a, b) => { const v = [a[0] + b[0], a[1] + b[1], a[2] + b[2]], n = Math.hypot(...v); return v.map((x) => x / n); };
const top = vecToRaDec(mid(cs[0], cs[1])), left = vecToRaDec(mid(cs[0], cs[3]));
ok(near(angSepDeg(mid(cs[0], cs[1]), mid(cs[3], cs[2])), m31.size, 0.01) && near(angSepDeg(mid(cs[0], cs[2]), c), 0, 1e-6), "el recorte está centrado en el objeto y mide su lado");
ok(top.dec > m31.dec + 1.6 && near(top.ra, m31.ra, 0.01) && left.ra > m31.ra + 1.5, "norte arriba (más declinación) y este a la izquierda (más ascensión recta)");
// la posición de los objetos coincide con el catálogo Messier de la app (a menos de 0,1°)
const cat = JSON.parse(read("../public/deepsky.json")).objects;
const off = man.objects.filter((o) => /^m\d+$/.test(o.id)).map((o) => { const k = cat.find((x) => x.m === +o.id.slice(1)); return k ? angSepDeg(raDecToVec(o.ra, o.dec), [k.nx, k.ny, k.nz]) : 99; });
ok(off.length >= 14 && Math.max(...off) < 0.1, `los ${off.length} objetos Messier están donde los pone el catálogo (máx. ${Math.max(...off).toFixed(3)}°)`);
const sky = read("../src/Constellations.jsx");
ok(/createSkyImagesLayer\(/.test(sky) && /ref\.skyImages\.group\.quaternion\.copy\(q\)/.test(sky) && /skyImages\.setIntensity\(/.test(sky), "el cielo las dibuja, giran con las estrellas y siguen la oscuridad del cielo");

console.log("Campos profundos");
const df = JSON.parse(read("../public/deepfields.json")).objects;
ok(df.length === 6 && df.every((o) => near(Math.hypot(o.nx, o.ny, o.nz), 1, 1e-4) && angSepDeg(raDecToVec(o.ra, o.dec), [o.nx, o.ny, o.nz]) < 0.01 && o.size_arcmin > 0 && o.note && o.note_en), "seis campos con posición, tamaño y explicación en dos idiomas");
const hudf = df.find((o) => /Ultraprofundo/.test(o.name));
ok(near(hudf.ra, 53.1625, 0.01) && near(hudf.dec, -27.7914, 0.01) && near(df.find((o) => /Webb/.test(o.name)).dec, -73.4543, 0.01), "el Ultraprofundo del Hubble en Fornax y el primer campo del Webb (SMACS 0723) en su sitio");
ok(/key: "deepfields", file: "\/deepfields\.json"/.test(sky) && /"deepfields", "blackholes"/.test(read("../src/sky/panels.jsx")), "la capa «Campos profundos» está en el panel de capas y en el buscador");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
