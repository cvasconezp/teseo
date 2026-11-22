"""Tests del horizonte real (app/horizon.py). Sin red: un MockTransport sirve teselas «terrarium» inventadas
con la misma codificación que AWS Terrain Tiles: una llanura a 2.800 m con un volcán cónico de 5.800 m a 18 km
al este del observador, para comparar con el ángulo que se calcula a mano."""
import io
import math
import os
import re
import sys

import httpx
import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient

from app.main import app
from app import horizon as hz

client = TestClient(app)
LAT0, LON0 = 0.04, -78.15          # una celda exacta de 0,01°
R = 6371008.8
PEAK_D = 18000.0
PEAK_LON = LON0 + math.degrees(PEAK_D / R)   # en el ecuador, 18 km al este
PLAIN, PEAK_H, BASE_R = 2800.0, 5800.0, 6000.0


def terrain(lat, lon):
    dx = np.radians(lon - PEAK_LON) * R * np.cos(np.radians(lat))
    dy = np.radians(lat - LAT0) * R
    r = np.hypot(dx, dy)
    return PLAIN + np.clip(1 - r / BASE_R, 0, None) * (PEAK_H - PLAIN)


def tile_png(z, x, y, fn=terrain):
    n = 2 ** z
    px = (np.arange(256) + 0.5) / 256
    lon = (x + px) / n * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * (y + px) / n))))
    h = fn(lat[:, None], lon[None, :]) + 32768.0
    r = np.floor(h / 256); g = np.floor(h - r * 256); b = np.round((h - r * 256 - g) * 256)
    img = np.stack([r, g, np.clip(b, 0, 255)], axis=-1).astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(img, "RGB").save(buf, "PNG"); return buf.getvalue()


@pytest.fixture
def tiles(monkeypatch):
    calls = []
    state = {"fn": terrain, "fail": False}

    def handler(request: httpx.Request):
        m = re.search(r"/terrarium/(\d+)/(\d+)/(\d+)\.png$", str(request.url))
        calls.append(str(request.url))
        if not m or state["fail"]:
            return httpx.Response(404, content=b"no")
        z, x, y = map(int, m.groups())
        return httpx.Response(200, headers={"content-type": "image/png"}, content=tile_png(z, x, y, state["fn"]))

    monkeypatch.setattr(hz, "_transport", httpx.MockTransport(handler))
    hz.reset_cache()
    yield calls, state
    hz.reset_cache()


def at(arr, az):
    return arr[int(round(az / hz.STEP_DEG)) % len(arr)]


def test_volcan_al_este(tiles):
    r = client.get(f"/api/horizon?lat={LAT0}&lon={LON0}")
    assert r.status_code == 200
    d = r.json()
    assert d["lat"] == LAT0 and d["lon"] == LON0 and d["step_deg"] == 0.2 and len(d["alt"]) == 1800
    assert abs(d["ground_m"] - PLAIN) < 3
    drop = PEAK_D ** 2 * (1 - hz.K_REFR) / (2 * R)
    want = math.degrees(math.atan((PEAK_H - PLAIN - hz.EYE_M - drop) / PEAK_D))       # ≈ 9,4°
    got = at(d["alt"], 90)
    assert abs(got - want) < 0.4, (got, want)
    # en la llanura el horizonte queda apenas bajo 0° (curvatura de la Tierra)
    assert -0.3 < at(d["alt"], 270) < 0.0
    assert -0.3 < at(d["alt"], 0) < 0.0
    # el volcán está en la banda de 10 a 25 km, con su cumbre
    b = d["bands"][3]
    assert b["max_km"] == 25 and abs(at(b["alt"], 90) - got) < 1e-6 and at(b["top_m"], 90) > PEAK_H - 250
    assert abs(at(b["dist_km"], 90) - PEAK_D / 1000) < 0.4
    assert r.headers["cache-control"] == f"public, max-age={hz.CACHE_SECONDS}"


