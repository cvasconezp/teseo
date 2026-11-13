"""
narrative.py — Generación de narrativa de viaje usando Groq

IMPORTANTE: este módulo NUNCA calcula física. Solo recibe los resultados
YA CALCULADOS por orbital.py (datos reales y deterministas) y los convierte
en una explicación legible para humanos. La IA narra; no calcula.

Usa Groq (gratuito, modelos open-source como Llama) en lugar de un LLM de pago,
ya que esta tarea es generación de texto, no razonamiento matemático crítico.
"""

import os
from groq import Groq

# La API key se lee de la variable de entorno GROQ_API_KEY.
# Carlos: crea tu key gratis en https://console.groq.com y ponla en tu .env
_client: Groq | None = None

# Modelo Groq, configurable por entorno para sobrevivir deprecaciones sin
# tocar código (basta cambiar GROQ_MODEL en Railway y reiniciar).
#
# Aviso (sept 2026): Groq movió `llama-3.3-70b-versatile` y
# `llama-3.1-8b-instant` a planes Enterprise, así que en cuentas developer
# devuelven 404 ("model does not exist or you do not have access to it").
# Modelos disponibles en plan developer: openai/gpt-oss-120b,
# openai/gpt-oss-20b, groq/compound, groq/compound-mini.
# Ref: https://console.groq.com/docs/models y .../docs/deprecations
DEFAULT_MODEL = "openai/gpt-oss-120b"


def _model() -> str:
    return os.environ.get("GROQ_MODEL", DEFAULT_MODEL)


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY no configurada. Crea una cuenta gratis en "
                "console.groq.com y ponla en tu archivo .env"
            )
        # Tope de espera: 11 s por intento y un solo reintento (~23 s como
        # máximo), para que /api/route y /api/explain nunca se queden colgados.
        _client = Groq(api_key=api_key, timeout=11.0, max_retries=1)
    return _client


SYSTEM_PROMPT = """Eres el narrador de Teseo, una app de navegación cósmica.
Tu trabajo es explicar viajes interplanetarios reales de forma clara,
asombrosa y precisa para personas sin formación científica.

Reglas estrictas:
- NUNCA inventes números. Usa exactamente los datos numéricos que se te dan.
- Sé conciso: 3-4 frases máximo.
- Tono: asombro genuino, no exagerado. Como un guía experto y cercano.
- Si el usuario escribe en inglés, responde en inglés. Si escribe en español, responde en español.
- No uses emojis ni markdown.
"""


_MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
             "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
_MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"]
_NOMBRES_ES = {"mercury": "Mercurio", "venus": "Venus", "earth": "la Tierra", "mars": "Marte",
               "jupiter": "Júpiter", "saturn": "Saturno", "uranus": "Urano", "neptune": "Neptuno"}


def _human_date(iso: str, lang: str) -> str:
    """'2026-11-13T02:14:17.064033' -> '13 de noviembre de 2026' / 'November 13, 2026'.
    Solo cambia el FORMATO de la fecha ya calculada; no altera el dato."""
    from datetime import datetime
    try:
        d = datetime.fromisoformat(str(iso))
    except ValueError:
        return str(iso)
    if lang == "es":
        return f"{d.day} de {_MESES_ES[d.month - 1]} de {d.year}"
    return f"{_MONTHS_EN[d.month - 1]} {d.day}, {d.year}"


def _body_name(body: str, lang: str) -> str:
    if lang == "es":
        return _NOMBRES_ES.get(body, body)
    return ("Earth" if body == "earth" else body.capitalize())


def _complete_text(completion) -> str:
    """Texto de la respuesta; si el modelo se quedó sin tokens a media frase,
    se recorta en el último punto para no mostrar una frase cortada."""
    choice = completion.choices[0]
    text = (choice.message.content or "").strip()
    if getattr(choice, "finish_reason", None) == "length":
        cut = max(text.rfind(". "), text.rfind(".\n"))
        if text.endswith("."):
            return text
        if cut > 40:
            return text[: cut + 1]
    return text


def generate_travel_narrative(hohmann_data: dict, lang: str = "es") -> str:
    """
    Convierte el resultado numérico de una transferencia de Hohmann en una
    narrativa breve y comprensible. Los números vienen ya calculados por
    orbital.py — esta función solo los traduce a lenguaje humano.
    """
    client = _get_client()

    lang_instruction = "Responde en español." if lang == "es" else "Respond in English."

    user_prompt = f"""
Datos reales de este viaje (ya calculados, no los modifiques):
- Origen: {_body_name(hohmann_data['origin'], lang)}
- Destino: {_body_name(hohmann_data['destination'], lang)}
- Fecha de salida: {_human_date(hohmann_data['departure_date'], lang)}
- Fecha de llegada: {_human_date(hohmann_data['arrival_date'], lang)}
- Duración del viaje: {round(float(hohmann_data['transfer_time_days']))} días
- Delta-v total requerido: {round(float(hohmann_data['delta_v_total_km_s']), 1)} km/s
- Método: transferencia de Hohmann

{lang_instruction}
Escribe una narrativa breve y asombrosa de este viaje, usando estos datos exactos.
Escribe las fechas tal como se te dan (sin horas) y termina siempre la última frase.
"""

    completion = client.chat.completions.create(
        model=_model(),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=900,
    )

    return _complete_text(completion)


def explain_concept(concept: str, lang: str = "es") -> str:
    """
    Explica un concepto astronómico/orbital en lenguaje simple.
    Usado cuando el usuario pregunta "¿qué es una ventana de lanzamiento?"
    o similar, directamente desde la UI.
    """
    client = _get_client()

    lang_instruction = "Responde en español." if lang == "es" else "Respond in English."

    completion = client.chat.completions.create(
        model=_model(),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Explica brevemente qué es: {concept}. {lang_instruction}",
            },
        ],
        temperature=0.5,
        max_tokens=700,
    )

    return _complete_text(completion)
