#!/usr/bin/env python3
"""Dos capas pequeñas y escogidas a mano (public/oddities.json y public/special-stars.json):

  · «oddities»: nebulosas oscuras, restos de supernova, cuásares, lentes gravitacionales y cúmulos de galaxias;
  · «specialstars»: estrellas dobles, variables y vecinas notables.

La posición (y, en las estrellas, la magnitud V) sale de SIMBAD por el servicio de nombres Sesame del CDS; el resto
(distancia, periodo, nota) son valores publicados y redondeados, escritos aquí. Si Sesame no resuelve un nombre, el
script se detiene: no se inventan coordenadas.
"""
import json, math, os, re, time, urllib.parse, urllib.request
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CACHE = "/tmp/extras/sesame.json"
SESAME = ["https://vizier.idia.ac.za/viz-bin/nph-sesame/-oI/SNV?", "https://vizier.cfa.harvard.edu/viz-bin/nph-sesame/-oI/SNV?", "https://cds.unistra.fr/cgi-bin/nph-sesame/-oI/SNV?"]
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
def resolve(names):
    """`names`: una designación o varias separadas por «|» (se usa la primera que SIMBAD conozca)."""
    for name in names.split("|"):
        r = resolve1(name)
        if r: return r
    raise SystemExit("Sesame no resuelve: " + names)
def resolve1(name):
    if name in cache: return cache[name]
    for base in SESAME:
        try:
            t = urllib.request.urlopen(urllib.request.Request(base + urllib.parse.quote(name), headers={"User-Agent": "teseo-build"}), timeout=40).read().decode("utf-8", "replace")
        except Exception:
            continue
        m = re.search(r"^%J\s+([\d.]+)\s+([+-][\d.]+)", t, re.M)
        if m:
            v = re.search(r"^%M\.V\s+([\d.]+)", t, re.M)
            cache[name] = {"ra": float(m.group(1)), "dec": float(m.group(2)), "v": float(v.group(1)) if v else None}
            os.makedirs(os.path.dirname(CACHE), exist_ok=True); json.dump(cache, open(CACHE, "w")); time.sleep(0.3)
            return cache[name]
    return None

