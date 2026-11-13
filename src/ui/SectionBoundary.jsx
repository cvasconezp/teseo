// SectionBoundary.jsx — ErrorBoundary pequeño para una sección opcional.
// Si el chunk no carga o la sección falla al pintar, muestra un aviso con
// "Reintentar" y el resto de Teseo sigue funcionando. onReset permite recrear
// un componente lazy cuyo import falló.
import { Component } from "react";
import { ErrorNotice } from "../ErrorBoundary.jsx";

export default class SectionBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; this.retry = this.retry.bind(this); }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error(`[Teseo] ${this.props.name || "sección"}:`, error, info && info.componentStack); }
  retry() {
    if (this.props.onReset) { try { this.props.onReset(); } catch { /* no-op */ } }
    this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    const { title, message, retryLabel } = this.props;
    return <ErrorNotice title={title} message={message} retryLabel={retryLabel} onRetry={this.retry} />;
  }
}
