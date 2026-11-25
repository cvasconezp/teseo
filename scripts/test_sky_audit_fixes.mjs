// Pruebas de las correcciones de la auditoría del Cielo (2026-11-25): el tiempo del lugar correcto, la hora repetida
// del cambio de horario, las lluvias «activas» en la fecha del cielo, la zona horaria del panel de nubes, la
// liberación de WebGL y las distancias de M42/M43 y del grupo de Centauro A.
// Uso:  node scripts/test_sky_audit_fixes.mjs     (sale con código 1 si algo falla)
process.env.TZ = "America/New_York";   // antes de crear fechas: la hora repetida del 1 de noviembre de 2026
import { readFileSync } from "node:fs";
import { wxForPlace, NEAR_DEG } from "../src/sky/nowWeather.js";
import { createWhenAdvance, fmtLocalInput } from "../src/sky/whenClock.js";
import { describeObject } from "../src/sky/describe.js";
import { TX } from "../src/sky/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => {
  if (cond) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FALLA ${name} ${detail}`); }
};
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const src = read("../src/Constellations.jsx");

console.log("C3 · el tiempo de ahora es del lugar que se muestra");
{
  const w = { temp: 16, place: { lat: -0.18, lon: -78.47 } };   // Quito
  ok(wxForPlace(w, -0.18, -78.47) === w, "mismo lugar: se muestra");
  ok(wxForPlace(w, -0.18 + NEAR_DEG * 0.8, -78.47) === w, "punto vecino del mismo sitio (< ~5 km): se conserva");
  ok(wxForPlace(w, 40.42, -3.70) === null, "otra ciudad (Madrid): no se muestra el tiempo de Quito");
  ok(wxForPlace({ temp: 1 }, 0, 0) === null && wxForPlace(null, 0, 0) === null && wxForPlace(w, null, null) === null, "sin lugar guardado o sin lugar actual: nada");
  ok(/setWxNow\(\{ \.\.\.w, fetchedAt: Date\.now\(\), place \}\)/.test(src) && /setWxMod\(m \? \{ \.\.\.m, place \} : m\)/.test(src), "el dato de ahora y el de los modelos guardan su lugar");
  ok(/const wxNow = wxNowKey \? wxForPlace\(wxNowRaw, lat, lon\) : null;/.test(src) && /const wxMod = wxNowKey \? wxForPlace\(wxModRaw, lat, lon\) : null;/.test(src), "la pastilla y la tarjeta solo usan el dato del lugar");
  ok(/const ask = \(\) => \{ clearTimeout\(retry\);/.test(src) && /const again = \(\) => \{ clearTimeout\(retry\); retry = setTimeout\(ask, 30000\); \};/.test(src), "un reintento pendiente se cancela antes de otro (no se acumulan cadenas)");
}

console.log("C2 · la hora repetida del cambio de horario (TZ=America/New_York, 1-nov-2026)");
{
  ok(new Date(2026, 10, 1, 12).getTimezoneOffset() === 300 && new Date(2026, 9, 31, 12).getTimezoneOffset() === 240, "la prueba corre con la zona de Nueva York");
  // lo de antes: re-parsear la cadena local hace volver de 01:50 (segunda vez) a 01:00 y el play queda en bucle
  let w = "2026-11-01T01:00"; const old = [];
  for (let i = 0; i < 18; i++) { w = fmtLocalInput(new Date(new Date(w).getTime() + 10 * 60000)); old.push(w.slice(11)); }
  ok(!old.includes("03:00"), "reproducción del fallo: re-parseando no se pasa de las 02:00", old.join(" "));
  const adv = createWhenAdvance(fmtLocalInput); w = "2026-11-01T01:00"; const seen = [];
  for (let i = 0; i < 18; i++) { w = adv(w, 10 * 60000); seen.push(w.slice(11)); }
  ok(seen.join(" ") === "01:10 01:20 01:30 01:40 01:50 01:00 01:10 01:20 01:30 01:40 01:50 02:00 02:10 02:20 02:30 02:40 02:50 03:00", "el play recorre la hora repetida una sola vez y sigue", seen.join(" "));
  const a2 = createWhenAdvance(fmtLocalInput), s1 = a2("2026-11-01T01:50", 0);
  ok(a2("2026-11-01T01:50", 10 * 60000) === a2("2026-11-01T01:50", 10 * 60000), "idempotente para la misma cadena (actualizador de React en modo estricto)");
  ok(s1 === "2026-11-01T01:50" && createWhenAdvance()("2026-03-08T01:50", 10 * 60000) === "2026-03-08T03:00", "el salto de primavera (02:00 no existe) también avanza");
  ok(createWhenAdvance()("2026-07-01T23:55", 60000 * 10) === "2026-07-02T00:05", "un día corriente: igual que antes");
  ok(/const advanceWhen = useMemo\(\(\) => createWhenAdvance\(fmtInput\), \[\]\);/.test(src) && !/new Date\(new Date\(w\)\.getTime\(\)/.test(src), "Constellations.jsx avanza con advanceWhen (play, velocidad, minuto a minuto, ±min)");
  ok((src.match(/advanceWhen\(w, /g) || []).length === 4, "los cuatro avances usan el instante recordado");
}

console.log("C7 · «activa ahora» en la fecha del cielo y la zona del lugar");
ok(/meteorActive\(liveObj, when, placeTz\)/.test(src) && /function meteorActive\(o, now = new Date\(\), tz = null\) \{\n\s+const p = tzParts\(now, tz\);/.test(src), "la ficha usa la fecha del cielo (when) en la zona del lugar");

console.log("C8 · el panel de nubes en la hora del lugar");
{
  const wp = read("../src/sky/WeatherPanel.jsx");
  ok(/const hhmm = \(s, lang, tz\) =>[^\n]*\.\.\.tzOpt\(tz\)/.test(wp) && !/hhmm\([^)]*, lang\)/.test(wp), "todas las horas del panel pasan la zona");
  ok(/d\.toLocaleTimeString\([^\n]*\.\.\.tzOpt\(tz\)/.test(wp) && /<SatelliteView [^>]*tz=\{tz\}/.test(wp), "la hora del barrido del satélite también");
  ok(/pointHours=\{wxNow \? wxNow\.hours : null\} tz=\{placeTz\}/.test(src), "Constellations.jsx le pasa placeTz");
  const t = 1793422800;   // 2026-11-01T05:00Z
  const hh = (tz) => new Date(t * 1000).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  ok(hh("Asia/Tokyo") !== hh("America/Guayaquil"), "la zona cambia la hora mostrada", `${hh("Asia/Tokyo")} / ${hh("America/Guayaquil")}`);
}

console.log("C9 · liberar WebGL al desmontar");
{
  const i = src.indexOf("renderer.dispose();"), blk = src.slice(i - 900, i);
  ok(/for \(const L of \[milky, hips, hipsFine, terrain, near3d, monuments, plume, mountLines, issLayer, atm, clouds, aurora, depthView\]\)/.test(blk) && /try \{ L\.dispose\(\); \}/.test(blk), "las capas se liberan antes de renderer.dispose()");
  for (const f of ["milkyWayLayer", "hipsLayer", "terrainLayer", "terrain3d", "monumentLayer", "plumeLayer", "mountLinesLayer", "issLayer", "atmosphereLayer", "cloudsLayer", "auroraLayer", "depthView"]) {
    ok(/\bdispose\(\) \{/.test(read(`../src/sky/${f}.js`)), `${f}.js tiene dispose()`);
  }
}

console.log("C5 · M42 y M43 a la distancia de Kounkel et al. 2017 (388 pc)");
{
  const ds = JSON.parse(read("../public/deepsky.json")).objects, m = (n) => ds.find((o) => o.m === n);
  ok(m(42).dist_ly === 1265 && m(43).dist_ly === 1265, "M42 y M43: 1265 a.l. (la misma nube)");
  ok(Math.round(388 * 3.26156) === 1265 && /ORION_PC = \{ val: 388/.test(read("../src/questions/scaleData.js")), "el mismo valor que ORION_PC (388 pc) en la pregunta de escala");
  ok(m(31).dist_ly === 2540000, "M31 no cambia");
}

console.log("C4 · Centauro A y vecinas: distancia publicada, no por redshift");
{
  const g = JSON.parse(read("../public/galaxies.json")), by = (c) => g.objects.find((o) => o.cat === c);
  ok(g.meta.count === g.objects.length, "meta.count coincide con los objetos", `${g.meta.count} / ${g.objects.length}`);
  ok(by("NGC5128").dist_ly === 1.1e7 && by("NGC4945").dist_ly === 1.2e7 && by("NGC5102").dist_ly === 1.11e7 && by("NGC1313").dist_ly === 1.35e7, "Centauro A 11, NGC 4945 12, NGC 5102 11,1 y NGC 1313 13,5 millones de a.l.");
  ok(["NGC5128", "NGC4945"].every((c) => by(c).dist_src === "nasa") && ["NGC5102", "NGC1313"].every((c) => by(c).dist_src === "trgb"), "con su procedencia (dist_src)");
  ok(g.objects.filter((o) => o.dist_src).length === 4, "solo esas cuatro");
  const py = read("./build_deepsky.py");
  ok(/DIST_OVERRIDE = \{/.test(py) && /caldwell-77/.test(py) && /caldwell-83/.test(py) && /0004-6361:20020042/.test(py) && /astro-ph\/0204192/.test(py), "build_deepsky.py tiene la tabla con sus fuentes");
  const t = new Proxy({ ...TX.es, distPublished: "PUB", distRedshift: "RED" }, { get: (o, k) => (k in o ? o[k] : typeof k === "string" ? (...a) => String(k) : undefined) });
  const cenA = describeObject({ ...by("NGC5128"), layer: "galaxies" }, "es", t, false);
  const other = describeObject({ ...g.objects.find((o) => !o.dist_src), layer: "galaxies" }, "es", t, false);
  ok(cenA.distNote === "PUB" && other.distNote === "RED", "la ficha dice «distancia publicada» en las cuatro y «por corrimiento al rojo» en el resto");
}

console.log(`\n${passed} ok, ${failed} fallan`);
process.exit(failed ? 1 : 0);
