// rainLook.js — cómo se ve el tiempo que hace: lluvia, cielo cubierto y bruma en la vista Cielo.
//
// El pronóstico (weather.js) da la nubosidad por capas, pero la lluvia sale de nubes gruesas y bajas que esa cifra
// no siempre refleja (un 30 % de bajas con lluvia segura es, sobre ti, una capa cerrada). Aquí, con el tipo de
// tiempo (código OMM), los milímetros y la visibilidad del pronóstico:
//   - se engrosan las capas bajas y medias, y se cierran sobre el observador (`over`: el umbral del ruido baja cerca
//     de él), porque si llueve en tu punto hay una nube encima;
//   - el cielo pasa a la luz de un día cubierto (sin azul, más oscuro con lluvia fuerte; el Sol, tapado);
//   - el aire se llena de bruma según la visibilidad (ley de Koschmieder: contraste 2 % a la visibilidad V).
// Con el satélite reciente, la lluvia del pronóstico solo cuenta si el satélite ve nubes sobre ti. La lluvia es la del
// pronóstico de tu punto exacto (withPointRain), la misma que muestra la tarjeta del tiempo.
//
// Puro; se prueba en scripts/test_weather.mjs. Aproximación visual.

/** Intensidad (0–1) por código de tiempo de la OMM (Open-Meteo `weather_code`). */
export const RAIN_BY_CODE = {
  51: 0.25, 53: 0.35, 55: 0.45, 56: 0.3, 57: 0.45,       // llovizna
  61: 0.45, 63: 0.7, 65: 1, 66: 0.45, 67: 0.8,           // lluvia
  71: 0.3, 73: 0.5, 75: 0.8, 77: 0.3,                    // nieve
  80: 0.5, 81: 0.75, 82: 1, 85: 0.5, 86: 0.8,            // chubascos
  95: 1, 96: 1, 99: 1,                                   // tormenta
};
const SHOWER = new Set([80, 81, 82, 85, 86, 95, 96, 99]);
const FOG = new Set([45, 48]);
/** Visibilidad (km) a partir de la cual el pronóstico no añade bruma: muchos modelos la topan en ~24 km. */
export const VIS_CLEAR_KM = 20;
const K = 3.912;            // −ln(0,02): contraste umbral de Koschmieder

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Intensidad de precipitación (0–1) en un instante del pronóstico: { code, mm (mm/h) }. */
export function rainAmount(c) {
  if (!c) return 0;
  const mm = Number.isFinite(c.mm) ? Math.max(0, c.mm) : null;
  const byMm = mm == null ? 0 : clamp01(Math.sqrt(mm / 6));        // 0,1 mm → 0,13 · 1 mm → 0,41 · 6 mm → 1
  if (c.code == null) return mm != null && mm >= 0.1 ? byMm : 0;
  const byCode = RAIN_BY_CODE[c.code] || 0;
  if (!byCode) return mm != null && mm >= 0.3 ? byMm * 0.6 : 0;
  return Math.max(byCode, byMm);
}

/**
 * La lluvia de TU punto en las nubes del instante: el pronóstico por capas (weather.js) es el de una zona de ~11 km a la
 * altura media del modelo; la probabilidad, el tipo de tiempo, los milímetros y la visibilidad se toman del pronóstico
 * del lugar exacto y su altitud (nowWeather.js, la misma consulta que la tarjeta del tiempo), para que el dibujo y la
 * tarjeta digan lo mismo. hr: hourAt(...) o null (fuera de sus 26 h: se queda lo de la zona). `rainSrc`: "point" | "cell".
 */
export function withPointRain(fc, hr) {
  if (!fc) return fc;
  if (!hr) return { ...fc, rainSrc: "cell" };
  return { ...fc, code: hr.code, mm: hr.mm, visKm: hr.visKm, precip: hr.pop != null ? hr.pop / 100 : fc.precip, rainSrc: "point" };
}

/** Coeficiente de extinción extra (1/km) por la visibilidad del pronóstico (0 si es buena o falta). */
export function visBeta(visKm) {
  if (!Number.isFinite(visKm) || visKm >= VIS_CLEAR_KM) return 0;
  return K * (1 / Math.max(0.1, visKm) - 1 / VIS_CLEAR_KM);
}

