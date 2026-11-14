"""Pruebas de la ISS (app/iss.py + GET /api/iss/passes). Sin red.

Cómo se valida la precisión (cuatro vías independientes):
  1. Física del propio TLE: altura 400–430 km, período 92–93 min, inclinación 51,6°.
  2. Marcos de referencia: la conversión TEME→horizonte, hecha a mano con GMST,
     se compara con astropy (TEME→AltAz, con ERFA/IERS) y el Sol con
     astropy.get_sun: diferencias < 0,05° (en la práctica 0,006°).
  3. Skyfield (JPL DE421, UT1, movimiento polar, sombra `is_sunlit`): pasadas de
     Quito y Madrid generadas con tests/referencia_skyfield.py y guardadas aquí.
  4. Heavens-Above (software y TLE propios): las 25 pasadas de Quito y las 12
     visibles de Madrid del 14 al 23-nov-2026, con su magnitud.
Tolerancia exigida a las pasadas: ±2 min. Resultado real: ~1–2 s.
"""
import asyncio
import math
import os
import sys
import time
from datetime import datetime, timezone

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient

from app import cache, iss, main

client = TestClient(main.app)

TLE_TEXT = """ISS (ZARYA)
1 25544U 98067A   26317.91612726  .00008668  00000+0  16320-3 0  9995
2 25544  51.6324 279.1461 0007382  22.6178 337.5134 15.49359724594967
"""
T0 = datetime(2026, 11, 14, 0, 0, tzinfo=timezone.utc).timestamp()   # «ahora» fijo de las pruebas
QUITO = (-0.22, -78.51, 2850)
MADRID = (40.42, -3.70, 650)


