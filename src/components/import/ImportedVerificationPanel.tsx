import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { VerificationSummary } from '@/services/import/importedSourceVerification';

/** Page check results plus the owner's confirmation, shared by every imported preview. */
export function ImportedVerificationPanel({ summary, confirmed, onConfirmedChange, onSave, onClose, saving, canSave, message }: {
  summary: VerificationSummary;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  canSave: boolean;
  message: string | null;
}) {
  const passed = summary.status === 'passed';
  return (
    <div className="absolute inset-x-0 bottom-0 max-h-[60%] overflow-auto border-t border-border bg-background p-4" role="region" aria-label="Page check results">
      <div className="mx-auto w-full max-w-xl space-y-3">
        <p className="text-xs font-medium text-foreground">
          {passed ? `All ${summary.routes.length} page${summary.routes.length === 1 ? '' : 's'} rendered without errors.` : 'Some pages need attention before publishing.'}
        </p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {summary.routes.map((r) => (
            <li key={r.path}>{r.ok ? '✓' : '✗'} {r.path}{r.problems.length ? ` — ${r.problems.join(' ')}` : ''}</li>
          ))}
          {summary.problems.filter((p) => p.startsWith('Not checked') || p.startsWith('No pages')).map((p) => <li key={p}>✗ {p}</li>)}
        </ul>
        {passed && (
          <label className="flex items-start gap-2 text-xs text-foreground">
            <Checkbox checked={confirmed} onCheckedChange={(v) => onConfirmedChange(v === true)} aria-label="Confirm the preview matches the original" />
            <span>I looked through these pages and they match my original design.</span>
          </label>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={onSave} disabled={saving || !canSave || (passed && !confirmed)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {passed ? 'Save check and allow publishing' : 'Save check result'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
