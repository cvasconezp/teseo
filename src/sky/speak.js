// speak.js — «Escuchar»: lee en voz alta la ficha abierta con la voz del propio teléfono o navegador (Web Speech
// API, speechSynthesis): gratis, sin servidor y sin conexión. La voz depende del aparato.

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";

/** La mejor voz para el idioma: primero las de Latinoamérica para el español, luego cualquiera del idioma. */
export function pickVoice(voices, lang = "es") {
  const list = Array.isArray(voices) ? voices : [];
  const pref = lang === "en" ? ["en-US", "en-GB", "en"] : ["es-419", "es-EC", "es-CO", "es-MX", "es-US", "es-ES", "es"];
  for (const p of pref) {
    const hit = list.filter((v) => (v.lang || "").replace("_", "-").toLowerCase().startsWith(p.toLowerCase()));
    // las más naturales primero: neuronales o mejoradas (Siri, «Natural» de Edge, «Enhanced/Premium» de Apple, Google)
    if (hit.length) return hit.find((v) => /natural|neural|premium|enhanced|mejorada|siri/i.test(v.name)) || hit.find((v) => /google|paulina|m[oó]nica|samantha|karen|daniel/i.test(v.name)) || hit.find((v) => v.localService) || hit[0];
  }
  return null;
}

/** Trozos de como mucho `max` caracteres, cortados en frases (algunos navegadores cortan las locuciones largas). */
export function chunks(text, max = 220) {
  const out = [];
  for (const s of String(text).replace(/\s+/g, " ").trim().split(/(?<=[.!?…;:])\s+/)) {
    if (!s) continue;
    if (out.length && (out[out.length - 1] + " " + s).length <= max) out[out.length - 1] += " " + s;
    else if (s.length <= max) out.push(s);
    else for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
  }
  return out;
}

/**
 * Texto de una ficha para leerlo: título, tipo y lo que hay en su cuerpo (datos como «etiqueta: valor», párrafos,
 * subtítulos), sin botones ni enlaces. `el` es la <section> de la ficha (SheetShell).
 */
export function sheetText(el) {
  if (!el) return "";
  const parts = [];
  const push = (s) => { const v = String(s || "").replace(/\s+/g, " ").trim(); if (v) parts.push(/[.!?…:]$/.test(v) ? v : v + "."); };
  push(el.querySelector("h2") && el.querySelector("h2").textContent);
  // el tipo y su distintivo («Volcán» + «a 148 km, hacia el S») son dos cosas: van separados
  const type = el.querySelector(".sk-type");
  if (type) { const badge = type.querySelector && type.querySelector("em"); if (badge) { push(type.textContent.replace(badge.textContent, "")); push(badge.textContent); } else push(type.textContent); }
  const body = el.querySelector(".sk-sheet-body");
  if (body) {
    for (const n of body.querySelectorAll("h3, p, dl > div, figcaption, li")) {
      if (n.closest("button, a, .sk-actions, nav")) continue;
      if (n.matches("dl > div")) {
        const dt = n.querySelector("dt"), dd = n.querySelector("dd");
        if (dt && dd) push(`${dt.textContent.trim()}: ${dd.textContent.trim()}`);
      } else if (!n.querySelector("p, li")) push(n.textContent);
    }
  }
  return parts.join(" ").slice(0, 4000);
}

/**
 * Texto para ser oído, no leído: sin signos que la voz deletrea («/», «·», «≈», «°», «×»…), con las unidades y
 * abreviaturas dichas en palabras y los datos «etiqueta: valor» como frases cortas.
 */
