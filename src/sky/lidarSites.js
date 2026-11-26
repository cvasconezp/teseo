// lidarSites.js — sitios cuyo SUELO es una maqueta medida con láser desde el aire (LiDAR): el modelo digital del
// terreno de un organismo público, convertido en malla por scripts/lidar/build_site.py (ver allí qué se hace con
// el dato: nivelado contra el relieve global, malla adaptativa, borde suavizado, tono calculado).
// Cada archivo (public/data/<sitio>-lidar.bin) solo se descarga al estar en el sitio. Mismo formato que la maqueta
// del Templo Fortificado de Chankillo (machuModel.js: parseTonedModel).
//
//   base  cota (m) a la que van referidas las alturas del archivo        clip  radio de la maqueta (m)
//   z0    cota del suelo en el origen de la maqueta (m, ya nivelada)     src   organismo, conjunto de datos y licencia
export const LIDAR_SITES = {
  stonehenge: { file: "stonehenge-lidar.bin", base: 80, clip: 230, z0: 102.49, zmax: 105.45, lat: 51.178844, lon: -1.826189, res: 1,
    src: "Environment Agency (Inglaterra), LIDAR Composite DTM de 1 m, 2022 · Open Government Licence v3.0 · © Environment Agency copyright and/or database right 2022", url: "https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc" },
  maeshowe: { file: "maeshowe-lidar.bin", base: -10, clip: 110, z0: 20.79, zmax: 20.81, lat: 58.9966, lon: -3.1882, res: 0.5,
    src: "Historic Environment Scotland, HES LiDAR Project 2017 (Bluesky International), modelo del terreno de 0,5 m · Open Government Licence v3.0 · Contains Historic Environment Scotland data © Historic Environment Scotland, © Crown copyright and database right 2017", url: "https://remotesensingdata.gov.scot" },
  brodgar: { file: "brodgar-lidar.bin", base: -10, clip: 190, z0: 10.91, zmax: 14.79, lat: 59.0015, lon: -3.2297, res: 0.5,
    src: "Historic Environment Scotland, HES LiDAR Project 2017 (Bluesky International), modelo del terreno de 0,5 m · Open Government Licence v3.0 · Contains Historic Environment Scotland data © Historic Environment Scotland, © Crown copyright and database right 2017", url: "https://remotesensingdata.gov.scot" },
  stenness: { file: "stenness-lidar.bin", base: -10, clip: 90, z0: 3.46, zmax: 3.99, lat: 58.994, lon: -3.208, res: 0.5,
    src: "Historic Environment Scotland, HES LiDAR Project 2017 (Bluesky International), modelo del terreno de 0,5 m · Open Government Licence v3.0 · Contains Historic Environment Scotland data © Historic Environment Scotland, © Crown copyright and database right 2017", url: "https://remotesensingdata.gov.scot" },
  newgrange: { file: "newgrange-lidar.bin", base: 20, clip: 180, z0: 52.56, zmax: 56.85, lat: 53.6947, lon: -6.4755, res: 1,
    src: "Discovery Programme, Meath County Council y Heritage Council (vuelo de 2007), distribuido por Geological Survey Ireland, modelo del terreno de 1 m · CC BY 4.0 · Contains Irish Public Sector Data (Geological Survey Ireland & Discovery Programme)", url: "https://data.gov.ie/dataset/open-topographic-lidar-data" },
  knowth: { file: "knowth-lidar.bin", base: 30, clip: 170, z0: 75.04, zmax: 75.24, lat: 53.7012, lon: -6.4915, res: 1,
    src: "Discovery Programme, Meath County Council y Heritage Council (vuelo de 2007), distribuido por Geological Survey Ireland, modelo del terreno de 1 m · CC BY 4.0 · Contains Irish Public Sector Data (Geological Survey Ireland & Discovery Programme)", url: "https://data.gov.ie/dataset/open-topographic-lidar-data" },
  dowth: { file: "dowth-lidar.bin", base: 50, clip: 130, z0: 73.99, zmax: 80.05, lat: 53.703795, lon: -6.45058, res: 1,
    src: "Discovery Programme, Meath County Council y Heritage Council (vuelo de 2007), distribuido por Geological Survey Ireland, modelo del terreno de 1 m · CC BY 4.0 · Contains Irish Public Sector Data (Geological Survey Ireland & Discovery Programme)", url: "https://data.gov.ie/dataset/open-topographic-lidar-data" },
  avebury: { file: "avebury-lidar.bin", base: 140, clip: 300, z0: 159.72, zmax: 166.93, lat: 51.42861, lon: -1.85377, res: 1,
    src: "Environment Agency (Inglaterra), LIDAR Composite DTM de 1 m, 2022 · Open Government Licence v3.0 · © Environment Agency copyright and/or database right 2022", url: "https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc" },
  silbury: { file: "silbury-lidar.bin", base: 130, clip: 175, z0: 187.37, zmax: 187.54, lat: 51.4158, lon: -1.8575, res: 1,
    src: "Environment Agency (Inglaterra), LIDAR Composite DTM de 1 m, 2022 · Open Government Licence v3.0 · © Environment Agency copyright and/or database right 2022", url: "https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc" },
  cahokia: { file: "cahokia-lidar.bin", base: 110, clip: 260, z0: 157.28, zmax: 158.33, lat: 38.66029, lon: -90.06227, res: 1,
    src: "U.S. Geological Survey, 3D Elevation Program (3DEP), modelo del terreno de 1 m · dominio público", url: "https://www.usgs.gov/3d-elevation-program" },
  newark: { file: "newark-lidar.bin", base: 240, clip: 500, z0: 269.13, zmax: 273.17, lat: 40.0535, lon: -82.4465, res: 1,
    src: "U.S. Geological Survey, 3D Elevation Program (3DEP), modelo del terreno de 1 m · dominio público", url: "https://www.usgs.gov/3d-elevation-program" },
  greatcircle: { file: "greatcircle-lidar.bin", base: 240, clip: 250, z0: 264.8, zmax: 266.8, lat: 40.04105, lon: -82.43109, res: 1,
    src: "U.S. Geological Survey, 3D Elevation Program (3DEP), modelo del terreno de 1 m · dominio público", url: "https://www.usgs.gov/3d-elevation-program" },
  serpentmound: { file: "serpentmound-lidar.bin", base: 190, clip: 170, z0: 226.6, zmax: 238.38, lat: 39.025933, lon: -83.430936, res: 1,
    src: "U.S. Geological Survey, 3D Elevation Program (3DEP), modelo del terreno de 1 m · dominio público", url: "https://www.usgs.gov/3d-elevation-program" },
  maidencastle: { file: "maidencastle-lidar.bin", base: 50, clip: 560, z0: 127.84, zmax: 137.5, lat: 50.6947, lon: -2.47015, res: 1,
    src: "Environment Agency (Inglaterra), LIDAR Composite DTM de 1 m, 2022 · Open Government Licence v3.0 · © Environment Agency copyright and/or database right 2022", url: "https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc" },
  housesteads: { file: "housesteads-lidar.bin", base: 200, clip: 300, z0: 264.8, zmax: 284.56, lat: 55.0131, lon: -2.3304, res: 1,
    src: "Environment Agency (Inglaterra), LIDAR Composite DTM de 1 m, 2022 · Open Government Licence v3.0 · © Environment Agency copyright and/or database right 2022", url: "https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc" },
  povertypoint: { file: "povertypoint-lidar.bin", base: 0, clip: 580, z0: 30.85, zmax: 50.92, lat: 32.6353, lon: -91.408, res: 1,
    src: "U.S. Geological Survey, 3D Elevation Program (3DEP), modelo del terreno de 1 m · dominio público", url: "https://www.usgs.gov/3d-elevation-program" },
};
export const lidarFile = (name) => LIDAR_SITES[name] || null;
