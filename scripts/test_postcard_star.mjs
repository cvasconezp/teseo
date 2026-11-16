// Pruebas de la postal del Cielo (src/sky/postcard.js + postcardStar.js):
//  · la distancia y «su luz salió hace / su luz tarda / una señal tarda» van en UNA sola casilla ancha,
//    en todas las capas;
//  · la postal de una estrella con temperatura y clase coherentes (y la del Sol) dibuja «Su luz» y
//    «Su vida»; una estrella sin esos datos, no — igual que la ficha;
//  · versión sintética de la postal de estrella: visual centrado, subtítulo «tipo · clase · magnitud»,
//    SOLO la casilla de la distancia, ≤ 2 nombres de líneas, la masa en la fila del título del bloque,
//    la hora de salida o la altura en la línea del cielo local y la nota del esquema en el pie;
//  · nada se sale, se corta ni se solapa (report.overflow / report.truncated en false) y el texto es ≥ 24 px;
//  · «Desde tu ubicación» en minúscula dentro de la frase.
// La postal se dibuja de verdad (buildPostcard) sobre un lienzo simulado: cada método de dibujo es un
// no-op y measureText mide con un ancho por carácter algo mayor que el real (para ir sobre seguro).
// Uso:  node scripts/test_postcard_star.mjs     (sale con código 1 si algo falla)
import { readFileSync } from "node:fs";
import { SDO_LATEST, SDO_DISK, buildPostcard, postcardGrid, layoutGrid, distanceCell, starLocalLine, GRID, GRID_MAX, slotsOf, PC_W, PAD, SAFE_TOP, BLOCK_BOTTOM, HERO_TOP } from "../src/sky/postcard.js";
import { starBlocks, starSubtitle, spectrumLabels, layoutSpectrum, layoutLife, fateKey } from "../src/sky/postcardStar.js";
import { compositionPlan } from "../src/sky/composition.js";
import { lifePlan } from "../src/sky/starLife.js";
import { starTemperature, parseSpect } from "../src/sky/starColor.js";
import { describeObject } from "../src/sky/describe.js";
import { fmtDist, fmtYears, fmtKm, fmtDuration } from "../src/sky/format.js";
import { TX } from "../src/sky/i18n.js";
import { isObjectPicture } from "../src/sky/wiki.js";
import { remotePlan } from "../src/share/images.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const sky = JSON.parse(readFileSync(new URL("../public/sky.json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

