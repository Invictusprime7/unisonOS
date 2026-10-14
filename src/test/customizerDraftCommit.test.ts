import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const { revisions, reconcile } = vi.hoisted(() => ({
  revisions: [] as Record<string, unknown>[],
  reconcile: vi.fn(async () => ({ data: { success: true }, error: null })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'ai_events') return { insert: vi.fn() };
      let rowId: string | undefined;
      const chain = {
        select: () => chain,
        eq: (column: string, value: string) => { if (column === 'id') rowId = value; return chain; },
        order: () => chain,
        limit: () => chain,
        single: async () => ({ data: { site_id: '55555555-5555-4555-8555-555555555555' }, error: null }),
        maybeSingle: async () => ({ data: rowId ? revisions.find(r => r.id === rowId) : revisions[revisions.length - 1], error: null }),
      };
      return chain;
    },
    functions: { invoke: reconcile },
    rpc: async (name: string, payload: Record<string, unknown>) => {
      expect(name).toBe('commit_canonical_site_revision_v2');
      const delta = ((payload.p_patch_json as { _commitMetadata?: { vfsDelta?: { files?: Record<string, string>; deletedPaths?: string[] } } })._commitMetadata?.vfsDelta);
      const previousFiles = (revisions[revisions.length - 1]?.vfs_files ?? {}) as Record<string, string>;
      const vfsFiles = delta
        ? Object.fromEntries(Object.entries({ ...previousFiles, ...(delta.files ?? {}) }).filter(([path]) => !delta.deletedPaths?.includes(path)))
        : payload.p_vfs_files as Record<string, string>;
      const runtimeFiles = Object.fromEntries(Object.entries(vfsFiles).filter(([path]) => !path.startsWith('/.unison/')));
      const snapshot = { ...(payload.p_site_bundle_snapshot as Record<string, unknown>), vfsFiles: runtimeFiles };
      const row = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key.replace(/^p_/, ''), value]));
      row.vfs_files = vfsFiles;
      row.site_bundle_snapshot = snapshot;
      row.id = `00000000-0000-4000-8000-${String(revisions.length + 1).padStart(12, '0')}`;
      revisions.push(JSON.parse(JSON.stringify(row)));
      return { data: row.id, error: null };
    },
  },
}));
vi.mock('@/services/elementReadinessEvaluator', () => ({
  evaluateElementReadiness: vi.fn(async () => ({ summary: { previewBlocked: 0, publishBlocked: 0 } })),
}));
vi.mock('@/services/playgroundControlPlaneResolver', () => ({
  resolvePlaygroundControlPlane: vi.fn(() => ({
    readinessReport: { summary: { previewBlocked: 0, publishBlocked: 0 } },
    validationSummary: {}, overview: {},
  })),
}));

import { commitToPipeline } from '@/platform/core/commitToPipeline';
import { buildCanonicalLaunchArtifacts } from '@/services/canonicalLaunchVfs';
import { commitMutation, hashVfsFiles } from '@/services/vfsCommitService';
import { emptyPatchPlan, legacyFilesToPatchPlan } from '@/types/patchPlan';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';


import { getVariantsForSection } from '@/sections/variants';
import { customizerFileChanges, collectCustomizerImages, applyCustomizerSectionData, readCustomizerSectionData } from '@/services/builder/customizerDraft';

