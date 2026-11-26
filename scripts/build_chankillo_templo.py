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
  · MURALLAS como muros (clase 0): donde la maqueta muestra un muro (cresta de más de 0,45 m o escalón de más de 32°), por su eje va un muro de
    caras planas con el alto que mide la maqueta (walls_and_floors). Donde no lo muestra, no se dibuja.
  · COMPLETADAS con la misma lógica: las tres murallas, el muro que rodea los edificios y los dos edificios circulares son
    anillos cerrados; donde a uno le falta un arco, se completa siguiendo su radio a ambos lados, con su alto y su ancho.
    El edificio rectangular: se cierran los lados que faltan y sus tabiques se completan entre los tramos visibles.
    Los huecos de menos de 3,5 m quedan: pueden ser puertas.
  · SUELO LIMPIO: los montículos de escombro (derrumbes de menos de 6 m de ancho) se rebajan hasta el suelo de
    alrededor, salvo bajo los muros; las terrazas y la ladera quedan como están.
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

def walls_and_floors(Vs, Fs, R=0.5, debug=None):
    """Las murallas, como muros, y el suelo entre ellas, limpio.
    · Dónde hay muro lo dice la propia maqueta: crestas de más de 0,45 m sobre el suelo de alrededor o escalones de más
      de 32°, dentro del recinto (el contorno de la muralla exterior). Se saca su eje, y por él va un muro de caras
      planas con el alto que la maqueta mide en cada punto. Donde la maqueta no muestra muro, no se dibuja.
    · SUELO LIMPIO: los montículos de escombro (lo que sobresale menos de 6 m de ancho: muros caídos, derrumbes) se
      rebajan hasta el suelo de alrededor (apertura morfológica), salvo bajo los muros. Las terrazas y la ladera quedan.
    → (Vs con el suelo rebajado, cuánto bajó cada vértice, vértices y caras de los muros)."""
    import warnings; warnings.filterwarnings("ignore")
    from skimage.morphology import skeletonize, convex_hull_image, remove_small_objects, disk
    from skimage.draw import disk as draw_disk
    e0, n0 = Vs[:, 0].min(), Vs[:, 1].min(); W = int((Vs[:, 0].max() - e0) / R) + 2; H = int((Vs[:, 1].max() - n0) / R) + 2
    Z = np.full((H, W), -1e9); tri = Vs[Fs]; rs = np.random.RandomState(0)
    for k in range(14):
        u = rs.rand(len(Fs)); v = rs.rand(len(Fs)); m = u + v > 1; u[m] = 1 - u[m]; v[m] = 1 - v[m]
        p = tri[:, 0] + (tri[:, 1] - tri[:, 0]) * u[:, None] + (tri[:, 2] - tri[:, 0]) * v[:, None]
        np.maximum.at(Z, (((p[:, 1] - n0) / R).astype(int), ((p[:, 0] - e0) / R).astype(int)), p[:, 2])
    has = Z > -1e8; Z = Z[tuple(ndimage.distance_transform_edt(~has, return_distances=False, return_indices=True))]
    near = ndimage.distance_transform_edt(~has) < 3; Z = ndimage.median_filter(Z, 3)
    # el suelo sin escombros: apertura con un disco de 6 m de diámetro, suavizada
    floor = ndimage.gaussian_filter(ndimage.grey_opening(ndimage.median_filter(Z, 5), footprint=disk(int(3.0 / R))), 1.5)
    rel = Z - ndimage.grey_opening(ndimage.median_filter(Z, 5), size=(25, 25)); gy, gx = np.gradient(ndimage.gaussian_filter(Z, 1.0), R); sl = np.hypot(gx, gy)
    # el recinto: el contorno de las crestas grandes que no tocan el borde de la maqueta (allí la ladera no es muro)
    inner = ndimage.binary_erosion(near, iterations=int(12 / R))
    ridge = remove_small_objects(rel > 1.0, 200); lab, nl = ndimage.label(ridge, np.ones((3, 3)))
    sz = ndimage.sum(ridge, lab, range(1, nl + 1)); inside = ndimage.maximum(inner, lab, range(1, nl + 1))
    keepc = [i + 1 for i in range(nl) if sz[i] > 400 and inside[i]]
    hull = ndimage.binary_dilation(convex_hull_image(np.isin(lab, keepc)), iterations=int(5 / R)) & ndimage.binary_erosion(near, iterations=int(4 / R))
    m = ((rel > float(os.environ.get("CHK_REL", 0.45))) | (sl > float(os.environ.get("CHK_SL", 0.62)))) & hull
    m = remove_small_objects(ndimage.binary_opening(ndimage.binary_closing(m, iterations=2), iterations=1), 160)
    half = ndimage.distance_transform_edt(m) * R                 # medio ancho del muro en su eje
    sk = skeletonize(m)
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
    Zmax = ndimage.maximum_filter(Z, 5)
    curves = []
    for ln in lines:
        P = np.array(ln, float)[:, ::-1]                         # (x, y) en píxeles
        if (len(P) - 1) * R < 7: continue
        P = rdp(P, 0.35 / R)
        Q = [P[0]]
        for a, b in zip(P[:-1], P[1:]):
            k = max(1, int(np.ceil(np.hypot(*(b - a)) * R / 3.0)))
            for i in range(1, k + 1): Q.append(a + (b - a) * i / k)
        Q = np.array(Q); closed = np.hypot(*(Q[0] - Q[-1])) < 2
        top = samp(Zmax, Q[:, 1], Q[:, 0]); low = samp(floor, Q[:, 1], Q[:, 0]); hw = np.clip(samp(half, Q[:, 1], Q[:, 0]) * 0.8, 0.5, 2.2)
        if len(Q) >= 5: top = ndimage.median_filter(top, 3, mode="nearest"); hw = ndimage.uniform_filter1d(hw, 5, mode="nearest")
        if np.median(top - low) < 0.7: continue
        curves.append({"Q": Q, "h": np.maximum(top - low, 0.7), "hw": hw, "closed": closed, "fill": False})
    # COMPLETAR con la misma lógica: las tres murallas, el muro que rodea los edificios y los dos edificios circulares
    # son anillos cerrados. Cada anillo se sigue alrededor de su centro (su radio en cada acimut, de grado en grado,
    # tomando el muro detectado más cercano al radio que traía); donde falta un arco, se completa interpolando el radio
    # entre los dos lados, con el alto y el ancho de los extremos. Los huecos de menos de 3,5 m quedan: pueden ser puertas.
    pts = np.vstack([c["Q"] for c in curves]); ph = np.concatenate([c["h"] for c in curves]); pw = np.concatenate([c["hw"] for c in curves])
    axis0 = np.zeros(m.shape, bool)
    for q in pts.astype(int): axis0[min(max(q[1], 0), m.shape[0] - 1), min(max(q[0], 0), m.shape[1] - 1)] = True
    dax = ndimage.distance_transform_edt(~ndimage.binary_dilation(axis0, iterations=2)) * R + 1.0
    from scipy.spatial import cKDTree
    tree = cKDTree(pts)
    def ring(cen, r0, a0, tol=3.0, maxgap=100):
        c = np.array([(cen[0] - e0) / R, (cen[1] - n0) / R]); d = (pts - c) * R; th = (np.degrees(np.arctan2(d[:, 0], d[:, 1])) + 360) % 360; rr = np.hypot(*d.T)
        NB = 360; rk = np.full(NB, np.nan); last = r0; trend = 0.0; miss = 0
        for step in range(NB):
            b = (a0 + step) % NB; sel = (np.abs(((th - b + 180) % 360) - 180) < 0.6) & (np.abs(rr - last) < tol + 0.04 * miss)
            if sel.any():
                r_ = rr[sel][np.argmin(np.abs(rr[sel] - last))]; rk[b] = r_; trend = 0.7 * trend + 0.3 * (r_ - last) if miss == 0 else 0.0; last = r_; miss = 0
            else: miss += 1; last += trend * 0.5
        ok = ~np.isnan(rk)
        if ok.sum() < 90: return [], ok.mean(), None
        idx = np.arange(NB); rf = np.interp(idx, idx[ok], rk[ok], period=NB)
        rf = ndimage.uniform_filter1d(rf, 3, mode="wrap")
        P = c + np.c_[np.sin(np.radians(idx)), np.cos(np.radians(idx))] * rf[:, None] / R
        have = samp(dax, P[:, 1], P[:, 0]) < 2.5
        out = []
        if have.all(): return out, ok.mean(), P
        k0 = int(np.argmax(have)); order = (np.arange(NB) + k0) % NB; run = []
        for b in list(order) + [order[0]]:
            if not have[b]: run.append(b); continue
            if run:
                if len(run) <= maxgap:
                    seg = [(run[0] - 1) % NB] + run + [b]; Q = P[seg]; L = np.hypot(*np.diff(Q, axis=0).T).sum() * R
                    if L >= 3.5 + 2 * rf[run[0]] * math.radians(1):
                        _, ia = tree.query(Q[0]); _, ib = tree.query(Q[-1]); s_ = np.linspace(0, 1, len(Q))
                        out.append({"Q": Q, "h": ph[ia] + (ph[ib] - ph[ia]) * s_, "hw": pw[ia] + (pw[ib] - pw[ia]) * s_, "closed": False, "fill": True})
                run = []
        return out, ok.mean(), P
    # centro del recinto y de los dos edificios circulares (en m desde el origen del archivo), y radio de partida por el oeste
    C0 = (0.0, -10.0)
    def r_at(cen, az, lo, hi):
        c = np.array([(cen[0] - e0) / R, (cen[1] - n0) / R]); d = (pts - c) * R; th = (np.degrees(np.arctan2(d[:, 0], d[:, 1])) + 360) % 360; rr = np.hypot(*d.T)
        sel = (np.abs(((th - az + 180) % 360) - 180) < 3) & (rr > lo) & (rr < hi)
        return sorted(rr[sel])
    bridges = []
    west = r_at(C0, 270, 40, 140); groups = []
    for r_ in west:
        if not groups or r_ - groups[-1][-1] > 6: groups.append([r_])
        else: groups[-1].append(r_)
    # (cada grupo se sigue alrededor; es un anillo si se encuentra muro en más de la mitad de los acimuts: así quedan
    # fuera las puertas con sus parapetos, que también cortan el radio oeste)
    # (y no repite uno ya seguido: si su recorrido va a menos de 6 m de otro anillo, es el mismo)
    taken = []
    for g in groups:
        if len(g) < 2: continue
        f_, cov, P_ = ring(C0, float(np.median(g)), 270)
        # (el muro que rodea los edificios es alargado, no centrado: su radio cambia deprisa; se sigue con más margen)
        if cov < 0.5: f_, cov, P_ = ring(C0, float(np.median(g)), 270, tol=6.0)
        dup = P_ is not None and any(np.median(np.hypot(*(P_ - T_).T)) * R < 6 for T_ in taken)
        print("  radio %.0f m: muro en el %.0f %% de los acimuts%s" % (np.median(g), cov * 100, " (no es un anillo)" if cov < 0.5 else " (repetido)" if dup else ""))
        if cov >= 0.5 and not dup: bridges += f_; taken.append(P_)
    for cen in ((-3.2, -2.0), (19.5, 42.2)):                      # los dos edificios circulares
        rs_ = r_at(cen, 270, 4, 26); gr = []
        for r_ in rs_:
            if not gr or r_ - gr[-1][-1] > 3: gr.append([r_])
            else: gr[-1].append(r_)
        for g in gr:
            f_, cov, _ = ring(cen, float(np.median(g)), 270, tol=2.0, maxgap=180)
            if cov >= 0.5: bridges += f_
    # el edificio rectangular: un rectángulo con tabiques paralelos a sus lados. Se mide su orientación y su contorno con
    # los muros que se ven; se cierran los lados que faltan y los tabiques se completan entre sus tramos visibles
    # (y hasta el lado más cercano, si queda a menos de 8 m)
    def fillline(A, B, step=1.0):
        n = max(2, int(np.hypot(*(B - A)) * R / step) + 1); Q = A + (B - A) * np.linspace(0, 1, n)[:, None]
        have = samp(dax, Q[:, 1], Q[:, 0]) < 2.0; out = []; run = []
        for k in list(range(n)) + [None]:
            if k is not None and not have[k]: run.append(k); continue
            if run and (len(run) + 1) * step >= 3.5:
                seg = Q[max(run[0] - 1, 0): min(run[-1] + 2, n)]; _, ia = tree.query(seg[0]); _, ib = tree.query(seg[-1]); s_ = np.linspace(0, 1, len(seg))
                out.append({"Q": seg, "h": ph[ia] + (ph[ib] - ph[ia]) * s_, "hw": pw[ia] + (pw[ib] - pw[ia]) * s_, "closed": False, "fill": True})
            run = []
        return out
    Bc = np.array([(-1.1 - e0) / R, (-55.8 - n0) / R]); allT = np.vstack([np.gradient(c["Q"], axis=0) for c in curves[:len(curves) - len(bridges)]])
    allQ = np.vstack([c["Q"] for c in curves[:len(curves) - len(bridges)]]); allT /= np.maximum(np.hypot(*allT.T), 1e-9)[:, None]
    sel = np.hypot(*(allQ - Bc).T) * R < 18; Pb, Tb = allQ[sel], allT[sel]
    # orientación: la de los muros rectos que se ven (el ángulo con más tangentes alineadas)
    ang_ = np.degrees(np.arctan2(Tb[:, 1], Tb[:, 0])) % 90; hist_a = np.histogram(ang_, bins=90, range=(0, 90))[0]
    hist_a = ndimage.uniform_filter1d(hist_a.astype(float), 5, mode="wrap"); A_ = math.radians(int(np.argmax(hist_a)) + 0.5)
    u = np.array([math.cos(A_), math.sin(A_)]); v = np.array([-u[1], u[0]])
    # sus muros más gastados (la mitad sureste apenas sobresale): un relieve local más fino, solo alrededor del edificio
    yy0, xx0 = np.mgrid[0:m.shape[0], 0:m.shape[1]]; around = np.hypot(xx0 - Bc[0], yy0 - Bc[1]) * R < 26
    relL = Z - ndimage.grey_opening(ndimage.median_filter(Z, 3), size=(15, 15))
    mL = remove_small_objects(ndimage.binary_opening((relL > 0.3) & around, iterations=1), 30); skL = skeletonize(mL); PL = np.argwhere(skL)[:, ::-1].astype(float)
    rect = 0; ext = {}
    def lines_along(ax_, other):
        po, pa = PL @ other, PL @ ax_; out = []
        hist, edges = np.histogram(po, bins=np.arange(po.min(), po.max() + 1, 1.0))
        hist = ndimage.uniform_filter1d(hist.astype(float), 3)
        for i in range(len(hist)):
            if hist[i] < 0.6 * 8 / R or hist[i] < hist[max(0, i - 3): i + 4].max(): continue
            c_ = (edges[i] + edges[i + 1]) / 2; on = np.sort(pa[np.abs(po - c_) < 1.0 / R])
            # (el tramo recto más largo, sin huecos de más de 4 m)
            br = np.where(np.diff(on) > 4 / R)[0]; parts = np.split(on, br + 1); best_ = max(parts, key=lambda q: q[-1] - q[0])
            if (best_[-1] - best_[0]) * R >= 8: out.append((c_, best_[0], best_[-1]))
        return out
    Lu, Lv = lines_along(u, v), lines_along(v, u)
    if Lu and Lv:
        vlo, vhi = min(l[0] for l in Lu), max(l[0] for l in Lu); ulo, uhi = min(l[0] for l in Lv), max(l[0] for l in Lv)
        for (ax_, other, Ls, lo_a, hi_a, lo_o, hi_o) in ((u, v, Lu, ulo, uhi, vlo, vhi), (v, u, Lv, vlo, vhi, ulo, uhi)):
            for c_, a0, a1 in Ls:
                edge = abs(c_ - lo_o) < 1.5 / R or abs(c_ - hi_o) < 1.5 / R
                if edge: a0, a1 = lo_a, hi_a
                else:
                    a0 = lo_a if a0 - lo_a < 8 / R else a0; a1 = hi_a if hi_a - a1 < 8 / R else a1
                A0, A1 = ax_ * a0 + other * c_, ax_ * a1 + other * c_
                add = fillline(A0, A1)
                for c2 in add:                                     # su alto, el que mide la maqueta (al menos 0,7 m)
                    hh = samp(Zmax, c2["Q"][:, 1], c2["Q"][:, 0]) - samp(floor, c2["Q"][:, 1], c2["Q"][:, 0])
                    c2["h"] = np.maximum(ndimage.uniform_filter1d(hh, 5, mode="nearest"), 0.7); c2["hw"] = np.full(len(c2["Q"]), 0.7)
                bridges += add; rect += len(add)
        ext = ((uhi - ulo) * R, (vhi - vlo) * R)
    print("edificio rectangular: %s, %d tramos completados" % ("%.0f × %.0f m" % ext if ext else "sin medir", rect))
    curves += bridges; used = ()
    OV, OF, total, filled = [], [], 0.0, 0.0; foot = np.zeros_like(m); axis = np.zeros(m.shape, np.uint8)
    for c in curves:
        Q, h, hw, closed = c["Q"], c["h"], c["hw"], c["closed"]
        low = samp(floor, Q[:, 1], Q[:, 0])
        T = np.gradient(Q, axis=0); T /= np.maximum(np.hypot(T[:, 0], T[:, 1]), 1e-9)[:, None]; Nn = np.c_[-T[:, 1], T[:, 0]]
        # (bajo el muro, el suelo limpio de los dos lados: el más bajo; la coronación, a su alto sobre el suelo del eje)
        pL = Q + Nn * (hw[:, None] / R + 3); pR = Q - Nn * (hw[:, None] / R + 3)
        base = np.minimum(low, np.minimum(samp(floor, pL[:, 1], pL[:, 0]), samp(floor, pR[:, 1], pR[:, 0])))
        top = low + h
        b0 = len(OV)
        for q, nn, t, l, w in zip(Q, Nn, top, base, hw):
            for sgn in (1, -1):
                x, y = (q + sgn * nn * w / R) * R + [e0, n0]; OV.append([x, y, t + 0.12]); OV.append([x, y, l - 0.6])
        for i in range(len(Q) - 1):
            a = b0 + 4 * i; LT, LB, RT, RB, LT2, LB2, RT2, RB2 = a, a + 1, a + 2, a + 3, a + 4, a + 5, a + 6, a + 7
            OF += [[LT, LB, LB2], [LT, LB2, LT2], [RT, RB2, RB], [RT, RT2, RB2], [LT, LT2, RT2], [LT, RT2, RT]]
            L = np.hypot(*(Q[i + 1] - Q[i])); total += L * R; filled += L * R if c["fill"] else 0
            for f in np.linspace(0, 1, max(2, int(L * R / 0.25))):   # su huella, para no rebajar el suelo bajo el muro
                cc_ = Q[i] + (Q[i + 1] - Q[i]) * f; w = hw[i] + (hw[i + 1] - hw[i]) * f
                rr, cc = draw_disk((cc_[1], cc_[0]), w / R + 0.6 / R, shape=foot.shape); foot[rr, cc] = True
                yy_, xx_ = int(round(cc_[1])), int(round(cc_[0]))
                if 0 <= yy_ < axis.shape[0] and 0 <= xx_ < axis.shape[1]: axis[yy_, xx_] = 1 if not c["fill"] else 2
        if not closed:
            for a in (b0, b0 + 4 * (len(Q) - 1)): OF += [[a, a + 2, a + 3], [a, a + 3, a + 1]]
    print("tramos completados: %d (%.0f m)" % (len(bridges), filled))
    # el suelo, rebajado donde sobresale sobre el suelo limpio (fuera de la huella de los muros y dentro del recinto)
    yy = (Vs[:, 1] - n0) / R; xx = (Vs[:, 0] - e0) / R
    fl = samp(floor, yy, xx); inF = samp(foot.astype(float), yy, xx) > 0.5; inH = samp(ndimage.binary_dilation(hull, iterations=int(8 / R)).astype(float), yy, xx) > 0.5
    drop = np.where(~inF & inH, np.maximum(0.0, Vs[:, 2] - (fl + 0.1)), 0.0)
    V2 = Vs.copy(); V2[:, 2] -= drop
    print("murallas: %d líneas, %.0f m de muro (con los completados), %d caras; suelo limpio: %d vértices rebajados (hasta %.1f m)" % (len(lines), total, len(OF), int((drop > 0.05).sum()), drop.max()))
    if debug:
        from PIL import Image
        gy2, gx2 = np.gradient(Z, R); sh = np.clip(0.5 + 0.5 * (gx2 - gy2) / 1.5, 0, 1) * near
        img = np.stack([sh * 200] * 3, -1).astype(np.uint8); img[hull & ~m] = (img[hull & ~m] * 0.85).astype(np.uint8)
        img[foot] = (img[foot] * 0.5 + np.array([0, 60, 120])).astype(np.uint8); img[axis == 1] = (255, 255, 0); img[axis == 2] = (255, 60, 60)
        Image.fromarray(img[::-1]).save(debug)
    return V2, drop, np.array(OV), np.array(OF, np.int64)

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
    # las murallas como muros y el suelo entre ellas limpio (antes del faldón, para que el borde baje con el suelo)
    Vs, drop, WV, WF = walls_and_floors(Vs, Fs, debug="/tmp/chk-work/walls.png")
    # (el suelo limpio, de un tono más parejo: sin las manchas oscuras de los derrumbes)
    fd = drop[Fs].max(1) > 0.3; tone[fd] = np.round(40 + (tone[fd].astype(float) - 40) * 0.35).astype(np.uint8)
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
    Fs = np.vstack([Fs, WF + len(Vs)]); Vs = np.vstack([Vs, WV]); cls = np.concatenate([cls, np.zeros(len(WF), np.uint8)]); tone = np.concatenate([tone, np.full(len(WF), 40, np.uint8)])
    assert len(Vs) < 65536, len(Vs)
    q = np.c_[Vs[:, 0] / U, Vs[:, 1] / U, (Vs[:, 2] - BASE_M) / U]; assert np.abs(q).max() < 32767, np.abs(q).max()
    with open(OUT, "wb") as f:
        f.write(struct.pack("<II", len(Vs), len(Fs))); f.write(np.round(q).astype("<i2").tobytes()); f.write(Fs.astype("<u2").tobytes()); f.write((cls + 4 * tone).astype(np.uint8).tobytes())
    print("escrito %s: %d vértices, %d triángulos (%d de muro), %.2f MB; borde: %d aristas" % (os.path.relpath(OUT), len(Vs), len(Fs), int((cls == 0).sum()), os.path.getsize(OUT) / 1e6, len(bnd)))
    np.save("/tmp/chk-work/final-V.npy", Vs); np.save("/tmp/chk-work/final-F.npy", Fs); np.save("/tmp/chk-work/final-c.npy", cls)

if __name__ == "__main__":
    main(sys.argv[1])
