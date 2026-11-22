// Pruebas: el relieve cercano en 3D (src/sky/terrain3d.js): decodificación, malla y petición.
import { decodeNear, nearGeometry, ringDist, fetchNearTerrain, UNITS_PER_M } from "../src/sky/terrain3d.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FALLA:", m); } };

// una llanura a 2.800 m con un cerro de 3.800 m al este, a ~10 km
const nAz = 72, nR = 40, dMin = 60, dMax = 25000;
const dist = (j) => dMin * Math.pow(dMax / dMin, j / (nR - 1));
const hill = (i, j) => { const az = i * 5, d = dist(j); const e = d * Math.sin(az * Math.PI / 180) - 10000, n = d * Math.cos(az * Math.PI / 180); return 2800 + 1000 * Math.max(0, 1 - Math.hypot(e, n) / 4000); };
const u16 = new Uint8Array(nAz * nR * 2);
for (let i = 0; i < nAz; i++) for (let j = 0; j < nR; j++) { const q = Math.round((hill(i, j) + 500) * 4), k = (i * nR + j) * 2; u16[k] = q & 255; u16[k + 1] = q >> 8; }
const body = { n_az: nAz, n_r: nR, d_min_m: dMin, d_max_m: dMax, ground_m: 2800, eye_m: 1.7, h_off: 500, h_scale: 4, heights: Buffer.from(u16).toString("base64"), credit: "EOX" };

const nr = decodeNear(body);
ok(nr && nr.nAz === nAz && nr.nR === nR && nr.heights.length === nAz * nR && Math.abs(nr.heights[0] - 2800) < 0.2, "decodifica las alturas (uint16, pasos de 25 cm)");
ok(decodeNear(null) === null && decodeNear({ n_az: 4, n_r: 4, heights: "AAAA" }) === null, "respuesta vacía o corta: null");
ok(Math.abs(ringDist(nr, 0) - 60) < 1e-9 && Math.abs(ringDist(nr, nR - 1) - 25000) < 1e-6, "anillos de 60 m a 25 km");

const G = nearGeometry(nr);
const cols = nAz + 1;
ok(G.pos.length === cols * nR * 3 && G.uv.length === cols * nR * 2 && G.idx.length === nAz * (nR - 1) * 6, "malla: una columna más para cerrar la vuelta");
const V = (i, j) => { const k = i * nR + j; return [G.pos[k * 3] / UNITS_PER_M, G.pos[k * 3 + 1] / UNITS_PER_M, G.pos[k * 3 + 2] / UNITS_PER_M]; };
// al norte, en el primer anillo: 60 m hacia −z, 1,7 m bajo los ojos
const p0 = V(0, 0);
ok(Math.abs(p0[0]) < 1e-3 && Math.abs(p0[2] + 60) < 1e-3 && Math.abs(p0[1] + 1.7) < 0.01, "el suelo cercano queda a 1,7 m bajo los ojos, al norte en −z");
// al este (acimut 90°), +x; el cerro sobresale: su cumbre (≈ 10 km) se ve por encima del horizonte
const jE = [...Array(nR).keys()].reduce((a, j) => (Math.abs(dist(j) - 10000) < Math.abs(dist(a) - 10000) ? j : a), 0);
const pe = V(18, jE), altE = Math.atan2(pe[1], Math.hypot(pe[0], pe[2])) * 180 / Math.PI;
const expected = Math.atan2(hill(18, jE) - 2801.7 - dist(jE) ** 2 * 0.87 / (2 * 6371008.8), dist(jE)) * 180 / Math.PI;
ok(pe[0] > 9000 && Math.abs(pe[2]) < 1 && Math.abs(altE - expected) < 1e-3 && altE > 4, "el cerro al este, a la altura angular del horizonte (curvatura y refracción)");
// la llanura lejana al oeste queda bajo el horizonte por la curvatura
const pw = V(54, nR - 1);
ok(pw[0] < -24000 && pw[1] < -40 && pw[1] > -50, "a 25 km la llanura cae ≈ 43 m por la curvatura");
// normales: en la llanura, hacia arriba; en la ladera oeste del cerro (la que mira al observador), inclinada hacia el oeste
const N = (i, j) => { const k = i * nR + j; return [G.nor[k * 3], G.nor[k * 3 + 1], G.nor[k * 3 + 2]]; };
const jS = [...Array(nR).keys()].reduce((a, j) => (Math.abs(dist(j) - 8000) < Math.abs(dist(a) - 8000) ? j : a), 0);
ok(N(54, 20)[1] > 0.999 && N(18, jS)[0] < -0.15 && N(18, jS)[1] > 0.9, "normales: llano hacia arriba; la ladera que da al observador mira hacia él");
ok(G.hd[(18 * nR + jE) * 2] > 3500 && Math.abs(G.hd[(18 * nR + jE) * 2 + 1] - dist(jE)) < 1e-3, "altura y distancia de cada vértice");
// la costura: la última columna repite la primera con u = 1
const kL = nAz * nR + 5;
ok(Math.abs(G.pos[kL * 3] - G.pos[5 * 3]) < 1e-3 && G.uv[kL * 2] === 1 && G.uv[5 * 2] === 0 && Math.abs(G.uv[kL * 2 + 1] - 5 / (nR - 1)) < 1e-6, "costura en el norte: misma posición, u de 0 a 1");
// cerca (< 150 m) el suelo es llano aunque el modelo tenga un bulto
const bumpy = { ...nr, heights: nr.heights.map((h, k) => (k % nR < 4 ? h + 40 : h)) };
const Gb = nearGeometry(bumpy);
ok(Math.abs(Gb.pos[1] / UNITS_PER_M + 1.7) < 0.01, "un bulto del modelo a 60 m no levanta el suelo de los pies");
// …pero lo que baja no se allana: desde una cumbre, la ladera cae desde el primer anillo
const peak = { ...nr, heights: nr.heights.map((h, k) => h - 30 * (k % nR)) };
const Gp = nearGeometry(peak);
ok(Gp.pos[(0 * nR + 3) * 3 + 1] / UNITS_PER_M < -85, "desde una cumbre la ladera baja de verdad (sin plataforma que tape el paisaje)");
// los índices van de cerca a lejos
ok(G.idx[0] === 0 && G.idx[G.idx.length - 1] === (nAz - 1 + 1) * nR + nR - 1, "triángulos de cerca a lejos");

// la petición: una vez por celda, con la dirección de la imagen
let calls = 0;
const fetchImpl = async (url) => { calls++; return { ok: true, json: async () => body, url }; };
const a = await fetchNearTerrain(0.0412, -78.1461, { api: "https://x", fetchImpl });
const b = await fetchNearTerrain(0.0413, -78.1462, { api: "https://x", fetchImpl });
ok(calls === 1 && a === b && /^https:\/\/x\/api\/terrain\/near\.jpg\?lat=[\d.]+&lon=-[\d.]+$/.test(a.texUrl) && a.data.nAz === nAz, "una petición por celda y la dirección de la imagen");
const f = await fetchNearTerrain(-1.46908, -78.81595, { api: "", fine: true, fetchImpl });
ok(/fine=1$/.test(f.texUrl), "en una cumbre, la celda fina");
let failed = false;
await fetchNearTerrain(10, 10, { fetchImpl: async () => ({ ok: false, status: 502 }) }).catch(() => { failed = true; });
ok(failed, "sin servidor, falla (quedan las franjas)");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
if (fail) process.exit(1);
