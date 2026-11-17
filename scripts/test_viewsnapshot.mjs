// Pruebas de la postal «tal como lo ves» (src/sky/viewSnapshot.js): encaje de la vista en la postal 9:16,
// estilos de los nombres y su integración en la vista Cielo y en la postal.
import { viewPlacement, labelStyle } from "../src/sky/viewSnapshot.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const O = { W: 1080, H: 1920, top: 220, bottom: 1400 };

// teléfono (840 × 1720 px): llena el ancho y cubre todo el alto, sin huecos
const m = viewPlacement(840, 1720, O);
ok(Math.abs(m.dw - 1080) < 1e-6 && m.dh > 1920 && m.dy <= 0 && m.dy + m.dh >= 1920, "teléfono: llena el ancho y todo el alto");
// ordenador (1440 × 820): ocupa al menos la mitad del alto y recorta los lados por igual
const d = viewPlacement(1440, 820, O);
ok(d.dh >= 960 - 1e-6 && d.dw > 1080 && Math.abs(d.dx + (d.dw - 1080) / 2) < 1e-6, "ordenador: al menos medio alto, lados recortados por igual");
ok(d.dy > 0 && Math.abs(d.dy + d.dh / 2 - (O.top + O.bottom) / 2) < 1e-6, "y centrada entre la cabecera y el texto");
// una vista muy ancha no deja la postal vacía
const w = viewPlacement(3000, 800, O);
ok(w.dh >= 960 - 1e-6, "panorámica: también medio alto");

ok(labelStyle("con").upper && labelStyle("peak").peak && labelStyle("cardn").center && /700/.test(labelStyle("cardn").font), "estilos como en pantalla (constelaciones en mayúsculas, montañas con palito, norte destacado)");

const sky = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
const pc = readFileSync(new URL("../src/sky/postcard.js", import.meta.url), "utf8");
ok(/snapshotView\(\{ renderer: ref\.renderer/.test(sky) && /buildPostcard\(\{ \.\.\.base, center, view/.test(sky), "la postal sin objeto lleva la vista con sus capas");
ok(/drawViewCover\(ctx, p\.view/.test(pc) && /p\.viewCredit/.test(pc), "la postal pinta la vista en vez de la carta y cita sus fuentes");
ok(/OpenStreetMap/.test(sky) && /Terrain Tiles/.test(sky) && /nubes Open-Meteo/.test(sky), "fuentes del relieve, los nombres y las nubes");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
