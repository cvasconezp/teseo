// Fichas de los monumentos (MonSheet.jsx): qué son, qué se sabe y qué se discute, con sus fuentes. Se prefieren
// organismos del Estado e investigación científica; lo que es cálculo de Teseo se dice aparte. Clave: id de la pieza.
export const MON_INFO = {
  intihuatana: {
    kind: { es: "Roca tallada · Machu Picchu", en: "Carved rock · Machu Picchu" },
    facts: {
      es: [["Alto", "1,80 m (en el escaneo, 1,68 m sobre el piso)"], ["Material", "granito de la propia cima"], ["Nombre", "dado por Squier en 1877; Bingham lo adoptó"], ["En quechua", "«amarradero del Sol»"]],
      en: [["Height", "1.80 m (in the scan, 1.68 m above the floor)"], ["Material", "granite of the summit itself"], ["Name", "given by Squier in 1877; adopted by Bingham"], ["In Quechua", "“hitching post of the Sun”"]],
    },
    body: {
      es: [
        "Es una escultura tallada en la roca de la cima, con forma de pirámide trunca y un prisma vertical. En el siglo XVI, «yntip huactanan» se traducía como «lugar donde se da bien el sol»; «amarradero del Sol» es la lectura moderna.",
        "Su función se discute. Se la ha visto como gnomon para seguir la sombra del mediodía, más larga en invierno y más corta en verano (Curatola); como parte del culto a las montañas, en el cruce de las líneas Huayna Picchu–Salkantay y Verónica–San Miguel (Reinhard); y como altar para «amarrar» simbólicamente al Sol y alargar el día (Kauffmann Doig).",
        "La investigación reciente es prudente: la opinión dominante entre los especialistas es que no sirvió de gnomon para fijar fechas, y la única orientación astronómica confirmada con datos arqueológicos es la que apunta a Llactapata (Ziółkowski y Kościuk, 2022). No tiene marcas donde se leyera la sombra.",
      ],
      en: [
        "It is a sculpture carved from the bedrock of the summit, shaped as a truncated pyramid with an upright prism. In the 16th century “yntip huactanan” was translated as “place where the sun shines well”; “hitching post of the Sun” is the modern reading.",
        "Its function is debated. It has been seen as a gnomon for following the noon shadow, longest in winter and shortest in summer (Curatola); as part of mountain worship, at the crossing of the Huayna Picchu–Salkantay and Verónica–San Miguel lines (Reinhard); and as an altar to symbolically “tie” the Sun and lengthen the day (Kauffmann Doig).",
        "Recent research is cautious: the prevailing specialist view is that it did not work as a gnomon for fixing dates, and the only astronomical orientation confirmed by archaeological data is the one towards Llactapata (Ziółkowski and Kościuk, 2022). It bears no marks where a shadow could be read.",
      ],
    },
    teseo: {
      es: "Lo que puedes comprobar en Teseo (cálculo propio, con la posición real del Sol): a 13,16° de latitud sur, el Sol pasa por el cénit al mediodía solar hacia el 28 de octubre y el 13 de febrero; esos días el prisma casi no da sombra. En los equinoccios no: el Sol culmina a unos 77° de altura, al norte, y la sombra cae hacia el sur. Adelanta la fecha en «Tiempo» y mira la sombra. La forma viene del escaneo láser de 2009; su orientación tiene unos 2° a 7° de margen, así que sirve para ver el fenómeno, no para medir alineaciones finas. Con cielo cubierto no hay sombras.",
      en: "What you can check in Teseo (our own calculation, with the Sun’s real position): at latitude 13.16° S the Sun crosses the zenith at solar noon around 28 October and 13 February; on those days the prism casts almost no shadow. Not at the equinoxes: the Sun culminates about 77° high, to the north, and the shadow falls south. Step the date in “Time” and watch the shadow. The shape comes from the 2009 laser scan; its orientation is good to about 2°–7°, so it shows the phenomenon but is not meant for measuring fine alignments. Under an overcast sky there are no shadows.",
    },
    sources: [
      { label: "L. Millones, «Machu Picchu. Entre el cielo y la tierra», en Machupicchu. Investigaciones interdisciplinarias, t. I (Ministerio de Cultura del Perú)", url: "https://www.machupicchu.gob.pe/wp-content/uploads/2022/02/02-Art.-Machu-Picchu.-Entre-el-cielo-y-la-tierra.pdf" },
      { label: "F. Kauffmann Doig, «Machu Picchu: sobre su función», ibíd., t. II (2020)", url: "https://www.machupicchu.gob.pe/wp-content/uploads/2022/02/25-Art.-Machu-Picchu-sobre-su-funci%C3%B3n.pdf" },
      { label: "M. Ziółkowski y J. Kościuk, «Astronomical Observations at Machu Picchu: Facts, Hypothesis and Wishful Thinking», en Machu Picchu in Context (Springer, 2022)", url: "https://link.springer.com/chapter/10.1007/978-3-030-92766-0_5" },
      { label: "G. Magli, «At the other end of the sun’s path. A new interpretation of Machu Picchu» (arXiv:0904.4882)", url: "https://arxiv.org/abs/0904.4882" },
      { label: "Forma: escaneo láser de 2009 · Instituto Nacional de Cultura, CAST (University of Arkansas) y Cotsen Institute (UCLA) · CC BY-NC 3.0", url: "https://gmv.cast.uark.edu/region-data/region/peru/machu-picchu-peru-intiwatana-2/" },
    ],
  },
};
// Fuentes que se repiten
const SRC = {
  millones: { label: "L. Millones, «Machu Picchu. Entre el cielo y la tierra», en Machupicchu. Investigaciones interdisciplinarias, t. I (Ministerio de Cultura del Perú)", url: "https://www.machupicchu.gob.pe/wp-content/uploads/2022/02/02-Art.-Machu-Picchu.-Entre-el-cielo-y-la-tierra.pdf" },
  zk: { label: "M. Ziółkowski y J. Kościuk, «Astronomical Observations at Machu Picchu: Facts, Hypothesis and Wishful Thinking», en Machu Picchu in Context (Springer, 2022)", url: "https://link.springer.com/chapter/10.1007/978-3-030-92766-0_5" },
  magli: { label: "G. Magli, «At the other end of the sun’s path. A new interpretation of Machu Picchu» (arXiv:0904.4882)", url: "https://arxiv.org/abs/0904.4882" },
  nasa: { label: "NASA, Sun-Earth Day: «Ancient Observatories. Machu Picchu»", url: "https://science.gsfc.nasa.gov/attic/sunearthday.nasa.gov/2005/locations/machupichu.htm" },
  jica: { label: "JICA, estudio de conservación de Machu Picchu (levantamiento del Templo del Sol y del Templo Principal)", url: "https://openjicareport.jica.go.jp/pdf/11001963_04.pdf" },
  puelles: { label: "Puelles Escalante, «Ingeniería inka de Machupijchu» (Ministerio de Cultura del Perú)", url: "https://www.machupicchu.gob.pe/wp-content/uploads/2022/02/15-Art.-Ingenier%C3%ADa-inka-de-Machupijchu.pdf" },
};
MON_INFO["mp-torreon"] = {
  kind: { es: "Recinto de muro curvo · Machu Picchu", en: "Curved-wall building · Machu Picchu" },
  facts: {
    es: [["Muro", "3,2 m de alto (medido por JICA)"], ["Piso", "2.429,59 m s. n. m. (JICA)"], ["Sillería", "fina, sobre una roca tallada"], ["También llamado", "Templo del Sol"]],
    en: [["Wall", "3.2 m high (surveyed by JICA)"], ["Floor", "2,429.59 m a.s.l. (JICA)"], ["Masonry", "fine, around a carved rock"], ["Also called", "Temple of the Sun"]],
  },
  body: {
    es: [
      "Recinto en forma de P, de sillería fina, que rodea una roca tallada. Es la estructura de Machu Picchu con mejor respaldo como lugar de observación del cielo.",
      "Dearborn y White propusieron que sirvió para observar con precisión el solsticio de junio: el Sol naciente de esos días entra por su ventana y su avance podía seguirse con la sombra de un cordel tendido en ella. También se habrían observado desde aquí las Pléyades y Escorpio, y la proximidad del paso del Sol por el cénit (Magli; Ziółkowski y Kościuk).",
      "Para muchos especialistas, el Sol del solsticio de invierno marcaba aquí el inicio del Inti Raymi (Millones). El estudio de 2022 revisa estas propuestas una por una y distingue lo comprobado de lo que sigue siendo hipótesis.",
    ],
    en: [
      "A P-shaped building of fine masonry that encloses a carved rock. It is the structure at Machu Picchu best supported as a place for watching the sky.",
      "Dearborn and White proposed that it was used to observe the June solstice precisely: the rising Sun of those days enters through its window, and its progress could be followed with the shadow of a cord stretched across it. The Pleiades and Scorpius, and the approach of the Sun’s zenith passage, would also have been observed from here (Magli; Ziółkowski and Kościuk).",
      "For many specialists, the winter-solstice Sun marked here the start of Inti Raymi (Millones). The 2022 study reviews these proposals one by one and separates what is confirmed from what remains hypothesis.",
    ],
  },
  teseo: {
    es: "En Teseo: ve al punto «Torreón · Templo del Sol», pon la fecha en el 21 de junio y adelanta la hora hasta el amanecer para ver por dónde sale el Sol sobre las montañas reales. La forma del recinto es la de la maqueta del Ministerio de Cultura: no tiene el detalle de la ventana, así que el rayo de luz no se reproduce.",
    en: "In Teseo: go to the “Torreón · Temple of the Sun” stop, set the date to 21 June and step the time to dawn to see where the Sun rises over the real mountains. The building’s shape is that of the Ministry of Culture model: it lacks the detail of the window, so the ray of light is not reproduced.",
  },
  sources: [SRC.zk, SRC.magli, SRC.millones, SRC.jica],
};
MON_INFO["mp-tres-ventanas"] = {
  kind: { es: "Templo · Plaza Sagrada de Machu Picchu", en: "Temple · Sacred Plaza of Machu Picchu" },
  facts: {
    es: [["Muro", "11 m de largo, con tres ventanas"], ["Planta", "tres muros, abierto hacia la plaza"]],
    en: [["Wall", "11 m long, with three windows"], ["Plan", "three walls, open towards the plaza"]],
  },
  body: {
    es: ["Cierra el lado este de la Plaza Sagrada. Se abre hacia la plaza y mira hacia donde se pone el Sol en el solsticio de junio; la plaza, cerrada por tres lados, queda abierta al oeste con una orientación de 245° (NASA, Sun-Earth Day)."],
    en: ["It closes the east side of the Sacred Plaza. It opens onto the plaza and faces the June-solstice sunset; the plaza, enclosed on three sides, is open to the west with an orientation of 245° (NASA, Sun-Earth Day)."],
  },
  teseo: {
    es: "En Teseo: la pieza es una reconstrucción con medidas publicadas (no un levantamiento) y su giro es aproximado, así que sirve para situarse, no para comprobar la alineación al grado.",
    en: "In Teseo: the piece is a reconstruction from published measurements (not a survey) and its rotation is approximate, so it helps you get your bearings but not to check the alignment to the degree.",
  },
  sources: [SRC.nasa, SRC.puelles],
};
MON_INFO["mp-templo-principal"] = {
  kind: { es: "Templo · Plaza Sagrada de Machu Picchu", en: "Temple · Sacred Plaza of Machu Picchu" },
  facts: {
    es: [["Planta", "11 × 8 m, tres muros"], ["Plaza Sagrada", "2.436,3 a 2.437,2 m s. n. m. (JICA)"], ["Coronación del muro", "2.440,0 a 2.440,6 m (JICA)"], ["Sillería", "fina, de grandes bloques"]],
    en: [["Plan", "11 × 8 m, three walls"], ["Sacred Plaza", "2,436.3 to 2,437.2 m a.s.l. (JICA)"], ["Top of the wall", "2,440.0 to 2,440.6 m (JICA)"], ["Masonry", "fine, with large blocks"]],
  },
  body: {
    es: ["Recinto de tres muros de sillería fina, abierto hacia la Plaza Sagrada, al pie de la colina del Intihuatana. El levantamiento de JICA documenta su planta, el alzado de sus muros y el asiento que ha sufrido uno de ellos."],
    en: ["A three-walled building of fine masonry, open onto the Sacred Plaza, at the foot of the Intihuatana hill. The JICA survey documents its plan, the elevation of its walls and the settlement one of them has suffered."],
  },
  teseo: {
    es: "En Teseo: reconstrucción con las medidas publicadas. En la maqueta del sitio esta parte no viene, así que el templo es una pieza propia apoyada en su suelo; su nivel no coincide con las cotas de JICA.",
    en: "In Teseo: a reconstruction from the published measurements. The site model does not include this part, so the temple is a separate piece resting on its ground; its level does not match the JICA figures.",
  },
  sources: [SRC.jica, SRC.puelles],
};
// ───────────── resto de Machu Picchu ─────────────
Object.assign(SRC, {
  promperu: { label: "PromPerú, folleto oficial de la llaqta de Machupicchu (sectores y conjuntos)", url: "https://repositorio.promperu.gob.pe/bitstreams/7a093af6-257f-4e44-ab0e-d09723cf6d4b/download" },
  circuitos: { label: "Ministerio de Cultura del Perú, plano general y circuitos de visita de la llaqta de Machupicchu", url: "https://www.machupicchu.gob.pe/wp-content/uploads/2024/05/Plano-General-.pdf" },
  reinhard: { label: "J. Reinhard, «Machu Picchu: el centro sagrado», en Machupicchu. Investigaciones interdisciplinarias (Ministerio de Cultura del Perú)", url: "https://www.machupicchu.gob.pe/wp-content/uploads/2022/02/08-Art.-Machu-Picchu-el-centro-sagrado.pdf" },
});
const one = (kindEs, kindEn, es, en, sources, teseo = null, facts = null) => ({ kind: { es: kindEs, en: kindEn }, facts, body: { es: [].concat(es), en: [].concat(en) }, teseo, sources });
MON_INFO["mp-condor"] = one("Conjunto ceremonial · Machu Picchu", "Ceremonial group · Machu Picchu",
  "Área ceremonial donde una roca tallada en el suelo y los afloramientos que la rodean se leen como la figura de un cóndor. Tiene pasajes subterráneos relacionados con el culto al agua (PromPerú).",
  "A ceremonial area where a rock carved on the ground and the outcrops around it read as the figure of a condor. It has underground passages related to the worship of water (PromPerú).",
  [SRC.promperu, SRC.circuitos]);
