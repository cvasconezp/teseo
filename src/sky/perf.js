// perf.js — medición de rendimiento del cielo (módulo puro, sin DOM ni Three.js).
//
// Tres piezas que usa el bucle de animación de Constellations.jsx:
//   1. perfFlag(hash, search)   ¿está activado el medidor?  (#sky?...&fps=1  o  ?perf=1)
//   2. createFrameStats()       FPS medio, "1 % bajo" y tiempo de JS por cuadro, sobre una
//                               ventana deslizante de cuadros REALMENTE dibujados;
//   3. createAdaptive()         resolución adaptativa: baja la densidad de píxeles del render
//                               cuando los FPS se mantienen bajos unos segundos y la restaura
//                               cuando vuelven a sobrar (con histéresis, para que no oscile).
//
// Qué mide y qué no: los tiempos son los que ve JavaScript (intervalo entre cuadros y
// tiempo de CPU dentro del bucle, incluida la preparación del dibujo). El tiempo de la
// GPU no se puede leer desde una página web: solo se nota en el intervalo entre cuadros.

/** ¿Pide la URL el medidor? Acepta fps=1 o perf=1, en la parte del hash (#sky?…) o en la consulta (?…). */
export function perfFlag(hash, search) {
  const on = (qs) => { try { const p = new URLSearchParams(qs || ""); return p.get("fps") === "1" || p.get("perf") === "1"; } catch { return false; } };
  const h = String(hash || ""), qi = h.indexOf("?");
  return on(qi >= 0 ? h.slice(qi + 1) : "") || on(String(search || "").replace(/^\?/, ""));
}

/** Percentil p (0–1) de una lista de números (interpolación lineal). */
export function percentile(values, p) {
  if (!values.length) return 0;
  const s = Array.from(values).sort((a, b) => a - b), i = (s.length - 1) * Math.min(1, Math.max(0, p)), lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

/**
 * Estadísticas por cuadro en una ventana deslizante de `cap` cuadros.
 *   push(dtMs, jsMs)  intervalo desde el cuadro anterior y tiempo de JS de este cuadro
 *   summary()         { n, fps (media = 1000 / intervalo medio), low1 (FPS medio del 1 % de cuadros más
 *                       lentos), jsMean, jsP95 }
 * Los intervalos de más de `gapMs` (pestaña en segundo plano, bucle en reposo) no cuentan.
 */
export function createFrameStats(cap = 600, gapMs = 400) {
  const dt = new Float32Array(cap), js = new Float32Array(cap);
  let n = 0, head = 0;
  return {
    push(dtMs, jsMs) {
      if (!(dtMs > 0) || dtMs > gapMs) return false;
      dt[head] = dtMs; js[head] = jsMs > 0 ? jsMs : 0; head = (head + 1) % cap; if (n < cap) n++;
      return true;
    },
    reset() { n = 0; head = 0; },
    summary() {
      if (!n) return { n: 0, fps: 0, low1: 0, jsMean: 0, jsP95: 0 };
      const a = dt.subarray(0, n), b = js.subarray(0, n);
      let sd = 0, sj = 0; for (let i = 0; i < n; i++) { sd += a[i]; sj += b[i]; }
      // "1 % bajo": FPS medio del 1 % de cuadros más lentos de la ventana (al menos uno)
      const slow = Array.from(a).sort((x, y) => y - x).slice(0, Math.max(1, Math.ceil(n / 100)));
      const low1 = 1000 / (slow.reduce((x, y) => x + y, 0) / slow.length);
      return { n, fps: 1000 / (sd / n), low1, jsMean: sj / n, jsP95: percentile(b, 0.95) };
    },
  };
}

/**
 * Resolución adaptativa. `ratio` es la densidad de píxeles del render (devicePixelRatio efectivo).
 *   max        tope: min(devicePixelRatio, 2) — por encima de 2 el ojo no gana nada y la GPU pinta 2–3× más píxeles
 *   min        suelo: no se baja de aquí (por defecto max(0,75, max/2)): por debajo la imagen se ve borrosa
 *   lowFps     por debajo de esto, mantenido `downMs`, se baja un escalón (× step)
 *   highFps    por encima de esto, mantenido `upMs`, se sube un escalón (÷ step)
 * update(fps, elapsedMs) devuelve el nuevo ratio si cambió, o null. Tras cada cambio espera `settleMs`
 * antes de volver a medir (el propio cambio provoca un cuadro lento).
 * Si tras subir vuelve a caer enseguida, el tiempo de espera para volver a subir se duplica (hasta 60 s).
 */
export function createAdaptive({ max, min, lowFps = 30, highFps = 50, downMs = 2500, upMs = 6000, step = 0.8, settleMs = 800 } = {}) {
  const top = Math.max(0.5, max || 1), floor = Math.min(top, min != null ? min : Math.max(0.75, top / 2));
  let ratio = top, lowFor = 0, highFor = 0, settle = 0, upWait = upMs, lastUpAt = -1, clock = 0;
  return {
    get ratio() { return ratio; }, get min() { return floor; }, get max() { return top; },
    update(fps, elapsedMs) {
      clock += elapsedMs;
      if (settle > 0) { settle -= elapsedMs; return null; }
      if (!(fps > 0)) return null;
      if (fps < lowFps) { lowFor += elapsedMs; highFor = 0; } else if (fps > highFps) { highFor += elapsedMs; lowFor = 0; } else { lowFor = 0; highFor = 0; }
      if (lowFor >= downMs && ratio > floor + 1e-6) {
        if (lastUpAt >= 0 && clock - lastUpAt < 15000) upWait = Math.min(60000, upWait * 2);   // subir fue un error: más paciencia la próxima vez
        ratio = Math.max(floor, ratio * step); lowFor = 0; highFor = 0; settle = settleMs;
        return ratio;
      }
      if (highFor >= upWait && ratio < top - 1e-6) {
        ratio = Math.min(top, ratio / step); if (top - ratio < 0.02) ratio = top;
        lowFor = 0; highFor = 0; settle = settleMs; lastUpAt = clock;
        return ratio;
      }
      return null;
    },
  };
}
