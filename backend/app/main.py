"""
main.py — API de Teseo

Endpoints:
  GET  /                              → comprobación básica
  GET  /api/health                    → versión y estado de las cachés (sin llamar a nadie)
  GET  /api/bodies                    → lista de cuerpos disponibles
  GET  /api/position/{body}           → posición real actual (NASA Horizons)
  GET  /api/positions                 → posición de todos los planetas
  GET  /api/distance/{a}/{b}          → distancia real entre dos cuerpos hoy
  POST /api/route                     → ruta Hohmann completa + narrativa
  GET  /api/launch-windows/{a}/{b}    → próximas ventanas de lanzamiento
  POST /api/explain                   → explicación de un concepto (IA)
  GET  /api/exoplanets                → exoplanetas (NASA Exoplanet Archive)
  GET  /api/comets                    → cometas notables (NASA Horizons)
  GET  /api/probes                    → sondas y telescopios (NASA Horizons)
  GET  /api/launches                  → próximos lanzamientos (Launch Library 2)
  GET  /api/asteroids                 → acercamientos a la Tierra (JPL CNEOS)
  GET  /api/missions/mars             → ventana a Marte + naves con destino Marte

Para correr localmente:
  uvicorn app.main:app --reload --port 8000
"""

import asyncio
import os
import time
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app import orbital
from app import nasa_horizons
from app import narrative
from app import exoplanets
from app import launches
from app import asteroids
from app.cache import ProviderError, iso_utc

VERSION = "0.2.0"
_STARTED = time.time()

app = FastAPI(
    title="Teseo API",
    description="Navegación cósmica real — trayectorias, ventanas de lanzamiento y posiciones reales del sistema solar.",
    version=VERSION,
)


# ─── Cabeceras de caché y errores siempre en JSON ─────────────────────────
# max-age (s) por prefijo de ruta para los GET cacheables. Son cortos: la
# caché de verdad vive en el servidor; esto solo evita que el navegador
# repita la misma petición al cambiar de pestaña.
_CACHE_SECONDS = [
    ("/api/health", 0),
    ("/api/launches", 300),
    ("/api/asteroids", 900),
    ("/api/missions/", 600),
    ("/api/probes", 600),
    ("/api/comets", 600),
    ("/api/positions", 300),
    ("/api/position/", 300),
    ("/api/distance/", 300),
    ("/api/exoplanets", 3600),
    ("/api/launch-windows/", 3600),
    ("/api/bodies", 86400),
]
_DEGRADED_CACHE = "public, max-age=30"  # datos `stale` o aún incompletos


def _degraded(response: Response) -> None:
    response.headers["Cache-Control"] = _DEGRADED_CACHE


@app.middleware("http")
async def _cache_and_errors(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception as e:  # nunca un 500 en HTML ni sin explicar
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error interno de Teseo: {type(e).__name__}: {e}"},
            headers={"Cache-Control": "no-store"},
        )
    if "cache-control" not in response.headers:
        value = "no-store"
        if request.method == "GET" and response.status_code == 200:
            for prefix, seconds in _CACHE_SECONDS:
                if request.url.path.startswith(prefix):
                    if seconds > 0:
                        value = f"public, max-age={seconds}"
                    break
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = value
    return response


# CORS configurable por entorno. Por defecto "*" (cómodo en desarrollo).
# En producción, define ALLOWED_ORIGINS como lista separada por comas, p. ej.:
#   ALLOWED_ORIGINS=https://teseo.yachaydeep.com,https://teseo-seven.vercel.app
# (Se añade DESPUÉS del middleware de arriba para que quede por fuera y sus
# cabeceras lleguen también en las respuestas de error.)
_origins_env = os.environ.get("ALLOWED_ORIGINS", "*").strip()
allow_origins = ["*"] if _origins_env in ("", "*") else [
    o.strip() for o in _origins_env.split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def _validation_error(request: Request, exc: RequestValidationError):
    """Parámetros inválidos -> 422 con un `detail` legible (texto), más la
    lista técnica original en `errors`."""
    parts = []
    for err in exc.errors():
        loc = [str(x) for x in err.get("loc", []) if x not in ("query", "path", "body")]
        parts.append(f"{'.'.join(loc) or 'petición'}: {err.get('msg', 'valor inválido')}")
    errors = [
        {"loc": list(e.get("loc", [])), "msg": e.get("msg"), "type": e.get("type")}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": "Parámetro inválido — " + "; ".join(parts), "errors": errors},
    )


def _provider_http_error(provider: str, e: Exception) -> HTTPException:
    """Fallo de un proveedor sin dato previo que servir -> 502/503 en JSON."""
    if isinstance(e, ProviderError) and e.pending:
        return HTTPException(
            status_code=503,
            detail=f"{provider} aún está respondiendo: {e}",
            headers={"Retry-After": "5"},
        )
    return HTTPException(status_code=502, detail=f"Error consultando {provider}: {e}")


def _parse_date(date: Optional[str]) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(date) if date else None
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Fecha inválida: '{date}'. Usa el formato YYYY-MM-DD.",
        )


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "project": "Teseo",
        "description": "Real-time interplanetary navigation API",
    }


