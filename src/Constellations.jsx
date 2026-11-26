import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ephemeris } from "./ephemeris.js";
import { ErrorNotice } from "./ErrorBoundary.jsx";
import { fetchJson, isAbort, TIMEOUT_MS } from "./net.js";
import { BODIES, BODY_NAMES, bodyName, textureUrl, drawBodySprite, SPRITE_PX, SPRITE_RES } from "./sky/bodies.js";
import { searchMoons, moonName, moonOrbit, MOON_INFO, MOON_KEYS, moonsSky, planetPole, planetOrientation, POLAR_FLATTENING } from "./sky/moons.js";
import { drawSphere } from "./sky/art.js";
import { RING_URL } from "./sky/bodies.js";

// Luna de otro planeta como objeto de la escena: su dirección real en el cielo (a menos de un cuarto de grado
// de su planeta, src/sky/moons.js) y su clave en inglés («Io») como nombre.
function moonObjFrom(bodies, key, date = new Date()) {
  const o = moonOrbit(key); if (!o) return null;
  const b = (bodies || []).find((x) => x.name === o.parent); if (!b) return null;
  let dir = [b.nx, b.ny, b.nz], aArcsec = null;
  try {
    if (b.dist_au) { const m = moonsSky(b, date).find((x) => x.key === key); if (m) { dir = m.dir; aArcsec = m.aArcsec; } }
  } catch { /* sin posición propia: va donde su planeta */ }
  return { nx: dir[0], ny: dir[1], nz: dir[2], ra: b.ra, dec: b.dec, eqDate: b.eqDate, dist_au: b.dist_au, r_au: b.r_au, layer: "moon", name: key, parent: o.parent, aArcsec };
}
const foldTxt = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
import { fmtDist, fmtYears, fmtWhenShort, fmtKm, fmtDuration, num } from "./sky/format.js";
import Icon from "./sky/icons.jsx";
import { PerfMeter, SkyLabels, SearchBox, Dock, LayersPanel, LocationPanel, TourCard, Onboarding, PointingBar, SkyActions, GuideHud, TonightPanel } from "./sky/panels.jsx";
import { cameraQuat, lookFromQuat } from "./sky/deviceOrientation.js";
import { createResumeDetector, isDragToManual } from "./sky/arResume.js";
import { guideArrow, turnHint, altAz } from "./sky/guide.js";
import { computeTonight } from "./sky/tonight.js";
import { buildSkyNotes } from "./sky/explain.js";
import { caldwellCommon } from "./sky/describe.js";
import { caldwellMatch } from "./sky/caldwell.js";
import { TX } from "./sky/i18n.js";
import { createPointing, pointingSupported } from "./sky/pointing.js";
import ObjectSheet, { describeObject, visibilityOf } from "./sky/ObjectSheet.jsx";
import ConstellationSheet, { DepthBar } from "./sky/ConstellationSheet.jsx";
import ShareDialog from "./sky/ShareDialog.jsx";
import TimeSheet, { ArRail } from "./sky/TimeSheet.jsx";
import { RATES, REAL } from "./sky/timeDial.js";
import { stepFieldTz, setMinuteTz, fetchTimeZone, cachedTimeZone, tzParts } from "./sky/placeTime.js";
import { buildPostcard } from "./sky/postcard.js";
import { snapshotView } from "./sky/viewSnapshot.js";
import { captureFaces, capturePatches, pastePatches, equirectFromFaces, layoutPanoLabels, drawPanoLabels, drawNadirStamp, withGPano, panoFileName, panoSize, altAzOf, panoCredits, shortCredits } from "./sky/pano360.js";
import { labelStyle } from "./sky/viewSnapshot.js";
import { starHex } from "./sky/starColor.js";
import { perfFlag, createFrameStats, createAdaptive } from "./sky/perf.js";
import { fetchWikiFor, fetchImageCredit } from "./sky/wiki.js";
import { constellationData, conNameEs } from "./sky/constellations.js";
import { declination } from "./sky/geomag.js";
import { compassPoint8 } from "./sky/deviceOrientation.js";
import { useStageLayout } from "./sky/viewport.js";
import { localSkyQuat, localSkyQuatJ2000, precessionQuat, lookFrame, dirToYawPitch, yawPitchToDir, lookQuat, spanToFov, shortToSpan, dragDelta, clampPitch, clampSpan,
  localDefaultAz, starScaleFor, screenOf, rankHits, SPAN_DEF, PITCH_MIN_LOCAL, PITCH_MIN_FREE, PITCH_MAX, LOCAL_ALT_DEF } from "./sky/look.js";
import { skyBodies, altAzJ2000 } from "./sky/frames.js";
import { skyState, visibility, starsHidden, countVisibleNow, moonMagV, phaseAngleFromIllum, altAzToDir } from "./sky/atmosphere.js";
import { createAtmosphereLayer } from "./sky/atmosphereLayer.js";
import { AtmosphereControls, DayWarning } from "./sky/AtmosphereControls.jsx";
import { createCloudsLayer, makeOccluder, OCC_HIDE, cloudLift } from "./sky/cloudsLayer.js";
import { createAuroraLayer } from "./sky/auroraLayer.js";
import { dipole, decodeOvation, bandsFromGrid, bandsFromKp, lookAt, darkness, kpAt, hemiOf, geoToMag, probGrid, probModel, mlt as magLocalTime } from "./sky/aurora.js";
import { AuroraControl } from "./sky/AuroraControl.jsx";
import { KP_TYPICAL } from "./sky/auroraPlan.js";
import { rainLook, thickenForRain, weatherSky, withPointRain } from "./sky/rainLook.js";
import { CompassChip, MountSheet, FlatPhone } from "./sky/MountSheet.jsx";
import { createMountLines } from "./sky/mountLinesLayer.js";
import { createDepthView } from "./sky/depthView.js";
import { groundLines, horizonMark } from "./sky/mountAlign.js";
import { MT } from "./sky/i18n-mount.js";
import { createTerrainLayer } from "./sky/terrainLayer.js";
import { andeanLabels, TX_AND, horizonAltAt } from "./sky/andean.js";
import { fetchNearTerrain, createNearTerrainLayer, SUMMIT_LIFT_M, reliefFromNear } from "./sky/terrain3d.js";
import { DEFAULT_LAYERS, presetState, presetOf } from "./sky/layerPresets.js";
import { useKeepAwake } from "./sky/keepAwake.js";
import { fetchHorizon, behindTerrain, cellKey, fetchPeaks, peaksToLabel, peakName, fetchElevations, fetchSummit, fetchLandColors } from "./sky/horizon.js";
import { monumentsNear, groundRing, median, silhouette, withMonuments, offsetOf, footprintRadius } from "./sky/monuments.js";
import { stopsAt, stopOf } from "./sky/stops.js";
import { loadSiteModel, loadIntiScan, siteModel, modelGround } from "./sky/machuModel.js";
import { createMonumentLayer, placeMonuments, monumentLabels, groundReach, reliefPoints, groundSilhouette, RELIEF_R, RELIEF_NA } from "./sky/monumentLayer.js";
const NEAR_RELIEF_R = [0.03, 0.06, 0.1, 0.15, 0.22, 0.3, 0.4, 0.52, 0.68, 0.9];
import { createMilkyWayLayer, milkyWayVisibility } from "./sky/milkyWayLayer.js";
import { loadSunImage, sdoSlot, SDO_DISC, SUN_POLE } from "./sky/sunImage.js";
import { createSkyImagesLayer } from "./sky/skyImagesLayer.js";
import { createCometLayer } from "./sky/cometLayer.js";
import { cometsAt, minorObjects, neoPassing } from "./sky/cometSky.js";
import { createHipsLayer, HIPS_FINE, setHipsMasks } from "./sky/hipsLayer.js";
import { TerrainControl } from "./sky/TerrainControl.jsx";
import { WeatherPanel } from "./sky/WeatherPanel.jsx";
import { fetchForecast, cloudsAt } from "./sky/weather.js";
import { fetchSatClouds, satWeight, mergeClouds, mapOffsets, fuseSat, satCredit } from "./sky/satClouds.js";
import { clampBortle, BORTLE_DEFAULT, fetchBortleEstimate, bortleCell, BORTLE_EST_T } from "./sky/lightPollution.js";
import { bodyMagnitude, SUN_MAG_V } from "./sky/planetMag.js";
import { track } from "./ui/track.js";
import { GuidesLayer, GUIDE_LABEL_COLOR } from "./sky/guidesLayer.js";
import { GuidesControls, useGuides } from "./sky/GuidesControls.jsx";
// la ISS en el Cielo: capa three.js, ficha, píldora y datos de /api/iss/passes
import { IssLayer, ISS_COLORS, ISS_RATES, stepClock as stepIssClock } from "./sky/issLayer.js";
import IssSheet from "./sky/IssSheet.jsx";
import PeakSheet from "./sky/PeakSheet.jsx";
import MonSheet from "./sky/MonSheet.jsx";
import { WxCard, WxIco } from "./sky/WxCard.jsx";
import { fetchModels, tempAt } from "./sky/models.js";
import { riseTransitSet, H0_SUN } from "./sky/riseset.js";
import { TOUR_STOPS, TOUR_T, CANDIDATES, pickVisible, sunsetAt, gizaView, KHUFU, VOLCANO_VIEW, SANGAY, bearing, deepKind, nameOf } from "./sky/tour.js";
import { nowUrl, parseNow, wxIcon, WX_NAMES, WX_MAYBE, fmtTemp, fmtWind, windText, windVector, hourAt, wxForPlace } from "./sky/nowWeather.js";
import { fetchVolcanoes, matchVolcanoes, recentEruption, eruptingInView, volcanoesOnSkyline, VT as VOLC_T } from "./sky/volcanoes.js";
import { angleOf as terrainAngleOf } from "./sky/terrainLayer.js";
import { createPlumeLayer, veiColumnKm, plumeParams } from "./sky/plumeLayer.js";
import IssPill, { nextRate } from "./sky/IssPill.jsx";
import { ISS as ISS_TX } from "./sky/i18n-iss.js";
import { fetchIssPass, hasTrack, hiddenReason, formatClock as issClockFmt, formatDayTime as issDayTime, DEFAULT_DAYS as ISS_DAYS } from "./sky/issPasses.js";
import { altAzToLocal } from "./sky/issSky.js";
import { categoryOf } from "./sky/searchCategory.js";
import { createWhenAdvance } from "./sky/whenClock.js";
import "./sky/sky.css";

const API = import.meta.env.VITE_API_URL || "";
const LAYERS = [
  { key: "messier",    file: "/deepsky.json",    es: "Messier",          en: "Messier",      color: 0x67e8c8, size: 8 },
  // Caldwell + Nubes de Magallanes (~10 KB con gzip): se carga al encender la capa o al empezar a buscar
  { key: "caldwell",   file: "/caldwell.json",   es: "Caldwell",         en: "Caldwell",     color: 0xb48cff, size: 8, lazy: true },
  // NGC e IC (OpenNGC): lo que no está ya en Messier, Caldwell ni Galaxias; sus símbolos y nombres salen al acercarse
  { key: "ngc",        file: "/ngc.json",        es: "NGC e IC",         en: "NGC & IC",     color: 0x7fd3c0, size: 5, lazy: true },
  // dos listas cortas y escogidas (scripts/build_extras.py): rarezas del cielo profundo y estrellas dobles y variables
  { key: "oddities",   file: "/oddities.json",   es: "Nebulosas oscuras, supernovas y cuásares", en: "Dark nebulae, supernovae & quasars", color: 0xff9e6b, size: 9, lazy: true },
  { key: "specialstars", file: "/special-stars.json", es: "Estrellas dobles y variables", en: "Double & variable stars", color: 0xffe9a8, size: 9, lazy: true },
  { key: "pulsars",    file: "/pulsars.json",    es: "Púlsares",         en: "Pulsars",      color: 0xff5dc8, size: 6, lazy: true },
  { key: "blackholes", file: "/blackholes.json", es: "Agujeros negros",  en: "Black holes",  color: 0xff7a3c, size: 11 },
  { key: "deepfields", file: "/deepfields.json", es: "Campos profundos", en: "Deep fields",  color: 0xffe08a, size: 10 },
  // el mapa fotográfico (src/sky/hipsLayer.js) no es un catálogo: no tiene fichero ni objetos, solo el interruptor
  { key: "photo", virtual: true, es: "Mapa fotográfico", en: "Photographic map", color: 0xd8c7a0, size: 0 },
  { key: "galaxies",   file: "/galaxies.json",   es: "Galaxias",         en: "Galaxies",     color: 0x9db4ff, size: 5, lazy: true },
  { key: "meteors",    file: "/meteorshowers.json", es: "Lluvias de meteoros", en: "Meteor showers", color: 0xffd27a, size: 9 },
  { key: "comets",     api: true, endpoint: "/api/comets", es: "Cometas", en: "Comets", color: 0x8be0ff, size: 9 },
  // planetas enanos y asteroides: elementos de JPL (public/minor-bodies.json); su posición se calcula aquí para cada fecha
  { key: "minor",      file: "/minor-bodies.json", es: "Planetas enanos y asteroides", en: "Dwarf planets & asteroids", color: 0xe6b877, size: 8, lazy: true },
  { key: "probes",     api: true, endpoint: "/api/probes", es: "Sondas y telescopios", en: "Probes & telescopes", color: 0xe6ebff, size: 10 },
  // timeout mayor: con la caché del backend fría, el NASA Exoplanet Archive (~780 KB) tarda bastante más que el resto
  { key: "exoplanets", api: true, endpoint: "/api/exoplanets", es: "Exoplanetas", en: "Exoplanets", color: 0x4dd866, size: 6, timeout: 45000 },
];
const LABEL_COLOR = { card:"#9cc2ff", cardn:"#ff9d8a", peak:"#f3e4c6", andsun:"#ffc95c", andsite:"#7ee0c3", mount:"#f4f1ff", dvtick:"#8f96b8", con:"#c9b8ff", star:"#ffffff", obj_messier:"#67e8c8", obj_caldwell:"#c7a8ff", obj_pulsars:"#ff5dc8", obj_deepfields:"#ffe08a", obj_blackholes:"#ff7a3c", obj_galaxies:"#9db4ff", obj_meteors:"#ffd27a", obj_comets:"#8be0ff", obj_minor:"#e6b877", obj_ngc:"#7fd3c0", obj_oddities:"#ff9e6b", obj_specialstars:"#ffe9a8", obj_probes:"#e6ebff", obj_exoplanets:"#8fe89f", solar:"#ffe9a8", iss: ISS_COLORS.label, iss_t: ISS_COLORS.tick, ...GUIDE_LABEL_COLOR };
// Nombres en el cielo: por defecto solo los objetos con nombre propio o notables. Los
// de catálogo ("J1759+5036", "NGC 1269"…) aparecen al acercarse, cuando ya caben pocos
// en pantalla (umbral según "Nombres en el cielo"), o al tocar el objeto.
function isNotable(key, ob, when) {
  if (key === "messier") return !!ob.cn || (ob.mag != null && ob.mag <= 6);
  if (key === "caldwell") return !!ob.cn || (ob.mag != null && ob.mag <= 6);
  if (key === "galaxies") return !!ob.cat && ob.cat !== ob.name;
  if (key === "ngc") return !!ob.cn && (ob.mag == null || ob.mag <= 9);
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
const TERRAIN_KEY = "teseo_terrain";    // interruptor "Montañas" (relieve real; encendido por defecto)
const DAYWARN_KEY = "teseo_daywarn_off";
const CONS_KEY = "teseo_cons";          // "Constelaciones" (líneas y nombres; encendido por defecto)
const ANDEAN_KEY = "teseo_andean";     // "Astronomía andina": Sol en solsticios/equinoccios + sitios quitu-caranquis (apagado)
const PEAKS_KEY = "teseo_peaks";        // "Nombres de las montañas" (OpenStreetMap; apagado por defecto)
const MONUMENTS_KEY = "teseo_monuments"; // "Monumentos" (pirámides, Stonehenge…; encendido por defecto)
const AURORA_KEY = "teseo_aurora";     // interruptor "Auroras" (1/0; encendido por defecto: solo se dibuja si hay aurora)
const CLOUDS_KEY = "teseo_clouds";      // interruptor "Nubes" (1/0; apagado por defecto: un cielo cubierto no deja ver nada)
// Penalización (mag) para objetos extensos: su luz se reparte en un área, así que se ven peor que una
// estrella de la misma magnitud integrada. APROXIMACIÓN declarada en la interfaz (deepNote).
const EXTENDED_PENALTY = { galaxy: 1.5, nebula: 1.5, snr: 1.5, open: 1.0, globular: 1.0, cluster: 1.0, planetary: 1.0, clneb: 1.0, dark: 1.5, other: 1.5 };
const extPenalty = (key, ob) => key === "galaxies" ? 1.5 : (EXTENDED_PENALTY[ob.type] ?? 1.5);
const TELE_FOV = 25;  // con menos de 25° de campo la vista es «de telescopio»: los objetos de catálogo tienen nombre y se pueden elegir aunque no se vean a simple vista
const NGC_FOV = 40;   // la capa NGC/IC aparece con menos de 40° de campo: de lejos serían cientos de puntos sin nombre
const MAG_LAYERS = new Set(["messier", "caldwell", "galaxies", "ngc"]);   // símbolo según su magnitud y visibilidad con atmósfera
const loadBortleMap = () => { try { return JSON.parse(localStorage.getItem(BORTLE_KEY) || "{}") || {}; } catch { return {}; } };
// Sol, Luna y planetas con su magnitud aparente (planetas: Mallama y Hilton 2018; Luna: Schaefer 1998, aprox.)
// Lugar de "Mi cielo" al abrir: la última elección explícita (localStorage) o, si nunca se eligió, Quito
// (atajo con su altitud). Quito por defecto NO pide la geolocalización. Un enlace con punto de observación
// (v=) o constelación en profundidad (c=), incompatibles con Mi cielo, gana sobre ambos.
const sameName = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^(volcan|cerro|nevado|loma)\s+/, "").replace(/[^a-z0-9]/g, "");
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
    return { local: !linkWins, lat: saved.lat, lon: saved.lon, kind: saved.kind || "custom", elev: Number.isFinite(saved.elev) ? saved.elev : (pr ? pr.elev : null),
      preset: saved.elevSrc === "terrain" ? "terrain" : !!pr, isDefault: false, fine: !!saved.fine, summit: !!saved.summit };
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
const ASK_PLACE_KEY = "teseo_place_asked_v1";   // ya se preguntó «¿desde dónde miras el cielo?» la primera vez
// medidor de rendimiento: #sky?...&fps=1 o ?perf=1 (se lee una vez, al cargar)
const PERF_ON = typeof window !== "undefined" && perfFlag(window.location.hash, window.location.search);
// &adapt=0: resolución fija (sin bajada adaptativa), para comparar mediciones
const ADAPT_OFF = typeof window !== "undefined" && /[?&]adapt=0\b/.test(window.location.hash + "&" + window.location.search);
// &e2e=1: expone en window.__teseoSky el estado de la cámara (solo lectura) para las pruebas en navegador
const E2E = typeof window !== "undefined" && /[?&]e2e=1\b/.test(window.location.hash + "&" + window.location.search);
const IDLE_EVERY = 6;                 // con el cielo quieto se dibuja 1 de cada 6 cuadros (la Tierra en miniatura sigue girando)
const VIVID_KEY = "teseo_star_vivid";   // "resaltar colores de las estrellas" (1/0)
const ISS_RATE_DEF = 10;              // ISS: ×10 por defecto (una pasada de ~6 min se ve en ~36 s); ×1 = tiempo real

// Términos genéricos de categoría: al buscar "pulsar" o "agujero negro" se
// lista la capa entera en vez de exigir el nombre exacto de cada objeto.
// Nombres tradicionales en español de estrellas brillantes → nombre IAU del catálogo (HYG).
// Se buscan en minúsculas; solo se añaden los que difieren del nombre IAU.
const STAR_ES = {
  "sirio": "Sirius", "canopo": "Canopus", "arturo": "Arcturus", "proción": "Procyon", "procion": "Procyon",
  "estrella polar": "Polaris", "polar": "Polaris", "espiga": "Spica", "achernar": "Achernar",
  "aldebarán": "Aldebaran", "fomalhaut": "Fomalhaut", "régulo": "Regulus", "regulo": "Regulus",
  "cástor": "Castor", "pólux": "Pollux", "polux": "Pollux", "deneb": "Deneb", "altair": "Altair",
  "rigil kentaurus": "Rigil Kentaurus", "alfa centauri": "Rigil Kentaurus", "hadar": "Hadar",
  "acrux": "Acrux", "mimosa": "Mimosa", "antares": "Antares", "bellatrix": "Bellatrix",
  "betelgeuse": "Betelgeuse", "bételgeuse": "Betelgeuse", "rígel": "Rigel", "alnilam": "Alnilam",
};

function labelForObj(key, o, lang) {
  if (key === "messier" || key === "ngc") return `${o.name}${o.cn ? " · " + o.cn : ""}`;
  if (key === "galaxies") return o.name + (o.cat && o.cat !== o.name ? " · " + o.cat : "");
  if (key === "caldwell") { const cn = caldwellCommon(o, lang); return o.c == null ? (cn || o.name) : `${o.name}${cn ? " · " + cn : ""}`; }
  if (key === "meteors" || key === "minor" || key === "oddities" || key === "specialstars") return lang === "en" ? (o.name_en || o.name) : o.name;
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

// Una lluvia está activa si el día (MM-DD) cae en [start, end]; la ventana puede
// cruzar el fin de año (p. ej. Cuadrántidas 12-28 -> 01-12). El día es el de `now` (la fecha del cielo) en la
// zona `tz` del lugar; sin zona, la del dispositivo.
function meteorActive(o, now = new Date(), tz = null) {
  const p = tzParts(now, tz);
  const md = String(p.m).padStart(2, "0") + "-" + String(p.d).padStart(2, "0");
  return o.start <= o.end ? (md >= o.start && md <= o.end) : (md >= o.start || md <= o.end);
}

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
    dvAngle: "Viewing angle", dvSide: "From the side", dvMain: "Main stars", dvAll: (n) => `All (${n})`, dvReal: "Real scale", dvComp: (k) => `Depth ×${k}`,
    dvYou: "You (Sun)", dvLy: (d) => `${Math.round(d).toLocaleString("en-US")} ly`, dvRange: (a, b) => (b == null ? `(over ${Math.round(a).toLocaleString("en-US")})` : `(${Math.round(a).toLocaleString("en-US")}–${Math.round(b).toLocaleString("en-US")})`), dvTick: (d) => `${d.toLocaleString("en-US")} ly`,
    dvScaleNote: { real: "Real scale: depth and width at the same scale.", comp: (k) => `Depth compressed ×${k} so the shape fits; widths are real.` }, dvErr: "Gold: distance range from the Hipparcos parallax error (1σ).",
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
    stopsAria: "Places to stand at this site", stopGo: (n) => `Go to ${n}`, pano360Aria: "Save a 360° photo of this sky (JPEG)", pano360Title: "360° photo", pano360Making: "Taking the 360° photo… (a few seconds)", pano360Alt: "Preview of the 360° photo", pano360Text: "This sky in 360°, made with Teseo", pano360Hint: "Google Photos, Facebook and 360° viewers open it so you can look around.",
    postcardAria: "Save a postcard of this sky (PNG)", fullOn: "Full screen", fullOff: "Exit full screen",
    close: "Close", now: "Now", west: "W",
    kinds: { con: "Constellation", star: "Star", solar: "Solar system" },
    loadingLayer: (n) => `Loading ${n}…`, failedLayer: (n) => `${n} could not be loaded`,
    depthAria: "Depth: from the flat view to real depth", wholeSky: "Whole sky",
    depthTitle: (n) => `${n} in real depth`,
    myLocation: "Your location", changePlace: "Change place", leaveMySky: "Leave My sky", topoOpen: "Pick on a topographic map", topoPoint: "Map point", topoSummit: "Summit (map)",
    tourFactDist: (d) => `${d} from Earth`,
    // ── buscador ──
    searchAria: "Search the sky", searchPlaceholder: "Search: Saturn, Orion, a galaxy…", searchClear: "Clear search",
    searchTry: "Try one of these", searchResults: "Search results", searchEmpty: "Nothing in the sky with that name. Try a planet, a star, a constellation or a spacecraft (Webb, Voyager, Parker…).",
    // ── dock ──
    dockAria: "Sky tools", layers: "Layers", mySky: "My sky", tour: "Tour",
    // ── capas ──
    layersTitle: "Layers", layersLead: "Add what you want to see. Every point sits where the real object is.",
    groups: { near: "Our neighbourhood", deep: "Deep sky", view: "View" },
    consLayer: "Constellations", consDesc: "The 88 constellations: their lines and names. Lines: Stellarium (modern sky culture, IAU).",
    solarLayer: "Sun, Moon and planets",
    layerDesc: {
      solar: "Where they are right now, computed from their orbits.",
      meteors: "The point each shower seems to come from.",
      comets: "Famous comets (NASA Horizons) and the bright ones of the season. They move with the date.",
      minor: "Pluto, Ceres, Vesta, Eris, Apophis and more, plus the asteroids passing near Earth these days. Source: JPL.",
      probes: "Voyager, James Webb and other spacecraft, today.",
      messier: "Nebulae, clusters and galaxies visible with a small telescope.",
      galaxies: "Other galaxies, millions of light-years away.",
      ngc: "Nebulae, clusters and galaxies of the NGC and IC catalogues. They appear as you zoom in.",
      oddities: "The Horsehead, Cassiopeia A, Tycho's and Kepler's supernovae, quasars, lenses and galaxy clusters.",
      specialstars: "Albireo, Mizar, Algol, Mira, Delta Cephei, Eta Carinae… and why each one is special.",
      blackholes: "Confirmed black holes, from Sgr A* to M87*.",
      deepfields: "Where Hubble and Webb stared for days and found thousands of galaxies.",
      pulsars: "Dead stars spinning up to hundreds of times a second.",
      exoplanets: "Planets around other stars (NASA Exoplanet Archive).",
    },
    loadingShort: "loading…", layerErrorLine: "It didn't load.",
    constellation3d: "Constellation in 3D", constellation3dHint: "Pick one to see how far apart its stars really are.",
    labelDensity: "Names on the sky", densFew: "Few", densNormal: "Normal", densMany: "Many",
    scaleNote: "The Sun, the Moon and the planets are drawn larger so you can find them: they are not to scale.",
    // ── mi cielo ──
    welcomeTitle: "Where are you looking at the sky from?", welcomeLead: "To see your real sky — with your mountains, and the Sun, Moon and planets where they are — choose your place: use your location or search for a town. You can change it any time in «Place».", welcomeSkip: "Not now (use Quito)",
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
    pointSky: "Point at the sky", experimental: "experimental", menuOpen: "Menu: sections, music, night vision and language",
    pointLead: "Hold your phone up and the sky turns with you. No camera: it uses your phone's compass and gyroscope.",
    pointPickPlace: "One more step: pick your location below. As soon as you do, the sky will follow your phone.",
    pointActive: "Pointing at the sky", pointExit: "Exit", pointExitAria: "Exit Point at the sky",
    pointStarting: "Waking the sensors…", pointStartingSub: "move your phone a little",
    pointDir: (d) => `Looking ${d}`, pointDirs: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"],
    pointAbove: (a) => `${a}° above the horizon`, pointUnder: (a) => `${a}° below the horizon · under your feet`,
    pointZenith: "Looking at the zenith", pointZenithSub: "straight above your head",
    pointNadir: "Looking at the ground", pointNadirSub: "straight under your feet",
    pointHint: "Doesn't match? In Controls, use Align ◀ ▶ to line it up with a star or planet you recognise. Drag with your finger to look around by hand.",
    pointHintRel: "Your phone isn't reporting where north is. Use Align ◀ ▶ until the sky matches a star or planet you recognise.",
    pointReset: "Reset alignment",
    pointAlign: "Align", pointAlignL: "Turn the sky 2° left", pointAlignR: "Turn the sky 2° right",
    pointManual: "Manual view", pointManualHint: "or raise your phone", pointResume: "Point again",
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
      { title: "Pick your place, or let us guide you", body: "On the right: Time, Place (the sky from where you are), Layers (galaxies, comets, satellites…) and Tour. First time? The tour shows you the sky and the app in a few minutes." },
    ],
    // ── ficha ──
    closeSheet: "Close this card", sheetExpand: "Expand the card", sheetCollapse: "Shrink the card",
    typeSun: "Star · the centre of the solar system", typeMoon: "Earth's natural satellite", typePlanet: "Planet of the solar system",
    typeStar: "Star", typeGalaxy: "Galaxy", typeBlackHole: "Black hole ·", typePulsar: "Pulsar · a spinning neutron star",
    typeMeteor: "Meteor shower", typeDark: "Dark nebula", typeSnr: "Supernova remnant", typeQuasar: "Quasar or active galactic nucleus", typeLens: "Gravitational lens", typeGcluster: "Galaxy cluster", typeDouble: "Double or multiple star", typeVariable: "Variable star", typeNova: "Recurrent nova", typeNearby: "Nearby star", extrasSrc: "Position: SIMBAD (CDS). Distance and figures: published values, rounded.", typeComet: "Comet", typeDwarf: "Dwarf planet", neoPass: (ld, when) => `It passes ${ld} lunar distances from Earth on ${when}.`, neoApprox: "Its position here is approximate: computed from Earth's centre with its orbit; this close it can be off by a degree or more.", fDiameterEst: "Diameter (estimated)", fSpeed: "Speed relative to Earth", typeAsteroid: "Asteroid", typeNea: "Near-Earth asteroid", typeTno: "Trans-Neptunian object", fDiameter: "Diameter", fOrbit: "One orbit", yearsN: (n) => `${n} years`, cometExtra: "Comet of the season: its position is computed from its orbit (JPL), not from Horizons.", minorSrc: "JPL Small-Body Database (orbit); position computed by Teseo", typeProbe: "Spacecraft or space telescope", typeExoplanet: "Exoplanet",
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
    texCredit: { sss: "Texture: Solar System Scope (CC BY 4.0)", svs: "Texture: NASA Scientific Visualization Studio", messenger: "Texture: NASA / JHUAPL / Carnegie (MESSENGER)", usgs: "Texture: USGS / NASA mosaic (public domain)" },
    capMoonPhase: "Lit as it is at the chosen moment. Drag to see its far side.",
    capSunWarn: "Never look at the Sun directly, or through a telescope without a certified solar filter.",
    capWiki: "Image: Wikipedia / Wikimedia Commons", capWikiMixed: "Image from Wikipedia: it may be a real observation or an illustration", capWikiRef: "Reference image: it shows the galaxy or region where the black hole is, not the black hole itself.",
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
    dvAngle: "Ángulo de vista", dvSide: "De costado", dvMain: "Solo principales", dvAll: (n) => `Todas (${n})`, dvReal: "Escala real", dvComp: (k) => `Profundidad ×${k}`,
    dvYou: "Tú (Sol)", dvLy: (d) => `${Math.round(d).toLocaleString("es", { useGrouping: "always" })} años luz`, dvRange: (a, b) => (b == null ? `(más de ${Math.round(a).toLocaleString("es", { useGrouping: "always" })})` : `(${Math.round(a).toLocaleString("es", { useGrouping: "always" })}–${Math.round(b).toLocaleString("es", { useGrouping: "always" })})`), dvTick: (d) => `${d.toLocaleString("es", { useGrouping: "always" })} a. l.`,
    dvScaleNote: { real: "Escala real: fondo y ancho a la misma escala.", comp: (k) => `Profundidad comprimida ×${k} para que se vea la forma; los anchos son reales.` }, dvErr: "En dorado: el rango de la distancia según el error de la paralaje de Hipparcos (1σ).",
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
    stopsAria: "Puntos del sitio donde pararse", stopGo: (n) => `Ir a ${n}`, pano360Aria: "Guardar una foto 360° de este cielo (JPEG)", pano360Title: "Foto 360°", pano360Making: "Tomando la foto 360°… (unos segundos)", pano360Alt: "Vista previa de la foto 360°", pano360Text: "Este cielo en 360°, hecho con Teseo", pano360Hint: "Google Fotos, Facebook y los visores 360° la abren para mirar alrededor.",
    postcardAria: "Guardar una postal de este cielo (PNG)", fullOn: "Pantalla completa", fullOff: "Salir de pantalla completa",
    close: "Cerrar", now: "Ahora", west: "O",
    kinds: { con: "Constelación", star: "Estrella", solar: "Sistema solar" },
    loadingLayer: (n) => `Cargando ${n}…`, failedLayer: (n) => `No se pudo cargar ${n}`,
    depthAria: "Profundidad: de la vista plana a la profundidad real", wholeSky: "Todo el cielo",
    depthTitle: (n) => `${n} en profundidad real`,
    myLocation: "Tu ubicación", changePlace: "Cambiar de lugar", leaveMySky: "Salir de Mi cielo", topoOpen: "Elegir en el mapa topográfico", topoPoint: "Punto del mapa", topoSummit: "Cumbre (mapa)",
    tourFactDist: (d) => `A ${d} de la Tierra`,
    // ── buscador ──
    searchAria: "Buscar en el cielo", searchPlaceholder: "Busca: Saturno, Orión, una galaxia…", searchClear: "Borrar la búsqueda",
    searchTry: "Prueba con alguno", searchResults: "Resultados de la búsqueda", searchEmpty: "No hay nada en el cielo con ese nombre. Prueba con un planeta, una estrella, una constelación o una sonda (Webb, Voyager, Parker…).",
    // ── dock ──
    dockAria: "Herramientas del cielo", layers: "Capas", mySky: "Mi cielo", tour: "Tour",
    // ── capas ──
    layersTitle: "Capas", layersLead: "Suma lo que quieras ver. Cada punto está donde está el objeto real.",
    groups: { near: "Nuestro vecindario", deep: "Cielo profundo", view: "Vista" },
    consLayer: "Constelaciones", consDesc: "Las 88 constelaciones: sus líneas y sus nombres. Líneas: Stellarium (cultura celeste moderna, UAI).",
    solarLayer: "Sol, Luna y planetas",
    layerDesc: {
      solar: "Dónde están ahora mismo, calculado con sus órbitas.",
      meteors: "El punto del que parece venir cada lluvia.",
      comets: "Los famosos (NASA Horizons) y los brillantes del momento. Se mueven con la fecha.",
      minor: "Plutón, Ceres, Vesta, Eris, Apofis y más, y los asteroides que pasan cerca de la Tierra estos días. Fuente: JPL.",
      probes: "Voyager, James Webb y otras naves, hoy.",
      messier: "Nebulosas, cúmulos y galaxias visibles con un telescopio pequeño.",
      galaxies: "Otras galaxias, a millones de años luz.",
      ngc: "Nebulosas, cúmulos y galaxias de los catálogos NGC e IC. Aparecen al acercarte.",
      oddities: "La Cabeza de Caballo, Casiopea A, las supernovas de Tycho y Kepler, cuásares, lentes y cúmulos de galaxias.",
      specialstars: "Albireo, Mizar, Algol, Mira, Delta Cephei, Eta Carinae… y por qué cada una es especial.",
      blackholes: "Agujeros negros confirmados, de Sgr A* a M87*.",
      deepfields: "Donde el Hubble y el Webb miraron durante días y hallaron miles de galaxias.",
      pulsars: "Estrellas muertas que giran hasta cientos de veces por segundo.",
      exoplanets: "Planetas de otras estrellas (NASA Exoplanet Archive).",
    },
    loadingShort: "cargando…", layerErrorLine: "No se cargó.",
    constellation3d: "Constelación en 3D", constellation3dHint: "Elige una para ver lo lejos que están sus estrellas entre sí.",
    labelDensity: "Nombres en el cielo", densFew: "Pocos", densNormal: "Normal", densMany: "Muchos",
    scaleNote: "El Sol, la Luna y los planetas se dibujan agrandados para que puedas encontrarlos: no están a escala.",
    // ── mi cielo ──
    welcomeTitle: "¿Desde dónde miras el cielo?", welcomeLead: "Para ver tu cielo de verdad —con tus montañas, y el Sol, la Luna y los planetas en su sitio— elige tu lugar: usa tu ubicación o busca una ciudad. Puedes cambiarlo cuando quieras en «Lugar».", welcomeSkip: "Ahora no (usar Quito)",
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
    pointSky: "Apuntar al cielo", experimental: "experimental", menuOpen: "Menú: secciones, música, visión nocturna e idioma",
    pointLead: "Levanta el teléfono y el cielo girará contigo. Sin cámara: usa la brújula y el giroscopio de tu teléfono.",
    pointPickPlace: "Falta un paso: elige tu ubicación aquí abajo. En cuanto la tengas, el cielo seguirá a tu teléfono.",
    pointActive: "Apuntando al cielo", pointExit: "Salir", pointExitAria: "Salir de Apuntar al cielo",
    pointStarting: "Activando los sensores…", pointStartingSub: "mueve un poco el teléfono",
    pointDir: (d) => `Mirando al ${d}`, pointDirs: ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"],
    pointAbove: (a) => `${a}° sobre el horizonte`, pointUnder: (a) => `${a}° bajo el horizonte · bajo tus pies`,
    pointZenith: "Mirando al cenit", pointZenithSub: "justo sobre tu cabeza",
    pointNadir: "Mirando al suelo", pointNadirSub: "justo bajo tus pies",
    pointHint: "¿No coincide? En Controles, usa Alinear ◀ ▶ hasta que coincida con una estrella o planeta que reconozcas. Arrastra con el dedo para mirar a mano.",
    pointHintRel: "Tu teléfono no indica dónde está el norte. Usa Alinear ◀ ▶ hasta que el cielo coincida con una estrella o planeta que reconozcas.",
    pointReset: "Reiniciar alineación",
    pointAlign: "Alinear", pointAlignL: "Girar el cielo 2° a la izquierda", pointAlignR: "Girar el cielo 2° a la derecha",
    pointManual: "Vista manual", pointManualHint: "o levanta el teléfono", pointResume: "Volver a apuntar",
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
      { title: "Elige tu lugar o déjate guiar", body: "A la derecha tienes Tiempo, Lugar (el cielo desde donde estás), Capas (galaxias, cometas, satélites…) y Tour. ¿Primera vez? El tour te muestra el cielo y la app en unos minutos." },
    ],
    // ── ficha ──
    closeSheet: "Cerrar la ficha", sheetExpand: "Ampliar la ficha", sheetCollapse: "Reducir la ficha",
    typeSun: "Estrella · el centro del sistema solar", typeMoon: "Satélite natural de la Tierra", typePlanet: "Planeta del sistema solar",
    typeStar: "Estrella", typeGalaxy: "Galaxia", typeBlackHole: "Agujero negro", typePulsar: "Púlsar · una estrella de neutrones que gira",
    typeMeteor: "Lluvia de meteoros", typeDark: "Nebulosa oscura", typeSnr: "Resto de supernova", typeQuasar: "Cuásar o núcleo galáctico activo", typeLens: "Lente gravitacional", typeGcluster: "Cúmulo de galaxias", typeDouble: "Estrella doble o múltiple", typeVariable: "Estrella variable", typeNova: "Nova recurrente", typeNearby: "Estrella vecina", extrasSrc: "Posición: SIMBAD (CDS). Distancia y cifras: valores publicados, redondeados.", typeComet: "Cometa", typeDwarf: "Planeta enano", neoPass: (ld, when) => `Pasa a ${ld} distancias lunares de la Tierra el ${when}.`, neoApprox: "Su posición aquí es aproximada: se calcula desde el centro de la Tierra con su órbita; tan cerca puede desviarse un grado o más.", fDiameterEst: "Diámetro (estimado)", fSpeed: "Velocidad respecto a la Tierra", typeAsteroid: "Asteroide", typeNea: "Asteroide cercano a la Tierra", typeTno: "Objeto transneptuniano", fDiameter: "Diámetro", fOrbit: "Una vuelta al Sol", yearsN: (n) => `${n} años`, cometExtra: "Cometa del momento: su posición se calcula con su órbita (JPL), no viene de Horizons.", minorSrc: "JPL Small-Body Database (órbita); posición calculada por Teseo", typeProbe: "Sonda o telescopio espacial", typeExoplanet: "Exoplaneta",
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
    texCredit: { sss: "Textura: Solar System Scope (CC BY 4.0)", svs: "Textura: NASA Scientific Visualization Studio", messenger: "Textura: NASA / JHUAPL / Carnegie (MESSENGER)", usgs: "Textura: mosaico de USGS / NASA (dominio público)" },
    capMoonPhase: "Iluminada como está en el momento elegido. Arrastra para ver su cara oculta.",
    capSunWarn: "Nunca mires al Sol directamente ni con un telescopio sin filtro solar certificado.",
    capWiki: "Imagen: Wikipedia / Wikimedia Commons", capWikiMixed: "Imagen de Wikipedia: puede ser una observación real o una ilustración", capWikiRef: "Imagen de referencia: muestra la galaxia o la región donde está el agujero negro, no el agujero negro.",
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

