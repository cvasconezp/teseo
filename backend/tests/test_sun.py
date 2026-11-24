"""Tests de «El Sol hoy» (app/sun.py). Sin red: httpx.AsyncClient se sustituye por un
cliente simulado. Las formas simuladas se copiaron de respuestas REALES (16-nov-2026) de
SILSO (EISN_current.csv), NOAA SWPC (solar_regions, xray-flares-7-day, noaa-planetary-k-index,
observed/predicted-solar-cycle) y de la cabecera Last-Modified de SDO."""
import os
import sys
from datetime import datetime, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient

from app.main import app
from app import sun

client = TestClient(app)

NOW = datetime(2026, 11, 16, 14, 0, tzinfo=timezone.utc)

SILSO_CSV = (
    "2026, 11, 14, 2026.870,  -1,  -1.0,   0,   9,\n"
    "2026, 11, 15, 2026.873, 117,   7.7,   7,   9,\n"
    "2026, 11, 16, 2026.875,  98,   5.7,   7,   9,\n"
    "2026, 11, 17, 2026.878,  -1,  -1.0,   0,   0,\n"      # sin dato: se ignora
)


def region(n, loc, area, cls, spots, mag, c=10, m=1, x=1, day="2026-11-16"):
    return {"observed_date": day, "region": n, "latitude": 0, "longitude": 0, "location": loc,
            "carrington_longitude": 36, "area": area, "spot_class": cls, "extent": 1, "number_spots": spots,
            "mag_class": mag, "mag_string": None, "status": "f", "c_xray_events": 0, "m_xray_events": 0,
            "x_xray_events": 0, "proton_events": None, "c_flare_probability": c, "m_flare_probability": m,
            "x_flare_probability": x, "proton_probability": 1, "first_date": "2026-11-11T11:02:26"}


REGIONS = [
    region(4575, "S09W02", 20, "Hsx", 1, "A"),
    region(4579, "N15E45", 170, "Hsx", 1, "A", c=30),
    region(4570, "S09W90", None, None, None, None),     # en el limbo: sin área medida
    region(4574, "N17W07", 50, "Dai", 5, "B"),
    region(4500, "S10W10", 999, "Eki", 9, "BG", day="2026-11-15"),   # día anterior: no cuenta
]


def flare(peak, cls, begin=None):
    return {"time_tag": peak, "begin_time": begin or peak, "begin_class": "B8.0", "max_time": peak,
            "max_class": cls, "max_xrlong": 1e-6, "max_ratio": 0.1, "max_ratio_time": peak,
            "current_int_xrlong": 0.006, "end_time": peak, "end_class": "B9.0", "satellite": 18}


FLARES = [  # orden cronológico ascendente, como la fuente real
    flare("2026-11-08T18:27:00Z", "M1.1"),   # fuera de las 24 h
    flare("2026-11-15T12:01:00Z", "B8.1"),   # a más de 24 h de NOW
    flare("2026-11-15T17:20:00Z", "C2.4"),
    flare("2026-11-16T05:10:00Z", "B9.9"),
    flare("2026-11-16T09:30:00Z", "C1.1"),
]

KP = [
    {"time_tag": "2026-11-16T03:00:00", "Kp": 0.33, "a_running": 2, "station_count": 8},
    {"time_tag": "2026-11-16T06:00:00", "Kp": 0.33, "a_running": 2, "station_count": 8},
    {"time_tag": "2026-11-16T09:00:00", "Kp": 0.67, "a_running": 3, "station_count": 8},
]

OBSERVED = [
    {"time-tag": "1999-01", "ssn": 93.3, "smoothed_ssn": 90.0, "observed_swpc_ssn": -1.0, "smoothed_swpc_ssn": -1.0, "f10.7": -1.0, "smoothed_f10.7": -1.0},
    {"time-tag": "2008-12", "ssn": 0.8, "smoothed_ssn": 2.2, "observed_swpc_ssn": -1.0, "smoothed_swpc_ssn": -1.0, "f10.7": 68.0, "smoothed_f10.7": -1.0},
    {"time-tag": "2014-04", "ssn": 111.0, "smoothed_ssn": 116.4, "observed_swpc_ssn": -1.0, "smoothed_swpc_ssn": -1.0, "f10.7": 150.0, "smoothed_f10.7": -1.0},
    {"time-tag": "2026-09", "ssn": 60.3, "smoothed_ssn": -1.0, "observed_swpc_ssn": 68.73, "smoothed_swpc_ssn": -1.0, "f10.7": 105.41, "smoothed_f10.7": -1.0},
    {"time-tag": "2026-10", "ssn": 45.7, "smoothed_ssn": -1.0, "observed_swpc_ssn": 61.71, "smoothed_swpc_ssn": -1.0, "f10.7": 108.47, "smoothed_f10.7": -1.0},
]