MON_INFO["mp-casa-inca"] = one("Residencia · Machu Picchu", "Residence · Machu Picchu",
  "Conjunto situado estratégicamente respecto a las fuentes de agua y al Templo del Sol, con elementos claramente asociados al culto religioso (PromPerú). La llaqta tiene 16 fuentes ceremoniales en esta zona.",
  "A group strategically placed in relation to the water fountains and the Temple of the Sun, with elements clearly associated with religious worship (PromPerú). The llaqta has 16 ceremonial fountains in this area.",
  [SRC.promperu, SRC.circuitos]);
MON_INFO["mp-tres-portadas"] = one("Conjunto de recintos · Machu Picchu", "Group of buildings · Machu Picchu",
  "Lo forman tres unidades del tipo kancha (recintos en torno a un patio), cada una con su vano de acceso: las tres portadas que le dan nombre (PromPerú).",
  "It is made of three kancha-type units (buildings around a courtyard), each with its own doorway: the three portals that give it its name (PromPerú).",
  [SRC.promperu, SRC.circuitos]);
MON_INFO["mp-espejos"] = one("Recinto con dos cuencos tallados · Machu Picchu", "Room with two carved basins · Machu Picchu",
  ["También llamado Sala de los Morteros: en su piso hay dos cuencos circulares tallados en la roca. Se propuso que, llenos de agua, servían de espejos para observar el cielo.",
    "Kościuk y Ziółkowski midieron el recinto con escáner láser y lo modelaron: concluyen que en época inca no pudo cumplir la función astronómica propuesta, entre otras razones porque estaba techado, y descartan también el uso de los cuencos como espejos para observar el cielo. Su uso original sigue sin aclararse."],
  ["Also called the Room of the Mortars: two circular basins are carved in the rock of its floor. It was proposed that, filled with water, they served as mirrors for watching the sky.",
    "Kościuk and Ziółkowski measured the room with a laser scanner and modelled it: they conclude that in Inca times it could not have fulfilled the proposed astronomical function, among other reasons because it was roofed, and they also rule out the use of the basins as mirrors for watching the sky. Their original use remains unclear."],
  [{ label: "J. Kościuk y M. Ziółkowski, «The Sala de los Morteros at Machu Picchu: another precise astronomical instrument of the Incas?», Estudios Latinoamericanos", url: "https://estudioslatinoamericanos.pl/index.php/estudios/article/view/377" }, SRC.zk, SRC.circuitos]);
