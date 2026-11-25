#!/usr/bin/env python3
"""Genera src/sky/machuData.js a partir de un extracto de OpenStreetMap de Machu Picchu.

Uso:  curl -o mp.osm "https://api.openstreetmap.org/api/0.6/map?bbox=-72.5492,-13.1672,-72.5425,-13.1600"
      python3 -I scripts/build_machu_data.py mp.osm

Datos © colaboradores de OpenStreetMap (ODbL). De cada vía se guarda solo su geometría, en decímetros
[este, norte] desde el Intihuatana (MP0 en src/sky/monuments.js): los recintos (building=ruins), los muros de
contención de los andenes (barrier=retaining_wall), los muros (barrier=wall) y las escalinatas (highway=steps).
Quedan fuera lo moderno (hotel, casetas, techos) y lo que cae a más de 440 m del Intihuatana.
"""
import sys, math, json, xml.etree.ElementTree as ET

LAT0, LON0 = -13.16312, -72.545683
MLAT, MLON = 110574.0, 111320 * math.cos(math.radians(LAT0))
MAX_R = 440.0

def main(path):
    r = ET.parse(path).getroot()
    nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in r.findall("node")}
    xy = lambda i: ((nodes[i][1] - LON0) * MLON, (nodes[i][0] - LAT0) * MLAT)
    out = {"b": [], "t": [], "w": [], "s": []}
    for w in r.findall("way"):
        tg = {x.get("k"): x.get("v") for x in w.findall("tag")}
        pts = [xy(n.get("ref")) for n in w.findall("nd") if n.get("ref") in nodes]
        if len(pts) < 2: continue
        cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        if "building" in tg:
            if tg["building"] in ("roof", "civic") or "tourism" in tg or "amenity" in tg: continue
            if tg["building"] != "ruins" and cx > 280: continue          # entrada moderna y hotel
            if pts[0] == pts[-1]: pts = pts[:-1]
            if len(pts) < 3 or math.hypot(cx, cy) > MAX_R: continue
            key = "b"
        elif tg.get("barrier") == "retaining_wall": key = "t"
        elif tg.get("barrier") == "wall": key = "w"
        elif tg.get("highway") == "steps": key = "s"
        else: continue
        if key != "b":
            pts = [p for p in pts if math.hypot(*p) <= MAX_R]
            if len(pts) < 2: continue
        out[key].append([round(v * 10) for p in pts for v in p])
    for k in out: out[k].sort()
    js = ("// machuData.js — GENERADO por scripts/build_machu_data.py; no editar a mano.\n"
          "// Planta de Machu Picchu: © colaboradores de OpenStreetMap (ODbL), https://www.openstreetmap.org/copyright\n"
          "// Cada elemento: [e0, n0, e1, n1, …] en decímetros (este, norte) desde el Intihuatana (MP0 de monuments.js).\n"
          f"/** Recintos (polígonos cerrados): {len(out['b'])}. */\nexport const MP_BUILDINGS = {json.dumps(out['b'], separators=(',', ':'))};\n"
          f"/** Muros de contención de los andenes (líneas): {len(out['t'])}. */\nexport const MP_TERRACES = {json.dumps(out['t'], separators=(',', ':'))};\n"
          f"/** Muros (líneas): {len(out['w'])}. */\nexport const MP_WALLS = {json.dumps(out['w'], separators=(',', ':'))};\n"
          f"/** Escalinatas (líneas): {len(out['s'])}. */\nexport const MP_STEPS = {json.dumps(out['s'], separators=(',', ':'))};\n")
    open("src/sky/machuData.js", "w", encoding="utf-8").write(js)
    print({k: (len(v), sum(len(x) for x in v) // 2) for k, v in out.items()}, len(js), "bytes")

if __name__ == "__main__":
    main(sys.argv[1])
