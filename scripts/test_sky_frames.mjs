// Pruebas de los MARCOS del Cielo (src/sky/frames.js, look.js → localSkyQuatJ2000, objVisibility.js) frente a
// astropy: precesión de los cuerpos a J2000 (el marco de las estrellas), estrellas J2000 llevadas al horizonte
// con la precesión hasta la fecha, y paralaje topocéntrica de la Luna en «Mi cielo».
// Uso:  node scripts/test_sky_frames.mjs     (sale con código 1 si algo falla)
//
// «Lo que dibuja el Cielo» se reproduce con las mismas funciones puras que usa src/Constellations.jsx:
//   · estrella: vector de public/sky.json, girado con ref.localQuat (antes localSkyQuat; ahora localSkyQuatJ2000);
//   · Sol, Luna y planetas: sprite en (nx, ny, nz) dentro de solarGroup, girado con el mismo cuaternión; antes
//     nx… = ephemeris() (fecha, geocéntrico); ahora nx… = skyBodies(…, lugar) (J2000, topocéntrico).
// Se compara la altura/azimut resultante con astropy y se imprime el error ANTES y DESPUÉS del cambio.
//
// Referencias (REF, abajo) generadas el 14-nov-2026 con astropy 5.3.4 (efemérides "builtin": ERFA/ELP2000
// truncada, ~10″ en la Luna) y este script (/home/claude/venv-teseo/bin/python ref_sky_frames.py):
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// import numpy as np, warnings, json
// warnings.filterwarnings("ignore")
// from astropy.utils import iers
// iers.conf.auto_download = False                 # sin descargas: UT1−UTC ≈ 0 (< 0,9 s → < 0,004°)
// iers.conf.iers_degraded_accuracy = "ignore"
// from astropy.time import Time
// from astropy.coordinates import SkyCoord, EarthLocation, AltAz, get_body, solar_system_ephemeris
// import astropy.units as u
// sky = json.load(open("/home/claude/teseo/public/sky.json"))
// byname = {s[7]: s for s in sky["stars"] if len(s) > 7 and s[7]}
// # movimientos propios (mas/año, μα·cosδ y μδ), Hipparcos (van Leeuwen 2007), redondeados
// PM = {"Vega": (200.94, 286.23), "Sirius": (-546.01, -1223.07), "Polaris": (44.48, -11.85),
//       "Betelgeuse": (27.54, 11.30), "Antares": (-12.11, -23.30), "Regulus": (-248.73, 5.59)}
// loc = EarthLocation(lat=-0.2200*u.deg, lon=-78.5125*u.deg, height=2850*u.m)   # Quito
// DATES = ["2026-11-14T04:00:00", "2027-05-21T09:20:00", "2027-07-27T00:00:00", "2027-08-11T03:40:00"]
// out = {"stars": {}, "bodies": {}, "sep": {}, "moonRiseSet": {}}
// def star(name, t):
//     s = byname[name]; ra = np.degrees(np.arctan2(s[2], s[1])) % 360; dec = np.degrees(np.arcsin(s[3]))
//     c = SkyCoord(ra=ra*u.deg, dec=dec*u.deg, distance=max(s[6], 1)*0.306601*u.pc, pm_ra_cosdec=PM[name][0]*u.mas/u.yr,
//                  pm_dec=PM[name][1]*u.mas/u.yr, radial_velocity=0*u.km/u.s, frame="icrs", obstime=Time("J2000"))
//     return c.apply_space_motion(new_obstime=t)
// with solar_system_ephemeris.set("builtin"):
//     for d in DATES:
//         t = Time(d, scale="utc"); fr = AltAz(obstime=t, location=loc, pressure=0*u.hPa)   # sin refracción
//         out["stars"][d] = {n: [round(float(a.alt.deg), 5), round(float(a.az.deg), 5)] for n in PM for a in [star(n, t).transform_to(fr)]}
//         out["bodies"][d] = {}
//         for b in ["moon", "jupiter", "venus"]:
//             a = get_body(b, t, loc).transform_to(fr)
//             out["bodies"][d][b] = [round(float(a.alt.deg), 5), round(float(a.az.deg), 5)]
//         # separaciones topocéntricas: Luna–Antares y Júpiter–Régulo
//         mo = get_body("moon", t, loc).transform_to(fr); ju = get_body("jupiter", t, loc).transform_to(fr)
//         out["sep"][d] = {"moon-Antares": round(float(mo.separation(star("Antares", t).transform_to(fr)).deg), 5),
//                          "jupiter-Regulus": round(float(ju.separation(star("Regulus", t).transform_to(fr)).deg), 5)}
//     # salida y puesta de la Luna (borde superior a −34′ de altura geométrica topocéntrica) en Quito
//     for d0 in ["2026-11-13T02:00:00", "2027-05-20T12:00:00"]:
//         t = Time(d0) + np.arange(0, 36*60*2) * 30*u.s
//         fr = AltAz(obstime=t, location=loc, pressure=0*u.hPa)
//         mo = get_body("moon", t, loc).transform_to(fr)
//         sd = np.degrees(np.arcsin(1737.4 / mo.distance.to(u.km).value))
//         f = mo.alt.deg - (-0.5667 - sd)
//         ev = []
//         for i in np.where(np.sign(f[:-1]) != np.sign(f[1:]))[0]:
//             k = f[i] / (f[i] - f[i+1]); tt = t[i] + k * 30*u.s
//             ev.append(["rise" if f[i] < 0 else "set", tt.isot[:19] + "Z"])
//         out["moonRiseSet"][d0] = ev
// print(json.dumps(out, indent=1))
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// Las fechas se eligieron con astropy: 2027-05-21 09:20 UTC y 2027-08-11 03:40 UTC, la Luna a 0,29° y 0,43°
// de Antares vista desde Quito (la mayor aproximación con los dos sobre el horizonte y de noche, nov-2026 a
// dic-2027); 2027-07-27 00:00 UTC, Júpiter a 0,44° de Régulo.
// Lo que el Cielo NO modela (y por eso se tolera): nutación (≤ 17″), aberración anual (≤ 20,5″), movimiento
// propio (Sirio 0,01° en 2026–2027) y el error de las efemérides de Schlyter (planetas ~1–2′; Luna ≤ 0,056°
// frente a Horizons, scripts/test_moon_ephemeris.mjs).
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { ephemeris } from "../src/ephemeris.js";
import {
  precessionMatrix, precessionAngles, j2000ToDate, dateToJ2000, altAzJ2000, observerRho, topocentric, skyBodies,
} from "../src/sky/frames.js";
import { localSkyQuat, localSkyQuatJ2000, precessionQuat } from "../src/sky/look.js";
import { riseTransitSet, H0_MOON, moonH0 } from "../src/sky/riseset.js";
import { altAz, gmstRad } from "../src/sky/guide.js";
import { visibilityOf } from "../src/sky/objVisibility.js";
import { altAzToEquatorial, altAzToLocal } from "../src/sky/issSky.js";
import { ECL_NORTH_POLE, distToGreatCircleDeg } from "../src/sky/guides.js";
import { GuidesLayer } from "../src/sky/guidesLayer.js";
import { computeTonight } from "../src/sky/tonight.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => {
  if (cond) { passed++; console.log(`  ok    ${name}${detail ? "  · " + detail : ""}`); }
  else { failed++; console.log(`  FALLA ${name} ${detail}`); }
};
const D = Math.PI / 180;
const f3 = (x) => x.toFixed(3), f4 = (x) => x.toFixed(4);
const sky = JSON.parse(readFileSync(new URL("../public/sky.json", import.meta.url), "utf8"));
const STAR = new Map(sky.stars.filter((s) => s[7]).map((s) => [s[7], [s[1], s[2], s[3]]]));
const QUITO = { lat: -0.2200, lon: -78.5125, elev: 2850 };
const NAMES = { moon: "Luna", jupiter: "Júpiter", venus: "Venus" };

