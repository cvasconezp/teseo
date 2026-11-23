# Cambios

## 1.63.1 — 2026-11-22

- **Textos de la web con todo lo que hace Teseo hoy:** la descripción para buscadores y redes, la portada estática, los datos estructurados (lista de funciones), el manifiesto de la app, `llms.txt` y las páginas «Acerca de» (español e inglés) ya no presentan a Teseo solo como mapa estelar: nombran el horizonte real en 3D (montañas, volcanes en erupción y sitios arqueológicos), el tiempo y las nubes del lugar, las capas del vecindario y del cielo profundo, la contaminación lumínica, las fichas que se escuchan, los cálculos, el calendario, los viajes, el laboratorio de preguntas, las postales, la foto 360° y la ciencia ciudadana.

## 1.63.0 — 2026-11-22

- **Tarjeta del tiempo:** al tocar la pastilla de la temperatura se abre una tarjeta con el interruptor de las nubes, el estado del cielo, la sensación térmica, el viento (velocidad y de dónde viene), la nubosidad total y por capas (altas, medias y bajas), la nubosidad de las próximas 12 horas, la probabilidad de lluvia, la humedad, el índice UV y la visibilidad. Datos de Open-Meteo.
  - **Mejor ventana:** en el gráfico de 12 horas se resaltan las horas de noche más despejadas.
  - **Tocar una hora lleva el cielo a esa hora**, con sus nubes previstas.
  - La pastilla muestra un icono de viento junto a la velocidad; temperatura y viento no se repiten dentro de la tarjeta.

## 1.62.0 — 2026-11-22

- **Modelos 3D nuevos (formas simplificadas, con medidas publicadas):**
  - **Karnak:** el primer pilono, de 113 m de ancho y 14,5 m de fondo, con la torre norte en 21,7 m y la sur en 31,65 m (quedó sin terminar) y la puerta de 7,4 m. Se ve desde 90 m delante, en el eje del templo: en el solsticio de diciembre el Sol sale por la puerta.
  - **Angkor Wat:** la galería exterior (187 × 215 m), el segundo recinto (100 × 115 m), la galería interior de 60 m y las cinco torres; la central, a 65 m sobre el suelo. Se ve desde 170 m al oeste, en el eje de la entrada. Las alturas de las galerías bajas y de las torres de las esquinas son aproximadas.

## 1.61.0 — 2026-11-22

- **Modelos 3D nuevos (formas simplificadas, con medidas publicadas):**
  - **Taj Mahal:** zócalo de 95,5 m, edificio de unos 57 m con las esquinas achaflanadas, cúpula en bulbo hasta 73 m, cuatro templetes y cuatro minaretes de más de 40 m. Visto desde el jardín, 150 m al sur.
  - **Cristo Redentor:** pedestal de 8 m, figura de 30 m y brazos de 28 m. Visto desde la terraza; la dirección a la que mira es aproximada.
  - **Abu Simbel:** la fachada del Gran Templo, de 35 × 30 m, tallada en el cerro, con los cuatro colosos sentados de unos 20 m (el segundo desde la izquierda, roto desde la Antigüedad). Mira al este y se ve desde 70 m al este.

## 1.60.0 — 2026-11-21

- **Modelos 3D nuevos:**
  - **Ingapirca:** el Templo del Sol o «Castillo», una plataforma de 37,10 × 12,35 m con los extremos redondeados, de sillería (Fresco y Ziółkowski, 1984); la orientación es aproximada. El punto de vista está a 40 m al sur.
  - **Maeshowe:** el túmulo de 35 m de diámetro y 7,3 m de alto, con la entrada al suroeste. El punto de vista está frente a ella.
  - **Coliseo:** la elipse de 188 × 156 m y 48 m de alto, con las gradas y la arena (forma simplificada), vista desde el centro de la arena.
- **Puntiachil** (Cayambe), en la lista de sitios de Ecuador.

## 1.59.1 — 2026-11-21

- Se quita la vista desde la cima de las pirámides (Sol, Luna, El Castillo y Keops) y sus entradas de la lista: las pirámides vuelven a verse desde el suelo, como antes.

## 1.59.0 — 2026-11-21

- **Lista desplegable de sitios, por regiones** (Ecuador, América, resto del mundo y siete maravillas modernas), con 25 sitios nuevos; coordenadas de Wikidata o Wikipedia, comprobadas el 21-nov-2026:
  - **Ecuador:** Ingapirca, Pucará de Rumicucho, Quitoloma (Pambamarca), Tulipe y Real Alto.
  - **América:** Fajada Butte (Chaco), Xochicalco, Monte Albán, Sacsayhuamán, Písac e Isla del Sol.
  - **Resto del mundo:** Abu Simbel, Karnak, Angkor Wat, Maeshowe y Mnajdra.
  - **Siete maravillas modernas:** Petra, Gran Muralla (Badaling), Coliseo, Cristo Redentor y Taj Mahal (Machu Picchu y Chichén Itzá ya estaban).
- **De pie en la cima de las pirámides:** Pirámide del Sol y de la Luna (Teotihuacan), El Castillo (Chichén Itzá) y Keops (Guiza). Se ve desde la plataforma de arriba, con el relieve 3D a la altura correcta. Hoy no se permite subir a ninguna.
- **Sin agujas falsas en el relieve.** Las teselas de relieve traen a veces picos sueltos (en el lago San Pablo, uno de 400 m sobre el agua; otro junto al Sangay). Ahora se quitan al leerlas: se descarta todo píxel muy por encima de la mediana de su entorno, con un umbral que respeta las cumbres reales.

## 1.58.2 — 2026-11-21

- **Imagen nítida al quedarse quieto.** Al moverse, si el equipo va lento, la app dibuja con menos resolución; ahora, quieta más de medio segundo, vuelve a la resolución completa (antes la imagen quieta quedaba en escalones).
- **Cumbres con otra cima al lado** (Chimborazo): cerca del observador ya no se allanan las subidas de verdad, solo los bultos bajos del modelo. Desaparece la plataforma con un corte recto y la cumbre detrás.

## 1.58.1 — 2026-11-21

- **Sin paisaje provisional.** El relieve 3D se pide a la vez que el horizonte y, mientras llega, ya no se dibujan las franjas planas que luego cambiaban (si tarda más de 8 s o falla, quedan las franjas).
- **Sin rayas verticales al mirar ladera abajo** (Pichincha, la nieve del Chimborazo): el filtrado anisótropo de la imagen dejaba nítida cada columna y emborronaba el radio. Ahora se desenfoca igual en los dos sentidos, y lo lejano se ve igual de nítido.
- **Sin escalones en el perfil cercano** (el borde del cráter del Cotopaxi): cerca, las alturas se promedian a lo ancho (±15 m), según la resolución real del dato.
- **Paranal y otras explanadas:** la malla 3D y el piso del sitio usan la misma altura bajo los pies; ya no aparece una «cortina» oscura de unos metros en el borde.

## 1.58.0 — 2026-11-21

- **Relieve hasta 300 km.** El relieve 3D y el horizonte llegan ahora a 300 km (antes 150): desde las cumbres asoman con su forma nevados lejanos que antes no se dibujaban. Más allá de 150 km también se rotulan los volcanes. La bruma de la distancia es más ligera: las cordilleras lejanas ya no se ven como franjas blanquecinas.
- **El piso de los sitios con monumentos sigue el terreno.** Ya no es un llano a la altura de los pies que tapaba la caída de la loma (Catequilla parecía una pampa de cientos de metros). Ahora toma las alturas del relieve 3D: en una cima, el suelo baja y se ve el valle. Los muros y discos bajos (el muro semicircular y el disco lítico de Catequilla) siguen el suelo y ya no flotan. Los edificios quedan en su propia explanada, y el piso llega hasta el más lejano (en Machu Picchu ninguna casa queda fuera).
- **Pantalla siempre encendida en el celular** mientras se usa la app; vuelve a apagarse tras 20 minutos sin tocarla.
- El grano de la nieve en las cumbres ya no hace un cuadriculado a lo lejos.

## 1.57.1 — 2026-11-21

- **Nombres siempre en su sitio tras un salto de la vista**: los nombres se recalculan solo uno de cada cinco cuadros; si la vista saltaba y luego se quedaba quieta, podían quedar donde estaban antes del salto hasta el siguiente cálculo (en un aparato lento, segundos). Ahora, si un cuadro con movimiento no los recalcula, se recalculan en el siguiente.
- **«¿Sabías que…?» contrastado con fuentes**: el monte Olimpo de Marte mide unas dos veces y media el Everest (no casi tres); la Gran Mancha Roja de Júpiter se sigue sin interrupción desde 1878; Sirio B es algo más pequeña que la Tierra; se añade la distancia actual de Arturo (37 años luz) y se precisa el estudio de las Pléyades (Nature, 2000).

## 1.57.0 — 2026-11-21

- **En las cumbres el paisaje se ve desde 5 m más arriba** (como desde una torre baja): con los ojos a 1,7 m, una cima ancha tapaba casi todo lo de abajo. Solo cambia el dibujo del relieve; el cielo y las horas de salida y puesta siguen siendo los del lugar. No se aplica donde hay monumentos al lado.
- **Sitios arqueológicos sobre el terreno real**: con el relieve 3D ya no se dibuja el piso de arena del sitio; los monumentos se apoyan en el relieve, con su color y su textura (Catequilla deja de parecer un desierto).
- **Mapa fotográfico sin el halo de las estrellas más brillantes**: alrededor de Rigel, Sirio y las demás de magnitud menor que 1,3 las placas dejaban un disco azul con una cruz (reflejos del telescopio); ahí el mapa se apaga.

