"""
Orquestador del pipeline de datos de objetos de Teseo.

Regenera todos los catálogos de public/ desde sus fuentes:
  - pulsars.json     <- ATNF Pulsar Catalogue
  - deepsky.json     <- Messier (curado) enriquecido con OpenNGC
  - galaxies.json    <- galaxias brillantes con distancia por redshift (OpenNGC)
  - blackholes.json  <- tabla curada (en build_blackholes.py)

Uso:
    python3 scripts/build_data.py            # todo
    python3 scripts/build_pulsars.py         # solo una capa

Las fuentes crudas se cachean en scripts/raw/ (ignorada por git). Si faltan,
descarga NGC.csv automáticamente; el tarball de ATNF a veces corta la
conexión, así que se puede descargar a mano (ver scripts/README.md).
"""
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_astro import RAW  # noqa: E402

DOWNLOADS = {
    "NGC.csv": ("https://raw.githubusercontent.com/mattiaverga/OpenNGC/"
                "master/database_files/NGC.csv"),
    "psrcat.tar.gz": ("https://www.atnf.csiro.au/research/pulsar/psrcat/"
                      "downloads/psrcat_pkg.tar.gz"),
}


def fetch_missing():
    os.makedirs(RAW, exist_ok=True)
    for fname, url in DOWNLOADS.items():
        dest = os.path.join(RAW, fname)
        if os.path.exists(dest):
            continue
        # psrcat.db extraído basta; no re-descargar el tarball si ya está
        if fname == "psrcat.tar.gz" and os.path.exists(os.path.join(RAW, "psrcat.db")):
            continue
        print(f"Descargando {fname} ...")
        try:
            urllib.request.urlretrieve(url, dest)
        except Exception as e:
            print(f"  ! no se pudo descargar {fname}: {e}")
            print(f"    Descárgalo a mano y ponlo en {RAW}")


def main():
    fetch_missing()
    import build_pulsars
    import build_deepsky
    import build_blackholes
    print("Púlsares (ATNF):")
    build_pulsars.build()
    print("Cielo profundo (OpenNGC):")
    build_deepsky.build()
    print("Agujeros negros (curado):")
    build_blackholes.build()
    print("Listo. Catálogos regenerados en public/.")


if __name__ == "__main__":
    main()
