/**
 * WorkflowActivityFeed
 *
 * Live timeline of incoming GoHighLevel webhook events for the current
 * business. Consumes useGhlWebhookEvents to render a real-time feed of
 * contact/opportunity/workflow stage changes inside the CRM dashboard.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, User, Target, Workflow, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGhlWebhookEvents, type GhlWebhookEvent } from "@/hooks/useGhlWebhookEvents";
import { naturalLanguageEventLabel, naturalLanguageRecordLabel } from "@/services/resources/recordIdentity";

interface WorkflowActivityFeedProps {
  projectId?: string | null;
  limit?: number;
}

type Filter = "all" | "contact" | "opportunity" | "workflow";

function classifyEvent(evt: GhlWebhookEvent): Filter {
  if (evt.workflow_id) return "workflow";
  if (evt.opportunity_id) return "opportunity";
  if (evt.contact_id) return "contact";
  if (/workflow/i.test(evt.event_type)) return "workflow";
  if (/opportunity/i.test(evt.event_type)) return "opportunity";
  return "contact";
}

function relativeTime(ts: string): string {
  const diffMs = Date.now() - new Date(ts).getTime();
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function describeEvent(evt: GhlWebhookEvent): string {
  const p = evt.payload as Record<string, unknown> | null;
  const name = naturalLanguageRecordLabel(p, evt.contact_id ? "Contact" : "Unknown contact");
  switch (evt.event_type) {
    case "ContactCreate":
    case "contact.create":
      return `Contact ${name} created`;
    case "OpportunityStageChange":
    case "opportunity.stage.change":
      {
        const stageName = naturalLanguageRecordLabel({ name: p?.stageName ?? p?.stage_name ?? p?.pipelineStageName }, "");
        return stageName ? `Opportunity moved to ${stageName}` : "Opportunity stage changed";
      }
    case "WorkflowFire":
    case "workflow.fire":
      {
        const workflowName = naturalLanguageRecordLabel({ name: p?.workflowName ?? p?.workflow_name }, "");
        return `${workflowName || "Workflow"} started for ${name}`;
      }
    default:
      return `${naturalLanguageEventLabel(evt.event_type)}${evt.contact_id ? ` • ${name}` : ""}`;
  }
}

const FILTER_OPTIONS: { id: Filter; label: string; icon: typeof User }[] = [
  { id: "all", label: "All", icon: Activity },
  { id: "contact", label: "Contacts", icon: User },
  { id: "opportunity", label: "Opportunities", icon: Target },
  { id: "workflow", label: "Workflows", icon: Workflow },
];

export function WorkflowActivityFeed({ projectId, limit = 25 }: WorkflowActivityFeedProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const { events, loading, refresh } = useGhlWebhookEvents({ projectId, limit });

  const visible = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => classifyEvent(e) === filter);
  }, [events, filter]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-cyan-500" />
          Workflow Activity
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} title="Refresh">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = filter === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setFilter(opt.id)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                <Icon className="h-3 w-3" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {!projectId ? (
          <p className="text-sm text-muted-foreground">No project selected.</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {filter === "all" ? "" : `${filter} `}events yet. They will stream in here as soon as your GoHighLevel workflows fire.
          </p>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {visible.map((evt) => {
              const kind = classifyEvent(evt);
              return (
                <div
                  key={evt.id}
                  className="flex items-start justify-between gap-3 p-3 bg-muted/40 rounded-lg border border-border/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {kind}
                      </Badge>
                      {!evt.processed && (
                        <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                          new
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{describeEvent(evt)}</p>
                    {evt.contact_id && (
                      <p className="text-xs text-muted-foreground truncate">
                        Contact: {naturalLanguageRecordLabel(evt.payload, "Contact")}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {relativeTime(evt.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WorkflowActivityFeed;
