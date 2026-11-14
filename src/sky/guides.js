// guides.js — LÍNEAS GUÍA de la vista Cielo (como en Stellarium): eclíptica, ecuador celeste,
// ecuador galáctico, cuadrícula ecuatorial (AR/Dec), cuadrícula horizontal (altitud/azimut),
// meridiano local, polos celestes, cenit y nadir.
//
// Matemática pura (sin three ni DOM): genera vectores unitarios y textos de etiqueta.
// La comprueban scripts/test_sky_guides.mjs (contra el Sol de src/ephemeris.js, Polaris de
// public/sky.json, Sgr A* de public/blackholes.json y localSkyQuat de src/sky/look.js).
//
// MARCOS (los mismos que usa src/Constellations.jsx para estrellas y constelaciones):
//   · Ecuatorial J2000 (sky.json): x = cos δ cos α, y = cos δ sin α, z = sin δ.
//     +X = punto vernal (α = 0h), +Z = polo norte celeste. En la escena: vector × radio,
//     sin cambio de ejes; en "Mi cielo" el objeto se gira con localSkyQuatJ2000 (look.js),
//     el mismo cuaternión que las estrellas. Los generadores de ecuador, cuadrícula AR/Dec y
//     polos dan vectores en "su" ecuador: la capa (guidesLayer.js) los coloca en el ecuador DE LA
//     FECHA (precesión de frames.js); la eclíptica y el plano galáctico se quedan en J2000.
//   · Local (horizonte, solo "Mi cielo"): +X = este, +Y = cenit, −Z = norte.
//     Azimut desde el norte hacia el este (N 0°, E 90°, S 180°, O 270°).
//
// FUENTES (verificadas el 13-nov-2026):
//   · Oblicuidad de la eclíptica J2000: ε₀ = 84 381,448″ = 23,4392911° (sistema IAU 1976;
//     J. H. Lieske et al. 1977, A&A 58, 1; es la que usa ESA 1997, The Hipparcos and Tycho
//     Catalogues, vol. 1, §1.5.3, para el marco eclíptico J2000; JPL SSD "Astrodynamic
//     Parameters" la lista como variante IAU 1976). El modelo IAU 2006 (Hilton et al. 2006,
//     Celest. Mech. Dyn. Astron. 94, 351; ERFA obl06) da 84 381,406″: 0,042″ de diferencia,
//     miles de veces menor que un píxel. La eclíptica dibujada es la de J2000; la de la fecha
//     se separa de ella menos de 0,01° en este siglo (47″ por siglo), y la precesión solo
//     desliza los puntos a lo largo de ella (~0,37° en 2026: 50,3″/año): las estrellas también son J2000.
//   · Coordenadas galácticas (sistema IAU 1958, Blaauw et al. 1960, MNRAS 121, 123) llevadas a
//     J2000/ICRS por ESA 1997 (Hipparcos, vol. 1, §1.5.3): polo norte galáctico en
//     α = 192,85948°, δ = +27,12825°, y longitud galáctica del polo norte celeste
//     l(PNC) = 122,93192°. Coinciden con astropy (Galactic: 192,8594812°, 27,1282512°,
//     l₀ = 122,9319186°). Con ellos el centro galáctico (l = 0, b = 0) queda en
//     α = 266,40499°, δ = −28,93617°, a ~0,07° de Sgr A* (que está en b ≈ −0,05°).
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const clamp1 = (v) => Math.max(-1, Math.min(1, v));
const wrap360 = (a) => ((a % 360) + 360) % 360;

export const OBLIQUITY_J2000_DEG = 23.4392911;            // ε₀, IAU 1976 (84 381,448″)
export const OBLIQUITY_IAU2006_DEG = 84381.406 / 3600;    // solo como referencia en las pruebas
export const GAL_NGP_RA_DEG = 192.85948;                  // polo norte galáctico, J2000 (Hipparcos)
export const GAL_NGP_DEC_DEG = 27.12825;
export const GAL_L_NCP_DEG = 122.93192;                   // longitud galáctica del polo norte celeste

