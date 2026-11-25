#!/usr/bin/env python3
"""Genera src/sky/intiScan.js: la cima del Intihuatana de Machu Picchu a partir del escaneo láser de CAST.

Fuente: «Intiwatana_50.zip» (malla .obj, 484.105 triángulos, levantada en 2009), de
https://gmv.cast.uark.edu/region-data/region/peru/machu-picchu-peru-intiwatana-2/
Licencia de los datos: Creative Commons BY-NC 3.0. Crédito: Instituto Nacional de Cultura, Center for Advanced
Spatial Technologies (University of Arkansas) y Cotsen Institute for Archaeology (UCLA).

Uso:  python3 -I scripts/build_inti_scan.py /ruta/Intiwatana_50.zip        (necesita numpy y fast-simplification)

Qué hace: simplifica la malla a TARGET triángulos, pone el origen en la punta del gnomon (planta) y en el piso que lo
rodea (altura), y guarda vértices en centímetros (int16) e índices (uint16) en base64. No se retoca la forma.
Orientación: se conserva la del sistema de coordenadas del escaneo (eje Y = norte). Comprobación: el rumbo de sus
muros (157°) difiere 7° del de los andenes vecinos en OpenStreetMap (150°); esa es la incertidumbre que se declara.
"""
import base64, sys, zipfile
import numpy as np
import fast_simplification as fs

TARGET = 16000
V, F = [], []
with zipfile.ZipFile(sys.argv[1]) as z:
    name = next(n for n in z.namelist() if n.lower().endswith(".obj"))
    with z.open(name) as f:
        for l in f:
            if l[:2] == b"v ": V.append(l.split()[1:4])
            elif l[:2] == b"f ": F.append([int(t.split(b"/")[0]) - 1 for t in l.split()[1:4]])
V = np.array(V, float); F = np.array(F, np.int64)
n_src = len(F)
# gnomon: el punto más alto a menos de 2,5 m del centro de la roca tallada (medido sobre la malla original)
c = np.array([-113.6, 224.6]); near = np.hypot(V[:, 0] - c[0], V[:, 1] - c[1]) < 2.5
top = V[near][V[near][:, 2].argmax()]
ring = np.hypot(V[:, 0] - top[0], V[:, 1] - top[1]) < 2.75      # la roca y el piso que la rodea
floor = float(np.percentile(V[ring][:, 2], 10))
v, f = fs.simplify(V, F, target_count=TARGET)
v = v - np.array([top[0], top[1], floor])
# clase de cada triángulo: 0 roca tallada (a menos de 3,3 m del gnomon y sobre el piso), 1 muro (cara empinada), 2 piso
a, b, c3 = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
nrm = np.cross(b - a, c3 - a); nrm /= (np.linalg.norm(nrm, axis=1)[:, None] + 1e-12)
cen = (a + b + c3) / 3
cls = np.where(np.abs(nrm[:, 2]) < 0.6, 1, 2)
cls[(np.hypot(cen[:, 0], cen[:, 1]) < 3.3) & (cen[:, 2] > 0.12) & (cen[:, 2] < top[2] - floor + 0.05)] = 0
# RELLENO: el láser no ve el piso que tapan los muros. Esos huecos se cierran con una losa por celdas de 0,5 m, al
# nivel del piso medido más cercano y 3 cm por debajo (clase 3: es inferida, no medida).
C = 0.5
x0, y0 = v[:, 0].min(), v[:, 1].min(); W = int((v[:, 0].max() - x0) / C) + 1; H = int((v[:, 1].max() - y0) / C) + 1
have = np.zeros((H, W), bool); zf = np.full((H, W), np.nan)
src = (V - np.array([top[0], top[1], floor]))
ix = ((src[:, 0] - x0) / C).astype(int).clip(0, W - 1); iy = ((src[:, 1] - y0) / C).astype(int).clip(0, H - 1)
have[iy, ix] = True
for j in range(H):
    for i in range(W):
        m = (iy == j) & (ix == i)
        if m.sum() > 20: zf[j, i] = np.percentile(src[m][:, 2], 5)
dense = np.zeros((H, W)); np.add.at(dense, (iy, ix), 1)
full = dense > 0.6 * (C / 0.05) ** 2 * 0.25          # celda bien cubierta por el escaneo
def dil(a, k):
    for _ in range(k):
        p = np.pad(a, 1); a = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return a
foot = ~dil(~dil(have, 3), 3)                         # cierre morfológico: la huella sin sus huecos interiores
need = foot & ~full
known = np.argwhere(~np.isnan(zf)); kz = zf[~np.isnan(zf)]
fv, ff = [], []
for j, i in np.argwhere(need):
    d = (known[:, 0] - j) ** 2 + (known[:, 1] - i) ** 2; near = np.argsort(d)[:4]
    z = float(np.median(kz[near])) - 0.03
    b0 = len(v) + len(fv)
    fv += [[x0 + i * C, y0 + j * C, z], [x0 + (i + 1) * C, y0 + j * C, z], [x0 + (i + 1) * C, y0 + (j + 1) * C, z], [x0 + i * C, y0 + (j + 1) * C, z]]
    ff += [[b0, b0 + 1, b0 + 2], [b0, b0 + 2, b0 + 3]]
n_fill = len(ff)
v = np.vstack([v, np.array(fv)]); f = np.vstack([f, np.array(ff, np.int64)]); cls = np.r_[cls, np.full(n_fill, 3)]
assert len(v) < 65536
vi = np.round(v * 100).astype("<i2"); fi = f.astype("<u2")
b64 = lambda x: base64.b64encode(x.tobytes()).decode()
out = f"""// GENERADO por scripts/build_inti_scan.py — no editar a mano.
// Cima del Intihuatana de Machu Picchu: malla del escaneo láser de 2009, simplificada de {n_src} a {len(f) - n_fill} triángulos,\n// más {n_fill} de relleno donde el láser no alcanzó el piso (inferido: al nivel del piso medido más cercano).
// DATOS CON LICENCIA PROPIA: Creative Commons BY-NC 3.0 (https://creativecommons.org/licenses/by-nc/3.0/).
// Crédito: Instituto Nacional de Cultura, Center for Advanced Spatial Technologies (University of Arkansas) y
// Cotsen Institute for Archaeology (UCLA). Cambios: simplificación de la malla y cambio de origen; la forma no se retoca.
const dec = (s, T) => {{ const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); }};
export const INTI_SCAN = {{
  credit: "Instituto Nacional de Cultura · CAST (University of Arkansas) · Cotsen Institute for Archaeology (UCLA) · CC BY-NC 3.0",
  gnomonTop: {top[2] - floor:.2f},          // m sobre el piso que rodea la roca
  v: dec("{b64(vi)}", Int16Array),          // [este, norte, altura] en cm desde la punta del gnomon (planta) y el piso
  f: dec("{b64(fi)}", Uint16Array),
  cls: dec("{b64(cls.astype('u1'))}", Uint8Array),   // 0 roca tallada · 1 muro · 2 piso · 3 relleno inferido
}};
"""
open("src/sky/intiScan.js", "w", encoding="utf-8").write(out)
print(len(v), len(f), "gnomon", round(top[2] - floor, 2), "clases", np.bincount(cls), "bytes", len(out))
