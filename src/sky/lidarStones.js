// lidarStones.js — piedras EN PIE de los sitios con suelo LiDAR, medidas en datos públicos (scripts/lidar/README.md: cómo).
// Cada una: [este, norte, alto, ancho, grueso, giro] en m desde el origen de la maqueta del sitio (lidarSites.js).
//  · Brodgar y Stenness: posición y altura medidas en el modelo de SUPERFICIE del mismo LiDAR (superficie menos terreno;
//    Historic Environment Scotland, 2017, 0,5 m). En Stenness, la planta de cada piedra es la de © colaboradores de OpenStreetMap.
//  · Avebury: posición y planta de © colaboradores de OpenStreetMap (ODbL); altura medida en el modelo de superficie de la
//    Environment Agency (1 m). Solo las piedras que el LiDAR confirma en pie.
// El LiDAR se queda corto en piedras estrechas (en Stenness, hasta 1,3 m menos que lo publicado): no se corrige. Solo
// van las detecciones seguras: las dudosas (un solo punto, tocones, junto a casas o setos) se dejan fuera, y no se
// añade ninguna piedra para completar un anillo. El ancho y el grueso de Brodgar salen de 3 a 7 puntos: son aproximados.
export const LIDAR_STONES = {
  brodgar:[[32.8,33.4,1.9,1.4,0.5,31], [36.5,30.4,1.9,1.0,0.6,44], [49.3,12.0,2.6,1.4,0.5,89], [46.1,-26.1,2.0,1.0,0.6,134], [31.3,-44.5,2.8,1.8,0.5,139], [11.2,-52.8,2.4,1.4,0.5,179], [3.2,-54.9,2.8,1.4,0.5,179], [-1.3,-55.5,2.2,1.5,0.6,17], [-11.9,-53.7,2.7,1.4,0.5,179], [-21.5,-49.8,2.5,1.5,0.6,17], [-31.1,-44.3,2.2,1.0,0.6,44], [-35.3,-40.6,2.5,1.0,0.6,44], [-39.3,-36.7,2.2,1.4,0.9,33], [-42.8,-32.7,2.4,1.3,0.8,17], [-51.9,2.4,3.9,1.9,0.5,89], [-22.9,42.5,1.9,1.2,0.6,152], [-11.4,47.5,3.0,1.5,0.6,161], [182.0,-40.2,1.6,1.2,0.6,102]],
  stenness:[[-9.0,20.2,1.7,2.5,1.7,176], [-5.8,-10.1,3.9,3.1,1.1,0], [-13.3,-7.3,4.2,2.6,1.9,12], [-18.9,8.9,4.5,2.4,2.0,109]],
  avebury:[[-5.1,-166.1,1.9,3.2,2.1,25], [-15.5,-168.0,1.9,3.4,1.7,5], [120.8,114.0,2.1,4.0,2.5,102], [-85.6,-143.0,1.6,4.3,2.2,65], [-26.3,-168.3,1.9,3.6,2.0,38], [-58.9,-165.1,2.4,3.5,2.5,158], [-48.1,-167.5,1.8,3.0,2.3,87], [30.6,-158.7,3.7,4.5,2.5,171], [41.6,-152.6,3.8,4.5,2.5,139], [-174.0,67.5,1.3,1.9,1.9,68], [-110.7,137.7,3.2,4.0,2.5,176], [-129.7,126.0,1.8,3.1,1.8,155], [-96.8,144.0,3.8,4.4,2.0,156], [-179.4,49.3,1.3,2.2,2.0,126], [-119.0,-116.3,2.4,4.1,2.5,5], [-148.8,111.9,1.3,3.1,2.1,157], [-103.0,-130.7,1.7,3.9,1.7,35], [-19.9,51.2,3.6,4.5,1.9,36], [-14.1,50.1,2.1,4.0,2.2,175], [5.1,96.5,3.2,4.5,1.5,11], [35.1,51.1,3.2,3.2,2.0,21], [-18.1,-87.2,1.8,3.1,1.4,58], [5.8,-109.3,2.8,4.5,1.6,30], [15.6,-112.6,1.4,4.5,1.8,10], [25.9,-113.6,3.4,3.2,2.5,3]]
};