// ── vectores y conversiones básicas ──────────────────────────────────────
/** AR y Dec (grados) → vector unitario ecuatorial [x, y, z]. */
export function raDecToVec(raDeg, decDeg) {
  const a = raDeg * D2R, d = decDeg * D2R, cd = Math.cos(d);
  return [cd * Math.cos(a), cd * Math.sin(a), Math.sin(d)];
}
/** Vector ecuatorial → { ra, dec } en grados (ra en [0, 360)). */
export function vecToRaDec(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return { ra: wrap360(Math.atan2(v[1], v[0]) * R2D), dec: Math.asin(clamp1(v[2] / n)) * R2D };
}
/** Altitud y azimut (grados) → vector del marco local [este, cenit, −norte]. */
export function altAzToLocal(altDeg, azDeg) {
  const h = altDeg * D2R, A = azDeg * D2R, ch = Math.cos(h);
  return [ch * Math.sin(A), Math.sin(h), -ch * Math.cos(A)];
}
/** Vector local → { alt, az } en grados. */
export function localToAltAz(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return { alt: Math.asin(clamp1(v[1] / n)) * R2D, az: wrap360(Math.atan2(v[0], -v[2]) * R2D) };
}
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function norm3(a) { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; }
/** Separación angular (grados) entre dos direcciones. */
export function angSepDeg(a, b) {
  const c = cross3(a, b);
  return Math.atan2(Math.hypot(c[0], c[1], c[2]), dot3(a, b)) * R2D;
}
/** Distancia angular (grados) de una dirección al gran círculo de polo `pole`. */
export function distToGreatCircleDeg(v, pole) {
  return Math.abs(Math.asin(clamp1(dot3(norm3(v), norm3(pole)))) * R2D);
}
// Rotación por un cuaternión dado como {x,y,z,w} o [x,y,z,w] (el de three o uno plano).
const qParts = (q) => (Array.isArray(q) ? q : [q.x, q.y, q.z, q.w]);
/** v girado por q (v' = q v q⁻¹), como Vector3.applyQuaternion de three. */
export function applyQuat(v, q) {
  const [qx, qy, qz, qw] = qParts(q);
  const ix = qw * v[0] + qy * v[2] - qz * v[1], iy = qw * v[1] + qz * v[0] - qx * v[2];
  const iz = qw * v[2] + qx * v[1] - qy * v[0], iw = -qx * v[0] - qy * v[1] - qz * v[2];
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
}
/** v girado por q⁻¹ (p. ej. del marco local al ecuatorial con q = localSkyQuat). */
export function applyQuatInv(v, q) { const [x, y, z, w] = qParts(q); return applyQuat(v, [-x, -y, -z, w]); }

// ── eclíptica (J2000) ────────────────────────────────────────────────────
const SE = Math.sin(OBLIQUITY_J2000_DEG * D2R), CE = Math.cos(OBLIQUITY_J2000_DEG * D2R);
/** Longitud y latitud eclípticas J2000 (grados) → vector ecuatorial J2000. */
export function eclToEq(lonDeg, latDeg = 0) {
  const l = lonDeg * D2R, b = latDeg * D2R, cb = Math.cos(b);
  const x = cb * Math.cos(l), y = cb * Math.sin(l), z = Math.sin(b);
  return [x, y * CE - z * SE, y * SE + z * CE];
}
/** Vector ecuatorial J2000 → { lon, lat } eclípticas J2000 (grados). */
export function eqToEcl(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1, x = v[0] / n, y = v[1] / n, z = v[2] / n;
  const ye = y * CE + z * SE, ze = -y * SE + z * CE;
  return { lon: wrap360(Math.atan2(ye, x) * R2D), lat: Math.asin(clamp1(ze)) * R2D };
}
export const ECL_NORTH_POLE = [0, -SE, CE];               // α = 18h, δ = 90° − ε

