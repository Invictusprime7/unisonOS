import { appRoutes, type AppRouteConfig, type RouteSection, type RouteShell } from "./routeConfig";

export interface RouteShellDefinition {
  shell: RouteShell;
  label: string;
  description: string;
  primaryRouteId: string | null;
  sections: RouteSection[];
}

export interface RouteShellGroup {
  definition: RouteShellDefinition;
  routes: AppRouteConfig[];
}

export const routeShellDefinitions: Record<RouteShell, RouteShellDefinition> = {
  public: {
    shell: "public",
    label: "Public",
    description: "Unauthenticated marketing, docs, pricing, and account recovery surfaces.",
    primaryRouteId: "landing",
    sections: ["public", "auth"],
  },
  onboarding: {
    shell: "onboarding",
    label: "Onboarding",
    description: "First-run system launch and business setup sequence.",
    primaryRouteId: "onboarding",
    sections: ["onboarding"],
  },
  workspace: {
    shell: "workspace",
    label: "Workspace",
    description: "Business/workspace operations, shared assets, account settings, and team access.",
    primaryRouteId: "dashboard",
    sections: ["workspace", "account"],
  },
  project: {
    shell: "project",
    label: "Project",
    description: "Project-scoped operations, setup, CRM, automations, and launch readiness.",
    primaryRouteId: "project",
    sections: ["project", "operations"],
  },
  builder: {
    shell: "builder",
    label: "Builder",
    description: "Authoring workbench for VFS, preview, AI edits, routes, readiness, and publish.",
    primaryRouteId: "web-builder",
    sections: ["builder"],
  },
  focus: {
    shell: "focus",
    label: "Focus",
    description: "Full-screen tools and inspection modes with minimal app chrome.",
    primaryRouteId: null,
    sections: [],
  },
};

export function getRouteShellDefinition(shell: RouteShell) {
  return routeShellDefinitions[shell];
}

export function getRouteShellGroups(routes: AppRouteConfig[] = appRoutes): RouteShellGroup[] {
  return Object.values(routeShellDefinitions).map((definition) => ({
    definition,
    routes: routes.filter((route) => route.meta.shell === definition.shell),
  }));
}

export function getNavigableRoutesForShell(shell: RouteShell, routes: AppRouteConfig[] = appRoutes) {
  return routes.filter((route) => {
    if (route.meta.shell !== shell) return false;
    if (route.path === "*") return false;
    return !route.meta.deprecatedAliasFor;
  });
}

export function getPrimaryRouteForShell(shell: RouteShell, routes: AppRouteConfig[] = appRoutes) {
  const definition = getRouteShellDefinition(shell);
  if (!definition.primaryRouteId) return null;
  return routes.find((route) => route.meta.id === definition.primaryRouteId) ?? null;
}