// referencias de astropy (ver el script de arriba): [altura, azimut] en grados; separaciones en grados
const REF = {
  stars: {
    "2026-11-14T04:00:00": { Vega: [-19.60199, 311.60251], Sirius: [22.20726, 108.04314], Polaris: [0.37654, 0.13405], Betelgeuse: [35.22401, 80.75543], Antares: [-48.49799, 227.35207], Regulus: [-27.09976, 76.79555] },
    "2027-05-21T09:20:00": { Vega: [46.55327, 336.25745], Sirius: [-64.94213, 133.54454], Polaris: [-0.39221, 0.58691], Betelgeuse: [-58.14464, 76.21868], Antares: [33.12607, 237.98305], Regulus: [-56.02042, 291.1725] },
    "2027-07-27T00:00:00": { Vega: [27.43238, 44.91433], Sirius: [-32.63173, 249.83471], Polaris: [-0.83439, 359.98754], Betelgeuse: [-46.31039, 280.53026], Antares: [56.35095, 143.06606], Regulus: [16.10829, 282.38866] },
    "2027-08-11T03:40:00": { Vega: [48.1661, 340.73924], Sirius: [-67.94582, 140.99654], Polaris: [-0.44392, 0.57228], Betelgeuse: [-62.41325, 74.26086], Antares: [36.8312, 236.32526], Regulus: [-51.88152, 289.10435] },
  },
  bodies: {
    "2026-11-14T04:00:00": { moon: [-16.47497, 243.14358], jupiter: [-22.80998, 75.26809], venus: [-72.31102, 127.29769] },
    "2027-05-21T09:20:00": { moon: [33.04902, 237.65382], jupiter: [-63.49009, 307.57347], venus: [-5.67283, 77.22912] },
    "2027-07-27T00:00:00": { moon: [-67.83795, 33.00131], jupiter: [16.18537, 282.84377], venus: [-13.35322, 291.6592] },
    "2027-08-11T03:40:00": { moon: [36.69421, 235.82141], jupiter: [-49.06644, 286.86822], venus: [-60.41947, 304.86404] },
  },
  sep: {
    "2027-05-21T09:20:00": { "moon-Antares": 0.2864 },
    "2027-07-27T00:00:00": { "jupiter-Regulus": 0.4439 },
    "2027-08-11T03:40:00": { "moon-Antares": 0.42626 },
  },
  moonRiseSet: {
    "2026-11-13T02:00:00": [["rise", "2026-11-13T14:22:42Z"], ["set", "2026-11-14T02:47:40Z"]],
    "2027-05-20T12:00:00": [["rise", "2027-05-20T23:32:31Z"], ["set", "2027-05-21T11:58:57Z"]],
  },
};

