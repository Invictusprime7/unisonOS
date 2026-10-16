import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { createUnisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { APP_BUILDER_PROTOCOL_VERSION, type AppBuildContract } from '@/services/app-builder/appBuilderContracts';
import type { ComposerLoopResult } from '@/services/builder/aiRepairLoop';

const baseFiles = {
  '/src/pages/Home.tsx': 'export default function Home(){return <main>Before</main>}',
  '/package.json': JSON.stringify({ dependencies: { react: '^18.3.1' } }),
};

function contract(): AppBuildContract {
  const designContext = compileResolvedSiteDesignContext({
    designSeed: 'app-builder-test',
    businessModel: 'general' as never,
    industry: 'salon',
    roles: ['home'],
  });
  return {
    protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
    identity: { projectId: 'project-1', businessId: 'business-1', siteId: 'site-1', systemType: 'website' },
    topology: {
      sitePlan: {
        siteId: 'topology-1', industry: 'salon', businessName: 'Northstar', homePageId: 'home',
        pages: [{ id: 'home', name: 'home', title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx', visibleInNav: true, isHome: true, generatedBy: 'wizard' }],
        navItems: ['home'], funnels: [], redirects: [], generatedAt: '2026-09-30T12:00:00.000Z',
      },
      pageRegistry: { pages: {}, funnels: {}, homePageId: 'home', version: 1 },
    },
    business: {
      industry: 'salon', businessName: 'Northstar', goals: [], intents: [], capabilities: [], bindingGuide: '',
      branding: {
        version: '1.0',
        brandMark: {
          source: { kind: 'business-profile', field: 'logoUrl' },
          placements: [{ artifactId: 'navbar', slotId: 'navbar.brand' }, { artifactId: 'footer', slotId: 'footer.brand' }],
          image: { objectFit: 'contain', preserveAspectRatio: true, maxWidthPx: 180, maxHeightPx: 48 },
          accessibleName: 'Northstar', missingAssetFallback: { kind: 'text-wordmark', text: 'Northstar' },
        },
        logoCloud: { artifactId: 'logo-cloud', source: 'owner-authored', minimumItems: 4, emptyBehavior: 'hide_section', generatedEntriesAllowed: false },
      },
    },
    design: {
      seed: 'app-builder-test', themePresetId: 'editorial', themeTokens: {} as never,
      artDirection: {} as never, resolvedSiteDesignContext: designContext,
      uiFoundation: {} as never, registryContext: {} as never,
      compositionPlan: { industryId: 'salon', seed: 'app-builder-test', pages: [] },
      sourceSelection: { implementationIds: [], portableRecipeIds: [], primitiveFamilyIds: [], experiencePrimitiveIds: [], pageCompositionIds: [] },
    },
    runtime: {
      framework: 'react-vite', language: 'typescript', styling: 'tailwind',
      protectedPaths: [], approvedDependencies: [], approvedExperienceCapabilities: [],
    },
  };
}

describe('UnisonAppBuilder facade', () => {
  it('is the shared product boundary for Launcher generation and Builder source edits', () => {
    const launcher = readFileSync('src/services/launch/launchOrchestrator.ts', 'utf8');
    const builder = readFileSync('src/components/creatives/web-builder/AIBuilderPanel.tsx', 'utf8');

    expect(launcher).toContain('unisonAppBuilder.generate({');
    expect(builder).toContain('unisonAppBuilder.edit({');
    expect(builder).toContain('promptAnalysis.structuredDirective');
    expect(launcher).not.toContain('authorSitePages({');
    expect(builder).not.toContain('runComposerRepairLoop({');
    const orchestrator = readFileSync('src/services/app-builder/appBuilderOrchestrator.ts', 'utf8');
    expect(orchestrator).not.toContain('commitMutation');
    expect(orchestrator).not.toContain('persistAiCommit');
  });

  it('adapts site authoring behind generate and preserves the candidate result', async () => {
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: { ...input.files, '/src/pages/Home.tsx': 'export default function Home(){return <main>After</main>}' },
      revisionId: 'revision-2',
      outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
    }));
    const builder = createUnisonAppBuilder({ authorSite });
    const result = await builder.generate({
      operationId: 'operation-1', contract: contract(), initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: 'revision-1',
    });

    expect(authorSite).toHaveBeenCalledOnce();
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.candidate.files['/src/pages/Home.tsx']).toContain('After');
    expect(result.candidateFiles).toBe(result.candidate.files);
    expect(result.candidate.closure?.ok).toBe(true);
    expect(result.candidate.provenance?.strategy).toBe('ai-candidate');
    expect(result.revisionId).toBe('revision-2');
  });

  it('repairs site-wide closure in memory before returning a candidate', async () => {
    const brokenFiles = {
      ...baseFiles,
      '/src/pages/Home.tsx': 'import Card from "../project-components/Card"; export default function Home(){return <Card />}',
    };
    const repairedFiles = {
      ...brokenFiles,
      '/src/project-components/Card.tsx': 'export default function Card(){return <section>Card</section>}',
    };
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: brokenFiles,
      revisionId: input.revisionId,
      outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
    }));
    const changeSet = {
      id: 'cand_closure', provenance: { origin: 'repair' as const, knowledgeVersion: 'test' },
      fileOps: [{ type: 'create' as const, path: '/src/project-components/Card.tsx', content: repairedFiles['/src/project-components/Card.tsx'] }],
      routeOps: [], targetPages: ['home'], attempt: 1,
    };
    const runComposer = vi.fn(async (): Promise<ComposerLoopResult> => ({
      ok: true, reason: 'accepted', attempts: 1, errors: [],
      prepared: {
        ok: true,
        build: { changeSet, candidateFiles: repairedFiles, refused: [] },
        gates: { passed: true, failures: [], advisories: [] },
        nextFiles: repairedFiles,
        errors: [],
      },
    }));
    const result = await createUnisonAppBuilder({ authorSite, runComposer }).generate({
      operationId: 'operation-closure', contract: contract(), initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
    });

    expect(runComposer).toHaveBeenCalledOnce();
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.candidateFiles['/src/project-components/Card.tsx']).toContain('Card');
    expect(result.candidate.closure?.ok).toBe(true);
    expect(result.candidate.provenance?.strategy).toBe('ai-candidate+closure-repair');
    expect(result.revisionId).toBeNull();
  });

  it('generates a complete multi-page candidate without a canonical commit callback', async () => {
    const multiPage = contract();
    multiPage.topology.sitePlan.pages.push({
      id: 'contact', name: 'contact', title: 'Contact', route: '/contact', role: 'contact',
      filePath: '/src/pages/Contact.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard',
    });
    multiPage.design.resolvedSiteDesignContext = compileResolvedSiteDesignContext({
      designSeed: 'app-builder-test', businessModel: 'general' as never,
      industry: 'salon', roles: ['home', 'contact'],
    });
    const candidateFiles = {
      ...baseFiles,
      '/src/pages/Home.tsx': 'import Mark from "../project-components/Mark"; export default function Home(){return <main><Mark /></main>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact us</main>}',
      '/src/project-components/Mark.tsx': 'export default function Mark(){return <span>Northstar</span>}',
    };
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: candidateFiles,
      revisionId: input.revisionId,
      outcomes: input.pages.map((page) => ({ page, status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] })),
    }));
    const result = await createUnisonAppBuilder({ authorSite }).generate({
      operationId: 'operation-multi-page', contract: multiPage, initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
    });

    expect(authorSite.mock.calls[0][0].commitPage).toBeTypeOf('function');
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.candidate.closure?.ok).toBe(true);
    expect(result.candidateFiles['/src/pages/Contact.tsx']).toContain('Contact us');
    expect(result.candidateFiles['/src/project-components/Mark.tsx']).toContain('Northstar');
    expect(result.revisionId).toBeNull();
  });

  it('generates an in-builder page candidate with scoped files and topology ops', async () => {
    const page = {
      pageId: 'focus', title: 'Focus', route: '/focus', filePath: '/src/pages/Focus.tsx',
      role: 'custom', pageType: 'custom' as const, showInNav: true,
    };
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: { ...input.files, [page.filePath]: 'export default function Focus(){return <main>Focus</main>}' },
      revisionId: input.revisionId,
      outcomes: input.pages.map((target) => ({ page: target, status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] })),
    }));
    const result = await createUnisonAppBuilder({ authorSite }).generatePages({
      operationId: 'operation-page-generation',
      baseRevisionId: 'revision-1',
      currentFiles: baseFiles,
      pages: [page],
      existingRoutes: [{ title: 'Home', route: '/' }],
      businessName: 'Northstar',
      industry: 'salon',
    });

    expect(authorSite).toHaveBeenCalledOnce();
    expect(authorSite.mock.calls[0][0].candidateOrigin).toBe('builder');
    expect(authorSite.mock.calls[0][0].initialRouteOps).toEqual([
      expect.objectContaining({ type: 'add_page', pageId: 'focus', route: '/focus' }),
    ]);
    expect(result.status).toBe('ready-for-commit');
    expect(result.candidateFiles[page.filePath]).toContain('Focus');
    expect(result.changeSet?.provenance.origin).toBe('builder');
    expect(result.changeSet?.routeOps).toEqual([
      expect.objectContaining({ type: 'add_page', pageId: 'focus', route: '/focus' }),
    ]);
  });

  it('rejects an existing route before invoking the page author', async () => {
    const authorSite = vi.fn();
    const result = await createUnisonAppBuilder({ authorSite: authorSite as never }).generatePages({
      operationId: 'operation-page-collision',
      currentFiles: baseFiles,
      pages: [{
        pageId: 'about-new', title: 'About', route: '/about', filePath: '/src/pages/AboutNew.tsx',
        role: 'about', pageType: 'about',
      }],
      existingRoutes: [{ title: 'About', route: '/About/' }],
      businessName: 'Northstar',
    });

    expect(result.status).toBe('rejected');
    expect(result.diagnostics[0]).toContain('Route already exists');
    expect(authorSite).not.toHaveBeenCalled();
  });

  it('rejects files outside the generated page directory before authoring', async () => {
    const authorSite = vi.fn();
    const result = await createUnisonAppBuilder({ authorSite: authorSite as never }).generatePages({
      operationId: 'operation-page-scope',
      currentFiles: baseFiles,
      pages: [{
        pageId: 'runtime', title: 'Runtime', route: '/runtime', filePath: '/.unison/runtime-manifest.json',
        role: 'custom', pageType: 'custom',
      }],
      businessName: 'Northstar',
    });

    expect(result.status).toBe('rejected');
    expect(result.diagnostics[0]).toContain('must be TypeScript files under /src/pages/');
    expect(authorSite).not.toHaveBeenCalled();
  });

  it('routes Builder edits through the existing Composer repair gates', async () => {
    const nextFiles = { ...baseFiles, '/src/pages/Home.tsx': 'export default function Home(){return <main>Edited</main>}' };
    const changeSet = {
      id: 'cand_edit', baseRevisionId: 'revision-1',
      provenance: { origin: 'builder' as const, knowledgeVersion: 'test' },
      fileOps: [{ type: 'replace' as const, path: '/src/pages/Home.tsx', content: nextFiles['/src/pages/Home.tsx'] }],
      routeOps: [], targetPages: ['home'], attempt: 1,
    };
    const composer: ComposerLoopResult = {
      ok: true, reason: 'accepted', attempts: 1, errors: [], response: { summary: 'Edited safely' } as never,
      prepared: {
        ok: true,
        build: { changeSet, candidateFiles: nextFiles, refused: [] },
        gates: { passed: true, failures: [], advisories: [] },
        nextFiles,
        errors: [],
      },
    };
    const runComposer = vi.fn(async () => composer);
    const builder = createUnisonAppBuilder({ runComposer });
    const result = await builder.edit({
      operationId: 'operation-edit', baseRevisionId: 'revision-1', currentFiles: baseFiles,
      instruction: 'Change the headline',
      page: { title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx' },
      sourceTargets: ['/src/pages/Home.tsx'],
      gatewayOptions: { selectedModelId: 'openai/gpt-4.1', reasoningEffort: 'high', timeoutMs: 110_000 },
    });

    expect(runComposer).toHaveBeenCalledOnce();
    const firstCall = runComposer.mock.calls[0] as unknown as [{ gatewayOptions?: unknown }] | undefined;
    expect(firstCall?.[0].gatewayOptions).toEqual({ selectedModelId: 'openai/gpt-4.1', reasoningEffort: 'high', timeoutMs: 110_000 });
    expect(result.stopReason).toBe('complete');
    expect(result.changeSet).toBe(changeSet);
    expect(result.candidate.files).toEqual(nextFiles);
    expect(result.summary).toBe('Edited safely');
  });

  it('returns rejected candidates instead of bypassing failed gates', async () => {
    const runComposer = vi.fn(async (): Promise<ComposerLoopResult> => ({
      ok: false, reason: 'gates_exhausted', attempts: 3, errors: ['import-graph failed'],
    }));
    const result = await createUnisonAppBuilder({ runComposer }).edit({
      operationId: 'operation-rejected', baseRevisionId: 'revision-1', currentFiles: baseFiles,
      instruction: 'Break imports',
      page: { title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx' },
      sourceTargets: ['/src/pages/Home.tsx'],
    });

    expect(result.candidate.status).toBe('rejected');
    expect(result.stopReason).toBe('repair-exhausted');
    expect(result.candidate.files).toBe(baseFiles);
    expect(result.changeSet).toBeUndefined();
  });
});
