// Pruebas de src/route/smallBodies.js: Ceres (Kepler) contra JPL Horizons, el cinturón y sus huecos.
import { CERES, keplerXYZ, beltPoints, KIRKWOOD, freestAngle } from "../src/route/smallBodies.js";
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
console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
