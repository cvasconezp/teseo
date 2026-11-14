"""Pruebas de «Trayectoria realista» (app/lambert.py y GET /api/trajectory).

Validación contra referencias publicadas (todas verificadas en la web):

  * Mars 2020 (Perseverance): C3 = 14,49 km²/s² «at separation», lanzamiento el
    30-jul-2020 7:50 EDT (11:50 UTC), llegada el 18-feb-2021.
      - ULA, «Mars 2020 Mission Overview» (Atlas V 541):
        https://www.ulalaunch.com/docs/default-source/launch-booklets/mars2020_mobrochure_200717.pdf
      - NASA/JPL, dosier de prensa de Mars 2020 (fechas y 203 d de crucero):
        https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission
  * InSight: C3 = 8,19 km²/s² y DLA = −40,83° «at separation», lanzamiento el
    5-may-2018 4:05 PDT (11:05 UTC), aterrizaje el 26-nov-2018.
      - ULA, «InSight Mission Overview» (Atlas V 401):
        https://www.ulalaunch.com/docs/default-source/launch-booklets/mob_insightfinal.pdf
      - NASA NTRS 20190000334 (fecha de lanzamiento y aterrizaje).
  * Rango típico balístico Tierra→Marte: C3 ≈ 8–16 km²/s²
    (https://en.wikipedia.org/wiki/Characteristic_energy).

Las referencias son el C3 REAL de la nave tras la inyección; Lambert entre los
centros de la Tierra y de Marte lo reproduce con diferencias de décimas de
km²/s² (la misión apunta a un punto de entrada, no al centro del planeta).
"""
import os
import sys
import time
from datetime import datetime

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from astropy.time import Time

from app import lambert, main, orbital

client = TestClient(main.app)


@pytest.fixture(scope="module", autouse=True)
def _calentar():
    lambert.warm()


def _ventana_y_hohmann(origen, destino, hoy):
    w = orbital.find_launch_windows(origen, destino, hoy, 1)["windows"][0]
    h = orbital.compute_hohmann_transfer(
        origen, destino, datetime.fromisoformat(w["departure_date"])).to_dict()
    return w, h


# ─── Referencias publicadas ───────────────────────────────────────────────

def test_mars_2020_c3_publicado():
    """Fechas reales de Mars 2020 → C3 ≈ 14,49 publicado (tolerancia ±0,5)."""
    r = lambert.evaluate_trajectory("earth", "mars", datetime(2020, 7, 30, 11, 50), datetime(2021, 2, 18, 20, 55))
    assert abs(r["c3_km2_s2"] - 14.49) < 0.5, r["c3_km2_s2"]
    assert abs(r["transfer_time_days"] - 203.4) < 0.5          # «203 días» de crucero (JPL)
    assert 20 < r["departure_declination_deg"] < 26             # Mars 2020 salió con DLA positiva alta


def test_insight_c3_y_dla_publicados():
    """Fechas reales de InSight → C3 ≈ 8,19 y DLA ≈ −40,83° (tolerancia ±0,3 y ±1°)."""
    r = lambert.evaluate_trajectory("earth", "mars", datetime(2018, 5, 5, 11, 5), datetime(2018, 11, 26, 19, 52))
    assert abs(r["c3_km2_s2"] - 8.19) < 0.3, r["c3_km2_s2"]
    assert abs(r["departure_declination_deg"] - (-40.83)) < 1.0, r["departure_declination_deg"]


def test_minimo_ventana_2020_coherente_con_mars_2020():
    """El mínimo de la ventana 2020 no puede superar el C3 con que salió Mars 2020
    (no lanzó en el mínimo) y debe seguir en el rango balístico real (12–14,5)."""
    hoy = datetime(2020, 3, 1)
    w, h = _ventana_y_hohmann("earth", "mars", hoy)
    r = lambert.compute_trajectory("earth", "mars", w, h, hoy)
    o = r["optimum"]
    assert 12.0 < o["c3_km2_s2"] <= 14.49, o["c3_km2_s2"]
    assert o["departure_date"].startswith("2020-07")            # misma ventana que Mars 2020


