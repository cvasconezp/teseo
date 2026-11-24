// Pruebas de la foto 360° (src/sky/pano360.js): geometría de las caras, unión equirectangular, nombres,
// metadatos GPano y nombre del archivo.
import { pastePatches, dirOf, altAzOf, FACES, rightOf, faceOf, equirectXY, equirectFromFaces, stretchAt, layoutPanoLabels, gpanoXmp, withGPano, panoFileName, panoSize, panoCredits, shortCredits } from "../src/sky/pano360.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// marco local: +X este, +Y cenit, −Z norte
const n = dirOf(0, 0), e = dirOf(0, 90), z = dirOf(90, 0);
ok(near(n[2], -1) && near(e[0], 1) && near(z[1], 1), "dirOf: norte −Z, este +X, cenit +Y");
const aa = altAzOf(dirOf(23, 211));
ok(near(aa.alt, 23, 1e-9) && near(aa.az, 211, 1e-9), "altAzOf deshace dirOf");
// derecha de cada cara como three.js (adelante × arriba): mirando al norte, la derecha es el este
const north = FACES.find((f) => f.key === "n"), east = FACES.find((f) => f.key === "e");
ok(rightOf(north)[0] === 1 && rightOf(east)[2] === 1, "mirando al norte la derecha es el este; mirando al este, el sur");
const fN = faceOf(dirOf(0, 0)), fE20 = faceOf(dirOf(0, 110)), fZ = faceOf(dirOf(89, 0));
ok(FACES[fN.i].key === "n" && near(fN.px, 0.5) && near(fN.py, 0.5), "el norte cae en el centro de la cara norte");
ok(FACES[fE20.i].key === "e" && fE20.px > 0.5, "20° al sur del este: mitad derecha de la cara este");
ok(FACES[fZ.i].key === "zen", "cerca del cenit: la cara de arriba");
ok(FACES[faceOf(dirOf(10, 0)).i].key === "n" && faceOf(dirOf(10, 0)).py < 0.5, "10° de altura: mitad de arriba de la cara norte");

// equirectangular: el rumbo elegido en el centro, el cenit arriba, el nadir abajo
const W = 360, H = 180;
ok(near(equirectXY(0, 120, W, H, 120).x, 180) && near(equirectXY(90, 0, W, H).y, 0) && near(equirectXY(-90, 0, W, H).y, 180), "el rumbo de la vista en el centro; cenit arriba, nadir abajo");
ok(near(equirectXY(0, 90, W, H, 0).x, 270) && near(equirectXY(0, 270, W, H, 0).x, 90), "a la derecha del centro, el este (girar a la derecha = rumbo creciente)");

