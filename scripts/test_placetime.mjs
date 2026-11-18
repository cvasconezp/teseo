// Pruebas de la hora del lugar que se mira (src/sky/placeTime.js): el reloj, la barra del día y las horas de
// salida y puesta van en la zona del lugar de Mi cielo, no en la del teléfono.
import { validTz, tzParts, tzOffsetMin, fromParts, stepFieldTz, setMinuteTz, minuteOfDay, startOfDay, utcLabel, tzCaption, fetchTimeZone, cachedTimeZone } from "../src/sky/placeTime.js";
import { dayProfile, phaseName } from "../src/sky/timeDial.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };

// el caso de la captura: 20:11 en Ecuador (01:11 UTC del 18) → 06:56 en Nagarkot
const t = new Date(Date.UTC(2026, 10, 18, 1, 11));
const np = tzParts(t, "Asia/Kathmandu"), ec = tzParts(t, "America/Guayaquil");
ok(np.y === 2026 && np.m === 11 && np.d === 18 && np.h === 6 && np.mi === 56, "01:11 UTC del 18 de noviembre son las 06:56 en Nepal");
ok(ec.d === 17 && ec.h === 20 && ec.mi === 11, "y las 20:11 del 17 en Ecuador");
ok(tzOffsetMin(t, "Asia/Kathmandu") === 345 && tzOffsetMin(t, "America/Guayaquil") === -300 && tzOffsetMin(t, "UTC") === 0, "desfases: +5:45, −5 y 0");
ok(utcLabel(345) === "UTC+5:45" && utcLabel(-300) === "UTC−5" && utcLabel(0) === "UTC" && utcLabel(330) === "UTC+5:30", "rótulos UTC±h:mm");
ok(validTz("Asia/Kathmandu") && !validTz("Marte/Olympus") && !validTz(null), "zonas válidas e inválidas");

// fromParts: la hora de pared del lugar → instante
ok(fromParts(2026, 11, 18, 6, 56, "Asia/Kathmandu").getTime() === t.getTime(), "06:56 en Nepal es el mismo instante");
ok(fromParts(2026, 11, 17, 20, 11, "America/Guayaquil").getTime() === t.getTime(), "20:11 en Ecuador es el mismo instante");
// horario de verano (Nueva York, 8 de marzo de 2026: de 02:00 se salta a 03:00)
ok(tzParts(fromParts(2026, 3, 8, 12, 0, "America/New_York"), "America/New_York").h === 12 && tzOffsetMin(fromParts(2026, 3, 8, 12, 0, "America/New_York"), "America/New_York") === -240, "mediodía tras el cambio de hora en Nueva York");
ok(tzParts(fromParts(2026, 1, 15, 12, 0, "America/New_York"), "America/New_York").h === 12 && tzOffsetMin(new Date(Date.UTC(2026, 0, 15, 17)), "America/New_York") === -300, "y en invierno, UTC−5");

// mover campos en la hora del lugar
const n = (d, tz) => { const p = tzParts(d, tz); return `${p.y}-${p.m}-${p.d} ${p.h}:${String(p.mi).padStart(2, "0")}`; };
const K = "Asia/Kathmandu";
ok(n(stepFieldTz(t, "day", 1, K), K) === "2026-11-19 6:56" && n(stepFieldTz(t, "day", -1, K), K) === "2026-11-17 6:56", "un día más o menos conserva la hora de Nepal");
ok(n(stepFieldTz(t, "hour", 1, K), K) === "2026-11-18 7:56" && n(stepFieldTz(t, "minute", -1, K), K) === "2026-11-18 6:55", "hora y minuto");
const jan31 = fromParts(2026, 1, 31, 22, 0, K);
ok(n(stepFieldTz(jan31, "month", 1, K), K) === "2026-2-28 22:00" && n(stepFieldTz(fromParts(2028, 2, 29, 9, 0, K), "year", 1, K), K) === "2029-2-28 9:00", "31 de enero + 1 mes → 28 de febrero; 29 de febrero + 1 año → 28");
ok(n(stepFieldTz(fromParts(2026, 12, 15, 9, 0, K), "month", 1, K), K) === "2027-1-15 9:00" && n(stepFieldTz(fromParts(2026, 1, 15, 9, 0, K), "month", -1, K), K) === "2025-12-15 9:00", "el mes cruza el año en ambos sentidos");
ok(n(setMinuteTz(t, 21 * 60 + 30, K), K) === "2026-11-18 21:30" && minuteOfDay(t, K) === 6 * 60 + 56, "la barra del día fija la hora de Nepal");
ok(n(startOfDay(t, K), K) === "2026-11-18 0:00" && n(startOfDay(t, "America/Guayaquil"), "America/Guayaquil") === "2026-11-17 0:00", "medianoche de cada lugar");