// ── «lo que dibuja el Cielo» ──
// dirección de la escena (mundo J2000, o "fecha" en el código anterior) girada con el cuaternión de «Mi cielo»
// → vector local (+X este, +Y cenit, −Z norte) → altura/azimut
const drawnAltAz = (v, q) => {
  const w = new THREE.Vector3(v[0], v[1], v[2]).normalize().applyQuaternion(q);
  return { alt: Math.asin(Math.max(-1, Math.min(1, w.y))) / D, az: ((Math.atan2(w.x, -w.z) / D) % 360 + 360) % 360, v: [w.x, w.y, w.z] };
};
const sepAltAz = (a, b) => {   // b = [alt, az]
  const c = Math.sin(a.alt * D) * Math.sin(b[0] * D) + Math.cos(a.alt * D) * Math.cos(b[0] * D) * Math.cos((a.az - b[1]) * D);
  return Math.acos(Math.max(-1, Math.min(1, c))) / D;
};
// separación entre dos direcciones (no hace falta que sean unitarias: ephemeris() redondea a 5 decimales);
// con atan2(|a×b|, a·b), estable también para ángulos muy pequeños
const sepVec = (a, b) => {
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return Math.atan2(Math.hypot(c[0], c[1], c[2]), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / D;
};
// antes: estrellas y cuerpos girados con localSkyQuat (tiempo sidéreo de la fecha, sin precesión), cuerpos de
// ephemeris() tal cual (fecha, geocéntricos). Después: localSkyQuatJ2000 y skyBodies con el lugar.
const scene = (iso) => {
  const date = new Date(iso + "Z");
  const eph = ephemeris(date);
  return {
    date,
    before: { q: localSkyQuat(QUITO.lat, QUITO.lon, date), body: (n) => { const b = eph.find((x) => x.name === n); return [b.nx, b.ny, b.nz]; } },
    after: { q: localSkyQuatJ2000(QUITO.lat, QUITO.lon, date), bodies: skyBodies(eph, date, QUITO), body(n) { const b = this.bodies.find((x) => x.name === n); return [b.nx, b.ny, b.nz]; } },
  };
};

console.log("Precesión IAU 1976 (Meeus, cap. 21)");
{
  // Meeus, ejemplo 21.b: θ Persei, J2000 con movimiento propio ya aplicado hasta 2028-11-13.19 TD
  // (α0 = 2h44m12,975s, δ0 = +49°13′39,896″) → α = 2h46m11,331s, δ = +49°20′54,54″ (equinoccio de la fecha)
  const date = new Date((2462088.69 - 2440587.5) * 86400000);
  const a0 = (2 + 44 / 60 + 12.975 / 3600) * 15, d0 = 49 + 13 / 60 + 39.896 / 3600;
  const v = j2000ToDate([Math.cos(d0 * D) * Math.cos(a0 * D), Math.cos(d0 * D) * Math.sin(a0 * D), Math.sin(d0 * D)], date);
  const ra = (Math.atan2(v[1], v[0]) / D + 360) % 360, dec = Math.asin(v[2]) / D;
  const aE = (2 + 46 / 60 + 11.331 / 3600) * 15, dE = 49 + 20 / 60 + 54.54 / 3600;
  const dA = (ra - aE) * 3600 * Math.cos(dE * D), dD = (dec - dE) * 3600;
  ok(Math.abs(dA) < 0.2 && Math.abs(dD) < 0.2, "ejemplo 21.b de Meeus (θ Persei, 2028): α y δ a < 0,2″", `Δα·cosδ ${dA.toFixed(3)}″, Δδ ${dD.toFixed(3)}″`);
  const ang = precessionAngles(date), T = (2462088.69 - 2451545) / 36525;
  ok(Math.abs(T - 0.2886705) < 1e-6 && Math.abs(ang.zeta / D * 3600 - (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3)) < 1e-9, "ζ, z, θ según la ec. 21.2 (t en siglos desde J2000)");
  const P = precessionMatrix(new Date("2026-11-14T04:00:00Z"));
  let orth = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += P[i][k] * P[j][k]; orth = Math.max(orth, Math.abs(s - (i === j ? 1 : 0))); }
  ok(orth < 1e-14, "P es una rotación (P·Pᵀ = I)", orth.toExponential(1));
  const I = precessionMatrix(new Date("2000-01-01T12:00:00Z"));
  ok(Math.abs(I[0][0] - 1) < 1e-15 && Math.abs(I[0][1]) < 1e-15 && Math.abs(I[2][2] - 1) < 1e-15, "en J2000.0 la precesión es la identidad");
  const v0 = [0.3, -0.5, Math.sqrt(1 - 0.34)], w = dateToJ2000(j2000ToDate(v0, date), date);
  ok(sepVec(v0, w) < 1e-10, "dateToJ2000 deshace j2000ToDate");
  // magnitud del efecto en 2026: ~0,37° (50,3″/año × 26,9 años)
  const vern = j2000ToDate([1, 0, 0], new Date("2026-11-14T04:00:00Z"));
  ok(Math.abs(sepVec([1, 0, 0], vern) - 0.37) < 0.02, "el punto vernal J2000 se ha desplazado ~0,37° en 2026", f4(sepVec([1, 0, 0], vern)) + "°");
  // el cuaternión de three = la matriz
  const q = precessionQuat(new Date("2026-11-14T04:00:00Z")), t = new THREE.Vector3(...v0).applyQuaternion(q), m = j2000ToDate(v0, new Date("2026-11-14T04:00:00Z"));
  ok(Math.hypot(t.x - m[0], t.y - m[1], t.z - m[2]) < 1e-12, "precessionQuat (look.js) aplica la misma rotación que la matriz");
}

