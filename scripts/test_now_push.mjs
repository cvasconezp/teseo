// Pruebas de «Recordarme» (src/now/calendar/push.js): lógica pura. Node puro, sin dependencias ni red.
// Uso:  node scripts/test_now_push.mjs     (sale con código 1 si algo falla)
// Cubre: detección de iPhone/iPad y de soporte, hora del aviso (con hora y de día completo, en varias zonas
// horarias), armado de las peticiones (sin datos de más), estado local, claves y textos ES/EN.
import { readFileSync } from "node:fs";
import {
  isIOS, iosVersion, detectPush, leadOptions, reminderTimes, canRemind, cleanSubscription, buildRemindRequest,
  buildDeleteRequest, urlB64ToUint8Array, sameKey, readState, writeState, withReminder, withoutReminder, STORE_KEY, LEADS,
} from "../src/now/calendar/push.js";
import { TC } from "../src/now/calendar/i18n.js";
import { metricParams } from "../src/ui/track.js";

let failed = 0, passed = 0;
const ok = (cond, name, detail = "") => { if (cond) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FALLA ${name} ${detail}`); } };
const MIN = 60000, HOUR = 3600000;
const withTZ = (tz, fn) => { const prev = process.env.TZ; process.env.TZ = tz; try { return fn(); } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; } };

const UA = {
  iphone17: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphone163: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1",
  iphone164: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
  crios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  ipadDesktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  desktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};
const FULL = { secure: true, hasServiceWorker: true, hasPushManager: true, hasNotification: true };

// ─── 1 · Detección ───────────────────────────────────────────────────────────
console.log("Detección de iPhone/iPad y de soporte");
{
  ok(isIOS({ ua: UA.iphone17 }) && isIOS({ ua: UA.crios }), "iPhone (Safari y Chrome para iOS) es iOS");
  ok(isIOS({ ua: UA.ipadDesktop, platform: "MacIntel", maxTouchPoints: 5 }), "iPad que se anuncia como Mac (táctil) es iOS");
  ok(!isIOS({ ua: UA.ipadDesktop, platform: "MacIntel", maxTouchPoints: 0 }), "un Mac de verdad no es iOS");
  ok(!isIOS({ ua: UA.android }) && !isIOS({ ua: UA.desktop, platform: "Win32" }), "Android y Windows no son iOS");
  ok(JSON.stringify(iosVersion(UA.iphone164)) === "[16,4]" && JSON.stringify(iosVersion(UA.iphone17)) === "[17,5]" && iosVersion(UA.ipadDesktop) === null, "versión de iOS desde el user-agent");

  // iPhone en Safari sin instalar (aunque Safari 17 exponga las APIs): hay que añadirla a la pantalla de inicio
  ok(detectPush({ ua: UA.iphone17, ...FULL, standalone: false }).state === "ios_install", "iPhone en Safari sin instalar → ios_install");
  ok(detectPush({ ua: UA.iphone17, secure: true, standalone: false }).state === "ios_install", "iPhone sin APIs (Safari, pestaña) → ios_install");
  ok(detectPush({ ua: UA.crios, secure: true, standalone: false }).state === "ios_install", "Chrome en iPhone → ios_install");
  ok(detectPush({ ua: UA.iphone17, ...FULL, standalone: true }).state === "ok", "iPhone con Teseo instalada (iOS 17) → ok");
  ok(detectPush({ ua: UA.iphone164, ...FULL, standalone: true }).state === "ok", "iOS 16.4 instalada → ok");
  const old = detectPush({ ua: UA.iphone163, secure: true, standalone: false });
  ok(old.state === "unsupported" && old.reason === "ios_old", "iOS 16.3 → sin soporte (ios_old), no se le pide instalar");
  ok(detectPush({ ua: UA.ipadDesktop, platform: "MacIntel", maxTouchPoints: 5, ...FULL, standalone: false }).state === "ios_install", "iPad «de escritorio» sin instalar → ios_install");
  ok(detectPush({ ua: UA.android, ...FULL }).state === "ok" && detectPush({ ua: UA.desktop, ...FULL }).state === "ok", "Chrome Android y escritorio → ok");
  const noPush = detectPush({ ua: UA.desktop, secure: true, hasServiceWorker: true, hasNotification: true, hasPushManager: false });
  ok(noPush.state === "unsupported" && noPush.reason === "no_api", "sin PushManager → sin soporte");
  ok(detectPush({ ua: UA.desktop, ...FULL, secure: false }).reason === "insecure", "http (no seguro) → sin soporte");
  ok(detectPush({}).state === "unsupported", "entorno vacío (Node) → sin soporte");
}

// ─── 2 · Hora del aviso ──────────────────────────────────────────────────────
console.log("Hora del aviso");
{
  const now = Date.parse("2026-11-14T12:00:00Z");
  const timed = { id: "moon-full-20261124", t: Date.parse("2026-11-24T14:53:00Z") };
  ok(JSON.stringify(leadOptions(timed)) === '["30","120"]' && JSON.stringify(leadOptions({ allDay: true })) === '["eve"]', "antelaciones: 30 min / 2 h; día completo: víspera");
  const r30 = reminderTimes(timed, "30", now), r120 = reminderTimes(timed, "120", now);
  ok(r30.eventAt === timed.t && r30.leadMin === 30 && r30.notifyAt === timed.t - 30 * MIN, "con hora: aviso 30 min antes");
  ok(r120.leadMin === 120 && r120.notifyAt === timed.t - 2 * HOUR, "con hora: aviso 2 h antes");
  ok(reminderTimes(timed, "eve", now) === null && reminderTimes(timed, "45", now) === null, "con hora: antelación no válida → null");
  const soon = { id: "iss-x", t: now + 20 * MIN };
  ok(reminderTimes(soon, "30", now).notifyAt === now, "si la antelación ya pasó, el aviso se adelanta a ahora");
  ok(reminderTimes({ id: "x", t: now + 30 * 1000 }, "30", now) === null && reminderTimes({ id: "x", t: now - HOUR }, "30", now) === null, "evento empezado (o a < 1 min) → null");
  ok(canRemind(timed, now) && !canRemind({ id: "x", t: now - 1 }, now), "canRemind");

  // Día completo (fecha de catálogo guardada como mediodía UTC): víspera a las 18:00 LOCAL, en cualquier zona
  const geminids = { id: "meteor-Geminids-2026", t: Date.UTC(2026, 11, 14, 12), allDay: true };
  for (const [tz, eventUtc, notifyUtc] of [
    ["America/Guayaquil", "2026-12-14T05:00:00.000Z", "2026-12-13T23:00:00.000Z"],   // UTC−5
    ["Pacific/Honolulu", "2026-12-14T10:00:00.000Z", "2026-12-14T04:00:00.000Z"],    // UTC−10: el aviso cae el 14 en UTC
    ["Asia/Tokyo", "2026-12-13T15:00:00.000Z", "2026-12-13T09:00:00.000Z"],          // UTC+9
    ["Europe/Madrid", "2026-12-13T23:00:00.000Z", "2026-12-13T17:00:00.000Z"],       // UTC+1
  ]) {
    withTZ(tz, () => {
      const r = reminderTimes(geminids, "eve", now);
      const local = new Date(r.notifyAt);
      ok(new Date(r.eventAt).toISOString() === eventUtc && new Date(r.notifyAt).toISOString() === notifyUtc && local.getHours() === 18 && local.getDate() === 13 && r.leadMin === 360,
        `día completo en ${tz}: víspera 13-dic a las 18:00 locales`, `${new Date(r.eventAt).toISOString()} / ${new Date(r.notifyAt).toISOString()}`);
    });
  }
  withTZ("America/Guayaquil", () => {
    const dayOf = Date.parse("2026-12-14T10:00:00Z");          // ya es el día del evento (05:00 en Quito)
    ok(reminderTimes(geminids, "eve", dayOf) === null, "día completo: el mismo día ya no admite recordatorio");
    const lateEve = Date.parse("2026-12-14T02:00:00Z");        // 21:00 de la víspera
    ok(reminderTimes(geminids, "eve", lateEve).notifyAt === lateEve, "día completo: pasadas las 18:00 de la víspera, avisa ya");
  });
}

// ─── 3 · Peticiones ──────────────────────────────────────────────────────────
console.log("Armado de las peticiones");
{
  const now = Date.parse("2026-11-14T12:00:00Z");
  const subJson = { endpoint: "https://fcm.googleapis.com/fcm/send/abc:APA91b", expirationTime: null, keys: { p256dh: "BP" + "a".repeat(85), auth: "b".repeat(22) }, extra: "x" };
  const clean = cleanSubscription(subJson);
  ok(JSON.stringify(clean) === JSON.stringify({ endpoint: subJson.endpoint, keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth } }), "suscripción: solo endpoint y claves (sin expirationTime ni extras)");
  ok(cleanSubscription(null) === null && cleanSubscription({ endpoint: "x" }) === null && cleanSubscription({ endpoint: "x", keys: { p256dh: 1, auth: "a" } }) === null, "suscripción incompleta → null");

  const ev = { id: "opp-Uranus-20261125", t: Date.parse("2026-11-25T22:33:00Z"), data: { lat: -0.22, lon: -78.5 } };
  const body = buildRemindRequest({ subscription: subJson, ev, title: "Urano en oposición", lead: "120", lang: "es", now });
  ok(body.event.at_utc === "2026-11-25T22:33:00Z" && body.lead_min === 120 && body.event.all_day === false, "POST: hora UTC ISO con «Z», antelación en minutos");
  ok(body.event.id === ev.id && body.event.title === "Urano en oposición" && body.event.url === "/#ahora" && body.lang === "es", "POST: id, título, URL interna e idioma");
  ok(JSON.stringify(Object.keys(body).sort()) === '["event","lang","lead_min","subscription"]' && JSON.stringify(Object.keys(body.event).sort()) === '["all_day","at_utc","id","title","url"]', "POST: ni una clave de más");
  const s = JSON.stringify(body);
  ok(!/-0\.22|-78\.5|lat|lon|expirationTime/.test(s), "POST: sin ubicación ni datos del evento que no hacen falta");
  ok(buildRemindRequest({ subscription: subJson, ev, title: "x", lead: "30", lang: "fr", now }).lang === "es", "idioma desconocido → es");
  ok(buildRemindRequest({ subscription: subJson, ev: { id: "x", t: now - 1 }, title: "x", lead: "30", now }) === null, "evento pasado → sin petición");
  ok(buildRemindRequest({ subscription: { endpoint: "x" }, ev, title: "x", lead: "30", now }) === null, "sin claves → sin petición");
  withTZ("America/Guayaquil", () => {
    const day = buildRemindRequest({ subscription: subJson, ev: { id: "meteor-Geminids-2026", t: Date.UTC(2026, 11, 14, 12), allDay: true }, title: "Gemínidas", lead: "eve", lang: "en", now });
    ok(day.event.at_utc === "2026-12-14T05:00:00Z" && day.lead_min === 360 && day.event.all_day === true && day.lang === "en", "POST día completo: medianoche local en UTC + 360 min");
  });
  ok(JSON.stringify(buildDeleteRequest("https://fcm.googleapis.com/x", "a-1")) === '{"endpoint":"https://fcm.googleapis.com/x","event_id":"a-1"}', "DELETE: endpoint + event_id");
  ok(LEADS["30"] === 30 && LEADS["120"] === 120 && LEADS.eve === 360, "tabla de antelaciones");
}

// ─── 4 · Claves y estado local ───────────────────────────────────────────────
console.log("Clave VAPID y estado local");
{
  const pubB64 = "BAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0-P0A";
  const key = urlB64ToUint8Array(pubB64);
  ok(key.length === 65 && key[0] === 4 && key[1] === 1 && key[64] === 64, "clave pública base64url → 65 bytes (punto sin comprimir)");
  ok(sameKey(key.buffer.slice(0), key) && !sameKey(new Uint8Array(65), key) && !sameKey(null, key) && !sameKey(new Uint8Array(3), key), "comparación de applicationServerKey");

  const mem = new Map();
  const st = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const now = Date.parse("2026-11-14T12:00:00Z");
  ok(JSON.stringify(readState(st, now)) === '{"v":1,"r":{}}', "estado vacío");
  let s = withReminder(readState(st, now), "moon-full-20261124", now + 10 * HOUR);
  s = withReminder(s, "iss-20261114-2310", now + HOUR);
  writeState(st, s);
  const raw = mem.get(STORE_KEY);
  ok(JSON.stringify(JSON.parse(raw)) === JSON.stringify({ v: 1, r: { "moon-full-20261124": now + 10 * HOUR, "iss-20261114-2310": now + HOUR } }), "localStorage: solo id de evento → hora del aviso");
  ok(!/endpoint|p256dh|auth|lat|lon/.test(raw), "localStorage: ni suscripción ni ubicación");
  ok(Object.keys(readState(st, now + 2 * HOUR).r).join() === "moon-full-20261124", "se olvidan los avisos que ya llegaron");
  writeState(st, withoutReminder(withoutReminder(s, "moon-full-20261124"), "iss-20261114-2310"));
  ok(!mem.has(STORE_KEY), "sin recordatorios se borra la clave");
  mem.set(STORE_KEY, "{roto"); ok(JSON.stringify(readState(st, now).r) === "{}", "JSON roto → vacío");
  mem.set(STORE_KEY, JSON.stringify({ v: 1, r: { a: "x", b: now + HOUR } })); ok(Object.keys(readState(st, now).r).join() === "b", "valores no numéricos se descartan");
  ok(JSON.stringify(readState(null, now)) === '{"v":1,"r":{}}', "sin localStorage → vacío");
}

// ─── 5 · Textos, métricas y service worker ───────────────────────────────────
console.log("Textos, métricas y service worker");
{
  const keys = (o) => Object.keys(o).sort().join();
  const es = TC.es.push, en = TC.en.push;
  ok(keys(es) === keys(en) && keys(es.err) === keys(en.err) && keys(es.lead) === keys(en.lead), "ES y EN: mismas claves de «Recordarme»");
  ok(es.iosInstall === "Para recibir avisos en iPhone, añade Teseo a la pantalla de inicio (Compartir → Añadir a pantalla de inicio).", "texto exacto del aviso de iPhone");
  ok(es.remind === "Recordarme" && es.remove === "Quitar recordatorio" && es.test === "Probar notificación" && TC.es.addCal === "A mi calendario", "etiquetas en español");
  ok(/ubicación/.test(es.privacy) && /borra/.test(es.privacy) && /location/.test(en.privacy) && /deleted/.test(en.privacy), "la explicación dice qué se guarda y cuándo se borra");
  ok(es.remindFor("Luna llena").includes("Luna llena") && en.on("Mon 24 Nov, 14:23").includes("14:23"), "plantillas con parámetro");
  const kinds = ["on", "off", "test", "denied", "unsupported", "ios_install"];
  ok(kinds.every((kind) => JSON.stringify(metricParams({ kind })) === JSON.stringify({ kind })), "métricas: los seis valores de kind pasan metricParams de track.js");
  const metricsPy = readFileSync(new URL("../backend/app/metrics.py", import.meta.url), "utf8");
  ok(/"push_remind":\s*\{"kind": PUSH_KINDS\}/.test(metricsPy) && /PUSH_KINDS = \{"on", "off", "test", "denied", "unsupported", "ios_install"\}/.test(metricsPy), "push_remind en la lista blanca del backend (solo kind)");

  const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  ok(/addEventListener\("push"/.test(sw) && /addEventListener\("notificationclick"/.test(sw), "sw.js: manejadores push y notificationclick");
  ok(/icon: "\/icon-192\.png"/.test(sw) && /badge:/.test(sw), "sw.js: icono e insignia");
  ok(/const CACHE = "teseo-v3"/.test(sw) && /req\.mode === "navigate"/.test(sw) && /caches\.match\(req\)\.then/.test(sw), "sw.js: misma caché y estrategias (network-first / cache-first)");
  ok(/url\.origin === self\.location\.origin \? url\.href : fallback/.test(sw), "sw.js: solo abre URLs del mismo origen");
  const cal = readFileSync(new URL("../src/now/calendar/Calendar.jsx", import.meta.url), "utf8");
  ok(!/requestPermission/.test(cal) && !/useEffect\([^)]*ensureSubscription/.test(cal), "Calendar.jsx no pide permiso al cargar (solo push.js, desde un clic)");
}

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
