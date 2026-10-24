import { describe, expect, it, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), provision: vi.fn(), commit: vi.fn(), build: vi.fn(), concept: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: mocks.getUser } } }));
vi.mock('@/services/confirmedLaunchProvisioner', () => ({ createConfirmedLaunchIds: () => ({}), provisionConfirmedLaunchSite: mocks.provision }));
vi.mock('@/services/vfsCommitService', () => ({ commitMutation: mocks.commit }));
vi.mock('@/marketplace/materializeTemplateWithAppBuilder', () => ({ materializeTemplateWithAppBuilder: mocks.build }));
vi.mock('@/marketplace/conceptDraftSource', () => ({ buildConceptDraftSource: mocks.concept }));
import { installTemplateDraft } from '@/marketplace/installTemplateDraft';
describe('template draft acceptance', () => {
  const selection = { kind: 'concept' as const, template: { name: 'Pollen Objects' } as never };
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
  it('does not persist when App Builder rejects the template', async () => {
    mocks.build.mockRejectedValue(new Error('App Builder could not prepare this template'));
    await expect(installTemplateDraft(selection)).rejects.toThrow('App Builder');
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it('never reports installation if a durable revision was not saved', async () => {
    mocks.commit.mockResolvedValue({ status: 'committed', persistedRevisionId: null });
    await expect(installTemplateDraft(selection)).rejects.toThrow('not saved');
  });
});