// unión de caras sintéticas: cada cara de un color; la cara este, mitad izquierda roja y derecha azul
const S = 32;
const solid = (r, g, b) => { const d = new Uint8ClampedArray(S * S * 4); for (let i = 0; i < S * S; i++) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; } return { data: d, width: S, height: S }; };
const colors = { e: [200, 0, 0], w: [0, 200, 0], zen: [250, 250, 250], nad: [10, 10, 10], s: [200, 200, 0], n: [0, 0, 200] };
const faces = FACES.map((f) => solid(...colors[f.key]));
const ed = faces[0].data; for (let y = 0; y < S; y++) for (let x = S / 2; x < S; x++) { const o = (y * S + x) * 4; ed[o] = 0; ed[o + 1] = 100; ed[o + 2] = 255; }
const img = equirectFromFaces(faces, W, H, 0, null);
const px = (alt, az) => { const { x, y } = equirectXY(alt, az, W, H, 0); const o = (Math.min(H - 1, Math.floor(y)) * W + Math.min(W - 1, Math.floor(x))) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
ok(img.width === W && img.height === H && img.data.length === W * H * 4, "tamaño de la imagen");
ok(px(0, 0).join() === "0,0,200" && px(0, 180).join() === "200,200,0" && px(0, 270).join() === "0,200,0", "norte, sur y oeste salen de su cara");
ok(px(0, 75).join() === "200,0,0" && px(0, 105).join() === "0,100,255", "la cara este no sale espejada: al norte del este su mitad izquierda, al sur la derecha");
ok(px(80, 40).join() === "250,250,250" && px(-80, 300).join() === "10,10,10", "cenit y nadir");
const shifted = equirectFromFaces(faces, W, H, 90, null);
const sp = (dx) => { const o = ((H / 2) * W + W / 2 + dx) * 4; return [shifted.data[o], shifted.data[o + 1], shifted.data[o + 2]].join(); };
ok(sp(-10) === "200,0,0" && sp(10) === "0,100,255", "con rumbo 90°, el centro de la cara este queda en el centro de la imagen");

// nombres: ensanchados según la altura, sin solaparse, repetidos al cruzar el borde
ok(near(stretchAt(0), 1) && near(stretchAt(60), 2, 1e-9) && stretchAt(85) === 3, "ensanchamiento 1/cos(alt), con tope 3×");
const measure = (t) => t.length * 7;
const lay = layoutPanoLabels([
  { name: "N", cls: "cardn", alt: 1.2, az: 0 }, { name: "Orión", cls: "con", alt: 40, az: 90 },
  { name: "Tapado", cls: "star", alt: 40, az: 90.5 }, { name: "Cenit", cls: "star", alt: 85, az: 10 },
  { name: "Cayambe", cls: "peak", alt: 8, az: 94, subText: 5790 },
], { W: 2048, H: 1024, heading: 0, measure });
ok(lay.some((l) => l.name === "N") && lay.some((l) => l.name === "Orión") && !lay.some((l) => l.name === "Tapado"), "un nombre encima de otro no se pone");
ok(!lay.some((l) => l.name === "Cenit") && lay.some((l) => l.name === "Cayambe"), "cerca del cenit no se rotula (deformación); las cumbres sí");
const orion = lay.find((l) => l.name === "Orión");
ok(near(orion.s, stretchAt(40), 1e-9) && orion.x > 1024, "a 40° de altura se ensancha y queda a la derecha (este)");

// XMP GPano
const xmp = gpanoXmp({ W: 4096, H: 2048, heading: 371.24 });
ok(/<GPano:ProjectionType>equirectangular<\/GPano:ProjectionType>/.test(xmp) && /FullPanoWidthPixels>4096</.test(xmp) && /FullPanoHeightPixels>2048</.test(xmp), "XMP: proyección equirectangular y tamaño completo");
ok(/PoseHeadingDegrees>11.2</.test(xmp) && /UsePanoramaViewer>True</.test(xmp), "XMP: rumbo normalizado y visor 360°");
const jfif = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xdb, 0, 4, 1, 2, 0xff, 0xd9]);
const outJ = withGPano(jfif, { W: 4096, H: 2048 });
ok(outJ[0] === 0xff && outJ[1] === 0xd8 && outJ[2] === 0xff && outJ[3] === 0xe0, "el JPEG empieza igual (SOI + JFIF)");
const at = 4 + 16;
ok(outJ[at] === 0xff && outJ[at + 1] === 0xe1, "el APP1 (XMP) va justo después del JFIF");
const len = (outJ[at + 2] << 8) | outJ[at + 3], seg = new TextDecoder().decode(outJ.subarray(at + 4, at + 2 + len));
ok(seg.startsWith("http://ns.adobe.com/xap/1.0/\u0000") && seg.includes("GPano:ProjectionType"), "el segmento XMP lleva el espacio de nombres de Adobe y GPano");
ok(outJ[at + 2 + len] === 0xff && outJ[at + 2 + len + 1] === 0xdb && outJ.length === jfif.length + 2 + len, "el resto del JPEG sigue intacto");
const bare = withGPano(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 2, 0xff, 0xd9]), { W: 2, H: 1 });
ok(bare[2] === 0xff && bare[3] === 0xe1, "sin JFIF, el XMP va tras el SOI");
ok(withGPano(new Uint8Array([1, 2, 3, 4]), { W: 2, H: 1 }).length === 4, "si no es JPEG, no se toca");

