"""Pruebas de «Planifica tu viaje con catapultas» (app/mga.py y GET /api/mga).

VALIDACIÓN contra misiones reales. Fechas y cifras verificadas en las fuentes:

  Cassini–Huygens (EVVEJS)
    * Lanzamiento 15-oct-1997 08:43:00 UTC — ESA, «Launch information»
      https://sci.esa.int/web/cassini-huygens/-/2083-launch-information
    * Venus 26-abr-1998 (284 km) y 24-jun-1999; Tierra 18-ago-1999 (1175 km); Júpiter
      30-dic-2000 (9,7 millones de km); llegada a Saturno 1-jul-2004 — NASA PDS, catálogo
      de la misión Cassini (MISSION.TXT, PPI Node):
      https://pds-ppi.igpp.ucla.edu/archive1/COMIMI_0VEN/EXTRAS/CATALOG/MISSION.TXT
      y NASA, Cassini Quick Facts (Júpiter: máximo acercamiento 5:12 a. m. EST = 10:12 UTC):
      https://science.nasa.gov/mission/cassini/quick-facts
    * C3 de inyección publicado: 16,6 km²/s² (PDS, MISSION.TXT).
    * En el periapsis: Venus 1, 11,8 km/s a 284 km; Tierra, 19,0 km/s a 1175 km; Júpiter,
      11,6 km/s a 9,7·10⁶ km; el sobrevuelo de Júpiter «aumentó la velocidad heliocéntrica
      en 2 km/s» (PDS). De ahí v∞ = √(v_p² − 2μ/r_p): Venus 6,06; Tierra 15,96; Júpiter 10,42.
    * Maniobra en espacio profundo del 3-dic-1998: 450 m/s — ESA, «Cassini-Huygens deep
      space manoeuvre completed»
      https://sci.esa.int/web/cassini-huygens/-/12007-cassini-huygens-deep-space-manoeuvre-completed
      Peralta y Flanagan (1995), «Cassini interplanetary trajectory design» (Control Eng.
      Practice 3(11)): sin esa maniobra, la trayectoria balística exige C3 ≈ 46 km²/s².
    Horas de los sobrevuelos de Venus, la Tierra y la llegada no verificadas: se usa
    mediodía UTC (±12 h cambian los v∞ < 0,2 km/s; comprobado).

  Galileo (VEEGA)
    * Lanzamiento 18-oct-1989 16:54 GMT; Venus 10-feb-1990 05:58:48 UTC (16 123 km);
      Tierra 8-dic-1990 20:34:34 UTC (960 km) y 8-dic-1992 15:09 UTC (~304 km) — NASA PDS,
      catálogo de la misión Galileo:
      https://pds.nasa.gov/data/go-l-nims-3-tube-v1.0/go_1103/catalog/mission.cat
    * Llegada a Júpiter 7-dic-1995 — JPL, dosier de prensa de llegada:
      https://www.jpl.nasa.gov/news/press_kits/gllarpk.pdf
    * C3 de lanzamiento: no se encontró un valor en fuente primaria; no se compara.

  Voyager 2 (EJSUN)
    * Lanzamiento 20-ago-1977 14:29:44 UT; Júpiter 9-jul-1979 22:29 UT (645 000 km);
      Saturno 26-ago-1981 01:21 UT (101 000 km); Urano 24-ene-1986 17:59 UT (81 500 km);
      Neptuno 25-ago-1989 03:56 UT — NASA, Voyager 2:
      https://science.nasa.gov/mission/voyager/voyager-2/
      (JPL da para Júpiter 350 000 millas sobre las nubes ≈ 634 800 km del centro).
    * Kohlhase y Penzo (1977), Space Sci. Rev. 21 (PDS PPI, VG_1502 MISSION.HTM): se
      planearon maniobras tras Júpiter para ajustar la llegada a Saturno. C3 publicado no
      encontrado en fuente primaria; no se compara.
"""
import math
import os
import sys
import time
from datetime import datetime

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from astropy.time import Time
from fastapi.testclient import TestClient

from app import lambert, main, mga

client = TestClient(main.app)


