import { useState, useEffect, useRef, useCallback, useMemo, useId, lazy, Suspense } from "react";
// loadSky separado para poder recrear el componente lazy al reintentar: React.lazy
// memoriza un import fallido, así que "Reintentar" necesita un lazy nuevo.
const loadSky = () => import("./Constellations.jsx");
const Constellations = lazy(loadSky);
import CosmicScale from "./CosmicScale.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { fetchJson, isAbort, TIMEOUT_MS, TIMEOUT_AI_MS } from "./net.js";
import PlanetSphere from "./ui/PlanetSphere.jsx";
import { AU_KM, helioPosition, approxDistanceKm, hohmannLocal, launchWindowsLocal } from "./ui/orbits.js";
import {
  IconRoute, IconWindows, IconSky, IconScale, IconLight, IconProbe, IconRocket, IconPlane,
  IconSwap, IconChevron, IconRetry, IconClose, IconInfo, IconArrow,
} from "./ui/icons.jsx";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// En producción apunta al backend en Railway/Render.
// En desarrollo, Vite proxea /api → localhost:8000
const API = import.meta.env.VITE_API_URL || "";

const DAY_MS = 86400000;

// ─── i18n ────────────────────────────────────────────────────────────────────
// Todo texto visible vive aquí, en ES y EN. Las entradas con datos variables
// son funciones.

