import { describe, expect, it, vi } from 'vitest';
import { AUTHORED_MARKETPLACE_TEMPLATES } from '@/marketplace/authoredTemplatePreviews';
import { buildConceptDraftSource } from '@/marketplace/conceptDraftSource';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), compile: vi.fn() }));
vi.mock('@/services/app-builder/UnisonAppBuilder', () => ({ unisonAppBuilder: { generate: mocks.generate } }));
vi.mock('@/services/canonicalLaunchVfs', () => ({ buildCanonicalLaunchArtifacts: mocks.compile }));
import { materializeTemplateWithAppBuilder } from '@/marketplace/materializeTemplateWithAppBuilder';

describe('marketplace App Builder convergence', () => {
  it('passes preview material and sealed topology to App Builder before compilation', async () => {
    const template = AUTHORED_MARKETPLACE_TEMPLATES.find(item => item.id === 'pollen-objects');
    if (!template) throw new Error('Missing Pollen template');
    const material = buildConceptDraftSource(template);
    const files = { ...material.files, '/src/pages/home.tsx': 'export default function Home(){ return <main>Accepted by App Builder</main> }' };
    mocks.generate.mockResolvedValue({ candidate: { status: 'ready-for-commit' }, stopReason: 'complete', candidateFiles: files });
    mocks.compile.mockReturnValue({ files });
    const result = await materializeTemplateWithAppBuilder(material, { projectId: 'buyer-project', businessId: 'buyer-business', siteId: 'buyer-site', draftId: 'buyer-draft', buildId: 'build', bundleId: 'bundle' });
    const request = mocks.generate.mock.calls[0][0];
    expect(request.contract.identity.projectId).toBe('buyer-project');
    expect(request.contract.topology.sitePlan.pages.map((p: { id: string }) => p.id)).toEqual(['home', ...template.pages.map(page => page.id)]);
    expect(request.initialFiles['/src/marketplace/selectedPreview.tsx']).toBe(material.files['/src/marketplace/selectedPreview.tsx']);
    expect(request.contract.design.artDirection.storagePackId).toBe(material.siteBundleSnapshot.meta.artDirectionPackId);
    expect(mocks.compile.mock.calls[0][0].generatedFiles['/src/pages/home.tsx']).toBe(files['/src/pages/home.tsx']);
    expect(result.files).toBe(files);
    mocks.generate.mockResolvedValue({ candidate: { status: 'rejected', diagnostics: ['Syntax error'] }, stopReason: 'validation-failed' });
    mocks.compile.mockClear();
    await expect(materializeTemplateWithAppBuilder(material, { projectId: 'buyer-project', businessId: 'buyer-business', siteId: 'buyer-site', draftId: 'buyer-draft', buildId: 'build', bundleId: 'bundle' })).rejects.toThrow('Syntax error');
    expect(mocks.compile).not.toHaveBeenCalled();
  });
});