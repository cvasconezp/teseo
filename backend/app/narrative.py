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


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY no configurada. Crea una cuenta gratis en "
                "console.groq.com y ponla en tu archivo .env"
            )
        _client = Groq(api_key=api_key)
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
- Origen: {hohmann_data['origin']}
- Destino: {hohmann_data['destination']}
- Fecha de salida: {hohmann_data['departure_date']}
- Fecha de llegada: {hohmann_data['arrival_date']}
- Duración del viaje: {hohmann_data['transfer_time_days']} días
- Delta-v total requerido: {hohmann_data['delta_v_total_km_s']} km/s
- Método: transferencia de Hohmann

{lang_instruction}
Escribe una narrativa breve y asombrosa de este viaje, usando estos datos exactos.
"""

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=200,
    )

    return completion.choices[0].message.content.strip()


def explain_concept(concept: str, lang: str = "es") -> str:
    """
    Explica un concepto astronómico/orbital en lenguaje simple.
    Usado cuando el usuario pregunta "¿qué es una ventana de lanzamiento?"
    o similar, directamente desde la UI.
    """
    client = _get_client()

    lang_instruction = "Responde en español." if lang == "es" else "Respond in English."

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Explica brevemente qué es: {concept}. {lang_instruction}",
            },
        ],
        temperature=0.5,
        max_tokens=150,
    )

    return completion.choices[0].message.content.strip()
