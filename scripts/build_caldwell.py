"""
Genera public/caldwell.json: los 109 objetos del catálogo Caldwell (Patrick Moore, Sky & Telescope,
diciembre de 1995) más la Gran y la Pequeña Nube de Magallanes, que Caldwell no incluye.

Por qué esta capa: Messier trabajaba en París y su lista deja fuera joyas del cielo sur que en Ecuador
se ven enteras (Omega Centauri, 47 Tucanae, la Nebulosa de Carina, la Tarántula, el Joyero…). Moore
compiló el Caldwell justamente para eso: complementa a Messier y no repite ninguno de sus objetos.

Qué sale de dónde (todo queda escrito en meta.sources del JSON):
  - Posición, tipo, magnitud, tamaño aparente y constelación: OpenNGC (Mattia Verga, CC BY-SA 4.0),
    NGC.csv y, para lo que no está en NGC/IC (Hiades, Cueva, Doble Cúmulo, Saco de Carbón, Gran Nube),
    addendum.csv. Se cruza por número NGC/IC; si OpenNGC marca la entrada como «Dup», se sigue a la
    designación que indica.
  - Correspondencia Caldwell → NGC/IC: tabla del artículo «Caldwell catalogue» de Wikipedia (que sigue
    a O'Meara 2002, «The Caldwell Objects»), con sus dos correcciones conocidas (C89 = NGC 6087).
  - Distancia: SIEMPRE con fuente. Por orden de preferencia:
      1. artículo con revisión por pares leído en su resumen (Baumgardt y Vasiliev 2021 para los 18
         cúmulos globulares, Pietrzyński et al. 2019 para la Gran Nube, Graczyk et al. 2020 para la
         Pequeña, Rekola et al. 2005 para NGC 253, Gieren et al. 2005 para NGC 300, Perryman et al.
         1998 para las Hiades);
      2. la ficha del objeto en el catálogo Caldwell del Hubble de NASA (science.nasa.gov), dato
         «Distance» de la página (87 objetos tienen página);
      3. para los que NASA no tiene, la referencia que cita el artículo de Wikipedia del objeto (se
         marca «vía Wikipedia»).
    Si nada de eso existe, el objeto va SIN distancia (no se inventa).
  - Incertidumbre: se marca dist_unc cuando la distancia es una suposición explícita o cuando otra
    fuente (la tabla de Wikipedia o NASA) difiere en más de un 30 %; la ficha lo dice y da el otro valor.

Duplicados: Caldwell no repite Messier, pero 21 de sus galaxias ya están en la capa «Galaxias»
(public/galaxies.json). Esas entradas se guardan con "in": "galaxies" y el nombre que tienen allí, para
que el buscador las encuentre por «C77» o «Caldwell 77», pero la capa Caldwell NO las vuelve a dibujar.

Uso:
    python3 scripts/build_caldwell.py              # regenera public/caldwell.json
    python3 scripts/build_caldwell.py --verificar  # además, compara con NASA y con Baumgardt en línea

Requisitos: scripts/raw/NGC.csv y scripts/raw/addendum.csv (OpenNGC). Si faltan, se descargan de
GitHub (el proxy del sistema se respeta; nunca se desactiva TLS).
"""
import csv
import json
import math
import os
import re
import sys
import urllib.request

from lib_astro import (RAW, PUBLIC, PC_TO_LY, parse_hms, parse_dms, radec_to_vec, sig, write_json,
                       kpc_to_ly, mpc_to_ly)
from build_deepsky import CONST_ES

OPENNGC = "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/"
NGC_CSV = os.path.join(RAW, "NGC.csv")
ADD_CSV = os.path.join(RAW, "addendum.csv")
VERIFIED = "2026-11-16"
NASA_PAGE = "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-{}/"
BAUMGARDT = "https://people.smp.uq.edu.au/HolgerBaumgardt/globular/parameter.html"
UNC_RATIO = 1.3          # otra fuente difiere más de un 30 % → distancia incierta