PREDICTED = [
    {"time-tag": "2026-10", "predicted_ssn": 80.1, "high25_ssn": 85.0, "high_ssn": 88.0, "high75_ssn": 90.0,
     "low25_ssn": 75.0, "low_ssn": 72.0, "low75_ssn": 70.0, "predicted_f10.7": 120.0},
    {"time-tag": "2030-12", "predicted_ssn": 8.0, "high25_ssn": 12.0, "high_ssn": 13.5, "high75_ssn": 20.1,
     "low25_ssn": 5.0, "low_ssn": 3.0, "low75_ssn": 2.0, "predicted_f10.7": 70.3},
]


def gong_xml(path):
    return (f"<?xml version='1.0' encoding='ISO-8859-1'?><response><index>0</index><image>{path.replace('/hag/', '/hav/')}</image>"
            f"<age>220</age><zoomFile>{path}</zoomFile><ok>1</ok></response>")


# Respuestas reales del 24-nov-2026 (Mauna Loa sigue con su última imagen de 2022)
GONG_XML = {
    "C": gong_xml("/HA/hag/202611/20261124/20261124163742Ch.jpg"),
    "B": gong_xml("/HA/hag/202611/20261124/20261124163202Bh.jpg"),
    "T": gong_xml("/HA/hag/202611/20261124/20261124153322Th.jpg"),
    "M": gong_xml("/HA/hag/202211/20221126/20221126234752Mh.jpg"),
}
GONG_LISTING = (
    '<a href="/secret0x2112">x</a><a href="20261124163642Ah.jpg">a</a><a href="20261124163642Ch.jpg">c</a>'
    '<a href="20261124163702Zh.jpg">z</a><a href="20261124163742Ch.jpg">c</a><a href="20261124163750Zh.jpg">z</a>'
)


class FakeResp:
    def __init__(self, payload=None, text="", status_code=200, headers=None):
        self._payload, self.text, self.status_code, self.headers = payload, text, status_code, headers or {}

    def json(self):
        return self._payload


def default_handler(method, url):
    if "EISN_current.csv" in url:
        return FakeResp(text=SILSO_CSV)
    if "solar_regions" in url:
        return FakeResp(REGIONS)
    if "xray-flares-7-day" in url:
        return FakeResp(FLARES)
    if "planetary-k-index" in url:
        return FakeResp(KP)
    if "observed-solar-cycle" in url:
        return FakeResp(OBSERVED)
    if "predicted-solar-cycle" in url:
        return FakeResp(PREDICTED)
    if "HMIIF" in url:
        return FakeResp(headers={"last-modified": "Mon, 16 Nov 2026 13:30:10 GMT"})
    if "getImageDetails.php" in url:
        site = url.split("hAlpha_")[1][0]
        return FakeResp(text=GONG_XML.get(site, "<response><ok>0</ok></response>"))
    if "/HA/hag/" in url:
        return FakeResp(text=GONG_LISTING)
    raise AssertionError(f"URL inesperada: {url}")


class Net:
    """Cliente httpx simulado: cuenta peticiones y permite romper fuentes por trozo de URL."""

    def __init__(self):
        self.calls, self.broken, self.handler = [], {}, default_handler
        outer = self

        class _Client:
            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def _do(self, method, url):
                outer.calls.append((method, url))
                for frag, how in outer.broken.items():
                    if frag in url:
                        if how == "raise":
                            raise RuntimeError("proveedor caído")
                        return FakeResp(status_code=how)
                return outer.handler(method, url)

            async def get(self, url, **k):
                return await self._do("GET", url)

            async def head(self, url, **k):
                return await self._do("HEAD", url)

        self.Client = _Client


