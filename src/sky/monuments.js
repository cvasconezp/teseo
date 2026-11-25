// monuments.js — monumentos astronómicos y arqueológicos dibujados en el cielo de «Mi cielo», con sus medidas
// reales y en su sitio exacto. Puro (sin three.js): datos, geometría en metros y proyección al cielo del lugar.
// Se prueba en scripts/test_monuments.mjs; la capa que los pinta es src/sky/monumentLayer.js.
//
// Medidas: alto y lado de la base de cada monumento (Wikipedia y fichas de los sitios); la forma es
// simplificada (cuerpos escalonados sin escaleras ni templos menores, piedras como bloques). Posición: el centro
// de cada pirámide se comprobó con el modelo de relieve (SRTM: el bulto de la pirámide), salvo El Castillo y
// Micerino (donde el modelo mezcla árboles o la ladera; coordenadas de Wikipedia). La base se asienta sobre el
// suelo del mismo modelo (el servidor da la altura del terreno alrededor: /api/elevation).
//
// Sitios añadidos en la segunda tanda (Chankillo, Quitsato, Catequilla, Paranal, Tiwanaku y el Intihuatana de
// Machu Picchu): la posición de cada estructura se leyó sobre imagen satelital (Esri World Imagery) con una
// rejilla en metros, con un margen de unos 3 a 5 m, y se contrastó con lo publicado: en Chankillo, las torres
// cubren el arco anual del Sol visto desde el punto de observación oeste (Ghezzi y Ruggles 2007); en Catequilla,
// el disco lítico cae donde lo sitúan las coordenadas UTM de Cobo (2017) y el muro mide 107 m de arco con 68 m
// de diámetro; en Paranal, la separación entre los cuatro telescopios es la de las estaciones del VLTI (ESO).
// Las medidas (alto, diámetro, lado) son las publicadas; lo aproximado se dice en cada entrada.
//
// Marco local: E (este), N (norte), U (arriba), en metros desde el centro de la base del monumento.

const RAD = Math.PI / 180;
const R_E = 6371008.8, K_REFR = 0.13;
export const EYE_M = 1.7;

// colores (sRGB 0–1) de la piedra a pleno sol
const BASALT = [0.55, 0.5, 0.46];      // Teotihuacan: piedra volcánica y estuco perdido
const LIMESTONE = [0.82, 0.74, 0.58];  // Guiza: caliza
const YUCATAN = [0.8, 0.77, 0.68];     // Chichén Itzá: caliza clara
const SARSEN = [0.62, 0.61, 0.56];     // Stonehenge: arenisca sarsen
const QUARTZ = [0.9, 0.89, 0.86];      // Newgrange: muro de cuarzo
const GRASS = [0.42, 0.55, 0.3];       // Newgrange: el túmulo con hierba
const TAN = [0.74, 0.66, 0.52];        // Chankillo: piedra y mortero de barro
const PIRCA = [0.6, 0.57, 0.52];       // Catequilla: muro de piedra de campo
const STEEL = [0.78, 0.8, 0.82];       // Paranal: cerramiento metálico
const ORANGE = [0.9, 0.45, 0.12];      // Quitsato: el poste
const PEBBLE = [0.5, 0.48, 0.45];      // Quitsato: mosaico de piedra
const EARTH = [0.55, 0.47, 0.36];      // Tiwanaku: Akapana, hoy un cerro de tierra
const REDSTONE = [0.66, 0.5, 0.42];    // Tiwanaku: arenisca roja de Kalasasaya
const ANDESITE = [0.55, 0.56, 0.58];   // Tiwanaku: andesita gris (Puerta del Sol, estela Ponce)
const GRANITE = [0.72, 0.72, 0.7];     // Machu Picchu: granito
const INGA = [0.6, 0.6, 0.58];         // Ingapirca: andesita labrada
const TRAVERTINE = [0.8, 0.74, 0.62];  // Coliseo: travertino
const SAND_C = [0.78, 0.68, 0.5];      // Coliseo: la arena
const SOAPSTONE = [0.82, 0.81, 0.77];  // Cristo Redentor: esteatita
const MARBLE = [0.92, 0.91, 0.88];     // Taj Mahal: mármol blanco
const NUBIAN = [0.78, 0.6, 0.42];      // Abu Simbel: arenisca
const KHMER = [0.6, 0.58, 0.5];         // Angkor Wat: arenisca gris

// Chankillo: las Trece Torres, de norte (1) a sur (13). Desplazamiento [este, norte] en metros desde el punto
// de referencia (9,561149° S, 78,227355° O), giro de la planta y alto. La fila mide unos 205 m; las tres últimas
// se tuercen hacia el suroeste. Planta de unos 12 × 8 m (publicado: 75 a 125 m²) con ~4,5 m entre torres. El alto
// publicado va de 2 a 6 m: el de cada torre aquí es aproximado.
const CH0 = [-9.561149, -78.227355];
const CH_TOWERS = [[-15, 95, 0, 4.5], [-15, 79, 0, 5], [-15, 63, 0, 5.5], [-13, 47, 0, 6], [-12, 31, 0, 5.5], [-12, 15, 0, 5], [-12, -1, 0, 4.5],
  [-12, -17, 0, 4.5], [-12, -33, 0, 5], [-12, -49, 0, 5], [-15, -65, 12, 4.5], [-21, -81, 20, 4], [-27, -97, 22, 3]];
const mPerLat = 110574, mPerLon = (lat) => 111320 * Math.cos(lat * RAD);
const chankillo = CH_TOWERS.map(([e, n, rot, h], i) => ({
  id: `chankillo-${i + 1}`, site: "chankillo", name: { es: "Trece Torres", en: "Thirteen Towers" },
  sub: { es: "13 torres de 2 a 6 m de alto", en: "13 towers, 2 to 6 m tall" }, label: i === 6,
  lat: +(CH0[0] + n / mPerLat).toFixed(6), lon: +(CH0[1] + e / mPerLon(CH0[0])).toFixed(6),
  kind: "tower", w: 8, d: 12, height: h, rot, foot: 7.2, ring: 3, far: 4000, relief: true, color: TAN, mat: "tower", ground: "sand", solid: true,
}));
// Paranal: los cuatro telescopios de 8,2 m del VLT. Separación entre ellos: estaciones U1–U4 del VLTI (ESO,
// «VLTI Station Position Technical Data»), en metros [este, norte] desde el centro de la red; ese centro se
// ancló sobre la imagen satelital (24,627477° S, 70,404966° O). Cerramiento: cilindro de 29 m de diámetro y
// 28,5 m de alto (ESO).
const VLT0 = [-24.627477, -70.404966];
const VLT_UT = [["ut1", "Antu", -9.925, -20.335], ["ut2", "Kueyen", 14.887, 30.502], ["ut3", "Melipal", 44.915, 66.183], ["ut4", "Yepun", 103.306, 43.999]];
const paranal = VLT_UT.map(([id, nm, e, n], i) => ({
  id: `vlt-${id}`, site: "paranal", name: { es: `VLT UT${i + 1} · ${nm}`, en: `VLT UT${i + 1} · ${nm}` },
  lat: +(VLT0[0] + n / 110750).toFixed(6), lon: +(VLT0[1] + e / mPerLon(VLT0[0])).toFixed(6),
  sub: { es: "28,5 m de alto · 29 m de diámetro", en: "28.5 m tall · 29 m across" },
  kind: "enclosure", radius: 14.5, height: 28.5, foot: 14.5, level: true, color: STEEL, mat: "metal", ground: "desert", solid: true,
}));

// Cochasquí: las 15 pirámides truncas de cangahua (A–P, sin la I), hoy cubiertas de hierba, y los montículos
// funerarios redondos que se ven en el terreno. Posición, planta y largo de las rampas: plano de J. Wentscher (1982,
// en Oberem y Wurster 1989), medido sobre su reproducción en la tesis de D. Pachacama (PUCE, 2025) y ajustado a la
// imagen satelital por el cruce de caminos del noroeste, el seto del norte, el camino al páramo y la cubierta de la
// excavación de la E (escala 0,75 m por píxel, norte arriba; error estimado ±15 m). Nueve tienen rampa, hacia el
// lado bajo: B, C, E, F, G, J, K, L y M. De Oberem: la plataforma de la E (51 × 27–30 m; 11 m de alto por el sur y
// 3,5 por el norte), su rampa (67 m) y su eje, 27° 38′ al este del norte, que es el giro de todo el conjunto.
// De la G (E. Rojas Vallejo, TFM, UPV 2025, con datos de Uhle y Ugalde): base de unos 110–125 × 100–110 m, plataforma
// de 75–78 × 58–64 m, 21–22 m de alto por el sur y 5 por el norte, rampa de unos 40 m de ancho en su arranque y eje
// a unos 33° (ese texto da 220 m de rampa; en el plano mide unos 160 m hasta el pie de la pirámide: se deja la del plano).
// El ALTO de las demás es ESTIMADO (no está en el plano). La K tiene además dos rampas pequeñas al norte (`rampsN`).
// [este, norte] en metros desde (0,0558° N, 78,3080° O), ancho, fondo, alto y largo de la rampa.
const CQ0 = [0.0558, -78.3080];
const CQ = [["cq-a", "A", 100, 245, 21, 21, 3, 0], ["cq-b", "B", 174, 178, 58, 46, 8, 31], ["cq-c", "C", 290, 126, 40, 34, 6, 27], ["cq-d", "D", -105, 171, 75, 57, 8, 0], ["cq-e", "E", 12, 136, 42, 68, 8, 67],
  ["cq-f", "F", 94, 133, 48, 35, 6, 23], ["cq-g", "G", 111, 21, 106, 86, 14, 158], ["cq-h", "H", 214, 17, 42, 33, 5, 0], ["cq-j", "J", 184, -28, 45, 34, 6, 25], ["cq-k", "K", 247, -70, 64, 69, 10, 62],
  ["cq-l", "L", 326, -113, 59, 46, 8, 56], ["cq-m", "M", -99, -128, 93, 72, 12, 260], ["cq-n", "N", 335, -70, 30, 19, 3, 0], ["cq-o", "O", 376, -154, 19, 19, 2, 0], ["cq-p", "P", 346, 173, 21, 21, 3, 0]];
const CQ_NOTE = { G: ["la mayor · 21 m por el lado bajo", "the largest · 21 m on the low side"], E: ["excavada · 11 m por el lado bajo", "excavated · 11 m on the low side"], M: ["rampa de 260 m", "260 m ramp"] };
const CQ_MEASURED = new Set(["G", "E"]);   // con medidas publicadas; el resto, alto estimado
const CQ_ROT = { G: 33 };                   // eje de su rampa (los demás, el de la E: 27° 38′)
const cqAt = (e, n) => ({ lat: +(CQ0[0] + n / mPerLat).toFixed(6), lon: +(CQ0[1] + e / mPerLon(CQ0[0])).toFixed(6) });
const COCHASQUI = CQ.map(([id, L, e, n, w, d, h, ramp]) => ({
  id, site: "cochasqui", name: { es: `Pirámide ${L}`, en: `Pyramid ${L}` }, label: !!CQ_NOTE[L],
  // etiqueta corta (en el teléfono se montaba sobre otras): la nota propia, o si tiene rampa; y si el alto es estimado
  sub: { es: [CQ_NOTE[L] ? CQ_NOTE[L][0] : ramp ? "con rampa" : "sin rampa", CQ_MEASURED.has(L) ? "" : "alto estimado"].filter(Boolean).join(" · "),
    en: [CQ_NOTE[L] ? CQ_NOTE[L][1] : ramp ? "with ramp" : "no ramp", CQ_MEASURED.has(L) ? "" : "height estimated"].filter(Boolean).join(" · ") },
  ...cqAt(e, n), kind: "tola", w, d, height: h, ramp, rot: CQ_ROT[L] || 27.6, ...(L === "G" ? { rampW: 1.7 } : {}), foot: Math.hypot(w, d) * 0.78, far: 6000, relief: true, seat: true, color: GRASS, mat: "heath", ground: "grass", solid: true,
  // el suelo de las pequeñas se mide en su centro (un punto); el de las cuatro grandes, en un anillo a su alrededor
  ...(w >= 60 ? {} : { ring: 3 }),
  ...(L === "K" ? { rampsN: 2 } : {}),
  // se puede subir a la plataforma de la G (lugar «Cochasquí · sobre la pirámide G»)
  ...(L === "G" ? { standOn: true, walkIn: true } : {}),
}));
// montículos funerarios redondos del mismo plano (los que se ven en el terreno): [este, norte], radio y alto (m).
// El «a» mide unos 40 m de diámetro y 5 de alto (Oberem); el alto de los demás es estimado.
// Letras: las del plano (a, c, e, f, g, m, x) y, para b y d, las del croquis del parque, que los sitúa igual.
const CQM = [["cqm-a", -352, -422, 20, 5, "a"], ["cqm-c", -312, -404, 12, 3, "c"], ["cqm-b", -385, -462, 21, 4, "b"], ["cqm-d", -314, -460, 15, 3, "d"], ["cqm-e", -308, -505, 14, 3, "e"], ["cqm-f", -358, -577, 11, 2.5, "f"],
  ["cqm-g", -332, -609, 11, 2.5, "g"], ["cqm-m", 78, -557, 9, 2, "m"], ["cqm-x", -22, -678, 22, 3.5, "x"], ["cqm-t1", 48, -154, 11, 2.5], ["cqm-t2", 29, -268, 10, 2]];
