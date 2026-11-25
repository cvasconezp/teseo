"""Configuración común de pytest: el límite por IP de las rutas caras (app/main.py, TESEO_API_RATE_PER_MIN) se
sube aquí para que toda la batería, que comparte la «IP» del TestClient, no lo agote; tests/test_api.py lo prueba
con un limitador propio."""
import os

os.environ.setdefault("TESEO_API_RATE_PER_MIN", "1000000")
