// Pruebas de «Compartir» en la pestaña Ahora (src/share/eventText.js, src/share/card.js, src/share/images.js).
// Node puro, sin red ni DOM: textos y cuadrícula por tipo, sin desbordes (fitLines con una medida
// conservadora), rótulo honesto del visual, Killa Ñan en cabecera/pie/texto, URL del proxy solo para los
// hosts de la lista y métrica con la misma lista blanca que el servidor.
// Uso:  node scripts/test_now_share.mjs     (sale con código 1 si algo falla)
import { readFileSync } from "node:fs";
import { buildSkyEvents, QUITO } from "../src/now/calendar/events.js";
import { eventCardText, TE, NOW_SHARE_KINDS, utcOffsetLabel, untilCell, cardFmt, placeInfo, firstSentences, cardFileName, issTrackDirs } from "../src/share/eventText.js";
import { layoutText, fitCard } from "../src/share/card.js";
import { proxyUrl, remotePlan, httpsHost, PROXY_HOSTS, CORS_HOSTS } from "../src/share/images.js";
import { NOW_SHARE_KINDS as TRACK_KINDS, NOW_SHARE_EVENT, cleanParams } from "../src/ui/track.js";
import { PC_W } from "../src/sky/postcard.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const showers = JSON.parse(readFileSync(new URL("../public/meteorshowers.json", import.meta.url))).objects;
const NOW = Date.parse("2026-11-16T15:00:00Z");
const QUITO_PLACE = { ...QUITO, kind: "preset", name: "Quito", isDefault: true };
const ME = { lat: -2.1894, lon: -79.8891, elev: 4, kind: "me", name: null };
const MAXW = PC_W - 2 * 64;
const HONEST = /^(Foto:|Photo:|Representación|Teseo representation|Teseo schematic|Simulación con datos|Simulation with|Ilustración artística|Artist's illustration|Imagen generada|Computer-generated)/;
// medida conservadora (más ancha que Inter/Cormorant reales): 0,6 × tamaño por carácter
const measureAt = () => (px) => (s) => String(s).length * px * 0.6;

// ─── eventos reales del calendario (Quito, 2 años) + los que llegan de la red ─────────────────────
const evs = buildSkyEvents({ from: NOW, days: 800, lat: QUITO.lat, lon: QUITO.lon, showers });
const pick = (type, sub, extra = () => true) => evs.find((e) => e.type === type && (!sub || e.sub === sub) && extra(e));
const ISS_TRACK = Array.from({ length: 31 }, (_, i) => ({ t: new Date(Date.parse("2026-11-25T15:38:53Z") + i * 10000).toISOString(), alt: 10 + 70 * Math.sin(Math.PI * i / 30), az: 218 + i * 5, lit: true }));
const issEv = (visible) => ({ id: "iss-x", type: "iss", sub: "pass", t: Date.parse("2026-11-25T15:38:53Z"), visible, durationMin: 6,
  data: { maxAlt: 79.7, maxT: Date.parse("2026-11-25T15:41:40Z"), from: { compass_es: "SO", compass: "SW" }, to: { compass_es: "NNE", compass: "NNE" }, durationS: 345, mag: visible ? -3.1 : null, track: ISS_TRACK, why: visible ? null : "sun_up" } });
const LAUNCH = { id: "a", name: "Long March 2F/G | Shenzhou 24", net: "2026-11-25T08:30:00Z", net_precision: "Minute", status: "Go", status_name: "Go for Launch", provider: "China Aerospace Science and Technology Corporation", rocket: "Long March 2F/G", pad: "Launch Area 4 (SLS-1 / 921)", location: "Jiuquan Satellite Launch Center, People's Republic of China", orbit: "Low Earth Orbit", image: "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/long_march_2f_image.jpg", image_credit: "CMSA" };
const SUN = { sunspot_number: { value: 101, date: "2026-11-16", provisional: true }, regions: [{ region: 4579, area: 180 }, { region: 4574, area: 50 }, { region: null, area: null }], strongest_flare_24h: { class: "C5.4", peak_time: "2026-11-16T06:58:00Z" }, flares_7d: [{ class: "C5.4" }], kp: { value: 1.33, time: "2026-11-16T12:00:00Z" }, image: { url: "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIF.jpg", credit: "NASA/SDO y equipo científico HMI", time: "2026-11-16T15:10:09Z" } };
const ROCK = { name: "2026 VJ13", date: "2026-11-17T05:34:48Z", dist_ld: 3.504, dist_km: 1347099, v_rel_km_s: 10.43, h: 27.242, diameter_m: null, diameter_est_m: [9.5, 21.2] };
const CRAFT = { name: "ESCAPADE Blue", phase: "cruise", agency: "NASA", launched: 2025, dist_au: 0.0177, earth_dist_km: 2650000, sun_dist_au: 0.99, nx: 0.3, ny: 0.8, nz: 0.52 };
const MMX = { name: "MMX", phase: "cruise", agency: "JAXA", launched: 2026, earth_dist_km: 7480000, sun_dist_au: 1.0 };

const SPECS = [
  ["Luna llena", { kind: "moon", ev: pick("moon", "full") }],
  ["Luna nueva", { kind: "moon", ev: pick("moon", "new") }],
  ["eclipse de Luna total", { kind: "eclipse", ev: pick("eclipse", "moon", (e) => e.data.type === "total") }],
  ["eclipse de Luna parcial", { kind: "eclipse", ev: pick("eclipse", "moon", (e) => e.data.type === "partial") }],
  ["eclipse de Sol", { kind: "eclipse", ev: pick("eclipse", "sun") }],
  ["lluvia de meteoros", { kind: "meteor", ev: pick("meteor") }],
  ["oposición", { kind: "planet", ev: pick("planet", "opposition") }],
  ["elongación", { kind: "planet", ev: pick("planet", "elongation") }],
  ["Luna y planeta", { kind: "planet", ev: pick("planet", "moonConj") }],
  ["dos planetas", { kind: "planet", ev: pick("planet", "planetConj") }],
  ["solsticio", { kind: "season", ev: pick("season", "decSolstice") }],
  ["equinoccio", { kind: "season", ev: pick("season", "marEquinox") }],
  ["ISS visible", { kind: "iss", ev: issEv(true) }],
  ["ISS no visible", { kind: "iss", ev: issEv(false) }],
  ["lanzamiento", { kind: "launch", launch: LAUNCH }],
  ["Sol de hoy", { kind: "sun", sun: SUN }],
  ["asteroide", { kind: "asteroid", rock: ROCK }],
  ["nave a Marte (con imagen NASA)", { kind: "mars", craft: CRAFT }],
  ["nave a Marte (sin imagen)", { kind: "mars", craft: MMX }],
];

console.log("Textos y cuadrícula por tipo (ES y EN)");
for (const [name, spec] of SPECS) {
  if (!spec.ev && ["moon", "eclipse", "meteor", "planet", "season"].includes(spec.kind)) { ok(false, `${name}: hay un evento real en 800 días`); continue; }
  for (const lang of ["es", "en"]) {
    const c = eventCardText(spec, lang, QUITO_PLACE, NOW);
    const all = [c.title, c.type, c.curio, c.credit, c.visual && c.visual.label, ...c.grid.flatMap((g) => [g.label, g.value, g.sub])].filter(Boolean).join(" | ");
    ok(!!c.title && !!c.type && c.grid.length >= 4 && c.grid.length <= 6, `${name} [${lang}]: título, tipo y 4–6 casillas`, `(${c.grid.length})`);
    ok(!/undefined|NaN|null|\[object/.test(all), `${name} [${lang}]: sin undefined/NaN`, all.slice(0, 200));
    ok(c.visual && HONEST.test(c.visual.label), `${name} [${lang}]: rótulo honesto del visual`, c.visual && c.visual.label);
    if (c.visual && c.visual.labelFallback) ok(HONEST.test(c.visual.labelFallback) && /^(Representación|Teseo)/.test(c.visual.labelFallback), `${name} [${lang}]: rótulo de la representación de respaldo`);
    ok(/^(Datos|Data): /.test(c.credit), `${name} [${lang}]: crédito de los datos`);
    ok(c.grid.every((g) => g.value.length <= 80 && g.label.length <= 40), `${name} [${lang}]: casillas cortas`);
    // sin desbordes: todas las líneas medidas caben (con recorte de casillas si hace falta) y nada se trunca
    const skyHero = !!(c.sky && c.sky.skyHero);
    const { L, plan } = fitCard(measureAt, c, { capLabel: c.visual.label, skyHero, hasHero: !skyHero });
    const lines = [L.title, L.type, ...L.facts, L.cap].filter(Boolean).flatMap((f) => f.lines.map((ln) => ({ ln, size: f.size })));
    const wide = lines.filter(({ ln, size }) => measureAt()(size)(ln) > MAXW + 0.5);
    const cellWide = L.grid.cells.filter((cell) => [cell.label, cell.value, cell.sub].filter(Boolean).some((f) => f.lines.some((ln) => measureAt()(f.size)(ln) > cell.inner + 0.5)));
    ok(!wide.length && !cellWide.length && !L.truncated, `${name} [${lang}]: sin desbordes ni texto cortado (fitLines)`, JSON.stringify(wide.concat(cellWide.map((x) => x.label))).slice(0, 200));
    ok(plan.fits && L.grid.cells.length >= 4, `${name} [${lang}]: cabe en 1080 × 1920 con ≥ 4 casillas`, `${L.grid.cells.length}`);
    ok(L.grid.cells.every((cell) => cell.label.size >= 24 && cell.value.size >= 24 && (!cell.sub || cell.sub.size >= 24)) && L.title.size >= 24 && L.type.size >= 24, `${name} [${lang}]: textos ≥ 24 px`);
  }
}

console.log("Datos de cada casilla: solo lo que el evento trae o la app calcula");
{
  const m = eventCardText(SPECS[0][1], "es", QUITO_PLACE, NOW);
  ok(m.grid[0].label === "Cuándo" && /hora de Quito \(UTC−5\)/.test(m.grid[0].sub), "Luna: fecha y hora de Quito con su desfase (UTC−5)", m.grid[0].sub);
  ok(m.grid.some((g) => g.label === "Iluminación" && /^(99|100) %$/.test(g.value)), "Luna llena: iluminación calculada ≈ 100 %");
  ok(m.grid.some((g) => g.label === "Desde Quito" && g.kind === "local"), "Luna: casilla del lugar (altura o salida)");
  const met = eventCardText(SPECS[5][1], "es", QUITO_PLACE, NOW);
  ok(met.grid.some((g) => g.label === "Tasa ideal (THZ)" && new RegExp(`~${SPECS[5][1].ev.data.shower.zhr} por hora`).test(g.value)), "meteoros: THZ del catálogo IMO");
  ok(met.visual.type === "sky-meteor" && met.sky.skyHero && met.visual.radiant.length === 3, "meteoros: el visual es el cielo de esa noche con el radiante");
  const sol = eventCardText(SPECS[4][1], "es", QUITO_PLACE, NOW);
  ok(sol.curio && /ISO 12312-2/.test(sol.curio), "eclipse de Sol: aviso de seguridad (ISO 12312-2)");
  ok(sol.grid.some((g) => g.label === "Desde Ecuador"), "eclipse de Sol: visibilidad desde Ecuador según la NASA");
  // fuera de Ecuador no hay fila «Desde Ecuador» (el dato de la NASA solo vale ahí): «Visibilidad · mira el mapa»
  const MADRID = { lat: 40.42, lon: -3.70, elev: 650, kind: "custom", name: null };
  const solMad = eventCardText(SPECS[4][1], "es", MADRID, NOW), solMadEn = eventCardText(SPECS[4][1], "en", MADRID, NOW);
  ok(!solMad.grid.some((g) => /Ecuador/.test(g.label + g.value + (g.sub || ""))) && solMad.grid.some((g) => g.label === "Visibilidad" && g.value === "Mira el mapa") && solMadEn.grid.some((g) => g.label === "Visibility" && g.value === "Check the map"),
    "eclipse de Sol desde Madrid: sin «Desde Ecuador»; «Visibilidad: mira el mapa» (ES/EN)");
  const tot = eventCardText(SPECS[2][1], "es", QUITO_PLACE, NOW);
  ok(tot.grid.some((g) => g.label === "Totalidad" && /^\d+ min$/.test(g.value)), "eclipse total: duración de la totalidad (NASA)");
  ok(/rojizo/.test(tot.visual.label), "eclipse total: el tono rojizo se explica como representación");
  const opp = eventCardText(SPECS[6][1], "es", QUITO_PLACE, NOW);
  ok(opp.visual.type === "planet" && /textura real, no es una foto/.test(opp.visual.label), "planeta: esfera con textura real, rotulada");
  const cj = eventCardText(SPECS[8][1], "es", QUITO_PLACE, NOW);
  ok(cj.visual.type === "sky-conj" && cj.visual.bodies.length === 2 && cj.grid.some((g) => g.label === "Separación aparente"), "conjunción: los dos cuerpos en el cielo real y su separación");
  const ss = eventCardText(SPECS[10][1], "es", QUITO_PLACE, NOW);
  ok(ss.visual.type === "earth" && ss.visual.season === 3 && ss.grid.some((g) => g.label === "Declinación del Sol" && g.value === "−23,44°"), "solsticio de diciembre: Tierra iluminada y declinación −23,44°");
  const iv = eventCardText(SPECS[12][1], "es", QUITO_PLACE, NOW), inv = eventCardText(SPECS[13][1], "es", QUITO_PLACE, NOW);
  ok(iv.title === "Pasada visible de la ISS" && iv.grid.some((g) => g.value === "Visible"), "ISS visible: título y casilla «Visible»");
  ok(!/^Pasada visible/.test(inv.title) && inv.grid.some((g) => g.value === "No visible" && g.sub === "es de día"), "ISS no visible: no dice «visible» y explica por qué");
  ok(inv.grid.some((g) => g.label === "Altura máxima" && g.value === "80°") && inv.grid.some((g) => g.label === "Recorrido" && g.value === "de SO a NNE"), "ISS: altura máxima y dirección (del servidor)");
  ok(inv.sky.allSky && inv.visual.track.length === 31, "ISS: cielo entero con la trayectoria de la pasada");
  const dirs = issTrackDirs(ISS_TRACK, placeInfo(QUITO_PLACE, "es"));
  ok(dirs.length === 31 && dirs.every((q) => Math.abs(Math.hypot(...q.dir) - 1) < 1e-9), "ISS: trayectoria pasada a direcciones J2000 unitarias");
  const la = eventCardText(SPECS[14][1], "es", QUITO_PLACE, NOW);
  ok(la.visual.type === "photo-launch" && la.visual.label === "Foto: CMSA · vía Launch Library 2 (The Space Devs)", "lanzamiento: foto de LL2 con su crédito");
  ok(la.grid.some((g) => g.label === "Cohete" && g.value === "Long March 2F/G") && la.grid[0].sub.startsWith("hora prevista (NET)"), "lanzamiento: cohete y hora prevista (NET)");
  const noImg = eventCardText({ kind: "launch", launch: { ...LAUNCH, image: null } }, "es", QUITO_PLACE, NOW);
  ok(/^Representación/.test(noImg.visual.label), "lanzamiento sin foto: representación rotulada");
  const noCredit = eventCardText({ kind: "launch", launch: { ...LAUNCH, image_credit: "" } }, "es", QUITO_PLACE, NOW);
  ok(/la fuente no indica el autor/.test(noCredit.visual.label), "lanzamiento sin autor: el rótulo lo dice");
  const sun = eventCardText(SPECS[15][1], "es", QUITO_PLACE, NOW);
  ok(sun.grid[0].label === "Manchas solares hoy" && sun.grid[0].value === "101", "Sol: manchas de SILSO");
  ok(sun.grid.some((g) => g.label === "Mayor fulguración (24 h)" && g.value === "C5.4") && sun.grid.some((g) => g.label === "Índice Kp (geomagnético)" && g.value === "1,3"), "Sol: mayor fulguración y Kp");
  ok(/^Foto: NASA\/SDO/.test(sun.visual.label) && remotePlan(sun.visual.url).mode === "proxy", "Sol: foto real de SDO/HMI, por el proxy");
  const sunNone = eventCardText({ kind: "sun", sun: { ...SUN, strongest_flare_24h: null, flares_7d: [] } }, "es", QUITO_PLACE, NOW);
  ok(sunNone.grid.some((g) => g.label === "Mayor fulguración (24 h)" && g.value === "Ninguna registrada"), "Sol: sin fulguraciones lo dice (no inventa)");
  const rock = eventCardText(SPECS[16][1], "es", QUITO_PLACE, NOW);
  ok(rock.grid[0].value === "3,5 distancias lunares" && rock.grid[0].sub === "1,3 millones de km", "asteroide: distancia en DL y km");
  ok(rock.grid.some((g) => g.label === "Tamaño estimado" && g.value === "9,5–21 m"), "asteroide: tamaño estimado de CNEOS");
  ok(/ampliadas/.test(rock.visual.label) && /no es un dato/.test(rock.visual.label), "asteroide: el rótulo dice qué está a escala y qué no");
  const mars = eventCardText(SPECS[17][1], "es", QUITO_PLACE, NOW), mmx = eventCardText(SPECS[18][1], "es", QUITO_PLACE, NOW);
  ok(remotePlan(mars.visual.url).mode === "proxy" && /NASA Image and Video Library/.test(mars.visual.label), "nave a Marte: imagen de nasaImages.js por el proxy");
  ok(mmx.visual.url === null && /^Representación esquemática/.test(mmx.visual.label), "MMX (sin imagen): representación esquemática");
  ok(mars.grid.some((g) => g.label === "Una señal de radio tarda" && /s$/.test(g.value)), "nave a Marte: tiempo de la señal");
}

console.log("Lugar: nunca coordenadas en la imagen");
{
  for (const [name, spec] of SPECS) {
    const c = eventCardText(spec, "es", ME, NOW);
    const all = [c.title, c.type, c.curio, c.where, c.visual && c.visual.label, ...c.grid.flatMap((g) => [g.label, g.value, g.sub])].filter(Boolean).join(" ");
    if (/2,19|79,89|-2\.19|-79\.8/.test(all)) { ok(false, `${name}: sin coordenadas con GPS`, all); continue; }
  }
  ok(true, "con GPS («tu ubicación») ningún texto lleva latitud ni longitud");
  ok(placeInfo(ME, "es").name === "tu ubicación" && placeInfo(ME, "es").tz === undefined && placeInfo(QUITO_PLACE, "es").tz === "America/Guayaquil", "lugar: nombre y zona horaria (atajos de Ecuador → America/Guayaquil)");
  ok(utcOffsetLabel(NOW, "America/Guayaquil") === "UTC−5" && utcOffsetLabel(NOW, "UTC") === "UTC" && utcOffsetLabel(NOW, "Asia/Kolkata") === "UTC+5:30", "desfase horario: UTC−5, UTC, UTC+5:30");
  const f = cardFmt("es", "America/Guayaquil", NOW);
  ok(untilCell(NOW + 3 * 86400000, NOW, "es", f).value === "3 días" && untilCell(NOW + 5 * 3600000, NOW, "es", f).value === "5 horas" && untilCell(NOW + 20 * 60000, NOW, "es", f).value === "20 minutos", "cuánto falta: días, horas, minutos");
  ok(untilCell(NOW - 3 * 3600000, NOW, "es", f).label === "Fue hace", "cuánto falta: si ya pasó, «Fue hace»");
  ok(firstSentences("Uno. Dos dos. Tres tres tres.", 14) === "Uno. Dos dos." && firstSentences("Una sola frase larguísima", 5) === null, "frase: corta por frases enteras, nunca a media frase");
  ok(/^teseo-ahora-launch-long_march_2f_g_shenzhou_24\.png$/.test(cardFileName("launch", "Long March 2F/G | Shenzhou 24")), "nombre de archivo seguro");
}

console.log("Marca: Killa Ñan y el mismo pie que la postal del Cielo");
for (const lang of ["es", "en"]) {
  const T = TE[lang];
  ok(/Killa Ñan/.test(T.pcHeadWith) && /Killa Ñan/.test(T.pcCoop) && /Killa Ñan/.test(T.shareText("X")) && /Killa Ñan/.test(T.shareTextSky), `[${lang}] Killa Ñan en cabecera, pie y texto al compartir`);
  ok(T.pcHead === "TESEO" && T.pcUrl === "teseo.yachaydeep.com" && /Yachay Deep Labs × Killa Ñan/.test(T.pcCoop), `[${lang}] cabecera TESEO, URL y «Yachay Deep Labs × Killa Ñan»`);
  ok(/^(Compartir imagen|Share image): Luna llena$/.test(T.shareBtn("Luna llena")), `[${lang}] nombre accesible del botón con el título`);
}

console.log("Imágenes remotas: proxy SOLO para los hosts de la lista");
{
  ok(proxyUrl("https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIF.jpg", "https://api.x") === "https://api.x/api/img?u=https%3A%2F%2Fsdo.gsfc.nasa.gov%2Fassets%2Fimg%2Flatest%2Flatest_1024_HMIIF.jpg", "SDO → /api/img?u=…");
  ok(!!proxyUrl("https://images-assets.nasa.gov/image/PIA04241/PIA04241~medium.jpg"), "NASA Image Library → proxy");
  for (const u of ["https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/x.jpeg", "http://sdo.gsfc.nasa.gov/a.jpg", "https://evil.example.com/a.jpg", "https://sdo.gsfc.nasa.gov.evil.com/a.jpg", "https://evil.sdo.gsfc.nasa.gov/a.jpg", "https://user:pw@sdo.gsfc.nasa.gov/a.jpg", "https://sdo.gsfc.nasa.gov:8443/a.jpg", "javascript:alert(1)", "", null]) {
    ok(proxyUrl(u) === null, `sin proxy: ${String(u).slice(0, 60) || "(vacía)"}`);
  }
  ok(remotePlan("https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/x.jpeg").mode === "cors", "LL2: directo con CORS («*» comprobado)");
  ok(remotePlan("https://cdn.eso.org/images/screen/eso1907a.jpg").mode === "cors", "CDN de ESO: directo con CORS");
  ok(remotePlan("https://upload.wikimedia.org/x.jpg").mode === "none", "otro host: no se dibuja (representación)");
  const pl = remotePlan("https://sdo.gsfc.nasa.gov/a.jpg", "https://api.x");
  ok(pl.mode === "proxy" && pl.urls[0].startsWith("https://api.x/api/img?u=") && pl.urls[1] === "https://sdo.gsfc.nasa.gov/a.jpg", "host del proxy: primero el proxy, luego directo");
  ok(PROXY_HOSTS.every((h) => !CORS_HOSTS.includes(h)) && httpsHost("https://SDO.gsfc.nasa.gov/x") === "sdo.gsfc.nasa.gov", "listas sin solapes; host en minúsculas");
  const py = readFileSync(new URL("../backend/app/img_proxy.py", import.meta.url), "utf8");
  const m = /ALLOWED_HOSTS = frozenset\(\{([^}]*)\}\)/.exec(py);
  const backendHosts = m ? m[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean).sort() : [];
  ok(JSON.stringify(backendHosts) === JSON.stringify([...PROXY_HOSTS].sort()), "la lista del cliente es la misma que la del backend", backendHosts.join(","));
}

console.log("Métrica now_share");
{
  ok(NOW_SHARE_EVENT === "now_share" && JSON.stringify(TRACK_KINDS) === JSON.stringify(NOW_SHARE_KINDS), "track.js y eventText.js usan los mismos tipos");
  const py = readFileSync(new URL("../backend/app/metrics.py", import.meta.url), "utf8");
  const m = /NOW_SHARE_KINDS = \{([^}]*)\}/.exec(py);
  const server = m ? m[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).sort() : [];
  ok(JSON.stringify(server) === JSON.stringify([...NOW_SHARE_KINDS].sort()) && /"now_share":\s*\{"kind": NOW_SHARE_KINDS, "state": \{"ok", "fail"\}\}/.test(py), "lista blanca del servidor: now_share {kind, state}");
  ok(SPECS.every(([, s]) => NOW_SHARE_KINDS.includes(s.kind)), "cada tipo compartible está en la lista");
  ok(JSON.stringify(cleanParams({ kind: "launch", state: "ok", title: "Crew-13", lat: -0.2 })) === JSON.stringify({ kind: "launch", state: "ok" }), "cliente: solo viajan kind y state");
}

// layoutText con la cuadrícula vacía no rompe
{
  const c = eventCardText({ kind: "asteroid", rock: { name: "X" } }, "es", QUITO_PLACE, NOW);
  let threw = false; try { layoutText(measureAt, c, { capLabel: c.visual.label }); } catch { threw = true; }
  ok(!threw, "datos mínimos (asteroide sin distancia): no rompe la composición");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
