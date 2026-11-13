import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ephemeris } from "./ephemeris.js";
import { ErrorNotice } from "./ErrorBoundary.jsx";
import { fetchJson, isAbort, TIMEOUT_MS } from "./net.js";
import { BODIES, BODY_NAMES, bodyName, textureUrl, drawBodySprite, SPRITE_PX } from "./sky/bodies.js";
import { fmtDist, fmtYears, fmtWhenShort } from "./sky/format.js";
import Icon from "./sky/icons.jsx";
import { SkyLabels, SearchBox, Dock, LayersPanel, LocationPanel, TimePanel, TourCard, Onboarding, PointingBar } from "./sky/panels.jsx";
import { cameraQuat, lookFromQuat } from "./sky/deviceOrientation.js";
import { createPointing, pointingSupported } from "./sky/pointing.js";
import ObjectSheet, { describeObject } from "./sky/ObjectSheet.jsx";
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
const LABEL_COLOR = { con:"#c9b8ff", star:"#ffffff", obj_messier:"#67e8c8", obj_pulsars:"#ff5dc8", obj_blackholes:"#ff7a3c", obj_galaxies:"#9db4ff", obj_meteors:"#ffd27a", obj_comets:"#8be0ff", obj_probes:"#e6ebff", solar:"#ffe9a8" };

