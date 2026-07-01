# Hoja de ruta de Teseo

> 📄 Documento de producto y visión crítica: `Teseo-Framework.docx`.

> *Stellarium te dice qué hay en el cielo. Teseo te dice qué tan lejos está,
> cuánto tardarías en llegar y cuándo conviene salir.*

**Posicionamiento:** Teseo = todo lo bueno de un planetario (Stellarium) **+**
la capa de navegación cósmica que nadie más tiene (rutas, ventanas de
lanzamiento, profundidad real, "tiempo de viaje"). Open source (MIT) y gratis.

Leyenda: ✅ hecho · 🔜 siguiente · 🧪 idea/explorar

---

## ✅ Completado

### Núcleo (Sesiones 1–3)
- [x] Backend FastAPI con física orbital real (`hapsira`)
- [x] Posiciones reales en vivo desde NASA JPL Horizons
- [x] Transferencias de Hohmann (tiempo de viaje, Δv)
- [x] Ventanas de lanzamiento (período sinódico real)
- [x] Narrativa con IA (Groq) — narra, no calcula
- [x] Frontend React + Vite (intro animada, pantalla de ruta, i18n ES/EN)
- [x] Conexión frontend ↔ backend en vivo

### Infraestructura / despliegue
- [x] Backend en Railway (Root Directory = backend, Python 3.11, `$PORT` vía Dockerfile)
- [x] Frontend en Vercel (`VITE_API_URL` → Railway), dominio teseo.yachaydeep.com
- [x] CORS configurable, README de despliegue

### Sesión 4 — Constelaciones en profundidad real (3D, Three.js)
- [x] 88 constelaciones con líneas reales + 5.044 estrellas (HYG/Hipparcos)
- [x] Profundidad real: estrellas en su distancia 3D verdadera (años luz)
- [x] La cámara gira con el slider para revelar la profundidad
- [x] Tamaño por magnitud y color por tipo espectral
- [x] Al elegir constelación se ocultan las líneas de las demás

### Capas de objetos
- [x] Messier (110) con distancias reales (SEDS/NASA)
- [x] Púlsares (18, ATNF) y agujeros negros (16) notables
- [x] Exoplanetas en vivo desde NASA Exoplanet Archive (~6.300) + habitabilidad
- [x] Toggles por capa, clic para identificar (raycast), zoom al objeto
- [x] Ficha de objeto con distancia real y "su luz salió hace X" (twist Teseo)

### Sesión 5 — PWA + pulido
- [x] PWA instalable + offline (service worker, manifest, iconos)
- [x] Fondo animado de viaje espacial
- [x] Footer "desarrollado por Yachay Deep Labs"

---

## 🔜 Siguiente — Paridad con Stellarium

- [x] **Cielo local**: ubicación (geolocalización/manual) + fecha/hora → alt/azimut
      (tiempo sidéreo local), horizonte y brújula N-E-S-O.
- [x] **Control de tiempo**: −1d/−1h/+1h/+1d, play (animar), ahora
- [x] **Sol, Luna y planetas en el cielo** (posición real, efemérides + fase lunar)
- [x] **Buscar** un objeto por nombre (estrellas/constelaciones/Messier) y centrar la vista
- [x] **Zoom a objeto con imagen real** (Wikipedia/Wikimedia, CC BY-SA) + ficha ampliada
      con descripción; búsqueda de estrellas y cuerpos del sistema solar
- [x] Nombres de estrellas/constelaciones con **densidad ajustable** (LOD)

## 🌌 El "plus" de Teseo (lo que Stellarium NO hace)
- [x] Rutas interplanetarias (Hohmann) y ventanas de lanzamiento
- [x] Profundidad real de las constelaciones
- [x] "La luz que ves salió hace X años"
- [x] **Tiempo de viaje a objetos** (luz + Voyager 1) en la ficha
- [ ] **"¿Cómo se vería el cielo desde allí?"** (cambiar el punto de observación)
- [x] Comparador de escalas / distancias (regla cósmica) — pestaña 'Escala'

## 🧱 Plataforma y calidad
- [x] Página de **créditos y licencias** de datos in-app (ver CREDITS.md)
- [x] Diseño responsive (desktop/tablet/móvil)
- [~] Gestos táctiles (OrbitControls) ok · accesibilidad WCAG pendiente
- [x] Carga inicial optimizada (exoplanetas bajo demanda)
- [ ] Rendimiento runtime con muchas capas activas
- [x] Tests del backend (física + endpoints) — 12 pruebas, pytest

## 🧪 Ideas para explorar
- [ ] Más culturas de constelaciones (no solo la moderna/occidental)
- [ ] Lluvias de meteoros, cometas, satélites (TLE)
- [x] Modo "tour guiado" narrado por IA — recorrido de objetos icónicos con narración Groq
