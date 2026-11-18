import { useState, useEffect, useRef, useCallback, useMemo, useId, lazy, Suspense } from "react";
// loadSky separado para poder recrear el componente lazy al reintentar: React.lazy
// memoriza un import fallido, así que "Reintentar" necesita un lazy nuevo.
const loadSky = () => import("./Constellations.jsx");
const Constellations = lazy(loadSky);
// Pestaña "Preguntas": también en su propio chunk (no engorda el arranque).
const loadQuestions = () => import("./questions/Questions.jsx");
const QuestionsLazy = lazy(loadQuestions);
import QuestionsBoundary from "./questions/Boundary.jsx";
// "Ahora en el espacio": lanzamientos, naves a Marte y asteroides, en su chunk.
const loadNow = () => import("./now/Now.jsx");
const NowLazy = lazy(loadNow);
// «Teseo en números»: la vista pública de uso (src/usage/), en su chunk; solo se descarga al abrirla.
const loadUsage = () => import("./usage/UsageModal.jsx");
const UsageLazy = lazy(loadUsage);
import SectionBoundary from "./ui/SectionBoundary.jsx";
// "¿Y la Luna? ¿Y el Sol?": cálculo en el cliente, aparte de Ruta y Ventanas (src/special/)
import MoonSun from "./special/MoonSun.jsx";
import { TS } from "./special/i18n.js";
// «Trayectoria realista (Lambert)»: tarjeta aparte bajo los detalles técnicos de Ruta (src/route/)
import RealTrajectory from "./route/RealTrajectory.jsx";
import { TR } from "./route/i18n.js";
// «Catapultas» (asistencias gravitatorias): tarjeta bajo la trayectoria realista (src/route/)
import GravityAssists from "./route/GravityAssists.jsx";
import MgaPlanner from "./route/MgaPlanner.jsx";
import { GA } from "./route/i18n-assists.js";
import { MGA } from "./route/i18n-mga.js";
// Geometría del dibujo de la ruta en el mapa: media elipse de Hohmann con ángulos reales
import { ORBIT_R, hohmannPlan, pathD, placeLabel, routeDates } from "./route/hohmannMap.js";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { fetchJson, isAbort, TIMEOUT_MS, TIMEOUT_AI_MS } from "./net.js";
import PlanetSphere from "./ui/PlanetSphere.jsx";
import { AU_KM, helioPosition, approxDistanceKm, hohmannLocal, launchWindowsLocal } from "./ui/orbits.js";
import { DAY_MS, parseISO, daysUntil, durationParts, relParts } from "./ui/time.js";
import Intro from "./intro/Intro.jsx";
import { createAmbient, STORAGE_KEY as AMBIENT_KEY } from "./ui/ambient.js";
import { pickLang, canonicalFor, searchWithLang } from "./ui/seo.js";
import { parseHash, hashBelongsTo, hashForTab, hashForQuestion, usageHash } from "./ui/hash.js";
import { track, startSession, trackNetError } from "./ui/track.js";
import { installBackGuard, wantsGuard, showExitToast } from "./ui/backGuard.js";
import {
  IconRoute, IconWindows, IconSky, IconLight, IconProbe, IconRocket, IconPlane,
  IconSwap, IconChevron, IconRetry, IconClose, IconInfo, IconArrow,
} from "./ui/icons.jsx";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// En producción apunta al backend en Railway/Render.
// En desarrollo, Vite proxea /api → localhost:8000
const API = import.meta.env.VITE_API_URL || "";

// ─── i18n ────────────────────────────────────────────────────────────────────
// Todo texto visible vive aquí, en ES y EN. Las entradas con datos variables
// son funciones.

