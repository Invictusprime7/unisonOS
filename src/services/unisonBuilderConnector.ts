import type {
  UnisonBuilderConnectorInput,
  UnisonBuilderTurnContext,
} from '@/types/unisonBuilderConnector';
import { readMaterializedDesignSources } from '@/services/app-builder/design/designSourceMaterializer';
import { readCreativeBrief, renderCreativeBriefDirective, type PersistedCreativeBrief } from '@/services/launch/experienceDirector';
import { getVerticalPack, renderVerticalKnowledge, verticalForIndustry } from '@/services/composition/verticals';
import { photoLibraryKey, verifiedPhotosFor } from '@/services/app-builder/design/pageStructureGate';
import { SECTION_CONTENT_DEPTH_POLICY } from '@/services/app-builder/creativeAuthorityPolicy';
import type { CreationVertical } from '@/platform/core/universalCreation';

// Canonical Unison token roles (values are always supplied by the project's sealed theme).
const TOKEN_NAMES = [
  '--background', '--foreground', '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground', '--accent', '--accent-foreground',
  '--muted', '--muted-foreground', '--card', '--card-foreground', '--border',
  '--destructive', '--destructive-foreground', '--ut-border-weight',
  '--ut-font-display', '--ut-font-body', '--ut-font-mono', '--ut-section-space',
  '--ut-density-gap', '--ut-density-padding', '--ut-radius-base',
  '--ut-motion-duration', '--ut-motion-ease', '--ut-motion-distance',
] as const;

/** Read-only, deterministic assembly; this connector has no database or VFS writer. */
export function createUnisonBuilderContext(input: UnisonBuilderConnectorInput): UnisonBuilderTurnContext {
  const brief = readCreativeBrief(input.files);
  const selection = input.selection ?? null;
  if (selection?.projectId && input.projectId && selection.projectId !== input.projectId) {
    throw new Error('Selected element belongs to another project. Re-select it before editing.');
  }
  if (selection?.revisionId && input.revisionId && selection.revisionId !== input.revisionId) {
    throw new Error('Selected element belongs to an older revision. Re-select it before editing.');
  }
  const sourceTargets = [...new Set(input.sourceTargets ?? [])];
  for (const path of sourceTargets) {
    if (!path.startsWith('/src/') || path.split('/').includes('..')) {
      throw new Error(`Invalid Builder source target: ${path}`);
    }
    if (input.files && typeof input.files[path] !== 'string') {
      throw new Error(`Builder source target is missing: ${path}. Create new pages through page operations.`);
    }
  }
  const registry = input.registryContext ?? null;
  if (registry?.implementations.some(item => !['approved', 'portable'].includes(item.certification))) {
    throw new Error('Builder registry context contains an uncertified implementation. Resolve canonical eligibility before authoring.');
  }
  const descriptor = input.descriptor ?? null;
  const resourceMark = selection?.resourceMark ?? null;
  const filePath = selection?.componentPath ?? null;
  const ownerKind = descriptor?.ownerKind ?? (resourceMark || (selection?.sourceTable && selection.rowId)
    ? 'resource' : filePath ? 'source' : 'unbound');
  const catalogSummary = input.catalogSummary?.trim() || null;
  return {
    version: 'unison-builder-connector/v1',
    identity: { projectId: input.projectId ?? null, businessId: input.businessId ?? null, revisionId: input.revisionId ?? null },
    request: input.requestEnvelope ?? null,
    element: selection ? { selection: { ...selection }, descriptor, ownerKind, filePath, resourceMark } : null,
    catalog: { summary: catalogSummary, authority: 'agentOperations/ResourceRuntime' },
    registry: {
      signature: registry?.designRegistrySignature ?? null,
      industry: registry?.industry ?? null,
      artDirectionPackId: registry?.artDirectionPackId ?? null,
      allowedImplementationIds: registry?.implementations.map(item => item.id) ?? [],
      projection: registry,
      materializedRecipes: readMaterializedDesignSources(input.files),
    },
    designSystem: {
      tokenNames: TOKEN_NAMES, preserveSealedArtDirection: true,
      existingFiles: 'explicit-hunks', newFiles: 'complete-source', routerAuthority: 'PageRegistry',
    },
    sourceTargets,
    unavailable: [
      ...(!selection ? ['element' as const] : []),
      ...(!catalogSummary ? ['catalog' as const] : []),
      ...(!registry ? ['registry' as const] : []),
    ],
    creativeBrief: renderCreativeBriefDirective(brief, input.requestEnvelope?.summary) || null,
    siteKnowledge: renderSiteEnrichment(resolveSiteEnrichment(brief, registry?.industry ?? null)) || null,
  };
}

