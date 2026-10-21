import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  buildCanonicalLaunchArtifacts,
  buildCanonicalLaunchArtifactsAsync,
  CANONICAL_METADATA_FILE_PATHS,
  mergeGeneratedVfsWithCanonicalSnapshot,
} from "@/services/canonicalLaunchVfs";
import type { SiteBundleSnapshot } from "@/platform/core/canonicalPipeline";
import type { BusinessRuntimeContract } from "@/platform/core/businessRuntimeContract";
import {
  WIZARD_LANE_A_PROTECTED_FILES,
  WIZARD_LAUNCH_AUTHORITY_PATH,
} from "@/platform/core/snapshotSeal";
import { createEmptyCreatorData } from "@/types/creatorData";
import { createBuilderPage, createEmptyPageRegistry } from "@/types/pageRegistry";
import { launchStateToSandpackFiles } from "@/utils/launchToSandpack";
import { createLaunchState } from "@/types/launchState";

const businessRuntime = {
  version: '1.1',
  businessId: 'biz_123',
  identity: {
    businessId: 'biz_123',
    projectId: 'project_123',
    siteId: 'site_123',
    locationId: 'location_123',
  },
  capabilityManifest: {
    version: '1.0',
    source: 'capability_pack_registry',
    requestedCapabilities: ['business_profile', 'crm.leads'],
    packs: [{
      id: 'crm.leads',
      status: 'declared',
      provides: ['crm.leads', 'crm.contacts', 'forms.contact', 'forms.quote', 'notifications.email'],
      requiredPermissions: ['business.crm.manage', 'visitor.lead.create'],
      requiredTables: ['leads', 'crm_leads', 'crm_contacts', 'crm_activities'],
      readinessAssertions: ['leads-public-insert-enabled'],
    }],
    unsupportedCapabilities: [],
  },
  profile: {
    source: 'businesses',
    version: '2026-10-20T00:00:00.000Z',
    completenessPercent: 100,
    publishReady: true,
    missingRequiredFields: [],
  },
  dataBindings: {
    source: 'site_data_bindings',
    snapshotId: 'snap_123',
    expectedCount: 0,
    status: 'ready',
  },
  generatedAt: '2026-10-20T00:00:00.000Z',
} satisfies BusinessRuntimeContract;

function createSnapshot(): SiteBundleSnapshot {
  const pageRegistry = createEmptyPageRegistry();
  const homePage = createBuilderPage("page_home", "Home", "/", "home", {
    isHome: true,
    filePath: "/src/pages/Home.tsx",
  });
  pageRegistry.pages[homePage.pageId] = homePage;
  pageRegistry.homePageId = homePage.pageId;

  return {
    snapshotId: "snap_123",
    businessName: "Acme Co",
    industry: "agency",
    pageRegistry,
    vfsFiles: {
      "/src/App.tsx": "import { Routes, Route } from 'react-router-dom';\nimport Home from './pages/Home';\nexport default function App(){ return <Routes><Route path=\"/\" element={<Home />} /></Routes>; }",
      "/src/pages/Home.tsx": "export default function Home(){ return <div>Placeholder</div>; }",
      "/src/index.css": ":root { --primary: 221.2 83.2% 53.3%; --background: 0 0% 100%; --foreground: 222.2 84% 4.9%; }",
    },
    routerFile: {
      path: "/src/App.tsx",
      content: "import { Routes, Route } from 'react-router-dom';",
    },
    manifest: {
      routes: [{ path: "/", pageId: "page_home", isHome: true }],
      nav: [{ label: "Home", path: "/", pageId: "page_home" }],
      layout: { header: "default", footer: "default" },
      metadata: { title: "Acme Co", description: "Agency site" },
    },
    bindings: {},
    calendars: {},
    popups: {},
    creatorData: createEmptyCreatorData("Acme Co"),
    componentInstances: {},
    routes: ["/"],
    homeRoute: "/",
    createdAt: "2026-04-23T00:00:00.000Z",
    meta: {
      source: "wizard",
      systemId: "agency",
      industry: "agency",
      verticalContractId: "agency",
      themePresetId: "modern",
      themeInjection: {
        version: "1.0",
        stage: "4b",
        presetId: "modern",
        cssPath: "/src/index.css",
      },
    },
  };
}

