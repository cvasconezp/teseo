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
