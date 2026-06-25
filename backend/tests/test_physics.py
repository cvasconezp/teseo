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
