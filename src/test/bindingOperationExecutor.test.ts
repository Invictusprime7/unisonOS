import { describe, expect, it } from 'vitest';
import { applyBindingOperations, stripUnboundBindingAttributes } from '@/services/bindingOperationExecutor';
import type { PlaygroundState } from '@/platform/core/playground';

const binding = {
  bindingId: 'bind-hero-book',
  sourcePageId: 'home',
  sourceLabel: 'Book now',
  intent: 'calendar.open' as const,
  targetId: 'main-booking',
  targetType: 'calendar' as const,
  confidence: 1,
  source: 'wizard' as const,
  isValid: true,
  elementKey: 'home.hero.primary-cta',
  sourceSection: 'hero' as const,
  sourceSlot: 'primary-cta' as const,
  coreIntent: 'booking.create',
  uiAction: 'overlay' as const,
};

const playground = (): PlaygroundState => ({
  creatorData: {} as PlaygroundState['creatorData'],
  pageRegistry: { pages: {} } as PlaygroundState['pageRegistry'],
  bindings: { [binding.bindingId]: { ...binding } },
  calendars: {},
  popups: {},
});

describe('canonical binding operations', () => {
  it('updates the canonical binding by stable preview binding identity', () => {
    const result = applyBindingOperations(playground(), [{
      type: 'bindIntent', elementId: 'bind-hero-book', intent: 'booking.start', payload: { campaign: 'fall' },
    }]);

    expect(result.playground.bindings['bind-hero-book']).toMatchObject({
      coreIntent: 'booking.create', source: 'ai', payloadTemplate: { campaign: 'fall' },
    });
    expect(result.boundBindingIds).toEqual(['bind-hero-book']);
  });

  it('rejects an ambiguous legacy slot identifier', () => {
    const state = playground();
    state.bindings['bind-pricing-book'] = { ...binding, bindingId: 'bind-pricing-book', sourcePageId: 'pricing' };
    expect(() => applyBindingOperations(state, [{
      type: 'bindIntent', elementId: 'primary-cta', intent: 'booking.create',
    }])).toThrow('ambiguous');
  });

  it('rejects an intent whose runtime target cannot fulfill it', () => {
    expect(() => applyBindingOperations(playground(), [{
      type: 'bindIntent', elementId: 'bind-hero-book', intent: 'quote.request',
    }])).toThrow('incompatible');
  });

  it('can preserve a canonical search intent while migrating a legacy navigation binding', () => {
    const state = playground();
    state.bindings['bind-search'] = {
      ...binding,
      bindingId: 'bind-search',
      sourceSlot: 'icon-search',
      intent: 'nav.goto_page',
      targetType: 'popup',
      targetId: 'search-panel',
      coreIntent: 'search.open',
    };

    const result = applyBindingOperations(state, [{
      type: 'bindIntent', elementId: 'bind-search', intent: 'search.open',
    }]);

    expect(result.playground.bindings['bind-search']).toMatchObject({
      intent: 'nav.goto_page', coreIntent: 'search.open', targetId: 'search-panel',
    });
  });

  it('removes only the old binding attributes for an unbound control', () => {
    const result = applyBindingOperations(playground(), [{ type: 'unbindIntent', elementId: 'bind-hero-book' }]);
    const files = stripUnboundBindingAttributes({
      '/src/pages/Home.tsx': '<button data-ut-binding-id="bind-hero-book" data-ut-intent="booking.create" data-ut-slot="primary-cta">Book</button>',
    }, result.unboundBindings);
    expect(result.playground.bindings).toEqual({});
    expect(files['/src/pages/Home.tsx']).not.toContain('data-ut-intent');
    expect(files['/src/pages/Home.tsx']).not.toContain('data-ut-binding-id');
  });
});
