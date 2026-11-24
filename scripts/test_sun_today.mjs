// Pruebas de «El Sol hoy» (src/sun/sun.js + src/sun/i18n.js): formato, explicaciones y geometría. Node puro, sin red.
// Uso:  node scripts/test_sun_today.mjs     (sale con código 1 si algo falla)
//
// REFERENCIAS (consultadas el 16-nov-2026): SILSO https://www.sidc.be/SILSO/ · NOAA SWPC solar_regions.json,
// xray-flares-7-day.json, noaa-planetary-k-index.json, solar-cycle/*.json · NASA SDO https://sdo.gsfc.nasa.gov/.
// Escalas NOAA: https://www.swpc.noaa.gov/noaa-scales-explanation (R1 = M1, R2 = M5, R3 = X1, R4 = X10, R5 = X20;
// G1 = Kp 5 … G5 = Kp 9). Los valores de abajo están copiados de respuestas reales para no depender de la red.
import { readFileSync } from "node:fs";
import {
  EARTH_MSH, R_SUN_KM, R_EARTH_KM, earthsOf, fmtEarths, flareInfo, compareFlares, flareLevel, flareSummary, kpInfo,
  parseLocation, splitRegions, maxFlareProb, cyclePeak, monthToYear, dateToYear, pathOf, cycleGeometry, fmtUtc, fmtDay,
  fmtMonth, fmtNum, hasAnyData, LINKS, SUN_PATH, halphaOf, halphaIsOld,
} from "../src/sun/sun.js";
import { TS } from "../src/sun/i18n.js";
import { metricParams } from "../src/ui/track.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ─── 1 · «≈ N Tierras» ───────────────────────────────────────────────────────
console.log("Tamaño de las regiones: millonésimas del hemisferio → Tierras");
{
  // 1 MSH = 2π·R☉²·1e-6 km²; superficie de la Tierra = 4π·R⊕² km²
  const msh_km2 = 2 * Math.PI * R_SUN_KM ** 2 * 1e-6, earth_km2 = 4 * Math.PI * R_EARTH_KM ** 2;
  ok(near(msh_km2, 3.04e6, 0.01e6), "1 millonésima del hemisferio ≈ 3,04 millones de km²", String(msh_km2));
  ok(near(earth_km2, 510.1e6, 0.2e6), "superficie de la Tierra ≈ 510 millones de km²", String(earth_km2));
  ok(near(EARTH_MSH, earth_km2 / msh_km2, 1e-9), "EARTH_MSH = superficie de la Tierra / 1 MSH");
  ok(near(EARTH_MSH, 167.7, 0.2), "la Tierra entera ≈ 168 millonésimas (no 169)", String(EARTH_MSH));
  // el disco que tapa la Tierra (π·R⊕²) son solo ≈ 42 MSH: por eso se compara con la superficie entera
  ok(near(Math.PI * R_EARTH_KM ** 2 / msh_km2, 41.9, 0.2), "el círculo de la Tierra son ≈ 42 MSH (no es la base de la comparación)");
  ok(near(earthsOf(170), 1.01, 0.01), "AR 4579 (170 MSH) ≈ 1 Tierra", String(earthsOf(170)));
  ok(fmtEarths(170, "es") === "≈ 1,0", "170 MSH → «≈ 1,0» (es)", fmtEarths(170, "es"));
  ok(fmtEarths(170, "en") === "≈ 1.0", "170 MSH → «≈ 1.0» (en)", fmtEarths(170, "en"));
  ok(fmtEarths(20, "es") === "≈ 0,1", "20 MSH → «≈ 0,1»", fmtEarths(20, "es"));
  ok(fmtEarths(1000, "es") === "≈ 6,0", "1000 MSH → «≈ 6,0»", fmtEarths(1000, "es"));
  ok(fmtEarths(2500, "es") === "≈ 15", "2500 MSH → «≈ 15» (enteros desde 10)", fmtEarths(2500, "es"));
  ok(fmtEarths(null) === null && fmtEarths(undefined) === null && fmtEarths("x") === null && earthsOf(-3) === null, "sin dato → null (no se inventa)");
}

