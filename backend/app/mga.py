"""
mga.py — «Planifica tu viaje con catapultas»: buscador de trayectorias con
asistencias gravitatorias múltiples (MGA, «multiple gravity assist») en el modelo
de cónicas empalmadas («patched conics»).

Qué hace
  Para un destino (desde la Tierra) prueba las secuencias de sobrevuelos clásicas
  de la literatura —p. ej. a Saturno: EJS, EVEJS, EVVEJS (Cassini), EEJS, EVES y
  el directo ES— y busca, entre hoy y 25 años después, las fechas que menos
  energía cuestan. Devuelve las 3–5 mejores opciones distintas (secuencia + fecha),
  la más temprana que merece la pena, la próxima oportunidad con Júpiter (Saturno,
  Urano, Neptuno) y la comparación con el viaje directo (Hohmann y Lambert).

Modelo físico (mismo marco y utilidades que lambert.py)
  * Efemérides integradas de astropy (ERFA epv00/plan94, sin red): baja precisión,
    suficiente para un anteproyecto. Marco eclíptico J2000 heliocéntrico, km y km/s.
  * Cada tramo entre dos planetas es un problema de Lambert (Izzo, hapsira.iod.izzo,
    prógrado). Entre el mismo planeta (E→E, V→V, M→M) se prueban también soluciones
    de 1 vuelta completa (hasta 3 en Mercurio) y ÓRBITAS RESONANTES N:M: la nave da
    M vueltas mientras el planeta da N, y vuelve a encontrarlo (Galileo: Tierra–Tierra
    2:1, dos años). Lambert degenera en ese caso (salida y llegada casi en el mismo
    punto), así que se modela aparte: |v∞| se conserva, la energía de la órbita queda
    fijada por su periodo (N·P/M) y la dirección de v∞ sobre ese cono se elige para
    que los dos sobrevuelos cuesten lo mínimo. Se ignora el pequeño desfase de
    posición por la excentricidad del planeta.
  * Sobrevuelo SIN motor (forma estándar): se conserva |v∞| (|v∞,in| = |v∞,out|) y la
    gravedad del planeta solo GIRA el vector v∞ un ángulo δ dado por
        sin(δ/2) = 1 / (1 + r_p·v∞²/μ)
    (r_p: radio del periapsis; μ: GM del planeta). Ver p. ej. H. D. Curtis,
    «Orbital Mechanics for Engineering Students», cap. 8 (sobrevuelos planetarios).
    El giro máximo δ_max sale del r_p mínimo permitido (tabla RP_MIN_KM).
  * Sobrevuelo PROPULSADO (fórmula estándar del «powered swing-by»; M. Vasile y
    P. De Pascale, J. Spacecraft & Rockets 43(4), 2006; problemas GTOP de ESA): si los
    tramos exigen |v∞,in| ≠ |v∞,out|, un impulso tangente en el periapsis común de las
    dos hipérbolas, con el r_p que da el giro pedido:
        δ = asin(1/e_in) + asin(1/e_out),   e = 1 + r_p·v∞²/μ
        ΔV = | √(v∞,out² + 2μ/r_p) − √(v∞,in² + 2μ/r_p) |
    Si ni con r_p mínimo se logra el giro, se suma el coste de girar lo que falta con
    un impulso: 2·v∞,out·sin((δ − δ_max)/2) (aproximación conservadora).
    Si un sobrevuelo pide más de VIABLE_FLYBY_DV_KM_S (0,5 km/s), la opción NO es
    viable sin maniobras en espacio profundo (DSM), y se dice.
  * Coste = Δv de inyección desde una LEO de 185 km (como lambert.py) + ΔV de los
    sobrevuelos propulsados. La llegada va aparte: inserción en órbita circular baja
    en planetas rocosos y Δv MÍNIMO de captura (pasar a una órbita muy alargada con el
    periapsis en r_p mín) en los gigantes.
  * Orden: por coste, con dos matices visibles en la respuesta («criterion»):
      - en Mercurio el problema es FRENAR: allí el orden suma también la inserción;
      - a igual coste, se prefiere llegar más despacio (desempate: 10 % del Δv de llegada).

Búsqueda (acotada en CPU y memoria)
  1. Rejilla gruesa tramo a tramo con poda en haz (al estilo de GASP, de ESA): salida
     cada DEP_STEP días durante 25 años; cada tramo con TOF_SAMPLES tiempos de vuelo
     en un rango apoyado en misiones reales (TOF_RANGES). Tras cada tramo quedan las
     BEAM mejores ramas por cada intervalo de BIN_DAYS días de salida: así no se
     pierden las ventanas lejanas (Júpiter–Saturno se realinean cada ~20 años).
  2. Refinado local de los mejores candidatos con Nelder–Mead (scipy, que ya es
     dependencia de hapsira) sobre la fecha de salida y los tiempos de vuelo, con
     efemérides interpoladas (Hermite cúbico con posición y velocidad diarias).

Limitaciones (también en «assumptions»): sin maniobras en espacio profundo (las
misiones reales sí las usan: Cassini 450 m/s el 3-dic-1998), sin perturbaciones, sin
límites de declinación de lanzamiento, iluminación o comunicaciones; efemérides de
baja precisión; tope de 25 años. Es una propuesta de anteproyecto, no un plan de misión.
"""

from __future__ import annotations

import itertools
import math
import threading
import time
from datetime import datetime
from typing import Optional

import numpy as np
from astropy import units as u
from astropy.time import Time
from hapsira.iod.izzo import izzo_fast           # mismo resolvedor de Lambert que lambert.py
from hapsira.core.iod import _compute_T_min as _izzo_t_min   # interna de hapsira 0.18.0 (versión fijada)
from numba import njit

from app import lambert, orbital

ALGO_VERSION = 5

MU_SUN = lambert.MU_SUN
AU_KM = 149597870.7
DAY_S = 86400.0
LEO_R_KM = lambert.R_EARTH_KM + lambert.LEO_ALT_KM

HORIZON_YEARS = 25
VIABLE_FLYBY_DV_KM_S = 0.5          # por encima: no viable sin maniobras en espacio profundo
TIEBREAK_ARRIVAL = 0.10             # desempate: fracción del Δv de llegada que se suma al coste
VBIN_KM_S = 2.0                     # anchura de las celdas de |v∞| del haz

# ─── Cuerpos ───────────────────────────────────────────────────────────────

LETTER = {"mercury": "M", "venus": "V", "earth": "E", "mars": "Ma",
          "jupiter": "J", "saturn": "S", "uranus": "U", "neptune": "N"}

# Periodos siderales (días; NASA/NSSDC Planetary Fact Sheet) para las resonancias.
SIDEREAL_DAYS = {"mercury": 87.969, "venus": 224.701, "earth": 365.256}
# Semieje (UA) admisible de la órbita resonante de la nave en cada planeta.
_RES_A_RANGE = {"mercury": (0.30, 0.80), "venus": (0.45, 1.60), "earth": (0.60, 2.40)}


def body_consts(body: str) -> tuple[float, float]:
    """(μ km³/s², radio ecuatorial km) de hapsira.bodies; la Tierra como lambert.py."""
    if body == "earth":
        return lambert.MU_EARTH, lambert.R_EARTH_KM
    b = orbital.BODIES[body]
    return float(b.k.to_value(u.km**3 / u.s**2)), float(b.R.to_value(u.km))


def _rp_min_table() -> dict:
    """Radio de periapsis mínimo (km, desde el centro) para un sobrevuelo seguro.
      Venus y Tierra: radio + 300 km (atmósfera).  Mercurio y Marte: radio + 200 km.
      Júpiter: 4 radios (cinturones de radiación; Voyager 2 pasó a ~9 R_J).
      Saturno: 150 000 km, por fuera del anillo F (139 826 km; NASA/NSSDC, Saturnian
      Rings Fact Sheet). Voyager 2 pasó a ~161 000 km del centro.
      Urano: 60 000 km, por fuera del anillo ε (51 149 km; NSSDC, Uranian Rings).
      Neptuno: 70 000 km, por fuera del anillo Adams (62 933 km; NSSDC, Neptunian Rings)."""
    out = {}
    for b in LETTER:
        _, r = body_consts(b)
        out[b] = {"mercury": r + 200, "venus": r + 300, "earth": r + 300, "mars": r + 200,
                  "jupiter": 4 * r, "saturn": 150000.0, "uranus": 60000.0, "neptune": 70000.0}[b]
    return out


RP_MIN_KM = _rp_min_table()

# ─── Secuencias candidatas por destino ─────────────────────────────────────


def seq_of(code: str) -> tuple:
    """'EVVEJS' → ('earth', 'venus', …). M = Mercurio (convención de MESSENGER)."""
    rev = {"M": "mercury", "V": "venus", "E": "earth", "J": "jupiter",
           "S": "saturn", "U": "uranus", "N": "neptune"}
    return tuple(rev[c] for c in code)


def code_of(seq) -> str:
    return "".join(LETTER[b] for b in seq)


