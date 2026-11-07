/**
 * LaunchReadinessCard
 *
 * Lightweight readiness pill that mounts at the top of the AI Builder chat
 * panel. Reads `/.unison/launch-readiness.json` (pre-baked by the Wizard
 * Launcher) and shows ✅ "Publish ready" on first paint whenever the wizard
 * audit returned a clean slate. Only surfaces fix actions if a post-launch
 * edit broke a binding.
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface WizardAuditMissing {
  coreIntent: string;
  level: 'required' | 'primary' | 'secondary';
  synthesizable: boolean;
}

interface LaunchReadinessManifest {
  publishMode?: string;
  industry?: string | null;
  industryReady?: boolean;
  notificationsReady?: boolean;
  bookingReady?: boolean;
  commerceRequired?: boolean;
  paymentsReady?: boolean;
  payments?: { required?: boolean; configured?: boolean; stepStatus?: string };
  capabilitiesAwaitingConfirmation?: Array<{ capabilityId?: string; reason?: string }>;
  previewReady?: boolean;
  bindings?: { total?: number; previewReady?: number; publishReady?: number; blocked?: number };
  industryIntentCoverage?: {
    industry?: string;
    requiredTotal?: number;
    requiredSatisfied?: number;
    unsatisfiedRequired?: string[];
    forbiddenLeaked?: string[];
  } | null;
  wizardAudit?: {
    missing?: WizardAuditMissing[];
    forbiddenLeaked?: string[];
    publishReadyByAudit?: boolean;
  };
}

interface Props {
  vfsFiles?: Record<string, string> | null;
  className?: string;
}

export function LaunchReadinessCard({ vfsFiles, className }: Props) {
  const [expanded, setExpanded] = useState(false);

  const manifest = useMemo<LaunchReadinessManifest | null>(() => {
    const raw = vfsFiles?.['/.unison/launch-readiness.json'];
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LaunchReadinessManifest;
    } catch {
      return null;
    }
  }, [vfsFiles]);

  if (!manifest) return null;

  const audit = manifest.wizardAudit;
  const coverage = manifest.industryIntentCoverage;
  const blocked = manifest.bindings?.blocked || 0;
  const capabilitySuggestions = manifest.capabilitiesAwaitingConfirmation || [];
  const paymentsReady = manifest.commerceRequired !== true || manifest.paymentsReady === true;
  const unsatisfied = coverage?.unsatisfiedRequired || [];
  const requiredMissing = (audit?.missing || []).filter(
    (m) => m.level === 'required' && !m.synthesizable,
  );

  const isReady =
    (audit?.publishReadyByAudit ?? manifest.industryReady ?? true) &&
    blocked === 0 &&
    unsatisfied.length === 0 &&
    requiredMissing.length === 0 &&
    paymentsReady;

  return (
    <div
      className={cn(
        'mx-3 mb-3 rounded-xl border bg-card/60 backdrop-blur-sm overflow-hidden',
        isReady ? 'border-emerald-500/30' : 'border-amber-500/40',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        {isReady ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-foreground flex-1 truncate">
          {isReady ? 'Publish ready' : 'Wiring needs attention'}
        </span>
        {manifest.industry && (
          <Badge variant="outline" className="h-5 text-[10px] px-1.5">
            {manifest.industry}
          </Badge>
        )}
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 text-[11px] text-muted-foreground border-t border-border/40">
          <Row label="Mode" value={manifest.publishMode || 'manual-setup'} />
          <Row
            label="Bindings"
            value={`${manifest.bindings?.publishReady || 0}/${manifest.bindings?.total || 0} publish-ready${
              blocked ? ` · ${blocked} blocked` : ''
            }`}
          />
          {manifest.commerceRequired && (
            <Row
              label="Checkout payments"
              value={paymentsReady ? 'connected' : 'connection required'}
            />
          )}
          {coverage && (
            <Row
              label="Industry intents"
              value={`${coverage.requiredSatisfied || 0}/${coverage.requiredTotal || 0} required`}
            />
          )}
          {capabilitySuggestions.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
              <div className="mb-1 font-medium text-amber-700 dark:text-amber-400">
                Suggested capabilities · not enabled
              </div>
              <ul className="space-y-1">
                {capabilitySuggestions.map((item) => (
                  <li key={item.capabilityId}>
                    <span className="font-medium text-foreground">{item.capabilityId}</span>
                    {item.reason ? <span>: {item.reason}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {requiredMissing.length > 0 && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2">
              <div className="text-amber-600 dark:text-amber-400 font-medium mb-1">
                Unreachable required intents
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {requiredMissing.map((m) => (
                  <li key={m.coreIntent}>{m.coreIntent}</li>
                ))}
              </ul>
            </div>
          )}
          {audit?.forbiddenLeaked && audit.forbiddenLeaked.length > 0 && (
            <Row label="Forbidden" value={audit.forbiddenLeaked.join(', ')} />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground/80">{label}</span>
      <span className="text-foreground/90 font-medium truncate">{value}</span>
    </div>
  );
}