## 1.56.0 — 2026-11-21

- **El suelo bajo los pies ya no es un color liso**: desde una cumbre, el terreno cercano tiene la textura del paisaje —matas, piedras y manchas a varias escalas, y en la nieve su relieve menudo—, con el color del terreno de alrededor. Sin rayas en las laderas empinadas.
- **«¿Sabías que…?»**: un dato llamativo y comprobado en la ficha de los objetos más conocidos (Sol, Luna, planetas, Sirio, Canopus, Vega, Betelgeuse, Rigel, Antares, Aldebarán, Arturo, Polaris, Alfa Centauri, M1, M13, M31, M42, M45 y M87), que «Escuchar» también cuenta.

## 1.55.0 — 2026-11-21

- **Relieve 3D hasta 150 km** (antes 60): todo lo que abarca el horizonte es ya terreno con la imagen de satélite; las siluetas planas dejan de usarse cuando el relieve está cargado.
- **Fuera las franjas verticales** al mirar hacia abajo desde una cumbre: cerca del observador la imagen se lee desenfocada (a menos de ~100 m, un solo color, el del lugar) y la luz se calcula con la pendiente medida sobre al menos 60 m.
- **Sitios arqueológicos sin «desierto»**: con el relieve 3D, el piso propio del sitio solo cubre el entorno del monumento (como mucho 60 m) y se desvanece; más allá se ve el terreno real. Si el monumento más cercano queda lejos, no se dibuja piso.
- **Con las montañas a la vista no se nombran los astros del otro lado del globo**, salvo los que están a menos de 3° bajo el filo del relieve (a punto de salir).
- **Buscador de cumbres**: «volcán de fuego» encuentra el Volcán de Fuego de Guatemala (se comparan las palabras propias del nombre, no la frase entera).
- **Marcas de los polos celestes, el cenit y el nadir**: pequeñas (unos 13 px) y del mismo tamaño con cualquier zoom, también al apuntar con el teléfono.

## 1.54.0 — 2026-11-21

- **«Escuchar» cuenta la ficha en vez de leerla**: quién es el objeto, dos frases de su descripción, los datos dichos como frases («Está a 25 años luz. La luz que ves salió hace 25 años…»), en las estrellas su vida y su final («Ahora está en la etapa de secuencia principal. Después será gigante roja…»), cómo se ve desde tu lugar y de quién es la imagen. Sin letra pequeña ni detalles técnicos.
- **Relieve 3D hasta 60 km** (antes 25) y más fiel: la malla toma lo más alto de cada celda, así su silueta coincide con la del horizonte y ya no asoma una segunda montaña detrás; el suelo bajo los pies es parte del relieve (sin disco ni círculo en las cumbres) y el arrebol ya no deja motas.
- **Contaminación lumínica según el lugar**: si no has elegido tú la clase de cielo de un lugar, se estima con las luces nocturnas que ve el satélite en 80 km a la redonda (NASA Black Marble 2016). Es una estimación (±1 clase), no una medición; la que elijas tú manda y se guarda por lugar.
- **Capas por grupos**: en «Capas», tres botones —Imprescindibles, Básicas, Avanzadas— encienden los catálogos de una vez.
- **Vía Láctea** más limpia y menos apagada: se fundió el grano de la imagen y se aclararon los medios tonos.
- **Erupciones**: el aviso de la simulación dice también el viento; de pie en la cumbre de un volcán en erupción, la columna sube a tu lado.
- **Fuera la línea del horizonte de 0°** cuando se ve el relieve real.

## 1.53.0 — 2026-11-21

- **Relieve en 3D con la imagen de satélite**: los primeros 25 km alrededor del lugar ya no son siluetas planas, sino el terreno de verdad (AWS Terrain Tiles) con la imagen de Sentinel-2 cloudless 2016 (EOX, CC BY 4.0) encima: laderas, quebradas, cultivos y páramo, con la luz del Sol según la pendiente, sombra, arrebol, bruma y nieve sobre la línea de nieves (más en lo llano, menos en las paredes). Desde una cumbre se ve el paisaje hacia abajo. Más allá de 25 km siguen las siluetas. Los restos de nubes del mosaico se pintan con el color medio del monte.
- **Viento en la pastilla del clima**: de dónde viene y a cuántos km/h (Open-Meteo, a 10 m del suelo). Si no hay pronóstico en altura, ese viento también tumba las plumas de los volcanes.
- **Erupciones**: columnas más contenidas (el VEI de una erupción larga es el de su momento más fuerte: ahora se dibuja la parte baja del intervalo; VEI 3 ≈ 6 km en vez de 9), la pluma ya no se ensancha sin límite, sale de la cima (no flotando sobre ella) y se corrigió una arista recta en el humo. El aviso de la simulación dice el año de la última erupción y que hoy no está en erupción, y la ficha del volcán trae «Parar la simulación».
- **Capas al empezar**: vienen encendidas Sol, Luna y planetas, planetas enanos y asteroides, cometas, sondas, mapa fotográfico, Messier, NGC e IC, galaxias, campos profundos, agujeros negros, atmósfera, montañas con sus nombres, monumentos y la eclíptica.
- **Arreglos**: de día ya no se ven estrellas entre el horizonte de 0° y las montañas (desde una cumbre); las marcas de los polos celestes, el cenit y el nadir conservan su tamaño al acercarse.

## 1.52.0 — 2026-11-21

- **Erupciones con volumen**: el humo de los volcanes (los que están en erupción y las simulaciones) ya no es una mancha plana: es una pluma con cuerpo, que sube, se tumba con el viento, se abulta como coliflor, recibe la luz del Sol y hace sombra sobre sí misma; de noche el cráter resplandece. Sin viento del pronóstico se dibuja de lado, como se ve en las cámaras. Sigue siendo una ilustración, no un pronóstico de ceniza.
- **Desde una cumbre, el cielo llega hasta las montañas**: se quita la franja de otro color que quedaba entre el horizonte matemático (0°) y las crestas que se ven por debajo. La línea de 0° queda como referencia tenue.
- **Lectura en voz alta**: dice «hacia el sur» en vez de «al S», lee las alturas como un número («5286 metros») y hace la pausa después de cada dato.

## 1.51.0 — 21 de noviembre de 2026

- Nombres de volcanes: los que están en erupción y se ven llevan siempre su
  nombre (el Sangay desde el Chimborazo); los volcanes del Smithsonian que
  forman la silueta se nombran aunque el mapa de cumbres no los traiga (el
  Cotopaxi desde el Cayambe); en el servidor, un volcán cuyo punto del mapa
  está en el cráter o la laguna se busca en todo su macizo (Mojanda, Cusín).
- El tiempo de ahora: en el teléfono va arriba, entre el buscador y «…», solo
  con icono y temperatura (ya no tapa los créditos). La temperatura se corrige
  con la altitud del modelo de terreno, no con la del GPS del navegador.
- Paisaje: los colores del satélite se suavizan mucho más a lo largo del
  horizonte (sin franjas verticales).
- Modelo 3D de planetas y lunas: con el dedo se gira también en vertical.
- «Escuchar»: lectura narrada (sin deletrear signos, unidades en palabras),
  preferencia por las voces naturales del aparato y un punto más despacio.

## 1.50.3 — 21 de noviembre de 2026

- Nombres de las cumbres desde una cumbre: se calculan sobre el mismo
  horizonte fino que se dibuja (`/api/peaks?fine=1`). Antes, desde la cumbre
  del Cotopaxi o del Rucu Pichincha, el ángulo de cada cumbre no coincidía con
  la silueta y el cielo descartaba nombres como los de los Ilinizas.
- Menos franjas claras en el paisaje: además de las nubes, se descartan sus
  bordes grises y sus sombras del mosaico de satélite; el satélite pesa menos
  en las bandas lejanas (allí manda la bruma); los cortes entre bandas mezclan
  menos color; el color se suaviza más a lo largo del horizonte.
- Más verde y pardo cerca: menos bruma en las bandas cercanas y algo más de
  saturación en el color del satélite.

## 1.50.2 — 21 de noviembre de 2026

- Sin franjas blanquecinas en el paisaje: el mosaico de satélite de 2016
  conserva nubes (sobre todo hacia la Amazonía) e invernaderos blancos; esos
  píxeles ya no cuentan como color del suelo y el color no pasa de un suelo
  claro.
- Los colores del satélite van siempre con «Montañas», sin interruptor
  propio.
- Los volcanes en erupción (Reventador, Sangay) muestran su pluma de gases y
  ceniza siempre que se ven, aunque los nombres de las montañas estén
  apagados. «Simular su última erupción» queda solo para los que no están en
  erupción.

## 1.50.1 — 21 de noviembre de 2026

- Volcanes en erupción: se reconocen las erupciones que el Smithsonian da
  por continuadas (fin marcado con «>»), además de las que acaban este año.
  En Ecuador, el Reventador (desde 2008) y el Sangay (desde 2019).

## 1.50.0 — 21 de noviembre de 2026

- Textura del paisaje: las laderas toman su color real de un mosaico de
  satélite sin nubes (Sentinel-2 cloudless 2016, EOX, CC BY 4.0), con la luz
  del momento, la bruma de la distancia y una textura generada de quebradas
  y grano. Interruptor «Colores del satélite» en Montañas (encendido por
  defecto). Nuevo `/api/horizon/colors`.
- «Escuchar»: un botón con un altavoz en todas las fichas (estrellas,
  planetas, constelaciones, volcanes, la ISS) lee la ficha en voz alta con la
  voz del teléfono o del navegador.
