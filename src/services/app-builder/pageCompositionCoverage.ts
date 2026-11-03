import type { PlannedPage } from '@/services/composition';
import type { AppBuilderPageSectionMaterialization } from './appBuilderSectionModel';
import { normalizePageRole } from '@/services/composition/industryCompositionRegistry';
import { pageArchetypeIssues } from '@/sections/pageArchetypeContract';
import { getVariantById, type VariantId } from '@/sections/variants';

/** Check actual rendered source objects, not labels or a model's completion claim. */
export function pageCompositionCoverage(planned: PlannedPage | undefined, page: AppBuilderPageSectionMaterialization): string[] {
  if (!planned) return [`${page.filePath}: canonical composition target missing.`];
  const body = page.inspection.sections.filter(section => section.semanticType !== 'navbar' && section.semanticType !== 'footer');
  const actual = body.map(section => section.semanticType);
  const tags: Record<string, string[]> = {};
  for (const section of body) {
    const variant = section.variantId ? getVariantById(section.variantId as VariantId) : undefined;
    tags[section.semanticType] = [...(tags[section.semanticType] ?? []), ...(variant?.tags ?? [])];
  }
  // The target suggests a starting composition; page-role archetypes alone
  // enforce required/forbidden families and body-size limits.
  return pageArchetypeIssues(normalizePageRole(planned.role), actual, tags);
}