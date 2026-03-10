import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary. Catches unhandled rendering errors
 * and displays a recovery UI instead of a white screen.
 *
 * Placed in main.tsx, wrapping the entire <App />.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-50 px-4">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <h1 className="text-lg font-semibold text-surface-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-surface-500">
              An unexpected error occurred. Try returning to the dashboard.
            </p>
            {this.state.error && (
              <p className="mt-2 rounded bg-surface-100 px-3 py-2 text-xs text-surface-600 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <Button onClick={this.handleReset} className="mt-4">
              Return to Dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
