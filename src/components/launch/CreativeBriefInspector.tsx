/**
 * Compact Creative Brief inspector inside the Affinity chat. It shows the
 * design decisions Affinity read from the conversation — the natural-language
 * equivalent of the retired Wizard's art direction, experience, hero and
 * section-layout picks — with where each came from and how it will be built.
 * Read-only: owners change a decision by chatting, never through controls.
 */
import type { ExperienceDirection } from '@/platform/core/universalCreation';
import { describeOrigin, describeResolution, isArtDirectionSealed } from '@/services/launch/experienceDirector';

const EXPERIENCE_LABEL: Record<ExperienceDirection['experience']['value'], string> = {
  standard: 'Calm, restrained motion',
  'motion-rich': 'Rich motion and reveals',
  immersive: 'Immersive 3D layer',
};

function familyLabel(family: string): string {
  return family === 'blog-preview' ? 'News & articles' : family.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function pageLabel(route: string | null, pages: ReadonlyArray<{ route: string; title: string }>): string {
  if (!route) return 'Every page';
  return pages.find((page) => page.route === route)?.title ?? route;
}

export function CreativeBriefInspector({ direction, pages }: {
  direction: ExperienceDirection;
  pages: ReadonlyArray<{ route: string; title: string }>;
}) {
  const sealed = isArtDirectionSealed(direction);
  const rows: Array<{ key: string; label: string; value: string; detail: string; origin: string }> = [
    {
      key: 'art',
      label: 'Look & feel',
      value: sealed ? direction.artDirection.packName : 'Matched to your business when the site is built',
      detail: sealed && direction.artDirection.evidence.length ? `From "${direction.artDirection.evidence.join('", "')}"` : '',
      origin: sealed ? describeOrigin(direction.artDirection.origin) : 'Suggested',
    },
    {
      key: 'experience',
      label: 'Motion',
      value: EXPERIENCE_LABEL[direction.experience.value],
      detail: '',
      origin: describeOrigin(direction.experience.origin),
    },
    ...direction.decisions.map((decision) => ({
      key: decision.id,
      label: `${familyLabel(decision.family)} · ${pageLabel(decision.pageRoute, pages)}`,
      value: `“${decision.value}”`,
      detail: describeResolution(decision),
      origin: describeOrigin(decision.origin),
    })),
  ];
  return (
    <details className="rounded-md border border-border text-sm" data-testid="creative-brief-inspector" open>
      <summary className="cursor-pointer p-3 text-xs font-medium text-muted-foreground">
        Creative brief · {rows.length} design choice{rows.length === 1 ? '' : 's'}
      </summary>
      <ul className="space-y-2 border-t border-border p-3">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="font-medium">{row.value}</p>
              {row.detail && <p className="text-xs text-muted-foreground">{row.detail}</p>}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{row.origin}</span>
          </li>
        ))}
      </ul>
      {direction.locked.length > 0 && (
        <p className="border-t border-border p-3 text-xs text-muted-foreground">Everything you asked to keep stays as it is.</p>
      )}
      <p className="border-t border-border p-3 text-xs text-muted-foreground">
        To change a choice, tell Affinity — for example “make the hero more cinematic” or “use a masonry gallery on the work page”.
      </p>
    </details>
  );
}
