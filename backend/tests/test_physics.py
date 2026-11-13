"""Tests de la física orbital (hapsira) y de las ventanas de lanzamiento."""
import os, sys
from datetime import datetime
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.orbital import compute_hohmann_transfer, find_launch_windows, find_synodic_period_days


def test_hohmann_earth_mars_transfer_time():
    r = compute_hohmann_transfer("earth", "mars", datetime(2026, 7, 1)).to_dict()
    # Rango conocido Tierra->Marte ~259 días
    assert 250 <= r["transfer_time_days"] <= 270
    assert 5.0 <= r["delta_v_total_km_s"] <= 6.5
    assert r["is_outbound"] is True
    assert r["method"].startswith("Hohmann")


def test_hohmann_inbound_flag():
    r = compute_hohmann_transfer("mars", "earth", datetime(2026, 7, 1)).to_dict()
    assert r["is_outbound"] is False


@pytest.mark.parametrize("a,b", [("earth", "earth"), ("pluto", "mars"), ("earth", "luna")])
def test_invalid_routes_raise(a, b):
    with pytest.raises(ValueError):
        compute_hohmann_transfer(a, b, datetime(2026, 7, 1))


def test_synodic_earth_mars():
    assert 770 <= find_synodic_period_days("earth", "mars") <= 790


def test_launch_windows_structure():
    w = find_launch_windows("earth", "mars", datetime(2026, 7, 1), count=3)
    assert w["origin"] == "earth" and w["destination"] == "mars"
    assert len(w["windows"]) == 3
    assert all("departure_date" in x and "delta_v_km_s" in x for x in w["windows"])


def test_launch_windows_follow_real_alignment():
    """Las ventanas salen de la alineación real de los planetas, no de
    "hoy + período sinódico". Ventanas reales Tierra->Marte conocidas:
    nov-dic 2026, dic 2028-ene 2029, feb 2031."""
    w = find_launch_windows("earth", "mars", datetime(2026, 1, 1), count=3)["windows"]
    d = [datetime.fromisoformat(x["departure_date"]) for x in w]
    assert datetime(2026, 10, 15) <= d[0] <= datetime(2026, 12, 31)
    assert datetime(2028, 11, 15) <= d[1] <= datetime(2029, 1, 31)
    assert datetime(2031, 1, 1) <= d[2] <= datetime(2031, 3, 31)


def test_launch_windows_do_not_depend_on_query_day():
    """Regresión: antes la primera ventana era siempre la fecha de consulta."""
    a = find_launch_windows("earth", "mars", datetime(2026, 3, 1), count=1)["windows"][0]
    b = find_launch_windows("earth", "mars", datetime(2026, 9, 1), count=1)["windows"][0]
    da, db = (datetime.fromisoformat(x["departure_date"]) for x in (a, b))
    assert abs((da - db).total_seconds()) < 86400
    assert da > datetime(2026, 9, 1)


@pytest.mark.parametrize("a,b", [("earth", "venus"), ("mars", "earth"), ("earth", "jupiter"), ("mercury", "neptune")])
def test_launch_windows_spacing_matches_synodic(a, b):
    r = find_launch_windows(a, b, datetime(2026, 11, 13), count=3)
    d = [datetime.fromisoformat(x["departure_date"]) for x in r["windows"]]
    assert len(d) == 3 and d[0] >= datetime(2026, 11, 13)
    for x, y in zip(d, d[1:]):
        assert abs((y - x).days - r["synodic_period_days"]) < 0.12 * r["synodic_period_days"]
