/**
 * M1 close-out — persisted publish parity evidence.
 *
 * Exit condition: canonical VFS implementation === published runtime
 * implementation. This test drives the real publish path
 * (`deployToProvider` with a `projectId`), which loads the durable
 * publish-ready revision from the ledger and ships that payload. It proves:
 *
 *  1. The bytes handed to the deploy provider are the canonical composition
 *     bytes — never in-memory caller state.
 *  2. Canonical identity (`data-ut-section-id`, `data-ut-variant`) survives
 *     the publish projection for every emitted section.
 *  3. The published file fingerprint equals the canonical VFS fingerprint,
 *     so no file may exist only as registry metadata or only in preview.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compositionToReactFileSet } from '@/sections/compositionToFileSet';
import { getCompositionById } from '@/sections/templates';
import { computeFilesFingerprint } from '@/services/publishAttestation';
import { UNISON_ATTRIBUTION_ASSET } from '@/services/export/unisonAttribution';
import { materializeCanonicalProjectMedia } from '../../supabase/functions/_shared/canonicalPublishMedia';

const mocks = vi.hoisted(() => {
  const projectQuery: Record<string, ReturnType<typeof vi.fn>> = {};
  projectQuery.update = vi.fn(() => projectQuery);
  projectQuery.eq = vi.fn(() => projectQuery);
  projectQuery.select = vi.fn(() => projectQuery);
  projectQuery.maybeSingle = vi.fn();
  return {
    invoke: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn(() => projectQuery),
    loadLatestPublishReadyRevisionForProject: vi.fn(),
    recordRepublishEvent: vi.fn(),
    projectQuery,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mocks.invoke }, from: mocks.from, rpc: mocks.rpc },
}));

vi.mock('@/services/vfsCommitService', () => ({
  loadLatestPublishReadyRevisionForProject: mocks.loadLatestPublishReadyRevisionForProject,
  recordRepublishEvent: mocks.recordRepublishEvent,
}));

import { deployToProvider } from '@/services/deploymentService';

const TEMPLATE_IDS = ['salon-premium', 'store-premium', 'store-minimal', 'store-boutique'];

const INDEX_HTML =
  '<!doctype html><html><head><title>Canonical</title></head><body><div id="root"></div></body></html>';

function canonicalVfsForTemplate(templateId: string): Record<string, string> {
  const template = getCompositionById(templateId);
  expect(template, `composition ${templateId} must exist`).toBeTruthy();
  const files = compositionToReactFileSet(template!, '/src/pages/Home.tsx');
  return { ...files, '/index.html': INDEX_HTML };
}

/**
 * Canonical identity is data-driven: the compiled page reads
 * `data-ut-section-id` / `data-ut-variant` from the sealed composition record
 * emitted at `/.unison/compositions/pages/*.json`. Parity therefore means the
 * published payload carries that same record with the same ids and variants.
 */
function identityTokens(files: Record<string, string>) {
  const sectionIds = new Set<string>();
  const variantIds = new Set<string>();
  for (const [path, content] of Object.entries(files)) {
    if (!path.replace(/^\/+/, '').startsWith('.unison/compositions/pages/')) continue;
    const record = JSON.parse(content) as {
      sections?: Array<{ sectionId?: string; variantId?: string }>;
    };
    for (const section of record.sections ?? []) {
      if (section.sectionId) sectionIds.add(section.sectionId);
      if (section.variantId) variantIds.add(section.variantId);
    }
  }
  return { sectionIds, variantIds };
}


function publishedPayload(): Record<string, string> {
  const calls = mocks.invoke.mock.calls;
  const call = calls[calls.length - 1];
  expect(call?.[0]).toBe('publish-site');
  return (call?.[1] as { body: { files: Record<string, string> } }).body.files;
}

