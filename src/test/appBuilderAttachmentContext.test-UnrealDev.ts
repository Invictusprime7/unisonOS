import { describe, expect, it, vi } from 'vitest';
import { createUnisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { runComposerRepairLoop } from '@/services/builder/aiRepairLoop';

describe('App Builder document attachment flow', () => {
  it('carries the uploaded link and extracted text through authoring and repair', async () => {
    const files = { '/src/pages/Home.tsx': 'export default function Home(){return <main>Before</main>}' };
    const attachmentContext = '[UPLOADED FILES]\nurl: https://example.test/owner-brief.pdf\nextracted text: Owner-written service details';
    const invoke = vi.fn()
      .mockResolvedValueOnce({ data: { content: JSON.stringify({ summary: 'Draft', fileOps: [{
        type: 'replace', path: '/src/pages/Home.tsx',
        content: 'import Missing from "./Missing"; export default function Home(){return <Missing/>}',
      }] }) }, error: null })
      .mockResolvedValueOnce({ data: { content: JSON.stringify({ summary: 'Repaired', fileOps: [{
        type: 'replace', path: '/src/pages/Home.tsx',
        content: 'export default function Home(){return <main>Owner-written service details</main>}',
      }] }) }, error: null });
    const builder = createUnisonAppBuilder({
      runComposer: input => runComposerRepairLoop({ ...input, invoke, resolveDependencies: false }),
    });
    const result = await builder.edit({
      operationId: 'document-edit', currentFiles: files, baseRevisionId: 'accepted-revision',
      page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      sourceTargets: ['/src/pages/Home.tsx'], instruction: 'Use my uploaded brief for the service text.',
      attachmentContext, runtimeContext: 'Optional context'.repeat(2000), timeoutMs: 180_000,
    });
    expect(invoke).toHaveBeenCalledTimes(2);
    for (const [turn] of invoke.mock.calls) {
      const request = JSON.parse(turn.messages[0].content);
      expect(turn.mode).toBe('builder-source-edit');
      expect(request.runtimeContext.startsWith(attachmentContext)).toBe(true);
    }
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.candidateFiles['/src/pages/Home.tsx']).toContain('Owner-written service details');
    expect(files['/src/pages/Home.tsx']).toContain('Before');
  });
});