// la barra del día en Nagarkot, en hora de Nepal: amanece hacia las 06:2x y anochece tras las 17:00
const prof = dayProfile(27.72, 85.52, t, 96, K);
ok(phaseName(prof, 12 * 60) === "Día" && phaseName(prof, 0) === "Noche" && phaseName(prof, 23 * 60) === "Noche", "en hora de Nepal: día al mediodía, noche a medianoche");
ok(phaseName(prof, 7 * 60) === "Día" && phaseName(prof, 5 * 60 + 50) !== "Día", "a las 07:00 ya es de día; a las 05:50, no");
// y sin zona del lugar, la barra sigue en la zona del dispositivo (como antes)
ok(Array.isArray(dayProfile(27.72, 85.52, t, 48)) && dayProfile(27.72, 85.52, t, 48).length === 49, "sin zona, la barra usa la del dispositivo");

// rótulo bajo el reloj
ok(tzCaption(t, K, "Nagarkot") === "Hora de Nagarkot · UTC+5:45" && tzCaption(t, K, "Nagarkot", "en") === "Time in Nagarkot · UTC+5:45", "«Hora de Nagarkot · UTC+5:45»");
ok(tzCaption(t, "America/Guayaquil", null) === "Hora local · UTC−5" && tzCaption(t, null, "Nagarkot").startsWith("Hora de tu teléfono · UTC"), "tu ubicación: «Hora local»; sin zona: «Hora de tu teléfono»");

// zona por coordenadas (Open-Meteo, simulado) y caché por celdas de 0,1°
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
let calls = 0, lastUrl = "";
const fake = async (url) => { calls++; lastUrl = url; return { ok: true, json: async () => ({ timezone: "Asia/Kathmandu", utc_offset_seconds: 20700 }) }; };
ok((await fetchTimeZone(27.72, 85.52, { fetchFn: fake })) === "Asia/Kathmandu" && /timezone=auto/.test(lastUrl) && /latitude=27\.720/.test(lastUrl), "pide la zona a Open-Meteo con timezone=auto");
ok((await fetchTimeZone(27.71, 85.53, { fetchFn: fake })) === "Asia/Kathmandu" && calls === 1 && cachedTimeZone(27.72, 85.52) === "Asia/Kathmandu", "la segunda vez sale de la caché");
const gmt = async () => ({ ok: true, json: async () => ({ timezone: "GMT" }) });
ok((await fetchTimeZone(-30, -140, { fetchFn: gmt })) === null && (await fetchTimeZone(1, 1, { fetchFn: async () => ({ ok: false }) })) === null, "mar abierto («GMT») o error: sin zona (se queda la del teléfono)");
ok((await fetchTimeZone(null, 3, { fetchFn: fake })) === null, "sin lugar, sin zona");

// cableado en la interfaz
const cons = readFileSync(new URL("../src/Constellations.jsx", import.meta.url), "utf8");
const sheet = readFileSync(new URL("../src/sky/TimeSheet.jsx", import.meta.url), "utf8");
ok((cons.match(/tz=\{placeTz\} place=\{tzPlace\}/g) || []).length === 3, "las tres hojas de tiempo reciben la zona y el nombre del lugar");
ok(/stepFieldTz\(new Date\(w\), f, dir, tzRef\.current\)/.test(cons) && /setMinuteTz\(new Date\(w\), min, tzRef\.current\)/.test(cons) && /fetchTimeZone\(lat, lon/.test(cons), "flechas, noches y barra mueven la hora del lugar; la zona se pide al cambiar de lugar");
ok(/tzParts\(date, tz\)/.test(sheet) && /sk-ts-tz/.test(sheet) && /dayProfile\(lat, lon, date, 48, tz\)/.test(sheet), "el reloj, el rótulo y la barra usan la zona");
ok(/tz: placeTz/.test(cons) && /timeZone=\{placeTz\}/.test(cons) && /fmtWhenShort\(when, lang, localMode \? placeTz : null\)/.test(cons), "salida y puesta, Esta noche y el botón de tiempo, en la hora del lugar");

console.log(`\n${pass} ok, ${fail} fallas`);
if (fail) process.exit(1);
