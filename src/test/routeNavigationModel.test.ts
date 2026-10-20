import { describe, expect, it } from "vitest";

import { getRouteById } from "@/routes/routeConfig";
import {
  findRouteForPathname,
  getPrimaryShellNavigationItem,
  getRouteBreadcrumbs,
  getRouteParamNames,
  getShellNavigationItems,
  isParameterizedRoute,
  matchRoutePath,
  normalizeRouteParams,
  resolveRouteHref,
} from "@/routes/routeNavigationModel";

describe("route navigation model", () => {
  it("detects route params and parameterized routes", () => {
    expect(getRouteParamNames("/project/:projectId/setup")).toEqual(["projectId"]);
    expect(isParameterizedRoute("/project/:id")).toBe(true);
    expect(isParameterizedRoute("/dashboard")).toBe(false);
  });

  it("resolves route hrefs with params when available", () => {
    expect(resolveRouteHref("/project/:id", { id: "abc 123" })).toBe("/project/abc%20123");
    expect(resolveRouteHref("/project/:id", { projectId: "p1" })).toBe("/project/p1");
    expect(resolveRouteHref("/project/:projectId/setup", { id: "p1" })).toBe("/project/p1/setup");
    expect(resolveRouteHref("/project/:projectId/setup", { projectId: "p1" })).toBe("/project/p1/setup");
    expect(resolveRouteHref("/project/:projectId/setup")).toBeNull();
    expect(resolveRouteHref("*")).toBeNull();
  });

  it("normalizes project identity params across legacy route names", () => {
    expect(normalizeRouteParams({ projectId: "p1" })).toEqual({ projectId: "p1", id: "p1" });
    expect(normalizeRouteParams({ id: "p1" })).toEqual({ id: "p1", projectId: "p1" });
  });

  it("matches literal and parameterized routes", () => {
    expect(matchRoutePath("/dashboard", "/dashboard")).toBe(true);
    expect(matchRoutePath("/project/:id", "/project/project_123")).toBe(true);
    expect(matchRoutePath("/project/:id", "/project/project_123/setup")).toBe(false);
    expect(matchRoutePath("/project/:projectId/setup", "/project/project_123/setup")).toBe(true);
  });

  it("finds the configured route for a concrete pathname", () => {
    expect(findRouteForPathname("/web-builder")?.meta.id).toBe("web-builder");
    expect(findRouteForPathname("/project/project_123")?.meta.id).toBe("project");
    expect(findRouteForPathname("/project/project_123/setup")?.meta.id).toBe("project-setup");
    expect(findRouteForPathname("/missing")).toBeNull();
  });

  it("builds shell navigation from canonical route metadata", () => {
    const workspaceItems = getShellNavigationItems("workspace", "/dashboard");
    const builderItems = getShellNavigationItems("builder", "/web-builder");

    expect(workspaceItems.map((item) => item.id)).toContain("dashboard");
    expect(workspaceItems.find((item) => item.id === "dashboard")?.isActive).toBe(true);
    expect(workspaceItems.map((item) => item.id)).not.toContain("home");
    expect(builderItems.map((item) => item.id)).toContain("web-builder");
    expect(builderItems.map((item) => item.id)).not.toContain("ai-generator");
  });

  it("creates primary shell navigation items with resolved params", () => {
    expect(getPrimaryShellNavigationItem("workspace")?.href).toBe("/dashboard");
    expect(getPrimaryShellNavigationItem("project", "/project/p1", { id: "p1" })?.href).toBe("/project/p1");
    expect(getPrimaryShellNavigationItem("focus")).toBeNull();
  });

  it("builds breadcrumbs from shell primary route to current route", () => {
    const route = getRouteById("project-setup");
    if (!route) throw new Error("Missing project setup route");

    expect(getRouteBreadcrumbs(route, { id: "p1", projectId: "p1" })).toEqual([
      { id: "project", label: "Project", href: "/project/p1" },
      { id: "project-setup", label: "Project setup", href: "/project/p1/setup" },
    ]);
  });
});