# ─── Catálogo ─────────────────────────────────────────────────────────────────────────────────────
# (n, designaciones OpenNGC, designación legible, nombre común EN, nombre común ES, artículo de Wikipedia EN)
# Nombres comunes: los de la tabla de Wikipedia; en español, solo los de uso extendido (si no hay, la ficha usa
# el inglés). Las designaciones «C009», «C014», «C041», «C099» son las del addendum de OpenNGC.
CATALOG = [
    (1, ["NGC0188"], "NGC 188", "Polarissima Cluster", "Cúmulo Polarissima", "NGC 188"),
    (2, ["NGC0040"], "NGC 40", "Bow-Tie Nebula", "Nebulosa Pajarita", "NGC 40"),
    (3, ["NGC4236"], "NGC 4236", "", "", "NGC 4236"),
    (4, ["NGC7023"], "NGC 7023", "Iris Nebula", "Nebulosa del Iris", "Iris Nebula"),
    (5, ["IC0342"], "IC 342", "Hidden Galaxy", "Galaxia Oculta", "IC 342"),
    (6, ["NGC6543"], "NGC 6543", "Cat's Eye Nebula", "Nebulosa Ojo de Gato", "Cat's Eye Nebula"),
    (7, ["NGC2403"], "NGC 2403", "", "", "NGC 2403"),
    (8, ["NGC0559"], "NGC 559", "", "", "NGC 559"),
    (9, ["C009"], "Sh2-155", "Cave Nebula", "Nebulosa de la Cueva", "Cave Nebula"),
    (10, ["NGC0663"], "NGC 663", "", "", "NGC 663"),
    (11, ["NGC7635"], "NGC 7635", "Bubble Nebula", "Nebulosa de la Burbuja", "NGC 7635"),
    (12, ["NGC6946"], "NGC 6946", "Fireworks Galaxy", "Galaxia de los Fuegos Artificiales", "NGC 6946"),
    (13, ["NGC0457"], "NGC 457", "Owl Cluster, E.T. Cluster", "Cúmulo de la Lechuza", "Owl Cluster"),
    (14, ["C014", "NGC0869", "NGC0884"], "NGC 869 + NGC 884", "Double Cluster, h & χ Persei", "Doble Cúmulo de Perseo", "Double Cluster"),
    (15, ["NGC6826"], "NGC 6826", "Blinking Planetary", "Nebulosa Parpadeante", "Blinking Planetary"),
    (16, ["NGC7243"], "NGC 7243", "", "", "NGC 7243"),
    (17, ["NGC0147"], "NGC 147", "", "", "NGC 147"),
    (18, ["NGC0185"], "NGC 185", "", "", "NGC 185"),
    (19, ["IC5146"], "IC 5146", "Cocoon Nebula", "Nebulosa del Capullo", "Cocoon Nebula"),
    (20, ["NGC7000"], "NGC 7000", "North America Nebula", "Nebulosa Norteamérica", "North America Nebula"),
    (21, ["NGC4449"], "NGC 4449", "", "", "NGC 4449"),
    (22, ["NGC7662"], "NGC 7662", "Blue Snowball", "Bola de Nieve Azul", "Blue Snowball"),
    (23, ["NGC0891"], "NGC 891", "Silver Sliver Galaxy", "", "NGC 891"),
    (24, ["NGC1275"], "NGC 1275", "Perseus A", "Perseo A", "Perseus A"),
    (25, ["NGC2419"], "NGC 2419", "", "", "NGC 2419"),
    (26, ["NGC4244"], "NGC 4244", "", "", "NGC 4244"),
    (27, ["NGC6888"], "NGC 6888", "Crescent Nebula", "Nebulosa Creciente", "Crescent Nebula"),
    (28, ["NGC0752"], "NGC 752", "", "", "NGC 752"),
    (29, ["NGC5005"], "NGC 5005", "", "", "NGC 5005"),
    (30, ["NGC7331"], "NGC 7331", "", "", "NGC 7331"),
    (31, ["IC0405"], "IC 405", "Flaming Star Nebula", "Nebulosa de la Estrella Flameante", "IC 405"),
    (32, ["NGC4631"], "NGC 4631", "Whale Galaxy", "Galaxia de la Ballena", "NGC 4631"),
    (33, ["NGC6992"], "NGC 6992", "East Veil Nebula", "Nebulosa del Velo (este)", "Veil Nebula"),
    (34, ["NGC6960"], "NGC 6960", "West Veil Nebula", "Nebulosa del Velo (oeste)", "Veil Nebula"),
    (35, ["NGC4889"], "NGC 4889", "Coma B", "", "NGC 4889"),
    (36, ["NGC4559"], "NGC 4559", "", "", "NGC 4559"),
    (37, ["NGC6885"], "NGC 6885", "", "", "NGC 6885"),
    (38, ["NGC4565"], "NGC 4565", "Needle Galaxy", "Galaxia de la Aguja", "NGC 4565"),
    (39, ["NGC2392"], "NGC 2392", "Eskimo Nebula, Clown Face Nebula", "Nebulosa del Esquimal", "Eskimo Nebula"),
    (40, ["NGC3626"], "NGC 3626", "", "", "NGC 3626"),
    (41, ["C041"], "Mel 25", "Hyades", "Híades", "Hyades (star cluster)"),
    (42, ["NGC7006"], "NGC 7006", "", "", "NGC 7006"),
    (43, ["NGC7814"], "NGC 7814", "", "", "NGC 7814"),
    (44, ["NGC7479"], "NGC 7479", "Superman Galaxy", "", "NGC 7479"),
    (45, ["NGC5248"], "NGC 5248", "", "", "NGC 5248"),
    (46, ["NGC2261"], "NGC 2261", "Hubble's Variable Nebula", "Nebulosa Variable de Hubble", "Hubble's Variable Nebula"),
    (47, ["NGC6934"], "NGC 6934", "", "", "NGC 6934"),
    (48, ["NGC2775"], "NGC 2775", "", "", "NGC 2775"),
    (49, ["NGC2237"], "NGC 2237", "Rosette Nebula", "Nebulosa Roseta", "Rosette Nebula"),
    (50, ["NGC2244"], "NGC 2244", "Satellite Cluster", "", "NGC 2244"),
    (51, ["IC1613"], "IC 1613", "", "", "IC 1613"),
    (52, ["NGC4697"], "NGC 4697", "", "", "NGC 4697"),
    (53, ["NGC3115"], "NGC 3115", "Spindle Galaxy", "Galaxia del Huso", "NGC 3115"),
    (54, ["NGC2506"], "NGC 2506", "", "", "NGC 2506"),
    (55, ["NGC7009"], "NGC 7009", "Saturn Nebula", "Nebulosa Saturno", "Saturn Nebula"),
    (56, ["NGC0246"], "NGC 246", "Skull Nebula", "Nebulosa de la Calavera", "NGC 246"),
    (57, ["NGC6822"], "NGC 6822", "Barnard's Galaxy", "Galaxia de Barnard", "Barnard's Galaxy"),
    (58, ["NGC2360"], "NGC 2360", "Caroline's Cluster", "Cúmulo de Caroline", "NGC 2360"),
    (59, ["NGC3242"], "NGC 3242", "Ghost of Jupiter", "Fantasma de Júpiter", "Ghost of Jupiter"),
    (60, ["NGC4038"], "NGC 4038", "Antennae Galaxies", "Galaxias Antena", "Antennae Galaxies"),
    (61, ["NGC4039"], "NGC 4039", "Antennae Galaxies", "Galaxias Antena", "Antennae Galaxies"),
    (62, ["NGC0247"], "NGC 247", "", "", "NGC 247"),
    (63, ["NGC7293"], "NGC 7293", "Helix Nebula", "Nebulosa de la Hélice", "Helix Nebula"),
    (64, ["NGC2362"], "NGC 2362", "Tau Canis Majoris Cluster", "Cúmulo de Tau Canis Majoris", "NGC 2362"),
    (65, ["NGC0253"], "NGC 253", "Sculptor Galaxy, Silver Coin", "Galaxia del Escultor", "Sculptor Galaxy"),
    (66, ["NGC5694"], "NGC 5694", "", "", "NGC 5694"),
    (67, ["NGC1097"], "NGC 1097", "", "", "NGC 1097"),
    (68, ["NGC6729"], "NGC 6729", "R CrA Nebula", "Nebulosa de R Coronae Australis", "NGC 6729"),
    (69, ["NGC6302"], "NGC 6302", "Bug Nebula, Butterfly Nebula", "Nebulosa del Insecto", "NGC 6302"),
    (70, ["NGC0300"], "NGC 300", "Sculptor Pinwheel Galaxy", "", "NGC 300"),
    (71, ["NGC2477"], "NGC 2477", "", "", "NGC 2477"),
    (72, ["NGC0055"], "NGC 55", "String of Pearls Galaxy", "", "NGC 55"),
    (73, ["NGC1851"], "NGC 1851", "", "", "NGC 1851"),
    (74, ["NGC3132"], "NGC 3132", "Eight-Burst Nebula, Southern Ring Nebula", "Nebulosa del Anillo del Sur", "NGC 3132"),
    (75, ["NGC6124"], "NGC 6124", "", "", "NGC 6124"),
    (76, ["NGC6231"], "NGC 6231", "", "", "NGC 6231"),
    (77, ["NGC5128"], "NGC 5128", "Centaurus A", "Centauro A", "Centaurus A"),
    (78, ["NGC6541"], "NGC 6541", "", "", "NGC 6541"),
    (79, ["NGC3201"], "NGC 3201", "", "", "NGC 3201"),
    (80, ["NGC5139"], "NGC 5139", "Omega Centauri", "Omega Centauri", "Omega Centauri"),
    (81, ["NGC6352"], "NGC 6352", "", "", "NGC 6352"),
    (82, ["NGC6193"], "NGC 6193", "", "", "NGC 6193"),
    (83, ["NGC4945"], "NGC 4945", "", "", "NGC 4945"),
    (84, ["NGC5286"], "NGC 5286", "", "", "NGC 5286"),
    (85, ["IC2391"], "IC 2391", "Omicron Velorum Cluster", "Cúmulo de Omicron Velorum", "IC 2391"),
    (86, ["NGC6397"], "NGC 6397", "", "", "NGC 6397"),
    (87, ["NGC1261"], "NGC 1261", "", "", "NGC 1261"),
    (88, ["NGC5823"], "NGC 5823", "", "", "NGC 5823"),
    (89, ["NGC6087"], "NGC 6087", "S Normae Cluster", "Cúmulo de S Normae", "NGC 6087"),
    (90, ["NGC2867"], "NGC 2867", "", "", "NGC 2867"),
    (91, ["NGC3532"], "NGC 3532", "Wishing Well Cluster", "Cúmulo del Pozo de los Deseos", "NGC 3532"),
    (92, ["NGC3372"], "NGC 3372", "Carina Nebula, Eta Carinae Nebula", "Nebulosa de Carina", "Carina Nebula"),
    (93, ["NGC6752"], "NGC 6752", "Great Peacock Globular", "Gran Globular del Pavo Real", "NGC 6752"),
    (94, ["NGC4755"], "NGC 4755", "Jewel Box, Kappa Crucis Cluster", "El Joyero", "Jewel Box (star cluster)"),
    (95, ["NGC6025"], "NGC 6025", "", "", "NGC 6025"),
    (96, ["NGC2516"], "NGC 2516", "Southern Beehive Cluster", "Colmena del Sur", "NGC 2516"),
    (97, ["NGC3766"], "NGC 3766", "Pearl Cluster", "Cúmulo de la Perla", "NGC 3766"),
    (98, ["NGC4609"], "NGC 4609", "", "", "NGC 4609"),
    (99, ["C099"], "—", "Coalsack Nebula", "Saco de Carbón", "Coalsack Nebula"),
    (100, ["IC2944"], "IC 2944", "Lambda Centauri Nebula", "Nebulosa de Lambda Centauri", "IC 2944"),
    (101, ["NGC6744"], "NGC 6744", "", "", "NGC 6744"),
    (102, ["IC2602"], "IC 2602", "Theta Carinae Cluster, Southern Pleiades", "Pléyades del Sur", "IC 2602"),
    (103, ["NGC2070"], "NGC 2070", "Tarantula Nebula, 30 Doradus", "Nebulosa de la Tarántula", "Tarantula Nebula"),
    (104, ["NGC0362"], "NGC 362", "", "", "NGC 362"),
    (105, ["NGC4833"], "NGC 4833", "", "", "NGC 4833"),
    (106, ["NGC0104"], "NGC 104", "47 Tucanae", "47 Tucanae", "47 Tucanae"),
    (107, ["NGC6101"], "NGC 6101", "", "", "NGC 6101"),
    (108, ["NGC4372"], "NGC 4372", "", "", "NGC 4372"),
    (109, ["NGC3195"], "NGC 3195", "", "", "NGC 3195"),
]

