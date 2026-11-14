"""
lambert.py — «Trayectoria realista»: problema de Lambert con posiciones reales.

Hohmann (orbital.py) supone órbitas circulares y coplanares. Aquí se resuelve
el problema de Lambert (Izzo, vía hapsira) entre las posiciones REALES de los
dos planetas —efemérides analíticas integradas en astropy (ERFA epv00/plan94,
sin red ni descargas)— para una fecha de salida y una de llegada concretas.
Se explora una cuadrícula pequeña alrededor de la próxima ventana y se elige
la solución de MÍNIMO C3 de salida (la energía que debe dar el cohete).

Convenciones y fuentes
  * Marco: eclíptico J2000 heliocéntrico (Sol = origen), km y km/s.
  * μ☉ = hapsira Sun.k (1,32712440018e11 km³/s², IAU 2015).
  * Planetas: GM y radio ecuatorial de hapsira.bodies (IAU/NASA); Tierra con
    R = 6378,137 km y μ = 398600,4418 km³/s² (igual que src/special/math.js).
  * Órbita de salida de la Tierra: LEO circular de 185 km (la de la ruta Luna).
    Inyección: Δv = √(v∞² + v_esc²) − v_circ, impulso único desde LEO.
  * Inserción en el destino: Δv = √(v∞² + v_esc²) − v_circ a una órbita
    circular baja (altitudes de la tabla LOW_ORBIT_ALT_KM, de referencia).
    En gigantes gaseosos no se calcula: depende de la órbita de captura
    elegida (Juno usó una órbita elíptica de ~53 días, no una circular baja).
  * Solo transferencias directas (0 revoluciones, sentido prógrado). No hay
    asistencias gravitatorias ni maniobras de espacio profundo.

Rendimiento: unos ~3000 problemas de Lambert (~10 ms una vez compilado) más
una sola evaluación vectorizada de efemérides por cuadrícula. La PRIMERA
llamada de cada proceso paga ~4-5 s de compilación de numba (izzo); por eso
`warm()` se invoca desde el prewarm de main.py.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import numpy as np
from astropy import units as u
from astropy.coordinates import get_body_barycentric_posvel, solar_system_ephemeris
from astropy.time import Time
from hapsira.bodies import Sun
from hapsira.iod.izzo import izzo_fast

from app import orbital

# ─── Constantes físicas ────────────────────────────────────────────────────

MU_SUN = float(Sun.k.to_value(u.km**3 / u.s**2))
_EPS_J2000 = np.deg2rad(23.4392911)           # oblicuidad de la eclíptica J2000
_DAY_S = 86400.0

R_EARTH_KM = 6378.137
MU_EARTH = 398600.4418
LEO_ALT_KM = 185.0

# Altitud de la órbita circular baja de referencia en cada planeta rocoso (km).
# Valores típicos de misiones reales (Mercurio ~200 km MESSENGER/BepiColombo,
# Venus ~300 km, Marte ~300 km MRO/MAVEN rango). Para la Tierra, la LEO de 185 km.
# Los gigantes no tienen entrada: ahí no es razonable una órbita circular baja.
LOW_ORBIT_ALT_KM = {
    "mercury": 200.0,
    "venus": 300.0,
    "earth": LEO_ALT_KM,
    "mars": 300.0,
}

# Destinos para los que la transferencia directa NO es lo que usan las misiones
# reales (Δv de llegada o C3 desproporcionados). Cada ejemplo está verificado
# en NASA/ESA (ver `_ASSIST_NOTES`; fuentes y más misiones en src/route/assists.js).
# Voyager 2: lanzamiento 20 ago 1977, Urano 24 ene 1986 y Neptuno 25 ago 1989 (UT,
# NASA science.nasa.gov/mission/voyager/voyager-2); NASA dice que es la única nave
# que ha visitado Urano y Neptuno y que cada sobrevuelo la impulsó hacia el siguiente
# planeta (science.nasa.gov/mission/voyager/planetary-voyage).
ASSIST_BODIES = {"mercury", "jupiter", "saturn", "uranus", "neptune"}

_ASSIST_NOTES = {
    "es": {
        "mercury": (
            "Mercurio: una transferencia directa exige frenar muchísimo al llegar "
            "(v∞ de llegada muy alta). Las misiones reales usan asistencias "
            "gravitatorias (p. ej. MESSENGER, de NASA, y BepiColombo, de ESA/JAXA, "
            "combinaron sobrevuelos de la Tierra, Venus y Mercurio)."
        ),
        "jupiter": (
            "Júpiter: el Δv de una trayectoria directa es muy alto. Juno (NASA) salió "
            "en 2011 y usó un sobrevuelo de la Tierra el 9 de octubre de 2013 para "
            "ganar velocidad hacia Júpiter."
        ),
        "saturn": (
            "Saturno: la trayectoria directa es muy exigente. Cassini (NASA) usó "
            "sobrevuelos de Venus (abr 1998 y 24 jun 1999), la Tierra "
            "(ago 1999) y Júpiter (30 dic 2000)."
        ),
        "uranus": (
            "Urano: la trayectoria directa es extrema; solo una nave lo ha visitado "
            "(Voyager 2, el 24 de enero de 1986), con ayuda de las asistencias "
            "gravitatorias de Júpiter y Saturno."
        ),
        "neptune": (
            "Neptuno: la trayectoria directa es extrema; solo una nave lo ha visitado "
            "(Voyager 2, el 25 de agosto de 1989), con ayuda de las asistencias "
            "gravitatorias de Júpiter, Saturno y Urano."
        ),
    },
    "en": {
        "mercury": (
            "Mercury: a direct transfer needs a huge braking burn on arrival (very "
            "high arrival v∞). Real missions use gravity assists (e.g. NASA's "
            "MESSENGER and ESA/JAXA's BepiColombo combined flybys of Earth, Venus "
            "and Mercury)."
        ),
        "jupiter": (
            "Jupiter: a direct trajectory costs a lot of Δv. Juno (NASA) launched in "
            "2011 and used an Earth flyby on 9 October 2013 to gain speed toward Jupiter."
        ),
        "saturn": (
            "Saturn: the direct trajectory is very demanding. Cassini (NASA) used "
            "flybys of Venus (Apr 1998 and 24 Jun 1999), Earth (Aug 1999) "
            "and Jupiter (30 Dec 2000)."
        ),
        "uranus": (
            "Uranus: the direct trajectory is extreme; only one spacecraft has "
            "visited it (Voyager 2, on 24 January 1986), helped by gravity assists "
            "at Jupiter and Saturn."
        ),
        "neptune": (
            "Neptune: the direct trajectory is extreme; only one spacecraft has "
            "visited it (Voyager 2, on 25 August 1989), helped by gravity assists at "
            "Jupiter, Saturn and Uranus."
        ),
    },
}

# ─── Efemérides ────────────────────────────────────────────────────────────


def _body_state(body: str, jds: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Posición (N,3 km) y velocidad (N,3 km/s) heliocéntricas del planeta en
    eclíptica J2000, para fechas julianas TDB. Efemérides integradas de astropy
    (sin red). Una sola llamada vectorizada para todas las fechas."""
    jds = np.atleast_1d(np.asarray(jds, dtype=float))
    t = Time(jds, format="jd", scale="tdb")
    with solar_system_ephemeris.set("builtin"):
        pp, pv = get_body_barycentric_posvel(body, t)
        sp, sv = get_body_barycentric_posvel("sun", t)
    pos = np.stack([(pp.x - sp.x).to_value(u.km), (pp.y - sp.y).to_value(u.km),
                    (pp.z - sp.z).to_value(u.km)], axis=-1)
    vel = np.stack([(pv.x - sv.x).to_value(u.km / u.s), (pv.y - sv.y).to_value(u.km / u.s),
                    (pv.z - sv.z).to_value(u.km / u.s)], axis=-1)
    return _eq_to_ecl(pos), _eq_to_ecl(vel)


