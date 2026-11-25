// GENERADO por scripts/build_inti_scan.py — no editar a mano.
// Cima del Intihuatana de Machu Picchu: malla del escaneo láser de 2009, simplificada de 484105 a 23000 triángulos (14000 en la roca tallada),
// más 848 de relleno donde el láser no alcanzó el piso (inferido: al nivel del piso medido más cercano).
// Los datos van en public/data/inti-scan.bin (se descargan solo al estar en Machu Picchu; los lee machuModel.js):
//   Uint32[nv, nt] · Int16[nv·3] (este, norte, altura en cm desde la punta del gnomon —planta— y el piso) · Uint16[nt·3] · Uint8[nt] clase
//   clases: 0 roca tallada · 1 muro · 2 piso · 3 relleno inferido
// DATOS CON LICENCIA PROPIA: Creative Commons BY-NC 3.0 (https://creativecommons.org/licenses/by-nc/3.0/).
// Crédito: Instituto Nacional de Cultura, Center for Advanced Spatial Technologies (University of Arkansas) y
// Cotsen Institute for Archaeology (UCLA). Cambios: simplificación de la malla y cambio de origen; la forma no se retoca.
export const INTI_SCAN = {
  credit: "Instituto Nacional de Cultura · CAST (University of Arkansas) · Cotsen Institute for Archaeology (UCLA) · CC BY-NC 3.0",
  gnomonTop: 1.68,          // m sobre el piso que rodea la roca
};