MON_INFO["mp-roca-sagrada"] = one("Monolito · Machu Picchu", "Monolith · Machu Picchu",
  "Gran roca apoyada sobre un pedestal en el extremo norte de la llaqta, entre dos wayranas (recintos de tres muros), en el punto donde empieza el camino al Waynapicchu. Es una de las paradas del circuito oficial de visita.",
  "A large rock set on a pedestal at the northern end of the llaqta, between two wayranas (three-walled buildings), where the path to Waynapicchu starts. It is one of the stops on the official visitor circuit.",
  [SRC.circuitos, SRC.reinhard],
  { es: "En Teseo: la roca es una pieza propia (3 m de alto y 7 m de ancho, forma aproximada); los dos recintos con techo de paja vienen de la maqueta.", en: "In Teseo: the rock is a separate piece (3 m high and 7 m wide, approximate shape); the two thatched buildings come from the site model." });
MON_INFO["mp-plaza"] = one("Explanada · Machu Picchu", "Esplanade · Machu Picchu",
  "La explanada que separa el sector de los templos (al oeste, con la Plaza Sagrada y la pirámide del Intihuatana) del sector de recintos y talleres (al este).",
  "The esplanade that separates the temple sector (to the west, with the Sacred Plaza and the Intihuatana pyramid) from the sector of dwellings and workshops (to the east).",
  [SRC.circuitos, SRC.promperu]);

// ───────────── otros sitios ─────────────
const U = (n, name) => ({ label: `UNESCO, Lista del Patrimonio Mundial: ${name}`, url: `https://whc.unesco.org/en/list/${n}` });
// Teotihuacan
{ const src = [U(414, "Ciudad prehispánica de Teotihuacan"), { label: "INAH, Zona Arqueológica de Teotihuacan", url: "https://lugares.inah.gob.mx/en/node/4528" }];
  MON_INFO.sol = one("Pirámide · Teotihuacan (México)", "Pyramid · Teotihuacan (Mexico)",
    ["La mayor construcción de Teotihuacan, ciudad levantada entre los siglos I y VII. Según la UNESCO mide 225 × 222 m en la base. Hacia el siglo III ya estaban construidas la Pirámide del Sol, la de la Luna y la Calzada de los Muertos (INAH).",
      "La ciudad se ordena sobre un eje norte–sur, la Calzada de los Muertos, con sus monumentos dispuestos según principios geométricos y simbólicos (UNESCO)."],
    ["The largest building at Teotihuacan, a city built between the 1st and 7th centuries. According to UNESCO it measures 225 × 222 m at the base. By the 3rd century the Pyramids of the Sun and the Moon and the Avenue of the Dead had been built (INAH).",
      "The city is laid out on a north–south axis, the Avenue of the Dead, with its monuments arranged on geometric and symbolic principles (UNESCO)."],
    src, null, { es: [["Alto en Teseo", "65 m"], ["Base", "225 × 222 m (UNESCO)"]], en: [["Height in Teseo", "65 m"], ["Base", "225 × 222 m (UNESCO)"]] });
  MON_INFO.luna = one("Pirámide · Teotihuacan (México)", "Pyramid · Teotihuacan (Mexico)",
    "Cierra por el norte la Calzada de los Muertos, el eje de la ciudad. Es la segunda pirámide de Teotihuacan, construida, como la del Sol, hacia el siglo III (INAH).",
    "It closes the northern end of the Avenue of the Dead, the city’s axis. It is the second pyramid of Teotihuacan, built, like that of the Sun, by the 3rd century (INAH).",
    src, null, { es: [["Alto en Teseo", "43 m"]], en: [["Height in Teseo", "43 m"]] }); }
// Chichén Itzá
MON_INFO.castillo = one("Pirámide maya · Chichén Itzá (México)", "Maya pyramid · Chichén Itzá (Mexico)",
  ["El Castillo o templo de Kukulcán se alza en la mayor ciudad maya-tolteca de Yucatán (UNESCO). En los días cercanos a los equinoccios, el Sol de la tarde proyecta sobre la alfarda norte una fila de triángulos de luz que, con la cabeza de serpiente de la base, dibujan el «descenso de Kukulcán» (INAH).",
    "La investigación matiza la fama del fenómeno: se ve durante varios días, antes y después del equinoccio, y con solo mirarlo no se puede fijar ninguna fecha con precisión; por eso se discute que deba llamarse «equinoccial» (Casares, INAH; Šprajc y Sánchez)."],
  ["El Castillo, or temple of Kukulcán, stands in the greatest Maya-Toltec city of Yucatán (UNESCO). On the days around the equinoxes the afternoon Sun casts a row of triangles of light on the northern balustrade which, with the serpent head at its base, draw the “descent of Kukulcán” (INAH).",
    "Research qualifies the fame of the phenomenon: it is visible for several days before and after the equinox, and no date can be fixed precisely just by watching it; that is why calling it “equinoctial” is disputed (Casares, INAH; Šprajc and Sánchez)."],
  [U(483, "Ciudad prehispánica de Chichén Itzá"), { label: "O. Casares Contreras, «Los estudios arqueoastronómicos de El Castillo de Chichén Itzá», Arqueología (INAH)", url: "https://revistas.inah.gob.mx/index.php/arqueologia/article/download/13161/14281/26315" }, { label: "I. Šprajc y P. Sánchez, sobre el fenómeno de luz y sombra de El Castillo (Arqueología Mexicana 149)", url: "https://iaps.zrc-sazu.si/sites/default/files/sprajcsol_chichen_dzibilchaltun_am149.pdf" }, { label: "INAH, boletín sobre el equinoccio en Chichén Itzá (2025)", url: "https://inah.gob.mx/images/boletines/2025/464/Boletin%20464.pdf" }],
  { es: "En Teseo: la pirámide es una forma simplificada, sin las alfardas ni las cabezas de serpiente, así que la serpiente de luz no se reproduce. Sí puedes ver por dónde baja el Sol esas tardes respecto a su cara norte.", en: "In Teseo: the pyramid is a simplified shape, without the balustrades or the serpent heads, so the serpent of light is not reproduced. You can see where the Sun goes down on those afternoons relative to its north face." },
  { es: [["Alto en Teseo", "24 m"], ["Época", "siglos VIII al XII"]], en: [["Height in Teseo", "24 m"], ["Period", "8th to 12th centuries"]] });
