// Boundary.jsx — ErrorBoundary de la pestaña "Preguntas" (va en el bundle
// principal, por eso es mínimo). Si el chunk no carga o el panel falla, el
// resto de Teseo sigue funcionando. onReset recrea el componente lazy.
import { Component } from "react";
import { ErrorNotice } from "../ErrorBoundary.jsx";

export default class QuestionsBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; this.retry = this.retry.bind(this); }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[Teseo] Preguntas:", error, info && info.componentStack); }
  retry() {
    if (this.props.onReset) { try { this.props.onReset(); } catch { /* no-op */ } }
    this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    const { title, message, retryLabel } = this.props;
    return (
      <div className="flex justify-center py-10">
        <ErrorNotice title={title} message={message} retryLabel={retryLabel} onRetry={this.retry} className="max-w-md w-full" style={{ padding: 20 }} />
      </div>
    );
  }
}
