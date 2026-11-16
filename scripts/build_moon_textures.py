"""
Texturas de las lunas para el globo 3D de la ficha (public/textures/moon-<clave>.jpg, 1024 × 512).

Fuente: mosaicos globales del USGS Astrogeology Science Center hechos con imágenes de misiones de la
NASA (dominio público), servidos en su almacén público asc-pds-services (los mismos que usan sus
mapas web). Todos están en proyección cilíndrica simple con el este a la derecha (los mapas web por
construcción; el de Jápeto es un cubo ISIS, que también dibuja el este a la derecha aunque rotule las
longitudes hacia el oeste), así que se reducen tal cual, sin espejar.

Las cinco grandes lunas de Urano no tienen mosaico global: la Voyager 2 solo vio su hemisferio sur
(1986). Para ellas la ficha usa la foto y no un globo inventado.

Retoques (los únicos): las zonas sin datos —negro puro, lo que ninguna nave fotografió, como el norte de Tritón—
se rellenan con un gris neutro liso (algo más oscuro que la mediana de la luna), y los mosaicos en gris se estiran en contraste.

Uso:  python3 scripts/build_moon_textures.py   (descarga ~1 GB a /tmp; deja ~1,5 MB en public/textures)
"""
import os
import sys
import urllib.request

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "textures"))
CACHE = "/tmp/moontex"
BASE = "https://asc-pds-services.s3.us-west-2.amazonaws.com/"

# clave → (archivo en el almacén del USGS, misión de las imágenes)
SOURCES = {
    "Phobos": ("wms_basemaps/Phobos/phobos-cylindrical_dd360.tif", "Viking"),
    "Deimos": ("wms_basemaps/Deimos/deimoscyl4.jpg", "Viking"),
    "Io": ("wms_basemaps/Jupiter/Io/color/io00n180.png", "Galileo y Voyager"),
    "Europa": ("wms_basemaps/Jupiter/Europa/europa00n180.png", "Galileo y Voyager"),
    "Ganymede": ("mosaic/Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif", "Galileo y Voyager"),
    "Callisto": ("wms_basemaps/Jupiter/Callisto/callisto00n180.png", "Galileo y Voyager"),
    "Mimas": ("wms_basemaps/Saturn/Mimas/Cassini/Mimas_PDS_8ppd_dd360.tif", "Cassini"),
    "Enceladus": ("wms_basemaps/Saturn/Enceladus/Cassini/Enceladus_40ppd.tif", "Cassini"),
    "Tethys": ("wms_basemaps/Saturn/Tethys/Cassini/Tethys_32ppd.tif", "Cassini"),
    "Dione": ("wms_basemaps/Saturn/Dione/Cassini/Dione_64ppd.tif", "Cassini"),
    "Rhea": ("wms_basemaps/Saturn/Rhea/Cassini/Rhea_32ppd.tif", "Cassini"),
    "Titan": ("wms_basemaps/Saturn/Titan/Cassini/Titan_ISS_P19658_Mosaic_Global_4km_clon0.tif", "Cassini (infrarrojo cercano)"),
    "Iapetus": ("mosaic/Iapetus_Cassini_Voyager_mosaic_global_783m.tif", "Cassini y Voyager"),
    "Triton": ("wms_basemaps/Neptune/Triton/Voyager2/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif", "Voyager 2"),
}


def fetch(path):
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, os.path.basename(path))
    if not os.path.exists(dst):
        print("  descargando", path, file=sys.stderr)
        urllib.request.urlretrieve(BASE + path, dst)
    return dst


def to_rgb8(im):
    """Cualquier modo (8/16 bits, flotante, con alfa o paleta) → RGB de 8 bits, estirando por percentiles."""
    if im.mode in ("RGB", "L"):
        return im.convert("RGB")
    if im.mode in ("RGBA", "LA", "P", "PA"):
        return im.convert("RGB")
    # 16 bits o flotante: estirar entre los percentiles 0,5 y 99,5 (ignorando el relleno a cero)
    g = im.convert("F")
    small = g.resize((1024, 512), Image.BILINEAR)
    vals = sorted(v for v in small.getdata() if v > 0)
    lo, hi = vals[int(len(vals) * 0.005)], vals[int(len(vals) * 0.995)]
    g = g.point(lambda v: max(0, min(255, (v - lo) * 255.0 / (hi - lo if hi > lo else 1))))
    return g.convert("L").convert("RGB")


def finish(img, gray):
    """Zonas sin datos (negro puro: lo que ninguna nave fotografió) → un gris neutro liso; y en
    los mosaicos en gris, contraste estirado entre los percentiles 0,5 y 99,5 de la parte con datos."""
    px = img.load()
    W, H = img.size
    valid = [(x, y) for y in range(H) for x in range(W) if max(px[x, y]) > 4]
    if not valid:
        return img
    lum = sorted(sum(px[x, y]) / 3 for x, y in valid)
    lo, hi = (lum[int(len(lum) * 0.005)], lum[int(len(lum) * 0.995)]) if gray else (0, 255)
    span = max(1.0, hi - lo)
    stretch = (lambda v: max(0, min(255, int((v - lo) * 255 / span)))) if gray else (lambda v: v)
    g = int(round(stretch(lum[len(lum) // 2] * 0.8)))                     # gris neutro algo más oscuro que la mediana: se nota que no es terreno
    fill = (g, g, g)
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            px[x, y] = tuple(stretch(v) for v in c) if max(c) > 4 else fill
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for key, (path, mission) in SOURCES.items():
        print(key, file=sys.stderr)
        im = Image.open(fetch(path))
        print("  ", im.size, im.mode, file=sys.stderr)
        if im.mode not in ("RGB", "L", "RGBA", "LA", "P", "PA"):
            im.draft(None, None)
        # reducir primero en el modo original (más barato) y luego convertir
        im = im.resize((1024, 512), Image.LANCZOS) if im.mode in ("RGB", "L", "RGBA", "LA") else im
        out = finish(to_rgb8(im).resize((1024, 512), Image.LANCZOS), gray=im.mode in ("L", "LA", "I", "I;16", "F"))
        dst = os.path.join(OUT, f"moon-{key.lower()}.jpg")
        out.save(dst, "JPEG", quality=84, optimize=True, progressive=True)
        print("  →", dst, os.path.getsize(dst) // 1024, "KB", file=sys.stderr)


if __name__ == "__main__":
    main()
