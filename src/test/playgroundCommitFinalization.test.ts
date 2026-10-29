import { describe, expect, it, vi } from 'vitest';

const { revisions, reconcile } = vi.hoisted(() => ({
  revisions: [] as Record<string, unknown>[],
  reconcile: vi.fn(async () => ({ data: { success: true }, error: null })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'ai_events') return { insert: vi.fn() };
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        single: async () => ({ data: { site_id: '55555555-5555-4555-8555-555555555555' }, error: null }),
        maybeSingle: async () => ({ data: revisions[revisions.length - 1], error: null }),
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
      const revisionId = `00000000-0000-4000-8000-${String(revisions.length + 1).padStart(12, '0')}`;
      const meta = snapshot.meta as Record<string, unknown> | undefined;
      const effectiveComposition = meta?.effectiveComposition as Record<string, unknown> | undefined;
      if (meta && effectiveComposition) {
        snapshot.meta = { ...meta, effectiveComposition: { ...effectiveComposition, revisionId } };
      }
      const row = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key.replace(/^p_/, ''), value]));
      row.vfs_files = vfsFiles;
      row.site_bundle_snapshot = snapshot;
      row.id = revisionId;
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
import { findUnresolvedLocalImports } from '@/services/laneBCompanionModules';
import { collectResolvedCompositions } from '@/platform/core/resolvedComposition';
import portableRecipes from '@/sections/recipes/stylexRecipes.generated.json';

