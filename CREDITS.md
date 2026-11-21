# Créditos y licencias de datos

**Teseo (código):** [AGPL-3.0 o posterior](LICENSE). Puedes usar, copiar, modificar y redistribuir el código, con atribución; si publicas una versión modificada, también como servicio web, debes compartir su código bajo la misma licencia. Los nombres «Teseo» y «Yachay Deep» no están incluidos (ver NOTICE).

## Regla de licencias
El **código** de Teseo es propio (no copiamos código de terceros con licencias
copyleft). Los **datos** que empaquetamos conservan su licencia original y se
atribuyen aquí. Así Teseo puede elegir libremente su licencia: hoy, AGPL-3.0 o posterior.

## ⚠️ Stellarium — GPL-2.0+ (no usamos su código)
[Stellarium](https://github.com/Stellarium/stellarium) está bajo **GPL-2.0+**,
una licencia copyleft: incorporar su *código fuente* obligaría a relicenciar
todo Teseo como GPL. Por eso **no copiamos código de Stellarium**; el render 3D
es propio (Three.js).

Las **líneas de las constelaciones** provienen de la "western / modern
skyculture" de Stellarium (solo **datos**, no código). Confirmado en la fuente
oficial ([stellarium-skycultures](https://github.com/Stellarium/stellarium-skycultures)):
el texto y los datos de líneas están bajo **CC BY-SA** (atribución al equipo de
Stellarium; base IAU) — **no GPL**. Como es una licencia de *datos*, no afecta a
la licencia AGPL del código: se incluye como recurso con licencia propia y su
atribución correspondiente. (El código de Stellarium sí es GPL y por eso no se
copia; nuestro render 3D es propio, con Three.js.)

## Fuentes de datos
| Dato | Fuente | Licencia |
|---|---|---|
| Posiciones/distancias de estrellas, índice de color B−V y tipo espectral | [HYG Database v4.1](https://github.com/astronexus/HYG-Database) (astronexus) — regenerado con `scripts/build_sky.py` | CC BY-SA 4.0 |
| Temperatura estelar a partir de B−V (fórmula) | Ballesteros, F. J. (2012), *EPL* 97, 34008 ([arXiv:1201.1809](https://arxiv.org/abs/1201.1809)), ec. 14 | cita bibliográfica |
| Color de cuerpo negro (fórmula) | Kim et al., lugar de Planck en CIE 1931 (US 7024034; Kang et al. 2002, *J. Korean Phys. Soc.* 41, 865) + matriz sRGB IEC 61966-2-1 | cita bibliográfica |
| Imágenes curadas de naves, cometas, Sol, Luna, planetas y cielo profundo (`src/sky/nasaImages.js`) | [NASA Image and Video Library](https://images.nasa.gov/) (API `images-api.nasa.gov`) | material de la NASA: en general sin copyright; crédito tal como lo da la NASA (ver abajo) |
| Líneas de constelaciones | Stellarium "western/modern skyculture" + IAU | CC BY-SA (datos; atribución) |
| Cúmulos/nebulosas/galaxias (Messier/NGC) | OpenNGC (M. Verga) | CC-BY-SA-4.0 |
| Capa «NGC e IC» (`public/ngc.json`, `scripts/build_ngc.py`) | [OpenNGC](https://github.com/mattiaverga/OpenNGC) (M. Verga) | CC-BY-SA-4.0 |
| Cochasquí: disposición de las pirámides y montículos (`src/sky/monuments.js`) | Plano de J. Wentscher (1982), en U. Oberem y W. Wurster, *Excavaciones en Cochasquí, Ecuador, 1964–1965* (1989), consultado en la tesis de D. S. Pachacama (PUCE, 2025); medidas de la pirámide E: U. Oberem (comp.), *Cochasquí: estudios arqueológicos* (1981); medidas de la pirámide G: E. Rojas Vallejo, *Reconocimiento histórico del complejo arqueológico Cochasquí, Ecuador* (TFM, Universitat Politècnica de València, 2025) | Datos y medidas citados; el plano no se reproduce |
| Distancias Messier | SEDS / valores publicados | dominio público (hechos) |
| Púlsares | ATNF Pulsar Catalogue (CSIRO) | citar Manchester et al. 2005 |
| Posiciones de planetas, cometas, sondas y telescopios | NASA JPL Horizons (API) | dominio público (US gov); crédito "NASA/JPL-Caltech" |
| Acercamientos de asteroides y cometas a la Tierra | NASA/JPL CNEOS — SBDB Close-Approach Data API v1.5 | dominio público (US gov); crédito "NASA/JPL-Caltech" |
| Próximos lanzamientos | [The Space Devs — Launch Library 2](https://thespacedevs.com/llapi) (API v2.3.0) | servicio gratuito con atribución (ver abajo) |
| Hitos del espacio (Calendario del cielo) | [NASA — misión Voyager](https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/): fecha, hora y distancia de cada hito, citadas con su enlace | dominio público (NASA) |
| Astronomía andina (sitios quitu-caranquis y discos líticos) | Cobo A., Cristóbal (2012), *Astronomía Quitu-Caranqui, Catequilla y los discos líticos: evidencias de la astronomía antigua en los Andes ecuatoriales*, Quito, QUIMERADREAMS Editores (Tabla 1, coordenadas GNSS WGS84). Cochasquí, Pambamarca y Reloj Solar Quitsato: Wikipedia | cita bibliográfica; coordenadas como datos |
| Exoplanetas | NASA Exoplanet Archive (Caltech/IPAC) | dominio público (US gov) |
| Texturas del Sol, Venus, Tierra, Marte, Júpiter, Saturno (y anillos), Urano y Neptuno (`public/textures/`) | [Solar System Scope](https://www.solarsystemscope.com/textures/) (basadas en datos de NASA) | CC BY 4.0 |
| Textura de Mercurio | NASA / JHUAPL / Carnegie Institution (MESSENGER) | dominio público (US gov) |
| Textura de la Luna | NASA Scientific Visualization Studio (CGI Moon Kit) | dominio público (US gov) |
| Texturas de 14 lunas de otros planetas (`public/textures/moon-*.jpg`, `scripts/build_moon_textures.py`) | [USGS Astrogeology](https://astrogeology.usgs.gov/) — mosaicos globales con imágenes de Viking, Galileo, Voyager y Cassini (NASA) | dominio público (US gov) |
| Texturas de piedra, arena, tierra y pasto de los monumentos (`public/textures/monuments/`, color, relieve y sombra a 1024 px) | [Poly Haven](https://polyhaven.com/textures): old_sandstone_02, sandstone_blocks_08, rock_wall_13, white_sandstone_blocks_02, rock_boulder_dry, coral_fort_wall_01, sand_01, dry_ground_rocks, corrugated_iron_02 y clean_pebbles; [ambientCG](https://ambientcg.com/): Grass004 | CC0 (dominio público) |
| El Sol del cielo, con sus manchas (`src/sky/sunImage.js`; se pide en vivo por `/api/img`) | [Solar Dynamics Observatory](https://sdo.gsfc.nasa.gov/) (HMI, intensidad en luz visible): cortesía de NASA/SDO y de los equipos científicos de AIA, EVE y HMI | dominio público (NASA) |
| Fotos de objetos de cielo profundo en el cielo (`public/textures/deepsky/`, `scripts/build_deepsky_images.py`) | [Sloan Digital Sky Survey](https://www.sdss.org/) (DR9, mosaico en color) y [2MASS](https://www.ipac.caltech.edu/2mass/) («Atlas Image mosaic courtesy of 2MASS/UMass/IPAC-Caltech/NASA/NSF»), servidos en formato HiPS por [ESASky](https://sky.esa.int/) | SDSS: CC BY; 2MASS: dominio público |
| Mapa fotográfico de todo el cielo (`src/sky/hipsLayer.js`): placas cargadas en vivo, no incluidas en el repositorio | [Digitized Sky Survey](https://archive.stsci.edu/dss/) (DSS2, color) · STScI/NASA, con placas del Observatorio Palomar y del UK Schmidt; color y teselas HiPS del [CDS](https://cds.unistra.fr/), servidas por [ESASky](https://sky.esa.int/) (ESA) | [Condiciones del DSS](https://archive.stsci.edu/dss/copyright.html): uso con reconocimiento; las imágenes no se redistribuyen |
| Mapa fotográfico, detalle fino (menos de 2,4° de campo, donde lo cubre): teselas cargadas en vivo | [Sloan Digital Sky Survey](https://www.sdss.org/) (SDSS DR9, mosaico en color); teselas HiPS del CDS, servidas por ESASky (ESA) | CC BY (SDSS) |
| Planetas enanos y asteroides (`public/minor-bodies.json`, `scripts/build_minor_bodies.py`) y cometas del momento (`public/comet-orbits.json`, `scripts/build_comet_orbits.py`): elementos orbitales, magnitudes y diámetros | [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html) (NASA/JPL-Caltech) | Dominio público |
| Capas «Nebulosas oscuras, supernovas y cuásares» y «Estrellas dobles y variables» (`public/oddities.json`, `public/special-stars.json`, `scripts/build_extras.py`): posiciones y magnitud V | [SIMBAD](https://simbad.cds.unistra.fr/simbad/) (CDS, Estrasburgo), por el servicio de nombres Sesame | Uso libre con reconocimiento: «This research has made use of the SIMBAD database, CDS, Strasbourg Astronomical Observatory, France» |
| Posición en el cielo de las imágenes de agencia (`public/agency-sky.json`, `scripts/build_agency_sky.py`) | Centro, campo y orientación publicados en la página de cada imagen de [ESA/Hubble](https://esahubble.org/), [ESA/Webb](https://esawebb.org/) y [ESO](https://www.eso.org/public/); las imágenes se cargan desde el CDN de cada agencia | imágenes: CC BY 4.0 (crédito de cada una en su ficha) |
| Órbita y brillo de los cometas (`public/comet-orbits.json`, `scripts/build_comet_orbits.py`) | [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html): elementos osculadores y parámetros M1 y K1 | dominio público (NASA/JPL) |
| Campos profundos del Hubble y del Webb (`public/deepfields.json`) | Posiciones y tamaños publicados por STScI/NASA/ESA y por los equipos de COSMOS y CEERS | datos de hecho |
| La Vía Láctea del cielo (`public/textures/milkyway-4k.webp` y `-2k.webp`, `src/sky/milkyWayLayer.js`) | [NASA/Goddard Space Flight Center Scientific Visualization Studio](https://svs.gsfc.nasa.gov/4851), «Deep Star Maps 2020» (mapa `milkyway_2020`), a partir de datos de Gaia DR2, Hipparcos-2 y Tycho-2 | dominio público (NASA) |
| Posición y medidas de los monumentos de «Mi cielo» (`src/sky/monuments.js`) | Medidas: Wikipedia y las fichas de cada sitio. Chankillo: Ghezzi y Ruggles (2007), *Science* 315. Catequilla: Cobo (2017), *Revista de Topografía Azimut* 8. Paranal: [ESO](https://www.eso.org/) (cerramientos del VLT y estaciones del VLTI). Las posiciones de Chankillo, Quitsato, Catequilla, Paranal y Tiwanaku se leyeron sobre imagen satelital de [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) (solo como referencia para medir: Teseo no usa ni redistribuye esas imágenes) | datos de hecho; fuentes citadas |
| Trayectoria de Cassini en la animación de entrada (`src/intro/cassiniPath.js`, `scripts/build_intro_cassini.py`) | [NASA JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | dominio público (US gov); crédito "NASA/JPL-Caltech" |
| Órbitas de 19 lunas de otros planetas (`src/sky/moonsData.js`, `scripts/build_moons.py`) | [NASA JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) (ajuste propio) y [JPL SSD, parámetros físicos](https://ssd.jpl.nasa.gov/sats/phys_par/) | dominio público (US gov) |
| Pronóstico de nubes de la vista Cielo (`src/sky/weather.js`) | [Open-Meteo.com](https://open-meteo.com/) (modelos meteorológicos nacionales), consultado desde el navegador | datos CC BY 4.0; API gratuita para uso no comercial (ver abajo) |
| Nubes vistas desde el satélite: GOES-19 y GOES-18 «GeoColor», VIIRS del NOAA-20 (`src/sky/satellite.js`) | [NASA GIBS](https://gibs.earthdata.nasa.gov/) (Global Imagery Browse Services, NASA EOSDIS); GeoColor de NOAA/CIRA | sin restricciones de uso; crédito "NASA GIBS" y "NOAA/CIRA" |
| Nubes vistas desde el satélite: Meteosat-12 (MTG) «GeoColour» (`src/sky/satellite.js`) | [EUMETSAT — EUMETView](https://view.eumetsat.int/) | imágenes de EUMETSAT con atribución "EUMETSAT" |
| Buscador de lugares de «Mi cielo» (`src/sky/places.js`) | [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), con los nombres de [GeoNames](https://www.geonames.org/) | GeoNames: CC BY 4.0; API gratuita para uso no comercial |
| Cumbres y volcanes en el buscador de «Mi cielo» (`src/sky/places.js`) | [Photon](https://photon.komoot.io/) (Komoot) sobre © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (`natural=peak`, `natural=volcano`) | datos ODbL; servicio público gratuito de uso razonable |
| Situarse en la cumbre (`backend/app/horizon.py`, `/api/summit`) | El punto más alto del modelo de AWS Terrain Tiles cerca de la montaña elegida o de la posición del GPS | — |
| Ficha de los volcanes del horizonte (`backend/app/volcanoes.py`, `src/sky/volcanoes.js`) | Global Volcanism Program, Smithsonian Institution: *Volcanoes of the World* (servicio WFS), https://volcano.si.edu/ | uso personal, educativo y no comercial ([condiciones](https://volcano.si.edu/gvp_termsofuse.cfm)); la base no se guarda en el repositorio: se lee en vivo; sin resumen ni fotos (la ficha enlaza a su página) |
| Color real de las laderas del horizonte (`backend/app/landcolor.py`) | Sentinel-2 cloudless – https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 & 2017) | CC BY 4.0 (solo la versión de 2016; las de 2018 en adelante son CC BY-NC-SA y no se usan) |
| Altura de las columnas de ceniza simuladas (`src/sky/plumeLayer.js`) | Índice de explosividad volcánica (VEI): Newhall, C. y Self, S. (1982), *J. Geophys. Res.* 87(C2), 1231–1238; VEI de cada erupción: Global Volcanism Program, Smithsonian | dato científico citado; la forma de la columna es generada |
| Mapa topográfico para elegir el lugar (`src/sky/TopoPicker.jsx`) | [OpenTopoMap](https://opentopomap.org) (datos © colaboradores de OpenStreetMap y SRTM) | mapa CC-BY-SA 3.0; servidor de voluntarios: solo mientras el mapa está abierto |
| El tiempo de ahora sobre el cielo (`src/sky/nowWeather.js`) | [Open-Meteo](https://open-meteo.com) (temperatura corregida a la altitud del lugar y código WMO) | CC BY 4.0 |
| Sitios astronómicos y arqueológicos (`src/sky/places.js`) | Coordenadas de Wikipedia y de la ficha de nominación a la Unesco (Chankillo), comprobadas el 17-nov-2026 | hechos (sin licencia) |
| Horizonte real del lugar (montañas) (`backend/app/horizon.py`) | [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen, formato terrarium) a partir de SRTM (NASA), GMTED2010 (USGS), ETOPO1 (NOAA) y otros modelos | datos abiertos con atribución (ver abajo) |
| Nombres de las montañas del horizonte (`backend/app/peaks.py`) | [Wikidata](https://www.wikidata.org/) (montañas, volcanes, cimas y colinas con coordenadas, por su [servicio de consultas](https://query.wikidata.org/)) y [OpenStreetMap](https://www.openstreetmap.org/copyright) (`natural=peak` y `natural=volcano` con nombre, por la API [Overpass](https://overpass-api.de/)) | Wikidata: CC0; OpenStreetMap: © colaboradores de OpenStreetMap, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) |
| Monumentos del cielo (`src/sky/monuments.js`) | Medidas (alto y base) de Wikipedia y de las fichas de los sitios; posición de las pirámides comprobada con el modelo de relieve (AWS Terrain Tiles); forma simplificada dibujada por Teseo | — |
| Narrativa | Groq (modelos Llama) | — servicio |
| Render 3D | Three.js | MIT |

> Las distancias de objetos de cielo profundo y púlsares son valores publicados
> con incertidumbre real; se muestran como aproximaciones, fieles al principio
> de honestidad científica de Teseo.

## Nubes y clima (desde el navegador)

- **Open-Meteo** (<https://open-meteo.com/en/terms>): API gratuita y sin clave para uso no comercial, con
  atribución; los datos se publican con licencia CC BY 4.0. Teseo la llama desde el navegador de cada persona
  (la cuota es por dirección IP), con el lugar redondeado a 0,1° y la respuesta guardada 30 minutos.
- **NASA GIBS** (<https://nasa-gibs.github.io/gibs-api-docs/>): imágenes de NASA EOSDIS sin restricciones de uso;
  se pide citar la fuente. GeoColor es un producto de NOAA/CIRA.
- **EUMETSAT EUMETView** (<https://view.eumetsat.int/>): servicio WMS público de EUMETSAT; se cita "EUMETSAT".

## Foto 360° del cielo
La «Foto 360°» (`src/sky/pano360.js`) lleva en su sello y en sus metadatos (XMP: `dc:creator`, `dc:rights`)
los créditos de los datos que aparecen en ella: HYG v4.1 (CC BY-SA 4.0) y las líneas de Stellarium (CC BY-SA)
siempre; AWS Terrain Tiles si hay relieve; Wikidata y © colaboradores de OpenStreetMap (ODbL) si hay nombres
de montañas; Open-Meteo (CC BY 4.0) si hay nubes; Solar System Scope (CC BY 4.0) si hay planetas.

## Relieve (horizonte real)

- **AWS Terrain Tiles** (<https://registry.opendata.aws/terrain-tiles/> y
  <https://github.com/tilezen/joerd/blob/master/docs/attribution.md>): teselas de elevación de Mapzen en el Registro de
  Datos Abiertos de AWS, sin claves. Se atribuyen sus fuentes: SRTM y GMTED2010 (USGS/NASA, dominio público),
  ETOPO1 (NOAA), y modelos nacionales en algunos países. El backend las descarga, calcula el horizonte y solo
  envía al navegador la lista de ángulos.

## Condiciones de uso de las API en vivo (backend)

Verificadas el 13-nov-2026 en la documentación oficial de cada proveedor y
contra los propios servicios.

### NASA/JPL — Horizons y SBDB Close-Approach Data
- Fuentes: <https://ssd-api.jpl.nasa.gov/doc/horizons.html> y
  <https://ssd-api.jpl.nasa.gov/doc/cad.html>. Datos del gobierno de EE. UU.,
  sin restricción de copyright; se acreditan como **NASA/JPL-Caltech**.
- Política de uso justo de las API de JPL SSD (<https://ssd-api.jpl.nasa.gov/doc/>),
  y cómo la cumple Teseo:
  - *una sola petición a la vez* → todas las consultas a JPL (Horizons y CAD)
    pasan por una única cola en el backend;
  - *cachear y no repetir consultas* → caché en memoria (posiciones y naves:
    6 h; acercamientos: 6 h, con UNA consulta que cubre 60 días y 20
    distancias lunares y se filtra localmente);
  - *retroceder ante errores* → pausa tras un fallo y se sirve el último dato
    válido marcado `stale`;
  - *no incrustar las API en el sitio web* → el navegador nunca llama a JPL:
    solo el backend, que sirve su caché;
  - *identificarse con un User-Agent propio (producto, versión y contacto)* →
    variable de entorno `TESEO_USER_AGENT` del backend (hay que definirla en
    producción).
- **Tamaño de los asteroides:** `diameter_m` solo aparece cuando JPL tiene un
  diámetro medido. `diameter_est_m` es una **estimación** a partir de la
  magnitud absoluta H: `D = 1329 km / sqrt(p) × 10^(−H/5)`, con albedo
  p = 0,25 (mínimo) y p = 0,05 (máximo). La hora de máximo acercamiento se
  convierte de TDB a UTC (−69,184 s). Constantes: 1 au = 149 597 870,7 km;
  1 distancia lunar = 384 400 km.
- **Naves:** cada identificador de Horizons de `backend/app/nasa_horizons.py`
  se comprobó contra Horizons (efeméride vigente el 13-nov-2026). Estado de
  las misiones contrastado con NASA (blog de ESCAPADE, science.nasa.gov), ESA
  (MMX, BepiColombo, Hera) y las fichas de misión del propio Horizons.

### The Space Devs — Launch Library 2
- Fuente: <https://ll.thespacedevs.com/2.3.0/launches/upcoming/>.
- Uso gratuito sin clave: hasta **15 peticiones por hora y por IP**. El
  proveedor pide que el servidor cachee y sirva a sus clientes; Teseo hace
  una petición cada 30 minutos como mucho (y pausa 5 min tras un fallo).
  Con clave de pago (Patreon): variable `LL2_API_KEY`, cabecera
  `Authorization: Token <clave>`.
- El proveedor **no publica una licencia formal para los datos**; se usan
  con atribución visible ("The Space Devs — Launch Library 2"). Para un uso
  comercial o dudas de licencia: support@thespacedevs.com.
- **Imágenes de los lanzamientos:** NO son de The Space Devs. Cada imagen
  trae su propio autor y licencia (SpaceX, ULA, ESA, Roscosmos…). La API de
  Teseo entrega el autor en `image_credit`; debe mostrarse junto a la imagen.
- Las descripciones de misión se sirven en inglés, tal cual las da el
  proveedor (no se traducen con IA).


### NASA Image and Video Library (imágenes en la ficha)
- Fuente: <https://images.nasa.gov/> · API documentada en
  <https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf> (`/search`,
  `/asset/{nasa_id}`, sin clave). Verificado el 13-nov-2026.
- Condiciones (NASA Images and Media Usage Guidelines,
  <https://www.nasa.gov/nasa-brand-center/images-and-media/>): el material de la
  NASA «generally [is] not subject to copyright in the United States» y puede
  usarse con fines educativos e informativos, incluidas páginas web, **sin
  sugerir respaldo de la NASA** y **reconociendo a la NASA como fuente**.
  Excepciones que respetamos: el logotipo/insignia de la NASA no es de dominio
  público (no se usa ninguna imagen cuyo motivo sea el logotipo); las personas
  identificables requieren permiso para usos comerciales (no se eligió ninguna
  imagen de personas); el material de terceros con copyright va marcado con su
  titular (se descartaron las imágenes «© ESA»).
- Cada imagen es una elección manual (no el primer resultado de una búsqueda):
  `nasa_id`, título, crédito y fecha tal como los da la API, y su tipo:
  **fotografía**, **observación real procesada** (infrarrojo, ultravioleta,
  colores falsos), **ilustración artística** o **imagen generada por
  computadora**. La ficha lo rotula siempre y enlaza a
  `https://images.nasa.gov/details/{nasa_id}`. Comprobación contra la API real:
  `node scripts/test_sky_nasa.mjs --red`.
- **CORS:** la API responde `Access-Control-Allow-Origin: *`, pero las imágenes
  de `images-assets.nasa.gov` casi nunca (depende de la copia en caché de su
  CDN). Por eso la imagen de la NASA solo se muestra en la ficha; la postal
  (que se dibuja en un lienzo y se exporta) usa Wikipedia o la representación
  propia (`NASA_CANVAS_OK = false` en `src/sky/postcard.js`).


### Atmósfera, contaminación lumínica y magnitudes (vista Cielo · Mi cielo)
- **Brillo del cielo y umbral de visión:** B. E. Schaefer, *Astronomy and the
  limits of vision*, Vistas in Astronomy 36, 311–361 (1993) y *To the visual
  limits*, Sky & Telescope 95(5), 57–60 (1998), programa VISLIMIT (constantes
  contrastadas con la transcripción de L. Bogan y con `Skybright.cpp` de
  Stellarium). Código: `src/sky/atmosphere.js` · pruebas:
  `node scripts/test_sky_atmosphere.mjs`.
- **Masa de aire:** F. Kasten y A. T. Young, Applied Optics 28, 4735 (1989).
- **Escala de Bortle:** J. E. Bortle, Sky & Telescope, febrero de 2001 (magnitud
  límite por clase). Bortle no da brillo en mag/arcsec²: Teseo no lo muestra.
- **Brillo típico de cielos naturales, rurales y urbanos; crepúsculos:** A. Hänel
  et al., JQSRT 205, 278 (2018), tabla 2 (arXiv:1709.09558).
- **Contexto sobre observadores típicos:** A. Crumey, MNRAS 442, 2600 (2014).
- **Visión mesópica (cuándo deja de ayudar la adaptación a la oscuridad):** CIE 191:2010.
- **Quito:** B. A. Aroca Morocho y P. M. Herrera Paucar (2022), *Estudio y análisis
  del grado de la contaminación lumínica en el DMQ*, tesis UPS (SQM 15,5–16,4
  mag/arcsec²) → Bortle 8 por defecto. Altitudes de los atajos: ficha de cada
  ciudad en Wikipedia (Quito 2.850 m, Cayambe 2.830 m, Guayaquil 4 m, Cuenca 2.560 m).
- **Magnitud aparente de los planetas:** A. Mallama y J. L. Hilton, Astronomy and
  Computing 25, 10–24 (2018) (sin las correcciones L(λe) y L(Ls) de Marte).
  Contrastada con JPL Horizons (APmag, 13-nov-2026): `node scripts/test_sky_planetmag.mjs`.
- **Ciencia ciudadana:** Globe at Night, <https://globeatnight.org/>.
- Los **colores** del cielo son una aproximación visual (no un modelo de dispersión),
  y así se rotula en la interfaz.
