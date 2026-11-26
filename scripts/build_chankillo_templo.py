#!/usr/bin/env python3
"""Templo Fortificado de Chankillo → public/data/chankillo-templo.bin (el mismo formato que la maqueta de Machu Picchu).

Fuente: «Sitio arqueológico Chankillo», Dirección de Catastro y Saneamiento Físico Legal, Ministerio de Cultura del
Perú (2015), en Sketchfab, CC BY 4.0: https://sketchfab.com/3d-models/sitio-arqueologico-chankillo-c8aa657c9e734a3486a509225f369dcd
Es un modelo fotogramétrico (246.449 triángulos) del cerro con sus tres murallas, los dos edificios circulares y el
rectangular. Viene sin posición, sin orientación y algo inclinado. Cambios hechos aquí:
  · ENCAJE EN PLANTA: tres puntos (los centros de los dos edificios circulares y del rectangular) leídos en el mapa
    del centro monumental de Ghezzi y Ruggles (2006, Boletín de Arqueología PUCP 10, UTM 17S WGS84) → giro, escala
    (0,981) y posición. Margen: unos metros.
  · NIVELADO: el modelo venía inclinado unos 7°; se gira hasta que su terreno coincide con el modelo de elevación
    (rejilla de 10 m de /api/elevation, guardada en scripts/data/chankillo-dem.json) y se pone a su cota.
  · SIMPLIFICACIÓN a unos 104.000 triángulos, todos de clase 1 (terreno); cada cara
    guarda el tono (claro u oscuro) de la fotografía del modelo en ese punto: el byte de cada cara es clase + 4 · tono (0–63).
  · MURALLAS como muros (clase 0): donde la maqueta muestra un muro (cresta o escalón), por su eje va un muro de
    caras planas con el alto que mide la maqueta (wall_ribbons). Donde no lo muestra, no se dibuja.
  · FALDÓN de 8 m bajo el borde, para que no se vea por debajo donde el relieve de fuera queda más bajo.
Uso: python3 scripts/build_chankillo_templo.py modelo.glb   (necesita numpy, scipy y fast_simplification)
"""
import json, math, struct, sys, os
import numpy as np
from scipy import ndimage
import fast_simplification

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "data", "chankillo-templo.bin")
DEM = os.path.join(HERE, "data", "chankillo-dem.json")     # { e0, n0, step, half, h: [[...]] } en UTM 17S
BASE_M = 200.0            # las alturas del archivo van referidas a esta cota
U = 0.02                  # unidad del archivo: 2 cm
TARGET = 104000
# puntos de control: (x, z) del modelo → (E, N) UTM 17S leídos en el mapa (píxel → m: 700 m cada 378 px)
CTRL_MODEL = np.array([[16.2, -86.7], [-34.8, -85.2], [-81.3, -56.7]])
CTRL_UTM = np.array([[803450.0, 8942411.0], [803427.8, 8942368.5], [803429.6, 8942313.0]])
ORIGIN_UTM = (803432.5, 8942369.0)    # origen del archivo (centro del templo); su latitud y longitud, en monuments.js

