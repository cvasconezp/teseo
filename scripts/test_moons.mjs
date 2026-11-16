// Pruebas de las lunas de otros planetas (src/sky/moons.js, moonsData.js):
//  · posición de cada luna respecto a su planeta frente a JPL Horizons (scripts/moons_check.json:
//    RA/Dec astrométricas geocéntricas de la luna y del planeta en 7 fechas, una fuera del ajuste);
//  · tiempo de luz, ocultaciones y tránsitos, anillo de Saturno, buscador y textos ES/EN.
// Uso:  node scripts/test_moons.mjs   (sale con código 1 si algo falla)
import fs from "node:fs";
import { MOON_TEXTURES, moonBody, MOON_KEYS, MOON_INFO, moonsOf, planetView, searchMoons, seeWith, moonVectorKm, moonName, PLANET_RADIUS_KM } from "../src/sky/moons.js";
import { MOON_ORBITS } from "../src/sky/moonsData.js";
import { ephemeris } from "../src/ephemeris.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const check = JSON.parse(fs.readFileSync(new URL("./moons_check.json", import.meta.url), "utf8"));
const RAD = Math.PI / 180;
const PLANET_EN = { "Marte": "Mars", "Júpiter": "Jupiter", "Saturno": "Saturn", "Urano": "Uranus", "Neptuno": "Neptune" };

console.log("Datos");
ok(MOON_KEYS.length === 19, "19 lunas (Hiperión fuera: órbita caótica)");
ok(MOON_ORBITS.every((o) => o.rms_km / o.a_km < 0.04), "cada órbita ajustada con error < 4 % de su radio frente a Horizons",
  MOON_ORBITS.filter((o) => o.rms_km / o.a_km >= 0.04).map((o) => o.key).join());
ok(MOON_KEYS.every((k) => MOON_INFO[k] && MOON_INFO[k].es && MOON_INFO[k].en && MOON_INFO[k].year && MOON_INFO[k].by && MOON_INFO[k].note.es && MOON_INFO[k].note.en), "nombre, descubrimiento y dato en ES y EN para cada luna");
ok(moonsOf("Júpiter").join() === "Io,Europa,Ganymede,Callisto", "Júpiter: Ío, Europa, Ganímedes y Calisto, en orden");
ok(moonsOf("Saturno").length === 7 && moonsOf("Urano").length === 5 && moonsOf("Neptuno").join() === "Triton" && moonsOf("Marte").join() === "Phobos,Deimos", "Saturno 7, Urano 5, Neptuno 1, Marte 2");
{
  const v = moonVectorKm("Titan", 0), r = Math.hypot(...v);
  ok(Math.abs(r - 1221870) / 1221870 < 0.05, `Titán a ${Math.round(r)} km de Saturno (NASA: 1 221 870)`);
}

console.log("Frente a JPL Horizons (offsets en el cielo, segundos de arco)");
{
  let worst = { rel: 0 }, n = 0;
  for (const [key, rows] of Object.entries(check.moons)) {
    const o = MOON_ORBITS.find((x) => x.key === key); if (!o) continue;
    rows.forEach((row, i) => {
      const [ram, decm, rap, decp] = row;
      const jd = check.epoch_jd_ut[i], date = new Date((jd - 2440587.5) * 86400000);
      const pe = ephemeris(date).find((b) => b.planet === PLANET_EN[o.parent]);
      const c = Math.cos(decp * RAD);
      const planet = { name: o.parent, nx: c * Math.cos(rap * RAD), ny: c * Math.sin(rap * RAD), nz: Math.sin(decp * RAD), dist_au: pe.dist_au, r_au: pe.r_au };
      const m = planetView(planet, date).moons.find((x) => x.key === key);
      let dra = ram - rap; if (dra > 180) dra -= 360; if (dra < -180) dra += 360;
      const hx = dra * Math.cos(decp * RAD) * 3600, hy = (decm - decp) * 3600;
      const err = Math.hypot(m.x - hx, m.y - hy), rel = err / m.aArcsec;
      if (i < rows.length - 1) { n++; if (rel > worst.rel) worst = { rel, key, i, err }; }
      else ok(rel < 0.15, `${key} a 1000 días de la época (fuera del ajuste): error ${(rel * 100).toFixed(1)} % del radio de su órbita`);
    });
  }
  ok(worst.rel < 0.05, `${n} comparaciones dentro del período de ajuste: el peor error es ${(worst.rel * 100).toFixed(2)} % del radio de la órbita (${worst.key}, ${worst.err.toFixed(2)}″)`);
}