// Guiza
{ const src = [U(86, "Menfis y su necrópolis"), { label: "Encyclopaedia Britannica, «Pyramids of Giza»", url: "https://www.britannica.com/print/article/234470" }];
  MON_INFO.keops = one("Pirámide · Guiza (Egipto)", "Pyramid · Giza (Egypt)",
    "La Gran Pirámide, la más antigua y la mayor de las tres, levantada para Keops (Jufu), segundo rey de la IV dinastía. Cada lado de la base mide unos 230 m y su altura original era de 147 m; sus caras están orientadas con gran exactitud a los cuatro puntos cardinales (Britannica). Es la única de las siete maravillas del mundo antiguo que sigue en pie (UNESCO).",
    "The Great Pyramid, the oldest and largest of the three, built for Khufu (Cheops), second king of the 4th dynasty. Each side of the base measures about 230 m and its original height was 147 m; its faces are very accurately oriented to the four cardinal points (Britannica). It is the only surviving wonder of the ancient world (UNESCO).",
    src, { es: "En Teseo: activa los puntos cardinales y compara: sus aristas apuntan casi exactamente al norte, sur, este y oeste.", en: "In Teseo: turn on the cardinal points and compare: its edges point almost exactly north, south, east and west." },
    { es: [["Alto hoy", "138,5 m"], ["Alto original", "147 m"], ["Lado de la base", "230 m"]], en: [["Height today", "138.5 m"], ["Original height", "147 m"], ["Base side", "230 m"]] });
  MON_INFO.kefren = one("Pirámide · Guiza (Egipto)", "Pyramid · Giza (Egypt)",
    "La segunda pirámide de Guiza, de Kefrén (Jafra). Parece más alta que la de Keops porque está sobre terreno más elevado, pero es algo menor. Conserva en la cima parte de su revestimiento de caliza.",
    "The second pyramid of Giza, Khafre’s. It looks taller than Khufu’s because it stands on higher ground, but it is slightly smaller. It keeps part of its limestone casing at the top.",
    src, null, { es: [["Alto hoy", "136,4 m"]], en: [["Height today", "136.4 m"]] });
  MON_INFO.micerino = one("Pirámide · Guiza (Egipto)", "Pyramid · Giza (Egypt)",
    "La más meridional y la última en construirse, de Micerino (Menkaura), quinto rey de la IV dinastía: unos 109 m de lado y 66 m de altura al terminarse (Britannica).",
    "The southernmost and the last to be built, Menkaure’s, fifth king of the 4th dynasty: about 109 m per side and 66 m high when completed (Britannica).",
    src, null, { es: [["Alto hoy", "61 m"], ["Lado de la base", "109 m"]], en: [["Height today", "61 m"], ["Base side", "109 m"]] }); }
// Stonehenge
MON_INFO.stonehenge = one("Círculo de piedras · Inglaterra", "Stone circle · England",
  ["Empezó hacia el 3000 a. C. como un foso circular con terraplén. Los grandes sarsens del centro se levantaron hacia el 2500 a. C.: una herradura de cinco trilitos y, alrededor, un círculo que tuvo probablemente 30 piedras con dinteles (English Heritage).",
    "Los sarsens se colocaron para alinearse con el Sol: desde el centro, el día del solsticio de verano el Sol sale justo a la izquierda de la Piedra del Talón, al noreste; el mismo eje mira, al revés, a la puesta del solsticio de invierno. Un levantamiento láser mostró que las piedras que enmarcan ese eje son las mejor labradas (English Heritage)."],
  ["It began about 3000 BC as a circular ditch and bank. The great sarsens at the centre were raised about 2500 BC: a horseshoe of five trilithons and, around it, a circle that probably had 30 stones capped with lintels (English Heritage).",
    "The sarsens were placed to line up with the Sun: from the centre, on Midsummer’s Day the Sun rises just to the left of the Heel Stone, to the north-east; the same axis points the other way to the winter-solstice sunset. A laser survey showed that the stones framing that axis are the most carefully shaped (English Heritage)."],
  [{ label: "English Heritage, «Description of Stonehenge»", url: "https://www.english-heritage.org.uk/visit/places/stonehenge/history-and-stories/history/description/" }, { label: "English Heritage, «Celestial Stonehenge»", url: "https://www.english-heritage.org.uk/visit/places/stonehenge/things-to-do/stone-circle/celestial-stonehenge/" }],
  { es: "En Teseo: pon el 21 de junio y adelanta la hora hasta el amanecer, mirando al noreste; luego el 21 de diciembre al atardecer, mirando al suroeste. El modelo dibuja las piedras que siguen en pie, simplificadas.", en: "In Teseo: set 21 June and step the time to dawn, looking north-east; then 21 December at dusk, looking south-west. The model draws the stones still standing, simplified." });
// Newgrange
MON_INFO.newgrange = one("Tumba de corredor · Irlanda", "Passage tomb · Ireland",
  "Construida hacia el 3200 a. C. Sobre su entrada hay una abertura, la «caja del techo»: al amanecer de los días del solsticio de invierno, la luz del Sol entra por ella, recorre el corredor e ilumina la cámara durante unos 17 minutos (Office of Public Works). El arqueólogo M. J. O’Kelly redescubrió el fenómeno al excavar el sitio.",
  "Built about 3200 BC. Above its entrance there is an opening, the “roof box”: at dawn on the days of the winter solstice, sunlight enters through it, travels along the passage and lights the chamber for about 17 minutes (Office of Public Works). The archaeologist M. J. O’Kelly rediscovered the phenomenon while excavating the site.",
  [{ label: "Office of Public Works (Gobierno de Irlanda), solsticio de invierno en Newgrange", url: "https://www.gov.ie/en/office-of-public-works/press-releases/newgranges-ancient-secrets-revealed-join-us-for-live-streaming-of-the-winter-solstice/" }, { label: "National Museum of Ireland, «The Winter solstice at Newgrange»", url: "https://museum.ie/en-IE/Collections-Research/Irish-Antiquities-Division-Collections/Irish-Antiquities-Articles/The-Winter-solstice-at-Newgrange" }],
  { es: "En Teseo: pon el 21 de diciembre y adelanta la hora hasta el amanecer, mirando al sureste desde la entrada. El túmulo es una forma simplificada, sin el corredor.", en: "In Teseo: set 21 December and step the time to dawn, looking south-east from the entrance. The mound is a simplified shape, without the passage." },
  { es: [["Alto en Teseo", "13,5 m"], ["Época", "hacia el 3200 a. C."]], en: [["Height in Teseo", "13.5 m"], ["Period", "about 3200 BC"]] });
