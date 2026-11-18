// backGuard.js — «atrás» del teléfono dentro de Teseo (gesto o botón):
//   1. Si hay algo abierto (una ficha, un panel, el menú, apuntar al cielo…), atrás lo cierra.
//   2. Si no, aparece «Pulsa de nuevo para salir»; un segundo atrás en 2 s sale de la app (o vuelve a la página
//      anterior en el navegador). Pasados los 2 s, todo vuelve a empezar.
//
// Cómo: la entrada del historial con la que se abrió la app queda marcada como «base» y encima se pone una
// entrada «guardia» con la misma dirección. Atrás saca la guardia (se vuelve a la base): ahí se decide. La app
// cambia su dirección (#sky?…) con replaceState sobre la guardia; los envoltorios conservan las marcas y
// recuerdan la dirección vigente, que se copia a la base al volver, para que la vista no salte.
//
// onBack(): true si cerró algo (entonces se repone la guardia sin aviso). Lo puro (decide) se prueba en
// scripts/test_back_guard.mjs.

export const EXIT_WINDOW_MS = 2000;

/**
 * Qué hacer al llegar a la base: "closed" (se cerró algo: reponer la guardia), "toast" (avisar y esperar el
 * segundo atrás) o "exit" (segundo atrás dentro de la ventana: dejar salir).
 */
export function decide({ closedSomething, now, armedUntil }) {
  if (closedSomething) return "closed";
  if (now < armedUntil) return "exit";
  return "toast";
}

/** ¿Conviene la guardia? En el teléfono o con la app instalada; en un ordenador, atrás es atrás. */
export function wantsGuard(win = typeof window !== "undefined" ? window : null) {
  if (!win || !win.history || !win.matchMedia) return false;
  try {
    const standalone = win.matchMedia("(display-mode: standalone)").matches || win.navigator.standalone === true;
    const coarse = win.matchMedia("(pointer: coarse)").matches;
    return standalone || coarse;
  } catch { return false; }
}

const BASE = "teseoBase", GUARD = "teseoGuard";
const marked = (st) => !!(st && (st[BASE] || st[GUARD]));

/** Instala la guardia. Devuelve una función para quitarla. */
export function installBackGuard({ onBack, toast, win = window }) {
  const h = win.history, orig = { push: h.pushState.bind(h), replace: h.replaceState.bind(h) };
  let cur = win.location.href, armedUntil = 0, timer = 0;
  // la app reemplaza su dirección con state = null: se conserva la marca de la entrada en la que está
  h.replaceState = function (state, title, url) {
    const keep = marked(h.state) && (state == null) ? { ...h.state } : state;
    orig.replace(keep, title, url); cur = win.location.href;
  };
  h.pushState = function (state, title, url) { orig.push(state, title, url); cur = win.location.href; };

  const pushGuard = () => { orig.push({ [GUARD]: 1 }, "", cur); };
  // al abrir: la entrada actual es la base y encima va la guardia; al recargar, si ya hay guardia, se deja
  if (h.state && h.state[GUARD]) { /* ya guardado */ }
  else { orig.replace({ ...(h.state || {}), [BASE]: 1 }, "", cur); pushGuard(); }

  const onPop = () => {
    if (!(h.state && h.state[BASE])) { cur = win.location.href; return; }   // navegación propia de la app
    // vuelta a la base: la dirección queda la de la app (la vista no cambia)
    orig.replace({ ...(h.state || {}), [BASE]: 1 }, "", cur);
    const act = decide({ closedSomething: !!onBack(), now: Date.now(), armedUntil });
    if (act === "closed") { pushGuard(); return; }
    if (act === "exit") return;
    armedUntil = Date.now() + EXIT_WINDOW_MS;
    toast();
    clearTimeout(timer);
    timer = setTimeout(() => {
      armedUntil = 0;
      if (h.state && h.state[BASE]) pushGuard();        // no salió: la guardia vuelve a su sitio
    }, EXIT_WINDOW_MS);
  };
  win.addEventListener("popstate", onPop);
  return () => {
    win.removeEventListener("popstate", onPop);
    clearTimeout(timer);
    h.replaceState = orig.replace; h.pushState = orig.push;
  };
}

/** Aviso flotante «Pulsa de nuevo para salir» (un solo elemento, se reutiliza). */
export function showExitToast(text, doc = document) {
  let el = doc.getElementById("teseo-exit-toast");
  if (!el) {
    el = doc.createElement("div");
    el.id = "teseo-exit-toast"; el.className = "exit-toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    doc.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.remove("is-on"); void el.offsetWidth; el.classList.add("is-on");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("is-on"), EXIT_WINDOW_MS);
}
