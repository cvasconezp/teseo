// Pruebas de «Teseo en números» (src/usage/format.js): formateo, nombres legibles, validación
// de la respuesta de /api/metrics/public y geometría de la gráfica de visitas por día.
// Node puro, sin dependencias.  Uso:  node scripts/test_usage.mjs  (sale con 1 si algo falla)
import { readFileSync } from "node:fs";
import {
  PERIODS, DEFAULT_DAYS, PRIVACY_URL, TU, usageUrl, fmtInt, fmtDay, fmtLongDate, tabName, tourName, routeName, skyName,
  topRows, isPublicSummary, mobileShare, niceAxis, chartModel, chartSummary,
} from "../src/usage/format.js";
import { TQ } from "../src/questions/i18n.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, `→ obtuvo ${JSON.stringify(a)}, esperaba ${JSON.stringify(b)}`);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// Respuesta realista del contrato (≈80 visitas en 7 días con pico el 14-nov)
const SAMPLE = {
  generated: "2026-11-16T15:20:00+00:00", from: "2026-11-10", to: "2026-11-16", days: 7, since: "2026-11-02",
  totals: { visits: 81, page_views: 163, shares: 9, reminders: 4, questions_opened: 27, sky_selections: 58 },
  by_day: [
    { date: "2026-11-10", visits: 6, page_views: 11 }, { date: "2026-11-11", visits: 8, page_views: 15 },
    { date: "2026-11-12", visits: 9, page_views: 18 }, { date: "2026-11-13", visits: 12, page_views: 25 },
    { date: "2026-11-14", visits: 27, page_views: 54 }, { date: "2026-11-15", visits: 13, page_views: 26 },
    { date: "2026-11-16", visits: 6, page_views: 14 },
  ],
  devices: { mobile: 68, tablet: 4, desktop: 28 },
  top: {
    tabs: [{ value: "sky", count: 61 }, { value: "route", count: 48 }],
    tours: [{ value: "drake", count: 9 }, { value: "bh", count: 6 }],
    sky_objects: [{ value: "Mars", count: 8 }, { value: "Ori", count: 6 }],
    routes: [{ value: "earth>mars", count: 14 }],
  },
  all_time: { visits: 212, page_views: 431 },
  note: "Visitas = sesiones de una pestaña del navegador, no personas únicas.",
};

console.log("Periodos y URL");
{
  eq(PERIODS, [7, 30, 90], "periodos 7 / 30 / 90");
  ok(DEFAULT_DAYS === 30, "30 días por defecto");
  eq([usageUrl("https://api.example", 7), usageUrl("", 90), usageUrl("", 365), usageUrl(undefined, "x")],
    ["https://api.example/api/metrics/admin?days=7", "/api/metrics/admin?days=90", "/api/metrics/admin?days=30", "/api/metrics/admin?days=30"],
    "URL del endpoint; un periodo no admitido vuelve a 30");
  ok(PRIVACY_URL === "https://www.yachaydeep.com/privacidad", "misma política de privacidad que el aviso de cookies");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  ok(html.includes(PRIVACY_URL), "index.html enlaza la misma política");
}

console.log("Números y fechas");
{
  eq([fmtInt(0), fmtInt(81), fmtInt(1234), fmtInt(12345), fmtInt(1234567)], ["0", "81", "1234", "12.345", "1.234.567"], "enteros en español (agrupa desde 5 cifras, como el resto de Teseo)");
  eq([fmtInt(12345, "en"), fmtInt(1234, "en")], ["12,345", "1,234"], "enteros en inglés");
  eq([fmtInt(null), fmtInt("abc"), fmtInt(undefined)], ["—", "—", "—"], "sin número → raya, nunca NaN");
  eq([fmtInt(2.6), fmtInt("40")], ["3", "40"], "redondea y acepta cadenas numéricas");
  eq([fmtDay("2026-11-14"), fmtDay("2026-11-14", "en"), fmtDay("2026-01-03"), fmtDay("2026-09-30")], ["14 nov", "Nov 14", "3 ene", "30 sept"], "día corto");
  eq([fmtLongDate("2026-11-02"), fmtLongDate("2026-11-02", "en")], ["2 de noviembre de 2026", "November 2, 2026"], "fecha larga");
  eq([fmtDay("no"), fmtLongDate(null), fmtDay("2026-13-01")], ["no", "", "2026-13-01"], "fecha inválida: se muestra tal cual, sin inventar");
  // sin zona horaria: "2026-11-14" es siempre el 14 (no se corre un día al oeste de UTC)
  ok(fmtDay("2026-11-01") === "1 nov", "sin desfase por zona horaria");
}

