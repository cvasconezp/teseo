"""Tests de los endpoints nuevos (lanzamientos, asteroides, misiones) y de
calidad (caché, `stale`, tiempos de espera, cabeceras, errores en JSON).

Sin red: httpx.AsyncClient se sustituye por un cliente simulado. Las formas
de respuesta simuladas se copiaron de respuestas REALES de cada proveedor
(13-nov-2026): Launch Library 2 v2.3.0 (modo detailed), JPL CAD API v1.5 y
JPL Horizons (efeméride de observador con QUANTITIES='1,19,20').
"""
import asyncio
import os
import sys
import time
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient

from app.main import app
from app import asteroids, cache, exoplanets, launches, main
from app import nasa_horizons as nh

client = TestClient(app)


# ─── Infraestructura de simulación ────────────────────────────────────────
class FakeResp:
    def __init__(self, payload, status_code=200):
        self._payload, self.status_code = payload, status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


class Provider:
    """Cliente httpx simulado: cuenta las peticiones y delega en `handler`."""

    def __init__(self, handler):
        self.handler = handler
        self.calls = []       # (url, params, headers)
        self.fail = False
        self.delay = 0.0
        outer = self

        class _Client:
            def __init__(self, *a, **k):
                self.headers = dict(k.get("headers") or {})

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def get(self, url, params=None, headers=None, **k):
                h = {**self.headers, **(headers or {})}
                outer.calls.append((url, dict(params or {}), h))
                if outer.delay:
                    await asyncio.sleep(outer.delay)
                if outer.fail:
                    raise RuntimeError("proveedor caído")
                return outer.handler(url, dict(params or {}))

        self.Client = _Client

    @property
    def n(self):
        return len(self.calls)


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    """Cada prueba empieza sin cachés y sin esperas de reintento."""
    def reset():
        for r in (launches.resource, asteroids.resource, exoplanets.resource):
            r.reset()
        nh._probe_set.reset(); nh._comet_set.reset()
        nh._position_cache.clear(); nh._last_good_position.clear()
        nh._horizons_lock = None
        main._windows_cache.clear()

    async def no_sleep(*a, **k):
        return None

    reset()
    monkeypatch.setattr(nh, "_retry_pause", no_sleep)
    monkeypatch.delenv("LL2_API_KEY", raising=False)
    monkeypatch.delenv("TESEO_USER_AGENT", raising=False)
    yield
    reset()


def install(monkeypatch, handler):
    p = Provider(handler)
    for mod in (launches, asteroids, exoplanets, nh):
        monkeypatch.setattr(mod.httpx, "AsyncClient", p.Client)
    return p


def expire(resource):
    """Hace caducar la caché de un recurso (como si hubiera pasado el TTL)."""
    resource.ts -= resource.ttl + 1


# ─── Lanzamientos (Launch Library 2) ──────────────────────────────────────
def ll2_launch(i, **over):
    """Un lanzamiento con la forma real de LL2 2.3.0 en modo detailed."""
    base = {
        "id": f"ef9850ad-1096-425b-9d27-{i:012d}",
        "name": f"Vulcan VC6L | Amazon Leo (LV-{i:02d})",
        "status": {"id": 1, "name": "Go for Launch", "abbrev": "Go", "description": "..."},
        "net": f"2026-11-{13 + i:02d}T17:54:00Z",
        "net_precision": {"id": 1, "name": "Minute", "abbrev": "MIN", "description": "..."},
        "image": {
            "id": 1864, "name": "Vulcan VC6L render",
            "image_url": "https://example.org/media/vulcan.jpg",
            "thumbnail_url": "https://example.org/media/vulcan_thumb.jpeg",
            "credit": "United Launch Alliance",
            "license": {"id": 10, "name": "ULA Image Use Policy", "link": "https://example.org/terms"},
        },
        "launch_service_provider": {
            "id": 124, "name": "United Launch Alliance", "abbrev": "ULA",
            "type": {"id": 3, "name": "Commercial"},
        },
        "rocket": {"id": 2836, "configuration": {"id": 479, "name": "Vulcan VC6L", "full_name": "Vulcan VC6L"}},
        "mission": {
            "id": 6003, "name": f"Amazon Leo (LV-{i:02d})", "type": "Communications",
            "description": "Amazon Leo is a constellation of satellites in Low Earth Orbit.",
            "orbit": {"id": 8, "name": "Low Earth Orbit", "abbrev": "LEO"},
            "info_urls": [], "vid_urls": [],
        },
        "pad": {
            "id": 29, "name": "Space Launch Complex 41",
            "country": {"id": 2, "name": "United States of America", "alpha_2_code": "US", "alpha_3_code": "USA"},
            "location": {"id": 12, "name": "Cape Canaveral SFS, FL, USA",
                         "country": {"alpha_2_code": "US", "alpha_3_code": "USA"}},
        },
        "webcast_live": False,
        "info_urls": [{"priority": 10, "source": "ulalaunch.com", "url": "https://example.org/info"}],
        "vid_urls": [
            {"priority": 10, "source": "youtube.com", "url": "https://example.org/watch-secondary"},
            {"priority": 9, "source": "youtube.com", "url": "https://example.org/watch-main"},
        ],
    }
    base.update(over)
    return base


