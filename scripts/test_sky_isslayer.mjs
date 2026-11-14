// Pruebas de src/sky/issLayer.js: la ISS dibujada en el Cielo (three.js sin WebGL: geometría, proyección de
// etiquetas, reloj de reproducción) y su encaje con el marco de la escena.
// Uso:  node scripts/test_sky_isslayer.mjs     (sale con código 1 si algo falla)
//
// Datos: las mismas tres pasadas REALES de backend/app/iss.py que usa scripts/test_sky_iss.mjs (se leen de
// allí para no duplicar el JSON) y su `truth_overhead`: posiciones SGP4 cada 7 s de la pasada casi cenital,
// en instantes que no son puntos de la trayectoria.
// Referencias independientes:
//   · el marco: localSkyQuat de look.js (lo que gira las estrellas en «Mi cielo») aplicado a la dirección
//     ecuatorial de cada punto (altAzToEquatorial) debe dar el mismo vector que la capa dibuja;
//   · la culminación del servidor (`max`) frente a los vértices de las geometrías (drawnCheck);
//   · SGP4 (truth_overhead) frente a la polilínea dibujada.
import * as THREE from "three";
import { readFileSync } from "node:fs";
import {
  IssLayer, minuteTicks, motionTangent, arrowHead, tickMark, ringAround, segmentArrays, offsetPolyline, arcDistance,
  localToAltAz, thinLabels, stepClock, nextRate, pillState, ISS_RATES, DT_CAP_MS, EDGE_MS,
} from "../src/sky/issLayer.js";
import { altAzToLocal, altAzToEquatorial, issPositionAt, passSpan } from "../src/sky/issSky.js";
import { normalizePasses, formatClock } from "../src/sky/issPasses.js";
import { localSkyQuat } from "../src/sky/look.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const D = Math.PI / 180;
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))))) / D;
const sepAA = (a1, z1, a2, z2) => Math.acos(Math.max(-1, Math.min(1, Math.sin(a1 * D) * Math.sin(a2 * D) + Math.cos(a1 * D) * Math.cos(a2 * D) * Math.cos((z1 - z2) * D)))) / D;

const SRC = readFileSync(new URL("./test_sky_iss.mjs", import.meta.url), "utf8");
const FIX = JSON.parse(SRC.match(/String\.raw`(\{.*?\})`\);/s)[1]);
const N = normalizePasses({ passes: [FIX.passes.overhead, FIX.passes.shadow_end, FIX.passes.quito_day] });
const byStart = Object.fromEntries(N.passes.map((p) => [p.start.t, p]));
const over = byStart["2026-11-15T17:31:13Z"], shadow = byStart["2026-11-14T18:19:10Z"], day = byStart["2026-11-14T19:35:37Z"];
const MADRID = [40.42, -3.70], QUITO = [-0.22, -78.51];

console.log("Marco: la ISS en el mismo marco que las estrellas");
{
  ok(ang(altAzToLocal(0, 0), [0, 0, -1]) < 1e-9 && ang(altAzToLocal(0, 90), [1, 0, 0]) < 1e-9 && ang(altAzToLocal(90, 123), [0, 1, 0]) < 1e-9,
    "norte = −Z, este = +X, cenit = +Y (como el suelo, el horizonte y los puntos cardinales de la escena)");
  // cada punto de las pasadas: dirección ecuatorial → localSkyQuat (lo que gira estrellas, planetas y guías)
  let worst = 0, n = 0;
  for (const [p, [lat, lon]] of [[over, MADRID], [shadow, MADRID], [day, QUITO]]) {
    for (const q of p.track) {
      const date = new Date(Date.parse(q.t));
      const eq = altAzToEquatorial(q.alt, q.az, lat, lon, date);
      const w = new THREE.Vector3(eq[0], eq[1], eq[2]).applyQuaternion(localSkyQuat(lat, lon, date));
      worst = Math.max(worst, ang([w.x, w.y, w.z], altAzToLocal(q.alt, q.az))); n++;
    }
  }
  ok(worst < 1e-5, `los ${n} puntos caen donde caería una estrella con esa altura/azimut (peor ${worst.toExponential(1)}°)`);
  const aa = localToAltAz(...altAzToLocal(37.5, 211.25));
  ok(near(aa.alt, 37.5, 1e-9) && near(aa.az, 211.25, 1e-9), "localToAltAz deshace altAzToLocal");
}

