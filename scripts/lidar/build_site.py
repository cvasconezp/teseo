#!/usr/bin/env python3
"""Relieve LiDAR de un sitio → maqueta de terreno public/data/<sitio>-lidar.bin (el formato de las maquetas de Machu
Picchu y de Chankillo: machuModel.js).

  python3 scripts/lidar/build_site.py <sitio> [--dtm /tmp/lidar] [--api https://teseo-production.up.railway.app]

Lee /tmp/lidar/<sitio>/dtm.tif y meta.json (scripts/lidar/fetch_dtm.py) y la entrada del sitio en scripts/lidar/sites.json:
  lat, lon     origen de la maqueta (el de su pieza en la app); por defecto, el centro del recorte
  clip         radio de la maqueta (m)
  core         radio dentro del cual se guarda todo el detalle (tolerancia `tol`, m); fuera se afloja hasta `tol_out`
  remove       [[e, n, r]]: bultos que se sustituyen por el suelo de alrededor (los dibuja una pieza de la app)
  flatten      [[e, n, r, pluma]]: llanos donde van piezas que el láser no ve bien (piedras): la mediana del círculo
  probes       {nombre: [e, n]}: puntos donde informar la cota (para `absLevel` de las piezas)
  max_v        tope de vértices (≤ 60000)

Qué se hace con el dato (queda dicho en CREDITS.md y en la ficha):
  · REJILLA en metros este/norte verdaderos desde el origen (se corrige la convergencia de la proyección).
  · NIVELADO: se resta la mediana de (LiDAR − relieve global de Teseo, /api/elevation) para que la maqueta quede a la
    cota del relieve que la rodea. La FORMA no cambia: solo sube o baja entera.
  · MALLA de triángulos adaptativa (más densa donde el terreno tiene forma): error vertical menor que `tol`.
  · BORDE: en los últimos 25 m se suaviza hacia el relieve de alrededor, y lleva un faldón de 4 m por debajo.
  · TONO por cara: algo más oscuro en lo hundido (fosos) y más claro en lo que sobresale (bancos), para que el
    relieve se lea también con el Sol alto. Es un sombreado calculado, no una fotografía.
"""
import argparse, json, math, os, struct, subprocess, sys, urllib.parse
import numpy as np
from scipy import ndimage
from scipy.spatial import Delaunay
from scipy.interpolate import LinearNDInterpolator

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
U = 0.02