/**
 * The site's sealed industry enrichment: the launch vertical when the brief
 * carries it, otherwise the pack matching the site's industry (sites launched
 * before enrichment was sealed).
 */
export function resolveSiteEnrichment(
  brief: PersistedCreativeBrief | null,
  registryIndustry?: string | null,
): { industry: string | null; vertical: CreationVertical | null } {
  const industry = brief?.site?.industry ?? registryIndustry ?? null;
  const sealed = brief?.site?.vertical ?? null;
  if (sealed && getVerticalPack(sealed.packId)) return { industry, vertical: sealed };
  return { industry, vertical: verticalForIndustry(industry) ?? verticalForIndustry(photoLibraryKey(industry)) };
}

/** Edit-time and new-page enrichment: trade knowledge, copy depth and the site's photo library. */
export function renderSiteEnrichment(site: { industry: string | null; vertical: CreationVertical | null }): string {
  const knowledge = renderVerticalKnowledge(site.vertical);
  const photos = verifiedPhotosFor(site.industry ?? undefined, 6, [site.vertical?.packId, site.vertical?.blendPackId]);
  const specific = Boolean(site.vertical) || Boolean(site.industry && site.industry !== 'generic' && site.industry !== 'general');
  return [
    'SITE ENRICHMENT (sealed at launch): every new or edited section keeps this trade, depth and imagery; never fall back to generic copy or office stock photos.',
    knowledge,
    SECTION_CONTENT_DEPTH_POLICY,
    specific ? `SITE PHOTO LIBRARY (verified; copy exactly when a section needs imagery, never invent image URLs): ${photos.join(' ')}` : '',
  ].filter(Boolean).join('\n');
}

/** Compact guidance rides existing request contracts; no new edge endpoint or duplicated sources. */
export function renderUnisonBuilderDirective(context: UnisonBuilderTurnContext): string {
  return [
    '[UNISON BUILDER CONNECTOR v1]',
    `Identity: ${JSON.stringify(context.identity)}`,
    `Source targets: ${context.sourceTargets.join(', ') || 'not resolved'}`,
    context.element ? `Selected property owner: ${JSON.stringify(context.element)}` : '',
    // Owner decisions and sealed enrichment lead, ahead of long recipe lists, so a capped channel never cuts them.
    context.creativeBrief ?? '',
    context.siteKnowledge ?? '',
    `Existing files require explicit necessary hunks; complete source is allowed only for new files. PageRegistry alone authors /src/App.tsx.`,
    'Saved catalog/content values must use agentOperations through ResourceRuntime; presentation edits preserve record marks, bindings and button destinations.',
    `Canonical implementations: ${context.registry.allowedImplementationIds.join(', ') || 'not resolved; do not invent certification'}`,
    `App Builder materialized portable recipes (implementation ID -> module, export, props): ${JSON.stringify(context.registry.materializedRecipes)}`,
    'App Builder is the sole source author. Import verified public recipe exports, never recipe internals or invented component IDs. Preserve sectionId and componentInstanceId; componentInstanceId belongs to the canonical functional instance, not the variant ID. Never manufacture cmp_ IDs.',
    'Local disclosure, menu, lightbox and billing toggles stay in component state with no backend intent. auth.login/auth.register on links open or focus authentication; forms use data-intent-form="auth.login"/"auth.register" and auth.submit slot, never duplicate click intents on submit buttons.',
    `Sealed Art Direction: ${context.registry.artDirectionPackId ?? 'not supplied; preserve existing theme'}`,
    `Design token roles: ${context.designSystem.tokenNames.join(', ')}`,
    'Capability and binding validation remain mandatory; missing business capability readiness blocks publishing, not a safe preview draft.',
    context.catalog.summary ? `Connected catalog context:\n${context.catalog.summary}` : '',
    `Unavailable context: ${context.unavailable.join(', ') || 'none'}. Missing context is not proof of permission or readiness.`,
  ].filter(Boolean).join('\n');
}