console.log("Nombres legibles");
{
  eq([tabName("sky"), tabName("route", "en"), tabName("questions"), tabName("now", "en"), tabName("x")], ["Cielo", "Route", "Preguntas", "Now", "x"], "pestañas");
  const tours = Object.keys(TQ.es.tours);
  ok(tours.length === 9 && tours.every(k => tourName(k) === TQ.es.tours[k].title && tourName(k, "en") === TQ.en.tours[k].title), "las 9 preguntas con su título de la pestaña Preguntas (es/en)");
  eq([tourName("drake"), tourName("bh", "en"), tourName("nueva")], ["¿Estamos solos?", "What happens near a black hole?", "nueva"], "pregunta: título o el id si no se conoce");
  eq([routeName("earth>mars"), routeName("earth>jupiter", "en"), routeName("earth>moon"), routeName("mars>pluto")], ["Tierra → Marte", "Earth → Jupiter", "Tierra → Luna", "Marte → Plutón"], "rutas origen → destino");
  eq([routeName("earth>xx"), routeName("raro")], ["Tierra → xx", "raro"], "ruta desconocida: lo que llegó");
  eq([skyName("Mars"), skyName("Moon"), skyName("Sun", "en"), skyName("Jupiter", "en")], ["Marte", "Luna", "Sun", "Jupiter"], "planetas, Luna y Sol");
  eq([skyName("Ori"), skyName("UMa"), skyName("Ori", "en")], ["Orión (constelación)", "Osa Mayor (constelación)", "Ori (constellation)"], "constelaciones");
  eq([skyName("LMC"), skyName("SMC", "en")], ["Gran Nube de Magallanes", "Small Magellanic Cloud"], "Nubes de Magallanes");
  eq([skyName("M31"), skyName("C80"), skyName("Betelgeuse"), skyName("Sgr A*")], ["M31", "C80", "Betelgeuse", "Sgr A*"], "catálogos y nombres propios, tal cual");
}

console.log("Listas «lo más visto»");
{
  const rows = topRows(SAMPLE.top.routes.concat([{ value: "earth>venus", count: 7 }]), "routes");
  eq(rows.map(r => [r.label, r.count]), [["Tierra → Marte", 14], ["Tierra → Venus", 7]], "etiquetas y cuentas");
  ok(rows[0].share === 1 && near(rows[1].share, 0.5), "barrita proporcional al mayor");
  eq(topRows(SAMPLE.top.tours, "tours", "en").map(r => r.label), ["Are we alone?", "What happens near a black hole?"], "preguntas en inglés");
  eq(topRows(SAMPLE.top.sky_objects, "sky_objects").map(r => r.label), ["Marte", "Orión (constelación)"], "objetos del cielo");
  eq([topRows(null, "tabs"), topRows([{ value: 3, count: 1 }, { count: 5 }, null], "tabs")], [[], []], "entradas inválidas se ignoran");
}

console.log("Validación de la respuesta");
{
  ok(isPublicSummary(SAMPLE), "la respuesta del contrato es válida");
  ok(!isPublicSummary(null) && !isPublicSummary({}) && !isPublicSummary("<html>") && !isPublicSummary({ ...SAMPLE, by_day: null })
    && !isPublicSummary({ ...SAMPLE, totals: { visits: "x" } }) && !isPublicSummary({ ...SAMPLE, top: null }), "lo que no es el contrato se rechaza (error honesto)");
  eq([mobileShare(SAMPLE.devices), mobileShare(null), mobileShare({})], [68, null, null], "% de teléfono o null si no se publica");
}

