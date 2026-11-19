#!/usr/bin/env python3
"""Planetas enanos y asteroides de la capa «Planetas enanos y asteroides» (public/minor-bodies.json).

Fuente: JPL Small-Body Database (https://ssd-api.jpl.nasa.gov/sbdb.api), dominio público: elementos orbitales
osculadores (eclíptica J2000), magnitud absoluta H, parámetro de fase G y diámetro. El cliente calcula con ellos la
posición de cada fecha (dos cuerpos, src/sky/cometSky.js: minorObjects). Los elementos son de una época reciente, así
que valen bien durante unos años; conviene volver a ejecutar este script de vez en cuando.
"""
import json, os, time, urllib.parse, urllib.request
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
# (búsqueda en SBDB, nombre es, nombre en, tipo, nota es, nota en)
BODIES = [
    ("134340", "Plutón", "Pluto", "dwarf", "El planeta enano más famoso; la sonda New Horizons lo visitó en 2015 y halló montañas de hielo y un «corazón» de nitrógeno.", "The most famous dwarf planet; New Horizons flew past in 2015 and found ice mountains and a nitrogen “heart”."),
    ("1", "Ceres", "Ceres", "dwarf", "El mayor cuerpo del cinturón de asteroides y el único planeta enano del sistema solar interior; la sonda Dawn lo orbitó.", "The largest body in the asteroid belt and the only dwarf planet in the inner solar system; Dawn orbited it."),
    ("136199", "Eris", "Eris", "dwarf", "Casi tan grande como Plutón y mucho más lejana; su hallazgo en 2005 llevó a definir qué es un planeta.", "Almost as large as Pluto and much farther; its discovery in 2005 led to the definition of a planet."),
    ("136108", "Haumea", "Haumea", "dwarf", "Con forma de balón de rugby porque gira una vez cada cuatro horas; tiene anillo y dos lunas.", "Rugby-ball shaped because it spins once every four hours; it has a ring and two moons."),
    ("136472", "Makemake", "Makemake", "dwarf", "Planeta enano helado del cinturón de Kuiper, con una luna pequeña.", "An icy dwarf planet in the Kuiper belt, with one small moon."),
    ("90377", "Sedna", "Sedna", "tno", "Uno de los cuerpos más lejanos conocidos: tarda más de 11 000 años en dar una vuelta al Sol.", "One of the most distant known bodies: it takes more than 11,000 years to go around the Sun."),
    ("4", "Vesta", "Vesta", "asteroid", "El asteroide más brillante, a veces visible a simple vista; Dawn lo orbitó en 2011.", "The brightest asteroid, sometimes visible to the naked eye; Dawn orbited it in 2011."),
    ("2", "Palas", "Pallas", "asteroid", "El tercer asteroide más grande, con una órbita muy inclinada.", "The third-largest asteroid, on a steeply tilted orbit."),
    ("3", "Juno", "Juno", "asteroid", "Uno de los primeros cuatro asteroides descubiertos (1804).", "One of the first four asteroids discovered (1804)."),
    ("10", "Higía", "Hygiea", "asteroid", "El cuarto asteroide más grande; casi esférico.", "The fourth-largest asteroid; nearly spherical."),
    ("7", "Iris", "Iris", "asteroid", "Uno de los asteroides más brillantes del cinturón principal.", "One of the brightest main-belt asteroids."),
    ("6", "Hebe", "Hebe", "asteroid", "Posible origen de muchos de los meteoritos que caen en la Tierra.", "A likely source of many of the meteorites that fall on Earth."),
    ("16", "Psique", "Psyche", "asteroid", "Asteroide metálico; la sonda Psyche de la NASA viaja hacia él.", "A metallic asteroid; NASA's Psyche spacecraft is on its way there."),
    ("433", "Eros", "Eros", "nea", "Asteroide cercano a la Tierra; el primero en ser orbitado y tocado por una sonda (NEAR Shoemaker, 2000–2001).", "A near-Earth asteroid; the first to be orbited and touched by a spacecraft (NEAR Shoemaker, 2000–2001)."),
    ("99942", "Apofis", "Apophis", "nea", "Pasará a unos 32 000 km de la Tierra el 13 de abril de 2029, más cerca que los satélites geoestacionarios, sin riesgo de choque.", "It will pass about 32,000 km from Earth on 13 April 2029, closer than geostationary satellites, with no risk of impact."),
    ("101955", "Bennu", "Bennu", "nea", "La sonda OSIRIS-REx trajo muestras suyas a la Tierra en 2023.", "OSIRIS-REx brought samples of it back to Earth in 2023."),
    ("162173", "Ryugu", "Ryugu", "nea", "La sonda japonesa Hayabusa2 trajo muestras suyas en 2020.", "Japan's Hayabusa2 brought back samples of it in 2020."),
]
# diámetros que SBDB no trae (valores medios publicados: New Horizons para Plutón; ocultaciones y Herschel para el resto)
DIAM = {"134340": 2376.6, "136199": 2326, "136108": 1560, "136472": 1430, "90377": 1000}
# artículos de Wikipedia (inglés, español) para la foto y el resumen de la ficha
WIKI = {"134340": ("Pluto", "Plutón (planeta enano)"), "1": ("Ceres (dwarf planet)", "Ceres (planeta enano)"), "136199": ("Eris (dwarf planet)", "Eris (planeta enano)"),
        "136108": ("Haumea", "Haumea (planeta enano)"), "136472": ("Makemake", "Makemake (planeta enano)"), "90377": ("90377 Sedna", "(90377) Sedna"),
        "4": ("4 Vesta", "(4) Vesta"), "2": ("2 Pallas", "(2) Palas"), "3": ("3 Juno", "(3) Juno"), "10": ("10 Hygiea", "(10) Higía"), "7": ("7 Iris", "(7) Iris"),
        "6": ("6 Hebe", "(6) Hebe"), "16": ("16 Psyche", "(16) Psique"), "433": ("433 Eros", "(433) Eros"), "99942": ("99942 Apophis", "(99942) Apofis"),
        "101955": ("101955 Bennu", "(101955) Bennu"), "162173": ("162173 Ryugu", "(162173) Ryugu")}
