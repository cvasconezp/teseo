// focus.js — gestión del foco de los paneles y diálogos del visor (accesibilidad por teclado).
// Al abrirse, el foco entra en el panel (en su título); con `trap`, Tab y Mayús+Tab dan la
// vuelta dentro de él; al cerrarse, el foco vuelve al control que lo abrió.
import { useEffect } from "react";

const FOCUSABLE = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex='-1'])";
export const focusables = (root) => [...root.querySelectorAll(FOCUSABLE)].filter((e) => e.offsetParent !== null || e === document.activeElement);

// ¿la última interacción fue con el teclado? (el buscador suelta el foco al elegir con Enter)
let lastWasKey = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => { if (e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt" && e.key !== "Meta") lastWasKey = true; }, true);
  window.addEventListener("pointerdown", () => { lastWasKey = false; }, true);
}

export function useDialogFocus(ref, { trap = false, initial = "h2" } = {}) {
  useEffect(() => {
    const box = ref.current; if (!box) return undefined;
    const prev = document.activeElement;
    const stage = box.closest(".sk-stage");
    // solo se mueve el foco si quien abrió fue un control (teclado, botón, buscador): un toque en el
    // cielo no debe robarlo, y tampoco se interrumpe a quien está escribiendo en el buscador
    const fromControl = lastWasKey || (prev && prev !== document.body && !(prev.classList && prev.classList.contains("sk-canvas")) && prev.tagName !== "CANVAS");
    if (fromControl && !box.contains(prev)) {
      const target = (initial && box.querySelector(initial)) || box;
      if (!target.hasAttribute("tabindex") && !/^(BUTTON|A|INPUT|SELECT)$/.test(target.tagName)) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
    const onKey = (e) => {
      if (!trap || e.key !== "Tab") return;
      const els = focusables(box); if (!els.length) return;
      const first = els[0], last = els[els.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || !box.contains(a) || a.getAttribute("tabindex") === "-1")) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !box.contains(a))) { e.preventDefault(); first.focus(); }
    };
    box.addEventListener("keydown", onKey);
    return () => {
      box.removeEventListener("keydown", onKey);
      // se devuelve el foco solo si seguía dentro del panel (si la persona ya tocó otra cosa, se respeta)
      const a = document.activeElement;
      if (!fromControl || !(!a || a === document.body || box.contains(a))) return;
      if (prev && prev !== document.body && prev.isConnected && typeof prev.focus === "function") prev.focus({ preventScroll: true });
      else {
        // el control que lo abrió ya no existe (p. ej. un resultado del buscador): el foco vuelve al cielo
        const sky = stage && stage.querySelector(".sk-canvas");
        if (sky) sky.focus({ preventScroll: true });
      }
    };
  }, [ref, trap, initial]);
}
