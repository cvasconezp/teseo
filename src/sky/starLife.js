// starLife.js — «Su vida y su final»: datos y cálculo puros (sin React ni DOM) para la ficha de
// una estrella y la del Sol. Lo usan StarLifeBlock.jsx y scripts/test_sky_composition.mjs.
//
// FUENTES (comprobadas el 14-nov-2026):
//  · Secuencia principal por tipo espectral (Teff, magnitud absoluta Mv, masa): E. Mamajek,
//    "A Modern Mean Dwarf Stellar Color and Effective Temperature Sequence", versión 2022.04.16
//    (pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt), base de la tabla 5 de
//    Pecaut & Mamajek (2013), ApJS 208, 9. Solo vale para ENANAS (clase V).
//  · Final según la masa inicial: OpenStax, Astronomy 2e (2022), tabla 23.1 «The Ultimate Fate of
//    Stars…»: 0,08–0,25 M☉ → enana blanca de helio; 0,25–8 → enana blanca de carbono y oxígeno;
//    8–10 → enana blanca de oxígeno, neón y magnesio; 10–40 → supernova y estrella de neutrones;
//    > 40 → supernova y agujero negro. NASA, Imagine the Universe («Stars»): «solo las estrellas de
//    más de 20 veces la masa del Sol se convierten en agujeros negros». Como las dos fuentes no
//    coinciden, entre 20 y 40 M☉ se dice «estrella de neutrones o agujero negro». Umbrales
//    aproximados: dependen de la composición, la rotación y la pérdida de masa.
//  · Vida en la secuencia principal: t ≈ 10.000 millones de años × (M/M☉)^−2,5 (el Sol pasa
//    «unos 10.000 millones de años» en ella: NASA, Imagine the Universe). Aproximación de ORDEN DE
//    MAGNITUD; para enanas rojas se queda muy corta (NASA, «Star Basics»: algunas brillarán
//    billones de años), así que por debajo de 0,5 M☉ no se da cifra.
//  · El Sol: tipo G2 V, unos 4.600 millones de años, le quedan «unos 5.000 millones de años» antes de
//    acabar como enana blanca tras la fase de gigante roja (NASA, «Sun: Facts»); la nebulosa
//    planetaria: NASA, «Star Basics».
//  · Masas curadas: ver CURATED (cada entrada lleva su referencia). Se han quitado las que no se
//    pudieron atribuir a una publicación concreta (Vega, Aldebarán, Espiga, Capella, Achernar…).

export const MSUN_LIFE_YR = 1e10;            // vida del Sol en la secuencia principal (NASA)

