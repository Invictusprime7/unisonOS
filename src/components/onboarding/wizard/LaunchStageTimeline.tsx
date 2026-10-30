/**
 * Launch Stage Timeline — the wizard's canonical generation surface.
 *
 * Renders the canonical launch stage model (`launchRun.ts`) live: every stage,
 * its status, how long it took, and every recorded degradation. This is the
 * only place the wizard reports pipeline progress — no toasts, no hidden work.
 */

import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import './launchProgress.css';
import type {
  LaunchRunSnapshot,
  LaunchStageState,
  LaunchStageStatus,
} from "@/services/launch/launchRun";

const STAGE_HINT: Record<string, string> = {
  plan: "Planning pages",
  contract: "Planning the application",
  "app-build": "Designing each page",
  enrich: "Finalizing the design",
  preflight: "Checking every page",
  commit: "Saving your project",
  handoff: "Opening the builder",
};

function statusIcon(status: LaunchStageStatus) {
  switch (status) {
    case "done":
      return <Check className="launch-progress-icon" aria-hidden="true" />;
    case "active":
      return (
        <Loader2 className="launch-progress-icon motion-safe:animate-spin" aria-hidden="true" />
      );
    case "degraded":
      return <Sparkles className="launch-progress-icon" aria-hidden="true" />;
    case "failed":
      return <AlertCircle className="launch-progress-icon" aria-hidden="true" />;
    default:
      return <span className="launch-progress-icon" aria-hidden="true">·</span>;
  }
}

function duration(stage: LaunchStageState): string | null {
  if (!stage.startedAt) return null;
  const end = stage.endedAt ?? Date.now();
  const seconds = Math.max(0, Math.round((end - stage.startedAt) / 1000));
  if (stage.status === "active") return `${seconds}s…`;
  return `${seconds}s`;
}

export interface LaunchStageTimelineProps {
  snapshot: LaunchRunSnapshot;
  statusText?: string;
  className?: string;
  activity?: readonly string[];
  generationMode?: 'ai' | 'deterministic';
}

export const LaunchStageTimeline = ({
  snapshot,
  statusText,
  className,
  activity = [],
  generationMode = 'ai',
}: LaunchStageTimelineProps) => {
  // Re-render every second so running-stage timers advance between backend events.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const activeStage = snapshot.stages.find(
    (stage) => stage.status === "active",
  );
  const failedStage = snapshot.stages.find(
    (stage) => stage.status === "failed",
  );
  const finished = snapshot.stages.length > 0 && snapshot.stages.every(
    (stage) => stage.status === "done" || stage.status === "degraded",
  );
  const completed = snapshot.stages.filter(stage => stage.status === 'done' || stage.status === 'degraded').length;
  return (
    <div className={cn("launch-progress", className)} aria-busy={!failedStage && !finished}>
      <div className="launch-progress-header">
        <div className="launch-progress-label"><Sparkles className="launch-progress-icon" aria-hidden="true" />{generationMode === 'deterministic' ? 'Building your deterministic starter' : 'Affinity · Creating your site'}</div>
        <h2 role="status">
          {failedStage ? "Creation paused" : finished ? "Ready to review" : activeStage ? STAGE_HINT[activeStage.name] : "Preparing your project"}
        </h2>
        <p className="launch-progress-muted" role="status">{failedStage ? "Review the message and try again." : statusText || "Preparing your project…"}</p>
      </div>
      {snapshot.stages.length > 0 && <div>
        <div className="launch-progress-meter" role="progressbar" aria-label="Launch steps completed" aria-valuemin={0} aria-valuemax={snapshot.stages.length} aria-valuenow={completed} aria-valuetext={`${completed} of ${snapshot.stages.length} launch steps completed`}>
          {snapshot.stages.map(stage => <span key={stage.name} className="launch-progress-segment" data-complete={stage.status === 'done' || stage.status === 'degraded'} data-active={stage.status === 'active'} />)}
        </div>
        <p className="launch-progress-muted">{completed} of {snapshot.stages.length} steps completed</p>
      </div>}
      <ol className="launch-progress-stages">
        {snapshot.stages.map((stage, index) => {
          const time = duration(stage);
          const visible = stage.status !== "pending" || index <= Math.max(0, snapshot.stages.findIndex((entry) => entry.status === "active") + 1);
          if (!visible) return null;
          return (
            <li key={stage.name} className="launch-progress-stage" data-status={stage.status} aria-current={stage.status === 'active' ? 'step' : undefined}>
              {statusIcon(stage.status)}
              <span className="launch-progress-stage-name">{STAGE_HINT[stage.name] ?? stage.label}</span>
              {time && <span className="launch-progress-time">{time}</span>}
            </li>
          );
        })}
      </ol>
      {activity.length > 0 && <div className="launch-progress-activity" role="log" aria-label="Affinity launch activity" aria-live="polite" aria-relevant="additions" aria-atomic="false">
        {activity.map((message, index) => <p key={`${index}-${message}`} className={index === activity.length - 1 ? undefined : 'launch-progress-muted'}>{message}</p>)}
      </div>}
      {snapshot.degradations.length > 0 && <div className="launch-progress-notes">{snapshot.degradations.map((note, index) => <p key={`${note.code}-${index}`} className="launch-progress-muted">{note.message}</p>)}</div>}
    </div>
  );
};

export default LaunchStageTimeline;