def load_glb(path):
    f = open(path, "rb"); f.read(12); cl, _ = struct.unpack("<II", f.read(8)); j = json.loads(f.read(cl)); bl, _ = struct.unpack("<II", f.read(8)); B = f.read(bl)
    def acc(i):
        a = j["accessors"][i]; bv = j["bufferViews"][a["bufferView"]]; off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[a["type"]]; dt = {5126: "<f4", 5125: "<u4", 5123: "<u2"}[a["componentType"]]
        st = bv.get("byteStride", 0); sz = np.dtype(dt).itemsize * n
        if st and st != sz: return np.frombuffer(B, np.uint8, st * a["count"], off).reshape(a["count"], st)[:, :sz].copy().view(dt).reshape(a["count"], n)
        return np.frombuffer(B, dt, a["count"] * n, off).reshape(a["count"], n)
    M = np.array(j["nodes"][0]["matrix"]).reshape(4, 4).T
    from PIL import Image
    import io
    imgs = []
    for im in j["images"]:
        bv = j["bufferViews"][im["bufferView"]]; o0 = bv.get("byteOffset", 0); imgs.append(np.asarray(Image.open(io.BytesIO(B[o0:o0 + bv["byteLength"]])).convert("L"), dtype=float))
    V, F, Lum, base = [], [], [], 0
    for m in j["meshes"]:
        for p in m["primitives"]:
            v = (M[:3, :3] @ acc(p["attributes"]["POSITION"]).astype(float).T).T; uv = acc(p["attributes"]["TEXCOORD_0"])
            T = imgs[j["textures"][j["materials"][p["material"]]["pbrMetallicRoughness"]["baseColorTexture"]["index"]]["source"]]
            x = np.clip((uv[:, 0] % 1) * T.shape[1], 0, T.shape[1] - 1).astype(int); y = np.clip((uv[:, 1] % 1) * T.shape[0], 0, T.shape[0] - 1).astype(int)
            V.append(v); Lum.append(T[y, x]); F.append(acc(p["indices"]).reshape(-1, 3).astype(np.int64) + base); base += len(v)
    return np.vstack(V), np.vstack(F), np.concatenate(Lum)

def weld(V, F, q=0.01):
    key = np.round(V / q).astype(np.int64); _, idx, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    F2 = inv.reshape(-1)[F]; ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])
    return V[idx], F2[ok], idx

def fit_plan(mod, utm):
    A, B = [], []
    for (x, z), (E, N) in zip(mod, utm):
        u, v = x, -z; A.append([u, -v, 1, 0]); B.append(E); A.append([v, u, 0, 1]); B.append(N)
    return np.linalg.lstsq(np.array(A), np.array(B), rcond=None)[0]

