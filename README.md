# Teseo

> *El universo es un laberinto. Teseo es tu hilo.*

Navegación cósmica real: trayectorias interplanetarias, ventanas de
lanzamiento y posiciones en vivo del sistema solar — calculadas con física
orbital real, no aproximaciones inventadas.

Proyecto hermano de [Yachay Deep](https://yachaydeep.com), open source
(MIT), creado por [Carlos Vásconez](https://github.com/cvasconezp).

---

## ¿Qué hace Teseo?

Responde tres preguntas que ninguna app de astronomía responde de forma
accesible:

1. **¿Qué tan lejos está?** — distancia real entre cuerpos del sistema
   solar, consultada en vivo a NASA JPL Horizons.
2. **¿Cuánto tardaría en llegar?** — trayectoria de transferencia de
   Hohmann real, calculada con `hapsira` (biblioteca de astrodinámica
   validada científicamente, no inventada).
3. **¿Cuándo es el mejor momento para salir?** — ventanas de lanzamiento
   óptimas, calculadas a partir del período sinódico real entre planetas.

## Principio de diseño: la IA narra, no calcula

Este es el punto más importante de la arquitectura. Hay una separación
estricta entre dos tipos de trabajo:

| Tarea | Quién la hace | Por qué |
|---|---|---|
| Posición de planetas | NASA JPL Horizons API | Datos oficiales, verificables |
| Trayectoria orbital, delta-v, tiempo de viaje | `hapsira` (Python) | Física real, determinista, reproducible |
| Ventanas de lanzamiento | Cálculo de período sinódico | Geometría orbital, no opinión |
| Narrativa del viaje ("durante tu trayecto...") | Groq (IA) | Generación de texto, no de números |
| Explicación de conceptos | Groq (IA) | Lenguaje, no física |

La IA (Groq, gratuito) nunca inventa ni recalcula los números. Recibe los
resultados ya calculados por la física real y los traduce a una
explicación legible. Si la IA se equivoca en una frase, no afecta la
exactitud científica de la app — porque los números nunca pasan por ella.

## Estructura del proyecto

```
teseo/
├── backend/                   → API FastAPI (se despliega en Railway)
│   ├── app/
│   │   ├── main.py            → endpoints FastAPI
│   │   ├── orbital.py         → física orbital real (hapsira)
│   │   ├── nasa_horizons.py   → cliente NASA Horizons API
│   │   └── narrative.py       → narrativa con Groq
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── railway.json
│   ├── .python-version       → fija Python 3.11 (astropy/numpy no traen wheels para 3.13)
│   └── .env.example
├── src/                       → frontend React + Vite (se despliega en Vercel)
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/favicon.svg
├── index.html
├── vite.config.js
├── vercel.json
├── package.json
├── .gitignore
└── README.md
```

El frontend (React + Vite, visualización en SVG) ya está incluido. Consume el
backend a través de la variable `VITE_API_URL`.

## Cómo correrlo localmente

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # En Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edita .env y pon tu GROQ_API_KEY (gratis en console.groq.com)

uvicorn app.main:app --reload --port 8000
```

Luego abre `http://localhost:8000/docs` — FastAPI genera documentación
interactiva automática donde puedes probar cada endpoint.

## ⚠️ Nota crítica de compatibilidad de versiones

`hapsira` (el fork mantenido de `poliastro`, que está archivado desde
octubre 2023) **requiere `astropy < 6.0`**. Si actualizas astropy a una
versión más reciente, hapsira deja de funcionar con el error:

```
ImportError: cannot import name 'matrix_product' from 'astropy.coordinates.matrix_utilities'
```

Esto fue verificado experimentalmente al construir este proyecto — no es
una suposición. El `requirements.txt` ya fija las versiones correctas y
probadas (`astropy==5.3.4`, `hapsira==0.18.0`). No actualizar sin volver a
probar.

## Endpoints disponibles

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/bodies` | Lista de planetas disponibles |
| GET | `/api/position/{body}` | Posición real actual (NASA Horizons) |
| GET | `/api/distance/{a}/{b}` | Distancia real entre dos cuerpos hoy |
| POST | `/api/route` | Ruta Hohmann completa + narrativa IA |
| GET | `/api/launch-windows/{a}/{b}` | Próximas ventanas de lanzamiento |
| POST | `/api/explain` | Explicación de un concepto (IA) |

### Ejemplo: calcular una ruta Tierra → Marte

```bash
curl -X POST http://localhost:8000/api/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "earth",
    "destination": "mars",
    "departure_date": "2026-07-01",
    "lang": "es",
    "include_narrative": true
  }'
```

## Honestidad científica

Las trayectorias de Hohmann asumen órbitas circulares y coplanares. Las
órbitas reales son elípticas y tienen inclinación entre sí, así que el
tiempo de viaje real puede variar algunos días respecto a este cálculo.
Para propósitos educativos y de planificación, esta es la aproximación
estándar usada en la industria aeroespacial para estimaciones iniciales.
Esta nota se muestra también en la app misma — la precisión y la
honestidad sobre sus límites son parte del producto, no un detalle legal.

## Despliegue (producción)

Teseo se despliega en dos servicios separados:

| Capa | Plataforma | Qué se publica |
|---|---|---|
| Frontend (React/Vite) | Vercel | la raíz del repo → `dist/` |
| Backend (FastAPI) | Railway | la carpeta `backend/` |

**Vercel (frontend).** Usa `vercel.json` (framework Vite, SPA rewrites). Define
la variable de entorno `VITE_API_URL` con la URL pública del backend en Railway,
por ejemplo `https://teseo-production.up.railway.app`. Esta variable se hornea en
el build, así que si la cambias hay que volver a desplegar.

**Railway (backend).** ⚠️ Punto crítico: el servicio de Railway debe tener
**Root Directory = `backend`** (Service → Settings → Root Directory). Si se deja
en la raíz del repo, Railway detecta el `package.json` del frontend y publica la
app de React en lugar de la API — y entonces todos los `/api/*` devuelven HTML y
el frontend cae al modo "backend sin conexión". Con el root en `backend/`,
Nixpacks detecta `requirements.txt`, fija Python 3.11 vía `.python-version` y
arranca con el `startCommand` de `railway.json`:
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Variables de entorno del backend en Railway:

- `GROQ_API_KEY` — para la narrativa con IA (opcional; sin ella la API sigue
  devolviendo todos los números, solo sin texto narrado).
- `ALLOWED_ORIGINS` — opcional, lista separada por comas con los dominios del
  frontend (p. ej. `https://teseo.yachaydeep.com`). Por defecto es `*`.

## Licencia

MIT — usa, copia, modifica y distribuye libremente, con atribución.

## Créditos de datos

- Posiciones planetarias: [NASA JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/)
- Física orbital: [hapsira](https://github.com/pleiszenburg/hapsira) (fork de poliastro, MIT)
- Narrativa: [Groq](https://groq.com) (modelos Llama open source)