def test_minimo_ventana_2018_coherente_con_insight():
    hoy = datetime(2018, 1, 1)
    w, h = _ventana_y_hohmann("earth", "mars", hoy)
    o = lambert.compute_trajectory("earth", "mars", w, h, hoy)["optimum"]
    assert 7.0 < o["c3_km2_s2"] <= 8.19 + 0.05, o["c3_km2_s2"]
    assert o["departure_date"][:7] in ("2018-04", "2018-05", "2018-06")


# ─── Ventana de 2026 ──────────────────────────────────────────────────────

def test_tierra_marte_2026_rango_plausible():
    hoy = datetime(2026, 6, 1)
    w, h = _ventana_y_hohmann("earth", "mars", hoy)
    assert w["departure_date"].startswith("2026-12")            # ventana de finales de 2026
    r = lambert.compute_trajectory("earth", "mars", w, h, hoy)
    o = r["optimum"]
    assert 8.0 <= o["c3_km2_s2"] <= 20.0, o["c3_km2_s2"]
    assert o["departure_date"][:4] == "2026" and o["departure_date"] >= "2026-10"
    assert 180 <= o["transfer_time_days"] <= 330
    # coherencia interna: C3 = v∞²
    assert o["c3_km2_s2"] == pytest.approx(o["v_inf_departure_km_s"] ** 2, abs=0.02)
    # inyección desde LEO 185 km: sqrt(v∞² + v_esc²) − v_circ
    mu, rr = 398600.4418, 6378.137 + 185
    esperado = np.sqrt(o["v_inf_departure_km_s"] ** 2 + 2 * mu / rr) - np.sqrt(mu / rr)
    assert o["injection"]["delta_v_km_s"] == pytest.approx(esperado, abs=0.002)
    assert o["injection"]["parking_altitude_km"] == 185
    assert o["insertion"]["body_radius_km"] == pytest.approx(3396.2, abs=0.5)
    assert o["insertion"]["body_mu_km3_s2"] == pytest.approx(42828.4, abs=1.0)
    # el mínimo de la cuadrícula del porkchop está cerca del mínimo afinado
    assert r["porkchop"]["c3_grid_min"] >= o["c3_km2_s2"] - 0.1
    assert r["porkchop"]["c3_grid_min"] - o["c3_km2_s2"] < 2.5


def test_porkchop_forma_y_contenido():
    hoy = datetime(2026, 6, 1)
    w, h = _ventana_y_hohmann("earth", "mars", hoy)
    p = lambert.compute_trajectory("earth", "mars", w, h, hoy)["porkchop"]
    n = lambert.PORK_N
    assert n <= 25 and len(p["departure_dates"]) == n and len(p["arrival_dates"]) == n
    assert len(p["c3_km2_s2"]) == n and all(len(f) == n for f in p["c3_km2_s2"])
    valores = [x for f in p["c3_km2_s2"] for x in f if x is not None]
    assert len(valores) > 20 and min(valores) > 0
    assert p["departure_dates"] == sorted(p["departure_dates"])
    assert p["not_before"] == "2026-06-01"      # salidas anteriores a «hoy» se marcan como pasadas


# ─── Cercanía a Hohmann con órbitas casi circulares ───────────────────────

def test_orbitas_circulares_coplanares_reproducen_hohmann(monkeypatch):
    """Con efemérides sintéticas circulares y coplanares, Lambert debe
    devolver Hohmann (C3, v∞ de llegada y tiempo de vuelo, ±3 %)."""
    jd0 = 2461000.5
    mu = lambert.MU_SUN

    def circular(body, jds):
        jds = np.atleast_1d(np.asarray(jds, dtype=float))
        a = orbital.SEMI_MAJOR_AXIS_AU[body] * 149597870.7
        n = np.sqrt(mu / a**3)                                  # rad/s
        th0 = {"earth": 0.0, "mars": required_phase}[body]
        th = th0 + n * (jds - jd0) * 86400.0
        pos = a * np.stack([np.cos(th), np.sin(th), 0 * th], axis=-1)
        vel = a * n * np.stack([-np.sin(th), np.cos(th), 0 * th], axis=-1)
        return pos, vel

    h = orbital.compute_hohmann_transfer("earth", "mars", datetime(2026, 12, 1)).to_dict()
    n_mars = np.sqrt(mu / (orbital.SEMI_MAJOR_AXIS_AU["mars"] * 149597870.7) ** 3)
    required_phase = np.pi - n_mars * h["transfer_time_days"] * 86400.0
    monkeypatch.setattr(lambert, "_body_state", circular)

    fecha = Time(jd0, format="jd", scale="tdb").utc.to_datetime()
    w = {"departure_date": fecha.isoformat(), "arrival_date": fecha.isoformat()}
    r = lambert.compute_trajectory("earth", "mars", w, h, fecha.replace(year=fecha.year - 1))
    o = r["optimum"]
    assert o["c3_km2_s2"] == pytest.approx(h["delta_v_departure_km_s"] ** 2, rel=0.03)
    assert o["v_inf_arrival_km_s"] == pytest.approx(h["delta_v_arrival_km_s"], rel=0.03)
    assert o["transfer_time_days"] == pytest.approx(h["transfer_time_days"], rel=0.03)
    # el bloque Hohmann devuelto es el de /api/route
    assert r["hohmann"]["c3_km2_s2"] == pytest.approx(h["delta_v_departure_km_s"] ** 2, abs=0.01)


