// Pruebas de src/sky/guide.js y src/sky/tonight.js (flecha guía y "Esta noche").
// Uso:  node scripts/test_sky_guide.mjs     (sale con código 1 si algo falla)
// Solo Node y three (ya instalado), que se usa como referencia independiente.
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { eqToLocal, altAz, altAzOfLocal, angularSep, guideArrow, turnHint, isAboveHorizon, galLat, galToEq, GAL_CENTER, GAL_POLE, sepDirs, nextRise, gmstRad } from "../src/sky/guide.js";
import { cameraQuat, lookFromQuat } from "../src/sky/deviceOrientation.js";
import { computeTonight, showerActive, daysToPeak, moonPhaseKey } from "../src/sky/tonight.js";
import { ephemeris } from "../src/ephemeris.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const D2R = Math.PI / 180;
const dir = (raDeg, decDeg) => [Math.cos(decDeg * D2R) * Math.cos(raDeg * D2R), Math.cos(decDeg * D2R) * Math.sin(raDeg * D2R), Math.sin(decDeg * D2R)];
const local = (alt, az) => [Math.cos(alt * D2R) * Math.sin(az * D2R), Math.sin(alt * D2R), -Math.cos(alt * D2R) * Math.cos(az * D2R)];

// referencia: el cuaternión local de la vista 3D (copiado de Constellations.jsx)
function localSkyQuat(latDeg, lonDeg, date) {
  const phi = latDeg * D2R, lst = gmstRad(date) + lonDeg * D2R;
  const up = new THREE.Vector3(Math.cos(phi) * Math.cos(lst), Math.cos(phi) * Math.sin(lst), Math.sin(phi)).normalize();
  const ncp = new THREE.Vector3(0, 0, 1);
  const north = ncp.clone().sub(up.clone().multiplyScalar(ncp.dot(up))).normalize();
  const east = new THREE.Vector3().crossVectors(north, up).normalize();
  const B = new THREE.Matrix4().makeBasis(east, up, north.clone().multiplyScalar(-1)); B.transpose();
  return new THREE.Quaternion().setFromRotationMatrix(B);
}
const QUITO = { lat: -0.2202, lon: -78.5123 };
const T = new Date("2026-11-13T02:00:00Z");            // 12-nov-2026, 21:00 en Quito (UTC−5)

console.log("Coordenadas locales (visibilidad sobre el horizonte)");
{
  let worst = 0;
  const q = localSkyQuat(QUITO.lat, QUITO.lon, T);
  for (let i = 0; i < 200; i++) {
    const d = dir((i * 37.7) % 360, ((i * 13.3) % 180) - 90);
    const v = new THREE.Vector3(...d).applyQuaternion(q), l = eqToLocal(d[0], d[1], d[2], QUITO.lat, QUITO.lon, T);
    worst = Math.max(worst, Math.abs(v.x - l[0]), Math.abs(v.y - l[1]), Math.abs(v.z - l[2]));
  }
  ok(worst < 1e-9, "eqToLocal coincide con el cuaternión de la vista 3D (200 direcciones)", `error máx ${worst}`);
  // el polo norte celeste está a una altitud igual a la latitud, hacia el norte
  let p = altAz(0, 0, 1, 40, -3, T);
  ok(near(p.alt, 40, 1e-9) && (near(p.az, 0, 1e-6) || near(p.az, 360, 1e-6)), "polo norte celeste: altitud = latitud (40° N), azimut norte", JSON.stringify(p));
  p = altAz(0, 0, 1, QUITO.lat, QUITO.lon, T);
  ok(p.alt < 0 && !isAboveHorizon(p.alt), "desde Quito (0,22° S) el polo norte celeste queda bajo el horizonte", JSON.stringify(p));
  // un astro con declinación = latitud y ascensión recta = tiempo sidéreo local está en el cenit
  const lst = (gmstRad(T) / D2R + QUITO.lon + 360) % 360;
  p = altAz(...dir(lst, QUITO.lat), QUITO.lat, QUITO.lon, T);
  ok(near(p.alt, 90, 1e-5), "RA = tiempo sidéreo local y Dec = latitud → cenit", JSON.stringify(p));
  // 6 h antes del meridiano, en el ecuador celeste → saliendo exactamente por el este
  p = altAz(...dir(lst + 90, 0), 0, QUITO.lon, T);
  ok(near(p.alt, 0, 1e-6) && near(p.az, 90, 1e-6), "ecuador celeste 6 h al este del meridiano → horizonte este", JSON.stringify(p));
  ok(isAboveHorizon(12) && !isAboveHorizon(-0.1) && !isAboveHorizon(4, 5) && !isAboveHorizon(NaN), "isAboveHorizon con altitud mínima");
  const a = altAzOfLocal(...local(33, 250));
  ok(near(a.alt, 33, 1e-9) && near(a.az, 250, 1e-9), "altAzOfLocal invierte la construcción alt/az");
}