// [tipo, Teff K, Mv, masa M☉] — Mamajek 2022.04.16 (enanas, clase V)
export const MS_TABLE = [
  ["O3", 44900, -5.80, 59], ["O4", 42900, -5.50, 48], ["O5", 41400, -5.35, 43], ["O5.5", 40500, -5.20, 38], ["O6", 39500, -5.10, 35],
  ["O6.5", 38300, -4.95, 31], ["O7", 37100, -4.80, 28], ["O7.5", 36100, -4.65, 26], ["O8", 35100, -4.50, 23.6], ["O8.5", 34300, -4.35, 21.9],
  ["O9", 33300, -4.20, 20.2], ["O9.5", 31900, -4.05, 18.7], ["B0", 31400, -3.90, 17.7], ["B0.5", 29000, -3.50, 14.8], ["B1", 26000, -3.00, 11.8],
  ["B1.5", 24500, -2.60, 9.9], ["B2", 20600, -1.80, 7.3], ["B2.5", 18500, -1.50, 6.1], ["B3", 17000, -1.20, 5.4], ["B4", 16400, -1.00, 5.1],
  ["B5", 15700, -0.85, 4.7], ["B6", 14500, -0.55, 4.3], ["B7", 14000, -0.40, 3.92], ["B8", 12300, 0.00, 3.38], ["B9", 10700, 0.50, 2.75],
  ["B9.5", 10400, 0.60, 2.68], ["A0", 9700, 0.99, 2.18], ["A1", 9300, 1.16, 2.05], ["A2", 8800, 1.35, 1.98], ["A3", 8600, 1.70, 1.86],
  ["A4", 8250, 1.94, 1.93], ["A5", 8100, 2.01, 1.88], ["A6", 7910, 2.12, 1.83], ["A7", 7760, 2.23, 1.77], ["A8", 7590, 2.32, 1.81],
  ["A9", 7400, 2.43, 1.75], ["F0", 7220, 2.57, 1.61], ["F1", 7020, 2.76, 1.50], ["F2", 6820, 2.97, 1.46], ["F3", 6750, 3.08, 1.44],
  ["F4", 6670, 3.20, 1.38], ["F5", 6550, 3.37, 1.33], ["F6", 6350, 3.69, 1.25], ["F7", 6280, 3.80, 1.21], ["F8", 6180, 4.05, 1.18],
  ["F9", 6050, 4.25, 1.13], ["F9.5", 5990, 4.35, 1.08], ["G0", 5930, 4.48, 1.06], ["G1", 5860, 4.62, 1.03], ["G2", 5770, 4.80, 1.00],
  ["G3", 5720, 4.87, 0.99], ["G4", 5680, 4.93, 0.985], ["G5", 5660, 4.98, 0.98], ["G6", 5600, 5.10, 0.97], ["G7", 5550, 5.20, 0.95],
  ["G8", 5480, 5.30, 0.94], ["G9", 5380, 5.55, 0.90], ["K0", 5270, 5.78, 0.88], ["K1", 5170, 5.95, 0.86], ["K2", 5100, 6.07, 0.82],
  ["K3", 4830, 6.50, 0.78], ["K4", 4600, 6.98, 0.73], ["K5", 4440, 7.28, 0.70], ["K6", 4300, 7.64, 0.69], ["K7", 4100, 8.16, 0.64],
  ["K8", 3990, 8.43, 0.62], ["K9", 3930, 8.56, 0.59], ["M0", 3850, 8.80, 0.57], ["M0.5", 3770, 9.20, 0.54], ["M1", 3660, 9.64, 0.50],
  ["M1.5", 3620, 9.85, 0.47], ["M2", 3560, 10.21, 0.44], ["M2.5", 3470, 10.61, 0.40], ["M3", 3430, 11.15, 0.37], ["M3.5", 3270, 12.10, 0.27],
  ["M4", 3210, 12.61, 0.23], ["M4.5", 3110, 13.58, 0.184], ["M5", 3060, 14.15, 0.162], ["M5.5", 2930, 15.30, 0.123], ["M6", 2810, 16.32, 0.102],
  ["M6.5", 2740, 17.10, 0.093], ["M7", 2680, 17.70, 0.090], ["M7.5", 2630, 18.16, 0.088], ["M8", 2570, 18.60, 0.085], ["M8.5", 2420, 19.20, 0.080],
  ["M9", 2380, 19.40, 0.079], ["M9.5", 2350, 19.75, 0.078],
];

/** Fila de la tabla para una letra y subclase exactas (o la más próxima de la misma letra). null si no hay subclase. */
export function msRow(letter, sub) {
  if (!letter || sub == null || !Number.isFinite(+sub)) return null;
  const rows = MS_TABLE.filter((r) => r[0][0] === letter);
  if (!rows.length) return null;
  let best = null, bd = Infinity;
  for (const r of rows) { const d = Math.abs(+r[0].slice(1) - sub); if (d < bd) { bd = d; best = r; } }
  return bd <= 1 ? { spt: best[0] + "V", teff: best[1], mv: best[2], mass: best[3] } : null;
}

