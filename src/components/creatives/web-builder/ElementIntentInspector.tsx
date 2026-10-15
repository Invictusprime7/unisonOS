/**
 * Element Intent Inspector
 * 
 * Shows when a user clicks an element in the preview.
 * Displays:
 * - Current intent binding
 * - Attached workflows/recipes
 * - Test trigger button
 * - Quick workflow attachment
 */

import { useState, useEffect } from "react";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase = supabaseClient as any;
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Zap, 
  Play, 
  Link2,
  Check,
  Workflow,
  X,
  Settings2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { handleIntent } from "@/runtime/intentRouter";
import { AUTOMATION_INTENTS, ACTION_INTENTS, isAutomationIntent, isActionIntent } from "@/platform/core/coreIntents";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ElementSelection {
  elementKey: string;
  elementLabel: string;
  selector?: string;
  tagName?: string;
  intent?: string;
  confidence?: number;
  payloadKeys?: string[];
  rect?: DOMRect;
}

interface Workflow {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  is_active: boolean;
}

interface ElementIntentInspectorProps {
  selection: ElementSelection | null;
  businessId?: string | null;
  projectId?: string | null;
  pagePath?: string;
  position?: { x: number; y: number };
  onClose: () => void;
  onTestIntent?: (intent: string, payload: Record<string, unknown>) => void;
}

