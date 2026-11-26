// lidarPlan.js — en cada sitio con suelo LiDAR (lidarSites.js): dónde va el rótulo, desde dónde se mira y qué puntos
// de visita tiene. Coordenadas [este, norte] en metros desde el origen de su maqueta; leídas sobre el sombreado del
// propio relieve LiDAR (scripts/lidar/build_site.py deja la imagen de control), con un margen de 2 a 5 m.
//   own     el sitio ya existía en places.js (su lugar y sus piezas se definen allí y en monuments.js)
//   label   [e, n, alto sobre el suelo]: dónde se apoya el rótulo (la cima del túmulo, el centro del anillo)
//   view    [e, n]: el lugar del sitio («Vista general»), con `look` (acimut) y `lookAlt` (altura) hacia donde mira
//   airR    radio de lo que se viene a ver (encuadra la toma aérea)   airH   altura de la toma aérea (m)
//   noAuto  sin toma aérea automática sobre el origen (Newark, de 1 km: lleva las suyas)
//   stops   más puntos: { id, es, en, at: [e, n], look, lookAlt, air? (toma aérea, m), for?: [ids de rótulos] }
export const LIDAR_PLAN = {
  stonehenge: { own: true, airR: 70, airH: 110, stops: [
    { id: "avenida", es: "Desde la Avenida", en: "From the Avenue", at: [92, 77], look: 230, lookAlt: 2 },
    { id: "foso", es: "Foso y banco", en: "Ditch and bank", at: [44, -44], look: 315, lookAlt: -3 },
    { id: "aire-eje", es: "Desde el aire · eje del solsticio", en: "From the air · solstice axis", at: [115, 97], look: 230, lookAlt: -22, air: 55 }] },
  maeshowe: { own: true, label: [-1, 0, 2], airR: 50, airH: 80, stops: [
    { id: "banco", es: "Desde el banco", en: "From the bank", at: [0, -52], look: 0, lookAlt: 3 }] },
  newgrange: { own: true, look: 315, lookAlt: 4, airR: 50, airH: 90 },
  brodgar: { label: [0, 0, 4], view: [0, 0], look: 0, lookAlt: 3, airR: 60, airH: 130, stops: [
    { id: "foso", es: "Junto al foso", en: "By the ditch", at: [23, -64], look: 340, lookAlt: 2 },
    { id: "aire-sur", es: "Desde el aire · anillo", en: "From the air · ring", at: [0, -140], look: 0, lookAlt: -25, air: 60 }] },
  stenness: { label: [5, 8, 5], view: [5, -22], look: 0, lookAlt: 6, airR: 25, airH: 60, stops: [
    { id: "aire-sur", es: "Desde el aire · piedras", en: "From the air · stones", at: [5, -55], look: 0, lookAlt: -30, air: 40 }] },
  knowth: { label: [-6, 14, 1], view: [95, -70], look: 306, lookAlt: 5, airR: 75, airH: 140, stops: [
    { id: "satelites", es: "Entre los túmulos satélite", en: "Among the satellite mounds", at: [-62, 22], look: 100, lookAlt: 6 }] },
  dowth: { label: [15, -1, 1], view: [4, -95], look: 0, lookAlt: 5, airR: 40, airH: 100 },
  avebury: { label: [0, 0, 6], view: [-10, -125], look: 190, lookAlt: 3, airR: 210, airH: 220, stops: [
    { id: "banco", es: "Sobre el banco", en: "On the bank", at: [148, -148], look: 40, lookAlt: -8 },
    { id: "aire-se", es: "Desde el aire · banco y foso", en: "From the air · bank and ditch", at: [190, -190], look: 315, lookAlt: -22, air: 90 }] },
  silbury: { label: [-9, -7, 1], view: [-105, -105], look: 45, lookAlt: 10, airR: 85, airH: 150, stops: [
    { id: "cima", es: "En la cima", en: "On the summit", at: [-9, -7], look: 0, lookAlt: -6 }] },
  serpentmound: { label: [45, 5, 4], view: [88, -12], look: 275, lookAlt: -6, airR: 90, airH: 150, stops: [
    { id: "aire-cabeza", es: "Desde el aire · cabeza", en: "From the air · head", at: [35, 115], look: 225, lookAlt: -30, air: 45 },
    { id: "aire-cuerpo", es: "Desde el aire · cuerpo", en: "From the air · body", at: [125, -25], look: 270, lookAlt: -28, air: 50 }] },
  cahokia: { label: [14, 35, 1], view: [16, -195], look: 0, lookAlt: 6, airR: 150, airH: 200, stops: [
    { id: "cima", es: "En la cima", en: "On the summit", at: [14, 35], look: 180, lookAlt: -6 }] },
  newark: { label: [230, 140, 5], view: [-316, -260], look: 52, lookAlt: 0, airR: 0, noAuto: true, stops: [
    { id: "paso", es: "Entre el Círculo y el Octágono", en: "Between the Circle and the Octagon", at: [-15, -25], look: 52, lookAlt: 1 },
    { id: "aire-circulo", es: "Desde el aire · Círculo", en: "From the air · Circle", at: [-250, -260], look: 45, lookAlt: -40, air: 180 },
    { id: "aire-octagono", es: "Desde el aire · Octágono", en: "From the air · Octagon", at: [40, -60], look: 45, lookAlt: -40, air: 220 }] },
  greatcircle: { label: [0, 0, 5], view: [139, 56], look: 248, lookAlt: 1, airR: 180, airH: 220, stops: [
    { id: "muro", es: "Sobre el muro", en: "On the wall", at: [0, -181], look: 90, lookAlt: -6 },
    { id: "aire-entrada", es: "Desde el aire · entrada", en: "From the air · gateway", at: [215, 85], look: 248, lookAlt: -22, air: 60 }] },
  maidencastle: { label: [30, 60, 6], view: [0, -300], look: 0, lookAlt: 8, airR: 200, airH: 220, stops: [
    { id: "muralla", es: "Sobre la muralla interior", en: "On the inner rampart", at: [0, -140], look: 180, lookAlt: -8 },
    { id: "interior", es: "En el interior", en: "Inside the fort", at: [30, 60], look: 90, lookAlt: 0 },
    { id: "aire-este", es: "Desde el aire · entrada este", en: "From the air · east entrance", at: [530, -130], look: 290, lookAlt: -25, air: 90 },
    { id: "aire-sur", es: "Desde el aire · murallas del sur", en: "From the air · southern ramparts", at: [0, -430], look: 0, lookAlt: -28, air: 150 }] },
  housesteads: { label: [0, 10, 4], view: [0, -170], look: 0, lookAlt: 8, airR: 130, airH: 160, stops: [
    { id: "fuerte", es: "Dentro del fuerte", en: "Inside the fort", at: [0, 0], look: 0, lookAlt: 0 },
    { id: "muro", es: "Sobre el risco del Muro", en: "On the Wall crag", at: [-41, 76], look: 270, lookAlt: -3 },
    { id: "aire-fuerte", es: "Desde el aire · fuerte", en: "From the air · fort", at: [130, -120], look: 315, lookAlt: -28, air: 70 }] },
  povertypoint: { label: [-302, -3, 4], view: [-150, 5], look: 270, lookAlt: 6, airR: 220, airH: 220, stops: [
    { id: "cima", es: "En la cima del Montículo A", en: "On top of Mound A", at: [-302, -3], look: 90, lookAlt: -8 },
    { id: "crestas", es: "Entre las crestas", en: "Among the ridges", at: [0, 7], look: 270, lookAlt: 2 },
    { id: "aire-crestas", es: "Desde el aire · crestas", en: "From the air · ridges", at: [200, -300], look: 325, lookAlt: -35, air: 220 }] },
};