- Erupciones ilustrativas: en la ficha de un volcán, «Simular su última
  erupción» dibuja una columna de ceniza animada con la altura típica de su
  VEI (Smithsonian) y el viento del pronóstico, con un aviso de que es
  ilustrativa. Los volcanes que el Smithsonian da en erupción este año
  llevan una pluma suave. La ficha muestra el VEI de la última erupción.

## 1.49.0 — 21 de noviembre de 2026

- Ficha de las montañas del horizonte: al tocar el nombre de una cumbre se
  abre su ficha (altura, distancia y rumbo, y un botón para situarse en su
  cumbre). Si es un volcán del Holoceno, sus datos del Smithsonian (Global
  Volcanism Program): tipo, última erupción, entorno tectónico, roca y un
  enlace a su página. Nuevo `/api/volcanoes`; la base se lee en vivo y no se
  guarda en el repositorio (uso educativo y no comercial).
- Los volcanes con erupciones desde 1900 llevan el año bajo su nombre, en
  naranja con un triángulo.
- Mapa topográfico (OpenTopoMap) en el panel de Lugar: se elige un punto
  tocándolo, y se puede ir a la cumbre más cercana.
- El tiempo de ahora sobre el cielo: una pastilla con el estado y la
  temperatura del lugar (Open-Meteo, corregida a su altitud); al tocarla se
  abre el panel de nubes y clima.

## 1.48.2 — 20 de noviembre de 2026

- De pie en una cumbre (elegida por su nombre, con el GPS en la cima o en
  un alto con todo el horizonte por debajo), bajo las montañas hay suelo
  opaco: nieve en las cumbres nevadas, tierra en las demás, del mismo
  color que la ladera. En cualquier otro lugar sigue el suelo translúcido.
- La ladera que pisas tapa siempre el mar de nubes de abajo (quedaban
  cuñas de nube sobre el suelo, con bordes rectos).

## 1.48.1 — 20 de noviembre de 2026

- Vuelve el suelo translúcido bajo el horizonte: la v1.47.0 alargaba la
  franja de montañas más cercana hasta abajo en cualquier lugar con algún
  filo bajo 0° (casi todos en los Andes), y tapaba las estrellas del otro
  lado de la Tierra con un suelo verde opaco.
- Buscador: la cumbre más alta va en segundo lugar cuando hay muchos
  pueblos homónimos (el monte Fuji quedaba fuera de la lista).

## 1.48.0 — 20 de noviembre de 2026

- Mar de nubes: desde una cumbre, las capas de nubes que quedan por debajo
  se ven mirando hacia abajo, iluminadas desde arriba, y las montañas que
  asoman sobre ellas las tapan. Las capas se miden desde el suelo medio de
  la celda del modelo de Open-Meteo (ahora se pide `elevation=nan`), y un
  mar de nubes por debajo ya no tapa las estrellas.
- Montañas de todo el mundo en el buscador: los nombres de las cumbres de
  OpenStreetMap llegan en inglés (el Everest ya no sale como «珠穆朗玛峰»),
  el país se traduce al idioma de la app y, entre homónimas, va primero la
  más alta según el modelo de terreno (el Everest de Nepal antes que la
  loma de Indiana), con su altura aproximada.
- Cumbres con cráter (Fuji, Popocatépetl): si lo más alto cae en el borde
  del círculo de búsqueda, se amplía hasta encontrar la cima.

## 1.47.0 — 20 de noviembre de 2026

- De pie en la cumbre: al buscar una montaña o un volcán, Teseo te pone en
  su cima según el modelo de terreno (antes quedabas en el punto que da
  GeoNames, a veces a más de 1 km y 500 m por debajo; el Cotopaxi, por
  ejemplo). Nuevo `/api/summit` en el servidor.
- El buscador encuentra también las cumbres y volcanes de OpenStreetMap
  (Photon, de Komoot): ahora aparecen el volcán Cayambe, el Chimborazo, el
  Antisana… marcados como «Volcán» o «Cumbre».
- «Usar mi ubicación» pide el GPS en alta precisión, calcula el horizonte
  en tu punto exacto (celda de 22 m en vez de 220 m) y, si estás en una
  cima, te sube al punto más alto del modelo; los sitios arqueológicos
  usan también la posición exacta.
- Desde una cumbre el paisaje se ve hacia abajo: las montañas que quedan
  bajo el horizonte se dibujan (antes solo se veía suelo oscuro), con
  bruma entre los filos lejanos y el horizonte.

## 1.46.0 — 19 de noviembre de 2026

- Cochasquí, un solo lugar: el observador queda de pie en el vértice oeste
  de la plataforma de la pirámide G, 14 m sobre la ladera (se retiran el
  mirador de abajo y el lugar aparte «sobre la pirámide G»).
- El suelo de todos los sitios sigue ahora hasta el horizonte: desde un
  punto alto quedaba una franja oscura entre el suelo y las montañas
  lejanas (se veía también en Machu Picchu).

## 1.45.1 — 19 de noviembre de 2026

- Cochasquí: etiquetas de las pirámides más cortas (en el teléfono se
  montaban sobre los nombres de las montañas).

## 1.45.0 — 19 de noviembre de 2026

- Lugar nuevo «Cochasquí · sobre la pirámide G»: el observador de pie en la
  plataforma de la pirámide mayor, 14 m sobre la ladera, con las otras
  catorce alrededor y su rampa bajando al sur.

## 1.44.1 — 19 de noviembre de 2026

- Buscador: las constelaciones se encuentran también con acento («Orión»);
  en la 1.44.0 el orden estaba corregido, pero la constelación no llegaba a
  salir en la lista.

## 1.44.0 — 19 de noviembre de 2026

Revisión completa del Cielo (catálogos, capas, posiciones y fichas).

- Planetas: Saturno estaba a 0,12° (7′) de su sitio y Júpiter a 1,4′; faltaban
  sus perturbaciones mutuas. Con ellas, el Sol y los siete planetas quedan a
  1,5′ o menos de JPL Horizons en cuatro fechas entre 2020 y 2035 (prueba
  nueva, permanente).
- TON 618 estaba 14′ al norte de su sitio (declinación mal convertida).
- NGC 5866 salía dos veces (es M102): se quita de «Galaxias».
- Buscador: «Orión» da primero la constelación (antes, las Oriónidas); no
  distingue acentos y el nombre exacto va antes que lo que empieza igual.
- Comprobado sin cambios: integridad de los once catálogos (13.000 objetos);
  posiciones frente a SIMBAD de Messier, Caldwell, las listas escogidas,
  estrellas con nombre, fotos y muestras de NGC, galaxias y púlsares
  (mediana de 0,05′ o menos); los 16 interruptores de capas; y la ficha de
  un objeto de cada capa, sin errores.

## 1.43.0 — 18 de noviembre de 2026

- De cerca, como por un telescopio: con menos de 25° de campo, los objetos
  de catálogo (Messier, Caldwell, Galaxias) tienen nombre y se pueden elegir
  aunque no se vean a simple vista con la atmósfera de ese momento (M110 y
  M32 junto a Andrómeda, por ejemplo). Antes quedaban en la foto sin poder
  tocarlos.
- NGC e IC, ampliado: de 960 a 4.550 objetos (hasta magnitud 14,5, y las
  nebulosas, cúmulos y asociaciones sin magnitud publicada, como NGC 206).

## 1.42.0 — 18 de noviembre de 2026

- Mapa fotográfico, más nítido: el DSS llega ahora a su detalle nativo y,
  con menos de 2,4° de campo, entra el Sloan Digital Sky Survey donde lo
  cubre (algo más de un tercio del cielo, sobre todo el norte): cuatro
  veces más nítido y en color real. En Andrómeda, Orión, M33 y las Pléyades,
  donde el Sloan sale mal, se queda el DSS.
- Sin saltos de brillo al acercar o alejar: el mapa aparece poco a poco
  entre 30° y 11° de campo; al cambiar de nivel de detalle, el nuevo espera
  a estar completo y se cruza con el anterior (antes se sumaban y el cielo
  daba un destello); y bajo una imagen de agencia el mapa se atenúa.
- De cerca, la imagen general de la Vía Láctea (poco detalle: se veía a
  manchas grises) deja paso a las placas, que la traen estrella a estrella.
- La franja de M31 de la imagen de agencia ya no se coloca en el cielo (se
  veía como un parche); sigue en su ficha.

## 1.41.3 — 18 de noviembre de 2026

- Cochasquí: las pirámides ya no quedan «volando». El suelo ahora tapa lo
  que está enterrado (antes el pie hundido de cada pirámide se veía a través
  de la ladera), cada pieza se asienta sobre el mismo relieve con el que se
  dibuja el suelo, y la ladera sigue su forma bajo ellas: salen de la
  pendiente, bajas por el lado alto y altas por el bajo, como son.
- Nubes: con las nubes encendidas desaparecían los nombres (y no se podía
  elegir) de astros que seguían a la vista tras una nube fina, sobre todo de
  noche. Ahora solo la nube espesa los oculta.

## 1.41.2 — 18 de noviembre de 2026

- Cochasquí: la pirámide G con sus medidas publicadas (plataforma de
  75–78 × 58–64 m, 21 m de alto por el lado bajo, rampa ancha y eje a 33°).

## 1.41.1 — 18 de noviembre de 2026

- Cochasquí: la pirámide K con sus dos rampas pequeñas hacia el norte, y
  nueve montículos funerarios con su letra (a–g, m, x), según el plano y
  el croquis del parque.

## 1.41.0 — 18 de noviembre de 2026

