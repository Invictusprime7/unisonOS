import { describe, expect, it } from 'vitest';
import { checkEditAgainstIntent, classifyEditOperation, classifyEditOperations, normalizeEditIntent } from '@/services/editor/editIntentContract';

const home = '/src/pages/Home.tsx';
const prev = { [home]: '<button data-ut-intent="booking.create">Book</button>', '/src/pages/About.tsx': '<p>About</p>' };
const scope = { scopeType: 'section', targetId: 'hero', componentPath: home, lockedBindings: ['booking.create'] } as never;

describe('edit intent contract', () => {
  it('classifies operations', () => {
    expect(classifyEditOperation('make the headline bigger')).toBe('style');
    expect(classifyEditOperation('add a testimonials strip')).toBe('insert');
    expect(classifyEditOperation('redesign the layout of this section')).toBe('restructure');
    expect(classifyEditOperation('reword the title')).toBe('text');
    expect(classifyEditOperations('redesign the hero and replace its photo')).toEqual(['restructure', 'replace']);
    expect(classifyEditOperations("don't replace the photo, just update the headline")).toEqual(['text']);
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

describe('editIntentForRequest', () => {
  const base = { activePagePath: home, pageImports: ['/src/components/Nav.tsx'], expectedRevisionId: 'r1' };
  it('keeps a plain request on the current page and its imports', () => {
    const contract = __mk({ ...base, prompt: 'make the headline bigger' });
    expect(contract.consent).toEqual({ crossPage: false, backend: false });
    expect(contract.allowedPaths).toEqual(expect.arrayContaining([home, '/src/components/Nav.tsx', '/src/App.tsx']));
    expect(checkEditAgainstIntent(contract, { baseRevisionId: 'r1', previousFiles: prev, files: { '/src/pages/About.tsx': '<p/>' } })[0]?.code).toBe('cross-page-consent');
  });
  it('treats naming another page, a new page, or business data as consent', () => {
    expect(__mk({ ...base, prompt: 'also update the about page' }).consent.crossPage).toBe(true);
    expect(__mk({ ...base, prompt: 'x', structural: true }).consent.crossPage).toBe(true);
    expect(__mk({ ...base, prompt: 'connect the form to the booking system' }).consent.backend).toBe(true);
  });
  it('does not interpret negated page or backend mentions as consent', () => {
    expect(__mk({ ...base, prompt: "don't update the about page" }).consent.crossPage).toBe(false);
    expect(__mk({ ...base, prompt: 'redesign every page' }).consent.crossPage).toBe(true);
    expect(__mk({ ...base, prompt: "don't change the booking backend" }).consent.backend).toBe(false);
    expect(__mk({ ...base, prompt: 'redesign the page but connect its form to booking' }).consent.backend).toBe(true);
  });
  it('prefers validated structured scope and operations, and blocks unresolved ambiguity', () => {
    const interpretation = {
      scope: { level: 'site', targets: [], relation: 'site_wide' },
      editorOperations: ['style.update', 'asset.replace'],
      requestKinds: ['edit'],
      ambiguities: [],
    } as never;
    const contract = __mk({ ...base, prompt: 'change the hero', interpretation });
    expect(contract).toMatchObject({ editScope: 'site', operations: ['style', 'replace'], consent: { crossPage: true } });
    const ambiguous = normalizeEditIntent({ prompt: 'change it', interpretation: { ...interpretation, ambiguities: ['Which page should change?'] } as never });
    expect(checkEditAgainstIntent(ambiguous, { baseRevisionId: 'r1', previousFiles: prev, files: { [home]: '<main/>' } })[0])
      .toEqual({ code: 'ambiguous-intent', ambiguities: ['Which page should change?'] });
  });
});
import { editIntentForRequest as __mk } from '@/services/editor/editIntentContract';