// créditos de los datos: en el sello y dentro del archivo
const cAll = panoCredits({ terrain: true, peaks: true, clouds: true, planets: true });
ok(cAll[0].includes("HYG v4.1 (CC BY-SA 4.0)") && cAll[0].includes("Stellarium"), "siempre: estrellas (HYG) y constelaciones (Stellarium)");
ok(cAll.join(" ").includes("AWS Terrain Tiles") && cAll.join(" ").includes("OpenStreetMap (ODbL)") && cAll.join(" ").includes("Open-Meteo.com (CC BY 4.0)") && cAll.join(" ").includes("Solar System Scope"), "relieve, montañas, nubes y planetas cuando aparecen");
ok(panoCredits({}).length === 1 && !panoCredits({}).join(" ").includes("OpenStreetMap"), "sin montañas ni nubes, solo los créditos de base");
ok(cAll.length === 3, "los créditos extra van de dos en dos por línea");
ok(panoCredits({ clouds: true }, "en")[1] === "Clouds: Open-Meteo.com (CC BY 4.0)", "en inglés");
const xc = gpanoXmp({ W: 4096, H: 2048, title: "Cielo de Cayambe · 17 <nov>", credits: cAll });
ok(/<dc:creator><rdf:Seq><rdf:li>Teseo — teseo\.yachaydeep\.com<\/rdf:li>/.test(xc) && /<dc:rights>/.test(xc) && xc.includes("OpenStreetMap (ODbL)") && xc.includes("17 &lt;nov&gt;"), "XMP: autor Teseo, derechos con los créditos y texto escapado");

ok(shortCredits({}) === "Datos: HYG · Stellarium" && shortCredits({ terrain: true, peaks: true, clouds: true, planets: true }, "en") === "Data: HYG · Stellarium · AWS Terrain Tiles · © OpenStreetMap · Wikidata · Open-Meteo · Solar System Scope", "créditos cortos de la marca siempre visible");

// archivo y tamaño
ok(panoFileName("Pirámides de Guiza", { y: 2026, m: 11, d: 18, h: 6, mi: 5 }) === "teseo-360-piramides-de-guiza-2026-11-18-0605.jpg", "nombre del archivo sin tildes ni espacios");
ok(panoSize(8, 16384).W === 8192 && panoSize(8, 16384).face === 2048 && panoSize(8, 16384, true).W === 5760 && panoSize(undefined, 16384).W === 5760 && panoSize(4, 16384).face === 1440 && panoSize(2).W === 2048 && panoSize(8, 1024).W === 2048 && 5760 * 2880 < 16777216, "8192 × 4096 en equipos grandes, 5760 × 2880 en el resto (y en iOS, bajo su tope de 16,7 Mpx), 2048 × 1024 con poca memoria");

// cableado en la interfaz
const cons = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
const share = readFileSync(new URL("../src/sky/ShareDialog.jsx", import.meta.url), "utf8");
ok(/inMySky && <button type="button" className="is-extra sk-pano-btn"/.test(cons) && /build=\{buildPano\}/.test(cons), "botón «Foto 360°» en el menú (solo en Mi cielo) y diálogo de guardar o compartir");
ok(/captureFaces\(\{ THREE, renderer: ref\.renderer, scene: ref\.scene/.test(cons) && /withGPano\(/.test(cons) && /small: credits/.test(cons) && /title: `/.test(cons), "captura desde el observador, sello con créditos y metadatos");
ok(/ref\.horizon\.position\.set\(0\.003, 0, 0\.003\)/.test(cons) && /ref\.horizon\.position\.set\(0, 0, 0\)/.test(cons), "el suelo se dibuja también en el borde de las caras laterales (sin costuras)");
ok(/res\.blob \|\| await canvasBlob\(canvas\)/.test(share) && /res\.type \|\| "image\/png"/.test(share), "el diálogo acepta un archivo ya hecho (JPEG)");

// recortes centrados en cada astro (Sol, Luna, planetas): se pegan en su sitio, redondos y con borde suave
{
  const W = 800, H = 400, img = { data: new Uint8ClampedArray(W * H * 4), width: W, height: H };
  const f = dirOf(26, 135), cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nz = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
  const r = nz(cr(f, [0, 1, 0])), u = cr(r, f), size = 32, data = new Uint8ClampedArray(size * size * 4).fill(255);
  pastePatches(img, W, H, 90, [{ dir: f, fov: 10, size, data: { data }, r, u, f }]);
  let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (img.data[(y * W + x) * 4] > 200) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ratio = (x1 - x0 + 1) / (y1 - y0 + 1);
  ok(n > 100 && Math.abs(cx - 500) < 2 && Math.abs(cy - 142) < 2, "el recorte cae sobre el astro (acimut 135°, altura 26°)");
  ok(ratio > 1.0 && ratio < 1.25, `y queda redondo (solo el ensanche propio de la proyección a 26°: ${ratio.toFixed(2)}×)`);
}

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