// Maeshowe
MON_INFO.maeshowe = one("Tumba de cámara · Orcadas (Escocia)", "Chambered cairn · Orkney (Scotland)",
  "Tumba neolítica bajo un túmulo de hierba. Durante las tres semanas anteriores y posteriores al solsticio de invierno, la luz del Sol poniente entra recta por su pasillo, de suave pendiente, e ilumina el fondo de la cámara central; los rayos se alinean con la Piedra de Barnhouse, un menhir al suroeste (Historic Environment Scotland).",
  "A Neolithic tomb under a grassy mound. For the three weeks before and after the winter solstice, the light of the setting Sun shines straight down its gently sloping passage and lights the back of the central chamber; the rays line up with the Barnhouse Stone, a standing stone to the south-west (Historic Environment Scotland).",
  [{ label: "Historic Environment Scotland, Maeshowe Chambered Cairn: historia", url: "https://www.historicenvironment.scot/visit-a-place/places/maeshowe-chambered-cairn/history/" }, { label: "Historic Environment Scotland, Maeshowe: la puesta del solsticio", url: "https://www.historicenvironment.scot/visit-a-place/places/maeshowe-chambered-cairn/getting-here/" }],
  { es: "En Teseo: pon una tarde de diciembre y mira al suroeste desde la entrada para ver por dónde se pone el Sol.", en: "In Teseo: set a December afternoon and look south-west from the entrance to see where the Sun sets." },
  { es: [["Diámetro", "35 m"], ["Alto", "7,3 m"]], en: [["Diameter", "35 m"], ["Height", "7.3 m"]] });
// Coliseo, Cristo, Taj Mahal
MON_INFO.coliseo = one("Anfiteatro · Roma (Italia)", "Amphitheatre · Rome (Italy)",
  "Anfiteatro del siglo I. La UNESCO lo cita entre los monumentos antiguos que dan a Roma un valor artístico incomparable, y recuerda que su restauración fue de las primeras que ayudaron a fijar los principios modernos de conservación.",
  "A 1st-century amphitheatre. UNESCO cites it among the ancient monuments that give Rome incomparable artistic value, and notes that its restoration was among the early projects that helped establish modern conservation principles.",
  [U(91, "Centro histórico de Roma")], null, { es: [["Planta", "188 × 156 m"], ["Alto", "48 m"]], en: [["Plan", "188 × 156 m"], ["Height", "48 m"]] });
MON_INFO.cristo = one("Estatua · Río de Janeiro (Brasil)", "Statue · Rio de Janeiro (Brazil)",
  "Estatua de 1931 en la cima del Corcovado. La UNESCO incluye el cerro, con su estatua, entre los elementos que componen el paisaje de Río de Janeiro inscrito como Patrimonio Mundial.",
  "A 1931 statue on the summit of Corcovado. UNESCO includes the mountain, with its statue, among the elements that make up the landscape of Rio de Janeiro inscribed as World Heritage.",
  [U(1100, "Río de Janeiro, paisajes cariocas entre la montaña y el mar")], null, { es: [["Figura", "30 m"], ["Pedestal", "8 m"], ["Brazos", "28 m de punta a punta"]], en: [["Figure", "30 m"], ["Pedestal", "8 m"], ["Arms", "28 m tip to tip"]] });
MON_INFO.tajmahal = one("Mausoleo · Agra (India)", "Mausoleum · Agra (India)",
  "Mausoleo de mármol blanco construido en Agra entre 1631 y 1648 por orden del emperador mogol Shah Jahan, en memoria de su esposa favorita (UNESCO).",
  "A white-marble mausoleum built in Agra between 1631 and 1648 by order of the Mughal emperor Shah Jahan, in memory of his favourite wife (UNESCO).",
  [U(252, "Taj Mahal")], null, { es: [["Alto de la cúpula", "73 m"], ["Construcción", "1631–1648"]], en: [["Dome height", "73 m"], ["Built", "1631–1648"]] });
// Abu Simbel, Karnak
MON_INFO["abusimbel-gran"] = one("Templo excavado en la roca · Egipto", "Rock-cut temple · Egypt",
  "Templo de Ramsés II, tallado en la roca por orden del faraón. Su trazado deja que la luz del Sol llegue dos veces al año hasta la cámara más profunda (UNESCO). Se salvó de las aguas del Nilo en la campaña internacional que la UNESCO dirigió entre 1960 y 1980: el templo se cortó en bloques y se reconstruyó más arriba.",
  "A temple of Ramses II, cut into the rock on the pharaoh’s orders. Its layout lets sunlight reach the innermost chamber twice a year (UNESCO). It was saved from the waters of the Nile in the international campaign led by UNESCO from 1960 to 1980: the temple was cut into blocks and rebuilt higher up.",
  [U(88, "Monumentos de Nubia, de Abu Simbel a Filae")],
  { es: "En Teseo: las fechas que se celebran hoy son hacia el 22 de febrero y el 22 de octubre. Ponlas al amanecer, frente a la fachada, y mira si el Sol sale en el eje del templo. La fachada es una forma simplificada, sin el interior.", en: "In Teseo: the dates celebrated today are around 22 February and 22 October. Set them at dawn, facing the façade, and see whether the Sun rises on the temple’s axis. The façade is a simplified shape, without the interior." },
  { es: [["Fachada", "30 m de alto"], ["Época", "siglo XIII a. C."]], en: [["Façade", "30 m high"], ["Period", "13th century BC"]] });
MON_INFO["karnak-pilono"] = one("Pilono de templo · Luxor (Egipto)", "Temple pylon · Luxor (Egypt)",
  "La entrada monumental del templo de Amón en Karnak. Tebas fue la ciudad del dios Amón y capital de Egipto en los Imperios Medio y Nuevo; el complejo de Karnak, iniciado en el Imperio Medio y ampliado después, está entre las mayores construcciones religiosas jamás levantadas (UNESCO).",
  "The monumental entrance to the temple of Amun at Karnak. Thebes was the city of the god Amun and capital of Egypt in the Middle and New Kingdoms; the Karnak complex, begun in the Middle Kingdom and later enlarged, is among the largest religious structures ever built (UNESCO).",
  [U(87, "Antigua Tebas y su necrópolis")],
  { es: "En Teseo: desde delante del pilono, en el eje del templo, pon el 21 de diciembre al amanecer para ver por dónde sale el Sol respecto al eje.", en: "In Teseo: from in front of the pylon, on the temple’s axis, set 21 December at dawn to see where the Sun rises relative to the axis." },
  { es: [["Ancho", "113 m"], ["Alto en Teseo", "31,65 m"]], en: [["Width", "113 m"], ["Height in Teseo", "31.65 m"]] });
