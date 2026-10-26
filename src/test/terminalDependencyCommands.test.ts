import { describe, expect, it } from 'vitest';
import { getDiagnosticsForAI, processCommand, type CommandContext } from '@/services/terminalCommands';

function context(currentDeps: Record<string, string> = {}, onAddDep = () => undefined): CommandContext {
  return {
    nodes: [{
      id: 'home',
      name: 'Home.tsx',
      content: "import Chart from '@new-scope/chart/feature'; export default function Home(){return <Chart/>}",
      type: 'file',
      language: 'typescript',
      parentId: null,
      path: '/src/pages/Home.tsx',
    }],
    currentDeps,
    onAddDep,
    onRemoveDep: () => undefined,
  };
}

describe('terminal site dependency commands', () => {
  it('installs any requested npm package and tracks its scoped package root', () => {
    const added: Array<[string, string]> = [];
    const ctx = context({}, (name, version) => added.push([name, version]));

    const result = processCommand('install @new-scope/chart@^1.2.3', ctx);

    expect(result.mutated).toBe(true);
    expect(added).toEqual([['@new-scope/chart', '^1.2.3']]);
    expect(getDiagnosticsForAI(ctx).issues).toMatchObject({
      importIssues: [expect.stringContaining('Missing dependency "@new-scope/chart/feature"')],
    });
  });

  it('lists only packages installed for this site, not the global Sandpack catalog', () => {
    const result = processCommand('deps', context({ '@new-scope/chart': '^1.2.3' }));
    const output = result.lines.map((line) => line.text).join('\n');

    expect(output).toContain('@new-scope/chart ^1.2.3');
    expect(output).not.toContain('lucide-react');
  });
});