// Atajos de "Mi cielo": coordenadas del centro de cada ciudad (grados decimales).
const PLACES = [
  { name: "Quito", lat: -0.2202, lon: -78.5123 },
  { name: "Cayambe", lat: 0.0431, lon: -78.1456 },
  { name: "Guayaquil", lat: -2.1894, lon: -79.8891 },
  { name: "Cuenca", lat: -2.9001, lon: -79.0059 },
];
// Modo "Apuntar al cielo": desfase manual de azimut (grados). Solo en memoria:
// dura lo que dura la sesión de la página y no se guarda en ningún sitio.
let pointAzOffset = 0;
const POINT_SPAN = 75;              // grados de cielo que abarca el lado largo de la pantalla al empezar
const HINT_KEY = "teseo_hint_v2";   // primeros pasos vistos (v1 era el párrafo antiguo)

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
function starObj(st, si) {
  return { name: st[7], nx: st[1], ny: st[2], nz: st[3], dist_ly: st[6], mag: st[4], hex: st[5], si, layer: "star" };
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
function gmstRad(date) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = JD - 2451545.0;
  let g = 280.46061837 + 360.98564736629 * T;
  g = ((g % 360) + 360) % 360;
  return g * Math.PI / 180;
}
// Cuaternión que mapea coordenadas ecuatoriales -> mundo local
// (Y = cenit, -Z = Norte, +X = Este) para una latitud/longitud y momento dados.
function localSkyQuat(latDeg, lonDeg, date) {
  const phi = latDeg * Math.PI / 180;
  const lst = gmstRad(date) + lonDeg * Math.PI / 180;
  const up = new THREE.Vector3(Math.cos(phi) * Math.cos(lst), Math.cos(phi) * Math.sin(lst), Math.sin(phi)).normalize();
  const ncp = new THREE.Vector3(0, 0, 1);
  const north = ncp.clone().sub(up.clone().multiplyScalar(ncp.dot(up)));
  if (north.lengthSq() < 1e-6) north.set(1, 0, 0); else north.normalize();
  // Este = Norte × Cenit: así (Este, Cenit, −Norte) es una base diestra (rotación pura).
  // Con Cenit × Norte salía el Oeste, la base era zurda y el cuaternión resultaba inválido.
  const east = new THREE.Vector3().crossVectors(north, up).normalize();
  const B = new THREE.Matrix4().makeBasis(east, up, north.clone().multiplyScalar(-1));
  B.transpose();
  return new THREE.Quaternion().setFromRotationMatrix(B);
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
const wikiCache = {};
const SOLAR_WIKI = { "Sol":{es:"Sol",en:"Sun"}, "Luna":{es:"Luna",en:"Moon"}, "Mercurio":{es:"Mercurio (planeta)",en:"Mercury (planet)"}, "Venus":{es:"Venus (planeta)",en:"Venus"}, "Marte":{es:"Marte",en:"Mars"}, "Júpiter":{es:"Júpiter (planeta)",en:"Jupiter"}, "Saturno":{es:"Saturno (planeta)",en:"Saturn"}, "Urano":{es:"Urano (planeta)",en:"Uranus"}, "Neptuno":{es:"Neptuno (planeta)",en:"Neptune"} };
const BH_WIKI = { "Sgr A*":"Sagittarius A*", "M87*":"Messier 87", "M31* (Andrómeda)":"Andromeda Galaxy", "Gaia BH1":"Gaia BH1", "Gaia BH3":"Gaia BH3" };
function wikiTitle(obj, lang) {
  if (!obj) return null;
  if (obj.layer === "solar") { const m = SOLAR_WIKI[obj.name]; return m ? (m[lang] || m.en) : obj.name; }
  if (obj.layer === "messier") return `Messier ${obj.m}`;
  if (obj.layer === "star") return obj.name;
  if (obj.layer === "blackholes") return BH_WIKI[obj.name] || obj.name.split("(")[0].trim();
  if (obj.layer === "pulsars") return obj.name.split("(")[0].trim();
  if (obj.layer === "galaxies") {
    // nombre común si lo hay; si no, formatear el catálogo "NGC0055" -> "NGC 55"
    const cat = (obj.cat || obj.name || "").replace(/^(NGC|IC)0*(\d+)/i, "$1 $2");
    return obj.cat && obj.name !== obj.cat ? obj.name : cat;
  }
  if (obj.layer === "meteors") return lang === "es" ? (obj.wiki_es || obj.name) : (obj.name_en || obj.name);
  if (obj.layer === "comets") return obj.name.split("(").pop().replace(")", "").trim() || obj.name.split("/").pop();
  if (obj.layer === "probes") return obj.name.split("(")[0].trim();
  return obj.name;
}
async function fetchWiki(title, lang) {
  const key = lang + ":" + title;
  if (wikiCache[key]) return wikiCache[key];
  const host = lang === "es" ? "es.wikipedia.org" : "en.wikipedia.org";
  const url = `https://${host}/w/api.php?action=query&prop=pageimages%7Cextracts&exintro&explaintext&redirects=1&piprop=thumbnail&pithumbsize=640&format=json&origin=*&titles=${encodeURIComponent(title)}`;
  try {
    // enriquecimiento opcional de la ficha: timeout corto y fallo silencioso
    const d = await fetchJson(url, { timeout: 10000 });
    const pg = Object.values(d.query.pages)[0];
    const res = { title: pg.title, thumb: (pg.thumbnail || {}).source || null, extract: pg.extract || "", url: `https://${host}/wiki/${encodeURIComponent(pg.title)}`, missing: pg.missing !== undefined };
    wikiCache[key] = res; return res;
  } catch { return null; }
}
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
    dragHint: "Drag to orbit · scroll to zoom",
    note: "Star positions & distances: real (HYG / Hipparcos). 3D depth uses a logarithmic scale of the real distance so it stays viewable — the distances shown are the real ones.",
    loading: "Loading the real sky…",
    retry: "Retry",
    skyError: "The star catalogue could not be loaded. Check the connection and try again.",
    layersError: "These layers could not be loaded:",
    layerFailed: "Could not load",
    tourNoText: "Narration isn't available right now. The tour goes on with the real data.",
    nearest: "Nearest", farthest: "Farthest", spread: "Depth spread",
    // ── visor ──
    canvasAria: "3D sky map: stars, constellations and objects in their real positions. Arrow keys rotate, + and − zoom, Escape closes the open panel.",
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
      { title: "Turn the sky with your finger", body: "Drag to look around and pinch to zoom in. Every star sits in its real position." },
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
    dragHint: "Arrastra para girar · rueda para acercar",
    note: "Posiciones y distancias estelares: reales (HYG / Hipparcos). La profundidad 3D usa una escala logarítmica de la distancia real para que sea visualizable — las distancias mostradas son las reales.",
    loading: "Cargando el cielo real…",
    retry: "Reintentar",
    skyError: "No se pudo cargar el catálogo de estrellas. Revisa la conexión y vuelve a intentarlo.",
    layersError: "No se pudieron cargar estas capas:",
    layerFailed: "No se pudo cargar",
    tourNoText: "La narración no está disponible ahora. El recorrido sigue con los datos reales.",
    nearest: "Más cercana", farthest: "Más lejana", spread: "Rango de profundidad",
    // ── visor ──
    canvasAria: "Mapa del cielo en 3D: estrellas, constelaciones y objetos en su posición real. Flechas para girar, + y − para acercar, Escape para cerrar el panel abierto.",
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
      { title: "Gira el cielo con el dedo", body: "Arrastra para mirar alrededor y pellizca para acercarte. Cada estrella está en su posición real." },
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
  const [ready, setReady] = useState(false);
  const [datasets, setDatasets] = useState({}); // key -> {objects}
  const [enabled, setEnabled] = useState({});   // key -> bool
  const [selObj, setSelObj] = useState(null);
  const [viewFrom, setViewFrom] = useState(null); // null = Tierra; {name,pos:[x,y,z]} = otra estrella
  const [wiki, setWiki] = useState(null);
  const [localMode, setLocalMode] = useState(false);
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [whenStr, setWhenStr] = useState(nowLocalInput());
  const [playing, setPlaying] = useState(false);
  const [showSolar, setShowSolar] = useState(true);
  const bodies = useMemo(() => ephemeris(new Date(whenStr)), [whenStr]);
  const [query, setQuery] = useState("");
  const [shareState, setShareState] = useState(null);   // null | "ok" | "fail"
  const [showHint, setShowHint] = useState(() => { try { return !localStorage.getItem(HINT_KEY); } catch { return true; } });
  const dismissHint = useCallback(() => { setShowHint(false); try { localStorage.setItem(HINT_KEY, "1"); } catch { /* no-op */ } }, []);
  const pendingObjRef = useRef(null);   // objeto a restaurar desde la URL
  const hydratedRef = useRef(false);     // no escribir el hash antes de leerlo
  const [labelDensity, setLabelDensity] = useState("normal");
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
  const [placeKind, setPlaceKind] = useState("custom"); // "me" | "custom" | nombre de ciudad
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
  const pointRef = useRef(null);
  if (!pointRef.current) {
    pointRef.current = createPointing((s) => {
      if (s === "denied" || s === "nosensor") { setAr("off"); setArSrc(null); setArError(s); }
      else setArSrc(s === "absolute" || s === "relative" ? s : null);
    });
  }
  const selObjRef = useRef(null);
  useEffect(() => { selObjRef.current = selObj; }, [selObj]);
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
      .then(d => setDatasets(prev => ({ ...prev, [cfg.key]: d })))
      .catch(() => setLayerError(p => ({ ...p, [cfg.key]: true })))
      .finally(() => setLoadingLayer(p => ({ ...p, [cfg.key]: false })));
  }, []);
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

  // ── deep-links: leer el estado del hash al montar ──
  useEffect(() => {
    try {
      const h = window.location.hash || "";
      const qi = h.indexOf("?");
      if (qi >= 0) {
        const p = new URLSearchParams(h.slice(qi + 1));
        const L = p.get("L"); if (L) setEnabled(e => { const n = { ...e }; L.split(",").forEach(k => { if (k) n[k] = true; }); return n; });
        const c = p.get("c"); if (c) setSel(c);
        const v = p.get("v"); if (v) { const q = v.split("~"); const pos = [+q[1], +q[2], +q[3]]; if (pos.every(Number.isFinite)) setViewFrom({ name: decodeURIComponent(q[0]), pos }); }
        const o = p.get("o"); if (o) pendingObjRef.current = o;
      }
    } catch { /* hash inválido: se ignora */ }
    hydratedRef.current = true;
  }, []);

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
  }, [sky, datasets, enabled]);

  // escribir el estado al hash (para compartir el enlace)
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      const p = new URLSearchParams();
      const on = Object.keys(enabled).filter(k => enabled[k]);
      if (on.length) p.set("L", on.join(","));
      if (sel) p.set("c", sel);
      if (viewFrom) p.set("v", encodeURIComponent(viewFrom.name) + "~" + viewFrom.pos.map(n => n.toFixed(3)).join("~"));
      if (selObj && selObj.name) p.set("o", selObj.layer + "~" + encodeURIComponent(selObj.name));
      const qs = p.toString();
      const nh = "#sky" + (qs ? "?" + qs : "");
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
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 6000);
    camera.position.set(0, 0, 1700);
    // sin preserveDrawingBuffer: la postal vuelve a renderizar justo antes de copiar el lienzo
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 50;
    controls.maxDistance = 3000;
    const calm = prefersReducedMotion();
    controls.autoRotate = !calm;
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
    const hipIndex = new Map();
    sky.stars.forEach((s, i) => {
      const [hip, nx, ny, nz, mag, hex, dist] = s;
      hipIndex.set(hip, i);
      const rf = FLAT_R, rd = depthRadius(dist);
      posFlat[i*3] = nx*rf; posFlat[i*3+1] = ny*rf; posFlat[i*3+2] = nz*rf;
      posDeep[i*3] = nx*rd; posDeep[i*3+1] = ny*rd; posDeep[i*3+2] = nz*rd;
      let [r,g,b] = hexToRgb(hex);
      const isAster = asterHips.has(hip);
      let bright = Math.max(0.16, Math.min(1, 1.5 - mag * 0.16));
      if (isAster) bright = Math.max(bright, 0.85);
      colors[i*3]=r*bright; colors[i*3+1]=g*bright; colors[i*3+2]=b*bright;
      sizes[i] = isAster ? Math.max(3.0, 9.5 - mag * 0.8) : Math.max(0.8, 5.2 - mag * 0.62);
    });
    // precálculo para etiquetas LOD
    const namedStars = [];
    sky.stars.forEach((st, i) => { if (st[7]) namedStars.push({ i, mag: st[4], name: st[7] }); });
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
      uniforms: { map: { value: starTex }, uScale: { value: 1 } },   // uScale: estrellas más grandes al apuntar al cielo
      vertexShader: [
        "uniform float uScale;",
        "attribute float size;",
        "attribute vec3 scolor;",
        "varying vec3 vColor;",
        "void main(){",
        "  vColor = scolor;",
        "  vec4 mv = modelViewMatrix * vec4(position,1.0);",
        "  gl_PointSize = clamp(size * uScale * (520.0 / -mv.z), 0.6, 16.0);",
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
    scene.add(earth);

    // grupo de horizonte (modo cielo local)
    const horizon = new THREE.Group();
    const harr = [];
    for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; harr.push(Math.cos(a) * 905, 0, Math.sin(a) * 905); }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute("position", new THREE.Float32BufferAttribute(harr, 3));
    horizon.add(new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.5 })));
    const ground = new THREE.Mesh(new THREE.CircleGeometry(905, 96),
      new THREE.MeshBasicMaterial({ color: 0x05070e, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; horizon.add(ground);
    const cardinals = {};
    [["N", 0, -905], ["E", 905, 0], ["S", 0, 905], ["O", -905, 0], ["W", -905, 0]].forEach(([tt, x, z]) => {
      const sp = makeTextSprite(tt); sp.position.set(x, 20, z); horizon.add(sp); cardinals[tt] = sp;
    });
    cardinals.O.visible = langRef.current === "es"; cardinals.W.visible = langRef.current !== "es";
    horizon.visible = false; scene.add(horizon);

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
      const half = Math.tan(THREE.MathUtils.degToRad(st.span / 2));
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(camera.aspect >= 1 ? half / camera.aspect : half));
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

    sceneRef.current = { scene, camera, renderer, controls, points, lines,
      posFlat, posDeep, posAttr, segHips, hipIndex, conMeta, lPos, lCol, byHip, sizes, N,
      markerTex: starTex, layerObjs: [], namedStars, conCentroid, horizon, localQuat: new THREE.Quaternion(), localModeOn: false, earth, solarGroup, solarSprites, bodies: [], showSolar: true,
      sunSprite, applyViewpoint, redrawMoon, moonPhase: null, cardinals, lang: langRef.current, sizeSolar, applyArFov, ground,
      // apuntar al cielo: objetos fijos que el bucle reutiliza (nada se crea por frame)
      ar: { on: false, has: false, t: 0, n: 0, span: POINT_SPAN, savedFov: 55, alt: 0, cur: new THREE.Quaternion(), tgt: new THREE.Quaternion(), arr: [0, 0, 0, 1], look: { alt: 0, az: 0 } },
      viewShift: { x: 0, yf: 0, cx: 0, cy: 0, dirty: false } };
    setReady(true);

    // resize
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      sizeSolar();
      if (sceneRef.current && sceneRef.current.ar.on) applyArFov();   // p. ej. al girar el teléfono
      if (sceneRef.current) sceneRef.current.viewShift.dirty = true;
    };
    window.addEventListener("resize", onResize);
    // el visor también cambia de tamaño sin que cambie la ventana (pantalla completa, barras del navegador)
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (ro) ro.observe(mount);

    // animation
    let raf;
    const tmp = new THREE.Vector3();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const ref = sceneRef.current; if (!ref) return;
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
          cameraQuat(ar.arr, p.alpha, p.beta, p.gamma, p.screen, pointAzOffset);
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
      } else {
        ref.controls.update();
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
      ref.renderer.render(ref.scene, ref.camera);
      // ── etiquetas con nivel de detalle (LOD) ──
      ref._lf = (ref._lf || 0) + 1;
      if (ref._lf < 4 || ref._lf % 5 === 0) {
        const W = mount.clientWidth, H = mount.clientHeight;
        const camDist = ref.camera.position.length();
        const out = [];
        const push = (x, y, z, name, cls, sub, dx) => {
          tmp.set(x, y, z);
          if (ref.localQuat) tmp.applyQuaternion(ref.localQuat);
          // apuntando: bajo el horizonte solo se nombran el Sol, la Luna y los planetas (están "bajo tus pies")
          if (ar.on && cls !== "solar" && tmp.y < -12) return;
          tmp.project(ref.camera);
          if (tmp.z >= 1 || tmp.x < -1.05 || tmp.x > 1.05 || tmp.y < -1.05 || tmp.y > 1.05) return;
          const sx = (tmp.x * 0.5 + 0.5) * W, sy = (-tmp.y * 0.5 + 0.5) * H;
          for (const e of out) { if (Math.abs(e.x - sx) < 72 && Math.abs(e.y - sy) < 18) return; } // anti-solape
          out.push({ key: cls + ":" + name, name, cls, sub: sub == null ? null : sub, x: sx, y: sy, dx });
        };
        // primero el sistema solar: sus nombres tienen prioridad en el anti-solape
        if (ref.showSolar) for (const b of (ref.bodies || [])) push(b.nx*860, b.ny*860, b.nz*860, bodyName(b.name, ref.lang), "solar", null, Math.round(ref.solarSprites[b.name].userData.discPx + 7));
        if (selAb && ref.conMeta[selAb]) {
          collectNamed(ref.conMeta[selAb], ref.byHip).forEach(st => {
            const i = ref.hipIndex.get(st[0]);
            push(pa[i*3], pa[i*3+1], pa[i*3+2], st[7], "star", st[6]);
          });
        } else if (camDist > 820) {
          for (const ab in ref.conCentroid) {
            const c = ref.conCentroid[ab]; if (!c.idxs.length) continue;
            let cx=0, cy=0, cz=0;
            for (const i of c.idxs) { cx += pa[i*3]; cy += pa[i*3+1]; cz += pa[i*3+2]; }
            const n = c.idxs.length; push(cx/n, cy/n, cz/n, c.name, "con");
          }
        } else {
          if (ar.on) {
            // mirando desde dentro: nombres de constelaciones además de las estrellas brillantes
            for (const ab in ref.conCentroid) {
              const c = ref.conCentroid[ab]; if (!c.idxs.length) continue;
              let cx=0, cy=0, cz=0;
              for (const i of c.idxs) { cx += pa[i*3]; cy += pa[i*3+1]; cz += pa[i*3+2]; }
              const n = c.idxs.length; push(cx/n, cy/n, cz/n, c.name, "con");
            }
          }
          const dens = ref.labelDensity || "normal";
          const magBoost = dens === "pocas" ? -1.2 : dens === "muchas" ? 1.3 : 0;
          const magT = ar.on ? 2.6 + magBoost : 1.0 + (820 - camDist) / 770 * 5.2 + magBoost;
          const cand = ref.namedStars.filter(s => s.mag <= magT).sort((a, b) => a.mag - b.mag).slice(0, dens === "muchas" ? 70 : 38);
          for (const s of cand) push(pa[s.i*3], pa[s.i*3+1], pa[s.i*3+2], s.name, "star");
        }
        if (camDist < 1050) {
          for (const o of (ref.layerObjs || [])) {
            if (!o.points.visible || o.key === "exoplanets") continue;
            const objs = o.points.userData.objs;
            for (let q = 0; q < objs.length && q < 200; q++) {
              const ob = objs[q];
              push(ob.nx*870, ob.ny*870, ob.nz*870, (o.key === "meteors" && ref.lang === "en" && ob.name_en) || ob.name, "obj_" + o.key);
            }
          }
        }
        const dens2 = ref.labelDensity || "normal";
        if (labelsApiRef.current) labelsApiRef.current(out.slice(0, dens2 === "pocas" ? 26 : dens2 === "muchas" ? 110 : 64));
      }
    };
    const labelsNonEmpty = { current: false };
    animate();

    return () => {
      sceneDead = true;
      cancelAnimationFrame(raf);
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
  }, [viewFrom, ready]);

  // posiciona la cámara según la profundidad: 0 = vista desde la Tierra (plano),
  // 1 = vista lateral que REVELA la profundidad real en distancia.
  const positionCamera = useCallback((dpt) => {
    const ref = sceneRef.current;
    if (!ref || !ref.selCentroidDir || ref.localModeOn) return;
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
    ref.controls.update();
  }, []);

  // al cambiar de constelación
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    if (!sel) {
      ref.selCentroidDir = null;
      ref.controls.autoRotate = true;
      ref.controls.target.set(0, 0, 0);
      ref.camera.position.set(0, 0, 1700);
      ref.controls.update();
      return;
    }
    const c = ref.conMeta[sel]; if (!c) return;
    let cx=0,cy=0,cz=0,n=0,sumR=0,cnt=0;
    const seen=new Set();
    c.lines.forEach(p=>p.forEach(h=>{ if(!seen.has(h)){seen.add(h); const st=ref.byHip.get(h); if(st){cx+=st[1];cy+=st[2];cz+=st[3];n++; sumR+=depthRadius(st[6]); cnt++;}}}));
    if(n===0) return;
    ref.selCentroidDir = new THREE.Vector3(cx/n,cy/n,cz/n).normalize();
    ref.selAvgR = cnt ? sumR/cnt : FLAT_R;
    ref.controls.autoRotate = false;
    positionCamera(depthRef.current);
  }, [sel, positionCamera]);

  // al mover el slider de profundidad, gira la cámara para revelarla
  useEffect(() => {
    if (sel) positionCamera(depth);
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
      const groups = cfg.key === "exoplanets"
        ? [["exoplanets", data.objects.filter(o => !o.hab), cfg.color, 5],
           ["exoplanets", data.objects.filter(o => o.hab), 0xaaff7a, 12]]
        : [[cfg.key, data.objects, cfg.color, cfg.size]];
      groups.forEach(([gkey, list, color, size]) => {
        if (!list.length) return;
        const pos = new Float32Array(list.length * 3);
        list.forEach((o, i) => { pos[i*3]=o.nx*R; pos[i*3+1]=o.ny*R; pos[i*3+2]=o.nz*R; });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const m = new THREE.PointsMaterial({
          size, map: ref.markerTex, color, transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, sizeAttenuation: true,
        });
        const pts = new THREE.Points(g, m);
        pts.visible = !!enabled[cfg.key];
        if (ref.localQuat) pts.quaternion.copy(ref.localQuat);
        pts.userData = { layer: cfg.key, objs: list };
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
    ref.controls.autoRotate = false;
    ref.controls.target.copy(v.clone().multiplyScalar(870));
    ref.camera.position.copy(v.clone().multiplyScalar(540));
    ref.controls.update();
    // solo al cambiar de objeto: el paso del tiempo no debe recolocar la cámara
  }, [selObj && selObj.name, selObj && selObj.layer]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setWiki(null); setWikiState("idle");
    if (!selObj) return;
    const title = wikiTitle(selObj, lang);
    if (!title) return;
    setWikiState("loading");
    let cancel = false;
    (async () => {
      let w = await fetchWiki(title, lang);
      // exoplaneta sin página/imagen: intentar la estrella anfitriona
      if (!cancel && selObj.layer === "exoplanets" && (!w || w.missing || !w.thumb) && selObj.host) {
        const w2 = await fetchWiki(selObj.host, lang);
        if (w2 && (w2.thumb || !w2.missing)) w = w2;
      }
      if (!cancel) { setWiki(w); setWikiState("done"); }
    })();
    return () => { cancel = true; };
  }, [selObj && selObj.name, selObj && selObj.layer, lang]);   // eslint-disable-line react-hooks/exhaustive-deps

  // modo cielo local: rota todo a coordenadas alt/azimut y muestra el horizonte
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.points) return;
    const active = localMode && lat != null && lon != null;
    const q = active ? localSkyQuat(lat, lon, new Date(whenStr)) : new THREE.Quaternion();
    ref.localQuat = q; ref.localModeOn = active;
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
    if (active) {
      ref.controls.autoRotate = false;
      ref.controls.target.set(0, 120, 0);
      const tall = ref.camera.aspect < 1 ? 1.5 : 1;   // en vertical se aleja para que quepa el horizonte
      ref.camera.position.set(0, 560 * tall, 1500 * tall);
      ref.controls.update();
    } else if (!first && !sel && !selObj) {
      ref.controls.autoRotate = !prefersReducedMotion();
      ref.controls.target.set(0, 0, 0);
      ref.camera.position.set(0, 0, 1700);
      ref.controls.update();
    }
  }, [localMode, lat, lon, whenStr, ready, datasets, sel]);   // eslint-disable-line react-hooks/exhaustive-deps

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

  // animar el tiempo (play)
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setWhenStr(w => fmtInput(new Date(new Date(w).getTime() + 10 * 60000))), 120);
    return () => clearInterval(id);
  }, [playing]);
  const shiftMin = useCallback((m) => { setTimeMoved(true); setWhenStr(w => fmtInput(new Date(new Date(w).getTime() + m * 60000))); }, []);
  useEffect(() => { if (sceneRef.current) sceneRef.current.labelDensity = labelDensity; }, [labelDensity, ready]);
  // idioma: nombres de las etiquetas y punto cardinal Oeste (O / W)
  useEffect(() => {
    langRef.current = lang;
    const ref = sceneRef.current; if (!ref) return;
    ref.lang = lang;
    if (ref.cardinals) { ref.cardinals.O.visible = lang === "es"; ref.cardinals.W.visible = lang !== "es"; }
  }, [lang, ready]);
  const focusDir = useCallback((nx, ny, nz) => {
    const ref = sceneRef.current; if (!ref) return;
    const v = new THREE.Vector3(nx, ny, nz);
    if (ref.localQuat) v.applyQuaternion(ref.localQuat);
    v.normalize();
    ref.controls.autoRotate = false;
    ref.controls.target.copy(v.clone().multiplyScalar(870));
    ref.camera.position.copy(v.clone().multiplyScalar(390));
    ref.controls.update();
  }, []);
  const startTour = useCallback(() => { setSel(null); setSelObj(null); setPanel(null); setTourAuto(true); setTourIndex(0); setTourActive(true); }, []);
  // Los datos del tour (Messier y agujeros negros) se leen por referencia: así, si
  // OTRA capa termina de cargar a mitad del recorrido, la parada actual no se
  // reinicia ni se vuelve a pedir su narración.
  const tourDataReady = !!(ready && sky && datasets.messier && datasets.blackholes);
  useEffect(() => {
    if (!tourActive || !tourDataReady) return;
    const ref = sceneRef.current; const stop = TOUR[tourIndex];
    const r = resolveStop(stop, ref, sky, datasetsRef.current);
    if (!r) return;
    focusDir(r.dir[0], r.dir[1], r.dir[2]);
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
    setQuery("");
    if (!isWideRef.current) setPanel(null);
    if (res.type === "con") { setSelObj(null); setDepth(0); setSel(res.ab); }
    else if (res.type === "star") setSelObj(starObj(res.st, res.si));
    else if (res.type === "solar") { setShowSolar(true); setSelObj({ ...res.body, layer: "solar" }); }
    else if (res.type === "layer") { setEnabled(e => ({ ...e, [res.layer]: true })); setSelObj({ ...res.obj, layer: res.layer }); }
  }, []);

  // zoom con botones (dolly hacia/desde el objetivo actual; mantiene centrado
  // lo que esté en controls.target, p.ej. el objeto seleccionado)
  const zoomBy = useCallback((f) => {
    const ref = sceneRef.current; if (!ref) return;
    const { camera, controls } = ref;
    if (ref.ar.on) {                       // apuntando: acercar = estrechar el campo de visión
      ref.ar.span = Math.max(22, Math.min(110, ref.ar.span * f));
      ref.applyArFov();
      return;
    }
    controls.autoRotate = false;
    const dir = camera.position.clone().sub(controls.target);
    let len = dir.length() * f;
    len = Math.max(controls.minDistance, Math.min(controls.maxDistance, len));
    camera.position.copy(controls.target.clone().add(dir.normalize().multiplyScalar(len)));
    controls.update();
  }, []);
  // centrar en el objeto seleccionado (o volver al centro si no hay ninguno)
  const recenter = useCallback(() => {
    const ref = sceneRef.current; if (!ref || ref.ar.on) return;
    if (selObj && selObj.nx != null) {
      const v = new THREE.Vector3(selObj.nx, selObj.ny, selObj.nz);
      if (ref.localQuat) v.applyQuaternion(ref.localQuat);
      v.normalize().multiplyScalar(870);
      ref.controls.target.copy(v);
    } else {
      ref.controls.target.set(0, 0, 0);
    }
    ref.controls.autoRotate = false;
    ref.controls.update();
  }, [selObj]);

  // rotar la vista con el teclado (accesibilidad)
  const orbitBy = useCallback((dAz, dPol) => {
    const ref = sceneRef.current; if (!ref) return;
    if (ref.ar.on) {                       // apuntando: las flechas ajustan la alineación (2° por pulsación)
      if (dAz) { pointAzOffset += dAz > 0 ? 2 : -2; setArAligned(true); }
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

  // postal del cielo: captura el lienzo en PNG con marca de Teseo y, si hay un
  // objeto seleccionado, sus datos (nombre, tipo, distancia, descripción).
  const savePostcard = useCallback(() => {
    const ref = sceneRef.current; if (!ref) return;
    ref.renderer.render(ref.scene, ref.camera);           // buffer fresco
    const src = ref.renderer.domElement;
    const W = src.width, H = src.height;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#04080f"; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(src, 0, 0);                              // el cielo (mismo origen)
    const es = lang === "es";
    const pad = Math.round(H * 0.045);
    const wrap = (text, maxW, font) => {
      ctx.font = font; const words = text.split(/\s+/); const lines = []; let cur = "";
      for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
      if (cur) lines.push(cur); return lines;
    };

    // franja inferior para legibilidad
    const grad = ctx.createLinearGradient(0, H * 0.52, 0, H);
    grad.addColorStop(0, "rgba(4,8,15,0)"); grad.addColorStop(1, "rgba(4,8,15,0.94)");
    ctx.fillStyle = grad; ctx.fillRect(0, Math.round(H * 0.52), W, H);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";

    if (selObj && selObj.name) {
      const live = selObj.layer === "solar" ? { ...selObj, ...(bodiesRef.current.find(b => b.name === selObj.name) || {}) } : selObj;
      const info = describeObject(live, lang, TC[lang], false);
      const TYPE = info.type;
      const distStr = info.facts[0] && info.facts[0].label === TC[lang].fDistance ? info.facts[0].value : "";
      const descFont = `${Math.round(H * 0.026)}px Georgia, serif`;
      const desc = (wiki && wiki.extract) ? wiki.extract : "";
      const descLines = desc ? wrap(desc, W - pad * 2, descFont).slice(0, 3) : [];
      const lightLine = (selObj.dist_ly > 0)
        ? (es ? `Su luz tardó ${fmtYears(selObj.dist_ly, lang)} en llegar.` : `Its light took ${fmtYears(selObj.dist_ly, lang)} to arrive.`)
        : "";

      // dibujar de abajo hacia arriba
      let y = H - pad;
      ctx.fillStyle = "rgba(201,184,255,0.9)"; ctx.font = `${Math.round(H * 0.022)}px Georgia, serif`;
      ctx.fillText("Teseo · teseo.yachaydeep.com", pad, y); y -= Math.round(H * 0.042);
      if (lightLine) { ctx.fillStyle = "rgba(120,170,255,0.95)"; ctx.font = `italic ${Math.round(H * 0.024)}px Georgia, serif`; ctx.fillText(lightLine, pad, y); y -= Math.round(H * 0.040); }
      ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.font = descFont;
      for (let i = descLines.length - 1; i >= 0; i--) { ctx.fillText(descLines[i], pad, y); y -= Math.round(H * 0.034); }
      if (distStr || TYPE) { ctx.fillStyle = "#c9b8ff"; ctx.font = `${Math.round(H * 0.028)}px 'JetBrains Mono', monospace`; ctx.fillText([TYPE, distStr].filter(Boolean).join("  ·  "), pad, y); y -= Math.round(H * 0.050); }
      ctx.fillStyle = "#ffffff"; ctx.font = `${Math.round(H * 0.055)}px Georgia, 'Times New Roman', serif`;
      ctx.fillText(info.name, pad, y);
    } else {
      let y = H - pad;
      ctx.fillStyle = "rgba(201,184,255,0.85)"; ctx.font = `${Math.round(H * 0.024)}px Georgia, serif`;
      ctx.fillText("teseo.yachaydeep.com", pad, y); y -= Math.round(H * 0.045);
      ctx.fillStyle = "#ffffff"; ctx.font = `${Math.round(H * 0.05)}px Georgia, serif`;
      ctx.fillText("Teseo", pad, y);
    }

    try {
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = selObj && selObj.name ? `teseo-${selObj.name.replace(/[^\w-]+/g, "_")}.png` : "teseo-cielo.png";
      a.click();
    } catch { /* toDataURL bloqueado */ }
  }, [selObj, lang, wiki]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeo("unsupported"); return; }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(+pos.coords.latitude.toFixed(4)); setLon(+pos.coords.longitude.toFixed(4));
        setPlaceKind("me"); setLocalMode(true); setGeo("ok"); setSel(null);
        if (!isWideRef.current) setPanel(null);
      },
      (err) => setGeo(err && err.code === 1 ? "denied" : err && err.code === 3 ? "timeout" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }, []);
  const pickPlace = useCallback((p) => {
    setLat(p.lat); setLon(p.lon); setPlaceKind(p.name); setLocalMode(true); setGeo("idle"); setSel(null);
    if (!isWideRef.current) setPanel(null);
  }, []);
  const setManualPlace = useCallback((a, o) => {
    setLat(+a.toFixed(4)); setLon(+o.toFixed(4)); setPlaceKind("custom"); setLocalMode(true); setGeo("idle"); setSel(null);
    if (!isWideRef.current) setPanel(null);
  }, []);
  // ── apuntar al cielo ──
  const stopAr = useCallback(() => { pointRef.current.stop(); setAr("off"); setArSrc(null); }, []);
  // Se llama desde el toque en el botón: iOS solo muestra el permiso de sensores dentro del gesto.
  const startAr = useCallback(() => {
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
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !arOn) return;
    const { camera, controls } = ref, st = ref.ar;
    st.on = true; st.has = false; st.t = 0; st.n = 0; st.cur.identity(); st.savedFov = camera.fov;
    controls.enabled = false; controls.autoRotate = false;
    ref.earth.visible = false;             // el observador está en el centro: la Tierra en miniatura estorbaría
    ref.points.material.uniforms.uScale.value = 1.9;   // visto desde dentro, las estrellas se dibujan más grandes
    ref.ground.material.opacity = 0.86;    // el suelo casi opaco: lo que queda debajo está "bajo tus pies"
    ref.applyArFov();
    return () => {
      st.on = false;
      const r = sceneRef.current; if (!r) return;      // la escena ya se destruyó
      controls.enabled = true;
      r.points.material.uniforms.uScale.value = 1;
      r.ground.material.opacity = 0.55;
      camera.fov = st.savedFov; camera.updateProjectionMatrix(); r.sizeSolar();
      r.earth.visible = !r.sunSprite.visible;
      // la cámara vuelve a un estado coherente: el objeto abierto, el cielo local o la vista general
      const so = selObjRef.current;
      if (so && so.nx != null) {
        const v = new THREE.Vector3(so.nx, so.ny, so.nz);
        if (r.localQuat) v.applyQuaternion(r.localQuat);
        v.normalize();
        controls.target.copy(v.clone().multiplyScalar(870)); camera.position.copy(v.multiplyScalar(540));
      } else if (r.localModeOn) {
        const tall = camera.aspect < 1 ? 1.5 : 1;
        controls.target.set(0, 120, 0); camera.position.set(0, 560 * tall, 1500 * tall);
      } else {
        controls.target.set(0, 0, 0); camera.position.set(0, 0, 1700);
      }
      camera.up.set(0, 1, 0);
      controls.update();
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

  // un panel a la vez; en móvil la ficha y los paneles comparten la parte baja
  const openPanel = useCallback((id) => {
    setPanel(p => (p === id ? null : id));
    if (!isWideRef.current) setSelObj(null);
  }, []);
  const toggleLayer = useCallback((key) => {
    setLayerError(p => (p[key] ? { ...p, [key]: false } : p));
    setEnabled(e => ({ ...e, [key]: !e[key] }));
  }, []);
  const onStageKey = useCallback((e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (panel) setPanel(null); else if (selObj) setSelObj(null); else if (full) setFull(false);
  }, [panel, selObj, full]);

  // click para identificar un objeto (raycast)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.renderer) return;
    const el = ref.renderer.domElement;
    const vtmp = new THREE.Vector3();
    let downX = 0, downY = 0;
    const onDown = (e) => { downX = e.clientX; downY = e.clientY; };
    const onUp = (e) => {
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return; // fue arrastre
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const touch = e.pointerType === "touch" ? 8 : 0;          // el dedo es menos preciso que el ratón
      // el más cercano al toque en pantalla, entre todo lo visible
      let best = null, bestD = Infinity;
      const consider = (x, y, z, maxD, make) => {
        vtmp.set(x, y, z);
        if (ref.localQuat) vtmp.applyQuaternion(ref.localQuat);
        vtmp.project(ref.camera);
        if (vtmp.z > 1 || vtmp.z < -1) return;                   // detrás de la cámara
        const d = Math.hypot((vtmp.x * 0.5 + 0.5) * r.width - px, (-vtmp.y * 0.5 + 0.5) * r.height - py);
        if (d < maxD + touch && d - maxD < bestD) { bestD = d - maxD; best = make; }
      };
      if (ref.showSolar) for (const b of (ref.bodies || [])) consider(b.nx * 860, b.ny * 860, b.nz * 860, 30, () => ({ ...b, layer: "solar" }));
      for (const o of (ref.layerObjs || [])) {
        if (!o.points.visible) continue;
        const objs = o.points.userData.objs || [];
        for (let i = 0; i < objs.length; i++) { const ob = objs[i]; consider(ob.nx * 870, ob.ny * 870, ob.nz * 870, 24, () => ({ ...ob, layer: o.key })); }
      }
      const pa = ref.posAttr.array, stars = sky.stars;
      for (let i = 0; i < stars.length; i++) {
        if (!stars[i][7]) continue;                              // solo estrellas con nombre propio
        consider(pa[i * 3], pa[i * 3 + 1], pa[i * 3 + 2], 16, () => starObj(stars[i], i));
      }
      if (best) setSelObj(best());
      else { setSelObj(null); if (!isWideRef.current) setPanel(null); }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => { el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); };
  }, [ready, sky]);

  const onPick = useCallback((e) => {
    const v = e.target.value;
    setSel(v === "__all__" ? null : v);
    setDepth(0);   // siempre arranca en 'plano' y el usuario revela la profundidad
    setSelObj(null); setLocalMode(false);
    if (!isWideRef.current) setPanel(null);
  }, []);

  // ── disposición: el visor ocupa todo el ancho de la ventana y el alto que queda ──
  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const measure = () => {
      const r = wrap.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const wide = vw >= 900;
      const gutter = wide ? 16 : 0;
      wrap.style.setProperty("--sk-ml", `${gutter - r.left}px`);
      wrap.style.setProperty("--sk-w", `${vw - gutter * 2}px`);
      wrap.style.setProperty("--sk-top", `${Math.round(r.top + window.scrollY) + gutter}px`);
      // si la página muestra un aviso fijo abajo (cookies), los controles suben para no quedar tapados
      const ck = document.getElementById("yd-cookies");
      const stage = wrap.firstElementChild;
      let safe = 0;
      if (ck && stage && window.scrollY < 4) {
        const cr = ck.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        if (cr.height > 0) safe = Math.max(0, Math.min(sr.bottom, window.innerHeight) - cr.top);
      }
      wrap.style.setProperty("--sk-safe", `${Math.round(safe)}px`);
      setIsWide(wide);
    };
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(measure) : null;
    if (mo) mo.observe(document.body, { childList: true });
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) { ro.observe(wrap); ro.observe(document.body); }
    window.addEventListener("resize", measure);
    const tm = setTimeout(measure, 600);          // tras cargar fuentes la cabecera puede cambiar de alto
    return () => { if (ro) ro.disconnect(); if (mo) mo.disconnect(); window.removeEventListener("resize", measure); clearTimeout(tm); };
  }, []);

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
    if (selObj.layer === "solar") { const b = bodies.find(x => x.name === selObj.name); return b ? { ...selObj, ...b } : selObj; }
    return selObj;
  }, [selObj, bodies]);
  const when = new Date(whenStr);
  const placeLabel = placeKind === "me" ? t.myLocation : placeKind === "custom" ? t.customPlace : placeKind;
  const tourReady = !!(ready && datasets.messier && datasets.blackholes);
  const covered = !isWide && (!!selObj || !!panel);
  const showDepth = !!(sky && selMeta && !localMode && !tourActive);
  const showOnboard = !!(showHint && sky && !selObj && !panel && !tourActive && !showDepth && !arOn);
  // barra de "Apuntar al cielo": invitación (dentro de Mi cielo), indicador activo o aviso de error
  const arBar = !sky || tourActive ? null
    : arOn ? "on"
    : arError ? "error"
    : (arCapable && ar === "off" && localMode && lat != null && !covered && !showOnboard) ? "cta" : null;
  const stageClass = "sk-stage" + (full ? " is-full" : "") + (covered ? " is-covered" : "") + (selObj ? " has-sheet" : "")
    + (tourActive ? " has-tour" : "") + (showDepth ? " has-depth" : "") + (arOn ? " is-ar" : "");

  return (
    <div ref={wrapRef} className="sk-wrap">
    <div className={stageClass} onKeyDown={onStageKey}>
      <div ref={mountRef} className="sk-canvas" role="application" tabIndex={0} onKeyDown={onCanvasKey} aria-label={t.canvasAria} />
      <SkyLabels apiRef={labelsApiRef} colors={LABEL_COLOR} unit={t.lightyears} locale={lang === "es" ? "es" : "en-US"} />

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
          <SearchBox t={t} query={query} setQuery={setQuery} results={results} onResult={onResult} quick={quick} />
          {(viewFrom || localMode) && (
            <div className="sk-chips">
              {viewFrom && (
                <div className="sk-chip tone-violet">
                  <span>{t.skyFrom} <b>{viewFrom.name}</b></span>
                  <button type="button" onClick={() => setViewFrom(null)}>{t.backToEarth}</button>
                </div>
              )}
              {localMode && lat != null && (
                <div className="sk-chip tone-blue">
                  <button type="button" className="chip-main" onClick={() => openPanel("location")} aria-label={`${t.changePlace}: ${placeLabel}`}>
                    <Icon name="pin" size={16} /><span>{placeLabel}</span>
                  </button>
                  <button type="button" onClick={() => setLocalMode(false)} aria-label={t.leaveMySky}><Icon name="close" size={15} /></button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {sky && (
        <div className="sk-rail">
          <button type="button" onClick={() => zoomBy(0.8)} aria-label={t.zoomIn} title={t.zoomIn}><Icon name="plus" size={22} /></button>
          <button type="button" onClick={() => zoomBy(1.25)} aria-label={t.zoomOut} title={t.zoomOut}><Icon name="minus" size={22} /></button>
          <span className="sk-rail-gap is-extra" aria-hidden="true" />
          <button type="button" className={`is-extra${selObj ? " is-on" : ""}`} onClick={recenter} aria-label={selObj ? t.centerObj : t.centerView} title={selObj ? t.centerObj : t.centerView}><Icon name="target" size={20} /></button>
          <button type="button" className="is-extra" onClick={savePostcard} aria-label={t.postcardAria} title={t.postcardAria}><Icon name="camera" size={20} /></button>
          <button type="button" className={`is-extra${full ? " is-on" : ""}`} onClick={() => setFull(f => !f)} aria-pressed={full} aria-label={full ? t.fullOff : t.fullOn} title={full ? t.fullOff : t.fullOn}><Icon name={full ? "shrink" : "expand"} size={20} /></button>
        </div>
      )}

      {showDepth && (
        <section className="sk-depth" aria-label={t.depthTitle(selMeta.la)}>
          <div className="sk-depth-head">
            <h2>{t.depthTitle(selMeta.la)}</h2>
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
          layersOn={layersOn} layersWarn={failedLayers.length > 0} />
      )}

      {sky && tourActive && (
        <TourCard t={t} title={tourTitle} fact={tourFact} index={tourIndex} total={TOUR.length} text={tourText} auto={tourAuto}
          onPrev={() => setTourIndex(i => (i - 1 + TOUR.length) % TOUR.length)}
          onNext={() => setTourIndex(i => (i + 1) % TOUR.length)}
          onToggleAuto={() => setTourAuto(a => !a)}
          onExit={() => setTourActive(false)}
          onRetry={() => setTourTry(n => n + 1)} />
      )}

      {arBar && (
        <PointingBar t={t} mode={arBar} source={arSrc} error={arError} aligned={arAligned} apiRef={arHudRef}
          onStart={startAr} onExit={stopAr} onReset={resetArAlign} onDismiss={() => setArError(null)} canRetry={arCapable} />
      )}

      {showOnboard && <Onboarding t={t} onDone={dismissHint} onTour={startTour} tourReady={tourReady} />}

      {sky && panel === "layers" && (
        <LayersPanel t={t} lang={lang} layers={LAYERS} datasets={datasets} enabled={enabled} loadingLayer={loadingLayer} layerError={layerError}
          onToggle={toggleLayer} onRetry={loadLayer} showSolar={showSolar} onToggleSolar={() => setShowSolar(v => !v)}
          constellations={sortedCons} sel={sel} onPick={onPick} labelDensity={labelDensity} onDensity={setLabelDensity}
          onClose={() => setPanel(null)} />
      )}
      {sky && panel === "location" && (
        <LocationPanel t={t} localMode={localMode} lat={lat} lon={lon} placeName={placeLabel} geo={geo}
          onUseMyLocation={useMyLocation} places={PLACES} onPlace={pickPlace} onManual={setManualPlace}
          onExit={() => setLocalMode(false)} onClose={() => setPanel(null)}
          pointing={arCapable ? { state: ar, onStart: ar === "off" ? startAr : stopAr } : null} />
      )}
      {sky && panel === "time" && (
        <TimePanel t={t} lang={lang} when={when} whenStr={whenStr} isNow={!timeMoved} playing={playing}
          onShift={shiftMin} onTogglePlay={() => { setTimeMoved(true); setPlaying(pl => !pl); }}
          onNow={() => { setPlaying(false); setTimeMoved(false); setWhenStr(nowLocalInput()); }}
          onSet={(v) => { setPlaying(false); setTimeMoved(true); setWhenStr(v); }}
          onClose={() => setPanel(null)} />
      )}

      {liveObj && (
        <ObjectSheet obj={liveObj} lang={lang} t={t} wiki={wiki} wikiState={wikiState}
          meteorActive={liveObj.layer === "meteors" && meteorActive(liveObj)}
          onClose={() => setSelObj(null)} onShare={shareLink} shareState={shareState}
          onPostcard={savePostcard} onCenter={recenter}
          canViewFrom={liveObj.layer === "star" && liveObj.dist_ly > 0}
          onViewFrom={() => {
            const d = liveObj.dist_ly;
            setViewFrom({ name: liveObj.name, pos: [liveObj.nx * d, liveObj.ny * d, liveObj.nz * d] });
            setSel(null); setSelObj(null);
          }} />
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
