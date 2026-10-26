// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, error: null as unknown, filters: [] as unknown[][] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: vi.fn(() => {
    const query = {
      select: () => query,
      eq: (key: string, value: string) => { mock.filters.push([key, value]); return query; },
      maybeSingle: async () => ({ data: mock.row, error: mock.error }),
    };
    return query;
  }),
} }));
import { loadLegacyDraftContent, resolveLegacyDraftContent, projectLegacySavedPlan, resolveScopedDraftRecovery, resolveScopedSavedTemplate } from '@/services/legacyDraftHydration';
import type { BuilderRecoverySnapshot } from '@/services/builderStateRecovery';
import { planSiteTopology } from '@/platform/core/siteTopologyPlanner';
import { build } from 'esbuild';
import path from 'node:path';
import { prepareSavedVfsRuntime } from '@/services/savedVfsRuntime';

describe('legacy saved draft hydration', () => {
  it('recovers legacy browser template files only for the exact draft identity', () => {
    const templates = [{ id: 'local-cache', canvas_data: { draftId: 'draft', vfsFiles: { '/src/App.tsx': 'saved browser source' } } }];
    expect(resolveScopedSavedTemplate('draft', templates)?.files['/src/App.tsx']).toBe('saved browser source');
    expect(resolveScopedSavedTemplate('other-draft', templates)).toBeNull();
  });
  it('recovers a matching browser journal without mixing projects', () => {
    const recovery: BuilderRecoverySnapshot = { version: 2, templateId: 'draft', code: '', editorCode: '', savedAt: '2026-10-03',
      vfsSignature: 'saved', pendingRemote: true, reason: 'ai_edit', vfsFiles: { '/src/App.tsx': 'saved source' } };
    expect(resolveScopedDraftRecovery('draft', recovery)?.files['/src/App.tsx']).toBe('saved source');
    expect(resolveScopedDraftRecovery('other-draft', recovery)).toBeNull();
  });
  it('reports unavailable saved build source instead of calling a previously launched project empty', async () => {
    mock.row = { code: '', vfs_files: {}, metadata: { siteBuildId: 'old-build' }, last_revision_id: null };
    await expect(loadLegacyDraftContent('project', 'draft')).rejects.toThrow('browser recovery copy or source backup');
  });
  it('uses surviving authored browser files before projecting an old saved plan', async () => {
    const sitePlan = planSiteTopology('ecommerce', 'Saved Brand', { selectedTemplateId: 'removed-template' });
    mock.row = { metadata: { sitePlan }, vfs_files: {}, last_revision_id: null };
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'webbuilder_templates'
      ? JSON.stringify([{ id: 'draft', canvas_data: { vfsFiles: { '/src/App.tsx': 'original authored source' } } }]) : null });
    try {
      expect((await loadLegacyDraftContent('project', 'draft'))?.files['/src/App.tsx']).toBe('original authored source');
    } finally { vi.unstubAllGlobals(); }
  });
  beforeEach(() => { mock.row = null; mock.error = null; mock.filters = []; });
  it('prefers saved editor code without changing authored source', () => {
    const code = 'export default () => <h1>My saved site</h1>';
    expect(resolveLegacyDraftContent({ editor_code: code, code: 'older' }).code).toBe(code);
  });
  it('recovers metadata files when the primary file map is empty', () => {
    const files = { '/src/App.tsx': 'saved application' };
    expect(resolveLegacyDraftContent({ vfs_files: {}, metadata: { vfsFiles: files } }).files).toEqual(files);
    expect(resolveLegacyDraftContent({ metadata: { siteBundleSnapshot: { vfsFiles: files } } }).files).toEqual(files);
  });
  it('accepts Sandpack descriptors and normalizes saved file paths', () => {
    expect(resolveLegacyDraftContent({ vfsFiles: { 'src/App.tsx': { code: 'saved app', active: true }, 'src/helper.ts': 'saved helper' } }).files)
      .toEqual({ '/src/App.tsx': 'saved app', '/src/helper.ts': 'saved helper' });
  });
  it('fills platform module dependencies while preserving every saved module', () => {
    const saved = { '/src/App.tsx': 'authored app', '/src/unison/ui/icons.tsx': 'saved icons', '/src/index.css': 'saved styles' };
    const files = prepareSavedVfsRuntime(saved, { projectId: 'project', businessId: 'business' });
    for (const [file, source] of Object.entries(saved)) expect(files[file]).toBe(source);
    expect(files['/src/unison/publishedRuntime.ts']).toContain('project');
    expect(files['/src/unison/generatedSiteRuntimeManifest.ts']).toBeTruthy();
    expect(files['/src/unison/ui/button.tsx']).toBeTruthy();
  });
  it('recognizes truly empty drafts and ignores placeholder code', () => {
    expect(resolveLegacyDraftContent({ code: 'AI-generated code will appear here', vfs_files: { '/src/App.tsx': ' ' } }).hasContent).toBe(false);
  });
  it('recognizes old plan-only projects as saved content', () => {
    const sitePlan = planSiteTopology('ecommerce', 'Saved Brand', { selectedTemplateId: 'store-boutique' });
    expect(resolveLegacyDraftContent({ code: '', vfs_files: {}, metadata: { sitePlan } }).hasContent).toBe(true);
  });
  it('renders saved declarative pages and their original routes using the compatibility renderer', async () => {
    const plan = planSiteTopology('ecommerce', 'Saved Brand', { selectedTemplateId: 'store-boutique' });
    const original = JSON.stringify(plan);
    const projected = await projectLegacySavedPlan(plan);
    expect(JSON.stringify(plan)).toBe(original);
    expect(projected.files['/src/main.tsx']).toBeTruthy();
    expect(projected.files['/src/App.tsx']).toBeTruthy();
    for (const page of plan.pages) {
      expect(projected.files[page.filePath]).toBeTruthy();
      expect(projected.pageRegistry.pages[page.id]?.path).toBe(page.route);
    }
    await build({
      entryPoints: ['/src/main.tsx'], bundle: true, write: false, logLevel: 'silent',
      plugins: [{ name: 'saved-vfs', setup(builder) {
        builder.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind !== 'entry-point' && !args.path.startsWith('.') && !args.path.startsWith('@/')) return { path: args.path, external: true };
          const base = args.path.startsWith('@/') ? `/src/${args.path.slice(2)}`
            : args.kind === 'entry-point' ? args.path : path.posix.resolve(path.posix.dirname(args.importer), args.path);
          const resolved = [base, ...['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'].map((extension) => base + extension)]
            .find((candidate) => candidate in projected.files);
          if (!resolved) throw new Error(`Unresolved saved-site module: ${args.path} from ${args.importer}`);
          return { path: resolved, namespace: 'saved-vfs' };
        });
        builder.onLoad({ filter: /.*/, namespace: 'saved-vfs' }, (args) => ({
          contents: projected.files[args.path], loader: args.path.endsWith('.css') ? 'empty' : 'tsx',
        }));
      } }],
    });
  }, 60_000);
  it('reports an unavailable saved template rather than substituting a different site', async () => {
    const plan = planSiteTopology('ecommerce', 'Saved Brand', { selectedTemplateId: 'store-boutique' });
    await expect(projectLegacySavedPlan({ ...plan, selectedTemplateId: 'removed-template' })).rejects.toThrow('The project is not empty');
  });
  it.each([
    ['salon', 'salon-premium'], ['portfolio', 'portfolio-photography'],
    ['ecommerce', 'store-premium'], ['restaurant', 'restaurant-premium'],
    ['salon', 'salon-organic'], ['portfolio', 'portfolio-designer'],
    ['restaurant', 'restaurant-fine-dining'], ['agency', 'agency-consulting'],
    ['portfolio', 'portfolio-architect'], ['agency', 'agency-bold'],
  ])('projects the legacy %s template %s', async (industry, selectedTemplateId) => {
    const plan = planSiteTopology(industry, 'Saved Brand', { selectedTemplateId, restrictToAdditionalPages: true });
    const projected = await projectLegacySavedPlan(plan);
    expect(projected.files[plan.pages[0].filePath]).toBeTruthy();
    expect(projected.files['/src/index.css']).toContain('--primary');
  }, 15_000);
  it('scopes recovery to the requested project and draft', async () => {
    mock.row = { code: 'saved', last_revision_id: null };
    expect((await loadLegacyDraftContent('project', 'draft'))?.code).toBe('saved');
    expect(mock.filters).toEqual([['id', 'draft'], ['project_id', 'project']]);
  });
  it('never bypasses an existing canonical revision pointer', async () => {
    mock.row = { code: 'legacy', last_revision_id: 'revision' };
    expect(await loadLegacyDraftContent('project', 'draft')).toBeNull();
  });
  it('prefers saved source over declarative template projection', async () => {
    const sitePlan = planSiteTopology('ecommerce', 'Saved Brand', { selectedTemplateId: 'removed-template' });
    mock.row = { editor_code: 'authored source', metadata: { sitePlan }, last_revision_id: null };
    expect((await loadLegacyDraftContent('project', 'draft'))?.code).toBe('authored source');
  });
  it('does not invent content for a missing draft', async () => {
    expect(await loadLegacyDraftContent('project', 'draft')).toBeNull();
  });
  it('propagates access or network errors instead of reporting an empty site', async () => {
    mock.error = new Error('Access denied');
    await expect(loadLegacyDraftContent('project', 'draft')).rejects.toThrow('Access denied');
  });
});
