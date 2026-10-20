import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RecentProjectCard } from "@/components/home/RecentProjectCard";
import { FolderOpen, ArrowRight, Zap, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface RecentProject {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  updated_at: string;
  created_at: string;
  canvas_data: any;
  /** Canonical Cloud identity carried from builder_drafts. */
  project_id?: string | null;
  business_id?: string | null;
  revision_id?: string | null;
  draft_id?: string | null;
}

interface RecentProjectsSectionProps {
  projects: RecentProject[];
  loading: boolean;
  onStartLauncher: () => void;
}

/** The collapsed/expanded choice is per browser, not per account. */
const COLLAPSE_STORAGE_KEY = "unison.home.projectsCollapsed";

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsedPreference(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage can be unavailable (private mode); the in-memory state still works.
  }
}

export function RecentProjectsSection({ projects, loading, onStartLauncher }: RecentProjectsSectionProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsedPreference);

  const applyCollapsed = (next: boolean) => {
    writeCollapsedPreference(next);
    setCollapsed(next);
  };

  return (
    <section className="container mx-auto px-4 py-8 sm:py-12 border-b border-white/5">
      <Collapsible open={!collapsed} onOpenChange={(open) => applyCollapsed(!open)}>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <CollapsibleTrigger
            aria-label={collapsed ? "Expand your projects" : "Collapse your projects"}
            className={cn(
              "group flex items-center gap-2 rounded-md -ml-2 px-2 py-1 text-left",
              "transition-colors hover:bg-white/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 text-white/30 transition-transform duration-200 group-hover:text-white/60",
                collapsed && "-rotate-90"
              )}
            />
            <FolderOpen className="h-4 w-4 text-cyan-400" />
            <h2 className="text-base font-semibold text-white/80">Your Projects</h2>
            {!loading && projects.length > 0 && (
              <span className="text-xs text-white/30">{projects.length}</span>
            )}
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/cloud")}
            className="text-white/30 hover:text-white/60 hover:bg-white/5 text-xs gap-1.5"
          >
            View All
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {!collapsed && (
          <CollapsibleContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-white/30 text-sm gap-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400" />
                Loading projects...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {projects.map((project) => {
                  const canvasData = project.canvas_data as { html?: string; previewCode?: string } | null;
                  const previewHtml = canvasData?.previewCode || canvasData?.html || null;
                  return (
                    <RecentProjectCard
                      key={project.id}
                      id={project.id}
                      name={project.name}
                      description={project.description}
                      isPublic={project.is_public}
                      updatedAt={project.updated_at}
                      previewHtml={previewHtml}
                      onClick={() => navigate(`/web-builder?id=${project.draft_id || project.id}`, {
                        state: {
                          draftId: project.draft_id || undefined,
                          projectId: project.project_id || undefined,
                          businessId: project.business_id || undefined,
                          revisionId: project.revision_id || undefined,
                          projectName: project.name,
                          from: 'Home projects',
                        },
                      })}
                    />
                  );
                })}

                {/* New Project tile */}
                <button
                  onClick={onStartLauncher}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl border border-dashed border-cyan-500/20 bg-white/[0.02] min-h-[140px] cursor-pointer",
                    "hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:shadow-[0_0_20px_rgba(0,200,255,0.1)]",
                    "transition-all text-white/30 hover:text-cyan-400"
                  )}
                >
                  <Zap className="h-6 w-6 mb-2" />
                  <span className="text-xs font-medium">New Site</span>
                  <span className="text-[10px] text-white/20 mt-0.5">Wizard launcher</span>
                </button>
              </div>
            )}
          </CollapsibleContent>
        )}
      </Collapsible>
    </section>
  );
}
