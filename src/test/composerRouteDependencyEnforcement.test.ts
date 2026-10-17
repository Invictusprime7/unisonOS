import { describe, expect, it, vi } from 'vitest';
import { composerProposalViolations, type AIComposerRequest, type AIComposerResponse } from '@/contracts/aiComposerContract';
import { assembleCanonicalAuthoringRequest } from '@/services/builder/canonicalAuthoringRequest';
import { runComposerRepairLoop } from '@/services/builder/aiRepairLoop';
import { runComposerLane } from '../../supabase/functions/ai-code-assistant/composerLane';

const path = '/src/pages/Home.tsx';
const req: AIComposerRequest = {
  task: 'builder_source_edit', page: { filePath: path, role: 'home', title: 'Home', route: '/' },
  brief: 'Update heading', files: { [path]: 'Old' }, sourceTargets: [path], routes: [],
};
const response: AIComposerResponse = { summary: '', fileOps: [{ type: 'replace', path, content: 'New' }] };
const route = { type: 'add_page' as const, pageId: 'pricing', title: 'Pricing', route: '/pricing' };
const hunk = `<<<EDIT ${path}\n<<<<<<< SEARCH\nOld\n=======\nNew\n>>>>>>> REPLACE\n>>>END`;

describe('Builder route and dependency request policy', () => {
  it('rejects unplanned route changes', () => {
    expect(composerProposalViolations(req, { ...response, routeOps: [route] }).join()).toContain('not approved');
  });
  it('accepts the exact planned route independent of object key order', () => {
    expect(composerProposalViolations({ ...req, approvedRouteOps: [route] }, {
      ...response, routeOps: [{ route: '/pricing', title: 'Pricing', pageId: 'pricing', type: 'add_page' }],
    })).toEqual([]);
  });
  it('rejects changed route destinations and extra navigation properties', () => {
    for (const op of [{ ...route, route: '/unexpected' }, { ...route, showInNav: true }]) {
      expect(composerProposalViolations({ ...req, approvedRouteOps: [route] }, { ...response, routeOps: [op] }).join()).toContain('not approved');
    }
  });
  it('rejects duplicate route operations', () => {
    expect(composerProposalViolations({ ...req, approvedRouteOps: [route] }, { ...response, routeOps: [route, route] }).join()).toContain('duplicate route');
  });
  it('rejects new dependency requests by default', () => {
    expect(composerProposalViolations(req, { ...response, requestedDependencies: ['unknown-package'] }).join()).toContain('not approved');
  });
  it('accepts only the supplied accepted dependency inventory', () => {
    expect(composerProposalViolations({ ...req, approvedDependencies: ['react'] }, { ...response, requestedDependencies: ['react'] })).toEqual([]);
  });
  it('assembles the canonical route handoff and compact accepted dependency inventory', async () => {
    const assembled = await assembleCanonicalAuthoringRequest({
      task: req.task, page: req.page, brief: req.brief, knowledgeQuery: 'heading', routes: [],
      baseFiles: { ...req.files, '/package.json': JSON.stringify({ dependencies: { react: '^18', invalid: false }, devDependencies: { vitest: '^4' } }) },
      approvedRouteOps: [{ ...route, createdBy: 'ai' }],
    });
    expect(assembled.request.approvedRouteOps).toEqual([route]);
    expect(assembled.request.approvedDependencies).toEqual(expect.arrayContaining(['react']));
    expect(assembled.request.approvedDependencies).not.toContain('@babel/standalone');
    expect(assembled.request.files['/package.json']).toBeUndefined();
  });
  it('edge repairs an unauthorized dependency before returning a candidate', async () => {
    const generate = vi.fn().mockResolvedValueOnce({ content: `${hunk}\nDEPENDENCIES: unknown-package` }).mockResolvedValueOnce({ content: hunk });
    const result = await runComposerLane(JSON.stringify(req), {}, generate);
    expect(result.status).toBe(200);
    expect(JSON.parse((await result.json()).content).requestedDependencies).toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('client rejects route changes before candidate preparation', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { content: JSON.stringify({ ...response, routeOps: [route] }) }, error: null });
    const result = await runComposerRepairLoop({ request: req, baseFiles: req.files, invoke: invoke as never, maxAttempts: 1 });
    expect(result.ok).toBe(false);
    expect(result.prepared).toBeUndefined();
    expect(result.errors.join()).toContain('not approved');
  });
  it('preserves launch page creation without Builder-specific restrictions', async () => {
    const newPath = '/src/pages/Pricing.tsx';
    const generate = vi.fn().mockResolvedValue({ content: `<<<FILE create ${newPath}\nexport default function Pricing(){return <main/>}\n>>>END\nROUTE_OPS: ${JSON.stringify([route])}` });
    const result = await runComposerLane(JSON.stringify({ ...req, task: 'site_page_author', page: { ...req.page, filePath: newPath } }), {}, generate);
    expect(result.status).toBe(200);
    expect(JSON.parse((await result.json()).content).routeOps).toEqual([route]);
  });
});