@pytest.fixture(scope="module", autouse=True)
def _calentar():
    lambert.warm()
    mga.warm()


def jd(s):
    return Time(s, scale="utc").tdb.jd


def vinf_from_periapsis(body, vp, alt_km):
    mu, r = mga.body_consts(body)
    return math.sqrt(vp**2 - 2 * mu / (r + alt_km))


CASSINI = ["1997-10-15T08:43:00", "1998-04-26T12:00:00", "1999-06-24T12:00:00",
           "1999-08-18T12:00:00", "2000-12-30T10:12:00", "2004-07-01T12:00:00"]
GALILEO = ["1989-10-18T16:54:00", "1990-02-10T05:58:48", "1990-12-08T20:34:34",
           "1992-12-08T15:09:00", "1995-12-07T22:00:00"]
VOYAGER2 = ["1977-08-20T14:29:44", "1979-07-09T22:29:00", "1981-08-26T01:21:00",
            "1986-01-24T17:59:00", "1989-08-25T03:56:00"]


# ─── Fórmulas del sobrevuelo ──────────────────────────────────────────────

def test_giro_sin_motor_cumple_formula_estandar():
    """|v∞| igual a la entrada y a la salida y giro δ < δ_max: ΔV ≈ 0 y el r_p
    cumple sin(δ/2) = 1/(1 + r_p·v∞²/μ)."""
    mu, R = mga.body_consts("venus")
    v, d = 6.0, math.radians(30.0)
    vin = np.array([[v, 0.0, 0.0]])
    vout = np.array([[v * math.cos(d), v * math.sin(d), 0.0]])
    dv, rp, dl, dm = mga._flyby_rows(vin, vout, mu, mga.RP_MIN_KM["venus"])
    assert dv[0] < 1e-6
    assert math.isclose(math.sin(dl[0] / 2), 1 / (1 + rp[0] * v**2 / mu), rel_tol=1e-8)
    # δ_max con r_p mínimo (radio + 300 km)
    rpm = R + 300
    assert math.isclose(math.sin(dm[0] / 2), 1 / (1 + rpm * v**2 / mu), rel_tol=1e-9)
    assert mga.RP_MIN_KM["venus"] == pytest.approx(rpm)


def test_sobrevuelo_propulsado_formula_y_limite_de_giro():
    mu, _ = mga.body_consts("earth")
    rpm = mga.RP_MIN_KM["earth"]
    # Sin giro: r_p → ∞ y el impulso es la diferencia de |v∞|
    dv, rp, _, _ = mga._flyby_rows(np.array([[5.0, 0, 0]]), np.array([[6.0, 0, 0]]), mu, rpm)
    assert dv[0] == pytest.approx(1.0, abs=2e-3) and rp[0] > 1e8
    # Con giro y |v∞| distinto: ΔV = |√(vo²+2μ/rp) − √(vi²+2μ/rp)| con el r_p que da el giro
    vin, vout = np.array([[5.0, 0, 0]]), 6.0 * np.array([[math.cos(0.5), math.sin(0.5), 0]])
    dv, rp, dl, dm = mga._flyby_rows(vin, vout, mu, rpm)
    assert dl[0] < dm[0]
    turn = math.asin(1 / (1 + rp[0] * 25 / mu)) + math.asin(1 / (1 + rp[0] * 36 / mu))
    assert turn == pytest.approx(0.5, abs=1e-9)
    assert dv[0] == pytest.approx(abs(math.sqrt(36 + 2 * mu / rp[0]) - math.sqrt(25 + 2 * mu / rp[0])), abs=1e-9)
    # Giro imposible (180°): r_p mínimo + coste de girar lo que falta
    dv, rp, dl, dm = mga._flyby_rows(np.array([[8.0, 0, 0]]), np.array([[-8.0, 0, 0]]), mu, rpm)
    assert rp[0] == pytest.approx(rpm) and dl[0] > dm[0]
    assert dv[0] == pytest.approx(2 * 8.0 * math.sin((dl[0] - dm[0]) / 2), abs=1e-9)


