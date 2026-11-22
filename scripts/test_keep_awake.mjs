// Pruebas: pantalla encendida en la vista Cielo (src/sky/keepAwake.js), con un navegador falso.
import { createKeepAwake } from "../src/sky/keepAwake.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FALLA:", m); } };
const tickP = () => new Promise((r) => setTimeout(r, 0));
let t = 0, requests = 0, released = 0;
const nav = { wakeLock: { request: () => { requests++; const l = { release: () => { released++; return Promise.resolve(); }, addEventListener() {} }; return Promise.resolve(l); } } };
const doc = { visibilityState: "visible" };
const ka = createKeepAwake({ nav, doc, now: () => t, idleMs: 1000 });
ka.start(); await tickP();
ok(ka.supported && ka.held && requests === 1, "al entrar pide que la pantalla no se apague");
t = 500; ka.tick(); ok(ka.held, "con actividad reciente lo mantiene");
t = 1600; ka.tick(); ok(!ka.held && released === 1, "tras el tiempo sin tocarla lo suelta (ahorra batería)");
ka.activity(); await tickP(); ok(ka.held && requests === 2, "un toque lo recupera");
doc.visibilityState = "hidden"; ka.stop(); ok(!ka.held && released === 2, "al salir lo suelta");
const none = createKeepAwake({ nav: {}, doc, now: () => t });
none.start(); ok(!none.supported && !none.held, "sin soporte del navegador, no hace nada");
console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
if (fail) process.exit(1);
