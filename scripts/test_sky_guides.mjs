// Pruebas de las LÍNEAS GUÍA de la vista Cielo: src/sky/guides.js (matemática pura) y
// src/sky/guidesLayer.js (capa three.js, sin WebGL: solo geometría y proyección de etiquetas).
// Uso:  node scripts/test_sky_guides.mjs     (sale con código 1 si algo falla)
//
// Referencias independientes: el Sol, la Luna y los planetas de src/ephemeris.js; Polaris
// (HIP 11767) de public/sky.json; Sgr A* de public/blackholes.json; la matriz A_G de Hipparcos
// (ESA 1997, vol. 1, §1.5.3, ec. 1.5.11) y localSkyQuat de src/sky/look.js (el giro con el tiempo
// sidéreo de la fecha; en "Mi cielo" las estrellas J2000 se giran con localSkyQuatJ2000 = localSkyQuat ·
// precesión, ver scripts/test_sky_frames.mjs). Altura y azimut se recalculan con la fórmula clásica del ángulo
// horario y el tiempo sidéreo de Meeus (Astronomical Algorithms, ec. 12.4).
import * as THREE from "three";
import { readFileSync } from "node:fs";
import {
  OBLIQUITY_J2000_DEG, OBLIQUITY_IAU2006_DEG, GAL_MATRIX, GAL_CENTER_DIR, GAL_NORTH_POLE, ECL_NORTH_POLE, NCP,
  raDecToVec, vecToRaDec, altAzToLocal, localToAltAz, eclToEq, eqToEcl, galToEq, eqToGal, angSepDeg,
  distToGreatCircleDeg, applyQuat, applyQuatInv, eclipticPoints, equatorPoints, galacticEquatorPoints, meridianPoints,
  eqGridLines, altAzGridLines, gridLevelForFov, fmtRA, fmtDec, fmtAlt, fmtAz, labelSpecs, sanitizeGuides, DEFAULT_GUIDES,
  GUIDE_KEYS, LOCAL_ONLY,
} from "../src/sky/guides.js";
import { GuidesLayer, GUIDE_LABEL_COLOR } from "../src/sky/guidesLayer.js";
import { GUIDES } from "../src/sky/i18n-guides.js";
import { ephemeris } from "../src/ephemeris.js";
import { skyBodies } from "../src/sky/frames.js";
import { localSkyQuat, lookFrame, dirToYawPitch, lookQuat, spanToFov, SPAN_DEF } from "../src/sky/look.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => {
  if (cond) { passed++; console.log(`  ok    ${name}${detail ? "  · " + detail : ""}`); }
  else { failed++; console.log(`  FALLA ${name} ${detail}`); }
};
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const f4 = (x) => Number(x).toFixed(4);
const sky = JSON.parse(readFileSync(new URL("../public/sky.json", import.meta.url), "utf8"));
const bh = JSON.parse(readFileSync(new URL("../public/blackholes.json", import.meta.url), "utf8"));
const byHip = new Map(sky.stars.map((s) => [s[0], s]));
const centroid = (ab) => {
  const seen = new Set(), v = [0, 0, 0];
  sky.constellations.find((c) => c.ab === ab).lines.forEach((pl) => pl.forEach((h) => {
    if (seen.has(h)) return; seen.add(h); const s = byHip.get(h); if (s) { v[0] += s[1]; v[1] += s[2]; v[2] += s[3]; }
  }));
  const n = Math.hypot(...v); return v.map((x) => x / n);
};
// distancia mínima (grados) de una dirección a una polilínea muestreada (Float32Array de vectores unitarios)
const minDistToPts = (v, pts, closed = true) => {
  let best = 180; const n = pts.length / 3;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]], j = (i + 1) % n, b = [pts[j * 3], pts[j * 3 + 1], pts[j * 3 + 2]];
    // distancia al arco a–b: al gran círculo si el pie cae dentro del arco, si no a los extremos
    const pole = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const pn = Math.hypot(...pole);
    let d = Math.min(angSepDeg(v, a), angSepDeg(v, b));
    if (pn > 1e-12) {
      const dGc = distToGreatCircleDeg(v, pole);
      const s = pole.map((x) => x / pn), k = v[0] * s[0] + v[1] * s[1] + v[2] * s[2];
      const foot = [v[0] - k * s[0], v[1] - k * s[1], v[2] - k * s[2]];
      if (angSepDeg(foot, a) + angSepDeg(foot, b) <= angSepDeg(a, b) + 1e-9) d = Math.min(d, dGc);
    }
    best = Math.min(best, d);
  }
  return best;
};