// Angkor Wat
MON_INFO.angkorwat = one("Templo jemer · Camboya", "Khmer temple · Cambodia",
  ["Levantado en la primera mitad del siglo XII por el rey Suryavarman II (que reinó de 1113 a hacia 1150), es uno de los mayores edificios religiosos del mundo. A diferencia de casi todos los templos de Angkor, su entrada mira al oeste.",
    "Mirando desde la puerta oeste hacia el templo, al amanecer de los equinoccios el Sol sale justo sobre la torre central: lo propuso Pierre Paris en 1941 y lo describieron Stencel y otros en la revista Science en 1976. Un estudio reciente plantea además que el templo se situó en el cruce de dos líneas astronómicas (Romain)."],
  ["Built in the first half of the 12th century by King Suryavarman II (who reigned from 1113 to about 1150), it is one of the largest religious buildings in the world. Unlike almost all Angkor temples, its entrance faces west.",
    "Looking from the west gate towards the temple, at dawn on the equinoxes the Sun rises just above the central tower: Pierre Paris proposed it in 1941 and Stencel and colleagues described it in Science in 1976. A recent study further suggests the temple was sited at the intersection of two astronomical lines (Romain)."],
  [U(668, "Angkor"), { label: "W. F. Romain, «Angkor Wat: Lotus Temple at the Intersection of Celestial Azimuths», Journal of Skyscape Archaeology", url: "https://journal.equinoxpub.com/JSA/article/view/19967" }, { label: "S. Kak, «Time, Space, and Astronomy in Angkor Wat» (Louisiana State University)", url: "https://www.ece.lsu.edu/kak/ang3.pdf" }],
  { es: "En Teseo: desde el eje de la entrada, 170 m al oeste, pon el 20 de marzo o el 22 de septiembre al amanecer y mira al este.", en: "In Teseo: from the entrance axis, 170 m to the west, set 20 March or 22 September at dawn and look east." },
  { es: [["Torre central", "65 m"], ["Época", "siglo XII"]], en: [["Central tower", "65 m"], ["Period", "12th century"]] });
// Chankillo
MON_INFO["chankillo-7"] = one("Trece torres · Chankillo (Perú)", "Thirteen towers · Chankillo (Peru)",
  ["Una fila de trece torres en forma de cubo sobre la cresta de un cerro, usada hacia los años 250–200 a. C. y abandonada poco después. Con el cerro Mucho Malo, forman un marcador solar: desde los puntos de observación que hay a cada lado de la fila se sigue por dónde sale y se pone el Sol a lo largo del año (UNESCO).",
    "El sistema permite señalar solsticios, equinoccios y otras fechas con uno o dos días de margen (UNESCO). Lo identificaron como calendario solar Iván Ghezzi y Clive Ruggles en 2007 (revista Science)."],
  ["A line of thirteen cube-shaped towers along a hill ridge, used about 250–200 BC and abandoned soon after. Together with Cerro Mucho Malo they form a solar marker: from the observation points on either side of the line one tracks where the Sun rises and sets through the year (UNESCO).",
    "The system can mark solstices, equinoxes and other dates to within one or two days (UNESCO). Iván Ghezzi and Clive Ruggles identified it as a solar calendar in 2007 (Science)."],
  [U(1624, "Complejo arqueoastronómico de Chankillo"), { label: "I. Ghezzi y C. Ruggles (2007), «Chankillo: A 2300-Year-Old Solar Observatory in Coastal Peru», Science 315" }],
  { es: "En Teseo: ve a la «Vista general» (el punto de observación oeste), mira al este y adelanta la fecha en «Tiempo»: cada amanecer el Sol asoma por un hueco o una torre distinta, de la 1 en junio a la 13 en diciembre.", en: "In Teseo: go to the “Overview” (the western observation point), look east and step the date in “Time”: each sunrise the Sun appears at a different gap or tower, from tower 1 in June to tower 13 in December." },
  { es: [["Torres", "13, de 3 a 6 m de alto en Teseo"], ["Uso", "hacia 250–200 a. C."]], en: [["Towers", "13, 3 to 6 m high in Teseo"], ["Use", "about 250–200 BC"]] });
// Tiwanaku
{ const src = [U(567, "Tiwanaku: centro espiritual y político de la cultura Tiwanaku")];
  MON_INFO.akapana = one("Pirámide escalonada · Tiwanaku (Bolivia)", "Stepped pyramid · Tiwanaku (Bolivia)",
    "Fue una pirámide de siete plataformas y más de 18 m de alto; hoy solo se conservan intactos su plataforma más baja y parte de un muro intermedio (UNESCO). Tiwanaku, capital de un poderoso imperio prehispánico, alcanzó su apogeo entre los años 500 y 900.",
    "It was a pyramid of seven platforms, over 18 m high; today only its lowest platform and part of an intermediate wall survive intact (UNESCO). Tiwanaku, capital of a powerful pre-Hispanic empire, reached its peak between AD 500 and 900.",
    src, { es: "En Teseo: se dibuja como está hoy, un cerro de tierra de 16,5 m con planta de unos 197 × 180 m.", en: "In Teseo: drawn as it is today, an earthen hill 16.5 m high with a plan of about 197 × 180 m." });
  MON_INFO.kalasasaya = one("Templo abierto · Tiwanaku (Bolivia)", "Open temple · Tiwanaku (Bolivia)",
    "Gran templo rectangular a cielo abierto que se cree sirvió de observatorio; se entra por una escalinata de siete peldaños en su lado este (UNESCO).",
    "A large, open, rectangular temple believed to have served as an observatory; it is entered by seven steps on its eastern side (UNESCO).",
    src, { es: "En Teseo: desde la «Vista general», en el eje de la escalinata, su portada enmarca la estela Ponce; pon un equinoccio al atardecer para ver el Sol ponerse detrás.", en: "In Teseo: from the “Overview”, on the axis of the stairway, its gateway frames the Ponce stela; set an equinox at dusk to see the Sun set behind it." },
    { es: [["Planta", "unos 130 × 120 m"]], en: [["Plan", "about 130 × 120 m"]] });
  MON_INFO["puerta-del-sol"] = one("Portada monolítica · Tiwanaku (Bolivia)", "Monolithic gateway · Tiwanaku (Bolivia)",
    "Portada tallada en un solo bloque de andesita. Su friso en bajorrelieve, con una divinidad central, se ha interpretado como un calendario agrícola (UNESCO).",
    "A doorway carved from a single block of andesite. Its bas-relief frieze, with a central deity, has been interpreted as an agricultural calendar (UNESCO).",
    src, null, { es: [["Alto", "3 m"]], en: [["Height", "3 m"]] });
  MON_INFO.ponce = one("Estela · Tiwanaku (Bolivia)", "Stela · Tiwanaku (Bolivia)",
    "Escultura monolítica de andesita, de unos 3 m, que representa a un personaje de pie con un vaso (qiru) en una mano y una tableta de inhalar en la otra. Lleva el nombre del arqueólogo boliviano Carlos Ponce Sanginés, cuyo equipo la desenterró en 1957 durante la excavación de Kalasasaya. Junto con la estela Bennett es una de las dos grandes esculturas de Tiwanaku (Villanueva Criales, 2024).",
    "A monolithic andesite sculpture, about 3 m tall, showing a standing figure with a cup (qiru) in one hand and a snuff tray in the other. It is named after the Bolivian archaeologist Carlos Ponce Sanginés, whose team unearthed it in 1957 during the excavation of Kalasasaya. With the Bennett stela it is one of the two major sculptures of Tiwanaku (Villanueva Criales, 2024).",
    [{ label: "J. Villanueva Criales (2024), «Drunken Mountains: Analysis of the Bennett and Ponce Monoliths of Tiwanaku», Latin American Antiquity", url: "https://www.cambridge.org/core/product/33F80E9D04F8E4DB292F823399C24FD5/core-reader" }, { label: "W. H. Isbell y otros (2018), base de datos visual de Tiwanaku (UCLA)", url: "https://dig.ucla.edu/sais/node/5229" }, src[0]],
    { es: "En Teseo: está en el eje este–oeste de Kalasasaya, detrás de su portada; es un bloque simplificado, sin el relieve.", en: "In Teseo: it stands on the east–west axis of Kalasasaya, behind its gateway; it is a simplified block, without the carving." },
    { es: [["Alto", "3 m"], ["Hallazgo", "1957"]], en: [["Height", "3 m"], ["Found", "1957"]] }); }
