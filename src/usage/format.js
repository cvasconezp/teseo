// format.js — «Teseo en números»: textos, nombres legibles y geometría de la gráfica.
// PURO (sin DOM ni React): se prueba en Node con scripts/test_usage.mjs.
//
// Los datos vienen de GET {API}/api/metrics/public?days=7|30|90 (backend/app/metrics.py,
// MetricsStore.public_summary). Aquí solo se les da forma: nada se estima ni se inventa.
// Si un valor no tiene nombre conocido se muestra tal cual llegó.
import { TQ } from "../questions/i18n.js";
import { CON_INFO } from "../sky/constellations.js";

export const PERIODS = [7, 30, 90];
export const DEFAULT_DAYS = 30;
export const PRIVACY_URL = "https://www.yachaydeep.com/privacidad";
export const USAGE_PATH = "/api/metrics/public";

export const usageUrl = (api, days) => `${api || ""}${USAGE_PATH}?days=${PERIODS.includes(days) ? days : DEFAULT_DAYS}`;

const loc = (lang) => (lang === "en" ? "en-US" : "es");

/** Entero con separador de miles del idioma ("12.345" / "12,345"); "—" si no es un número. */
export function fmtInt(n, lang = "es") {
  const v = n === null || n === "" || typeof n === "boolean" ? NaN : Number(n);
  return Number.isFinite(v) ? Math.round(v).toLocaleString(loc(lang)) : "—";
}

const MONTHS = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const MONTHS_LONG = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

function parts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  return mo >= 0 && mo < 12 && d >= 1 && d <= 31 ? { y, mo, d } : null;
}

/** "2026-11-14" → "14 nov" / "Nov 14" (fecha del calendario, sin zona horaria). */
export function fmtDay(iso, lang = "es") {
  const p = parts(iso);
  if (!p) return String(iso || "");
  return lang === "en" ? `${MONTHS.en[p.mo]} ${p.d}` : `${p.d} ${MONTHS.es[p.mo]}`;
}

/** "2026-11-14" → "14 de noviembre de 2026" / "November 14, 2026". */
export function fmtLongDate(iso, lang = "es") {
  const p = parts(iso);
  if (!p) return String(iso || "");
  return lang === "en" ? `${MONTHS_LONG.en[p.mo]} ${p.d}, ${p.y}` : `${p.d} de ${MONTHS_LONG.es[p.mo]} de ${p.y}`;
}

// ─── Nombres legibles ─────────────────────────────────────────────────────────

const TAB_NAMES = {
  es: { route: "Ruta", now: "Ahora", sky: "Cielo", questions: "Preguntas", windows: "Ventanas (antigua)", scale: "Escala (antigua)" },
  en: { route: "Route", now: "Now", sky: "Sky", questions: "Questions", windows: "Windows (old)", scale: "Scale (old)" },
};
// Cuerpos de las rutas (destination_change: "earth>mars") y de sky_select (nombre en inglés)
const BODY_NAMES = {
  mercury: ["Mercurio", "Mercury"], venus: ["Venus", "Venus"], earth: ["Tierra", "Earth"], mars: ["Marte", "Mars"],
  jupiter: ["Júpiter", "Jupiter"], saturn: ["Saturno", "Saturn"], uranus: ["Urano", "Uranus"], neptune: ["Neptuno", "Neptune"],
  moon: ["Luna", "Moon"], sun: ["Sol", "Sun"], pluto: ["Plutón", "Pluto"], light: ["Luz", "Light"],
};
const bodyName = (id, lang) => { const b = BODY_NAMES[String(id || "").toLowerCase()]; return b ? b[lang === "en" ? 1 : 0] : null; };

export const tabName = (v, lang = "es") => (TAB_NAMES[lang === "en" ? "en" : "es"][v] || String(v));

/** Título de la pregunta tal como aparece en la pestaña Preguntas (src/questions/i18n.js). */
export const tourName = (v, lang = "es") => {
  const tours = (TQ[lang === "en" ? "en" : "es"] || {}).tours || {};
  return (tours[v] && tours[v].title) || String(v);
};

