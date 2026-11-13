// Sensores del modo "Apuntar al cielo": permiso, eventos de orientación,
// elección de la mejor fuente y bloqueo de pantalla (Wake Lock).
// La matemática vive en deviceOrientation.js; aquí solo hay DOM.
//
// Fuentes, de mejor a peor:
//   1. iOS: `deviceorientation` + `webkitCompassHeading` (alpha es relativo; la
//      brújula fija el norte). Requiere DeviceOrientationEvent.requestPermission()
//      DENTRO del gesto del usuario.
//   2. Android/Chrome: `deviceorientationabsolute` (alpha absoluto), o
//      `deviceorientation` con event.absolute === true.
//   3. Solo orientación relativa: funciona, pero el norte hay que alinearlo a mano.
import { validAngles, normalizeScreenAngle, compassReliable, compassAlphaOffset, smoothAngle, wrap360 } from "./deviceOrientation.js";

/** ¿Tiene sentido ofrecer el modo? Táctil + API de orientación + contexto seguro. */
export function pointingSupported() {
  try {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return false;
    if (window.isSecureContext === false) return false;        // los sensores exigen HTTPS
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    return !!coarse || (navigator.maxTouchPoints || 0) > 0;
  } catch { return false; }
}

function screenAngle() {
  try {
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === "number") return normalizeScreenAngle(window.screen.orientation.angle);
    if (typeof window.orientation === "number") return normalizeScreenAngle(window.orientation);   // iOS antiguo
  } catch { /* no-op */ }
  return 0;
}

/**
 * Crea el lector de sensores. `onStatus(estado)` avisa de los cambios:
 *   "starting"  esperando permiso o el primer dato
 *   "absolute"  hay norte (brújula o alpha absoluto)
 *   "relative"  solo orientación relativa: pide alinear a mano
 *   "denied"    permiso denegado            (el lector se detiene)
 *   "nosensor"  no llegan datos utilizables (el lector se detiene)
 * El bucle de render lee `pose` (objeto fijo, se muta en cada evento).
 */
