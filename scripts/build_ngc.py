#!/usr/bin/env python3
"""Catálogo NGC/IC de la capa «NGC e IC» (public/ngc.json).

Fuente: OpenNGC (Mattia Verga, https://github.com/mattiaverga/OpenNGC), CC BY-SA 4.0. Entran los objetos reales
(no estrellas sueltas, duplicados ni inexistentes) de magnitud 14,5 o más brillantes, más las nebulosas, cúmulos y
asociaciones sin magnitud publicada (NGC 206, la nube de estrellas de Andrómeda). Se dejan fuera los
que ya están en otras capas: Messier, Caldwell (public/caldwell.json) y Galaxias (public/galaxies.json).
"""
import csv, io, json, math, os, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_deepsky import CONST_ES
from build_caldwell import TYPE_MAP
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
URL = "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv"
CACHE = "/tmp/ngc/NGC.csv"
MAG_LIM = 14.5
if not os.path.exists(CACHE):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    open(CACHE, "wb").write(urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "teseo-build"}), timeout=120).read())
rows = list(csv.DictReader(io.open(CACHE, encoding="utf-8"), delimiter=";"))
TYPES = dict(TYPE_MAP); TYPES.update({"GTrpl": "galaxy", "GCl": "globular"})
SKIP = {"*", "**", "Dup", "NonEx", "Other", "Nova"}
norm = lambda s: s.replace(" ", "").upper()
have = set()
for o in json.load(open(os.path.join(ROOT, "public", "caldwell.json")))["objects"]: have.update(norm(x) for x in o.get("ids", []))
for o in json.load(open(os.path.join(ROOT, "public", "galaxies.json")))["objects"]: have.add(norm(o.get("cat", "")))
def deg(s, hours):
    sign = -1 if s.strip().startswith("-") else 1
    a, b, c = [float(x) for x in s.strip().lstrip("+-").split(":")]
    return sign * (a + b / 60 + c / 3600) * (15 if hours else 1)
out = []
for r in rows:
    if r["Type"] in SKIP or r["M"] or not r["RA"] or norm(r["Name"]) in have: continue
    mag = float(r["V-Mag"]) if r["V-Mag"] else float(r["B-Mag"]) if r["B-Mag"] else None
    size = float(r["MajAx"]) if r["MajAx"] else None
    cn = r["Common names"].split(",")[0].strip() if r["Common names"] else ""
    ty = TYPES.get(r["Type"], "other")
    if mag is not None:
        if mag > MAG_LIM: continue
    elif ty == "galaxy" and not cn: continue        # sin magnitud: todo menos las galaxias anónimas
    ra, dec = math.radians(deg(r["RA"], True)), math.radians(deg(r["Dec"], False))
    m = __import__("re").match(r"^(NGC|IC)0*(\d+)(.*)$", r["Name"])
    o = {"name": f"{m.group(1)} {m.group(2)}{m.group(3)}" if m else r["Name"], "type": ty,
         "nx": round(math.cos(dec) * math.cos(ra), 5), "ny": round(math.cos(dec) * math.sin(ra), 5), "nz": round(math.sin(dec), 5)}
    if mag is not None: o["mag"] = round(mag, 1)
    if size: o["size"] = round(size, 1)
    if r["Const"]: o["const"] = r["Const"]; o["const_es"] = CONST_ES.get(r["Const"], r["Const"])
    if cn: o["cn"] = cn
    if ty == "galaxy" and r["Hubble"] and (mag or 99) <= 13: o["hubble"] = r["Hubble"]
    out.append(o)
out.sort(key=lambda o: (o.get("mag", 99), o["name"]))
json.dump({"meta": {"source": "OpenNGC (Mattia Verga), CC BY-SA 4.0", "url": "https://github.com/mattiaverga/OpenNGC", "mag_lim": MAG_LIM,
                    "note": "sin los objetos de las capas Messier, Caldwell y Galaxias"}, "count": len(out), "objects": out},
          open(os.path.join(ROOT, "public", "ngc.json"), "w"), ensure_ascii=False, separators=(",", ":"))
import collections
print(len(out), collections.Counter(o["type"] for o in out), os.path.getsize(os.path.join(ROOT, "public", "ngc.json")) // 1024, "KB")
for n in ("IC 434", "NGC 2237", "NGC 7000", "NGC 869", "NGC 2070", "NGC 4038", "NGC 6960"):
    print(n, [o for o in out if o["name"] == n][:1])
