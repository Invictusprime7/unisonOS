/**
 * What the AI activity feed may claim. Saved only after a commit event in this
 * run; the preview only counts once the save happened.
 */
export type ActivityPreview = 'idle' | 'waiting' | 'updated' | 'failed';

export function describeRunOutcome(input: { active: boolean; saved: boolean; preview: ActivityPreview }): string | null {
  if (input.active) return null;
  if (!input.saved) return 'Stopped before saving · nothing changed';
  if (input.preview === 'updated') return 'Saved · shown in preview';
  if (input.preview === 'failed') return 'Saved · preview could not show it';
  return 'Saved · preview not confirmed';
}
