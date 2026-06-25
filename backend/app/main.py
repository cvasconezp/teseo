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
            except RuntimeError as e:
                # Si Groq no está configurado, la ruta sigue funcionando
                # sin narrativa — los datos físicos son lo esencial.
                data["narrative"] = None
                data["narrative_error"] = str(e)

        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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
        return orbital.find_launch_windows(origin, destination, parsed_date, count)
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
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
