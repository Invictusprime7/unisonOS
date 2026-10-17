import { describe, expect, it } from 'vitest';
import { aiComposerRequestSchema } from '@/contracts/aiComposerContract';
import {
  assembleCanonicalAuthoringRequest,
  resolveCanonicalAuthoringPage,
  shouldUseCanonicalComposer,
} from '@/services/builder/canonicalAuthoringRequest';
import { buildWizardAggregatedRegistryContext } from '@/services/launch/wizardRegistryAggregation';

const files = {
  '/src/pages/Home.tsx': "import Hero from '../project-components/Hero'; export default function Home(){return <Hero/>}",
  '/src/project-components/Hero.tsx': 'export default function Hero(){return <h1>Exact source</h1>}',
  '/src/index.css': '@tailwind base;',
  '/package.json': '{"dependencies":{"react":"latest"}}',
  '/.unison/wizard-registry-context.json': '{"version":"1","sections":[{"type":"hero"}]}',
  '/.unison/site-bundle-snapshot.json': JSON.stringify({
    pageRegistry: { pages: { home: { title: 'Home', path: '/' } } },
  }),
};

describe('canonical AI authorship request assembly', () => {
  it('proceeds with a note when a supporting import exceeds the source budget', async () => {
    const assembled = await assembleCanonicalAuthoringRequest({
      task: 'builder_source_edit', page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Edit hero', knowledgeQuery: 'hero', baseFiles: { ...files, '/src/project-components/Hero.tsx': 'x'.repeat(60001) }, routes: [],
    });
    expect(assembled.evidence.sourceContextComplete).toBe(true);
    expect(assembled.evidence.omittedSourcePaths).toContain('/src/project-components/Hero.tsx');
    expect(assembled.request.runtimeContext).toContain('Not included for size');
  });
  it('fits multi-file edit targets that exceed the old 140k transport budget', async () => {
    const crowded = {
      ...files,
      '/src/index.css': 'x'.repeat(59_000),
      '/src/pages/Home.tsx': 'h'.repeat(59_000),
      '/src/pages/Pricing.tsx': 'p'.repeat(59_000),
    };
    const assembled = await assembleCanonicalAuthoringRequest({
      task: 'builder_source_edit', page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Edit theme and pages', knowledgeQuery: 'hero', baseFiles: crowded, routes: [],
      sourceTargets: ['/src/pages/Home.tsx', '/src/pages/Pricing.tsx', '/src/index.css'],
      instruction: 'Change the theme colors across home and pricing',
    });
    expect(assembled.evidence.sourceContextComplete).toBe(true);
    expect(assembled.evidence.sourcePaths).toContain('/src/index.css');
    expect(assembled.evidence.sourcePaths).toContain('/src/pages/Home.tsx');
    expect(assembled.evidence.sourcePaths).toContain('/src/pages/Pricing.tsx');
  });
  it('reports incomplete context when the edited file itself exceeds the budget', async () => {
    const assembled = await assembleCanonicalAuthoringRequest({
      task: 'builder_source_edit', page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Edit hero', knowledgeQuery: 'hero', baseFiles: { ...files, '/src/pages/Home.tsx': 'x'.repeat(150001) }, routes: [],
    });
    expect(assembled.evidence.sourceContextComplete).toBe(false);
  });
  it('keeps uploaded document links and extracted text ahead of optional runtime context', async () => {
    const attachmentContext = '[Attached file: brief.md]\nOwner-written brief\nurl: https://example.test/brief.md';
    const assembled = await assembleCanonicalAuthoringRequest({
      task: 'builder_source_edit',
      page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Edit the accepted page.', knowledgeQuery: 'home', baseFiles: files, routes: [],
      attachmentContext, runtimeContext: 'Optional site context'.repeat(2000),
    });
    expect(assembled.request.runtimeContext?.startsWith(attachmentContext)).toBe(true);
    expect(assembled.request.runtimeContext?.length).toBe(12000);
    expect(aiComposerRequestSchema.safeParse(assembled.request).success).toBe(true);
  });

  it('keeps text-only turns free of an invented attachment context', async () => {
    const assembled = await assembleCanonicalAuthoringRequest({
      task: 'builder_source_edit',
      page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Edit the page.', knowledgeQuery: 'home', baseFiles: files, routes: [],
      runtimeContext: 'Existing runtime evidence',
    });
    expect(assembled.request.runtimeContext).toBe('Existing runtime evidence');
  });
  it('routes ordinary React source edits to Composer and leaves specialized lanes alone', () => {
    const base = {
      isReactProject: true, isLaunchPlanningRequest: false,
      isCatalogMutationRequest: false, hasVfs: true,
    };
    expect(shouldUseCanonicalComposer(base)).toBe(true);
    expect(shouldUseCanonicalComposer({ ...base, isCatalogMutationRequest: true })).toBe(false);
    expect(shouldUseCanonicalComposer({ ...base, isLaunchPlanningRequest: true })).toBe(false);
    expect(shouldUseCanonicalComposer({ ...base, isReactProject: false })).toBe(false);
    expect(shouldUseCanonicalComposer({ ...base, isScopedEdit: true })).toBe(true);
  });

  it('resolves Builder targets from accepted page topology', () => {
    const withTopology = {
      ...files,
      '/.unison/site-bundle-snapshot.json': JSON.stringify({
        pageRegistry: { pages: {
          home: { title: 'Home', path: '/', filePath: '/src/pages/Home.tsx', pageType: 'home' },
          pricing: { title: 'Pricing', path: '/pricing', filePath: '/src/pages/Pricing.tsx', pageType: 'pricing' },
        } },
      }),
      '/src/pages/Pricing.tsx': 'export default function Pricing(){return <main/>}',
    };

    expect(resolveCanonicalAuthoringPage(withTopology, '/src/pages/Pricing.tsx')).toEqual({
      role: 'pricing', title: 'Pricing', route: '/pricing', filePath: '/src/pages/Pricing.tsx',
    });
  });

  it('uses complete transitive source and records hashed evidence', async () => {
    const assembled = await assembleCanonicalAuthoringRequest({
      task: 'builder_source_edit',
      page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Keep the current visual language.',
      knowledgeQuery: 'editorial home',
      instruction: 'Make the hero more editorial.',
      baseFiles: files,
      baseRevisionId: 'revision-42',
      routes: [],
    });

    expect(aiComposerRequestSchema.safeParse(assembled.request).success).toBe(true);
    expect(assembled.request.files['/src/pages/Home.tsx']).toBe(files['/src/pages/Home.tsx']);
    expect(assembled.request.files['/src/project-components/Hero.tsx']).toBe(files['/src/project-components/Hero.tsx']);
    expect(assembled.request.routes).toEqual([{ title: 'Home', route: '/' }]);
    expect(assembled.evidence).toMatchObject({
      baseRevisionId: 'revision-42',
      sourceContextComplete: true,
      registryContextHash: expect.stringMatching(/^(sha256|fnv1a):/),
      knowledgeContextHash: expect.stringMatching(/^sha256:/),
    });
    expect(assembled.evidence.availableOperations).toContain('add_page');
  });

  it('changes the source evidence hash when exact source bytes change', async () => {
    const input = {
      task: 'site_page_author' as const,
      page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Author home.', knowledgeQuery: 'home', baseFiles: files, routes: [],
    };
    const first = await assembleCanonicalAuthoringRequest(input);
    const second = await assembleCanonicalAuthoringRequest({
      ...input,
      baseFiles: { ...files, '/src/project-components/Hero.tsx': 'export default function Hero(){return <h1>Changed</h1>}' },
    });

    expect(first.evidence.sourceContextHash).not.toBe(second.evidence.sourceContextHash);
  });

  it('serializes one complete bounded registry projection with valid project imports', async () => {
    const assembled = await assembleCanonicalAuthoringRequest({
      task: 'builder_source_edit',
      page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Redesign the hero.',
      knowledgeQuery: 'editorial hero',
      baseFiles: files,
      routes: [],
      registryContext: buildWizardAggregatedRegistryContext({
        industry: 'store',
        templateId: 'store-premium',
        themePresetId: 'commerce-editorial',
      }),
    });

    const registry = JSON.parse(assembled.request.registryContext!) as Record<string, unknown>;
    expect(assembled.request.registryContext!.length).toBeLessThanOrEqual(60000);
    expect(registry).toMatchObject({
      industry: 'store',
      portableRecipeIds: expect.any(Array),
      validImportPaths: expect.arrayContaining(['@/pages/Home', '@/project-components/Hero']),
    });
    expect(registry).toHaveProperty('artDirectionGrammar');
    expect(registry).toHaveProperty('primitiveFamilies');
    expect(registry).toHaveProperty('capabilityRequirements');
  });
});
