// places.js — buscar un lugar del mundo para «Mi cielo» y una lista de sitios astronómicos y arqueológicos.
// Puro salvo searchPlaces(); se prueba en scripts/test_places.mjs.
//
// Buscador: Open-Meteo Geocoding (https://open-meteo.com/en/docs/geocoding-api), con los nombres de GeoNames
// (CC BY 4.0). Sale del navegador (permite CORS, sin claves; cuota gratuita por visitante). Da ciudades y pueblos
// con su altura; los sitios arqueológicos casi no los tiene, por eso van aparte, con coordenadas comprobadas.
//
// Montañas y volcanes: GeoNames marca casi siempre el centro del macizo, no la cumbre (el Cotopaxi queda a 1,4 km
// y 580 m por debajo de ella) y le faltan muchos (el volcán Cayambe, el Chimborazo). Por eso se pregunta también
// a Photon (https://photon.komoot.io, de Komoot, sobre OpenStreetMap, ODbL; CORS abierto y sin claves) solo por
// cumbres (natural=peak y natural=volcano), que en OSM están en el punto de la cima. Al elegir una montaña, la
// app busca además la cumbre en el modelo de terreno (/api/summit) y te pone de pie en ella.

export const GEOCODER = "https://geocoding-api.open-meteo.com/v1/search";
export const PHOTON = "https://photon.komoot.io/api/";
/** Códigos de GeoNames que son montañas, y el radio (m) en el que buscar su cumbre: un macizo (MT) es grande. */
export const PEAK_CODES = { MT: 1500, MTS: 1500, PK: 600, PKS: 600, VLC: 1500, HLL: 400, HLLS: 400 };
/** Radio (m) para buscar la cumbre de un pico de OpenStreetMap (ya está en la cima: solo se ajusta al modelo). */
export const OSM_PEAK_R = 300;

/**
 * Sitios astronómicos y arqueológicos (coordenadas de Wikipedia o de sus fichas oficiales, comprobadas el
 * 17-nov-2026; altura en m cuando la fuente la da). Teseo dibuja el relieve que los rodea y, donde los hay, los monumentos (src/sky/monuments.js): por eso
 * algunos sitios son un punto de vista frente al monumento, no su centro.
 */