# Nubes de Magallanes: NO están en Caldwell (Moore dejó fuera las galaxias a simple vista más obvias).
# Se añaden a mano y lo dicen ("origin").
CLOUDS = [
    ("LMC", ["ESO056-115"], "ESO 56-115", "Large Magellanic Cloud", "Gran Nube de Magallanes",
     "Large Magellanic Cloud", "Gran Nube de Magallanes"),
    ("SMC", ["NGC0292"], "NGC 292", "Small Magellanic Cloud", "Pequeña Nube de Magallanes",
     "Small Magellanic Cloud", "Pequeña Nube de Magallanes"),
]

# ─── Distancias ───────────────────────────────────────────────────────────────────────────────────
# NASA, «Hubble's Caldwell Catalog»: dato «Distance» de la ficha de cada objeto (leído el 2026-11-16).
# Valores en años luz tal como los da la página. 87 objetos tienen página (C60 y C61 comparten una).
NASA = {
    1: 5400, 2: 3500, 3: 11.7e6, 4: 1400, 5: 11e6, 6: 3000, 7: 12e6, 9: 3000, 11: 7000, 12: 15e6,
    14: 7500, 15: 2200, 17: 2.5e6, 18: 2e6, 20: 1800, 21: 10e6, 22: 2500, 23: 35e6, 24: 230e6,
    25: 300000, 26: 13e6, 27: 4700, 29: 75e6, 30: 45e6, 32: 25e6, 33: 2000, 34: 2000, 35: 300e6,
    36: 30e6, 38: 40e6, 39: 5000, 40: 70e6, 42: 135000, 43: 40e6, 44: 110e6, 45: 59e6, 46: 2500,
    47: 50000, 48: 67e6, 51: 2.3e6, 52: 40e6, 53: 32e6, 55: 1400, 56: 1600, 57: 2e6, 58: 3700,
    59: 1400, 60: 65e6, 61: 65e6, 62: 11e6, 63: 650, 65: 10e6, 66: 100000, 67: 45e6, 68: 400,
    69: 4000, 70: 7500, 71: 4000, 72: 6.5e6, 73: 40000, 74: 2000, 76: 5600, 77: 11e6, 78: 22000,
    79: 16000, 80: 17000, 81: 20000, 82: 3700, 83: 12e6, 84: 35000, 86: 7800, 87: 50000, 89: 3500,
    90: 6000, 92: 7500, 93: 13000, 94: 6500, 96: 1000, 99: 600, 100: 6000, 101: 30e6, 103: 170000,
    104: 27000, 105: 22000, 106: 16700, 107: 50000, 108: 19000, 109: 5500,
}
# magnitud aparente de esas fichas (respaldo si OpenNGC no trae magnitud)
NASA_MAG = {
    1: 8.1, 2: 12.3, 3: 9.6, 4: 7.0, 5: 8.4, 6: 8.2, 7: 8.9, 9: 8.0, 11: 8.7, 12: 9.7, 14: 5.3, 15: 8.8,
    17: 9.5, 18: 9.2, 20: 5.0, 21: 9.6, 22: 8.3, 23: 10.0, 24: 11.9, 25: 10.4, 26: 10.4, 27: 8.8,
    29: 9.8, 30: 9.5, 32: 9.2, 33: 8.0, 34: 8.0, 35: 11.5, 36: 10.0, 38: 9.6, 39: 9.2, 40: 10.6,
    42: 10.5, 43: 10.5, 44: 10.8, 45: 10.0, 46: 10.0, 47: 8.8, 48: 11.0, 51: 9.9, 52: 10.9, 53: 9.9,
    55: 8.0, 56: 8.0, 57: 8.8, 58: 7.2, 59: 7.8, 60: 10.5, 61: 10.5, 62: 9.2, 63: 7.3, 65: 7.6,
    66: 10.2, 67: 9.2, 68: 9.5, 69: 9.5, 70: 8.1, 71: 5.8, 72: 7.8, 73: 7.3, 74: 9.4, 76: 2.6, 77: 6.7,
    78: 6.3, 79: 6.7, 80: 3.7, 81: 7.8, 82: 5.2, 83: 9.3, 84: 7.6, 86: 5.7, 87: 8.3, 89: 5.4, 90: 9.7,
    92: 4.8, 93: 5.4, 94: 4.2, 96: 3.8, 100: 2.9, 101: 8.6, 103: 4.0, 104: 6.4, 105: 7.0, 106: 4.0,
    107: 10.6, 108: 10.0, 109: 11.6,
}
# Tabla del artículo «Caldwell catalogue» de Wikipedia (miles de años luz). Sin referencia por objeto:
# NO se usa como distancia, solo como segunda opinión para marcar las distancias inciertas.
WIKI_TABLE_KLY = {
    1: 4.8, 2: 3.5, 3: 7000, 4: 1.4, 5: 10000, 6: 3, 7: 14000, 8: 3.7, 9: 2.8, 10: 7.2, 11: 7.1, 12: 18000,
    13: 7.9, 14: 7.3, 15: 2.2, 16: 2.5, 17: 2300, 18: 2300, 19: 3.3, 20: 2.6, 21: 10000, 22: 3.2,
    23: 31000, 24: 230000, 25: 275, 26: 10000, 27: 4.7, 28: 1.2, 29: 69000, 30: 47000, 31: 1.6,
    32: 22000, 33: 2.5, 34: 2.5, 35: 300000, 36: 32000, 37: 1.95, 38: 32000, 39: 4, 40: 86000,
    41: 0.151, 42: 135, 43: 49000, 44: 106000, 45: 74000, 46: 2.5, 47: 57, 48: 55000, 49: 4.9, 50: 4.9,
    51: 2300, 52: 76000, 53: 22000, 54: 10, 55: 1.4, 56: 1.6, 57: 2300, 58: 3.7, 59: 1.4, 60: 83000,
    61: 83000, 62: 6800, 63: 0.522, 64: 5.1, 65: 9800, 66: 113, 67: 47000, 68: 0.424, 69: 5.2,
    70: 3900, 71: 3.7, 72: 4200, 73: 39.4, 74: 2, 75: 1.5, 76: 6, 77: 16000, 78: 22.3, 79: 17,
    80: 17.3, 81: 18.6, 82: 4.3, 83: 17000, 84: 36, 85: 0.5, 86: 7.5, 87: 55.5, 88: 3.4, 89: 3.3,
    90: 5.5, 91: 1.6, 92: 7.5, 93: 13, 94: 4.9, 95: 2.5, 96: 1.3, 97: 5.8, 98: 4.2, 99: 0.61, 100: 6,
    101: 34000, 102: 0.492, 103: 170, 104: 27.7, 105: 19.6, 106: 14.7, 107: 49.9, 108: 18.9, 109: 5.4,
}

