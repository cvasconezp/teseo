// starColor.js — del índice de color B−V de una estrella a su temperatura y a su
// color en pantalla. Módulo puro (sin DOM): lo usan el cielo, la ficha, la postal y
// las pruebas de Node; scripts/build_sky.py repite las mismas fórmulas en Python y
// scripts/test_sky_starcolor.mjs comprueba que ambos coinciden estrella a estrella.
//
// 1) B−V → temperatura efectiva. Ballesteros, F. J. (2012), "New insights into black
//    bodies", EPL 97, 34008 (arXiv:1201.1809), ecuación (14):
//        T = 4600 K · [ 1/(0,92·(B−V) + 1,7) + 1/(0,92·(B−V) + 0,62) ]
//    Sale de tratar la estrella como un cuerpo negro visto por los filtros B y V. El
//    artículo NO da un intervalo de validez ni una barra de error; los límites de
//    abajo son nuestros, a partir de contrastarla con temperaturas publicadas:
//      · entre ~4.000 y ~10.000 K (B−V de 0 a 1,4) acierta dentro de un ±5–8 %
//        (Sol 5.772 K → 5.780; Sirio 9.940 → 10.020; Arturo 4.290 → 4.300);
//      · por encima de ~10.000 K (B−V < 0) el color casi deja de cambiar con la
//        temperatura y la fórmula se queda MUY corta (Rigel 12.100 → 10.500;
//        Espiga ~25.000 → 14.500): ahí el valor es un mínimo, no una medida;
//      · el polvo interestelar enrojece las estrellas lejanas (las hace parecer más
//        frías) y las bandas moleculares de las estrellas M y de carbono alteran el
//        B−V: fuera de −0,4 ≤ B−V ≤ 2,0 no damos temperatura.
//
// 2) Temperatura → color. Cromaticidad CIE 1931 (x, y) del cuerpo negro con la
//    aproximación por tramos cúbicos de Kim et al. (patente US 7024034, 2006; también
//    Kang, Moon, Hong, Lee, Cho & Kim 2002, J. Korean Phys. Soc. 41, 865), válida de
//    1.667 a 25.000 K; de (x, y) a RGB lineal con la matriz de sRGB (IEC 61966-2-1,
//    blanco D65), recorte de negativos, normalización al canal mayor (se conserva el
//    tono, no el brillo: el brillo lo pone la magnitud) y curva de transferencia sRGB.
//    Es el color de un cuerpo negro ideal en una pantalla sRGB: 6.500 K sale blanco.
//
// 3) "Realista" frente a "resaltado". El ojo ve los colores de las estrellas muy
//    tenues (de noche los conos apenas trabajan). Por defecto el color se mezcla a
//    partes iguales con blanco, en luz lineal; "resaltar colores" usa el color de
//    cuerpo negro entero. Esa mezcla es una decisión de presentación, no un dato.

export const BV_MIN = -0.4, BV_MAX = 2.0;          // intervalo en que damos temperatura
export const T_SUN = 5772;                         // K, valor nominal IAU 2015 (Res. B3)
export const LOWER_BOUND_K = 10400;                // desde aquí (B−V < −0,02) la estimación solo vale como mínimo
export const SOFT_MIX = 0.5;                       // parte de color en el modo realista
export const NO_BV_HEX = "#fff2e6";                // estrellas sin B−V: el color neutro que ya tenían en el catálogo

/** Temperatura efectiva (K) a partir de B−V (Ballesteros 2012, ec. 14). null si no hay dato. */
export function bvToTemp(bv) {
  if (bv == null || bv === "" || !Number.isFinite(+bv)) return null;
  const c = 0.92 * +bv;
  if (c + 0.62 <= 0) return null;                  // polo de la fórmula (B−V ≤ −0,674): sin sentido físico
  return 4600 * (1 / (c + 1.7) + 1 / (c + 0.62));
}

/** ¿Está B−V dentro del intervalo en que mostramos una temperatura? */
export const bvInRange = (bv) => bv != null && Number.isFinite(+bv) && +bv >= BV_MIN && +bv <= BV_MAX;

/** Cromaticidad CIE 1931 (x, y) de un cuerpo negro a T kelvin (Kim et al.; T se acota a 1.667–25.000 K). */
export function tempToXy(T) {
  const t = Math.min(25000, Math.max(1667, T));
  const x = t <= 4000
    ? -0.2661239e9 / t ** 3 - 0.2343589e6 / t ** 2 + 0.8776956e3 / t + 0.179910
    : -3.0258469e9 / t ** 3 + 2.1070379e6 / t ** 2 + 0.2226347e3 / t + 0.240390;
  const y = t <= 2222 ? -1.1063814 * x ** 3 - 1.34811020 * x ** 2 + 2.18555832 * x - 0.20219683
    : t <= 4000 ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
    : 3.0817580 * x ** 3 - 5.87338670 * x ** 2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}

/** RGB lineal (sRGB, D65) de un cuerpo negro, normalizado a que el canal mayor valga 1. */
export function tempToLinearRgb(T) {
  const [x, y] = tempToXy(T), X = x / y, Z = (1 - x - y) / y;      // Y = 1
  let r = 3.2406 * X - 1.5372 - 0.4986 * Z, g = -0.9689 * X + 1.8758 + 0.0415 * Z, b = 0.0557 * X - 0.2040 + 1.0570 * Z;
  r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
  const m = Math.max(r, g, b) || 1;
  return [r / m, g / m, b / m];
}

