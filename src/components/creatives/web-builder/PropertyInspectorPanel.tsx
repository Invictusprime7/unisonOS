/**
 * PropertyInspectorPanel — M9 visual selection / property inspector.
 *
 * Renders the canonical, bounded controls for whatever the user clicked in the
 * live preview. Every value shown is derived by `propertyInspectorModel` from
 * the canonical registries; every action leaves as a canonical patch plan or a
 * grounded contextual AI request. The panel never writes raw CSS.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { X, LayoutGrid, Sparkles, Database, Zap, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  resolveInspectorModel,
  buildInspectorPatchPlan,
  buildContextualAIPrompt,
  type InspectorSelection,
  type InspectorPatchPlan,
} from '@/services/builder/propertyInspectorModel';
import type { VariantId } from '@/sections/variants/types';

export interface PropertyInspectorPanelProps {
  selection: InspectorSelection | null;
  onClose?: () => void;
  /** Resolves true only after the canonical mutation has been adopted by Preview. */
  onApplyPatchPlan?: (plan: Extract<InspectorPatchPlan, { ok: true }>) => boolean | Promise<boolean>;
  /** Receives a grounded contextual instruction for the in-Builder assistant. */
  onContextualAIRequest?: (prompt: string) => void;
  className?: string;
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-white/35">{children}</p>
);