# magnitud de la misma tabla (último respaldo, solo para dibujar el símbolo; mag_src lo dice)
WIKI_TABLE_MAG = {
    1: 8.1, 2: 11, 3: 9.7, 4: 7, 5: 9, 6: 9, 7: 8.4, 8: 9.5, 9: 7.7, 10: 7.1, 11: 10, 12: 8.9, 13: 6.4, 14: 4,
    15: 10, 16: 6.4, 17: 9.3, 18: 9.2, 19: 7.2, 20: 4, 21: 9.4, 22: 9, 23: 10, 24: 11.6, 25: 10.4, 26: 10.2,
    27: 7.4, 28: 5.7, 29: 9.8, 30: 9.5, 31: 13, 32: 9.3, 33: 7, 34: 7, 35: 11.4, 36: 9.9, 37: 6, 38: 9.6,
    39: 10, 40: 10.9, 41: 0.5, 42: 10.6, 43: 10.5, 44: 11, 45: 10.2, 47: 8.9, 48: 10.3, 49: 9, 50: 4.8,
    51: 9.3, 52: 9.3, 53: 9.2, 54: 7.6, 55: 8, 56: 8, 57: 9, 58: 7.2, 59: 9, 60: 10.7, 61: 13, 62: 8.9,
    63: 7.3, 64: 4.1, 65: 7.1, 66: 10.2, 67: 9.3, 69: 13, 70: 9, 71: 5.8, 72: 8, 73: 7.3, 74: 8, 75: 5.8,
    76: 2.6, 77: 7, 78: 6.6, 79: 6.8, 80: 3.7, 81: 8.2, 82: 5.2, 83: 9, 84: 7.6, 85: 2.5, 86: 5.7, 87: 8.4,
    88: 7.9, 89: 5.4, 90: 10, 91: 3, 92: 3, 93: 5.4, 94: 4.2, 95: 5.1, 96: 3.8, 97: 5.3, 98: 6.9, 100: 4.5,
    101: 9, 102: 1.9, 103: 8.2, 104: 6.6, 105: 7.4, 106: 4, 107: 9.3, 108: 7.8, 109: 11.6,
}

