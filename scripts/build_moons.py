"""
Lunas de otros planetas: órbitas ajustadas a las efemérides de JPL Horizons (NASA).

Para cada luna se piden a Horizons sus posiciones respecto al centro de su planeta (ICRF, km)
durante ±400 días alrededor de la época T0 = 2026-11-16 0 h TDB, con un paso de 1/12 de su
período. Con esas posiciones se ajusta un modelo pequeño y suficiente para dibujarlas:

  · plano de la órbita (normal N, media de r × r' entre muestras consecutivas)
  · radio medio a, excentricidad e y longitud del periapsis ϖ (primer armónico de r)
  · longitud media λ(t) = λ0 + n·t (recta por mínimos cuadrados, con la ecuación del centro quitada)

y se guarda en src/sky/moonsData.js con su error medido frente a Horizons. Aparte se guardan,
en scripts/moons_check.json, posiciones aparentes geocéntricas de Horizons (RA/Dec astrométricas
de la luna y del planeta) en varias fechas para que scripts/test_moons.mjs compare el cálculo
de la app con la NASA.

Magnitud de referencia: la que da Horizons (APmag) en T0, con su distancia al Sol y a la Tierra.

Datos físicos (radio medio): JPL SSD, «Planetary Satellite Physical Parameters»
https://ssd.jpl.nasa.gov/sats/phys_par/ (consultado el 16-nov-2026).

Uso:  python3 scripts/build_moons.py   (necesita red hacia ssd.jpl.nasa.gov)
"""
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_JS = os.path.normpath(os.path.join(HERE, "..", "src", "sky", "moonsData.js"))
OUT_CHECK = os.path.join(HERE, "moons_check.json")
API = "https://ssd.jpl.nasa.gov/api/horizons.api"

T0_JD = 2461360.5            # 2026-11-16 00:00 TDB
WINDOW = 400                 # días a cada lado de T0
CHECK_OFFSETS = [-300, -120, 0.22, 77.6, 210.4, 395.9, 1000.3]   # días desde T0 (el último, fuera del ajuste)

# Hiperión no se incluye: su órbita caótica y en resonancia con Titán deja este modelo con un error del
# ~11 % del radio de la órbita (y con magnitud 14 casi nadie la ve).
# id Horizons, nombre (clave), planeta (clave de BODIES en la app), id del centro del planeta,
# período aproximado (días, solo para elegir el paso), radio medio (km, JPL phys_par)
MOONS = [
    (401, "Phobos", "Marte", 499, 0.31891, 11.08),
    (402, "Deimos", "Marte", 499, 1.26244, 6.2),
    (501, "Io", "Júpiter", 599, 1.769138, 1821.49),
    (502, "Europa", "Júpiter", 599, 3.551181, 1560.80),
    (503, "Ganymede", "Júpiter", 599, 7.154553, 2631.20),
    (504, "Callisto", "Júpiter", 599, 16.689017, 2410.30),
    (601, "Mimas", "Saturno", 699, 0.942422, 198.20),
    (602, "Enceladus", "Saturno", 699, 1.370218, 252.10),
    (603, "Tethys", "Saturno", 699, 1.887802, 531.10),
    (604, "Dione", "Saturno", 699, 2.736916, 561.40),
    (605, "Rhea", "Saturno", 699, 4.517503, 763.50),
    (606, "Titan", "Saturno", 699, 15.945448, 2574.76),
    (608, "Iapetus", "Saturno", 699, 79.331002, 734.30),
    (705, "Miranda", "Urano", 799, 1.413479, 235.8),
    (701, "Ariel", "Urano", 799, 2.520379, 578.9),
    (702, "Umbriel", "Urano", 799, 4.144177, 584.7),
    (703, "Titania", "Urano", 799, 8.705869, 788.9),
    (704, "Oberon", "Urano", 799, 13.463237, 761.4),
    (801, "Triton", "Neptuno", 899, 5.876854, 1352.60),
]


def horizons(params):
    base = {"format": "text", "OBJ_DATA": "NO", "MAKE_EPHEM": "YES", "CSV_FORMAT": "YES"}
    base.update(params)
    q = "&".join(f"{k}={urllib.parse.quote(str(v), safe='@,.:-')}" for k, v in base.items())
    for attempt in range(4):
        try:
            with urllib.request.urlopen(f"{API}?{q}", timeout=120) as r:
                txt = r.read().decode("utf-8", "replace")
            if "$$SOE" not in txt:
                raise RuntimeError(txt[:400])
            return txt[txt.index("$$SOE") + 5: txt.index("$$EOE")].strip().splitlines()
        except Exception as e:                       # noqa: BLE001 — reintento con pausa
            if attempt == 3:
                raise
            print("  reintento:", e, file=sys.stderr)
            time.sleep(4 * (attempt + 1))
    return []


