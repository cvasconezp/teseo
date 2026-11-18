// monumentTextures.js — materiales fotográficos de los monumentos y de su suelo (public/textures/monuments/).
// Cada material tiene tres imágenes de 1024 px: color (_c), relieve o mapa de normales (_n) y, en una sola
// imagen (_arm), oclusión ambiental (rojo) y rugosidad (verde). Son fotografías libres (CC0) de Poly Haven y
// ambientCG; ver CREDITS.md. `tile`: metros que cubre una repetición: las caras usan coordenadas en metros, así
// que un sillar mide lo que mide de verdad.
//
//   makeMonumentTexture(kind, THREE, onLoad) → { map, normalMap, armMap, tile, cfg }
//
// Solo se descargan los materiales del sitio que se está mirando.

/**
 * `tint`: color que multiplica la foto (para acercarla a la piedra del lugar); `normal`: fuerza del relieve;
 * `macro`: variación de tono a gran escala (rompe la repetición a lo lejos); `blend`: 1 en materiales sin
 * dibujo regular (hierba, arena, roca), donde a lo lejos se mezcla una segunda escala más grande.
 */
export const MON_MATS = {
  blocks: { tile: 4.6, tint: [0.97, 0.97, 0.97], normal: 1.4, macro: 0.6, blend: 0.5 },     // Guiza: hiladas de caliza
  casing: { tile: 6, tint: [1.0, 0.97, 0.9], normal: 0.8, macro: 0.5, blend: 0 },        // Kefrén: revestimiento
  basalt: { tile: 3.6, tint: [1.3, 1.22, 1.16], normal: 1.3, macro: 0.7, blend: 0.6 },    // Teotihuacan
  yucatan: { tile: 3.4, tint: [0.92, 0.9, 0.85], normal: 1.2, macro: 0.65, blend: 0 },   // Chichén Itzá
  sarsen: { tile: 3.2, tint: [0.86, 0.86, 0.84], normal: 1.5, macro: 0.5, blend: 0.35 }, // Stonehenge
  quartz: { tile: 2.6, tint: [1.08, 1.08, 1.06], normal: 1.2, macro: 0.3, blend: 0 },    // Newgrange: muro
  grass: { tile: 2.2, tint: [1.05, 1.1, 0.95], normal: 1.0, macro: 0.75, blend: 1, matte: true },
  sand: { tile: 4.5, tint: [1.1, 1.02, 0.9], normal: 1.0, macro: 0.6, blend: 1, matte: true },
  dirt: { tile: 3.5, tint: [0.9, 0.86, 0.8], normal: 1.0, macro: 0.6, blend: 1, matte: true },
  // metal acanalado (Paranal) y guijarros (Quitsato)
  metal: { tile: 5, tint: [3.1, 3.15, 3.2], normal: 0.7, macro: 0.2, blend: 0 },
  pebble: { tile: 1.8, tint: [0.72, 0.7, 0.67], normal: 1.2, macro: 0.4, blend: 0.6, matte: true },
  // los mismos archivos con otro tono (`src`: de qué material toman las fotos)
  gnomon: { src: "metal", tile: 9, tint: [6.0, 2.3, 0.45], normal: 0.25, macro: 0.15, blend: 0 },                    // Quitsato: el poste
  pebblelight: { src: "pebble", tile: 1.8, tint: [1.55, 1.5, 1.4], normal: 1.2, macro: 0.3, blend: 0.6, matte: true },  // Quitsato: líneas
  concrete: { src: "casing", tile: 7, tint: [0.9, 0.9, 0.9], normal: 0.5, macro: 0.4, blend: 0 },                    // Paranal: base
  tower: { src: "yucatan", tile: 4.2, tint: [1.0, 0.88, 0.7], normal: 1.3, macro: 0.6, blend: 0.3 },               // Chankillo: mampostería
  pirca: { src: "basalt", tile: 2.6, tint: [1.3, 1.24, 1.12], normal: 1.5, macro: 0.5, blend: 0.6 },                // Catequilla
  pircalight: { src: "basalt", tile: 2.6, tint: [1.9, 1.85, 1.7], normal: 1.2, macro: 0.3, blend: 0.6 },
  redstone: { src: "blocks", tile: 3.2, tint: [1.0, 0.76, 0.66], normal: 1.4, macro: 0.6, blend: 0.4 },             // Tiwanaku: arenisca
  andesite: { src: "sarsen", tile: 2.4, tint: [0.8, 0.82, 0.86], normal: 1.0, macro: 0.4, blend: 0.3 },             // Tiwanaku: andesita
  granite: { src: "sarsen", tile: 2.2, tint: [1.15, 1.15, 1.12], normal: 1.2, macro: 0.4, blend: 0.3 },             // Machu Picchu
  earth: { src: "dirt", tile: 3.5, tint: [0.98, 0.86, 0.68], normal: 1.0, macro: 0.7, blend: 1, matte: true },       // Akapana
  // suelos de cada lugar
  desert: { src: "sand", tile: 4.5, tint: [1.02, 0.84, 0.7], normal: 1.0, macro: 0.6, blend: 1, matte: true },       // Atacama: grava rojiza
  puna: { src: "sand", tile: 4.5, tint: [0.9, 0.86, 0.64], normal: 1.0, macro: 0.7, blend: 1, matte: true },         // altiplano: paja seca
  scrub: { src: "sand", tile: 4.5, tint: [0.74, 0.76, 0.56], normal: 1.0, macro: 0.8, blend: 1, matte: true },       // Catequilla: matorral seco
};

export const monumentTextureUrl = (kind, part) => `/textures/monuments/${kind}_${part}.webp`;

/**
 * Las tres texturas de un material. `onLoad` se llama una vez por imagen (cargada o fallida): la capa espera a
 * que estén todas antes de mostrar el monumento, para que no aparezca en negro.
 */
export function makeMonumentTexture(kind, THREE, onLoad) {
  const cfg = MON_MATS[kind] || MON_MATS.dirt, k = MON_MATS[kind] ? (cfg.src || kind) : "dirt";
  const loader = new THREE.TextureLoader();
  const done = () => { if (onLoad) onLoad(); };
  const mk = (part, color) => {
    const t = loader.load(monumentTextureUrl(k, part), done, undefined, done);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mk("c", true), normalMap: mk("n", false), armMap: mk("arm", false), tile: cfg.tile, cfg, parts: 3 };
}
