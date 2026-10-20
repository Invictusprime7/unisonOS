/**
 * ReadinessCenterPanel — read-only v1
 *
 * Aggregates publish-readiness signals from sources that already exist:
 *  - Wizard manifest (/.unison/launch-readiness.json)
 *  - CompiledContract (provisioning, slots, intents)
 *  - PublishGate verdict (already evaluated by SystemHealthPanel; we re-derive)
 *
 * v1 is intentionally read-only: no edge function probes, no live DB writes,
 * no mutations. It renders 6 sections with ✓ / ✗ / — markers and a short
 * reason line per failing check. See mem://process — Readiness Center v1.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, MinusCircle, ShieldCheck, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { type CompiledContract, PublishGate, PreviewGate } from '@/platform/core';
import {
  runReadinessProbes,
  type ProbeResult,
  type ProbeState,
} from '@/services/readinessProbes';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReadinessManifest {
  publishMode?: string;
  industry?: string | null;
  industryReady?: boolean;
  notificationsReady?: boolean;
  notifications?: {
    ownerEmail?: boolean;
    emailTransportConfigured?: boolean;
    nativeInboxEnabled?: boolean;
    sink?: 'email' | 'native-inbox' | 'none';
  };
  bookingReady?: boolean;
  bindings?: { total?: number; previewReady?: number; publishReady?: number; blocked?: number };
  industryIntentCoverage?: {
    requiredTotal?: number;
    requiredSatisfied?: number;
    unsatisfiedRequired?: string[];
    forbiddenLeaked?: string[];
  } | null;
  systemType?: string | null;
}

interface ReadinessCenterPanelProps {
  /** Compiled contract (optional — falls back to manifest-only view). */
  contract: CompiledContract | null;
  /** Raw VFS file map; we pull `/.unison/launch-readiness.json`. */
  vfsFiles?: Record<string, string> | null;
  className?: string;
}

type CheckState = 'ok' | 'fail' | 'na' | 'pending';

interface CheckRow {
  label: string;
  state: CheckState;
  detail?: string;
}

interface Section {
  id: string;
  title: string;
  rows: CheckRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseManifest(vfsFiles?: Record<string, string> | null): ReadinessManifest | null {
  const raw = vfsFiles?.['/.unison/launch-readiness.json'];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReadinessManifest;
  } catch {
    return null;
  }
}

function probeStateToCheckState(s: ProbeState): CheckState {
  return s;
}


function StateIcon({ state }: { state: CheckState }) {
  if (state === 'ok') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  if (state === 'fail') return <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
  if (state === 'pending') return <Loader2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 animate-spin" />;
  return <MinusCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}


