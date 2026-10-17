import { describe, expect, it, vi } from 'vitest';
import { composerProposalViolations, type AIComposerRequest, type AIComposerResponse } from '@/contracts/aiComposerContract';
import { assembleCanonicalAuthoringRequest, permittedBuilderIntents } from '@/services/builder/canonicalAuthoringRequest';
import { runComposerRepairLoop } from '@/services/builder/aiRepairLoop';
import { runComposerLane } from '../../supabase/functions/ai-code-assistant/composerLane';

const path = '/src/pages/Home.tsx';
const req: AIComposerRequest = {
  task: 'builder_source_edit', page: { filePath: path, role: 'home', title: 'Home', route: '/' },
  brief: 'Update action', files: { [path]: 'Old' }, sourceTargets: [path], routes: [], approvedIntents: ['nav.goto'],
};
const response: AIComposerResponse = { summary: '', fileOps: [{ type: 'replace', path, content: 'New' }] };
const registry = { capabilityRequirements: [{ id: 'commerce', providedIntents: ['invented.action'] }] };

describe('Builder action vocabulary policy', () => {
  it('derives canonical universal actions without inventing missing capabilities', () => {
    const allowed = permittedBuilderIntents(undefined);
    expect(allowed).toContain('nav.goto');
    expect(allowed).not.toContain('booking.create');
    expect(allowed).not.toContain('button.click');
    expect(allowed).not.toContain('nav.goto_page');
  });
  it('uses canonical capability requirements and ignores supplied intent claims', () => {
    expect(permittedBuilderIntents(registry)).toContain('cart.add');
    expect(permittedBuilderIntents(registry)).toContain('cart.checkout');
    expect(permittedBuilderIntents(registry)).not.toContain('booking.create');
    expect(permittedBuilderIntents(registry)).not.toContain('invented.action');
    expect(permittedBuilderIntents({ capabilityRequirements: [{ id: 'booking' }] })).toContain('booking.create');
  });
  it('assembles permissions from saved capability context', async () => {
    const assembled = await assembleCanonicalAuthoringRequest({
      task: req.task, page: req.page, brief: req.brief, knowledgeQuery: 'action', routes: [],
      baseFiles: { ...req.files, '/.unison/wizard-registry-context.json': JSON.stringify(registry) },
    });
    expect(assembled.request.approvedIntents).toContain('cart.add');
    expect(assembled.request.approvedIntents).not.toContain('booking.create');
  });
  it('rejects unknown, alias and lifecycle declarations', () => {
    for (const intent of ['invented.action', 'nav.goto_page', 'button.click', 'booking.create']) {
      expect(composerProposalViolations(req, { ...response, intentsUsed: [intent] }).join()).toContain('not approved');
    }
    expect(composerProposalViolations(req, { ...response, intentsUsed: ['nav.goto'] })).toEqual([]);
  });
  it('rejects unsupported literal bindings even when metadata omits them', () => {
    for (const value of ['"booking.create"', "'booking.create'", '{"booking.create"}', "{'booking.create'}", '{`booking.create`}']) {
      expect(composerProposalViolations(req, { ...response, fileOps: [{ type: 'replace', path, content: `<button data-ut-intent=${value}/>` }] }).join()).toContain('new DOM intent');
    }
  });
  it('preserves existing legacy occurrences but refuses new duplicates', () => {
    const content = '<button data-ut-intent="nav.goto_page"/>';
    const existing = { ...req, files: { [path]: content } };
    expect(composerProposalViolations(existing, { ...response, fileOps: [{ type: 'replace', path, content: `${content} updated` }] })).toEqual([]);
    expect(composerProposalViolations(existing, { ...response, fileOps: [{ type: 'replace', path, content: content + content }] }).join()).toContain('not approved');
  });
  it('edge repairs an unsupported DOM action before returning source', async () => {
    const hunk = (content: string) => `<<<EDIT ${path}\n<<<<<<< SEARCH\nOld\n=======\n${content}\n>>>>>>> REPLACE\n>>>END`;
    const generate = vi.fn().mockResolvedValueOnce({ content: hunk('<button data-ut-intent="booking.create"/>') }).mockResolvedValueOnce({ content: hunk('<button data-ut-intent="nav.goto"/>') });
    const result = await runComposerLane(JSON.stringify(req), {}, generate);
    expect(result.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(JSON.parse((await result.json()).content).fileOps[0].content).toContain('nav.goto');
  });
  it('client refuses unsupported actions before candidate preparation', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { content: JSON.stringify({ ...response, intentsUsed: ['booking.create'] }) }, error: null });
    const result = await runComposerRepairLoop({ request: req, baseFiles: req.files, invoke: invoke as never, maxAttempts: 1 });
    expect(result.ok).toBe(false);
    expect(result.prepared).toBeUndefined();
    expect(result.errors.join()).toContain('not approved');
  });
  it('leaves launch authoring on its existing capability validation path', () => {
    expect(composerProposalViolations({ ...req, task: 'site_page_author' }, { ...response, intentsUsed: ['booking.create'] })).toEqual([]);
  });
});