out = []
for sstr, es, en, kind, nes, nen in BODIES:
    u = "https://ssd-api.jpl.nasa.gov/sbdb.api?" + urllib.parse.urlencode({"sstr": sstr, "phys-par": "1", "full-prec": "true"})
    for k in range(4):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "teseo-build"}), timeout=60)); break
        except Exception as ex:
            if k == 3: raise
            time.sleep(3)
    el = {e["name"]: float(e["value"]) for e in d["orbit"]["elements"] if e["value"] not in (None, "")}
    ph = {}
    for p in d.get("phys_par", []):
        if p["name"] in ("H", "G", "diameter"):
            try: ph[p["name"]] = float(p["value"])
            except Exception: pass
    o = {"name": es, "name_en": en, "kind": kind, "num": int(sstr), "note_es": nes, "note_en": nen, "wiki_en": WIKI[sstr][0], "wiki_es": WIKI[sstr][1],
         "el": {"q": el["q"], "e": el["e"], "i": el["i"], "om": el["om"], "w": el["w"], "tp": el["tp"], "epoch": float(d["orbit"]["epoch"])},
         "H": ph.get("H"), "G": ph.get("G", 0.15), "diam_km": ph.get("diameter") or DIAM.get(sstr), "period_y": round(el["per"] / 365.25, 2) if "per" in el else None}
    out.append(o); print(es, o["H"], o["diam_km"], o["period_y"], o["el"]["epoch"]); time.sleep(0.4)
json.dump({"meta": {"source": "JPL Small-Body Database (elementos osculadores, eclíptica J2000; H, G, diámetro)", "read": time.strftime("%Y-%m-%d")}, "count": len(out), "objects": out},
          open(os.path.join(ROOT, "public", "minor-bodies.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("ok", len(out))