console.log("Paralaje topocéntrica (Meeus, cap. 11 y 40)");
{
  // Meeus, ejemplo 11.a: Observatorio de Monte Palomar, φ = +33°21′22″, H = 1706 m → ρ sen φ′ = 0,546861, ρ cos φ′ = 0,836339
  const r = observerRho(33 + 21 / 60 + 22 / 3600, 1706);
  ok(Math.abs(r.rhoSin - 0.546861) < 2e-6 && Math.abs(r.rhoCos - 0.836339) < 2e-6, "ejemplo 11.a (Palomar): ρ sen φ′ y ρ cos φ′", `${r.rhoSin.toFixed(6)}, ${r.rhoCos.toFixed(6)}`);
  // Meeus, ejemplo 40.a: Marte desde Palomar, 2003-08-28 3h17m UT, α = 22h38m07,25s, δ = −15°46′15,9″, Δ = 0,37276 UA,
  // L = 7h47m27s O → α′ = 22h38m08,54s, δ′ = −15°46′30,0″ (Meeus usa el tiempo sidéreo aparente; aquí el medio: < 0,02″)
  const date = new Date("2003-08-28T03:17:00Z"), a = (22 + 38 / 60 + 7.25 / 3600) * 15, d = -(15 + 46 / 60 + 15.9 / 3600);
  const tp = topocentric([Math.cos(d * D) * Math.cos(a * D), Math.cos(d * D) * Math.sin(a * D), Math.sin(d * D)], 0.37276 * 149597870.7,
    33 + 21 / 60 + 22 / 3600, -(7 + 47 / 60 + 27 / 3600) * 15, 1706, date);
  const ra = (Math.atan2(tp.dir[1], tp.dir[0]) / D + 360) % 360, dec = Math.asin(tp.dir[2]) / D;
  const dA = (ra - (22 + 38 / 60 + 8.54 / 3600) * 15) * 3600 * Math.cos(dec * D), dD = (dec + (15 + 46 / 60 + 30.0 / 3600)) * 3600;
  ok(Math.abs(dA) < 0.2 && Math.abs(dD) < 0.2, "ejemplo 40.a (Marte desde Palomar): α′ y δ′ a < 0,2″", `Δα·cosδ ${dA.toFixed(3)}″, Δδ ${dD.toFixed(3)}″`);
  // la Luna en el horizonte: la paralaje la baja ~π ≈ 0,95°; en el cenit no la mueve
  const moonGeo = [1, 0, 0], lst = gmstRad(date);
  const zen = [Math.cos(lst), Math.sin(lst), 0];   // cenit de un observador en el ecuador y lon 0
  const atZen = topocentric(zen, 384400, 0, 0, 0, date), hor = topocentric([-Math.sin(lst), Math.cos(lst), 0], 384400, 0, 0, 0, date);
  ok(sepVec(atZen.dir, zen) < 1e-9 && Math.abs(sepVec(hor.dir, [-Math.sin(lst), Math.cos(lst), 0]) - Math.asin(6378.14 / 384400) / D) < 0.002,
    "Luna en el cenit: sin desplazamiento; en el horizonte: π = asen(R/Δ) ≈ 0,95°", f4(sepVec(hor.dir, [-Math.sin(lst), Math.cos(lst), 0])) + "°");
  void moonGeo;
}