@app.get("/api/health")
def api_health():
    """Versión y estado de las cachés (edad del último dato por proveedor).
    No llama a ningún proveedor: solo lee la memoria del proceso."""
    return {
        "status": "ok",
        "version": VERSION,
        "commit": (os.environ.get("RAILWAY_GIT_COMMIT_SHA") or "")[:7] or None,
        "time": iso_utc(time.time()),
        "uptime_s": round(time.time() - _STARTED),
        "caches": {
            "launches": {"provider": launches.SOURCE, **launches.resource.status()},
            "asteroids": {"provider": asteroids.SOURCE, **asteroids.resource.status()},
            "exoplanets": {"provider": "NASA Exoplanet Archive", **exoplanets.resource.status()},
            "positions": {"provider": "NASA JPL Horizons", **nasa_horizons.positions_status()},
            "probes": {"provider": "NASA JPL Horizons", **nasa_horizons._probe_set.status()},
            "comets": {"provider": "NASA JPL Horizons", **nasa_horizons._comet_set.status()},
        },
        "config": {
            "groq_api_key": bool(os.environ.get("GROQ_API_KEY")),
            "ll2_api_key": bool(os.environ.get("LL2_API_KEY")),
            "user_agent": bool(os.environ.get("TESEO_USER_AGENT")),
        },
    }


@app.get("/api/bodies")
def list_bodies():
    """Lista los cuerpos del sistema solar disponibles para calcular rutas."""
    return {
        "bodies": [
            {
                "id": body_id,
                "semi_major_axis_au": orbital.SEMI_MAJOR_AXIS_AU[body_id],
                "orbital_period_days": orbital.ORBITAL_PERIOD_DAYS[body_id],
            }
            for body_id in orbital.BODIES.keys()
        ]
    }


@app.get("/api/positions")
async def get_all_positions(response: Response, date: Optional[str] = Query(None)):
    """
    Posición heliocéntrica real de TODOS los planetas en una sola llamada
    (NASA Horizons, en cola y con caché). Los cuerpos que no se puedan
    consultar se listan en `errors` en vez de tumbar toda la respuesta.
    La llamada completa nunca supera ~22 s.
    """
    parsed_date = _parse_date(date)
    positions, errors = {}, {}
    deadline = time.monotonic() + 22.0
    for body_id in orbital.BODIES.keys():
        try:
            remaining = deadline - time.monotonic()
            positions[body_id] = await nasa_horizons.get_body_position(
                body_id, parsed_date, timeout=min(20.0, remaining)
            )
        except Exception as e:
            errors[body_id] = str(e) or type(e).__name__
    if errors or any(p.get("stale") for p in positions.values()):
        _degraded(response)
    return {"positions": positions, "errors": errors, "source": "NASA JPL Horizons"}


@app.on_event("startup")
async def _prewarm():
    """Al arrancar, precarga en segundo plano los datos de hoy para que el
    primer visitante no espere a los proveedores. Cada paso es independiente:
    si uno falla, los demás siguen."""

    async def warm():
        steps = [nasa_horizons.get_body_position(b) for b in orbital.BODIES.keys()]
        steps += [
            nasa_horizons.get_spacecraft_positions(),
            nasa_horizons.get_comet_positions(),
            asteroids.resource.get(),
            launches.resource.get(),
            run_in_threadpool(_windows, "earth", "mars", None, None, 1),  # calienta numba
            exoplanets.resource.get(),
        ]
        for step in steps:
            try:
                await step
            except Exception:
                pass

    if os.getenv("TESEO_PREWARM", "1") == "1":
        asyncio.create_task(warm())


