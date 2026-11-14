import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ephemeris } from "./ephemeris.js";
import { ErrorNotice } from "./ErrorBoundary.jsx";
import { fetchJson, isAbort, TIMEOUT_MS } from "./net.js";
import { BODIES, BODY_NAMES, bodyName, textureUrl, drawBodySprite, SPRITE_PX } from "./sky/bodies.js";
import { fmtDist, fmtYears, fmtWhenShort, fmtKm, fmtDuration } from "./sky/format.js";
import Icon from "./sky/icons.jsx";
import { PerfMeter, SkyLabels, SearchBox, Dock, LayersPanel, LocationPanel, TimePanel, TourCard, Onboarding, PointingBar, SkyActions, GuideHud, TonightPanel } from "./sky/panels.jsx";
import { cameraQuat, lookFromQuat } from "./sky/deviceOrientation.js";
import { guideArrow, turnHint, altAz } from "./sky/guide.js";
import { computeTonight } from "./sky/tonight.js";
import { buildSkyNotes } from "./sky/explain.js";
import { TX } from "./sky/i18n.js";
import { createPointing, pointingSupported } from "./sky/pointing.js";
import ObjectSheet, { describeObject, visibilityOf } from "./sky/ObjectSheet.jsx";
import ConstellationSheet from "./sky/ConstellationSheet.jsx";
import ShareDialog from "./sky/ShareDialog.jsx";
import { buildPostcard } from "./sky/postcard.js";
import { starHex } from "./sky/starColor.js";
import { perfFlag, createFrameStats, createAdaptive } from "./sky/perf.js";
import { fetchWikiFor, fetchImageCredit } from "./sky/wiki.js";
import { constellationData, conNameEs } from "./sky/constellations.js";
import { declination } from "./sky/geomag.js";
import { compassPoint8 } from "./sky/deviceOrientation.js";
import { useStageLayout } from "./sky/viewport.js";
import { localSkyQuat, lookFrame, dirToYawPitch, yawPitchToDir, lookQuat, spanToFov, shortToSpan, dragDelta, clampPitch, clampSpan,
  localDefaultAz, starScaleFor, screenOf, rankHits, SPAN_DEF, PITCH_MIN_LOCAL, PITCH_MIN_FREE, PITCH_MAX, LOCAL_ALT_DEF } from "./sky/look.js";
import { skyState, visibility, starsHidden, countVisibleNow, moonMagV, phaseAngleFromIllum, altAzToDir } from "./sky/atmosphere.js";
import { createAtmosphereLayer } from "./sky/atmosphereLayer.js";
import { AtmosphereControls, DayWarning } from "./sky/AtmosphereControls.jsx";
import { clampBortle, BORTLE_DEFAULT } from "./sky/lightPollution.js";
import { bodyMagnitude, SUN_MAG_V } from "./sky/planetMag.js";
import { track } from "./ui/track.js";
import "./sky/sky.css";

const API = import.meta.env.VITE_API_URL || "";
const LAYERS = [
  { key: "messier",    file: "/deepsky.json",    es: "Messier",          en: "Messier",      color: 0x67e8c8, size: 8 },
  { key: "pulsars",    file: "/pulsars.json",    es: "Púlsares",         en: "Pulsars",      color: 0xff5dc8, size: 6, lazy: true },
  { key: "blackholes", file: "/blackholes.json", es: "Agujeros negros",  en: "Black holes",  color: 0xff7a3c, size: 11 },
  { key: "galaxies",   file: "/galaxies.json",   es: "Galaxias",         en: "Galaxies",     color: 0x9db4ff, size: 5, lazy: true },
  { key: "meteors",    file: "/meteorshowers.json", es: "Lluvias de meteoros", en: "Meteor showers", color: 0xffd27a, size: 9 },
  { key: "comets",     api: true, endpoint: "/api/comets", es: "Cometas", en: "Comets", color: 0x8be0ff, size: 9 },
  { key: "probes",     api: true, endpoint: "/api/probes", es: "Sondas y telescopios", en: "Probes & telescopes", color: 0xe6ebff, size: 10 },
  // timeout mayor: con la caché del backend fría, el NASA Exoplanet Archive (~780 KB) tarda bastante más que el resto
  { key: "exoplanets", api: true, endpoint: "/api/exoplanets", es: "Exoplanetas", en: "Exoplanets", color: 0x4dd866, size: 6, timeout: 45000 },
];
const LABEL_COLOR = { card:"#9cc2ff", cardn:"#ff9d8a", con:"#c9b8ff", star:"#ffffff", obj_messier:"#67e8c8", obj_pulsars:"#ff5dc8", obj_blackholes:"#ff7a3c", obj_galaxies:"#9db4ff", obj_meteors:"#ffd27a", obj_comets:"#8be0ff", obj_probes:"#e6ebff", obj_exoplanets:"#8fe89f", solar:"#ffe9a8" };
// Nombres en el cielo: por defecto solo los objetos con nombre propio o notables. Los
// de catálogo ("J1759+5036", "NGC 1269"…) aparecen al acercarse, cuando ya caben pocos
// en pantalla (umbral según "Nombres en el cielo"), o al tocar el objeto.
function isNotable(key, ob, when) {
  if (key === "messier") return !!ob.cn || (ob.mag != null && ob.mag <= 6);
  if (key === "galaxies") return !!ob.cat && ob.cat !== ob.name;
  if (key === "pulsars" || key === "exoplanets") return false;
  if (key === "meteors") return meteorActive(ob, when);
  return true;                        // agujeros negros, cometas y sondas: listas cortas y curadas
}
const CATALOG_LABELS = { pocas: 3, normal: 9, muchas: 26 };

// Atajos de "Mi cielo": coordenadas del centro de cada ciudad (grados decimales).
// elev: altitud en m (ficha de cada ciudad en Wikipedia: Quito 2.850, Cayambe 2.830, Guayaquil 4, Cuenca 2.560),
// usada en la extinción atmosférica. bortle: contaminación lumínica por defecto, SOLO con respaldo publicado
// (Quito: SQM 15,5–16,4 mag/arcsec², Aroca y Herrera 2022, UPS; ver src/sky/lightPollution.js); el resto, el
// valor neutro BORTLE_DEFAULT (5) para que la persona lo ajuste.
const PLACES = [
  { name: "Quito", lat: -0.2202, lon: -78.5123, elev: 2850, bortle: 8 },
  { name: "Cayambe", lat: 0.0431, lon: -78.1456, elev: 2830 },
  { name: "Guayaquil", lat: -2.1894, lon: -79.8891, elev: 4 },
  { name: "Cuenca", lat: -2.9001, lon: -79.0059, elev: 2560 },
];
const ATM_KEY = "teseo_atm";           // interruptor "Atmósfera" (1/0)
const BORTLE_KEY = "teseo_bortle_v1";  // { lugar: clase } elegida por la persona
// Penalización (mag) para objetos extensos: su luz se reparte en un área, así que se ven peor que una
// estrella de la misma magnitud integrada. APROXIMACIÓN declarada en la interfaz (deepNote).
const EXTENDED_PENALTY = { galaxy: 1.5, nebula: 1.5, snr: 1.5, open: 1.0, globular: 1.0, cluster: 1.0, planetary: 1.0, other: 1.5 };
const extPenalty = (key, ob) => key === "galaxies" ? 1.5 : (EXTENDED_PENALTY[ob.type] ?? 1.5);
const MAG_LAYERS = new Set(["messier", "galaxies"]);   // símbolo según su magnitud y visibilidad con atmósfera
const loadBortleMap = () => { try { return JSON.parse(localStorage.getItem(BORTLE_KEY) || "{}") || {}; } catch { return {}; } };
// Sol, Luna y planetas con su magnitud aparente (planetas: Mallama y Hilton 2018; Luna: Schaefer 1998, aprox.)
// Lugar de "Mi cielo" al abrir: la última elección explícita (localStorage) o, si nunca se eligió, Quito
// (atajo con su altitud). Quito por defecto NO pide la geolocalización. Un enlace con punto de observación
// (v=) o constelación en profundidad (c=), incompatibles con Mi cielo, gana sobre ambos.
const PLACE_KEY = "teseo_place_v1";
function initialPlace() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(PLACE_KEY) || "null"); } catch { saved = null; }
  let linkWins = false;
  try {
    const h = window.location.hash || "";
    if (h.startsWith("#sky")) { const p = new URLSearchParams(h.slice(h.indexOf("?") + 1)); linkWins = !!(p.get("v") || p.get("c")); }
  } catch { /* no-op */ }
  const quito = PLACES[0];
  if (saved && saved.kind === "off") return { local: false, lat: null, lon: null, kind: "custom", elev: null, preset: false, isDefault: false };
  if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
    const pr = PLACES.find((x) => x.name === saved.kind);
    return { local: !linkWins, lat: saved.lat, lon: saved.lon, kind: saved.kind || "custom", elev: Number.isFinite(saved.elev) ? saved.elev : (pr ? pr.elev : null), preset: !!pr, isDefault: false };
  }
  return { local: !linkWins, lat: quito.lat, lon: quito.lon, kind: quito.name, elev: quito.elev, preset: true, isDefault: true };
}
const savePlace = (v) => { try { localStorage.setItem(PLACE_KEY, JSON.stringify(v)); } catch { /* no-op */ } };

function withMags(list) {
  return list.map((b) => {
    if (b.body === "planet") { const m = bodyMagnitude(b); return m ? { ...b, mag: +m.V.toFixed(2) } : b; }
    if (b.name === "Luna" && b.illum != null) return { ...b, mag: +moonMagV(phaseAngleFromIllum(b.illum)).toFixed(1), magApprox: true };
    if (b.name === "Sol") return { ...b, mag: SUN_MAG_V };
    return b;
  });
}
// Modo "Apuntar al cielo": desfase manual de azimut (grados). Solo en memoria:
// dura lo que dura la sesión de la página y no se guarda en ningún sitio.
let pointAzOffset = 0;
const POINT_SPAN = 75;              // grados de cielo que abarca el lado largo de la pantalla al empezar
const HINT_KEY = "teseo_hint_v2";   // primeros pasos vistos (v1 era el párrafo antiguo)
// medidor de rendimiento: #sky?...&fps=1 o ?perf=1 (se lee una vez, al cargar)
const PERF_ON = typeof window !== "undefined" && perfFlag(window.location.hash, window.location.search);
// &adapt=0: resolución fija (sin bajada adaptativa), para comparar mediciones
const ADAPT_OFF = typeof window !== "undefined" && /[?&]adapt=0\b/.test(window.location.hash + "&" + window.location.search);
// &e2e=1: expone en window.__teseoSky el estado de la cámara (solo lectura) para las pruebas en navegador
const E2E = typeof window !== "undefined" && /[?&]e2e=1\b/.test(window.location.hash + "&" + window.location.search);
const IDLE_EVERY = 6;                 // con el cielo quieto se dibuja 1 de cada 6 cuadros (la Tierra en miniatura sigue girando)
const VIVID_KEY = "teseo_star_vivid";   // "resaltar colores de las estrellas" (1/0)

// Términos genéricos de categoría: al buscar "pulsar" o "agujero negro" se
// lista la capa entera en vez de exigir el nombre exacto de cada objeto.
const CATEGORY_TERMS = [
  { key: "pulsars",    terms: ["pulsar", "pulsares", "pulsars"] },
  { key: "blackholes", terms: ["agujero negro", "agujeros negros", "agujero", "hoyo negro", "black hole", "blackhole", "black holes"] },
  { key: "galaxies",   terms: ["galaxia", "galaxias", "galaxy", "galaxies"] },
  { key: "comets",     terms: ["cometa", "cometas", "comet", "comets"] },
  { key: "meteors",    terms: ["meteoro", "meteoros", "lluvia de meteoros", "lluvias", "meteor", "meteor shower"] },
  { key: "messier",    terms: ["messier", "nebulosa", "nebulosas", "cúmulo", "cumulo", "cúmulos", "nebula", "cluster"] },
  { key: "exoplanets", terms: ["exoplaneta", "exoplanetas", "exoplanet", "exoplanets"] },
  { key: "probes",     terms: ["sonda", "sondas", "telescopio", "telescopios", "nave", "probe", "probes", "spacecraft", "telescope", "voyager"] },
];
function labelForObj(key, o, lang) {
  if (key === "messier") return `${o.name}${o.cn ? " · " + o.cn : ""}`;
  if (key === "galaxies") return o.name + (o.cat && o.cat !== o.name ? " · " + o.cat : "");
  if (key === "meteors") return lang === "en" ? (o.name_en || o.name) : o.name;
  return o.name;
}
// estrella del catálogo ([hip, nx, ny, nz, mag, color, dist_ly, nombre]) -> objeto seleccionable
// + [8] B−V y [9] tipo espectral desde el esquema 2 de sky.json; con un sky.json antiguo en caché faltan y
// la estrella conserva el color del catálogo, sin temperatura.
const STAR_MODE = { vivid: false };   // "resaltar colores": lo sincroniza el componente
const starTint = (st) => starHex(st[8], STAR_MODE.vivid, st[5]);
function starObj(st, si) {
  return { name: st[7], nx: st[1], ny: st[2], nz: st[3], dist_ly: st[6], mag: st[4], hex: starTint(st), bv: st[8] === undefined ? undefined : st[8], spect: st[9] || "", si, layer: "star" };
}

// Una lluvia está activa si hoy (MM-DD) cae en [start, end]; la ventana puede
// cruzar el fin de año (p. ej. Cuadrántidas 12-28 -> 01-12).
function meteorActive(o, now = new Date()) {
  const md = String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  return o.start <= o.end ? (md >= o.start && md <= o.end) : (md >= o.start || md <= o.end);
}

