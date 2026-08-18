import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort safety net — without this, ANY uncaught render error (a
 * missing browser API on an insecure LAN origin, a bad API response shape,
 * etc.) unmounts the entire React tree with nothing shown in its place,
 * which reads to a non-technical user as the app having gone completely
 * dark. This turns that into a recoverable message instead.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
          <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
          <p className="max-w-sm text-sm text-slate-500">
            An unexpected error occurred. Try reloading the page — if it keeps happening, let support know what you
            were doing.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
