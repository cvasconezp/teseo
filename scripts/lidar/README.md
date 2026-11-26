# Suelos LiDAR de los sitios de «Mi cielo»

Convierte el modelo digital del terreno (LiDAR aéreo, sin árboles ni edificios) de un organismo público en la maqueta
de terreno de un sitio, con el mismo formato que la del Templo Fortificado de Chankillo.

1. `fetch_dtm.py <sitio> <fuente> <lat> <lon> <radio>` — descarga y recorta el relieve a `/tmp/lidar/<sitio>/`
   (`dtm.tif`, `meta.json` con fuente y licencia, y `hillshade.png` para mirarlo). Fuentes directas: `ea`
   (Environment Agency, Inglaterra) y `usgs` (3DEP, EE. UU.); con `tif`, cualquier GeoTIFF ya descargado
   (Escocia: `srsp-open-data.s3.eu-west-2.amazonaws.com/lidar/hes/hes-2017sp3/dtm/27700/gridded/<TESELA>_50CM_DTM_HES_2017SP3.tif`;
   Irlanda: teselas de 5 km de `gsi.geodata.gov.ie/downloads/LIDAR/<E>_<N>.zip`, en ITM).
2. `sites.json` — por sitio: radio de la maqueta (`clip`), radio con todo el detalle (`core`), tolerancias, bultos que
   se quitan (`remove`) y llanos (`flatten`).
3. `build_site.py <sitio>` — escribe `public/data/<sitio>-lidar.bin` y `scripts/data/<sitio>-dem.json`, y deja
   `/tmp/lidar/<sitio>/mesh.png` (mírala antes de seguir) y `build.json`.
4. `registry.py` — reescribe la tabla de `src/sky/lidarSites.js`.
5. En la app: `src/sky/lidarPlan.js` (rótulo, vista general, puntos de visita, tomas aéreas), `src/sky/lidarInfo.js`
   (lugar y ficha, con fuentes) y, si hay piedras en pie, `src/sky/lidarStones.js`. Pruebas: `node scripts/test_lidar.mjs`.

Necesita `numpy`, `scipy`, `rasterio`, `pyproj` y `Pillow`. Antes de usar un servicio de `usgs`, comprueba en el
sombreado que el dato es de 1 m (bordes nítidos): donde no hay LiDAR, el servicio devuelve el modelo de 10 m
remuestreado (pasó en el Cañón del Chaco, que por eso no está).

## Piedras en pie (`src/sky/lidarStones.js`)

Posición y altura salen de restar el modelo del terreno al modelo de SUPERFICIE del mismo LiDAR (Escocia:
`.../hes-2017sp3/dsm/27700/gridded/<TESELA>_50CM_DSM_HES_2017SP3.tif`; Inglaterra: WCS del «LIDAR Composite DSM 1 m»
de la Environment Agency): cada piedra es un máximo local compacto. En Brodgar se buscan en la corona de 46 a 58 m del
centro del foso; en Avebury se toman las posiciones de OpenStreetMap y el LiDAR solo confirma cuáles están en pie y
cuánto miden. Las detecciones dudosas (un solo punto, menos de 1 m, junto a casas o setos) no entran, y no se añade
ninguna piedra para completar un anillo. El LiDAR se queda corto en piedras estrechas; no se corrige.

## Medidas que cita la ficha («Medido por Teseo en el LiDAR», `src/sky/monumentInfo.js`)

Se sacan del `dtm.tif` de cada sitio: la cota de la cima menos el mínimo de un perfil radial hacia cada punto cardinal
(Silbury Hill: 37–39 m sobre el foso y 28 m sobre el terreno del sur; Monks Mound: 30–34 m sobre la llanura), el radio
de la cresta en el perfil medio (Gran Círculo de Newark: 181 m) y la altura de los muros sobre el terreno de fuera
(Octágono: 1,6–2,3 m; banco de Avebury sobre el fondo del foso: 8–12 m). En Maiden Castle, Housesteads y Poverty Point las cifras salen de perfiles sobre la maqueta ya simplificada
(cresta de muralla menos fondo de foso; cima del Montículo A menos el terreno de alrededor; cresta menos surco).