# (secuencia, misión de referencia o None). Decide el cálculo, no el orden.
SEQUENCES = {
    "saturn": [(seq_of("EJS"), None), (seq_of("EVEJS"), None), (seq_of("EVVEJS"), "cassini"),
               (seq_of("EEJS"), None), (seq_of("EVES"), None), (seq_of("ES"), None)],
    "jupiter": [(seq_of("EJ"), None), (seq_of("EVEEJ"), "galileo"), (seq_of("EEJ"), "juno")],
    "uranus": [(seq_of("EU"), None), (seq_of("EJU"), None), (seq_of("EJSU"), "voyager2"),
               (seq_of("EVEJU"), None)],
    "neptune": [(seq_of("EN"), None), (seq_of("EJN"), None), (seq_of("EJSN"), None),
                (seq_of("EVEJN"), None), (seq_of("EJSUN"), "voyager2")],
    "mercury": [(seq_of("EM"), None), (seq_of("EVM"), None), (seq_of("EVVM"), None),
                (seq_of("EVVMM"), "messenger")],
    "mars": [(("earth", "mars"), None)],
    "venus": [(seq_of("EV"), None)],
}
DESTINATIONS = tuple(SEQUENCES)
DIRECT_ONLY = {"mars", "venus"}          # las catapultas no ayudan: solo directo (y se explica)
JUPITER_CYCLE_DESTS = ("saturn", "uranus", "neptune")

# Tiempos de vuelo por tramo (días), apoyados en misiones reales:
#   Cassini  E→V 193, V→V 424, V→E 55, E→J 500, J→S 1279 (fechas en tests/test_mga.py)
#   Galileo  E→V 115, V→E 301, E→E 731, E→J 1094
#   Voyager 2 E→J 688, J→S 779, S→U 1612, U→N 1309
#   MESSENGER V→V 224, V→M 223, M→M 266 y 358 (con maniobras)
TOF_RANGES = {
    ("earth", "venus"): (70, 450), ("venus", "venus"): (150, 700), ("venus", "earth"): (30, 700),
    ("earth", "earth"): (250, 1100), ("venus", "mercury"): (50, 320), ("mercury", "mercury"): (80, 450),
    ("earth", "jupiter"): (350, 1300), ("jupiter", "saturn"): (600, 2600), ("earth", "saturn"): (900, 3300),
    ("jupiter", "uranus"): (1000, 4500), ("saturn", "uranus"): (900, 2600), ("jupiter", "neptune"): (1500, 5500),
    ("saturn", "neptune"): (1500, 4500), ("uranus", "neptune"): (900, 3000),
}
# Viajes directos (un solo tramo): alrededor del tiempo de Hohmann.
DIRECT_TOF = {
    "mercury": (70, 250), "venus": (80, 250), "mars": (120, 450), "jupiter": (400, 1400),
    "saturn": (1000, 3600), "uranus": (3000, 7300), "neptune": (5500, 13000),
}
C3_CAP = {"mercury": 80.0, "venus": 40.0, "mars": 45.0, "jupiter": 115.0,
          "saturn": 155.0, "uranus": 185.0, "neptune": 195.0}


def tof_range(seq: tuple, k: int) -> tuple[int, int]:
    if len(seq) == 2:
        return DIRECT_TOF[seq[1]]
    return TOF_RANGES[(seq[k], seq[k + 1])]


def resonances(body: str, lo: float, hi: float) -> list:
    """Resonancias N:M (planeta : nave) cuya duración N·P cabe en [lo, hi] días y
    cuyo semieje queda en el rango admisible."""
    if body not in SIDEREAL_DAYS:
        return []
    P = SIDEREAL_DAYS[body]
    a_lo, a_hi = _RES_A_RANGE[body]
    out = []
    for N in range(1, 8):
        if not (lo <= N * P <= hi):
            continue
        for M in range(1, 9):
            a = (MU_SUN * (N * P / M * DAY_S / (2 * math.pi)) ** 2) ** (1 / 3) / AU_KM
            if a_lo <= a <= a_hi:
                out.append(("res", N, M))
    return out


def branches_for(seq: tuple, k: int) -> list:
    """Ramas del tramo k: (revoluciones, lowpath) de Lambert y, entre el mismo
    planeta y fuera del lanzamiento, resonancias ("res", N, M)."""
    a, b = seq[k], seq[k + 1]
    if a == b == "mercury":
        lam = [(0, True), (1, True), (1, False), (2, True), (2, False), (3, True), (3, False)]
    elif a == b or (a, b) == ("venus", "mercury"):
        lam = [(0, True), (1, True), (1, False)]
    else:
        lam = [(0, True)]
    if a == b and k >= 1:
        lam = lam + resonances(a, *tof_range(seq, k))
    return lam


def is_res(br) -> bool:
    return br[0] == "res"


class SearchConfig:
    """Parámetros de la búsqueda. Los de serie: ~10–60 s por destino en un núcleo.
    Las pruebas usan uno reducido."""

    def __init__(self, dep_step=8, tof_samples=22, beam=5, bin_days=60, refine_per_seq=10,
                 refine_maxfev=180, fb_cap_grid=3.0, phi_grid=12, years=HORIZON_YEARS,
                 passes=((0.0, 0), (0.5, 5), (0.25, -4)), quick_per_seq=40, quick_maxfev=40):
        self.dep_step = int(dep_step)
        self.tof_samples = int(tof_samples)
        self.beam = int(beam)
        self.bin_days = int(bin_days)
        self.refine_per_seq = int(refine_per_seq)
        self.refine_maxfev = int(refine_maxfev)
        self.fb_cap_grid = float(fb_cap_grid)
        self.phi_grid = int(phi_grid)
        self.years = float(years)
        # Pasadas de la rejilla: (desfase de la salida en fracciones de dep_step, muestras
        # de TOF de más o de menos). La poda en haz es heurística: varias rejillas
        # desplazadas encuentran ventanas que una sola pierde.
        self.passes = tuple((float(a), int(b)) for a, b in passes)
        self.quick_per_seq = int(quick_per_seq)
        self.quick_maxfev = int(quick_maxfev)

    def as_dict(self) -> dict:
        d = dict(self.__dict__)
        d["passes"] = [list(x) for x in self.passes]
        return d


DEFAULT_CONFIG = SearchConfig()

# ─── Núcleo numérico (numba) ───────────────────────────────────────────────


@njit(nogil=True, cache=False)
def _izzo_feasible(k, r1, r2, tof, M):
    """¿Tiene solución el Lambert de Izzo (prógrado) con M vueltas? Repite las
    comprobaciones previas de hapsira.core.iod.izzo/_find_xy para no provocar sus
    excepciones: capturar excepciones dentro de numba deja memoria sin liberar
    (~230 B cada una), y con varias vueltas la mayoría de casos no tienen solución."""
    if not (tof > 0.0):
        return False
    cx = r1[1] * r2[2] - r1[2] * r2[1]
    cy = r1[2] * r2[0] - r1[0] * r2[2]
    cz = r1[0] * r2[1] - r1[1] * r2[0]
    if cx == 0.0 and cy == 0.0 and cz == 0.0:
        return False                                   # vectores colineales
    r1n = math.sqrt(r1[0] ** 2 + r1[1] ** 2 + r1[2] ** 2)
    r2n = math.sqrt(r2[0] ** 2 + r2[1] ** 2 + r2[2] ** 2)
    c = math.sqrt((r2[0] - r1[0]) ** 2 + (r2[1] - r1[1]) ** 2 + (r2[2] - r1[2]) ** 2)
    s = 0.5 * (r1n + r2n + c)
    ll = math.sqrt(1.0 - min(1.0, c / s))
    if cz < 0.0:                                       # i_h[2] < 0 (mismo signo que cz)
        ll = -ll
    if not (abs(ll) < 1.0):
        return False
    T = math.sqrt(2.0 * k / s**3) * tof
    if M == 0:
        return T > 0.0
    m_max = math.floor(T / math.pi)
    if M > m_max:
        return False
    if M == m_max:
        t00 = math.acos(ll) + ll * math.sqrt(1.0 - ll * ll)
        if T < t00 + m_max * math.pi:
            try:
                _, t_min = _izzo_t_min(ll, m_max, 35, 1e-8)
            except Exception:
                return False
            if T < t_min:
                return False
    return True


@njit(nogil=True, cache=False)
def _lambert_rows(k, r1, r2, tof, mrev, low):
    """Lambert (Izzo, hapsira) fila a fila: r1, r2 (N,3) km, tof (N) s, mrev (N)
    revoluciones, low (N) rama. Devuelve v1, v2 (N,3) km/s; NaN si no hay solución."""
    n = tof.shape[0]
    v1 = np.full((n, 3), np.nan)
    v2 = np.full((n, 3), np.nan)
    for i in range(n):
        if not _izzo_feasible(k, r1[i], r2[i], tof[i], mrev[i]):
            continue
        try:
            a, b = izzo_fast(k, r1[i], r2[i], tof[i], mrev[i], True, low[i], 35, 1e-8)
        except Exception:
            continue
        for j in range(3):
            v1[i, j] = a[j]
            v2[i, j] = b[j]
    return v1, v2


@njit(nogil=True, cache=False)
def _turn(ai, ao, r):
    return math.asin(ai / (ai + r)) + math.asin(ao / (ao + r))


@njit(nogil=True, cache=False)
def _dturn_dq(ai, ao, r):
    # d/d(ln r) de asin(a/(a+r)) = −a·r / ((a+r)·√((a+r)² − a²))
    s = 0.0
    for a in (ai, ao):
        ar = a + r
        s -= a * r / (ar * math.sqrt(ar * ar - a * a))
    return s


