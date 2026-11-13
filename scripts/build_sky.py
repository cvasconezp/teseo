"""
Regenera public/sky.json (estrellas + constelaciones) desde HYG Database v4.1.

    python3 scripts/build_sky.py [ruta/a/hygdata_v41.csv] [--check]

Si no se da la ruta, busca scripts/raw/hygdata_v41.csv y, si falta, lo descarga
del repositorio oficial (https://github.com/astronexus/HYG-Database, carpeta
hyg/CURRENT; ~34 MB, CC BY-SA 4.0). El CSV NO se guarda en el repositorio
(scripts/raw/ está ignorada por git).

Qué reproduce (comprobado contra el sky.json que ya estaba publicado):
  - Selección: estrellas de HYG con número Hipparcos y magnitud visual <= 6,0,
    MÁS las que usa alguna línea de constelación aunque sean más débiles
    (3 casos: Mira y dos más). Orden: el del catálogo (columna `id`).
  - Dirección: vector unitario (x, y, z)/|(x, y, z)| con las columnas x, y, z de
    HYG (ecuatoriales J2000), redondeado a 5 decimales.
  - Distancia: `dist` (pársecs) x 3,2615638, a 1 decimal. Ojo: HYG pone
    dist = 100000 pc cuando Hipparcos no tiene paralaje fiable; se conserva tal
    cual (326156,4 a. l.) para no cambiar el dato publicado.
  - Nombre: columna `proper` (nombres propios de la UAI).
Qué añade (esquema v2, campos al FINAL para no romper a quien lea los 8 primeros):
  - [8] B-V (`ci` de HYG) como número, o null si el catálogo no lo trae;
  - [9] tipo espectral (`spect`) como texto, o "" si no lo trae.
Qué cambia: el campo [5] (color). Antes era un color derivado del B-V con otra
aproximación; ahora es el color de cuerpo negro a la temperatura de Ballesteros
(2012) convertido a sRGB con la aproximación de Kim et al. — las MISMAS fórmulas
que src/sky/starColor.js (starHex(bv, vivid=true)); la prueba
scripts/test_sky_starcolor.mjs verifica que coinciden estrella a estrella. Las
estrellas sin B-V conservan el color neutro que ya tenían (#fff2e6).

Constelaciones: las líneas (Stellarium western/modern skyculture, CC BY-SA) NO
se regeneran aquí; se copian del public/sky.json existente. Si algún día se
rehacen, este script seguirá añadiendo las estrellas que usen.

--check  no escribe: compara lo que generaría con el sky.json actual y falla si
         cambia algo en HIP, x/y/z, magnitud, distancia, nombre o constelaciones.
"""
import csv
import json
import math
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_astro import PC_TO_LY, RAW, PUBLIC  # noqa: E402

HYG_URL = ("https://raw.githubusercontent.com/astronexus/HYG-Database/"
           "main/hyg/CURRENT/hygdata_v41.csv")
MAG_LIMIT = 6.0
NO_BV_HEX = "#fff2e6"
OUT = os.path.join(PUBLIC, "sky.json")


# ---- color: mismas fórmulas que src/sky/starColor.js --------------------
def bv_to_temp(bv):
    """Ballesteros (2012), EPL 97, 34008, ec. (14)."""
    c = 0.92 * bv
    if c + 0.62 <= 0:
        return None
    return 4600.0 * (1.0 / (c + 1.7) + 1.0 / (c + 0.62))


def temp_to_xy(T):
    """Lugar de Planck en CIE 1931 xy; Kim et al. (US 7024034), 1667-25000 K."""
    t = min(25000.0, max(1667.0, T))
    if t <= 4000:
        x = -0.2661239e9 / t**3 - 0.2343589e6 / t**2 + 0.8776956e3 / t + 0.179910
    else:
        x = -3.0258469e9 / t**3 + 2.1070379e6 / t**2 + 0.2226347e3 / t + 0.240390
    if t <= 2222:
        y = -1.1063814 * x**3 - 1.34811020 * x**2 + 2.18555832 * x - 0.20219683
    elif t <= 4000:
        y = -0.9549476 * x**3 - 1.37418593 * x**2 + 2.09137015 * x - 0.16748867
    else:
        y = 3.0817580 * x**3 - 5.87338670 * x**2 + 3.75112997 * x - 0.37001483
    return x, y


def _enc(v):
    return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055


def temp_to_hex(T):
    x, y = temp_to_xy(T)
    X, Z = x / y, (1 - x - y) / y
    rgb = [3.2406 * X - 1.5372 - 0.4986 * Z,
           -0.9689 * X + 1.8758 + 0.0415 * Z,
           0.0557 * X - 0.2040 + 1.0570 * Z]
    rgb = [max(0.0, v) for v in rgb]
    m = max(rgb) or 1.0
    # math.floor(x + 0.5) = Math.round de JavaScript (round() de Python redondea al par)
    return "#" + "".join("%02x" % int(math.floor(255 * min(1.0, max(0.0, _enc(v / m))) + 0.5)) for v in rgb)


