/**
 * Runtime Manifest Tests
 * 
 * Tests the Launcher handoff contract:
 * sourceFiles → createRuntimeManifest → resolvePreviewEngine
 */
import { describe, it, expect } from "vitest";
import { createRuntimeManifest, resolvePreviewEngine } from "@/types/runtimeManifest";
import { normalizeUnisonRuntimeContext } from "@/platform/core/runtimeManifest";

describe("normalizeUnisonRuntimeContext", () => {
  it("upgrades legacy persisted organization and site identity", () => {
    expect(normalizeUnisonRuntimeContext({
      organizationId: "workspace_123",
      businessId: "business_123",
      projectId: "project_123",
      siteId: "website_123",
      snapshotId: "snapshot_123",
      environment: "preview",
    })).toMatchObject({
      workspaceId: "workspace_123",
      websiteId: "website_123",
      organizationId: "workspace_123",
      siteId: "website_123",
    });
  });

  it("preserves an optional location identity without requiring it for older sites", () => {
    expect(normalizeUnisonRuntimeContext({
      workspaceId: "workspace_123",
      businessId: "business_123",
      projectId: "project_123",
      websiteId: "website_123",
      locationId: "location_123",
      snapshotId: "snapshot_123",
      environment: "preview",
    })).toMatchObject({
      businessId: "business_123",
      projectId: "project_123",
      websiteId: "website_123",
      locationId: "location_123",
    });

    const legacyContext = normalizeUnisonRuntimeContext({
      workspaceId: "workspace_123",
      businessId: "business_123",
      projectId: "project_123",
      websiteId: "website_123",
      snapshotId: "snapshot_123",
      environment: "preview",
    });
    expect(legacyContext).toBeDefined();
    expect(legacyContext).not.toHaveProperty('locationId');
  });

  it("rejects an incomplete tenant identity", () => {
    expect(normalizeUnisonRuntimeContext({
      businessId: "business_123",
      projectId: "project_123",
      environment: "builder",
    })).toBeUndefined();
  });
});

describe("createRuntimeManifest", () => {
  it("creates manifest with default entry point", () => {
    const manifest = createRuntimeManifest({
      "/src/App.tsx": "export default function App() { return <div>Hello</div>; }",
    });
    expect(manifest.entryPoint).toBe("/src/App.tsx");
    expect(manifest.previewEngine).toBe("sandpack");
    expect(manifest.backendRequired).toBe(false);
  });

  it("infers routes from /src/pages/ files", () => {
    const manifest = createRuntimeManifest({
      "/src/App.tsx": "export default function App() {}",
      "/src/pages/Home.tsx": "export default function Home() {}",
      "/src/pages/About.tsx": "export default function About() {}",
      "/src/pages/Contact.tsx": "export default function Contact() {}",
    });
    expect(manifest.routes).toContain("/");
    expect(manifest.routes).toContain("/about");
    expect(manifest.routes).toContain("/contact");
  });

  it("detects backend requirements from supabase imports", () => {
    const manifest = createRuntimeManifest({
      "/src/App.tsx": `
        import { supabase } from './lib/supabase';
        supabase.from('users').select('*');
      `,
    });
    expect(manifest.backendRequired).toBe(true);
    expect(manifest.previewEngine).toBe("docker");
    expect(manifest.envRequirements).toContain("VITE_SUPABASE_URL");
  });

  it("detects backend from auth patterns", () => {
    const manifest = createRuntimeManifest({
      "/src/App.tsx": "const { data } = await auth.signIn({ email, password });",
    });
    expect(manifest.backendRequired).toBe(true);
  });

  it("respects explicit backendRequired override", () => {
    const manifest = createRuntimeManifest(
      { "/src/App.tsx": "export default () => <div />" },
      { backendRequired: true }
    );
    expect(manifest.backendRequired).toBe(true);
    expect(manifest.previewEngine).toBe("docker");
  });

  it("extracts npm dependencies from imports", () => {
    const manifest = createRuntimeManifest({
      "/src/App.tsx": `
        import { motion } from 'framer-motion';
        import { Button } from '@radix-ui/react-button';
        import React from 'react';
      `,
    });
    expect(manifest.dependencies["framer-motion"]).toBe("latest");
    expect(manifest.dependencies["@radix-ui/react-button"]).toBe("latest");
    // react should be excluded
    expect(manifest.dependencies["react"]).toBeUndefined();
  });

  it("passes through industry/brand/aesthetic metadata", () => {
    const manifest = createRuntimeManifest(
      { "/src/App.tsx": "export default () => <div />" },
      { industry: "restaurant", brandName: "Bella's", aesthetic: "warm-earth" }
    );
    expect(manifest.industry).toBe("restaurant");
    expect(manifest.brandName).toBe("Bella's");
    expect(manifest.aesthetic).toBe("warm-earth");
  });

  it("carries app context and dependency overrides", () => {
    const manifest = createRuntimeManifest(
      { "/src/App.tsx": "export default () => <div />" },
      {
        entryPoint: "/src/App.tsx",
        dependencyOverrides: { "@tanstack/react-query": "^5.0.0" },
        appContext: {
          projectId: "project_123",
          templateName: "Launch Site",
          industry: "agency",
        },
        metadataFiles: ["/.unison/app-context.json"],
        sessionKey: "project_123::snap_1::/src/App.tsx",
      }
    );
    expect(manifest.dependencies["@tanstack/react-query"]).toBe("^5.0.0");
    expect(manifest.appContext?.projectId).toBe("project_123");
    expect(manifest.appContext?.templateName).toBe("Launch Site");
    expect(manifest.metadataFiles).toEqual(["/.unison/app-context.json"]);
    expect(manifest.sessionKey).toBe("project_123::snap_1::/src/App.tsx");
  });

  it("defaults to / route when no pages found", () => {
    const manifest = createRuntimeManifest({
      "/src/App.tsx": "export default () => <div />",
    });
    expect(manifest.routes).toEqual(["/"]);
  });
});

describe("resolvePreviewEngine", () => {
  it("uses sandpack when manifest says sandpack", () => {
    const manifest = createRuntimeManifest({
      "/src/App.tsx": "export default () => <div />",
    });
    const result = resolvePreviewEngine(manifest);
    expect(result.engine).toBe("sandpack");
    expect(result.frontendOnly).toBe(true);
  });

  it("uses docker when available and required", () => {
    const manifest = createRuntimeManifest(
      { "/src/App.tsx": "import { supabase } from './supabase'" },
      { backendRequired: true }
    );
    const result = resolvePreviewEngine(manifest, { dockerAvailable: true });
    expect(result.engine).toBe("docker");
    expect(result.frontendOnly).toBe(false);
  });

  it("falls back to sandpack when docker required but unavailable", () => {
    const manifest = createRuntimeManifest(
      { "/src/App.tsx": "export default () => <div />" },
      { backendRequired: true }
    );
    const result = resolvePreviewEngine(manifest, { dockerAvailable: false });
    expect(result.engine).toBe("sandpack");
    expect(result.frontendOnly).toBe(true);
  });

  it("defaults docker unavailable when capabilities not provided", () => {
    const manifest = createRuntimeManifest(
      { "/src/App.tsx": "export default () => <div />" },
      { backendRequired: true }
    );
    const result = resolvePreviewEngine(manifest);
    expect(result.engine).toBe("sandpack");
    expect(result.frontendOnly).toBe(true);
  });
});
