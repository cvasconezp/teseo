// spectrumText.js — textos (ES/EN) del recorrido «¿Cómo sabemos de qué están hechas las estrellas?».
// Mismo mecanismo que TIME_T: diccionario por idioma; las entradas con datos son funciones y las
// cifras llegan ya formateadas desde SpectrumTour.jsx (que las calcula con spectrumData.js).
// Las fechas y cifras históricas de aquí se comprueban en scripts/test_questions_spectrum.mjs.

const fingerprintEs = (vis, nir, kind) => {
  const what = kind === "atom" ? "líneas" : "bandas";
  return [vis.length ? `${what} visibles: ${vis.join(", ")} nm` : "", nir.length ? `infrarrojo cercano: ≈ ${nir.join(", ")} nm` : ""].filter(Boolean).join(" · ");
};
const fingerprintEn = (vis, nir, kind) => {
  const what = kind === "atom" ? "visible lines" : "visible bands";
  return [vis.length ? `${what}: ${vis.join(", ")} nm` : "", nir.length ? `near infrared: ≈ ${nir.join(", ")} nm` : ""].filter(Boolean).join(" · ");
};

export const SPEC_T = {
  es: {
    title: "¿Cómo sabemos de qué están hechas las estrellas?",
    lead: "Nadie ha traído un trozo de una estrella lejana y, sin embargo, sabemos qué elementos tiene. El truco: la luz lleva escrito un código de barras. Aquí lo lees, lo armas tú mismo y lo usas para adivinar.",

    species: {
      H: "Hidrógeno", He: "Helio", Na: "Sodio", Ca: "Calcio", Mg: "Magnesio", Fe: "Hierro",
      O2: "Oxígeno", H2O: "Vapor de agua", CO2: "Dióxido de carbono", CH4: "Metano", TiO: "Óxido de titanio",
    },

    // ── Paso 1 ──
    s1: {
      title: "1 · La luz trae un código de barras",
      lead: "Un prisma separa la luz blanca en todos sus colores. Y si miras con cuidado, cada elemento químico absorbe o emite unos colores exactos, siempre los mismos. Esas líneas son su huella dactilar.",
      prismAria: "Un rayo de luz blanca entra en un prisma de vidrio y sale abierto en abanico, del violeta al rojo.",
      prism: "El abanico es el espectro. Tu ojo ve los colores mezclados; el prisma los ordena por longitud de onda, medida en nanómetros (nm): el violeta ronda los 400 nm y el rojo los 700.",
      stripsTitle: "El mismo gas, tres maneras de verlo",
      stripsAria: "Tres franjas de colores. La primera es un arcoíris continuo. La segunda es negra con cuatro rayas brillantes de hidrógeno. La tercera es un arcoíris con esas mismas cuatro rayas oscuras, en los mismos lugares.",
      strips: [
        ["Arriba:", "luz de todos los colores, sin huecos."],
        ["En medio:", "hidrógeno caliente y ralo. Solo emite cuatro colores exactos (410, 434, 486 y 656 nm)."],
        ["Abajo:", "luz de todos los colores atravesando hidrógeno más frío. El gas se queda justo con esos cuatro colores: quedan rayas oscuras en el mismo sitio."],
      ],
      rule: "Eso es lo que explicó Kirchhoff: un gas caliente da líneas brillantes y un gas más frío delante de una luz continua da líneas oscuras, en las mismas posiciones. Una estrella es lo segundo: un interior muy brillante y una atmósfera más fría encima. Las posiciones de las líneas de cada elemento se miden en el laboratorio; por eso, al verlas en una estrella, sabemos qué hay.",
      tagNote: "las longitudes de onda se miden en el laboratorio",
      timelineTitle: "Cómo se descubrió",
      timeline: [
        { year: "1666–1672", who: "Isaac Newton y el prisma", text: "Newton hace pasar la luz del Sol por un prisma y obtiene el arcoíris completo. Lo llama «espectro». Lo cuenta en 1672, en su primer artículo a la Royal Society.", refs: ["newton"] },
        { year: "1814", who: "Fraunhofer cataloga las líneas oscuras del Sol", text: "Joseph von Fraunhofer ve que el espectro del Sol está cruzado por cientos de rayas oscuras (más de 570) y rotula las más notorias con letras: A, B, C, D… Aún nadie sabe qué son.", refs: ["fraunhofer"] },
        { year: "1859–1860", who: "Kirchhoff y Bunsen", text: "Gustav Kirchhoff y Robert Bunsen comprueban que cada elemento calentado emite sus propias líneas, y que varias coinciden con las oscuras de Fraunhofer: son absorción de esos elementos en la atmósfera del Sol. En 1859 mostraron que el Sol contiene sodio.", refs: ["kirchhoff"] },
        { year: "1868", who: "El helio, descubierto primero en el Sol", text: "El 18 de agosto de 1868, durante un eclipse total, Jules Janssen ve en el borde del Sol una línea amarilla brillante, cerca de 587,5 nm. Norman Lockyer la observa el 20 de octubre y propone un elemento nuevo: «helio», de la palabra griega para el Sol. En la Tierra no se aisló hasta 1895 (William Ramsay).", refs: ["helium"] },
        { year: "1925", who: "Cecilia Payne", text: "En su tesis, Cecilia Payne usó las líneas y la teoría de ionización de Saha para mostrar que las estrellas son sobre todo hidrógeno y helio. Henry Norris Russell dudó de su resultado; en 1929 llegó a lo mismo por otro camino y mencionó su trabajo.", refs: ["payne", "payneBio"] },
      ],
    },

    // ── Paso 2 ──
    s2: {
      title: "2 · Arma una atmósfera",
      lead: "Pon elementos y moléculas en la mezcla y mira aparecer sus huellas sobre el arcoíris de una estrella. Cambia la temperatura de la luz o prueba un atajo: Tierra, Marte, Venus, Júpiter o el Sol.",
      modeLabel: "¿Dónde está el gas?",
      modes: { star: "En una estrella", planet: "En un planeta" },
      modeNote: {
        star: "Miras la luz de una estrella. Las capas de gas de su superficie, más frías que el interior, se comen colores. Cuánto se ve cada elemento depende de la temperatura: el hidrógeno y el helio necesitan mucho calor para dejar líneas, y las moléculas se rompen.",
        planet: "Miras la luz de una estrella reflejada por un planeta. Entra en la atmósfera, rebota y sale cruzándola otra vez: el gas, frío, se come colores. Aquí lo que importa son las moléculas; los átomos solo cuentan si la línea sale de su estado más bajo.",
      },
      tempLabel: "Temperatura de la luz",
      classWord: "clase",
      tempAria: (k, cls, peak) => `${k} kelvin, estrella de clase ${cls}, con el pico de emisión en ${peak} nanómetros`,
      temps: { sun: "Sol 5.772 K", m: "Roja tipo M 3.300 K", b: "Azul tipo B 15.000 K" },
      peakNote: (p) => `La curva de fondo es la de un cuerpo negro. Su pico, según la ley de Wien, cae en ${p} nm: más caliente es más azul; más fría, más roja.`,
      speciesTitle: "Qué hay en la mezcla",
      speciesHint: "Toca cada uno para ponerlo o quitarlo. Todos los de la lista tienen posiciones verificadas.",
      silentShort: "sin líneas aquí",
      on: "puesto",
      off: "quitado",
      amountLabel: (name) => `Cantidad de ${name.toLowerCase()}`,
      amountHint: "ilustrativa",
      amountAria: (name, pct) => `${name}: ${pct} por ciento de la cantidad máxima dibujada (ilustrativa)`,
      readTitle: "Lo que se ve ahora",
      emptyMix: "La mezcla está vacía: sin gas, la luz llega entera, sin ninguna raya.",
      nothingDrawn: "Con estas condiciones ninguna de tus opciones deja líneas visibles.",
      readItem: (vis, nir) => [vis.length ? `en el visible: ${vis.join(", ")} nm` : "", nir.length ? `en el infrarrojo cercano: ${nir.join(", ")} nm` : ""].filter(Boolean).join(" · "),
      silent: {
        cold: () => "En un gas frío este átomo casi no deja líneas visibles: hace falta el calor de una estrella para excitarlo o ionizarlo.",
        hot: () => "A la temperatura de una estrella esta molécula se rompe y no deja bandas. Pruébala en «En un planeta».",
        class: () => "A esta temperatura no deja líneas apreciables en el visible. Cambia la temperatura: cada elemento tiene la suya.",
        tio: () => "Solo sobrevive en el gas de estrellas frías (tipo M, por debajo de unos 4.000 K), no en la atmósfera de un planeta templado.",
      },
      nirOnly: "Algunas moléculas tienen sus bandas en el infrarrojo cercano, que el ojo no ve: están en la tira de abajo, no en el arcoíris.",
      tagPositions: "posiciones medidas",
      tagDepths: "profundidad: esquema",
      presetsLabel: "Atajos de mezcla",
      presets: { earth: "Tierra", mars: "Marte", venus: "Venus", jupiter: "Júpiter", sun: "Sol" },
      presetNotes: {
        earth: "La Tierra: oxígeno (O₂) y vapor de agua (H₂O). El nitrógeno (78 % del aire) casi no deja líneas. Las bandas del O₂ a 687 y 760 nm son las que Fraunhofer rotuló B y A.",
        mars: "Marte: 95,1 % CO₂, pero con una atmósfera de unos 6 mb. Casi todo ocurre en el infrarrojo cercano, cerca de 1.600 y 2.000 nm.",
        venus: "Venus: el mismo gas que Marte (96,5 % CO₂) pero a 92 bar: unas 14.000 veces más denso. Las mismas bandas, mucho más profundas.",
        jupiter: "Júpiter: casi todo es H₂ y helio, que casi no dejan líneas en estos colores. Lo que se ve es el metano: 619 y 727 nm y, muy fuerte, 890 nm.",
        sun: "El Sol: líneas de hidrógeno, sodio, calcio, magnesio y hierro. El helio está en el Sol, pero a 5.772 K casi no deja líneas visibles en su superficie.",
      },
      customNote: "Tu mezcla. Prueba a poner el helio con luz roja y con luz azul: mismo gas, otro resultado.",
      pvs: {
        title: "Planeta o estrella: no es lo mismo",
        teaser: "De dónde viene la luz y dónde está el gas.",
        tagNote: "explicación simplificada",
        p1: "Una estrella brilla con luz propia. Su espectro es un arcoíris de fondo, casi un cuerpo negro, al que las capas más frías de su atmósfera les comen colores. Lo que se ve depende de la temperatura: el hidrógeno solo deja sus líneas de Balmer si está lo bastante caliente para tener electrones en el segundo nivel (por eso son máximas en las estrellas tipo A), y el helio pide aún más calor.",
        p2: "Un planeta no brilla: refleja luz de su estrella. La luz entra en la atmósfera, rebota en nubes o suelo y sale cruzándola otra vez. El gas frío solo absorbe lo que parte de su estado más bajo: moléculas como H₂O, CO₂, CH₄ u O₂ (con bandas sobre todo en el infrarrojo cercano) y poco más, como el sodio. Por eso el hidrógeno y el helio, casi todo Júpiter, no dejan líneas en luz visible.",
        p3: "Para no simplificar de más: el espectro real de un planeta lleva también las líneas oscuras del propio Sol, que los astrónomos restan; las nubes y la dispersión cambian la forma y la profundidad de las bandas; y desde el suelo se mezcla con la atmósfera de la Tierra, que añade sus propias bandas de O₂ y H₂O. Aquí se dibuja solo lo esencial.",
      },
      n2: {
        title: "¿Y el nitrógeno?",
        teaser: "El 78 % del aire casi no deja líneas.",
        tagNote: "explicación estándar de física molecular",
        p1: "El N₂ es el gas más abundante de la Tierra (78,08 % del aire seco), pero su espectro visible es casi mudo: su molécula es simétrica y absorbe muy mal la luz visible y la del infrarrojo cercano. Por eso no hay tecla de N₂: no habría nada que dibujar.",
        p2: "Con el H₂ de Júpiter (89,8 % por volumen) y su helio (10,2 %) pasa algo parecido: son casi todo el planeta y casi invisibles en estos colores. Lo que ves en un espectro no es la lista completa de ingredientes, sino la de los que absorben justo en esa región.",
      },
      refsSummary: "¿Dónde está cada línea? Las posiciones y su fuente",
      fingerprint: fingerprintEs,
      specAria: (mode, T, cls, peak, vis, named) =>
        `Espectro esquemático de 380 a 750 nanómetros: curva de cuerpo negro de ${T} kelvin, de clase ${cls}, con el pico en ${peak} nanómetros. ${mode === "planet" ? "Luz de la estrella reflejada por un planeta." : "Luz de una estrella."} ${vis ? "Líneas de absorción: " + vis + "." : "Sin líneas de absorción en el visible."}`.replace(/\s+/g, " "),
      mysteryAria: (vis, n) => (n ? `Espectro misterioso de 380 a 750 nanómetros: curva continua con ${n} líneas o bandas de absorción en estas posiciones: ${vis}. Hay más información en la tira del infrarrojo cercano.` : "Espectro misterioso de 380 a 750 nanómetros: curva continua sin líneas en el visible. Mira la tira del infrarrojo cercano."),
      nirTitle: "Infrarrojo cercano (700–2.200 nm): no se ve a simple vista",
      nirAria: (list) => (list ? `Tira del infrarrojo cercano, de 700 a 2.200 nanómetros, con bandas de absorción en: ${list}.` : "Tira del infrarrojo cercano, de 700 a 2.200 nanómetros, sin bandas de absorción."),
      axis: "longitud de onda (nm)",
      schematic: "Esquema: la curva es un cuerpo negro y las rayas se dibujan más anchas de lo real. Las intensidades son cualitativas.",
      night: "En visión nocturna (luz roja) los colores del arcoíris se ven rojos: las líneas siguen en el mismo sitio, lo que cambia es el color.",
    },

    // ── Paso 3 ──
    s3: {
      title: "3 · ¿De qué está hecho?",
      lead: "Te enseño el espectro de un astro real sin decirte cuál es. Marca los elementos o moléculas que crees ver y comprueba. No hay puntos ni ranking, y nada se guarda.",
      navLabel: "Retos",
      dotAria: (n, done, perfect) => `Reto ${n}${perfect ? ", resuelto sin fallos" : done ? ", comprobado" : ""}`,
      mysteryTitle: (i, n) => `Astro misterioso ${i} de ${n}`,
      revealTitle: (name, i) => `Reto ${i}: era ${name}`,
      kind: {
        star: "Es una estrella: miras su propia luz.",
        planet: "Es un planeta: miras luz del Sol reflejada y filtrada por su atmósfera.",
      },
      hintSummary: "Una pista",
      refSummary: "Tabla de huellas (para comparar)",
      refNote: "Úsala como el que busca una palabra en un diccionario: compara las posiciones del espectro con las de cada elemento.",
      pickTitle: "¿Qué ves en este espectro?",
      check: "Comprobar",
      again: "Probar otra vez",
      next: "Siguiente reto",
      restart: "Volver al primero",
      perfect: "Perfecto: encontraste todo y no marcaste nada de más.",
      partial: (f, total, extra) => `Encontraste ${f} de ${total}${extra ? ` y marcaste ${extra} de más` : ""}.`,
      nothing: "No marcaste nada, y aquí no había nada que marcar.",
      rowOk: (n) => `Acierto: ${n.toLowerCase()}.`,
      rowMissed: (n) => `Te faltó: ${n.toLowerCase()}. Sí deja huella.`,
      rowExtra: (n) => `Sobra: ${n.toLowerCase()}. No hay huella suya en este espectro.`,
      rowHidden: (n, why) => `Sobra: ${n.toLowerCase()}. Puede estar en el astro, pero aquí no se ve. ${why.charAt(0).toUpperCase() + why.slice(1)}`,
      tally: (n, N) => `Retos resueltos sin fallos en esta sesión: ${n} de ${N}. Solo se cuenta en tu pantalla y se borra al recargar.`,
      challenges: {
        sun: {
          name: "el Sol",
          hint: "Piensa en las líneas de Fraunhofer del paso 1: la doble amarilla del sodio, el calcio en el violeta, el magnesio en el verde y la roja del hidrógeno. Su luz tiene el pico en el verde, hacia los 500 nm.",
          explain: "Es el Sol (5.772 K): hidrógeno, sodio, calcio, magnesio y hierro. El helio está en el Sol, pero a esa temperatura casi no deja líneas visibles en su superficie; por eso se descubrió con la luz de su borde durante un eclipse, en 1868.",
        },
        m: {
          name: "una estrella fría tipo M",
          hint: "Es una estrella roja y fría: casi todo su brillo está en el rojo y el infrarrojo. Busca bandas anchas que empiezan en un punto nítido y se apagan hacia el rojo.",
          explain: "Es una estrella tipo M (unos 3.300 K, como Betelgeuse, que es M2). A esa temperatura el titanio se une al oxígeno y forma TiO, que dibuja bandas desde 545, 619 y 705 nm. Casi no queda hidrógeno que deje líneas; sí sodio, calcio, magnesio y hierro.",
        },
        a: {
          name: "una estrella caliente tipo A",
          hint: "Es una estrella muy blanca. Hay una familia de líneas que en estas estrellas son las más fuertes de todas; las viste con el prisma, en el paso 1.",
          explain: "Es una estrella tipo A (unos 9.500 K): el hidrógeno deja las líneas de Balmer más fuertes de toda la secuencia, y, tenue, la línea K del calcio ionizado. Que en el Sol sean débiles no significa que el Sol tenga menos hidrógeno: a 5.772 K sus átomos casi no están en el estado que absorbe esos colores. Esa fue la idea de Cecilia Payne en 1925.",
        },
        b: {
          name: "una estrella azul tipo B",
          hint: "Es muy caliente: su pico está fuera del visible, en el ultravioleta. Fíjate en una raya amarilla cerca de 588 nm y en otra azul cerca de 447 nm que no son del sodio.",
          explain: "Es una estrella tipo B (unos 15.000 K): hidrógeno y helio, con las líneas del helio en 447,1 y 587,6 nm. El helio se ve aquí y no en el Sol porque excitarlo cuesta mucha más energía: el mismo gas, otra temperatura, otro espectro.",
        },
        earth: {
          name: "la Tierra",
          hint: "Es un planeta: luz del Sol que cruza una atmósfera fría. Mira una banda roja cerca de 687 nm, otra cerca de 760 nm y varias más en el infrarrojo cercano.",
          explain: "Es la Tierra: oxígeno (bandas en 628, 687 y 760 nm) y vapor de agua (infrarrojo cercano, desde 940 nm). El nitrógeno, 78 % del aire, no aparece porque casi no absorbe. Fraunhofer rotuló las bandas del oxígeno como A, B y a; hoy sabemos que vienen de la atmósfera terrestre.",
        },
        mars: {
          name: "Marte",
          hint: "Casi no hay nada en el visible. Mira la tira del infrarrojo cercano: las bandas cerca de 1.600 y 2.000 nm son de un gas muy abundante en dos planetas vecinos.",
          explain: "Es Marte: su atmósfera es 95,1 % dióxido de carbono, con bandas en el infrarrojo cercano. Venus tiene el mismo gas, pero a 92 bar frente a los 6,36 mb de Marte: unas 14.000 veces más. Con tan poco gas, las bandas marcianas son mucho más tenues.",
        },
        jupiter: {
          name: "Júpiter",
          hint: "En el visible solo hay dos bandas rojas, cerca de 619 y 727 nm; en el infrarrojo, una muy fuerte cerca de 890 nm. Piensa de qué está hecho Júpiter y cuáles de esos gases dejan líneas.",
          explain: "Es Júpiter. Lo que deja huella es el metano (619, 727 y 890 nm). Pero el 89,8 % es H₂ y el 10,2 % helio, que casi no absorben en estos colores: aquí lo que ves no es lo que hay, sino lo que absorbe.",
        },
      },
    },

    // ── Paso 4 ──
    s4: {
      title: "4 · Así se buscan señales de vida en exoplanetas",
      lead: "El mismo truco funciona con planetas de otras estrellas. No se ven en detalle: se analiza la luz de su estrella cuando el planeta pasa por delante.",
      decimal: ",",
      dipAria: "Esquema de un espectro de transmisión de 3 a 5 micrómetros: una línea casi plana con una caída marcada entre 4,1 y 4,6 micrómetros, rotulada CO₂. No son los datos reales.",
      dipX: "longitud de onda (µm)",
      dipY: "luz que se pierde",
      webb: {
        title: "El James Webb y el CO₂ de WASP-39 b",
        teaser: "Un espectro de transmisión, medido en 2022.",
        p1: "Cuando un planeta pasa por delante de su estrella (un tránsito), parte de la luz atraviesa el borde de su atmósfera. Cada gas se come colores concretos, así que el telescopio James Webb mide qué colores faltan. En 2022, con su espectrógrafo NIRSpec, vio en WASP-39 b una «colina» entre 4,1 y 4,6 µm: dióxido de carbono. El artículo de Nature lo sitúa en 4,3 µm, con una significancia de 26 sigmas.",
        fine: "Esquema, no son los datos del Webb: muestra la forma de la señal.",
        p2: "WASP-39 b es un gigante gaseoso caliente (unos 900 °C), de un cuarto de la masa de Júpiter, a unos 700 años luz, que da una vuelta a su estrella en poco más de cuatro días. NASA y ESA lo presentaron el 25 de agosto de 2022 como la primera detección clara de CO₂ en un planeta fuera del sistema solar. No es un planeta para la vida: es una prueba de que el método funciona.",
      },
      bio: {
        title: "¿Y la vida? Gases que no deberían estar juntos",
        teaser: "O₂ más CH₄ sería una posible biofirma.",
        p1: "El oxígeno y el metano reaccionan entre sí y se destruyen. Si una atmósfera tiene los dos a la vez, algo los repone sin parar. En la Tierra, ese algo es la vida. Esa idea, un desequilibrio químico como pista, viene de James Lovelock (1965).",
        p2: "Es una hipótesis de trabajo, no una prueba: el oxígeno también puede acumularse sin vida, por ejemplo cuando la luz de la estrella rompe el agua, así que no basta con encontrarlo solo. Hace falta el contexto completo del planeta y descartar las explicaciones sin vida una por una.",
        p3: "Y hoy hay que ver gases de ese tipo en un planeta pequeño y templado, algo que está en el límite de lo que miden los telescopios actuales.",
      },
      k2: {
        title: "Un caso abierto: K2-18 b",
        teaser: "Posibles huellas que no se han confirmado.",
        p1: "Con datos del Webb se publicaron indicios de moléculas con azufre, como el sulfuro de dimetilo (DMS), en el planeta K2-18 b. Un nuevo análisis conjunto de varios instrumentos del Webb (Luque et al., 2025) concluyó que no hay evidencia suficiente de DMS ni de DMDS.",
        p2: "Ninguno de los casos citados aquí es una detección de vida. Esta es la parte del método que más cuidado pide: no llamar «hallazgo» a lo que aún es una pista.",
      },
    },

    assumptionsTitle: "Supuestos",
    assumptions: [
      "Las posiciones de las líneas atómicas son las de NIST, en aire. Las bandas moleculares son centros aproximados tomados de las fuentes citadas; no se dibuja ninguna banda que no se haya podido verificar (por ejemplo, el H₂O en el visible).",
      "La profundidad y el ancho de las líneas son un esquema: no son mediciones. «Cantidad» es ilustrativa, no un porcentaje real de la atmósfera.",
      "La intensidad de cada línea según la clase espectral es cualitativa (clasificación de Morgan–Keenan). Las del hierro y el calcio neutro son de criterio propio.",
      "El fondo es un cuerpo negro de Planck; las estrellas reales se parecen, pero no lo son exactamente.",
      "Un planeta se dibuja como luz de su estrella más el gas frío que atraviesa. No se modelan nubes, dispersión ni las líneas propias del Sol.",
      "Faltan casi todos los elementos y moléculas del universo: solo están los que tienen posiciones verificadas. Por eso no hay nitrógeno ni hidrógeno molecular: casi no dejan líneas en estas longitudes de onda.",
      "El infrarrojo cercano va en una tira aparte porque el espectro del Cielo solo llega a 750 nm.",
      "El juego no guarda nada: la cuenta de retos vive solo en tu pantalla.",
    ],
    sourcesTitle: "Fuentes",
    honest: "Esto es una guía para entender el método, no un espectrógrafo. El dibujo se calcula en tu teléfono; ninguna IA interviene.",

    next: {
      sky: { label: "Betelgeuse en el Cielo", note: "Abre su ficha: ahí verás el espectro de una estrella roja tipo M." },
      mass: { label: "¿Qué pasa si cambio la masa?", note: "Otra pregunta: la masa de una estrella decide cuánto brilla y cómo termina." },
    },
  },

  en: {
    title: "How do we know what stars are made of?",
    lead: "Nobody has brought back a piece of a distant star, and yet we know which elements it contains. The trick: light carries a barcode. Here you read it, build it yourself, and use it to guess.",

    species: {
      H: "Hydrogen", He: "Helium", Na: "Sodium", Ca: "Calcium", Mg: "Magnesium", Fe: "Iron",
      O2: "Oxygen", H2O: "Water vapour", CO2: "Carbon dioxide", CH4: "Methane", TiO: "Titanium oxide",
    },

    s1: {
      title: "1 · Light carries a barcode",
      lead: "A prism splits white light into all its colours. And if you look closely, each chemical element absorbs or emits exact colours, always the same ones. Those lines are its fingerprint.",
      prismAria: "A beam of white light enters a glass prism and leaves fanned out, from violet to red.",
      prism: "The fan is the spectrum. Your eye sees the colours mixed; the prism sorts them by wavelength, measured in nanometres (nm): violet is around 400 nm and red around 700.",
      stripsTitle: "The same gas, three ways of seeing it",
      stripsAria: "Three colour strips. The first is a continuous rainbow. The second is black with four bright hydrogen lines. The third is a rainbow with those same four lines dark, in the same places.",
      strips: [
        ["Top:", "light of every colour, no gaps."],
        ["Middle:", "hot, thin hydrogen. It emits only four exact colours (410, 434, 486 and 656 nm)."],
        ["Bottom:", "light of every colour passing through cooler hydrogen. The gas takes exactly those four colours: dark lines in the same places."],
      ],
      rule: "That is what Kirchhoff explained: a hot gas gives bright lines, and a cooler gas in front of a continuous light gives dark lines, in the same positions. A star is the second case: a very bright interior with a cooler atmosphere on top. The line positions of each element are measured in the laboratory; so when we see them in a star, we know what is there.",
      tagNote: "wavelengths are measured in the laboratory",
      timelineTitle: "How it was discovered",
      timeline: [
        { year: "1666–1672", who: "Isaac Newton and the prism", text: "Newton passes sunlight through a prism and gets the full rainbow. He calls it a “spectrum”. He reports it in 1672, in his first paper to the Royal Society.", refs: ["newton"] },
        { year: "1814", who: "Fraunhofer catalogues the Sun’s dark lines", text: "Joseph von Fraunhofer sees that the Sun’s spectrum is crossed by hundreds of dark lines (more than 570) and labels the most prominent with letters: A, B, C, D… Nobody yet knows what they are.", refs: ["fraunhofer"] },
        { year: "1859–1860", who: "Kirchhoff and Bunsen", text: "Gustav Kirchhoff and Robert Bunsen show that each heated element emits its own lines, and that several coincide with Fraunhofer’s dark ones: they are absorption by those elements in the Sun’s atmosphere. In 1859 they showed that the Sun contains sodium.", refs: ["kirchhoff"] },
        { year: "1868", who: "Helium, found first in the Sun", text: "On 18 August 1868, during a total eclipse, Jules Janssen sees a bright yellow line at the Sun’s edge, near 587.5 nm. Norman Lockyer observes it on 20 October and proposes a new element: “helium”, from the Greek word for the Sun. It was not isolated on Earth until 1895 (William Ramsay).", refs: ["helium"] },
        { year: "1925", who: "Cecilia Payne", text: "In her thesis, Cecilia Payne used the lines and Saha’s ionization theory to show that stars are mostly hydrogen and helium. Henry Norris Russell doubted her result; in 1929 he reached the same one another way and mentioned her work.", refs: ["payne", "payneBio"] },
      ],
    },

    s2: {
      title: "2 · Build an atmosphere",
      lead: "Put elements and molecules in the mix and watch their fingerprints appear on a star’s rainbow. Change the temperature of the light or try a shortcut: Earth, Mars, Venus, Jupiter or the Sun.",
      modeLabel: "Where is the gas?",
      modes: { star: "In a star", planet: "On a planet" },
      modeNote: {
        star: "You look at a star’s light. The gas layers at its surface, cooler than the interior, eat colours. How much of each element shows depends on temperature: hydrogen and helium need a lot of heat to leave lines, and molecules break apart.",
        planet: "You look at a star’s light reflected by a planet. It enters the atmosphere, bounces and leaves crossing it again: the cold gas eats colours. Here molecules matter; atoms only count if the line starts from their lowest state.",
      },
      tempLabel: "Temperature of the light",
      classWord: "class",
      tempAria: (k, cls, peak) => `${k} kelvin, class ${cls} star, with its emission peak at ${peak} nanometres`,
      temps: { sun: "Sun 5,772 K", m: "Red type M 3,300 K", b: "Blue type B 15,000 K" },
      peakNote: (p) => `The background curve is a blackbody. Its peak, from Wien’s law, falls at ${p} nm: hotter is bluer; cooler, redder.`,
      speciesTitle: "What is in the mix",
      speciesHint: "Tap each one to add or remove it. Every item on the list has verified positions.",
      silentShort: "no lines here",
      on: "added",
      off: "removed",
      amountLabel: (name) => `Amount of ${name.toLowerCase()}`,
      amountHint: "illustrative",
      amountAria: (name, pct) => `${name}: ${pct} percent of the maximum amount drawn (illustrative)`,
      readTitle: "What you see now",
      emptyMix: "The mix is empty: with no gas, the light arrives whole, without a single line.",
      nothingDrawn: "In these conditions none of your choices leaves visible lines.",
      readItem: (vis, nir) => [vis.length ? `visible: ${vis.join(", ")} nm` : "", nir.length ? `near infrared: ${nir.join(", ")} nm` : ""].filter(Boolean).join(" · "),
      silent: {
        cold: () => "In a cold gas this atom hardly leaves any visible lines: it takes a star’s heat to excite or ionize it.",
        hot: () => "At a star’s temperature this molecule breaks apart and leaves no bands. Try it under “On a planet”.",
        class: () => "At this temperature it leaves no noticeable lines in the visible. Change the temperature: every element has its own.",
        tio: () => "It only survives in the gas of cool stars (type M, below about 4,000 K), not in a temperate planet’s atmosphere.",
      },
      nirOnly: "Some molecules have their bands in the near infrared, which the eye cannot see: they are in the strip below, not in the rainbow.",
      tagPositions: "positions measured",
      tagDepths: "depth: schematic",
      presetsLabel: "Mix shortcuts",
      presets: { earth: "Earth", mars: "Mars", venus: "Venus", jupiter: "Jupiter", sun: "Sun" },
      presetNotes: {
        earth: "Earth: oxygen (O₂) and water vapour (H₂O). Nitrogen (78 % of the air) leaves almost no lines. The O₂ bands at 687 and 760 nm are the ones Fraunhofer labelled B and A.",
        mars: "Mars: 95.1 % CO₂, but an atmosphere of only about 6 mb. Almost everything happens in the near infrared, around 1,600 and 2,000 nm.",
        venus: "Venus: the same gas as Mars (96.5 % CO₂) but at 92 bar: about 14,000 times denser. The same bands, much deeper.",
        jupiter: "Jupiter: almost all H₂ and helium, which leave almost no lines in these colours. What you see is methane: 619 and 727 nm and, very strong, 890 nm.",
        sun: "The Sun: lines of hydrogen, sodium, calcium, magnesium and iron. Helium is in the Sun, but at 5,772 K it leaves almost no visible lines at its surface.",
      },
      customNote: "Your mix. Try putting helium under red light and under blue light: same gas, different result.",
      pvs: {
        title: "A planet or a star: not the same",
        teaser: "Where the light comes from and where the gas is.",
        tagNote: "simplified explanation",
        p1: "A star shines with its own light. Its spectrum is a background rainbow, almost a blackbody, from which the cooler layers of its atmosphere eat colours. What shows depends on temperature: hydrogen only leaves its Balmer lines if it is hot enough to have electrons in the second level (which is why they peak in type A stars), and helium needs even more heat.",
        p2: "A planet does not shine: it reflects its star’s light. The light enters the atmosphere, bounces off clouds or ground and leaves crossing it again. Cold gas only absorbs what starts from its lowest state: molecules such as H₂O, CO₂, CH₄ or O₂ (with bands mostly in the near infrared) and little else, such as sodium. That is why hydrogen and helium, nearly all of Jupiter, leave no lines in visible light.",
        p3: "So as not to oversimplify: a real planetary spectrum also carries the Sun’s own dark lines, which astronomers subtract; clouds and scattering change the shape and depth of the bands; and from the ground it mixes with Earth’s atmosphere, which adds its own O₂ and H₂O bands. Only the essentials are drawn here.",
      },
      n2: {
        title: "What about nitrogen?",
        teaser: "78 % of the air leaves almost no lines.",
        tagNote: "standard molecular physics",
        p1: "N₂ is the most abundant gas on Earth (78.08 % of dry air), but its visible spectrum is almost silent: the molecule is symmetric and absorbs visible and near-infrared light very poorly. That is why there is no N₂ button: there would be nothing to draw.",
        p2: "Jupiter’s H₂ (89.8 % by volume) and its helium (10.2 %) are similar: they make up almost the whole planet and are almost invisible in these colours. What you see in a spectrum is not the full ingredient list, only the ingredients that absorb in that region.",
      },
      refsSummary: "Where is each line? Positions and sources",
      fingerprint: fingerprintEn,
      specAria: (mode, T, cls, peak, vis) =>
        `Schematic spectrum from 380 to 750 nanometres: a ${T} kelvin blackbody curve, class ${cls}, with its peak at ${peak} nanometres. ${mode === "planet" ? "Starlight reflected by a planet." : "Light from a star."} ${vis ? "Absorption lines: " + vis + "." : "No absorption lines in the visible."}`.replace(/\s+/g, " "),
      mysteryAria: (vis, n) => (n ? `Mystery spectrum from 380 to 750 nanometres: a continuous curve with ${n} absorption lines or bands at these positions: ${vis}. There is more in the near-infrared strip.` : "Mystery spectrum from 380 to 750 nanometres: a continuous curve with no lines in the visible. Look at the near-infrared strip."),
      nirTitle: "Near infrared (700–2,200 nm): invisible to the naked eye",
      nirAria: (list) => (list ? `Near-infrared strip, 700 to 2,200 nanometres, with absorption bands at: ${list}.` : "Near-infrared strip, 700 to 2,200 nanometres, with no absorption bands."),
      axis: "wavelength (nm)",
      schematic: "Schematic: the curve is a blackbody and the lines are drawn wider than real. Intensities are qualitative.",
      night: "In night vision (red light) the rainbow colours look red: the lines stay in the same place, only the colour changes.",
    },

    s3: {
      title: "3 · What is it made of?",
      lead: "I show you the spectrum of a real object without saying which. Mark the elements or molecules you think you see, then check. There are no points or rankings, and nothing is saved.",
      navLabel: "Challenges",
      dotAria: (n, done, perfect) => `Challenge ${n}${perfect ? ", solved with no mistakes" : done ? ", checked" : ""}`,
      mysteryTitle: (i, n) => `Mystery object ${i} of ${n}`,
      revealTitle: (name, i) => `Challenge ${i}: it was ${name}`,
      kind: {
        star: "It is a star: you are looking at its own light.",
        planet: "It is a planet: you are looking at sunlight reflected and filtered by its atmosphere.",
      },
      hintSummary: "A hint",
      refSummary: "Fingerprint table (to compare)",
      refNote: "Use it like looking a word up in a dictionary: compare the positions in the spectrum with those of each element.",
      pickTitle: "What do you see in this spectrum?",
      check: "Check",
      again: "Try again",
      next: "Next challenge",
      restart: "Back to the first",
      perfect: "Perfect: you found everything and marked nothing extra.",
      partial: (f, total, extra) => `You found ${f} of ${total}${extra ? ` and marked ${extra} too many` : ""}.`,
      nothing: "You marked nothing, and there was nothing to mark.",
      rowOk: (n) => `Correct: ${n.toLowerCase()}.`,
      rowMissed: (n) => `You missed: ${n.toLowerCase()}. It does leave a fingerprint.`,
      rowExtra: (n) => `Extra: ${n.toLowerCase()}. There is no trace of it in this spectrum.`,
      rowHidden: (n, why) => `Extra: ${n.toLowerCase()}. It may be in the object, but it cannot be seen here. ${why.charAt(0).toUpperCase() + why.slice(1)}`,
      tally: (n, N) => `Challenges solved with no mistakes this session: ${n} of ${N}. Counted only on your screen and cleared on reload.`,
      challenges: {
        sun: {
          name: "the Sun",
          hint: "Think of the Fraunhofer lines from step 1: sodium’s yellow double, calcium in the violet, magnesium in the green and hydrogen’s red one. Its light peaks in the green, near 500 nm.",
          explain: "It is the Sun (5,772 K): hydrogen, sodium, calcium, magnesium and iron. Helium is in the Sun, but at that temperature it leaves almost no visible lines at the surface; that is why it was discovered in the light from its edge during an eclipse, in 1868.",
        },
        m: {
          name: "a cool type M star",
          hint: "It is a cool red star: almost all its light is in the red and the infrared. Look for broad bands that start at a sharp point and fade towards the red.",
          explain: "It is a type M star (about 3,300 K, like Betelgeuse, which is M2). At that temperature titanium binds to oxygen and forms TiO, which draws bands starting at 545, 619 and 705 nm. Hardly any hydrogen leaves lines; sodium, calcium, magnesium and iron do.",
        },
        a: {
          name: "a hot type A star",
          hint: "It is a very white star. One family of lines is strongest of all in these stars; you saw it with the prism, in step 1.",
          explain: "It is a type A star (about 9,500 K): hydrogen leaves the strongest Balmer lines of the whole sequence and, faintly, the K line of ionized calcium. That they are weak in the Sun does not mean the Sun has less hydrogen: at 5,772 K its atoms are hardly ever in the state that absorbs those colours. That was Cecilia Payne’s idea in 1925.",
        },
        b: {
          name: "a blue type B star",
          hint: "It is very hot: its peak lies outside the visible, in the ultraviolet. Look for a yellow line near 588 nm and a blue one near 447 nm that are not sodium.",
          explain: "It is a type B star (about 15,000 K): hydrogen and helium, with helium lines at 447.1 and 587.6 nm. Helium shows here and not in the Sun because exciting it takes far more energy: the same gas, a different temperature, a different spectrum.",
        },
        earth: {
          name: "Earth",
          hint: "It is a planet: sunlight crossing a cold atmosphere. Look for a red band near 687 nm, another near 760 nm and several more in the near infrared.",
          explain: "It is Earth: oxygen (bands at 628, 687 and 760 nm) and water vapour (near infrared, from 940 nm). Nitrogen, 78 % of the air, does not show because it barely absorbs. Fraunhofer labelled the oxygen bands A, B and a; today we know they come from Earth’s atmosphere.",
        },
        mars: {
          name: "Mars",
          hint: "There is almost nothing in the visible. Look at the near-infrared strip: the bands near 1,600 and 2,000 nm belong to a gas that is very abundant on two neighbouring planets.",
          explain: "It is Mars: its atmosphere is 95.1 % carbon dioxide, with bands in the near infrared. Venus has the same gas, but at 92 bar against Mars’s 6.36 mb: about 14,000 times more. With so little gas, the martian bands are much fainter.",
        },
        jupiter: {
          name: "Jupiter",
          hint: "In the visible there are only two red bands, near 619 and 727 nm; in the infrared, a very strong one near 890 nm. Think about what Jupiter is made of and which of those gases leave lines.",
          explain: "It is Jupiter. What leaves a fingerprint is methane (619, 727 and 890 nm). But 89.8 % is H₂ and 10.2 % helium, which barely absorb in these colours: what you see is not what is there, but what absorbs.",
        },
      },
    },

    s4: {
      title: "4 · How we look for signs of life on exoplanets",
      lead: "The same trick works on planets around other stars. They are not seen in detail: we analyse their star’s light as the planet passes in front.",
      decimal: ".",
      dipAria: "Sketch of a transmission spectrum from 3 to 5 micrometres: an almost flat line with a clear dip between 4.1 and 4.6 micrometres, labelled CO₂. It is not the real data.",
      dipX: "wavelength (µm)",
      dipY: "light lost",
      webb: {
        title: "James Webb and the CO₂ of WASP-39 b",
        teaser: "A transmission spectrum, measured in 2022.",
        p1: "When a planet passes in front of its star (a transit), some of the light crosses the edge of its atmosphere. Each gas eats particular colours, so the James Webb telescope measures which colours are missing. In 2022, with its NIRSpec spectrograph, it saw in WASP-39 b a “hill” between 4.1 and 4.6 µm: carbon dioxide. The Nature paper puts it at 4.3 µm, at 26 sigma significance.",
        fine: "A sketch, not Webb’s data: it shows the shape of the signal.",
        p2: "WASP-39 b is a hot gas giant (about 900 °C), a quarter of Jupiter’s mass, some 700 light-years away, that circles its star in just over four days. NASA and ESA presented it on 25 August 2022 as the first clear detection of CO₂ on a planet outside the Solar System. It is not a planet for life: it is proof that the method works.",
      },
      bio: {
        title: "And life? Gases that should not be together",
        teaser: "O₂ plus CH₄ would be a possible biosignature.",
        p1: "Oxygen and methane react with each other and destroy each other. If an atmosphere has both at once, something keeps replenishing them. On Earth, that something is life. The idea, chemical disequilibrium as a clue, goes back to James Lovelock (1965).",
        p2: "It is a working hypothesis, not proof: oxygen can also build up without life, for example when starlight breaks up water, so finding it alone is not enough. You need the planet’s whole context and to rule out the non-living explanations one by one.",
        p3: "And today you would have to see gases like that on a small, temperate planet, which is at the limit of what current telescopes can measure.",
      },
      k2: {
        title: "An open case: K2-18 b",
        teaser: "Possible fingerprints that have not been confirmed.",
        p1: "With Webb data, hints of sulphur-bearing molecules such as dimethyl sulfide (DMS) were published for the planet K2-18 b. A new joint analysis of several Webb instruments (Luque et al., 2025) concluded that there is insufficient evidence for DMS or DMDS.",
        p2: "None of the cases cited here is a detection of life. This is the part of the method that calls for the most care: not calling a clue a “finding”.",
      },
    },

    assumptionsTitle: "Assumptions",
    assumptions: [
      "Atomic line positions are NIST’s, in air. Molecular bands are approximate centres taken from the cited sources; no band that could not be verified is drawn (for example, H₂O in the visible).",
      "Line depth and width are a sketch: they are not measurements. “Amount” is illustrative, not a real percentage of the atmosphere.",
      "How strong each line is by spectral class is qualitative (Morgan–Keenan classification). Those for iron and neutral calcium are our own judgement.",
      "The background is a Planck blackbody; real stars resemble it but are not exactly one.",
      "A planet is drawn as its star’s light plus the cold gas it crosses. Clouds, scattering and the Sun’s own lines are not modelled.",
      "Nearly all the elements and molecules in the universe are missing: only those with verified positions are here. That is why there is no nitrogen or molecular hydrogen: they leave almost no lines at these wavelengths.",
      "The near infrared is in a separate strip because the Sky spectrum only reaches 750 nm.",
      "The game saves nothing: the challenge count lives only on your screen.",
    ],
    sourcesTitle: "Sources",
    honest: "This is a guide to understand the method, not a spectrograph. The drawing is computed on your phone; no AI is involved.",

    next: {
      sky: { label: "Betelgeuse in the Sky", note: "Open its card: you will see the spectrum of a red type M star." },
      mass: { label: "What happens if I change the mass?", note: "Another question: a star’s mass decides how bright it shines and how it ends." },
    },
  },
};
