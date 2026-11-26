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
// Videoteca y animaciones (rediseño 1.99.0): cada hallazgo de la revisión, convertido en prueba.
const ldMedia = JSON.parse(es.match(/<script type="application\/ld\+json" id="ld-media">\n?(.*?)\n?<\/script>/s)[1])["@graph"].filter((x) => x["@type"] === "VideoObject");
const cards = [...es.matchAll(/<li class="vt__i" id="v-([a-z-]+)">(.*?)<\/li>/gs)].map((m) => ({ slug: m[1], html: m[2] }));
ok(cards.length === 8 && ldMedia.length === 8 && ldMedia.every((v) => cards.some((c) => v.embedUrl.endsWith("#v-" + c.slug) && v.contentUrl.endsWith("/" + c.slug + ".mp4"))), "videoteca: ocho tarjetas y cada VideoObject apunta al anclaje de la suya");
ok(cards.every((c) => new RegExp(`<a class="vt__a" href="/acerca/video/${c.slug}\\.mp4" data-video="${c.slug}"`).test(c.html) && new RegExp(`<video preload="none"[^>]*poster="/acerca/video/${c.slug}\\.jpg"[^>]*><source src="/acerca/video/${c.slug}\\.mp4"`).test(c.html)), "videoteca: cada tarjeta enlaza su .mp4 (funciona sin JavaScript) y lleva el <video> en la página sin precargarlo");
ok(cards.every((c) => { const v = ldMedia.find((x) => x.embedUrl.endsWith("#v-" + c.slug)), d = /PT(\d+)M(\d+)S/.exec(v.duration), b = /<b>(\d+):(\d\d)<\/b>/.exec(c.html); return d && b && +d[1] === +b[1] && +d[2] === +b[2]; }), "videoteca: la duración de cada tarjeta coincide con la de los datos estructurados");
ok([...es.matchAll(/data-video="([a-z-]+)"/g)].every((m) => cards.some((c) => c.slug === m[1])) && (es.match(/<video /g) || []).length === 10, "todo enlace a un video abre uno de la videoteca; fuera de ella solo quedan el reproductor y el de instalar");
ok(["horizonte", "marte", "espectro"].every((n) => es.includes(`<figure class="anim anim--${n}" data-anim="${n}">`) && en.includes(`data-anim="${n}"`)) && /html:not\(\.js\) \.anim\{display:none\}/.test(es) && /document\.documentElement\.className \+= " js"/.test(es), "tres animaciones en las dos versiones; sin JavaScript no se muestran a medias");
ok(/data-anim-toggle>/.test(es) && !/data-anim-toggle aria-pressed/.test(es) && /prefers-reduced-motion: reduce/.test(es), "animaciones pausables (el botón cambia de texto, sin aria-pressed) y respetan «reducir movimiento»");
ok(/function turn\(\)\{rot=\(rot\+2\*PI\*SYN\/TE\)%\(2\*PI\)\}/.test(es) && !/D=\(D\+q\)%SYN/.test(es), "viaje a Marte: al repetirse la ventana los planetas no saltan (se acumula el giro)");
ok(!/root\.style\.setProperty\("--(pag|hilo)"/.test(es), "el hilo de avance no reescribe propiedades en <html> al desplazarse");
ok(!/[áéíóúñ¿¡]/i.test(en.replace(/Killa Ñan|Cochasquí|Júpiter|Leer en español|Esta página también está en español\.|Versión en español|Carlos Vásconez-Paredes|aria-label="[^"]*"/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<head>[\s\S]*?<\/head>/, "").replace(/<!--[\s\S]*?-->/g, "")), "la versión inglesa no deja texto visible en español");
// Versión sintética (1.100.0): apoyo arriba, botones en vez de tarjetas, videoteca en una fila.
ok(es.indexOf('<section id="apoya"') > es.indexOf('<section id="videoteca"') && /id="paypal-load"/.test(es) && /qr-donar\.png/.test(es) && /github\.com\/sponsors\/cvasconezp/.test(es) && /<figure class="anim anim--amanecer hero__fig"/.test(es), "«Apoya» conserva sus cuatro tarjetas al final; la portada abre con la animación del amanecer");
ok((es.match(/<a class="act" href="\/#(ruta|ahora|preguntas\?q=(spectrum|mass|bh))"/g) || []).length === 5 && !/<a class="card"/.test(es), "Ruta, Ahora y los tres laboratorios son botones con icono, no tarjetas con captura");
ok(/<ul class="vt vt--strip"/.test(es) && /<details class="src-more more">/.test(es) && (es.match(/<details class="nota">/g) || []).length === 3, "videoteca en una fila; «De dónde sale cada cosa» y las notas de las figuras, plegadas pero presentes");
let sync = true;
try { execFileSync("python3", ["scripts/build_about_en.py", "--check"], { stdio: "pipe" }); } catch { sync = false; }
ok(sync, "/about generado a partir de /acerca y al día (scripts/build_about_en.py)");
console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