describe('persisted publish parity (M1 exit condition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockImplementation(async (functionName: string) => functionName === 'resolve-project-backend'
      ? {
          data: { success: true, data: { bindingId: 'shared:project-1', projectId: 'project-1', siteId: null, mode: 'shared-legacy', status: 'ready' } },
          error: null,
        }
      : {
          data: { status: 'success', provider: 'vercel', url: 'https://published.test' },
          error: null,
        });
    mocks.projectQuery.maybeSingle.mockResolvedValue({ data: { id: 'project-1' }, error: null });
    mocks.rpc.mockResolvedValue({
      data: { bindingId: 'binding-1', projectId: 'project-1', siteId: null, mode: 'shared-legacy', status: 'ready' },
      error: null,
    });
  });

  it.each(TEMPLATE_IDS)('publishes the canonical VFS bytes for %s', async (templateId) => {
    const canonical = canonicalVfsForTemplate(templateId);
    mocks.loadLatestPublishReadyRevisionForProject.mockResolvedValue({
      id: `revision-${templateId}`,
      projectId: 'project-1',
      businessId: 'business-1',
      draftId: 'draft-1',
      vfsFiles: canonical,
      siteBundleSnapshot: null,
      vfsHash: 'hash-1',
    });

    const result = await deployToProvider({
      provider: 'vercel',
      projectId: 'project-1',
      // Deliberately stale, un-committed caller state — must never be shipped.
      files: { '/index.html': '<html><body>stale caller state</body></html>' },
    });

    expect(result.status).toBe('success');

    const published = publishedPayload();
    expect(published['index.html']).not.toContain('stale caller state');

    // 1. Byte parity for every canonical file except index.html, which the
    //    publish path augments with the required attribution script tag.
    for (const [path, content] of Object.entries(canonical)) {
      const publishedPath = path.replace(/^\/+/, '');
      if (publishedPath === 'index.html') {
        expect(published[publishedPath]).toContain('<div id="root"></div>');
        expect(published[publishedPath]).toContain(UNISON_ATTRIBUTION_ASSET);
        continue;
      }
      expect(published[publishedPath], `${publishedPath} must publish canonical bytes`).toBe(content);
    }

    // Attribution and the backend runtime descriptor are explicit publish additions.
    expect(JSON.parse(published['unison.runtime.json'])).toMatchObject({
      projectId: 'project-1', backendMode: 'shared-legacy',
      publicEnv: { VITE_UNISON_PROJECT_ID: 'project-1' },
    });
    const canonicalPaths = new Set(Object.keys(canonical).map((p) => p.replace(/^\/+/, '')));
    for (const publishedPath of Object.keys(published)) {
      if (publishedPath === UNISON_ATTRIBUTION_ASSET || publishedPath === 'unison.runtime.json') continue;
      expect(canonicalPaths.has(publishedPath), `${publishedPath} is not canonical`).toBe(true);
    }
  });

  it.each(TEMPLATE_IDS)('preserves canonical section and variant identity for %s', async (templateId) => {
    const canonical = canonicalVfsForTemplate(templateId);
    mocks.loadLatestPublishReadyRevisionForProject.mockResolvedValue({
      id: `revision-${templateId}`,
      projectId: 'project-1',
      businessId: 'business-1',
      draftId: 'draft-1',
      vfsFiles: canonical,
      siteBundleSnapshot: null,
      vfsHash: 'hash-1',
    });

    await deployToProvider({ provider: 'vercel', projectId: 'project-1', files: {} });

    const expected = identityTokens(canonical);
    expect(expected.sectionIds.size, 'canonical output must carry section identity').toBeGreaterThan(0);
    // Not every certified composition pins explicit variants; when it does,
    // the published payload must carry exactly the same variant identity.
    const actual = identityTokens(publishedPayload());
    expect([...actual.sectionIds].sort()).toEqual([...expected.sectionIds].sort());
    expect([...actual.variantIds].sort()).toEqual([...expected.variantIds].sort());
  });

  it('keeps the published fingerprint equal to the canonical VFS fingerprint', async () => {
    const canonical = canonicalVfsForTemplate('store-premium');
    mocks.loadLatestPublishReadyRevisionForProject.mockResolvedValue({
      id: 'revision-fingerprint',
      projectId: 'project-1',
      businessId: 'business-1',
      draftId: 'draft-1',
      vfsFiles: canonical,
      siteBundleSnapshot: null,
      vfsHash: 'hash-1',
    });

    await deployToProvider({ provider: 'vercel', projectId: 'project-1', files: {} });

    const published = publishedPayload();
    const comparable = Object.fromEntries(
      Object.entries(published).filter(
        ([path]) => path !== UNISON_ATTRIBUTION_ASSET && path !== 'index.html' && path !== 'unison.runtime.json',
      ),
    );
    const canonicalComparable = Object.fromEntries(
      Object.entries(canonical)
        .filter(([path]) => path.replace(/^\/+/, '') !== 'index.html')
        .map(([path, content]) => [path.replace(/^\/+/, ''), content]),
    );

    const publishedPrint = await computeFilesFingerprint(comparable);
    const canonicalPrint = await computeFilesFingerprint(canonicalComparable);
    expect(publishedPrint.fingerprint).toBe(canonicalPrint.fingerprint);
    expect(publishedPrint.fileCount).toBe(canonicalPrint.fileCount);
    expect(publishedPrint.fileCount).toBeGreaterThan(0);
  });

  it('publishes the accepted custom animated design and makes its project photo portable', async () => {
    const storagePath = 'owner-1/site-uploads/project-1/hero.webp';
    const signedUrl = `https://project.supabase.co/storage/v1/object/sign/user-files/${storagePath}?token=temporary`;
    const accepted = {
      '/src/App.tsx': "import Home from './pages/Home'; export default function App(){return <Home/>}",
      '/src/pages/Home.tsx': `import { motion } from 'framer-motion';\nexport default function Home(){return <main><motion.section initial={{opacity:0}} animate={{opacity:1}}><h1>Salt House</h1><img src="${signedUrl}" alt="Tide line at dawn" /></motion.section></main>}`,
      '/src/components/EditorialHero.tsx': 'export default function EditorialHero(){return <section className="editorial-hero"/>}',
      '/public/media/manifest.json': JSON.stringify({
        version: 1,
        assets: [{
          storagePath, bucket: 'user-files', name: 'hero.webp', kind: 'image', mimeType: 'image/webp',
          url: signedUrl, usedBy: ['/src/pages/Home.tsx'],
        }],
      }),
      '/index.html': INDEX_HTML,
    };
    mocks.loadLatestPublishReadyRevisionForProject.mockResolvedValue({
      id: 'revision-ai-authored',
      projectId: 'project-1',
      businessId: 'business-1',
      draftId: 'draft-1',
      vfsFiles: accepted,
      siteBundleSnapshot: null,
      runtimeManifest: { backendRequired: false },
      vfsHash: 'accepted-vfs-hash',
    });

    const result = await deployToProvider({
      provider: 'vercel',
      projectId: 'project-1',
      expectedRevisionId: 'revision-ai-authored',
      files: { '/src/pages/Home.tsx': 'uncommitted caller layout' },
    });

    expect(result.status).toBe('success');
    const submitted = publishedPayload();
    expect(submitted['src/pages/Home.tsx']).toBe(accepted['/src/pages/Home.tsx']);
    expect(submitted['src/components/EditorialHero.tsx']).toBe(accepted['/src/components/EditorialHero.tsx']);
    expect(submitted['src/pages/Home.tsx']).not.toContain('uncommitted caller layout');

    const materialized = await materializeCanonicalProjectMedia({
      files: submitted,
      manifestFiles: accepted,
      userId: 'owner-1',
      storageOrigin: 'https://project.supabase.co',
      download: async () => new Uint8Array([0x52, 0x49, 0x46, 0x46]),
    });
    expect(materialized.mediaCount).toBe(1);
    expect(materialized.files['src/pages/Home.tsx']).toContain('data:image/webp;base64,UklGRg==');
    expect(materialized.files).not.toHaveProperty('public/media/manifest.json');
  });

  it('refuses to publish when no publish-ready revision exists', async () => {
    mocks.loadLatestPublishReadyRevisionForProject.mockResolvedValue(null);

    const result = await deployToProvider({
      provider: 'vercel',
      projectId: 'project-1',
      files: canonicalVfsForTemplate('salon-premium'),
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('no publish-ready revision');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
