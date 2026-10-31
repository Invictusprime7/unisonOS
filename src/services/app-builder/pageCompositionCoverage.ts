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
  const expected = planned.target.sectionOrder.filter(family => family !== 'navbar' && family !== 'footer');
  const tags: Record<string, string[]> = {};
  for (const section of body) {
    const variant = getVariantById(section.variantId as VariantId);
    tags[section.semanticType] = [...(tags[section.semanticType] ?? []), ...(variant?.tags ?? [])];
  }
  const errors = pageArchetypeIssues(normalizePageRole(planned.role), actual, tags);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${page.filePath}: planned section order ${expected.join(' → ')} must be preserved; rendered ${actual.join(' → ') || 'no body sections'}.`);
  }
  return errors;
}