console.log("Altura y azimut dibujados en «Mi cielo» frente a astropy (Quito, 2.850 m)");
const worst = { starB: 0, starA: 0, planB: 0, planA: 0, moonB: 0, moonA: 0 };
for (const iso of Object.keys(REF.stars)) {
  const S = scene(iso), cells = [];
  for (const [n, r] of Object.entries(REF.stars[iso])) {
    const v = STAR.get(n), eb = sepAltAz(drawnAltAz(v, S.before.q), r), ea = sepAltAz(drawnAltAz(v, S.after.q), r);
    worst.starB = Math.max(worst.starB, eb); worst.starA = Math.max(worst.starA, ea);
    cells.push(`${n} ${f3(eb)}→${f3(ea)}`);
  }
  for (const [k, r] of Object.entries(REF.bodies[iso])) {
    const eb = sepAltAz(drawnAltAz(S.before.body(NAMES[k]), S.before.q), r), ea = sepAltAz(drawnAltAz(S.after.body(NAMES[k]), S.after.q), r);
    if (k === "moon") { worst.moonB = Math.max(worst.moonB, eb); worst.moonA = Math.max(worst.moonA, ea); }
    else { worst.planB = Math.max(worst.planB, eb); worst.planA = Math.max(worst.planA, ea); }
    cells.push(`${NAMES[k]} ${f3(eb)}→${f3(ea)}`);
  }
  console.log(`        ${iso}Z  error (°) antes→después: ${cells.join(" · ")}`);
}
ok(worst.starA <= 0.05, "estrellas (Vega, Sirio, Polaris, Betelgeuse, Antares, Régulo; 4 fechas): error ≤ 0,05°", `antes ${f3(worst.starB)}° → después ${f3(worst.starA)}°`);
ok(worst.starB > 0.15, "… (antes, sin precesión, las estrellas erraban > 0,15°: lo que se corrige)", `${f3(worst.starB)}°`);
ok(worst.planA <= 0.1 + 0.05, "Júpiter y Venus: ≤ 0,1° + error de la efeméride (Schlyter, ≤ 0,05°)", `antes ${f3(worst.planB)}° → después ${f3(worst.planA)}°`);
ok(worst.moonA <= 0.3, "Luna topocéntrica: ≤ 0,3°", `antes ${f3(worst.moonB)}° → después ${f3(worst.moonA)}°`);
ok(worst.moonB > 0.3, "… (antes, geocéntrica, la Luna erraba hasta ~0,9°)", `${f3(worst.moonB)}°`);

