// hash.js — enlaces directos a cada pestaña. Puro (se prueba en Node).
//
// Pestañas (desde el 16-nov-2026): Ruta · Ahora · Cielo · Preguntas.
//   #ruta / #route · #ahora / #now · #cielo / #sky · #preguntas / #questions
// Enlaces antiguos que siguen funcionando:
//   #ventanas / #windows → Ruta, bajando a «Ventanas de lanzamiento» (section: "windows")
//   #escala / #scale     → Preguntas, en «¿Qué tan grande es el universo?» (q: "scale")
// Lo que siga al nombre (?c=Ori, ?drake=…, ?q=…) pertenece a cada pestaña y
// aquí no se toca.
// «Teseo en números» (uso público de la app) NO es una pestaña: #uso / #usage abre su
// ventana encima de la pestaña que esté (parseHash lo ignora; ver usageHash).

const ALIASES = {
  route:     ["ruta", "route"],
  now:       ["ahora", "now"],
  sky:       ["cielo", "sky"],
  questions: ["preguntas", "questions"],
};
// nombres antiguos → pestaña nueva, con la sección o la pregunta que les corresponde
const LEGACY = {
  ventanas: { tab: "route", section: "windows" },
  windows:  { tab: "route", section: "windows" },
  escala:   { tab: "questions", q: "scale" },
  scale:    { tab: "questions", q: "scale" },
};
const LOOKUP = Object.fromEntries(Object.entries(ALIASES).flatMap(([id, names]) => names.map(n => [n, id])));

/**
 * "#ahora"    → { tab: "now", section: null, q: null }
 * "#ventanas" → { tab: "route", section: "windows", q: null }
 * "#escala"   → { tab: "questions", section: null, q: "scale" }
 * otro        → null
 */
export function parseHash(hash) {
  const m = /^#([a-zñ]+)(?=$|[?&/=])/i.exec(String(hash || ""));
  if (!m) return null;
  const name = m[1].toLowerCase();
  const old = LEGACY[name];
  if (old) return { tab: old.tab, section: old.section || null, q: old.q || null };
  const id = LOOKUP[name];
  return id ? { tab: id, section: null, q: null } : null;
}

/** true si el hash ya pertenece a esa pestaña (y por tanto no hay que pisarlo). */
export function hashBelongsTo(hash, tab) {
  const p = parseHash(hash);
  return !!p && p.tab === tab && !p.section && !p.q;
}

/** Hash canónico de una pestaña en el idioma activo ("" para la portada). */
export function hashForTab(tab, lang = "es") {
  if (tab === "route") return "";
  if (tab === "sky") return "#sky";            // el visor lee y escribe siempre "#sky?…"
  const names = ALIASES[tab];
  return names ? `#${names[lang === "en" ? 1 : 0]}` : "";
}

/** Hash de Preguntas que abre directamente un recorrido (p. ej. la escala del universo). */
export function hashForQuestion(q, lang = "es") {
  return `#${ALIASES.questions[lang === "en" ? 1 : 0]}?q=${encodeURIComponent(q)}`;
}

// ─── Panel de administración (métricas de uso) ───────────────────────────────
// Las métricas NO se muestran al público dentro de Teseo (decisión del 16-nov-2026):
// solo existe un panel de administración en #admin, protegido con la clave de
// métricas del servidor. La cifra pública vive en la landing de yachaydeep.com.
const USAGE = { es: "admin", en: "admin" };
const USAGE_NAMES = new Set(Object.values(USAGE));

/** "#admin" (con o sin "?days=…") → { days } | null. days solo 7, 30 o 90. */
export function usageHash(hash) {
  const m = /^#([a-z]+)(?:\?(.*))?$/i.exec(String(hash || ""));
  if (!m || !USAGE_NAMES.has(m[1].toLowerCase())) return null;
  const d = Number(new URLSearchParams(m[2] || "").get("days"));
  return { days: [7, 30, 90].includes(d) ? d : null };
}

/** Hash del panel de administración. */
export function hashForUsage(lang = "es") {
  return `#${USAGE[lang === "en" ? "en" : "es"]}`;
}
