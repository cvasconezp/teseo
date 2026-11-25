// Landing «Acerca de»: /acerca (es) y /about (en) existen, se enlazan entre sí y están sincronizadas.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const es = readFileSync("public/acerca/index.html", "utf8");
const en = readFileSync("public/about/index.html", "utf8");
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const app = readFileSync("src/App.jsx", "utf8");
const sitemap = readFileSync("public/sitemap.xml", "utf8");
ok(/<html lang="es">/.test(es) && /<html lang="en">/.test(en), "atributo lang en cada versión");
for (const [n, h] of [["es", es], ["en", en]]) {
  ok(/hreflang="es" href="https:\/\/teseo\.yachaydeep\.com\/acerca"/.test(h) && /hreflang="en" href="https:\/\/teseo\.yachaydeep\.com\/about"/.test(h) && /hreflang="x-default"/.test(h), `${n}: enlaces hreflang a las dos versiones`);
}
ok(/rel="canonical" href="https:\/\/teseo\.yachaydeep\.com\/acerca"/.test(es) && /rel="canonical" href="https:\/\/teseo\.yachaydeep\.com\/about"/.test(en), "cada versión es su propia canónica");
ok(/class="lang-link" href="\/about"/.test(es) && /class="lang-link" href="\/acerca"/.test(en), "selector de idioma apunta a la otra versión");
ok(/var HINT_LANG = "en";/.test(es) && /var HINT_LANG = "es";/.test(en), "aviso de idioma para el navegador en el otro idioma");
ok(/Open Teseo/.test(en) && /Support/.test(en) && /narrated in Spanish/.test(en), "la versión inglesa avisa que videos y podcast están en español");
const src = vercel.rewrites.map((r) => r.source);
ok(["/acerca", "/about"].every((p) => src.indexOf(p) >= 0 && src.indexOf(p) < src.indexOf("/((?!api/|assets/).*)")), "rutas /acerca y /about antes del comodín de la app");
ok(/aboutHref = \(lang\) => \(lang === "en" \? "\/about" : "\/acerca"\)/.test(app) && !/href="\/acerca"/.test(app), "la app enlaza a /about en inglés y a /acerca en español");
ok(/\/acerca<\/loc>/.test(sitemap) && /\/about<\/loc>/.test(sitemap), "mapa del sitio con las dos versiones");
let sync = true;
try { execFileSync("python3", ["scripts/build_about_en.py", "--check"], { stdio: "pipe" }); } catch { sync = false; }
ok(sync, "/about generado a partir de /acerca y al día (scripts/build_about_en.py)");
console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
