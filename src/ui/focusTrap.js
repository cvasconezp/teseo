// focusTrap.js — mantiene el foco dentro de un diálogo modal (aria-modal) con Tab y Mayús+Tab:
// del último control se vuelve al primero y al revés. Lo usan los Créditos, el menú, «Reportar un
// problema» (App.jsx) y «Teseo en números» (src/usage/UsageModal.jsx).

export const FOCUSABLE = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

/**
 * Si `e` es Tab, cicla el foco entre el primer y el último control enfocable de `box`.
 * Si el foco está fuera del diálogo (o en el propio contenedor), entra por el extremo que toca.
 * @returns true si movió el foco (y canceló el Tab del navegador)
 */
export function cycleFocus(e, box, active = typeof document !== "undefined" ? document.activeElement : null) {
  if (!box || !e || e.key !== "Tab") return false;
  const els = [...box.querySelectorAll(FOCUSABLE)];
  if (!els.length) { e.preventDefault(); return true; }
  const first = els[0], last = els[els.length - 1];
  const outside = active === box || !active || !box.contains(active);
  if (e.shiftKey && (active === first || outside)) { e.preventDefault(); last.focus(); return true; }
  if (!e.shiftKey && (active === last || (outside && active !== box))) { e.preventDefault(); first.focus(); return true; }
  return false;
}