console.log("Constantes (fuentes)");
{
  ok(Math.abs(OBLIQUITY_J2000_DEG - 84381.448 / 3600) < 1e-7, "ε₀ = 84 381,448″ (IAU 1976) = 23,4392911°", f4(OBLIQUITY_J2000_DEG * 3600) + "″");
  ok(Math.abs(OBLIQUITY_J2000_DEG - OBLIQUITY_IAU2006_DEG) * 3600 < 0.05, "diferencia con IAU 2006 (84 381,406″) < 0,05″", f4((OBLIQUITY_J2000_DEG - OBLIQUITY_IAU2006_DEG) * 3600) + "″");
  // Matriz A_G publicada por Hipparcos (filas = ejes galácticos en ecuatoriales ICRS/J2000)
  const AG = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];
  let worst = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) worst = Math.max(worst, Math.abs(GAL_MATRIX[i][j] - AG[i][j]));
  ok(worst < 2e-10, "matriz galáctica = A_G de Hipparcos (a 10 decimales)", "máx. dif " + worst.toExponential(1));
  const gc = vecToRaDec(GAL_CENTER_DIR), ngp = vecToRaDec(GAL_NORTH_POLE);
  ok(Math.abs(gc.ra - 266.40499) < 1e-4 && Math.abs(gc.dec + 28.93617) < 1e-4, "centro galáctico (l 0, b 0) en AR 266,40499°, Dec −28,93617°", `${f4(gc.ra)}°, ${f4(gc.dec)}°`);
  ok(Math.abs(ngp.ra - 192.85948) < 1e-6 && Math.abs(ngp.dec - 27.12825) < 1e-6, "polo norte galáctico en AR 192,85948°, Dec +27,12825°");
  ok(Math.abs(eqToGal(NCP).l - 122.93192) < 1e-6, "el polo norte celeste está en l = 122,93192°");
  const ep = vecToRaDec(ECL_NORTH_POLE);
  ok(Math.abs(ep.ra - 270) < 1e-9 && Math.abs(ep.dec - (90 - OBLIQUITY_J2000_DEG)) < 1e-9, "polo de la eclíptica en AR 18h, Dec 90° − ε");
}

console.log("Conversiones de ida y vuelta");
{
  let wG = 0, wE = 0, wH = 0, wL = 0;
  for (let l = 0; l < 360; l += 7.3) for (let b = -85; b <= 85; b += 8.5) {
    const v = galToEq(l, b), g = eqToGal(v);
    wG = Math.max(wG, angSepDeg(v, galToEq(g.l, g.b)), Math.abs(g.b - b), Math.abs(((g.l - l + 540) % 360) - 180));
    const e = eqToEcl(eclToEq(l, b)); wE = Math.max(wE, Math.abs(e.lat - b), Math.abs(((e.lon - l + 540) % 360) - 180));
    const h = localToAltAz(altAzToLocal(b, l)); wH = Math.max(wH, Math.abs(h.alt - b), Math.abs(((h.az - l + 540) % 360) - 180));
    const r = vecToRaDec(raDecToVec(l, b)); wL = Math.max(wL, Math.abs(r.dec - b), Math.abs(((r.ra - l + 540) % 360) - 180));
  }
  ok(wG < 1e-9, "galácticas ↔ ecuatoriales", wG.toExponential(1) + "°");
  ok(wE < 1e-9, "eclípticas ↔ ecuatoriales", wE.toExponential(1) + "°");
  ok(wH < 1e-9, "altura/azimut ↔ vector local", wH.toExponential(1) + "°");
  ok(wL < 1e-9, "AR/Dec ↔ vector ecuatorial", wL.toExponential(1) + "°");
  // el cuaternión plano coincide con three
  const q = localSkyQuat(-0.22, -78.51, new Date("2026-11-14T04:00:00Z")), v = [0.3, -0.5, 0.81];
  const t = new THREE.Vector3(...v).applyQuaternion(q), a = applyQuat(v, q), b = applyQuatInv(a, q);
  ok(Math.hypot(t.x - a[0], t.y - a[1], t.z - a[2]) < 1e-12 && Math.hypot(b[0] - v[0], b[1] - v[1], b[2] - v[2]) < 1e-12, "applyQuat = Vector3.applyQuaternion (y su inverso)");
}

