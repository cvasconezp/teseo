"""Pruebas de las órbitas de los asteroides cercanos (app/asteroids.py)."""
from app import asteroids



# ── órbitas de los objetos (SBDB Query API): para situarlos en el cielo ──────────────────────────────────────────
def test_orbit_filter_one_regex_per_designation():
    import json as _json
    flt = _json.loads(asteroids.orbit_filter(["2018 NE1", "433", "P/2026 X1", ""]))
    # una expresión regular por objeto, con el espacio como comodín; las designaciones con otros signos se dejan
    assert flt == {"OR": ["pdes|RE|^2018.NE1$", "pdes|RE|^433$"]}
    assert asteroids.orbit_filter([]) == "" and asteroids.orbit_filter(["a/b"]) == ""


def test_parse_orbits_keeps_complete_rows_only():
    payload = {"fields": ["pdes", "q", "e", "i", "om", "w", "tp", "epoch"], "data": [
        ["2018 NE1", ".830949299119775", ".5716778647869499", "3.05759089183356", "289.8450411359509", "70.94553137320914", "2461324.896931184995", "2461200.5"],
        ["sin datos", None, "0.1", "1", "2", "3", "2461000.5", "2461200.5"],
    ]}
    out = asteroids.parse_orbits(payload)
    assert list(out) == ["2018 NE1"]
    el = out["2018 NE1"]
    assert abs(el["q"] - 0.830949299119775) < 1e-12 and abs(el["tp"] - 2461324.896931184995) < 1e-6 and el["epoch"] == 2461200.5
    assert asteroids.parse_orbits({}) == {} and asteroids.parse_orbits(None) == {}