def ll2_handler(results=None):
    results = [ll2_launch(i) for i in range(12)] if results is None else results
    return lambda url, params: FakeResp({"count": 476, "next": None, "previous": None, "results": results})


LAUNCH_KEYS = {
    "id": str, "name": str, "net": str, "net_precision": (str, type(None)), "status": str,
    "status_name": str, "provider": str, "provider_type": (str, type(None)), "rocket": str,
    "pad": (str, type(None)), "location": (str, type(None)), "country_code": (str, type(None)),
    "mission": (str, type(None)), "mission_type": (str, type(None)), "orbit": (str, type(None)),
    "description": (str, type(None)), "webcast_url": (str, type(None)), "info_url": (str, type(None)),
    "image": (str, type(None)), "image_credit": (str, type(None)),
}


def test_launches_contract(monkeypatch):
    p = install(monkeypatch, ll2_handler())
    r = client.get("/api/launches")
    assert r.status_code == 200
    d = r.json()
    assert d["source"] == "The Space Devs — Launch Library 2"
    assert d["stale"] is False
    datetime.strptime(d["updated"], "%Y-%m-%dT%H:%M:%SZ")
    assert len(d["launches"]) == 8  # limit por defecto
    for item in d["launches"]:
        for key, typ in LAUNCH_KEYS.items():
            assert key in item and isinstance(item[key], typ), key
        datetime.strptime(item["net"], "%Y-%m-%dT%H:%M:%SZ")  # ISO 8601 UTC
    first = d["launches"][0]
    assert first["status"] == "Go" and first["status_name"] == "Go for Launch"
    assert first["net_precision"] == "Minute"
    assert first["provider"] == "United Launch Alliance" and first["provider_type"] == "Commercial"
    assert first["rocket"] == "Vulcan VC6L" and first["country_code"] == "US"
    assert first["orbit"] == "Low Earth Orbit" and first["mission_type"] == "Communications"
    assert first["webcast_url"] == "https://example.org/watch-main"  # la de mayor prioridad
    assert first["info_url"] == "https://example.org/info"
    assert first["image_credit"] == "United Launch Alliance"
    # Una sola petición, a la URL vigente, sin clave por defecto
    assert p.n == 1
    url, params, headers = p.calls[0]
    assert url == "https://ll.thespacedevs.com/2.3.0/launches/upcoming/"
    assert params["limit"] == 20 and params["mode"] == "detailed"
    assert "Authorization" not in headers


def test_launches_cache_single_provider_request(monkeypatch):
    p = install(monkeypatch, ll2_handler())
    a = client.get("/api/launches?limit=3").json()
    b = client.get("/api/launches?limit=12").json()
    client.get("/api/launches?limit=1")
    assert p.n == 1  # `limit` solo recorta la caché: nunca otra petición
    assert len(a["launches"]) == 3 and len(b["launches"]) == 12
    assert a["updated"] == b["updated"]


def test_launches_api_key_header(monkeypatch):
    monkeypatch.setenv("LL2_API_KEY", "abc123")
    p = install(monkeypatch, ll2_handler())
    assert client.get("/api/launches").status_code == 200
    assert p.calls[0][2]["Authorization"] == "Token abc123"


def test_launches_stale_when_provider_fails_after_success(monkeypatch):
    p = install(monkeypatch, ll2_handler())
    ok = client.get("/api/launches").json()
    expire(launches.resource)
    p.fail = True
    r = client.get("/api/launches")
    assert r.status_code == 200
    d = r.json()
    assert d["stale"] is True and d["launches"] == ok["launches"]
    assert d["updated"] < ok["updated"]  # `updated` es la hora del dato servido, no la de ahora
    assert r.headers["cache-control"] == "public, max-age=30"
    assert p.n == 2
    # Pausa tras el fallo: no se vuelve a gastar cuota del proveedor
    assert client.get("/api/launches").json()["stale"] is True
    assert p.n == 2