export default function Constellations({ lang = "es", onMenu = null }) {
  const t = TC[lang];
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [sky, setSky] = useState(null);
  useKeepAwake(true);   // mirando el cielo, la pantalla del teléfono no se apaga (src/sky/keepAwake.js)
  // el mapa fotográfico se apaga alrededor de las estrellas más brillantes (su halo en las placas no es cielo)
  useEffect(() => { if (sky && sky.stars) setHipsMasks(sky.stars.map((st) => [st[1], st[2], st[3], st[4]])); }, [sky]);
  const [sel, setSel] = useState(null);      // abbr or null
  const [depth, setDepth] = useState(0);     // 0..1
  const [dvReal, setDvReal] = useState(false); // de costado: escala real o profundidad comprimida (autoK de depthView.js)
  const [dvAutoK, setDvAutoK] = useState(7);
  const [dvMain, setDvMain] = useState(true); // de costado, solo las estrellas principales con nombre y línea
  const wrapRef = useRef(null);          // hueco en el flujo de la página; el visor se ensancha desde él
  const labelsApiRef = useRef(null);     // setter de etiquetas (viven en <SkyLabels>)
  const perfApiRef = useRef(null);       // setter del medidor de rendimiento (vive en <PerfMeter>)
  const [ready, setReady] = useState(false);
  const [datasetsRaw, setDatasets] = useState({}); // key -> {objects}
  const [cometOrbits, setCometOrbits] = useState(null);   // public/comet-orbits.json (.comets)
  const [neoRaw, setNeoRaw] = useState(null);             // /api/asteroids: los que pasan cerca de la Tierra estos días, con su órbita
  // capas encendidas al empezar (las demás se encienden en «Capas» o llegan en el enlace)
  const [enabled, setEnabled] = useState(() => Object.fromEntries(DEFAULT_LAYERS.map((k) => [k, true])));   // key -> bool (el mapa fotográfico y NGC/IC, que solo salen al acercarse, vienen encendidos)
  const [selObj, setSelObj] = useState(null);
  const [viewFrom, setViewFrom] = useState(null); // null = Tierra; {name,pos:[x,y,z]} = otra estrella
  const [outside, setOutside] = useState(false);  // vista opcional: la esfera celeste entera, desde fuera
  const [wiki, setWiki] = useState(null);
  const place0 = useMemo(initialPlace, []);
  const [localMode, setLocalMode] = useState(place0.local);
  const [lat, setLat] = useState(place0.lat);
  const [lon, setLon] = useState(place0.lon);
  const [elev, setElev] = useState(place0.elev);   // altitud del lugar (m) o null si no se conoce (GPS sin altitud)
  const [elevPreset, setElevPreset] = useState(place0.preset);   // true: altitud de un atajo; "terrain": del modelo de terreno (cumbres)
  // posición exacta (celda de ≈ 22 m en vez de 220 m) para el horizonte: cumbres y GPS (ver backend/app/horizon.py)
  const [placeFine, setPlaceFine] = useState(!!place0.fine);
  const [placeSummit, setPlaceSummit] = useState(!!place0.summit);   // de pie en una cumbre (/api/summit): suelo opaco
  const placeSeq = useRef(0);   // la última elección de lugar gana (la búsqueda de la cumbre es asíncrona)
  const [placeDefault, setPlaceDefault] = useState(place0.isDefault);   // Quito puesto por Teseo, no elegido
  // primera visita sin lugar elegido: lo primero que se pide es la ubicación (antes que los primeros pasos)
  const [welcomePlace, setWelcomePlace] = useState(() => {
    if (!place0.isDefault || !place0.local || E2E) return false;
    try { return !localStorage.getItem(ASK_PLACE_KEY); } catch { return false; }
  });
  const endWelcome = useCallback(() => { setWelcomePlace(false); try { localStorage.setItem(ASK_PLACE_KEY, "1"); } catch { /* no-op */ } }, []);
  useEffect(() => { if (place0.isDefault && place0.local) track("sky_location", { kind: "default" }); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // atmósfera (solo en Mi cielo) y contaminación lumínica elegida por lugar (localStorage)
  const [atmOn, setAtmOn] = useState(() => { try { return localStorage.getItem(ATM_KEY) !== "0"; } catch { return true; } });
  const [bortleMap, setBortleMap] = useState(loadBortleMap);
  const [cloudsOn, setCloudsOn] = useState(() => { try { return localStorage.getItem(CLOUDS_KEY) === "1"; } catch { return false; } });
  const [auroraOn, setAuroraOn] = useState(() => { try { return localStorage.getItem(AURORA_KEY) !== "0"; } catch { return true; } });
  const [au, setAu] = useState({ key: null, status: "idle", data: null });   // auroras de NOAA (/api/aurora)
  const [auRetry, setAuRetry] = useState(0);
  const [wx, setWx] = useState({ status: "idle", data: null, key: null });   // pronóstico de nubes (Open-Meteo)
  const [wxWanted, setWxWanted] = useState(false);                             // el panel de Nubes y clima se abrió
  const [wxRetry, setWxRetry] = useState(0);
  const [satCl, setSatCl] = useState({ key: null, data: null });             // nubes de ahora vistas por el satélite (/api/clouds-sat)
  const [terrainOn, setTerrainOn] = useState(() => { try { return localStorage.getItem(TERRAIN_KEY) !== "0"; } catch { return true; } });
  const [hz, setHz] = useState({ status: "idle", data: null, key: null });   // horizonte real (/api/horizon)
  const [hzRetry, setHzRetry] = useState(0);
  const satOn = true;   // los colores del satélite van siempre con «Montañas» (sin interruptor propio)
  const [land, setLand] = useState({ key: null, status: null, data: null });
  const [peaksOn, setPeaksOn] = useState(() => { try { return localStorage.getItem(PEAKS_KEY) !== "0"; } catch { return true; } });
  const [andOn, setAndOn] = useState(() => { try { return localStorage.getItem(ANDEAN_KEY) === "1"; } catch { return false; } });
  const [consOn, setConsOn] = useState(() => { try { return localStorage.getItem(CONS_KEY) !== "0"; } catch { return true; } });
  const [pk, setPk] = useState({ status: "idle", data: null, key: null });   // nombres de las cumbres (/api/peaks)
  const [monOn, setMonOn] = useState(() => { try { return localStorage.getItem(MONUMENTS_KEY) !== "0"; } catch { return true; } });
  const [monBase, setMonBase] = useState({ status: "idle", key: null, bases: null, ground: null });
  // Aviso «Es de día»: una vez cerrado no vuelve (ni al mover la hora o el día, ni en otra visita).
  const [dayHidden, setDayHidden] = useState(() => { try { return localStorage.getItem(DAYWARN_KEY) === "1"; } catch { return false; } });
  const hideDayWarn = useCallback(() => { setDayHidden(true); try { localStorage.setItem(DAYWARN_KEY, "1"); } catch { /* no-op */ } }, []);
  const [whenStr, setWhenStr] = useState(nowLocalInput());
  // zona horaria IANA del lugar de Mi cielo (Open-Meteo): el reloj, la barra del día y las horas de salida y
  // puesta van en la hora de ese lugar; null = la del teléfono (sin lugar o sin conexión)
  const [placeTz, setPlaceTz] = useState(null);
  const tzRef = useRef(null);
  useEffect(() => {
    if (!localMode || lat == null || lon == null) { setPlaceTz(null); return undefined; }
    setPlaceTz(cachedTimeZone(lat, lon));
    const ac = new AbortController();
    fetchTimeZone(lat, lon, { signal: ac.signal }).then((tz) => { if (tz) setPlaceTz(tz); }).catch(() => {});
    return () => ac.abort();
  }, [localMode, lat, lon]);
  tzRef.current = placeTz;
  const [playing, setPlaying] = useState(false);
  const [showSolar, setShowSolar] = useState(true);
  // Sol, Luna y planetas para la escena (src/sky/frames.js): ephemeris() da la fecha y el centro de la
  // Tierra; aquí se pasan a J2000, el marco de las estrellas, y en «Mi cielo» se ven desde el observador
  // (paralaje: la Luna hasta ~1°). nx/ny/nz = J2000 (dibujo, toques, encuadre); eqDate = fecha (altura/azimut).
  // los cometas se mueven con la fecha: desde la posición de Horizons (la de hoy) avanzan por su órbita (cometSky.js);
  // se recalculan una vez por hora simulada
  const cometHour = Math.round(new Date(whenStr).getTime() / 3600000);
  const datasets = useMemo(() => {
    let out = datasetsRaw; if (!Number.isFinite(cometHour)) return out;
    const ms = cometHour * 3600000, c = datasetsRaw.comets, mn = datasetsRaw.minor;
    if (c && c.objects && cometOrbits) { const moved = cometsAt(c.objects, cometOrbits, ms); if (moved !== c.objects) out = { ...out, comets: { ...c, objects: moved, count: moved.length } }; }
    // a los cuerpos fijos se suman los asteroides que pasan cerca de la Tierra alrededor de esa fecha (±10 días)
    if (mn && mn.objects) { const objs = minorObjects([...mn.objects, ...neoPassing(neoRaw, ms, mn.objects)], ms); out = { ...out, minor: { ...mn, objects: objs, count: objs.length } }; }
    return out;
  }, [datasetsRaw, cometOrbits, cometHour, neoRaw]);
  useEffect(() => {
    if (!datasetsRaw.minor || neoRaw) return;
    let alive = true;
    fetchJson(`${API}/api/asteroids?days=60&dist_ld=20`, { timeout: TIMEOUT_MS }).then((d) => { if (alive) setNeoRaw((d && d.objects) || []); }).catch(() => { if (alive) setNeoRaw([]); });
    return () => { alive = false; };
  }, [datasetsRaw.minor, neoRaw]);
  const bodiesEph = useMemo(() => withMags(ephemeris(new Date(whenStr))), [whenStr]);
  const topoKey = localMode && lat != null && lon != null ? `${lat}|${lon}|${elev || 0}` : "";
  const bodies = useMemo(() => skyBodies(bodiesEph, new Date(whenStr), topoKey ? { lat, lon, elev: elev || 0 } : null), [bodiesEph, topoKey]);   // eslint-disable-line react-hooks/exhaustive-deps
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
  // líneas guía: todas apagadas por defecto; se recuerdan en localStorage
  const [guidesOn, toggleGuide] = useGuides();
  // colores de las estrellas: realistas (suaves) por defecto; "resaltar" usa el color de cuerpo negro entero
  const [vividStars, setVividStars] = useState(() => { try { return localStorage.getItem(VIVID_KEY) === "1"; } catch { return false; } });
  STAR_MODE.vivid = vividStars;
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [loadingLayer, setLoadingLayer] = useState({});
  const [layerError, setLayerError] = useState({});   // key -> true si falló la carga
  const [skyError, setSkyError] = useState(false);
  const [panel, setPanel] = useState(null);           // null | "layers" | "location" | "time"
  const [geo, setGeo] = useState("idle");             // idle | asking | ok | denied | unavailable | timeout | unsupported
  const [placeKind, setPlaceKind] = useState(place0.kind); // "me" | "custom" | nombre de ciudad
  const [wikiState, setWikiState] = useState("idle"); // idle | loading | done
  const [full, setFull] = useState(false);            // visor a pantalla completa
  const [timeMoved, setTimeMoved] = useState(false);  // false = se muestra "ahora"
  // ── la ISS en el Cielo («Verla en el cielo» desde «Esta noche») ──
  // issSel: { lat, lon, pass, data, status: "loading" | "ok" | "error" } o null. La pasada se dibuja con
  // src/sky/issLayer.js; su hora va al segundo en issClock (whenStr solo tiene minutos): el bucle la avanza
  // a la velocidad elegida mientras se reproduce y escribe whenStr una vez por minuto simulado.
  const [issSel, setIssSel] = useState(null);
  const [issSheet, setIssSheet] = useState(false);
  const [peakSheet, setPeakSheet] = useState(null);
  const [monSheet, setMonSheet] = useState(null);     // la estructura de un sitio cuyo nombre se tocó (MonSheet)
  const [plumeSim, setPlumeSim] = useState(null);     // la simulación de erupción en curso: la cumbre (de peakLabels)   // la montaña del horizonte cuyo nombre se tocó (PeakSheet)
  const [issRate, setIssRate] = useState(ISS_RATE_DEF);
  const issClock = useRef({ t: Date.now(), live: true, playing: false, rate: ISS_RATE_DEF, lastMin: 0, hudSec: null, endMs: null, onMinute: null, onEnd: null });
  const issHudRef = useRef(null);        // setter de la píldora (vive en <IssPill>)
  const issFlyRef = useRef(null);        // culminación hacia la que volar en cuanto «Mi cielo» esté activo
  const issOn = !!(issSel && issSel.status === "ok");
  const [isWide, setIsWide] = useState(() => { try { return window.matchMedia("(min-width: 900px)").matches; } catch { return false; } });
  const isWideRef = useRef(isWide);
  const datasetsRef = useRef(datasets);
  const bodiesRef = useRef(bodies);
  // ── apuntar al cielo (sensores de orientación; solo dentro de Mi cielo) ──
  const [arCapable] = useState(pointingSupported);    // táctil + sensores + HTTPS
  const [ar, setAr] = useState("off");                // off | pending (falta ubicación) | on | paused (manual: se arrastró; sensores escuchando)
  const [arSrc, setArSrc] = useState(null);           // null (esperando datos) | "absolute" | "relative"
  const [arError, setArError] = useState(null);       // null | "denied" | "nosensor"
  const [arAligned, setArAligned] = useState(() => pointAzOffset !== 0);
  const arHudRef = useRef(null);                      // setter del indicador (vive en <PointingBar>)
  const guideApiRef = useRef(null);                   // setter de la flecha guía (vive en <GuideHud>)
  const [guide, setGuide] = useState(null);           // objetivo a encontrar apuntando: { label, body | dir }
  const [arCtl, setArCtl] = useState(false);          // controles temporales mientras se apunta
  const [arHelp, setArHelp] = useState(false);        // ayuda de alineación (solo los primeros segundos)
  const [tsOpen, setTsOpen] = useState(false);         // control de tiempo tipo Stellarium (modo apuntar)
  const [rateIdx, setRateIdx] = useState(REAL);        // velocidad del tiempo (timeDial.RATES)
  const [ctlBump, setCtlBump] = useState(0);          // cada toque en los controles reinicia su temporizador
  const [railOpen, setRailOpen] = useState(false);    // móvil: menú "más" (zoom, centrar, postal, pantalla completa)
  const railRef = useRef(null);
  const stageRef = useRef(null);
  const arOnRef = useRef(false);
  const panelRef = useRef(null);
  const pointRef = useRef(null);
  const compassApiRef = useRef(null);   // la brújula junto al tiempo (MountSheet.jsx): el bucle le pasa el rumbo
  const compassChipRef = useRef(null);
  if (!pointRef.current) {
    let prevSrc = null;
    pointRef.current = createPointing((s) => {
      if (s === "denied" || s === "nosensor") { setAr("off"); setArSrc(null); setArError(s); track("sky_ar", { state: s }); prevSrc = null; return; }
      // de norte relativo (alineado a mano) a norte de brújula: la alineación manual ya no vale (se sumaría al
      // norte verdadero y dejaría el cielo girado)
      if (s === "absolute" && prevSrc === "relative" && pointAzOffset !== 0) { pointAzOffset = 0; setArAligned(false); }
      if (s === "absolute" || s === "relative") prevSrc = s;
      setArSrc(s === "absolute" || s === "relative" ? s : null);
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
  const whenRef = useRef(whenStr);
  useEffect(() => { whenRef.current = whenStr; }, [whenStr]);
  // abreviatura IAU (p.ej. "Sgr") -> nombre de constelación, para que buscar
  // "sagit(tarius)" encuentre objetos cuyo nombre usa la abreviatura ("Sgr A*").
  const abbrevExpand = useMemo(() => {
    const m = {};
    if (sky) for (const c of sky.constellations) m[c.ab.toLowerCase()] = (c.la + " " + c.en).toLowerCase();
    return m;
  }, [sky]);

  // término de categoría detectado (para listar la capa entera)
  const catMatch = useMemo(() => categoryOf(query), [query]);   // src/sky/searchCategory.js

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
    const score = (label, exact) => {
      if (exact) return -1;                         // «C8» o «NGC 104» escritos enteros: ese objeto primero
      // sin acentos («Orión» es Orion) y, si el nombre entero es lo escrito, antes que lo que solo empieza igual (Oriónidas)
      const plain = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), l = plain(label), qq = plain(q);
      if (l === qq || l.split(" · ")[0] === qq) return -0.5;
      return l.startsWith(qq) ? 0 : (" " + l).includes(" " + qq) ? 1 : 2;
    };
    const r = [];
    const kinds = TC[lang].kinds;
    for (const b of bodies) if ((b.name + " " + bodyName(b.name, "en")).toLowerCase().includes(q)) r.push({ type: "solar", body: b, label: bodyName(b.name, lang), kind: kinds.solar });
    // lunas de otros planetas (src/sky/moons.js): «Ío», «Titán», «lunas de Júpiter», «galileanos»
    for (const key of searchMoons(q)) {
      const mo = moonObjFrom(bodies, key, new Date(whenStr)); if (!mo) continue;
      const exact = [MOON_INFO[key].es, MOON_INFO[key].en].some((n) => foldTxt(n) === foldTxt(q));
      r.push({ type: "moon", obj: mo, label: TC[lang].moonResult(moonName(key, lang), bodyName(mo.parent, lang)), kind: TC[lang].kindMoonOther, exact });
    }
    for (const c of sky.constellations) if (foldTxt(c.la + " " + c.en + " " + (c.es || "")).includes(foldTxt(q))) r.push({ type: "con", ab: c.ab, label: `${c.la} · ${c.en}`, kind: kinds.con });
    // nombres en español de estrellas brillantes ("Sirio" → Sirius, "Estrella Polar" → Polaris)
    const esAlias = new Set(Object.entries(STAR_ES).filter(([es]) => es.includes(q)).map(([, en]) => en.toLowerCase()));
    sky.stars.forEach((st, si) => {
      if (!st[7]) return;
      const n = st[7].toLowerCase();
      if (n.includes(q) || esAlias.has(n)) r.push({ type: "star", st, si, label: st[7], kind: kinds.star });
    });
    // capas de objetos: Messier / agujeros negros / meteoros siempre están
    // cargadas; el resto solo si el usuario activó su capa.
    for (const key of ["messier", "caldwell", "blackholes", "deepfields", "meteors", "galaxies", "ngc", "oddities", "specialstars", "pulsars", "comets", "minor", "probes", "exoplanets"]) {
      const ds = datasets[key];
      if (!ds || !ds.objects) continue;
      const layerName = LAYERS.find(l => l.key === key)?.[lang] || key;
      if (key === "caldwell") {
        // «C80», «Caldwell 80», «NGC 5139», nombres en español e inglés, sin acentos (src/sky/caldwell.js). Las
        // galaxias que viven en «Galaxias» se abren allí; si esa capa ya está cargada, solo por su número Caldwell
        const galName = LAYERS.find(l => l.key === "galaxies")?.[lang] || "galaxies";
        for (const o of ds.objects) {
          const m = caldwellMatch(o, q, { extra: conExp("", o.const), otherLoaded: !!(o.in && datasets[o.in]) });
          if (m) r.push({ type: "layer", layer: key, obj: o, label: labelForObj(key, o, lang), kind: o.in ? galName : layerName, exact: m.exact });
        }
        continue;
      }
      for (const o of ds.objects) {
        const hay = (o.name + " " + (key === "ngc" ? o.name.replace(" ", "") + " " : "") + (o.cn || "") + " " + (o.cat || "") + " " + (o.name_en || "") + conExp(o.name, o.const)).toLowerCase();
        // «ngc 206» es NGC 206 antes que NGC 2060: la designación exacta va primero
        if (hay.includes(q)) r.push({ type: "layer", layer: key, obj: o, label: labelForObj(key, o, lang), kind: layerName, exact: o.name.toLowerCase() === q || o.name.replace(" ", "").toLowerCase() === q });
      }
      if (r.length > 60) break;
    }
    r.sort((a, b) => score(a.label, a.exact) - score(b.label, b.exact));
    return r.slice(0, 8);
  }, [query, sky, datasets, bodies, abbrevExpand, catMatch, lang, layerError, whenStr]);
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
    LAYERS.filter(c => !c.api && !c.lazy && !c.virtual).forEach(loadLayer);
  }, [loadSky, loadLayer]);
  // Capas pesadas: bajo demanda. Fichero estático (lazy) o backend (api).
  useEffect(() => {
    LAYERS.filter(c => c.api || c.lazy).forEach((cfg) => {
      if (enabled[cfg.key] && !datasets[cfg.key] && !loadingLayer[cfg.key] && !layerError[cfg.key]) {
        loadLayer(cfg);
      }
    });
  }, [enabled, datasets, loadingLayer, layerError, loadLayer]);
  // sondas y telescopios: se cargan al empezar a buscar (sin encender la capa), para que "Webb" o
  // "Voyager" se encuentren aunque la capa esté apagada; al elegir uno, su capa se enciende
  useEffect(() => {
    if (query.trim().length >= 3 && !datasets.probes && !loadingLayer.probes && !layerError.probes) {
      const cfg = LAYERS.find(l => l.key === "probes"); if (cfg) loadLayer(cfg);
    }
    // Caldwell (Omega Centauri, la Tarántula, las Nubes de Magallanes…): también se encuentra con la capa apagada
    // NGC e IC: al escribir «ngc 55» o «ic 434»
    if (/^(ngc|ic)\s*\d/i.test(query.trim()) && !datasets.ngc && !loadingLayer.ngc && !layerError.ngc) {
      const cfg = LAYERS.find(l => l.key === "ngc"); if (cfg) loadLayer(cfg);
    }
    // las dos listas escogidas (Cabeza de Caballo, Albireo, Algol…): pequeñas, se cargan al empezar a buscar
    for (const k of ["oddities", "specialstars"]) if (query.trim().length >= 3 && !datasets[k] && !loadingLayer[k] && !layerError[k]) { const cfg = LAYERS.find(l => l.key === k); if (cfg) loadLayer(cfg); }
    // planetas enanos y asteroides (Plutón, Ceres, Vesta…): igual
    if (query.trim().length >= 2 && !datasets.minor && !loadingLayer.minor && !layerError.minor) {
      const cfg = LAYERS.find(l => l.key === "minor"); if (cfg) loadLayer(cfg);
    }
    if (query.trim().length >= 2 && !datasets.caldwell && !loadingLayer.caldwell && !layerError.caldwell) {
      const cfg = LAYERS.find(l => l.key === "caldwell"); if (cfg) loadLayer(cfg);
    }
  }, [query, datasets, loadingLayer, layerError, loadLayer]);

  // si se busca una categoría cuya capa aún no está cargada (diferida/backend), se descargan sus datos para
  // listarla en los resultados, SIN encender la capa (no queda puesta ni entra en el enlace L=): se enciende
  // al elegir un resultado, como con las sondas
  useEffect(() => {
    if (catMatch && !datasets[catMatch.key] && !loadingLayer[catMatch.key] && !layerError[catMatch.key]) {
      const cfg = LAYERS.find(l => l.key === catMatch.key); if (cfg && (cfg.api || cfg.lazy)) loadLayer(cfg);
    }
  }, [catMatch, datasets, loadingLayer, layerError, loadLayer]);


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
    if (layer === "moon") {
      const mo = moonObjFrom(bodiesRef.current, name, new Date(whenRef.current || Date.now()));
      if (mo) { setShowSolar(true); setSelObj(mo); }
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
    // sombras: solo las proyecta la luz del Sol de los monumentos (monumentLayer.js); sin monumentos no hay coste
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
        // una estrella apagada por la atmósfera (color 0) no debe dejar huella: sin esto oscurecía el cielo
        "  if (t.a < 0.02 || max(vColor.r, max(vColor.g, vColor.b)) < 0.003) discard;",
        "  gl_FragColor = vec4(vColor, 1.0) * t;",
        "}",
      ].join("\n"),
      // suma su luz al color y deja intacta la transparencia del lienzo (el cielo de la página se ve a través)
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    });
    const points = new THREE.Points(sGeo, sMat);
    scene.add(points);
    // la Vía Láctea (src/sky/milkyWayLayer.js): detrás de las estrellas, en el mismo marco
    const milky = createMilkyWayLayer({ small: Math.min(window.innerWidth || 1000, window.innerHeight || 1000) < 700 || renderer.capabilities.maxTextureSize < 4096,
      onLoad: () => { const r0 = sceneRef.current; if (r0) r0._dirty = true; } });
    milky.setIntensity(1);
    scene.add(milky.mesh);
    // fotos reales de galaxias, nebulosas y cúmulos en su sitio y a su tamaño, y el recuadro de los campos profundos
    const skyImages = createSkyImagesLayer({ onLoad: () => { const r0 = sceneRef.current; if (r0) r0._dirty = true; } });
    scene.add(skyImages.group);
    // el mapa fotográfico de todo el cielo (DSS, en vivo por teselas): aparece al acercarse
    const hips = createHipsLayer({ onLoad: () => { const r0 = sceneRef.current; if (r0) r0._dirty = true; } });
    scene.add(hips.group);
    // y, muy de cerca, el Sloan (más nítido) donde lo cubre
    const hipsFine = createHipsLayer({ ...HIPS_FINE, radius: 895, bias: [0, 0, 0], needAll: true, renderOrder: -4.9, maxTiles: 70, onLoad: () => { const r0 = sceneRef.current; if (r0) r0._dirty = true; } });
    scene.add(hipsFine.group);
    // cometas con coma, cola y órbita (src/sky/cometLayer.js)
    const cometLayer = createCometLayer();
    scene.add(cometLayer.group);

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
    horizonLine.renderOrder = 2.65; horizon.add(horizonLine);   // bajo las montañas del relieve real (2,7)
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
    // montañas del horizonte real (src/sky/terrainLayer.js): en el marco local, sobre el suelo sombreado
    const terrain = createTerrainLayer();
    horizon.add(terrain.group);
    // el relieve cercano en 3D con la imagen de satélite (src/sky/terrain3d.js), delante de las franjas
    const near3d = createNearTerrainLayer({ onReady: () => { const r = sceneRef.current; if (r) { r.terrain.setCovered(near3d.coverKm); r.monuments.setSkirt(!(near3d.coverKm > 0)); r.monuments.setNear(near3d.colorMap); r._dirty = true; } } });
    horizon.add(near3d.group);
    // monumentos (src/sky/monumentLayer.js): en 3D en el mismo marco, delante de las montañas
    const monuments = createMonumentLayer({ onReady: () => { const r = sceneRef.current; if (r) r._dirty = true; } });
    horizon.add(monuments.group);
    // columnas de ceniza ilustrativas sobre los volcanes (src/sky/plumeLayer.js)
    const plume = createPlumeLayer();
    horizon.add(plume.group);
    // «Estacionar montura» (src/sky/mountLinesLayer.js): norte–sur, este–oeste y solsticios pintados en el suelo
    const mountLines = createMountLines();
    horizon.add(mountLines.group);
    // «Constelaciones en profundidad real» (src/sky/depthView.js): escena propia, se dibuja en lugar del cielo
    const depthView = createDepthView();
    horizon.visible = false; scene.add(horizon);
    // líneas guía (src/sky/guidesLayer.js): eclíptica, ecuador, Vía Láctea, cuadrículas… Todas apagadas al
    // empezar; se dibujan antes que estrellas y figuras (renderOrder −1) y el suelo las atenúa bajo el horizonte
    const guides = new GuidesLayer({ radius: FLAT_R, lang: langRef.current });
    scene.add(guides.group);
    // la ISS (src/sky/issLayer.js): una pasada elegida en «Esta noche», en el marco local del horizonte;
    // renderOrder 1: después de estrellas y planetas y antes que el suelo, que la atenúa bajo el horizonte
    const issLayer = new IssLayer({ radius: 880 });
    issLayer.setPixelRatio(basePR);
    scene.add(issLayer.group);
    // domo de atmósfera (src/sky/atmosphereLayer.js): se dibuja primero y debajo de todo
    const atm = createAtmosphereLayer();
    scene.add(atm.mesh);
    // nubes del pronóstico (src/sky/cloudsLayer.js): tapan estrellas, planetas y Sol; solo en Mi cielo
    const clouds = createCloudsLayer();
    scene.add(clouds.mesh);
    // auroras (src/sky/auroraLayer.js): solo donde de verdad las hay (NOAA OVATION, o el óvalo estimado por el Kp)
    const aurora = createAuroraLayer();
    scene.add(aurora.mesh);

    // Sol, Luna y planetas (efemérides reales)
    const solarGroup = new THREE.Group(); scene.add(solarGroup);
    // Cada cuerpo es un disco con su textura real (o la de respaldo si aún no
    // existe el archivo) y un halo de su color. Se dibujan agrandados para que
    // se encuentren: no representan su tamaño aparente real.
    const solarSprites = {}, solarCanvas = {}, solarImg = {}, solarTex = {};
    let sceneDead = false;
    // el Sol real de ese momento (imagen de SDO con sus manchas; src/sky/sunImage.js) o null: la textura genérica
    let sunReal = null;
    const setSunReal = (img) => {
      if (sceneDead || !solarCanvas["Sol"]) return;
      sunReal = img || null;
      drawBodySprite(solarCanvas["Sol"], "Sol", solarImg["Sol"] || null, null, sunReal ? { real: { img: sunReal, ...SDO_DISC } } : null);
      solarTex["Sol"].needsUpdate = true;
      if (!sunReal && solarSprites["Sol"]) solarSprites["Sol"].material.rotation = 0;
      const r0 = sceneRef.current; if (r0) r0._dirty = true;
    };
    BODY_NAMES.forEach(nm => {
      const b = BODIES[nm];
      const c = document.createElement("canvas"); c.width = c.height = b.id === "sun" ? 1024 : b.id === "moon" ? (Math.min(window.innerWidth || 1000, window.innerHeight || 1000) < 700 ? 1024 : 2048) : SPRITE_RES;   // el Sol y la Luna, con detalle para acercarse
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
        { const rs = realSprites[nm]; if (rs && rs.wantB != null) { paintReal(nm, rs.wantB); if (sceneRef.current && sceneRef.current.sizeSolar) sceneRef.current.sizeSolar(); } }
        drawBodySprite(c, nm, img, nm === "Luna" ? (sceneRef.current && sceneRef.current.moonPhase) : null, nm === "Sol" && sunReal ? { real: { img: sunReal, ...SDO_DISC } } : null);
        tex.needsUpdate = true;
      };
      img.onerror = () => { /* textura aún no publicada (p. ej. marte, venus): queda el disco de respaldo */ };
      img.src = textureUrl(b.id);
    });
    // lunas de otros planetas: un punto de luz cada una; solo con mucho zoom (src/sky/moons.js)
    const moonGroup = new THREE.Group(); solarGroup.add(moonGroup); moonGroup.visible = false;
    const dotC = document.createElement("canvas"); dotC.width = dotC.height = 64;
    { const g = dotC.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(250,250,255,0.95)"); gr.addColorStop(0.4, "rgba(220,228,255,0.35)"); gr.addColorStop(1, "rgba(220,228,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
    const dotTex = new THREE.CanvasTexture(dotC);
    const moonSprites = {};
    MOON_KEYS.forEach((key) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthTest: false, sizeAttenuation: false }));
      sp.userData.px = 13; sp.renderOrder = 2; moonGroup.add(sp); moonSprites[key] = sp;
    });
    // los planetas con lunas se dibujan siempre como son: textura, achatamiento, anillos con su inclinación de esa
    // fecha y el eje girado como se ve en el cielo. Con poco zoom van agrandados (son un marcador); al acercarse
    // encogen poco a poco hasta que su tamaño real los alcanza, sin saltos. RS: lado del lienzo.
    const RS = 512;
    const REAL = ["Marte", "Júpiter", "Saturno", "Urano", "Neptuno"];
    const realSprites = {};
    let ringProfile = null;
    { const ri = new Image(); ri.onload = () => { try {
        const c = document.createElement("canvas"); c.width = ri.naturalWidth; c.height = ri.naturalHeight;
        const g = c.getContext("2d"); g.drawImage(ri, 0, 0); ringProfile = g.getImageData(0, Math.floor(c.height / 2), c.width, 1).data;
        const rs = realSprites["Saturno"]; if (rs && rs.wantB != null) paintReal("Saturno", rs.wantB);   // repintar con la textura de los anillos
      } catch { /* sin perfil: anillo liso */ } }; ri.src = RING_URL; }
    REAL.forEach((nm) => {
      const c = document.createElement("canvas"); c.width = c.height = RS;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false }));
      sp.visible = false; sp.renderOrder = 1; solarGroup.add(sp);
      realSprites[nm] = { sp, c, tex, B: null, img: null, Rc: BODIES[nm].ring ? 108 : 150 };
    });
    const paintReal = (nm, B) => {
      const rs = realSprites[nm], im = solarImg[nm]; if (!rs || !im) return;
      if (!rs.img) { try { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext("2d"); g.drawImage(im, 0, 0); rs.img = g.getImageData(0, 0, c.width, c.height); } catch { return; } }
      const x = rs.c.getContext("2d"), Rc = rs.Rc, Bt = B * Math.PI / 180;
      x.clearRect(0, 0, RS, RS); x.save(); x.translate(RS / 2, RS / 2);
      // halo de su color (lo hace localizable; no es parte del planeta)
      { const m = /^#?([0-9a-f]{6})$/i.exec(BODIES[nm].color || ""), n = m ? parseInt(m[1], 16) : 0xdddddd, rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
        const h = x.createRadialGradient(0, 0, Rc * 0.7, 0, 0, RS / 2);
        h.addColorStop(0, `rgba(${rgb},0.3)`); h.addColorStop(0.5, `rgba(${rgb},0.09)`); h.addColorStop(1, `rgba(${rgb},0)`);
        x.fillStyle = h; x.fillRect(-RS / 2, -RS / 2, RS, RS); }
      const ringBand = (front) => {
        if (!BODIES[nm].ring) return;
        const inner = Rc * 1.236, outer = Rc * 2.27, sinB = Math.abs(Math.sin(Bt));
        const near = Bt >= 0 ? [0, Math.PI] : [Math.PI, 2 * Math.PI], [a0, a1] = front ? near : [near[1], near[0] + 2 * Math.PI];
        for (let r = inner; r <= outer; r += 0.7) {
          let col = "226,205,160", al = 0.7;
          if (ringProfile) { const n = ringProfile.length / 4, i = Math.min(n - 1, Math.floor(((r - inner) / (outer - inner)) * n)) * 4; col = `${ringProfile[i]},${ringProfile[i + 1]},${ringProfile[i + 2]}`; al = ringProfile[i + 3] / 255; }
          if (al < 0.03) continue;
          x.beginPath(); x.ellipse(0, 0, r, Math.max(0.3, r * sinB), 0, a0, a1); x.strokeStyle = `rgba(${col},${(al * 0.95).toFixed(3)})`; x.lineWidth = 1; x.stroke();
        }
      };
      ringBand(false);
      const off = document.createElement("canvas"); off.width = off.height = 2 * Rc;
      drawSphere(off.getContext("2d"), rs.img, Rc, Rc, Rc, { lat0: Bt, lon0: 0.6 });
      x.save(); x.scale(1, 1 - (POLAR_FLATTENING[nm] || 0) * Math.cos(Bt) ** 2); x.drawImage(off, -Rc, -Rc); x.restore();
      ringBand(true);
      x.restore(); rs.tex.needsUpdate = true; rs.B = B;
    };
    // cada cuadro: el eje del planeta, girado según hacia dónde queda el norte del cielo en la pantalla
    const vP = new THREE.Vector3(), vQ = new THREE.Vector3();
    const updateRealPlanets = () => {
      // el Sol real: su eje de rotación, como se ve en el cielo (la imagen de SDO trae el norte solar arriba)
      if (sunReal && solarSprites["Sol"]) {
        const sp = solarSprites["Sol"], p = sp.position, n = p.length();
        if (n) {
          const d = [p.x / n, p.y / n, p.z / n], pl = SUN_POLE, dot = pl[0] * d[0] + pl[1] * d[1] + pl[2] * d[2];
          const w = [pl[0] - dot * d[0], pl[1] - dot * d[1], pl[2] - dot * d[2]], wn = Math.hypot(w[0], w[1], w[2]) || 1;
          vP.copy(p).applyMatrix4(solarGroup.matrixWorld).project(camera);
          vQ.set(p.x + w[0] / wn * 0.4, p.y + w[1] / wn * 0.4, p.z + w[2] / wn * 0.4).applyMatrix4(solarGroup.matrixWorld).project(camera);
          sp.material.rotation = Math.atan2(-(vQ.x - vP.x) * (mount.clientWidth || 1), (vQ.y - vP.y) * (mount.clientHeight || 1));
        }
      }
      for (const nm of REAL) {
        const rs = realSprites[nm]; if (!rs.sp.visible || !rs.pole) continue;
        const p = rs.sp.position, n = p.length(); if (!n) continue;
        const d = [p.x / n, p.y / n, p.z / n], pl = rs.pole, dot = pl[0] * d[0] + pl[1] * d[1] + pl[2] * d[2];
        const w = [pl[0] - dot * d[0], pl[1] - dot * d[1], pl[2] - dot * d[2]], wn = Math.hypot(w[0], w[1], w[2]) || 1;
        vP.copy(p).applyMatrix4(solarGroup.matrixWorld).project(camera);
        vQ.set(p.x + w[0] / wn * 0.4, p.y + w[1] / wn * 0.4, p.z + w[2] / wn * 0.4).applyMatrix4(solarGroup.matrixWorld).project(camera);
        const dx = (vQ.x - vP.x) * (mount.clientWidth || 1), dy = (vQ.y - vP.y) * (mount.clientHeight || 1);
        rs.sp.material.rotation = Math.atan2(-dx, dy);
      }
    };
    // con poco zoom los planetas son marcadores de tamaño fijo; cuando su disco real es mayor, se dibujan a su tamaño
    // view: { fov, h } para medir como en otra vista (la foto 360°: siempre el mismo tamaño, no el del zoom de ahora)
    const sizeSolar = (view = null) => {
      const fovNow = view ? view.fov : camera.fov;
      const k = 2 * Math.tan(THREE.MathUtils.degToRad(fovNow / 2)) / ((view ? view.h : mount.clientHeight) || 1);
      const bs = (sceneRef.current && sceneRef.current.bodies) || [];
      for (const nm in solarSprites) {
        const sp = solarSprites[nm], b = BODIES[nm], bb = bs.find((x) => x.name === nm);
        let px = sp.userData.px;
        const km = bb ? (bb.dist_km != null ? bb.dist_km : bb.dist_au != null ? bb.dist_au * 149597870.7 : null) : null;
        if (km && b.diameter_km) {
          const rPx = (b.diameter_km / 2 / km) / k;                       // radio real en px
          px = Math.max(px, rPx * SPRITE_PX / (b.ring ? 21 : b.id === "sun" ? 26 : 28));
        }
        sp.userData.discPx = px * (b.ring ? 21 : b.id === "sun" ? 26 : 28) / SPRITE_PX;
        sp.scale.set(px * k, px * k, 1);
      }
      moonGroup.visible = fovNow < 7;                                      // se separan del planeta a partir de ~10° de campo
      // de 7° a 2° de campo el planeta encoge del tamaño del marcador a algo menos de la mitad; cuando su disco
      // real es mayor que eso, manda el real
      const shrink = fovNow >= 7 ? 1 : fovNow <= 2 ? 0.45 : 0.45 + 0.55 * (fovNow - 2) / 5;
      for (const nm of REAL) {
        const rs = realSprites[nm], bb = bs.find((x) => x.name === nm), mk = solarSprites[nm];
        const have = !!bb && !!bb.dist_au && !!solarImg[nm] && rs.B != null;
        rs.sp.visible = have; if (mk) mk.visible = !have;
        rs.drawnPx = 0; rs.exag = 1;
        if (!have) continue;
        const real = (BODIES[nm].diameter_km / 2 / (bb.dist_au * 149597870.7)) / k;
        const mark = mk ? mk.userData.px * (BODIES[nm].ring ? 21 : 28) / SPRITE_PX : 12;
        const rPx = Math.max(real, mark * shrink);
        const size = (RS * rPx) / rs.Rc;
        rs.sp.scale.set(size * k, size * k, 1);
        rs.drawnPx = rPx; rs.exag = rPx / Math.max(real, 1e-6);
        if (mk) { mk.userData.discPx = rPx * (BODIES[nm].ring ? 2.27 : 1); rs.sp.material.opacity = mk.material.opacity; }
      }
      for (const key in moonSprites) {
        const ms = moonSprites[key], v = ms.userData.px * k; ms.scale.set(v, v, 1);
        // mientras el planeta va agrandado, una luna que caería dentro de su dibujo no se muestra
        const o = moonOrbit(key), rs = o ? realSprites[o.parent] : null;
        let hide = false;
        if (rs && rs.sp.visible && rs.exag > 1.25) { const sep = ms.position.distanceTo(rs.sp.position) / 860 / k; hide = sep < rs.drawnPx * (BODIES[o.parent].ring ? 2.4 : 1.25); }
        ms.visible = !hide;
      }
    };
    sizeSolar();
    // modo apuntar: el zoom es el campo de visión. `span` = grados que abarca el lado largo.
    const applyArFov = () => {
      const st = sceneRef.current && sceneRef.current.ar; if (!st) return;
      camera.fov = spanToFov(st.span, camera.aspect);
      camera.updateProjectionMatrix();
      guides.setFov(camera.fov);
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
      guides.setFov(camera.fov);              // densidad de las cuadrículas según el zoom (solo cambia al cruzar un umbral)
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
      atm, clouds, aurora, terrain, monuments, plume, mountLines, depthView, milky, skyImages, hips, hipsFine, hipsOn: true, ngcOn: true, cometLayer, atmAlpha, starVis, atmOn: false, visOn: false, lineBase: 0.55, groundMat, groundMesh: ground, horizonLine, near3d,
      markerTex: starTex, layerObjs: [], namedStars, conCentroid, horizon, localQuat: new THREE.Quaternion(), localModeOn: false, earth, solarGroup, solarSprites, moonGroup, moonSprites, moonSky: [], realSprites, paintReal, updateRealPlanets, bodies: [], showSolar: true,
      sunSprite, applyViewpoint, redrawMoon, setSunReal, sunSlot: undefined, moonPhase: null, cardinals, guides, issLayer, issFmt: null, lang: langRef.current, sizeSolar, applyArFov, applyFov, ground,
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
        const q = r.localQuat, occ = st ? r.cloudOcc : null;   // nubes (makeOccluder) o null
        const hzd = r.hzData, behind = (d) => !!hzd && behindTerrain(hzd, d);   // detrás de las montañas
        const dirOf = (nx, ny, nz) => { qv.set(nx, ny, nz).applyQuaternion(q); dv[0] = qv.x; dv[1] = qv.y; dv[2] = qv.z; return dv; };
        let nStars = 0;
        if (!st) {
          atmAlpha.fill(1); atmRed.fill(0); starVis.fill(1);
          if (hzd) { const stars = sky.stars; for (let i = 0; i < stars.length; i++) { const s = stars[i]; if (behind(dirOf(s[1], s[2], s[3]))) starVis[i] = 0; } }
        } else {
          const stars = sky.stars;
          for (let i = 0; i < stars.length; i++) {
            const s = stars[i], d = dirOf(s[1], s[2], s[3]);
            // bajo el horizonte manda el suelo sombreado (deja ver y tocar lo que hay debajo), no la atmósfera
            // (desde un alto el cielo baja hasta las montañas: entre 0° y ese filo sigue siendo cielo, con su luz)
            const dipR = ((sceneRef.current && sceneRef.current.skyDip) || 0) * Math.PI / 180;
            if (d[1] <= 0 && !(dipR < 0 && d[1] > Math.sin(dipR))) { atmAlpha[i] = 1; atmRed[i] = 0; starVis[i] = 1; continue; }
            let dv2 = d;
            if (d[1] <= 0) { const hl = Math.hypot(d[0], d[2]) || 1; dv2 = [d[0] / hl * 0.99995, 0.01, d[2] / hl * 0.99995]; }
            const v = visibility({ mag: s[4], dir: dv2 }, st);
            if (v.visible && occ && occ(d) > OCC_HIDE) v.visible = false;   // detrás de una nube: sin nombre ni recuento
            if (v.visible && behind(d)) v.visible = false;                  // detrás de una montaña
            atmAlpha[i] = v.alpha; atmRed[i] = v.visible ? Math.min(1, v.reddening / 1.2) : 0; starVis[i] = v.visible ? 1 : 0;
            if (v.visible) nStars++;
          }
        }
        paintStars();
        r.atmOn = !!st;
        r.visOn = !!st || !!hzd;         // hay listas de «qué se ve» (atmósfera, nubes o montañas)
        atm.update(st);
        atm.setEnabled(!!st);
        milky.setIntensity(milkyWayVisibility(st));
        // a simple vista siguen el brillo del cielo, con una caída más suave que la Vía Láctea (sus núcleos son más
        // brillantes); `darkness`: de noche 1, con el Sol a menos de 6° bajo el horizonte 0
        { const dk = st ? 1 - Math.min(1, Math.max(0, (st.sunAlt + 14) / 8)) : 1; skyImages.setIntensity(st ? Math.min(1, Math.max(Math.sqrt(milkyWayVisibility(st)) * 1.2, dk * 0.4)) : 1, dk); hips.setDarkness(dk); hipsFine.setDarkness(dk); }
        { const up = st && r.localModeOn ? new THREE.Vector3(0, 1, 0).applyQuaternion(r.localQuat.clone().invert()) : null; milky.setExtinction(st ? st.k : 0, up ? [up.x, up.y, up.z] : null); }
        lines.material.opacity = st && starsHidden(st) ? 0.22 : r.lineBase;
        // Sol, Luna y planetas: el disco se sigue dibujando (con tamaño visible), más tenue si no se ve
        r.solarVis = {};
        for (const b of (r.bodies || [])) {
          const sp = r.solarSprites[b.name]; if (!sp) continue;
          let vis = true, alpha = 1;
          if (st && b.name !== "Sol" && b.mag != null) {
            const v = visibility({ mag: b.mag, dir: dirOf(b.nx, b.ny, b.nz) }, st);
            if (v.visible && occ && occ(dv) > OCC_HIDE) v.visible = false;
            vis = v.visible || dv[1] <= 0;            // bajo el horizonte lo decide el suelo, no la atmósfera
            alpha = dv[1] <= 0 ? 1 : v.visible ? Math.max(0.6, v.alpha) : 0.3;
          }
          if (vis && hzd && behind(dirOf(b.nx, b.ny, b.nz))) vis = false;
          sp.material.opacity = alpha; r.solarVis[b.name] = vis;
        }
        // las lunas de otros planetas siguen a su planeta: con su misma opacidad (tenues si él lo está, p. ej. de día)
        for (const m of (r.moonSky || [])) {
          const ms = r.moonSprites && r.moonSprites[m.key], o = moonOrbit(m.key); if (!ms || !o) continue;
          const ps = r.solarSprites[o.parent];
          ms.material.opacity = ps ? ps.material.opacity : 1;
        }
        // cielo profundo con magnitud (Messier, galaxias): se ocultan los que no se verían
        let nDeep = 0, nDeepTot = 0;
        for (const o of (r.layerObjs || [])) {
          const ud = o.points.userData; if (!ud.baseCol) continue;
          const col = o.points.geometry.attributes.color, arr = col.array;
          for (let i = 0; i < ud.objs.length; i++) {
            const ob = ud.objs[i];
            let a = 1;
            const d = st || hzd ? dirOf(ob.nx, ob.ny, ob.nz) : null;
            if (st && d[1] > 0) {
              // NGC/IC solo se dibuja al acercarse (vista «de telescopio»): no se oculta por brillo, solo por nubes u horizonte
              const v = ud.layer === "ngc" ? { visible: true, alpha: 0.8 } : visibility({ mag: (ob.mag ?? 99) + extPenalty(ud.layer, ob), dir: d }, st);
              if (v.visible && occ && occ(d) > OCC_HIDE) v.visible = false;
              a = v.visible ? Math.max(0.55, v.alpha) : 0;
              ud.vis[i] = v.visible ? 1 : 0;
              // «de telescopio» (al acercarse): no cuenta si se ve a simple vista, solo si lo tapa una nube
              ud.tele[i] = occ && occ(d) > OCC_HIDE ? 0 : 1;
              if (o.points.visible && ud.layer === "messier") { nDeepTot++; if (v.visible) nDeep++; }
            } else { ud.vis[i] = 1; ud.tele[i] = 1; }   // sin atmósfera o bajo el horizonte (lo cubre el suelo)
            if (hzd && behind(d)) { ud.vis[i] = 0; ud.tele[i] = 0; }
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
        vis: (name, on) => { const o = name === "near" ? r.near3d.group : name === "bands" ? r.terrain.group : name === "clouds" ? r.clouds : name === "mon" ? r.monuments.group : null; if (o) { (o.group || o).visible = !!on; r.wake(); } },
        near3dGeo: () => { const m = r.near3d.group.children[0]; if (!m) return null; const P = m.geometry.attributes.position.array, H = m.geometry.attributes.aHD.array, out = []; for (const k of [399 * 160 + 40, 400 * 160 + 80, 400 * 160 + 120, 400 * 160 + 159, 159]) out.push([P[k * 3], P[k * 3 + 1], P[k * 3 + 2], H[k * 2], H[k * 2 + 1]].map((x) => Math.round(x * 10) / 10)); return out; },
        near3d: (k, v) => { const m = r.near3d.group.children[0]; if (!m) return null; const u = m.material.uniforms, o = {}; if (k) { u[k].value = v; r.wake(); } for (const k in u) if (typeof u[k].value === "number") o[k] = u[k].value; return o; },
        tex: (on) => { for (const m of r.terrain.group.children) if (m.material && m.material.userData && m.material.userData.tex) m.material.userData.tex.value = on ? 1 : 0; r.near3d.setEnabled(!!on); r.terrain.setCovered(r.near3d.coverKm); r.monuments.setSkirt(!(r.near3d.coverKm > 0)); r.wake(); },
        aurora: (k, v) => (r.aurora ? (k && (r.aurora.uniforms[k].value = v, r.wake()), { visible: r.aurora.visible, vis: r.aurora.uniforms.uVis.value, act: r.aurora.uniforms.uAct.value, hemi: r.aurora.uniforms.uHemi.value, gain: r.aurora.uniforms.uGain.value }) : null),
        hips: () => (r.hips ? { ...r.hips.stats, active: r.hips.active, fine: r.hipsFine ? { ...r.hipsFine.stats, level: r.hipsFine.level } : null } : null),
        // estado de cada capa (pruebas): puntos a la vista por capa, mapa fotográfico, cometas dibujados
        layers: () => { const o = {}; for (const l of (r.layerObjs || [])) { o[l.key] = o[l.key] || { n: 0, visible: false }; o[l.key].n += l.points.userData.objs.length; o[l.key].visible = o[l.key].visible || l.points.visible; } return { pts: o, photo: !!r.hipsOn, img: r.skyImages ? r.skyImages.state : null, cometItems: r.cometLayer ? r.cometLayer.group.children.length : 0, fov: r.camera.fov }; },
        // foto 360° (pruebas): brillo medio de la franja baja de cada cara, ocultando objetos por nombre de clave
        panoFaces: (hide = []) => {
          const objs = { ground: r.ground, atm: r.atm && r.atm.mesh, clouds: r.clouds && r.clouds.mesh, terrain: r.terrain && r.terrain.group, points: r.points, lines: r.lines, horizon: r.horizon };
          const prev = {}; for (const k of hide) if (objs[k]) { prev[k] = objs[k].visible; objs[k].visible = false; }
          r.horizon.position.set(0.003, 0, 0.003);
          const faces = captureFaces({ THREE, renderer, scene: r.scene, near: camera.near, far: camera.far, size: 128 });
          r.horizon.position.set(0, 0, 0);
          for (const k in prev) objs[k].visible = prev[k];
          const band = (f, y0, y1) => { let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < f.width; x++) { const o = (y * f.width + x) * 4; s += f.data[o] + f.data[o + 1] + f.data[o + 2]; n++; } return Math.round(s / n / 3); };
          return faces.map((f, i) => [["e","w","zen","nad","s","n"][i], band(f, 120, 128), band(f, 0, 8), band(f, 60, 68)]);
        },
        cam: () => ({ fov: camera.fov, aspect: camera.aspect, q: camera.quaternion.toArray(), p: camera.position.toArray(), mode: r.mode, ar: r.ar.on, local: r.localModeOn, localQuat: r.localQuat.toArray(), span: lk.span, w: mount.clientWidth, h: mount.clientHeight, vx: r.viewShift.cx, vy: r.viewShift.cy, flying: !!lk.fly, pm: camera.projectionMatrix.toArray(), mwi: camera.matrixWorldInverse.toArray() }),
        bodies: () => (r.showSolar ? r.bodies : []).map((b) => ({ name: b.name, nx: b.nx, ny: b.ny, nz: b.nz, mag: b.mag })),
        atm: () => ({ on: r.atmOn, dome: r.atm.visible, counts: r.atmCounts || null, solarVis: r.solarVis || null }),
        clouds: () => ({ on: r.clouds.visible, c: r.clouds.clouds }),
        // horizonte en uso (con monumentos si los hay): el perfil cada 5° y los nombres de la vista
        hz: () => (r.hzData ? { monuments: !!r.hzData.monuments, alt5: r.hzData.alt.filter((_, i) => i % Math.round(5 / (r.hzData.step_deg || 0.2)) === 0), labels: (r._labels || []).map((l) => [l.cls, l.name, Math.round(l.x), Math.round(l.y)]) } : null),
        // la ISS: lo dibujado (vértices de la capa) frente a la respuesta del servidor, y dónde cae en pantalla
        iss: () => {
          const il = r.issLayer, ck = issClock.current;
          if (!il || !il.pass) return { active: false, t: ck.t, live: ck.live };
          const p = il.pass, w = il.dotWorld(new THREE.Vector3());
          camera.updateMatrixWorld();
          const scr = (v) => { const s = v && screenOf(camera, v, mount.clientWidth, mount.clientHeight, "in"); return s ? { x: s.x, y: s.y } : null; };
          const lm = altAzToLocal(p.max.alt, p.max.az), chk = il.drawnCheck(p.max.alt, p.max.az);
          return { active: il.active, t: ck.t, live: ck.live, playing: ck.playing, rate: ck.rate, start: p.start.t, end: p.end.t, max: p.max, visible: p.visible, why: p.why_not_visible, nTrack: p.track.length,
            pos: il.pos && { alt: il.pos.alt, az: il.pos.az, lit: il.pos.lit, visible: il.pos.visible, state: il.pos.state }, dot: scr(w),
            maxScreen: scr(new THREE.Vector3(lm[0], lm[1], lm[2]).multiplyScalar(880)), peakAlt: chk && chk.peakAlt, distToMax: chk && chk.distDeg,
            labels: (r._labels || []).filter((l) => l.cls === "iss" || l.cls === "iss_t").map((l) => ({ name: l.name, cls: l.cls, x: l.x, y: l.y })) };
        },
        // mirar a una altura/azimut del lugar (pruebas y capturas; solo en «Mi cielo»)
        lookAltAz: (alt, az, span) => { const v = altAzToLocal(alt, az); r.lookAt(new THREE.Vector3(v[0], v[1], v[2]), span, true); r.wake(); },
        // monumentos (pruebas): cuántos hay, si hay relieve cercano y el rango de alturas de cada malla
        monItems: () => r.monuments.items.map((it) => ({ id: it.m.id, d: +it.o.d.toFixed(1), dz: +it.dz.toFixed(2) })).slice(0, 40), up: () => r.monuments.items.up || 0,
        mon: () => ({ grid: r.monuments.grid ? { reach: r.monuments.grid.reach, h: r.monuments.grid.h.slice(0, 24).map((v) => +v.toFixed(1)) } : null, n: r.monuments.items.length, loading: r.monuments.loading, vis: r.monuments.group.visible, meshes: r.monuments.group.children.filter((c) => c.isMesh).map((c) => { c.geometry.computeBoundingBox(); const b = c.geometry.boundingBox; return [c.renderOrder, c.geometry.attributes.position.count, +b.min.y.toFixed(1), +b.max.y.toFixed(1), Number.isFinite(b.min.y)]; }) }),
        // mirar a una dirección ecuatorial (la de un cuerpo de bodies()), con el campo `span`
        lookEq: (nx, ny, nz, span) => { r.lookAt(new THREE.Vector3(nx, ny, nz).normalize().applyQuaternion(r.localQuat), span, true); r.wake(); },
        // mueve el reloj de la ISS (pruebas): al segundo, y whenStr con él
        issSeek: (ms) => { const ck = issClock.current; ck.t = ms; ck.live = false; ck.lastMin = Math.floor(ms / 60000); if (ck.onMinute) ck.onMinute(ms); r.wake(); },
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
    const tmp = new THREE.Vector3(), tmpB = new THREE.Vector3(), flyV = new THREE.Vector3(), flyQ = new THREE.Quaternion(), flyYP = {};
    const cullQ = new THREE.Quaternion(), cullF = new THREE.Vector3(), cullP = new THREE.Vector3();
    const cmpV = new THREE.Vector3(); let cmpN = 0;
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
          if (arHudRef.current) arHudRef.current(ar.look.az, ar.look.alt, pointRef.current && pointRef.current.pose ? pointRef.current.pose.acc : null);
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
      // la brújula junto al tiempo: hacia dónde se mira (acimut desde el norte verdadero; en «Apuntar al cielo», el del
      // celular, ya corregido por la declinación magnética). Cada 4 cuadros; la brújula solo toca el DOM si cambia
      if (compassApiRef.current && ref.localModeOn && ref.mode === "in" && (cmpN++ & 3) === 0) {
        ref.fwd(cmpV);
        const h = Math.hypot(cmpV.x, cmpV.z);
        if (h > 0.05) compassApiRef.current(((Math.atan2(cmpV.x, -cmpV.z) * 180) / Math.PI + 360) % 360,
          { ar: ar.on, acc: pointRef.current && pointRef.current.pose ? pointRef.current.pose.acc : null });
      }
      if (ref.mountLines && ref.mountLines.group.visible) ref.mountLines.setFov(ref.camera.fov);
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
      // ── la ISS: su reloj al segundo (avanza a ×1/×10/×60 al reproducir; en «ahora», el del sistema) ──
      let issMoved = false;
      const il = ref.issLayer;
      if (il && il.active) {
        const ck = issClock.current, st = stepIssClock(ck, dtFrame);   // (dt recortado: tras una pausa no da saltos)
        if (st.minute && ck.onMinute) ck.onMinute(ck.t);                // whenStr, una vez por minuto simulado
        if (st.ended && ck.onEnd) ck.onEnd();                           // se para al acabar la pasada
        issMoved = il.update(ck.t);
        const sec = Math.floor(ck.t / 1000);
        if (issHudRef.current && (sec !== ck.hudSec || issMoved)) { ck.hudSec = sec; issHudRef.current(ck.t, il.pos); }
      }
      // ¿cambió algo desde el último cuadro dibujado?
      const cp = ref.camera.position, cq = ref.camera.quaternion, us = ref.points.material.uniforms.uScale.value;
      // (con tolerancia: el amortiguado de OrbitControls sigue moviendo la cámara millonésimas durante segundos;
      // se compara con el último cuadro DIBUJADO, así que una deriva lenta acaba dibujándose igual)
      const far = (a, b, e) => !(Math.abs(a - b) <= e);
      // columnas de ceniza: se mueven solas (mientras haya alguna, se dibuja cada cuadro)
      const plumeOn = !!(ref.plume && ref.plume.group.parent && ref.plume.group.parent.visible && ref.plume.update(tStart));
      // auroras: se mueven solas (mientras se vea alguna, se dibuja cada cuadro)
      const auroraOn = !!(ref.aurora && ref.aurora.tick(tStart));
      const moved = rebuild || ar.on || issMoved || plumeOn || auroraOn || !!ref.look.fly || tStart < wakeUntil || far(cp.x, lastCam.px, 0.01) || far(cp.y, lastCam.py, 0.01) || far(cp.z, lastCam.pz, 0.01)
        || far(cq.x, lastCam.qx, 1e-6) || far(cq.y, lastCam.qy, 1e-6) || far(cq.z, lastCam.qz, 1e-6) || far(cq.w, lastCam.qw, 1e-6) || ref.camera.fov !== lastCam.fov || far(vs.cx, lastCam.vx, 0.25) || far(vs.cy, lastCam.vy, 0.25) || us !== lastCam.us;
      // resolución adaptativa: al moverse puede bajar; quieto más de 0,6 s, se dibuja a la resolución completa
      // (si no, la imagen quieta quedaría en escalones) y al volver a moverse se recupera la adaptativa
      const setPR = (pr) => { ref.renderer.setPixelRatio(pr); ref.points.material.uniforms.uPx.value = pr / basePR; ref.issLayer.setPixelRatio(pr); };
      let sharpen = false;
      if (moved) { ref._lastMove = tStart; if (ref._sharp) { ref._sharp = false; setPR(adaptive.ratio); } }
      else if (!ref._sharp && adaptive.ratio < basePR - 1e-3 && tStart - (ref._lastMove || 0) > 600) { ref._sharp = true; setPR(basePR); sharpen = true; }
      const draw = moved || sharpen || (++idleN % IDLE_EVERY === 0);
      if (moved) idleN = 0;
      if (draw) {
        lastCam.px = cp.x; lastCam.py = cp.y; lastCam.pz = cp.z; lastCam.qx = cq.x; lastCam.qy = cq.y; lastCam.qz = cq.z; lastCam.qw = cq.w; lastCam.fov = ref.camera.fov; lastCam.vx = vs.cx; lastCam.vy = vs.cy; lastCam.us = us;
        if (ref.atm.visible) ref.atm.follow(ref.camera);
        if (ref.clouds.visible) ref.clouds.follow(ref.camera);
        if (ref.aurora && ref.aurora.visible) ref.aurora.follow(ref.camera);
        if (ref.updateRealPlanets) ref.updateRealPlanets();      // el eje de cada planeta, como se ve en el cielo (a cualquier zoom)
        ref.renderer.render(ref.depthView && ref.depthView.active && ref.mode === "depth" ? ref.depthView.scene : ref.scene, ref.camera);
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
          if (nr != null && !ref._sharp) { ref.renderer.setPixelRatio(nr); ref.points.material.uniforms.uPx.value = nr / basePR; ref.issLayer.setPixelRatio(nr); wakeEv(); }
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
      // (si en un cuadro con movimiento no tocaba recalcularlos, quedan «atrasados» y se recalculan en el primer
      // cuadro siguiente, haya o no dibujo: si no, tras un salto de la vista los nombres se quedaban donde estaban
      // antes del salto hasta el siguiente cálculo, que en un aparato lento podía tardar segundos)
      const lblTurn = draw && (ref._lf < 4 || ref._lf % 5 === 0);
      if (moved && !lblTurn) ref._lblStale = true;
      if (lblTurn || ref._lblStale) {
        ref._lblStale = false;
        const W = mount.clientWidth, H = mount.clientHeight;
        // desde dentro (también apuntando) la cámara está en el centro: el detalle lo decide el campo de visión
        const inside = ar.on || ref.mode === "in", outside = !ar.on && ref.mode === "out";
        if (ref.milky) ref.milky.setOn(inside);        // solo desde dentro de la esfera del cielo
        // el mapa fotográfico primero: donde ya se ve, los recortes de los cartografiados se retiran (no suman su luz)
        { const show = !!ref.ngcOn && ref.camera.fov < NGC_FOV; for (const o of (ref.layerObjs || [])) if (o.key === "ngc" && o.points.visible !== show) { o.points.visible = show; ref._dirty = true; } }
        if (ref.hipsFine) { ref.hipsFine.setOn(inside && ref.hipsOn); ref.hipsFine.setDim(ref.skyImages ? ref.skyImages.cover : 0); if (ref.hipsFine.update(ref.camera, H)) ref._dirty = true; }
        if (ref.hips) { ref.hips.setOn(inside && ref.hipsOn); ref.hips.setDim(ref.skyImages ? ref.skyImages.cover : 0); ref.hips.setUnder(ref.hipsFine ? ref.hipsFine.level : 0); if (ref.hips.update(ref.camera, H)) ref._dirty = true; }
        // de cerca, la imagen de la Vía Láctea (poco detalle) deja paso a las placas
        if (ref.milky && ref.milky.setUnder(ref.hips ? ref.hips.active : 0)) ref._dirty = true;
        if (ref.skyImages) { ref.skyImages.setOn(inside); ref.skyImages.setUnder(ref.hips ? ref.hips.active : 0); if (ref.skyImages.update(ref.camera, H)) ref._dirty = true; }
        const camDist = inside ? 0 : ref.camera.position.length();
        const camPos = ref.camera.position;
        const out = [];
        // zonas tapadas por la ficha o un panel: ahí no se dibujan nombres (ni a medias)
        if (ref._occN++ % 6 === 0) {
          const stEl = mount.parentElement, sr = stEl.getBoundingClientRect();
          ref.occl = [...stEl.querySelectorAll(".sk-sheet, .sk-panel, .sk-search-field, .sk-menu-btn, .sk-rail button, .sk-dock, .sk-stop, .sk-cta-btn, .sk-arpill, .sk-artray, .sk-arrail, .sk-ts, .sk-guide-msg, .sk-depth, .sk-tour, .sk-onboard, .sk-chip")].map(el => { const r = el.getBoundingClientRect(); return [r.left - sr.left - 8, r.top - sr.top - 6, r.right - sr.left + 8, r.bottom - sr.top]; });
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
        ref.camera.updateMatrixWorld();   // la cámara al día antes de proyectar los nombres
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
        // ¿un punto de la pantalla cae detrás del horizonte real (montañas y monumentos)? (marco del mundo = local)
        const behindAt = (x, y) => {
          tmpB.set((x / W) * 2 - 1, -((y / H) * 2 - 1), 0.5).unproject(ref.camera).sub(ref.camera.position).normalize();
          return behindTerrain(ref.hzData, [tmpB.x, tmpB.y, tmpB.z], 0);
        };
        // con monumentos hay un suelo de verdad (hierba, arena…): lo que queda bajo el horizonte no se nombra
        const siteHides = (dx, dy, dz) => {
          const hzd = ref.hzData; if (!hzd || !hzd.alt || !hzd.alt.length) return false;
          const n = hzd.alt.length, step = hzd.step_deg || 360 / n, altD = Math.asin(Math.max(-1, Math.min(1, dy))) * 180 / Math.PI;
          const azD = ((Math.atan2(dx, -dz) * 180 / Math.PI) % 360 + 360) % 360;
          return altD < hzd.alt[Math.round(azD / step) % n];
        };
        const underGround = (x, y) => {
          if (!inside || !ref.localModeOn || !(ref.monGround || ref.hzData)) return false;
          tmpB.set((x / W) * 2 - 1, -((y / H) * 2 - 1), 0.5).unproject(ref.camera).sub(ref.camera.position).normalize();
          if (ref.monGround && tmpB.y < -0.008) return true;
          // en un sitio con suelo propio (un sitio arqueológico), nada de nombres detrás del terreno, los andenes o los
          // muros: ni lo que está a punto de salir (el horizonte efectivo ya incluye el suelo y los monumentos)
          // (comparación con signo: también lo que queda entre el horizonte matemático y el suelo, justo por debajo de 0°)
          if (ref.monGround && siteHides(tmpB.x, tmpB.y, tmpB.z)) return true;
          // con las montañas a la vista: nada de nombres del otro lado del globo, salvo lo que está a punto de salir
          // (hasta 3° bajo el filo del relieve en esa dirección)
          const hzd = ref.hzData;
          if (!hzd || !hzd.alt || !hzd.alt.length) return false;
          const altD = Math.asin(Math.max(-1, Math.min(1, tmpB.y))) * 180 / Math.PI, n = hzd.alt.length, step = hzd.step_deg || 360 / n;
          const azD = ((Math.atan2(tmpB.x, -tmpB.z) * 180 / Math.PI) % 360 + 360) % 360;
          return altD < Math.min(0, hzd.alt[Math.round(azD / step) % n]) - 3;
        };
        const place = (sx, sy, name, cls, sub, dx, extra) => {
          let flip = false;
          if (underGround(sx, sy)) return;
          if (cls === "note") {
            const w = name.length * 7.2 + 52;
            if (!free(sx - w / 2, sy - 58, sx + w / 2, sy + 4) || !clear(sx - w / 2, sy - 54, sx + w / 2, sy - 8)) return;
            boxes.push(sx - w / 2, sy - 54, sx + w / 2, sy - 8);
          } else {
            const w = String(name).length * (cls === "con" ? CH * 1.6 : cls === "solar" ? CH * 1.15 : CH) + (dx || 8) + 4;
            const h = sub == null && !(extra && extra.subText) ? 9 : 24;
            // junto a un borde o a la ficha, el nombre pasa al otro lado del punto; si tampoco cabe, no se dibuja
            if (extra && extra.left && free(sx - w, sy - 10, sx, sy + h)) flip = true;   // «Tú (Sol)»: a la izquierda, lejos de las líneas
            else if (!free(sx, sy - 10, sx + w, sy + h)) { if (!free(sx - w, sy - 10, sx, sy + h)) return; flip = true; }
            const x0 = flip ? sx - w : sx;
            if (!clear(x0, sy - 9, x0 + w, sy + h)) return;
            // el nombre de una constelación es ancho: si su texto se metería en una montaña o un monumento, no va
            if (cls === "con" && inside && ref.localModeOn && ref.hzData && (behindAt(x0 + w * 0.5, sy) || behindAt(x0 + w - 4, sy) || behindAt(x0 + 4, sy))) return;
            boxes.push(x0, sy - 9, x0 + w, sy + h);
          }
          out.push({ key: cls + ":" + name, name, cls, sub: sub == null ? null : sub, x: sx, y: sy, dx, flip, ...extra });
        };
        const hzV = new THREE.Vector3();
        const push = (x, y, z, name, cls, sub, dx, extra) => { if (proj(x, y, z, cls)) place(psx, psy, name, cls, sub, dx, extra); };
        // profundidad real: solo los nombres de la escena propia (estrellas con su distancia, el Sol, el eje)
        const dvOn = !!(ref.depthView && ref.depthView.active && ref.mode === "depth");
        if (dvOn) for (const l of ref.depthView.labels(ref.camera, W, H, ref.dvText || {})) place(l.x, l.y, l.name, l.cls, null, l.cls === "dvtick" ? 0 : 9, { key: l.key, ...(l.left ? { left: true } : {}), ...(l.sub ? { subText: l.sub } : {}), ...(l.si != null ? { pk: { si: l.si } } : {}) });
        if (!dvOn) {
        // naves y cometas que caen casi en el mismo punto se agrupan en un solo nombre ("Juno +2");
        // si el grupo coincide con un planeta (sus orbitadores), el "+N" va en el nombre del planeta
        const groups = [];
        if (camDist < 1050) for (const o of (ref.layerObjs || [])) {
          if (!o.points.visible || (o.key !== "probes" && o.key !== "comets" && o.key !== "minor")) continue;
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
        // nombres de las montañas: sobre la cumbre, con un palito que baja hasta la silueta (el punto exacto del
        // filo dibujado). Las que más destacan primero; los que no caben no se ponen.
        if (inside && ref.localModeOn && (ref.mountLabels || (ref.hzData && (ref.peakLabels || ref.monLabels || ref.andLabels)))) {
          const dens = ref.labelDensity || "normal", maxP = (dens === "pocas" ? 5 : dens === "muchas" ? 22 : 12) + (ref.andLabels ? 6 : 0) + (ref.mountLabels ? ref.mountLabels.length : 0), R = Math.PI / 180;
          let np = 0;
          // primero «Astronomía andina» (el Sol en solsticios y equinoccios, luego los sitios), después los
          // monumentos (son pocos y es lo que se vino a ver) y al final las cumbres
          for (const p of [...(ref.mountLabels || []), ...(ref.andLabels || []), ...(ref.monLabels || []), ...(ref.peakLabels || [])]) {
            if (np >= maxP) break;
            // una cumbre que queda detrás de un monumento (una pirámide la tapa) no se nombra
            // con suelo de verdad, una cumbre más baja que el observador queda tapada por él
            if (!p.cls && !p.monument && ref.monGround && p.alt < -0.45) continue;
            // (una pieza lejana de un sitio extenso —el templo de Chankillo a 1 km— tapada por el relieve cercano tampoco)
            if (p.monument && p.dist_km > 0.6 && ref.hzData && ref.hzData.alt) { const st = ref.hzData.step_deg || 0.2, ha = ref.hzData.alt[Math.round(p.az / st) % ref.hzData.alt.length]; if (ha > p.alt + 0.3) continue; }
            if (!p.cls && !p.monument && ref.hzData.monuments) { const st = ref.hzData.step_deg || 0.2, ha = ref.hzData.alt[Math.round(p.az / st) % ref.hzData.alt.length]; if (ha > p.alt + 0.4) continue; }
            const ca = Math.cos(p.alt * R);
            tmp.set(860 * ca * Math.sin(p.az * R), 860 * Math.sin(p.alt * R), -860 * ca * Math.cos(p.az * R)).project(ref.camera);
            if (tmp.z >= 1 || tmp.x < -1 || tmp.x > 1 || tmp.y < -1 || tmp.y > 1) continue;
            const sx = (tmp.x * 0.5 + 0.5) * W, sy = (-tmp.y * 0.5 + 0.5) * H;
            // las marcas del Sol («Astronomía andina») van un piso más arriba, con un palito más largo: así un sitio
            // que está justo en esa dirección (Cochasquí, Pambamarca…) cabe debajo con su propio nombre
            const tall = p.cls === "andsun", w = Math.max(p.label.length * 7.4, 46) + 8, top = sy - (tall ? 82 : 46), bot = tall ? sy - 50 : sy - 2;
            if (top < 4 || !free(sx - w / 2, top, sx + w / 2, bot) || (!p.cls && !(p.volcano && p.volcano.erupting) && !clear(sx - w / 2, top, sx + w / 2, bot))) continue;   // (un volcán en erupción se nombra aunque roce otro rótulo)   // las de «Astronomía andina» pueden pasar junto al disco del Sol: son su referencia
            boxes.push(sx - w / 2, top, sx + w / 2, bot);
            out.push({ key: "peak:" + p.az + ":" + p.name, name: p.label, cls: p.cls || "peak", sub: null, subText: p.subText != null ? p.subText : p.ele_m, x: sx, y: sy, dx: 0, flip: false,
              ...(p.volc ? { volc: true } : {}), ...(!p.cls && !p.monument ? { pk: { peak: p } } : {}), ...(p.monument ? { pk: { mon: p } } : {}) });
            np++;
          }
        }
        // la ISS: «ISS» junto al punto, inicio, fin y la hora de cada minuto (pocas: issLayer las aclara)
        if (inside && ref.issLayer && ref.issLayer.active) {
          for (const g of ref.issLayer.labelsForView(ref.camera, { w: W, h: H }, { clock: ref.issFmt || undefined })) place(g.x, g.y, g.name, g.cls, null, g.dx, g.pk ? { key: g.key, pk: g.pk } : { key: g.key });
        }
        // la luna de otro planeta que está abierta: su nombre antes que ningún otro
        const so0 = selObjRef.current;
        if (so0 && so0.layer === "moon" && ref.showSolar && ref.moonGroup && ref.moonGroup.visible) {
          const m = (ref.moonSky || []).find((x) => x.key === so0.name);
          if (m && m.state !== "hidden" && proj(m.dir[0] * 860, m.dir[1] * 860, m.dir[2] * 860, "solar")) place(psx, psy, moonName(m.key, ref.lang), "solar", null, 9, { pk: { layer: "moon", ob: so0 } });
        }
        // primero el sistema solar: sus nombres tienen prioridad en el anti-solape
        if (ref.showSolar) for (const b of (ref.bodies || [])) {
          if (ref.visOn && ref.solarVis && ref.solarVis[b.name] === false && !(selObjRef.current && selObjRef.current.layer === "solar" && selObjRef.current.name === b.name)) continue;   // no se ve: sin nombre
          if (!proj(b.nx*860, b.ny*860, b.nz*860, "solar")) continue;
          let extra = 0;
          for (const k of groups) if (!k.used && Math.abs(k.x - psx) < 22 && Math.abs(k.y - psy) < 16) { extra += k.n; k.used = true; }
          place(psx, psy, bodyName(b.name, ref.lang) + (extra ? ` +${extra}` : ""), "solar", null, Math.round(ref.solarSprites[b.name].userData.discPx + 7), { pk: { layer: "solar", ob: b } });
        }
        // las lunas de otros planetas: con mucho zoom, su nombre junto al punto
        if (ref.showSolar && ref.moonGroup && ref.moonGroup.visible && ref.camera.fov < 4) for (const m of (ref.moonSky || [])) {
          if (ref.moonSprites[m.key] && !ref.moonSprites[m.key].visible) continue;      // tapada por el dibujo agrandado del planeta
          if (m.state === "hidden") continue;
          const mo = moonObjFrom(ref.bodies, m.key, new Date(whenRef.current || Date.now()));
          if (so0 && so0.layer === "moon" && so0.name === m.key) continue;      // la abierta ya tiene su nombre (arriba)
          if (!proj(m.dir[0] * 860, m.dir[1] * 860, m.dir[2] * 860, "solar")) continue;
          place(psx, psy, moonName(m.key, ref.lang), "solar", null, 9, { pk: { layer: "moon", ob: mo } });
        }
        for (const k of groups) if (!k.used) place(k.x, k.y, k.name + (k.n > 1 ? ` +${k.n - 1}` : ""), k.cls, null, undefined, { pk: k.pk });
        // el objeto abierto siempre lleva su nombre, aunque sea de catálogo
        const so = selObjRef.current;
        if (so && so.nx != null && so.layer !== "solar" && so.layer !== "moon" && so.layer !== "note" && so.layer !== "con" && !(so.layer === "star" && selAb)) {
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
          if (ref.consOn !== false) for (const ab in ref.conCentroid) {
            const c = ref.conCentroid[ab]; if (!c.idxs.length) continue;
            let cx=0, cy=0, cz=0;
            for (const i of c.idxs) { cx += pa[i*3]; cy += pa[i*3+1]; cz += pa[i*3+2]; }
            const n = c.idxs.length; push(cx/n, cy/n, cz/n, c.name, "con", null, undefined, { ab });
          }
        } else {
          if (inside && ref.consOn !== false && (ar.on || ref.camera.fov > 14)) {
            // mirando desde dentro: nombres de constelaciones además de las estrellas brillantes
            for (const ab in ref.conCentroid) {
              const c = ref.conCentroid[ab]; if (!c.idxs.length) continue;
              let cx=0, cy=0, cz=0;
              for (const i of c.idxs) { cx += pa[i*3]; cy += pa[i*3+1]; cz += pa[i*3+2]; }
              const n = c.idxs.length;
              // con montañas: el nombre de una constelación que ha quedado detrás del relieve no se pone
              if (ref.hzData && ref.localModeOn) { hzV.set(cx, cy, cz).normalize().applyQuaternion(ref.localQuat); if (behindTerrain(ref.hzData, [hzV.x, hzV.y, hzV.z])) continue; }
              push(cx/n, cy/n, cz/n, c.name, "con", null, undefined, { ab });
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
          const sv = ref.visOn ? ref.starVis : null;
          for (let q = 0, n = 0; q < ns.length && n < maxN && ns[q].mag <= magT; q++) { const s = ns[q]; if (sv && !sv[s.i]) continue; n++; push(pa[s.i*3], pa[s.i*3+1], pa[s.i*3+2], s.name, "star", null, undefined, { pk: { si: s.i } }); }
        }
        if (camDist < 1050) {
          const lim = CATALOG_LABELS[ref.labelDensity || "normal"];
          for (const o of (ref.layerObjs || [])) {
            if (!o.points.visible || o.key === "probes" || o.key === "comets" || o.key === "minor") continue;   // naves y cometas: ya agrupados arriba
            const objs = o.points.userData.objs, cls = "obj_" + o.key, ov = ref.visOn ? (ref.camera.fov < TELE_FOV ? o.points.userData.tele : o.points.userData.vis) : null;
            // de catálogo: se cuentan los que caen en pantalla y solo se nombran si son pocos (hay zoom suficiente)
            let nCat = 0; const cat = [];
            for (let q = 0; q < objs.length; q++) {
              const ob = objs[q];
              if (ov && !ov[q]) continue;
              if (!inCone(ob.nx*870, ob.ny*870, ob.nz*870) || !proj(ob.nx*870, ob.ny*870, ob.nz*870, cls)) continue;
              const nm = (o.key === "meteors" && ref.lang === "en" && ob.name_en) || (o.key === "caldwell" && caldwellCommon(ob, ref.lang)) || ob.name;
              if (isNotable(o.key, ob, ref.when)) place(psx, psy, nm, cls, null, undefined, { pk: { layer: o.key, ob } });
              else if (++nCat <= lim) cat.push(psx, psy, nm, ob);
            }
            if (nCat <= lim) for (let q = 0; q < cat.length; q += 4) place(cat[q], cat[q+1], cat[q+2], cls, null, undefined, { pk: { layer: o.key, ob: cat[q+3] } });
          }
        }
        // líneas guía: nombres y marcas de cuadrícula al final, solo en los huecos que dejan los objetos
        if (ref.guides && ref.guides.setFov) ref.guides.setFov(ref.camera.fov, H);   // cada cuadro: también al apuntar con el teléfono
        if (camDist < 1050 && ref.guides && ref.guides.anyVisible()) {
          for (const g of ref.guides.labelsForView(ref.camera, { w: W, h: H })) {
            const n0 = out.length, dxg = g.prio > 1 ? 8 : 5;
            place(g.x, g.y, g.name, g.cls, null, dxg);
            // el nombre de una línea prueba otros puntos de ella si el primero está ocupado
            if (out.length === n0 && g.alts) for (const a of g.alts) { place(a.x, a.y, g.name, g.cls, null, dxg); if (out.length > n0) break; }
          }
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
      guides.dispose();
      // y lo que ese recorrido no ve: texturas en uniforms (teselas HiPS, relieve, nubes, aurora, Vía Láctea), las
      // cargas pendientes de las capas y la escena propia de la vista de profundidad. Cada dispose() es idempotente
      // (lo ya liberado arriba se vuelve a liberar sin efecto); un fallo en una capa no impide liberar el resto
      for (const L of [milky, hips, hipsFine, terrain, near3d, monuments, plume, mountLines, issLayer, atm, clouds, aurora, depthView]) {
        try { L.dispose(); } catch { /* no-op */ }
      }
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
    // la vista nueva (src/sky/depthView.js): de frente desde el Sol (0°) a de costado (90°)
    const dv = ref.depthView;
    if (dv && dv.active) {
      const o = ref.dvOpts || { k: 7, mainOnly: true };
      dv.setView({ a: dpt, k: o.k, mainOnly: o.mainOnly });
      const fr = dv.frame(); if (!fr) return;
      const a = dpt * Math.PI / 2, sa = Math.sin(a);
      const S = new THREE.Vector3(fr.stars[0], fr.stars[1], fr.stars[2]), c = S.clone().normalize();
      const up0 = Math.abs(c.z) < 0.85 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const side = new THREE.Vector3().crossVectors(c, up0).normalize();
      const T = S.clone().lerp(new THREE.Vector3(fr.center[0], fr.center[1], fr.center[2]), sa);
      // (en vertical, la profundidad va a lo ancho, que es lo estrecho: más lejos, y algo más por la columna de botones)
      // en escritorio la tarjeta ocupa la izquierda: se encuadra en lo que queda libre (≈ ancho − 600 px)
      const cvs = ref.renderer.domElement, wideNow = isWideRef.current && cvs.clientHeight > 0;
      const effA = wideNow ? Math.max(0.7, (cvs.clientWidth - 600) / cvs.clientHeight) : ref.camera.aspect;
      const fit = fr.radius / Math.tan(THREE.MathUtils.degToRad(ref.camera.fov / 2)) * 1.15 / Math.min(1, effA) * (wideNow ? 1.32 : effA < 1 ? 1.45 : 1.08);
      const dist = S.length() + (fit - S.length()) * sa;
      // de costado, un poco hacia el Sol: a su izquierda va «Tú (Sol)» (sin tapar las líneas)
      const hw = fit * Math.tan(THREE.MathUtils.degToRad(ref.camera.fov / 2)) * effA;
      T.addScaledVector(c, -0.12 * hw * sa);
      const dir = c.clone().multiplyScalar(-Math.cos(a)).add(side.multiplyScalar(sa)).normalize();
      ref.camera.position.copy(T).add(dir.multiplyScalar(dist));
      ref.controls.target.copy(T);
      ref.camera.up.copy(up0);
      ref.controls.update();
      ref._dirty = true;
      return;
    }
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

  // la escena de profundidad: las estrellas de la figura con su distancia y su error, y el cielo profundo con distancia
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.depthView) return;
    const dv = ref.depthView;
    const on = !!(sel && !(localMode && lat != null && lon != null) && ref.conMeta && ref.conMeta[sel]);   // (localActive se define más abajo)
    dv.active = on;
    if (!on) return;
    const c = ref.conMeta[sel], hips = [], at = new Map();
    c.lines.forEach((pl) => pl.forEach((h) => { if (!at.has(h) && ref.byHip.get(h)) { at.set(h, hips.length); hips.push(h); } }));
    const hex = (hx) => { const n = parseInt(String(hx || "#ffffff").slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    const stars = hips.map((h) => { const st = ref.byHip.get(h); return { key: h, name: st[7] || "", dir: [st[1], st[2], st[3]], d: st[6], mag: st[4], color: hex(st[5]), ePlx: st[10] != null ? st[10] : null, si: ref.hipIndex.get(h) }; });
    const lines = [];
    c.lines.forEach((pl) => { for (let i = 1; i < pl.length; i++) if (at.has(pl[i - 1]) && at.has(pl[i])) lines.push([at.get(pl[i - 1]), at.get(pl[i])]); });
    const ms = datasets && datasets.messier && datasets.messier.objects ? datasets.messier.objects : [];
    const dso = ms.filter((o) => o.const === sel && Number.isFinite(o.dist_ly)).map((o) => ({ name: labelForObj("messier", o, lang), dir: [o.nx, o.ny, o.nz], d: o.dist_ly }));
    dv.setData({ stars, lines, dso, px: ref.renderer ? ref.renderer.getPixelRatio() : 1 });
    setDvAutoK(dv.autoK);
    ref.dvText = { you: t.dvYou, ly: t.dvLy, range: t.dvRange, tick: t.dvTick };
    if (ref.mode === "depth") positionCamera(depthRef.current);
    ref._dirty = true;
  }, [sel, localMode, lat, lon, ready, datasets, lang, positionCamera]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ref = sceneRef.current; if (!ref) return;
    ref.dvOpts = { k: dvReal ? 1 : (ref.depthView ? ref.depthView.autoK : 7), mainOnly: dvMain };
    if (sel && ref.mode === "depth") positionCamera(depthRef.current);
  }, [dvReal, dvMain, dvAutoK, sel, positionCamera]);

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
      const raw = datasets[cfg.key];
      if (!raw || !raw.objects) return;
      // Caldwell: las galaxias que ya están en «Galaxias» (campo `in`) no se dibujan dos veces
      const data = cfg.key === "caldwell" ? { ...raw, objects: raw.objects.filter(o => !o.in) } : raw;
      // Messier y galaxias: el símbolo crece y brilla según su magnitud integrada (tres tamaños) y, con la
      // atmósfera, se oculta si no se vería (applyAtm). El resto de capas: símbolo fijo por capa.
      const byMag = MAG_LAYERS.has(cfg.key);
      const magSize = (m) => (m == null ? 0.75 : m <= 4.5 ? 1.55 : m <= 7.5 ? 1.1 : 0.75);   // sin magnitud publicada: el símbolo pequeño (antes no se dibujaban)
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
        pts.userData = { layer: cfg.key, objs: list, baseCol, vis: byMag ? new Uint8Array(list.length).fill(1) : null, tele: byMag ? new Uint8Array(list.length).fill(1) : null };
        ref.scene.add(pts);
        ref.layerObjs.push({ key: cfg.key, points: pts });
      });
    });
  }, [datasets, ready]);

  // alternar visibilidad de capas
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.layerObjs) return;
    // NGC/IC: además de estar encendida, solo se dibuja al acercarse (lo decide el bucle, con el campo de visión)
    ref.ngcOn = !!enabled.ngc;
    ref.layerObjs.forEach(o => { o.points.visible = !!enabled[o.key] && (o.key !== "ngc" || (ref.camera && ref.camera.fov < NGC_FOV)); });
  }, [enabled]);
  // encender/apagar líneas guía (sin recrear geometría)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.guides) return;
    ref.guides.setAll(guidesOn);
    if (ref.wake) ref.wake();
  }, [guidesOn, ready]);

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
    if (selObj.layer === "moon" && selObj.aArcsec) span = clampSpan(Math.max(0.25, (selObj.aArcsec / 3600) * (isWideRef.current ? 5 : 7)));   // la luna y su planeta, con margen
    ref.lookAt(v, span);
    // solo al cambiar de objeto: el paso del tiempo no debe recolocar la cámara
  }, [selObj && selObj.name, selObj && selObj.layer]);   // eslint-disable-line react-hooks/exhaustive-deps
  // métricas: tipo de objeto abierto; id solo para nombres propios de catálogo o planetas (nunca texto libre)
  useEffect(() => {
    if (!selObj) return;
    const L = selObj.layer;
    const kind = L === "solar" ? (selObj.name === "Sol" ? "sun" : selObj.name === "Luna" ? "moon" : "planet") : L === "moon" ? "satellite" : L === "con" ? "constellation"
      : ["star", "messier", "caldwell", "pulsars", "blackholes", "galaxies", "ngc", "oddities", "specialstars", "meteors", "comets", "minor", "probes", "exoplanets"].includes(L) ? L : "other";
    // id: solo nombres de catálogo cortos (planeta en inglés, M31, Sgr A*, Ori, estrella con nombre propio)
    const id = L === "solar" ? (BODIES[selObj.name] || {}).en : L === "moon" ? selObj.name : L === "con" ? selObj.ab : (L === "star" || L === "messier" || L === "caldwell" || L === "blackholes") ? selObj.name : undefined;
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
    // la escena está en J2000 (las estrellas del catálogo): en «Mi cielo» se precesa a la fecha y se gira
    // con el tiempo sidéreo de la fecha (look.js → localSkyQuatJ2000; antes faltaba la precesión, ~0,37°)
    const dNow = new Date(whenStr);
    const q = active ? localSkyQuatJ2000(lat, lon, dNow) : new THREE.Quaternion();
    // ecuador, cuadrícula AR/Dec y polos: los de la fecha (guidesLayer.js)
    const qDate = active ? localSkyQuat(lat, lon, dNow) : precessionQuat(dNow).invert();
    ref.localQuat = q; ref.localModeOn = active; ref.localLat = active ? lat : null;
    ref.points.quaternion.copy(q);
    ref.lines.quaternion.copy(q);
    if (ref.milky) ref.milky.mesh.quaternion.copy(q);
    if (ref.skyImages) ref.skyImages.group.quaternion.copy(q);
    if (ref.cometLayer) ref.cometLayer.group.quaternion.copy(q);
    if (ref.hips) ref.hips.group.quaternion.copy(q);
    if (ref.hipsFine) ref.hipsFine.group.quaternion.copy(q);
    if (ref.guides) ref.guides.setLocalFrame(active ? q : null, qDate);
    if (ref.issLayer) ref.issLayer.setLocalFrame(active ? q : null);   // la ISS solo existe sobre un horizonte
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
  // la clase del lugar: la que eligió la persona; si no, la medida (solo Quito); si no, la estimada por las luces
  // nocturnas del satélite alrededor (backend/app/lightpollution.py); si no hay nada, la neutra
  const presetPlace = PLACES.find((p) => p.name === placeKind) || null;
  const bortleKey = presetPlace ? placeKind : (lat != null && lon != null ? `@${bortleCell(lat, lon)}` : placeKind);
  const [bortleEst, setBortleEst] = useState({ key: null, value: null });
  const estKey = lat != null && lon != null ? bortleCell(lat, lon) : null;
  useEffect(() => {
    if (!estKey || !localMode) return undefined;
    let alive = true;
    fetchBortleEstimate(lat, lon, { api: API }).then(
      (e) => { if (alive) setBortleEst({ key: estKey, value: e.bortle }); },
      () => { if (alive) setBortleEst({ key: estKey, value: null }); });
    return () => { alive = false; };
  }, [estKey, localMode]);   // eslint-disable-line react-hooks/exhaustive-deps
  const estHere = bortleEst.key === estKey ? bortleEst.value : null;
  const bortleSrc = bortleMap[bortleKey] != null ? "set" : presetPlace && presetPlace.bortle != null ? "measured" : estHere != null ? "estimate" : null;
  const bortle = clampBortle(bortleMap[bortleKey] ?? (presetPlace || {}).bortle ?? estHere ?? BORTLE_DEFAULT);
  const setBortle = useCallback((n) => {
    setBortleMap((m) => { const nm = { ...m, [bortleKey]: clampBortle(n) }; try { localStorage.setItem(BORTLE_KEY, JSON.stringify(nm)); } catch { /* no-op */ } return nm; });
  }, [bortleKey]);
  useEffect(() => { try { localStorage.setItem(ATM_KEY, atmOn ? "1" : "0"); } catch { /* no-op */ } }, [atmOn]);
  const atmActive = !!(atmOn && localActive && !viewFrom);
  const atmState = useMemo(() => {
    if (!atmActive) return null;
    try {
      const d = new Date(whenStr);
      const sun = bodies.find((b) => b.name === "Sol"), moon = bodies.find((b) => b.name === "Luna");
      const aa = (b) => { const v = b.eqDate, r = altAz(v[0], v[1], v[2], lat, lon, d); return { alt: r.alt, az: r.az }; };   // topocéntrica, de la fecha
      return skyState(aa(sun), moon ? { ...aa(moon), illum: moon.illum } : null, bortle,
        { elevation_m: elev || 0, latDeg: lat, month: d.getMonth() + 1 });
    } catch { return null; }   // nunca debe romper la vista: sin estado, cielo sin atmósfera
  }, [atmActive, bodies, whenStr, lat, lon, bortle, elev]);
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
    // lunas de otros planetas en su posición de ese instante (las escondidas tras el planeta no se dibujan)
    const date = new Date(whenStr), sky2 = [];
    for (const pb of bodies) {
      if (!pb.dist_au || !["Marte", "Júpiter", "Saturno", "Urano", "Neptuno"].includes(pb.name)) continue;
      try { for (const m of moonsSky(pb, date)) sky2.push(m); } catch { /* sin datos: sin lunas */ }
    }
    for (const key in ref.moonSprites) ref.moonSprites[key].visible = false;
    for (const m of sky2) {
      const sp = ref.moonSprites[m.key]; if (!sp) continue;
      sp.position.set(m.dir[0] * 860, m.dir[1] * 860, m.dir[2] * 860);
      sp.visible = m.state !== "hidden";
      sp.userData.px = m.mag < 7 ? 15 : m.mag < 10 ? 12 : 10;           // las más brillantes, algo mayores
    }
    ref.moonSky = sky2;
    // el Sol real de ese momento (SDO, con sus manchas): solo se vuelve a pedir al cambiar de cuarto de hora
    if (ref.setSunReal) {
      const tW = new Date(whenStr).getTime(), slot = showSolar && !viewFrom ? sdoSlot(tW) : null;
      if (slot !== ref.sunSlot) {
        ref.sunSlot = slot;
        if (slot == null) ref.setSunReal(null);
        else loadSunImage(tW, { api: API }).then((r) => { const r1 = sceneRef.current; if (r1 && r1.sunSlot === slot) r1.setSunReal(r ? r.img : null); });
      }
    }
    // planetas realistas: posición, polo y, si cambió la inclinación (o llegó la textura), un repintado
    for (const nm in (ref.realSprites || {})) {
      const rs = ref.realSprites[nm], pb = bodies.find((x) => x.name === nm); if (!pb) continue;
      rs.sp.position.set(pb.nx * 860, pb.ny * 860, pb.nz * 860);
      rs.pole = planetPole(nm);
      const n = Math.hypot(pb.nx, pb.ny, pb.nz), o = planetOrientation(nm, [pb.nx / n, pb.ny / n, pb.nz / n]);
      if (o) rs.wantB = o.B;
      if (o && (rs.B == null || Math.abs(rs.B - o.B) > 0.3)) ref.paintReal(nm, o.B);
    }
    if (ref.sizeSolar) ref.sizeSolar();
    ref.solarGroup.quaternion.copy(ref.localQuat || new THREE.Quaternion());
  }, [bodies, showSolar, ready, viewFrom, whenStr]);

  // montañas: el horizonte real del lugar (backend /api/horizon, guardado en el teléfono por celda de 0,01°)
  useEffect(() => { try { localStorage.setItem(TERRAIN_KEY, terrainOn ? "1" : "0"); } catch { /* no-op */ } }, [terrainOn]);
  const hzKey = localActive && !viewFrom && lat != null && lon != null ? cellKey(lat, lon, placeFine) : null;
  useEffect(() => {
    if (!hzKey || !terrainOn) return;
    let alive = true;
    setHz((h) => (h.key === hzKey && h.status === "ok" ? h : { status: "loading", data: null, key: hzKey }));
    fetchHorizon(lat, lon, { api: API, fine: placeFine }).then(
      (data) => { if (alive) setHz({ status: "ok", data, key: hzKey }); },
      (e) => { if (alive) setHz({ status: "error", data: null, key: hzKey, error: String(e && e.message || e) }); });
    return () => { alive = false; };
  }, [hzKey, terrainOn, hzRetry]);   // eslint-disable-line react-hooks/exhaustive-deps
  const hzData = terrainOn && hz.status === "ok" && hz.key === hzKey ? hz.data : null;
  // nombres de las montañas: solo con el relieve ya dibujado (se anclan en su silueta)
  useEffect(() => { try { localStorage.setItem(PEAKS_KEY, peaksOn ? "1" : "0"); } catch { /* no-op */ } }, [peaksOn]);
  useEffect(() => { try { localStorage.setItem(ANDEAN_KEY, andOn ? "1" : "0"); } catch { /* no-op */ } }, [andOn]);
  useEffect(() => { try { localStorage.setItem(CONS_KEY, consOn ? "1" : "0"); } catch { /* no-op */ } }, [consOn]);
  // constelaciones apagadas: sin líneas ni nombres (salvo la que se ha elegido para verla en 3D)
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.lines) return;
    ref.consOn = consOn;
    ref.lines.visible = consOn || !!sel;
    ref._dirty = true; if (ref.wake) ref.wake();
  }, [consOn, sel, ready]);
  useEffect(() => {
    if (!peaksOn || !hzData || !hzKey) return;
    let alive = true;
    setPk((s) => (s.key === hzKey && s.status === "ok" ? s : { status: "loading", data: null, key: hzKey }));
    fetchPeaks(lat, lon, { api: API, fine: placeFine }).then(
      (data) => { if (alive) setPk({ status: "ok", data, key: hzKey }); },
      (e) => { if (alive) setPk({ status: "error", data: null, key: hzKey, error: String(e && e.message || e) }); });
    return () => { alive = false; };
  }, [peaksOn, hzData, hzKey, hzRetry]);   // eslint-disable-line react-hooks/exhaustive-deps
  const peakList = peaksOn && hzData && pk.status === "ok" && pk.key === hzKey ? pk.data.peaks : null;
  // colores reales de las laderas (Sentinel-2 cloudless 2016; backend/app/landcolor.py)
  useEffect(() => {
    if (!satOn || !hzData || !hzKey) return undefined;
    let alive = true;
    setLand((s) => (s.key === hzKey && s.status === "ok" ? s : { key: hzKey, status: "loading", data: null }));
    fetchLandColors(lat, lon, { api: API, fine: placeFine }).then(
      (data) => { if (alive) setLand({ key: hzKey, status: "ok", data }); },
      () => { if (alive) setLand({ key: hzKey, status: "error", data: null }); });
    return () => { alive = false; };
  }, [satOn, hzData, hzKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const landData = satOn && land.key === hzKey && land.status === "ok" ? land.data : null;
  // el relieve cercano en 3D (hasta 25 km) con la imagen de satélite encima (backend/app/terrain3d.py)
  const [near3, setNear3] = useState({ key: null, near: null });
  // (se pide a la vez que el horizonte, sin esperarlo: el servidor reutiliza el mismo cálculo)
  useEffect(() => {
    if (!satOn || !hzKey) return undefined;
    let alive = true;
    fetchNearTerrain(lat, lon, { api: API, fine: placeFine }).then(
      (near) => { if (alive) setNear3({ key: hzKey, near }); },
      () => { if (alive) setNear3({ key: hzKey, near: null }); });
    return () => { alive = false; };
  }, [satOn, hzKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  // mientras llega el relieve 3D no se dibujan las franjas planas (se verían un momento y luego cambiarían);
  // si tarda más de 8 s o falla, quedan las franjas
  const [nearWaitOver, setNearWaitOver] = useState(false);
  useEffect(() => { setNearWaitOver(false); if (!hzKey) return undefined; const id = setTimeout(() => setNearWaitOver(true), 8000); return () => clearTimeout(id); }, [hzKey]);
  const nearPending = satOn && !!hzKey && near3.key !== hzKey && !nearWaitOver;
  const nearData = satOn && hzData && near3.key === hzKey ? near3.near : null;
  // volcanes del Smithsonian de la zona (para la ficha de cada volcán del horizonte; src/sky/volcanoes.js)
  const [volc, setVolc] = useState({ key: null, list: null });
  const volcKey = hzData && lat != null && lon != null ? `${Math.round(lat * 2)},${Math.round(lon * 2)}` : null;
  useEffect(() => {
    if (!volcKey) return;
    let alive = true;
    fetchVolcanoes(lat, lon, { api: API }).then((list) => { if (alive) setVolc({ key: volcKey, list }); }, () => { if (alive) setVolc({ key: volcKey, list: null }); });
    return () => { alive = false; };
  }, [volcKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const volcList = volc.key === volcKey ? volc.list : null;
  // el tiempo de ahora en el lugar (pastilla «16 °C · Quito»; src/sky/nowWeather.js): cada 15 minutos
  const [wxNowRaw, setWxNow] = useState(null);
  const [wxOpen, setWxOpen] = useState(false);   // la tarjeta del tiempo (WxCard.jsx), abierta desde la pastilla
  const [mountOpen, setMountOpen] = useState(false);   // «Estacionar montura» (MountSheet.jsx), desde la brújula
  const [flatMode, setFlatMode] = useState(null);      // null | "sun" | "compass": el celular plano en el suelo
  const [mountPeek, setMountPeek] = useState(false);   // «Ver en el cielo»: la hoja se cierra y las líneas quedan
  const wxPillRef = useRef(null);
  // la altitud para corregir la temperatura: la del modelo de terreno en tu punto (fiable); sin ella, la del lugar
  // solo si es creíble; si no, ninguna (Open-Meteo usa entonces su propio modelo de terreno de 90 m). La altitud del
  // GPS del navegador no se usa: a veces llega mal y cada 150 m de error son 1 °C
  const wxElev = hzData && Number.isFinite(hzData.ground_m) ? hzData.ground_m : (elevPreset && Number.isFinite(elev) ? elev : null);
  const wxNowKey = localActive && !viewFrom && lat != null && lon != null ? `${lat.toFixed(2)},${lon.toFixed(2)},${wxElev != null ? Math.round(wxElev / 150) : "x"}` : null;
  useEffect(() => {
    if (!wxNowKey) { setWxNow(null); return undefined; }
    let alive = true;
    // (si la consulta falla —el servicio limita las consultas seguidas, p. ej. al saltar entre puntos de un sitio— se
    // conserva lo último que se tenía y se reintenta al rato: la ficha del clima no desaparece)
    // cada dato guarda su lugar (wxForPlace): si la consulta del lugar nuevo falla, no se muestra el de otra ciudad.
    // Un reintento pendiente se cancela antes de otro (el intervalo también llama a ask): no se acumulan cadenas
    let retry = 0;
    const place = { lat, lon };
    const again = () => { clearTimeout(retry); retry = setTimeout(ask, 30000); };
    const ask = () => { clearTimeout(retry); return fetch(nowUrl(lat, lon, wxElev)).then((r) => (r.ok ? r.json() : null)).then((j) => {
      const w = parseNow(j); if (!alive) return;
      if (w) setWxNow({ ...w, fetchedAt: Date.now(), place }); else again();
    }).catch(() => { if (alive) again(); }); };
    ask();
    const id = setInterval(ask, 15 * 60 * 1000);
    return () => { alive = false; clearInterval(id); clearTimeout(retry); };
  }, [wxNowKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  // siete modelos del mismo punto (src/sky/models.js): la pastilla y la tarjeta muestran su mediana y avisan si no
  // coinciden. Cada 30 minutos (Open-Meteo actualiza cada hora); si fallan, queda el modelo por defecto
  const [wxModRaw, setWxMod] = useState(null);
  useEffect(() => {
    if (!wxNowKey) { setWxMod(null); return undefined; }
    let alive = true;
    const place = { lat, lon };
    const ask = () => fetchModels(lat, lon, wxElev).then((m) => { if (alive) setWxMod(m ? { ...m, place } : m); }).catch(() => {});
    ask();
    const id = setInterval(ask, 30 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, [wxNowKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  // lo que se muestra: solo el dato de este lugar (o de un punto vecino del mismo sitio)
  const wxNow = wxNowKey ? wxForPlace(wxNowRaw, lat, lon) : null;
  const wxMod = wxNowKey ? wxForPlace(wxModRaw, lat, lon) : null;
  // nubes: pronóstico de Open-Meteo para el lugar (solo si se piden o se abre su panel) y capa del cielo
  useEffect(() => { try { localStorage.setItem(CLOUDS_KEY, cloudsOn ? "1" : "0"); } catch { /* no-op */ } }, [cloudsOn]);
  const wxKey = localActive && !viewFrom && lat != null && lon != null ? `${Math.round(lat * 10)},${Math.round(lon * 10)}` : null;
  useEffect(() => {
    if (!wxKey || !(cloudsOn || wxWanted)) return;
    let alive = true;
    setWx((w) => (w.key === wxKey && w.status === "ok" ? w : { status: "loading", data: null, key: wxKey }));
    fetchForecast(lat, lon).then(
      (data) => { if (alive) setWx({ status: "ok", data, key: wxKey }); },
      (e) => { if (alive) setWx({ status: "error", data: null, key: wxKey, error: String(e && e.message || e) }); });
    return () => { alive = false; };
  }, [wxKey, cloudsOn, wxWanted, wxRetry]);   // eslint-disable-line react-hooks/exhaustive-deps
  const wxData = wx.status === "ok" && wx.key === wxKey ? wx.data : null;
  // nubes de AHORA del satélite (GOES, Meteosat o Himawari): dónde están y a qué altura, en 150 km. Se piden con las
  // nubes encendidas o la tarjeta del tiempo abierta, cada 10 minutos. El suelo para repartirlas en capas es el del
  // pronóstico (el mismo desde el que se miden sus capas); sin él, el del relieve
  const satGround = wxData && Number.isFinite(wxData.elevation) ? wxData.elevation : hzData && Number.isFinite(hzData.ground_m) ? hzData.ground_m : null;
  const satKey = wxKey && (cloudsOn || wxOpen) && satGround != null ? `${lat.toFixed(2)},${lon.toFixed(2)},${Math.round(satGround / 100)}` : null;
  useEffect(() => {
    if (!satKey) return undefined;
    let alive = true;
    const ask = () => fetchSatClouds(lat, lon, satGround, { api: API })
      .then((data) => { if (alive) setSatCl({ key: satKey, data }); }, () => { if (alive) setSatCl((s0) => (s0.key === satKey ? s0 : { key: satKey, data: null })); });
    ask();
    const id = setInterval(ask, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, [satKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const satData = satCl.key === satKey ? satCl.data : null;
  // las nubes de un instante: el pronóstico y, cerca de la hora del barrido, el satélite (con su mapa en el cielo)
  // con lluvia (rainLook.js), las capas bajas y medias se engrosan y se cierran sobre ti antes de mezclarse con el satélite
  const cloudsFor = (d) => {
    const s = d.getTime() / 1000, w = satWeight(satData, s);
    // nubosidad por capas y viento en altura: los de la zona; la lluvia y la visibilidad: las de tu punto (como la tarjeta)
    const fc0 = wxData ? withPointRain(cloudsAt(wxData, d), wxNow ? hourAt(wxNow.hours, s) : null) : null;
    const look = rainLook(fc0, satData, w), fc = thickenForRain(fc0, look);
    const view = w > 0 ? fuseSat(satData, fc) : null, merged = mergeClouds(fc, view, w);
    return { clouds: merged, sat: view, w, off: w > 0 ? mapOffsets(merged, s, satData.t) : null, look };
  };
  const cfNow = useMemo(() => { try { return cloudsFor(new Date(whenStr)); } catch { return { clouds: null, sat: null, w: 0, off: null, look: null }; } },
    [wxData, satData, whenStr, wxNow]);   // eslint-disable-line react-hooks/exhaustive-deps
  // el cielo con el tiempo que hace (solo con las nubes encendidas): luz de día cubierto, bruma y lluvia
  const atmSky = useMemo(() => (cloudsOn && atmState && cfNow.clouds ? weatherSky(atmState, cfNow.clouds, cfNow.look) : atmState),
    [atmState, cloudsOn, cfNow]);
  // tu altura sobre el suelo del pronóstico (km): el horizonte real la da exacta; si no, la altitud del lugar
  const obsM = hzData ? (hzData.ground_m || 0) + (hzData.eye_m || 1.7) : (Number.isFinite(elev) ? elev : null);
  const cloudLiftKm = useMemo(() => cloudLift(obsM, wxData ? wxData.elevation : null), [obsM, wxData]);
  // monumentos: los que hay a menos de 25 km del lugar, asentados sobre el suelo del modelo de relieve (la altura
  // del terreno alrededor de cada uno y bajo el observador, de /api/elevation)
  useEffect(() => { try { localStorage.setItem(MONUMENTS_KEY, monOn ? "1" : "0"); } catch { /* no-op */ } }, [monOn]);
  // puntos de visita del sitio (para saltar de uno a otro) y el que se ofreció al tocar su rótulo en la escena
  const siteStops = useMemo(() => (localActive && !viewFrom ? stopsAt(lat, lon) : null), [localActive, viewFrom, lat, lon]);
  // (un punto de visita aéreo —`air`, como desde un dron—: solo si se está justo en él)
  const airLift = useMemo(() => { const q = siteStops && siteStops.stops.find((x) => x.air && offsetOf(lat, lon, x.lat, x.lon).d < 3); return q ? q.air : 0; }, [siteStops, lat, lon]);
  const monNear = useMemo(() => (localActive && !viewFrom ? monumentsNear(lat, lon, 25, { air: airLift }) : []), [localActive, viewFrom, lat, lon, airLift]);
  // saltar a un punto de visita: te sitúa allí mirando hacia lo que se viene a ver (`look`)
  const goStop = useCallback((s0, from, nameAs = null) => {
    track("sky_stop", { stop: s0.id, from });
    // (desde la ficha de una estructura, el lugar lleva el nombre de esa estructura: el mismo título en todas partes)
    pickPlace({ name: nameAs || s0.name[lang] || s0.name.es, lat: s0.lat, lon: s0.lon, elev: s0.elev, exact: true });
    if (s0.look != null) setTimeout(() => { const r = sceneRef.current; if (r && r.lookAt) { const v = altAzToLocal(s0.lookAlt != null ? s0.lookAlt : 2, s0.look); r.lookAt(new THREE.Vector3(v[0], v[1], v[2]), Math.max(r.look.spanT, 70), true); if (r.wake) r.wake(); } }, 500);
  }, [lang]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMonSheet(null); }, [lat, lon]);
  const monKey = monNear.length ? `${lat},${lon}|${monNear.map((m) => m.id).join(",")}` : null;
  // la maqueta de un sitio (Machu Picchu: src/sky/machuModel.js) se descarga solo al estar allí
  const [modelRev, setModelRev] = useState(0);
  const wantsModel = (monNear.find((m) => m.model) || {}).model || null;
  useEffect(() => {
    if (!wantsModel) return undefined;
    let alive = true; const b0 = import.meta.env.BASE_URL.replace(/\/$/, "");
    loadSiteModel(wantsModel, b0).then((m) => { if (alive && m) setModelRev((v) => v + 1); });
    if (wantsModel === "machu") loadIntiScan(b0).then((m) => { if (alive && m) setModelRev((v) => v + 1); });
    return () => { alive = false; };
  }, [wantsModel]);
  useEffect(() => {
    if (!monOn || !hzData || !monKey) return;
    let alive = true;
    setMonBase((s) => (s.key === monKey && s.status === "ok" ? s : { status: "loading", key: monKey, bases: null, ground: null }));
    const R = 12 / 111320, ck = Math.cos((lat * Math.PI) / 180);
    const obs = [[lat, lon], [lat + R, lon], [lat - R, lon], [lat, lon + R / ck], [lat, lon - R / ck]];
    // dónde medir el suelo de cada uno: en explanadas y cimas llanas (m.level), si el observador está al lado,
    // el monumento va al nivel de sus pies (sin puntos); lo que está sobre una cresta estrecha (m.ring pequeño), en
    // su centro; el resto, en un anillo fuera de su bulto
    // (`levelR`: solo tan cerca —la terraza del Cristo—; más lejos, en la ladera, se mide su suelo de verdad)
    const rings = monNear.map((m) => (m.level && offsetOf(lat, lon, m.lat, m.lon).d < (m.levelR || 600) ? [] : m.ring != null && m.ring < 10 ? [[m.lat, m.lon]] : groundRing(m, 8)));
    fetchElevations([...obs, ...rings.flat()], { api: API }).then((h) => {
      if (!alive) return;
      const bases = {};
      const ground = median(h.slice(0, 5));
      let at = 5;
      monNear.forEach((m, i) => { const n = rings[i].length; bases[m.id] = n ? median(h.slice(at, at + n)) : ground; at += n; });
      setMonBase({ status: "ok", key: monKey, bases, ground, relief: null });
      // sitios sobre una cresta o en ladera: además, el relieve del suelo cercano (si falla, el suelo queda llano)
      if (monNear.some((m) => m.relief)) {
        const reach = groundReach(monNear.map((m) => ({ m, o: offsetOf(lat, lon, m.lat, m.lon) })));
        // (un sitio extenso pide su propia rejilla, más fina —m.reliefGrid—; en tandas de 72 puntos: el servicio admite 80 por consulta)
        const spec = (monNear.find((m) => m.reliefGrid) || {}).reliefGrid || null, rp = reliefPoints(lat, lon, reach, spec), parts = [];
        for (let i = 0; i < rp.length; i += 72) parts.push(fetchElevations(rp.slice(i, i + 72), { api: API }));
        Promise.all(parts).then((gs) => {
          // (un sitio puede corregir el modelo global con cotas propias —m.reliefFix—: se suma en cada punto y a los pies)
          const fix = (monNear.find((m) => m.reliefFix) || {}).reliefFix || null, f0 = fix ? fix(lat, lon) : 0;
          const g = gs.flat().map((v, i) => (fix ? v + fix(rp[i][0], rp[i][1]) : v));
          if (alive) setMonBase((s0) => (s0.key === monKey && s0.status === "ok" ? { ...s0, relief: { reach, h: g.map((v) => v - ground - f0 - 1.7), abs0dem: ground + f0, ...(spec || {}) } } : s0));
        }, () => { /* sin relieve cercano */ });
      }
    }, (e) => { if (alive) setMonBase({ status: "error", key: monKey, bases: null, ground: null, error: String(e && e.message || e) }); });
    return () => { alive = false; };
  }, [monOn, monKey, !!hzData, hzRetry]);   // eslint-disable-line react-hooks/exhaustive-deps
  // el relieve del sitio; con su maqueta cargada, el suelo dentro de ella es el de la maqueta (exacto) y los pies del
  // observador se apoyan en él
  const siteRelief = useMemo(() => {
    let rl = monBase.relief;
    const mm = monNear.find((m) => m.model), mdl = mm ? siteModel(mm.model) : null; if (!mm || !mdl) return rl || null;
    const o = offsetOf(mm.lat, mm.lon, lat, lon), here = modelGround(o.e, o.n, mdl);
    // (una maqueta que es solo una parte del sitio —el Templo Fortificado de Chankillo, a 1 km de las torres—: lejos de
    // ella el suelo es el relieve de siempre, sin empalmes con su borde)
    if (mm.modelOnly && o.d > footprintRadius(mm) + 80) return rl || null;
    // (de pie sobre la maqueta no hace falta esperar al relieve del servicio: su suelo ya se conoce; el de fuera llega
    // después y solo retoca el borde. Así, al saltar a un punto, la vista sale bien desde el primer momento)
    if (!rl) {
      if (here == null || monBase.status !== "ok" || monBase.key !== monKey) return null;
      const spec = mm.reliefGrid || {}, np = (spec.radii || RELIEF_R).length * (spec.na || RELIEF_NA);
      rl = { reach: groundReach(monNear.map((m) => ({ m, o: offsetOf(lat, lon, m.lat, m.lon) }))), h: new Array(np).fill(-1.7), abs0dem: here, ...spec };
    }
    if (rl.abs0dem == null) return rl;
    const abs0 = here != null ? here : rl.abs0dem, sh = rl.abs0dem - abs0;
    // (`edge`: para un punto fuera de la maqueta, a qué distancia está su borde y a qué altura: el suelo de fuera empalma con él)
    const DIRS = Array.from({ length: 12 }, (_, i) => [Math.sin((i * Math.PI) / 6), Math.cos((i * Math.PI) / 6)]);
    const edge = (e, n) => { for (const rr of [5, 10, 16, 24, 33, 44]) { let best = null; for (const [dx, dy] of DIRS) { const a = modelGround(o.e + e + rr * dx, o.n + n + rr * dy, mdl); if (a != null && (best == null || a > best)) best = a; } if (best != null) return { d: rr, h: best - abs0 - 1.7 }; } return null; };
    return { ...rl, h: sh ? rl.h.map((v) => v + sh) : rl.h, abs0, edge, exact: (e, n) => { const a = modelGround(o.e + e, o.n + n, mdl); return a == null ? null : a - abs0 - 1.7; } };
  }, [monBase.relief, monBase.status, monBase.key, monKey, monNear, lat, lon, modelRev]);   // eslint-disable-line react-hooks/exhaustive-deps
  // (con la maqueta cargada no se dibuja nada hasta tener con qué ponerla a su altura: sin eso salía un instante vista desde abajo)
  const modelWaits = monNear.some((m) => m.model && siteModel(m.model)) && !siteRelief;
  const monItems = useMemo(() => (monOn && hzData && monBase.status === "ok" && monBase.key === monKey && !modelWaits
    ? placeMonuments(monNear, { lat, lon, ground: monBase.ground, air: airLift }, monBase.bases, siteRelief) : []), [monOn, hzData, monBase, monKey, monNear, lat, lon, siteRelief, modelRev, modelWaits, airLift]);   // eslint-disable-line react-hooks/exhaustive-deps
  const summitLift = placeSummit && nearData && monItems.length === 0 ? SUMMIT_LIFT_M : 0;
  // sin relieve propio del sitio, el piso de los monumentos sigue el relieve 3D (una loma no queda como un llano)
  // (más fina que la de /api/elevation: 10 anillos × 72 acimuts; cada edificio queda en su explanada)
  const monRelief = useMemo(() => {
    if (siteRelief) return siteRelief;
    if (!nearData || !monItems.length || monBase.ground == null) return null;
    return reliefFromNear(nearData.data || nearData, groundReach(monItems), monBase.ground, NEAR_RELIEF_R, 72);
  }, [siteRelief, monBase.ground, nearData, monItems]);
  // el horizonte con los monumentos macizos: lo que queda detrás de una pirámide tampoco se ve
  // (y el suelo del propio sitio: una ladera o un andén que sube sobre el horizonte lejano tapa el cielo que queda detrás)
  const monSil = useMemo(() => {
    if (!hzData || !monItems.length) return null;
    const st = hzData.step_deg || 0.2, a = silhouette(monItems, st), g = monRelief ? groundSilhouette(monItems, monRelief, st) : null;
    if (g && g.length === a.length) for (let i = 0; i < a.length; i++) if (g[i] > a[i]) a[i] = g[i];
    return a;
  }, [hzData, monItems, monRelief]);
  const hzEff = useMemo(() => (hzData && monSil ? withMonuments(hzData, monSil) : hzData), [hzData, monSil]);
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.monuments) return;
    ref.monuments.set(monItems, atmSky, monRelief);
    ref.monGround = monItems.length > 0;
    ref.monLabels = monItems.length ? monumentLabels(monItems, lang, monSil, hzData ? hzData.step_deg || 0.2 : 0.2).map((p) => ({ ...p, stop: stopOf(p.id), label: p.name, subText: p.sub || (lang === "es" ? `${String(p.ele_m).replace(".", ",")} m de alto` : `${p.ele_m} m tall`) })) : null;
    ref._dirty = true;
  }, [monItems, monSil, lang, ready, monRelief]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.monuments || !monItems.length) return;
    try { ref.monuments.paint(atmSky); } catch { /* no-op */ }
  }, [monItems, atmSky, ready]);   // eslint-disable-line react-hooks/exhaustive-deps
  // «Astronomía andina»: por dónde sale y se pone el Sol en solsticios y equinoccios (sobre el relieve real) y los
  // sitios quitu-caranquis cercanos (src/sky/andean.js, coordenadas GNSS de Cobo 2012)
  const andean = useMemo(() => (andOn && hzData ? andeanLabels({ lat, lon, ground: hzData.ground_m || 0, hz: hzData, lang }) : null), [andOn, hzData, lat, lon, lang]);
  useEffect(() => {
    const ref = sceneRef.current; if (!ref) return;
    ref.andLabels = andean ? andean.all : null;
    ref._dirty = true;
  }, [andean, ready]);   // eslint-disable-line react-hooks/exhaustive-deps
  // «Estacionar montura»: el filo del horizonte justo al norte y al sur verdaderos (con su nombre, si es una cumbre
  // conocida) y, con la hoja abierta, las líneas en el suelo y sus nombres en el horizonte
  const mountMarks = useMemo(() => {
    if (!hzData) return null;
    const named = (mk) => {
      if (!mk) return mk;
      const p = (peakList || []).find((q) => Math.abs(((q.az - mk.az + 540) % 360) - 180) < 1.5 && Math.abs(q.alt - mk.alt) < 0.6);
      return { ...mk, name: p ? peakName(p, lang) : null };
    };
    return { north: named(horizonMark(hzData, 0)), south: named(horizonMark(hzData, 180)) };
  }, [hzData, peakList, lang]);
  const mountShow = (mountOpen || mountPeek) && localActive && !viewFrom;
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.mountLines) return;
    const lines = mountShow ? groundLines(lat) : null;
    // la norte–sur sube por la ladera hasta el filo: así se ve qué punto del relieve marca el norte verdadero
    ref.mountLines.set(lines && hzData ? lines.map((l) => (l.kind === "ns" ? { ...l, to: Math.max(-0.25, horizonAltAt(hzData, l.az)) } : l)) : lines);
    const M = MT[lang] || MT.es;
    ref.mountLabels = lines ? lines.map((l) => ({
      az: l.az, alt: hzData ? horizonAltAt(hzData, l.az) : 0, name: "mnt:" + l.key, cls: "mount",
      label: M.lineLabels[l.key], subText: l.kind === "sol" ? (/Rise$/.test(l.key) ? M.lineSub.rise : M.lineSub.set) : `${Math.round(l.az)}°`,
    })) : null;
    ref._dirty = true;
  }, [mountShow, lat, lang, hzData, ready]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!localActive || viewFrom) { setMountOpen(false); setMountPeek(false); setFlatMode(null); } }, [localActive, viewFrom]);
  useEffect(() => {
    const ref = sceneRef.current; if (!ref) return;
    // las que son volcanes del Holoceno llevan su ficha; las que han entrado en erupción desde 1900, el año
    const VTl = VOLC_T[lang] || VOLC_T.es, loc = lang === "es" ? "es" : "en-US";
    const fmtM = (m) => `${Number(m).toLocaleString(loc, { useGrouping: "always" })} m`;
    const list = peakList ? matchVolcanoes(peaksToLabel(peakList, hzData, 40), volcList, lat, lon).map((p) => ({
      ...p, label: peakName(p, lang), volcanoChecked: !!volcList,
      ...(recentEruption(p.volcano) ? { subText: VTl.sub(fmtM(p.ele_m), p.volcano.last_year), volc: true } : {}),
    })) : [];
    // la misma cumbre escrita de dos maneras («Pamba Marca» y «Pambamarca», a menos de 3 km): se nombra una vez
    for (let i = list.length - 1; i > 0; i--) {
      const k = sameName(list[i].name);
      if (k && list.slice(0, i).some((q) => sameName(q.name) === k && Math.abs((((q.az - list[i].az) % 360) + 540) % 360 - 180) < 12 && Math.abs(q.dist_km - list[i].dist_km) < 3)) list.splice(i, 1);
    }
    // los volcanes en erupción que se ven llevan siempre su nombre (y van primero), aunque los nombres de las
    // montañas estén apagados o su cumbre no figure entre ellas (el Sangay desde el Chimborazo)
    const hot = volcList && hzData ? eruptingInView(volcList, hzData, lat, lon, terrainAngleOf) : [];
    const extra = [];
    for (const e of hot) {
      const v = volcList.find((x) => x.id === e.id), k = list.findIndex((p) => p.volcano && p.volcano.id === e.id);
      if (k >= 0) { extra.push(list[k]); list.splice(k, 1); continue; }
      extra.push({ name: v.name, label: v.name, hot: true, az: e.az, alt: e.alt, dist_km: +e.dist_km.toFixed(1), ele_m: v.elev_m,
        lat: v.lat, lon: v.lon, volcano: v, volcanoChecked: true, volc: true, subText: VTl.sub(fmtM(v.elev_m), v.last_year) });
    }
    // y, con los nombres encendidos, los volcanes del Smithsonian que forman la silueta y el mapa de cumbres no trajo
    // (o descartó): el Cotopaxi visto desde el Cayambe. Van delante: son los que se buscan con la vista
    const more = [];
    if (peaksOn && volcList && hzData) {
      const fd = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^(volcan|cerro|nevado)\s+/, "");
      const all = [...extra, ...list];
      for (const sv of volcanoesOnSkyline(volcList, hzData, lat, lon, terrainAngleOf)) {
        const dAz = (p) => Math.abs((((p.az - sv.az) % 360) + 540) % 360 - 180);
        if (all.some((p) => (p.volcano && p.volcano.id === sv.id) || fd(p.label) === fd(sv.name) || fd(p.name) === fd(sv.name) || (dAz(p) < 0.5 && Math.abs(p.dist_km - sv.dist_km) < 6))) continue;
        more.push({ ...sv, label: lang === "es" ? `Volcán ${sv.name}` : sv.name, volcanoChecked: true,
          ...(recentEruption(sv.volcano) ? { subText: VTl.sub(fmtM(sv.ele_m), sv.volcano.last_year), volc: true } : {}) });
      }
      more.sort((a, b) => b.alt - a.alt);
    }
    ref.peakLabels = (peakList || extra.length || more.length) ? [...extra, ...more.slice(0, 8), ...list] : null;
    ref._dirty = true;
  }, [peakList, hzData, lang, ready, volcList, lat, lon, peaksOn]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.terrain) return;
    ref.hzData = hzEff;
    // de pie en una cumbre (elegida por su nombre o con el GPS en la cima) o en un alto con todo el horizonte por
    // debajo: bajo las montañas, suelo o nieve opacos en vez del suelo translúcido
    let topAll = false;
    if (hzData && hzData.alt) { topAll = true; for (const v of hzData.alt) if (v >= 0) { topAll = false; break; } }
    const floor = !!hzData && (placeSummit || topAll);
    // desde un alto, el cielo (y el suelo translúcido) bajan hasta el filo más bajo del horizonte real: sin una
    // franja de otro color entre 0° y las montañas
    let low = 0;
    if (hzEff && hzEff.alt) for (const v of hzEff.alt) if (v < low) low = v;
    const dip = low < 0 ? low - 0.3 : 0;
    if (ref.atm && ref.atm.setDip) ref.atm.setDip(dip);
    ref.skyDip = dip;
    if (ref.groundMesh) ref.groundMesh.position.y = -1.5 + 905 * Math.tan((dip * Math.PI) / 180);
    if (ref.horizonLine) ref.horizonLine.material.opacity = hzData ? 0 : 0.85;   // con el relieve real a la vista, la línea de 0° sobra
    if (ref.terrain.data !== hzData || ref.terrain.floor !== floor) ref.terrain.set(hzData, lat, null, floor);
    ref.terrain.setEnabled(!!hzData);
  }, [hzData, hzEff, ready, placeSummit]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {      // el color de las montañas sigue la luz del cielo (sin atmósfera: siluetas de noche)
    const ref = sceneRef.current; if (!ref || !ref.terrain || !hzData) return;
    try { ref.terrain.setLand(landData, satOn); ref.terrain.paint(atmSky); } catch { /* no-op */ }
    try {
      let low = 0;
      if (hzData.alt) for (const v of hzData.alt) if (v < low) low = v;
      // opaco en las cumbres y donde hay monumentos (si no, quedarían flotando sobre un hueco translúcido)
      ref.near3d.setLook(atmSky, { hz: hzData, lat, floor: ref.terrain.floor || monItems.length > 0, lowest: low });
      ref._dirty = true;
    } catch { /* no-op */ }
  }, [hzData, atmSky, ready, placeSummit, landData, satOn, nearData, monItems.length]);
  useEffect(() => {      // la malla del relieve cercano: se pone cuando llegan sus datos y se quita al cambiar de lugar
    const ref = sceneRef.current; if (!ref || !ref.near3d) return;
    // en una cumbre (sin monumentos al lado, que se dibujan a la altura de los ojos de siempre) se mira desde 5 m más arriba
    // (de pie en la plataforma de una pirámide: el suelo es el de abajo y los ojos suben su altura —lift—; si no, el
    // disco central de la malla quedaría a la altura de la plataforma, como un llano de decenas de metros)
    ref.near3d.set(hzData && nearData ? nearData : null, hzKey, { lift: summitLift + (monItems.up || 0), ground: monItems.length && Number.isFinite(monBase.ground) ? monBase.ground : null });
    ref.near3d.setEnabled(!!hzData);
    const wait = nearPending || ref.near3d.loading;
    ref.terrain.setCovered(wait ? 1e9 : ref.near3d.coverKm); ref.monuments.setSkirt(!(ref.near3d.coverKm > 0) && !wait);
    ref.monuments.setNear(wait ? null : ref.near3d.colorMap);
    ref._dirty = true;
  }, [hzData, nearData, hzKey, ready, summitLift, nearPending, monItems.length, monItems.up, monBase.ground]);

  // columnas de ceniza (ilustrativas): la simulación pedida desde la ficha de un volcán y, suaves, las de los que el
  // Smithsonian da en erupción este año y se ven en el horizonte; el viento, del pronóstico (capa media)
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.plume) return;
    const on = localActive && !viewFrom && !!hzData;
    const vp = (p) => ({ az: p.az, alt: p.alt, dist_km: p.dist_km, vei: p.volcano ? p.volcano.last_vei : 2 });
    ref.plume.simulate(on && plumeSim ? vp(plumeSim) : null);
    // los que están en erupción y se ven, aunque los nombres de las montañas estén apagados
    const amb = on && volcList ? eruptingInView(volcList, hzData, lat, lon, terrainAngleOf).filter((v) => !plumeSim || !plumeSim.volcano || plumeSim.volcano.id !== v.id) : [];
    ref.plume.ambient(amb);
    let windMs = null;
    try { if (wxData) { const c = cloudsAt(wxData, new Date(whenStr)); windMs = c && c.wind && c.wind.mid; } } catch { /* sin viento */ }
    if (!windMs) windMs = windVector(wxNow);        // sin pronóstico en altura, el viento de ahora en superficie
    const day = atmState ? Math.min(1, Math.max(0, (atmState.sunAlt + 8) / 14)) : 0;
    // arrebol: con el Sol entre −4° y 8°, la luz que llega a la pluma es rojiza
    const sa = atmState ? atmState.sunAlt : -90, glow = sa > -6 && sa < 10 ? 1 - Math.abs(sa - 1) / 9 : 0;
    ref.plume.setLook({ windMs, day, glow: Math.max(0, glow), sunDir: atmState && atmState.sunDir ? atmState.sunDir : null, horizon: atmSky && atmSky.colors ? atmSky.colors.horizon : null });
    ref._dirty = true;
  }, [plumeSim, peakList, volcList, hzData, localActive, viewFrom, wxData, whenStr, atmState, atmSky, ready, wxNow]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPlumeSim(null); }, [lat, lon]);

  // atmósfera: estrellas, planetas y cielo profundo según lo que deja ver el cielo (después de colocar
  // el marco local y los cuerpos, que son los efectos anteriores). Si algo falla, el cielo queda sin atmósfera.
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.applyAtm) return;
    if (!atmState && !hzData && !ref.atmOn && !ref._atmTouched) return;          // sin atmósfera ni montañas y nada que deshacer
    ref.hzData = hzEff;
    ref._atmTouched = true;
    try {
      const d = new Date(whenStr), cf = cfNow;
      const map = ref.clouds ? ref.clouds.setMap(cf.sat, cf.w, cf.off) : null;
      ref.cloudOcc = cloudsOn && atmState && cf.clouds ? makeOccluder(cf.clouds, d.getTime() / 1000, cloudLiftKm, map) : null;
    } catch { ref.cloudOcc = null; }
    let c;
    try { c = ref.applyAtm(atmSky); } catch (e) { try { c = ref.applyAtm(null); } catch { /* no-op */ } }
    if (c) setAtmInfo((p) => (p.stars === c.stars && p.deep === c.deep && p.deepTot === c.deepTot ? p : { stars: c.stars, deep: c.deep, deepTot: c.deepTot }));
  }, [atmState, atmSky, ready, datasets, enabled, bodies, showSolar, localActive, viewFrom, cloudsOn, wxData, satData, hzData, hzEff, cloudLiftKm, cfNow]);   // eslint-disable-line react-hooks/exhaustive-deps

  // nubes: la capa del cielo (el pronóstico se lee más arriba). Desde una cumbre, las capas se acercan o quedan
  // por debajo (cloudLift) y las montañas que asoman las tapan (las bandas del horizonte real)
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.clouds) return;
    let show = false;
    try {
      const d = new Date(whenStr), cf = cfNow;
      show = !!(cloudsOn && atmState && cf.clouds);
      ref.clouds.setView(cloudLiftKm, hzData);
      ref.clouds.setMap(show ? cf.sat : null, cf.w, cf.off);
      ref.clouds.update(show ? cf.clouds : null, atmSky, d.getTime() / 1000);
    } catch { ref.clouds.update(null, null, 0); }   // nunca debe romper la vista
    ref.clouds.setEnabled(show);
  }, [cloudsOn, atmState, atmSky, cfNow, wxData, satData, whenStr, ready, cloudLiftKm, hzData]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── auroras: datos de NOAA (OVATION y Kp) para el lugar, el óvalo de la hora del cielo y la capa ──
  useEffect(() => { try { localStorage.setItem(AURORA_KEY, auroraOn ? "1" : "0"); } catch { /* no-op */ } }, [auroraOn]);
  const auPlace = auroraOn && localActive && !viewFrom && lat != null && lon != null;
  // se pide a NOAA donde una tormenta podría llegar a verse (≥ 35° geomagnéticos) o al abrir «Capas»
  const auNear = auPlace ? Math.abs(geoToMag(lat, lon, dipole(new Date())).mlat) >= 35 : false;
  const auKey = auPlace && (auNear || panel === "layers") ? `${Math.round(lat * 2)},${Math.round(lon * 2)}` : null;
  useEffect(() => {
    if (!auKey) return;
    let alive = true;
    const ask = () => {
      setAu((a) => (a.key === auKey && a.status === "ok" ? a : { key: auKey, status: "loading", data: null }));
      fetch(`${API}/api/aurora?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data) => { if (alive) setAu({ key: auKey, status: "ok", data }); },
          (e) => { if (alive) setAu((a) => (a.key === auKey && a.data ? a : { key: auKey, status: "error", data: null, error: String(e && e.message || e) })); });
    };
    ask();
    const id = setInterval(ask, 10 * 60 * 1000);   // OVATION se renueva cada pocos minutos
    return () => { alive = false; clearInterval(id); };
  }, [auKey, auRetry]);   // eslint-disable-line react-hooks/exhaustive-deps
  const auData = au.key === auKey && au.status === "ok" ? au.data : null;
  const auGrid = useMemo(() => (auData && auData.ovation ? decodeOvation(auData.ovation) : null), [auData]);
  const auKpSeries = auData && auData.kp ? auData.kp.series : null;
  const auView = useMemo(() => {
    if (!auPlace) return null;
    try {
      const d = new Date(whenStr), dp = dipole(d), hemi = hemiOf(lat, lon, dp);
      const live = !!(auGrid && Math.abs(d.getTime() - Date.now()) <= 75 * 60e3);
      const me = geoToMag(lat, lon, dp);
      let bands, mode, here, kp = null, kpKind = null;
      const k = kpAt(auKpSeries, d);
      if (live) {
        bands = bandsFromGrid(auGrid, dp, hemi); mode = "live"; here = probGrid(auGrid, lat, lon);
        const kn = k || (auData.kp && auData.kp.now);
        if (kn) { kp = kn.kp; kpKind = kn.kind; }
      } else {
        kp = k ? k.kp : KP_TYPICAL; kpKind = k ? k.kind : null; mode = k ? "kp" : "typical";
        bands = bandsFromKp(kp, d, dp, hemi);
        here = probModel(kp, Math.abs(me.mlat), magLocalTime(me.mlon, d, dp));
      }
      const look = lookAt(bands, dp, hemi, { lat, lon, elevKm: (elev || 0) / 1000 });
      const eph = ephemeris(d), sn = eph.find((b) => b.name === "Sol"), mn = eph.find((b) => b.name === "Luna");
      const sA = altAz(sn.nx, sn.ny, sn.nz, lat, lon, d).alt, mA = mn ? altAz(mn.nx, mn.ny, mn.nz, lat, lon, d).alt : -90;
      const vis = darkness(sA, mA, mn && mn.illum != null ? mn.illum : 0);
      return { dp, hemi, bands, mode, here, kp, kpKind, look, vis, nearest: live ? auData.ovation.nearest : null, observed: live ? auData.ovation.observed : null };
    } catch { return null; }
  }, [auPlace, whenStr, lat, lon, elev, auGrid, auKpSeries, auData]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.aurora) return;
    try {
      if (!auView) { ref.aurora.setEnabled(false); return; }
      ref.aurora.setObserver(lat, lon, (elev || 0) / 1000, auView.dp);
      ref.aurora.setBands(auView.look.visible ? auView.bands : null, auView.hemi);
      ref.aurora.setLook({ vis: auView.vis, act: auView.kp != null ? auView.kp / 9 : 0.2 });
      ref.aurora.setEnabled(true);
      ref._dirty = true;
    } catch { ref.aurora.setEnabled(false); }   // nunca debe romper la vista
  }, [auView, ready]);   // eslint-disable-line react-hooks/exhaustive-deps

  // los avances de la hora parten del instante recordado de cada cadena, no de releerla (src/sky/whenClock.js):
  // en la hora repetida del cambio de horario, releer «01:50» volvía a la primera pasada y el play quedaba en bucle
  const advanceWhen = useMemo(() => createWhenAdvance(fmtInput), []);
  // animar el tiempo (play)
  // (con una pasada de la ISS en el cielo, el tiempo lo lleva su reloj, al segundo y a ×1/×10/×60: ver el bucle)
  useEffect(() => {
    if (!playing || issOn) return;
    const id = setInterval(() => setWhenStr(w => advanceWhen(w, 10 * 60000)), 120);
    return () => clearInterval(id);
  }, [playing, issOn]);
  // reloj de la ISS: sigue al reloj del sistema en «ahora»; si whenStr cambió por otro control (±1 h, fecha,
  // «ahora»), salta al principio de ese minuto; si lo escribió el propio reloj (mismo minuto), conserva los segundos
  useEffect(() => {
    const ck = issClock.current;
    ck.live = !timeMoved && !playing;
    if (ck.live) ck.t = Date.now();
    else if (fmtInput(new Date(ck.t)) !== whenStr) ck.t = new Date(whenStr).getTime();
    ck.lastMin = Math.floor(ck.t / 60000);
    if (sceneRef.current && sceneRef.current.wake) sceneRef.current.wake();
  }, [whenStr, timeMoved, playing]);
  useEffect(() => {
    const ck = issClock.current;
    ck.playing = playing && issOn; ck.rate = issRate;
    ck.onMinute = (ms) => setWhenStr(fmtInput(new Date(ms)));
    ck.onEnd = () => { ck.playing = false; setPlaying(false); };
  }, [playing, issOn, issRate]);
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
  // velocidad del tiempo (control tipo Stellarium): minutos de cielo por segundo; los minutos sueltos se acumulan
  const rateAcc = useRef(0);
  useEffect(() => {
    const r = RATES[rateIdx];
    if (r === 0 || rateIdx === REAL) return;
    rateAcc.current = 0;
    const id = setInterval(() => {
      rateAcc.current += r * 0.1;
      const whole = rateAcc.current > 0 ? Math.floor(rateAcc.current) : Math.ceil(rateAcc.current);
      if (!whole) return;
      rateAcc.current -= whole;
      setWhenStr((w) => advanceWhen(w, whole * 60000));
    }, 100);
    return () => clearInterval(id);
  }, [rateIdx]);
  // a velocidad real pero con la hora movida: el cielo avanza un minuto por minuto (en «ahora» ya sigue al reloj)
  useEffect(() => {
    if (rateIdx !== REAL || !timeMoved) return;
    const id = setInterval(() => setWhenStr((w) => advanceWhen(w, 60000)), 60000);
    return () => clearInterval(id);
  }, [rateIdx, timeMoved]);
  const setRate = useCallback((i) => {
    track("sky_time", { kind: "rate" });
    setPlaying(false);
    if (i !== REAL) setTimeMoved(true);
    setRateIdx(i);
  }, []);
  const tsStep = useCallback((f, dir) => { setPlaying(false); setTimeMoved(true); setWhenStr((w) => fmtInput(stepFieldTz(new Date(w), f, dir, tzRef.current))); }, []);
  const tsNow = useCallback(() => { track("sky_time", { kind: "now" }); setPlaying(false); setTimeMoved(false); setRateIdx(REAL); setWhenStr(nowLocalInput()); }, []);
  const tsNight = useCallback((dir) => { track("sky_time", { kind: dir > 0 ? "forward" : "back" }); setPlaying(false); setTimeMoved(true); setWhenStr((w) => fmtInput(stepFieldTz(new Date(w), "day", dir, tzRef.current))); }, []);
  const tsMinute = useCallback((min) => {
    setPlaying(false); setTimeMoved(true);
    setWhenStr((w) => fmtInput(setMinuteTz(new Date(w), min, tzRef.current)));
  }, []);
  const shiftMin = useCallback((m) => { setTimeMoved(true); setWhenStr(w => advanceWhen(w, m * 60000)); }, [advanceWhen]);
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
    ref.issFmt = (ms) => issClockFmt(ms, { lang });     // hora de las marcas de la ISS (zona del dispositivo)
    ref.cardNames = TC[lang].cardinals;
    if (ref.guides) ref.guides.setLang(lang);
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
  // ── la ISS en el Cielo ──
  // «Verla en el cielo» (tarjeta de «Esta noche»): cierra el panel, pone la hora al inicio del tramo visible
  // (o de la pasada, si no se ve), vuela a la culminación y dibuja la pasada. Si no trae trayectoria (las no
  // visibles), se pide solo la de esa pasada (pass_start). Solo tiene sentido sobre un horizonte: si «Mi
  // cielo» no estaba activo se activa con el lugar actual, y se avisa.
  const showIss = useCallback((p, data) => {
    if (!p || lat == null || lon == null) return;
    const x = ISS_TX[lang] || ISS_TX.es;
    const msgs = [];
    if (!localMode) { setLocalMode(true); setSel(null); setDepth(0); setOutside(false); msgs.push(x.issNeedMySky); }
    setPanel(null); setSelObj(null); setPick(null); setIssSheet(false);
    const t0 = p.visFromMs ?? p.startMs;
    const ck = issClock.current; ck.t = t0; ck.live = false; ck.lastMin = Math.floor(t0 / 60000); ck.hudSec = null;
    setPlaying(false); setTimeMoved(true); setWhenStr(fmtInput(new Date(t0)));
    issFlyRef.current = { alt: p.max.alt, az: p.max.az };
    setIssSel({ lat, lon, pass: p, data: data || null, status: hasTrack(p) ? "ok" : "loading" });
    const why = hiddenReason(p);
    if (why) msgs.push(x.issHiddenWhy[why]);
    msgs.push(x.issShowing(issDayTime(p.startMs, { lang })));
    setToast({ text: msgs.join(" "), id: Date.now() });
  }, [lat, lon, lang, localMode]);
  // trayectoria de una pasada no visible: solo la de esa pasada (~2 KB), cancelable
  useEffect(() => {
    if (!issSel || issSel.status !== "loading") return undefined;
    const ctl = new AbortController(), want = issSel.pass;
    const days = (issSel.data && issSel.data.window && issSel.data.window.days) || ISS_DAYS;
    fetchIssPass({ lat: issSel.lat, lon: issSel.lon, altM: elev || 0, days, pass: want, signal: ctl.signal })
      .then(({ pass, data }) => setIssSel((s) => (s && s.pass === want ? { ...s, pass, data: s.data || data, status: "ok" } : s)))
      .catch((e) => {
        if (e && e.name === "AbortError") return;
        setIssSel((s) => (s && s.pass === want ? { ...s, status: "error" } : s));
        setToast({ text: (ISS_TX[langRef.current] || ISS_TX.es).issTrackError, id: Date.now() });
      });
    return () => ctl.abort();
  }, [issSel, elev]);
  // la capa dibuja la pasada elegida (y nada si no hay, si aún carga o si no hay horizonte)
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.issLayer) return;
    ref.issLayer.setPass(issOn ? issSel.pass : null);
    ref.issLayer.setLocalFrame(localActive ? ref.localQuat : null);
    issClock.current.endMs = issOn ? issSel.pass.endMs : null;
    issClock.current.hudSec = null;
    if (ref.wake) ref.wake();
  }, [issSel, issOn, localActive, ready]);   // eslint-disable-line react-hooks/exhaustive-deps
  // vuelo a la culminación, cuando «Mi cielo» ya está activo (después del efecto que coloca su mirada inicial)
  useEffect(() => {
    const ref = sceneRef.current, m = issFlyRef.current;
    if (!ref || !m || !issSel || !localActive || ref.mode !== "in") return;
    issFlyRef.current = null;
    const v = altAzToLocal(m.alt, m.az);
    ref.lookAt(new THREE.Vector3(v[0], v[1], v[2]), Math.max(ref.look.spanT, SPAN_DEF));
  }, [issSel, localActive, ready]);
  const removeIss = useCallback((quiet) => {
    setIssSel(null); setIssSheet(false); setPlaying(false);
    issFlyRef.current = null;
    if (quiet !== true) track("iss_passes", { kind: "remove", state: "ok" });
  }, []);
  // al cambiar de lugar (o salir de «Mi cielo») la pasada deja de valer: se quita
  useEffect(() => {
    if (issSel && (!localMode || lat !== issSel.lat || lon !== issSel.lon)) removeIss(true);
  }, [lat, lon, localMode]);   // eslint-disable-line react-hooks/exhaustive-deps
  const openIss = useCallback(() => {
    setSelObj(null); setPick(null); setIssSheet(true);
    if (!isWideRef.current) setPanel(null);
    track("iss_passes", { kind: "sheet", state: "ok" });
  }, []);
  const openIssRef = useRef(openIss);
  openIssRef.current = openIss;
  useEffect(() => { if (selObj) { setIssSheet(false); setPeakSheet(null); setMonSheet(null); } }, [selObj]);
  useEffect(() => { if (issSheet) { setPeakSheet(null); setMonSheet(null); } }, [issSheet]);
  useEffect(() => { if (peakSheet) setMonSheet(null); }, [peakSheet]);
  // cometas: coma y cola (si la capa está encendida) y la órbita del cometa abierto
  useEffect(() => {
    if (!enabled.comets || cometOrbits) return;
    let alive = true;
    fetch("/comet-orbits.json").then((r) => r.json()).then((d) => { if (alive) setCometOrbits(d.comets || {}); }).catch(() => { if (alive) setCometOrbits({}); });
    return () => { alive = false; };
  }, [enabled.comets, cometOrbits]);
  useEffect(() => {
    const ref = sceneRef.current; if (!ref || !ref.cometLayer) return;
    const on = !!enabled.comets && !viewFrom && datasets.comets && cometOrbits;
    ref.cometLayer.set(on ? datasets.comets.objects : [], cometOrbits);
    ref.cometLayer.showOrbit(on && selObj && selObj.layer === "comets" ? selObj.name : null);
    ref._dirty = true; if (ref.wake) ref.wake();
  }, [enabled.comets, datasets.comets, cometOrbits, selObj, viewFrom, ready]);
  // «Mapa fotográfico» enciende todas las fotos del cielo (placas, recortes e imágenes de agencia); «Campos profundos», sus recuadros
  useEffect(() => { const ref = sceneRef.current; if (!ref) return; ref.hipsOn = !!enabled.photo; if (ref.skyImages) { ref.skyImages.setPhotos(!!enabled.photo); ref.skyImages.setFrames(!!enabled.deepfields); } ref._dirty = true; if (ref.wake) ref.wake(); }, [enabled.photo, enabled.deepfields, ready]);
  // centrar: en la ISS si está sobre el horizonte a esa hora; si no, en la culminación
  const centerIss = useCallback(() => {
    const ref = sceneRef.current; if (!ref || !issOn || ref.ar.on) return;
    const pos = ref.issLayer.pos, m = issSel.pass.max;
    const v = pos ? pos.local : altAzToLocal(m.alt, m.az);
    ref.lookAt(new THREE.Vector3(v[0], v[1], v[2]), Math.min(ref.look.spanT, SPAN_DEF));
  }, [issOn, issSel]);
  // ▶/⏸ de la píldora: al acabar la pasada, ▶ la vuelve a empezar
  const toggleIssPlay = useCallback(() => {
    if (!issOn) return;
    const ck = issClock.current, p = issSel.pass;
    if (!playing && (ck.t > p.endMs || ck.t < p.startMs - 10 * 60000)) {
      const t0 = p.visFromMs ?? p.startMs;
      ck.t = t0; ck.live = false; ck.lastMin = Math.floor(t0 / 60000);
      setWhenStr(fmtInput(new Date(t0)));
    }
    if (!playing) track("iss_passes", { kind: "play", state: "ok" });
    setTimeMoved(true); setPlaying((v) => !v);
  }, [issOn, issSel, playing]);
  const cycleIssRate = useCallback(() => setIssRate((r) => nextRate(r)), []);

  // ── tour para principiantes (src/sky/tour.js): cada parada une una idea del cielo con una función de la app ──
  // Al empezar se guarda tu lugar y tu hora; las paradas de Guiza y del volcán los cambian sin guardarlos, y al
  // volver a tu cielo (o al salir) se restauran. Si eliges un lugar durante el tour, ese pasa a ser el tuyo.
  const tourSnap = useRef(null);
  const [tourView, setTourView] = useState(null);      // { id, title, text, fact, tip, target, top }
  const startTour = useCallback(() => {
    track("sky_tour", { state: "start" }); setSel(null); setOutside(false); setSelObj(null); setPanel(null); setPlumeSim(null);
    let saved = null; try { saved = localStorage.getItem(PLACE_KEY); } catch { /* no-op */ }
    tourSnap.current = { lat, lon, elev, elevPreset, placeFine, placeSummit, placeKind, localMode, placeDefault, saved, whenStr, timeMoved, away: false, timeAway: false };
    setTourView(null); setTourIndex(0); setTourActive(true);
  }, [lat, lon, elev, elevPreset, placeFine, placeSummit, placeKind, localMode, placeDefault, whenStr, timeMoved]);
  const tourGoPlace = useCallback((p) => {
    ++placeSeq.current;
    setLat(p.lat); setLon(p.lon); setElev(p.elev ?? null); setElevPreset(p.elev != null ? "terrain" : false); setPlaceFine(true); setPlaceSummit(!!p.summit); setPlaceDefault(false);
    setPlaceKind(p.name); setLocalMode(true); setSel(null);
    if (tourSnap.current) tourSnap.current.away = true;
  }, []);
  const tourRestore = useCallback(() => {
    const s0 = tourSnap.current; if (!s0) return;
    if (s0.away) {
      ++placeSeq.current;
      setLat(s0.lat); setLon(s0.lon); setElev(s0.elev); setElevPreset(s0.elevPreset); setPlaceFine(s0.placeFine); setPlaceSummit(s0.placeSummit);
      setPlaceDefault(s0.placeDefault); setPlaceKind(s0.placeKind); setLocalMode(s0.localMode);
      try { if (s0.saved == null) localStorage.removeItem(PLACE_KEY); else localStorage.setItem(PLACE_KEY, s0.saved); } catch { /* no-op */ }
      s0.away = false;
    }
    if (s0.timeAway) { setPlaying(false); setTimeMoved(s0.timeMoved); setWhenStr(s0.timeMoved ? s0.whenStr : fmtInput(new Date())); s0.timeAway = false; }
    setPlumeSim(null);
  }, []);
  // elegir un lugar durante el tour: ese pasa a ser el tuyo (no se deshace al salir)
  const tourAdopt = useCallback((a, o) => {
    const s0 = tourSnap.current; if (!s0) return;
    let saved = null; try { saved = localStorage.getItem(PLACE_KEY); } catch { /* no-op */ }
    Object.assign(s0, { away: false, lat: a, lon: o, localMode: true, saved });
  }, []);
  const tourDataReady = !!(ready && sky && datasets.messier && datasets.blackholes);
  useEffect(() => {
    if (!tourActive || !tourDataReady) return undefined;
    const stop = TOUR_STOPS[tourIndex], T = TOUR_T[lang] || TOUR_T.es, ref = sceneRef.current;
    let cancel = false; const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(() => { if (!cancel) fn(); }, ms));
    const lookAA = (alt, az, span) => { const r = sceneRef.current; if (r && r.lookAt) { const v = altAzToLocal(alt, az); r.lookAt(new THREE.Vector3(v[0], v[1], v[2]), span, true); if (r.wake) r.wake(); } };
    const sunFn = (la, lo) => (d) => { const sn = ephemeris(d).find((b) => b.name === "Sol"); return altAz(sn.nx, sn.ny, sn.nz, la, lo, d); };
    const base = { id: stop.id, target: stop.target, fact: "", tip: null, top: stop.id === "tonight" };
    const goTime = (d) => { setPlaying(false); setTimeMoved(true); setWhenStr(fmtInput(d)); if (tourSnap.current) tourSnap.current.timeAway = true; };
    if (stop.scene === "giza") {
      // hoy, con el Sol a 4,5° justo sobre la cúspide de Keops (3 km al este de ella, en la línea del Sol poniente)
      const f = sunFn(KHUFU.lat, KHUFU.lon), ss = sunsetAt(new Date(), KHUFU.lon, f, 4.5);
      if (ss) {
        const gv = gizaView(f(ss).az);
        tourGoPlace({ name: lang === "es" ? "Guiza" : "Giza", lat: +gv.lat.toFixed(5), lon: +gv.lon.toFixed(5) }); goTime(ss);
        later(() => lookAA(4, gv.lookAz, 32), 900); later(() => lookAA(4, gv.lookAz, 32), 3500);
      }
      setTourView({ ...base, title: T.place.title, text: T.place.text, tip: T.place.tip });
    } else if (stop.scene === "volcano") {
      // de pie en la cumbre del Chimborazo (la del modelo de relieve), con el Sol a 1,5° tras de ti
      const V = VOLCANO_VIEW, ss = sunsetAt(new Date(), V.lon, sunFn(V.lat, V.lon), 1.5);
      const go = (p) => { if (!cancel) tourGoPlace(p); };
      fetchSummit(V.lat, V.lon, { r: 400, api: API })
        .then((sm) => go(sm && sm.found ? { name: V.name[lang] || V.name.es, lat: sm.lat, lon: sm.lon, elev: sm.ground_m, summit: true } : { name: V.name[lang] || V.name.es, lat: V.lat, lon: V.lon }),
          () => go({ name: V.name[lang] || V.name.es, lat: V.lat, lon: V.lon }));
      if (ss) goTime(ss);
      const az = bearing(V.lat, V.lon, SANGAY.lat, SANGAY.lon);
      later(() => lookAA(2, az, 40), 1500);
      setTourView({ ...base, title: T.time.title, text: T.time.text(null), tip: T.time.tip });
    } else {
      // de vuelta a tu cielo: tu lugar y tu hora (los objetos se eligen con ellos)
      const s0 = tourSnap.current || {};
      const wasAway = !!(s0.away || s0.timeAway);
      if (wasAway) tourRestore();
      const d = s0.timeMoved ? new Date(s0.whenStr) : new Date();
      const loc = s0.localMode && s0.lat != null ? { lat: s0.lat, lon: s0.lon } : null;
      const altOf = (v) => (loc ? altAz(v[0], v[1], v[2], loc.lat, loc.lon, d).alt : null);
      const away = wasAway ? T.away : "";
      const focus = (v, span) => later(() => focusDir(v[0], v[1], v[2], span), wasAway ? 900 : 50);
      if (stop.id === "look") {
        setTourView({ ...base, title: T.look.title, text: T.look.text, tip: T.look.tip, fact: away });
      } else if (stop.id === "con") {
        const dirOf = (ab) => {
          const c = ref && ref.conCentroid && ref.conCentroid[ab]; if (!c || !c.idxs.length) return null;
          let x = 0, y = 0, z = 0; for (const k of c.idxs) { x += ref.posFlat[k * 3]; y += ref.posFlat[k * 3 + 1]; z += ref.posFlat[k * 3 + 2]; }
          const L = Math.hypot(x, y, z) || 1; return [x / L, y / L, z / L];
        };
        const ab = pickVisible(CANDIDATES.con, (a) => { const v = dirOf(a); return v ? altOf(v) : undefined; }) || "Ori";
        const v = dirOf(ab); if (v) focus(v, 75);
        const nm = nameOf("con", ab, lang);
        setTourView({ ...base, title: nm, text: T.con.text(nm), tip: T.con.tip, fact: away });
      } else if (stop.id === "star") {
        const find = (n) => sky && sky.stars.find((x) => x[7] === n);
        const nmK = pickVisible(CANDIDATES.star, (n) => { const st = find(n); return st ? altOf([st[1], st[2], st[3]]) : undefined; }) || "Sirius";
        const st = find(nmK);
        if (st) focus([st[1], st[2], st[3]], 45);
        const ly = st && Number.isFinite(st[6]) ? st[6] : null;
        setTourView({ ...base, title: nameOf("star", nmK, lang), text: ly ? T.star.text(ly, lang) : T.star.textNoDist, tip: T.star.tip,
          fact: [away, ly ? TC[lang].tourFactDist(fmtDist(ly, lang)) : ""].filter(Boolean).join(" · ") });
      } else if (stop.id === "planet") {
        const bs = skyBodies(ephemeris(d), d, loc ? { lat: loc.lat, lon: loc.lon, elev: s0.elev || 0 } : null);
        const nm = pickVisible(CANDIDATES.planet, (n) => { const b = bs.find((x) => x.name === n); return b ? altOf([b.nx, b.ny, b.nz]) : undefined; }) || "Júpiter";
        const b = bs.find((x) => x.name === nm);
        setShowSolar(true);
        if (b) focus([b.nx, b.ny, b.nz], 30);
        setTourView({ ...base, title: nameOf("planet", nm, lang), text: T.planet.text(nm === "Luna"), tip: T.planet.tip, fact: away });
      } else if (stop.id === "deep") {
        const objs = (datasetsRef.current.messier && datasetsRef.current.messier.objects) || [];
        const m = pickVisible(CANDIDATES.deep, (k) => { const o = objs.find((x) => x.m === k); return o ? altOf([o.nx, o.ny, o.nz]) : undefined; }) || 42;
        const o = objs.find((x) => x.m === m);
        if (o) { setEnabled((e) => ({ ...e, messier: true })); focus([o.nx, o.ny, o.nz], 25); }
        setTourView({ ...base, title: nameOf("deep", m, lang), text: T.deep.text(T.deep.kind[deepKind(o && o.type)], o && o.dist_ly ? fmtDist(o.dist_ly, lang) : ""), tip: T.deep.tip, fact: away });
      } else if (stop.id === "weather") {
        setTourView({ ...base, title: T.weather.title, text: loc ? T.weather.text : T.weather.textNoPlace, tip: loc ? T.weather.tip : null, target: loc ? "weather" : "place", fact: away });
      } else {
        setTourView({ ...base, title: T.tonight.title, text: T.tonight.text, tip: T.tonight.tip, fact: away, target: loc ? "tonight" : null });
      }
    }
    return () => { cancel = true; timers.forEach(clearTimeout); };
  }, [tourActive, tourIndex, tourDataReady, lang]);   // eslint-disable-line react-hooks/exhaustive-deps
  // el volcán en erupción que se ve desde la parada del tiempo: su columna simulada al atardecer
  useEffect(() => {
    if (!tourActive || TOUR_STOPS[tourIndex].scene !== "volcano" || !volcList || !hzData || plumeSim) return;
    const hot = eruptingInView(volcList, hzData, lat, lon, terrainAngleOf);
    const pick = hot.find((h) => { const v = volcList.find((x) => x.id === h.id); return v && /sangay/i.test(v.name); }) || hot[0];
    if (!pick) return;
    const v = volcList.find((x) => x.id === pick.id);
    setPlumeSim({ name: v.name, label: v.name, az: pick.az, alt: pick.alt, dist_km: +pick.dist_km.toFixed(1), ele_m: v.elev_m, lat: v.lat, lon: v.lon, volcano: v, volcanoChecked: true });
    const T = TOUR_T[lang] || TOUR_T.es;
    setTourView((tv) => (tv && tv.id === "time" ? { ...tv, text: T.time.text(v.name) } : tv));
    const r = sceneRef.current;
    if (r && r.lookAt) { const w = altAzToLocal(pick.alt + 3, pick.az); r.lookAt(new THREE.Vector3(w[0], w[1], w[2]), 40, true); }
  }, [tourActive, tourIndex, volcList, hzData, plumeSim, lat, lon, lang]);
  // el botón del que habla la parada, iluminado (atributo data-tour); en «Esta noche», también «Apuntar al cielo»
  const tourTarget = tourActive && tourView ? tourView.target : null;
  useEffect(() => {
    const st = stageRef.current; if (!st || !tourTarget) return undefined;
    const sel = `[data-tour="${tourTarget}"]` + (tourTarget === "tonight" ? ', [data-tour="point"]' : "");
    let els = [];
    const mark = () => { els.forEach((el) => el.classList.remove("sk-tour-hl")); els = [...st.querySelectorAll(sel)]; els.forEach((el) => el.classList.add("sk-tour-hl")); };
    mark();
    const id = setInterval(mark, 1000);   // los botones pueden aparecer después (la pastilla del tiempo) o volver a montarse
    return () => { clearInterval(id); els.forEach((el) => el.classList.remove("sk-tour-hl")); };
  }, [tourTarget]);
  // al salir del tour (por cualquier camino): tu lugar y tu hora de antes
  const tourWas = useRef(false);
  useEffect(() => {
    if (tourWas.current && !tourActive) { tourRestore(); tourSnap.current = null; setTourView(null); }
    tourWas.current = tourActive;
  }, [tourActive, tourRestore]);

  const onResult = useCallback((res) => {
    if (res.type === "loading") return;   // fila informativa, no navegable
    track("sky_search", { state: "ok", kind: res.type === "layer" ? res.layer : res.type === "con" ? "constellation" : res.type === "moon" ? "satellite" : res.type });   // nunca el texto buscado
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
    // un objeto Caldwell que vive en otra capa (p. ej. C77 = Centauro A en «Galaxias»): se abre allí, cuando cargue
    if (res.type === "layer" && res.obj && res.obj.in) {
      setEnabled(e => ({ ...e, [res.obj.in]: true }));
      pendingObjRef.current = res.obj.in + "~" + encodeURIComponent(res.obj.in_name);
      setHashTick(n => n + 1);
      return;
    }
    if (res.type === "con") { setSel(null); setDepth(0); setSelObj(conObjRef.current(res.ab)); }
    else if (res.type === "star") setSelObj(starObj(res.st, res.si));
    else if (res.type === "solar") { setShowSolar(true); setSelObj({ ...res.body, layer: "solar" }); }
    else if (res.type === "moon") { setShowSolar(true); setSelObj(res.obj); }
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
      if (dAz) nudgeArAlign(dAz > 0 ? 2 : -2);
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

  // postal para compartir (src/sky/postcard.js): se dibuja en 2D a 1080 × 1920 (9:16, historias)
  // con el visual del objeto, el cielo real a su alrededor, una cuadrícula de datos reales y
  // textos medidos que nunca se cortan.
  const buildShare = useCallback(() => {
    const ref = sceneRef.current;
    const date = new Date(whenStr);
    // el lugar va dentro de una frase («Desde tu ubicación · …»): las etiquetas genéricas, en minúscula
    const local = localMode && lat != null && lon != null ? { lat, lon, date, place: placeKind === "me" ? TC[lang].pcMyPlace : placeKind === "custom" ? TC[lang].pcCustomPlace : placeKind } : null;
    const loc = lang === "es" ? "es-EC" : "en-US";
    const tzo = local && placeTz ? { timeZone: placeTz } : {};   // la postal, en la hora del lugar
    const fmt = {
      dist: (d) => fmtDist(d, lang), years: (y) => fmtYears(y, lang), km: (k) => fmtKm(k, lang), dur: (x) => fmtDuration(x, lang),
      when: (d) => d.toLocaleString(loc, lang === "es" ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...tzo } : { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", ...tzo }),
      time: (d) => d.toLocaleTimeString(loc, lang === "es" ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...tzo } : { hour: "numeric", minute: "2-digit", ...tzo }),
    };
    const base = { lang, t: TC[lang], fmt, sky, conDirs, bodies: bodiesRef.current, local, showSolar: showSolar && !viewFrom, starHex: starTint };
    const so = selObj;
    const conAb = so && so.layer === "con" ? so.ab : (!so && sel ? sel : null);
    if (conAb) {
      const c = sky.constellations.find((x) => x.ab === conAb), d = c && constellationData(c, sky.stars);
      if (d) {
        const es = conNameEs(conAb);
        return buildPostcard({ ...base, con: { ab: conAb, title: c.la, type: `${TC[lang].conType} · ${lang === "es" ? (es || c.en) : c.en}`, dir: d.dir, radius: d.radius, stars: d.hips,
          near: d.near && { name: d.near.name, d: d.near.dist }, far: d.far && { name: d.far.name, d: d.far.dist },
          bright: d.stars[0] && { name: d.stars[0].name, mag: d.stars[0].mag } } });
      }
    }
    if (so && so.name && so.layer !== "note") {
      const live = so.layer === "solar" ? { ...so, ...(bodiesRef.current.find(b => b.name === so.name) || {}) } : so;
      const out = buildPostcard({ ...base, obj: live, info: describeObject(live, lang, TC[lang], false), wiki, credit });
      // pruebas en navegador (&e2e=1): el informe de la postal (líneas, casillas, bloques) queda a la vista
      if (E2E) out.then((r) => { window.__teseoPostcard = r && r.report; }).catch(() => {});
      return out;
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
    // la vista tal como se ve ahora (capas activas y nombres): la postal sin objeto la usa como fondo
    const view = ref ? snapshotView({ renderer: ref.renderer, scene: ref.scene, camera: ref.camera, labels: ref._labels, colors: LABEL_COLOR,
      cssW: mountRef.current ? mountRef.current.clientWidth : 0, cssH: mountRef.current ? mountRef.current.clientHeight : 0 }) : null;
    // fuentes de lo que se ve en la vista (relieve, nombres de montañas, nubes)
    const es = lang === "es", vc = [];
    if (view && hzData) vc.push(es ? "relieve AWS Terrain Tiles (SRTM)" : "terrain AWS Terrain Tiles (SRTM)");
    if (view && hzData && landData) vc.push(es ? "colores Sentinel-2 cloudless (EOX, CC BY 4.0)" : "colours Sentinel-2 cloudless (EOX, CC BY 4.0)");
    if (view && peakList && peakList.length) vc.push(es ? "nombres de montañas Wikidata y © OpenStreetMap" : "mountain names Wikidata and © OpenStreetMap");
    if (view && cloudsOn && wxData) vc.push(es ? "nubes Open-Meteo" : "clouds Open-Meteo");
    if (view && auView && auView.look.visible && auView.vis > 0.05) vc.push(auView.mode === "live" ? (es ? "auroras NOAA SWPC" : "aurora NOAA SWPC") : (es ? "aurora estimada (Kp NOAA)" : "estimated aurora (NOAA Kp)"));
    if (view && cloudsOn && satWeight(satData, new Date(whenStr).getTime() / 1000) > 0) vc.push(es ? `nubes de ahora ${satCredit(satData)}` : `clouds now ${satCredit(satData)}`);
    const out = buildPostcard({ ...base, center, view, viewCredit: vc.join(" · ") });
    if (E2E) out.then((r) => { window.__teseoPostcard = r && r.report; }).catch(() => {});
    return out;
  }, [selObj, sel, lang, wiki, credit, sky, conDirs, whenStr, localMode, lat, lon, placeKind, showSolar, viewFrom, vividStars, hzData, peakList, cloudsOn, wxData, placeTz, landData, satData, auView]);
  const openShare = useCallback(() => { setShareState(null); setShare(true); }, []);
  // «atrás» del teléfono (src/ui/backGuard.js): cierra lo que esté abierto, de lo más encima a lo más abajo
  const backRef = useRef({});
  // ── foto 360° (pano360.js): seis caras desde el observador → equirectangular con nombres y metadatos ──
  const [pano, setPano] = useState(false);
  const panoLabels = useCallback(() => {
    const ref = sceneRef.current, out = [], lq = ref.localQuat, v = new THREE.Vector3();
    const toAA = (x, y, z) => { v.set(x, y, z).applyQuaternion(lq); return altAzOf([v.x, v.y, v.z]); };
    if (ref.cardNames) for (let k = 0; k < 8; k++) out.push({ name: ref.cardNames[k], cls: k === 0 ? "cardn" : "card", alt: 1.2, az: k * 45 });
    for (const p of [...(ref.andLabels || []), ...(ref.monLabels || []), ...(ref.peakLabels || [])].slice(0, 36)) out.push({ name: p.label, cls: p.cls || "peak", alt: p.alt, az: p.az, subText: p.subText != null ? p.subText : p.ele_m });
    if (ref.showSolar) for (const b of (ref.bodies || [])) {
      if (ref.visOn && ref.solarVis && ref.solarVis[b.name] === false) continue;
      const a = toAA(b.nx, b.ny, b.nz); if (a.alt < -1) continue;
      out.push({ name: bodyName(b.name, ref.lang), cls: "solar", ...a });
    }
    const pa = ref.posAttr.array;
    if (ref.consOn !== false) for (const ab in ref.conCentroid) {
      const c = ref.conCentroid[ab]; if (!c.idxs.length) continue;
      let cx = 0, cy = 0, cz = 0;
      for (const i of c.idxs) { cx += pa[i * 3]; cy += pa[i * 3 + 1]; cz += pa[i * 3 + 2]; }
      const a = toAA(cx, cy, cz); if (a.alt < 3) continue;
      if (ref.hzData) { v.set(cx, cy, cz).normalize().applyQuaternion(lq); if (behindTerrain(ref.hzData, [v.x, v.y, v.z])) continue; }
      out.push({ name: c.name, cls: "con", ...a });
    }
    const sv = ref.visOn ? ref.starVis : null;
    for (let q = 0, n = 0; q < ref.namedStars.length && n < 60 && ref.namedStars[q].mag <= 2.8; q++) {
      const st = ref.namedStars[q]; if (sv && !sv[st.i]) continue;
      const a = toAA(pa[st.i * 3], pa[st.i * 3 + 1], pa[st.i * 3 + 2]); if (a.alt < 2) continue;
      out.push({ name: st.name, cls: "star", ...a }); n++;
    }
    return out;
  }, []);
  const buildPano = useCallback(async () => {
    const ref = sceneRef.current; if (!ref) throw new Error("sin escena");
    await new Promise((r) => setTimeout(r, 60));          // que se vea «Tomando la foto…» antes del trabajo
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const { W, H, face } = panoSize(navigator.deviceMemory, ref.renderer.capabilities.maxTextureSize || 4096, ios);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(ref.camera.quaternion);
    const heading = altAzOf([fwd.x, fwd.y, fwd.z]).az;    // la foto abre hacia donde mirabas
    // el relieve cercano con su imagen de alta definición (el doble por lado), solo mientras se toma la foto
    const hdUrl = near3 && near3.key === hzKey && near3.near ? near3.near.hdUrl : null;
    const restoreHd = hdUrl && ref.near3d.ready && ref.near3d.group.visible ? await ref.near3d.withTexture(hdUrl, 30000, Math.min(8, ref.renderer.capabilities.getMaxAnisotropy())) : null;
    if (!ref._sharpStar) ref._sharpStar = makeStarTexture(true);
    const u = ref.points.material.uniforms, saved = [u.uScale.value, u.uPx.value, u.uDpr.value, u.map.value];
    // un planeta, la Luna o el Sol en la costura entre dos caras (p. ej. a 45° de altura, entre una lateral y la de
    // arriba) quedaba cortado: la cara que no contiene su centro lo descartaba entero. Durante la foto, nada se descarta.
    const culled = [];
    ref.scene.traverse((o) => { if ((o.isSprite || o.isPoints || o.isMesh || o.isLine) && o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
    // planetas, Sol y Luna del tamaño de una vista de 90° en un teléfono (~800 px de alto), con el zoom que haya
    if (ref.sizeSolar) ref.sizeSolar({ fov: 90, h: 800 });
    const before = (cam) => {
      // estrellas del mismo tamaño aparente que en el teléfono; atmósfera y nubes centradas en el observador
      // …pero con un núcleo nítido: al hacer zoom en el visor se ven como un punto con su halo y no como una mancha
      // (la textura de la vista es un degradado suave de 64 px)
      u.uScale.value = starScaleFor(90); u.uPx.value = 1; u.uDpr.value = face / 1024; u.map.value = ref._sharpStar;
      // las caras miran justo al horizonte: el centro del suelo (bajo el observador) caería en su plano (w = 0)
      // y la GPU descartaría sus triángulos; 3 mm de corrimiento lo evitan sin que se note
      ref.horizon.position.set(0.003, 0, 0.003);
      if (ref.atm.visible) ref.atm.follow(cam);
      if (ref.clouds.visible) ref.clouds.follow(cam);
      if (ref.aurora && ref.aurora.visible) ref.aurora.follow(cam);
    };
    let restored = false;
    const after = () => {
      if (restored) return; restored = true;
      [u.uScale.value, u.uPx.value, u.uDpr.value, u.map.value] = saved;
      for (const o of culled) o.frustumCulled = true;
      if (ref.sizeSolar) ref.sizeSolar();
      if (restoreHd) restoreHd();
      ref.horizon.position.set(0, 0, 0);
      if (ref.atm.visible) ref.atm.follow(ref.camera);
      if (ref.clouds.visible) ref.clouds.follow(ref.camera);
      if (ref.aurora && ref.aurora.visible) ref.aurora.follow(ref.camera);
      if (ref.wake) ref.wake();
    };
    let faces, patches = [];
    try {
      faces = captureFaces({ THREE, renderer: ref.renderer, scene: ref.scene, near: ref.camera.near, far: ref.camera.far, size: face, before });
      // Sol, Luna y planetas: un recorte con la cámara apuntando justo a cada uno (si no, cerca del borde de una
      // cara salían como óvalos al desplegar la foto: ver capturePatches)
      const wanted = [];
      const addSp = (sp) => {
        if (!sp || !sp.visible || (sp.parent && !sp.parent.visible)) return;
        const pos = sp.getWorldPosition(new THREE.Vector3()), dist = pos.length();
        if (!(dist > 0)) return;
        const ws = sp.getWorldScale(new THREE.Vector3()), sz = Math.max(ws.x, ws.y);
        // con sizeAttenuation: false (Sol, Luna, planetas) la escala ya es el tamaño angular (radianes, a 1 de distancia)
        const diamDeg = THREE.MathUtils.radToDeg(sp.material && sp.material.sizeAttenuation === false ? sz : 2 * Math.atan2(sz / 2, dist));
        wanted.push({ dir: [pos.x / dist, pos.y / dist, pos.z / dist], fov: Math.min(40, Math.max(3, diamDeg * 1.9)) });
      };
      for (const nm in ref.solarSprites) addSp(ref.solarSprites[nm]);
      for (const nm in ref.realSprites) addSp(ref.realSprites[nm].sp);
      patches = capturePatches({ THREE, renderer: ref.renderer, scene: ref.scene, near: ref.camera.near, far: ref.camera.far, patches: wanted, pxPerDeg: face / 90, before });
    } finally { after(); }
    await new Promise((r) => setTimeout(r, 0));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.putImageData(pastePatches(equirectFromFaces(faces, W, H, heading), W, H, heading, patches), 0, 0);
    // nombres de ~1,6° de alto (como unos 16 px en el visor de un teléfono); sello de ~35° de ancho
    const f = (W / 4096) * 1.4;
    const measure = (text, cls) => { const st = labelStyle(cls); g.font = st.font; return g.measureText(st.upper ? String(text).toUpperCase() : String(text)).width * (st.spacing ? 1.15 : 1); };
    drawPanoLabels(g, layoutPanoLabels(panoLabels(), { W, H, heading, f, measure }), LABEL_COLOR, { W, f });
    const when = new Date(whenStr), tzo = placeTz ? { timeZone: placeTz } : {};
    const place = placeKind === "me" ? (lang === "es" ? "Mi ubicación" : "My location") : placeKind === "custom" ? `${lat.toFixed(2)}°, ${lon.toFixed(2)}°` : placeKind;
    const stamp = when.toLocaleString(lang === "es" ? "es-EC" : "en-US", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...tzo });
    const credits = panoCredits({ terrain: !!(ref.hzData && ref.terrain.group.visible), landsat: !!(ref.hzData && ref.terrain.group.visible && landData), peaks: !!(ref.peakLabels && ref.peakLabels.length), clouds: !!ref.clouds.visible, sat: ref.clouds.visible && satWeight(satData, new Date(whenStr).getTime() / 1000) > 0 ? satCredit(satData) : "", planets: !!ref.showSolar, andean: !!(ref.andLabels && ref.andLabels.some((p) => p.cls === "andsite")) }, lang);
    drawNadirStamp(g, { W, H, f: (W / 4096) * 1.7, lines: ["Teseo · teseo.yachaydeep.com", place, stamp], small: credits });
    const blob0 = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (!blob0) throw new Error("sin JPEG");
    const bytes = withGPano(new Uint8Array(await blob0.arrayBuffer()), { W, H, heading, title: `${lang === "es" ? "Cielo de" : "Sky from"} ${place} · ${stamp}`, credits });
    const p = tzParts(when, placeTz);
    return { blob: new Blob([bytes], { type: "image/jpeg" }), type: "image/jpeg", width: W, height: H, fileName: panoFileName(place, p) };
  }, [whenStr, placeTz, placeKind, lat, lon, lang, panoLabels, landData, satData, near3, hzKey]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeo("unsupported"); return; }
    setGeo("asking");
    const seq = ++placeSeq.current;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        let la = +pos.coords.latitude.toFixed(5), lo = +pos.coords.longitude.toFixed(5);
        // altitud del GPS si la da (muchos navegadores no): si no, 0 m y la interfaz lo dice
        let al = Number.isFinite(pos.coords.altitude) ? Math.round(pos.coords.altitude) : null;
        // ¿estás en una cima? El modelo de terreno redondea las puntas: te sube al punto más alto a tu alrededor
        // solo si es una cumbre y estás en ella (strict: ver /api/summit); si no, tu posición tal cual
        const acc = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 50;
        const sm = await fetchSummit(la, lo, { r: Math.max(60, Math.min(200, 2 * acc)), strict: true, api: API });
        if (seq !== placeSeq.current) return;
        let src = false;
        if (sm && sm.found) { la = sm.lat; lo = sm.lon; }
        if (al == null && sm) { al = sm.ground_m; src = "terrain"; }
        const top = !!(sm && sm.found);
        setLat(la); setLon(lo); setElev(al); setElevPreset(src); setPlaceFine(true); setPlaceSummit(top); setPlaceDefault(false);
        savePlace({ kind: "me", lat: la, lon: lo, elev: al, fine: true, ...(src ? { elevSrc: src } : {}), ...(top ? { summit: true } : {}) });
        tourAdopt(la, lo);
        track("sky_location", { kind: "gps" });
        setPlaceKind("me"); setLocalMode(true); setGeo("ok"); setSel(null);
        if (!isWideRef.current) setPanel(null);
      },
      (err) => setGeo(err && err.code === 1 ? "denied" : err && err.code === 3 ? "timeout" : "unavailable"),
      // alta precisión y sin posiciones viejas: en una cumbre, unas decenas de metros cambian el horizonte
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  }, []);
  const pickPlace = useCallback(async (p0) => {
    const seq = ++placeSeq.current;
    let p = p0, fine = !!p0.exact, src = p0.elev != null, top = false;
    if (p0.peak > 0) {
      // una montaña o un volcán: de pie en su cumbre (las coordenadas del buscador suelen ser aproximadas)
      const sm = await fetchSummit(p0.lat, p0.lon, { r: p0.peak, api: API });
      if (seq !== placeSeq.current) return;
      if (sm && sm.found) { p = { ...p0, lat: sm.lat, lon: sm.lon, elev: sm.ground_m }; fine = true; src = "terrain"; top = true; }
    }
    setLat(p.lat); setLon(p.lon); setElev(p.elev ?? null); setElevPreset(src); setPlaceFine(fine); setPlaceSummit(top); setPlaceDefault(false);
    savePlace({ kind: p.name, lat: p.lat, lon: p.lon, elev: p.elev ?? null, ...(fine ? { fine: true } : {}), ...(src === "terrain" ? { elevSrc: "terrain" } : {}), ...(top ? { summit: true } : {}) });
    tourAdopt(p.lat, p.lon);
    track("sky_location", { kind: "manual" });   // los atajos de ciudad cuentan como "manual"
    setPlaceKind(p.name); setLocalMode(true); setGeo("idle"); setSel(null);
    if (!isWideRef.current) setPanel(null);
  }, []);
  const setManualPlace = useCallback((a, o) => {
    ++placeSeq.current;
    setLat(+a.toFixed(4)); setLon(+o.toFixed(4)); setElev(null); setElevPreset(false); setPlaceFine(false); setPlaceSummit(false); setPlaceDefault(false);
    savePlace({ kind: "custom", lat: +a.toFixed(4), lon: +o.toFixed(4), elev: null });
    tourAdopt(+a.toFixed(4), +o.toFixed(4));
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
  // alinear a mano el norte (botones del menú de Controles y flechas del teclado): 2° por toque
  const nudgeArAlign = useCallback((deg) => { pointAzOffset = ((pointAzOffset + deg) % 360 + 540) % 360 - 180; setArAligned(Math.abs(pointAzOffset) > 0.05); }, []);
  // arrastrar mientras se apunta = pasar al modo manual (mirar con el dedo en todas direcciones).
  // Los sensores siguen escuchando para volver solo al levantar el teléfono hacia el cielo.
  const pauseAr = useCallback(() => { track("sky_ar", { state: "manual" }); setAr("paused"); setArCtl(false); }, []);
  const resumeAr = useCallback((how) => { track("sky_ar", { state: how === "raise" ? "resume_raise" : "resume" }); setAr("on"); }, []);
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
      const when = new Date(whenStr), vis = visibilityOf(live, { lat, lon, elev: elev || 0 }, when);
      const tzo = placeTz ? { timeZone: placeTz } : {};
      const hm = (d) => d.toLocaleTimeString(lang === "es" ? "es-EC" : "en-US", lang === "es" ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...tzo } : { hour: "numeric", minute: "2-digit", ...tzo });
      if (vis.now.alt > 0) text = tt.findShownUp(label, Math.round(vis.now.alt), compassPoint8(vis.now.az));
      else text = vis.rts.rise ? tt.findBelow(label, hm(vis.rts.rise.date)) : tt.findBelowNever(label);
    }
    setToast({ text, id: Date.now() });
  }, [lang, flyTo, localMode, lat, lon, elev, whenStr, viewFrom, placeTz]);
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
    if ((ar === "on" || ar === "paused") && (!localMode || lat == null || tourActive)) stopAr();
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
  // gestos mientras se apunta: arrastrar (en cualquier dirección) = pasar al modo manual, y el mismo dedo
  // sigue moviendo la vista sin soltarlo; pellizco = campo de visión. El toque corto sigue abriendo la ficha
  // (lo gestiona el efecto de selección de abajo). La alineación del norte va en Controles → Alinear.
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !arOn) return;
    const el = ref.renderer.domElement, st = ref.ar;
    const pts = new Map();
    let startX = 0, startY = 0, pinch0 = 0, span0 = 0, gone = false;
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const onDown = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ }
      if (pts.size === 1) { startX = e.clientX; startY = e.clientY; }
      else if (pts.size === 2) { pinch0 = dist(); span0 = st.span; }
    };
    const onMove = (e) => {
      const p = pts.get(e.pointerId); if (!p || gone) return;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const d = dist();
        if (pinch0 > 0 && d > 0) { st.span = Math.max(22, Math.min(110, span0 * pinch0 / d)); ref.applyArFov(); }
      } else if (pts.size === 1 && pinch0 === 0 && isDragToManual(e.clientX - startX, e.clientY - startY)) {
        // el gesto de "mirar desde dentro" adopta este mismo dedo, para que la vista siga al arrastre
        gone = true;
        ref.look.adopt = { id: e.pointerId, x: e.clientX, y: e.clientY };
        pauseAr();
      }
    };
    const onEnd = (e) => {
      if (!pts.delete(e.pointerId)) return;
      if (pts.size === 0) pinch0 = 0;
      if (pts.size === 1) { const r = [...pts.values()][0]; startX = r.x; startY = r.y; }
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
  }, [arOn, ready, pauseAr]);

  backRef.current = { pano, share, selObj, issSheet, tsOpen, panel, railOpen, ar, tourActive, welcomePlace };
  useEffect(() => {
    const onBack = (e) => {
      const b = backRef.current;
      if (b.pano) setPano(false);
      else if (b.share) setShare(false);
      else if (b.railOpen) setRailOpen(false);
      else if (b.selObj) setSelObj(null);
      else if (b.issSheet) setIssSheet(false);
      else if (b.tsOpen) setTsOpen(false);
      else if (b.panel && !b.welcomePlace) setPanel(null);
      else if (b.ar === "on" || b.ar === "paused") stopAr();
      else if (b.tourActive) setTourActive(false);
      else return;
      e.preventDefault();
    };
    window.addEventListener("teseo:back", onBack);
    return () => window.removeEventListener("teseo:back", onBack);
  }, [stopAr]);
  // modo manual tras arrastrar: volver a apuntar solo al levantar el teléfono hacia el cielo
  // (primero hay que bajarlo, para no volver en el acto; ver src/sky/arResume.js)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || ar !== "paused") return;
    const det = createResumeDetector(), q = [0, 0, 0, 0], lk = {};
    const id = setInterval(() => {
      const p = pointRef.current.pose;
      if (!p.fresh || document.visibilityState !== "visible") return;
      cameraQuat(q, p.alpha, p.beta, p.gamma, p.screen, 0);
      lookFromQuat(q[0], q[1], q[2], q[3], lk);
      if (det.update(lk.alt, performance.now(), !!ref.look.drag)) resumeAr("raise");
    }, 100);
    return () => clearInterval(id);
  }, [ar, ready, resumeAr]);

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
      let p = pts.get(e.pointerId);
      if (!p && active() && lk.adopt && lk.adopt.id === e.pointerId && pts.size === 0) {
        // viene de "Apuntar al cielo": el dedo que arrastraba pasa a mover la vista sin soltarlo
        p = { x: lk.adopt.x, y: lk.adopt.y }; pts.set(e.pointerId, p);
        lastX = lk.adopt.x; lastY = lk.adopt.y; lastT = performance.now();
        lk.fly = null; lk.vy = lk.vp = 0; lk.drag = true; lk.adopt = null;
      }
      if (!p || !active()) return;
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
    if (!isWideRef.current) { setSelObj(null); setIssSheet(false); }
  }, []);
  const toggleLayer = useCallback((key) => {
    setLayerError(p => (p[key] ? { ...p, [key]: false } : p));
    track("sky_layer", { layer: key, state: enabled[key] ? "off" : "on" });
    setEnabled(e => ({ ...e, [key]: !e[key] }));
  }, [enabled]);
  const onStageKey = useCallback((e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (share) setShare(false); else if (railOpen) setRailOpen(false); else if (pick) setPick(null); else if (panel) setPanel(null); else if (selObj) setSelObj(null); else if (issSheet) setIssSheet(false); else if (peakSheet) setPeakSheet(null); else if (monSheet) setMonSheet(null); else if (guide) setGuide(null); else if (toast) setToast(null); else if (full) setFull(false);
  }, [panel, selObj, full, railOpen, guide, pick, toast, share, issSheet, peakSheet, monSheet]);

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
        // en un sitio con suelo propio, lo que queda bajo el suelo o detrás del terreno y los muros no se puede tocar
        if (ref.monGround && ref.localModeOn && ref.localQuat) {
          const L0 = vtmp.length() || 1, dy = vtmp.y / L0;
          const hzd = ref.hzData;
          if (dy < -0.008) return;
          if (hzd && hzd.alt && hzd.alt.length) {
            const nH = hzd.alt.length, stH = hzd.step_deg || 360 / nH, azH = ((Math.atan2(vtmp.x, -vtmp.z) * 180 / Math.PI) % 360 + 360) % 360;
            if (Math.asin(Math.max(-1, Math.min(1, dy))) * 180 / Math.PI < hzd.alt[Math.round(azH / stH) % nH]) return;
          }
        }
        if (!screenOf(ref.camera, vtmp, r.width, r.height, mode, sp)) return;
        if (Math.abs(sp.x - px) > 120 || Math.abs(sp.y - py) > 120) return;  // lejos del dedo: ni se considera
        cands.push({ sx: sp.x, sy: sp.y, r: rObj, prio, make, label, kind });
      };
      const L = ref.lang, kinds = TC[L].kinds;
      // prioridades (px de ventaja para desempatar): Sol, Luna y planetas > objetos con nombre > estrellas débiles
      if (ref.showSolar) for (const b of (ref.bodies || [])) consider(b.nx * 860, b.ny * 860, b.nz * 860, ref.solarSprites[b.name] ? ref.solarSprites[b.name].userData.discPx : 12, 10, () => ({ ...b, layer: "solar" }), bodyName(b.name, L), kinds.solar);
      if (ref.showSolar && ref.moonGroup && ref.moonGroup.visible) for (const m of (ref.moonSky || [])) {
        if (m.state === "hidden") continue;
        consider(m.dir[0] * 860, m.dir[1] * 860, m.dir[2] * 860, 5, 11, () => moonObjFrom(ref.bodies, m.key, new Date(whenRef.current || Date.now())), moonName(m.key, L), TC[L].kindMoonOther);
      }
      for (const o of (ref.layerObjs || [])) {
        if (!o.points.visible) continue;
        const objs = o.points.userData.objs || [], kind = (LAYERS.find(l => l.key === o.key) || {})[L] || o.key;
        // al acercarse (vista de telescopio) se puede elegir también lo que no se ve a simple vista: está en la foto
        const ov = ref.visOn ? (ref.camera.fov < TELE_FOV ? o.points.userData.tele : o.points.userData.vis) : null;
        for (let i = 0; i < objs.length; i++) { if (ov && !ov[i]) continue; const ob = objs[i]; consider(ob.nx * 870, ob.ny * 870, ob.nz * 870, 0, isNotable(o.key, ob, ref.when) ? 6 : 1, () => ({ ...ob, layer: o.key }), labelForObj(o.key, ob, L), kind); }
      }
      // la ISS: su punto ya está en coordenadas del mundo (marco local), con la máxima prioridad
      const issW = ref.issLayer && ref.issLayer.dotWorld(selW.clone());
      if (issW && screenOf(ref.camera, issW, r.width, r.height, mode, sp)) cands.push({ sx: sp.x, sy: sp.y, r: 10, prio: 12, iss: true, make: () => ({ layer: "iss" }), label: "ISS", kind: (ISS_TX[L] || ISS_TX.es).issSheetTitle });
      const pa = ref.posAttr.array, stars = sky.stars;
      for (let i = 0; i < stars.length; i++) {
        if (!stars[i][7]) continue;                              // solo estrellas con nombre propio
        if (ref.visOn && !ref.starVis[i]) continue;              // con atmósfera o montañas: solo las que se ven
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
          if (lb.cls.startsWith("guide_")) continue;               // las marcas de las líneas guía no se tocan
          const cw = lb.cls === "con" ? (r.width >= 900 ? 12.5 : 11) : lb.cls === "solar" ? (r.width >= 900 ? 9 : 8) : (r.width >= 900 ? 7.8 : 6.9);
          const w = String(lb.name).length * cw + 14, dx = lb.dx || 8;
          if (lb.pk && (lb.pk.peak || lb.pk.mon)) {
            // nombre de una montaña: centrado encima de su cumbre (el texto y su altura, a 2–46 px sobre el punto)
            const dyp = py < lb.y - 50 ? lb.y - 50 - py : py > lb.y + 4 ? py - lb.y - 4 : 0;
            if (Math.abs(px - lb.x) <= w / 2 + 6 && dyp <= (touch ? 8 : 2) && dyp < bestDy) { bestDy = dyp; lbHit = lb; }
            continue;
          }
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
        else if (lbHit.pk && lbHit.pk.iss) o = { layer: "iss" };
        else if (lbHit.pk && lbHit.pk.mon) { setPick(null); setSelObj(null); setIssSheet(false); setPeakSheet(null); setMonSheet(lbHit.pk.mon); track("sky_monument", { id: lbHit.pk.mon.id }); return; }
        else if (lbHit.pk && lbHit.pk.peak) { setPick(null); setSelObj(null); setIssSheet(false); setPeakSheet(lbHit.pk.peak); track("sky_peak", { volcano: !!lbHit.pk.peak.volcano }); return; }
        else if (lbHit.pk && lbHit.pk.ob) o = { ...lbHit.pk.ob, layer: lbHit.pk.layer };
        if (o && o.layer === "iss") { openIssRef.current(); return; }
        if (o) { setPick(null); if (o.layer === "con") setSel(null); setSelObj(o); return; }
      }
      // la ISS se mueve: si gana ella, su ficha directamente (sin la lista de objetos amontonados)
      if (best && best.iss) { setPick(null); openIssRef.current(); return; }
      if (best) {
        // varios objetos prácticamente en el mismo punto (p. ej. Marte y sus orbitadores): se deja elegir
        if (same.length > 1) { setPick(same.slice(0, 8).map((h) => ({ label: h.label, kind: h.kind, make: h.make }))); setSelObj(null); if (!isWideRef.current) setPanel(null); }
        else { setPick(null); const o = best.make(); if (o.layer === "iss") openIssRef.current(); else setSelObj(o); }
        return;
      }
      setPick(null);
      if (ref.ar.on && !isWideRef.current && !selObjRef.current && !panelRef.current) setArCtl(v => !v);
      setSelObj(null); setIssSheet(false); if (!isWideRef.current) setPanel(null);
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
    const sheet = !!selObj || issSheet || !!peakSheet || !!monSheet;
    if (isWide) { if (sheet) x += 208; if (panel) x -= 198; if (!sheet && !panel && sel && !localMode) x -= 196; }   // la tarjeta de profundidad va a la izquierda
    else if (sheet) yf = 0.24;
    else if (panel) yf = 0.3;
    else if (tourActive) yf = 0.14;
    else if (sel && !localMode) yf = 0.21;      // tarjeta de profundidad sobre el dock (con sus opciones)
    ref.viewShift.x = x; ref.viewShift.yf = yf;
  }, [selObj, panel, tourActive, isWide, ready, sel, localMode, issSheet, peakSheet, monSheet]);

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
  // la barra de distancias de la ficha, también en «profundidad real»
  const dvBar = useMemo(() => (selMeta && sky ? constellationData(selMeta, sky.stars) : null), [selMeta, sky]);
  const selStarN = selMeta ? new Set(selMeta.lines.flat()).size : 0;
  const sortedCons = useMemo(() => (sky ? [...sky.constellations].sort((a, b) => a.la.localeCompare(b.la)) : []), [sky]);
  const failedLayers = LAYERS.filter(c => layerError[c.key]);
  const layersOn = LAYERS.filter(c => enabled[c.key]).length;
  // el objeto del sistema solar se refresca con las efemérides del momento elegido
  const liveObj = useMemo(() => {
    if (!selObj) return null;
    let o = selObj;
    if (selObj.layer === "solar") { const b = bodies.find(x => x.name === selObj.name); if (b) o = { ...selObj, ...b }; }
    if (selObj.layer === "moon") { const mo = moonObjFrom(bodies, selObj.name, new Date(whenStr)); if (mo) o = mo; }   // sigue a su planeta al pasar el tiempo
    // con atmósfera: ¿se ve ahora a simple vista? (solo para lo que tiene magnitud; bajo el horizonte lo dice la ficha)
    if (atmState && o.nx != null && o.mag != null && o.name !== "Sol" && (o.layer === "solar" || o.layer === "star" || MAG_LAYERS.has(o.layer))) {
      try {
        const a = altAzJ2000(o.nx, o.ny, o.nz, lat, lon, new Date(whenStr));   // o.nx…: J2000, como la escena
        if (a.alt > 0) o = { ...o, atmVis: visibility({ mag: o.mag + (MAG_LAYERS.has(o.layer) ? extPenalty(o.layer, o) : 0), alt: a.alt, az: a.az }, atmState).visible };
      } catch { /* no-op */ }
    }
    return o;
  }, [selObj, bodies, atmState, lat, lon, whenStr]);
  const when = new Date(whenStr);
  const tzPlace = placeKind === "me" || placeKind === "custom" ? null : placeKind;   // «Hora de Nagarkot»
  const placeLabel = placeKind === "me" ? t.myLocation : placeKind === "custom" ? t.customPlace : placeDefault ? t.placeDefault(placeKind) : placeKind;
  const tourReady = !!(ready && datasets.messier && datasets.blackholes);
  const issSheetOn = !!(issSheet && issSel && issSel.pass && !selObj);
  const covered = !isWide && (!!selObj || !!panel || !!pick || issSheetOn || !!peakSheet || !!monSheet);
  useEffect(() => { if (welcomePlace && sky) setPanel("location"); }, [!!sky]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (welcomePlace && !placeDefault) { endWelcome(); setPanel(null); } }, [placeDefault]);   // eslint-disable-line react-hooks/exhaustive-deps
  const showDepth = !!(sky && selMeta && !localMode && !tourActive);
  const showOnboard = !!(showHint && sky && !selObj && !issSheetOn && !panel && !tourActive && !showDepth && !arOn);
  // barra de "Apuntar al cielo": invitación (dentro de Mi cielo), indicador activo o aviso de error
  const arBar = !sky || tourActive ? null : arOn ? "on" : ar === "paused" ? "paused" : arError ? "error" : null;
  // la columna de la derecha también al mirar arrastrando en el teléfono (sin la barra de abajo)
  // (también en el ordenador: los mismos botones que en el teléfono)
  const railView = !!(sky && !arBar);   // también durante el tour: sus botones se iluminan
  useEffect(() => { if (arBar !== "on" && arBar !== "paused" && !railView) setTsOpen(false); }, [arBar, railView]);
  // el menú «…» y la columna comparten el lado derecho: con el menú abierto, la columna (y el tiempo) se apartan
  useEffect(() => { if (railOpen) setTsOpen(false); }, [railOpen]);
  const immersive = arOn && !isWide;          // teléfono apuntando: el cielo ocupa toda la pantalla
  const inMySky = localMode && lat != null;
  // "Esta noche": solo se calcula con el panel abierto
  const tonight = useMemo(() => {
    if (panel !== "tonight" || !localMode || lat == null || lon == null) return null;
    const res = computeTonight({ date: new Date(whenStr), lat, lon, elev: elev || 0, ephemeris,
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
  // (con una pasada de la ISS en el cielo no: su propio aviso ya dice si es de día, y taparía la píldora)
  const dayWarn = !!(atmActive && atmState && starsHidden(atmState) && !dayHidden && !arOn && !tourActive && !issSel);
  const dayPlanets = useMemo(() => {
    if (!dayWarn) return null;
    const d = new Date(whenStr);
    return bodies.filter((b) => b.body === "planet" && b.mag != null).filter((b) => { const a = altAz(b.eqDate[0], b.eqDate[1], b.eqDate[2], lat, lon, d); return a.alt > 0 && visibility({ mag: b.mag, alt: a.alt, az: a.az }, atmState).visible; }).map((b) => bodyName(b.name, lang));
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
      srcNote={bortleSrc === "estimate" ? BORTLE_EST_T[lang] || BORTLE_EST_T.es : bortleSrc === "set" ? BORTLE_EST_T[lang === "en" ? "enSet" : "esSet"] : bortleSrc === "measured" ? BORTLE_EST_T[lang === "en" ? "enMeasured" : "esMeasured"] : null}
      bortle={bortle} onBortle={setBortle} onBortleCommit={() => track("sky_setting", { setting: "light_pollution", state: "ok" })}
      state={atmState} mags={skyMags} visibleNow={atmActive ? atmInfo.stars : null}
      elevation={localActive ? { m: elev, preset: elevPreset } : null}
      deepNote={atmActive && atmInfo.deep != null && atmInfo.deepTot ? t.deepNote(atmInfo.deep, atmInfo.deepTot) : null} />
  );
  // noche (Sol bajo −12°) en una hora dada, para el gráfico de nubes y la mejor hora de observar
  const isNight = useMemo(() => {
    if (lat == null || lon == null) return null;
    const memo = new Map();
    return (sec) => {
      const k = Math.round(sec / 600);
      if (!memo.has(k)) { const d = new Date(k * 600000), sn = ephemeris(d).find((b) => b.name === "Sol"); memo.set(k, altAz(sn.nx, sn.ny, sn.nz, lat, lon, d).alt < -12); }
      return memo.get(k);
    };
  }, [lat, lon]);
  // salida y puesta del Sol del día que empieza en s0 (s Unix, medianoche local), para la tarjeta del tiempo
  const sunDay = useMemo(() => {
    if (lat == null || lon == null) return null;
    const dirAt = (d) => { const sn = ephemeris(d).find((b) => b.name === "Sol"); return [sn.nx, sn.ny, sn.nz]; };
    const memo = new Map();
    return (s0) => {
      if (!memo.has(s0)) { try { memo.set(s0, riseTransitSet(dirAt, lat, lon, new Date(s0 * 1000), { minAlt: H0_SUN })); } catch { memo.set(s0, null); } }
      return memo.get(s0);
    };
  }, [lat, lon]);
  const terrainCtl = (
    <TerrainControl lang={lang} available={localActive && !viewFrom} on={terrainOn} lift={summitLift}
      onToggle={() => { const nv = !terrainOn; setTerrainOn(nv); track("sky_setting", { setting: "horizon", state: nv ? "on" : "off" }); }}
      hz={hzKey ? (hz.key === hzKey ? hz : { status: "loading" }) : null} onRetry={() => setHzRetry((n) => n + 1)}
      sat={hzKey ? (land.key === hzKey ? land.status : "loading") : null}
      peaksOn={peaksOn} peaks={peaksOn && hzData ? (pk.key === hzKey ? pk : { status: "loading" }) : null}
      monOn={monOn} onToggleMon={() => { const nv = !monOn; setMonOn(nv); track("sky_setting", { setting: "monuments", state: nv ? "on" : "off" }); }}
      monNear={monNear} monStatus={monKey ? (monBase.key === monKey ? monBase.status : "loading") : null}
      onTogglePeaks={() => { const nv = !peaksOn; setPeaksOn(nv); track("sky_setting", { setting: "peaks", state: nv ? "on" : "off" }); }}
      andOn={andOn} andean={andean} onToggleAnd={() => { const nv = !andOn; setAndOn(nv); track("sky_setting", { setting: "andean", state: nv ? "on" : "off" }); }} />
  );
  const auroraCtl = (
    <AuroraControl lang={lang} available={localActive && !viewFrom} on={auroraOn}
      onToggle={() => { const nv = !auroraOn; setAuroraOn(nv); track("sky_setting", { setting: "aurora", state: nv ? "on" : "off" }); }}
      info={auView ? { ...auView, status: auKey && au.key === auKey && (au.status === "loading" || au.status === "error") && !auData ? au.status : "ok" } : { status: auKey ? au.status : "idle" }}
      onRetry={() => setAuRetry((n) => n + 1)} lat={lat} lon={lon} tz={placeTz} when={new Date(whenStr)} dp={auView ? auView.dp : null} kpSeries={auKpSeries}
      onPickNight={(t) => { track("sky_aurora", { kind: "night" }); setPlaying(false); setTimeMoved(true); setWhenStr(fmtInput(t)); if (!isWide) setPanel(null); }} />
  );
  const wxPill = wxNow && localMode && !viewFrom ? (() => {
    // el icono de ahora; con poca probabilidad, la lluvia o la tormenta solo como marca pequeña (wxIcon)
    const ic = wxIcon(wxNow.code, wxNow.day, wxNow.pop, wxNow.cloud), k = ic.kind;
    const nm = `${(WX_NAMES[lang] || WX_NAMES.es)[k]}${ic.maybe ? ` · ${(WX_MAYBE[lang] || WX_MAYBE.es)[ic.maybe]}` : ""}`;
    // la temperatura de ahora: la mediana de los modelos (si hay al menos 3), como en la tarjeta
    const mt = wxMod ? tempAt(wxMod, Date.now() / 1000) : null, tNow = mt && mt.n >= 3 ? mt.med : wxNow.temp;
    return (
      <button ref={wxPillRef} type="button" data-tour="weather" className="sk-chip sk-wx-pill" aria-expanded={wxOpen} aria-haspopup="dialog"
        onClick={() => { setWxWanted(true); setMountOpen(false); setWxOpen((o) => { if (!o) track("sky_weather_card", { kind: "open" }); return !o; }); }}
        aria-label={`${nm}, ${fmtTemp(tNow)}${wxNow.windKmh != null ? `. ${windText(wxNow, lang)}` : ""} · ${placeLabel}`}
        title={`${nm}${wxNow.windKmh != null ? ` · ${windText(wxNow, lang)}` : ""} · ${placeLabel}`}>
        <WxIco ic={ic} size={18} /><span>{fmtTemp(tNow)}</span>
        {wxNow.windKmh != null && (
          // el icono dice que es el viento; de dónde viene, en la tarjeta
          <span className="sk-wx-wind"><Icon name="wind" size={13} />{fmtWind(wxNow.windKmh)}</span>
        )}
        <Icon name="chevron_down" size={15} className="sk-wx-chev" />
      </button>
    );
  })() : null;
  // la brújula: junto a la temperatura; abre «Estacionar montura»
  const compassChip = localMode && !viewFrom && lat != null && lon != null ? (
    <CompassChip lang={lang} apiRef={compassApiRef} chipRef={compassChipRef} arOn={arOn} arSrc={arSrc} open={mountOpen}
      onClick={() => { setWxOpen(false); setMountOpen((o) => { if (!o) track("sky_mount", { kind: "open" }); return !o; }); }} />
  ) : null;
  const wxPanel = (
    <WeatherPanel lang={lang} available={localActive && !viewFrom} atmOn={atmOn}
      on={cloudsOn} onToggle={() => { const nv = !cloudsOn; setCloudsOn(nv); track("sky_setting", { setting: "clouds", state: nv ? "on" : "off" }); }}
      fc={wxKey ? (wx.key === wxKey ? wx : { status: "loading" }) : null} onRetry={() => setWxRetry((n) => n + 1)}
      onMount={() => setWxWanted(true)} onSat={() => track("sky_setting", { setting: "satellite", state: "on" })}
      when={new Date(whenStr)} isNow={!timeMoved} isNight={isNight} lat={lat} lon={lon} pointHours={wxNow ? wxNow.hours : null} tz={placeTz}
      placeName={placeKind === "me" ? (lang === "es" ? "Tu lugar" : "Your place") : placeKind === "custom" ? null : placeKind} />
  );
  const tonightGo = (it) => {
    if (!isWide) setPanel(null);
    // de día la lista es la del anochecer: el cielo se lleva a esa hora para que coincida
    if (tonight && tonight.shifted) { setPlaying(false); setTimeMoved(true); setWhenStr(fmtInput(tonight.evalDate)); }
    if (it.kind === "planet" || it.kind === "moon") {
      const d = tonight ? tonight.evalDate : new Date(whenStr);
      const b = skyBodies(ephemeris(d), d, { lat, lon, elev: elev || 0 }).find(x => x.name === it.key);   // en J2000, como la escena
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
  const localInfo = useMemo(() => (inMySky ? { lat, lon, elev: elev || 0, place: placeLabel, horizon: hzData, tz: placeTz } : null), [inMySky, lat, lon, elev, placeLabel, hzData, placeTz]);
  const northText = !decl ? null : !decl.valid ? t.declOff : decl.zone === "ok" ? t.declOn(decl.decl) : t.declCaution;
  const selCon = liveObj && liveObj.layer === "con" && sky ? sky.constellations.find(c => c.ab === liveObj.ab) : null;
  const conData = useMemo(() => (selCon ? constellationData(selCon, sky.stars) : null), [selCon, sky]);
  // objetos de los catálogos cargados que caen en la constelación (los que traen el campo `const`)
  const conInside = useMemo(() => {
    if (!selCon) return [];
    const out = [];
    for (const key of ["messier", "caldwell", "galaxies"]) {
      const ds = datasets[key]; if (!ds || !ds.objects) continue;
      for (const o of ds.objects) if (o.const === selCon.ab && !o.in) out.push({ layer: key, obj: o, label: labelForObj(key, o, lang) });
    }
    return out;
  }, [selCon, datasets.messier, datasets.caldwell, datasets.galaxies, lang]);   // eslint-disable-line react-hooks/exhaustive-deps
  const showActions = !!(sky && (!tourActive || (tourView && tourView.id === "tonight")) && !arOn && ar !== "paused" && !arError && inMySky && !covered && !showOnboard && !viewFrom && !showDepth);
  // compartiendo en el teléfono, el visor pasa a pantalla completa: la vista previa necesita todo el alto
  const stageClass = "sk-stage" + (full || immersive || (share && !isWide) ? " is-full" : "") + (immersive ? " is-immersive" : "") + (arOn && arCtl ? " ar-ctl" : "") + (covered ? " is-covered" : "") + (selObj || issSheetOn ? " has-sheet" : "") + (railView ? " has-rail" : "")
    + (tourActive ? " has-tour" : "") + (showDepth ? " has-depth" : "") + (issSel ? " has-isspill" : "") + (arOn ? " is-ar" : "") + (panel ? " has-panel" : "");
  const bumpCtl = arOn && arCtl ? () => setCtlBump(n => n + 1) : undefined;

  return (
    <div ref={wrapRef} className="sk-wrap">
    <div ref={stageRef} className={stageClass} onKeyDown={onStageKey} onPointerDownCapture={bumpCtl}>
      <div ref={mountRef} className="sk-canvas" role="application" tabIndex={0} onKeyDown={onCanvasKey} aria-label={t.canvasAria} />
      {/* créditos siempre a la vista: una captura de pantalla los lleva (una página no puede detectar la captura) */}
      {sky && (
        <p className="sk-credit" aria-hidden="true">
          <b>Teseo</b> · teseo.yachaydeep.com
          <small>{shortCredits({ terrain: !!(inMySky && hzData), landsat: !!(inMySky && hzData && landData), peaks: !!(peakList && peakList.length), clouds: !!(inMySky && cloudsOn && wxData), sat: inMySky && cloudsOn && satWeight(satData, new Date(whenStr).getTime() / 1000) > 0 ? satCredit(satData) : "", planets: showSolar, andean: !!(inMySky && andean && andean.sites.length), aurora: auView && auView.look.visible && auView.vis > 0.05 ? (auView.mode === "live" ? "live" : "kp") : null }, lang)}</small>
        </p>
      )}
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

      {sky && onMenu && !isWide && (
        <button type="button" className="sk-menu-btn" onClick={onMenu} aria-label={TC[lang].menuOpen || "Menú"} title={TC[lang].menuOpen || "Menú"}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      )}
      {sky && (
        <div className={`sk-top${onMenu && !isWide ? " has-menu" : ""}`}>
          <SearchBox t={t} query={query} setQuery={setQuery} results={results} onResult={onResult} quick={quick} compact={!isWide} />
          {dayWarn && <DayWarning lang={lang} planets={dayPlanets} onNightfall={goNightfall}
            onAtmOff={() => { setAtmOn(false); track("sky_setting", { setting: "atmosphere", state: "off" }); }} onDismiss={hideDayWarn} />}
          {(viewFrom || outside || (isWide && localMode) || issSel || plumeSim || (isWide && wxPill)) && (
            <div className="sk-chips">
              {issSel && (
                <IssPill lang={lang} apiRef={issHudRef} pass={issSel.pass} loading={issSel.status === "loading"} playing={playing && issOn} rate={issRate}
                  onOpen={issOn ? openIss : () => {}} onTogglePlay={toggleIssPlay} onRate={cycleIssRate} onRemove={() => removeIss()} />
              )}
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
              {plumeSim && (() => {
                const VTl = VOLC_T[lang] || VOLC_T.es, vei = plumeSim.volcano && Number.isFinite(plumeSim.volcano.last_vei) ? plumeSim.volcano.last_vei : 2;
                return (
                  <div className="sk-chip tone-violet sk-sim-chip">
                    <span>{VTl.simChip(plumeSim.label || plumeSim.name, vei, String(veiColumnKm(vei)).replace(".", lang === "es" ? "," : "."), plumeSim.volcano ? (Number.isFinite(plumeSim.volcano.last_end) ? plumeSim.volcano.last_end : Number.isFinite(plumeSim.volcano.last_start) ? plumeSim.volcano.last_start : null) : null, !!(plumeSim.volcano && plumeSim.volcano.erupting))}{wxNow && wxNow.windKmh != null ? ` · ${windText(wxNow, lang)}` : ""}</span>
                    <button type="button" onClick={() => setPlumeSim(null)}>{VTl.simStop}</button>
                  </div>
                );
              })()}
              {isWide && compassChip}
              {isWide && wxPill}
            </div>
          )}
        </div>
      )}

      {/* en el teléfono, el tiempo de ahora va arriba, entre el buscador y el botón «…» (solo icono y temperatura) */}
      {sky && !isWide && (wxPill || compassChip) && <div className="sk-wx-float">{compassChip}{wxPill}</div>}
      {sky && compassChip && mountOpen && (
        <MountSheet lang={lang} lat={lat} lon={lon} tz={placeTz} marks={mountMarks} decl={decl} arOn={arOn} api={API}
          onStartAr={() => { setMountOpen(false); startAr(); }}
          onLook={(alt, az, span) => {
            const r = sceneRef.current; if (!r || !r.lookAt) return;
            const v = altAzToLocal(alt, az);
            setMountOpen(false); setMountPeek(true);
            r.lookAt(new THREE.Vector3(v[0], v[1], v[2]), span, false); if (r.wake) r.wake();
            track("sky_mount", { kind: "look" });
          }}
          onGround={(m) => { setFlatMode(m); track("sky_mount", { kind: `ground_${m}` }); }}
          anchorRef={compassChipRef} stageRef={stageRef} onClose={() => { setMountOpen(false); setMountPeek(false); }} />
      )}
      {sky && flatMode && <FlatPhone lang={lang} mode={flatMode} lat={lat} lon={lon} tz={placeTz} decl={decl && decl.valid ? decl.decl : 0} hz={hzData} onClose={() => setFlatMode(null)} />}
      {sky && wxPill && wxOpen && (
        <WxCard lang={lang} now={wxNow} mod={wxMod} fc={wxKey ? (wx.key === wxKey ? wx : { status: "loading" }) : null} sat={satData}
          rainDrawn={!!(atmSky && atmSky.wx && atmSky.wx.rain > 0.02)}
          cloudsOn={cloudsOn} canDraw={localActive && !viewFrom && atmOn}
          onToggleClouds={() => { const nv = !cloudsOn; setCloudsOn(nv); track("sky_setting", { setting: "clouds", state: nv ? "on" : "off" }); }}
          isNight={isNight} sunDay={sunDay} tz={placeTz} skyT={new Date(whenStr).getTime() / 1000} skyIsNow={!timeMoved}
          onPickHour={(t) => { track("sky_time", { kind: "weather_card" }); setPlaying(false); setTimeMoved(true); setWhenStr(fmtInput(new Date(t * 1000))); }}
          onNow={tsNow}
          anchorRef={wxPillRef} stageRef={stageRef} onClose={() => setWxOpen(false)} />
      )}
      {sky && (
        <div ref={railRef} className={`sk-rail${railOpen ? " is-open" : ""}`}>
          <button type="button" className="sk-rail-toggle" onClick={() => setRailOpen(o => !o)} aria-expanded={railOpen} aria-label={railOpen ? t.moreClose : t.more} title={t.more}><Icon name={railOpen ? "close" : "dots"} size={21} /></button>
          <button type="button" onClick={() => zoomBy(0.8)} aria-label={t.zoomIn} title={t.zoomIn}><Icon name="plus" size={22} /></button>
          <button type="button" onClick={() => zoomBy(1.25)} aria-label={t.zoomOut} title={t.zoomOut}><Icon name="minus" size={22} /></button>
          <span className="sk-rail-gap is-extra" aria-hidden="true" />
          {!arOn && <button type="button" className={`is-extra${selObj ? " is-on" : ""}`} onClick={() => { recenter(); setRailOpen(false); }} aria-label={selObj ? t.centerObj : t.centerView} title={selObj ? t.centerObj : t.centerView}><Icon name="target" size={20} /></button>}
          <button type="button" className="is-extra" onClick={() => { openShare(); setRailOpen(false); }} aria-label={t.postcardAria} title={t.postcardAria}><Icon name="camera" size={20} /></button>
          {inMySky && <button type="button" className="is-extra sk-pano-btn" onClick={() => { track("sky_pano360", { state: "open" }); setPano(true); setRailOpen(false); }} aria-label={t.pano360Aria} title={t.pano360Aria}><Icon name="pano" size={20} /></button>}
          {!immersive && <button type="button" className={`is-extra${full ? " is-on" : ""}`} onClick={() => { track("sky_fullscreen", { state: full ? "off" : "on" }); setFull(f => !f); setRailOpen(false); }} aria-pressed={full} aria-label={full ? t.fullOff : t.fullOn} title={full ? t.fullOff : t.fullOn}><Icon name={full ? "shrink" : "expand"} size={20} /></button>}
          {/* el pie de la app no se ve en esta pestaña: los créditos y «Teseo en números» se abren desde aquí */}
          <button type="button" className="is-extra" onClick={() => { setRailOpen(false); window.dispatchEvent(new CustomEvent("teseo:credits")); }} aria-label={t.credits} title={t.credits}><Icon name="info" size={20} /></button>
          <button type="button" className="is-extra" onClick={() => { track("support_open", { from: "sky" }); window.location.href = lang === "en" ? "/about#apoya" : "/acerca#apoya"; }} aria-label={t.support} title={t.support}><Icon name="heart" size={20} /></button>
        </div>
      )}

      {showDepth && (
        <section className="sk-depth" aria-label={t.depthTitle(selMeta.la)}>
          <div className="sk-depth-head">
            <h2>{t.depthTitle(selMeta.la)}</h2>
            <button type="button" className="sk-iconbtn" onClick={() => { const co = conObj(sel); setSel(null); setDepth(0); if (co) setSelObj(co); }} aria-label={t.conSheet} title={t.conSheet}><Icon name="info" size={18} /></button>
            <button type="button" className="sk-iconbtn" onClick={() => { setSel(null); setDepth(0); }} aria-label={t.wholeSky} title={t.wholeSky}><Icon name="close" size={18} /></button>
          </div>
          <div className="sk-depth-angle"><span>{t.dvAngle}</span><b>{Math.round(depth * 90)}°</b></div>
          <input type="range" min="0" max="1" step="0.01" value={depth}
            onChange={e => setDepth(parseFloat(e.target.value))}
            aria-label={t.depthAria} aria-valuetext={`${t.dvAngle} ${Math.round(depth * 90)}°`} />
          <div className="sk-depth-ends">
            <span className={depth < 0.5 ? "on" : ""}>{t.flat}</span>
            <span className={depth >= 0.5 ? "on" : ""}>{t.dvSide} 90°</span>
          </div>
          <div className="sk-depth-opts">
            <div role="group" aria-label={t.dvMain}>
              <button type="button" aria-pressed={dvMain} onClick={() => setDvMain(true)}>{t.dvMain}</button>
              <button type="button" aria-pressed={!dvMain} onClick={() => setDvMain(false)}>{t.dvAll(selStarN)}</button>
            </div>
            <div role="group" aria-label={t.dvReal}>
              <button type="button" aria-pressed={dvReal} onClick={() => setDvReal(true)}>{t.dvReal}</button>
              <button type="button" aria-pressed={!dvReal} onClick={() => setDvReal(false)}>{t.dvComp(dvAutoK)}</button>
            </div>
          </div>
          {depth > 0.3 && <p className="sk-depth-note">{dvReal ? t.dvScaleNote.real : t.dvScaleNote.comp(dvAutoK)} {t.dvErr}</p>}
          {stats && stats.far.d > 0 && !(dvBar && dvBar.near && dvBar.far && dvBar.far.dist > dvBar.near.dist) && (
            <div className="sk-depth-stats">
              <span>{t.nearest}: <b>{stats.near.name || "—"}</b> {stats.near.d.toLocaleString(lang === "es" ? "es" : "en-US")} {t.lightyears}</span>
              <span>{t.farthest}: <b>{stats.far.name || "—"}</b> {stats.far.d.toLocaleString(lang === "es" ? "es" : "en-US")} {t.lightyears}</span>
            </div>
          )}
          {dvBar && dvBar.near && dvBar.far && dvBar.far.dist > dvBar.near.dist && (
            <div className="sk-depth-bar">
              <div className="sk-depth-bar-ends"><span>{t.nearest}</span><span>{t.farthest}</span></div>
              <DepthBar stars={dvBar.stars} near={dvBar.near} far={dvBar.far} lang={lang} named />
              {dvBar.ratio >= 1.5 && <p>{t.conRatio(num(dvBar.ratio, lang, dvBar.ratio < 10 ? 1 : 0))}</p>}
            </div>
          )}
        </section>
      )}

      {/* mirando arrastrando (teléfono y ordenador): la columna de la derecha, como al apuntar, en lugar de la barra de abajo */}
      {railView && !covered && !railOpen && (
        <ArRail lang={lang} timeOpen={tsOpen} timeMoved={timeMoved} placeOn={localMode} layersOn={layersOn}
          onTime={() => setTsOpen((v) => !v)} onPlace={() => { setTsOpen(false); openPanel("location"); }}
          onLayers={() => { setTsOpen(false); openPanel("layers"); }} onTour={() => { setTsOpen(false); startTour(); }} tourReady={tourReady} />
      )}
      {railView && tsOpen && !covered && (
        <TimeSheet lang={lang} date={when} lat={localMode ? lat : null} lon={localMode ? lon : null} tz={placeTz} place={tzPlace} isNow={!timeMoved} rateIdx={rateIdx}
          onRate={setRate} onStep={tsStep} onNow={tsNow} onNight={tsNight} onSetMinute={tsMinute} onClose={() => setTsOpen(false)} />
      )}
      {sky && !tourActive && siteStops && inMySky && !panel && !selObj && !peakSheet && !monSheet && !issSheet && !full && !pano && (
          <nav className={`sk-stops${railView ? " is-rail" : ""}`} aria-label={t.stopsAria}>
            <div className="sk-stops-row">
              {siteStops.stops.map((s0) => (
                <button type="button" key={s0.id} className={`sk-stop${s0.id === siteStops.here ? " is-here" : ""}`} aria-current={s0.id === siteStops.here ? "location" : undefined}
                  onClick={() => { if (s0.id === siteStops.here) return; goStop(s0, "strip"); }}>
                  {s0.name[lang] || s0.name.es}
                </button>
              ))}
            </div>
          </nav>
        )}
      {sky && !tourActive && !railView && (
        <Dock t={t} panel={panel} onPanel={openPanel} localMode={localMode} tourReady={tourReady} onTour={startTour}
          timeLabel={timeMoved ? fmtWhenShort(when, lang, localMode ? placeTz : null) : t.now} isNow={!timeMoved} playing={playing}
          layersOn={layersOn} layersWarn={failedLayers.length > 0} mySkyLabel={!isWide && inMySky ? placeLabel : null} />
      )}

      {sky && tourActive && tourView && !covered && (
        <TourCard tt={TOUR_T[lang] || TOUR_T.es} view={tourView} index={tourIndex} total={TOUR_STOPS.length}
          onPrev={() => setTourIndex((i) => Math.max(0, i - 1))}
          onNext={() => { if (tourIndex >= TOUR_STOPS.length - 1) { track("sky_tour", { state: "done" }); setTourActive(false); } else setTourIndex((i) => i + 1); }}
          onExit={() => { track("sky_tour", { state: tourIndex >= TOUR_STOPS.length - 1 ? "done" : "skip" }); setTourActive(false); }} />
      )}

      {arBar && (
        <PointingBar t={t} mode={arBar} source={arSrc} error={arError} aligned={arAligned} apiRef={arHudRef}
          onStart={startAr} onExit={stopAr} onReset={resetArAlign} onNudge={nudgeArAlign} onResume={() => resumeAr("button")} onDismiss={() => setArError(null)} canRetry={arCapable}
          ctl={arCtl} onCtl={() => setArCtl(v => !v)} help={false} onZoom={zoomBy} north={northText}
          onLayers={() => openPanel("layers")} onTonight={() => openPanel("tonight")}
          onSearch={() => { const i = stageRef.current && stageRef.current.querySelector(".sk-search input"); if (i) i.focus(); }} />
      )}
      {(arBar === "on" || arBar === "paused") && !covered && !railOpen && (
        <ArRail lang={lang} timeOpen={tsOpen} onTime={() => { setTsOpen((v) => !v); setArCtl(false); }}
          onPlace={() => { setTsOpen(false); openPanel("location"); }} onLayers={() => { setTsOpen(false); openPanel("layers"); }}
          onSearch={() => { setTsOpen(false); const i = stageRef.current && stageRef.current.querySelector(".sk-search input"); if (i) i.focus(); }} />
      )}
      {(arBar === "on" || arBar === "paused") && tsOpen && !covered && (
        <TimeSheet lang={lang} date={when} lat={lat} lon={lon} tz={placeTz} place={tzPlace} isNow={!timeMoved} rateIdx={rateIdx}
          onRate={setRate} onStep={tsStep} onNow={tsNow} onNight={tsNight} onSetMinute={tsMinute} onClose={() => setTsOpen(false)} />
      )}
      {arOn && guide && <GuideHud t={t} label={guide.label} apiRef={guideApiRef} onStop={() => setGuide(null)} />}
      {showActions && panel !== "tonight" && <SkyActions t={t} onTonight={() => openPanel("tonight")} onPoint={arCapable && ar === "off" ? startAr : null} />}

      {showOnboard && <Onboarding t={t} onDone={dismissHint} onTour={startTour} tourReady={tourReady} />}

      {sky && panel === "layers" && (
        <LayersPanel t={t} lang={lang} layers={LAYERS} datasets={datasets} enabled={enabled} loadingLayer={loadingLayer} layerError={layerError}
          onToggle={toggleLayer} onRetry={loadLayer} showSolar={showSolar} onToggleSolar={() => setShowSolar(v => !v)}
          consOn={consOn} onToggleCons={() => { const nv = !consOn; setConsOn(nv); track("sky_setting", { setting: "lines", state: nv ? "on" : "off" }); }}
          constellations={sortedCons} sel={sel} onPick={onPick} labelDensity={labelDensity} onDensity={(v) => { track("sky_setting", { setting: "labels", state: "ok" }); setLabelDensity(v); }}
          vivid={vividStars} onVivid={() => setVividStars(v => !v)} atmosphere={<>{atmControls}{terrainCtl}{wxPanel}{auroraCtl}</>}
          guides={<GuidesControls lang={lang} value={guidesOn} localAvailable={localActive} onToggle={(k, on) => { track("sky_setting", { setting: "guides", state: on ? "on" : "off" }); toggleGuide(k, on); }} />}
          outside={outside} onOutside={inMySky ? null : () => { setOutside(o => !o); setSel(null); setDepth(0); if (!isWideRef.current) setPanel(null); }}
          preset={presetOf(enabled, LAYERS.map((c) => c.key), showSolar)}
          onPreset={(id) => { const st = presetState(id, LAYERS.map((c) => c.key)); if (!st) return; track("sky_setting", { setting: "layer_group", state: id }); setLayerError({}); setEnabled((e) => ({ ...e, ...st })); setShowSolar(true); }}
          onClose={() => setPanel(null)} notes={notes} onNote={openNote} />
      )}
      {sky && panel === "location" && (
        <LocationPanel t={t} localMode={localMode} lat={lat} lon={lon} placeName={placeLabel} geo={geo}
          lang={lang} onUseMyLocation={useMyLocation} places={PLACES} onPlace={pickPlace} onManual={setManualPlace}
          welcome={welcomePlace} onSkip={() => { track("sky_location", { kind: "skip" }); endWelcome(); setPanel(null); }}
          onExit={leaveMySky} onClose={() => { if (welcomePlace) endWelcome(); setPanel(null); }} onTonight={() => setPanel("tonight")}
          pointing={arCapable ? { state: ar, onStart: ar === "off" ? startAr : stopAr } : null} />
      )}
      {sky && panel === "tonight" && (
        <TonightPanel t={t} lang={lang} data={tonight} placeName={placeLabel} timeZone={placeTz} onGo={tonightGo}
          onFind={arCapable ? tonightFind : null}
          onGoTime={(d) => { setPlaying(false); setTimeMoved(true); setWhenStr(fmtInput(d)); }}
          onClose={() => setPanel(null)}
          iss={lat != null && lon != null ? { lat, lon, altM: elev || 0, onShow: showIss } : null} />
      )}
      {sky && panel === "time" && (
        // el mismo control de tiempo que en el teléfono (tipo Stellarium), sobre la barra de abajo
        <TimeSheet lang={lang} date={when} lat={localMode ? lat : null} lon={localMode ? lon : null} tz={placeTz} place={tzPlace} isNow={!timeMoved} rateIdx={rateIdx}
          onRate={setRate} onStep={tsStep} onNow={tsNow} onNight={tsNight} onSetMinute={tsMinute} onClose={() => setPanel(null)}
          docked extra={issOn ? (
            <div className="sk-quick sk-iss-rates" role="group" aria-label={ISS_TX[lang].issSheetTitle}>
              {ISS_RATES.map((r) => (
                <button key={r} type="button" aria-pressed={issRate === r} onClick={() => setIssRate(r)} aria-label={ISS_TX[lang].issSpeedAria(r)}>
                  {ISS_TX[lang].issSpeed(r)}{r === 1 ? ` · ${ISS_TX[lang].issRealTime}` : ""}
                </button>
              ))}
            </div>
          ) : null} />
      )}

      {liveObj && !selCon && (
        <ObjectSheet obj={liveObj} lang={lang} t={t} wiki={wiki} wikiState={wikiState} credit={credit}
          meteorActive={liveObj.layer === "meteors" && meteorActive(liveObj, when, placeTz)}
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

      {issSheetOn && (
        <IssSheet t={t} lang={lang} pass={issSel.pass} data={issSel.data} onClose={() => setIssSheet(false)} onCenter={centerIss} onRemove={() => removeIss()} />
      )}
      {monSheet && !selObj && (
        <MonSheet t={t} lang={lang} mon={monSheet} onClose={() => setMonSheet(null)} here={!!(monSheet.stop && siteStops && siteStops.here === monSheet.stop.id)}
          onGo={monSheet.stop ? () => { const s0 = monSheet.stop, nm = monSheet.name; setMonSheet(null); goStop(s0, "card", nm); } : null} />
      )}
      {peakSheet && !selObj && (
        <PeakSheet t={t} lang={lang} peak={peakSheet} onClose={() => setPeakSheet(null)}
          simulating={!!plumeSim && (plumeSim.label || plumeSim.name) === (peakSheet.label || peakSheet.name)} onStop={() => { setPlumeSim(null); setPeakSheet(null); }}
          onGo={() => { const pk0 = peakSheet; setPeakSheet(null); pickPlace({ name: pk0.label || pk0.name, lat: pk0.lat, lon: pk0.lon, elev: null, peak: 400 }); }}
          onSimulate={() => {
            const pk0 = peakSheet, ref = sceneRef.current; setPeakSheet(null); setPlumeSim(pk0);
            track("sky_eruption_sim", { vei: pk0.volcano ? pk0.volcano.last_vei : null });
            // encuadrar el volcán con su columna: el ángulo de la columna sobre la cumbre, y algo de margen
            if (ref && ref.lookAt) {
              const PP = plumeParams(pk0.volcano ? pk0.volcano.last_vei : 2, "sim"), D = Math.max(1, pk0.dist_km);
              const up = Math.atan2(PP.H, D) * 180 / Math.PI, wide = Math.atan2(PP.len * 0.6, D) * 180 / Math.PI;
              const v = altAzToLocal(pk0.alt + up * 0.45, pk0.az);
              ref.lookAt(new THREE.Vector3(v[0], v[1], v[2]), Math.max(16, Math.min(110, Math.max(up * 2.4, wide * 2.2))));
              if (ref.wake) ref.wake();
            }
          }} />
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
              <li key={i}><button type="button" className="sk-result" onClick={() => { const o = h.make(); setPick(null); if (o.layer === "iss") { openIss(); return; } if (o.layer === "solar") setShowSolar(true); setSelObj(o); }}>
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
      {pano && sky && (
        <ShareDialog t={t} name={null} build={buildPano} onClose={() => setPano(false)} onCopyLink={shareLink} linkState={shareState}
          shareText={t.pano360Text} title={t.pano360Title} making={t.pano360Making} alt={t.pano360Alt} hint={t.pano360Hint}
          metric={{ event: "sky_pano360", params: {} }} />
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
// sharp: para la foto 360° (más grande y con el núcleo más definido: un punto con un halo tenue)
function makeStarTexture(sharp = false) {
  const S = sharp ? 256 : 64, h = S / 2;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  if (sharp) {
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.13, "rgba(255,255,255,1)");
    g.addColorStop(0.24, "rgba(255,255,255,0.8)");
    g.addColorStop(0.4, "rgba(255,255,255,0.32)");
    g.addColorStop(0.62, "rgba(255,255,255,0.1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
  } else {
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.85)");
    g.addColorStop(0.5, "rgba(255,255,255,0.25)");
    g.addColorStop(1, "rgba(255,255,255,0)");
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const tex = new THREE.Texture(c); tex.needsUpdate = true;
  return tex;
}