// ── lienzo simulado ──
const pxOf = (font) => parseFloat((/(\d+(?:\.\d+)?)px/.exec(font || "") || [])[1] || 10);
const widthOf = (font, s) => [...String(s)].length * pxOf(font) * (/^(600|700)/.test(font || "") ? 0.56 : 0.52);
function mkCtx() {
  const grad = { addColorStop() {} };
  const target = {
    font: "10px sans-serif",
    measureText(s) { return { width: widthOf(this.font, s) }; },
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => grad,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createImageData: (w, h) => (typeof w === "object" ? { data: new Uint8ClampedArray(w.width * w.height * 4), width: w.width, height: w.height } : { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  };
  return new Proxy(target, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
}
globalThis.document = { createElement: () => { const c = { width: 0, height: 0, toBlob: (cb) => cb(null) }; const x = mkCtx(); x.canvas = c; c.getContext = () => x; return c; } };
globalThis.Image = class { set src(v) { setTimeout(() => this.onerror && this.onerror(), 0); } };

// textos de la ficha que viven en Constellations.jsx (JSX, no importable en Node): los que hacen falta
const TCX = {
  es: { fDistance: "Distancia", fLightLeft: "Su luz salió hace", fLightTakes: "Su luz tarda", fVoyager: "En la Voyager 1 tardarías", ago: (s) => s,
    fLightHint: "lo ves como era entonces", au: "UA", typeStar: "Estrella", typePlanet: "Planeta", typeSun: "Estrella", typeMoon: "Satélite",
    dDiameter: "Diámetro", timesEarth: (x) => `${x} × la Tierra`, dRotation: "Una vuelta sobre sí", retrograde: "al revés", dOrbitSun: "Una vuelta al Sol", dOrbitEarth: "Una vuelta a la Tierra",
    dPosition: "Posición en el cielo", dMagnitude: "Magnitud aparente", magHint: "menor es más brillante", dSource: "Fuente", dCatalog: "Catálogo", dHubble: "Tipo de Hubble",
    dMass: "Masa", dPeriod: "Período de giro", dKind: "Tipo", typeGalaxy: "Galaxia", inConst: (c) => `en ${c}`, typeProbe: "Nave", probeLine: () => "", fAgency: "Agencia", fLaunched: "Lanzamiento",
    fTarget: "Destino", targetName: {}, phaseName: {}, sigLine: () => "", sigBand: {}, sigTitle: "Señal", sigHint: "", dSunDist: "Distancia al Sol", dEpoch: "Época", srcHorizons: "NASA/JPL Horizons", horizonsNote: "",
    typeBlackHole: "Agujero negro", typeExoplanet: "Exoplaneta", orbits: (h) => `orbita ${h}`, capSunWarn: "No mires al Sol.", moonPhase: () => "" },
  en: { fDistance: "Distance", fLightLeft: "Its light left", fLightTakes: "Its light takes", fVoyager: "On Voyager 1 it would take", ago: (s) => `${s} ago`,
    fLightHint: "you see it as it was then", au: "AU", typeStar: "Star", typePlanet: "Planet", typeSun: "Star", typeMoon: "Satellite",
    dDiameter: "Diameter", timesEarth: (x) => `${x} × Earth`, dRotation: "One spin", retrograde: "backwards", dOrbitSun: "One orbit of the Sun", dOrbitEarth: "One orbit of Earth",
    dPosition: "Position in the sky", dMagnitude: "Apparent magnitude", magHint: "lower is brighter", dSource: "Source", dCatalog: "Catalogue", dHubble: "Hubble type",
    dMass: "Mass", dPeriod: "Spin period", dKind: "Kind", typeGalaxy: "Galaxy", inConst: (c) => `in ${c}`, typeProbe: "Spacecraft", probeLine: () => "", fAgency: "Agency", fLaunched: "Launch",
    fTarget: "Target", targetName: {}, phaseName: {}, sigLine: () => "", sigBand: {}, sigTitle: "Signal", sigHint: "", dSunDist: "Distance from the Sun", dEpoch: "Epoch", srcHorizons: "NASA/JPL Horizons", horizonsNote: "",
    typeBlackHole: "Black hole", typeExoplanet: "Exoplanet", orbits: (h) => `orbits ${h}`, capSunWarn: "Never look at the Sun.", moonPhase: () => "" },
};
const T = { es: { ...TX.es, ...TCX.es }, en: { ...TX.en, ...TCX.en } };
const FMT = (lang) => ({
  dist: (d) => fmtDist(d, lang), years: (y) => fmtYears(y, lang), km: (k) => fmtKm(k, lang), dur: (x) => fmtDuration(x, lang),
  when: () => (lang === "es" ? "16 nov 2026, 21:00" : "Nov 16, 2026, 9:00 PM"), time: (d) => d.toISOString().slice(11, 16),
});
const starObj = (name) => { const st = sky.stars.find((s) => s[7] === name); return { name: st[7], nx: st[1], ny: st[2], nz: st[3], dist_ly: st[6], mag: st[4], hex: st[5], bv: st[8], spect: st[9] || "", layer: "star" }; };
const LOCAL = { lat: 0.0389, lon: -78.1426, date: new Date("2026-11-17T02:00:00Z"), place: TX.es.pcMyPlace };
const OBJS = {
  betelgeuse: starObj("Betelgeuse"), sirius: starObj("Sirius"), vega: starObj("Vega"), rigel: starObj("Rigel"),
  sun: { layer: "solar", name: "Sol", nx: -0.6, ny: -0.7, nz: -0.3, dist_au: 0.9887, ra: 231, dec: -18.6 },
  jupiter: { layer: "solar", name: "Júpiter", nx: 0.3, ny: 0.9, nz: 0.3, dist_au: 4.4, mag: -2.7, body: "planet", ra: 110, dec: 22 },
  m42: { layer: "messier", name: "M42", cn: "Orion Nebula", type: "nebula", m: 42, ngc: "NGC1976", nx: 0.1, ny: 0.99, nz: -0.09, dist_ly: 1344, mag: 4, const_es: "Orión", const: "Orion" },
  m13: { layer: "messier", name: "M13", type: "globular", m: 13, nx: -0.36, ny: -0.6, nz: 0.6, dist_ly: 22200, mag: 5.8 },
  andromeda: { layer: "galaxies", name: "Andrómeda", cat: "M31", hubble: "SA(s)b", nx: 0.77, ny: 0.15, nz: 0.62, dist_ly: 2.5e6, mag: 3.4 },
  sgra: { layer: "blackholes", name: "Sgr A*", kind: "supermasivo", nx: -0.05, ny: -0.87, nz: -0.48, dist_ly: 26000, mass_sun: 4.3e6 },
  pulsar: { layer: "pulsars", name: "PSR B0531+21", nx: 0.1, ny: 0.99, nz: 0.38, dist_ly: 6500, period_ms: 33.4 },
  exo: { layer: "exoplanets", name: "Proxima Cen b", host: "Proxima Cen", nx: -0.1, ny: -0.5, nz: -0.86, dist_ly: 4.24, rade: 1.07, mass_e: 1.07, period_d: 11.2 },
  caldwell: { layer: "caldwell", name: "C80", c: 80, type: "globular", cn: "Omega Centauri", nx: -0.6, ny: -0.3, nz: -0.75, dist_ly: 17600, mag: 3.7, size: 36 },
  voyager: { layer: "probes", name: "Voyager 1", nx: 0.1, ny: -0.8, nz: 0.2, dist_km: 2.5e10, agency: "NASA", launched: 1977 },
  comet: { layer: "comets", name: "1P/Halley", nx: 0.2, ny: 0.4, nz: 0.9, dist_km: 5.2e9, approaching: false },
};

console.log("Una sola casilla de distancia (con la luz en su sub-línea) en todas las capas");
for (const lang of ["es", "en"]) {
  const t = T[lang], fmt = FMT(lang);
  for (const [k, o] of Object.entries(OBJS)) {
    for (const local of [null, { ...LOCAL, place: t.pcMyPlace }]) {
      const info = describeObject(o, lang, t, false);
      const g = postcardGrid({ obj: o, info, t, lang, local, fmt, star: starBlocks(o) });
      const labels = g.map((c) => c.label);
      const two = labels.includes(t.fLightLeft) || labels.includes(t.fLightTakes) || labels.includes(t.pcGSignal);
      const d = g.filter((c) => c.kind === "dist");
      const tag = `[${lang}] ${k}${local ? " + cielo local" : ""}`;
      ok(!two && d.length === 1 && g[0] === d[0] && d[0].wide && d[0].label === t.fDistance, `${tag}: una sola casilla «${t.fDistance}», primera y ancha`, JSON.stringify(labels));
      ok(slotsOf(g) <= GRID_MAX && g.length <= 5, `${tag}: no pasa de ${GRID_MAX} plazas`, JSON.stringify(labels));
      // el valor y la frase salen de lo que ya calcula la ficha
      const fd = info.facts.find((f) => f.label === t.fDistance);
      ok(d[0].value === fd.value, `${tag}: el valor es el de la ficha («${fd.value}»)`, d[0].value);
      if (o.dist_ly > 0) {
        const yrs = fmtYears(o.dist_ly, lang);
        ok(d[0].sub && d[0].sub.includes(yrs) && (lang === "es" ? /^Su luz salió hace .*(: l[ao] ves como era entonces|, antes de existir nuestra especie)$/ : /^Its light left .* ago(: you see it as it was then|, before our species existed)$/).test(d[0].sub), `${tag}: «${d[0].sub}»`);
        ok(info.facts.find((f) => f.label === t.fLightLeft).value.includes(yrs), `${tag}: los años son los mismos que «${t.fLightLeft}» de la ficha`);
      } else {
        const lt = info.facts.find((f) => f.label === t.fLightTakes).value;
        const re = o.layer === "probes" ? (lang === "es" ? /^una señal de radio tarda / : /^a radio signal takes /) : (lang === "es" ? /^su luz tarda / : /^its light takes /);
        ok(d[0].sub && d[0].sub.includes(lt) && re.test(d[0].sub), `${tag}: «${d[0].sub}»`);
      }
    }
  }
}
{
  const t = T.es, fmt = FMT("es");
  const cell = (o) => distanceCell(o, describeObject(o, "es", t, false), t, fmt);
  ok(/la ves como era entonces$/.test(cell(OBJS.betelgeuse).sub) && /la ves/.test(cell(OBJS.m42).sub) && /lo ves/.test(cell(OBJS.m13).sub) && /lo ves/.test(cell(OBJS.sgra).sub), "pronombre: «la ves» (estrella, nebulosa), «lo ves» (cúmulo, agujero negro)");
  ok(/^Su luz salió hace 2,5 millones de años, antes de existir nuestra especie$/.test(cell(OBJS.andromeda).sub), `años muy grandes (millones): «${cell(OBJS.andromeda).sub}»`);
  ok(/^Su luz salió hace 26 mil años: lo ves como era entonces$/.test(cell(OBJS.sgra).sub), `por debajo del millón de años, la frase normal: «${cell(OBJS.sgra).sub}»`);
  ok(/^Su luz salió hace 4 años: lo ves como era entonces$/.test(cell(OBJS.exo).sub), `objeto cercano: «${cell(OBJS.exo).sub}»`);
  ok(cell(OBJS.sun).value === fmtKm(0.9887 * 149597870.7, "es") && /^su luz tarda 8,\d minutos en llegar$/.test(cell(OBJS.sun).sub), `el Sol: «${cell(OBJS.sun).value} · ${cell(OBJS.sun).sub}»`);
  const nodist = { layer: "caldwell", name: "C31", c: 31, type: "nebula", nx: 0, ny: 0, nz: 1, mag: 6 };
  const cn = cell(nodist);
  ok(cn && cn.sub === null && cn.value === t.conNoDist, "sin distancia verificable: la casilla lo dice y no inventa la luz");
  // la casilla ancha ocupa su fila; los datos y el cielo local, de dos en dos
  const mf = (role, px) => (s) => s.length * px * (role === "value" ? 0.6 : 0.55);
  const cells = [cell(OBJS.m42), { label: "Magnitud aparente", value: "4", sub: "menor es más brillante", kind: "data" }, { label: "Catálogo", value: "M42 · NGC 1976", kind: "data" },
    { label: "En la Voyager 1 tardarías", value: "23 millones de años", kind: "data" }, { label: "Altura ahora", value: "40°", sub: "hacia el este", kind: "local" }];
  const lay = layoutGrid(mf, cells, { x: PAD, y: 0, w: PC_W - 2 * PAD });
  const rows = [...new Set(lay.cells.map((c) => c.y))].length;
  ok(lay.cells[0].w === PC_W - 2 * PAD && lay.cells[1].w < 500 && lay.cells[3].w === PC_W - 2 * PAD && lay.cells[4].w === PC_W - 2 * PAD && rows === 4, "ancha arriba; un dato que queda solo ocupa su fila (no se mezcla con el cielo local)", JSON.stringify(lay.cells.map((c) => [c.label, c.w])));
  const lay3 = layoutGrid(mf, [cells[0], cells[1], cells[2], cells[4]], { x: PAD, y: 0, w: PC_W - 2 * PAD, cols: 3 });
  ok(lay3.cells.length === 4 && lay3.cells.slice(1).every((c) => Math.abs(c.w - (PC_W - 2 * PAD - 2 * GRID.gap) / 3) < 1e-6) && !lay3.truncated, "estrella: la distancia ancha y 3 casillas en una fila");
}

console.log("Qué estrellas llevan espectro y vida (como la ficha)");
{
  const same = (o) => {
    const b = starBlocks(o), plan = compositionPlan(o, o.layer === "star" ? starTemperature(o.bv) : null), lp = lifePlan(o, o.layer === "star" ? parseSpect(o.spect) : null);
    return !!b.spectrum === !!(plan && plan.temp != null) && !!b.life === !!(lp && lp.path && lp.path.length) && (!b.spectrum || b.spectrum.temp === plan.temp);
  };
  let all = true, bad = "";
  for (const s of sky.stars.filter((s) => s[7]).slice(0, 400)) { const o = starObj(s[7]); if (!same(o)) { all = false; bad = s[7]; break; } }
  ok(all, "en 400 estrellas con nombre, el espectro y la vida se deciden exactamente como en la ficha (compositionPlan / lifePlan)", bad);
  const b = starBlocks(OBJS.betelgeuse);
  ok(b.spectrum && b.spectrum.letter === "M" && b.life && b.life.path.join() === "ms,supergiant,sn,ns" && b.life.here === 1, "Betelgeuse: espectro tipo M y camino supergigante → supernova → estrella de neutrones (HOY: supergigante)");
  const sun = starBlocks(OBJS.sun);
  ok(sun.spectrum.isSun && sun.spectrum.temp === 5772 && sun.life.kind === "sun" && sun.life.here === 0 && fateKey(sun.life) === "sun", "el Sol: espectro con Fraunhofer a 5.772 K y vida con HOY en la secuencia principal");
  ok(starBlocks(OBJS.jupiter) === null && starBlocks(OBJS.m42) === null, "un planeta o una nebulosa no llevan estos bloques");
  const bare = { ...OBJS.vega, bv: null, spect: "" };
  ok(!starBlocks(bare).spectrum && !starBlocks(bare).life, "estrella sin B−V ni tipo espectral: ni espectro ni vida");
  const mism = { ...OBJS.vega, spect: "M1" };       // tipo que no cuadra con su color
  ok(!starBlocks(mism).spectrum, "clase incoherente con el color: sin espectro (la ficha tampoco lo dibuja)");
  // rótulos de líneas: como mucho 2, los más propios de la clase
  const lb = (o) => spectrumLabels(starBlocks(o).spectrum, T.es).map((l) => l.text);
  ok(lb(OBJS.betelgeuse).join() === "Na,TiO", `M: ${lb(OBJS.betelgeuse).join(", ")}`);
  ok(lb(OBJS.vega).join() === "Hβ,Hα", `A (Balmer fuerte): ${lb(OBJS.vega).join(", ")}`);
  ok(lb(OBJS.rigel).includes("Hα") && lb(OBJS.rigel).includes("He I") && lb(OBJS.rigel).length === 2, `B: ${lb(OBJS.rigel).join(", ")}`);
  ok(lb(OBJS.sun).join() === "Na (D),Hα (C)", `Sol (Fraunhofer): ${lb(OBJS.sun).join(", ")}`);
  // medidas puras: nada sale del bloque ni se corta
  const mAt = (font) => (px) => (s) => widthOf(font(px), s);
  for (const [k, o] of [["betelgeuse", OBJS.betelgeuse], ["sirius", OBJS.sirius], ["vega", OBJS.vega], ["rigel", OBJS.rigel], ["sun", OBJS.sun]]) {
    for (const lang of ["es", "en"]) {
      const sb = starBlocks(o), w = PC_W - 2 * PAD;
      const sp = layoutSpectrum(mAt, sb.spectrum, T[lang], lang, { w }), lf = layoutLife(mAt, sb.life, T[lang], lang, { w });
      // nombres y marcas del eje dentro del ancho y sin pisarse entre sí
      const row = [...sp.labels, ...sp.ticks].sort((a, b) => a.tx - b.tx);
      const inSp = row.every((l, i) => l.tx >= -1e-6 && l.tx + l.w <= w + 1e-6 && (i === 0 || row[i - 1].tx + row[i - 1].w + 16 <= l.tx + 1e-6)) && sp.labels.length >= 1 && sp.labels.length <= 2;
      const seg = w / lf.nodes.length;
      const inLf = lf.nodes.every((nd, i) => Math.abs(nd.x - seg * (i + 0.5)) < 1e-6 && nd.label.lines.every((ln) => widthOf(`600 ${nd.label.size}px x`, ln) <= seg - 12 + 1e-6));
      // la cabecera del bloque: título y dato en una fila (si cabe), sin pisarse
      const headOk = [sp.head, lf.head].every((h) => !h.sub || !h.inline || h.subX > widthOf(`600 ${h.title.size}px x`, h.title.lines[0]));
      ok(!sp.truncated && !lf.truncated && inSp && inLf && headOk, `[${lang}] ${k}: «Su luz» (${sp.labels.map((l) => l.text).join(", ")}; ${Math.round(sp.h)} px) y «Su vida» (${lf.nodes.length} etapas; ${Math.round(lf.h)} px) sin cortes ni solapes`);
    }
  }
}

console.log("La postal dibujada (lienzo simulado)");
const shots = [];
for (const lang of ["es", "en"]) {
  const t = T[lang], fmt = FMT(lang);
  for (const [k, o] of Object.entries(OBJS)) {
    for (const local of [null, { ...LOCAL, place: t.pcMyPlace }]) {
      const info = describeObject(o, lang, t, false);
      const { report: r } = await buildPostcard({ lang, t, fmt, sky, conDirs: [], bodies: [], obj: o, info, wiki: null, credit: null, local, showSolar: false });
      shots.push({ lang, k, local: !!local, r, o });
    }
  }
}
for (const { lang, k, local, r, o } of shots) {
  const tag = `[${lang}] ${k}${local ? " + cielo local" : ""}`;
  const d = r.grid.filter((c) => c.kind === "dist");
  const t = T[lang];
  ok(!r.overflow && !r.truncated && r.safeZoneOk && r.minSize >= 24, `${tag}: sin desbordes ni recortes, zonas seguras y texto ≥ 24 px`, JSON.stringify({ overflow: r.overflow, truncated: r.truncated, safe: r.safeZoneOk, min: r.minSize, layout: r.starLayout, bottom: r.blockBottom }));
  // ningún par de líneas de texto se pisa (cajas de texto: ancho medido × tamaño de letra)
  const L = r.lines, clash = [];
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j];
    if (a.x < b.right - 1 && b.x < a.right - 1 && a.y < b.y + b.size - 1 && b.y < a.y + a.size - 1) clash.push(`${a.text} / ${b.text}`);
  }
  ok(!clash.length, `${tag}: ninguna línea de texto pisa otra`, clash.slice(0, 3).join(" | "));
  ok(d.length === 1 && d[0].wide && d[0].w === PC_W - 2 * PAD && !r.grid.some((c) => c.label === t.fLightLeft || c.label === t.fLightTakes), `${tag}: una sola casilla de distancia, ancha («${d[0] && d[0].value}» · «${d[0] && d[0].sub}»)`);
  const star = o.layer === "star" || o.name === "Sol";
  if (star) {
    const sp = r.lines.filter((l) => l.role === "spectrum"), lf = r.lines.filter((l) => l.role === "life");
    ok(r.starMode && r.spectrum && r.life && sp.some((l) => l.text === t.pcSpecTitle) && lf.some((l) => l.text === t.pcLifeTitle) && lf.some((l) => l.text === t.pcLifeNow), `${tag}: dibuja «${t.pcSpecTitle}» y «${t.pcLifeTitle}» con «${t.pcLifeNow}»`, JSON.stringify({ sm: r.starMode, s: !!r.spectrum, l: !!r.life }));
    const g = r.grid[0];
    ok(r.grid.length === 1 && g.kind === "dist" && r.spectrum.y >= g.y + g.h && r.life.y >= r.spectrum.y + r.spectrum.h && r.blockTop >= SAFE_TOP && r.blockBottom <= BLOCK_BOTTOM + 2, `${tag}: solo la casilla de distancia, luego «Su luz» y «Su vida», en orden y sin solaparse (visual: ${r.starLayout.hero ? "sí" : "no"})`);
    ok(r.spectrum.labels.length >= 1 && r.spectrum.labels.length <= 2 && sp.some((l) => /nm/.test(l.text)) && !sp.some((l) => /NIST|Esquema|sketch/i.test(l.text)), `${tag}: ${r.spectrum.labels.length} líneas rotuladas (${r.spectrum.labels.join(", ")}), el pico en nm y la nota del esquema fuera del bloque`);
    // el subtítulo: tipo · clase · magnitud (lo que antes era la fila de 3 casillas)
    const type = r.lines.filter((l) => l.role === "type").map((l) => l.text).join(" ");
    ok(type === starSubtitle(o, describeObject(o, lang, t, false), t, lang) && (o.layer !== "star" || type.includes(lang === "es" ? "magnitud" : "magnitude")), `${tag}: subtítulo «${type}»`);
    // visual centrado, como en las demás capas
    if (r.starLayout.hero) ok(Math.abs(r.heroBox.x + r.heroBox.w / 2 - PC_W / 2) <= 1 && r.heroBox.y >= HERO_TOP - 1 && r.heroBox.y + r.heroBox.h < r.blockTop, `${tag}: visual centrado (${Math.round(r.heroBox.w)} × ${Math.round(r.heroBox.h)} px) y por encima del texto`);
  } else ok(!r.starMode && !r.spectrum && !r.life && !r.lines.some((l) => l.role === "spectrum" || l.role === "life"), `${tag}: sin bloques de espectro ni de vida`);
}
{
  const t = T.es, fmt = FMT("es");
  const bare = { ...OBJS.vega, name: "HIP 1", bv: null, spect: "" };
  const { report: r } = await buildPostcard({ lang: "es", t, fmt, sky, conDirs: [], bodies: [], obj: bare, info: describeObject(bare, "es", t, false), local: null });
  ok(!r.starMode && !r.spectrum && !r.life && !r.lines.some((l) => l.role === "spectrum" || l.role === "life") && !r.overflow && !r.truncated, "estrella sin datos: la postal no dibuja espectro ni vida");
  const mism = { ...OBJS.vega, spect: "M1" };
  const { report: r2 } = await buildPostcard({ lang: "es", t, fmt, sky, conDirs: [], bodies: [], obj: mism, info: describeObject(mism, "es", t, false), local: null });
  ok(!r2.spectrum && !r2.lines.some((l) => l.role === "spectrum"), "clase incoherente: sin espectro en la postal");
  const credit = (r) => r.lines.filter((l) => l.role === "credit").map((l) => l.text).join(" ");
  const bet = shots.find((s) => s.k === "betelgeuse" && s.lang === "es" && s.local).r;
  const vega = shots.find((s) => s.k === "vega" && s.lang === "es" && !s.local).r;
  ok(bet.life.path.join() === "ms,supergiant,sn,ns" && bet.life.here === 1 && bet.lines.some((l) => l.role === "life" && /^masa ≈ 14–19 M☉, publicada$/.test(l.text)) && /masa:\sNeuhäuser\set\sal\.\s2022/.test(credit(bet)), `Betelgeuse: HOY en «Supergigante», la masa en la fila de «${T.es.pcLifeTitle}» y su referencia en el pie`);
  ok(/espectro: esquema, no medición/.test(credit(bet)) && /3\.800/.test(credit(bet)) && /Pavlenko/.test(credit(bet)) && !/Pavlenko/.test(credit(vega)), `la nota del esquema pasa al pie, abreviada («${credit(bet)}»)`);
  ok(bet.lines.filter((l) => l.role === "credit").length <= 3 && bet.lines.filter((l) => l.role === "credit").every((l) => l.size >= 20), "crédito del pie: ≤ 3 líneas de ≥ 20 px");
  ok(vega.life.massKind === "estimated" && vega.lines.some((l) => l.role === "life" && /estimada por su tipo/.test(l.text)), "Vega: masa estimada por su tipo, rotulada");
  ok(!/Pecaut/.test(credit(bet)) && /Pecaut y Mamajek 2013/.test(credit(vega)) && /NIST/.test(credit(bet)) && /OpenStax/.test(credit(vega)), `crédito: solo las fuentes de lo dibujado («${credit(vega)}»)`);
  const sir = shots.find((s) => s.k === "sirius" && s.lang === "es" && !s.local).r;
  ok(sir.life.assumed && sir.lines.some((l) => l.role === "life" && /Etapa deducida de su brillo/.test(l.text)), "Sirio: etapa supuesta, con su rótulo de incertidumbre");
  const sunR = shots.find((s) => s.k === "sun" && s.lang === "es" && s.local).r;
  ok(sunR.spectrum.sun && sunR.spectrum.zone === "visible" && sunR.lines.some((l) => l.role === "spectrum" && /502 nm/.test(l.text)), "el Sol: pico de Wien en 502 nm, dentro del visible");
  const where = sunR.lines.filter((l) => l.role === "local").map((l) => l.text).join(" ");
  ok(/^Desde tu ubicación · .* · (a \d+° de altura, al (norte|noreste|este|sureste|sur|suroeste|oeste|noroeste)|sale (mañana )?a las \d\d:\d\d)$/.test(where) && sunR.lines.filter((l) => l.role === "local").length === 1, `cielo local, en una línea: «${where}»`);
  // bajo el horizonte: cuándo sale (la misma hora que la ficha, de visibilityOf)
  const betWhere = bet.lines.filter((l) => l.role === "local").map((l) => l.text).join(" ");
  ok(/^Desde tu ubicación · .* · (sale (mañana )?a las \d\d:\d\d|a \d+° de altura, al \S+|hoy no sale|bajo el horizonte)$/.test(betWhere), `Betelgeuse, cielo local: «${betWhere}»`);
  const fmt2 = FMT("es");
  const at = (h) => ({ ...LOCAL, date: new Date(`2026-11-17T${h}:00Z`) });
  const lines = ["12:00", "18:00", "02:00"].map((h) => starLocalLine(OBJS.betelgeuse, at(h), T.es, "es", fmt2));
  ok(lines.some((l) => /sale (mañana )?a las \d\d:\d\d$/.test(l)) && lines.some((l) => /a \d+° de altura, al /.test(l)), `la línea del cielo local da la salida o la altura: ${lines.map((l) => `«${l.split(" · ").pop()}»`).join(", ")}`);
  ok(starLocalLine(OBJS.betelgeuse, null, T.es, "es", fmt2) === null, "sin lugar: no hay línea de cielo local");
}

console.log("Subtítulo de la postal de estrella (tipo · clase · magnitud, de lo que ya tiene la ficha)");
{
  const sub = (k, lang) => starSubtitle(OBJS[k], describeObject(OBJS[k], lang, T[lang], false), T[lang], lang);
  ok(sub("betelgeuse", "es") === "Supergigante roja · M2Ib · magnitud 0,45", `Betelgeuse: «${sub("betelgeuse", "es")}»`);
  ok(sub("betelgeuse", "en") === "Red supergiant · M2Ib · magnitude 0.45", `Betelgeuse (en): «${sub("betelgeuse", "en")}»`);
  ok(/^Supergigante azul · B8Ia · magnitud 0,1\d$/.test(sub("rigel", "es")), `Rigel: «${sub("rigel", "es")}»`);
  ok(/^Estrella blanca · A0m · magnitud /.test(sub("sirius", "es")), `Sirio (etapa deducida: no se afirma la clase): «${sub("sirius", "es")}»`);
  ok(/^Enana amarilla · G2\u00a0V/.test(sub("sun", "es")) && /^Yellow dwarf · G2\u00a0V/.test(sub("sun", "en")), `el Sol: «${sub("sun", "es")}»`);
  const bare = { ...OBJS.vega, bv: null, spect: "" };
  ok(starSubtitle(bare, describeObject(bare, "es", T.es, false), T.es, "es") === "Estrella · magnitud 0,03", "sin tipo espectral: el tipo de la ficha y la magnitud, nada inventado");
}

console.log("Estrella sin espectro (como la ficha): el visual crece");
{
  const t = T.es, fmt = FMT("es");
  const dub = starObj("Dubhe");
  ok(!starBlocks(dub).spectrum && starBlocks(dub).life, "Dubhe: sin espectro (clase incoherente con su color) pero con vida");
  const { report: rd } = await buildPostcard({ lang: "es", t, fmt, sky, conDirs: [], bodies: [], obj: dub, info: describeObject(dub, "es", t, false), local: { ...LOCAL } });
  const rb = shots.find((s) => s.k === "betelgeuse" && s.lang === "es" && s.local).r;
  ok(rd.starMode && !rd.spectrum && rd.life && !rd.lines.some((l) => l.role === "spectrum" || l.role === "spectrum-axis") && !rd.overflow && !rd.truncated, "sin bloque «Su luz»: no se dibuja nada de él");
  ok(rd.starLayout.hero && rd.starLayout.heroMaxH > rb.starLayout.heroMaxH + 100, `el visual usa ese espacio (${rd.starLayout.heroMaxH} px frente a ${rb.starLayout.heroMaxH} px)`);
}

console.log("Con una foto de Wikipedia (rótulo largo, en dos líneas) el visual no se pierde");
{
  const realImage = globalThis.Image;
  globalThis.Image = class { constructor() { this.naturalWidth = 640; this.naturalHeight = 480; } set src(v) { setTimeout(() => this.onload && this.onload(), 0); } };
  const credit = { artist: "Orion_constellation_map.png : Torsten Bronger derivative work: Kxx…", license: "CC BY-SA 3.0" };
  for (const [k, o] of [["sirius", OBJS.sirius], ["betelgeuse", OBJS.betelgeuse], ["vega", OBJS.vega]]) {
    for (const lang of ["es", "en"]) {
      const t = T[lang];
      const { report: r } = await buildPostcard({ lang, t, fmt: FMT(lang), sky, conDirs: [], bodies: [], obj: o, info: describeObject(o, lang, t, false), wiki: { thumb: "x" }, credit, local: { ...LOCAL, place: t.pcMyPlace } });
      const cap = r.lines.filter((l) => l.role === "caption");
      ok(r.hero === "photo" && r.starLayout.hero && cap.length >= 1 && !r.overflow && !r.truncated && Math.abs(r.heroBox.x + r.heroBox.w / 2 - PC_W / 2) <= 1 && cap[cap.length - 1].y + cap[cap.length - 1].size < r.blockTop,
        `[${lang}] ${k} + cielo local: foto centrada (${r.heroBox && Math.round(r.heroBox.h)} px de alto) con su rótulo en ${cap.length} línea(s), sin desbordes`, JSON.stringify(r.starLayout));
    }
  }
  globalThis.Image = realImage;
}

console.log("«Desde tu ubicación» en minúscula");
{
  ok(TX.es.pcMyPlace === "tu ubicación" && TX.en.pcMyPlace === "your location" && TX.es.pcWhere(TX.es.pcMyPlace, "x") === "Desde tu ubicación · x" && TX.en.pcWhere(TX.en.pcMyPlace, "x") === "From your location · x", "es: «Desde tu ubicación» · en: «From your location»");
  const c = src("../src/Constellations.jsx");
  ok(/placeKind === "me" \? TC\[lang\]\.pcMyPlace : placeKind === "custom" \? TC\[lang\]\.pcCustomPlace/.test(c), "la postal recibe el lugar en minúscula (no el rótulo del botón)");
  for (const k of ["pcLightAgo", "pcLightTakes", "pcSignalTakes", "pcSpecTitle", "pcSpecPeak", "pcStarKind", "pcLocalStar", "pcLsUp", "pcLsRise", "pcLsNever", "pcLsDown", "pcLifeTitle", "pcLifeNow", "pcLifeMass", "pcLifeMassEst", "pcLifeAssumed", "pcFate", "pcCreditStar", "pcMyPlace", "pcCustomPlace"]) ok(TX.es[k] && TX.en[k], `texto «${k}» en es y en`);
  ok(Object.keys(TX.es.pcFate).join() === Object.keys(TX.en.pcFate).join(), "frases del final: mismas claves en es y en");
}

console.log("\nimagen del Sol (SDO) y descarte de mapas de Wikipedia");
ok(remotePlan(SDO_LATEST).mode === "proxy", "la foto de hoy de SDO pasa por el intermediario /api/img");
ok(/HMIIF\.jpg$/.test(SDO_LATEST), "se usa HMI en luz continua (donde se ven las manchas)");
ok(SDO_DISK > 0.85 && SDO_DISK <= 1, "el recorte circular del disco es plausible");
for (const f of ["Canis_major_constellation_map.png", "Lyra_constellation_map.svg", "Position_Alpha_Cma.png", "Location_of_Vega.png".replace("Location", "Sky_map")])
  ok(!isObjectPicture(f), `descarta ${f}`);
for (const f of ["Sirius_A_and_B_Hubble_photo.jpg", "Betelgeuse_captured_by_ALMA.jpg", "Vega_Spitzer.jpg"])
  ok(isObjectPicture(f), `acepta ${f}`);
ok(!isObjectPicture(null), "sin archivo no hay foto");

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