def unix(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()


# Heavens-Above, consultado el 14-nov-2026 (tz=UCT, mismo TLE: época 13-nov-2026). Quito: TODAS las pasadas
# (umbral 10°) del 14 al 23-nov: (inicio, culminación, alt máx, fin, tipo según HA).
HA_QUITO = [
    ("2026-11-14T07:59:22Z", "2026-11-14T08:02:42Z", 70, "2026-11-14T08:06:02Z", "night (unlit)"),
    ("2026-11-14T19:35:37Z", "2026-11-14T19:38:48Z", 44, "2026-11-14T19:41:58Z", "daylight"),
    ("2026-11-15T07:12:02Z", "2026-11-15T07:14:57Z", 28, "2026-11-15T07:17:53Z", "night (unlit)"),
    ("2026-11-15T18:48:34Z", "2026-11-15T18:51:03Z", 19, "2026-11-15T18:53:30Z", "daylight"),
    ("2026-11-15T20:26:05Z", "2026-11-15T20:27:37Z", 13, "2026-11-15T20:29:09Z", "daylight"),
    ("2026-11-16T06:25:35Z", "2026-11-16T06:27:11Z", 13, "2026-11-16T06:28:47Z", "night (unlit)"),
    ("2026-11-16T08:01:13Z", "2026-11-16T08:03:46Z", 20, "2026-11-16T08:06:19Z", "night (unlit)"),
    ("2026-11-16T19:36:57Z", "2026-11-16T19:39:50Z", 27, "2026-11-16T19:42:43Z", "daylight"),
    ("2026-11-17T07:12:45Z", "2026-11-17T07:15:58Z", 46, "2026-11-17T07:19:13Z", "night (unlit)"),
    ("2026-11-17T18:48:46Z", "2026-11-17T18:52:04Z", 71, "2026-11-17T18:55:20Z", "daylight"),
    ("2026-11-18T06:24:52Z", "2026-11-18T06:28:12Z", 67, "2026-11-18T06:31:32Z", "night (unlit)"),
    ("2026-11-18T18:01:05Z", "2026-11-18T18:04:16Z", 43, "2026-11-18T18:07:26Z", "daylight"),
    ("2026-11-19T05:37:30Z", "2026-11-19T05:40:23Z", 27, "2026-11-19T05:43:17Z", "night (unlit)"),
    ("2026-11-19T17:14:01Z", "2026-11-19T17:16:26Z", 19, "2026-11-19T17:18:51Z", "daylight"),
    ("2026-11-19T18:51:22Z", "2026-11-19T18:53:00Z", 13, "2026-11-19T18:54:39Z", "daylight"),
    ("2026-11-20T04:51:04Z", "2026-11-20T04:52:33Z", 12, "2026-11-20T04:54:00Z", "night (unlit)"),
    ("2026-11-20T06:26:32Z", "2026-11-20T06:29:07Z", 21, "2026-11-20T06:31:43Z", "night (unlit)"),
    ("2026-11-20T18:02:14Z", "2026-11-20T18:05:10Z", 29, "2026-11-20T18:08:05Z", "daylight"),
    ("2026-11-21T05:38:01Z", "2026-11-21T05:41:16Z", 48, "2026-11-21T05:44:31Z", "night (unlit)"),
    ("2026-11-21T17:14:00Z", "2026-11-21T17:17:19Z", 75, "2026-11-21T17:20:37Z", "daylight"),
    ("2026-11-22T04:50:06Z", "2026-11-22T04:53:24Z", 63, "2026-11-22T04:56:44Z", "night (unlit)"),
    ("2026-11-22T16:26:18Z", "2026-11-22T16:29:28Z", 41, "2026-11-22T16:32:36Z", "daylight"),
    ("2026-11-23T04:02:42Z", "2026-11-23T04:05:31Z", 25, "2026-11-23T04:08:22Z", "night (unlit)"),
    ("2026-11-23T15:39:12Z", "2026-11-23T15:41:34Z", 18, "2026-11-23T15:43:54Z", "daylight"),
    ("2026-11-23T17:16:21Z", "2026-11-23T17:18:07Z", 14, "2026-11-23T17:19:54Z", "daylight"),
]

# Madrid (40,42 N, 3,70 O, 650 m): pasadas VISIBLES según HA. (mag, inicio visible, alt, culminación del tramo visible, alt, fin visible, alt)
HA_MADRID_VISIBLES = [
    (-2.9, "2026-11-14T18:19:10Z", 10, "2026-11-14T18:22:21Z", 44, "2026-11-14T18:23:47Z", 26),
    (-3.6, "2026-11-15T17:31:13Z", 10, "2026-11-15T17:34:31Z", 73, "2026-11-15T17:37:51Z", 10),
    (-1.2, "2026-11-15T19:09:27Z", 10, "2026-11-15T19:10:56Z", 16, "2026-11-15T19:10:56Z", 16),
    (-1.8, "2026-11-16T18:21:05Z", 10, "2026-11-16T18:23:45Z", 22, "2026-11-16T18:25:04Z", 17),
    (-2.3, "2026-11-17T17:32:47Z", 10, "2026-11-17T17:35:46Z", 30, "2026-11-17T17:38:46Z", 10),
    (-0.8, "2026-11-17T19:11:45Z", 10, "2026-11-17T19:12:05Z", 11, "2026-11-17T19:12:05Z", 11),
    (-1.4, "2026-11-18T18:23:19Z", 10, "2026-11-18T18:25:15Z", 15, "2026-11-18T18:26:08Z", 13),
    (-1.6, "2026-11-19T17:34:50Z", 10, "2026-11-19T17:37:09Z", 17, "2026-11-19T17:39:29Z", 10),
    (-1.3, "2026-11-20T18:25:22Z", 10, "2026-11-20T18:26:48Z", 12, "2026-11-20T18:27:03Z", 12),
    (-1.3, "2026-11-21T17:36:59Z", 10, "2026-11-21T17:38:37Z", 13, "2026-11-21T17:40:15Z", 10),
    (-1.4, "2026-11-22T18:26:37Z", 10, "2026-11-22T18:27:55Z", 13, "2026-11-22T18:27:55Z", 13),
    (-1.4, "2026-11-23T17:38:37Z", 10, "2026-11-23T17:40:05Z", 12, "2026-11-23T17:41:32Z", 10),
]

# Skyfield 1.55 + DE421 (ver tests/referencia_skyfield.py), mismo TLE, 14 a 17-nov-2026 (3 días).
# (inicio, culminación, alt máx, fin, visible, segundos visibles)
SKY_REF = {
    "quito": [
        ("2026-11-14T07:59:22Z", "2026-11-14T08:02:42Z", 70.01, "2026-11-14T08:06:04Z", False, 0),
        ("2026-11-14T19:35:38Z", "2026-11-14T19:38:49Z", 44.42, "2026-11-14T19:41:59Z", False, 0),
        ("2026-11-15T07:12:02Z", "2026-11-15T07:14:58Z", 27.65, "2026-11-15T07:17:54Z", False, 0),
        ("2026-11-15T18:48:35Z", "2026-11-15T18:51:03Z", 19.24, "2026-11-15T18:53:30Z", False, 0),
        ("2026-11-15T20:26:06Z", "2026-11-15T20:27:38Z", 12.62, "2026-11-15T20:29:10Z", False, 0),
        ("2026-11-16T06:25:35Z", "2026-11-16T06:27:11Z", 12.83, "2026-11-16T06:28:48Z", False, 0),
        ("2026-11-16T08:01:14Z", "2026-11-16T08:03:46Z", 19.85, "2026-11-16T08:06:20Z", False, 0),
        ("2026-11-16T19:36:58Z", "2026-11-16T19:39:51Z", 27.44, "2026-11-16T19:42:43Z", False, 0),
    ],
    "madrid": [
        ("2026-11-14T01:37:19Z", "2026-11-14T01:39:38Z", 17.43, "2026-11-14T01:41:57Z", False, 0),
        ("2026-11-14T16:43:13Z", "2026-11-14T16:45:47Z", 20.83, "2026-11-14T16:48:22Z", False, 0),
        ("2026-11-14T18:19:10Z", "2026-11-14T18:22:22Z", 43.58, "2026-11-14T18:25:35Z", True, 278),
        ("2026-11-14T19:57:52Z", "2026-11-14T19:59:49Z", 14.44, "2026-11-14T20:01:46Z", False, 0),
        ("2026-11-14T21:35:57Z", "2026-11-14T21:37:42Z", 13.37, "2026-11-14T21:39:27Z", False, 0),
        ("2026-11-14T23:12:09Z", "2026-11-14T23:15:15Z", 33.7, "2026-11-14T23:18:21Z", False, 0),
        ("2026-11-15T00:49:00Z", "2026-11-15T00:52:00Z", 29.56, "2026-11-15T00:54:58Z", False, 0),
        ("2026-11-15T15:56:48Z", "2026-11-15T15:58:10Z", 12.08, "2026-11-15T15:59:33Z", False, 0),
        ("2026-11-15T17:31:13Z", "2026-11-15T17:34:32Z", 72.82, "2026-11-15T17:37:52Z", True, 400),
        ("2026-11-15T19:09:28Z", "2026-11-15T19:11:47Z", 17.23, "2026-11-15T19:14:06Z", True, 90),
        ("2026-11-15T20:48:07Z", "2026-11-15T20:49:37Z", 12.34, "2026-11-15T20:51:07Z", False, 0),
        ("2026-11-15T22:24:30Z", "2026-11-15T22:27:19Z", 24.11, "2026-11-15T22:30:08Z", False, 0),
        ("2026-11-16T00:01:00Z", "2026-11-16T00:04:17Z", 52.67, "2026-11-16T00:07:34Z", False, 0),
        ("2026-11-16T16:43:27Z", "2026-11-16T16:46:44Z", 64.07, "2026-11-16T16:50:02Z", False, 0),
        ("2026-11-16T18:21:05Z", "2026-11-16T18:23:46Z", 21.82, "2026-11-16T18:26:27Z", True, 240),
        ("2026-11-16T20:00:04Z", "2026-11-16T20:01:30Z", 12.18, "2026-11-16T20:02:57Z", False, 0),
        ("2026-11-16T21:36:51Z", "2026-11-16T21:39:19Z", 18.6, "2026-11-16T21:41:46Z", False, 0),
        ("2026-11-16T23:13:08Z", "2026-11-16T23:16:30Z", 86.75, "2026-11-16T23:19:51Z", False, 0),
    ],
}


ELEMENTS = iss.parse_tle(TLE_TEXT)


@pytest.fixture(scope="module")
def pasadas():
    """Pasadas de Quito y Madrid del 14-nov-2026 00:00 UTC, 10 días (se calculan una vez)."""
    return {
        "quito": iss.compute_passes(ELEMENTS, *QUITO, T0, 10),
        "madrid": iss.compute_passes(ELEMENTS, *MADRID, T0, 10),
    }


# ─── Física del TLE ──────────────────────────────────────────────────────────
def test_posicion_a_la_epoca_altura_periodo_inclinacion():
    sat = iss.satrec_of(ELEMENTS)
    ep = iss.epoch_unix(sat)
    ev = iss.evaluate(sat, iss.Observer(0, 0, 0), np.array([ep]))
    _lat, _lon, alt_km = iss.ecef_to_geodetic(ev["r_ecef"])
    assert 400 <= alt_km[0] <= 430, alt_km
    info = iss.elements_info(ELEMENTS, ep + 3600)
    assert 92.0 <= info["period_min"] <= 93.0, info["period_min"]
    assert info["inclination_deg"] == pytest.approx(51.6, abs=0.05)
    assert info["epoch"] == "2026-11-13T21:59:13Z"
    assert info["age_hours"] == 1.0 and info["outdated"] is False
    # órbita casi circular durante 3 días: el radio geocéntrico queda entre 6780 y 6815 km
    # (la altura GEODÉSICA varía hasta ~20 km con la latitud por el achatamiento terrestre)
    ts = ep + np.arange(0, 3 * 86400, 600.0)
    ev = iss.evaluate(sat, iss.Observer(0, 0, 0), ts)
    rad = np.linalg.norm(ev["r_ecef"], axis=1)
    assert 6780 < rad.min() and rad.max() < 6815


def test_parse_tle_valida():
    assert iss.parse_tle(TLE_TEXT)["name"] == "ISS (ZARYA)"
    assert iss.parse_tle("\n".join(TLE_TEXT.splitlines()[1:]))["name"] == "ISS (ZARYA)"   # sin línea de nombre
    mala = TLE_TEXT.replace("9995", "9991")                       # suma de control rota
    with pytest.raises(ValueError):
        iss.parse_tle(mala)
    with pytest.raises(ValueError):
        iss.parse_tle("Not Found")
    with pytest.raises(ValueError):                               # otro objeto (CSS, 48274)
        iss.parse_tle("1 48274U 21035A   26317.50000000  .00020000  00000+0  20000-3 0  9990\n"
                      "2 48274  41.4700 100.0000 0005000 100.0000 260.0000 15.60000000 12345")


# ─── Marcos de referencia contra astropy ─────────────────────────────────────
def test_teme_a_horizonte_coincide_con_astropy():
    import astropy.units as u
    from astropy.coordinates import TEME, AltAz, CartesianRepresentation, EarthLocation
    from astropy.time import Time
    from astropy.utils import iers
    iers.conf.auto_download = False
    sat = iss.satrec_of(ELEMENTS)
    ts = T0 + np.arange(0, 86400, 3 * 3600.0)
    for lat, lon, h in (QUITO, MADRID, (-33.9, 151.2, 20)):
        ev = iss.evaluate(sat, iss.Observer(lat, lon, h), ts)
        jd, fr = iss.jd_split(ts)
        _e, r, _v = sat.sgp4_array(jd, fr)
        tm = Time(jd, fr, format="jd", scale="utc")
        loc = EarthLocation.from_geodetic(lon * u.deg, lat * u.deg, h * u.m)
        aa = TEME(CartesianRepresentation(r.T * u.km), obstime=tm).transform_to(AltAz(obstime=tm, location=loc))
        d_alt = np.abs(aa.alt.deg - ev["alt"])
        d_az = np.abs((aa.az.deg - ev["az"] + 180) % 360 - 180)
        assert d_alt.max() < 0.05 and d_az.max() < 0.05, (d_alt.max(), d_az.max())


def test_sol_y_gmst_coinciden_con_astropy():
    from astropy.coordinates import get_sun
    from astropy.time import Time
    from astropy.utils import iers
    iers.conf.auto_download = False
    ts = T0 + np.arange(0, 365 * 86400, 20 * 86400.0)
    jd, fr = iss.jd_split(ts)
    s = iss.sun_teme(jd, fr)
    ra = np.rad2deg(np.arctan2(s[:, 1], s[:, 0])) % 360
    dec = np.rad2deg(np.arcsin(s[:, 2] / np.linalg.norm(s, axis=1)))
    sun = get_sun(Time(jd, fr, format="jd", scale="utc"))
    # get_sun da coordenadas ICRS/GCRS aparentes; la diferencia de equinoccio (precesión + nutación, ≲ 0,3°) se excluye
    d_dec = np.abs(sun.dec.deg - dec)
    assert d_dec.max() < 0.35
    assert np.abs(np.linalg.norm(s, axis=1) / iss.AU - sun.distance.to("AU").value).max() < 5e-4
    # GMST82 frente a ERFA
    import erfa
    g = iss.gmst82(jd, fr)
    g2 = erfa.gmst82(jd, fr)
    d = np.abs((np.rad2deg(g - g2) + 180) % 360 - 180)
    assert d.max() < 1e-3


def test_sombra_cilindro_y_penumbra():
    sun = np.array([[iss.AU, 0.0, 0.0]])
    n = lambda x, y, z: iss.illumination(np.array([[x, y, z]]), sun)[0]
    assert n(6778.0, 0, 0) == 1.0                  # lado del Sol
    assert n(-6778.0, 0, 0) == 0.0                 # detrás de la Tierra: umbra
    assert n(0, 6778.0, 0) == 1.0                  # sobre el terminador, fuera del cilindro
    assert n(-3000.0, 6000.0, 0) == 0.0            # detrás de la Tierra y dentro del cilindro: umbra
    assert n(-3000.0, 7000.0, 0) == 1.0            # detrás pero fuera del cilindro: luz
    assert 0.3 < n(-3000.0, 6378.137, 0) < 0.7     # justo en el borde de la sombra: penumbra, ~50 %


def test_magnitud_formula():
    # a 1000 km y fase de 90° es la magnitud estándar; más lejos, más débil; más fase llena, más brillante
    assert float(iss.magnitude(1000.0, math.pi / 2, -1.4)) == pytest.approx(-1.4)
    assert float(iss.magnitude(2000.0, math.pi / 2, -1.4)) == pytest.approx(-1.4 + 5 * math.log10(2))
    assert float(iss.magnitude(500.0, math.radians(30), -1.4)) < float(iss.magnitude(500.0, math.radians(120), -1.4))


# ─── Pasadas contra Skyfield ─────────────────────────────────────────────────
def _empareja(mias, ref_times, tol=120):
    """Para cada instante de referencia debe haber una pasada mía a menos de `tol` s,
    y no sobrar pasadas mías en el mismo intervalo. Devuelve los pares."""
    pares = []
    for r in ref_times:
        c = min(mias, key=lambda p: abs(unix(p["start"]["t"]) - unix(r[0])))
        pares.append((c, r))
    return pares


@pytest.mark.parametrize("lugar", ["quito", "madrid"])
def test_pasadas_coinciden_con_skyfield(pasadas, lugar):
    ref = SKY_REF[lugar]
    fin = unix(ref[-1][3])
    mias = [p for p in pasadas[lugar] if unix(p["start"]["t"]) >= T0 and unix(p["end"]["t"]) <= fin + 1]
    assert len(mias) == len(ref), (len(mias), len(ref))      # ni faltan ni sobran
    peor = 0.0
    for p, (s, m, alt, e, vis, vis_s) in _empareja(mias, ref):
        for mine, theirs in ((p["start"]["t"], s), (p["max"]["t"], m), (p["end"]["t"], e)):
            d = abs(unix(mine) - unix(theirs))
            peor = max(peor, d)
            assert d <= 120, (mine, theirs)
        assert abs(p["max_alt"] - alt) < 1.0
        assert p["visible"] == vis, (p["start"]["t"], p["visible"], vis)
        if vis:
            assert abs(p["visible_duration_s"] - vis_s) <= 15
    assert peor <= 5      # en la práctica 1–2 s


def test_pasadas_coinciden_con_heavens_above_quito(pasadas):
    mias = pasadas["quito"]
    assert len(mias) >= len(HA_QUITO)
    for ini, cul, alt, fin, tipo in HA_QUITO:
        p = min(mias, key=lambda x: abs(unix(x["start"]["t"]) - unix(ini)))
        assert abs(unix(p["start"]["t"]) - unix(ini)) <= 120
        assert abs(unix(p["max"]["t"]) - unix(cul)) <= 120
        assert abs(unix(p["end"]["t"]) - unix(fin)) <= 120
        assert abs(p["max_alt"] - alt) <= 1.0
        # HA: "daylight" o "night (unlit)": ninguna de las 25 es visible en Quito
        assert p["visible"] is False
        esperado = "sun_up" if tipo == "daylight" else "iss_in_shadow"
        assert p["why_not_visible"] == esperado, (ini, tipo, p["why_not_visible"])


def test_pasadas_visibles_madrid_coinciden_con_heavens_above(pasadas):
    vis = [p for p in pasadas["madrid"] if p["visible"]]
    assert len(vis) == len(HA_MADRID_VISIBLES) == 12
    for p, (mag, ini, _a0, _cul, _a1, fin, _a2) in zip(vis, HA_MADRID_VISIBLES):
        assert abs(unix(p["visible_from"]["t"]) - unix(ini)) <= 120
        assert abs(unix(p["visible_to"]["t"]) - unix(fin)) <= 120
        # la magnitud es aproximada: ±1 respecto a HA
        assert abs(p["mag"] - mag) <= 1.0, (p["start"]["t"], p["mag"], mag)


def test_forma_de_una_pasada(pasadas):
    p = next(x for x in pasadas["madrid"] if x["visible"])
    for k in ("start", "max", "end"):
        assert set(("t", "alt", "az", "compass", "compass_es")) <= set(p[k])
        assert 0 <= p[k]["az"] < 360
    assert p["start"]["alt"] == pytest.approx(10.0, abs=0.05) and p["end"]["alt"] == pytest.approx(10.0, abs=0.05)
    assert p["start"]["compass"] == "WSW" and p["start"]["compass_es"] == "OSO"
    assert p["max"]["compass_es"] in ("NNO", "N", "NO", "NNE")
    assert p["duration_s"] == pytest.approx(unix(p["end"]["t"]) - unix(p["start"]["t"]), abs=1)
    # la trayectoria lleva décimas de segundo y empieza/acaba en los extremos de la pasada
    assert abs(unix(p["track"][0]["t"][:-3] + "Z") - unix(p["start"]["t"])) <= 1
    assert abs(unix(p["track"][-1]["t"][:-3] + "Z") - unix(p["end"]["t"])) <= 1
    assert p["track"][0]["t"][-2:] and "." in p["track"][0]["t"]
    assert max(pt["alt"] for pt in p["track"]) == pytest.approx(p["max_alt"], abs=0.1)
    assert p["mag"] is not None and p["why_not_visible"] is None
    q = next(x for x in pasadas["quito"])
    assert q["mag"] is None and q["visible_from"] is None and q["visible_duration_s"] == 0


def test_rosa_de_los_vientos():
    assert iss._compass(0) == ("N", "N") and iss._compass(359.9) == ("N", "N")
    assert iss._compass(225) == ("SW", "SO") and iss._compass(270) == ("W", "O") and iss._compass(292.5) == ("WNW", "ONO")


# ─── Endpoint, caché y stale (red simulada) ──────────────────────────────────
class Resp:
    def __init__(self, text="", status=200):
        self.text, self.status_code = text, status


class FakeNet:
    def __init__(self):
        self.calls, self.fail, self.status, self.body = [], False, 200, TLE_TEXT
        outer = self

        class _Client:
            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def get(self, url, params=None, headers=None, **k):
                outer.calls.append((url, dict(params or {}), dict(headers or {})))
                if outer.fail:
                    raise RuntimeError("CelesTrak caído")
                return Resp(outer.body, outer.status)

        self.Client = _Client


@pytest.fixture
def net(monkeypatch):
    n = FakeNet()
    monkeypatch.setattr(iss.httpx, "AsyncClient", n.Client)
    monkeypatch.setattr(iss, "_now", lambda: T0)
    monkeypatch.delenv("TESEO_USER_AGENT", raising=False)
    iss.resource.reset()
    iss._passes_cache.clear()
    yield n
    iss.resource.reset()
    iss._passes_cache.clear()


def test_endpoint_contrato_y_cabeceras(net, monkeypatch):
    monkeypatch.setenv("TESEO_USER_AGENT", "Teseo/0.2 (+https://teseo.example; contacto@example.org)")
    r = client.get("/api/iss/passes", params={"lat": MADRID[0], "lon": MADRID[1], "alt_m": MADRID[2], "days": 3})
    assert r.status_code == 200, r.text
    d = r.json()
    assert r.headers["cache-control"] == "public, max-age=300"
    assert d["stale"] is False and d["warnings"] == []
    assert d["observer"] == {"lat": 40.42, "lon": -3.7, "alt_m": 650.0}
    assert d["window"]["days"] == 3
    assert d["elements"]["epoch"] == "2026-11-13T21:59:13Z" and d["elements"]["age_hours"] == 2.0
    assert d["rules"]["min_alt_deg"] == 10 and d["rules"]["sun_alt_max_deg"] == -6
    # 3 días de Madrid: las de Skyfield + la que ya estaba en curso a las 00:00 (23:59:49 → 00:02)
    assert len(d["passes"]) == len(SKY_REF["madrid"]) + 1
    assert sum(p["visible"] for p in d["passes"]) == sum(r[4] for r in SKY_REF["madrid"]) == 4
    assert d["passes"][0]["start"]["t"] < "2026-11-14T00:00:00Z"
    # CelesTrak: una sola petición, al objeto 25544, con User-Agent propio
    assert len(net.calls) == 1
    url, params, headers = net.calls[0]
    assert "celestrak.org" in url and params == {"CATNR": 25544, "FORMAT": "TLE"}
    assert headers["User-Agent"].startswith("Teseo/0.2")


def test_ttl_de_elementos_respeta_a_celestrak(net):
    assert iss.resource.ttl >= 2 * 3600
    for _ in range(3):
        assert client.get("/api/iss/passes", params={"lat": 1, "lon": 2}).status_code == 200
    assert len(net.calls) == 1        # los visitantes no llegan a CelesTrak
    client.get("/api/iss/passes", params={"lat": -0.22, "lon": -78.51, "days": 2})
    assert len(net.calls) == 1        # tampoco con otro lugar ni otros días


def test_pasadas_en_cache_no_se_recalculan(net, monkeypatch):
    llamadas = []
    orig = iss.compute_passes
    monkeypatch.setattr(iss, "compute_passes", lambda *a, **k: (llamadas.append(1), orig(*a, **k))[1])
    p = {"lat": MADRID[0], "lon": MADRID[1], "alt_m": MADRID[2], "days": 2}
    a = client.get("/api/iss/passes", params=p).json()
    b = client.get("/api/iss/passes", params=p).json()
    assert len(llamadas) == 1 and a["passes"] == b["passes"]
    client.get("/api/iss/passes", params={**p, "lat": 10})
    assert len(llamadas) == 2
    # una pasada ya terminada (la que estaba en curso a las 00:00) no se devuelve aunque venga de la caché
    monkeypatch.setattr(iss, "_now", lambda: T0 + 400)
    c = client.get("/api/iss/passes", params=p).json()
    assert len(llamadas) == 2 and len(c["passes"]) == len(a["passes"]) - 1


def test_stale_si_celestrak_falla(net):
    p = {"lat": 40.42, "lon": -3.7, "days": 1}
    assert client.get("/api/iss/passes", params=p).json()["stale"] is False
    iss.resource.ts -= iss.resource.ttl + 1          # caduca la caché de elementos
    net.fail = True
    r = client.get("/api/iss/passes", params=p)
    assert r.status_code == 200
    d = r.json()
    assert d["stale"] is True and "stale" in d["warnings"] and d["passes"] is not None
    assert r.headers["cache-control"] == "public, max-age=30"
    # pausa tras el fallo: no se martillea a CelesTrak
    n = len(net.calls)
    client.get("/api/iss/passes", params=p)
    assert len(net.calls) == n
    # recuperado: vuelve a datos frescos
    net.fail = False
    iss.resource.last_error_ts -= iss.RETRY_AFTER + 1
    assert client.get("/api/iss/passes", params=p).json()["stale"] is False


def test_sin_datos_y_celestrak_caido_da_502_json(net):
    net.fail = True
    r = client.get("/api/iss/passes", params={"lat": 0, "lon": 0})
    assert r.status_code == 502
    assert "CelesTrak" in r.json()["detail"]
    assert r.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("estado", [403, 429, 500])
def test_errores_http_de_celestrak(net, estado):
    net.status, net.body = estado, "Forbidden"
    r = client.get("/api/iss/passes", params={"lat": 0, "lon": 0})
    assert r.status_code == 502 and "CelesTrak" in r.json()["detail"]


def test_respuesta_basura_de_celestrak(net):
    net.body = "No GP data found"
    r = client.get("/api/iss/passes", params={"lat": 0, "lon": 0})
    assert r.status_code == 502 and "inesperados" in r.json()["detail"]


def test_aviso_de_elementos_viejos(net, monkeypatch):
    monkeypatch.setattr(iss, "_now", lambda: unix("2026-11-17T23:00:00Z"))   # 3,05 días tras la época
    d = client.get("/api/iss/passes", params={"lat": 40.42, "lon": -3.7, "days": 1})
    j = d.json()
    assert j["elements"]["outdated"] is True and "elements_old" in j["warnings"]
    assert j["elements"]["age_days"] > 3
    assert d.headers["cache-control"] == "public, max-age=30"


@pytest.mark.parametrize("q", [
    {"lat": 91, "lon": 0}, {"lat": -91, "lon": 0}, {"lat": 0, "lon": 181}, {"lat": 0, "lon": 0, "days": 0},
    {"lat": 0, "lon": 0, "days": 11}, {"lat": 0, "lon": 0, "alt_m": 20000}, {"lat": "x", "lon": 0}, {"lon": 0},
])
def test_parametros_invalidos_422(net, q):
    r = client.get("/api/iss/passes", params=q)
    assert r.status_code == 422 and r.json()["detail"].startswith("Parámetro inválido")
    assert len(net.calls) == 0


def test_trayectoria_solo_en_las_visibles_por_defecto(net):
    base = {"lat": MADRID[0], "lon": MADRID[1], "alt_m": MADRID[2], "days": 3}
    d = client.get("/api/iss/passes", params=base).json()
    assert all((len(p["track"]) > 5) == p["visible"] for p in d["passes"])
    assert any(p["visible"] for p in d["passes"]) and any(not p["visible"] for p in d["passes"])
    a = client.get("/api/iss/passes", params={**base, "track": "all"}).json()
    assert all(len(p["track"]) > 5 for p in a["passes"])
    n = client.get("/api/iss/passes", params={**base, "track": "none"}).json()
    assert all(p["track"] == [] for p in n["passes"])
    assert client.get("/api/iss/passes", params={**base, "track": "x"}).status_code == 422
    assert len(json_size(d)) < len(json_size(a)) * 0.6


def test_una_sola_pasada_con_su_trayectoria(net):
    """`pass_start`: la vista Cielo pide la trayectoria de UNA pasada (también de día o en sombra)
    sin descargar la de todas con track=all."""
    base = {"lat": QUITO[0], "lon": QUITO[1], "alt_m": QUITO[2], "days": 5}
    todas = client.get("/api/iss/passes", params=base).json()["passes"]
    ocultas = [p for p in todas if not p["visible"]]
    assert ocultas and all(p["track"] == [] for p in ocultas)     # por defecto, sin trayectoria
    elegida = ocultas[1]
    r = client.get("/api/iss/passes", params={**base, "pass_start": elegida["start"]["t"]})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["pass_start"] == elegida["start"]["t"]
    assert len(d["passes"]) == 1
    p = d["passes"][0]
    assert p["id"] == elegida["id"] and p["visible"] is False and p["why_not_visible"] == elegida["why_not_visible"]
    # la trayectoria completa: del inicio al fin, cada ~10 s, con la culminación dentro
    assert len(p["track"]) > 20
    assert p["track"][0]["t"].startswith(p["start"]["t"][:16]) and p["track"][-1]["t"].startswith(p["end"]["t"][:16])
    assert max(q["alt"] for q in p["track"]) == pytest.approx(p["max_alt"], abs=0.05)
    # igual que la misma pasada en track=all (mismo cálculo, de la caché)
    a = client.get("/api/iss/passes", params={**base, "track": "all"}).json()["passes"]
    assert next(x for x in a if x["id"] == p["id"])["track"] == p["track"]
    # pesa mucho menos que track=all
    assert len(json_size(d)) < len(json_size({"passes": a})) / 8
    # holgura de ± 2 min sobre el inicio (dos cálculos pueden diferir en un segundo); fuera de ella, nada
    t0 = unix(elegida["start"]["t"])
    iso = lambda t: datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert client.get("/api/iss/passes", params={**base, "pass_start": iso(t0 + 50)}).json()["passes"][0]["id"] == p["id"]
    assert client.get("/api/iss/passes", params={**base, "pass_start": iso(t0 - 100) [:-1] + ".5Z"}).json()["passes"][0]["id"] == p["id"]
    assert client.get("/api/iss/passes", params={**base, "pass_start": iso(t0 + 1800)}).json()["passes"] == []
    # una visible también sale con su trayectoria, y `track` no la quita
    vis = next(x for x in todas if x["visible"]) if any(x["visible"] for x in todas) else None
    if vis:
        v = client.get("/api/iss/passes", params={**base, "track": "none", "pass_start": vis["start"]["t"]}).json()["passes"]
        assert len(v) == 1 and len(v[0]["track"]) > 20
    # mal formado o fecha imposible: 422, sin tocar CelesTrak de más
    n = len(net.calls)
    for bad in ["ayer", "2026-11-14 18:19:10", "2026-11-14T18:19:10", "2026-13-40T25:00:00Z"]:
        rr = client.get("/api/iss/passes", params={**base, "pass_start": bad})
        assert rr.status_code == 422 and rr.json()["detail"].startswith("Parámetro inválido"), (bad, rr.text)
    assert len(net.calls) == n


def test_pick_pass_y_parse_iso():
    assert iss.parse_iso_utc("2026-11-14T00:00:00Z") == T0
    assert iss.parse_iso_utc("2026-11-14T00:00:00.5Z") == T0 + 0.5
    with pytest.raises(ValueError):
        iss.parse_iso_utc("2026-11-14T00:00:00")
    ps = [{"start": {"t": "2026-11-14T00:00:00Z"}}, {"start": {"t": "2026-11-14T01:30:00Z"}}]
    assert iss.pick_pass(ps, T0 + 90) is ps[0]
    assert iss.pick_pass(ps, T0 + 5400 - 30) is ps[1]
    assert iss.pick_pass(ps, T0 + 2700) is None
    assert iss.pick_pass([], T0) is None


def json_size(d):
    import json
    return json.dumps(d)


def test_dias_por_defecto_y_limites(net):
    assert client.get("/api/iss/passes", params={"lat": 0, "lon": 0}).json()["window"]["days"] == 5
    assert client.get("/api/iss/passes", params={"lat": 0, "lon": 0, "days": 10}).json()["window"]["days"] == 10


def test_rendimiento_diez_dias():
    t = time.time()
    iss.compute_passes(ELEMENTS, *MADRID, T0, 10)
    assert time.time() - t < 5


def test_salud_incluye_iss(net):
    h = client.get("/api/health").json()
    assert "iss" in h["caches"] and h["caches"]["iss"]["ttl_s"] >= 7200
