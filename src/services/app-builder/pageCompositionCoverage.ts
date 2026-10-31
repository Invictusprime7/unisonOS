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
    const variant = section.variantId ? getVariantById(section.variantId as VariantId) : undefined;
    tags[section.semanticType] = [...(tags[section.semanticType] ?? []), ...(variant?.tags ?? [])];
  }
  const errors = pageArchetypeIssues(normalizePageRole(planned.role), actual, tags);
  // Planned sections must all render in planned order. Extra supporting sections
  // (e.g. a closing CTA) are allowed when they are distinct families; repeating a
  // family is still rejected because it reads as duplicated content.
  let cursor = 0;
  for (const family of actual) if (family === expected[cursor]) cursor += 1;
  const counts = new Map<string, number>();
  for (const family of actual) counts.set(family, (counts.get(family) ?? 0) + 1);
  const plannedCounts = new Map<string, number>();
  for (const family of expected) plannedCounts.set(family, (plannedCounts.get(family) ?? 0) + 1);
  const duplicated = [...counts].some(([family, n]) => n > Math.max(1, plannedCounts.get(family) ?? 0));
  if (cursor < expected.length || duplicated) {
    errors.push(`${page.filePath}: planned section order ${expected.join(' → ')} must be preserved; rendered ${actual.join(' → ') || 'no body sections'}.`);
  }
  return errors;
}