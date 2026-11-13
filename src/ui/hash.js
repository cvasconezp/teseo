// hash.js — enlaces directos a cada sección. Puro (se prueba en Node).
//   #ruta / #route · #ventanas / #windows · #cielo / #sky · #escala / #scale ·
//   #preguntas / #questions · #ahora / #now (abre "Ahora en el espacio")
// Lo que siga al nombre (?c=Ori, ?drake=…, ?q=…) pertenece a cada pestaña y
// aquí no se toca.

const ALIASES = {
  route:     ["ruta", "route"],
  windows:   ["ventanas", "windows"],
  sky:       ["cielo", "sky"],
  scale:     ["escala", "scale"],
  questions: ["preguntas", "questions"],
  now:       ["ahora", "now"],
};
const LOOKUP = Object.fromEntries(Object.entries(ALIASES).flatMap(([id, names]) => names.map(n => [n, id])));

/** "#ventanas" → { tab: "windows", now: false } · "#ahora" → { tab: "windows", now: true } · otro → null */
export function parseHash(hash) {
  const m = /^#([a-zñ]+)(?=$|[?&/=])/i.exec(String(hash || ""));
  if (!m) return null;
  const id = LOOKUP[m[1].toLowerCase()];
  if (!id) return null;
  return id === "now" ? { tab: "windows", now: true } : { tab: id, now: false };
}

/** true si el hash ya pertenece a esa pestaña (y por tanto no hay que pisarlo). */
export function hashBelongsTo(hash, tab) {
  const p = parseHash(hash);
  return !!p && p.tab === tab;
}

/** Hash canónico de una pestaña en el idioma activo ("" para la portada). */
export function hashForTab(tab, lang = "es", now = false) {
  if (now) return `#${ALIASES.now[lang === "en" ? 1 : 0]}`;
  if (tab === "route") return "";
  if (tab === "sky") return "#sky";            // el visor lee y escribe siempre "#sky?…"
  const names = ALIASES[tab];
  return names ? `#${names[lang === "en" ? 1 : 0]}` : "";
}
