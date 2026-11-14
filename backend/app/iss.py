"""
iss.py — ¿Cuándo pasa la Estación Espacial Internacional (ISS) sobre mí?

Física real, sin IA:

  1. Elementos orbitales: CelesTrak, grupo GP (datos del 18.º Escuadrón de
     Control Espacial de EE. UU.), NORAD 25544, formato TLE.
        GET https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE
     Política de CelesTrak: los elementos de un objeto se actualizan como
     mucho cada pocas horas y piden NO consultar más de una vez cada 2 h por
     objeto. Aquí el TTL de la caché es de 2 h 5 min, con pausa de 10 min tras
     un fallo y `stale` si CelesTrak cae. Una sola petición sirve a todos los
     visitantes.
  2. Propagación: SGP4 (biblioteca `sgp4`, de Brandon Rhodes, que implementa
     la versión de Vallado et al., 2006). Da posición y velocidad en el marco
     TEME (ecuador verdadero, equinoccio medio de la fecha).
  3. Del marco TEME al horizonte del observador, a mano y vectorizado:
       · TEME → PEF (Tierra fija sin movimiento polar): giro alrededor de Z
         del ángulo GMST (IAU 1982, Aoki et al. 1982; Vallado 2013, ec. 3-47).
         OJO: no se suma la ecuación de los equinoccios. TEME usa el
         equinoccio MEDIO; la ecuación de los equinoccios (Δψ·cos ε) solo hace
         falta al pasar de TEME al marco "verdadero de la fecha" y se cancela
         con la que lleva GAST = GMST + Δψ·cos ε. Para TEME → PEF basta GMST
         (Vallado, Crawford, Hujsak y Kelso 2006, §"Coordinate frames").
       · PEF → ITRS: se omite el movimiento polar (≲ 0,3″ ≈ 10 m).
       · Se usa UTC como UT1 (|UT1−UTC| < 0,9 s ≈ 14″ de rotación terrestre
         ≈ 0,004°). Sin refracción atmosférica (a 10° de altura ≈ 5′).
       · Observador: geodésico WGS-84 → ECEF → ENU → altura y azimut
         (azimut medido desde el norte hacia el este).
     Error esperado: el de SGP4 con un TLE reciente (≈ 1–3 km a la época,
     unos 2–5 km por día después, sobre todo a lo largo de la órbita ⇒ unos
     0,2–0,5° y 1–2 s por día de antigüedad). Muy por debajo del ~1° pedido
     para una predicción visual mientras los elementos tengan menos de 3 días.
  4. Visibilidad a simple vista: la ISS debe (a) estar a más de 10° sobre el
     horizonte, (b) estar iluminada por el Sol (fuera de la sombra de la
     Tierra, modelo CÓNICO de Montenbruck y Gill 2000, §3.4.2: umbra y
     penumbra con la fracción del disco solar visible; se cuenta como
     iluminada con ≥ 50 % del disco) y (c) el observador debe estar en
     crepúsculo náutico o noche (Sol a menos de −6°). Posición del Sol:
     fórmula de baja precisión del Astronomical Almanac (Vallado 2013,
     Algoritmo 29), ≈ 0,01°.
  5. Magnitud APROXIMADA (opcional). Fórmula de los observadores visuales de
     satélites (McCants; SeeSat-L, abril de 2001):
        m = m_est − 15 + 5·log10(R) − 2,5·log10( sen β + (π − β)·cos β )
     con R = distancia en km, β = ángulo de fase Sol–ISS–observador y m_est =
     magnitud estándar a 1000 km y fase de 90° (esfera difusa; la definición
     de «magnitud estándar» es la de los observadores de SeeSat-L). El valor
     de m_est de la ISS no está fijado por una fuente única: con −1,8 sale
     ≈ 0,4 magnitudes más brillante que Heavens-Above (media de 10 pasadas
     visibles de Madrid, 14–23-nov-2026, desviación 0,1); con −1,4 coincide.
     Se usa −1,4, ajustado a esa comparación, y se rotula siempre «≈». La ISS
     no es una esfera: se orienta, tiene paneles que reflejan y su brillo
     real varía en ±1 magnitud. La magnitud solo se da si la pasada es
     visible, y es la del punto más brillante del tramo visible.
"""