export const SITES = [
  { id: "machupicchu", region: "am", wiki: { es: "Machu_Picchu", en: "Machu_Picchu" }, name: { es: "Machu Picchu", en: "Machu Picchu" }, lat: -13.16312, lon: -72.545683, elev: 2430,
    note: { es: "Ciudadela inca del siglo XV sobre el río Urubamba, a 2.430 m (Perú). Desde la cima del Intihuatana, la piedra tallada «donde se amarra el Sol», mirando al Huayna Picchu; al sureste, más abajo, los templos de la Plaza Sagrada y, al otro lado de la plaza, el sector urbano (edificios en posición aproximada).", en: "15th-century Inca citadel above the Urubamba River, at 2,430 m (Peru). From the top of the Intihuatana hill, by the carved stone known as the hitching post of the Sun, facing Huayna Picchu; to the south-east, lower down, the temples of the Sacred Plaza and, across the main plaza, the urban sector (buildings in approximate positions)." } },
  { id: "chankillo", region: "am", wiki: { es: "Chankillo", en: "Chankillo" }, name: { es: "Chankillo · Trece Torres", en: "Chankillo · Thirteen Towers" }, lat: -9.561185, lon: -78.229591, elev: null,
    note: { es: "Desde el punto de observación oeste, a unos 235 m de las torres: sus trece torres (entre 200 y 300 a. C.) forman un horizonte artificial que marca por dónde sale el Sol a lo largo del año, de la torre 1 en junio a la 13 en diciembre. Cómo usarlo: mira al este y adelanta la fecha en «Tiempo»: cada amanecer el Sol asoma por un hueco o una torre distinta, y así se sabía el día del año con dos o tres de margen. Patrimonio de la Humanidad desde 2021 (Perú).", en: "From the western observing point, about 235 m from the towers: its thirteen towers (200–300 BCE) form an artificial horizon marking where the Sun rises through the year, from tower 1 in June to tower 13 in December. How to use it: look east and step the date in “Time”: each sunrise the Sun appears at a different gap or tower, which gave the day of the year to within two or three days. World Heritage since 2021 (Peru)." } },
  { id: "cochasqui", region: "ec", wiki: { es: "Cochasqu%C3%AD", en: "Cochasqu%C3%AD" }, name: { es: "Cochasquí", en: "Cochasquí" }, lat: 0.055947, lon: -78.307397, elev: 3115,
    note: { es: "Pirámides truncas de los caranquis (c. 950–1530) en las faldas del Mojanda, a 3.100 m (Ecuador). De pie en el vértice oeste de la plataforma de la pirámide mayor, la G (unos 76 × 62 m), a 14 m sobre la ladera: al sur baja su rampa y alrededor quedan las otras catorce pirámides (A–P) y los montículos funerarios, cubiertos de hierba como están hoy. Disposición según el plano de Wentscher (1982); el alto de casi todas es estimado. En la plataforma de la E, la vecina, se hallaron dos círculos de barro cocido con canales que se han interpretado como calendarios.", en: "Caranqui truncated pyramids (c. 950–1530) on the slopes of Mojanda, at 3,100 m (Ecuador). Standing at the west corner of the platform of the largest pyramid, G (about 76 × 62 m), 14 m above the slope: its ramp runs down to the south and around it lie the other fourteen pyramids (A–P) and the burial mounds, grass-covered as they are today. Layout after the plan by Wentscher (1982); the height of most is estimated. On the platform of E, next to it, two fired-clay circles with channels were found and have been read as calendars." } },
  { id: "catequilla", region: "ec", wiki: { es: "Catequilla", en: "Catequilla" }, name: { es: "Catequilla · cima", en: "Catequilla · summit" }, lat: 0.000207, lon: -78.428426, elev: 2636,
    note: { es: "Cerro sobre la línea ecuatorial con un muro semicircular quitu-caranqui; según Cobo (2012), desde aquí el Sol sale por Cochasquí en junio, por el Reloj Solar Quitsato en los equinoccios y por Pambamarca en diciembre. Coordenadas GNSS del vértice medido por Cobo (Ecuador).", en: "Hill on the equator with a semicircular Quitu-Caranqui wall; according to Cobo (2012), from here the Sun rises over Cochasquí in June, over the Quitsato Sundial at the equinoxes and over Pambamarca in December. GNSS coordinates of the vertex surveyed by Cobo (Ecuador)." } },
  { id: "quitsato", region: "ec", wiki: { es: "Reloj_Solar_Quitsato", en: "Quitsato_Sundial" }, name: { es: "Reloj solar Quitsato", en: "Quitsato sundial" }, lat: 0.0, lon: -78.17518, elev: null,
    note: { es: "Reloj solar de 54 m de diámetro sobre la línea ecuatorial, cerca de Cayambe (Ecuador), inaugurado en 2007. Desde la plataforma, 20 m al oeste del poste: en los equinoccios el Sol sale justo detrás de él.", en: "A 54 m sundial on the equator near Cayambe (Ecuador), opened in 2007. From the platform, 20 m west of the pole: at the equinoxes the Sun rises right behind it." } },
  { id: "tiwanaku", region: "am", wiki: { es: "Tiahuanaco", en: "Tiwanaku" }, name: { es: "Tiwanaku", en: "Tiwanaku" }, lat: -16.554757, lon: -68.672263, elev: 3863,
    note: { es: "Centro ceremonial de Tiwanaku (Bolivia), a unos 3.860 m. Desde el este, junto al Templete Semisubterráneo, en el eje de Kalasasaya: su portada enmarca la estela Ponce y, en los equinoccios, el Sol se pone justo detrás; al sur, Akapana.", en: "Tiwanaku ceremonial centre (Bolivia), at about 3,860 m. From the east, by the Semi-Subterranean Temple, on the axis of Kalasasaya: its gateway frames the Ponce Stela and, at the equinoxes, the Sun sets right behind it; to the south, Akapana." } },
  { id: "teotihuacan", region: "am", wiki: { es: "Teotihuacan", en: "Teotihuacan" }, name: { es: "Teotihuacan · Pirámide del Sol", en: "Teotihuacan · Pyramid of the Sun" }, lat: 19.69300, lon: -98.84590, elev: 2300,
    note: { es: "Desde la Calzada de los Muertos, frente a la Pirámide del Sol (65 m, hacia los años 100–200); al norte, la de la Luna (México).", en: "From the Avenue of the Dead, facing the Pyramid of the Sun (65 m, built around 100–200 CE); to the north, the Pyramid of the Moon (Mexico)." } },
  { id: "chichenitza", region: "am", wiki: { es: "Chich%C3%A9n_Itz%C3%A1", en: "Chichen_Itza" }, name: { es: "Chichén Itzá · El Castillo", en: "Chichen Itza · El Castillo" }, lat: 20.68425, lon: -88.56865, elev: null,
    note: { es: "Desde la Gran Plaza, frente a la escalinata norte de El Castillo o templo de Kukulcán, pirámide maya de los siglos VIII al XII (Yucatán, México).", en: "From the Great Plaza, facing the north stairway of El Castillo, the Temple of Kukulcan, a Maya pyramid from the 8th–12th centuries (Yucatán, Mexico)." } },
  { id: "paranal", region: "am", wiki: { es: "Observatorio_Paranal", en: "Paranal_Observatory" }, name: { es: "Observatorio Paranal (ESO)", en: "Paranal Observatory (ESO)" }, lat: -24.627907, lon: -70.404299, elev: 2635,
    note: { es: "El observatorio de ESO con el Very Large Telescope, a 2.635 m en el desierto de Atacama (Chile). Desde la explanada, con los cuatro telescopios de 8,2 m al norte.", en: "ESO's observatory with the Very Large Telescope, at 2,635 m in the Atacama Desert (Chile). From the platform, with the four 8.2 m telescopes to the north." } },
  { id: "stonehenge", region: "world", wiki: { es: "Stonehenge", en: "Stonehenge" }, name: { es: "Stonehenge", en: "Stonehenge" }, lat: 51.178844, lon: -1.826189, elev: null,
    note: { es: "Desde el centro del círculo de piedras (llanura de Salisbury, Inglaterra; 3000–2000 a. C.): el eje mira hacia donde sale el Sol en el solsticio de junio, sobre la Piedra del Talón.", en: "From the centre of the stone circle (Salisbury Plain, England; 3000–2000 BCE): its axis points to the June solstice sunrise, over the Heel Stone." } },
  { id: "newgrange", region: "world", wiki: { es: "Newgrange", en: "Newgrange" }, name: { es: "Newgrange", en: "Newgrange" }, lat: 53.69464, lon: -6.47457, elev: null,
    note: { es: "Frente a la entrada de esta tumba de corredor de hacia el 3200 a. C. (Irlanda): en el solsticio de invierno, el Sol naciente entra por una abertura sobre la puerta y alumbra la cámara.", en: "Passage tomb from about 3200 BCE (Ireland): at the winter solstice the rising Sun shines through a roof-box and lights the chamber." } },
  { id: "giza", region: "world", wiki: { es: "Necr%C3%B3polis_de_Guiza", en: "Giza_pyramid_complex" }, name: { es: "Pirámides de Guiza", en: "Pyramids of Giza" }, lat: 29.97120, lon: 31.12380, elev: null,
    note: { es: "Desde el mirador del suroeste: Micerino delante, Kefrén y la Gran Pirámide de Keops (hacia el 2600 a. C.) detrás (Egipto).", en: "From the south-west viewpoint: Menkaure in front, Khafre and the Great Pyramid of Khufu (about 2600 BCE) behind (Egypt)." } },
  { id: "teotihuacan-sol", region: "am", wiki: { es: "Pir%C3%A1mide_del_Sol", en: "Pyramid_of_the_Sun" }, name: { es: "Teotihuacan · cima de la Pirámide del Sol", en: "Teotihuacan · top of the Pyramid of the Sun" }, lat: 19.6924, lon: -98.8436, elev: null,
    note: { es: "De pie en la plataforma de arriba de la Pirámide del Sol, a 65 m sobre la Calzada de los Muertos; al norte, la Pirámide de la Luna (México). Hoy no se permite subir: la vista es la que se tendría desde arriba.", en: "Standing on the top platform of the Pyramid of the Sun, 65 m above the Avenue of the Dead; to the north, the Pyramid of the Moon (Mexico). Climbing is not allowed today: this is the view you would have from the top." } },
  { id: "teotihuacan-luna", region: "am", wiki: { es: "Pir%C3%A1mide_de_la_Luna", en: "Pyramid_of_the_Moon" }, name: { es: "Teotihuacan · cima de la Pirámide de la Luna", en: "Teotihuacan · top of the Pyramid of the Moon" }, lat: 19.69969, lon: -98.84395, elev: null,
    note: { es: "De pie en la plataforma de arriba de la Pirámide de la Luna (43 m), al final de la Calzada de los Muertos: al sur, toda la calzada y la Pirámide del Sol (México). Hoy no se permite subir.", en: "Standing on the top platform of the Pyramid of the Moon (43 m), at the end of the Avenue of the Dead: to the south, the whole avenue and the Pyramid of the Sun (Mexico). Climbing is not allowed today." } },
  { id: "chichenitza-cima", region: "am", wiki: { es: "Chich%C3%A9n_Itz%C3%A1", en: "Chichen_Itza" }, name: { es: "Chichén Itzá · cima de El Castillo", en: "Chichen Itza · top of El Castillo" }, lat: 20.682972, lon: -88.56865, elev: null,
    note: { es: "En lo alto de El Castillo (24 m), entre el templo de la cima y el borde norte, sobre la escalinata (Yucatán, México). Desde 2006 no se permite subir.", en: "At the top of El Castillo (24 m), between the summit temple and the northern edge, above the stairway (Yucatán, Mexico). Climbing has not been allowed since 2006." } },
  { id: "giza-keops", region: "world", wiki: { es: "Gran_Pir%C3%A1mide_de_Guiza", en: "Great_Pyramid_of_Giza" }, name: { es: "Guiza · cima de Keops", en: "Giza · top of Khufu" }, lat: 29.97917, lon: 31.13417, elev: null,
    note: { es: "En la cima de la Gran Pirámide de Keops, hoy a unos 138 m (la punta original se perdió y queda una plataforma de unos 10 m): al suroeste, Kefrén y Micerino (Egipto). Subir está prohibido.", en: "On top of the Great Pyramid of Khufu, now about 138 m high (the original tip is lost, leaving a platform about 10 m wide): to the south-west, Khafre and Menkaure (Egypt). Climbing is forbidden." } },
  { id: "ingapirca", region: "ec", wiki: { es: "Ingapirca", en: "Ingapirca" }, name: { es: "Ingapirca", en: "Ingapirca" }, lat: -2.539722, lon: -78.875, elev: 3160,
    note: { es: "El mayor sitio inca de Ecuador, levantado sobre un asentamiento cañari, a unos 3.160 m (Cañar). Su edificio más conocido es el «Castillo» o Templo del Sol, una plataforma elíptica de piedra labrada.", en: "The largest Inca site in Ecuador, built over a Cañari settlement, at about 3,160 m (Cañar). Its best-known building is the “Castle” or Temple of the Sun, an elliptical platform of dressed stone." } },
  { id: "rumicucho", region: "ec", wiki: { es: "Pucar%C3%A1_de_Rumicucho", en: "Rumicucho" }, name: { es: "Pucará de Rumicucho", en: "Rumicucho pukara" }, lat: 0.0115, lon: -78.431454, elev: null,
    note: { es: "Pucará (fortaleza en terrazas) preinca e inca sobre una loma de San Antonio de Pichincha, muy cerca de la línea ecuatorial (Ecuador).", en: "Pre-Inca and Inca pukara (terraced hill fort) on a hill at San Antonio de Pichincha, very close to the equator (Ecuador)." } },
  { id: "quitoloma", region: "ec", wiki: { es: "Fortalezas_de_Pambamarca", en: "Pambamarca_Fortress_Complex" }, name: { es: "Quitoloma · Pambamarca", en: "Quitoloma · Pambamarca" }, lat: 0.065556, lon: -78.220556, elev: 3780,
    note: { es: "La mayor de las fortalezas incas de Pambamarca, a 3.780 m, levantadas hacia 1490 en la guerra contra cayambis y caranquis (Ecuador).", en: "The largest of the Inca fortresses of Pambamarca, at 3,780 m, built around the 1490s in the war against the Cayambi and Caranqui (Ecuador)." } },
  { id: "tulipe", region: "ec", name: { es: "Tulipe · piscinas yumbo", en: "Tulipe · Yumbo pools" }, lat: 0.087262, lon: -78.736766, elev: 1450,
    note: { es: "Centro ceremonial yumbo en el valle de Tulipe (Nanegalito), a 1.450 m: estructuras hundidas en la tierra, las «piscinas» (una cuadrada, dos rectangulares, dos semicirculares y una de veinte lados), junto al museo de sitio (Ecuador).", en: "Yumbo ceremonial centre in the Tulipe valley (Nanegalito), at 1,450 m: structures sunk into the ground, the “pools” (one square, two rectangular, two semicircular and one with twenty sides), next to the site museum (Ecuador)." } },
  { id: "realalto", region: "ec", wiki: { en: "Real_Alto" }, name: { es: "Real Alto", en: "Real Alto" }, lat: -2.365278, lon: -80.653611, elev: null,
    note: { es: "Aldea de la cultura Valdivia en la península de Santa Elena, una de las más antiguas de América: casas en torno a una plaza con montículos ceremoniales (Ecuador).", en: "Valdivia culture village on the Santa Elena Peninsula, one of the oldest in the Americas: houses around a plaza with ceremonial mounds (Ecuador)." } },
  { id: "fajada", region: "am", wiki: { es: "Butte_de_Fajada", en: "Fajada_Butte" }, name: { es: "Chaco · Fajada Butte", en: "Chaco · Fajada Butte" }, lat: 36.018889, lon: -107.909722, elev: null,
    note: { es: "Peñón del cañón del Chaco (Nuevo México, EE. UU.) con la «daga de Sol»: una espiral grabada que una franja de luz entre losas cruza al mediodía en los solsticios y los equinoccios. Hoy el acceso está restringido.", en: "Butte in Chaco Canyon (New Mexico, USA) with the “Sun Dagger”: a carved spiral crossed at midday by a sliver of light between slabs at the solstices and equinoxes. Access is restricted today." } },
  { id: "xochicalco", region: "am", wiki: { es: "Zona_arqueol%C3%B3gica_de_Xochicalco", en: "Xochicalco" }, name: { es: "Xochicalco", en: "Xochicalco" }, lat: 18.804306, lon: -99.296639, elev: null,
    note: { es: "Ciudad de los siglos VII al X en Morelos (México). En el «Observatorio», una cueva con un tiro vertical, el Sol entra hasta el fondo los días cercanos a su paso por el cenit.", en: "City from the 7th–10th centuries in Morelos (Mexico). In the “Observatory”, a cave with a vertical shaft, sunlight reaches the floor on the days around the Sun’s passage through the zenith." } },
  { id: "montealban", region: "am", wiki: { es: "Monte_Alb%C3%A1n", en: "Monte_Alb%C3%A1n" }, name: { es: "Monte Albán", en: "Monte Albán" }, lat: 17.043889, lon: -96.767778, elev: null,
    note: { es: "Capital zapoteca sobre un cerro allanado junto a Oaxaca (México). En la Gran Plaza, el Edificio J, en forma de punta de flecha, tiene una orientación distinta del resto que se ha relacionado con la astronomía.", en: "Zapotec capital on a levelled hilltop by Oaxaca (Mexico). In the Main Plaza, the arrow-shaped Building J is oriented differently from the rest, which has been linked to astronomy." } },
  { id: "sacsayhuaman", region: "am", wiki: { es: "Sacsayhuam%C3%A1n", en: "Sacsayhuam%C3%A1n" }, name: { es: "Sacsayhuamán", en: "Sacsayhuamán" }, lat: -13.507778, lon: -71.982222, elev: null,
    note: { es: "Complejo inca de muros ciclópeos sobre el Cusco (Perú). Allí se representa hoy el Inti Raymi, la fiesta del Sol del solsticio de junio.", en: "Inca complex of cyclopean walls above Cusco (Peru). Today it hosts the Inti Raymi, the festival of the Sun at the June solstice." } },
  { id: "pisac", region: "am", wiki: { es: "P%C3%ADsac_(Per%C3%BA)", en: "P%C3%ADsac" }, name: { es: "Písac", en: "Písac" }, lat: -13.4213, lon: -71.8505, elev: null,
    note: { es: "Ciudadela inca sobre el Valle Sagrado (Perú), con su sector del Intihuatana y una piedra tallada en la cumbre.", en: "Inca citadel above the Sacred Valley (Peru), with its Intihuatana sector and a carved stone at the top." } },
  { id: "isladelsol", region: "am", wiki: { es: "Isla_del_Sol", en: "Isla_del_Sol" }, name: { es: "Isla del Sol (Titicaca)", en: "Island of the Sun (Titicaca)" }, lat: -16.020556, lon: -69.176389, elev: null,
    note: { es: "Isla del lago Titicaca (Bolivia), santuario inca: según sus relatos, allí nació el Sol.", en: "Island in Lake Titicaca (Bolivia), an Inca sanctuary: in Inca accounts, the Sun was born there." } },
  { id: "abusimbel", region: "world", wiki: { es: "Templos_de_Abu_Simbel", en: "Abu_Simbel" }, name: { es: "Abu Simbel", en: "Abu Simbel" }, lat: 22.33694, lon: 31.62556, elev: null,
    note: { es: "Templos de Ramsés II (siglo XIII a. C.) a orillas del lago Nasser (Egipto). Hacia el 22 de febrero y el 22 de octubre, el Sol naciente entra hasta el santuario. Entre 1964 y 1968 se trasladaron más arriba para salvarlos de la presa de Asuán.", en: "Temples of Ramesses II (13th century BCE) on the shore of Lake Nasser (Egypt). Around 22 February and 22 October the rising Sun reaches the sanctuary. They were moved uphill in 1964–1968 to save them from the Aswan Dam." } },
  { id: "karnak", region: "world", wiki: { es: "Karnak", en: "Karnak" }, name: { es: "Karnak", en: "Karnak" }, lat: 25.718333, lon: 32.658333, elev: null,
    note: { es: "El gran templo de Amón en Luxor (Egipto): su eje mira hacia donde sale el Sol en el solsticio de invierno.", en: "The great temple of Amun at Luxor (Egypt): its axis points to the winter solstice sunrise." } },
  { id: "angkorwat", region: "world", wiki: { es: "Angkor_Wat", en: "Angkor_Wat" }, name: { es: "Angkor Wat", en: "Angkor Wat" }, lat: 13.4125, lon: 103.866667, elev: null,
    note: { es: "Templo jemer del siglo XII (Camboya). En los equinoccios, desde la entrada oeste, el Sol sale sobre la torre central.", en: "Khmer temple from the 12th century (Cambodia). At the equinoxes, seen from the western entrance, the Sun rises over the central tower." } },
  { id: "maeshowe", region: "world", wiki: { es: "Maeshowe", en: "Maeshowe" }, name: { es: "Maeshowe", en: "Maeshowe" }, lat: 58.9966, lon: -3.1882, elev: null,
    note: { es: "Tumba de corredor neolítica de las Orcadas (Escocia): las semanas del solsticio de invierno, el Sol poniente entra por el pasillo y alumbra la pared del fondo.", en: "Neolithic chambered tomb in Orkney (Scotland): in the weeks around the winter solstice the setting Sun shines down the passage onto the back wall." } },
  { id: "mnajdra", region: "world", wiki: { es: "Mnajdra", en: "Mnajdra" }, name: { es: "Mnajdra", en: "Mnajdra" }, lat: 35.826667, lon: 14.436389, elev: null,
    note: { es: "Templos megalíticos de Malta: en los equinoccios, el Sol naciente entra por la puerta del templo inferior a lo largo de su eje, y en los solsticios toca los bordes de sus losas.", en: "Megalithic temples in Malta: at the equinoxes the rising Sun shines through the doorway of the lower temple along its axis, and at the solstices it touches the edges of its slabs." } },
  { id: "petra", region: "wonders", wiki: { es: "Petra", en: "Petra" }, name: { es: "Petra", en: "Petra" }, lat: 30.328611, lon: 35.441944, elev: null,
    note: { es: "Ciudad nabatea tallada en la roca (Jordania). Una de las siete maravillas modernas (2007).", en: "Nabataean city carved into the rock (Jordan). One of the New Seven Wonders (2007)." } },
  { id: "granmuralla", region: "wonders", wiki: { es: "Badaling", en: "Badaling" }, name: { es: "Gran Muralla · Badaling", en: "Great Wall · Badaling" }, lat: 40.35428, lon: 116.00649, elev: null,
    note: { es: "El tramo de Badaling, el más visitado de la Gran Muralla, al norte de Pekín (China). Una de las siete maravillas modernas (2007).", en: "The Badaling section, the most visited part of the Great Wall, north of Beijing (China). One of the New Seven Wonders (2007)." } },
  { id: "coliseo", region: "wonders", wiki: { es: "Coliseo", en: "Colosseum" }, name: { es: "Coliseo de Roma", en: "Colosseum, Rome" }, lat: 41.890278, lon: 12.492222, elev: null,
    note: { es: "Anfiteatro del siglo I en Roma (Italia). Una de las siete maravillas modernas (2007).", en: "1st-century amphitheatre in Rome (Italy). One of the New Seven Wonders (2007)." } },
  { id: "cristoredentor", region: "wonders", wiki: { es: "Cristo_Redentor", en: "Christ_the_Redeemer_(statue)" }, name: { es: "Cristo Redentor", en: "Christ the Redeemer" }, lat: -22.951916, lon: -43.210464, elev: null,
    note: { es: "Estatua de 1931 en la cima del Corcovado, sobre Río de Janeiro (Brasil). Una de las siete maravillas modernas (2007).", en: "1931 statue on top of Corcovado, above Rio de Janeiro (Brazil). One of the New Seven Wonders (2007)." } },
  { id: "tajmahal", region: "wonders", wiki: { es: "Taj_Mahal", en: "Taj_Mahal" }, name: { es: "Taj Mahal", en: "Taj Mahal" }, lat: 27.175, lon: 78.041944, elev: null,
    note: { es: "Mausoleo mogol del siglo XVII en Agra (India). Una de las siete maravillas modernas (2007).", en: "17th-century Mughal mausoleum in Agra (India). One of the New Seven Wonders (2007)." } },
];