console.log("Planetas y Luna entre las estrellas: separaciones dibujadas frente a astropy");
{
  for (const [iso, pairs] of Object.entries(REF.sep)) {
    const S = scene(iso);
    for (const [pair, r] of Object.entries(pairs)) {
      const [bk, sn] = pair.split("-");
      const st = STAR.get(sn);
      const sb = sepVec(drawnAltAz(S.before.body(NAMES[bk]), S.before.q).v, drawnAltAz(st, S.before.q).v);
      const sa = sepVec(drawnAltAz(S.after.body(NAMES[bk]), S.after.q).v, drawnAltAz(st, S.after.q).v);
      // tolerancia: 0,05° + error de la efeméride (Luna ≤ 0,056° frente a Horizons; planetas ≤ 0,05°)
      const tol = 0.05 + (bk === "moon" ? 0.06 : 0.05);
      ok(Math.abs(sa - r) <= tol, `${iso.slice(0, 10)}: ${NAMES[bk]}–${sn} = ${f3(r)}° (astropy)`, `dibujada antes ${f3(sb)}° (error ${f3(Math.abs(sb - r))}°) → después ${f3(sa)}° (error ${f3(Math.abs(sa - r))}°), tolerancia ${f3(tol)}°`);
    }
  }
}

console.log("Coherencia: ficha, aviso «Encuéntralo» y escena dicen la misma altura");
{
  const iso = "2027-05-21T09:20:00", S = scene(iso), local = { lat: QUITO.lat, lon: QUITO.lon, elev: QUITO.elev };
  // estrella: la ficha precesa el vector J2000 a la fecha; la escena lo gira con localSkyQuatJ2000
  const v = STAR.get("Antares"), vis = visibilityOf({ layer: "star", name: "Antares", nx: v[0], ny: v[1], nz: v[2] }, local, S.date), dr = drawnAltAz(v, S.after.q);
  ok(Math.abs(vis.now.alt - dr.alt) < 1e-4 && Math.abs(vis.now.az - dr.az) < 1e-4, "estrella: altura/azimut de la ficha = dibujados", `${f4(vis.now.alt)}° / ${f4(dr.alt)}°`);
  const aj = altAzJ2000(v[0], v[1], v[2], QUITO.lat, QUITO.lon, S.date);
  ok(Math.abs(aj.alt - dr.alt) < 1e-4, "altAzJ2000 (frames.js) = lo dibujado");
  // Luna: la ficha da la altura topocéntrica, la que se dibuja
  const mo = S.after.bodies.find((b) => b.name === "Luna"), vm = visibilityOf({ ...mo, layer: "solar" }, local, S.date), dm = drawnAltAz([mo.nx, mo.ny, mo.nz], S.after.q);
  ok(Math.abs(vm.now.alt - dm.alt) < 0.002 && Math.abs(vm.now.az - dm.az) < 0.002, "Luna: altura/azimut de la ficha = dibujados (topocéntricos)", `${f4(vm.now.alt)}° / ${f4(dm.alt)}° (astropy ${REF.bodies[iso].moon[0]}°)`);
  // eqDate (para altAz de la fecha) = nx… (J2000) precesado
  const ed = altAz(mo.eqDate[0], mo.eqDate[1], mo.eqDate[2], QUITO.lat, QUITO.lon, S.date);
  ok(Math.abs(ed.alt - dm.alt) < 1e-4, "skyBodies: eqDate y nx/ny/nz son la misma dirección en dos marcos");
  // sin lugar (fuera de «Mi cielo»): geocéntricos, solo precesados
  const geo = skyBodies(ephemeris(S.date), S.date, null).find((b) => b.name === "Luna"), raw = ephemeris(S.date).find((b) => b.name === "Luna");
  // (ephemeris() redondea nx… a 5 decimales: ~0,0006°)
  ok(!geo.topo && sepVec(j2000ToDate([geo.nx, geo.ny, geo.nz], S.date), [raw.nx, raw.ny, raw.nz]) < 0.002, "sin lugar: Luna geocéntrica, solo precesada a J2000");
}