- Cochasquí completo: las quince pirámides (A–P) en su sitio, con su planta
  y el largo de sus rampas, y once montículos funerarios, según el plano de
  J. Wentscher (1982, en Oberem y Wurster 1989), ajustado a la imagen
  satelital (±15 m). La E lleva las medidas de la excavación de Oberem; el
  conjunto va girado 27,6°, el eje medido de su rampa. El alto de las demás
  es estimado, y cada una lo dice. Antes había ocho, colocadas a ojo.
- El mirador del sitio se movió 40 m al oeste, a campo abierto entre las
  rampas de la G y la K.

## 1.40.0 — 18 de noviembre de 2026

- Asteroides que pasan cerca de la Tierra, en el cielo: la capa «Planetas
  enanos y asteroides» muestra también los que tienen su máximo acercamiento
  a menos de diez días de la fecha elegida (datos de NASA/JPL CNEOS, los
  mismos de la pestaña «Ahora»), con ficha: cuándo pasan, a cuántas
  distancias lunares, a qué velocidad y su tamaño estimado. Su posición es
  aproximada (vista desde el centro de la Tierra, con su órbita): tan cerca
  puede desviarse un grado o más, y la ficha lo dice.
- Servidor: `/api/asteroids` añade a cada objeto su designación y su órbita.

## 1.39.0 — 18 de noviembre de 2026

- Capa nueva «Nebulosas oscuras, supernovas y cuásares»: 25 objetos que no
  caben en los catálogos clásicos, con su nota: la Cabeza de Caballo, la
  Pipa, Casiopea A, las supernovas de Tycho, Kepler y 1987A, cuásares y
  blázares, la Cruz de Einstein, y los cúmulos de Virgo, Coma, Perseo, Bala…
- Capa nueva «Estrellas dobles y variables»: 27 estrellas y por qué cada una
  es especial: Albireo, Mizar y Alcor, la doble doble, Algol, Mira, Delta
  Cephei, Eta Carinae, T Coronae Borealis, la estrella de Barnard, Próxima…
- Las dos se encuentran con el buscador aunque estén apagadas. Posiciones
  de SIMBAD; distancias y cifras, valores publicados y redondeados.

## 1.38.1 — 18 de noviembre de 2026

- Revisión de capas, interruptor por interruptor. Corregido: la capa NGC e
  IC no aparecía hasta tocar algún interruptor; los recuadros de los campos
  profundos se veían con su capa apagada; las fotos de los objetos seguían
  a la vista con «Mapa fotográfico» apagado (ahora esa capa enciende todas
  las fotos); y los objetos sin magnitud publicada no se dibujaban.

## 1.38.0 — 18 de noviembre de 2026

- Capa nueva «NGC e IC»: 960 nebulosas, cúmulos y galaxias de esos
  catálogos que no estaban en Messier, Caldwell ni Galaxias (la Llama, la
  de la Cabeza de Caballo, planetarias, globulares…). Sus símbolos y nombres
  aparecen al acercarse a menos de 40° de campo, sobre el mapa fotográfico,
  y cada uno tiene ficha. El buscador los encuentra por número («ngc 2024»,
  «ic 434») aunque la capa esté apagada. Viene encendida. Fuente: OpenNGC.

## 1.37.0 — 18 de noviembre de 2026

- Capa nueva «Planetas enanos y asteroides»: Plutón, Ceres, Eris, Haumea,
  Makemake, Sedna, Vesta, Palas, Juno, Higía, Iris, Hebe, Psique, Eros,
  Apofis, Bennu y Ryugu, en su sitio para la fecha elegida, con distancia,
  diámetro, periodo, magnitud y una nota de cada uno. Se encuentran con el
  buscador aunque la capa esté apagada. Órbitas de JPL; las posiciones
  coinciden con Horizons a unas centésimas de grado (Bennu, cerca de 1°).
- Cometas del momento: además de los siete famosos, los que estos meses
  llegan a magnitud 14 o más brillante según JPL, mientras lo sean.

## 1.36.0 — 18 de noviembre de 2026

- Mapa fotográfico de todo el cielo: al acercarse (menos de 24° de campo) el
  firmamento se cubre con las placas reales del Digitized Sky Survey, con
  más detalle cuanto más cerca, en cualquier punto del cielo y no solo en
  los objetos con foto propia. Se carga en vivo por teselas (HiPS, vía
  ESASky), como en Stellarium; no se guarda nada en el repositorio. Capa
  nueva «Mapa fotográfico», encendida de entrada.
- Los cometas se mueven con la fecha: parten de la posición de hoy (JPL
  Horizons) y avanzan por su órbita, con su cola, su distancia y su órbita
  recalculadas. A años de distancia es una aproximación (dos cuerpos).

## 1.35.1 — 18 de noviembre de 2026

- Vía Láctea: sin el granulado que cubría todo el cielo (era el fondo del
  mapa, amplificado); fuera de la galaxia queda solo su resplandor suave.
- Fotos de objetos: Andrómeda y las demás ya no desaparecen en un cielo de
  afueras o al anochecer. A simple vista se apagan con más suavidad y, al
  acercarse (menos de 25° de campo), suben de brillo como por un telescopio.

## 1.35.0 — 18 de noviembre de 2026

- Cometas como cometas: con la capa encendida, los que están a menos de 4 UA
  del Sol llevan coma y dos colas (gas, azulada; polvo, amarillenta) que
  apuntan en sentido contrario al Sol. La dirección es real; el largo y el
  brillo de la cola son una estimación a partir de su distancia al Sol y de
  su magnitud total.
- Al abrir un cometa se dibuja su órbita en el cielo, vista desde la Tierra
  de ese momento (elementos orbitales de JPL SBDB).

## 1.34.0 — 18 de noviembre de 2026

- Imágenes del Hubble, del Webb y de ESO en el cielo: 41 fotos de las que ya
  usan las fichas aparecen al acercarse a su objeto, en su sitio, a su tamaño
  y giradas como corresponde, con el centro, el campo y la orientación que
  publica la página de cada imagen (Orión, el Sombrero, el Anillo, los
  Pilares, Omega Centauri…). Se descargan solo al acercarse.
- Campos profundos: el Ultraprofundo del Hubble y el primer campo profundo
  del Webb muestran su foto dentro del recuadro, con sus miles de galaxias.
- Fichas: la de Andrómeda muestra primero la galaxia entera (antes, una
  franja del mosaico del Hubble), y las de agujeros negros avisan de que la
  imagen es de referencia (la galaxia o región donde están).

## 1.33.0 — 18 de noviembre de 2026

- Fotos reales en el cielo: 19 galaxias, nebulosas y cúmulos (Andrómeda,
  Orión, M13, M51, M81, M82, el Sombrero, M101, M87, el Anillo, el Cangrejo,
  Carina…) se ven en su sitio, a su tamaño y con su orientación reales, también
  al apuntar con el teléfono. Son recortes de los cartografiados SDSS (luz
  visible, CC BY) y 2MASS (infrarrojo cercano, dominio público); con la
  atmósfera encendida se apagan con el brillo del cielo, como la Vía Láctea.
- Nueva capa «Campos profundos»: el Campo Profundo y el Ultraprofundo del
  Hubble, el Campo Profundo Sur, el primer campo profundo del Webb, COSMOS y
  la Franja de Groth, con su recuadro a tamaño real y su explicación.

## 1.32.0 — 18 de noviembre de 2026

- Cochasquí: ocho de las quince pirámides truncas, cubiertas de hierba como
  están hoy, con su rampa hacia el suroeste y asentadas en la ladera. Posición
  (±10 m), alto y largo de las rampas son aproximados; faltan las otras siete
  y los montículos funerarios.
- Corregido: en sitios en ladera, un monumento cercano y más alto podía
  levantar el suelo dibujado por encima de los ojos del observador.

## 1.31.0 — 18 de noviembre de 2026

- Machu Picchu, primera versión de la ciudadela vista desde la cima del
  Intihuatana: el Templo de las Tres Ventanas y el Templo Principal en la
  Plaza Sagrada, el Torreón y filas de casas de piedra sin techo en el sector
  urbano, todo más abajo que la cima. Las posiciones son aproximadas (±10 m)
  y las casas son una representación, no el plano real; así lo dice cada
  rótulo.
- Cochasquí sigue sin pirámides: en la ladera aún no asientan bien.

## 1.30.1 — 18 de noviembre de 2026

- Vía Láctea: corregido su brillo con Luna. Con la Luna en el cielo se veía
  menos en un sitio oscuro que en uno con luces; ahora cuenta el brillo total
  del cielo y un sitio más oscuro nunca la muestra menos. Además se apaga
  hacia el horizonte, como las estrellas.
- La Luna, de cerca: se dibuja como esfera a alta resolución (antes era el
  mapa plano recortado en un lienzo pequeño y se veía pixelada), con el
  terminador suave y la textura al doble de resolución.

## 1.30.0 — 18 de noviembre de 2026

- El Sol real: en el cielo, el Sol es la imagen en luz visible del Solar
  Dynamics Observatory de la NASA de ese momento, con sus manchas (una cada
  15 minutos, desde mayo de 2010) y girado según su eje. Al acercarse se ven
  las manchas. Para fechas futuras o anteriores a 2010 queda el Sol genérico.
- Chankillo: las torres ya no parecen flotar (el suelo llega a su pie, con
  una malla más fina sobre la cresta) y su mampostería se ve más clara.
- Tiwanaku: el punto de vista y la estela Ponce quedan en el eje de
  Kalasasaya; la portada enmarca la estela y el Sol de los equinoccios se
  pone detrás.
- Sitios: cada uno enlaza su página de Wikipedia desde el panel «Lugar», y
  Chankillo explica cómo usar las torres como calendario.

## 1.29.0 — 18 de noviembre de 2026