/** Orden de los grupos de la lista desplegable de sitios. */
export const SITE_REGIONS = ["ec", "am", "world", "wonders"];
/** Sitios agrupados por región, cada grupo en orden alfabético del idioma de la app. */
export function sitesByRegion(lang = "es") {
  return SITE_REGIONS.map((r) => ({ region: r, sites: SITES.filter((s) => s.region === r).sort((a, b) => (a.name[lang] || a.name.es).localeCompare(b.name[lang] || b.name.es, lang)) }));
}

/** Página de Wikipedia del sitio (comprobadas el 18-nov-2026), en el idioma de la app. */
// (si no hay artículo en español, el de la Wikipedia en inglés; sin ninguno, sin enlace)
export const siteUrl = (site, lang = "es") => {
  if (!site || !site.wiki) return null;
  const l = lang === "en" || !site.wiki.es ? "en" : "es";
  return site.wiki[l] ? `https://${l}.wikipedia.org/wiki/${site.wiki[l]}` : null;
};

/** Texto sin tildes ni mayúsculas, para comparar. */
export const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Sitios cuyo nombre (en cualquier idioma) contiene el texto buscado. */
export function searchSites(q) {
  const f = fold(q);
  if (f.length < 2) return [];
  return SITES.filter((s) => fold(s.name.es).includes(f) || fold(s.name.en).includes(f) || fold(s.id).includes(f.replace(/\s+/g, "")));
}

