"""
main.py — API de Teseo

Endpoints:
  GET  /                              → health check
  GET  /api/bodies                    → lista de cuerpos disponibles
  GET  /api/position/{body}           → posición real actual (NASA Horizons)
  GET  /api/distance/{a}/{b}          → distancia real entre dos cuerpos hoy
  POST /api/route                     → ruta Hohmann completa + narrativa
  GET  /api/launch-windows/{a}/{b}    → próximas ventanas de lanzamiento
  POST /api/explain                   → explicación de un concepto (IA)

Para correr localmente:
  uvicorn app.main:app --reload --port 8000
"""

import os
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import orbital
from app import nasa_horizons
from app import narrative
from app import exoplanets

app = FastAPI(
    title="Teseo API",
    description="Navegación cósmica real — trayectorias, ventanas de lanzamiento y posiciones reales del sistema solar.",
    version="0.1.0",
)

# CORS configurable por entorno. Por defecto "*" (cómodo en desarrollo).
# En producción, define ALLOWED_ORIGINS como lista separada por comas, p. ej.:
#   ALLOWED_ORIGINS=https://teseo.yachaydeep.com,https://teseo-seven.vercel.app
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


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "project": "Teseo",
        "description": "Real-time interplanetary navigation API",
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
async def get_all_positions(date: Optional[str] = Query(None)):
    """
    Posición heliocéntrica real de TODOS los planetas en una sola llamada
    (NASA Horizons, en cola y con caché). Los cuerpos que no se puedan
    consultar se listan en `errors` en vez de tumbar toda la respuesta.
    """
    try:
        parsed_date = datetime.fromisoformat(date) if date else None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    positions, errors = {}, {}
    for body_id in orbital.BODIES.keys():
        try:
            positions[body_id] = await nasa_horizons.get_body_position(body_id, parsed_date)
        except Exception as e:
            errors[body_id] = str(e)
    return {"positions": positions, "errors": errors, "source": "NASA JPL Horizons"}


@app.on_event("startup")
async def _prewarm_positions():
    """Al arrancar, precarga en segundo plano las posiciones de hoy para
    que el primer visitante no espere a la NASA."""
    import asyncio

    async def warm():
        for body_id in orbital.BODIES.keys():
            try:
                await nasa_horizons.get_body_position(body_id)
            except Exception:
                pass

    if os.getenv("TESEO_PREWARM", "1") == "1":
        asyncio.create_task(warm())


@app.get("/api/position/{body}")
async def get_position(body: str, date: Optional[str] = Query(None)):
    """
    Posición heliocéntrica real de un cuerpo, consultada en vivo a NASA
    Horizons. `date` en formato YYYY-MM-DD; si se omite, usa hoy.
    """
    try:
        parsed_date = datetime.fromisoformat(date) if date else None
        result = await nasa_horizons.get_body_position(body, parsed_date)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando NASA Horizons: {e}")


@app.get("/api/distance/{body_a}/{body_b}")
async def get_distance(body_a: str, body_b: str, date: Optional[str] = Query(None)):
    """Distancia real entre dos cuerpos en una fecha dada (NASA Horizons)."""
    try:
        parsed_date = datetime.fromisoformat(date) if date else None
        result = await nasa_horizons.get_distance_between_bodies(body_a, body_b, parsed_date)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando NASA Horizons: {e}")


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
async def list_exoplanets():
    """Exoplanetas reales (NASA Exoplanet Archive), con marca de habitabilidad."""
    try:
        return await exoplanets.get_exoplanets()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando NASA Exoplanet Archive: {e}")


@app.get("/api/comets")
async def list_comets(date: Optional[str] = Query(None)):
    """Posiciones reales actuales de cometas notables (NASA Horizons)."""
    try:
        parsed = datetime.fromisoformat(date) if date else None
        return await nasa_horizons.get_comet_positions(parsed)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando NASA Horizons: {e}")


@app.get("/api/probes")
async def list_probes(date: Optional[str] = Query(None)):
    """Posiciones reales actuales de sondas y telescopios (NASA Horizons)."""
    try:
        parsed = datetime.fromisoformat(date) if date else None
        return await nasa_horizons.get_spacecraft_positions(parsed)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando NASA Horizons: {e}")


_windows_cache: dict = {}


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
        # Las ventanas son fechas absolutas: el resultado no cambia dentro
        # del mismo día, así que se cachea por (ruta, día, cantidad).
        day = (parsed_date or datetime.utcnow()).strftime("%Y-%m-%d")
        key = (origin.lower(), destination.lower(), start_date or day, count)
        if key not in _windows_cache:
            if len(_windows_cache) > 500:
                _windows_cache.clear()
            _windows_cache[key] = orbital.find_launch_windows(origin, destination, parsed_date, count)
        return _windows_cache[key]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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
