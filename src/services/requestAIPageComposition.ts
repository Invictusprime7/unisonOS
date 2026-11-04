import { projectResolvedArtDirection } from '@/sections/variants/resolvedArtDirection';
import { describeCompositionFailure, type CompositionFailureDetails } from './compositionFailure';
import { normalizeCompositionResponse, renderCompositionCanonicalContract } from './launch/compositionCanonicalContract';
import { runBuilderTurn } from './builderBrainClient';
import { buildWizardDesignIntervention } from './wizardDesignIntervention';
import { COMPOSITION_ROLES, validateAIPageComposition, type AIPageCompositionPlan } from '@/sections/aiPageComposition';
import { VARIANT_REGISTRY, getGenerationVariantsForSection, getVariantById } from '@/sections/variants/registry';
import { pageArchetypeIssues } from '@/sections/pageArchetypeContract';
import { compileSiteDesignContract, projectSiteDesignContract, projectionDensityIssues } from '@/services/launch/siteDesignContract';
import type { VariantId } from '@/sections/variants/types';
import { ART_DIRECTION_PACKS } from '@/sections/variants/artDirectionPacks';
import type { WizardSelections } from '@/types/playground';
import type { WizardAggregatedRegistryContext } from '@/services/launch/wizardRegistryAggregation';
import { deriveImplementationVisualSignature } from '@/services/implementationVisualSignature';
import { isImplementationExperienceCompatible } from '@/services/designCompatibilityGraph';
import { childSeed, hashSeed, seededShuffle } from '@/platform/core/generationSeed';

export type CompositionFailure = 'endpoint-unavailable' | 'authentication' | 'request-rejected' | 'provider' | 'invalid-response' | 'incomplete-plan' | 'transport';

export function buildSeededCompositionGuidance(
  seed: string,
  roles: readonly string[],
  variants: ReadonlyArray<{ id: string; family: string; pageRoles: readonly string[] }>,
) {
  return {
    seed: hashSeed(seed).toString(36),
    pages: roles.map(role => {
      const eligible = variants.filter(variant => !variant.pageRoles.length || variant.pageRoles.includes(role));
      const families = Array.from(new Set(eligible.map(variant => variant.family)));
      const familyOrder = seededShuffle(childSeed(seed, 'composition', role, 'families'), families);
      const variantsByFamily = Object.fromEntries(familyOrder.map(family => [family,
        seededShuffle(childSeed(seed, 'composition', role, family), eligible
          .filter(variant => variant.family === family).map(variant => variant.id)),
      ]));
      return { role, familyOrder, variants: variantsByFamily };
    }),
  };
}

export function applySeededCompositionChoices(
  plan: AIPageCompositionPlan,
  guidance: ReturnType<typeof buildSeededCompositionGuidance>,
  pinnedVariants: Readonly<Record<string, string>> = {},
): AIPageCompositionPlan {
  const guidanceByRole = new Map(guidance.pages.map(page => [page.role, page.variants]));
  return {
    ...plan,
    pages: plan.pages.map(page => {
      const rankedVariants = guidanceByRole.get(page.role);
      return {
        ...page,
        variants: Object.fromEntries(Object.entries(page.variants).map(([family, modelChoice]) => [
          family,
          pinnedVariants[family] ? modelChoice : rankedVariants?.[family]?.[0] ?? modelChoice,
        ])),
      };
    }),
  };
}