def jd_str(jd):
    return f"JD{jd:.6f}"


def vectors(mid, center, period):
    step_min = max(10, int(period * 1440 / 12))
    lines = horizons({"COMMAND": f"'{mid}'", "EPHEM_TYPE": "VECTORS", "CENTER": f"'500@{center}'",
                      "REF_PLANE": "FRAME", "REF_SYSTEM": "ICRF", "VEC_TABLE": "1", "VEC_CORR": "NONE",
                      "OUT_UNITS": "KM-S", "START_TIME": f"'{jd_str(T0_JD - WINDOW)}'",
                      "STOP_TIME": f"'{jd_str(T0_JD + WINDOW)}'", "STEP_SIZE": f"'{step_min} min'"})
    out = []
    for ln in lines:
        p = [x.strip() for x in ln.split(",")]
        out.append((float(p[0]) - T0_JD, float(p[2]), float(p[3]), float(p[4])))
    return out


def observer(cmd, jds, quantities="1,9,19,20"):
    lines = horizons({"COMMAND": f"'{cmd}'", "EPHEM_TYPE": "OBSERVER", "CENTER": "'500@399'",
                      "QUANTITIES": f"'{quantities}'", "ANG_FORMAT": "DEG", "TIME_TYPE": "UT",
                      "TLIST_TYPE": "JD", "TLIST": " ".join(f"{j:.6f}" for j in jds), "EXTRA_PREC": "YES"})
    rows = []
    for ln in lines:
        p = [x.strip() for x in ln.split(",")]
        rows.append(p)
    return rows


# ── álgebra mínima ──
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def norm(a): return math.sqrt(dot(a, a))
def unit(a): n = norm(a); return (a[0] / n, a[1] / n, a[2] / n)


def linfit(xs, ys):
    n = len(xs); mx = sum(xs) / n; my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs); sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    b = sxy / sxx
    return my - b * mx, b


def fit(samples):
    pts = [(s[1], s[2], s[3]) for s in samples]
    ts = [s[0] for s in samples]
    acc = [0.0, 0.0, 0.0]
    for p, q in zip(pts, pts[1:]):
        c = cross(p, q); acc = [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]]
    N = unit(acc)
    X = unit(cross((0.0, 0.0, 1.0), N))            # nodo ascendente sobre el ecuador ICRF
    Y = cross(N, X)
    th = []
    prev = None; turns = 0.0
    for p in pts:
        a = math.atan2(dot(p, Y), dot(p, X))
        if prev is not None:
            d = a - prev
            if d < -math.pi: turns += 2 * math.pi
            elif d > math.pi: turns -= 2 * math.pi
        prev = a; th.append(a + turns)
    r = [norm(p) for p in pts]
    # 1) recta provisional, 2) e y ϖ con el primer armónico de r, 3) recta con la ecuación del centro quitada
    l0, n = linfit(ts, th)
    for _ in range(3):
        lam = [l0 + n * t for t in ts]
        # r ≈ a + A cos λ + B sin λ  (mínimos cuadrados en 3 parámetros por ecuaciones normales)
        cols = [[1.0] * len(r), [math.cos(x) for x in lam], [math.sin(x) for x in lam]]
        M = [[sum(ci * cj for ci, cj in zip(cols[i], cols[j])) for j in range(3)] for i in range(3)]
        v = [sum(ci * ri for ci, ri in zip(cols[i], r)) for i in range(3)]
        sol = solve3(M, v)
        a, A, B = sol
        e = math.hypot(A, B) / a
        varpi = math.atan2(-B, -A)
        corr = [x - 2 * e * math.sin(x - varpi) for x in th]
        l0, n = linfit(ts, corr)
    # error del modelo frente a Horizons (km) en todas las muestras
    def model(t):
        lam = l0 + n * t
        nu = lam + 2 * e * math.sin(lam - varpi)
        rr = a * (1 - e * math.cos(lam - varpi))
        return tuple(rr * (math.cos(nu) * X[i] + math.sin(nu) * Y[i]) for i in range(3))
    errs = [norm(tuple(m - p for m, p in zip(model(t), pt))) for t, pt in zip(ts, pts)]
    rms = math.sqrt(sum(x * x for x in errs) / len(errs))
    return {"N": N, "X": X, "a": a, "e": e, "varpi": varpi, "l0": l0, "n": n,
            "rms_km": rms, "max_km": max(errs), "samples": len(pts)}


