import { describe, it, expect } from 'vitest';
import {
  scopeLaneBBatchFiles,
  findLocalJsxImportContractViolations,
  findUnresolvedLocalImports,
  isLaneAAuthorityPath,
  buildModuleInventoryDirective,
} from '@/services/laneBCompanionModules';

describe('Lane B companion modules', () => {
  it('keeps a companion module authored alongside a requested page', () => {
    const { pages, companions } = scopeLaneBBatchFiles(
      {
        '/src/pages/Gallery.tsx': 'import GalleryItem from "./components/GalleryItem";\nexport default () => <GalleryItem />;',
        'src/pages/components/GalleryItem.tsx': 'export default () => null;',
      },
      ['/src/pages/Gallery.tsx'],
    );

    expect(Object.keys(pages)).toEqual(['/src/pages/Gallery.tsx']);
    expect(companions['/src/pages/components/GalleryItem.tsx']).toContain('export default');
  });

  it('never lets Lane B overwrite Lane A authority files', () => {
    const { pages, companions } = scopeLaneBBatchFiles(
      {
        '/src/pages/Home.tsx': 'export default () => null;',
        '/src/App.tsx': 'export default () => null;',
        '/src/index.css': ':root{}',
        '/src/main.tsx': 'render()',
        '/src/unison/ui/button.tsx': 'export const Button = () => null;',
      },
      ['/src/pages/Home.tsx'],
    );

    expect(Object.keys(pages)).toEqual(['/src/pages/Home.tsx']);
    expect(Object.keys(companions)).toEqual([]);
    expect(isLaneAAuthorityPath('/src/App.tsx')).toBe(true);
    expect(isLaneAAuthorityPath('/src/pages/components/Card.tsx')).toBe(false);
  });

  it('drops unrequested top-level pages instead of treating them as companions', () => {
    const { pages, companions } = scopeLaneBBatchFiles(
      {
        '/src/pages/Home.tsx': 'export default () => <main>home</main>;',
        '/src/pages/About.tsx': 'export default () => <main>stale about</main>;',
        '/src/pages/components/Hero.tsx': 'export default () => <section />;',
      },
      ['/src/pages/Home.tsx'],
    );

    expect(Object.keys(pages)).toEqual(['/src/pages/Home.tsx']);
    expect(companions).toEqual({
      '/src/pages/components/Hero.tsx': 'export default () => <section />;',
    });
  });

  it('detects a page whose companion module is missing', () => {
    const unresolved = findUnresolvedLocalImports({
      '/src/pages/Gallery.tsx': 'import GalleryItem from "./components/GalleryItem";',
    });

    expect(unresolved).toEqual([
      { filePath: '/src/pages/Gallery.tsx', importPath: './components/GalleryItem' },
    ]);
  });

  it('resolves imports through extensions, index files and stylesheets', () => {
    const unresolved = findUnresolvedLocalImports({
      '/src/pages/Gallery.tsx': [
        'import "./gallery.css";',
        'import GalleryItem from "./components/GalleryItem";',
        'import { helpers } from "../lib/helpers";',
        'import { SECTION_MAP } from "./Gallery.sections";',
        'import data from "../data/gallery.json";',
      ].join('\n'),
      '/src/pages/components/GalleryItem.tsx': 'export default () => null;',
      '/src/pages/Gallery.sections.ts': 'export const SECTION_MAP = {};',
      '/src/lib/helpers/index.ts': 'export const helpers = {};',
      '/src/data/gallery.json': '{}',
    });

    expect(unresolved).toEqual([]);
  });

  it('accepts stylesheet asset imports with Vite query suffixes', () => {
    const unresolved = findUnresolvedLocalImports({
      '/src/routes/__root.tsx': 'import appCss from "../styles.css?url"; export default appCss;',
    });

    expect(unresolved).toEqual([]);
  });

  it('rejects incompatible named and default JSX imports without compiling a preview', () => {
    const violations = findLocalJsxImportContractViolations({
      '/src/pages/Home.tsx': [
        "import { MissingHero } from './Hero';",
        "import Card from './Card';",
        'export default function Home() { return <><MissingHero /><Card /></>; }',
      ].join('\n'),
      '/src/pages/Hero.tsx': 'export const RealHero = () => null;',
      '/src/pages/Card.tsx': 'export const Card = () => null;',
    });

    expect(violations).toMatchObject([
      { symbol: 'MissingHero', kind: 'missing-named-export' },
      { symbol: 'Card', kind: 'missing-default-export' },
    ]);
  });

  it('accepts compatible local JSX imports', () => {
    expect(findLocalJsxImportContractViolations({
      '/src/pages/Home.tsx': [
        "import { Hero } from './Hero';",
        "import Card from './Card';",
        'export default function Home() { return <><Hero /><Card /></>; }',
      ].join('\n'),
      '/src/pages/Hero.tsx': 'export const Hero = () => null;',
      '/src/pages/Card.tsx': 'export default function Card() { return null; }',
    })).toEqual([]);
  });
});

describe('module inventory directive', () => {
  it('lists existing modules, states the import contract and keeps styling universal', () => {
    const directive = buildModuleInventoryDirective({
      files: {
        '/src/pages/Home.tsx': 'export default function Home() { return null; }',
        '/src/pages/components/Hero.tsx': 'export const Hero = () => null;',
        '/src/index.css': ':root{}',
      },
      targetPaths: ['/src/pages/About.tsx'],
      aliasImports: ['@/unison/ui/button'],
    });

    expect(directive).toContain('/src/pages/components/Hero.tsx');
    expect(directive).toContain('Hero');
    expect(directive).not.toContain('/src/index.css');
    expect(directive).toContain('@/unison/ui/button');
    expect(directive).toContain('SAME response');
    expect(directive).toMatch(/available for EVERY industry/i);
  });

  it('is industry-neutral: the same modules are offered regardless of industry', () => {
    const files = { '/src/pages/components/Gallery.tsx': 'export const Gallery = () => null;' };
    expect(buildModuleInventoryDirective({ files })).toEqual(
      buildModuleInventoryDirective({ files }),
    );
  });
});
