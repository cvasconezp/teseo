// Pruebas de src/sky/riseset.js: salida, culminación, puesta, mejor momento de la
// noche y retardo de la señal de radio.
// Uso:  node scripts/test_sky_riseset.mjs     (sale con código 1 si algo falla)
//
// Referencias independientes del código que se prueba:
//   · estrellas: fórmula analítica del ángulo horario, cos H = (sen h0 − sen φ sen δ) / (cos φ cos δ)
//   · Sol: algoritmo de la calculadora solar de NOAA (ecuación del tiempo + declinación),
//     distinto de las efemérides de Schlyter que usa la app
//   · retardo de señal: distancia / c
import { riseTransitSet, nightWindow, bestTonight, signalDelay, horizonFor, H0_STAR, H0_SUN, H0_MOON } from "../src/sky/riseset.js";
import { gmstRad, altAz, nextRise, nextCrossing } from "../src/sky/guide.js";
import { ephemeris } from "../src/ephemeris.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const dir = (raDeg, decDeg) => [Math.cos(decDeg * D2R) * Math.cos(raDeg * D2R), Math.cos(decDeg * D2R) * Math.sin(raDeg * D2R), Math.sin(decDeg * D2R)];
const QUITO = { lat: -0.2202, lon: -78.5123 };
const MADRID = { lat: 40.4168, lon: -3.7038 };
const T = new Date("2026-11-13T02:00:00Z");            // 12-nov-2026, 21:00 en Quito (UTC−5)
const minDiff = (a, b) => Math.abs(a.getTime() - b.getTime()) / 60000;
const hm = (d, off = -5) => new Date(d.getTime() + off * 3600000).toISOString().slice(11, 16);
const bodyAt = (name) => (d) => { const b = ephemeris(d).find((x) => x.name === name); return [b.nx, b.ny, b.nz]; };