export const PropertyInspectorPanel: React.FC<PropertyInspectorPanelProps> = ({
  selection,
  onClose,
  onApplyPatchPlan,
  onContextualAIRequest,
  className,
}) => {
  const model = useMemo(() => resolveInspectorModel(selection), [selection]);
  const [rejection, setRejection] = useState<string | null>(null);
  const [aiRequest, setAiRequest] = useState('');
  const [applying, setApplying] = useState(false);
  const [pendingVariantId, setPendingVariantId] = useState<VariantId | null>(null);

  useEffect(() => {
    setPendingVariantId(null);
    setRejection(null);
  }, [selection?.selector, selection?.scopeAncestors?.sectionId, selection?.scopeAncestors?.pagePath]);

  const dispatch = async (mutation: Parameters<typeof buildInspectorPatchPlan>[1]): Promise<boolean> => {
    if (applying) return false;
    const plan: InspectorPatchPlan = buildInspectorPatchPlan(model, mutation);
    if (plan.ok === false) {
      setRejection(plan.reason);
      toast.error('Inspector change unavailable', { description: plan.reason });
      return false;
    }
    setRejection(null);
    if (!onApplyPatchPlan) {
      const reason = 'This inspector is not connected to a mutation handler.';
      setRejection(reason);
      toast.error('Inspector change unavailable', { description: reason });
      return false;
    }

    setApplying(true);
    try {
      const applied = await onApplyPatchPlan(plan);
      if (!applied) setRejection('Preview did not confirm this change; see the status message for details.');
      if (applied) setPendingVariantId(null);
      return applied;
    } catch (error) {
      setRejection(error instanceof Error ? error.message : 'The change could not be applied.');
      return false;
    } finally {
      setApplying(false);
    }
  };


  return (
    <div
      className={cn(
        'w-[300px] rounded-lg border border-white/[0.08] bg-[#0d0d18]/95 shadow-xl backdrop-blur',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-3.5 w-3.5 text-violet-400/70" />
          <span className="text-xs font-medium text-white/80">Properties</span>
          <Badge variant="secondary" className="h-4 border-0 bg-violet-500/10 px-1 text-[9px] text-violet-300">
            {model.scope}
          </Badge>
          {applying && <span className="text-[10px] text-white/45">Applying...</span>}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/35 transition-colors hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ScrollArea className="max-h-[62vh]">
        <div className="space-y-3 p-3">
          {/* Identity */}
          <div className="space-y-1 rounded-md border border-white/[0.05] bg-white/[0.02] p-2 text-[11px] text-white/60">
            <p>
              Section: <span className="text-white/85">{model.sectionType ?? '—'}</span>
              {model.sectionId ? <span className="text-white/35"> · {model.sectionId}</span> : null}
            </p>
            <p>
              Design: <span className="text-white/85">{model.variantId ?? '—'}</span>
            </p>
            {model.activeSlot && (
              <p>
                Slot: <span className="text-white/85">{model.activeSlot.id}</span>{' '}
                <span className="text-white/35">({model.activeSlot.kind})</span>
              </p>
            )}
          </div>

          {model.warnings.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-500/20 bg-amber-500/[0.06] p-2">
              {model.warnings.map((warning) => (
                <p key={warning} className="flex gap-1.5 text-[10px] text-amber-200/80">
                  <AlertTriangle className="mt-[1px] h-3 w-3 shrink-0" />
                  {warning}
                </p>
              ))}
            </div>
          )}

          {/* Variant switching */}
          {model.variants.length > 0 && (
            <div>
              <SectionLabel>Design variant</SectionLabel>
              <div className="space-y-1">
                {model.variants.map((option) => {
                  const pending = pendingVariantId === option.id;
                  return (
                    <div key={option.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingVariantId((current) => option.current || current === option.id ? null : option.id);
                          setRejection(null);
                        }}
                        disabled={applying || option.current}
                        aria-pressed={pending}
                        className={cn(
                          'flex min-w-0 flex-1 items-center justify-between rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors disabled:cursor-wait disabled:opacity-50',
                          pending
                            ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-100'
                            : option.current
                              ? 'border-violet-500/60 bg-violet-500/10 text-violet-200'
                              : 'border-white/[0.06] text-white/70 hover:border-white/20 hover:bg-white/[0.04]',
                        )}
                      >
                        <span className="truncate">{option.name}</span>
                        <span className="ml-2 flex shrink-0 items-center gap-1">
                          {option.certified && (
                            <Badge variant="secondary" className="h-4 border-0 bg-emerald-500/10 px-1 text-[9px] text-emerald-300">
                              21st
                            </Badge>
                          )}
                          {option.current && <span className="text-[9px] text-white/45">Current</span>}
                        </span>
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Confirm ${option.name}`}
                        title={`Apply ${option.name}`}
                        disabled={!pending || applying}
                        onClick={() => void dispatch({ kind: 'variant', variantId: option.id as VariantId })}
                        className="h-7 w-7 shrink-0 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 disabled:opacity-25"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Slots */}
          {model.slots.length > 0 && (
            <div>
              <SectionLabel>Editable slots</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {model.slots.map((slot) => (
                  <Badge
                    key={slot.id}
                    variant="secondary"
                    className={cn(
                      'h-5 border-0 px-1.5 text-[9px]',
                      slot.editable ? 'bg-white/[0.06] text-white/70' : 'bg-white/[0.03] text-white/35',
                      model.activeSlot?.id === slot.id && 'bg-violet-500/15 text-violet-200',
                    )}
                    title={`${slot.kind}${slot.required ? ' · required' : ''}${slot.editable ? '' : ' · locked'}`}
                  >
                    {slot.id}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* States */}
          {model.states && (
            <div>
              <SectionLabel>Interaction states</SectionLabel>
              <p className="text-[10px] text-white/55">{model.states.supported.join(' · ')}</p>
              <p className="mt-1 text-[10px] text-white/35">
                hover {model.states.interaction.hover} · focus {model.states.interaction.focus} · reduced motion{' '}
                {model.states.interaction.reducedMotion}
              </p>
            </div>
          )}

          {/* Data + intents */}
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-white/55">
              <Database className="h-3 w-3 text-white/35" />
              {model.dataSource === 'catalog'
                ? `Connected data · ${model.catalogSurfaceId}`
                : 'Static content'}
            </div>
            {model.intents.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-white/55">
                <Zap className="h-3 w-3 text-white/35" />
                {model.intents.map((intent) => (
                  <Badge
                    key={intent}
                    variant="secondary"
                    className={cn(
                      'h-4 border-0 px-1 text-[9px]',
                      model.activeIntent === intent
                        ? 'bg-violet-500/15 text-violet-200'
                        : 'bg-white/[0.06] text-white/60',
                    )}
                  >
                    {intent}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Contextual AI edit */}
          {onContextualAIRequest && (
            <div>
              <SectionLabel>Ask AI about this selection</SectionLabel>
              <div className="flex gap-1.5">
                <Input
                  value={aiRequest}
                  onChange={(event) => setAiRequest(event.target.value)}
                  placeholder="e.g. make this headline punchier"
                  className="h-7 border-white/[0.08] bg-white/[0.03] text-[11px] text-white/80"
                />
                <Button
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  disabled={!aiRequest.trim()}
                  onClick={() => {
                    onContextualAIRequest(buildContextualAIPrompt(model, aiRequest));
                    setAiRequest('');
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {rejection && (
            <p className="rounded-md border border-rose-500/20 bg-rose-500/[0.06] p-2 text-[10px] text-rose-200/85">
              {rejection}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PropertyInspectorPanel;
