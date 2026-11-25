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
// De dónde sale la FORMA de cada estructura (se muestra siempre, tenga o no ficha). Por sitio; `own`: piezas propias.
const SHAPE = {
  machupicchu: {
    es: "Forma: maqueta «Machupicchu» del Ministerio de Cultura del Perú (Sketchfab), CC BY 4.0, encajada sobre la planta de © colaboradores de OpenStreetMap (ODbL). Es una reconstrucción, no una medición.",
    en: "Shape: “Machupicchu” model by Peru’s Ministry of Culture (Sketchfab), CC BY 4.0, fitted onto the © OpenStreetMap contributors plan (ODbL). It is a reconstruction, not a survey.",
    url: "https://sketchfab.com/3d-models/machupicchu-d59370ac4a444628b95081f5bb7bbd02",
  },
};
const OWN = {
  es: "Forma: reconstrucción de Teseo a partir de medidas publicadas; no es un levantamiento. Las fuentes de cada sitio están en la nota del lugar y en los créditos de Teseo.",
  en: "Shape: Teseo’s reconstruction from published measurements; not a survey. Each site’s sources are in the place note and in Teseo’s credits.",
  url: "https://github.com/cvasconezp/teseo/blob/main/CREDITS.md",
};
const OWN_IDS = new Set(["mp-tres-ventanas", "mp-templo-principal", "mp-roca-sagrada"]);
/** Crédito de la forma de una estructura: { text, url }. `site`: el sitio de la pieza (monuments.js). */
export function shapeCredit(id, site, lang = "es") {
  if (id === "intihuatana") return null;                        // (su ficha ya cita el escaneo entre las fuentes)
  const c = !OWN_IDS.has(id) && SHAPE[site] ? SHAPE[site] : OWN;
  return { text: c[lang] || c.es, url: c.url };
}
export const MT = {
  es: { go: "Ir aquí", here: "Estás aquí", inTeseo: "En Teseo", sources: "Fuentes", credits: "Créditos", noInfo: "Aún no hay ficha de esta estructura. Se irán sumando con información verificada.", from: (d, dir) => `a ${d} m, al ${dir}` },
  en: { go: "Go here", here: "You are here", inTeseo: "In Teseo", sources: "Sources", credits: "Credits", noInfo: "There is no card for this structure yet. More will be added with verified information.", from: (d, dir) => `${d} m away, to the ${dir}` },
};
