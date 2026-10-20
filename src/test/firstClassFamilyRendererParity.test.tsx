import React from 'react';
import { normalizeReactIds } from './helpers/normalizeReactIds';
import { transform } from '@babel/standalone';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import * as lucide from 'lucide-react';
import * as framerMotion from 'framer-motion';
import { compositionToReactFileSet } from '@/sections/compositionToFileSet';
import { getCompositionById } from '@/sections/templates';
import { getVariantsForSection } from '@/sections/variants';
import type { SectionEntry, SectionType, ThemeTokens } from '@/sections/types';

afterEach(cleanup);

/**
 * M1 runtime evidence for the seven families closed in Phase 3.
 *
 * Proves the emitted VFS component renders byte-identical markup to the
 * registered variant implementation — i.e. registry implementation ===
 * canonical VFS implementation === preview/published runtime implementation.
 */

const BARE_MODULES: Record<string, unknown> = {
  react: React,
  'lucide-react': lucide,
  'framer-motion': framerMotion,
};

function loadModule(source: string, dependencies: Record<string, unknown> = {}) {
  const module = { exports: {} as Record<string, unknown> };
  const code = transform(source, {
    filename: 'generated.tsx',
    presets: ['typescript', 'react'],
    plugins: ['transform-modules-commonjs'],
  }).code!;
  new Function('require', 'module', 'exports', code)((name: string) => {
    if (name in dependencies) return dependencies[name];
    if (name in BARE_MODULES) return BARE_MODULES[name];
    throw new Error(`Unexpected portable import: ${name}`);
  }, module, module.exports);
  return module.exports;
}

interface FamilyCase {
  sectionType: SectionType;
  component: string;
  props: Record<string, unknown>;
}

const FAMILIES: FamilyCase[] = [
  {
    sectionType: 'about',
    component: 'About',
    props: {
      headline: 'Our studio',
      description: 'Twelve years of colour work in one room.',
      image: 'https://example.com/studio.jpg',
    },
  },
  {
    sectionType: 'faq',
    component: 'FAQ',
    props: {
      headline: 'Questions',
      subheadline: 'The ones we hear most.',
      items: [
        { question: 'Do you take walk-ins?', answer: 'Yes, when a chair is open.' },
        { question: 'How long is a colour?', answer: 'Around three hours.' },
      ],
    },
  },
  {
    sectionType: 'stats',
    component: 'Stats',
    props: {
      headline: 'By the numbers',
      items: [
        { value: '12', label: 'Years open' },
        { value: '8k', label: 'Appointments' },
        { value: '4.9', label: 'Average rating' },
      ],
    },
  },
  {
    sectionType: 'team',
    component: 'Team',
    props: {
      headline: 'The people',
      subheadline: 'Senior stylists only.',
      members: [
        { name: 'Ada Rey', role: 'Creative director', bio: 'Colour specialist.' },
        { name: 'Ines Vo', role: 'Senior stylist', bio: 'Precision cutting.' },
        { name: 'Mika Lund', role: 'Stylist', bio: 'Texture and curls.' },
      ],
    },
  },
  {
    sectionType: 'logo-cloud',
    component: 'LogoCloud',
    props: {
      headline: 'Featured in',
      logos: [
        { name: 'Allure' },
        { name: 'Vogue', src: 'https://example.com/vogue.svg' },
        { name: 'Byrdie' },
      ],
    },
  },
  {
    sectionType: 'blog-preview',
    component: 'BlogPreview',
    props: {
      headline: 'Journal',
      posts: [
        { title: 'Winter colour', excerpt: 'Warmer tones for shorter days.', date: 'Jan 2', author: 'Ada', href: '/journal/winter' },
        { title: 'Curl care', excerpt: 'A simple weekly routine.', date: 'Feb 8', author: 'Mika', href: '/journal/curls' },
        { title: 'Gloss at home', excerpt: 'What actually works.', date: 'Mar 1', author: 'Ines', href: '/journal/gloss' },
      ],
    },
  },
  {
    sectionType: 'before-after',
    component: 'BeforeAfter',
    props: {
      headline: 'Transformations',
      subheadline: 'Real clients, one session.',
      items: [
        { before: 'https://example.com/a-before.jpg', after: 'https://example.com/a-after.jpg', label: 'Balayage' },
        { before: 'https://example.com/b-before.jpg', after: 'https://example.com/b-after.jpg', label: 'Bob' },
      ],
    },
  },
];

const template = getCompositionById('salon-premium')!;

function emitFamily(sectionType: SectionType, variantId: string) {
  const anchor = template.sections[1];
  return compositionToReactFileSet({
    ...template,
    sections: template.sections.map(section => (section === anchor
      ? { ...section, type: sectionType, variantId }
      : section)) as typeof template.sections,
  }, '/src/pages/Home.tsx');
}

describe.each(FAMILIES)('$sectionType emitted renderer parity', ({ sectionType, component, props }) => {
  const variants = getVariantsForSection(sectionType);

  it.each(variants)('renders the registered structure for $id', variant => {
    const files = emitFamily(sectionType, variant.id);
    const themeModule = loadModule(files['/src/components/theme.ts']);
    const theme = themeModule.THEME as ThemeTokens;
    const Emitted = loadModule(files[`/src/components/${component}.tsx`], {
      './theme': themeModule,
      [`./recipes/${component}`]: loadModule(files[`/src/components/recipes/${component}.ts`], {
        './theme': themeModule,
      }),
    }).default as React.ComponentType<{ props: unknown; variantId?: string }>;

    const section = { id: `${sectionType}-proof`, type: sectionType, variantId: variant.id, props } as SectionEntry;
    const registryView = render(<variant.component section={section} theme={theme} />);
    const expectedMarkup = normalizeReactIds(registryView.container.innerHTML);
    registryView.unmount();

    const generatedView = render(<Emitted props={props} variantId={variant.id} />);
    expect(normalizeReactIds(generatedView.container.innerHTML)).toBe(expectedMarkup);
    expect(expectedMarkup.length).toBeGreaterThan(0);
  });
});