describe("buildCanonicalLaunchArtifacts", () => {
  it("runs one repair pass followed by one mutation-free acceptance pass", () => {
    const source = readFileSync("src/services/canonicalLaunchVfs.ts", "utf8");
    const convergenceStart = source.indexOf("// ── Canonical convergence preflight");
    const compilerGateStart = source.indexOf("// ── M4 compiler gate", convergenceStart);
    const convergence = source.slice(convergenceStart, compilerGateStart);

    expect(convergence.match(/mode: 'repair'/g)).toHaveLength(1);
    expect(convergence.match(/mode: 'acceptance'/g)).toHaveLength(1);
    expect(convergence).toContain("Object.assign(mergedFiles, refinalized.files)");
    expect(convergence.match(/Object\.assign\(mergedFiles, convergedPreflight\.files\)/g)).toHaveLength(1);
    expect(convergence.indexOf("Object.assign(mergedFiles, convergedPreflight.files)"))
      .toBeLessThan(convergence.indexOf("if (convergedPreflight.mutated)"));
  });

  it("never injects router-level chrome so the page body stays the only chrome authority", () => {
    const snapshot = createSnapshot();
    const aboutPage = createBuilderPage("page_about", "About", "/about", "about", {
      filePath: "/src/pages/About.tsx",
      showInNav: true,
      navOrder: 1,
    });
    snapshot.pageRegistry.pages[aboutPage.pageId] = aboutPage;
    snapshot.vfsFiles[aboutPage.filePath!] =
      "export default function About(){ return <main>Canonical About</main>; }";

    const merged = mergeGeneratedVfsWithCanonicalSnapshot(
      {
        "/src/pages/Home.tsx": "export default function Home(){ return <main>Rich Home</main>; }",
        "/src/pages/About.tsx": "export default function About(){ return <main>Rich About</main>; }",
        "/src/sections/SiteNavbar.tsx": "export default function SiteNavbar(){ return <nav>Stale menu</nav>; }",
      },
      snapshot.vfsFiles,
      snapshot,
    );

    expect(merged["/src/App.tsx"]).not.toContain("<SiteNavbar />");
    expect(merged["/src/App.tsx"]).not.toContain("<SiteFooter />");
  });

  it("preserves an authored HashRouter instead of replacing its route graph", () => {
    const snapshot = createSnapshot();
    const authoredRouter = `import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
export default function App(){ return <HashRouter><Routes><Route path="/" element={<Home />} /></Routes></HashRouter>; }`;
    const merged = mergeGeneratedVfsWithCanonicalSnapshot(
      { '/src/App.tsx': authoredRouter },
      snapshot.vfsFiles,
      snapshot,
    );
    expect(merged['/src/App.tsx']).toBe(authoredRouter);
  });

  it("uses the snapshot fallback policy when accepting generated wizard pages", () => {
    const snapshot = createSnapshot();
    snapshot.vfsFiles["/src/pages/Home.tsx"] =
      "export default function Home(){ return <main>Canonical home</main>; }";

    expect(() => mergeGeneratedVfsWithCanonicalSnapshot(
      {
        "/src/pages/Home.tsx":
          "export default function Home(){ return <main>New site preview</main>; }",
      },
      snapshot.vfsFiles,
      snapshot,
    )).toThrow("minimal/fallback scaffold");
  });

  it("seals the canonical page after repairing unusable generated output", () => {
    const snapshot = createSnapshot();
    snapshot.vfsFiles["/src/pages/Home.tsx"] =
      "export default function Home(){ return <main><h1>Canonical generated composition</h1><section>Ready for editing in Web Builder.</section></main>; }";

    const artifacts = buildCanonicalLaunchArtifacts({
      generatedFiles: {
        "/src/pages/Home.tsx": "export default function Home(){ return <main>Placeholder</main>; }",
      },
      preferredEntryPoint: "/src/App.tsx",
      siteBundleSnapshot: snapshot,
      compiledPlayground: { vfsFiles: snapshot.vfsFiles },
      themePresetId: "modern",
      allowCanonicalPageFallback: true,
      previewFirst: true,
      strictPreflight: true,
    });

    expect(artifacts.files["/src/pages/Home.tsx"]).toContain("Canonical generated composition");
    expect(artifacts.siteBundleSnapshot?.meta.seal).toBeDefined();
    expect(artifacts.visualQuality).toBeDefined();
    expect(artifacts.runtimeCompatibility).toBeDefined();
  });

  it("uses a generated single-file App as Home in preview-first mode", () => {
    const snapshot = createSnapshot();
    snapshot.vfsFiles["/src/pages/Home.tsx"] =
      "export default function Home(){ return <main>Canonical home composition</main>; }";
    const generatedApp = `export default function App(){ return <main><h1>AI generated home</h1><section>${"Generated business content. ".repeat(30)}</section></main>; }`;

    const merged = mergeGeneratedVfsWithCanonicalSnapshot(
      { "/src/App.tsx": generatedApp },
      snapshot.vfsFiles,
      snapshot,
      { allowCanonicalPageFallback: true, preferGeneratedAppAsHome: true },
    );

    expect(merged["/src/pages/Home.tsx"]).toContain("AI generated home");
    expect(merged["/src/App.tsx"]).toContain("react-router-dom");
  });

  it("preserves snapshot-owned UI foundation files when merging generated output", () => {
    const snapshot = createSnapshot();
    snapshot.vfsFiles["/src/unison/ui/button.tsx"] =
      "// canonical UI foundation\nexport const Button = () => null;";
    snapshot.vfsFiles["/.unison/ui-manifest.json"] =
      '{"importRoot":"@/unison/ui"}';
    snapshot.vfsFiles['/.unison/design-intervention.json'] =
      '{"layoutRecipe":"collage-hero"}';

    const merged = mergeGeneratedVfsWithCanonicalSnapshot(
      {
        "/src/pages/Home.tsx": "export default function Home(){ return <main>Production page</main>; }",
        "/src/unison/ui/button.tsx": "export const Button = () => <button>unsafe override</button>;",
        "/.unison/ui-manifest.json": '{"importRoot":"@/other-ui"}',
        '/.unison/design-intervention.json': '{"layoutRecipe":"conversion-form"}',
        '/.unison/forged-generated.json': '{"owner":"generated"}',
      },
      snapshot.vfsFiles,
      snapshot,
    );

    expect(merged["/src/pages/Home.tsx"]).toContain("Production page");
    expect(merged["/src/unison/ui/button.tsx"]).toContain("canonical UI foundation");
    expect(merged["/.unison/ui-manifest.json"]).toContain("@/unison/ui");
    expect(merged['/.unison/design-intervention.json']).toContain('collage-hero');
    expect(merged['/.unison/forged-generated.json']).toBeUndefined();
    expect(JSON.parse(merged[WIZARD_LAUNCH_AUTHORITY_PATH])).toEqual({
      version: '2.0',
      compileArtifactId: snapshot.snapshotId,
      registeredPageBodyAuthority: 'canonical-compiler',
      registeredPageFiles: ['/src/pages/Home.tsx'],
      protectedFilePatterns: [...WIZARD_LANE_A_PROTECTED_FILES],
    });
  });

  it("uses complete generated page input even when Stage 4b declared a composition", () => {
    const snapshot = createSnapshot();
    snapshot.vfsFiles["/src/pages/Home.tsx"] = [
      'const SECTIONS = [{"id":"home-hero","type":"hero","props":{"headline":"Canonical headline"}}];',
      'const HYDRATABLE = new Set([]);',
      'export default function Home(){ return <main>Canonical composed home</main>; }',
    ].join("\n");
    snapshot.vfsFiles["/.unison/compositions/src/pages/Home.json"] = JSON.stringify({
      pageId: "page_home",
      route: "/",
      sections: [{ semanticType: "hero", variantId: "hero:full-bleed" }],
    });

    const laneBHome = [
      "import Hero from '../components/LaneBHero';",
      'export default function Home(){',
      '  return <main><section data-ut-intent="contact.submit">Curated home</section></main>;',
      '}',
    ].join("\n");

    const merged = mergeGeneratedVfsWithCanonicalSnapshot(
      {
        "/src/pages/Home.tsx": laneBHome,
        "/src/components/LaneBHero.tsx": [
          'export default function Hero(){',
          '  return <section><h1>Distinct business headline</h1><p>Detailed business description.</p><button data-ut-intent="contact.submit">Book a strategy call</button></section>;',
          '}',
        ].join('\n'),
        "/src/components/UnusedLegacy.tsx": "import Missing from './Missing'; export default function Unused(){ return <Missing />; }",
      },
      snapshot.vfsFiles,
      snapshot,
    );

    expect(merged["/src/pages/Home.tsx"]).toBe(laneBHome);
    expect(merged["/src/pages/Home.tsx"]).not.toContain("Canonical composed home");
    // The declared composition survives as the design contract, not as a body.
    expect(merged["/.unison/compositions/src/pages/Home.json"]).toContain("hero:full-bleed");
  });

  it("never substitutes the canonical page body unless a caller explicitly opts in", () => {
    const snapshot = createSnapshot();
    snapshot.vfsFiles["/src/pages/Home.tsx"] =
      "export default function Home(){ return <main>Canonical composed home</main>; }";

    // Default (flag omitted) is now strict: no body substitution.
    const defaults = mergeGeneratedVfsWithCanonicalSnapshot({}, snapshot.vfsFiles, snapshot);
    expect(defaults["/src/pages/Home.tsx"]).toBeUndefined();

    const strict = mergeGeneratedVfsWithCanonicalSnapshot({}, snapshot.vfsFiles, snapshot, {
      allowCanonicalPageFallback: false,
    });
    expect(strict["/src/pages/Home.tsx"]).toBeUndefined();

    // Opt-in remains only for non-authoring importers.
    const optedIn = mergeGeneratedVfsWithCanonicalSnapshot({}, snapshot.vfsFiles, snapshot, {
      allowCanonicalPageFallback: true,
    });
    expect(optedIn["/src/pages/Home.tsx"]).toContain("Canonical composed home");
  });

  it("uses LaunchState VFS when the builder preview mounts before VFS import", () => {
    const launchState = createLaunchState({
      systemType: "agency",
      systemName: "Agency",
      businessName: "Acme Co",
      templateName: "Acme Launch",
      templateCategory: "landing",
      aesthetic: "modern",
      preloadedIntents: [],
      entryPoint: "/src/App.tsx",
      vfsFiles: {
        "/src/App.tsx": "export default function App(){ return <main>Generated Launch</main>; }",
        "/src/index.css": ":root { --primary: 221.2 83.2% 53.3%; }",
      },
    });

    const sandpackFiles = launchStateToSandpackFiles({
      launchState,
      vfsFiles: {},
    });

    expect(sandpackFiles["/App.tsx"]).toContain("Generated Launch");
  });

  it("wires launcher output into canonical VFS metadata and package dependencies", () => {
    const snapshot = createSnapshot();
    const input = {
      generatedFiles: {
        "/src/App.tsx": "import { motion } from 'framer-motion';\nexport default function App(){ return <motion.div>Hello</motion.div>; }",
      },
      preferredEntryPoint: "/src/App.tsx",
      siteBundleSnapshot: snapshot,
      compiledPlayground: { vfsFiles: snapshot.vfsFiles },
      businessId: "biz_123",
      projectId: "project_123",
      organizationId: "biz_123",
      siteId: "site_123",
      businessRuntime,
      systemType: "agency",
      systemName: "Acme Co",
      templateName: "Acme Launch",
      templateCategory: "landing",
      businessName: "Acme Co",
      industry: "agency",
      aesthetic: "modern",
      backendRequired: false,
    };
    const artifacts = buildCanonicalLaunchArtifacts(input);

    expect(artifacts.files["/src/App.tsx"]).toContain("Routes");
    expect(artifacts.files["/src/pages/Home.tsx"]).toContain("motion.div");
    expect(artifacts.files["/package.json"]).toContain("\"framer-motion\"");
    expect(artifacts.runtimeManifest.appContext?.projectId).toBe("project_123");
    expect(artifacts.runtimeManifest.appContext?.runtimeContext).toMatchObject({
      workspaceId: 'biz_123',
      businessId: 'biz_123',
      projectId: 'project_123',
      websiteId: 'site_123',
      locationId: 'location_123',
      snapshotId: 'snap_123',
    });
    expect(artifacts.runtimeManifest.appContext?.businessRuntime?.capabilityManifest).toEqual(businessRuntime.capabilityManifest);
    expect(artifacts.runtimeManifest.appContext?.previewRuntime?.foundation).toBe('token-glass');
    expect(artifacts.appContext).not.toHaveProperty('experienceContract');
    expect(artifacts.runtimeManifest.metadataFiles).toContain(CANONICAL_METADATA_FILE_PATHS.appContext);
    expect(artifacts.runtimeManifest.metadataFiles).toContain(CANONICAL_METADATA_FILE_PATHS.wizardRuntime);
    expect(artifacts.files[CANONICAL_METADATA_FILE_PATHS.runtimeManifest]).toContain("\"sessionKey\"");
    expect(artifacts.files[CANONICAL_METADATA_FILE_PATHS.wizardRuntime]).toContain('token-glass');
    expect(artifacts.files[CANONICAL_METADATA_FILE_PATHS.siteBundleSnapshot]).toContain("\"vfsFilePaths\"");
    expect(artifacts.files['/src/components/businessProfile.ts']).toContain('useBusinessProfile');
    expect(() => buildCanonicalLaunchArtifacts({
      ...input,
      businessRuntime: {
        ...businessRuntime,
        identity: { ...businessRuntime.identity, siteId: 'another-site' },
      },
    })).toThrow('Business runtime identity must match the canonical launch scope.');
  });

  it('yields between finalization stages without changing canonical artifacts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T21:00:00.000Z'));
    const snapshot = createSnapshot();
    const input = {
      generatedFiles: {
        '/src/pages/Home.tsx': 'export default function Home(){ return <main>Rich Home</main>; }',
      },
      preferredEntryPoint: '/src/App.tsx',
      siteBundleSnapshot: snapshot,
      compiledPlayground: { vfsFiles: snapshot.vfsFiles },
      themePresetId: 'modern',
      strictPreflight: true,
    };
    const synchronous = buildCanonicalLaunchArtifacts(input);
    let yieldCount = 0;

    const asynchronous = await buildCanonicalLaunchArtifactsAsync(input, {
      yieldToHost: async () => {
        yieldCount += 1;
      },
    });

    expect(yieldCount).toBeGreaterThanOrEqual(8);
    expect(asynchronous.files).toEqual(synchronous.files);
    expect(asynchronous.runtimeManifest).toEqual(synchronous.runtimeManifest);
    expect(asynchronous.siteBundleSnapshot?.snapshotId).toBe(synchronous.siteBundleSnapshot?.snapshotId);
    vi.useRealTimers();
  });

  it('stops advancing once the caller aborts, instead of letting an abandoned attempt keep running alongside a fallback', async () => {
    const snapshot = createSnapshot();
    const input = {
      generatedFiles: {
        '/src/pages/Home.tsx': 'export default function Home(){ return <main>Rich Home</main>; }',
      },
      preferredEntryPoint: '/src/App.tsx',
      siteBundleSnapshot: snapshot,
      compiledPlayground: { vfsFiles: snapshot.vfsFiles },
      themePresetId: 'modern',
      strictPreflight: true,
    };
    const controller = new AbortController();
    let yieldCount = 0;

    const pending = buildCanonicalLaunchArtifactsAsync(input, {
      yieldToHost: async () => {
        yieldCount += 1;
        // Simulate a stage watchdog giving up partway through the run.
        if (yieldCount === 3) controller.abort(new Error('preflight stalled'));
      },
      signal: controller.signal,
    });

    await expect(pending).rejects.toThrow('preflight stalled');
    // The generator must stop being driven at the first yield after abort,
    // not continue consuming the remaining finalization stages.
    expect(yieldCount).toBe(3);
  });

  it("uses SiteBundleSnapshot VFS instead of a stale compile result at launch", () => {
    const snapshot = createSnapshot();
    snapshot.meta = { ...snapshot.meta, themePresetId: 'modern' };
    snapshot.vfsFiles['/src/components/SharedRuntime.tsx'] = 'export const source = "snapshot";';

    const artifacts = buildCanonicalLaunchArtifacts({
      generatedFiles: {
        '/src/pages/Home.tsx': 'export default function Home(){ return <main>Rich Home</main>; }',
      },
      preferredEntryPoint: '/src/App.tsx',
      siteBundleSnapshot: snapshot,
      compiledPlayground: {
        vfsFiles: {
          ...snapshot.vfsFiles,
          '/src/components/SharedRuntime.tsx': 'export const source = "stale-compile";',
        },
      },
      themePresetId: 'modern',
      strictPreflight: true,
    });

    expect(artifacts.files['/src/components/SharedRuntime.tsx']).toContain('snapshot');
    expect(artifacts.siteBundleSnapshot?.vfsFiles['/src/components/SharedRuntime.tsx']).toContain('snapshot');
  });

  it("can preserve generated wizard output without merging canonical snapshot files", () => {
    const snapshot = createSnapshot();
    const artifacts = buildCanonicalLaunchArtifacts({
      generatedFiles: {
        "/src/App.tsx": "export default function App(){ return <main>Wizard First</main>; }",
        "/src/index.css": snapshot.vfsFiles["/src/index.css"],
      },
      preferredEntryPoint: "/src/App.tsx",
      siteBundleSnapshot: snapshot,
      compiledPlayground: { vfsFiles: snapshot.vfsFiles },
      mergeWithCanonicalSnapshot: false,
      businessId: "biz_456",
      projectId: "project_456",
      systemType: "agency",
      systemName: "Acme Co",
      templateName: "Acme Launch",
      templateCategory: "landing",
      businessName: "Acme Co",
      industry: "agency",
      aesthetic: "modern",
      backendRequired: false,
    });

    expect(artifacts.files["/src/App.tsx"]).toContain("Wizard First");
    expect(artifacts.files["/src/pages/Home.tsx"]).toBeUndefined();
    expect(artifacts.files[CANONICAL_METADATA_FILE_PATHS.runtimeManifest]).toContain("\"sessionKey\"");
  });

  it("uses complete generated page output while retaining canonical router authority", () => {
    const snapshot = createSnapshot();
    // Wizard-themed bundle with a registered About route.
    snapshot.meta = { ...snapshot.meta, themePresetId: "modern" };
    const aboutPage = {
      ...snapshot.pageRegistry.pages[snapshot.pageRegistry.homePageId!],
      pageId: "page_about",
      title: "About",
      path: "/about",
      isHome: false,
      filePath: "/src/pages/About.tsx",
    };
    snapshot.pageRegistry.pages["page_about"] = aboutPage as typeof aboutPage;
    // Canonical scaffold ships minimal stubs.
    snapshot.vfsFiles["/src/pages/Home.tsx"] =
      "export default function Home(){ return <div>Canonical Home Stub</div>; }";
    snapshot.vfsFiles["/src/pages/About.tsx"] =
      "export default function About(){ return <div>Canonical About Stub</div>; }";

    const artifacts = buildCanonicalLaunchArtifacts({
      generatedFiles: {
        // Complete generated pages for both routes must survive the merge.
        "/src/pages/Home.tsx":
          "import Hero from '../components/Hero';\nexport default function Home(){ return <main className='bg-background text-foreground'><Hero/>Rich Home</main>; }",
        "/src/pages/About.tsx":
          "export default function About(){ return <main className='bg-background text-foreground'>Rich About</main>; }",
        "/src/components/Hero.tsx":
          "export default function Hero(){ return <section>Rich hero</section>; }",
      },
      preferredEntryPoint: "/src/App.tsx",
      siteBundleSnapshot: snapshot,
      compiledPlayground: { vfsFiles: snapshot.vfsFiles },
      themePresetId: "modern",
      businessId: "biz_789",
      projectId: "project_789",
      systemType: "agency",
      systemName: "Acme Co",
      templateName: "Acme Launch",
      templateCategory: "landing",
      businessName: "Acme Co",
      industry: "agency",
      aesthetic: "modern",
      backendRequired: false,
    });

    expect(artifacts.files["/src/pages/Home.tsx"]).toContain("Rich Home");
    expect(artifacts.files["/src/pages/About.tsx"]).toContain("Rich About");
    expect(artifacts.files["/src/pages/Home.tsx"]).not.toContain("Canonical Home Stub");
    expect(artifacts.files["/src/pages/About.tsx"]).not.toContain("Canonical About Stub");
    // Canonical router still owns /src/App.tsx.
    expect(artifacts.files["/src/App.tsx"]).toContain("Routes");
  });

  it("fails the launch when generated output omits a registered page instead of masking it", () => {
    const snapshot = createSnapshot();
    const aboutPage = {
      ...snapshot.pageRegistry.pages[snapshot.pageRegistry.homePageId!],
      pageId: "page_about",
      title: "About",
      path: "/about",
      isHome: false,
      filePath: "/src/pages/About.tsx",
    };
    snapshot.pageRegistry.pages["page_about"] = aboutPage as typeof aboutPage;
    snapshot.vfsFiles["/src/pages/About.tsx"] =
      "export default function About(){ return <div>Canonical About Fallback</div>; }";

    expect(() => buildCanonicalLaunchArtifacts({
      generatedFiles: {
        "/src/pages/Home.tsx": "export default function Home(){ return <main>Wizard Home</main>; }",
      },
      preferredEntryPoint: "/src/App.tsx",
      siteBundleSnapshot: snapshot,
      compiledPlayground: { vfsFiles: snapshot.vfsFiles },
      allowCanonicalPageFallback: false,
      businessId: "biz_strict",
      projectId: "project_strict",
      systemType: "agency",
      systemName: "Acme Co",
      templateName: "Acme Launch",
      templateCategory: "landing",
      businessName: "Acme Co",
      industry: "agency",
      aesthetic: "modern",
      backendRequired: false,
    })).toThrow(/Canonical compiler output is missing 1 registered page/);
  });


  it("refuses to persist a quarantined wizard page when strict preflight is enabled", () => {
    const snapshot = createSnapshot();

    expect(() => buildCanonicalLaunchArtifacts({
      generatedFiles: {
        "/src/pages/Home.tsx": "export default function Home(){ return <main><section>Broken</section>; } }",
      },
      preferredEntryPoint: "/src/App.tsx",
      siteBundleSnapshot: snapshot,
      compiledPlayground: { vfsFiles: snapshot.vfsFiles },
      themePresetId: "modern",
      strictPreflight: true,
    })).toThrow(/refusing to persist quarantine scaffolds.*Unterminated JSX contents/);
  });

  it('refuses to persist a Wizard VFS with an unresolved JSX import contract', () => {
    const snapshot = createSnapshot();

    expect(() => buildCanonicalLaunchArtifacts({
      generatedFiles: {
        '/src/pages/Home.tsx': [
          "import { MissingHero, MissingCaption } from '../components/HeroParts';",
          'export default function Home(){ return <main><MissingHero /><MissingCaption /></main>; }',
        ].join('\n'),
        '/src/components/HeroParts.tsx': 'export function HeroTitle(){ return <h1>Ready</h1>; } export function HeroCopy(){ return <p>Ready</p>; }',
      },
      preferredEntryPoint: '/src/App.tsx',
      siteBundleSnapshot: snapshot,
      compiledPlayground: { vfsFiles: snapshot.vfsFiles },
      themePresetId: 'modern',
      strictPreflight: true,
    })).toThrow(/Generated pages failed the local import contract:.*Home\.tsx imports MissingHero.*HeroTitle, HeroCopy/i);
  });

  it('normalizes the legacy relative RevealGroup import onto the primitive kit', () => {
    const snapshot = createSnapshot();
    const faqPage = createBuilderPage('page_faq', 'FAQ', '/faq', 'faq', {
      filePath: '/src/pages/Faq.tsx',
      showInNav: true,
      navOrder: 1,
    });
    snapshot.pageRegistry.pages[faqPage.pageId] = faqPage;

    const artifacts = buildCanonicalLaunchArtifacts({
      generatedFiles: {
        '/src/pages/Home.tsx': 'export default function Home(){ return <main><h1>Home</h1><p>Welcome.</p></main>; }',
        '/src/pages/Faq.tsx': [
          "import { RevealGroup } from './components/RevealGroup';",
          'export default function Faq(){ return <RevealGroup><main>Answers</main></RevealGroup>; }',
        ].join('\n'),
      },
      preferredEntryPoint: '/src/App.tsx',
      siteBundleSnapshot: snapshot,
      compiledPlayground: { vfsFiles: snapshot.vfsFiles },
      themePresetId: 'modern',
      strictPreflight: true,
    });

    expect(artifacts.files['/src/pages/components/RevealGroup.tsx']).toBeUndefined();
    expect(artifacts.files['/src/pages/Faq.tsx']).toContain("from '@/unison/ui/motion'");
    expect(artifacts.files['/src/pages/Faq.tsx']).not.toContain("./components/RevealGroup");
  });
});
