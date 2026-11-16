# Cambios

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
