// agencyImages.js — imágenes CURADAS de tres observatorios/agencias europeas, para el cielo profundo:
//   ESA/Webb    (esawebb.org)    · telescopio espacial James Webb  (agency "esa-webb")
//   ESA/Hubble  (esahubble.org)  · telescopio espacial Hubble      (agency "esa-hubble")
//   ESO         (eso.org)        · Observatorio Europeo Austral    (agency "eso"; incluye las imágenes del EHT)
// ÚNICO lugar donde se decide qué imagen de agencia representa a cada objeto. Complementa a
// nasaImages.js (NASA) y a las miniaturas de Wikipedia; el orden de fuentes está en imageSources().
//
// Por qué un mapa hecho a mano y no una búsqueda: cada entrada se eligió mirando la imagen
// (contactos de las versiones «screen») y se comprobó contra la página oficial de la imagen
// (fecha en AGENCY_VERIFIED): id, título, crédito y tipo «Observation» (se descartaron collages,
// ilustraciones y paneles anotados), que la imagen muestra ese objeto, y que la URL «screen»
// existe y es un JPEG.
//
// Licencia: las tres fuentes publican sus imágenes, vídeos y textos bajo Creative Commons
// Atribución 4.0 Internacional (CC BY 4.0), con la condición de acreditarlas de forma clara y
// visible, con el texto del crédito SIN ALTERAR, sin separarlo de la imagen y con enlace activo
// si se muestra en línea; no se puede insinuar que la agencia respalda un producto, y la
// licencia no cubre sus logotipos. Condiciones leídas el 2026-11-16 en:
//   https://esawebb.org/copyright/   https://esahubble.org/copyright/   https://www.eso.org/public/outreach/copyright/
// Por eso la ficha muestra siempre el crédito tal como lo da la página, la agencia y un enlace
// a la página de la imagen; no se usan logotipos. Las imágenes se sirven desde el CDN de cada
// agencia (no se copian). Si una imagen se recorta o se recolorea habría que decirlo después del
// crédito; aquí solo se redimensiona (la versión «screen» ya viene así).
//
//   agency     "esa-webb" | "esa-hubble" | "eso".
//   id         identificador de la imagen en la agencia (weic2216b, heic0602a, eso1907a…).
//   title      título tal como lo da la página.
//   credit     línea de crédito EXACTA de la página («Credit:»), incluidas sus aclaraciones.
//   date       fecha de publicación (release date) de la página.
//   kind       siempre "photo": observación real (las ilustraciones de artista no entran aquí).
//   band       solo si la propia página lo dice: "infrared" (Webb: la página lista sus filtros
//              y son infrarrojos), "radio" (EHT: imagen reconstruida con datos de radio,
//              NO una fotografía) o "mixed" (datos en luz visible y no visible). Sin band: composición
//              de exposiciones con filtros de color en luz visible, que la ficha dice con ese rótulo.
//   processed  true si hay band (luz que el ojo no ve, o imagen reconstruida); la interfaz lo dice.
//   tel        telescopio/instrumento en el rótulo («JWST», «Hubble», «VST», «EHT»…).
//   es / en    qué muestra exactamente la imagen, en una línea.
//
// URLs (comprobadas con HEAD el 2026-11-16: 200, image/jpeg, ≈1280 px de ancho):
//   https://cdn.esawebb.org/archives/images/screen/<id>.jpg
//   https://cdn.esahubble.org/archives/images/screen/<id>.jpg
//   https://cdn.eso.org/images/screen/<id>.jpg
// Las tres respuestas traen «access-control-allow-origin: *» (comprobado el 2026-11-16), de modo que
// podrían dibujarse en un <canvas> sin «tainting»; AGENCY_CANVAS_CORS lo deja anotado, pero la postal
// (postcard.js) NO usa estas imágenes todavía: decidirlo es cosa de quien la mantiene.
//
// Claves: "messier:<n>" (catálogo de Messier), "gal:<NGC…>" (capa de galaxias, por su designación
// OpenNGC tal como viene en el catálogo, p. ej. «NGC5128»), "bh:<nombre>" (capa de agujeros negros) y
// "caldwell:<n>" (capa Caldwell; las Nubes de Magallanes, que no tienen número: "caldwell:LMC" / "caldwell:SMC").
import { imageOrder } from "./nasaImages.js";

