import { Component } from "react";

// ─── i18n ────────────────────────────────────────────────────────────────────
// Mismo mecanismo que T (App.jsx) y TC (Constellations.jsx): diccionario por
// idioma indexado con `lang`.

const TE = {
  en: {
    appTitle:  "Something went wrong",
    appBody:   "Teseo hit an unexpected error. Your data is safe: try again or reload the page.",
    skyTitle:  "The 3D sky could not be shown",
    skyBody:   "The 3D view failed to load or this device has no WebGL available. The rest of Teseo (routes, launch windows and scale) keeps working.",
    retry:     "Retry",
    reload:    "Reload page",
  },
  es: {
    appTitle:  "Algo salió mal",
    appBody:   "Teseo encontró un error inesperado. Tus datos están a salvo: vuelve a intentarlo o recarga la página.",
    skyTitle:  "No se pudo mostrar el cielo en 3D",
    skyBody:   "La vista 3D no terminó de cargar o este dispositivo no tiene WebGL disponible. El resto de Teseo (rutas, ventanas de lanzamiento y escala) sigue funcionando.",
    retry:     "Reintentar",
    reload:    "Recargar página",
  },
};

// Idioma sin prop: el que App ya sincronizó en <html lang> (applyLangToDocument)
function currentLang(lang) {
  if (lang === "es" || lang === "en") return lang;
  try { if (document.documentElement.lang === "en") return "en"; } catch { /* no-op */ }
  return "es";
}

// ─── AVISO DE ERROR ──────────────────────────────────────────────────────────
// Mensaje + botón de reintento. role="alert" para que el lector de pantalla lo
// anuncie; el foco visible del botón lo da la regla global de index.html.

export function ErrorNotice({ message, title, retryLabel, onRetry, children, className = "", style }) {
  return (
    <div role="alert" className={`rounded-xl px-4 py-3 text-left ${className}`}
      style={{ background: "rgba(127,29,29,0.28)", border: "1px solid rgba(252,165,165,0.45)", ...style }}>
      {title && (
        <p style={{ fontFamily: "Cormorant Garamond,Georgia,serif", fontSize: 18, color: "#fff", marginBottom: 4 }}>{title}</p>
      )}
      <p style={{ fontFamily: "Inter,system-ui", fontSize: 12, lineHeight: 1.5, color: "#FECACA" }}>
        <span aria-hidden="true">⚠ </span>{message}
      </p>
      {(onRetry || children) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {onRetry && (
            <button type="button" onClick={onRetry}
              className="px-3 py-1.5 rounded-full transition-all hover:bg-white/10"
              style={{ fontFamily: "Inter,system-ui", fontSize: 12, cursor: "pointer", color: "#fff",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.45)" }}>
              ↻ {retryLabel}
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

// ─── ERROR BOUNDARY ──────────────────────────────────────────────────────────
// variant="app": envuelve toda la aplicación (pantalla completa).
// variant="sky": envuelve solo la vista 3D; el resto de la app sigue usable.
// onReset: se llama al pulsar "Reintentar", antes de volver a renderizar los
// hijos (p. ej. para recrear un componente lazy cuyo chunk falló).

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Solo consola: útil para depurar en la demo sin mostrar la traza al público
    console.error("[Teseo] ErrorBoundary:", error, info && info.componentStack);
  }

  handleRetry() {
    if (this.props.onReset) {
      try { this.props.onReset(); } catch { /* no-op */ }
    }
    this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const t = TE[currentLang(this.props.lang)];
    const sky = this.props.variant === "sky";
    const notice = (
      <ErrorNotice
        title={sky ? t.skyTitle : t.appTitle}
        message={sky ? t.skyBody : t.appBody}
        retryLabel={t.retry}
        onRetry={this.handleRetry}
        className="max-w-md w-full"
        style={{ padding: 20 }}>
        {!sky && (
          <button type="button" onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-full transition-all hover:bg-white/10"
            style={{ fontFamily: "Inter,system-ui", fontSize: 12, cursor: "pointer", color: "#fff",
              background: "transparent", border: "1px solid rgba(255,255,255,0.45)" }}>
            {t.reload}
          </button>
        )}
      </ErrorNotice>
    );

    if (sky) return <div className="flex justify-center py-10">{notice}</div>;
    return (
      <div className="min-h-screen flex items-center justify-center p-5 bg-[#04080F] text-white">
        {notice}
      </div>
    );
  }
}