console.log("Eclíptica frente al Sol, la Luna y los planetas de src/ephemeris.js");
{
  const ecl = eclipticPoints(1);
  const dates = ["2000-01-01T12:00:00Z", "2026-01-15T00:00:00Z", "2026-03-20T15:00:00Z", "2026-05-10T06:00:00Z", "2026-06-21T08:00:00Z",
    "2026-08-01T20:00:00Z", "2026-09-23T00:00:00Z", "2026-11-13T23:00:00Z", "2026-11-14T04:00:00Z", "2026-12-21T15:00:00Z", "2035-07-04T00:00:00Z", "2050-02-28T12:00:00Z"];
  let worstSun = 0, worstPts = 0, worstPl = 0, worstMoon = 0, plName = "";
  for (const d of dates) {
    const eph = ephemeris(new Date(d));
    const sun = eph.find((b) => b.name === "Sol"), s = [sun.nx, sun.ny, sun.nz];
    worstSun = Math.max(worstSun, distToGreatCircleDeg(s, ECL_NORTH_POLE));
    worstPts = Math.max(worstPts, minDistToPts(s, ecl));
    for (const b of eph) {
      if (b.body !== "planet") continue;
      const beta = Math.abs(eqToEcl([b.nx, b.ny, b.nz]).lat);
      if (beta > worstPl) { worstPl = beta; plName = `${b.name} ${d.slice(0, 10)}`; }
    }
    const moon = eph.find((b) => b.name === "Luna");
    if (moon) worstMoon = Math.max(worstMoon, Math.abs(eqToEcl([moon.nx, moon.ny, moon.nz]).lat));
  }
  ok(worstSun < 0.5, `el Sol está a < 0,5° de la eclíptica en ${dates.length} fechas (2000–2050)`, `peor ${f4(worstSun)}°`);
  // el Sol tal como se dibuja: precesado a J2000 (src/sky/frames.js → skyBodies), el marco de la eclíptica dibujada
  let worstDrawn = 0;
  for (const d of dates) { const dd = new Date(d), s = skyBodies(ephemeris(dd), dd, null).find((b) => b.name === "Sol"); worstDrawn = Math.max(worstDrawn, distToGreatCircleDeg([s.nx, s.ny, s.nz], ECL_NORTH_POLE)); }
  ok(worstDrawn < 0.01, "el Sol dibujado (precesado a J2000) está a < 0,01° de la eclíptica J2000 en las mismas fechas", `peor ${f4(worstDrawn)}°`);
  ok(worstPts < 0.5, "… y a < 0,5° de la línea dibujada (polilínea de 360 puntos)", `peor ${f4(worstPts)}°`);
  ok(worstPl < 8, "los planetas quedan a < 8° de la eclíptica (Mercurio y Venus llegan a ~7°)", `peor ${f4(worstPl)}° (${plName})`);
  ok(worstMoon < 5.5, "la Luna queda a < 5,5° de la eclíptica (inclinación 5,1°)", `peor ${f4(worstMoon)}°`);
  // hoy: el Sol en Libra (λ ≈ 231°)
  const sunToday = ephemeris(new Date("2026-11-13T17:00:00Z")).find((b) => b.name === "Sol");
  const lam = eqToEcl([sunToday.nx, sunToday.ny, sunToday.nz]).lon;
  ok(lam > 228 && lam < 234, "13-nov-2026: longitud eclíptica del Sol ≈ 231°", f4(lam) + "°");
}

