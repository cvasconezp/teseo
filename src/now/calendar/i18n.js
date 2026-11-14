// i18n.js — textos del Calendario del cielo (ES/EN). Los eventos (events.js) son datos neutros; aquí se
// convierten en título, «qué ver y cómo» y estado de visibilidad. Sin IA: plantillas fijas con números
// calculados. Los textos de la fuente (descripción de lanzamientos, regiones de la NASA) se muestran
// tal cual, en inglés y marcados como tales.
import { PLANET_EN } from "./astro.js";

export const TC = {
  es: {
    title: "Calendario del cielo",
    cert: "Calculado o citado",
    sub: "Próximos eventos astronómicos y espaciales visibles desde tu lugar.",
    forPlace: (name) => `Para ${name}`,
    changeInSky: "cambiar en Cielo",
    placeMe: "tu ubicación", placeCustom: (la, lo) => `${la}, ${lo}`,
    placeNote: "El lugar es el que elegiste en el Cielo; si no elegiste ninguno, Quito.",
    filters: "Filtrar por tipo",
    all: "Todo",
    types: { moon: "Luna", eclipse: "Eclipses", meteor: "Meteoros", planet: "Planetas", season: "Estaciones", iss: "ISS", launch: "Lanzamientos" },
    range90: "Próximos 90 días", range365: "Próximos 12 meses",
    showMore: "Ver más: hasta 12 meses", showLess: "Ver solo 90 días",
    computing: "Calculando el cielo…",
    empty: "No hay eventos de este tipo en el período.",
    count: (n) => (n === 1 ? "1 evento" : `${n} eventos`),
    visYes: "Visible desde tu lugar", visNo: "No visible aquí", visPartial: "Visible en parte",
    addCal: "A mi calendario", addCalFor: (t) => `Añadir a mi calendario: ${t}`,
    seeSky: "Ver en el cielo", seeSkyFor: (t) => `Ver en el cielo: ${t}`, seeSkyNote: "Abre el Cielo con el astro elegido, tal como está ahora.",
    whatLabel: "Qué ver", approxDate: "Fecha aproximada",
    allDayNote: "Fecha del catálogo; el máximo real puede variar ±1 día.",
    localTime: "Fechas y horas en la zona horaria de tu dispositivo.",
    utc: "UTC", opensNew: "se abre en una pestaña nueva",
    sources: "Fuentes",
    srcText: "Fases de la Luna y planetas: efemérides de Teseo (Schlyter), contrastadas con el USNO y con In-The-Sky.org. Eclipses: catálogo de la NASA (GSFC, F. Espenak). Estaciones: Meeus, Astronomical Algorithms, cap. 27. Meteoros: catálogo de la IMO. ISS: CelesTrak + SGP4. Lanzamientos: Launch Library 2.",
    issNote: "Las pasadas de la ISS se calculan para los próximos 10 días como máximo.",
    launchNote: "Solo se muestran lanzamientos tripulados, de ciencia, a la Luna o pruebas de vehículos nuevos; los de megaconstelaciones de rutina (Starlink, Kuiper…) se omiten.",
    reason: { crew: "Tripulado", science: "Ciencia", moon: "Luna", test: "Prueba de vehículo nuevo" },
    description: "Descripción (en inglés, de la fuente)", webcast: "Ver en directo", moreInfo: "Más información",
    nasaMap: "Mapa de la NASA", nasaCatalog: "Catálogo de la NASA",
    ics: { descTail: "Teseo · Calendario del cielo (calculado en tu dispositivo)." },
  },
  en: {
    title: "Sky calendar",
    cert: "Calculated or cited",
    sub: "Upcoming astronomical and space events visible from your place.",
    forPlace: (name) => `For ${name}`,
    changeInSky: "change in Sky",
    placeMe: "your location", placeCustom: (la, lo) => `${la}, ${lo}`,
    placeNote: "The place is the one you chose in the Sky tab; if you chose none, Quito.",
    filters: "Filter by type",
    all: "All",
    types: { moon: "Moon", eclipse: "Eclipses", meteor: "Meteors", planet: "Planets", season: "Seasons", iss: "ISS", launch: "Launches" },
    range90: "Next 90 days", range365: "Next 12 months",
    showMore: "Show more: up to 12 months", showLess: "Show 90 days only",
    computing: "Computing the sky…",
    empty: "No events of this type in the period.",
    count: (n) => (n === 1 ? "1 event" : `${n} events`),
    visYes: "Visible from your place", visNo: "Not visible here", visPartial: "Partly visible",
    addCal: "Add to calendar", addCalFor: (t) => `Add to my calendar: ${t}`,
    seeSky: "See in the sky", seeSkyFor: (t) => `See in the sky: ${t}`, seeSkyNote: "Opens the Sky tab on the chosen object, as it is right now.",
    whatLabel: "What to look for", approxDate: "Approximate date",
    allDayNote: "Catalog date; the real peak can vary by ±1 day.",
    localTime: "Dates and times in your device's time zone.",
    utc: "UTC", opensNew: "opens in a new tab",
    sources: "Sources",
    srcText: "Moon phases and planets: Teseo ephemeris (Schlyter), checked against USNO and In-The-Sky.org. Eclipses: NASA catalog (GSFC, F. Espenak). Seasons: Meeus, Astronomical Algorithms, ch. 27. Meteors: IMO catalog. ISS: CelesTrak + SGP4. Launches: Launch Library 2.",
    issNote: "ISS passes are computed for at most the next 10 days.",
    launchNote: "Only crewed, science, lunar or new-vehicle test launches are shown; routine megaconstellation launches (Starlink, Kuiper…) are left out.",
    reason: { crew: "Crewed", science: "Science", moon: "Moon", test: "New vehicle test" },
    description: "Description (from the source)", webcast: "Watch live", moreInfo: "More information",
    nasaMap: "NASA map", nasaCatalog: "NASA catalog",
    ics: { descTail: "Teseo · Sky calendar (computed on your device)." },
  },
};

