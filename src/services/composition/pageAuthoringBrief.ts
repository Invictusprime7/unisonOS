import type { PlannedPage, RedundancyIssue, SiteVisualMemoryEntry } from './types';

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Renders the page's composition responsibility for the AI Composer brief. */
export function renderCompositionBrief(
  planned: PlannedPage | undefined,
  memory: readonly SiteVisualMemoryEntry[],
  redundancy?: RedundancyIssue | null,
): string {
  if (!planned) return '';
  const { profile, target } = planned;
  const c = profile.compositionCharacter;
  const lines = [
    `PAGE RESPONSIBILITY (${profile.industryId === '*' ? 'generic' : profile.industryId} · ${profile.pageRole}): ${profile.narrativeGoals.join('; ')}.`,
    profile.primaryIntent ? `PRIMARY INTENT: ${profile.primaryIntent}` : '',
    profile.domainVocabulary?.length ? `DOMAIN VOCABULARY: ${profile.domainVocabulary.join(', ')}` : '',
      `COMPOSITION STARTING POINT (${planned.compositionKey}; guidance, not a fixed sequence): hero=${target.hero}; geometry=${target.geometry}; density=${target.density}; suggested families: ${target.sectionOrder.join(' → ')}. Reorder or replace optional sections and author a stronger page-specific composition when it serves the page job; satisfy the page archetype's required and forbidden families.`,
    `CHARACTER: media ${pct(c.mediaDominance)}, typography ${pct(c.typographyDominance)}, editorial ${pct(c.editoriality)}, information ${pct(c.informationDensity)}, conversion ${pct(c.conversionPressure)}.`,
    `PREFER: ${profile.preferredCompositionPatterns.join('; ')}. AVOID: ${profile.discouragedCompositionPatterns.join('; ')}.`,
    `NOVELTY GUIDANCE (not a limit): ${pct(profile.noveltyBudget)} variation signal; original layouts remain allowed within the sealed art direction and page archetype.`,
  ];
  if (memory.length) {
    lines.push(`ALREADY USED ON OTHER PAGES (do not repeat this topology): ${memory
      .map((m) => `${m.role}[hero ${m.signature.hero}, ${m.signature.sectionOrder.join('→') || 'n/a'}]`).join('; ')}`);
  }
  const usedVariants = [...new Set(memory.flatMap((m) => m.signature.variants ?? []))];
  if (usedVariants.length) {
    lines.push(`VARIANTS ALREADY USED ON OTHER PAGES: ${usedVariants.join(', ')}. For each family, pick a different listed variant when one fits this page's target; reuse only when it is the sole eligible design.`);
  }
  if (redundancy) lines.push(`REDUNDANCY REPAIR: ${redundancy.reason} Recompose with a different hero and section order that fits this page's job.`);
  return lines.filter(Boolean).join('\n');
}