console.log("Eclíptica y plano galáctico frente a las constelaciones de sky.json");
{
  const zod = ["Ari", "Tau", "Gem", "Cnc", "Leo", "Vir", "Lib", "Sco", "Sgr", "Cap", "Aqr", "Psc"];
  const zb = zod.map((ab) => [ab, eqToEcl(centroid(ab))]);
  const worst = zb.reduce((m, [, e]) => Math.max(m, Math.abs(e.lat)), 0);
  ok(worst < 15, "los 12 signos del zodiaco: centro de su figura a < 15° de la eclíptica", zb.map(([a, e]) => `${a} ${e.lat.toFixed(1)}`).join(" "));
  // en orden a lo largo de la eclíptica (cada una más al este que la anterior)
  const lons = zb.map(([, e]) => e.lon), steps = lons.map((l, i) => ((lons[(i + 1) % 12] - l) + 360) % 360);
  ok(steps.every((s) => s > 5 && s < 60), "… y en orden de Aries a Piscis a lo largo de ella");
  const far = ["UMa", "UMi", "Dra", "Cen", "Oct", "Crt", "Com"].map((ab) => [ab, Math.abs(eqToEcl(centroid(ab)).lat)]);
  ok(far.every(([, b]) => b > 15), "figuras lejos del zodiaco (UMa, UMi, Dra, Cen, Oct, Crt, Com) a > 15°", far.map(([a, b]) => `${a} ${b.toFixed(0)}`).join(" "));
  const plane = ["Cyg", "Aql", "Sgr", "Sct", "Cru", "Cas", "Car", "Mon", "Cep"].map((ab) => [ab, eqToGal(centroid(ab))]);
  const wp = plane.reduce((m, [, g]) => Math.max(m, Math.abs(g.b)), 0);
  ok(wp < 15, "Cygnus, Aquila, Sagitario, Scutum, Crux, Cassiopeia, Carina, Monoceros y Cepheus a < 15° del plano galáctico", plane.map(([a, g]) => `${a} b=${g.b.toFixed(1)}`).join(" "));
  const off = ["UMa", "Leo", "Vir", "Com", "Scl", "For", "Boo"].map((ab) => [ab, Math.abs(eqToGal(centroid(ab)).b)]);
  ok(off.every(([, b]) => b > 30), "figuras de los polos galácticos (UMa, Leo, Vir, Com, Scl, For, Boo) a > 30°", off.map(([a, b]) => `${a} ${b.toFixed(0)}`).join(" "));
  const cru = eqToGal(centroid("Cru")).l, sgr = eqToGal(centroid("Sgr")).l, cyg = eqToGal(centroid("Cyg")).l;
  ok(sgr < 20 || sgr > 340, "Sagitario hacia el centro galáctico (l ≈ 0°)", `l = ${sgr.toFixed(1)}°`);
  ok(cyg > 60 && cyg < 100 && cru > 290 && cru < 310, "Cygnus en l ≈ 80° y Crux en l ≈ 300°", `Cyg ${cyg.toFixed(1)}°, Cru ${cru.toFixed(1)}°`);
}

console.log("Polo norte celeste, Polaris, ecuador celeste y Sgr A*");
{
  const p = byHip.get(11767);
  ok(p && p[7] === "Polaris", "HIP 11767 es Polaris en sky.json");
  const sepP = angSepDeg(NCP, [p[1], p[2], p[3]]);
  ok(sepP < 1, "el polo norte celeste está a < 1° de Polaris", `${f4(sepP)}°`);
  const eq = equatorPoints(1); let wz = 0;
  for (let i = 0; i < eq.length; i += 3) wz = Math.max(wz, Math.abs(Math.asin(eq[i + 2]) * R2D), Math.abs(Math.hypot(eq[i], eq[i + 1], eq[i + 2]) - 1));
  ok(wz < 1e-6, "el ecuador celeste está a Dec 0 (y sus puntos son unitarios)", wz.toExponential(1));
  const sgr = bh.objects.find((o) => o.name === "Sgr A*"), s = [sgr.nx, sgr.ny, sgr.nz], g = eqToGal(s);
  ok(Math.abs(g.b + 0.046) < 0.01, "Sgr A* (blackholes.json) está en b ≈ −0,05°", `l = ${f4(g.l)}°, b = ${f4(g.b)}°`);
  ok(minDistToPts(s, galacticEquatorPoints(1)) < 1, "el ecuador galáctico dibujado pasa a < 1° de Sgr A*", `${f4(minDistToPts(s, galacticEquatorPoints(1)))}°`);
  ok(angSepDeg(galToEq(0, 0), s) < 0.5, "el centro galáctico (l 0, b 0) está a < 0,5° de Sgr A*", `${f4(angSepDeg(galToEq(0, 0), s))}°`);
  let wb = 0; const gp = galacticEquatorPoints(1); for (let i = 0; i < gp.length; i += 3) wb = Math.max(wb, Math.abs(eqToGal([gp[i], gp[i + 1], gp[i + 2]]).b));
  ok(wb < 1e-5, "todos los puntos del ecuador galáctico tienen b = 0", wb.toExponential(1));
}

