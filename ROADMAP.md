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
- [x] Messier (110) con distancias reales (SEDS/NASA) + constelación (OpenNGC)
- [x] Púlsares (~4.000, ATNF con distancia+período) y agujeros negros (18) notables
- [x] Galaxias (~2.000) con distancia real por redshift (OpenNGC, flujo de Hubble)
- [x] Exoplanetas en vivo desde NASA Exoplanet Archive (~6.300) + habitabilidad
- [x] Pipeline de datos reproducible y auditable (`scripts/`, ver scripts/README.md)
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
- [x] **"¿Cómo se vería el cielo desde allí?"** (cambiar el punto de observación)
- [x] Comparador de escalas / distancias (regla cósmica) — pestaña 'Escala'

## 🧱 Plataforma y calidad
- [x] Página de **créditos y licencias** de datos in-app (ver CREDITS.md)
- [x] Diseño responsive (desktop/tablet/móvil)
- [~] Gestos táctiles (OrbitControls) ok · accesibilidad WCAG pendiente
- [x] Carga inicial optimizada (exoplanetas bajo demanda)
- [ ] Rendimiento runtime con muchas capas activas
- [x] Tests del backend (física + endpoints) — 21 pruebas, pytest
- [x] Ventanas de lanzamiento por **alineación real** (ángulo de fase heliocéntrico), no "hoy + período sinódico"
- [x] Horizons en cola (una petición a la vez) + reintentos + caché por día + último dato válido si la NASA cae
- [x] Error boundaries y errores visibles con reintento en el frontend
- [x] Deep-links, postal del cielo y onboarding
- [x] Rediseño UI/UX (nov-2026): pestañas fijas, mapa tocable, texturas reales y modelos 3D
- [x] "Apuntar al cielo" (giroscopio/brújula): probado en iPhone; modo inmersivo con flecha guía "Encuéntralo"
- [x] "Esta noche en tu cielo": Luna, planetas, lluvias activas y constelaciones visibles desde tu ubicación
- [x] Capas explicadas: qué es, fuente, patrón en el cielo y dato → frase (exoplanetas a escala con la Tierra)
- [x] Pestaña "Preguntas": ¿Estamos solos?, agujeros negros, expansión del universo y materia oscura, con niveles de certeza y datos publicados
- [x] "Ahora en el espacio": naves rumbo a Marte, próximos lanzamientos (Launch Library 2) y asteroides cercanos (JPL CNEOS)
- [x] 21 naves en vivo (JPL Horizons) con tiempo de señal; fotos reales de sondas; fichas de constelación
- [x] Salida, culminación y puesta por objeto; norte geográfico en el modo apuntar (WMM2025, verificado con los valores de prueba de NOAA)
- [x] Postal para compartir con vista previa; enlaces "Participa" de ciencia ciudadana
- [x] Accesibilidad: contraste AA medido, teclado y foco; pruebas de Node de toda la matemática

## 🧪 Ideas para explorar
- [ ] Más culturas de constelaciones (no solo la moderna/occidental; p. ej. andina)
- [x] Color de las estrellas por temperatura real (B−V de HYG v4.1, Ballesteros 2012) y tipo espectral explicado
- [x] Imágenes curadas de la NASA Image and Video Library, rotuladas foto / ilustración
- [x] Medidor de rendimiento (#sky?...&fps=1) y resolución adaptativa
- [ ] Rutas con órbitas reales y asistencias gravitatorias; pasos visibles de la ISS
- [x] Lluvias de meteoros ("activa ahora"), cometas y sondas/telescopios en vivo (NASA Horizons)
- [ ] Satélites en vivo (TLE de Celestrak + SGP4)
- [x] Modo "tour guiado" narrado por IA — recorrido de objetos icónicos con narración Groq
