// keepAwake.js — que la pantalla del teléfono no se apague mientras se mira el cielo (Screen Wake Lock API).
// Se pide al entrar en la vista Cielo y se vuelve a pedir al regresar a la pestaña (el navegador la suelta al
// ocultarla). Para no gastar batería si el teléfono se queda olvidado, se suelta tras IDLE_MS sin tocar la
// pantalla; el siguiente toque la recupera. Donde el navegador no la tiene, no hace nada.
import { useEffect } from "react";

export const IDLE_MS = 20 * 60 * 1000;

/** Lógica pura (para probarla sin navegador): `nav` = navigator, `doc` = document, `now` = reloj. */
export function createKeepAwake({ nav = typeof navigator !== "undefined" ? navigator : null, doc = typeof document !== "undefined" ? document : null, now = () => Date.now(), idleMs = IDLE_MS } = {}) {
  let lock = null, asking = false, last = now(), on = false;
  const supported = !!(nav && nav.wakeLock && typeof nav.wakeLock.request === "function");
  const acquire = () => {
    if (!supported || !on || lock || asking || (doc && doc.visibilityState !== "visible") || now() - last > idleMs) return;
    asking = true;
    nav.wakeLock.request("screen").then((l) => {
      asking = false;
      if (!on) { l.release().catch(() => {}); return; }
      lock = l;
      if (l.addEventListener) l.addEventListener("release", () => { if (lock === l) lock = null; });
    }, () => { asking = false; });
  };
  const release = () => { if (lock) { const l = lock; lock = null; l.release().catch(() => {}); } };
  return {
    supported,
    get held() { return !!lock; },
    start() { on = true; last = now(); acquire(); },
    stop() { on = false; release(); },
    /** Un toque o una tecla: cuenta como actividad y recupera el bloqueo si se había soltado. */
    activity() { last = now(); acquire(); },
    /** Cada cierto tiempo: suelta el bloqueo si lleva demasiado sin actividad. */
    tick() { if (lock && now() - last > idleMs) release(); },
    visible() { acquire(); },
  };
}

/** Mientras `active` sea true, la pantalla no se apaga (salvo tras IDLE_MS sin tocarla). */
export function useKeepAwake(active) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return undefined;
    const ka = createKeepAwake();
    if (!ka.supported) return undefined;
    ka.start();
    const onAct = () => ka.activity();
    const onVis = () => ka.visible();
    const iv = setInterval(() => ka.tick(), 30000);
    window.addEventListener("pointerdown", onAct, { passive: true });
    window.addEventListener("keydown", onAct);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      window.removeEventListener("pointerdown", onAct);
      window.removeEventListener("keydown", onAct);
      document.removeEventListener("visibilitychange", onVis);
      ka.stop();
    };
  }, [active]);
}
