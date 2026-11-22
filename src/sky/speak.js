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
 * Lo que hay en una ficha, por partes (para contarlo, no para leerlo de arriba abajo): título, tipo, descripción,
 * datos, explicaciones, la vida de la estrella, lo que se ve desde el lugar y el crédito de la imagen. `el` es la
 * <section> de la ficha (SheetShell). Lo que no reconoce queda en `other`, en su orden.
 */
export function sheetParts(el) {
  if (!el || !el.querySelector) return null;
  const tx = (n) => (n ? String(n.textContent || "").replace(/\s+/g, " ").trim() : "");
  const all = (root, sel) => (root && root.querySelectorAll ? Array.from(root.querySelectorAll(sel)) : []);
  const own = (n) => {                                   // el texto de un nodo sin sus <small>, enlaces ni botones
    if (!n || !n.cloneNode) return tx(n);
    const c = n.cloneNode(true);
    for (const x of all(c, "small, a, button, svg, .sk-sr")) x.remove();
    return tx(c);
  };
  const P = { title: tx(el.querySelector("h2")), type: "", badge: "", desc: "", notes: [], facts: [], explain: [], life: null, comp: [], place: null, credit: "", other: [] };
  const type = el.querySelector(".sk-type");
  if (type) { const b = type.querySelector && type.querySelector("em"); P.badge = tx(b); P.type = tx(type).replace(P.badge, "").trim(); }
  const body = el.querySelector(".sk-sheet-body");
  if (!body) return P;
  P.desc = own(body.querySelector(".sk-desc"));
  for (const n of all(body, ".sk-facts > div")) { const dd = n.querySelector("dd"); P.facts.push({ label: tx(n.querySelector("dt")), value: own(dd), hint: tx(dd && dd.querySelector("small")) }); }
  for (const n of all(body, ".sk-explain > li")) P.explain.push({ title: tx(n.querySelector("b")), text: tx(n.querySelector("span")) });
  const life = body.querySelector(".sk-life");
  if (life) {
    const L = { type: tx(life.querySelector(".sk-comp-body > p")), facts: [], past: [], here: "", next: [], notes: [] };
    for (const n of all(life, ".sk-life-facts > div")) L.facts.push({ label: tx(n.querySelector("dt")), value: own(n.querySelector("dd")) });
    for (const n of all(life, ".sk-tl > li")) {
      const name = tx(n.querySelector("span"));
      if (n.classList.contains("is-here")) L.here = name; else if (n.classList.contains("is-past")) L.past.push(name); else L.next.push(name);
    }
    for (const n of all(life, ".sk-comp-note")) L.notes.push(tx(n));
    P.life = L;
  }
  for (const c of all(body, ".sk-comp")) if (!c.classList.contains("sk-life")) for (const n of all(c, ".sk-comp-note")) P.comp.push(tx(n));
  const rs = body.querySelector(".sk-rs");
  if (rs && !rs.classList.contains("is-off")) {
    const ps = all(rs, "p").filter((n) => !n.classList.contains("sk-rs-main") && !n.classList.contains("sk-rs-hz"));
    P.place = { title: tx(rs.querySelector("h3")), main: tx(rs.querySelector(".sk-rs-main")), hz: tx(rs.querySelector(".sk-rs-hz")), now: ps.length ? tx(ps[ps.length - 1]) : "" };
  }
  const cap = body.querySelector("figcaption");
  if (cap) P.credit = tx(cap.querySelector("b, strong, span")) || "";
  // lo demás (fichas de montañas, volcanes, monumentos…): párrafos, datos y subtítulos que no son de los bloques de arriba
  for (const n of all(body, "h3, p, dl > div, li")) {
    if (n.closest("button, a, .sk-actions, nav, details.sk-details, .sk-facts, .sk-explain, .sk-comp, .sk-rs, figure, .sk-desc")) continue;
    if (n.classList.contains("sk-desc")) continue;
    if (n.matches("dl > div")) { const dt = n.querySelector("dt"), dd = n.querySelector("dd"); if (dt && dd) P.other.push(`${tx(dt)}: ${own(dd)}`); }
    else if (!n.querySelector("p, li")) { const v = own(n); if (v) P.other.push(v); }
  }
  return P;
}

