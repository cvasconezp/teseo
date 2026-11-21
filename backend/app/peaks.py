"""
peaks.py — los nombres de las montañas que se ven en el horizonte real de un lugar.

  GET /api/peaks?lat=<grados>&lon=<grados>

Fuentes de los nombres, consultadas a la vez (ver CREDITS.md):
  * Wikidata (montañas, volcanes, cumbres y cerros con coordenadas; datos CC0), por su servicio de consultas
    SPARQL: rápido y fiable, con los nombres en español y en inglés;
  * OpenStreetMap (natural=peak|volcano con nombre; © colaboradores de OpenStreetMap, ODbL), por la API Overpass:
    más cumbres pequeñas, pero sus servidores públicos van muy cargados. Si no responde a tiempo, basta Wikidata.
Las dos listas se juntan (la misma cumbre con el mismo nombre a menos de 2 km cuenta una vez).

Solo se nombra una cumbre si FORMA la silueta que dibuja el cielo. Con el horizonte del lugar ya calculado
(app/horizon.py: para cada 0,2° de acimut y cada banda de distancia, el punto más alto, su ángulo y su distancia):
  * se calcula el acimut y la distancia de la cumbre desde el lugar;
  * se busca, cerca de ese acimut, el filo de su banda de distancia cuyo punto más alto está a la distancia de la
    cumbre (con margen): si el filo de esa banda lo pone otro cerro, más cerca o más lejos, esta cumbre no se ve;
  * el filo no puede quedar tapado por una banda más cercana;
  * el nombre se ancla en el punto exacto de la silueta dibujada (mismo ángulo que la línea de la cresta), no en
    un ángulo calculado aparte: así el rótulo cae siempre sobre la cumbre que se ve.
Se ordenan por lo que destacan sobre el horizonte de alrededor y, de dos cumbres casi en el mismo rumbo, queda la
que más destaca. El navegador decide cuántos caben según el zoom.

Caché en memoria por celda del horizonte. Si fallan las dos fuentes, 502 (el cielo sigue con montañas, sin nombres).
"""

import asyncio
import math
import time
from collections import OrderedDict
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Response

from app import horizon as hz
from app.cache import iso_utc, provider_headers

SOURCE = "Wikidata (CC0) y OpenStreetMap (© colaboradores de OpenStreetMap, ODbL)"
WIKIDATA = "https://query.wikidata.org/sparql"
# montaña, volcán, cima, estratovolcán, colina, volcán en escudo, volcán extinto, montaña sagrada
WD_TYPES = ("Q8502", "Q8072", "Q207326", "Q169358", "Q54050", "Q212057", "Q1197120", "Q1595289")
OSM_WAIT_S = 8.0            # cuánto más se espera a OpenStreetMap cuando Wikidata ya respondió
WD_UA = "Teseo/1.13.3 (https://teseo.yachaydeep.com; https://github.com/cvasconezp/teseo) httpx"
OVERPASS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
NEAR_KM = 40.0          # hasta aquí, todas las cumbres con nombre
MAX_KM = 150.0          # más lejos, solo las que tienen altura y superan la del lugar en ≥ 300 m
MIN_KM = 0.5
MAX_PEAKS = 40
TIMEOUT_S = 75.0            # los servidores públicos van cargados: a veces tardan
RESULT_CACHE_MAX = 400
CACHE_SECONDS = 3 * 86400

_transport: Optional[httpx.AsyncBaseTransport] = None
router = APIRouter(prefix="/api", tags=["peaks"])
_results: "OrderedDict[tuple, dict]" = OrderedDict()
stats = {"computed": 0, "last_error": None, "last_ms": None, "last_endpoint": None, "last_sources": None}


def reset_cache() -> None:
    _results.clear()
    stats.update(computed=0, last_error=None, last_ms=None, last_endpoint=None, last_sources=None)


def bearing_dist(lat0: float, lon0: float, lat: float, lon: float):
    """Acimut (grados desde el norte hacia el este) y distancia (km) por el círculo máximo."""
    p0, p1 = math.radians(lat0), math.radians(lat)
    dl = math.radians(lon - lon0)
    y = math.sin(dl) * math.cos(p1)
    x = math.cos(p0) * math.sin(p1) - math.sin(p0) * math.cos(p1) * math.cos(dl)
    az = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0
    a = math.sin((p1 - p0) / 2) ** 2 + math.cos(p0) * math.cos(p1) * math.sin(dl / 2) ** 2
    d = 2 * hz.R_E * math.asin(min(1.0, math.sqrt(a))) / 1000.0
    return az, d