def test_periapsis_minimos_documentados():
    _, rj = mga.body_consts("jupiter")
    assert mga.RP_MIN_KM["jupiter"] == pytest.approx(4 * rj)
    assert mga.RP_MIN_KM["saturn"] > 139826          # por fuera del anillo F (NSSDC)
    assert mga.RP_MIN_KM["uranus"] > 51149           # anillo ε
    assert mga.RP_MIN_KM["earth"] == pytest.approx(6378.137 + 300)


def test_interpolacion_hermite_frente_a_astropy():
    """Tabla diaria + Hermite: error < 100 km en posición y < 15 m/s en velocidad.
    Es del orden de la propia incoherencia de plan94 (su velocidad difiere de la
    derivada de su posición en ~5 m/s en Júpiter y ~13 m/s en Mercurio) e
    irrelevante frente a los v∞ (km/s) y periapsis (miles de km) en juego."""
    base = 2461358.5
    for body in ("mercury", "earth", "jupiter"):
        mga._table(body, base, 400)
        t = base + np.array([3.25, 77.6, 151.9, 300.01])
        r1, v1 = mga.state_at(body, t)
        r2, v2 = lambert._body_state(body, t)
        assert np.max(np.linalg.norm(r1 - r2, axis=1)) < 100.0, body
        assert np.max(np.linalg.norm(v1 - v2, axis=1)) < 0.015, body
    # incoherencia propia de plan94 (diferencia finita frente a su velocidad)
    p, v = lambert._body_state("jupiter", base + np.array([100.0, 100.5, 101.0]))
    assert np.linalg.norm((p[2] - p[0]) / 86400 - v[1]) < 0.015


def test_cono_resonante_conserva_v_inf_y_periodo():
    """Órbita resonante 2:1 en la Tierra: |v∞| se conserva y la órbita de la nave
    tiene periodo de 2 años sidéreos (semieje 1,587 UA)."""
    r, v = lambert._body_state("earth", np.array([2461358.5]))
    c, s, e1, e2, e3, ok = mga._cone(r, v, np.array([8.9]), "earth", 2, 1)
    assert ok[0]
    w = mga._cone_vec(c, s, e1, e2, e3, np.linspace(0, 2 * np.pi, 7))[0]
    assert np.allclose(np.linalg.norm(w, axis=1), 8.9)
    vs = v[0] + w[3]
    a = 1 / (2 / np.linalg.norm(r[0]) - np.dot(vs, vs) / mga.MU_SUN)
    assert a / mga.AU_KM == pytest.approx(1.587, abs=0.002)
    assert 2 * np.pi * math.sqrt(a**3 / mga.MU_SUN) / 86400 == pytest.approx(2 * 365.256, abs=0.1)


# ─── Validación contra misiones reales ────────────────────────────────────

def test_cassini_evvejs():
    d = mga.evaluate(mga.seq_of("EVVEJS"), [jd(x) for x in CASSINI], exact=True)
    assert d is not None and all(b == (0, True) for b in d["branches"])
    v1, v2, e, j = d["flybys"]
    # C3 publicado 16,6 km²/s² (calculado: 16,3)
    assert abs(d["c3"] - 16.6) < 0.6, d["c3"]
    # Venus 1: v∞ de llegada ≈ 6,06 km/s (PDS: 11,8 km/s en el periapsis a 284 km)
    assert abs(v1["v_inf_in"] - vinf_from_periapsis("venus", 11.8, 284)) < 0.3
    # Tierra: v∞ ≈ 15,96 km/s a la entrada y a la salida (PDS: 19,0 km/s a 1175 km)
    ve = vinf_from_periapsis("earth", 19.0, 1175)
    assert abs(e["v_inf_in"] - ve) < 0.3 and abs(e["v_inf_out"] - ve) < 0.3
    # Júpiter: v∞ ≈ 10,4 km/s; +2 km/s de rapidez heliocéntrica (PDS); r_p del orden de 9,8·10⁶ km
    vj = vinf_from_periapsis("jupiter", 11.6, 9.7e6)
    assert abs(j["v_inf_in"] - vj) < 0.4 and abs(j["v_inf_out"] - vj) < 0.4
    assert abs(j["helio_gain"] - 2.0) < 0.4
    assert 0.75 < j["rp_km"] / (9.7e6 + mga.body_consts("jupiter")[1]) < 1.25
    # Del 2.º Venus en adelante no hubo maniobras grandes: |v∞| se conserva en la Tierra y Júpiter
    assert abs(e["v_inf_in"] - e["v_inf_out"]) < 0.25 and abs(j["v_inf_in"] - j["v_inf_out"]) < 0.25
    # DISCREPANCIA DOCUMENTADA: entre los dos Venus, Cassini hizo una maniobra de 450 m/s
    # (3-dic-1998, cerca del afelio). Lambert sin maniobra no puede reproducir ese tramo: los
    # v∞ de Venus no casan (|v∞,out| − |v∞,in| ≈ +1 km/s en V1 y ≈ +2,4 en V2). Una maniobra
    # en el afelio cambia el perihelio, y por tanto v∞ en Venus, mucho más que su propio Δv.
    assert v1["v_inf_out"] - v1["v_inf_in"] > 0.5 and v2["v_inf_out"] - v2["v_inf_in"] > 1.0