def test_launches_clean_error_without_cache(monkeypatch):
    p = install(monkeypatch, ll2_handler())
    p.fail = True
    r = client.get("/api/launches")
    assert r.status_code == 502
    assert "Launch Library 2" in r.json()["detail"] and "proveedor caído" in r.json()["detail"]
    assert r.headers["cache-control"] == "no-store"


def test_launches_rate_limited_is_clean_error(monkeypatch):
    install(monkeypatch, lambda url, params: FakeResp({"detail": "throttled"}, status_code=429))
    r = client.get("/api/launches")
    assert r.status_code == 502 and "429" in r.json()["detail"]


@pytest.mark.parametrize("limit", ["0", "21", "-1", "abc"])
def test_launches_limit_validation(monkeypatch, limit):
    p = install(monkeypatch, ll2_handler())
    r = client.get(f"/api/launches?limit={limit}")
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str) and "limit" in r.json()["detail"]
    assert p.n == 0


def test_launches_tolerates_sparse_and_broken_items(monkeypatch):
    sparse = {"id": "x-1", "name": "Long March 2D | Unknown Payload", "net": "2026-11-12T00:00:00Z",
              "status": None, "net_precision": None, "image": None, "mission": None,
              "pad": None, "rocket": None, "launch_service_provider": None}
    broken = {"name": "sin id ni fecha"}
    install(monkeypatch, ll2_handler([ll2_launch(1), sparse, broken, "basura", ll2_launch(0)]))
    d = client.get("/api/launches?limit=20").json()
    assert [x["id"][-1] for x in d["launches"]] == ["1", "0", "1"]  # ordenado por fecha
    s = d["launches"][0]
    assert s["rocket"] == "Long March 2D" and s["mission"] is None and s["image"] is None
    assert s["webcast_url"] is None and s["status"] == "TBD"


# ─── Asteroides (JPL CAD) ─────────────────────────────────────────────────
CAD_FIELDS = ["des", "orbit_id", "jd", "cd", "dist", "dist_min", "dist_max", "v_rel",
              "v_inf", "t_sigma_f", "h", "diameter", "diameter_sigma", "fullname"]


def _jd_in(days):
    return (time.time() + days * 86400.0) / 86400.0 + 2440587.5


def cad_row(des, days, dist_au, v_rel="6.17123076393785", h="27.315", diameter=None, fullname=None):
    return [des, "3", f"{_jd_in(days):.9f}", "2026-Nov-13 02:12", str(dist_au), "0.0075", "0.0076",
            v_rel, "6.11", "< 00:01", h, diameter, None,
            fullname if fullname is not None else f"       ({des})"]


def cad_handler(rows=None):
    if rows is None:
        rows = [
            cad_row("2026 VP8", 0.5, "0.00757834243951672"),                 # 2,95 LD
            cad_row("2026 VO1", 2.0, "0.0251688784115416", h="24.719"),      # 9,79 LD
            cad_row("99942", 20.0, "0.0002", h="19.09", diameter="0.34",
                    fullname=" 99942 Apophis (2004 MN4)"),                   # 0,078 LD
            cad_row("2023 FP1", 45.0, "0.0267143320417208", h=None),         # 10,4 LD
        ]
    payload = {"signature": {"source": "NASA/JPL SBDB Close Approach Data API", "version": "1.5"},
               "count": len(rows), "fields": CAD_FIELDS, "data": rows}
    return lambda url, params: FakeResp(payload)


def test_asteroid_constants():
    assert asteroids.LD_KM == 384_400.0
    assert asteroids.AU_KM == 149_597_870.7
    assert nh.AU_KM == asteroids.AU_KM
    assert asteroids.AU_KM / asteroids.LD_KM == pytest.approx(389.17, abs=0.01)  # 1 au ≈ 389,17 LD


def test_diameter_estimate_known_cases():
    # H = 22 -> ~110–240 m (tabla de CNEOS para albedos 0,25–0,05)
    lo, hi = asteroids.estimate_diameter_m(22.0)
    assert lo == pytest.approx(105.8, abs=0.1) and hi == pytest.approx(236.6, abs=0.1)
    # Caso de referencia clásico: H = 17,75 con albedo 0,14 es 1 km
    assert asteroids.diameter_from_h_km(17.75, 0.14) == pytest.approx(1.0, abs=0.005)
    # El albedo oscuro siempre da el tamaño mayor, por un factor sqrt(5)
    assert hi / lo == pytest.approx(5 ** 0.5, rel=1e-3)
    assert asteroids.estimate_diameter_m(None) is None


