import { describe, expect, it } from "vitest";

import { getRouteDocumentTitle } from "@/routes/AppRouteElement";
import { appRoutes, getRouteById, getRoutesBySection, getRoutesByShell } from "@/routes/routeConfig";
import {
  getNavigableRoutesForShell,
  getPrimaryRouteForShell,
  getRouteShellGroups,
  routeShellDefinitions,
} from "@/routes/routeShellModel";
import {
  getDeprecatedRouteAliases,
  getRouteInventoryEntries,
  getRouteInventorySummary,
  getRoutesByChrome,
  getShellMigrationSummary,
} from "@/routes/routeInventory";
import { getBlockingRouteContractIssues, validateRouteContracts } from "@/routes/routeContractValidation";

describe("app route config", () => {
  it("has unique route ids", () => {
    const ids = appRoutes.map((route) => route.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the catch-all route last", () => {
    expect(appRoutes[appRoutes.length - 1]?.path).toBe("*");
  });

  it("requires every route to declare shell and section metadata", () => {
    for (const route of appRoutes) {
      expect(route.meta.id).toBeTruthy();
      expect(route.meta.title).toBeTruthy();
      expect(route.meta.shell).toBeTruthy();
      expect(route.meta.chrome).toBeTruthy();
      expect(route.meta.section).toBeTruthy();
    }
  });

  it("marks core authenticated surfaces with workspace requirements", () => {
    const workspaceRouteIds = ["dashboard", "cloud", "web-builder", "project-setup", "crm", "team"];

    for (const routeId of workspaceRouteIds) {
      const route = getRouteById(routeId);
      expect(route?.meta.requiresAuth).toBe(true);
      expect(route?.meta.requiresWorkspace).toBe(true);
    }
  });

  it("exposes section and shell lookup helpers", () => {
    expect(getRoutesByShell("builder").map((route) => route.meta.id)).toContain("web-builder");
    expect(getRoutesBySection("operations").map((route) => route.meta.id)).toContain("crm");
  });

  it("derives consistent browser titles from route metadata", () => {
    expect(getRouteDocumentTitle(getRouteById("landing")!.meta)).toBe("Unison");
    expect(getRouteDocumentTitle(getRouteById("web-builder")!.meta)).toBe("Web builder | Unison");
  });

  it("maps every shell definition to its owned routes", () => {
    const groups = getRouteShellGroups();
    expect(groups.map((group) => group.definition.shell)).toEqual(Object.keys(routeShellDefinitions));
    expect(groups.find((group) => group.definition.shell === "workspace")?.routes.length).toBeGreaterThan(0);
    expect(groups.find((group) => group.definition.shell === "builder")?.routes.length).toBeGreaterThan(0);
  });

  it("excludes deprecated aliases and catch-all routes from shell navigation", () => {
    const workspaceIds = getNavigableRoutesForShell("workspace").map((route) => route.meta.id);
    const builderIds = getNavigableRoutesForShell("builder").map((route) => route.meta.id);

    expect(workspaceIds).toContain("dashboard");
    expect(workspaceIds).not.toContain("home");
    expect(builderIds).toContain("web-builder");
    expect(builderIds).not.toContain("ai-generator");
    expect(getNavigableRoutesForShell("public").map((route) => route.meta.id)).not.toContain("not-found");
  });

  it("routes legacy CRM entry points into the scoped Cloud workspace", () => {
    const crmRoute = getRouteById("crm");
    const leadsRoute = getRouteById("dashboard-leads");

    expect(crmRoute?.meta.deprecatedAliasFor).toBe("/cloud");
    expect(leadsRoute?.meta.deprecatedAliasFor).toBe("/cloud");
    expect(crmRoute?.element.props).toMatchObject({
      to: "/cloud",
      replace: true,
      state: { tab: "projects", workspaceSection: "crm", crmView: "overview" },
    });
    expect(leadsRoute?.element.props).toMatchObject({
      to: "/cloud",
      replace: true,
      state: { tab: "projects", workspaceSection: "crm", crmView: "leads" },
    });
  });

  it("resolves primary routes for shell entry points", () => {
    expect(getPrimaryRouteForShell("workspace")?.meta.id).toBe("dashboard");
    expect(getPrimaryRouteForShell("builder")?.meta.id).toBe("web-builder");
    expect(getPrimaryRouteForShell("focus")).toBeNull();
  });

  it("derives an inventory summary from the route contract", () => {
    const summary = getRouteInventorySummary();

    expect(summary.totalRoutes).toBe(appRoutes.length);
    expect(summary.shellCounts.workspace).toBeGreaterThan(0);
    expect(summary.shellCounts.builder).toBeGreaterThan(0);
    expect(summary.chromeCounts.legacy).toBeGreaterThan(0);
    expect(summary.chromeCounts.fullscreen).toBeGreaterThan(0);
    expect(summary.chromeCounts.none).toBeGreaterThan(0);
    expect(summary.deprecatedAliasCount).toBe(getDeprecatedRouteAliases().length);
    expect(summary.authRequiredCount).toBeGreaterThan(0);
    expect(summary.workspaceRequiredCount).toBeGreaterThan(0);
    expect(summary.projectRequiredCount).toBeGreaterThan(0);
  });

  it("lists route inventory entries in a UI-safe shape", () => {
    const entries = getRouteInventoryEntries();
    const builderEntry = entries.find((entry) => entry.id === "web-builder");

    expect(builderEntry).toMatchObject({
      id: "web-builder",
      path: "/web-builder",
      title: "Web builder",
      shell: "builder",
      chrome: "fullscreen",
      section: "builder",
      requiresAuth: true,
      requiresWorkspace: true,
      primaryAction: "Preview",
    });
  });

  it("summarizes shell migration state by explicit chrome mode", () => {
    const migration = getShellMigrationSummary();

    expect(migration.totalRoutes).toBe(appRoutes.length);
    expect(migration.legacyRouteIds).toContain("project");
    expect(migration.fullscreenRouteIds).toContain("web-builder");
    expect(migration.canonicalCount).toBe(getRoutesByChrome("canonical").length);
    expect(migration.legacyCount).toBe(getRoutesByChrome("legacy").length);
  });

  it("keeps blocking route contract issues out of the canonical config", () => {
    expect(getBlockingRouteContractIssues()).toEqual([]);
  });

  it("documents the remaining project route param mismatch as a warning", () => {
    const issues = validateRouteContracts();

    expect(issues).toContainEqual({
      severity: "warning",
      code: "route_param_mismatch",
      message: "Project routes mix :id and :projectId. Navigation normalization currently bridges this legacy mismatch.",
    });
  });
});