// Masas publicadas (M☉). mass: [mínimo, máximo] o { v, e } (valor ± error); age: años [mín, máx];
// comp: nota de la compañera; ref: referencias tal como se muestran.
export const CURATED = {
  "Betelgeuse": { mass: [14, 19], ref: ["Neuhäuser et al. 2022, MNRAS 516, 693", "Joyce et al. 2020, ApJ 902, 63"] },
  "Rigel": { mass: { v: 21, e: 3 }, age: [7e6, 9e6], ref: ["Przybilla et al. 2006, A&A 445, 1099"] },
  "Sirius": { mass: { v: 2.063, e: 0.023 }, age: [2e8, 3e8], comp: "siriusB", ref: ["Bond et al. 2017, ApJ 840, 70", "Liebert et al. 2005, ApJ 630, L69"] },
  "Antares": { mass: [13, 16], age: [1.18e7, 1.73e7], ref: ["Neuhäuser et al. 2022, MNRAS 516, 693"] },
  "Arcturus": { mass: { v: 1.08, e: 0.06 }, age: [6e9, 8.5e9], ref: ["Ramírez & Allende Prieto 2011, ApJ 743, 135"] },
  "Procyon": { mass: { v: 1.478, e: 0.012 }, comp: "procyonB", ref: ["Bond et al. 2015, ApJ 813, 106"] },
  "Rigil Kentaurus": { mass: { v: 1.0788, e: 0.0029 }, ref: ["Akeson et al. 2021, AJ 162, 14"] },
  "Toliman": { mass: { v: 0.9092, e: 0.0025 }, ref: ["Akeson et al. 2021, AJ 162, 14"] },
  "Canopus": { mass: { v: 8.0, e: 0.3 }, ref: ["Cruzalèbes et al. 2013, MNRAS 434, 437"] },
  "Polaris": { mass: { v: 5.13, e: 0.28 }, ref: ["Evans et al. 2024, ApJ 971, 190"] },
  "Fomalhaut": { mass: { v: 1.92, e: 0.02 }, age: [4.0e8, 4.8e8], ref: ["Mamajek 2012, ApJL 754, L20"] },
  "Altair": { mass: { v: 1.8, approx: true }, age: [1e8, 1e8], ageApprox: true, ref: ["Peterson et al. 2006, ApJ 636, 1087", "Bouchaud et al. 2020, A&A 633, A78"] },
};

export const massRange = (m) => (Array.isArray(m) ? m : m.e ? [m.v - m.e, m.v + m.e] : [m.v, m.v]);
export const massMid = (m) => (Array.isArray(m) ? (m[0] + m[1]) / 2 : m.v);

// ───────────────────────── finales ─────────────────────────
// redDwarf: enana blanca de helio · wd: gigante → nebulosa planetaria → enana blanca
// border: enana blanca de O-Ne-Mg o supernova · ns: supernova → estrella de neutrones
// nsbh: supernova (o colapso) → estrella de neutrones o agujero negro · bh: → agujero negro
export const FATE_EDGES = [0.25, 8, 10, 20, 40];
export const FATES = ["redDwarf", "wd", "border", "ns", "nsbh", "bh"];
export function fateOf(mass) {
  if (!(mass > 0)) return null;
  let i = 0;
  while (i < FATE_EDGES.length && mass >= FATE_EDGES[i]) i++;
  return FATES[i];
}
/** ¿Cruza el intervalo de masa algún umbral? (entonces el final podría ser otro) */
export function nearEdge(range) {
  return FATE_EDGES.some((e) => range[0] < e && range[1] >= e);
}

/** Vida aproximada en la secuencia principal (años), o null por debajo de 0,5 M☉ (la fórmula no sirve). */
export function msLifetime(mass) {
  if (!(mass >= 0.5)) return null;
  return MSUN_LIFE_YR * mass ** -2.5;
}
/** Redondeo a 1 cifra significativa (orden de magnitud honesto). */
export const sig1 = (v) => { if (!(v > 0)) return v; const p = 10 ** Math.floor(Math.log10(v)); return Math.round(v / p) * p; };

// ───────────────────────── etapa ─────────────────────────
/** Magnitud absoluta a partir de la aparente y la distancia en años luz. */
export function absMag(m, distLy) {
  if (m == null || !(distLy > 0)) return null;
  const pc = distLy / 3.2615638;
  return m - 5 * Math.log10(pc / 10);
}

/**
 * Etapa a partir del tipo espectral ya leído (starColor.parseSpect) y, si no trae clase de
 * luminosidad, de su magnitud absoluta comparada con la de la secuencia principal.
 *   "ms" | "subgiant" | "giant" | "supergiant" | "wd" | null (no se puede decidir)
 * y `assumed` = true cuando la secuencia principal se deduce del brillo (el catálogo no la da).
 */
