#!/usr/bin/env python3
"""Descarga el relieve LiDAR (modelo digital del terreno, sin vegetación) de un sitio y lo deja listo para
scripts/lidar/build_site.py.

  python3 scripts/lidar/fetch_dtm.py <sitio> <fuente> <lat> <lon> <radio_m> [--res 1.0] [--out /tmp/lidar]

Fuentes (`fuente`):
  ea      Inglaterra · Environment Agency, LIDAR Composite DTM 1 m (Open Government Licence v3)   EPSG:27700
  usgs    EE. UU. · USGS 3DEP, mejor resolución disponible (dominio público)                        UTM de la zona
  tif     un GeoTIFF ya descargado (--src ruta): se recorta y se remuestrea igual

Salida, en <out>/<sitio>/:
  dtm.tif       float32, rejilla cuadrada de `res` m en una proyección métrica, norte arriba, centrada en (lat, lon)
  meta.json     fuente, licencia, atribución, resolución, proyección, centro
  hillshade.png sombreado para revisar a ojo (luz del noroeste)
"""
import argparse, json, math, os, subprocess, sys, urllib.parse
import numpy as np

SRC = {
    "ea": dict(name="Environment Agency · LIDAR Composite DTM 1 m (2022)", license="Open Government Licence v3.0",
               attribution="© Environment Agency copyright and/or database right 2022. All rights reserved.",
               url="https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc", epsg=27700, native=1.0),
    "usgs": dict(name="U.S. Geological Survey · 3D Elevation Program (3DEP)", license="Dominio público",
                 attribution="U.S. Geological Survey, 3D Elevation Program", url="https://www.usgs.gov/3d-elevation-program", epsg=None, native=1.0),
}


def curl(url, out, t=180):
    r = subprocess.run(["curl", "-s", "-L", "-m", str(t), "-o", out, "-w", "%{http_code}", url], capture_output=True, text=True)
    if r.stdout.strip() != "200":
        raise SystemExit(f"descarga fallida ({r.stdout}): {url[:200]}")


def utm_epsg(lat, lon):
    return (32600 if lat >= 0 else 32700) + int((lon + 180) // 6) + 1


def fetch_ea(x, y, R, tmp):
    cid = "13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m"
    base = "https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wcs"
    u = (f"{base}?service=WCS&version=2.0.1&request=GetCoverage&CoverageId={cid}&format=image/tiff"
         f"&subset=E({x - R},{x + R})&subset=N({y - R},{y + R})&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/27700")
    curl(u, tmp)


def fetch_usgs(x, y, R, epsg, res, tmp):
    n = int(round(2 * R / res))
    q = dict(bbox=f"{x - R},{y - R},{x + R},{y + R}", bboxSR=epsg, imageSR=epsg, size=f"{n},{n}", format="tiff", pixelType="F32",
             interpolation="RSP_BilinearInterpolation", f="image")
    curl("https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?" + urllib.parse.urlencode(q), tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("site"); ap.add_argument("source"); ap.add_argument("lat", type=float); ap.add_argument("lon", type=float); ap.add_argument("radius", type=float)
    ap.add_argument("--res", type=float, default=1.0); ap.add_argument("--out", default="/tmp/lidar"); ap.add_argument("--src")
    ap.add_argument("--meta", help="JSON con name, license, attribution, url (para la fuente tif)")
    a = ap.parse_args()
    import pyproj, rasterio
    from rasterio.warp import reproject, Resampling
    from rasterio.transform import from_origin
    d = os.path.join(a.out, a.site); os.makedirs(d, exist_ok=True)
    tmp = os.path.join(d, "raw.tif")
    if a.source == "tif":
        if not a.src: raise SystemExit("--src obligatorio con la fuente tif")
        tmp = a.src; info = json.loads(a.meta) if a.meta else {}
        with rasterio.open(tmp) as s: epsg_src = s.crs.to_epsg()
        epsg = epsg_src if epsg_src and not s.crs.is_geographic else utm_epsg(a.lat, a.lon)
    else:
        info = dict(SRC[a.source]); epsg = info.pop("epsg") or utm_epsg(a.lat, a.lon)
    tr = pyproj.Transformer.from_crs(4326, epsg, always_xy=True); x, y = tr.transform(a.lon, a.lat)
    R = a.radius + 8
    if a.source == "ea": fetch_ea(x, y, R, tmp)
    elif a.source == "usgs": fetch_usgs(x, y, R, epsg, a.res, tmp)
    # rejilla de salida: centrada en el sitio, norte de la proyección arriba
    n = int(round(2 * a.radius / a.res)); T = from_origin(x - a.radius, y + a.radius, a.res, a.res)
    out = np.full((n, n), np.nan, dtype="float32")
    with rasterio.open(tmp) as s:
        src = s.read(1).astype("float32"); nd = s.nodata
        if nd is not None: src[src == nd] = np.nan
        src[(src < -500) | (src > 9000)] = np.nan
        reproject(src, out, src_transform=s.transform, src_crs=s.crs, dst_transform=T, dst_crs=f"EPSG:{epsg}", resampling=Resampling.bilinear, src_nodata=np.nan, dst_nodata=np.nan)
        native = max(abs(s.res[0]), abs(s.res[1]))
    valid = float(np.isfinite(out).mean())
    with rasterio.open(os.path.join(d, "dtm.tif"), "w", driver="GTiff", height=n, width=n, count=1, dtype="float32", crs=f"EPSG:{epsg}", transform=T, nodata=float("nan"), compress="deflate") as w:
        w.write(out, 1)
    # convergencia de meridianos en el centro: el norte de la rejilla respecto al norte verdadero (grados, + hacia el este)
    p = pyproj.Proj(f"EPSG:{epsg}"); conv = p.get_factors(a.lon, a.lat).meridian_convergence
    meta = dict(site=a.site, source=a.source, **{k: info.get(k) for k in ("name", "license", "attribution", "url")}, epsg=epsg, res=a.res,
                native_res=info.get("native", native), lat=a.lat, lon=a.lon, radius=a.radius, n=n, valid=round(valid, 4),
                zmin=round(float(np.nanmin(out)), 2), zmax=round(float(np.nanmax(out)), 2), grid_convergence_deg=round(conv, 4))
    json.dump(meta, open(os.path.join(d, "meta.json"), "w"), ensure_ascii=False, indent=1)
    from PIL import Image
    z = np.where(np.isfinite(out), out, np.nanmedian(out)); gy, gx = np.gradient(z, a.res)
    hs = np.clip(0.5 + (gx * 0.7 - gy * 0.7) * 2.5, 0, 1)
    Image.fromarray((hs * 255).astype("u1")).resize((900, 900), Image.LANCZOS).save(os.path.join(d, "hillshade.png"))
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    main()
