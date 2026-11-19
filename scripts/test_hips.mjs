// Pruebas del mapa fotográfico (src/sky/hipsLayer.js): HEALPix anidado, malla de las teselas, orden y direcciones web.
// Los valores de referencia (scripts/fixtures_hips.json) salen de astropy-healpix.
import { nestPix, faceDir, tileGrid, hipsOrder, tileUrl, hipsFade, HIPS, HIPS_FINE, inAvoid } from "../src/sky/hipsLayer.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const FX = JSON.parse(read("./fixtures_hips.json")), R = Math.PI / 180;
const dir = (ra, dec) => [Math.cos(dec * R) * Math.cos(ra * R), Math.cos(dec * R) * Math.sin(ra * R), Math.sin(dec * R)];
const sep = (a, b) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / R;

console.log("HEALPix");
ok(FX.length === 120 && FX.every(([o, ra, dec, pix]) => nestPix(o, ...dir(ra, dec)) === pix), "el píxel de 120 direcciones (órdenes 3, 5 y 8) coincide con astropy-healpix");
// el centro de la malla de la tesela es el centro del píxel, y sus cuatro esquinas, las del píxel
let cen = 0, cor = 0;
for (const [o, , , pix, lon, lat, b] of FX) {
  const g = tileGrid(o, pix, 2); cen = Math.max(cen, sep(g.dirs[4], dir(lon, lat)));
  for (const k of [0, 2, 6, 8]) cor = Math.max(cor, Math.min(...b.map((c) => sep(g.dirs[k], dir(c[0], c[1])))));
}
ok(cen < 1e-4 && cor < 1e-4, "la malla de cada tesela tiene el centro y las cuatro esquinas del píxel");
ok(FX.every(([o, , , pix]) => { const g = tileGrid(o, pix, 4); return g.dirs.every((d) => Math.abs(Math.hypot(...d) - 1) < 1e-12) && nestPix(o, ...g.dirs[12]) === pix; }), "las direcciones son unitarias y el centro cae en su propio píxel");
{ // textura: la fila de la imagen sigue x y la columna y → u crece con j (y) y v baja con i (x)
  const g = tileGrid(3, 100, 2);
  ok(g.uvs[0][0] === 0 && g.uvs[0][1] === 1 && g.uvs[2][0] === 1 && g.uvs[2][1] === 1 && g.uvs[6][0] === 0 && g.uvs[6][1] === 0, "coordenadas de textura: columna = y, fila = x (como en build_deepsky_images.py)");
  const a = faceDir(4, 0.5, 0.5); ok(Math.abs(a[2]) < 1e-12 && Math.abs(a[1]) < 1e-12 && a[0] > 0.999, "el centro de la cara 4 es el punto AR 0 h del ecuador");
}

