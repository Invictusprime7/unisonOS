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
import { commitMutation, loadLatestRevisionForProject } from '@/services/vfsCommitService';
import { emptyPatchPlan } from '@/types/patchPlan';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';


import { decodeThemeEdit, isThemeOnlyRequest } from '@/services/theme/themeEdit';
import { readThemeOverrides } from '@/services/theme/themeTokenOverrides';
describe('Theme edit canonical closure', () => {
  it('classifies appearance requests without taking over composition requests', () => {
    for (const text of ['make it darker', 'use Bold', 'soften the typography', 'Use Bold. Keep all text, pages, images, sections and layout unchanged.']) expect(isThemeOnlyRequest(text)).toBe(true);
    for (const text of ['add a dark gallery section', 'change the grid layout', "Change the main heading on the Home page to 'Timeless Craft, Modern Lines'", 'update the hero title to read Welcome']) expect(isThemeOnlyRequest(text)).toBe(false);
    for (const text of ['Change color scheme to Gold and black', 'change the heading font to a serif']) expect(isThemeOnlyRequest(text)).toBe(true);
    expect(decodeThemeEdit({ version: '1.0', snapshotId: 's', revisionId: null, presetId: null, set: {}, reset: [] }).presetId).toBeNull();
    expect(() => decodeThemeEdit({ version: '1.0', snapshotId: 's', revisionId: null, files: {} })).toThrow();
  });
  it('commits, reloads, incrementally edits and resets a theme without replacing pages', async () => {
    const identity = { userId: '11111111-1111-4111-8111-111111111111', businessId: '22222222-2222-4222-8222-222222222222', projectId: '33333333-3333-4333-8333-333333333333', draftId: '44444444-4444-4444-8444-444444444444', revisionId: '', sessionId: 'theme' };
    const compiled = commitToPipeline({ selections: { businessName: 'Theme Studio', businessModel: 'appointment_service', industryOverlay: 'salon', systemType: 'booking', primaryGoal: 'book', secondaryGoals: [], needsBooking: true, wantsLeadCapture: false, primaryIntent: 'booking.create', requestedPages: ['home', 'contact'], scaffoldMode: 'selected-pages', templateId: 'salon-premium', themePresetId: 'editorial', themeTokens: themePresetToThemeTokens(THEME_PRESETS.find(p => p.id === 'editorial')!) } }, 'wizard-launch');
    const launched = buildCanonicalLaunchArtifacts({ generatedFiles: compiled.siteBundleSnapshot.vfsFiles, siteBundleSnapshot: compiled.siteBundleSnapshot, compileArtifact: compiled.compileArtifact, canonicalPlayground: compiled.playground, themePresetId: 'editorial', templateId: 'salon-premium', systemType: 'booking', businessName: 'Theme Studio', industry: 'salon', businessId: identity.businessId, projectId: identity.projectId });
    const pages = Object.values(launched.siteBundleSnapshot!.pageRegistry.pages).map(p => p.filePath!);
    const patch = emptyPatchPlan('Darker');
    patch.themeEdit = { version: '1.0', snapshotId: launched.siteBundleSnapshot!.snapshotId, revisionId: null, set: { '--background': '220 20% 8%', '--foreground': '0 0% 98%' }, reset: [] };
    const result = await commitMutation({ source: 'theme-change', identity, current: { vfsFiles: launched.files, siteBundleSnapshot: launched.siteBundleSnapshot, playground: compiled.playground }, patch });
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('committed');
    expect(readThemeOverrides(result.vfsFiles)['--background']).toBe('220 20% 8%');
    expect(result.vfsFiles['/src/index.css']).toContain('--background: 220 20% 8%');
    for (const path of pages) expect(result.vfsFiles[path]).toBe(launched.files[path]);
    expect(result.siteBundleSnapshot!.bindings).toEqual(launched.siteBundleSnapshot!.bindings);
    const restored = await loadLatestRevisionForProject(identity.projectId);
    expect(restored!.vfsFiles).toEqual(result.vfsFiles);
    const nextPatch = emptyPatchPlan('Heavier');
    nextPatch.themeEdit = { version: '1.0', snapshotId: result.siteBundleSnapshot!.snapshotId, revisionId: result.persistedRevisionId!, set: { '--ut-weight-display': '900' }, reset: [] };
    const next = await commitMutation({ source: 'theme-change', identity: { ...identity, revisionId: result.persistedRevisionId! }, current: { vfsFiles: result.vfsFiles, siteBundleSnapshot: result.siteBundleSnapshot, playground: result.playground }, patch: nextPatch });
    expect(next.status, JSON.stringify(next.diagnostics)).toBe('committed');
    expect(readThemeOverrides(next.vfsFiles)).toMatchObject({ '--background': '220 20% 8%', '--ut-weight-display': '900' });
    const reset = emptyPatchPlan('Switch to Bold');
    reset.themeEdit = { version: '1.0', snapshotId: next.siteBundleSnapshot!.snapshotId, revisionId: next.persistedRevisionId!, presetId: 'bold', set: {}, reset: [] };
    const switched = await commitMutation({ source: 'theme-change', identity: { ...identity, revisionId: next.persistedRevisionId! }, current: { vfsFiles: next.vfsFiles, siteBundleSnapshot: next.siteBundleSnapshot, playground: next.playground }, patch: reset });
    expect(switched.status, JSON.stringify(switched.diagnostics)).toBe('committed');
    expect(switched.siteBundleSnapshot!.meta.themePresetId).toBe('bold');
    expect(readThemeOverrides(switched.vfsFiles)).toEqual({});
    for (const path of pages) expect(switched.vfsFiles[path]).toBe(next.vfsFiles[path]);

    const history = JSON.stringify(revisions);
    const legacySnapshot = structuredClone(switched.siteBundleSnapshot!);
    delete legacySnapshot.meta.themeStyleVersion;
    legacySnapshot.themeTokens = themePresetToThemeTokens(THEME_PRESETS[0]);
    const repaired = await commitMutation({ source: 'republish', identity: { ...identity, revisionId: switched.persistedRevisionId! }, current: { vfsFiles: switched.vfsFiles, siteBundleSnapshot: legacySnapshot, playground: switched.playground }, patch: emptyPatchPlan('Save legacy theme') });
    expect(repaired.status, JSON.stringify(repaired.diagnostics)).toBe('committed');
    expect(repaired.siteBundleSnapshot!.meta.themeStyleVersion).toBe('2.0');
    expect(repaired.vfsFiles['/src/index.css']).toContain('--background: 0 0% 0%');
    for (const path of pages) expect(repaired.vfsFiles[path]).toBe(switched.vfsFiles[path]);
    expect(JSON.stringify(revisions.slice(0, -1))).toBe(history);
    const undo = await commitMutation({ source: 'system-restore', identity: { ...identity, revisionId: repaired.persistedRevisionId! }, current: { vfsFiles: repaired.vfsFiles, siteBundleSnapshot: repaired.siteBundleSnapshot, playground: repaired.playground }, patch: emptyPatchPlan('Undo theme'), options: { restoreRevisionId: result.persistedRevisionId! } });
    expect(undo.status, JSON.stringify(undo.diagnostics)).toBe('committed');
    expect(undo.vfsFiles).toEqual(result.vfsFiles);
    const stale = commitMutation({ source: 'theme-change', identity: { ...identity, revisionId: next.persistedRevisionId! }, current: { vfsFiles: next.vfsFiles, siteBundleSnapshot: next.siteBundleSnapshot, playground: next.playground }, patch: nextPatch });
    await expect(stale).rejects.toThrow('newer revision');
  }, 30000);
});