def test_galileo_veega_con_resonancia_2_1():
    d = mga.evaluate(mga.seq_of("EVEEJ"), [jd(x) for x in GALILEO], exact=True)
    assert d is not None
    assert d["branches"][2] == ("res", 2, 1)          # dos años: la Tierra da 2 vueltas, Galileo 1
    v, e1, e2 = d["flybys"]
    # Venus: altitud publicada 16 123 km (calculada: ~16 000)
    assert abs(v["altitude_km"] - 16123) / 16123 < 0.10, v["altitude_km"]
    assert abs(v["v_inf_in"] - v["v_inf_out"]) < 0.3
    # Con la resonancia, la trayectoria es casi balística (Galileo no hizo maniobras grandes)
    assert d["powered_dv"] < 0.35, d["powered_dv"]
    assert abs(e1["v_inf_in"] - e2["v_inf_out"]) < 0.3
    # Altitudes plausibles en la Tierra (publicadas 960 y ~304 km; modelo sin maniobras pequeñas)
    assert 250 < e1["altitude_km"] < 2000 and 250 < e2["altitude_km"] < 2000
    assert 10 < d["c3"] < 20                           # trayectoria de baja energía (no hay C3 publicado verificado)
    # Lambert puro en el tramo Tierra–Tierra (sin resonancia) degenera: desajuste de varios km/s
    lam = mga.evaluate(mga.seq_of("EVEEJ"), [jd(x) for x in GALILEO], exact=True,
                       branches=[(0, True), (0, True), (1, True), (0, True)])
    assert lam["powered_dv"] > 2.0


def test_voyager2_ejsun():
    d = mga.evaluate(mga.seq_of("EJSUN"), [jd(x) for x in VOYAGER2], exact=True)
    j, s, u = d["flybys"]
    for f in (j, s, u):
        assert abs(f["v_inf_in"] - f["v_inf_out"]) < 0.15, f
        assert not f["turn_limited"]
    assert d["powered_dv"] < 0.15
    # Periapsis requeridos frente a los publicados (NASA): Júpiter ~645 000 km, Saturno
    # 60 268 + 101 000 km, Urano 25 559 + 81 500 km.
    assert abs(j["rp_km"] / 645000 - 1) < 0.15, j["rp_km"]
    assert abs(s["rp_km"] / (60268 + 101000) - 1) < 0.10, s["rp_km"]
    assert abs(u["rp_km"] / (25559 + 81500) - 1) < 0.05, u["rp_km"]
    # Júpiter fue el gran impulso: > 8 km/s de rapidez respecto al Sol
    assert j["helio_gain"] > 8


# ─── Búsqueda desde «hoy» (cuadrícula reducida) ───────────────────────────

SMALL = mga.SearchConfig(dep_step=24, tof_samples=10, beam=3, bin_days=120, refine_per_seq=1,
                         refine_maxfev=50, phi_grid=6, passes=((0.0, 0),), quick_per_seq=4, quick_maxfev=20)