// ── coordenadas galácticas ───────────────────────────────────────────────
// Filas = ejes galácticos expresados en ecuatoriales J2000: X → (l 0°, b 0°), Y → (l 90°, b 0°),
// Z → polo norte galáctico. Se construyen con los tres números de Hipparcos (no con Sgr A*):
// en el plano galáctico, la dirección hacia el PNC tiene longitud l(PNC); el resto sale girando.
export const GAL_MATRIX = (() => {
  const Z = raDecToVec(GAL_NGP_RA_DEG, GAL_NGP_DEC_DEG);
  const u = norm3([-Z[2] * Z[0], -Z[2] * Z[1], 1 - Z[2] * Z[2]]);   // PNC proyectado en el plano (l = l_PNC)
  const w = cross3(Z, u);                                              // l = l_PNC + 90°
  const at = (l) => { const d = (l - GAL_L_NCP_DEG) * D2R, c = Math.cos(d), s = Math.sin(d); return [c * u[0] + s * w[0], c * u[1] + s * w[1], c * u[2] + s * w[2]]; };
  return [at(0), at(90), Z];
})();
export const GAL_NORTH_POLE = GAL_MATRIX[2];
export const GAL_CENTER_DIR = GAL_MATRIX[0];
/** (l, b) galácticas en grados → vector ecuatorial J2000. */
export function galToEq(lDeg, bDeg = 0) {
  const l = lDeg * D2R, b = bDeg * D2R, cb = Math.cos(b);
  const g = [cb * Math.cos(l), cb * Math.sin(l), Math.sin(b)], M = GAL_MATRIX;
  return [0, 1, 2].map((i) => g[0] * M[0][i] + g[1] * M[1][i] + g[2] * M[2][i]);
}
/** Vector ecuatorial J2000 → { l, b } galácticas en grados. */
export function eqToGal(v) {
  const n = norm3(v), M = GAL_MATRIX;
  const x = dot3(M[0], n), y = dot3(M[1], n), z = dot3(M[2], n);
  return { l: wrap360(Math.atan2(y, x) * R2D), b: Math.asin(clamp1(z)) * R2D };
}

// ── polos y puntos notables ──────────────────────────────────────────────
export const NCP = [0, 0, 1], SCP = [0, 0, -1];            // ecuatoriales
export const ZENITH = [0, 1, 0], NADIR = [0, -1, 0];       // locales

// ── generadores de puntos ────────────────────────────────────────────────
// Todos devuelven Float32Array con vectores unitarios consecutivos [x0,y0,z0, x1,…].
// Los círculos cerrados NO repiten el primer punto (para THREE.LineLoop).
const fill = (n, f) => { const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = f(i); a[i * 3] = v[0]; a[i * 3 + 1] = v[1]; a[i * 3 + 2] = v[2]; } return a; };
const stepsOf = (stepDeg) => Math.max(8, Math.round(360 / stepDeg));
export function eclipticPoints(stepDeg = 1) { const n = stepsOf(stepDeg); return fill(n, (i) => eclToEq(i * 360 / n, 0)); }
export function equatorPoints(stepDeg = 1) { const n = stepsOf(stepDeg); return fill(n, (i) => raDecToVec(i * 360 / n, 0)); }
export function galacticEquatorPoints(stepDeg = 1) { const n = stepsOf(stepDeg); return fill(n, (i) => galToEq(i * 360 / n, 0)); }
/** Meridiano local (marco local): N (horizonte) → cenit → S → nadir → N. */
export function meridianPoints(stepDeg = 1) { const n = stepsOf(stepDeg); return fill(n, (i) => { const t = i * 2 * Math.PI / n; return [0, Math.sin(t), -Math.cos(t)]; }); }
/** Paralelo de declinación `decDeg` (marco ecuatorial), cerrado. */
export function parallelPoints(decDeg, stepDeg = 1) { const n = stepsOf(stepDeg); return fill(n, (i) => raDecToVec(i * 360 / n, decDeg)); }
/** Meridiano horario de AR `raDeg` entre dos declinaciones (abierto). */
export function hourCirclePoints(raDeg, dec0 = -90, dec1 = 90, stepDeg = 1) {
  const n = Math.max(2, Math.round((dec1 - dec0) / stepDeg) + 1);
  return fill(n, (i) => raDecToVec(raDeg, dec0 + (dec1 - dec0) * i / (n - 1)));
}
/** Almucantarat (círculo de altitud constante, marco local), cerrado. */
export function almucantarPoints(altDeg, stepDeg = 1) { const n = stepsOf(stepDeg); return fill(n, (i) => altAzToLocal(altDeg, i * 360 / n)); }
/** Vertical de azimut `azDeg` entre dos altitudes (marco local, abierto). */
export function verticalPoints(azDeg, alt0 = -90, alt1 = 90, stepDeg = 1) {
  const n = Math.max(2, Math.round((alt1 - alt0) / stepDeg) + 1);
  return fill(n, (i) => altAzToLocal(alt0 + (alt1 - alt0) * i / (n - 1), azDeg));
}