def api_elev(api, pts):
    out = []
    for i in range(0, len(pts), 72):
        q = ";".join("%.6f,%.6f" % (la, lo) for la, lo in pts[i:i + 72])
        r = subprocess.run(["curl", "-s", "-m", "60", f"{api}/api/elevation?pts=" + urllib.parse.quote(q, safe=",;")], capture_output=True, text=True)
        j = json.loads(r.stdout); h = j.get("heights") or j.get("h") or j.get("elevations") or j
        out += [float(v) for v in h]
    return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("site"); ap.add_argument("--dtm", default="/tmp/lidar")
    ap.add_argument("--api", default="https://teseo-production.up.railway.app"); ap.add_argument("--cfg", default=os.path.join(HERE, "sites.json"))
    a = ap.parse_args()
    import rasterio
    cfg = json.load(open(a.cfg))[a.site]; d = os.path.join(a.dtm, a.site); meta = json.load(open(os.path.join(d, "meta.json")))
    with rasterio.open(os.path.join(d, "dtm.tif")) as s: Zg = s.read(1).astype(float)
    res, n0 = meta["res"], Zg.shape[0]; half = n0 * res / 2
    lat0, lon0 = cfg.get("lat", meta["lat"]), cfg.get("lon", meta["lon"])
    mlat, mlon = 110574.0, 111320.0 * math.cos(math.radians(lat0))
    # desplazamiento del origen de la maqueta respecto al centro del recorte, en la rejilla de la proyección
    conv = math.radians(meta.get("grid_convergence_deg", 0.0)); cc, sc = math.cos(conv), math.sin(conv)
    de, dn = (lon0 - meta["lon"]) * mlon, (lat0 - meta["lat"]) * mlat          # este/norte verdaderos
    ox, oy = de * cc - dn * sc, de * sc + dn * cc                                 # → x/y de la rejilla (giro de la convergencia)
    Rc = float(cfg["clip"]); step = float(cfg.get("step", res)); m = int(round(2 * Rc / step)) + 1
    ax = np.linspace(-Rc, Rc, m); E, N = np.meshgrid(ax, ax[::-1])               # fila 0 = norte
    X = E * cc - N * sc + ox; Y = E * sc + N * cc + oy                            # verdaderos → rejilla
    col = (X + half) / res - 0.5; row = (half - Y) / res - 0.5
    fill = np.where(np.isfinite(Zg), Zg, np.nanmedian(Zg))
    Z = ndimage.map_coordinates(fill, [row, col], order=1, mode="nearest")
    R = np.hypot(E, N); inside = R <= Rc + 1e-6
    if (np.abs(col).max() > n0 + 2) or (col.min() < -2): print("AVISO: la maqueta se sale del recorte LiDAR", file=sys.stderr)
    # relieve global (el de la app) en una rejilla de 30 m, guardada en scripts/data/<sitio>-dem.json
    demf = os.path.join(ROOT, "scripts", "data", f"{a.site}-dem.json"); gs = 30.0; k = int(math.ceil((Rc + 60) / gs)); gax = np.arange(-k, k + 1) * gs
    if os.path.exists(demf) and json.load(open(demf)).get("half") == k * gs and json.load(open(demf)).get("lat") == lat0:
        D = np.array(json.load(open(demf))["h"])
    else:
        pts = [(lat0 + n / mlat, lon0 + e / mlon) for n in gax[::-1] for e in gax]
        D = np.array(api_elev(a.api, pts)).reshape(len(gax), len(gax))
        json.dump(dict(lat=lat0, lon=lon0, step=gs, half=k * gs, source="/api/elevation (Teseo)", h=[[round(float(v), 1) for v in r] for r in D]), open(demf, "w"))
    dem = lambda e, n: ndimage.map_coordinates(D, [(k * gs - n) / gs, (e + k * gs) / gs], order=1, mode="nearest")
    S = dem(E, N); off = float(np.median((Z - S)[inside])); Z = Z - off
    # bultos que se quitan (`remove`: [[e, n, r]]): donde la pieza de la app ya dibuja el monumento (la fachada de
    # Newgrange), su bulto se sustituye por el suelo de alrededor, interpolado desde fuera del círculo
    for (fe, fn, fr) in cfg.get("remove", []):
        dd = np.hypot(E - fe, N - fn); out_ = (dd > fr).astype(float); sg = fr / 2.5 / step
        est = ndimage.gaussian_filter(Z * out_, sg) / np.maximum(ndimage.gaussian_filter(out_, sg), 1e-6)
        t = np.clip((dd - (fr - 4)) / 4, 0, 1); t = t * t * (3 - 2 * t); Z = est * (1 - t) + Z * t
    # llanos pedidos
    for (fe, fn, fr, *rest) in cfg.get("flatten", []):
        fw = rest[0] if rest else 4.0; dd = np.hypot(E - fe, N - fn); lvl = float(np.median(Z[dd <= fr])); t = np.clip((dd - fr) / fw, 0, 1); t = t * t * (3 - 2 * t)
        Z = lvl * (1 - t) + Z * t
    # borde: en los últimos 25 m, hacia el relieve de alrededor (mitad LiDAR alisado, mitad relieve global alisado)
    zs = ndimage.gaussian_filter(Z, 12 / step); ss = ndimage.gaussian_filter(S, 60 / step)
    t = np.clip((R - (Rc - 25)) / 20, 0, 1); t = t * t * (3 - 2 * t); Z = Z * (1 - t) + (0.5 * zs + 0.5 * ss - 0.3) * t
    # tono: lo hundido más oscuro, lo que sobresale más claro (0–63; 32 = neutro)
    rel = Z - ndimage.gaussian_filter(Z, 8 / step); TONE = np.clip(32 + rel * float(cfg.get("tone_gain", 28)), 0, 63)
    # MALLA adaptativa: inserción voraz de los puntos de mayor error
    core = float(cfg.get("core", Rc * 0.6)); tol = float(cfg.get("tol", 0.05)); tol_out = float(cfg.get("tol_out", 0.2)); max_v = int(cfg.get("max_v", 52000))
    W = np.clip((R - core) / max(1.0, Rc - 25 - core), 0, 1); TOL = tol + (tol_out - tol) * W
    nb = max(180, int(2 * math.pi * Rc / 4)); th = np.arange(nb) * 2 * math.pi / nb
    ring = np.c_[Rc * np.sin(th), Rc * np.cos(th)]
    zint = lambda e, n: ndimage.map_coordinates(Z, [(Rc - np.atleast_1d(n)) / step, (np.atleast_1d(e) + Rc) / step], order=1, mode="nearest")
    cg = np.arange(-Rc, Rc + 1, 40.0); CE, CN = np.meshgrid(cg, cg); msk = np.hypot(CE, CN) < Rc - 6
    P = np.vstack([ring, np.c_[CE[msk], CN[msk]]]); PZ = zint(P[:, 0], P[:, 1])
    gi = np.flatnonzero(inside.ravel()); ge, gn, gz, gt = E.ravel()[gi], N.ravel()[gi], Z.ravel()[gi], TOL.ravel()[gi]
    for it in range(40):
        f = LinearNDInterpolator(Delaunay(P), PZ); err = np.zeros(Z.size); v = f(ge, gn); err[gi] = np.where(np.isfinite(v), np.abs(v - gz) / gt, 0.0)
        Er = err.reshape(Z.shape); worst = float(Er.max())
        if worst <= 1.0 or len(P) >= max_v: break
        pk = (Er == ndimage.maximum_filter(Er, size=5)) & (Er > 1.0) & (R < Rc - 1.5); idx = np.flatnonzero(pk.ravel())
        idx = idx[np.argsort(-err[idx])][: max(2000, min(len(P) // 2, max_v - len(P)))]
        if not len(idx): break
        P = np.vstack([P, np.c_[E.ravel()[idx], N.ravel()[idx]]]); PZ = np.r_[PZ, Z.ravel()[idx]]
    tri = Delaunay(P); F = tri.simplices.astype(np.int64)
    A, B, C = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]; det = (B[:, 0] - A[:, 0]) * (C[:, 1] - A[:, 1]) - (C[:, 0] - A[:, 0]) * (B[:, 1] - A[:, 1])
    F = F[np.abs(det) > 1e-6]; det = det[np.abs(det) > 1e-6]; F[det < 0] = F[det < 0][:, ::-1]                       # antihorario visto desde arriba
    base = float(cfg.get("base_m", math.floor((PZ.min() - 10) / 10) * 10)); V = np.c_[P, PZ - base]
    cen = P[F].mean(1); tone = np.round(ndimage.map_coordinates(TONE, [(Rc - cen[:, 1]) / step, (cen[:, 0] + Rc) / step], order=1, mode="nearest")).astype(np.uint8)
    # faldón de 4 m bajo el borde
    nt0 = len(F); low = np.arange(nb) + len(V); V = np.vstack([V, np.c_[ring, V[:nb, 2] - 4.0]]); sk = []
    for i in range(nb):
        j = (i + 1) % nb; sk += [[i, low[j], low[i]], [i, j, low[j]]]            # (mirando hacia fuera)
    F = np.vstack([F, np.array(sk)]); tone = np.r_[tone, np.full(len(sk), 24, np.uint8)]; cls = np.ones(len(F), np.uint8)
    if len(V) > 65535: raise SystemExit("demasiados vértices: %d" % len(V))
    q = np.round(V / U);
    if np.abs(q).max() > 32767: raise SystemExit("la maqueta no cabe en ±655 m")
    out = os.path.join(ROOT, "public", "data", f"{a.site}-lidar.bin")
    with open(out, "wb") as fh:
        fh.write(struct.pack("<II", len(V), len(F))); fh.write(q.astype("<i2").tobytes()); fh.write(F.astype("<u2").tobytes()); fh.write((cls + 4 * tone).astype(np.uint8).tobytes())
    # imagen de control: sombreado de la malla
    from PIL import Image
    f = LinearNDInterpolator(Delaunay(P), PZ); G = f(E, N); G = np.where(np.isfinite(G), G, np.nanmedian(PZ)); gy, gx = np.gradient(G, step)
    hs = np.clip(0.5 + (gx * 0.7 + gy * 0.7) * 2.5, 0, 1) * (TONE / 32.0) * inside
    Image.fromarray((np.clip(hs, 0, 1) * 255).astype("u1")).resize((900, 900), Image.LANCZOS).save(os.path.join(d, "mesh.png"))
    probes = {nm: round(float(zint(e, n)[0]), 2) for nm, (e, n) in (cfg.get("probes") or {}).items()}
    rep = dict(site=a.site, file=os.path.basename(out), bytes=os.path.getsize(out), vertices=len(V), triangles=len(F), terrain_triangles=nt0, base_m=base,
               clip=Rc, origin=[lat0, lon0], level_offset_m=round(off, 2), worst_err_over_tol=round(worst, 2), z_origin=round(float(zint(0, 0)[0]), 2),
               zmin=round(float(PZ.min()), 2), zmax=round(float(PZ.max()), 2), probes=probes)
    json.dump(rep, open(os.path.join(d, "build.json"), "w"), indent=1); print(json.dumps(rep))


if __name__ == "__main__":
    main()