# Referencias (clave corta → cita). La ficha muestra "src"; "ref" queda en el JSON para auditar.
REFS = {
    "BV21": ("Baumgardt y Vasiliev 2021", "Baumgardt & Vasiliev 2021, MNRAS 505, 5957 (doi:10.1093/mnras/stab1474); "
             "tabla en línea de H. Baumgardt (UQ): " + BAUMGARDT),
    "P19": ("Pietrzyński et al. 2019", "Pietrzyński et al. 2019, Nature 567, 200 (doi:10.1038/s41586-019-0999-4; arXiv:1903.08096): 49,59 ± 0,09 ± 0,54 kpc"),
    "G20": ("Graczyk et al. 2020", "Graczyk et al. 2020, ApJ 904, 13 (doi:10.3847/1538-4357/abbb2b; arXiv:2010.08754): 62,44 ± 0,47 ± 0,81 kpc"),
    "R05": ("Rekola et al. 2005", "Rekola et al. 2005, MNRAS 361, 330 (doi:10.1111/j.1365-2966.2005.09166.x): 3,34 (+0,26 −0,38) Mpc"),
    "G05": ("Gieren et al. 2005", "Gieren et al. 2005, ApJ 628, 695 (doi:10.1086/430903; arXiv:astro-ph/0503626): (m−M)₀ = 26,37 ± 0,04 ± 0,03"),
    "P98": ("Perryman et al. 1998", "Perryman et al. 1998, A&A 331, 81 (arXiv:astro-ph/9707253): 46,34 ± 0,27 pc al centro de masas"),
    "NASA": ("NASA, catálogo Caldwell del Hubble", "NASA, «Hubble's Caldwell Catalog», ficha de cada objeto: " + NASA_PAGE.format("N")),
    "K13": ("Kharchenko et al. 2013 (vía Wikipedia)", "Kharchenko et al. 2013, A&A 558, A53, citado en Wikipedia «NGC 559»"),
    "M25": ("Marco et al. 2025 (vía Wikipedia)", "Marco et al. 2025, MNRAS 542, 703, citado en Wikipedia «NGC 663»"),
    "F08": ("Frinchaboy y Majewski 2008 (vía Wikipedia)", "Frinchaboy & Majewski 2008, AJ 136, 118, citado en Wikipedia «NGC 457»"),
    "Po21": ("Poggio et al. 2021 (vía Wikipedia)", "Poggio et al. 2021, A&A 651, A104 (Gaia EDR3), citado en Wikipedia «NGC 7243»"),
    "K19": ("Kuhn et al. 2019 (vía Wikipedia)", "Kuhn et al. 2019, ApJ 870, 32 (Gaia DR2), citado en Wikipedia «IC 5146»"),
    "GH22": ("Gaysin y Hojaev 2022 (vía Wikipedia)", "Gaysin & Hojaev 2022, Cool Stars 21, 82 (Gaia EDR3), citado en Wikipedia «NGC 752»"),
    "PY05": ("Phelps y Ybarra 2005 (vía Wikipedia)", "Phelps & Ybarra 2005, ApJ 627, 845, citado en Wikipedia «Rosette Nebula»"),
    "R19": ("Rangwal et al. 2019 (vía Wikipedia)", "Rangwal et al. 2019, MNRAS 490, 1383 (Gaia DR2), citado en Wikipedia «NGC 2506»"),
    "W09": ("Wu et al. 2009 (vía Wikipedia)", "Wu et al. 2009, MNRAS 399, 2146, citado en Wikipedia «NGC 2362»"),
    "SEDS": ("SEDS, NGC Online (vía Wikipedia)", "SEDS NGC Online, http://messier.seds.org/xtra/ngc/n6124.html, citado en Wikipedia «NGC 6124»"),
    "SIM": ("SIMBAD (vía Wikipedia)", "Medidas de distancia de SIMBAD (CDS), citadas en Wikipedia «IC 2391» / «IC 2602»"),
    "D21": ("Dias et al. 2021 (vía Wikipedia)", "Dias et al. 2021, MNRAS 504, 356 (Gaia DR2), citado en Wikipedia «NGC 5823»"),
    "Ro99": ("Robichon et al. 1999 (vía Wikipedia)", "Robichon et al. 1999, A&A 345, 471 (Hipparcos), citado en Wikipedia «NGC 3532»"),
    "T21": ("Tarricq et al. 2021 (vía Wikipedia)", "Tarricq et al. 2021, A&A 647, A19 (Gaia EDR3), citado en Wikipedia «NGC 6025» / «NGC 3766» / «NGC 4609»"),
}

