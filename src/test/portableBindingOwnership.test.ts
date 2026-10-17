import { describe, expect, it } from 'vitest';
import { composerProposalViolations, type AIComposerRequest } from '@/contracts/aiComposerContract';

const path = '/src/pages/Auth.tsx';
const request: AIComposerRequest = {
  task: 'builder_source_edit', page: { role: 'auth', title: 'Auth', route: '/auth', filePath: path },
  brief: 'Edit auth', files: { [path]: 'export default function Page(){return <main/>}' }, routes: [],
  sourceTargets: [path], approvedIntents: ['auth.login', 'auth.register', 'ui.toggle'],
};
const check = (content: string, input = request) => composerProposalViolations(input, { summary: '', fileOps: [{ type: 'replace', path, content }] });
describe('portable binding ownership at the App Builder candidate boundary', () => {
  it.each(['auth.login', 'auth.register'])('refuses %s overlay bindings on submit forms even if approved', intent => {
    expect(check(`export default function Page(){return <form data-ut-intent="${intent}"><button type="submit" data-ut-intent="${intent}"/></form>}`).join()).toContain('auth submit');
  });
  it('allows form submit ownership and an independently clickable auth link', () => {
    expect(check('export default function Page(){return <form data-intent-form="auth.login"><button type="submit"/><a data-ut-intent="auth.register"/></form>}')).toEqual([]);
  });
  it('rejects backend bindings on local toggles', () => {
    expect(check('export default function Page(){return <button type="button" data-ut-intent="ui.toggle"/>}').join()).toContain('local toggles');
  });
  it('applies the same ownership guard to fresh page authoring', () => {
    expect(check('export default function Page(){return <form data-ut-intent="auth.login"/>}', { ...request, task: 'site_page_author' }).join()).toContain('auth submit');
  });
  it('does not rewrite an existing legacy binding during unrelated edits', () => {
    const old = 'export default function Page(){return <form data-ut-intent="auth.login">Old</form>}';
    expect(check(old.replace('Old', 'New'), { ...request, files: { [path]: old } })).toEqual([]);
  });
});