// ics.js — «Añadir a mi calendario»: genera un archivo iCalendar (RFC 5545) en el cliente, sin
// servicios externos. Horas en UTC (DTSTART:…Z), UID estable (mismo evento → mismo UID, así el
// calendario lo actualiza en vez de duplicarlo), saltos de línea CRLF y líneas plegadas a 75 octetos.
// Puro: se prueba en scripts/test_now_calendar.mjs.

const pad = (n, w = 2) => String(n).padStart(w, "0");
/** 1795185180000 → "20261125T223300Z" */
export function icsUtc(ms) {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
const icsDate = (ms) => icsUtc(ms).slice(0, 8);

/** Escapa texto (RFC 5545 §3.3.11): \ ; , y saltos de línea. */
export const icsEscape = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Pliega una línea a 75 octetos UTF-8 (continuación: CRLF + espacio), sin partir caracteres. */
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = "", bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ch; bytes = b; limit = 74; } else { cur += ch; bytes += b; }
  }
  out.push(cur);
  return out.join("\r\n ");
}

/**
 * @param {object} ev  { uid, start (ms UTC), durationMin?, allDay?, title, description?, url? }
 * @param {object} [o] { now = Date.now(), prodId }
 * @returns {string} contenido .ics (líneas separadas por CRLF, con CRLF final)
 */
export function buildIcs(ev, { now = Date.now(), prodId = "-//Teseo//Calendario del cielo//ES" } = {}) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${prodId}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${ev.uid}`, `DTSTAMP:${icsUtc(now)}`];
  if (ev.allDay) {
    // fecha completa (sin hora): DTEND exclusivo = día siguiente
    lines.push(`DTSTART;VALUE=DATE:${icsDate(ev.start)}`, `DTEND;VALUE=DATE:${icsDate(ev.start + 86400000)}`);
  } else {
    lines.push(`DTSTART:${icsUtc(ev.start)}`, `DTEND:${icsUtc(ev.start + (ev.durationMin || 60) * 60000)}`);
  }
  lines.push(`SUMMARY:${icsEscape(ev.title)}`);
  if (ev.description) lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
  if (ev.url) lines.push(`URL:${ev.url}`);
  lines.push("TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Nombre de archivo seguro: «teseo-2026-11-25-urano-oposicion.ics». */
export function icsFileName(ev) {
  const slug = String(ev.title || "evento").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `teseo-${new Date(ev.start).toISOString().slice(0, 10)}-${slug || "evento"}.ics`;
}

/** Descarga en el navegador (Blob text/calendar). No hace nada fuera del navegador. */
export function downloadIcs(ev, opts) {
  if (typeof document === "undefined" || typeof Blob === "undefined") return false;
  const blob = new Blob([buildIcs(ev, opts)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = icsFileName(ev); a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