@app.get("/api/position/{body}")
async def get_position(body: str, response: Response, date: Optional[str] = Query(None)):
    """
    Posición heliocéntrica real de un cuerpo, consultada en vivo a NASA
    Horizons. `date` en formato YYYY-MM-DD; si se omite, usa hoy.
    """
    parsed_date = _parse_date(date)
    try:
        result = await nasa_horizons.get_body_position(body, parsed_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise _provider_http_error("NASA Horizons", e)
    if result.get("stale"):
        _degraded(response)
    return result


@app.get("/api/distance/{body_a}/{body_b}")
async def get_distance(body_a: str, body_b: str, response: Response, date: Optional[str] = Query(None)):
    """Distancia real entre dos cuerpos en una fecha dada (NASA Horizons)."""
    parsed_date = _parse_date(date)
    try:
        result = await nasa_horizons.get_distance_between_bodies(body_a, body_b, parsed_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise _provider_http_error("NASA Horizons", e)
    if result["position_a"].get("stale") or result["position_b"].get("stale"):
        _degraded(response)
    return result


class RouteRequest(BaseModel):
    origin: str
    destination: str
    departure_date: Optional[str] = None  # ISO format, opcional
    lang: str = "es"
    include_narrative: bool = True


@app.post("/api/route")
def compute_route(req: RouteRequest):
    """
    Calcula la ruta completa Hohmann entre dos cuerpos: física real
    (hapsira) + narrativa opcional generada por IA (Groq) a partir de
    esos mismos números.
    """
    try:
        departure = datetime.fromisoformat(req.departure_date) if req.departure_date else None
        result = orbital.compute_hohmann_transfer(req.origin, req.destination, departure)
        data = result.to_dict()

        if req.include_narrative:
            try:
                data["narrative"] = narrative.generate_travel_narrative(data, lang=req.lang)
            except Exception as e:
                # La narrativa es un extra. Si Groq falla por lo que sea
                # (no configurado, modelo deprecado -> 404, límite de tasa,
                # caída), la ruta sigue devolviendo TODOS los números: la
                # física es lo esencial y nunca pasa por la IA.
                data["narrative"] = None
                data["narrative_error"] = str(e)

        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/exoplanets")
async def list_exoplanets(response: Response):
    """Exoplanetas reales (NASA Exoplanet Archive), con marca de habitabilidad."""
    try:
        data = await exoplanets.get_exoplanets()
    except Exception as e:
        raise _provider_http_error("NASA Exoplanet Archive", e)
    if data.get("stale"):
        _degraded(response)
    return data


@app.get("/api/comets")
async def list_comets(response: Response, date: Optional[str] = Query(None)):
    """Posiciones reales actuales de cometas notables (NASA Horizons)."""
    parsed = _parse_date(date)
    try:
        data = await nasa_horizons.get_comet_positions(parsed)
    except Exception as e:
        raise _provider_http_error("NASA Horizons", e)
    if data.get("stale") or data.get("pending") or not data.get("objects"):
        _degraded(response)
    return data


@app.get("/api/probes")
async def list_probes(response: Response, date: Optional[str] = Query(None)):
    """Posiciones reales actuales de sondas y telescopios (NASA Horizons)."""
    parsed = _parse_date(date)
    try:
        data = await nasa_horizons.get_spacecraft_positions(parsed)
    except Exception as e:
        raise _provider_http_error("NASA Horizons", e)
    if data.get("stale") or data.get("pending") or not data.get("objects"):
        _degraded(response)
    return data


@app.get("/api/launches")
async def list_launches(response: Response, limit: int = Query(8, ge=1, le=launches.MAX_LIMIT)):
    """Próximos lanzamientos orbitales de todas las agencias y empresas
    (The Space Devs — Launch Library 2). Incluye los de las últimas 24 h."""
    try:
        data = await launches.get_launches(limit)
    except Exception as e:
        raise _provider_http_error("Launch Library 2", e)
    if data["stale"]:
        _degraded(response)
    return data


@app.get("/api/asteroids")
async def list_asteroids(
    response: Response,
    days: int = Query(30, ge=1, le=asteroids.MAX_DAYS),
    dist_ld: float = Query(10.0, ge=0.1, le=asteroids.MAX_DIST_LD),
):
    """Asteroides y cometas que pasan a menos de `dist_ld` distancias lunares
    de la Tierra en los próximos `days` días (NASA/JPL CNEOS)."""
    try:
        data = await asteroids.get_asteroids(days, dist_ld)
    except Exception as e:
        raise _provider_http_error("NASA/JPL CNEOS", e)
    if data["stale"]:
        _degraded(response)
    return data


_windows_cache: dict = {}


def _windows(origin: str, destination: str, parsed_date: Optional[datetime],
             start_date: Optional[str], count: int) -> dict:
    """Ventanas de lanzamiento, cacheadas por (ruta, día, cantidad): son
    fechas absolutas y el resultado no cambia dentro del mismo día."""
    day = (parsed_date or datetime.utcnow()).strftime("%Y-%m-%d")
    key = (origin.lower(), destination.lower(), start_date or day, count)
    if key not in _windows_cache:
        if len(_windows_cache) > 500:
            _windows_cache.clear()
        _windows_cache[key] = orbital.find_launch_windows(origin, destination, parsed_date, count)
    return _windows_cache[key]


@app.get("/api/launch-windows/{origin}/{destination}")
def get_launch_windows(
    origin: str,
    destination: str,
    start_date: Optional[str] = Query(None),
    count: int = Query(3, ge=1, le=10),
):
    """Próximas ventanas de lanzamiento óptimas entre dos cuerpos."""
    try:
        parsed_date = datetime.fromisoformat(start_date) if start_date else None
        return _windows(origin, destination, parsed_date, start_date, count)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/missions/mars")
async def mars_missions(response: Response):
    """Marte ahora: la próxima ventana de lanzamiento Tierra→Marte (calculada,
    no narrada) y las naves reales con destino Marte, con su distancia actual
    a la Tierra y al Sol (NASA Horizons). Sin datos inventados: si Horizons no
    da ninguna nave, la lista va vacía."""
    window = None
    try:
        w = await run_in_threadpool(_windows, "earth", "mars", None, None, 1)
        if w["windows"]:
            window = {
                "origin": w["origin"],
                "destination": w["destination"],
                **w["windows"][0],
                "synodic_period_days": w["synodic_period_days"],
                "method": w["method"],
                "note": w["note"],
            }
    except Exception:
        window = None

    try:
        probes = await nasa_horizons.get_spacecraft_positions()
    except Exception:
        probes = {"objects": [], "stale": False}

    spacecraft = []
    for o in probes.get("objects", []):
        if o.get("target") != "mars":
            continue
        spacecraft.append({
            **o,
            "earth_dist_au": o.get("dist_au"),
            "earth_dist_km": o.get("dist_km"),
            "sun_dist_au": o.get("sun_dist_au"),
            "sun_dist_km": o.get("sun_dist_km"),
        })

    stale = any(o.get("stale") for o in spacecraft)
    result = {
        "window": window,
        "spacecraft": spacecraft,
        "source": (
            "Ventana: cálculo propio (alineación real de los planetas + "
            "transferencia de Hohmann, hapsira/astropy). Naves: NASA JPL Horizons."
        ),
        "stale": stale,
    }
    if probes.get("pending"):
        result["pending"] = probes["pending"]
    if stale or probes.get("pending") or not spacecraft or window is None:
        _degraded(response)
    return result


class ExplainRequest(BaseModel):
    concept: str
    lang: str = "es"


@app.post("/api/explain")
def explain(req: ExplainRequest):
    """Explica un concepto astronómico/orbital usando IA (Groq)."""
    try:
        text = narrative.explain_concept(req.concept, req.lang)
        return {"concept": req.concept, "explanation": text}
    except Exception as e:
        # Groq no configurado, modelo deprecado (404) o caído -> 503,
        # nunca un 500 sin explicar.
        raise HTTPException(status_code=503, detail=f"Narrativa IA no disponible: {e}")