describe('Playground canonical finalization', () => {
  it('finalizes, commits and reloads Navbar, Hero, Services, Features, Pricing, CTA, Footer, Gallery, and Testimonials portable recipes with matching runtime bytes', async () => {
    const identity = {
      userId: '11111111-1111-4111-8111-111111111111',
      businessId: '22222222-2222-4222-8222-222222222222',
      projectId: '33333333-3333-4333-8333-333333333333',
      draftId: '44444444-4444-4444-8444-444444444444',
      revisionId: '', sessionId: 'gallery-roundtrip',
    };
    const preset = THEME_PRESETS.find((theme) => theme.id === 'editorial')!;
    const compiled = commitToPipeline({ selections: {
      businessName: 'Gallery Closure Salon', businessModel: 'appointment_service',
      industryOverlay: 'salon', systemType: 'booking', primaryGoal: 'book', secondaryGoals: ['contact'],
      needsBooking: true, wantsLeadCapture: true, primaryIntent: 'booking.create',
      requestedPages: ['home', 'pricing', 'gallery', 'booking', 'contact'], scaffoldMode: 'selected-pages',
      templateId: 'store-premium', themePresetId: 'editorial', themeTokens: themePresetToThemeTokens(preset),
    } }, 'wizard-launch');
    const launched = buildCanonicalLaunchArtifacts({
      generatedFiles: compiled.siteBundleSnapshot.vfsFiles,
      siteBundleSnapshot: compiled.siteBundleSnapshot,
      compileArtifact: compiled.compileArtifact,
      canonicalPlayground: compiled.playground,
      themePresetId: 'editorial', templateId: 'store-premium',
      systemType: 'booking', businessName: 'Gallery Closure Salon', industry: 'salon',
      businessId: identity.businessId, projectId: identity.projectId,
      organizationId: '66666666-6666-4666-8666-666666666666',
      siteId: '55555555-5555-4555-8555-555555555555',
    });
    const approved = compiled.siteBundleSnapshot.meta.uiFoundation?.approvedExperienceCapabilities;
    expect(approved).toContain('experience.three-d');
    expect(launched.siteBundleSnapshot?.meta.uiFoundation?.approvedExperienceCapabilities).toEqual(approved);
    const before = JSON.stringify(launched.siteBundleSnapshot);
    const edited = structuredClone(compiled.playground);
    const gallery = Object.values(edited.pageRegistry.pages).find((page) => page.path === '/gallery')!;
    gallery.title = 'Studio Portfolio';
    const rooms = Object.values(edited.pageRegistry.pages).find((page) => page.path === '/contact')!;
    rooms.title = 'Choose your room';
    rooms.path = '/rooms';
    rooms.filePath = '/src/pages/rooms.tsx';
    rooms.pageRole = 'custom';
    rooms.pageType = 'custom';

    const result = await commitMutation({
      source: 'playground-edit', identity,
      current: { vfsFiles: launched.files, playground: edited, siteBundleSnapshot: launched.siteBundleSnapshot },
      patch: emptyPatchPlan(),
    });

    expect(result.status).toBe('committed');
    expect(result.vfsFiles['/src/pages/rooms.tsx']).toMatch(/export\s+default\b/);
    expect(result.siteBundleSnapshot?.businessName).toBe('Gallery Closure Salon');
    expect(result.siteBundleSnapshot?.industry).toBe('salon');
    expect(result.siteBundleSnapshot?.meta.uiFoundation?.approvedExperienceCapabilities).toEqual(approved);
    expect(findUnresolvedLocalImports(result.vfsFiles)).toEqual([]);
    expect(result.vfsFiles['/src/unison/publishedRuntime.ts']).toContain(identity.projectId);
    expect(result.vfsFiles['/src/unison/generatedSiteRuntimeManifest.ts']).toContain('GENERATED_SITE_RUNTIME_MANIFEST');
    expect(result.siteBundleSnapshot?.meta.seal?.sealedBy).toBe('recompile');
    expect(result.siteBundleSnapshot?.meta.seal).toMatchObject({
      authorityProofVersion: '2.0',
      registeredPageBodyAuthority: 'canonical-compiler',
      pipeline: 'canonical-compiler+stage-4b',
    });
    expect(result.siteBundleSnapshot?.routerFile.content).toBe(result.vfsFiles['/src/App.tsx']);
    expect(JSON.stringify(launched.siteBundleSnapshot)).toBe(before);
    expect(reconcile).toHaveBeenCalledOnce();
    const restored = await loadLatestRevisionForProject(identity.projectId);
    const persistedSnapshot = JSON.parse(JSON.stringify(result.siteBundleSnapshot));
    if (persistedSnapshot.meta?.effectiveComposition) {
      persistedSnapshot.meta.effectiveComposition.revisionId = restored?.id;
    }
    expect(restored?.vfsFiles).toEqual(result.vfsFiles);
    expect(restored?.siteBundleSnapshot).toEqual(persistedSnapshot);
    expect(restored?.playground?.pageRegistry.pages[gallery.pageId]).toMatchObject({ title: 'Studio Portfolio', path: '/gallery' });
    expect(restored?.playground?.pageRegistry.pages[rooms.pageId]).toMatchObject({
      title: 'Choose your room', path: '/rooms', pageRole: 'services', pageType: 'landing',
    });
    expect(result.siteBundleSnapshot?.bindings).toEqual(launched.siteBundleSnapshot?.bindings);
    const initialGalleryComposition = collectResolvedCompositions(launched.files)[gallery.filePath!];
    expect(collectResolvedCompositions(result.vfsFiles)[gallery.filePath!])
      .toMatchObject({
        templateName: `Gallery Closure Salon ${String.fromCharCode(0x00B7)} Studio Portfolio`,
        sections: initialGalleryComposition.sections,
        variantOverrides: initialGalleryComposition.variantOverrides,
      });
    expect(restored?.vfsFiles['/src/components/recipes/Gallery.ts']).toBe(portableRecipes.families.gallery);
    expect(result.vfsFiles['/src/components/recipes/Navbar.ts']).toBe(portableRecipes.families.navbar);
    expect(restored?.vfsFiles['/src/components/recipes/Navbar.ts']).toBe(portableRecipes.families.navbar);
    expect(result.vfsFiles['/src/components/recipes/Testimonials.ts']).toBe(portableRecipes.families.testimonials);
    expect(restored?.vfsFiles['/src/components/recipes/Testimonials.ts']).toBe(portableRecipes.families.testimonials);
    expect(result.vfsFiles['/src/components/recipes/Hero.ts']).toBe(portableRecipes.families.hero);
    expect(restored?.vfsFiles['/src/components/recipes/Hero.ts']).toBe(portableRecipes.families.hero);
    expect(result.vfsFiles['/src/components/recipes/Services.ts']).toBe(portableRecipes.families.services);
    expect(restored?.vfsFiles['/src/components/recipes/Services.ts']).toBe(portableRecipes.families.services);
    expect(result.vfsFiles['/src/components/recipes/Features.ts']).toBe(portableRecipes.families.features);
    expect(restored?.vfsFiles['/src/components/recipes/Features.ts']).toBe(portableRecipes.families.features);
    expect(result.vfsFiles['/src/components/recipes/Pricing.ts']).toBe(portableRecipes.families.pricing);
    expect(restored?.vfsFiles['/src/components/recipes/Pricing.ts']).toBe(portableRecipes.families.pricing);
    expect(result.vfsFiles['/src/components/recipes/CTA.ts']).toBe(portableRecipes.families.cta);
    expect(restored?.vfsFiles['/src/components/recipes/CTA.ts']).toBe(portableRecipes.families.cta);
    expect(result.vfsFiles['/src/components/recipes/Footer.ts']).toBe(portableRecipes.families.footer);
    expect(restored?.vfsFiles['/src/components/recipes/Footer.ts']).toBe(portableRecipes.families.footer);
  }, 20_000);
});