/** "earth>mars" → "Tierra → Marte". */
export function routeName(v, lang = "es") {
  const [a, b] = String(v || "").split(">");
  if (!a || !b) return String(v || "");
  return `${bodyName(a, lang) || a} → ${bodyName(b, lang) || b}`;
}

/**
 * Objeto del Cielo (id de sky_select): planeta en inglés → nombre del idioma; abreviatura de
 * constelación → su nombre en español (en inglés, la abreviatura de la IAU con «constellation»);
 * Messier, Caldwell, estrellas y agujeros negros → su nombre de catálogo, tal cual.
 */
export function skyName(v, lang = "es") {
  const s = String(v || "");
  const b = bodyName(s, lang);
  if (b) return b;
  if (CON_INFO[s]) return lang === "en" ? `${s} (constellation)` : `${CON_INFO[s][0]} (constelación)`;
  if (s === "LMC") return lang === "en" ? "Large Magellanic Cloud" : "Gran Nube de Magallanes";
  if (s === "SMC") return lang === "en" ? "Small Magellanic Cloud" : "Pequeña Nube de Magallanes";
  return s;
}

export const TOP_NAMERS = { tabs: tabName, tours: tourName, sky_objects: skyName, routes: routeName };

/** [{value, count}] → [{value, label, count, share}] (share = fracción del mayor, para la barrita). */
export function topRows(list, kind, lang = "es") {
  const rows = Array.isArray(list) ? list.filter(x => x && typeof x.value === "string" && Number.isFinite(Number(x.count))) : [];
  const max = Math.max(1, ...rows.map(x => Number(x.count)));
  const name = TOP_NAMERS[kind] || ((v) => String(v));
  return rows.map(x => ({ value: x.value, label: name(x.value, lang), count: Number(x.count), share: Number(x.count) / max }));
}

// ─── Validación de la respuesta ───────────────────────────────────────────────

/** true si la respuesta tiene la forma del contrato (si no, la vista muestra un error honesto). */
export function isPublicSummary(d) {
  if (!d || typeof d !== "object") return false;
  const t = d.totals;
  return Array.isArray(d.by_day) && !!t && typeof t === "object"
    && ["visits", "page_views"].every(k => Number.isFinite(Number(t[k])))
    && d.by_day.every(x => x && typeof x.date === "string" && Number.isFinite(Number(x.visits)))
    && typeof d.top === "object" && d.top !== null;
}

/** Porcentaje del teléfono (null si el backend no lo publica: menos de 20 visitas con dispositivo). */
export const mobileShare = (devices) => (devices && Number.isFinite(Number(devices.mobile)) ? Number(devices.mobile) : null);

// ─── Gráfica de barras ────────────────────────────────────────────────────────

/** Máximo «redondo» del eje (1, 2, 5 × 10ⁿ) y sus marcas. */
export function niceAxis(maxValue, ticks = 4) {
  const m = Math.max(0, Number(maxValue) || 0);
  if (m === 0) return { max: 1, ticks: [0, 1] };
  const rough = m / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = Math.max(1, [1, 2, 5, 10].map(f => f * pow).find(s => s >= rough));
  const max = Math.ceil(m / step) * step;
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v));
  return { max, ticks: out };
}

/**
 * Geometría de la gráfica de visitas por día (SVG en coordenadas del viewBox).
 * byDay: [{date, visits}] en orden; today: fecha "YYYY-MM-DD" del último día (en curso).
 * labelW: ancho que se reserva a cada fecha del eje x («14 nov» ≈ 36 px a 10,5 px), labelGap: aire entre ellas.
 * Devuelve { width, height, plot: {x, y, w, h}, axis: {max, ticks:[{v, y}]}, bars: [...], labels: [{x, text, i, anchor}] }.
 */