@pytest.fixture(autouse=True)
def net(monkeypatch):
    for r in sun.RESOURCES.values():
        r.reset()
    n = Net()
    monkeypatch.setattr(sun.httpx, "AsyncClient", n.Client)
    yield n
    for r in sun.RESOURCES.values():
        r.reset()


# ─── Funciones puras ─────────────────────────────────────────────────────
def test_parse_silso_takes_last_valid_day():
    d = sun.parse_silso(SILSO_CSV)
    assert d["value"] == 98 and d["date"] == "2026-11-16" and d["stdev"] == 5.7
    assert d["stations_used"] == 7 and d["stations_available"] == 9


def test_parse_silso_without_data_raises():
    with pytest.raises(ValueError):
        sun.parse_silso("2026, 11, 14, 2026.870,  -1,  -1.0,   0,   9,\n")
    with pytest.raises(ValueError):
        sun.parse_silso("<html>no es un csv</html>")


def test_flare_rank_orders_letters_then_numbers():
    ranks = [sun.flare_rank(c) for c in ("A9.9", "B1.0", "C9.9", "M1.0", "M5.0", "X1.0")]
    assert ranks == sorted(ranks) and None not in ranks
    assert sun.flare_rank("M1.1") > sun.flare_rank("C8.0")
    assert sun.flare_rank("") is None and sun.flare_rank("Z3") is None and sun.flare_rank("Cx") is None


def test_strongest_since_24h():
    fl = sun.normalize_flares(FLARES)
    top = sun.strongest_since(fl, NOW)
    assert top["class"] == "C2.4" and top["peak_time"] == "2026-11-15T17:20:00Z"
    assert sun.strongest_since(fl, datetime(2026, 11, 30, tzinfo=timezone.utc)) is None


def test_normalize_regions_latest_day_only_and_sorted():
    d = sun.normalize_regions(REGIONS)
    assert d["date"] == "2026-11-16"
    assert [r["region"] for r in d["regions"]] == [4579, 4574, 4575, 4570]   # área desc.; sin área al final
    assert d["regions"][0]["flare_prob"] == {"c": 30.0, "m": 1.0, "x": 1.0}
    assert d["regions"][-1]["area"] is None and d["regions"][-1]["spot_class"] is None


def test_normalize_kp_last_value_with_utc_z():
    assert sun.normalize_kp(KP) == {"value": 0.67, "time": "2026-11-16T09:00:00Z"}
    with pytest.raises(ValueError):
        sun.normalize_kp([])


def test_cycle_sentinels_become_null_and_start_at_cycle_24():
    months = sun.normalize_observed(OBSERVED)
    assert months[0]["t"] == "2008-12" and all(m["t"] >= "2008-12" for m in months)
    last = months[-1]
    assert last == {"t": "2026-10", "ssn": 45.7, "smoothed": None}        # -1 -> null, nunca -1
    pred = sun.normalize_predicted(PREDICTED)
    assert pred[0] == {"t": "2026-10", "ssn": 80.1, "low": 72.0, "high": 88.0}


# ─── Endpoint ────────────────────────────────────────────────────────────
def test_today_contract(net):
    r = client.get("/api/sun/today")
    assert r.status_code == 200
    d = r.json()
    for k in ("updated", "sunspot_number", "regions", "regions_date", "flares_7d", "strongest_flare_24h",
              "kp", "cycle", "image", "halpha", "sources", "errors", "stale", "stale_sources"):
        assert k in d, k
    assert d["errors"] == {} and d["stale"] is False and d["stale_sources"] == []
    assert d["sunspot_number"]["value"] == 98 and d["sunspot_number"]["date"] == "2026-11-16"
    assert d["sunspot_number"]["source"] == "SILSO, Real Observatorio de Bélgica"
    assert d["regions_date"] == "2026-11-16" and len(d["regions"]) == 4
    assert set(d["regions"][0]) == {"region", "location", "area", "spots", "mag_class", "spot_class", "flare_prob"}
    assert d["flares_7d"][0]["peak_time"] > d["flares_7d"][-1]["peak_time"]       # la más reciente primero
    assert all(f["region"] is None for f in d["flares_7d"])                       # la fuente no la da
    assert d["kp"] == {"value": 0.67, "time": "2026-11-16T09:00:00Z"}
    assert d["cycle"]["months"][0]["t"] == "2008-12" and d["cycle"]["predicted"][0]["t"] == "2026-10"
    assert d["image"]["url"] == "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIF.jpg"
    assert d["image"]["credit"] == "NASA/SDO y equipo científico HMI"
    assert d["image"]["time"] == "2026-11-16T13:30:10Z"
    assert d["halpha"] == {
        "url": "https://gong2.nso.edu/HA/hag/202611/20261124/20261124163742Ch.jpg",
        "url_small": "https://gong2.nso.edu/HA/hav/202611/20261124/20261124163742Ch.jpg",
        "time": "2026-11-24T16:37:42Z", "site": "C", "credit": "GONG/NSO/AURA/NSF",
        "page": "https://nso.edu/data/nisp-data/h-alpha/"}
    assert {s["id"] for s in d["sources"]} == {"silso", "swpc", "sdo", "gong"} and all(s["ok"] for s in d["sources"])
    assert d["updated"].endswith("Z")
    assert r.headers["cache-control"] == "public, max-age=600"