def solve3(M, v):
    import copy
    A = copy.deepcopy(M); b = list(v)
    for i in range(3):
        piv = max(range(i, 3), key=lambda k: abs(A[k][i]))
        A[i], A[piv] = A[piv], A[i]; b[i], b[piv] = b[piv], b[i]
        for k in range(i + 1, 3):
            f = A[k][i] / A[i][i]
            for j in range(i, 3): A[k][j] -= f * A[i][j]
            b[k] -= f * b[i]
    x = [0.0, 0.0, 0.0]
    for i in (2, 1, 0):
        x[i] = (b[i] - sum(A[i][j] * x[j] for j in range(i + 1, 3))) / A[i][i]
    return x


def main():
    out = []
    check = {"epoch_jd_ut": [], "moons": {}}
    jds = [T0_JD + d for d in CHECK_OFFSETS]
    check["epoch_jd_ut"] = jds
    planets_done = {}
    for mid, key, parent, center, period, radius in MOONS:
        print(f"{key}…", file=sys.stderr)
        f = fit(vectors(mid, center, period))
        # magnitud de referencia (Horizons APmag) en T0, con r (UA) y Δ (UA)
        obs = observer(str(mid), [T0_JD], "9,19,20")[0]
        # columnas: fecha, sol, luna, APmag, S-brt, r, rdot, delta, deldot
        mag, r_au, d_au = float(obs[3]), float(obs[5]), float(obs[7])
        # comprobación: RA/Dec astrométricas de la luna y del planeta
        mo = observer(str(mid), jds, "1")
        if center not in planets_done:
            planets_done[center] = observer(str(center), jds, "1")
        pl = planets_done[center]
        check["moons"][key] = [[float(m[3]), float(m[4]), float(p[3]), float(p[4])] for m, p in zip(mo, pl)]
        out.append({"key": key, "id": mid, "parent": parent, "radius_km": radius,
                    "a_km": round(f["a"], 1), "e": round(f["e"], 5), "varpi": round(f["varpi"], 6),
                    "l0": round(f["l0"], 7), "n": round(f["n"], 10),
                    "N": [round(x, 7) for x in f["N"]], "X": [round(x, 7) for x in f["X"]],
                    "mag": round(mag, 2), "r_au": round(r_au, 5), "d_au": round(d_au, 5),
                    "rms_km": round(f["rms_km"], 1), "max_km": round(f["max_km"], 1), "samples": f["samples"]})
        print(f"  a={f['a']:.0f} km e={f['e']:.4f} rms={f['rms_km']:.0f} km ({100 * f['rms_km'] / f['a']:.2f} % de a), mag {mag}", file=sys.stderr)

    head = (
        "// moonsData.js — GENERADO por scripts/build_moons.py (no editar a mano).\n"
        "// Órbitas de las lunas ajustadas a JPL Horizons (NASA) en ±400 días alrededor de T0 = 2026-11-16 0 h TDB.\n"
        "// Posición respecto al centro del planeta, en el marco ICRF (km):\n"
        "//   λ = l0 + n·t (rad, t en días desde T0) · ν = λ + 2e·sen(λ − ϖ) · r = a(1 − e·cos(λ − ϖ))\n"
        "//   pos = r·(cos ν · X + sen ν · Y), con Y = N × X (N: normal de la órbita; X: su nodo en el ecuador ICRF)\n"
        "// rms_km / max_km: error del modelo frente a Horizons en las muestras del ajuste.\n"
        "// mag, r_au, d_au: magnitud aparente de Horizons en T0 y sus distancias al Sol y a la Tierra (UA).\n"
        "// radius_km: radio medio, JPL SSD «Planetary Satellite Physical Parameters».\n"
    )
    with open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write(head)
        fh.write(f"export const MOON_T0_JD = {T0_JD};\n")
        fh.write("export const MOON_ORBITS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
    with open(OUT_CHECK, "w", encoding="utf-8") as fh:
        json.dump(check, fh, indent=1)
    print("listo:", OUT_JS, OUT_CHECK, file=sys.stderr)


if __name__ == "__main__":
    main()
