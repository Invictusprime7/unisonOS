/**
 * Playground → Launch header: the same canonical launch tasks the post-launch
 * dialog shows (deriveLaunchTasks), so both surfaces always agree.
 */
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { deriveLaunchTasks, summarizeLaunchTasks, type LaunchReadinessInput, type LaunchTask } from "@/services/playground/launchReadiness";
import { loadLaunchReadinessInput } from "@/services/playground/playgroundService";

interface Props {
  businessId?: string | null;
  projectId?: string | null;
  siteId?: string | null;
  industry?: string | null;
  systemType?: string | null;
  vfsFiles?: Record<string, string>;
  notificationEmail?: string | null;
  customDomain?: string | null;
  publishBlockers?: number;
  onOpenTask: (task: LaunchTask) => void;
}

export function LaunchTasksPanel(props: Props) {
  const { businessId, projectId, siteId, industry } = props;
  const [loaded, setLoaded] = useState<LaunchReadinessInput | null>(null);

  useEffect(() => {
    if (!businessId || !projectId || !siteId) {
      setLoaded({ siteConnected: false });
      return;
    }
    let alive = true;
    loadLaunchReadinessInput({ businessId, projectId, siteId, industry, vfsFiles: props.vfsFiles })
      .then((r) => alive && setLoaded(r))
      .catch(() => alive && setLoaded({}));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, projectId, siteId, industry]);

  const tasks = useMemo(() => deriveLaunchTasks({
    ...(loaded ?? {}),
    systemType: props.systemType,
    notificationEmail: props.notificationEmail,
    customDomain: props.customDomain,
    publishBlockers: props.publishBlockers,
  }), [loaded, props.systemType, props.notificationEmail, props.customDomain, props.publishBlockers]);
  const summary = summarizeLaunchTasks(tasks);

  return (
    <section className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Launch readiness</h3>
        <span className="text-xs text-muted-foreground">{loaded ? `${summary.ready}/${summary.total} ready` : "Checking…"}</span>
      </div>
      <Progress value={loaded ? summary.percent : 0} className="h-1.5" />
      <ul className="space-y-1">
        {tasks.map((t) => {
          const Icon = t.status === "ready" ? CheckCircle2 : t.status === "pending_verification" ? Clock : AlertCircle;
          return (
            <li key={t.id} className={cn("flex items-center gap-2 py-1", t.status === "ready" && "opacity-60")}>
              <Icon className={cn("w-4 h-4 shrink-0", t.status === "ready" ? "text-primary" : t.status === "blocked" ? "text-destructive" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{t.title}</p>
                <p className="text-xs text-muted-foreground truncate">{t.description}</p>
              </div>
              {t.status !== "ready" && t.target?.playgroundSection && t.target.playgroundSection !== "launch" && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => props.onOpenTask(t)}>
                  Open <ChevronRight className="w-3 h-3" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
