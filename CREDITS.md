# Créditos y licencias de datos

**Teseo (código):** MIT. Reutiliza, copia y modifica con atribución.

## Regla de licencias
El **código** de Teseo es propio (no copiamos código de terceros con licencias
copyleft). Los **datos** que empaquetamos conservan su licencia original y se
atribuyen aquí. Esto permite que Teseo siga siendo MIT.

## ⚠️ Stellarium — GPL-2.0+ (no usamos su código)
[Stellarium](https://github.com/Stellarium/stellarium) está bajo **GPL-2.0+**,
una licencia copyleft: incorporar su *código fuente* obligaría a relicenciar
todo Teseo como GPL. Por eso **no copiamos código de Stellarium**; el render 3D
es propio (Three.js).

Las **líneas de las constelaciones** provienen de la "western / modern
skyculture" de Stellarium (solo **datos**, no código). Confirmado en la fuente
oficial ([stellarium-skycultures](https://github.com/Stellarium/stellarium-skycultures)):
el texto y los datos de líneas están bajo **CC BY-SA** (atribución al equipo de
Stellarium; base IAU) — **no GPL**. Como es una licencia de *datos*, no afecta a
la licencia MIT del código: se incluye como recurso con licencia propia y su
atribución correspondiente. (El código de Stellarium sí es GPL y por eso no se
copia; nuestro render 3D es propio, con Three.js.)

## Fuentes de datos
| Dato | Fuente | Licencia |
|---|---|---|
| Posiciones/distancias de estrellas, índice de color B−V y tipo espectral | [HYG Database v4.1](https://github.com/astronexus/HYG-Database) (astronexus) — regenerado con `scripts/build_sky.py` | CC BY-SA 4.0 |
| Temperatura estelar a partir de B−V (fórmula) | Ballesteros, F. J. (2012), *EPL* 97, 34008 ([arXiv:1201.1809](https://arxiv.org/abs/1201.1809)), ec. 14 | cita bibliográfica |
| Color de cuerpo negro (fórmula) | Kim et al., lugar de Planck en CIE 1931 (US 7024034; Kang et al. 2002, *J. Korean Phys. Soc.* 41, 865) + matriz sRGB IEC 61966-2-1 | cita bibliográfica |
| Imágenes curadas de naves, cometas, Sol, Luna, planetas y cielo profundo (`src/sky/nasaImages.js`) | [NASA Image and Video Library](https://images.nasa.gov/) (API `images-api.nasa.gov`) | material de la NASA: en general sin copyright; crédito tal como lo da la NASA (ver abajo) |
| Líneas de constelaciones | Stellarium "western/modern skyculture" + IAU | CC BY-SA (datos; atribución) |
| Cúmulos/nebulosas/galaxias (Messier/NGC) | OpenNGC (M. Verga) | CC-BY-SA-4.0 |
| Distancias Messier | SEDS / valores publicados | dominio público (hechos) |
| Púlsares | ATNF Pulsar Catalogue (CSIRO) | citar Manchester et al. 2005 |
| Posiciones de planetas, cometas, sondas y telescopios | NASA JPL Horizons (API) | dominio público (US gov); crédito "NASA/JPL-Caltech" |
| Acercamientos de asteroides y cometas a la Tierra | NASA/JPL CNEOS — SBDB Close-Approach Data API v1.5 | dominio público (US gov); crédito "NASA/JPL-Caltech" |
| Próximos lanzamientos | [The Space Devs — Launch Library 2](https://thespacedevs.com/llapi) (API v2.3.0) | servicio gratuito con atribución (ver abajo) |
| Exoplanetas | NASA Exoplanet Archive (Caltech/IPAC) | dominio público (US gov) |
| Texturas del Sol, Venus, Tierra, Marte, Júpiter, Saturno (y anillos), Urano y Neptuno (`public/textures/`) | [Solar System Scope](https://www.solarsystemscope.com/textures/) (basadas en datos de NASA) | CC BY 4.0 |
| Textura de Mercurio | NASA / JHUAPL / Carnegie Institution (MESSENGER) | dominio público (US gov) |
| Textura de la Luna | NASA Scientific Visualization Studio (CGI Moon Kit) | dominio público (US gov) |
| Narrativa | Groq (modelos Llama) | — servicio |
| Render 3D | Three.js | MIT |

> Las distancias de objetos de cielo profundo y púlsares son valores publicados
> con incertidumbre real; se muestran como aproximaciones, fieles al principio
> de honestidad científica de Teseo.

## Condiciones de uso de las API en vivo (backend)

Verificadas el 13-nov-2026 en la documentación oficial de cada proveedor y
contra los propios servicios.

### NASA/JPL — Horizons y SBDB Close-Approach Data
- Fuentes: <https://ssd-api.jpl.nasa.gov/doc/horizons.html> y
  <https://ssd-api.jpl.nasa.gov/doc/cad.html>. Datos del gobierno de EE. UU.,
  sin restricción de copyright; se acreditan como **NASA/JPL-Caltech**.
- Política de uso justo de las API de JPL SSD (<https://ssd-api.jpl.nasa.gov/doc/>),
  y cómo la cumple Teseo:
  - *una sola petición a la vez* → todas las consultas a JPL (Horizons y CAD)
    pasan por una única cola en el backend;
  - *cachear y no repetir consultas* → caché en memoria (posiciones y naves:
    6 h; acercamientos: 6 h, con UNA consulta que cubre 60 días y 20
    distancias lunares y se filtra localmente);
  - *retroceder ante errores* → pausa tras un fallo y se sirve el último dato
    válido marcado `stale`;
  - *no incrustar las API en el sitio web* → el navegador nunca llama a JPL:
    solo el backend, que sirve su caché;
  - *identificarse con un User-Agent propio (producto, versión y contacto)* →
    variable de entorno `TESEO_USER_AGENT` del backend (hay que definirla en
    producción).
- **Tamaño de los asteroides:** `diameter_m` solo aparece cuando JPL tiene un
  diámetro medido. `diameter_est_m` es una **estimación** a partir de la
  magnitud absoluta H: `D = 1329 km / sqrt(p) × 10^(−H/5)`, con albedo
  p = 0,25 (mínimo) y p = 0,05 (máximo). La hora de máximo acercamiento se
  convierte de TDB a UTC (−69,184 s). Constantes: 1 au = 149 597 870,7 km;
  1 distancia lunar = 384 400 km.
- **Naves:** cada identificador de Horizons de `backend/app/nasa_horizons.py`
  se comprobó contra Horizons (efeméride vigente el 13-nov-2026). Estado de
  las misiones contrastado con NASA (blog de ESCAPADE, science.nasa.gov), ESA
  (MMX, BepiColombo, Hera) y las fichas de misión del propio Horizons.

### The Space Devs — Launch Library 2
- Fuente: <https://ll.thespacedevs.com/2.3.0/launches/upcoming/>.
- Uso gratuito sin clave: hasta **15 peticiones por hora y por IP**. El
  proveedor pide que el servidor cachee y sirva a sus clientes; Teseo hace
  una petición cada 30 minutos como mucho (y pausa 5 min tras un fallo).
  Con clave de pago (Patreon): variable `LL2_API_KEY`, cabecera
  `Authorization: Token <clave>`.
- El proveedor **no publica una licencia formal para los datos**; se usan
  con atribución visible ("The Space Devs — Launch Library 2"). Para un uso
  comercial o dudas de licencia: support@thespacedevs.com.
- **Imágenes de los lanzamientos:** NO son de The Space Devs. Cada imagen
  trae su propio autor y licencia (SpaceX, ULA, ESA, Roscosmos…). La API de
  Teseo entrega el autor en `image_credit`; debe mostrarse junto a la imagen.
- Las descripciones de misión se sirven en inglés, tal cual las da el
  proveedor (no se traducen con IA).


### NASA Image and Video Library (imágenes en la ficha)
- Fuente: <https://images.nasa.gov/> · API documentada en
  <https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf> (`/search`,
  `/asset/{nasa_id}`, sin clave). Verificado el 13-nov-2026.
- Condiciones (NASA Images and Media Usage Guidelines,
  <https://www.nasa.gov/nasa-brand-center/images-and-media/>): el material de la
  NASA «generally [is] not subject to copyright in the United States» y puede
  usarse con fines educativos e informativos, incluidas páginas web, **sin
  sugerir respaldo de la NASA** y **reconociendo a la NASA como fuente**.
  Excepciones que respetamos: el logotipo/insignia de la NASA no es de dominio
  público (no se usa ninguna imagen cuyo motivo sea el logotipo); las personas
  identificables requieren permiso para usos comerciales (no se eligió ninguna
  imagen de personas); el material de terceros con copyright va marcado con su
  titular (se descartaron las imágenes «© ESA»).
- Cada imagen es una elección manual (no el primer resultado de una búsqueda):
  `nasa_id`, título, crédito y fecha tal como los da la API, y su tipo:
  **fotografía**, **observación real procesada** (infrarrojo, ultravioleta,
  colores falsos), **ilustración artística** o **imagen generada por
  computadora**. La ficha lo rotula siempre y enlaza a
  `https://images.nasa.gov/details/{nasa_id}`. Comprobación contra la API real:
  `node scripts/test_sky_nasa.mjs --red`.
- **CORS:** la API responde `Access-Control-Allow-Origin: *`, pero las imágenes
  de `images-assets.nasa.gov` casi nunca (depende de la copia en caché de su
  CDN). Por eso la imagen de la NASA solo se muestra en la ficha; la postal
  (que se dibuja en un lienzo y se exporta) usa Wikipedia o la representación
  propia (`NASA_CANVAS_OK = false` en `src/sky/postcard.js`).
