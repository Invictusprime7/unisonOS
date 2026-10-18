import { AlertTriangle, RefreshCw, Rocket, Activity } from 'lucide-react';
import type { PreviewPipelineError } from '@/services/previewPipelineError';

interface PreviewRuntimeErrorProps {
  error: PreviewPipelineError;
  onRetry?: () => void;
  onRelaunch?: () => void;
  onOpenHealth?: () => void;
}

const STAGE_LABEL: Record<string, string> = {
  vfs: 'Site Bundle',
  prep: 'Preview Prep',
  sandpack: 'Sandpack Compile',
};

/**
 * Full-frame branded error panel rendered when the preview pipeline raises a
 * PreviewPipelineError. Replaces the silent fallback chain so the user sees
 * exactly which stage failed and what to do.
 */
export function PreviewRuntimeError({
  error,
  onRetry,
  onRelaunch,
  onOpenHealth,
}: PreviewRuntimeErrorProps) {
  const stageLabel = STAGE_LABEL[error.stage] || error.stage;
  const blocked = error.details.blockedFiles || [];
  const recoverable = error.details.recoverableByRelaunch;

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Preview pipeline halted
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {stageLabel} stage
            </h2>
          </div>
          <span className="ml-auto rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {error.stage}
          </span>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-foreground">
          {error.summary}
        </p>

        {blocked.length > 0 && (
          <div className="mb-5 rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Blocked files
            </div>
            <ul className="space-y-1 text-xs font-mono text-foreground">
              {blocked.map((path) => (
                <li key={path} className="truncate">{path}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry preview
            </button>
          )}
          {recoverable && onRelaunch && (
            <button
              onClick={onRelaunch}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Rocket className="h-3.5 w-3.5" /> Re-run System Launcher
            </button>
          )}
          {onOpenHealth && (
            <button
              onClick={onOpenHealth}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              <Activity className="h-3.5 w-3.5" /> Open Health
            </button>
          )}
        </div>

        <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
          Fallback presets have been removed from the runtime. When the pipeline
          can't project the wizard's SiteBundleSnapshot, you'll see this panel
          instead of a default-looking site.
        </p>
      </div>
    </div>
  );
}