@njit(nogil=True, cache=False)
def _flyby_rows(vin, vout, mu, rpmin):
    """Sobrevuelo propulsado fila a fila (ver cabecera del módulo).
    vin, vout: v∞ de llegada y de salida (N,3) km/s, relativos al planeta.
    Devuelve (ΔV km/s, r_p km, δ pedido rad, δ_max rad con r_p mín)."""
    n = vin.shape[0]
    dv = np.full(n, np.nan)
    rp = np.full(n, np.nan)
    dl = np.full(n, np.nan)
    dm = np.full(n, np.nan)
    qmin = math.log(rpmin)
    qmax = math.log(rpmin * 1e6)
    for i in range(n):
        vi = math.sqrt(vin[i, 0] ** 2 + vin[i, 1] ** 2 + vin[i, 2] ** 2)
        vo = math.sqrt(vout[i, 0] ** 2 + vout[i, 1] ** 2 + vout[i, 2] ** 2)
        if not (vi > 1e-6 and vo > 1e-6):       # también descarta NaN
            continue
        c = (vin[i, 0] * vout[i, 0] + vin[i, 1] * vout[i, 1] + vin[i, 2] * vout[i, 2]) / (vi * vo)
        c = min(1.0, max(-1.0, c))
        d = math.acos(c)
        ai = mu / (vi * vi)          # 1/(1 + r·v²/μ) = a/(a + r), con a = μ/v²
        ao = mu / (vo * vo)
        dmax = _turn(ai, ao, rpmin)
        extra = 0.0
        if d >= dmax:
            r = rpmin
            extra = d - dmax
        elif _turn(ai, ao, math.exp(qmax)) >= d:
            r = math.exp(qmax)                   # giro despreciable: pasa «lejísimos»
        else:
            # Newton en q = ln r con horquilla (la función es monótona decreciente)
            lo, hi = qmin, qmax
            q = math.log(min(max((ai + ao) / max(d, 1e-12), rpmin), rpmin * 1e6))
            for _ in range(40):
                g = _turn(ai, ao, math.exp(q)) - d
                if abs(g) < 1e-11:
                    break
                if g > 0:
                    lo = q
                else:
                    hi = q
                qn = q - g / _dturn_dq(ai, ao, math.exp(q))
                if not (lo < qn < hi):
                    qn = 0.5 * (lo + hi)
                q = qn
            r = math.exp(q)
        vpi = math.sqrt(vi * vi + 2.0 * mu / r)
        vpo = math.sqrt(vo * vo + 2.0 * mu / r)
        cost = abs(vpo - vpi)
        if extra > 0.0:
            cost += 2.0 * vo * math.sin(0.5 * extra)
        dv[i] = cost
        rp[i] = r
        dl[i] = d
        dm[i] = dmax
    return dv, rp, dl, dm


@njit(nogil=True, cache=False)
def _hermite(P, V, jd0, jd):
    """Hermite cúbico en una tabla diaria (posición km, velocidad km/s) que empieza
    en la fecha juliana jd0. Devuelve (r, v) (N,3)."""
    n = jd.shape[0]
    m = P.shape[0]
    r = np.empty((n, 3))
    v = np.empty((n, 3))
    h = DAY_S
    for i in range(n):
        x = jd[i] - jd0
        k = int(math.floor(x))
        if k < 0:
            k = 0
        if k > m - 2:
            k = m - 2
        s = x - k
        s2 = s * s
        s3 = s2 * s
        h00 = 2 * s3 - 3 * s2 + 1
        h10 = s3 - 2 * s2 + s
        h01 = -2 * s3 + 3 * s2
        h11 = s3 - s2
        d00 = 6 * s2 - 6 * s
        d10 = 3 * s2 - 4 * s + 1
        d01 = -6 * s2 + 6 * s
        d11 = 3 * s2 - 2 * s
        for j in range(3):
            r[i, j] = h00 * P[k, j] + h10 * h * V[k, j] + h01 * P[k + 1, j] + h11 * h * V[k + 1, j]
            v[i, j] = (d00 * P[k, j] + d01 * P[k + 1, j]) / h + d10 * V[k, j] + d11 * V[k + 1, j]
    return r, v


def _dv_leo(vinf):
    """Inyección desde LEO de 185 km (vectorizado): √(v∞² + v_esc²) − v_circ (lambert.py)."""
    mu = lambert.MU_EARTH
    return np.sqrt(np.asarray(vinf, dtype=float) ** 2 + 2 * mu / LEO_R_KM) - math.sqrt(mu / LEO_R_KM)


def arrival_dv(body: str, vinf):
    """Δv de llegada (vectorizado). Rocosos: inserción en órbita circular baja (altitudes
    de lambert.LOW_ORBIT_ALT_KM). Gigantes: Δv MÍNIMO de captura, a una órbita muy
    alargada (casi parabólica) con el periapsis en r_p mín."""
    vinf = np.asarray(vinf, dtype=float)
    lo = lambert._low_orbit(body)
    if lo is not None:
        return np.sqrt(vinf**2 + 2 * lo["mu"] / lo["r_km"]) - math.sqrt(lo["mu"] / lo["r_km"])
    mu, _ = body_consts(body)
    rp = RP_MIN_KM[body]
    return np.sqrt(vinf**2 + 2 * mu / rp) - math.sqrt(2 * mu / rp)


def score_of(dest: str, cost, arr):
    """Criterio de orden: coste (+ inserción en Mercurio; + desempate por la llegada)."""
    if dest == "mercury":
        return cost + arr
    return cost + TIEBREAK_ARRIVAL * arr


# ─── Órbitas resonantes ────────────────────────────────────────────────────


def _cone(r, Vp, vmag, body, N, M):
    """Cono de v∞ de una órbita resonante N:M (vectorizado en filas).
    r, Vp: (R,3) posición y velocidad del planeta; vmag (R) |v∞|. Devuelve
    (c, s, e1, e2, e3, ok): v∞(φ) = c·e1 + s·(cos φ·e2 + sin φ·e3)."""
    P = SIDEREAL_DAYS[body] * N / M * DAY_S
    a = (MU_SUN * (P / (2 * math.pi)) ** 2) ** (1 / 3)
    rn = np.linalg.norm(r, axis=1)
    Vn = np.linalg.norm(Vp, axis=1)
    s2 = MU_SUN * (2 / rn - 1 / a)                       # |v_nave|² en ese punto
    c = (s2 - vmag**2 - Vn**2) / (2 * Vn)
    ok = (s2 > 0) & (np.abs(c) < vmag)
    s = np.sqrt(np.clip(vmag**2 - c**2, 0, None))
    e1 = Vp / Vn[:, None]
    e3 = np.cross(r, e1)
    e3 /= np.linalg.norm(e3, axis=1)[:, None]
    e2 = np.cross(e3, e1)
    return c, s, e1, e2, e3, ok


def _cone_vec(c, s, e1, e2, e3, phi):
    """Vectores v∞ del cono para φ (R filas × F ángulos) → (R, F, 3)."""
    cp, sp = np.cos(phi)[None, :, None], np.sin(phi)[None, :, None]
    return c[:, None, None] * e1[:, None, :] + s[:, None, None] * (cp * e2[:, None, :] + sp * e3[:, None, :])


def _best_phi(cost_fn, F: int, refine: bool):
    """Minimiza cost_fn(φ) (vectorizada en φ, devuelve (R, F)) por muestreo y,
    si `refine`, sección áurea alrededor de la mejor muestra. Devuelve (φ*, coste*)."""
    phi = np.linspace(0, 2 * np.pi, F, endpoint=False)
    vals = cost_fn(phi)                                       # (R, F)
    j = np.nanargmin(np.where(np.isfinite(vals), vals, np.inf), axis=1)
    best_phi = phi[j]
    best = vals[np.arange(len(j)), j]
    if refine:
        h = 2 * np.pi / F
        a, b = best_phi - h, best_phi + h
        g = (math.sqrt(5) - 1) / 2
        for _ in range(28):
            c1, c2 = b - g * (b - a), a + g * (b - a)
            f1 = np.array([cost_fn(np.array([x]))[i, 0] for i, x in enumerate(c1)])
            f2 = np.array([cost_fn(np.array([x]))[i, 0] for i, x in enumerate(c2)])
            left = f1 < f2
            b = np.where(left, c2, b)
            a = np.where(left, a, c1)
        cand = 0.5 * (a + b)
        fc = np.array([cost_fn(np.array([x]))[i, 0] for i, x in enumerate(cand)])
        better = fc < best
        best_phi = np.where(better, cand, best_phi)
        best = np.where(better, fc, best)
    return best_phi, best


# ─── Efemérides tabuladas ──────────────────────────────────────────────────

_TABLES: dict = {}
_TABLES_LOCK = threading.Lock()


def _table(body: str, jd0: float, ndays: int):
    """Tabla diaria de (posición, velocidad) del planeta desde jd0 con al menos
    `ndays` días. Se reutiliza si la ya calculada la cubre (≈1,2 MB por planeta)."""
    with _TABLES_LOCK:
        t = _TABLES.get(body)
        if t is not None and t[0] <= jd0 and t[0] + len(t[1]) >= jd0 + ndays and float(jd0 - t[0]).is_integer():
            return t
        p, v = lambert._body_state(body, jd0 + np.arange(ndays, dtype=float))
        t = (float(jd0), np.ascontiguousarray(p), np.ascontiguousarray(v))
        _TABLES[body] = t
        return t