/** URL de la búsqueda (8 resultados, en el idioma de la app). */
export function geocodeUrl(q, lang = "es") {
  const p = new URLSearchParams({ name: String(q).trim(), count: "8", language: lang === "en" ? "en" : "es", format: "json" });
  return `${GEOCODER}?${p}`;
}

/** Respuesta de Open-Meteo → [{ name, lat, lon, elev, region, country, cc, peak? }] (sin duplicados por nombre y
 * lugar). `peak` es el radio (m) en el que buscar la cumbre si el resultado es una montaña. */
export function parseGeocode(json) {
  const out = [], seen = new Set();
  for (const r of (json && json.results) || []) {
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude) || !r.name) continue;
    const key = `${r.name}|${r.latitude.toFixed(2)}|${r.longitude.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: r.name, lat: +r.latitude.toFixed(4), lon: +r.longitude.toFixed(4), elev: Number.isFinite(r.elevation) ? Math.round(r.elevation) : null,
      region: r.admin1 || null, country: r.country || null, cc: r.country_code || null,
      ...(PEAK_CODES[r.feature_code] ? { peak: PEAK_CODES[r.feature_code], kind: r.feature_code === "VLC" ? "volcano" : "peak" } : {}) });
  }
  return out;
}

/** URL de Photon solo para cumbres y volcanes. Siempre en inglés (Photon no tiene español): así el Everest no
 * sale como «珠穆朗玛峰» ni el Fuji como «富士山»; el país se traduce aparte con su código (countryName). */
export function photonUrl(q) {
  const p = new URLSearchParams({ q: String(q).trim(), limit: "8", lang: "en" });
  return `${PHOTON}?${p}&osm_tag=natural:peak&osm_tag=natural:volcano`;
}

/** Nombre del país en el idioma de la app a partir de su código ISO («JP» → «Japón»), o `fallback`. */
export function countryName(cc, lang = "es", fallback = null) {
  try {
    if (cc && typeof Intl !== "undefined" && Intl.DisplayNames) return new Intl.DisplayNames([lang === "en" ? "en" : "es"], { type: "region" }).of(String(cc).toUpperCase()) || fallback;
  } catch { /* código raro */ }
  return fallback;
}

/** Respuesta de Photon → cumbres cuyo nombre (o su región: el Uhuru, en la región de Kilimanjaro) contiene lo
 * buscado. Photon es difuso: «Cayambe» trae «Catamba», que se descarta. */
const GENERIC = new Set(["volcan", "volcano", "vulkan", "cerro", "monte", "mount", "mt", "montana", "mountain", "nevado", "pico", "peak", "de", "del", "la", "el", "los", "las", "the", "of"]);
/** Palabras que distinguen un nombre («volcán de Fuego» → ["fuego"]): sin «volcán», «cerro», «de»… */
export const nameWords = (s) => fold(s).split(/[^a-z0-9]+/).filter((w) => w && !GENERIC.has(w));
export function parsePhoton(json, q, lang = "es") {
  const f = fold(q), qw = nameWords(q), out = [], seen = new Set();
  for (const ft of (json && json.features) || []) {
    const pr = ft && ft.properties, c = ft && ft.geometry && ft.geometry.coordinates;
    if (!pr || !pr.name || !Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    // vale si el nombre (o la región) contiene lo buscado tal cual o todas sus palabras propias: «volcán de fuego»
    // encuentra «Fuego Volcano»
    const hay = `${fold(pr.name)} ${fold(pr.state)}`;
    if (!fold(pr.name).includes(f) && !fold(pr.state).includes(f) && !(qw.length && qw.every((w) => hay.includes(w)))) continue;
    const key = `${fold(pr.name)}|${c[1].toFixed(2)}|${c[0].toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // «Fuego Volcano» → «Volcán Fuego» (Photon solo da el nombre en inglés)
    const shown = lang !== "en" && /^(.+)\s+Volcano$/i.test(pr.name) ? `Volcán ${pr.name.replace(/\s+Volcano$/i, "")}` : pr.name;
    out.push({ name: shown, lat: +c[1].toFixed(5), lon: +c[0].toFixed(5), elev: null, region: pr.state || null, country: countryName(pr.countrycode, lang, pr.country || null),
      cc: pr.countrycode || null, peak: OSM_PEAK_R, kind: pr.osm_value === "volcano" ? "volcano" : "peak", osm: true });
  }
  return out;
}

