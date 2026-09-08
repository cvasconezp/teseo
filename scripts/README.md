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
