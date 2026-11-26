// lidarInfo.js — textos de los sitios con suelo LiDAR (lidarSites.js): lugar, rótulos y ficha, con sus fuentes.
export const LIDAR_INFO = {
  stonehenge: {
    region: "world",
    wiki: { es: "Stonehenge", en: "Stonehenge" },
    place: { es: "Stonehenge", en: "Stonehenge" },
    note: {
      es: "Ves el recinto de foso y banco de Stonehenge y la Avenida que llega al río Avon. El foso se abrió hacia 3000 a. C. y las piedras mayores se alzaron hacia 2500 a. C. Su eje mira al amanecer del solsticio de verano.",
      en: "You see the ditch-and-bank enclosure of Stonehenge on Salisbury Plain, with the Avenue running to the River Avon. The ditch was dug around 3000 BC and the big stones were raised around 2500 BC. The axis faces midsummer sunrise.",
    },
    piece: { es: "Foso, banco y Avenida", en: "Ditch, bank and Avenue" },
    sub: { es: "recinto · 3000 a. C.", en: "enclosure · 3000 BC" },
    kind: { es: "Henge y círculo de piedras · Inglaterra", en: "Henge and stone circle · England" },
    facts: {
      es: [
        ["Recinto", "115 m de diámetro"],
        ["Hoyos de Aubrey", "56, en un círculo de 88 m"],
        ["Círculo de sarsen", "30 m; 17 piedras en pie"],
        ["Avenida", "entre 2,7 y 3 km"],
        ["UNESCO", "inscrito en 1986"],
      ],
      en: [
        ["Enclosure", "115 m across"],
        ["Aubrey Holes", "56, on a circle 88 m wide"],
        ["Sarsen circle", "30 m; 17 stones standing"],
        ["Avenue", "2.7 to 3 km long"],
        ["UNESCO", "inscribed in 1986"],
      ],
    },
    body: {
      es: [
        "El recinto es un banco y un foso circulares de unos 115 m de diámetro. Dentro hay 56 hoyos, los de Aubrey, repartidos en un círculo de 88 m; los que se excavaron están marcados hoy con parches de hormigón. English Heritage data el foso hacia 3000 a. C., y la ficha de Historic England da para el monumento entre 2450 y 1250 a. C.",
        "El círculo de sarsen mide 30 m: tenía 30 piedras y hoy siguen en pie 17, con seis dinteles en su sitio. En la herradura interior, la piedra más alta llega a 7 m. Varias se enderezaron o se repusieron: el trilito más alto en 1901, otro en 1958 y las últimas piedras se consolidaron en 1964. Su posición actual no es toda original.",
        "La Avenida es un pasillo entre bancos, de unos 30 m de ancho total, que enlaza el recinto con el río Avon. Las fuentes le dan entre 2,7 y 3 km de largo. Su fecha va de hacia 2300 a. C. a una construcción inicial entre 2620 y 2480 a. C., con retoques posteriores.",
      ],
      en: [
        "The enclosure is a circular bank and ditch about 115 m across, with entrances to the south and north-east. Inside lie 56 pits, the Aubrey Holes, spread over a circle 88 m wide; the ones that were excavated are marked today with concrete patches. English Heritage dates the ditch to about 3000 BC, while Historic England's record gives 2450 to 1250 BC for the monument.",
        "The sarsen circle is 30 m wide: it had 30 stones and 17 still stand, with six lintels in place. In the inner horseshoe the tallest stone reaches 7 m. Several were straightened or put back: the tallest trilithon in 1901, another in 1958, and the last stones were consolidated in 1964. Their present position is not all original.",
        "The Avenue is a corridor between banks, about 30 m wide overall, linking the enclosure to the River Avon. Sources give it a length between 2.7 and 3 km. Its date ranges from about 2300 BC to a first build between 2620 and 2480 BC, with later recutting.",
      ],
    },
    teseo: {
      es: "Pon el 21 de junio y avanza hasta el amanecer mirando al noreste (acimut 49°, según Ruggles); el 21 de diciembre, el ocaso queda en sentido opuesto. El relieve es una medición con láser desde el aire (LiDAR) de la Environment Agency; Teseo lo simplifica y lo nivela con el relieve de alrededor. Las piedras: modelo propio de Teseo.",
      en: "Set 21 June and advance to sunrise, looking north-east (azimuth 49°, after Ruggles); on 21 December the sunset lies in the opposite direction. The relief is an airborne laser (LiDAR) survey by the Environment Agency; Teseo simplifies it and levels it with the surrounding terrain. The stones: Teseo's own model.",
    },
    sources: [
      { label: "UNESCO, Stonehenge, Avebury and Associated Sites", url: "https://whc.unesco.org/en/list/373" },
      { label: "Historic England, Stonehenge, list entry 1010140", url: "https://historicengland.org.uk/listing/the-list/list-entry/1010140" },
      { label: "English Heritage, Description of Stonehenge", url: "https://www.english-heritage.org.uk/visit/places/stonehenge/history-and-stories/history/description/?lang=en" },
      { label: "Historic England, Astronomical research at Stonehenge (Ruggles, Chadburn)", url: "https://cms.historicengland.org.uk/whats-new/research/astronomical-research-at-stonehenge" },
      { label: "Ruggles, Astronomy and Stonehenge (1997)", url: "https://www.thebritishacademy.ac.uk/documents/3920/92p203.pdf" },
    ],
  },

  maeshowe: {
    region: "world",
    wiki: { es: "Maeshowe", en: "Maeshowe" },
    place: { es: "Maeshowe", en: "Maeshowe" },
    note: {
      es: "Ves el túmulo de Maeshowe, en las Orcadas, con su foso y su banco alrededor. Es una tumba de cámara de hace unos 5000 años. Durante unas tres semanas en torno al solsticio de invierno, el sol poniente alumbra su pasillo.",
      en: "You see the mound of Maeshowe in Orkney, ringed by its ditch and bank. It is a chambered tomb about 5,000 years old. For about three weeks around the winter solstice, the setting sun shines down its passage.",
    },
    piece: { es: "Túmulo, foso y banco", en: "Mound, ditch and bank" },
    sub: { es: "túmulo · 2700–3000 a. C.", en: "mound · 2700–3000 BC" },
    kind: { es: "Túmulo con cámara · Escocia", en: "Chambered cairn · Scotland" },
    facts: {
      es: [
        ["Túmulo", "c. 35 m de diámetro, 7 m de alto"],
        ["Recinto", "c. 80 × 70 m, con foso y banco"],
        ["Cámara", "c. 4,7 m de lado, 4,5 m de alto"],
        ["Pasillo", "entre 10 y 15 m según la fuente"],
        ["UNESCO", "Corazón del Neolítico de las Orcadas, 1999"],
      ],
      en: [
        ["Mound", "c. 35 m across, 7 m high"],
        ["Enclosure", "c. 80 × 70 m, with ditch and bank"],
        ["Chamber", "c. 4.7 m square, 4.5 m high"],
        ["Passage", "10 to 15 m depending on the source"],
        ["UNESCO", "Heart of Neolithic Orkney, 1999"],
      ],
    },
    body: {
      es: [
        "Maeshowe es un túmulo de c. 35 m de diámetro y 7 m de alto, dentro de un recinto de c. 80 × 70 m con un foso ancho de fondo plano y un banco exterior. La cámara central mide c. 4,7 m de lado, con falsa bóveda y tres celdas laterales. La fuente oficial da una fecha de c. 2700 o de c. 3000 a. C., según el apartado.",
        "Buena parte de lo que se ve fue modificado. En 1861 se abrió el túmulo por la cima y se rompió la bóveda; en 1910–1913 se colocó un techo de hormigón y se redondeó el perfil hasta su forma actual, que probablemente era más alta y cónica al principio. La mampostería neolítica original llega al menos a 4 m en el interior.",
        "A mediados del siglo XII visitantes nórdicos dejaron al menos 33 inscripciones rúnicas. El pasillo, de entre 10 y 15 m según la fuente (la diferencia puede deberse al tramo exterior reconstruido), mira al suroeste. Alrededor del solsticio de invierno el sol poniente lo alumbra; la alineación se acepta, pero no era de precisión de calendario.",
      ],
      en: [
        "Maeshowe is a mound about 35 m across and 7 m high, inside an enclosure of about 80 × 70 m with a platform, a wide flat-bottomed ditch and an outer bank. The central chamber is about 4.7 m square, with four corner stones, a corbelled roof and three side cells. For the date, the official source gives c. 2700 BC in one section and c. 3000 BC in another.",
        "Much of what you see was altered. In 1861 the mound was opened from the top and the vault was broken; in 1910–1913 a concrete roof was laid and the mound was rounded to its present profile, which was probably taller and more conical at first. The original Neolithic masonry reaches at least 4 m inside.",
        "In the mid-12th century Norse visitors left at least 33 runic inscriptions. The passage, 10 to 15 m long depending on the source (the gap may come from counting the rebuilt outer stretch), faces south-west. Around the winter solstice the setting sun lights it; the alignment is accepted, but it was not precise enough to work as a calendar.",
      ],
    },
    teseo: {
      es: "Pon el 21 de diciembre y avanza hasta la puesta de Sol mirando al suroeste; el horizonte suroeste medido por Ruggles y Barclay va de 217° a 226°. El relieve es una medición con láser desde el aire (LiDAR) de Historic Environment Scotland; Teseo lo simplifica y lo nivela con el relieve de alrededor. El perfil medido es el restaurado.",
      en: "Set 21 December and advance to sunset, looking south-west; the south-west horizon measured by Ruggles and Barclay runs from 217° to 226°. The relief is an airborne laser (LiDAR) survey by Historic Environment Scotland; Teseo simplifies it and levels it with the surrounding terrain. The profile measured is the restored one.",
    },
    sources: [
      { label: "Historic Environment Scotland, Maeshowe Chambered Cairn: history", url: "https://www.historicenvironment.scot/visit-a-place/places/maeshowe-chambered-cairn/history/" },
      { label: "Historic Environment Scotland, Statement of Significance: Maeshowe (2015, actualizado 2025)", url: "https://app-hes-pubs-prod-neu-01.azurewebsites.net/api/file/530b3280-a637-4fe4-97fd-ab0200f9a671" },
      { label: "Ruggles y Barclay, Cosmology, calendars and society in Neolithic Orkney (2000)", url: "https://cambridge.org/core/services/aop-cambridge-core/content/view/D2DA403A3E02B6AECCC57363F57B155A/S0003598X00066151a.pdf/cosmology-calendars-and-society-in-neolithic-orkney-a-rejoinder-to-euan-mackie.pdf" },
      { label: "UNESCO, Heart of Neolithic Orkney", url: "https://whc.unesco.org/en/list/514" },
    ],
  },

  brodgar: {
    region: "world",
    wiki: { en: "Ring_of_Brodgar" },
    place: { es: "Anillo de Brodgar", en: "Ring of Brodgar" },
    note: {
      es: "Ves el Anillo de Brodgar, en las Orcadas, con el foso tallado en la roca alrededor y los túmulos del entorno. Fue un círculo de unas 60 piedras, levantado entre 2600 y 2000 a. C. No hay una alineación astronómica probada.",
      en: "You see the Ring of Brodgar in Orkney, with the rock-cut ditch around it and the mounds nearby. It was a circle of about 60 stones, raised between 2600 and 2000 BC. No astronomical alignment has been proved.",
    },
    piece: { es: "Foso y túmulos", en: "Ditch and mounds" },
    sub: { es: "foso tallado · 2600–2000 a. C.", en: "rock-cut ditch · 2600–2000 BC" },
    kind: { es: "Círculo de piedras y henge · Escocia", en: "Stone circle and henge · Scotland" },
    facts: {
      es: [
        ["Círculo", "c. 103 m de diámetro"],
        ["Foso", "c. 123 o 136 m de diámetro, según la fuente"],
        ["Piedras en pie", "21, 27 o 36 según quién cuente"],
        ["Altura de las piedras", "c. 2 a 4,7 m"],
        ["Túmulos cercanos", "al menos 13"],
      ],
      en: [
        ["Circle", "c. 103 m across"],
        ["Ditch", "c. 123 or 136 m across, depending on the source"],
        ["Stones standing", "21, 27 or 36 depending on who counts"],
        ["Stone height", "c. 2 to 4.7 m"],
        ["Nearby mounds", "at least 13"],
      ],
    },
    body: {
      es: [
        "El círculo mide c. 103 m de diámetro y se calcula que tuvo unas 60 piedras. Hoy el número depende de quién cuente: 21 en pie según el recuento más reciente de Historic Environment Scotland, 27 según Canmore (que también contó 27 en 1929) y 36 que «sobreviven» según la web de visita y la UNESCO. Las que quedan miden entre c. 2 y 4,7 m.",
        "El foso está excavado en la roca. Su diámetro es de c. 123 m en una fuente y de 136 m en otra. Su ancho original era de c. 10 m y su profundidad original de c. 4 m; hoy está medio relleno de sedimento. Se supone excavado hacia 2600–2400 a. C., con pocas pruebas.",
        "La piedra mayor cayó hacia 1814 y se volvió a levantar; en 1908 se levantaron siete más, y después se colocaron otras. No todas están donde estuvieron al principio. En cuanto al cielo, Historic Environment Scotland dice solo que los sitios de la zona pudieron servir para observar la Luna, sin dar detalles: no hay alineación demostrada.",
      ],
      en: [
        "The circle is about 103 m across and is thought to have had some 60 stones. The count today depends on who is counting: 21 standing in the latest Historic Environment Scotland tally, 27 in Canmore (which also counted 27 in 1929), and 36 'surviving' on the visitor page and from UNESCO. The ones that remain stand between about 2 and 4.7 m tall.",
        "The ditch is cut into the rock. Its diameter is about 123 m in one source and 136 m in another. It was originally about 10 m wide and about 4 m deep, and today it is half filled with silt. It was probably dug around 2600–2400 BC, on little evidence.",
        "The largest stone fell around 1814 and was raised again; in 1908 seven more were raised, and others were set up afterwards. Not all of them stand where they stood at first. As for the sky, Historic Environment Scotland says only that sites in the area may have been used to watch the Moon, without detail: there is no proven alignment.",
      ],
    },
    teseo: {
      es: "No hay alineación publicada que comprobar; la observación lunar es solo sugerencia. El relieve es una medición con láser desde el aire (LiDAR) de Historic Environment Scotland; Teseo lo simplifica y lo nivela con el relieve de alrededor. Las piedras: posición y altura medidas en el modelo de superficie del mismo LiDAR; la altura medida con LiDAR puede quedar corta.",
      en: "There is no published alignment to check; moon-watching is only a suggestion. The relief is an airborne laser (LiDAR) survey by Historic Environment Scotland; Teseo simplifies it and levels it with the surrounding terrain. The stones: position and height measured on the surface model of the same LiDAR; stone height measured with LiDAR may come out short.",
    },
    sources: [
      { label: "Historic Environment Scotland, Statement of Significance: Ring of Brodgar (2018, actualizado 2025)", url: "https://app-hes-pubs-prod-neu-01.azurewebsites.net/api/file/58d9154e-789a-4fe1-914d-b2bc009eebb4" },
      { label: "Historic Environment Scotland, Ring of Brodgar: history", url: "https://www.historicenvironment.scot/visit-a-place/places/ring-of-brodgar-stone-circle-and-henge/history" },
      { label: "Canmore, Ring of Brodgar, ID 1696", url: "https://canmore.org.uk/site/1696" },
      { label: "Historic Environment Scotland, scheduled monument SM90042", url: "https://portal.historicenvironment.scot/designation/SM90042" },
      { label: "UNESCO, Heart of Neolithic Orkney", url: "https://whc.unesco.org/en/list/514" },
    ],
  },

  stenness: {
    region: "world",
    wiki: { en: "Stones_of_Stenness" },
    place: { es: "Piedras de Stenness", en: "Stones of Stenness" },
    note: {
      es: "Ves el henge de las Piedras de Stenness, en las Orcadas, con el foso y el banco muy arrasados y unas pocas piedras altas y delgadas. Se levantó hacia 3000 a. C. Quedan cuatro piedras en pie, la mayor de más de 5 m.",
      en: "You see the henge of the Stones of Stenness in Orkney, its ditch and bank much worn down, with a few tall, thin stones. It was built around 3000 BC. Four stones still stand, the tallest over 5 m.",
    },
    piece: { es: "Henge (foso y banco)", en: "Henge (ditch and bank)" },
    sub: { es: "henge · 3000–2900 a. C.", en: "henge · 3000–2900 BC" },
    kind: { es: "Henge y círculo de piedras · Escocia", en: "Henge and stone circle · Scotland" },
    facts: {
      es: [
        ["Círculo", "c. 30 m de diámetro (elipse prevista)"],
        ["Foso y banco", "c. 44–45 m de diámetro en conjunto"],
        ["Piedras en pie", "cuatro (otras fichas dicen cinco)"],
        ["Piedra mayor", "más de 5 m"],
        ["Fecha", "3000–2900 a. C. (calibrado)"],
      ],
      en: [
        ["Circle", "c. 30 m across (planned ellipse)"],
        ["Ditch and bank", "c. 44–45 m across overall"],
        ["Stones standing", "four (other records say five)"],
        ["Tallest stone", "over 5 m"],
        ["Date", "3000–2900 BC (calibrated)"],
      ],
    },
    body: {
      es: [
        "El círculo, una elipse de c. 30 m, probablemente iba a tener doce piedras, quizá nunca completadas. Hoy quedan cuatro en pie. Según el levantamiento de Ritchie (1976), la piedra 2 mide 5,7 m, la 3 mide 5,3 m y la 5, volcada en 1814 y vuelta a levantar, mide 4,8 m. La piedra 7, de c. 2 m, se apoya en una base de hormigón.",
        "El foso tiene 2–3 m de profundidad y una base excavada en la roca de c. 4 m de ancho; otras fuentes le dan más de 7 m. El banco medía c. 6,5 m de ancho y hasta 0,4 m de alto, y estaba casi destruido por el arado: en 1985 se reconstruyó según la forma registrada en 1851. Tiene una sola calzada, al norte o noroeste.",
        "En el centro hubo un hogar cuadrado de 2,1 × 1,9 m. El «dolmen» que se ve allí se montó en 1907, no es original y se reconfiguró después. El documento oficial de Stenness no menciona astronomía; el de Maeshowe dice que una piedra del círculo se alinea con Maeshowe, pero no hay una alineación propia de Stenness publicada.",
      ],
      en: [
        "The circle, an ellipse of about 30 m, was probably meant to have twelve stones, perhaps never completed. Four stand today, though other records count five. In Ritchie's 1976 survey, stone 2 is 5.7 m, stone 3 is 5.3 m, and stone 5, toppled in 1814 and raised again, is 4.8 m. Stone 7, about 2 m, rests on a concrete base.",
        "The ditch is 2–3 m deep with a rock-cut base about 4 m wide; other sources give over 7 m. The bank was about 6.5 m wide and up to 0.4 m high, and had been nearly destroyed by ploughing: in 1985 it was rebuilt to the shape recorded in 1851. There is a single causeway, to the north or north-west.",
        "At the centre there was a square hearth of 2.1 × 1.9 m. The 'dolmen' seen there was assembled in 1907, is not original, and was reconfigured later. The official Stenness document mentions no astronomy; the Maeshowe one says a stone in the circle lines up with Maeshowe, but there is no published alignment of Stenness itself.",
      ],
    },
    teseo: {
      es: "No hay alineación propia de Stenness que comprobar. El relieve es una medición con láser desde el aire (LiDAR) de Historic Environment Scotland; Teseo lo simplifica y lo nivela con el relieve de alrededor, y el banco medido es el reconstruido en 1985. Las piedras: LiDAR y OpenStreetMap; la altura de las piedras medida con LiDAR puede quedar corta.",
      en: "There is no alignment of Stenness itself to check. The relief is an airborne laser (LiDAR) survey by Historic Environment Scotland; Teseo simplifies it and levels it with the surrounding terrain, and the bank measured is the one rebuilt in 1985. The stones: LiDAR and OpenStreetMap; stone height measured with LiDAR may come out short.",
    },
    sources: [
      { label: "Historic Environment Scotland, Statement of Significance: Stones of Stenness (2020, actualizado 2025)", url: "https://app-hes-pubs-prod-neu-01.azurewebsites.net/api/file/13c5f474-68db-480c-ab9a-b2bc00a439dc" },
      { label: "Historic Environment Scotland, Stones of Stenness: history", url: "https://www.historicenvironment.scot/visit-a-place/places/stones-of-stenness-circle-and-henge/history/" },
      { label: "Canmore, Stones of Stenness, ID 2105", url: "https://canmore.org.uk/site/2105" },
      { label: "Ritchie, The Stones of Stenness, Orkney (1976)", url: "https://journals.socantscot.org/index.php/psas/article/download/8930/8898/8884" },
    ],
  },

  newgrange: {
    region: "world",
    wiki: { es: "Newgrange", en: "Newgrange" },
    place: { es: "Newgrange", en: "Newgrange" },
    note: {
      es: "Ves la loma de Newgrange y su entorno, en el valle del Boyne. Es un túmulo de pasillo de hacia 3200 a. C. Sobre la entrada hay una abertura, la caja del techo, por la que entra el sol del solsticio de invierno.",
      en: "You see the rise of Newgrange and its surroundings in Ireland's Boyne Valley. It is a mound with a passage and chamber from about 3200 BC. Above the entrance is an opening, the roof-box, through which the winter solstice sun enters.",
    },
    piece: { es: "Loma y entorno", en: "Mound site and surroundings" },
    sub: { es: "túmulo de pasillo · 3200 a. C.", en: "passage tomb · 3200 BC" },
    kind: { es: "Túmulo de pasillo · Irlanda", en: "Passage tomb · Ireland" },
    facts: {
      es: [
        ["Pasillo", "c. 19 m de largo, hasta una cámara cruciforme"],
        ["Fecha", "c. 3200 a. C."],
        ["Grabados", "124 piedras del borde con grabados"],
        ["Luz del solsticio", "entra unos 4,5 min tras la salida del Sol"],
        ["UNESCO", "Brú na Bóinne, 1993"],
      ],
      en: [
        ["Passage", "c. 19 m long, to a cruciform chamber"],
        ["Date", "c. 3200 BC"],
        ["Carvings", "124 kerbstones with carvings"],
        ["Solstice light", "enters about 4.5 min after sunrise"],
        ["UNESCO", "Brú na Bóinne, 1993"],
      ],
    },
    body: {
      es: [
        "Newgrange es un túmulo de pasillo del valle del Boyne que las dataciones modernas por radiocarbono sitúan hacia 3200 a. C. El pasillo, de c. 19 m y con ortostatos, lleva a una cámara cruciforme con falsa bóveda. Las piedras del borde llevan grabados: un registro de 2022 anota 124 con arte. Los círculos de hoyos cercanos son de mediados del III milenio a. C.",
        "Lo que se ve fue muy trabajado en el siglo XX. Las piedras del borde y el muro se devolvieron a su sitio y el muro se recortó para el paso de visitantes; el techo del pasillo se desmontó y se rehízo reforzado. El cuarzo y el granito hallados ante la entrada se interpretaron como una fachada caída y se reconstruyó. Esa reconstrucción es controvertida.",
        "Ray (1989) halló que la caja del techo pudo hacerse a propósito para seguir la trayectoria del Sol, y que la luz entra unos 4,5 minutos después de la salida del Sol en el solsticio de invierno; lo plantea como sugerencia. Es la alineación más aceptada del conjunto. Las sombras del Gran Círculo y la lectura de la piedra K52 con el ocaso del solsticio de verano están menos establecidas.",
      ],
      en: [
        "Newgrange is a passage tomb in the Boyne Valley that modern radiocarbon dates place around 3200 BC. The passage, about 19 m long and lined with upright slabs, leads to a cruciform chamber with a corbelled roof. The kerbstones are carved: a 2022 record lists 124 with art. The nearby pit circles date to the mid-3rd millennium BC.",
        "What you see was heavily worked on in the 20th century. The kerbstones and the wall were put back in place and the wall was trimmed for visitor access; the passage roof was taken down and rebuilt, reinforced. Quartz and granite found in front of the entrance were read as a collapsed facade and rebuilt. That reconstruction is controversial and should not be taken as original.",
        "Ray (1989) found that the roof-box could have been made on purpose to follow the Sun's path, and that the light enters about 4.5 minutes after sunrise at the winter solstice; he offers it as a suggestion. It is the best-accepted alignment of the group. The Great Circle shadows and the reading of stone K52 with the summer solstice sunset are less well established.",
      ],
    },
    teseo: {
      es: "Pon el 21 de diciembre y avanza hasta la salida del Sol mirando al sureste. El relieve es una medición con láser desde el aire (LiDAR) del Discovery Programme y el Geological Survey Ireland, de un vuelo de 2007; Teseo lo simplifica y lo nivela. El túmulo, con su fachada de cuarzo reconstruida, es un modelo propio.",
      en: "Set 21 December and advance to sunrise, looking south-east. The relief is an airborne laser (LiDAR) survey by the Discovery Programme and Geological Survey Ireland, flown in 2007; Teseo simplifies it and levels it. The mound, with its reconstructed quartz facade, is Teseo's own model.",
    },
    sources: [
      { label: "UNESCO, Brú na Bóinne", url: "https://whc.unesco.org/en/list/659" },
      { label: "Brú na Bóinne WHS Research Framework", url: "https://worldheritageireland.ie/wp-content/uploads/2022/06/BrunaBoinneWHSResearchFramework.pdf" },
      { label: "Ray, The winter solstice phenomenon at Newgrange (1989)", url: "https://www.nature.com/articles/337343a0.pdf" },
      { label: "Twohig, Recording carvings on the exterior stones at Newgrange (2022)", url: "https://ria.ie/assets/uploads/2024/05/drwhs_2022_twohig_final_report_web_ready.pdf" },
      { label: "World Heritage Ireland, Brú na Bóinne", url: "https://www.worldheritageireland.ie/world-heritage-properties/bru-na-boinne/" },
    ],
  },

  knowth: {
    region: "world",
    wiki: { es: "Knowth", en: "Knowth" },
    place: { es: "Knowth", en: "Knowth" },
    note: {
      es: "Ves el gran túmulo de Knowth y los túmulos pequeños que lo rodean, en el valle del Boyne. Tiene dos pasillos opuestos, uno al este y otro al oeste. Se orientan cerca de los equinoccios, pero no apuntan a ellos con exactitud.",
      en: "You see the great mound of Knowth and the small mounds around it in the Boyne Valley. It has two passages facing opposite ways, east and west. They point near the equinoxes but not exactly at them.",
    },
    piece: { es: "Túmulo y satélites", en: "Mound and satellites" },
    sub: { es: "túmulo · c. 3000 a. C.", en: "passage tomb · c. 3000 BC" },
    kind: { es: "Túmulo de pasillo · Irlanda", en: "Passage tomb · Ireland" },
    facts: {
      es: [
        ["Altura", "c. 10 m (cifra general de los tres grandes túmulos)"],
        ["Pasillo este", "entre 35 y 40,4 m según la fuente"],
        ["Pasillo oeste", "34,2 m"],
        ["Túmulos satélite", "c. 20"],
        ["Arte megalítico", "más de 350 piedras"],
      ],
      en: [
        ["Height", "c. 10 m (general figure for the three great mounds)"],
        ["East passage", "35 to 40.4 m depending on the source"],
        ["West passage", "34.2 m"],
        ["Satellite mounds", "c. 20"],
        ["Megalithic art", "over 350 stones"],
      ],
    },
    body: {
      es: [
        "Bajo el túmulo hay dos pasillos espalda con espalda, en eje este–oeste. El del este tiene un acimut de 85°08' (levantamiento de 1985) y mide c. 35 m con la cámara según un estudio, o 40,4 m según otro; su cámara es cruciforme, con falsa bóveda. El del oeste mide 34,2 m, con un recodo, y su cámara, de 2 × 2 m, no tiene celdas laterales.",
        "Alrededor hay c. 20 túmulos más pequeños, algunos anteriores al grande. La UNESCO habla de unos 40 satélites en todo Brú na Bóinne; son cuentas distintas. Knowth guarda unas 400 piedras decoradas, más de 350 con arte megalítico. Un modelo de radiocarbono sitúa el inicio del túmulo en 3000–2910 y su final en 2885–2740 (años de radiocarbono), y reconoce que la fecha de construcción sigue siendo problemática.",
        "Eogan propuso en 1986 una relación con los equinoccios, pero las mediciones no la confirman con exactitud: el pasillo este queda unos 5° al norte del este y el interior del oeste, unos 8° al norte del ocaso equinoccial. La propuesta fue controvertida y se acepta solo como relación aproximada. Algunos muros de apoyo son modernos.",
      ],
      en: [
        "Under the mound lie two passages back to back, on an east–west axis. The east one has an azimuth of 85°08' (1985 survey) and measures about 35 m with the chamber in one study, or 40.4 m in another; its chamber is cruciform, with a corbelled roof. The west one is 34.2 m long, with a bend, and its 2 × 2 m chamber has no side cells.",
        "Around it lie about 20 smaller mounds, some older than the great one. UNESCO speaks of some 40 satellites across all of Brú na Bóinne; the two counts differ. Knowth holds about 400 decorated stones, over 350 with megalithic art. A radiocarbon model puts the start of the mound at 3000–2910 and its end at 2885–2740 (radiocarbon years), and admits that the construction date remains problematic.",
        "Eogan proposed a link with the equinoxes in 1986, but the measurements do not confirm it exactly: the east passage lies about 5° north of east, and the interior of the west one about 8° north of equinox sunset. The proposal was controversial and is accepted only as an approximate relation. Some support walls are modern.",
      ],
    },
    teseo: {
      es: "Pon el 20 o 21 de marzo y avanza hasta la salida del Sol mirando al este: el pasillo este (acimut 85°08') queda unos 5° al norte, y el Sol equinoccial sale más al sur. El relieve es una medición con láser desde el aire (LiDAR) del Discovery Programme y el Geological Survey Ireland; Teseo lo simplifica y lo nivela.",
      en: "Set 20 or 21 March and advance to sunrise, looking east: the east passage (azimuth 85°08') lies about 5° north, and the equinox Sun rises further south. The relief is an airborne laser (LiDAR) survey by the Discovery Programme and Geological Survey Ireland; Teseo simplifies it and levels it.",
    },
    sources: [
      { label: "Prendergast y Ray, Alignment of the Western and Eastern Passage Tombs at Knowth Tomb 1 (2017)", url: "https://core.ac.uk/download/301305906.pdf" },
      { label: "Prendergast, Knowth passage-grave in Ireland: an instrument of precision astronomy (2017)", url: "https://journals.ed.ac.uk/lithicstudies/article/download/1921/2559" },
      { label: "Brú na Bóinne WHS Research Framework", url: "https://worldheritageireland.ie/wp-content/uploads/2022/06/BrunaBoinneWHSResearchFramework.pdf" },
      { label: "UNESCO, Brú na Bóinne", url: "https://whc.unesco.org/en/list/659" },
      { label: "World Heritage Ireland, Brú na Bóinne", url: "https://www.worldheritageireland.ie/world-heritage-properties/bru-na-boinne/" },
    ],
  },

  dowth: {
    region: "world",
    wiki: { es: "Dowth", en: "Dowth" },
    place: { es: "Dowth", en: "Dowth" },
    note: {
      es: "Ves el túmulo de Dowth, en el valle del Boyne, con los daños que le dejaron canteras y zanjas del siglo XIX. Mide unos 85 m de diámetro según el portal oficial y cubre al menos dos tumbas de pasillo en su lado oeste.",
      en: "You see the mound of Dowth in the Boyne Valley, with the damage left by 19th-century quarrying and trenching. It is about 85 m across according to the official portal and covers at least two passage tombs on its west side.",
    },
    piece: { es: "Túmulo", en: "Mound" },
    sub: { es: "túmulo · valle del Boyne", en: "Boyne passage tomb" },
    kind: { es: "Túmulo de pasillo · Irlanda", en: "Passage tomb · Ireland" },
    facts: {
      es: [
        ["Diámetro", "c. 85 m (portal oficial)"],
        ["Altura", "15 m (portal oficial); c. 18 m (estimación del siglo XVIII)"],
        ["Tumbas", "al menos dos, en el lado oeste"],
        ["Piedra del borde 51", "siete motivos solares"],
        ["UNESCO", "Brú na Bóinne, 1993"],
      ],
      en: [
        ["Diameter", "c. 85 m (official portal)"],
        ["Height", "15 m (official portal); c. 18 m (18th-century estimate)"],
        ["Tombs", "at least two, on the west side"],
        ["Kerbstone 51", "seven sun motifs"],
        ["UNESCO", "Brú na Bóinne, 1993"],
      ],
    },
    body: {
      es: [
        "Dowth es uno de los tres grandes túmulos de Brú na Bóinne, fechados en conjunto «hace unos 5000 años»; para Dowth solo no hay fecha en las fuentes. El portal oficial le da 85 m de diámetro y 15 m de alto, mientras que un observador del siglo XVIII estimó c. 60 pies, unos 18 m, de alto. La piedra del borde 51 lleva siete motivos parecidos a soles.",
        "El túmulo cubre al menos dos tumbas, ambas en el lado oeste; la mayor tiene cámara cruciforme con un anexo, y hay además un souterrain con pasillo y cámara propios. Hay huellas medievales, una iglesia y un castillo. Las tumbas no se visitan por seguridad: se ve el túmulo, no su interior.",
        "En el siglo XIX, canteras para obras de carretera dañaron el túmulo y una zanja de ingeniero quedó sin rellenar; las fuentes no documentan restauración. Un capítulo de 2025, conocido por una nota de prensa, propone que una tumba se alinea con el ocaso del solsticio de invierno. No da acimutes y no hemos podido comprobar las cifras, así que su aceptación no está determinada.",
      ],
      en: [
        "Dowth is one of the three great mounds of Brú na Bóinne, dated together to 'about 5,000 years ago'; the sources give no date for Dowth alone. The official portal gives it 85 m across and 15 m high, while an 18th-century observer estimated about 60 feet, some 18 m, in height. Kerbstone 51 carries seven sun-like motifs.",
        "The mound covers at least two tombs, both on the west side; the larger has a cruciform chamber with an annexe, and there is also a souterrain with its own passage and chamber. There are medieval traces, a church and a castle. The tombs are closed to visitors for safety: you see the mound, not its interior.",
        "In the 19th century, quarrying for road works damaged the mound and an engineer's trench was left unfilled; the sources record no restoration. A 2025 chapter, known from a press release, proposes that one tomb lines up with the midwinter sunset. It gives no azimuths and we could not check the figures, so its acceptance is not established.",
      ],
    },
    teseo: {
      es: "No proponemos una observación: la alineación propuesta no tiene cifras publicadas que comprobar. Lo que ves es el relieve actual, con sus daños, no una reconstrucción. El relieve es una medición con láser desde el aire (LiDAR) del Discovery Programme y el Geological Survey Ireland; Teseo lo simplifica y lo nivela con el relieve de alrededor.",
      en: "We do not propose an observation: the proposed alignment has no published figures to check. What you see is the present relief, damage included, not a reconstruction. The relief is an airborne laser (LiDAR) survey by the Discovery Programme and Geological Survey Ireland; Teseo simplifies it and levels it with the surrounding terrain.",
    },
    sources: [
      { label: "UNESCO, Brú na Bóinne", url: "https://whc.unesco.org/en/list/659" },
      { label: "World Heritage Ireland, Brú na Bóinne", url: "https://www.worldheritageireland.ie/world-heritage-properties/bru-na-boinne/" },
      { label: "Brú na Bóinne WHS Management Plan 2017", url: "https://worldheritageireland.ie/wp-content/uploads/2022/06/Bru_na_Boinne_Mgt_Plan_2017.pdf" },
      { label: "Brú na Bóinne WHS Research Framework", url: "https://worldheritageireland.ie/wp-content/uploads/2022/06/BrunaBoinneWHSResearchFramework.pdf" },
      { label: "University of Galway, nota de prensa sobre Fenwick (2025)", url: "https://universityofgalway.ie/about-us/news-and-events/news-archive/2025/april/new-research-suggests-passage-tombs-of-bru-na-boinne-served-as-sophisticated-solar-observatories-.html" },
    ],
  },

  avebury: {
    region: "world",
    wiki: { es: "Avebury", en: "Avebury" },
    place: { es: "Avebury", en: "Avebury" },
    note: {
      es: "Ves el banco y el foso del henge de Avebury, de unos 420 m de diámetro, que encierra el que se considera mayor círculo de piedras prehistórico. La obra de tierra principal es de hacia 2500 a. C. No hay una alineación astronómica probada.",
      en: "You see the bank and ditch of the Avebury henge, about 420 m across, which encloses what is regarded as the largest prehistoric stone circle. The main earthwork dates to about 2500 BC. No astronomical alignment has been proved.",
    },
    piece: { es: "Banco y foso", en: "Bank and ditch" },
    sub: { es: "henge · hacia 2500 a. C.", en: "henge · c. 2500 BC" },
    kind: { es: "Henge y círculos de piedras · Inglaterra", en: "Henge and stone circles · England" },
    facts: {
      es: [
        ["Henge", "420 m de diámetro; c. 11,5 ha encerradas"],
        ["Foso", "23 m de ancho en la boca; 7 a 10 m de profundidad original"],
        ["Banco", "hasta 5 m de alto"],
        ["Círculo exterior", "unas 100 piedras originales"],
        ["UNESCO", "inscrito en 1986"],
      ],
      en: [
        ["Henge", "420 m across; c. 11.5 ha enclosed"],
        ["Ditch", "23 m wide at the top; 7 to 10 m deep originally"],
        ["Bank", "up to 5 m high"],
        ["Outer circle", "about 100 original stones"],
        ["UNESCO", "inscribed in 1986"],
      ],
    },
    body: {
      es: [
        "El henge tiene 420 m de diámetro y encierra c. 11,5 ha. El foso mide 23 m de ancho en la boca y 10 m en la base plana, y su profundidad original fue de 7 a 10 m (English Heritage dice c. 9 m). El banco tiene hoy entre 4,2 y 5,4 m de alto y tuvo casi 17 m sobre el fondo del foso.",
        "El círculo exterior tuvo unas 100 piedras (98–105 según English Heritage), separadas c. 11 m. Dentro hay dos círculos de c. 100 m cada uno: el norte, con 27 piedras y el Cove, y el sur, con 29 piedras y el Obelisco, de 6,4 m, que desapareció después de 1725; un poste de hormigón marca su lugar.",
        "La obra de tierra principal se fecha hacia 2500 a. C.. English Heritage da una actividad del complejo entre c. 2850 y 2200 a. C. Muchas piedras se enterraron o se destruyeron en la Edad Media; en los años 1930 Keiller desenterró y levantó otras de nuevo, de modo que sus posiciones actuales no son todas originales. Las fuentes consultadas no recogen ninguna alineación astronómica publicada.",
      ],
      en: [
        "The henge is 420 m across and encloses about 11.5 ha. The ditch is 23 m wide at the top and 10 m across its flat base, and its original depth was 7 to 10 m (English Heritage says about 9 m). The bank today stands 4.2 to 5.4 m high and once rose almost 17 m above the ditch floor.",
        "The outer circle had about 100 stones (98–105 according to English Heritage), spaced about 11 m apart. Inside are two circles of about 100 m each: the northern one, with 27 stones and the Cove, and the southern one, with 29 stones and the Obelisk, 6.4 m tall, which vanished after 1725; a concrete post marks its place.",
        "The main earthwork dates to about 2500 BC, on a place used earlier; English Heritage gives activity at the complex between about 2850 and 2200 BC. Many stones were buried or destroyed in the Middle Ages; in the 1930s Keiller dug out and re-erected others, so their present positions are not all original. The sources consulted record no published astronomical alignment.",
      ],
    },
    teseo: {
      es: "No hay alineación publicada que comprobar en Avebury. El relieve es una medición con láser desde el aire (LiDAR) de la Environment Agency; Teseo lo simplifica y lo nivela con el relieve de alrededor. Las piedras: OpenStreetMap y LiDAR; la altura de las piedras medida con LiDAR puede quedar corta.",
      en: "There is no published alignment to check at Avebury. The relief is an airborne laser (LiDAR) survey by the Environment Agency; Teseo simplifies it and levels it with the surrounding terrain. The stones: OpenStreetMap and LiDAR; stone height measured with LiDAR may come out short.",
    },
    sources: [
      { label: "Historic England, Avebury henge and stone circles, list entry 1015546", url: "https://www.historicengland.org.uk/listing/the-list/list-entry/1015546" },
      { label: "English Heritage, Avebury: description", url: "https://english-heritage.org.uk/visit/places/avebury/history/description" },
      { label: "English Heritage, Avebury: history", url: "https://www.english-heritage.org.uk/visit/places/avebury/history/" },
      { label: "Gillings, Pollard y Strutt, The origins of Avebury (2019)", url: "https://www.cambridge.org/core/services/aop-cambridge-core/content/view/DB43C9DCF03F2F2B75E487DE0D312B75/S0003598X19000371a.pdf/div-class-title-the-origins-of-avebury-div.pdf" },
      { label: "UNESCO, Stonehenge, Avebury and Associated Sites", url: "https://whc.unesco.org/en/list/373" },
    ],
  },

  silbury: {
    region: "world",
    wiki: { es: "Silbury_Hill", en: "Silbury_Hill" },
    place: { es: "Silbury Hill", en: "Silbury Hill" },
    note: {
      es: "Ves Silbury Hill, el cerro artificial de tiza junto a Avebury, con su foso. Se construyó por etapas hacia 2400 a. C. Las fuentes dan su altura entre 30 y 39,5 m. No hay una relación con el cielo probada.",
      en: "You see Silbury Hill, the artificial chalk mound beside Avebury, with its ditch. It was built in stages around 2400 BC. Sources give its height as anywhere from 30 to 39.5 m. No link to the sky has been proved.",
    },
    piece: { es: "Silbury Hill", en: "Silbury Hill" },
    sub: { es: "cerro artificial · 2400 a. C.", en: "artificial mound · 2400 BC" },
    kind: { es: "Montículo artificial · Inglaterra", en: "Artificial mound · England" },
    facts: {
      es: [
        ["Altura", "entre 30 y 39,5 m según la fuente"],
        ["Diámetro", "160 a 167,6 m según la fuente"],
        ["Foso de cantera", "c. 355 × 240 m como máximo"],
        ["Material", "c. 500 000 t, sobre todo tiza"],
        ["Fecha", "c. 2470–2350 a. C. (English Heritage)"],
      ],
      en: [
        ["Height", "30 to 39.5 m depending on the source"],
        ["Diameter", "160 to 167.6 m depending on the source"],
        ["Quarry ditch", "c. 355 × 240 m at most"],
        ["Material", "c. 500,000 t, mostly chalk"],
        ["Date", "c. 2470–2350 BC (English Heritage)"],
      ],
    },
    body: {
      es: [
        "Las fuentes no coinciden en el tamaño. La altura es de 39,3 m para Historic England, de 39,5 m para la UNESCO, de 30 m para English Heritage y de 31 m para Leary y Marshall: una diferencia de unos 9 m. El foso de cantera alcanza c. 355 m de este a oeste y c. 240 m de norte a sur.",
        "English Heritage describe varias fases: un montículo de grava de menos de 1 m; un anillo de estacas de 16 m de diámetro; un montículo de c. 35 m de diámetro y c. 5 m de alto con un foso de 100 m; y una ampliación final con bancos de tiza, un segundo foso con agua y una extensión rectangular.",
        "En 2007 English Heritage reabrió el túnel de Atkinson (1968), rellenó los vacíos y el cráter de la cima con 1465 t de tiza y devolvió el montículo a una forma lo más cercana posible a la original, de modo que el volumen visible incluye ese relleno moderno. No se sabe para qué servía y las fuentes no recogen ninguna alineación astronómica.",
      ],
      en: [
        "Sources disagree on the size. The height is 39.3 m for Historic England, 39.5 m for UNESCO, 30 m for English Heritage and 31 m for Leary and Marshall: a gap of about 9 m. The quarry ditch reaches about 355 m east to west and about 240 m north to south.",
        "English Heritage describes several phases: a gravel mound under 1 m high; a ring of stakes 16 m across; a mound about 35 m across and 5 m high with a 100 m ditch; and a final enlargement with chalk banks, a second ditch holding water and a rectangular extension.",
        "In 2007 English Heritage reopened Atkinson's tunnel (1968), filled the voids and the summit crater with 1,465 t of chalk, and returned the mound to a shape as close as possible to the original, so the visible volume includes that modern fill. Its purpose is unknown, and the sources record no astronomical alignment.",
      ],
    },
    teseo: {
      es: "No hay alineación publicada que comprobar. La altura del modelo sale de la medición con LiDAR, no de ninguna de las fichas, y el relieve incluye el relleno de 2007. El relieve es una medición con láser desde el aire (LiDAR) de la Environment Agency; Teseo lo simplifica y lo nivela con el relieve de alrededor.",
      en: "There is no published alignment to check. The model's height comes from the LiDAR measurement, not from any of the records, and the relief includes the 2007 fill. The relief is an airborne laser (LiDAR) survey by the Environment Agency; Teseo simplifies it and levels it with the surrounding terrain.",
    },
    sources: [
      { label: "Historic England, Silbury Hill, list entry 1008445 (1994)", url: "https://historicengland.org.uk/listing/the-list/list-entry/1008445" },
      { label: "English Heritage, Silbury Hill: history", url: "https://www.english-heritage.org.uk/visit/places/silbury-hill/history/" },
      { label: "English Heritage, Research on Silbury Hill", url: "https://www.english-heritage.org.uk/visit/places/silbury-hill/history/research" },
      { label: "Leary y Marshall, The Giants of Wessex (Antiquity)", url: "https://antiquity.ac.uk/projgall/leary334/" },
      { label: "UNESCO, Stonehenge, Avebury and Associated Sites", url: "https://whc.unesco.org/en/list/373" },
    ],
  },

  serpentmound: {
    region: "am",
    wiki: { es: "Serpent_Mound", en: "Serpent_Mound" },
    place: { es: "Serpent Mound · Montículo de la Serpiente", en: "Serpent Mound" },
    note: {
      es: "Ves el terraplén de la serpiente sobre su espolón, en Ohio. Mide unos 400 m, con la cabeza en forma de óvalo y la cola enroscada. Su edad se discute: hacia 300 a. C. o hacia 1100 d. C.",
      en: "You see the serpent embankment on its spur in Ohio. It is about 400 m long, with an oval head and a coiled tail. Its age is disputed: about 300 BC or about AD 1100.",
    },
    piece: { es: "Terraplén de la serpiente", en: "Serpent embankment" },
    sub: { es: "efigie · edad discutida", en: "effigy mound · age disputed" },
    kind: { es: "Montículo efigie · Ohio, EE. UU.", en: "Effigy mound · Ohio, USA" },
    facts: {
      es: [
        ["Longitud", "entre 380 y 411 m según la fuente"],
        ["Altura", "1,2 a 1,5 m, menos hacia la cola"],
        ["Edad", "c. 300 a. C. o c. 1070–1120 d. C."],
        ["Restauración", "Putnam, 1886–87"],
        ["UNESCO", "en la Lista Indicativa de EE. UU. (2008)"],
      ],
      en: [
        ["Length", "380 to 411 m depending on the source"],
        ["Height", "1.2 to 1.5 m, lower towards the tail"],
        ["Age", "c. 300 BC or c. AD 1070–1120"],
        ["Restoration", "Putnam, 1886–87"],
        ["UNESCO", "on the US Tentative List (2008)"],
      ],
    },
    body: {
      es: [
        "La serpiente mide 411 m con el óvalo de la cabeza incluido según la Lista Indicativa de EE. UU. y Ohio History Connection; c. 380 m si se estirara de la mandíbula norte a la cola, y al menos 396 m según Schwarz (2020). El cuerpo mide 1,2 a 1,5 m de alto, bajando a 0,3 m hacia la cola, y entre 5 y 9 m de ancho.",
        "La edad sigue sin resolverse. Los núcleos de 2012 dan una mediana de c. 321 a. C. (cultura Adena); el carbón de la excavación de 1991 dentro del efigie da cal 995–1265 d. C., es decir, Fort Ancient, c. 1070–1120 d. C. Lepper y otros defienden una edad Fort Ancient por la iconografía; Romain sostiene que las fechas de la base son Adena; Schwarz dice que el debate sigue abierto.",
        "Putnam excavó en 1886 y restauró el efigie a lo que juzgó sus dimensiones originales, así que la forma actual incluye tierra añadida por él. Se ha propuesto que el eje del óvalo apunta al ocaso del solsticio de verano (acimut c. 300,5° para el año −292, según Romain); otras alineaciones propuestas son más débiles, y la edad condiciona todas.",
      ],
      en: [
        "The serpent is 411 m long including the head oval according to the US Tentative List and Ohio History Connection; about 380 m if stretched from the north jaw to the tail, and at least 396 m according to Schwarz (2020). The body is 1.2 to 1.5 m high, dropping to 0.3 m towards the tail, and 5 to 9 m wide.",
        "The age remains unresolved. The 2012 cores give a median of about 321 BC (Adena culture); charcoal from the 1991 excavation inside the effigy gives cal AD 995–1265, that is, Fort Ancient, c. AD 1070–1120. Lepper and colleagues argue for a Fort Ancient age from the iconography; Romain holds that the dates from the base are Adena; Schwarz says the debate is still open.",
        "Putnam excavated in 1886 and restored the effigy to what he judged its original dimensions, so the present shape includes earth he added. It has been proposed that the axis of the oval points to the summer solstice sunset (azimuth about 300.5° for the year −292, after Romain); other proposed alignments are weaker, and the age affects all of them.",
      ],
    },
    teseo: {
      es: "Para comprobar la propuesta, pon el 21 de junio y avanza hasta la puesta de Sol mirando al noroeste, hacia el eje del óvalo (c. 300,5°, según Romain); la edad no está resuelta. El relieve es una medición con láser desde el aire (LiDAR) del USGS 3DEP; Teseo lo simplifica y lo nivela. La forma incluye la tierra de Putnam.",
      en: "To test the proposal, set 21 June and advance to sunset, looking north-west along the axis of the oval (c. 300.5°, after Romain); the age is unresolved. The relief is an airborne laser (LiDAR) survey by USGS 3DEP; Teseo simplifies it and levels it. The shape includes Putnam's added earth.",
    },
    sources: [
      { label: "US Tentative List, Serpent Mound (Adams County, Ohio) (2008)", url: "https://whc.unesco.org/en/tentativelists/5248" },
      { label: "Ohio History Connection, Serpent Mound", url: "https://www.ohiohistory.org/visit/browse-historical-sites/serpent-mound/" },
      { label: "Romain, Archaeoastronomy and Landscape Archaeology at Serpent Mound (Journal of Astronomy in Culture)", url: "https://escholarship.org/content/qt05g0f6f9/qt05g0f6f9.pdf" },
      { label: "Schwarz, Use and Continuity on the Plateau (2020)", url: "https://www.academia.edu/43589203" },
      { label: "Pickard, Ohio History Connection (2011)", url: "https://www.ohiohistory.org/?p=10533" },
    ],
  },

  cahokia: {
    region: "am",
    wiki: { en: "Monks_Mound" },
    place: { es: "Cahokia · Monks Mound", en: "Cahokia · Monks Mound" },
    note: {
      es: "Ves Monks Mound con sus terrazas, el mayor montículo de Cahokia, ciudad mississippiana de Illinois. Tiene unos 30 m de alto y se levantó en etapas, sobre todo entre 950 y 1150 d. C. Las fuentes discrepan en su cronología y su base.",
      en: "You see Monks Mound with its terraces, the largest mound at Cahokia, a Mississippian city in Illinois. It stands about 30 m high and was raised in stages, mostly between AD 950 and 1150. Sources disagree on its chronology and its base.",
    },
    piece: { es: "Monks Mound", en: "Monks Mound" },
    sub: { es: "montículo · 950–1150 d. C.", en: "mound · AD 950–1150" },
    kind: { es: "Montículo artificial · Illinois, EE. UU.", en: "Artificial mound · Illinois, USA" },
    facts: {
      es: [
        ["Altura", "28 a poco más de 30 m según la fuente"],
        ["Base", "entre 293 × 247 m y 320 × 294 m"],
        ["Terrazas", "cuatro"],
        ["Montículos en el sitio", "51 (UNESCO) o 70 de 120 (Illinois)"],
        ["UNESCO", "Cahokia Mounds, 1982"],
      ],
      en: [
        ["Height", "28 to just over 30 m depending on the source"],
        ["Base", "between 293 × 247 m and 320 × 294 m"],
        ["Terraces", "four"],
        ["Mounds on site", "51 (UNESCO) or 70 of 120 (Illinois)"],
        ["UNESCO", "Cahokia Mounds, 1982"],
      ],
    },
    body: {
      es: [
        "El registro nacional de 1975 da una base de c. 305 × 213 m y 30 m de alto; Schilling (2010), c. 320 × 294 m y poco más de 30 m; Romain (2024), c. 293 × 247 m y 28 m medidos desde la curva de 130 m; y la UNESCO, 30 m y c. 6 ha. El registro nacional y la UNESCO cuentan cuatro terrazas.",
        "La cronología también se discute. Reed y otros proponen 14 etapas desde c. 950 d. C. hasta mediados del siglo XII; Skele, ocho. Schilling prefiere un modelo bayesiano de una sola etapa, de menos de diez años y más tardío de lo habitual; Romain, citándolo, dice que no antes de c. 1050 d. C. El sitio se ocupó entre c. 700 y 1400 d. C., con un pico hacia 1100.",
        "Al oeste hubo unos cinco círculos de postes, el «Woodhenge». Algunos postes marcarían el amanecer en los solsticios y en el equinoccio, pero Romain dice que su uso sigue siendo una pregunta abierta y que solo unos pocos postes alinean. Los postes que se ven hoy son modernos, y un poste réplica marca la cima de Monks Mound.",
      ],
      en: [
        "The 1975 national register gives a base of about 305 × 213 m and 30 m high; Schilling (2010), about 320 × 294 m and just over 30 m; Romain (2024), about 293 × 247 m and 28 m measured from the 130 m contour; and UNESCO, 30 m and about 6 ha. The national register and UNESCO count four terraces.",
        "The chronology is also debated. Reed and colleagues propose 14 stages from about AD 950 to the mid-12th century; Skele, eight. Schilling prefers a single-stage Bayesian model, under ten years and later than usual; Romain, citing him, says not before about AD 1050. The site was occupied between about AD 700 and 1400, peaking around 1100.",
        "To the west stood some five circles of posts, the 'Woodhenge'. Some posts may have marked sunrise at the solstices and the equinox, but Romain says their use remains an open question and that only a few posts line up. The posts you see today are modern, and a replica post marks the top of Monks Mound.",
      ],
    },
    teseo: {
      es: "No proponemos una observación: la relación de Woodhenge con el cielo sigue abierta, y aquí solo se dibuja Monks Mound. La altura y la base del modelo salen de la medición con LiDAR y sirven de árbitro entre las fichas. El relieve es una medición con láser desde el aire (LiDAR) del USGS 3DEP; Teseo lo simplifica y lo nivela.",
      en: "We do not propose an observation: the link between Woodhenge and the sky remains open, and only Monks Mound is drawn here. The model's height and base come from the LiDAR measurement and act as arbiter between the records. The relief is an airborne laser (LiDAR) survey by USGS 3DEP; Teseo simplifies it and levels it.",
    },
    sources: [
      { label: "UNESCO, Cahokia Mounds State Historic Site", url: "https://whc.unesco.org/en/list/198" },
      { label: "Illinois Department of Natural Resources, Cahokia Mounds", url: "https://dnrhistoric.illinois.gov/experience/sites/site.cahokia-mounds.html" },
      { label: "National Park Service, NRHP nomination, Cahokia Mounds (Monks Mound) (1975)", url: "https://npgallery.nps.gov/GetAsset/38743d21-90c5-4c5b-a59e-7c40a9afdd36" },
      { label: "Schilling, An Archaeological Model of the Construction of Monks Mound (2010)", url: "https://core.ac.uk/download/233206439.pdf" },
      { label: "Romain, Archaeoastronomy and Landscape Archaeology at Cahokia (2024)", url: "https://escholarship.org/content/qt285847w8/qt285847w8.pdf?t=sivv4c" },
    ],
  },

  newark: {
    region: "am",
    wiki: { en: "Newark_Earthworks" },
    place: { es: "Newark · Octágono", en: "Newark · Octagon" },
    note: {
      es: "Ves el Octágono de Newark, en Ohio, unido por un pasillo al Círculo del Observatorio, de 321 m de diámetro. Lo hizo la cultura Hopewell entre los años 1 y 400 d. C. Sus muros se han relacionado con salidas y puestas de la Luna.",
      en: "You see the Newark Octagon in Ohio, joined by a passage to the Observatory Circle, 321 m across. The Hopewell culture built it between AD 1 and 400. Its walls have been linked to Moon rise and set points.",
    },
    piece: { es: "Octágono y Círculo del Observatorio", en: "Octagon and Observatory Circle" },
    sub: { es: "geometría lunar · 1–400 d. C.", en: "lunar geometry · AD 1–400" },
    kind: { es: "Recinto de tierra · Ohio, EE. UU.", en: "Earthwork enclosure · Ohio, USA" },
    facts: {
      es: [
        ["Octágono", "16,53 ha; muros de 1,5 a 1,8 m"],
        ["Círculo del Observatorio", "321 m de diámetro, 8,09 ha"],
        ["Observatory Mound", "3,6 m de alto"],
        ["Fecha", "años 1 a 400 d. C."],
        ["UNESCO", "Hopewell Ceremonial Earthworks, 2023"],
      ],
      en: [
        ["Octagon", "16.53 ha; walls 1.5 to 1.8 m high"],
        ["Observatory Circle", "321 m across, 8.09 ha"],
        ["Observatory Mound", "3.6 m high"],
        ["Date", "AD 1 to 400"],
        ["UNESCO", "Hopewell Ceremonial Earthworks, 2023"],
      ],
    },
    body: {
      es: [
        "El Octágono ocupa 16,53 ha. Los dos muros junto a la avenida miden 168 m cada uno, los otros seis son casi idénticos y el muro oeste-suroeste es 9,2 m más corto. Con el Círculo del Observatorio, de 321 m y muros de 1–2 m, encierra más de 24 ha. El Observatory Mound, de 3,6 m, fue la última adición al conjunto.",
        "El conjunto original ocupaba más de 10 km²; hoy solo se conservan el Octágono y el Gran Círculo. Los muros se restauraron desde 1933. El Octágono se arrendó a un club de campo, con campo de golf desde 1911, y en 1968–69 se remodeló con senderos asfaltados sobre los muros en ocho puntos. No toda la altura de los muros es original.",
        "Hively y Horn proponen que el Octágono recoge ocho puntos de salida y puesta de la Luna; el dossier de la UNESCO habla de seis extremos lunares más dos que fija el muro corto. El más destacado es la máxima salida norte de la Luna a lo largo del eje principal, que se repite cada 18,6 años. La alineación del Octágono se considera convincente; no todos los puntos se aceptan.",
      ],
      en: [
        "The Octagon covers 16.53 ha. The two walls beside the avenue are 168 m each, the other six are almost identical, and the west-south-west wall is 9.2 m shorter. With the Observatory Circle, 321 m across with walls of 1–2 m, it encloses over 24 ha. Observatory Mound, 3.6 m high, was the last addition to the complex.",
        "The original complex covered over 10 km²; today only the Octagon and the Great Circle survive. The walls have been restored since 1933, guided mostly by Squier and Davis's descriptions from the 1840s. The Octagon was leased to a country club, with a golf course from 1911, and in 1968–69 it was remodelled with paved paths over the walls at eight points. Not all wall height is original.",
        "Hively and Horn propose that the Octagon records eight principal moonrise and moonset points; the UNESCO dossier speaks of six lunar extremes plus two fixed by the short wall. The most notable is the northernmost moonrise along the main axis, with an error of 0.2°, which recurs every 18.6 years. The Octagon alignment is regarded as convincing; not every point is accepted.",
      ],
    },
    teseo: {
      es: "Busca la salida de la Luna en su extremo norte: ocurre cada 18,6 años (las fuentes no dan los años) y, según Ohio History Connection, entonces sale por el pasillo entre el Círculo del Observatorio y el Octágono. El relieve es una medición con láser desde el aire (LiDAR) del USGS 3DEP; Teseo lo simplifica y lo nivela. ",
      en: "Look in Teseo for the Moon rising at its northern extreme: it happens every 18.6 years (sources do not give the years) and, according to Ohio History Connection, it then rises along the passage between the Observatory Circle and the Octagon. The relief is an airborne laser (LiDAR) survey by USGS 3DEP; Teseo simplifies it and levels it. ",
    },
    sources: [
      { label: "Ohio History Connection y NPS, Hopewell Ceremonial Earthworks, dossier de nominación (2022)", url: "https://whc.unesco.org/document/192681" },
      { label: "Ohio History Connection, Newark Earthworks Site History", url: "https://www.ohiohistory.org/visit/browse-historical-sites/newark-earthworks-site-history/" },
      { label: "Ohio History Connection, The Archaeoastronomy of the Newark Earthworks", url: "https://www.ohiohistory.org/the-archaeoastronomy-of-the-newark-earthworks/" },
      { label: "UNESCO, Hopewell Ceremonial Earthworks", url: "https://whc.unesco.org/en/list/1689" },
    ],
  },

  greatcircle: {
    region: "am",
    wiki: { en: "Newark_Earthworks" },
    place: { es: "Newark · Gran Círculo", en: "Newark · Great Circle" },
    note: {
      es: "Ves el Gran Círculo de Newark, en Ohio, de 358 m de diámetro, con un muro que sube hacia la entrada noreste y un foso interior. Lo hizo la cultura Hopewell entre los años 1 y 400 d. C.",
      en: "You see the Newark Great Circle in Ohio, 358 m across, with a wall that rises towards the north-east entrance and an inner ditch. The Hopewell culture built it between AD 1 and 400.",
    },
    piece: { es: "Gran Círculo", en: "Great Circle" },
    sub: { es: "recinto circular · 1–400 d. C.", en: "circular enclosure · AD 1–400" },
    kind: { es: "Recinto de tierra · Ohio, EE. UU.", en: "Earthwork enclosure · Ohio, USA" },
    facts: {
      es: [
        ["Diámetro", "358 m; 10,07 ha"],
        ["Muro", "c. 1,5 m al suroeste; 5 m en la entrada noreste"],
        ["Foso interior", "8,5 a 12,5 m de ancho; 2 a 4 m de profundidad"],
        ["Eje", "69,15° al este del norte"],
        ["UNESCO", "Hopewell Ceremonial Earthworks, 2023"],
      ],
      en: [
        ["Diameter", "358 m; 10.07 ha"],
        ["Wall", "c. 1.5 m in the south-west; 5 m at the north-east entrance"],
        ["Inner ditch", "8.5 to 12.5 m wide; 2 to 4 m deep"],
        ["Axis", "69.15° east of north"],
        ["UNESCO", "Hopewell Ceremonial Earthworks, 2023"],
      ],
    },
    body: {
      es: [
        "El Gran Círculo mide 358 m de diámetro y ocupa 10,07 ha. Su muro tiene c. 1,5 m en el suroeste y sube hasta 5 m en la entrada noreste. Por dentro corre un foso de 8,5 a 12,5 m de ancho y de 2 a 4 m de profundidad. Es una de las dos obras que se conservan de un conjunto original de más de 10 km².",
        "Los earthworks de la nominación se levantaron entre los años 1 y 400 d. C.; el dossier no separa fechas del Gran Círculo y del Octágono. Los muros desgastados se restauraron desde 1933 y el Cuerpo Civil de Conservación continuó desde 1934, guiándose sobre todo por las descripciones de Squier y Davis de los años 1840. No toda la altura de los muros es original.",
        "Según el dossier, el eje del Gran Círculo, a 69,15° al este del norte, marca salidas en puntos situados entre las posiciones de solsticio y de equinoccio. Una supuesta alineación solsticial en la entrada falla en el sitio: el amanecer queda varios grados fuera. Las propuestas nuevas basadas en colinas se reciben con escepticismo.",
      ],
      en: [
        "The Great Circle is 358 m across and covers 10.07 ha. Its wall is about 1.5 m high in the south-west and rises to 5 m at the north-east entrance. Inside runs a ditch 8.5 to 12.5 m wide and 2 to 4 m deep. It is one of the two works that survive from an original complex of over 10 km².",
        "The earthworks in the nomination were raised between AD 1 and 400; the dossier does not separate dates for the Great Circle and the Octagon. Worn walls have been restored since 1933 and the Civilian Conservation Corps continued from 1934, guided mostly by Squier and Davis's descriptions from the 1840s. Not all wall height is original.",
        "According to the dossier, the axis of the Great Circle, 69.15° east of north, marks rising points between the solstice and equinox positions. A supposed solstice alignment at the entrance fails on site: sunrise falls several degrees outside it. New proposals based on hills are received with scepticism.",
      ],
    },
    teseo: {
      es: "No proponemos una observación: la única alineación solsticial citada en la entrada no se cumple sobre el terreno. El relieve es una medición con láser desde el aire (LiDAR) del USGS 3DEP; Teseo lo simplifica y lo nivela con el relieve de alrededor. Los muros medidos son los restaurados, no necesariamente los originales.",
      en: "We do not propose an observation: the one solstice alignment cited at the entrance does not hold on the ground. The relief is an airborne laser (LiDAR) survey by USGS 3DEP; Teseo simplifies it and levels it with the surrounding terrain. The walls measured are the restored ones, not necessarily the original ones.",
    },
    sources: [
      { label: "Ohio History Connection y NPS, Hopewell Ceremonial Earthworks, dossier de nominación (2022)", url: "https://whc.unesco.org/document/192681" },
      { label: "Ohio History Connection, Newark Earthworks Site History", url: "https://www.ohiohistory.org/visit/browse-historical-sites/newark-earthworks-site-history/" },
      { label: "Ohio History Connection, The Archaeoastronomy of the Newark Earthworks", url: "https://www.ohiohistory.org/the-archaeoastronomy-of-the-newark-earthworks/" },
      { label: "UNESCO, Hopewell Ceremonial Earthworks", url: "https://whc.unesco.org/en/list/1689" },
    ],
  },
  maidencastle: {"region": "world", "wiki": {"en": "Maiden_Castle,_Dorset"}, "place": {"es": "Maiden Castle", "en": "Maiden Castle"}, "note": {"es": "Ves Maiden Castle, en Dorset, una fortaleza de la Edad del Hierro rodeada por varios terraplenes de tierra. Antes hubo en la colina un recinto neolítico y un túmulo alargado, y en el interior se construyó un templo romano-británico tardío. Las fuentes consultadas no recogen ninguna alineación astronómica.", "en": "You see Maiden Castle in Dorset, an Iron Age fortress ringed by several earth ramparts. Earlier, the hill held a Neolithic enclosure and a long mound, and a late Romano-British temple was built inside. The sources consulted record no astronomical alignment."}, "piece": {"es": "Maiden Castle", "en": "Maiden Castle"}, "sub": {"es": "fortaleza · Edad del Hierro", "en": "hillfort · Iron Age"}, "kind": {"es": "Fortaleza de tierra · Inglaterra", "en": "Earthwork hillfort · England"}, "facts": {"es": [["Recinto neolítico", "c. 8 ha; c. 4000 a. C. (Historic England) o 3800 a. C. (Atlas of Hillforts)"], ["Bank barrow", "546 m de largo y 17,5 m de ancho; c. 3500 a. C."], ["Fortaleza inicial", "6,5 ha (Historic England) o c. 7,4 ha (Atlas)"], ["Fortaleza ampliada", "entre 18,5 y 20 ha según la fuente"], ["Defensas finales", "tres terraplenes y dos fosos"], ["Templo romano-británico", "c. 370 d. C.; cella de 5 o 6 m de lado según la fuente"]], "en": [["Neolithic enclosure", "c. 8 ha; c. 4000 BC (Historic England) or 3800 BC (Atlas of Hillforts)"], ["Bank barrow", "546 m long and 17.5 m wide; c. 3500 BC"], ["Initial hillfort", "6.5 ha (Historic England) or c. 7.4 ha (Atlas)"], ["Enlarged hillfort", "between 18.5 and 20 ha depending on the source"], ["Final defences", "three banks and two ditches"], ["Romano-British temple", "c. AD 370; cella 5 or 6 m square depending on the source"]]}, "body": {"es": ["El lugar tiene varias capas. En el extremo este de la colina hubo un recinto neolítico de fosos con pasos de entrada, de c. 8 ha según Historic England. Más tarde se alargó sobre la cima un «bank barrow», un túmulo de 546 m de largo, 17,5 m de ancho y entre 0,5 y 1 m de alto, hacia 3500 a. C. La fecha del recinto varía: c. 4000 a. C. para Historic England, hace unos 5500 años para English Heritage y 3800 a. C. por radiocarbono para el Atlas of Hillforts.", "La fortaleza de la Edad del Hierro empezó con un solo terraplén de tiza de 6,6 m de ancho y c. 3 m de alto, con un foso exterior de 15 m de ancho y c. 6 m de profundidad; encerraba 6,5 ha según Historic England (c. 7,4 ha en el Atlas). En la segunda mitad del siglo III a. C. se amplió hasta 20 ha según Historic England; English Heritage dice que triplicó la superficie original y el Atlas da 18,5 ha en total. La forma final tiene tres terraplenes y dos fosos, y el Atlas da más de 15 m de altura para los taludes.", "English Heritage cuenta más de cien casas redondas dentro de las defensas en su momento de mayor población. Mortimer y Tessa Wheeler excavaron entre 1934 y 1937 y publicaron el informe en 1943; interpretaron un grupo de 34 esqueletos de la puerta este como víctimas de un ataque romano del año 44 d. C. Hacia 370 d. C. se levantó un templo romano-británico en el extremo este del recinto: English Heritage da 5 m de lado a la cella e Historic England, 6 m."], "en": ["The site has several layers. At the east end of the hill stood a Neolithic enclosure of ditches with gaps for entry, about 8 ha according to Historic England. Later a 'bank barrow' was stretched along the hilltop, a mound 546 m long, 17.5 m wide and 0.5 to 1 m high, around 3500 BC. The enclosure's date varies: about 4000 BC for Historic England, about 5,500 years ago for English Heritage, and 3800 BC by radiocarbon for the Atlas of Hillforts.", "The Iron Age fortress began with a single chalk rampart 6.6 m wide and about 3 m high, with an outer ditch 15 m wide and about 6 m deep; it enclosed 6.5 ha according to Historic England (about 7.4 ha in the Atlas). In the second half of the 3rd century BC it was enlarged to 20 ha according to Historic England; English Heritage says it tripled the original area and the Atlas gives 18.5 ha in total. The final form has three banks and two ditches, and the Atlas gives over 15 m for the slopes of the ramparts.", "English Heritage counts more than a hundred roundhouses inside the defences at the peak of population. Mortimer and Tessa Wheeler dug in 1934–37 and published the report in 1943; they read a group of 34 skeletons at the east gate as victims of a Roman attack in AD 44. Around AD 370 a Romano-British temple was built at the east end of the enclosure: English Heritage gives its cella as 5 m square and Historic England as 6 m."]}, "teseo": {"es": "Ninguna de las fuentes consultadas recoge una alineación astronómica en Maiden Castle, así que no proponemos ninguna observación. En el modelo se mezclan los terraplenes de todas las fases. El relieve es una medición con láser desde el aire (LiDAR) de la Environment Agency; Teseo lo simplifica y lo nivela.", "en": "None of the sources consulted records an astronomical alignment at Maiden Castle, so we propose no observation. The model mixes the earthworks of all phases. The relief is an airborne laser (LiDAR) survey by the Environment Agency; Teseo simplifies it and levels it."}, "sources": [{"label": "Historic England, Maiden Castle, list entry 1015775", "url": "https://historicengland.org.uk/listing/the-list/list-entry/1015775"}, {"label": "English Heritage, Maiden Castle: history", "url": "https://www.english-heritage.org.uk/visit/places/maiden-castle/history/"}, {"label": "Atlas of Hillforts of Britain and Ireland (Universidad de Oxford), Maiden Castle, EN3598", "url": "https://hillforts.arch.ox.ac.uk/records/EN3598.html"}]},
  housesteads: {"region": "world", "wiki": {"en": "Housesteads_Roman_Fort", "es": "Fuerte_romano_de_Housesteads"}, "place": {"es": "Muro de Adriano · Housesteads", "en": "Hadrian's Wall · Housesteads"}, "note": {"es": "Ves el fuerte romano de Housesteads, de unas 2 ha, junto al tramo del Muro de Adriano que lo toca, en Northumberland. Se empezó en la década posterior al año 122 d. C. y se pensó para unos 800 soldados. Las fuentes consultadas no recogen ninguna alineación astronómica.", "en": "You see the Roman fort of Housesteads, about 2 ha, beside the stretch of Hadrian's Wall that touches it, in Northumberland. It was begun in the decade after AD 122 and was planned for some 800 soldiers. The sources consulted record no astronomical alignment."}, "piece": {"es": "Fuerte de Housesteads", "en": "Housesteads fort"}, "sub": {"es": "fuerte romano · s. II d. C.", "en": "Roman fort · 2nd c. AD"}, "kind": {"es": "Fuerte romano · Inglaterra", "en": "Roman fort · England"}, "facts": {"es": [["Superficie del fuerte", "2,2 ha (English Heritage) o c. 2 ha (Historic England)"], ["Construcción", "en la década posterior al 122 d. C."], ["Guarnición", "c. 800 hombres; cohors I Tungrorum, del siglo II tardío al IV"], ["Puertas", "cuatro, una por lado"], ["Anchura del Muro", "diez pies romanos, luego ocho (Historic England)"], ["Muro de Adriano", "118 o 130 km según el texto de la UNESCO; inscrito en 1987"]], "en": [["Fort area", "2.2 ha (English Heritage) or c. 2 ha (Historic England)"], ["Construction", "in the decade after AD 122"], ["Garrison", "c. 800 men; cohors I Tungrorum, late 2nd to 4th century"], ["Gates", "four, one on each side"], ["Wall width", "ten Roman feet, later eight (Historic England)"], ["Hadrian's Wall", "118 or 130 km according to UNESCO's text; inscribed 1987"]]}, "body": {"es": ["English Heritage sitúa la obra en los diez años siguientes al 122 d. C., cuando empezó el Muro. El fuerte se empezó antes de que terminaran el Muro y el milecastle 37; el Muro, ya más estrecho, se retomó cuando acabaron las murallas del fuerte. Cubre 2,2 ha según English Heritage y c. 2 ha según Historic England, con una puerta en cada lado cuyos restos se conservan.", "Se diseñó para una cohorte de 800 hombres. La cohors I Tungrorum lo ocupó desde finales del siglo II hasta el IV, con otras unidades desde el siglo III; la última inscripción es de c. 300 d. C. English Heritage dice que el poblado exterior se abandonó casi del todo a finales del siglo III, mientras que Historic England lo ve en su máximo desarrollo en los siglos III y IV: las fuentes no coinciden. Historic England lo sitúa al menos 200 m al sur del fuerte.", "Lo que se visita hoy son muros consolidados. Historic England incluye entre lo consolidado las murallas y las puertas, el cuartel general, la casa del comandante, el hospital, los graneros, los barracones y la letrina, además de 320 m del Muro al este; el milecastle 37 está en parte reconstruido. Ninguna de las fuentes consultadas menciona alineaciones astronómicas."], "en": ["English Heritage places the work in the ten years after AD 122, when the Wall began. The fort was begun before the Wall and milecastle 37 were finished; the Wall, by then narrower, resumed once the fort walls were complete. It covers 2.2 ha according to English Heritage and about 2 ha according to Historic England, with one gate on each side, all with surviving remains.", "It was designed for a cohort of 800 men. The cohors I Tungrorum held it from the late 2nd to the 4th century, with other units from the 3rd; the last inscription dates to about AD 300. English Heritage says the outside settlement was largely abandoned in the late 3rd century, whereas Historic England sees it at its most developed in the 3rd and 4th centuries: the sources disagree. Historic England places it at least 200 m south of the fort.", "What is visited today is consolidated walling. Historic England lists as consolidated the fort walls and gates, the headquarters, the commander's house, the hospital, the granaries, the barracks and the latrine, plus 320 m of the Wall to the east; milecastle 37 is partly reconstructed. None of the sources consulted mentions astronomical alignments."]}, "teseo": {"es": "Ninguna de las fuentes consultadas recoge una alineación astronómica en Housesteads, así que no proponemos ninguna observación. Los muros de piedra consolidados que hoy se visitan no se dibujan como piezas: se ve solo lo que el láser registra del terreno. El relieve es una medición con láser desde el aire (LiDAR) de la Environment Agency; Teseo lo simplifica y lo nivela.", "en": "None of the sources consulted records an astronomical alignment at Housesteads, so we propose no observation. The consolidated stone walls visited today are not drawn as pieces: you see only what the laser records of the ground. The relief is an airborne laser (LiDAR) survey by the Environment Agency; Teseo simplifies it and levels it."}, "sources": [{"label": "Historic England, Housesteads fort and Wall between milecastle 36 and turret 37a, list entry 1018585", "url": "https://historicengland.org.uk/listing/the-list/list-entry/1018585"}, {"label": "English Heritage, Housesteads Roman Fort: history", "url": "https://www.english-heritage.org.uk/visit/places/housesteads-roman-fort-hadrians-wall/history/"}, {"label": "English Heritage, Description of Housesteads Roman Fort", "url": "https://www.english-heritage.org.uk/visit/places/housesteads-roman-fort-hadrians-wall/history/description/"}, {"label": "English Heritage, Significance of Housesteads Roman Fort", "url": "https://www.english-heritage.org.uk/visit/places/housesteads-roman-fort-hadrians-wall/history/significance/"}, {"label": "UNESCO, Hadrian's Wall (Frontiers of the Roman Empire)", "url": "https://whc.unesco.org/en/list/430"}]},
  povertypoint: {"region": "am", "wiki": {"en": "Poverty_Point", "es": "Poverty_Point"}, "place": {"es": "Poverty Point", "en": "Poverty Point"}, "note": {"es": "Ves Poverty Point, en Luisiana: seis crestas de tierra concéntricas en forma de C alrededor de una plaza, y el gran Montículo A. Lo levantaron cazadores-recolectores del Arcaico tardío, entre 1700 y 1100 a. C. según Luisiana. Hay propuestas astronómicas discutidas, no confirmadas.", "en": "You see Poverty Point in Louisiana: six concentric C-shaped earth ridges around a plaza, and the large Mound A. It was raised by Late Archaic hunter-gatherers, between 1700 and 1100 BC according to Louisiana. There are disputed astronomical proposals, not confirmed."}, "piece": {"es": "Crestas y Montículo A", "en": "Ridges and Mound A"}, "sub": {"es": "movimientos de tierra · Arcaico tardío", "en": "earthworks · Late Archaic"}, "kind": {"es": "Movimientos de tierra · Luisiana, EE. UU.", "en": "Earthworks · Louisiana, USA"}, "facts": {"es": [["Crestas", "seis, semielípticas y concéntricas"], ["Diámetro exterior", "1,14 km (UNESCO)"], ["Plaza", "43 acres (c. 17 ha)"], ["Montículo A", "72 pies (c. 22 m) de alto; 710 × 660 pies"], ["Fecha", "1700–1100 a. C. (Luisiana); 3700–3100 a. P. (UNESCO)"], ["UNESCO", "inscrito el 22 de junio de 2014"]], "en": [["Ridges", "six, semi-elliptical and concentric"], ["Outer diameter", "1.14 km (UNESCO)"], ["Plaza", "43 acres (c. 17 ha)"], ["Mound A", "72 ft (c. 22 m) high; 710 × 660 ft"], ["Date", "1700–1100 BC (Louisiana); 3700–3100 BP (UNESCO)"], ["UNESCO", "inscribed 22 June 2014"]]}, "body": {"es": ["El conjunto tiene seis crestas semielípticas con un diámetro exterior de 1,14 km según la UNESCO. La guía del sitio de Luisiana dice que cuatro pasillos cortan cada cresta desde la plaza. La más alta pasa de 6 pies (c. 1,8 m) y las del sur no llegan a 1 pie (c. 0,3 m); las depresiones entre ellas miden entre 65 y 100 pies (c. 20 a 30 m) de ancho. La plaza central ocupa 43 acres (c. 17 ha).", "El Montículo A mide 72 pies de alto (c. 22 m) y 710 × 660 pies (c. 216 × 201 m) según la guía de Luisiana, que lo fecha hacia 1300 a. C. (en otro apartado da 1350 a. C.). Una fecha de radiocarbono de Ortmann y Kidder lo sitúa hacia 3261 años cal. a. P. (c. 1310 a. C.), y concluyen que lo levantó mucha gente en poco tiempo. Para todo el sitio, la UNESCO da 3700–3100 a. P. y Luisiana, 1700–1100 a. C.: fechas casi iguales.", "Sobre astronomía hay propuestas, no hechos aceptados. Brecher y Haag (1983) sugirieron alineaciones solares y quizá estelares; ese año Purrington publicó que la propuesta solar es incorrecta y que cualquier otro marcador astronómico es dudoso. La guía de Luisiana dice que los montículos B, E y A forman una línea norte–sur, probablemente trazada con la Estrella Polar. El texto de la UNESCO no menciona ninguna alineación."], "en": ["The complex has six semi-elliptical ridges with an outer diameter of 1.14 km according to UNESCO. Louisiana's site guide says four aisles cut each ridge from the plaza. The tallest is over 6 ft (about 1.8 m) and those in the south are under 1 ft (about 0.3 m); the swales between them are 65 to 100 ft (about 20 to 30 m) wide. The central plaza covers 43 acres (about 17 ha).", "Mound A is 72 ft high (about 22 m) and 710 × 660 ft (about 216 × 201 m) according to Louisiana's guide, which dates it to about 1300 BC (elsewhere it gives 1350 BC). A radiocarbon date by Ortmann and Kidder puts it at about 3261 cal. years BP (about 1310 BC), and they conclude that a large workforce raised it in a short time. For the whole site, UNESCO gives 3700–3100 BP and Louisiana 1700–1100 BC: nearly the same dates.", "On astronomy there are proposals, not accepted facts. Brecher and Haag (1983) suggested solar and possibly stellar alignments; that same year Purrington published that the solar proposal is incorrect and that any other astronomical markers are doubtful. Louisiana's guide says Mounds B, E and A form a north–south line, probably set out using the North Star. UNESCO's text mentions no alignment."]}, "teseo": {"es": "No proponemos ninguna observación: las alineaciones solares de Brecher y Haag (1983) fueron rechazadas por Purrington (1983), y la línea norte–sur con la Estrella Polar es una interpretación de la guía de Luisiana que aquí no se comprueba. El relieve es una medición con láser desde el aire (LiDAR) del USGS 3DEP; Teseo lo simplifica y lo nivela.", "en": "We propose no observation: the solar alignments of Brecher and Haag (1983) were rejected by Purrington (1983), and the north–south line using the North Star is an interpretation in Louisiana's guide that is not tested here. The relief is an airborne laser (LiDAR) survey by USGS 3DEP; Teseo simplifies it and levels it."}, "sources": [{"label": "UNESCO, Poverty Point", "url": "https://whc.unesco.org/en/list/1435"}, {"label": "Poverty Point World Heritage Site (Luisiana), guía del sitio", "url": "https://www.povertypoint.us/sites/default/files/2025-07/povertypoint.pdf"}, {"label": "Ortmann y Kidder, Building Mound A at Poverty Point, Louisiana (2013)", "url": "https://profiles.wustl.edu/en/publications/building-mound-a-at-poverty-point-louisiana-monumental-public-arc/"}, {"label": "Brecher y Haag, Astronomical Alignments at Poverty Point (American Antiquity, 1983)", "url": "https://core-prod.cambridgecore.org/core/journals/american-antiquity/article/astronomical-alignments-at-poverty-point/1B4C802D2C471740CDCC271090E42252"}, {"label": "Purrington, Supposed Solar Alignments at Poverty Point (American Antiquity, 1983)", "url": "https://cambridge.org/core/journals/american-antiquity/article/supposed-solar-alignments-at-poverty-point/3F5392BEA137DE643E021009EBF0BAAC"}]},
};
