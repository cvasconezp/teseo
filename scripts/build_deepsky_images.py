#!/usr/bin/env python3
"""Recortes de objetos de cielo profundo para dibujarlos en el cielo (public/textures/deepsky/).

Fuente: 2MASS (Two Micron All Sky Survey), mosaico en color del atlas (J azul, H verde, Ks rojo) en formato HiPS,
servido por ESASky (https://skies.esac.esa.int/2MASSColor/). Dominio público; se agradece así: «Atlas Image mosaic
courtesy of 2MASS/UMass/IPAC-Caltech/NASA/NSF». Es infrarrojo cercano: las galaxias y los cúmulos se ven como en
visible, pero las nebulosas de emisión salen más débiles y con otros colores.

Cada recorte es una proyección gnomónica (TAN) centrada en el objeto, con el norte arriba y el este a la izquierda
(como se ve el cielo): así se coloca en el cielo sin girarlo. El fondo se lleva a negro (solo suma luz).

Uso:  python3 scripts/build_deepsky_images.py [--only m31,m42]
Requiere: numpy, pillow, astropy-healpix. Deja las teselas descargadas en /tmp/hips/tiles.
"""
import io, json, math, os, sys, urllib.request
import numpy as np
from PIL import Image
from astropy_healpix import HEALPix
import astropy.units as u

# cartografiados (HiPS en ESASky): SDSS en luz visible donde lo cubre (norte); si no, 2MASS en infrarrojo cercano
SURVEYS = {
    "sdss": {"base": "https://skies.esac.esa.int/SDSS9Color", "max": 10, "credit": "Sloan Digital Sky Survey (SDSS), CC BY"},
    "2mass": {"base": "https://skies.esac.esa.int/2MASSColor", "max": 9, "credit": "2MASS/UMass/IPAC-Caltech/NASA/NSF, dominio público"},
}
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "public", "textures", "deepsky")
CACHE = "/tmp/hips/tiles"
N = 512

# id, nombre, AR (°), Dec (°), lado del recorte (°), catálogo y número (para enlazarlo con las capas)
OBJECTS = [
    ("m31", "M31 · Galaxia de Andrómeda", 10.6847, 41.2690, 3.4), ("m33", "M33 · Galaxia del Triángulo", 23.4621, 30.6599, 1.3),
    ("m42", "M42 · Nebulosa de Orión", 83.8221, -5.3911, 1.4), 
    ("m13", "M13 · Cúmulo de Hércules", 250.4235, 36.4613, 0.45), ("m51", "M51 · Galaxia del Remolino", 202.4696, 47.1952, 0.3),
    ("m81", "M81 · Galaxia de Bode", 148.8882, 69.0653, 0.6), ("m82", "M82 · Galaxia del Cigarro", 148.9685, 69.6797, 0.3),
    ("m104", "M104 · Galaxia del Sombrero", 189.9976, -11.6231, 0.22), ("m101", "M101 · Galaxia del Molinete", 210.8024, 54.3488, 0.6),
    ("m22", "M22", 279.0998, -23.9047, 0.5),
    
    ("m87", "M87 · Virgo A", 187.7059, 12.3911, 0.25), ("m57", "M57 · Nebulosa del Anillo", 283.3963, 33.0292, 0.08),
    ("m1", "M1 · Nebulosa del Cangrejo", 83.6331, 22.0145, 0.16), ("m83", "M83 · Molinete del Sur", 204.2538, -29.8658, 0.35),
    ("m3", "M3", 205.5484, 28.3773, 0.4), ("m5", "M5", 229.6384, 2.0810, 0.45),
    
    
    ("ngc253", "NGC 253 · Galaxia del Escultor", 11.8880, -25.2882, 0.6),
    ("carina", "Nebulosa de Carina", 161.2650, -59.6845, 2.2), ("jewelbox", "NGC 4755 · El Joyero", 193.4125, -60.3633, 0.3),
    ("ngc5139x", None, 0, 0, 0),
]
OBJECTS = [o for o in OBJECTS if o[1]]


def tile(order, ipix, sv="2mass"):
    BASE = SURVEYS[sv]["base"]
    f = os.path.join(CACHE, f"{sv}_{order}_{ipix}.jpg")
    if os.path.exists(f + ".no"): return None
    if not os.path.exists(f) or os.path.getsize(f) < 200:
        url = f"{BASE}/Norder{order}/Dir{(ipix // 10000) * 10000}/Npix{ipix}.jpg"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "teseo-build"})
            open(f, "wb").write(urllib.request.urlopen(req, timeout=60).read())
        except Exception as e:
            open(f + ".no", "w").write("x"); return None
    try:
        return np.asarray(Image.open(f).convert("RGB"), dtype=np.float32)
    except Exception:
        return None


def deinterleave(v):
    """Bits pares → x, impares → y (índice anidado de HEALPix dentro de la tesela)."""
    x = np.zeros_like(v); y = np.zeros_like(v)
    for b in range(9):
        x |= ((v >> (2 * b)) & 1) << b
        y |= ((v >> (2 * b + 1)) & 1) << b
    return x, y