import asyncio
import math
import time
from typing import Optional

import httpx
import numpy as np
from sgp4.api import Satrec, WGS72

from app.cache import ProviderError, Resource, iso_utc, provider_headers

# ─── Constantes ──────────────────────────────────────────────────────────────
NORAD_ID = 25544
CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php"
SOURCE = "CelesTrak (NORAD GP) · SGP4"
SOURCE_URL = "https://celestrak.org/NORAD/elements/"

TTL = 2 * 3600 + 300          # ≥ 2 h: política de CelesTrak (una consulta cada 2 h por objeto)
RETRY_AFTER = 10 * 60         # tras un fallo no se vuelve a llamar durante 10 min
_TIMEOUT = 15.0

MIN_ALT = 10.0                # grados: umbral de inicio/fin de una pasada
SUN_VISIBLE_MAX = -6.0        # Sol por debajo de esto = crepúsculo náutico o noche
STD_MAG = -1.4                # magnitud estándar de la ISS (1000 km, fase 90°); ver el encabezado
OUTDATED_DAYS = 3.0           # con elementos más viejos se avisa de que la precisión baja
MIN_DAYS, MAX_DAYS, DEFAULT_DAYS = 1, 10, 5
GRID_STEP = 10.0              # s: paso de muestreo de la búsqueda y de la trayectoria
MIN_VISIBLE_S = 10.0          # tramos visibles más cortos que esto se descartan (ruido)
PASSES_TTL = 600.0            # s: caché de pasadas por lugar (el cálculo es barato, pero 1 por visitante sobra)

R_EARTH = 6378.137            # km, radio ecuatorial WGS-84
F_EARTH = 1 / 298.257223563   # achatamiento WGS-84
R_SUN = 696000.0              # km
AU = 149597870.7              # km

_COMPASS16_EN = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
_COMPASS16_ES = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"]


# ─── Tiempo ──────────────────────────────────────────────────────────────────
def _now() -> float:
    """Reloj del módulo (las pruebas lo sustituyen)."""
    return time.time()


def jd_split(unix) -> tuple:
    """Segundos Unix (UTC) -> (jd, fr) con jd+fr = día juliano. Se separan para
    conservar la precisión de float64 (lo que espera sgp4)."""
    u = np.atleast_1d(np.asarray(unix, dtype=float))
    days = u / 86400.0
    whole = np.floor(days)
    jd = whole + 2440587.5            # medianoche UTC de ese día
    fr = days - whole
    return jd, fr


def gmst82(jd, fr):
    """Tiempo sidéreo medio de Greenwich (IAU 1982), en radianes.
    Vallado (2013), ec. 3-47. Se toma UTC como UT1."""
    t = ((jd - 2451545.0) + fr) / 36525.0
    sec = 67310.54841 + (876600.0 * 3600.0 + 8640184.812866) * t + 0.093104 * t * t - 6.2e-6 * t ** 3
    return np.deg2rad((sec % 86400.0) / 240.0)


# ─── Marcos de referencia ────────────────────────────────────────────────────
def teme_to_ecef(r, theta):
    """TEME -> Tierra fija (PEF≈ITRS): giro de ángulo GMST alrededor de Z.
    r: (N,3) km; theta: (N,) rad."""
    c, s = np.cos(theta), np.sin(theta)
    out = np.empty_like(r)
    out[:, 0] = c * r[:, 0] + s * r[:, 1]
    out[:, 1] = -s * r[:, 0] + c * r[:, 1]
    out[:, 2] = r[:, 2]
    return out


def geodetic_to_ecef(lat_deg, lon_deg, alt_m):
    """Latitud/longitud geodésicas WGS-84 y altitud (m) -> ECEF (km), vector (3,)."""
    lat, lon, h = math.radians(lat_deg), math.radians(lon_deg), alt_m / 1000.0
    e2 = F_EARTH * (2 - F_EARTH)
    n = R_EARTH / math.sqrt(1 - e2 * math.sin(lat) ** 2)
    return np.array([
        (n + h) * math.cos(lat) * math.cos(lon),
        (n + h) * math.cos(lat) * math.sin(lon),
        (n * (1 - e2) + h) * math.sin(lat),
    ])