export async function requestAIPageComposition(selections: WizardSelections, signal: AbortSignal, invoke = runBuilderTurn, onFailure?: (reason: CompositionFailure, details?: CompositionFailureDetails) => void, registryContext?: WizardAggregatedRegistryContext) {
  const fail = (reason: CompositionFailure, details?: CompositionFailureDetails) => {
    console.warn('[wizard-composition] failed', { reason, ...details });
    if (details) onFailure?.(reason, details);
    else onFailure?.(reason);
    return null;
  };
  const design = buildWizardDesignIntervention({ ...selections, themePresetId: selections.themePresetId || 'modern', projectId: selections.projectId ?? selections.businessId });
  const pack = ART_DIRECTION_PACKS[design.artDirectionPackId];
  const roles = COMPOSITION_ROLES.filter(role => role === 'home' || selections.requestedPages?.includes(role));
  const experiencePreference = selections.designSelection?.experience ?? 'standard';
  const pinnedVariants = Object.fromEntries(Object.values(selections.designSelection?.sectionPins ?? {})
    .map(id => [String(id).split(':')[0], id]));
  // The site design contract is compiled ONCE here, at the canonical acceptance
  // point, and transported as a projection. Downstream never recompiles it.
  const designContract = projectSiteDesignContract(compileSiteDesignContract({
    industry: selections.industryOverlay,
    roles,
    artDirectionPackId: pack.id,
    experience: experiencePreference,
    mode: selections.designSelection?.mode ?? 'auto',
  }));
  // Phase D: the resolved Art Direction (family → pack) travels inside the
  // contract so the composer composes within the family grammar only.
  const resolvedArt = projectResolvedArtDirection({
    themePresetId: selections.themePresetId || 'modern',
    artDirectionPackId: pack.id,
    aiDirective: design.aiDirective,
  });
  if (resolvedArt) {
    const directive = `ART DIRECTION: family ${resolvedArt.familyId}, pack ${resolvedArt.packId} (v${resolvedArt.packVersion}). Compose creatively inside this grammar; never switch family. Final tokens are projected by the compiler after composition.`;
    designContract.artDirection = { familyId: resolvedArt.familyId, packId: resolvedArt.packId, storagePackId: resolvedArt.storagePackId, directive };
    designContract.summary = `${designContract.summary}\n  ${directive}`;
  }
  const variants = [...new Map(Object.keys(VARIANT_REGISTRY).flatMap(type => roles.flatMap(role =>
    getGenerationVariantsForSection(type as import('@/sections/types').SectionType, pack, role))).map(variant => [variant.id, variant])).values()]
    .filter(variant => isImplementationExperienceCompatible(deriveImplementationVisualSignature(variant), experiencePreference))
    .map(variant => ({ id: variant.id, family: variant.sectionType, description: variant.description, tags: variant.tags,
      pageRoles: roles.filter(role => getGenerationVariantsForSection(variant.sectionType, pack, role).some(eligible => eligible.id === variant.id)), preferredSource: true, certification: variant.vfs?.certification ?? 'approved',
      visualSignature: deriveImplementationVisualSignature(variant) }));
  const compositionGuidance = buildSeededCompositionGuidance(design.seed, roles, variants);
  try {
    const response = await invoke({ mode: 'wizard-site-composition', gatewayOptions: { maxTokens: 6000, reasoningEffort: 'none' }, messages: [{ role: 'user', content: JSON.stringify({
      task: 'Compose every requested page with original business-specific copy, section order and local variants. Prefer certified 21st-derived options when suitable. Use the seeded composition preferences as a project-specific starting point, while choosing any eligible option that better serves the page. Preserve page roles and all business content. No source code or new routes.',
      designGuidance: 'Compose only the listed certified 21st-derived implementations. Each variant carries its provenance (origin, author, sourceUrl) and thumbnail: favour variants with generationStatus "preferred" and 21st origin for the highest-impact sections (hero, features, gallery, testimonials) when they fit the page role. Use industry purpose, page role, existing business assets and canonical navigation to vary each site. The seeded composition guidance ranks eligible family order and variants for this project; use it as a meaningful preference, not a whitelist. Keep every listed option available to your judgement. Never copy demo URLs, branding or placeholder links.',
      launchSeed: compositionGuidance.seed, compositionSeed: compositionGuidance.seed,
      compositionGuidance: compositionGuidance.pages,
      vision: selections.visionPrompt, needs: selections.secondaryGoals,
      businessName: selections.businessName, industry: selections.industryOverlay, goal: selections.primaryGoal,
       roles, pack: pack.id, variants,
       designSelection: { mode: selections.designSelection?.mode ?? 'auto', artDirectionPackId: pack.id, experience: experiencePreference, pinnedVariants },
       assets: registryContext?.assets,
       runtimeDependencies: registryContext?.runtimeDependencies,
       primitiveFamilies: registryContext?.primitiveFamilies,
       capabilityRequirements: registryContext?.capabilityRequirements,
       implementationContracts: registryContext?.implementations?.map(implementation => ({
         id: implementation.id, sectionType: implementation.sectionType,
         runtimeDependencies: implementation.runtimeDependencies,
         componentStates: implementation.componentStates,
         visualSignature: implementation.visualSignature,
         compatibleExperiencePreferences: implementation.compatibleExperiencePreferences,
         artifactContract: implementation.artifactContract,
       })),
      designContract,
      canonicalContract: renderCompositionCanonicalContract({ roles, variants, experiencePreference, pinnedVariants, industry: selections.industryOverlay, designContract }),
      output: { version: '1.0', pages: [{ role: 'home', sectionOrder: ['navbar','hero','services','testimonials','cta','footer'], variants: { services: 'choose an eligible id' }, copy: { hero: { headline: 'Original business-specific headline', subheadline: 'Useful supporting copy' } } }] },
      constraints: 'Choose only listed IDs, roles and families. Include every requested role exactly once with at least one eligible variant choice. sectionOrder lists desired family order; eligible missing sections with copy are added and existing business sections are preserved. Copy is optional because canonical business content is preserved. When writing copy, use original headline, subheadline and description text by family. For services/features use copy.items with title and description; for FAQ use question and answer. Do not invent testimonials, metrics, certifications, prices or business facts. Navbar, hero and footer positions are compiler-owned. Never alter data, intents, assets, theme, dependencies or files.',
    }) }] }, { signal, functionName: 'wizard-site-composer' });
    signal.throwIfAborted();
    if (response.error) {
      const details = describeCompositionFailure(response.error, response.data);
      const reason = details.status === 404 ? 'endpoint-unavailable' : details.status === 401 || details.status === 403 ? 'authentication' : details.status === 400 ? 'request-rejected' : 'provider';
      return fail(reason, details);
    }
    const modelPlan = validateAIPageComposition(normalizeCompositionResponse(response.data, { roles, variants, industry: selections.industryOverlay }), pack.id, roles, { experiencePreference, pinnedVariants });
    if (!modelPlan) return fail('invalid-response');
    const plan = validateAIPageComposition(
      applySeededCompositionChoices(modelPlan, compositionGuidance, pinnedVariants),
      pack.id,
      roles,
      { experiencePreference, pinnedVariants },
    );
    if (!plan) return fail('invalid-response');
    // Page archetype closure — page-specific required families and negative
    // vocabulary. The composition lane already repairs and re-asks the model;
    // anything still violating the archetype is not an acceptable composition.
    const archetypeIssues = plan.pages.flatMap(page => pageArchetypeIssues(page.role, page.sectionOrder,
      Object.fromEntries(Object.entries(page.variants).map(([family, id]) => [family, getVariantById(id as VariantId)?.tags ?? []])),
      // Required families are repaired by the composition lane against the
      // model; the client gate enforces the negative vocabulary and ceiling.
      { requireFamilies: false, industry: selections.industryOverlay }));
    if (archetypeIssues.length) return fail('invalid-response', { message: 'AI composition violated the page archetype contract: ' + archetypeIssues.slice(0, 6).join('; ') });
    // Compiled site design contract: the page density budget is hard here too,
    // so a page can never ship thinner or longer than its compiled profile.
    const densityIssues = plan.pages.flatMap(page => projectionDensityIssues(designContract, page.role, page.sectionOrder).hard);
    if (densityIssues.length) return fail('invalid-response', { message: 'AI composition violated the site design contract: ' + densityIssues.slice(0, 6).join('; ') });
    const missingRoles = roles.filter(role => !plan.pages.some(page => page.role === role && Object.keys(page.variants).length > 0));
    if (missingRoles.length) return fail('incomplete-plan', { missingRoles, message: 'AI omitted a valid composition for: ' + missingRoles.join(', ') + '. Please retry generation.' });
    console.info('[wizard-composition] accepted', { roles: plan.pages.map(page => page.role) });
    return plan;
  } catch (error) {
    if (signal.aborted) throw error;
    return fail('transport', describeCompositionFailure(error));
  }
}