HOY = datetime(2026, 11, 14)


@pytest.fixture(scope="module")
def saturno():
    t = time.time()
    r = mga.plan("saturn", today=HOY, cfg=SMALL)
    r["_t"] = time.time() - t
    return r


def test_saturno_hay_opciones_mejores_que_el_directo(saturno):
    r = saturno
    best, direct = r["best"], r["direct"]["best"]
    assert best is not None and direct is not None
    assert not best["is_direct"] and best["viable_without_dsm"]
    # menos Δv de inyección (y menos coste) que el directo
    assert best["injection_delta_v_km_s"] < direct["injection_delta_v_km_s"] - 0.5
    assert best["cost_km_s"] < direct["cost_km_s"]
    assert r["assists_help"] is True
    # el directo Lambert queda cerca de Hohmann (C3 ~ 106 km²/s²)
    assert abs(direct["c3_km2_s2"] - r["direct"]["hohmann"]["c3_km2_s2"]) < 15
    assert r["_t"] < 25, r["_t"]


def test_saturno_forma_de_las_opciones(saturno):
    r = saturno
    assert 3 <= len(r["options"]) <= 5
    ids = [o["id"] for o in r["options"]]
    assert len(set(ids)) == len(ids)                    # distintas (secuencia + fecha)
    for o in r["options"]:
        assert o["departure_date"] >= "2026-11-14"
        assert o["c3_km2_s2"] == pytest.approx(o["v_inf_departure_km_s"] ** 2, abs=0.2)
        assert o["cost_km_s"] == pytest.approx(o["injection_delta_v_km_s"] + o["powered_delta_v_km_s"], abs=2e-3)
        assert len(o["legs"]) == len(o["sequence"]) - 1 and len(o["flybys"]) == len(o["sequence"]) - 2
        assert [e["kind"] for e in o["events"]] == ["launch"] + ["flyby"] * len(o["flybys"]) + ["arrival"]
        dates = [e["date"] for e in o["events"]]
        assert dates == sorted(dates)
        for leg in o["legs"]:
            assert len(leg["path_au"]) > 10
        mu = 398600.4418
        rr = 6378.137 + 185
        assert o["injection_delta_v_km_s"] == pytest.approx(
            math.sqrt(o["v_inf_departure_km_s"] ** 2 + 2 * mu / rr) - math.sqrt(mu / rr), abs=0.01)
        assert o["viable_without_dsm"] == (o["max_flyby_delta_v_km_s"] <= 0.5)
    # el directo está como referencia
    assert any(o["is_direct"] for o in r["options"])
    # la próxima oportunidad con Júpiter y el ciclo Júpiter–Saturno (~19,9 años)
    assert r["jupiter_cycle_years"] == pytest.approx(19.9, abs=0.2)
    nj = r["next_jupiter"]
    assert nj is not None and "jupiter" in nj["sequence"][1:-1]
    assert r["criterion"] == "injection_plus_powered_flybys"
    assert r["horizon"]["from"] == "2026-11-14" and r["horizon"]["to"] >= "2051-11-13"


def test_marte_directo_y_cronologico():
    r = mga.plan("mars", today=HOY, cfg=SMALL)
    assert r["assists_help"] is False
    assert all(o["is_direct"] for o in r["options"])
    deps = [o["departure_date"] for o in r["options"]]
    assert deps == sorted(deps) and len(deps) >= 3
    # ventanas a Marte cada ~26 meses
    gaps = np.diff([datetime.fromisoformat(d).toordinal() for d in deps])
    assert all(600 < g < 950 for g in gaps), gaps
    for o in r["options"]:
        assert 7.5 < o["c3_km2_s2"] < 20


def test_origen_distinto_de_la_tierra_no_se_calcula():
    with pytest.raises(ValueError):
        mga.plan("saturn", origin="mars", today=HOY, cfg=SMALL)


# ─── Servicio con caché y endpoint ────────────────────────────────────────