def parse_ele(v) -> Optional[float]:
    """«5790», «5790 m», «5.790», «18999 ft» → metros (o None)."""
    if v is None:
        return None
    s = str(v).strip().lower().replace(",", ".")
    ft = "ft" in s or "'" in s
    num = ""
    for ch in s:
        if ch.isdigit() or (ch == "." and "." not in num):
            num += ch
        elif num:
            break
    if not num:
        return None
    # «5.790» con punto de miles (más de 3 cifras tras el punto no existe en una altura con decimales razonables)
    if num.count(".") == 1 and len(num.split(".")[1]) == 3 and float(num) < 10:
        num = num.replace(".", "")
    try:
        e = float(num)
    except ValueError:
        return None
    if ft:
        e *= 0.3048
    return e if -500 < e < 9000 else None


def bbox(lat: float, lon: float, km: float) -> str:
    """Recuadro (s,w,n,e) que contiene el círculo de `km` alrededor del lugar (más rápido que «around»)."""
    dlat = km / 111.32
    dlon = km / (111.32 * max(0.05, math.cos(math.radians(lat))))
    return f"{max(-90.0, lat - dlat):.4f},{lon - dlon:.4f},{min(90.0, lat + dlat):.4f},{lon + dlon:.4f}"


def overpass_query(lat: float, lon: float, min_far_ele: float) -> str:
    """Consulta ligera para servidores cargados: etiquetas exactas (usan el índice, sin expresiones regulares ni
    «if») y el filtro de altura de las lejanas se hace aquí (`far_ok`)."""
    near, far = bbox(lat, lon, NEAR_KM), bbox(lat, lon, MAX_KM)
    return (
        "[out:json][timeout:60];("
        f'node["natural"="peak"]["name"]({near});'
        f'node["natural"="volcano"]["name"]({near});'
        f'node["natural"="peak"]["name"]["ele"]({far});'
        f'node["natural"="volcano"]["name"]({far});'
        ");out body qt;"
    )


def far_ok(el: dict, lat: float, lon: float, min_far_ele: float) -> bool:
    """Cerca, toda cumbre con nombre; lejos, solo las que superan en altura al lugar (las demás no asoman)."""
    if "lat" not in el or "lon" not in el:
        return False
    _, d = bearing_dist(lat, lon, float(el["lat"]), float(el["lon"]))
    if d <= NEAR_KM:
        return True
    e = parse_ele((el.get("tags") or {}).get("ele"))
    return e is None or e >= min_far_ele


def visible_peaks(prof: dict, nodes: list, lang_keys=("es", "en")) -> list:
    """Las cumbres de `nodes` (elementos de Overpass) que forman la silueta de `prof` (resultado de horizon)."""
    step = prof["step_deg"]; n = len(prof["alt"]); bands = prof["bands"]
    lat0, lon0, total = prof["lat"], prof["lon"], prof["alt"]
    out = []
    for el in nodes:
        tags = el.get("tags") or {}
        name = (tags.get("name") or "").strip()
        if not name or "lat" not in el or "lon" not in el:
            continue
        az, d = bearing_dist(lat0, lon0, float(el["lat"]), float(el["lon"]))
        if d < MIN_KM or d > MAX_KM:
            continue
        tol = max(0.5, 0.08 * d)                                          # km: margen entre el modelo y el mapa
        w = max(2, int(math.ceil(max(0.4, math.degrees(math.atan2(0.35, d))) / step)))
        c = int(round(az / step))
        # la banda de su distancia (y la vecina si la cumbre cae junto al límite entre dos bandas)
        best = None
        lo = 0.0
        for k, band in enumerate(bands):
            hi = band["max_km"]
            if d + tol > lo and d - tol <= hi:
                for j in range(c - w, c + w + 1):
                    i = j % n
                    if abs(band["dist_km"][i] - d) > tol:
                        continue
                    if best is None or band["alt"][i] > bands[best[0]]["alt"][best[1]]:
                        best = (k, i)
            lo = hi
        if best is None:
            continue
        b, best = best
        band = bands[b]
        a = band["alt"][best]
        # tapada por una banda más cercana: no se ve
        if any(bands[k]["alt"][best] > a - 0.02 for k in range(b)):
            continue
        # cuánto destaca: sobre el horizonte más bajo de ±8° alrededor (un volcán ancho también destaca)
        r = int(round(8.0 / step))
        around = min(total[(best + j) % n] for j in range(-r, r + 1))
        ele = parse_ele(tags.get("ele"))
        out.append({
            "name": name,
            **{f"name_{lg}": tags.get(f"name:{lg}") for lg in lang_keys if tags.get(f"name:{lg}")},
            "ele_m": int(round(ele)) if ele is not None else int(band["top_m"][best]),
            "az": round(best * step, 2), "alt": a, "dist_km": round(d, 1), "band": b,
            "lat": round(float(el["lat"]), 4), "lon": round(float(el["lon"]), 4),
            "volcano": tags.get("natural") == "volcano",
            "lift": round(a - around, 2),
        })
    # de dos cumbres casi en el mismo rumbo (< 1°: dos nombres para la misma mole), la que más destaca
    out.sort(key=lambda p: (-p["lift"], -p["ele_m"]))
    kept = []
    for p in out:
        if any(abs(((p["az"] - q["az"] + 180) % 360) - 180) < 1.0 or _norm(p["name"]) == _norm(q["name"]) for q in kept):
            continue
        kept.append(p)
        if len(kept) >= MAX_PEAKS:
            break
    return kept