export function narrate(text, lang = "es") {
  const es = lang !== "en";
  let t = " " + String(text) + " ";
  const R = (re, to) => { t = t.replace(re, to); };
  R(/https?:\/\/\S+/g, " ");
  // rumbos abreviados: «hacia el S» → «hacia el sur»
  const DIRS = es ? { N: "norte", S: "sur", E: "este", O: "oeste", NE: "noreste", NO: "noroeste", SE: "sureste", SO: "suroeste" }
    : { N: "north", S: "south", E: "east", W: "west", NE: "north-east", NW: "north-west", SE: "south-east", SW: "south-west" };
  R(es ? /\b(hacia el|al|del|por el|desde el|rumbo)\s+(NE|NO|SE|SO|N|S|E|O)\b/g : /\b(to the|from the|in the|due)\s+(NE|NW|SE|SW|N|S|E|W)\b/g, (m, a, b) => `${a} ${DIRS[b]}`);
  // miles con punto (o coma en inglés): «5.286» → «5286», para que no diga «cinco punto doscientos…»
  R(es ? /\b(\d{1,3})\.(\d{3})(?:\.(\d{3}))?\b(?![.,]?\d)/g : /\b(\d{1,3}),(\d{3})(?:,(\d{3}))?\b(?![.,]?\d)/g, (m, a, b, c) => a + b + (c || ""));
  R(/\(([^()]{0,40})\)/g, (m, a) => (/^[\s\d.,%+−-]*$/.test(a) ? " " : `, ${a}, `));
  R(/\s*[·•|]\s*/g, ", "); R(/\s*[—–]\s*/g, ", ");
  R(/(\d)\s*[–-]\s*(\d)/g, es ? "$1 a $2" : "$1 to $2");
  R(/≈|~/g, es ? " unos " : " about "); R(/±/g, es ? " más o menos " : " plus or minus ");
  R(/(\d)\s*×\s*(\d)/g, es ? "$1 por $2" : "$1 by $2"); R(/×/g, es ? " veces " : " times ");
  R(/−(\d)/g, es ? " menos $1" : " minus $1");
  R(/(\d)\s*°C\b/g, es ? "$1 grados Celsius" : "$1 degrees Celsius"); R(/(\d)\s*K\b/g, es ? "$1 kelvin" : "$1 kelvin");
  R(/(\d)\s*°/g, es ? "$1 grados" : "$1 degrees"); R(/(\d)\s*[′']/g, es ? "$1 minutos de arco" : "$1 arcminutes"); R(/(\d)\s*[″"]/g, es ? "$1 segundos de arco" : "$1 arcseconds");
  R(/(\d)\s*%/g, es ? "$1 por ciento" : "$1 percent");
  const U = es
    ? [["km/s", "kilómetros por segundo"], ["km/h", "kilómetros por hora"], ["m/s", "metros por segundo"], ["km²", "kilómetros cuadrados"], ["km", "kilómetros"], ["UA", "unidades astronómicas"], ["al", "años luz"], ["a\\. ?l\\.", "años luz"], ["pc", "pársecs"], ["kg", "kilogramos"], ["min", "minutos"], ["h", "horas"], ["s", "segundos"], ["m", "metros"], ["mag", "de magnitud"]]
    : [["km/s", "kilometres per second"], ["km/h", "kilometres per hour"], ["m/s", "metres per second"], ["km", "kilometres"], ["AU", "astronomical units"], ["ly", "light-years"], ["pc", "parsecs"], ["kg", "kilograms"], ["min", "minutes"], ["h", "hours"], ["s", "seconds"], ["m", "metres"]];
  for (const [u, w] of U) R(new RegExp(`(\\d)\\s?${u.replace("/", "\\/")}(?=[\\s.,;:)]|$)`, "g"), `$1 ${w}`);
  if (es) { R(/\ba\. ?C\./g, "antes de Cristo"); R(/\bd\. ?C\./g, "después de Cristo"); R(/\bVEI\b/g, "índice de explosividad"); R(/\bN\.?º\b/g, "número"); R(/\bp\. ?ej\./g, "por ejemplo"); R(/\baprox\./g, "aproximadamente"); }
  else { R(/\bBCE\b/g, "before the common era"); R(/\bVEI\b/g, "explosivity index"); }
  R(/\s*\/\s*/g, es ? " o " : " or ");
  R(/\s*=\s*/g, es ? " igual a " : " equals "); R(/\+/g, es ? " más " : " plus "); R(/[<>*_#^→←↑↓▲▼]/g, " ");
  R(/\s+:\s*/g, ": ");                                                      // los dos puntos se quedan: la voz hace ahí la pausa
  R(/\s+([.,;])/g, "$1"); R(/,\s*,/g, ","); R(/,\s*\./g, "."); R(/\.\s*,/g, "."); R(/\s{2,}/g, " ");
  return t.trim();
}

let session = 0;
/** Lee `text` en `lang`. Devuelve una función para pararlo; `onEnd` se llama al terminar o al pararlo. */
export function speakText(text, lang = "es", onEnd) {
  if (!canSpeak()) { if (onEnd) onEnd(); return () => {}; }
  const synth = window.speechSynthesis, my = ++session;
  synth.cancel();
  const voice = pickVoice(synth.getVoices(), lang);
  const parts = chunks(narrate(text, lang));
  let i = 0, done = false;
  const finish = () => { if (done) return; done = true; if (onEnd) onEnd(); };
  const next = () => {
    if (my !== session || i >= parts.length) { finish(); return; }
    const u = new window.SpeechSynthesisUtterance(parts[i++]);
    u.lang = voice ? voice.lang : (lang === "en" ? "en-US" : "es-419");
    if (voice) u.voice = voice;
    u.rate = 0.96; u.pitch = 1;                        // un punto más despacio: suena menos a máquina
    u.onend = next; u.onerror = finish;
    synth.speak(u);
  };
  next();
  return () => { if (my === session) { session++; synth.cancel(); } finish(); };
}

export const LISTEN_T = {
  es: { listen: "Escuchar", stop: "Parar", listenAria: "Escuchar esta ficha en voz alta", stopAria: "Dejar de leer" },
  en: { listen: "Listen", stop: "Stop", listenAria: "Listen to this sheet read aloud", stopAria: "Stop reading" },
};