def ecef_to_geodetic(r):
    """ECEF (N,3) km -> (lat°, lon°, alt km) geodésicas WGS-84 (iteración de Bowring)."""
    x, y, z = r[:, 0], r[:, 1], r[:, 2]
    e2 = F_EARTH * (2 - F_EARTH)
    p = np.hypot(x, y)
    lat = np.arctan2(z, p * (1 - e2))
    for _ in range(6):
        n = R_EARTH / np.sqrt(1 - e2 * np.sin(lat) ** 2)
        lat = np.arctan2(z + e2 * n * np.sin(lat), p)
    n = R_EARTH / np.sqrt(1 - e2 * np.sin(lat) ** 2)
    polar = np.abs(lat) > np.deg2rad(80)
    alt = np.where(polar, z / np.where(polar, np.sin(lat), 1.0) - n * (1 - e2), p / np.cos(lat) - n)
    return np.rad2deg(lat), np.rad2deg(np.arctan2(y, x)), alt


def look_angles(rel, lat_deg, lon_deg):
    """Vector observador→objeto en ECEF (N,3) -> (altura°, azimut°) en el
    horizonte local del observador. Azimut desde el norte hacia el este."""
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    sl, cl, so, co = math.sin(lat), math.cos(lat), math.sin(lon), math.cos(lon)
    e = -so * rel[:, 0] + co * rel[:, 1]
    n = -sl * co * rel[:, 0] - sl * so * rel[:, 1] + cl * rel[:, 2]
    u = cl * co * rel[:, 0] + cl * so * rel[:, 1] + sl * rel[:, 2]
    rng = np.sqrt(e * e + n * n + u * u)
    alt = np.rad2deg(np.arcsin(np.clip(u / rng, -1, 1)))
    az = np.rad2deg(np.arctan2(e, n)) % 360.0
    return alt, az


# ─── Sol y sombra ────────────────────────────────────────────────────────────
def sun_teme(jd, fr):
    """Posición geocéntrica del Sol (km), (N,3), en el ecuador y equinoccio
    de la fecha. Astronomical Almanac, baja precisión (Vallado 2013, Alg. 29),
    ≈ 0,01°. La diferencia de equinoccio con TEME es de arcminutos."""
    t = ((jd - 2451545.0) + fr) / 36525.0
    lam_m = 280.460 + 36000.771 * t
    m = np.deg2rad(357.5291092 + 35999.05034 * t)
    lam = np.deg2rad(lam_m + 1.914666471 * np.sin(m) + 0.019994643 * np.sin(2 * m))
    eps = np.deg2rad(23.439291 - 0.0130042 * t)
    r_au = 1.000140612 - 0.016708617 * np.cos(m) - 0.000139589 * np.cos(2 * m)
    r = r_au * AU
    return np.stack([r * np.cos(lam), r * np.cos(eps) * np.sin(lam), r * np.sin(eps) * np.sin(lam)], axis=1)


def illumination(r_sat, r_sun):
    """Fracción iluminada del disco solar vista desde el satélite (1 = pleno Sol,
    0 = umbra), modelo cónico (Montenbruck y Gill 2000, §3.4.2). Vectorizado.
    r_sat, r_sun: (N,3) km, en el mismo marco, geocéntricos."""
    to_sun = r_sun - r_sat
    d_sun = np.linalg.norm(to_sun, axis=1)
    d_earth = np.linalg.norm(r_sat, axis=1)
    a = np.arcsin(np.clip(R_SUN / d_sun, -1, 1))         # radio aparente del Sol
    b = np.arcsin(np.clip(R_EARTH / d_earth, -1, 1))     # radio aparente de la Tierra
    cosc = np.einsum("ij,ij->i", -r_sat, to_sun) / (d_earth * d_sun)
    c = np.arccos(np.clip(cosc, -1, 1))                  # separación de centros
    nu = np.ones_like(c)
    umbra = c <= (b - a)
    nu[umbra] = 0.0
    pen = (~umbra) & (c < (a + b)) & (c > np.abs(a - b))
    if pen.any():
        ap, bp, cp = a[pen], b[pen], c[pen]
        x = (cp * cp + ap * ap - bp * bp) / (2 * cp)
        y = np.sqrt(np.maximum(ap * ap - x * x, 0.0))
        area = ap * ap * np.arccos(np.clip(x / ap, -1, 1)) + bp * bp * np.arccos(np.clip((cp - x) / bp, -1, 1)) - cp * y
        nu[pen] = 1.0 - area / (math.pi * ap * ap)
    # Tierra más pequeña que el Sol y dentro de su disco (anular): no ocurre
    # para un satélite en órbita baja, pero se cubre por completitud.
    ann = (~umbra) & (c <= np.abs(a - b)) & (a > b)
    nu[ann] = 1.0 - (b[ann] * b[ann]) / (a[ann] * a[ann])
    return nu


