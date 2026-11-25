// Buscador del Cielo: qué categoría (capa entera) pide lo escrito. Sacado de Constellations.jsx para probarlo en Node.
// La coincidencia es por INICIO del término: «ome» no es «cometas», «tar» no es «púlsares», «ald» no es «Caldwell»
// (antes valía cualquier trozo y los nombres propios encendían capas ajenas).
export const CATEGORY_TERMS = [
  // los púlsares son estrellas de neutrones (y «neutrinos» es una confusión frecuente: también lleva aquí)
  { key: "pulsars",    terms: ["pulsar", "pulsares", "pulsars", "púlsar", "púlsares", "estrella de neutrones", "estrellas de neutrones", "neutrones", "neutron star", "neutron stars", "magnetar", "magnetares", "magnetars", "estrella de neutrinos", "estrellas de neutrinos"] },
  { key: "blackholes", terms: ["agujero negro", "agujeros negros", "agujero", "hoyo negro", "black hole", "blackhole", "black holes"] },
  { key: "deepfields", terms: ["campo profundo", "campos profundos", "deep field", "deep fields", "ultra deep", "ultraprofundo", "hudf", "smacs"] },
  { key: "galaxies",   terms: ["galaxia", "galaxias", "galaxy", "galaxies"] },
  { key: "comets",     terms: ["cometa", "cometas", "comet", "comets"] },
  { key: "minor",      terms: ["asteroide", "asteroides", "asteroid", "asteroids", "planeta enano", "planetas enanos", "dwarf planet", "dwarf planets"] },
  { key: "meteors",    terms: ["meteoro", "meteoros", "lluvia de meteoros", "lluvias", "meteor", "meteor shower"] },
  { key: "caldwell",   terms: ["caldwell"] },
  { key: "oddities",   terms: ["nebulosa oscura", "nebulosas oscuras", "dark nebula", "supernova", "supernovas", "supernovae", "cuásar", "cuasar", "cuásares", "cuasares", "quasar", "quasars", "cúmulo de galaxias", "cumulo de galaxias", "galaxy cluster"] },
  { key: "specialstars", terms: ["estrella doble", "estrellas dobles", "double star", "double stars", "estrella variable", "estrellas variables", "variable star", "variable stars", "cefeida", "cepheid"] },
  { key: "ngc",        terms: ["ngc", "catálogo ngc", "catalogo ngc", "new general catalogue"] },
  { key: "messier",    terms: ["messier", "nebulosa", "nebulosas", "cúmulo", "cumulo", "cúmulos", "nebula", "cluster"] },
  { key: "exoplanets", terms: ["exoplaneta", "exoplanetas", "exoplanet", "exoplanets"] },
  { key: "probes",     terms: ["sonda", "sondas", "telescopio", "telescopios", "telescopio espacial", "nave", "naves", "satélite", "satelite", "satélites", "satelites", "misión", "mision", "misiones", "probe", "probes", "spacecraft", "telescope", "telescopes", "satellite", "satellites", "mission", "missions", "voyager"] },
];

// "sat" debe seguir encontrando Saturno (y "mar" Marte), no la categoría "satélites"
const SOLAR = ["sol", "sun", "luna", "moon", "mercurio", "mercury", "venus", "marte", "mars", "júpiter", "jupiter", "saturno", "saturn", "urano", "uranus", "neptuno", "neptune"];

export function categoryOf(query) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 3) return null;
  if (SOLAR.some(n => n.startsWith(q))) return null;
  // los términos de varias palabras ("estrella de neutrones") solo cuentan cuando ya se escribió más de una
  // palabra: así "estrella" sigue buscando estrellas por nombre. Lo escrito debe ser el comienzo del término.
  const hit = (t) => (t.includes(" ") && !q.includes(" ")) ? false : t.startsWith(q);
  return CATEGORY_TERMS.find(c => c.terms.some(hit)) || null;
}