console.log("Marcas de cada minuto, tangente, flecha, anillo");
{
  const ticks = minuteTicks(shadow);
  const iso = ticks.map((k) => new Date(k.tMs).toISOString().slice(11, 16));
  ok(JSON.stringify(iso) === JSON.stringify(["18:20", "18:21", "18:22", "18:23", "18:24", "18:25"]), "minutos en punto dentro de la pasada 18:19:10–18:25:35", iso.join(" "));
  ok(ticks.every((k) => k.tMs % 60000 === 0), "todas en el segundo 0");
  ok(JSON.stringify(ticks.map((k) => k.lit)) === JSON.stringify([true, true, true, true, false, false]), "las de 18:24 y 18:25 ya van por la sombra (la ISS entra en ella a las 18:23:48)");
  const [s0, s1] = passSpan(shadow);
  ok(ticks.every((k) => k.tMs - s0 >= 20000 && s1 - k.tMs >= 20000), "lejos (≥ 20 s) del inicio y del fin, que llevan marca propia");
  ok(minuteTicks(shadow, { everyS: 120 }).length === 3 && minuteTicks({ track: [] }).length === 0, "cada 2 min si se pide; sin trayectoria, ninguna");
  let worstPerp = 0, forward = true, unit = true;
  for (const t of [s0, s0 + 30000, over.maxMs, s1 - 1000, s1]) {
    for (const p of [shadow, over]) {
      const [a, b] = passSpan(p); if (t < a || t > b) continue;
      const tg = motionTangent(p, t), pos = issPositionAt(p, t).local;
      unit = unit && near(Math.hypot(...tg), 1, 1e-9);
      worstPerp = Math.max(worstPerp, Math.abs(tg[0] * pos[0] + tg[1] * pos[1] + tg[2] * pos[2]));
      const ahead = issPositionAt(p, Math.min(b, t + 3000)).local, back = issPositionAt(p, Math.max(a, t - 3000)).local;
      forward = forward && (tg[0] * (ahead[0] - back[0]) + tg[1] * (ahead[1] - back[1]) + tg[2] * (ahead[2] - back[2])) > 0;
    }
  }
  ok(unit && worstPerp < 1e-9 && forward, "tangente: unitaria, en el plano tangente a la esfera y en el sentido del movimiento");
  const p = altAzToLocal(30, 100), tg = [0, Math.cos(30 * D), 0]; // vector cualquiera: se ortogonaliza
  const t2 = (() => { const k = tg[0] * p[0] + tg[1] * p[1] + tg[2] * p[2]; const v = [tg[0] - k * p[0], tg[1] - k * p[1], tg[2] - k * p[2]]; const n = Math.hypot(...v); return v.map((x) => x / n); })();
  const [[, w1], [, w2]] = arrowHead(p, t2, 2.2, 1.3);
  const expect = Math.atan(Math.hypot(Math.tan(2.2 * D), Math.tan(1.3 * D))) / D;
  ok(near(ang(p, w1), expect, 1e-6) && near(ang(p, w2), expect, 1e-6), "flecha: alas a la misma distancia angular del vértice", `${ang(p, w1).toFixed(4)} vs ${expect.toFixed(4)}`);
  const behind = (w) => (w[0] - p[0]) * t2[0] + (w[1] - p[1]) * t2[1] + (w[2] - p[2]) * t2[2] < 0;
  ok(behind(w1) && behind(w2) && ang(w1, w2) > 2, "flecha: las alas quedan detrás de la punta (apunta hacia donde va la ISS) y abiertas");
  const [m0, m1] = tickMark(p, t2, 0.9);
  const mid = [m0[0] + m1[0], m0[1] + m1[1], m0[2] + m1[2]], dm = [m1[0] - m0[0], m1[1] - m0[1], m1[2] - m0[2]];
  ok(near(ang(m0, m1), 1.8, 1e-3) && ang(mid, p) < 1e-6 && Math.abs(dm[0] * t2[0] + dm[1] * t2[1] + dm[2] * t2[2]) < 1e-9, "marca de minuto: 1,8° centrada en el punto y perpendicular a la trayectoria");
  const ring = ringAround(altAzToLocal(85, 10), 1.1, 24);
  ok(ring.length === 24 && ring.every((q) => near(ang(q, altAzToLocal(85, 10)), Math.atan(Math.tan(1.1 * D)) / D, 1e-6)), "anillo de inicio: 24 puntos a 1,1° (también cerca del cenit)");
}