/**
 * La bruma esperada cuando la visibilidad baja solo con probabilidad `p`: la extinción que, a 15 km (la distancia de
 * las montañas que se ven), borra lo mismo que la media entre «con lluvia» (β) y «sin ella» (0).
 */
export function expectedBeta(beta, p) {
  if (!(beta > 0)) return 0;
  const pp = clamp01(p);
  if (pp >= 1) return beta;
  const h = pp * (1 - Math.exp(-beta * 15));
  return h > 0 ? -Math.log(1 - h) / 15 : 0;
}

/**
 * Nubes sobre ti según el satélite (0–1): la cobertura media de las celdas a menos de `rKm` del centro de la malla
 * (cualquier capa: el satélite ve el tope). null si no hay malla.
 */
export function satOverhead(sat, rKm = 12) {
  if (!sat || !sat.layers || !sat.n) return null;
  const n = sat.n, c = (n - 1) / 2, r = rKm / (sat.res || 3), L = sat.layers;
  let sum = 0, cnt = 0;
  for (let y = Math.max(0, Math.floor(c - r)); y <= Math.min(n - 1, Math.ceil(c + r)); y++) {
    for (let x = Math.max(0, Math.floor(c - r)); x <= Math.min(n - 1, Math.ceil(c + r)); x++) {
      if ((x - c) ** 2 + (y - c) ** 2 > r * r) continue;
      const i = y * n + x;
      if (L.low[i] === 255 || L.mid[i] === 255 || L.high[i] === 255) continue;
      sum += Math.min(1, (L.low[i] + L.mid[i] + L.high[i]) / 100); cnt++;
    }
  }
  return cnt ? sum / cnt : null;
}

/**
 * El tiempo de un instante (cloudsAt de weather.js, o null) → { rain, shower, fogBeta, beta } o null.
 * sat, w: la malla del satélite y su peso (satWeight). Con el satélite, la lluvia baja si no ve nubes encima.
 * beta: extinción del aire (1/km) por la visibilidad, la lluvia o la niebla.
 */
export function rainLook(fc, sat = null, w = 0) {
  if (!fc) return null;
  // el código y los milímetros de la hora dicen cómo llovería SI llueve; con poca probabilidad no se dibuja
  // (25 % → nada; 50 % → algo menos de la mitad; desde 80 %, toda): un chubasco posible no oscurece el cielo ni borra
  // las montañas (en Cayambe, un 49 % dibujado casi entero dio un cielo de lluvia que no llovía)
  const pRain = Number.isFinite(fc.precip) ? sstep(0.25, 0.8, fc.precip) : 1;
  let rain = rainAmount(fc) * pRain;
  const over = w > 0 ? satOverhead(sat) : null;
  if (over != null) rain *= 1 - w + w * sstep(0.25, 0.7, over);
  const shower = SHOWER.has(fc.code);
  // la lluvia también quita visibilidad aunque el modelo no la dé (fuerte: ~2 km; débil: ~10 km)
  // la visibilidad baja que el modelo da junto con lluvia es la de cuando llueve: cuenta según su probabilidad
  // (la visibilidad del modelo es un diagnóstico de su humedad: con un código sin niebla ni precipitación —despejado,
  // nubes— no se cree. En Cayambe, a las 9h00, el código 1 «casi despejado» venía con 1,4 km de visibilidad, y las
  // montañas a 15 km quedaban borradas mientras a la vista se veían enteras)
  // (salvo «cubierto» con menos de 1 km: hay modelos que nunca dan el código de niebla y es su única señal de nube a ras
  // del suelo)
  const visOk = fc.code == null || FOG.has(fc.code) || !!RAIN_BY_CODE[fc.code] || (fc.code === 3 && fc.visKm < 1);
  let vb = visOk ? visBeta(fc.visKm) : 0;
  if (vb > 0 && RAIN_BY_CODE[fc.code] && Number.isFinite(fc.precip)) vb = expectedBeta(vb, pRain);
  let beta = Math.max(vb, 2 * Math.pow(rain, 2.2));
  if (FOG.has(fc.code) && !Number.isFinite(fc.visKm)) beta = Math.max(beta, K / 0.5);
  if (over != null && w > 0) beta *= 1 - w + w * sstep(0.15, 0.6, over);
  return { rain, shower, beta };
}

