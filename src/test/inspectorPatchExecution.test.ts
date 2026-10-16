import { describe, expect, it } from 'vitest';
import { planInspectorExecution } from '@/services/builder/inspectorPatchExecution';
import {
  buildInspectorPatchPlan,
  resolveInspectorCanonicalSections,
  resolveInspectorModel,
  type InspectorPatchPlan,
} from '@/services/builder/propertyInspectorModel';

const PAGE = `export default function Home() {
  return (
    <section data-ut-section-id="hero-1">
      <h1 data-ut-slot="hero.headline">Old headline</h1>
      <img data-ut-slot="hero.media" src="/old.jpg" alt="old" />
      <a data-ut-slot="hero.primary-cta" data-ut-intent="nav.goto">Book</a>
      <p data-ut-slot="hero.dynamic">{copy.subtitle}</p>
    </section>
  );
}`;

const files = { '/src/pages/Home.tsx': PAGE };

function plan(op: Extract<InspectorPatchPlan, { ok: true }>['op']): Extract<InspectorPatchPlan, { ok: true }> {
  return { ok: true, op, description: 'test change', pagePath: '/' };
}

describe('inspector patch execution', () => {
  it('routes a confirmed legacy-preview variant through the canonical presentation executor', () => {
    const canonicalSections = resolveInspectorCanonicalSections(undefined, {
      'home-hero': 'hero:launch-showcase',
    });
    const model = resolveInspectorModel({
      attributes: { 'data-ut-variant': 'hero:launch-showcase' },
      scopeAncestors: { sectionType: 'hero', pagePath: '/src/pages/Home.tsx' },
      canonicalSections,
    });
    const patchPlan = buildInspectorPatchPlan(model, { kind: 'variant', variantId: 'hero:image-fan' as never });
    expect(patchPlan.ok).toBe(true);
    if (patchPlan.ok === false) return;

    expect(planInspectorExecution(patchPlan, { files })).toMatchObject({
      kind: 'presentation',
      ops: [{ type: 'setVariant', sectionId: 'home-hero', variantId: 'hero:image-fan' }],
    });
  });

  it('routes a variant change to a snapshot presentation op', () => {
    const result = planInspectorExecution(
      plan({ type: 'set-variant', sectionId: 'hero-1', selector: '', variantId: 'hero:centered' as never }),
      { files },
    );
    expect(result).toMatchObject({ kind: 'presentation', ops: [{ type: 'setVariant', sectionId: 'hero-1' }] });
  });

  it('routes a theme token change to the theme lane', () => {
    const result = planInspectorExecution(
      plan({ type: 'set-theme-token', sectionId: null, selector: '', token: '--primary', value: '210 90% 50%' }),
      { files, snapshotId: 'snap-1', revisionId: 'rev-1' },
    );
    expect(result.kind).toBe('theme');
  });

  it('rejects a theme token change with no saved snapshot', () => {
    const result = planInspectorExecution(
      plan({ type: 'set-theme-token', sectionId: null, selector: '', token: '--primary', value: '210 90% 50%' }),
      { files },
    );
    expect(result.kind).toBe('rejected');
  });

  it('rewrites literal slot text in place', () => {
    const result = planInspectorExecution(
      plan({ type: 'set-slot-text', sectionId: 'hero-1', selector: '', slotId: 'hero.headline', value: 'New headline' }),
      { files },
    );
    expect(result.kind).toBe('source');
    if (result.kind !== 'source') return;
    const next = result.fileOps[0].type !== 'delete' ? result.fileOps[0].contents : '';
    expect(next).toContain('>New headline<');
    expect(next).toContain('data-ut-slot="hero.media"');
  });

  it('does not edit a matching slot from a different section', () => {
    const result = planInspectorExecution(
      plan({ type: 'set-slot-text', sectionId: 'missing-section', selector: '', slotId: 'hero.headline', value: 'Wrong page' }),
      { files: {
        ...files,
        '/src/pages/Other.tsx': '<section data-ut-section-id="other-section"><h1 data-ut-slot="hero.headline">Other page</h1></section>',
      } },
    );
    expect(result).toMatchObject({
      kind: 'rejected',
      reason: 'Slot "hero.headline" could not be uniquely matched to the selected section in the page source. Refresh the preview and reselect the text.',
    });
  });

  it('routes composition-owned copy without requiring a source JSX slot', () => {
    const result = planInspectorExecution(
      plan({ type: 'set-slot-text', sectionId: null, sectionType: 'hero' as never, selector: '', slotId: 'hero.headline', value: 'New headline' }),
      { files: {}, pageRole: 'home', composedSections: ['hero'] },
    );
    expect(result).toMatchObject({
      kind: 'presentation',
      ops: [{ type: 'setSectionCopy', pageRole: 'home', sectionType: 'hero', copy: { headline: 'New headline' } }],
    });
  });

  it('refuses to rewrite text rendered from data', () => {
    const result = planInspectorExecution(
      plan({ type: 'set-slot-text', sectionId: 'hero-1', selector: '', slotId: 'hero.dynamic', value: 'Nope' }),
      { files },
    );
    expect(result.kind).toBe('rejected');
  });

  it('swaps a slot image source and alt text', () => {
    const result = planInspectorExecution(
      plan({ type: 'set-slot-asset', sectionId: 'hero-1', selector: '', slotId: 'hero.media', value: '/new.jpg', alt: 'new' }),
      { files },
    );
    expect(result.kind).toBe('source');
    if (result.kind !== 'source') return;
    const next = result.fileOps[0].type !== 'delete' ? result.fileOps[0].contents : '';
    expect(next).toContain('src="/new.jpg"');
    expect(next).toContain('alt="new"');
  });

  it('routes an intent change through its canonical binding', () => {
    const result = planInspectorExecution(
      plan({ type: 'set-intent', sectionId: 'hero-1', selector: '', slotId: 'hero.primary-cta', intent: 'booking.start' }),
      { files, bindings: {
        'bind-hero': {
          bindingId: 'bind-hero', sourcePageId: 'home', sourceLabel: 'Book',
          sourceSlot: 'hero.primary-cta' as any, intent: 'calendar.open', targetId: 'calendar', targetType: 'calendar',
          confidence: 1, source: 'wizard', isValid: true,
        },
      } },
    );
    expect(result).toMatchObject({
      kind: 'binding',
      bindingOps: [{ type: 'bindIntent', elementId: 'bind-hero', intent: 'booking.start' }],
    });
  });

  it('rejects an unknown slot instead of guessing', () => {
    const result = planInspectorExecution(
      plan({ type: 'set-intent', sectionId: 'hero-1', selector: '', slotId: 'ghost.slot', intent: 'booking.start' }),
      { files },
    );
    expect(result.kind).toBe('rejected');
  });
});