// ── cuadrículas y nivel de detalle según el zoom ─────────────────────────
// Nivel 0 = lo pedido (1 h y 15° en AR/Dec; 10° de altitud y 15° de azimut). Al acercar se
// densifica para que siga habiendo varias líneas en pantalla (SPAN_MIN de look.js = 5°).
export const GRID_LEVELS = [
  { maxFov: Infinity, raStepMin: 60, decStep: 15, altStep: 10, azStep: 15 },
  { maxFov: 38, raStepMin: 20, decStep: 5, altStep: 5, azStep: 5 },
  { maxFov: 13, raStepMin: 10, decStep: 2, altStep: 2, azStep: 2.5 },
];
// Las líneas secundarias (no múltiplos del nivel 0) se cortan antes de los polos, donde
// convergen y solo serían una mancha.
const MINOR_POLE_CUT = 80;
/** Nivel de cuadrícula para un campo de visión vertical (grados), con histéresis del 8 %. */
export function gridLevelForFov(fovDeg, prev = 0) {
  let lvl = 0;
  for (let i = 1; i < GRID_LEVELS.length; i++) if (fovDeg < GRID_LEVELS[i].maxFov) lvl = i;
  if (prev !== lvl && prev >= 0 && prev < GRID_LEVELS.length) {
    // no cambiar si apenas se cruzó el umbral (evita parpadeo al hacer zoom con dos dedos)
    const edge = lvl > prev ? GRID_LEVELS[lvl].maxFov : GRID_LEVELS[prev].maxFov;
    if (Math.abs(fovDeg - edge) < edge * 0.08) return prev;
  }
  return lvl;
}
/**
 * Cuadrícula ecuatorial de un nivel: { meridians: [{ raMin, major, pts }], parallels: [{ dec, major, pts }] }.
 * raMin = AR en minutos de tiempo (0…1439). Los paralelos excluyen ±90°.
 */
