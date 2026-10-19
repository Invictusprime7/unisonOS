/**
 * Route Error Boundary
 * 
 * Enterprise-grade error handling for routes.
 * Catches errors, logs them for observability, and displays user-friendly messages.
 */

import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auditLogger } from '@/services/auditLogger';

// ============================================
// TYPES
// ============================================

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Route name for error reporting */
  routeName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

const DYNAMIC_IMPORT_FAILURE = /failed to fetch dynamically imported module|importing a module script failed|loading chunk \d+ failed/i;

export function isDynamicImportFailure(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  return DYNAMIC_IMPORT_FAILURE.test(message);
}

function dynamicImportRecoveryKey(): string {
  return `unison:dynamic-import-recovery:${window.location.pathname}`;
}

// ============================================
// ERROR BOUNDARY COMPONENT
// ============================================

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for support
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, routeName } = this.props;
    const { errorId } = this.state;

    // Log to console for development
    console.error('Route Error Boundary caught error:', error, errorInfo);

    // Log security event for observability
    auditLogger.logSecurityEvent('route_error', {
      error_id: errorId,
      route: routeName || window.location.pathname,
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
      component_stack: errorInfo.componentStack,
    }, 'medium');

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Report to external monitoring (if configured)
    this.reportToMonitoring(error, errorInfo);
  }

  private reportToMonitoring(error: Error, errorInfo: ErrorInfo) {
    // Integration point for Sentry, DataDog, etc.
    // Example: if (window.Sentry) { window.Sentry.captureException(error); }
    
    // For now, we can send to a custom endpoint
    const monitoringEndpoint = import.meta.env.VITE_ERROR_MONITORING_URL;
    if (monitoringEndpoint) {
      fetch(monitoringEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId: this.state.errorId,
          name: error.name,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // Silently fail - don't create more errors
      });
    }
  }

  private handleRetry = () => {
    if (isDynamicImportFailure(this.state.error)) {
      try {
        window.sessionStorage.removeItem(dynamicImportRecoveryKey());
      } catch {
        // Storage can be disabled; the normal reload action still applies.
      }
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, errorId: null });
  };

  private handleGoHome = () => {
    window.location.href = '/home';
  };

  render() {
    const { children, fallback } = this.props;
    const { hasError, error, errorId } = this.state;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
              <CardDescription>
                We encountered an unexpected error. Our team has been notified.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error details (collapsible in production) */}
              {import.meta.env.DEV && error && (
                <div className="p-3 bg-muted rounded-md text-sm font-mono overflow-auto max-h-32">
                  <p className="text-destructive font-semibold">{error.name}: {error.message}</p>
                  {error.stack && (
                    <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                      {error.stack}
                    </pre>
                  )}
                </div>
              )}

              {/* Error ID for support */}
              {errorId && (
                <p className="text-xs text-center text-muted-foreground">
                  Error ID: <code className="bg-muted px-1 rounded">{errorId}</code>
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={this.handleRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={this.handleGoHome}>
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>

              {/* Report bug link */}
              <p className="text-xs text-center text-muted-foreground">
                <a 
                  href={`mailto:support@unisontasks.com?subject=Bug Report (${errorId})&body=Error ID: ${errorId}%0A%0ADescription:%0A`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Bug className="h-3 w-3" />
                  Report this issue
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// ============================================
// WRAPPER HOOK FOR FUNCTIONAL COMPONENTS
// ============================================

/**
 * Higher-order component to wrap any component with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  routeName?: string
): React.ComponentType<P> {
  return function WithErrorBoundary(props: P) {
    return (
      <RouteErrorBoundary routeName={routeName}>
        <WrappedComponent {...props} />
      </RouteErrorBoundary>
    );
  };
}

// ============================================
// ASYNC ERROR BOUNDARY
// ============================================

interface AsyncBoundaryProps {
  children: ReactNode;
  loading?: ReactNode;
  error?: ReactNode;
}

interface AsyncRouteLoadingFallbackProps {
  label?: string;
  timeoutMs?: number;
}

/**
 * Lazy imports can remain pending when a deployed chunk is stale or a large
 * dependency graph is interrupted. Replace the indeterminate spinner with a
 * reloadable state instead of leaving the route visually frozen forever.
 */
export function AsyncRouteLoadingFallback({
  label = 'Loading…',
  timeoutMs = 12_000,
}: AsyncRouteLoadingFallbackProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [timeoutMs]);

  if (timedOut) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
          <h2 className="text-lg font-semibold">Web Builder took too long to start</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Reload to fetch a fresh builder runtime.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload builder
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        <p className="text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * Combines Suspense with Error Boundary for async components
 */
export function AsyncBoundary({ children, loading, error }: AsyncBoundaryProps) {
  const loadingFallback = loading || (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <RouteErrorBoundary fallback={error}>
      <React.Suspense fallback={loadingFallback}>
        {children}
      </React.Suspense>
    </RouteErrorBoundary>
  );
}