const COCHASQUI_MOUNDS = CQM.map(([id, e, n, radius, h, L]) => ({
  id, site: "cochasqui", name: { es: L ? `Montículo funerario ${L}` : "Montículo funerario", en: L ? `Burial mound ${L}` : "Burial mound" }, label: L === "a",
  sub: { es: L === "a" ? "40 m de diámetro" : "alto estimado", en: L === "a" ? "40 m across" : "height estimated" },
  ...cqAt(e, n), kind: "mound", radius, wall: 0, skirt: 8, seg: 28, rings: 5, height: h, ring: 3, far: 2500, relief: true, seat: true, color: GRASS, mat: "heath", ground: "grass", solid: true,
}));
// Machu Picchu, desde la cima del Intihuatana. APROXIMADO (posición ±10 m sobre la imagen satelital de Google
// Maps, 18-nov-2026; medidas redondeadas): el Templo de las Tres Ventanas y el Templo Principal en la Plaza
// Sagrada, unos 15 m más abajo; al otro lado de la plaza, el sector urbano oriental, representado por filas de
// casas de piedra sin techo sobre terrazas (no es el plano real casa por casa), y el Torreón o Templo del Sol.
// [este, norte] en metros desde el punto de vista; `drop`: metros por debajo de la cima.
const MP0 = [-13.16312, -72.545683];
const mpAt = (e, n) => ({ lat: +(MP0[0] + n / mPerLat).toFixed(6), lon: +(MP0[1] + e / mPerLon(MP0[0])).toFixed(6) });
const mpBase = { site: "machupicchu", kind: "inca", rot: -35, far: 700, level: true, color: GRANITE, mat: "inca", ground: "grass", solid: true };
const machu = [
  { ...mpBase, id: "mp-tres-ventanas", name: { es: "Templo de las Tres Ventanas", en: "Temple of the Three Windows" }, sub: { es: "posición aproximada", en: "approximate position" }, ...mpAt(46, -46), w: 10.6, d: 4.2, height: 3.6, open: "w", windows: 3, drop: 15, foot: 6 },
  { ...mpBase, id: "mp-templo-principal", name: { es: "Templo Principal", en: "Main Temple" }, sub: { es: "posición aproximada", en: "approximate position" }, ...mpAt(30, -34), w: 11, d: 8, height: 4, open: "s", windows: 0, drop: 15, foot: 7, rot: 55 },
  { ...mpBase, id: "mp-torreon", name: { es: "Torreón · Templo del Sol", en: "Torreón · Temple of the Sun" }, sub: { es: "posición aproximada", en: "approximate position" }, ...mpAt(103, -89), kind: "torreon", radius: 5, height: 5, drop: 32, foot: 6 },
];
for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
  // filas a lo largo del eje de la ciudad (noroeste–sureste), cada una en una terraza más baja hacia el este
  const u = 8 - k * 17 - (r % 2) * 5, v = r * 13, a = -35 * RAD, e = 78 + v * Math.cos(a) + u * Math.sin(a), n = 40 - v * Math.sin(a) + u * Math.cos(a);
  machu.push({ ...mpBase, id: `mp-casa-${r * 4 + k + 1}`, name: { es: "Sector urbano", en: "Urban sector" }, sub: { es: "casas sin techo · representación aproximada", en: "roofless houses · approximate rendering" }, label: r === 1 && k === 1,
    ...mpAt(e, n), w: 9 + ((r + k) % 3), d: 5.5, height: 2.6, gable: 2.2, door: true, drop: 21 + r * 3.2, foot: 6 });
}

/**
 * Monumentos. `kind`: stepped (cuerpos escalonados), pyramid (caras lisas), stonehenge, mound (túmulo), tower
 * (torre maciza), enclosure (cilindro), sundial (plataforma y poste), arcwall (muro en arco), disc (plataforma
 * redonda baja), terraced (cerro de terrazas, planta rectangular), kalasasaya, gate, stela, intihuatana.
 * `level`: su base está al nivel del suelo del observador (explanadas y cimas llanas). `lift`: sube la base (lo
 * que está sobre otra plataforma). `far`: hasta qué distancia (m) se dibuja (lo pequeño no se ve de lejos). `drop`: su base (y el suelo a su alrededor) queda esos metros por debajo. `walkIn`: se puede estar dentro (pero no a menos de `core` m de su centro). `foot`: radio de la planta. `ring`: radio
 * donde se mide el suelo. `relief`: el suelo cercano sigue el modelo de relieve (crestas y laderas). `label: false`: sin nombre propio. `sub`: texto bajo el nombre (si no, su alto).
 * `rot`: giro de la planta en grados hacia el este desde el norte (Teotihuacan: 15,5°, la orientación de la
 * Calzada de los Muertos). `site`: id del sitio de places.js desde donde se suele mirar.
 */
