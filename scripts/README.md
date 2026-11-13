# Pipeline de datos de objetos

Regenera los catálogos de objetos del cielo que consume el frontend
(`public/*.json`) desde sus fuentes oficiales, de forma **reproducible y
auditable**. Antes estos JSON estaban hechos a mano; ahora hay un script por
capa y un orquestador.

## Qué genera

| Salida | Fuente | Distancia | Nº aprox. |
|---|---|---|---|
| `public/pulsars.json` | ATNF Pulsar Catalogue | catálogo / medida de dispersión (DM) | ~4.000 |
| `public/deepsky.json` | Messier curado + OpenNGC | curada SEDS/NASA | 110 |
| `public/galaxies.json` | OpenNGC (tipo galaxia) | redshift → ley de Hubble (H0=70) | ~2.000 |
| `public/blackholes.json` | tabla curada (`build_blackholes.py`) | literatura publicada | ~18 |
| `public/sky.json` | HYG Database v4.1 (`build_sky.py`) | paralaje Hipparcos | 5.044 estrellas + 88 constelaciones |

## Uso

```bash
cd scripts
python3 build_data.py          # regenera todo
python3 build_pulsars.py       # o una sola capa
```

Requisitos: solo la librería estándar de Python 3 (no hace falta `psrqpy`;
el `.db` de ATNF se parsea directamente). `scripts/requirements.txt` lista
lo opcional.

## Fuentes crudas (`scripts/raw/`, ignorada por git)

`build_data.py` descarga lo que falte:

- **OpenNGC** `NGC.csv` — se descarga solo desde GitHub.
- **ATNF** `psrcat.tar.gz` — el servidor de CSIRO a veces corta la conexión
  por el proxy. Si la descarga automática falla, bájalo a mano de
  <https://www.atnf.csiro.au/research/pulsar/psrcat/> y déjalo en
  `scripts/raw/` (o extrae `psrcat.db` ahí directamente).

## Honestidad científica (importante)

- **Galaxias:** la distancia por redshift solo es fiable en el *flujo de
  Hubble*. Por debajo de ~15 Mly las velocidades peculiares dominan y
  `cz/H0` da valores muy erróneos (p. ej. las Nubes de Magallanes saldrían a
  varios Mly). Por eso la capa se restringe a `dist ≥ 15 Mly`: justo el
  régimen donde el redshift **es** la distancia estándar publicada. Las
  galaxias más cercanas y famosas ya están, con distancia curada, en la capa
  Messier.
- **Púlsares:** solo se incluyen los que tienen posición **y** distancia
  publicada (del catálogo o derivada de la DM). Sin distancia no hay
  profundidad real.
- Cada JSON lleva su `meta.source` con la procedencia. Coincide con el
  principio del proyecto: datos reales y verificables, la IA narra pero no
  inventa números.

## Convención de coordenadas

Todo objeto se guarda como vector unitario ecuatorial J2000 `(nx, ny, nz)`
para la dirección + `dist_ly` para la profundidad:

```
x = cos(dec)·cos(ra)   y = cos(dec)·sin(ra)   z = sin(dec)
```

Verificada contra el dato previo (M1/Crab). Helpers en `lib_astro.py`.

## Estrellas: `public/sky.json` (`build_sky.py`)

```bash
python3 scripts/build_sky.py /ruta/a/hygdata_v41.csv --check   # compara, no escribe
python3 scripts/build_sky.py /ruta/a/hygdata_v41.csv           # regenera
```

Sin ruta, descarga `hygdata_v41.csv` (~34 MB) del repositorio oficial
<https://github.com/astronexus/HYG-Database> (carpeta `hyg/CURRENT`, CC BY-SA 4.0)
a `scripts/raw/`, que git ignora: el catálogo **no** se guarda en el repositorio.
No se ejecuta desde `build_data.py` a propósito: el archivo es grande y las
posiciones no cambian.

**Selección (reproduce exactamente el archivo publicado antes de que existiera
este script):** estrellas de HYG con número Hipparcos y magnitud ≤ 6,0, más las
3 más débiles que usa alguna línea de constelación (Mira entre ellas), en el
orden del catálogo. Dirección = (x, y, z)/|(x, y, z)| de HYG a 5 decimales;
distancia = `dist` × 3,2615638 a 1 decimal (326.156,4 a. l. = HYG no tiene
paralaje fiable); nombre = `proper`. `--check` comprueba que HIP, x/y/z,
magnitud, distancia, nombre y constelaciones no cambian (diferencias: 0). Las
líneas de constelaciones (Stellarium, CC BY-SA) se copian del `sky.json`
existente; este script no las rehace.

**Esquema 2** (documentado también en `meta.star_fields` y `meta.star_fields_note`):

```
[hip, x, y, z, mag, color, dist_ly, nombre, bv, spect]
                                            └ añadidos al FINAL: el código que lee
                                              los 8 primeros sigue funcionando
```

- `bv`: índice de color B−V (`ci` de HYG); `null` si falta (2 estrellas).
- `spect`: tipo espectral (`spect` de HYG) tal cual; `""` si falta.
- `color`: color de **cuerpo negro** a la temperatura que da el B−V, en sRGB.
  Es lo único que cambia respecto al archivo anterior. Las estrellas sin B−V
  conservan su color neutro (`#fff2e6`).

**Fórmulas** (las mismas en `build_sky.py` y en `src/sky/starColor.js`;
`scripts/test_sky_starcolor.mjs` comprueba que coinciden estrella a estrella):

1. Temperatura: Ballesteros, F. J. (2012), «New insights into black bodies»,
   *EPL* 97, 34008 (arXiv:1201.1809), ec. (14):
   `T = 4600 K · [1/(0,92·(B−V) + 1,7) + 1/(0,92·(B−V) + 0,62)]`.
   El artículo no da intervalo de validez; contrastada con temperaturas
   publicadas acierta ±1–9 % entre ~3.300 y ~10.000 K, y se queda corta en las
   estrellas más calientes (Rigel −13 %, Espiga −43 %): por encima de 10.400 K
   la ficha dice «al menos». Fuera de −0,4 ≤ B−V ≤ 2,0 no se muestra temperatura.
2. Color: lugar de Planck en CIE 1931 (x, y) con la aproximación cúbica de
   Kim et al. (patente US 7024034; Kang et al. 2002, *J. Korean Phys. Soc.* 41,
   865), 1.667–25.000 K → XYZ (Y = 1) → sRGB lineal (matriz IEC 61966-2-1, D65)
   → normalizado al canal mayor → curva de transferencia sRGB.
3. En pantalla, por defecto, el color se mezcla al 50 % con blanco (el ojo ve
   los colores estelares muy tenues); «Resaltar colores» (Capas → Vista) usa el
   color completo guardado en `sky.json`.

**Peso** (cuenta para la caché offline de la PWA): 302.281 → 373.734 bytes en
bruto; 113.093 → 139.603 con gzip -9 (+26,5 KB). Como el contenido cambia, la
versión de caché de `public/sw.js` (`teseo-v2`, *cache-first* para `/sky.json`)
debe subirse al publicar, o los teléfonos que ya lo tienen seguirán con el
viejo (la app funciona con los dos: sin `bv` la estrella no muestra temperatura).