def test_ancho_angular_del_volcan(tiles):
    d = client.get(f"/api/horizon?lat={LAT0}&lon={LON0}").json()
    half = math.degrees(math.atan(BASE_R / PEAK_D))                                   # ≈ 18,4°
    assert at(d["alt"], 90 + half - 4) > 0.5 and at(d["alt"], 90 + half + 3) < 0.05


def test_cache_por_celda(tiles):
    calls, _ = tiles
    client.get(f"/api/horizon?lat={LAT0}&lon={LON0}")
    n = len(calls)
    assert n > 10
    r2 = client.get(f"/api/horizon?lat={LAT0 + 0.0008}&lon={LON0 - 0.0009}")     # misma celda de 0,002°
    assert r2.status_code == 200 and len(calls) == n and r2.json()["lat"] == LAT0


def test_gzip(tiles):
    r = client.get(f"/api/horizon?lat={LAT0}&lon={LON0}", headers={"Accept-Encoding": "gzip"})
    assert r.headers.get("content-encoding") == "gzip" and len(r.json()["alt"]) == 1800


def test_sin_teselas_502(tiles):
    _, state = tiles
    state["fail"] = True
    r = client.get("/api/horizon?lat=10&lon=10")
    assert r.status_code == 502 and "relieve" in r.json()["detail"]


def test_mar_a_nivel_cero(tiles):
    _, state = tiles
    state["fn"] = lambda lat, lon: np.full(np.broadcast(lat, lon).shape, -1500.0)
    d = client.get("/api/horizon?lat=-20&lon=-100").json()
    assert d["ground_m"] == 0 and all(-0.5 < a <= 0.0 for a in d["alt"])


def test_celda_y_antimeridiano():
    assert hz.cell_of(0.04312, -78.14563) == (0.044, -78.146)
    assert hz.cell_of(10, 180.0) == (10.0, -180.0)
    t = hz.tiles_for(0, 179.9, 9, 150e3)
    assert any(x == 0 for x, _ in t) and any(x == 511 for x, _ in t)


def test_parametros_invalidos():
    assert client.get("/api/horizon?lat=95&lon=0").status_code == 422
    assert client.get("/api/horizon?lat=0").status_code == 422


def test_alturas_en_puntos(tiles):
    r = client.get(f"/api/elevation?pts={LAT0},{LON0};{LAT0},{PEAK_LON}")
    assert r.status_code == 200
    h = r.json()["heights"]
    assert abs(h[0] - PLAIN) < 3 and abs(h[1] - PEAK_H) < 60, h
    assert client.get("/api/elevation?pts=95,0").status_code == 422
    assert client.get("/api/elevation?pts=" + ";".join(["0,0"] * 81)).status_code == 422


# ── cumbres ──────────────────────────────────────────────────────────────────────────────────────────────
def test_celda_fina():
    assert hz.cell_of(0.04312, -78.14563, fine=True) == (0.0432, -78.1456)


def test_horizonte_fino_no_redondea_a_220_m(tiles):
    d = client.get(f"/api/horizon?lat={LAT0 + 0.0008}&lon={LON0}&fine=1").json()
    assert d["lat"] == round(LAT0 + 0.0008, 4)


def test_cumbre_desde_coordenadas_aproximadas(tiles):
    # el volcán está 18 km al este; pedimos la cumbre desde 900 m al oeste de ella
    lon = PEAK_LON - math.degrees(900.0 / R)
    d = client.get(f"/api/summit?lat={LAT0}&lon={lon}&r=1500").json()
    assert d["found"] and abs(d["lon"] - PEAK_LON) < 0.0003 and abs(d["lat"] - LAT0) < 0.0003, d
    assert abs(d["ground_m"] - PEAK_H) < 30 and d["rise_m"] > 300


