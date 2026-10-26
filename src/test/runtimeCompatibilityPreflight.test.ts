import { describe, expect, it } from 'vitest';
import { GENERATED_RUNTIME_PROFILE } from '@/platform/core/generatedRuntimeCapabilities';
import { runRuntimeCompatibilityPreflight } from '@/services/runtimeCompatibilityPreflight';

function dependencies(extra: Record<string, string> = {}) {
  return {
    react: GENERATED_RUNTIME_PROFILE.react,
    'react-dom': GENERATED_RUNTIME_PROFILE.reactDom,
    'react-router-dom': '^6.20.0',
    '@swc/helpers': '0.5.23',
    ...extra,
  };
}

describe('runtime package resolution', () => {
  it('accepts a newly requested scoped package when the site runtime will install it', () => {
    const report = runRuntimeCompatibilityPreflight({
      files: {
        '/src/pages/Home.tsx': [
          "import Widget from '@new-scope/widget/feature';",
          'export default function Home(){return <Widget/>}',
        ].join('\n'),
      },
      dependencies: dependencies({ '@new-scope/widget': '^1.2.3' }),
      dependencyGraphFingerprint: 'site-deps-v1-test',
    });

    expect(report.ok).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.dependencyGraphFingerprint).toBe('site-deps-v1-test');
  });

  it('reports an unresolved package when it is absent from the installed site graph', () => {
    const report = runRuntimeCompatibilityPreflight({
      files: { '/src/pages/Home.tsx': "import Widget from 'missing-widget'; export default Widget;" },
      dependencies: dependencies(),
    });

    expect(report.ok).toBe(false);
    expect(report.dependenciesResolvable).toBe(false);
    expect(report.blockers.join('\n')).toContain('absent from the resolved site dependency graph');
  });

  it('still rejects Node-only imports in browser runtime code', () => {
    const report = runRuntimeCompatibilityPreflight({
      files: { '/src/pages/Home.tsx': "import fs from 'node:fs'; export default fs;" },
      dependencies: dependencies(),
    });

    expect(report.ok).toBe(false);
    expect(report.blockers.join('\n')).toContain('browser previews require npm dependencies or VFS modules');
  });
});