def test_tdb_to_utc_conversion():
    # Fila real de JPL: jd 2461359.475136098 (TDB) = 2026-Nov-14 23:24 TDB
    assert asteroids.jd_tdb_to_utc(2461359.475136098).strftime("%Y-%m-%dT%H:%M:%SZ") == "2026-11-14T23:23:03Z"


def test_asteroids_contract(monkeypatch):
    p = install(monkeypatch, cad_handler())
    r = client.get("/api/asteroids")
    assert r.status_code == 200
    d = r.json()
    assert d["source"] == "NASA/JPL CNEOS — SBDB Close-Approach Data"
    assert d["stale"] is False
    datetime.strptime(d["updated"], "%Y-%m-%dT%H:%M:%SZ")
    # por defecto days=30, dist_ld=10: entran 3 de los 4
    assert d["count"] == 3 == len(d["objects"])
    assert [o["name"] for o in d["objects"]] == ["2026 VP8", "2026 VO1", "99942 Apophis (2004 MN4)"]
    dates = [o["date"] for o in d["objects"]]
    assert dates == sorted(dates)
    for o in d["objects"]:
        datetime.strptime(o["date"], "%Y-%m-%dT%H:%M:%SZ")
        for k in ("dist_ld", "dist_km", "dist_au", "v_rel_km_s"):
            assert isinstance(o[k], (int, float))
        assert o["dist_km"] == pytest.approx(o["dist_au"] * 149_597_870.7, rel=1e-4)
        assert o["dist_ld"] == pytest.approx(o["dist_km"] / 384_400.0, abs=2e-3)
        assert set(o) == {"name", "date", "dist_ld", "dist_km", "dist_au", "v_rel_km_s",
                          "h", "diameter_m", "diameter_est_m"}
    vp8, _, apophis = d["objects"]
    assert vp8["dist_km"] == pytest.approx(1_133_704, abs=2) and vp8["dist_ld"] == pytest.approx(2.949, abs=1e-3)
    assert vp8["v_rel_km_s"] == 6.17 and vp8["h"] == 27.315
    assert vp8["diameter_m"] is None                      # JPL no lo ha medido
    assert vp8["diameter_est_m"] == pytest.approx([9.2, 20.5], abs=0.1)
    assert apophis["diameter_m"] == 340.0                  # medido por JPL (km -> m)
    assert apophis["diameter_est_m"][0] < apophis["diameter_est_m"][1]
    # Una sola consulta con la ventana máxima; el filtrado es local
    assert p.n == 1
    url, params, _ = p.calls[0]
    assert url == "https://ssd-api.jpl.nasa.gov/cad.api"
    assert params == {"date-min": "now", "date-max": "+60", "dist-max": "20LD",
                      "sort": "date", "fullname": "true", "diameter": "true"}


def test_asteroids_cache_and_local_filtering(monkeypatch):
    p = install(monkeypatch, cad_handler())
    assert client.get("/api/asteroids?days=60&dist_ld=20").json()["count"] == 4
    assert client.get("/api/asteroids?days=1&dist_ld=20").json()["count"] == 1
    assert client.get("/api/asteroids?days=30&dist_ld=0.1").json()["count"] == 1   # solo Apophis
    one = client.get("/api/asteroids?days=60&dist_ld=20").json()["objects"][-1]
    assert one["h"] is None and one["diameter_est_m"] is None   # sin H no hay estimación
    assert p.n == 1


def test_asteroids_empty_result(monkeypatch):
    # Con count 0, JPL no envía `fields` ni `data`
    install(monkeypatch, lambda u, q: FakeResp({"signature": {"version": "1.5"}, "count": 0}))
    d = client.get("/api/asteroids").json()
    assert d["count"] == 0 and d["objects"] == [] and d["stale"] is False


def test_asteroids_stale_when_provider_fails_after_success(monkeypatch):
    p = install(monkeypatch, cad_handler())
    ok = client.get("/api/asteroids").json()
    expire(asteroids.resource)
    p.fail = True
    r = client.get("/api/asteroids")
    d = r.json()
    assert r.status_code == 200 and d["stale"] is True
    assert d["objects"] == ok["objects"] and d["updated"] < ok["updated"]


def test_asteroids_clean_error_without_cache(monkeypatch):
    p = install(monkeypatch, cad_handler())
    p.fail = True
    r = client.get("/api/asteroids")
    assert r.status_code == 502 and "CNEOS" in r.json()["detail"]
    bad = install(monkeypatch, lambda u, q: FakeResp({"message": "x", "code": "400"}, status_code=400))
    asteroids.resource.reset()
    assert client.get("/api/asteroids").status_code == 502 and bad.n == 1