def wikidata_query(lat: float, lon: float) -> str:
    types = " ".join(f"wd:{q}" for q in WD_TYPES)
    return (
        "SELECT ?item ?coord ?ele ?es ?en WHERE {"
        " SERVICE wikibase:around { ?item wdt:P625 ?coord ."
        f' bd:serviceParam wikibase:center "Point({lon:.5f} {lat:.5f})"^^geo:wktLiteral .'
        f' bd:serviceParam wikibase:radius "{int(MAX_KM)}" . }}'
        f" ?item wdt:P31 ?t . VALUES ?t {{ {types} }}"
        " OPTIONAL { ?item wdt:P2044 ?ele . }"
        ' OPTIONAL { ?item rdfs:label ?es . FILTER(LANG(?es) = "es") }'
        ' OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }'
        "} LIMIT 6000"
    )


def parse_wikidata(body: dict) -> list:
    """Resultados SPARQL → elementos como los de Overpass ({id, lat, lon, tags})."""
    out = []
    for b in (body.get("results") or {}).get("bindings") or []:
        try:
            pt = b["coord"]["value"]                         # «Point(lon lat)»
            lo_s, la_s = pt[pt.index("(") + 1:pt.index(")")].split()
            la, lo = float(la_s), float(lo_s)
        except (KeyError, ValueError):
            continue
        es = (b.get("es") or {}).get("value"); en = (b.get("en") or {}).get("value")
        name = es or en
        if not name:
            continue
        tags = {"name": name, "natural": "peak"}
        if es:
            tags["name:es"] = es
        if en:
            tags["name:en"] = en
        if b.get("ele"):
            tags["ele"] = b["ele"]["value"]
        out.append({"type": "wd", "id": "wd:" + b["item"]["value"].rsplit("/", 1)[-1] + f":{la:.4f},{lo:.4f}",
                    "lat": la, "lon": lo, "tags": tags})
    return out


