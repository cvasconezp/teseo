// Pruebas: «Escuchar» (src/sky/speak.js): voz, trozos, texto de la ficha y lectura con una síntesis falsa.
import { readFileSync } from "node:fs";
import { pickVoice, chunks, sheetText, speakText, canSpeak, narrate, storyFromParts, factSentence } from "../src/sky/speak.js";

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

const nt = narrate("Altura: 5.790 m. Roca principal: andesita / andesita basáltica. Distancia ≈ 18 km · hacia el E. Temperatura: −5 °C. Última erupción: hacia el 5.550 a. C. Velocidad: 7,66 km/s.", "es");
ok(!/[\/·≈°−]/.test(nt) && /Altura: 5790 metros\./.test(nt) && /andesita o andesita basáltica/.test(nt) && /unos 18 kilómetros, hacia el este/.test(nt) && /menos 5 grados Celsius/.test(nt) && /antes de Cristo/.test(nt) && /7,66 kilómetros por segundo/.test(nt), "narración: sin signos, unidades en palabras → " + nt);
ok(narrate("Open at 10:30", "en") === "Open at 10:30", "las horas no se tocan");
ok(narrate("a 148 km, hacia el S", "es") === "a 148 kilómetros, hacia el sur" && narrate("3,5 km y 1.234.567 m", "es") === "3,5 kilómetros y 1234567 metros", "rumbos en palabras y miles sin punto");

// la ficha contada (no leída de arriba abajo)
{
  const P = { title: "Vega", type: "Estrella", badge: "", desc: "Vega es la estrella más brillante de la constelación de la Lira. Es la quinta más brillante del cielo. Tercera frase que sobra.", notes: [],
    facts: [{ label: "Distancia", value: "25 años luz", hint: "" }, { label: "Su luz salió hace", value: "25 años", hint: "lo ves como era entonces" }, { label: "En la Voyager 1 tardarías", value: "441 mil años", hint: "" }],
    explain: [], other: [], comp: [],
    life: { type: "Estrella blanca de la secuencia principal (tipo A)", facts: [{ label: "Masa", value: "2,1 veces la del Sol" }], past: ["Nube de gas"], here: "Secuencia principal", next: ["Gigante roja", "Nebulosa planetaria", "Enana blanca"], notes: ["Acabará como una enana blanca."] },
    place: { title: "Desde Volcán Chimborazo", main: "Sale 08:44 · más alto 14:41 (50°) · se pone 20:39", hz: "", now: "Ahora está a 13° de altura, hacia el noroeste." },
    credit: "Courtesy NASA/JPL-Caltech/University of Arizona" };
  const st = storyFromParts(P, "es");
  ok(st.startsWith("Vega. Estrella blanca de la secuencia principal (tipo A). Vega es la estrella más brillante de la constelación de la Lira. Es la quinta más brillante del cielo. Está a 25 años luz."), "empieza por quién es y dos frases de la descripción");
  ok(!st.includes("Tercera frase") && st.includes("La luz que ves salió hace 25 años: lo ves como era entonces.") && st.includes("En la nave Voyager 1 tardarías 441 mil años en llegar."), "los datos, como frases");
  ok(st.includes("Ahora está en la etapa de secuencia principal. Después será gigante roja, luego nebulosa planetaria y, al final, enana blanca."), "su vida y su final, contados");
  ok(st.includes("Desde Volcán Chimborazo: ahora está a 13° de altura, hacia el noroeste.") && st.endsWith("La imagen es de Courtesy NASA/JPL-Caltech/University of Arizona."), "desde tu lugar y de quién es la imagen");
  ok(factSentence({ label: "Altura", value: "5.790 m" }) === "Altura: 5.790 m." && factSentence({ label: "Distance", value: "25 light-years" }, "en") === "It is 25 light-years away." && storyFromParts(null) === "", "dato genérico, inglés y ficha vacía");
}

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
if (fail) process.exit(1);