def test_today_cache_one_hour_single_request_per_source(net):
    client.get("/api/sun/today")
    n = len(net.calls)
    assert n == 7 + 6                   # una por fuente (la imagen con HEAD) y una por sitio GONG
    client.get("/api/sun/today"); client.get("/api/sun/today")
    assert len(net.calls) == n
    assert ("HEAD", sun.IMAGE_URL) in net.calls
    assert not any("/HA/hag/" in u for _, u in net.calls)      # el listado pesado solo es plan B
    assert all(r.ttl == 3600 for k, r in sun.RESOURCES.items() if k != "halpha")
    assert sun.halpha.ttl == 600


@pytest.mark.parametrize("frag,key,field", [
    ("EISN_current", "sunspot_number", "sunspot_number"),
    ("solar_regions", "regions", "regions"),
    ("xray-flares-7-day", "flares", "flares_7d"),
    ("planetary-k-index", "kp", "kp"),
])
def test_one_source_down_rest_still_served(net, frag, key, field):
    net.broken[frag] = "raise"
    d = client.get("/api/sun/today").json()
    assert d[field] is None and key in d["errors"] and "proveedor caído" in d["errors"][key]
    for other in ("sunspot_number", "regions", "flares_7d", "kp", "cycle"):
        if other != field:
            assert d[other] is not None, other
    assert d["image"]["url"]


def test_flares_down_also_nulls_strongest_and_http_error_is_reported(net):
    net.broken["xray-flares-7-day"] = 503
    d = client.get("/api/sun/today").json()
    assert d["flares_7d"] is None and d["strongest_flare_24h"] is None
    assert "503" in d["errors"]["flares"]


def test_cycle_partial_and_total_failure(net):
    net.broken["predicted-solar-cycle"] = "raise"
    d = client.get("/api/sun/today").json()
    assert d["cycle"]["months"] and d["cycle"]["predicted"] is None and "predicción" in d["errors"]["cycle"]
    for r in sun.RESOURCES.values():
        r.reset()
    net.broken["observed-solar-cycle"] = "raise"
    d = client.get("/api/sun/today").json()
    assert d["cycle"] is None and "cycle" in d["errors"]


def test_image_time_unknown_when_head_fails(net):
    net.broken["HMIIF"] = "raise"
    d = client.get("/api/sun/today").json()
    assert d["image"]["time"] is None and d["image"]["url"] and d["errors"] == {}


def test_everything_down_still_json_200(net):
    for frag in ("EISN", "swpc.noaa.gov", "HMIIF", "gong2.nso.edu"):
        net.broken[frag] = "raise"
    r = client.get("/api/sun/today")
    assert r.status_code == 200
    d = r.json()
    assert d["sunspot_number"] is None and d["regions"] is None and d["kp"] is None and d["cycle"] is None
    assert set(d["errors"]) == {"sunspot_number", "regions", "flares", "kp", "cycle", "halpha"}
    assert d["halpha"] is None
    assert r.headers["cache-control"] == "public, max-age=30"
    assert not any(s["ok"] for s in d["sources"])


def test_stale_served_when_source_fails_after_success(net):
    client.get("/api/sun/today")
    sun.silso.ts -= sun.silso.ttl + 1
    sun.silso.last_error_ts = None
    net.broken["EISN"] = "raise"
    d = client.get("/api/sun/today").json()
    assert d["sunspot_number"]["value"] == 98 and d["stale"] is True and d["stale_sources"] == ["silso"]
    assert "sunspot_number" not in d["errors"]


