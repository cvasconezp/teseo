#!/usr/bin/env python3
"""Dónde está en el cielo cada imagen de agencia de src/sky/agencyImages.js (public/agency-sky.json).

Cada página de imagen de ESA/Hubble, ESA/Webb y ESO publica, bajo «Coordinates», el centro (AR y Dec), el campo
(ancho × alto, en minutos de arco) y la orientación («North is X° left/right of vertical»). Con eso la imagen se
dibuja en el cielo en su sitio, a su tamaño y girada como corresponde. Las que no traen coordenadas (imágenes del
EHT, por ejemplo) se quedan solo en la ficha.

Uso: python3 scripts/build_agency_sky.py     (vuelve a leer las páginas; unos 2 s por imagen)
"""
import html, json, os, re, sys, time, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PAGE = {"esa-webb": "https://esawebb.org/images/", "esa-hubble": "https://esahubble.org/images/", "eso": "https://www.eso.org/public/images/"}


def entries():
    s = open(os.path.join(ROOT, "src", "sky", "agencyImages.js"), encoding="utf-8").read()
    s = s[s.index("export const AGENCY_IMAGES"):s.index("export const AGENCY_NONE")]
    return re.findall(r'"([a-z]+:[^"]+)":\s*\{"agency":"([^"]+)","id":"([^"]+)"', s)


def parse(t):
    t = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(t)))
    ra = re.search(r"Position \(RA\):\s*(\d+)\s+(\d+)\s+([\d.]+)", t)
    de = re.search(r"Position \(Dec\):\s*(-?\d+)°\s*(\d+)'\s*([\d.]+)\"", t)
    fov = re.search(r"Field of view:\s*([\d.]+)\s*x\s*([\d.]+)\s*arcminutes", t)
    ori = re.search(r"Orientation:\s*North is\s*([\d.]+)°\s*(left|right) of vertical", t)
    if not (ra and de and fov and ori): return None
    if float(fov.group(1)) <= 0 or float(fov.group(2)) <= 0: return None      # (las del EHT traen campo 0)
    a = (int(ra.group(1)) + int(ra.group(2)) / 60 + float(ra.group(3)) / 3600) * 15
    sign = -1 if de.group(1).strip().startswith("-") else 1
    d = sign * (abs(int(de.group(1))) + int(de.group(2)) / 60 + float(de.group(3)) / 3600)
    north = float(ori.group(1)) * (1 if ori.group(2) == "left" else -1)      # grados a la izquierda (antihorario) de la vertical
    return {"ra": round(a, 5), "dec": round(d, 5), "w": float(fov.group(1)), "h": float(fov.group(2)), "north": north}


if __name__ == "__main__":
    out, miss = [], []
    # además, las imágenes de los campos profundos (capa «Campos profundos», public/deepfields.json)
    extra = [("deepfield:Campo Ultraprofundo del Hubble", "esa-hubble", "heic0406a"), ("deepfield:Campo Profundo del Hubble", "esa-hubble", "opo9601c"),
             ("deepfield:Primer campo profundo del Webb", "esa-webb", "weic2209a"), ("deepfield:Campo Profundo Sur del Hubble", "esa-hubble", "opo9841a")]
    for key, agency, iid in entries() + extra:
        p = None
        for attempt in range(4):        # los servidores devuelven a veces 502: se reintenta con pausa
            try:
                req = urllib.request.Request(PAGE[agency] + iid + "/", headers={"User-Agent": "Mozilla/5.0 teseo-build"})
                p = parse(urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "replace")); break
            except Exception as e:
                if "404" in str(e): break
                time.sleep(3 + 3 * attempt)
        if p: out.append({"key": key, "agency": agency, "id": iid, **p}); print(key, iid, p)
        else: miss.append(key)
        time.sleep(1.0)
    json.dump({"meta": {"source": "Coordenadas, campo y orientación publicados en la página de cada imagen (ESA/Hubble, ESA/Webb, ESO)", "read": time.strftime("%Y-%m-%d"), "without_coordinates": miss}, "images": out},
              open(os.path.join(ROOT, "public", "agency-sky.json"), "w"), ensure_ascii=False, indent=1)
    print(len(out), "con coordenadas;", len(miss), "sin:", miss)
