import { describe, expect, it } from 'vitest';
import * as Babel from '@babel/standalone';
import { prepareSandpackFiles, processCode } from '@/utils/sandpackFilePrep';

describe('preview import scanning', () => {
  it.each(['```', '</code></pre>'])('still removes a leaked closing marker: %s', (marker) => {
    const code = 'export default function App() { return <main>Preview</main>; }';
    const output = processCode(`${code}\n  ${marker}\n`, '/App.tsx');
    expect(output).toContain(code);
    expect(output).not.toContain(marker);
  });

  it('compiles a whitespace-heavy page after a side-effect stylesheet import', () => {
    // The old unbounded scans stall on long whitespace runs. Formatting alone
    // must not consume the preview's startup budget.
    const whitespace = ' '.repeat(500_000);
    const files = prepareSandpackFiles({
      '/src/App.tsx': `import './styles.css';
import {
  Hero
} from './components/Hero';
export default function App() { return <main>${whitespace}<Hero /></main>; }`,
      '/src/components/Hero.tsx': 'export function Hero() { return <h1>Preview regression</h1>; }',
      '/src/styles.css': 'main { color: red; }',
    });
    expect(files['/App.tsx']).toContain("import './styles.css';");
    expect(files['/App.tsx']).toContain('<Hero />');
    expect(files['/components/Hero.tsx']).toContain('Preview regression');
  }, 5_000);

  it('adds authored source locators to preview TSX without mutating canonical input', () => {
    const source = `export default function Home() {
  return (
    <main>
      <h1>Hello</h1>
    </main>
  );
}`;
    const files = prepareSandpackFiles({ '/src/pages/Home.tsx': source });

    expect(files['/pages/Home.tsx']).toContain('data-ut-source-locator="/src/pages/Home.tsx:4:7"');
    expect(source).not.toContain('data-ut-source-locator');
  });

  it('marks rendered native elements rather than React component wrappers', () => {
    const files = prepareSandpackFiles({
      '/src/App.tsx': 'export default function App(){return <main><Widget /></main>}',
      '/src/components/Widget.tsx': 'export function Widget(){return <h1>Rendered node</h1>}',
    });

    expect(files['/App.tsx']).toMatch(/<main data-ut-source-locator="[^"]+"><Widget\s*\/>/);
    expect(files['/App.tsx']).not.toMatch(/<Widget[^>]*data-ut-source-locator/);
    expect(files['/components/Widget.tsx']).toMatch(/<h1 data-ut-source-locator="[^"]+">Rendered node<\/h1>/);
  });

  it('removes multiline self imports after a side-effect import without leaving invalid source', () => {
    const files = prepareSandpackFiles({
      '/src/App.tsx': `import './styles.css';
import App, {
  caption as selfCaption
} from './App';
import * as React from 'react';
export const caption = 'Preview';
export default function App() { return <main>{caption}</main>; }`,
      '/src/styles.css': 'main { color: red; }',
    });
    expect(files['/App.tsx']).not.toMatch(/^import App/m);
    expect(files['/App.tsx']).toContain("import './styles.css';");
    expect(files['/App.tsx']).toContain("import * as React from 'react';");
    expect(() => Babel.transform(files['/App.tsx'], {
      filename: 'App.tsx', presets: ['typescript', 'react'],
    })).not.toThrow();
  });

  it('compiles multiline JSX whitespace without rescanning every remaining blank line', () => {
    const files = prepareSandpackFiles({
      '/src/App.tsx': `import * as React from 'react';
export default function App() { return <main>${'\n'.repeat(200_000)}Preview</main>; }`,
    });
    expect(files['/App.tsx']).toContain('Preview</main>');
    expect(files['/App.tsx'].match(/import \* as React/g)).toHaveLength(1);
  }, 5_000);

  it.each([
    "import React, {\n useState\n} from 'react';",
    "import {\n default as React, useState\n} from 'react';",
    "import * as React from 'react';",
  ])('preserves a real React value import: %s', (reactImport) => {
    const files = prepareSandpackFiles({
      '/src/App.tsx': `${reactImport}\nexport default function App() { return <main>React import</main>; }`,
    });
    expect(files['/App.tsx']).not.toContain("import * as React from 'react';\n" + reactImport);
    expect(() => Babel.transform(files['/App.tsx'], {
      filename: 'App.tsx', presets: ['typescript', 'react'],
    })).not.toThrow();
  });
});