console.log("Cuadrícula horizontal y meridiano: Quito, 13-nov-2026 23:00 (UTC−5)");
{
  const LAT = -0.2202, LON = -78.5123, when = new Date("2026-11-14T04:00:00Z");
  const q = localSkyQuat(LAT, LON, when);
  // referencia independiente: tiempo sidéreo de Meeus 12.4 y fórmula del ángulo horario
  const JD = when.getTime() / 86400000 + 2440587.5, T = (JD - 2451545) / 36525;
  const gmst = ((280.46061837 + 360.98564736629 * (JD - 2451545) + 0.000387933 * T * T - T * T * T / 38710000) % 360 + 360) % 360;
  const lst = gmst + LON;
  const altAzRef = (v) => {
    const { ra, dec } = vecToRaDec(v), H = (lst - ra) * D2R, d = dec * D2R, ph = LAT * D2R;
    const alt = Math.asin(Math.sin(ph) * Math.sin(d) + Math.cos(ph) * Math.cos(d) * Math.cos(H)) * R2D;
    const az = (Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(ph) - Math.cos(d) * Math.sin(ph) * Math.cos(H)) * R2D + 360) % 360;
    return { alt, az };
  };
  const g = altAzGridLines(0, 1);
  let worst = 0, n = 0;
  const check = (pts, alt0, az0) => {
    for (let i = 0; i < pts.length; i += 3 * 7) {
      const eq = applyQuatInv([pts[i], pts[i + 1], pts[i + 2]], q);   // del marco local al ecuatorial (lo que hace la escena al revés)
      const r = altAzRef(eq), h = localToAltAz([pts[i], pts[i + 1], pts[i + 2]]);
      const da = Math.abs(r.alt - h.alt), dz = Math.abs(((r.az - h.az + 540) % 360) - 180) * Math.cos(h.alt * D2R);
      worst = Math.max(worst, da, dz); n++;
      if (alt0 != null) worst = Math.max(worst, Math.abs(h.alt - alt0));
      if (az0 != null && Math.abs(h.alt) < 89) worst = Math.max(worst, Math.abs(((h.az - az0 + 540) % 360) - 180));
    }
  };
  for (const a of g.almucantars) check(a.pts, a.alt, null);
  for (const v of g.verticals) check(v.pts, null, v.az);
  ok(worst < 0.01, `${n} puntos de la cuadrícula llevados a ecuatoriales con localSkyQuat dan la altura/azimut esperados`, `peor ${f4(worst)}°`);
  ok(g.almucantars.length === 16 && g.verticals.length === 24, "nivel 0: almucantarats cada 10° (−80…80, sin el horizonte) y verticales cada 15°", `${g.almucantars.length} y ${g.verticals.length}`);
  const zen = vecToRaDec(applyQuatInv([0, 1, 0], q));
  ok(Math.abs(zen.dec - LAT) < 0.01 && Math.abs(((zen.ra - lst + 540) % 360) - 180) < 0.01, "el cenit está en Dec = latitud y AR = tiempo sidéreo local", `Dec ${f4(zen.dec)}°, AR ${f4(zen.ra)}° (TSL ${f4((lst + 360) % 360)}°)`);
  const mer = meridianPoints(1); let wm = 0;
  for (let i = 0; i < mer.length; i += 3) {
    const eq = applyQuatInv([mer[i], mer[i + 1], mer[i + 2]], q), r = altAzRef(eq);
    if (Math.abs(r.alt) < 89.5) wm = Math.max(wm, Math.min(Math.abs(((r.az + 540) % 360) - 180), Math.abs(((r.az - 180 + 540) % 360) - 180)));
    // y cada punto del meridiano tiene ángulo horario 0 o 12 h
    const H = ((lst - vecToRaDec(eq).ra) % 180 + 360) % 180;
    if (Math.abs(vecToRaDec(eq).dec) < 89.5) wm = Math.max(wm, Math.min(H, 180 - H));
  }
  ok(wm < 0.01, "el meridiano va de N a S por el cenit (azimut 0°/180°, ángulo horario 0 h/12 h)", `peor ${f4(wm)}°`);
  // la Polar, vista desde Quito: casi en el horizonte norte
  const p = byHip.get(11767), pl = localToAltAz(applyQuat([p[1], p[2], p[3]], q));
  ok(pl.alt > -2 && pl.alt < 1.5 && (pl.az < 3 || pl.az > 357), "desde Quito (lat −0,2°) la Polar roza el horizonte norte", `alt ${f4(pl.alt)}°, az ${f4(pl.az)}°`);
}

