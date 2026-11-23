// Pruebas de src/route/smallBodies.js: Ceres (Kepler) contra JPL Horizons, el cinturón y sus huecos.
import { CERES, PLUTO, keplerXYZ, beltPoints, KIRKWOOD, freestAngle, kuiperPoints, kuiperR, KUIPER, trojanPoints, probeHelio, eqToEcl, cometOrbit, brightestComet } from "../src/route/smallBodies.js";
import { mapRadius, ORBIT_R } from "../src/route/hohmannMap.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FALLA", m); } };
const near = (a, b, t) => Math.abs(a - b) <= t;
// JPL Horizons, 2026-11-23 0 h TDB, heliocéntrico eclíptico: longitud 96,0625°, r 2,6309 UA (consultado el 22 nov 2026)
const c = keplerXYZ(CERES, new Date(Date.UTC(2026, 10, 23)));
const lon = (Math.atan2(c.y, c.x) * 180 / Math.PI + 360) % 360;
ok(near(lon, 96.0625, 0.05) && near(Math.hypot(c.x, c.y), 2.6309, 0.01), `Ceres donde lo da Horizons (${lon.toFixed(3)}°)`);
const c2 = keplerXYZ(CERES, new Date(Date.UTC(2026, 10, 23) + 1679.853 * 86400000));
ok(near(c2.x, c.x, 1e-3) && near(c2.y, c.y, 1e-3), "un periodo después vuelve al mismo sitio");
const pts = beltPoints(700);
ok(pts.length === 700 && pts.every((p) => p.au >= 2.1 && p.au <= 3.3), "700 puntos entre 2,1 y 3,3 UA");
ok(pts.every((p) => KIRKWOOD.every((g) => Math.abs(p.au - g) >= 0.025)), "sin puntos en los huecos de Kirkwood");
ok(JSON.stringify(beltPoints(50)) === JSON.stringify(beltPoints(50)), "el cinturón es siempre el mismo");
ok(mapRadius(2.1) > ORBIT_R(3) && mapRadius(3.3) < ORBIT_R(4), "en el mapa, el cinturón cae entre las órbitas de Marte y Júpiter");
const fa = freestAngle([0, Math.PI / 2, Math.PI]);
ok(near(fa, 3 * Math.PI / 2, 0.15), "el rótulo va al hueco más grande entre planetas");
// Plutón: Horizons da longitud 304,446° y r 35,546 UA el 2026-11-23 (consultado el 22 nov 2026)
const pl = keplerXYZ(PLUTO, new Date(Date.UTC(2026, 10, 23))), plon = (Math.atan2(pl.y, pl.x) * 180 / Math.PI + 360) % 360;
ok(near(plon, 304.446, 0.1) && near(Math.hypot(pl.x, pl.y), 35.546, 0.08), `Plutón donde lo da Horizons (${plon.toFixed(3)}°)`);
ok(kuiperR(30) === KUIPER.r0 && kuiperR(50) === KUIPER.r1 && kuiperR(80) === KUIPER.r1 && kuiperR(40) > KUIPER.r0 && kuiperR(40) < KUIPER.r1, "la franja de Kuiper va junto al borde, con la distancia dentro de ella");
ok(kuiperPoints(200).every((p) => p.au >= 30 && p.au <= 50), "puntos de Kuiper entre 30 y 50 UA");
const tr = trojanPoints(1.0, 200), l4 = tr.filter((p) => p.l4), l5 = tr.filter((p) => !p.l4);
const mean = (a) => a.reduce((s0, p) => s0 + p.ang, 0) / a.length;
ok(l4.length === 100 && near(mean(l4), 1 + Math.PI / 3, 0.06) && near(mean(l5), 1 - Math.PI / 3, 0.06), "troyanos: dos nubes, 60° por delante y por detrás de Júpiter");
const e = eqToEcl([0, Math.cos(23.4392911 * Math.PI / 180), Math.sin(23.4392911 * Math.PI / 180)]);
ok(near(e[1], 1, 1e-9) && near(e[2], 0, 1e-9), "ecuatorial → eclíptica");
// Voyager 1 vista desde la Tierra (dirección de /api/probes el 23 nov 2026): longitud eclíptica ≈ 256,7°, latitud ≈ +35°
const v1 = probeHelio({ nx: -0.18887, ny: -0.95954, nz: 0.20882, dist_au: 173.2014 }, [0.4889, 0.8581, 0]);
ok(near((v1.lon * 180 / Math.PI + 360) % 360, 256.6, 0.6) && near(Math.asin(v1.z / v1.r) * 180 / Math.PI, 35, 1.5) && near(v1.r, 173, 1.5), "Voyager 1: dirección heliocéntrica y distancia");
const halley = { q: 0.5748638313743413, e: 0.9679359956953211, i: 162.1905300439129, om: 59.09894720612437, w: 112.2414314637764 };
const orb = cometOrbit(halley, 32);
ok(orb.length === 161 && orb.every((v) => Math.hypot(v[0], v[1], v[2]) <= 32.01) && near(Math.min(...orb.map((v) => Math.hypot(...v))), 0.575, 0.01), "órbita de un cometa hasta 32 UA, con su perihelio");
ok(brightestComet({ a: halley, b: halley }, (el) => ({ mag: 9, r: 1, nu: 0 }), 11).name === "a" && brightestComet({ a: halley }, () => ({ mag: 15, r: 1, nu: 0 }), 14) === null, "el cometa más brillante, solo si llega a la magnitud límite");
console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