const TOUR = [
  { type: "con", ab: "Ori", title: { es: "Orión, el cazador", en: "Orion the Hunter" } },
  { type: "star", name: "Betelgeuse", title: { es: "Betelgeuse", en: "Betelgeuse" } },
  { type: "star", name: "Rigel", title: { es: "Rigel", en: "Rigel" } },
  { type: "messier", m: 42, title: { es: "Nebulosa de Orión", en: "Orion Nebula" } },
  { type: "star", name: "Sirius", title: { es: "Sirio, la estrella más brillante", en: "Sirius, the brightest star" } },
  { type: "messier", m: 45, title: { es: "Las Pléyades", en: "The Pleiades" } },
  { type: "bh", name: "Sgr A*", title: { es: "El centro de la Vía Láctea", en: "The Galactic Center" } },
  { type: "messier", m: 31, title: { es: "Galaxia de Andrómeda", en: "Andromeda Galaxy" } },
];
function resolveStop(stop, ref, sky, datasets) {
  if (!ref || !sky) return null;
  if (stop.type === "con") {
    const c = ref.conCentroid && ref.conCentroid[stop.ab]; if (!c || !c.idxs.length) return null;
    let x = 0, y = 0, z = 0; for (const i of c.idxs) { x += ref.posFlat[i*3]; y += ref.posFlat[i*3+1]; z += ref.posFlat[i*3+2]; }
    const L = Math.hypot(x, y, z) || 1;
    return { dir: [x/L, y/L, z/L], dist: null, type: "con" };
  }
  if (stop.type === "star") {
    const st = sky.stars.find(s => s[7] === stop.name); if (!st) return null;
    return { dir: [st[1], st[2], st[3]], dist: st[6], type: "star" };
  }
  if (stop.type === "messier") {
    const o = datasets.messier && datasets.messier.objects.find(o => o.m === stop.m); if (!o) return null;
    return { dir: [o.nx, o.ny, o.nz], dist: o.dist_ly, type: "messier" };
  }
  if (stop.type === "bh") {
    const o = datasets.blackholes && datasets.blackholes.objects.find(o => o.name === stop.name); if (!o) return null;
    return { dir: [o.nx, o.ny, o.nz], dist: o.dist_ly, type: "bh" };
  }
  return null;
}
function makeTextSprite(text) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(147,197,253,1)"; ctx.font = "bold 40px Inter, system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(78, 78, 1); return sp;
}
function fmtInput(d) { const z = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; }
function nowLocalInput() {
  const d = new Date(); const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

// ─── i18n ──────────────────────────────────────────────────────────────
const TC = {
  en: {
    title: "Constellations in real depth",
    intro: "The stars of a constellation look like a flat drawing — but they sit at wildly different distances. Pick one and pull the slider to see its true 3D shape.",
    pick: "Constellation",
    all: "Whole sky",
    flat: "As seen from Earth",
    depth: "Real depth",
    lightyears: "light-years",
    away: "away",
    from: "Distance from Earth",
    dragHint: "Drag to look around · pinch or scroll to zoom",
    note: "Star positions & distances: real (HYG / Hipparcos). 3D depth uses a logarithmic scale of the real distance so it stays viewable — the distances shown are the real ones.",
    loading: "Loading the real sky…",
    retry: "Retry",
    skyError: "The star catalogue could not be loaded. Check the connection and try again.",
    layersError: "These layers could not be loaded:",
    layerFailed: "Could not load",
    tourNoText: "Narration isn't available right now. The tour goes on with the real data.",
    nearest: "Nearest", farthest: "Farthest", spread: "Depth spread",
    // ── visor ──
    canvasAria: "Sky map seen from Earth, from the centre of the celestial sphere: stars, constellations and objects in their real positions. Arrow keys look around, + and − zoom, Escape closes the open panel.",
    skyFrom: "Sky seen from", backToEarth: "Back to Earth",
    zoomIn: "Zoom in", zoomOut: "Zoom out", centerView: "Center the view", centerObj: "Center on the object",
    postcardAria: "Save a postcard of this sky (PNG)", fullOn: "Full screen", fullOff: "Exit full screen",
    close: "Close", now: "Now", west: "W",
    kinds: { con: "Constellation", star: "Star", solar: "Solar system" },
    loadingLayer: (n) => `Loading ${n}…`, failedLayer: (n) => `${n} could not be loaded`,
    depthAria: "Depth: from the flat view to real depth", wholeSky: "Whole sky",
    depthTitle: (n) => `${n} in real depth`,
    myLocation: "Your location", changePlace: "Change place", leaveMySky: "Leave My sky",
    tourFactDist: (d) => `${d} from Earth`,
    // ── buscador ──
    searchAria: "Search the sky", searchPlaceholder: "Search: Saturn, Orion, a galaxy…", searchClear: "Clear search",
    searchTry: "Try one of these", searchResults: "Search results", searchEmpty: "Nothing in the sky with that name. Try a planet, a star or a constellation.",
    // ── dock ──
    dockAria: "Sky tools", layers: "Layers", mySky: "My sky", tour: "Tour",
    // ── capas ──
    layersTitle: "Layers", layersLead: "Add what you want to see. Every point sits where the real object is.",
    groups: { near: "Our neighbourhood", deep: "Deep sky", view: "View" },
    solarLayer: "Sun, Moon and planets",
    layerDesc: {
      solar: "Where they are right now, computed from their orbits.",
      meteors: "The point each shower seems to come from.",
      comets: "Today's positions, from NASA Horizons.",
      probes: "Voyager, James Webb and other spacecraft, today.",
      messier: "Nebulae, clusters and galaxies visible with a small telescope.",
      galaxies: "Other galaxies, millions of light-years away.",
      blackholes: "Confirmed black holes, from Sgr A* to M87*.",
      pulsars: "Dead stars spinning up to hundreds of times a second.",
      exoplanets: "Planets around other stars (NASA Exoplanet Archive).",
    },
    loadingShort: "loading…", layerErrorLine: "It didn't load.",
    constellation3d: "Constellation in 3D", constellation3dHint: "Pick one to see how far apart its stars really are.",
    labelDensity: "Names on the sky", densFew: "Few", densNormal: "Normal", densMany: "Many",
    scaleNote: "The Sun, the Moon and the planets are drawn larger so you can find them: they are not to scale.",
    // ── mi cielo ──
    mySkyTitle: "My sky", mySkyLead: "See the sky as it looks from one place, with its horizon and compass points.",
    useMyLocation: "Use my location", geoAskingBtn: "Asking for permission…",
    geoAsking: "Your browser is asking for permission. Accept to see your sky.",
    geoDenied: "Location permission is blocked. Allow it in your browser's site settings, or pick a city below.",
    geoUnavailable: "Your location couldn't be found. Pick a city or type your coordinates.",
    geoTimeout: "Finding your location took too long. Try again or pick a city.",
    geoUnsupported: "This browser can't share your location. Pick a city or type your coordinates.",
    orPickPlace: "Or pick a place", orCoords: "Or type coordinates", latitude: "Latitude", longitude: "Longitude", apply: "Show",
    coordsBad: "Use numbers: latitude from −90 to 90, longitude from −180 to 180.",
    coordsHint: "South and west are negative. Quito: −0.22, −78.51.",
    customPlace: "Custom coordinates", exitMySky: "Leave",
    // ── apuntar al cielo ──
    pointSky: "Point at the sky", experimental: "experimental",
    pointLead: "Hold your phone up and the sky turns with you. No camera: it uses your phone's compass and gyroscope.",
    pointPickPlace: "One more step: pick your location below. As soon as you do, the sky will follow your phone.",
    pointActive: "Pointing at the sky", pointExit: "Exit", pointExitAria: "Exit Point at the sky",
    pointStarting: "Waking the sensors…", pointStartingSub: "move your phone a little",
    pointDir: (d) => `Looking ${d}`, pointDirs: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"],
    pointAbove: (a) => `${a}° above the horizon`, pointUnder: (a) => `${a}° below the horizon · under your feet`,
    pointZenith: "Looking at the zenith", pointZenithSub: "straight above your head",
    pointNadir: "Looking at the ground", pointNadirSub: "straight under your feet",
    pointHint: "Doesn't match? Drag sideways to line it up with a star or planet you recognise.",
    pointHintRel: "Your phone isn't reporting where north is. Drag the sky sideways until it matches a star or planet you recognise.",
    pointReset: "Reset alignment",
    pointDenied: "Motion sensors aren't allowed. To try again, close this tab, open Teseo again and tap “Allow” when your phone asks about motion and orientation.",
    pointNoSensor: "This device isn't sending orientation data (gyroscope or compass). You can still explore the sky with your finger.",
    latLon: (a, o) => `${Math.abs(a).toFixed(2)}° ${a >= 0 ? "N" : "S"}, ${Math.abs(o).toFixed(2)}° ${o >= 0 ? "E" : "W"}`,
    // ── tiempo ──
    timeTitle: "Time", isNow: "Right now", backToNow: "Back to now",
    dayBack: "1 day", hourBack: "1 hour", hourFwd: "1 hour", dayFwd: "1 day",
    playTime: "Play time forward", pauseTime: "Pause", pickDate: "Pick a date and time",
    timeNote: "Time moves the Sun, the Moon and the planets — and your horizon in My sky.",
    // ── tour ──
    tourAria: "Guided tour", tourStep: (i, n) => `Stop ${i} of ${n}`, tourExit: "Leave the tour",
    narrating: "Writing the narration…", aiNarration: "Narrated by AI. The distances and positions are real data.",
    prev: "Previous", next: "Next", tourPause: "Pause", tourResume: "Auto-play", startTour: "Start the tour",
    // ── primeros pasos ──
    onboardAria: "Getting started", skip: "Skip", exploreAlone: "Explore on my own",
    onboard: [
      { title: "Look around with your finger", body: "You're at the centre of the sky, as if you were looking up from Earth. Drag to look around and pinch to zoom in. Every star sits in its real position." },
      { title: "Tap anything that catches your eye", body: "A planet, a star, a nebula… or search for it by name. You'll see what it is and how far away." },
      { title: "Add layers, or let us guide you", body: "Below: Layers (galaxies, pulsars, comets…), My sky (what's up from where you are), Tour and Time." },
    ],
    // ── ficha ──
    closeSheet: "Close this card", sheetExpand: "Expand the card", sheetCollapse: "Shrink the card",
    typeSun: "Star · the centre of the solar system", typeMoon: "Earth's natural satellite", typePlanet: "Planet of the solar system",
    typeStar: "Star", typeGalaxy: "Galaxy", typeBlackHole: "Black hole ·", typePulsar: "Pulsar · a spinning neutron star",
    typeMeteor: "Meteor shower", typeComet: "Comet", typeProbe: "Spacecraft or space telescope", typeExoplanet: "Exoplanet",
    inConst: (c) => `in ${c}`, orbits: (h) => `orbits ${h}`,
    fDistance: "Distance", fLightLeft: "Its light left", fLightTakes: "Its light takes", fVoyager: "Aboard Voyager 1 you'd take",
    ago: (s) => `${s} ago`, fLightHint: "you see it as it was then", au: "AU (Earth–Sun distances)",
    fPeak: "Peak night", fActive: "Active", fRate: "At its best", perHour: (n) => `~${n} per hour`, zhrHint: "under a dark, clear sky",
    moonPhase: (p, w) => `Tonight's Moon: ${p}% lit, ${w ? "waxing" : "waning"}.`,
    activeNow: "active now", habitable: "potentially habitable", notHabitable: "Outside its star's habitable zone, as far as the data shows.",
    radiantNote: "This marks the radiant: the direction the meteors seem to come from. It isn't a distant object.",
    approaching: "Right now it is getting closer to Earth.", receding: "Right now it is moving away from Earth.",
    pulsarSpin: (n) => `It spins ${n} times every second.`, pulsarSlow: (s) => `It turns once every ${s} seconds.`,
    techDetails: "Technical details", readMore: "Read on Wikipedia",
    dDiameter: "Diameter", timesEarth: (x) => `${x} × Earth`, dRotation: "One spin takes", retrograde: "backwards",
    dOrbitSun: "One trip around the Sun", dOrbitEarth: "One trip around Earth", dPosition: "Position in the sky",
    dMagnitude: "Apparent magnitude", magHint: "lower is brighter", dSource: "Source", dCatalog: "Catalogue", dHubble: "Hubble type",
    dMass: "Mass", dPeriod: "Spin period", dKind: "Kind", dParent: "Comes from", dRadius: "Radius", earthRadii: "Earth radii",
    earthMasses: "Earth masses", dYear: "Its year lasts", dTemp: "Equilibrium temperature", dHost: "Star", dDiscovered: "Discovered",
    ephemNote: "Position computed for the chosen date and time (orbital elements; accurate to about 1–2 arcminutes).",
    distPublished: "Published distance, with uncertainty: treat it as approximate.",
    distRedshift: "Distance estimated from redshift (Hubble's law): approximate.",
    horizonsNote: "Real position for today, from NASA/JPL Horizons.",
    model3dAria: (n) => `3D model of ${n}. Drag, or use the left and right arrows, to spin it.`, dragToSpin: "Drag to spin",
    cap3dReal: "3D model · texture based on real NASA data", cap3dFallback: "3D model · approximate colours (real texture not available yet)",
    texCredit: { sss: "Texture: Solar System Scope (CC BY 4.0)", svs: "Texture: NASA Scientific Visualization Studio", messenger: "Texture: NASA / JHUAPL / Carnegie (MESSENGER)" },
    capMoonPhase: "Lit as it is at the chosen moment. Drag to see its far side.",
    capSunWarn: "Never look at the Sun directly, or through a telescope without a certified solar filter.",
    capWiki: "Image: Wikipedia / Wikimedia Commons", capWikiMixed: "Image from Wikipedia: it may be a real observation or an illustration",
    capArtist: "Illustration: artist's concept (Wikipedia)", capLicense: "Author and licence",
    capLoading: "Looking for an image…", imgAlt: (n) => `Image of ${n}`,
    capStar: "Representation: colour from the star's real temperature (HYG catalogue). Not a photograph.",
    capSchematic: "Schematic illustration. Not a real image.", capNoImage: "No image available right now. Schematic illustration.",
    viewFromHere: "See the sky from here", share: "Share", linkCopied: "Link copied", linkFailed: "Couldn't copy the link",
    postcard: "Postcard", center: "Center",
  },
  es: {
    title: "Constelaciones en profundidad real",
    intro: "Las estrellas de una constelación parecen un dibujo plano — pero están a distancias muy distintas. Elige una y mueve el control para ver su forma 3D real.",
    pick: "Constelación",
    all: "Todo el cielo",
    flat: "Como se ve desde la Tierra",
    depth: "Profundidad real",
    lightyears: "años luz",
    away: "de distancia",
    from: "Distancia desde la Tierra",
    dragHint: "Arrastra para mirar alrededor · pellizca o usa la rueda para acercar",
    note: "Posiciones y distancias estelares: reales (HYG / Hipparcos). La profundidad 3D usa una escala logarítmica de la distancia real para que sea visualizable — las distancias mostradas son las reales.",
    loading: "Cargando el cielo real…",
    retry: "Reintentar",
    skyError: "No se pudo cargar el catálogo de estrellas. Revisa la conexión y vuelve a intentarlo.",
    layersError: "No se pudieron cargar estas capas:",
    layerFailed: "No se pudo cargar",
    tourNoText: "La narración no está disponible ahora. El recorrido sigue con los datos reales.",
    nearest: "Más cercana", farthest: "Más lejana", spread: "Rango de profundidad",
    // ── visor ──
    canvasAria: "Mapa del cielo visto desde la Tierra, desde el centro de la esfera celeste: estrellas, constelaciones y objetos en su posición real. Flechas para mirar alrededor, + y − para acercar, Escape para cerrar el panel abierto.",
    skyFrom: "Cielo visto desde", backToEarth: "Volver a la Tierra",
    zoomIn: "Acercar", zoomOut: "Alejar", centerView: "Centrar la vista", centerObj: "Centrar en el objeto",
    postcardAria: "Guardar una postal de este cielo (PNG)", fullOn: "Pantalla completa", fullOff: "Salir de pantalla completa",
    close: "Cerrar", now: "Ahora", west: "O",
    kinds: { con: "Constelación", star: "Estrella", solar: "Sistema solar" },
    loadingLayer: (n) => `Cargando ${n}…`, failedLayer: (n) => `No se pudo cargar ${n}`,
    depthAria: "Profundidad: de la vista plana a la profundidad real", wholeSky: "Todo el cielo",
    depthTitle: (n) => `${n} en profundidad real`,
    myLocation: "Tu ubicación", changePlace: "Cambiar de lugar", leaveMySky: "Salir de Mi cielo",
    tourFactDist: (d) => `A ${d} de la Tierra`,
    // ── buscador ──
    searchAria: "Buscar en el cielo", searchPlaceholder: "Busca: Saturno, Orión, una galaxia…", searchClear: "Borrar la búsqueda",
    searchTry: "Prueba con alguno", searchResults: "Resultados de la búsqueda", searchEmpty: "No hay nada en el cielo con ese nombre. Prueba con un planeta, una estrella o una constelación.",
    // ── dock ──
    dockAria: "Herramientas del cielo", layers: "Capas", mySky: "Mi cielo", tour: "Tour",
    // ── capas ──
    layersTitle: "Capas", layersLead: "Suma lo que quieras ver. Cada punto está donde está el objeto real.",
    groups: { near: "Nuestro vecindario", deep: "Cielo profundo", view: "Vista" },
    solarLayer: "Sol, Luna y planetas",
    layerDesc: {
      solar: "Dónde están ahora mismo, calculado con sus órbitas.",
      meteors: "El punto del que parece venir cada lluvia.",
      comets: "Posiciones de hoy, de NASA Horizons.",
      probes: "Voyager, James Webb y otras naves, hoy.",
      messier: "Nebulosas, cúmulos y galaxias visibles con un telescopio pequeño.",
      galaxies: "Otras galaxias, a millones de años luz.",
      blackholes: "Agujeros negros confirmados, de Sgr A* a M87*.",
      pulsars: "Estrellas muertas que giran hasta cientos de veces por segundo.",
      exoplanets: "Planetas de otras estrellas (NASA Exoplanet Archive).",
    },
    loadingShort: "cargando…", layerErrorLine: "No se cargó.",
    constellation3d: "Constelación en 3D", constellation3dHint: "Elige una para ver lo lejos que están sus estrellas entre sí.",
    labelDensity: "Nombres en el cielo", densFew: "Pocos", densNormal: "Normal", densMany: "Muchos",
    scaleNote: "El Sol, la Luna y los planetas se dibujan agrandados para que puedas encontrarlos: no están a escala.",
    // ── mi cielo ──
    mySkyTitle: "Mi cielo", mySkyLead: "Mira el cielo tal como se ve desde un lugar, con su horizonte y sus puntos cardinales.",
    useMyLocation: "Usar mi ubicación", geoAskingBtn: "Pidiendo permiso…",
    geoAsking: "Tu navegador te está pidiendo permiso. Acéptalo para ver tu cielo.",
    geoDenied: "El permiso de ubicación está bloqueado. Actívalo en los ajustes del sitio de tu navegador o elige una ciudad aquí abajo.",
    geoUnavailable: "No se pudo encontrar tu ubicación. Elige una ciudad o escribe tus coordenadas.",
    geoTimeout: "Encontrar tu ubicación tardó demasiado. Inténtalo de nuevo o elige una ciudad.",
    geoUnsupported: "Este navegador no puede compartir tu ubicación. Elige una ciudad o escribe tus coordenadas.",
    orPickPlace: "O elige un lugar", orCoords: "O escribe coordenadas", latitude: "Latitud", longitude: "Longitud", apply: "Ver",
    coordsBad: "Usa números: latitud entre −90 y 90, longitud entre −180 y 180.",
    coordsHint: "Sur y oeste van en negativo. Quito: −0.22, −78.51.",
    customPlace: "Coordenadas propias", exitMySky: "Salir",
    // ── apuntar al cielo ──
    pointSky: "Apuntar al cielo", experimental: "experimental",
    pointLead: "Levanta el teléfono y el cielo girará contigo. Sin cámara: usa la brújula y el giroscopio de tu teléfono.",
    pointPickPlace: "Falta un paso: elige tu ubicación aquí abajo. En cuanto la tengas, el cielo seguirá a tu teléfono.",
    pointActive: "Apuntando al cielo", pointExit: "Salir", pointExitAria: "Salir de Apuntar al cielo",
    pointStarting: "Activando los sensores…", pointStartingSub: "mueve un poco el teléfono",
    pointDir: (d) => `Mirando al ${d}`, pointDirs: ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"],
    pointAbove: (a) => `${a}° sobre el horizonte`, pointUnder: (a) => `${a}° bajo el horizonte · bajo tus pies`,
    pointZenith: "Mirando al cenit", pointZenithSub: "justo sobre tu cabeza",
    pointNadir: "Mirando al suelo", pointNadirSub: "justo bajo tus pies",
    pointHint: "¿No coincide? Arrastra hacia los lados para alinear con una estrella o planeta que reconozcas.",
    pointHintRel: "Tu teléfono no indica dónde está el norte. Arrastra el cielo hacia los lados hasta que coincida con una estrella o planeta que reconozcas.",
    pointReset: "Reiniciar alineación",
    pointDenied: "No hay permiso para los sensores de movimiento. Para reintentarlo, cierra esta pestaña, vuelve a abrir Teseo y toca «Permitir» cuando el teléfono pregunte por movimiento y orientación.",
    pointNoSensor: "Este dispositivo no envía datos de orientación (giroscopio o brújula). Puedes seguir explorando el cielo con el dedo.",
    latLon: (a, o) => `${Math.abs(a).toFixed(2)}° ${a >= 0 ? "N" : "S"}, ${Math.abs(o).toFixed(2)}° ${o >= 0 ? "E" : "O"}`,
    // ── tiempo ──
    timeTitle: "Tiempo", isNow: "Ahora mismo", backToNow: "Volver a ahora",
    dayBack: "1 día", hourBack: "1 hora", hourFwd: "1 hora", dayFwd: "1 día",
    playTime: "Dejar correr el tiempo", pauseTime: "Pausar", pickDate: "Elegir fecha y hora",
    timeNote: "El tiempo mueve el Sol, la Luna y los planetas, y también tu horizonte en Mi cielo.",
    // ── tour ──
    tourAria: "Tour guiado", tourStep: (i, n) => `Parada ${i} de ${n}`, tourExit: "Salir del tour",
    narrating: "Escribiendo la narración…", aiNarration: "Narrado por IA. Las distancias y posiciones son datos reales.",
    prev: "Anterior", next: "Siguiente", tourPause: "Pausar", tourResume: "Automático", startTour: "Empezar el tour",
    // ── primeros pasos ──
    onboardAria: "Primeros pasos", skip: "Saltar", exploreAlone: "Explorar por mi cuenta",
    onboard: [
      { title: "Mira alrededor con el dedo", body: "Estás en el centro del cielo, como si lo miraras desde la Tierra. Arrastra para mirar alrededor y pellizca para acercar. Cada estrella está en su posición real." },
      { title: "Toca lo que te llame la atención", body: "Un planeta, una estrella, una nebulosa… o búscalo por su nombre. Verás qué es y a qué distancia está." },
      { title: "Suma capas o déjate guiar", body: "Abajo tienes Capas (galaxias, púlsares, cometas…), Mi cielo (lo que se ve desde donde estás), Tour y Tiempo." },
    ],
    // ── ficha ──
    closeSheet: "Cerrar la ficha", sheetExpand: "Ampliar la ficha", sheetCollapse: "Reducir la ficha",
    typeSun: "Estrella · el centro del sistema solar", typeMoon: "Satélite natural de la Tierra", typePlanet: "Planeta del sistema solar",
    typeStar: "Estrella", typeGalaxy: "Galaxia", typeBlackHole: "Agujero negro", typePulsar: "Púlsar · una estrella de neutrones que gira",
    typeMeteor: "Lluvia de meteoros", typeComet: "Cometa", typeProbe: "Sonda o telescopio espacial", typeExoplanet: "Exoplaneta",
    inConst: (c) => `en ${c}`, orbits: (h) => `orbita ${h}`,
    fDistance: "Distancia", fLightLeft: "Su luz salió hace", fLightTakes: "Su luz tarda", fVoyager: "En la Voyager 1 tardarías",
    ago: (s) => s, fLightHint: "lo ves como era entonces", au: "UA (distancias Tierra–Sol)",
    fPeak: "Noche máxima", fActive: "Activa", fRate: "En su mejor momento", perHour: (n) => `~${n} por hora`, zhrHint: "con cielo oscuro y despejado",
    moonPhase: (p, w) => `La Luna de esta noche: ${p} % iluminada, ${w ? "creciente" : "menguante"}.`,
    activeNow: "activa ahora", habitable: "potencialmente habitable", notHabitable: "Fuera de la zona habitable de su estrella, según los datos.",
    radiantNote: "Aquí está el radiante: la dirección de la que parecen venir los meteoros. No es un objeto lejano.",
    approaching: "Ahora mismo se está acercando a la Tierra.", receding: "Ahora mismo se está alejando de la Tierra.",
    pulsarSpin: (n) => `Da ${n} vueltas cada segundo.`, pulsarSlow: (s) => `Da una vuelta cada ${s} segundos.`,
    techDetails: "Detalles técnicos", readMore: "Leer en Wikipedia",
    dDiameter: "Diámetro", timesEarth: (x) => `${x} × la Tierra`, dRotation: "Una vuelta sobre sí", retrograde: "al revés",
    dOrbitSun: "Una vuelta al Sol", dOrbitEarth: "Una vuelta a la Tierra", dPosition: "Posición en el cielo",
    dMagnitude: "Magnitud aparente", magHint: "menor es más brillante", dSource: "Fuente", dCatalog: "Catálogo", dHubble: "Tipo de Hubble",
    dMass: "Masa", dPeriod: "Período de giro", dKind: "Tipo", dParent: "Proviene de", dRadius: "Radio", earthRadii: "radios terrestres",
    earthMasses: "masas terrestres", dYear: "Su año dura", dTemp: "Temperatura de equilibrio", dHost: "Estrella", dDiscovered: "Descubierto",
    ephemNote: "Posición calculada para la fecha y hora elegidas (elementos orbitales; precisión de 1 a 2 minutos de arco).",
    distPublished: "Distancia publicada, con incertidumbre: tómala como aproximada.",
    distRedshift: "Distancia estimada por corrimiento al rojo (ley de Hubble): aproximada.",
    horizonsNote: "Posición real de hoy, de NASA/JPL Horizons.",
    model3dAria: (n) => `Modelo 3D de ${n}. Arrastra, o usa las flechas izquierda y derecha, para girarlo.`, dragToSpin: "Arrastra para girar",
    cap3dReal: "Modelo 3D · textura basada en datos reales de NASA", cap3dFallback: "Modelo 3D · colores aproximados (textura real aún no disponible)",
    texCredit: { sss: "Textura: Solar System Scope (CC BY 4.0)", svs: "Textura: NASA Scientific Visualization Studio", messenger: "Textura: NASA / JHUAPL / Carnegie (MESSENGER)" },
    capMoonPhase: "Iluminada como está en el momento elegido. Arrastra para ver su cara oculta.",
    capSunWarn: "Nunca mires al Sol directamente ni con un telescopio sin filtro solar certificado.",
    capWiki: "Imagen: Wikipedia / Wikimedia Commons", capWikiMixed: "Imagen de Wikipedia: puede ser una observación real o una ilustración",
    capArtist: "Ilustración: concepto artístico (Wikipedia)", capLicense: "Autor y licencia",
    capLoading: "Buscando una imagen…", imgAlt: (n) => `Imagen de ${n}`,
    capStar: "Representación: color según la temperatura real de la estrella (catálogo HYG). No es una fotografía.",
    capSchematic: "Ilustración esquemática. No es una imagen real.", capNoImage: "Sin imagen disponible ahora. Ilustración esquemática.",
    viewFromHere: "Ver el cielo desde aquí", share: "Compartir", linkCopied: "Enlace copiado", linkFailed: "No se pudo copiar el enlace",
    postcard: "Postal", center: "Centrar",
  },
};

// textos de la ronda 2 (src/sky/i18n.js): mismas claves en ES y EN
for (const k of ["es", "en"]) TC[k] = { ...TC[k], ...TX[k] };

const FLAT_R = 900;
const BG_R = 1000;
function depthRadius(d) {
  if (!d || d <= 0) return FLAT_R;
  const dd = Math.min(d, 4000);
  const r = 50 + 13 * Math.sqrt(dd);   // raíz cuadrada: más cerca = más cerca, spread visible
  return Math.max(60, Math.min(1000, r));
}
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const prefersReducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

export default function Constellations({ lang = "es" }) {
  const t = TC[lang];
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [sky, setSky] = useState(null);
  const [sel, setSel] = useState(null);      // abbr or null
  const [depth, setDepth] = useState(0);     // 0..1
  const wrapRef = useRef(null);          // hueco en el flujo de la página; el visor se ensancha desde él
  const labelsApiRef = useRef(null);     // setter de etiquetas (viven en <SkyLabels>)
  const perfApiRef = useRef(null);       // setter del medidor de rendimiento (vive en <PerfMeter>)
  const [ready, setReady] = useState(false);
  const [datasets, setDatasets] = useState({}); // key -> {objects}
  const [enabled, setEnabled] = useState({});   // key -> bool
  const [selObj, setSelObj] = useState(null);
  const [viewFrom, setViewFrom] = useState(null); // null = Tierra; {name,pos:[x,y,z]} = otra estrella
  const [outside, setOutside] = useState(false);  // vista opcional: la esfera celeste entera, desde fuera
  const [wiki, setWiki] = useState(null);
  const place0 = useMemo(initialPlace, []);
  const [localMode, setLocalMode] = useState(place0.local);
  const [lat, setLat] = useState(place0.lat);
  const [lon, setLon] = useState(place0.lon);
  const [elev, setElev] = useState(place0.elev);   // altitud del lugar (m) o null si no se conoce (GPS sin altitud)
  const [elevPreset, setElevPreset] = useState(place0.preset);
  const [placeDefault, setPlaceDefault] = useState(place0.isDefault);   // Quito puesto por Teseo, no elegido
  useEffect(() => { if (place0.isDefault && place0.local) track("sky_location", { kind: "default" }); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // atmósfera (solo en Mi cielo) y contaminación lumínica elegida por lugar (localStorage)
  const [atmOn, setAtmOn] = useState(() => { try { return localStorage.getItem(ATM_KEY) !== "0"; } catch { return true; } });
  const [bortleMap, setBortleMap] = useState(loadBortleMap);
  const [dayHidden, setDayHidden] = useState(false);
  const [whenStr, setWhenStr] = useState(nowLocalInput());
  const [playing, setPlaying] = useState(false);
  const [showSolar, setShowSolar] = useState(true);
  const bodies = useMemo(() => withMags(ephemeris(new Date(whenStr))), [whenStr]);
  const [query, setQuery] = useState("");
  const [shareState, setShareState] = useState(null);   // null | "ok" | "fail"
  const [share, setShare] = useState(false);            // diálogo de compartir (vista previa de la postal)
  const [credit, setCredit] = useState(null);           // autor y licencia de la imagen de Wikipedia
  const [toast, setToast] = useState(null);             // aviso breve (aria-live): "Aquí está…", "bajo el horizonte…"
  const [pick, setPick] = useState(null);               // varios objetos en el mismo punto: lista para elegir
  const [showHint, setShowHint] = useState(() => { try { return !localStorage.getItem(HINT_KEY); } catch { return true; } });
  const dismissHint = useCallback(() => { setShowHint(false); try { localStorage.setItem(HINT_KEY, "1"); } catch { /* no-op */ } }, []);
  const pendingObjRef = useRef(null);   // objeto a restaurar desde la URL
  const hydratedRef = useRef(false);     // no escribir el hash antes de leerlo
  const [labelDensity, setLabelDensity] = useState("normal");
  // colores de las estrellas: realistas (suaves) por defecto; "resaltar" usa el color de cuerpo negro entero
  const [vividStars, setVividStars] = useState(() => { try { return localStorage.getItem(VIVID_KEY) === "1"; } catch { return false; } });
  STAR_MODE.vivid = vividStars;
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourAuto, setTourAuto] = useState(true);
  const [tourTitle, setTourTitle] = useState("");
  const [tourText, setTourText] = useState(null);
  const [tourTry, setTourTry] = useState(0);          // sube al reintentar la narración
  const [loadingLayer, setLoadingLayer] = useState({});
  const [layerError, setLayerError] = useState({});   // key -> true si falló la carga
  const [skyError, setSkyError] = useState(false);
  const [panel, setPanel] = useState(null);           // null | "layers" | "location" | "time"
  const [geo, setGeo] = useState("idle");             // idle | asking | ok | denied | unavailable | timeout | unsupported
  const [placeKind, setPlaceKind] = useState(place0.kind); // "me" | "custom" | nombre de ciudad
  const [wikiState, setWikiState] = useState("idle"); // idle | loading | done
  const [full, setFull] = useState(false);            // visor a pantalla completa
  const [timeMoved, setTimeMoved] = useState(false);  // false = se muestra "ahora"
  const [tourFact, setTourFact] = useState("");
  const [isWide, setIsWide] = useState(() => { try { return window.matchMedia("(min-width: 900px)").matches; } catch { return false; } });
  const isWideRef = useRef(isWide);
  const datasetsRef = useRef(datasets);
  const bodiesRef = useRef(bodies);
  // ── apuntar al cielo (sensores de orientación; solo dentro de Mi cielo) ──
  const [arCapable] = useState(pointingSupported);    // táctil + sensores + HTTPS
  const [ar, setAr] = useState("off");                // off | pending (falta ubicación) | on
  const [arSrc, setArSrc] = useState(null);           // null (esperando datos) | "absolute" | "relative"
  const [arError, setArError] = useState(null);       // null | "denied" | "nosensor"
  const [arAligned, setArAligned] = useState(() => pointAzOffset !== 0);
  const arHudRef = useRef(null);                      // setter del indicador (vive en <PointingBar>)
  const guideApiRef = useRef(null);                   // setter de la flecha guía (vive en <GuideHud>)
  const [guide, setGuide] = useState(null);           // objetivo a encontrar apuntando: { label, body | dir }
  const [arCtl, setArCtl] = useState(false);          // controles temporales mientras se apunta
  const [arHelp, setArHelp] = useState(false);        // ayuda de alineación (solo los primeros segundos)
  const [ctlBump, setCtlBump] = useState(0);          // cada toque en los controles reinicia su temporizador
  const [railOpen, setRailOpen] = useState(false);    // móvil: menú "más" (zoom, centrar, postal, pantalla completa)
  const railRef = useRef(null);
  const stageRef = useRef(null);
  const arOnRef = useRef(false);
  const panelRef = useRef(null);
  const pointRef = useRef(null);
  if (!pointRef.current) {
    pointRef.current = createPointing((s) => {
      if (s === "denied" || s === "nosensor") { setAr("off"); setArSrc(null); setArError(s); track("sky_ar", { state: s }); }
      else setArSrc(s === "absolute" || s === "relative" ? s : null);
    });
  }
  const selObjRef = useRef(null);
  useEffect(() => { selObjRef.current = selObj; }, [selObj]);
  useEffect(() => { panelRef.current = panel; }, [panel]);
  // patrones llamativos de cada capa, contados en los datos cargados
  const notes = useMemo(() => buildSkyNotes(datasets), [datasets]);
  // dirección (centroide) de cada constelación, para "Esta noche" y la flecha guía
  const conDirs = useMemo(() => {
    if (!sky) return [];
    const byHip = new Map(); sky.stars.forEach((st) => byHip.set(st[0], st));
    return sky.constellations.map((c) => {
      let x = 0, y = 0, z = 0; const seen = new Set();
      c.lines.forEach((pl) => pl.forEach((h) => { if (seen.has(h)) return; seen.add(h); const st = byHip.get(h); if (st) { x += st[1]; y += st[2]; z += st[3]; } }));
      const L = Math.hypot(x, y, z);
      return L > 0 ? { ab: c.ab, name: c.la, dir: [x / L, y / L, z / L] } : null;
    }).filter(Boolean);
  }, [sky]);
  // constelación → objeto seleccionable (abre su ficha)
  const conObj = useCallback((ab) => {
    const c = conDirs.find((x) => x.ab === ab);
    if (!c) return null;
    const meta = sky.constellations.find((x) => x.ab === ab), d = meta && constellationData(meta, sky.stars);
    return { layer: "con", ab, name: c.name, nx: c.dir[0], ny: c.dir[1], nz: c.dir[2], rad: d ? d.radius : 0.2 };
  }, [conDirs, sky]);
  const conObjRef = useRef(conObj);
  useEffect(() => { conObjRef.current = conObj; }, [conObj]);
  const conDirsRef = useRef(conDirs);
  useEffect(() => { conDirsRef.current = conDirs; }, [conDirs]);
  const langRef = useRef(lang);
  useEffect(() => { isWideRef.current = isWide; }, [isWide]);
  useEffect(() => { datasetsRef.current = datasets; }, [datasets]);
  useEffect(() => { bodiesRef.current = bodies; }, [bodies]);
  // abreviatura IAU (p.ej. "Sgr") -> nombre de constelación, para que buscar
  // "sagit(tarius)" encuentre objetos cuyo nombre usa la abreviatura ("Sgr A*").
  const abbrevExpand = useMemo(() => {
    const m = {};
    if (sky) for (const c of sky.constellations) m[c.ab.toLowerCase()] = (c.la + " " + c.en).toLowerCase();
    return m;
  }, [sky]);

  // término de categoría detectado (para listar la capa entera)
  const catMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return null;
    return CATEGORY_TERMS.find(c => c.terms.some(t => t.startsWith(q) || t === q || t.includes(q))) || null;
  }, [query]);

  // si se busca una categoría cuya capa aún no está cargada (diferida/backend),
  // se activa para poder listarla en los resultados.
  useEffect(() => {
    if (catMatch && !datasets[catMatch.key]) {
      setEnabled(e => e[catMatch.key] ? e : ({ ...e, [catMatch.key]: true }));
    }
  }, [catMatch, datasets]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !sky) return [];
    // búsqueda por categoría: lista los objetos de esa capa
    if (catMatch) {
      const ds = datasets[catMatch.key];
      const layerName = LAYERS.find(l => l.key === catMatch.key)?.[lang] || catMatch.key;
      if (!ds || !ds.objects) {
        if (layerError[catMatch.key]) return [{ type: "loading", label: TC[lang].failedLayer(layerName) }];
        return [{ type: "loading", label: TC[lang].loadingLayer(layerName) }];
      }
      return ds.objects.slice(0, 14).map(o => ({ type: "layer", layer: catMatch.key, obj: o, label: labelForObj(catMatch.key, o, lang), kind: layerName }));
    }
    // texto extra de la constelación asociada (por campo `const` o por la
    // primera palabra del nombre si es una abreviatura IAU de 3 letras)
    const conExp = (name, constAb) => {
      let extra = "";
      if (constAb && abbrevExpand[constAb.toLowerCase()]) extra += " " + abbrevExpand[constAb.toLowerCase()];
      const first = (name || "").split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
      if (first.length === 3 && abbrevExpand[first]) extra += " " + abbrevExpand[first];
      return extra;
    };
    const score = (label) => {
      const l = label.toLowerCase();
      return l.startsWith(q) ? 0 : (" " + l).includes(" " + q) ? 1 : 2;
    };
    const r = [];
    const kinds = TC[lang].kinds;
    for (const b of bodies) if ((b.name + " " + bodyName(b.name, "en")).toLowerCase().includes(q)) r.push({ type: "solar", body: b, label: bodyName(b.name, lang), kind: kinds.solar });
    for (const c of sky.constellations) if ((c.la + " " + c.en).toLowerCase().includes(q)) r.push({ type: "con", ab: c.ab, label: `${c.la} · ${c.en}`, kind: kinds.con });
    sky.stars.forEach((st, si) => { if (st[7] && st[7].toLowerCase().includes(q)) r.push({ type: "star", st, si, label: st[7], kind: kinds.star }); });
    // capas de objetos: Messier / agujeros negros / meteoros siempre están
    // cargadas; el resto solo si el usuario activó su capa.
    for (const key of ["messier", "blackholes", "meteors", "galaxies", "pulsars", "comets", "probes", "exoplanets"]) {
      const ds = datasets[key];
      if (!ds || !ds.objects) continue;
      const layerName = LAYERS.find(l => l.key === key)?.[lang] || key;
      for (const o of ds.objects) {
        const hay = (o.name + " " + (o.cn || "") + " " + (o.cat || "") + " " + (o.name_en || "") + conExp(o.name, o.const)).toLowerCase();
        if (hay.includes(q)) r.push({ type: "layer", layer: key, obj: o, label: labelForObj(key, o, lang), kind: layerName });
      }
      if (r.length > 60) break;
    }
    r.sort((a, b) => score(a.label) - score(b.label));
    return r.slice(0, 8);
  }, [query, sky, datasets, bodies, abbrevExpand, catMatch, lang, layerError]);
  const depthRef = useRef(0);
  const selRef = useRef(null);
  const pendingTries = useRef({}), pendingTimers = useRef([]);

  useEffect(() => { depthRef.current = depth; }, [depth]);
  useEffect(() => { selRef.current = sel; }, [sel]);

  // Carga inicial: solo la base + catálogos pequeños (Messier/agujeros negros, ~20 KB).
  // Los catálogos grandes (púlsares ~500KB, galaxias ~320KB) y los del backend
  // (exoplanetas ~780KB) se cargan solo al activar su capa.
  const loadSky = useCallback(() => {
    setSkyError(false);
    fetchJson("/sky.json").then(setSky).catch(() => setSkyError(true));
  }, []);
  // Una capa (fichero estático o backend). El error se marca ANTES de quitar el
  // estado de carga: así el efecto de "bajo demanda" nunca ve una capa fallida
  // como pendiente y no la vuelve a pedir en bucle; solo "Reintentar" lo hace.
  const loadLayer = useCallback((cfg) => {
    const url = cfg.api ? `${API}${cfg.endpoint}` : cfg.file;
    setLoadingLayer(p => ({ ...p, [cfg.key]: true }));
    setLayerError(p => ({ ...p, [cfg.key]: false }));
    fetchJson(url, { timeout: cfg.timeout || TIMEOUT_MS })
      .then(d => {
        // datos de una consulta anterior del backend: la ficha lo avisa
        if (d && d.stale && Array.isArray(d.objects)) d.objects.forEach((o) => { o._stale = true; });
        setDatasets(prev => ({ ...prev, [cfg.key]: d }));
        // el backend aún está pidiendo objetos a Horizons: se vuelve a preguntar (pocas veces, sin estado de carga)
        if (d && d.pending > 0 && cfg.api) {
          const n = (pendingTries.current[cfg.key] || 0) + 1;
          pendingTries.current[cfg.key] = n;
          if (n <= 6) pendingTimers.current.push(setTimeout(() => {
            fetchJson(url, { timeout: cfg.timeout || TIMEOUT_MS }).then(d2 => {
              if (!d2 || !Array.isArray(d2.objects) || d2.objects.length < (d.objects || []).length) return;
              if (d2.stale) d2.objects.forEach((o) => { o._stale = true; });
              setDatasets(prev => ({ ...prev, [cfg.key]: d2 }));
            }).catch(() => { /* se queda con lo que ya hay */ });
          }, 5000 * n));
        }
      })
      .catch(() => setLayerError(p => ({ ...p, [cfg.key]: true })))
      .finally(() => setLoadingLayer(p => ({ ...p, [cfg.key]: false })));
  }, []);
  useEffect(() => () => { pendingTimers.current.forEach(clearTimeout); }, []);
  useEffect(() => {
    loadSky();
    LAYERS.filter(c => !c.api && !c.lazy).forEach(loadLayer);
  }, [loadSky, loadLayer]);
  // Capas pesadas: bajo demanda. Fichero estático (lazy) o backend (api).
  useEffect(() => {
    LAYERS.filter(c => c.api || c.lazy).forEach((cfg) => {
      if (enabled[cfg.key] && !datasets[cfg.key] && !loadingLayer[cfg.key] && !layerError[cfg.key]) {
        loadLayer(cfg);
      }
    });
  }, [enabled, datasets, loadingLayer, layerError, loadLayer]);

  // ── deep-links: el estado se lee del hash al montar y cada vez que cambia con la app abierta ──
  const lastHashRef = useRef(null);       // último hash escrito por la propia vista (para no releerlo)
  const applyHash = useCallback((initial) => {
    try {
      const h = window.location.hash || "";
      if (!h.startsWith("#sky")) return;
      const qi = h.indexOf("?");
      const p = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : "");
      const L = p.get("L");
      if (L) setEnabled(e => { const n = { ...e }; L.split(",").forEach(k => { if (k) n[k] = true; }); return n; });
      const c = p.get("c"), v = p.get("v"), o = p.get("o");
      let vf = null;
      if (v) { const q = v.split("~"); const pos = [+q[1], +q[2], +q[3]]; if (pos.every(Number.isFinite)) vf = { name: decodeURIComponent(q[0]), pos }; }
      if (c || vf) setLocalMode(false);          // incompatible con Mi cielo: el enlace gana (no se guarda)
      if (initial) { if (c) setSel(c); if (vf) setViewFrom(vf); }
      else { setSel(c || null); setViewFrom(vf); setDepth(0); setPanel(null); setTourActive(false); if (!o) setSelObj(null); }
      pendingObjRef.current = o || null;
      if (!initial) setHashTick(n => n + 1);     // vuelve a intentar restaurar el objeto con los datos ya cargados
    } catch { /* hash inválido: se ignora */ }
  }, []);
  const [hashTick, setHashTick] = useState(0);
  useEffect(() => {
    applyHash(true);
    hydratedRef.current = true;
    const onHash = () => { if (window.location.hash !== lastHashRef.current) applyHash(false); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [applyHash]);

  // restaurar el objeto seleccionado del hash cuando lleguen los datos
  useEffect(() => {
    const o = pendingObjRef.current; if (!o || !sky) return;
    const sep = o.indexOf("~"); if (sep < 0) { pendingObjRef.current = null; return; }
    const layer = o.slice(0, sep), name = decodeURIComponent(o.slice(sep + 1));
    if (layer === "star") {
      const st = sky.stars.find(s => s[7] === name);
      if (st) { setSelObj(starObj(st, sky.stars.indexOf(st))); pendingObjRef.current = null; }
      return;
    }
    if (layer === "con") {
      const co = conObj(name);
      if (co) setSelObj(co);
      pendingObjRef.current = null;
      return;
    }
    if (layer === "solar") {
      const b = bodiesRef.current.find(x => x.name === name);
      if (b) setSelObj({ ...b, layer: "solar" });
      pendingObjRef.current = null;
      return;
    }
    if (!enabled[layer]) { setEnabled(e => ({ ...e, [layer]: true })); return; } // esperar a que cargue
    const ds = datasets[layer];
    if (ds && ds.objects) {
      const ob = ds.objects.find(x => x.name === name);
      if (ob) setSelObj({ ...ob, layer });
      pendingObjRef.current = null;
    }
  }, [sky, datasets, enabled, hashTick]);   // eslint-disable-line react-hooks/exhaustive-deps

  // escribir el estado al hash (para compartir el enlace)
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      const p = new URLSearchParams();
      const on = Object.keys(enabled).filter(k => enabled[k]);
      if (on.length) p.set("L", on.join(","));
      if (sel) p.set("c", sel);
      if (viewFrom) p.set("v", encodeURIComponent(viewFrom.name) + "~" + viewFrom.pos.map(n => n.toFixed(3)).join("~"));
      if (PERF_ON) p.set("fps", "1");
      if (ADAPT_OFF) p.set("adapt", "0");           // el medidor sobrevive a la reescritura del enlace
      if (E2E) p.set("e2e", "1");
      if (selObj && selObj.name && selObj.layer !== "note") p.set("o", selObj.layer + "~" + encodeURIComponent(selObj.layer === "con" ? selObj.ab : selObj.name));
      else if (pendingObjRef.current) p.set("o", pendingObjRef.current);   // aún restaurándose: no se pierde del enlace
      const qs = p.toString();
      const nh = "#sky" + (qs ? "?" + qs : "");
      lastHashRef.current = nh;
      if (window.location.hash !== nh) window.history.replaceState(null, "", nh);
    } catch { /* no-op */ }
  }, [enabled, sel, viewFrom, selObj]);

  const shareTimer = useRef(0);
  const shareLink = useCallback(async () => {
    const url = window.location.href;
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); ok = true; }
    } catch { ok = false; }
    if (!ok) {
      // respaldo para contextos sin permiso de portapapeles
      try {
        const ta = document.createElement("textarea");
        ta.value = url; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    setShareState(ok ? "ok" : "fail");
    track("sky_share", { state: ok ? "ok" : "fail" });
    clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareState(null), 2400);
  }, []);
  useEffect(() => () => clearTimeout(shareTimer.current), []);

  // Build scene once data is ready
  useEffect(() => {
    if (!sky || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth, H = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04080f, 0.00018);
    // el observador está EN EL CENTRO de la esfera celeste: la cámara solo gira (src/sky/look.js)
    const camera = new THREE.PerspectiveCamera(spanToFov(SPAN_DEF, W / H), W / H, 0.1, 6000);
    camera.position.set(0, 0, 0);
    // sin preserveDrawingBuffer: la postal vuelve a renderizar justo antes de copiar el lienzo
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    // densidad de píxeles: como mucho 2 (por encima la GPU pinta 2–3× más píxeles sin ganancia visible) y,
    // si los FPS caen de forma sostenida, baja por escalones y se restaura al mejorar (src/sky/perf.js)
    const basePR = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(basePR);
    const adaptive = createAdaptive({ max: basePR });
    const frameStats = createFrameStats(600);
    mount.appendChild(renderer.domElement);

    // OrbitControls solo para lo que se ve desde fuera (profundidad real de una constelación y la
    // vista opcional "la esfera desde fuera"); desde dentro manda la mirada propia (ref.look).
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 50;
    controls.maxDistance = 3000;
    controls.enabled = false;
    controls.target.set(0, 0, -1);
    const calm = prefersReducedMotion();
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.15;

    // index stars by hip
    const byHip = new Map();
    sky.stars.forEach(s => byHip.set(s[0], s));
    const asterHips = new Set();
    sky.constellations.forEach(c => c.lines.forEach(p => p.forEach(h => asterHips.add(h))));

    // ── background + asterism star points ──
    const N = sky.stars.length;
    const posFlat = new Float32Array(N * 3);
    const posDeep = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const starBright = new Float32Array(N);
    // atmósfera (src/sky/atmosphere.js): opacidad y enrojecimiento por estrella; visible = 1/0 (nombres y toques)
    const atmAlpha = new Float32Array(N).fill(1), atmRed = new Float32Array(N), starVis = new Uint8Array(N).fill(1);
    const hipIndex = new Map();
    sky.stars.forEach((s, i) => {
      const [hip, nx, ny, nz, mag, hex, dist] = s;
      hipIndex.set(hip, i);
      const rf = FLAT_R, rd = depthRadius(dist);
      posFlat[i*3] = nx*rf; posFlat[i*3+1] = ny*rf; posFlat[i*3+2] = nz*rf;
      posDeep[i*3] = nx*rd; posDeep[i*3+1] = ny*rd; posDeep[i*3+2] = nz*rd;
      let [r,g,b] = hexToRgb(starTint(s));
      const isAster = asterHips.has(hip);
      // Tamaño y brillo según el flujo real F ∝ 10^(−0,4·m): el diámetro del destello crece como F^0,25 y
      // el brillo como F^0,12, compresiones habituales en planetarios porque una pantalla no reproduce el rango real
      // (Sirio es ~600 veces más brillante que una estrella de magnitud 5,5). Las estrellas de las figuras
      // solo reciben un mínimo suave para que las líneas no queden colgando de puntos invisibles.
      let bright = Math.max(0.25, Math.min(1, Math.pow(10, -0.4 * (mag - 1.0) * 0.3)));
      if (isAster) bright = Math.max(bright, 0.5);
      colors[i*3]=r*bright; colors[i*3+1]=g*bright; colors[i*3+2]=b*bright;
      starBright[i] = bright;
      sizes[i] = Math.max(isAster ? 4.5 : 3.2, Math.min(30, 13.0 * Math.pow(10, -0.1 * (mag - 1.0))));
    });
    // precálculo para etiquetas LOD
    const namedStars = [];
    sky.stars.forEach((st, i) => { if (st[7]) namedStars.push({ i, mag: st[4], name: st[7] }); });
    namedStars.sort((a, b) => a.mag - b.mag);
    const conCentroid = {};
    sky.constellations.forEach(c => {
      const idxs = []; const seen = new Set();
      c.lines.forEach(pl => pl.forEach(h => { if (!seen.has(h)) { seen.add(h); const ii = hipIndex.get(h); if (ii != null) idxs.push(ii); } }));
      conCentroid[c.ab] = { idxs, name: c.la };
    });

    const sGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(posFlat.slice(), 3);
    sGeo.setAttribute("position", posAttr);
    sGeo.setAttribute("scolor", new THREE.BufferAttribute(colors, 3));
    sGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const starTex = makeStarTexture();
    const sMat = new THREE.ShaderMaterial({
      // uScale: estrellas más grandes al apuntar al cielo; uPx: 1 a la resolución base y < 1 cuando la
      // resolución adaptativa la baja, para que las estrellas conserven su tamaño aparente
      // uDpr: el tamaño de gl_PointSize está en píxeles del dispositivo; se multiplica por la densidad para
      // que en un teléfono (densidad 2–3) las estrellas no queden a la mitad del tamaño que en un PC
      uniforms: { map: { value: starTex }, uScale: { value: 1 }, uPx: { value: 1 }, uDpr: { value: basePR } },
      vertexShader: [
        "uniform float uScale;",
        "uniform float uPx;",
        "uniform float uDpr;",
        "attribute float size;",
        "attribute vec3 scolor;",
        "varying vec3 vColor;",
        "void main(){",
        "  vColor = scolor;",
        "  vec4 mv = modelViewMatrix * vec4(position,1.0);",
        "  gl_PointSize = clamp(size * uScale * (520.0 / -mv.z), 1.5, 34.0) * uPx * uDpr;",
        "  gl_Position = projectionMatrix * mv;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D map;",
        "varying vec3 vColor;",
        "void main(){",
        "  vec4 t = texture2D(map, gl_PointCoord);",
        "  if (t.a < 0.02) discard;",
        "  gl_FragColor = vec4(vColor, 1.0) * t;",
        "}",
      ].join("\n"),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(sGeo, sMat);
    scene.add(points);

    // ── constellation lines ──
    const segHips = []; // pairs of hip
    const conMeta = {};
    sky.constellations.forEach(c => {
      conMeta[c.ab] = c;
      c.lines.forEach(poly => {
        for (let k = 0; k < poly.length - 1; k++) {
          if (hipIndex.has(poly[k]) && hipIndex.has(poly[k+1]))
            segHips.push([poly[k], poly[k+1], c.ab]);
        }
      });
    });
    const L = segHips.length;
    const lPos = new Float32Array(L * 6);
    const lCol = new Float32Array(L * 6);
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3));
    lGeo.setAttribute("color", new THREE.BufferAttribute(lCol, 3));
    const lMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 });
    const lines = new THREE.LineSegments(lGeo, lMat);
    scene.add(lines);

    // Tierra real (NASA Blue Marble) en el centro = el observador
    const earthTex = new THREE.TextureLoader().load("/earth.jpg");
    earthTex.colorSpace = THREE.SRGBColorSpace;
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(7, 48, 48),
      new THREE.MeshBasicMaterial({ map: earthTex })
    );
    earth.rotation.z = 0.41;
    earth.visible = false;                 // desde dentro el observador ES la Tierra: solo se ve desde fuera
    scene.add(earth);

    // grupo de horizonte (modo cielo local)
    const horizon = new THREE.Group();
    const harr = [];
    for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; harr.push(Math.cos(a) * 905, 0, Math.sin(a) * 905); }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute("position", new THREE.Float32BufferAttribute(harr, 3));
    const horizonLine = new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: 0x8ab8ff, transparent: true, opacity: 0.85, depthTest: false }));
    horizonLine.renderOrder = 3; horizon.add(horizonLine);
    // Suelo SOMBREADO (hasta que haya un paisaje): oscurece lo que queda bajo el horizonte pero deja verlo
    // (opacidad ~0,68 lejos del horizonte, más clara junto a él) y se distingue del cielo diurno.
    // Se dibuja después de estrellas, líneas y planetas; los objetos de abajo siguen siendo tocables.
    const groundMat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(0x05070e) }, uMax: { value: 0.68 }, uEdge: { value: new THREE.Color(0x1b2338) } },
      vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: [
        "uniform vec3 uCol; uniform vec3 uEdge; uniform float uMax; varying vec2 vP;",
        "void main(){",
        "  float r = clamp(length(vP) / 905.0, 0.0, 1.0);",            // 0 = nadir, 1 = horizonte
        "  float a = uMax * (1.0 - 0.45 * smoothstep(0.55, 1.0, r));",   // más claro junto al horizonte
        "  vec3 c = mix(uCol, uEdge, smoothstep(0.6, 1.0, r));",
        "  gl_FragColor = vec4(c, a);",
        "}",
      ].join("\n"),
      transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: false, fog: false,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(905, 96), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; ground.renderOrder = 2; horizon.add(ground);
    const cardinals = {};
    [["N", 0, -905], ["E", 905, 0], ["S", 0, 905], ["O", -905, 0], ["W", -905, 0]].forEach(([tt, x, z]) => {
      const sp = makeTextSprite(tt); sp.position.set(x, 20, z); horizon.add(sp); cardinals[tt] = sp;
    });
    // los puntos cardinales se dibujan como etiquetas HTML (8 rumbos, legibles a cualquier zoom; ver el bucle):
    // los sprites quedan ocultos y solo se conservan por compatibilidad
    for (const k in cardinals) cardinals[k].visible = false;
    horizon.visible = false; scene.add(horizon);
    // domo de atmósfera (src/sky/atmosphereLayer.js): se dibuja primero y debajo de todo
    const atm = createAtmosphereLayer();
    scene.add(atm.mesh);

    // Sol, Luna y planetas (efemérides reales)
    const solarGroup = new THREE.Group(); scene.add(solarGroup);
    // Cada cuerpo es un disco con su textura real (o la de respaldo si aún no
    // existe el archivo) y un halo de su color. Se dibujan agrandados para que
    // se encuentren: no representan su tamaño aparente real.
    const solarSprites = {}, solarCanvas = {}, solarImg = {}, solarTex = {};
    let sceneDead = false;
    BODY_NAMES.forEach(nm => {
      const b = BODIES[nm];
      const c = document.createElement("canvas"); c.width = c.height = SPRITE_PX;
      drawBodySprite(c, nm, null, null);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      // tamaño fijo en pantalla (no crece al acercarse): es un marcador, no una escala
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false }));
      sp.userData.px = b.ring ? 118 : 40 + b.size * 2.6;                       // lado del sprite en px
      sp.userData.discPx = sp.userData.px * (b.ring ? 21 : b.id === "sun" ? 26 : 28) / SPRITE_PX;  // radio del disco en px
      solarGroup.add(sp); solarSprites[nm] = sp; solarCanvas[nm] = c; solarTex[nm] = tex;
      const img = new Image();
      img.onload = () => {
        if (sceneDead) return;
        solarImg[nm] = img;
        drawBodySprite(c, nm, img, nm === "Luna" ? (sceneRef.current && sceneRef.current.moonPhase) : null);
        tex.needsUpdate = true;
      };
      img.onerror = () => { /* textura aún no publicada (p. ej. marte, venus): queda el disco de respaldo */ };
      img.src = textureUrl(b.id);
    });
    const sizeSolar = () => {
      const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / (mount.clientHeight || 1);
      for (const nm in solarSprites) { const v = solarSprites[nm].userData.px * k; solarSprites[nm].scale.set(v, v, 1); }
    };
    sizeSolar();
    // modo apuntar: el zoom es el campo de visión. `span` = grados que abarca el lado largo.
    const applyArFov = () => {
      const st = sceneRef.current && sceneRef.current.ar; if (!st) return;
      camera.fov = spanToFov(st.span, camera.aspect);
      camera.updateProjectionMatrix();
      sizeSolar();
    };
    // campo de visión según el modo: desde dentro lo da look.span (el zoom); desde fuera, fijo
    const applyFov = () => {
      const r = sceneRef.current; if (!r) return;
      if (r.ar.on) { applyArFov(); return; }
      if (r.mode === "in") {
        camera.fov = spanToFov(r.look.span, camera.aspect);
        r.points.material.uniforms.uScale.value = starScaleFor(camera.fov);
      } else {
        camera.fov = 55;
        r.points.material.uniforms.uScale.value = 1;
      }
      camera.updateProjectionMatrix();
      sizeSolar();
    };
    const redrawMoon = (phase) => {
      drawBodySprite(solarCanvas["Luna"], "Luna", solarImg["Luna"] || null, phase);
      solarTex["Luna"].needsUpdate = true;
    };

    // ── el Sol visto desde otro punto (oculto salvo en "ver desde otra estrella") ──
    const sunSprite = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const cx2 = c.getContext("2d");
      const g = cx2.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.3, "#fff2b0");
      g.addColorStop(0.8, "#ffcf5a"); g.addColorStop(1, "rgba(0,0,0,0)");
      cx2.fillStyle = g; cx2.beginPath(); cx2.arc(32, 32, 30, 0, Math.PI * 2); cx2.fill();
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
      sp.scale.set(24, 24, 1); sp.visible = false; scene.add(sp);
      return sp;
    })();

    // Reproyecta TODO el cielo desde un nuevo punto de observación, por paralaje
    // real: cada estrella tiene posición 3D = dirección × distancia_ly, así que
    // desde el nuevo origen su dirección y distancia se recalculan de verdad.
    // origin = [x,y,z] en años luz, o null para volver a la Tierra/Sol.
    const applyViewpoint = (origin) => {
      const stars = sky.stars;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        let dirx = s[1], diry = s[2], dirz = s[3], dd = s[6];
        if (origin && s[6] > 0) {
          const dx = s[1] * s[6] - origin[0], dy = s[2] * s[6] - origin[1], dz = s[3] * s[6] - origin[2];
          const len = Math.hypot(dx, dy, dz);
          if (len > 1e-6) { dirx = dx / len; diry = dy / len; dirz = dz / len; dd = len; }
        }
        const rd = depthRadius(dd);
        posFlat[i*3] = dirx*FLAT_R; posFlat[i*3+1] = diry*FLAT_R; posFlat[i*3+2] = dirz*FLAT_R;
        posDeep[i*3] = dirx*rd; posDeep[i*3+1] = diry*rd; posDeep[i*3+2] = dirz*rd;
      }
      // El Sol: desde otra estrella es una estrella más, en dirección -origin, a |origin| ly.
      if (origin) {
        const len = Math.hypot(origin[0], origin[1], origin[2]) || 1;
        sunSprite.position.set(-origin[0]/len*FLAT_R, -origin[1]/len*FLAT_R, -origin[2]/len*FLAT_R);
        sunSprite.visible = true; if (earth) earth.visible = false;
      } else {
        sunSprite.visible = false; if (earth) earth.visible = true;
      }
      posAttr.needsUpdate = true;
    };

    // color de cada estrella = tinte × brillo × opacidad por atmósfera, con enrojecimiento cerca del horizonte
    const paintStars = () => {
      sky.stars.forEach((s, i) => {
        const [r, g, b] = hexToRgb(starTint(s)), k = starBright[i] * atmAlpha[i], red = atmRed[i];
        colors[i*3] = r*k; colors[i*3+1] = g*k*(1 - 0.35*red); colors[i*3+2] = b*k*(1 - 0.7*red);
      });
      sGeo.attributes.scolor.needsUpdate = true;
    };
    sceneRef.current = { scene, camera, renderer, controls, points, lines,
      posFlat, posDeep, posAttr, segHips, hipIndex, conMeta, lPos, lCol, byHip, sizes, N,
      // "resaltar colores": vuelve a teñir las estrellas sin reconstruir la escena
      recolorStars: () => paintStars(),
      atm, atmAlpha, starVis, atmOn: false, lineBase: 0.55, groundMat,
      markerTex: starTex, layerObjs: [], namedStars, conCentroid, horizon, localQuat: new THREE.Quaternion(), localModeOn: false, earth, solarGroup, solarSprites, bodies: [], showSolar: true,
      sunSprite, applyViewpoint, redrawMoon, moonPhase: null, cardinals, lang: langRef.current, sizeSolar, applyArFov, applyFov, ground,
      // ── la mirada desde dentro: "in" = en el centro (por defecto); "depth" y "out" = OrbitControls ──
      mode: "in",
      look: { yaw: 0, pitch: 0, span: SPAN_DEF, spanT: SPAN_DEF, vy: 0, vp: 0, drag: false, fly: null, local: false, qF: lookFrame(false), minPitch: PITCH_MIN_FREE },
      // apuntar al cielo: objetos fijos que el bucle reutiliza (nada se crea por frame)
      ar: { on: false, has: false, t: 0, n: 0, decl: 0, north: false, span: POINT_SPAN, alt: 0, cur: new THREE.Quaternion(), tgt: new THREE.Quaternion(), arr: [0, 0, 0, 1], look: { alt: 0, az: 0 }, g: {}, look2: {} },
      guide: null, fly: null, _labels: [], notes: [], noteTags: {}, when: new Date(), occl: [], _occN: 0,
      wake: () => { wakeUntil = performance.now() + 500; }, perf: { stats: frameStats, adaptive, basePR, idle: false, drawn: 0 },
      viewShift: { x: 0, yf: 0, cx: 0, cy: 0, dirty: false } };
    {
      const r = sceneRef.current, lk = r.look, ypTmp = {};
      // dirección hacia la que se mira (mundo). Desde fuera: el centro de la cara que da a la cámara.
      r.fwd = (out = new THREE.Vector3()) => {
        if (r.mode === "out") return out.copy(camera.position).normalize();
        return out.set(0, 0, -1).applyQuaternion(camera.quaternion);
      };
      const setDir = (d) => { dirToYawPitch(d, lk.qF, ypTmp); lk.yaw = ypTmp.yaw; lk.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, ypTmp.pitch)); };
      // girar la mirada hacia `dir` (mundo) y encuadrar con `span` (grados del lado largo); vuela salvo `instant`
      r.lookAt = (dir, span, instant) => {
        const to = dir.clone().normalize(), s1 = clampSpan(span == null ? lk.spanT : span);
        lk.vy = lk.vp = 0;
        const from = yawPitchToDir(lk.yaw, lk.pitch, lk.qF);
        if (instant || calm || r.mode !== "in" || (from.angleTo(to) < 0.005 && Math.abs(s1 - lk.span) < 0.05)) {
          lk.fly = null; setDir(to); lk.span = lk.spanT = s1; applyFov(); return;
        }
        const ang = from.angleTo(to);
        lk.fly = { from, q: new THREE.Quaternion().setFromUnitVectors(from, to), to, t0: performance.now(), dur: 450 + 550 * Math.min(1, ang / 2), s0: lk.span, s1 };
        lk.spanT = s1;
      };
      // marco de la mirada: local (Mi cielo, con horizonte) o ecuatorial (norte celeste arriba)
      r.setFrame = (local) => {
        lk.local = !!local; lk.qF = lookFrame(!!local); lk.minPitch = local ? PITCH_MIN_LOCAL : PITCH_MIN_FREE; lk.fly = null; lk.vy = lk.vp = 0;
      };
      // mirada por defecto: sin ubicación, Orión (reconocible y alto en las noches de noviembre);
      // en Mi cielo, hacia el este (trópico) o el ecuador celeste, a 35° de altura
      r.defaultDir = () => {
        if (lk.local) {
          const lat = r.localLat == null ? 0 : r.localLat;
          return yawPitchToDir(localDefaultAz(lat) * Math.PI / 180, LOCAL_ALT_DEF * Math.PI / 180, lk.qF);
        }
        const c = conCentroid.Ori, v = new THREE.Vector3();
        if (c && c.idxs.length) for (const i of c.idxs) v.add(new THREE.Vector3(posFlat[i * 3], posFlat[i * 3 + 1], posFlat[i * 3 + 2]));
        return v.lengthSq() > 0 ? v.normalize() : new THREE.Vector3(0, 1, 0);
      };
      // Aplica la atmósfera (st = skyState(...) o null). Recalcula qué se ve: estrellas, planetas y objetos de
      // cielo profundo con magnitud. Solo al cambiar la hora, el lugar o la clase de Bortle, nunca por cuadro.
      const qv = new THREE.Vector3(), dv = [0, 0, 0];
      r.applyAtm = (st) => {
        const q = r.localQuat;
        const dirOf = (nx, ny, nz) => { qv.set(nx, ny, nz).applyQuaternion(q); dv[0] = qv.x; dv[1] = qv.y; dv[2] = qv.z; return dv; };
        let nStars = 0;
        if (!st) { atmAlpha.fill(1); atmRed.fill(0); starVis.fill(1); }
        else {
          const stars = sky.stars;
          for (let i = 0; i < stars.length; i++) {
            const s = stars[i], d = dirOf(s[1], s[2], s[3]);
            // bajo el horizonte manda el suelo sombreado (deja ver y tocar lo que hay debajo), no la atmósfera
            if (d[1] <= 0) { atmAlpha[i] = 1; atmRed[i] = 0; starVis[i] = 1; continue; }
            const v = visibility({ mag: s[4], dir: d }, st);
            atmAlpha[i] = v.alpha; atmRed[i] = v.visible ? Math.min(1, v.reddening / 1.2) : 0; starVis[i] = v.visible ? 1 : 0;
            if (v.visible) nStars++;
          }
        }
        paintStars();
        r.atmOn = !!st;
        atm.update(st);
        atm.setEnabled(!!st);
        lines.material.opacity = st && starsHidden(st) ? 0.22 : r.lineBase;
        // Sol, Luna y planetas: el disco se sigue dibujando (con tamaño visible), más tenue si no se ve
        r.solarVis = {};
        for (const b of (r.bodies || [])) {
          const sp = r.solarSprites[b.name]; if (!sp) continue;
          let vis = true, alpha = 1;
          if (st && b.name !== "Sol" && b.mag != null) {
            const v = visibility({ mag: b.mag, dir: dirOf(b.nx, b.ny, b.nz) }, st);
            vis = v.visible || dv[1] <= 0;            // bajo el horizonte lo decide el suelo, no la atmósfera
            alpha = dv[1] <= 0 ? 1 : v.visible ? Math.max(0.6, v.alpha) : 0.3;
          }
          sp.material.opacity = alpha; r.solarVis[b.name] = vis;
        }
        // cielo profundo con magnitud (Messier, galaxias): se ocultan los que no se verían
        let nDeep = 0, nDeepTot = 0;
        for (const o of (r.layerObjs || [])) {
          const ud = o.points.userData; if (!ud.baseCol) continue;
          const col = o.points.geometry.attributes.color, arr = col.array;
          for (let i = 0; i < ud.objs.length; i++) {
            const ob = ud.objs[i];
            let a = 1;
            const d = st ? dirOf(ob.nx, ob.ny, ob.nz) : null;
            if (st && d[1] > 0) {
              const v = visibility({ mag: (ob.mag ?? 99) + extPenalty(ud.layer, ob), dir: d }, st);
              a = v.visible ? Math.max(0.55, v.alpha) : 0;
              ud.vis[i] = v.visible ? 1 : 0;
              if (o.points.visible && ud.layer === "messier") { nDeepTot++; if (v.visible) nDeep++; }
            } else ud.vis[i] = 1;                     // sin atmósfera o bajo el horizonte (lo cubre el suelo)
            arr[i*3] = ud.baseCol[i*3] * a; arr[i*3+1] = ud.baseCol[i*3+1] * a; arr[i*3+2] = ud.baseCol[i*3+2] * a;
          }
          col.needsUpdate = true;
        }
        r.atmCounts = { stars: st ? nStars : null, deep: st && nDeepTot ? nDeep : null, deepTot: nDeepTot };
        if (r.wake) r.wake();
        return r.atmCounts;
      };
      setDir(r.defaultDir());
      camera.quaternion.copy(lookQuat(lk.yaw, lk.pitch, lk.qF));
      applyFov();
      if (E2E) window.__teseoSky = {
        cam: () => ({ fov: camera.fov, aspect: camera.aspect, q: camera.quaternion.toArray(), p: camera.position.toArray(), mode: r.mode, ar: r.ar.on, local: r.localModeOn, localQuat: r.localQuat.toArray(), span: lk.span, w: mount.clientWidth, h: mount.clientHeight, vx: r.viewShift.cx, vy: r.viewShift.cy, flying: !!lk.fly, pm: camera.projectionMatrix.toArray(), mwi: camera.matrixWorldInverse.toArray() }),
        bodies: () => (r.showSolar ? r.bodies : []).map((b) => ({ name: b.name, nx: b.nx, ny: b.ny, nz: b.nz, mag: b.mag })),
        atm: () => ({ on: r.atmOn, dome: r.atm.visible, counts: r.atmCounts || null, solarVis: r.solarVis || null }),
        stars: () => { const u = r.points.material.uniforms, c = r.points.geometry.attributes.scolor.array; let mx = 0; for (let i = 0; i < c.length; i++) mx = Math.max(mx, c[i]); return { uScale: u.uScale.value, uPx: u.uPx.value, uDpr: u.uDpr.value, pr: renderer.getPixelRatio(), maxColor: mx, visible: r.points.visible, op: r.points.material.opacity }; },
      };
    }
    setReady(true);

    // resize
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      renderer.setSize(w, h);
      applyFov();                          // desde dentro el campo depende del aspecto (p. ej. al girar el teléfono)
      if (sceneRef.current) sceneRef.current.viewShift.dirty = true;
    };
    window.addEventListener("resize", onResize);
    // el visor también cambia de tamaño sin que cambie la ventana (pantalla completa, barras del navegador)
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (ro) ro.observe(mount);

    // animation
    let raf;
    // Dibujar solo cuando hace falta: si la cámara no se movió y nada cambió, se dibuja 1 de cada
    // IDLE_EVERY cuadros. Cualquier interacción o cambio de estado "despierta" el bucle medio segundo.
    let wakeUntil = performance.now() + 2000, idleN = 0, lastT = 0, prevDrawn = false;
    let adaptN = 0, adaptMs = 0, perfTick = 0, drawnN = 0, drawnT0 = performance.now();
    const sceneT0 = performance.now();
    const lastCam = { px: NaN, py: NaN, pz: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN, fov: NaN, vx: NaN, vy: NaN, us: NaN };
    const wakeEv = () => { wakeUntil = performance.now() + 500; };
    for (const ev of ["pointerdown", "pointermove", "wheel", "touchstart", "keydown"]) renderer.domElement.addEventListener(ev, wakeEv, { passive: true });
    const onVisible = () => { lastT = 0; prevDrawn = false; wakeEv(); };          // al volver a la pestaña no se cuenta la pausa como un cuadro lento
    document.addEventListener("visibilitychange", onVisible);
    const tmp = new THREE.Vector3(), flyV = new THREE.Vector3(), flyQ = new THREE.Quaternion(), flyYP = {};
    const cullQ = new THREE.Quaternion(), cullF = new THREE.Vector3(), cullP = new THREE.Vector3();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const ref = sceneRef.current; if (!ref) return;
      const tStart = performance.now(), dtFrame = lastT ? tStart - lastT : 0; lastT = tStart;
      if (ref.earth) ref.earth.rotation.y += 0.0006;
      const dpt = depthRef.current;
      const selAb = selRef.current;
      // Rendimiento: las posiciones de estrellas/líneas solo cambian con la
      // profundidad, la selección o el punto de observación. Si nada de eso
      // cambió, no reescribimos ~15k floats por frame (la cámara igual gira).
      const pa = ref.posAttr.array;
      const rebuild = dpt !== ref._lastDpt || selAb !== ref._lastSel || ref._dirty;
      if (rebuild) {
        for (let i = 0; i < ref.N * 3; i++) pa[i] = ref.posFlat[i] + (ref.posDeep[i] - ref.posFlat[i]) * dpt;
        ref.posAttr.needsUpdate = true;
        const selSet = selAb;
        for (let s = 0; s < ref.segHips.length; s++) {
          const [ha, hb, ab] = ref.segHips[s];
          const ia = ref.hipIndex.get(ha), ib = ref.hipIndex.get(hb);
          const hidden = selSet && ab !== selSet;
          if (hidden) {
            for (let q=0;q<6;q++) ref.lPos[s*6+q]=0;   // colapsar -> invisible
          } else {
            ref.lPos[s*6+0]=pa[ia*3]; ref.lPos[s*6+1]=pa[ia*3+1]; ref.lPos[s*6+2]=pa[ia*3+2];
            ref.lPos[s*6+3]=pa[ib*3]; ref.lPos[s*6+4]=pa[ib*3+1]; ref.lPos[s*6+5]=pa[ib*3+2];
          }
          let r,g,b;
          if (!selSet) { r=0.42;g=0.45;b=0.78; }
          else { r=0.70;g=0.58;b=1.0; }
          ref.lCol[s*6+0]=r; ref.lCol[s*6+1]=g; ref.lCol[s*6+2]=b;
          ref.lCol[s*6+3]=r; ref.lCol[s*6+4]=g; ref.lCol[s*6+5]=b;
        }
        ref.lines.geometry.attributes.position.needsUpdate = true;
        ref.lines.geometry.attributes.color.needsUpdate = true;
        ref._lastDpt = dpt; ref._lastSel = selAb; ref._dirty = false;
      }
      const ar = ref.ar;
      if (ar.on) {
        // Apuntar al cielo: la cámara se pone en el observador y toma la orientación
        // del teléfono, suavizada con slerp (sin saltos en 0/360 ni objetos nuevos).
        const p = pointRef.current.pose;
        const now = performance.now();
        const dt = ar.t ? Math.min(0.1, (now - ar.t) / 1000) : 0.016; ar.t = now;
        if (p.fresh) {
          // la brújula da el norte magnético: se suma la declinación (WMM2025) para llegar al geográfico
          cameraQuat(ar.arr, p.alpha, p.beta, p.gamma, p.screen, pointAzOffset + (ar.north ? ar.decl : 0));
          ar.tgt.set(ar.arr[0], ar.arr[1], ar.arr[2], ar.arr[3]);
          if (!ar.has) { ar.cur.copy(ar.tgt); ar.has = true; }
          else {
            // filtro adaptativo: el temblor pequeño (< 4°) se amortigua más; un giro real se sigue casi al instante
            const ang = ar.cur.angleTo(ar.tgt);
            const tau = ang >= 0.07 ? 0.05 : 0.05 + 0.2 * (1 - ang / 0.07);
            ar.cur.slerp(ar.tgt, 1 - Math.exp(-dt / tau));
          }
        }
        ref.camera.position.set(0, 0, 0);
        ref.camera.quaternion.copy(ar.cur);
        if (ar.has && (ar.n++ % 6 === 0)) {
          lookFromQuat(ar.cur.x, ar.cur.y, ar.cur.z, ar.cur.w, ar.look);
          ar.alt = ar.look.alt;
          if (arHudRef.current) arHudRef.current(ar.look.az, ar.look.alt);
        }
      } else if (ref.mode === "in") {
        // desde dentro: la cámara en el centro, orientada por la mirada (yaw/pitch en su marco)
        const lk = ref.look, fl = lk.fly;
        const dts = dtFrame > 0 ? Math.min(0.05, dtFrame / 1000) : 0.016;
        if (fl) {
          // vuelo hasta un objeto: la mirada gira por el camino más corto y el zoom cambia a la vez
          const k = Math.min(1, (tStart - fl.t0) / fl.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          flyQ.identity().slerp(fl.q, e);
          flyV.copy(fl.from).applyQuaternion(flyQ);
          if (k >= 1) flyV.copy(fl.to);
          dirToYawPitch(flyV, lk.qF, flyYP);
          lk.yaw = flyYP.yaw; lk.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, flyYP.pitch));
          lk.span = fl.s0 * Math.pow(fl.s1 / fl.s0, e);
          applyFov();
          if (k >= 1) { lk.fly = null; lk.span = lk.spanT = fl.s1; }
        } else {
          if (!lk.drag && (Math.abs(lk.vy) > 1e-4 || Math.abs(lk.vp) > 1e-4)) {
            // inercia suave al soltar el dedo
            lk.yaw += lk.vy * dts;
            lk.pitch = clampPitch(lk.pitch + lk.vp * dts, lk.pitch, lk.minPitch, PITCH_MAX);
            const damp = Math.exp(-dts / 0.22); lk.vy *= damp; lk.vp *= damp;
          }
          if (Math.abs(lk.spanT - lk.span) > 0.01) {
            // zoom de los botones: se acerca en unos pocos cuadros
            lk.span += (lk.spanT - lk.span) * (calm ? 1 : 0.3);
            if (Math.abs(lk.spanT - lk.span) <= 0.01) lk.span = lk.spanT;
            applyFov();
          }
        }
        ref.camera.position.set(0, 0, 0);
        lookQuat(lk.yaw, lk.pitch, lk.qF, ref.camera.quaternion);
      } else {
        ref.controls.update();
      }
      // la esfera vista desde fuera: los planetas de la cara oculta no se dibujan (se confundirían con los de delante)
      const outNow = !ar.on && ref.mode === "out";
      if (outNow || ref._solarCulled) {
        const cpos = ref.camera.position;
        for (const nm in ref.solarSprites) {
          const spr = ref.solarSprites[nm];
          spr.visible = !outNow || spr.position.dot(cpos) > spr.position.lengthSq();
        }
        ref._solarCulled = outNow;
      }
      // encuadre: desplaza el centro de la vista para que el objeto no quede bajo
      // la ficha o un panel (x en px a la izquierda, yf = fracción del alto hacia arriba)
      const vs = ref.viewShift;
      const vw = mount.clientWidth, vh = mount.clientHeight;
      const tx = vs.x, ty = vs.yf * vh;
      if (vs.dirty || Math.abs(tx - vs.cx) > 0.5 || Math.abs(ty - vs.cy) > 0.5) {
        const k = calm ? 1 : 0.16;
        vs.cx += (tx - vs.cx) * k; vs.cy += (ty - vs.cy) * k;
        if (Math.abs(tx - vs.cx) <= 0.5) vs.cx = tx;
        if (Math.abs(ty - vs.cy) <= 0.5) vs.cy = ty;
        if (vs.cx === 0 && vs.cy === 0) ref.camera.clearViewOffset();
        else ref.camera.setViewOffset(vw, vh, vs.cx, vs.cy, vw, vh);
        vs.dirty = false;
      }
      // ¿cambió algo desde el último cuadro dibujado?
      const cp = ref.camera.position, cq = ref.camera.quaternion, us = ref.points.material.uniforms.uScale.value;
      // (con tolerancia: el amortiguado de OrbitControls sigue moviendo la cámara millonésimas durante segundos;
      // se compara con el último cuadro DIBUJADO, así que una deriva lenta acaba dibujándose igual)
      const far = (a, b, e) => !(Math.abs(a - b) <= e);
      const moved = rebuild || ar.on || !!ref.look.fly || tStart < wakeUntil || far(cp.x, lastCam.px, 0.01) || far(cp.y, lastCam.py, 0.01) || far(cp.z, lastCam.pz, 0.01)
        || far(cq.x, lastCam.qx, 1e-6) || far(cq.y, lastCam.qy, 1e-6) || far(cq.z, lastCam.qz, 1e-6) || far(cq.w, lastCam.qw, 1e-6) || ref.camera.fov !== lastCam.fov || far(vs.cx, lastCam.vx, 0.25) || far(vs.cy, lastCam.vy, 0.25) || us !== lastCam.us;
      const draw = moved || (++idleN % IDLE_EVERY === 0);
      if (moved) idleN = 0;
      if (draw) {
        lastCam.px = cp.x; lastCam.py = cp.y; lastCam.pz = cp.z; lastCam.qx = cq.x; lastCam.qy = cq.y; lastCam.qz = cq.z; lastCam.qw = cq.w; lastCam.fov = ref.camera.fov; lastCam.vx = vs.cx; lastCam.vy = vs.cy; lastCam.us = us;
        if (ref.atm.visible) ref.atm.follow(ref.camera);
        ref.renderer.render(ref.scene, ref.camera);
        drawnN++;
      }
      ref.perf.idle = !moved;
      // estadísticas y resolución adaptativa: solo con cuadros dibujados seguidos (en reposo no se mide)
      const jsMs = performance.now() - tStart;
      if (draw && moved && prevDrawn && frameStats.push(dtFrame, jsMs)) {
        adaptN++; adaptMs += dtFrame;
        if (adaptMs >= 500) {
          // los primeros segundos (carga de catálogos y texturas) no cuentan: son lentos en cualquier equipo
          const nr = !ADAPT_OFF && tStart - sceneT0 > 8000 ? adaptive.update(1000 * adaptN / adaptMs, adaptMs) : null; adaptN = 0; adaptMs = 0;
          if (nr != null) { ref.renderer.setPixelRatio(nr); ref.points.material.uniforms.uPx.value = nr / basePR; wakeEv(); }
        }
      } else if (!moved) { adaptN = 0; adaptMs = 0; }
      prevDrawn = draw && moved;
      if (PERF_ON && perfApiRef.current && tStart - perfTick > 500) {
        const el = (tStart - drawnT0) / 1000; perfTick = tStart;
        let objs = ref.N + (ref.showSolar ? (ref.bodies || []).length : 0);
        for (const o of (ref.layerObjs || [])) if (o.points.visible) objs += (o.points.userData.objs || []).length;
        const sz = ref.renderer.domElement;
        perfApiRef.current({ ...frameStats.summary(), idle: !moved, drawnPerS: el > 0 ? drawnN / el : 0, objs, labels: (ref._labels || []).length, ratio: adaptive.ratio, base: basePR, dpr: window.devicePixelRatio || 1, w: sz.width, h: sz.height });
        drawnN = 0; drawnT0 = tStart;
      }
      // ── flecha guía: dónde queda el objetivo respecto a la mirada del teléfono ──
      const gd = ref.guide;
      if (ar.on && ar.has && gd && guideApiRef.current) {
        let gx = 0, gy = 0, gz = 0, okG = true;
        if (gd.body) { const gb = (ref.bodies || []).find(x => x.name === gd.body); if (gb) { gx = gb.nx; gy = gb.ny; gz = gb.nz; } else okG = false; }
        else { gx = gd.dir[0]; gy = gd.dir[1]; gz = gd.dir[2]; }
        if (okG) {
          tmp.set(gx, gy, gz);
          if (ref.localQuat) tmp.applyQuaternion(ref.localQuat);
          tmp.normalize();
          const g = guideArrow(ar.cur.x, ar.cur.y, ar.cur.z, ar.cur.w, tmp.x, tmp.y, tmp.z, ar.g);
          const lk = lookFromQuat(ar.cur.x, ar.cur.y, ar.cur.z, ar.cur.w, ar.look2);
          const tAlt = Math.asin(Math.max(-1, Math.min(1, tmp.y))) * 180 / Math.PI;
          const tAz = Math.atan2(tmp.x, -tmp.z) * 180 / Math.PI;
          const h = turnHint(lk.alt, lk.az, tAlt, tAz);
          tmp.multiplyScalar(870).project(ref.camera);
          const vis = tmp.z < 1 && Math.abs(tmp.x) < 0.98 && Math.abs(tmp.y) < 0.98;
          guideApiRef.current(g.sep, g.ang, h.dAz, h.dAlt, vis, (tmp.x * 0.5 + 0.5) * mount.clientWidth, (-tmp.y * 0.5 + 0.5) * mount.clientHeight, tAlt, lk.alt);
        }
      }
      // ── etiquetas con nivel de detalle (LOD) ──
      // (en reposo no se recalculan: si nada se movió, los nombres siguen donde estaban)
      if (draw) ref._lf = (ref._lf || 0) + 1;
      if (draw && (ref._lf < 4 || ref._lf % 5 === 0)) {
        const W = mount.clientWidth, H = mount.clientHeight;
        // desde dentro (también apuntando) la cámara está en el centro: el detalle lo decide el campo de visión
        const inside = ar.on || ref.mode === "in", outside = !ar.on && ref.mode === "out";
        const camDist = inside ? 0 : ref.camera.position.length();
        const camPos = ref.camera.position;
        const out = [];
        // zonas tapadas por la ficha o un panel: ahí no se dibujan nombres (ni a medias)
        if (ref._occN++ % 6 === 0) {
          const stEl = mount.parentElement, sr = stEl.getBoundingClientRect();
          ref.occl = [...stEl.querySelectorAll(".sk-sheet, .sk-panel, .sk-search-field, .sk-rail button, .sk-dock, .sk-cta-btn, .sk-arpill, .sk-artray, .sk-guide-msg, .sk-depth, .sk-tour, .sk-onboard, .sk-chip")].map(el => { const r = el.getBoundingClientRect(); return [r.left - sr.left - 8, r.top - sr.top - 6, r.right - sr.left + 8, r.bottom - sr.top]; });
        }
        const occl = ref.occl;
        const free = (x0, y0, x1, y1) => {
          if (x0 < 2 || x1 > W - 2) return false;
          for (const o of occl) if (x1 > o[0] && x0 < o[2] && y1 > o[1] && y0 < o[3]) return false;
          return true;
        };
        const CH = W >= 900 ? 7.8 : 6.9;        // ancho medio de un carácter de etiqueta, en px
        let psx = 0, psy = 0;
        // descarte barato antes de proyectar: con ~12 000 objetos de catálogo en las capas, la
        // mayoría queda fuera del cono de visión y no merece una proyección completa.
        // Se compara, en el marco de los datos (sin girar cada punto), el ángulo con la mirada.
        cullQ.copy(ref.localQuat || cullQ.identity()).invert();
        cullF.set(0, 0, -1).applyQuaternion(ref.camera.quaternion).applyQuaternion(cullQ);
        cullP.copy(ref.camera.position).applyQuaternion(cullQ);
        const halfV = THREE.MathUtils.degToRad(ref.camera.fov / 2), halfD = Math.atan(Math.tan(halfV) * Math.hypot(1, ref.camera.aspect)) + 0.12;
        const cosLim = Math.cos(Math.min(1.5, halfD)), cos2 = cosLim * cosLim;
        const fx = cullF.x, fy = cullF.y, fz = cullF.z, cpx = cullP.x, cpy = cullP.y, cpz = cullP.z;
        const inCone = (x, y, z) => {
          const dx = x - cpx, dy = y - cpy, dz = z - cpz, d = dx * fx + dy * fy + dz * fz;
          return d > 0 && d * d > cos2 * (dx * dx + dy * dy + dz * dz);
        };
        const proj = (x, y, z, cls) => {
          tmp.set(x, y, z);
          if (ref.localQuat) tmp.applyQuaternion(ref.localQuat);
          // en Mi cielo (desde dentro o apuntando): bajo el horizonte solo se nombran el Sol, la Luna y los planetas
          if (inside && ref.localModeOn && cls !== "solar" && tmp.y < -12) return false;
          // la esfera vista desde fuera: nada de la cara oculta (se mezclaría con la delantera)
          if (outside && tmp.dot(camPos) <= tmp.lengthSq()) return false;
          tmp.project(ref.camera);
          if (tmp.z >= 1 || tmp.x < -1.05 || tmp.x > 1.05 || tmp.y < -1.05 || tmp.y > 1.05) return false;
          psx = (tmp.x * 0.5 + 0.5) * W; psy = (-tmp.y * 0.5 + 0.5) * H;
          return true;
        };
        const boxes = [];                        // cajas ya ocupadas por otros nombres (anti-solape)
        const clear = (x0, y0, x1, y1) => {
          for (let i = 0; i < boxes.length; i += 4) if (x1 + 6 > boxes[i] && x0 - 6 < boxes[i + 2] && y1 + 3 > boxes[i + 1] && y0 - 3 < boxes[i + 3]) return false;
          return true;
        };
        const place = (sx, sy, name, cls, sub, dx, extra) => {
          let flip = false;
          if (cls === "note") {
            const w = name.length * 7.2 + 52;
            if (!free(sx - w / 2, sy - 58, sx + w / 2, sy + 4) || !clear(sx - w / 2, sy - 54, sx + w / 2, sy - 8)) return;
            boxes.push(sx - w / 2, sy - 54, sx + w / 2, sy - 8);
          } else {
            const w = String(name).length * (cls === "con" ? CH * 1.6 : cls === "solar" ? CH * 1.15 : CH) + (dx || 8) + 4;
            const h = sub == null ? 9 : 24;
            // junto a un borde o a la ficha, el nombre pasa al otro lado del punto; si tampoco cabe, no se dibuja
            if (!free(sx, sy - 10, sx + w, sy + h)) { if (!free(sx - w, sy - 10, sx, sy + h)) return; flip = true; }
            const x0 = flip ? sx - w : sx;
            if (!clear(x0, sy - 9, x0 + w, sy + h)) return;
            boxes.push(x0, sy - 9, x0 + w, sy + h);
          }
          out.push({ key: cls + ":" + name, name, cls, sub: sub == null ? null : sub, x: sx, y: sy, dx, flip, ...extra });
        };
        const push = (x, y, z, name, cls, sub, dx, extra) => { if (proj(x, y, z, cls)) place(psx, psy, name, cls, sub, dx, extra); };
        // naves y cometas que caen casi en el mismo punto se agrupan en un solo nombre ("Juno +2");
        // si el grupo coincide con un planeta (sus orbitadores), el "+N" va en el nombre del planeta
        const groups = [];
        if (camDist < 1050) for (const o of (ref.layerObjs || [])) {
          if (!o.points.visible || (o.key !== "probes" && o.key !== "comets")) continue;
          const objs = o.points.userData.objs;
          for (let q = 0; q < objs.length; q++) {
            const ob = objs[q];
            if (!proj(ob.nx*870, ob.ny*870, ob.nz*870, "obj_" + o.key)) continue;
            let g = null;
            for (const k of groups) if (Math.abs(k.x - psx) < 22 && Math.abs(k.y - psy) < 14) { g = k; break; }
            if (g) g.n++; else groups.push({ x: psx, y: psy, n: 1, name: ob.name, cls: "obj_" + o.key, used: false, pk: { layer: o.key, ob } });
          }
        }
        // puntos cardinales (8 rumbos) justo sobre el horizonte, en Mi cielo desde dentro: primero, para que
        // ningún otro nombre los tape. El norte, destacado. En inglés, O → W (textos en i18n-atm.js).
        if (inside && ref.localModeOn && ref.cardNames) {
          for (let k = 0; k < 8; k++) {
            const az = k * Math.PI / 4, x = Math.sin(az) * 860, z = -Math.cos(az) * 860, y = 860 * Math.sin(1.2 * Math.PI / 180);
            tmp.set(x, y, z).project(ref.camera);
            if (tmp.z >= 1 || tmp.x < -1.02 || tmp.x > 1.02 || tmp.y < -1.02 || tmp.y > 1.02) continue;
            const sx = (tmp.x * 0.5 + 0.5) * W, sy = (-tmp.y * 0.5 + 0.5) * H, nm = ref.cardNames[k], w = nm.length * 11 + 8;
            if (!free(sx - w / 2, sy - 10, sx + w / 2, sy + 10)) continue;
            boxes.push(sx - w / 2, sy - 10, sx + w / 2, sy + 10);
            out.push({ key: "card:" + k, name: nm, cls: k === 0 ? "cardn" : "card", sub: null, x: sx, y: sy, dx: 0, flip: false });
          }
        }
        // primero el sistema solar: sus nombres tienen prioridad en el anti-solape
        if (ref.showSolar) for (const b of (ref.bodies || [])) {
          if (ref.atmOn && ref.solarVis && ref.solarVis[b.name] === false && !(selObjRef.current && selObjRef.current.layer === "solar" && selObjRef.current.name === b.name)) continue;   // no se ve: sin nombre
          if (!proj(b.nx*860, b.ny*860, b.nz*860, "solar")) continue;
          let extra = 0;
          for (const k of groups) if (!k.used && Math.abs(k.x - psx) < 22 && Math.abs(k.y - psy) < 16) { extra += k.n; k.used = true; }
          place(psx, psy, bodyName(b.name, ref.lang) + (extra ? ` +${extra}` : ""), "solar", null, Math.round(ref.solarSprites[b.name].userData.discPx + 7), { pk: { layer: "solar", ob: b } });
        }
        for (const k of groups) if (!k.used) place(k.x, k.y, k.name + (k.n > 1 ? ` +${k.n - 1}` : ""), k.cls, null, undefined, { pk: k.pk });
        // el objeto abierto siempre lleva su nombre, aunque sea de catálogo
        const so = selObjRef.current;
        if (so && so.nx != null && so.layer !== "solar" && so.layer !== "note" && so.layer !== "con" && !(so.layer === "star" && selAb)) {
          if (so.layer === "star" && so.si != null) push(pa[so.si*3], pa[so.si*3+1], pa[so.si*3+2], so.name, "star", null, undefined, { hot: true, pk: { si: so.si } });
          else push(so.nx*870, so.ny*870, so.nz*870, (so.layer === "meteors" && ref.lang === "en" && so.name_en) || so.name, "obj_" + so.layer, null, undefined, { hot: true, pk: { layer: so.layer, ob: so } });
        }
        // notas tocables sobre patrones del cielo (campo de Kepler, plano galáctico…)
        if (camDist < 1050) for (const nt of (ref.notes || [])) push(nt.dir[0]*870, nt.dir[1]*870, nt.dir[2]*870, ref.noteTags[nt.id] || "?", "note", null, 0, { id: nt.id });
        if (selAb && ref.conMeta[selAb]) {
          collectNamed(ref.conMeta[selAb], ref.byHip).forEach(st => {
            const i = ref.hipIndex.get(st[0]);
            push(pa[i*3], pa[i*3+1], pa[i*3+2], st[7], "star", st[6], undefined, { pk: { si: i } });
          });
        } else if (camDist > 820) {
          for (const ab in ref.conCentroid) {
            const c = ref.conCentroid[ab]; if (!c.idxs.length) continue;
            let cx=0, cy=0, cz=0;
            for (const i of c.idxs) { cx += pa[i*3]; cy += pa[i*3+1]; cz += pa[i*3+2]; }
            const n = c.idxs.length; push(cx/n, cy/n, cz/n, c.name, "con", null, undefined, { ab });
          }
        } else {
          if (inside && (ar.on || ref.camera.fov > 14)) {
            // mirando desde dentro: nombres de constelaciones además de las estrellas brillantes
            for (const ab in ref.conCentroid) {
              const c = ref.conCentroid[ab]; if (!c.idxs.length) continue;
              let cx=0, cy=0, cz=0;
              for (const i of c.idxs) { cx += pa[i*3]; cy += pa[i*3+1]; cz += pa[i*3+2]; }
              const n = c.idxs.length; push(cx/n, cy/n, cz/n, c.name, "con", null, undefined, { ab });
            }
          }
          const dens = ref.labelDensity || "normal";
          const magBoost = dens === "pocas" ? -1.2 : dens === "muchas" ? 1.3 : 0;
          // desde dentro, al acercar (menos campo de visión) se nombran estrellas más débiles
          const magT = ar.on ? 2.6 + magBoost
            : inside ? Math.min(6.5, 2.0 + 1.6 * Math.log2(90 / Math.max(3, ref.camera.fov))) + magBoost
            : 1.0 + (820 - camDist) / 770 * 5.2 + magBoost;
          // namedStars ya está ordenada por brillo: se recorre hasta el límite sin crear listas por pasada
          const maxN = dens === "muchas" ? 70 : 38, ns = ref.namedStars;
          // con atmósfera, las estrellas que no se ven no llevan nombre
          const sv = ref.atmOn ? ref.starVis : null;
          for (let q = 0, n = 0; q < ns.length && n < maxN && ns[q].mag <= magT; q++) { const s = ns[q]; if (sv && !sv[s.i]) continue; n++; push(pa[s.i*3], pa[s.i*3+1], pa[s.i*3+2], s.name, "star", null, undefined, { pk: { si: s.i } }); }
        }
        if (camDist < 1050) {
          const lim = CATALOG_LABELS[ref.labelDensity || "normal"];
          for (const o of (ref.layerObjs || [])) {
            if (!o.points.visible || o.key === "probes" || o.key === "comets") continue;   // naves y cometas: ya agrupados arriba
            const objs = o.points.userData.objs, cls = "obj_" + o.key, ov = ref.atmOn ? o.points.userData.vis : null;
            // de catálogo: se cuentan los que caen en pantalla y solo se nombran si son pocos (hay zoom suficiente)
            let nCat = 0; const cat = [];
            for (let q = 0; q < objs.length; q++) {
              const ob = objs[q];
              if (ov && !ov[q]) continue;
              if (!inCone(ob.nx*870, ob.ny*870, ob.nz*870) || !proj(ob.nx*870, ob.ny*870, ob.nz*870, cls)) continue;
              const nm = (o.key === "meteors" && ref.lang === "en" && ob.name_en) || ob.name;
              if (isNotable(o.key, ob, ref.when)) place(psx, psy, nm, cls, null, undefined, { pk: { layer: o.key, ob } });
              else if (++nCat <= lim) cat.push(psx, psy, nm, ob);
            }
            if (nCat <= lim) for (let q = 0; q < cat.length; q += 4) place(cat[q], cat[q+1], cat[q+2], cls, null, undefined, { pk: { layer: o.key, ob: cat[q+3] } });
          }
        }
        const dens2 = ref.labelDensity || "normal";
        const shown = out.slice(0, dens2 === "pocas" ? 26 : dens2 === "muchas" ? 110 : 64);
        ref._labels = shown;                       // el toque sobre el nombre de una constelación abre su ficha
        if (labelsApiRef.current) labelsApiRef.current(shown);
      }
    };
    const labelsNonEmpty = { current: false };
    animate();

    return () => {
      sceneDead = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
      controls.dispose();
      // liberar geometrías, materiales y texturas de toda la escena
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material;
        if (m) (Array.isArray(m) ? m : [m]).forEach(mm => { if (mm.map) mm.map.dispose(); mm.dispose(); });
      });
      starTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      setReady(false);
      sceneRef.current = null;
    };
  }, [sky]);

  // aplicar/quitar el punto de observación (paralaje real desde otra estrella)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.applyViewpoint) return;
    ref.applyViewpoint(viewFrom ? viewFrom.pos : null);
    ref._dirty = true;   // fuerza reconstruir posiciones/líneas en el próximo frame
    // desde otra estrella se sigue en el centro (su cielo, reproyectado por paralaje): la mirada va al Sol
    if (viewFrom && ref.mode === "in" && !ref.ar.on && !selObjRef.current) ref.lookAt(ref.sunSprite.position.clone().normalize(), 90);
  }, [viewFrom, ready]);

  // posiciona la cámara según la profundidad: 0 = vista desde la Tierra (plano),
  // 1 = vista lateral que REVELA la profundidad real en distancia.
  const positionCamera = useCallback((dpt) => {
    const ref = sceneRef.current;
    if (!ref || !ref.selCentroidDir || ref.localModeOn || ref.mode !== "depth") return;
    const v = ref.selCentroidDir;
    const targetR = FLAT_R + (ref.selAvgR - FLAT_R) * dpt;
    const target = v.clone().multiplyScalar(targetR);
    const up = Math.abs(v.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(v, up).normalize();
    const angle = dpt * Math.PI * 0.42;            // hasta ~75° de giro lateral
    const dist = 520 + 200 * dpt;
    const dir = v.clone().multiplyScalar(-Math.cos(angle))
      .add(side.multiplyScalar(Math.sin(angle))).normalize();
    ref.camera.position.copy(target.clone().add(dir.multiplyScalar(dist)));
    ref.controls.target.copy(target);
    // el norte celeste arriba, como en la vista desde dentro (salvo cerca del polo, donde no sirve de referencia)
    if (Math.abs(v.z) < 0.85) ref.camera.up.set(0, 0, 1); else ref.camera.up.set(0, 1, 0);
    ref.controls.update();
  }, []);

  // al cambiar de constelación: dirección media y radio medio (para la vista de profundidad)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    if (!sel) { ref.selCentroidDir = null; return; }
    const c = ref.conMeta[sel]; if (!c) return;
    let cx=0,cy=0,cz=0,n=0,sumR=0,cnt=0;
    const seen=new Set();
    c.lines.forEach(p=>p.forEach(h=>{ if(!seen.has(h)){seen.add(h); const st=ref.byHip.get(h); if(st){cx+=st[1];cy+=st[2];cz+=st[3];n++; sumR+=depthRadius(st[6]); cnt++;}}}));
    if(n===0) return;
    ref.selCentroidDir = new THREE.Vector3(cx/n,cy/n,cz/n).normalize();
    ref.selAvgR = cnt ? sumR/cnt : FLAT_R;
    ref.lastSelAb = sel;
    if (ref.mode === "depth") positionCamera(depthRef.current);   // de una constelación a otra sin salir del modo
  }, [sel, positionCamera, ready]);

  // al mover el slider de profundidad, gira la cámara para revelarla
  useEffect(() => {
    const ref = sceneRef.current;
    if (sel && ref && ref.mode === "depth") positionCamera(depth);
  }, [depth, sel, positionCamera]);

  // construir los puntos de cada capa (marcadores en la esfera del cielo)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.scene) return;
    (ref.layerObjs || []).forEach(o => {
      ref.scene.remove(o.points); o.points.geometry.dispose(); o.points.material.dispose();
    });
    ref.layerObjs = [];
    const R = 870;
    LAYERS.forEach(cfg => {
      const data = datasets[cfg.key];
      if (!data || !data.objects) return;
      // Messier y galaxias: el símbolo crece y brilla según su magnitud integrada (tres tamaños) y, con la
      // atmósfera, se oculta si no se vería (applyAtm). El resto de capas: símbolo fijo por capa.
      const byMag = MAG_LAYERS.has(cfg.key);
      const magSize = (m) => (m == null ? 1 : m <= 4.5 ? 1.55 : m <= 7.5 ? 1.1 : 0.75);
      const groups = cfg.key === "exoplanets"
        ? [["exoplanets", data.objects.filter(o => !o.hab), cfg.color, 5],
           ["exoplanets", data.objects.filter(o => o.hab), 0xaaff7a, 12]]
        : byMag
          ? [1.55, 1.1, 0.75].map((f) => [cfg.key, data.objects.filter(o => magSize(o.mag) === f), cfg.color, cfg.size * f])
          : [[cfg.key, data.objects, cfg.color, cfg.size]];
      groups.forEach(([gkey, list, color, size]) => {
        if (!list.length) return;
        const pos = new Float32Array(list.length * 3);
        list.forEach((o, i) => { pos[i*3]=o.nx*R; pos[i*3+1]=o.ny*R; pos[i*3+2]=o.nz*R; });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        let baseCol = null;
        if (byMag) {
          // brillo por magnitud: de 1 (m ≤ 3) a 0,45 (m ≥ 12); color de la capa × brillo, por vértice
          const c = new THREE.Color(color); baseCol = new Float32Array(list.length * 3);
          list.forEach((o, i) => { const k = o.mag == null ? 0.7 : Math.max(0.45, Math.min(1, 1.17 - 0.06 * o.mag)); baseCol[i*3] = c.r*k; baseCol[i*3+1] = c.g*k; baseCol[i*3+2] = c.b*k; });
          g.setAttribute("color", new THREE.BufferAttribute(baseCol.slice(), 3));
        }
        const m = new THREE.PointsMaterial({
          size, map: ref.markerTex, color: byMag ? 0xffffff : color, vertexColors: byMag, transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, sizeAttenuation: true,
        });
        const pts = new THREE.Points(g, m);
        pts.visible = !!enabled[cfg.key];
        if (ref.localQuat) pts.quaternion.copy(ref.localQuat);
        pts.userData = { layer: cfg.key, objs: list, baseCol, vis: byMag ? new Uint8Array(list.length).fill(1) : null };
        ref.scene.add(pts);
        ref.layerObjs.push({ key: cfg.key, points: pts });
      });
    });
  }, [datasets, ready]);

  // alternar visibilidad de capas
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.layerObjs) return;
    ref.layerObjs.forEach(o => { o.points.visible = !!enabled[o.key]; });
  }, [enabled]);

  // acercar la cámara al objeto seleccionado (zoom) + traer ficha de Wikipedia
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !selObj) return;
    const v = new THREE.Vector3(selObj.nx, selObj.ny, selObj.nz);
    // una estrella vista desde otro punto de observación ya no está en su dirección terrestre
    if (selObj.layer === "star" && selObj.si != null) v.set(ref.posFlat[selObj.si*3], ref.posFlat[selObj.si*3+1], ref.posFlat[selObj.si*3+2]);
    if (ref.localQuat) v.applyQuaternion(ref.localQuat);
    v.normalize();
    if (ref.ar.on) return;                 // apuntando: la cámara la lleva el teléfono, no la selección
    if (ref.mode === "depth") return;      // profundidad real: abrir una ficha no mueve la vista lateral
    if (ref.mode === "out") {              // la esfera desde fuera: se gira para que el objeto dé a la cámara
      ref.camera.position.copy(v).multiplyScalar(ref.camera.position.length() || 1700);
      ref.controls.autoRotate = false; ref.controls.update();
      return;
    }
    // desde dentro: la mirada gira hacia el objeto (sin mover al observador) y el zoom lo encuadra;
    // una constelación entera, con margen (en el teléfono la ficha tapa la parte baja)
    let span = Math.min(ref.look.spanT, 70);
    if (selObj.layer === "con" && selObj.rad) span = Math.max(14, shortToSpan(2 * selObj.rad * 180 / Math.PI * (isWideRef.current ? 1.35 : 1.6), ref.camera.aspect));
    ref.lookAt(v, span);
    // solo al cambiar de objeto: el paso del tiempo no debe recolocar la cámara
  }, [selObj && selObj.name, selObj && selObj.layer]);   // eslint-disable-line react-hooks/exhaustive-deps
  // métricas: tipo de objeto abierto; id solo para nombres propios de catálogo o planetas (nunca texto libre)
  useEffect(() => {
    if (!selObj) return;
    const L = selObj.layer;
    const kind = L === "solar" ? (selObj.name === "Sol" ? "sun" : selObj.name === "Luna" ? "moon" : "planet") : L === "con" ? "constellation"
      : ["star", "messier", "pulsars", "blackholes", "galaxies", "meteors", "comets", "probes", "exoplanets"].includes(L) ? L : "other";
    // id: solo nombres de catálogo cortos (planeta en inglés, M31, Sgr A*, Ori, estrella con nombre propio)
    const id = L === "solar" ? (BODIES[selObj.name] || {}).en : L === "con" ? selObj.ab : (L === "star" || L === "messier" || L === "blackholes") ? selObj.name : undefined;
    track("sky_select", id ? { kind, id } : { kind });
  }, [selObj && selObj.name, selObj && selObj.layer]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setWiki(null); setWikiState("idle"); setCredit(null);
    if (!selObj || selObj.layer === "note") return;
    setWikiState("loading");
    let cancel = false;
    (async () => {
      // título explícito, candidatos y filtro de desambiguaciones: src/sky/wiki.js
      const w = await fetchWikiFor(selObj.layer === "con" ? { ...selObj, es: conNameEs(selObj.ab) } : selObj, lang, () => cancel);
      if (cancel) return;
      setWiki(w); setWikiState("done");
      if (w && w.file) { const c = await fetchImageCredit(w.file, w.imgLang || lang); if (!cancel) setCredit(c); }
    })();
    return () => { cancel = true; };
  }, [selObj && selObj.name, selObj && selObj.layer, lang]);   // eslint-disable-line react-hooks/exhaustive-deps

  // modo cielo local: rota todo a coordenadas alt/azimut y muestra el horizonte
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.points) return;
    const active = localMode && lat != null && lon != null;
    const prevQ = ref.localQuat.clone();
    const q = active ? localSkyQuat(lat, lon, new Date(whenStr)) : new THREE.Quaternion();
    ref.localQuat = q; ref.localModeOn = active; ref.localLat = active ? lat : null;
    ref.points.quaternion.copy(q);
    ref.lines.quaternion.copy(q);
    (ref.layerObjs || []).forEach(o => o.points.quaternion.copy(q));
    if (ref.solarGroup) ref.solarGroup.quaternion.copy(q);
    if (ref.horizon) ref.horizon.visible = active;
    // (antes se recolocaba con cada cambio de hora o de capa y se perdía el encuadre)
    const key = active ? `on|${lat}|${lon}` : "off";
    if (ref._localKey === key) return;
    const first = ref._localKey === undefined;
    ref._localKey = key;
    if (first && !active) return;
    // la mirada cambia de marco: con horizonte (cenit arriba) o ecuatorial (norte celeste arriba)
    const lk = ref.look;
    const eqDir = yawPitchToDir(lk.yaw, lk.pitch, lk.qF).applyQuaternion(prevQ.invert());   // lo que se miraba, en ecuatoriales
    ref.setFrame(active);
    // al entrar (o cambiar de lugar): hacia el este o el ecuador celeste, a 35°; al salir, se sigue mirando lo mismo
    const next = active ? { dir: ref.defaultDir(), span: SPAN_DEF } : { dir: eqDir, span: undefined };
    if (ref.mode === "in") ref.lookAt(next.dir, next.span, true);
    else ref.pendingLook = next;
  }, [localMode, lat, lon, whenStr, ready, datasets, sel]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── modo de la vista ──
  // "in": el observador en el centro de la esfera, mirando hacia fuera (por defecto, Mi cielo, otra estrella).
  // "depth": la profundidad real de una constelación, que necesita ver las estrellas de lado (OrbitControls).
  // "out": la esfera entera desde fuera, solo con el interruptor rotulado de Capas.
  const localActive = localMode && lat != null && lon != null;
  // ── atmósfera y contaminación lumínica (solo en Mi cielo, desde la Tierra) ──
  const bortle = clampBortle(bortleMap[placeKind] ?? (PLACES.find((p) => p.name === placeKind) || {}).bortle ?? BORTLE_DEFAULT);
  const setBortle = useCallback((n) => {
    setBortleMap((m) => { const nm = { ...m, [placeKind]: clampBortle(n) }; try { localStorage.setItem(BORTLE_KEY, JSON.stringify(nm)); } catch { /* no-op */ } return nm; });
  }, [placeKind]);
  useEffect(() => { try { localStorage.setItem(ATM_KEY, atmOn ? "1" : "0"); } catch { /* no-op */ } }, [atmOn]);
  const atmActive = !!(atmOn && localActive && !viewFrom);
  const atmState = useMemo(() => {
    if (!atmActive) return null;
    try {
      const d = new Date(whenStr);
      const sun = bodies.find((b) => b.name === "Sol"), moon = bodies.find((b) => b.name === "Luna");
      const aa = (b) => { const r = altAz(b.nx, b.ny, b.nz, lat, lon, d); return { alt: r.alt, az: r.az }; };
      return skyState(aa(sun), moon ? { ...aa(moon), illum: moon.illum } : null, bortle,
        { elevation_m: elev || 0, latDeg: lat, month: d.getMonth() + 1 });
    } catch { return null; }   // nunca debe romper la vista: sin estado, cielo sin atmósfera
  }, [atmActive, bodies, whenStr, lat, lon, bortle, elev]);
  useEffect(() => { if (atmState && !starsHidden(atmState)) setDayHidden(false); }, [atmState]);
  const [atmInfo, setAtmInfo] = useState({ stars: null, deep: null });   // recuentos que publica la escena
  useEffect(() => { if (localActive && outside) setOutside(false); }, [localActive, outside]);
  useEffect(() => {
    const ref = sceneRef.current; if (!ref) return;
    const want = sel && !localActive ? "depth" : outside && !localActive ? "out" : "in";
    if (want === ref.mode) return;
    const prev = ref.mode, { camera, controls } = ref;
    const fwd = ref.fwd();                               // hacia dónde se miraba, antes de cambiar
    ref.mode = want;
    camera.up.set(0, 1, 0);
    if (want === "in") {
      controls.enabled = false; controls.autoRotate = false;
      ref.earth.visible = false;
      camera.position.set(0, 0, 0);
      let dir = fwd, span;
      if (ref.pendingLook) { dir = ref.pendingLook.dir; span = ref.pendingLook.span; ref.pendingLook = null; }
      else if (prev === "depth" && ref.lastSelAb) {
        // al salir de la profundidad: se mira la constelación, encuadrada entera
        const co = conObjRef.current(ref.lastSelAb);
        if (co) {
          dir = new THREE.Vector3(co.nx, co.ny, co.nz).applyQuaternion(ref.localQuat);
          span = Math.max(14, shortToSpan(2 * co.rad * 180 / Math.PI * 1.5, camera.aspect));
        }
      }
      ref.lookAt(dir, span, true);
      ref.applyFov();
    } else {
      ref.look.fly = null; ref.look.vy = ref.look.vp = 0;
      controls.enabled = !ref.ar.on;
      ref.earth.visible = !ref.sunSprite.visible;
      ref.applyFov();                                    // desde fuera, campo fijo de 55°
      // desde fuera no se puede "entrar" en la bola con la rueda (dentro ya está la vista normal)
      controls.minDistance = want === "out" ? 1000 : 50;
      if (want === "depth") { controls.autoRotate = false; positionCamera(depthRef.current); }
      else {
        controls.autoRotate = !prefersReducedMotion();
        controls.target.set(0, 0, 0);
        camera.position.copy(fwd).multiplyScalar(1700);  // la cara que se miraba queda delante
        controls.update();
      }
    }
    if (ref.wake) ref.wake();
  }, [sel, outside, localActive, ready, positionCamera]);

  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.solarSprites) return;
    // desde otra estrella las posiciones geocéntricas de los planetas no valen: se ocultan
    const vis = showSolar && !viewFrom;
    ref.bodies = bodies; ref.showSolar = vis;
    ref.solarGroup.visible = vis;
    const moon = bodies.find(b => b.name === "Luna");
    if (moon && (!ref.moonPhase || ref.moonPhase.illum !== moon.illum || ref.moonPhase.waxing !== moon.waxing)) {
      ref.moonPhase = { illum: moon.illum, waxing: moon.waxing };
      ref.redrawMoon(ref.moonPhase);
    }
    bodies.forEach(b => { const sp = ref.solarSprites[b.name]; if (sp) sp.position.set(b.nx*860, b.ny*860, b.nz*860); });
    ref.solarGroup.quaternion.copy(ref.localQuat || new THREE.Quaternion());
  }, [bodies, showSolar, ready, viewFrom]);

  // atmósfera: estrellas, planetas y cielo profundo según lo que deja ver el cielo (después de colocar
  // el marco local y los cuerpos, que son los efectos anteriores). Si algo falla, el cielo queda sin atmósfera.
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.applyAtm) return;
    if (!atmState && !ref.atmOn && !ref._atmTouched) return;          // sin atmósfera y nada que deshacer
    ref._atmTouched = true;
    let c;
    try { c = ref.applyAtm(atmState); } catch (e) { try { c = ref.applyAtm(null); } catch { /* no-op */ } }
    if (c) setAtmInfo((p) => (p.stars === c.stars && p.deep === c.deep && p.deepTot === c.deepTot ? p : { stars: c.stars, deep: c.deep, deepTot: c.deepTot }));
  }, [atmState, ready, datasets, enabled, bodies, showSolar, localActive, viewFrom]);

  // animar el tiempo (play)
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setWhenStr(w => fmtInput(new Date(new Date(w).getTime() + 10 * 60000))), 120);
    return () => clearInterval(id);
  }, [playing]);
  // sin tocar el control de tiempo, "ahora" sigue al reloj (el cielo gira 15° por hora)
  useEffect(() => {
    if (timeMoved || playing) return;
    const id = setInterval(() => setWhenStr(nowLocalInput()), 60000);
    return () => clearInterval(id);
  }, [timeMoved, playing]);
  useEffect(() => { if (sceneRef.current) sceneRef.current.when = new Date(whenStr); }, [whenStr, ready]);
  useEffect(() => {
    const ref = sceneRef.current; if (!ref) return;
    ref.notes = notes.filter((n) => enabled[n.layer]);
    ref.noteTags = TC[lang].noteTag;
  }, [notes, enabled, lang, ready]);
  const shiftMin = useCallback((m) => { setTimeMoved(true); setWhenStr(w => fmtInput(new Date(new Date(w).getTime() + m * 60000))); }, []);
  useEffect(() => { if (sceneRef.current) sceneRef.current.labelDensity = labelDensity; }, [labelDensity, ready]);
  // tras cada render de React (capas, selección, hora, idioma…) el bucle dibuja a ritmo completo medio segundo
  useEffect(() => { const r = sceneRef.current; if (r && r.wake) r.wake(); });
  useEffect(() => {
    STAR_MODE.vivid = vividStars;
    try { localStorage.setItem(VIVID_KEY, vividStars ? "1" : "0"); } catch { /* no-op */ }
    const ref = sceneRef.current;
    if (ref && ref.recolorStars) { ref.recolorStars(); if (ref.wake) ref.wake(); }
    // la ficha y la postal de la estrella abierta siguen el mismo color
    setSelObj((o) => (o && o.layer === "star" && o.si != null && sky ? { ...o, hex: starTint(sky.stars[o.si]) } : o));
  }, [vividStars, ready]);   // eslint-disable-line react-hooks/exhaustive-deps
  // idioma: nombres de las etiquetas y punto cardinal Oeste (O / W)
  useEffect(() => {
    langRef.current = lang;
    const ref = sceneRef.current; if (!ref) return;
    ref.lang = lang;
    ref.cardNames = TC[lang].cardinals;
  }, [lang, ready]);
  // girar la mirada hasta una dirección del cielo (tour, "Esta noche", "Encuéntralo" sin sensores, búsqueda).
  // Desde dentro la cámara no se mueve del centro: solo gira y ajusta el zoom.
  const goLook = useCallback((nx, ny, nz, span) => {
    const ref = sceneRef.current; if (!ref || ref.ar.on) return;
    const to = new THREE.Vector3(nx, ny, nz);
    if (ref.localQuat) to.applyQuaternion(ref.localQuat);
    to.normalize();
    if (ref.mode === "depth") { ref.pendingLook = { dir: to, span }; setSel(null); setDepth(0); return; }   // se sale de la profundidad
    if (ref.mode === "out") {
      ref.controls.autoRotate = false;
      ref.camera.position.copy(to).multiplyScalar(ref.camera.position.length() || 1700); ref.controls.update();
      return;
    }
    ref.lookAt(to, span);
  }, []);
  const focusDir = useCallback((nx, ny, nz, span = 60) => goLook(nx, ny, nz, span), [goLook]);
  const flyTo = useCallback((nx, ny, nz) => {
    const ref = sceneRef.current; if (!ref) return;
    goLook(nx, ny, nz, Math.min(ref.look.spanT, 60));
  }, [goLook]);
  const startTour = useCallback(() => { track("sky_tour", { state: "start" }); setSel(null); setOutside(false); setSelObj(null); setPanel(null); setTourAuto(true); setTourIndex(0); setTourActive(true); }, []);
  // Los datos del tour (Messier y agujeros negros) se leen por referencia: así, si
  // OTRA capa termina de cargar a mitad del recorrido, la parada actual no se
  // reinicia ni se vuelve a pedir su narración.
  const tourDataReady = !!(ready && sky && datasets.messier && datasets.blackholes);
  useEffect(() => {
    if (!tourActive || !tourDataReady) return;
    const ref = sceneRef.current; const stop = TOUR[tourIndex];
    const r = resolveStop(stop, ref, sky, datasetsRef.current);
    if (!r) return;
    focusDir(r.dir[0], r.dir[1], r.dir[2], r.type === "con" ? 75 : 45);
    const title = stop.title ? (stop.title[lang] || stop.title.es) : "";
    setTourTitle(title); setTourText(null);
    setTourFact(r.dist ? TC[lang].tourFactDist(fmtDist(r.dist, lang)) : "");
    const tw = r.type === "con" ? (lang === "es" ? "la constelación de" : "the constellation") : r.type === "star" ? (lang === "es" ? "la estrella" : "the star") : "";
    const concept = `${tw} ${title}${r.dist ? `, ${lang === "es" ? "a" : "at"} ${fmtDist(r.dist, lang)} ${lang === "es" ? "de la Tierra" : "from Earth"}` : ""}`.trim();
    let cancel = false;
    const ctrl = new AbortController();
    // 12 s: menos que el avance automático (15 s), para que la parada nunca se quede en "narrando…"
    fetchJson(`${API}/api/explain`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concept, lang }), signal: ctrl.signal, timeout: 12000 })
      .then(d => { if (!cancel) setTourText((d && d.explanation) || ""); })
      .catch(e => { if (!cancel && !isAbort(e)) setTourText(""); });
    return () => { cancel = true; ctrl.abort(); };
  }, [tourActive, tourIndex, tourDataReady, sky, lang, focusDir, tourTry]);
  useEffect(() => {
    if (!tourActive || !tourAuto) return;
    const id = setTimeout(() => setTourIndex(i => (i + 1) % TOUR.length), 15000);
    return () => clearTimeout(id);
  }, [tourActive, tourAuto, tourIndex]);

  const onResult = useCallback((res) => {
    if (res.type === "loading") return;   // fila informativa, no navegable
    track("sky_search", { state: "ok", kind: res.type === "layer" ? res.layer : res.type === "con" ? "constellation" : res.type });   // nunca el texto buscado
    setQuery("");
    if (arOnRef.current) {
      // apuntando: en vez de abrir la ficha, la flecha guía lleva hasta el objeto
      let g = null;
      if (res.type === "solar") { setShowSolar(true); g = { label: bodyName(res.body.name, langRef.current), body: res.body.name }; }
      else if (res.type === "star") g = { label: res.st[7], dir: [res.st[1], res.st[2], res.st[3]] };
      else if (res.type === "con") { const c = conDirsRef.current.find((x) => x.ab === res.ab); if (c) g = { label: c.name, dir: c.dir }; }
      else if (res.type === "layer") { setEnabled(e => ({ ...e, [res.layer]: true })); g = { label: labelForObj(res.layer, res.obj, langRef.current), dir: [res.obj.nx, res.obj.ny, res.obj.nz] }; }
      if (g) { setGuide(g); setSelObj(null); setPanel(null); setArCtl(false); }
      return;
    }
    if (!isWideRef.current) setPanel(null);
    if (res.type === "con") { setSel(null); setDepth(0); setSelObj(conObjRef.current(res.ab)); }
    else if (res.type === "star") setSelObj(starObj(res.st, res.si));
    else if (res.type === "solar") { setShowSolar(true); setSelObj({ ...res.body, layer: "solar" }); }
    else if (res.type === "layer") { setEnabled(e => ({ ...e, [res.layer]: true })); setSelObj({ ...res.obj, layer: res.layer }); }
  }, []);

  // zoom con botones: desde dentro (y apuntando) cambia el campo de visión; desde fuera, la distancia
  const zoomBy = useCallback((f) => {
    const ref = sceneRef.current; if (!ref) return;
    const { camera, controls } = ref;
    if (ref.ar.on) {                       // apuntando: acercar = estrechar el campo de visión
      ref.ar.span = Math.max(22, Math.min(110, ref.ar.span * f));
      ref.applyArFov();
      return;
    }
    if (ref.mode === "in") { ref.look.fly = null; ref.look.spanT = clampSpan(ref.look.spanT * f); if (ref.wake) ref.wake(); return; }
    controls.autoRotate = false;
    const dir = camera.position.clone().sub(controls.target);
    let len = dir.length() * f;
    len = Math.max(controls.minDistance, Math.min(controls.maxDistance, len));
    camera.position.copy(controls.target.clone().add(dir.normalize().multiplyScalar(len)));
    controls.update();
  }, []);
  // centrar en el objeto seleccionado (o volver a la mirada inicial si no hay ninguno)
  const recenter = useCallback(() => {
    const ref = sceneRef.current; if (!ref || ref.ar.on) return;
    if (ref.mode === "depth") { positionCamera(depthRef.current); return; }
    if (selObj && selObj.nx != null) {
      const v = new THREE.Vector3(selObj.nx, selObj.ny, selObj.nz);
      if (selObj.layer === "star" && selObj.si != null) v.set(ref.posFlat[selObj.si*3], ref.posFlat[selObj.si*3+1], ref.posFlat[selObj.si*3+2]);
      if (ref.localQuat) v.applyQuaternion(ref.localQuat);
      v.normalize();
      if (ref.mode === "out") { ref.camera.position.copy(v).multiplyScalar(ref.camera.position.length()); ref.controls.update(); return; }
      ref.lookAt(v, selObj.layer === "con" && selObj.rad ? Math.max(14, shortToSpan(2 * selObj.rad * 180 / Math.PI * 1.5, ref.camera.aspect)) : Math.min(ref.look.spanT, 60));
    } else if (ref.mode === "out") {
      ref.controls.target.set(0, 0, 0); ref.controls.update();
    } else {
      ref.lookAt(ref.defaultDir(), SPAN_DEF);
    }
    ref.controls.autoRotate = false;
  }, [selObj, positionCamera]);

  // rotar la vista con el teclado (accesibilidad): desde dentro, las flechas mueven la mirada
  const orbitBy = useCallback((dAz, dPol) => {
    const ref = sceneRef.current; if (!ref) return;
    if (ref.ar.on) {                       // apuntando: las flechas ajustan la alineación (2° por pulsación)
      if (dAz) { pointAzOffset += dAz > 0 ? 2 : -2; setArAligned(true); }
      return;
    }
    if (ref.mode === "in") {
      const lk = ref.look, k = Math.max(0.15, ref.camera.fov / 90);   // pasos más finos con zoom
      lk.fly = null; lk.vy = lk.vp = 0;
      lk.yaw += dAz * k;
      lk.pitch = clampPitch(lk.pitch - dPol * k, lk.pitch, lk.minPitch, PITCH_MAX);
      if (ref.wake) ref.wake();
      return;
    }
    const { camera, controls } = ref; controls.autoRotate = false;
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += dAz; sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi + dPol));
    off.setFromSpherical(sph);
    camera.position.copy(controls.target.clone().add(off));
    controls.update();
  }, []);
  const onCanvasKey = useCallback((e) => {
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(0.85); return; }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1.18); return; }
    const az = e.key === "ArrowLeft" ? -0.12 : e.key === "ArrowRight" ? 0.12 : 0;
    const pol = e.key === "ArrowUp" ? -0.09 : e.key === "ArrowDown" ? 0.09 : 0;
    if (az || pol) { e.preventDefault(); orbitBy(az, pol); }
  }, [orbitBy, zoomBy]);

  // postal para compartir (src/sky/postcard.js): se dibuja en 2D a 1080 × 1350 con el
  // visual del objeto, el cielo real a su alrededor y textos medidos que nunca se cortan.
  const buildShare = useCallback(() => {
    const ref = sceneRef.current;
    const date = new Date(whenStr);
    const local = localMode && lat != null && lon != null ? { lat, lon, date, place: placeKind === "me" ? TC[lang].myLocation : placeKind === "custom" ? TC[lang].customPlace : placeKind } : null;
    const loc = lang === "es" ? "es-EC" : "en-US";
    const fmt = {
      dist: (d) => fmtDist(d, lang), years: (y) => fmtYears(y, lang), km: (k) => fmtKm(k, lang), dur: (x) => fmtDuration(x, lang),
      when: (d) => d.toLocaleString(loc, lang === "es" ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }),
    };
    const base = { lang, t: TC[lang], fmt, sky, conDirs, bodies: bodiesRef.current, local, showSolar: showSolar && !viewFrom, starHex: starTint };
    const so = selObj;
    const conAb = so && so.layer === "con" ? so.ab : (!so && sel ? sel : null);
    if (conAb) {
      const c = sky.constellations.find((x) => x.ab === conAb), d = c && constellationData(c, sky.stars);
      if (d) {
        const es = conNameEs(conAb);
        return buildPostcard({ ...base, con: { ab: conAb, title: c.la, type: `${TC[lang].conType} · ${lang === "es" ? (es || c.en) : c.en}`, dir: d.dir, radius: d.radius, stars: d.hips,
          near: d.near && { name: d.near.name, d: d.near.dist }, far: d.far && { name: d.far.name, d: d.far.dist } } });
      }
    }
    if (so && so.name && so.layer !== "note") {
      const live = so.layer === "solar" ? { ...so, ...(bodiesRef.current.find(b => b.name === so.name) || {}) } : so;
      return buildPostcard({ ...base, obj: live, info: describeObject(live, lang, TC[lang], false), wiki, credit });
    }
    // sin objeto: el cielo hacia donde mira la cámara
    let center = [0, 0, 1];
    if (ref) {
      // desde dentro (y apuntando): la dirección de la mirada; desde fuera: la cara que da a la cámara
      const v = ref.ar.on || ref.mode !== "depth" ? ref.fwd() : ref.controls.target.clone().sub(ref.camera.position);
      if (ref.ar.on) v.set(0, 0, -1).applyQuaternion(ref.camera.quaternion);
      if (v.lengthSq() < 1e-6) v.set(0, 0, 1);
      v.normalize();
      if (ref.localQuat) v.applyQuaternion(ref.localQuat.clone().invert());
      center = [v.x, v.y, v.z];
    }
    return buildPostcard({ ...base, center });
  }, [selObj, sel, lang, wiki, credit, sky, conDirs, whenStr, localMode, lat, lon, placeKind, showSolar, viewFrom, vividStars]);
  const openShare = useCallback(() => { setShareState(null); setShare(true); }, []);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeo("unsupported"); return; }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = +pos.coords.latitude.toFixed(4), lo = +pos.coords.longitude.toFixed(4);
        // altitud del GPS si la da (muchos navegadores no): si no, 0 m y la interfaz lo dice
        const al = Number.isFinite(pos.coords.altitude) ? Math.round(pos.coords.altitude) : null;
        setLat(la); setLon(lo); setElev(al); setElevPreset(false); setPlaceDefault(false);
        savePlace({ kind: "me", lat: la, lon: lo, elev: al });
        track("sky_location", { kind: "gps" });
        setPlaceKind("me"); setLocalMode(true); setGeo("ok"); setSel(null);
        if (!isWideRef.current) setPanel(null);
      },
      (err) => setGeo(err && err.code === 1 ? "denied" : err && err.code === 3 ? "timeout" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }, []);
  const pickPlace = useCallback((p) => {
    setLat(p.lat); setLon(p.lon); setElev(p.elev ?? null); setElevPreset(p.elev != null); setPlaceDefault(false);
    savePlace({ kind: p.name, lat: p.lat, lon: p.lon, elev: p.elev ?? null });
    track("sky_location", { kind: "manual" });   // los atajos de ciudad cuentan como "manual"
    setPlaceKind(p.name); setLocalMode(true); setGeo("idle"); setSel(null);
    if (!isWideRef.current) setPanel(null);
  }, []);
  const setManualPlace = useCallback((a, o) => {
    setLat(+a.toFixed(4)); setLon(+o.toFixed(4)); setElev(null); setElevPreset(false); setPlaceDefault(false);
    savePlace({ kind: "custom", lat: +a.toFixed(4), lon: +o.toFixed(4), elev: null });
    track("sky_location", { kind: "manual" });
    setPlaceKind("custom"); setLocalMode(true); setGeo("idle"); setSel(null);
    if (!isWideRef.current) setPanel(null);
  }, []);
  // salir de Mi cielo por decisión de la persona: queda recordado (no se vuelve a poner Quito)
  const leaveMySky = useCallback(() => { setLocalMode(false); setPlaceDefault(false); savePlace({ kind: "off" }); }, []);
  // ── apuntar al cielo ──
  const stopAr = useCallback(() => { track("sky_ar", { state: "off" }); pointRef.current.stop(); setAr("off"); setArSrc(null); setGuide(null); setArCtl(false); }, []);
  // Se llama desde el toque en el botón: iOS solo muestra el permiso de sensores dentro del gesto.
  const startAr = useCallback(() => {
    track("sky_ar", { state: "on" });
    setArError(null);
    pointRef.current.start();
    if (lat != null && lon != null) {
      setLocalMode(true); setSel(null); setAr("on");
      if (!isWideRef.current) setPanel(null);
    } else {
      // aún sin ubicación: primero el lugar (mismo panel), luego se entra solo
      setAr("pending"); setPanel("location");
      if (!isWideRef.current) setSelObj(null);
    }
  }, [lat, lon]);
  const resetArAlign = useCallback(() => { pointAzOffset = 0; setArAligned(false); }, []);
  // "Encuéntralo": entra en el modo apuntar (dentro del gesto, por el permiso de iOS) con una flecha guía
  const findIt = useCallback((g) => {
    setGuide(g); setSelObj(null); setPanel(null); setArCtl(false);
    if (ar !== "on") startAr();
  }, [ar, startAr]);
  const guideOf = useCallback((o) => {
    if (!o || o.nx == null) return null;
    if (o.layer === "solar") return { label: bodyName(o.name, lang), body: o.name };
    return { label: o.layer === "star" ? o.name : labelForObj(o.layer, o, lang), dir: [o.nx, o.ny, o.nz] };
  }, [lang]);
  // selector de objetos amontonados: al abrirse, el foco va a su primera opción
  const pickRef = useRef(null);
  useEffect(() => { if (pick && pickRef.current) { const b = pickRef.current.querySelector("ul button"); if (b) b.focus({ preventScroll: true }); } }, [pick]);
  // "Encuéntralo" sin sensores (escritorio, o permiso denegado): la cámara vuela al objeto y un
  // aviso dice dónde está; en cielo local, si está bajo el horizonte, a qué hora sale.
  const showIt = useCallback((o) => {
    if (!o || o.nx == null) return;
    const live = o.layer === "solar" ? { ...o, ...(bodiesRef.current.find(b => b.name === o.name) || {}) } : o;
    const tt = TC[lang], label = live.layer === "solar" ? bodyName(live.name, lang) : live.layer === "star" || live.layer === "con" ? live.name : labelForObj(live.layer, live, lang);
    flyTo(live.nx, live.ny, live.nz);
    let text = tt.findShown(label);
    if (localMode && lat != null && lon != null && !viewFrom) {
      const when = new Date(whenStr), vis = visibilityOf(live, { lat, lon }, when);
      const hm = (d) => d.toLocaleTimeString(lang === "es" ? "es-EC" : "en-US", lang === "es" ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { hour: "numeric", minute: "2-digit" });
      if (vis.now.alt > 0) text = tt.findShownUp(label, Math.round(vis.now.alt), compassPoint8(vis.now.az));
      else text = vis.rts.rise ? tt.findBelow(label, hm(vis.rts.rise.date)) : tt.findBelowNever(label);
    }
    setToast({ text, id: Date.now() });
  }, [lang, flyTo, localMode, lat, lon, whenStr, viewFrom]);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(id);
  }, [toast]);
  // norte geográfico al apuntar: declinación magnética del lugar (WMM2025), para la fecha real de hoy
  const decl = useMemo(() => (localMode && lat != null && lon != null ? declination(lat, lon, new Date()) : null), [localMode, lat, lon]);
  useEffect(() => {
    const ref = sceneRef.current; if (!ref) return;
    ref.ar.decl = decl ? decl.decl : 0;
    // solo se corrige cuando el norte viene de la brújula y el modelo es válido y fiable ahí
    ref.ar.north = !!(decl && decl.valid && decl.zone !== "blackout" && arSrc === "absolute");
  }, [decl, arSrc, ready]);
  // con la ubicación ya elegida, el modo pendiente pasa a activo
  useEffect(() => {
    if (ar === "pending" && localMode && lat != null && lon != null) setAr("on");
  }, [ar, localMode, lat, lon]);
  // el modo solo vive dentro de Mi cielo: salir de él, empezar el tour o cerrar el panel a medias lo apaga
  useEffect(() => {
    if (ar === "on" && (!localMode || lat == null || tourActive)) stopAr();
    else if (ar === "pending" && panel !== "location" && !(localMode && lat != null)) stopAr();
  }, [ar, localMode, lat, tourActive, panel, stopAr]);
  // al desmontar la vista: fuera listeners y bloqueo de pantalla
  useEffect(() => () => { pointRef.current.stop(); }, []);
  // entrar / salir: la cámara pasa a manos del teléfono y OrbitControls se desactiva
  const arOn = ar === "on";
  useEffect(() => { arOnRef.current = arOn; }, [arOn]);
  useEffect(() => { if (sceneRef.current) sceneRef.current.guide = arOn ? guide : null; }, [guide, arOn, ready]);
  // ayuda de alineación: sola los primeros segundos; después queda dentro de "Controles"
  useEffect(() => {
    if (!arOn) { setArHelp(false); return; }
    setArHelp(true);
    const id = setTimeout(() => setArHelp(false), 7000);
    return () => clearTimeout(id);
  }, [arOn]);
  // sin norte fiable hay que alinear a mano: se abren los controles con la explicación
  useEffect(() => { if (arOn && arSrc === "relative") setArCtl(true); }, [arOn, arSrc]);
  // los controles temporales se esconden solos si no se usan
  useEffect(() => {
    if (!arOn || !arCtl) return;
    const id = setTimeout(() => {
      const st = stageRef.current;
      const busy = panelRef.current || (st && st.querySelector(".sk-top:focus-within, .sk-artray:focus-within"));
      if (busy) setCtlBump(n => n + 1); else { setArCtl(false); setRailOpen(false); }
    }, 9000);
    return () => clearTimeout(id);
  }, [arOn, arCtl, ctlBump]);
  // menú "más": se cierra al tocar fuera
  useEffect(() => {
    if (!railOpen) return;
    const off = (e) => { if (railRef.current && !railRef.current.contains(e.target)) setRailOpen(false); };
    document.addEventListener("pointerdown", off, true);
    return () => document.removeEventListener("pointerdown", off, true);
  }, [railOpen]);
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !arOn) return;
    const { camera, controls } = ref, st = ref.ar;
    st.on = true; st.has = false; st.t = 0; st.n = 0; st.cur.identity();
    controls.enabled = false; controls.autoRotate = false;
    ref.look.fly = null; ref.look.vy = ref.look.vp = 0; ref.look.drag = false;
    ref.earth.visible = false;             // el observador está en el centro: la Tierra en miniatura estorbaría
    ref.points.material.uniforms.uScale.value = 1.9;   // como antes de la vista desde dentro: el modo apuntar no cambia
    ref.ground.material.opacity = 0.86;    // el suelo casi opaco: lo que queda debajo está "bajo tus pies"
    ref.applyArFov();
    return () => {
      st.on = false;
      const r = sceneRef.current; if (!r) return;      // la escena ya se destruyó
      controls.enabled = r.mode !== "in";
      r.ground.material.opacity = 0.8;
      r.earth.visible = r.mode !== "in" && !r.sunSprite.visible;
      // la mirada desde dentro sigue donde apuntaba el teléfono (o en el objeto abierto), con su propio zoom
      const so = selObjRef.current;
      let dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      if (so && so.nx != null) {
        dir = new THREE.Vector3(so.nx, so.ny, so.nz);
        if (so.layer === "star" && so.si != null) dir.set(r.posFlat[so.si*3], r.posFlat[so.si*3+1], r.posFlat[so.si*3+2]);
        if (r.localQuat) dir.applyQuaternion(r.localQuat);
      }
      camera.up.set(0, 1, 0);
      if (r.mode === "in") {
        const lk = r.look;
        r.lookAt(dir, lk.spanT, true);
        if (!(so && so.nx != null)) lk.pitch = Math.max(lk.pitch, lk.minPitch);   // sin objeto, no se queda mirando al suelo
        camera.position.set(0, 0, 0);
        lookQuat(lk.yaw, lk.pitch, lk.qF, camera.quaternion);
      }
      r.applyFov();
    };
  }, [arOn, ready]);
  // gestos mientras se apunta: arrastre horizontal = alinear el azimut; pellizco = campo de visión.
  // El toque corto sigue abriendo la ficha (lo gestiona el efecto de selección de abajo).
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !arOn) return;
    const el = ref.renderer.domElement, st = ref.ar;
    const pts = new Map();
    let dragging = false, startX = 0, startY = 0, lastX = 0, pinch0 = 0, span0 = 0;
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const onDown = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ }
      dragging = false;
      if (pts.size === 1) { startX = lastX = e.clientX; startY = e.clientY; }
      else if (pts.size === 2) { pinch0 = dist(); span0 = st.span; }
    };
    const onMove = (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const d = dist();
        if (pinch0 > 0 && d > 0) { st.span = Math.max(22, Math.min(110, span0 * pinch0 / d)); ref.applyArFov(); }
      } else if (pts.size === 1) {
        if (!dragging && Math.abs(e.clientX - startX) > 10 && Math.abs(e.clientX - startX) > Math.abs(e.clientY - startY)) { dragging = true; lastX = e.clientX; }
        if (dragging) {
          // el cielo sigue al dedo: grados por píxel en el centro de la vista (más rápido cerca del cenit)
          const cam = ref.camera, w = el.clientWidth || 1;
          const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect) * 180 / Math.PI;
          const k = hfov / w / Math.max(0.25, Math.cos(st.alt * Math.PI / 180));
          pointAzOffset = ((pointAzOffset - (e.clientX - lastX) * k) % 360 + 540) % 360 - 180;
          lastX = e.clientX;
        }
      }
    };
    const onEnd = (e) => {
      if (!pts.delete(e.pointerId)) return;
      if (dragging) setArAligned(Math.abs(pointAzOffset) > 0.05);
      dragging = false; pinch0 = 0;
      if (pts.size === 1) { const r = [...pts.values()][0]; startX = lastX = r.x; startY = r.y; }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onEnd);
    el.addEventListener("pointercancel", onEnd);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("pointercancel", onEnd);
    };
  }, [arOn, ready]);

  // gestos desde dentro (sin apuntar): arrastrar = mirar alrededor (el cielo sigue al dedo, con inercia
  // suave); pellizco y rueda = campo de visión. Nada de desplazamiento ni de "dolly": el observador no se mueve.
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.renderer) return;
    const el = ref.renderer.domElement, lk = ref.look;
    const pts = new Map();
    let lastX = 0, lastY = 0, lastT = 0, pinch0 = 0, span0 = 0;
    const active = () => ref.mode === "in" && !ref.ar.on;
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    const onDown = (e) => {
      if (!active()) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ }
      lk.fly = null; lk.vy = lk.vp = 0;
      if (pts.size === 1) { lastX = e.clientX; lastY = e.clientY; lastT = performance.now(); lk.drag = true; }
      else if (pts.size === 2) { pinch0 = dist(); span0 = lk.span; }
    };
    const onMove = (e) => {
      const p = pts.get(e.pointerId); if (!p || !active()) return;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size >= 2) {
        if (pinch0 > 0) { lk.span = lk.spanT = clampSpan(span0 * pinch0 / dist()); ref.applyFov(); }
        return;
      }
      const now = performance.now(), dt = Math.max(1, now - lastT);
      const dd = dragDelta(e.clientX - lastX, e.clientY - lastY, ref.camera.fov, el.clientHeight, lk.pitch);
      lk.yaw += dd.dyaw;
      const np = clampPitch(lk.pitch + dd.dpitch, lk.pitch, lk.minPitch, PITCH_MAX);
      // velocidad (rad/s) suavizada, para la inercia al soltar
      lk.vy = 0.6 * lk.vy + 0.4 * (dd.dyaw / dt * 1000);
      lk.vp = 0.6 * lk.vp + 0.4 * ((np - lk.pitch) / dt * 1000);
      lk.pitch = np;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
    };
    const onEnd = (e) => {
      if (!pts.delete(e.pointerId)) return;
      if (pts.size === 1) { const r = [...pts.values()][0]; lastX = r.x; lastY = r.y; lastT = performance.now(); lk.vy = lk.vp = 0; pinch0 = 0; return; }
      if (pts.size === 0) {
        lk.drag = false; pinch0 = 0;
        // sin inercia si el dedo se paró antes de soltar, o con "reducir movimiento"
        if (prefersReducedMotion() || performance.now() - lastT > 90 || e.type === "pointercancel") { lk.vy = lk.vp = 0; }
        else { const lim = 6; lk.vy = Math.max(-lim, Math.min(lim, lk.vy)); lk.vp = Math.max(-lim, Math.min(lim, lk.vp)); }
      }
    };
    const onWheel = (e) => {
      if (!active()) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      lk.fly = null;
      lk.span = lk.spanT = clampSpan(lk.span * Math.exp(Math.max(-200, Math.min(200, dy)) * 0.0015));
      ref.applyFov();
      if (ref.wake) ref.wake();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onEnd);
    el.addEventListener("pointercancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("pointercancel", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [ready]);

  // un panel a la vez; en móvil la ficha y los paneles comparten la parte baja
  const openPanel = useCallback((id) => {
    setPanel(p => (p === id ? null : id));
    if (!isWideRef.current) setSelObj(null);
  }, []);
  const toggleLayer = useCallback((key) => {
    setLayerError(p => (p[key] ? { ...p, [key]: false } : p));
    track("sky_layer", { layer: key, state: enabled[key] ? "off" : "on" });
    setEnabled(e => ({ ...e, [key]: !e[key] }));
  }, [enabled]);
  const onStageKey = useCallback((e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (share) setShare(false); else if (railOpen) setRailOpen(false); else if (pick) setPick(null); else if (panel) setPanel(null); else if (selObj) setSelObj(null); else if (guide) setGuide(null); else if (toast) setToast(null); else if (full) setFull(false);
  }, [panel, selObj, full, railOpen, guide, pick, toast, share]);

  // tocar para identificar un objeto: se proyecta en pantalla todo lo visible POR DELANTE de la cámara
  // (nunca lo que queda detrás del observador ni, desde fuera, la cara oculta de la esfera) y gana el
  // más cercano al dedo (src/sky/look.js: screenOf / rankHits)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.renderer) return;
    const el = ref.renderer.domElement;
    const vtmp = new THREE.Vector3(), sp = {}, selW = new THREE.Vector3();
    let downX = 0, downY = 0, multi = false, nDown = 0;
    const onDown = (e) => { nDown++; if (nDown === 1) { downX = e.clientX; downY = e.clientY; multi = false; } else multi = true; };
    const onCancel = () => { nDown = Math.max(0, nDown - 1); };
    const onUp = (e) => {
      nDown = Math.max(0, nDown - 1);
      if (multi) { if (nDown === 0) multi = false; return; }               // fue un pellizco
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return; // fue arrastre
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const touch = e.pointerType === "touch" || e.pointerType === "pen";
      const touchR = touch ? 28 : 16;                                       // radio táctil en px CSS
      const mode = ref.ar.on ? "in" : ref.mode;
      ref.camera.updateMatrixWorld();
      // en la profundidad real solo cuenta la mitad del cielo donde está la constelación
      const depthDir = mode === "depth" && ref.selCentroidDir ? selW.copy(ref.selCentroidDir).applyQuaternion(ref.localQuat) : null;
      const cands = [];
      const consider = (x, y, z, rObj, prio, make, label, kind) => {
        vtmp.set(x, y, z);
        if (ref.localQuat) vtmp.applyQuaternion(ref.localQuat);
        if (depthDir && vtmp.dot(depthDir) <= 0) return;
        if (!screenOf(ref.camera, vtmp, r.width, r.height, mode, sp)) return;
        if (Math.abs(sp.x - px) > 120 || Math.abs(sp.y - py) > 120) return;  // lejos del dedo: ni se considera
        cands.push({ sx: sp.x, sy: sp.y, r: rObj, prio, make, label, kind });
      };
      const L = ref.lang, kinds = TC[L].kinds;
      // prioridades (px de ventaja para desempatar): Sol, Luna y planetas > objetos con nombre > estrellas débiles
      if (ref.showSolar) for (const b of (ref.bodies || [])) consider(b.nx * 860, b.ny * 860, b.nz * 860, ref.solarSprites[b.name] ? ref.solarSprites[b.name].userData.discPx : 12, 10, () => ({ ...b, layer: "solar" }), bodyName(b.name, L), kinds.solar);
      for (const o of (ref.layerObjs || [])) {
        if (!o.points.visible) continue;
        const objs = o.points.userData.objs || [], kind = (LAYERS.find(l => l.key === o.key) || {})[L] || o.key;
        const ov = ref.atmOn ? o.points.userData.vis : null;
        for (let i = 0; i < objs.length; i++) { if (ov && !ov[i]) continue; const ob = objs[i]; consider(ob.nx * 870, ob.ny * 870, ob.nz * 870, 0, isNotable(o.key, ob, ref.when) ? 6 : 1, () => ({ ...ob, layer: o.key }), labelForObj(o.key, ob, L), kind); }
      }
      const pa = ref.posAttr.array, stars = sky.stars;
      for (let i = 0; i < stars.length; i++) {
        if (!stars[i][7]) continue;                              // solo estrellas con nombre propio
        if (ref.atmOn && !ref.starVis[i]) continue;              // con atmósfera: solo las que se ven
        const m = stars[i][4];
        consider(pa[i * 3], pa[i * 3 + 1], pa[i * 3 + 2], 0, m < 1 ? 6 : m < 2.5 ? 4 : 2, () => starObj(stars[i], i), stars[i][7], kinds.star);
      }
      const { best, same } = rankHits(cands, px, py, touchR);
      // ¿se tocó el texto de una etiqueta? Gana la etiqueta salvo que haya un objeto justo bajo el dedo (≤ 6 px)
      let lbHit = null;
      if (!best || best.d > 6) {
        let bestDy = Infinity;
        for (const lb of (ref._labels || [])) {
          if (lb.cls === "note") continue;                         // las notas son botones propios
          const cw = lb.cls === "con" ? (r.width >= 900 ? 12.5 : 11) : lb.cls === "solar" ? (r.width >= 900 ? 9 : 8) : (r.width >= 900 ? 7.8 : 6.9);
          const w = String(lb.name).length * cw + 14, dx = lb.dx || 8;
          const x0 = lb.flip ? lb.x - dx - w : lb.x + dx - 4, x1 = x0 + w + 4;
          const dy = Math.abs(py - lb.y);
          if (px >= x0 - 4 && px <= x1 + 4 && dy <= (touch ? 16 : 11) && dy < bestDy) { bestDy = dy; lbHit = lb; }
        }
      }
      if (lbHit) {
        let o = null;
        if (lbHit.cls === "con") o = conObjRef.current(lbHit.ab);
        else if (lbHit.pk && lbHit.pk.si != null) o = starObj(stars[lbHit.pk.si], lbHit.pk.si);
        else if (lbHit.pk && lbHit.pk.layer === "solar") o = { ...lbHit.pk.ob, layer: "solar" };
        else if (lbHit.pk && lbHit.pk.ob) o = { ...lbHit.pk.ob, layer: lbHit.pk.layer };
        if (o) { setPick(null); if (o.layer === "con") setSel(null); setSelObj(o); return; }
      }
      if (best) {
        // varios objetos prácticamente en el mismo punto (p. ej. Marte y sus orbitadores): se deja elegir
        if (same.length > 1) { setPick(same.slice(0, 8).map((h) => ({ label: h.label, kind: h.kind, make: h.make }))); setSelObj(null); if (!isWideRef.current) setPanel(null); }
        else { setPick(null); setSelObj(best.make()); }
        return;
      }
      setPick(null);
      if (ref.ar.on && !isWideRef.current && !selObjRef.current && !panelRef.current) setArCtl(v => !v);
      setSelObj(null); if (!isWideRef.current) setPanel(null);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    return () => { el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); el.removeEventListener("pointercancel", onCancel); };
  }, [ready, sky]);

  const onPick = useCallback((e) => {
    const v = e.target.value;
    setSel(v === "__all__" ? null : v);
    setDepth(0);   // siempre arranca en 'plano' y el usuario revela la profundidad
    setSelObj(null); setLocalMode(false);
    if (!isWideRef.current) setPanel(null);
  }, []);

  // ── disposición: todo el ancho de la ventana y hasta su borde inferior real (src/sky/viewport.js) ──
  useStageLayout(wrapRef, setIsWide);

  // ── encuadre: deja el objeto a la vista junto a la ficha / el panel abierto ──
  useEffect(() => {
    const ref = sceneRef.current; if (!ref) return;
    let x = 0, yf = 0;
    if (isWide) { if (selObj) x += 208; if (panel) x -= 198; }
    else if (selObj) yf = 0.24;
    else if (panel) yf = 0.3;
    else if (tourActive) yf = 0.14;
    else if (sel && !localMode) yf = 0.12;      // tarjeta de profundidad sobre el dock
    ref.viewShift.x = x; ref.viewShift.yf = yf;
  }, [selObj, panel, tourActive, isWide, ready, sel, localMode]);

  // atajos del buscador vacío
  const quick = useMemo(() => {
    if (!sky) return [];
    const out = [];
    const body = (key) => { const b = bodies.find(x => x.name === key); if (b) out.push({ label: bodyName(key, lang), onPick: () => onResult({ type: "solar", body: b }) }); };
    body("Saturno"); body("Luna"); body("Júpiter"); body("Marte");
    const ori = sky.constellations.find(c => c.ab === "Ori");
    if (ori) out.push({ label: lang === "es" ? "Orión" : "Orion", onPick: () => onResult({ type: "con", ab: "Ori" }) });
    const m42 = datasets.messier && datasets.messier.objects.find(o => o.m === 42);
    if (m42) out.push({ label: lang === "es" ? "Nebulosa de Orión" : "Orion Nebula", onPick: () => onResult({ type: "layer", layer: "messier", obj: m42 }) });
    const si = sky.stars.findIndex(s => s[7] === "Sirius");
    if (si >= 0) out.push({ label: lang === "es" ? "Sirio" : "Sirius", onPick: () => onResult({ type: "star", st: sky.stars[si], si }) });
    const sgr = datasets.blackholes && datasets.blackholes.objects.find(o => o.name === "Sgr A*");
    if (sgr) out.push({ label: "Sgr A*", onPick: () => onResult({ type: "layer", layer: "blackholes", obj: sgr }) });
    return out;
  }, [sky, bodies, datasets.messier, datasets.blackholes, lang, onResult]);

  const selMeta = sky && sel ? sky.constellations.find(c => c.ab === sel) : null;
  const stats = selMeta ? constellationStats(selMeta, sky) : null;
  const sortedCons = useMemo(() => (sky ? [...sky.constellations].sort((a, b) => a.la.localeCompare(b.la)) : []), [sky]);
  const failedLayers = LAYERS.filter(c => layerError[c.key]);
  const layersOn = LAYERS.filter(c => enabled[c.key]).length;
  // el objeto del sistema solar se refresca con las efemérides del momento elegido
  const liveObj = useMemo(() => {
    if (!selObj) return null;
    let o = selObj;
    if (selObj.layer === "solar") { const b = bodies.find(x => x.name === selObj.name); if (b) o = { ...selObj, ...b }; }
    // con atmósfera: ¿se ve ahora a simple vista? (solo para lo que tiene magnitud; bajo el horizonte lo dice la ficha)
    if (atmState && o.nx != null && o.mag != null && o.name !== "Sol" && (o.layer === "solar" || o.layer === "star" || MAG_LAYERS.has(o.layer))) {
      try {
        const a = altAz(o.nx, o.ny, o.nz, lat, lon, new Date(whenStr));
        if (a.alt > 0) o = { ...o, atmVis: visibility({ mag: o.mag + (MAG_LAYERS.has(o.layer) ? extPenalty(o.layer, o) : 0), alt: a.alt, az: a.az }, atmState).visible };
      } catch { /* no-op */ }
    }
    return o;
  }, [selObj, bodies, atmState, lat, lon, whenStr]);
  const when = new Date(whenStr);
  const placeLabel = placeKind === "me" ? t.myLocation : placeKind === "custom" ? t.customPlace : placeDefault ? t.placeDefault(placeKind) : placeKind;
  const tourReady = !!(ready && datasets.messier && datasets.blackholes);
  const covered = !isWide && (!!selObj || !!panel || !!pick);
  const showDepth = !!(sky && selMeta && !localMode && !tourActive);
  const showOnboard = !!(showHint && sky && !selObj && !panel && !tourActive && !showDepth && !arOn);
  // barra de "Apuntar al cielo": invitación (dentro de Mi cielo), indicador activo o aviso de error
  const arBar = !sky || tourActive ? null : arOn ? "on" : arError ? "error" : null;
  const immersive = arOn && !isWide;          // teléfono apuntando: el cielo ocupa toda la pantalla
  const inMySky = localMode && lat != null;
  // "Esta noche": solo se calcula con el panel abierto
  const tonight = useMemo(() => {
    if (panel !== "tonight" || !localMode || lat == null || lon == null) return null;
    const res = computeTonight({ date: new Date(whenStr), lat, lon, ephemeris,
      showers: datasets.meteors && datasets.meteors.objects, messier: datasets.messier && datasets.messier.objects, constellations: conDirs });
    // con atmósfera, "Esta noche" no propone objetos de cielo profundo que no se verían con esa contaminación lumínica
    if (atmOn && res && res.items && res.items.length) {
      try {
        const d = res.evalDate, eb = ephemeris(d), sun = eb.find((b) => b.name === "Sol"), moon = eb.find((b) => b.name === "Luna");
        const aa = (b) => altAz(b.nx, b.ny, b.nz, lat, lon, d);
        const st = skyState(aa(sun), moon ? { ...aa(moon), illum: moon.illum } : null, bortle, { elevation_m: elev || 0, latDeg: lat, month: d.getMonth() + 1 });
        res.items = res.items.filter((it) => it.kind !== "deep" || visibility({ mag: it.obj.mag + extPenalty("messier", it.obj), alt: it.alt, az: it.az }, st).visible);
      } catch { /* sin filtro */ }
    }
    return res;
  }, [panel, localMode, lat, lon, whenStr, datasets.meteors, datasets.messier, conDirs, atmOn, bortle, elev]);
  // aviso de día: planetas que aun así se verían (p. ej. Venus) y salto a cuando oscurezca
  const dayWarn = !!(atmActive && atmState && starsHidden(atmState) && !dayHidden && !arOn && !tourActive);
  const dayPlanets = useMemo(() => {
    if (!dayWarn) return null;
    const d = new Date(whenStr);
    return bodies.filter((b) => b.body === "planet" && b.mag != null).filter((b) => { const a = altAz(b.nx, b.ny, b.nz, lat, lon, d); return a.alt > 0 && visibility({ mag: b.mag, alt: a.alt, az: a.az }, atmState).visible; }).map((b) => bodyName(b.name, lang));
  }, [dayWarn, bodies, whenStr, lat, lon, atmState, lang]);
  const goNightfall = useCallback(() => {
    const d0 = new Date(whenStr);
    for (let k = 1; k <= 180; k++) {
      const d = new Date(d0.getTime() + k * 600000), sn = ephemeris(d).find((b) => b.name === "Sol");
      if (altAz(sn.nx, sn.ny, sn.nz, lat, lon, d).alt < -12) { track("sky_time", { kind: "forward" }); setPlaying(false); setTimeMoved(true); setWhenStr(fmtInput(d)); return; }
    }
  }, [whenStr, lat, lon]);
  const skyMags = useMemo(() => (sky ? sky.stars.map((x) => x[4]) : null), [sky]);
  const atmControls = (
    <AtmosphereControls lang={lang} on={atmOn} available={localActive && !viewFrom}
      onToggle={() => { const nv = !atmOn; setAtmOn(nv); track("sky_setting", { setting: "atmosphere", state: nv ? "on" : "off" }); }}
      bortle={bortle} onBortle={setBortle} onBortleCommit={() => track("sky_setting", { setting: "light_pollution", state: "ok" })}
      state={atmState} mags={skyMags} visibleNow={atmActive ? atmInfo.stars : null}
      elevation={localActive ? { m: elev, preset: elevPreset } : null}
      deepNote={atmActive && atmInfo.deep != null && atmInfo.deepTot ? t.deepNote(atmInfo.deep, atmInfo.deepTot) : null} />
  );
  const tonightGo = (it) => {
    if (!isWide) setPanel(null);
    // de día la lista es la del anochecer: el cielo se lleva a esa hora para que coincida
    if (tonight && tonight.shifted) { setPlaying(false); setTimeMoved(true); setWhenStr(fmtInput(tonight.evalDate)); }
    if (it.kind === "planet" || it.kind === "moon") {
      const b = ephemeris(tonight ? tonight.evalDate : new Date(whenStr)).find(x => x.name === it.key);
      if (b) { setShowSolar(true); setSelObj({ ...b, layer: "solar" }); }
    } else if (it.kind === "shower") { setEnabled(e => ({ ...e, meteors: true })); setSelObj({ ...it.obj, layer: "meteors" }); }
    else if (it.kind === "deep") { setEnabled(e => ({ ...e, messier: true })); setSelObj({ ...it.obj, layer: "messier" }); }
    else if (it.kind === "con") { setSelObj(null); focusDir(it.dir[0], it.dir[1], it.dir[2]); }
  };
  const tonightFind = (it, name) => {
    if (it.kind === "planet" || it.kind === "moon") { setShowSolar(true); findIt({ label: name, body: it.key }); return; }
    if (it.kind === "shower") setEnabled(e => ({ ...e, meteors: true }));
    if (it.kind === "deep") setEnabled(e => ({ ...e, messier: true }));
    findIt({ label: name, dir: it.kind === "con" ? it.dir : [it.obj.nx, it.obj.ny, it.obj.nz] });
  };
  const openNote = (id) => {
    const n = notes.find(x => x.id === id); if (!n) return;
    setEnabled(e => (e[n.layer] ? e : { ...e, [n.layer]: true }));
    if (!isWide) setPanel(null);
    setSelObj({ layer: "note", note: id, name: id, nx: n.dir[0], ny: n.dir[1], nz: n.dir[2], n: n.n, total: n.total });
  };
  // con sensores (y en Mi cielo) la flecha guía; sin ellos, la cámara vuela al objeto
  const findByPointing = !arError && (arOn || (arCapable && inMySky));
  const canFind = !!liveObj && liveObj.layer !== "note" && liveObj.nx != null && !viewFrom;
  const localInfo = inMySky ? { lat, lon, place: placeLabel } : null;
  const northText = !decl ? null : !decl.valid ? t.declOff : decl.zone === "ok" ? t.declOn(decl.decl) : t.declCaution;
  const selCon = liveObj && liveObj.layer === "con" && sky ? sky.constellations.find(c => c.ab === liveObj.ab) : null;
  const conData = useMemo(() => (selCon ? constellationData(selCon, sky.stars) : null), [selCon, sky]);
  // objetos de los catálogos cargados que caen en la constelación (los que traen el campo `const`)
  const conInside = useMemo(() => {
    if (!selCon) return [];
    const out = [];
    for (const key of ["messier", "galaxies"]) {
      const ds = datasets[key]; if (!ds || !ds.objects) continue;
      for (const o of ds.objects) if (o.const === selCon.ab) out.push({ layer: key, obj: o, label: labelForObj(key, o, lang) });
    }
    return out;
  }, [selCon, datasets.messier, datasets.galaxies, lang]);   // eslint-disable-line react-hooks/exhaustive-deps
  const showActions = !!(sky && !tourActive && !arOn && !arError && inMySky && !covered && !showOnboard && !viewFrom && !showDepth);
  // compartiendo en el teléfono, el visor pasa a pantalla completa: la vista previa necesita todo el alto
  const stageClass = "sk-stage" + (full || immersive || (share && !isWide) ? " is-full" : "") + (immersive ? " is-immersive" : "") + (arOn && arCtl ? " ar-ctl" : "") + (covered ? " is-covered" : "") + (selObj ? " has-sheet" : "")
    + (tourActive ? " has-tour" : "") + (showDepth ? " has-depth" : "") + (arOn ? " is-ar" : "") + (panel ? " has-panel" : "");
  const bumpCtl = arOn && arCtl ? () => setCtlBump(n => n + 1) : undefined;

  return (
    <div ref={wrapRef} className="sk-wrap">
    <div ref={stageRef} className={stageClass} onKeyDown={onStageKey} onPointerDownCapture={bumpCtl}>
      <div ref={mountRef} className="sk-canvas" role="application" tabIndex={0} onKeyDown={onCanvasKey} aria-label={t.canvasAria} />
      {PERF_ON && <PerfMeter t={t} lang={lang} apiRef={perfApiRef} />}
      <SkyLabels apiRef={labelsApiRef} colors={LABEL_COLOR} unit={t.lightyears} locale={lang === "es" ? "es" : "en-US"} onNote={openNote} noteAria={t.noteAria} />

      {!sky && !skyError && (
        <div role="status" className="sk-loading"><i className="sk-spin" />{t.loading}</div>
      )}
      {!sky && skyError && (
        <div className="sk-error">
          <ErrorNotice className="max-w-sm w-full" message={t.skyError} retryLabel={t.retry} onRetry={loadSky} />
        </div>
      )}
      {/* para lectores de pantalla: capas que no cargaron (el detalle y el reintento están en Capas) */}
      <p className="sk-sr" role="status">
        {failedLayers.length > 0 ? `${t.layersError} ${failedLayers.map(c => c[lang] || c.es).join(", ")}.` : ""}
      </p>

      {sky && (
        <div className="sk-top">
          <SearchBox t={t} query={query} setQuery={setQuery} results={results} onResult={onResult} quick={quick} compact={!isWide} />
          {dayWarn && <DayWarning lang={lang} planets={dayPlanets} onNightfall={goNightfall}
            onAtmOff={() => { setAtmOn(false); track("sky_setting", { setting: "atmosphere", state: "off" }); }} onDismiss={() => setDayHidden(true)} />}
          {(viewFrom || outside || (isWide && localMode)) && (
            <div className="sk-chips">
              {outside && (
                <div className="sk-chip tone-violet">
                  <span>{t.outsideChip}</span>
                  <button type="button" onClick={() => setOutside(false)} aria-label={t.backInsideAria}>{t.backInside}</button>
                </div>
              )}
              {viewFrom && (
                <div className="sk-chip tone-violet">
                  <span>{t.skyFrom} <b>{viewFrom.name}</b></span>
                  <button type="button" onClick={() => { track("sky_view_from", { kind: "earth" }); setViewFrom(null); }}>{t.backToEarth}</button>
                </div>
              )}
              {/* en el teléfono el lugar va en el botón "Mi cielo" del dock, no en una fila propia */}
              {isWide && localMode && lat != null && (
                <div className="sk-chip tone-blue">
                  <button type="button" className="chip-main" onClick={() => openPanel("location")} aria-label={`${t.changePlace}: ${placeLabel}`}>
                    <Icon name="pin" size={16} /><span>{placeLabel}</span>
                  </button>
                  <button type="button" onClick={leaveMySky} aria-label={t.leaveMySky}><Icon name="close" size={15} /></button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {sky && (
        <div ref={railRef} className={`sk-rail${railOpen ? " is-open" : ""}`}>
          <button type="button" className="sk-rail-toggle" onClick={() => setRailOpen(o => !o)} aria-expanded={railOpen} aria-label={railOpen ? t.moreClose : t.more} title={t.more}><Icon name={railOpen ? "close" : "dots"} size={21} /></button>
          <button type="button" onClick={() => zoomBy(0.8)} aria-label={t.zoomIn} title={t.zoomIn}><Icon name="plus" size={22} /></button>
          <button type="button" onClick={() => zoomBy(1.25)} aria-label={t.zoomOut} title={t.zoomOut}><Icon name="minus" size={22} /></button>
          <span className="sk-rail-gap is-extra" aria-hidden="true" />
          {!arOn && <button type="button" className={`is-extra${selObj ? " is-on" : ""}`} onClick={() => { recenter(); setRailOpen(false); }} aria-label={selObj ? t.centerObj : t.centerView} title={selObj ? t.centerObj : t.centerView}><Icon name="target" size={20} /></button>}
          <button type="button" className="is-extra" onClick={() => { openShare(); setRailOpen(false); }} aria-label={t.postcardAria} title={t.postcardAria}><Icon name="camera" size={20} /></button>
          {!immersive && <button type="button" className={`is-extra${full ? " is-on" : ""}`} onClick={() => { track("sky_fullscreen", { state: full ? "off" : "on" }); setFull(f => !f); setRailOpen(false); }} aria-pressed={full} aria-label={full ? t.fullOff : t.fullOn} title={full ? t.fullOff : t.fullOn}><Icon name={full ? "shrink" : "expand"} size={20} /></button>}
          {/* el pie de la app no se ve en esta pestaña: los créditos se abren desde aquí */}
          <button type="button" className="is-extra" onClick={() => { setRailOpen(false); window.dispatchEvent(new CustomEvent("teseo:credits")); }} aria-label={t.credits} title={t.credits}><Icon name="info" size={20} /></button>
        </div>
      )}

      {showDepth && (
        <section className="sk-depth" aria-label={t.depthTitle(selMeta.la)}>
          <div className="sk-depth-head">
            <h2>{t.depthTitle(selMeta.la)}</h2>
            <button type="button" className="sk-iconbtn" onClick={() => { const co = conObj(sel); setSel(null); setDepth(0); if (co) setSelObj(co); }} aria-label={t.conSheet} title={t.conSheet}><Icon name="info" size={18} /></button>
            <button type="button" className="sk-iconbtn" onClick={() => { setSel(null); setDepth(0); }} aria-label={t.wholeSky} title={t.wholeSky}><Icon name="close" size={18} /></button>
          </div>
          <input type="range" min="0" max="1" step="0.01" value={depth}
            onChange={e => setDepth(parseFloat(e.target.value))}
            aria-label={t.depthAria} aria-valuetext={depth < 0.5 ? t.flat : t.depth} />
          <div className="sk-depth-ends">
            <span className={depth < 0.5 ? "on" : ""}>{t.flat}</span>
            <span className={depth >= 0.5 ? "on" : ""}>{t.depth}</span>
          </div>
          {stats && stats.far.d > 0 && (
            <div className="sk-depth-stats">
              <span>{t.nearest}: <b>{stats.near.name || "—"}</b> {stats.near.d.toLocaleString(lang === "es" ? "es" : "en-US")} {t.lightyears}</span>
              <span>{t.farthest}: <b>{stats.far.name || "—"}</b> {stats.far.d.toLocaleString(lang === "es" ? "es" : "en-US")} {t.lightyears}</span>
            </div>
          )}
        </section>
      )}

      {sky && !tourActive && (
        <Dock t={t} panel={panel} onPanel={openPanel} localMode={localMode} tourReady={tourReady} onTour={startTour}
          timeLabel={timeMoved ? fmtWhenShort(when, lang) : t.now} isNow={!timeMoved} playing={playing}
          layersOn={layersOn} layersWarn={failedLayers.length > 0} mySkyLabel={!isWide && inMySky ? placeLabel : null} />
      )}

      {sky && tourActive && (
        <TourCard t={t} title={tourTitle} fact={tourFact} index={tourIndex} total={TOUR.length} text={tourText} auto={tourAuto}
          onPrev={() => setTourIndex(i => (i - 1 + TOUR.length) % TOUR.length)}
          onNext={() => setTourIndex(i => (i + 1) % TOUR.length)}
          onToggleAuto={() => setTourAuto(a => !a)}
          onExit={() => { track("sky_tour", { state: tourIndex >= TOUR.length - 1 ? "done" : "skip" }); setTourActive(false); }}
          onRetry={() => setTourTry(n => n + 1)} />
      )}

      {arBar && (
        <PointingBar t={t} mode={arBar} source={arSrc} error={arError} aligned={arAligned} apiRef={arHudRef}
          onStart={startAr} onExit={stopAr} onReset={resetArAlign} onDismiss={() => setArError(null)} canRetry={arCapable}
          ctl={arCtl} onCtl={() => setArCtl(v => !v)} help={arHelp && !covered} onZoom={zoomBy} north={northText}
          onLayers={() => openPanel("layers")} onTonight={() => openPanel("tonight")}
          onSearch={() => { const i = stageRef.current && stageRef.current.querySelector(".sk-search input"); if (i) i.focus(); }} />
      )}
      {arOn && guide && <GuideHud t={t} label={guide.label} apiRef={guideApiRef} onStop={() => setGuide(null)} />}
      {showActions && panel !== "tonight" && <SkyActions t={t} onTonight={() => openPanel("tonight")} onPoint={arCapable && ar === "off" ? startAr : null} />}

      {showOnboard && <Onboarding t={t} onDone={dismissHint} onTour={startTour} tourReady={tourReady} />}

      {sky && panel === "layers" && (
        <LayersPanel t={t} lang={lang} layers={LAYERS} datasets={datasets} enabled={enabled} loadingLayer={loadingLayer} layerError={layerError}
          onToggle={toggleLayer} onRetry={loadLayer} showSolar={showSolar} onToggleSolar={() => setShowSolar(v => !v)}
          constellations={sortedCons} sel={sel} onPick={onPick} labelDensity={labelDensity} onDensity={(v) => { track("sky_setting", { setting: "labels", state: "ok" }); setLabelDensity(v); }}
          vivid={vividStars} onVivid={() => setVividStars(v => !v)} atmosphere={atmControls}
          outside={outside} onOutside={inMySky ? null : () => { setOutside(o => !o); setSel(null); setDepth(0); if (!isWideRef.current) setPanel(null); }}
          onClose={() => setPanel(null)} notes={notes} onNote={openNote} />
      )}
      {sky && panel === "location" && (
        <LocationPanel t={t} localMode={localMode} lat={lat} lon={lon} placeName={placeLabel} geo={geo}
          onUseMyLocation={useMyLocation} places={PLACES} onPlace={pickPlace} onManual={setManualPlace}
          onExit={leaveMySky} onClose={() => setPanel(null)} onTonight={() => setPanel("tonight")}
          pointing={arCapable ? { state: ar, onStart: ar === "off" ? startAr : stopAr } : null} />
      )}
      {sky && panel === "tonight" && (
        <TonightPanel t={t} lang={lang} data={tonight} placeName={placeLabel} onGo={tonightGo}
          onFind={arCapable ? tonightFind : null}
          onGoTime={(d) => { setPlaying(false); setTimeMoved(true); setWhenStr(fmtInput(d)); }}
          onClose={() => setPanel(null)} />
      )}
      {sky && panel === "time" && (
        <TimePanel t={t} lang={lang} when={when} whenStr={whenStr} isNow={!timeMoved} playing={playing}
          onShift={(m) => { track("sky_time", { kind: m > 0 ? "forward" : "back" }); shiftMin(m); }} onTogglePlay={() => { setTimeMoved(true); setPlaying(pl => !pl); }}
          onNow={() => { track("sky_time", { kind: "now" }); setPlaying(false); setTimeMoved(false); setWhenStr(nowLocalInput()); }}
          onSet={(v) => { track("sky_time", { kind: "custom" }); setPlaying(false); setTimeMoved(true); setWhenStr(v); }}
          onClose={() => setPanel(null)} />
      )}

      {liveObj && !selCon && (
        <ObjectSheet obj={liveObj} lang={lang} t={t} wiki={wiki} wikiState={wikiState} credit={credit}
          meteorActive={liveObj.layer === "meteors" && meteorActive(liveObj)}
          onClose={() => setSelObj(null)} onShare={openShare} onCenter={recenter}
          local={localInfo} when={when} onNeedPlace={() => { setPanel("location"); if (!isWide) setSelObj(null); }}
          onFind={canFind ? (findByPointing ? () => findIt(guideOf(liveObj)) : () => showIt(liveObj)) : null}
          findAria={findByPointing ? t.findItAria(describeObject(liveObj, lang, t, false).name) : t.findGoAria(describeObject(liveObj, lang, t, false).name)}
          canViewFrom={liveObj.layer === "star" && liveObj.dist_ly > 0}
          onViewFrom={() => {
            const d = liveObj.dist_ly;
            track("sky_view_from", { kind: "star" });
            setViewFrom({ name: liveObj.name, pos: [liveObj.nx * d, liveObj.ny * d, liveObj.nz * d] });
            setSel(null); setSelObj(null);
          }} />
      )}
      {liveObj && selCon && conData && (
        <ConstellationSheet con={selCon} data={conData} lang={lang} t={t} wiki={wiki} inside={conInside}
          local={localInfo} when={when} onNeedPlace={() => { setPanel("location"); if (!isWide) setSelObj(null); }}
          onClose={() => setSelObj(null)} onShare={openShare} onCenter={recenter}
          onDepth={() => { setSelObj(null); setLocalMode(false); setDepth(0); setSel(selCon.ab); }}
          onFind={canFind ? (findByPointing ? () => findIt(guideOf(liveObj)) : () => showIt(liveObj)) : null}
          findAria={findByPointing ? t.findItAria(selCon.la) : t.findGoAria(selCon.la)}
          onPickStar={(hip) => { const i = sky.stars.findIndex(x => x[0] === hip); if (i >= 0) setSelObj(starObj(sky.stars[i], i)); }}
          onPickObject={(layer, o) => { setEnabled(e => ({ ...e, [layer]: true })); setSelObj({ ...o, layer }); }} />
      )}

      {pick && (
        <section className="sk-pick" role="dialog" aria-labelledby="sk-pick-title" ref={pickRef}>
          <header>
            <h2 id="sk-pick-title">{t.pickTitle(pick.length)}</h2>
            <button type="button" className="sk-iconbtn" onClick={() => setPick(null)} aria-label={t.close}><Icon name="close" size={18} /></button>
          </header>
          <p>{t.pickLead}</p>
          <ul>
            {pick.map((h, i) => (
              <li key={i}><button type="button" className="sk-result" onClick={() => { const o = h.make(); setPick(null); if (o.layer === "solar") setShowSolar(true); setSelObj(o); }}>
                <span className="sk-result-name">{h.label}</span><span className="sk-result-kind">{h.kind}</span>
              </button></li>
            ))}
          </ul>
        </section>
      )}

      {/* avisos breves para todos, también para lectores de pantalla */}
      <div className="sk-toast-slot" role="status" aria-live="polite">
        {toast && (
          <p className="sk-toast" key={toast.id}>
            <span>{toast.text}</span>
            <button type="button" className="sk-iconbtn" onClick={() => setToast(null)} aria-label={t.toastClose}><Icon name="close" size={16} /></button>
          </p>
        )}
      </div>

      {share && sky && (
        <ShareDialog t={t} name={liveObj && liveObj.layer !== "note" ? (selCon ? selCon.la : describeObject(liveObj, lang, t, false).name) : (sel && selMeta ? selMeta.la : null)}
          build={buildShare} onClose={() => setShare(false)} onCopyLink={shareLink} linkState={shareState} />
      )}
    </div>
    </div>
  );
}

function collectNamed(c, byHip) {
  const seen = new Set(); const out = [];
  c.lines.forEach(p => p.forEach(h => {
    if (seen.has(h)) return; seen.add(h);
    const s = byHip.get(h);
    if (s && s[7]) out.push(s);
  }));
  out.sort((a, b) => a[4] - b[4]);
  return out.slice(0, 7);
}
function constellationStats(c, sky) {
  const byHip = new Map(); sky.stars.forEach(s => byHip.set(s[0], s));
  let near = { d: Infinity, name: "" }, far = { d: -1, name: "" };
  const seen = new Set();
  c.lines.forEach(p => p.forEach(h => {
    if (seen.has(h)) return; seen.add(h);
    const s = byHip.get(h); if (!s || !s[6]) return;
    if (s[6] < near.d) near = { d: s[6], name: s[7] };
    if (s[6] > far.d) far = { d: s[6], name: s[7] };
  }));
  return { near, far };
}
function makeStarTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.Texture(c); tex.needsUpdate = true;
  return tex;
}