/**
 * Ordena las cumbres de OSM de la más alta a la más baja con el modelo de terreno (/api/elevation): entre las
 * homónimas, primero la famosa (el Everest de Nepal, no la loma de Indiana). Les pone `elevModel` (m). Si el
 * servidor no responde en `timeoutMs`, las deja como venían.
 */
export async function rankPeaks(peaks, { api = "", fetchImpl = (typeof fetch !== "undefined" ? fetch : null), signal, timeoutMs = 3000 } = {}) {
  if (!peaks.length || !fetchImpl) return peaks;
  const pts = peaks.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join(";");
  const ask = fetchImpl(`${api}/api/elevation?pts=${encodeURIComponent(pts)}`, signal ? { signal } : undefined)
    .then(async (r) => (r.ok ? (await r.json()).heights : null)).catch(() => null);
  const h = await Promise.race([ask, new Promise((ok) => setTimeout(() => ok(null), timeoutMs))]);
  if (!Array.isArray(h) || h.length !== peaks.length) return peaks;
  return peaks.map((p, i) => ({ ...p, elevModel: Number.isFinite(h[i]) ? Math.round(h[i]) : null }))
    .sort((a, b) => (b.elevModel ?? -1e9) - (a.elevModel ?? -1e9));
}

const kmBetween = (a, b) => {
  const dy = (a.lat - b.lat) * 111.2, dx = (a.lon - b.lon) * 111.2 * Math.cos(a.lat * Math.PI / 180);
  return Math.hypot(dx, dy);
};
/** Une las dos listas: una montaña de GeoNames con su pico de OSM a menos de 6 km (mismo nombre) se cambia por
 * este, que está en la cima; si ninguna se cambió, el pico más alto de OSM va segundo; los demás, al final.
 * Como mucho `max`. */
