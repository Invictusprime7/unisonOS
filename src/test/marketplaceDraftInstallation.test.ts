import { describe, expect, it, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), provision: vi.fn(), commit: vi.fn(), build: vi.fn(), concept: vi.fn(), seed: vi.fn(), bindings: vi.fn(), forms: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: mocks.getUser } } }));
vi.mock('@/services/confirmedLaunchProvisioner', () => ({ createConfirmedLaunchIds: () => ({}), provisionConfirmedLaunchSite: mocks.provision }));
vi.mock('@/services/vfsCommitService', () => ({ commitMutation: mocks.commit }));
vi.mock('@/marketplace/materializeTemplateWithAppBuilder', () => ({ materializeTemplateWithAppBuilder: mocks.build }));
vi.mock('@/marketplace/conceptDraftSource', () => ({ buildConceptDraftSource: mocks.concept }));
vi.mock('@/services/resources/seedLaunchAssets', () => ({ seedLaunchAssets: mocks.seed }));
vi.mock('@/services/persistGeneratedBindings', () => ({ persistGeneratedBindings: mocks.bindings }));
vi.mock('@/services/launchFormDefinitionPersistence', () => ({ persistLaunchFormDefinitions: mocks.forms }));
import { installTemplateDraft } from '@/marketplace/installTemplateDraft';
describe('template draft acceptance', () => {
  const selection = { kind: 'concept' as const, template: { name: 'Pollen Objects' } as never };
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.seed.mockResolvedValue({ created: 3 });
    mocks.bindings.mockResolvedValue({ failed: 0 });
    mocks.forms.mockResolvedValue({ error: null });
    const artifacts = { files: { '/src/App.tsx': 'source' }, entryPoint: '/src/App.tsx', runtimeManifest: {}, siteBundleSnapshot: { industry: 'ecommerce', meta: { themePresetId: 'modern' } } };
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'buyer' } } });
    mocks.concept.mockReturnValue(artifacts); mocks.build.mockReturnValue(artifacts);
    mocks.provision.mockResolvedValue({ businessId: 'business', projectId: 'project', draftId: 'draft', siteId: 'site' });
    mocks.commit.mockResolvedValue({ status: 'committed', persistedRevisionId: 'revision', vfsFiles: artifacts.files });
  });
  it('requires sign-in before creating a project', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(installTemplateDraft(selection)).rejects.toThrow('Sign in');
    expect(mocks.provision).not.toHaveBeenCalled();
  });
  it('saves through canonical acceptance before opening the buyer draft', async () => {
    const result = await installTemplateDraft(selection);
    expect(mocks.build).toHaveBeenCalledOnce();
    expect(mocks.build.mock.invocationCallOrder[0]).toBeLessThan(mocks.commit.mock.invocationCallOrder[0]);
    expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({ identity: expect.objectContaining({ userId: 'buyer', projectId: 'project', draftId: 'draft' }) }));
    expect(result).toMatchObject({ draftId: 'draft', revisionId: 'revision' });
    expect(mocks.seed).toHaveBeenCalledWith(expect.objectContaining({ businessId: 'business', projectId: 'project' }));
    expect(mocks.commit.mock.invocationCallOrder[0]).toBeLessThan(mocks.seed.mock.invocationCallOrder[0]);
    expect(mocks.bindings).toHaveBeenCalledWith(expect.objectContaining({ businessId: 'business', projectId: 'project' }));
  });
  it('does not persist when App Builder rejects the template', async () => {
    mocks.build.mockRejectedValue(new Error('App Builder could not prepare this template'));
    await expect(installTemplateDraft(selection)).rejects.toThrow('App Builder');
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.seed).not.toHaveBeenCalled();
  });
  it('never reports installation if a durable revision was not saved', async () => {
    mocks.commit.mockResolvedValue({ status: 'committed', persistedRevisionId: null });
    await expect(installTemplateDraft(selection)).rejects.toThrow('not saved');
    expect(mocks.seed).not.toHaveBeenCalled();
  });
  it('reports page progress and never saves a stopped install', async () => {
    const controller = new AbortController();
    const statuses: string[] = [];
    mocks.build.mockImplementation(async (_material: unknown, _ids: unknown, options: { onPage?: (event: object) => void }) => {
      options.onPage?.({ title: 'Home', index: 0, total: 2, phase: 'authoring' });
      controller.abort('Stopped');
      return { files: {}, siteBundleSnapshot: {} };
    });
    await expect(installTemplateDraft(selection, { signal: controller.signal, onStatus: s => statuses.push(s.label) })).rejects.toThrow('Stopped');
    expect(statuses).toContain('Building Home');
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it('reports saved draft data setup failures rather than claiming full installation', async () => {
    mocks.seed.mockRejectedValue(new Error('Catalog unavailable'));
    await expect(installTemplateDraft(selection)).rejects.toThrow('draft was saved, but its editable data setup did not finish');
  });
});