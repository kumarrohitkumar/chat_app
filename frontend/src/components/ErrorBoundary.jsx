import { Component } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

/**
 * Without this, one thrown render error blanks the whole page with no
 * explanation. React has no hook equivalent, so this stays a class.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ui] render failed", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-base-200">
        <div className="max-w-md text-center space-y-4 animate-fade-up">
          <div className="size-16 rounded-2xl bg-error/10 flex items-center justify-center mx-auto">
            <TriangleAlert className="size-8 text-error" />
          </div>

          <h1 className="text-2xl font-bold">Something broke</h1>
          <p className="text-base-content/60">
            The page hit an error it could not recover from. Reloading usually fixes it.
          </p>

          <button onClick={() => window.location.reload()} className="press btn btn-primary btn-sm">
            <RefreshCw className="size-4" />
            Reload
          </button>

          {import.meta.env.DEV && (
            <pre className="text-left text-xs bg-base-300 p-3 rounded-lg overflow-auto max-h-48">
              {error.stack || String(error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