console.log("Tramos y trazo");
{
  const R = 880;
  const segs = segmentArrays(shadow, R);
  ok(segs.length === 2 && segs[0].lit === true && segs[1].lit === false, "pasada que entra en la sombra: un tramo iluminado y uno en sombra");
  const last = segs[0].positions.slice(-3), first = segs[1].positions.slice(0, 3);
  ok(last.every((v, i) => v === first[i]), "los tramos se tocan (sin hueco entre luz y sombra)");
  const allR = segs.every((s) => { for (let i = 0; i < s.positions.length; i += 3) if (!near(Math.hypot(s.positions[i], s.positions[i + 1], s.positions[i + 2]), R, 1e-3)) return false; return true; });
  ok(allR, "todos los vértices sobre la esfera de radio 880");
  ok(segmentArrays(day, R).length === 1 && segmentArrays(over, R).length === 1, "pasadas sin cambio de luz: un solo tramo");
  const off = offsetPolyline(segs[0].positions, 0.07);
  let wo = 0, wr = 0;
  for (let i = 0; i < off.length; i += 3) {
    const a = [segs[0].positions[i], segs[0].positions[i + 1], segs[0].positions[i + 2]], b = [off[i], off[i + 1], off[i + 2]];
    wo = Math.max(wo, Math.abs(ang(a, b) - 0.07)); wr = Math.max(wr, Math.abs(Math.hypot(...b) - R));
  }
  ok(wo < 1e-4 && wr < 1e-3, "trazo doble: la copia va desplazada 0,07° y sobre la misma esfera");
  // distancia a un arco de círculo máximo
  const A = [1, 0, 0], B = [0, 1, 0];
  ok(near(arcDistance([Math.SQRT1_2, Math.SQRT1_2, 0], A, B), 0, 1e-9), "arcDistance: punto del arco → 0");
  ok(near(arcDistance([Math.cos(5 * D) * Math.SQRT1_2, Math.cos(5 * D) * Math.SQRT1_2, Math.sin(5 * D)], A, B), 5, 1e-9), "arcDistance: 5° por encima del arco → 5°");
  ok(near(arcDistance([Math.cos(-20 * D), Math.sin(-20 * D), 0], A, B), 20, 1e-9), "arcDistance: fuera de los extremos → distancia al extremo");
  const k = thinLabels([{ x: 0, y: 0, prio: 2, n: "a" }, { x: 30, y: 0, prio: 4, n: "b" }, { x: 80, y: 0, prio: 2, n: "c" }, { x: 100, y: 0, prio: 1, n: "d" }], 46);
  ok(k.map((c) => c.n).join("") === "bc", "thinLabels: gana la prioridad y nadie a menos de 46 px", k.map((c) => c.n).join(""));
}

