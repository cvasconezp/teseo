// Reportar un problema sin GitHub: arma un mensaje para WhatsApp o correo que ya trae
// la versión, el equipo y la sección. Nunca incluye la ubicación ni datos de la persona.
export const REPORT_WA = "593987489892";
export const REPORT_MAIL = "teseo@yachaydeep.com";
export const REPORT_GH = "https://github.com/cvasconezp/teseo/issues/new";

// «Android 14 · Chrome 131», «iPhone · iOS 18.1 · Safari», «Windows · Edge 130»…
export function deviceSummary(ua = "") {
  let os = "", m;
  if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) os = `Android ${m[1]}`;
  else if ((m = ua.match(/(iPhone|iPad).*? OS (\d+)_(\d+)/))) os = `${m[1]} · iOS ${m[2]}.${m[3]}`;
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Linux/.test(ua)) os = "Linux";
  let br = "";
  if ((m = ua.match(/SamsungBrowser\/(\d+)/))) br = `Samsung Internet ${m[1]}`;
  else if ((m = ua.match(/EdgA?\/(\d+)/))) br = `Edge ${m[1]}`;
  else if ((m = ua.match(/OPR\/(\d+)/))) br = `Opera ${m[1]}`;
  else if ((m = ua.match(/(?:Firefox|FxiOS)\/(\d+)/))) br = `Firefox ${m[1]}`;
  else if ((m = ua.match(/(?:Chrome|CriOS)\/(\d+)/))) br = `Chrome ${m[1]}`;
  else if (/Safari\//.test(ua) && (m = ua.match(/Version\/(\d+(?:\.\d+)?)/))) br = `Safari ${m[1]}`;
  return [os, br].filter(Boolean).join(" · ") || "desconocido";
}

const TXT = {
  es: { hi: "Hola, encontré un problema en Teseo.", what: "Qué pasó:", data: "— Datos para ayudar —", v: "Versión", s: "Sección", d: "Equipo", w: "Pantalla", l: "Idioma", subj: "Problema en Teseo" },
  en: { hi: "Hi, I found a problem in Teseo.", what: "What happened:", data: "— Details to help —", v: "Version", s: "Section", d: "Device", w: "Screen", l: "Language", subj: "Problem in Teseo" },
};

export function reportText({ lang = "es", version = "", section = "", ua = "", w = 0, h = 0 }) {
  const t = TXT[lang] || TXT.es;
  const lines = [t.hi, "", t.what, "", "", t.data];
  if (version) lines.push(`${t.v}: ${version}`);
  if (section) lines.push(`${t.s}: ${section}`);
  lines.push(`${t.d}: ${deviceSummary(ua)}`);
  if (w && h) lines.push(`${t.w}: ${w}×${h}`);
  lines.push(`${t.l}: ${lang}`);
  return lines.join("\n");
}

export function reportLinks(opts) {
  const t = TXT[opts.lang] || TXT.es;
  const body = reportText(opts);
  return {
    wa: `https://wa.me/${REPORT_WA}?text=${encodeURIComponent(body)}`,
    mail: `mailto:${REPORT_MAIL}?subject=${encodeURIComponent(`${t.subj}${opts.version ? " " + opts.version : ""}`)}&body=${encodeURIComponent(body)}`,
    gh: REPORT_GH,
  };
}