console.log("Salida y puesta de la Luna (Quito) frente a astropy: borde superior a −34′, topocéntrico");
{
  const at = (d) => ephemeris(d).find((b) => b.name === "Luna");
  const dirAt = (d) => { const b = at(d); return [b.nx, b.ny, b.nz]; };
  let wB = 0, wA = 0;
  for (const [iso, evs] of Object.entries(REF.moonRiseSet)) {
    const from = new Date(iso + "Z");
    const before = riseTransitSet(dirAt, QUITO.lat, QUITO.lon, from, { minAlt: H0_MOON });
    const after = riseTransitSet(dirAt, QUITO.lat, QUITO.lon, from, { minAlt: (ms) => moonH0(at(new Date(ms)).dist_km) });
    for (const [kind, t] of evs) {
      const ref = Date.parse(t), b = before[kind], a = after[kind];
      const eb = Math.abs(b.date - ref) / 1000, ea = Math.abs(a.date - ref) / 1000;
      wB = Math.max(wB, eb); wA = Math.max(wA, ea);
      console.log(`        ${kind === "rise" ? "salida" : "puesta"} ${t}: antes ${eb.toFixed(0)} s, después ${ea.toFixed(0)} s`);
    }
  }
  ok(wA <= 60, "salidas y puestas de la Luna a ≤ 1 min de astropy (h0 = 0,7275·π − 0,5667°, Meeus cap. 15)", `peor antes ${wB.toFixed(0)} s → después ${wA.toFixed(0)} s`);
  ok(Math.abs(moonH0(384400) - (0.7275 * 0.9507 - 0.5667)) < 0.001 && moonH0(356500) > moonH0(406700), "moonH0: +0,125° a la distancia media; mayor en el perigeo", `${f4(moonH0(356500))}° … ${f4(moonH0(406700))}°`);
}

console.log("ISS, eclíptica y guías en el mismo marco que las estrellas");
{
  // la ISS llega en altura/azimut de la fecha; las estrellas se giran con localSkyQuatJ2000. Una estrella en
  // la misma dirección (fecha → J2000) debe caer exactamente en el mismo punto que la ISS dibujada.
  let w = 0;
  for (const [alt, az, iso] of [[12, 30, "2026-11-15T17:31:13Z"], [78.4, 211, "2026-11-15T17:34:00Z"], [40, 300, "2027-05-21T09:20:00Z"]]) {
    const date = new Date(iso), eqD = altAzToEquatorial(alt, az, QUITO.lat, QUITO.lon, date), j2 = dateToJ2000(eqD, date);
    const l = drawnAltAz(j2, localSkyQuatJ2000(QUITO.lat, QUITO.lon, date)).v;
    w = Math.max(w, sepVec(l, altAzToLocal(alt, az)));
  }
  ok(w < 1e-5, "un punto de la ISS y una estrella J2000 en esa dirección coinciden en la escena", w.toExponential(1) + "°");
  // el Sol, precesado a J2000 como se dibuja, sobre la eclíptica J2000 dibujada (< 0,01°)
  let ws = 0;
  for (const iso of ["2026-01-15T00:00:00Z", "2026-03-20T15:00:00Z", "2026-06-21T08:00:00Z", "2026-11-14T04:00:00Z", "2027-05-21T09:20:00Z", "2035-07-04T00:00:00Z"]) {
    const d = new Date(iso), s = skyBodies(ephemeris(d), d, null).find((b) => b.name === "Sol");
    ws = Math.max(ws, distToGreatCircleDeg([s.nx, s.ny, s.nz], ECL_NORTH_POLE));
  }
  ok(ws < 0.01, "el Sol dibujado (J2000) está a < 0,01° de la eclíptica J2000", `peor ${ws.toFixed(5)}°`);
  // guías: eclíptica/galáctico con el cuaternión de las estrellas; ecuador y polos de la fecha
  const date = new Date("2026-11-14T04:00:00Z"), qJ = localSkyQuatJ2000(QUITO.lat, QUITO.lon, date), qD = localSkyQuat(QUITO.lat, QUITO.lon, date);
  const layer = new GuidesLayer({ radius: 900 }); layer.setLocalFrame(qJ, qD);
  const ncp = new THREE.Vector3(0, 0, 900).applyMatrix4(layer.eqDate.matrixWorld).normalize();
  const alt = Math.asin(ncp.y) / D, az = ((Math.atan2(ncp.x, -ncp.z) / D) + 360) % 360;
  ok(Math.abs(alt - QUITO.lat) < 1e-4 && (az < 1e-3 || az > 360 - 1e-3), "el polo norte celeste dibujado (de la fecha) está a altura = latitud, azimut 0°", `alt ${f4(alt)}°, az ${f4(az)}°`);
  const eclW = new THREE.Vector3(1, 0, 0).multiplyScalar(900).applyMatrix4(layer.eq.matrixWorld), eclS = new THREE.Vector3(1, 0, 0).multiplyScalar(900).applyQuaternion(qJ);
  ok(eclW.distanceTo(eclS) < 1e-6, "la eclíptica y el plano galáctico giran con el cuaternión de las estrellas");
  // fuera de «Mi cielo»: el ecuador de la fecha va con la precesión inversa (mundo = J2000)
  layer.setLocalFrame(null, precessionQuat(date).invert());
  const p2 = new THREE.Vector3(0, 0, 1).applyMatrix4(layer.eqDate.matrixWorld).normalize(), pj = dateToJ2000([0, 0, 1], date);
  ok(sepVec([p2.x, p2.y, p2.z], pj) < 1e-9 && layer.eq.quaternion.equals(new THREE.Quaternion()), "sin lugar: polo de la fecha en su sitio J2000 y eclíptica sin girar", `polo de la fecha a ${f4(sepVec(pj, [0, 0, 1]))}° del de J2000`);
  layer.dispose();
}

