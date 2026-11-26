#!/usr/bin/env python3
"""Escribe src/sky/lidarSites.js con los datos de cada maqueta (de /tmp/lidar/<sitio>/build.json y meta.json)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); D = sys.argv[1] if len(sys.argv) > 1 else "/tmp/lidar"
CRED = {
    "ea": ("Environment Agency (Inglaterra), LIDAR Composite DTM de 1 m, 2022 · Open Government Licence v3.0 · © Environment Agency copyright and/or database right 2022", "https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc"),
    "usgs": ("U.S. Geological Survey, 3D Elevation Program (3DEP), modelo del terreno de 1 m · dominio público", "https://www.usgs.gov/3d-elevation-program"),
    "hes": ("Historic Environment Scotland, HES LiDAR Project 2017 (Bluesky International), modelo del terreno de 0,5 m · Open Government Licence v3.0 · Contains Historic Environment Scotland data © Historic Environment Scotland, © Crown copyright and database right 2017", "https://remotesensingdata.gov.scot"),
    "gsi": ("Discovery Programme, Meath County Council y Heritage Council (vuelo de 2007), distribuido por Geological Survey Ireland, modelo del terreno de 1 m · CC BY 4.0 · Contains Irish Public Sector Data (Geological Survey Ireland & Discovery Programme)", "https://data.gov.ie/dataset/open-topographic-lidar-data"),
}
cfg = json.load(open(os.path.join(HERE, "sites.json"))); rows = []
for s in cfg:
    b = json.load(open(f"{D}/{s}/build.json")); m = json.load(open(f"{D}/{s}/meta.json"))
    src = f"{m['name']} · {m['license']}"; src, url = CRED.get(m["source"] if m["source"] != "tif" else ("hes" if "HES" in m["name"] else "gsi"), (src, m["url"]))
    rows.append(f'  {s}: {{ file: "{b["file"]}", base: {b["base_m"]:g}, clip: {b["clip"]:g}, z0: {b["z_origin"]:g}, zmax: {b["zmax"]:g}, lat: {b["origin"][0]}, lon: {b["origin"][1]}, res: {m["native_res"]:g},\n    src: {json.dumps(src, ensure_ascii=False)}, url: {json.dumps(url)} }},')
head = open(os.path.join(HERE, "..", "..", "src", "sky", "lidarSites.js")).read().split("export const LIDAR_SITES")[0]
open(os.path.join(HERE, "..", "..", "src", "sky", "lidarSites.js"), "w").write(head + "export const LIDAR_SITES = {\n" + "\n".join(rows) + "\n};\nexport const lidarFile = (name) => LIDAR_SITES[name] || null;\n")
print(len(rows), "sitios")
