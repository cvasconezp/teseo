"""Pruebas sin red de app/cloudsat.py: geometría de los satélites, reparto en capas y lectura de EUMETView."""
import base64
import math

import numpy as np

from app import cloudsat as cs


def test_elige_el_satelite_mas_cercano_y_ninguno_en_los_polos():
    assert cs.pick_source(0.07, -78.13)["sat"] == "GOES-19"
    assert cs.pick_source(21.3, -157.9)["sat"] == "GOES-18"
    assert cs.pick_source(40.4, -3.7)["id"] == "msg"
    assert cs.pick_source(28.6, 77.2)["id"] == "iodc"
    assert cs.pick_source(35.7, 139.7)["sat"] == "Himawari-9"
    assert cs.pick_source(85.0, 0.0) is None


def test_geometria_goes_centro_y_borde():
    x, y, vis = cs.goes_xy(np.array([0.0]), np.array([-75.0]), -75.0)
    assert abs(x[0]) < 1e-9 and abs(y[0]) < 1e-9 and vis[0]
    # más allá del limbo (a 90° del punto bajo el satélite) ya no se ve
    _, _, vis = cs.goes_xy(np.array([0.0]), np.array([15.0]), -75.0)
    assert not vis[0]


def test_geometria_himawari_coincide_con_la_malla_de_la_jma():
    # posiciones leídas del archivo de la NOAA (Latitude/Longitude en esa columna y fila)
    for (la, lo), (c, r) in {(35.68, 139.69): (2705, 965), (-33.87, 151.21): (3218, 4455), (1.35, 103.82): (909, 2678)}.items():
        col, row, vis = cs.ahi_colrow(np.array([la]), np.array([lo]))
        assert vis[0] and int(round(col[0])) - 1 == c and int(round(row[0])) - 1 == r


def test_reparto_en_capas_por_altura_sobre_el_suelo():
    cloud = np.array([np.nan, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0])
    top = np.array([np.nan, np.nan, 4000.0, 7000.0, 12000.0, np.nan, np.nan])
    phase = np.array([0, 0, 1, 1, 4, 4, 1])
    cls = cs.classify(cloud, top, 2800.0, phase)
    assert cls.tolist() == [-2, -1, 0, 1, 2, 2, 0]
    # sin fase (Meteosat), una nube sin altura va a las medias
    assert cs.classify(np.array([1.0]), np.array([np.nan]), 0.0).tolist() == [1]


def test_malla_porcentajes_y_sin_dato():
    m = cs.N * cs.SUB
    cls = np.full((m, m), -1, dtype=np.int8)
    cls[: m // 2, :] = 2                               # la mitad sur, nubes altas
    cls[-cs.SUB:, -cs.SUB:] = -2                       # la celda del extremo noreste, sin dato
    top = np.where(cls == 2, 11000.0, np.nan)
    layers, total, valid = cs.to_grid(cls, top)
    g = np.frombuffer(base64.b64decode(layers["high"]["grid"]), np.uint8).reshape(cs.N, cs.N)
    assert g[0, 0] == 100 and g[-2, 0] == 0 and g[-1, -1] == 255
    assert layers["high"]["top_km"] == 11.0 and layers["low"]["top_km"] is None
    assert math.isclose(total, layers["high"]["cover"], abs_tol=1e-3) and 0.45 < total < 0.55


def test_eumetview_mascara_y_altura_por_colores():
    rgba = np.array([[[255, 255, 255, 255], [0, 192, 0, 255], [0, 0, 255, 255], [0, 0, 0, 0], [128, 224, 128, 255]]], dtype=np.uint8)
    w = cs.decode_clm(rgba)[0]
    assert w[0] == 1.0 and w[1] == 0.0 and w[2] == 0.0 and math.isnan(w[3]) and abs(w[4] - 0.5) < 0.01
    # colores de la leyenda: azul puro ≈ 4,2 km, amarillo ≈ 10 km, rojo ≈ 12,5 km
    cth = cs.decode_cth(np.array([[[0, 19, 255, 255], [254, 251, 0, 255], [254, 28, 0, 255], [0, 0, 0, 0]]], dtype=np.uint8))[0]
    assert 3500 < cth[0] < 5000 and 9000 < cth[1] < 11000 and 11500 < cth[2] < 13500 and math.isnan(cth[3])


def test_hora_del_barrido_en_los_nombres():
    assert cs._scan_start("OR_ABI-L2-ACTPF-M6_G19_s20263270200216_e2_c3.nc").isoformat() == "2026-11-23T02:00:21+00:00"
    assert cs._scan_start("AHI-CPHS_v1r1_h09_s202611230200210_e2_c3.nc").isoformat() == "2026-11-23T02:00:21+00:00"


# ── lectura por partes: exige 206 y acota la memoria; listados caducados fuera ─────────────────────────────
class _FakeResp:
    def __init__(self, status, content=b"", headers=None, text=""):
        self.status_code, self.content, self.headers, self.text = status, content, headers or {}, text

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class _FakeHttp:
    def __init__(self, size, honor_range=True):
        self.size, self.honor, self.gets = size, honor_range, 0
        self.data = bytes(i % 251 for i in range(size))

    def head(self, url):
        return _FakeResp(200, headers={"content-length": str(self.size)})

    def get(self, url, headers=None, params=None):
        self.gets += 1
        if params is not None:                                         # listado de S3
            return _FakeResp(200, text="<Key>a</Key><Key>b</Key>")
        if not self.honor:
            return _FakeResp(200, self.data)
        a, b = map(int, headers["Range"][6:].split("-"))
        return _FakeResp(206, self.data[a:b + 1])


def test_rangefile_lee_por_partes_y_acota_bloques(monkeypatch):
    http = _FakeHttp(64 * 1024)
    monkeypatch.setattr(cs, "_http", lambda: http)
    f = cs.RangeFile("https://x/y.nc", block=1024, max_blocks=4)
    f.seek(5000)
    assert f.read(3000) == http.data[5000:8000]
    f.seek(40000); f.read(10)
    assert len(f.cache) <= 4
    assert cs.RangeFile("https://x/y.nc").max_blocks == 40


def test_rangefile_rechaza_200_sin_range(monkeypatch):
    import pytest
    http = _FakeHttp(64 * 1024, honor_range=False)
    monkeypatch.setattr(cs, "_http", lambda: http)
    f = cs.RangeFile("https://x/y.nc", block=1024)
    with pytest.raises(OSError):
        f.read(10)
    assert not f.cache


def test_listados_caducados_se_purgan(monkeypatch):
    http = _FakeHttp(10)
    monkeypatch.setattr(cs, "_http", lambda: http)
    cs._lists.clear()
    cs._lists[("viejo", "p/", False)] = (0.0, ["x"])                  # de hace mucho
    assert cs._s3_keys("noaa-goes19", "ABI/") == ["a", "b"]
    assert ("viejo", "p/", False) not in cs._lists and len(cs._lists) == 1
    cs._lists.clear()