console.log("«Esta noche»: la Luna sube con el horizonte de Meeus y el catálogo se precesa");
{
  // 27-nov-2026, 20:00 en Quito: la Luna menguante sale de noche (~21:35); «Esta noche» la busca a pasos de
  // 10 min (interpolación lineal) con el mismo horizonte que la ficha (riseTransitSet + moonH0)
  const night = new Date("2026-11-28T01:00:00Z");
  const tnN = computeTonight({ date: night, lat: QUITO.lat, lon: QUITO.lon, ephemeris, showers: [], messier: [], constellations: [] });
  const at = (d) => ephemeris(d).find((b) => b.name === "Luna");
  const rts = riseTransitSet((d) => { const b = at(d); return [b.nx, b.ny, b.nz]; }, QUITO.lat, QUITO.lon, night, { minAlt: (ms) => moonH0(at(new Date(ms)).dist_km) });
  const m = tnN.items.find((x) => x.kind === "moon");
  ok(m && !m.up && m.rise && Math.abs(m.rise.date - rts.rise.date) < 60e3, "la salida de la Luna en «Esta noche» = la de la ficha (± 1 min)", m && m.rise && `${m.rise.date.toISOString()} / ${rts.rise.date.toISOString()}`);
  // la altura de la Luna que da la lista es la topocéntrica (la dibujada), no la geocéntrica
  const iso = "2027-05-21T09:20:00", S = scene(iso);
  const tm = computeTonight({ date: S.date, lat: QUITO.lat, lon: QUITO.lon, elev: QUITO.elev, ephemeris, showers: [], messier: [], constellations: [] }).items.find((x) => x.kind === "moon");
  const mo = S.after.bodies.find((b) => b.name === "Luna"), dm = drawnAltAz([mo.nx, mo.ny, mo.nz], S.after.q);
  ok(tm && tm.up && Math.abs(tm.alt - dm.alt) < 0.01 && Math.abs(tm.alt - REF.bodies[iso].moon[0]) < 0.3, "la altura de la Luna en «Esta noche» = la dibujada (topocéntrica)",
    tm && `${f3(tm.alt)}° / dibujada ${f3(dm.alt)}° / astropy ${REF.bodies[iso].moon[0]}°`);
  const date = new Date("2026-11-14T04:00:00Z");
  const tn = computeTonight({ date, lat: QUITO.lat, lon: QUITO.lon, ephemeris, showers: [], messier: [], constellations: [{ ab: "Ori", name: "Orion", dir: STAR.get("Betelgeuse") }] });
  const c = tn.items.find((x) => x.kind === "con");
  const ref = REF.stars["2026-11-14T04:00:00"].Betelgeuse;
  ok(c && sepAltAz({ alt: c.alt, az: c.az }, ref) < 0.05, "una dirección del catálogo (Betelgeuse) sale a < 0,05° de astropy", c && `${f3(sepAltAz({ alt: c.alt, az: c.az }, ref))}°`);
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
