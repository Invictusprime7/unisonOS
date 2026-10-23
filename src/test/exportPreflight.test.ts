import { describe, expect, it } from 'vitest';
import { runExportPreflight } from '@/services/export/exportPreflight';

describe('runExportPreflight', () => {
  it('passes a closed source graph and reports reproducibility warnings separately', () => {
    const result = runExportPreflight({
      files: {
        '/src/main.tsx': "import App from './App'; import './index.css'; export default App;",
        '/src/App.tsx': "import React from 'react'; export default function App(){ return <main />; }",
        '/src/index.css': ':root { color: black; }',
      },
      entryPoint: '/src/main.tsx',
      packageJson: JSON.stringify({ dependencies: { react: '19.2.1' } }),
      hasLockfile: false,
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.warnings).toContainEqual({ code: 'lockfile-missing' });
  });

  it('fails on a missing entry, import, asset, or undeclared package', () => {
    const result = runExportPreflight({
      files: {
        '/src/main.tsx': "import App from './Missing'; import 'chart.js'; export default App;",
        '/src/App.tsx': "export default function App(){ return <img src='/assets/missing.webp' />; }",
      },
      entryPoint: '/src/missing-main.tsx',
      packageJson: JSON.stringify({ dependencies: {} }),
    });

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'entry-point-missing',
      'unresolved-local-import',
      'unresolved-asset',
      'undeclared-package-import',
    ]));
  });

  it('does not treat root-relative site routes as missing assets', () => {
    const result = runExportPreflight({
      files: {
        '/src/main.tsx': "import App from './App'; export default App;",
        '/src/App.tsx': "export default function App(){ return <a href='/about'>About</a>; }",
        '/src/pages/About.tsx': 'export default function About(){ return <main />; }',
      },
      entryPoint: '/src/main.tsx',
      packageJson: JSON.stringify({ dependencies: {} }),
      hasLockfile: true,
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('flags floating dependency versions without calling closure success reproducible', () => {
    const result = runExportPreflight({
      files: { '/src/main.tsx': 'export default function App(){ return null; }' },
      entryPoint: '/src/main.tsx',
      packageJson: JSON.stringify({ dependencies: { react: '^19.2.1', unknown: 'latest' } }),
      hasLockfile: false,
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      { code: 'floating-dependency-version', packageName: 'react' },
      { code: 'floating-dependency-version', packageName: 'unknown' },
      { code: 'lockfile-missing' },
    ]));
  });

  it('fails clearly when package.json is invalid JSON', () => {
    const result = runExportPreflight({
      files: { '/src/main.tsx': 'export default function App(){ return null; }' },
      entryPoint: '/src/main.tsx',
      packageJson: '{invalid',
    });

    expect(result.issues.map((issue) => issue.code)).toContain('invalid-package-json');
  });
});