export function createPointing(onStatus) {
  // alpha ya es absoluto (o lo mejor disponible); `fresh` = hay al menos una lectura
  const pose = { alpha: 0, beta: 0, gamma: 0, screen: 0, fresh: false };
  let running = false, status = "off", startedAt = 0, noDataTimer = 0;
  let rank = 0, lastBestAt = 0;          // 2 = absoluto/brújula, 1 = relativo
  let iosOffset = 0, iosLocked = false;  // desfase alpha relativo → absoluto (brújula de iOS)
  let wakeLock = null, wantLock = false;

  const setStatus = (s) => { if (s !== status) { status = s; if (onStatus) onStatus(s); } };

  const onOrient = (e) => {
    if (!running) return;
    const { alpha, beta, gamma } = e;
    if (!validAngles(alpha, beta, gamma)) return;          // escritorio / sensor aún sin datos: llegan null
    const now = Date.now();
    const heading = e.webkitCompassHeading;
    const hasCompass = typeof heading === "number" && Number.isFinite(heading) && heading >= 0
      && !(typeof e.webkitCompassAccuracy === "number" && e.webkitCompassAccuracy < 0);
    const absolute = e.type === "deviceorientationabsolute" || e.absolute === true;
    let a = alpha, r = 1;
    if (absolute) {
      r = 2;
    } else if (hasCompass) {
      // iOS: el desfase se fija (y se afina despacio) solo en posturas donde la brújula es fiable
      const off = compassAlphaOffset(heading, alpha);
      if (compassReliable(beta)) { iosOffset = iosLocked ? smoothAngle(iosOffset, off, 0.04) : off; iosLocked = true; }
      else if (!iosLocked) iosOffset = off;                // provisional hasta pasar por una postura fiable
      a = wrap360(alpha + iosOffset);
      r = iosLocked ? 2 : 1;
    } else if (iosLocked) {
      a = wrap360(alpha + iosOffset);                      // evento suelto sin brújula: se mantiene el norte conocido
      r = 2;
    }
    // si hay una fuente mejor activa, se ignoran los eventos relativos que llegan en paralelo
    if (r < rank && now - lastBestAt < 1500) return;
    rank = r; if (r === 2) lastBestAt = now;
    pose.alpha = a; pose.beta = beta; pose.gamma = gamma; pose.screen = screenAngle(); pose.fresh = true;
    if (noDataTimer) { clearTimeout(noDataTimer); noDataTimer = 0; }
    // "relativo" se declara tras un margen: en Android el evento absoluto puede tardar un poco más
    if (r === 2) setStatus("absolute");
    else if (now - startedAt > 1200) setStatus("relative");
  };
  const onScreen = () => { pose.screen = screenAngle(); };

  const acquireLock = () => {
    if (!wantLock || wakeLock || !navigator.wakeLock || document.visibilityState !== "visible") return;
    navigator.wakeLock.request("screen").then((l) => {
      if (!wantLock) { l.release().catch(() => {}); return; }
      wakeLock = l;
      l.addEventListener("release", () => { if (wakeLock === l) wakeLock = null; });
    }).catch(() => { /* batería baja o no permitido: el modo sigue sin bloqueo */ });
  };
  const releaseLock = () => {
    wantLock = false;
    if (wakeLock) { const l = wakeLock; wakeLock = null; l.release().catch(() => {}); }
  };
  // el sistema suelta el bloqueo al ocultar la página: se vuelve a pedir al regresar
  const onVisible = () => { if (document.visibilityState === "visible") acquireLock(); };

  const listen = () => {
    if (!running) return;
    startedAt = Date.now();
    window.addEventListener("deviceorientationabsolute", onOrient, true);
    window.addEventListener("deviceorientation", onOrient, true);
    window.addEventListener("orientationchange", onScreen);
    if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) window.screen.orientation.addEventListener("change", onScreen);
    document.addEventListener("visibilitychange", onVisible);
    // sin un solo dato válido en 4 s: no hay sensores (o el navegador los bloquea)
    noDataTimer = setTimeout(() => { noDataTimer = 0; if (running && !pose.fresh) { stop(); setStatus("nosensor"); } }, 4000);
  };

  /** Debe llamarse dentro del gesto del usuario (iOS solo muestra el permiso así). */
  function start() {
    if (running) return;
    running = true; rank = 0; lastBestAt = 0; pose.fresh = false;
    setStatus("starting");
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      let p;
      try { p = DOE.requestPermission(); } catch { p = Promise.reject(new Error("requestPermission")); }
      Promise.resolve(p).then((res) => {
        if (!running) return;
        if (res === "granted") listen(); else { stop(); setStatus("denied"); }
      }).catch(() => { if (running) { stop(); setStatus("denied"); } });
    } else {
      listen();
    }
    // después del permiso de sensores: así ese permiso es lo primero que consume el gesto
    wantLock = true; acquireLock();
  }

  /** Quita listeners y suelta el bloqueo de pantalla. Se puede llamar varias veces. */
  function stop() {
    running = false;
    if (noDataTimer) { clearTimeout(noDataTimer); noDataTimer = 0; }
    window.removeEventListener("deviceorientationabsolute", onOrient, true);
    window.removeEventListener("deviceorientation", onOrient, true);
    window.removeEventListener("orientationchange", onScreen);
    if (window.screen && window.screen.orientation && window.screen.orientation.removeEventListener) window.screen.orientation.removeEventListener("change", onScreen);
    document.removeEventListener("visibilitychange", onVisible);
    releaseLock();
    pose.fresh = false;
    status = "off";      // sin aviso: quien llama a stop() ya conoce el motivo
  }

  return { pose, start, stop, isRunning: () => running, hasWakeLock: () => !!wakeLock };
}
