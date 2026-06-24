"""
nasa_horizons.py — Cliente para la API pública de NASA JPL Horizons

Consulta posiciones reales de cuerpos del sistema solar en cualquier fecha.
API gratuita, sin autenticación, mantenida por NASA/JPL.
Documentación: https://ssd-api.jpl.nasa.gov/doc/horizons.html
"""

from datetime import datetime, timedelta
from typing import Optional

import httpx

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

# Códigos NASA Horizons para cada cuerpo (IDs del sistema SPICE)
HORIZONS_CODES = {
    "sun": "10",
    "mercury": "199",
    "venus": "299",
    "earth": "399",
    "moon": "301",
    "mars": "499",
    "jupiter": "599",
    "saturn": "699",
    "uranus": "799",
    "neptune": "899",
    "pluto": "999",
}


async def get_body_position(body: str, date: Optional[datetime] = None) -> dict:
    """
    Obtiene la posición heliocéntrica real de un cuerpo en una fecha dada,
    consultando directamente a NASA Horizons.

    Devuelve coordenadas cartesianas (x, y, z) en UA, relativas al centro
    del Sol, en el plano eclíptico J2000 — el sistema de referencia
    estándar para visualización del sistema solar.
    """
    body = body.lower()
    if body not in HORIZONS_CODES:
        raise ValueError(f"Cuerpo desconocido: {body}")

    if date is None:
        date = datetime.utcnow()

    start = date.strftime("%Y-%m-%d")
    stop = (date + timedelta(days=1)).strftime("%Y-%m-%d")

    params = {
        "format": "json",
        "COMMAND": f"'{HORIZONS_CODES[body]}'",
        "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "VECTORS",
        "CENTER": "'500@10'",  # Centro: Sol (heliocéntrico)
        "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": "'1 d'",
        "VEC_TABLE": "'1'",  # Posición XYZ solamente
        "OUT_UNITS": "'AU-D'",
        "REF_PLANE": "'ECLIPTIC'",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(HORIZONS_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    result_text = data.get("result", "")
    position = _parse_vector_block(result_text)
    position["body"] = body
    position["date"] = date.isoformat()
    position["source"] = "NASA JPL Horizons"
    return position


def _parse_vector_block(text: str) -> dict:
    """
    Extrae el primer vector de posición (X, Y, Z) del bloque de texto que
    devuelve Horizons entre las marcas $$SOE y $$EOE.
    """
    if "$$SOE" not in text or "$$EOE" not in text:
        raise RuntimeError("NASA Horizons no devolvió datos de vector esperados")

    block = text.split("$$SOE")[1].split("$$EOE")[0].strip()
    lines = [l for l in block.splitlines() if l.strip()]

    x = y = z = None
    for line in lines:
        line = line.strip()
        if line.startswith("X ="):
            parts = line.replace("X =", "").replace("Y =", "|").replace("Z =", "|").split("|")
            x = float(parts[0].strip())
            y = float(parts[1].strip())
            z = float(parts[2].strip())
            break

    if x is None:
        raise RuntimeError("No se pudo parsear el vector de posición de Horizons")

    distance_au = (x**2 + y**2 + z**2) ** 0.5

    return {
        "x_au": round(x, 6),
        "y_au": round(y, 6),
        "z_au": round(z, 6),
        "distance_from_sun_au": round(distance_au, 6),
    }


async def get_distance_between_bodies(body_a: str, body_b: str, date: Optional[datetime] = None) -> dict:
    """
    Calcula la distancia real entre dos cuerpos en una fecha dada,
    usando sus posiciones heliocéntricas reales de NASA Horizons.
    """
    pos_a = await get_body_position(body_a, date)
    pos_b = await get_body_position(body_b, date)

    dx = pos_a["x_au"] - pos_b["x_au"]
    dy = pos_a["y_au"] - pos_b["y_au"]
    dz = pos_a["z_au"] - pos_b["z_au"]
    distance_au = (dx**2 + dy**2 + dz**2) ** 0.5

    AU_KM = 149_597_870.7

    return {
        "body_a": body_a,
        "body_b": body_b,
        "date": (date or datetime.utcnow()).isoformat(),
        "distance_au": round(distance_au, 6),
        "distance_km": round(distance_au * AU_KM, 0),
        "position_a": pos_a,
        "position_b": pos_b,
        "source": "NASA JPL Horizons (real-time vectors)",
    }
