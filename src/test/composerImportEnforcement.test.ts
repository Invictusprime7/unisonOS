import { describe, expect, it, vi } from 'vitest';
import { composerProposalViolations, type AIComposerRequest, type AIComposerResponse } from '@/contracts/aiComposerContract';
import { runComposerRepairLoop } from '@/services/builder/aiRepairLoop';
import { runComposerLane } from '../../supabase/functions/ai-code-assistant/composerLane';

const path = '/src/pages/Home.tsx';
const req: AIComposerRequest = {
  task: 'builder_source_edit', page: { filePath: path, role: 'home', title: 'Home', route: '/' },
  brief: 'Update source', files: { [path]: 'Old' }, sourceTargets: [path], routes: [], approvedDependencies: ['react', '@radix-ui/react-dialog'],
};
const response = (content: string): AIComposerResponse => ({ summary: '', fileOps: [{ type: 'replace', path, content }] });
const violations = (content: string) => composerProposalViolations(req, response(content));

describe('Builder actual import enforcement', () => {
  it.each([
    "import X from 'unapproved';", "import 'unapproved';", "export { X } from 'unapproved';",
    "export * as UI from 'unapproved';", "const x = require('unapproved');",
    "const x = import('unapproved');", 'const x = import(`unapproved`);',
    "import X = require('unapproved');", "type X = import('unapproved').X;",
  ])('rejects undeclared module use: %s', source => {
    expect(violations(source).join()).toContain('imported dependency is not approved');
  });
  it('accepts approved package roots and scoped subpaths', () => {
    expect(violations("import React from 'react'; export * from '@radix-ui/react-dialog/dist/index';")).toEqual([]);
  });
  it('leaves local module paths to the canonical import graph', () => {
    expect(violations("import X from './X'; import Y from '@/unison/ui/motion'; import Z from '~/Z'; import '/src/local.css';")).toEqual([]);
  });
  it.each(['https://esm.sh/react', '//esm.sh/react', 'node:fs', 'npm:react', 'data:text/javascript,export default 1'])('rejects new protocol imports: %s', specifier => {
    expect(violations(`import X from ${JSON.stringify(specifier)};`).join()).toContain('not approved');
  });
  it('does not mistake comments and ordinary strings for imports', () => {
    expect(violations("// import X from 'unknown'\nconst example = \"require('unknown')\"; /* export * from 'unknown'; */")).toEqual([]);
  });
  it('rejects computed module loads that cannot be approved', () => {
    expect(violations('const x = import(moduleName);').join()).toContain('<computed-module>');
    expect(violations('const x = require(`module-${name}`);').join()).toContain('<computed-module>');
  });
  it('preserves existing imports during unrelated edits but refuses additional occurrences', () => {
    const source = "import X from 'legacy-package';";
    const existing = { ...req, files: { [path]: source } };
    expect(composerProposalViolations(existing, response(`${source}\nconst changed = true;`))).toEqual([]);
    expect(composerProposalViolations(existing, response(`${source}\nexport * from 'legacy-package';`)).join()).toContain('not approved');
    expect(composerProposalViolations(existing, response('const removed = true;'))).toEqual([]);
  });
  it('refuses unparseable candidate imports', () => {
    expect(violations("import X from 'unknown").join()).toContain('not parseable');
  });
  it('edge repairs an undeclared package import before returning source', async () => {
    const hunk = (source: string) => `<<<EDIT ${path}\n<<<<<<< SEARCH\nOld\n=======\n${source}\n>>>>>>> REPLACE\n>>>END`;
    const generate = vi.fn().mockResolvedValueOnce({ content: hunk("import X from 'unapproved';") }).mockResolvedValueOnce({ content: hunk("import React from 'react';") });
    const result = await runComposerLane(JSON.stringify(req), {}, generate);
    expect(result.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(JSON.parse((await result.json()).content).fileOps[0].content).toContain("from 'react'");
  });
  it('client refuses undeclared imports before candidate preparation', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { content: JSON.stringify(response("import X from 'unapproved';")) }, error: null });
    const result = await runComposerRepairLoop({ request: req, baseFiles: req.files, invoke: invoke as never, maxAttempts: 1 });
    expect(result.ok).toBe(false);
    expect(result.prepared).toBeUndefined();
    expect(result.errors.join()).toContain('imported dependency');
  });
  it('keeps launch on its existing dependency intake path', () => {
    expect(composerProposalViolations({ ...req, task: 'site_page_author' }, response("import X from 'unapproved';"))).toEqual([]);
  });
});