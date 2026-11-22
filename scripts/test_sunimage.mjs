// Pruebas del Sol real (src/sky/sunImage.js): qué imagen de SDO corresponde a cada momento y cómo se pide.
import { sdoSlot, sdoUrl, sdoProxied, loadSunImage, SDO_START_MS, SDO_DISC, SUN_POLE } from "../src/sky/sunImage.js";
import { SITES, siteUrl } from "../src/sky/places.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const near = (a, b, t) => Math.abs(a - b) <= t;
const now = Date.UTC(2026, 10, 18, 22, 7, 30);

console.log("El Sol real (SDO)");
ok(sdoUrl(Date.UTC(2026, 10, 17, 12, 0)) === "https://sdo.gsfc.nasa.gov/assets/img/browse/2026/11/17/20261117_120000_1024_HMIIC.jpg", "la dirección de la imagen de un cuarto de hora");
ok(sdoSlot(Date.UTC(2024, 4, 10, 16, 52), now) === Date.UTC(2024, 4, 10, 16, 45), "una fecha pasada: el cuarto de hora anterior");
ok(sdoSlot(now, now) === Date.UTC(2026, 10, 18, 21, 0) && sdoSlot(now + 6 * 3600e3, now) === Date.UTC(2026, 10, 18, 21, 0), "ahora (y hasta 12 h después): la última publicada, de hace una hora");
ok(sdoSlot(now + 13 * 3600e3, now) === null && sdoSlot(Date.UTC(2009, 0, 1), now) === null && sdoSlot(SDO_START_MS + 3600e3, now) !== null, "sin imagen más allá de 12 h en el futuro ni antes de mayo de 2010");
ok(sdoProxied(Date.UTC(2026, 10, 17, 12, 0), "https://api.x").startsWith("https://api.x/api/img?u=https%3A%2F%2Fsdo.gsfc.nasa.gov%2F"), "se pide por el intermediario de Teseo (SDO no manda CORS)");
ok(/"sdo\.gsfc\.nasa\.gov"/.test(fs.readFileSync(new URL("../backend/app/img_proxy.py", import.meta.url), "utf8")), "el intermediario admite sdo.gsfc.nasa.gov");
ok(near(SDO_DISC.c, 0.4995, 1e-4) && near(SDO_DISC.r * 1024, 480.5, 0.01), "el disco ocupa 961 px centrados de los 1024");
ok(near(Math.hypot(...SUN_POLE), 1, 1e-12) && near(Math.asin(SUN_POLE[2]) * 180 / Math.PI, 63.87, 1e-9), "polo norte del Sol: AR 286,13°, Dec +63,87°");
// carga: si falta un cuarto de hora, prueba los anteriores (hasta tres)
{
  const asked = [];
  class FakeImg { set src(u) { asked.push(u); setTimeout(() => (asked.length < 3 ? this.onerror() : this.onload()), 0); } }
  const r = await loadSunImage(Date.UTC(2024, 4, 10, 16, 52), { api: "", nowMs: now, ImageCtor: FakeImg });
  ok(asked.length === 3 && r && r.slot === Date.UTC(2024, 4, 10, 16, 15), "si falta la imagen de ese cuarto de hora, usa la anterior disponible");
  class Never { set src(u) { setTimeout(() => this.onerror(), 0); } }
  ok((await loadSunImage(Date.UTC(2024, 4, 10, 16, 52), { nowMs: now, ImageCtor: Never })) === null && (await loadSunImage(now + 20 * 3600e3, { nowMs: now, ImageCtor: FakeImg })) === null, "sin imagen (hueco largo o futuro): queda la textura genérica");
}
const sky = fs.readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/loadSunImage\(tW, \{ api: API \}\)/.test(sky) && /real: \{ img: sunReal, \.\.\.SDO_DISC \}/.test(sky) && /pl = SUN_POLE/.test(sky), "el cielo pide la imagen al cambiar de cuarto de hora, la dibuja y la gira según el eje del Sol");

console.log("Enlaces de los sitios");
ok(SITES.every((s) => !s.wiki || (/^https:\/\/(es|en)\.wikipedia\.org\/wiki\/\S+$/.test(siteUrl(s, "es")) && /^https:\/\/en\.wikipedia\.org\/wiki\/\S+$/.test(siteUrl(s, "en")))), "cada sitio con artículo: en español (o, si no lo hay, en inglés) y en inglés");
ok(SITES.filter((s) => !s.wiki).length <= 2 && siteUrl(SITES.find((s) => s.id === "realalto"), "es").startsWith("https://en."), "solo uno o dos sin artículo; sin artículo en español, el inglés");
ok(/siteUrl\(cur, lang\)/.test(fs.readFileSync(new URL("../src/sky/PlaceSearch.jsx", import.meta.url), "utf8")), "el panel de sitios enlaza la página del sitio elegido");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