console.log("Separación angular y flecha guía");
{
  ok(near(angularSep(0, 0, 0, 90), 90, 1e-9), "norte ↔ este en el horizonte = 90°");
  ok(near(angularSep(90, 0, 0, 123), 90, 1e-9), "cenit ↔ horizonte = 90°");
  ok(near(angularSep(10, 350, 10, 10), 2 * Math.asin(Math.cos(10 * D2R) * Math.sin(10 * D2R)) / D2R, 1e-9), "cruza 0°/360° sin saltos");
  ok(near(angularSep(45, 100, 45, 100), 0, 1e-6), "misma dirección = 0°");

  // cámara mirando al este a 30° de altitud (teléfono vertical en retrato, luego inclinado)
  const q = cameraQuat([0, 0, 0, 1], 270, 120, 0, 0, 0);
  const look = lookFromQuat(q[0], q[1], q[2], q[3], {});
  ok(near(look.alt, 30, 1e-6) && near(look.az, 90, 1e-6), "postura de prueba: mira al este, 30° sobre el horizonte", JSON.stringify(look));
  let g = guideArrow(q[0], q[1], q[2], q[3], ...local(30, 90));
  ok(g.sep < 1e-4, "objetivo en la mirada → separación 0", JSON.stringify(g));
  g = guideArrow(q[0], q[1], q[2], q[3], ...local(60, 90));
  ok(near(g.sep, 30, 1e-6) && (near(g.ang, 0, 1e-4) || near(g.ang, 360, 1e-4)), "objetivo 30° más alto → flecha hacia arriba, 30°", JSON.stringify(g));
  g = guideArrow(q[0], q[1], q[2], q[3], ...local(0, 90));
  ok(near(g.sep, 30, 1e-6) && near(g.ang, 180, 1e-4), "objetivo 30° más bajo → flecha hacia abajo", JSON.stringify(g));
  g = guideArrow(q[0], q[1], q[2], q[3], ...local(30, 130));
  ok(g.ang > 45 && g.ang < 135 && near(g.sep, angularSep(30, 90, 30, 130), 1e-6), "objetivo al sureste (derecha) → flecha hacia la derecha; separación = fórmula alt/az", JSON.stringify(g));
  g = guideArrow(q[0], q[1], q[2], q[3], ...local(30, 50));
  ok(g.ang > 225 && g.ang < 315, "objetivo al noreste (izquierda) → flecha hacia la izquierda", JSON.stringify(g));
  g = guideArrow(q[0], q[1], q[2], q[3], ...local(-30, 270));
  ok(near(g.sep, 180, 1e-4), "objetivo justo detrás → 180°", JSON.stringify(g));
  // contraste con three: proyección del objetivo en los ejes de la cámara
  let worst = 0;
  for (let i = 0; i < 100; i++) {
    const qq = cameraQuat([0, 0, 0, 1], (i * 47) % 360, ((i * 31) % 360) - 180, ((i * 17) % 180) - 90, [0, 90, 180, 270][i % 4], 0);
    const t = local(((i * 23) % 180) - 90, (i * 59) % 360);
    const tq = new THREE.Quaternion(qq[0], qq[1], qq[2], qq[3]);
    const c = new THREE.Vector3(...t).applyQuaternion(tq.clone().invert());
    const r = guideArrow(qq[0], qq[1], qq[2], qq[3], ...t);
    worst = Math.max(worst, Math.abs(r.cx - c.x), Math.abs(r.cy - c.y), Math.abs(r.sep - Math.acos(Math.max(-1, Math.min(1, -c.z))) / D2R));
  }
  ok(worst < 1e-6, "guideArrow coincide con three (100 posturas y objetivos al azar)", `error máx ${worst}`);

  let h = turnHint(30, 90, 50, 130);
  ok(near(h.dAz, 40) && near(h.dAlt, 20), "turnHint: 40° a la derecha y 20° arriba");
  h = turnHint(10, 350, 5, 20);
  ok(near(h.dAz, 30) && near(h.dAlt, -5), "turnHint cruza el norte por el camino corto (derecha 30°)");
  h = turnHint(10, 20, 10, 350);
  ok(near(h.dAz, -30), "turnHint: 30° a la izquierda");
}