console.log("IssLayer (three, sin WebGL)");
{
  const L = new IssLayer({ radius: 880 });
  ok(L.setPass({ ...day, track: [] }) === false && !L.active, "sin trayectoria no dibuja nada");
  L.setPass(shadow);
  ok(!L.active, "sin marco local (fuera de «Mi cielo») no se dibuja");
  L.setLocalFrame(new THREE.Quaternion());
  ok(L.active && L.group.children.length === 2, "en «Mi cielo» sí: grupo con trayectoria y punto");
  const lines = L.trackGroup.children.filter((o) => o.type === "Line");
  ok(lines.some((o) => o.material.isLineDashedMaterial) && lines.some((o) => o.material.isLineBasicMaterial && !o.material.isLineDashedMaterial), "trazo continuo en la luz y discontinuo en la sombra");
  ok(L.group.children.every((o) => o.renderOrder === 1) && L.trackGroup.children.every((o) => o.renderOrder >= 0.9 && o.renderOrder < 2 && !o.material.depthWrite && !o.material.depthTest),
    "renderOrder entre las estrellas (0) y el suelo semitransparente (2), sin profundidad: el suelo la atenúa");
  const [s0, s1] = passSpan(shadow);
  ok(L.update(s0 - EDGE_MS - 1000) === false && !L.dot.visible && L.pos === null && L.dotWorld() === null, "antes de la pasada: sin punto (ni toque)");
  ok(L.update(s0 - 500) === true && L.dot.visible && L.pos.state === "during" && near(L.pos.alt, 10, 0.05), "a ±1 s del inicio ya se ve, en su punto de partida (el inicio viene redondeado al segundo)");
  L.update(shadow.maxMs);
  const dAt = sepAA(L.pos.alt, L.pos.az, shadow.max.alt, shadow.max.az);
  ok(dAt < 0.01, "a la hora de culminación, el punto está en la culminación del servidor", `${dAt.toFixed(4)}°`);
  ok(L.update(shadow.maxMs) === false, "sin cambios no pide redibujar");
  const w = L.dotWorld(new THREE.Vector3()), aaW = localToAltAz(w.x, w.y, w.z);
  ok(sepAA(aaW.alt, aaW.az, shadow.max.alt, shadow.max.az) < 0.01 && near(w.length(), 876, 0.01), "dotWorld: el mismo punto en coordenadas del mundo, un poco por delante de la línea");
  ok(L.dotMat.opacity === 1 && near(L.dotMat.size, 15, 1e-9), "iluminada: punto fuerte");
  L.setPixelRatio(2); L.update(Date.parse("2026-11-14T18:24:30Z"));
  ok(L.pos.lit === false && L.dotMat.opacity < 0.6 && L.dotMat.size < 15 * 2 && near(L.dotMat.size, 15 * 0.62 * 2, 1e-9), "en la sombra: punto pequeño y tenue (tamaño × densidad de píxeles)");
  const chk = L.drawnCheck(shadow.max.alt, shadow.max.az);
  ok(chk.distDeg < 1e-3 && near(chk.peakAlt, shadow.max_alt, 0.06), "lo dibujado pasa por la culminación del servidor y su altura máxima es max_alt (±0,05°)", JSON.stringify(chk));
  // etiquetas con una cámara en el centro mirando a la culminación
  const cam = new THREE.PerspectiveCamera(100, 390 / 600, 0.1, 6000);   // ~ el encuadre al volar (SPAN_DEF = 100°)
  const look = (alt, az) => { const v = altAzToLocal(alt, az); cam.position.set(0, 0, 0); cam.up.set(0, 1, 0); cam.lookAt(v[0], v[1], v[2]); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); };
  look(shadow.max.alt, shadow.max.az);
  L.setPixelRatio(1); L.update(shadow.maxMs);
  const clock = (ms) => formatClock(ms, { lang: "es", timeZone: "Europe/Madrid" });
  const labs = L.labelsForView(cam, { w: 390, h: 600 }, { clock });
  const dotLab = labs.find((l) => l.cls === "iss");
  ok(dotLab && dotLab.name === "ISS" && near(dotLab.x, 195, 1) && near(dotLab.y, 300, 1) && dotLab.pk.iss, "«ISS» junto al punto (en el centro de la vista) y tocable", dotLab && `${dotLab.x},${dotLab.y}`);
  const times = labs.filter((l) => l.cls === "iss_t");
  ok(times.length >= 2 && times.every((a, i) => times.every((b, j) => i === j || Math.hypot(a.x - b.x, a.y - b.y) >= 46)), "horas de los minutos: varias y nunca a menos de 46 px entre sí", times.map((l) => l.name).join(" "));
  ok(times.every((l) => Math.hypot(l.x - dotLab.x, l.y - dotLab.y) >= 46), "ninguna hora pisa el nombre «ISS»");
  ok(times.every((l) => /^\d\d:\d\d$/.test(l.name)) && times.some((l) => l.name === "19:22"), "hora local corta (Madrid: 18:22 UTC → 19:22)");
  look(-shadow.max.alt, shadow.max.az + 180);
  ok(L.labelsForView(cam, { w: 390, h: 600 }, { clock }).length === 0, "mirando hacia el lado contrario: ninguna etiqueta (nada detrás del observador)");
  // la línea dibujada frente a SGP4: cada posición verdadera cae sobre la polilínea (pasada casi cenital)
  L.setPass(over);
  let worst = 0;
  for (const [, alt, az] of FIX.truth_overhead) worst = Math.max(worst, L.drawnCheck(alt, az).distDeg);
  ok(worst < 0.1, `pasada a 73°: las ${FIX.truth_overhead.length} posiciones SGP4 caen a < 0,1° de la línea dibujada (peor ${worst.toFixed(3)}°)`);
  L.setPass(null);
  ok(!L.active && L.trackGroup.children.length === 0 && L.update(over.maxMs) === false, "setPass(null) la quita y libera la geometría");
  L.setPass(day); L.setLocalFrame(null);
  ok(!L.active, "al salir de «Mi cielo» deja de dibujarse");
  L.dispose();
  ok(L.group.parent === null && L.pass === null, "dispose");
}