def _norm(name: str) -> str:
    import unicodedata
    s = unicodedata.normalize("NFD", name.lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    for w in ("volcan ", "cerro ", "nevado ", "mount ", "monte ", "pico "):
        if s.startswith(w):
            s = s[len(w):]
    return s.strip()


def merge_nodes(a: list, b: list) -> list:
    """Junta dos listas: la misma cumbre (mismo nombre, a menos de 2 km) cuenta una vez; queda la de `a`."""
    out = list(a)
    for el in b:
        n = _norm((el.get("tags") or {}).get("name", ""))
        dup = False
        for o in a:
            if _norm((o.get("tags") or {}).get("name", "")) == n:
                _, d = bearing_dist(float(o["lat"]), float(o["lon"]), float(el["lat"]), float(el["lon"]))
                if d < 2.0:
                    dup = True; break
        if not dup:
            out.append(el)
    return out


async def fetch_wikidata(client: httpx.AsyncClient, lat: float, lon: float) -> list:
    # Wikimedia exige un User-Agent que identifique la aplicación y cómo contactar (si no, 403):
    # el sitio y el repositorio públicos de Teseo
    for attempt in range(2):
        r = await client.get(WIKIDATA, params={"query": wikidata_query(lat, lon)},
                             headers={"Accept": "application/sparql-results+json", "User-Agent": WD_UA})
        if r.status_code not in (403, 429, 503) or attempt:
            break
        await asyncio.sleep(1.5)                             # límite de ritmo: un segundo intento
    if r.status_code != 200:
        raise RuntimeError(f"Wikidata: HTTP {r.status_code}")
    return parse_wikidata(r.json())


async def fetch_nodes(lat: float, lon: float, ground_m: float) -> list:
    """Wikidata y OpenStreetMap a la vez. Con Wikidata ya respondido, a OpenStreetMap se le espera como mucho
    OSM_WAIT_S más; si una de las dos falla, vale la otra; si fallan las dos, error."""
    min_far = ground_m + 300.0
    async with httpx.AsyncClient(timeout=TIMEOUT_S, transport=_transport, headers=provider_headers()) as client:
        wd = asyncio.ensure_future(fetch_wikidata(client, lat, lon))
        osm = asyncio.ensure_future(fetch_osm(client, lat, lon, min_far))
        errors, wd_nodes, osm_nodes = [], None, None
        try:
            try:
                wd_nodes = await wd
            except Exception as e:                           # noqa: BLE001
                errors.append(str(e) or type(e).__name__)
            try:
                osm_nodes = await (asyncio.wait_for(asyncio.shield(osm), OSM_WAIT_S) if wd_nodes is not None else osm)
            except Exception as e:                           # noqa: BLE001
                errors.append(f"OpenStreetMap: {e}" if str(e) else "OpenStreetMap: sin respuesta a tiempo")
        finally:
            osm.cancel()
    stats["last_sources"] = [n for n, v in (("wikidata", wd_nodes), ("osm", osm_nodes)) if v is not None]
    if wd_nodes is None and osm_nodes is None:
        raise RuntimeError("; ".join(errors) or "sin respuesta")
    stats["last_error"] = "; ".join(errors) or None
    wd_ok = [el for el in (wd_nodes or []) if far_ok(el, lat, lon, min_far)]
    return merge_nodes(osm_nodes or [], wd_ok)


async def fetch_osm(client: httpx.AsyncClient, lat: float, lon: float, min_far: float) -> list:
    """Pregunta a los servidores Overpass a la vez y se queda con la primera respuesta buena (suelen ir
    cargados: uno solo puede tardar un minuto o fallar)."""
    q = overpass_query(lat, lon, min_far)
    errors = []
    if True:
        async def one(url):
            r = await client.post(url, data={"data": q})
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}")
            els = r.json().get("elements")
            if els is None:
                raise RuntimeError("respuesta sin elementos")
            return url, els
        tasks = {asyncio.ensure_future(one(u)): u for u in OVERPASS}
        try:
            for fut in asyncio.as_completed(list(tasks)):
                try:
                    url, els = await fut
                    stats["last_endpoint"] = url
                    seen, out = set(), []
                    for el in els:
                        if el.get("id") in seen or not far_ok(el, lat, lon, min_far):
                            continue
                        seen.add(el.get("id")); out.append(el)
                    return out
                except Exception as e:                     # noqa: BLE001 — se prueba el siguiente
                    errors.append(str(e) or type(e).__name__)
        finally:
            for t in tasks:
                t.cancel()
    raise RuntimeError("; ".join(errors) or "sin respuesta")


async def get_peaks(lat: float, lon: float) -> dict:
    key = hz.cell_of(lat, lon)
    if key in _results:
        _results.move_to_end(key)
        return _results[key]
    t0 = time.time()
    prof = await hz.get_horizon(lat, lon)
    nodes = await fetch_nodes(prof["lat"], prof["lon"], prof["ground_m"])
    res = {"lat": prof["lat"], "lon": prof["lon"], "peaks": visible_peaks(prof, nodes), "candidates": len(nodes),
           "source": SOURCE, "computed": iso_utc(time.time())}
    _results[key] = res
    while len(_results) > RESULT_CACHE_MAX:
        _results.popitem(last=False)
    stats["computed"] += 1; stats["last_ms"] = int((time.time() - t0) * 1000)
    return res


@router.get("/peaks")
async def peaks(response: Response,
                lat: float = Query(..., ge=-85.0, le=85.0),
                lon: float = Query(..., ge=-180.0, le=180.0)):
    """Nombres (OpenStreetMap) de las cumbres que forman la silueta del horizonte real del lugar, con el punto
    exacto de la silueta donde va cada uno (acimut y ángulo, como /api/horizon)."""
    try:
        data = await get_peaks(lat, lon)
    except Exception as e:
        stats["last_error"] = str(e)
        raise HTTPException(status_code=502, detail=f"No se pudieron leer los nombres de las montañas (OpenStreetMap): {e}")
    response.headers["Cache-Control"] = f"public, max-age={CACHE_SECONDS}"
    return data