// Paranal
{ const src = [{ label: "ESO, Very Large Telescope", url: "https://www.eso.org/public/teles-instr/paranal-observatory/vlt/" }, { label: "ESO, nombres de los telescopios del VLT", url: "https://www.eso.org/public/teles-instr/vlt/vlt-names" }];
  const ut = (n, nameEs, nameEn, year) => one("Telescopio de 8,2 m · Paranal (Chile)", "8.2 m telescope · Paranal (Chile)",
    `Uno de los cuatro Telescopios Unitarios del Very Large Telescope de ESO, en el cerro Paranal, a 2.635 m. Cada uno tiene un espejo principal de 8,2 m; pueden trabajar por separado o combinados como interferómetro (VLTI). Sus nombres vienen del mapudungun, la lengua mapuche: este es ${nameEs}. Vio su primera luz en ${year} (ESO).`,
    `One of the four Unit Telescopes of ESO’s Very Large Telescope, on Cerro Paranal, at 2,635 m. Each has an 8.2 m main mirror; they can work separately or combined as an interferometer (VLTI). Their names come from Mapudungun, the Mapuche language: this one is ${nameEn}. It saw first light in ${year} (ESO).`,
    src, null, { es: [["Espejo", "8,2 m"], ["Cerramiento", "28,5 m de alto"]], en: [["Mirror", "8.2 m"], ["Enclosure", "28.5 m high"]] });
  MON_INFO["vlt-ut1"] = ut(1, "Antu, «el Sol»", "Antu, “the Sun”", 1998);
  MON_INFO["vlt-ut2"] = ut(2, "Kueyen, «la Luna»", "Kueyen, “the Moon”", 1999);
  MON_INFO["vlt-ut3"] = ut(3, "Melipal, «la Cruz del Sur»", "Melipal, “the Southern Cross”", 2000);
  MON_INFO["vlt-ut4"] = ut(4, "Yepun, «Venus, el lucero de la tarde»", "Yepun, “Venus, the evening star”", 2000); }
// Ecuador: Cochasquí, Catequilla, Quitsato, Ingapirca
{ const src = [{ label: "U. Oberem y otros, Cochasquí: estudios arqueológicos (excavaciones de 1964–1965, Universidad de Bonn)", url: "https://biblio.flacsoandes.edu.ec/libros/digital/54361.pdf" }, { label: "B. Carrascosa y otros (2014), conservación del Parque Arqueológico de Cochasquí, revista Devenir", url: "https://revistas.uni.edu.pe/index.php/devenir/article/download/237/134/435" }];
  const base = { es: "Cochasquí reúne 15 pirámides truncas y montículos funerarios redondos, en las faldas del Mojanda, a 3.100 m. Las investigó a fondo la misión ecuatoriano-alemana de Udo Oberem (Universidad de Bonn) en 1964 y 1965.", en: "Cochasquí gathers 15 truncated pyramids and round burial mounds on the slopes of Mojanda, at 3,100 m. They were studied in depth by Udo Oberem’s Ecuadorian-German mission (University of Bonn) in 1964 and 1965." };
  const tes = { es: "En Teseo: la disposición sigue el plano de Wentscher (1982); el alto de casi todas las pirámides es estimado. Se dibujan cubiertas de hierba, como están hoy.", en: "In Teseo: the layout follows Wentscher’s plan (1982); the height of almost all the pyramids is estimated. They are drawn covered with grass, as they are today." };
  MON_INFO["cq-g"] = one("Pirámide trunca con rampa · Cochasquí (Ecuador)", "Truncated pyramid with ramp · Cochasquí (Ecuador)", [base.es, "La G es la mayor: su plataforma mide unos 76 × 62 m y se alza 14 m sobre la ladera, con una larga rampa hacia el sur."], [base.en, "G is the largest: its platform measures about 76 × 62 m and rises 14 m above the slope, with a long ramp to the south."], src, tes);
  MON_INFO["cq-e"] = one("Pirámide trunca con rampa · Cochasquí (Ecuador)", "Truncated pyramid with ramp · Cochasquí (Ecuador)", [base.es, "En la plataforma de la E se hallaron dos círculos de barro cocido con canales, que se han interpretado como calendarios; su conservación se ha estudiado en los últimos años (Carrascosa y otros)."], [base.en, "On the platform of pyramid E two circles of fired clay with channels were found, which have been interpreted as calendars; their conservation has been studied in recent years (Carrascosa et al.)."], src, tes);
  MON_INFO["cq-m"] = one("Pirámide trunca con rampa · Cochasquí (Ecuador)", "Truncated pyramid with ramp · Cochasquí (Ecuador)", [base.es, "La M es una de las mayores, en el extremo suroeste del conjunto."], [base.en, "M is one of the largest, at the south-western end of the group."], src, tes);
  MON_INFO["cqm-a"] = one("Montículo funerario · Cochasquí (Ecuador)", "Burial mound · Cochasquí (Ecuador)", [base.es, "Los montículos de planta redonda son funerarios: Oberem excavó varios, con pozos de entierro."], [base.en, "The round mounds are funerary: Oberem excavated several, with burial shafts."], src, tes); }
{ const cobo = { label: "C. Cobo (2012), Astronomía Quitu-Caranqui, Catequilla y los discos líticos, Quito, Quimeradreams" }, cobo17 = { label: "C. Cobo (2017), Revista de Topografía Azimut 8" };
  MON_INFO["catequilla-muro"] = one("Muro semicircular · Catequilla (Ecuador)", "Semicircular wall · Catequilla (Ecuador)",
    "Muro quitu-caranqui en la cima de un cerro que está sobre la línea ecuatorial. Tiene 68 m de diámetro y unos 2 m de grueso; hoy apenas asoma del suelo. Según Cristóbal Cobo, desde aquí el Sol sale por Cochasquí en junio, por el Reloj Solar Quitsato en los equinoccios y por Pambamarca en diciembre.",
    "A Quitu-Caranqui wall on the summit of a hill that lies on the equator. It is 68 m in diameter and about 2 m thick; today it barely rises above the ground. According to Cristóbal Cobo, from here the Sun rises over Cochasquí in June, over the Quitsato Sundial at the equinoxes and over Pambamarca in December.",
    [cobo, cobo17], { es: "En Teseo: activa «Astronomía andina» para ver esas tres direcciones sobre el horizonte real, y adelanta la fecha para comprobarlas.", en: "In Teseo: turn on “Andean astronomy” to see those three directions on the real horizon, and step the date to check them." });
  MON_INFO["catequilla-disco"] = one("Disco lítico · Catequilla (Ecuador)", "Stone disc · Catequilla (Ecuador)",
    "Plataforma circular de piedra de unos 8 m de diámetro, con tres líneas de piedra (dos diámetros y un radio), al noroeste del muro semicircular. Cristóbal Cobo la estudia junto con el muro como evidencia de la astronomía antigua en los Andes ecuatoriales; su posición es la que él midió (Cobo, 2017).",
    "A circular stone platform about 8 m in diameter, with three lines of stone (two diameters and a radius), north-west of the semicircular wall. Cristóbal Cobo studies it together with the wall as evidence of ancient astronomy in the equatorial Andes; its position is the one he measured (Cobo, 2017).",
    [cobo, cobo17]);
  MON_INFO.quitsato = one("Reloj solar · Cayambe (Ecuador)", "Sundial · Cayambe (Ecuador)",
    "Reloj solar moderno, inaugurado en 2007, construido sobre la línea ecuatorial: una plataforma de 54 m de diámetro con un mosaico de piedra y un poste de 10 m que hace de gnomon. Sobre el ecuador, la sombra del poste al mediodía apunta al sur de marzo a septiembre y al norte el resto del año, y en los equinoccios casi desaparece.",
    "A modern sundial, opened in 2007, built on the equator: a platform 54 m in diameter with a stone mosaic and a 10 m pole that acts as a gnomon. On the equator the pole’s noon shadow points south from March to September and north the rest of the year, and at the equinoxes it almost vanishes.",
    [cobo], { es: "En Teseo (cálculo propio, con la posición real del Sol): pon el 20 de marzo o el 22 de septiembre al mediodía solar y mira el poste; luego prueba el 21 de junio y el 21 de diciembre.", en: "In Teseo (our own calculation, with the Sun’s real position): set 20 March or 22 September at solar noon and look at the pole; then try 21 June and 21 December." },
    { es: [["Plataforma", "54 m de diámetro"], ["Poste", "10 m"], ["Latitud", "0° 0′ 0″"]], en: [["Platform", "54 m in diameter"], ["Pole", "10 m"], ["Latitude", "0° 0′ 0″"]] }); }
