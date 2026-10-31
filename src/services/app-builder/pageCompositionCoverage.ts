import type { PlannedPage } from '@/services/composition';
import type { AppBuilderPageSectionMaterialization } from './appBuilderSectionModel';
import { normalizePageRole } from '@/services/composition/industryCompositionRegistry';
import { pageArchetypeIssues } from '@/sections/pageArchetypeContract';

/** Check actual rendered source objects, not labels or a model's completion claim. */
export function pageCompositionCoverage(planned: PlannedPage | undefined, page: AppBuilderPageSectionMaterialization): string[] {
  if (!planned) return [`${page.filePath}: canonical composition target missing.`];
  const body = page.inspection.sections.filter(section => section.semanticType !== 'navbar' && section.semanticType !== 'footer');
  const actual = body.map(section => section.semanticType);
  const expected = planned.target.sectionOrder.filter(family => family !== 'navbar' && family !== 'footer');
  const errors = pageArchetypeIssues(normalizePageRole(planned.role), actual);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${page.filePath}: planned section order ${expected.join(' → ')} must be preserved; rendered ${actual.join(' → ') || 'no body sections'}.`);
  }
  return errors;
}