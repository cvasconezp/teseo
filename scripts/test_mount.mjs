// Pruebas de «Estacionar montura» (src/sky/mountAlign.js): Sol, mediodía, equinoccio, círculo indio, líneas del suelo,
// estrella del polo y orden de los métodos. El Sol se compara con las efemérides de la app (src/ephemeris.js).
import * as m from "../src/sky/mountAlign.js";
import { ephemeris } from "../src/ephemeris.js";
import { altAz } from "../src/sky/guide.js";

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  ok   ", msg); } else { fail++; console.log("  FALLA", msg); } };
const near = (a, b, t) => Math.abs(a - b) <= t;
const CAY = [0.045, -78.145];

console.log("Sol");
for (const iso of ["2026-11-23T14:30:00Z", "2026-06-21T20:00:00Z", "2027-03-20T12:00:00Z", "2031-12-21T17:00:00Z"]) {
  const d = new Date(iso), s = ephemeris(d)[0], a = altAz(s.nx, s.ny, s.nz, CAY[0], CAY[1], d), b = m.sunAltAz(CAY[0], CAY[1], d.getTime());
  ok(near(a.alt, b.alt, 0.03) && near(a.az, b.az, 0.03), `${iso}: altura y acimut como las efemérides de la app (±0,03°)`);
}
const noon = m.solarNoon(CAY[1], Date.parse("2026-11-23T15:00:00Z"));
ok(new Date(noon - 5 * 3600000).toISOString().slice(11, 16) === "11:59", "mediodía solar en Cayambe el 23-nov-2026: 11:59");
ok(near(m.sunAltAz(CAY[0], CAY[1], noon).az, 180, 0.05) || near(m.sunAltAz(CAY[0], CAY[1], noon).az, 0, 0.05), "a mediodía el Sol está en el meridiano");
const madrid = m.solarNoon(-3.7, Date.parse("2026-02-11T10:00:00Z"));
ok(near((madrid % 86400000) / 60000, 12 * 60 + 14.8 + 14.2, 1.5), "mediodía en Madrid en febrero (ecuación del tiempo ≈ +14 min de retraso)");
const eq = m.nextEquinox(Date.parse("2026-11-23T00:00:00Z"));
ok(eq && eq.kind === "mar" && Math.abs(eq.t - Date.parse("2027-03-20T20:25:00Z")) < 20 * 60000, "próximo equinoccio: 20-mar-2027 ~20:25 UTC");
ok(m.equinoxToday(Date.parse("2027-03-20T17:00:00Z")) && !m.equinoxToday(Date.parse("2026-11-23T17:00:00Z")), "el método del equinoccio solo sirve ese día");

console.log("Sombra del gnomon");
const sp = m.shadowPlan(CAY[0], CAY[1], Date.parse("2026-11-23T15:00:00Z"));
ok(sp && !sp.equinox && sp.t2 - sp.t1 === 2 * sp.offsetH * 3600000 && sp.alt >= 15 && sp.alt <= 75, "círculo indio: dos marcas simétricas al mediodía, con el Sol entre 15° y 75°");
ok(near(sp.radiusM, 1 / Math.tan(sp.alt * Math.PI / 180), 1e-9) && sp.errDeg < 0.1, "radio = largo de la sombra; el error por la declinación del Sol, menor de 0,1°");
const a1 = m.sunAltAz(CAY[0], CAY[1], sp.t1), a2 = m.sunAltAz(CAY[0], CAY[1], sp.t2);
ok(near(a1.alt, a2.alt, 0.1) && Math.min(Math.abs((a1.az + a2.az) / 2 - 180), Math.abs(((a1.az + a2.az) / 2) % 360)) < 0.2, "las dos marcas: misma altura del Sol, simétricas respecto al meridiano");
ok(m.shadowPlan(78, 15, Date.parse("2026-12-21T12:00:00Z")) === null, "en la noche polar no hay plan de sombra");
const ns = m.noonShadow(CAY[0], CAY[1], Date.parse("2026-11-23T15:00:00Z"));
ok(ns.toward === "N" && ns.usable && near(ns.lengthM, 0.37, 0.02), "Cayambe en noviembre: la sombra de mediodía cae al norte, ~37 cm");
ok(!m.noonShadow(0, -78, Date.parse("2027-03-20T17:00:00Z")).usable, "en el ecuador el día del equinoccio el Sol pasa por el cenit: sin sombra útil a mediodía");
const gs = m.groundShadow(CAY[0], CAY[1], Date.parse("2026-11-23T14:30:00Z"));
ok(near(gs.shadowAz, (gs.sunAz + 180) % 360, 1e-9) && gs.usable, "celular en el suelo: la sombra apunta lejos del Sol");

