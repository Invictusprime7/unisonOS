import { describe, expect, it } from 'vitest';
import { applyVendorResult, libraryBriefBlock, lowPriorityTokens, requestedLibraryNames, vendorLibrarySections } from '@/services/source-authoring/unisonLibrary';

const PKG = JSON.stringify({ dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' } });

describe('Unison library as an optional building block', () => {
  it('copies nothing when the project does not import the library', async () => {
    const result = await vendorLibrarySections({ '/src/pages/Home.tsx': 'export default function Home() { return <h1>Hi</h1>; }' });
    expect(result.writes).toEqual({});
  });

  it('copies an imported section, its dependencies and an adapter into src/unison-ui', async () => {
    const files = { '/package.json': PKG, '/src/pages/Home.tsx': "import { HeroSplitImage, FAQAccordion, NavbarStandard } from '../unison-ui';\nexport default () => <HeroSplitImage headline=\"Hi\" />;" };
    const result = await vendorLibrarySections(files);
    expect(Object.keys(result.writes)).toEqual(expect.arrayContaining([
      '/src/unison-ui/components/hero/HeroSplitImage.tsx',
      '/src/unison-ui/components/faq/FAQAccordion.tsx',
      '/src/unison-ui/index.tsx',
      '/src/unison-ui/theme.ts',
      '/src/unison-ui/tokens.css',
    ]));
    expect(result.writes['/src/unison-ui/index.tsx']).toContain('export function HeroSplitImage(');
    const next = applyVendorResult(files, result);
    expect(next['/src/pages/Home.tsx']).toBe(files['/src/pages/Home.tsx']);
    expect(JSON.parse(next['/package.json']).dependencies['lucide-react']).toBe('^0.462.0');
  });

  it('does not re-copy when the same sections are already in the project', async () => {
    const files = { '/src/pages/Home.tsx': "import { HeroSplitImage } from '../unison-ui';" };
    const first = applyVendorResult(files, await vendorLibrarySections(files));
    expect((await vendorLibrarySections(first)).writes).toEqual({});
  });

  it('keeps library colour defaults below the site\'s own values', () => {
    const css = lowPriorityTokens(':root {\n  --primary: 7 72% 51%;\n}\n[data-theme="dark"] {\n  --primary: 7 78% 61%;\n}\n');
    expect(css).toMatch(/^:where\(:root\) \{/m);
    expect(css).toMatch(/^:where\(\[data-theme="dark"\]\) \{/m);
    expect(css).not.toMatch(/^:root\s*\{/m);
  });

  it('reports names the library does not provide', async () => {
    const result = await vendorLibrarySections({ '/src/App.tsx': "import { MadeUpHero } from './unison-ui';" });
    expect(result.unknown).toEqual(['MadeUpHero']);
  });

  it('ignores imports of other folders that merely end in a similar name', () => {
    expect([...requestedLibraryNames({ '/src/App.tsx': "import { Hero } from './my-unison-ui';" })]).toEqual([]);
  });

  it('tells Affinity the library is optional and lists sections with their props', async () => {
    const block = await libraryBriefBlock();
    expect(block).toMatch(/optional/i);
    expect(block).toContain('HeroSplitImage');
    expect(block).toContain('interface SectionPropsMap');
  });
});
