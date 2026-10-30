import { supabase } from '@/integrations/supabase/client';
import { createConfirmedLaunchIds, provisionConfirmedLaunchSite } from '@/services/confirmedLaunchProvisioner';
import { commitMutation } from '@/services/vfsCommitService';
import { legacyFilesToPatchPlan } from '@/types/patchPlan';
import type { AuthoredMarketplaceTemplate } from './marketplaceTemplatePrimitives';
import { getSupabaseFunctionHeaders, getSupabaseFunctionUrl } from '@/integrations/supabase/supabaseFunctionRequest';
import { readUnisonSiteMaterial } from '@/services/export/importUnisonSiteZip';
import { buyerDraftSnapshot } from './buyerDraftSnapshot';
import { materializeTemplateWithAppBuilder, type MarketplaceTemplateMaterial } from './materializeTemplateWithAppBuilder';
import { seedLaunchAssets } from '@/services/resources/seedLaunchAssets';
import { persistGeneratedBindings } from '@/services/persistGeneratedBindings';
import { planLaunchFormDefinitions } from '@/services/launchFormDefinitions';
import { persistLaunchFormDefinitions } from '@/services/launchFormDefinitionPersistence';
import { resolvePlaygroundBindingDomIntent } from '@/platform/core/playground';
import { verifyGeminiBeforeInstall } from './geminiInstallPreflight';

export type MarketplaceDraftSelection = { kind: 'concept'; template: AuthoredMarketplaceTemplate } | { kind: 'release'; slug: string; title: string };

export interface InstallProgress { label: string; done?: number; total?: number }
export interface InstallOptions { signal?: AbortSignal; onStatus?: (status: InstallProgress) => void }