const T = {
  en: {
    tagline:        "Interplanetary navigation",
    youAreHere:     "You are here.",
    whereToGo:      "Where do you want to go?",
    skip:           "Skip",
    skipIntro:      "Skip intro",
    switchLang:     "Cambiar a español",
    sections:       "Sections",
    origin:         "From",
    destination:    "To",
    choose:         (label, name) => `${label}: ${name}. Change`,
    swap:           "Swap origin and destination",
    route:          "Route",
    windows:        "Windows",
    sky:            "Sky",
    scale:          "Scale",
    au:             "AU",
    days:           "days",

    // Mapa
    mapLabel:       "Map of the Solar System today. Tap a planet to travel there.",
    mapPick:        (name) => `Travel to ${name}`,
    mapIsOrigin:    (name) => `${name}, your origin. Tap to swap with the destination`,
    mapIsDest:      (name) => `${name}, your destination`,
    mapNasa:        "Today's positions: NASA JPL",
    mapLocal:       "Today's positions: local estimate",
    mapLoading:     "Loading real positions…",
    mapNote:        "Tap a planet to go there. Sizes and distances are not to scale; the thread is schematic.",
    sun:            "Sun",

    // Respuesta
    answerQ:        (dest) => `How long would it take to reach ${dest}?`,
    about:          "About",
    unitMonth:      (n) => (n === 1 ? "month" : "months"),
    unitYear:       (n) => (n === 1 ? "year" : "years"),
    unitDay:        (n) => (n === 1 ? "day" : "days"),
    half:           "½",
    answerSub:      (days) => <>{days} days coasting along the most fuel-efficient path, a </>,
    hohmannTerm:    "Hohmann transfer",
    leaveToday:     "If you left today",
    youdArrive:     "You would arrive",
    whenToLeave:    "A real mission waits for the planets to line up.",
    seeWindows:     "See the best dates to leave",
    confirming:     "Checking with the server…",
    narrativeBy:    "Narrated by AI from the numbers above. The AI narrates; it never calculates.",

    // Comparador
    compareTitle:   "And in a straight line?",
    compareTag:     "Just for fun",
    compareIntro:   (a, b, dist) => <>Today {a} and {b} are <strong>{dist}</strong> apart. This is how long that distance takes at constant speed, ignoring gravity. No spacecraft flies like this.</>,
    compareScale:   "Bar length uses a logarithmic scale.",
    light:          "Light",
    voyager:        "Voyager 1",
    rocket:         "Apollo rocket",
    plane:          "Airliner",
    million:        "million",
    billion:        "billion",
    tSec:           (n) => (n === 1 ? "second" : "seconds"),
    tMin:           "minutes",
    tHour:          "hours",

    // Detalles técnicos
    techTitle:      "How is this calculated?",
    techTransfer:   "Transfer time",
    techDv:         "Total Δv",
    techDvSplit:    (a, b) => `departure ${a} + arrival ${b}`,
    techAxis:       "Transfer orbit semi-major axis",
    techRadii:      "Orbit radii (circular model)",
    techDist:       "Distance today",
    techSource:     "Computed by",
    srcServer:      "Teseo server (hapsira)",
    srcLocal:       "your device (same Hohmann formula)",
    srcNasa:        "NASA JPL Horizons",
    srcApprox:      "local estimate",
    assumptions:    "Assumptions",
    modelNote:      "The Hohmann transfer is the minimum-energy path between two orbits. Teseo assumes circular orbits in the same plane; real orbits are slightly elliptical and tilted, so a real mission differs by days or weeks.",
    straightNote:   "The straight-line comparison is a different model: constant speed, no gravity. It only compares scales.",
    accuracyNote:   "Using NASA/JPL positions does not make the whole simulation exact: the map is schematic and every model has its own assumptions.",
    sources:        "Sources",
    disclaimer:     "Orbital mechanics: hapsira. Positions and distances: NASA JPL Horizons.",

    // Glosario (explicaciones al tocar)
    terms: {
      hohmann: "The cheapest route between two planets: half an ellipse around the Sun that touches both orbits. It takes a while, but it burns the least fuel.",
      dv:      "Delta-v: how much the ship must change its speed in total. It is the real “cost” of a space trip: more Δv means more fuel.",
      au:      "Astronomical unit: the average Earth–Sun distance, about 150 million km.",
      synodic: "The time it takes two planets to return to the same relative position. That is why launch windows repeat.",
      phase:   "The angle between the two planets as seen from the Sun. The transfer only works when that angle is just right at departure.",
      axis:    "Half the long diameter of the ellipse the ship follows. It sets how long the trip takes.",
    },

    // Aviso único
    noticeTitle:    "Some live data did not arrive.",
    noticeBody:     "Meanwhile you see the same physics computed on your device, with estimated positions.",
    retry:          "Retry",

    // Ventanas
    winNext:        (a, b) => `Next window to leave ${a} for ${b}`,
    winIn:          "In",
    winToday:       "Today",
    winTodaySub:    "The window is open right now",
    winDeparture:   "Departure",
    winArrival:     "Arrival",
    winTrip:        (d) => `${d} days of travel`,
    winLater:       "After that",
    winLaterIn:     (txt) => `in ${txt}`,
    winWhyTitle:    "Why wait?",
    winWhy:         (phase, syn, synY) => [
      "A ship does not aim at where the planet is, but at where it will be on arrival. That only works when the two planets are at the right ",
      ["phase", "angle"], ` (${phase}°). Teseo finds the dates when their real positions reach that angle. It repeats roughly every ${syn} days (${synY} years), the `,
      ["synodic", "synodic period"], ".",
    ],
    winCaveat:      "Flight time and Δv assume circular, coplanar orbits: the ideal date of a real mission can differ by days or weeks.",
    winLocal:       "Computed on your device with approximate ephemerides.",
    computing:      "Finding the next alignments…",
    loadingSky:     "Loading the 3D sky…",

    // Pie y créditos
    madeBy:         "Made by Yachay Deep Labs",
    creditsLink:    "Credits and data",
    creditsTitle:   "Credits and data sources",
    creditsIntro:   "Teseo uses real data from official sources. MIT-licensed code.",
    creditsNote:    "Distances to deep-sky objects and pulsars are published values with uncertainty; they are shown as approximations.",
    close:          "Close",
    credits: [
      ["Stars and distances", "HYG Database v4.1 (Hipparcos) · CC BY-SA"],
      ["Constellations", "Stellarium western/modern · IAU · CC BY-SA"],
      ["Clusters, nebulae and galaxies", "OpenNGC (Messier/NGC) · CC BY-SA"],
      ["Galaxy distances", "from redshift (Hubble's law, approx.)"],
      ["Pulsars", "ATNF Pulsar Catalogue (CSIRO)"],
      ["Black holes", "Published values (selection)"],
      ["Planet positions", "NASA JPL Horizons + ephemerides"],
      ["Comets and probes (live)", "NASA JPL Horizons"],
      ["Exoplanets", "NASA Exoplanet Archive"],
      ["Planetary textures", "Solar System Scope (CC BY 4.0), NASA"],
      ["Fact sheets and images", "Wikipedia · CC BY-SA"],
      ["Narrative", "Groq (Llama models)"],
      ["3D rendering", "Three.js · MIT"],
    ],
  },
  es: {
    tagline:        "Navegación interplanetaria",
    youAreHere:     "Estás aquí.",
    whereToGo:      "¿A dónde quieres ir?",
    skip:           "Saltar",
    skipIntro:      "Saltar la introducción",
    switchLang:     "Switch to English",
    sections:       "Secciones",
    origin:         "Origen",
    destination:    "Destino",
    choose:         (label, name) => `${label}: ${name}. Cambiar`,
    swap:           "Intercambiar origen y destino",
    route:          "Ruta",
    windows:        "Ventanas",
    sky:            "Cielo",
    scale:          "Escala",
    au:             "UA",
    days:           "días",

    mapLabel:       "Mapa del sistema solar hoy. Toca un planeta para viajar hacia él.",
    mapPick:        (name) => `Viajar a ${name}`,
    mapIsOrigin:    (name) => `${name}, tu origen. Toca para intercambiarlo con el destino`,
    mapIsDest:      (name) => `${name}, tu destino`,
    mapNasa:        "Posiciones de hoy: NASA JPL",
    mapLocal:       "Posiciones de hoy: cálculo local aproximado",
    mapLoading:     "Cargando posiciones reales…",
    mapNote:        "Toca un planeta para ir allí. Tamaños y distancias no están a escala; el hilo es esquemático.",
    sun:            "Sol",

    answerQ:        (dest) => `¿Cuánto tardarías en llegar a ${dest}?`,
    about:          "Cerca de",
    unitMonth:      (n) => (n === 1 ? "mes" : "meses"),
    unitYear:       (n) => (n === 1 ? "año" : "años"),
    unitDay:        (n) => (n === 1 ? "día" : "días"),
    half:           " y medio",
    answerSub:      (days) => <>{days} días de viaje por la ruta que menos combustible gasta, una </>,
    hohmannTerm:    "transferencia de Hohmann",
    leaveToday:     "Si salieras hoy",
    youdArrive:     "Llegarías el",
    whenToLeave:    "Una misión real espera a que los planetas se alineen.",
    seeWindows:     "Ver las mejores fechas para salir",
    confirming:     "Confirmando con el servidor…",
    narrativeBy:    "Narrado por IA a partir de los números de arriba. La IA narra; nunca calcula.",

    compareTitle:   "¿Y en línea recta?",
    compareTag:     "Solo por jugar",
    compareIntro:   (a, b, dist) => <>Hoy {a} y {b} están a <strong>{dist}</strong>. Esto tardarías en recorrer esa distancia a velocidad constante y sin gravedad. Ninguna nave viaja así.</>,
    compareScale:   "El largo de las barras usa escala logarítmica.",
    light:          "La luz",
    voyager:        "Voyager 1",
    rocket:         "Cohete Apollo",
    plane:          "Avión comercial",
    million:        "millones de",
    billion:        "mil millones de",
    tSec:           (n) => (n === 1 ? "segundo" : "segundos"),
    tMin:           "minutos",
    tHour:          "horas",

    techTitle:      "¿Cómo se calcula?",
    techTransfer:   "Duración de la transferencia",
    techDv:         "Δv total",
    techDvSplit:    (a, b) => `salida ${a} + llegada ${b}`,
    techAxis:       "Semieje mayor de la órbita de transferencia",
    techRadii:      "Radios orbitales (modelo circular)",
    techDist:       "Distancia hoy",
    techSource:     "Calculado por",
    srcServer:      "servidor de Teseo (hapsira)",
    srcLocal:       "tu dispositivo (misma fórmula de Hohmann)",
    srcNasa:        "NASA JPL Horizons",
    srcApprox:      "cálculo local aproximado",
    assumptions:    "Supuestos",
    modelNote:      "La transferencia de Hohmann es la ruta de mínima energía entre dos órbitas. Teseo supone órbitas circulares y en el mismo plano; las reales son algo elípticas e inclinadas, así que una misión real difiere en días o semanas.",
    straightNote:   "La comparación en línea recta es otro modelo: velocidad constante y sin gravedad. Solo sirve para comparar escalas.",
    accuracyNote:   "Usar posiciones de NASA/JPL no hace exacta toda la simulación: el mapa es esquemático y cada modelo tiene sus propios supuestos.",
    sources:        "Fuentes",
    disclaimer:     "Mecánica orbital: hapsira. Posiciones y distancias: NASA JPL Horizons.",

    terms: {
      hohmann: "La ruta más barata entre dos planetas: media elipse alrededor del Sol que toca las dos órbitas. Tarda, pero es la que menos combustible gasta.",
      dv:      "Delta-v: cuánto debe cambiar la nave su velocidad en total. Es el “costo” real de un viaje espacial: más Δv significa más combustible.",
      au:      "Unidad astronómica: la distancia media entre la Tierra y el Sol, unos 150 millones de km.",
      synodic: "El tiempo que tardan dos planetas en volver a la misma posición relativa. Por eso las ventanas de lanzamiento se repiten.",
      phase:   "El ángulo entre los dos planetas visto desde el Sol. La transferencia solo funciona si ese ángulo es el justo al salir.",
      axis:    "La mitad del diámetro largo de la elipse que recorre la nave. De él depende cuánto dura el viaje.",
    },

    noticeTitle:    "No llegaron todos los datos en vivo.",
    noticeBody:     "Mientras tanto ves la misma física calculada en tu dispositivo, con posiciones aproximadas.",
    retry:          "Reintentar",

    winNext:        (a, b) => `Próxima ventana para salir de ${a} hacia ${b}`,
    winIn:          "Faltan",
    winIn1:         "Falta",
    winToday:       "Hoy",
    winTodaySub:    "La ventana está abierta ahora mismo",
    winDeparture:   "Salida",
    winArrival:     "Llegada",
    winTrip:        (d) => `${d} días de viaje`,
    winLater:       "Las siguientes",
    winLaterIn:     (txt) => `en ${txt}`,
    winWhyTitle:    "¿Por qué hay que esperar?",
    winWhy:         (phase, syn, synY) => [
      "Una nave no apunta a donde está el planeta, sino a donde estará cuando llegue. Eso solo funciona cuando los dos planetas forman el ",
      ["phase", "ángulo de fase"], ` justo (${phase}°). Teseo busca las fechas en que sus posiciones reales cumplen ese ángulo. Se repite más o menos cada ${syn} días (${synY} años), el `,
      ["synodic", "período sinódico"], ".",
    ],
    winCaveat:      "El tiempo de vuelo y el Δv suponen órbitas circulares y coplanares: la fecha ideal de una misión real puede variar días o semanas.",
    winLocal:       "Calculado en tu dispositivo con efemérides aproximadas.",
    computing:      "Buscando las próximas alineaciones…",
    loadingSky:     "Cargando el cielo en 3D…",

    madeBy:         "Desarrollado por Yachay Deep Labs",
    creditsLink:    "Créditos y datos",
    creditsTitle:   "Créditos y fuentes de datos",
    creditsIntro:   "Teseo usa datos reales de fuentes oficiales. Código con licencia MIT.",
    creditsNote:    "Las distancias de objetos lejanos y púlsares son valores publicados con incertidumbre; se muestran como aproximaciones.",
    close:          "Cerrar",
    credits: [
      ["Estrellas y distancias", "HYG Database v4.1 (Hipparcos) · CC BY-SA"],
      ["Constelaciones", "Stellarium western/modern · IAU · CC BY-SA"],
      ["Cúmulos, nebulosas y galaxias", "OpenNGC (Messier/NGC) · CC BY-SA"],
      ["Distancia de galaxias", "por redshift (ley de Hubble, aprox.)"],
      ["Púlsares", "ATNF Pulsar Catalogue (CSIRO)"],
      ["Agujeros negros", "Valores publicados (selección)"],
      ["Posición de planetas", "NASA JPL Horizons + efemérides"],
      ["Cometas y sondas (en vivo)", "NASA JPL Horizons"],
      ["Exoplanetas", "NASA Exoplanet Archive"],
      ["Texturas planetarias", "Solar System Scope (CC BY 4.0), NASA"],
      ["Fichas e imágenes", "Wikipedia · CC BY-SA"],
      ["Narrativa", "Groq (modelos Llama)"],
      ["Render 3D", "Three.js · MIT"],
    ],
  },
};

