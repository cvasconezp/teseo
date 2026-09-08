"""
Utilidades compartidas del pipeline de datos de Teseo.

Todo el dato de objetos del cielo se reduce a la misma representación:
un vector unitario ecuatorial J2000 (nx, ny, nz) que fija la DIRECCIÓN
en la esfera celeste, más una distancia real en años luz (dist_ly) que
fija la PROFUNDIDAD. El frontend usa esa profundidad real (en escala
logarítmica) para colocar cada objeto en 3D.

Convención verificada contra el dato ya existente (M1/Crab):
    x = cos(dec) * cos(ra)
    y = cos(dec) * sin(ra)
    z = sin(dec)
con ra, dec en grados J2000.
"""
import json
import math
import os

# Constantes (coherentes con public/sky.json -> meta.pc_to_ly)
PC_TO_LY = 3.2615638
C_KMS = 299792.458          # velocidad de la luz, km/s
H0 = 70.0                   # constante de Hubble, km/s/Mpc (para distancias por redshift)

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
PUBLIC = os.path.normpath(os.path.join(HERE, "..", "public"))


# ---------------------------------------------------------------- coordenadas
def radec_to_vec(ra_deg, dec_deg):
    """Grados J2000 -> vector unitario ecuatorial (nx, ny, nz), redondeado a 5."""
    ra = math.radians(ra_deg)
    dec = math.radians(dec_deg)
    cd = math.cos(dec)
    return (
        round(cd * math.cos(ra), 5),
        round(cd * math.sin(ra), 5),
        round(math.sin(dec), 5),
    )


def parse_hms(s):
    """'HH:MM:SS.s' -> grados. Acepta campos parciales (HH, HH:MM)."""
    s = (s or "").strip()
    if not s:
        return None
    parts = s.replace(" ", ":").split(":")
    try:
        h = float(parts[0])
        m = float(parts[1]) if len(parts) > 1 and parts[1] != "" else 0.0
        sec = float(parts[2]) if len(parts) > 2 and parts[2] != "" else 0.0
    except ValueError:
        return None
    return (h + m / 60.0 + sec / 3600.0) * 15.0  # horas -> grados


def parse_dms(s):
    """'+DD:MM:SS.s' -> grados. Acepta campos parciales."""
    s = (s or "").strip()
    if not s:
        return None
    sign = -1.0 if s.lstrip().startswith("-") else 1.0
    s = s.lstrip("+-")
    parts = s.replace(" ", ":").split(":")
    try:
        d = float(parts[0])
        m = float(parts[1]) if len(parts) > 1 and parts[1] != "" else 0.0
        sec = float(parts[2]) if len(parts) > 2 and parts[2] != "" else 0.0
    except ValueError:
        return None
    return sign * (d + m / 60.0 + sec / 3600.0)


# ------------------------------------------------------------------ distancias
def kpc_to_ly(kpc):
    return kpc * 1000.0 * PC_TO_LY


def mpc_to_ly(mpc):
    return mpc * 1.0e6 * PC_TO_LY


def parallax_mas_to_ly(pax_mas):
    """Paralaje en milisegundos de arco -> años luz. d[pc] = 1000 / pax[mas]."""
    if not pax_mas or pax_mas <= 0:
        return None
    return (1000.0 / pax_mas) * PC_TO_LY


def redshift_to_ly(z=None, radvel_kms=None):
    """Distancia por ley de Hubble (v = c z, d = v / H0). Devuelve años luz.

    Preferimos la velocidad radial medida (radvel_kms) si está; si no, cz.
    Es una distancia DERIVADA del corrimiento al rojo (H0=70): honesta para
    galaxias, pero aproximada. La marcamos como tal en la meta del catálogo.
    """
    v = radvel_kms
    if v is None and z is not None:
        v = C_KMS * z
    if v is None or v <= 0:
        return None
    d_mpc = v / H0
    return mpc_to_ly(d_mpc)


# --------------------------------------------------------------------- salida
def sig(x, n=4):
    """Redondeo a n cifras significativas (para distancias grandes legibles)."""
    if x is None or x == 0:
        return x
    from math import floor, log10
    return round(x, -int(floor(log10(abs(x)))) + (n - 1))


def write_json(name, meta, objects):
    """Escribe public/<name>.json con {meta, objects} de forma estable."""
    path = os.path.join(PUBLIC, name)
    payload = {"meta": meta, "objects": objects}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    kb = os.path.getsize(path) / 1024.0
    print(f"  -> {name}: {len(objects)} objetos, {kb:.1f} KB")
    return path