def cutout(ra0, dec0, size, variant=0, sv="2mass"):
    """Imagen N×N (float RGB 0–255): gnomónica, norte arriba, este a la izquierda."""
    half = math.tan(math.radians(size / 2))
    xs = (np.arange(N) + 0.5) / N * 2 - 1
    X, Y = np.meshgrid(-xs * half, -xs * half)        # X: hacia el este positivo a la izquierda; Y: norte arriba
    a0, d0 = math.radians(ra0), math.radians(dec0)
    rho = np.hypot(X, Y); c = np.arctan(rho)
    dec = np.arcsin(np.cos(c) * math.sin(d0) + np.where(rho > 0, Y * np.sin(c) * math.cos(d0) / np.maximum(rho, 1e-12), 0))
    ra = a0 + np.arctan2(X * np.sin(c), rho * math.cos(d0) * np.cos(c) - Y * math.sin(d0) * np.sin(c))
    # orden: que el píxel de la tesela sea parecido al del recorte, como mucho el 9
    pix = math.degrees(2 * half) / N
    order = int(min(SURVEYS[sv]["max"], max(3, math.ceil(math.log2(58.6 / pix / 512)))))
    hp = HEALPix(nside=2 ** (order + 9), order="nested")
    idx = hp.lonlat_to_healpix(ra * u.rad, dec * u.rad).astype(np.int64)
    t, sub = idx >> 18, idx & ((1 << 18) - 1)
    x, y = deinterleave(sub)
    out = np.zeros((N, N, 3), dtype=np.float32)
    for tp in np.unique(t):
        im = tile(order, int(tp), sv)
        if im is None: continue
        m = t == tp
        # ocho disposiciones posibles (transponer y voltear); la correcta se elige en check()
        r_, c_ = (x[m], y[m]) if variant < 4 else (y[m], x[m])
        if variant & 1: r_ = 511 - r_
        if variant & 2: c_ = 511 - c_
        out[m] = im[r_, c_]
    return out


def rough(a):
    g = a.mean(axis=2); return float(np.abs(np.diff(g, axis=0)).mean() + np.abs(np.diff(g, axis=1)).mean())


def check():
    """La disposición de los píxeles dentro de la tesela se elige con M13: con la buena, el cúmulo queda entero y en
    el centro (la mayor parte de la luz, dentro del 20 % central)."""
    xs = (np.arange(N) + 0.5) / N * 2 - 1; R = np.hypot(*np.meshgrid(xs, xs))
    sc = []
    for v in range(8):
        g = cutout(250.4235, 36.4613, 0.45, v).mean(axis=2); g = np.clip(g - np.percentile(g, 50), 0, None)
        sc.append(float(g[R < 0.2].sum() / max(1.0, g.sum())))
    print("luz en el centro por variante:", [round(x, 2) for x in sc]); return int(np.argmax(sc))


def finish(a, sv="2mass"):
    """Fondo a negro y curva de tono (asinh), como la Vía Láctea."""
    bg = np.percentile(a.reshape(-1, 3), 35, axis=0)
    x = np.clip(a - bg - 6, 0, None) / 255.0
    y = np.arcsinh(x * 6) / np.arcsinh(6)
    # menos saturación: en infrarrojo los colores no son los del ojo; queda un resplandor casi blanco, algo cálido
    g = y.mean(axis=2, keepdims=True); y = g + (y - g) * (0.4 if sv == "2mass" else 1.0)
    # viñeta suave: el recorte se funde con el cielo en el borde
    xs = (np.arange(N) + 0.5) / N * 2 - 1; R = np.hypot(*np.meshgrid(xs, xs)); w = np.clip((1.0 - R) / 0.18, 0, 1); w = w * w * (3 - 2 * w)
    return (np.clip(y * w[..., None], 0, 1) * 255).astype("uint8")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
    only = None
    if "--only" in sys.argv: only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    v = check()
    man = []
    for oid, name, ra, dec, size in OBJECTS:
        if only and oid not in only: continue
        # SDSS si cubre casi todo el recorte (dentro del círculo que se usa); si no, 2MASS
        a = cutout(ra, dec, size, v, "sdss")
        xs = (np.arange(N) + 0.5) / N * 2 - 1; inside = np.hypot(*np.meshgrid(xs, xs)) < 0.95
        cover = float((a.sum(axis=2)[inside] > 0).mean()); sv = "sdss"
        if cover < 0.9 or oid in ("m33", "m42"): a = cutout(ra, dec, size, v, "2mass"); sv = "2mass"   # (M33: en SDSS sale con franjas; M42: sale verde)
        if oid == "m31":
            # el mosaico de SDSS de M31 trae franjas de color (calibración por banda): se usa el mínimo de los tres
            # canales (lo que hay en los tres es galaxia) como luminancia, con un tono cálido
            lum = a.min(axis=2, keepdims=True); a = lum * np.array([1.0, 0.95, 0.84], dtype=np.float32)
        Image.fromarray(finish(a, sv)).save(os.path.join(OUT, oid + ".webp"), quality=82, method=6)
        man.append({"id": oid, "name": name, "ra": ra, "dec": dec, "size": size, "survey": sv})
        print(oid, sv, round(cover, 2), os.path.getsize(os.path.join(OUT, oid + ".webp")) // 1024, "KB")
    json.dump({"meta": {"source": "SDSS DR9 (Sloan Digital Sky Survey, CC BY) y 2MASS (UMass/IPAC-Caltech/NASA/NSF, dominio público), mosaicos en color servidos por ESASky", "credits": {k: x["credit"] for k, x in SURVEYS.items()}, "projection": "gnomónica, norte arriba, este a la izquierda", "variant": v}, "objects": man},
              open(os.path.join(ROOT, "public", "deepsky-images.json"), "w"), ensure_ascii=False, indent=1)