function sectionStatus(section: Section): CheckState {
  if (section.rows.some((r) => r.state === 'fail')) return 'fail';
  if (section.rows.some((r) => r.state === 'pending')) return 'pending';
  if (section.rows.every((r) => r.state === 'na')) return 'na';
  return 'ok';
}


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ReadinessCenterPanel: React.FC<ReadinessCenterPanelProps> = ({
  contract,
  vfsFiles,
  className,
}) => {
  const manifest = useMemo(() => parseManifest(vfsFiles), [vfsFiles]);

  const previewVerdict = useMemo(
    () => (contract ? PreviewGate.evaluate(contract) : null),
    [contract],
  );
  const publishVerdict = useMemo(
    () => (contract ? PublishGate.evaluate(contract) : null),
    [contract],
  );

  // --- Live probes (Track 5 v2) ---
  const [probes, setProbes] = useState<ProbeResult[] | null>(null);
  const [probing, setProbing] = useState(false);
  const [probedAt, setProbedAt] = useState<number | null>(null);

  const runProbes = useCallback(async () => {
    setProbing(true);
    try {
      const report = await runReadinessProbes();
      setProbes(report.probes);
      setProbedAt(report.finishedAt);
    } finally {
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    void runProbes();
  }, [runProbes]);



  const sections: Section[] = useMemo(() => {
    // ---- Wizard ---------------------------------------------------------
    const wizard: Section = {
      id: 'wizard',
      title: 'Wizard',
      rows: [
        {
          label: 'Industry selected',
          state: manifest?.industry ? 'ok' : 'fail',
          detail: manifest?.industry ?? 'No industry overlay set',
        },
        {
          label: 'System type',
          state: manifest?.systemType ? 'ok' : 'na',
          detail: manifest?.systemType ?? 'Generic site',
        },
        {
          label: 'Publish mode',
          state: manifest?.publishMode === 'native-first-party' ? 'ok' : 'na',
          detail: manifest?.publishMode ?? 'unknown',
        },
      ],
    };

    // ---- Frontend (contract provisioning) -------------------------------
    const prov = contract?.provisioningReport;
    const provTotal = prov ? prov.provisioned + prov.stubbed + prov.missing : 0;
    const frontend: Section = {
      id: 'frontend',
      title: 'Frontend',
      rows: contract
        ? [
            {
              label: 'Routes generated',
              state: contract.routePolicy.routes.length > 0 ? 'ok' : 'fail',
              detail: `${contract.routePolicy.routes.length} route(s)`,
            },
            {
              label: 'Slot bindings resolved',
              state: contract.slotBindingPolicy.resolved.length > 0 ? 'ok' : 'fail',
              detail: `${contract.slotBindingPolicy.resolved.length} bound`,
            },
            {
              label: 'Validation clean',
              state: contract.validation.errors === 0 ? 'ok' : 'fail',
              detail:
                contract.validation.errors > 0
                  ? `${contract.validation.errors} error(s)`
                  : `${contract.validation.warnings} warning(s)`,
            },
          ]
        : [{ label: 'Compiled contract', state: 'na', detail: 'No contract in scope' }],
    };

    // ---- Intents --------------------------------------------------------
    const coverage = manifest?.industryIntentCoverage;
    const blocked = manifest?.bindings?.blocked ?? 0;
    const intents: Section = {
      id: 'intents',
      title: 'Intents',
      rows: [
        coverage
          ? {
              label: 'Required intents satisfied',
              state:
                (coverage.requiredSatisfied ?? 0) >= (coverage.requiredTotal ?? 0)
                  ? 'ok'
                  : 'fail',
              detail: `${coverage.requiredSatisfied ?? 0}/${coverage.requiredTotal ?? 0}${
                coverage.unsatisfiedRequired?.length
                  ? ` · missing: ${coverage.unsatisfiedRequired.join(', ')}`
                  : ''
              }`,
            }
          : { label: 'Required intents', state: 'na', detail: 'No industry profile' },
        {
          label: 'No forbidden intents leaked',
          state: (coverage?.forbiddenLeaked?.length ?? 0) === 0 ? 'ok' : 'fail',
          detail: coverage?.forbiddenLeaked?.length
            ? coverage.forbiddenLeaked.join(', ')
            : 'clean',
        },
        {
          label: 'Bindings unblocked',
          state: blocked === 0 ? 'ok' : 'fail',
          detail: `${manifest?.bindings?.publishReady ?? 0}/${manifest?.bindings?.total ?? 0} publish-ready${
            blocked ? ` · ${blocked} blocked` : ''
          }`,
        },
      ],
    };

    // ---- Backend (contract provisioning summary only — read-only v1) ----
    const backend: Section = {
      id: 'backend',
      title: 'Backend',
      rows: prov
        ? [
            {
              label: 'Capabilities provisioned',
              state: prov.missing === 0 ? 'ok' : 'fail',
              detail: `${prov.provisioned}/${provTotal} live${
                prov.stubbed ? ` · ${prov.stubbed} stub` : ''
              }${prov.missing ? ` · ${prov.missing} missing` : ''}`,
            },
            {
              label: 'Required tables declared',
              state: contract && contract.requiredTables.length > 0 ? 'ok' : 'na',
              detail: contract ? `${contract.requiredTables.length} table(s)` : '—',
            },
            {
              label: 'Required workflows declared',
              state: contract && contract.requiredWorkflows.length > 0 ? 'ok' : 'na',
              detail: contract ? `${contract.requiredWorkflows.length} workflow(s)` : '—',
            },
          ]
        : [{ label: 'Provisioning report', state: 'na', detail: 'No contract in scope' }],
    };

    // ---- Notifications --------------------------------------------------
    const notif = manifest?.notifications;
    const notifications: Section = {
      id: 'notifications',
      title: 'Notifications',
      rows: [
        {
          label: 'Owner email configured',
          state: notif?.ownerEmail ? 'ok' : 'fail',
          detail: notif?.ownerEmail ? 'configured' : 'missing',
        },
        {
          label: 'Sink available',
          state:
            notif?.emailTransportConfigured || notif?.nativeInboxEnabled ? 'ok' : 'fail',
          detail: notif?.sink ?? 'none',
        },
        {
          label: 'Notifications honest-ready',
          state: manifest?.notificationsReady ? 'ok' : 'fail',
          detail: manifest?.notificationsReady
            ? 'owner can receive leads'
            : 'no reachable owner sink',
        },
      ],
    };

    // ---- Publish --------------------------------------------------------
    const publish: Section = {
      id: 'publish',
      title: 'Publish',
      rows: [
        {
          label: 'Preview gate',
          state: previewVerdict ? (previewVerdict.ok ? 'ok' : 'fail') : 'na',
          detail: previewVerdict
            ? previewVerdict.ok
              ? 'passing'
              : `${previewVerdict.reasons?.length ?? 0} blocker(s)`
            : 'no contract',
        },
        {
          label: 'Publish gate',
          state: publishVerdict ? (publishVerdict.ok ? 'ok' : 'fail') : 'na',
          detail: publishVerdict
            ? publishVerdict.ok
              ? 'passing'
              : (publishVerdict.reasons?.[0]?.message ?? 'blocked')
            : 'no contract',
        },
        {
          label: 'index.html scaffolded',
          state: vfsFiles && vfsFiles['/index.html'] ? 'ok' : 'na',
          detail: vfsFiles && vfsFiles['/index.html'] ? 'present' : 'not generated yet',
        },
      ],
    };

    // ---- Live Probes (Track 5) -----------------------------------------
    const liveProbes: Section = {
      id: 'live-probes',
      title: 'Live Probes',
      rows: probes
        ? probes.map((p) => ({
            label: p.label,
            state: probeStateToCheckState(p.state),
            detail: p.detail,
          }))
        : [
            {
              label: 'Server-side checks',
              state: probing ? 'pending' : 'na',
              detail: probing ? 'running…' : 'not run yet',
            },
          ],
    };

    return [wizard, frontend, intents, backend, notifications, publish, liveProbes];
  }, [contract, manifest, previewVerdict, publishVerdict, vfsFiles, probes, probing]);

  const overallReady = sections.every((s) => sectionStatus(s) !== 'fail');

  return (
    <Card className={cn('bg-card border-border', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Readiness Center
            <Badge variant="outline" className="text-[10px] h-4 px-1">v2 · live probes</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={runProbes}
              disabled={probing}
              title={probedAt ? `Last run ${new Date(probedAt).toLocaleTimeString()}` : 'Run live probes'}
            >
              <RefreshCw className={cn('w-3 h-3 mr-1', probing && 'animate-spin')} />
              Re-probe
            </Button>
            <Badge
              variant={overallReady ? 'default' : 'destructive'}
              className={cn('text-xs', overallReady && 'bg-primary text-primary-foreground')}
            >
              {overallReady ? 'All checks passing' : 'Action needed'}
            </Badge>
          </div>
        </div>
      </CardHeader>


      <CardContent className="space-y-3">
        {!manifest && !contract && (
          <p className="text-xs text-muted-foreground">
            No launch-readiness manifest or compiled contract found. Run the System Launcher
            wizard to populate this panel.
          </p>
        )}

        {sections.map((section, idx) => {
          const status = sectionStatus(section);
          return (
            <div key={section.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {section.title}
                </h4>
                <StateIcon state={status} />
              </div>
              <div className="space-y-1">
                {section.rows.map((row, i) => (
                  <div
                    key={`${section.id}-${i}`}
                    className="flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <StateIcon state={row.state} />
                      <span className="text-foreground/90 truncate">{row.label}</span>
                    </div>
                    {row.detail && (
                      <span className="text-muted-foreground text-[11px] truncate max-w-[55%] text-right">
                        {row.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {idx < sections.length - 1 && <Separator className="mt-2" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ReadinessCenterPanel;
