#!/usr/bin/env python3
"""Genera public/data/machu-maqueta.bin: la maqueta «Machupicchu» del Ministerio de Cultura del Perú, lista para Teseo.

Fuente: https://sketchfab.com/3d-models/machupicchu-d59370ac4a444628b95081f5bb7bbd02 (descarga glTF), CC BY 4.0.
Crédito: This work is based on "Machupicchu" by Ministerio de Cultura Perú, licensed under CC-BY-4.0.

Uso:  python3 -I scripts/build_machu_maqueta.py /ruta/machupicchu-gltf.zip        (necesita numpy)

Cambios respecto al original (se declaran en CREDITS.md):
 1. ENCAJE sobre la planta de OpenStreetMap: giro, escala y traslación (FIT), hallados ajustando sus muros a los
    contornos de los recintos de OSM (la mitad de los muros, a menos de 2 m). Origen: el nodo del Intihuatana (MP0).
 2. ALTURA: se suma Z0 para que el piso del Templo del Sol quede en la cota medida por JICA (2.429,59 m).
 3. SECTOR OESTE: la colina del Intihuatana queda en la maqueta 15 m al oeste de su sitio en OpenStreetMap. Se corre
    hasta él con un desplazamiento suave (entero a menos de 60 m de la piedra, nulo a más de 130 m).
 4. CIMA DEL INTIHUATANA: se quitan los muros de la maqueta dentro de la huella del escaneo láser (intiScan.js).
 5. ZÓCALO: se quitan los faldones que bajan hasta la base de la maqueta (no son terreno).
 6. Solo geometría: no se usan sus texturas. Vértices soldados al centímetro.
Formato del .bin: Uint32[nv, nt] · Int16[nv·3] (este, norte, altura − 2400 m; unidad 2 cm) · Uint16[nt·3] · Uint8[nt] clase
 clases: 0 muro · 1 hierba · 2 muro de andén · 3 piso de tierra · 4 techo de paja · 5 madera · 6 canal o escalinata
"""
import json, struct, sys, zipfile
import numpy as np

FIT_S = 0.9889523694688677
FIT_R = np.array([[0.9111360394408156, -0.4121057117198269], [0.41210571171982674, 0.9111360394408153]])
FIT_T = np.array([44.848926738232095, -363.6988615485028])
Z0 = 2386.4
WEST_C, WEST_SHIFT = np.array([-15.1, 6.6]), np.array([15.1, -1.6])
SCAN_BOX = (-12.0, -20.0, 16.0, 16.0)
CLS = {"Stone_Ashlar": 0, "Vegetation": 1, "RiverRock": 2, "Wood_Mix": 3, "Sand": 3, "Default": 3, "Concrete": 4, "BarkChips": 5, "Siding": 6}

z = zipfile.ZipFile(sys.argv[1]); g = json.loads(z.read("scene.gltf")); buf = z.read("scene.bin")
def acc(i):
    a = g["accessors"][i]; bv = g["bufferViews"][a["bufferView"]]; off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[a["type"]]; dt = np.dtype({5126: "<f4", 5125: "<u4", 5123: "<u2"}[a["componentType"]]); st = bv.get("byteStride")
    if st and st != dt.itemsize * n:
        raw = np.frombuffer(buf, np.uint8, st * a["count"], off).reshape(a["count"], st)[:, : dt.itemsize * n].copy()
        return raw.view(dt).reshape(a["count"], n)
    return np.frombuffer(buf, dt, a["count"] * n, off).reshape(a["count"], n)

V, F, C = [], [], []
base = 0
for m in g["meshes"]:
    cls = next(v for k, v in CLS.items() if k in m["name"])
    p = m["primitives"][0]; P = acc(p["attributes"]["POSITION"]).astype(float) / 100.0; T = acc(p["indices"]).reshape(-1, 3).astype(np.int64)
    xy = FIT_S * (P[:, :2] @ FIT_R.T) + FIT_T
    d = np.hypot(xy[:, 0] - WEST_C[0], xy[:, 1] - WEST_C[1]); k = np.clip((130 - d) / 70, 0, 1); k = k * k * (3 - 2 * k)
    xy = xy + k[:, None] * WEST_SHIFT
    Q = np.c_[xy, P[:, 2] * FIT_S + Z0 - 2400.0]
    if cls in (1, 2, 3):
        # el zócalo de la maqueta (los faldones que bajan hasta su base) no es terreno: fuera
        T = T[Q[T][:, :, 2].min(1) > (Z0 - 2400.0) + 0.3]
    if cls in (0, 3):
        c = Q[T].mean(1); keep = ~((c[:, 0] > SCAN_BOX[0]) & (c[:, 0] < SCAN_BOX[2]) & (c[:, 1] > SCAN_BOX[1]) & (c[:, 1] < SCAN_BOX[3]) & ((cls == 0) | (m["name"].find("Wood_Mix") >= 0)))
        T = T[keep]
    V.append(Q); F.append(T + base); C.append(np.full(len(T), cls, np.uint8)); base += len(Q)
V = np.vstack(V); F = np.vstack(F); C = np.concatenate(C)
q = np.round(V * 50).astype(np.int64)                       # unidad: 2 cm
u, inv = np.unique(q, axis=0, return_inverse=True); F = inv.reshape(-1)[F]
ok = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2]); F, C = F[ok], C[ok]
used = np.unique(F); remap = np.full(len(u), -1); remap[used] = np.arange(len(used)); u = u[used]; F = remap[F]
assert len(u) < 65536 and np.abs(u).max() < 32767, (len(u), np.abs(u).max())
out = struct.pack("<II", len(u), len(F)) + u.astype("<i2").tobytes() + F.astype("<u2").tobytes() + C.tobytes()
open("public/data/machu-maqueta.bin", "wb").write(out)
print("vértices", len(u), "triángulos", len(F), "bytes", len(out), "clases", np.bincount(C).tolist())
print("extensión e", u[:, 0].min() / 50, u[:, 0].max() / 50, "n", u[:, 1].min() / 50, u[:, 1].max() / 50, "z", u[:, 2].min() / 50 + 2400, u[:, 2].max() / 50 + 2400)