def test_metrics_whitelist_sun_today():
    from app import metrics
    assert metrics.clean_event({"e": "sun_today", "p": {"source": "sheet"}}) == {"e": "sun_today", "p": {"source": "sheet"}}
    assert metrics.clean_event({"e": "sun_today", "p": {"source": "now", "lat": -0.2}})["p"] == {"source": "now"}
    assert metrics.clean_event({"e": "sun_today", "p": {"source": "otra"}})["p"] == {}


# ─── H-alfa (GONG) ───────────────────────────────────────────────────────
def test_gong_details_valid_and_rejected_paths():
    ok = sun.parse_gong_details(GONG_XML["C"])
    assert ok["site"] == "C" and ok["time"] == "2026-11-24T16:37:42Z"
    assert ok["url"].startswith("https://gong2.nso.edu/HA/hag/") and "/HA/hav/" in ok["url_small"]
    assert sun.parse_gong_details("<response><ok>0</ok></response>") is None
    # letras de prueba (A, Z…), rutas con otro host, otro directorio o fecha que no cuadra: fuera
    for bad in ("/HA/hag/202611/20261124/20261124163742Zh.jpg", "https://evil.example/x.jpg",
                "/HA/hag/../../etc/20261124163742Ch.jpg", "/HA/hag/202611/20261123/20261124163742Ch.jpg",
                "/HA/haf/202611/20261124/20261124163742Ch.jpg"):
        assert sun.parse_gong_details(gong_xml(bad)) is None, bad


def test_gong_details_fresh_photo_without_big_image():
    # respuesta real (24-nov-2026, 16:55 UTC): la de 2048 px aún no existe y zoomFile dice «none»
    xml = ("<response><index>0</index><image>/HA/hav/202611/20261124/20261124165542Ch.jpg</image>"
           "<dataFile>none</dataFile><zoomFile>none</zoomFile><ok>1</ok></response>")
    img = sun.parse_gong_details(xml)
    assert img["time"] == "2026-11-24T16:55:42Z" and img["site"] == "C"
    assert img["url"] == img["url_small"] == "https://gong2.nso.edu/HA/hav/202611/20261124/20261124165542Ch.jpg"
    # una «image» fuera de /hav/ no se acepta
    assert sun.parse_gong_details(xml.replace("/HA/hav/", "/HA/haf/")) is None


def test_pick_halpha_prefers_big_photo_if_recent():
    big_c = sun.gong_image("20261124165042", "C")                    # 2048 px, 16:50
    small_b = sun.gong_image("20261124165602", "B", big=False)       # solo 512 px, 16:56
    assert sun.pick_halpha([small_b, big_c]) is big_c                 # 6 min más vieja pero grande
    old_t = sun.gong_image("20261124153322", "T")                     # grande pero de hace 1 h
    assert sun.pick_halpha([small_b, old_t]) is small_b               # mejor la de ahora, aunque chica
    assert sun.pick_halpha([small_b]) is small_b


def test_gong_listing_skips_test_sites():
    img = sun.parse_gong_listing(GONG_LISTING)
    assert img["site"] == "C" and img["time"] == "2026-11-24T16:37:42Z"      # 163750Z es de prueba
    assert sun.parse_gong_listing('<a href="/secret0x2112">x</a>') is None


def test_halpha_picks_newest_site(net):
    d = client.get("/api/sun/today").json()
    assert d["halpha"]["site"] == "C"          # 16:37:42 gana a Big Bear 16:32 y a El Teide 15:33


def test_halpha_falls_back_to_day_listing(net):
    net.broken["getImageDetails"] = 500
    d = client.get("/api/sun/today").json()
    assert d["halpha"]["site"] == "C" and "halpha" not in d["errors"]
    assert any("/HA/hag/" in u for _, u in net.calls)


def test_halpha_down_rest_still_served(net):
    net.broken["gong2.nso.edu"] = "raise"
    d = client.get("/api/sun/today").json()
    assert d["halpha"] is None and "halpha" in d["errors"]
    assert d["sunspot_number"] is not None and d["image"]["url"]