export function ElementIntentInspector({
  selection,
  businessId,
  projectId,
  pagePath = '/',
  position,
  onClose,
  onTestIntent,
}: ElementIntentInspectorProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [intentOverride, setIntentOverride] = useState<string>("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bindingId, setBindingId] = useState<string | null>(null);
  const [pendingUnwire, setPendingUnwire] = useState(false);
  const [executionLog, setExecutionLog] = useState<Array<{ id: string; intent: string; result_status: string; created_at: string; error_message: string | null; execution_time_ms: number | null }>>([]);
  const [ghlEvents, setGhlEvents] = useState<Array<{ id: string; event_type: string; created_at: string; contact_id: string | null }>>([]);

  // Fetch available workflows
  useEffect(() => {
    async function fetchWorkflows() {
      if (!businessId) return;
      
      try {
        const { data } = await supabase
          .from("crm_workflows")
          .select("id, name, trigger_type, trigger_config, is_active")
          .eq("is_active", true)
          .order("name");
        
        setWorkflows((data || []) as Workflow[]);
      } catch (e) {
        console.error("Error fetching workflows:", e);
      }
    }
    
    fetchWorkflows();
  }, [businessId]);

  // Load existing binding for this element
  useEffect(() => {
    async function loadBinding() {
      setPendingUnwire(false);
      if (!selection || !projectId) return;
      
      setLoading(true);
      try {
        const { data } = await supabase
          .from("site_intent_bindings")
          .select("id, workflow_id, intent, enabled")
          .eq("project_id", projectId)
          .eq("page_path", pagePath)
          .eq("element_key", selection.elementKey)
          .maybeSingle();

        if (data) {
          setBindingId(data.id);
          setSelectedWorkflowId(data.workflow_id);
          setIntentOverride(data.intent || "");
          setEnabled(data.enabled);
        } else {
          // Reset for new element
          setBindingId(null);
          setSelectedWorkflowId(null);
          setIntentOverride(selection.intent || "");
          setEnabled(true);
        }
      } catch (e) {
        console.error("Error loading binding:", e);
      } finally {
        setLoading(false);
      }
    }
    
    loadBinding();
  }, [selection?.elementKey, projectId, pagePath]);

  // Load recent execution log entries for this binding/intent
  useEffect(() => {
    async function loadLog() {
      if (!businessId) return;
      const intentForQuery = intentOverride || selection?.intent;
      if (!intentForQuery && !bindingId) { setExecutionLog([]); return; }
      try {
        let q = supabase
          .from("intent_execution_log")
          .select("id, intent, result_status, created_at, error_message, execution_time_ms")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(8);
        if (bindingId) q = q.eq("binding_id", bindingId);
        else if (intentForQuery) q = q.eq("intent", intentForQuery);
        const { data } = await q;
        setExecutionLog((data || []) as typeof executionLog);
      } catch (e) {
        console.error("Error loading execution log:", e);
      }
    }
    loadLog();
  }, [businessId, bindingId, intentOverride, selection?.intent]);

  // Load latest GHL webhook events for context
  useEffect(() => {
    async function loadGhl() {
      if (!businessId) return;
      try {
        const { data } = await supabase
          .from("ghl_webhook_events")
          .select("id, event_type, created_at, contact_id")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(5);
        setGhlEvents((data || []) as typeof ghlEvents);
      } catch (e) {
        console.error("Error loading GHL events:", e);
      }
    }
    loadGhl();
  }, [businessId, selection?.elementKey]);

  if (!selection) return null;

  const effectiveIntent = intentOverride || selection.intent || "";
  const hasIntent = !!effectiveIntent;
  const isWired = hasIntent && (selectedWorkflowId || isAutomationIntent(effectiveIntent) || isActionIntent(effectiveIntent));

  // Save binding
  async function saveBinding() {
    if (!selection || !projectId || !businessId) {
      toast.error("Cannot save without project context");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("site_intent_bindings")
        .upsert({
          business_id: businessId,
          project_id: projectId,
          page_path: pagePath,
          element_key: selection.elementKey,
          element_label: selection.elementLabel,
          intent: intentOverride || selection.intent || "button.click",
          intent_confidence: intentOverride ? 1.0 : (selection.confidence || 0.8),
          workflow_id: selectedWorkflowId || null,
          enabled,
          payload_schema: Object.fromEntries((selection.payloadKeys || []).map(k => [k, true])),
        }, {
          onConflict: "project_id,page_path,element_key",
        });

      if (error) throw error;
      toast.success("Element binding saved");
    } catch (error) {
      console.error("Error saving binding:", error);
      toast.error("Failed to save binding");
    } finally {
      setSaving(false);
    }
  }

  // Test fire this element's intent
  function testFire() {
    if (!effectiveIntent) {
      toast.error("No intent to test");
      return;
    }

    const payload: Record<string, unknown> = {
      _test: true,
      _elementKey: selection.elementKey,
      businessId,
    };

    if (onTestIntent) {
      onTestIntent(effectiveIntent, payload);
    } else {
      handleIntent(effectiveIntent, payload);
    }

    toast.info(`Testing: ${effectiveIntent}`);
  }

  // Position the inspector next to the element
  const style: React.CSSProperties = position ? {
    position: 'fixed',
    left: Math.min(position.x + 10, window.innerWidth - 340),
    top: Math.min(position.y, window.innerHeight - 400),
    zIndex: 9999,
  } : {};

  return (
    <div
      className={cn(
        "w-80 bg-[#0d0d18] border border-cyan-500/40 rounded-lg shadow-2xl overflow-hidden",
        "shadow-[0_0_30px_rgba(0,255,255,0.2)]"
      )}
      style={style}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-purple-500/10">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-cyan-400">Element Inspector</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-4">
        {/* Element info */}
        <div>
          <Label className="text-xs text-gray-400 mb-1 block">Element</Label>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
              {selection.tagName || 'element'}
            </Badge>
            <span className="text-sm text-white truncate" title={selection.elementLabel}>
              {selection.elementLabel || selection.elementKey}
            </span>
          </div>
        </div>

        {/* Current intent */}
        <div>
          <Label className="text-xs text-gray-400 mb-1 block">
            Intent
            {selection.confidence && selection.confidence < 1 && (
              <span className="ml-1 text-orange-400">
                (~{Math.round(selection.confidence * 100)}% confidence)
              </span>
            )}
          </Label>
          <Select
            value={intentOverride || selection.intent || ""}
            onValueChange={setIntentOverride}
          >
            <SelectTrigger className="bg-[#0a0a14] border-cyan-500/20 text-sm">
              <SelectValue placeholder="Select intent..." />
            </SelectTrigger>
            <SelectContent>
              {selection.intent && !AUTOMATION_INTENTS.includes(selection.intent as any) && !ACTION_INTENTS.includes(selection.intent as any) && (
                <SelectItem value={selection.intent}>
                  {selection.intent} (detected)
                </SelectItem>
              )}
              <SelectItem value="__automation_header__" disabled>-- Automation Intents --</SelectItem>
              {AUTOMATION_INTENTS.map((intent) => (
                <SelectItem key={intent} value={intent}>{intent}</SelectItem>
              ))}
              <SelectItem value="__action_header__" disabled>-- Action Intents --</SelectItem>
              {ACTION_INTENTS.map((intent) => (
                <SelectItem key={intent} value={intent}>{intent}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Workflow binding */}
        <div>
          <Label className="text-xs text-gray-400 mb-1 block">Run Workflow</Label>
          <Select
            value={selectedWorkflowId || "none"}
            onValueChange={(v) => setSelectedWorkflowId(v === "none" ? null : v)}
          >
            <SelectTrigger className="bg-[#0a0a14] border-cyan-500/20 text-sm">
              <SelectValue placeholder="No workflow" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No workflow</SelectItem>
              {workflows.map(w => (
                <SelectItem key={w.id} value={w.id}>
                  <div className="flex items-center gap-2">
                    <Workflow className="h-3 w-3" />
                    {w.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {workflows.length === 0 && businessId && (
            <p className="text-[10px] text-gray-500 mt-1">
              No workflows yet. Create one in CRM → Workflows
            </p>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isWired ? (
              <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Wired
              </Badge>
            ) : hasIntent ? (
              <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unbound
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-gray-500/20 text-gray-400 border-gray-500/30">
                No Intent
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-400">Enable</Label>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              className="scale-75"
            />
          </div>
        </div>

        {/* Payload keys */}
        {selection.payloadKeys && selection.payloadKeys.length > 0 && (
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Payload Keys</Label>
            <div className="flex flex-wrap gap-1">
              {selection.payloadKeys.map(key => (
                <span key={key} className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                  {key}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent execution log */}
        <div>
          <Label className="text-xs text-gray-400 mb-1 block">Recent Executions</Label>
          {executionLog.length === 0 ? (
            <p className="text-[10px] text-gray-500">No executions yet</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {executionLog.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-[10px] bg-[#0a0a14] px-2 py-1 rounded">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {log.result_status === 'success' ? (
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-400 shrink-0" />
                    ) : (
                      <AlertCircle className="h-2.5 w-2.5 text-red-400 shrink-0" />
                    )}
                    <span className="text-gray-300 truncate" title={log.error_message || log.intent}>
                      {log.intent}
                    </span>
                  </div>
                  <span className="text-gray-500 shrink-0 ml-2">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest GHL events (workflow context) */}
        {ghlEvents.length > 0 && (
          <div>
            <Label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              <Workflow className="h-3 w-3" /> Latest GHL Events
            </Label>
            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
              {ghlEvents.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between text-[10px] bg-purple-500/5 border border-purple-500/20 px-2 py-1 rounded">
                  <span className="text-purple-300 truncate" title={evt.contact_id || ''}>
                    {evt.event_type}
                  </span>
                  <span className="text-gray-500 shrink-0 ml-2">
                    {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-cyan-500/20 flex gap-2 flex-wrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-cyan-500/30 hover:bg-cyan-500/10"
                onClick={testFire}
                disabled={!hasIntent}
              >
                <Play className="h-3 w-3 mr-1" />
                Test
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Fire this intent to test automation</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {bindingId && (
          pendingUnwire ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cancel unwire"
                title="Cancel unwire"
                disabled={saving}
                onClick={() => setPendingUnwire(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Confirm unwire"
                title="Confirm unwire"
                className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                disabled={saving}
                onClick={async () => {
                  if (!bindingId || saving) return;
                  setSaving(true);
                  try {
                    const { error } = await supabase
                      .from("site_intent_bindings")
                      .delete()
                      .eq("id", bindingId);
                    if (error) throw error;
                    setBindingId(null);
                    setSelectedWorkflowId(null);
                    setPendingUnwire(false);
                    toast.success("Unwired");
                  } catch {
                    toast.error("Failed to unwire");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              disabled={saving}
              onClick={() => setPendingUnwire(true)}
            >
              <Link2 className="mr-1 h-3 w-3" />
              Unwire
            </Button>
          )
        )}

        <Button
          size="icon"
          aria-label="Confirm intent changes"
          title="Save intent changes"
          className="bg-cyan-500 hover:bg-cyan-600 text-black"
          onClick={saveBinding}
          disabled={saving || !businessId}
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default ElementIntentInspector;