@pytest.mark.parametrize("qs", ["days=0", "days=61", "days=x", "dist_ld=0.05", "dist_ld=20.5", "dist_ld=-1"])
def test_asteroids_param_validation(monkeypatch, qs):
    p = install(monkeypatch, cad_handler())
    r = client.get(f"/api/asteroids?{qs}")
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)
    assert p.n == 0


# ─── Sondas (Horizons) ────────────────────────────────────────────────────
# Fila real de Horizons para MMX con QUANTITIES='1,19,20'
ROW = (" 2026-Nov-13 00:00     140.30067  21.48242   0.993970886646   1.2490724"
       "  0.04399738485461   2.8901122")


def horizons_handler(unresolved=()):
    def handler(url, params):
        cmd = params.get("COMMAND", "").strip("'")
        if cmd in unresolved:  # así responde Horizons a un objeto que no resuelve
            return FakeResp({"result": f'No ephemeris for target "{cmd}"'})
        if params.get("EPHEM_TYPE") == "VECTORS":
            return FakeResp({"result": "$$SOE\n X = 1.0E+00 Y = 2.0E+00 Z = 3.0E-01\n$$EOE"})
        return FakeResp({"result": f"header\n$$SOE\n{ROW}\n$$EOE\nfooter"})
    return handler


LEGACY_PROBE_KEYS = {"ra_deg", "dec_deg", "nx", "ny", "nz", "dist_au", "dist_km",
                     "light_min", "approaching", "name", "note_es", "note_en"}


def test_probes_keep_shape_and_add_optional_fields(monkeypatch):
    p = install(monkeypatch, horizons_handler())
    r = client.get("/api/probes")
    assert r.status_code == 200
    d = r.json()
    assert {"objects", "count", "date", "source"} <= set(d)
    assert d["count"] == len(d["objects"]) == len(nh.SPACECRAFT) and d["stale"] is False
    by_name = {o["name"]: o for o in d["objects"]}
    for o in d["objects"]:
        assert LEGACY_PROBE_KEYS <= set(o)   # la forma que ya consume el frontend
        assert "target" in o and isinstance(o["agency"], str) and isinstance(o["launched"], int)
    # los nombres que ya existían no cambian
    for old in ("Voyager 1", "Voyager 2", "New Horizons", "Parker Solar Probe",
                "James Webb (JWST)", "Hubble (HST)", "Gaia"):
        assert old in by_name
    mmx = by_name["MMX"]
    assert mmx["target"] == "mars" and mmx["agency"] == "JAXA" and mmx["launched"] == 2026
    assert "status_note" in mmx and mmx["phase"] == "cruise"
    assert mmx["dist_au"] == 0.044 and mmx["sun_dist_au"] == 0.994
    assert mmx["dist_km"] == round(0.04399738485461 * 149_597_870.7)
    assert by_name["Voyager 1"]["target"] == "interstellar"
    assert by_name["James Webb (JWST)"]["target"] == "l2"
    assert by_name["Gaia"]["target"] is None and "2025" in by_name["Gaia"]["status_note"]
    # caché: la segunda llamada no vuelve a Horizons
    n = p.n
    assert n == len(nh.SPACECRAFT)
    assert client.get("/api/probes").json()["count"] == d["count"]
    assert p.n == n


def test_spacecraft_table_is_consistent():
    names = [s["name"] for s in nh.SPACECRAFT]
    cmds = {s["command"]: s["name"] for s in nh.SPACECRAFT}
    assert len(set(names)) == len(names) and len(cmds) == len(names)
    # Identificadores verificados contra Horizons el 13-nov-2026
    for cmd, name in {"-239": "MMX", "-9": "ESCAPADE Blue", "-10": "ESCAPADE Gold",
                      "-159": "Europa Clipper", "-28": "JUICE", "-61": "Juno", "-49": "Lucy",
                      "-255": "Psyche", "-121": "BepiColombo", "-91": "Hera",
                      "-144": "Solar Orbiter", "-96": "Parker Solar Probe",
                      "-170": "James Webb (JWST)", "-31": "Voyager 1", "-32": "Voyager 2",
                      "-98": "New Horizons"}.items():
        assert cmds[cmd] == name
    for s in nh.SPACECRAFT:
        assert s["agency"] and 1970 < s["launched"] <= 2026
        assert s["phase"] in (None, "cruise", "orbit")