// ─── DATA ────────────────────────────────────────────────────────────────────

// `size`: diámetro en el mapa (% del ancho). No está a escala: solo ordena.
const PLANETS = [
  { id:"mercury", en:"Mercury",  es:"Mercurio", color:"#B8B3AC", au:0.387,  size:4.6 },
  { id:"venus",   en:"Venus",    es:"Venus",    color:"#E9C27A", au:0.723,  size:5.8 },
  { id:"earth",   en:"Earth",    es:"Tierra",   color:"#5AA2F5", au:1.000,  size:6.2, esArt:"la Tierra" },
  { id:"mars",    en:"Mars",     es:"Marte",    color:"#E0683C", au:1.524,  size:5.2 },
  { id:"jupiter", en:"Jupiter",  es:"Júpiter",  color:"#D9A066", au:5.203,  size:9.0 },
  { id:"saturn",  en:"Saturn",   es:"Saturno",  color:"#DDBE82", au:9.537,  size:9.4 },
  { id:"uranus",  en:"Uranus",   es:"Urano",    color:"#8FDCE3", au:19.191, size:7.0 },
  { id:"neptune", en:"Neptune",  es:"Neptuno",  color:"#6E8DF2", au:30.069, size:6.8 },
];

const VEHICLES = [
  { id:"light",   km_s:299792, Icon:IconLight,  speed:[299792, "km/s"] },
  { id:"voyager", km_s:17.06,  Icon:IconProbe,  speed:[61400, "km/h"] },
  { id:"rocket",  km_s:11.2,   Icon:IconRocket, speed:[40300, "km/h"] },
  { id:"plane",   km_s:0.25,   Icon:IconPlane,  speed:[900, "km/h"] },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const loc = lang => (lang === "es" ? "es-EC" : "en-US");
const nf = (x, lang, max = 0, min = 0) =>
  Number(x).toLocaleString(lang === "es" ? "es" : "en-US", { maximumFractionDigits: max, minimumFractionDigits: min });

function pname(p, lang) { return lang === "es" ? p.es : p.en; }
// Con artículo cuando el español lo pide ("a la Tierra", "de la Tierra")
function pnameArt(p, lang) { return lang === "es" ? (p.esArt || p.es) : p.en; }

// El backend manda fechas ISO en UTC sin sufijo; sin la "Z" el navegador las
// leería como hora local y el día podría bailar.
function parseISO(s) {
  if (s instanceof Date) return s;
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}
function fmtDate(d, lang, style = "long") {
  const opts = style === "long"
    ? { day: "numeric", month: "long", year: "numeric" }
    : style === "weekday"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" };
  return parseISO(d).toLocaleDateString(loc(lang), { ...opts, timeZone: "UTC" });
}
// Días de calendario (UTC) que faltan hasta una fecha
function daysUntil(d, now = Date.now()) {
  return Math.max(0, Math.floor(+parseISO(d) / DAY_MS) - Math.floor(now / DAY_MS));
}

// Duración en lenguaje humano: "8 meses y medio" / "8½ months"
function humanDuration(days, lang) {
  const t = T[lang];
  const build = (n, half, unitFn) => {
    const plural = lang === "es" ? n !== 1 : (n !== 1 || half);
    const unit = unitFn(plural ? 2 : 1);
    return lang === "es" ? `${n} ${unit}${half ? t.half : ""}` : `${n}${half ? t.half : ""} ${unit}`;
  };
  if (days < 45) return build(Math.max(1, Math.round(days)), false, t.unitDay);
  const months = days / 30.4375;
  if (months < 11.75) { const r = Math.round(months * 2) / 2; return build(Math.floor(r), r % 1 !== 0, t.unitMonth); }
  const years = days / 365.25;
  if (years < 10) { const r = Math.round(years * 2) / 2; return build(Math.floor(r), r % 1 !== 0, t.unitYear); }
  return build(Math.round(years), false, t.unitYear);
}

// Tiempo de un trayecto a velocidad constante, en palabras
function fmt(sec, lang) {
  const t = T[lang];
  if (sec < 60)        { const n = Math.round(sec); return `${n} ${t.tSec(n)}`; }
  if (sec < 3600)      return `${nf(sec / 60, lang, 1)} ${t.tMin}`;
  if (sec < 86400)     return `${nf(sec / 3600, lang, 1)} ${t.tHour}`;
  if (sec < 86400 * 365) { const n = Math.round(sec / 86400); return `${nf(n, lang)} ${t.unitDay(n)}`; }
  const y = sec / (86400 * 365.25);
  return `${nf(y, lang, y < 100 ? 1 : 0)} ${t.unitYear(2)}`;
}

function fmtDistance(km, lang) {
  const t = T[lang];
  const m = km / 1e6;
  if (m >= 1000) return lang === "es" ? `${nf(m, lang)} ${t.million} km` : `${nf(m / 1000, lang, 2)} ${t.billion} km`;
  return `${nf(m, lang, m < 100 ? 1 : 0)} ${t.million} km`;
}

// Idioma: preferencia guardada > idioma del navegador > español (coherente con <html lang="es">)
function initialLang() {
  try {
    const saved = localStorage.getItem("teseo-lang");
    if (saved === "es" || saved === "en") return saved;
  } catch { /* no-op */ }
  try {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    if (/^en\b/i.test(nav)) return "en";
  } catch { /* no-op */ }
  return "es";
}

const reducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

const META = {
  es: {
    title: "Teseo — Navegación Interplanetaria",
    description: "Navegación interplanetaria real: transferencias de Hohmann, ventanas de lanzamiento y posiciones planetarias en vivo con datos de NASA JPL.",
    locale: "es_EC",
  },
  en: {
    title: "Teseo — Interplanetary Navigation",
    description: "Real interplanetary navigation: Hohmann transfers, launch windows and live planetary positions with NASA JPL data.",
    locale: "en_US",
  },
};

// Sincroniza <html lang>, título y metadatos (description/og/twitter) con el idioma activo
function applyLangToDocument(lang) {
  if (typeof document === "undefined") return;
  const m = META[lang] || META.es;
  document.documentElement.lang = lang;
  document.title = m.title;
  const set = (sel, val) => { const el = document.head.querySelector(sel); if (el) el.setAttribute("content", val); };
  set('meta[name="description"]', m.description);
  set('meta[property="og:title"]', m.title);
  set('meta[property="og:description"]', m.description);
  set('meta[property="og:locale"]', m.locale);
  set('meta[name="twitter:title"]', m.title);
  set('meta[name="twitter:description"]', m.description);
}

// ─── SPACE TRAVEL BACKGROUND ─────────────────────────────────────────────────

function SpaceTravel() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let w, h, cx, cy, raf;
    const COUNT = 150;         // densidad media: se nota pero sin "warp"
    const stars = [];
    const COLORS = ["#ffffff", "#cfe0ff", "#ffe9c7", "#e7d4ff", "#bcd4ff"];
    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      cx = w / 2; cy = h / 2;
    }
    function reset(s, spread) {
      s.x = (Math.random() - 0.5) * w * 1.6;
      s.y = (Math.random() - 0.5) * h * 1.6;
      // mantenerlas lejanas: nunca se acercan demasiado (sin estelas de "warp")
      s.z = spread ? (0.35 + Math.random() * 0.65) * w : w;
      s.pz = s.z;
      s.c = COLORS[(Math.random() * COLORS.length) | 0];
      s.tw = Math.random() * Math.PI * 2;
    }
    resize();
    for (let i = 0; i < COUNT; i++) { const s = {}; reset(s, true); stars.push(s); }
    const SPEED = 0.5;         // lento, perceptible
    const NEAR = 0.16;         // dejan acercarse un poco más (más visibles)
    const still = reducedMotion();   // sin animación: se pinta un cielo fijo
    function frame() {
      if (!still) raf = requestAnimationFrame(frame);
      ctx.fillStyle = "rgba(4,8,15,0.5)";
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        s.pz = s.z;
        s.z -= SPEED;
        if (s.z < NEAR * w) { reset(s, false); continue; }
        const k = 200;
        const sx = cx + (s.x / s.z) * k;
        const sy = cy + (s.y / s.z) * k;
        const px = cx + (s.x / s.pz) * k;
        const py = cy + (s.y / s.pz) * k;
        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) { reset(s, false); continue; }
        const depth = 1 - s.z / w;           // 0 lejos -> ~0.66 cerca
        s.tw += 0.05;
        const r = Math.max(0.4, depth * 2.0);
        const o = Math.min(0.85, depth * 1.25) * (0.75 + 0.25 * Math.sin(s.tw));
        ctx.strokeStyle = s.c;
        ctx.globalAlpha = o;
        ctx.lineWidth = r;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    frame();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 w-full h-full pointer-events-none z-0" style={{ display: "block" }} />;
}

