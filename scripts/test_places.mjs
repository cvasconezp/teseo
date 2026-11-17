// Pruebas del buscador de lugares (src/sky/places.js) y de la lista de sitios astronómicos y arqueológicos.
import { SITES, fold, searchSites, geocodeUrl, parseGeocode, placeLine, searchPlaces } from "../src/sky/places.js";
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };

console.log("Sitios");
ok(SITES.length >= 10 && SITES.every((s) => Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180 && s.name.es && s.name.en && s.note.es && s.note.en), "cada sitio con coordenadas válidas y textos en ES y EN");
ok(new Set(SITES.map((s) => s.id)).size === SITES.length, "sin sitios repetidos");
const mp = SITES.find((s) => s.id === "machupicchu");
ok(mp && Math.abs(mp.lat + 13.1633) < 0.001 && Math.abs(mp.lon + 72.5456) < 0.001, "Machu Picchu en 13°09′48″ S, 72°32′44″ O");
ok(fold("Chichén Itzá") === "chichen itza", "compara sin tildes");
ok(searchSites("machu").length === 1 && searchSites("TEOTI")[0].id === "teotihuacan" && searchSites("cochasqui")[0].id === "cochasqui", "los sitios se encuentran por nombre, sin tildes ni mayúsculas");
ok(searchSites("a").length === 0, "con una sola letra no se busca");

console.log("Buscador (Open-Meteo)");
const u = new URL(geocodeUrl("Ciudad de México", "es"));
ok(u.hostname === "geocoding-api.open-meteo.com" && u.searchParams.get("name") === "Ciudad de México" && u.searchParams.get("language") === "es", "consulta al geocodificador en el idioma de la app");
const sample = { results: [
  { name: "Madrid", latitude: 40.4165, longitude: -3.70256, elevation: 665, admin1: "Comunidad de Madrid", country: "España", country_code: "ES" },
  { name: "Madrid", latitude: 40.4165, longitude: -3.70256, elevation: 665, admin1: "Comunidad de Madrid", country: "España", country_code: "ES" },
  { name: "Madrid", latitude: 4.73245, longitude: -74.26419, elevation: 2547, admin1: "Cundinamarca", country: "Colombia", country_code: "CO" },
  { name: "Sin coordenadas" }] };
const r = parseGeocode(sample);
ok(r.length === 2 && r[0].elev === 665 && r[1].cc === "CO", "lee nombre, lugar y altura; quita duplicados y resultados sin coordenadas");
ok(placeLine(r[0], "es") === "Comunidad de Madrid, España · 665 m", "línea de cada resultado");
ok(parseGeocode({}).length === 0, "sin resultados: lista vacía");
let calls = 0;
const f = async () => { calls++; return { ok: true, status: 200, json: async () => sample }; };
const a = await searchPlaces("Madrid", "es", { fetchImpl: f }); await searchPlaces("madrid ", "es", { fetchImpl: f });
ok(a.length === 2 && calls === 1, "la misma búsqueda no se repite");
ok((await searchPlaces("M", "es", { fetchImpl: f })).length === 0 && calls === 1, "con una letra no pregunta");
let err = null;
try { await searchPlaces("zzz", "es", { fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ reason: "limit" }) }) }); } catch (e) { err = e.message; }
ok(err === "limit", "si el servicio falla, el error trae su motivo");

console.log("Integración");
const panels = readFileSync(new URL("../src/sky/panels.jsx", import.meta.url), "utf8");
ok(/<PlaceSearch lang=\{lang\}/.test(panels) && /<SiteChips/.test(panels), "el panel Mi cielo tiene el buscador y los sitios");
const credits = readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");
ok(/GeoNames/.test(credits) && /Geocoding/.test(credits), "créditos del buscador");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
