"""
Genera capas de cielo profundo desde OpenNGC:

1. public/deepsky.json  -> Messier (110), enriquecido con constelación y
   nombre común. Se PRESERVAN las distancias curadas (SEDS/NASA) del dato
   original, porque muchos Messier son galácticos y no tienen redshift.

2. public/galaxies.json -> galaxias brillantes con distancia REAL derivada
   del corrimiento al rojo (velocidad radial / ley de Hubble). Es la capa
   que hace brillar el 'la luz que ves salió hace millones de años'.

Fuente: OpenNGC (Mattia Verga), CC-BY-SA-4.0.
https://github.com/mattiaverga/OpenNGC
Posiciones/tipos/magnitudes/redshift de OpenNGC; distancias de galaxias
derivadas de RadVel/Redshift con H0=70 (aproximadas, se marca en meta).
"""
import csv
import json
import os

from lib_astro import (RAW, PUBLIC, parse_hms, parse_dms, radec_to_vec,
                       redshift_to_ly, sig, write_json)

NGC_CSV = os.path.join(RAW, "NGC.csv")
SRC_URL = ("https://raw.githubusercontent.com/mattiaverga/OpenNGC/"
           "master/database_files/NGC.csv")

# Cortes de la capa de galaxias (equilibrio valor / rendimiento)
GAL_MAG_LIMIT = 13.0     # magnitud (V o B) máxima
# La distancia por redshift solo es fiable en el flujo de Hubble. Por debajo
# de ~15 Mly (v ~ 320 km/s) dominan las velocidades peculiares y cz/H0 da
# valores muy erróneos (p. ej. la Nube de Magallanes). Restringimos la capa
# a ese régimen: es justo donde el redshift ES la distancia estándar. Las
# galaxias más cercanas y famosas ya están (con distancia curada) en Messier.
GAL_MIN_LY = 1.5e7

# Nombres de constelación (abrev. IAU -> nombre en español), para las fichas.
CONST_ES = {
    "And": "Andrómeda", "Ant": "Antlia", "Aps": "Apus", "Aqr": "Acuario",
    "Aql": "Águila", "Ara": "Ara", "Ari": "Aries", "Aur": "Auriga",
    "Boo": "Boyero", "Cae": "Caelum", "Cam": "Camelopardalis", "Cnc": "Cáncer",
    "CVn": "Canes Venatici", "CMa": "Can Mayor", "CMi": "Can Menor",
    "Cap": "Capricornio", "Car": "Carina", "Cas": "Casiopea", "Cen": "Centauro",
    "Cep": "Cefeo", "Cet": "Cetus", "Cha": "Chamaeleon", "Cir": "Circinus",
    "Col": "Columba", "Com": "Coma Berenices", "CrA": "Corona Austral",
    "CrB": "Corona Boreal", "Crv": "Cuervo", "Crt": "Crátera", "Cru": "Cruz del Sur",
    "Cyg": "Cisne", "Del": "Delfín", "Dor": "Dorado", "Dra": "Dragón",
    "Equ": "Equuleus", "Eri": "Erídano", "For": "Fornax", "Gem": "Géminis",
    "Gru": "Grus", "Her": "Hércules", "Hor": "Horologium", "Hya": "Hidra",
    "Hyi": "Hydrus", "Ind": "Indus", "Lac": "Lacerta", "Leo": "Leo",
    "LMi": "Leo Menor", "Lep": "Liebre", "Lib": "Libra", "Lup": "Lobo",
    "Lyn": "Lince", "Lyr": "Lira", "Men": "Mensa", "Mic": "Microscopium",
    "Mon": "Monoceros", "Mus": "Mosca", "Nor": "Norma", "Oct": "Octans",
    "Oph": "Ofiuco", "Ori": "Orión", "Pav": "Pavo", "Peg": "Pegaso",
    "Per": "Perseo", "Phe": "Fénix", "Pic": "Pictor", "Psc": "Piscis",
    "PsA": "Pez Austral", "Pup": "Popa", "Pyx": "Pyxis", "Ret": "Reticulum",
    "Sge": "Sagitta", "Sgr": "Sagitario", "Sco": "Escorpio", "Scl": "Escultor",
    "Sct": "Escudo", "Ser": "Serpiente", "Sex": "Sextante", "Tau": "Tauro",
    "Tel": "Telescopium", "Tri": "Triángulo", "TrA": "Triángulo Austral",
    "Tuc": "Tucán", "UMa": "Osa Mayor", "UMi": "Osa Menor", "Vel": "Vela",
    "Vir": "Virgo", "Vol": "Volans", "Vul": "Vulpecula",
}