MON_INFO["ingapirca-castillo"] = one("Templo inca · Ingapirca (Ecuador)", "Inca temple · Ingapirca (Ecuador)",
  ["El «Castillo» o Templo del Sol es una plataforma de piedra labrada con los extremos redondeados, de 37,10 × 12,35 m (Fresco y Ziółkowski). Ingapirca es el mayor sitio inca de Ecuador, levantado sobre un asentamiento cañari.",
    "Las investigaciones arqueoastronómicas de Ziółkowski y Sadowski prestaron atención especial a la orientación del «Cuerpo de guardia», el edificio de su cima, cuyas dos puertas miran una al oriente y otra al occidente. El estado del muro elíptico se ha estudiado recientemente (Heritage Science, 2023)."],
  ["The “Castillo” or Temple of the Sun is a platform of dressed stone with rounded ends, 37.10 × 12.35 m (Fresco and Ziółkowski). Ingapirca is the largest Inca site in Ecuador, built over a Cañari settlement.",
    "The archaeoastronomical research by Ziółkowski and Sadowski paid special attention to the orientation of the “Cuerpo de guardia”, the building on its top, whose two doors face one east and one west. The condition of the elliptical wall has been studied recently (Heritage Science, 2023)."],
  [{ label: "M. Ziółkowski y R. Sadowski (1984), «Informe acerca de las investigaciones arqueoastronómicas en el área central de Ingapirca (Ecuador)», Revista Española de Antropología Americana 14", url: "https://revistas.ucm.es/index.php/REAA/en/article/view/REAA8484110103A" }, { label: "M. C. Aguirre Ullauri y otros (2023), estado de conservación del muro elíptico del Templo del Sol de Ingapirca, Heritage Science", url: "https://doaj.org/article/87da96141f634b9f8fece2de23675ffa" }],
  { es: "En Teseo: desde 40 m al sur de la plataforma, pon un equinoccio al amanecer y al atardecer para ver por dónde sale y se pone el Sol respecto a sus extremos.", en: "In Teseo: from 40 m south of the platform, set an equinox at dawn and at dusk to see where the Sun rises and sets relative to its ends." },
  { es: [["Plataforma", "37,10 × 12,35 m"], ["Altitud", "unos 3.160 m"]], en: [["Platform", "37.10 × 12.35 m"], ["Altitude", "about 3,160 m"]] });

// De dónde sale la FORMA de cada estructura (se muestra siempre, tenga o no ficha). Por sitio; `own`: piezas propias.
const SHAPE = {
  machupicchu: {
    es: "Forma: maqueta «Machupicchu» del Ministerio de Cultura del Perú (Sketchfab), CC BY 4.0, encajada sobre la planta de © colaboradores de OpenStreetMap (ODbL). Es una reconstrucción, no una medición.",
    en: "Shape: “Machupicchu” model by Peru’s Ministry of Culture (Sketchfab), CC BY 4.0, fitted onto the © OpenStreetMap contributors plan (ODbL). It is a reconstruction, not a survey.",
    url: "https://sketchfab.com/3d-models/machupicchu-d59370ac4a444628b95081f5bb7bbd02",
  },
};
// (de dónde salen las medidas de cada sitio: las mismas fuentes que CREDITS.md)
const MEAS = {
  chankillo: "Ghezzi y Ruggles (2007), Science 315", catequilla: "Cobo (2017), Revista de Topografía Azimut 8", paranal: "ESO (cerramientos del VLT y estaciones del VLTI)",
  ingapirca: "Fresco y Ziółkowski (1984), Revista Española de Antropología Americana 14", cochasqui: "plano de Wentscher (1982)", karnak: "Digital Karnak (UCLA/UCSC)",
  coliseo: "Britannica y World History Encyclopedia", cristoredentor: "Britannica y Structurae", tajmahal: "Wikipedia y Britannica", abusimbel: "World History Encyclopedia", angkorwat: "MIT y Universidad de Notre Dame", quitsato: "Cobo (2012)",
};
const OWN = {
  es: "Forma: modelo 3D propio de Teseo, hecho a partir de medidas publicadas; no es un levantamiento ni un escaneo.",
  en: "Shape: Teseo’s own 3D model, built from published measurements; not a survey or a scan.",
  url: "https://github.com/cvasconezp/teseo/blob/main/CREDITS.md",
};
const OWN_IDS = new Set(["mp-tres-ventanas", "mp-templo-principal", "mp-roca-sagrada"]);
/** Crédito de la forma de una estructura: { text, url }. `site`: el sitio de la pieza (monuments.js). */
export function shapeCredit(id, site, lang = "es") {
  if (id === "intihuatana") return null;                        // (su ficha ya cita el escaneo entre las fuentes)
  const c = !OWN_IDS.has(id) && SHAPE[site] ? SHAPE[site] : OWN;
  const m = c === OWN && MEAS[site] ? (lang === "es" ? ` Medidas: ${MEAS[site]}.` : ` Measurements: ${MEAS[site]}.`) : "";
  return { text: (c[lang] || c.es) + m, url: c.url };
}
export const MT = {
  es: { go: "Ir aquí", here: "Estás aquí", inTeseo: "En Teseo", sources: "Fuentes", credits: "Créditos", noInfo: "Aún no hay ficha de esta estructura. Se irán sumando con información verificada.", from: (d, dir) => `a ${d} m, al ${dir}` },
  en: { go: "Go here", here: "You are here", inTeseo: "In Teseo", sources: "Sources", credits: "Credits", noInfo: "There is no card for this structure yet. More will be added with verified information.", from: (d, dir) => `${d} m away, to the ${dir}` },
};