def wall_ribbons(Vs, Fs, R=0.5):
    """Las murallas, como muros: dónde hay muro lo dice la propia maqueta (crestas de más de 0,6 m sobre el suelo de
    alrededor o escalones de más de 37°); se saca su eje, y por él va un muro de caras planas con el alto que mide la
    maqueta en cada punto. No se inventa ninguno: donde la maqueta no muestra muro, no se dibuja.
    → (vértices, caras) que se añaden a la malla con clase 0 (muro)."""
    import warnings; warnings.filterwarnings("ignore")
    from skimage.morphology import skeletonize, convex_hull_image, remove_small_objects
    e0, n0 = Vs[:, 0].min(), Vs[:, 1].min(); W = int((Vs[:, 0].max() - e0) / R) + 2; H = int((Vs[:, 1].max() - n0) / R) + 2
    Z = np.full((H, W), -1e9); tri = Vs[Fs]; rs = np.random.RandomState(0)
    for k in range(14):
        u = rs.rand(len(Fs)); v = rs.rand(len(Fs)); m = u + v > 1; u[m] = 1 - u[m]; v[m] = 1 - v[m]
        p = tri[:, 0] + (tri[:, 1] - tri[:, 0]) * u[:, None] + (tri[:, 2] - tri[:, 0]) * v[:, None]
        np.maximum.at(Z, (((p[:, 1] - n0) / R).astype(int), ((p[:, 0] - e0) / R).astype(int)), p[:, 2])
    has = Z > -1e8; Z = Z[tuple(ndimage.distance_transform_edt(~has, return_distances=False, return_indices=True))]
    near = ndimage.distance_transform_edt(~has) < 3; Z = ndimage.median_filter(Z, 3)
    rel = Z - ndimage.grey_opening(ndimage.median_filter(Z, 5), size=(25, 25)); gy, gx = np.gradient(ndimage.gaussian_filter(Z, 1.0), R); sl = np.hypot(gx, gy)
    ridge = remove_small_objects(rel > 1.0, 200); lab, nl = ndimage.label(ridge, np.ones((3, 3))); sz = ndimage.sum(ridge, lab, range(1, nl + 1))
    hull = ndimage.binary_dilation(convex_hull_image(np.isin(lab, 1 + np.argsort(sz)[-3:])), iterations=6) & ndimage.binary_erosion(near, iterations=10)
    m = ((rel > 0.6) | (sl > 0.75)) & hull
    m = remove_small_objects(ndimage.binary_opening(ndimage.binary_closing(m, iterations=2), iterations=1), 160)
    half = ndimage.distance_transform_edt(m) * R                 # medio ancho del muro en su eje
    sk = skeletonize(m)
    # eje → grafo de píxeles; se podan los ramales cortos y se sacan las líneas entre nudos
    N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    px = set(map(tuple, np.argwhere(sk)))
    nb = lambda q: [(q[0] + a, q[1] + b) for a, b in N8 if (q[0] + a, q[1] + b) in px]
    for _ in range(3):                                           # poda de ramales de menos de 6 m
        for q in [q for q in px if len(nb(q)) == 1]:
            path = [q]; cur = q
            while True:
                nx = [t for t in nb(cur) if t not in path]
                if len(nx) != 1 or len(nb(nx[0])) > 2: break
                cur = nx[0]; path.append(cur)
                if len(path) > 12 / R: break
            if len(path) <= 6 / R and len([t for t in nb(cur) if t not in path]) >= 1:
                for t in path: px.discard(t)
    deg = {q: len(nb(q)) for q in px}; nodes = {q for q in px if deg[q] != 2}; seen = set(); lines = []
    def walk(a, b):
        path = [a, b]; seen.add((a, b)); seen.add((b, a))
        while path[-1] not in nodes:
            nx = [t for t in nb(path[-1]) if t != path[-2]]
            if not nx: break
            # (en un píxel de paso, se sigue por el vecino que no sea contiguo al anterior)
            nx.sort(key=lambda t: -(abs(t[0] - path[-2][0]) + abs(t[1] - path[-2][1])))
            if (path[-1], nx[0]) in seen: break
            seen.add((path[-1], nx[0])); seen.add((nx[0], path[-1])); path.append(nx[0])
            if path[-1] == a: break
        return path
    for a in nodes:
        for b in nb(a):
            if (a, b) not in seen: lines.append(walk(a, b))
    for a in px:                                                 # anillos sin nudos
        if a not in nodes and not any((a, b) in seen for b in nb(a)): b = nb(a)[0]; lines.append(walk(a, b))
    def rdp(P, eps):
        if len(P) < 3: return P
        a, b = P[0], P[-1]; d = b - a; L = np.hypot(*d)
        dist = np.abs(d[0] * (P[:, 1] - a[1]) - d[1] * (P[:, 0] - a[0])) / L if L > 1e-9 else np.hypot(P[:, 0] - a[0], P[:, 1] - a[1])
        i = int(np.argmax(dist))
        return np.vstack([rdp(P[:i + 1], eps)[:-1], rdp(P[i:], eps)]) if dist[i] > eps else np.array([a, b])
    samp = lambda A, y, x: ndimage.map_coordinates(A, [y, x], order=1, mode="nearest")
    Zmax = ndimage.maximum_filter(Z, 5); Zmin = ndimage.minimum_filter(Z, 13)
    OV, OF, total = [], [], 0.0
    for ln in lines:
        P = np.array(ln, float)[:, ::-1]                         # (x, y) en píxeles
        if (len(P) - 1) * R < 7: continue
        P = rdp(P, 0.35 / R)
        # nudos cada 3 m como mucho
        Q = [P[0]]
        for a, b in zip(P[:-1], P[1:]):
            k = max(1, int(np.ceil(np.hypot(*(b - a)) * R / 3.0)))
            for i in range(1, k + 1): Q.append(a + (b - a) * i / k)
        Q = np.array(Q); closed = np.hypot(*(Q[0] - Q[-1])) < 2
        top = samp(Zmax, Q[:, 1], Q[:, 0]); low = samp(Zmin, Q[:, 1], Q[:, 0]); hw = np.clip(samp(half, Q[:, 1], Q[:, 0]) * 0.8, 0.5, 2.2)
        if len(Q) >= 5: top = ndimage.median_filter(top, 3, mode="nearest"); hw = ndimage.uniform_filter1d(hw, 5, mode="nearest")
        if np.median(top - low) < 0.7: continue
        T = np.gradient(Q, axis=0); T /= np.maximum(np.hypot(T[:, 0], T[:, 1]), 1e-9)[:, None]; Nn = np.c_[-T[:, 1], T[:, 0]]
        b0 = len(OV)
        for q, nn, t, l, w in zip(Q, Nn, top, low, hw):
            for sgn in (1, -1):
                x, y = (q + sgn * nn * w / R) * R + [e0, n0]; OV.append([x, y, t + 0.12]); OV.append([x, y, l - 0.8])
        for i in range(len(Q) - 1):
            a = b0 + 4 * i; LT, LB, RT, RB, LT2, LB2, RT2, RB2 = a, a + 1, a + 2, a + 3, a + 4, a + 5, a + 6, a + 7
            OF += [[LT, LB, LB2], [LT, LB2, LT2], [RT, RB2, RB], [RT, RT2, RB2], [LT, LT2, RT2], [LT, RT2, RT]]
            total += np.hypot(*(Q[i + 1] - Q[i])) * R
        if not closed:
            for a in (b0, b0 + 4 * (len(Q) - 1)): OF += [[a, a + 2, a + 3], [a, a + 3, a + 1]]
    print("murallas: %d líneas, %.0f m de muro, %d vértices, %d caras" % (len(lines), total, len(OV), len(OF)))
    return np.array(OV), np.array(OF, np.int64)