describe('Customizer draft persistence', () => {
  it('previews source edits without saving and applies the exact reviewed files', async () => {
    const identity = { userId: '11111111-1111-4111-8111-111111111111', businessId: '22222222-2222-4222-8222-222222222222', projectId: '33333333-3333-4333-8333-333333333333', draftId: '44444444-4444-4444-8444-444444444444', revisionId: '', sessionId: 'theme' };
    const compiled = commitToPipeline({ selections: { businessName: 'Theme Studio', businessModel: 'appointment_service', industryOverlay: 'salon', systemType: 'booking', primaryGoal: 'book', secondaryGoals: [], needsBooking: true, wantsLeadCapture: false, primaryIntent: 'booking.create', requestedPages: ['home', 'contact'], scaffoldMode: 'selected-pages', templateId: 'salon-premium', themePresetId: 'editorial', themeTokens: themePresetToThemeTokens(THEME_PRESETS.find(p => p.id === 'editorial')!) } }, 'wizard-launch');
    const launched = buildCanonicalLaunchArtifacts({ generatedFiles: compiled.siteBundleSnapshot.vfsFiles, siteBundleSnapshot: compiled.siteBundleSnapshot, compileArtifact: compiled.compileArtifact, canonicalPlayground: compiled.playground, themePresetId: 'editorial', templateId: 'salon-premium', systemType: 'booking', businessName: 'Theme Studio', industry: 'salon', businessId: identity.businessId, projectId: identity.projectId });
    const path = Object.values(launched.siteBundleSnapshot!.pageRegistry.pages).find(p => p.path === '/')!.filePath!;
    if (process.env.CUSTOMIZER_BROWSER === '1') { mkdirSync('.artifacts/customizer', {recursive:true}); writeFileSync('.artifacts/customizer/project.json', JSON.stringify({files:launched.files,path})); }
    const source = launched.files[path];
    const data = readCustomizerSectionData(source)!;
    expect(data.length).toBeGreaterThan(1);
    const sections = data.map((entry, order) => ({ id: String(entry.id), tagName: 'section', label: String(entry.type), order: data.length - order, visible: order !== 1, height: 'auto', selector: '', preview: '' }));
    const images = collectCustomizerImages(source);
    expect(images.length).toBeGreaterThan(0);
    images[0].src = 'https://example.com/replacement.jpg';
    const changed = applyCustomizerSectionData(source, sections, images);
    const files = customizerFileChanges(launched.files, path, changed, ':root { --primary: 0 100% 50%; }');
    const current = { vfsFiles: launched.files, siteBundleSnapshot: launched.siteBundleSnapshot, playground: compiled.playground };
    const before = revisions.length;
    const patch = legacyFilesToPatchPlan(files, 'Customize');
    const hero = data.find(s => s.type === 'hero')!;
    const variant = getVariantsForSection('hero').find(v => v.id !== hero.variantId)!;
    patch.presentationOps = [{ type: 'setVariant', sectionId: String(hero.id), variantId: variant.id }];
    const candidate = await commitMutation({ source: 'playground-edit', identity, current, patch, options: { dryRun: true, customizerPagePath: path } });
    expect(candidate.status, JSON.stringify(candidate.diagnostics)).toBe('committed');
    expect(readCustomizerSectionData(candidate.vfsFiles[path])!.find(s => s.id === hero.id)!.variantId).toBe(variant.id);
    expect(candidate.persistedRevisionId).toBeFalsy();
    expect(revisions).toHaveLength(before);
    expect(candidate.vfsFiles[path]).toContain('https://example.com/replacement.jpg');
    expect(readCustomizerSectionData(candidate.vfsFiles[path])!.map(s => s.id)).toEqual([...data].reverse().map(s => s.id));
    expect(readCustomizerSectionData(candidate.vfsFiles[path])!.find(s => s.id === data[1].id)!.hidden).toBe(true);
    const saved = await commitMutation({ source: 'playground-edit', identity, current, patch: emptyPatchPlan('Apply'), options: { reviewedComposition: { baseVfsHash: await hashVfsFiles(launched.files), candidate } } });
    expect(saved.status, JSON.stringify(saved.diagnostics)).toBe('committed');
    expect(saved.persistedRevisionId).toBeTruthy();
    expect(saved.vfsFiles[path]).toBe(candidate.vfsFiles[path]);
    expect(saved.vfsFiles[path.replace(/\.[^.]+$/, '.customizer.css')]).toBe(':root { --primary: 0 100% 50%; }');
    expect(revisions).toHaveLength(before + 1);
    await expect(commitMutation({ source: 'playground-edit', identity, current: { ...current, vfsFiles: { ...current.vfsFiles, '/src/change.txt': 'concurrent edit' } }, patch: emptyPatchPlan('Stale apply'), options: { reviewedComposition: { baseVfsHash: await hashVfsFiles(launched.files), candidate } } })).rejects.toThrow(/stale|newer revision/i);
    expect(revisions).toHaveLength(before + 1);
  }, 30000);
});