export async function installTemplateDraft(selection: MarketplaceDraftSelection, options: InstallOptions = {}) {
  const status = (next: InstallProgress) => options.onStatus?.(next);
  status({ label: 'Checking your account' });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sign in before installing a template draft.');
  status({ label: 'Checking Gemini connection and credit' });
  await verifyGeminiBeforeInstall(options.signal);
  if (options.signal?.aborted) throw new Error('Installation was stopped before it started.');
  let artifacts: MarketplaceTemplateMaterial;
  let receipt: { installationId: string } | undefined;
  if (selection.kind === 'concept') {
    const { buildConceptDraftSource } = await import('./conceptDraftSource');
    artifacts = buildConceptDraftSource(selection.template);
  } else {
    const response = await fetch(getSupabaseFunctionUrl('marketplace-install-template'), {
      method: 'POST', headers: { ...await getSupabaseFunctionHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim', slug: selection.slug, idempotencyKey: crypto.randomUUID() }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error ?? 'Template installation could not be authorized.');
    receipt = { installationId: payload.installationId };
    const packageResponse = await fetch(payload.packageUrl);
    if (!packageResponse.ok) throw new Error('The template package could not be loaded.');
    artifacts = await readUnisonSiteMaterial(await packageResponse.blob(), { fallbackName: selection.title });
  }
  if (!artifacts.siteBundleSnapshot) throw new Error('The template has no editable page registry.');
  const snapshot = buyerDraftSnapshot(artifacts.siteBundleSnapshot);
  const title = selection.kind === 'concept' ? selection.template.name : selection.title;
  const themePresetId = String(snapshot.meta.themePresetId ?? 'modern');
  status({ label: 'Creating your project' });
  const ids = await provisionConfirmedLaunchSite({ ids: createConfirmedLaunchIds(), businessName: title, siteName: title,
    industry: snapshot.industry, systemType: String(snapshot.meta.systemId ?? 'agency'), templateId: String(snapshot.meta.templateId ?? ''), themePresetId });
  const pageCount = Object.keys(snapshot.pageRegistry?.pages ?? {}).length;
  status({ label: 'Building pages', done: 0, total: pageCount });
  let built = 0;
  const buyerArtifacts = await materializeTemplateWithAppBuilder({ ...artifacts, siteBundleSnapshot: snapshot }, ids, {
    signal: options.signal,
    onStatus: label => status({ label, done: built, total: pageCount }),
    onPage: event => {
      if (event.phase !== 'authoring') built = Math.min(event.total, built + 1);
      status({ label: event.phase === 'authoring' ? `Building ${event.title}` : 'Building pages', done: built, total: event.total });
    },
  });
  if (!buyerArtifacts.siteBundleSnapshot) throw new Error('The buyer draft could not be prepared.');
  if (options.signal?.aborted) throw new Error(String(options.signal.reason ?? 'Installation was stopped before the draft was saved.'));
  status({ label: 'Saving your draft' });
  const activePagePath = installActivePagePath(buyerArtifacts);
  if (!activePagePath) throw new Error('The template draft has no Home page to open.');
  const commit = await commitMutation({ source: 'wizard-launch', identity: {
    userId: user.id, businessId: ids.businessId, projectId: ids.projectId, draftId: ids.draftId, revisionId: '', sessionId: `marketplace-install:${ids.draftId}`,
  }, current: { vfsFiles: {}, activePagePath }, patch: legacyFilesToPatchPlan(buyerArtifacts.files, `Install ${title} as a project draft`), options: {
    requirePreviewPass: true, requireReadinessPass: false, businessName: title, industry: snapshot.industry, themePresetId,
    reviewedArtifact: { siteBundleSnapshot: buyerArtifacts.siteBundleSnapshot, runtimeManifest: buyerArtifacts.runtimeManifest,
      playground: buyerArtifacts.canonicalPlayground as never },
  } });
  if (commit.status !== 'committed' || !commit.persistedRevisionId) throw new Error('The template draft was not saved.');
  status({ label: 'Setting up products, content and buttons' });
  // Match fresh-launch setup: records/actions belong to the confirmed buyer scope.
  try {
    await seedLaunchAssets({ businessId: ids.businessId, projectId: ids.projectId, industry: snapshot.industry,
      creatorData: commit.playground?.creatorData ?? buyerArtifacts.siteBundleSnapshot.creatorData,
      mediaAssets: artifacts.mediaAssets });
    const acceptedSnapshot = commit.siteBundleSnapshot ?? buyerArtifacts.siteBundleSnapshot;
    const pages = Object.values(acceptedSnapshot.pageRegistry?.pages ?? {});
    const bindings = await persistGeneratedBindings({
      businessId: ids.businessId,
      projectId: ids.projectId,
      files: commit.vfsFiles,
      pageRoutesById: Object.fromEntries(pages.map((page) => [page.pageId, page.path || '/'])),
      pageSurfaces: pages.flatMap((page) => page.filePath ? [{
        route: page.path || '/',
        filePath: page.filePath,
        bindings: Object.values(acceptedSnapshot.bindings ?? {})
          .filter((binding) => binding.sourcePageId === page.pageId && binding.sourceSlot && binding.coreIntent)
          .map((binding) => ({
            sourceSlot: binding.sourceSlot!,
            intent: resolvePlaygroundBindingDomIntent(binding),
          })),
      }] : []),
    });
    if (bindings.failed) throw new Error('Some template actions could not be saved.');
    const forms = await persistLaunchFormDefinitions({ businessId: ids.businessId, projectId: ids.projectId, siteId: ids.siteId,
      definitions: planLaunchFormDefinitions({ vfsFiles: commit.vfsFiles }) });
    if (forms.error) throw new Error(forms.error);
  } catch (error) {
    throw new Error(`Your draft was saved, but its editable data setup did not finish: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (receipt) {
    const response = await fetch(getSupabaseFunctionUrl('marketplace-install-template'), {
      method: 'POST', headers: { ...await getSupabaseFunctionHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', ...receipt, projectId: ids.projectId, draftId: ids.draftId, revisionId: commit.persistedRevisionId }),
    });
    if (!response.ok) throw new Error('Your draft was saved, but its installation receipt could not be recorded.');
  }
  return { businessId: ids.businessId, projectId: ids.projectId, draftId: ids.draftId, revisionId: commit.persistedRevisionId,
    templateName: title, startInPreview: true, fromLauncher: true, vfsFiles: commit.vfsFiles, siteBundleSnapshot: commit.siteBundleSnapshot,
    runtimeManifest: commit.runtimeManifest, canonicalPlayground: commit.playground, entryPoint: artifacts.entryPoint, themePresetId };
}
/** The saved draft must open on a page that exists in the accepted files: Home first, then the entry file. */
export function installActivePagePath(artifacts: { files?: Record<string, string>; siteBundleSnapshot?: { pageRegistry?: { homePageId?: string; pages?: Record<string, unknown> } } | null; entryPoint?: string }): string | null {
  const files = artifacts.files ?? {};
  const registry = artifacts.siteBundleSnapshot?.pageRegistry;
  const pages = Object.values(registry?.pages ?? {}) as Array<{ id?: string; filePath?: string; isHome?: boolean }>;
  const home = (registry?.homePageId ? (registry.pages as Record<string, { filePath?: string }> | undefined)?.[registry.homePageId] : undefined)
    ?? pages.find(page => page.isHome);
  const candidates = [home?.filePath, ...pages.map(page => page.filePath), artifacts.entryPoint, '/src/App.tsx'];
  return candidates.find((path): path is string => Boolean(path && path in files)) ?? null;
}