def magnitude(rng_km, phase_rad, std_mag=STD_MAG):
    """Magnitud visual aproximada (ver el encabezado del módulo)."""
    f = np.sin(phase_rad) + (math.pi - phase_rad) * np.cos(phase_rad)
    return std_mag - 15.0 + 5.0 * np.log10(rng_km) - 2.5 * np.log10(np.maximum(f, 1e-9))


# ─── Elementos orbitales ─────────────────────────────────────────────────────
def _checksum_ok(line: str) -> bool:
    total = 0
    for ch in line[:68]:
        if ch.isdigit():
            total += int(ch)
        elif ch == "-":
            total += 1
    return len(line) >= 69 and line[68].isdigit() and total % 10 == int(line[68])


def parse_tle(text: str) -> dict:
    """Texto TLE (con o sin línea de nombre) -> {name, line1, line2}. Valida
    longitud, suma de control y que sea la ISS (NORAD 25544)."""
    lines = [ln.rstrip() for ln in (text or "").splitlines() if ln.strip()]
    for i, ln in enumerate(lines):
        if ln.startswith("1 ") and i + 1 < len(lines) and lines[i + 1].startswith("2 "):
            l1, l2 = ln.strip(), lines[i + 1].strip()
            if len(l1) != 69 or len(l2) != 69:
                raise ValueError("TLE con longitud inesperada")
            if not (_checksum_ok(l1) and _checksum_ok(l2)):
                raise ValueError("TLE con suma de control incorrecta")
            if int(l1[2:7]) != NORAD_ID or int(l2[2:7]) != NORAD_ID:
                raise ValueError(f"el TLE no es del objeto {NORAD_ID}")
            name = lines[i - 1].strip() if i > 0 and not lines[i - 1].startswith(("1 ", "2 ")) else "ISS (ZARYA)"
            return {"name": name, "line1": l1, "line2": l2}
    raise ValueError("respuesta sin elementos TLE")


def satrec_of(elements: dict) -> Satrec:
    return Satrec.twoline2rv(elements["line1"], elements["line2"], WGS72)


def epoch_unix(sat: Satrec) -> float:
    return ((sat.jdsatepoch - 2440587.5) + sat.jdsatepochF) * 86400.0


def elements_info(elements: dict, now: float) -> dict:
    """Época, antigüedad y forma de la órbita, para mostrarlas al usuario."""
    sat = satrec_of(elements)
    ep = epoch_unix(sat)
    age_h = max(0.0, (now - ep) / 3600.0)
    mu_n = sat.no_kozai                                   # rad/min
    a_km = sat.a * 6378.135                               # radios terrestres WGS-72 -> km
    return {
        "name": elements["name"],
        "norad_id": NORAD_ID,
        "epoch": iso_utc(ep),
        "age_hours": round(age_h, 1),
        "age_days": round(age_h / 24.0, 2),
        "outdated": age_h / 24.0 > OUTDATED_DAYS,
        "inclination_deg": round(math.degrees(sat.inclo), 2),
        "period_min": round(2 * math.pi / mu_n, 2),
        "perigee_km": round(a_km * (1 - sat.ecco) - 6378.135),
        "apogee_km": round(a_km * (1 + sat.ecco) - 6378.135),
        "source": "CelesTrak",
        "source_url": SOURCE_URL,
    }