- La Vía Láctea se ve en el cielo: su resplandor, las nubes de polvo y las
  Nubes de Magallanes, detrás de las estrellas (mapa «Deep Star Maps 2020» de
  la NASA, dominio público). Sigue la oscuridad del cielo: entera en un sitio
  oscuro, tenue en las afueras, nada en una ciudad, de día o con Luna llena.
- Corregido: los puntos negros del cielo. Eran estrellas que la atmósfera
  apaga (crepúsculo, ciudad) y que oscurecían el fondo en vez de no dibujarse.
- Planetas:
  - Texturas del Sol, Venus, la Tierra, Marte, Júpiter, Saturno, Urano y
    Neptuno al doble de resolución, y marcadores más nítidos.
  - Marte, Júpiter, Saturno, Urano y Neptuno llevan su orientación real (eje,
    achatamiento, inclinación de los anillos) a cualquier zoom. Antes, de
    lejos, Saturno era un dibujo con los anillos siempre abiertos.
  - Al acercarse ya no hay salto: el planeta encoge poco a poco hasta que su
    tamaño real lo alcanza.
  - El zoom máximo es unas tres veces mayor.
- Reloj solar Quitsato: si uno se coloca dentro del poste, no se dibuja.

## 1.28.0 — 18 de noviembre de 2026

- Monumentos en seis sitios más de «Mi cielo», con sus medidas reales:
  - Chankillo: las Trece Torres sobre su cresta, vistas desde el punto de
    observación oeste. El Sol de diciembre sale por la torre 13 y el de junio
    junto a la torre 1, como describen Ghezzi y Ruggles (2007).
  - Reloj solar Quitsato: la plataforma de 54 m con su mosaico y el poste de
    10 m, que proyecta su sombra a la hora real.
  - Catequilla: el muro semicircular de 68 m de diámetro y el disco lítico.
  - Paranal: los cuatro telescopios de 8,2 m del VLT.
  - Tiwanaku: Akapana, Kalasasaya, la Puerta del Sol y la estela Ponce.
  - Machu Picchu: el Intihuatana (forma simplificada).
- Esos sitios pasan a ser un punto de vista frente al monumento (Chankillo,
  Quitsato, Tiwanaku, Paranal y Machu Picchu cambian unos metros de lugar).
- En Chankillo el suelo cercano sigue el relieve: la cresta cae por detrás de
  las torres y estas quedan contra el cielo.
- Lo pequeño ya no se dibuja de lejos, y las cumbres que quedan bajo el suelo
  no se nombran.
- Cochasquí queda pendiente: hace falta un plano con la posición de cada
  pirámide.

## 1.27.0 — 18 de noviembre de 2026

- Monumentos más reales en «Mi cielo» (Teotihuacan, Chichén Itzá, Guiza,
  Stonehenge y Newgrange): texturas fotográficas de piedra, arena, tierra y
  pasto con relieve (Poly Haven y ambientCG, CC0) en lugar de los patrones
  dibujados.
- Luz: sombras suaves y más nítidas, luz del cielo según la hora, bruma con
  la distancia y de noche los monumentos quedan en penumbra, no en negro.
- Formas: escalinatas con peldaños de verdad, hiladas escalonadas en Guiza y
  el resto del revestimiento en la cima de Kefrén, piedras redondeadas e
  irregulares en Stonehenge (con las caídas), y entrada y muro de cuarzo en
  Newgrange.
- Suelo continuo alrededor del observador, que sigue el relieve y se funde
  con el horizonte.
- Los nombres de constelaciones y de montañas ya no se dibujan encima de un
  monumento ni del suelo.
- El panel de sitios dice ahora en cuáles se dibuja también el monumento.

## 1.26.0 — 18 de noviembre de 2026

- Licencia: Teseo pasa de MIT a AGPL-3.0 o posterior (LICENSE, NOTICE).
  Sigue siendo software libre, pero quien publique una versión modificada,
  también como sitio web, debe compartir su código con la misma licencia.
  Los nombres «Teseo» y «Yachay Deep» quedan fuera de la licencia.
- Créditos de la app: enlace al código fuente en GitHub (sección 13 de la
  AGPL).
- README, CREDITS, la landing (es/en), los datos estructurados y llms.txt
  dicen ahora AGPL-3.0.

## 1.25.2 — 18 de noviembre de 2026

- GitHub Sponsors activo (github.com/sponsors/cvasconezp). La landing, en
  español e inglés, cambia «pronto» por el botón «Patrocinar en GitHub».
  El botón «Sponsor» del repositorio y llms.txt también lo enlazan.

## 1.25.1 — 18 de noviembre de 2026

- SEO: /acerca, /about, sus videos y audio, llms.txt y el archivo de
  verificación de Google ya no llevan la cabecera «X-Robots-Tag: noindex».
  La regla que la pone a toda ruta distinta de «/» las incluía, y Google
  rechazaba indexarlas. Las rutas inventadas siguen con noindex.
- Landing: el botón de idioma muestra solo «EN» o «ES».

## 1.25.0 — 18 de noviembre de 2026

- «About Teseo»: la landing en inglés, en teseo.yachaydeep.com/about.
  - Se genera desde /acerca con scripts/build_about_en.py, que falla si
    alguna frase queda sin traducir; la prueba test_landing.mjs comprueba
    que las dos versiones estén sincronizadas.
  - Selector «English | Español» en la barra. Elegir una versión fija
    también el idioma de la app.
  - Si el navegador está en el otro idioma, un aviso discreto ofrece la otra
    versión, sin redirigir.
  - Videos y podcast marcados como «narrated in Spanish».
  - La app enlaza a /about cuando está en inglés.
- SEO:
  - Las dos versiones de la landing se declaran equivalentes (hreflang) en
    las páginas y en el sitemap.
  - El sitemap incluye los ocho videos (título, miniatura, duración).
  - Datos estructurados de los videos y del podcast en /acerca.
  - Metadatos completos para compartir en redes.
  - Nuevo llms.txt, que describe Teseo para los buscadores con IA.
  - Enlaces a /acerca y /about en la portada estática de la app.
- Analítica sin cookies (Vercel) también en las landings.

## 1.24.2 — 18 de noviembre de 2026

- Landing /acerca: botón «Apoya» junto a «Abrir Teseo» en la barra
  superior, visible también en el teléfono; lleva a la sección de donaciones.

## 1.24.1 — 18 de noviembre de 2026

- «Acerca de» más a la vista: botón dorado en la cabecera (en el teléfono,
  solo el ícono ⓘ) y primera opción, destacada, del menú ☰ del Cielo.
- En el teléfono, el selector de idioma de la cabecera muestra solo el
  idioma activo; al tocarlo cambia al otro.
- Landing /acerca:
  - «Teseo en un minuto» y siete videos explicativos (estrellas, vida de
    una estrella, ventanas a Marte, lunas de Júpiter, tu horizonte, ¿estamos
    solos?, el final del universo). Se quitó el video con el laberinto.
  - El podcast se escucha en la misma página (15 min).
  - «Instalar en el teléfono» abre una ventana con el video de instalación.
  - Formulario de PayPal legible (texto oscuro sobre fondo blanco).
  - La sección de las cuatro pestañas se llama «Cuatro maneras de explorar
    el universo».

## 1.24.0 — 18 de noviembre de 2026

- Nueva página «Acerca de Teseo» en teseo.yachaydeep.com/acerca: qué es la
  app, sus cuatro secciones, la ciencia de Preguntas (espectro, masa,
  agujeros negros, catapultas), cómo sabe que lo que dice es cierto, videos,
  el podcast (generado con NotebookLM), los talleres de Killa Ñan y cómo
  apoyar el proyecto (PayPal; GitHub Sponsors, pronto). El botón de PayPal
  se carga solo al pulsarlo. Se enlaza desde el pie, Créditos y el menú del
  teléfono.
- Licencia MIT en el repositorio (LICENSE).
- Lugares destacados: «Catequilla · cima», con las coordenadas GNSS de
  Cobo (2012). El buscador general ubicaba «Catequillá» a 1,9 km de la cima,
  y desde ahí Quitsato caía a 93,7° en vez de 90°.
- Service worker (caché teseo-v4): solo guarda como app la página principal;
  /acerca y el calendario .ics ya no pueden ocupar su lugar sin conexión.

## 1.23.0 — 18 de noviembre de 2026

- Cielo → Capas → Montañas → «Astronomía andina» (apagada por defecto):
  - Marca sobre tu horizonte real por dónde sale y se pone el Sol en los
    solsticios y equinoccios, en cualquier lugar del mundo, con su acimut.
  - Cerca de Quito rotula los sitios quitu-caranquis: los 14 discos líticos
    y el vértice de Catequilla con las coordenadas GNSS del libro de
    Cristóbal Cobo (2012), más Cochasquí, Pambamarca y el Reloj Solar
    Quitsato. Los que tapa el relieve se marcan así.
  - Desde Catequilla, en el solsticio de junio, el Sol asoma junto a
    Cochasquí; en el de diciembre, sobre el macizo de Pambamarca.
  - El panel cita el libro y advierte que una alineación no prueba
    intención. La referencia también va en la foto 360° y en los créditos.
- Ficha del Sol (y de cualquier astro): cuando las horas de salida, paso y
  puesta son de otro día, el día va delante («Mañana, jue 19: sale 05:55 ·
  …»). Antes iba al final y parecía ser solo de la puesta.

## 1.22.0 — 18 de noviembre de 2026

- «Suscribirme al calendario» en el Calendario del cielo: el calendario de tu
  lugar entra en Google Calendar, el Calendario del iPhone, iPad o Mac, u
  Outlook, y se actualiza solo. Trae un año de Luna, eclipses, meteoros,
  planetas, estaciones e hitos del espacio, más las pasadas visibles de la ISS
  y los lanzamientos de las próximas semanas, con «Ver en el cielo» y la
  fuente en cada evento, y avisos solo para lo que no se repite cada semana.