// ─── STAR FIELD ──────────────────────────────────────────────────────────────

function StarField() {
  const stars = Array.from({length:180},(_,i)=>({
    x:(i*137.508)%100, y:(i*97.314)%100,
    s:0.3+(i%5)*0.22, d:2+(i%4), dl:(i%7)*0.4,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {stars.map((s,i)=>(
        <div key={i} className="absolute rounded-full bg-white" style={{
          left:`${s.x}%`, top:`${s.y}%`,
          width:s.s, height:s.s, opacity:0.35,
          animation:`twinkle ${s.d}s ${s.dl}s ease-in-out infinite alternate`,
        }}/>
      ))}
    </div>
  );
}
// ─── INTRO ───────────────────────────────────────────────────────────────────
// Se puede saltar tocando cualquier punto o con el botón "Saltar".

function Intro({ lang, onDone }) {
  const [phase, setPhase] = useState(0);
  const t = T[lang];

  useEffect(()=>{
    const delays = [700,2000,1800,1800,1600];
    let timer;
    const next = i => { timer=setTimeout(()=>{ setPhase(i+1); if(i+1<delays.length) next(i+1); else timer=setTimeout(onDone,500); },delays[i]); };
    next(0);
    return ()=>clearTimeout(timer);
  },[onDone]);

  useEffect(()=>{
    const onKey = e => { if (e.key === "Escape") onDone(); };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#04080F]"
      onClick={onDone}
      style={{opacity:phase>=5?0:1, transition:"opacity 0.7s"}}>
      <StarField/>

      {/* Phase 1 — You are here */}
      {phase>=1&&phase<3&&(
        <div className="text-center" style={{animation:"fadeIn 0.8s ease-out"}}>
          <div className="relative w-5 h-5 mx-auto mb-6">
            <div className="w-5 h-5 rounded-full bg-blue-400 mx-auto"
              style={{boxShadow:"0 0 20px #60A5FA,0 0 50px #3B82F660",animation:"pulse-glow 2s ease-in-out infinite"}}/>
            <div className="absolute inset-0 rounded-full bg-blue-300"
              style={{animation:"ping 2s ease-out infinite",opacity:0}}/>
          </div>
          <p className="intro__line">{t.youAreHere}</p>
        </div>
      )}

      {/* Phase 2 — Solar system */}
      {phase>=2&&phase<4&&(
        <div className="absolute inset-0 flex items-center justify-center"
          style={{animation:"fadeIn 0.6s ease-out",
            transform:phase>=3?"scale(0.35)":"scale(1)",
            transition:"transform 1.8s cubic-bezier(0.4,0,0.2,1)"}}>
          <svg viewBox="0 0 100 100" className="w-60 h-60 opacity-60" aria-hidden="true">
            {PLANETS.map((p,i)=>{
              const r=Math.min((Math.log1p(p.au)/Math.log1p(32))*44,44);
              const a=((i*53)%360)*Math.PI/180;
              return (
                <g key={p.id}>
                  <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.3"/>
                  <circle cx={50+r*Math.cos(a)} cy={50+r*Math.sin(a)} r={0.9} fill={p.color} opacity={0.7}/>
                </g>
              );
            })}
            <circle cx={50} cy={50} r={2.2} fill="#FCD34D" style={{filter:"drop-shadow(0 0 4px #FCD34D)"}}/>
          </svg>
        </div>
      )}

      {/* Phase 3 — Galaxy */}
      {phase>=3&&phase<5&&(
        <div className="absolute inset-0 flex items-center justify-center"
          style={{animation:"fadeIn 0.7s ease-out",
            transform:phase>=4?"scale(0.25)":"scale(1)",
            transition:"transform 1.8s cubic-bezier(0.4,0,0.2,1)"}}>
          <svg viewBox="0 0 200 200" className="w-72 h-72 opacity-40" aria-hidden="true">
            {[0,36,72,108,144].map(deg=>(
              <ellipse key={deg} cx={100} cy={100} rx={85} ry={16} fill="none"
                stroke="rgba(167,139,250,0.25)" strokeWidth="12"
                transform={`rotate(${deg},100,100)`}/>
            ))}
            <ellipse cx={100} cy={100} rx={20} ry={12} fill="rgba(253,224,71,0.12)"/>
            <circle cx={100} cy={100} r={4} fill="#FEF08A" opacity={0.7}/>
            <circle cx={128} cy={93} r={2} fill="#60A5FA" style={{filter:"drop-shadow(0 0 3px #60A5FA)"}}/>
          </svg>
        </div>
      )}

      {/* Phase 4 — Teseo title */}
      {phase>=4&&(
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
          style={{animation:"fadeInSlow 1.2s ease-out"}}>
          <p className="wordmark" style={{fontSize:60}}>Teseo</p>
          <p className="intro__line mt-4">{t.whereToGo}</p>
        </div>
      )}

      <button type="button" className="intro__skip" aria-label={t.skipIntro}
        onClick={e=>{ e.stopPropagation(); onDone(); }}>
        {t.skip}
      </button>
    </div>
  );
}

// ─── TÉRMINO CON EXPLICACIÓN ─────────────────────────────────────────────────
// Un término técnico subrayado: al tocarlo despliega una explicación corta.

function Term({ k, lang, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button type="button" className="term" aria-expanded={open} aria-controls={id}
        onClick={()=>setOpen(o=>!o)}>{children}</button>
      {open && <span id={id} role="note" className="term__note">{T[lang].terms[k]}</span>}
    </>
  );
}

// ─── MAPA DEL SISTEMA SOLAR ──────────────────────────────────────────────────
// Órbitas equiespaciadas (no a escala) para que los ocho planetas se vean y se
// puedan tocar; el ángulo de cada planeta sí es el real de hoy.

const TAU = Math.PI * 2;
const ORBIT_R = i => 9.6 + i * 5.1;          // radio de cada órbita, en % del mapa
const SUN_SIZE = 10;

function useWidth(ref, fallback) {
  const [w, setW] = useState(fallback);
  useEffect(()=>{
    const el = ref.current;
    if (!el) return;
    const measure = () => { const x = el.getBoundingClientRect().width; if (x > 0) setW(x); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return ()=>ro.disconnect();
  },[ref]);
  return w;
}

// Coloca cada etiqueta donde no pise planetas ni otras etiquetas (px)
function layoutLabels(pts, w, names, activeIds) {
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const obstacles = [];
  const sunR = (w * SUN_SIZE) / 200;
  obstacles.push({ x: w / 2 - sunR, y: w / 2 - sunR, w: sunR * 2, h: sunR * 2 });
  for (const q of pts) {
    const r = (w * q.p.size) / 200 + 1;
    obstacles.push({ x: (q.x * w) / 100 - r, y: (q.y * w) / 100 - r, w: r * 2, h: r * 2 });
  }
  const order = [...pts].sort((a, b) => (activeIds.includes(b.p.id) ? 1 : 0) - (activeIds.includes(a.p.id) ? 1 : 0));
  const out = {};
  for (const q of order) {
    const cx = (q.x * w) / 100, cy = (q.y * w) / 100;
    const r = (w * q.p.size) / 200 + (q.p.id === "saturn" ? 3 : 0);
    const lw = names[q.p.id].length * 7 + 6, lh = 17;
    const cands = [
      { x: cx - lw / 2, y: cy + r + 4 },
      { x: cx - lw / 2, y: cy - r - 4 - lh },
      { x: cx + r + 6, y: cy - lh / 2 },
      { x: cx - r - 6 - lw, y: cy - lh / 2 },
      { x: cx + r * 0.7 + 3, y: cy + r * 0.7 },
      { x: cx - r * 0.7 - 3 - lw, y: cy - r * 0.7 - lh },
    ];
    let best = null;
    for (const c of cands) {
      const box = { ...c, w: lw, h: lh };
      if (box.x < 0 || box.y < 0 || box.x + lw > w || box.y + lh > w) continue;
      if (obstacles.some(o => hit(box, o))) continue;
      best = box; break;
    }
    if (!best) {
      const c = cands[0];
      best = { x: Math.min(Math.max(c.x, 0), w - lw), y: Math.min(c.y, w - lh), w: lw, h: lh };
    }
    obstacles.push(best);
    out[q.p.id] = { dx: best.x - cx, dy: best.y - cy };
  }
  return out;
}

function SolarMap({ from, to, positions, lang, onPick }) {
  const ref = useRef(null);
  const w = useWidth(ref, 340);
  const t = T[lang];

  const pts = useMemo(()=>PLANETS.map((p,i)=>{
    const pos = positions[p.id];
    const a = Math.atan2(pos.y_au, pos.x_au);
    const r = ORBIT_R(i);
    return { p, a, r, x: 50 + r * Math.cos(a), y: 50 - r * Math.sin(a) };
  }),[positions]);

  const names = useMemo(()=>Object.fromEntries(PLANETS.map(p=>[p.id, pname(p, lang)])),[lang]);
  const labels = useMemo(()=>layoutLabels(pts, w, names, [from.id, to.id]),[pts, w, names, from.id, to.id]);

  // El hilo de Ariadna: sale tangente a la órbita de origen, gira en el sentido
  // en que giran los planetas y llega tangente a la de destino. Es esquemático.
  const thread = useMemo(()=>{
    const A = pts.find(q=>q.p.id===from.id), B = pts.find(q=>q.p.id===to.id);
    const sweep = (((B.a - A.a) % TAU) + TAU) % TAU;
    const N = 72;
    let d = "";
    for (let k = 0; k <= N; k++) {
      const s = k / N;
      const a = A.a + sweep * s;
      const r = A.r + (B.r - A.r) * (1 - Math.cos(Math.PI * s)) / 2;
      d += `${k ? "L" : "M"}${(50 + r * Math.cos(a)).toFixed(2)} ${(50 - r * Math.sin(a)).toFixed(2)}`;
    }
    return d;
  },[pts, from.id, to.id]);

  return (
    <div ref={ref} className="map" role="group" aria-label={t.mapLabel}>
      <svg viewBox="0 0 100 100" className="map__svg" aria-hidden="true">
        <defs>
          <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#FDBA3B" stopOpacity="0.16"/>
            <stop offset="0.35" stopColor="#7C3AED" stopOpacity="0.07"/>
            <stop offset="1" stopColor="#7C3AED" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="thread-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
            <stop offset="0" stopColor="#FFE9B0"/>
            <stop offset="1" stopColor="#F0B95A"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#map-glow)"/>
        {PLANETS.map((p,i)=>{
          const sel = p.id===from.id || p.id===to.id;
          return <circle key={p.id} cx="50" cy="50" r={ORBIT_R(i)} fill="none"
            stroke={sel ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.13)"}
            strokeWidth={sel ? 0.34 : 0.22}/>;
        })}
        <g key={`${from.id}-${to.id}`}>
          <path d={thread} className="thread thread--glow" pathLength="1"/>
          <path d={thread} className="thread" pathLength="1" stroke="url(#thread-grad)"/>
        </g>
      </svg>

      <span className="map__sun" title={t.sun}>
        <PlanetSphere id="sun" size={(w * SUN_SIZE) / 100}/>
      </span>

      {pts.map(q=>{
        const { p } = q;
        const isF = p.id===from.id, isT = p.id===to.id;
        const px = Math.max(10, (w * p.size) / 100);
        const lab = labels[p.id];
        const name = names[p.id];
        return (
          <button key={p.id} type="button"
            className={`map__planet ${isF ? "is-origin" : ""} ${isT ? "is-dest" : ""}`}
            style={{ left: `${q.x}%`, top: `${q.y}%`, zIndex: isF || isT ? 3 : 2 }}
            aria-label={isF ? t.mapIsOrigin(name) : isT ? t.mapIsDest(name) : t.mapPick(name)}
            aria-current={isT ? "true" : undefined}
            onClick={()=>onPick(p)}>
            {(isF || isT) && <span className="map__halo" style={{ width: px + 12, height: px + 12 }}/>}
            <PlanetSphere id={p.id} size={px} light={Math.atan2(q.y - 50, 50 - q.x)}/>
            <span className="map__label" style={{ left: `calc(50% + ${lab.dx}px)`, top: `calc(50% + ${lab.dy}px)` }}>{name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── SELECTOR DE PLANETA ─────────────────────────────────────────────────────

function PlanetSelect({ value, onChange, exclude, label, kind, lang, align = "left" }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const listId = useId();
  const t = T[lang];
  const available = PLANETS.filter(p=>p.id!==exclude?.id);

  useEffect(()=>{
    if (!open) return;
    const onDown = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return ()=>{ document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  },[open]);

  return (
    <div ref={wrap} className={`pick pick--${kind}`}>
      <button type="button" className="pick__btn" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={t.choose(label, pname(value, lang))}
        onClick={()=>setOpen(o=>!o)}>
        <PlanetSphere id={value.id} size={36}/>
        <span className="pick__text">
          <span className="pick__label">{label}
            <IconChevron className={`pick__chev ${open ? "is-open" : ""}`} width={15} height={15}/>
          </span>
          <span className="pick__name">{pname(value, lang)}</span>
        </span>
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className={`pick__list pick__list--${align}`}>
          {available.map(p=>(
            <li key={p.id} role="option" aria-selected={p.id===value.id}>
              <button type="button" className={`pick__opt ${p.id===value.id ? "is-current" : ""}`}
                onClick={()=>{ onChange(p); setOpen(false); }}>
                <PlanetSphere id={p.id} size={28} spin={false}/>
                <span className="pick__optname">{pname(p, lang)}</span>
                <span className="pick__au">{nf(p.au, lang, 2)} {t.au}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── AVISO ÚNICO DE DATOS EN VIVO ────────────────────────────────────────────
// Un solo aviso discreto (no una pila de alertas): la app sigue mostrando la
// física calculada en local y ofrece reintentar lo que haya fallado.

function LiveDataNotice({ lang, onRetry }) {
  const t = T[lang];
  return (
    <div role="status" className="notice">
      <IconInfo className="notice__icon" width={20} height={20}/>
      <p className="notice__text"><strong>{t.noticeTitle}</strong> {t.noticeBody}</p>
      <button type="button" className="btn btn--ghost notice__btn" onClick={onRetry}>
        <IconRetry width={16} height={16}/>{t.retry}
      </button>
    </div>
  );
}

// ─── RESPUESTA DE RUTA ───────────────────────────────────────────────────────

function RouteAnswer({ from, to, lang, route, loading, onSeeWindows }) {
  const t = T[lang];
  const days = route.transfer_time_days;
  const today = new Date();
  const arrival = new Date(+today + days * DAY_MS);

  return (
    <section className="answer" aria-labelledby="answer-q">
      <div className="answer__trip" aria-hidden="true">
        <PlanetSphere id={from.id} size={44}/>
        <span className="answer__thread"/>
        <PlanetSphere id={to.id} size={68}/>
      </div>
      <h2 id="answer-q" className="answer__q">{t.answerQ(pnameArt(to, lang))}</h2>
      <p className="answer__big">
        <span className="answer__about">{t.about}</span>
        <span className="answer__value">{humanDuration(days, lang)}</span>
      </p>
      <p className="answer__sub">
        {t.answerSub(nf(days, lang, 0))}
        <Term k="hohmann" lang={lang}>{t.hohmannTerm}</Term>.
      </p>

      <dl className="dates">
        <div className="dates__cell">
          <dt>{t.leaveToday}</dt>
          <dd>{fmtDate(today, lang, "short")}</dd>
        </div>
        <IconArrow className="dates__arrow" width={20} height={20}/>
        <div className="dates__cell">
          <dt>{t.youdArrive}</dt>
          <dd>{fmtDate(arrival, lang, "short")}</dd>
        </div>
      </dl>

      <p className="answer__cta">
        <span>{t.whenToLeave}</span>
        <button type="button" className="btn btn--primary" onClick={onSeeWindows}>
          <IconWindows width={18} height={18}/>{t.seeWindows}
        </button>
      </p>
      {loading && <p role="status" className="answer__status">{t.confirming}</p>}
    </section>
  );
}

// ─── COMPARADOR DE VEHÍCULOS (ilustrativo) ───────────────────────────────────

function VehicleCompare({ from, to, lang, distKm }) {
  const t = T[lang];
  const rows = VEHICLES.map(v=>({ ...v, sec: distKm / v.km_s }));
  const lo = Math.log10(rows[0].sec), hi = Math.log10(rows[rows.length - 1].sec);
  return (
    <section className="card" aria-labelledby="compare-h">
      <div className="card__head">
        <h3 id="compare-h" className="card__title">{t.compareTitle}</h3>
        <span className="tag">{t.compareTag}</span>
      </div>
      <p className="card__lead">
        {t.compareIntro(pnameArt(from, lang), pnameArt(to, lang), fmtDistance(distKm, lang))}
      </p>
      <ul className="vehicles">
        {rows.map(v=>{
          const frac = hi > lo ? (Math.log10(v.sec) - lo) / (hi - lo) : 0;
          return (
            <li key={v.id} className="vehicle">
              <span className="vehicle__icon"><v.Icon width={20} height={20}/></span>
              <span className="vehicle__name">
                {t[v.id]}
                <span className="vehicle__speed">{nf(v.speed[0], lang)} {v.speed[1]}</span>
              </span>
              <span className="vehicle__time">{fmt(v.sec, lang)}</span>
              <span className="vehicle__bar" aria-hidden="true"><span style={{ width: `${5 + frac * 95}%` }}/></span>
            </li>
          );
        })}
      </ul>
      <p className="fine">{t.compareScale}</p>
    </section>
  );
}

// ─── DETALLES TÉCNICOS (desplegable) ─────────────────────────────────────────

function TechDetails({ lang, route, distKm, distReal }) {
  const t = T[lang];
  const kms = x => `${nf(x, lang, 3, 3)} km/s`;
  return (
    <details className="tech">
      <summary className="tech__summary">
        <span>{t.techTitle}</span>
        <IconChevron className="tech__chev" width={18} height={18}/>
      </summary>
      <div className="tech__body">
        <dl className="tech__grid">
          <div><dt>{t.techTransfer}</dt><dd>{nf(route.transfer_time_days, lang, 2)} {t.days}</dd></div>
          <div>
            <dt><Term k="dv" lang={lang}>{t.techDv}</Term></dt>
            <dd>{kms(route.delta_v_total_km_s)}
              <span className="tech__sub">{t.techDvSplit(kms(route.delta_v_departure_km_s), kms(route.delta_v_arrival_km_s))}</span>
            </dd>
          </div>
          <div>
            <dt><Term k="axis" lang={lang}>{t.techAxis}</Term></dt>
            <dd>{nf(route.transfer_semi_major_axis_au, lang, 4)} {t.au}</dd>
          </div>
          <div><dt>{t.techRadii}, <Term k="au" lang={lang}>{t.au}</Term></dt>
            <dd>{nf(route.origin_orbit_radius_au, lang, 3)} → {nf(route.destination_orbit_radius_au, lang, 3)}</dd></div>
          <div><dt>{t.techDist}</dt>
            <dd>{nf(distKm / 1e6, lang, 2)} M km
              <span className="tech__sub">{nf(distKm / AU_KM, lang, 3)} {t.au} · {distReal ? `${t.srcNasa} ✓` : t.srcApprox}</span>
            </dd></div>
          <div><dt>{t.techSource}</dt><dd className="tech__plain">{route.local ? t.srcLocal : t.srcServer}</dd></div>
        </dl>
        <h4 className="tech__h">{t.assumptions}</h4>
        <p>{t.modelNote}</p>
        <p>{t.straightNote}</p>
        <p>{t.accuracyNote}</p>
        <h4 className="tech__h">{t.sources}</h4>
        <p>{t.disclaimer}</p>
      </div>
    </details>
  );
}

// ─── VENTANAS DE LANZAMIENTO ─────────────────────────────────────────────────

function relTime(days, lang) {
  const t = T[lang];
  if (days < 60) return `${nf(days, lang)} ${t.unitDay(days)}`;
  if (days < 700) { const m = Math.round(days / 30.4375); return `${m} ${t.unitMonth(m)}`; }
  return `${nf(days / 365.25, lang, 1)} ${t.unitYear(2)}`;
}

function LaunchWindows({ from, to, lang, attempt, onError, notice }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const t = T[lang];

  useEffect(()=>{
    setData(null); setError(false); onError(false);
    const ctrl = new AbortController();
    let alive = true;
    fetchJson(`${API}/api/launch-windows/${from.id}/${to.id}?count=4`,{signal:ctrl.signal})
      .then(d=>{
        if(!alive) return;
        if(d&&Array.isArray(d.windows)&&d.windows.length) setData(d);
        else { setError(true); onError(true); }
      })
      .catch(e=>{ if(alive&&!isAbort(e)) { setError(true); onError(true); } });
    return ()=>{ alive=false; ctrl.abort(); };
  },[from,to,attempt,onError]);

  // Sin servidor: mismo método (ángulo de fase) con efemérides locales aproximadas
  const local = useMemo(()=>error ? launchWindowsLocal(from.id, to.id, new Date(), 4) : null,[error, from.id, to.id]);
  const shown = data || local;

  if(!shown || !shown.windows.length) return (
    <p role="status" className="loading">{t.computing}</p>
  );

  const [next, ...later] = shown.windows;
  const left = daysUntil(next.departure_date);
  const A = pnameArt(from, lang), B = pnameArt(to, lang);
  const why = t.winWhy(nf(shown.required_phase_angle_deg, lang, 1), nf(shown.synodic_period_days, lang, 0), nf(shown.synodic_period_years, lang, 2));

  return (
    <div className="stack">
      <section className="countdown" aria-labelledby="win-next">
        <div className="countdown__sphere" aria-hidden="true"><PlanetSphere id={to.id} size={112}/></div>
        <h2 id="win-next" className="countdown__title">{t.winNext(A, B)}</h2>
        {left > 0 ? (
          <p className="countdown__big">
            <span className="countdown__pre">{left === 1 && t.winIn1 ? t.winIn1 : t.winIn}</span>
            <span className="countdown__num">{nf(left, lang)}</span>
            <span className="countdown__unit">{t.unitDay(left)}</span>
          </p>
        ) : (
          <p className="countdown__big"><span className="countdown__num">{t.winToday}</span>
            <span className="countdown__unit">{t.winTodaySub}</span></p>
        )}
        <p className="countdown__date">{fmtDate(next.departure_date, lang, "weekday")}</p>

        <dl className="dates dates--window">
          <div className="dates__cell"><dt>{t.winDeparture}</dt><dd>{fmtDate(next.departure_date, lang, "short")}</dd></div>
          <IconArrow className="dates__arrow" width={20} height={20}/>
          <div className="dates__cell"><dt>{t.winArrival}</dt><dd>{fmtDate(next.arrival_date, lang, "short")}</dd></div>
        </dl>
        <p className="countdown__meta">
          {t.winTrip(nf(next.transfer_time_days, lang, 0))} · <Term k="dv" lang={lang}>Δv</Term> {nf(next.delta_v_km_s, lang, 2)} km/s
        </p>
      </section>

      {notice}

      {later.length > 0 && (
        <section aria-labelledby="win-later">
          <h3 id="win-later" className="section-title">{t.winLater}</h3>
          <ol className="timeline">
            {later.map(w=>(
              <li key={w.departure_date} className="timeline__item">
                <p className="timeline__date">{fmtDate(w.departure_date, lang, "long")}</p>
                <p className="timeline__rel">{t.winLaterIn(relTime(daysUntil(w.departure_date), lang))}</p>
                <p className="timeline__meta">
                  {t.winArrival}: {fmtDate(w.arrival_date, lang, "short")} · {t.winTrip(nf(w.transfer_time_days, lang, 0))}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card" aria-labelledby="win-why">
        <h3 id="win-why" className="card__title">{t.winWhyTitle}</h3>
        <p className="card__lead">
          {why.map((part,i)=>Array.isArray(part)
            ? <Term key={i} k={part[0]} lang={lang}>{part[1]}</Term>
            : <span key={i}>{part}</span>)}
        </p>
        <p className="fine">{t.winCaveat}{shown.local ? ` ${t.winLocal}` : ""}</p>
      </section>
    </div>
  );
}

// ─── PESTAÑAS ────────────────────────────────────────────────────────────────

const TABS = [
  { id:"route",   Icon:IconRoute },
  { id:"windows", Icon:IconWindows },
  { id:"sky",     Icon:IconSky },
  { id:"scale",   Icon:IconScale },
];

function Tabs({ tab, onChange, lang }) {
  const t = T[lang];
  const refs = useRef({});
  const onKey = e => {
    const i = TABS.findIndex(x=>x.id===tab);
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = TABS.length - 1;
    if (j < 0) return;
    e.preventDefault();
    onChange(TABS[j].id);
    refs.current[TABS[j].id]?.focus();
  };
  return (
    <nav className="tabs" aria-label={t.sections}>
      <div className="tabs__inner" role="tablist" aria-label={t.sections} onKeyDown={onKey}>
        {TABS.map(({ id, Icon })=>(
          <button key={id} ref={el=>{ refs.current[id]=el; }} type="button" role="tab"
            id={`tab-${id}`} aria-selected={tab===id} aria-controls={`panel-${id}`}
            tabIndex={tab===id ? 0 : -1}
            className={`tabs__tab ${tab===id ? "is-active" : ""}`}
            onClick={()=>onChange(id)}>
            <Icon/>
            <span>{t[id]}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ─── CRÉDITOS ────────────────────────────────────────────────────────────────

function CreditsModal({ lang, onClose }) {
  const t = T[lang];
  const closeRef = useRef(null);
  useEffect(()=>{
    closeRef.current?.focus();
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return ()=>document.removeEventListener("keydown", onKey);
  },[onClose]);
  return (
    <div className="modal" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="credits-title" className="modal__box"
        onClick={e=>e.stopPropagation()}>
        <div className="modal__head">
          <h2 id="credits-title" className="modal__title">{t.creditsTitle}</h2>
          <button ref={closeRef} type="button" className="icon-btn" aria-label={t.close} onClick={onClose}>
            <IconClose width={20} height={20}/>
          </button>
        </div>
        <p className="modal__p">{t.creditsIntro}</p>
        <dl className="credits">
          {t.credits.map(([k,v])=>(
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <p className="modal__p modal__p--fine">{t.creditsNote}</p>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function Teseo() {
  const [intro,    setIntro]    = useState(true);
  const [showCredits, setShowCredits] = useState(false);
  const [lang,     setLang]     = useState(initialLang);
  useEffect(() => { applyLangToDocument(lang); try { localStorage.setItem("teseo-lang", lang); } catch { /* no-op */ } }, [lang]);
  const [from,     setFrom]     = useState(PLANETS[2]); // Earth
  const [to,       setTo]       = useState(PLANETS[3]); // Mars
  const [tab,      setTab]      = useState("route");
  // abrir en la pestaña Cielo si el enlace compartido lo indica (#sky...)
  useEffect(() => { try { if ((window.location.hash || "").startsWith("#sky")) setTab("sky"); } catch { /* no-op */ } }, []);
  const [backend,  setBackend]  = useState(null);
  const [loadingB, setLoadingB] = useState(false);
  const [realPos,  setRealPos]  = useState({});    // NASA real positions {id: {x_au,y_au,...}}
  const [realDist, setRealDist] = useState(null);  // km between from and to, real NASA data
  // Estado de cada petición + contador de reintentos (sube con "Reintentar")
  const [posStatus,  setPosStatus]  = useState("idle");   // idle | loading | ok | error
  const [posTry,     setPosTry]     = useState(0);
  const [distStatus, setDistStatus] = useState("idle");
  const [distTry,    setDistTry]    = useState(0);
  const [routeError, setRouteError] = useState(false);
  const [routeTry,   setRouteTry]   = useState(0);
  const [winError,   setWinError]   = useState(false);
  const [winTry,     setWinTry]     = useState(0);
  // Vista 3D: componente lazy recreable si falló la carga del chunk
  const [SkyView, setSkyView] = useState(()=>Constellations);
  const retrySky = useCallback(()=>setSkyView(()=>lazy(loadSky)),[]);

  const t = T[lang];
  const onDone = useCallback(()=>setIntro(false),[]);
  const closeCredits = useCallback(()=>setShowCredits(false),[]);

  // Al cambiar la selección se descartan los datos del par anterior
  useEffect(()=>{ setBackend(null); setRealDist(null); },[from,to]);

  // Fetch real planet positions from NASA Horizons via backend
  useEffect(()=>{
    if(!API) return;
    const today = new Date().toISOString().split("T")[0];
    const ctrl = new AbortController();
    let alive = true;
    setPosStatus("loading");
    Promise.all(PLANETS.map(p=>
      fetchJson(`${API}/api/position/${p.id}?date=${today}`,{signal:ctrl.signal})
        .catch(()=>null)
    )).then(results=>{
      if(!alive) return;
      const pos = {};
      results.forEach((r,i)=>{ if(r&&r.x_au!==undefined) pos[PLANETS[i].id]=r; });
      // conserva lo ya obtenido: un reintento solo añade/actualiza planetas
      setRealPos(prev=>({...prev,...pos}));
      setPosStatus(Object.keys(pos).length===PLANETS.length?"ok":"error");
    });
    return ()=>{ alive=false; ctrl.abort(); };
  },[posTry]);

  // Fetch real distance between selected bodies
  useEffect(()=>{
    if(!API||from.id===to.id) return;
    const today = new Date().toISOString().split("T")[0];
    const ctrl = new AbortController();
    let alive = true;
    setDistStatus("loading");
    fetchJson(`${API}/api/distance/${from.id}/${to.id}?date=${today}`,{signal:ctrl.signal})
      .then(d=>{
        if(!alive) return;
        if(d&&d.distance_km){ setRealDist(d.distance_km); setDistStatus("ok"); }
        else setDistStatus("error");
      })
      .catch(e=>{ if(alive&&!isAbort(e)) setDistStatus("error"); });
    return ()=>{ alive=false; ctrl.abort(); };
  },[from,to,distTry]);

  // Fetch Hohmann route from backend
  useEffect(()=>{
    if(!API||from.id===to.id) return;
    const ctrl = new AbortController();
    let alive = true;
    setLoadingB(true); setRouteError(false);
    const post = (include_narrative,timeout)=>fetchJson(`${API}/api/route`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({origin:from.id,destination:to.id,lang,include_narrative}),
      signal:ctrl.signal, timeout,
    });
    // 1) Los números (física pura, sin IA): nunca esperan a la narración.
    post(false,TIMEOUT_MS).then(d=>{
      if(!alive) return;
      setBackend(d); setLoadingB(false);
      // 2) La narración (Groq) llega después y es opcional: si falla o tarda,
      //    falla en silencio y los números ya están en pantalla.
      post(true,TIMEOUT_AI_MS)
        .then(n=>{ if(alive&&n&&n.narrative) setBackend(b=>b?{...b,narrative:n.narrative}:b); })
        .catch(()=>{});
    }).catch(e=>{
      if(!alive||isAbort(e)) return;
      setRouteError(true); setLoadingB(false);
    });
    return ()=>{ alive=false; ctrl.abort(); };
  },[from,to,lang,routeTry]);

  // ── Datos que se muestran: lo real cuando llegó; si no, física local ──────
  const positions = useMemo(()=>{
    const now = new Date();
    return Object.fromEntries(PLANETS.map(p=>[p.id, realPos[p.id] || helioPosition(p.id, now)]));
  },[realPos]);
  const allReal = Object.keys(realPos).length === PLANETS.length;
  const route = useMemo(()=>(backend && backend.transfer_time_days ? backend : hohmannLocal(from.id, to.id)),[backend, from.id, to.id]);
  const distKm = useMemo(()=>realDist ?? approxDistanceKm(from.id, to.id),[realDist, from.id, to.id]);

  // ── Un único aviso por pestaña, con un único "Reintentar" ─────────────────
  const posFailed = posStatus==="error";
  const distFailed = distStatus==="error" && !realDist;
  const routeFailed = routeError && !backend;
  const showNotice = tab==="route" ? (posFailed||distFailed||routeFailed) : tab==="windows" ? (posFailed||winError) : false;
  const retryAll = ()=>{
    if (posFailed) setPosTry(n=>n+1);
    if (tab==="route") {
      if (distFailed) setDistTry(n=>n+1);
      if (routeFailed) setRouteTry(n=>n+1);
    }
    if (tab==="windows" && winError) setWinTry(n=>n+1);
  };

  const changeTab = useCallback(id=>{
    setTab(id);
    try { if (window.scrollY > 120) window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" }); } catch { /* no-op */ }
  },[]);
  const pickPlanet = useCallback(p=>{
    if (p.id === to.id) return;
    if (p.id === from.id) { setFrom(to); setTo(from); return; }
    setTo(p);
  },[from, to]);
  const swap = ()=>{ setFrom(to); setTo(from); };

  const navigator_ = tab==="route" || tab==="windows";
  const notice = showNotice ? <LiveDataNotice lang={lang} onRetry={retryAll}/> : null;

  return (
    <>
      {intro && <Intro lang={lang} onDone={onDone}/>}

      <div className="min-h-screen bg-[#04080F] text-white relative">
        <SpaceTravel/>

        <div className="relative z-10">
          {/* Cabecera */}
          <header className="shell flex items-center justify-between pt-4 pb-2">
            <div>
              <h1 className="wordmark" style={{fontSize:30}}>Teseo</h1>
              <p className="tagline">{t.tagline}</p>
            </div>
            <button type="button" className="lang" aria-label={t.switchLang}
              onClick={()=>setLang(l=>l==="en"?"es":"en")}>
              <span className={lang==="es" ? "is-on" : ""} aria-hidden="true">ES</span>
              <span className={lang==="en" ? "is-on" : ""} aria-hidden="true">EN</span>
            </button>
          </header>

          {/* Navegación principal: siempre visible */}
          <Tabs tab={tab} onChange={changeTab} lang={lang}/>

          <main className="shell pt-4">
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={-1} className="panel">

              {navigator_ && (
                <div className={`nav-grid nav-grid--${tab}`}>
                    {/* Origen y destino */}
                    <div className="picks nav-grid__picks">
                      <PlanetSelect value={from} onChange={setFrom} exclude={to}
                        label={t.origin} kind="origin" lang={lang}/>
                      <button type="button" className="icon-btn picks__swap" aria-label={t.swap} onClick={swap}>
                        <IconSwap width={20} height={20}/>
                      </button>
                      <PlanetSelect value={to} onChange={setTo} exclude={from}
                        label={t.destination} kind="dest" lang={lang} align="right"/>
                    </div>

                  <div className="nav-grid__map">
                    <SolarMap from={from} to={to} positions={positions} lang={lang} onPick={pickPlanet}/>

                    <p className="map-caption">
                      <span className={`map-caption__src ${allReal ? "is-real" : ""}`}
                        role={posStatus==="loading" ? "status" : undefined}>
                        <span className="dot" aria-hidden="true"/>
                        {allReal ? t.mapNasa : posStatus==="loading" ? t.mapLoading : t.mapLocal}
                      </span>
                      <span>{t.mapNote}</span>
                    </p>
                  </div>

                  <div className="nav-grid__result stack">
                    {tab==="route" && (<>
                      <RouteAnswer from={from} to={to} lang={lang} route={route}
                        loading={loadingB} onSeeWindows={()=>changeTab("windows")}/>
                      {notice}

                      {backend?.narrative && (
                        <figure className="narrative">
                          <blockquote>{backend.narrative}</blockquote>
                          <figcaption>{t.narrativeBy}</figcaption>
                        </figure>
                      )}

                      <VehicleCompare from={from} to={to} lang={lang} distKm={distKm}/>
                      <TechDetails lang={lang} route={route} distKm={distKm} distReal={!!realDist}/>
                    </>)}

                    {tab==="windows" && (
                      <LaunchWindows from={from} to={to} lang={lang} attempt={winTry} onError={setWinError} notice={notice}/>
                    )}
                  </div>
                </div>
              )}

              {tab==="sky"&&(
                <ErrorBoundary variant="sky" lang={lang} onReset={retrySky}>
                  <Suspense fallback={<p role="status" className="loading">{t.loadingSky}</p>}>
                    <SkyView lang={lang}/>
                  </Suspense>
                </ErrorBoundary>
              )}

              {tab==="scale"&&(
                <CosmicScale lang={lang}/>
              )}
            </div>
          </main>

          {/* Pie */}
          <footer className="shell footer">
            <a href="https://yachaydeep.com" target="_blank" rel="noopener noreferrer" className="footer__link">
              {t.madeBy}
            </a>
            <span aria-hidden="true" className="footer__sep"/>
            <button type="button" onClick={()=>setShowCredits(true)} className="footer__link">
              {t.creditsLink}
            </button>
          </footer>
        </div>
      </div>

      {showCredits && <CreditsModal lang={lang} onClose={closeCredits}/>}
    </>
  );
}
