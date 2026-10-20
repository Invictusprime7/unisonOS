import { describe, expect, it } from "vitest";

import { getRouteById } from "@/routes/routeConfig";
import { getRouteAccessRequirements, resolveRouteAccess } from "@/routes/routeAccessPolicy";

function meta(routeId: string) {
  const route = getRouteById(routeId);
  if (!route) throw new Error(`Missing route ${routeId}`);
  return route.meta;
}

describe("route access policy", () => {
  it("allows public routes without auth", () => {
    expect(resolveRouteAccess(meta("landing"), { isAuthenticated: false })).toEqual({ kind: "allow" });
    expect(resolveRouteAccess(meta("pricing"), { isAuthenticated: false })).toEqual({ kind: "allow" });
  });

  it("redirects unauthenticated users from protected workspace routes", () => {
    expect(resolveRouteAccess(meta("dashboard"), { isAuthenticated: false })).toEqual({
      kind: "redirect",
      redirectTo: "/auth",
      reason: "auth_required",
    });
  });

  it("returns loading while protected auth state is unresolved", () => {
    expect(resolveRouteAccess(meta("dashboard"), { isAuthenticated: false, authLoading: true })).toEqual({
      kind: "loading",
    });
  });

  it("keeps onboarding accessible while onboarding is incomplete", () => {
    expect(resolveRouteAccess(meta("onboarding"), {
      isAuthenticated: true,
      needsOnboarding: true,
    })).toEqual({ kind: "allow" });
  });

  it("redirects incomplete users from post-onboarding surfaces", () => {
    expect(resolveRouteAccess(meta("web-builder"), {
      isAuthenticated: true,
      needsOnboarding: true,
    })).toEqual({
      kind: "redirect",
      redirectTo: "/onboarding",
      reason: "onboarding_required",
    });
  });

  it("returns loading while onboarding state is unresolved for post-onboarding routes", () => {
    expect(resolveRouteAccess(meta("web-builder"), {
      isAuthenticated: true,
      onboardingLoading: true,
    })).toEqual({ kind: "loading" });
  });

  it("redirects workspace-required routes when no workspace is available", () => {
    expect(resolveRouteAccess(meta("cloud"), {
      isAuthenticated: true,
      needsOnboarding: false,
      hasWorkspace: false,
    })).toEqual({
      kind: "redirect",
      redirectTo: "/cloud",
      reason: "workspace_required",
    });
  });

  it("redirects project-required routes when no project is available", () => {
    expect(resolveRouteAccess(meta("project-setup"), {
      isAuthenticated: true,
      needsOnboarding: false,
      hasWorkspace: true,
      hasProject: false,
    })).toEqual({
      kind: "redirect",
      redirectTo: "/dashboard",
      reason: "project_required",
    });
  });

  it("derives access requirements from route metadata", () => {
    expect(getRouteAccessRequirements(meta("landing"))).toEqual({
      requiresAuth: false,
      requiresOnboardingCompletion: false,
      requiresWorkspace: false,
      requiresProject: false,
    });

    expect(getRouteAccessRequirements(meta("project-setup"))).toEqual({
      requiresAuth: true,
      requiresOnboardingCompletion: true,
      requiresWorkspace: true,
      requiresProject: true,
    });
  });
});