def test_unresolved_probe_does_not_break_response(monkeypatch):
    """Un objeto que Horizons no resuelve se omite; el resto llega igual."""
    p = install(monkeypatch, horizons_handler(unresolved={"-239", "-9"}))
    r = client.get("/api/probes")
    assert r.status_code == 200
    d = r.json()
    names = {o["name"] for o in d["objects"]}
    assert "MMX" not in names and "ESCAPADE Blue" not in names
    assert "ESCAPADE Gold" in names and "Voyager 1" in names
    assert d["count"] == len(nh.SPACECRAFT) - 2
    assert "pending" not in d
    # y no se reintenta en cada visita
    n = p.n
    client.get("/api/probes")
    assert p.n == n
    # también si Horizons falla para TODOS: respuesta válida y vacía
    nh._probe_set.reset()
    p.fail = True
    r = client.get("/api/probes")
    assert r.status_code == 200 and r.json()["objects"] == [] and r.json()["count"] == 0


def test_probes_stale_per_object_when_horizons_fails_later(monkeypatch):
    p = install(monkeypatch, horizons_handler())
    assert client.get("/api/probes?date=2026-11-13").json()["stale"] is False
    p.fail = True
    r = client.get("/api/probes?date=2026-11-14")
    d = r.json()
    assert r.status_code == 200 and d["stale"] is True and d["date"] == "2026-11-14"
    assert d["count"] == len(nh.SPACECRAFT)
    assert all(o["stale"] is True and o["data_date"] == "2026-11-13" for o in d["objects"])
    assert r.headers["cache-control"] == "public, max-age=30"


def test_comets_keep_shape(monkeypatch):
    install(monkeypatch, horizons_handler(unresolved={"C/2023 A3;"}))
    d = client.get("/api/comets").json()
    assert d["count"] == len(nh.NOTABLE_COMETS) - 1
    assert {"ra_deg", "dec_deg", "nx", "ny", "nz", "dist_au", "dist_km", "light_min",
            "approaching", "name"} <= set(d["objects"][0])


def test_observer_row_parser_accepts_old_layout():
    old = nh._parse_observer_row("$$SOE\n 2026-Nov-13 00:00     125.08300   2.62080 34.7728000  -1.2345\n$$EOE")
    assert old["dist_au"] == 34.7728 and old["approaching"] is True and "sun_dist_au" not in old
    assert nh._parse_observer_row("No ephemeris for target") is None


# ─── Misiones a Marte ─────────────────────────────────────────────────────
def test_missions_mars(monkeypatch):
    install(monkeypatch, horizons_handler())
    r = client.get("/api/missions/mars")
    assert r.status_code == 200
    d = r.json()
    assert set(d) >= {"window", "spacecraft", "source", "stale"} and d["stale"] is False
    w = d["window"]
    assert w["origin"] == "earth" and w["destination"] == "mars"
    assert {"departure_date", "arrival_date", "transfer_time_days", "delta_v_km_s"} <= set(w)
    assert datetime.fromisoformat(w["departure_date"]) >= datetime.utcnow() - timedelta(days=1)
    assert 250 <= w["transfer_time_days"] <= 270
    # misma ventana que /api/launch-windows
    lw = client.get("/api/launch-windows/earth/mars?count=1").json()["windows"][0]
    assert abs((datetime.fromisoformat(lw["departure_date"])
                - datetime.fromisoformat(w["departure_date"])).total_seconds()) < 5
    names = [s["name"] for s in d["spacecraft"]]
    assert names == [s["name"] for s in nh.SPACECRAFT if s["target"] == "mars"]
    assert {"MMX", "ESCAPADE Blue", "ESCAPADE Gold"} <= set(names)
    for s in d["spacecraft"]:
        assert s["target"] == "mars"
        assert s["earth_dist_au"] == 0.044 and s["sun_dist_au"] == 0.994
        assert s["earth_dist_km"] == s["dist_km"] and s["sun_dist_km"] > 0


def test_missions_mars_never_invents_spacecraft(monkeypatch):
    """Sin Horizons y sin caché: lista vacía, pero la ventana (cálculo
    propio, sin red) sigue ahí y la respuesta es 200."""
    p = install(monkeypatch, horizons_handler())
    p.fail = True
    r = client.get("/api/missions/mars")
    assert r.status_code == 200
    d = r.json()
    assert d["spacecraft"] == [] and d["window"] is not None and d["stale"] is False


# ─── Coherencia de redondeo Ruta / Ventanas ───────────────────────────────
@pytest.mark.parametrize("a,b", [("earth", "mercury"), ("earth", "mars"), ("earth", "venus"),
                                 ("mars", "earth"), ("earth", "jupiter")])
