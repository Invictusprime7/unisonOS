import { Suspense, lazy, Component, type ReactNode, type ErrorInfo } from "react";
import { VFSProvider } from "@/contexts/VFSContext";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LaunchDegradationNote } from "@/components/builder/LaunchDegradationNote";


type WebBuilderModule = typeof import("@/components/creatives/WebBuilder");

const WebBuilder = lazy(async (): Promise<{ default: WebBuilderModule["WebBuilder"] }> => {
  // Fail visibly; never reload the entire editing session automatically.
  const module = await import("@/components/creatives/WebBuilder");
  return { default: module.WebBuilder };
});

// Inner error boundary that catches VFS/WebBuilder-specific crashes
// and allows recovery without navigating away
class VFSErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[VFS] Render error:", error, info.componentStack);
    console.error("[VFS] Error stack:", error.stack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
          <div className="text-center max-w-md p-8">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Web Builder failed to load</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              {this.state.error?.message || "An unexpected error occurred during initialization."}
            </p>
            {this.state.error?.stack && (
              <pre className="text-left text-xs bg-muted p-3 rounded overflow-auto max-h-40 mb-4 whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>
            )}
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button
                onClick={() => window.location.href = "/creatives"}
                variant="default"
                size="sm"
              >
                Back to Creatives
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const WebBuilderPage = () => (
  <VFSErrorBoundary>
    <VFSProvider>
      <div className="min-h-[100dvh] w-full overflow-hidden">
        <Suspense
          fallback={
            <div className="min-h-[100dvh] w-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading Web Builder...</p>
              </div>
            </div>
          }
        >
          <WebBuilder />
        </Suspense>
        <LaunchDegradationNote />
      </div>
    </VFSProvider>
  </VFSErrorBoundary>
);


export default WebBuilderPage;