def main(path):
    V, F, Lum = load_glb(path); V, F, keep = weld(V, F); Lum = Lum[keep]; print("modelo:", len(V), "vértices,", len(F), "triángulos")
    a, b, te, tn = fit_plan(CTRL_MODEL, CTRL_UTM); sc = math.hypot(a, b); print("escala %.4f, giro %.2f°" % (sc, math.degrees(math.atan2(b, a))))
    # (x, −z) son los ejes derecha/arriba de la planta del modelo; y, su alto
    E = a * V[:, 0] - b * (-V[:, 2]) + te - ORIGIN_UTM[0]; N = b * V[:, 0] + a * (-V[:, 2]) + tn - ORIGIN_UTM[1]; H = V[:, 1] * sc
    P = np.c_[E, N, H]
    d = json.load(open(DEM)); D = np.array(d["h"]); step, half = d["step"], d["half"]; de0, dn0 = d["e0"] - ORIGIN_UTM[0], d["n0"] - ORIGIN_UTM[1]
    dem = lambda e, n: ndimage.map_coordinates(D, [(n - dn0 + half) / step, (e - de0 + half) / step], order=1, mode="nearest")
    rs = np.random.RandomState(1).choice(len(P), 30000, replace=False)
    def plane(Q):
        r = dem(Q[rs, 0], Q[rs, 1]) - Q[rs, 2]; A = np.c_[Q[rs, 0], Q[rs, 1], np.ones(len(rs))]; k = np.linalg.lstsq(A, r, rcond=None)[0]; return k, float(np.mean(np.abs(r - A @ k)))
    # nivelado: se gira (alrededor del centro) hasta que no quede inclinación respecto al modelo de elevación
    c0 = P.mean(0)
    for it in range(6):
        k, res = plane(P); g = math.hypot(k[0], k[1]); print("  inclinación restante %.2f° (residuo %.2f m)" % (math.degrees(math.atan(g)), res))
        if g < 1e-4: break
        ax = np.array([-k[1], k[0], 0.0]) / g; th = math.atan(g)
        K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]]); R = np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K
        Q = (R @ (P - c0).T).T + c0
        if plane(Q)[0][0] ** 2 + plane(Q)[0][1] ** 2 > g * g: R = R.T; Q = (R @ (P - c0).T).T + c0
        P = Q
    k, res = plane(P); P[:, 2] += k[2]; print("cota: +%.1f m; residuo contra el modelo de elevación %.2f m; alturas %.1f–%.1f m" % (k[2], res, P[:, 2].min(), P[:, 2].max()))
    # los puntos de control, ya en su sitio (para los puntos de visita)
    for name, (x, z) in zip(["círculo norte", "círculo sur", "edificio rectangular"], CTRL_MODEL):
        i = np.argmin((V[:, 0] - x) ** 2 + (V[:, 2] - z) ** 2); print("  %s: e %.1f, n %.1f, %.1f m" % (name, P[i, 0], P[i, 1], P[i, 2]))
    Vs, Fs = fast_simplification.simplify(P.astype(np.float32), F.astype(np.int32), target_count=TARGET); Vs = Vs.astype(float); Fs = Fs.astype(np.int64)
    # caras hacia arriba (el suelo se pisa); clase por pendiente
    n = np.cross(Vs[Fs[:, 1]] - Vs[Fs[:, 0]], Vs[Fs[:, 2]] - Vs[Fs[:, 0]]); L = np.linalg.norm(n, axis=1); ok = L > 1e-9; Fs, n, L = Fs[ok], n[ok], L[ok]
    if np.sum(n[:, 2] * L) < 0: Fs = Fs[:, ::-1]; n = -n
    cls = np.ones(len(Fs), np.uint8)             # la maqueta entera es terreno (1); los muros (0) se añaden después
    # tono de la fotografía en cada cara: el del vértice original más cercano a su centro, suavizado y llevado a 0–63
    from scipy.spatial import cKDTree
    cen = Vs[Fs].mean(1); dd, ii = cKDTree(P).query(cen, k=6); lum = Lum[ii].mean(1)
    lo, hi = np.percentile(lum, [2, 98]); tone = np.clip(np.round((lum - lo) / (hi - lo) * 63), 0, 63).astype(np.uint8)
    # faldón bajo el borde
    ed = {}
    for t, (i, j, l) in enumerate(Fs):
        for p, q in ((i, j), (j, l), (l, i)): ed.setdefault((min(p, q), max(p, q)), []).append((p, q))
    bnd = [v[0] for v in ed.values() if len(v) == 1]; low = {}; Vl = list(Vs); Fl = list(Fs); cl = list(cls)
    for p, q in bnd:
        for i in (p, q):
            if i not in low: low[i] = len(Vl); Vl.append(Vs[i] - np.array([0, 0, 8.0]))
        Fl.append([p, low[p], low[q]]); Fl.append([p, low[q], q]); cl += [1, 1]
    tone = np.concatenate([tone, np.full(len(Fl) - len(tone), 32, np.uint8)])
    Vs = np.array(Vl); Fs = np.array(Fl); cls = np.array(cl, np.uint8)
    # las murallas, como muros de caras planas sobre su eje (clase 0), con tono neutro
    WV, WF = wall_ribbons(Vs[:len(Vs) - len(low)], Fs[:len(Fs) - 2 * len(bnd)])
    Fs = np.vstack([Fs, WF + len(Vs)]); Vs = np.vstack([Vs, WV]); cls = np.concatenate([cls, np.zeros(len(WF), np.uint8)]); tone = np.concatenate([tone, np.full(len(WF), 40, np.uint8)])
    assert len(Vs) < 65536, len(Vs)
    q = np.c_[Vs[:, 0] / U, Vs[:, 1] / U, (Vs[:, 2] - BASE_M) / U]; assert np.abs(q).max() < 32767, np.abs(q).max()
    with open(OUT, "wb") as f:
        f.write(struct.pack("<II", len(Vs), len(Fs))); f.write(np.round(q).astype("<i2").tobytes()); f.write(Fs.astype("<u2").tobytes()); f.write((cls + 4 * tone).astype(np.uint8).tobytes())
    print("escrito %s: %d vértices, %d triángulos (%d de muro), %.2f MB; borde: %d aristas" % (os.path.relpath(OUT), len(Vs), len(Fs), int((cls == 0).sum()), os.path.getsize(OUT) / 1e6, len(bnd)))
    np.save("/tmp/chk-work/final-V.npy", Vs); np.save("/tmp/chk-work/final-F.npy", Fs); np.save("/tmp/chk-work/final-c.npy", cls)

if __name__ == "__main__":
    main(sys.argv[1])