console.log("Cuadrícula ecuatorial, densidad según el zoom y etiquetas");
{
  const g0 = eqGridLines(0, 1);
  ok(g0.meridians.length === 24 && g0.parallels.length === 11, "nivel 0: 24 meridianos (1 h) y 11 paralelos (15°)", `${g0.meridians.length} y ${g0.parallels.length}`);
  let wr = 0;
  for (const m of g0.meridians) for (let i = 3; i < m.pts.length - 3; i += 9) wr = Math.max(wr, Math.abs(((vecToRaDec([m.pts[i], m.pts[i + 1], m.pts[i + 2]]).ra - m.raMin / 4 + 540) % 360) - 180));
  for (const p of g0.parallels) for (let i = 0; i < p.pts.length; i += 9) wr = Math.max(wr, Math.abs(vecToRaDec([p.pts[i], p.pts[i + 1], p.pts[i + 2]]).dec - p.dec));
  ok(wr < 1e-4, "cada meridiano a su AR y cada paralelo a su Dec", wr.toExponential(1) + "°");
  const g1 = eqGridLines(1, 1), g2 = eqGridLines(2, 1);
  ok(g1.meridians.length === 72 && g2.meridians.length === 144, "al acercar: 20 min (nivel 1) y 10 min (nivel 2) de AR", `${g1.meridians.length}, ${g2.meridians.length}`);
  ok(gridLevelForFov(100, 0) === 0 && gridLevelForFov(30, 0) === 1 && gridLevelForFov(8, 1) === 2, "nivel según el campo de visión: 100° → 0, 30° → 1, 8° → 2");
  ok(gridLevelForFov(36.5, 0) === 0 && gridLevelForFov(39.5, 1) === 1 && gridLevelForFov(34, 0) === 1, "histéresis del 8 % en los umbrales (sin parpadeo)");
  ok(fmtRA(0) === "0h" && fmtRA(360) === "6h" && fmtRA(390) === "6h30m" && fmtRA(1430) === "23h50m", "AR: 0h, 6h, 6h30m, 23h50m");
  ok(fmtDec(30) === "+30°" && fmtDec(-15) === "−15°" && fmtDec(0) === "0°" && fmtAlt(-10) === "−10°" && fmtAz(45) === "45°", "Dec y altura con signo tipográfico (+30°, −15°, 0°, −10°)");
  const specs = labelSpecs(0, { ...GUIDES.es.lineName, ...GUIDES.es.poleName }, "es");
  ok(specs.some((s) => s.text === "Eclíptica") && specs.some((s) => s.text === "Ecuador celeste") && specs.some((s) => s.text === "Plano de la Vía Láctea"), "nombres de línea en español");
  const specsEn = labelSpecs(1, { ...GUIDES.en.lineName, ...GUIDES.en.poleName }, "en");
  ok(specsEn.some((s) => s.text === "Ecliptic") && specsEn.some((s) => s.text === "Milky Way plane") && specsEn.some((s) => s.text === "+5°"), "… y en inglés");
  const es = GUIDES.es, en = GUIDES.en, keysOf = (o) => JSON.stringify(Object.keys(o).sort());
  ok(keysOf(es) === keysOf(en) && GUIDE_KEYS.every((k) => es.guideName[k] && en.guideName[k] && es.guideDesc[k] && en.guideDesc[k]), "i18n-guides: mismas claves en ES y EN, una explicación por guía");
  ok(JSON.stringify(sanitizeGuides({ ecliptic: true, galactic: "sí", bogus: true })) === JSON.stringify({ ...DEFAULT_GUIDES, ecliptic: true }), "sanitizeGuides descarta valores no booleanos y claves desconocidas");
  ok(GUIDE_KEYS.every((k) => DEFAULT_GUIDES[k] === false) && LOCAL_ONLY.has("altAzGrid") && LOCAL_ONLY.has("meridian"), "por defecto todo apagado; cuadrícula horizontal y meridiano solo en Mi cielo");
}