console.log("Eje y gráfica");
{
  eq(niceAxis(27), { max: 30, ticks: [0, 10, 20, 30] }, "eje redondo para 27 → 0–30");
  eq(niceAxis(0), { max: 1, ticks: [0, 1] }, "sin visitas: eje mínimo (sin dividir por cero)");
  eq(niceAxis(3).ticks, [0, 1, 2, 3], "valores pequeños: marcas enteras");
  eq(niceAxis(140), { max: 150, ticks: [0, 50, 100, 150] }, "140 → 0–150");
  ok(niceAxis(1234).ticks.every(Number.isInteger), "marcas siempre enteras");

  const m = chartModel(SAMPLE.by_day, { width: 480, height: 180 });
  ok(m.bars.length === 7, "una barra por día");
  const base = m.plot.y + m.plot.h;
  ok(m.bars.every(b => near(b.y + b.h, base)), "todas las barras salen del eje");
  const peak = m.bars.find(b => b.peak);
  ok(peak && peak.date === "2026-11-14" && peak.value === 27, "pico el 14-nov");
  ok(near(peak.h, (27 / 30) * m.plot.h), "altura proporcional al eje (27 de 30)");
  ok(m.bars.filter(b => b.today).length === 1 && m.bars[6].today, "solo el último día va marcado como «hoy, en curso»");
  ok(m.bars.every((b, i) => i === 0 || b.x > m.bars[i - 1].x + m.bars[i - 1].w - 1e-9), "las barras no se solapan");
  ok(m.bars[0].x >= m.plot.x && m.bars[6].x + m.bars[6].w <= m.plot.x + m.plot.w + 1e-9, "las barras caben en el área");
  eq(m.axis.ticks.map(t => t.v), [0, 10, 20, 30], "marcas del eje y");
  ok(near(m.axis.ticks[0].y, base) && near(m.axis.ticks[3].y, m.plot.y), "0 abajo y el máximo arriba");

  const days90 = Array.from({ length: 90 }, (_, i) => ({ date: new Date(Date.UTC(2026, 7, 19) + i * 864e5).toISOString().slice(0, 10), visits: i % 7 }));
  const m90 = chartModel(days90, { width: 320, height: 170, maxLabels: 4 });
  ok(m90.bars.length === 90 && m90.bars.every(b => b.w > 0), "90 días a 320 px: 90 barras visibles");
  ok(m90.labels.length <= 5 && m90.labels[m90.labels.length - 1].i === 89, "pocas etiquetas en x y la última es hoy");
  // ninguna etiqueta del eje x pisa a otra (con su alineación real), en todos los anchos y periodos
  const spans = (mm, W = 44) => mm.labels.map(l => (l.anchor === "start" ? [l.x, l.x + W] : l.anchor === "end" ? [l.x - W, l.x] : [l.x - W / 2, l.x + W / 2]));
  const clear = (mm) => spans(mm).every((s, i, all) => i === 0 || s[0] >= all[i - 1][1] + 8);
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ date: new Date(Date.UTC(2026, 10, 16) - (n - 1 - i) * 864e5).toISOString().slice(0, 10), visits: i % 5 }));
  let worst = [];
  for (const n of [7, 30, 90]) for (const w of [296, 320, 340, 440, 560, 598]) {
    const mm = chartModel(mk(n), { width: w, maxLabels: w < 400 ? 4 : 6 });
    if (!clear(mm) || mm.labels[mm.labels.length - 1].i !== n - 1 || mm.labels[0].anchor !== "start") worst.push(`${n}d@${w}px`);
  }
  ok(worst.length === 0, "etiquetas del eje x sin solaparse (7/30/90 días, de 296 a 598 px); la primera a la izquierda y la última es hoy", worst.join(" "));
  eq(chartModel(mk(30), { width: 296, maxLabels: 4 }).labels.map(l => l.text), ["18 oct", "3 nov", "16 nov"], "30 días a 296 px (teléfono de 360): 18 oct · 3 nov · 16 nov");
  const a7 = chartModel(mk(7), { width: 440 }).labels.map(l => l.anchor);
  ok(a7.length >= 3 && a7[0] === "start" && a7[a7.length - 1] === "end" && a7.slice(1, -1).every(a => a === "middle"), "alineación: inicio, centro… y fin", a7.join(","));
  eq(chartModel(mk(1), {}).labels.map(l => [l.text, l.anchor]), [["16 nov", "start"]], "un solo día: una etiqueta");
  const empty = chartModel([], {});
  ok(empty.bars.length === 0 && empty.labels.length === 0 && empty.axis.max === 1, "sin días: gráfica vacía sin errores");
  const zeros = chartModel([{ date: "2026-11-16", visits: 0 }], {});
  ok(!zeros.bars[0].peak && zeros.bars[0].h === 0, "un periodo sin visitas no marca pico");
}

