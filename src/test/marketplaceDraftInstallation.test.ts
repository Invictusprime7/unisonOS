import { describe, expect, it, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ preflight: vi.fn(), getUser: vi.fn(), provision: vi.fn(), commit: vi.fn(), build: vi.fn(), concept: vi.fn(), seed: vi.fn(), bindings: vi.fn(), forms: vi.fn() }));
vi.mock('@/marketplace/geminiInstallPreflight', () => ({ verifyGeminiBeforeInstall: mocks.preflight }));
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
    mocks.preflight.mockResolvedValue(undefined);
    mocks.seed.mockResolvedValue({ created: 3 });
    mocks.bindings.mockResolvedValue({ failed: 0 });
    mocks.forms.mockResolvedValue({ error: null });
    const artifacts = {
      files: { '/src/App.tsx': 'source' }, entryPoint: '/src/App.tsx', runtimeManifest: {},
      siteBundleSnapshot: {
        industry: 'ecommerce', meta: { themePresetId: 'modern' },
        pageRegistry: { pages: { home: { pageId: 'home', path: '/', filePath: '/src/pages/Home.tsx' } } },
        bindings: { contact: {
          bindingId: 'contact', sourcePageId: 'home', sourceLabel: 'Contact', intent: 'form.open',
          coreIntent: 'contact.submit', targetId: 'buyer-form', targetType: 'form', sourceSection: 'contact',
          sourceSlot: 'contact-submit', confidence: 1, source: 'manual', isValid: true,
        } },
      },
    };
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
    expect(mocks.preflight).toHaveBeenCalledOnce();
    expect(mocks.preflight.mock.invocationCallOrder[0]).toBeLessThan(mocks.concept.mock.invocationCallOrder[0]);
    expect(mocks.build).toHaveBeenCalledOnce();
    expect(mocks.build.mock.invocationCallOrder[0]).toBeLessThan(mocks.commit.mock.invocationCallOrder[0]);
    expect(mocks.commit.mock.calls[0][0].current.activePagePath).toBe('/src/App.tsx');
    expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({ identity: expect.objectContaining({ userId: 'buyer', projectId: 'project', draftId: 'draft' }) }));
    expect(result).toMatchObject({ draftId: 'draft', revisionId: 'revision' });
    expect(mocks.seed).toHaveBeenCalledWith(expect.objectContaining({ businessId: 'business', projectId: 'project' }));
    expect(mocks.commit.mock.invocationCallOrder[0]).toBeLessThan(mocks.seed.mock.invocationCallOrder[0]);
    expect(mocks.bindings).toHaveBeenCalledWith(expect.objectContaining({ businessId: 'business', projectId: 'project' }));
    expect(mocks.bindings).toHaveBeenCalledWith(expect.objectContaining({
      pageRoutesById: { home: '/' },
      pageSurfaces: [{
        route: '/', filePath: '/src/pages/Home.tsx',
        bindings: [{ sourceSlot: 'contact-submit', intent: 'contact.submit' }],
      }],
    }));
  });
  it.each(['concept', 'release'] as const)('blocks %s installation before any paid authoring or project creation when Gemini check fails', async kind => {
    mocks.preflight.mockRejectedValue(new Error('Gemini credit unavailable'));
    await expect(installTemplateDraft(kind === 'concept' ? selection : { kind, slug: 'pollen', title: 'Pollen' })).rejects.toThrow('credit unavailable');
    expect(mocks.concept).not.toHaveBeenCalled();
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.build).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
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
});import { installActivePagePath } from '@/marketplace/installTemplateDraft';
describe('template draft opening page', () => {
  it('opens on the Home page file that was saved', () => {
    const snapshot = { pageRegistry: { homePageId: 'home', pages: { home: { id: 'home', filePath: '/src/pages/home.tsx', isHome: true }, rooms: { id: 'rooms', filePath: '/src/pages/rooms.tsx' } } } };
    expect(installActivePagePath({ files: { '/src/pages/home.tsx': 'a', '/src/pages/rooms.tsx': 'b' }, siteBundleSnapshot: snapshot as never, entryPoint: '/src/App.tsx' })).toBe('/src/pages/home.tsx');
    expect(installActivePagePath({ files: { '/src/pages/rooms.tsx': 'b' }, siteBundleSnapshot: snapshot as never, entryPoint: '/src/App.tsx' })).toBe('/src/pages/rooms.tsx');
    expect(installActivePagePath({ files: {}, siteBundleSnapshot: snapshot as never, entryPoint: '/src/App.tsx' })).toBeNull();
  });
});