// ─── 2 · Fulguraciones ───────────────────────────────────────────────────────
console.log("Clases de fulguración");
{
  const f = flareInfo("m1.1");
  ok(f && f.letter === "M" && f.num === 1.1 && f.cls === "M1.1" && f.r === 1, "M1.1 → letra M, R1");
  ok(flareInfo("M5.0").r === 2 && flareInfo("M9.9").r === 2, "M5 y M9.9 → R2");
  ok(flareInfo("X1.0").r === 3 && flareInfo("X10").r === 4 && flareInfo("X25.3").r === 5, "X1 → R3, X10 → R4, X20+ → R5");
  ok(flareInfo("C8.0").r === null && flareInfo("B1.2").r === null, "A/B/C sin escala R");
  ok(flareInfo("") === null && flareInfo(null) === null && flareInfo("Z9") === null && flareInfo("C") === null && flareInfo("Cx") === null, "clases inválidas → null");
  const order = ["A1.0", "A9.9", "B1.0", "C9.9", "M1.0", "M5.0", "X1.0", "X9.0"];
  ok(order.every((c, i) => i === 0 || compareFlares(c, order[i - 1]) > 0), "orden A < B < C < M < X y por número");
  ok(compareFlares("M1.1", "C8.0") > 0 && compareFlares("C8.0", "M1.1") < 0 && compareFlares("C1.0", "C1.0") === 0, "M1.1 > C8.0");
  ok(flareLevel("B8.1") === "quiet" && flareLevel("C5.4") === "small" && flareLevel("M2.0") === "medium" && flareLevel("X1.0") === "big" && flareLevel("?") === null, "nivel para el texto");
  const sum = flareSummary([{ class: "B8.1" }, { class: "M1.1" }, { class: "C5.3" }, { class: "mala" }, { class: "X1.2" }]);
  ok(sum.total === 4 && sum.mx === 2 && sum.strongest.class === "X1.2", "resumen: total, M/X y la mayor (ignora clases inválidas)");
  ok(flareSummary(null) === null && flareSummary([]).total === 0, "sin lista → null; lista vacía → 0");
}

// ─── 3 · Kp ──────────────────────────────────────────────────────────────────
console.log("Índice Kp");
{
  ok(kpInfo(0.67).level === "quiet" && kpInfo(2.67).level === "quiet", "Kp < 3 → calma");
  ok(kpInfo(3).level === "active" && kpInfo(4.67).level === "active" && kpInfo(4.67).g === null, "Kp 3–4,67 → agitado, sin escala G");
  ok(kpInfo(5).level === "storm" && kpInfo(5).g === 1 && kpInfo(6.33).g === 2 && kpInfo(7).g === 3 && kpInfo(8.67).g === 4 && kpInfo(9).g === 5, "Kp ≥ 5 → tormenta, G1…G5");
  ok(kpInfo(-1) === null && kpInfo(10) === null && kpInfo("x") === null && kpInfo(null) === null && kpInfo(undefined) === null, "Kp fuera de 0–9 o no numérico → null");
}

// ─── 4 · Regiones ────────────────────────────────────────────────────────────
console.log("Regiones activas");
{
  const loc = parseLocation("S09W02");
  ok(loc && loc.ns === "S" && loc.lat === 9 && loc.ew === "W" && loc.lon === 2 && loc.limb === false, "S09W02 → 9° S, 2° O");
  ok(parseLocation("n15e45").lon === 45 && parseLocation("S09W90").limb === true && parseLocation("S08W95").limb === true, "borde del disco (≥ 75° del centro)");
  ok(parseLocation("") === null && parseLocation(null) === null && parseLocation("X1Y2") === null, "ubicación inválida → null");
  const regs = [
    { region: 4575, area: 20 }, { region: 4579, area: 170 }, { region: 4570, area: null }, { region: 4572, area: 0 },
    { region: 4574, area: 50 }, { region: 4573, area: 50 },
  ];
  const sp = splitRegions(regs);
  ok(sp.shown.map(r => r.region).join() === "4579,4573,4574,4575", "orden por tamaño y luego por número; solo con área medida", sp.shown.map(r => r.region).join());
  ok(sp.hidden === 2, "cuenta las que no tienen manchas medidas");
  ok(splitRegions(null) === null && splitRegions([]).shown.length === 0, "sin lista → null");
  const p = maxFlareProb([{ flare_prob: { c: 10, m: 1, x: 1 } }, { flare_prob: { c: 50, m: 10, x: 5 } }, {}]);
  ok(p.m === 10 && p.x === 5, "mayor probabilidad M y X");
  ok(maxFlareProb([]) === null && maxFlareProb([{ flare_prob: { c: null, m: null, x: null } }]) === null, "sin probabilidades → null");
}

