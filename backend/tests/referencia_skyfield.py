"""
Genera la referencia independiente de tests/test_iss.py con Skyfield.

NO es una prueba (el nombre no empieza por test_) y Skyfield NO está en
requirements.txt: se instala solo en un entorno aparte.

    python -m venv /tmp/venv-sky && /tmp/venv-sky/bin/pip install skyfield
    /tmp/venv-sky/bin/python backend/tests/referencia_skyfield.py > /tmp/ref.json

Skyfield aporta, de forma independiente de app/iss.py: la escala de tiempos
(UT1, TT con las tablas de IERS), el paso TEME→ITRS con movimiento polar, la
efeméride JPL DE421 del Sol, la sombra de la Tierra (`is_sunlit`) y la
búsqueda de eventos (`find_events`). Solo comparte con iss.py el propagador
SGP4 (la misma biblioteca `sgp4`), que se valida aparte (altura, período e
inclinación) y contra Heavens-Above, que usa software y TLE propios.
"""
import json
import sys
from datetime import datetime, timezone

import numpy as np
from skyfield.api import Loader, EarthSatellite, wgs84

L1 = "1 25544U 98067A   26317.91612726  .00008668  00000+0  16320-3 0  9995"
L2 = "2 25544  51.6324 279.1461 0007382  22.6178 337.5134 15.49359724594967"
LUGARES = {"quito": (-0.22, -78.51, 2850), "madrid": (40.42, -3.70, 650)}
T0 = datetime(2026, 11, 14, 0, 0, tzinfo=timezone.utc)
DIAS = 3

load = Loader("/tmp/skydata")
ts = load.timescale()
eph = load("de421.bsp")
sat = EarthSatellite(L1, L2, "ISS", ts)
sol, tierra = eph["sun"], eph["earth"]
out = {}
for nombre, (lat, lon, alt) in LUGARES.items():
    obs = wgs84.latlon(lat, lon, elevation_m=alt)
    t0 = ts.from_datetime(T0)
    t1 = ts.from_datetime(datetime.fromtimestamp(T0.timestamp() + DIAS * 86400, tz=timezone.utc))
    t, ev = sat.find_events(obs, t0, t1, altitude_degrees=10.0)
    pasadas, cur = [], {}
    for ti, e in zip(t, ev):
        if e == 0:
            cur = {"start": ti.utc_iso()}
        elif e == 1 and cur:
            topo = (sat - obs).at(ti)
            cur["max"] = ti.utc_iso()
            cur["max_alt"] = round(topo.altaz()[0].degrees, 2)
        elif e == 2 and cur and "max" in cur:
            cur["end"] = ti.utc_iso()
            # visibilidad: muestreo cada 2 s entre inicio y fin
            a = ts.from_datetime(datetime.fromisoformat(cur["start"].replace("Z", "+00:00")))
            b = ts.from_datetime(datetime.fromisoformat(cur["end"].replace("Z", "+00:00")))
            tt = ts.tt_jd(np.arange(a.tt, b.tt, 2 / 86400))
            iluminada = sat.at(tt).is_sunlit(eph)
            sol_alt = (tierra + obs).at(tt).observe(sol).apparent().altaz()[0].degrees
            vis = iluminada & (sol_alt < -6.0)
            cur["visible"] = bool(vis.sum() * 2 >= 10)
            cur["visible_s"] = int(vis.sum() * 2)
            pasadas.append(cur)
            cur = {}
    out[nombre] = {"lat": lat, "lon": lon, "alt_m": alt, "pasadas": pasadas}
json.dump(out, sys.stdout, indent=1)