# Distancias que NO salen de la ficha de NASA: (valor, unidad, referencia, nota). Unidades: ly, pc, kpc, Mpc,
# "mod" (módulo de distancia). Los 18 cúmulos globulares usan siempre Baumgardt y Vasiliev 2021 (R☉ de la tabla).
OVERRIDES = {
    25: (88.47, "kpc", "BV21", None), 42: (39.32, "kpc", "BV21", None), 47: (15.72, "kpc", "BV21", None),
    66: (34.84, "kpc", "BV21", None), 73: (11.95, "kpc", "BV21", None), 78: (7.61, "kpc", "BV21", None),
    79: (4.74, "kpc", "BV21", None), 80: (5.43, "kpc", "BV21", None), 81: (5.54, "kpc", "BV21", None),
    84: (11.10, "kpc", "BV21", None), 86: (2.48, "kpc", "BV21", None), 87: (16.40, "kpc", "BV21", None),
    93: (4.12, "kpc", "BV21", None), 104: (8.83, "kpc", "BV21", None), 105: (6.48, "kpc", "BV21", None),
    106: (4.52, "kpc", "BV21", None), 107: (14.45, "kpc", "BV21", None), 108: (5.71, "kpc", "BV21", None),
    41: (46.34, "pc", "P98", None),
    65: (3.34, "Mpc", "R05", None),
    # la ficha de NASA da 7.500 a. l. en su recuadro, pero su propio texto dice «unos 6 millones»: errata
    70: (26.37, "mod", "G05", None),
    # la Tarántula está DENTRO de la Gran Nube: se le da la distancia medida de la Gran Nube
    103: (49.59, "kpc", "P19", "tarantula"),
    # sin ficha en NASA: la referencia que cita el artículo de Wikipedia del objeto
    8: (2200, "pc", "K13", None), 10: (8800, "ly", "M25", None), 13: (2.429, "kpc", "F08", None),
    16: (878.0, "pc", "Po21", None), 19: (780, "pc", "K19", None), 28: (1470, "ly", "GH22", None),
    49: (1600, "pc", "PY05", None),
    # NGC 2244 es el cúmulo que ilumina la Roseta: se le da la distancia de la nebulosa (suposición)
    50: (1600, "pc", "PY05", "rosette"),
    54: (3.88, "kpc", "R19", None), 64: (1.480, "kpc", "W09", None), 75: (512, "pc", "SEDS", None),
    85: (176, "pc", "SIM", None), 88: (1434, "pc", "D21", None), 91: (405, "pc", "Ro99", None),
    95: (739.0, "pc", "T21", None), 97: (2.041, "kpc", "T21", None), 98: (1379, "pc", "T21", None),
    102: (149, "pc", "SIM", None),
    "LMC": (49.59, "kpc", "P19", None), "SMC": (62.44, "kpc", "G20", None),
}
# Magnitud V de los 18 cúmulos globulares: Baumgardt et al. 2020 (columna «V [mag]» de la misma tabla de
# Baumgardt). OpenNGC da valores muy distintos para algunos (Omega Centauri: 5,33 frente a 3,50).
BV_VMAG = {
    25: 10.56, 42: 10.69, 47: 8.74, 66: 9.86, 73: 7.07, 78: 6.61, 79: 6.77, 80: 3.50, 81: 8.06, 84: 7.35,
    86: 5.45, 87: 8.31, 93: 5.35, 104: 6.48, 105: 7.19, 106: 4.08, 107: 8.68, 108: 7.37,
}
# Magnitud que no se puede verificar: NGC 6885 (C37) es «Dup» de NGC 6882 en OpenNGC, que da V = 14,1 y marca la
# identificación como incierta; la tabla de Wikipedia da 6 sin referencia. Va sin magnitud.
NO_MAG = {37}

# Sin distancia verificable: IC 405 (Wikipedia solo cita una enciclopedia divulgativa) y NGC 6885 (sin
# referencia). Se muestran sin distancia.
NO_DISTANCE = {31, 37}
ASSUMED = {"tarantula", "rosette"}
ASSUMED_UNC = {"rosette"}           # la Tarántula está dentro de la Gran Nube: suposición segura, no incierta
NASA_ERRATA = {70}                  # su recuadro no coincide con el texto de la misma ficha: no sirve de contraste

TYPE_MAP = {
    "OCl": "open", "GCl": "globular", "PN": "planetary", "HII": "nebula", "Neb": "nebula", "EmN": "nebula",
    "RfN": "nebula", "SNR": "snr", "G": "galaxy", "GPair": "galaxy", "GGroup": "galaxy", "Cl+N": "clneb",
    "DrkN": "dark", "*Ass": "cluster",
}


def to_ly(v, unit):
    if unit == "ly":
        return v
    if unit == "pc":
        return v * PC_TO_LY
    if unit == "kpc":
        return kpc_to_ly(v)
    if unit == "Mpc":
        return mpc_to_ly(v)
    if unit == "mod":
        return 10 ** (v / 5 + 1) * PC_TO_LY
    raise ValueError(unit)


def fetch_openngc():
    os.makedirs(RAW, exist_ok=True)
    for fname, path in (("NGC.csv", NGC_CSV), ("addendum.csv", ADD_CSV)):
        if not os.path.exists(path):
            print(f"Descargando {fname} de OpenNGC…")
            urllib.request.urlretrieve(OPENNGC + fname, path)


def load_rows():
    fetch_openngc()
    rows = {}
    for path in (NGC_CSV, ADD_CSV):
        for r in csv.DictReader(open(path, encoding="utf-8"), delimiter=";"):
            rows[r["Name"].strip()] = r
    return rows


def fnum(r, k):
    try:
        return float((r.get(k) or "").strip())
    except ValueError:
        return None


def resolve(rows, name):
    """Fila de OpenNGC; si es «Dup», la de la designación a la que remite."""
    r = rows.get(name)
    if r is None:
        raise SystemExit(f"OpenNGC no tiene {name}")
    if r["Type"] == "Dup":
        for col, pre in (("NGC", "NGC"), ("IC", "IC")):
            v = (r.get(col) or "").strip()
            if v:
                tgt = f"{pre}{int(re.match(r'\d+', v).group()):04d}" + re.sub(r"^\d+", "", v)
                return rows[tgt], tgt
    return r, name