def _fake_plan(destination, origin="earth", today=None, cfg=None, progress=None):
    time.sleep(0.05)
    return {"status": "ok", "origin": "earth", "destination": destination, "algo_version": mga.ALGO_VERSION,
            "best": {"departure_date": "2030-01-01"}, "options": [{"departure_date": "2030-01-01"}],
            "earliest": None, "next_jupiter": None}


def _wait(svc, dest, timeout=10):
    t = time.time()
    while time.time() - t < timeout:
        st, data = svc.get(dest)
        if st == "ok":
            return data
        time.sleep(0.05)
    raise AssertionError("no terminó")


def test_servicio_202_luego_200_y_persistencia(tmp_path, monkeypatch):
    monkeypatch.setattr(mga, "plan", _fake_plan)
    clock = lambda: datetime(2026, 11, 14, 12).timestamp()
    svc = mga.MgaService(str(tmp_path), clock=clock)
    st, data = svc.get("saturn")
    assert st == "computing" and data["status"] == "computing"
    got = _wait(svc, "saturn")
    assert got["computed_for"] == "2026-11-14"
    assert (tmp_path / "teseo-mga-saturn.json").exists()
    # otro proceso (p. ej. tras un redespliegue) lo lee del disco sin recalcular
    svc2 = mga.MgaService(str(tmp_path), clock=clock)
    st, data = svc2.get("saturn")
    assert st == "ok" and data["destination"] == "saturn" and "refreshing" not in data
    # pasados 7 días se sigue sirviendo, pero se recalcula en segundo plano
    later = lambda: datetime(2026, 11, 25, 12).timestamp()
    svc3 = mga.MgaService(str(tmp_path), clock=later)
    st, data = svc3.get("saturn")
    assert st == "ok" and data.get("refreshing") is True
    # si una opción ya salió, no se sirve: se recalcula
    gone = lambda: datetime(2030, 2, 1).timestamp()
    svc4 = mga.MgaService(str(tmp_path), clock=gone)
    st, _ = svc4.get("saturn")
    assert st == "computing"


def test_endpoint_mga(tmp_path, monkeypatch):
    monkeypatch.setattr(mga, "plan", _fake_plan)
    svc = mga.MgaService(str(tmp_path))
    monkeypatch.setattr(main, "mga_service", svc)
    r = client.get("/api/mga", params={"origin": "earth", "destination": "jupiter"})
    assert r.status_code == 202 and r.headers["retry-after"] and r.headers["cache-control"] == "no-store"
    assert r.json()["status"] == "computing"
    _wait(svc, "jupiter")
    r = client.get("/api/mga", params={"origin": "earth", "destination": "jupiter"})
    assert r.status_code == 200 and r.json()["destination"] == "jupiter"
    assert r.headers["cache-control"] == "public, max-age=3600"
    # solo desde la Tierra
    r = client.get("/api/mga", params={"origin": "mars", "destination": "saturn"})
    assert r.status_code == 200 and r.json()["status"] == "earth_only"
    assert "Tierra" in r.json()["message"]["es"] and "Earth" in r.json()["message"]["en"]
    # errores en JSON
    r = client.get("/api/mga", params={"origin": "earth", "destination": "pluton"})
    assert r.status_code == 400 and "detail" in r.json()
    r = client.get("/api/mga", params={"origin": "earth", "destination": "earth"})
    assert r.status_code == 400
    r = client.get("/api/mga", params={"origin": "earth"})
    assert r.status_code == 422
    # estado en /api/health (sin recuentos)
    h = client.get("/api/health").json()
    assert "mga" in h and "jupiter" in h["mga"]["cached"]


def test_endpoint_error_de_calculo_es_503(tmp_path, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("fallo simulado")
    monkeypatch.setattr(mga, "plan", boom)
    svc = mga.MgaService(str(tmp_path))
    monkeypatch.setattr(main, "mga_service", svc)
    client.get("/api/mga", params={"destination": "uranus"})
    t = time.time()
    while time.time() - t < 5:
        r = client.get("/api/mga", params={"destination": "uranus"})
        if r.status_code != 202:
            break
        time.sleep(0.05)
    assert r.status_code == 503 and "fallo simulado" in r.json()["detail"]