def star_hex(ci):
    if ci is None:
        return NO_BV_HEX
    T = bv_to_temp(ci)
    return NO_BV_HEX if T is None else temp_to_hex(T)


# ---- catálogo -------------------------------------------------------------
def find_csv(argv):
    for a in argv:
        if not a.startswith("--"):
            return a
    dest = os.path.join(RAW, "hygdata_v41.csv")
    if not os.path.exists(dest):
        os.makedirs(RAW, exist_ok=True)
        print("Descargando HYG v4.1 (~34 MB) ...")
        urllib.request.urlretrieve(HYG_URL, dest)
    return dest


def num(v, nd):
    """Redondea y quita el '.0' sobrante de los enteros solo donde el original lo hacía (no lo hacía)."""
    return round(v, nd)


def build(csv_path, check=False):
    with open(OUT, encoding="utf-8") as f:
        old = json.load(f)
    cons = old["constellations"]
    line_hips = {h for c in cons for pl in c["lines"] for h in pl}

    stars, seen = [], set()
    with open(csv_path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if not r["hip"]:
                continue
            hip = int(r["hip"])
            mag = float(r["mag"])
            if hip in seen or not (mag <= MAG_LIMIT or hip in line_hips):
                continue
            seen.add(hip)
            x, y, z = float(r["x"]), float(r["y"]), float(r["z"])
            n = math.sqrt(x * x + y * y + z * z)
            ci = float(r["ci"]) if r["ci"].strip() != "" else None
            stars.append([
                hip, num(x / n, 5), num(y / n, 5), num(z / n, 5), mag, star_hex(ci),
                num(float(r["dist"]) * PC_TO_LY, 1), r["proper"].strip(),
                ci, " ".join(r["spect"].split()),
            ])

    missing = line_hips - seen
    if missing:
        raise SystemExit(f"Faltan en HYG estrellas usadas por las líneas: {sorted(missing)[:10]}")

    # ---- diff contra lo publicado: nada de lo que el frontend ya usa puede cambiar
    keep = (0, 1, 2, 3, 4, 6, 7)
    a = [[s[i] for i in keep] for s in old["stars"]]
    b = [[s[i] for i in keep] for s in stars]
    diffs = sum(1 for p, q in zip(a, b) if p != q) + abs(len(a) - len(b))
    print(f"Estrellas: {len(stars)} (antes {len(old['stars'])}); "
          f"diferencias en HIP/x/y/z/mag/dist/nombre: {diffs}")
    if diffs and check:
        for p, q in zip(a, b):
            if p != q:
                print("   ", p, "->", q)
                break
        raise SystemExit(1)

    meta = dict(old.get("meta", {}))
    meta["stars_source"] = "HYG Database v4.1 (Hipparcos/Yale/Gliese) — astronexus, CC BY-SA 4.0"
    meta["schema"] = 2
    meta["star_fields"] = ["hip", "x", "y", "z", "mag", "color", "dist_ly", "name", "bv", "spect"]
    meta["star_fields_note"] = (
        "x,y,z: vector unitario ecuatorial J2000. mag: magnitud visual. dist_ly: años luz "
        "(326156.4 = sin paralaje fiable en Hipparcos). bv: índice de color B−V de HYG ('ci'), "
        "null si falta. spect: tipo espectral de HYG ('spect'), '' si falta. color: cuerpo negro "
        "a la temperatura que da B−V (Ballesteros 2012, EPL 97, 34008, ec. 14) pasado a sRGB "
        "(lugar de Planck de Kim et al., 1667–25000 K; matriz sRGB IEC 61966-2-1); "
        "sin B−V: #fff2e6. Los campos bv y spect se añadieron al final (esquema 2).")
    meta["generator"] = "scripts/build_sky.py"
    doc = {"meta": meta, "constellations": cons, "stars": stars}
    if check:
        same = json.dumps(doc, ensure_ascii=False, separators=(",", ":")) == \
            json.dumps(old, ensure_ascii=False, separators=(",", ":"))
        print("Idéntico al publicado." if same else "Difiere del publicado solo en color/bv/spect/meta.")
        return doc
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    nb = sum(1 for s in stars if s[8] is None)
    print(f"-> {OUT}: {os.path.getsize(OUT)} bytes; {nb} estrellas sin B−V; "
          f"{sum(1 for s in stars if s[9])} con tipo espectral")
    return doc


if __name__ == "__main__":
    args = sys.argv[1:]
    build(find_csv(args), check="--check" in args)