export function chartModel(byDay, { width = 480, height = 180, padL = 34, padR = 6, padT = 10, padB = 24, lang = "es", maxLabels = 6, labelW = 44, labelGap = 8 } = {}) {
  const days = Array.isArray(byDay) ? byDay : [];
  const plot = { x: padL, y: padT, w: Math.max(1, width - padL - padR), h: Math.max(1, height - padT - padB) };
  const maxV = Math.max(0, ...days.map(d => Number(d.visits) || 0));
  const ax = niceAxis(maxV);
  const n = days.length || 1;
  const slot = plot.w / n;
  const gap = slot >= 8 ? Math.min(4, slot * 0.25) : slot >= 3 ? 1 : 0;
  const bw = Math.max(0.5, slot - gap);
  const last = days.length - 1;
  const peak = days.reduce((best, d, i) => (Number(d.visits) > Number((days[best] || {}).visits || 0) ? i : best), 0);
  const bars = days.map((d, i) => {
    const v = Math.max(0, Number(d.visits) || 0);
    const h = (v / ax.max) * plot.h;
    return {
      x: plot.x + i * slot + gap / 2, y: plot.y + plot.h - h, w: bw, h, value: v, date: d.date,
      today: i === last, peak: maxV > 0 && i === peak,
    };
  });
  // etiquetas del eje x: la primera (alineada a la izquierda), la última (a la derecha, es hoy)
  // y las intermedias cada `every` días, solo si su texto no pisa a ninguna vecina
  const every = Math.max(1, Math.ceil(n / maxLabels));
  const cx = (i) => plot.x + i * slot + slot / 2;
  const span = (x, anchor) => (anchor === "start" ? [x, x + labelW] : anchor === "end" ? [x - labelW, x] : [x - labelW / 2, x + labelW / 2]);
  const labels = [];
  if (days.length) {
    const lastLabel = { x: cx(last), text: fmtDay(days[last].date, lang), i: last, anchor: last === 0 ? "start" : "end" };
    const lastSpan = span(lastLabel.x, lastLabel.anchor);
    let prevEnd = -Infinity;
    for (let i = 0; i < last; i += every) {
      const anchor = i === 0 ? "start" : "middle";
      const [a, b] = span(cx(i), anchor);
      if (a < prevEnd + labelGap || b > lastSpan[0] - labelGap) continue;
      labels.push({ x: cx(i), text: fmtDay(days[i].date, lang), i, anchor });
      prevEnd = b;
    }
    labels.push(lastLabel);
  }
  return {
    width, height, plot,
    axis: { max: ax.max, ticks: ax.ticks.map(v => ({ v, y: plot.y + plot.h - (v / ax.max) * plot.h })) },
    bars, labels,
  };
}

/** Resumen textual de la gráfica para lectores de pantalla. */
export function chartSummary(byDay, lang = "es") {
  const days = Array.isArray(byDay) ? byDay : [];
  if (!days.length) return lang === "en" ? "No data for this period." : "Sin datos en este periodo.";
  const total = days.reduce((s, d) => s + (Number(d.visits) || 0), 0);
  const peak = days.reduce((a, d) => (Number(d.visits) > Number(a.visits) ? d : a), days[0]);
  const from = fmtDay(days[0].date, lang), to = fmtDay(days[days.length - 1].date, lang);
  if (lang === "en") {
    return `${fmtInt(total, "en")} visits from ${from} to ${to}` + (Number(peak.visits) > 0 ? `; busiest day ${fmtDay(peak.date, "en")} with ${fmtInt(peak.visits, "en")}.` : ".");
  }
  return `${fmtInt(total)} visitas del ${from} al ${to}` + (Number(peak.visits) > 0 ? `; el día con más fue el ${fmtDay(peak.date)}, con ${fmtInt(peak.visits)}.` : ".");
}

// ─── Textos ───────────────────────────────────────────────────────────────────

