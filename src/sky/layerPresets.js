// layerPresets.js — grupos de capas del cielo para encenderlas de una vez desde «Capas».
// Solo tocan las capas de objetos (catálogos); atmósfera, montañas, nubes y líneas guía se quedan como estén.

/** Las que vienen encendidas al empezar (el grupo «Básicas»). */
export const DEFAULT_LAYERS = ["photo", "ngc", "minor", "comets", "probes", "messier", "galaxies", "deepfields", "blackholes"];

export const LAYER_PRESETS = [
  { id: "essential", layers: ["photo", "messier", "comets"] },
  { id: "basic", layers: DEFAULT_LAYERS },
  { id: "advanced", layers: null },                       // null = todas las que existan
];

export const PRESET_T = {
  es: { title: "Encender por grupos", essential: "Imprescindibles", basic: "Básicas", advanced: "Avanzadas",
    hint: { essential: "Planetas, mapa fotográfico, Messier y cometas: lo justo para empezar.", basic: "Lo de siempre: además, asteroides, sondas, NGC, galaxias, campos profundos y agujeros negros.", advanced: "Todos los catálogos: también lluvias de meteoros, Caldwell, estrellas dobles, púlsares y exoplanetas. Con todo encendido el cielo se llena de nombres." },
    custom: "Elección propia: enciende o apaga cada capa abajo." },
  en: { title: "Turn on by group", essential: "Essentials", basic: "Basic", advanced: "Advanced",
    hint: { essential: "Planets, photographic map, Messier and comets: just enough to start.", basic: "The usual set: plus asteroids, probes, NGC, galaxies, deep fields and black holes.", advanced: "Every catalogue: also meteor showers, Caldwell, double stars, pulsars and exoplanets. With everything on, the sky fills with names." },
    custom: "Your own choice: switch each layer on or off below." },
};

/** { clave: bool } para todas las capas `keys` según el grupo `id` (o null si no existe). */
export function presetState(id, keys) {
  const p = LAYER_PRESETS.find((x) => x.id === id);
  if (!p) return null;
  const on = new Set(p.layers || keys);
  return Object.fromEntries(keys.map((k) => [k, on.has(k)]));
}

/** El grupo que coincide con lo encendido ahora (y con Sol, Luna y planetas a la vista), o null. */
export function presetOf(enabled, keys, solar = true) {
  if (!solar) return null;
  for (const p of LAYER_PRESETS) {
    const on = new Set(p.layers || keys);
    if (keys.every((k) => !!(enabled && enabled[k]) === on.has(k))) return p.id;
  }
  return null;
}
