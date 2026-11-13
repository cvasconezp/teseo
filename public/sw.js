// Teseo service worker — soporte offline
const CACHE = "teseo-v2";
const CORE = [
  "/", "/index.html", "/favicon.svg", "/manifest.webmanifest",
  "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/sky.json",
];

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

  // Navegaciones: network-first, fallback al index cacheado (SPA)
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put("/index.html", copy));
        return r;
      }).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Resto de assets same-origin (JS/CSS hasheados, sky.json, iconos): cache-first
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((r) => {
        // No guardar el index.html que Vercel devuelve (200) para un asset
        // inexistente: dejaría una imagen/JSON "rota" en caché para siempre.
        const isHtml = (r.headers.get("content-type") || "").includes("text/html");
        if (r.ok && !isHtml && (r.type === "basic" || r.type === "default")) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return r;
      }).catch(() => cached || Response.error())
    )
  );
});
