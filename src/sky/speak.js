// speak.js — «Escuchar»: lee en voz alta la ficha abierta con la voz del propio teléfono o navegador (Web Speech
// API, speechSynthesis): gratis, sin servidor y sin conexión. La voz depende del aparato.

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";

/** La mejor voz para el idioma: primero las de Latinoamérica para el español, luego cualquiera del idioma. */
export function pickVoice(voices, lang = "es") {
  const list = Array.isArray(voices) ? voices : [];
  const pref = lang === "en" ? ["en-US", "en-GB", "en"] : ["es-419", "es-EC", "es-CO", "es-MX", "es-US", "es-ES", "es"];
  for (const p of pref) {
    const hit = list.filter((v) => (v.lang || "").replace("_", "-").toLowerCase().startsWith(p.toLowerCase()));
    if (hit.length) return hit.find((v) => /natural|neural|premium|enhanced|google/i.test(v.name)) || hit.find((v) => v.localService) || hit[0];
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
  const type = el.querySelector(".sk-type");
  if (type) push(type.textContent);
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

let session = 0;
/** Lee `text` en `lang`. Devuelve una función para pararlo; `onEnd` se llama al terminar o al pararlo. */
export function speakText(text, lang = "es", onEnd) {
  if (!canSpeak()) { if (onEnd) onEnd(); return () => {}; }
  const synth = window.speechSynthesis, my = ++session;
  synth.cancel();
  const voice = pickVoice(synth.getVoices(), lang);
  const parts = chunks(text);
  let i = 0, done = false;
  const finish = () => { if (done) return; done = true; if (onEnd) onEnd(); };
  const next = () => {
    if (my !== session || i >= parts.length) { finish(); return; }
    const u = new window.SpeechSynthesisUtterance(parts[i++]);
    u.lang = voice ? voice.lang : (lang === "en" ? "en-US" : "es-419");
    if (voice) u.voice = voice;
    u.rate = 1; u.pitch = 1;
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