def _eq_to_ecl(v: np.ndarray) -> np.ndarray:
    """Ecuatorial (ICRS) → eclíptica J2000: rotación en x por la oblicuidad."""
    c, s = np.cos(_EPS_J2000), np.sin(_EPS_J2000)
    out = np.empty_like(v)
    out[..., 0] = v[..., 0]
    out[..., 1] = v[..., 1] * c + v[..., 2] * s
    out[..., 2] = -v[..., 1] * s + v[..., 2] * c
    return out


def _ecl_to_eq(v: np.ndarray) -> np.ndarray:
    c, s = np.cos(_EPS_J2000), np.sin(_EPS_J2000)
    out = np.empty_like(v)
    out[..., 0] = v[..., 0]
    out[..., 1] = v[..., 1] * c - v[..., 2] * s
    out[..., 2] = v[..., 1] * s + v[..., 2] * c
    return out


# ─── Lambert ───────────────────────────────────────────────────────────────


def _lambert_batch(r1: np.ndarray, r2: np.ndarray, tof_s: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Resuelve Lambert (0 revoluciones, prógrado) para N pares de posiciones.
    Devuelve (v1, v2) de forma (N,3) en km/s; NaN donde no converge."""
    n = len(tof_s)
    v1 = np.full((n, 3), np.nan)
    v2 = np.full((n, 3), np.nan)
    for i in range(n):
        if not tof_s[i] > 0:
            continue
        try:
            a, b = izzo_fast(MU_SUN, r1[i], r2[i], float(tof_s[i]), 0, True, True, 35, 1e-8)
        except Exception:
            continue
        v1[i] = a
        v2[i] = b
    return v1, v2


def _eval_pairs(origin: str, destination: str, dep_jd: np.ndarray, arr_jd: np.ndarray) -> dict:
    """Lambert para N pares (salida, llegada) —vectores de igual longitud, fechas
    julianas TDB—. Devuelve vectores (N): tiempo de vuelo, v∞ de salida y de
    llegada (km/s), vector v∞ de salida y `type1` (ángulo de transferencia
    < 180°: «tipo I»; > 180° es «tipo II»). NaN donde no converge."""
    dep_jd = np.asarray(dep_jd, dtype=float)
    arr_jd = np.asarray(arr_jd, dtype=float)
    r_o, v_o = _body_state(origin, dep_jd)
    r_d, v_d = _body_state(destination, arr_jd)
    tof = (arr_jd - dep_jd) * _DAY_S
    sv1, sv2 = _lambert_batch(r_o, r_d, tof)
    vinf_dep_vec = sv1 - v_o
    vinf_arr_vec = sv2 - v_d
    # Ángulo de transferencia prógrado (0–360°): signo del producto vectorial en z
    cosang = np.sum(r_o * r_d, axis=1) / (np.linalg.norm(r_o, axis=1) * np.linalg.norm(r_d, axis=1))
    ang = np.arccos(np.clip(cosang, -1.0, 1.0))
    cross_z = r_o[:, 0] * r_d[:, 1] - r_o[:, 1] * r_d[:, 0]
    ang = np.where(cross_z >= 0, ang, 2 * np.pi - ang)
    return {
        "tof_days": tof / _DAY_S,
        "vinf_dep": np.linalg.norm(vinf_dep_vec, axis=1),
        "vinf_arr": np.linalg.norm(vinf_arr_vec, axis=1),
        "vinf_dep_vec": vinf_dep_vec,
        "type1": ang < np.pi,
    }


def _dv_leo_injection(vinf: float, mu: float, r: float) -> float:
    """Δv de un impulso desde una órbita circular de radio r hasta una
    hipérbola con exceso v∞: √(v∞² + v_esc²) − v_circ."""
    v_circ = np.sqrt(mu / r)
    v_esc2 = 2.0 * mu / r
    return float(np.sqrt(vinf**2 + v_esc2) - v_circ)


def _low_orbit(body: str) -> Optional[dict]:
    """Parámetros del cuerpo para una órbita circular baja, o None (gigantes)."""
    if body not in LOW_ORBIT_ALT_KM:
        return None
    if body == "earth":
        mu, radius = MU_EARTH, R_EARTH_KM
    else:
        b = orbital.BODIES[body]
        mu = float(b.k.to_value(u.km**3 / u.s**2))
        radius = float(b.R.to_value(u.km))
    alt = LOW_ORBIT_ALT_KM[body]
    return {"mu": mu, "radius_km": radius, "alt_km": alt, "r_km": radius + alt}


def _jd_to_iso(jd: float) -> str:
    t = Time(jd, format="jd", scale="tdb").utc
    t.precision = 0                      # redondea al segundo (no trunca)
    return t.strftime("%Y-%m-%dT%H:%M:%S") + "Z"


def _snap_day(jd_tdb: float) -> float:
    """Lleva una fecha juliana TDB a la medianoche UTC más cercana (devuelve
    TDB). Evita falsa precisión: los resultados se dan a nivel de día."""
    t = Time(jd_tdb, format="jd", scale="tdb").utc
    day = Time(round(t.jd - 0.5) + 0.5, format="jd", scale="utc")
    return float(day.tdb.jd)


def _dla_deg(vinf_vec_ecl: np.ndarray) -> float:
    """Declinación de la asíntota de salida respecto al ecuador terrestre
    (ICRS ≈ ecuador J2000): asin(z/|v|)."""
    eq = _ecl_to_eq(np.asarray(vinf_vec_ecl, dtype=float))
    return float(np.degrees(np.arcsin(eq[2] / np.linalg.norm(eq))))


def _describe(origin: str, destination: str, dep_jd: float, arr_jd: float,
              vinf_dep: float, vinf_arr: float, vinf_dep_vec: np.ndarray) -> dict:
    """Cifras de una solución: fechas, C3, v∞, Δv desde LEO e inserción."""
    out = {
        "departure_date": _jd_to_iso(dep_jd),
        "arrival_date": _jd_to_iso(arr_jd),
        "transfer_time_days": round(float(arr_jd - dep_jd), 1),
        "c3_km2_s2": round(vinf_dep**2, 2),
        "v_inf_departure_km_s": round(vinf_dep, 3),
        "v_inf_arrival_km_s": round(vinf_arr, 3),
        "delta_v_heliocentric_km_s": round(vinf_dep + vinf_arr, 3),
    }
    out["departure_declination_deg"] = (
        round(_dla_deg(vinf_dep_vec), 1) if origin == "earth" else None
    )
    o = _low_orbit(origin)
    out["injection"] = None if o is None else {
        "delta_v_km_s": round(_dv_leo_injection(vinf_dep, o["mu"], o["r_km"]), 3),
        "parking_altitude_km": o["alt_km"],
    }
    d = _low_orbit(destination)
    out["insertion"] = None if d is None else {
        "delta_v_km_s": round(_dv_leo_injection(vinf_arr, d["mu"], d["r_km"]), 3),
        "orbit_altitude_km": d["alt_km"],
        "body_radius_km": round(d["radius_km"], 1),
        "body_mu_km3_s2": round(d["mu"], 1),
    }
    if out["injection"] and out["insertion"]:
        out["delta_v_leo_to_low_orbit_km_s"] = round(
            out["injection"]["delta_v_km_s"] + out["insertion"]["delta_v_km_s"], 3)
    else:
        out["delta_v_leo_to_low_orbit_km_s"] = None
    return out


def evaluate_trajectory(origin: str, destination: str, departure: datetime, arrival: datetime) -> dict:
    """Lambert para UNA pareja exacta de fechas (UTC). Sirve para contrastar
    con misiones reales. Devuelve las cifras de `_describe`."""
    dep_jd = Time(departure.replace(tzinfo=None).isoformat(), scale="utc").tdb.jd
    arr_jd = Time(arrival.replace(tzinfo=None).isoformat(), scale="utc").tdb.jd
    g = _eval_pairs(origin, destination, np.array([dep_jd]), np.array([arr_jd]))
    if not np.isfinite(g["vinf_dep"][0]):
        raise ValueError("Lambert no converge para esas fechas")
    return _describe(origin, destination, dep_jd, arr_jd,
                     float(g["vinf_dep"][0]), float(g["vinf_arr"][0]), g["vinf_dep_vec"][0])


# ─── Búsqueda del mínimo C3 y porkchop ─────────────────────────────────────

SEARCH_HALF_SPAN_DAYS = 60.0   # salida: ventana ± 60 d
SEARCH_DEP_STEP_DAYS = 4.0     # paso grueso de salida
SEARCH_TOF_STEPS = 41          # TOF 0,6–1,4 × Hohmann en 41 valores
TOF_MIN_FACTOR, TOF_MAX_FACTOR = 0.6, 1.4
PORK_N = 25                    # porkchop de PORK_N × PORK_N
PORK_DEP_STEP_DAYS = 5.0


def _min_c3(origin, destination, dep, tof, type1_only):
    """C3 mínimo sobre la malla (salida × TOF). Devuelve (C3, i, j, c3_matriz)."""
    dd = np.repeat(dep, len(tof))
    tt = np.tile(tof, len(dep))
    g = _eval_pairs(origin, destination, dd, dd + tt)
    c3 = g["vinf_dep"] ** 2
    if type1_only is not None:
        c3 = np.where(g["type1"] == type1_only, c3, np.nan)
    c3 = c3.reshape(len(dep), len(tof))
    if not np.isfinite(c3).any():
        return None
    i, j = np.unravel_index(np.nanargmin(c3), c3.shape)
    return float(c3[i, j]), int(i), int(j)


def _search_min_c3(origin: str, destination: str, center_jd: float, hohmann_days: float,
                   not_before_jd: Optional[float], type1: bool = True) -> Optional[tuple[float, float]]:
    """Mínimo C3 en (salida, TOF) para transferencias de tipo I (`type1=True`)
    o tipo II. Malla gruesa + refinado local. Si el mínimo cae en el borde de
    salida se recentra (hasta 2 veces): la ventana de Hohmann circular puede
    quedar a decenas de días del óptimo real. Devuelve (dep_jd, arr_jd) o None."""
    lo = center_jd - SEARCH_HALF_SPAN_DAYS
    if not_before_jd is not None:
        lo = max(lo, not_before_jd)
    n_dep = int(round(2 * SEARCH_HALF_SPAN_DAYS / SEARCH_DEP_STEP_DAYS)) + 1
    tofs = hohmann_days * np.linspace(TOF_MIN_FACTOR, TOF_MAX_FACTOR, SEARCH_TOF_STEPS)
    shifted = 0
    while True:
        dep = lo + SEARCH_DEP_STEP_DAYS * np.arange(n_dep)
        found = _min_c3(origin, destination, dep, tofs, type1)
        if found is None:
            return None
        _, i, j = found
        at_clip = not_before_jd is not None and dep[0] <= not_before_jd + 1e-9
        if i == 0 and not at_clip and shifted < 2:
            lo -= SEARCH_HALF_SPAN_DAYS / 2
            if not_before_jd is not None:
                lo = max(lo, not_before_jd)
            shifted += 1
            continue
        if i == n_dep - 1 and shifted < 2:
            lo += SEARCH_HALF_SPAN_DAYS / 2
            shifted += 1
            continue
        break
    d0, t0 = float(dep[i]), float(tofs[j])

    # Refinado local alrededor del mínimo grueso (dos pasadas con malla fina).
    d_step = SEARCH_DEP_STEP_DAYS
    t_step = hohmann_days * (TOF_MAX_FACTOR - TOF_MIN_FACTOR) / (SEARCH_TOF_STEPS - 1)
    for _ in range(2):
        dd = d0 + np.linspace(-d_step, d_step, 9)
        if not_before_jd is not None:
            dd = dd[dd >= not_before_jd - 1e-9]
        tt = t0 + np.linspace(-t_step, t_step, 9)
        tt = tt[tt > 5]
        f = _min_c3(origin, destination, dd, tt, type1)
        if f is None:
            break
        _, i, j = f
        d0, t0 = float(dd[i]), float(tt[j])
        d_step, t_step = d_step / 4, t_step / 4
    return d0, d0 + t0


def compute_trajectory(origin: str, destination: str, window: dict, hohmann: dict,
                       today: Optional[datetime] = None) -> dict:
    """Trayectoria realista para el par origen→destino alrededor de `window`
    (un elemento de `find_launch_windows`) y comparación con `hohmann`
    (to_dict de `compute_hohmann_transfer`)."""
    origin, destination = origin.lower(), destination.lower()
    today = today or datetime.utcnow()
    hoh_days = float(hohmann["transfer_time_days"])
    center_jd = Time(datetime.fromisoformat(window["departure_date"]).isoformat(), scale="tdb").jd
    not_before = Time(today.replace(hour=0, minute=0, second=0, microsecond=0).isoformat(),
                      scale="utc").tdb.jd

    def solve(type1):
        sol = _search_min_c3(origin, destination, center_jd, hoh_days, not_before, type1)
        if sol is None:
            return None
        d_jd, a_jd = _snap_day(sol[0]), _snap_day(sol[1])
        g = _eval_pairs(origin, destination, np.array([d_jd]), np.array([a_jd]))
        return _describe(origin, destination, d_jd, a_jd, float(g["vinf_dep"][0]),
                         float(g["vinf_arr"][0]), g["vinf_dep_vec"][0]), d_jd, a_jd

    # Titular: mínimo C3 de tipo I (ángulo < 180°), como Mars 2020 o InSight.
    # Si no existiera, el mínimo de cualquier tipo.
    main = solve(True) or solve(None)
    if main is None:
        raise ValueError("No hay solución de Lambert en la cuadrícula explorada")
    best, dep_jd, arr_jd = main
    alt = solve(False)
    alt_ii = None
    if alt is not None and alt[0]["c3_km2_s2"] < best["c3_km2_s2"] - 0.05:
        alt_ii = alt[0]

    # Porkchop: PORK_N × PORK_N, ejes salida × llegada centrados en el óptimo.
    half = (PORK_N - 1) / 2 * PORK_DEP_STEP_DAYS
    p_lo = dep_jd - half     # sin recortar a hoy: se ve el valle completo; `not_before` marca lo ya pasado
    p_dep = p_lo + PORK_DEP_STEP_DAYS * np.arange(PORK_N)
    p_arr = np.linspace(p_dep[0] + TOF_MIN_FACTOR * hoh_days,
                        p_dep[-1] + TOF_MAX_FACTOR * hoh_days, PORK_N)
    di, aj = np.meshgrid(p_dep, p_arr, indexing="ij")
    pg = _eval_pairs(origin, destination, di.ravel(), aj.ravel())
    c3 = (pg["vinf_dep"] ** 2).reshape(PORK_N, PORK_N)
    tof = pg["tof_days"].reshape(PORK_N, PORK_N)
    t1 = pg["type1"].reshape(PORK_N, PORK_N)
    mask = (tof >= TOF_MIN_FACTOR * hoh_days) & (tof <= TOF_MAX_FACTOR * hoh_days) & np.isfinite(c3) & t1
    c3 = np.where(mask, c3, np.nan)
    matrix = [[None if not np.isfinite(x) else round(float(x), 1) for x in row] for row in c3]
    pork = {
        "departure_dates": [_jd_to_iso(x)[:10] for x in p_dep],
        "arrival_dates": [_jd_to_iso(x)[:10] for x in p_arr],
        "c3_km2_s2": matrix,
        "c3_grid_min": None if not mask.any() else round(float(np.nanmin(c3)), 1),
        "tof_range_days": [round(TOF_MIN_FACTOR * hoh_days), round(TOF_MAX_FACTOR * hoh_days)],
        "only_type_i": True,
        "not_before": _jd_to_iso(not_before)[:10],
    }

    # Hohmann en el mismo modelo (v∞ de salida y de llegada), para comparar.
    hv_dep = float(hohmann["delta_v_departure_km_s"])
    hv_arr = float(hohmann["delta_v_arrival_km_s"])
    o, d = _low_orbit(origin), _low_orbit(destination)
    hoh = {
        "departure_date": window["departure_date"],
        "arrival_date": window["arrival_date"],
        "transfer_time_days": round(hoh_days, 1),
        "c3_km2_s2": round(hv_dep**2, 2),
        "v_inf_departure_km_s": round(hv_dep, 3),
        "v_inf_arrival_km_s": round(hv_arr, 3),
        "delta_v_heliocentric_km_s": round(hv_dep + hv_arr, 3),
        "injection": None if o is None else {
            "delta_v_km_s": round(_dv_leo_injection(hv_dep, o["mu"], o["r_km"]), 3),
            "parking_altitude_km": o["alt_km"]},
        "insertion": None if d is None else {
            "delta_v_km_s": round(_dv_leo_injection(hv_arr, d["mu"], d["r_km"]), 3),
            "orbit_altitude_km": d["alt_km"]},
    }
    hoh["delta_v_leo_to_low_orbit_km_s"] = (
        round(hoh["injection"]["delta_v_km_s"] + hoh["insertion"]["delta_v_km_s"], 3)
        if hoh["injection"] and hoh["insertion"] else None)

    assist = {lang: _ASSIST_NOTES[lang].get(destination) for lang in ("es", "en")}
    return {
        "origin": origin,
        "destination": destination,
        "optimum": best,
        "alternative_type_ii": alt_ii,
        "hohmann": hoh,
        "porkchop": pork,
        "window_center": window["departure_date"],
        # True si la salida elegida es "hoy" porque el mínimo teórico quedaría antes.
        "starts_today": bool(dep_jd <= _snap_day(not_before) + 0.5),
        "needs_gravity_assist": destination in ASSIST_BODIES,
        "assist_note": assist if destination in ASSIST_BODIES else None,
        "criterion": "min_c3_type_i",
        "method": (
            "Problema de Lambert (Izzo, hapsira) con posiciones reales de los planetas "
            "(efemérides integradas de astropy); mínimo C3 de salida entre las transferencias "
            "de tipo I (ángulo < 180°) en una cuadrícula de ±60 días y 0,6–1,4 veces el "
            "tiempo de vuelo de Hohmann. Transferencia directa, sin asistencias gravitatorias."
        ),
        "assumptions": {
            "leo_altitude_km": LEO_ALT_KM,
            "revolutions": 0,
            "frame": "eclíptico J2000 heliocéntrico",
        },
    }


def warm() -> None:
    """Compila numba (izzo) y calienta las efemérides; ~5 s la primera vez."""
    r = np.array([1.5e8, 0.0, 0.0])
    izzo_fast(MU_SUN, r, np.array([0.0, 2.2e8, 0.0]), 2.2e7, 0, True, True, 35, 1e-8)
    _body_state("earth", np.array([2461000.5]))