def test_gps_en_la_cima_se_corrige(tiles):
    lon = PEAK_LON - math.degrees(25.0 / R)          # a 25 m de la cumbre: unos 12 m más abajo
    d = client.get(f"/api/summit?lat={LAT0}&lon={lon}&r=80&strict=1").json()
    assert d["found"] and d["rise_m"] <= 40 and abs(d["lon"] - PEAK_LON) < 0.0002, d


def test_gps_en_la_ladera_no_se_mueve(tiles):
    lon = PEAK_LON - math.degrees(1500.0 / R)        # en la ladera: lo más alto cerca es cuesta arriba, no una cima
    d = client.get(f"/api/summit?lat={LAT0}&lon={lon}&r=150&strict=1").json()
    assert not d["found"] and d["lon"] == round(lon, 5)


def test_gps_en_la_llanura_no_se_mueve(tiles):
    d = client.get(f"/api/summit?lat={LAT0}&lon={LON0}&r=150&strict=1").json()
    assert not d["found"] and d["dist_m"] == 0


def test_cumbre_parametros():
    assert client.get("/api/summit?lat=0&lon=0&r=5000").status_code == 422


def test_cumbre_se_amplia_si_cae_en_el_borde(tiles):
    lon = PEAK_LON - math.degrees(700.0 / R)          # a 700 m de la cumbre, buscando en 300 m: se amplía
    d = client.get(f"/api/summit?lat={LAT0}&lon={lon}&r=300").json()
    assert d["found"] and abs(d["lon"] - PEAK_LON) < 0.0003 and d["radius_m"] == 750, d


# ── colores del satélite (app/landcolor.py) ──────────────────────────────────────────────────────────────
def test_colores_del_satelite(tiles, monkeypatch):
    import base64
    import io
    import httpx as _httpx
    from PIL import Image
    from app import landcolor as lc
    buf = io.BytesIO(); Image.new("RGB", (256, 256), (90, 120, 60)).save(buf, "JPEG"); jpg = buf.getvalue()
    monkeypatch.setattr(lc, "_transport", _httpx.MockTransport(lambda req: _httpx.Response(200, content=jpg)))
    lc._tiles.clear(); lc._results.clear()
    d = client.get(f"/api/horizon/colors?lat={LAT0}&lon={LON0}").json()
    assert d["coverage"] == 1.0 and d["step_deg"] == 0.4 and len(d["bands"]) == len(hz.BANDS_KM) and "EOX" in d["credit"]
    top = base64.b64decode(d["bands"][3]["top"])
    assert len(top) == 900 * 3 and abs(top[0] - 90) < 6 and abs(top[1] - 120) < 6 and abs(top[2] - 60) < 6


def test_colores_sin_teselas(tiles, monkeypatch):
    import httpx as _httpx
    from app import landcolor as lc
    monkeypatch.setattr(lc, "_transport", _httpx.MockTransport(lambda req: _httpx.Response(503)))
    lc._tiles.clear(); lc._results.clear()
    assert client.get(f"/api/horizon/colors?lat={LAT0}&lon={LON0}").status_code == 502


def test_colores_sin_nubes():
    import numpy as np
    from app import landcolor as lc
    assert lc.is_cloudy((230, 232, 235)) and lc.is_cloudy((175, 170, 168)) and not lc.is_cloudy((90, 120, 60)) and not lc.is_cloudy((200, 150, 90))
    cols = np.array([[10, 20, 30], [0, 0, 0], [0, 0, 0], [40, 50, 60]], dtype=np.uint8)
    out = lc.fill_gaps(cols, np.array([True, False, False, True]))
    assert out[1].tolist() == [10, 20, 30] and out[2].tolist() == [40, 50, 60]
    assert lc.fill_gaps(cols, np.zeros(4, dtype=bool))[0].tolist() == [95, 100, 80]


