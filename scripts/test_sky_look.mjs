// Pruebas de src/sky/look.js: la vista del Cielo desde DENTRO de la esfera celeste.
// Uso:  node scripts/test_sky_look.mjs     (sale con código 1 si algo falla)
// Comprueba con estrellas reales (public/sky.json) que las figuras NO salen espejadas,
// que el cielo sigue al dedo, el zoom por campo de visión y la selección por toque.
import * as THREE from "three";
import { readFileSync } from "node:fs";
import {
  lookFrame, dirToYawPitch, yawPitchToDir, lookQuat, spanToFov, shortToSpan, dragDelta, clampPitch,
  localSkyQuat, localDefaultAz, screenOf, rankHits, starScaleFor, SPAN_DEF, PITCH_MIN_LOCAL, PITCH_MAX,
} from "../src/sky/look.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => {
  if (cond) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FALLA ${name} ${detail}`); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sky = JSON.parse(readFileSync(new URL("../public/sky.json", import.meta.url), "utf8"));
const star = (n) => { const s = sky.stars.find((x) => x[7] === n); if (!s) throw new Error("falta " + n); return new THREE.Vector3(s[1], s[2], s[3]); };
const centroid = (ab) => {
  const byHip = new Map(sky.stars.map((s) => [s[0], s])), seen = new Set(), v = new THREE.Vector3();
  sky.constellations.find((c) => c.ab === ab).lines.forEach((pl) => pl.forEach((h) => { if (seen.has(h)) return; seen.add(h); const s = byHip.get(h); if (s) v.add(new THREE.Vector3(s[1], s[2], s[3])); }));
  return v.normalize();
};
// cámara en el origen mirando a `dir` en el marco qF, como en la app (390×844, retrato)
const W = 390, H = 844;
const camAt = (dir, qF, span = SPAN_DEF) => {
  const cam = new THREE.PerspectiveCamera(spanToFov(span, W / H), W / H, 0.1, 6000);
  const yp = dirToYawPitch(dir, qF);
  cam.position.set(0, 0, 0); lookQuat(yp.yaw, yp.pitch, qF, cam.quaternion); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return { cam, yp };
};
const scr = (cam, v, mode = "in") => screenOf(cam, v.clone().multiplyScalar(900), W, H, mode, {});

console.log("Marcos y conversión mirada ↔ dirección");
{
  for (const local of [true, false]) {
    const qF = lookFrame(local);
    let worst = 0;
    for (const [y, p] of [[0, 0], [1, 0.3], [-2, -0.7], [3, 1.2], [0.5, -1.4]]) {
      const d = yawPitchToDir(y, p, qF), r = dirToYawPitch(d, qF);
      worst = Math.max(worst, Math.abs(r.pitch - p), Math.abs(Math.atan2(Math.sin(r.yaw - y), Math.cos(r.yaw - y))));
      // la cámara mira exactamente a esa dirección
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuat(y, p, qF));
      worst = Math.max(worst, f.distanceTo(d));
    }
    ok(worst < 1e-9, `${local ? "local" : "ecuatorial"}: ida y vuelta exacta y la cámara mira a la dirección`, worst);
  }
  const qL = lookFrame(true);
  ok(yawPitchToDir(0, 0, qL).distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-12, "local: yaw 0 = norte (−Z)");
  ok(yawPitchToDir(Math.PI / 2, 0, qL).distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-12, "local: yaw 90° = este (+X)");
  ok(yawPitchToDir(0, Math.PI / 2, qL).distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-12, "local: pitch 90° = cenit (+Y)");
  const qE = lookFrame(false);
  ok(yawPitchToDir(1.1, Math.PI / 2, qE).distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-12, "ecuatorial: pitch 90° = polo norte celeste");
  // el "arriba" de la pantalla es el cenit (o el polo): la cámara no queda ladeada
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(lookQuat(0.7, 0.2, qE));
  ok(up.z > 0.9, "ecuatorial: el arriba de la pantalla apunta al norte celeste", up.z.toFixed(3));
}

console.log("Orientación real de Orión (sin ubicación: norte arriba)");
{
  const qE = lookFrame(false), { cam } = camAt(centroid("Ori"), qE);
  const b = scr(cam, star("Betelgeuse")), r = scr(cam, star("Rigel"));
  ok(b && r, "Betelgeuse y Rigel en pantalla");
  if (b && r) {
    ok(b.x < r.x, "Betelgeuse a la IZQUIERDA de Rigel (no espejado)", `B ${b.x.toFixed(0)} R ${r.x.toFixed(0)}`);
    ok(b.y < r.y, "Betelgeuse ARRIBA de Rigel", `B ${b.y.toFixed(0)} R ${r.y.toFixed(0)}`);
  }
  // el cinturón: Alnitak (este) a la izquierda de Mintaka (oeste)
  const al = scr(cam, star("Alnitak")), mi = scr(cam, star("Mintaka"));
  ok(al && mi && al.x < mi.x, "cinturón: Alnitak a la izquierda de Mintaka", al && mi ? `${al.x.toFixed(0)} / ${mi.x.toFixed(0)}` : "");
  // la Osa Mayor: Dubhe (α) a la derecha de Alkaid (η) visto con el norte arriba y la Osa hacia el sur del polo
  const { cam: c2 } = camAt(centroid("UMa"), qE);
  const du = scr(c2, star("Dubhe")), ak = scr(c2, star("Alkaid"));
  ok(du && ak && du.x > ak.x, "Osa Mayor: Dubhe a la derecha de Alkaid (como en el cielo)", du && ak ? `${du.x.toFixed(0)} / ${ak.x.toFixed(0)}` : "");
}

console.log("Mi cielo en Quito, 13-nov-2026 23:00 (UTC−5)");
{
  const date = new Date("2026-11-14T04:00:00Z");
  const q = localSkyQuat(-0.2202, -78.5123, date), qL = lookFrame(true);
  const ori = centroid("Ori").applyQuaternion(q);
  const alt = Math.asin(ori.y) * R2D, az = ((Math.atan2(ori.x, -ori.z) * R2D) + 360) % 360;
  ok(alt > 5 && alt < 60, "Orión sobre el horizonte, ascendiendo", `alt ${alt.toFixed(1)}°`);
  ok(az > 60 && az < 120, "Orión hacia el ESTE", `az ${az.toFixed(1)}°`);
  // asciende: una hora antes estaba más bajo
  const ori0 = centroid("Ori").applyQuaternion(localSkyQuat(-0.2202, -78.5123, new Date(date.getTime() - 3600e3)));
  ok(ori0.y < ori.y, "una hora antes estaba más bajo (asciende por el este)");
  const { cam } = camAt(ori, qL);
  const b = scr(cam, star("Betelgeuse").applyQuaternion(q)), r = scr(cam, star("Rigel").applyQuaternion(q));
  ok(b && r, "Betelgeuse y Rigel en pantalla mirando a Orión");
  if (b && r) {
    // mirando al este desde el ecuador: el norte (Betelgeuse, dec +7°) queda a la izquierda y,
    // como sale ~40 min después que Rigel, más baja
    ok(b.x < r.x, "Betelgeuse a la izquierda (hacia el norte)", `B ${b.x.toFixed(0)} R ${r.x.toFixed(0)}`);
    ok(b.y > r.y, "Betelgeuse más baja que Rigel (sale después)", `B ${b.y.toFixed(0)} R ${r.y.toFixed(0)}`);
  }
  // puntos cardinales vistos desde dentro: mirando al sur, el este a la izquierda; mirando al norte, a la derecha
  const { cam: cs } = camAt(yawPitchToDir(180 * D2R, 0.3, qL), qL);
  const eS = scr(cs, yawPitchToDir(165 * D2R, 0.3, qL)), wS = scr(cs, yawPitchToDir(195 * D2R, 0.3, qL));
  ok(eS && wS && eS.x < W / 2 && wS.x > W / 2, "mirando al sur: sureste a la izquierda, suroeste a la derecha");
  const { cam: cn } = camAt(yawPitchToDir(0, 0.3, qL), qL);
  const eN = scr(cn, yawPitchToDir(30 * D2R, 0.3, qL));
  ok(eN && eN.x > W / 2, "mirando al norte: el noreste a la derecha");
  ok(localDefaultAz(-0.22) === 90 && localDefaultAz(40) === 180 && localDefaultAz(-34) === 0, "mirada inicial: este en el trópico, sur al norte, norte al sur");
}

console.log("Arrastre: el cielo sigue al dedo");
{
  const qE = lookFrame(false);
  for (const [dx, dy, p0] of [[60, 0, 0.1], [-45, 0, -0.4], [0, 50, 0.2], [0, -70, 0.6], [40, 30, 0]]) {
    const { cam, yp } = camAt(yawPitchToDir(1.3, p0, qE), qE);
    const target = yawPitchToDir(1.3, p0, qE);                  // el punto del cielo que está bajo el centro
    const s0 = scr(cam, target);
    const dd = dragDelta(dx, dy, cam.fov, H, yp.pitch);
    lookQuat(yp.yaw + dd.dyaw, yp.pitch + dd.dpitch, qE, cam.quaternion); cam.updateMatrixWorld();
    const s1 = scr(cam, target);
    const ex = s1.x - s0.x, ey = s1.y - s0.y;
    ok(Math.abs(ex - dx) < Math.abs(dx) * 0.2 + 2 && Math.abs(ey - dy) < Math.abs(dy) * 0.2 + 2,
      `dedo (${dx}, ${dy}) px → el cielo se mueve (${ex.toFixed(1)}, ${ey.toFixed(1)}) px`);
  }
  ok(clampPitch(-0.5, 0, PITCH_MIN_LOCAL, PITCH_MAX) === -0.5, "Mi cielo: se puede mirar bajo el horizonte");
  ok(clampPitch(-2, -1.5, PITCH_MIN_LOCAL, PITCH_MAX) === PITCH_MIN_LOCAL, "Mi cielo: hasta el nadir, no más");
  ok(Math.abs(PITCH_MIN_LOCAL + PITCH_MAX) < 1e-12, "Mi cielo llega al nadir igual que al cenit");
  ok(clampPitch(-0.6, -0.7, -0.5, PITCH_MAX) === -0.6, "bajo un límite (tras una búsqueda) se puede subir");
  ok(clampPitch(-0.8, -0.7, -0.5, PITCH_MAX) === -0.7, "… pero no bajar más");
  ok(clampPitch(2, 1.5, PITCH_MIN_LOCAL, PITCH_MAX) === PITCH_MAX, "no se pasa del cenit");
}

console.log("Zoom por campo de visión");
{
  ok(near(spanToFov(100, 390 / 844), 100, 1e-9), "retrato: el span es el campo vertical");
  const f = spanToFov(100, 1366 / 900), hf = 2 * Math.atan(Math.tan(f * D2R / 2) * 1366 / 900) * R2D;
  ok(near(hf, 100, 1e-9), "apaisado: el span es el campo horizontal", hf);
  const s = shortToSpan(40, 390 / 844), hf2 = 2 * Math.atan(Math.tan(spanToFov(s, 390 / 844) * D2R / 2) * 390 / 844) * R2D;
  ok(near(hf2, 40, 1e-9), "encuadre: 40° en el lado corto del teléfono", hf2);
  ok(starScaleFor(20) > starScaleFor(100), "las estrellas crecen un poco al acercar");
}

console.log("Selección: solo lo que se ve, y el más cercano en pantalla");
{
  const qE = lookFrame(false), dir = centroid("Ori"), { cam } = camAt(dir, qE);
  ok(scr(cam, dir.clone().negate()) === null, "lo que está detrás del observador nunca se proyecta");
  ok(scr(cam, yawPitchToDir(dirToYawPitch(dir, qE).yaw + Math.PI / 2, 0, qE)) === null, "a 90° (fuera del encuadre) tampoco");
  // vista opcional desde fuera: el hemisferio trasero se descarta aunque quede delante de la cámara
  const out = new THREE.PerspectiveCamera(55, W / H, 0.1, 6000);
  out.position.set(0, 0, 1700); out.lookAt(0, 0, 0); out.updateMatrixWorld();
  ok(screenOf(out, new THREE.Vector3(0, 0, 900), W, H, "out", {}) !== null, "desde fuera: la cara delantera sí");
  ok(screenOf(out, new THREE.Vector3(0, 0, -900), W, H, "out", {}) === null, "desde fuera: la cara trasera (detrás de la bola) no");
  ok(screenOf(out, new THREE.Vector3(0, 0, -900), W, H, "in", {}) !== null, "(sin la regla de la cara trasera se habría colado)");
  // desempates
  let r = rankHits([{ id: "estrella", sx: 100, sy: 100, prio: 2 }, { id: "marte", sx: 112, sy: 100, r: 14, prio: 10 }], 104, 100, 28);
  ok(r.best.id === "marte", "toque entre una estrella débil y un planeta igual de cerca → el planeta");
  r = rankHits([{ id: "vega", sx: 100, sy: 100, prio: 6 }, { id: "debil", sx: 80, sy: 100, prio: 2 }], 81, 100, 28);
  ok(r.best.id === "debil", "si el dedo está claramente sobre otro objeto, gana ese");
  r = rankHits([{ id: "a", sx: 100, sy: 100 }, { id: "b", sx: 150, sy: 100 }], 120, 100, 28);
  ok(r.best.id === "a" && r.same.length === 1, "el más cercano en pantalla; los lejanos no van al selector");
  r = rankHits([{ id: "marte", sx: 200, sy: 200, r: 14, prio: 10 }, { id: "maven", sx: 203, sy: 201, prio: 6 }, { id: "mro", sx: 199, sy: 204, prio: 6 }], 201, 201, 28);
  ok(r.best.id === "marte" && r.same.length === 3, "Marte y sus orbitadores → selector con los tres, Marte primero");
  r = rankHits([{ id: "a", sx: 100, sy: 100 }], 140, 100, 28);
  ok(r.best === null, "fuera del radio táctil (28 px) no se elige nada");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
