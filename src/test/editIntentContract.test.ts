import { describe, expect, it } from 'vitest';
import { checkEditAgainstIntent, classifyEditOperation, normalizeEditIntent } from '@/services/editor/editIntentContract';

const home = '/src/pages/Home.tsx';
const prev = { [home]: '<button data-ut-intent="booking.create">Book</button>', '/src/pages/About.tsx': '<p>About</p>' };
const scope = { scopeType: 'section', targetId: 'hero', componentPath: home, lockedBindings: ['booking.create'] } as never;

describe('edit intent contract', () => {
  it('classifies operations', () => {
    expect(classifyEditOperation('make the headline bigger')).toBe('style');
    expect(classifyEditOperation('add a testimonials strip')).toBe('insert');
    expect(classifyEditOperation('redesign the layout of this section')).toBe('restructure');
    expect(classifyEditOperation('reword the title')).toBe('text');
  });
  it('scopes to the selection, or to the site when asked', () => {
    const c = normalizeEditIntent({ prompt: 'add a quote', scope, pagePath: home, expectedRevisionId: 'r1' });
    expect(c).toMatchObject({ editScope: 'section', allowedPaths: [home], requiredBindings: ['booking.create'], expectedRevisionId: 'r1' });
    expect(normalizeEditIntent({ prompt: 'use serif fonts on every page' }).editScope).toBe('site');
  });
  it('accepts a scoped edit with a new custom component and declared package', () => {
    const c = normalizeEditIntent({ prompt: 'add a gallery', scope, pagePath: home, expectedRevisionId: 'r1' });
    expect(checkEditAgainstIntent(c, {
      baseRevisionId: 'r1',
      previousFiles: prev,
      files: { [home]: '<button data-ut-intent="booking.create">Book</button><Gallery/>', '/src/components/Gallery.tsx': "import { motion } from 'framer-motion';" },
      declaredPackages: ['framer-motion'],
    })).toEqual([]);
  });
  it('rejects stale base, other pages without consent, backend without consent, removed bindings and undeclared packages', () => {
    const c = normalizeEditIntent({ prompt: 'x', scope, pagePath: home, expectedRevisionId: 'r1' });
    const codes = checkEditAgainstIntent(c, {
      baseRevisionId: 'r0',
      previousFiles: prev,
      files: { [home]: "import x from 'left-pad';<p/>", '/src/pages/About.tsx': '<p/>', '/supabase/functions/a/index.ts': '' },
    }).map((v) => v.code);
    expect(codes).toEqual(['stale-revision', 'backend-consent', 'cross-page-consent', 'binding-removed', 'undeclared-package']);
  });
  it('allows other pages once consent is given', () => {
    const c = normalizeEditIntent({ prompt: 'x', scope, pagePath: home, consent: { crossPage: true } });
    expect(checkEditAgainstIntent(c, { baseRevisionId: null, previousFiles: prev, files: { '/src/pages/About.tsx': '<p/>' } })).toEqual([]);
  });
});
