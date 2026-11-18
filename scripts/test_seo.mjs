// Pruebas de SEO: idioma para buscadores, canónicas, hreflang, datos estructurados y sitemap.
import { langFromSearch, isCrawler, pickLang, canonicalFor, searchWithLang, SITE } from "../src/ui/seo.js";
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };
const GBOT = "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

console.log("Idioma");
ok(langFromSearch("?lang=en") === "en" && langFromSearch("?x=1&lang=es") === "es" && langFromSearch("?lang=fr") === null && langFromSearch("") === null, "?lang= reconoce es y en, ignora otros");
ok(isCrawler(GBOT) && isCrawler("Mozilla/5.0 (compatible; bingbot/2.0)") && !isCrawler("Mozilla/5.0 (iPhone) Safari/604.1"), "reconoce a Googlebot y Bingbot, no a un teléfono");
ok(pickLang({ nav: "en-US", ua: GBOT }) === "es", "Googlebot (anuncia inglés) ve el español en la dirección principal");
ok(pickLang({ search: "?lang=en", ua: GBOT }) === "en", "Googlebot ve el inglés en ?lang=en");
ok(pickLang({ nav: "en-US", ua: "Mozilla/5.0 (Windows NT 10.0) Chrome/120" }) === "en", "una persona con el navegador en inglés sigue viendo inglés");
ok(pickLang({ saved: "es", nav: "en-US" }) === "es" && pickLang({ saved: "en", search: "?lang=es" }) === "es", "preferencia guardada, pero ?lang= manda");
ok(pickLang({}) === "es", "por defecto, español");

console.log("Direcciones");
ok(canonicalFor("es") === SITE && canonicalFor("en") === `${SITE}?lang=en`, "canónica propia de cada idioma");
ok(searchWithLang("", "en") === null, "sin ?lang= no se toca la dirección");
ok(searchWithLang("?lang=en", "es") === "" && searchWithLang("?a=1&lang=es", "en") === "?a=1&lang=en", "con ?lang= se ajusta al idioma elegido");

console.log("index.html");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
ok(/<html lang="es">/.test(html), "idioma principal: español");
ok(/rel="canonical" href="https:\/\/teseo\.yachaydeep\.com\/"/.test(html), "canónica");
for (const [h, u] of [["es", SITE], ["en", `${SITE}?lang=en`], ["x-default", SITE]]) ok(html.includes(`hreflang="${h}" href="${u}"`), `hreflang ${h}`);
const desc = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || "";
ok(desc.length >= 70 && desc.length <= 160, `descripción de 70 a 160 caracteres (${desc.length})`);
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
const app = ld.find(x => x["@type"] === "WebApplication");
ok(app && app.applicationCategory === "EducationalApplication" && app.isAccessibleForFree === true && app.offers.price === "0", "datos estructurados: app educativa y gratuita");
ok(ld.some(x => x["@type"] === "WebSite"), "datos estructurados: sitio web");
ok(/<div id="root">\s*<!--[\s\S]*?<h1[^>]*>Teseo<\/h1>/.test(html), "portada estática con h1 para quien no ejecuta JavaScript");

console.log("sitemap, robots y servidor");
const sm = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
ok(sm.includes("<loc>https://teseo.yachaydeep.com/</loc>") && sm.includes("<loc>https://teseo.yachaydeep.com/?lang=en</loc>") && /<lastmod>\d{4}-\d\d-\d\d<\/lastmod>/.test(sm), "sitemap con los dos idiomas y fecha");
ok((sm.match(/hreflang=/g) || []).length === 12 && sm.includes("<loc>https://teseo.yachaydeep.com/acerca</loc>") && sm.includes("<loc>https://teseo.yachaydeep.com/about</loc>"), "sitemap con hreflang: app y landing, tres variantes por página");
ok((sm.match(/<video:video>/g) || []).length === 8 && /xmlns:video=/.test(sm), "sitemap de videos de la landing");
const robots = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");
ok(/Allow: \//.test(robots) && /Sitemap: https:\/\/teseo\.yachaydeep\.com\/sitemap\.xml/.test(robots), "robots.txt permite rastrear y anuncia el sitemap");
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const nidx = vercel.headers.find(h => h.headers.some(x => x.key === "X-Robots-Tag"));
const re = new RegExp("^/" + nidx.source.replace("/:path", "").replace(/^\(/, "(").replace(/\)$/, ")") + "$");
ok(nidx && re.test("/no-existe") && !re.test("/robots.txt") && !re.test("/sitemap.xml") && !re.test("/assets/x.js"), "las rutas que no existen llevan noindex (la app vive en «/»)");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
