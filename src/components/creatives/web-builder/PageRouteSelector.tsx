import { useMemo } from "react";
import { AlertTriangle, ChevronDown, Eye, EyeOff, FileText, Home, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BuilderPage, PageRegistry } from "@/types/pageRegistry";

interface PageRouteSelectorProps {
  activePagePath: string;
  activePageId?: string | null;
  activePreviewRoute?: string;
  pageRegistry: PageRegistry;
  onNavigateToPage: (pageId: string) => void;
  onToggleNavVisibility: (pageId: string, visible: boolean) => void;
  onSetHomePage: (pageId: string) => void;
  onAddPage: () => void;
  onOpenPlayground: () => void;
  routeConflicts?: string[];
}

export function PageRouteSelector({
  activePagePath,
  activePageId,
  activePreviewRoute,
  pageRegistry,
  onNavigateToPage,
  onToggleNavVisibility,
  onSetHomePage,
  onAddPage,
  onOpenPlayground,
  routeConflicts = [],
}: PageRouteSelectorProps) {
  const pages = useMemo(
    () => Object.values(pageRegistry.pages).sort((a, b) => a.navOrder - b.navOrder),
    [pageRegistry.pages],
  );
  const activePage = useMemo<BuilderPage | null>(() => {
    if (activePageId && pageRegistry.pages[activePageId]) return pageRegistry.pages[activePageId];
    if (activePreviewRoute) {
      const byRoute = pages.find((page) => page.path === activePreviewRoute);
      if (byRoute) return byRoute;
    }
    return pages.find((page) => page.filePath === activePagePath)
      ?? pages.find((page) => page.isHome)
      ?? null;
  }, [activePageId, activePagePath, activePreviewRoute, pageRegistry.pages, pages]);
  const route = activePage?.path || activePreviewRoute || "/";
  const hasConflict = routeConflicts.includes(route.toLowerCase());

  return (
    <div className="flex min-w-0 items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 min-w-0 max-w-[120px] gap-1.5 rounded-full border border-white/[0.08] bg-[#0f0f11] px-2 text-xs text-[#e4e4e7] hover:bg-[#18181b] hover:text-white sm:max-w-[220px] sm:gap-2 sm:px-3 lg:max-w-[320px]"
            aria-label={`Current route ${route}`}
          >
            {hasConflict && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
            <span className="truncate font-mono">{route}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-64 border-white/[0.08] bg-[#0f0f11] text-[#e4e4e7]">
          {pages.map((page) => (
            <DropdownMenuItem
              key={page.pageId}
              onClick={() => onNavigateToPage(page.pageId)}
              className="gap-2 text-xs focus:bg-white/10 focus:text-white"
            >
              {page.isHome ? <Home className="h-3.5 w-3.5 text-white/60" /> : <FileText className="h-3.5 w-3.5 text-white/60" />}
              <span className="min-w-0 flex-1 truncate">{page.title}</span>
              <span className="max-w-24 truncate font-mono text-[10px] text-white/40">{page.path}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={onAddPage} className="gap-2 text-xs focus:bg-white/10 focus:text-white">
            <Plus className="h-3.5 w-3.5" /> Add page
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenPlayground} className="gap-2 text-xs focus:bg-white/10 focus:text-white">
            <Settings className="h-3.5 w-3.5" /> Manage pages
          </DropdownMenuItem>
          {activePage && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              {!activePage.isHome && (
                <DropdownMenuItem onClick={() => onSetHomePage(activePage.pageId)} className="gap-2 text-xs focus:bg-white/10 focus:text-white">
                  <Home className="h-3.5 w-3.5" /> Set as homepage
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onToggleNavVisibility(activePage.pageId, !activePage.showInNav)}
                className="gap-2 text-xs focus:bg-white/10 focus:text-white"
              >
                {activePage.showInNav ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {activePage.showInNav ? "Hide from navigation" : "Show in navigation"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {hasConflict && (
        <span className="sr-only">Duplicate route conflict</span>
      )}
    </div>
  );
}

export function detectRouteConflicts(registry: PageRegistry): string[] {
  const paths = Object.values(registry.pages).map((page) => page.path.toLowerCase());
  const seen = new Set<string>();
  const conflicts: string[] = [];
  for (const path of paths) {
    if (seen.has(path)) conflicts.push(path);
    seen.add(path);
  }
  return [...new Set(conflicts)];
}