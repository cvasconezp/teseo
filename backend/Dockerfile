# Dockerfile del backend de Teseo.
# Pensado para construirse con el contexto = carpeta backend/
# (en Railway: Service Settings -> Root Directory = "backend").
FROM python:3.11-slim
WORKDIR /app

# Dependencias primero (mejor cacheo de capas)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código de la app
COPY . .

# Railway/!$PORT define el puerto en runtime
CMD ["sh","-c","uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
