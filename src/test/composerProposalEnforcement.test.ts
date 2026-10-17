import { describe, expect, it, vi } from 'vitest';
import { composerProposalViolations, type AIComposerRequest } from '@/contracts/aiComposerContract';
import { applyEditHunks, runComposerLane } from '../../supabase/functions/ai-code-assistant/composerLane';
import { assembleCanonicalAuthoringRequest } from '@/services/builder/canonicalAuthoringRequest';
import { runComposerRepairLoop } from '@/services/builder/aiRepairLoop';

const path = '/src/pages/Home.tsx';
const request: AIComposerRequest = {
  task: 'builder_source_edit', page: { role: 'home', title: 'Home', route: '/', filePath: path },
  brief: 'Edit heading', files: { [path]: 'Old' }, routes: [], sourceTargets: [path],
};
const hunk = `<<<EDIT ${path}\n<<<<<<< SEARCH\nOld\n=======\nNew\n>>>>>>> REPLACE\n>>>END`;

describe('Composer proposal boundary', () => {
  it('rejects edits to read-only context files', () => {
    expect(composerProposalViolations({ ...request, files: { ...request.files, '/src/pages/About.tsx': 'About' } }, {
      summary: 'Bad', fileOps: [{ type: 'replace', path: '/src/pages/About.tsx', content: 'Changed' }],
    }).join()).toContain('outside this request');
  });
  it('rejects unknown existing source and duplicate operations', () => {
    expect(composerProposalViolations({ ...request, files: {} }, {
      summary: '', fileOps: [{ type: 'delete', path }, { type: 'delete', path }],
    })).toHaveLength(3);
  });
  it('rejects creates overwriting supplied source', () => {
    expect(composerProposalViolations(request, {
      summary: '', fileOps: [{ type: 'create', path, content: 'New' }],
    }).join()).toContain('cannot overwrite');
  });
  it('allows more than three explicitly targeted files', () => {
    const targets = ['One', 'Two', 'Three', 'Four'].map(name => `/src/pages/${name}.tsx`);
    expect(composerProposalViolations({ ...request, files: {}, sourceTargets: targets }, {
      summary: '', fileOps: targets.map(path => ({ type: 'create', path, content: 'New' })),
    })).toEqual([]);
  });
  it('assembles explicit targets separately from source context', async () => {
    const assembled = await assembleCanonicalAuthoringRequest({
      task: request.task, page: request.page, brief: request.brief, knowledgeQuery: 'heading',
      baseFiles: request.files, sourceTargets: [path, path], routes: [],
    });
    expect(assembled.request.sourceTargets).toEqual([path]);
  });
  it('client repair checks scope before preparing any candidate', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { content: JSON.stringify({
      summary: '', fileOps: [{ type: 'create', path: '/src/pages/Other.tsx', content: 'Other' }],
    }) }, error: null });
    const result = await runComposerRepairLoop({ request, baseFiles: request.files, invoke: invoke as never, maxAttempts: 1 });
    expect(result.ok).toBe(false);
    expect(result.prepared).toBeUndefined();
    expect(result.errors.join()).toContain('outside this request');
  });
  it('allows explicitly targeted new source without widening scope', () => {
    expect(composerProposalViolations({ ...request, files: {} }, {
      summary: '', fileOps: [{ type: 'create', path, content: 'New' }],
    })).toEqual([]);
  });
  it('keeps the router protected even when explicitly targeted', () => {
    expect(composerProposalViolations({ ...request, sourceTargets: ['/src/App.tsx'] }, {
      summary: '', fileOps: [{ type: 'create', path: '/src/App.tsx', content: 'Router' }],
    }).join()).toContain('canonical runtime');
  });
  it('fails missing scope before calling the provider', async () => {
    const generate = vi.fn();
    const response = await runComposerLane(JSON.stringify({ ...request, sourceTargets: undefined }), {}, generate);
    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
  it('accepts a JSON whole-file replace at the edge (candidate gates verify it)', async () => {
    const generate = vi.fn().mockResolvedValue({ content: JSON.stringify({ summary: 'Updated', fileOps: [{ type: 'replace', path, content: 'New' }] }) });
    expect((await runComposerLane(JSON.stringify(request), {}, generate)).status).toBe(200);
  });
  it('repairs an out-of-target proposal and returns only the valid hunk', async () => {
    const generate = vi.fn().mockResolvedValueOnce({ content: '<<<FILE create /src/pages/Other.tsx\nOther\n>>>END' })
      .mockResolvedValueOnce({ content: hunk });
    const response = await runComposerLane(JSON.stringify(request), {}, generate);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.parse(body.content).fileOps).toEqual([{ type: 'replace', path, content: 'New' }]);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('rejects ambiguous whitespace-normalized searches', () => {
    expect(() => applyEditHunks(path, 'Old  \nOld  ', '<<<<<<< SEARCH\nOld \n=======\nNew\n>>>>>>> REPLACE')).toThrow('more than once');
  });
  it('rejects empty searches', () => {
    expect(() => applyEditHunks(path, 'Old', '<<<<<<< SEARCH\n\n=======\nNew\n>>>>>>> REPLACE')).toThrow('must not be empty');
  });
});