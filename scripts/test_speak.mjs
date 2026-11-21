// Pruebas: «Escuchar» (src/sky/speak.js): voz, trozos, texto de la ficha y lectura con una síntesis falsa.
import { readFileSync } from "node:fs";
import { pickVoice, chunks, sheetText, speakText, canSpeak } from "../src/sky/speak.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FALLA:", m); } };

const voices = [{ name: "Alex", lang: "en-US" }, { name: "Monica", lang: "es-ES" }, { name: "Paulina", lang: "es-MX", localService: true }, { name: "Google español", lang: "es-US" }];
ok(pickVoice(voices, "es").name === "Paulina", "español: primero Latinoamérica");
ok(pickVoice(voices, "en").name === "Alex" && pickVoice([], "es") === null, "inglés; sin voces, null");
const c = chunks("Primera frase corta. Segunda frase también corta. " + "x".repeat(500), 60);
ok(c[0] === "Primera frase corta. Segunda frase también corta." && c.every((s) => s.length <= 60), "trozos de frases, como mucho 60");

// una ficha mínima (sin DOM: un objeto con la misma interfaz)
const node = (cls, text, kids = []) => ({ cls, textContent: text, kids,
  matches: (sel) => sel === "dl > div" && cls === "row", closest: (sel) => (cls === "btn" ? {} : null),
  querySelector: (sel) => kids.find((k) => (sel === "dt" && k.cls === "dt") || (sel === "dd" && k.cls === "dd") || (sel === "p, li" && (k.cls === "p"))) || null });
const rows = [node("row", "", [node("dt", "Altura"), node("dd", "5.790 m")]), node("p", "Un volcán compuesto"), node("btn", "Ver en el Smithsonian")];
const el = { querySelector: (sel) => (sel === "h2" ? { textContent: "Cayambe" } : sel === ".sk-type" ? { textContent: "Volcán" } : sel === ".sk-sheet-body" ? { querySelectorAll: () => rows } : null) };
ok(sheetText(el) === "Cayambe. Volcán. Altura: 5.790 m. Un volcán compuesto.", "texto de la ficha (sin botones)");

ok(canSpeak() === false, "sin navegador no se habla");
const said = [];
globalThis.window = { speechSynthesis: { cancel() {}, getVoices: () => voices, speak(u) { said.push(u); setTimeout(() => u.onend && u.onend(), 0); } },
  SpeechSynthesisUtterance: function (t) { this.text = t; } };
let ended = false;
speakText("Hola. Esto es Teseo.", "es", () => { ended = true; });
await new Promise((r) => setTimeout(r, 20));
ok(said.length === 1 && said[0].lang === "es-MX" && said[0].voice.name === "Paulina" && ended, "lee con la voz elegida y avisa al terminar");
const stop = speakText("Uno. " + "dos ".repeat(200), "es", () => {});
stop();
ok(true, "se puede parar");
const os = readFileSync(new URL("../src/sky/ObjectSheet.jsx", import.meta.url), "utf8");
ok(/<ListenButton boxRef=\{boxRef\}/.test(os), "el botón va en todas las fichas (SheetShell)");

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
if (fail) process.exit(1);