/**
 * Las nubes engrosadas por la lluvia: bajas hacia 92 % y medias hacia 75 % según la intensidad, y cerradas sobre ti
 * (`over`: cuánto baja el umbral del ruido en el cenit; `overR`: radio en km — más corto en un chubasco).
 * Nunca quita nubes. Devuelve una copia (o fc tal cual si no llueve).
 */
export function thickenForRain(fc, look) {
  if (!fc || !look || !(look.rain > 0.02)) return fc;
  const r = look.rain, up = (v, to, k) => (v == null ? to * k : v + Math.max(0, to - v) * k);
  return {
    ...fc,
    low: up(fc.low, 0.92, r), mid: up(fc.mid, 0.75, r * 0.8),
    over: { low: 0.55 * r, mid: 0.3 * r, high: 0 }, overR: look.shower ? 7 : 25,
  };
}

/**
 * Cuán cubierto está el cielo (0–1) para la luz: bajas y medias cerradas, o lluvia; las altas solo lo blanquean. Con el
 * satélite reciente pesa sobre todo lo que él ve: si deja claros, el cielo entre las nubes sigue azul aunque llueva.
 */
export function overcastOf(clouds, look) {
  if (!clouds) return 0;
  const lm = 1 - (1 - (clouds.low || 0)) * (1 - (clouds.mid || 0));
  const rainK = clouds.sat ? 1 - 0.7 * (clouds.satW || 0) : 1;
  return clamp01(Math.max(sstep(0.5, 0.9, lm) * 0.9, (clouds.high || 0) * 0.2, look ? look.rain * 1.25 * rainK : 0));
}

/** Cuánto borra la bruma algo a `dKm` km (0–0,95). */
export function hazeAt(wx, dKm) {
  if (!wx || !(wx.beta > 0) || !(dKm > 0)) return 0;
  return Math.min(0.95, 1 - Math.exp(-wx.beta * dKm));
}

const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const OVC_ZEN = [0.53, 0.56, 0.6], OVC_HOR = [0.66, 0.68, 0.71];   // cielo cubierto de día (como los de skyColors)

/**
 * El estado del cielo (skyState de atmosphere.js) con el tiempo: colores de día cubierto y bruma, y `wx` = { rain,
 * overcast, beta, shower } para quien pinte nubes, montañas y monumentos. Sin efecto, devuelve st tal cual.
 */
export function weatherSky(st, clouds, look) {
  if (!st || !st.colors) return st;
  const o = overcastOf(clouds, look), rain = look ? look.rain : 0, beta = look ? look.beta : 0;
  if (o < 0.02 && !(beta > 0)) return st;
  const day = sstep(-6, 8, st.sunAlt), c = st.colors;
  const dark = 1 - 0.38 * rain;                                         // con lluvia fuerte, más oscuro
  const k = o * day * 0.95;
  let zenith = mix3(c.zenith, OVC_ZEN.map((v) => v * dark), k);
  let horizon = mix3(c.horizon, OVC_HOR.map((v) => v * dark), k);
  // bruma: el horizonte se vuelve del gris del aire (a ~8 km de camino)
  const hz = (1 - Math.exp(-beta * 8)) * day;
  horizon = mix3(horizon, OVC_HOR.map((v) => v * dark), hz * 0.8);
  zenith = mix3(zenith, horizon, hz * 0.3);
  // de noche, sin luz del Sol, las nubes ya las pinta cloudsLayer; el resplandor del crepúsculo se apaga bajo ellas
  const colors = { ...c, zenith, horizon, sunGlow: mix3(c.sunGlow, horizon, o * 0.6), glow: c.glow * (1 - 0.9 * o),
    ground: mix3(c.ground, horizon, 0.1 * o * day) };
  return { ...st, colors, wx: { rain, overcast: o, beta, shower: !!(look && look.shower) } };
}
