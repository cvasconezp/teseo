// viewport.js — disposición del visor: ocupa todo el ancho de la ventana y va desde
// el borde inferior de la cabecera/pestañas hasta el borde inferior REAL de la ventana.
//
// En un teléfono el alto visible cambia sin avisar (la barra de direcciones se
// esconde y vuelve, la barra de gestos, el teclado). Por eso el alto no se deja solo
// a `100vh`: se mide el borde inferior real con un testigo `position: fixed` (el
// navegador lo ancla al área visible de verdad) y con `visualViewport`, y se vuelve a
// medir en cada cambio. El CSS conserva un respaldo con `100dvh` / `100vh` por si
// este código no llega a ejecutarse.
//
// Mientras el visor cabe entero, la página no se desplaza (clase `sk-lock` en
// <html>): así no puede quedar a medias con una franja vacía debajo.
import { useEffect } from "react";

export const STAGE_MIN = 360;        // por debajo de esto (teléfono apaisado) el visor no encoge más y la página sí se desplaza
const LOCK = "sk-lock";

/**
 * Combina las medidas del alto visible (cálculo puro, se prueba con Node).
 * @param {number} fixedH  alto de un elemento `position: fixed` de arriba abajo (0 si no se pudo medir)
 * @param {number} innerH  window.innerHeight
 * @param {{height:number, scale:number, offsetTop:number}|null} vv  visualViewport
 */
export function pickViewportHeight(fixedH, innerH, vv) {
  let h = fixedH > 0 ? fixedH : innerH > 0 ? innerH : 0;
  if (vv && vv.height > 0 && Math.abs((vv.scale || 1) - 1) < 0.01) {
    const v = vv.height + (vv.offsetTop || 0);
    // una diferencia pequeña es una barra del navegador (manda lo visible); una grande es el
    // teclado en pantalla, que tapa el visor pero no debe encogerlo mientras se escribe
    if (!(h > 0)) h = v; else if (v < h && h - v <= KEYBOARD_MIN) h = v;
  }
  return h;
}
const KEYBOARD_MIN = 150;

/** Alto visible real de la ventana en píxeles CSS. */
export function viewportHeight(probe) {
  const fixedH = probe ? probe.getBoundingClientRect().height : 0;
  return pickViewportHeight(fixedH, window.innerHeight || document.documentElement.clientHeight || 0, window.visualViewport || null);
}

/**
 * Cálculo puro (se prueba con Node): alto del visor y si la página se bloquea.
 * @param {number} viewH   alto visible de la ventana
 * @param {number} top     distancia del borde superior del visor al inicio del documento
 * @param {number} gutter  margen inferior (escritorio)
 */
export function stageHeight(viewH, top, gutter = 0) {
  const avail = Math.floor(viewH - top - gutter);
  const fits = avail >= STAGE_MIN;
  return { height: Math.max(STAGE_MIN, avail), fits };
}

/**
 * Mide y aplica la disposición sobre `wrapRef` (variables CSS --sk-ml, --sk-w, --sk-top,
 * --sk-h, --sk-safe) y avisa del ancho con `onWide(boolean)`.
 */
export function useStageLayout(wrapRef, onWide) {
  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return undefined;
    const root = document.documentElement;
    // testigo fijo: su alto es el del área visible real, con las barras del navegador como estén ahora
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:fixed;top:0;bottom:0;left:0;width:0;visibility:hidden;pointer-events:none;z-index:-1";
    document.body.appendChild(probe);
    let raf = 0, last = "", lastViewH = 0;
    const measure = () => {
      raf = 0;
      const r = wrap.getBoundingClientRect();
      const vw = root.clientWidth;
      const wide = vw >= 900;
      const gutter = wide ? 16 : 0;
      const top = Math.round(r.top + window.scrollY);
      let viewH = viewportHeight(probe);
      // navegadores que encogen la ventana al abrir el teclado: mientras se escribe se conserva el alto anterior
      const ae = document.activeElement;
      if (lastViewH - viewH > KEYBOARD_MIN && ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && wrap.contains(ae)) viewH = lastViewH;
      else lastViewH = viewH;
      const { height, fits } = stageHeight(viewH, top, gutter);
      // si la página muestra un aviso fijo abajo (cookies), los controles suben para no quedar tapados
      const ck = document.getElementById("yd-cookies");
      let safe = 0;
      if (ck && window.scrollY < 4) {
        const cr = ck.getBoundingClientRect();
        if (cr.height > 0) safe = Math.max(0, Math.min(top + height, viewH) - cr.top);
      }
      const key = [gutter - Math.round(r.left), vw, top, height, fits, Math.round(safe)].join("|");
      onWide(wide);
      if (key === last) return;
      last = key;
      wrap.style.setProperty("--sk-ml", `${gutter - r.left}px`);
      wrap.style.setProperty("--sk-w", `${vw - gutter * 2}px`);
      wrap.style.setProperty("--sk-top", `${top + gutter}px`);
      wrap.style.setProperty("--sk-h", `${height}px`);
      wrap.style.setProperty("--sk-safe", `${Math.round(safe)}px`);
      if (fits) {
        if (!root.classList.contains(LOCK)) { root.classList.add(LOCK); if (window.scrollY > 0) window.scrollTo(0, 0); }
      } else root.classList.remove(LOCK);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(schedule) : null;
    if (mo) mo.observe(document.body, { childList: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (ro) { ro.observe(wrap); ro.observe(document.body); ro.observe(probe); }
    const evs = ["resize", "orientationchange", "pageshow", "scroll"];
    evs.forEach((e) => window.addEventListener(e, schedule, { passive: true }));
    document.addEventListener("visibilitychange", schedule);
    const vv = window.visualViewport;
    if (vv) { vv.addEventListener("resize", schedule); vv.addEventListener("scroll", schedule); }
    // la barra de direcciones termina de animarse y las fuentes cambian el alto de la cabecera un poco después
    const timers = [120, 400, 900, 2000].map((ms) => setTimeout(schedule, ms));
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      evs.forEach((e) => window.removeEventListener(e, schedule));
      document.removeEventListener("visibilitychange", schedule);
      if (vv) { vv.removeEventListener("resize", schedule); vv.removeEventListener("scroll", schedule); }
      timers.forEach(clearTimeout);
      root.classList.remove(LOCK);
      probe.remove();
    };
  }, [wrapRef, onWide]);
}