export function mergePeaks(geo, osm, max = 10) {
  const used = new Set();
  const out = geo.map((g) => {
    if (!g.peak) return g;
    const i = osm.findIndex((o, k) => !used.has(k) && kmBetween(g, o) < 6 && (fold(o.name).includes(fold(g.name)) || fold(g.name).includes(fold(o.name))));
    if (i < 0) return g;
    used.add(i);
    return { ...osm[i], region: osm[i].region || g.region, country: osm[i].country || g.country };
  });
  // la cumbre más alta que queda va en segundo lugar (tras el primer resultado de GeoNames, a menudo un pueblo
  // homónimo): si no, con ocho pueblos llamados «Fuji», el monte Fuji quedaba fuera de la lista
  const rest = osm.filter((o, k) => !used.has(k));
  if (rest.length && !out.some((r) => r.osm)) out.splice(Math.min(1, out.length), 0, rest.shift());
  out.push(...rest);
  return out.slice(0, max);
}

/** Una línea para mostrar un resultado: «Comunidad de Madrid, España · 665 m» o «Volcán · Pichincha, Ecuador». */
export function placeLine(p, lang = "es") {
  const parts = [p.region, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const fmt = (v) => v.toLocaleString(lang === "es" ? "es" : "en-US", { useGrouping: "always" });
  const el = p.elev != null && !p.peak ? `${fmt(p.elev)} m` : p.elevModel != null ? `≈ ${fmt(p.elevModel)} m` : null;
  const kind = p.kind ? (TP[lang] || TP.es)[p.kind] : null;
  return [kind, parts.join(", "), el].filter(Boolean).join(" · ");
}

const cache = new Map();
/** Busca lugares del mundo (≥ 2 letras). Rechaza con Error si el servicio falla. */
export function searchPlaces(q, lang = "es", { fetchImpl = (typeof fetch !== "undefined" ? fetch : null), signal, api = "" } = {}) {
  const key = `${lang}|${fold(q)}`;
  if (fold(q).length < 2) return Promise.resolve([]);
  if (cache.has(key)) return cache.get(key);
  if (!fetchImpl) return Promise.reject(new Error("sin red"));
  const opt = signal ? { signal } : undefined;
  const geo = fetchImpl(geocodeUrl(q, lang), opt).then(async (r) => {
    let body = null;
    try { body = await r.json(); } catch { /* no JSON */ }
    if (!r.ok) throw new Error((body && body.reason) || `HTTP ${r.status}`);
    return parseGeocode(body);
  });
  // las cumbres de OSM son un extra: si Photon falla, se busca igual
  const osm = fetchImpl(photonUrl(q), opt).then(async (r) => (r.ok ? parsePhoton(await r.json(), q, lang) : []))
    .then((list) => rankPeaks(list, { api, fetchImpl, signal }))
    .catch((e) => { if (e && e.name === "AbortError") throw e; return []; });
  const p = Promise.allSettled([geo, osm]).then(([g, o]) => {
    const peaks = o.status === "fulfilled" ? o.value : [];
    if (g.status === "rejected") { if (peaks.length) return peaks; throw g.reason; }
    return mergePeaks(g.value, peaks);
  });
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

export const TP = {
  es: {
    searchTitle: "Busca un lugar del mundo",
    placeholder: "Ciudad, pueblo o sitio…",
    searchAria: "Buscar un lugar por su nombre",
    searching: "Buscando…",
    none: "Sin resultados. Prueba con otro nombre o escribe las coordenadas abajo.",
    error: "No se pudo buscar ahora (Open-Meteo). Prueba más tarde o escribe las coordenadas.",
    sitesTitle: "Sitios astronómicos y arqueológicos",
    sitesHint: "Teseo dibuja las montañas que los rodean y, en algunos, también el monumento; donde la posición es aproximada, lo dice.",
    sitesPick: "Elige un sitio…",
    sitesGroups: { ec: "Ecuador", am: "América", world: "Resto del mundo", wonders: "Siete maravillas modernas" },
    siteMore: "Saber más en Wikipedia",
    source: "Búsqueda: Open-Meteo, con los nombres de GeoNames (CC BY 4.0); cumbres y volcanes: Photon (Komoot) sobre OpenStreetMap (ODbL). Al elegir una montaña te pone en su cumbre, según el modelo de terreno.",
    site: "Sitio",
    volcano: "Volcán",
    peak: "Cumbre",
  },
  en: {
    searchTitle: "Search any place in the world",
    placeholder: "City, town or site…",
    searchAria: "Search a place by name",
    searching: "Searching…",
    none: "No results. Try another name or type the coordinates below.",
    error: "Couldn't search right now (Open-Meteo). Try later or type the coordinates.",
    sitesTitle: "Astronomical and archaeological sites",
    sitesHint: "Teseo draws the mountains around them and, at some, the monument too; where a position is approximate, it says so.",
    sitesPick: "Choose a site…",
    sitesGroups: { ec: "Ecuador", am: "Americas", world: "Rest of the world", wonders: "New Seven Wonders" },
    siteMore: "Learn more on Wikipedia",
    source: "Search: Open-Meteo, with GeoNames place names (CC BY 4.0); summits and volcanoes: Photon (Komoot) on OpenStreetMap (ODbL). Picking a mountain puts you on its summit, from the terrain model.",
    site: "Site",
    volcano: "Volcano",
    peak: "Summit",
  },
};
