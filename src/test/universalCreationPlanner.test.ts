import { describe, expect, it } from 'vitest';
import { applyUniversalCreationProposal } from '@/services/launch/universalCreationPlanner';
import type { UniversalCreationInput } from '@/platform/core/universalCreation';

const input: UniversalCreationInput = {
  mode: 'open-ended',
  originalPrompt: 'A publication with a journal and story pages',
  sitePurpose: 'Editorial publication',
  subject: 'Independent journalism',
  pages: [{ route: '/', title: 'Home', purpose: 'Introduce the publication', suggestedRole: 'home' }],
  visualRequirements: [],
  requestedCapabilities: [],
};

describe('Universal Creation structured planner', () => {
  it('accepts and seals a multi-page custom topology', () => {
    const planned = applyUniversalCreationProposal(input, {
      pages: [
        { route: '/journal', title: 'Journal', purpose: 'Browse reported articles', suggestedRole: 'blog' },
        { route: '/research', title: 'Research', purpose: 'Explore long-form investigations', suggestedRole: 'custom' },
        { route: '/stories/:slug', title: 'Story', purpose: 'Read one published story', suggestedRole: 'custom' },
      ],
      requestedCapabilities: ['content-management'],
    });

    expect(planned.pages.map((page) => page.route)).toEqual(['/', '/journal', '/research', '/stories/:slug']);
    expect(planned.requestedCapabilities).toContain('content-management');
  });

  it('rejects custom route-pattern collisions before launch', () => {
    expect(() => applyUniversalCreationProposal({
      ...input,
      pages: [
        ...input.pages,
        { route: '/stories/:slug', title: 'Story', purpose: 'Read one story', suggestedRole: 'custom' },
      ],
    }, {
      pages: [{ route: '/stories/:id', title: 'Another story', purpose: 'Read another story', suggestedRole: 'custom' }],
      requestedCapabilities: [],
    })).toThrow(/resolve to the same router pattern/);
  });

  it('preserves the Wizard page when the proposal repeats its exact route', () => {
    const planned = applyUniversalCreationProposal({
      ...input,
      pages: [...input.pages, { route: '/journal', title: 'Journal', purpose: 'Browse articles', suggestedRole: 'blog' }],
    }, {
      pages: [{ route: '/journal', title: 'Stories', purpose: 'A different journal route', suggestedRole: 'custom' }],
      requestedCapabilities: [],
    });
    expect(planned.pages.filter((page) => page.route === '/journal')).toHaveLength(1);
    expect(planned.pages.find((page) => page.route === '/journal')).toMatchObject({ title: 'Journal', suggestedRole: 'blog' });
  });
});