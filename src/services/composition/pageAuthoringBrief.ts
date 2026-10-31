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
    `COMPOSITION TARGET (${planned.compositionKey}): hero=${target.hero}; geometry=${target.geometry}; density=${target.density}; required complete sections in order: ${target.sectionOrder.join(' → ')}.`,
    `CHARACTER: media ${pct(c.mediaDominance)}, typography ${pct(c.typographyDominance)}, editorial ${pct(c.editoriality)}, information ${pct(c.informationDensity)}, conversion ${pct(c.conversionPressure)}.`,
    `PREFER: ${profile.preferredCompositionPatterns.join('; ')}. AVOID: ${profile.discouragedCompositionPatterns.join('; ')}.`,
    `NOVELTY BUDGET: ${pct(profile.noveltyBudget)} — invent local composition only within the sealed art direction.`,
  ];
  if (memory.length) {
    lines.push(`ALREADY USED ON OTHER PAGES (do not repeat this topology): ${memory
      .map((m) => `${m.role}[hero ${m.signature.hero}, ${m.signature.sectionOrder.join('→') || 'n/a'}]`).join('; ')}`);
  }
  if (redundancy) lines.push(`REDUNDANCY REPAIR: ${redundancy.reason} Recompose with a different hero and section order that fits this page's job.`);
  return lines.filter(Boolean).join('\n');
}