export const TU = {
  es: {
    link: "Uso de Teseo",
    title: "Teseo en números",
    lead: "Cuánto se usa Teseo, tal como lo cuenta la propia app. Cifras públicas, anónimas y agregadas.",
    period: "Periodo",
    periodOpt: (d) => `${d} días`,
    loading: "Cargando las cifras…",
    error: "No se pudieron cargar las cifras. Puede que el servidor no responda o que no haya conexión.",
    retry: "Reintentar",
    stale: "Mostrando el periodo anterior mientras llegan los nuevos datos.",
    visits: "Visitas",
    visitsHint: "sesiones de una pestaña del navegador",
    pageViews: "Páginas vistas",
    shares: "Imágenes para compartir creadas",
    reminders: "Recordatorios activados",
    questions: "Preguntas abiertas",
    chartTitle: "Visitas por día",
    chartToday: "hoy, en curso",
    chartDate: "Día",
    chartVisits: "Visitas",
    chartViews: "Páginas vistas",
    phone: (p) => `${p} % de las visitas llega desde un teléfono.`,
    phoneNone: "Aún no hay visitas suficientes para publicar el reparto por dispositivo (hacen falta 20).",
    top: "Lo más visto",
    topTabs: "Pestañas",
    topTours: "Preguntas",
    topSky: "Objetos del cielo",
    topRoutes: "Rutas",
    topEmpty: "Aún nada con 5 usos o más.",
    times: (n) => `${n} ${n === "1" ? "vez" : "veces"}`,
    since: (date, n) => `Desde el ${date}: ${n} visitas en total.`,
    privacyTitle: "Qué se cuenta y qué no",
    privacy: [
      "Se cuentan totales por día: visitas, páginas vistas y qué funciones se usan (qué pestaña, qué pregunta, qué objeto del cielo, qué ruta).",
      "Una visita es una pestaña del navegador abierta en Teseo: la misma persona puede sumar varias y no se cuentan personas únicas.",
      "No se guardan cookies, IP, ubicación, búsquedas, identificadores ni nada que permita reconocer a alguien.",
      "Las listas solo muestran valores usados 5 veces o más, y el reparto por dispositivo necesita al menos 20 visitas.",
      "Si tu navegador pide no ser rastreado (DNT o GPC), Teseo no envía nada.",
    ],
    privacyLink: "Política de privacidad de Yachay Deep",
    updated: (d) => `Datos al ${d}. Las cifras pueden tardar hasta 10 minutos en actualizarse.`,
    close: "Cerrar",
  },
  en: {
    link: "Teseo usage",
    title: "Teseo in numbers",
    lead: "How much Teseo is used, as counted by the app itself. Public, anonymous and aggregated figures.",
    period: "Period",
    periodOpt: (d) => `${d} days`,
    loading: "Loading the figures…",
    error: "The figures could not be loaded. The server may not be responding or you may be offline.",
    retry: "Try again",
    stale: "Showing the previous period while the new data arrives.",
    visits: "Visits",
    visitsHint: "browser-tab sessions",
    pageViews: "Page views",
    shares: "Share images created",
    reminders: "Reminders turned on",
    questions: "Questions opened",
    chartTitle: "Visits per day",
    chartToday: "today, in progress",
    chartDate: "Day",
    chartVisits: "Visits",
    chartViews: "Page views",
    phone: (p) => `${p}% of visits come from a phone.`,
    phoneNone: "Not enough visits yet to publish the device split (20 are needed).",
    top: "Most viewed",
    topTabs: "Tabs",
    topTours: "Questions",
    topSky: "Sky objects",
    topRoutes: "Routes",
    topEmpty: "Nothing with 5 or more uses yet.",
    times: (n) => `${n} ${n === "1" ? "time" : "times"}`,
    since: (date, n) => `Since ${date}: ${n} visits in total.`,
    privacyTitle: "What is counted and what is not",
    privacy: [
      "Daily totals are counted: visits, page views and which features are used (which tab, question, sky object or route).",
      "A visit is one browser tab open on Teseo: the same person can add several, and unique people are not counted.",
      "No cookies, IP addresses, location, searches, identifiers or anything that could recognise someone are stored.",
      "Lists only show values used 5 or more times, and the device split needs at least 20 visits.",
      "If your browser asks not to be tracked (DNT or GPC), Teseo sends nothing.",
    ],
    privacyLink: "Yachay Deep privacy policy",
    updated: (d) => `Data as of ${d}. Figures can take up to 10 minutes to update.`,
    close: "Close",
  },
};