def magnitude(n, rows_used):
    """(mag, fuente). Globulares: Baumgardt et al. 2020. Resto: OpenNGC V; si no, B; si V−B > 1 (imposible para
    estos objetos: errata), NASA o B; luego NASA y, como último respaldo, la tabla de Wikipedia."""
    if n in NO_MAG:
        return None, None
    if n in BV_VMAG:
        return BV_VMAG[n], "Baumgardt et al. 2020"
    if len(rows_used) > 1:                       # Doble Cúmulo: suma del brillo de NGC 869 y NGC 884
        mags = [fnum(r, "V-Mag") for r in rows_used]
        if all(m is not None for m in mags):
            flux = sum(10 ** (-0.4 * m) for m in mags)
            return round(-2.5 * math.log10(flux), 2), "OpenNGC (NGC 869 + NGC 884)"
    r = rows_used[0]
    v, b = fnum(r, "V-Mag"), fnum(r, "B-Mag")
    if v is not None and b is not None and v - b > 1.0:
        if n in NASA_MAG:
            return NASA_MAG[n], "NASA"
        return b, "OpenNGC (B)"
    if v is not None:
        return v, "OpenNGC"
    if b is not None:
        return b, "OpenNGC (B)"
    if n in NASA_MAG:
        return NASA_MAG[n], "NASA"
    if n in WIKI_TABLE_MAG:
        return WIKI_TABLE_MAG[n], "tabla de Wikipedia «Caldwell catalogue»"
    return None, None


def distance(key):
    """{dist_ly, dist_src, dist_ref, dist_kind, dist_unc, dist_alt_ly?, dist_alt_src?, dist_note?} o {}."""
    if key in NO_DISTANCE:
        return {}
    alt = None
    if key in OVERRIDES:
        v, unit, ref, note = OVERRIDES[key]
        ly = to_ly(v, unit)
        src, cite = REFS[ref]
        kind = "assumed" if note in ASSUMED else ("wiki" if "vía Wikipedia" in src else "paper")
        if key in NASA and key not in NASA_ERRATA:
            alt = (NASA[key], "nasa")
    elif key in NASA:
        ly, (src, cite), kind, note = NASA[key], REFS["NASA"], "nasa", None
        cite = cite.replace("caldwell-N/", f"caldwell-{key}/" if key not in (60, 61) else "caldwell-60-61/")
    else:
        return {}
    if alt is None and isinstance(key, int) and key in WIKI_TABLE_KLY:
        alt = (WIKI_TABLE_KLY[key] * 1000, "wikipedia")
    out = {"dist_ly": int(sig(ly, 3)) if ly >= 1000 else int(round(ly)), "dist_src": src, "dist_ref": cite, "dist_kind": kind}
    unc = note in ASSUMED_UNC
    if alt and max(alt[0], ly) / min(alt[0], ly) > UNC_RATIO:
        unc = True
        out["dist_alt_ly"] = int(sig(alt[0], 2))
        out["dist_alt_src"] = alt[1]
    out["dist_unc"] = unc
    if note:
        out["dist_note"] = note
    return out


# nombre latino (IAU) de cada constelación, para la ficha en inglés: el mismo que ya usa el Cielo (sky.json)
CONST_LA = {c["ab"]: c["la"] for c in json.load(open(os.path.join(PUBLIC, "sky.json"), encoding="utf-8"))["constellations"]}


def base_obj(rows, names):
    used = []
    for nm in names:
        r, _ = resolve(rows, nm)
        used.append(r)
    pos = used[0]                                   # la primera designación fija la posición
    ra, dec = parse_hms(pos["RA"]), parse_dms(pos["Dec"])
    nx, ny, nz = radec_to_vec(ra, dec)
    otype = pos["Type"]
    const = pos["Const"].strip()
    o = {"nx": nx, "ny": ny, "nz": nz, "type": TYPE_MAP.get(otype, "other"), "otype": otype}
    if names[0] == "C014":                          # Doble Cúmulo: el tipo y el brillo, de sus dos cúmulos
        o["type"] = "open"
        used = used[1:]
    size = fnum(pos, "MajAx")
    if size:
        o["size"] = round(size, 1)
    if const:
        o["const"] = const
        o["const_es"] = CONST_ES.get(const, const)
        o["const_la"] = CONST_LA.get(const, const)
    return o, used


