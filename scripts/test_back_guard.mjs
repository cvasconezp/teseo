// Pruebas de «atrás» en el teléfono (src/ui/backGuard.js): primero cierra lo abierto; sin nada abierto, avisa
// «Pulsa de nuevo para salir» y solo un segundo atrás en 2 s sale. Con un historial simulado.
import { decide, wantsGuard, installBackGuard, EXIT_WINDOW_MS } from "../src/ui/backGuard.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

ok(decide({ closedSomething: true, now: 0, armedUntil: 0 }) === "closed", "si algo se cerró, no hay aviso");
ok(decide({ closedSomething: false, now: 10, armedUntil: 0 }) === "toast", "sin nada abierto: aviso");
ok(decide({ closedSomething: false, now: 10, armedUntil: 2000 }) === "exit", "segundo atrás dentro de la ventana: sale");
ok(EXIT_WINDOW_MS === 2000, "ventana de 2 segundos");

// navegador simulado: pila de entradas { state, url }, popstate al ir atrás
function fakeWin(url, mq = {}) {
  const listeners = {};
  const win = {
    location: { href: url },
    navigator: {},
    matchMedia: (q) => ({ matches: !!mq[q] }),
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter((x) => x !== f); },
  };
  const stack = [{ state: null, url }]; let i = 0;
  const h = {
    get state() { return stack[i].state; },
    pushState(state, _t, u) { stack.splice(i + 1); stack.push({ state, url: u || win.location.href }); i++; win.location.href = stack[i].url; },
    replaceState(state, _t, u) { stack[i] = { state, url: u || win.location.href }; win.location.href = stack[i].url; },
    back() { if (i === 0) { win.left = true; return; } i--; win.location.href = stack[i].url; (listeners.popstate || []).forEach((f) => f({ state: stack[i].state })); },
    get length() { return stack.length; },
    get index() { return i; },
  };
  win.history = h; win.stack = stack;
  return win;
}

ok(wantsGuard(fakeWin("x", { "(pointer: coarse)": true })) && wantsGuard(fakeWin("x", { "(display-mode: standalone)": true })) && !wantsGuard(fakeWin("x", {})), "solo en el teléfono o con la app instalada");

{
  const w = fakeWin("https://t/#sky");
  let open = false, toasts = 0;
  const off = installBackGuard({ win: w, onBack: () => { if (open) { open = false; return true; } return false; }, toast: () => toasts++ });
  ok(w.history.length === 2 && w.history.index === 1 && w.history.state.teseoGuard && w.stack[0].state.teseoBase, "al abrir: base y guardia encima");
  // la app cambia su dirección con replaceState(null): la guardia conserva su marca
  w.history.replaceState(null, "", "https://t/#sky?c=Ori");
  ok(w.history.state && w.history.state.teseoGuard && w.location.href.endsWith("c=Ori"), "replaceState de la app conserva la marca de la guardia");
  // con una ficha abierta, atrás la cierra y la guardia vuelve
  open = true; w.history.back();
  ok(!open && toasts === 0 && w.history.index === 1 && w.history.state.teseoGuard, "atrás cierra lo abierto, sin aviso, y repone la guardia");
  ok(w.location.href.endsWith("c=Ori") && w.stack[0].url.endsWith("c=Ori"), "la dirección de la app no salta al volver a la base");
  // sin nada abierto: aviso y se queda en la base
  w.history.back();
  ok(toasts === 1 && w.history.index === 0 && w.history.state.teseoBase && !w.left, "sin nada abierto: «Pulsa de nuevo para salir» (no sale)");
  // segundo atrás dentro de la ventana: sale
  w.history.back();
  ok(w.left === true, "un segundo atrás enseguida sale de la app");
  off();
}
{
  const w = fakeWin("https://t/#sky");
  let toasts = 0;
  const off = installBackGuard({ win: w, onBack: () => false, toast: () => toasts++ });
  w.history.back();
  ok(toasts === 1 && w.history.index === 0, "primer atrás: aviso");
  await sleep(EXIT_WINDOW_MS + 150);
  ok(w.history.index === 1 && w.history.state.teseoGuard, "pasados 2 s, la guardia vuelve: el siguiente atrás vuelve a avisar");
  w.history.back();
  ok(toasts === 2 && !w.left, "y en efecto avisa otra vez en vez de salir");
  off();
  ok(typeof w.history.replaceState === "function", "al quitarla, el historial queda como estaba");
}
{
  // recarga: si la entrada actual ya es la guardia, no se apila otra
  const w = fakeWin("https://t/#sky");
  w.history.replaceState({ teseoBase: 1 }, "", "https://t/#sky"); w.history.pushState({ teseoGuard: 1 }, "", "https://t/#sky");
  const off = installBackGuard({ win: w, onBack: () => false, toast: () => {} });
  ok(w.history.length === 2, "al recargar no se acumulan guardias");
  off();
}

// cableado
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const cons = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
ok(/if \(!wantsGuard\(\)\) return undefined;/.test(app) && /Pulsa de nuevo para salir/.test(app) && /Press back again to exit/.test(app), "la app instala la guardia con el aviso en español e inglés");
ok(/window\.addEventListener\("teseo:back", onBack, true\)/.test(app) && /if \(b\.menuOpen\) setMenuOpen\(false\)/.test(app), "atrás cierra primero el menú, los créditos y las métricas");
ok(/if \(b\.pano\) setPano\(false\)/.test(cons) && /else if \(b\.selObj\) setSelObj\(null\)/.test(cons) && /else if \(b\.ar === "on" \|\| b\.ar === "paused"\) stopAr\(\)/.test(cons), "en el Cielo: diálogos, fichas, paneles, tiempo y apuntar al cielo");
ok(/className="sk-credit"/.test(cons) && /shortCredits\(/.test(cons), "créditos siempre visibles en el Cielo (salen en cualquier captura)");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
