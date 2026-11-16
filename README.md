# Teseo

> *El universo es un laberinto. Teseo es tu hilo.*

**Navegador interplanetario y planetario de bolsillo, con física orbital real
y datos citados.** En línea: **[teseo.yachaydeep.com](https://teseo.yachaydeep.com)**
· versión **1.3** (16-nov-2026).

Hecho por [Yachay Deep Labs](https://yachaydeep.com) **en cooperación con
[Killa Ñan · Astronomía comunitaria](https://sites.google.com/view/killanan/inicio)**
(Cayambe, Ecuador). Código abierto (MIT), creado por
[Carlos Vásconez-Paredes](https://github.com/cvasconezp). Español e inglés;
pensado para el teléfono, desde adolescentes hasta investigadores.

> *Stellarium te dice qué hay en el cielo. Teseo te dice qué tan lejos está,
> cuánto tardarías en llegar y cuándo conviene salir.*

---

## ¿Qué hace Teseo?

Cuatro pestañas:

1. **Ruta** — de un planeta a otro (o a la Luna y al Sol): distancia real
   (NASA JPL Horizons), transferencia de Hohmann, próximas **ventanas de
   lanzamiento**, trayectoria realista (Lambert, con porkchop), las
   **catapultas gravitatorias** de misiones reales y un planificador de
   viajes con asistencias (validado con Cassini).
2. **Ahora** — el Sol de hoy (manchas solares de SILSO, regiones activas,
   fulguraciones, índice Kp e imagen de NASA SDO), el calendario del cielo
   para tu ciudad (Luna, eclipses, meteoros, planetas, pasadas de la ISS,
   lanzamientos relevantes) con recordatorios, naves rumbo a Marte y
   asteroides cercanos.
3. **Cielo** — planetario en 3D desde tu ciudad, con atmósfera y
   contaminación lumínica: 5.000 estrellas en su distancia real, 88
   constelaciones, Messier, Caldwell (con las Nubes de Magallanes), galaxias, púlsares, agujeros negros,
   exoplanetas, sondas y la ISS en vivo; fichas con composición, espectro y
   vida de cada estrella, imágenes de NASA, ESA/Webb, ESA/Hubble y ESO, y
   una imagen vertical para compartir en redes.
4. **Preguntas** — nueve recorridos jugables: qué tan grande es el universo,
   la masa, los viajes en el tiempo, el espectro, los agujeros negros, las
   ondas gravitacionales, la expansión y la energía oscura, la materia oscura
   y ¿estamos solos?

Todas las fuentes están en la propia app («Créditos y datos»), agrupadas por
institución.

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
| GET | `/api/positions` | Posición real de todos los planetas (NASA Horizons) |
| GET | `/api/exoplanets` | Exoplanetas (NASA Exoplanet Archive) |
| GET | `/api/comets` | Cometas notables, posición actual (NASA Horizons) |
| GET | `/api/probes` | Sondas y telescopios en vuelo, con destino, agencia y estado (NASA Horizons) |
| GET | `/api/launches?limit=8` | Próximos lanzamientos orbitales de todas las agencias (The Space Devs — Launch Library 2) |
| GET | `/api/asteroids?days=30&dist_ld=10` | Asteroides y cometas que pasan cerca de la Tierra (NASA/JPL CNEOS) |
| GET | `/api/missions/mars` | Próxima ventana Tierra→Marte y naves con destino Marte |
| GET | `/api/health` | Versión y edad de las cachés por proveedor (no llama a nadie) |
| POST | `/api/m` (= `/api/metrics/event`) | Métricas de uso anónimas y agregadas; responde siempre 204 |
| GET | `/api/metrics/summary?days=30` · `/api/metrics/summary.csv` | Resumen de uso (requiere `TESEO_METRICS_TOKEN`; sin él, 404) |

Toda llamada a un proveedor externo va con caché en memoria, una sola petición
a la vez donde el proveedor lo exige y, si el proveedor falla, se sirve el
último dato válido marcado `stale: true` (ver `backend/app/cache.py`). Ningún
endpoint espera más de ~25 s y los errores son siempre JSON con `detail`.

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
- `LL2_API_KEY` — opcional, clave de Launch Library 2 (sin ella: 15
  peticiones/hora por IP, suficiente con la caché de 30 min).
- `TESEO_USER_AGENT` — recomendado: identifica al backend ante NASA/JPL, cuya
  política de uso pide producto, versión y contacto en el User-Agent
  (p. ej. `Teseo/0.2 (+https://tu-sitio; tu-correo@dominio)`).
- `TESEO_METRICS_DIR` — directorio donde se guardan las métricas de uso
  (p. ej. un volumen persistente de Railway montado en `/data`). Sin ella, o si
  no se puede escribir, las métricas viven solo en memoria y se pierden al
  reiniciar; `/api/health` → `metrics.storage` lo indica.
- `TESEO_METRICS_TOKEN` — token para leer el resumen:
  `curl -H "Authorization: Bearer $TOKEN" https://…/api/metrics/summary?days=30`
  o `…/api/metrics/summary.csv?token=$TOKEN` (para una hoja de cálculo). Sin
  token configurado, esos endpoints responden 404.
- `TESEO_METRICS_UTC_OFFSET_HOURS` — opcional: desfase del "día" de los
  contadores respecto a UTC (`-5` para Ecuador continental). Por defecto, día UTC.
- `TESEO_METRICS_RATE_PER_MIN` — opcional: eventos por minuto y origen
  (por defecto 1500, alto porque en un evento todo el público comparte la IP de
  la wifi).

### Métricas de uso (anónimas y agregadas)

Además de Google Analytics (que solo se activa si la persona acepta el aviso de
cookies), Teseo cuenta qué funciones se usan con un sistema propio que **no
recoge datos personales**: `src/ui/track.js` envía en lotes, con `sendBeacon`
(`text/plain`, sin preflight CORS), eventos de una lista blanca (`tab_change`,
`q_open`, `now_card_view`…) con valores cortos de un conjunto conocido; el
backend (`backend/app/metrics.py`) vuelve a filtrarlos con su propia lista
blanca y **solo incrementa contadores por día** (p. ej.
`2026-11-14 · tab_change · tab:sky → 37`). No se guarda IP, user-agent, cookies,
identificadores ni la hora de cada evento; el móvil/tableta/escritorio se deduce
del user-agent al recibir `session_start` y el user-agent se descarta al
instante. Las "visitas" son `session_start`, una por pestaña del navegador (marca
en `sessionStorage`). El límite de abuso usa un hash de la IP con sal que cambia
cada minuto y solo vive en memoria. Si el navegador envía Do Not Track o Global
Privacy Control, tampoco se envía nada al backend propio.

## Licencia

MIT — usa, copia, modifica y distribuye libremente, con atribución.

## Créditos de datos

La lista completa, agrupada por institución, está en la app («Créditos y
datos») y en `CREDITS.md`. Las principales:

- Agencias: NASA (JPL Horizons, CNEOS, Exoplanet Archive, SDO, GSFC) y ESA
  (Gaia, Planck; imágenes de ESA/Webb y ESA/Hubble).
- Observatorios y colaboraciones: ESO, LIGO-Virgo-KAGRA, Event Horizon
  Telescope, SILSO (Real Observatorio de Bélgica), CSIRO (ATNF), CERN.
- Institutos de medida: NIST, NOAA (SWPC, WMM), UAI e IERS.
- Catálogos: HYG (Hipparcos), Stellarium, OpenNGC, IMO, CelesTrak, Launch
  Library 2.
- Física orbital: [hapsira](https://github.com/pleiszenburg/hapsira), astropy
  y sgp4. Narrativa: [Groq](https://groq.com) (modelos Llama) — narra, nunca
  calcula.