def build(verify=False):
    rows = load_rows()
    galaxies = json.load(open(os.path.join(PUBLIC, "galaxies.json"), encoding="utf-8"))["objects"]
    messier = json.load(open(os.path.join(PUBLIC, "deepsky.json"), encoding="utf-8"))["objects"]
    gal_by_cat = {g["cat"]: g for g in galaxies}
    messier_ngc = {m.get("ngc") for m in messier if m.get("ngc")}

    objects = []
    for n, names, cat, cn, cn_es, wiki in CATALOG:
        o, used = base_obj(rows, names)
        mag, mag_src = magnitude(n, used)
        ent = {"c": n, "name": f"C{n}", "cat": cat, "ids": [x for x in names if not x.startswith("C0")], **o}
        if mag is not None:
            ent["mag"] = round(mag, 2)
            ent["mag_src"] = mag_src
        if cn:
            ent["cn"] = cn
        if cn_es:
            ent["cn_es"] = cn_es
        ent["wiki"] = wiki
        if any(i in messier_ngc for i in ent["ids"]):
            raise SystemExit(f"C{n} está en Messier: el catálogo Caldwell no debería repetirlo")
        dup = next((gal_by_cat[i] for i in ent["ids"] if i in gal_by_cat), None)
        if dup:
            ent["in"] = "galaxies"
            ent["in_name"] = dup["name"]          # así se llama en galaxies.json (ahí se abre su ficha)
        else:
            ent.update(distance(n))
        objects.append(ent)

    for key, names, cat, cn, cn_es, wiki, wiki_es in CLOUDS:
        o, used = base_obj(rows, names)
        mag, mag_src = magnitude(None, used)
        ent = {"c": None, "name": key, "cat": cat, "ids": names, **o, "mag": round(mag, 2), "mag_src": mag_src,
               "cn": cn, "cn_es": cn_es, "wiki": wiki, "wiki_es": wiki_es,
               "origin": "Añadida a Teseo: no forma parte del catálogo Caldwell."}
        ent.update(distance(key))
        objects.append(ent)

    drawn = [o for o in objects if not o.get("in")]
    with_d = [o for o in drawn if o.get("dist_ly")]
    meta = {
        "source": "Catálogo Caldwell (P. Moore, Sky & Telescope 90, 6, dic. 1995) + Nubes de Magallanes",
        "count": len(objects), "drawn": len(drawn), "with_distance": len(with_d),
        "in_other_layers": [o["name"] for o in objects if o.get("in")],
        "verified": VERIFIED,
        "sources": {
            "positions": "OpenNGC (Mattia Verga), NGC.csv y addendum.csv, CC BY-SA 4.0 — https://github.com/mattiaverga/OpenNGC",
            "caldwell_list": "Wikipedia, «Caldwell catalogue» (tabla; sigue a O'Meara 2002, The Caldwell Objects), CC BY-SA 4.0",
            "distances": {k: v[1] for k, v in REFS.items()},
        },
        "licenses": {"OpenNGC": "CC BY-SA 4.0", "Wikipedia": "CC BY-SA 4.0",
                     "NASA": "contenido de NASA, sin copyright salvo indicación (https://www.nasa.gov/nasa-brand-center/images-and-media/)"},
        "assumptions": [
            "La distancia es la publicada por la fuente indicada en cada objeto (dist_src, dist_ref).",
            "Tarántula (C103): se le da la distancia de la Gran Nube de Magallanes (Pietrzyński et al. 2019), de la que forma parte.",
            "NGC 2244 (C50): se le da la distancia de la Nebulosa Roseta (C49), a la que ilumina. Marcada incierta.",
            f"dist_unc = true si es una suposición o si otra fuente (tabla de Wikipedia o NASA) difiere más de un {round((UNC_RATIO - 1) * 100)} %.",
            "Sin distancia: IC 405 (C31) y NGC 6885 (C37), sin una fuente verificable.",
            "Magnitud: cúmulos globulares, Baumgardt et al. 2020; resto, OpenNGC (V; si no, B). Si V − B > 1 (errata evidente: NGC 253, NGC 246), la de NASA. NGC 6885 (C37) va sin magnitud (identificación incierta en OpenNGC).",
            "Las galaxias que ya están en la capa «Galaxias» (in = galaxies) no se dibujan aquí.",
        ],
        "fields": "c número Caldwell (null en las Nubes) · cat designación · ids OpenNGC · type · size eje mayor en ′ · "
                  "mag y mag_src · dist_ly y dist_src/dist_ref/dist_kind (paper|nasa|wiki|assumed) · dist_unc · "
                  "dist_alt_ly/dist_alt_src (la otra fuente: nasa | wikipedia) · in/in_name (ya está en otra capa) · origin (no es Caldwell)",
    }
    write_json("caldwell.json", meta, objects)
    # el panel de capas cuenta lo que se dibuja
    path = os.path.join(PUBLIC, "caldwell.json")
    data = json.load(open(path, encoding="utf-8"))
    data["count"] = len(drawn)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    kinds = {}
    for o in with_d:
        kinds[o["dist_kind"]] = kinds.get(o["dist_kind"], 0) + 1
    print(f"  ({len(objects)} objetos: {len(drawn)} se dibujan, {len(objects) - len(drawn)} ya están en «Galaxias»; "
          f"{len(with_d)} con distancia {kinds}; {sum(1 for o in with_d if o['dist_unc'])} inciertas; "
          f"sin distancia: {[o['name'] for o in drawn if not o.get('dist_ly')]})")
    if verify:
        verify_online()


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "teseo-build/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "ignore")


def verify_online():
    """Compara las tablas transcritas con NASA y con la tabla de Baumgardt, en línea."""
    import html as _h
    bad = 0
    print("Verificando contra NASA (fichas Caldwell)…")
    for n, ly in sorted(NASA.items()):
        slug = "60-61" if n in (60, 61) else str(n)
        try:
            t = re.sub(r"\s+", " ", _h.unescape(re.sub(r"<[^>]+>", " ", _get(NASA_PAGE.format(slug)))))
        except Exception as e:              # noqa: BLE001
            print(f"  ! C{n}: {e}"); bad += 1; continue
        m = re.search(r"Distance ([\d,\.]+)( million)? light", t)
        got = float(m.group(1).replace(",", "")) * (1e6 if m.group(2) else 1) if m else None
        if got is None or abs(got - ly) > 1e-6 * ly:
            print(f"  ! C{n}: NASA dice {got}, el script {ly}"); bad += 1
    print("Verificando contra la tabla de Baumgardt…")
    page = _get(BAUMGARDT)
    rd = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, flags=re.S):
        cells = [re.sub(r"\s+", " ", _h.unescape(re.sub(r"<[^>]+>", "", c))).strip()
                 for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.S)]
        if len(cells) > 3:
            m = re.match(r"(NGC \d+)", cells[0])
            if m:
                rd.setdefault(m.group(1), (cells[3].split("±")[0].strip(), cells[8].split("±")[0].strip()))   # R☉ [kpc], V
    for n, (v, unit, ref, _) in OVERRIDES.items():
        if ref != "BV21":
            continue
        ngc = next(c for c in CATALOG if c[0] == n)[2]
        got = rd.get(ngc)
        if got is None or abs(float(got[0]) - v) > 0.005 or abs(float(got[1]) - BV_VMAG[n]) > 0.005:
            print(f"  ! C{n} {ngc}: tabla {got}, script {v} / V {BV_VMAG[n]}"); bad += 1
    print("Verificación:", "sin diferencias" if not bad else f"{bad} diferencias")


if __name__ == "__main__":
    build(verify="--verificar" in sys.argv)