- Lo calcula el mismo código de la app, en una función de Vercel
  (teseo.yachaydeep.com/cal/teseo.ics). El enlace lleva el lugar redondeado
  a ~1 km y no se guarda nada.

## 1.21.1 — 18 de noviembre de 2026

- Los hitos del espacio también se comparten: la postal lleva el concepto
  artístico de la nave (NASA/JPL-Caltech, rotulado como ilustración), cuándo
  fue o cuánto falta, la distancia a la Tierra y lo que tarda una señal de
  radio (24 h en el caso del día-luz), con la NASA como fuente.

## 1.21.0 — 18 de noviembre de 2026

- Calendario del cielo: nueva categoría «Hitos del espacio», con fecha, hora y
  fuente de la NASA en cada uno. Empieza con la Voyager 1 llegando a 1 día-luz
  de la Tierra (hoy, 05:16 hora de Ecuador: 25 900 millones de km) y los
  50 años del lanzamiento de las Voyager 2 y 1 (agosto y septiembre de 2027).
  «Ver en el cielo» abre la nave en el Cielo, con lo que tarda su señal.
- Cada evento muestra cuánto falta («En 33 días», «En 5 h 12 min», «Mañana»),
  resaltado cuando falta menos de un día, y se actualiza solo.
- La agenda empieza al comienzo de hoy: lo que ya ocurrió hoy se sigue viendo,
  marcado «Hoy · ya ocurrió».
- «Lo próximo»: arriba de la agenda, una cuenta regresiva en días, horas,
  minutos y segundos al siguiente evento importante (solsticio o equinoccio,
  eclipse, hito del espacio o una gran lluvia de meteoros), aunque esté más
  allá de los 30 días de la lista.

## 1.20.2 — 18 de noviembre de 2026

- Control de tiempo más compacto, con todos sus controles: flechas y cifras
  algo menores, «Noche anterior / Ahora / Noche siguiente» con el icono al lado
  del texto y una franja día/noche más fina. Ocupa unos 100 px menos (en el
  teléfono pasa de casi la mitad de la pantalla a un tercio).
- El aviso «Es de día», una vez cerrado, ya no vuelve a aparecer: ni al mover
  la hora o el día, ni en la siguiente visita.

## 1.20.1 — 18 de noviembre de 2026

- Cabecera más compacta en el ordenador: marca, pestañas y botones (música,
  visión nocturna e idioma) van en una sola barra fija de unos 60 px, en lugar
  de dos bloques que ocupaban unos 190 px. Las pestañas pasan a píldoras al
  centro y «con Killa Ñan» sigue visible junto al subtítulo. En pantallas
  medianas (tabletas, ventanas estrechas) la marca va en una sola línea sobre
  pestañas más finas; en el teléfono no cambia nada.

## 1.20.0 — 17 de noviembre de 2026

- «Atrás» en el teléfono (gesto o botón): primero cierra lo que esté abierto
  (el menú, una ficha, un panel, el control de tiempo, la postal, la foto 360°
  o el modo apuntar). Sin nada abierto aparece «Pulsa de nuevo para salir» y
  solo un segundo atrás en 2 segundos sale de la app. En un ordenador, atrás
  sigue funcionando como siempre.
- Créditos siempre visibles en el Cielo: «Teseo · teseo.yachaydeep.com» y las
  fuentes de los datos que se ven (estrellas, constelaciones y, si están,
  relieve, montañas, nubes y planetas), pequeños y discretos (en el teléfono
  bajo el buscador; en el ordenador abajo a la izquierda). Así cualquier captura
  de pantalla los lleva: una página web no puede detectar las capturas.

## 1.19.1 — 17 de noviembre de 2026

- Capa «Constelaciones» en Capas → Nuestro vecindario: enciende o apaga juntas
  las líneas y los nombres de las 88 constelaciones. Viene encendida y la
  elección se recuerda. Apagada, el cielo queda solo con las estrellas y sus
  nombres (también en la postal y en la foto 360°); si se elige una
  constelación para verla en 3D, sus líneas se siguen mostrando.

## 1.19.0 — 17 de noviembre de 2026

- Foto 360°: en Mi cielo, el menú «…» tiene «Foto 360°». Guarda el cielo del
  lugar, la fecha y la hora elegidos, con las capas encendidas (montañas,
  nubes, atmósfera, monumentos, planetas, líneas y nombres), en una imagen
  equirectangular de 4096 × 2048 (2048 × 1024 en equipos con poca memoria).
  Lleva los metadatos 360° (XMP «GPano»), así que Google Fotos, Facebook y los
  visores 360° la abren para mirar alrededor; abre hacia donde estabas mirando.
- En el suelo, bajo el observador, un sello con Teseo, la web, el lugar, la
  fecha y los créditos de los datos que aparecen en la foto (estrellas,
  constelaciones y, si están, relieve, nombres de montañas, nubes y planetas).
  Los mismos créditos van dentro del archivo (autor y derechos en el XMP).

## 1.18.3 — 17 de noviembre de 2026

- Apuntar al cielo: al arrastrar con el dedo y volver a apuntar, los puntos
  cardinales ya no se desconfiguran (el este aparecía en el norte real). En
  Android llegan dos señales de orientación, una con brújula y otra relativa
  con su cero arbitrario; si la de brújula se cortaba, se usaba la relativa
  tal cual. Ahora se aprende la diferencia entre ambas y la relativa se
  convierte al norte verdadero.
- Cada vez que se empieza a apuntar, y al volver a la app, se olvidan los
  ajustes de brújula anteriores (en iPhone podían quedar viejos). Si el norte
  pasa de alineado a mano a venir de la brújula, la alineación manual se borra.

## 1.18.2 — 17 de noviembre de 2026

- El paisaje sigue la luz del Sol según las montañas: cuando el Sol se esconde
  tras el horizonte de montañas del lugar, el valle y las lomas cercanas pasan a
  la sombra (más oscuros y azulados, solo con la luz del cielo), aunque el Sol
  siga sobre el horizonte astronómico.
- Arrebol: con el Sol rasante, las cumbres altas que todavía lo ven se encienden
  de anaranjado y la nieve de rosa; se apagan unos minutos después que el valle
  (y se encienden antes al amanecer), según su altura y la curvatura de la
  Tierra. Desde Cayambe, el volcán sigue rosado hasta que el Sol baja unos 1,7°.

## 1.18.1 — 17 de noviembre de 2026

- La hora del Cielo es ahora la del lugar que miras, no la de tu teléfono: si
  estás en Ecuador y eliges Nagarkot, el reloj marca la hora de Nepal, con el
  rótulo «Hora de Nagarkot · UTC+5:45». Las flechas, «Noche anterior/siguiente»,
  la barra del día (día, crepúsculos y noche), las horas de salida y puesta,
  «Esta noche», los pases de la ISS y la postal usan esa misma hora. La zona se
  obtiene de Open-Meteo y se guarda; sin conexión, sigue la del teléfono.

## 1.18.0 — 17 de noviembre de 2026