def test_tierra_venus_real_cercano_a_hohmann():
    """Venus (e = 0,007) con la ventana real de jul-2026: C3 dentro de ±35 % de
    Hohmann y tiempo de vuelo dentro de ±30 %. La diferencia restante es la
    inclinación de 3,4° y la excentricidad."""
    hoy = datetime(2026, 1, 1)
    w, h = _ventana_y_hohmann("earth", "venus", hoy)
    r = lambert.compute_trajectory("earth", "venus", w, h, hoy)
    o, hoh = r["optimum"], r["hohmann"]
    assert o["c3_km2_s2"] == pytest.approx(hoh["c3_km2_s2"], rel=0.35)
    assert o["transfer_time_days"] == pytest.approx(hoh["transfer_time_days"], rel=0.30)


# ─── Asistencias gravitatorias ────────────────────────────────────────────

def test_notas_de_asistencia_solo_donde_corresponde():
    hoy = datetime(2026, 6, 1)
    w, h = _ventana_y_hohmann("earth", "jupiter", hoy)
    r = lambert.compute_trajectory("earth", "jupiter", w, h, hoy)
    assert r["needs_gravity_assist"] is True
    assert "Juno" in r["assist_note"]["es"] and "Juno" in r["assist_note"]["en"]
    assert r["optimum"]["insertion"] is None                    # sin órbita circular baja en un gigante
    w, h = _ventana_y_hohmann("earth", "mars", hoy)
    r = lambert.compute_trajectory("earth", "mars", w, h, hoy)
    assert r["needs_gravity_assist"] is False and r["assist_note"] is None


# ─── Endpoint ─────────────────────────────────────────────────────────────

def test_endpoint_trayectoria_ok_cache_y_cabeceras():
    main._trajectory_cache.clear()
    t0 = time.time()
    r = client.get("/api/trajectory", params={"origin": "earth", "destination": "mars"})
    primera = time.time() - t0
    assert r.status_code == 200
    d = r.json()
    for k in ("optimum", "hohmann", "porkchop", "method", "assumptions", "computed_for"):
        assert k in d
    assert r.headers["cache-control"] == "public, max-age=3600"
    assert d["origin"] == "earth" and d["destination"] == "mars"
    t0 = time.time()
    r2 = client.get("/api/trajectory", params={"origin": "Earth", "destination": "MARS"})
    assert r2.json() == d
    assert time.time() - t0 < 0.3 and primera < 5.0, (primera, time.time() - t0)


def test_endpoint_errores_en_json():
    r = client.get("/api/trajectory", params={"origin": "earth", "destination": "earth"})
    assert r.status_code == 400 and "detail" in r.json()
    r = client.get("/api/trajectory", params={"origin": "pluto", "destination": "mars"})
    assert r.status_code == 400 and "detail" in r.json()
    r = client.get("/api/trajectory", params={"origin": "earth"})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)
    assert r.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("destino", ["venus", "jupiter"])
def test_endpoint_otros_destinos_rapido(destino):
    t0 = time.time()
    r = client.get("/api/trajectory", params={"origin": "earth", "destination": destino})
    assert r.status_code == 200 and time.time() - t0 < 5.0
    assert r.json()["optimum"]["c3_km2_s2"] > 0