console.log("Geometría");
{
  // planeta inventado en el eje x del ICRF: el este es +y y el norte +z
  const date = new Date(Date.UTC(2026, 10, 16));
  const view = planetView({ name: "Júpiter", nx: 1, ny: 0, nz: 0, dist_au: 5, r_au: 5.3 }, date);
  ok(Math.abs(view.radius - 71492 / (5 * 149597870.7) * 206264.806) < 1e-9, "radio aparente de Júpiter a 5 UA ≈ 19,7″");
  ok(view.moons.every((m) => (m.sep < view.radius) === (m.state !== "free")), "dentro del disco = tránsito u ocultación");
  const callisto = view.moons.find((m) => m.key === "Callisto");
  ok(callisto.aArcsec > 500 && callisto.aArcsec < 530, "Calisto se aparta hasta ~8,7′ de Júpiter a 5 UA");
  const now = new Date(Date.UTC(2026, 10, 16, 3));
  const sat = ephemeris(now).find((b) => b.planet === "Saturn");
  const sv = planetView({ name: "Saturno", nx: sat.nx, ny: sat.ny, nz: sat.nz, dist_au: sat.dist_au, r_au: sat.r_au }, now);
  ok(sv.ring && Math.abs(sv.ring.tilt) < 8, `anillos de Saturno casi de canto en nov-2026 (B = ${sv.ring.tilt.toFixed(1)}°, tras el cruce del plano de 2025)`);
  ok(Object.keys(PLANET_RADIUS_KM).length === 5, "radios de los cinco planetas con lunas");
}

console.log("Buscador y nombres");
ok(searchMoons("io").includes("Io") && searchMoons("ío").includes("Io"), "«io» y «ío» encuentran Ío");
ok(searchMoons("ganimedes")[0] === "Ganymede" && searchMoons("Ganymede")[0] === "Ganymede", "Ganímedes en ES y EN, sin tildes");
ok(searchMoons("titan").includes("Titan") && searchMoons("tritón").includes("Triton"), "Titán y Tritón");
ok(searchMoons("lunas de júpiter").join() === "Io,Europa,Ganymede,Callisto" && searchMoons("moons of saturn").length === 7, "«lunas de Júpiter», «moons of Saturn»");
ok(searchMoons("lunas").length === 19 && searchMoons("galileanos").length === 4, "«lunas» lista todas; «galileanos» las cuatro de Galileo");
ok(searchMoons("luna").length === 0 && searchMoons("moon").length === 0, "«luna» / «moon» siguen siendo la Luna de la Tierra");
ok(moonName("Iapetus", "es") === "Jápeto" && moonName("Iapetus", "en") === "Iapetus", "nombres en español: Jápeto");
ok(seeWith(5.5, 200, "Júpiter") === "binoculars" && seeWith(8.3, 180, "Saturno") === "small" && seeWith(13.8, 30, "Urano") === "large" && seeWith(11, 20, "Marte") === "hard", "con qué se ve: prismáticos, telescopio pequeño, grande; Marte deslumbra");

console.log("Texturas del globo 3D");
{
  const keys = Object.keys(MOON_TEXTURES);
  ok(keys.length === 14 && keys.every((k) => fs.existsSync(new URL(`../public/textures/moon-${k.toLowerCase()}.jpg`, import.meta.url))), "14 lunas con mosaico del USGS en public/textures");
  ok(["Miranda", "Ariel", "Umbriel", "Titania", "Oberon"].every((k) => !moonBody(k)), "las lunas de Urano no llevan globo (no hay mosaico global): foto");
  ok(keys.every((k) => { const sz = fs.statSync(new URL(`../public/textures/moon-${k.toLowerCase()}.jpg`, import.meta.url)).size; return sz > 20000 && sz < 400000; }), "cada textura pesa entre 20 y 400 KB");
  ok(moonBody("Io").id === "moon-io" && moonBody("Io").credit === "usgs" && moonBody("Titan").mission.es.includes("infrarrojo"), "globo: id de textura, crédito y misión");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
