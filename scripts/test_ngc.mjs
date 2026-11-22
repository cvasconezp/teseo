// Pruebas de la capa «NGC e IC» (public/ngc.json, scripts/build_ngc.py): contenido del catálogo y su encaje en la vista.
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const D = JSON.parse(read("../public/ngc.json")), O = D.objects, by = Object.fromEntries(O.map((o) => [o.name, o]));
const norm = (s) => s.replace(/\s+/g, "").toUpperCase();

console.log("Catálogo");
ok(O.length === D.count && O.length > 3500 && O.length < 6000 && /OpenNGC/.test(D.meta.source) && /CC BY-SA/.test(D.meta.source), `${O.length} objetos de OpenNGC (CC BY-SA 4.0)`);
ok(O.every((o) => /^(NGC|IC) \d+[A-Z]?( NED\d+)?$/.test(o.name) && Math.abs(Math.hypot(o.nx, o.ny, o.nz) - 1) < 1e-4 && ["galaxy", "open", "globular", "nebula", "planetary", "snr", "clneb", "cluster", "dark", "other"].includes(o.type)), "cada objeto: nombre «NGC n» o «IC n», dirección unitaria y un tipo conocido");
ok(new Set(O.map((o) => o.name)).size === O.length && O.every((o) => o.mag == null || o.mag <= D.meta.mag_lim), "sin repetidos y hasta la magnitud 14,5");
ok(O.filter((o) => o.mag == null).every((o) => o.type !== "galaxy" || o.cn) && by["NGC 206"] && by["NGC 206"].type === "cluster" && by["NGC 206"].const === "And", "sin magnitud entran nebulosas, cúmulos y asociaciones (NGC 206, la nube de estrellas de Andrómeda), no las galaxias anónimas");
{ // nada de lo que ya está en otras capas
  const cw = new Set(JSON.parse(read("../public/caldwell.json")).objects.flatMap((o) => (o.ids || []).map(norm)));
  const gal = new Set(JSON.parse(read("../public/galaxies.json")).objects.map((o) => norm(o.cat || "")));
  const ms = new Set(JSON.parse(read("../public/deepsky.json")).objects.map((o) => norm(o.ngc || "")).filter(Boolean));
  const pad = (n) => norm(n).replace(/^(NGC|IC)(\d+)/, (m, a, b) => a + b.padStart(4, "0"));
  ok(!O.some((o) => cw.has(pad(o.name)) || gal.has(pad(o.name)) || ms.has(pad(o.name))), "no repite objetos de Messier, Caldwell ni Galaxias");
}
// Nebulosa de la Llama (junto a Alnitak): AR 5 h 41,9 min, Dec −1° 51′
{ const f = by["NGC 2024"], ra = (Math.atan2(f.ny, f.nx) * 180 / Math.PI + 360) % 360, dec = Math.asin(f.nz) * 180 / Math.PI;
  ok(f && f.cn === "Flame Nebula" && Math.abs(ra - 85.43) < 0.1 && Math.abs(dec + 1.85) < 0.1 && f.const === "Ori" && f.const_es === "Orión", "NGC 2024, la Nebulosa de la Llama, en su sitio en Orión"); }
ok(by["IC 434"] && by["IC 434"].type === "nebula" && O.filter((o) => o.type === "planetary").length > 50 && O.filter((o) => o.type === "globular").length > 80, "están IC 434 (la de la Cabeza de Caballo), nebulosas planetarias y cúmulos globulares");
ok(fs.statSync(new URL("../public/ngc.json", import.meta.url)).size < 700000, "el fichero pesa menos de 700 KB (unos 95 KB comprimido)");

console.log("En la vista");
const src = read("../src/Constellations.jsx"), panels = read("../src/sky/panels.jsx"), desc = read("../src/sky/describe.js");
ok(/key: "ngc",\s+file: "\/ngc\.json"/.test(src) && /lazy: true/.test(src.split('key: "ngc"')[1].split("\n")[0]) && /DEFAULT_LAYERS = \[[^\]]*"ngc"/.test(read("../src/sky/layerPresets.js")), "la capa se carga aparte y viene encendida");
ok(/const NGC_FOV = 40/.test(src) && /o\.key === "ngc" && o\.points\.visible !== show/.test(src), "sus símbolos solo se dibujan con menos de 40° de campo");
ok(/MAG_LAYERS = new Set\(\["messier", "caldwell", "galaxies", "ngc"\]\)/.test(src) && /if \(key === "ngc"\) return !!ob\.cn && \(ob\.mag == null \|\| ob\.mag <= 9\)/.test(src), "brillo del símbolo por magnitud; nombre a la vista solo para los que tienen nombre propio y brillan");
ok(/\^\(ngc\|ic\)\\s\*\\d/.test(src) && /key === "ngc" \? o\.name\.replace\(" ", ""\)/.test(src), "el buscador los encuentra con la capa apagada («ngc 2024», «ngc2024», «ic 434»)");
ok(/"caldwell", "ngc", "oddities", "specialstars", "galaxies"/.test(panels) && /L === "ngc"/.test(desc) && /srcGalaxy/.test(desc.split('L === "ngc"')[1].split("} else if")[0]), "fila en el panel de capas y ficha con tipo, magnitud, tamaño y fuente (OpenNGC)");

console.log("Cada capa enciende y apaga lo suyo");
{ const img = read("../src/sky/skyImagesLayer.js");
  ok(/hipsOn: true, ngcOn: true/.test(src) && /ref\.ngcOn = !!enabled\.ngc/.test(src), "NGC/IC sale al acercarse desde el arranque (sin tener que tocar el interruptor) y obedece a su capa");
  ok(/setPhotos\(!!enabled\.photo\)/.test(src) && /setFrames\(!!enabled\.deepfields\)/.test(src) && /setPhotos\(b\)/.test(img) && /setFrames\(b\)/.test(img), "«Mapa fotográfico» enciende y apaga todas las fotos; «Campos profundos», sus recuadros");
  ok(/m == null \? 0\.75/.test(src) && /ud\.layer === "ngc" \? \{ visible: true/.test(src), "los objetos sin magnitud publicada también se dibujan, y NGC/IC no se oculta por brillo (se ve de cerca)");
}

console.log("De cerca, como por un telescopio");
ok(/const TELE_FOV = 25/.test(src) && (src.match(/ref\.camera\.fov < TELE_FOV \? o\.points\.userData\.tele : o\.points\.userData\.vis/g) || []).length === 2 && /ud\.tele\[i\] = occ && occ\(d\) > OCC_HIDE \? 0 : 1/.test(src), "con menos de 25° de campo, los objetos de catálogo se nombran y se pueden elegir aunque no se vean a simple vista (M110, M32); solo los tapa una nube o el relieve");

console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