export const MONUMENTS = [
  { id: "sol", site: "teotihuacan", name: { es: "Pirámide del Sol", en: "Pyramid of the Sun" }, lat: 19.69240, lon: -98.84360,
    kind: "stepped", base: 225, top: 30, height: 65, tiers: 4, rot: 15.5, color: BASALT, mat: "basalt", ground: "dirt", solid: true,
    stairs: [{ side: "w", w: 14, out: 7 }] },
  { id: "luna", site: "teotihuacan", name: { es: "Pirámide de la Luna", en: "Pyramid of the Moon" }, lat: 19.69969, lon: -98.84395,
    kind: "stepped", base: 145, top: 22, height: 43, tiers: 4, rot: 15.5, color: BASALT, mat: "basalt", ground: "dirt", solid: true,
    stairs: [{ side: "s", w: 12, out: 7 }] },
  { id: "castillo", site: "chichenitza", name: { es: "El Castillo (Kukulcán)", en: "El Castillo (Kukulcan)" }, lat: 20.68290, lon: -88.56865,
    kind: "stepped", base: 55.3, top: 19.5, height: 24, tiers: 9, rot: 17, color: YUCATAN, mat: "yucatan", ground: "grass", solid: true,
    temple: { w: 13, h: 6, doors: { n: 3, s: 1, e: 1, w: 1 } },
    stairs: [{ side: "n", w: 8.8, out: 4.5 }, { side: "s", w: 8.8, out: 4.5 }, { side: "e", w: 8.8, out: 4.5 }, { side: "w", w: 8.8, out: 4.5 }] },
  { id: "keops", site: "giza", name: { es: "Pirámide de Keops", en: "Pyramid of Khufu" }, lat: 29.97917, lon: 31.13417,
    kind: "pyramid", base: 230.3, top: 10, height: 138.5, rot: 0, color: LIMESTONE, mat: "blocks", ground: "sand", solid: true },
  { id: "kefren", site: "giza", name: { es: "Pirámide de Kefrén", en: "Pyramid of Khafre" }, lat: 29.97593, lon: 31.13092,
    kind: "pyramid", base: 215.3, top: 0, height: 136.4, rot: 0, color: LIMESTONE, mat: "blocks", ground: "sand", solid: true, casing: 0.78 },
  { id: "micerino", site: "giza", name: { es: "Pirámide de Micerino", en: "Pyramid of Menkaure" }, lat: 29.97250, lon: 31.12806,
    kind: "pyramid", base: 103.4, top: 4, height: 61, rot: 0, color: LIMESTONE, mat: "blocks", ground: "sand", solid: true },
  { id: "stonehenge", site: "stonehenge", name: { es: "Stonehenge", en: "Stonehenge" }, lat: 51.178844, lon: -1.826189,
    kind: "stonehenge", axis: 49.9, height: 6.7, color: SARSEN, mat: "sarsen", ground: "grass", solid: false },
  { id: "newgrange", site: "newgrange", name: { es: "Newgrange", en: "Newgrange" }, lat: 53.69509, lon: -6.47531,
    kind: "mound", radius: 42.5, wall: 3, height: 13.5, entrance: 135, color: GRASS, wallColor: QUARTZ, mat: "grass", wallMat: "quartz", ground: "grass", solid: true },
  // Ingapirca: la plataforma del Templo del Sol o «Castillo» mide 37,10 × 12,35 m (Fresco y Ziółkowski, Revista
  // Española de Antropología Americana 14, 1984); sus muros de sillería, de hasta unos 4 m. Las puertas de los
  // extremos se han descrito orientadas a la salida y la puesta del Sol: eje este–oeste aproximado
  { id: "ingapirca-castillo", site: "ingapirca", name: { es: "Templo del Sol (Castillo)", en: "Temple of the Sun (Castle)" }, sub: { es: "plataforma de 37 × 12 m · orientación aproximada", en: "37 × 12 m platform · approximate orientation" },
    lat: -2.548588, lon: -78.87188, kind: "stadium", length: 37.1, width: 12.35, height: 3.6, axis: 90, foot: 19, color: INGA, mat: "sarsen", topMat: "grass", ground: "grass", solid: true },
  // Maeshowe: túmulo de hierba de unos 35 m de diámetro y 7,3 m de alto; el pasillo de entrada (unos 11 m) se abre
  // al suroeste, hacia la puesta del Sol del solsticio de invierno (Wikipedia; Historic Environment Scotland)
  { id: "maeshowe", site: "maeshowe", name: { es: "Maeshowe", en: "Maeshowe" }, lat: 58.9966, lon: -3.1882,
    kind: "mound", radius: 17.5, wall: 0, skirt: 0.5, height: 7.3, entrance: 230, roofBox: false, color: GRASS, mat: "grass", ground: "grass", solid: true },
  // Coliseo: elipse de 188 × 156 m y 48 m de alto, con la arena de unos 87 × 55 m; el eje largo va de
  // oessuroeste a estenoreste. Desde el centro de la arena (forma simplificada)
  { id: "coliseo", site: "coliseo", name: { es: "Coliseo", en: "Colosseum" }, sub: { es: "188 × 156 m · forma simplificada", en: "188 × 156 m · simplified shape" }, lat: 41.890278, lon: 12.492222,
    kind: "amphitheatre", a: 94, b: 78, arenaA: 43.5, arenaB: 27.5, height: 48, podium: 4, tiers: 4, axis: 67.5, foot: 0, ring: 125, walkIn: true, color: TRAVERTINE, mat: "yucatan", ground: "dirt", solid: true },
  // Cristo Redentor: 30 m de figura sobre un pedestal de 8 m, brazos de 28 m y túnica de 8,5 m de ancho (Britannica;
  // Structurae). La figura mira, aproximadamente, al sureste, hacia la bahía
  { id: "cristo", site: "cristoredentor", name: { es: "Cristo Redentor", en: "Christ the Redeemer" }, sub: { es: "38 m con el pedestal · forma simplificada", en: "38 m with its pedestal · simplified shape" },
    lat: -22.951916, lon: -43.210464, kind: "statue", height: 30, pedestal: 8, span: 28, axis: 140, foot: 7, level: true, levelR: 30, ring: 14, color: SOAPSTONE, mat: "yucatan", ground: "dirt", solid: true },
  // Taj Mahal: zócalo de 95,5 m de lado y unos 7 m de alto; edificio de unos 57 m de lado con las esquinas
  // achaflanadas y arcos de 33 m; cúpula hasta 73 m; minaretes de más de 40 m (Wikipedia; Britannica)
  { id: "tajmahal", site: "tajmahal", name: { es: "Taj Mahal", en: "Taj Mahal" }, sub: { es: "73 m · forma simplificada", en: "73 m · simplified shape" },
    lat: 27.175, lon: 78.041944, kind: "taj", plinth: 95.5, plinthH: 7, body: 57, chamfer: 12, bodyH: 33, dome: 18, height: 73, minaret: 41, axis: 0, foot: 50, color: MARBLE, mat: "quartz", ground: "grass", solid: true },
  // Abu Simbel, el Gran Templo: fachada tallada en la roca de 30 m de alto y 35 de ancho, con cuatro colosos
  // sentados de unos 20 m; mira al este (World History Encyclopedia; Lonely Planet)
  { id: "abusimbel-gran", site: "abusimbel", name: { es: "Gran Templo de Ramsés II", en: "Great Temple of Ramesses II" }, sub: { es: "fachada de 35 × 30 m · forma simplificada", en: "35 × 30 m façade · simplified shape" },
    lat: 22.33694, lon: 31.62556, kind: "rockfacade", width: 35, height: 30, axis: 90, foot: 25, color: NUBIAN, mat: "sarsen", ground: "sand", solid: true },
  // Karnak, primer pilono: 113 m de ancho y 14,5 m de fondo; torre norte de 21,70 m y sur de 31,65 m, sin terminar;
  // la puerta, de 7,4 m de ancho (Digital Karnak, UCLA/UCSC). Cierra el templo de Amón por el oeste; el eje del templo
  // va a 117° (hacia la salida del Sol en el solsticio de diciembre). Posición: Vici.org (±5 m)
  { id: "karnak-pilono", site: "karnak", name: { es: "Primer pilono de Karnak", en: "First Pylon of Karnak" }, sub: { es: "113 m de ancho · forma simplificada", en: "113 m wide · simplified shape" },
    lat: 25.719046, lon: 32.656757, kind: "pylon", width: 113, depth: 14.5, gate: 7.4, hN: 21.7, hS: 31.65, height: 31.65, axis: 297, foot: 30, color: NUBIAN, mat: "sarsen", ground: "sand", solid: true },
  // Angkor Wat: galería exterior de 187 × 215 m, segundo recinto de 100 × 115 m, galería interior de 60 m y torre
  // central de 65 m sobre el suelo, 43 m sobre el último nivel (MIT Dome; Universidad de Notre Dame). Mira al oeste;
  // el orden de los lados es aproximado, como las alturas de las dos galerías bajas y de las torres de las
  // esquinas
  { id: "angkorwat", site: "angkorwat", name: { es: "Angkor Wat", en: "Angkor Wat" }, sub: { es: "torre central de 65 m · forma simplificada", en: "65 m central tower · simplified shape" },
    lat: 13.4125, lon: 103.866667, kind: "angkor", outer: [215, 187], second: [115, 100], inner: 60, h1: 6, h2: 11, h3: 22, height: 65, corner: 52, axis: 270, foot: 110, color: KHMER, mat: "sarsen", ground: "grass", solid: true },
  ...COCHASQUI,
  ...COCHASQUI_MOUNDS,
  ...machu,
  ...chankillo,
  // Quitsato: plataforma de 54 m de diámetro con mosaico de piedra y poste de 10 m de alto y 1,3 m de diámetro,
  // sobre la línea ecuatorial. Las líneas del mosaico (ejes, solsticios y diagonales) están simplificadas.
  { id: "quitsato", site: "quitsato", name: { es: "Reloj solar Quitsato", en: "Quitsato sundial" }, lat: 0.0, lon: -78.175,
    sub: { es: "poste de 10 m · 54 m de diámetro", en: "10 m pole · 54 m across" },
    kind: "sundial", radius: 27, pole: 0.65, height: 10, foot: 0, far: 2500, core: 2.5, walkIn: true, level: true, color: ORANGE, mat: "gnomon", ground: "grass", solid: true },
  // Catequilla: muro semicircular de 68 m de diámetro (107 m de arco) y unos 2 m de grueso; hoy asoma entre 0,25
  // y 1,2 m. Sus extremos miran a la salida del Sol de diciembre (113,5°) y a la puesta de junio (293,5°); el arco
  // pasa por el norte. Centro del arco: 12 m al oeste y 6 m al norte del vértice de la cima.
  { id: "catequilla-muro", site: "catequilla", name: { es: "Muro semicircular", en: "Semicircular wall" }, lat: 0.000261, lon: -78.428534,
    sub: { es: "68 m de diámetro", en: "68 m across" },
    kind: "arcwall", radius: 34, thick: 2, height: 0.9, az0: 293.5, az1: 473.5, foot: 0, far: 600, walkIn: true, level: true, color: PIRCA, mat: "pirca", ground: "scrub", solid: false },
  // el disco lítico: plataforma de piedra de unos 8 m de diámetro, 43 m al norte y 33 m al oeste del vértice
  // (coordenadas UTM de Cobo 2017), con sus tres líneas de piedra (dos diámetros y un radio)
  { id: "catequilla-disco", site: "catequilla", name: { es: "Disco lítico", en: "Lithic disc" }, lat: 0.000599, lon: -78.428722,
    sub: { es: "8 m de diámetro", en: "8 m across" },
    kind: "disc", radius: 4, height: 0.3, foot: 4, far: 600, level: true, color: PIRCA, mat: "pirca", ground: "scrub", solid: false },
  ...paranal,
  // Tiwanaku. Akapana: plataforma de siete terrazas, hoy un cerro de tierra de 16,5 m; planta de unos 197 × 180 m
  // (con su saliente este, 257 m). Kalasasaya: plataforma de unos 130 × 120 m cercada por pilares de arenisca
  // (alto del muro y de los pilares, aproximado). La Puerta del Sol (3 m de alto y 3,8 m de ancho, de una pieza
  // de andesita) y la estela Ponce (3 m) están sobre ella.
  { id: "akapana", site: "tiwanaku", name: { es: "Akapana", en: "Akapana" }, lat: -16.556330, lon: -68.672853,
    kind: "terraced", w: 197, d: 180, topW: 96, topD: 86, height: 16.5, tiers: 7, rot: 0, foot: 133, level: true, color: EARTH, mat: "earth", ground: "puna", solid: true },
  { id: "kalasasaya", site: "tiwanaku", name: { es: "Kalasasaya", en: "Kalasasaya" }, lat: -16.554757, lon: -68.673444,
    sub: { es: "plataforma de 130 × 120 m", en: "130 × 120 m platform" },
    kind: "kalasasaya", w: 133, d: 126, height: 3.2, pillar: 4.4, rot: 0, foot: 92, level: true, color: REDSTONE, mat: "redstone", ground: "puna", solid: true },
  { id: "puerta-del-sol", site: "tiwanaku", name: { es: "Puerta del Sol", en: "Gate of the Sun" }, lat: -16.554314, lon: -68.673931,
    kind: "gate", w: 3.8, d: 0.5, height: 3.0, rot: 0, lift: 3.2, foot: 2, far: 800, level: true, color: ANDESITE, mat: "andesite", ground: "puna", solid: true },
  { id: "ponce", site: "tiwanaku", name: { es: "Estela Ponce", en: "Ponce Stela" }, lat: -16.554757, lon: -68.673331,   // en el eje este–oeste de Kalasasaya, tras su portada
    kind: "stela", w: 0.75, d: 0.6, height: 3.0, rot: 0, lift: 3.2, foot: 0.6, far: 800, level: true, color: ANDESITE, mat: "andesite", ground: "puna", solid: true },
  // Machu Picchu: el Intihuatana, tallado en la roca de la cima: unos 1,8 m en total, con un prisma vertical de
  // 0,66 m. Forma simplificada (tres cuerpos) y posición aproximada (±20 m).
  { id: "intihuatana", site: "machupicchu", name: { es: "Intihuatana", en: "Intihuatana" }, lat: -13.163075, lon: -72.545683,
    kind: "intihuatana", height: 1.8, rot: 20, foot: 1.6, far: 300, level: true, color: GRANITE, mat: "granite", ground: "grass", solid: true },
];

/** Radio (m) de la planta: hasta él no se puede estar «dentro» del monumento. */
export function footprintRadius(m) {
  if (m.foot != null) return m.foot;
  if (m.kind === "mound") return m.radius;
  if (m.kind === "stonehenge") return 0;              // se puede estar en el centro del círculo
  return (m.base / 2) * Math.SQRT2;
}

/** Distancia (m) y acimut (°) del lugar al monumento (aproximación local, suficiente a menos de 50 km). */
export function offsetOf(lat0, lon0, lat, lon) {
  const n = (lat - lat0) * RAD * R_E, e = (lon - lon0) * RAD * R_E * Math.cos(((lat + lat0) / 2) * RAD);
  return { e, n, d: Math.hypot(e, n), az: ((Math.atan2(e, n) / RAD) + 360) % 360 };
}

/** Monumentos a menos de `km` del lugar (y fuera de su planta), del más cercano al más lejano. */
/** ¿Está el lugar `o` (offsetOf del lugar al monumento) sobre la plataforma de arriba de un monumento `standOn`? */
export function onPlatform(m, o) {
  if (!m.standOn || !o) return false;
  const a = (m.rot || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), e = -o.e, n = -o.n;
  // (pirámides de base cuadrada: la plataforma de arriba mide `top` de lado)
  const hw = m.w != null ? m.w * 0.36 : (m.top || 0) * 0.5, hd = m.d != null ? m.d * 0.36 : (m.top || 0) * 0.5;
  return Math.abs(e * c - n * sn) < hw && Math.abs(e * sn + n * c) < hd;
}

export function monumentsNear(lat, lon, km = 20) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  return MONUMENTS.map((m) => ({ m, o: offsetOf(lat, lon, m.lat, m.lon) }))
    .filter(({ m, o }) => o.d <= Math.min(km * 1000, m.far || Infinity) && (m.core == null || o.d > m.core) && (m.walkIn || m.kind === "stonehenge" || o.d > footprintRadius(m) + 3 || onPlatform(m, o)))
    .sort((a, b) => a.o.d - b.o.d).map(({ m }) => m);
}

/** Puntos donde medir el suelo alrededor de un monumento (fuera de su bulto en el modelo de relieve). */
export function groundRing(m, n = 8) {
  const r = m.ring != null ? m.ring : Math.max(25, footprintRadius(m) + 30);
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI;
    out.push([m.lat + (r * Math.cos(a)) / (R_E * RAD), m.lon + (r * Math.sin(a)) / (R_E * RAD * Math.cos(m.lat * RAD))]);
  }
  return out;
}
export const median = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

// ── geometría (triángulos en E, N, U) ────────────────────────────────────────────────────────────────────
const rotP = (p, r) => { const c = Math.cos(r * RAD), s = Math.sin(r * RAD); return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c, p[2]]; };
function quad(out, a, b, c, d, col, mat) { out.push({ v: [a, b, c], c: col, mat }, { v: [a, c, d], c: col, mat }); }

/** Tronco de pirámide (planta rectangular girada `rot`, centrada en (ce, cn)) entre las alturas z0 y z1. */
function frustum(out, { ce = 0, cn = 0, z0, z1, w0, d0 = w0, w1, d1 = w1, rot = 0, col, mat, top = true }) {
  const P = (w, d, z, sx, sy) => { const p = rotP([sx * w / 2, sy * d / 2, z], rot); return [p[0] + ce, p[1] + cn, z]; };
  const b = [P(w0, d0, z0, -1, -1), P(w0, d0, z0, 1, -1), P(w0, d0, z0, 1, 1), P(w0, d0, z0, -1, 1)];
  const t = [P(w1, d1, z1, -1, -1), P(w1, d1, z1, 1, -1), P(w1, d1, z1, 1, 1), P(w1, d1, z1, -1, 1)];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(out, b[i], b[j], t[j], t[i], col, mat); }
  if (top && (w1 > 0 || d1 > 0)) quad(out, t[0], t[1], t[2], t[3], col, mat);
}

/**
 * Pirámide trunca de tierra gastada por siglos de lluvia (las tolas de Cochasquí): planta de esquinas redondeadas,
 * taludes rectos, la arista de arriba convertida en un hombro redondo, la plataforma apenas abombada y el pie abierto en
 * un talud de tierra caída. Las medidas son las de siempre: base wb × db a ras del suelo, plataforma wt × dt a la
 * altura H; el talud sigue bajo el suelo hasta DEEP (en una ladera, lo que sobra queda enterrado).
 * Caras suaves (la luz pasa de una a otra sin aristas) con coordenadas de textura en metros.
 */