// ─── 5 · Ciclo solar ─────────────────────────────────────────────────────────
console.log("Ciclo solar y su gráfica");
{
  const months = [
    { t: "2008-12", ssn: 0.8, smoothed: 2.2 }, { t: "2014-04", ssn: 111, smoothed: 116.4 },
    { t: "2019-12", ssn: 0.5, smoothed: 1.8 }, { t: "2024-05", ssn: 159.6, smoothed: 150 },
    { t: "2026-09", ssn: 60.3, smoothed: null }, { t: "2026-10", ssn: 45.7, smoothed: null },
  ];
  ok(cyclePeak(months).t === "2024-05" && cyclePeak(months).ssn === 159.6, "pico del ciclo 25 (desde 2019-12)");
  ok(cyclePeak(months, "2008-12", "2019-11").t === "2014-04", "pico del ciclo 24 (acotado con `to`)");
  ok(cyclePeak(null) === null && cyclePeak([]) === null, "sin meses → null");
  ok(near(monthToYear("2026-01"), 2026.0417, 1e-3) && Number.isNaN(monthToYear("x")), "mes → año decimal");
  ok(near(dateToYear("2026-11-16"), 2026.875, 0.003), "2026-11-16 → 2026,875 (coincide con SILSO)", String(dateToYear("2026-11-16")));
  ok(Number.isNaN(dateToYear("nada")), "fecha inválida → NaN");
  ok(pathOf([[1, 2], [3, 4], null, [5, 6]]) === "M1 2L3 4M5 6" && pathOf([null]) === "", "las líneas se cortan donde no hay dato");

  const predicted = [
    { t: "2026-05", ssn: 86.7, low: 77.6, high: 95.3 }, { t: "2026-10", ssn: 80, low: 70, high: 90 },
    { t: "2028-01", ssn: 60, low: 40, high: 80 }, { t: "2030-12", ssn: 8, low: 3, high: 13.5 },
  ];
  const g = cycleGeometry({ months, predicted }, dateToYear("2026-11-16"), 98);
  ok(g && g.x0 === 2008 && g.x1 === 2031, "eje X: de 2008 a 2031", `${g && g.x0}-${g && g.x1}`);
  ok(g.yMax >= 160 && g.yMax % 25 === 0, "eje Y redondea por encima del máximo", String(g.yMax));
  ok(g.today && g.today.x > g.left && g.today.x < g.w - g.right && g.today.y > g.top && g.today.y < g.h - g.bottom, "«hoy» cae dentro del área de la gráfica");
  ok(g.hasSmoothed && g.hasPredicted && g.band.endsWith("Z") && g.monthly.startsWith("M"), "trae línea mensual, suavizada, predicción y banda");
  ok(!/NaN|undefined/.test(JSON.stringify(g)), "ninguna coordenada es NaN");
  ok(g.smoothed.split("M").length - 1 === 1, "la suavizada es un solo tramo (los meses sin dato no se dibujan)");
  // la predicción solo se dibuja desde el último mes observado (2026-10): el punto 2026-05 se descarta
  const gPredOnly = cycleGeometry({ months, predicted: predicted.slice(0, 1) }, NaN, null);
  ok(gPredOnly.hasPredicted === false, "una predicción anterior al último mes observado no se dibuja");
  ok(cycleGeometry(null, 2026.8, 98) === null && cycleGeometry({ months: null, predicted: null }, 2026.8, 98) === null, "sin ciclo → null (sin gráfica)");
  ok(cycleGeometry({ months, predicted: null }, 2026.875, null).hasPredicted === false, "sin predicción: solo lo observado");
  ok(cycleGeometry({ months: null, predicted }, 2026.875, 98).hasPredicted === true, "sin observado: solo la predicción");
  ok(cycleGeometry({ months, predicted }, NaN, null).today === null, "sin fecha de hoy no se marca «hoy»");
}