console.log("Líneas y horizonte");
const gl = m.groundLines(0.045);
const jr = gl.find((l) => l.key === "junRise"), dr = gl.find((l) => l.key === "decRise");
ok(gl.length === 8 && near(jr.az, 90 - 23.44, 0.05) && near(dr.az, 90 + 23.44, 0.05), "en el ecuador los solsticios salen a 23,4° del este");
ok(m.groundLines(70).length === 4, "más allá del círculo polar no hay líneas de solsticio");
{
  const N = 1800, flat = { step_deg: 0.2, alt: new Array(N).fill(0) }, hill = { step_deg: 0.2, alt: new Array(N).fill(5) };
  const g0 = m.groundLines(0.045), az = (ls, k) => ls.find((l) => l.key === k).az;
  const r0 = m.groundLinesReal(0.045, flat, 2830), r5 = m.groundLinesReal(0.045, hill, 2830);
  ok(Math.abs(az(r0, "junRise") - az(g0, "junRise")) < 0.5 && Math.abs(az(r5, "junRise") - az(g0, "junRise")) < 0.5, "en el ecuador el Sol sube casi en vertical: un horizonte de 5° apenas corre el amanecer del solsticio");
  const m40 = m.groundLines(40.4), r40 = m.groundLinesReal(40.4, hill, 650);
  ok(az(r40, "junRise") - az(m40, "junRise") > 4 && az(m40, "junSet") - az(r40, "junSet") > 4, "a 40° de latitud, detrás de 5° de montaña el Sol del solsticio asoma varios grados más al este (y se oculta más al oeste)");
  ok(r40.some((l) => l.key === "eqRiseR") && Math.abs(az(r40, "eqRiseR") - 90) > 3 && m.groundLinesReal(10, null).length === m.groundLines(10).length, "los equinoccios con relieve como marcas; sin horizonte, las líneas planas de siempre");
  ok(Math.abs(m.refractionAt(0) - 0.575) < 0.02 && m.refractionAt(0, 0.71) < m.refractionAt(0), "refracción en el horizonte ≈ 34′ (menos en la altura)");
}
const hz = { step_deg: 1, alt: Array.from({ length: 360 }, (_, i) => (i === 0 ? 2 : 0.1)), bands: [
  { max_km: 20, alt: Array.from({ length: 360 }, (_, i) => (i === 0 ? 2 : 0.1)), dist_km: Array.from({ length: 360 }, () => 12) },
  { max_km: 100, alt: Array.from({ length: 360 }, () => 0.05), dist_km: Array.from({ length: 360 }, () => 80) }] };
const hn = m.horizonMark(hz, 0), hs = m.horizonMark(hz, 180);
ok(hn.clear && near(hn.alt, 2, 1e-9) && hn.distKm === 12 && !hs.clear, "el filo al norte verdadero: altura y distancia; un horizonte plano no sirve de referencia");
ok(m.horizonMark(null, 0) === null, "sin relieve, sin marca");

console.log("Estrella del polo");
const pz = m.poleStar(40.4, -3.7, Date.parse("2026-11-23T22:00:00Z"));
ok(pz.name === "Polaris" && near(pz.distDeg, 0.62, 0.02) && pz.clock >= 1 && pz.clock <= 12 && near(pz.alt, 40.4, 0.7), "la Polar a ~0,62° del polo y a la altura de la latitud");
const ps = m.poleStar(-33.9, 151.2, Date.parse("2026-11-23T12:00:00Z"));
ok(ps.name === "sigmaOct" && ps.hemi === "south" && near(ps.distDeg, 1.16, 0.05), "en el sur, σ Octantis a ~1,2° del polo");
ok(m.poleStar(0.045, -78.1, Date.now()) === null, "cerca del ecuador no hay estrella del polo útil");
const p6 = m.poleStar(45, 0, Date.parse("2026-11-23T00:00:00Z"));
ok(Number.isInteger(p6.clock) && near(((360 - p6.haDeg) / 30) % 12, p6.clock % 12, 0.5 + 1e-9) || near(((360 - p6.haDeg) / 30) % 12, 12, 0.5), "la hora del reloj sigue el ángulo horario (mirando al norte, el oeste a la izquierda)");

console.log("Líneas en el suelo (mountLinesLayer.js)");
{
  const { ribbon } = await import("../src/sky/mountLinesLayer.js");
  const r = ribbon(0, 0.2, 870), n = r.pos.length / 3;
  let okDir = true, maxAlt = -90;
  for (let i = 0; i < n; i++) { const x = r.pos[i * 3], y = r.pos[i * 3 + 1], z = r.pos[i * 3 + 2]; if (Math.abs(x) > 870 * Math.tan(0.21 * Math.PI / 180) + 1e-6 || z > 1e-6) okDir = false; maxAlt = Math.max(maxAlt, Math.asin(y / 870) * 180 / Math.PI); }
  ok(okDir && maxAlt < 0, "la norte–sur va del nadir al horizonte norte (−Z), con ancho angular constante");
  ok(ribbon(90, 0.2, 870, { to: 5 }).pos.some((v, i) => i % 3 === 1 && v > 870 * Math.sin(4.9 * Math.PI / 180)), "puede subir hasta el filo del relieve");
  ok(ribbon(66.6, 0.1, 870, { dash: 2.2 }).idx.length < ribbon(66.6, 0.1, 870).idx.length * 0.6, "las de solsticio, a trazos");
}

console.log("Métodos");
ok(m.methodsFor(0.04, { hasLandmark: true })[0].key === "landmark" && m.methodsFor(0.04, { hasLandmark: true })[0].rec, "en el ecuador con relieve: primero el cerro del norte");
ok(!m.methodsFor(0.04).some((x) => x.key === "polar") && m.methodsFor(0.04).find((x) => x.rec).key === "shadow", "en el ecuador no se ofrece la Polar; sin relieve, se recomienda la sombra");
ok(m.methodsFor(40).find((x) => x.rec).key === "polar", "en el hemisferio norte se recomienda la Polar");
ok(m.methodsFor(-34).some((x) => x.key === "polar") && m.methodsFor(-34)[0].key !== "polar", "en el sur σ Octantis se ofrece, pero no primero (es débil)");
ok(m.compassStatus("absolute", 8) === "ok" && m.compassStatus("absolute", 30) === "calibrate" && m.compassStatus("absolute", -1) === "calibrate" && m.compassStatus("relative", 5) === "none" && m.compassStatus("absolute", null) === "ok", "estado de la brújula");
ok(m.accClass(0.1) === "fine" && m.accClass(1) === "ok" && m.accClass(5) === "rough", "clases de precisión");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