const T = {
  en: {
    tagline:        "Interplanetary navigation",
    skip:           "Skip",
    skipIntro:      "Skip intro",
    switchLang:     "Cambiar a español",
    ambientOn:      "Ambient music",
    ambientOff:     "Turn off ambient music",
    nightOn:        "Night vision (red light)",
    nightOff:       "Turn off night vision",
    sections:       "Sections",
    menu:           "Menu",
    menuClose:      "Close menu",
    menuOpen:       "Open menu: sections, music, night vision and language",
    origin:         "From",
    destination:    "To",
    choose:         (label, name) => `${label}: ${name}. Change`,
    swap:           "Swap origin and destination",
    route:          "Route",
    now:            "Now",
    windows:        "Windows",
    sky:            "Sky",
    questions:      "Questions",
    loadingQuestions: "Loading questions…",
    questionsErrTitle: "This section could not be shown",
    questionsErrBody: "The Questions tab failed to load. Check your connection and try again; the rest of Teseo keeps working.",
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
    mapNote:        "Tap a planet to go there. Sizes are not to scale. The line is the Hohmann route for the next window: real angles, compressed distances.",
    mapNoteSpecial: "Tap a planet to go there. Sizes and distances are not to scale; the thread is schematic.",
    mapNoWindow:    "No launch window available: the line leaves today.",
    mapDep:         (d) => `Departure: ${d}`,
    mapArr:         (d) => `Arrival: ${d}`,
    mapRouteLabel:  (from, to, dep, arr) => `Hohmann route from ${from} to ${to}: departure ${dep}, arrival ${arr}. The destination is drawn as an outline where it will be on arrival.`,
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

    // Ahora en el espacio (entrada; el contenido vive en src/now/)
    nowTitle:       "Right now in space",
    nowSub:         "The Sun today, the sky calendar, the ISS, upcoming launches, spacecraft bound for Mars and nearby asteroids. Live data.",
    nowShow:        "Show",
    nowHide:        "Hide",
    nowLoading:     "Loading live data…",
    nowErrTitle:    "This section could not be shown",
    nowErrBody:     "“Right now in space” failed to load. Check your connection and try again; the rest of Teseo keeps working.",
    skipToContent:  "Skip to content",

    // Pie y créditos
    madeBy:         "Made by Yachay Deep Labs",
    coopWith:       "In cooperation with Killa Ñan · Community astronomy",
    allianceShort:  "with Killa Ñan",
    introCredit:    "Yachay Deep Labs × Killa Ñan · Community astronomy",
    whoTitle:       "Who makes Teseo",
    whoYd:          ["Yachay Deep Labs", "Develops Teseo. Cayambe, Ecuador."],
    whoKn:          ["Killa Ñan · Community astronomy", "Non-profit community astronomy project born in Cayambe (Ecuador) on 15 July 2018 and now present in several cities in the country. Teseo is built in cooperation with Killa Ñan."],
    whoLinks:       { web: "Website", fb: "Facebook", ig: "Instagram" },
    creditsGroups:  "Data sources by institution",
    creditsLink:    "Credits and data",
    usageLoading:   "Loading Teseo in numbers…",
    usageErrTitle:  "Teseo in numbers did not load",
    usageErrBody:   "Check your connection and try again. The rest of Teseo keeps working.",
    creditsTitle:   "Credits and data sources",
    creditsIntro:   "Teseo uses real data from official sources. MIT-licensed code.",
    creditsNote:    "Distances to deep-sky objects and pulsars are published values with uncertainty; they are shown as approximations.",
    privacyNote:    "Privacy: Teseo also counts, anonymously and in aggregate, which features are used (daily totals only), with no cookies and no personal data. Google Analytics is used only if you accept it in the cookie notice.",
    close:          "Close",
    credits: [
      { g: "Space agencies", items: [
        ["NASA · JPL", "Horizons (planets, comets and probes, live; orbits of 19 moons of other planets) · CNEOS (near-Earth asteroids) · SSD satellite physical parameters"],
        ["NASA · other centres", "Exoplanet Archive (live) · GSFC eclipse tables · Image and Video Library · Planetary Fact Sheet · SDO (the Sun today)"],
        ["ESA", "Gaia DR3 (black holes Gaia BH1–BH3) · Planck 2018 (dark matter and dark energy) · ESA/Webb and ESA/Hubble images (CC BY 4.0)"],
      ]},
      { g: "Observatories and scientific collaborations", items: [
        ["LIGO · Virgo · KAGRA", "GWTC-4.0 gravitational-wave catalogue"],
        ["ESO (European Southern Observatory)", "Images of nebulae and galaxies from Chile (CC BY 4.0)"],
        ["Event Horizon Telescope", "Images of M87* and Sagittarius A*"],
        ["SILSO · Royal Observatory of Belgium", "Official daily sunspot number"],
        ["CSIRO (Australia)", "ATNF Pulsar Catalogue"],
        ["DESI · SH0ES · LUX-ZEPLIN · CERN", "Expansion of the universe and dark-matter searches (published results)"],
        ["SPARC (Case Western Reserve U.)", "Rotation curve of NGC 3198"],
      ]},
      { g: "Measurement institutes and Earth data", items: [
        ["NIST (USA)", "CODATA constants · Atomic Spectra Database (spectral lines)"],
        ["NOAA · British Geological Survey", "World Magnetic Model WMM2025 (compass)"],
        ["NOAA SWPC (space weather)", "Active solar regions, X-ray flares (GOES), Kp index, solar cycle"],
        ["IAU · IERS", "Astronomical constants, the 88 official constellations, Earth orientation"],
        ["Clouds and weather", "Open-Meteo.com forecast (CC BY 4.0) · satellite images: NASA GIBS (GOES GeoColor by NOAA/CIRA, VIIRS) and EUMETSAT (Meteosat)"],
        ["Terrain (real horizon)", "AWS Terrain Tiles (Mapzen): NASA SRTM, USGS GMTED2010, NOAA ETOPO1 and others"],
      ]},
      { g: "Catalogues, tracking and community", items: [
        ["Stars and distances", "HYG Database v4.1 (Hipparcos) · CC BY-SA"],
        ["Constellation figures", "Stellarium western/modern · CC BY-SA"],
        ["Clusters, nebulae and galaxies", "OpenNGC (CC BY-SA 4.0) · SEDS Messier · Caldwell catalogue (P. Moore, 1995) + Magellanic Clouds · Caldwell distances: NASA Hubble Caldwell catalog, Baumgardt & Vasiliev 2021 (globular clusters), Pietrzyński et al. 2019 (LMC), Graczyk et al. 2020 (SMC) and other published papers · distances from redshift (approx.)"],
        ["Meteor showers", "International Meteor Organization (IMO)"],
        ["International Space Station", "CelesTrak orbital elements · SGP4"],
        ["Upcoming launches", "Launch Library 2 · The Space Devs"],
        ["Ephemerides and sky", "Paul Schlyter · J. Meeus · Bortle scale · Schaefer atmosphere model"],
        ["Planetary textures", "Solar System Scope (CC BY 4.0), NASA · moons: USGS Astrogeology global mosaics from Viking, Galileo, Voyager and Cassini images (public domain)"],
        ["Fact sheets and images", "Wikipedia · CC BY-SA"],
      ]},
      { g: "Software", items: [
        ["Orbital mechanics", "hapsira · astropy · sgp4"],
        ["Narrative", "Groq (Llama models) — narrates, never calculates"],
        ["3D rendering", "Three.js · MIT"],
      ]},
    ],
  },
  es: {
    tagline:        "Navegación interplanetaria",
    skip:           "Saltar",
    skipIntro:      "Saltar la introducción",
    switchLang:     "Switch to English",
    ambientOn:      "Música ambiental",
    ambientOff:     "Apagar la música ambiental",
    nightOn:        "Visión nocturna (luz roja)",
    nightOff:       "Quitar la visión nocturna",
    sections:       "Secciones",
    menu:           "Menú",
    menuClose:      "Cerrar el menú",
    menuOpen:       "Abrir el menú: secciones, música, visión nocturna e idioma",
    origin:         "Origen",
    destination:    "Destino",
    choose:         (label, name) => `${label}: ${name}. Cambiar`,
    swap:           "Intercambiar origen y destino",
    route:          "Ruta",
    now:            "Ahora",
    windows:        "Ventanas",
    sky:            "Cielo",
    questions:      "Preguntas",
    loadingQuestions: "Cargando preguntas…",
    questionsErrTitle: "No se pudo mostrar esta sección",
    questionsErrBody: "La pestaña Preguntas no terminó de cargar. Revisa tu conexión y vuelve a intentarlo; el resto de Teseo sigue funcionando.",
    au:             "UA",
    days:           "días",

    mapLabel:       "Mapa del sistema solar hoy. Toca un planeta para viajar hacia él.",
    mapPick:        (name) => `Viajar a ${name}`,
    mapIsOrigin:    (name) => `${name}, tu origen. Toca para intercambiarlo con el destino`,
    mapIsDest:      (name) => `${name}, tu destino`,
    mapNasa:        "Posiciones de hoy: NASA JPL",
    mapLocal:       "Posiciones de hoy: cálculo local aproximado",
    mapLoading:     "Cargando posiciones reales…",
    mapNote:        "Toca un planeta para ir allí. Los tamaños no están a escala. La línea es la ruta de Hohmann de la próxima ventana: ángulos reales, distancias comprimidas.",
    mapNoteSpecial: "Toca un planeta para ir allí. Tamaños y distancias no están a escala; el hilo es esquemático.",
    mapNoWindow:    "No hay ventana de lanzamiento disponible: la línea sale hoy.",
    mapDep:         (d) => `Salida: ${d}`,
    mapArr:         (d) => `Llegada: ${d}`,
    mapRouteLabel:  (from, to, dep, arr) => `Ruta de Hohmann de ${from} a ${to}: salida ${dep}, llegada ${arr}. El destino se dibuja con contorno donde estará al llegar.`,
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

    nowTitle:       "Ahora en el espacio",
    nowSub:         "El Sol de hoy, el calendario del cielo, la ISS, próximos lanzamientos, naves rumbo a Marte y asteroides cercanos. Datos en vivo.",
    nowShow:        "Ver",
    nowHide:        "Ocultar",
    nowLoading:     "Cargando datos en vivo…",
    nowErrTitle:    "No se pudo mostrar esta sección",
    nowErrBody:     "“Ahora en el espacio” no terminó de cargar. Revisa tu conexión y vuelve a intentarlo; el resto de Teseo sigue funcionando.",
    skipToContent:  "Saltar al contenido",

    madeBy:         "Desarrollado por Yachay Deep Labs",
    coopWith:       "En cooperación con Killa Ñan · Astronomía comunitaria",
    allianceShort:  "con Killa Ñan",
    introCredit:    "Yachay Deep Labs × Killa Ñan · Astronomía comunitaria",
    whoTitle:       "Quiénes hacen Teseo",
    whoYd:          ["Yachay Deep Labs", "Desarrolla Teseo. Cayambe, Ecuador."],
    whoKn:          ["Killa Ñan · Astronomía comunitaria", "Proyecto de astronomía comunitaria sin fines de lucro nacido en Cayambe (Ecuador) el 15 de julio de 2018 y presente hoy en varias ciudades del país. Teseo se hace en cooperación con Killa Ñan."],
    whoLinks:       { web: "Sitio web", fb: "Facebook", ig: "Instagram" },
    creditsGroups:  "Fuentes de datos por institución",
    creditsLink:    "Créditos y datos",
    usageLoading:   "Cargando Teseo en números…",
    usageErrTitle:  "No se pudo abrir «Teseo en números»",
    usageErrBody:   "Revisa tu conexión y vuelve a intentarlo. El resto de Teseo sigue funcionando.",
    creditsTitle:   "Créditos y fuentes de datos",
    creditsIntro:   "Teseo usa datos reales de fuentes oficiales. Código con licencia MIT.",
    creditsNote:    "Las distancias de objetos lejanos y púlsares son valores publicados con incertidumbre; se muestran como aproximaciones.",
    privacyNote:    "Privacidad: Teseo cuenta además, de forma anónima y agregada, qué funciones se usan (solo totales por día), sin cookies ni datos personales. Google Analytics solo se usa si lo aceptas en el aviso de cookies.",
    close:          "Cerrar",
    credits: [
      { g: "Agencias espaciales", items: [
        ["NASA · JPL", "Horizons (planetas, cometas y sondas, en vivo; órbitas de 19 lunas de otros planetas) · CNEOS (asteroides cercanos) · parámetros físicos de satélites (SSD)"],
        ["NASA · otros centros", "Exoplanet Archive (en vivo) · tablas de eclipses del GSFC · Image and Video Library · Planetary Fact Sheet · SDO (el Sol de hoy)"],
        ["ESA", "Gaia DR3 (agujeros negros Gaia BH1–BH3) · Planck 2018 (materia y energía oscura) · imágenes de ESA/Webb y ESA/Hubble (CC BY 4.0)"],
      ]},
      { g: "Observatorios y colaboraciones científicas", items: [
        ["LIGO · Virgo · KAGRA", "Catálogo de ondas gravitacionales GWTC-4.0"],
        ["ESO (Observatorio Europeo Austral)", "Imágenes de nebulosas y galaxias desde Chile (CC BY 4.0)"],
        ["Event Horizon Telescope", "Imágenes de M87* y Sagitario A*"],
        ["SILSO · Real Observatorio de Bélgica", "Número oficial de manchas solares del día"],
        ["CSIRO (Australia)", "Catálogo de púlsares ATNF"],
        ["DESI · SH0ES · LUX-ZEPLIN · CERN", "Expansión del universo y búsquedas de materia oscura (resultados publicados)"],
        ["SPARC (Case Western Reserve U.)", "Curva de rotación de NGC 3198"],
      ]},
      { g: "Institutos de medida y datos de la Tierra", items: [
        ["NIST (EE. UU.)", "Constantes CODATA · Atomic Spectra Database (líneas espectrales)"],
        ["NOAA · British Geological Survey", "Modelo magnético mundial WMM2025 (brújula)"],
        ["NOAA SWPC (clima espacial)", "Regiones activas del Sol, fulguraciones (GOES), índice Kp, ciclo solar"],
        ["UAI · IERS", "Constantes astronómicas, las 88 constelaciones oficiales, orientación de la Tierra"],
        ["Nubes y clima", "Pronóstico de Open-Meteo.com (CC BY 4.0) · imágenes de satélite: NASA GIBS (GeoColor de los GOES, de NOAA/CIRA; VIIRS) y EUMETSAT (Meteosat)"],
        ["Relieve (horizonte real)", "AWS Terrain Tiles (Mapzen): SRTM de la NASA, GMTED2010 del USGS, ETOPO1 de NOAA y otros"],
      ]},
      { g: "Catálogos, seguimiento y comunidad", items: [
        ["Estrellas y distancias", "HYG Database v4.1 (Hipparcos) · CC BY-SA"],
        ["Figuras de constelaciones", "Stellarium western/modern · CC BY-SA"],
        ["Cúmulos, nebulosas y galaxias", "OpenNGC (CC BY-SA 4.0) · SEDS Messier · catálogo Caldwell (P. Moore, 1995) + Nubes de Magallanes · distancias Caldwell: catálogo Caldwell del Hubble (NASA), Baumgardt y Vasiliev 2021 (cúmulos globulares), Pietrzyński et al. 2019 (Gran Nube), Graczyk et al. 2020 (Pequeña Nube) y otros artículos publicados · distancias por redshift (aprox.)"],
        ["Lluvias de meteoros", "Organización Internacional de Meteoros (IMO)"],
        ["Estación Espacial Internacional", "Elementos orbitales de CelesTrak · SGP4"],
        ["Próximos lanzamientos", "Launch Library 2 · The Space Devs"],
        ["Efemérides y cielo", "Paul Schlyter · J. Meeus · escala de Bortle · modelo de atmósfera de Schaefer"],
        ["Texturas planetarias", "Solar System Scope (CC BY 4.0), NASA · lunas: mosaicos globales del USGS Astrogeology con imágenes de Viking, Galileo, Voyager y Cassini (dominio público)"],
        ["Fichas e imágenes", "Wikipedia · CC BY-SA"],
      ]},
      { g: "Software", items: [
        ["Mecánica orbital", "hapsira · astropy · sgp4"],
        ["Narrativa", "Groq (modelos Llama) — narra, nunca calcula"],
        ["Render 3D", "Three.js · MIT"],
      ]},
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

// Destinos especiales: no giran alrededor del Sol como los planetas (la Luna gira alrededor de la
// Tierra; el Sol es el centro). Se eligen en el selector de destino, siempre desde la Tierra, y
// muestran su propio cálculo (src/special/) en lugar de la ruta de Hohmann heliocéntrica.
const SPECIALS = [
  { id:"moon", en:"Moon", es:"Luna", esArt:"la Luna", dist:{ es:"384.400 km", en:"384,400 km" } },
  { id:"sun",  en:"Sun",  es:"Sol",  esArt:"el Sol",  dist:{ es:"1 UA", en:"1 AU" } },
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

function fmtDate(d, lang, style = "long") {
  const opts = style === "long"
    ? { day: "numeric", month: "long", year: "numeric" }
    : style === "weekday"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" };
  return parseISO(d).toLocaleDateString(loc(lang), { ...opts, timeZone: "UTC" });
}
// Duración en lenguaje humano: "8 meses y medio" / "8½ months"
function humanDuration(days, lang) {
  const t = T[lang];
  const { n, half, unit } = durationParts(days);
  const unitFn = unit === "day" ? t.unitDay : unit === "month" ? t.unitMonth : t.unitYear;
  const plural = lang === "es" ? n !== 1 : (n !== 1 || half);
  const word = unitFn(plural ? 2 : 1);
  return lang === "es" ? `${n} ${word}${half ? t.half : ""}` : `${n}${half ? t.half : ""} ${word}`;
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

// Idioma: ?lang= > preferencia guardada > (buscadores: español) > idioma del navegador > español
// (ver src/ui/seo.js; coherente con <html lang="es">)
function initialLang() {
  let saved = null, search = "", nav = "", ua = "";
  try { saved = localStorage.getItem("teseo-lang"); } catch { /* no-op */ }
  try { search = window.location.search; } catch { /* no-op */ }
  try { nav = (navigator.languages && navigator.languages[0]) || navigator.language || ""; ua = navigator.userAgent || ""; } catch { /* no-op */ }
  return pickLang({ search, saved, nav, ua });
}

const reducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

const META = {
  es: {
    title: "Teseo — Planetario y navegación interplanetaria",
    description: "App gratuita de divulgación astronómica: tu cielo en vivo, fichas de estrellas y planetas, viajes reales a otros planetas y grandes preguntas con datos reales.",
    locale: "es_EC",
  },
  en: {
    title: "Teseo — Planetarium and interplanetary navigation",
    description: "Free astronomy outreach app: your live sky, a profile for every star and planet, real trips to other planets and big questions explored with real data.",
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
  // canónica y og:url del idioma visible (cada idioma tiene su dirección; ver seo.js)
  const can = document.head.querySelector('link[rel="canonical"]');
  if (can) can.setAttribute("href", canonicalFor(lang));
  set('meta[property="og:url"]', canonicalFor(lang));
  set('meta[property="og:locale:alternate"]', lang === "en" ? META.es.locale : META.en.locale);
  // si la dirección ya traía ?lang=, se ajusta al idioma elegido (sin tocar el #)
  try {
    const q = searchWithLang(window.location.search, lang);
    if (q !== null && q !== window.location.search) window.history.replaceState(null, "", `${window.location.pathname}${q}${window.location.hash}`);
  } catch { /* no-op */ }
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

// ─── INTRO ───────────────────────────────────────────────────────────────────
// Se puede saltar tocando cualquier punto o con el botón "Saltar".


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
// ORBIT_R (radio de cada órbita, en % del mapa) vive en src/route/hohmannMap.js
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
// `extra`: cajas (px) de los marcadores de la ruta, que tampoco deben pisarse.
// Devuelve { pos: desplazamiento de cada etiqueta, boxes: su caja en px }.
function layoutLabels(pts, w, names, activeIds, extra = [], path = []) {
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const obstacles = [];
  const sunR = (w * SUN_SIZE) / 200;
  obstacles.push({ x: w / 2 - sunR, y: w / 2 - sunR, w: sunR * 2, h: sunR * 2 });
  for (const b of extra) obstacles.push(b);
  for (const q of pts) {
    const r = (w * q.p.size) / 200 + 1;
    obstacles.push({ x: (q.x * w) / 100 - r, y: (q.y * w) / 100 - r, w: r * 2, h: r * 2 });
  }
  const order = [...pts].sort((a, b) => (activeIds.includes(b.p.id) ? 1 : 0) - (activeIds.includes(a.p.id) ? 1 : 0));
  const out = {}, boxes = {};
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
    let best = null, firstFree = null;
    for (const c of cands) {
      const box = { ...c, w: lw, h: lh };
      if (box.x < 0 || box.y < 0 || box.x + lw > w || box.y + lh > w) continue;
      if (obstacles.some(o => hit(box, o))) continue;
      if (!firstFree) firstFree = box;
      // mejor un sitio que no tape la línea de la ruta; si no hay, el primero libre
      if (path.some(p => p.x >= box.x - 2 && p.x <= box.x + lw + 2 && p.y >= box.y - 2 && p.y <= box.y + lh + 2)) continue;
      best = box; break;
    }
    if (!best) best = firstFree;
    if (!best) {
      const c = cands[0];
      best = { x: Math.min(Math.max(c.x, 0), w - lw), y: Math.min(c.y, w - lh), w: lw, h: lh };
    }
    obstacles.push(best);
    out[q.p.id] = { dx: best.x - cx, dy: best.y - cy };
    boxes[q.p.id] = best;
  }
  return { pos: out, boxes };
}

// plan: { dep: ISO, arr: ISO } de la próxima ventana (o de hoy si no hay ninguna)
function SolarMap({ from, to, positions, lang, onPick, special = null, onPickSun = null, plan = null }) {
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
  const toId = special ? null : to.id;   // con la Luna o el Sol de destino no se marca ningún planeta

  // Media elipse de Hohmann de la próxima ventana: ángulos reales, radios comprimidos
  // con la misma escala del mapa (ver src/route/hohmannMap.js). Solo con destino planeta.
  const depISO = plan && plan.dep, arrISO = plan && plan.arr;
  const hoh = useMemo(()=>{
    if (special || !depISO || !arrISO) return null;
    try { return hohmannPlan(from.id, to.id, parseISO(depISO), parseISO(arrISO)); } catch { return null; }
  },[special, from.id, to.id, depISO, arrISO]);

  // Marcadores de salida y llegada (px): el punto de salida y el destino «fantasma»
  const ghostPx = useMemo(()=>{
    const p = PLANETS.find(q=>q.id===to.id);
    return Math.max(10, (w * p.size) / 100);
  },[w, to.id]);
  const marks = useMemo(()=>{
    if (!hoh) return null;
    const px = v => (v * w) / 100;
    const dep = { x: px(hoh.dep.x), y: px(hoh.dep.y), r: 5 };
    const gh = { x: px(hoh.ghost.x), y: px(hoh.ghost.y), r: ghostPx / 2 + 3 };
    const box = m => ({ x: m.x - m.r - 2, y: m.y - m.r - 2, w: (m.r + 2) * 2, h: (m.r + 2) * 2 });
    return { dep, gh, boxes: [box(dep), box(gh)] };
  },[hoh, w, ghostPx]);

  const pathPx = useMemo(()=>hoh ? hoh.points.map(q=>({ x: (q.x * w) / 100, y: (q.y * w) / 100 })) : [],[hoh, w]);
  const lay = useMemo(()=>layoutLabels(pts, w, names, [from.id, toId].filter(Boolean), marks ? marks.boxes : [], pathPx),[pts, w, names, from.id, toId, marks, pathPx]);
  const labels = lay.pos;

  // Etiquetas «Salida: …» y «Llegada: …»: junto a su marcador y sin pisar planetas,
  // sus etiquetas ni la propia línea (si no hay hueco, solo queda el marcador)
  const depTxt = depISO ? fmtDate(depISO, lang, "short") : "";
  const arrTxt = arrISO ? fmtDate(arrISO, lang, "short") : "";
  const tags = useMemo(()=>{
    if (!hoh || !marks) return null;
    const px = v => (v * w) / 100;
    const obstacles = [{ x: w / 2 - (w * SUN_SIZE) / 200, y: w / 2 - (w * SUN_SIZE) / 200, w: (w * SUN_SIZE) / 100, h: (w * SUN_SIZE) / 100 }];
    for (const q of pts) { const r = (w * q.p.size) / 200 + 2; obstacles.push({ x: px(q.x) - r, y: px(q.y) - r, w: r * 2, h: r * 2 }); }
    for (const id of Object.keys(lay.boxes)) obstacles.push(lay.boxes[id]);
    obstacles.push(...marks.boxes);
    const path = pathPx;
    const out = {};
    for (const [key, m, txt] of [["arr", marks.gh, t.mapArr(arrTxt)], ["dep", marks.dep, t.mapDep(depTxt)]]) {
      // primero en una línea; si no cabe, en dos («Salida:» / «4 dic 2026»)
      const opts = { avoidPath: path, gap: m.r + 4 };
      let b = placeLabel(m.x, m.y, txt.length * 6.6 + 8, 17, w, obstacles, opts), shown = txt;
      if (!b && txt.includes(": ")) {
        shown = txt.replace(": ", ":\n");
        const longest = Math.max(...shown.split("\n").map(x=>x.length));
        b = placeLabel(m.x, m.y, longest * 6.6 + 8, 34, w, obstacles, opts);
      }
      if (b) { out[key] = { ...b, txt: shown }; obstacles.push(b); }
    }
    return out;
  },[hoh, marks, pts, w, lay, t, depTxt, arrTxt, pathPx]);

  // El hilo de Ariadna con destino especial: al Sol, media vuelta cayendo hacia el centro
  // (esquemática); a la Luna no hay hilo (está pegada a la Tierra a esta escala).
  const thread = useMemo(()=>{
    if (hoh) return pathD(hoh.points);
    if (special !== "sun") return "";
    const A = pts.find(q=>q.p.id===from.id);
    const B = { a: A.a + Math.PI, r: 0 };
    const sweep = Math.PI;
    const N = 72;
    let d = "";
    for (let k = 0; k <= N; k++) {
      const s = k / N;
      const a = A.a + sweep * s;
      const r = A.r + (B.r - A.r) * (1 - Math.cos(Math.PI * s)) / 2;
      d += `${k ? "L" : "M"}${(50 + r * Math.cos(a)).toFixed(2)} ${(50 - r * Math.sin(a)).toFixed(2)}`;
    }
    return d;
  },[hoh, pts, from.id, special]);

  const routeLabel = hoh ? t.mapRouteLabel(pnameArt(from, lang), pnameArt(to, lang), depTxt, arrTxt) : "";

  return (
    <div ref={ref} className="map" role="group" aria-label={routeLabel ? `${t.mapLabel} ${routeLabel}` : t.mapLabel}>
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
          const sel = p.id===from.id || p.id===toId;
          return <circle key={p.id} cx="50" cy="50" r={ORBIT_R(i)} fill="none"
            stroke={sel ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.13)"}
            strokeWidth={sel ? 0.34 : 0.22}/>;
        })}
        <g key={`${from.id}-${special || toId}`}>
          <path d={thread} className="thread thread--glow" pathLength="1"/>
          <path d={thread} className="thread" pathLength="1" stroke="url(#thread-grad)"/>
        </g>
        {hoh && marks && (
          <g key={`m-${from.id}-${toId}`} className="map__marks">
            {/* destino «fantasma»: contorno donde estará el planeta el día de la llegada */}
            <circle className="map__ghost" cx={hoh.ghost.x} cy={hoh.ghost.y} r={(marks.gh.r / w) * 100}/>
            {/* punto de salida, en la posición del origen el día de la salida */}
            <circle className="map__dep-ring" cx={hoh.dep.x} cy={hoh.dep.y} r={(marks.dep.r / w) * 100}/>
            <circle className="map__dep" cx={hoh.dep.x} cy={hoh.dep.y} r={(2.6 / w) * 100}/>
          </g>
        )}
      </svg>

      {/* El Sol también se toca: es un destino especial (siempre desde la Tierra) */}
      <button type="button" className={`map__sun ${special === "sun" ? "is-dest" : ""}`}
        aria-label={special === "sun" ? t.mapIsDest(t.sun) : t.mapPick(t.sun)}
        aria-current={special === "sun" ? "true" : undefined}
        onClick={()=>onPickSun && onPickSun()}>
        <PlanetSphere id="sun" size={(w * SUN_SIZE) / 100}/>
      </button>

      {pts.map(q=>{
        const { p } = q;
        const isF = p.id===from.id, isT = p.id===toId;
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

      {tags && ["dep", "arr"].map(k => tags[k] && (
        <span key={k} aria-hidden="true" className={`map__tag map__tag--${k}`} style={{ left: tags[k].x, top: tags[k].y }}>{tags[k].txt}</span>
      ))}
    </div>
  );
}

// ─── SELECTOR DE PLANETA ─────────────────────────────────────────────────────

function PlanetSelect({ value, onChange, exclude, label, kind, lang, align = "left", special = null, onSpecial = null }) {
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
        aria-label={t.choose(label, pname(special || value, lang))}
        onClick={()=>setOpen(o=>!o)}>
        <PlanetSphere id={(special || value).id} size={36}/>
        <span className="pick__text">
          <span className="pick__label">{label}
            <IconChevron className={`pick__chev ${open ? "is-open" : ""}`} width={15} height={15}/>
          </span>
          <span className="pick__name">{pname(special || value, lang)}</span>
        </span>
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className={`pick__list pick__list--${align}`}>
          {available.map(p=>(
            <li key={p.id} role="option" aria-selected={!special && p.id===value.id}>
              <button type="button" className={`pick__opt ${!special && p.id===value.id ? "is-current" : ""}`}
                onClick={()=>{ onChange(p); setOpen(false); }}>
                <PlanetSphere id={p.id} size={28} spin={false}/>
                <span className="pick__optname">{pname(p, lang)}</span>
                <span className="pick__au">{nf(p.au, lang, 2)} {t.au}</span>
              </button>
            </li>
          ))}
          {onSpecial && (<>
            <li role="presentation" className="pick__sep">{lang === "es" ? "Desde la Tierra" : "From Earth"}</li>
            {SPECIALS.map(s=>(
              <li key={s.id} role="option" aria-selected={special?.id===s.id}>
                <button type="button" className={`pick__opt ${special?.id===s.id ? "is-current" : ""}`}
                  onClick={()=>{ onSpecial(s); setOpen(false); }}>
                  <PlanetSphere id={s.id} size={28} spin={false}/>
                  <span className="pick__optname">{pname(s, lang)}</span>
                  <span className="pick__au">{s.dist[lang]}</span>
                </button>
              </li>
            ))}
          </>)}
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
      {/* región viva: al cambiar de destino se anuncia la nueva respuesta */}
      <div aria-live="polite" aria-atomic="true">
        <h2 id="answer-q" className="answer__q">{t.answerQ(pnameArt(to, lang))}</h2>
        <p className="answer__big">
          <span className="answer__about">{t.about}</span>
          <span className="answer__value">{humanDuration(days, lang)}</span>
        </p>
      </div>
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
  const { n, unit } = relParts(days);
  if (unit === "day") return `${nf(n, lang)} ${t.unitDay(n)}`;
  if (unit === "month") return `${n} ${t.unitMonth(n)}`;
  return `${nf(n, lang, 1)} ${t.unitYear(2)}`;
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
      .catch(e=>{ if(alive&&!isAbort(e)) { trackNetError("launch_windows", e); setError(true); onError(true); } });
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
        <div aria-live="polite" aria-atomic="true">
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
        </div>

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

// Icono de la pestaña Preguntas: un signo de interrogación en órbita.
function IconQuestions(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      <path d="M9.2 9.3a2.9 2.9 0 1 1 4.3 2.5c-.9.6-1.5 1.1-1.5 2.2" />
      <circle cx="12" cy="17" r="0.7" fill="currentColor" />
      <path d="M19.6 7.2A9 9 0 1 1 16.5 4.2" strokeDasharray="0.1 3.1" strokeWidth="2" />
    </svg>
  );
}

const TABS = [
  { id:"route",   Icon:IconRoute },
  { id:"now",     Icon:IconWindows },
  { id:"sky",     Icon:IconSky },
  { id:"questions", Icon:IconQuestions },
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

// ─── MENÚ (teléfono, en Cielo) ────────────────────────────────────────────────
// En el teléfono, la vista Cielo ocupa toda la pantalla: la cabecera (marca, música, visión nocturna, idioma) y
// las pestañas pasan a este panel lateral, que se abre con el botón ☰ de la propia vista.
function AppMenu({ lang, tab, onTab, onClose, ambient, onAmbient, night, onNight, onLang }) {
  const t = T[lang];
  const boxRef = useRef(null);
  useEffect(()=>{
    const before = document.activeElement;
    boxRef.current?.querySelector("button")?.focus();
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return ()=>{ document.removeEventListener("keydown", onKey); before?.focus?.(); };
  },[onClose]);
  return (
    <div className="app-menu" role="presentation" onClick={e=>{ if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={boxRef} className="app-menu__panel" role="dialog" aria-modal="true" aria-label={t.menu}>
        <div className="app-menu__head">
          <div>
            <p className="wordmark" style={{fontSize:28, margin:0}}>Teseo</p>
            <p className="tagline">{t.tagline}</p>
            <a className="tagline tagline--kn" href="https://sites.google.com/view/killanan/inicio" target="_blank" rel="noopener noreferrer"
              onClick={()=>track("coop_open", { from: "menu" })}>{t.allianceShort}</a>
          </div>
          <button type="button" className="app-menu__close" onClick={onClose} aria-label={t.menuClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <nav className="app-menu__tabs" aria-label={t.sections}>
          {TABS.map(({ id, Icon })=>(
            <button key={id} type="button" aria-current={tab===id ? "page" : undefined} className={tab===id ? "is-active" : ""}
              onClick={()=>{ onTab(id); onClose(); }}>
              <Icon/><span>{t[id]}</span>
            </button>
          ))}
        </nav>
        <div className="app-menu__opts">
          <button type="button" aria-pressed={ambient} onClick={onAmbient}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>{!ambient && <path d="M3 3l18 18" strokeWidth="1.6"/>}
            </svg>
            <span>{ambient ? t.ambientOff : t.ambientOn}</span>
          </button>
          <button type="button" aria-pressed={night} onClick={onNight}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>
            <span>{night ? t.nightOff : t.nightOn}</span>
          </button>
          <button type="button" className="lang" aria-label={t.switchLang} onClick={onLang}>
            <span className={lang==="es" ? "is-on" : ""} aria-hidden="true">ES</span>
            <span className={lang==="en" ? "is-on" : ""} aria-hidden="true">EN</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

// ─── CRÉDITOS ────────────────────────────────────────────────────────────────

function CreditsModal({ lang, onClose }) {
  const t = T[lang];
  const closeRef = useRef(null);
  useEffect(()=>{
    // el foco entra al diálogo, no sale con Tab (solo hay un control) y al
    // cerrar vuelve a donde estaba
    const before = document.activeElement;
    closeRef.current?.focus();
    const onKey = e => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Tab") { e.preventDefault(); closeRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return ()=>{
      document.removeEventListener("keydown", onKey);
      try { if (before && before.isConnected && typeof before.focus === "function") before.focus(); } catch { /* no-op */ }
    };
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
        <h3 className="credits__h">{t.whoTitle}</h3>
        <div className="who">
          <a className="who__card who__card--kn" href="https://sites.google.com/view/killanan/inicio" target="_blank" rel="noopener noreferrer" onClick={()=>track("coop_open", { from: "credits" })}>
            <span className="who__name">{t.whoKn[0]}</span>
            <span className="who__text">{t.whoKn[1]}</span>
          </a>
          <div className="who__links">
            <a href="https://sites.google.com/view/killanan/inicio" target="_blank" rel="noopener noreferrer" onClick={()=>track("coop_open", { from: "credits" })}>{t.whoLinks.web}</a>
            <a href="https://www.facebook.com/KillaNanEC" target="_blank" rel="noopener noreferrer" onClick={()=>track("coop_open", { from: "credits" })}>{t.whoLinks.fb}</a>
            <a href="https://www.instagram.com/killananec/" target="_blank" rel="noopener noreferrer" onClick={()=>track("coop_open", { from: "credits" })}>{t.whoLinks.ig}</a>
          </div>
          <a className="who__card" href="https://yachaydeep.com" target="_blank" rel="noopener noreferrer">
            <span className="who__name">{t.whoYd[0]}</span>
            <span className="who__text">{t.whoYd[1]}</span>
          </a>
        </div>
        <h3 className="credits__h">{t.creditsGroups}</h3>
        <p className="modal__p">{t.creditsIntro}</p>
        {t.credits.map(({g, items})=>(
          <section key={g} className="credits__group">
            <h4 className="credits__g">{g}</h4>
            <dl className="credits">
              {items.map(([k,v])=>(
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </section>
        ))}
        <p className="modal__p modal__p--fine">{t.creditsNote}</p>
        <p className="modal__p modal__p--fine">{t.privacyNote}</p>
      </div>
    </div>
  );
}

// ─── AHORA EN EL ESPACIO (entrada) ───────────────────────────────────────────
// Aquí solo vive la puerta: el contenido (src/now/) se descarga al abrirla.

// Acceso desde Ruta: lleva a la sección, ya abierta, en la pestaña Ventanas
// Pestaña «Ahora»: el Sol de hoy, el calendario del cielo, la ISS, lanzamientos, Marte y asteroides
function NowPage({ lang, View, onRetry }) {
  const t = T[lang];
  return (
    <section id="now" className="now now--page is-open" aria-labelledby="now-h">
      <header className="now__head">
        <h2 id="now-h" className="now__title"><span className="now-teaser__live" aria-hidden="true"/>{t.nowTitle}</h2>
        <p className="now__sub">{t.nowSub}</p>
      </header>
      <div id="now-body" className="now__body">
        <SectionBoundary name="Ahora en el espacio" onReset={onRetry} title={t.nowErrTitle} message={t.nowErrBody} retryLabel={t.retry}>
          <Suspense fallback={<p role="status" className="loading">{t.nowLoading}</p>}>
            <View lang={lang} api={API}/>
          </Suspense>
        </SectionBoundary>
      </div>
    </section>
  );
}

// ─── PANEL DE ADMINISTRACIÓN ─────────────────────────────────────────────────
// Las métricas de uso solo las ve quien tiene la clave del servidor (TESEO_METRICS_TOKEN).
// La clave se comprueba contra /api/metrics/summary y se guarda solo en esta pestaña
// (sessionStorage). El público no tiene ningún enlace a este panel.
const ADMIN_KEY = "teseo-admin-token";
function AdminGate({ lang, onClose, children }) {
  const es = lang !== "en";
  const [ok, setOk] = useState(()=>{ try { return !!sessionStorage.getItem(ADMIN_KEY); } catch { return false; } });
  const [val, setVal] = useState("");
  const [state, setState] = useState(null);   // null | "checking" | "bad" | "error"
  if (ok) return children;
  const submit = async e => {
    e.preventDefault();
    const tok = val.trim();
    if (!tok) return;
    setState("checking");
    try {
      const r = await fetch(`${API}/api/metrics/summary?days=1`, { headers: { Authorization: `Bearer ${tok}` } });
      if (r.ok) { try { sessionStorage.setItem(ADMIN_KEY, tok); } catch { /* no-op */ } setOk(true); return; }
      setState(r.status === 401 || r.status === 404 ? "bad" : "error");
    } catch { setState("error"); }
  };
  return (
    <div className="modal" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="admin-h" className="modal__box" onClick={e=>e.stopPropagation()} onSubmit={submit}>
        <div className="modal__head">
          <h2 id="admin-h" className="modal__title">{es ? "Panel de administración" : "Admin panel"}</h2>
          <button type="button" className="icon-btn" aria-label={es ? "Cerrar" : "Close"} onClick={onClose}><IconClose width={20} height={20}/></button>
        </div>
        <p className="modal__p">{es ? "Las métricas de uso de Teseo son privadas. Escribe la clave de métricas del servidor." : "Teseo's usage metrics are private. Enter the server's metrics key."}</p>
        <label className="modal__p" style={{display:"grid",gap:6}}>
          <span>{es ? "Clave" : "Key"}</span>
          <input type="password" autoComplete="current-password" value={val} onChange={e=>setVal(e.target.value)}
            style={{minHeight:44,padding:"0 12px",borderRadius:12,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.2)",color:"#fff"}}/>
        </label>
        {state === "bad" && <p role="alert" className="modal__p">{es ? "Clave incorrecta." : "Wrong key."}</p>}
        {state === "error" && <p role="alert" className="modal__p">{es ? "No se pudo comprobar la clave. Inténtalo de nuevo." : "Could not check the key. Try again."}</p>}
        <button type="submit" disabled={state === "checking"} style={{minHeight:44,width:"100%",marginTop:8,borderRadius:999,background:"var(--thread)",color:"#0A1020",fontWeight:700}}>{state === "checking" ? (es ? "Comprobando…" : "Checking…") : (es ? "Entrar" : "Enter")}</button>
      </form>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function Teseo() {
  // La intro solo sale al entrar por la portada: con «reducir movimiento» o con un
  // enlace directo (#ventanas, #sky?..., #preguntas?...) se va directo al contenido.
  const [intro,    setIntro]    = useState(()=>!reducedMotion() && !(typeof location!=="undefined" && location.hash.length>1));
  const [showCredits, setShowCredits] = useState(false);
  // «Teseo en números»: null (cerrada) o { days } con el periodo inicial (7, 30, 90 o null = por defecto)
  const [usage, setUsage] = useState(null);
  const [lang,     setLang]     = useState(initialLang);
  useEffect(() => { applyLangToDocument(lang); try { localStorage.setItem("teseo-lang", lang); } catch { /* no-op */ } }, [lang]);
  const [from,     setFrom]     = useState(PLANETS[2]); // Earth
  const [to,       setTo]       = useState(PLANETS[3]); // Mars
  const [special,  setSpecial]  = useState(null);       // destino especial: SPECIALS[i] (Luna o Sol) o null
  const [tab,      setTab]      = useState("sky");   // la pantalla principal es el Cielo (sin hash)
  // «Ventanas de lanzamiento» vive dentro de Ruta: un contador para llevar la vista hasta ella
  const [winFocus, setWinFocus] = useState(0);
  const winRef = useRef(null);
  // Enlaces directos (#ahora, #preguntas?…, #sky?… y los antiguos #ventanas y #escala):
  // al cargar y cada vez que cambia el hash con la app abierta. Lo que sigue al
  // nombre lo lee cada pestaña; aquí solo se elige cuál mostrar.
  useEffect(() => {
    let initial = true;
    const check = () => {
      let target = null;
      try { target = parseHash(window.location.hash); } catch { /* no-op */ }
      if (!target) return;
      // un enlace interno que cambia de pestaña cuenta como cambio (la carga inicial ya es page_view)
      if (!initial && tabRef.current !== target.tab) track("tab_change", { tab: target.tab });
      initial = false;
      // #escala → la pregunta «¿Qué tan grande es el universo?» (Preguntas lee ?q= del hash)
      if (target.q) { try { window.history.replaceState(null, "", hashForQuestion(target.q, document.documentElement.lang === "en" ? "en" : "es")); } catch { /* no-op */ } }
      setTab(target.tab);
      if (target.section === "windows") {
        setWinFocus(n => n + 1);
        // el enlace antiguo #ventanas se reescribe a Ruta (#ruta), que es donde vive ahora
        try { window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hashForTab("route", document.documentElement.lang === "en" ? "en" : "es")}`); } catch { /* no-op */ }
      }
      if (target.tab === "now") track("now_open", { source: "link" });
    };
    check();
    initial = false;
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);
  // Métricas anónimas: una vista por carga (con la pestaña inicial) y una
  // "visita" por pestaña del navegador (session_start, marca en sessionStorage).
  useEffect(() => {
    let first = "sky";
    try { const h = parseHash(window.location.hash); if (h) first = h.tab; } catch { /* no-op */ }
    startSession({ lang, tab: first });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // El visor del Cielo abre los créditos desde su menú con este evento
  useEffect(() => {
    const open = () => { track("credits_open"); setShowCredits(true); };
    window.addEventListener("teseo:credits", open);
    return () => window.removeEventListener("teseo:credits", open);
  }, []);
  // Panel de administración de métricas: solo con #admin y la clave del servidor (sin enlaces públicos)
  const openUsage = useCallback((from, days = null) => { track("usage_open", { from }); setShowCredits(false); setUsage({ days }); }, []);
  useEffect(() => {
    const fromHash = () => { let u = null; try { u = usageHash(window.location.hash); } catch { /* no-op */ } if (u) openUsage("link", u.days); };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => { window.removeEventListener("hashchange", fromHash); };
  }, [openUsage]);
  // Alto del aviso de cookies (si está): el pie deja ese hueco para no quedar tapado
  useEffect(() => {
    const root = document.documentElement;
    const measure = () => {
      const el = document.getElementById("yd-cookies");
      const h = el ? Math.round(el.getBoundingClientRect().height) : 0;
      root.style.setProperty("--cookie-h", `${h}px`);
    };
    measure();
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(measure) : null;
    if (mo) mo.observe(document.body, { childList: true });
    const el = document.getElementById("yd-cookies");
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { if (mo) mo.disconnect(); if (ro) ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
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
  // Primera ventana de lanzamiento según el servidor (la misma que la pestaña Ventanas);
  // mientras llega, o si falla, el mapa usa la ventana local (ver routeDates)
  const [srvWin,    setSrvWin]    = useState(null);
  const [winTry,     setWinTry]     = useState(0);
  // Vista 3D: componente lazy recreable si falló la carga del chunk
  const [SkyView, setSkyView] = useState(()=>Constellations);
  const retrySky = useCallback(()=>setSkyView(()=>lazy(loadSky)),[]);
  // Preguntas: mismo patrón (lazy recreable)
  const [QuestionsView, setQuestionsView] = useState(()=>QuestionsLazy);
  const retryQuestions = useCallback(()=>setQuestionsView(()=>lazy(loadQuestions)),[]);
  // Ahora en el espacio: mismo patrón
  const [NowView, setNowView] = useState(()=>NowLazy);
  const retryNow = useCallback(()=>setNowView(()=>lazy(loadNow)),[]);

  const t = T[lang];
  const onDone = useCallback(()=>setIntro(false),[]);
  const closeCredits = useCallback(()=>setShowCredits(false),[]);
  // «Teseo en números»: componente lazy recreable si su chunk no cargó (como el Cielo o Preguntas)
  const [UsageView, setUsageView] = useState(()=>UsageLazy);
  const retryUsage = useCallback(()=>setUsageView(()=>lazy(loadUsage)),[]);
  const closeUsage = useCallback(()=>{
    setUsage(null);
    // si se abrió con #uso, al cerrar el enlace vuelve a ser el de la pestaña (recargar no la reabre)
    try {
      if (usageHash(window.location.hash)) window.history.replaceState(null, "", hashForTab(tabRef.current, lang) || `${window.location.pathname}${window.location.search}`);
    } catch { /* no-op */ }
  },[lang]);

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
        .catch(e=>{ trackNetError("position", e); return null; })
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
      .catch(e=>{ if(alive&&!isAbort(e)) { trackNetError("distance", e); setDistStatus("error"); } });
    return ()=>{ alive=false; ctrl.abort(); };
  },[from,to,distTry]);

  // Próxima ventana de lanzamiento para dibujar la media elipse de Hohmann en el mapa
  useEffect(()=>{
    setSrvWin(null);
    if(!API||special||from.id===to.id) return;
    const ctrl = new AbortController();
    let alive = true;
    fetchJson(`${API}/api/launch-windows/${from.id}/${to.id}?count=4`,{signal:ctrl.signal})
      .then(d=>{
        const w = d && Array.isArray(d.windows) ? d.windows[0] : null;
        if(alive && w && w.departure_date && w.arrival_date) setSrvWin({ from:from.id, to:to.id, dep:w.departure_date, arr:w.arrival_date });
      })
      .catch(()=>{});   // sin servidor: queda la ventana local
    return ()=>{ alive=false; ctrl.abort(); };
  },[from,to,!!special]);

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
      trackNetError("route", e);
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
  const mapPlan = useMemo(()=>{
    if (special) return null;
    const srv = srvWin && srvWin.from===from.id && srvWin.to===to.id ? srvWin : null;
    return routeDates(from.id, to.id, srv);
  },[special, srvWin, from.id, to.id]);

  // ── Un único aviso por pestaña, con un único "Reintentar" ─────────────────
  const posFailed = posStatus==="error";
  const distFailed = distStatus==="error" && !realDist;
  const routeFailed = routeError && !backend;
  const showNotice = tab==="route" ? (posFailed||distFailed||routeFailed||winError) : false;
  const retryAll = ()=>{
    track("data_retry", { tab });
    if (posFailed) setPosTry(n=>n+1);
    if (tab==="route") {
      if (distFailed) setDistTry(n=>n+1);
      if (routeFailed) setRouteTry(n=>n+1);
      if (winError) setWinTry(n=>n+1);
    }
  };

  // El hash acompaña a la pestaña (para compartir o recargar donde estabas),
  // sin pisar el estado que el Cielo y Preguntas guardan tras su nombre.
  const syncHash = useCallback(id=>{
    try {
      const cur = window.location.hash || "";
      if (hashBelongsTo(cur, id)) return;
      const h = hashForTab(id, lang);
      if (h === cur) return;
      window.history.replaceState(null, "", h || `${window.location.pathname}${window.location.search}`);
    } catch { /* no-op */ }
  },[lang]);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const changeTab = useCallback(id=>{
    if (tabRef.current !== id) track("tab_change", { tab: id });
    setTab(id);
    syncHash(id);
    try { if (window.scrollY > 120) window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" }); } catch { /* no-op */ }
  },[syncHash]);
  // «Ver ventanas de lanzamiento»: bajar hasta la sección dentro de Ruta
  const seeWindows = useCallback(()=>{
    if (tabRef.current !== "route") { track("tab_change", { tab: "route" }); setTab("route"); syncHash("route"); }
    setWinFocus(n=>n+1);
  },[syncHash]);
  useEffect(()=>{
    if (!winFocus || tab !== "route") return;
    // Lleva la cabecera de la sección bajo las pestañas fijas. Mientras llegan
    // los datos la página cambia de alto: se realinea durante un par de segundos,
    // salvo que la persona ya esté desplazándose por su cuenta.
    let live = true;
    const align = smooth=>{
      const el = winRef.current;
      if (!live || !el) return;
      try {
        const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 70);
        if (Math.abs(y - window.scrollY) > 2) window.scrollTo({ top: y, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
      } catch { /* no-op */ }
    };
    const raf = requestAnimationFrame(()=>align(true));
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(()=>align(false)) : null;
    if (ro) ro.observe(document.body);
    const stop = ()=>{ live = false; if (ro) ro.disconnect(); };
    const timer = setTimeout(stop, 2500);
    const opts = { passive: true };
    window.addEventListener("wheel", stop, opts); window.addEventListener("touchstart", stop, opts); window.addEventListener("keydown", stop);
    return ()=>{
      cancelAnimationFrame(raf); clearTimeout(timer); stop();
      window.removeEventListener("wheel", stop, opts); window.removeEventListener("touchstart", stop, opts); window.removeEventListener("keydown", stop);
    };
  },[winFocus, tab]);
  // Analítica: cambio de destino (GA solo con consentimiento; métricas propias anónimas)
  const firstPair = useRef(true);
  useEffect(()=>{
    if (firstPair.current) { firstPair.current = false; return; }
    track("destination_change", { origin: from.id, destination: to.id });
  },[from.id, to.id]);
  // Música ambiental (generada con Web Audio, src/ui/ambient.js). Empieza apagada; si la
  // persona la dejó encendida, vuelve a sonar con su primer toque (los navegadores no
  // permiten sonido sin un gesto).
  const ambientRef = useRef(null);
  const [ambient, setAmbient] = useState(false);
  const ambientEngine = () => (ambientRef.current ||= createAmbient());
  const toggleAmbient = useCallback(async ()=>{
    const eng = ambientEngine();
    const next = !eng.isOn();
    if (next) { if (!(await eng.start())) return; } else eng.stop();
    setAmbient(next);
    track("ambient", { state: next ? "on" : "off" });
    try { localStorage.setItem(AMBIENT_KEY, next ? "1" : "0"); } catch { /* no-op */ }
  },[]);
  useEffect(()=>{
    let wanted = false;
    try { wanted = localStorage.getItem(AMBIENT_KEY) === "1"; } catch { /* no-op */ }
    if (!wanted) return;
    const resume = async ()=>{ if (await ambientEngine().start()) setAmbient(true); };
    window.addEventListener("pointerdown", resume, { once: true });
    return ()=>window.removeEventListener("pointerdown", resume);
  },[]);
  // Visión nocturna: todo en rojo tenue para no perder la adaptación del ojo a
  // la oscuridad (los bastones de la retina casi no reaccionan a la luz roja).
  const [menuOpen, setMenuOpen] = useState(false);       // menú ☰ (teléfono, en Cielo)
  const closeMenu = useCallback(()=>setMenuOpen(false),[]);
  // «atrás» del teléfono (backGuard.js): primero cierra lo abierto; sin nada abierto, «Pulsa de nuevo para salir»
  useEffect(() => {
    if (!wantsGuard()) return undefined;
    return installBackGuard({
      onBack: () => { const ev = new CustomEvent("teseo:back", { cancelable: true }); return !window.dispatchEvent(ev); },
      toast: () => { showExitToast(document.documentElement.lang === "en" ? "Press back again to exit" : "Pulsa de nuevo para salir"); track("app_exit_hint"); },
    });
  }, []);
  // lo de la app va antes que el Cielo (fase de captura): el menú, los créditos y el panel de métricas
  const backRef = useRef({});
  backRef.current = { menuOpen, showCredits, usage };
  useEffect(() => {
    const onBack = (e) => {
      const b = backRef.current;
      if (b.menuOpen) setMenuOpen(false);
      else if (b.usage) setUsage(null);
      else if (b.showCredits) setShowCredits(false);
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    };
    window.addEventListener("teseo:back", onBack, true);
    return () => window.removeEventListener("teseo:back", onBack, true);
  }, []);
  const [night, setNight] = useState(()=>{ try { return localStorage.getItem("teseo-night")==="1"; } catch { return false; } });
  useEffect(()=>{
    try { localStorage.setItem("teseo-night", night ? "1" : "0"); } catch { /* no-op */ }
    document.documentElement.classList.toggle("night-vision", night);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) { if (!m.dataset.day) m.dataset.day = m.content; m.content = night ? "#1a0000" : m.dataset.day; }
  },[night]);
  const toggleLang = useCallback(()=>{
    const n = lang === "en" ? "es" : "en";
    track("language_change", { lang: n });
    setLang(n);
  },[lang]);
  // Desde Preguntas: abrir el Cielo con la capa de exoplanetas activada
  // (Constellations lee `L=` del hash al montarse).
  const seeExoplanetsInSky = useCallback(()=>{
    try { window.history.replaceState(null, "", "#sky?L=exoplanets"); } catch { /* no-op */ }
    changeTab("sky");
  },[changeTab]);
  // Botón "Ver ventanas a Venus" (tarjeta del Sol): Tierra → Venus y arriba, a la cuenta atrás
  const seeVenusWindows = useCallback(()=>{
    track("special_dest", { destination: "sun", kind: "venus" });
    setSpecial(null); setFrom(PLANETS[2]); setTo(PLANETS[1]);
    setWinFocus(n=>n+1);
  },[]);
  // Luna o Sol: siempre desde la Tierra (el planeta de destino queda guardado por si se vuelve)
  const pickSpecial = useCallback(s=>{
    track("special_dest", { destination: s.id, kind: "pick" });
    setSpecial(s);
    if (from.id !== "earth") { setFrom(PLANETS[2]); if (to.id === "earth") setTo(PLANETS[3]); }
  },[from, to]);
  const pickDest = useCallback(p=>{ setSpecial(null); setTo(p); },[]);
  const pickOrigin = useCallback(p=>{
    if (p.id !== "earth") setSpecial(null);
    if (p.id === to.id) setTo(from);   // con la Luna o el Sol, el planeta guardado podía coincidir
    setFrom(p);
  },[from, to]);
  const pickPlanet = useCallback(p=>{
    if (special) {   // en el mapa, tocar un planeta lo vuelve destino normal
      setSpecial(null);
      if (p.id === from.id) return;
      setTo(p); return;
    }
    if (p.id === to.id) return;
    if (p.id === from.id) { setFrom(to); setTo(from); return; }
    setTo(p);
  },[from, to, special]);
  const swap = ()=>{ if (special) return; setFrom(to); setTo(from); };

  const navigator_ = tab==="route";
  const notice = showNotice ? <LiveDataNotice lang={lang} onRetry={retryAll}/> : null;

  return (
    <>
      {intro && <Intro lang={lang} planets={PLANETS} credit={T[lang].introCredit} skipLabel={T[lang].skip} skipAria={T[lang].skipIntro} onDone={onDone}/>}
      {night && <div className="night-vision-layer" aria-hidden="true"/>}

      {menuOpen && <AppMenu lang={lang} tab={tab} onTab={changeTab} onClose={closeMenu} ambient={ambient} onAmbient={toggleAmbient}
        night={night} onNight={()=>{ track("night_vision", { state: night ? "off" : "on" }); setNight(v=>!v); }} onLang={toggleLang}/>}
      <div className={`app app--${tab}`}>
        <SpaceTravel/>

        <div className="app__body">
          <a className="skip-link" href={`#panel-${tab}`}
            onClick={e=>{ e.preventDefault(); document.getElementById(`panel-${tab}`)?.focus(); }}>
            {t.skipToContent}
          </a>
          {/* Cabecera */}
          <header className="shell flex items-center justify-between pt-4 pb-2">
            <div>
              <h1 className="wordmark" style={{fontSize:30}}>Teseo</h1>
              <p className="tagline">{t.tagline}</p>
              <a className="tagline tagline--kn" href="https://sites.google.com/view/killanan/inicio" target="_blank" rel="noopener noreferrer"
                title={t.coopWith} onClick={()=>track("coop_open", { from: "header" })}>{t.allianceShort}</a>
            </div>
            <div className="flex items-center gap-2">
            <button type="button" className={`night-btn night-btn--music${ambient ? " is-on" : ""}`} aria-pressed={ambient}
              aria-label={ambient ? t.ambientOff : t.ambientOn} title={ambient ? t.ambientOff : t.ambientOn}
              onClick={toggleAmbient}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>
                {!ambient && <path d="M3 3l18 18" strokeWidth="1.6"/>}
              </svg>
            </button>
            <button type="button" className={`night-btn${night ? " is-on" : ""}`} aria-pressed={night}
              aria-label={night ? t.nightOff : t.nightOn} title={night ? t.nightOff : t.nightOn}
              onClick={()=>{ track("night_vision", { state: night ? "off" : "on" }); setNight(v=>!v); }}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>
            </button>
            <button type="button" className="lang" aria-label={t.switchLang} onClick={toggleLang}>
              <span className={lang==="es" ? "is-on" : ""} aria-hidden="true">ES</span>
              <span className={lang==="en" ? "is-on" : ""} aria-hidden="true">EN</span>
            </button>
            </div>
          </header>

          {/* Navegación principal: siempre visible */}
          <Tabs tab={tab} onChange={changeTab} lang={lang}/>

          <main className="shell app__main pt-4">
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={-1} className="panel">

              {navigator_ && (
                <div className="nav-wrap">
                <div className={`nav-grid nav-grid--${tab}`}>
                    {/* Origen y destino */}
                    <div className="picks nav-grid__picks">
                      <PlanetSelect value={from} onChange={pickOrigin} exclude={special ? null : to}
                        label={t.origin} kind="origin" lang={lang}/>
                      <button type="button" className="icon-btn picks__swap" aria-label={t.swap} onClick={swap} disabled={!!special}>
                        <IconSwap width={20} height={20}/>
                      </button>
                      <PlanetSelect value={to} onChange={pickDest} exclude={from}
                        label={t.destination} kind="dest" lang={lang} align="right"
                        special={special} onSpecial={pickSpecial}/>
                    </div>

                  <div className="nav-grid__map">
                    <SolarMap from={from} to={to} positions={positions} lang={lang} onPick={pickPlanet} special={special?.id || null} plan={mapPlan}
                      onPickSun={()=>{ if (special?.id !== "sun") pickSpecial(SPECIALS[1]); }}/>

                    <p className="map-caption">
                      <span className={`map-caption__src ${allReal ? "is-real" : ""}`}
                        role={posStatus==="loading" ? "status" : undefined}>
                        <span className="dot" aria-hidden="true"/>
                        {allReal ? t.mapNasa : posStatus==="loading" ? t.mapLoading : t.mapLocal}
                      </span>
                      <span>{special ? t.mapNoteSpecial : t.mapNote}{mapPlan && mapPlan.source==="today" ? ` ${t.mapNoWindow}` : ""}</span>
                    </p>
                  </div>

                  <div className="nav-grid__result stack">
                    {special && tab==="route" && (
                      <SectionBoundary name="Luna y Sol" title={TS[lang].errTitle} message={TS[lang].errBody} retryLabel={TS[lang].retry}>
                        <MoonSun lang={lang} only={special.id} onVenus={seeVenusWindows}/>
                      </SectionBoundary>
                    )}
                    {!special && tab==="route" && (<>
                      <RouteAnswer from={from} to={to} lang={lang} route={route}
                        loading={loadingB} onSeeWindows={seeWindows}/>
                      {notice}

                      {backend?.narrative && (
                        <figure className="narrative">
                          <blockquote>{backend.narrative}</blockquote>
                          <figcaption>{t.narrativeBy}</figcaption>
                        </figure>
                      )}

                      <div ref={winRef} id="windows" className="route-windows">
                        <LaunchWindows from={from} to={to} lang={lang} attempt={winTry} onError={setWinError} notice={null}/>
                      </div>

                      <VehicleCompare from={from} to={to} lang={lang} distKm={distKm}/>
                      <TechDetails lang={lang} route={route} distKm={distKm} distReal={!!realDist}/>
                      <SectionBoundary name="Trayectoria realista" title={TR[lang].boundaryTitle} message={TR[lang].boundaryBody} retryLabel={TR[lang].retry}>
                        <RealTrajectory from={from} to={to} lang={lang}/>
                      </SectionBoundary>
                      <SectionBoundary name="Catapultas" title={GA[lang].boundaryTitle} message={GA[lang].boundaryBody} retryLabel={GA[lang].retry}>
                        <GravityAssists from={from} to={to} lang={lang}/>
                      </SectionBoundary>
                      <SectionBoundary name="Planifica tu viaje con catapultas" title={MGA[lang].boundaryTitle} message={MGA[lang].boundaryBody} retryLabel={MGA[lang].retry}>
                        <MgaPlanner from={from} to={to} lang={lang}/>
                      </SectionBoundary>
                    </>)}

                  </div>

                </div>
                </div>
              )}

              {tab==="sky"&&(
                <ErrorBoundary variant="sky" lang={lang} onReset={retrySky}>
                  <Suspense fallback={<p role="status" className="loading">{t.loadingSky}</p>}>
                    <SkyView lang={lang} onMenu={()=>setMenuOpen(true)}/>
                  </Suspense>
                </ErrorBoundary>
              )}

              {tab==="now"&&(
                <NowPage lang={lang} View={NowView} onRetry={retryNow}/>
              )}

              {tab==="questions"&&(
                <QuestionsBoundary onReset={retryQuestions} title={t.questionsErrTitle}
                  message={t.questionsErrBody} retryLabel={t.retry}>
                  <Suspense fallback={<p role="status" className="loading">{t.loadingQuestions}</p>}>
                    <QuestionsView lang={lang} onSeeSky={seeExoplanetsInSky}/>
                  </Suspense>
                </QuestionsBoundary>
              )}
            </div>
          </main>

          {/* Pie: al final del contenido, o pegado al fondo si el contenido es
              corto. En el Cielo no existe: el visor ocupa toda la pantalla y
              abre los créditos desde su menú (evento "teseo:credits"). */}
          {tab!=="sky" && (
            <footer className="shell footer">
              <a href="https://yachaydeep.com" target="_blank" rel="noopener noreferrer" className="footer__link footer__link--made">
                {t.madeBy}
              </a>
              <span aria-hidden="true" className="footer__sep footer__sep--made"/>
              <a href="https://sites.google.com/view/killanan/inicio" target="_blank" rel="noopener noreferrer" className="footer__link footer__link--kn"
                onClick={()=>track("coop_open", { from: "footer" })}>
                {t.coopWith}
              </a>
              <span aria-hidden="true" className="footer__sep footer__sep--kn"/>
              <button type="button" onClick={()=>{ track("credits_open"); setShowCredits(true); }} className="footer__link">
                {t.creditsLink}
              </button>
            </footer>
          )}
        </div>
      </div>

      {showCredits && <CreditsModal lang={lang} onClose={closeCredits}/>}
      {usage && (
        <div className="usage-host">
          <SectionBoundary name="Teseo en números" onReset={retryUsage} title={t.usageErrTitle} message={t.usageErrBody} retryLabel={t.retry}>
            <Suspense fallback={<div className="modal"><p role="status" className="loading">{t.usageLoading}</p></div>}>
              <AdminGate lang={lang} onClose={closeUsage}>
                <UsageView lang={lang} api={API} initialDays={usage.days || undefined} onClose={closeUsage}/>
              </AdminGate>
            </Suspense>
          </SectionBoundary>
        </div>
      )}
    </>
  );
}