def state_at(body: str, jd) -> tuple[np.ndarray, np.ndarray]:
    """Estado (r, v) en fechas julianas TDB: Hermite sobre la tabla si la hay;
    si no, astropy directamente (exacto, más lento)."""
    jd = np.atleast_1d(np.asarray(jd, dtype=float))
    t = _TABLES.get(body)
    if t is not None and t[0] <= jd.min() and jd.max() < t[0] + len(t[1]) - 1:
        return _hermite(t[1], t[2], t[0], jd)
    return lambert._body_state(body, jd)


# ─── Una trayectoria completa ──────────────────────────────────────────────


def _trajectory(seq, jds, R, V, branches, phi_samples=36, refine_phi=True, detail=False):
    """Coste de la trayectoria por `seq` con fechas `jds` (TDB), estados R, V de cada
    cuerpo en su fecha y ramas por tramo. Devuelve el score (float) o, con
    `detail`, el diccionario completo. NaN/None si no hay solución."""
    n = len(seq) - 1
    v1 = [None] * n
    v2 = [None] * n
    for k in range(n):
        br = branches[k]
        if is_res(br):
            if k == 0:
                return None if detail else math.nan
            continue
        a, b = _lambert_rows(MU_SUN, R[k][None, :], R[k + 1][None, :],
                             np.array([(jds[k + 1] - jds[k]) * DAY_S]),
                             np.array([br[0]], dtype=np.int64), np.array([br[1]]))
        if not np.isfinite(a[0, 0]):
            return None if detail else math.nan
        v1[k], v2[k] = a[0], b[0]

    flybys = []
    cost_fb = 0.0
    k = 1
    while k <= n - 1:
        body = seq[k]
        mu, rad = body_consts(body)
        rpm = RP_MIN_KM[body]
        vin = v2[k - 1] - V[k]
        br = branches[k]
        if is_res(br):
            N, M = br[1], br[2]
            c, s, e1, e2, e3, ok = _cone(R[k][None, :], V[k][None, :], np.array([np.linalg.norm(vin)]), body, N, M)
            if not ok[0]:
                return None if detail else math.nan
            dV = V[k] - V[k + 1]
            nxt = k + 1 <= n - 1
            if nxt:
                vout2 = v1[k + 1] - V[k + 1]
                mu2 = body_consts(seq[k + 1])[0]

            def fphi(phi, c=c, s=s, e1=e1, e2=e2, e3=e3):
                w = _cone_vec(c, s, e1, e2, e3, phi)[0]           # (F,3)
                d1 = _flyby_rows(np.repeat(vin[None, :], len(phi), 0), w, mu, rpm)[0]
                if not nxt:
                    return d1[None, :]
                d2 = _flyby_rows(w + dV, np.repeat(vout2[None, :], len(phi), 0), mu2, RP_MIN_KM[seq[k + 1]])[0]
                return (d1 + d2)[None, :]

            phi, _ = _best_phi(fphi, phi_samples, refine_phi)
            w = _cone_vec(c, s, e1, e2, e3, phi)[0][0]
            v1[k] = V[k] + w
            v2[k] = V[k] + w                     # tras M vueltas vuelve con la misma velocidad
            vout = w
        else:
            vout = v1[k] - V[k]
        dv, rp, dl, dm = _flyby_rows(vin[None, :], vout[None, :], mu, rpm)
        if not np.isfinite(dv[0]):
            return None if detail else math.nan
        cost_fb += float(dv[0])
        if detail:
            hin, hout = v2[k - 1], v1[k]
            flybys.append({
                "body": body, "jd": float(jds[k]),
                "v_inf_in": float(np.linalg.norm(vin)), "v_inf_out": float(np.linalg.norm(vout)),
                "turn_deg": float(np.degrees(dl[0])), "turn_max_deg": float(np.degrees(dm[0])),
                "rp_km": float(rp[0]), "altitude_km": float(rp[0] - rad), "dv": float(dv[0]),
                "turn_limited": bool(dl[0] > dm[0] + 1e-12), "rp_min_km": float(rpm),
                # Ganancia de rapidez respecto al Sol: |v_helio,out| − |v_helio,in|
                "helio_gain": float(np.linalg.norm(hout) - np.linalg.norm(hin)),
                "helio_turn_deg": float(np.degrees(math.acos(float(np.clip(
                    np.dot(hout, hin) / (np.linalg.norm(hout) * np.linalg.norm(hin)), -1, 1))))),
            })
        k += 1

    vinf_dep = v1[0] - V[0]
    c3 = float(np.dot(vinf_dep, vinf_dep))
    inj = float(_dv_leo(math.sqrt(c3)))
    vinf_arr = float(np.linalg.norm(v2[-1] - V[-1]))
    arr = float(arrival_dv(seq[-1], vinf_arr))
    cost = inj + cost_fb
    sc = float(score_of(seq[-1], cost, arr))
    if not detail:
        return sc
    out = {
        "seq": tuple(seq), "jds": [float(x) for x in jds], "branches": [tuple(b) for b in branches],
        "c3": c3, "v_inf_dep": math.sqrt(c3), "injection_dv": inj,
        "dla_deg": lambert._dla_deg(vinf_dep), "flybys": flybys,
        "powered_dv": cost_fb, "max_flyby_dv": max([f["dv"] for f in flybys], default=0.0),
        "cost": cost, "v_inf_arr": vinf_arr, "arrival_dv": arr, "score": sc,
        "duration_days": float(jds[-1] - jds[0]),
        "_v1": v1, "_R": R,
    }
    out["viable"] = out["max_flyby_dv"] <= VIABLE_FLYBY_DV_KM_S
    return out


def _states(seq, jds, exact):
    R, V = [], []
    for i, b in enumerate(seq):
        r, v = lambert._body_state(b, jds[i:i + 1]) if exact else state_at(b, jds[i:i + 1])
        R.append(r[0])
        V.append(v[0])
    return R, V


def evaluate(seq, jds, branches=None, exact: bool = False, paths: bool = False) -> Optional[dict]:
    """Evalúa la trayectoria por `seq` en las fechas julianas TDB `jds` (una por
    cuerpo). Sin `branches`, prueba todas las ramas de Lambert y, en tramos entre el
    mismo planeta cuya duración está a < 3 días de N periodos, las resonancias; y se
    queda con la combinación de menor score. `exact=True`: estados de astropy
    directamente (para validar contra misiones reales)."""
    seq = tuple(seq)
    jds = np.asarray(jds, dtype=float)
    n = len(seq) - 1
    R, V = _states(seq, jds, exact)
    if branches is None:
        opts = []
        for k in range(n):
            o = [b for b in branches_for(seq, k) if not is_res(b)]
            if seq[k] == seq[k + 1] and k >= 1 and seq[k] in SIDEREAL_DAYS:
                tof = jds[k + 1] - jds[k]
                o += [b for b in resonances(seq[k], tof - 3, tof + 3)]
            opts.append(o)
        best = None
        for combo in itertools.product(*opts):
            sc = _trajectory(seq, jds, R, V, list(combo), detail=False)
            if np.isfinite(sc) and (best is None or sc < best[0]):
                best = (sc, list(combo))
        if best is None:
            return None
        branches = best[1]
    det = _trajectory(seq, jds, R, V, list(branches), detail=True)
    if det is None:
        return None
    if paths:
        det["paths"] = []
        for k in range(n):
            br = branches[k]
            revs = br[2] if is_res(br) else br[0]
            det["paths"].append(_leg_path_au(R[k], det["_v1"][k], (jds[k + 1] - jds[k]) * DAY_S, 56 + 24 * revs))
        det["positions"] = [[round(float(R[k][0]) / AU_KM, 4), round(float(R[k][1]) / AU_KM, 4)] for k in range(n + 1)]
    det.pop("_v1", None)
    det.pop("_R", None)
    return det


def _stumpff(z):
    if z > 1e-8:
        sz = math.sqrt(z)
        return (1 - math.cos(sz)) / z, (sz - math.sin(sz)) / sz**3
    if z < -1e-8:
        sz = math.sqrt(-z)
        return (math.cosh(sz) - 1) / -z, (math.sinh(sz) - sz) / sz**3
    return 0.5, 1.0 / 6.0


def _leg_path_au(r1, v1, tof_s, n=36):
    """Puntos [x, y] (UA, eclíptica) del arco, propagado con variables universales
    (funciones f y g) desde (r1, v1) durante tof_s. Solo para dibujar el tramo."""
    r0 = np.asarray(r1, float)
    v0 = np.asarray(v1, float)
    mu = MU_SUN
    sq = math.sqrt(mu)
    r0n = float(np.linalg.norm(r0))
    vr0 = float(np.dot(r0, v0)) / r0n
    alpha = 2.0 / r0n - float(np.dot(v0, v0)) / mu
    pts = [[round(r0[0] / AU_KM, 3), round(r0[1] / AU_KM, 3)]]   # 0,001 UA: de sobra para dibujar
    chi = 0.0
    for i in range(1, n + 1):
        t = tof_s * i / n
        if chi == 0.0:
            chi = sq * abs(alpha) * t
        for _ in range(80):
            z = alpha * chi * chi
            c, s = _stumpff(z)
            rr = chi * chi * c + r0n * vr0 / sq * chi * (1 - z * s) + r0n * (1 - z * c)
            f = r0n * vr0 / sq * chi * chi * c + (1 - alpha * r0n) * chi**3 * s + r0n * chi - sq * t
            step = f / rr
            chi -= step
            if abs(step) < 1e-10 * max(1.0, abs(chi)):
                break
        z = alpha * chi * chi
        c, s = _stumpff(z)
        f = 1 - chi * chi / r0n * c
        g = t - chi**3 * s / sq
        r = f * r0 + g * v0
        pts.append([round(r[0] / AU_KM, 3), round(r[1] / AU_KM, 3)])
    return pts