def test_route_and_windows_report_same_transfer_time(a, b):
    """Regresión: Ruta decía "105 días" y Ventanas "106" para Tierra→Mercurio
    (105,47 d) porque un endpoint redondeaba a 2 decimales y el otro a 1."""
    route = client.post("/api/route", json={"origin": a, "destination": b, "include_narrative": False}).json()
    wins = client.get(f"/api/launch-windows/{a}/{b}?count=2").json()["windows"]
    assert wins
    for w in wins:
        assert w["transfer_time_days"] == route["transfer_time_days"]
        assert round(w["transfer_time_days"]) == round(route["transfer_time_days"])
    assert route["transfer_time_days"] == round(route["transfer_time_days"], 2)


def test_earth_mercury_is_105_days_everywhere():
    route = client.post("/api/route", json={"origin": "earth", "destination": "mercury", "include_narrative": False}).json()
    win = client.get("/api/launch-windows/earth/mercury?count=1").json()["windows"][0]
    assert route["transfer_time_days"] == win["transfer_time_days"] == 105.47


# ─── Calidad: cabeceras, salud, errores y tiempos de espera ───────────────
def test_cache_control_and_cors_headers(monkeypatch):
    install(monkeypatch, lambda url, params: (
        ll2_handler()(url, params) if "thespacedevs" in url
        else cad_handler()(url, params) if "cad.api" in url
        else horizons_handler()(url, params)))
    origin = {"Origin": "https://example.org"}
    expected = {
        "/api/launches": "public, max-age=300",
        "/api/asteroids": "public, max-age=900",
        "/api/probes": "public, max-age=600",
        "/api/comets": "public, max-age=600",
        "/api/missions/mars": "public, max-age=600",
        "/api/positions": "public, max-age=300",
        "/api/position/mars": "public, max-age=300",
        "/api/distance/earth/mars": "public, max-age=300",
        "/api/launch-windows/earth/mars": "public, max-age=3600",
        "/api/bodies": "public, max-age=86400",
        "/api/health": "no-store",
    }
    for path, value in expected.items():
        r = client.get(path, headers=origin)
        assert r.status_code == 200, path
        assert r.headers["cache-control"] == value, path
        assert r.headers["access-control-allow-origin"] == "*", path
    # los errores no se cachean y conservan CORS
    r = client.get("/api/position/pluton", headers=origin)
    assert r.status_code == 400 and r.headers["cache-control"] == "no-store"
    assert r.headers["access-control-allow-origin"] == "*"
    # preflight CORS intacto
    pre = client.options("/api/route", headers={**origin, "Access-Control-Request-Method": "POST"})
    assert pre.status_code == 200 and pre.headers["access-control-allow-origin"] == "*"
    # los POST no llevan caché pública
    r = client.post("/api/route", json={"origin": "earth", "destination": "mars", "include_narrative": False})
    assert r.headers["cache-control"] == "no-store"


def test_health_reports_caches_without_calling_providers(monkeypatch):
    p = install(monkeypatch, ll2_handler())
    d = client.get("/api/health").json()
    assert p.n == 0
    assert d["status"] == "ok" and d["version"] == app.version
    assert set(d["caches"]) == {"launches", "asteroids", "iss", "exoplanets", "positions", "probes", "comets"}
    assert d["caches"]["launches"]["has_data"] is False and d["caches"]["launches"]["age_s"] is None
    client.get("/api/launches")
    d = client.get("/api/health").json()
    assert p.n == 1
    c = d["caches"]["launches"]
    assert c["has_data"] is True and c["fresh"] is True and 0 <= c["age_s"] < 5 and c["last_error"] is None
    # tras un fallo, la salud lo cuenta
    expire(launches.resource); p.fail = True
    client.get("/api/launches")
    c = client.get("/api/health").json()["caches"]["launches"]
    assert c["fresh"] is False and "proveedor caído" in c["last_error"]


def test_errors_are_json_with_detail(monkeypatch):
    install(monkeypatch, horizons_handler())
    for path, code in [("/api/probes?date=ayer", 400), ("/api/comets?date=13/11/2026", 400),
                       ("/api/positions?date=xx", 400), ("/api/position/mars?date=xx", 400),
                       ("/api/position/vulcano", 400), ("/api/distance/earth/vulcano", 400),
                       ("/api/launch-windows/earth/earth", 400), ("/api/launch-windows/earth/mars?count=99", 422)]:
        r = client.get(path)
        assert r.status_code == code, path
        assert isinstance(r.json()["detail"], str) and r.json()["detail"], path

    def boom(*a, **k):
        raise KeyError("fallo inesperado")
    monkeypatch.setattr(main.orbital, "find_launch_windows", boom)
    r = client.get("/api/launch-windows/earth/saturn", headers={"Origin": "https://example.org"})
    assert r.status_code == 500 and "fallo inesperado" in r.json()["detail"]
    assert r.headers["access-control-allow-origin"] == "*"