const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(255 * Math.min(1, Math.max(0, enc(v)))).toString(16).padStart(2, "0")).join("");

/** Color sRGB "#rrggbb" de un cuerpo negro a T kelvin. `mix` = parte de color (1 = entero, 0 = blanco). */
export function tempToHex(T, mix = 1) {
  const k = Math.min(1, Math.max(0, mix));
  return toHex(tempToLinearRgb(T).map((v) => v * k + (1 - k)));
}

/**
 * Color de una estrella a partir de su B−V.
 *   vivid = false → realista (mitad color, mitad blanco); true → color de cuerpo negro entero.
 * Sin B−V devuelve `fallback` (el color que ya traía el catálogo) y no inventa nada.
 */
export function starHex(bv, vivid = false, fallback = NO_BV_HEX) {
  const T = bvToTemp(bv);
  if (T == null) return fallback;
  return tempToHex(T, vivid ? 1 : SOFT_MIX);
}

/** Redondeo honesto de una temperatura estimada: a centenas (la fórmula no da para más). */
export const roundTemp = (T) => Math.round(T / 100) * 100;

/** Nombre del tono según la temperatura (mismas claves que t.starHue). */
export function tempHue(T) {
  if (!(T > 0)) return null;
  if (T >= 9000) return "blue";
  if (T >= 6500) return "white";
  if (T >= 5000) return "yellow";
  if (T >= 3900) return "orange";
  return "red";
}

/**
 * Lo que la ficha puede decir de la temperatura de una estrella a partir de su B−V:
 *   { bv, temp (K, redondeada a centenas) | null, hue, vsSun: "hotter"|"cooler"|"similar", ratio (T/T☉),
 *     lowerBound (por encima de ~10.000 K el valor es un mínimo), outOfRange (hay B−V pero no damos kelvin) }
 * o null si no hay B−V.
 */
export function starTemperature(bv) {
  const raw = bvToTemp(bv);
  if (raw == null) return null;
  if (!bvInRange(bv)) return { bv: +bv, temp: null, hue: tempHue(raw), vsSun: null, ratio: null, lowerBound: false, outOfRange: true };
  const temp = roundTemp(raw), ratio = raw / T_SUN;
  return {
    bv: +bv, temp, hue: tempHue(raw), ratio,
    vsSun: ratio > 1.05 ? "hotter" : ratio < 0.95 ? "cooler" : "similar",
    lowerBound: raw >= LOWER_BOUND_K, outOfRange: false,
  };
}

// ───────────────────────── tipo espectral ─────────────────────────
// Clasificación de Morgan–Keenan: letra de temperatura (O B A F G K M, de más caliente
// a más fría), subclase 0–9 y clase de luminosidad en números romanos.
const LUM_ORDER = ["Ia0", "Ia-0", "Iab", "Ia", "Ib", "III", "II", "IV", "VII", "VI", "V"];
const LUM_KEY = { "Ia0": "0", "Ia-0": "0", Ia: "Ia", Iab: "Iab", Ib: "Ib", II: "II", III: "III", IV: "IV", V: "V", VI: "VI", VII: "VII" };

/**
 * Lee un tipo espectral del catálogo ("M2Ib", "A0Vvar", "K2IIIp", "F5IV-V", "B8Ia", "DA2"…).
 *   { raw, letter ("O"…"M", o "W", "C", "S", "D"), sub (número o null), lum (clave de LUM_KEY o null),
 *     lum2 (segunda clase si el catálogo da un intervalo, p. ej. IV-V), composite (el catálogo indica más de una estrella) }
 * o null si no empieza por una clase reconocible. No interpreta más de lo que el texto dice.
 */
export function parseSpect(s) {
  const raw = String(s || "").trim();
  if (!raw) return null;
  const m = /^(?:sd|sg|g|d(?=[OBAFGKM]))?(D[ABOQZCX]?|W[NCR]?|[OBAFGKMCSNR])\s*(\d(?:\.\d)?)?/.exec(raw);
  if (!m) return null;
  let letter = m[1][0];
  if (letter === "N" || letter === "R") letter = "C";            // N y R: estrellas de carbono (notación antigua)
  const rest = raw.slice(m[0].length).split(/[+\s]/)[0];           // solo la primera componente ("M1Ib + B2.5V" → "Ib")
  const lums = [];
  if (letter !== "D" && letter !== "W") {
    let r = rest;
    for (let guard = 0; guard < 2 && r; guard++) {
      const i = r.search(/[IV]/);
      if (i < 0) break;
      r = r.slice(i);
      const hit = LUM_ORDER.find((k) => r.startsWith(k));
      if (!hit) break;
      lums.push(LUM_KEY[hit]);
      r = r.slice(hit.length);
      if (!/^[-/]/.test(r)) break;
      r = r.slice(1);
    }
  }
  if (/^sd/.test(raw) && !lums.length) lums.push("VI");
  return {
    raw, letter, sub: m[2] != null ? +m[2] : null, lum: lums[0] || null, lum2: lums[1] && lums[1] !== lums[0] ? lums[1] : null,
    composite: /\+|comp/.test(raw),
  };
}
