"""
Genera public/blackholes.json desde una tabla curada y auditable.

No hay un catálogo único y limpio de agujeros negros con distancia+masa,
así que esta capa es una SELECCIÓN curada de objetos confirmados o buenos
candidatos, con valores publicados (aproximados). Antes vivía como JSON
hecho a mano; aquí queda en código, con coordenadas J2000 explícitas para
que los vectores se recalculen de forma reproducible.

Coordenadas (RA grados, Dec grados J2000). Masas en masas solares.
Fuentes: literatura publicada (EHT, Gaia DR3, catálogos de binarias de
rayos X, medidas dinámicas de núcleos galácticos). Valores aproximados.
"""
from lib_astro import radec_to_vec, write_json

# (ra_deg, dec_deg, dist_ly, mass_sun, kind, note, name)
CURATED = [
    (266.4166, -29.0079,        26000,     4.3e6, "supermasivo", "centro de la Vía Láctea", "Sgr A*"),
    (187.7044, +12.3909,     53500000,     6.5e9, "supermasivo", "1ra imagen (EHT 2019)", "M87*"),
    (299.5916, +35.2019,         7200,        21, "estelar", "1er candidato confirmado", "Cygnus X-1"),
    (306.0166, +33.8672,         7800,         9, "estelar", "binaria de rayos X", "V404 Cygni"),
    (253.4998, -39.8455,        11000,       6.3, "estelar", "microquasar", "GRO J1655-40"),
    (288.7998, +10.9458,        36000,        12, "estelar", "chorros superlumínicos", "GRS 1915+105"),
    ( 95.6834,  -0.3461,         3500,       6.6, "estelar", "uno de los más cercanos", "A0620-00"),
    ( 84.9128, -69.7432,       165000,      10.9, "estelar", "en la Gran Nube de Magallanes", "LMC X-1"),
    (262.1710,  -0.5810,         1560,       9.6, "estelar", "el más cercano conocido (Gaia BH1)", "Gaia BH1"),
    (294.8294, +14.9319,         1926,        33, "estelar", "el estelar más masivo de la galaxia", "Gaia BH3"),
    (169.5455, +48.0373,         6000,         7, "estelar", "fuera del plano galáctico", "XTE J1118+480"),
    (274.8417, -25.4073,        20000,       6.4, "estelar", "microquasar variable", "V4641 Sgr"),
    ( 10.6837, +41.2694,      2540000,     1.4e8, "supermasivo", "en la galaxia de Andrómeda", "M31* (Andrómeda)"),
    (187.0999, +31.7174,  10400000000,     6.6e10, "supermasivo", "uno de los más masivos (cuásar)", "TON 618"),
    (308.1085, +40.9576,        24000,       2.4, "estelar", "binaria de rayos X masiva", "Cygnus X-3"),
    (236.7878, -47.6701,        30000,       9.4, "estelar", "nova de rayos X", "4U 1543-47"),
    # --- añadidos (coordenadas J2000 de literatura) ---
    (187.2779,  +2.0524,   2400000000,     8.9e8, "supermasivo", "primer cuásar identificado (1963)", "3C 273"),
    (195.0338, +27.9769,    308000000,     2.1e10, "supermasivo", "uno de los más masivos medidos", "NGC 4889"),
]


def build():
    objects = []
    for ra, dec, dist_ly, mass, kind, note, name in CURATED:
        nx, ny, nz = radec_to_vec(ra, dec)
        objects.append({
            "name": name,
            "nx": nx, "ny": ny, "nz": nz,
            "dist_ly": dist_ly,
            "mass_sun": float(mass),
            "kind": kind,
            "note": note,
        })
    meta = {
        "source": ("Selección curada de agujeros negros confirmados/candidatos. "
                   "Valores publicados (aprox.): EHT, Gaia DR3, binarias de rayos X, "
                   "dinámica de núcleos galácticos."),
        "count": len(objects),
    }
    write_json("blackholes.json", meta, objects)
    return objects


if __name__ == "__main__":
    build()