console.log("Orden y direcciones");
ok(hipsOrder(24, 700) === HIPS.minOrder && hipsOrder(0.05, 700) === HIPS.maxOrder && hipsOrder(2, 700) > hipsOrder(8, 700) && hipsOrder(8, 1400) >= hipsOrder(8, 700), "más detalle (orden mayor) al acercarse y en pantallas altas, entre el mínimo y el máximo");
{ const o = hipsOrder(3, 800), px = 58.6 / 2 ** o / 512, scr = 3 / 800; ok(px <= scr * 1.5 && px > scr * 0.7, "el píxel de la tesela es parecido al de la pantalla"); }
ok(tileUrl(3, 112) === HIPS.base + "/Norder3/Dir0/Npix112.jpg" && tileUrl(7, 123456) === HIPS.base + "/Norder7/Dir120000/Npix123456.jpg", "dirección de la tesela: Norder/Dir (de diez mil en diez mil)/Npix");
ok(hipsFade(40) === 0 && hipsFade(30) === 0 && hipsFade(11) === 1 && hipsFade(5) === 1 && hipsFade(20) > 0.3 && hipsFade(20) < 0.7, "el mapa aparece poco a poco entre 30° y 11° de campo");
{ // sin saltos: entre 30° y 11°, un grado de zoom nunca cambia el brillo más de un 9 %, y arranca y termina suave
  let worst = 0; for (let f = 30; f > 11; f -= 1) worst = Math.max(worst, Math.abs(hipsFade(f - 1) - hipsFade(f)));
  ok(worst < 0.09 && hipsFade(29) < 0.02 && hipsFade(12) > 0.98, `el brillo cambia como mucho un ${Math.round(worst * 100)} % por grado de zoom`); }
{ const src = read("../src/sky/hipsLayer.js"), img = read("../src/sky/skyImagesLayer.js"), view = read("../src/Constellations.jsx");
  ok(/order !== shownOrder && pending === 0/.test(src) && /isCur \? \(prevOrder != null \? xf : 1\) : 1 - xf/.test(src), "al cambiar de nivel de detalle, el nuevo espera a estar completo y se cruza con el anterior (uno sube y el otro baja: no se suma su luz)");
  ok(/1 - 0\.85 \* dim/.test(src) && /get cover\(\)/.test(img) && /setDim\(ref\.skyImages \? ref\.skyImages\.cover : 0\)/.test(view), "donde una imagen de agencia cubre la vista, el mapa de debajo se atenúa"); }
ok(/skies\.esac\.esa\.int\/DSSColor$/.test(HIPS.base) && /STScI/.test(HIPS.credit) && /CDS/.test(HIPS.credit), "fuente y crédito: DSS (STScI/NASA), HiPS de CDS, servido por ESASky");
ok(!fs.existsSync(new URL("../public/textures/dss", import.meta.url)), "las placas no se guardan en el repositorio (se cargan en vivo)");

console.log("Detalle fino (Sloan) y Vía Láctea");
{ const src = read("../src/sky/hipsLayer.js"), view = read("../src/Constellations.jsx"), mw = read("../src/sky/milkyWayLayer.js");
  ok(HIPS.maxOrder === 9 && /SDSS9Color$/.test(HIPS_FINE.base) && HIPS_FINE.maxOrder === 10 && HIPS_FINE.far < 3 && /CC BY/.test(HIPS_FINE.credit), "el DSS llega a su detalle nativo (orden 9) y, con menos de 2,4° de campo, entra el Sloan (orden 10: 0,4″ por píxel)");
  ok(hipsOrder(0.1, 700, { min: 6, max: 10 }) === 10 && hipsOrder(0.1, 700) === 9 && hipsOrder(2, 700, { min: 6, max: 10 }) >= 6, "muy de cerca cada mapa da su máximo detalle");
  ok(inAvoid(dir(10.68, 41.27), HIPS_FINE.avoid) && inAvoid(dir(83.82, -5.39), HIPS_FINE.avoid) && !inAvoid(dir(339.0, 33.96), HIPS_FINE.avoid) && !inAvoid(dir(202.47, 47.2), HIPS_FINE.avoid) && !inAvoid(dir(0, 0), null), "en Andrómeda y Orión (donde el Sloan sale mal) se queda el DSS; en el Quinteto de Stephan y M51, entra el Sloan");
  ok(/needAll/.test(src) && /const bad = miss > 0 \|\| inAvoid/.test(src) && /base0 \* cov \* \(1 - under\)/.test(src) && /setUnder\(ref\.hipsFine \? ref\.hipsFine\.level : 0\)/.test(view), "el Sloan solo se enseña donde cubre toda la vista, y el DSS se retira en esa medida (no suman su luz)");
  ok(/setUnder\(v\)/.test(mw) && /ref\.milky\.setUnder\(ref\.hips \? ref\.hips\.active : 0\)/.test(view), "de cerca, la imagen general de la Vía Láctea deja paso a las placas (no se ve a manchas)"); }

console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