console.log("GuidesLayer (three, sin WebGL)");
{
  const W = 390, H = 844;
  const layer = new GuidesLayer({ radius: 900, lang: "es" });
  const scene = new THREE.Scene(); scene.add(layer.group);
  let mats = 0, badMat = 0, badOrder = 0;
  layer.group.traverse((o) => { if (o.material) { mats++; if (o.material.depthWrite !== false || !o.material.transparent) badMat++; } if ((o.isLine || o.isLineSegments) && o.renderOrder !== -1) badOrder++; });
  ok(mats > 0 && badMat === 0 && badOrder === 0, "materiales transparentes sin escribir profundidad, renderOrder −1 (antes que estrellas y figuras)");
  ok(!layer.anyVisible() && layer.labelsForView(new THREE.PerspectiveCamera(), { w: W, h: H }).length === 0, "todo apagado al crear: sin líneas ni etiquetas");
  const eclObj = layer.objs.ecliptic, pos = eclObj.geometry.attributes.position;
  let wr = 0; for (let i = 0; i < pos.count; i++) wr = Math.max(wr, Math.abs(Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)) - 900));
  ok(wr < 0.01 && pos.count === 360, "eclíptica: 360 vértices a radio 900 (la esfera de las estrellas)", `${pos.count} vértices`);
  // cámara en el centro mirando a una dirección (como la app, retrato 390×844)
  const camAt = (dirEq, qLocal = null, span = SPAN_DEF) => {
    const qF = lookFrame(!!qLocal);
    const d = new THREE.Vector3(...dirEq); if (qLocal) d.applyQuaternion(qLocal);
    const cam = new THREE.PerspectiveCamera(spanToFov(span, W / H), W / H, 0.1, 6000);
    const yp = dirToYawPitch(d, qF); lookQuat(yp.yaw, yp.pitch, qF, cam.quaternion);
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    return cam;
  };
  for (const k of ["ecliptic", "equator", "galactic", "eqGrid", "poles"]) layer.setVisible(k, true);
  const ori = centroid("Ori"), lb1 = layer.labelsForView(camAt(ori), { w: W, h: H });
  const names = lb1.map((l) => l.name);
  ok(names.includes("Eclíptica") && names.includes("Ecuador celeste"), "mirando a Orión: se nombran la eclíptica y el ecuador celeste", names.filter((n) => !/^[+−0-9]/.test(n)).join(", "));
  ok(lb1.some((l) => /^\d+h/.test(l.name)) && lb1.some((l) => /^[+−]\d+°$/.test(l.name)), "… y hay etiquetas de AR (abajo) y de Dec (a la izquierda)", lb1.filter((l) => l.cls === "guide_eqGrid").map((l) => l.name).join(" "));
  ok(lb1.every((l) => l.x >= 0 && l.x <= W && l.y >= 0 && l.y <= H && GUIDE_LABEL_COLOR[l.cls]), "todas dentro de la pantalla y con color definido para su clase");
  ok(lb1[0].prio >= lb1[lb1.length - 1].prio, "ordenadas por prioridad (nombres de línea primero)");
  const lb2 = layer.labelsForView(camAt(centroid("Sgr")), { w: W, h: H });
  ok(lb2.some((l) => l.name === "Plano de la Vía Láctea") && lb2.some((l) => l.name === "Eclíptica"), "mirando a Sagitario: plano de la Vía Láctea y eclíptica");
  const umi = byHip.get(11767), lb3 = layer.labelsForView(camAt([umi[1], umi[2], umi[3]]), { w: W, h: H });
  ok(lb3.some((l) => l.name === "Polo norte celeste"), "mirando a la Polar: «Polo norte celeste»");
  // la etiqueta del polo cae donde se proyecta el polo (a ~0,74° de la Polar: pocos px)
  const cam3 = camAt([umi[1], umi[2], umi[3]]), pp = new THREE.Vector3(0, 0, 900).project(cam3);
  const lp = lb3.find((l) => l.name === "Polo norte celeste");
  ok(Math.hypot(lp.x - (pp.x * 0.5 + 0.5) * W, lp.y - (-pp.y * 0.5 + 0.5) * H) < 1, "… colocada exactamente sobre el polo proyectado");
  // Mi cielo: Quito, 13-nov-2026 23:00
  const q = localSkyQuat(-0.2202, -78.5123, new Date("2026-11-14T04:00:00Z"));
  ok(!layer.isVisible("altAzGrid") && !layer.isVisible("meridian"), "sin ubicación, la cuadrícula horizontal y el meridiano no se dibujan aunque estén pedidos");
  layer.setVisible("altAzGrid", true); layer.setVisible("meridian", true);
  ok(!layer.local.visible, "… (el marco local queda oculto)");
  layer.setLocalFrame(q);
  ok(layer.local.visible && layer.isVisible("altAzGrid") && layer.isVisible("meridian"), "con ubicación sí se dibujan");
  const v = new THREE.Vector3(...ori).multiplyScalar(900).applyMatrix4(layer.eq.matrixWorld), w = new THREE.Vector3(...ori).multiplyScalar(900).applyQuaternion(q);
  ok(v.distanceTo(w) < 1e-6, "el marco ecuatorial de la capa gira igual que las estrellas (points.quaternion = localQuat)");
  const camUp = camAt(applyQuatInv([0, 0.9962, -0.0872], q), q);   // mirando casi al cenit, hacia el norte
  const lb4 = layer.labelsForView(camUp, { w: W, h: H });
  ok(lb4.some((l) => l.name === "Cenit") && lb4.some((l) => l.name === "Meridiano"), "en Mi cielo mirando arriba: «Cenit» y «Meridiano»", lb4.filter((l) => l.prio > 1).map((l) => l.name).join(", "));
  const camE = camAt(applyQuatInv(altAzToLocal(20, 100), q), q, 100), lb5 = layer.labelsForView(camE, { w: W, h: H });
  ok(lb5.some((l) => l.cls === "guide_altAzGrid" && /°$/.test(l.name)), "mirando al este: etiquetas de altura y azimut", lb5.filter((l) => l.cls === "guide_altAzGrid").map((l) => l.name).join(" "));
  // bajo el horizonte no se nombran las líneas ecuatoriales (como hace la vista con las estrellas)
  const camDown = camAt(applyQuatInv(altAzToLocal(-14, 180), q), q, 60);
  const below = layer.labelsForView(camDown, { w: W, h: H }).filter((l) => l.cls !== "guide_altAzGrid" && l.cls !== "guide_meridian" && l.cls !== "guide_poles");
  const camM = camDown; let anyBelow = false;
  for (const l of below) {
    const ray = new THREE.Vector3((l.x / W) * 2 - 1, -(l.y / H) * 2 + 1, 0.5).unproject(camM).normalize();
    if (ray.y < -0.03) anyBelow = true;
  }
  ok(!anyBelow, "en Mi cielo no se nombran líneas ecuatoriales bajo el horizonte");
  // densidad según el zoom: la geometría fina se crea una vez y se reutiliza
  layer.setFov(30); const lvl1 = layer.gridLevels.eqGrid[1];
  ok(layer.level === 1 && lvl1 && lvl1.minor && lvl1.minor.visible, "zoom a 30°: aparece la cuadrícula de 20 min / 5°");
  layer.setFov(90); layer.setFov(30);
  ok(layer.gridLevels.eqGrid[1] === lvl1 && lvl1.minor.visible, "volver a acercar reutiliza la misma geometría (no se recrea)");
  layer.setFov(8);
  ok(layer.level === 2 && !lvl1.minor.visible && layer.gridLevels.eqGrid[2].minor.visible, "zoom a 8°: 10 min / 2°; la de nivel 1 se oculta");
  let verts = 0; layer.group.traverse((o) => { if (o.geometry) verts += o.geometry.attributes.position.count; });
  ok(verts < 400000, "todas las geometrías creadas suman < 400 000 vértices", `${verts}`);
  layer.setLocalFrame(null);
  ok(!layer.local.visible && layer.eq.quaternion.equals(new THREE.Quaternion()), "salir de Mi cielo: marco ecuatorial y sin líneas locales");
  layer.setLang("en");
  ok(layer.labelsForView(camAt(ori), { w: W, h: H }).some((l) => l.name === "Ecliptic"), "setLang('en'): «Ecliptic»");
  // vista desde fuera: no se nombra la cara oculta
  const camOut = new THREE.PerspectiveCamera(55, W / H, 0.1, 6000); camOut.position.set(0, 0, 2600); camOut.lookAt(0, 0, 0); camOut.updateMatrixWorld();
  const lbO = layer.labelsForView(camOut, { w: W, h: H });
  ok(!lbO.some((l) => l.name === "South celestial pole"), "vista desde fuera: no se nombra lo que queda en la cara oculta (polo sur)");
  layer.dispose();
  ok(!layer.group.parent, "dispose(): fuera de la escena");
}

console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