export function tolaRings({ H, DEEP, wb, db, wt, dt }) {
  // media anchura del talud recto a la altura z (como el tronco de pirámide de antes)
  const ha = (z) => wt / 2 + ((wb - wt) / 2) * (H - z) / H, hb = (z) => dt / 2 + ((db - dt) / 2) * (H - z) / H;
  const run = ((wb - wt) / 2) / H;                     // cuánto entra el talud por metro de alto
  const s = Math.min(2.6, 0.24 * H);                    // alto del hombro redondeado
  const rings = [];
  // pie: talud bajo el suelo y, cerca del suelo, la tierra caída (algo más ancho)
  rings.push({ z: DEEP, a: ha(DEEP) + 1.6, b: hb(DEEP) + 1.6 });
  rings.push({ z: 0, a: ha(0) + 1.6, b: hb(0) + 1.6 });
  rings.push({ z: Math.min(1.6, H * 0.2), a: ha(Math.min(1.6, H * 0.2)) + 0.2, b: hb(Math.min(1.6, H * 0.2)) + 0.2 });
  // hombro: curva de Bézier entre el talud (a H − s) y la plataforma, con control en la arista de antes
  const z0 = H - s, a0 = ha(z0), b0 = hb(z0), aC = wt / 2, bC = dt / 2, inset = s * run * 1.1 + 0.8;
  for (const t of [0, 0.34, 0.67, 1]) {
    const u = 1 - t, q = (p0, c, p2) => u * u * p0 + 2 * u * t * c + t * t * p2;
    rings.push({ z: q(z0, H, H), a: q(a0, aC, aC - inset), b: q(b0, bC, bC - inset) });
  }
  // plataforma apenas abombada (el agua escurre hacia los bordes)
  rings.push({ z: H + 0.22, a: (aC - inset) * 0.55, b: (bC - inset) * 0.55 });
  return { rings, top: H + 0.3 };
}
const RR_K = 4;   // puntos por esquina redondeada
/** Anillo de planta rectangular con esquinas redondeadas (radio r) y media anchura a × b, girado `rot`: 4·RR_K puntos. */
function rrRing(a, b, r, z, rot) {
  const pts = [], rr = Math.max(0.2, Math.min(r, a * 0.9, b * 0.9));
  const C = [[a - rr, b - rr, 0], [-(a - rr), b - rr, 90], [-(a - rr), -(b - rr), 180], [a - rr, -(b - rr), 270]];
  for (const [cx, cy, a0] of C) for (let i = 0; i < RR_K; i++) {
    const t = (a0 + (90 * i) / (RR_K - 1)) * RAD, p = rotP([cx + rr * Math.cos(t), cy + rr * Math.sin(t), z], rot);
    pts.push(p);
  }
  return pts;
}
function erodedTola(out, o) {
  const { rings, top } = tolaRings(o);
  const uvOf = (p) => [p[0], p[1] + p[2] * 0.6];
  const R = rings.map((g) => rrRing(g.a, g.b, Math.min(g.a, g.b) * 0.16 + 1.2, g.z, o.rot));
  const n = R[0].length;
  for (let k = 0; k + 1 < R.length; k++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, A = R[k][i], B = R[k][j], C = R[k + 1][j], D = R[k + 1][i];
    out.push({ v: [A, B, C], uv: [uvOf(A), uvOf(B), uvOf(C)], c: o.col, mat: o.mat, smooth: true },
      { v: [A, C, D], uv: [uvOf(A), uvOf(C), uvOf(D)], c: o.col, mat: o.mat, smooth: true });
  }
  const last = R[R.length - 1], cen = [0, 0, top];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; out.push({ v: [last[i], last[j], cen], uv: [uvOf(last[i]), uvOf(last[j]), uvOf(cen)], c: o.col, mat: o.mat, smooth: true }); }
}

/**
 * Rampa de tierra gastada: una sección (lomo apenas abombado, bordes redondeados y faldones que se abren T m por metro de
 * caída hasta `drop` m bajo el lomo) llevada por estaciones { y, z, hw, drop } a lo largo de la rampa (eje y, girado `rot`).
 */
function rampLoft(out, { rot, col, mat, st, T }) {
  const P = (x, y, z) => { const q = rotP([x, y, z], rot); return [q[0], q[1], z]; };
  const prof = (g) => [[-(g.hw + g.drop * T), -g.drop], [-(g.hw + 1.4), -0.8], [-(g.hw + 0.3), -0.18], [-g.hw * 0.5, 0.06], [0, 0.12], [g.hw * 0.5, 0.06], [g.hw + 0.3, -0.18], [g.hw + 1.4, -0.8], [g.hw + g.drop * T, -g.drop]];
  const R = st.map((g) => prof(g).map(([x, dz]) => P(x, g.y, g.z + dz)));
  const uvOf = (p) => [p[0], p[1] + p[2] * 0.6];
  for (let k = 0; k + 1 < R.length; k++) for (let i = 0; i + 1 < R[k].length; i++) {
    const A = R[k][i], B = R[k][i + 1], C = R[k + 1][i + 1], D = R[k + 1][i];
    out.push({ v: [A, C, B], uv: [uvOf(A), uvOf(C), uvOf(B)], c: col, mat, smooth: true }, { v: [A, D, C], uv: [uvOf(A), uvOf(D), uvOf(C)], c: col, mat, smooth: true });
  }
}

/** Bloque (piedra) de ancho w (tangencial), grueso t (radial) y alto h, centrado en (e, n), girado `rot`. */
function block(out, e, n, z0, h, w, t, rot, col, mat) { frustum(out, { ce: e, cn: n, z0, z1: z0 + h, w0: w, d0: t, w1: w, d1: t, rot, col, mat }); }

/** Bordes de las terrazas de una pirámide escalonada: [[altura, media anchura], …]. */
export function tierEdges(m) {
  const out = [], n = m.tiers, h = m.height / n;
  for (let i = 0; i < n; i++) {
    const wb = m.base - ((m.base - m.top) * i) / n, wn = m.base - ((m.base - m.top) * (i + 1)) / n;
    out.push([(i + 1) * h, (wb - (wb - wn) * 0.72) / 2]);
  }
  return out;
}

/** Número de escalones de una escalinata de alto H con escalones de ~stepH. */
export const stairSteps = (H, stepH = 0.3) => Math.max(4, Math.round(H / stepH));

// lado de una planta: dirección hacia fuera y la transversal (marco sin girar)
const SIDE = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] };

/** Escalinata de un lado: rampa con escalones desde el suelo, `out` m fuera de la base, hasta la plataforma. */
function stair(out, m, st, top, H, stepH = 0.3) {
  const [ox, oy] = SIDE[st.side], tx = -oy, ty = ox, a1 = top / 2, hw = st.w / 2;
  // la rampa pasa por fuera de todas las terrazas (si no, sus bordes la atravesarían): su pie se aleja lo justo
  let a0 = m.base / 2 + st.out;
  for (const [z, half] of tierEdges(m)) if (z < H) a0 = Math.max(a0, (half + 0.4 - (a1 * z) / H) / (1 - z / H));
  const P = (a, t, z) => { const p = rotP([ox * a + tx * t, oy * a + ty * t, z], m.rot); return [p[0], p[1], z]; };
  // la superficie de los escalones (v sube por la pendiente) y los costados, de la piedra del monumento
  // escalones de verdad (contrahuella y huella): su alto crece con la distancia para que no titilen a lo lejos
  const ns = stairSteps(H, stepH);
  for (let i = 0; i < ns; i++) {
    const za = (H * i) / ns, zb = (H * (i + 1)) / ns, aa = a0 + ((a1 - a0) * i) / ns, ab = a0 + ((a1 - a0) * (i + 1)) / ns;
    const k0 = out.length;
    quad(out, P(aa, -hw, za), P(aa, hw, za), P(aa, hw, zb), P(aa, -hw, zb), m.color, "steps");
    quad(out, P(aa, -hw, zb), P(aa, hw, zb), P(ab, hw, zb), P(ab, -hw, zb), m.color, "steps");
    // la contrahuella recibe de lleno la luz que rebota en la huella de abajo: por eso no se ve negra a mediodía
    for (let k = k0; k < out.length; k++) { out[k].tex = m.mat; out[k].tone = k < k0 + 2 ? 2.1 : 1.05; }
  }
  for (const sg of [-1, 1]) {
    const t = sg * hw;
    out.push({ v: [P(a0, t, 0), P(a1, t, H), P(a1, t, 0)], c: m.color, mat: m.mat });
    // alfarda: un murete de 0,7 m sobre el costado
    const t2 = sg * (hw + 0.8);
    quad(out, P(a0, t, 0.7), P(a0, t2, 0.7), P(a1, t2, H), P(a1, t, H), m.color, m.mat);
    quad(out, P(a0, t2, 0), P(a0, t2, 0.7), P(a1, t2, H), P(a1, t2, H - 0.7), m.color, m.mat);
    out.push({ v: [P(a0, t, 0), P(a0, t, 0.7), P(a1, t, H)], c: m.color, mat: m.mat });
  }
}

/** Puertas del templo: rectángulos oscuros apenas delante de cada cara. */
function doors(out, m) {
  const T = m.temple, hw = T.w / 2, z0 = m.height;
  for (const side of Object.keys(T.doors || {})) {
    const k = T.doors[side], [ox, oy] = SIDE[side], tx = -oy, ty = ox, dw = k > 1 ? 1.6 : 2.0, gap = (T.w - k * dw) / (k + 1);
    for (let i = 0; i < k; i++) {
      const t0 = -hw + gap * (i + 1) + dw * i, t1 = t0 + dw, a = hw + 0.06;
      const P = (t, z) => { const p = rotP([ox * a + tx * t, oy * a + ty * t, z], m.rot); return [p[0], p[1], z]; };
      quad(out, P(t0, z0 + 0.3), P(t1, z0 + 0.3), P(t1, z0 + 3.2), P(t0, z0 + 3.2), [0.05, 0.05, 0.05], "door");
    }
  }
}

// ruido determinista (para que las piedras no sean cajas perfectas)
const hash3 = (x, y, z, s) => { const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 4.581) * 43758.5453; return h - Math.floor(h); };
// ruido suave (interpolado) en 3D, entre 0 y 1
function vnoise3(x, y, z, s) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = x - X, fy = y - Y, fz = z - Z;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(X, Y, Z, s), hash3(X + 1, Y, Z, s), u), L(hash3(X, Y + 1, Z, s), hash3(X + 1, Y + 1, Z, s), u), v),
    L(L(hash3(X, Y, Z + 1, s), hash3(X + 1, Y, Z + 1, s), u), L(hash3(X, Y + 1, Z + 1, s), hash3(X + 1, Y + 1, Z + 1, s), u), v), w);
}

/**
 * Piedra tallada a mano y gastada por el tiempo: sección de esquinas redondeadas (superelipse), más estrecha
 * arriba, con bultos suaves a dos escalas (~1 m y ~30 cm), el canto de arriba redondeado e irregular y el pie
 * algo hundido en el suelo. El centro de la cara superior queda exactamente a la altura h. Las caras llevan
 * `smooth` (la capa suaviza la luz entre ellas) y sus coordenadas de textura en metros (`uv`): u rodea la
 * piedra y v sube, así la textura no se corta entre caras.
 */
function rock(out, e, n, z0, h, w, t, rot, col, mat, seed, o = {}) {
  const NS = o.ns || 28, NZ = o.nz || Math.max(3, Math.min(16, Math.round(h / 0.38))), pw = o.pw || 3.4, bk = o.bump == null ? 1 : o.bump;
  const taperK = o.taper == null ? 0.12 : o.taper, sink = o.sink == null ? 0.12 : o.sink, perim = 1.8 * (w + t);
  const P = (i, j) => {
    const th = (i / NS) * 2 * Math.PI, c = Math.cos(th), sn = Math.sin(th), zf = j / NZ;
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / pw) * w / 2, y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / pw) * t / 2;
    const z = -sink + zf * (h + sink);
    const bump = 1 + bk * (0.11 * (vnoise3(x * 0.9 + 3, y * 0.9 + 5, z * 0.7, seed) - 0.5) * 2 + 0.04 * (vnoise3(x * 3.1, y * 3.1, z * 2.6, seed + 7) - 0.5) * 2);
    const round = zf > 0.84 ? 1 - 0.3 * (o.edge == null ? 1 : o.edge) * Math.pow((zf - 0.84) / 0.16, 2) : 1;
    const k = (1 - taperK * zf) * bump * round;
    const q = rotP([x * k, y * k, 0], rot);
    const zt = j === NZ ? z - (0.03 + 0.1 * vnoise3(c * 1.3, sn * 1.3, 0.5, seed + 3)) * Math.min(1, h) : z;
    return { p: [e + q[0], n + q[1], z0 + zt], uv: [(i / NS) * perim, z + sink], l: [x * k, y * k] };
  };
  const tri = (A, B, C) => out.push({ v: [A.p, B.p, C.p], uv: [A.uv, B.uv, C.uv], c: col, mat, smooth: true });
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NS; i++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    tri(a, b, c); tri(a, c, d);
  }
  const top = { p: [e, n, z0 + h], uv: [0, 0] };
  for (let i = 0; i < NS; i++) {
    const a = P(i, NZ), b = P(i + 1, NZ);
    out.push({ v: [top.p, a.p, b.p], uv: [[0, 0], a.l, b.l], c: col, mat, smooth: true });
  }
}