console.log("Texto para lectores de pantalla");
{
  eq(chartSummary(SAMPLE.by_day), "81 visitas del 10 nov al 16 nov; el día con más fue el 14 nov, con 27.", "resumen en español");
  eq(chartSummary(SAMPLE.by_day, "en"), "81 visits from Nov 10 to Nov 16; busiest day Nov 14 with 27.", "resumen en inglés");
  eq(chartSummary([]), "Sin datos en este periodo.", "sin datos");
  ok(SAMPLE.by_day.reduce((s, d) => s + d.visits, 0) === SAMPLE.totals.visits, "el ejemplo es coherente: la suma por día = total");
}

console.log("Textos (es/en)");
{
  const ke = Object.keys(TU.es).sort(), kn = Object.keys(TU.en).sort();
  eq(ke, kn, "mismas claves en español e inglés");
  ok(TU.es.privacy.length === TU.en.privacy.length && TU.es.privacy.length >= 4, "nota de privacidad completa en ambos idiomas");
  ok(TU.es.privacy.some(p => /5 veces/.test(p)) && TU.es.privacy.some(p => /20 visitas/.test(p)), "la nota explica los umbrales (5 y 20)");
  ok(TU.es.privacy.some(p => /personas únicas/.test(p)) && TU.es.privacy.some(p => /cookies/.test(p)), "la nota dice que no son personas únicas y que no hay cookies");
  eq([TU.es.periodOpt(7), TU.en.periodOpt(90), TU.es.phone("68"), TU.en.phone("68")], ["7 días", "90 days", "68 % de las visitas llega desde un teléfono.", "68% of visits come from a phone."], "plantillas");
  eq([TU.es.times("1"), TU.es.times("5"), TU.en.times("1")], ["1 vez", "5 veces", "1 time"], "singular y plural");
}

console.log("Métrica usage_open y enlaces (cliente ↔ servidor)");
{
  const py = readFileSync(new URL("../backend/app/metrics.py", import.meta.url), "utf8");
  // las métricas son privadas: solo el panel #admin (con clave); ni el pie ni el menú del Cielo las enlazan
  ok(/"usage_open":\s*\{"from": \{"link"\}\}/.test(py), "lista blanca del servidor: usage_open {from: link}");
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const froms = [...app.matchAll(/openUsage\("([a-z]+)"/g)].map(m => m[1]);
  ok(froms.length >= 1 && froms.every(f => f === "link"), "App solo abre el panel desde el enlace #admin", froms.join(","));
  ok(!app.includes('"teseo:usage"') && /function AdminGate/.test(app) && /api\/metrics\/summary\?days=1/.test(app), "sin enlaces públicos y con puerta de clave");
  const sky = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
  ok(!/teseo:usage/.test(sky), "el menú del Cielo ya no abre las métricas");
  const modal = readFileSync(new URL("../src/usage/UsageModal.jsx", import.meta.url), "utf8");
  ok(/Authorization: `Bearer \$\{t\}`/.test(modal), "el panel manda la clave al servidor");
  ok(/PUBLIC_MIN_COUNT = 5\b/.test(py) && /PUBLIC_MIN_DEVICE_VISITS = 20\b/.test(py), "los umbrales del texto coinciden con el servidor (5 y 20)");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
