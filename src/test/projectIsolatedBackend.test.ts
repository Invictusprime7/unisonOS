import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/cmsRecordService', () => ({
  listCmsRecords: vi.fn(async () => []), createCmsRecord: vi.fn(), removeCmsRecord: vi.fn(),
  updateCmsRecord: vi.fn(async () => ({ id: 'p1' })),
  listContentRecords: vi.fn(async () => []), getContentRecord: vi.fn(), createContentRecord: vi.fn(), updateContentRecord: vi.fn(),
}));

import { resolvePropertyOwner } from '@/services/editor/propertyOwnerResolver';
import { executeEditorCommand } from '@/services/editor/editorCommandService';
import { canIssue } from '@/services/editor/editorCapabilities';
import { parseProjectBackendDescriptor } from '@/services/project-backend/projectBackendResolver';
import { verifyRuntimeIdentity } from '@/services/project-backend/projectBackendHealth';

const cms = readFileSync('supabase/functions/cms-records/index.ts', 'utf8');
const runtimeRead = readFileSync('supabase/functions/site-runtime-read/index.ts', 'utf8');
const projectBackend = readFileSync('supabase/functions/project-backend/index.ts', 'utf8');

describe('Phase 0 — project scope on saved items', () => {
  it('cms-records writes project_id and deletes only within the site', () => {
    expect(cms).toContain('project_id: projectId ?? null');
    expect(cms).toContain('del.eq("project_id", projectId)');
  });
  it('site-runtime-read filters catalog by project', () => {
    expect(runtimeRead).toContain('project_id.eq.${context.projectId}');
  });

  it('resolves dedicated site identity from the project row, not a missing binding column', () => {
    expect(projectBackend).not.toContain('select("id, business_id, site_id, project_url');
    expect(projectBackend).toContain('.select("id, business_id, unison_project_id, project_url');
    expect(projectBackend).toContain('.from("projects")');
    expect(projectBackend).toContain('.select("id,business_id,site_id")');
    expect(projectBackend).toContain('binding.business_id !== project.business_id');
    expect(projectBackend).toContain('identity.site_id !== siteRecord.id');
  });
});

describe('Phase 1 — editor commands', () => {
  it('a resource mark routes text edits to the resource, never page source', () => {
    expect(resolvePropertyOwner({ type: 'set-text', text: 'x', target: { resourceMark: 'products#p1.name' } })).toBe('resource');
    expect(resolvePropertyOwner({ type: 'set-text', text: 'x', target: {} })).toBe('source');
    expect(resolvePropertyOwner({ type: 'set-style', styles: {}, target: { resourceMark: 'products#p1.name' } })).toBe('presentation');
    expect(resolvePropertyOwner({ type: 'set-link', href: '/a', target: {} })).toBe('route');
  });
  it('inline cannot issue structural commands', () => {
    expect(canIssue('inline', 'delete')).toBe(false);
    expect(canIssue('ai', 'create-page')).toBe(true);
  });
  it('source edits without a host executor fail with a clear message', async () => {
    const r = await executeEditorCommand({ type: 'set-text', text: 'x', target: {} }, { source: 'toolbar', resource: { businessId: 'b', mode: 'builder' } });
    expect(r.ok).toBe(false);
    expect(r.lane).toBe('source');
  });
});

describe('Phase 2 — backend resolver', () => {
  it('parses shared-legacy and blocks cross-site identities', () => {
    const d = parseProjectBackendDescriptor({ bindingId: 'x', projectId: 'A', siteId: 'S', mode: 'dedicated', status: 'ready' });
    expect(verifyRuntimeIdentity(d, { businessId: 'b', projectId: 'B', siteId: 'S', schemaVersion: 1 }).ok).toBe(false);
    expect(verifyRuntimeIdentity(d, { businessId: 'b', projectId: 'A', siteId: 'S', schemaVersion: 1 }).ok).toBe(true);
    expect(() => parseProjectBackendDescriptor({})).toThrow();
  });
});

import { splitProfilePatch, mergeSiteProfile } from '@/services/businessProfileService';
describe('Phase 2 — account identity vs site profile', () => {
  it('routes site fields to the site and identity fields to the account', () => {
    const { account, site } = splitProfilePatch({ name: 'Acme', tagline: 'Hi', phone: '1' });
    expect(account).toEqual({ name: 'Acme' });
    expect(site).toEqual({ tagline: 'Hi', phone: '1' });
  });
  it('site overrides never change account identity', () => {
    const m = mergeSiteProfile({ name: 'Acme', tagline: 'A' } as never, { tagline: 'B', name: 'Hack' });
    expect(m.tagline).toBe('B'); expect(m.name).toBe('Acme');
  });
});

import { toAssetRef, assetStoragePath } from '@/services/assets/assetRef';
import { projectContextArtifactsForAI } from '@/services/context/contextArtifacts';
import { buildRuntimeManifest } from '@/services/project-backend/runtimeManifest';
describe('Phase 6 — assets and context', () => {
  it('validates image links and site ownership', async () => {
    expect(() => toAssetRef({ url: 'javascript:alert(1)' })).toThrow();
    expect(assetStoragePath('image', 'Hero Shot.PNG').path).toBe('public/images/hero-shot.png');
    const r = await executeEditorCommand(
      { type: 'replace-asset', url: 'https://x.test/a.jpg', target: {}, assetRef: { ...toAssetRef({ url: 'https://x.test/a.jpg' }), projectId: 'B' } },
      { source: 'toolbar', resource: { businessId: 'b', projectId: 'A', mode: 'builder' } as never },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('another site');
  });
  it('AI context only uses this site’s artifacts', () => {
    const base = { siteId: null, storageAssetId: null, extractedText: null, metadata: {}, createdAt: '' };
    const out = projectContextArtifactsForAI([
      { ...base, id: '1', projectId: 'A', kind: 'client-note', title: 'Brief', summary: 'Mine' },
      { ...base, id: '2', projectId: 'B', kind: 'client-note', title: 'Other', summary: 'Theirs' },
    ], 'A');
    expect(out).toContain('Mine'); expect(out).not.toContain('Theirs');
  });
});
describe('Phase 9 — unison.runtime.json', () => {
  it('exports public identity only', () => {
    const m = buildRuntimeManifest({ backend: { bindingId: 'x', projectId: 'A', siteId: 'S', mode: 'dedicated', provider: 'supabase', status: 'ready', projectUrl: 'https://r.supabase.co', publishableKey: 'pk' }, resources: ['services', 'products', 'services'], needsServerAccess: true });
    expect(m.resources).toEqual(['products', 'services']);
    expect(Object.keys(m.publicEnv).every((k) => k.startsWith('VITE_'))).toBe(true);
    expect(JSON.stringify(m)).not.toMatch(/ciphertext|service_role/i);
    expect(m.serverEnv).toEqual(['SITE_SUPABASE_SECRET_KEY']);
  });
});