# ─── Búsqueda en rejilla con poda en haz ───────────────────────────────────


def _select(dep, score, beam, bin_days, vmag=None, vbin=VBIN_KM_S):
    """Índices de las `beam` filas de menor score en cada celda de la rejilla
    (intervalo de `bin_days` días de salida × intervalo de `vbin` km/s de |v∞| en
    el planeta actual, si se da `vmag`). La celda por |v∞| evita que el haz se quede
    solo con las ramas de poca energía cuando un sobrevuelo posterior necesita llegar
    rápido (p. ej. EVES o EEJS)."""
    if len(score) == 0:
        return np.zeros(0, dtype=np.int64)
    bins = (dep // bin_days).astype(np.int64)
    if vmag is not None:
        vb = np.clip(np.nan_to_num(vmag, nan=0.0) // vbin, 0, 63).astype(np.int64)
        bins = bins * 64 + vb
    order = np.lexsort((score, bins))
    b = bins[order]
    start = np.r_[0, np.flatnonzero(np.diff(b)) + 1]
    rank = np.arange(len(b)) - np.repeat(start, np.diff(np.r_[start, len(b)]))
    keep = order[rank < beam]
    return keep[np.isfinite(score[keep])]


def _take(nodes: dict, idx) -> dict:
    return {k: v[idx] for k, v in nodes.items()}


def _cat(parts: list) -> dict:
    return {k: np.concatenate([p[k] for p in parts]) for k in parts[0]}


def _grid_search(seq: tuple, base_jd: float, span_days: int, cfg: SearchConfig, stats: dict,
                 dep_offset: int = 0, tof_samples: Optional[int] = None) -> list:
    """Rejilla gruesa tramo a tramo con poda en haz. Devuelve candidatos
    [{"seq", "x": [jd_salida, tof1…], "branches", "score"}] ordenados por score."""
    n_tof = int(tof_samples or cfg.tof_samples)
    dest = seq[-1]
    n = len(seq) - 1
    need = span_days + sum(tof_range(seq, k)[1] for k in range(n)) + 8
    tabs = {b: _table(b, base_jd, need) for b in set(seq)}
    off = {b: int(round(base_jd - tabs[b][0])) for b in tabs}
    P = {b: tabs[b][1] for b in tabs}
    Vt = {b: tabs[b][2] for b in tabs}
    phi = np.linspace(0, 2 * np.pi, cfg.phi_grid, endpoint=False)
    br_lists = [branches_for(seq, k) for k in range(n)]

    def tgrid(k):
        lo, hi = tof_range(seq, k)
        return np.unique(np.linspace(lo, hi, n_tof).round().astype(np.int64))

    # ── Tramo 1: salida × tiempo de vuelo
    dep = np.arange(int(dep_offset), span_days + 1, cfg.dep_step, dtype=np.int64)
    T = tgrid(0)
    d = np.repeat(dep, len(T))
    t = np.tile(T, len(dep))
    a = d + t
    parts = []
    for bi, (m, low) in enumerate(br_lists[0]):
        v1, v2 = _lambert_rows(MU_SUN, P[seq[0]][d + off[seq[0]]], P[seq[1]][a + off[seq[1]]], t * DAY_S,
                               np.full(len(t), m, dtype=np.int64), np.full(len(t), low))
        stats["lambert"] += len(t)
        vdep = v1 - Vt[seq[0]][d + off[seq[0]]]
        c3 = np.einsum("ij,ij->i", vdep, vdep)
        ok = np.isfinite(c3) & (c3 <= C3_CAP[dest])
        no = int(ok.sum())
        parts.append({
            "dep": d[ok], "cur": a[ok], "tofs": t[ok][:, None].astype(float), "brs": np.full((no, 1), bi),
            "cost": _dv_leo(np.sqrt(c3[ok])), "vin": v2[ok] - Vt[seq[1]][a[ok] + off[seq[1]]],
            "pend": np.zeros(no, bool), "pc": np.zeros(no), "ps": np.zeros(no),
            "pe": np.zeros((no, 3, 3)), "pvin": np.zeros((no, 3)), "pdV": np.zeros((no, 3)), "plb": np.zeros(no),
        })
    nodes = _cat(parts)
    if n == 1:
        arr = arrival_dv(dest, np.linalg.norm(nodes["vin"], axis=1))
        sc = score_of(dest, nodes["cost"], arr)
        keep = _select(nodes["dep"], sc, 3, cfg.bin_days)
        return _pack(seq, base_jd, _take(nodes, keep), br_lists, sc[keep])
    keep = _select(nodes["dep"], nodes["cost"], cfg.beam, cfg.bin_days, np.linalg.norm(nodes["vin"], axis=1))
    nodes = _take(nodes, keep)

    # ── Tramos siguientes
    for k in range(1, n):
        A, B = seq[k], seq[k + 1]
        last = k == n - 1
        mu, _ = body_consts(A)
        rpm = RP_MIN_KM[A]
        T = tgrid(k)
        lam = [(bi, br) for bi, br in enumerate(br_lists[k]) if not is_res(br)]
        res = [(bi, br) for bi, br in enumerate(br_lists[k]) if is_res(br)]
        # Pendientes (tramo anterior resonante): coste del 1.er sobrevuelo por φ (no depende del tramo nuevo)
        pend = nodes["pend"]
        if pend.any():
            pi = np.flatnonzero(pend)
            w = _cone_vec(nodes["pc"][pi], nodes["ps"][pi], nodes["pe"][pi, 0], nodes["pe"][pi, 1], nodes["pe"][pi, 2], phi)
            vin_rep = np.repeat(nodes["pvin"][pi], len(phi), axis=0)
            prev_body = seq[k - 1]
            fb1 = _flyby_rows(vin_rep, w.reshape(-1, 3), body_consts(prev_body)[0], RP_MIN_KM[prev_body])[0].reshape(len(pi), len(phi))
            win2 = w + nodes["pdV"][pi][:, None, :]          # v∞ de llegada tras la resonancia, por φ
            pmap = -np.ones(len(pend), dtype=np.int64)
            pmap[pi] = np.arange(len(pi))
        out, rows = [], 0

        def reduce(parts):
            """Fusiona y poda: en el último tramo, las 3 mejores por intervalo de salida
            (score final); antes, el haz por celdas fecha × |v∞|. Acota la memoria."""
            m = _cat(parts)
            if last:
                sc = score_of(dest, m["cost"], arrival_dv(dest, np.linalg.norm(m["vin"], axis=1)))
                return _take(m, _select(m["dep"], sc, 3, cfg.bin_days))
            vm = np.where(m["pend"], np.linalg.norm(m["pvin"], axis=1), np.linalg.norm(m["vin"], axis=1))
            return _take(m, _select(m["dep"], m["cost"] + m["plb"], cfg.beam, cfg.bin_days, vm))

        def push(node):
            nonlocal out, rows
            out.append(node)
            rows += len(node["dep"])
            if rows > 40000:
                out = [reduce(out)]
                rows = len(out[0]["dep"])

        nn = len(nodes["cur"])
        chunk = max(1, 20000 // max(1, len(T)))
        for s0 in range(0, nn, chunk):
            idx = np.arange(s0, min(nn, s0 + chunk))
            ii = np.repeat(idx, len(T))
            tt = np.tile(T, len(idx))
            fr = nodes["cur"][ii]
            to = fr + tt
            isp = nodes["pend"][ii]
            for bi, (m, low) in lam:
                v1, v2 = _lambert_rows(MU_SUN, P[A][fr + off[A]], P[B][to + off[B]], tt * DAY_S,
                                       np.full(len(tt), m, dtype=np.int64), np.full(len(tt), low))
                stats["lambert"] += len(tt)
                vout = v1 - Vt[A][fr + off[A]]
                dv = np.full(len(ii), np.nan)
                if (~isp).any():
                    q = ~isp
                    dv[q] = _flyby_rows(nodes["vin"][ii[q]], vout[q], mu, rpm)[0]
                if isp.any():
                    q = np.flatnonzero(isp)
                    pr = pmap[ii[q]]
                    w2 = win2[pr].reshape(-1, 3)
                    vo = np.repeat(vout[q], len(phi), axis=0)
                    fb2 = _flyby_rows(w2, vo, mu, rpm)[0].reshape(len(q), len(phi))
                    tot = fb1[pr] + fb2
                    dv[q] = np.nanmin(np.where(np.isfinite(tot), tot, np.inf), axis=1)
                part = nodes["cost"][ii] + dv
                # dos sobrevuelos (resonancia pendiente): doble margen
                ok = np.isfinite(part) & (dv <= np.where(isp, 2 * cfg.fb_cap_grid, cfg.fb_cap_grid))
                if not ok.any():
                    continue
                no = int(ok.sum())
                push({
                    "dep": nodes["dep"][ii[ok]], "cur": to[ok],
                    "tofs": np.hstack([nodes["tofs"][ii[ok]], tt[ok][:, None]]),
                    "brs": np.hstack([nodes["brs"][ii[ok]], np.full((no, 1), bi)]),
                    "cost": part[ok], "vin": v2[ok] - Vt[B][to[ok] + off[B]],
                    "pend": np.zeros(no, bool), "pc": np.zeros(no), "ps": np.zeros(no),
                    "pe": np.zeros((no, 3, 3)), "pvin": np.zeros((no, 3)), "pdV": np.zeros((no, 3)), "plb": np.zeros(no),
                })
        # Resonancias (solo desde nodos no pendientes: nunca dos seguidas)
        q = np.flatnonzero(~nodes["pend"])
        for bi, br in res:
            if len(q) == 0:
                break
            N, M = br[1], br[2]
            dur = int(round(SIDEREAL_DAYS[A] * N))
            fr = nodes["cur"][q]
            to = fr + dur
            Vp = Vt[A][fr + off[A]]
            vin = nodes["vin"][q]
            c, s, e1, e2, e3, okc = _cone(P[A][fr + off[A]], Vp, np.linalg.norm(vin, axis=1), A, N, M)
            w = _cone_vec(c, s, e1, e2, e3, phi)                       # (Q, F, 3)
            fb = _flyby_rows(np.repeat(vin, len(phi), axis=0), w.reshape(-1, 3), mu, rpm)[0].reshape(len(q), len(phi))
            j = np.argmin(np.where(np.isfinite(fb), fb, np.inf), axis=1)
            lb = fb[np.arange(len(q)), j]
            ok = okc & np.isfinite(lb) & (lb <= cfg.fb_cap_grid)
            if not ok.any():
                continue
            sel = q[ok]
            no = len(sel)
            dV = Vp[ok] - Vt[A][to[ok] + off[A]]
            node = {
                "dep": nodes["dep"][sel], "cur": to[ok],
                "tofs": np.hstack([nodes["tofs"][sel], np.full((no, 1), float(dur))]),
                "brs": np.hstack([nodes["brs"][sel], np.full((no, 1), bi)]),
                "cost": nodes["cost"][sel].copy(), "vin": np.zeros((no, 3)),
                "pend": np.ones(no, bool), "pc": c[ok], "ps": s[ok],
                "pe": np.stack([e1[ok], e2[ok], e3[ok]], axis=1), "pvin": vin[ok], "pdV": dV, "plb": lb[ok],
            }
            if last:   # la resonancia acaba en el destino: φ solo por el sobrevuelo de entrada
                node["cost"] = node["cost"] + lb[ok]
                node["vin"] = w[ok][np.arange(no), j[ok]] + dV
                node["pend"] = np.zeros(no, bool)
                node["plb"] = np.zeros(no)
            push(node)
            del w, fb
        if not out:
            return []
        nodes = reduce(out)
        out = None
        if last:
            sc = score_of(dest, nodes["cost"], arrival_dv(dest, np.linalg.norm(nodes["vin"], axis=1)))
            return _pack(seq, base_jd, nodes, br_lists, sc)
    return []


def _pack(seq, base_jd, nodes, br_lists, score):
    order = np.argsort(score)
    out = []
    for i in order:
        x = [base_jd + float(nodes["dep"][i])] + [float(v) for v in nodes["tofs"][i]]
        out.append({"seq": seq, "x": x,
                    "branches": [br_lists[k][int(nodes["brs"][i][k])] for k in range(len(br_lists))],
                    "score": float(score[i])})
    return out


# ─── Refinado local ────────────────────────────────────────────────────────


def _refine(cand, lo_jd, hi_jd, cfg, stats, maxfev=None, steps=(0.6, 0.15)):
    """Nelder–Mead sobre (salida, TOF de cada tramo no resonante) con efemérides
    interpoladas. Las resonancias mantienen su duración exacta N·P. `steps`: tamaño
    del símplex inicial (en pasos de la rejilla) de cada reinicio."""
    maxfev = int(maxfev or cfg.refine_maxfev)
    from scipy.optimize import minimize        # scipy: dependencia de hapsira (no se añade nada)
    seq, br = cand["seq"], cand["branches"]
    n = len(seq) - 1
    x0 = np.array(cand["x"], float)
    for k in range(n):
        if is_res(br[k]):
            x0[k + 1] = SIDEREAL_DAYS[seq[k]] * br[k][1]
    free = [0] + [k + 1 for k in range(n) if not is_res(br[k])]
    ranges = [tof_range(seq, k) for k in range(n)]
    scale = np.array([cfg.dep_step] + [max(2.0, (ranges[i - 1][1] - ranges[i - 1][0]) / max(1, cfg.tof_samples - 1))
                                        for i in free[1:]])

    def f(z):
        x = x0.copy()
        x[free] = x0[free] + z * scale
        if not (lo_jd <= x[0] <= hi_jd):
            return 1e3 + abs(x[0] - min(max(x[0], lo_jd), hi_jd))
        pen = 0.0
        for k in range(n):
            lo, hi = ranges[k]
            if not is_res(br[k]) and not (lo <= x[k + 1] <= hi):
                pen += 1.0 + 0.01 * abs(x[k + 1] - min(max(x[k + 1], lo), hi))
        if pen:
            return 1e2 + pen
        jds = np.cumsum(x)
        R, V = _states(seq, jds, exact=False)
        sc = _trajectory(seq, jds, R, V, br, phi_samples=24, refine_phi=False)
        return 1e3 if not np.isfinite(sc) else sc

    nz = len(free)
    best_z, best_f = np.zeros(nz), f(np.zeros(nz))
    for step in steps:
        simplex = np.vstack([best_z] + [best_z + step * np.eye(nz)[i] for i in range(nz)])
        r = minimize(f, best_z, method="Nelder-Mead",
                     options={"initial_simplex": simplex, "maxfev": maxfev * nz, "xatol": 1e-3, "fatol": 1e-5})
        stats["refine_evals"] += int(r.nfev)
        if r.fun < best_f:
            best_z, best_f = r.x, float(r.fun)
    x = x0.copy()
    x[free] = x0[free] + best_z * scale
    return {"seq": seq, "x": [float(v) for v in x], "branches": br, "score": best_f}


# ─── Plan completo para un destino ─────────────────────────────────────────


def _iso_day(jd: float) -> str:
    return lambert._jd_to_iso(jd)[:10]


def today_jd(today: Optional[datetime] = None) -> float:
    d = (today or datetime.utcnow()).replace(hour=0, minute=0, second=0, microsecond=0)
    return float(Time(d.isoformat(), scale="utc").tdb.jd)


def synodic_years(a: str, b: str) -> float:
    pa, pb = orbital.ORBITAL_PERIOD_DAYS[a], orbital.ORBITAL_PERIOD_DAYS[b]
    return 1.0 / abs(1.0 / pa - 1.0 / pb) / 365.25


def _option(det: dict, mission: Optional[str], direct: Optional[dict]) -> dict:
    """Detalle de evaluate() → opción para la respuesta HTTP (cifras redondeadas)."""
    seq = det["seq"]
    pos = det.get("positions") or [None] * len(seq)
    events = [{"body": seq[0], "kind": "launch", "date": _iso_day(det["jds"][0]), "pos_au": pos[0]}]
    flybys = []
    for i, f in enumerate(det["flybys"]):
        flybys.append({
            "body": f["body"], "date": _iso_day(f["jd"]),
            "v_inf_in_km_s": round(f["v_inf_in"], 2), "v_inf_out_km_s": round(f["v_inf_out"], 2),
            "turn_deg": round(f["turn_deg"], 1), "turn_max_deg": round(f["turn_max_deg"], 1),
            "periapsis_km": round(f["rp_km"]), "altitude_km": round(f["altitude_km"]),
            "min_periapsis_km": round(f["rp_min_km"]),
            "powered_delta_v_km_s": round(f["dv"], 3), "turn_limited": f["turn_limited"],
            "helio_speed_gain_km_s": round(f["helio_gain"], 2),
            "viable": f["dv"] <= VIABLE_FLYBY_DV_KM_S,
        })
        events.append({"body": f["body"], "kind": "flyby", "date": _iso_day(f["jd"]), "pos_au": pos[i + 1]})
    events.append({"body": seq[-1], "kind": "arrival", "date": _iso_day(det["jds"][-1]), "pos_au": pos[-1]})
    legs = []
    for k in range(len(seq) - 1):
        br = det["branches"][k]
        legs.append({"from": seq[k], "to": seq[k + 1], "departure": _iso_day(det["jds"][k]),
                     "arrival": _iso_day(det["jds"][k + 1]), "days": round(det["jds"][k + 1] - det["jds"][k]),
                     "revolutions": int(br[2] if is_res(br) else br[0]),
                     "resonance": f"{br[1]}:{br[2]}" if is_res(br) else None,
                     "path_au": (det.get("paths") or [None] * len(seq))[k]})
    dest = seq[-1]
    lo = lambert._low_orbit(dest)
    opt = {
        "id": f"{code_of(seq)}-{_iso_day(det['jds'][0])}",
        "code": code_of(seq), "sequence": list(seq), "mission": mission,
        "departure_date": _iso_day(det["jds"][0]), "arrival_date": _iso_day(det["jds"][-1]),
        "duration_days": round(det["duration_days"]), "duration_years": round(det["duration_days"] / 365.25, 1),
        "c3_km2_s2": round(det["c3"], 1), "v_inf_departure_km_s": round(det["v_inf_dep"], 2),
        "injection_delta_v_km_s": round(det["injection_dv"], 3),
        "departure_declination_deg": round(det["dla_deg"], 1),
        "flybys": flybys, "legs": legs, "events": events,
        "powered_delta_v_km_s": round(det["powered_dv"], 3),
        "max_flyby_delta_v_km_s": round(det["max_flyby_dv"], 3),
        "cost_km_s": round(det["cost"], 3),
        "arrival": {"v_inf_km_s": round(det["v_inf_arr"], 2), "delta_v_km_s": round(det["arrival_dv"], 3),
                    "kind": "low_orbit" if lo else "capture",
                    "orbit_altitude_km": lo["alt_km"] if lo else None,
                    "capture_periapsis_km": None if lo else round(RP_MIN_KM[dest])},
        "viable_without_dsm": bool(det["viable"]),
        "is_direct": len(seq) == 2,
        "score": round(det["score"], 3),
    }
    if direct is not None:
        opt["vs_direct"] = {
            "injection_saving_km_s": round(direct["injection_dv"] - det["injection_dv"], 3),
            "cost_saving_km_s": round(direct["cost"] - det["cost"], 3),
            "c3_saving_km2_s2": round(direct["c3"] - det["c3"], 1),
            "extra_days": round(det["duration_days"] - direct["duration_days"]),
        }
    return opt


def _windows(dets: list, gap_days: float = 150.0) -> list:
    """Una sola opción (la de menor score) por ventana de salida de una secuencia."""
    out = []
    for d in sorted(dets, key=lambda d: d["score"]):
        if all(abs(d["jds"][0] - o["jds"][0]) > gap_days for o in out):
            out.append(d)
    return out


def _pick(cands: list, k: int) -> list:
    """Candidatos a refinar: los k mejores distintos y los 2 más tempranos de entre los
    buenos (para no perder la «salida pronto»). Distintos = otra ventana de salida
    (> 150 días) u otra combinación de ramas en la misma ventana (p. ej. Venus–Venus
    resonante o no) o con tiempos de vuelo que difieren en más de 60 días (Nelder–Mead
    es local: desde otro punto de partida llega a otro mínimo). Como mucho 3 por ventana."""
    def same_window(c, p):
        return abs(c["x"][0] - p["x"][0]) <= 150

    def new(c, picked):
        near = [p for p in picked if same_window(c, p)]
        if len(near) >= 3:
            return False
        return all(c["branches"] != p["branches"] or max(abs(a - b) for a, b in zip(c["x"][1:], p["x"][1:])) > 60
                   for p in near)

    picked = []
    for c in cands:
        if new(c, picked):
            picked.append(c)
        if len(picked) >= k:
            break
    for c in sorted(cands[: max(30, 6 * k)], key=lambda c: c["x"][0])[:2]:
        if new(c, picked):
            picked.append(c)
    return picked


def plan(destination: str, origin: str = "earth", today: Optional[datetime] = None,
         cfg: SearchConfig = DEFAULT_CONFIG, progress=None) -> dict:
    """Plan de viaje con catapultas al destino, desde la Tierra, saliendo entre hoy y
    `cfg.years` años después. Tarda decenas de segundos: se sirve desde la caché
    (MgaService). `progress(fracción)` opcional."""
    origin, destination = origin.lower(), destination.lower()
    if origin != "earth":
        raise ValueError("Solo calculado desde la Tierra")
    if destination not in SEQUENCES:
        raise ValueError(f"Destino no disponible: {destination}")
    t_start = time.time()
    lo_jd = today_jd(today)
    base_jd = math.floor(lo_jd - 0.5) + 0.5
    span = int(round(cfg.years * 365.25))
    hi_jd = base_jd + span
    stats = {"lambert": 0, "refine_evals": 0}

    by_seq = []
    seqs = SEQUENCES[destination]
    for si, (seq, mission) in enumerate(seqs):
        cands = []
        for frac, dn in (cfg.passes if len(seq) > 2 else cfg.passes[:1]):
            cands += _grid_search(seq, base_jd, span, cfg, stats, int(round(frac * cfg.dep_step)),
                                  max(4, cfg.tof_samples + dn))
        cands.sort(key=lambda c: c["score"])
        dets = []
        if destination in DIRECT_ONLY:
            # Solo directo (Marte, Venus): todas las ventanas, para listarlas por fecha.
            final = [_refine(c, lo_jd, hi_jd, cfg, stats) for c in _pick(cands, 40)]
        else:
            # Dos etapas: la nota de la rejilla es ruidosa, así que primero un refinado
            # rápido de muchas ventanas y después el completo de las mejores.
            quick = sorted((_refine(c, lo_jd, hi_jd, cfg, stats, maxfev=cfg.quick_maxfev, steps=(0.6,))
                            for c in _pick(cands, cfg.quick_per_seq)), key=lambda c: c["score"])
            final = [_refine(c, lo_jd, hi_jd, cfg, stats, steps=(0.3, 0.1)) for c in _pick(quick, cfg.refine_per_seq)]
        for r in final:
            det = evaluate(seq, np.cumsum(r["x"]), r["branches"], paths=True)
            if det is not None and det["jds"][0] >= lo_jd - 1e-6:
                dets.append(det)
        by_seq.append((seq, mission, _windows(dets)))
        if progress:
            progress((si + 1) / len(seqs))

    direct_dets = next((ds for s, _, ds in by_seq if len(s) == 2), [])
    direct_best = min(direct_dets, key=lambda d: d["score"]) if direct_dets else None
    direct_next = min(direct_dets, key=lambda d: d["jds"][0]) if direct_dets else None
    assisted = [(d, m) for s, m, ds in by_seq if len(s) > 2 for d in ds]
    rank_key = lambda p: (not p[0]["viable"], p[0]["score"])

    def beats(d):
        """Viable sin DSM y mejor (menor score) que el mejor directo."""
        return d["viable"] and (direct_best is None or d["score"] < direct_best["score"] - 1e-6)

    if destination in DIRECT_ONLY:
        chosen = sorted([(d, None) for d in direct_dets], key=lambda p: p[0]["jds"][0])[:5]
    else:
        good = sorted([p for p in assisted if beats(p[0])], key=lambda p: p[0]["score"])
        chosen, used = [], {}
        for d, m in good:                         # 1.ª pasada: la mejor de cada secuencia
            if d["seq"] not in used and len(chosen) < 4:
                chosen.append((d, m))
                used[d["seq"]] = 1
        for d, m in good:                         # 2.ª: otras ventanas (máx. 2 por secuencia)
            if len(chosen) >= 4:
                break
            if all(d is not c[0] for c in chosen) and used.get(d["seq"], 0) < 2:
                chosen.append((d, m))
                used[d["seq"]] = used.get(d["seq"], 0) + 1
        if direct_best is not None:               # el directo, siempre, como referencia
            chosen.append((direct_best, None))
        if len(chosen) < 3:                       # si faltan, las más baratas que piden maniobras (marcadas)
            for d, m in sorted([p for p in assisted if not p[0]["viable"]], key=lambda p: p[0]["score"]):
                if len(chosen) >= 3:
                    break
                if d["seq"] not in used:
                    chosen.append((d, m))
                    used[d["seq"]] = 1
        chosen.sort(key=rank_key)

    mk = lambda p: _option(p[0], p[1], direct_best)
    opts = [mk(p) for p in chosen]
    if destination in DIRECT_ONLY:
        best = min(opts, key=lambda o: o["score"]) if opts else None
    else:
        best = next((o for o in opts if not o["is_direct"] and o["viable_without_dsm"]), None) or (
            mk((direct_best, None)) if direct_best else None)

    earliest = next_jup = None
    if destination not in DIRECT_ONLY:
        c = sorted([p for p in assisted if beats(p[0])], key=lambda p: p[0]["jds"][0])
        earliest = mk(c[0]) if c else None
    if destination in JUPITER_CYCLE_DESTS:
        c = sorted([p for p in assisted if "jupiter" in p[0]["seq"][1:-1] and beats(p[0])], key=lambda p: p[0]["jds"][0])
        next_jup = mk(c[0]) if c else None

    hoh = orbital.compute_hohmann_transfer("earth", destination).to_dict()
    hv_dep, hv_arr = float(hoh["delta_v_departure_km_s"]), float(hoh["delta_v_arrival_km_s"])
    direct = {
        "best": mk((direct_best, None)) if direct_best else None,
        "next": mk((direct_next, None)) if direct_next else None,
        "hohmann": {
            "duration_days": round(float(hoh["transfer_time_days"])),
            "c3_km2_s2": round(hv_dep**2, 1), "v_inf_departure_km_s": round(hv_dep, 2),
            "injection_delta_v_km_s": round(float(_dv_leo(hv_dep)), 3),
            "v_inf_arrival_km_s": round(hv_arr, 2),
            "arrival_delta_v_km_s": round(float(arrival_dv(destination, hv_arr)), 3),
        },
    }
    sequences = []
    for seq, mission, ds in by_seq:
        b = min(ds, key=lambda d: d["score"]) if ds else None
        sequences.append({
            "code": code_of(seq), "sequence": list(seq), "mission": mission, "windows_found": len(ds),
            "best_cost_km_s": round(b["cost"], 3) if b else None,
            "best_departure": _iso_day(b["jds"][0]) if b else None,
            "best_viable": bool(b["viable"]) if b else None,
            "any_viable": any(d["viable"] for d in ds),
        })
    flyby_bodies = sorted({x for s, _ in seqs for x in s[1:-1]})
    first_day = _iso_day(lo_jd)
    for o in [best, earliest, next_jup, direct["best"], direct["next"]] + opts:
        if o is not None:
            o["starts_today"] = o["departure_date"] <= first_day     # en el borde: el óptimo podría ser anterior
    return {
        "status": "ok",
        "origin": origin, "destination": destination,
        "horizon": {"from": _iso_day(lo_jd), "to": _iso_day(hi_jd), "years": cfg.years},
        "assists_help": bool(destination not in DIRECT_ONLY and best is not None and len(best["sequence"]) > 2
                             and best["viable_without_dsm"] and direct_best is not None
                             and best["score"] < direct_best["score"]),
        "criterion": ("injection_plus_powered_flybys_plus_insertion" if destination == "mercury"
                      else "injection_plus_powered_flybys"),
        "best": best, "options": opts, "earliest": earliest,
        "next_jupiter": next_jup,
        "jupiter_cycle_years": round(synodic_years("jupiter", destination), 1) if destination in JUPITER_CYCLE_DESTS else None,
        "direct": direct,
        "sequences": sequences,
        "assumptions": {
            "model": "patched_conics", "ephemeris": "astropy builtin (ERFA epv00/plan94)",
            "leo_altitude_km": lambert.LEO_ALT_KM, "viable_flyby_dv_km_s": VIABLE_FLYBY_DV_KM_S,
            "deep_space_maneuvers": False, "horizon_years": cfg.years,
            "tiebreak_arrival_fraction": TIEBREAK_ARRIVAL,
            "min_periapsis_km": {b: round(RP_MIN_KM[b]) for b in flyby_bodies},
            "dates_rounded_to_day": True,
        },
        "search": {"lambert_solved": stats["lambert"], "refine_evaluations": stats["refine_evals"],
                   "seconds": round(time.time() - t_start, 1), **cfg.as_dict()},
        "algo_version": ALGO_VERSION,
    }


def warm() -> None:
    """Compila las funciones numba de este módulo (~2–6 s la primera vez por proceso)."""
    r = np.array([[1.5e8, 0.0, 0.0]])
    _lambert_rows(MU_SUN, r, np.array([[0.0, 2.2e8, 0.0]]), np.array([2.2e7]),
                  np.array([0], dtype=np.int64), np.array([True]))
    _flyby_rows(np.array([[5.0, 0.0, 0.0]]), np.array([[0.0, 5.0, 0.0]]), 3.2e5, 6400.0)
    _hermite(np.zeros((3, 3)), np.zeros((3, 3)), 0.0, np.array([0.5]))


# ─── Servicio: caché en memoria y en disco + un hilo de cálculo ────────────
# El cálculo tarda ~5–20 s por destino en un núcleo: nunca se hace dentro de una
# petición. Un único hilo en segundo plano (una cola) calcula y guarda el resultado
# en memoria y, si hay directorio (volumen de Railway, como las métricas), en
# disco de forma atómica. La petición HTTP solo lee: si aún no hay resultado,
# responde 202 «calculando».

FILE_PREFIX = "teseo-mga-"
MAX_AGE_DAYS = 7          # pasado este tiempo se recalcula en segundo plano (se sigue sirviendo el anterior)


def _malloc_trim() -> None:
    """Devuelve al sistema la memoria libre de numpy (glibc). Sin efecto fuera de Linux."""
    try:
        import ctypes
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:
        pass


class MgaService:
    def __init__(self, directory: Optional[str] = None, cfg: SearchConfig = DEFAULT_CONFIG,
                 max_age_days: int = MAX_AGE_DAYS, clock=time.time):
        self.cfg = cfg
        self.max_age_days = max_age_days
        self.clock = clock
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._mem: dict = {}
        self._queue: list = []
        self._running: Optional[str] = None
        self._started_at: Optional[float] = None
        self._progress = 0.0
        self._errors: dict = {}
        self._thread: Optional[threading.Thread] = None
        self.last_seconds: dict = {}
        self.dir: Optional[str] = None
        self.reason: Optional[str] = None
        if directory:
            try:
                import os
                os.makedirs(directory, exist_ok=True)
                probe = os.path.join(directory, f".probe-mga-{os.getpid()}")
                with open(probe, "w") as f:
                    f.write("ok")
                os.remove(probe)
                self.dir = directory
            except Exception as e:
                self.reason = f"directorio no escribible ({type(e).__name__})"
        else:
            self.reason = "sin directorio: solo en memoria"

    # -- disco ---------------------------------------------------------------
    def _path(self, dest: str) -> Optional[str]:
        import os
        return os.path.join(self.dir, f"{FILE_PREFIX}{dest}.json") if self.dir else None

    def _load(self, dest: str) -> Optional[dict]:
        import json
        import os
        p = self._path(dest)
        if not p or not os.path.exists(p):
            return None
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict) or data.get("algo_version") != ALGO_VERSION or data.get("destination") != dest:
                return None
            return data
        except Exception:
            return None

    def _save(self, dest: str, data: dict) -> None:
        import json
        import os
        p = self._path(dest)
        if not p:
            return
        tmp = f"{p}.tmp-{os.getpid()}"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, separators=(",", ":"))
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, p)
        except Exception:
            try:
                os.remove(tmp)
            except Exception:
                pass

    # -- validez -------------------------------------------------------------
    def _today(self) -> str:
        return datetime.utcfromtimestamp(self.clock()).strftime("%Y-%m-%d")

    def _usable(self, data: dict) -> bool:
        """Sirve si ninguna opción mostrada ha salido ya (fechas absolutas)."""
        today = self._today()
        deps = [o["departure_date"] for o in (data.get("options") or []) if o]
        for k in ("best", "earliest", "next_jupiter"):
            if data.get(k):
                deps.append(data[k]["departure_date"])
        return all(d >= today for d in deps) and data.get("computed_for", "") <= today

    def _fresh(self, data: dict) -> bool:
        try:
            age = (datetime.strptime(self._today(), "%Y-%m-%d") - datetime.strptime(data["computed_for"], "%Y-%m-%d")).days
        except Exception:
            return False
        return age < self.max_age_days

    # -- API -----------------------------------------------------------------
    def get(self, dest: str) -> tuple[str, dict]:
        """("ok", resultado) | ("computing", estado) | ("error", estado)."""
        with self._lock:
            data = self._mem.get(dest)
        if data is None:
            data = self._load(dest)
            if data is not None:
                with self._lock:
                    self._mem[dest] = data
        if data is not None and self._usable(data):
            if not self._fresh(data):
                self.enqueue(dest)
                return "ok", {**data, "refreshing": True}
            return "ok", data
        err = self._errors.get(dest)
        if err and self.clock() - err["at"] < 300 and dest not in self._queue and self._running != dest:
            return "error", {"status": "error", "destination": dest, "detail": err["detail"]}
        self.enqueue(dest, front=True)
        return "computing", self.state(dest)

    def state(self, dest: str) -> dict:
        with self._lock:
            running = self._running == dest
            pos = self._queue.index(dest) + 1 if dest in self._queue else 0
            prog = self._progress if running else 0.0
            started = self._started_at if running else None
        est = self.last_seconds.get(dest, 25.0)
        return {
            "status": "computing", "destination": dest, "running": running, "queue_position": pos,
            "progress": round(prog, 2), "eta_s": round(max(2.0, est * (1 - prog)) + (0 if running else est * max(0, pos - 1)), 0),
            "started_at": None if started is None else round(started),
        }

    def enqueue(self, dest: str, front: bool = False) -> None:
        with self._lock:
            if self._running == dest:
                return
            if dest in self._queue:
                if front:
                    self._queue.remove(dest)
                    self._queue.insert(0, dest)
            else:
                self._queue.insert(0, dest) if front else self._queue.append(dest)
            self._ensure_thread()
        self._wake.set()

    def prewarm(self, dests=DESTINATIONS) -> None:
        """Encola los destinos sin resultado utilizable y fresco (en disco o memoria)."""
        for d in dests:
            data = self._mem.get(d) or self._load(d)
            if data is not None:
                with self._lock:
                    self._mem[d] = data
            if data is None or not self._usable(data) or not self._fresh(data):
                self.enqueue(d)

    def _ensure_thread(self) -> None:
        if self._thread is None or not self._thread.is_alive():
            self._thread = threading.Thread(target=self._loop, name="teseo-mga", daemon=True)
            self._thread.start()

    def _loop(self) -> None:
        while True:
            with self._lock:
                dest = self._queue.pop(0) if self._queue else None
                self._running = dest
                self._started_at = self.clock() if dest else None
                self._progress = 0.0
            if dest is None:
                self._wake.wait(60)
                self._wake.clear()
                continue
            t0 = time.time()
            try:
                def prog(f):
                    self._progress = float(f)
                data = plan(dest, cfg=self.cfg, today=datetime.utcfromtimestamp(self.clock()), progress=prog)
                data["computed_for"] = self._today()
                data["computed_at"] = datetime.utcfromtimestamp(self.clock()).strftime("%Y-%m-%dT%H:%M:%SZ")
                self._save(dest, data)            # primero al disco, luego visible en memoria
                with self._lock:
                    self._mem[dest] = data
                self._errors.pop(dest, None)
            except Exception as e:      # nunca tumba el hilo
                self._errors[dest] = {"at": self.clock(), "detail": f"{type(e).__name__}: {e}"}
            finally:
                self.last_seconds[dest] = time.time() - t0
                with self._lock:
                    self._running = None
                    self._started_at = None
                _malloc_trim()

    def status(self) -> dict:
        with self._lock:
            cached = sorted(self._mem)
            return {"storage": "persistent" if self.dir else "memory", "cached": cached,
                    "running": self._running, "queue": list(self._queue),
                    "errors": sorted(self._errors), **({"reason": self.reason} if not self.dir else {})}