console.log("Reproducción: velocidades y reloj al segundo");
{
  ok(JSON.stringify(ISS_RATES) === "[1,10,60]" && nextRate(1) === 10 && nextRate(10) === 60 && nextRate(60) === 1 && nextRate(7) === 10, "ciclo ×1 → ×10 → ×60 → ×1");
  const t0 = Date.parse("2026-11-14T18:19:10Z");
  const ck = { t: t0, playing: true, live: false, rate: 10, lastMin: Math.floor(t0 / 60000), endMs: Date.parse("2026-11-14T18:25:35Z") };
  let r = stepClock(ck, 16);
  ok(ck.t === t0 + 160 && !r.minute && !r.ended, "×10: un cuadro de 16 ms avanza 160 ms");
  stepClock(ck, 5000);
  ok(ck.t === t0 + 160 + DT_CAP_MS * 10, "tras una pausa larga del navegador el paso se recorta (sin saltos)");
  ck.t = t0 + 49000; r = stepClock(ck, 200);
  ok(r.minute && ck.lastMin === Math.floor((t0 + 51000) / 60000), "al cruzar el minuto avisa (para escribir whenStr una vez por minuto)");
  ck.t = ck.endMs + 14000; ok(!stepClock(ck, 16).ended, "hasta 15 s después del fin sigue");
  ck.t = ck.endMs + 15100; ok(stepClock(ck, 16).ended, "después se para");
  const live = { t: 0, playing: false, live: true, rate: 10, lastMin: 0 };
  stepClock(live, 16, 123456789);
  ok(live.t === 123456789, "en «ahora» sigue al reloj del sistema");
  const still = { t: 5, playing: false, live: false, rate: 60, lastMin: 0 };
  stepClock(still, 1000, 999);
  ok(still.t === 5, "en pausa no se mueve");
  ok(pillState({ lit: true }, 0, shadow) === "lit" && pillState({ lit: false }, 0, shadow) === "shadow" && pillState(null, shadow.startMs - 1, shadow) === "before" && pillState(null, shadow.endMs + 1, shadow) === "after", "estado de la píldora");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
if (failed) process.exit(1);