const endDot = (s) => { const v = String(s || "").replace(/\s+/g, " ").trim(); return !v ? "" : /[.!?…]$/.test(v) ? v : v + "."; };
const lowFirst = (s) => (s && !/^[A-ZÁÉÍÓÚÑ]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const listAnd = (arr, lang) => (arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + (lang === "en" ? " and " : " y ") + arr[arr.length - 1]);

/** Un dato «etiqueta + valor» dicho como frase. */
export function factSentence(f, lang = "es") {
  const es = lang !== "en", l = f.label || "", v = f.value || "", h = f.hint ? `: ${lowFirst(f.hint)}` : "";
  if (!v) return "";
  if (/^(distancia|distance)$/i.test(l)) return es ? `Está a ${v}${f.hint ? `, ${f.hint}` : ""}.` : `It is ${v} away${f.hint ? `, ${f.hint}` : ""}.`;
  if (/su luz sali[oó]|its light left/i.test(l)) return es ? `La luz que ves ${l.replace(/^su luz /i, "")} ${lowFirst(v)}${h}.` : `The light you see ${l.replace(/^its light /i, "")} ${lowFirst(v)}${h}.`;
  if (/su luz tarda|light takes/i.test(l)) return es ? `Su luz tarda ${v} en llegar${h}.` : `Its light takes ${v} to arrive${h}.`;
  if (/voyager/i.test(l)) return es ? `En la nave Voyager 1 tardarías ${v} en llegar.` : `Aboard Voyager 1 it would take you ${v} to get there.`;
  // una etiqueta que ya es el comienzo de una frase («Tarda en dar la vuelta»): se continúa; si no, «etiqueta: valor»
  return /\s(en|a|de|que|hace|is|in|to|of)$/i.test(l) ? `${l} ${v}${h}.` : `${l}: ${v}${h}.`;
}

/**
 * La ficha contada: quién es, lo más llamativo, su historia (en las estrellas, su vida y su final) y dónde verlo
 * desde tu lugar. No es leer la ficha de arriba abajo: es un resumen para ser oído.
 */
export function storyFromParts(P, lang = "es") {
  if (!P) return "";
  const es = lang !== "en", out = [];
  const say = (s) => { const v = endDot(s); if (v) out.push(v); };
  // 1. quién es: nombre y tipo (el de la vida de la estrella dice más que «Estrella»)
  const kind = (P.life && P.life.type) || P.type;
  say(kind ? `${P.title}. ${kind}` : P.title);
  if (P.badge) say(P.badge);
  // 2. lo que cuenta la enciclopedia, en dos frases
  if (P.desc) say(P.desc.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").replace(/…$/, ""));
  for (const n of P.notes) say(n);
  // 3. los datos, como frases
  for (const f of P.facts) say(factSentence(f, lang));
  for (const e of P.explain.slice(0, 3)) say(e.title ? `${e.title}: ${lowFirst(e.text)}` : e.text);
  for (const o of P.other) say(o);
  // 4. su vida y su final
  const L = P.life;
  if (L) {
    for (const f of L.facts) say(`${f.label}: ${f.value}`);
    if (L.here) {
      const next = L.next.map(lowFirst);
      say(es ? `Ahora está en la etapa de ${lowFirst(L.here)}${next.length ? `. Después será ${next.length > 1 ? next.slice(0, -1).join(", luego ") + " y, al final, " + next[next.length - 1] : next[0]}` : ""}`
        : `It is now in the ${lowFirst(L.here)} stage${next.length ? `. Later it will become ${next.length > 1 ? next.slice(0, -1).join(", then ") + " and, in the end, " + next[next.length - 1] : next[0]}` : ""}`);
    } else if (L.next.length) say(es ? `Su vida: ${listAnd(L.next.map(lowFirst), lang)}` : `Its life: ${listAnd(L.next.map(lowFirst), lang)}`);
    for (const n of L.notes) say(n);
  }
  for (const n of P.comp.slice(0, 1)) say(n);
  // 5. desde tu lugar
  if (P.place) {
    if (P.place.now) say(`${P.place.title}: ${lowFirst(P.place.now)}`); else if (P.place.title) say(P.place.title);
    if (P.place.main) say(P.place.main);
    if (P.place.hz) say(P.place.hz);
  }
  // 6. de quién es la imagen
  if (P.credit) say(/^(imagen|image)/i.test(P.credit) ? P.credit : (es ? `La imagen es de ${P.credit}` : `The image is by ${P.credit}`));
  return out.join(" ").slice(0, 4000);
}

/** Texto para «Escuchar»: la ficha contada (storyFromParts); si la ficha no tiene partes reconocibles, su texto. */
export function sheetStory(el, lang = "es") {
  let P = null;
  try { P = sheetParts(el); } catch { P = null; }
  const story = P ? storyFromParts(P, lang) : "";
  return story && story.length > (P.title || "").length + 20 ? story : sheetText(el);
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