// referencia analítica para una estrella fija: instantes de salida/culminación/puesta alrededor de `date`
function starRef(ra, dec, lat, lon, date, h0 = H0_STAR) {
  const cosH = (Math.sin(h0 * D2R) - Math.sin(lat * D2R) * Math.sin(dec * D2R)) / (Math.cos(lat * D2R) * Math.cos(dec * D2R));
  if (cosH > 1) return { never: true }; if (cosH < -1) return { always: true };
  const H = Math.acos(cosH) * R2D;
  const lst = (gmstRad(date) * R2D + lon + 720) % 360;
  let ha = ((lst - ra + 540) % 360) - 180;                      // ángulo horario actual, −180..180
  const SID = 86164.0905 / 360 * 1000;                           // ms por grado de ángulo horario
  const transit = date.getTime() - ha * SID;                     // culminación más cercana
  return { rise: new Date(transit - H * SID), transit: new Date(transit), set: new Date(transit + H * SID), up: Math.abs(ha) < H, maxAlt: 90 - Math.abs(lat - dec) };
}
// referencia NOAA para el Sol: salida y puesta (UTC) del día civil local
function noaaSun(lat, lon, y, m, d, tzHours) {
  const jd = Date.UTC(y, m - 1, d, 12 - tzHours) / 86400000 + 2440587.5;
  const Tc = (jd - 2451545) / 36525;
  const L0 = (280.46646 + Tc * (36000.76983 + Tc * 0.0003032)) % 360;
  const M = 357.52911 + Tc * (35999.05029 - 0.0001537 * Tc);
  const e = 0.016708634 - Tc * (0.000042037 + 0.0000001267 * Tc);
  const C = Math.sin(M * D2R) * (1.914602 - Tc * (0.004817 + 0.000014 * Tc)) + Math.sin(2 * M * D2R) * (0.019993 - 0.000101 * Tc) + Math.sin(3 * M * D2R) * 0.000289;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * Tc) * D2R);
  const eps0 = 23 + (26 + (21.448 - Tc * (46.815 + Tc * (0.00059 - Tc * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos((125.04 - 1934.136 * Tc) * D2R);
  const decl = Math.asin(Math.sin(eps * D2R) * Math.sin(lam * D2R)) * R2D;
  const yv = Math.tan(eps / 2 * D2R) ** 2;
  const eqT = 4 * R2D * (yv * Math.sin(2 * L0 * D2R) - 2 * e * Math.sin(M * D2R) + 4 * e * yv * Math.sin(M * D2R) * Math.cos(2 * L0 * D2R) - 0.5 * yv * yv * Math.sin(4 * L0 * D2R) - 1.25 * e * e * Math.sin(2 * M * D2R));
  const ha = Math.acos(Math.cos(90.833 * D2R) / (Math.cos(lat * D2R) * Math.cos(decl * D2R)) - Math.tan(lat * D2R) * Math.tan(decl * D2R)) * R2D;
  const noonMin = 720 - 4 * lon - eqT;                            // minutos UTC
  const at = (min) => new Date(Date.UTC(y, m - 1, d) + min * 60000);
  return { rise: at(noonMin - 4 * ha), set: at(noonMin + 4 * ha), noon: at(noonMin), decl };
}

console.log("Estrellas fijas frente a la fórmula analítica del ángulo horario");
{
  const cases = [
    ["Sirio desde Quito", 101.287, -16.716, QUITO], ["Betelgeuse desde Quito", 88.793, 7.407, QUITO],
    ["Vega desde Madrid", 279.234, 38.784, MADRID], ["Antares desde Madrid", 247.352, -26.432, MADRID],
    ["Canopus desde Quito", 95.988, -52.696, QUITO], ["Arturo desde Madrid", 213.915, 19.182, MADRID],
  ];
  let worst = 0;
  for (const [name, ra, dec, pl] of cases) {
    const v = dir(ra, dec), ref = starRef(ra, dec, pl.lat, pl.lon, T);
    const r = riseTransitSet(() => v, pl.lat, pl.lon, T);
    // el pase que da la función es el actual (si está arriba) o el siguiente: se compara módulo un día sidéreo
    const SIDDAY = 86164.0905 * 1000;
    const mod = (a, b) => { let d = Math.abs(a.getTime() - b.getTime()) % SIDDAY; return Math.min(d, SIDDAY - d) / 60000; };
    const e = Math.max(mod(r.rise.date, ref.rise), mod(r.set.date, ref.set), mod(r.transit.date, ref.transit));
    worst = Math.max(worst, e);
    ok(r.state === "normal" && e < 0.5 && Math.abs(r.transit.alt - ref.maxAlt) < 0.05 && r.upNow === ref.up, `${name}: salida, culminación y puesta a menos de 30 s de la fórmula`, `err ${e.toFixed(2)} min, alt ${r.transit.alt.toFixed(2)} vs ${ref.maxAlt.toFixed(2)}`);
    ok(r.rise.date < r.transit.date && r.transit.date < r.set.date, `${name}: orden salida < culminación < puesta`);
    ok(r.upNow ? (r.rise.date <= T && r.set.date >= T) : r.rise.date > T, `${name}: si está arriba, el pase contiene el instante; si no, la salida es futura`);
  }
  console.log(`        error máximo: ${worst.toFixed(3)} min`);
  const sir = riseTransitSet(() => dir(101.287, -16.716), QUITO.lat, QUITO.lon, T);
  ok(sir.rise.az > 90 && sir.rise.az < 120 && sir.set.az > 240 && sir.set.az < 270, "Sirio sale por el este-sureste y se pone por el oeste-suroeste", `${sir.rise.az.toFixed(1)} / ${sir.set.az.toFixed(1)}`);
  console.log(`        Sirio en Quito (12-nov-2026): sale ${hm(sir.rise.date)}, culmina ${hm(sir.transit.date)} a ${sir.transit.alt.toFixed(1)}°, se pone ${hm(sir.set.date)}`);
}

console.log("Astros que no salen o no se ponen");
{
  const hi = { lat: 60, lon: 10 };
  const a = riseTransitSet(() => dir(40, 80), hi.lat, hi.lon, T);
  ok(a.state === "always" && a.upNow && !a.rise && !a.set && Math.abs(a.transit.alt - 70) < 0.05, "δ = +80° desde 60° N: siempre sobre el horizonte, culmina a 70°", JSON.stringify(a.transit));
  const n = riseTransitSet(() => dir(40, -80), hi.lat, hi.lon, T);
  ok(n.state === "never" && !n.upNow && !n.rise && !n.transit, "δ = −80° desde 60° N: no sale");
  const pol = riseTransitSet(() => dir(37.95, 89.26), QUITO.lat, QUITO.lon, T);
  ok(pol.state === "normal" || pol.state === "never" || pol.state === "always", "la Polar desde el ecuador no rompe el cálculo");
  // verano polar: el Sol no se pone en Tromsø en junio
  const tromso = { lat: 69.65, lon: 18.96 }, june = new Date("2026-06-21T12:00:00Z");
  const s = riseTransitSet(bodyAt("Sol"), tromso.lat, tromso.lon, june, { minAlt: H0_SUN });
  ok(s.state === "always", "Sol de medianoche en Tromsø (21 de junio): siempre sobre el horizonte");
  ok(nightWindow(bodyAt("Sol"), tromso.lat, tromso.lon, june) === null, "…y no hay noche que calcular");
  ok(bestTonight(() => dir(0, 0), bodyAt("Sol"), tromso.lat, tromso.lon, june).reason === "nonight", "mejor momento: avisa de que no oscurece");
}

console.log("Sol frente al algoritmo de la calculadora solar de NOAA");
{
  for (const [name, pl, y, m, d, tz] of [["Quito, 12-nov-2026", QUITO, 2026, 11, 12, -5], ["Madrid, 21-jun-2026", MADRID, 2026, 6, 21, 2], ["Madrid, 21-dic-2026", MADRID, 2026, 12, 21, 1], ["Quito, 20-mar-2027", QUITO, 2027, 3, 20, -5]]) {
    const ref = noaaSun(pl.lat, pl.lon, y, m, d, tz);
    // desde el mediodía local: el Sol está arriba → salida de hoy (pasada) y puesta de hoy
    const r = riseTransitSet(bodyAt("Sol"), pl.lat, pl.lon, ref.noon, { minAlt: H0_SUN });
    const eR = minDiff(r.rise.date, ref.rise), eS = minDiff(r.set.date, ref.set), eN = minDiff(r.transit.date, ref.noon);
    ok(eR < 2 && eS < 2 && eN < 2, `${name}: salida, mediodía y puesta a menos de 2 min de NOAA`, `Δ ${eR.toFixed(2)} / ${eN.toFixed(2)} / ${eS.toFixed(2)} min`);
    console.log(`        ${name}: sale ${hm(r.rise.date, tz)} (NOAA ${hm(ref.rise, tz)}) · se pone ${hm(r.set.date, tz)} (NOAA ${hm(ref.set, tz)})`);
  }
  // de noche el Sol está abajo: la función da la próxima salida (el amanecer de mañana)
  const r = riseTransitSet(bodyAt("Sol"), QUITO.lat, QUITO.lon, T, { minAlt: H0_SUN });
  const ref = noaaSun(QUITO.lat, QUITO.lon, 2026, 11, 13, -5);
  ok(!r.upNow && minDiff(r.rise.date, ref.rise) < 2 && minDiff(r.set.date, ref.set) < 2, "de noche: da el amanecer y el atardecer siguientes", `${hm(r.rise.date)} ${hm(r.set.date)}`);
}

console.log("Luna y planetas (astros que se mueven)");
{
  const moon = riseTransitSet(bodyAt("Luna"), QUITO.lat, QUITO.lon, T, { minAlt: H0_MOON });
  ok(moon.state === "normal" && moon.rise && moon.set, "la Luna tiene salida y puesta en Quito");
  const altAt = (d) => { const v = bodyAt("Luna")(d); return altAz(v[0], v[1], v[2], QUITO.lat, QUITO.lon, d).alt; };
  ok(Math.abs(altAt(moon.rise.date) - H0_MOON) < 0.02 && Math.abs(altAt(moon.set.date) - H0_MOON) < 0.02, "en los instantes de salida y puesta la Luna está justo en el horizonte convencional");
  const dur = (moon.set.date - moon.rise.date) / 3600000;
  ok(dur > 11.5 && dur < 13.3, "en el ecuador la Luna pasa ~12 h y pico sobre el horizonte", `${dur.toFixed(2)} h`);
  // al día siguiente sale más tarde (≈ 50 min de media; entre 20 y 80)
  const next = riseTransitSet(bodyAt("Luna"), QUITO.lat, QUITO.lon, new Date(moon.rise.date.getTime() + 60000 + (moon.upNow ? 0 : 0)), { minAlt: H0_MOON });
  const r2 = riseTransitSet(bodyAt("Luna"), QUITO.lat, QUITO.lon, new Date(moon.set.date.getTime() + 3600000), { minAlt: H0_MOON });
  const lag = (r2.rise.date - moon.rise.date) / 60000 - 1440;
  ok(next.rise && lag > 20 && lag < 80, "la Luna sale cada día más tarde (entre 20 y 80 min)", `${lag.toFixed(0)} min`);
  for (const p of ["Venus", "Júpiter", "Saturno", "Marte"]) {
    const r = riseTransitSet(bodyAt(p), QUITO.lat, QUITO.lon, T);
    const a = (d) => { const v = bodyAt(p)(d); return altAz(v[0], v[1], v[2], QUITO.lat, QUITO.lon, d).alt; };
    ok(r.state === "normal" && Math.abs(a(r.rise.date) - H0_STAR) < 0.02 && Math.abs(a(r.set.date) - H0_STAR) < 0.02 && r.transit.alt > a(new Date(r.transit.date.getTime() + 1800000)), `${p}: cruces exactos en el horizonte y culminación en el máximo`);
  }
  ok(horizonFor("sun") === H0_SUN && horizonFor("moon") === H0_MOON && horizonFor("star") === H0_STAR, "horizonte convencional según el tipo de astro");
}

console.log("Coherencia con la búsqueda de salidas de «Esta noche»");
{
  const v = dir(101.287, -16.716);
  const a = nextRise(() => v, MADRID.lat, MADRID.lon, new Date("2026-11-13T15:00:00Z"), 14, 10, 0);
  const b = riseTransitSet(() => v, MADRID.lat, MADRID.lon, new Date("2026-11-13T15:00:00Z"), { minAlt: 0 });
  ok(a && minDiff(a.date, b.rise.date) < 1, "nextRise (interpolación lineal) y riseTransitSet (bisección) coinciden al minuto", a && `${minDiff(a.date, b.rise.date).toFixed(2)} min`);
  ok(nextRise(() => v, QUITO.lat, QUITO.lon, new Date("2026-11-13T05:00:00Z")) === null, "nextRise devuelve null si el astro ya está arriba");
  const s = nextCrossing(() => v, MADRID.lat, MADRID.lon, new Date("2026-11-13T23:00:00Z"), { dir: -1, maxHours: 24 });
  ok(s && minDiff(s.date, b.set.date) < 1, "nextCrossing con dir = −1 encuentra la puesta");
  const back = nextCrossing(() => v, MADRID.lat, MADRID.lon, new Date("2026-11-13T23:30:00Z"), { dir: 1, maxHours: 24, stepMin: -10 });
  ok(back && minDiff(back.date, b.rise.date) < 1, "nextCrossing hacia atrás encuentra la salida ya ocurrida");
}

console.log("Mejor momento de la noche");
{
  const sun = bodyAt("Sol");
  const nw = nightWindow(sun, QUITO.lat, QUITO.lon, T);
  ok(nw && nw.start < T && nw.end > T, "de noche: la ventana contiene el instante");
  const alt = (d) => { const v = sun(d); return altAz(v[0], v[1], v[2], QUITO.lat, QUITO.lon, d).alt; };
  ok(Math.abs(alt(nw.start) + 12) < 0.05 && Math.abs(alt(nw.end) + 12) < 0.05, "la noche empieza y acaba con el Sol a −12°", `${alt(nw.start).toFixed(2)} ${alt(nw.end).toFixed(2)}`);
  const day = new Date("2026-11-12T17:00:00Z");       // mediodía en Quito
  const nd = nightWindow(sun, QUITO.lat, QUITO.lon, day);
  ok(nd && nd.start > day && minDiff(nd.start, nw.start) < 1, "de día: es la noche siguiente (la misma)");
  // Sirio culmina de madrugada: el mejor momento es su culminación
  const v = dir(101.287, -16.716);
  const b = bestTonight(() => v, sun, QUITO.lat, QUITO.lon, T);
  const r = riseTransitSet(() => v, QUITO.lat, QUITO.lon, T);
  ok(b.ok && minDiff(b.date, r.transit.date) < 3 && Math.abs(b.alt - r.transit.alt) < 0.1, "Sirio: el mejor momento es su culminación, que cae de noche", b.ok && hm(b.date));
  // un astro pegado al Sol solo está arriba de día
  const sv = sun(T), bs = bestTonight(() => sv, sun, QUITO.lat, QUITO.lon, T);
  ok(!bs.ok && bs.reason === "daylight", "un astro en la dirección del Sol: solo está arriba con el cielo claro");
  // la Luna del 12-nov-2026 se pone hacia las 21:00 en Quito: a las 22:00 ya se puso (no es "solo de día")
  const moonLate = bestTonight(bodyAt("Luna"), sun, QUITO.lat, QUITO.lon, new Date("2026-11-13T03:00:00Z"), { sunLimit: -6 });
  ok(!moonLate.ok && moonLate.reason === "gone", "un astro que estuvo arriba al anochecer y ya se puso: «ya se puso», no «solo de día»", JSON.stringify(moonLate.reason));
  // si la culminación ya pasó, no se recomienda una hora pasada
  const late = new Date(r.transit.date.getTime() + 2 * 3600000);
  const bl = bestTonight(() => v, sun, QUITO.lat, QUITO.lon, late);
  ok(bl.ok ? bl.date >= late : true, "nunca recomienda una hora que ya pasó");
  // astro que de noche queda muy bajo
  const low = bestTonight(() => dir(40, 85), sun, QUITO.lat, QUITO.lon, T);
  ok(!low.ok && low.reason === "low" && low.alt < 10, "un astro que no pasa de 10° se marca como demasiado bajo", JSON.stringify(low.reason));
}

console.log("Retardo de una señal de radio");
{
  const AU = 149597870.7;
  const s = signalDelay(AU);
  ok(Math.abs(s.oneWay - 499.004784) < 1e-3 && Math.abs(s.roundTrip - 998.009568) < 2e-3, "1 UA = 499,005 s de ida (8 min 19 s) y el doble ida y vuelta", `${s.oneWay}`);
  ok(Math.abs(signalDelay(384400).oneWay - 1.2822) < 1e-3 && signalDelay(384400).band === "call", "Luna: 1,28 s de ida");
  ok(signalDelay(1.5e6).band === "seconds", "James Webb (1,5 millones de km): ida y vuelta de 10 s");
  ok(signalDelay(1.0 * AU).band === "minutes" && signalDelay(30 * AU).band === "hours", "Sol → minutos; Neptuno → horas");
  const v1 = signalDelay(170 * AU);
  ok(v1.band === "days" && Math.abs(v1.oneWay / 3600 - 23.564) < 0.01, "Voyager 1 a 170 UA: 23,6 h de ida, casi dos días ida y vuelta", `${(v1.oneWay / 3600).toFixed(3)}`);
  ok(signalDelay(0) === null && signalDelay(null) === null && signalDelay(-5) === null, "sin distancia no hay cifra");
}

console.log(`\n${passed} pruebas correctas, ${failed} con fallo`);
process.exit(failed ? 1 : 0);
