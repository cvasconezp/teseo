# Dockerfile del backend de Teseo.
# Pensado para construirse con el contexto = carpeta backend/
# (en Railway: Service Settings -> Root Directory = "backend").
# Imagen base: se deja en la etiqueta 3.11-slim (recibe los parches de seguridad de Debian y de Python 3.11).
# runtime.txt dice 3.11.9 pero .python-version solo 3.11; fijar python:3.11.9-slim congelaría una imagen de
# 2024 sin esos parches. Recomendación pendiente: ejecutar como usuario sin privilegios (USER) solo tras
# comprobar que el volumen de Railway (/data: métricas, push, MGA) sigue siendo escribible para ese usuario.
FROM python:3.11-slim
WORKDIR /app

# Dependencias primero (mejor cacheo de capas)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código de la app (las pruebas y los .env quedan fuera: ver .dockerignore)
COPY . .

# Railway/!$PORT define el puerto en runtime
CMD ["sh","-c","uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
