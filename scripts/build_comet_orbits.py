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
# ── cometas del momento: los que pasan por el perihelio a menos de 500 días de hoy y, según su fórmula de
# brillo (M1, K1), llegarán a la magnitud 14 o más brillante. Se eligen con la misma mecánica del cliente
# (scripts/pick_bright_comets.mjs → src/sky/cometSky.js). Hay que volver a ejecutar este script cada pocos meses.
import subprocess, sys
now = time.time(); jd = now / 86400 + 2440587.5
q = {"fields": "full_name,pdes,name,q,e,i,om,w,tp,epoch,M1,K1", "sb-kind": "c", "full-prec": "true",
     "sb-cdata": json.dumps({"AND": ["tp|RG|%.1f|%.1f" % (jd - 500, jd + 500), "q|LT|5.5"]})}
d = json.load(urllib.request.urlopen(urllib.request.Request("https://ssd-api.jpl.nasa.gov/sbdb_query.api?" + urllib.parse.urlencode(q), headers={"User-Agent": "teseo-build"}), timeout=90))
F = d["fields"]; cand = {}
for row in d["data"]:
    r = dict(zip(F, row))
    if r["M1"] in (None, "") or r["K1"] in (None, ""): continue
    full = " ".join(r["full_name"].split())                      # «C/2025 A6 (Lemmon)», «24P/Schaumasse»
    if full in out or any(full.split("/")[0] == k.split("/")[0] and "P/" in k for k in out): continue
    cand[full] = {"q": float(r["q"]), "e": float(r["e"]), "i": float(r["i"]), "om": float(r["om"]), "w": float(r["w"]), "tp": float(r["tp"]), "epoch": float(r["epoch"]), "M1": float(r["M1"]), "K1": float(r["K1"])}
pick = json.loads(subprocess.run(["node", os.path.join(ROOT, "scripts", "pick_bright_comets.mjs"), str(int(now * 1000)), "14", "14"], input=json.dumps(cand), capture_output=True, text=True, check=True).stdout)
for p in pick:
    out[p["name"]] = {**cand[p["name"]], "extra": True, "best": p["best"]}
    print("del momento:", p)
json.dump({"meta": {"source": "JPL Small-Body Database (elementos osculadores, eclíptica J2000; M1 y K1)", "read": time.strftime("%Y-%m-%d"), "extra": "extra: cometa del momento (sin posición de Horizons: se calcula con dos cuerpos); best: magnitud más brillante prevista"}, "comets": out}, open(os.path.join(ROOT, "public", "comet-orbits.json"), "w"), ensure_ascii=False, indent=1)