export const AGENCY_VERIFIED = "2026-11-16";
export const AGENCY_CANVAS_CORS = true;   // comprobado: ver arriba. No implica que postcard.js la use.
export const AGENCY_LICENSE = { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" };

export const AGENCIES = {
  "esa-webb":   { name: "ESA/Webb",   site: "https://esawebb.org/",           usage: "https://esawebb.org/copyright/",                         pageBase: "https://esawebb.org/images/",              cdnBase: "https://cdn.esawebb.org/archives/images/screen/" },
  "esa-hubble": { name: "ESA/Hubble", site: "https://esahubble.org/",         usage: "https://esahubble.org/copyright/",                       pageBase: "https://esahubble.org/images/",            cdnBase: "https://cdn.esahubble.org/archives/images/screen/" },
  "eso":        { name: "ESO",        site: "https://www.eso.org/public/",    usage: "https://www.eso.org/public/outreach/copyright/",         pageBase: "https://www.eso.org/public/images/",       cdnBase: "https://cdn.eso.org/images/screen/" },
};

export const AGENCY_IMAGES = {
  "messier:16": {"agency":"esa-webb","id":"weic2216b","title":"Webb Takes a Stunning, Star-Filled Portrait of the Pillars of Creation (Full View)","credit":"NASA, ESA, CSA, STScI; J. DePasquale, A. Koekemoer, A. Pagan (STScI).","date":"2022-10-19","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"Los Pilares de la Creación dentro de M16, en infrarrojo cercano (cámara NIRCam del telescopio espacial James Webb)","en":"The Pillars of Creation inside M16, in near-infrared light (NIRCam camera on the James Webb Space Telescope)"},
  "messier:57": {"agency":"esa-webb","id":"weic2320b","title":"Webb captures detailed beauty of Ring Nebula (NIRCam image)","credit":"ESA/Webb, NASA, CSA, M. Barlow, N. Cox, R. Wesson","date":"2023-08-21","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"La Nebulosa del Anillo (M57) en infrarrojo cercano: los filamentos del anillo interior (NIRCam)","en":"The Ring Nebula (M57) in near-infrared light: the filaments of the inner ring (NIRCam)"},
  "messier:1": {"agency":"esa-webb","id":"weic2326a","title":"The Crab Nebula","credit":"NASA, ESA, CSA, STScI, T. Temim (Princeton University)","date":"2023-10-30","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"La Nebulosa del Cangrejo (M1) en infrarrojo cercano y medio (NIRCam y MIRI)","en":"The Crab Nebula (M1) in near- and mid-infrared light (NIRCam and MIRI)"},
  "messier:74": {"agency":"esa-webb","id":"weic2403c","title":"NGC 628","credit":"NASA, ESA, CSA, STScI, J. Lee (STScI), T. Williams (Oxford), PHANGS Team","date":"2024-01-29","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"La galaxia espiral M74 (NGC 628) en infrarrojo cercano y medio (NIRCam y MIRI)","en":"The spiral galaxy M74 (NGC 628) in near- and mid-infrared light (NIRCam and MIRI)"},
  "messier:82": {"agency":"esa-webb","id":"weic2612b","title":"The Cigar Galaxy: M82 (Webb NIRCam image)","credit":"NASA, ESA, CSA, A. Smercina (STScI), T. Williams (University of Manchester). Image processing: A. Pagan (STScI).","date":"2026-06-23","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"La galaxia M82, de disco visto de canto, en infrarrojo cercano (NIRCam): se distinguen millones de estrellas sueltas","en":"The edge-on galaxy M82 in near-infrared light (NIRCam): millions of individual stars can be told apart"},
  "messier:83": {"agency":"esa-webb","id":"potm2310a","title":"No tricks, just treats","credit":"ESA/Webb, NASA & CSA, A. Adamo (Stockholm University) and the FEAST JWST team","date":"2023-10-31","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"Parte de la galaxia espiral barrada M83 en infrarrojo medio (MIRI)","en":"Part of the barred spiral galaxy M83 in mid-infrared light (MIRI)"},
  "messier:104": {"agency":"esa-webb","id":"weic2427a","title":"Sombrero galaxy (MIRI)","credit":"NASA, ESA, CSA, STScI","date":"2024-11-25","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"La galaxia del Sombrero (M104) en infrarrojo medio (MIRI): el polvo de su anillo exterior","en":"The Sombrero Galaxy (M104) in mid-infrared light (MIRI): the dust of its outer ring"},
  "messier:106": {"agency":"esa-webb","id":"potm2407a","title":"The hidden intricacies of Messier 106","credit":"ESA/Webb, NASA & CSA, J. Glenn","date":"2024-08-09","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"Parte de la galaxia espiral M106 (NGC 4258) en infrarrojo cercano (NIRCam)","en":"Part of the spiral galaxy M106 (NGC 4258) in near-infrared light (NIRCam)"},
  "messier:77": {"agency":"esa-webb","id":"potm2604b","title":"Messier 77 (MIRI + NIRCam)","credit":"ESA/Webb, NASA & CSA, A. Leroy","date":"2026-05-07","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"La galaxia espiral barrada M77, con su núcleo activo muy brillante, en infrarrojo (NIRCam y MIRI)","en":"The barred spiral galaxy M77, with its very bright active nucleus, in infrared light (NIRCam and MIRI)"},
  "gal:NGC5128": {"agency":"esa-webb","id":"weic2615b","title":"Centaurus A (MIRI + NIRCam image)","credit":"NASA, ESA, CSA, STScI. Image Processing: A. Pagan (STScI), J. Depasquale (STScI), M. Garcia Marin (ESA Office at STScI)","date":"2026-07-06","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"Centaurus A en infrarrojo (NIRCam y MIRI): el disco deformado de gas y polvo y millones de estrellas resueltas","en":"Centaurus A in infrared light (NIRCam and MIRI): the warped disc of gas and dust and millions of resolved stars"},
  "gal:NGC1365": {"agency":"esa-webb","id":"weic2306e","title":"NGC 1365 (MIRI Image)","credit":"NASA, ESA, CSA, and J. Lee (NOIRLab), A. Pagan (STScI)","date":"2023-02-16","kind":"photo","processed":true,"band":"infrared","tel":"JWST","es":"La galaxia espiral barrada NGC 1365 en infrarrojo medio (MIRI)","en":"The barred spiral galaxy NGC 1365 in mid-infrared light (MIRI)"},
  "messier:8": {"agency":"esa-hubble","id":"heic1808a","title":"Hubble’s 28th birthday picture: The Lagoon Nebula","credit":"NASA, ESA, STScI","date":"2018-04-19","kind":"photo","processed":false,"tel":"Hubble","es":"Detalle de la Nebulosa de la Laguna (M8) en la imagen del Hubble por su 28.º aniversario","en":"Detail of the Lagoon Nebula (M8) in Hubble's 28th-anniversary image"},
  "messier:27": {"agency":"esa-hubble","id":"opo0306a","title":"Close-up of M27, the Dumbbell Nebula","credit":"NASA/ESA and the Hubble Heritage Team (STScI/AURA)","date":"2003-02-10","kind":"photo","processed":false,"tel":"Hubble","es":"Primer plano de la Nebulosa Dumbbell (M27), una nebulosa planetaria, con el Hubble","en":"Close-up of the Dumbbell Nebula (M27), a planetary nebula, with Hubble"},
  "messier:31": {"partial":true,"agency":"esa-hubble","id":"heic1502a","title":"Sharpest ever view of the Andromeda Galaxy","credit":"NASA, ESA, J. Dalcanton (University of Washington, USA), B. F. Williams (University of Washington, USA), L. C. Johnson (University of Washington, USA), the PHAT team, and R. Gendler.","date":"2015-01-05","kind":"photo","processed":false,"tel":"Hubble","es":"Recorte del mosaico del Hubble de la galaxia de Andrómeda (M31): una parte de su disco, con más de cien millones de estrellas","en":"Crop of Hubble's mosaic of the Andromeda Galaxy (M31): part of its disc, showing over a hundred million stars"},
  "messier:42": {"agency":"esa-hubble","id":"heic0601a","title":"Hubble’s sharpest view of the Orion Nebula","credit":"NASA, ESA, M. Robberto (Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team","date":"2006-01-11","kind":"photo","processed":false,"tel":"Hubble","es":"La Nebulosa de Orión (M42) en el mosaico más nítido del Hubble, hecho con 520 imágenes tomadas en cinco colores","en":"The Orion Nebula (M42) in Hubble's sharpest mosaic, made from 520 images taken in five colours"},
  "messier:51": {"agency":"esa-hubble","id":"heic0506a","title":"Out of this whirl: The Whirlpool Galaxy (M51) and companion galaxy","credit":"NASA, ESA, S. Beckwith (STScI), and The Hubble Heritage Team (STScI/AURA)","date":"2005-04-25","kind":"photo","processed":false,"tel":"Hubble","es":"La galaxia del Remolino (M51) y su compañera NGC 5195, con el Hubble","en":"The Whirlpool Galaxy (M51) and its companion NGC 5195, with Hubble"},
  "messier:81": {"agency":"esa-hubble","id":"opo1438b","title":"Spiral galaxy M81","credit":"NASA, ESA, A. Zezas (CfA), and A. Filippenko (UC Berkeley) Acknowledgment: Hubble Heritage Team (STScI/AURA) & O. Fox (University of California, Berkeley)","date":"2014-09-10","kind":"photo","processed":false,"tel":"Hubble","es":"Detalle de la galaxia espiral M81 (galaxia de Bode) con el Hubble: su núcleo y parte de los brazos","en":"Detail of the spiral galaxy M81 (Bode's Galaxy) with Hubble: its core and part of its arms"},
  "messier:87": {"agency":"esa-hubble","id":"opo0020a","title":"A cosmic searchlight","credit":"The Hubble Heritage Team (STScI/AURA) and NASA/ESA","date":"2000-07-06","kind":"photo","processed":false,"tel":"Hubble","es":"La galaxia elíptica gigante M87 con el chorro de partículas lanzado por su agujero negro central (Hubble)","en":"The giant elliptical galaxy M87 with the particle jet launched by its central black hole (Hubble)"},
  "messier:101": {"agency":"esa-hubble","id":"heic0602a","title":"Largest ever galaxy portrait - stunning HD image of Pinwheel Galaxy","credit":"Image: European Space Agency & NASA","date":"2006-02-28","kind":"photo","processed":false,"tel":"Hubble","es":"La galaxia del Molinete (M101) en el retrato más grande de una galaxia espiral hecho por el Hubble","en":"The Pinwheel Galaxy (M101) in the largest portrait of a spiral galaxy made by Hubble"},
  "messier:80": {"agency":"esa-hubble","id":"opo9926a","title":"Hubble images a swarm of ancient stars","credit":"The Hubble Heritage Team (AURA/STScI/NASA/ESA)","date":"1999-07-01","kind":"photo","processed":false,"tel":"Hubble","es":"El cúmulo globular M80, uno de los más densos de la Vía Láctea, con el Hubble","en":"The globular cluster M80, one of the densest in the Milky Way, with Hubble"},
  "messier:15": {"agency":"esa-hubble","id":"heic1321a","title":"New Hubble image of star cluster Messier 15","credit":"NASA, ESA","date":"2013-11-14","kind":"photo","processed":true,"band":"mixed","tel":"Hubble","es":"El cúmulo globular M15, con datos del Hubble en ultravioleta, visible e infrarrojo","en":"The globular cluster M15, with Hubble data in ultraviolet, optical and infrared light"},
  "gal:NGC1300": {"agency":"esa-hubble","id":"opo0501a","title":"A poster-size image of the beautiful barred spiral galaxy NGC 1300","credit":"NASA, ESA, and The Hubble Heritage Team (STScI/AURA)","date":"2005-01-11","kind":"photo","processed":false,"tel":"Hubble","es":"La galaxia espiral barrada NGC 1300, completa, con el Hubble","en":"The barred spiral galaxy NGC 1300, complete, with Hubble"},
  "gal:NGC4038": {"agency":"esa-hubble","id":"potw1345a","title":"Antennae Galaxies reloaded","credit":"ESA/Hubble & NASA","date":"2013-11-11","kind":"photo","processed":true,"band":"mixed","tel":"Hubble","es":"Las galaxias Antennae (NGC 4038 y NGC 4039) en colisión, con datos del Hubble en luz visible e infrarrojo cercano","en":"The colliding Antennae Galaxies (NGC 4038 and NGC 4039), with Hubble data in visible and near-infrared light"},
  "gal:NGC1672": {"agency":"esa-hubble","id":"heic0706a","title":"Stellar nursery in the arms of NGC 1672","credit":"NASA, ESA","date":"2007-04-03","kind":"photo","processed":false,"tel":"Hubble","es":"La galaxia espiral barrada NGC 1672, con cúmulos de estrellas jóvenes azules y gas de hidrógeno rojo en sus brazos (Hubble)","en":"The barred spiral galaxy NGC 1672, with young blue star clusters and red hydrogen gas along its arms (Hubble)"},
  "gal:NGC1512": {"agency":"esa-hubble","id":"heic1712a","title":"NGC 1512 and NGC 1510","credit":"ESA/Hubble, NASA","date":"2017-07-27","kind":"photo","processed":false,"tel":"Hubble","es":"NGC 1512 (galaxia espiral barrada, a la izquierda) y la galaxia enana NGC 1510 (derecha), que se están fusionando; composición de dos tomas del Hubble","en":"NGC 1512 (barred spiral, left) and the dwarf galaxy NGC 1510 (right), which are merging; composite of two Hubble pointings"},
  "bh:M87*": {"agency":"eso","id":"eso1907a","title":"First Image of a Black Hole","credit":"EHT Collaboration","date":"2019-04-10","kind":"photo","processed":true,"band":"radio","tel":"EHT","es":"Primera imagen de un agujero negro: la sombra del de M87, reconstruida con datos de radio del Event Horizon Telescope (no es una fotografía)","en":"First image of a black hole: the shadow of the one in M87, reconstructed from Event Horizon Telescope radio data (not a photograph)"},
  "bh:Sgr A*": {"agency":"eso","id":"eso2208-eht-mwa","title":"First image of our black hole","credit":"EHT Collaboration","date":"2022-05-12","kind":"photo","processed":true,"band":"radio","tel":"EHT","es":"Primera imagen del agujero negro del centro de la Vía Láctea, Sgr A*, reconstruida con datos de radio del Event Horizon Telescope (no es una fotografía)","en":"First image of the black hole at the centre of the Milky Way, Sgr A*, reconstructed from Event Horizon Telescope radio data (not a photograph)"},
  "messier:17": {"agency":"eso","id":"eso1119a","title":"VST image of the star-forming region Messier 17","credit":"ESO/INAF-VST/OmegaCAM. Acknowledgement: OmegaCen/Astro-WISE/Kapteyn Institute","date":"2011-06-08","kind":"photo","processed":false,"tel":"VST","es":"La Nebulosa Omega (M17) completa, con el telescopio VST de ESO en Paranal","en":"The whole Omega Nebula (M17), with ESO's VST telescope at Paranal"},
  "messier:20": {"agency":"eso","id":"eso0930a","title":"The Trifid Nebula","credit":"ESO","date":"2009-08-26","kind":"photo","processed":false,"tel":"MPG/ESO 2.2 m","es":"La Nebulosa Trífida (M20) con la cámara WFI del telescopio MPG/ESO de 2,2 m en La Silla","en":"The Trifid Nebula (M20) with the WFI camera on the MPG/ESO 2.2-metre telescope at La Silla"},
  "messier:33": {"agency":"eso","id":"eso1424a","title":"VST snaps a very detailed view of the Triangulum Galaxy","credit":"ESO","date":"2014-08-06","kind":"photo","processed":false,"tel":"VST","es":"La galaxia del Triángulo (M33) con el telescopio VST de ESO","en":"The Triangulum Galaxy (M33) with ESO's VST telescope"},
  "messier:78": {"agency":"eso","id":"eso1105a","title":"Messier 78: a reflection nebula in Orion","credit":"ESO/Igor Chekalin","date":"2011-02-16","kind":"photo","processed":false,"tel":"MPG/ESO 2.2 m","es":"M78, una nebulosa de reflexión en Orión, con la cámara WFI del telescopio MPG/ESO de 2,2 m","en":"M78, a reflection nebula in Orion, with the WFI camera on the MPG/ESO 2.2-metre telescope"},
  "messier:7": {"agency":"eso","id":"eso1406a","title":"The star cluster Messier 7","credit":"ESO","date":"2014-02-19","kind":"photo","processed":false,"tel":"MPG/ESO 2.2 m","es":"El cúmulo abierto M7, en Escorpio, con la cámara WFI del telescopio MPG/ESO de 2,2 m","en":"The open cluster M7, in Scorpius, with the WFI camera on the MPG/ESO 2.2-metre telescope"},
  "gal:NGC4945": {"agency":"eso","id":"eso0931a","title":"Spiral galaxy NGC 4945","credit":"ESO","date":"2009-09-02","kind":"photo","processed":false,"tel":"MPG/ESO 2.2 m","es":"La galaxia espiral NGC 4945, vista de canto, con el telescopio MPG/ESO de 2,2 m","en":"The edge-on spiral galaxy NGC 4945, with the MPG/ESO 2.2-metre telescope"},
  "gal:NGC2442": {"agency":"eso","id":"ngc2442","title":"Distorted galaxy NGC 2442","credit":"ESO/IDA/Danish 1.5 m/R. Gendler, J.-E. Ovaldsen, C. C. Thöne and C. Féron","date":"2009-12-03","kind":"photo","processed":false,"tel":"Danish 1.5 m","es":"La galaxia deformada NGC 2442 («del gancho de carnicero»), con el telescopio danés de 1,5 m en La Silla","en":"The distorted galaxy NGC 2442 (the «Meathook Galaxy»), with the Danish 1.5-metre telescope at La Silla"},
  // capa Caldwell (public/caldwell.json): verificadas el 2026-11-16 en la página oficial de cada imagen (tipo
  // «Observation», título, crédito, fecha y filtros) y mirando la versión «screen». ESO marca con «*» algunas
  // imágenes destacadas en el título de la página: ese asterisco no forma parte del título y no se copia.
  "caldwell:92": {"agency":"eso","id":"eso1250a","title":"The Carina Nebula imaged by the VLT Survey Telescope","credit":"ESO. Acknowledgement: VPHAS+ Consortium/Cambridge Astronomical Survey Unit","date":"2012-12-06","kind":"photo","processed":false,"tel":"VST","es":"La Nebulosa de Carina (C92) entera, con el telescopio VST de ESO en Paranal","en":"The whole Carina Nebula (C92), with ESO's VST telescope at Paranal"},
  "caldwell:103": {"agency":"eso","id":"eso0613a","title":"Cosmic spider: the Tarantula Nebula","credit":"ESO","date":"2006-04-07","kind":"photo","processed":false,"tel":"VLT","es":"La Nebulosa de la Tarántula (C103), en la Gran Nube de Magallanes, con el instrumento FORS1 del VLT","en":"The Tarantula Nebula (C103), in the Large Magellanic Cloud, with the FORS1 instrument on the VLT"},
  "caldwell:63": {"agency":"eso","id":"eso0907a","title":"The Helix Nebula","credit":"ESO","date":"2009-02-25","kind":"photo","processed":false,"tel":"MPG/ESO 2.2 m","es":"La Nebulosa de la Hélice (C63), una nebulosa planetaria, con la cámara WFI del telescopio MPG/ESO de 2,2 m","en":"The Helix Nebula (C63), a planetary nebula, with the WFI camera on the MPG/ESO 2.2-metre telescope"},
  "caldwell:65": {"agency":"eso","id":"eso1152a","title":"Wide-field view of NGC 253 from the VLT Survey Telescope","credit":"ESO/INAF-VST Acknowledgement: A. Grado/L. Limatola/INAF-Capodimonte Observatory","date":"2011-12-15","kind":"photo","processed":true,"band":"mixed","tel":"VST","es":"La galaxia del Escultor (NGC 253) con el telescopio VST de ESO, en luz visible y en el borde del infrarrojo (filtro i)","en":"The Sculptor Galaxy (NGC 253) with ESO's VST telescope, in visible light and at the edge of the infrared (i filter)"},
  "caldwell:80": {"agency":"eso","id":"eso1119b","title":"VST image of the giant globular cluster Omega Centauri","credit":"ESO/INAF-VST/OmegaCAM. Acknowledgement: A. Grado, L. Limatola/INAF-Capodimonte Observatory","date":"2011-06-08","kind":"photo","processed":true,"band":"mixed","tel":"VST","es":"El cúmulo globular Omega Centauri (C80) con el telescopio VST de ESO, en luz visible y en el borde del infrarrojo (filtro i)","en":"The globular cluster Omega Centauri (C80) with ESO's VST telescope, in visible light and at the edge of the infrared (i filter)"},
  "caldwell:106": {"agency":"eso","id":"eso1302a","title":"The globular star cluster 47 Tucanae","credit":"ESO/M.-R. Cioni/VISTA Magellanic Cloud survey. Acknowledgment: Cambridge Astronomical Survey Unit","date":"2013-01-10","kind":"photo","processed":true,"band":"infrared","tel":"VISTA","es":"El cúmulo globular 47 Tucanae (C106) en infrarrojo cercano, con el telescopio VISTA de ESO","en":"The globular cluster 47 Tucanae (C106) in near-infrared light, with ESO's VISTA telescope"},
  "caldwell:94": {"agency":"eso","id":"eso0940a","title":"A snapshot of the Jewel Box cluster with the ESO VLT","credit":"ESO/Y. Beletsky","date":"2009-10-29","kind":"photo","processed":false,"tel":"VLT","es":"El cúmulo del Joyero (C94), en la Cruz del Sur, con el instrumento FORS1 del VLT","en":"The Jewel Box cluster (C94), in the Southern Cross, with the FORS1 instrument on the VLT"},
  "caldwell:SMC": {"agency":"eso","id":"eso1714a","title":"VISTA’s view of the Small Magellanic Cloud","credit":"ESO/VISTA VMC","date":"2017-05-03","kind":"photo","processed":true,"band":"infrared","tel":"VISTA","es":"La Pequeña Nube de Magallanes en infrarrojo cercano, con el telescopio VISTA de ESO (a la derecha, el cúmulo 47 Tucanae)","en":"The Small Magellanic Cloud in near-infrared light, with ESO's VISTA telescope (on the right, the cluster 47 Tucanae)"},
};

// Objetos que se pidieron y NO tienen entrada, con el motivo (decisión visible, no un olvido).
// Se revisaron las categorías de nebulosas, galaxias y cúmulos de ESA/Webb y ESA/Hubble (primeras páginas) y de ESO (primera página).
export const AGENCY_NONE = {
  "caldwell:LMC": "Gran Nube de Magallanes: la búsqueda «large magellanic cloud» de ESO (16-nov-2026) solo da regiones dentro de ella o fotos de paisaje, no una observación de la galaxia entera; Hubble y Webb solo cubren campos de minutos de arco y la Nube mide unos 10°",
  "messier:45": "Pléyades: no se encontró (16-nov-2026) en las categorías revisadas de ESA/Webb, ESA/Hubble y ESO una observación del cúmulo entero",
  "messier:43, messier:64, messier:2, messier:13": "no se encontró (16-nov-2026) en las categorías revisadas una observación del objeto que cumpla los criterios",
};

const GAL = /^(NGC|IC)\d+[A-Z]?$/;
/** Clave del mapa para un objeto ("messier:42", "gal:NGC5128", "bh:Sgr A*", "caldwell:80"), o null. */
export function agencyKey(obj) {
  if (!obj || !obj.layer) return null;
  if (obj.layer === "messier") return obj.m != null ? "messier:" + obj.m : null;
  if (obj.layer === "galaxies") return obj.cat && GAL.test(obj.cat) ? "gal:" + obj.cat : null;
  if (obj.layer === "blackholes") return obj.name ? "bh:" + obj.name : null;
  if (obj.layer === "caldwell") return obj.c != null ? "caldwell:" + obj.c : obj.name ? "caldwell:" + obj.name : null;
  return null;
}

/** URL de la versión «screen» (≈1280 px) de una imagen. */
export const agencyUrl = (agency, id) => `${AGENCIES[agency].cdnBase}${encodeURIComponent(id)}.jpg`;
/** Página oficial de la imagen en la agencia. */
export const agencyPage = (agency, id) => `${AGENCIES[agency].pageBase}${encodeURIComponent(id)}/`;

/**
 * Imagen de agencia de un objeto, lista para usar:
 *   { agency, agencyName, id, title, credit, date, kind, processed, band, tel, es, en, license, key, src, page, usage }
 * o null si no hay entrada (entonces: Wikipedia, NASA y, si no, representación propia).
 */
export function agencyImageFor(obj) {
  const key = agencyKey(obj), e = key && AGENCY_IMAGES[key];
  if (!e) return null;
  return { ...e, key, agencyName: AGENCIES[e.agency].name, processed: !!e.processed, license: AGENCY_LICENSE.name, src: agencyUrl(e.agency, e.id), page: agencyPage(e.agency, e.id), usage: AGENCIES[e.agency].usage };
}

/** Clave del rótulo (t.agencyKind[…]) que dice qué clase de imagen es. */
export const agencyKindKey = (e) => (e.band === "infrared" ? "infrared" : e.band === "radio" ? "radio" : e.band === "mixed" ? "mixed" : "observation");

/**
 * Orden de las fuentes de imagen de un objeto, con la agencia incluida:
 *   cielo profundo con imagen de agencia → ["agency", "wiki", "nasa"]
 *   todo lo demás                        → el de imageOrder() (NASA/Wikipedia), sin cambios.
 * Razón: para una nebulosa o galaxia, una observación publicada por el observatorio, con título y
 * crédito exactos, es mejor primera opción que la miniatura que elija Wikipedia; si no carga se
 * pasa a la siguiente fuente. imageOrder() no se toca: lo usan la postal y test_sky_nasa.
 */
export function imageSources(obj) {
  const e = agencyImageFor(obj);
  // `partial`: la imagen de agencia muestra solo una parte del objeto (M31: una franja de su disco); en la ficha va
  // primero una imagen del objeto entero (Wikipedia) y la de agencia queda de respaldo y para el cielo
  if (e && e.partial) return ["wiki", "agency", "nasa"];
  return e ? ["agency", "wiki", "nasa"] : imageOrder(obj);
}

// caché en memoria del resultado de cargar cada imagen: "ok" | "fail" (no se reintenta en la misma sesión)
const status = new Map();
export const agencyStatus = (e) => status.get(e.agency + "/" + e.id) || null;
export const setAgencyStatus = (e, s) => { status.set(e.agency + "/" + e.id, s); };
