"""
Genera public/pulsars.json desde el catálogo ATNF (psrcat.db).

Fuente: ATNF Pulsar Catalogue, Manchester et al. (2005), AJ 129, 1993.
https://www.atnf.csiro.au/research/pulsar/psrcat/

Filtro de honestidad: solo púlsares con posición Y distancia publicada
(la distancia es la del catálogo — 'DIST', best estimate; si no, la
derivada de la medida de dispersión 'DIST_DM'). Sin distancia no hay
profundidad real, así que no se incluyen.
"""
import os
import tarfile

from lib_astro import (RAW, parse_hms, parse_dms, radec_to_vec, kpc_to_ly,
                       sig, write_json)

DB = os.path.join(RAW, "psrcat.db")
TARBALL = os.path.join(RAW, "psrcat.tar.gz")
SRC_URL = "https://www.atnf.csiro.au/research/pulsar/psrcat/downloads/psrcat_pkg.tar.gz"


def ensure_db():
    if os.path.exists(DB):
        return
    if not os.path.exists(TARBALL):
        raise SystemExit(
            f"Falta {TARBALL}. Descárgalo de:\n  {SRC_URL}\n"
            f"y colócalo en scripts/raw/ (o pon directamente psrcat.db)."
        )
    with tarfile.open(TARBALL) as t:
        for m in t.getmembers():
            if m.name.endswith("psrcat.db"):
                m.name = "psrcat.db"
                t.extract(m, RAW)
                return
    raise SystemExit("No se encontró psrcat.db dentro del tarball.")


def parse_records(path):
    """Itera los registros del .db como dicts {clave: valor}."""
    rec = {}
    for line in open(path, encoding="latin-1"):
        if line.startswith("@"):          # separador de registro
            if rec:
                yield rec
            rec = {}
            continue
        if line.startswith("#") or not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 2:
            key = parts[0]
            # el primer valor tras la clave (los siguientes son error/ref)
            rec.setdefault(key, parts[1])
    if rec:
        yield rec


def build():
    ensure_db()
    objects = []
    skipped_nodist = skipped_nopos = 0
    for rec in parse_records(DB):
        ra = parse_hms(rec.get("RAJ"))
        dec = parse_dms(rec.get("DECJ"))
        if ra is None or dec is None:
            skipped_nopos += 1
            continue
        dist_kpc = rec.get("DIST") or rec.get("DIST_DM") or rec.get("DIST_DM1")
        try:
            dist_kpc = float(dist_kpc)
        except (TypeError, ValueError):
            skipped_nodist += 1
            continue
        if dist_kpc <= 0:
            skipped_nodist += 1
            continue

        # periodo: P0 en segundos, o 1/F0 (Hz)
        period_ms = None
        if rec.get("P0"):
            try:
                period_ms = float(rec["P0"]) * 1000.0
            except ValueError:
                pass
        elif rec.get("F0"):
            try:
                period_ms = 1000.0 / float(rec["F0"])
            except (ValueError, ZeroDivisionError):
                pass

        bname = rec.get("PSRB")
        jname = rec.get("PSRJ")
        name = bname or jname
        nx, ny, nz = radec_to_vec(ra, dec)

        # nota: tipo (MSP/binario/...) + asociación si la hay
        bits = []
        if period_ms is not None and period_ms < 30:
            bits.append("milisegundo")
        if rec.get("BINARY"):
            bits.append("binario")
        assoc = rec.get("ASSOC", "")
        if "SNR" in assoc:
            bits.append("en remanente de SN")
        note = ", ".join(bits)

        obj = {
            "name": name,
            "jname": jname,
            "nx": nx, "ny": ny, "nz": nz,
            "dist_ly": sig(kpc_to_ly(dist_kpc), 3),
        }
        if period_ms is not None:
            obj["period_ms"] = round(period_ms, 3)
        if note:
            obj["note"] = note
        objects.append(obj)

    # más cercanos primero (los interesantes para "profundidad")
    objects.sort(key=lambda o: o["dist_ly"])
    meta = {
        "source": "ATNF Pulsar Catalogue (Manchester et al. 2005) v2.8.1",
        "url": "https://www.atnf.csiro.au/research/pulsar/psrcat/",
        "note": ("Distancia del catálogo (best estimate) o derivada de la "
                 "medida de dispersión (DM); tiene incertidumbre. Solo se "
                 "incluyen púlsares con posición y distancia."),
        "count": len(objects),
    }
    write_json("pulsars.json", meta, objects)
    print(f"  (descartados: {skipped_nodist} sin distancia, "
          f"{skipped_nopos} sin posición)")
    return objects


if __name__ == "__main__":
    build()
