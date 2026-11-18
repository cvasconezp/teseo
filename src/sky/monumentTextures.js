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
};

export const monumentTextureUrl = (kind, part) => `/textures/monuments/${kind}_${part}.webp`;

/**
 * Las tres texturas de un material. `onLoad` se llama una vez por imagen (cargada o fallida): la capa espera a
 * que estén todas antes de mostrar el monumento, para que no aparezca en negro.
 */
export function makeMonumentTexture(kind, THREE, onLoad) {
  const cfg = MON_MATS[kind] || MON_MATS.dirt, k = MON_MATS[kind] ? kind : "dirt";
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
