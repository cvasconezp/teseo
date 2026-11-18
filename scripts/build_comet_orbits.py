#!/usr/bin/env python3
"""Órbita y brillo de los cometas de la capa «Cometas» (public/comet-orbits.json).

Fuente: JPL Small-Body Database (https://ssd-api.jpl.nasa.gov/sbdb.api), dominio público: elementos orbitales
osculadores (q, e, i, nodo, argumento del perihelio, paso por el perihelio; eclíptica J2000) y los parámetros de
brillo total M1 y K1 (m = M1 + 5·log Δ + K1·log r). Con dos cuerpos (el Sol y el cometa) bastan para DIBUJAR la
órbita; la posición del día sigue viniendo de Horizons (/api/comets), que sí cuenta las perturbaciones.
"""
import json, os, time, urllib.parse, urllib.request
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
COMETS = {"1P/Halley": "1P", "2P/Encke": "2P", "12P/Pons-Brooks": "12P", "55P/Tempel-Tuttle": "55P", "109P/Swift-Tuttle": "109P",
          "67P/Churyumov-Gerasimenko": "67P", "C/2023 A3 (Tsuchinshan-ATLAS)": "C/2023 A3"}
out = {}
for name, sstr in COMETS.items():
    u = "https://ssd-api.jpl.nasa.gov/sbdb.api?" + urllib.parse.urlencode({"sstr": sstr, "phys-par": "1", "full-prec": "true"})
    d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "teseo-build"}), timeout=60))
    el = {e["name"]: float(e["value"]) for e in d["orbit"]["elements"] if e["value"] not in (None, "")}
    ph = {p["name"]: float(p["value"]) for p in d.get("phys_par", []) if p["name"] in ("M1", "K1")}
    out[name] = {"q": el["q"], "e": el["e"], "i": el["i"], "om": el["om"], "w": el["w"], "tp": el["tp"], "epoch": float(d["orbit"]["epoch"]), "M1": ph.get("M1"), "K1": ph.get("K1")}
    print(name, out[name]); time.sleep(0.5)
json.dump({"meta": {"source": "JPL Small-Body Database (elementos osculadores, eclíptica J2000; M1 y K1)", "read": time.strftime("%Y-%m-%d")}, "comets": out}, open(os.path.join(ROOT, "public", "comet-orbits.json"), "w"), ensure_ascii=False, indent=1)
