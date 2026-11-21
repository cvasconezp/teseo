// Pruebas del buscador de lugares (src/sky/places.js) y de la lista de sitios astronómicos y arqueológicos.
import { SITES, fold, searchSites, geocodeUrl, parseGeocode, placeLine, searchPlaces, photonUrl, parsePhoton, mergePeaks, PEAK_CODES, OSM_PEAK_R, countryName, rankPeaks } from "../src/sky/places.js";
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
const f = async (url) => { calls++; return { ok: true, status: 200, json: async () => (String(url).includes("photon") ? { features: [] } : sample) }; };
const a = await searchPlaces("Madrid", "es", { fetchImpl: f }); await searchPlaces("madrid ", "es", { fetchImpl: f });
ok(a.length === 2 && calls === 2, "la misma búsqueda no se repite (una consulta a cada servicio)");
ok((await searchPlaces("M", "es", { fetchImpl: f })).length === 0 && calls === 2, "con una letra no pregunta");
let err = null;
try { await searchPlaces("zzz", "es", { fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ reason: "limit" }) }) }); } catch (e) { err = e.message; }
ok(err === "limit", "si el servicio falla, el error trae su motivo");

console.log("Cumbres y volcanes (Photon, OpenStreetMap)");
const pu = new URL(photonUrl("Cayambe"));
ok(pu.hostname === "photon.komoot.io" && pu.searchParams.getAll("osm_tag").join() === "natural:peak,natural:volcano" && pu.searchParams.get("lang") === "en", "solo cumbres y volcanes, con nombres en inglés (Photon no tiene español)");
ok(countryName("JP", "es") === "Japón" && countryName("TZ", "en") === "Tanzania" && countryName(null, "es", "X") === "X", "el país, en el idioma de la app");
const ph = { features: [
  { properties: { name: "Cayambe", osm_value: "volcano", state: "Pichincha", country: "Ecuador", countrycode: "EC" }, geometry: { coordinates: [-77.9889555, 0.0251586] } },
  { properties: { name: "Catamba", osm_value: "peak", country: "Angola" }, geometry: { coordinates: [14.65, -13.42] } },
  { properties: { name: "Cayambe" }, geometry: {} }] };
const pk = parsePhoton(ph, "cayambe");
ok(pk.length === 1 && pk[0].kind === "volcano" && pk[0].peak === OSM_PEAK_R && Math.abs(pk[0].lat - 0.02516) < 1e-5, "deja solo los nombres que contienen lo buscado (Photon es difuso)");
ok(placeLine(pk[0], "es") === "Volcán · Pichincha, Ecuador", "línea de un volcán");
const geo = parseGeocode({ results: [
  { name: "Cotopaxi", latitude: -0.68917, longitude: -78.42889, elevation: 5315, admin1: "Cotopaxi", country: "Ecuador", country_code: "EC", feature_code: "MT" },
  { name: "Cotopaxi", latitude: 0.80383, longitude: -79.59165, elevation: 62, country: "Ecuador", country_code: "EC", feature_code: "PPL" }] });
ok(geo[0].peak === PEAK_CODES.MT && !geo[1].peak, "una montaña de GeoNames lleva el radio para buscar su cumbre; un pueblo no");
ok(placeLine(geo[0], "es") === "Cumbre · Cotopaxi, Ecuador", "de una montaña no se da la altura de GeoNames (suele ser la de la falda)");
const osmC = parsePhoton({ features: [{ properties: { name: "Cotopaxi", osm_value: "volcano", state: "Pichincha", country: "Ecuador" }, geometry: { coordinates: [-78.4377734, -0.6805597] } }] }, "Cotopaxi");
const mg = mergePeaks(geo, [...osmC, ...pk]);
ok(mg.length === 3 && mg[0].osm && mg[0].lat === -0.68056 && mg[0].region === "Pichincha" && mg[1].cc === "EC" && mg[2].name === "Cayambe",
  "la montaña de GeoNames se cambia por su cumbre de OSM (a 1,4 km); los demás picos van después");
let n2 = 0;
const f2 = async (url) => { n2++; if (String(url).includes("photon")) throw new Error("caído"); return { ok: true, status: 200, json: async () => sample }; };
ok((await searchPlaces("Madrid2", "es", { fetchImpl: f2 })).length === 2 && n2 === 2, "si Photon falla, la búsqueda sigue");
const f3 = async (url) => (String(url).includes("photon") ? { ok: true, status: 200, json: async () => ph } : { ok: false, status: 500, json: async () => ({}) });
ok((await searchPlaces("Cayambe", "es", { fetchImpl: f3 })).length === 1, "si Open-Meteo falla, quedan las cumbres");

{
  const uh = parsePhoton({ features: [{ properties: { name: "Uhuru Peak", osm_value: "peak", state: "Kilimanjaro", countrycode: "TZ", country: "Tanzania" }, geometry: { coordinates: [37.354, -3.0764] } }] }, "Kilimanjaro", "es");
  ok(uh.length === 1 && uh[0].country === "Tanzania", "una cumbre cuya región se llama como lo buscado (el Uhuru, en Kilimanjaro)");
  const list = [{ name: "Mount Everest", lat: 41.62, lon: -87.19, peak: 300 }, { name: "Mount Everest", lat: 27.988, lon: 86.925, peak: 300 }];
  const rk = await rankPeaks(list, { fetchImpl: async () => ({ ok: true, json: async () => ({ heights: [219, 8752] }) }) });
  ok(rk[0].lon === 86.925 && rk[0].elevModel === 8752 && placeLine({ ...rk[0], region: "Koshi", country: "Nepal", kind: "peak" }, "es") === "Cumbre · Koshi, Nepal · ≈ 8.752 m", "entre homónimas, primero la más alta, con su altura aproximada");
  const towns = Array.from({ length: 9 }, (_, i) => ({ name: "Fuji", lat: 35 + i * 0.1, lon: 138, cc: "JP" }));
  const mf = mergePeaks(towns, [{ name: "Mount Fuji", lat: 35.36, lon: 138.73, peak: 300, osm: true, kind: "volcano" }]);
  ok(mf.length === 10 && mf[1].name === "Mount Fuji", "con muchos pueblos homónimos, el monte va segundo y no se cae de la lista");
  const same = await rankPeaks(list, { fetchImpl: async () => { throw new Error("x"); } });
  ok(same === list, "sin servidor, el orden de Photon");
}

console.log("Integración");
const panels = readFileSync(new URL("../src/sky/panels.jsx", import.meta.url), "utf8");
ok(/<PlaceSearch lang=\{lang\}/.test(panels) && /<SiteChips/.test(panels), "el panel Mi cielo tiene el buscador y los sitios");
const credits = readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");
ok(/GeoNames/.test(credits) && /Geocoding/.test(credits), "créditos del buscador");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