# (nombre para SIMBAD, nombre es, nombre en, tipo, distancia en años luz o None, nota es, nota en, Wikipedia en, Wikipedia es o None)
ODD = [
 ("Barnard 33", "Cabeza de Caballo", "Horsehead Nebula", "dark", 1375, "Una nube de polvo oscuro recortada contra el gas rojo de IC 434, junto a Alnitak, en el cinturón de Orión.", "A cloud of dark dust silhouetted against the red gas of IC 434, next to Alnitak in Orion's Belt.", "Horsehead Nebula", "Nebulosa Cabeza de Caballo"),
 ("Barnard 78", "Nebulosa de la Pipa", "Pipe Nebula", "dark", 450, "Polvo oscuro delante del centro de la Vía Láctea; a simple vista en un cielo muy oscuro. Para los Andes, parte de las figuras oscuras del cielo.", "Dark dust in front of the Milky Way's centre; visible to the naked eye under a very dark sky.", "Pipe Nebula", "Nebulosa de la Pipa"),
 ("Barnard 72", "Nebulosa de la Serpiente", "Snake Nebula", "dark", 650, "Una «S» de polvo oscuro sobre las nubes de estrellas de Ofiuco.", "An “S” of dark dust against the star clouds of Ophiuchus.", "Snake Nebula", None),
 ("Barnard 143", "E de Barnard", "Barnard's E", "dark", 2000, "Dos nubes oscuras que dibujan una «E» junto a Altair.", "Two dark clouds that draw an “E” next to Altair.", "Barnard's E", None),
 ("Vela SNR", "Remanente de Vela", "Vela Supernova Remnant", "snr", 800, "Lo que queda de una estrella que estalló hace unos 11 000 años; en su centro late un púlsar.", "What is left of a star that exploded about 11,000 years ago; a pulsar beats at its centre.", "Vela Supernova Remnant", "Remanente de supernova de Vela"),
 ("Cas A", "Casiopea A", "Cassiopeia A", "snr", 11000, "El resto de supernova más joven conocido en la Vía Láctea: su luz debió de llegar hacia 1680. Es una de las fuentes de radio más intensas del cielo.", "The youngest known supernova remnant in the Milky Way: its light should have arrived around 1680. One of the strongest radio sources in the sky.", "Cassiopeia A", "Casiopea A"),
 ("SN 1572", "Supernova de Tycho", "Tycho's Supernova", "snr", 9000, "En 1572 Tycho Brahe vio aquí una «estrella nueva» tan brillante como Venus; demostró que los cielos también cambian.", "In 1572 Tycho Brahe saw a “new star” here as bright as Venus; it showed that the heavens change too.", "SN 1572", "SN 1572"),
 ("SN 1604", "Supernova de Kepler", "Kepler's Supernova", "snr", 20000, "La última supernova vista a simple vista en nuestra galaxia, en 1604.", "The last supernova seen with the naked eye in our galaxy, in 1604.", "Kepler's Supernova", "SN 1604"),
 ("SN 1987A", "Supernova 1987A", "Supernova 1987A", "snr", 168000, "Estalló en la Gran Nube de Magallanes y se vio a simple vista desde el sur en 1987; es la supernova cercana mejor estudiada.", "It exploded in the Large Magellanic Cloud and was seen with the naked eye from the south in 1987; the best-studied nearby supernova.", "SN 1987A", "SN 1987A"),
 ("SNR G180.0-01.7", "Nebulosa Espagueti", "Spaghetti Nebula", "snr", 3000, "Un resto de supernova enorme y muy tenue, de unos 3° de ancho, entre Tauro y Auriga.", "A huge, very faint supernova remnant, about 3° across, between Taurus and Auriga.", "Simeis 147", None),
 ("3C 48", "3C 48", "3C 48", "quasar", 3900000000, "La primera radiofuente identificada con lo que luego se llamó cuásar (1960).", "The first radio source matched to what was later called a quasar (1960).", "3C 48", "3C 48"),
 ("OJ 287", "OJ 287", "OJ 287", "quasar", 3500000000, "Un núcleo activo que estalla cada doce años: probablemente dos agujeros negros supermasivos en órbita.", "An active nucleus that flares every twelve years: probably two supermassive black holes in orbit.", "OJ 287", "OJ 287"),
 ("BL Lac", "BL Lacertae", "BL Lacertae", "quasar", 900000000, "Se creyó una estrella variable; es un núcleo galáctico cuyo chorro apunta casi hacia nosotros. Da nombre a los blázares.", "Once thought a variable star; it is a galactic nucleus whose jet points almost at us. It gives blazars their name.", "BL Lacertae", "BL Lacertae"),
 ("Mrk 421", "Markarian 421", "Markarian 421", "quasar", 400000000, "Uno de los blázares más cercanos y brillantes en rayos gamma.", "One of the nearest blazars and one of the brightest in gamma rays.", "Markarian 421", "Markarian 421"),
 ("QSO B0957+561A|QSO J1001+5553|Twin Quasar|[VV2006] J100120.7+555355", "Cuásar Gemelo", "Twin Quasar", "lens", 8700000000, "La primera lente gravitacional descubierta (1979): un solo cuásar visto dos veces por la gravedad de una galaxia intermedia.", "The first gravitational lens found (1979): a single quasar seen twice through the gravity of a galaxy in between.", "Twin Quasar", "Cuásar Gemelo"),
 ("Einstein Cross|QSO J2240+0321|QSO B2237+0305", "Cruz de Einstein", "Einstein Cross", "lens", 8000000000, "Un cuásar que aparece cuatro veces, en cruz, alrededor del núcleo de una galaxia que hace de lente.", "A quasar that appears four times, in a cross, around the core of a galaxy acting as a lens.", "Einstein Cross", "Cruz de Einstein"),
 ("Virgo Cluster|NAME Virgo Cluster", "Cúmulo de Virgo", "Virgo Cluster", "gcluster", 54000000, "El cúmulo de galaxias grande más cercano: más de mil galaxias, con M87 en su centro. La Vía Láctea está en sus afueras.", "The nearest large galaxy cluster: more than a thousand galaxies, with M87 at its centre. The Milky Way lies on its outskirts.", "Virgo Cluster", "Cúmulo de Virgo"),
 ("Fornax Cluster|NAME Fornax Cluster|ACO S 373", "Cúmulo de Fornax", "Fornax Cluster", "gcluster", 62000000, "El segundo cúmulo de galaxias más rico a menos de 100 millones de años luz, en el cielo del sur.", "The second-richest galaxy cluster within 100 million light-years, in the southern sky.", "Fornax Cluster", "Cúmulo de Fornax"),
 ("Coma Cluster|ACO 1656", "Cúmulo de Coma", "Coma Cluster", "gcluster", 320000000, "Más de mil galaxias. Aquí Fritz Zwicky dedujo en 1933 que hacía falta «materia oscura» para mantenerlas juntas.", "More than a thousand galaxies. Here Fritz Zwicky inferred in 1933 that “dark matter” was needed to hold them together.", "Coma Cluster", "Cúmulo de Coma"),
 ("ACO 426", "Cúmulo de Perseo", "Perseus Cluster", "gcluster", 240000000, "Uno de los objetos más masivos del universo cercano; el agujero negro de su galaxia central levanta ondas de presión en el gas.", "One of the most massive objects in the nearby universe; the black hole in its central galaxy raises pressure waves in the gas.", "Perseus Cluster", "Cúmulo de Perseo"),
 ("ACO 2151", "Cúmulo de Hércules", "Hercules Cluster", "gcluster", 500000000, "Un cúmulo rico en galaxias espirales y en parejas que chocan.", "A cluster rich in spiral galaxies and colliding pairs.", "Hercules Cluster", "Cúmulo de Hércules"),
 ("ACO 3627", "Cúmulo de Norma", "Norma Cluster", "gcluster", 220000000, "Escondido tras la Vía Láctea, cerca del centro del Gran Atractor hacia el que se mueven las galaxias vecinas.", "Hidden behind the Milky Way, near the centre of the Great Attractor that nearby galaxies are moving towards.", "Norma Cluster", "Cúmulo de Norma"),
 ("Bullet Cluster|1E 0657-56|1E 0657-558", "Cúmulo Bala", "Bullet Cluster", "gcluster", 3700000000, "Dos cúmulos que se atravesaron: el gas quedó frenado en medio y la masa siguió de largo, una de las mejores pruebas de la materia oscura.", "Two clusters that passed through each other: the gas was slowed in the middle and the mass went on, one of the best pieces of evidence for dark matter.", "Bullet Cluster", "Cúmulo Bala"),
 ("ACO 1689", "Abell 1689", "Abell 1689", "gcluster", 2200000000, "Un cúmulo tan masivo que deforma en arcos la luz de las galaxias que tiene detrás.", "A cluster so massive that it bends the light of the galaxies behind it into arcs.", "Abell 1689", "Abell 1689"),
 ("HCG 92|Stephan's Quintet", "Quinteto de Stephan", "Stephan's Quintet", "gcluster", 290000000, "Cinco galaxias juntas en el cielo, cuatro de ellas en plena interacción; fue una de las primeras imágenes del telescopio Webb.", "Five galaxies together in the sky, four of them interacting; one of the Webb telescope's first images.", "Stephan's Quintet", "Quinteto de Stephan"),
]
# (SIMBAD, nombre es, nombre en, tipo, distancia al, nota es, nota en, Wikipedia en, Wikipedia es)
STARS = [
 ("Albireo", "Albireo", "Albireo", "double", 430, "Con un telescopio pequeño se separa en dos: una estrella dorada y otra azul, a 34″.", "A small telescope splits it in two: a golden star and a blue one, 34″ apart.", "Albireo", "Albireo"),
 ("Mizar|zet01 UMa|zet UMa", "Mizar y Alcor", "Mizar and Alcor", "double", 83, "Mizar y la pequeña Alcor, a su lado, son una prueba de vista clásica. Mizar fue además la primera doble vista con telescopio (1650).", "Mizar and little Alcor beside it are a classic eyesight test. Mizar was also the first double seen through a telescope (1650).", "Mizar and Alcor", "Mizar"),
 ("eps01 Lyr|* eps01 Lyr|eps Lyr", "Épsilon Lyrae", "Epsilon Lyrae", "double", 162, "La «doble doble»: con prismáticos son dos estrellas; con telescopio, cada una vuelve a ser doble.", "The “Double Double”: two stars in binoculars; in a telescope each one is double again.", "Epsilon Lyrae", "Epsilon Lyrae"),
 ("Almach", "Almach", "Almach", "double", 350, "Una doble de colores, naranja y azulada, de las más bonitas del cielo.", "A colourful double, orange and bluish, among the prettiest in the sky.", "Gamma Andromedae", "Almach"),
 ("Castor", "Cástor", "Castor", "double", 51, "Parece una estrella y son seis, en tres parejas que giran unas alrededor de otras.", "It looks like one star and is six, in three pairs orbiting one another.", "Castor (star)", "Cástor (estrella)"),
 ("alf Cen A|alf Cen|Rigil Kentaurus", "Alfa Centauri", "Alpha Centauri", "double", 4.37, "El sistema estelar más cercano al Sol: dos estrellas parecidas a él y, más lejos, la pequeña Próxima.", "The star system nearest the Sun: two Sun-like stars and, farther out, little Proxima.", "Alpha Centauri", "Alfa Centauri"),
 ("Acrux", "Ácrux", "Acrux", "double", 320, "El pie de la Cruz del Sur: dos estrellas azules muy juntas.", "The foot of the Southern Cross: two close blue stars.", "Acrux", "Ácrux"),
 ("Cor Caroli", "Cor Caroli", "Cor Caroli", "double", 110, "Una doble fácil para cualquier telescopio, bajo el mango de la Osa Mayor.", "An easy double for any telescope, below the Big Dipper's handle.", "Cor Caroli", "Cor Caroli"),
 ("61 Cyg A|61 Cyg", "61 Cygni", "61 Cygni", "double", 11.4, "La primera estrella a la que se midió la distancia (Bessel, 1838). Dos enanas naranjas.", "The first star to have its distance measured (Bessel, 1838). Two orange dwarfs.", "61 Cygni", "61 Cygni"),
 ("Algieba", "Algieba", "Algieba", "double", 130, "Dos gigantes doradas en la melena del León.", "Two golden giants in the Lion's mane.", "Gamma Leonis", "Algieba"),
 ("tet01 Ori C|* tet01 Ori C", "El Trapecio", "The Trapezium", "double", 1340, "Cuatro estrellas recién nacidas en el corazón de la nebulosa de Orión; su luz es la que la hace brillar.", "Four newborn stars at the heart of the Orion Nebula; their light is what makes it glow.", "Trapezium Cluster", "Cúmulo del Trapecio"),
 ("Sirius", "Sirio y su enana blanca", "Sirius and its white dwarf", "double", 8.6, "La estrella más brillante de la noche tiene una compañera diminuta, Sirio B: la primera enana blanca descubierta.", "The brightest star at night has a tiny companion, Sirius B: the first white dwarf discovered.", "Sirius", "Sirio"),
 ("Algol", "Algol", "Algol", "variable", 90, "La «estrella del demonio»: cada 2,87 días una compañera la eclipsa y baja de magnitud 2,1 a 3,4 durante unas horas.", "The “Demon Star”: every 2.87 days a companion eclipses it and it drops from magnitude 2.1 to 3.4 for a few hours.", "Algol", "Algol"),
 ("Mira", "Mira", "Mira", "variable", 300, "«La maravillosa»: una gigante roja que cada 332 días pasa de verse a simple vista a necesitar telescopio.", "“The Wonderful”: a red giant that every 332 days goes from naked-eye visible to needing a telescope.", "Mira", "Mira"),
 ("del Cep|* del Cep", "Delta Cephei", "Delta Cephei", "variable", 890, "El modelo de las cefeidas: late cada 5,37 días, y su ritmo delata su brillo real. Con estrellas así se miden las distancias a otras galaxias.", "The model Cepheid: it pulses every 5.37 days, and its rhythm reveals its true brightness. Stars like this measure the distances to other galaxies.", "Delta Cephei", "Delta Cephei"),
 ("RR Lyr", "RR Lyrae", "RR Lyrae", "variable", 820, "Late en poco más de medio día. Las estrellas de su tipo sirven de «velas patrón» en los cúmulos globulares.", "It pulses in just over half a day. Stars of its type serve as “standard candles” in globular clusters.", "RR Lyrae", "RR Lyrae"),
 ("Polaris", "Polar", "Polaris", "variable", 430, "La estrella del norte es una cefeida (late cada 4 días, muy poco) y además un sistema triple.", "The North Star is a Cepheid (it pulses every 4 days, very slightly) and also a triple system.", "Polaris", "Estrella polar"),
 ("Betelgeuse", "Betelgeuse", "Betelgeuse", "variable", 550, "Una supergigante roja que cambia de brillo sin regla fija; a finales de 2019 se apagó mucho al expulsar una nube de polvo.", "A red supergiant whose brightness changes irregularly; in late 2019 it dimmed sharply after throwing off a dust cloud.", "Betelgeuse", "Betelgeuse"),
 ("eta Car|* eta Car", "Eta Carinae", "Eta Carinae", "variable", 7500, "Una de las estrellas más masivas conocidas. Hacia 1843 estalló sin destruirse y fue la segunda más brillante del cielo.", "One of the most massive stars known. Around 1843 it erupted without destroying itself and became the second-brightest star in the sky.", "Eta Carinae", "Eta Carinae"),
 ("R CrB", "R Coronae Borealis", "R Coronae Borealis", "variable", 4500, "Al revés que una nova: de pronto se apaga durante meses, tapada por su propio hollín.", "A nova in reverse: it suddenly fades for months, veiled by its own soot.", "R Coronae Borealis", "R Coronae Borealis"),
 ("T CrB", "T Coronae Borealis", "T Coronae Borealis", "nova", 3000, "Una nova recurrente, la «estrella llamarada»: estalló en 1866 y en 1946, unos ochenta años después, hasta verse a simple vista.", "A recurrent nova, the “Blaze Star”: it erupted in 1866 and in 1946, about eighty years later, becoming visible to the naked eye.", "T Coronae Borealis", "T Coronae Borealis"),
 ("chi Cyg|* chi Cyg|khi Cyg", "Chi Cygni", "Chi Cygni", "variable", 550, "Otra gigante como Mira: en 408 días su brillo cambia unas diez mil veces.", "Another Mira-like giant: over 408 days its brightness changes about ten-thousandfold.", "Chi Cygni", "Chi Cygni"),
 ("bet Lyr|Sheliak", "Beta Lyrae", "Beta Lyrae", "variable", 960, "Dos estrellas tan juntas que se deforman y se pasan gas; se eclipsan cada 12,9 días.", "Two stars so close that they distort and trade gas; they eclipse each other every 12.9 days.", "Beta Lyrae", "Sheliak"),
 ("mu Cep|* mu. Cep|Erakis", "Estrella Granate", "Garnet Star", "variable", 2800, "Una de las estrellas más grandes y rojas visibles a simple vista.", "One of the largest and reddest stars visible to the naked eye.", "Mu Cephei", "Mu Cephei"),
 ("VY CMa", "VY Canis Majoris", "VY Canis Majoris", "variable", 3900, "Una hipergigante roja, de las mayores estrellas conocidas: en el lugar del Sol llegaría más allá de Júpiter.", "A red hypergiant, among the largest stars known: in the Sun's place it would reach beyond Jupiter.", "VY Canis Majoris", "VY Canis Majoris"),
 ("Barnard's star|NAME Barnard's star|GJ 699", "Estrella de Barnard", "Barnard's Star", "nearby", 5.96, "La estrella que más rápido se mueve en nuestro cielo: recorre el ancho de la Luna en unos 180 años.", "The fastest-moving star in our sky: it crosses the Moon's width in about 180 years.", "Barnard's Star", "Estrella de Barnard"),
 ("Proxima Centauri", "Próxima Centauri", "Proxima Centauri", "nearby", 4.24, "La estrella más cercana al Sol: una enana roja con llamaradas y al menos un planeta en su zona templada.", "The star nearest the Sun: a flaring red dwarf with at least one planet in its temperate zone.", "Proxima Centauri", "Próxima Centauri"),
]
def build(rows, stars):
    out = []
    for sim, es, en, kind, dist, nes, nen, wen, wes in rows:
        r = resolve(sim); ra, dec = math.radians(r["ra"]), math.radians(r["dec"])
        o = {"name": es, "name_en": en, "kind": kind, "id": sim.split("|")[0], "nx": round(math.cos(dec) * math.cos(ra), 5), "ny": round(math.cos(dec) * math.sin(ra), 5), "nz": round(math.sin(dec), 5),
             "note_es": nes, "note_en": nen, "wiki_en": wen}
        if wes: o["wiki_es"] = wes
        if dist: o["dist_ly"] = dist
        if stars and r["v"] is not None: o["mag"] = round(r["v"], 1)
        out.append(o); print(f"{sim:18s} {r['ra']:9.4f} {r['dec']:+9.4f} {r['v']}")
    return out
# magnitud V de las estrellas que SIMBAD no la da por ese nombre (valores de catálogo); en las variables no se pone:
# cambia, y la nota ya dice entre qué valores
MAGS = {"Mizar": 2.2, "eps01 Lyr": 4.7, "Acrux": 0.8, "Algieba": 2.0, "Sirius": -1.46}
meta = {"source": "Posiciones (y magnitud V de las estrellas): SIMBAD, CDS Strasbourg. Distancias, periodos y notas: valores publicados, redondeados.", "read": time.strftime("%Y-%m-%d")}
odd, st = build(ODD, False), build(STARS, True)
for o in st:
    if o["kind"] in ("variable", "nova"): o.pop("mag", None)
    elif "mag" not in o and o["id"] in MAGS: o["mag"] = MAGS[o["id"]]
for name, objs in (("oddities.json", odd), ("special-stars.json", st)):
    json.dump({"meta": meta, "count": len(objs), "objects": objs}, open(os.path.join(ROOT, "public", name), "w"), ensure_ascii=False, separators=(",", ":"))
print("ok", len(odd), len(st))