/**
 * Cilindro (o tronco de cono) vertical: pared lisa a la luz, con la textura rodeándolo (u = arco en metros,
 * v = altura). `cap`: tapa de arriba.
 */
function cyl(out, { e = 0, n = 0, z0, z1, r0, r1 = r0, seg = 48, col, mat, cap = true, tone = 1 }) {
  const P = (i, top) => { const a = (i / seg) * 2 * Math.PI, r = top ? r1 : r0; return [e + r * Math.sin(a), n + r * Math.cos(a), top ? z1 : z0]; };
  const per = 2 * Math.PI * Math.max(r0, r1);
  for (let i = 0; i < seg; i++) {
    const a = P(i, 0), b = P(i + 1, 0), c = P(i + 1, 1), d = P(i, 1), u0 = (i / seg) * per, u1 = ((i + 1) / seg) * per;
    out.push({ v: [a, b, c], uv: [[u0, z0], [u1, z0], [u1, z1]], c: col, mat, smooth: true, tone },
      { v: [a, c, d], uv: [[u0, z0], [u1, z1], [u0, z1]], c: col, mat, smooth: true, tone });
  }
  if (cap && r1 > 0) for (let i = 0; i < seg; i++) out.push({ v: [[e, n, z1], P(i, 1), P(i + 1, 1)], c: col, mat, tone });
}

// --- contornos en planta (Ingapirca, Coliseo): puntos [e, n] alrededor del centro, en el mismo sentido que cyl ---
/** Rota un punto del marco del monumento (x a lo largo del eje `axis`, en grados desde el norte) a (e, n). */
function axisRot([x, y], axis) { const f = (axis - 90) * RAD, c = Math.cos(f), s = Math.sin(f); return [x * c + y * s, -x * s + y * c]; }
/** Elipse de semiejes a (a lo largo del eje) y b. */
function ellipseOutline(a, b, axis, seg) { return Array.from({ length: seg }, (_, k) => { const t = (k / seg) * 2 * Math.PI; return axisRot([a * Math.sin(t), b * Math.cos(t)], axis); }); }
/** «Estadio» (rectángulo con los extremos en semicírculo) de largo L y ancho W, encogido `inset` m hacia dentro. */
function stadiumOutline(L, W, axis, seg, inset = 0) {
  const s = (L - W) / 2, r = W / 2 - inset;
  return Array.from({ length: seg }, (_, k) => {
    const t = (k / seg) * 2 * Math.PI, dx = Math.sin(t), dy = Math.cos(t);
    // distancia del centro al borde en esa dirección (el borde está a `r` del segmento central)
    let lo = 0, hi = L;
    for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2, px = m * dx, py = m * dy, qx = Math.max(-s, Math.min(s, px)); if (Math.hypot(px - qx, py) < r) lo = m; else hi = m; }
    return axisRot([lo * dx, lo * dy], axis);
  });
}
/** Pared entre dos contornos (abajo A a z0, arriba B a z1); `inward`: mira hacia dentro (gradas, podio). */
function outlineWall(out, A, B, z0, z1, col, mat, inward = false, tone = 1) {
  const n = A.length;
  let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = [...A[i], z0], b = [...A[j], z0], c = [...B[j], z1], d = [...B[i], z1];
    const du = Math.hypot(A[j][0] - A[i][0], A[j][1] - A[i][1]), uv = [[u, z0], [u + du, z0], [u + du, z1], [u, z1]];
    if (inward) out.push({ v: [a, d, c], uv: [uv[0], uv[3], uv[2]], c: col, mat, tone }, { v: [a, c, b], uv: [uv[0], uv[2], uv[1]], c: col, mat, tone });
    else out.push({ v: [a, b, c], uv: [uv[0], uv[1], uv[2]], c: col, mat, tone }, { v: [a, c, d], uv: [uv[0], uv[2], uv[3]], c: col, mat, tone });
    u += du;
  }
}
/** Superficie (de cara arriba) entre el contorno de fuera A (a zA) y el de dentro B (a zB); sin B, tapa entera. */
function outlineBand(out, A, zA, B, zB, col, mat, tone = 1) {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a0 = [...A[i], zA], a1 = [...A[j], zA];
    if (!B) { out.push({ v: [[0, 0, zA], a0, a1], c: col, mat, tone }); continue; }
    quad(out, [...B[i], zB], a0, a1, [...B[j], zB], col, mat);
  }
}

/** Sólido de revolución: perfil [[r, z], …] de abajo arriba, alrededor de (e, n). */
function lathe(out, prof, { e = 0, n = 0, seg = 48, col, mat, tone = 1 }) {
  const ring = ([r, z]) => Array.from({ length: seg }, (_, k) => { const a = (k / seg) * 2 * Math.PI; return [e + r * Math.sin(a), n + r * Math.cos(a), z]; });
  for (let i = 0; i + 1 < prof.length; i++) {
    const A = ring(prof[i]), B = ring(prof[i + 1]);
    for (let k = 0; k < seg; k++) {
      const j = (k + 1) % seg;
      out.push({ v: [A[k], A[j], B[j]], c: col, mat, smooth: true, tone }, { v: [A[k], B[j], B[k]], c: col, mat, smooth: true, tone });
    }
  }
}
/** Caja (o tronco) en el marco del monumento: x hacia `axis`, y a la izquierda; (x, y) es su centro. */
function boxAt(out, axis, x, y, z0, z1, w0, d0, w1 = w0, d1 = d0, col, mat) {
  const [ce, cn] = axisRot([x, y], axis);
  frustum(out, { ce, cn, z0, z1, w0, d0, w1, d1, rot: axis - 90, col, mat });
}

/** Círculo horizontal (suelo de una plataforma) a la altura z. */
function disk(out, { e = 0, n = 0, z, r, seg = 72, col, mat, tone = 1 }) {
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * 2 * Math.PI, b = ((i + 1) / seg) * 2 * Math.PI;
    out.push({ v: [[e, n, z], [e + r * Math.sin(a), n + r * Math.cos(a), z], [e + r * Math.sin(b), n + r * Math.cos(b), z]], c: col, mat, tone });
  }
}

/** Franja horizontal de ancho w desde el radio r0 al r1, hacia el acimut az, a la altura z. */
function ray(out, az, r0, r1, w, z, col, mat, o = [0, 0]) {
  const sx = Math.sin(az * RAD), sy = Math.cos(az * RAD), tx = sy * w / 2, ty = -sx * w / 2;
  const P = (r, k) => [o[0] + sx * r + tx * k, o[1] + sy * r + ty * k, z];
  quad(out, P(r0, -1), P(r0, 1), P(r1, 1), P(r1, -1), col, mat);
}

/**
 * Muro en arco de piedra de campo, bajo y desmoronado: su alto cambia a lo largo (entre 0,3 y 1,3 veces el
 * medio) y por fuera queda algo más abajo que por dentro, como un muro que contiene una explanada.
 */
function arcWall(out, m) {
  const N = Math.max(24, Math.round(((m.az1 - m.az0) * RAD * m.radius) / 1.6)), ri = m.radius - m.thick / 2, ro = m.radius + m.thick / 2;
  const at = (k, r, z) => { const a = (m.az0 + ((m.az1 - m.az0) * k) / N) * RAD; return [r * Math.sin(a), r * Math.cos(a), z]; };
  const hAt = (k) => m.height * (0.3 + 1.0 * vnoise3(k * 0.37, 1.5, 2.5, 9)) * Math.min(1, Math.min(k, N - k) / 3 + 0.25);
  for (let k = 0; k < N; k++) {
    const h0 = hAt(k), h1 = hAt(k + 1), k0 = out.length;
    quad(out, at(k, ro, -0.4), at(k + 1, ro, -0.4), at(k + 1, ro, h1), at(k, ro, h0), m.color, m.mat);      // cara de fuera
    quad(out, at(k + 1, ri, 0), at(k, ri, 0), at(k, ri, h0), at(k + 1, ri, h1), m.color, m.mat);            // cara de dentro
    quad(out, at(k, ro, h0), at(k + 1, ro, h1), at(k + 1, ri, h1), at(k, ri, h0), m.color, m.mat);          // coronación
    const tone = 0.85 + 0.3 * hash3(k, 3, 7, 11);
    for (let j = k0; j < out.length; j++) out[j].tone = tone;
  }
  quad(out, at(0, ri, 0), at(0, ro, -0.4), at(0, ro, hAt(0)), at(0, ri, hAt(0)), m.color, m.mat);
  quad(out, at(N, ro, -0.4), at(N, ri, 0), at(N, ri, hAt(N)), at(N, ro, hAt(N)), m.color, m.mat);
}

/** Suelo que rodea un monumento (para recibir su sombra): { radius, mat }. */
export function groundPatch(m) {
  return { radius: (m.kind === "stonehenge" ? 95 : footprintRadius(m) + 60), mat: m.ground || "dirt" };
}

/**
 * Hiladas de una pirámide sin revestimiento, como se ven hoy en Guiza: cada hilada es un escalón (cara vertical
 * y repisa), de alto algo distinto y tono propio. `wAt(z)`: ancho de la pirámide a la altura z.
 */
function coursed(out, m, z0, z1, wAt, courseH) {
  const corner = (w, z, sx, sy) => rotP([sx * w / 2, sy * w / 2, z], m.rot);
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  let z = z0, i = 0;
  while (z < z1 - 1e-6) {
    let hh = courseH * (0.78 + 0.44 * hash3(i, 1, 2, m.base));
    if (z1 - z - hh < courseH * 0.4) hh = z1 - z;
    const zb = z + hh, wa = wAt(z), wb = wAt(zb), tone = 0.88 + 0.24 * hash3(i, 5, 9, m.base), k0 = out.length;
    for (let c = 0; c < 4; c++) {
      const d = (c + 1) % 4;
      quad(out, corner(wa, z, ...C[c]), corner(wa, z, ...C[d]), corner(wa, zb, ...C[d]), corner(wa, zb, ...C[c]), m.color, m.mat);
      quad(out, corner(wa, zb, ...C[c]), corner(wa, zb, ...C[d]), corner(wb, zb, ...C[d]), corner(wb, zb, ...C[c]), m.color, m.mat);
    }
    for (let k = k0; k < out.length; k++) out[k].tone = tone;
    z = zb; i++;
  }
}

/** Alto de las hiladas y de los escalones según la distancia (m) desde donde se miran. */
export function detailFor(d = 300) {
  return { courseH: Math.min(3.2, Math.max(0.95, d / 700)), stepH: Math.min(1.2, Math.max(0.27, d / 1200)) };
}

/**
 * Triángulos del monumento: [{ v: [[e, n, u] × 3], c: color, mat, tex?, tone?, smooth?, uv? }]. `opt.d`: distancia
 * (m) desde donde se mira (decide el detalle de hiladas y escalones).
 */
