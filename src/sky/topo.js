// topo.js — teselas de OpenTopoMap y proyección de Mercator para el mapa topográfico (TopoPicker.jsx).

export const TOPO_TILE = (z, x, y) => `https://${"abc"[(x + y) % 3]}.tile.opentopomap.org/${z}/${x}/${y}.png`;
export const TS = 256, ZMIN = 3, ZMAX = 17;

// proyección de Mercator en píxeles del mundo a un zoom dado
export const toPx = (lat, lon, z) => {
  const s = TS * 2 ** z, la = Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180;
  return [((lon + 180) / 360) * s, ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * s];
};
export const toLL = (x, y, z) => {
  const s = TS * 2 ** z, lon = (x / s) * 360 - 180, n = Math.PI - (2 * Math.PI * y) / s;
  return [(180 / Math.PI) * Math.atan(Math.sinh(n)), ((lon + 540) % 360) - 180];
};