def load_openngc():
    if not os.path.exists(NGC_CSV):
        raise SystemExit(f"Falta {NGC_CSV}. Descárgalo de:\n  {SRC_URL}")
    return list(csv.DictReader(open(NGC_CSV, encoding="utf-8"), delimiter=";"))


def fnum(r, k):
    v = (r.get(k) or "").strip()
    try:
        return float(v)
    except ValueError:
        return None


def best_mag(r):
    v = fnum(r, "V-Mag")
    return v if v is not None else fnum(r, "B-Mag")


def common_name(r):
    cn = (r.get("Common names") or "").strip()
    return cn.split(",")[0].strip() if cn else ""


# ------------------------------------------------------------ Messier enriquecido
def enrich_messier(rows):
    by_m = {}
    for r in rows:
        m = (r.get("M") or "").strip()
        if m:
            by_m.setdefault(m.lstrip("0"), r)

    src = os.path.join(PUBLIC, "deepsky.json")
    data = json.load(open(src, encoding="utf-8"))
    enriched = 0
    for o in data["objects"]:
        r = by_m.get(str(o["m"]))
        if not r:
            continue
        const = (r.get("Const") or "").strip()
        if const:
            o["const"] = const
            o["const_es"] = CONST_ES.get(const, const)
            enriched += 1
        if not o.get("cn"):
            cn = common_name(r)
            if cn:
                o["cn"] = cn
    data["meta"]["note"] = ("Distancias curadas SEDS/NASA (aprox.). "
                            "Constelación y nombres via OpenNGC (CC-BY-SA).")
    data["meta"]["count"] = len(data["objects"])
    write_json("deepsky.json", data["meta"], data["objects"])
    print(f"  (Messier enriquecidos con constelación: {enriched}/{len(data['objects'])})")


# --------------------------------------------------------------- capa galaxias
def build_galaxies(rows):
    objects = []
    for r in rows:
        if r.get("Type") != "G":
            continue
        if (r.get("M") or "").strip():
            continue                      # las galaxias Messier van en su capa
        mag = best_mag(r)
        if mag is None or mag > GAL_MAG_LIMIT:
            continue
        ra = parse_hms(r.get("RA"))
        dec = parse_dms(r.get("Dec"))
        if ra is None or dec is None:
            continue
        dist_ly = redshift_to_ly(z=fnum(r, "Redshift"), radvel_kms=fnum(r, "RadVel"))
        if dist_ly is None or dist_ly < GAL_MIN_LY:
            continue
        nx, ny, nz = radec_to_vec(ra, dec)
        catname = (r.get("Name") or "").strip()
        cn = common_name(r)
        const = (r.get("Const") or "").strip()
        obj = {
            "name": cn or catname,
            "cat": catname,
            "nx": nx, "ny": ny, "nz": nz,
            "mag": round(mag, 2),
            "dist_ly": sig(dist_ly, 3),
        }
        hub = (r.get("Hubble") or "").strip()
        if hub:
            obj["hubble"] = hub          # tipo morfológico (Sb, E0, ...)
        if const:
            obj["const"] = const
            obj["const_es"] = CONST_ES.get(const, const)
        objects.append(obj)

    objects.sort(key=lambda o: o["mag"])   # más brillantes primero
    meta = {
        "source": "OpenNGC (Mattia Verga), CC-BY-SA-4.0",
        "url": "https://github.com/mattiaverga/OpenNGC",
        "distance": ("Derivada del corrimiento al rojo (velocidad radial / "
                     f"ley de Hubble, H0={70}). Aproximada."),
        "filter": f"Galaxias con mag<={GAL_MAG_LIMIT} y distancia por redshift.",
        "count": len(objects),
    }
    write_json("galaxies.json", meta, objects)
    return objects


def build():
    rows = load_openngc()
    enrich_messier(rows)
    build_galaxies(rows)


if __name__ == "__main__":
    build()