// ─── 6 · Fechas y números ────────────────────────────────────────────────────
console.log("Fechas y números");
{
  ok(fmtUtc("2026-11-16T13:30:10Z", "es") === "16 nov 2026, 13:30 UTC", "hora UTC es", fmtUtc("2026-11-16T13:30:10Z", "es"));
  ok(fmtUtc("2026-11-16T09:00:00Z", "en") === "16 Nov 2026, 09:00 UTC", "hora UTC en");
  ok(fmtUtc(null) === null && fmtUtc("basura") === null, "hora inválida → null");
  ok(fmtDay("2026-11-16", "es") === "16 nov 2026" && fmtDay("2026-01-05", "en") === "5 Jan 2026" && fmtDay("x") === null, "día");
  ok(fmtMonth("2024-05", "es") === "may 2024" && fmtMonth("2024-05", "en") === "May 2024" && fmtMonth("") === null, "mes");
  ok(fmtNum(5.7, "es", 1) === "5,7" && fmtNum(5.7, "en", 1) === "5.7" && fmtNum(98, "es") === "98" && fmtNum("x") === null && fmtNum(null) === null, "números con la coma del idioma");
  ok(hasAnyData({ kp: { value: 1 } }) && !hasAnyData({ sunspot_number: null, regions: null }) && !hasAnyData(null) && !hasAnyData([]) && !hasAnyData("x"), "¿hay algo que mostrar?");
  ok(SUN_PATH === "/api/sun/today", "ruta del endpoint");
}