export function buildFaces(m, opt = {}) {
  const out = [], col = m.color, det = detailFor(opt.d);
  if (m.kind === "pyramid") {
    const top = m.top || 0, wAt = (z) => m.base + ((top - m.base) * z) / m.height;
    if (m.casing) {
      // Kefrén: hiladas desnudas abajo y, en el último cuarto, el revestimiento liso que se conserva (sobresale
      // un poco del núcleo gastado)
      const zc = m.height * m.casing, wc = wAt(zc);
      coursed(out, m, 0, zc, wAt, det.courseH);
      frustum(out, { z0: zc - 0.6, z1: m.height, w0: wc + 3.2, w1: top, rot: m.rot, col, mat: "casing", top: top > 0 });
    } else {
      coursed(out, m, 0, m.height, wAt, det.courseH);
      if (top > 0) frustum(out, { z0: m.height - 0.01, z1: m.height, w0: top, w1: top, rot: m.rot, col, mat: m.mat });
    }
  } else if (m.kind === "stepped") {
    // cuerpos escalonados: cada uno con talud (se estrecha al subir) y una terraza antes del siguiente
    const n = m.tiers, h = m.height / n;
    for (let i = 0; i < n; i++) {
      const wb = m.base - ((m.base - m.top) * i) / n, wn = m.base - ((m.base - m.top) * (i + 1)) / n;
      const wt = wb - (wb - wn) * 0.72;
      frustum(out, { z0: i * h, z1: (i + 1) * h, w0: wb, w1: wt, rot: m.rot, col, mat: m.mat });
    }
    for (const st of m.stairs || []) stair(out, m, st, m.top, m.height, det.stepH);
    if (m.temple) {
      // templo: muro, moldura a media altura y cornisa que sobresalen un poco
      const T = m.temple;
      block(out, 0, 0, m.height, T.h, T.w, T.w, m.rot, col, m.mat);
      block(out, 0, 0, m.height + T.h * 0.56, 0.45, T.w + 0.5, T.w + 0.5, m.rot, col, m.mat);
      block(out, 0, 0, m.height + T.h - 0.7, 0.7, T.w + 0.7, T.w + 0.7, m.rot, col, m.mat);
      doors(out, m);
    }
  } else if (m.kind === "mound") {
    // túmulo: muro de cuarzo (vertical) y encima la cúpula de hierba, casi plana arriba
    const seg = m.seg || 96, rings = m.rings || 14;
    const ring = (r, z) => Array.from({ length: seg }, (_, k) => { const a = (k / seg) * 2 * Math.PI; return [r * Math.sin(a), r * Math.cos(a), z]; });
    // sin muro (`wall: 0`), un faldón de tierra (`skirt` m) baja bajo la base: en ladera no queda un hueco por el lado bajo
    const b0 = ring(m.radius * (m.wall ? 1 : 1 + (m.skirt || 0) * 0.06), m.wall ? 0 : -(m.skirt || 0)), b1 = ring(m.radius, m.wall);
    if (m.wall || m.skirt) for (let k = 0; k < seg; k++) { const j = (k + 1) % seg; quad(out, b0[k], b0[j], b1[j], b1[k], m.wall ? m.wallColor : col, m.wall ? m.wallMat : m.mat); }
    const g0 = out.length;
    let prev = b1;
    for (let i = 1; i <= rings; i++) {
      const f = i / rings, r = m.radius * (1 - f), z = m.wall + (m.height - m.wall) * Math.pow(1 - Math.pow(1 - f, 2.2), 0.55);
      if (i === rings) { for (let k = 0; k < seg; k++) out.push({ v: [prev[k], prev[(k + 1) % seg], [0, 0, m.height]], c: col, mat: m.mat }); break; }
      const cur = ring(r, z);
      for (let k = 0; k < seg; k++) { const j = (k + 1) % seg; quad(out, prev[k], prev[j], cur[j], cur[k], col, m.mat); }
      prev = cur;
    }
    // hierba: luz suave y la textura tendida en planta (sin cortes entre caras)
    for (let k = g0; k < out.length; k++) { out[k].smooth = true; out[k].uv = out[k].v.map((p) => [p[0], p[1] + p[2] * 0.6]); }
    // la entrada (al sureste, hacia donde sale el Sol del solsticio de invierno) y, encima, la abertura por
    // la que entra su luz
    if (m.entrance != null) {
      const az = m.entrance * RAD, r = m.radius + 0.07, ox = Math.sin(az), oy = Math.cos(az), tx = Math.cos(az), ty = -Math.sin(az);
      const P = (t, z) => [ox * r + tx * t, oy * r + ty * t, z];
      quad(out, P(-0.55, 0), P(0.55, 0), P(0.55, 1.6), P(-0.55, 1.6), [0.05, 0.05, 0.05], "door");
      if (m.roofBox !== false) quad(out, P(-0.5, 2.0), P(0.5, 2.0), P(0.5, 2.5), P(-0.5, 2.5), [0.05, 0.05, 0.05], "door");
    }
  } else if (m.kind === "tola") {
    // pirámide trunca de tierra cubierta de hierba: taludes tendidos, plataforma y, si la tiene, la rampa al sur de
    // su planta (girada con ella)
    // (la ladera cae hacia el suroeste cerca de un 18 %: el pie baja bajo la base y la rampa desciende con el terreno)
    // El pie baja 16 m bajo la base con el mismo talud, y la rampa lleva faldones y un remate 12 m bajo su punta: en una ladera cuyo relieve real no coincide con el supuesto, nada queda en el aire ni enseña su cara
    // de abajo; lo que sobra queda enterrado.
    const DEEP = -16, wb = m.w + 10.5, db = m.d + 10.5, wt = m.w * 0.72, dt = m.d * 0.72;
    erodedTola(out, { H: m.height, DEEP, wb, db, wt, dt, rot: m.rot, col, mat: m.mat });
    if (m.ramp) {
      const hw0 = 7 * (m.rampW || 1), hw1 = 5 * (m.rampW || 1), y0 = -m.d * 0.35, y1 = -(m.d * 0.5 + m.ramp);
      // la rampa baja con la ladera (18 %); sus faldones y el remate de la punta bajan 12 m más, abriéndose 0,8 m por metro.
      // Gastada como el cuerpo: la sección tiene el lomo apenas abombado y los bordes redondeados (rampLoft)
      const zf = -0.18 * (m.ramp + m.d * 0.15), T = 0.8;
      rampLoft(out, { rot: m.rot, col, mat: m.mat, st: [
        { y: y0, z: m.height, hw: hw0, drop: m.height - DEEP },
        { y: y0 + (y1 - y0) * 0.5, z: m.height + (zf - m.height) * 0.5, hw: (hw0 + hw1) / 2, drop: 12 + (m.height - DEEP - 12) * 0.5 },
        { y: y1, z: zf, hw: hw1, drop: 12 },
        { y: y1 - 9, z: zf - 5, hw: hw1 * 0.8, drop: 7 },
        { y: y1 - 18, z: zf - 12, hw: hw1 * 0.5, drop: 0.5 },
      ], T });
    }
    // rampas pequeñas del lado alto (la K de Cochasquí tiene dos): cortas, hasta el terreno de arriba
    for (let k = 0; k < (m.rampsN || 0); k++) {
      const x = m.w * 0.5 * ((k + 0.5) / m.rampsN * 2 - 1) * 0.6, hw = 3.5, y0 = m.d * 0.34, y1 = m.d * 0.5 + 12, P = (px, py, z) => { const q = rotP([px, py, z], m.rot); return [q[0], q[1], z]; };
      const zt = Math.min(m.height, 0.18 * 12 + m.height * 0.35);
      quad(out, P(x - hw, y0, m.height), P(x + hw, y0, m.height), P(x + hw, y1, zt), P(x - hw, y1, zt), col, m.mat);
      for (const sg of [-1, 1]) quad(out, P(x + sg * hw, y0, m.height), P(x + sg * hw, y1, zt), P(x + sg * (hw + 20), y1, zt - 15), P(x + sg * (hw + 20), y0, m.height - 15), col, m.mat);
    }
    // el cuerpo es suave (erodedTola); las rampas, de caras planas
    for (const f of out) if (f.smooth == null) f.smooth = false;
  } else if (m.kind === "inca") {
    // edificio inca de sillares: muros con algo de talud, un lado abierto (wayrana) o puerta, hastiales si los
    // tiene y ventanas trapezoidales (rectángulos oscuros)
    const T = 0.85, hw = m.w / 2, hd = m.d / 2, R = (x, y) => { const q = rotP([x, y, 0], m.rot); return [q[0], q[1]]; };
    const wall = (x, y, len, alongX, h) => { const [e, n] = R(x, y); frustum(out, { ce: e, cn: n, z0: -1.5, z1: h, w0: alongX ? len : T * 1.15, d0: alongX ? T * 1.15 : len, w1: alongX ? len : T * 0.85, d1: alongX ? T * 0.85 : len, rot: m.rot, col, mat: m.mat }); };
    if (m.open !== "n") wall(0, hd, m.w, true, m.height);
    if (m.open !== "s") wall(0, -hd, m.w, true, m.height);
    if (m.open !== "e") wall(hw, 0, m.d, false, m.height);
    if (m.open !== "w") wall(-hw, 0, m.d, false, m.height);
    if (m.gable) for (const sg of [-1, 1]) {
      const P = (x, y, z) => { const q = rotP([x, y, z], m.rot); return [q[0], q[1], z]; }, x0 = sg * (hw - T / 2), x1 = sg * (hw + T / 2);
      for (const x of [x0, x1]) out.push({ v: [P(x, -hd, m.height), P(x, hd, m.height), P(x, 0, m.height + m.gable)], c: col, mat: m.mat });
      quad(out, P(x0, -hd, m.height), P(x1, -hd, m.height), P(x1, 0, m.height + m.gable), P(x0, 0, m.height + m.gable), col, m.mat);
      quad(out, P(x0, hd, m.height), P(x1, hd, m.height), P(x1, 0, m.height + m.gable), P(x0, 0, m.height + m.gable), col, m.mat);
    }
    const dark = (x, y, wd, z0, z1, alongX, sgn) => {
      const P = (t, z) => { const q = rotP(alongX ? [x + t, y + sgn * (T * 0.6 + 0.03), z] : [x + sgn * (T * 0.6 + 0.03), y + t, z], m.rot); return [q[0], q[1], z]; };
      out.push({ v: [P(-wd / 2, z0), P(wd / 2, z0), P(wd * 0.42, z1)], c: [0.05, 0.05, 0.05], mat: "door" }, { v: [P(-wd / 2, z0), P(wd * 0.42, z1), P(-wd * 0.42, z1)], c: [0.05, 0.05, 0.05], mat: "door" });
    };
    for (let i = 0; i < (m.windows || 0); i++) for (const sg of [-1, 1]) dark(hw, (i - (m.windows - 1) / 2) * (m.d / m.windows), 1.1, 1.3, 2.7, false, sg);
    if (m.door) for (const sg of [-1, 1]) dark(0, -hd, 1.2, 0, 2.0, true, sg);
  } else if (m.kind === "torreon") {
    // torre de planta semicircular sobre la roca, con el muro recto detrás
    const seg = 20, P = (a, r, z) => { const q = rotP([r * Math.sin(a), r * Math.cos(a), z], m.rot); return [q[0], q[1], z]; };
    for (let i = 0; i < seg; i++) { const a = -Math.PI / 2 + (Math.PI * i) / seg, b = -Math.PI / 2 + (Math.PI * (i + 1)) / seg;
      quad(out, P(a, m.radius * 1.04, -3), P(b, m.radius * 1.04, -3), P(b, m.radius * 0.96, m.height), P(a, m.radius * 0.96, m.height), col, m.mat); }
    quad(out, P(-Math.PI / 2, m.radius, -3), P(Math.PI / 2, m.radius, -3), P(Math.PI / 2, m.radius, m.height), P(-Math.PI / 2, m.radius, m.height), col, m.mat);
    for (const f of out) f.smooth = false;
  } else if (m.kind === "tower") {
    // torre maciza de piedra y mortero: paredes con algo de talud y la arista de arriba gastada
    // (el pie baja 2,5 m bajo su base: en una cresta el suelo dibujado queda algo más bajo entre torre y torre, y
    // sin esto parecerían flotar)
    frustum(out, { z0: -2.5, z1: m.height - 0.35, w0: m.w * 1.02, d0: m.d * 1.02, w1: m.w * 0.95, d1: m.d * 0.96, rot: m.rot, col, mat: m.mat, top: false });
    frustum(out, { z0: m.height - 0.35, z1: m.height, w0: m.w * 0.95, d0: m.d * 0.96, w1: m.w * 0.9, d1: m.d * 0.93, rot: m.rot, col, mat: m.mat });
  } else if (m.kind === "enclosure") {
    // cerramiento del telescopio: base de hormigón y, encima, el cilindro metálico que gira con el telescopio; un
    // techo casi plano y la banda de las compuertas de ventilación
    cyl(out, { z0: 0, z1: 5, r0: m.radius + 0.25, seg: 64, col, mat: "concrete", cap: false });
    cyl(out, { z0: 5, z1: 5.3, r0: m.radius + 0.25, r1: m.radius, seg: 64, col, mat: "concrete", cap: false });
    cyl(out, { z0: 5.3, z1: 11, r0: m.radius, seg: 64, col, mat: m.mat, cap: false });
    cyl(out, { z0: 11, z1: 16, r0: m.radius, seg: 64, col, mat: m.mat, cap: false, tone: 0.72 });
    cyl(out, { z0: 16, z1: m.height - 0.8, r0: m.radius, seg: 64, col, mat: m.mat, cap: false });
    cyl(out, { z0: m.height - 0.8, z1: m.height, r0: m.radius, r1: m.radius - 2.2, seg: 64, col, mat: m.mat, cap: true, tone: 1.08 });
  } else if (m.kind === "sundial") {
    // plataforma de mosaico de piedra (oscura) con sus líneas claras: el eje norte–sur, la línea equinoccial, las
    // de los solsticios (a 23,5° de la equinoccial), las de la eclíptica (a 23,5° del eje) y las diagonales
    disk(out, { z: 0.02, r: m.radius, col: PEBBLE, mat: "pebble" });
    const lines = [0, 90, 66.5, 113.5, 23.5, 156.5, 45, 135];
    for (const az of lines) for (const a of [az, az + 180]) ray(out, a, m.pole + 0.5, m.radius - 0.6, az % 90 === 0 ? 0.9 : 0.55, 0.045, PEBBLE, "pebblelight");
    // borde claro
    { const seg = 96, r0 = m.radius - 0.6, r1 = m.radius;
      for (let i = 0; i < seg; i++) { const a = (i / seg) * 2 * Math.PI, b = ((i + 1) / seg) * 2 * Math.PI, P = (t, r) => [r * Math.sin(t), r * Math.cos(t), 0.045];
        quad(out, P(a, r0), P(a, r1), P(b, r1), P(b, r0), PEBBLE, "pebblelight"); } }
    // el poste (gnomon)
    cyl(out, { z0: 0, z1: m.height, r0: m.pole, seg: 28, col, mat: m.mat });
  } else if (m.kind === "stadium") {
    // Ingapirca: la plataforma en «estadio» (dos semicírculos unidos por tramos rectos) de piedra labrada, con los
    // muros algo inclinados hacia dentro, como los incas
    const seg = 96, A = stadiumOutline(m.length, m.width, m.axis, seg), B = stadiumOutline(m.length, m.width, m.axis, seg, m.height * Math.tan(7 * RAD));
    outlineWall(out, A, B, 0, m.height, col, m.mat);
    outlineBand(out, B, m.height, null, 0, col, m.topMat || m.mat, 0.95);
  } else if (m.kind === "amphitheatre") {
    // Coliseo: muro exterior en elipse, una corona estrecha arriba, las gradas que bajan hacia la arena, el muro
    // del podio y la arena (forma simplificada: sin arcos ni la parte que falta hoy del anillo exterior)
    const seg = 160, E = (a, b) => ellipseOutline(a, b, m.axis, seg);
    const O = E(m.a, m.b), C = E(m.a - 6, m.b - 6), P = E(m.arenaA + 3, m.arenaB + 3), R = E(m.arenaA, m.arenaB);
    outlineWall(out, O, O, 0, m.height, col, m.mat);
    for (let k = 1; k < m.tiers; k++) { const z = (m.height * k) / m.tiers; outlineWall(out, O.map(([e, n]) => [e * 1.004, n * 1.004]), O.map(([e, n]) => [e * 1.004, n * 1.004]), z - 0.6, z, col, m.mat, false, 0.82); }
    outlineBand(out, O, m.height, C, m.height, col, m.mat, 0.9);
    outlineWall(out, C, C, m.height - 8, m.height, col, m.mat, true, 0.8);
    outlineBand(out, C, m.height - 8, P, m.podium, col, m.mat, 0.85);
    outlineBand(out, P, m.podium, R, m.podium, col, m.mat, 0.9);
    outlineWall(out, R, R, 0.1, m.podium, col, m.mat, true, 0.75);
    outlineBand(out, R, 0.1, null, 0, SAND_C, "sand");
  } else if (m.kind === "statue") {
    // Cristo Redentor (forma simplificada): pedestal de 8 m y la figura de 30 m: la túnica que se estrecha hacia
    // los hombros, los brazos abiertos de 28 m y la cabeza (3,75 m)
    const ax = m.axis, p = m.pedestal, top = p + m.height, sh = top - 4.6;
    boxAt(out, ax, 0, 0, 0, p, 9.5, 9.5, 8.8, 8.8, col, m.mat);
    boxAt(out, ax, 0, 0, p, sh - 1.2, 4.2, 8.5, 3.6, 6.2, col, m.mat);
    boxAt(out, ax, 0, 0, sh - 1.2, sh + 1.4, 3.6, m.span, 3.0, m.span, col, m.mat);
    lathe(out, [[0.9, sh + 1.4], [1.1, sh + 1.9], [1.5, top - 2.6], [1.55, top - 1.4], [1.2, top - 0.4], [0, top]], { seg: 20, col, mat: m.mat });
  } else if (m.kind === "taj") {
    // Taj Mahal (forma simplificada): el zócalo cuadrado, el edificio de esquinas achaflanadas con sus grandes arcos,
    // el tambor y la cúpula en bulbo hasta 73 m, cuatro templetes y los cuatro minaretes
    const P = m.plinthH, H = P + m.bodyH, half = m.body / 2, ch = m.chamfer;
    frustum(out, { z0: 0, z1: P, w0: m.plinth, w1: m.plinth, rot: m.axis - 90, col, mat: m.mat, tone: 0.95 });
    const oct = [[half, half - ch], [half - ch, half], [ch - half, half], [-half, half - ch], [-half, ch - half], [ch - half, -half], [half - ch, -half], [half, ch - half]]
      .map((q) => axisRot(q, m.axis)).reverse();
    outlineWall(out, oct, oct, P, H, col, m.mat);
    outlineBand(out, oct, H, null, 0, col, m.mat);
    // los arcos de las cuatro fachadas (oscuros, apenas hundidos)
    for (const s of [0, 90, 180, 270]) { const [ce, cn] = axisRot([half + 0.05, 0], m.axis + s); frustum(out, { ce, cn, z0: P + 1, z1: P + m.bodyH * 0.78, w0: 0.1, d0: 16, w1: 0.1, d1: 9, rot: m.axis + s - 90, col: [0.55, 0.55, 0.55], mat: m.mat, tone: 0.7 }); }
    const d = m.dome / 2, z0 = H, zt = m.height;
    lathe(out, [[d, z0], [d, z0 + 7], [d * 1.12, z0 + 12], [d * 1.08, z0 + 17], [d * 0.7, zt - 9], [d * 0.25, zt - 6.5], [0.5, zt - 5.5], [0.25, zt]], { seg: 48, col, mat: m.mat });
    for (const s of [45, 135, 225, 315]) { const [ce, cn] = axisRot([half * 0.62, 0], m.axis + s); lathe(out, [[3, H], [3, H + 6], [3.4, H + 8], [1.2, H + 11], [0.2, H + 12.5]], { e: ce, n: cn, seg: 16, col, mat: m.mat }); }
    for (const s of [45, 135, 225, 315]) { const [ce, cn] = axisRot([(m.plinth / 2 - 3.5) * Math.SQRT2, 0], m.axis + s); lathe(out, [[3, P], [2.5, P + m.minaret - 6], [3.2, P + m.minaret - 5.5], [2.6, P + m.minaret - 3.5], [1.6, P + m.minaret - 2], [0.2, P + m.minaret]], { e: ce, n: cn, seg: 16, col, mat: m.mat }); }
  } else if (m.kind === "rockfacade") {
    // Abu Simbel (forma simplificada): la fachada tallada en la roca (35 m de ancho y 30 de alto), el cerro detrás,
    // la puerta y los cuatro colosos sentados de 20 m (el segundo desde la izquierda, roto desde la Antigüedad)
    const ax = m.axis, W = m.width, Hh = m.height;
    // (el cerro: laderas tendidas a los lados y detrás; delante, la fachada vertical)
    boxAt(out, ax, -24, 0, 0, Hh, 48, W + 44, 14, W + 4, col, m.mat);
    boxAt(out, ax, -1, 0, 0, Hh, 2, W, 2, W, col, m.mat);
    boxAt(out, ax, 0.05, 0, 0, 7, 0.1, 3, 0.1, 3, [0.08, 0.07, 0.06], "door");
    [-13, -6, 6, 13].forEach((y, i) => {
      const broken = i === 1;
      boxAt(out, ax, 3.5, y, 0, 9, 7, 6.2, 7, 6.2, col, m.mat);                                  // trono
      boxAt(out, ax, 5.5, y, 9, 11.5, 4.5, 4.8, 4.5, 4.6, col, m.mat);                            // regazo
      if (broken) return;
      boxAt(out, ax, 1.8, y, 9, 15.5, 3.4, 5.4, 3.2, 4.6, col, m.mat);                            // torso
      boxAt(out, ax, 2, y, 15.5, 17.6, 2.6, 2.8, 2.4, 2.4, col, m.mat);                           // cabeza
      lathe(out, [[1.3, 17.6], [1.1, 19], [0.6, 19.6], [0.1, 20]], { e: axisRot([2, y], ax)[0], n: axisRot([2, y], ax)[1], seg: 12, col, mat: m.mat });  // corona
    });
  } else if (m.kind === "pylon") {
    // Primer pilono de Karnak (forma simplificada): dos torres en talud de 14,5 m de fondo, 113 m de ancho en total,
    // a cada lado de una puerta de 7,4 m; la torre norte quedó en 21,7 m y la sur en 31,65 (sin terminar)
    const ax = m.axis, D = m.depth, g = m.gate, Wt = (m.width - g) / 2, bat = 0.1;
    // (+y, a la izquierda del frente: con el frente al oeste-noroeste, el sur)
    [[-1, m.hN], [1, m.hS]].forEach(([s, H]) => {
      boxAt(out, ax, 0, s * (g / 2 + Wt / 2), 0, H, D, Wt, D - 2 * bat * H, Wt - bat * H, col, m.mat);
      boxAt(out, ax, 0, s * (g / 2 + 1), 0, H, D * 0.85, 2, D * 0.85, 2, col, m.mat);   // la jamba, a plomo
    });
  } else if (m.kind === "angkor") {
    // Angkor Wat (forma simplificada): la galería exterior (187 × 215 m), el segundo recinto (100 × 115 m), la
    // galería interior de 60 m sobre su basamento y el quincunce de torres; la central, a 65 m sobre el suelo
    const ax = m.axis, [L1, W1] = m.outer, [L2, W2] = m.second, s3 = m.inner, g = 9, h1 = m.h1, h2 = m.h2, h3 = m.h3;
    boxAt(out, ax, 0, (W1 - g) / 2, 0, h1, L1, g, L1, g * 0.6, col, m.mat);
    boxAt(out, ax, 0, -(W1 - g) / 2, 0, h1, L1, g, L1, g * 0.6, col, m.mat);
    boxAt(out, ax, (L1 - g) / 2, 0, 0, h1, g, W1 - 2 * g, g * 0.6, W1 - 2 * g, col, m.mat);
    boxAt(out, ax, -(L1 - g) / 2, 0, 0, h1, g, W1 - 2 * g, g * 0.6, W1 - 2 * g, col, m.mat);
    boxAt(out, ax, 0, 0, 0, h2, L2, W2, L2 - 6, W2 - 6, col, m.mat);
    boxAt(out, ax, 0, 0, h2, h3, s3, s3, s3 - 10, s3 - 10, col, m.mat);
    const tower = (x, y, top, r) => { const [e, n] = axisRot([x, y], ax), H = top - h3;
      lathe(out, [[r, h3], [r * 0.95, h3 + H * 0.2], [r * 0.85, h3 + H * 0.45], [r * 0.68, h3 + H * 0.65], [r * 0.42, h3 + H * 0.82], [r * 0.15, h3 + H * 0.95], [0, top]], { e, n, seg: 24, col, mat: m.mat }); };
    tower(0, 0, m.height, 9);
    const c = s3 / 2 - 7;
    for (const [x, y] of [[c, c], [c, -c], [-c, c], [-c, -c]]) tower(x, y, m.corner, 6);
  } else if (m.kind === "arcwall") {
    arcWall(out, m);
  } else if (m.kind === "disc") {
    // plataforma baja de piedra con sus tres líneas: dos diámetros (norte–sur y este–oeste) y un radio
    cyl(out, { z0: -0.2, z1: m.height, r0: m.radius, r1: m.radius - 0.25, seg: 40, col, mat: m.mat });
    for (const a of [0, 180, 90, 270]) ray(out, a, 0, m.radius - 0.4, 0.45, m.height + 0.03, col, "pircalight");
    ray(out, 315, 0, m.radius - 0.4, 0.45, m.height + 0.03, col, "pircalight");
  } else if (m.kind === "terraced") {
    // cerro de terrazas gastadas: cada cuerpo con mucho talud (la tierra se ha corrido) y una repisa estrecha
    const n = m.tiers, h = m.height / n;
    for (let i = 0; i < n; i++) {
      const f0 = i / n, f1 = (i + 1) / n, L = (a, b, t) => a + (b - a) * t;
      const w0 = L(m.w, m.topW, f0), d0 = L(m.d, m.topD, f0), w1 = L(m.w, m.topW, f1), d1 = L(m.d, m.topD, f1);
      frustum(out, { z0: i * h, z1: (i + 1) * h, w0, d0, w1: L(w0, w1, 0.82), d1: L(d0, d1, 0.82), rot: m.rot, col, mat: m.mat });
    }
  } else if (m.kind === "kalasasaya") {
    // plataforma cercada: muro de sillares entre pilares de arenisca que sobresalen, y la explanada de tierra
    frustum(out, { z0: 0, z1: m.height, w0: m.w, d0: m.d, w1: m.w - 0.3, d1: m.d - 0.3, rot: m.rot, col, mat: m.mat, top: false });
    { const hw = m.w / 2 - 0.15, hd = m.d / 2 - 0.15, z = m.height, T = (x, y) => { const q = rotP([x, y, z], m.rot); return [q[0], q[1], z]; };
      quad(out, T(-hw, -hd), T(hw, -hd), T(hw, hd), T(-hw, hd), EARTH, "earth"); }
    const stepP = 4.6, pil = (x, y, az, seed) => { const q = rotP([x, y, 0], m.rot); rock(out, q[0], q[1], 0, m.pillar * (0.88 + 0.24 * hash3(seed, 1, 1, 3)), 1.15, 0.8, az + m.rot, col, m.mat, seed, { ns: 10, nz: 4, pw: 5, taper: 0.06, sink: 0.05 }); };
    let seed = 1;
    for (let x = -m.w / 2; x <= m.w / 2 + 1e-6; x += (m.w / Math.round(m.w / stepP))) { pil(x, -m.d / 2 - 0.15, 0, seed++); pil(x, m.d / 2 + 0.15, 0, seed++); }
    for (let y = -m.d / 2 + stepP; y <= m.d / 2 - stepP + 1e-6; y += (m.d / Math.round(m.d / stepP))) {
      pil(-m.w / 2 - 0.15, y, 90, seed++);
      if (Math.abs(y) > 6) pil(m.w / 2 + 0.15, y, 90, seed++);               // en el centro del lado este va la escalinata
    }
    // escalinata del este (seis peldaños) y su portada de piedra
    for (let i = 0; i < 6; i++) {
      const zt = (m.height * (i + 1)) / 6, x = m.w / 2 + (6 - i) * 0.62 - 0.31, q = rotP([x, 0, 0], m.rot);
      block(out, q[0], q[1], 0, zt, 0.62, 8, m.rot, col, m.mat);
    }
    for (const sg of [-1, 1]) { const q = rotP([m.w / 2 - 1.2, sg * 2.1, 0], m.rot); block(out, q[0], q[1], m.height, 2.7, 1.1, 1.1, m.rot, col, m.mat); }
    { const q = rotP([m.w / 2 - 1.2, 0, 0], m.rot); block(out, q[0], q[1], m.height + 2.7, 0.8, 1.2, 5.6, m.rot, col, m.mat); }
  } else if (m.kind === "gate") {
    // portada de una sola pieza: el vano, oscuro, en las dos caras (mira al este y al oeste)
    block(out, 0, 0, 0, m.height, m.d, m.w, m.rot, col, m.mat);
    for (const sg of [-1, 1]) {
      const a = sg * (m.d / 2 + 0.03), P = (t, z) => { const q = rotP([a, t, z], m.rot); return [q[0], q[1], z]; };
      quad(out, P(-0.42, 0), P(0.42, 0), P(0.42, 1.4), P(-0.42, 1.4), [0.05, 0.05, 0.05], "door");
    }
  } else if (m.kind === "stela") {
    rock(out, 0, 0, 0, m.height, m.w, m.d, m.rot, col, m.mat, 41, { ns: 14, nz: 8, pw: 6, taper: 0.05, sink: 0.05 });
  } else if (m.kind === "intihuatana") {
    // tres cuerpos de la misma roca: el afloramiento tallado, la mesa y el prisma
    const q = (x, y) => { const r = rotP([x, y, 0], m.rot); return [r[0], r[1]]; };
    rock(out, 0, 0, 0, 0.72, 3.0, 2.3, m.rot, col, m.mat, 61, { ns: 24, nz: 5, pw: 9, taper: 0.06, sink: 0.2, bump: 0.45, edge: 0.25 });
    { const [x, y] = q(0.25, 0.1); rock(out, x, y, 0.66, 0.5, 1.9, 1.45, m.rot, col, m.mat, 62, { ns: 24, nz: 5, pw: 10, taper: 0.04, sink: 0, bump: 0.3, edge: 0.2 }); }
    { const [x, y] = q(0.35, 0.2); rock(out, x, y, 1.12, m.height - 1.12, 0.46, 0.34, m.rot, col, m.mat, 63, { ns: 16, nz: 5, pw: 12, taper: 0.08, sink: 0, bump: 0.2, edge: 0.15 }); }
  } else if (m.kind === "stonehenge") {
    stonehenge(out, m);
  }
  return out;
}