export const MS_TOL_MAG = 1.0;              // margen (mag) para considerar coherente con la secuencia principal
export function stageOf(sp, mAbs) {
  if (!sp) return { stage: null, assumed: false };
  if (sp.letter === "D") return { stage: "wd", assumed: false };
  const L = sp.lum;
  if (L === "V" || L === "VI") return { stage: "ms", assumed: false };
  if (L === "VII") return { stage: "wd", assumed: false };
  if (L === "IV") return { stage: "subgiant", assumed: false };
  if (L === "III" || L === "II") return { stage: "giant", assumed: false };
  if (L === "0" || L === "Ia" || L === "Iab" || L === "Ib") return { stage: "supergiant", assumed: false };
  // sin clase de luminosidad: solo se asume secuencia principal si el brillo absoluto cuadra
  const row = msRow(sp.letter, sp.sub);
  if (row && mAbs != null && Math.abs(mAbs - row.mv) <= MS_TOL_MAG) return { stage: "ms", assumed: true };
  return { stage: null, assumed: false };
}

// Etapas que se dibujan en la línea de tiempo según el camino.
export const PATHS = {
  redDwarf: ["ms", "wdHe"],
  wd: ["ms", "subgiant", "giant", "pn", "wd"],
  border: ["ms", "supergiant", "borderEnd"],
  ns: ["ms", "supergiant", "sn", "ns"],
  nsbh: ["ms", "supergiant", "sn", "nsbh"],
  bh: ["ms", "supergiant", "sn", "bh"],
  giantUnknown: ["ms", "subgiant", "giant", "unknownEnd"],
  superUnknown: ["ms", "supergiant", "sn", "nsbh"],
};

/**
 * Plan del bloque «Su vida y su final» para una estrella del catálogo (o el Sol).
 * Devuelve null si no hay tipo espectral legible.
 *   { kind: "star"|"sun", letter, sub, stage, assumed, mass, massKind ("curated"|"estimated"|null),
 *     range, fate, path, here (índice de la etapa actual en path), lifetime, near, age, ref, comp }
 */
export function lifePlan(obj, sp) {
  if (!obj) return null;
  if (obj.layer === "solar" && obj.name === "Sol") {
    return { kind: "sun", letter: "G", sub: 2, stage: "ms", assumed: false, mass: { v: 1 }, massKind: "sun", range: [1, 1],
      fate: "wd", path: PATHS.wd, here: 0, lifetime: MSUN_LIFE_YR, near: false, age: [4.6e9, 4.6e9], ref: [], comp: null };
  }
  if (obj.layer !== "star" || !sp) return null;
  const cur = CURATED[obj.name] || null;
  const { stage, assumed } = stageOf(sp, absMag(obj.mag, obj.dist_ly));
  let mass = null, massKind = null;
  if (cur) { mass = cur.mass; massKind = "curated"; }
  else if (stage === "ms") { const row = msRow(sp.letter, sp.sub); if (row) { mass = { v: row.mass }; massKind = "estimated"; } }
  const range = mass ? massRange(mass) : null;
  const mid = mass ? massMid(mass) : null;
  let fate = mid != null ? fateOf(mid) : null;
  let path;
  if (stage === "wd") { fate = "wd"; path = PATHS.wd; }
  else if (fate) path = PATHS[fate];
  else if (stage === "supergiant") { fate = "superUnknown"; path = PATHS.superUnknown; }
  else if (stage === "giant" || stage === "subgiant") { fate = "giantUnknown"; path = PATHS.giantUnknown; }
  else path = null;
  // índice de la etapa actual en el camino
  let here = -1;
  if (path && stage) {
    if (stage === "wd") here = path.length - 1;
    else if (stage === "ms") here = 0;
    else {
      here = path.indexOf(stage);
      if (here < 0 && (stage === "giant" || stage === "subgiant") && path.includes("supergiant")) here = path.indexOf("supergiant");
      if (here < 0 && stage === "supergiant" && path.includes("giant")) here = path.indexOf("giant");
    }
  }
  return {
    kind: "star", letter: sp.letter, sub: sp.sub, stage, assumed, mass, massKind, range, fate, path, here,
    lifetime: stage === "ms" && mid != null ? msLifetime(mid) : null,
    near: !!(range && nearEdge(range)), age: cur && cur.age ? cur.age : null, ageApprox: !!(cur && cur.ageApprox),
    ref: cur ? cur.ref : [], comp: cur && cur.comp ? cur.comp : null,
  };
}
