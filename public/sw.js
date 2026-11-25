// Teseo service worker — soporte offline
// teseo-v5: cambia la estrategia de los datos (stale-while-revalidate) y purga una vez lo acumulado en v4
const CACHE = "teseo-v5";
const CORE = [
  "/", "/index.html", "/favicon.svg", "/manifest.webmanifest",
  "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/sky.json",
];
// iconos y estáticos sin hash que no cambian: cache-first
const STATIC = new Set(["/favicon.svg", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png"]);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // no tocar el backend / NASA
  // nunca la API (funciones de Vercel) ni el .ics de suscripción: siempre a la red, sin caché
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/cal/")) return;

  // Navegaciones: network-first, fallback al index cacheado (SPA)
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((r) => {
        // solo la portada de la app es «el index»: /acerca (la landing) o /cal/teseo.ics no deben pisarlo
        if (r.ok && (url.pathname === "/" || url.pathname === "/index.html")) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
        }
        return r;
      }).catch(() => ((url.pathname.startsWith("/acerca") || url.pathname.startsWith("/about")) ? caches.match(req) : caches.match("/index.html")))
    );
    return;
  }

  // Con hash en el nombre (/assets/) o que no cambian (texturas, iconos): cache-first
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/textures/") || STATIC.has(url.pathname)) {
    e.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((r) => { keep(e, req, r); return r; }).catch(() => Response.error())
      )
    );
    return;
  }

  // Datos (/sky.json, /comet-orbits.json, /data/…) y el resto: stale-while-revalidate. Se responde al
  // momento con la copia guardada y se actualiza en segundo plano para la próxima visita; sin copia, red.
  // (Antes iban cache-first y quien ya había entrado no veía nunca los datos nuevos.)
  const net = fetch(req).then((r) => { keep(e, req, r); return r; });
  e.waitUntil(net.then(() => {}, () => {}));
  e.respondWith(caches.match(req).then((cached) => cached || net.catch(() => Response.error())));
});

/** Guarda en caché solo respuestas buenas del mismo origen: nada no-OK, opaco ni el index.html que
 *  Vercel devuelve (200) para un archivo inexistente (dejaría un JSON o una imagen «rota» para siempre). */
function keep(e, req, r) {
  const isHtml = (r.headers.get("content-type") || "").includes("text/html");
  if (!r.ok || isHtml || (r.type !== "basic" && r.type !== "default")) return;
  const copy = r.clone();
  e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}));
}

// ─── Avisos push: «Recordarme» del Calendario del cielo (src/now/calendar/push.js, backend app/push.py) ───
// Solo se añaden manejadores: no tocan la caché (la versión de CACHE depende solo de la estrategia de caché).
// El payload llega cifrado de extremo a extremo (RFC 8291) y trae { title, body, url, tag, lang }.

/** URL de la app a abrir: solo del mismo origen (si no, la portada de «Ahora en el espacio»). */
function appUrl(u) {
  const fallback = new URL("/#ahora", self.location.origin).href;
  try {
    const url = new URL(u || "/#ahora", self.location.origin);
    return url.origin === self.location.origin ? url.href : fallback;
  } catch { return fallback; }
}
const short = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? short(e.data.text(), 300) : "" }; }
  const lang = d.lang === "en" ? "en" : "es";
  const title = short(d.title, 120) || "Teseo";
  e.waitUntil(self.registration.showNotification(title, {
    body: short(d.body, 300),
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: short(d.tag, 120) || "teseo",
    lang,
    dir: "ltr",
    data: { url: appUrl(d.url) },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = appUrl(e.notification.data && e.notification.data.url);
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      try {
        if (new URL(c.url).origin !== self.location.origin) continue;
        const focused = await c.focus();                       // primero enfocar (conserva el permiso del clic)
        if (c.url !== target && "navigate" in c) await c.navigate(target).catch(() => null);
        return focused;
      } catch { /* esta ventana no se deja: probar la siguiente */ }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  })());
});