// Stonehenge tal como está hoy (simplificado): el círculo de sarsen (30 piedras de 4,1 m, numeradas en el sentido
// de las agujas del reloj desde la entrada, en el eje del solsticio de verano, acimut ~49,9°) con las que siguen en
// pie y sus dinteles; la herradura de los cinco trilitos abierta hacia el noreste (en pie, con dintel, 51-52, 53-54
// y 57-58; del gran trilito queda la 56; del último, la 60) y la Piedra del Talón a 77 m, cerca del eje.
export const SH_STANDING = [1, 2, 3, 4, 5, 6, 7, 10, 11, 16, 21, 22, 23, 27, 28, 29, 30];
export const SH_LINTELS = [[29, 30], [30, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [21, 22]];
function stonehenge(out, m) {
  const R = 15.6, ax = m.axis, col = m.color, mat = m.mat;
  const azOf = (k) => ax + 6 + (k - 1) * 12;               // la 1 y la 30 flanquean la entrada
  const at = (az, r) => [r * Math.sin(az * RAD), r * Math.cos(az * RAD)];
  for (const k of SH_STANDING) { const [e, n] = at(azOf(k), R); rock(out, e, n, 0, 4.1, 2.1, 1.1, azOf(k), col, mat, k); }
  for (const [a, b] of SH_LINTELS) {
    const az = (azOf(a) + (((azOf(b) - azOf(a)) % 360) + 360) % 360 / 2), [e, n] = at(az, R);
    rock(out, e, n, 4.05, 0.8, 2 * R * Math.sin(6 * RAD) + 1.4, 1.0, az, col, mat, 100 + a);
  }
  // trilitos: [acimut desde el centro, radio, alto, ¿izquierda en pie?, ¿derecha en pie?, ¿dintel?]
  // (alto de las piedras en pie: 5,2 y 5,6 m con dinteles de 0,9 m, ~6,1 y 6,5 m en total; del gran trilito, que
  // con su dintel llegaba a 7,3 m, queda en pie la piedra 56, de 6,7 m)
  const TRI = [[ax + 64, 8.8, 5.2, true, true, true], [ax + 118, 8.0, 5.6, true, true, true], [ax + 180, 7.4, 6.7, false, true, false],
    [ax + 242, 8.0, 5.6, true, true, true], [ax + 296, 8.8, 5.2, false, true, false]];
  for (const [az, r, h, l, rr, lin] of TRI) {
    const [e, n] = at(az, r), tx = Math.cos(az * RAD), ty = -Math.sin(az * RAD);   // tangente
    if (l) rock(out, e - tx * 1.25, n - ty * 1.25, 0, h, 2.2, 1.2, az, col, mat, 200 + az);
    if (rr) rock(out, e + tx * 1.25, n + ty * 1.25, 0, h, 2.2, 1.2, az, col, mat, 300 + az);
    if (lin) rock(out, e, n, h - 0.05, 0.9, 4.9, 1.1, az, col, mat, 400 + az);
  }
  const [he, hn] = at(51.3, 77);
  rock(out, he, hn, 0, 4.7, 2.4, 2.1, 51.3, col, mat, 77, { taper: 0.3 });
  // piedras caídas (posición aproximada): tres del círculo, tumbadas hacia fuera, y los restos del gran trilito
  // (la piedra 55, partida, y su dintel) en el centro
  for (const k of [8, 12, 14, 25]) { const [fe, fn] = at(azOf(k), R + 2.6); rock(out, fe, fn, 0, 0.95, 1.9, 4.0, azOf(k), col, mat, 500 + k, { taper: 0.05, sink: 0.25, nz: 4 }); }
  { const [fe, fn] = at(ax + 176, 3.4); rock(out, fe, fn, 0, 1.0, 2.1, 4.2, ax + 172, col, mat, 555, { taper: 0.05, sink: 0.3, nz: 4 }); }
  { const [fe, fn] = at(ax + 150, 1.2); rock(out, fe, fn, 0, 0.85, 1.2, 4.6, ax + 60, col, mat, 556, { taper: 0.05, sink: 0.2, nz: 4 }); }
}

/** Lo más alto del monumento (para el nombre): [e, n, u]. */
export function apexOf(m) {
  if (m.kind === "stonehenge") return [0, 0, m.height];
  if (m.kind === "arcwall") { const a = ((m.az0 + m.az1) / 2) * RAD; return [m.radius * Math.sin(a), m.radius * Math.cos(a), m.height]; }
  if (m.kind === "kalasasaya") return [m.w / 2, -m.d / 4, m.pillar];
  if (m.kind === "amphitheatre") return [...axisRot([m.a, 0], m.axis), m.height];
  if (m.kind === "statue") return [0, 0, m.pedestal + m.height];
  if (m.kind === "angkor") return [0, 0, m.height];
  if (m.kind === "pylon") return [0, 0, m.hS];
  if (m.kind === "rockfacade") return [0, 0, m.height];   // (desde la arena: el rótulo, en el muro del este)
  return [0, 0, m.height + (m.temple ? m.temple.h : 0)];
}

// ── proyección al cielo del lugar ──────────────────────────────────────────────────────────────────────────
/**
 * Punto del monumento en el marco del observador: [x, y, z] = [este, arriba, −norte] en metros, con la
 * curvatura de la Tierra (y la refracción estándar) como el horizonte. `o`: offsetOf(lugar → monumento);
 * `dz`: altura de la base sobre los ojos del observador.
 */
export function toLocal(p, o, dz) {
  const e = o.e + p[0], n = o.n + p[1], d2 = e * e + n * n;
  return [e, p[2] + dz - (d2 * (1 - K_REFR)) / (2 * R_E), -n];
}
export const altAzOf = (v) => ({ az: ((Math.atan2(v[0], -v[2]) / RAD) + 360) % 360, alt: Math.atan2(v[1], Math.hypot(v[0], v[2])) / RAD });

/**
 * Silueta angular de los monumentos macizos: para cada paso de acimut, la altura (°) más alta que tapan.
 * `items`: [{ m, o, dz }]. Devuelve Float32Array con −90 donde no hay monumento.
 */
export function silhouette(items, step = 0.2) {
  const n = Math.round(360 / step), out = new Float32Array(n).fill(-90);
  for (const { m, o, dz, faces } of items) {
    if (!m.solid) continue;
    for (const f of faces || buildFaces(m)) {
      for (let i = 0; i < 3; i++) {
        const a = toLocal(f.v[i], o, dz), b = toLocal(f.v[(i + 1) % 3], o, dz);
        const A = altAzOf(a), B = altAzOf(b);
        let dAz = ((B.az - A.az + 540) % 360) - 180;
        const k = Math.min(600, Math.max(2, Math.ceil(Math.abs(dAz) / (step / 2)) + Math.ceil(Math.abs(B.alt - A.alt) / 0.2)));
        for (let s = 0; s <= k; s++) {
          const t = s / k, v = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
          const q = altAzOf(v), j = Math.round(q.az / step) % n;
          if (q.alt > out[j]) out[j] = q.alt;
        }
      }
    }
  }
  return out;
}

/** El horizonte con los monumentos: copia de `hz` cuyo perfil total (alt) incluye la silueta `sil`. */
export function withMonuments(hz, sil) {
  if (!hz || !sil) return hz;
  const n = hz.alt.length;
  if (sil.length !== n) return hz;
  let any = false;
  const alt = hz.alt.map((a, i) => { if (sil[i] > a) { any = true; return Math.round(sil[i] * 100) / 100; } return a; });
  return any ? { ...hz, alt, monuments: true } : hz;
}
