import { useState, useCallback, useRef, useEffect } from "react";
import { Settings2, Zap, Sparkles, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_GEMINI_MODEL_ID, DEFAULT_GEMINI_MODEL_LABEL } from '@/config/aiModels';
import type { GatewayConfig } from '@/services/app-builder/appBuilderAISettings';
export type { GatewayConfig } from '@/services/app-builder/appBuilderAISettings';

export interface GatewayModel {
  id: string;
  label: string;
  tier: "lite" | "fast" | "standard" | "pro";
  supportsReasoning: boolean;
}

const AVAILABLE_MODELS: GatewayModel[] = [
  { id: DEFAULT_GEMINI_MODEL_ID, label: DEFAULT_GEMINI_MODEL_LABEL, tier: "pro", supportsReasoning: true },
];

export type ReasoningEffort = "none" | "low" | "medium" | "high";

const DEFAULT_CONFIG: GatewayConfig = {
  selectedModelId: DEFAULT_GEMINI_MODEL_ID,
  reasoningEffort: "medium",
  timeoutMs: 110000,
  autoModelSelection: true,
  streamResponse: true,
  maxTokens: 32768,
};

interface AIGatewayOptionsProps {
  config?: GatewayConfig;
  onChange?: (config: GatewayConfig) => void;
  className?: string;
}

const REASONING: { value: ReasoningEffort; label: string }[] = [
  { value: "none", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Med" },
  { value: "high", label: "High" },
];

export const AIGatewayOptions = ({ config: ext, onChange, className }: AIGatewayOptionsProps) => {
  const [internal, setInternal] = useState<GatewayConfig>(DEFAULT_CONFIG);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const cfg = ext ?? internal;
  const update = useCallback(
    (patch: Partial<GatewayConfig>) => {
      const next = { ...cfg, ...patch };
      if (onChange) onChange(next);
      else setInternal(next);
    },
    [cfg, onChange],
  );

  const model = AVAILABLE_MODELS.find((m) => m.id === cfg.selectedModelId);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger — tiny icon button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <Settings2 className="h-3 w-3" />
        <span className="hidden sm:inline">{cfg.autoModelSelection ? "Auto" : model?.label}</span>
      </button>

      {/* Tiny modal */}
      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-56 rounded-lg border border-border bg-popover p-2.5 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Auto toggle */}
          <label className="flex items-center justify-between gap-2 py-1 cursor-pointer">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Auto-select
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={cfg.autoModelSelection}
              onClick={() => update({ autoModelSelection: !cfg.autoModelSelection })}
              className={cn(
                "relative h-4 w-7 rounded-full transition-colors",
                cfg.autoModelSelection ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-primary-foreground transition-transform",
                  cfg.autoModelSelection && "translate-x-3",
                )}
              />
            </button>
          </label>

          {/* Divider */}
          <div className="h-px bg-border my-1.5" />

          {/* Model list */}
          <div className="space-y-0.5 max-h-36 overflow-y-auto">
            {AVAILABLE_MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={cfg.autoModelSelection}
                onClick={() => update({ selectedModelId: m.id, maxTokens: 64000 })}
                className={cn(
                  "w-full flex items-center gap-2 px-1.5 py-1 rounded text-[11px] transition-colors text-left",
                  cfg.selectedModelId === m.id && !cfg.autoModelSelection
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/70 hover:bg-muted/60",
                  cfg.autoModelSelection && "opacity-40 pointer-events-none",
                )}
              >
                <Zap className="h-3 w-3 shrink-0" />
                {m.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-border my-1.5" />

          {/* Reasoning */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground font-medium">Reasoning</span>
            <div className="flex gap-0.5">
              {REASONING.map((r) => {
                const disabled = !model?.supportsReasoning && r.value !== "none";
                return (
                  <button
                    key={r.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => update({ reasoningEffort: r.value })}
                    className={cn(
                      "flex-1 py-0.5 rounded text-[10px] font-medium transition-colors",
                      cfg.reasoningEffort === r.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted",
                      disabled && "opacity-30 pointer-events-none",
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={() => update(DEFAULT_CONFIG)}
            className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export { AVAILABLE_MODELS, DEFAULT_CONFIG };
