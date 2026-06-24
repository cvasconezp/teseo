"""
test_smoke.py — Prueba rápida de que la instalación funciona

Corre esto después de instalar requirements.txt para confirmar que
hapsira, astropy y la lógica orbital funcionan correctamente en tu
máquina ANTES de levantar el servidor completo.

Uso:
    python3 test_smoke.py
"""

import sys
from datetime import datetime

sys.path.insert(0, ".")


def main():
    print("=== Prueba 1: Importar módulos ===")
    try:
        from app.orbital import compute_hohmann_transfer, find_launch_windows
        print("✅ app.orbital importado correctamente")
    except ImportError as e:
        print(f"❌ Error importando app.orbital: {e}")
        print("   Revisa que instalaste requirements.txt con las versiones exactas.")
        sys.exit(1)

    print()
    print("=== Prueba 2: Cálculo de transferencia de Hohmann (Tierra → Marte) ===")
    result = compute_hohmann_transfer("earth", "mars", datetime(2026, 7, 1))
    data = result.to_dict()

    expected_days_range = (250, 270)  # Rango conocido para Tierra-Marte
    if expected_days_range[0] <= data["transfer_time_days"] <= expected_days_range[1]:
        print(f"✅ Tiempo de transferencia correcto: {data['transfer_time_days']} días")
    else:
        print(f"⚠️  Tiempo de transferencia fuera de rango esperado: {data['transfer_time_days']} días")

    print(f"   Delta-v total: {data['delta_v_total_km_s']} km/s")
    print(f"   Fecha de llegada: {data['arrival_date']}")

    print()
    print("=== Prueba 3: Ventanas de lanzamiento ===")
    windows = find_launch_windows("earth", "mars", datetime(2026, 7, 1), count=2)

    expected_synodic_range = (770, 790)  # Periodo sinódico Tierra-Marte conocido (~780 días)
    if expected_synodic_range[0] <= windows["synodic_period_days"] <= expected_synodic_range[1]:
        print(f"✅ Período sinódico correcto: {windows['synodic_period_days']} días")
    else:
        print(f"⚠️  Período sinódico fuera de rango esperado: {windows['synodic_period_days']} días")

    print()
    print("=== Prueba 4: NASA Horizons (requiere internet) ===")
    try:
        import asyncio
        from app.nasa_horizons import get_distance_between_bodies

        async def test_horizons():
            return await get_distance_between_bodies("earth", "mars", datetime(2026, 6, 15))

        dist = asyncio.run(test_horizons())
        print(f"✅ NASA Horizons respondió: distancia Tierra-Marte = {dist['distance_au']} UA")
    except Exception as e:
        print(f"⚠️  No se pudo conectar a NASA Horizons (¿tienes internet?): {e}")

    print()
    print("=== Prueba 5: Groq (narrativa IA) ===")
    try:
        from app.narrative import generate_travel_narrative

        text = generate_travel_narrative(data, lang="es")
        print(f"✅ Groq respondió:\n   {text}")
    except RuntimeError as e:
        print(f"⚠️  Groq no configurado (normal si aún no pusiste tu GROQ_API_KEY): {e}")
    except Exception as e:
        print(f"⚠️  Error llamando a Groq: {e}")

    print()
    print("=== Resumen ===")
    print("Si las pruebas 1-3 pasaron con ✅, el corazón físico de Teseo funciona.")
    print("Las pruebas 4-5 requieren internet y configuración de GROQ_API_KEY.")


if __name__ == "__main__":
    main()
