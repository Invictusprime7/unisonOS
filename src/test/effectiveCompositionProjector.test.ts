import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectEffectiveComposition } from '@/services/effectiveCompositionProjector';
import { buildFileProvenance } from '@/services/fileProvenance';

describe('effective composition projection', () => {
  it('projects static sections and media while marking dynamic identities uncertain', async () => {
    const source = [
      'export default function Home({ sectionId, heroUrl }) {',
      '  return <main>',
      '    <section data-ut-section-id="hero" data-ut-section-type="hero">',
      '      <img src="/hero.jpg" alt="Hero image" />',
      '    </section>',
      '    <section data-ut-section-id={sectionId}><img src={heroUrl} /></section>',
      '  </main>;',
      '}',
    ].join('\n');
    const hashSource = async (path: string, content: string) => `${path}:${content.length}`;

    const projection = await projectEffectiveComposition({
      pages: { home: { filePath: '/src/pages/Home.tsx' } },
      files: { '/src/pages/Home.tsx': source },
      baseRevisionId: 'base-revision',
      vfsHash: 'accepted-vfs-hash',
      hashSource,
    });

    expect(projection).toMatchObject({
      schemaVersion: '1.0',
      baseRevisionId: 'base-revision',
      vfsHash: 'accepted-vfs-hash',
      pages: {
        home: {
          sourcePath: '/src/pages/Home.tsx',
          sections: [{ sectionId: 'hero', semanticType: 'hero', parentSectionId: null }],
          mediaUses: [{ tag: 'img', src: '/hero.jpg', alt: 'Hero image', sectionId: 'hero' }],
        },
      },
    });
    expect(projection.pages.home.uncertain).toEqual(expect.arrayContaining([
      expect.stringMatching(/^section-identity-not-static@/),
      expect.stringMatching(/^dynamic-media-source@/),
    ]));
  });

  it('stamps the exact revision id in the canonical insert trigger without changing VFS bytes', () => {
    const migration = readFileSync(resolve(
      process.cwd(),
      'supabase/migrations/20261026001823_stamp_effective_composition_revision.sql',
    ), 'utf8');

    expect(migration).toContain('BEFORE INSERT ON public.site_revisions');
    expect(migration).toContain("v_projection->>'vfsHash' IS DISTINCT FROM NEW.vfs_hash");
    expect(migration).toContain("v_projection->>'baseRevisionId' IS DISTINCT FROM NEW.parent_revision_id::text");
    expect(migration).toContain("'{revisionId}', to_jsonb(NEW.id::text)");
    expect(migration).not.toContain('NEW.vfs_files :=');
  });

  it('projects canonical bindings and import owners without guessing local component authorship', async () => {
    const source = [
      "import { Hero } from '@/sections/Hero';",
      "import Button from 'lucide-react';",
      "import Card from './Card';",
      "import OtherCard from './OtherCard';",
      "import UnverifiedCard from './UnverifiedCard';",
      "import UserCard from './UserCard';",
      'export default function Home(){return <main><Hero/><Button/><Card/><OtherCard/><UnverifiedCard/><UserCard/></main>}',
    ].join('\n');
    const files = {
      '/src/pages/Home.tsx': source,
      '/src/pages/Card.tsx': 'export default function Card(){return <article/>}',
      '/src/pages/OtherCard.tsx': 'export default function OtherCard(){return <article/>}',
      '/src/pages/UnverifiedCard.tsx': 'export default function UnverifiedCard(){return <article/>}',
      '/src/pages/UserCard.tsx': 'export default function UserCard(){return <article/>}',
      '/src/sections/Hero.tsx': 'export function Hero(){return <section/>}',
    };
    const fileProvenance = await buildFileProvenance({
      previousFiles: {},
      files,
      source: 'wizard-launch',
      operationIds: ['test-projection'],
      compilerOwnedPaths: ['/src/sections/**'],
    });
    Object.assign(fileProvenance['/src/pages/Card.tsx'], {
      ownership: 'ai', creatorOrigin: 'ai-builder', lastEditorOrigin: 'ai-builder',
    });
    Object.assign(fileProvenance['/src/pages/OtherCard.tsx'], {
      ownership: 'ai', creatorOrigin: 'wizard-launch', lastEditorOrigin: 'wizard-launch',
    });
    Object.assign(fileProvenance['/src/pages/UserCard.tsx'], {
      ownership: 'user', creatorOrigin: 'playground-edit', lastEditorOrigin: 'preview-toolbar',
    });

    const projection = await projectEffectiveComposition({
      pages: { home: { filePath: '/src/pages/Home.tsx' } },
      files,
      fileProvenance: Object.fromEntries(Object.entries(fileProvenance).filter(([path]) => path !== '/src/pages/UnverifiedCard.tsx')),
      bindings: {
        primaryCta: {
          bindingId: 'booking-binding',
          sourcePageId: 'home',
          elementKey: 'home.hero.primary-cta',
          sourceSection: 'hero',
          sourceSlot: 'primary-cta',
          intent: 'booking.open',
          coreIntent: 'booking.request',
          targetId: 'calendar-main',
          targetType: 'calendar',
          source: 'wizard',
          isValid: true,
        },
      },
      baseRevisionId: null,
      vfsHash: 'vfs-hash',
      hashSource: async (_path, contents) => String(contents.length),
    });

    expect(projection.pages.home.imports).toEqual(expect.arrayContaining([
      expect.objectContaining({ specifier: '@/sections/Hero', resolvedPath: '/src/sections/Hero.tsx', owner: 'compiler-generated' }),
      expect.objectContaining({ specifier: 'lucide-react', owner: 'imported' }),
      expect.objectContaining({
        importerPath: '/src/pages/Home.tsx',
        specifier: './Card',
        resolvedPath: '/src/pages/Card.tsx',
        sourceDirectory: '/src/pages',
        owner: 'ai-authored',
      }),
      expect.objectContaining({ specifier: './OtherCard', resolvedPath: '/src/pages/OtherCard.tsx', owner: 'wizard-generated' }),
      expect.objectContaining({ specifier: './UnverifiedCard', resolvedPath: '/src/pages/UnverifiedCard.tsx', owner: 'unverified' }),
      expect.objectContaining({ specifier: './UserCard', resolvedPath: '/src/pages/UserCard.tsx', owner: 'user-authored' }),
    ]));
    expect(projection.pages.home.componentUses).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Hero', origin: 'compiler-generated' }),
      expect.objectContaining({ name: 'Button', origin: 'imported' }),
      expect.objectContaining({ name: 'Card', origin: 'ai-authored' }),
      expect.objectContaining({ name: 'OtherCard', origin: 'wizard-generated' }),
      expect.objectContaining({ name: 'UnverifiedCard', origin: 'unverified', sourceDirectory: '/src/pages' }),
      expect.objectContaining({ name: 'UserCard', origin: 'user-authored' }),
    ]));
    expect(projection.pages.home.bindings).toEqual([expect.objectContaining({
      bindingId: 'booking-binding',
      elementKey: 'home.hero.primary-cta',
      intent: 'booking.request',
      targetId: 'calendar-main',
      valid: true,
    })]);
    expect(projection.pages.home.uncertain).toContain('import-owner-unverified:./UnverifiedCard');
  });

  it('reports exact registry membership independently from authored source origin', async () => {
    const source = [
      'export default function Home({ activeVariant }) {',
      '  return <main>',
      '    <section data-ut-section-id="hero" data-ut-section-type="hero" data-ut-variant="hero:not-real" />',
      '    <section data-ut-section-type="pricing" data-ut-variant="hero:split-image" />',
      '    <section data-ut-section-type="hero" data-ut-variant={activeVariant} />',
      '    <div data-ut-component-slug="booking-scheduler" />',
      '    <div data-ut-component-slug="made-up-component" />',
      '  </main>;',
      '}',
    ].join('\n');
    const projection = await projectEffectiveComposition({
      pages: { home: { filePath: '/src/pages/Home.tsx' } },
      files: { '/src/pages/Home.tsx': source },
      baseRevisionId: null,
      vfsHash: 'vfs-hash',
      hashSource: async (_path, contents) => String(contents.length),
    });

    expect(projection.pages.home.registryEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ registry: 'section-type', id: 'hero', status: 'registered' }),
      expect.objectContaining({ registry: 'design-implementation', id: 'hero:not-real', status: 'unregistered' }),
      expect.objectContaining({ registry: 'design-implementation', id: 'hero:split-image', status: 'unregistered', reason: 'variant-family-mismatch:hero' }),
      expect.objectContaining({ registry: 'design-implementation', id: null, status: 'unverified', reason: 'variant-id-is-dynamic' }),
      expect.objectContaining({ registry: 'canonical-component', id: 'booking-scheduler', status: 'registered' }),
      expect.objectContaining({ registry: 'canonical-component', id: 'made-up-component', status: 'unregistered' }),
    ]));
  });

  it('does not trust an authorship ledger whose content hash disagrees with the VFS source', async () => {
    const pagePath = '/src/pages/Home.tsx';
    const componentPath = '/src/pages/Card.tsx';
    const files = {
      [pagePath]: "import Card from './Card'; export default function Home(){return <Card/>}",
      [componentPath]: 'export default function Card(){return <article/>}',
    };
    const projection = await projectEffectiveComposition({
      pages: { home: { filePath: pagePath } },
      files,
      fileProvenance: {
        [componentPath]: {
          version: '1.0',
          path: componentPath,
          creatorOrigin: 'ai-builder',
          lastEditorOrigin: 'ai-builder',
          ownership: 'ai',
          priorHash: null,
          currentHash: 'sha256:not-the-current-content',
          candidateId: null,
          lastOperationIds: [],
          authoredRevisionId: 'revision-1',
          deleted: false,
        },
      },
      baseRevisionId: 'revision-1',
      vfsHash: 'vfs-hash',
      hashSource: async (_path, contents) => String(contents.length),
    });

    expect(projection.pages.home.componentUses).toEqual([
      expect.objectContaining({ name: 'Card', origin: 'unverified', sourcePath: componentPath }),
    ]);
    expect(projection.pages.home.uncertain).toContain(`provenance-hash-mismatch:${componentPath}`);
  });
});