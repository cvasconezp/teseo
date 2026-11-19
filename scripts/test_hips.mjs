// Pruebas del mapa fotográfico (src/sky/hipsLayer.js): HEALPix anidado, malla de las teselas, orden y direcciones web.
// Los valores de referencia (scripts/fixtures_hips.json) salen de astropy-healpix.
import { nestPix, faceDir, tileGrid, hipsOrder, tileUrl, hipsFade, HIPS } from "../src/sky/hipsLayer.js";
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
ok(hipsFade(40) === 0 && hipsFade(24) === 0 && hipsFade(14) === 1 && hipsFade(5) === 1 && hipsFade(19) > 0 && hipsFade(19) < 1, "el mapa aparece poco a poco entre 24° y 14° de campo");
ok(/skies\.esac\.esa\.int\/DSSColor$/.test(HIPS.base) && /STScI/.test(HIPS.credit) && /CDS/.test(HIPS.credit), "fuente y crédito: DSS (STScI/NASA), HiPS de CDS, servido por ESASky");
ok(!fs.existsSync(new URL("../public/textures/dss", import.meta.url)), "las placas no se guardan en el repositorio (se cargan en vivo)");

console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
