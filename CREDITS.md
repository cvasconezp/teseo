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
| Posiciones/distancias de estrellas | HYG Database v4.1 (astronexus) | CC BY-SA 4.0 |
| Líneas de constelaciones | Stellarium "western/modern skyculture" + IAU | CC BY-SA (datos; atribución) |
| Cúmulos/nebulosas/galaxias (Messier/NGC) | OpenNGC (M. Verga) | CC-BY-SA-4.0 |
| Distancias Messier | SEDS / valores publicados | dominio público (hechos) |
| Púlsares | ATNF Pulsar Catalogue (CSIRO) | citar Manchester et al. 2005 |
| Posiciones de planetas | NASA JPL Horizons | dominio público (US gov) |
| Exoplanetas | NASA Exoplanet Archive (Caltech/IPAC) | dominio público (US gov) |
| Narrativa | Groq (modelos Llama) | — servicio |
| Render 3D | Three.js | MIT |

> Las distancias de objetos de cielo profundo y púlsares son valores publicados
> con incertidumbre real; se muestran como aproximaciones, fieles al principio
> de honestidad científica de Teseo.