- La pantalla principal es ahora el Cielo: después de la animación de entrada
  (en el teléfono y en el ordenador) se abre el Cielo. Ruta tiene su propio
  enlace (#ruta), y los enlaces antiguos (#ventanas) siguen llevando a Ruta.
- La primera vez, lo primero que se pide es la ubicación: «¿Desde dónde miras
  el cielo?», con «Usar mi ubicación», el buscador de lugares y los sitios
  astronómicos. «Ahora no» sigue con Quito. No se vuelve a preguntar, y no
  aparece a quien ya eligió un lugar o llega con un enlace a una vista.

## 1.17.1 — 17 de noviembre de 2026

- En el ordenador, el Cielo se usa igual que en el teléfono: la columna de la
  derecha (Tiempo, Lugar, Capas, Tour) en lugar de la barra de abajo, las
  herramientas (acercar, alejar, centrar, postal, pantalla completa,
  información) en el menú «…», y el mismo control de tiempo tipo Stellarium.

## 1.17.0 — 17 de noviembre de 2026

- Cielo a pantalla completa en el teléfono: la cabecera (Teseo, música, visión
  nocturna, idioma) y las pestañas pasan a un menú ☰ arriba a la izquierda de
  la vista, que se abre como un panel lateral con las secciones (Ruta, Ahora,
  Cielo, Preguntas) y esas opciones. En el ordenador no cambia nada.

## 1.16.1 — 17 de noviembre de 2026

- En el teléfono, al mirar el cielo arrastrando, la misma columna de la derecha
  que al apuntar (Tiempo, Lugar, Capas y Tour) en lugar de la barra de abajo;
  «Tiempo» abre el control tipo Stellarium. «Lugar» se pinta de azul con un
  lugar en Mi cielo y «Tiempo» de dorado si la hora no es la de ahora.
- El menú «…» ya no se monta sobre la columna: al abrirlo, la columna (y el
  control de tiempo) se apartan.

## 1.16.0 — 17 de noviembre de 2026

- Modo apuntar: a la derecha, una columna con Tiempo, Lugar, Capas y Buscar,
  siempre a mano mientras se apunta al cielo.
- Nuevo control de tiempo, al estilo de Stellarium: la fecha y la hora con
  flechas para subir o bajar cada campo (manteniendo pulsado, sigue), la
  velocidad del tiempo (de −1 día a +1 día por segundo, con pausa y tiempo
  real), «Ahora», noche anterior y siguiente, y una barra de 24 horas con el
  día, los crepúsculos y la noche de tu lugar para arrastrar la hora.
- La ayuda para alinear el norte ya no aparece sola al empezar; queda en «…»
  y solo se explica cuando el teléfono no tiene brújula.
- Las texturas de los monumentos y del suelo ya no muestran costuras entre
  teselas.

## 1.15.0 — 17 de noviembre de 2026

- Monumentos más realistas: texturas de piedra con relieve, generadas en el
  propio teléfono (las hiladas de caliza de Guiza y el revestimiento que
  conserva Kefrén arriba, la piedra volcánica de Teotihuacan, los sillares
  claros de Chichén Itzá, la arenisca con líquenes de Stonehenge, el cuarzo de
  Newgrange), luz del Sol del momento con su color (dorada al amanecer y al
  atardecer), luz del cielo y sombras: cada cuerpo de la pirámide sombrea al de
  abajo y al suelo que la rodea, que también se dibuja (tierra, arena o
  hierba) hasta tus pies. Escalinatas con sus escalones y alfardas (cuatro en El
  Castillo, con su templo y sus puertas), piedras de Stonehenge talladas a mano
  en vez de cajas. De noche, silueta apenas iluminada por el cielo.
- Los monumentos tapan al Sol y a la Luna cuando pasan por detrás (el amanecer
  del solsticio entre las piedras de Stonehenge).

## 1.14.0 — 17 de noviembre de 2026

- Cielo: monumentos. Nuevo interruptor «Monumentos» dentro de «Montañas»
  (encendido por defecto). En Teotihuacan (pirámides del Sol y de la Luna),
  Chichén Itzá (El Castillo), Guiza (Keops, Kefrén y Micerino), Stonehenge y
  Newgrange, el cielo dibuja el monumento en 3D, con su alto y su base reales,
  en su sitio exacto, asentado sobre el suelo del modelo de relieve y con la luz
  del Sol de ese momento. La forma es simplificada (sin escaleras ni templos
  menores; Stonehenge con las piedras que siguen en pie). Lo que queda detrás
  de una pirámide no se ve, y cada monumento lleva su nombre y su altura.
- Los sitios de Teotihuacan, Chichén Itzá, Guiza y Newgrange son ahora un
  punto de vista frente al monumento (la Calzada de los Muertos, la Gran
  Plaza, el mirador del suroeste, la entrada de la tumba); Stonehenge, el
  centro del círculo, mirando al eje del solsticio.
- Los nombres de las constelaciones ya no se pintan encima de una montaña o
  de un monumento.
- Servidor: /api/elevation, la altura del terreno en puntos sueltos.

## 1.13.3 — 17 de noviembre de 2026

- Nombres de las montañas: Wikidata exige que la aplicación se identifique; el
  servidor ahora lo hace (y reintenta una vez si le piden calma). A
  OpenStreetMap se le espera menos, así que los nombres llegan antes.

## 1.13.2 — 17 de noviembre de 2026

- Nombres de las montañas: los servidores públicos de OpenStreetMap no daban
  abasto (fallaban o tardaban más de un minuto). Ahora los nombres vienen
  también de Wikidata, que responde en segundos y trae el nombre en español y
  en inglés; OpenStreetMap se suma si contesta a tiempo. La misma cumbre en las
  dos fuentes cuenta una vez.

## 1.13.1 — 17 de noviembre de 2026

- «Mi cielo»: fuera la lista fija «O elige un lugar» (Quito, Cayambe, Guayaquil,
  Cuenca); el buscador de lugares del mundo y los sitios astronómicos la
  sustituyen.
- Nombres de las montañas: consulta a OpenStreetMap más ligera (sin filtros
  costosos en el servidor de mapas), un cuarto servidor de respaldo y más
  paciencia con los que van cargados.

## 1.13.0 — 17 de noviembre de 2026

- Postal «tal como lo ves»: sin un objeto abierto, la postal del cielo ya no es
  una carta dibujada aparte, sino la propia vista en ese momento, con las capas
  que tengas activas (atmósfera, nubes, montañas, nombres de montañas, líneas,
  puntos cardinales). En el teléfono ocupa toda la postal; desde un ordenador
  (vista apaisada) llena al menos la mitad del alto y prolonga el cielo y el
  suelo. El pie cita las fuentes de lo que se ve (relieve, OpenStreetMap,
  nubes). Las postales de un objeto o una constelación siguen como antes.

## 1.12.1 — 17 de noviembre de 2026

- Nombres de las montañas más rápidos y fiables: el servidor pregunta a los tres
  servidores de OpenStreetMap a la vez (antes uno tras otro, hasta un minuto) y
  con una consulta más ligera; el teléfono guarda los nombres de los últimos
  lugares; si fallan, botón «Reintentar». Dos nombres para la misma mole (a
  menos de 1°) ya no salen juntos.
- Capas: el interruptor «Nombres de las montañas» ocupaba muchas filas (el texto
  caía en una columna estrecha); ahora son dos.

## 1.12.0 — 17 de noviembre de 2026

- Cielo: nombres de las montañas. Nuevo interruptor «Nombres de las montañas»
  dentro de «Montañas» (apagado por defecto): sobre cada cumbre que se ve en tu
  horizonte, su nombre y su altura, con un palito que baja hasta el punto exacto
  de la silueta. Los nombres vienen de OpenStreetMap y solo se pone el de una
  cumbre que forma la silueta (la que queda tapada por un cerro más cercano no
  se nombra). Caben más o menos según el zoom y la densidad de nombres.
- Montañas mejor dibujadas: una montaña que cruzaba el límite entre dos capas
  de distancia salía dos veces (el Cusín desde Cayambe, por ejemplo); ahora ese
  corte se pinta con el color de la capa de atrás y sin línea, y la montaña se
  ve una sola vez. Se quitaron las franjas verticales del sombreado y el borde
  de la nieve ya no es una recta: sube y baja como el de un glaciar.

## 1.11.0 — 17 de noviembre de 2026

- Cielo: montañas con más detalle. El perfil del horizonte se calcula cada 0,2°
  (antes 0,5°), en seis capas de distancia y con celdas de unos 220 m, así que
  dos lugares cercanos ya no comparten silueta. La nieve se pinta solo por
  encima de su altura real en cada cumbre (sin franjas verticales ni columnas
  blancas), las laderas se sombrean según el Sol y cada sierra lleva su línea de
  cresta. Las respuestas del servidor viajan comprimidas.
- «Mi cielo»: buscador de lugares del mundo (ciudades, pueblos, montañas) en
  «O elige un lugar», y una lista de sitios arqueológicos y astronómicos con su
  nota: Machu Picchu, Chankillo, Cochasquí, Quitsato, Tiwanaku, Teotihuacan,
  Chichén Itzá, Paranal, Stonehenge, Newgrange y Giza. Desde cada uno se ve el
  cielo con las montañas reales de su horizonte.
- Fichas: la foto y el texto de Wikipedia tienen que tratar del astro. «Mimosa»
  ya no muestra la planta, ni «Atlas», «Electra» o «Maia» al personaje: primero
  se busca «X (estrella)» y se descarta cualquier artículo que no hable de una
  estrella (y lo mismo en galaxias, púlsares, exoplanetas y lluvias de
  meteoros). Tampoco se usan como foto curvas de luz, espectros ni gráficas;
  sin una imagen del objeto, la ficha dibuja una estrella.

## 1.10.0 — 17 de noviembre de 2026

- Cielo: las montañas de tu horizonte real. Para el lugar de «Mi cielo», el
  servidor calcula con el relieve (AWS Terrain Tiles: SRTM de la NASA y otros
  modelos) qué ángulo tapa el terreno en cada dirección, hasta 150 km, con la
  curvatura de la Tierra y la refracción, desde la altura del propio lugar. El
  cielo dibuja las sierras en capas (las lejanas más claras, nieve en las
  cumbres altas de día, siluetas de noche) y lo que queda detrás de una montaña
  (estrellas, planetas, el Sol, la Luna, líneas y nombres) se oculta. Funciona en
  cualquier lugar del mundo, sin fotos ni permisos; interruptor «Montañas» en
  Capas, encendido por defecto. No incluye árboles ni edificios.
- Ficha de cada astro: además de su salida y su puesta para un horizonte plano,
  cuándo asoma y cuándo se esconde tras las montañas de tu lugar (en Quito, el
  Sol se esconde tras el Pichincha media hora antes de su puesta), y si ahora
  mismo está detrás de ellas.

## 1.9.0 — 17 de noviembre de 2026

- Cielo: nubes reales del pronóstico. Con la Atmósfera encendida, el interruptor
  «Nubes» (en Capas, apagado por defecto) dibuja tres capas de nubes (bajas,
  medias y altas) con la nubosidad que pronostica Open-Meteo para tu lugar y la
  hora del cielo, desde hace 2 días hasta dentro de 7. Se mueven con el viento
  de su altura al cambiar la hora y toman la luz del día, del atardecer, de la
  Luna o de la ciudad (anaranjadas en un cielo urbano, casi negras en uno
  oscuro). Tapan estrellas, planetas, la Luna y el Sol, y lo que queda detrás de
  una nube pierde su nombre y sale del recuento de estrellas visibles. La
  cantidad y la altura son las del pronóstico; la forma es ilustrativa.
- Panel «Nubes y clima»: nubosidad a la hora del cielo y por capas, probabilidad
  de lluvia, cuándo despeja o se nubla, la mejor hora para observar esa noche y
  la nubosidad de las próximas 24 horas.
- Las nubes desde el satélite: un globo centrado en tu lugar y una vista de tu
  zona con la última imagen. En las Américas, GOES-19 y GOES-18 (GeoColor, NASA
  GIBS); en Europa, África y Oriente Medio, Meteosat-12 (GeoColour, EUMETSAT);
  en el resto, la pasada diaria del NOAA-20 (VIIRS).

## 1.8.2 — 17 de noviembre de 2026

- Nueva animación de entrada: después de la Vía Láctea, en lugar del laberinto,
  el viaje real de la sonda Cassini (1997–2004). Un hilo dorado recorre su
  trayectoria (JPL Horizons) y cada catapulta gravitacional se enciende cuando
  la sonda pasa junto al planeta, dibujado donde estaba ese día: Venus, Venus,
  Tierra y Júpiter, hasta llegar a Saturno. Cierra con «El universo es un
  laberinto. / Teseo es tu hilo.» y el logotipo. Dura 11 segundos.

## 1.8.1 — 17 de noviembre de 2026

- Nueva música ambiental: la misma de los videos de Teseo. Un colchón de acordes
  (la menor con novena, fa mayor con séptima, do mayor y sol mayor, uno cada 8
  segundos), un bajo y un arpegio suave a 72 pulsos por minuto. Se sigue
  generando en el navegador, sin archivos de audio, y empieza apagada.

## 1.8.0 — 16 de noviembre de 2026

- Cielo: el zoom llega hasta 0,2° (antes 5°). Con mucho zoom se ven las lunas
  junto a su planeta, con su nombre, y se pueden tocar; Marte, Júpiter, Saturno,
  Urano y Neptuno pasan a dibujarse a su tamaño real, con su textura, achatados,
  con el eje girado como se ve en el cielo y Saturno con sus anillos abiertos lo
  que toca esa fecha (comprobado con JPL Horizons). Al abrir una luna, el cielo
  se acerca hasta verla junto a su planeta.
- «Así se ve hoy» realista: el planeta con su textura y orientación real, las
  lunas como puntos de luz a su escala (y su globo al acercarse), zoom con
  pellizco, rueda o botones, arrastre, barra de escala y órbitas a pedido.

## 1.7.0 — 16 de noviembre de 2026

- Lunas de otros planetas: 19 lunas de Marte, Júpiter, Saturno, Urano y Neptuno
  en el buscador del Cielo («Ío», «Titán», «lunas de Júpiter», «galileanos»).
  Su ficha muestra dónde está hoy respecto a su planeta (órbitas ajustadas a
  JPL Horizons, con el tiempo de la luz), si pasa por delante o queda escondida,
  con qué se ve, y un globo 3D con los mosaicos globales del USGS hechos con
  imágenes de Viking, Galileo, Voyager y Cassini. La ficha de cada planeta
  muestra «Sus lunas hoy».

## 1.6.0 — 16 de noviembre de 2026

- Nueva pregunta, la décima: «¿Cómo terminará el universo?». Una caja de gas
  para ver por qué el tiempo avanza, los fotones que la Tierra devuelve al
  espacio, la entropía de los agujeros negros, las eras del futuro hasta
  10¹⁰⁰ años y los finales posibles según la energía oscura (congelación,
  Gran Desgarro, Gran Colapso y cambio de vacío), cada dato con su fuente y
  su grado de certeza.

## 1.5.1 — 16 de noviembre de 2026

- Postal de estrellas más sintética: subtítulo «tipo · clase · magnitud», una sola
  casilla de distancia y los bloques «Su luz» y «Su vida» sin tarjetas.
- El Sol en la postal es la foto de hoy de NASA/SDO (HMI), con sus manchas reales.
- Las imágenes de Wikipedia que son mapas de constelación ya no se usan como foto.

## 1.5.0 — 16 de noviembre de 2026

- Imagen para compartir: distancia y «su luz salió hace…» en una sola casilla;
  en las estrellas y el Sol, espectro esquemático y «Vida y final» con la marca
  HOY. «Desde tu ubicación» en minúscula.

## 1.4.1 — 16 de noviembre de 2026

- (1.4.2) Brazos más nítidos y ordenados: estrellas repartidas a lo largo de cada brazo,
  más brillo en su eje y menos dispersión.

- Entrada: la Vía Láctea ahora se parece a la nuestra — espiral barrada con
  barra central, dos brazos principales (Escudo-Centauro y Perseo), dos menores
  (Norma y Sagitario) y el brazo de Orión, donde se marca el Sol.

## 1.4.0 — 16 de noviembre de 2026

- Música ambiental: botón ♪ en la cabecera para activarla o apagarla. Se genera
  en el propio navegador (Web Audio): un bordón grave que respira y campanas
  suaves de la escala pentatónica con reverberación, sin archivos ni licencias.
  Empieza apagada, recuerda la preferencia (vuelve con el primer toque) y se
  pausa al cambiar de pestaña o bloquear el teléfono.

## 1.3.1 — 16 de noviembre de 2026

- Entrada más fluida en teléfonos: el giro de la Vía Láctea va en una capa que
  compone la GPU, el brillo del hilo ya no usa filtros que se repintan en cada
  cuadro y la galaxia tiene menos puntos (700).

## 1.3.0 — 16 de noviembre de 2026

- Nueva animación de entrada: «Estás aquí» → tu sistema solar con los planetas
  donde están hoy → la Vía Láctea (y dónde está el Sol) → el laberinto del
  universo y el hilo de Ariadna que llega al centro → «Teseo». Eslogan: «El
  universo es un laberinto. Teseo es tu hilo.» Todo en CSS y SVG; se salta
  tocando, con «Saltar» o con Esc, y no aparece con «reducir movimiento».

## 1.2.1 — 16 de noviembre de 2026

- Las métricas de uso dejan de mostrarse al público dentro de Teseo: se quitan
  «Uso de Teseo» del pie y del menú del Cielo. Quedan en un panel de
  administración (#admin) protegido con la clave de métricas del servidor
  (/api/metrics/admin).
- /api/metrics/public se reduce a las cifras que muestra la landing de
  yachaydeep.com: visitas, páginas vistas e imágenes creadas.

## 1.2.0 — 16 de noviembre de 2026

- Panel de uso de Teseo (visitas, páginas vistas, imágenes creadas,
  recordatorios y lo más visto) y endpoint de cifras para yachaydeep.com.

## 1.1.0 — 16 de noviembre de 2026

- «Ahora»: botón Compartir en cada evento del calendario, el Sol de hoy,
  lanzamientos, asteroides y naves rumbo a Marte. Genera una imagen vertical
  con foto real (Launch Library 2, NASA SDO) o representación rotulada (Luna y
  planetas con textura real, cielo de la noche con el radiante, trayectoria de
  la ISS), cuadrícula de datos y Killa Ñan.
- Backend: intermediario de imágenes seguro (/api/img) para fuentes sin CORS.

## 1.0.0 — 16 de noviembre de 2026 · Teseo deja de ser prototipo

Primera versión estable, presentada en la reunión de AstroCiencias Ecuador
(14-nov-2026). Hecha por Yachay Deep Labs en cooperación con Killa Ñan ·
Astronomía comunitaria.

### Ruta
- Distancias reales (NASA JPL Horizons), transferencia de Hohmann y mapa con
  la media elipse real de la próxima ventana.
- Ventanas de lanzamiento por alineación real, ahora dentro de Ruta.
- Trayectoria realista (Lambert, Izzo) con porkchop, validada con Mars 2020 e
  InSight.
- Catapultas gravitatorias de misiones reales y planificador de viajes con
  asistencias (MGA), validado con Cassini.
- La Luna y el Sol como destinos especiales.

### Ahora (pestaña nueva)
- El Sol de hoy: manchas solares (SILSO), regiones activas, fulguraciones
  GOES, índice Kp y ciclo solar (NOAA SWPC), imagen del día (NASA SDO).
- Calendario del cielo a 30 días (o todo el año) para tu ciudad: Luna,
  eclipses, meteoros, planetas, estaciones, pasadas de la ISS y lanzamientos
  relevantes; exportación .ics y recordatorios por notificación.
- Naves rumbo a Marte, próximos lanzamientos y asteroides cercanos.

### Cielo
- Planetario 3D desde tu ciudad con atmósfera física, contaminación lumínica
  (Bortle), precesión y paralaje lunar; modo «Apuntar al cielo».
- Estrellas en su distancia real, constelaciones, Messier, galaxias, púlsares,
  agujeros negros, exoplanetas, cometas, sondas y la ISS en vivo.
- Capa Caldwell: 109 joyas del cielo (Omega Centauri, 47 Tucanae, Carina,
  Tarántula, Hélice…) y las Nubes de Magallanes, con distancia citada por objeto.
- Fichas con composición, espectro y vida de cada estrella; imágenes
  verificadas de NASA, ESA/Webb, ESA/Hubble y ESO.
- Imagen vertical (9:16) para compartir, con cuadrícula de datos.

### Preguntas
- Nueve recorridos: escala del universo, masa, tiempo, espectro, agujeros
  negros, ondas gravitacionales, expansión y energía oscura, materia oscura y
  ¿estamos solos?; buscador y navegación entre preguntas.

### Plataforma
- Pestañas Ruta · Ahora · Cielo · Preguntas (los enlaces antiguos #ventanas y
  #escala siguen funcionando).
- PWA instalable, español e inglés, visión nocturna, métricas anónimas sin
  cookies.
- Créditos agrupados por institución y presencia de Killa Ñan en la app y en
  las imágenes compartidas.
- 234 pruebas de backend y más de 35 suites de frontend.

## 0.x — julio a noviembre de 2026

Prototipo: núcleo de rutas y ventanas, constelaciones en profundidad real,
capas de objetos y PWA. Ver `ROADMAP` en el proyecto.