def test_resource_wait_is_bounded_and_fills_cache_in_background():
    """Un proveedor lento no cuelga al visitante: se le responde enseguida y
    la descarga termina en segundo plano para la siguiente petición."""
    calls = {"n": 0}

    async def slow():
        calls["n"] += 1
        await asyncio.sleep(0.2)
        return {"ok": True}

    res = cache.Resource("test-slow", slow, ttl=60, wait=0.05)

    async def scenario():
        t0 = time.monotonic()
        with pytest.raises(cache.ProviderError) as e:
            await res.get()
        assert e.value.pending is True and time.monotonic() - t0 < 0.15
        # dos visitantes a la vez: una sola descarga (vuelo único)
        with pytest.raises(cache.ProviderError):
            await res.get()
        await asyncio.sleep(0.25)
        assert await res.get() == ({"ok": True}, False)
        assert calls["n"] == 1

    asyncio.run(scenario())
    cache.REGISTRY.pop("test-slow", None)


def test_slow_provider_gives_503_not_a_hang(monkeypatch):
    p = install(monkeypatch, ll2_handler())
    p.delay = 0.3
    monkeypatch.setattr(launches.resource, "wait", 0.05)
    t0 = time.monotonic()
    r = client.get("/api/launches")
    assert time.monotonic() - t0 < 2
    assert r.status_code == 503 and r.headers["retry-after"] == "5"
    assert "segundo plano" in r.json()["detail"]


def test_position_timeout_is_bounded(monkeypatch):
    p = install(monkeypatch, horizons_handler())
    p.delay = 0.3

    async def scenario():
        t0 = time.monotonic()
        with pytest.raises(RuntimeError, match="no respondió a tiempo"):
            await nh.get_body_position("mars", datetime(2026, 11, 13), timeout=0.05)
        assert time.monotonic() - t0 < 0.25
        # con un dato previo, se sirve `stale` en vez de fallar
        p.delay = 0.0
        ok = await nh.get_body_position("mars", datetime(2026, 11, 13))
        p.delay = 0.3
        late = await nh.get_body_position("mars", datetime(2026, 11, 14), timeout=0.05)
        assert late["stale"] is True and late["x_au"] == ok["x_au"]

    asyncio.run(scenario())


def test_probe_budget_returns_partial_and_finishes_in_background(monkeypatch):
    p = install(monkeypatch, horizons_handler())
    p.delay = 0.02
    monkeypatch.setattr(nh._probe_set, "budget", 0.07)

    async def scenario():
        t0 = time.monotonic()
        first = await nh.get_spacecraft_positions(datetime(2026, 11, 13))
        assert time.monotonic() - t0 < 0.3
        assert 0 < first["count"] < len(nh.SPACECRAFT)
        assert first["pending"] == len(nh.SPACECRAFT) - first["count"]
        await asyncio.sleep(0.02 * len(nh.SPACECRAFT) + 0.2)
        done = await nh.get_spacecraft_positions(datetime(2026, 11, 13))
        assert done["count"] == len(nh.SPACECRAFT) and "pending" not in done
        assert p.n == len(nh.SPACECRAFT)  # cada objeto se pidió una sola vez

    asyncio.run(scenario())


def test_exoplanets_stale_fallback(monkeypatch):
    rows = [{"pl_name": "Proxima Cen b", "hostname": "Proxima Cen", "ra": 217.4, "dec": -62.7,
             "sy_dist": 1.3, "pl_rade": 1.07, "pl_insol": 0.65}]
    p = install(monkeypatch, lambda u, q: FakeResp(rows))
    ok = client.get("/api/exoplanets").json()
    assert ok["count"] == 1 and ok["habitable"] == 1 and "stale" not in ok
    assert client.get("/api/exoplanets").json() == ok and p.n == 1
    expire(exoplanets.resource); p.fail = True
    d = client.get("/api/exoplanets").json()
    assert d["stale"] is True and d["objects"] == ok["objects"]
    exoplanets.resource.reset()
    assert client.get("/api/exoplanets").status_code == 502