console.log("Coordenadas galácticas");
{
  ok(near(galLat(...GAL_CENTER), 0, 1e-3), "el centro galáctico está en el plano (b ≈ 0)", String(galLat(...GAL_CENTER)));
  ok(near(galLat(...GAL_POLE), 90, 1e-6), "el polo galáctico tiene b = 90°");
  const p = galToEq(120, -35);
  ok(near(galLat(...p), -35, 0.01) && near(Math.hypot(...p), 1, 1e-3), "galToEq(l, b) devuelve una dirección unitaria con esa latitud");
  ok(near(sepDirs(...galToEq(0, 0), ...GAL_CENTER), 0, 0.01), "galToEq(0, 0) = centro galáctico");
  // Deneb (Cisne) está en plena Vía Láctea; la galaxia M87 (Virgo), lejos del plano
  ok(Math.abs(galLat(...dir(310.36, 45.28))) < 5, "Deneb queda a menos de 5° del plano galáctico");
  ok(galLat(...dir(187.71, 12.39)) > 70, "M87 queda cerca del polo galáctico norte");
}

console.log("Esta noche: Quito, 12-nov-2026, 21:00");
{
  const showers = JSON.parse(readFileSync(new URL("../public/meteorshowers.json", import.meta.url))).objects;
  const messier = JSON.parse(readFileSync(new URL("../public/deepsky.json", import.meta.url))).objects;
  const leo = showers.find((o) => o.name_en === "Leonids");
  ok(leo && leo.peak === "11-17" && showerActive(leo, new Date(2026, 10, 12)), "Leónidas: máximo el 17-nov y activas el 12-nov (datos del repo)");
  ok(daysToPeak(leo, new Date(2026, 10, 12, 21)) === 5, "faltan 5 días para el máximo de las Leónidas");
  const quad = showers.find((o) => o.name_en === "Quadrantids");
  ok(showerActive(quad, new Date(2026, 11, 30)) && showerActive(quad, new Date(2027, 0, 2)) && !showerActive(quad, new Date(2026, 10, 12)), "Cuadrántidas: ventana que cruza el fin de año");
  ok(daysToPeak(quad, new Date(2026, 11, 30)) === 4, "Cuadrántidas: el máximo más cercano es el del año siguiente");
  ok(moonPhaseKey(0.01, true) === "new" && moonPhaseKey(0.2, true) === "waxCrescent" && moonPhaseKey(0.5, false) === "lastQuarter" && moonPhaseKey(0.8, true) === "waxGibbous" && moonPhaseKey(0.99, false) === "full", "nombres de la fase lunar");

  const tn = computeTonight({ date: T, ...QUITO, ephemeris, showers, messier, constellations: [{ ab: "Peg", name: "Pegasus", dir: dir(340, 19) }, { ab: "Ori", name: "Orion", dir: dir(83, 5) }] });
  ok(!tn.shifted && tn.sunAlt < -18, "a las 21:00 es noche cerrada (Sol bajo −18°)", String(tn.sunAlt));
  const sat = tn.items.find((i) => i.key === "Saturno");
  ok(sat && sat.up && sat.alt > 30, "Saturno está alto sobre el horizonte", JSON.stringify(sat));
  // referencia independiente: ascensión recta/declinación de las efemérides → altitud por la fórmula clásica
  const b = ephemeris(T).find((x) => x.name === "Saturno");
  const lst = (gmstRad(T) / D2R + QUITO.lon + 360) % 360, H = (lst - b.ra) * D2R;
  const altRef = Math.asin(Math.sin(QUITO.lat * D2R) * Math.sin(b.dec * D2R) + Math.cos(QUITO.lat * D2R) * Math.cos(b.dec * D2R) * Math.cos(H)) / D2R;
  ok(near(sat.alt, altRef, 0.01), "altitud de Saturno = fórmula sin(alt) = sinφ·sinδ + cosφ·cosδ·cosH", `${sat.alt} vs ${altRef}`);
  ok(tn.items.every((i) => i.up ? i.alt > 0 : i.kind === "moon" ? i.alt <= 0 : (i.rise && i.rise.date > T)), "todo lo listado está sobre el horizonte o trae su hora de salida (la Luna puede figurar como ya puesta)");
  const mo = tn.items.find((i) => i.kind === "moon");
  ok(mo && !mo.up && mo.phase === "waxCrescent", "esa noche la Luna (creciente fina) ya se ha puesto a las 21:00", JSON.stringify(mo));
  const sh = tn.items.filter((i) => i.kind === "shower");
  ok(sh.length >= 1 && sh[0].obj.name_en === "Leonids" && sh[0].toPeak === 5, "la lluvia más cercana a su máximo es la de las Leónidas", JSON.stringify(sh.map((s) => [s.key, s.toPeak])));
  ok(!sh[0].up && sh[0].rise, "a las 21:00 el radiante de las Leónidas aún no ha salido: se da su hora de salida", JSON.stringify(sh[0].rise));
  ok(tn.items.some((i) => i.key === "Peg") && !tn.items.some((i) => i.key === "Ori"), "Pegaso (alto) se destaca; Orión (aún bajo) no");
  console.log("     lista:", tn.items.map((i) => `${i.key} ${i.up ? Math.round(i.alt) + "° az " + Math.round(i.az) : i.rise ? "sale " + i.rise.date.toISOString().slice(11, 16) + "Z" : "bajo el horizonte"}`).join(" · "));

  // de día se calcula para cuando oscurezca
  const day = computeTonight({ date: new Date("2026-11-12T20:00:00Z"), ...QUITO, ephemeris, showers, messier, constellations: [] });
  ok(day.shifted && day.evalDate > new Date("2026-11-12T23:00:00Z") && day.evalDate < new Date("2026-11-13T00:30:00Z"), "a las 15:00 (de día) se calcula para el anochecer de Quito (~18:50)", day.evalDate.toISOString());

  // salida de un astro fijo: Sirio desde Quito esa noche
  const sirius = dir(101.287, -16.716);
  const r = nextRise(() => sirius, QUITO.lat, QUITO.lon, T, 12);
  const pa = r && altAz(...sirius, QUITO.lat, QUITO.lon, r.date);
  ok(r && Math.abs(pa.alt) < 0.3 && pa.az > 90 && pa.az < 120, "nextRise: Sirio sale por el este-sureste y a esa hora su altitud es ≈ 0°", r && `${r.date.toISOString()} alt ${pa.alt}`);
  ok(nextRise(() => dir(10, -80), 40, -3, T, 24) === null, "nextRise devuelve null para un astro que nunca sale (Dec −80° visto desde 40° N)");
  ok(nextRise(() => dir((gmstRad(T) / D2R + QUITO.lon + 360) % 360, 0), QUITO.lat, QUITO.lon, T, 12) === null, "nextRise devuelve null si el astro ya está arriba");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
