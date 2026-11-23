"""
Añade a public/sky.json el error de la paralaje de cada estrella (campo [10], en milisegundos de arco), para las
barras de error de la vista «Constelaciones en profundidad real».

    python3 scripts/build_sky_plx.py [ruta/a/heasarc_hipnewcat.tdat.gz]

Fuente: «Hipparcos, the New Reduction» (van Leeuwen 2007, A&A 474, 653; CDS I/311, hip2.dat), en la copia que
publica HEASARC (NASA) como tabla HIPNEWCAT:
https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_hipnewcat.tdat.gz (~11 MB). Si no se da la ruta,
se busca en scripts/raw/ y, si falta, se descarga ahí (scripts/raw/ no va al repositorio).

Las distancias de sky.json (HYG v4.1) salen de la paralaje de esa misma reducción (d = 1000/plx pc): el error se
usa con ella. Con la paralaje p y su error σ, el intervalo de distancia a 1σ es [1/(p+σ), 1/(p−σ)] (sin cota de
lejanía si p ≤ σ). Las estrellas sin dato quedan con null.
"""
import gzip
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_astro import RAW, PUBLIC  # noqa: E402

URL = "https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_hipnewcat.tdat.gz"
OUT = os.path.join(PUBLIC, "sky.json")


def find(argv):
    for a in argv:
        if not a.startswith("--"):
            return a
    dest = os.path.join(RAW, "heasarc_hipnewcat.tdat.gz")
    if not os.path.exists(dest):
        os.makedirs(RAW, exist_ok=True)
        print("Descargando HIPNEWCAT de HEASARC (~11 MB) ...")
        urllib.request.urlretrieve(URL, dest)
    return dest


def read_errors(path):
    """HIP → error de la paralaje (mas), de la tabla tdat (campos separados por «|»)."""
    cols, out, data = None, {}, False
    with gzip.open(path, "rt", encoding="latin-1") as f:
        for line in f:
            if line.startswith("line[1]"):
                cols = line.split("=", 1)[1].split()
                continue
            if line.startswith("<DATA>"):
                data = True
                continue
            if not data or line.startswith("<END>"):
                continue
            p = line.rstrip("\n").split("|")
            if not cols or len(p) < len(cols):
                continue
            try:
                hip = int(p[cols.index("hip_number")])
                e = p[cols.index("parallax_error")].strip()
                out[hip] = round(float(e), 2) if e else None
            except ValueError:
                continue
    return out


def main(argv):
    err = read_errors(find(argv))
    with open(OUT, encoding="utf-8") as f:
        doc = json.load(f)
    n = 0
    for s in doc["stars"]:
        while len(s) < 10:
            s.append(None)
        e = err.get(s[0])
        if len(s) == 10:
            s.append(e)
        else:
            s[10] = e
        n += e is not None
    meta = doc["meta"]
    meta["star_fields"] = ["hip", "x", "y", "z", "mag", "color", "dist_ly", "name", "bv", "spect", "e_plx_mas"]
    meta["e_plx_source"] = ("Hipparcos, the New Reduction (van Leeuwen 2007; CDS I/311) vía HEASARC HIPNEWCAT; "
                            "scripts/build_sky_plx.py")
    meta["schema"] = 3
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"-> {OUT}: {n} de {len(doc['stars'])} estrellas con error de paralaje; {os.path.getsize(OUT)} bytes")


if __name__ == "__main__":
    main(sys.argv[1:])