// ─── 7 · Textos ES/EN ────────────────────────────────────────────────────────
console.log("Textos");
{
  const shape = (o, path = "") => Object.entries(o).flatMap(([k, v]) =>
    typeof v === "function" ? [`${path}${k}()`] : v && typeof v === "object" ? shape(v, `${path}${k}.`) : [`${path}${k}`]).sort();
  const es = shape(TS.es), en = shape(TS.en);
  ok(es.join() === en.join(), "cada clave existe en ES y en EN", es.filter(k => !en.includes(k)).concat(en.filter(k => !es.includes(k))).join(","));
  const strings = (o) => Object.values(o).flatMap(v => typeof v === "string" ? [v] : v && typeof v === "object" ? strings(v) : []);
  ok(strings(TS.es).every(s => s.trim().length > 0) && strings(TS.en).every(s => s.trim().length > 0), "ningún texto vacío");
  for (const lang of ["es", "en"]) {
    const t = TS[lang];
    ok(/filtro solar certificado|certified solar filter/.test(t.warn) && /binoculares|binoculars/.test(t.warn) && /telescopio|telescope/.test(t.warn), `advertencia de seguridad completa (${lang})`);
    ok(/filtro solar certificado|certified solar filter/.test(t.cardWarn), `advertencia en la tarjeta (${lang})`);
    ok(/168/.test(t.regionsWhat), `la explicación de las regiones cita 168 (${lang})`);
    ok(["A", "B", "C", "M", "X"].every(l => t.flareWhat.includes(l)) && /10/.test(t.flareWhat), `explica las clases A/B/C/M/X y el factor 10 (${lang})`);
    ok(typeof t.sectionMissing("NOAA") === "string" && t.regionWhere("S", 9, "W", 2).includes("9°") && t.kpStorm(2).includes("G2"), `funciones de texto devuelven cadenas (${lang})`);
    ok(!/undefined|NaN|\[object/.test(JSON.stringify([t.spotsCompare(160, "may 2024"), t.flares7(5, 1), t.regionEarths("1,0"), t.cycleToday(98), t.cycleToday(null), t.imgTime("x"), t.cycleAlt("dic 2008", "dic 2030")])), `sin undefined/NaN en los textos (${lang})`);
  }
}

// ─── 8 · Fuentes, métrica y cableado ─────────────────────────────────────────
console.log("Fuentes enlazadas, métrica y cableado");
{
  ok(Object.values(LINKS).every(u => /^https:\/\//.test(u)), "todos los enlaces de fuente son https");
  ok(/sidc\.be\/SILSO/.test(LINKS.silso) && /swpc\.noaa\.gov/.test(LINKS.regions + LINKS.flares + LINKS.kp + LINKS.cycle) && /sdo\.gsfc\.nasa\.gov/.test(LINKS.sdo), "enlaza SILSO, NOAA SWPC y NASA SDO");
  const m = metricParams({ source: "sheet", lat: -0.04, kp: "5" });
  ok(m.source === "sheet" && !("lat" in m) && !("kp" in m), "track(sun_today): solo viaja `source` (nada del dato ni del lugar)", JSON.stringify(m));
  const metrics = readFileSync(new URL("../backend/app/metrics.py", import.meta.url), "utf8");
  ok(/"sun_today":\s*\{"source": \{"sheet", "now"\}\}/.test(metrics), "el servidor admite el evento sun_today con source sheet|now");
  const sheet = readFileSync(new URL("../src/sky/ObjectSheet.jsx", import.meta.url), "utf8");
  ok(/obj\.layer === "solar" && obj\.name === "Sol" && <SunToday/.test(sheet), "ObjectSheet muestra «El Sol hoy» solo para el Sol");
  const now = readFileSync(new URL("../src/now/Now.jsx", import.meta.url), "utf8");
  ok(/area="sun"/.test(now) && /SunSummary/.test(now) && /SunContent/.test(now), "Now.jsx tiene la tarjeta «El Sol hoy» que reutiliza el mismo componente");
  const comp = readFileSync(new URL("../src/sun/SunToday.jsx", import.meta.url), "utf8");
  ok(!/<img[^>]*crossOrigin/.test(comp) && /<img/.test(comp), "la imagen de SDO es un <img> normal (sin CORS)");
}

// ─── 9 · H-alfa (red GONG del NSO) ───────────────────────────────────────────
console.log("H-alfa (GONG)");
{
  // respuesta real del servidor (24-nov-2026, Cerro Tololo)
  const H = { url: "https://gong2.nso.edu/HA/hag/202611/20261124/20261124163742Ch.jpg",
    url_small: "https://gong2.nso.edu/HA/hav/202611/20261124/20261124163742Ch.jpg",
    time: "2026-11-24T16:37:42Z", site: "C", credit: "GONG/NSO/AURA/NSF", page: "https://nso.edu/data/nisp-data/h-alpha/" };
  ok(halphaOf({ halpha: H }) === H, "acepta la imagen de GONG de un sitio científico");
  ok(halphaOf({ halpha: { ...H, url: "https://evil.example/x.jpg" } }) === null, "otro host → no se pinta");
  ok(halphaOf({ halpha: { ...H, url_small: H.url_small.replace("Ch.jpg", "Zh.jpg") } }) === null, "sitio de prueba (Z) → no se pinta");
  ok(halphaOf({ halpha: null }) === null && halphaOf(null) === null && halphaOf({}) === null, "sin H-alfa → null");
  const t0 = Date.parse(H.time);
  ok(!halphaIsOld(H, t0 + 3600e3) && halphaIsOld(H, t0 + 4 * 3600e3) && !halphaIsOld({ time: null }, t0), "foto vieja: más de 3 h (sin hora no se acusa)");
  ok(/^https:\/\/nso\.edu\//.test(LINKS.gong), "enlaza la página H-alfa del NSO");
  for (const lang of ["es", "en"]) {
    const t = TS[lang];
    ok(["B", "C", "L", "M", "T", "U"].every(k => typeof t.haSites[k] === "string"), `nombre de los seis observatorios (${lang})`);
    ok(/656,3|656\.3/.test(t.haCaption) && /protuberancias|prominences/.test(t.haCaption) && /filamentos|filaments/.test(t.haCaption) && /fulguraci|flare/.test(t.haCaption), `el pie explica Hα, protuberancias, filamentos y fulguraciones (${lang})`);
    ok(/gris|grey/.test(t.haGray), `dice que la cámara registra en gris (${lang})`);
    ok(!/undefined|NaN/.test(t.haSite("x") + t.haTime("y")), `textos H-alfa sin undefined (${lang})`);
  }
  const comp = readFileSync(new URL("../src/sun/SunToday.jsx", import.meta.url), "utf8");
  ok(/GONG\/NSO\/AURA\/NSF/.test(comp) && /h\.credit/.test(comp), "el crédito GONG/NSO/AURA/NSF va junto a la imagen, con enlace");
  const css = readFileSync(new URL("../src/sun/sun.css", import.meta.url), "utf8");
  ok(/\.sun-img--ha\s*\{[^}]*border-radius:\s*14px/.test(css) && /\.sun-img--ha img\s*\{[^}]*transform:\s*none/.test(css), "H-alfa sin recorte redondo ni zoom: se ven las protuberancias");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