export function eqGridLines(level = 0, sampleDeg = 1) {
  const L = GRID_LEVELS[level], meridians = [], parallels = [];
  for (let m = 0; m < 1440; m += L.raStepMin) {
    const major = m % 60 === 0;
    const cut = major ? 90 : MINOR_POLE_CUT;
    meridians.push({ raMin: m, major, pts: hourCirclePoints(m / 4, -cut, cut, sampleDeg) });
  }
  for (let d = -90 + L.decStep; d < 90 - 1e-9; d += L.decStep) {
    const dec = Math.round(d * 1000) / 1000;
    if (Math.abs(dec) > MINOR_POLE_CUT + 1e-9 && dec % 15 !== 0) continue;
    parallels.push({ dec, major: dec % 15 === 0, pts: parallelPoints(dec, sampleDeg) });
  }
  return { meridians, parallels };
}
/** Cuadrícula horizontal de un nivel (marco local): { verticals: [{ az, major, pts }], almucantars: [{ alt, major, pts }] }. */
export function altAzGridLines(level = 0, sampleDeg = 1) {
  const L = GRID_LEVELS[level], verticals = [], almucantars = [];
  for (let a = 0; a < 360 - 1e-9; a += L.azStep) {
    const az = Math.round(a * 1000) / 1000, major = az % 15 === 0;
    const cut = major ? 90 : MINOR_POLE_CUT;
    verticals.push({ az, major, pts: verticalPoints(az, -cut, cut, sampleDeg) });
  }
  for (let h = -90 + L.altStep; h < 90 - 1e-9; h += L.altStep) {
    const alt = Math.round(h * 1000) / 1000;
    if (alt === 0) continue;                               // el horizonte ya lo dibuja la vista
    if (Math.abs(alt) > MINOR_POLE_CUT + 1e-9 && alt % 10 !== 0) continue;
    almucantars.push({ alt, major: alt % 10 === 0, pts: almucantarPoints(alt, sampleDeg) });
  }
  return { verticals, almucantars };
}