# ─── Fuente: CelesTrak ───────────────────────────────────────────────────────
async def _fetch() -> dict:
    headers = {"Accept": "text/plain", **provider_headers()}
    resp = None
    for intento in (1, 2):
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(CELESTRAK_URL, params={"CATNR": NORAD_ID, "FORMAT": "TLE"}, headers=headers)
            break
        except (httpx.ConnectError, httpx.ConnectTimeout):
            # No se llegó a conectar (no cuenta como consulta a CelesTrak): un único reintento
            if intento == 2:
                raise
    status = getattr(resp, "status_code", 200)
    if status == 403 or status == 429:
        raise RuntimeError(f"CelesTrak limitó las peticiones (HTTP {status})")
    if status >= 400:
        raise RuntimeError(f"CelesTrak respondió HTTP {status}")
    try:
        return parse_tle(resp.text)
    except ValueError as e:
        raise RuntimeError(f"CelesTrak devolvió datos inesperados: {e}")


resource = Resource("iss", _fetch, ttl=TTL, wait=20.0, retry_after=RETRY_AFTER)


# ─── Evaluación del cielo en una lista de instantes ──────────────────────────
class Observer:
    def __init__(self, lat: float, lon: float, alt_m: float):
        self.lat, self.lon, self.alt_m = lat, lon, alt_m
        self.ecef = geodetic_to_ecef(lat, lon, alt_m)


def evaluate(sat: Satrec, obs: Observer, unix) -> dict:
    """Para cada instante: altura, azimut, distancia, fracción iluminada de la
    ISS, altura del Sol, ángulo de fase y posición ECEF. Todo con arrays."""
    t = np.atleast_1d(np.asarray(unix, dtype=float))
    jd, fr = jd_split(t)
    err, r, _v = sat.sgp4_array(jd, fr)
    bad = err != 0
    r = np.where(bad[:, None], np.nan, r)
    th = gmst82(jd, fr)
    r_ecef = teme_to_ecef(r, th)
    rel = r_ecef - obs.ecef
    alt, az = look_angles(rel, obs.lat, obs.lon)
    rng = np.linalg.norm(rel, axis=1)
    sun = sun_teme(jd, fr)
    nu = illumination(np.nan_to_num(r, nan=1e5), sun)
    nu = np.where(bad, 0.0, nu)
    sun_ecef = teme_to_ecef(sun, th)
    sun_alt, _ = look_angles(sun_ecef - obs.ecef, obs.lat, obs.lon)
    # ángulo de fase: en la ISS, entre la dirección al Sol y la dirección al observador
    to_sun = sun_ecef - r_ecef
    to_obs = obs.ecef - r_ecef
    cosb = np.einsum("ij,ij->i", to_sun, to_obs) / (np.linalg.norm(to_sun, axis=1) * np.linalg.norm(to_obs, axis=1))
    phase = np.arccos(np.clip(cosb, -1, 1))
    return {"t": t, "alt": alt, "az": az, "rng": rng, "nu": nu, "sun_alt": sun_alt,
            "phase": phase, "r_ecef": r_ecef, "bad": bad}


def _bisect(fn, lo: float, hi: float, iters: int = 20) -> float:
    """fn(t) booleano: falso en `lo`, verdadero en `hi` (o al revés). Devuelve el
    instante del cambio con ~10 s / 2^iters de error."""
    flo = fn(lo)
    for _ in range(iters):
        mid = 0.5 * (lo + hi)
        if fn(mid) == flo:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def _iso_decimas(ts: float) -> str:
    """ISO UTC con décimas de segundo ("2026-11-14T18:19:10.4Z"). La trayectoria las lleva para
    que interpolar entre puntos no cargue con un redondeo de hasta 0,5 s (≈ 0,7° cerca del cenit)."""
    d = round(ts * 10) / 10.0
    whole = int(math.floor(d))
    return f"{iso_utc(whole)[:-1]}.{int(round((d - whole) * 10)) % 10}Z"


