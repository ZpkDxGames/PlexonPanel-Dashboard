import { Component, type ReactNode } from "react";
export class RouteBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <section className="pp-card" data-tone="rose">
        <h2>Workspace unavailable</h2>
        <p role="alert" className="error-banner my-3">
          {this.state.error}
        </p>
        <button className="btn" onClick={() => this.setState({ error: "" })}>
          Retry
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
