import type { AppRouteMeta } from "./routeConfig";

export type RouteAccessDecisionKind = "allow" | "loading" | "redirect";

export type RouteAccessRedirectReason =
  | "auth_required"
  | "onboarding_required"
  | "workspace_required"
  | "project_required";

export interface RouteAccessState {
  isAuthenticated: boolean;
  authLoading?: boolean;
  onboardingLoading?: boolean;
  needsOnboarding?: boolean;
  hasWorkspace?: boolean | null;
  hasProject?: boolean | null;
}

export interface RouteAccessDecision {
  kind: RouteAccessDecisionKind;
  redirectTo?: string;
  reason?: RouteAccessRedirectReason;
}

export interface RouteAccessRequirements {
  requiresAuth: boolean;
  requiresOnboardingCompletion: boolean;
  requiresWorkspace: boolean;
  requiresProject: boolean;
}

const PUBLIC_AUTH_ROUTE_IDS = new Set(["auth", "auth-callback", "reset-password"]);

export function getRouteAccessRequirements(meta: AppRouteMeta): RouteAccessRequirements {
  const requiresAuth = meta.requiresAuth === true;

  return {
    requiresAuth,
    requiresOnboardingCompletion:
      requiresAuth && meta.section !== "onboarding" && !PUBLIC_AUTH_ROUTE_IDS.has(meta.id),
    requiresWorkspace: meta.requiresWorkspace === true,
    requiresProject: meta.requiresProject === true,
  };
}

export function resolveRouteAccess(meta: AppRouteMeta, state: RouteAccessState): RouteAccessDecision {
  const requirements = getRouteAccessRequirements(meta);

  if (requirements.requiresAuth && state.authLoading) {
    return { kind: "loading" };
  }

  if (requirements.requiresAuth && !state.isAuthenticated) {
    return {
      kind: "redirect",
      redirectTo: "/auth",
      reason: "auth_required",
    };
  }

  if (requirements.requiresOnboardingCompletion && state.onboardingLoading) {
    return { kind: "loading" };
  }

  if (requirements.requiresOnboardingCompletion && state.needsOnboarding) {
    return {
      kind: "redirect",
      redirectTo: "/onboarding",
      reason: "onboarding_required",
    };
  }

  if (requirements.requiresWorkspace && state.hasWorkspace === false) {
    return {
      kind: "redirect",
      redirectTo: "/cloud",
      reason: "workspace_required",
    };
  }

  if (requirements.requiresProject && state.hasProject === false) {
    return {
      kind: "redirect",
      redirectTo: "/dashboard",
      reason: "project_required",
    };
  }

  return { kind: "allow" };
}

