/**
 * RecentProjectCard - Live preview thumbnail card for recent projects
 * 
 * Renders the template HTML inside a scaled-down iframe once on load,
 * giving users a real "window" into their project.
 */

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecentProjectCardProps {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
  /** Raw HTML from canvas_data to render in the preview iframe */
  previewHtml: string | null;
  onClick: () => void;
}

export function RecentProjectCard({
  id,
  name,
  description,
  isPublic,
  updatedAt,
  previewHtml,
  onClick,
}: RecentProjectCardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const formattedDate = new Date(updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col rounded-xl border border-border bg-card text-left",
        "overflow-hidden transition-all duration-200",
        "hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {/* Live preview window */}
      <div className="relative w-full aspect-[16/10] bg-muted overflow-hidden">
        {previewHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={previewHtml}
            title={`Preview of ${name}`}
            className="absolute inset-0 w-[1280px] h-[800px] origin-top-left border-0 pointer-events-none"
            style={{
              transform: "scale(0.22)",
              transformOrigin: "top left",
            }}
            sandbox="allow-scripts"
            loading="lazy"
            tabIndex={-1}
          />
        ) : (
          // No stored snapshot: show a distinctive identity tile so saved
          // sites are still distinguishable at a glance.
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/15 via-muted to-accent/10">
            <div className="w-12 h-12 rounded-xl bg-background/80 border border-border shadow-sm flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {(name || "U").trim().charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs font-medium text-foreground/70 max-w-[80%] truncate">
              {name || "Untitled Project"}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Open to see latest version
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-200 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 text-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-sm border border-border">
            Open in Builder
          </span>
        </div>
      </div>

      {/* Card info */}
      <div className="flex-1 p-3 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-card-foreground truncate group-hover:text-primary transition-colors">
            {name || "Untitled Project"}
          </h3>
          <Badge
            variant={isPublic ? "default" : "secondary"}
            className="text-[10px] px-1.5 py-0 shrink-0"
          >
            {isPublic ? "Public" : "Private"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formattedDate}
        </p>
      </div>
    </button>
  );
}
