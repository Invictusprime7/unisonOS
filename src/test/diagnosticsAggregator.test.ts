import { afterEach, describe, expect, it } from 'vitest';
import { diagnosticsAggregator } from '@/services/diagnosticsAggregator';

afterEach(() => diagnosticsAggregator.clear());

describe('diagnosticsAggregator VFS scoping', () => {
  it('limits AI edit diagnostics to unresolved TypeScript findings in current VFS files', () => {
    diagnosticsAggregator.ingestTypeScriptDiagnostics([
      { file: '/src/Home.tsx', line: 4, message: 'Type mismatch' },
      { file: '/src/Unrelated.tsx', line: 9, message: 'Unrelated mismatch' },
    ]);
    diagnosticsAggregator.ingestUnisonDiagnostics([
      { domain: 'intent', file: '/src/Home.tsx', message: 'Unison intent warning' },
    ]);

    const diagnostics = diagnosticsAggregator.getDiagnosticsForFiles(
      ['/src/Home.tsx'],
      ['typescript'],
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      source: 'typescript',
      file: '/src/Home.tsx',
      message: 'Type mismatch',
    });
  });
});