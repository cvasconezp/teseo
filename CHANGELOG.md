# Cambios

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
