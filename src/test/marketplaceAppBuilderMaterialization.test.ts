import { describe, expect, it, vi } from 'vitest';
import { AUTHORED_MARKETPLACE_TEMPLATES } from '@/marketplace/authoredTemplatePreviews';
import { buildConceptDraftSource } from '@/marketplace/conceptDraftSource';
import { buildAppBuilderGenerationContext } from '@/services/app-builder/appBuilderGenerationContext';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), compile: vi.fn() }));
vi.mock('@/services/app-builder/UnisonAppBuilder', () => ({ unisonAppBuilder: { generate: mocks.generate } }));
vi.mock('@/services/canonicalLaunchVfs', () => ({
  buildCanonicalLaunchArtifacts: mocks.compile,
  buildCanonicalLaunchArtifactsAsync: async (input: unknown, options: { yieldToHost: () => Promise<void>; signal?: AbortSignal }) => {
    await options.yieldToHost();
    if (options.signal?.aborted) throw options.signal.reason;
    return mocks.compile(input);
  },
}));
vi.mock('@/marketplace/materializePreviewImages', () => ({ materializePreviewImages: async (files: Record<string, string>) => files }));
import { materializeTemplateWithAppBuilder } from '@/marketplace/materializeTemplateWithAppBuilder';

describe('marketplace App Builder convergence', () => {
  it('materializes the Aster template variants in its canonical design-source manifest', async () => {
    mocks.generate.mockClear();
    mocks.compile.mockClear();
    const template = AUTHORED_MARKETPLACE_TEMPLATES.find((item) => item.id === 'aster-skin-studio');
    if (!template) throw new Error('Missing Aster template');
    const material = buildConceptDraftSource(template);
    const files = { ...material.files };
    for (const page of Object.values(material.siteBundleSnapshot.pageRegistry.pages)) {
      if (page.filePath) files[page.filePath] = 'export default function Page(){ return <main /> }';
    }
    mocks.generate.mockResolvedValue({ candidate: { status: 'ready-for-commit' }, stopReason: 'complete', candidateFiles: files });
    mocks.compile.mockReturnValue({ files });
    const statuses: string[] = [];

    await materializeTemplateWithAppBuilder(
      material,
      { projectId: 'buyer-project', businessId: 'buyer-business', siteId: 'buyer-site', draftId: 'buyer-draft', buildId: 'build', bundleId: 'bundle' },
      { onStatus: (label) => statuses.push(label) },
    );
    expect(statuses).toEqual(expect.arrayContaining([
      'Preparing template design and bindings',
      'Embedding template images',
      'Building canonical preview and runtime',
    ]));

    const request = mocks.generate.mock.calls.at(-1)?.[0];
    expect(request.contract.design.registryContext.sections.find((section: { type: string }) => section.type === 'services')?.allowedVariantIds)
      .toContain('services:product-cards');
    expect(request.contract.design.sourceSelection.implementationIds).toContain('services:product-cards');
    const generation = buildAppBuilderGenerationContext(request.contract);
    expect(generation.materialization.manifest.implementations).toHaveProperty('services:product-cards');
    expect(generation.materialization.manifest.implementations).toHaveProperty('faq:accordion');
    expect(generation.materialization.manifest.implementations).toHaveProperty('navbar:minimal-dark');
    expect(generation.materialization.manifest.implementations).toHaveProperty('hero:split-image');
    expect(generation.materialization.manifest.implementations).toHaveProperty('services:editorial-rows');
    expect(generation.materialization.manifest.implementations).toHaveProperty('cta:inset-panel');
    expect(generation.runtimeContextForPage('treatments')).toContain('services:product-cards');
    expect(generation.runtimeContextForPage('treatments')).toContain('faq:accordion');
    expect(generation.runtimeContextForPage('treatments')).toContain('navbar:minimal-dark');
  });

  it('passes preview material and sealed topology to App Builder before compilation', async () => {
    mocks.generate.mockClear();
    mocks.compile.mockClear();
    const template = AUTHORED_MARKETPLACE_TEMPLATES.find(item => item.id === 'pollen-objects');
    if (!template) throw new Error('Missing Pollen template');
    const material = buildConceptDraftSource(template);
    const files = { ...material.files };
    for (const page of Object.values(material.siteBundleSnapshot.pageRegistry.pages)) {
      if (page.filePath) files[page.filePath] = 'export default function Page(){ return <main>Accepted by App Builder</main> }';
    }
    mocks.generate.mockResolvedValue({ candidate: { status: 'ready-for-commit' }, stopReason: 'complete', candidateFiles: files });
    mocks.compile.mockReturnValue({ files });
    const result = await materializeTemplateWithAppBuilder(material, { projectId: 'buyer-project', businessId: 'buyer-business', siteId: 'buyer-site', draftId: 'buyer-draft', buildId: 'build', bundleId: 'bundle' });
    const request = mocks.generate.mock.calls[0][0];
    expect(request.contract.identity.projectId).toBe('buyer-project');
    expect(request.reuseAcceptedPages).toBe(false);
    expect(request.pageCheck('/src/pages/home.tsx', material.files['/src/pages/home.tsx'], material.files)).toHaveLength(1);
    expect(request.pageCheck('/src/pages/home.tsx', files['/src/pages/home.tsx'], files)).toEqual([]);
    expect(request.contract.business.intents).toContain('cart.add');
    expect(request.contract.business.capabilities).toContain('commerce');
    expect(request.contract.business.intentBindings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        bindingId: expect.stringMatching(/^marketplace:pollen:home:/),
        coreIntent: 'nav.anchor',
        domIntent: 'nav.anchor',
        sourceSlot: 'brand-link',
        targetType: 'url',
        targetId: '#top',
      }),
      expect.objectContaining({
        bindingId: expect.stringMatching(/^marketplace:pollen:add-cup:/),
        coreIntent: 'cart.add',
        targetType: 'product',
        targetId: expect.not.stringContaining('pollen:sunday-cup'),
      }),
      expect.objectContaining({
        bindingId: 'marketplace:route:home:materials',
        coreIntent: 'nav.goto',
        domIntent: 'nav.goto',
        sourceSlot: 'route-materials-link',
        targetType: 'page',
        targetId: 'materials',
      }),
    ]));
    expect(request.runtimeContext).toContain('Sunday cup');
    expect(request.runtimeContext).toContain('MARKETPLACE TEMPLATE DESIGN LOCK');
    expect(request.runtimeContext).toContain(template.pages[0].sections[0].id);
    expect(request.contract.topology.sitePlan.pages.map((p: { id: string }) => p.id)).toEqual(['home', ...template.pages.map(page => page.id)]);
    expect(request.initialFiles['/src/marketplace/selectedPreview.tsx']).toBe(material.files['/src/marketplace/selectedPreview.tsx']);
    expect(request.contract.design.artDirection.storagePackId).toBe(material.siteBundleSnapshot.meta.artDirectionPackId);
    expect(mocks.compile.mock.calls[0][0].generatedFiles['/src/pages/home.tsx']).toBe(files['/src/pages/home.tsx']);
    expect(result.files).toBe(files);
    mocks.generate.mockResolvedValue({ candidate: { status: 'ready-for-commit' }, stopReason: 'complete', candidateFiles: material.files });
    mocks.compile.mockClear();
    await expect(materializeTemplateWithAppBuilder(material, { projectId: 'buyer-project', businessId: 'buyer-business', siteId: 'buyer-site', draftId: 'buyer-draft', buildId: 'build', bundleId: 'bundle' })).rejects.toThrow('still depends on preview material');
    expect(mocks.compile).not.toHaveBeenCalled();
    const releaseBinding = {
      bindingId: 'seller-contact-binding', sourcePageId: 'home', sourceLabel: 'Contact',
      intent: 'form.open', targetId: 'seller-form-id', targetType: 'form', confidence: 1,
      source: 'manual', isValid: true, sourceSection: 'contact', sourceSlot: 'contact-submit',
      coreIntent: 'contact.submit',
    };
    const releaseMaterial = {
      ...material,
      portableBindings: undefined,
      siteBundleSnapshot: { ...material.siteBundleSnapshot, bindings: { 'seller-contact-binding': releaseBinding } },
    };
    mocks.generate.mockResolvedValue({ candidate: { status: 'ready-for-commit' }, stopReason: 'complete', candidateFiles: files });
    mocks.compile.mockReturnValue({ files });
    await materializeTemplateWithAppBuilder(releaseMaterial, { projectId: 'buyer-project', businessId: 'buyer-business', siteId: 'buyer-site', draftId: 'buyer-draft', buildId: 'build', bundleId: 'bundle' });
    const releaseContract = mocks.generate.mock.calls.at(-1)?.[0].contract;
    expect(releaseContract.business.intentBindings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        coreIntent: 'contact.submit',
        targetType: 'form',
        targetId: expect.not.stringMatching(/seller-form-id/),
      }),
    ]));
    mocks.generate.mockResolvedValue({ candidate: { status: 'rejected', diagnostics: ['Syntax error'] }, stopReason: 'validation-failed' });
    mocks.compile.mockClear();
    await expect(materializeTemplateWithAppBuilder(material, { projectId: 'buyer-project', businessId: 'buyer-business', siteId: 'buyer-site', draftId: 'buyer-draft', buildId: 'build', bundleId: 'bundle' })).rejects.toThrow('Syntax error');
    expect(mocks.compile).not.toHaveBeenCalled();
  });
});