"""
Trayectoria real de Cassini–Huygens para la animación de entrada (src/intro/cassiniPath.js).

Fuente: JPL Horizons (NASA), cuerpo -82 (Cassini), vectores heliocéntricos en el plano de la
eclíptica (ICRF), cada 3 días entre el lanzamiento y la llegada a Saturno, más los instantes de
cada asistencia gravitatoria. Fechas de las asistencias: NASA, cronología de la misión Cassini
(https://science.nasa.gov/mission/cassini/the-journey/timeline/):
  lanzamiento 15-oct-1997 · Venus 26-abr-1998 · Venus 24-jun-1999 · Tierra 18-ago-1999 ·
  Júpiter 30-dic-2000 · llegada a Saturno 1-jul-2004.

Uso:  python3 scripts/build_intro_cassini.py   (necesita red hacia ssd.jpl.nasa.gov)
"""
import json
import os
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "src", "intro", "cassiniPath.js"))
API = "https://ssd.jpl.nasa.gov/api/horizons.api"
EVENTS = [
    ("earth", "launch", "1997-10-16 00:00"),    # primer instante con efemérides tras el lanzamiento (15-oct 08:43 UT)
    ("venus", "assist", "1998-04-26 13:45"),
    ("venus", "assist", "1999-06-24 20:30"),
    ("earth", "assist", "1999-08-18 03:28"),
    ("jupiter", "assist", "2000-12-30 10:05"),
    ("saturn", "arrival", "2004-07-01 02:48"),
]


def query(extra):
    p = {"format": "text", "COMMAND": "'-82'", "OBJ_DATA": "NO", "MAKE_EPHEM": "YES", "EPHEM_TYPE": "VECTORS",
         "CENTER": "'500@10'", "REF_PLANE": "ECLIPTIC", "REF_SYSTEM": "ICRF", "VEC_TABLE": "1",
         "OUT_UNITS": "AU-D", "CSV_FORMAT": "YES"}
    p.update(extra)
    q = "&".join(f"{k}={urllib.parse.quote(str(v), safe=',.:@-')}" for k, v in p.items())
    with urllib.request.urlopen(f"{API}?{q}", timeout=120) as r:
        t = r.read().decode()
    rows = []
    for ln in t[t.index("$$SOE") + 5: t.index("$$EOE")].strip().splitlines():
        c = [x.strip() for x in ln.split(",")]
        rows.append((float(c[0]), float(c[2]), float(c[3])))
    return rows


def simplify(rows, eps, keep):
    def dist(p, a, b):
        ax, ay, bx, by, px, py = a[1], a[2], b[1], b[2], p[1], p[2]
        dx, dy = bx - ax, by - ay
        L = (dx * dx + dy * dy) or 1e-12
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
        return ((ax + t * dx - px) ** 2 + (ay + t * dy - py) ** 2) ** 0.5
    out = {0, len(rows) - 1} | {i for i, r in enumerate(rows) if round(r[0], 4) in keep}
    stack = [(0, len(rows) - 1)]
    while stack:
        i, j = stack.pop()
        best, k = 0.0, None
        for m in range(i + 1, j):
            d = dist(rows[m], rows[i], rows[j])
            if d > best: best, k = d, m
        if k is not None and best > eps:
            out.add(k); stack += [(i, k), (k, j)]
    idx = sorted(out)
    # entre puntos clave también se respeta la tolerancia
    return [rows[i] for i in idx]


def main():
    rows = query({"START_TIME": "'1997-10-16'", "STOP_TIME": "'2004-07-01 02:48'", "STEP_SIZE": "'3 d'"})
    ev = []
    for body, kind, when in EVENTS:
        jd, x, y = query({"START_TIME": f"'{when}'", "STOP_TIME": f"'{when[:10]} 23:59'", "STEP_SIZE": "'1 d'"})[0]
        rows.append((jd, x, y))
        ev.append({"body": body, "kind": kind, "date": when[:10], "jd": round(jd, 4)})
    rows = sorted(set(rows))
    # simplificación (Douglas–Peucker, 0,004 UA: menos de una décima de píxel en la animación);
    # los instantes de las asistencias se conservan siempre
    keep_jd = {e["jd"] for e in ev}
    rows = simplify(rows, 0.004, keep_jd)
    jd0 = rows[0][0]
    flat = []
    for jd, x, y in rows:
        flat += [round(jd - jd0, 2), round(x, 4), round(y, 4)]
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("// cassiniPath.js — GENERADO por scripts/build_intro_cassini.py (no editar a mano).\n")
        fh.write("// Trayectoria real de Cassini–Huygens (JPL Horizons, cuerpo -82): posición heliocéntrica en el plano de la\n")
        fh.write("// eclíptica, en UA, cada 3 días del 16-oct-1997 al 1-jul-2004, más los instantes de cada asistencia.\n")
        fh.write("// PATH: [días desde el inicio, x, y, …]. EVENTS: lanzamiento, asistencias y llegada (fechas de la NASA).\n")
        fh.write(f"export const JD0 = {jd0};\n")
        fh.write("export const PATH = " + json.dumps(flat) + ";\n")
        fh.write("export const EVENTS = " + json.dumps(ev, ensure_ascii=False) + ";\n")
    print("listo:", OUT, len(rows), "puntos")


if __name__ == "__main__":
    main()