// ── textos de etiqueta ───────────────────────────────────────────────────
const MINUS = "−";
/** AR en minutos de tiempo → "6h" o "6h20m". */
export function fmtRA(raMin) {
  const m = Math.round(wrap360(raMin / 4) * 4) % 1440, h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h}h${String(mm).padStart(2, "0")}m` : `${h}h`;
}
/** Declinación → "+30°", "−15°", "0°" (signo menos tipográfico). */
export function fmtDec(dec) {
  const r = Math.round(dec * 10) / 10;
  if (r === 0) return "0°";
  return `${r > 0 ? "+" : MINUS}${String(Math.abs(r)).replace(".", ",")}°`;
}
/** Altitud → "30°", "−10°". */
export function fmtAlt(alt) {
  const r = Math.round(alt * 10) / 10;
  return `${r < 0 ? MINUS : ""}${String(Math.abs(r)).replace(".", ",")}°`;
}
/** Azimut → "45°" (los cardinales N, E, S, O ya los dibuja la vista). */
export function fmtAz(az) { return `${String(Math.round(wrap360(az) * 10) / 10).replace(".", ",")}°`; }
/** Cambia la coma decimal por punto en inglés. */
export const localizeNum = (s, lang) => (lang === "en" ? s.replace(",", ".") : s);

/**
 * Especificaciones de etiquetas a lo largo de las líneas, para que guidesLayer las proyecte.
 * Cada una: { id, guide, frame: "eq"|"local", text, mode, pts }
 *   mode "center": se nombra la línea en el punto de ella más cercano al centro de la pantalla.
 *   mode "y":      donde la línea cruza una horizontal de la pantalla (AR, azimut).
 *   mode "x":      donde la línea cruza una vertical (Dec a la izquierda, altitud a la derecha).
 *   mode "point":  un punto fijo (polos, cenit, nadir): pts tiene un solo vector.
 * `names` = textos traducidos (i18n-guides.js → GUIDES[lang].lineName / poleName).
 */
export function labelSpecs(level, names, lang = "es") {
  const out = [];
  const sparse = (n) => fill(Math.round(360 / 2), (i) => n(i * 2));   // muestras cada 2°
  out.push({ id: "ecl", guide: "ecliptic", frame: "eq", text: names.ecliptic, mode: "center", pts: sparse((a) => eclToEq(a)) });
  out.push({ id: "equ", guide: "equator", frame: "eq", text: names.equator, mode: "center", pts: sparse((a) => raDecToVec(a, 0)) });
  out.push({ id: "gal", guide: "galactic", frame: "eq", text: names.galactic, mode: "center", pts: sparse((a) => galToEq(a, 0)) });
  out.push({ id: "mer", guide: "meridian", frame: "local", text: names.meridian, mode: "center", pts: sparse((a) => { const t = a * D2R; return [0, Math.sin(t), -Math.cos(t)]; }) });
  const eg = eqGridLines(level, 4), hg = altAzGridLines(level, 4);
  for (const m of eg.meridians) out.push({ id: `ra${m.raMin}`, guide: "eqGrid", frame: "eq", text: fmtRA(m.raMin), mode: "y", pts: m.pts });
  for (const p of eg.parallels) out.push({ id: `de${p.dec}`, guide: "eqGrid", frame: "eq", text: localizeNum(fmtDec(p.dec), lang), mode: "x", pts: p.pts, closed: true });
  for (const v of hg.verticals) { if (v.az % 90 === 0) continue; out.push({ id: `az${v.az}`, guide: "altAzGrid", frame: "local", text: localizeNum(fmtAz(v.az), lang), mode: "y", pts: v.pts }); }
  for (const a of hg.almucantars) out.push({ id: `al${a.alt}`, guide: "altAzGrid", frame: "local", text: localizeNum(fmtAlt(a.alt), lang), mode: "x2", pts: a.pts, closed: true });
  const pt = (v) => new Float32Array(v);
  out.push({ id: "ncp", guide: "poles", frame: "eq", text: names.ncp, mode: "point", pts: pt(NCP) });
  out.push({ id: "scp", guide: "poles", frame: "eq", text: names.scp, mode: "point", pts: pt(SCP) });
  out.push({ id: "zen", guide: "poles", frame: "local", text: names.zenith, mode: "point", pts: pt(ZENITH), localOnly: true });
  out.push({ id: "nad", guide: "poles", frame: "local", text: names.nadir, mode: "point", pts: pt(NADIR), localOnly: true });
  return out;
}

// Colores: tonos distintos en matiz Y en luminosidad (y el galáctico además a trazos), para que
// se distingan también con daltonismo. Los de etiqueta superan 4,5:1 (AA) sobre el cielo negro.
export const GUIDE_COLORS = {
  ecliptic: "#f2b84b",    // ámbar
  equator: "#5aa9ff",     // azul
  galactic: "#c3a3ff",    // violeta suave, a trazos
  eqGrid: "#8e9cff",      // azul lavanda, muy tenue
  altAzGrid: "#6fdcb9",   // verde agua, muy tenue
  meridian: "#7fe8c8",    // verde agua, más visible
  poles: "#e6eaff",
};
// Colores de las etiquetas HTML (se fusionan en LABEL_COLOR de Constellations.jsx): cls = "guide_" + guía.
export const GUIDE_LABEL_COLOR = {
  guide_ecliptic: "#f6c86a", guide_equator: "#86c0ff", guide_galactic: "#cdb4ff",
  guide_eqGrid: "#aab5ff", guide_altAzGrid: "#8fe6c9", guide_meridian: "#9cefd4", guide_poles: "#eef0fa",
};

// ── catálogo de guías ────────────────────────────────────────────────────
// Orden = orden en el panel. localOnly: solo con ubicación ("Mi cielo").
export const GUIDE_KEYS = ["ecliptic", "equator", "galactic", "eqGrid", "altAzGrid", "meridian", "poles"];
export const LOCAL_ONLY = new Set(["altAzGrid", "meridian"]);
// Por defecto TODO apagado: en un teléfono la vista ya lleva figuras, nombres de estrellas y de
// constelaciones; cada línea es una decisión del usuario (justificación en el informe de fase 1).
export const DEFAULT_GUIDES = Object.freeze(Object.fromEntries(GUIDE_KEYS.map((k) => [k, false])));
/** Normaliza un objeto de estado (p. ej. leído de localStorage) a { clave: booleano } válido. */
export function sanitizeGuides(obj) {
  const out = { ...DEFAULT_GUIDES };
  if (obj && typeof obj === "object") for (const k of GUIDE_KEYS) if (typeof obj[k] === "boolean") out[k] = obj[k];
  return out;
}
