"""
Genera public/meteorshowers.json — lluvias de meteoros anuales principales.

A diferencia del resto de capas, el "radiante" de una lluvia es una
DIRECCIÓN en el cielo (de dónde parecen venir los meteoros), no un objeto a
una distancia. Por eso estos objetos no llevan dist_ly: se dibujan sobre la
esfera celeste y el frontend marca cuáles están activas según la fecha.

Datos curados de fuentes establecidas (IMO / referencias estándar): radiante
J2000 aprox., fecha de máximo, ventana de actividad, ZHR y cuerpo progenitor.
"""
from lib_astro import radec_to_vec, write_json

# (nombre_es, nombre_en, wiki_es, ra_deg, dec_deg, pico "MM-DD",
#  inicio "MM-DD", fin "MM-DD", zhr, progenitor)
SHOWERS = [
    ("Cuadrántidas", "Quadrantids", "Cuadrántidas",
     230.0, 49.0, "01-03", "12-28", "01-12", 110, "(196256) 2003 EH1"),
    ("Líridas", "Lyrids", "Líridas",
     271.0, 34.0, "04-22", "04-16", "04-25", 18, "C/1861 G1 (Thatcher)"),
    ("Eta Acuáridas", "Eta Aquariids", "Eta acuáridas",
     338.0, -1.0, "05-06", "04-19", "05-28", 50, "1P/Halley"),
    ("Delta Acuáridas del Sur", "Southern Delta Aquariids", "Delta acuáridas",
     340.0, -16.0, "07-30", "07-12", "08-23", 25, "96P/Machholz"),
    ("Perseidas", "Perseids", "Perseidas",
     48.0, 58.0, "08-12", "07-17", "08-24", 100, "109P/Swift-Tuttle"),
    ("Épsilon Perseidas de septiembre", "September Epsilon Perseids", "Perseidas",
     48.0, 40.0, "09-09", "09-05", "09-21", 5, "desconocido"),
    ("Dracónidas", "Draconids", "Dracónidas",
     262.0, 54.0, "10-08", "10-06", "10-10", 10, "21P/Giacobini-Zinner"),
    ("Oriónidas", "Orionids", "Oriónidas",
     95.0, 16.0, "10-21", "10-02", "11-07", 20, "1P/Halley"),
    ("Táuridas del Sur", "Southern Taurids", "Táuridas",
     52.0, 13.0, "11-05", "09-10", "11-20", 5, "2P/Encke"),
    ("Leónidas", "Leonids", "Leónidas",
     152.0, 22.0, "11-17", "11-06", "11-30", 15, "55P/Tempel-Tuttle"),
    ("Gemínidas", "Geminids", "Gemínidas",
     112.0, 33.0, "12-14", "12-04", "12-17", 150, "(3200) Faetón"),
    ("Úrsidas", "Ursids", "Úrsidas",
     217.0, 76.0, "12-22", "12-17", "12-26", 10, "8P/Tuttle"),
]


def build():
    objects = []
    for es, en, wiki, ra, dec, peak, start, end, zhr, parent in SHOWERS:
        nx, ny, nz = radec_to_vec(ra, dec)
        objects.append({
            "name": es,
            "name_en": en,
            "wiki_es": wiki,
            "nx": nx, "ny": ny, "nz": nz,
            "peak": peak,       # MM-DD del máximo
            "start": start,     # MM-DD inicio de actividad
            "end": end,         # MM-DD fin de actividad (puede cruzar el año)
            "zhr": zhr,         # tasa horaria cenital en el máximo
            "parent": parent,   # cuerpo progenitor
        })
    meta = {
        "source": ("Lluvias de meteoros anuales principales (radiantes J2000 "
                   "aprox., IMO / referencias estándar)."),
        "note": ("El radiante es una dirección en el cielo, no un objeto a una "
                 "distancia; por eso no lleva años luz."),
        "count": len(objects),
    }
    write_json("meteorshowers.json", meta, objects)
    return objects


if __name__ == "__main__":
    build()