const PL = {
  es: { Mercurio: "Mercurio", Venus: "Venus", Marte: "Marte", "Júpiter": "Júpiter", Saturno: "Saturno", Urano: "Urano", Neptuno: "Neptuno", Luna: "la Luna" },
  en: { Mercurio: "Mercury", Venus: "Venus", Marte: "Mars", "Júpiter": "Jupiter", Saturno: "Saturn", Urano: "Uranus", Neptuno: "Neptune", Luna: "the Moon" },
};
const MONTH_ES = { marEquinox: "Equinoccio de marzo", junSolstice: "Solsticio de junio", sepEquinox: "Equinoccio de septiembre", decSolstice: "Solsticio de diciembre" };
const MONTH_EN = { marEquinox: "March equinox", junSolstice: "June solstice", sepEquinox: "September equinox", decSolstice: "December solstice" };

/** Cómo observar un astro según su magnitud (límite a simple vista ≈ 6 con cielo oscuro; prismáticos ≈ 9–10). */
export function howToSee(mag, lang) {
  const es = lang === "es";
  if (mag == null) return es ? "A simple vista o con prismáticos." : "Naked eye or binoculars.";
  if (mag <= 4.5) return es ? "A simple vista." : "Naked eye.";
  if (mag <= 6.5) return es ? "Con prismáticos; a simple vista solo con cielo muy oscuro." : "With binoculars; naked eye only under very dark skies.";
  if (mag <= 10) return es ? "Con prismáticos grandes o telescopio." : "With large binoculars or a telescope.";
  return es ? "Con telescopio." : "With a telescope.";
}
const magText = (m, f) => (m == null ? "" : ` (${f.mag} ${f.n(m, 1)})`);

/**
 * @param ev   evento de events.js
 * @param lang "es" | "en"
 * @param f    ayudas de formato del componente: { time(ms), date(ms), n(x, dec), pct(x) , mag }
 * @returns {{ title, what, vis: {state, text}|null, note?: string, links: [{href, label}], sky: string|null, icsDesc: string, region?: string }}
 */