def _compass(az: float) -> tuple:
    i = int(((az % 360.0) + 11.25) // 22.5) % 16
    return _COMPASS16_EN[i], _COMPASS16_ES[i]


def _point(ev: dict, i: int = 0, extra: Optional[dict] = None) -> dict:
    az = float(ev["az"][i])
    en, es = _compass(az)
    p = {
        "t": iso_utc(round(float(ev["t"][i]))),
        "alt": round(float(ev["alt"][i]), 1),
        "az": round(az, 1),
        "compass": en,
        "compass_es": es,
    }
    if extra:
        p.update(extra)
    return p


def _culmination(sat, obs, t_lo: float, t_hi: float) -> float:
    """Instante de máxima altura entre t_lo y t_hi (búsqueda de la sección áurea)."""
    g = (math.sqrt(5) - 1) / 2
    a, b = t_lo, t_hi
    c, d = b - g * (b - a), a + g * (b - a)
    fc = float(evaluate(sat, obs, c)["alt"][0])
    fd = float(evaluate(sat, obs, d)["alt"][0])
    for _ in range(28):
        if fc > fd:
            b, d, fd = d, c, fc
            c = b - g * (b - a)
            fc = float(evaluate(sat, obs, c)["alt"][0])
        else:
            a, c, fc = c, d, fd
            d = a + g * (b - a)
            fd = float(evaluate(sat, obs, d)["alt"][0])
    return 0.5 * (a + b)


def compute_passes(elements: dict, lat: float, lon: float, alt_m: float,
                   t_from: float, days: float, std_mag: float = STD_MAG) -> list:
    """Pasadas de la ISS sobre (lat, lon, alt_m) entre t_from y t_from + días.
    Devuelve una lista de diccionarios (ver el contrato en el endpoint)."""
    sat = satrec_of(elements)
    obs = Observer(lat, lon, alt_m)
    t_end = t_from + days * 86400.0
    # Se empieza 10 min antes (una pasada ya empezada se encuentra entera) y se
    # acaba 15 min después (la última pasada no se corta).
    grid = np.arange(t_from - 600.0, t_end + 900.0, GRID_STEP)
    ev = evaluate(sat, obs, grid)
    above = (ev["alt"] > MIN_ALT) & (~ev["bad"])
    d = np.diff(above.astype(np.int8))
    starts = np.where(d == 1)[0] + 1      # primer muestreo por encima
    ends = np.where(d == -1)[0]           # último muestreo por encima
    out = []
    for i0 in starts:
        later = ends[ends >= i0]
        if later.size == 0:
            continue                      # la pasada sigue al final de la rejilla
        i1 = int(later[0])
        if i0 == 0:
            continue
        up = lambda t: bool(evaluate(sat, obs, t)["alt"][0] > MIN_ALT)
        ts = _bisect(up, grid[i0 - 1], grid[i0])
        te = _bisect(up, grid[i1], grid[i1 + 1])
        if ts > t_end or te < t_from:
            continue
        tm = _culmination(sat, obs, grid[max(i0 - 1, 0)], grid[min(i1 + 1, len(grid) - 1)])
        out.append(_build_pass(sat, obs, grid, ev, i0, i1, ts, tm, te, std_mag))
    return out


def _build_pass(sat, obs, grid, ev_grid, i0, i1, ts, tm, te, std_mag) -> dict:
    inner = grid[i0:i1 + 1]
    times = np.concatenate(([ts], inner[(inner > ts) & (inner < te)], [te]))
    times = np.unique(np.concatenate((times, [tm])))
    ev = evaluate(sat, obs, times)
    # en los extremos exactos alt ≈ 10,000: se admite una holgura de 0,01°
    vis = (ev["nu"] >= 0.5) & (ev["sun_alt"] < SUN_VISIBLE_MAX) & (ev["alt"] >= MIN_ALT - 0.01)

    k_max = int(np.argmin(np.abs(times - tm)))
    k_s, k_e = 0, len(times) - 1

    # tramos visibles: se afinan los bordes por bisección sobre la condición de visibilidad
    def vis_at(t):
        e = evaluate(sat, obs, t)
        return bool((e["nu"][0] >= 0.5) and (e["sun_alt"][0] < SUN_VISIBLE_MAX) and (e["alt"][0] >= MIN_ALT - 0.01))

    runs = []
    k = 0
    n = len(times)
    while k < n:
        if vis[k]:
            j = k
            while j + 1 < n and vis[j + 1]:
                j += 1
            t0 = times[k] if k == 0 else _bisect(vis_at, times[k - 1], times[k], 12)
            t1 = times[j] if j == n - 1 else _bisect(vis_at, times[j], times[j + 1], 12)
            runs.append((t0, t1))
            k = j + 1
        else:
            k += 1
    runs = [r for r in runs if r[1] - r[0] >= MIN_VISIBLE_S]

    visible = bool(runs)
    p = {
        "id": iso_utc(round(ts)),
        "start": _point(ev, k_s),
        "max": _point(ev, k_max, {"sun_alt": round(float(ev["sun_alt"][k_max]), 1),
                                  "sunlit": bool(ev["nu"][k_max] >= 0.5)}),
        "end": _point(ev, k_e),
        "duration_s": int(round(te - ts)),
        "max_alt": round(float(ev["alt"][k_max]), 1),
        "visible": visible,
        "visible_from": None,
        "visible_to": None,
        "visible_duration_s": 0,
        "mag": None,
        "why_not_visible": None,
    }
    if visible:
        t0, t1 = max(runs, key=lambda r: r[1] - r[0])
        e2 = evaluate(sat, obs, np.array([t0, t1]))
        p["visible_from"] = _point(e2, 0)
        p["visible_to"] = _point(e2, 1)
        p["visible_duration_s"] = int(round(t1 - t0))
        sel = vis & (times >= t0 - 1e-6) & (times <= t1 + 1e-6)
        if sel.any():
            m = magnitude(ev["rng"][sel], ev["phase"][sel], std_mag)
            p["mag"] = round(float(np.min(m)), 1)
    else:
        lit_any = bool((ev["nu"] >= 0.5).any())
        dark_any = bool((ev["sun_alt"] < SUN_VISIBLE_MAX).any())
        p["why_not_visible"] = "sun_up" if not dark_any else ("iss_in_shadow" if not lit_any else "partial")
    p["track"] = [
        {"t": _iso_decimas(float(times[i])), "alt": round(float(ev["alt"][i]), 1), "az": round(float(ev["az"][i]), 1),
         "lit": bool(ev["nu"][i] >= 0.5)}
        for i in range(n)
    ]
    return p


# ─── API para main.py ────────────────────────────────────────────────────────
_passes_cache: dict = {}          # clave -> (ts, payload)


def _key(lat, lon, alt_m, days, epoch_line):
    return (round(lat, 3), round(lon, 3), int(round(alt_m / 10.0)) * 10, int(days), epoch_line)


async def get_passes(lat: float, lon: float, alt_m: float = 0.0, days: int = DEFAULT_DAYS, tracks: str = "visible") -> dict:
    """Pasadas de la ISS para un lugar. Lanza ProviderError si no hay elementos
    (primera vez y CelesTrak caído); si hay elementos viejos los usa y marca `stale`."""
    elements, stale = await resource.get()
    now = _now()
    lat, lon = round(float(lat), 3), round(float(lon), 3)
    alt_m = float(int(round(alt_m / 10.0)) * 10)
    days = int(days)
    key = _key(lat, lon, alt_m, days, elements["line1"])
    hit = _passes_cache.get(key)
    if hit and now - hit[0] < PASSES_TTL:
        passes, computed = hit[1], hit[0]
    else:
        passes = await asyncio.get_running_loop().run_in_executor(
            None, compute_passes, elements, lat, lon, alt_m, now, float(days))
        computed = now
        if len(_passes_cache) > 300:
            _passes_cache.clear()
        _passes_cache[key] = (now, passes)
    # una pasada ya terminada (si vino de la caché) no se devuelve
    live = [p for p in passes if _iso_to_unix(p["end"]["t"]) >= now]
    # La trayectoria (~40 puntos por pasada) pesa más que todo lo demás: por defecto solo
    # se manda la de las pasadas visibles ("all" las manda todas; "none", ninguna).
    if tracks != "all":
        live = [p if (tracks == "visible" and p["visible"]) else {**p, "track": []} for p in live]
    info = elements_info(elements, now)
    warnings = []
    if info["outdated"]:
        warnings.append("elements_old")
    if stale:
        warnings.append("stale")
    return {
        "source": SOURCE,
        "updated": iso_utc(resource.ts),
        "stale": bool(stale),
        "generated": iso_utc(now),
        "observer": {"lat": lat, "lon": lon, "alt_m": alt_m},
        "window": {"from": iso_utc(now), "to": iso_utc(now + days * 86400), "days": days},
        "rules": {"min_alt_deg": MIN_ALT, "sun_alt_max_deg": SUN_VISIBLE_MAX,
                  "shadow_model": "cónico", "mag_std": STD_MAG},
        "elements": info,
        "warnings": warnings,
        "passes": live,
    }


def _iso_to_unix(s: str) -> float:
    from datetime import datetime, timezone
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
