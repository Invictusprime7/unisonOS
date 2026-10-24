import { supabase } from '@/integrations/supabase/client';
import { createConfirmedLaunchIds, provisionConfirmedLaunchSite } from '@/services/confirmedLaunchProvisioner';
import { commitMutation } from '@/services/vfsCommitService';
import { legacyFilesToPatchPlan } from '@/types/patchPlan';
import { buildCanonicalLaunchArtifacts } from '@/services/canonicalLaunchVfs';
import type { CanonicalLaunchArtifacts } from '@/services/canonicalLaunchVfs';
import type { AuthoredMarketplaceTemplate } from './marketplaceTemplatePrimitives';
import { getSupabaseFunctionHeaders, getSupabaseFunctionUrl } from '@/integrations/supabase/supabaseFunctionRequest';
import { importUnisonSiteZip } from '@/services/export/importUnisonSiteZip';

export type MarketplaceDraftSelection = { kind: 'concept'; template: AuthoredMarketplaceTemplate } | { kind: 'release'; slug: string; title: string };

export async function installTemplateDraft(selection: MarketplaceDraftSelection) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sign in before installing a template draft.');
  let artifacts: CanonicalLaunchArtifacts;
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
    const imported = await importUnisonSiteZip(await packageResponse.blob(), { fallbackName: selection.title });
    artifacts = buildCanonicalLaunchArtifacts({ generatedFiles: imported.vfsFiles, siteBundleSnapshot: imported.siteBundleSnapshot,
      canonicalPlayground: imported.canonicalPlayground, preferredEntryPoint: imported.entryPoint,
      mergeWithCanonicalSnapshot: true, allowCanonicalPageFallback: false, strictPreflight: true, themePresetId: imported.themePresetId });
  }
  const snapshot = artifacts.siteBundleSnapshot;
  if (!snapshot) throw new Error('The template has no editable page registry.');
  const title = selection.kind === 'concept' ? selection.template.name : selection.title;
  const themePresetId = String(snapshot.meta.themePresetId ?? 'modern');
  const ids = await provisionConfirmedLaunchSite({ ids: createConfirmedLaunchIds(), businessName: title, siteName: title,
    industry: snapshot.industry, systemType: String(snapshot.meta.systemId ?? 'agency'), templateId: String(snapshot.meta.templateId ?? ''), themePresetId });
  // Regenerate only buyer-scoped runtime infrastructure; preserve the authored pages.
  const buyerArtifacts = buildCanonicalLaunchArtifacts({ generatedFiles: artifacts.files, siteBundleSnapshot: snapshot,
    canonicalPlayground: artifacts.canonicalPlayground, preferredEntryPoint: artifacts.entryPoint,
    businessId: ids.businessId, projectId: ids.projectId, siteId: ids.siteId,
    mergeWithCanonicalSnapshot: true, allowCanonicalPageFallback: false, preservePageSources: true, strictPreflight: true, themePresetId });
  if (!buyerArtifacts.siteBundleSnapshot) throw new Error('The buyer draft could not be prepared.');
  const commit = await commitMutation({ source: 'wizard-launch', identity: {
    userId: user.id, businessId: ids.businessId, projectId: ids.projectId, draftId: ids.draftId, revisionId: '', sessionId: `marketplace-install:${ids.draftId}`,
  }, current: { vfsFiles: {} }, patch: legacyFilesToPatchPlan(buyerArtifacts.files, `Install ${title} as a project draft`), options: {
    requirePreviewPass: true, requireReadinessPass: false, businessName: title, industry: snapshot.industry, themePresetId,
    reviewedArtifact: { siteBundleSnapshot: buyerArtifacts.siteBundleSnapshot, runtimeManifest: buyerArtifacts.runtimeManifest,
      playground: buyerArtifacts.canonicalPlayground as never },
  } });
  if (commit.status !== 'committed' || !commit.persistedRevisionId) throw new Error('The template draft was not saved.');
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