export function describeEvent(ev, lang, f) {
  const es = lang === "es", T = TC[lang], P = PL[lang], d = ev.data;
  const out = { title: "", what: "", vis: null, note: null, links: [], sky: null, region: null };
  const vis = (state, text) => { out.vis = state === null ? null : { state, text }; };
  const planetHash = (n) => `#sky?o=solar~${encodeURIComponent(n)}`;
  const bestTxt = (b) => (b ? (es ? ` Mejor a las ${f.time(b.t)} (hora de tu dispositivo), a ${f.n(b.alt, 0)}° de altura.` : ` Best at ${f.time(b.t)} (your device's time), ${f.n(b.alt, 0)}° high.`) : "");

  switch (ev.type) {
    case "moon": {
      const m = {
        new: [es ? "Luna nueva" : "New Moon", es ? "La Luna no se ve: es la noche más oscura del mes para galaxias, nebulosas y la Vía Láctea. A simple vista, prismáticos o telescopio, desde un lugar sin luces." : "The Moon is out of sight: the darkest night of the month for galaxies, nebulae and the Milky Way. Naked eye, binoculars or telescope, from a dark site."],
        firstQuarter: [es ? "Cuarto creciente" : "First quarter Moon", es ? "Media Luna al atardecer. Con prismáticos o telescopio, la línea entre luz y sombra (el terminador) muestra los cráteres con más relieve." : "Half Moon at dusk. With binoculars or a telescope, the line between light and shadow (the terminator) shows craters in strong relief."],
        full: [es ? "Luna llena" : "Full Moon", es ? "Sale al atardecer y brilla toda la noche. A simple vista se ven los mares; con prismáticos, los rayos de los cráteres. Su luz apaga las estrellas débiles." : "Rises at dusk and shines all night. Naked eye shows the maria; binoculars show crater rays. Its light drowns out faint stars."],
        lastQuarter: [es ? "Cuarto menguante" : "Last quarter Moon", es ? "Media Luna que sale a medianoche y se ve de madrugada. Buen momento para ver su relieve con prismáticos antes del amanecer." : "Half Moon that rises around midnight and shows in the small hours. A good time for binoculars before dawn."],
      }[ev.sub];
      out.title = m[0]; out.what = m[1]; out.sky = planetHash("Luna");
      break;
    }
    case "eclipse": {
      if (ev.sub === "moon") {
        const kind = { total: es ? "total" : "total", partial: es ? "parcial" : "partial", penumbral: "penumbral" }[d.type];
        out.title = es ? `Eclipse lunar ${kind}` : `${kind[0].toUpperCase()}${kind.slice(1)} lunar eclipse`;
        const what = {
          total: es ? `La Luna entra en la sombra de la Tierra y se tiñe de rojo; la totalidad dura ${d.totMin} min. A simple vista; con prismáticos se aprecia mejor el color.` : `The Moon enters Earth's shadow and turns red; totality lasts ${d.totMin} min. Naked eye; binoculars bring out the colour.`,
          partial: es ? `La sombra de la Tierra tapa parte de la Luna (magnitud ${f.n(d.mag, 2)}). A simple vista; prismáticos para ver el borde de la sombra.` : `Earth's shadow covers part of the Moon (magnitude ${f.n(d.mag, 2)}). Naked eye; binoculars show the shadow's edge.`,
          penumbral: es ? "Oscurecimiento muy tenue por la penumbra: casi imperceptible a simple vista; se nota mejor en fotos." : "Very faint dimming from the penumbra: nearly imperceptible to the naked eye; easier on photos.",
        }[d.type];
        out.what = `${what} ${es ? "Máximo" : "Maximum"}: ${f.time(ev.t)}.`;
        const a = d.vis.altMax, alt = `${f.n(Math.abs(a), 0)}°`;
        if (d.vis.state === "yes") vis(true, es ? `La Luna está a ${alt} sobre el horizonte en el máximo.` : `The Moon is ${alt} above the horizon at maximum.`);
        else if (d.vis.state === "partial") vis("partial", es ? `En el máximo la Luna está bajo el horizonte (${alt}); se ve solo al comienzo o al final.` : `At maximum the Moon is below the horizon (${alt}); you only catch the start or the end.`);
        else vis(false, es ? `En el máximo la Luna está bajo el horizonte (${alt}).` : `At maximum the Moon is below the horizon (${alt}).`);
        out.region = d.region; out.links.push({ href: d.source, label: T.nasaCatalog });
        out.sky = planetHash("Luna");
      } else {
        const kind = { annular: es ? "anular" : "annular", total: "total", partial: es ? "parcial" : "partial" }[d.type];
        out.title = es ? `Eclipse solar ${kind}` : `${kind[0].toUpperCase()}${kind.slice(1)} solar eclipse`;
        out.what = es
          ? `Máximo: ${f.time(ev.t)}. NUNCA mires al Sol sin gafas con filtro solar certificado (ISO 12312-2) o proyección; ni a simple vista ni con prismáticos o telescopio sin filtro.`
          : `Maximum: ${f.time(ev.t)}. NEVER look at the Sun without certified solar eclipse glasses (ISO 12312-2) or projection; not with the naked eye, binoculars or a telescope without a filter.`;
        const band = d.type === "annular" ? (es ? "anularidad" : "annularity") : (es ? "totalidad" : "totality");
        if (d.ecuador === "yes") vis(true, es ? `Visible desde Ecuador: sí. Según la NASA, la franja de ${band} cruza Ecuador (${d.central.replace(/^[A-Za-z]+:\s*/, "")}); fuera de ella se ve parcial. Consulta el mapa para tu ciudad.` : `Visible from Ecuador: yes. According to NASA, the path of ${band} crosses Ecuador (${d.central.replace(/^[A-Za-z]+:\s*/, "")}); outside it you see a partial eclipse. Check the map for your city.`);
        else if (d.ecuador === "partial") vis("partial", es ? "Visible desde Ecuador: parcial. La NASA cita «Sudamérica» sin detallar Ecuador: consulta el mapa antes de salir." : "Visible from Ecuador: partial. NASA lists “South America” without detailing Ecuador: check the map before heading out.");
        else if (d.ecuador === "no") vis(false, es ? "Visible desde Ecuador: no. Ecuador no figura en la región de visibilidad que da la NASA." : "Visible from Ecuador: no. Ecuador is not in the visibility region NASA gives.");
        else vis(null);
        if (d.ecuador === "map") out.note = es ? "Consulta el mapa de la NASA para tu lugar." : "Check the NASA map for your place.";
        out.region = d.region; out.links.push({ href: d.map, label: T.nasaMap });
      }
      break;
    }
    case "meteor": {
      const o = d.shower, name = es ? o.name : (o.name_en || o.name);
      out.title = es ? `Lluvia de meteoros: ${name}` : `Meteor shower: ${name}`;
      const peakIn = es ? "Pico" : "Peak";
      const mo = d.moon;
      const moonTxt = !mo ? "" : mo.level === "none"
        ? (mo.up ? (es ? `La Luna (${f.pct(mo.illum)} iluminada) es fina y casi no estorba.` : `The Moon (${f.pct(mo.illum)} lit) is thin and barely gets in the way.`) : (es ? "A esa hora la Luna está bajo el horizonte: no estorba." : "At that time the Moon is below the horizon: no interference."))
        : mo.level === "some" ? (es ? `La Luna (${f.pct(mo.illum)} iluminada) está en el cielo y aclara algo el fondo.` : `The Moon (${f.pct(mo.illum)} lit) is up and brightens the background a little.`)
        : (es ? `La Luna (${f.pct(mo.illum)} iluminada) estorba: aclara el cielo y apaga los meteoros débiles.` : `The Moon (${f.pct(mo.illum)} lit) gets in the way: it brightens the sky and hides faint meteors.`);
      out.what = es
        ? `${peakIn} según el catálogo de la IMO: hasta ~${o.zhr} meteoros por hora (THZ, la tasa teórica con cielo ideal; verás menos). Sin instrumentos: tumbado, mirando a todo el cielo desde un lugar oscuro, tras 20 min de adaptación. ${d.risesInNight ? `El radiante llega a ${f.n(d.maxAlt, 0)}° a las ${f.time(d.best.t)}.` : ""} ${moonTxt}`
        : `${peakIn} per the IMO catalog: up to ~${o.zhr} meteors per hour (ZHR, the theoretical rate under ideal skies; you will see fewer). No instruments: lie back, look at the whole sky from a dark site after 20 min of adaptation. ${d.risesInNight ? `The radiant reaches ${f.n(d.maxAlt, 0)}° at ${f.time(d.best.t)}.` : ""} ${moonTxt}`;
      out.what = out.what.replace(/\s+/g, " ").trim();
      if (!d.risesInNight) vis(false, es ? "El radiante no sube sobre el horizonte durante la noche desde tu lugar." : "The radiant does not rise above the horizon during the night from your place.");
      else if (d.maxAlt < 15) vis(true, es ? `El radiante sube solo a ${f.n(d.maxAlt, 0)}°: verás pocos meteoros.` : `The radiant only reaches ${f.n(d.maxAlt, 0)}°: you will see few meteors.`);
      else vis(true, es ? `El radiante sube hasta ${f.n(d.maxAlt, 0)}° esa noche.` : `The radiant rises to ${f.n(d.maxAlt, 0)}° that night.`);
      out.note = T.allDayNote;
      out.sky = `#sky?o=meteors~${encodeURIComponent(o.name)}`;
      break;
    }
    case "planet": {
      const visT = (okES, okEN, noES, noEN) => (ev.visible ? vis(true, es ? okES : okEN) : vis(false, es ? noES : noEN));
      if (ev.sub === "opposition") {
        const p = P[d.planet];
        out.title = es ? `${d.planet} en oposición` : `${p} at opposition`;
        out.what = (es
          ? `Opuesto al Sol: sale al atardecer, culmina a medianoche y se ve toda la noche, en su época más brillante y cercana${magText(d.mag, f)}. ${howToSee(d.mag, lang)}`
          : `Opposite the Sun: rises at dusk, peaks at midnight and shows all night, at its brightest and closest${magText(d.mag, f)}. ${howToSee(d.mag, lang)}`);
        visT(`Está sobre el horizonte con el cielo oscuro.${bestTxt(d.best)}`, `Above the horizon in a dark sky.${bestTxt(d.best)}`, "No está sobre el horizonte con el cielo oscuro esa noche.", "Not above the horizon in a dark sky that night.");
        out.sky = planetHash(d.planet);
      } else if (ev.sub === "elongation") {
        const p = P[d.planet], east = d.side === "east";
        out.title = es ? `${d.planet}: máxima elongación ${east ? "este" : "oeste"} (${f.n(d.elong, 1)}°)` : `${p}: greatest ${east ? "eastern" : "western"} elongation (${f.n(d.elong, 1)}°)`;
        out.what = es
          ? `${d.planet} alcanza su mayor separación angular del Sol: ${f.n(d.elong, 1)}°${magText(d.mag, f)}. Se ve ${east ? "al atardecer, bajo en el oeste, tras ponerse el Sol" : "poco antes del amanecer, bajo en el este"}. ${howToSee(d.mag, lang)} Horizonte despejado; los prismáticos ayudan a encontrarlo.`
          : `${p} reaches its widest angular separation from the Sun: ${f.n(d.elong, 1)}°${magText(d.mag, f)}. It shows ${east ? "at dusk, low in the west, after sunset" : "shortly before dawn, low in the east"}. ${howToSee(d.mag, lang)} Clear horizon; binoculars help to find it.`;
        visT(`Se ve en el crepúsculo con el cielo aún oscuro.${bestTxt(d.best)}`, `Shows in twilight with the sky still dark.${bestTxt(d.best)}`, "No queda sobre el horizonte con el cielo oscuro ese día.", "Not above the horizon in a dark sky that day.");
        out.sky = planetHash(d.planet);
      } else if (ev.sub === "moonConj") {
        const p = P[d.b];
        out.title = es ? `Luna y ${d.b}: ${f.n(d.sep, 1)}° de separación` : `Moon and ${p}: ${f.n(d.sep, 1)}° apart`;
        out.what = es
          ? `La Luna pasa a ${f.n(d.sep, 1)}° de ${d.b}${magText(d.mag, f)} (separación geocéntrica; desde tu lugar puede variar hasta ~1° por la paralaje de la Luna). A simple vista; con prismáticos caben en el mismo campo.`
          : `The Moon passes ${f.n(d.sep, 1)}° from ${p}${magText(d.mag, f)} (geocentric separation; from your place it can differ by up to ~1° because of lunar parallax). Naked eye; both fit in the same binocular field.`;
        visT(`Ambos sobre el horizonte con el cielo oscuro.${bestTxt(d.best)}`, `Both above the horizon in a dark sky.${bestTxt(d.best)}`, "No están a la vez sobre el horizonte con el cielo oscuro en esas horas.", "Not both above the horizon in a dark sky at those hours.");
        out.sky = planetHash(d.b);
      } else {
        out.title = es ? `${d.a} y ${d.b}: conjunción a ${f.n(d.sep, 1)}°` : `${P[d.a]} and ${P[d.b]}: conjunction at ${f.n(d.sep, 1)}°`;
        out.what = es
          ? `Dos planetas a ${f.n(d.sep, 1)}° en su mayor acercamiento aparente (${d.a}${magText(d.magA, f)}, ${d.b}${magText(d.magB, f)}). A simple vista se ven casi juntos; con telescopio caben en el mismo campo.`
          : `Two planets ${f.n(d.sep, 1)}° apart at their closest apparent approach (${P[d.a]}${magText(d.magA, f)}, ${P[d.b]}${magText(d.magB, f)}). Naked eye they look almost together; in a telescope both fit in the same field.`;
        visT(`Ambos sobre el horizonte con el cielo oscuro.${bestTxt(d.best)}`, `Both above the horizon in a dark sky.${bestTxt(d.best)}`, "No están a la vez sobre el horizonte con el cielo oscuro en esas horas.", "Not both above the horizon in a dark sky at those hours.");
        out.sky = planetHash(d.a);
      }
      break;
    }
    case "season": {
      out.title = (es ? MONTH_ES : MONTH_EN)[ev.sub];
      const high = d.noonAlt >= 85;
      out.what = d.kind === "equinox"
        ? (es ? `Día y noche casi iguales en todo el planeta. Al mediodía solar el Sol culmina a ${f.n(d.noonAlt, 0)}° desde tu lugar${high ? ": casi en el cenit, y las sombras casi desaparecen" : ""}. No mires al Sol directamente.` : `Day and night are nearly equal worldwide. At solar noon the Sun peaks ${f.n(d.noonAlt, 0)}° high from your place${high ? ": almost at the zenith, and shadows nearly vanish" : ""}. Do not look at the Sun directly.`)
        : (es ? `El Sol llega a su punto más ${ev.sub === "junSolstice" ? "al norte" : "al sur"} del año. Al mediodía solar culmina a ${f.n(d.noonAlt, 0)}° desde tu lugar. Se nota en la sombra de un palo: se puede medir.` : `The Sun reaches its ${ev.sub === "junSolstice" ? "northernmost" : "southernmost"} point of the year. At solar noon it peaks ${f.n(d.noonAlt, 0)}° high from your place. You can see it in a stick's shadow.`);
      break;
    }
    case "iss": {
      out.title = es ? "Pasada visible de la ISS" : "Visible ISS pass";
      const a = d.from && (es ? d.from.compass_es : d.from.compass), b = d.to && (es ? d.to.compass_es : d.to.compass);
      out.what = es
        ? `Un punto brillante que no parpadea cruza el cielo${a && b ? ` de ${a} a ${b}` : ""}${d.maxAlt != null ? `, hasta ${f.n(d.maxAlt, 0)}° de altura` : ""}${d.durationS ? `, durante ~${Math.max(1, Math.round(d.durationS / 60))} min` : ""}${d.mag != null ? ` (magnitud ≈ ${f.n(d.mag, 1)})` : ""}. A simple vista.`
        : `A bright, steady dot crosses the sky${a && b ? ` from ${a} to ${b}` : ""}${d.maxAlt != null ? `, up to ${f.n(d.maxAlt, 0)}° high` : ""}${d.durationS ? `, for ~${Math.max(1, Math.round(d.durationS / 60))} min` : ""}${d.mag != null ? ` (magnitude ≈ ${f.n(d.mag, 1)})` : ""}. Naked eye.`;
      vis(true, es ? "La ISS está iluminada y el cielo, oscuro." : "The ISS is sunlit and the sky is dark.");
      break;
    }
    case "launch": {
      const l = d.launch;
      out.title = l.name || l.mission || "—";
      const bits = [];
      if (l.provider && l.provider !== "—") bits.push(l.provider);
      if (l.rocket) bits.push(l.rocket);
      const loc = [l.pad, l.location].filter(Boolean).join(", ");
      out.what = [bits.join(" · "), loc ? (es ? `Desde ${loc}.` : `From ${loc}.`) : "", es ? "Se sigue por transmisión en línea; no se ve desde aquí." : "Follow it on the online broadcast; it is not visible from here."].filter(Boolean).join(" ");
      out.note = ev.approx ? (es ? "Fecha prevista (sin hora fija): las fechas de lanzamiento suelen moverse." : "Planned date (no fixed time): launch dates often slip.") : (es ? "Hora prevista (NET): las fechas de lanzamiento suelen moverse." : "Planned time (NET): launch dates often slip.");
      const safe = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);
      if (safe(l.webcast_url)) out.links.push({ href: safe(l.webcast_url), label: T.webcast });
      if (safe(l.info_url)) out.links.push({ href: safe(l.info_url), label: T.moreInfo });
      out.reasons = d.reasons.map(r => T.reason[r]);
      out.desc = l.description || null;
      break;
    }
    default: break;
  }
  out.icsDesc = [out.what, out.vis ? out.vis.text : "", out.region ? `NASA: ${out.region}` : "", T.ics.descTail].filter(Boolean).join("\n");
  return out;
}

export { PLANET_EN };
