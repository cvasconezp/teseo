import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary variant="app">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// Tras un despliegue, una pestaña abierta pide chunks (import dinámico) que ya no existen: Vite avisa con
// «vite:preloadError». Se recarga UNA vez para traer el index nuevo; la bandera en sessionStorage evita un
// bucle si el fallo sigue (sin red, chunk roto) y caduca a los 60 s (un despliegue futuro vuelve a recargar).
const PRELOAD_KEY = "teseo-preload-reload";
window.addEventListener("vite:preloadError", (e) => {
  try {
    const at = Number(sessionStorage.getItem(PRELOAD_KEY)) || 0;
    if (Date.now() - at < 60000) return;            // ya se recargó hace poco: que lo muestre el ErrorBoundary
    sessionStorage.setItem(PRELOAD_KEY, String(Date.now()));
  } catch { return; }                               // sin sessionStorage no hay forma de evitar el bucle
  e.preventDefault();                               // no lanzar el error: la recarga lo resuelve
  window.location.reload();
});

// PWA: registrar service worker para soporte offline
if ("serviceWorker" in navigator) {
  // Si la página ya tenía un service worker y llega uno nuevo (nueva versión
  // desplegada), se recarga una sola vez para no quedarse con código viejo.
  // En la primera visita no hay controlador previo, así que no recarga.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Buscar versión nueva al volver a la pestaña (apps abiertas durante horas)
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}