# ── relieve cercano en 3D (app/terrain3d.py) ─────────────────────────────────────────────────────────────
def _near(tiles, monkeypatch, color=(90, 120, 60), status=200):
    import io
    import httpx as _httpx
    from PIL import Image
    from app import landcolor as lc
    from app import terrain3d as t3
    buf = io.BytesIO(); Image.new("RGB", (256, 256), color).save(buf, "JPEG"); jpg = buf.getvalue()
    monkeypatch.setattr(lc, "_transport", _httpx.MockTransport(lambda req: _httpx.Response(status, content=jpg)))
    lc._tiles.clear(); lc._results.clear(); t3.reset_cache()
    return t3


def test_relieve_cercano_alturas(tiles, monkeypatch):
    import base64
    t3 = _near(tiles, monkeypatch)
    d = client.get(f"/api/terrain/near?lat={LAT0}&lon={LON0}").json()
    assert d["n_az"] == t3.N_AZ and d["n_r"] == t3.N_R and d["coverage"] == 1.0 and "EOX" in d["credit"]
    assert d["ground_m"] == 2800
    h = np.frombuffer(base64.b64decode(d["heights"]), dtype="<u2").reshape(t3.N_AZ, t3.N_R) / d["h_scale"] - d["h_off"]
    dist = t3.ring_dist(t3.N_R)
    east, west = t3.N_AZ // 4, 3 * t3.N_AZ // 4
    j = int(np.argmin(np.abs(dist - PEAK_D)))
    # al este, a 18 km, el volcán (el anillo más cercano a la cumbre queda a menos de 400 m de ella)
    assert h[east, j] > PEAK_H - 250, h[east, j]
    # al oeste y cerca, la llanura
    assert abs(h[west, j] - PLAIN) < 2 and abs(h[east, 0] - PLAIN) < 2
    assert abs(dist[0] - t3.D_MIN) < 1e-6 and abs(dist[-1] - t3.D_MAX) < 1e-3


def test_relieve_cercano_imagen(tiles, monkeypatch):
    import io
    from PIL import Image
    t3 = _near(tiles, monkeypatch)
    r = client.get(f"/api/terrain/near.jpg?lat={LAT0}&lon={LON0}")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    im = Image.open(io.BytesIO(r.content))
    assert im.size == (t3.TEX_W, t3.TEX_H)
    px = im.convert("RGB").getpixel((700, 500))
    assert abs(px[0] - 90) < 8 and abs(px[1] - 120) < 8 and abs(px[2] - 60) < 8
    # una sola vez por celda: la segunda petición sale de la caché
    n = t3.stats["computed"]
    client.get(f"/api/terrain/near?lat={LAT0}&lon={LON0}")
    assert t3.stats["computed"] == n


def test_relieve_cercano_sin_satelite(tiles, monkeypatch):
    _near(tiles, monkeypatch, status=503)
    assert client.get(f"/api/terrain/near?lat={LAT0}&lon={LON0}").status_code == 502


def test_relieve_cercano_teselas_por_distancia():
    from app import terrain3d as t3
    need = t3.tex_tiles(LAT0, LON0)
    zs = {z for z, _, _ in need}
    assert zs == {8, 9, 10, 11, 12, 13, 14} and len(need) < 130, len(need)


def test_despike_quita_agujas_y_respeta_cumbres():
    yy, xx = np.mgrid[0:256, 0:256].astype(np.float32)
    # una cumbre empinada de verdad (600 m, ~120 m de radio a zoom 12) y una aguja de un píxel sobre un llano
    h = 2660.0 + 600.0 * np.exp(-((xx - 60) ** 2 + (yy - 60) ** 2) / (2 * 3.0 ** 2))
    h[200, 200] = 3062.0
    h[201, 200] = 2990.0
    out = hz.despike(h.astype(np.float32), 12)
    assert abs(out[200, 200] - 2660.0) < 5 and abs(out[201, 200] - 2660.0) < 5     # la aguja (dos píxeles), fuera
    assert abs(out[60, 60] - h[60, 60]) < 1e-3                                      # la cumbre, intacta
    assert np.allclose(out[100:150, 100:150], h[100:150, 100:150])                  # el resto, igual
